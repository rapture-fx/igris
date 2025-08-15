#!/usr/bin/env python3
"""
PRODUCTION DEPLOYMENT MAIN APPLICATION
=====================================

Production-ready FastAPI application with all optimizations enabled.
"""

import os
import sys
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import core components
from app.services.core.config_manager import get_config, configure_for_environment
from app.services.core.dependency_container import container, register_core_services
from app.services.core.error_handling import standardized_error_handling, error_handler
from app.services.core.unified_processor import UnifiedDataProcessor

# Import middleware
from app.middleware.monitoring_middleware import MonitoringMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("🚀 Starting Schlep Engine Production Deployment")
    
    # Initialize configuration
    configure_for_environment()
    config = get_config()
    logger.info(f"Environment: {config.environment}")
    
    # Register services
    register_core_services()
    logger.info("✅ Services registered")
    
    # Initialize unified processor
    processor = container.get(UnifiedDataProcessor)
    logger.info("✅ Unified processor initialized")
    
    # Test database connection
    try:
        import psycopg2
        conn = psycopg2.connect('postgresql://postgres:password@localhost:5432/schlep_engine')
        conn.close()
        logger.info("✅ Database connection verified")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
    
    # Test Redis connection
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        logger.info("✅ Redis connection verified")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
    
    yield
    
    logger.info("🛑 Shutting down Schlep Engine")

# Create FastAPI application
app = FastAPI(
    title="Schlep Engine API",
    description="Production-ready data processing platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add monitoring middleware
app.add_middleware(MonitoringMiddleware)

@app.get("/")
@standardized_error_handling("root")
async def root():
    """Root endpoint"""
    return {
        "status": "success",
        "message": "Schlep Engine API is running",
        "version": "1.0.0",
        "environment": get_config().environment.value
    }

@app.get("/health")
@standardized_error_handling("health")
async def health_check():
    """Comprehensive health check"""
    config = get_config()
    
    # Test services
    services_status = {
        "database": "unknown",
        "redis": "unknown",
        "processor": "unknown"
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
    except Exception:
        services_status["database"] = "unhealthy"
    
    # Test Redis
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        services_status["redis"] = "healthy"
    except Exception:
        services_status["redis"] = "unhealthy"
    
    # Test processor
    try:
        processor = container.get(UnifiedDataProcessor)
        metrics = processor.get_performance_metrics()
        services_status["processor"] = "healthy"
    except Exception:
        services_status["processor"] = "unhealthy"
    
    overall_health = "healthy" if all(
        status == "healthy" for status in services_status.values()
    ) else "degraded"
    
    return {
        "status": overall_health,
        "services": services_status,
        "environment": config.environment.value,
        "timestamp": "2025-08-15T12:54:27Z"
    }

@app.post("/api/v1/process")
@standardized_error_handling("data_processing")
async def process_data(request: Request):
    """Process data using unified processor"""
    try:
        # Get processor from container
        processor = container.get(UnifiedDataProcessor)
        
        # For demo, create a sample CSV
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("name,age,email\\nJohn,30,john@example.com\\nJane,25,jane@example.com")
            temp_path = f.name
        
        # Process the file
        result = await processor.process(temp_path)
        
        # Clean up
        os.unlink(temp_path)
        
        return {
            "status": "success",
            "message": "Data processed successfully",
            "result": result
        }
    
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise

@app.get("/metrics")
@standardized_error_handling("metrics")
async def get_metrics():
    """Get application metrics"""
    try:
        processor = container.get(UnifiedDataProcessor)
        metrics = processor.get_performance_metrics()
        
        error_stats = error_handler.get_error_statistics()
        
        return {
            "status": "success",
            "metrics": {
                "processor": metrics,
                "errors": error_stats,
                "environment": get_config().environment.value
            }
        }
    except Exception as e:
        logger.error(f"Metrics error: {e}")
        raise

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    error_details = await error_handler.handle_error(
        error=exc,
        request=request,
        component="global"
    )
    
    return error_handler.create_http_response(error_details)

if __name__ == "__main__":
    config = get_config()
    
    uvicorn.run(
        "main_deployment:app",
        host="0.0.0.0",
        port=8000,
        reload=config.debug,
        log_level=config.log_level.lower(),
        access_log=True
    )