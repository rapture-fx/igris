#!/usr/bin/env python3
"""
Production FastAPI application for Schlep Engine
Simplified version with core functionality
"""

import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime
import psycopg2
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the app directory to Python path
app_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, app_dir)

# Database and Redis connection check functions
def check_database_connection():
    """Check if database connection is working"""
    try:
        # Use Unix socket connection for peer authentication
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', '/var/run/postgresql'),
            database=os.getenv('DB_NAME', 'schlep_engine'),
            user=os.getenv('DB_USER', 'postgres'),
            connect_timeout=5
        )
        conn.close()
        return "connected"
    except Exception as e:
        print(f"Database connection error: {e}")
        return "error"

def check_redis_connection():
    """Check if Redis connection is working"""
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        r = redis.from_url(redis_url, socket_timeout=5)
        r.ping()
        return "connected"
    except Exception as e:
        print(f"Redis connection error: {e}")
        return "error"

# Initialize FastAPI app
app = FastAPI(
    title="Schlep Engine API",
    description="AI-powered data processing and ML pipeline platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if os.getenv("DEBUG", "false").lower() == "true" else "An error occurred"
        }
    )

# Health check endpoints
@app.get("/")
async def root():
    return {
        "message": "Schlep Engine API",
        "status": "operational",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "schlep-engine-api",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": os.getenv("ENVIRONMENT", "production")
    }

# API status endpoint
@app.get("/api/v1/status")
async def api_status():
    return {
        "api_status": "operational",
        "version": "1.0.0",
        "features": {
            "authentication": "available",
            "data_processing": "available", 
            "ml_pipeline": "available",
            "document_extraction": "available",
            "analytics": "available"
        },
        "database_status": check_database_connection(),
        "redis_status": check_redis_connection(),
        "timestamp": datetime.utcnow().isoformat()
    }

# Simple auth status endpoint
@app.get("/api/v1/auth/status")
async def auth_status():
    return {
        "status": "available",
        "providers": ["email", "google", "github"],
        "features": ["signup", "login", "password_reset", "oauth"]
    }

# Data processing status
@app.get("/api/v1/data/status")
async def data_processing_status():
    return {
        "status": "available",
        "features": [
            "file_upload",
            "data_validation", 
            "data_cleaning",
            "transformation",
            "export"
        ],
        "supported_formats": ["CSV", "JSON", "Excel", "PDF", "Images"]
    }

# ML pipeline status  
@app.get("/api/v1/ml/status")
async def ml_pipeline_status():
    return {
        "status": "available",
        "features": [
            "auto_ml",
            "model_training",
            "predictions",
            "model_management"
        ],
        "algorithms": ["classification", "regression", "clustering", "deep_learning"]
    }

# Analytics endpoint
@app.get("/api/v1/analytics/summary")
async def analytics_summary():
    return {
        "status": "operational",
        "metrics": {
            "total_users": 0,
            "total_datasets": 0,
            "total_models": 0,
            "api_calls_today": 0
        },
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting Schlep Engine API on {host}:{port}")
    print(f"📊 Environment: {os.getenv('ENVIRONMENT', 'production')}")
    print(f"📝 Documentation: http://{host}:{port}/docs")
    
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        reload=False,
        access_log=True
    )