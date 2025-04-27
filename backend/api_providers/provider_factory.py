from typing import Dict, Optional, Type, List, Any, Tuple
import logging
import os
import time
import threading
from functools import lru_cache

from api_providers.base_provider import BaseProvider
from api_providers.groq_provider import GroqProvider
from api_providers.openai_provider import OpenAIProvider
from api_providers.anthropic_provider import AnthropicProvider
from api_providers.mistral_provider import MistralProvider
from api_providers.cohere_provider import CohereProvider
from api_providers.deepseek_provider import DeepSeekProvider
from api_providers.gemini_provider import GeminiProvider
from api_providers.config import MOCK_API_RESPONSES, API_KEYS

logger = logging.getLogger(__name__)

# Dictionary mapping provider IDs to their respective provider classes
PROVIDER_CLASSES: Dict[str, Type[BaseProvider]] = {
    "groq": GroqProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "mistral": MistralProvider,
    "cohere": CohereProvider,
    "deepseek": DeepSeekProvider,
    "gemini": GeminiProvider,
    # Add more providers as they are implemented
}

# Advanced provider management with performance tracking
class ProviderManager:
    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}
        self._provider_stats: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()  # Reentrant lock for thread safety
        self._default_provider = "groq"  # Default provider

    def get_provider(self, provider_id: str) -> Optional[BaseProvider]:
        """Get a provider instance with performance tracking"""
        provider_id = provider_id.lower()

        with self._lock:
            # Return cached provider if available
            if provider_id in self._providers:
                # Update last access time
                if provider_id in self._provider_stats:
                    self._provider_stats[provider_id]["last_access"] = time.time()
                    self._provider_stats[provider_id]["access_count"] += 1
                return self._providers[provider_id]

            # Get the provider class
            provider_class = PROVIDER_CLASSES.get(provider_id)
            if not provider_class:
                logger.warning(f"Provider '{provider_id}' not found")
                return None

            # Set environment variable for provider API key if not present
            if provider_id in API_KEYS and not os.environ.get(f"{provider_id.upper()}_API_KEY"):
                os.environ[f"{provider_id.upper()}_API_KEY"] = API_KEYS[provider_id]
                logger.debug(f"Set API key for {provider_id} from config")

            # Initialize provider and cache the instance
            try:
                start_time = time.time()
                logger.info(f"Initializing provider: {provider_id}")
                provider_instance = provider_class(mock_responses=MOCK_API_RESPONSES)
                init_time = time.time() - start_time

                # Store the instance
                self._providers[provider_id] = provider_instance

                # Track stats
                self._provider_stats[provider_id] = {
                    "initialized_at": time.time(),
                    "init_time": init_time,
                    "last_access": time.time(),
                    "access_count": 1,
                    "error_count": 0,
                    "total_requests": 0,
                    "total_tokens": 0,
                    "avg_response_time": 0,
                }

                return provider_instance
            except Exception as e:
                logger.error(f"Failed to initialize provider '{provider_id}': {str(e)}")
                # Track error
                if provider_id in self._provider_stats:
                    self._provider_stats[provider_id]["error_count"] += 1
                else:
                    self._provider_stats[provider_id] = {
                        "initialized_at": 0,
                        "init_time": 0,
                        "last_access": 0,
                        "access_count": 0,
                        "error_count": 1,
                        "total_requests": 0,
                        "total_tokens": 0,
                        "avg_response_time": 0,
                    }
                return None

    def track_api_call(self, provider_id: str, response_time: float, tokens: int = 0) -> None:
        """Track performance metrics for provider API calls"""
        provider_id = provider_id.lower()

        with self._lock:
            if provider_id in self._provider_stats:
                stats = self._provider_stats[provider_id]
                # Update rolling average for response time
                prev_avg = stats["avg_response_time"]
                prev_count = stats["total_requests"]

                if prev_count == 0:
                    stats["avg_response_time"] = response_time
                else:
                    # Calculate new rolling average
                    stats["avg_response_time"] = (prev_avg * prev_count + response_time) / (prev_count + 1)

                stats["total_requests"] += 1
                stats["total_tokens"] += tokens

    def get_provider_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get provider usage statistics"""
        with self._lock:
            return {k: v.copy() for k, v in self._provider_stats.items()}

    def reset_provider(self, provider_id: str) -> None:
        """Reset a specific provider instance"""
        provider_id = provider_id.lower()

        with self._lock:
            if provider_id in self._providers:
                del self._providers[provider_id]
                logger.info(f"Provider {provider_id} has been reset")

    def reset_all_providers(self) -> None:
        """Reset all provider instances"""
        with self._lock:
            self._providers = {}
            logger.info("All provider instances have been reset")

    def get_default_provider_id(self) -> str:
        """Get the default provider ID"""
        return self._default_provider

    def set_default_provider(self, provider_id: str) -> bool:
        """Set the default provider"""
        provider_id = provider_id.lower()

        if provider_id in PROVIDER_CLASSES:
            self._default_provider = provider_id
            return True
        return False

# Create a singleton instance of the provider manager
_provider_manager = ProviderManager()

def get_provider(provider_id: str = None) -> Optional[BaseProvider]:
    """
    Factory function that returns an instance of the requested provider using lazy loading
    with performance tracking and error handling.

    Provider instances are cached after first initialization to improve performance.

    Args:
        provider_id: String identifier for the provider, or None to use default

    Returns:
        An instance of the requested provider, or None if not found
    """
    # Use default provider if not specified
    if provider_id is None:
        provider_id = _provider_manager.get_default_provider_id()

    return _provider_manager.get_provider(provider_id)

@lru_cache(maxsize=1)
def get_available_providers() -> Dict[str, Dict]:
    """
    Get information about all available providers with caching

    Returns:
        Dictionary mapping provider IDs to their metadata
    """
    providers = {}
    default_provider = _provider_manager.get_default_provider_id()

    for provider_id, provider_class in PROVIDER_CLASSES.items():
        # Check if provider has API key configured
        has_api_key = provider_id in API_KEYS or os.environ.get(f"{provider_id.upper()}_API_KEY") is not None

        providers[provider_id] = {
            "id": provider_id,
            "name": getattr(provider_class, "PROVIDER_NAME", provider_id.title()),
            "default": provider_id == default_provider,
            "available": has_api_key,
            "website": getattr(provider_class, "PROVIDER_WEBSITE", None),
            "description": getattr(provider_class, "PROVIDER_DESCRIPTION", None),
        }

    return providers

def track_api_call(provider_id: str, response_time: float, tokens: int = 0) -> None:
    """
    Track API call metrics for a provider

    Args:
        provider_id: The provider ID
        response_time: Time taken for the API call in seconds
        tokens: Number of tokens used (if available)
    """
    _provider_manager.track_api_call(provider_id, response_time, tokens)

def get_provider_stats() -> Dict[str, Dict[str, Any]]:
    """
    Get provider usage statistics

    Returns:
        Dictionary of provider statistics
    """
    return _provider_manager.get_provider_stats()

def reset_provider_cache(provider_id: str = None) -> None:
    """
    Reset the provider instance cache - useful for testing or after configuration changes

    Args:
        provider_id: Optional specific provider to reset, or None to reset all
    """
    if provider_id:
        _provider_manager.reset_provider(provider_id)
    else:
        _provider_manager.reset_all_providers()

def set_default_provider(provider_id: str) -> bool:
    """
    Set the default provider to use when no provider is specified

    Args:
        provider_id: The provider ID to set as default

    Returns:
        True if successful, False if provider not found
    """
    return _provider_manager.set_default_provider(provider_id)