"""
Global Exception Middleware
==========================

Catches all unhandled exceptions and ensures they go through the standardized error handler
This is the last line of defense to ensure no exceptions escape without proper handling.
"""

import logging
import traceback
from typing import Callable, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.error_handler import unified_error_handler

logger = logging.getLogger(__name__)

class GlobalExceptionMiddleware(BaseHTTPMiddleware):
    """
    Global exception middleware that catches all unhandled exceptions
    and processes them through the standardized error handling system.
    """
    
    def __init__(self, app, debug: bool = False):
        super().__init__(app)
        self.debug = debug
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process the request and catch any unhandled exceptions.
        """
        try:
            # Process the request
            response = await call_next(request)
            return response
            
        except Exception as e:
            # Log the unhandled exception
            logger.error(
                f"Unhandled exception in {request.method} {request.url.path}: {str(e)}\n"
                f"Traceback:\n{traceback.format_exc()}"
            )
            
            # Use unified error handler to process the exception
            error_details = await unified_error_handler.handle_error(
                error=e,
                request=request,
                component="global_middleware",
                endpoint=request.url.path,
                method=request.method,
                unhandled=True
            )
            
            # Create standardized error response
            response = unified_error_handler.create_http_response(error_details)
            
            # Add additional headers for debugging if in debug mode
            if self.debug:
                response.headers["X-Debug-Error-ID"] = error_details.error_id
                response.headers["X-Debug-Component"] = "global_middleware"
            
            return response

# Pre-configured middleware instances
def create_exception_middleware(debug: bool = False) -> GlobalExceptionMiddleware:
    """
    Factory function to create the exception middleware.
    
    Args:
        debug: Whether to include debug information in responses
    
    Returns:
        Configured GlobalExceptionMiddleware instance
    """
    return GlobalExceptionMiddleware(None, debug=debug)

# Export for use in main.py
__all__ = ['GlobalExceptionMiddleware', 'create_exception_middleware'] 