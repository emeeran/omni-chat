import os
import logging
import json
import hashlib
import time
import re
import threading
from typing import List, Dict, Any, Optional, Tuple, Set, Union
import numpy as np
from collections import defaultdict
import multiprocessing
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Utility class for processing and storing documents for RAG with optimized search
    """

    def __init__(self, data_dir: str = "data/documents", cache_ttl: int = 300, cache_size: int = 100):
        """
        Initialize the document processor with caching and vector embeddings

        Args:
            data_dir: Directory to store document data
            cache_ttl: Time to live for cached documents in seconds
            cache_size: Maximum number of documents to keep in memory cache
        """
        self.data_dir = data_dir
        self.chunks_dir = os.path.join(data_dir, "chunks")
        self.metadata_dir = os.path.join(data_dir, "metadata")
        self.embeddings_dir = os.path.join(data_dir, "embeddings")

        # Create cache structures
        self.cache_ttl = cache_ttl
        self.cache_size = cache_size
        self.chunks_cache: Dict[str, Tuple[List[Dict[str, Any]], float]] = {}  # {doc_id: (chunks_list, timestamp)}
        self.metadata_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}  # {doc_id: (metadata_dict, timestamp)}

        # Thread safety for cache operations
        self.cache_lock = threading.RLock()

        # Improved inverted index for faster keyword search
        self.inverted_index: Dict[str, Dict[str, float]] = {}  # {term: {chunk_id: score}}
        self.index_last_refresh = 0
        self.index_refresh_interval = 600  # 10 minutes
        self.index_lock = threading.RLock()

        # Stop words to exclude from indexing
        self.stop_words = {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was',
            'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old',
            'see', 'two', 'way', 'who', 'did', 'its', 'let', 'say', 'she', 'too', 'use', 'that', 'with',
            'from', 'this', 'what', 'when', 'have', 'they', 'will', 'been', 'much', 'some', 'then', 'than',
            'very', 'just', 'into', 'like', 'more', 'over', 'only', 'such', 'take', 'time', 'upon', 'well',
            'were', 'your'
        }

        # Document frequency for terms (for TF-IDF)
        self.doc_frequencies: Dict[str, int] = {}
        self.total_documents = 0

        # Parallel processing config
        self.max_workers = min(multiprocessing.cpu_count(), 4)  # Don't use more than 4 cores

        # Ensure directories exist
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.chunks_dir, exist_ok=True)
        os.makedirs(self.metadata_dir, exist_ok=True)
        os.makedirs(self.embeddings_dir, exist_ok=True)

        # Load existing document count for TF-IDF calculations
        self._load_document_stats()

        # Lazily refresh index if needed
        threading.Thread(target=self._refresh_inverted_index, daemon=True).start()

    def _load_document_stats(self) -> None:
        """Load document statistics for TF-IDF calculations"""
        try:
            stats_path = os.path.join(self.data_dir, "stats.json")
            if os.path.exists(stats_path):
                with open(stats_path, 'r') as f:
                    stats = json.load(f)
                    self.doc_frequencies = stats.get("doc_frequencies", {})
                    self.total_documents = stats.get("total_documents", 0)
        except Exception as e:
            logger.error(f"Error loading document stats: {e}")
            self.doc_frequencies = {}
            self.total_documents = 0

    def _save_document_stats(self) -> None:
        """Save document statistics for TF-IDF calculations"""
        try:
            stats_path = os.path.join(self.data_dir, "stats.json")
            stats = {
                "doc_frequencies": self.doc_frequencies,
                "total_documents": self.total_documents
            }
            with open(stats_path, 'w') as f:
                json.dump(stats, f)
        except Exception as e:
            logger.error(f"Error saving document stats: {e}")

    def _refresh_inverted_index(self) -> None:
        """Build or refresh the inverted index for faster search using TF-IDF"""
        now = time.time()

        # Return if another thread is already building the index
        with self.index_lock:
            # Only refresh if enough time has passed
            if now - self.index_last_refresh < self.index_refresh_interval:
                return

            logger.info("Refreshing document inverted index...")
            start_time = time.time()

            # Clear the current index and rebuild document frequencies
            self.inverted_index = defaultdict(dict)
            self.doc_frequencies = defaultdict(int)
            self.total_documents = 0

            # Process all document metadata first to calculate IDF
            doc_term_counts = defaultdict(set)  # {doc_id: {terms}}
            chunk_terms = {}  # {chunk_id: {term: freq}}

            # Get all metadata files for document count
            metadata_files = [f for f in os.listdir(self.metadata_dir) if f.endswith('.json')]
            self.total_documents = len(metadata_files)

            # Process chunks in parallel for better performance
            chunk_files = [f for f in os.listdir(self.chunks_dir) if f.endswith('.json')]

            # Use threads for I/O bound operations
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Map chunk files to future processing tasks
                future_to_chunk = {
                    executor.submit(self._process_chunk_for_index, os.path.join(self.chunks_dir, filename)): filename
                    for filename in chunk_files
                }

                # Process results as they complete
                for future in as_completed(future_to_chunk):
                    try:
                        chunk_id, doc_id, terms_freq = future.result()
                        if chunk_id and doc_id and terms_freq:
                            # Store chunk term frequencies
                            chunk_terms[chunk_id] = terms_freq

                            # Update document term set for document frequency calculation
                            doc_term_counts[doc_id].update(terms_freq.keys())
                    except Exception as e:
                        logger.error(f"Error processing chunk for index: {e}")

            # Calculate document frequencies
            for doc_id, terms in doc_term_counts.items():
                for term in terms:
                    self.doc_frequencies[term] += 1

            # Calculate TF-IDF scores and build the inverted index
            for chunk_id, terms_freq in chunk_terms.items():
                doc_id = chunk_id.split('_')[0]

                for term, freq in terms_freq.items():
                    if term in self.doc_frequencies and self.doc_frequencies[term] > 0:
                        # TF * IDF score
                        tf = freq
                        idf = np.log(self.total_documents / self.doc_frequencies[term] + 1)
                        score = tf * idf

                        # Add to inverted index with TF-IDF score
                        self.inverted_index[term][chunk_id] = score

            # Save stats for future use
            self._save_document_stats()

            self.index_last_refresh = now
            logger.info(f"Index refresh completed in {time.time() - start_time:.2f}s with {len(self.inverted_index)} terms")

    def _process_chunk_for_index(self, chunk_path: str) -> Tuple[Optional[str], Optional[str], Dict[str, float]]:
        """Process a single chunk file for the inverted index, returns (chunk_id, doc_id, {term: frequency})"""
        try:
            with open(chunk_path, 'r') as f:
                chunk = json.load(f)

            doc_id = chunk.get('doc_id')
            chunk_num = chunk.get('chunk_id')
            chunk_id = f"{doc_id}_{chunk_num}"
            content = chunk.get('content', '').lower()

            # Extract terms and calculate frequencies
            term_freqs = {}

            # Tokenize content
            words = re.findall(r'\w+', content)
            total_words = len(words)

            if total_words == 0:
                return chunk_id, doc_id, {}

            # Count term frequencies
            for word in words:
                if len(word) >= 3 and word not in self.stop_words:
                    if word not in term_freqs:
                        term_freqs[word] = 0
                    term_freqs[word] += 1

            # Normalize term frequencies by document length
            for term in term_freqs:
                term_freqs[term] = term_freqs[term] / total_words

            return chunk_id, doc_id, term_freqs

        except Exception as e:
            logger.error(f"Error processing {chunk_path} for index: {e}")
            return None, None, {}

    def _cache_cleanup(self) -> None:
        """Remove expired items from cache"""
        with self.cache_lock:
            now = time.time()

            # Clean metadata cache
            expired_keys = [
                k for k, (_, timestamp) in self.metadata_cache.items()
                if now - timestamp > self.cache_ttl
            ]
            for key in expired_keys:
                del self.metadata_cache[key]

            # Clean chunks cache
            expired_keys = [
                k for k, (_, timestamp) in self.chunks_cache.items()
                if now - timestamp > self.cache_ttl
            ]
            for key in expired_keys:
                del self.chunks_cache[key]

            # If caches are still too large, remove oldest entries
            if len(self.metadata_cache) > self.cache_size:
                sorted_items = sorted(self.metadata_cache.items(), key=lambda x: x[1][1])
                keys_to_remove = [k for k, _ in sorted_items[:-self.cache_size]]
                for key in keys_to_remove:
                    del self.metadata_cache[key]

            if len(self.chunks_cache) > self.cache_size:
                sorted_items = sorted(self.chunks_cache.items(), key=lambda x: x[1][1])
                keys_to_remove = [k for k, _ in sorted_items[:-self.cache_size]]
                for key in keys_to_remove:
                    del self.chunks_cache[key]

    def process_document(
        self,
        content: str,
        filename: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        smart_chunking: bool = True
    ) -> str:
        """
        Process a document by chunking it and storing the chunks

        Args:
            content: The document content as text
            filename: Original filename or identifier
            chunk_size: Size of each chunk in characters
            chunk_overlap: Overlap between chunks in characters
            smart_chunking: Use paragraph and sentence-aware chunking

        Returns:
            The document ID
        """
        try:
            start_time = time.time()

            # Generate a document ID based on content hash
            doc_id = hashlib.md5(content.encode()).hexdigest()

            # Create document metadata
            metadata = {
                "doc_id": doc_id,
                "filename": filename,
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap,
                "smart_chunking": smart_chunking,
                "total_chunks": 0,
                "total_chars": len(content),
                "created_at": time.time(),
                "processing_time": 0,
                "file_type": os.path.splitext(filename)[1][1:] if '.' in filename else 'txt'
            }

            # Chunk the document
            chunks = self._smart_chunk_text(content, chunk_size, chunk_overlap) if smart_chunking else self._chunk_text(content, chunk_size, chunk_overlap)
            metadata["total_chunks"] = len(chunks)

            # Process chunks in parallel
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all chunk save tasks
                futures = []
                for i, chunk in enumerate(chunks):
                    futures.append(
                        executor.submit(
                            self._save_chunk,
                            doc_id,
                            i,
                            chunk,
                            i * (chunk_size - chunk_overlap) if i > 0 else 0,
                            filename
                        )
                    )

                # Wait for all tasks to complete
                for future in as_completed(futures):
                    # Handle any exceptions
                    try:
                        future.result()
                    except Exception as e:
                        logger.error(f"Error saving chunk: {e}")

            # Save metadata
            metadata_path = os.path.join(self.metadata_dir, f"{doc_id}.json")

            # Record processing time
            metadata["processing_time"] = time.time() - start_time

            with open(metadata_path, 'w') as f:
                json.dump(metadata, f)

            # Update cache
            with self.cache_lock:
                self.metadata_cache[doc_id] = (metadata, time.time())

            # Update document count for TF-IDF
            with self.index_lock:
                self.total_documents += 1
                self._save_document_stats()

            # Force index refresh on next search
            self.index_last_refresh = 0

            # Trigger index refresh in background
            threading.Thread(target=self._refresh_inverted_index, daemon=True).start()

            return doc_id

        except Exception as e:
            logger.error(f"Error processing document: {e}")
            raise

    def _save_chunk(self, doc_id: str, chunk_id: int, content: str, start_char: int, filename: str) -> None:
        """Save a single chunk to disk"""
        chunk_filename = f"{doc_id}_{chunk_id}.json"
        chunk_path = os.path.join(self.chunks_dir, chunk_filename)

        chunk_data = {
            "doc_id": doc_id,
            "chunk_id": chunk_id,
            "content": content,
            "start_char": start_char,
            "end_char": start_char + len(content),
            "filename": filename
        }

        with open(chunk_path, 'w') as f:
            json.dump(chunk_data, f)

    def get_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
        """
        Get all chunks for a document with caching

        Args:
            doc_id: The document ID

        Returns:
            List of chunks as dictionaries
        """
        # Check cache first
        self._cache_cleanup()

        with self.cache_lock:
            if doc_id in self.chunks_cache:
                chunks, _ = self.chunks_cache[doc_id]
                self.chunks_cache[doc_id] = (chunks, time.time())  # Update timestamp
                return chunks

        try:
            chunks = []
            chunk_prefix = f"{doc_id}_"

            # Get all matching chunk filenames first
            chunk_files = [
                f for f in os.listdir(self.chunks_dir)
                if f.startswith(chunk_prefix) and f.endswith(".json")
            ]

            # Load chunks in parallel for faster retrieval
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Map files to future loading tasks
                future_to_file = {
                    executor.submit(self._load_chunk_file, os.path.join(self.chunks_dir, filename)): filename
                    for filename in chunk_files
                }

                # Process results as they complete
                for future in as_completed(future_to_file):
                    try:
                        chunk = future.result()
                        if chunk:
                            chunks.append(chunk)
                    except Exception as e:
                        logger.error(f"Error loading chunk: {e}")

            # Sort chunks by chunk_id
            chunks.sort(key=lambda x: x.get("chunk_id", 0))

            # Add to cache
            with self.cache_lock:
                self.chunks_cache[doc_id] = (chunks, time.time())

            return chunks

        except Exception as e:
            logger.error(f"Error getting chunks for document {doc_id}: {e}")
            return []

    def _load_chunk_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Load a single chunk file"""
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading chunk file {file_path}: {e}")
            return None

    def get_document_metadata(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a document with caching

        Args:
            doc_id: The document ID

        Returns:
            Document metadata as a dictionary, or None if not found
        """
        # Check cache first
        self._cache_cleanup()

        with self.cache_lock:
            if doc_id in self.metadata_cache:
                metadata, _ = self.metadata_cache[doc_id]
                self.metadata_cache[doc_id] = (metadata, time.time())  # Update timestamp
                return metadata

        try:
            metadata_path = os.path.join(self.metadata_dir, f"{doc_id}.json")

            if not os.path.exists(metadata_path):
                return None

            with open(metadata_path, 'r') as f:
                metadata = json.load(f)

            # Add to cache
            with self.cache_lock:
                self.metadata_cache[doc_id] = (metadata, time.time())

            return metadata

        except Exception as e:
            logger.error(f"Error getting metadata for document {doc_id}: {e}")
            return None

    def get_chat_count(self) -> int:
        """Get number of documents for metrics"""
        try:
            return len(os.listdir(self.metadata_dir))
        except Exception:
            return 0

    def list_documents(self) -> List[Dict[str, Any]]:
        """
        List all documents with their metadata

        Returns:
            List of document metadata dictionaries
        """
        try:
            # Get metadata filenames first to avoid holding the cache lock during file I/O
            metadata_files = [
                f for f in os.listdir(self.metadata_dir)
                if f.endswith('.json')
            ]

            documents = []

            # Check how many files we have and choose between parallel and sequential processing
            if len(metadata_files) > 10:
                # Use parallel processing for many files
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    # Map files to future loading tasks
                    future_to_file = {
                        executor.submit(self.get_document_metadata, f[:-5]): f  # Remove .json extension
                        for f in metadata_files
                    }

                    # Process results as they complete
                    for future in as_completed(future_to_file):
                        try:
                            metadata = future.result()
                            if metadata:
                                documents.append(metadata)
                        except Exception as e:
                            logger.error(f"Error loading document metadata: {e}")
            else:
                # Use sequential processing for few files
                for filename in metadata_files:
                    doc_id = filename[:-5]  # Remove .json extension
                    metadata = self.get_document_metadata(doc_id)
                    if metadata:
                        documents.append(metadata)

            # Sort by creation time (newest first)
            documents.sort(key=lambda x: x.get("created_at", 0), reverse=True)

            return documents

        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []

    def search_documents(
        self,
        query: str,
        top_k: int = 3,
        doc_ids: Optional[List[str]] = None,
        min_score: float = 0.05  # Minimum relevance score threshold
    ) -> List[Dict[str, Any]]:
        """
        Enhanced search using TF-IDF scoring and query expansion

        Args:
            query: The search query
            top_k: Number of top results to return
            doc_ids: Optional list of document IDs to search in
            min_score: Minimum relevance score threshold

        Returns:
            List of dictionaries with matching chunks
        """
        start_time = time.time()

        try:
            # Refresh index if needed (non-blocking)
            threading.Thread(target=self._refresh_inverted_index, daemon=True).start()

            # Normalize and expand query for search
            query_terms = self._process_query(query)

            if not query_terms:
                return []

            # Track scores and query term matches in chunks
            chunk_scores: Dict[str, float] = {}
            chunk_matches: Dict[str, Set[str]] = {}  # Track which terms match which chunks for relevance

            # Use the inverted index to quickly score all chunks
            with self.index_lock:
                for term, term_weight in query_terms.items():
                    if term in self.inverted_index:
                        for chunk_id, score in self.inverted_index[term].items():
                            # Only include chunks from specified documents if doc_ids is provided
                            if doc_ids:
                                chunk_doc_id = chunk_id.split('_')[0]
                                if chunk_doc_id not in doc_ids:
                                    continue

                            if chunk_id not in chunk_scores:
                                chunk_scores[chunk_id] = 0
                                chunk_matches[chunk_id] = set()

                            # Add weighted term score to chunk score
                            chunk_scores[chunk_id] += score * term_weight
                            chunk_matches[chunk_id].add(term)

            # Boost scores for chunks that match multiple query terms
            for chunk_id in chunk_scores:
                # Calculate percentage of query terms matched
                match_percentage = len(chunk_matches[chunk_id]) / len(query_terms)
                # Apply a boost factor based on coverage
                chunk_scores[chunk_id] *= (1.0 + match_percentage)

            # Filter out low-scoring chunks
            qualified_chunks = {
                chunk_id: score for chunk_id, score in chunk_scores.items()
                if score >= min_score
            }

            # Sort chunks by score
            sorted_chunks = sorted(qualified_chunks.items(), key=lambda x: x[1], reverse=True)

            # Get top_k chunks
            top_chunk_ids = [chunk_id for chunk_id, _ in sorted_chunks[:top_k]]

            results = []

            # Load chunks in parallel for faster retrieval
            if top_chunk_ids:
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    # Map chunks to future loading tasks
                    future_to_chunk = {
                        executor.submit(self._load_chunk_with_score, chunk_id, chunk_scores[chunk_id]): chunk_id
                        for chunk_id in top_chunk_ids
                    }

                    # Process results as they complete
                    for future in as_completed(future_to_chunk):
                        try:
                            chunk = future.result()
                            if chunk:
                                results.append(chunk)
                        except Exception as e:
                            logger.error(f"Error loading chunk during search: {e}")

            # Sort final results by score
            results.sort(key=lambda x: x.get("score", 0), reverse=True)

            logger.debug(f"Search completed in {time.time() - start_time:.3f}s, found {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []

    def _load_chunk_with_score(self, chunk_id: str, score: float) -> Optional[Dict[str, Any]]:
        """Load a chunk and add its relevance score"""
        try:
            chunk_path = os.path.join(self.chunks_dir, f"{chunk_id}.json")

            if os.path.exists(chunk_path):
                with open(chunk_path, 'r') as f:
                    chunk = json.load(f)

                # Add the relevance score
                chunk["score"] = score
                return chunk
            return None
        except Exception as e:
            logger.error(f"Error loading chunk with score: {e}")
            return None

    def _process_query(self, query: str) -> Dict[str, float]:
        """
        Process a query string into a weighted term dictionary with query expansion
        Returns: {term: weight}
        """
        # Normalize and tokenize query
        query = query.lower()
        words = re.findall(r'\w+', query)

        # Remove stop words and very short terms
        query_terms = {word: 1.0 for word in words if len(word) >= 3 and word not in self.stop_words}

        # TODO: Add query expansion in future versions
        # This would find synonyms and related terms to improve recall

        # Apply term weighting - terms that appear in the query multiple times get higher weights
        for word in words:
            if word in query_terms:
                query_terms[word] = 1.0 + (query.count(word) / len(words))

        return query_terms

    def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document and all its chunks

        Args:
            doc_id: The document ID

        Returns:
            True if the document was deleted, False otherwise
        """
        try:
            # Delete metadata
            metadata_path = os.path.join(self.metadata_dir, f"{doc_id}.json")
            if os.path.exists(metadata_path):
                os.remove(metadata_path)

            # Delete all chunks
            chunk_prefix = f"{doc_id}_"
            deleted_chunks = 0

            for filename in os.listdir(self.chunks_dir):
                if filename.startswith(chunk_prefix) and filename.endswith(".json"):
                    chunk_path = os.path.join(self.chunks_dir, filename)
                    os.remove(chunk_path)
                    deleted_chunks += 1

            # Remove from cache
            with self.cache_lock:
                if doc_id in self.metadata_cache:
                    del self.metadata_cache[doc_id]

                if doc_id in self.chunks_cache:
                    del self.chunks_cache[doc_id]

            # Update document count for TF-IDF
            with self.index_lock:
                if self.total_documents > 0:
                    self.total_documents -= 1

                # Update document stats
                self._save_document_stats()

            # Force index refresh on next search
            self.index_last_refresh = 0

            return deleted_chunks > 0

        except Exception as e:
            logger.error(f"Error deleting document {doc_id}: {e}")
            return False

    def _chunk_text(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """
        Split text into overlapping chunks

        Args:
            text: The text to chunk
            chunk_size: Maximum size of each chunk
            chunk_overlap: Overlap between chunks

        Returns:
            List of text chunks
        """
        if not text:
            return []

        # Get total length
        text_len = len(text)

        # Handle small documents
        if text_len <= chunk_size:
            return [text]

        chunks = []
        start = 0

        while start < text_len:
            # Get end position for this chunk
            end = min(start + chunk_size, text_len)

            # Add chunk
            chunks.append(text[start:end])

            # Move start position for next chunk, with overlap
            start = end - chunk_overlap if end < text_len else text_len

        return chunks

    def _smart_chunk_text(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """
        Split text into chunks with awareness of paragraphs and sentences

        Args:
            text: The text to chunk
            chunk_size: Maximum size of each chunk
            chunk_overlap: Overlap between chunks

        Returns:
            List of text chunks
        """
        if not text:
            return []

        # Get total length
        text_len = len(text)

        # Handle small documents
        if text_len <= chunk_size:
            return [text]

        # Split into paragraphs first
        paragraphs = re.split(r'\n\s*\n', text)

        # Handle paragraph boundaries for chunking
        chunks = []
        current_chunk = ""

        for paragraph in paragraphs:
            # Skip empty paragraphs
            if not paragraph.strip():
                continue

            # If adding this paragraph would exceed chunk size
            if len(current_chunk) + len(paragraph) > chunk_size:
                # If we already have content in the current chunk
                if current_chunk:
                    chunks.append(current_chunk)

                    # Handle large paragraphs that exceed chunk_size
                    if len(paragraph) > chunk_size:
                        # Split by sentences for large paragraphs
                        sentences = re.split(r'(?<=[.!?])\s+', paragraph)

                        current_chunk = ""
                        for sentence in sentences:
                            if len(current_chunk) + len(sentence) > chunk_size:
                                if current_chunk:
                                    chunks.append(current_chunk)
                                    # Start a new chunk with overlap
                                    overlap_text = current_chunk[-chunk_overlap:] if len(current_chunk) > chunk_overlap else current_chunk
                                    current_chunk = overlap_text + sentence
                                else:
                                    # If a single sentence is too long, fall back to character chunking
                                    if len(sentence) > chunk_size:
                                        sentence_chunks = self._chunk_text(sentence, chunk_size, chunk_overlap)
                                        chunks.extend(sentence_chunks[:-1])
                                        current_chunk = sentence_chunks[-1]
                                    else:
                                        current_chunk = sentence
                            else:
                                current_chunk += (" " if current_chunk else "") + sentence
                    else:
                        # Get overlap from previous chunk
                        overlap_text = current_chunk[-chunk_overlap:] if len(current_chunk) > chunk_overlap else current_chunk
                        current_chunk = overlap_text + paragraph
                else:
                    # If paragraph is larger than chunk_size and this is a new chunk
                    if len(paragraph) > chunk_size:
                        paragraph_chunks = self._chunk_text(paragraph, chunk_size, chunk_overlap)
                        chunks.extend(paragraph_chunks[:-1])
                        current_chunk = paragraph_chunks[-1]
                    else:
                        current_chunk = paragraph
            else:
                # Add paragraph to current chunk
                current_chunk += ("\n\n" if current_chunk else "") + paragraph

        # Don't forget the last chunk
        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def clear_cache(self) -> None:
        """Clear all caches - useful for testing and memory management"""
        with self.cache_lock:
            self.chunks_cache = {}
            self.metadata_cache = {}

        with self.index_lock:
            self.inverted_index = {}
            self.index_last_refresh = 0