"""TEF Platform Backend API."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="TEF Platform API",
    description="Backend API for the TEF Platform",
    version="0.1.0",
)

# CORS middleware configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "tef-api",
        "status": "online",
        "version": "0.1.0",
        "python_baseline": "3.14",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "postgresql-18",
    }
