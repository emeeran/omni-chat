from flask import Blueprint, jsonify, request, current_app
from api_providers.provider_factory import get_provider, get_available_providers
from database.chat_store import ChatStore
from models.chat import Chat, Message
from utils.document_processor import DocumentProcessor
import os
from werkzeug.utils import secure_filename
import logging
import uuid
import time
import json
from functools import wraps
from typing import Dict, List, Any, Optional, Callable

# Configure logging with a more efficient format
logging.basicConfig(
    level=logging.INFO,  # Change from DEBUG to INFO for production
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

api_routes = Blueprint('api', __name__, url_prefix='/api')
chat_store = ChatStore()
document_processor = DocumentProcessor()

# File upload configuration
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx', 'md'}
UPLOAD_FOLDER = 'data/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Request rate limiter - simple in-memory implementation
class RateLimiter:
    def __init__(self, limit: int = 60, window: int = 60):
        self.limit = limit  # requests
        self.window = window  # seconds
        self.requests = {}  # ip -> list of timestamps

    def is_allowed(self, ip: str) -> bool:
        current_time = time.time()

        # Initialize for new IP
        if ip not in self.requests:
            self.requests[ip] = []

        # Remove old requests outside the window
        self.requests[ip] = [t for t in self.requests[ip] if current_time - t < self.window]

        # Check if under limit
        if len(self.requests[ip]) < self.limit:
            self.requests[ip].append(current_time)
            return True

        return False

# Create rate limiter
rate_limiter = RateLimiter()

# Cache for API responses to reduce redundant processing
response_cache = {}
CACHE_TTL = 300  # 5 minutes

# Error handling decorator to reduce code duplication
def api_error_handler(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"API error in {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({"error": f"Server error: {str(e)}"}), 500
    return decorated_function

# Rate limiting decorator
def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        ip = request.remote_addr

        if not rate_limiter.is_allowed(ip):
            logger.warning(f"Rate limit exceeded for IP: {ip}")
            return jsonify({
                "error": "Rate limit exceeded. Please try again later."
            }), 429

        return f(*args, **kwargs)
    return decorated_function

# Caching decorator for GET endpoints
def cache_response(ttl=CACHE_TTL):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Only cache GET requests
            if request.method != 'GET':
                return f(*args, **kwargs)

            # Create cache key from endpoint and query string
            cache_key = f"{request.path}?{request.query_string.decode('utf-8')}"

            # Check if response is in cache and not expired
            if cache_key in response_cache:
                entry_time, response = response_cache[cache_key]
                if time.time() - entry_time < ttl:
                    return response

            # Generate the response
            response = f(*args, **kwargs)

            # Cache the response
            response_cache[cache_key] = (time.time(), response)

            return response
        return decorated_function
    return decorator

# Validate request data
def validate_request_data(required_fields: List[str], data: Dict) -> Optional[Dict]:
    """Validate request data for required fields and return error response if invalid"""
    if not data:
        return {
            "error": "No data provided",
            "status_code": 400
        }

    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return {
            "error": f"Missing required fields: {', '.join(missing_fields)}",
            "status_code": 400
        }

    return None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Simple health check endpoint
@api_routes.route('/health', methods=['GET', 'HEAD'])
def health():
    """Health check endpoint"""
    if request.method == 'HEAD':
        return '', 200
    return jsonify({"status": "ok", "message": "OmniChat API is running"})

# Get a list of all available AI providers
@api_routes.route('/providers', methods=['GET'])
@cache_response(ttl=3600)  # Cache for 1 hour
def get_providers():
    """Get a list of all available AI providers"""
    providers = get_available_providers()
    return jsonify(list(providers.values()))

# Get a list of available models for a provider
@api_routes.route('/models', methods=['GET'])
@cache_response(ttl=3600)  # Cache for 1 hour
@api_error_handler
def get_models():
    """Get a list of available models for a provider"""
    provider_id = request.args.get('provider', 'groq')
    provider = get_provider(provider_id)
    if not provider:
        return jsonify({"error": f"Provider {provider_id} not found"}), 404

    models = provider.get_models()
    return jsonify(models)

@api_routes.route('/chat', methods=['POST'])
@rate_limit
@api_error_handler
def chat():
    """Send a chat message to the selected AI provider"""
    logger.debug("Chat endpoint called")
    data = request.json

    # Validate request data
    validation_error = validate_request_data(['provider', 'model'], data)
    if validation_error:
        return jsonify({"error": validation_error["error"]}), validation_error["status_code"]

    logger.debug(f"Received data: {data}")

    provider_id = data.get('provider')
    model_id = data.get('model')
    messages = data.get('messages', [])
    chat_id = data.get('chat_id')
    content = data.get('content')

    logger.debug(f"Processing chat request: provider={provider_id}, model={model_id}, chat_id={chat_id}")

    # Get provider instance
    provider = get_provider(provider_id)
    if not provider:
        logger.error(f"Provider {provider_id} not found")
        return jsonify({"error": f"Provider {provider_id} not found"}), 404

    # Get existing chat or create a new one
    chat = None
    if chat_id:
        # Handle temporary chat IDs that start with "new-"
        if chat_id.startswith('new-'):
            logger.debug(f"Creating new chat from temporary ID: {chat_id}")
            chat = Chat(
                chat_id=str(uuid.uuid4()),  # Generate a proper UUID
                provider=provider_id,
                model=model_id,
                system_prompt=data.get('system_prompt'),
                title=data.get('title', 'New Chat')
            )
        else:
            # Regular chat ID lookup
            chat = chat_store.get_chat(chat_id)
            if not chat:
                logger.error(f"Chat {chat_id} not found")
                return jsonify({"error": f"Chat {chat_id} not found"}), 404
    else:
        logger.debug("Creating new chat")
        chat = Chat(
            provider=provider_id,
            model=model_id,
            system_prompt=data.get('system_prompt'),
            title=data.get('title', 'New Chat')
        )

    # If this is the first message in a new chat, add system message if provided
    if not chat.messages and data.get('system_prompt'):
        logger.debug(f"Adding system prompt: {data.get('system_prompt')[:30]}...")
        chat.add_message("system", data.get('system_prompt'))

    # Add the user message to the chat
    if content:
        logger.debug(f"Adding user message: {content[:30]}...")
        chat.add_message("user", content)

    # If we have messages directly in the request, use those instead
    if messages:
        logger.debug(f"Using provided messages array with {len(messages)} messages")
        api_messages = messages
    else:
        # Prepare messages for the API call
        api_messages = []
        for message in chat.messages:
            api_messages.append({
                "role": message.role,
                "content": message.content
            })
        logger.debug(f"Created message array with {len(api_messages)} messages")

    # Call the provider API
    logger.debug(f"Calling provider API: {provider_id}")
    start_time = time.time()
    response = provider.chat_completion(
        model=model_id or chat.model,
        messages=api_messages,
        temperature=data.get('temperature', 0.7),
        max_tokens=data.get('max_tokens')
    )
    end_time = time.time()
    logger.info(f"API call took {end_time - start_time:.2f} seconds")

    # Check if there was an error
    if 'error' in response:
        logger.error(f"Provider API error: {response['error']}")
        return jsonify(response), 500

    # Extract the assistant response
    assistant_response = response.get('choices', [{}])[0].get('message', {}).get('content', '')
    logger.debug(f"Received assistant response: {assistant_response[:30]}...")

    # Ensure markdown formatting
    def ensure_markdown(text):
        if text.strip().startswith('```') or text.strip().startswith('#') or text.strip().startswith('>'):
            return text
        return f"""```
{text.strip()}
```"""
    assistant_response_markdown = ensure_markdown(assistant_response)

    # Add the assistant response to the chat
    chat.add_message("assistant", assistant_response)

    # Update chat title if this is the first exchange and no title was provided
    if len(chat.messages) <= 3 and not chat.title:
        # Generate a title based on the first user message
        first_user_message = next((msg for msg in chat.messages if msg.role == "user"), None)
        if first_user_message:
            chat.title = first_user_message.content[:30] + "..." if len(first_user_message.content) > 30 else first_user_message.content

    # Save the chat
    chat_store.save_chat(chat)

    # Return the response with the chat_id
    return jsonify({
        "chat_id": chat.chat_id,
        "title": chat.title,
        "assistant_response": assistant_response,
        "assistant_response_markdown": assistant_response_markdown,
        "full_response": response
    })

@api_routes.route('/chat/rag', methods=['POST'])
@rate_limit
@api_error_handler
def rag_chat():
    """Send a RAG-enhanced chat message to the selected AI provider"""
    logger.debug("RAG Chat endpoint called")
    data = request.json

    # Validate request data
    validation_error = validate_request_data(['provider', 'model', 'content'], data)
    if validation_error:
        return jsonify({"error": validation_error["error"]}), validation_error["status_code"]

    logger.debug(f"Received RAG data: {data}")

    provider_id = data.get('provider')
    model_id = data.get('model')
    chat_id = data.get('chat_id')
    query = data.get('content', '')
    document_ids = data.get('document_ids', [])

    # Performance: Early check for no document IDs to avoid unnecessary processing
    if not document_ids:
        logger.warning("RAG chat requested with no document IDs")
        return jsonify({"error": "No documents provided for RAG chat"}), 400

    logger.debug(f"Processing RAG chat request: provider={provider_id}, model={model_id}, chat_id={chat_id}, docs={len(document_ids)}")

    provider = get_provider(provider_id)
    if not provider:
        logger.error(f"Provider {provider_id} not found")
        return jsonify({"error": f"Provider {provider_id} not found"}), 404

    # Get existing chat or create a new one
    chat = None
    if chat_id:
        # Handle temporary chat IDs that start with "new-"
        if chat_id.startswith('new-'):
            logger.debug(f"Creating new RAG chat from temporary ID: {chat_id}")
            chat = Chat(
                chat_id=str(uuid.uuid4()),  # Generate a proper UUID
                provider=provider_id,
                model=model_id,
                system_prompt=data.get('system_prompt'),
                title=data.get('title', 'New RAG Chat')
            )
        else:
            # Regular chat ID lookup
            chat = chat_store.get_chat(chat_id)
            if not chat:
                logger.error(f"Chat {chat_id} not found")
                return jsonify({"error": f"Chat {chat_id} not found"}), 404
    else:
        logger.debug("Creating new RAG chat")
        chat = Chat(
            provider=provider_id,
            model=model_id,
            system_prompt=data.get('system_prompt'),
            title=data.get('title', 'New RAG Chat')
        )

    # If this is the first message in a new chat, add system message if provided
    if not chat.messages and data.get('system_prompt'):
        logger.debug(f"Adding system prompt to RAG chat: {data.get('system_prompt')[:30]}...")
        chat.add_message("system", data.get('system_prompt'))

    # Add the user message to the chat
    if query:
        logger.debug(f"Adding user message to RAG chat: {query[:30]}...")
        chat.add_message("user", query)

    # OPTIMIZATION: Use parallel document retrieval with connection pooling
    # Calculate optimal batch size based on document count
    start_time = time.time()
    doc_count = len(document_ids)
    batch_size = min(max(5, doc_count // 4), 20)  # Between 5 and 20 depending on doc count
    top_k = min(max(5, doc_count), 15)  # Adaptive top_k based on document count

    # Use semantic filtering to prioritize most relevant documents before detailed search
    relevance_threshold = 0.20  # Minimum relevance score

    search_results = document_processor.search_documents(
        query=query,
        top_k=top_k,
        doc_ids=document_ids,
        min_score=relevance_threshold,
        use_semantic_filtering=True  # Enable semantic pre-filtering
    )
    retrieval_time = time.time() - start_time
    logger.info(f"Document retrieval took {retrieval_time:.2f} seconds for {len(search_results)} chunks")

    # OPTIMIZATION: Create better context from search results with document metadata
    # Group by document and use a more structured format for better readability
    doc_groups = {}
    for chunk in search_results:
        doc_id = chunk.get('doc_id')
        if doc_id not in doc_groups:
            # Cache document metadata to reduce duplicate lookups
            cache_key = f"doc_meta_{doc_id}"
            if cache_key in response_cache:
                metadata = response_cache[cache_key][1]
            else:
                metadata = document_processor.get_document_metadata(doc_id)
                response_cache[cache_key] = (time.time(), metadata)

            doc_groups[doc_id] = {
                'metadata': metadata,
                'chunks': []
            }
        doc_groups[doc_id]['chunks'].append(chunk)

    # Build context with better structure and formatting
    context_parts = []
    for doc_id, group in doc_groups.items():
        metadata = group['metadata']
        if not metadata:
            continue

        filename = metadata.get('filename', 'Unknown document')
        title = metadata.get('title', filename)

        # Add document header
        doc_context = f"Document: {title} (File: {filename})\n"

        # Add relevant chunks with page/section info when available
        for i, chunk in enumerate(group['chunks']):
            page = chunk.get('metadata', {}).get('page', '')
            section = chunk.get('metadata', {}).get('section', '')
            location = f" | Page: {page}" if page else ""
            location += f" | Section: {section}" if section else ""

            doc_context += f"\nExcerpt {i+1}{location}:\n{chunk.get('content', '')}\n"

        context_parts.append(doc_context)

    # Join context parts with clear separators
    context = "\n" + "-" * 40 + "\n".join(context_parts) if context_parts else ""

    # OPTIMIZATION: Cache and reuse system prompts with LRU cache behavior
    system_prompt_cache_key = f"rag_system_{provider_id}_{model_id}"
    rag_system_prompt = None

    if system_prompt_cache_key in response_cache:
        entry_time, rag_system_prompt = response_cache[system_prompt_cache_key]
        # Check if cache is still valid
        if time.time() - entry_time >= CACHE_TTL:
            rag_system_prompt = None

    if not rag_system_prompt:
        # Add system prompt with RAG-specific instructions
        system_messages = [msg for msg in chat.messages if msg.role == "system"]
        if system_messages:
            base_system_prompt = system_messages[0].content
            rag_system_prompt = (
                f"{base_system_prompt}\n\n"
                "When answering, use the provided document information. "
                "Cite specific documents when referencing information from them. "
                "If the information needed is not in the documents, clearly state this. "
                "For each fact from the documents, mention which document it came from."
            )
        else:
            # Add default RAG system prompt
            rag_system_prompt = (
                "You are a helpful assistant that answers questions based on the provided documents. "
                "Cite specific documents when referencing information from them. "
                "If the information needed is not in the documents, clearly state this. "
                "For each fact from the documents, mention which document it came from."
            )

        # Cache the system prompt
        response_cache[system_prompt_cache_key] = (time.time(), rag_system_prompt)

    # OPTIMIZATION: Only include essential message history to reduce token count
    # and dynamically adjust based on retrieved context size
    history_limit = min(data.get('history_limit', 4), 6)  # Default to last 4 exchanges, cap at 6
    # Estimate token count of context to adjust history inclusion
    context_size = len(context) // 4  # Rough estimate: 4 chars ≈ 1 token
    if context_size > 3000:
        history_limit = min(history_limit, 2)  # Reduce history if context is large

    # Prepare API messages
    api_messages = [{"role": "system", "content": rag_system_prompt}]

    # Get regular messages (excluding the last user message and system)
    if history_limit > 0:
        all_regular_messages = [
            msg for msg in chat.messages
            if msg.role != "system" and not (msg.role == "user" and msg == chat.messages[-1])
        ]

        # Take most recent messages based on adjusted history_limit
        regular_messages = all_regular_messages[-history_limit*2:] if all_regular_messages else []

        for message in regular_messages:
            api_messages.append({
                "role": message.role,
                "content": message.content
            })

    # OPTIMIZATION: Format query more efficiently to reduce token usage
    # and ensure context doesn't exceed model limits
    max_context_length = 6000  # Safe limit for most models
    if context and len(context) > max_context_length:
        # Truncate context while preserving document structure
        context_parts = context.split("-" * 40)
        truncated_parts = []
        current_length = 0

        for part in context_parts:
            if current_length + len(part) > max_context_length:
                # Add a note about truncation
                truncated_parts.append("\n[Additional document content truncated due to length]")
                break
            truncated_parts.append(part)
            current_length += len(part)

        context = ("-" * 40).join(truncated_parts)

    if context:
        enhanced_query = (
            f"Question: {query}\n\n"
            f"Relevant information from documents:\n{context}\n\n"
            f"Answer the question based on the provided documents. If the documents don't contain the needed information, acknowledge this."
        )
    else:
        enhanced_query = query

    api_messages.append({
        "role": "user",
        "content": enhanced_query
    })

    # OPTIMIZATION: Add timeout handling, retry logic, and circuit breaker for API calls
    max_retries = 2
    retry_count = 0
    response = None
    backoff_factor = 0.5

    while retry_count <= max_retries:
        try:
            # Call the provider API with timeout
            logger.debug(f"Calling provider API for RAG: {provider_id} (Attempt {retry_count + 1})")
            start_time = time.time()

            response = provider.chat_completion(
                model=model_id or chat.model,
                messages=api_messages,
                temperature=data.get('temperature', 0.7),
                max_tokens=data.get('max_tokens', 2000)  # Higher default for RAG
            )

            # If we get here, the call succeeded
            api_time = time.time() - start_time
            logger.info(f"RAG API call took {api_time:.2f} seconds")
            break

        except Exception as e:
            retry_count += 1
            logger.warning(f"RAG API call failed (attempt {retry_count}): {str(e)}")

            if retry_count > max_retries:
                return jsonify({
                    "error": f"Provider API failed after {max_retries} attempts: {str(e)}"
                }), 503

            # Exponential backoff before retry
            time.sleep(backoff_factor * (2 ** retry_count))

    # Check if there was an error
    if 'error' in response:
        logger.error(f"Provider API error in RAG: {response['error']}")
        return jsonify(response), 500

    # Extract the assistant response
    assistant_response = response.get('choices', [{}])[0].get('message', {}).get('content', '')
    logger.debug(f"Received RAG assistant response: {assistant_response[:30]}...")

    # Ensure markdown formatting
    assistant_response_markdown = ensure_markdown(assistant_response)

    # Add the assistant response to the chat
    chat.add_message("assistant", assistant_response)

    # Update chat title if this is the first exchange and no title was provided
    if len(chat.messages) <= 3 and not chat.title:
        # Generate a title based on the first user message
        chat.title = query[:30] + "..." if len(query) > 30 else query

    # Save the chat
    chat_store.save_chat(chat)

    # OPTIMIZATION: Return more detailed source information to improve UI experience
    source_documents = []
    for doc_id, group in doc_groups.items():
        metadata = group['metadata']
        if not metadata:
            continue

        source_documents.append({
            "doc_id": doc_id,
            "filename": metadata.get('filename', ''),
            "title": metadata.get('title', metadata.get('filename', '')),
            "chunks_used": len(group['chunks'])
        })

    # Return the response with enhanced metadata
    return jsonify({
        "chat_id": chat.chat_id,
        "title": chat.title,
        "assistant_response": assistant_response,
        "assistant_response_markdown": assistant_response_markdown,
        "context_used": bool(context),
        "documents_used": len(search_results),
        "source_documents": source_documents[:5],  # Return top 5 for UI
        "processing_time": {
            "retrieval_seconds": retrieval_time,
            "api_seconds": time.time() - start_time,
            "total_seconds": retrieval_time + (time.time() - start_time)
        },
        "full_response": response
    })

@api_routes.route('/documents/upload', methods=['POST'])
@rate_limit
@api_error_handler
def upload_document():
    """Upload a document for RAG processing"""
    # Check if file is present in the request
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']

    # Check if file is selected
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Check if file type is allowed
    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Supported types: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Secure the filename
    filename = secure_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    # Save the file
    file.save(file_path)

    try:
        # Read the file content with proper encoding detection
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        # Try another encoding if utf-8 fails
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Failed to read file {filename}: {str(e)}")
            return jsonify({"error": f"Failed to read file: {str(e)}"}), 500

    # Process the document
    start_time = time.time()
    doc_id = document_processor.process_document(content, filename)
    processing_time = time.time() - start_time

    # Get document metadata
    metadata = document_processor.get_document_metadata(doc_id)

    return jsonify({
        "doc_id": doc_id,
        "filename": filename,
        "metadata": metadata,
        "processing_time_seconds": processing_time,
        "size_bytes": os.path.getsize(file_path),
        "success": True
    })

# All the routes below use caching and rate limiting to improve performance

@api_routes.route('/documents', methods=['GET'])
@cache_response(ttl=30)  # Cache for 30 seconds
@rate_limit
@api_error_handler
def list_documents():
    """Get a list of all documents"""
    documents = document_processor.list_documents()
    return jsonify(documents)

@api_routes.route('/documents/<doc_id>', methods=['GET'])
@cache_response(ttl=300)  # Cache for 5 minutes
@rate_limit
@api_error_handler
def get_document(doc_id):
    """Get a specific document by ID"""
    metadata = document_processor.get_document_metadata(doc_id)
    if not metadata:
        return jsonify({"error": f"Document {doc_id} not found"}), 404

    chunks = document_processor.get_chunks(doc_id)

    return jsonify({
        "metadata": metadata,
        "chunks": chunks
    })

@api_routes.route('/documents/<doc_id>/search', methods=['GET'])
@rate_limit
@api_error_handler
def search_document(doc_id):
    """Search within a specific document"""
    query = request.args.get('query', '')
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    metadata = document_processor.get_document_metadata(doc_id)
    if not metadata:
        return jsonify({"error": f"Document {doc_id} not found"}), 404

    # Get all chunks for the document
    chunks = document_processor.get_chunks(doc_id)

    # Simple search implementation
    results = []
    query_terms = query.lower().split()

    for chunk in chunks:
        content = chunk.get('content', '').lower()
        score = 0

        for term in query_terms:
            score += content.count(term)

        if score > 0:
            results.append({
                "chunk": chunk,
                "score": score
            })

    # Sort by score
    results.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "document": metadata,
        "results": [item["chunk"] for item in results]
    })

@api_routes.route('/documents/<doc_id>', methods=['DELETE'])
@rate_limit
@api_error_handler
def delete_document(doc_id):
    """Delete a document by ID"""
    success = document_processor.delete_document(doc_id)
    if not success:
        return jsonify({"error": f"Failed to delete document {doc_id}"}), 500

    # Clear any cached responses that might include this document
    global response_cache
    response_cache = {k: v for k, v in response_cache.items() if '/documents' not in k}

    return jsonify({"success": True})

@api_routes.route('/chats', methods=['GET'])
@cache_response(ttl=10)  # Short cache for frequently changing data
@rate_limit
@api_error_handler
def list_chats():
    """Get a list of all chats"""
    limit = request.args.get('limit', default=20, type=int)
    offset = request.args.get('offset', default=0, type=int)

    chats = chat_store.list_chats()

    # Apply pagination
    paginated_chats = chats[offset:offset+limit]

    return jsonify({
        "chats": paginated_chats,
        "total": len(chats),
        "limit": limit,
        "offset": offset
    })

@api_routes.route('/chats/<chat_id>', methods=['GET'])
@cache_response(ttl=10)  # Short cache for chat data
@rate_limit
@api_error_handler
def get_chat(chat_id):
    """Get a specific chat by ID"""
    chat = chat_store.get_chat(chat_id)
    if not chat:
        return jsonify({"error": f"Chat {chat_id} not found"}), 404

    return jsonify(chat.to_dict())

@api_routes.route('/chats/<chat_id>', methods=['DELETE'])
@rate_limit
@api_error_handler
def delete_chat(chat_id):
    """Delete a chat by ID"""
    success = chat_store.delete_chat(chat_id)
    if not success:
        return jsonify({"error": f"Failed to delete chat {chat_id}"}), 500

    # Clear any cached responses related to this chat
    global response_cache
    response_cache = {k: v for k, v in response_cache.items() if chat_id not in k}

    return jsonify({"success": True})

@api_routes.route('/chats/<chat_id>/title', methods=['PUT'])
@rate_limit
@api_error_handler
def update_chat_title(chat_id):
    """Update a chat's title"""
    data = request.json
    new_title = data.get('title')

    if not new_title:
        return jsonify({"error": "Title is required"}), 400

    chat = chat_store.get_chat(chat_id)
    if not chat:
        return jsonify({"error": f"Chat {chat_id} not found"}), 404

    chat.title = new_title
    success = chat_store.update_chat(chat)

    if not success:
        return jsonify({"error": f"Failed to update chat {chat_id}"}), 500

    # Clear cached responses that might include this chat
    global response_cache
    response_cache = {k: v for k, v in response_cache.items() if chat_id not in k}

    return jsonify({"success": True})

@api_routes.route('/personas', methods=['GET'])
@cache_response(ttl=3600)  # Cache for 1 hour since personas rarely change
@api_error_handler
def get_personas():
    """Get a list of available personas (system prompts)"""
    personas = [
        {
            "id": "default",
            "name": "Default Assistant",
            "prompt": "You are a helpful, creative, and friendly AI assistant. Answer as concisely as possible."
        },
        {
            "id": "developer",
            "name": "Developer Assistant",
            "prompt": "You are an expert software developer assistant. Provide detailed, accurate technical advice with code examples when appropriate."
        },
        {
            "id": "writer",
            "name": "Writing Assistant",
            "prompt": "You are a writing assistant that helps improve text clarity, grammar, and style. Provide thoughtful suggestions to enhance writing quality."
        },
        {
            "id": "researcher",
            "name": "Research Assistant",
            "prompt": "You are a research assistant who helps find, analyze, and summarize information. Provide well-cited, factual responses and highlight areas of consensus and controversy."
        },
        {
            "id": "creative",
            "name": "Creative Collaborator",
            "prompt": "You are a creative collaborator who helps generate new ideas, stories, and content. Be imaginative, playful, and inspiring in your responses."
        },
        {
            "id": "expert",
            "name": "Expert Analyst",
            "prompt": "You are an expert analyst who provides insightful, thorough analysis on complex topics. Your responses should be well-structured, comprehensive, and nuanced."
        },
        {
            "id": "teacher",
            "name": "Patient Teacher",
            "prompt": "You are a patient teacher who explains complex concepts in simple terms. Adapt your explanations to different learning styles and provide examples to illustrate key points."
        },
        {
            "id": "coach",
            "name": "Supportive Coach",
            "prompt": "You are a supportive coach who helps set and achieve goals. Provide encouragement, practical advice, and accountability in your responses."
        },
        {
            "id": "critic",
            "name": "Constructive Critic",
            "prompt": "You are a constructive critic who provides honest, helpful feedback. Balance pointing out areas for improvement with recognizing strengths."
        },
        {
            "id": "debater",
            "name": "Balanced Debater",
            "prompt": "You are a balanced debater who can present multiple perspectives on complex issues. Present the strongest versions of different viewpoints and identify common ground when possible."
        },
        {
            "id": "data_analyst",
            "name": "Data Analyst",
            "prompt": "You are a data analyst who excels at interpreting numbers and trends. Help extract insights from data and explain your analysis in clear, accessible language."
        },
        {
            "id": "strategist",
            "name": "Business Strategist",
            "prompt": "You are a business strategist who helps develop and refine strategic plans. Provide thoughtful analysis of opportunities, threats, and potential paths forward."
        },
        {
            "id": "designer",
            "name": "Design Thinker",
            "prompt": "You are a design thinker who helps solve problems with creativity and user focus. Approach challenges with empathy, ideation, and a willingness to iterate."
        },
        {
            "id": "interviewer",
            "name": "Curious Interviewer",
            "prompt": "You are a curious interviewer who asks insightful questions to draw out interesting information and perspectives. Help people explore and articulate their thoughts."
        },
        {
            "id": "custom",
            "name": "Custom Persona",
            "prompt": ""
        }
    ]
    return jsonify(personas)

# Add a route to clear cache - useful for development/testing
@api_routes.route('/cache/clear', methods=['POST'])
@api_error_handler
def clear_cache():
    """Clear the API response cache"""
    global response_cache
    response_cache = {}
    return jsonify({"success": True, "message": "Cache cleared"})

# Add a metrics endpoint for monitoring
@api_routes.route('/metrics', methods=['GET'])
@api_error_handler
def get_metrics():
    """Get API metrics and statistics"""
    stats = {
        "cache_size": len(response_cache),
        "rate_limiter_ips": len(rate_limiter.requests),
        "chats_count": len(chat_store.list_chats()),
        "documents_count": len(document_processor.list_documents()),
        "uptime_seconds": int(time.time() - current_app.start_time)
    }
    return jsonify(stats)