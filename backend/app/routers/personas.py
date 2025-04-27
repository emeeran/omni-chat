from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime
import uuid

router = APIRouter(
    prefix="/personas",
    tags=["personas"],
    responses={404: {"description": "Not found"}},
)

class Persona(BaseModel):
    id: Optional[str] = None
    name: str
    instructions: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    metadata: Optional[Dict] = None

# Sample personas
PERSONAS = [
    Persona(
        id="default",
        name="Default Assistant",
        instructions="You are a helpful, creative, accurate, and friendly AI assistant.",
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    Persona(
        id="programmer",
        name="Programming Assistant",
        instructions="You are an expert programmer with deep knowledge of software development, algorithms, and computer science concepts. Always provide code examples when appropriate and explain the code thoroughly.",
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    Persona(
        id="writer",
        name="Writing Assistant",
        instructions="You are a skilled writing assistant, proficient in various writing styles, grammar, and storytelling techniques. Help users improve their writing with constructive feedback and suggestions.",
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    Persona(
        id="data-scientist",
        name="Data Science Assistant",
        instructions="You are a data science expert with knowledge of statistics, machine learning, data analysis, and data visualization. Provide detailed explanations of concepts and techniques, and suggest appropriate approaches for data-related tasks.",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
]

@router.get("", response_model=List[Persona])
async def get_personas():
    return PERSONAS

@router.get("/{persona_id}", response_model=Persona)
async def get_persona(persona_id: str):
    for persona in PERSONAS:
        if persona.id == persona_id:
            return persona
    raise HTTPException(status_code=404, detail="Persona not found")

@router.post("", response_model=Persona)
async def create_persona(persona: Persona):
    persona.id = str(uuid.uuid4())
    persona.created_at = datetime.now()
    persona.updated_at = datetime.now()
    PERSONAS.append(persona)
    return persona

@router.put("/{persona_id}", response_model=Persona)
async def update_persona(persona_id: str, persona_update: Persona):
    for i, persona in enumerate(PERSONAS):
        if persona.id == persona_id:
            # Update persona, keeping the same ID and created_at
            persona_update.id = persona_id
            persona_update.created_at = persona.created_at
            persona_update.updated_at = datetime.now()
            PERSONAS[i] = persona_update
            return persona_update
    raise HTTPException(status_code=404, detail="Persona not found")

@router.delete("/{persona_id}")
async def delete_persona(persona_id: str):
    for i, persona in enumerate(PERSONAS):
        if persona.id == persona_id:
            PERSONAS.pop(i)
            return {"status": "success", "message": "Persona deleted"}
    raise HTTPException(status_code=404, detail="Persona not found") 