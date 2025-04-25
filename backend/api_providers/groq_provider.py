import os
import logging
from typing import List, Dict, Any, Optional
import requests
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class GroqProvider(BaseProvider):
    """
    Provider implementation for Groq API
    """

    def __init__(self, mock_responses=False):
        super().__init__(mock_responses=mock_responses)
        self.api_key = os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("GROQ_API_KEY not found in environment variables")

        self.api_base = "https://api.groq.com/v1"
        # Updated default model to a more economical option
        self.default_model = "meta-llama/llama-3-8b-instruct"

    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for Groq

        Returns:
            List of dictionaries containing model information
        """
        # Use fallback models if using mock responses
        if self.mock_responses or not self.api_key:
            return [
                {"id": "meta-llama/llama-3-8b-instruct", "name": "Llama 3 8B", "default": True, "provider": "groq", "capabilities": ["chat"], "economical": True},
                {"id": "meta-llama/llama-3-70b-instruct", "name": "Llama 3 70B", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "meta-llama/llama-4-maverick-17b-128e-instruct", "name": "Llama 4 Maverick 17B", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "meta-llama/llama-4-2-100b-instruct", "name": "Llama 4 100B", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "default": False, "provider": "groq", "capabilities": ["chat"], "economical": True},
                {"id": "gemma-7b-it", "name": "Gemma 7B", "default": False, "provider": "groq", "capabilities": ["chat"], "economical": True}
            ]

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            response = requests.get(f"{self.api_base}/models", headers=headers)
            response.raise_for_status()

            data = response.json()
            models = []

            # Define economical models
            economical_models = ["meta-llama/llama-3-8b-instruct", "mixtral-8x7b-32768", "gemma-7b-it"]

            for model in data.get("data", []):
                model_id = model.get("id")
                model_info = {
                    "id": model_id,
                    "name": model_id.split("/")[-1],
                    "default": model_id == self.default_model,
                    "provider": "groq",
                    "capabilities": ["chat"],
                    "economical": model_id in economical_models
                }
                models.append(model_info)

            return models

        except Exception as e:
            logger.error(f"Error getting models from Groq: {e}")
            # Fallback to hardcoded models if API call fails
            return [
                {"id": "meta-llama/llama-3-8b-instruct", "name": "Llama 3 8B", "default": True, "provider": "groq", "capabilities": ["chat"], "economical": True},
                {"id": "meta-llama/llama-3-70b-instruct", "name": "Llama 3 70B", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "meta-llama/llama-4-maverick-17b-128e-instruct", "name": "Llama 4 Maverick 17B", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "meta-llama/llama-4-2-100b-instruct", "name": "Llama 4 100B", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "default": False, "provider": "groq", "capabilities": ["chat"]},
                {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "default": False, "provider": "groq", "capabilities": ["chat"], "economical": True},
                {"id": "gemma-7b-it", "name": "Gemma 7B", "default": False, "provider": "groq", "capabilities": ["chat"], "economical": True}
            ]

    def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send a chat completion request to Groq

        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            Response from Groq
        """
        # If using mock responses, generate a mock response
        if self.mock_responses:
            return self.generate_mock_response(messages)

        if not self.api_key:
            return {"error": "GROQ_API_KEY not configured"}

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": model or self.default_model,
                "messages": messages,
                "temperature": temperature
            }

            if max_tokens:
                payload["max_tokens"] = max_tokens

            # Add any additional parameters
            for key, value in kwargs.items():
                payload[key] = value

            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()

            return response.json()

        except Exception as e:
            logger.error(f"Error in Groq chat completion: {e}")
            return {"error": str(e)}

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Groq doesn't support image generation, so return an error

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
            "error": "Image generation is not supported by Groq",
            "provider_capabilities": ["text"]
        }