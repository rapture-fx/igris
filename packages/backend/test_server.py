#!/usr/bin/env python3
"""
Simple test server to verify FastAPI is working
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Create FastAPI app
app = FastAPI(
    title="Schlep Engine API",
    description="The Data Schlep Handler API",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Schlep Engine API is running!", "status": "healthy"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "API is running",
        "version": "0.1.0"
    }

@app.get("/health/detailed")
async def detailed_health():
    return {
        "status": "healthy",
        "services": {
            "api": "running",
            "database": "pending",  # Would check DB connection
            "redis": "pending"      # Would check Redis connection
        },
        "timestamp": "2025-08-11T00:00:00Z"
    }

if __name__ == "__main__":
    print("🚀 Starting Schlep Engine API...")
    uvicorn.run(
        "test_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        access_log=True,
        log_level="info"
    )