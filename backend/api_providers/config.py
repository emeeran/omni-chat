"""
Configuration for API providers with mock settings for development
"""

# Mock API keys for development
API_KEYS = {
    "openai": "demo_key_openai",
    "anthropic": "demo_key_anthropic",
    "mistral": "demo_key_mistral",
    "cohere": "demo_key_cohere",
    "groq": "demo_key_groq"
}

# Enable mock responses
MOCK_API_RESPONSES = False