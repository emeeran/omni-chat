from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class BaseProvider(ABC):
    """
    Abstract base class for all AI providers
    """
    
    def __init__(self, mock_responses=False):
        self.mock_responses = mock_responses
        logger.info(f"Initializing {self.__class__.__name__} with mock_responses={mock_responses}")
    
    @abstractmethod
    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for this provider
        
        Returns:
            List of dictionaries containing model information
        """
        pass
    
    @abstractmethod
    def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send a chat completion request to the provider
        
        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Response from the provider
        """
        pass
    
    @abstractmethod
    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate an image based on the prompt
        
        Args:
            prompt: Text description of the desired image
            model: The model ID to use
            size: Image size in pixels (e.g., "1024x1024")
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Response containing the generated image
        """
        pass
        
    def generate_mock_response(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Generate a mock response for chat completions
        
        Args:
            messages: List of message dictionaries (role, content)
            
        Returns:
            A mock response dictionary
        """
        # Get the last user message
        last_message = None
        for msg in reversed(messages):
            if msg["role"] == "user":
                last_message = msg["content"]
                break
        
        if not last_message:
            last_message = "No user message found"
        
        # Generate a simple mock response
        return {
            "id": "mock-response-id",
            "created": 1715008000,
            "model": "mock-model",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f"This is a mock response to: {last_message[:50]}{'...' if len(last_message) > 50 else ''}"
                    }
                }
            ]
        } 