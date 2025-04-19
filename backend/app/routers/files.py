from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import os
import shutil
from pathlib import Path

router = APIRouter(
    prefix="/files",
    tags=["files"],
    responses={404: {"description": "Not found"}},
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

class FileMetadata(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    uploaded_at: datetime
    conversation_id: Optional[str] = None
    processed: bool = False

# In-memory file storage (in a real app, you'd use a database)
FILES = []

@router.post("/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None)
):
    # Create a unique ID for the file
    file_id = str(uuid.uuid4())
    
    # Get file info
    content_type = file.content_type
    filename = file.filename
    
    # Define path to save the file
    file_path = UPLOAD_DIR / f"{file_id}_{filename}"
    
    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get file size
    size = os.path.getsize(file_path)
    
    # Create file metadata
    file_metadata = FileMetadata(
        id=file_id,
        filename=filename,
        content_type=content_type,
        size=size,
        uploaded_at=datetime.now(),
        conversation_id=conversation_id,
        processed=False
    )
    
    # Add to in-memory storage
    FILES.append(file_metadata)
    
    return file_metadata

@router.get("", response_model=List[FileMetadata])
async def get_files(conversation_id: Optional[str] = None):
    if conversation_id:
        return [f for f in FILES if f.conversation_id == conversation_id]
    return FILES

@router.get("/{file_id}", response_model=FileMetadata)
async def get_file_metadata(file_id: str):
    for file in FILES:
        if file.id == file_id:
            return file
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/{file_id}/download")
async def download_file(file_id: str):
    for file in FILES:
        if file.id == file_id:
            file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
            if os.path.exists(file_path):
                return FileResponse(
                    path=file_path,
                    filename=file.filename,
                    media_type=file.content_type
                )
            raise HTTPException(status_code=404, detail="File not found on disk")
    raise HTTPException(status_code=404, detail="File metadata not found")

@router.delete("/{file_id}")
async def delete_file(file_id: str):
    for i, file in enumerate(FILES):
        if file.id == file_id:
            # Remove from in-memory storage
            removed_file = FILES.pop(i)
            
            # Remove from disk
            file_path = UPLOAD_DIR / f"{file_id}_{removed_file.filename}"
            if os.path.exists(file_path):
                os.remove(file_path)
                
            return {"status": "success", "message": "File deleted"}
    
    raise HTTPException(status_code=404, detail="File not found") 