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
from app.middleware.request_validation_sanitization import RequestValidationSanitizationMiddleware
from app.middleware.csrf_protection import CSRFProtectionMiddleware
from app.auth.enhanced_security import SecurityLevel
from app.database.connection import engine, Base
# Import only core working modules for now
from app.api.v1 import (
    auth, users, ml_pipeline, storage, 
    health, metrics, admin, document_extraction, validation,
    data_quality, rl_optimization  # Re-enabled - syntax issues resolved
)

# Import safe API services to enable
from app.api.v1 import (
    analytics, billing, community, enterprise, marketplace,
    security_admin, semantic_insights, websocket_manager, partner, cost_monitoring,
    lemonsqueezy_webhooks
)
# Re-enabled core functionality - dependencies now working
from app.api.v1 import data_processing, advanced_ai, advanced_ml

# Import the new API-as-a-Service routers
from app.api.v1.dpa_compliance import router as dpa_compliance_router
from app.api.v1.debug import router as debug_router
from app.api.v1.api_status import router as api_status_router
from app.api.v1.industry_solutions import router as industry_solutions_router
from app.api.v1.feedback_learning import router as feedback_learning_router

# Import real-time streaming routers
from app.api.v1.real_time_streaming import router as streaming_router

# Import Advanced Model Serving APIs
from app.api.v1.model_serving import router as model_serving_router

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
        # Create database tables if database is available
        if engine is not None:
            try:
                Base.metadata.create_all(bind=engine)
                logger.info("Database tables created successfully")
            except Exception as db_error:
                logger.warning(f"Database connection failed: {db_error}")
                logger.info("Continuing without database - API will run in standalone mode")
        else:
            logger.info("Database not available - running without database")
        
        # Initialize error tracking
        logger.info("Error tracking system initialized")
        
        # Initialize metrics collection
        logger.info("Metrics collection system initialized")
        
        # Initialize real-time streaming system if enabled
        enable_streaming = os.getenv('ENABLE_STREAM_PRODUCERS', 'false').lower() == 'true'
        if enable_streaming:
            try:
                # Initialize streaming services
                from app.services.real_time_notifications import initialize_notification_system
                from app.services.stream_consumers import start_stream_consumers
                from app.core.event_sourcing import get_event_bus
                
                # Initialize event sourcing
                await get_event_bus()
                logger.info("Event sourcing system initialized")
                
                # Initialize notifications
                await initialize_notification_system()
                logger.info("Notification system initialized")
                
                # Initialize stream consumers
                await start_stream_consumers()
                logger.info("Stream consumers initialized")
                
                logger.info("Real-time streaming system initialized successfully")
                
            except Exception as streaming_error:
                logger.warning(f"Failed to initialize streaming system: {streaming_error}")
                logger.info("Continuing without real-time streaming features")
        
        # Initialize Advanced Model Serving Platform
        enable_model_serving = os.getenv('ENABLE_MODEL_SERVING', 'true').lower() == 'true'
        if enable_model_serving:
            try:
                from app.services.model_serving_initializer import initialize_model_serving_platform
                from app.core.database import get_db
                
                # Initialize model serving platform
                db = next(get_db())
                init_result = await initialize_model_serving_platform(db)
                
                if init_result.get('ready'):
                    logger.info("Advanced Model Serving Platform initialized successfully")
                    logger.info(f"Platform components: {list(init_result.get('components', {}).keys())}")
                else:
                    logger.warning(f"Model Serving Platform initialization incomplete: {init_result.get('status')}")
                
            except Exception as serving_error:
                logger.warning(f"Failed to initialize Model Serving Platform: {serving_error}")
                logger.info("Continuing without advanced model serving features")
        
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
        # Shutdown streaming services if they were initialized
        enable_streaming = os.getenv('ENABLE_STREAM_PRODUCERS', 'false').lower() == 'true'
        if enable_streaming:
            try:
                from app.services.real_time_notifications import shutdown_notification_system
                from app.services.stream_processing_pipelines import stop_stream_processing
                
                # Shutdown notification system
                await shutdown_notification_system()
                logger.info("Notification system shutdown")
                
                # Stop stream processing
                stop_stream_processing()
                logger.info("Stream processing stopped")
                
                logger.info("Real-time streaming system shutdown successfully")
                
            except Exception as streaming_error:
                logger.warning(f"Error shutting down streaming system: {streaming_error}")
        
        # Shutdown Advanced Model Serving Platform
        enable_model_serving = os.getenv('ENABLE_MODEL_SERVING', 'true').lower() == 'true'
        if enable_model_serving:
            try:
                from app.services.model_serving_initializer import shutdown_model_serving_platform
                
                # Shutdown model serving platform
                await shutdown_model_serving_platform()
                logger.info("Advanced Model Serving Platform shutdown successfully")
                
            except Exception as serving_error:
                logger.warning(f"Error shutting down Model Serving Platform: {serving_error}")
        
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

