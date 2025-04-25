import os
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class GeminiProvider(BaseProvider):
    """
    Provider implementation for Google's Gemini API
    """

    def __init__(self, mock_responses=False):
        super().__init__(mock_responses=mock_responses)
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables")

        if not self.mock_responses and self.api_key:
            genai.configure(api_key=self.api_key)
        # Set economical model as default
        self.default_model = "gemini-1.0-pro"

    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for Gemini

        Returns:
            List of dictionaries containing model information
        """
        # Define models with economical flag and capabilities
        models = [
            {"id": "gemini-1.0-pro", "name": "Gemini 1.0 Pro", "default": True, "provider": "gemini", "capabilities": ["chat"], "economical": True},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "default": False, "provider": "gemini", "capabilities": ["chat", "vision"]},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "default": False, "provider": "gemini", "capabilities": ["chat"], "economical": True},
            {"id": "gemini-ultra", "name": "Gemini Ultra", "default": False, "provider": "gemini", "capabilities": ["chat", "vision"]}
        ]

        # If using mock responses or no API key, return the predefined models
        if self.mock_responses or not self.api_key:
            return models

        try:
            # Attempt to fetch available models from the Gemini API
            available_models = genai.list_models()
            api_models = []

            for model in available_models:
                if "gemini" in model.name.lower():
                    model_info = {
                        "id": model.name,
                        "name": model.name.split("/")[-1],
                        "default": model.name == self.default_model,
                        "provider": "gemini",
                        "capabilities": ["chat"],
                        "economical": "flash" in model.name.lower() or "pro" in model.name.lower() and not any(x in model.name.lower() for x in ["ultra", "1.5"])
                    }

                    # Add vision capability for models that support it
                    if hasattr(model, 'supported_generation_methods') and 'generateContent' in model.supported_generation_methods:
                        model_info["capabilities"].append("vision")

                    api_models.append(model_info)

            return api_models if api_models else models

        except Exception as e:
            logger.error(f"Error getting models from Gemini: {e}")
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
        Send a chat completion request to Gemini

        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            Response from Gemini
        """
        # If using mock responses, generate a mock response
        if self.mock_responses:
            return self.generate_mock_response(messages)

        if not self.api_key:
            return {"error": "GEMINI_API_KEY not configured"}

        try:
            model_name = model or self.default_model
            gemini_model = genai.GenerativeModel(model_name)

            # Convert messages to Gemini chat format
            chat = gemini_model.start_chat(history=[])

            system_prompt = None
            for msg in messages:
                if msg["role"] == "system":
                    system_prompt = msg["content"]
                elif msg["role"] == "user":
                    # If this is the first user message and we have a system prompt,
                    # prepend it to the user message
                    if system_prompt and not chat.history:
                        content = f"{system_prompt}\n\nUser: {msg['content']}"
                        chat.send_message(content)
                        system_prompt = None
                    else:
                        chat.send_message(msg["content"])
                elif msg["role"] == "assistant" and chat.history:
                    # Add assistant messages to the history
                    chat.history.append({"role": "model", "parts": [msg["content"]]})

            # Generate response
            generation_config = {
                "temperature": temperature,
            }

            if max_tokens:
                generation_config["max_output_tokens"] = max_tokens

            # Add any additional parameters
            for key, value in kwargs.items():
                if key not in generation_config:
                    generation_config[key] = value

            # If we didn't add any messages (e.g., only system messages), send an empty message
            if not chat.history:
                if system_prompt:
                    chat.send_message(system_prompt)
                else:
                    chat.send_message("")

            # Get the last message from the model
            response = chat.last

            # Format the response to match the expected structure
            return {
                "id": f"gemini-{model_name}-{id(response)}",
                "created": 0,  # Gemini doesn't provide a timestamp
                "model": model_name,
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
            logger.error(f"Error in Gemini chat completion: {e}")
            return {"error": str(e)}

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Gemini API doesn't support standalone image generation

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
            "error": "Image generation is not currently supported by Gemini",
            "provider_capabilities": ["text", "vision"]
        }