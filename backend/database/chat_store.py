import os
import json
import logging
import time
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from models.chat import Chat

logger = logging.getLogger(__name__)

class ChatStore:
    """
    Store for managing chat conversations with memory caching
    """

    def __init__(self, data_dir: str = "data/chats", cache_ttl: int = 300, cache_size: int = 100):
        """
        Initialize the chat store

        Args:
            data_dir: Directory to store chat data
            cache_ttl: Time to live for cached chats in seconds (default: 5 minutes)
            cache_size: Maximum number of chats to keep in memory cache
        """
        self.data_dir = data_dir
        self.cache_ttl = cache_ttl
        self.cache_size = cache_size

        # Create cache structure: {chat_id: (chat_object, timestamp)}
        self.cache: Dict[str, Tuple[Chat, float]] = {}

        # Track metadata for all chats to avoid file reads on list_chats
        self.metadata_cache: Dict[str, Dict[str, Any]] = {}
        self.metadata_last_refresh = 0
        self.metadata_refresh_interval = 60  # Refresh every 60 seconds

        # Ensure directory exists
        os.makedirs(data_dir, exist_ok=True)

        # Initialize metadata cache
        self._refresh_metadata_cache()

    def _refresh_metadata_cache(self) -> None:
        """Refresh the metadata cache from disk"""
        now = time.time()

        # Only refresh if enough time has passed since last refresh
        if now - self.metadata_last_refresh < self.metadata_refresh_interval:
            return

        try:
            self.metadata_cache = {}

            for filename in os.listdir(self.data_dir):
                if not filename.endswith('.json'):
                    continue
                    
                chat_id = filename[:-5]  # Remove .json extension
                file_path = os.path.join(self.data_dir, filename)

                # Skip empty files
                if os.path.getsize(file_path) == 0:
                    logger.warning(f"Skipping empty chat file: {filename}")
                    continue

                try:
                    with open(file_path, 'r') as f:
                        content = f.read().strip()
                        if not content:  # Skip if file is empty after stripping whitespace
                            logger.warning(f"Skipping empty chat file after stripping: {filename}")
                            continue
                            
                        try:
                            data = json.loads(content)
                        except json.JSONDecodeError as e:
                            logger.error(f"Invalid JSON in chat file {filename}: {e}")
                            continue

                        # Validate required fields
                        if not isinstance(data, dict):
                            logger.error(f"Chat file {filename} does not contain a JSON object")
                            continue

                        # Extract metadata with safe defaults
                        self.metadata_cache[chat_id] = {
                            "chat_id": data.get("chat_id", chat_id),
                            "title": data.get("title", "Untitled Chat"),
                            "updated_at": data.get("updated_at", datetime.now().isoformat()),
                            "provider": data.get("provider", "unknown"),
                            "model": data.get("model", "unknown"),
                            "message_count": len(data.get("messages", [])),
                            "last_message": self._get_last_message_preview(data.get("messages", []))
                        }
                except Exception as e:
                    logger.error(f"Error reading chat file {filename}: {e}")
                    continue

            self.metadata_last_refresh = now
            logger.debug(f"Refreshed metadata cache with {len(self.metadata_cache)} chats")

        except Exception as e:
            logger.error(f"Error refreshing metadata cache: {e}")

    def _get_last_message_preview(self, messages: List[Dict[str, Any]], max_length: int = 100) -> Optional[str]:
        """Extract a preview of the last message content"""
        if not messages:
            return None

        # Get the last message that has content (skip system messages if possible)
        for msg in reversed(messages):
            if msg.get("role") != "system" and msg.get("content"):
                content = msg.get("content", "")
                if len(content) > max_length:
                    return content[:max_length] + "..."
                return content

        return None

    def _cache_cleanup(self) -> None:
        """Remove expired items from cache"""
        now = time.time()
        expired_keys = [
            k for k, (_, timestamp) in self.cache.items()
            if now - timestamp > self.cache_ttl
        ]

        for key in expired_keys:
            del self.cache[key]

        # If cache is still too large, remove oldest entries
        if len(self.cache) > self.cache_size:
            # Sort by timestamp (oldest first)
            sorted_items = sorted(self.cache.items(), key=lambda x: x[1][1])
            # Keep only the newest cache_size items
            keys_to_remove = [k for k, _ in sorted_items[:-self.cache_size]]
            for key in keys_to_remove:
                del self.cache[key]

    def save_chat(self, chat: Chat) -> str:
        """
        Save a chat to the store and update cache

        Args:
            chat: The Chat object to save

        Returns:
            The chat ID
        """
        try:
            # Ensure the chat has updated timestamp - use a datetime object
            chat.updated_at = datetime.now()

            # Create the file path
            file_path = os.path.join(self.data_dir, f"{chat.chat_id}.json")

            # Write the chat to file
            with open(file_path, 'w') as f:
                f.write(chat.to_json())

            # Update cache
            self.cache[chat.chat_id] = (chat, time.time())

            # Update metadata cache
            chat_dict = chat.to_dict()
            self.metadata_cache[chat.chat_id] = {
                "chat_id": chat.chat_id,
                "title": chat.title,
                "updated_at": chat_dict["updated_at"],  # Get the ISO formatted string
                "provider": chat.provider,
                "model": chat.model,
                "message_count": len(chat.messages),
                "last_message": self._get_last_message_preview([m.to_dict() for m in chat.messages])
            }

            return chat.chat_id

        except Exception as e:
            logger.error(f"Error saving chat: {e}")
            raise

    def get_chat(self, chat_id: str) -> Optional[Chat]:
        """
        Retrieve a chat by ID with memory caching

        Args:
            chat_id: The ID of the chat to retrieve

        Returns:
            The Chat object if found, None otherwise
        """
        # Clean up cache periodically
        self._cache_cleanup()

        try:
            # Check if chat is in cache
            if chat_id in self.cache:
                logger.debug(f"Cache hit for chat {chat_id}")
                chat, timestamp = self.cache[chat_id]

                # Update timestamp to keep it fresh
                self.cache[chat_id] = (chat, time.time())

                return chat

            logger.debug(f"Cache miss for chat {chat_id}")
            file_path = os.path.join(self.data_dir, f"{chat_id}.json")

            if not os.path.exists(file_path):
                return None

            # Skip empty files
            if os.path.getsize(file_path) == 0:
                logger.warning(f"Chat file {chat_id}.json is empty")
                return None

            # Load chat from disk
            try:
                with open(file_path, 'r') as f:
                    content = f.read().strip()
                    if not content:
                        logger.warning(f"Chat file {chat_id}.json is empty after stripping")
                        return None

                    try:
                        chat_json = content
                        chat = Chat.from_json(chat_json)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in chat file {chat_id}.json: {e}")
                        return None
                    except Exception as e:
                        logger.error(f"Error parsing chat {chat_id}: {e}")
                        return None

                # Add to cache with current timestamp
                self.cache[chat_id] = (chat, time.time())

                return chat

            except Exception as e:
                logger.error(f"Error reading chat file {chat_id}.json: {e}")
                return None

        except Exception as e:
            logger.error(f"Error retrieving chat {chat_id}: {e}")
            return None

    def list_chats(self) -> List[Dict[str, Any]]:
        """
        List all chats in the store using the metadata cache

        Returns:
            List of chat metadata (id, title, updated_at, etc.)
        """
        # Refresh metadata cache if needed
        self._refresh_metadata_cache()

        try:
            # Convert dictionary values to list and sort by updated_at
            chats = list(self.metadata_cache.values())
            chats.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

            return chats

        except Exception as e:
            logger.error(f"Error listing chats: {e}")
            return []

    def delete_chat(self, chat_id: str) -> bool:
        """
        Delete a chat by ID and remove from cache

        Args:
            chat_id: The ID of the chat to delete

        Returns:
            True if the chat was deleted, False otherwise
        """
        try:
            file_path = os.path.join(self.data_dir, f"{chat_id}.json")

            if not os.path.exists(file_path):
                return False

            # Remove from file system
            os.remove(file_path)

            # Remove from cache
            if chat_id in self.cache:
                del self.cache[chat_id]

            # Remove from metadata cache
            if chat_id in self.metadata_cache:
                del self.metadata_cache[chat_id]

            return True

        except Exception as e:
            logger.error(f"Error deleting chat {chat_id}: {e}")
            return False

    def update_chat(self, chat: Chat) -> bool:
        """
        Update an existing chat and refresh cache

        Args:
            chat: The Chat object to update

        Returns:
            True if the chat was updated, False otherwise
        """
        try:
            if not chat.chat_id:
                return False

            file_path = os.path.join(self.data_dir, f"{chat.chat_id}.json")

            if not os.path.exists(file_path):
                return False

            # Update timestamp - use a datetime object
            chat.updated_at = datetime.now()

            # Write to file
            with open(file_path, 'w') as f:
                f.write(chat.to_json())

            # Update cache
            self.cache[chat.chat_id] = (chat, time.time())

            # Update metadata cache
            chat_dict = chat.to_dict()
            self.metadata_cache[chat.chat_id] = {
                "chat_id": chat.chat_id,
                "title": chat.title,
                "updated_at": chat_dict["updated_at"],  # Get the ISO formatted string
                "provider": chat.provider,
                "model": chat.model,
                "message_count": len(chat.messages),
                "last_message": self._get_last_message_preview([m.to_dict() for m in chat.messages])
            }

            return True

        except Exception as e:
            logger.error(f"Error updating chat {chat.chat_id}: {e}")
            return False

    def get_chat_count(self) -> int:
        """
        Get the total number of chats

        Returns:
            Total number of chats
        """
        self._refresh_metadata_cache()
        return len(self.metadata_cache)

    def clear_cache(self) -> None:
        """Clear the entire memory cache - useful for testing"""
        self.cache = {}
        self.metadata_cache = {}
        self.metadata_last_refresh = 0