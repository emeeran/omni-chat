from flask import Blueprint, jsonify, request
from api_providers.provider_factory import get_provider
from database.chat_store import ChatStore
from models.chat import Chat, Message
from utils.document_processor import DocumentProcessor
import os
from werkzeug.utils import secure_filename
import logging
import uuid

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

api_routes = Blueprint('api', __name__, url_prefix='/api')
chat_store = ChatStore()
document_processor = DocumentProcessor()

# Simple test endpoint to verify API is working
@api_routes.route('/test', methods=['GET'])
def test():
    """Simple test endpoint to verify API is working"""
    return jsonify({"status": "ok", "message": "API is working"})

# File upload configuration
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx', 'md'}
UPLOAD_FOLDER = 'data/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@api_routes.route('/providers', methods=['GET'])
def get_providers():
    """Get a list of all available AI providers"""
    providers = [
        {"id": "groq", "name": "Groq", "default": True},
        {"id": "openai", "name": "OpenAI"},
        {"id": "anthropic", "name": "Anthropic"},
        {"id": "mistral", "name": "Mistral AI"},
        {"id": "cohere", "name": "Cohere"},
        {"id": "xai", "name": "X AI"},
        {"id": "fireworks", "name": "Fireworks"},
        {"id": "deepseek", "name": "DeepSeek"},
        {"id": "dashscope", "name": "DASHSCOPE"},
        {"id": "gemini", "name": "Gemini"},
        {"id": "openrouter", "name": "OpenRouter AI"}
    ]
    return jsonify(providers)

@api_routes.route('/models', methods=['GET'])
def get_models():
    """Get a list of available models for a provider"""
    provider_id = request.args.get('provider', 'groq')
    provider = get_provider(provider_id)
    if not provider:
        return jsonify({"error": f"Provider {provider_id} not found"}), 404

    try:
        models = provider.get_models()
        return jsonify(models)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_routes.route('/chat', methods=['POST'])