# Add monitoring middleware - temporarily disabled due to middleware conflicts
# app = create_monitoring_middleware(app)

# Add security middleware (re-enabled with error handling)
try:
    app.add_middleware(RequestValidationSanitizationMiddleware)
    logger.info("Request validation middleware enabled")
except Exception as e:
    logger.warning(f"Failed to enable request validation middleware: {e}")

# CRITICAL: Rate limiting middleware must be enabled for security
try:
    # Enhanced rate limiting configuration with user-based limits
    from app.middleware.rate_limiting_middleware import RateLimitingMiddleware, RateLimitConfig, RateLimitType

    # Create enhanced rate limiting configuration
    rate_limit_config = RateLimitConfig(
        requests_per_minute=100,  # Base IP limit
        requests_per_hour=1000,
        rate_limit_type=RateLimitType.IP_BASED,
        bypass_for_admin=True,
        security_level_multipliers={
            SecurityLevel.LOW: 2.0,      # More permissive for low-security endpoints
            SecurityLevel.MEDIUM: 1.0,   # Default
            SecurityLevel.HIGH: 0.5,     # More restrictive for high-security endpoints
            SecurityLevel.CRITICAL: 0.2  # Very restrictive for critical endpoints
        }
    )

    # Enhanced path-specific configurations
    path_configs = {
        "/api/v1/auth": RateLimitConfig(
            requests_per_minute=10,
            requests_per_hour=50,
            rate_limit_type=RateLimitType.IP_BASED,
            bypass_for_admin=False,
            error_message="Authentication rate limit exceeded"
        ),
        "/api/v1/ml": RateLimitConfig(
            requests_per_minute=20,
            requests_per_hour=200,
            rate_limit_type=RateLimitType.USER_BASED,
            bypass_for_admin=True,
            error_message="ML endpoint rate limit exceeded"
        ),
        "/api/v1/rl": RateLimitConfig(
            requests_per_minute=5,
            requests_per_hour=50,
            rate_limit_type=RateLimitType.USER_BASED,
            bypass_for_admin=True,
            error_message="RL endpoint rate limit exceeded"
        ),
        "/api/v1/admin": RateLimitConfig(
            requests_per_minute=30,
            requests_per_hour=300,
            rate_limit_type=RateLimitType.USER_BASED,
            bypass_for_admin=False,  # Even admins are rate limited
            error_message="Admin endpoint rate limit exceeded"
        )
    }

    app.add_middleware(
        RateLimitingMiddleware,
        enabled=True,
        default_config=rate_limit_config,
        path_configs=path_configs,
        exclude_paths={'/health', '/metrics', '/docs', '/openapi.json', '/system/info'}
    )
    logger.info("Enhanced rate limiting middleware enabled with user-based limits")

except ImportError as ie:
    logger.error(f"Rate limiting middleware import failed: {ie}")
    if settings.ENVIRONMENT == "production":
        logger.critical("SECURITY CRITICAL: Rate limiting middleware failed to import in production!")
        raise RuntimeError("Rate limiting middleware is required for production deployment")
    else:
        logger.warning("Rate limiting disabled in development mode due to import error")

except Exception as e:
    logger.error(f"Failed to enable rate limiting middleware: {e}")
    if settings.ENVIRONMENT == "production":
        logger.critical("SECURITY CRITICAL: Rate limiting middleware failed to initialize in production!")
        # In production, fail hard rather than continue without rate limiting
        capture_exception(
            e,
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.SECURITY,
            extra_data={"middleware": "rate_limiting", "environment": settings.ENVIRONMENT}
        )
        raise RuntimeError("Rate limiting middleware is critical for production security")
    else:
        logger.warning("Rate limiting disabled in development mode")

try:
    app.add_middleware(AuditMiddleware)
    logger.info("Audit middleware enabled")
except Exception as e:
    logger.warning(f"Failed to enable audit middleware: {e}")

# TODO: Re-enable when encryption dependencies are resolved
# try:
#     app.add_middleware(EncryptionMiddleware)
#     logger.info("Encryption middleware enabled")
# except Exception as e:
#     logger.warning(f"Failed to enable encryption middleware: {e}")

