import os
import logging
from typing import List, Dict, Any, Optional
import anthropic
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class AnthropicProvider(BaseProvider):
    """
    Provider implementation for Anthropic API (Claude)
    """

    def __init__(self, mock_responses=False):
        super().__init__(mock_responses=mock_responses)
        self.api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            logger.warning("ANTHROPIC_API_KEY not found in environment variables")

        if not self.mock_responses and self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        # Changed to a more economical model as default
        self.default_model = "claude-3-haiku-20240307"

    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for Anthropic

        Returns:
            List of dictionaries containing model information
        """
        # Define economical flag for Claude models
        economical_models = ["claude-3-haiku-20240307", "claude-instant-1.2"]

        models = [
            {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "default": True, "provider": "anthropic", "capabilities": ["chat"], "economical": True},
            {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "default": False, "provider": "anthropic", "capabilities": ["chat", "vision"]},
            {"id": "claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet", "default": False, "provider": "anthropic", "capabilities": ["chat", "vision"]},
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "default": False, "provider": "anthropic", "capabilities": ["chat", "vision"]},
            {"id": "claude-2.1", "name": "Claude 2.1", "default": False, "provider": "anthropic", "capabilities": ["chat"]},
            {"id": "claude-2.0", "name": "Claude 2.0", "default": False, "provider": "anthropic", "capabilities": ["chat"]},
            {"id": "claude-instant-1.2", "name": "Claude Instant", "default": False, "provider": "anthropic", "capabilities": ["chat"], "economical": True}
        ]

        # If using mock responses or no API key, return predefined models
        if self.mock_responses or not self.api_key:
            return models

        try:
            # Currently Anthropic doesn't have a models list endpoint,
            # so we'll return the known models
            return models

        except Exception as e:
            logger.error(f"Error getting models for Anthropic: {e}")
            return models

    def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send a chat completion request to Anthropic

        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            Response from Anthropic
        """
        # If using mock responses, generate a mock response
        if self.mock_responses:
            return self.generate_mock_response(messages)

        if not self.api_key:
            return {"error": "ANTHROPIC_API_KEY not configured"}

        try:
            # Format messages for Anthropic API
            # Anthropic uses 'assistant' instead of 'system' for system prompts
            anthropic_messages = []
            system_message = None

            # Extract system message if present
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                    continue

                # Convert non-system messages
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": [{"type": "text", "text": msg["content"]}]
                })

            # Set parameters for the API call
            params = {
                "model": model or self.default_model,
                "messages": anthropic_messages,
                "temperature": temperature,
            }

            # Add system message if present
            if system_message:
                params["system"] = system_message

            if max_tokens:
                params["max_tokens"] = max_tokens

            # Add any additional parameters
            for key, value in kwargs.items():
                if key not in params:
                    params[key] = value

            # Call Anthropic API
            response = self.client.messages.create(**params)

            # Format response to match expected structure
            return {
                "id": response.id,
                "created": int(response.created_at.timestamp()),
                "model": response.model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": response.content[0].text
                        }
                    }
                ]
            }

        except Exception as e:
            logger.error(f"Error in Anthropic chat completion: {e}")
            return {"error": str(e)}

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Claude doesn't support standalone image generation, so return an error

        Args:
            prompt: Text description of the desired image
            model: The model ID to use
            size: Image size in pixels (e.g., "1024x1024")
            **kwargs: Additional provider-specific parameters

        Returns:
            Error response
        """
        # If using mock responses, generate a mock image response
        if self.mock_responses:
            return {
                "created": 1715008000,
                "data": [
                    {
                        "url": "https://placeholder.com/1024x1024",
                        "revised_prompt": prompt
                    }
                ]
            }

        return {
            "error": "Image generation is not supported by Anthropic",
            "provider_capabilities": ["text", "vision"]
        }