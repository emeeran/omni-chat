from api_providers.base_provider import BaseProvider
from api_providers.groq_provider import GroqProvider
from api_providers.openai_provider import OpenAIProvider
from api_providers.anthropic_provider import AnthropicProvider
from api_providers.mistral_provider import MistralProvider
from api_providers.cohere_provider import CohereProvider
from api_providers.deepseek_provider import DeepSeekProvider
from api_providers.gemini_provider import GeminiProvider
from api_providers.config import MOCK_API_RESPONSES, API_KEYS
import os

# Dictionary mapping provider IDs to their respective provider classes
PROVIDERS = {
    "groq": GroqProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "mistral": MistralProvider,
    "cohere": CohereProvider,
    "deepseek": DeepSeekProvider,
    "gemini": GeminiProvider,
    # Add more providers as they are implemented
}

def get_provider(provider_id: str) -> BaseProvider:
    """
    Factory function that returns an instance of the requested provider

    Args:
        provider_id: String identifier for the provider

    Returns:
        An instance of the requested provider, or None if not found
    """
    provider_class = PROVIDERS.get(provider_id.lower())
    if provider_class:
        # Set environment variable for provider API key if not present
        if provider_id.lower() in API_KEYS and not os.environ.get(f"{provider_id.upper()}_API_KEY"):
            os.environ[f"{provider_id.upper()}_API_KEY"] = API_KEYS[provider_id.lower()]

        # Return provider instance
        return provider_class(mock_responses=MOCK_API_RESPONSES)
    return None