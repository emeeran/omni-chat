from api_providers.base_provider import BaseProvider
from api_providers.groq_provider import GroqProvider
from api_providers.openai_provider import OpenAIProvider
from api_providers.anthropic_provider import AnthropicProvider
from api_providers.mistral_provider import MistralProvider
from api_providers.cohere_provider import CohereProvider

# Dictionary mapping provider IDs to their respective provider classes
PROVIDERS = {
    "groq": GroqProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "mistral": MistralProvider,
    "cohere": CohereProvider,
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
        return provider_class()
    return None 