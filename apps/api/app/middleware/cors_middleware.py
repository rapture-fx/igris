"""
Dynamic CORS Middleware

This middleware provides environment-specific CORS configuration with security validation.
It enforces HTTPS-only origins in production and staging environments.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import logging
from typing import List

from app.core.unified_config import settings

logger = logging.getLogger(__name__)


class DynamicCORSMiddleware(BaseHTTPMiddleware):
    """
    Dynamic CORS middleware that adapts to the environment.
    
    Features:
    - Environment-specific CORS origins
    - HTTPS enforcement in production/staging
    - Security headers
    - Request logging for CORS violations
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self.allowed_origins = settings.secure_cors_origins
        self.allow_credentials = settings.cors_allow_credentials
        
        logger.info(f"CORS middleware initialized for {settings.ENVIRONMENT} environment")
        logger.info(f"Allowed origins: {self.allowed_origins}")
        logger.info(f"Allow credentials: {self.allow_credentials}")
    
    async def dispatch(self, request: Request, call_next):
        """Process request with CORS validation."""
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            return await self._handle_preflight(request)
        
        # Add CORS headers to response
        response = await call_next(request)
        return await self._add_cors_headers(request, response)
    
    async def _handle_preflight(self, request: Request) -> Response:
        """Handle CORS preflight requests."""
        origin = request.headers.get("origin")
        
        if origin and origin in self.allowed_origins:
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Requested-With",
                    "Access-Control-Allow-Credentials": str(self.allow_credentials).lower(),
                    "Access-Control-Max-Age": "86400",  # 24 hours
                }
            )
        else:
            logger.warning(f"CORS preflight rejected for origin: {origin}")
            return Response(status_code=403)
    
    async def _add_cors_headers(self, request: Request, response: Response) -> Response:
        """Add CORS headers to response."""
        origin = request.headers.get("origin")
        
        if origin and origin in self.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = str(self.allow_credentials).lower()
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Add CSP header in production/staging
        if settings.ENVIRONMENT.value in ["staging", "production"]:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self' https:; "
                "frame-ancestors 'none';"
            )
        
        return response


def setup_cors_middleware(app: FastAPI) -> None:
    """
    Set up CORS middleware for the FastAPI application.
    
    This function configures both the standard FastAPI CORS middleware
    and our custom dynamic CORS middleware for additional security.
    """
    
    # Add standard FastAPI CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.secure_cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=[
            "Content-Type", 
            "Authorization", 
            "X-API-Key", 
            "X-Requested-With",
            "Accept",
            "Origin"
        ],
        expose_headers=["X-Total-Count", "X-Page-Count"],
        max_age=86400,  # 24 hours
    )
    
    # Add custom dynamic CORS middleware for additional security
    app.add_middleware(DynamicCORSMiddleware)
    
    logger.info("CORS middleware setup complete")


def validate_cors_origins(origins: List[str], environment: str) -> List[str]:
    """
    Validate CORS origins based on environment security requirements.
    
    Args:
        origins: List of CORS origins to validate
        environment: Current environment (development, staging, production)
    
    Returns:
        List of validated origins
    """
    validated_origins = []
    
    for origin in origins:
        if origin == "null":
            validated_origins.append(origin)
            continue
        
        # Validate origin format
        if not origin.startswith(("http://", "https://")):
            logger.warning(f"Invalid CORS origin format: {origin}")
            continue
        
        # Enforce HTTPS in production/staging
        if environment in ["staging", "production"]:
            if not origin.startswith("https://"):
                logger.warning(f"Non-HTTPS origin rejected in {environment}: {origin}")
                continue
        
        validated_origins.append(origin)
    
    return validated_origins 