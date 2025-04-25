import os
import json
import logging
from typing import List, Optional, Dict, Any
from models.chat import Chat

logger = logging.getLogger(__name__)

class ChatStore:
    """
    Store for managing chat conversations
    """
    
    def __init__(self, data_dir: str = "data/chats"):
        """
        Initialize the chat store
        
        Args:
            data_dir: Directory to store chat data
        """
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
    
    def save_chat(self, chat: Chat) -> str:
        """
        Save a chat to the store
        
        Args:
            chat: The Chat object to save
            
        Returns:
            The chat ID
        """
        try:
            # Ensure the chat has an ID
            if not chat.chat_id:
                chat.chat_id = chat.chat_id
            
            # Create the file path
            file_path = os.path.join(self.data_dir, f"{chat.chat_id}.json")
            
            # Write the chat to file
            with open(file_path, 'w') as f:
                f.write(chat.to_json())
            
            return chat.chat_id
        
        except Exception as e:
            logger.error(f"Error saving chat: {e}")
            raise
    
    def get_chat(self, chat_id: str) -> Optional[Chat]:
        """
        Retrieve a chat by ID
        
        Args:
            chat_id: The ID of the chat to retrieve
            
        Returns:
            The Chat object if found, None otherwise
        """
        try:
            file_path = os.path.join(self.data_dir, f"{chat_id}.json")
            
            if not os.path.exists(file_path):
                return None
            
            with open(file_path, 'r') as f:
                chat_json = f.read()
            
            return Chat.from_json(chat_json)
        
        except Exception as e:
            logger.error(f"Error retrieving chat {chat_id}: {e}")
            return None
    
    def list_chats(self) -> List[Dict[str, Any]]:
        """
        List all chats in the store
        
        Returns:
            List of chat metadata (id, title, updated_at)
        """
        try:
            chats = []
            
            for filename in os.listdir(self.data_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(self.data_dir, filename)
                    try:
                        with open(file_path, 'r') as f:
                            data = json.load(f)
                        
                        chats.append({
                            "chat_id": data.get("chat_id"),
                            "title": data.get("title"),
                            "updated_at": data.get("updated_at"),
                            "provider": data.get("provider"),
                            "model": data.get("model")
                        })
                    except Exception as e:
                        logger.error(f"Error reading chat file {filename}: {e}")
            
            # Sort chats by updated_at in descending order
            chats.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            
            return chats
        
        except Exception as e:
            logger.error(f"Error listing chats: {e}")
            return []
    
    def delete_chat(self, chat_id: str) -> bool:
        """
        Delete a chat by ID
        
        Args:
            chat_id: The ID of the chat to delete
            
        Returns:
            True if the chat was deleted, False otherwise
        """
        try:
            file_path = os.path.join(self.data_dir, f"{chat_id}.json")
            
            if not os.path.exists(file_path):
                return False
            
            os.remove(file_path)
            return True
        
        except Exception as e:
            logger.error(f"Error deleting chat {chat_id}: {e}")
            return False
    
    def update_chat(self, chat: Chat) -> bool:
        """
        Update an existing chat
        
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
            
            with open(file_path, 'w') as f:
                f.write(chat.to_json())
            
            return True
        
        except Exception as e:
            logger.error(f"Error updating chat {chat.chat_id}: {e}")
            return False 