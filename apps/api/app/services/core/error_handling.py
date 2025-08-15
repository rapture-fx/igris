"""
STANDARDIZED ERROR HANDLING
==========================

Provides consistent error handling across all API endpoints and services.

This eliminates:
- Inconsistent error response formats
- Missing error tracking
- Poor user experience with cryptic errors
- Debugging difficulties
"""

import logging
import traceback
import uuid
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional, Union
import asyncio

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class ErrorDetails(BaseModel):
    """Standardized error details"""
    error_id: str
    timestamp: datetime
    error_type: str
    message: str
    user_message: str
    component: str
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    user_id: Optional[str] = None
    stack_trace: Optional[str] = None

class ErrorResponse(BaseModel):
    """Standardized API error response"""
    status: str = "error"
    error_id: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime
    
class UnifiedErrorHandler:
    """
    Centralized error handling and logging system.
    
    Features:
    - Consistent error response format
    - Automatic error tracking and correlation
    - User-friendly error messages
    - Developer debugging information
    - Performance impact monitoring
    """
    
    def __init__(self):
        self.error_counts: Dict[str, int] = {}
        self.user_friendly_messages = {
            'FileNotFoundError': 'The requested file could not be found.',
            'PermissionError': 'You do not have permission to access this resource.',
            'ValidationError': 'The provided data is invalid. Please check your input.',
            'DatabaseError': 'A database error occurred. Please try again later.',
            'AuthenticationError': 'Authentication failed. Please check your credentials.',
            'RateLimitError': 'Too many requests. Please slow down and try again.',
            'ProcessingError': 'Data processing failed. Please check your file format.',
            'ConnectionError': 'Connection failed. Please check your network and try again.',
            'TimeoutError': 'The operation took too long. Please try again.',
            'ValueError': 'Invalid input provided. Please check your data.',
            'KeyError': 'Required field is missing from the request.',
            'TypeError': 'Invalid data type provided.',
        }
    
    async def handle_error(
        self, 
        error: Exception, 
        request: Optional[Request] = None,
        component: str = "unknown",
        user_id: Optional[str] = None
    ) -> ErrorDetails:
        """
        Handle any error and return standardized error details.
        
        Args:
            error: The exception that occurred
            request: FastAPI request object (if available)
            component: Component/service where error occurred
            user_id: User ID (if available)
            
        Returns:
            ErrorDetails object with all error information
        """
        
        # Generate unique error ID for tracking
        error_id = str(uuid.uuid4())[:8]
        
        # Get error type and message
        error_type = type(error).__name__
        error_message = str(error)
        
        # Get user-friendly message
        user_message = self.user_friendly_messages.get(
            error_type, 
            "An unexpected error occurred. Please try again."
        )
        
        # Extract request information
        request_path = None
        request_method = None
        if request:
            request_path = str(request.url.path)
            request_method = request.method
        
        # Create error details
        error_details = ErrorDetails(
            error_id=error_id,
            timestamp=datetime.utcnow(),
            error_type=error_type,
            message=error_message,
            user_message=user_message,
            component=component,
            request_path=request_path,
            request_method=request_method,
            user_id=user_id,
            stack_trace=traceback.format_exc()
        )
        
        # Log the error
        await self._log_error(error_details)
        
        # Update error statistics
        self._update_error_stats(error_type, component)
        
        return error_details
    
    async def _log_error(self, error_details: ErrorDetails):
        """Log error with structured format"""
        log_data = {
            "error_id": error_details.error_id,
            "error_type": error_details.error_type,
            "component": error_details.component,
            "message": error_details.message,
            "request_path": error_details.request_path,
            "request_method": error_details.request_method,
            "user_id": error_details.user_id,
            "timestamp": error_details.timestamp.isoformat()
        }
        
        # Log level based on error type
        if error_details.error_type in ['ValidationError', 'ValueError', 'KeyError']:
            logger.warning(f"Client error: {log_data}")
        elif error_details.error_type in ['FileNotFoundError', 'PermissionError']:
            logger.info(f"User error: {log_data}")
        else:
            logger.error(f"System error: {log_data}")
            # Also log stack trace for system errors
            logger.error(f"Stack trace for {error_details.error_id}: {error_details.stack_trace}")
    
    def _update_error_stats(self, error_type: str, component: str):
        """Update error statistics for monitoring"""
        key = f"{component}:{error_type}"
        self.error_counts[key] = self.error_counts.get(key, 0) + 1
    
    def create_http_response(self, error_details: ErrorDetails) -> JSONResponse:
        """Create standardized HTTP error response"""
        
        # Determine HTTP status code based on error type
        status_code = self._get_http_status_code(error_details.error_type)
        
        # Create response body
        response_body = ErrorResponse(
            error_id=error_details.error_id,
            message=error_details.user_message,
            timestamp=error_details.timestamp,
            details={
                "component": error_details.component,
                "error_type": error_details.error_type
            }
        )
        
        return JSONResponse(
            status_code=status_code,
            content=response_body.dict()
        )
    
    def _get_http_status_code(self, error_type: str) -> int:
        """Map error types to appropriate HTTP status codes"""
        status_map = {
            'ValidationError': status.HTTP_422_UNPROCESSABLE_ENTITY,
            'ValueError': status.HTTP_400_BAD_REQUEST,
            'KeyError': status.HTTP_400_BAD_REQUEST,
            'TypeError': status.HTTP_400_BAD_REQUEST,
            'FileNotFoundError': status.HTTP_404_NOT_FOUND,
            'PermissionError': status.HTTP_403_FORBIDDEN,
            'AuthenticationError': status.HTTP_401_UNAUTHORIZED,
            'RateLimitError': status.HTTP_429_TOO_MANY_REQUESTS,
            'ConnectionError': status.HTTP_503_SERVICE_UNAVAILABLE,
            'TimeoutError': status.HTTP_504_GATEWAY_TIMEOUT,
            'DatabaseError': status.HTTP_503_SERVICE_UNAVAILABLE,
        }
        
        return status_map.get(error_type, status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """Get error statistics for monitoring"""
        return {
            "total_errors": sum(self.error_counts.values()),
            "error_breakdown": dict(self.error_counts),
            "most_common_errors": sorted(
                self.error_counts.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:10]
        }

# Global error handler instance
error_handler = UnifiedErrorHandler()

def standardized_error_handling(component: str = "unknown"):
    """
    Decorator to provide consistent error handling for any function.
    
    Usage:
    @standardized_error_handling("data_processing")
    async def process_data(request: Request, data: dict):
        # Your logic here - all errors automatically handled
        return {"status": "success", "data": result}
    
    @standardized_error_handling("user_service")
    def create_user(user_data: dict):
        # Sync functions also supported
        return user
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                # Handle async functions
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)
                    
            except HTTPException:
                # Re-raise HTTP exceptions as-is (FastAPI will handle them)
                raise
                
            except Exception as e:
                # Extract request object if available
                request = None
                user_id = None
                
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        # Try to extract user ID from request
                        user_id = getattr(request.state, 'user_id', None)
                        break
                
                # Handle the error
                error_details = await error_handler.handle_error(
                    error=e,
                    request=request,
                    component=component,
                    user_id=user_id
                )
                
                # Return standardized error response
                return error_handler.create_http_response(error_details)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
                
            except Exception as e:
                # For sync functions, we can't use async error handling
                # So we create a simplified error response
                error_id = str(uuid.uuid4())[:8]
                error_type = type(e).__name__
                user_message = error_handler.user_friendly_messages.get(
                    error_type,
                    "An unexpected error occurred. Please try again."
                )
                
                # Log the error
                logger.error(f"Error in {component}: {error_id} - {str(e)}")
                
                return {
                    "status": "error",
                    "error_id": error_id,
                    "message": user_message,
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

def handle_startup_errors(func):
    """
    Decorator for handling startup/initialization errors.
    
    Usage:
    @handle_startup_errors
    def initialize_database():
        # Database initialization code
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Startup error in {func.__name__}: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise RuntimeError(f"Failed to initialize {func.__name__}: {str(e)}")
    
    return wrapper

# Convenience functions for common error scenarios
async def handle_validation_error(error: Exception, field_name: str = None) -> JSONResponse:
    """Handle validation errors with field-specific messaging"""
    message = f"Invalid value for field '{field_name}'" if field_name else "Validation failed"
    
    error_details = await error_handler.handle_error(
        error=error,
        component="validation"
    )
    error_details.user_message = message
    
    return error_handler.create_http_response(error_details)

async def handle_database_error(error: Exception, operation: str = None) -> JSONResponse:
    """Handle database errors with operation-specific messaging"""
    message = f"Database {operation} failed" if operation else "Database operation failed"
    
    error_details = await error_handler.handle_error(
        error=error,
        component="database"
    )
    error_details.user_message = "A database error occurred. Please try again later."
    
    return error_handler.create_http_response(error_details)

async def handle_processing_error(error: Exception, file_name: str = None) -> JSONResponse:
    """Handle data processing errors with file-specific messaging"""
    message = f"Failed to process file '{file_name}'" if file_name else "Data processing failed"
    
    error_details = await error_handler.handle_error(
        error=error,
        component="data_processing"
    )
    error_details.user_message = "Data processing failed. Please check your file format and try again."
    
    return error_handler.create_http_response(error_details)