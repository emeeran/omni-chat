import os
import logging
from typing import List, Dict, Any, Optional
import requests
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class DeepSeekProvider(BaseProvider):
    """
    Provider implementation for DeepSeek API
    """

    def __init__(self, mock_responses=False):
        super().__init__(mock_responses=mock_responses)
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not found in environment variables")

        self.api_base = "https://api.deepseek.com/v1"
        # Set economical model as default
        self.default_model = "deepseek-chat"

    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for DeepSeek

        Returns:
            List of dictionaries containing model information
        """
        # Define models with economical flag and capabilities
        models = [
            {"id": "deepseek-chat", "name": "DeepSeek Chat", "default": True, "provider": "deepseek", "capabilities": ["chat"], "economical": True},
            {"id": "deepseek-coder", "name": "DeepSeek Coder", "default": False, "provider": "deepseek", "capabilities": ["chat", "code"], "economical": True},
            {"id": "deepseek-chat-32b", "name": "DeepSeek Chat 32B", "default": False, "provider": "deepseek", "capabilities": ["chat"]},
            {"id": "deepseek-llm-67b-chat", "name": "DeepSeek LLM 67B", "default": False, "provider": "deepseek", "capabilities": ["chat"]}
        ]

        # If using mock responses or no API key, return the predefined models
        if self.mock_responses or not self.api_key:
            return models

        try:
            # Currently returning hardcoded models as DeepSeek API might not have a models endpoint
            return models

        except Exception as e:
            logger.error(f"Error getting models from DeepSeek: {e}")
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
        Send a chat completion request to DeepSeek

        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            Response from DeepSeek
        """
        # If using mock responses, generate a mock response
        if self.mock_responses:
            return self.generate_mock_response(messages)

        if not self.api_key:
            return {"error": "DEEPSEEK_API_KEY not configured"}

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
            logger.error(f"Error in DeepSeek chat completion: {e}")
            return {"error": str(e)}

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        DeepSeek may not support image generation, so return an error

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
            "error": "Image generation is not currently supported by DeepSeek",
            "provider_capabilities": ["text"]
        }