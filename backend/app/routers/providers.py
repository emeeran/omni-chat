from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Optional, Dict
from pydantic import BaseModel
import uuid

router = APIRouter(
    prefix="/providers",
    tags=["providers"],
    responses={404: {"description": "Not found"}},
)

class Model(BaseModel):
    id: str
    name: str
    capabilities: List[str]  # text, images, audio, embeddings, etc.
    parameters: Dict[str, dict]  # available parameters with defaults and constraints

class Provider(BaseModel):
    id: Optional[str] = None
    name: str
    api_key: Optional[str] = None
    enabled: bool = True
    models: List[Model] = []
    url: Optional[str] = None
    description: Optional[str] = None

# Define some sample AI providers
PROVIDERS = [
    Provider(
        id="openai",
        name="OpenAI",
        enabled=True,
        models=[
            Model(
                id="gpt-4o",
                name="GPT-4o",
                capabilities=["text", "images", "audio"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 2.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1024},
                }
            ),
            Model(
                id="gpt-4",
                name="GPT-4",
                capabilities=["text"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 2.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1024},
                }
            ),
            Model(
                id="dall-e-3",
                name="DALL-E 3",
                capabilities=["images"],
                parameters={
                    "size": {"type": "string", "options": ["1024x1024", "1792x1024", "1024x1792"], "default": "1024x1024"},
                    "quality": {"type": "string", "options": ["standard", "hd"], "default": "standard"},
                }
            )
        ]
    ),
    Provider(
        id="anthropic",
        name="Anthropic",
        enabled=True,
        models=[
            Model(
                id="claude-3-opus",
                name="Claude 3 Opus",
                capabilities=["text", "images"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1024},
                }
            ),
            Model(
                id="claude-3-sonnet",
                name="Claude 3 Sonnet",
                capabilities=["text", "images"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1024},
                }
            )
        ]
    ),
    Provider(
        id="google",
        name="Google AI",
        enabled=True,
        models=[
            Model(
                id="gemini-pro",
                name="Gemini Pro",
                capabilities=["text"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1024},
                }
            ),
            Model(
                id="gemini-pro-vision",
                name="Gemini Pro Vision",
                capabilities=["text", "images"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1024},
                }
            )
        ]
    ),
    Provider(
        id="cohere",
        name="Cohere",
        enabled=True,
        models=[
            Model(
                id="command-r",
                name="Command R",
                capabilities=["text"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 2.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1024},
                }
            )
        ]
    ),
    Provider(
        id="groq",
        name="Groq",
        enabled=True,
        models=[
            Model(
                id="llama3-70b-8192",
                name="LLaMA3 70B",
                capabilities=["text"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1024},
                }
            ),
            Model(
                id="mixtral-8x7b-32768",
                name="Mixtral 8x7B",
                capabilities=["text"],
                parameters={
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 32768, "default": 1024},
                }
            )
        ]
    )
]

@router.get("", response_model=List[Provider])
async def get_providers():
    return PROVIDERS

@router.get("/{provider_id}", response_model=Provider)
async def get_provider(provider_id: str):
    for provider in PROVIDERS:
        if provider.id == provider_id:
            return provider
    raise HTTPException(status_code=404, detail="Provider not found")

@router.post("", response_model=Provider)
async def create_provider(provider: Provider):
    provider.id = str(uuid.uuid4())
    PROVIDERS.append(provider)
    return provider

@router.put("/{provider_id}", response_model=Provider)
async def update_provider(provider_id: str, provider_update: Provider):
    for i, provider in enumerate(PROVIDERS):
        if provider.id == provider_id:
            # Update provider, keeping the same ID
            provider_update.id = provider_id
            PROVIDERS[i] = provider_update
            return provider_update
    raise HTTPException(status_code=404, detail="Provider not found")

@router.put("/{provider_id}/api-key")
async def update_api_key(provider_id: str, api_key: str = Body(..., embed=True)):
    for provider in PROVIDERS:
        if provider.id == provider_id:
            provider.api_key = api_key
            return {"status": "success", "message": "API key updated"}
    raise HTTPException(status_code=404, detail="Provider not found")

@router.get("/{provider_id}/models", response_model=List[Model])
async def get_provider_models(provider_id: str):
    for provider in PROVIDERS:
        if provider.id == provider_id:
            return provider.models
    raise HTTPException(status_code=404, detail="Provider not found") 