import os
import logging
from typing import List, Dict, Any, Optional
import cohere
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class CohereProvider(BaseProvider):
    """
    Provider implementation for Cohere API
    """

    def __init__(self, mock_responses=False):
        super().__init__(mock_responses=mock_responses)
        self.api_key = os.environ.get("COHERE_API_KEY")
        if not self.api_key:
            logger.warning("COHERE_API_KEY not found in environment variables")

        if not self.mock_responses and self.api_key:
            self.client = cohere.Client(api_key=self.api_key)
        else:
            self.client = None
        # Changed default model to more economical option
        self.default_model = "command-light"

    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for Cohere

        Returns:
            List of dictionaries containing model information
        """
        # Define models with economical flag and capabilities
        models = [
            {"id": "command-light", "name": "Command Light", "default": True, "provider": "cohere", "capabilities": ["chat"], "economical": True},
            {"id": "command-r", "name": "Command R", "default": False, "provider": "cohere", "capabilities": ["chat"]},
            {"id": "command-r-plus", "name": "Command R+", "default": False, "provider": "cohere", "capabilities": ["chat"]},
            {"id": "command", "name": "Command", "default": False, "provider": "cohere", "capabilities": ["chat"]},
            {"id": "command-nightly", "name": "Command Nightly", "default": False, "provider": "cohere", "capabilities": ["chat"]},
            {"id": "command-light-nightly", "name": "Command Light Nightly", "default": False, "provider": "cohere", "capabilities": ["chat"], "economical": True}
        ]

        # If using mock responses or no API key, return the predefined models
        if self.mock_responses or not self.client:
            return models

        try:
            # Currently Cohere doesn't have a models list endpoint in their Python client
            # Return known models for now
            return models

        except Exception as e:
            logger.error(f"Error getting models from Cohere: {e}")
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
        Send a chat completion request to Cohere

        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            Response from Cohere
        """
        # If using mock responses, generate a mock response
        if self.mock_responses:
            return self.generate_mock_response(messages)

        if not self.client:
            return {"error": "COHERE_API_KEY not configured"}

        try:
            # Prepare the messages for Cohere
            # Extract system message to use as preamble
            system_message = ""
            chat_history = []

            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    # Convert to Cohere's format - user/bot
                    role = "USER" if msg["role"] == "user" else "CHATBOT"
                    chat_history.append({"role": role, "message": msg["content"]})

            # Set parameters for the API call
            params = {
                "model": model or self.default_model,
                "chat_history": chat_history,
                "temperature": temperature
            }

            if system_message:
                params["preamble"] = system_message

            if max_tokens:
                params["max_tokens"] = max_tokens

            # Add any additional parameters
            for key, value in kwargs.items():
                if key not in params:
                    params[key] = value

            # Make the API call
            response = self.client.chat(**params)

            # Format the response to match the expected structure
            return {
                "id": response.generation_id,
                "created": 0,  # Cohere doesn't provide a timestamp
                "model": model or self.default_model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": response.text
                        }
                    }
                ]
            }

        except Exception as e:
            logger.error(f"Error in Cohere chat completion: {e}")
            return {"error": str(e)}

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate an image using Cohere's image generation capabilities

        Args:
            prompt: Text description of the desired image
            model: The model ID to use
            size: Image size in pixels (e.g., "1024x1024")
            **kwargs: Additional provider-specific parameters

        Returns:
            Response containing the generated image or error
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

        if not self.client:
            return {"error": "COHERE_API_KEY not configured"}

        try:
            # Check if Cohere has made image generation available
            # As of last update, Cohere doesn't have a public image generation API
            return {
                "error": "Image generation is not currently supported by Cohere",
                "provider_capabilities": ["text"]
            }

        except Exception as e:
            logger.error(f"Error in Cohere image generation: {e}")
            return {"error": str(e)}