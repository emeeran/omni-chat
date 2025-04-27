from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.routers import chat, providers, personas, files, analytics

app = FastAPI(
    title="Omni-Chat API",
    description="Backend API for Omni-Chat - An Enterprise-Grade Multimodal Chat Application",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(providers.router)
app.include_router(personas.router)
app.include_router(files.router)
app.include_router(analytics.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Omni-Chat API is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
