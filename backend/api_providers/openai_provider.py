import os
import logging
from typing import List, Dict, Any, Optional
import openai
from api_providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

class OpenAIProvider(BaseProvider):
    """
    Provider implementation for OpenAI API
    """
    
    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY not found in environment variables")
        
        self.client = openai.OpenAI(api_key=self.api_key)
        self.default_model = "gpt-4.1-nano-2025-04-14"
    
    def get_models(self) -> List[Dict[str, Any]]:
        """
        Get a list of available models for OpenAI
        
        Returns:
            List of dictionaries containing model information
        """
        try:
            if not self.api_key:
                raise ValueError("OpenAI API key not configured")
                
            response = self.client.models.list()
            models = []
            
            # Filter for only chat models
            gpt_models = [
                model for model in response.data
                if model.id.startswith(("gpt-", "ft:gpt-"))
            ]
            
            for model in gpt_models:
                model_info = {
                    "id": model.id,
                    "name": model.id,
                    "default": model.id == self.default_model
                }
                models.append(model_info)
            
            return models
            
        except Exception as e:
            logger.error(f"Error getting models from OpenAI: {e}")
            # Fallback to hardcoded models if API call fails
            return [
                {"id": "gpt-4.1-nano-2025-04-14", "name": "GPT-4.1 Nano", "default": True},
                {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "default": False},
                {"id": "gpt-4-vision-preview", "name": "GPT-4 Vision", "default": False},
                {"id": "gpt-4o", "name": "GPT-4o", "default": False},
                {"id": "gpt-4", "name": "GPT-4", "default": False},
                {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "default": False}
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
        Send a chat completion request to OpenAI
        
        Args:
            model: The model ID to use
            messages: List of message dictionaries (role, content)
            temperature: Controls randomness (0-1)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Response from OpenAI
        """
        if not self.api_key:
            return {"error": "OPENAI_API_KEY not configured"}
            
        try:
            params = {
                "model": model or self.default_model,
                "messages": messages,
                "temperature": temperature
            }
            
            if max_tokens:
                params["max_tokens"] = max_tokens
                
            # Add any additional parameters
            for key, value in kwargs.items():
                if key not in params:
                    params[key] = value
            
            response = self.client.chat.completions.create(**params)
            
            # Convert the response object to a dictionary
            return {
                "id": response.id,
                "created": response.created,
                "model": response.model,
                "choices": [
                    {
                        "index": choice.index,
                        "message": {
                            "role": choice.message.role,
                            "content": choice.message.content
                        }
                    } for choice in response.choices
                ]
            }
            
        except Exception as e:
            logger.error(f"Error in OpenAI chat completion: {e}")
            return {"error": str(e)}
    
    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate an image using OpenAI's DALL-E API
        
        Args:
            prompt: Text description of the desired image
            model: The model ID to use (defaults to DALL-E 3)
            size: Image size in pixels (e.g., "1024x1024")
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Response containing the generated image
        """
        if not self.api_key:
            return {"error": "OPENAI_API_KEY not configured"}
            
        try:
            image_model = model or "dall-e-3"
            
            response = self.client.images.generate(
                model=image_model,
                prompt=prompt,
                size=size,
                n=1,
                **kwargs
            )
            
            # Convert the response object to a dictionary
            return {
                "created": response.created,
                "data": [
                    {
                        "url": image.url,
                        "revised_prompt": image.revised_prompt if hasattr(image, 'revised_prompt') else None
                    } for image in response.data
                ]
            }
            
        except Exception as e:
            logger.error(f"Error in OpenAI image generation: {e}")
            return {"error": str(e)} 