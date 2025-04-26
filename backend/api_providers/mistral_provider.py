import os
import logging
from typing import List, Dict, Any, Optional
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class MistralProvider(BaseProvider):
    """
    Provider implementation for Mistral AI API
    """

    def __init__(self, mock_responses=False):
        super().__init__(mock_responses=mock_responses)
        self.api_key = os.environ.get("MISTRAL_API_KEY")
        if not self.api_key:
            logger.warning("MISTRAL_API_KEY not found in environment variables")

        if not self.mock_responses and self.api_key:
            self.client = MistralClient(api_key=self.api_key)
        else:
            self.client = None
        # Changed default model to a more economical option
        self.default_model = "mistral-tiny"

    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for Mistral

        Returns:
            List of dictionaries containing model information
        """
        # Define models with their capabilities and economical status
        models = [
            {"id": "mistral-tiny", "name": "Mistral Tiny", "default": True, "provider": "mistral", "capabilities": ["chat"], "economical": True},
            {"id": "mistral-small", "name": "Mistral Small", "default": False, "provider": "mistral", "capabilities": ["chat"], "economical": True},
            {"id": "mistral-medium", "name": "Mistral Medium", "default": False, "provider": "mistral", "capabilities": ["chat"]},
            {"id": "mistral-large-latest", "name": "Mistral Large", "default": False, "provider": "mistral", "capabilities": ["chat"]},
            {"id": "open-mistral-7b", "name": "Open Mistral 7B", "default": False, "provider": "mistral", "capabilities": ["chat"], "economical": True},
            {"id": "open-mixtral-8x7b", "name": "Open Mixtral 8x7B", "default": False, "provider": "mistral", "capabilities": ["chat"], "economical": True},
            {"id": "open-mixtral-8x22b", "name": "Open Mixtral 8x22B", "default": False, "provider": "mistral", "capabilities": ["chat"]},
            {"id": "codestral-latest", "name": "Codestral", "default": False, "provider": "mistral", "capabilities": ["chat", "code"]}
        ]

        # If using mock responses or no API key, return the predefined models
        if self.mock_responses or not self.client:
            return models

        try:
            # Currently, Mistral doesn't have a models list endpoint in their Python client
            # Return known models for now
            return models

        except Exception as e:
            logger.error(f"Error getting models from Mistral: {e}")
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
        Send a chat completion request to Mistral

        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            Response from Mistral
        """
        # If using mock responses, generate a mock response
        if self.mock_responses:
            return self.generate_mock_response(messages)

        if not self.client:
            return {"error": "MISTRAL_API_KEY not configured"}

        try:
            # Convert messages to Mistral format
            mistral_messages = []
            for msg in messages:
                mistral_messages.append(
                    ChatMessage(role=msg["role"], content=msg["content"])
                )

            # Set parameters
            params = {
                "model": model or self.default_model,
                "messages": mistral_messages,
                "temperature": temperature
            }

            if max_tokens:
                params["max_tokens"] = max_tokens

            # Add any additional parameters
            for key, value in kwargs.items():
                if key not in params:
                    params[key] = value

            # Call Mistral API
            response = self.client.chat(**params)

            # Use the standardized format_response method
            return self.format_response(response, {
                "created": int(response.created_at),
                "model": response.model
            })

        except Exception as e:
            logger.error(f"Error in Mistral chat completion: {e}")
            return {"error": str(e)}

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Mistral doesn't support image generation, so return an error

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
            "error": "Image generation is not supported by Mistral",
            "provider_capabilities": ["text"]
        }