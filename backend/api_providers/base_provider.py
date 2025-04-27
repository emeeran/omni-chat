from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Callable
import logging
import time
import functools

logger = logging.getLogger(__name__)

# Add a simple in-memory cache
class SimpleCache:
    """Simple in-memory cache with time-based expiration"""

    def __init__(self, max_size: int = 100, ttl: int = 600):
        """
        Initialize cache

        Args:
            max_size: Maximum number of items to store
            ttl: Time to live in seconds
        """
        self.cache = {}
        self.max_size = max_size
        self.ttl = ttl

    def get(self, key: str) -> Optional[Any]:
        """Get item from cache if it exists and is not expired"""
        if key not in self.cache:
            return None

        item, timestamp = self.cache[key]
        if time.time() - timestamp > self.ttl:
            # Item expired
            del self.cache[key]
            return None

        return item

    def set(self, key: str, value: Any) -> None:
        """Add item to cache with current timestamp"""
        # If cache is full, remove oldest item
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]

        self.cache[key] = (value, time.time())

# Global cache instance
_cache = SimpleCache()

# Cache decorator for provider methods
def cached(ttl: int = 3600):
    """
    Decorator to cache results of a method

    Args:
        ttl: Time to live in seconds
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs):
            # Create a cache key from method name, args and kwargs
            cache_key = f"{self.__class__.__name__}:{func.__name__}:{str(args)}:{str(kwargs)}"

            # Check if result is in cache
            cached_result = _cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result

            # Call the original method
            result = func(self, *args, **kwargs)

            # Only cache successful results
            if result:
                _cache.set(cache_key, result)

            return result
        return wrapper
    return decorator

class BaseProvider(ABC):
    """
    Abstract base class for all AI providers
    """

    def __init__(self, mock_responses=False):
        self.mock_responses = mock_responses
        logger.info(f"Initializing {self.__class__.__name__} with mock_responses={mock_responses}")

    @abstractmethod
    @cached(ttl=3600)  # Cache model lists for 1 hour
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

    def format_response(self, response: Any, provider_specific_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Format provider-specific response into a standardized format

        Args:
            response: The original response from the provider
            provider_specific_data: Any additional provider-specific data to include

        Returns:
            Standardized response dictionary
        """
        # Handle error responses
        if isinstance(response, dict) and "error" in response:
            return response

        # Create a standardized response structure
        standardized_response = {
            "id": getattr(response, "id", None) or str(time.time()),
            "created": getattr(response, "created", None) or int(time.time()),
            "model": getattr(response, "model", None) or "unknown",
            "choices": [],
            "provider": self.__class__.__name__.replace("Provider", "").lower()
        }

        # Include any provider-specific data
        if provider_specific_data:
            standardized_response.update(provider_specific_data)

        # Add standardized choices
        if hasattr(response, "choices") and response.choices:
            for i, choice in enumerate(response.choices):
                std_choice = {"index": i}

                # Handle different message formats
                if hasattr(choice, "message"):
                    message = choice.message
                    std_choice["message"] = {
                        "role": getattr(message, "role", "assistant"),
                        "content": getattr(message, "content", "")
                    }
                elif isinstance(choice, dict) and "message" in choice:
                    std_choice["message"] = choice["message"]
                else:
                    # Fallback for text-only responses
                    std_choice["message"] = {
                        "role": "assistant",
                        "content": str(choice)
                    }

                standardized_response["choices"].append(std_choice)

        # Handle dictionary response format (already converted)
        if isinstance(response, dict):
            if "choices" in response:
                standardized_response["choices"] = response["choices"]
            if "id" in response:
                standardized_response["id"] = response["id"]
            if "created" in response:
                standardized_response["created"] = response["created"]
            if "model" in response:
                standardized_response["model"] = response["model"]

        return standardized_response

    def process_system_prompt(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Process system prompt with context variables if needed

        Args:
            prompt: System prompt template
            context: Optional context variables for substitution

        Returns:
            Processed system prompt
        """
        if not context:
            return prompt

        try:
            return prompt.format(**context)
        except KeyError as e:
            logger.warning(f"Missing context variable in prompt: {e}")
            return prompt
        except Exception as e:
            logger.error(f"Error processing system prompt: {e}")
            return prompt

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