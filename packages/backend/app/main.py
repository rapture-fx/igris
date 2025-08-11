"""
Main FastAPI application for Schlep-engine
Integrates all monitoring and observability components
"""

import os
import sys
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uvicorn

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.logging_config import setup_logging, get_logger
from app.core.error_tracking import error_tracker, capture_exception, ErrorSeverity, ErrorCategory
from app.core.metrics import metrics_collector, record_system_metrics
from app.middleware.monitoring_middleware import create_monitoring_middleware
from app.middleware.rate_limiting_middleware import RateLimitingMiddleware
from app.middleware.audit_middleware import AuditMiddleware
from app.middleware.encryption_middleware import EncryptionMiddleware
from app.middleware.request_validation_middleware import RequestValidationMiddleware
from app.middleware.csrf_middleware import CSRFMiddleware
from app.database.connection import engine, Base
from app.api.v1 import (
    auth, users, data_processing, ml_pipeline, storage, 
    health, metrics, admin, advanced_ai, advanced_ml
)

# Import the new API-as-a-Service routers
from app.api.v1.dpa_compliance import router as dpa_compliance_router
from app.api.v1.api_status import router as api_status_router
from app.api.v1.debug import router as debug_router

# Setup logging
setup_logging(
    log_level=getattr(settings, 'LOG_LEVEL', 'INFO'),
    log_file=getattr(settings, 'LOG_FILE', 'logs/app.log'),
    enable_console=True,
    enable_file=True,
    enable_json=True,
    enable_structured=True
)

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Schlep-engine application...")
    
    try:
        # Create database tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        
        # Initialize error tracking
        logger.info("Error tracking system initialized")
        
        # Initialize metrics collection
        logger.info("Metrics collection system initialized")
        
        # Record application startup
        metrics_collector.record_business_event("application_startup")
        
        logger.info("Schlep-engine application started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        capture_exception(
            e,
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.SYSTEM,
            extra_data={"event": "application_startup"}
        )
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Schlep-engine application...")
    
    try:
        # Record application shutdown
        metrics_collector.record_business_event("application_shutdown")
        
        logger.info("Schlep-engine application shut down successfully")
        
    except Exception as e:
        logger.error(f"Error during application shutdown: {e}")
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            extra_data={"event": "application_shutdown"}
        )

# Create FastAPI application
app = FastAPI(
    title="Schlep-engine API",
    description="Comprehensive data processing and ML pipeline platform",
    version=getattr(settings, 'APP_VERSION', '1.0.0'),
    docs_url="/docs" if getattr(settings, 'ENVIRONMENT', 'development') != 'production' else None,
    redoc_url="/redoc" if getattr(settings, 'ENVIRONMENT', 'development') != 'production' else None,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=getattr(settings, 'ALLOWED_ORIGINS', ['http://localhost:3000']),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=getattr(settings, 'ALLOWED_HOSTS', ['*'])
)

# Add monitoring middleware
app = create_monitoring_middleware(app)