# Enable CSRF protection for production
try:
    if settings.ENVIRONMENT == "production":
        app.add_middleware(CSRFProtectionMiddleware)
        logger.info("CSRF protection middleware enabled")
    else:
        logger.info("CSRF protection disabled in development")
except Exception as e:
    logger.warning(f"Failed to enable CSRF protection middleware: {e}")

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

# Include core API routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(ml_pipeline.router, prefix="/api/v1/ml", tags=["ML Pipeline"])
app.include_router(storage.router, prefix="/api/v1/storage", tags=["Storage"])
app.include_router(document_extraction.router, prefix="/api/v1/extract", tags=["Document Extraction"])
app.include_router(data_quality.router, prefix="/api/v1/quality", tags=["Data Quality & Preparation"])
app.include_router(validation.router, prefix="/api/v1/validation", tags=["Use Case Validation"])
app.include_router(health.router, prefix="/api/v1", tags=["Health & Monitoring"])
app.include_router(metrics.router, prefix="/api/v1", tags=["Health & Monitoring"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(data_processing.router, prefix="/api/v1/data", tags=["Data Processing"])
app.include_router(advanced_ai.router, prefix="/api/v1/ai", tags=["Advanced AI"])
app.include_router(advanced_ml.router, prefix="/api/v1/advanced-ml", tags=["Advanced ML"])
app.include_router(rl_optimization.router, prefix="/api/v1", tags=["RL Optimization"])
app.include_router(dpa_compliance_router, prefix="/api/v1", tags=["DPA Compliance"])

# Include new API-as-a-Service routers
app.include_router(api_status_router, prefix="/api/v1", tags=["API Status & Monitoring"])
app.include_router(debug_router, prefix="/api/v1", tags=["Debug & Testing"])

# Include safe API services
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics & Monitoring"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["Billing & Usage"])
app.include_router(community.router, prefix="/api/v1/community", tags=["Community Features"])
app.include_router(enterprise.router, tags=["Enterprise Features"])  # Already has prefix in router
app.include_router(marketplace.router, prefix="/api/v1/marketplace", tags=["Marketplace"])

# Include Dataset Marketplace
try:
    from app.api.v1.dataset_marketplace import router as dataset_marketplace_router
    app.include_router(dataset_marketplace_router, tags=["Dataset Marketplace"])
    logger.info("Dataset Marketplace API endpoints enabled")
except ImportError as e:
    logger.warning(f"Dataset Marketplace endpoints not available: {e}")
app.include_router(security_admin.router, prefix="/api/v1/security-admin", tags=["Security Administration"])
app.include_router(semantic_insights.router, prefix="/api/v1/semantic", tags=["Semantic Insights"])
app.include_router(websocket_manager.router, prefix="/api/v1/websocket", tags=["WebSocket Manager"])
app.include_router(partner.router, prefix="/api/v1/partner", tags=["Partner APIs"])
app.include_router(cost_monitoring.router, prefix="/api/v1/cost", tags=["Cost Monitoring"])
app.include_router(lemonsqueezy_webhooks.router, prefix="/api/v1/webhooks", tags=["LemonSqueezy Webhooks"])
app.include_router(feedback_learning_router, prefix="/api/v1/feedback", tags=["Feedback Learning"])
app.include_router(industry_solutions_router, prefix="/api/v1/industry", tags=["Industry Solutions"])

# Real-time streaming endpoints
app.include_router(streaming_router, prefix="/api/v1/streaming", tags=["Real-Time Streaming"])

# Advanced Model Serving endpoints
app.include_router(model_serving_router, prefix="/api/v1/serving", tags=["Model Serving"])

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

# Model Serving Platform Status endpoint
@app.get("/api/v1/serving/platform/status", tags=["Model Serving"])
async def model_serving_platform_status():
    """Get Model Serving Platform status"""
    try:
        from app.services.model_serving_initializer import get_platform_status
        return get_platform_status()
    except Exception as e:
        return {"error": str(e), "initialized": False}

# Model Serving Platform Health Check endpoint
@app.get("/api/v1/serving/platform/health", tags=["Model Serving"])
async def model_serving_platform_health():
    """Get Model Serving Platform health check"""
    try:
        from app.services.model_serving_initializer import platform_health_check
        return await platform_health_check()
    except Exception as e:
        return {"overall_status": "error", "error": str(e)}

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