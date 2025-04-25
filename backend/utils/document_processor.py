import os
import logging
import json
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import re

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Utility class for processing and storing documents for RAG
    """
    
    def __init__(self, data_dir: str = "data/documents"):
        """
        Initialize the document processor
        
        Args:
            data_dir: Directory to store document data
        """
        self.data_dir = data_dir
        self.chunks_dir = os.path.join(data_dir, "chunks")
        self.metadata_dir = os.path.join(data_dir, "metadata")
        
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.chunks_dir, exist_ok=True)
        os.makedirs(self.metadata_dir, exist_ok=True)
    
    def process_document(
        self, 
        content: str, 
        filename: str, 
        chunk_size: int = 1000, 
        chunk_overlap: int = 200
    ) -> str:
        """
        Process a document by chunking it and storing the chunks
        
        Args:
            content: The document content as text
            filename: Original filename or identifier
            chunk_size: Size of each chunk in characters
            chunk_overlap: Overlap between chunks in characters
            
        Returns:
            The document ID
        """
        try:
            # Generate a document ID based on content hash
            doc_id = hashlib.md5(content.encode()).hexdigest()
            
            # Create document metadata
            metadata = {
                "doc_id": doc_id,
                "filename": filename,
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap,
                "total_chunks": 0,
                "total_chars": len(content)
            }
            
            # Chunk the document
            chunks = self._chunk_text(content, chunk_size, chunk_overlap)
            metadata["total_chunks"] = len(chunks)
            
            # Save chunks
            for i, chunk in enumerate(chunks):
                chunk_filename = f"{doc_id}_{i}.json"
                chunk_path = os.path.join(self.chunks_dir, chunk_filename)
                
                chunk_data = {
                    "doc_id": doc_id,
                    "chunk_id": i,
                    "content": chunk,
                    "start_char": i * (chunk_size - chunk_overlap) if i > 0 else 0,
                    "end_char": i * (chunk_size - chunk_overlap) + len(chunk)
                }
                
                with open(chunk_path, 'w') as f:
                    json.dump(chunk_data, f)
            
            # Save metadata
            metadata_path = os.path.join(self.metadata_dir, f"{doc_id}.json")
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f)
            
            return doc_id
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            raise
    
    def get_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
        """
        Get all chunks for a document
        
        Args:
            doc_id: The document ID
            
        Returns:
            List of chunks as dictionaries
        """
        try:
            chunks = []
            chunk_prefix = f"{doc_id}_"
            
            for filename in os.listdir(self.chunks_dir):
                if filename.startswith(chunk_prefix) and filename.endswith(".json"):
                    chunk_path = os.path.join(self.chunks_dir, filename)
                    
                    with open(chunk_path, 'r') as f:
                        chunk = json.load(f)
                    
                    chunks.append(chunk)
            
            # Sort chunks by chunk_id
            chunks.sort(key=lambda x: x.get("chunk_id", 0))
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error getting chunks for document {doc_id}: {e}")
            return []
    
    def get_document_metadata(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a document
        
        Args:
            doc_id: The document ID
            
        Returns:
            Document metadata as a dictionary, or None if not found
        """
        try:
            metadata_path = os.path.join(self.metadata_dir, f"{doc_id}.json")
            
            if not os.path.exists(metadata_path):
                return None
            
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error getting metadata for document {doc_id}: {e}")
            return None
    
    def list_documents(self) -> List[Dict[str, Any]]:
        """
        List all documents with their metadata
        
        Returns:
            List of document metadata dictionaries
        """
        try:
            documents = []
            
            for filename in os.listdir(self.metadata_dir):
                if filename.endswith('.json'):
                    metadata_path = os.path.join(self.metadata_dir, filename)
                    
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    
                    documents.append(metadata)
            
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []
    
    def search_documents(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Simple keyword search across all document chunks
        
        Args:
            query: The search query
            top_k: Number of top results to return
            
        Returns:
            List of dictionaries with matching chunks
        """
        try:
            # Normalize query for simple search
            query_terms = re.findall(r'\w+', query.lower())
            if not query_terms:
                return []
            
            # Score all chunks
            results = []
            
            for filename in os.listdir(self.chunks_dir):
                if filename.endswith('.json'):
                    chunk_path = os.path.join(self.chunks_dir, filename)
                    
                    with open(chunk_path, 'r') as f:
                        chunk = json.load(f)
                    
                    content_lower = chunk.get("content", "").lower()
                    score = 0
                    
                    # Simple term frequency scoring
                    for term in query_terms:
                        score += content_lower.count(term)
                    
                    if score > 0:
                        results.append({
                            "chunk": chunk,
                            "score": score
                        })
            
            # Sort by score and take top_k
            results.sort(key=lambda x: x["score"], reverse=True)
            top_results = results[:top_k]
            
            return [item["chunk"] for item in top_results]
            
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []
    
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