# Add security middleware
app.add_middleware(RateLimitingMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(EncryptionMiddleware)
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(CSRFMiddleware)

# Global exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    logger.warning(
        f"Validation error: {exc.errors()}",
        extra={
            "validation_errors": exc.errors(),
            "request_path": str(request.url.path),
            "request_method": request.method
        }
    )
    
    # Record validation error metrics
    metrics_collector.record_http_request(
        method=request.method,
        endpoint=str(request.url.path),
        status_code=422,
        duration=0.0,
        user_type="anonymous"
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": exc.errors()
        }
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions"""
    logger.warning(
        f"HTTP exception: {exc.status_code} - {exc.detail}",
        extra={
            "status_code": exc.status_code,
            "detail": exc.detail,
            "request_path": str(request.url.path),
            "request_method": request.method
        }
    )
    
    # Record HTTP exception metrics
    metrics_collector.record_http_request(
        method=request.method,
        endpoint=str(request.url.path),
        status_code=exc.status_code,
        duration=0.0,
        user_type="anonymous"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=True,
        extra={
            "request_path": str(request.url.path),
            "request_method": request.method,
            "exception_type": type(exc).__name__
        }
    )
    
    # Capture exception for error tracking
    capture_exception(
        exc,
        severity=ErrorSeverity.HIGH,
        category=ErrorCategory.SYSTEM,
        extra_data={
            "request_path": str(request.url.path),
            "request_method": request.method
        }
    )
    
    # Record error metrics
    metrics_collector.record_http_request(
        method=request.method,
        endpoint=str(request.url.path),
        status_code=500,
        duration=0.0,
        user_type="anonymous"
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )

# Include API routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(data_processing.router, prefix="/api/v1/data", tags=["Data Processing"])
app.include_router(ml_pipeline.router, prefix="/api/v1/ml", tags=["ML Pipeline"])
app.include_router(storage.router, prefix="/api/v1/storage", tags=["Storage"])
app.include_router(health.router, prefix="/api/v1", tags=["Health & Monitoring"])
app.include_router(metrics.router, prefix="/api/v1", tags=["Health & Monitoring"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(advanced_ai.router, prefix="/api/v1/ai", tags=["Advanced AI"])
app.include_router(advanced_ml.router, prefix="/api/v1/advanced-ml", tags=["Advanced ML"])
app.include_router(dpa_compliance_router, prefix="/api/v1")

# Include new API-as-a-Service routers
app.include_router(api_status_router, prefix="/api/v1", tags=["API Status & Monitoring"])
app.include_router(debug_router, prefix="/api/v1", tags=["Debug & Testing"])

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with application information"""
    return {
        "message": "Welcome to Schlep-engine API",
        "version": getattr(settings, 'APP_VERSION', '1.0.0'),
        "environment": getattr(settings, 'ENVIRONMENT', 'development'),
        "status": "running",
        "documentation": "/docs",
        "health": "/api/v1/health",
        "metrics": "/api/v1/metrics"
    }

# Health check endpoint (simple)
@app.get("/health", tags=["Health"])
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "service": "schlep-engine"}

# Metrics endpoint
@app.get("/metrics", tags=["Metrics"])
async def metrics():
    """Prometheus metrics endpoint"""
    from app.core.metrics import get_metrics, get_metrics_content_type
    
    try:
        metrics_data = get_metrics()
        return Response(
            content=metrics_data,
            media_type=get_metrics_content_type()
        )
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            extra_data={"endpoint": "/metrics"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics"
        )

# System information endpoint
@app.get("/system/info", tags=["System"])
async def system_info():
    """System information endpoint"""
    import psutil
    
    try:
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()
        
        # Record system metrics
        record_system_metrics(
            cpu_usage=cpu_percent,
            memory_usage=memory.used,
            disk_usage=disk.used,
            network_bytes_sent=network.bytes_sent,
            network_bytes_recv=network.bytes_recv
        )
        
        return {
            "system": {
                "cpu_usage_percent": cpu_percent,
                "memory_usage_percent": memory.percent,
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "disk_usage_percent": disk.percent,
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "network_bytes_sent": network.bytes_sent,
                "network_bytes_recv": network.bytes_recv
            },
            "application": {
                "version": getattr(settings, 'APP_VERSION', '1.0.0'),
                "environment": getattr(settings, 'ENVIRONMENT', 'development'),
                "uptime": "running"  # This would be calculated from startup time
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get system info: {e}")
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            extra_data={"endpoint": "/system/info"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system information"
        )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info("Application startup event triggered")
    
    # Record startup metrics
    metrics_collector.record_business_event("application_startup")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    logger.info("Application shutdown event triggered")
    
    # Record shutdown metrics
    metrics_collector.record_business_event("application_shutdown")

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "app.main:app",
        host=getattr(settings, 'HOST', '0.0.0.0'),
        port=getattr(settings, 'PORT', 8000),
        reload=getattr(settings, 'ENVIRONMENT', 'development') == 'development',
        log_level=getattr(settings, 'LOG_LEVEL', 'INFO').lower()
    )