def chat():
    """Send a chat message to the selected AI provider"""
    logger.debug("Chat endpoint called")
    try:
        data = request.json
        logger.debug(f"Received data: {data}")

        # Validate required fields
        if not data:
            logger.error("No JSON data received")
            return jsonify({"error": "No data provided"}), 400

        provider_id = data.get('provider', 'openai')
        model_id = data.get('model')
        messages = data.get('messages', [])
        chat_id = data.get('chat_id')
        content = data.get('content')

        logger.debug(f"Processing chat request: provider={provider_id}, model={model_id}, chat_id={chat_id}")

        provider = get_provider(provider_id)
        if not provider:
            logger.error(f"Provider {provider_id} not found")
            return jsonify({"error": f"Provider {provider_id} not found"}), 404

        # Get existing chat or create a new one
        if chat_id:
            # Handle temporary chat IDs that start with "new-"
            if chat_id.startswith('new-'):
                logger.debug(f"Creating new chat from temporary ID: {chat_id}")
                chat = Chat(
                    chat_id=str(uuid.uuid4()),  # Generate a proper UUID
                    provider=provider_id,
                    model=model_id,
                    system_prompt=data.get('system_prompt')
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
                system_prompt=data.get('system_prompt')
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
        response = provider.chat_completion(
            model=model_id or chat.model,
            messages=api_messages,
            temperature=data.get('temperature', 0.7),
            max_tokens=data.get('max_tokens')
        )

        # Check if there was an error
        if 'error' in response:
            logger.error(f"Provider API error: {response['error']}")
            return jsonify(response), 500

        # Extract the assistant response
        assistant_response = response.get('choices', [{}])[0].get('message', {}).get('content', '')
        logger.debug(f"Received assistant response: {assistant_response[:30]}...")

        # Add the assistant response to the chat
        chat.add_message("assistant", assistant_response)

        # Save the chat
        chat_store.save_chat(chat)

        # Return the response with the chat_id
        return jsonify({
            "chat_id": chat.chat_id,
            "assistant_response": assistant_response,
            "full_response": response
        })

    except Exception as e:
        logger.error(f"Error in chat completion: {str(e)}", exc_info=True)
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@api_routes.route('/chat/rag', methods=['POST'])
def rag_chat():
    """Send a RAG-enhanced chat message to the selected AI provider"""
    logger.debug("RAG Chat endpoint called")
    try:
        data = request.json
        logger.debug(f"Received RAG data: {data}")

        # Validate required fields
        if not data:
            logger.error("No JSON data received in RAG request")
            return jsonify({"error": "No data provided"}), 400

        provider_id = data.get('provider', 'openai')
        model_id = data.get('model')
        chat_id = data.get('chat_id')
        query = data.get('content', '')
        document_ids = data.get('document_ids', [])

        logger.debug(f"Processing RAG chat request: provider={provider_id}, model={model_id}, chat_id={chat_id}, docs={len(document_ids)}")

        provider = get_provider(provider_id)
        if not provider:
            logger.error(f"Provider {provider_id} not found")
            return jsonify({"error": f"Provider {provider_id} not found"}), 404

        # Get existing chat or create a new one
        if chat_id:
            # Handle temporary chat IDs that start with "new-"
            if chat_id.startswith('new-'):
                logger.debug(f"Creating new RAG chat from temporary ID: {chat_id}")
                chat = Chat(
                    chat_id=str(uuid.uuid4()),  # Generate a proper UUID
                    provider=provider_id,
                    model=model_id,
                    system_prompt=data.get('system_prompt')
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
                system_prompt=data.get('system_prompt')
            )

        # If this is the first message in a new chat, add system message if provided
        if not chat.messages and data.get('system_prompt'):
            logger.debug(f"Adding system prompt to RAG chat: {data.get('system_prompt')[:30]}...")
            chat.add_message("system", data.get('system_prompt'))

        # Add the user message to the chat
        if query:
            logger.debug(f"Adding user message to RAG chat: {query[:30]}...")
            chat.add_message("user", query)

        # Search for relevant documents
        search_results = document_processor.search_documents(query, top_k=3, doc_ids=document_ids)

        # Create context from search results
        context = ""
        for i, chunk in enumerate(search_results):
            doc_id = chunk.get('doc_id')
            metadata = document_processor.get_document_metadata(doc_id)
            filename = metadata.get('filename', 'Unknown document') if metadata else 'Unknown document'

            context += f"\n\nDocument {i+1} ({filename}):\n{chunk.get('content', '')}"

        # Prepare messages for the API call with context injection
        api_messages = []

        # Add system prompt if exists
        system_messages = [msg for msg in chat.messages if msg.role == "system"]
        if system_messages:
            api_messages.append({
                "role": "system",
                "content": system_messages[0].content
            })

        # Add regular messages (excluding the last user message)
        regular_messages = [
            msg for msg in chat.messages
            if msg.role != "system" and not (msg.role == "user" and msg == chat.messages[-1])
        ]

        for message in regular_messages:
            api_messages.append({
                "role": message.role,
                "content": message.content
            })

        # Add the user query with context
        if context:
            enhanced_query = (
                f"Question: {query}\n\n"
                f"Please use the following information to answer the question:\n{context}\n\n"
                f"Answer the question based on the provided information. If the information is not "
                f"sufficient, say so and provide a general response."
            )
        else:
            enhanced_query = query

        api_messages.append({
            "role": "user",
            "content": enhanced_query
        })

        # Call the provider API
        logger.debug(f"Calling provider API for RAG: {provider_id}")
        response = provider.chat_completion(
            model=model_id or chat.model,
            messages=api_messages,
            temperature=data.get('temperature', 0.7),
            max_tokens=data.get('max_tokens')
        )

        # Check if there was an error
        if 'error' in response:
            logger.error(f"Provider API error in RAG: {response['error']}")
            return jsonify(response), 500

        # Extract the assistant response
        assistant_response = response.get('choices', [{}])[0].get('message', {}).get('content', '')
        logger.debug(f"Received RAG assistant response: {assistant_response[:30]}...")

        # Add the assistant response to the chat
        chat.add_message("assistant", assistant_response)

        # Save the chat
        chat_store.save_chat(chat)

        # Return the response with the chat_id and context information
        return jsonify({
            "chat_id": chat.chat_id,
            "assistant_response": assistant_response,
            "context_used": bool(context),
            "documents_used": len(search_results),
            "full_response": response
        })

    except Exception as e:
        logger.error(f"Error in RAG chat completion: {str(e)}", exc_info=True)
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Server error in RAG: {str(e)}"}), 500

@api_routes.route('/documents/upload', methods=['POST'])
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

    try:
        # Secure the filename
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)

        # Save the file
        file.save(file_path)

        # Read the file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Process the document
        doc_id = document_processor.process_document(content, filename)

        # Get document metadata
        metadata = document_processor.get_document_metadata(doc_id)

        return jsonify({
            "doc_id": doc_id,
            "filename": filename,
            "metadata": metadata
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_routes.route('/documents', methods=['GET'])
def list_documents():
    """Get a list of all documents"""
    documents = document_processor.list_documents()
    return jsonify(documents)

@api_routes.route('/documents/<doc_id>', methods=['GET'])
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
def delete_document(doc_id):
    """Delete a document by ID"""
    success = document_processor.delete_document(doc_id)
    if not success:
        return jsonify({"error": f"Failed to delete document {doc_id}"}), 500

    return jsonify({"success": True})

@api_routes.route('/chats', methods=['GET'])
def list_chats():
    """Get a list of all chats"""
    chats = chat_store.list_chats()
    return jsonify(chats)

@api_routes.route('/chats/<chat_id>', methods=['GET'])
def get_chat(chat_id):
    """Get a specific chat by ID"""
    chat = chat_store.get_chat(chat_id)
    if not chat:
        return jsonify({"error": f"Chat {chat_id} not found"}), 404

    return jsonify(chat.to_dict())

@api_routes.route('/chats/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    """Delete a chat by ID"""
    success = chat_store.delete_chat(chat_id)
    if not success:
        return jsonify({"error": f"Failed to delete chat {chat_id}"}), 500

    return jsonify({"success": True})

@api_routes.route('/chats/<chat_id>/title', methods=['PUT'])
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

    return jsonify({"success": True})

@api_routes.route('/personas', methods=['GET'])
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