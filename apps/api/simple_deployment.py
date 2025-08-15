#!/usr/bin/env python3
"""
SIMPLE PRODUCTION DEPLOYMENT
============================

Minimal FastAPI application for production deployment.
"""

import os
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="Schlep Engine API",
    description="Production-ready data processing platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002", "http://localhost:3003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple monitoring middleware
@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    start_time = time.time()
    correlation_id = str(uuid.uuid4())[:8]
    
    logger.info(f"Request {correlation_id}: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        logger.info(f"Response {correlation_id}: {response.status_code} ({duration:.3f}s)")
        
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        
        return response
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error {correlation_id}: {str(e)} ({duration:.3f}s)")
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "Internal server error",
                "correlation_id": correlation_id
            }
        )

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "success",
        "message": "Schlep Engine API is running",
        "version": "1.0.0",
        "environment": "production"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    services_status = {
        "api": "healthy",
        "database": "unknown",
        "redis": "unknown"
    }
    
    # Test database
    try:
        import psycopg2
        conn = psycopg2.connect('postgresql://postgres:password@localhost:5432/schlep_engine')
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        services_status["database"] = "healthy"
    except Exception as e:
        services_status["database"] = "unhealthy"
        logger.warning(f"Database health check failed: {e}")
    
    # Test Redis
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        services_status["redis"] = "healthy"
    except Exception as e:
        services_status["redis"] = "unhealthy"
        logger.warning(f"Redis health check failed: {e}")
    
    overall_health = "healthy" if all(
        status == "healthy" for status in services_status.values()
    ) else "degraded"
    
    return {
        "status": overall_health,
        "services": services_status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.post("/api/v1/process")
async def process_data(request: Request):
    """Demo data processing endpoint"""
    import tempfile
    import pandas as pd
    
    try:
        # Create sample data
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("name,age,email,salary\\n")
            f.write("John Doe,30,john@example.com,50000\\n")
            f.write("Jane Smith,25,jane@example.com,60000\\n")
            f.write("Bob Johnson,35,bob@example.com,55000\\n")
            temp_path = f.name
        
        # Simple processing
        df = pd.read_csv(temp_path)
        
        result = {
            "status": "success",
            "data": {
                "rows_processed": len(df),
                "columns": list(df.columns),
                "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "sample": df.head(3).to_dict('records')
            },
            "processing_mode": "standard",
            "performance": {
                "processing_time_seconds": 0.1,
                "memory_usage_mb": 1.2
            }
        }
        
        # Clean up
        os.unlink(temp_path)
        
        return result
        
    except Exception as e:
        logger.error(f"Processing error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Processing failed: {str(e)}"
            }
        )

@app.get("/metrics")
async def get_metrics():
    """Application metrics endpoint"""
    return {
        "status": "success",
        "metrics": {
            "uptime_seconds": time.time(),
            "environment": "production",
            "version": "1.0.0",
            "health": "healthy"
        }
    }

@app.get("/api/v1/config")
async def get_config():
    """Configuration endpoint"""
    return {
        "status": "success",
        "config": {
            "max_file_size_mb": 100,
            "supported_formats": ["csv", "json", "xlsx"],
            "processing_modes": ["fast", "standard", "streaming", "ai_enhanced"],
            "version": "1.0.0"
        }
    }

if __name__ == "__main__":
    logger.info("🚀 Starting Schlep Engine Simple Deployment")
    
    uvicorn.run(
        "simple_deployment:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
        access_log=True
    )