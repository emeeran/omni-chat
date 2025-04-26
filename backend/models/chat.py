import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Union

class Message:
    """
    Represents a single message in a chat conversation
    """
    def __init__(
        self,
        role: str,
        content: str,
        created_at: datetime = None,
        message_id: str = None
    ):
        self.message_id = message_id or str(uuid.uuid4())
        self.role = role
        self.content = content
        self.created_at = created_at or datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary"""
        return {
            "message_id": self.message_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        """Create a message from dictionary"""
        created_at = datetime.fromisoformat(data["created_at"]) if "created_at" in data else None
        return cls(
            role=data["role"],
            content=data["content"],
            created_at=created_at,
            message_id=data.get("message_id")
        )


class Chat:
    """
    Represents a chat conversation
    """
    def __init__(
        self,
        chat_id: str = None,
        title: str = None,
        messages: List[Message] = None,
        provider: str = "groq",
        model: str = None,
        system_prompt: str = None,
        created_at: Union[datetime, str] = None,
        updated_at: Union[datetime, str] = None
    ):
        self.chat_id = chat_id or str(uuid.uuid4())
        self.title = title or f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        self.messages = messages or []
        self.provider = provider
        self.model = model
        self.system_prompt = system_prompt

        # Handle both string and datetime for created_at
        if isinstance(created_at, str):
            self.created_at = created_at
        else:
            self.created_at = created_at or datetime.now()

        # Handle both string and datetime for updated_at
        if isinstance(updated_at, str):
            self.updated_at = updated_at
        else:
            self.updated_at = updated_at or datetime.now()

    def add_message(self, role: str, content: str) -> Message:
        """Add a new message to the chat"""
        message = Message(role=role, content=content)
        self.messages.append(message)
        self.updated_at = datetime.now()
        return message

    def to_dict(self) -> Dict[str, Any]:
        """Convert chat to dictionary"""
        # Ensure created_at is in ISO format string
        if isinstance(self.created_at, datetime):
            created_at_iso = self.created_at.isoformat()
        else:
            created_at_iso = self.created_at

        # Ensure updated_at is in ISO format string
        if isinstance(self.updated_at, datetime):
            updated_at_iso = self.updated_at.isoformat()
        else:
            updated_at_iso = self.updated_at

        return {
            "chat_id": self.chat_id,
            "title": self.title,
            "messages": [message.to_dict() for message in self.messages],
            "provider": self.provider,
            "model": self.model,
            "system_prompt": self.system_prompt,
            "created_at": created_at_iso,
            "updated_at": updated_at_iso
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Chat':
        """Create a chat from dictionary"""
        messages = [Message.from_dict(msg) for msg in data.get("messages", [])]
        created_at = data.get("created_at")
        updated_at = data.get("updated_at")

        return cls(
            chat_id=data.get("chat_id"),
            title=data.get("title"),
            messages=messages,
            provider=data.get("provider"),
            model=data.get("model"),
            system_prompt=data.get("system_prompt"),
            created_at=created_at,
            updated_at=updated_at
        )

    def to_json(self) -> str:
        """Convert chat to JSON string"""
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> 'Chat':
        """Create a chat from JSON string"""
        data = json.loads(json_str)
        return cls.from_dict(data)