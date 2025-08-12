"""
Standardized Error Handling Decorators
=====================================

Provides decorators to ensure consistent error handling across all API endpoints.
This eliminates the need for scattered try/catch blocks throughout the codebase.

Usage:
    @standardized_error_handling("data_processing")
    async def process_data(request: Request):
        # Your logic here - any exceptions will be handled consistently
        
    @handle_auth_errors
    async def login(request: Request):
        # Authentication-specific error handling
        
    @handle_validation_errors
    async def create_user(request: Request, user_data: UserModel):
        # Validation-specific error handling
"""

import asyncio
import functools
import logging
from typing import Any, Callable, Dict, Optional, Union, Awaitable
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

from app.core.error_handler import unified_error_handler, ErrorCategory

logger = logging.getLogger(__name__)

def standardized_error_handling(
    component: str = "api",
    category: Optional[ErrorCategory] = None,
    include_request_body: bool = False,
    custom_context: Optional[Dict[str, Any]] = None
):
    """
    Decorator for standardized error handling across all endpoints.
    
    Args:
        component: Component name for error tracking (e.g., "data_processing", "auth", "upload")
        category: Force specific error category instead of auto-detection
        include_request_body: Whether to include request body in error context (be careful with sensitive data)
        custom_context: Additional context to include in error details
    
    Usage:
        @standardized_error_handling("data_processing")
        async def process_file(request: Request, file_data: dict):
            # Your logic here
            return {"status": "success"}
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            request = None
            
            # Extract request from args if available
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            # Extract request from kwargs
            if not request and 'request' in kwargs:
                request = kwargs['request']
            
            try:
                # Execute the original function
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                return result
                
            except HTTPException:
                # Re-raise HTTP exceptions as-is (they're already properly formatted)
                raise
                
            except Exception as e:
                # Build error context
                error_context = custom_context or {}
                
                if include_request_body and request:
                    try:
                        # Only include body for non-sensitive endpoints
                        if request.method in ["POST", "PUT", "PATCH"]:
                            body = await request.body()
                            if body and len(body) < 10000:  # Limit size
                                error_context["request_body_size"] = len(body)
                    except Exception:
                        pass
                
                # Add function information
                error_context.update({
                    "function_name": func.__name__,
                    "function_module": func.__module__,
                })
                
                # Handle error using unified handler
                error_details = await unified_error_handler.handle_error(
                    error=e,
                    request=request,
                    component=component,
                    **error_context
                )
                
                # Override category if specified
                if category:
                    error_details.category = category
                
                # Return standardized JSON response
                return unified_error_handler.create_http_response(error_details)
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            request = None
            
            # Extract request from args if available
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            # Extract request from kwargs
            if not request and 'request' in kwargs:
                request = kwargs['request']
            
            try:
                return func(*args, **kwargs)
                
            except HTTPException:
                # Re-raise HTTP exceptions as-is
                raise
                
            except Exception as e:
                # Build error context
                error_context = custom_context or {}
                error_context.update({
                    "function_name": func.__name__,
                    "function_module": func.__module__,
                })
                
                # Handle error synchronously (convert to async)
                import asyncio
                
                async def handle_sync_error():
                    error_details = await unified_error_handler.handle_error(
                        error=e,
                        request=request,
                        component=component,
                        **error_context
                    )
                    
                    if category:
                        error_details.category = category
                    
                    return unified_error_handler.create_http_response(error_details)
                
                # Run async error handling
                try:
                    loop = asyncio.get_event_loop()
                    return loop.run_until_complete(handle_sync_error())
                except RuntimeError:
                    # If no loop is running, create one
                    return asyncio.run(handle_sync_error())
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

# Specialized decorators for common scenarios
def handle_auth_errors(func: Callable) -> Callable:
    """Decorator specifically for authentication endpoints"""
    return standardized_error_handling(
        component="authentication",
        category=ErrorCategory.AUTHENTICATION
    )(func)

def handle_validation_errors(func: Callable) -> Callable:
    """Decorator specifically for validation-heavy endpoints"""
    return standardized_error_handling(
        component="validation",
        category=ErrorCategory.VALIDATION,
        include_request_body=True
    )(func)

def handle_database_errors(func: Callable) -> Callable:
    """Decorator specifically for database operations"""
    return standardized_error_handling(
        component="database",
        category=ErrorCategory.DATABASE
    )(func)

def handle_file_processing_errors(func: Callable) -> Callable:
    """Decorator specifically for file processing endpoints"""
    return standardized_error_handling(
        component="file_processing",
        category=ErrorCategory.BUSINESS_LOGIC,
        custom_context={"operation_type": "file_processing"}
    )(func)

def handle_external_api_errors(func: Callable) -> Callable:
    """Decorator specifically for external API calls"""
    return standardized_error_handling(
        component="external_api",
        category=ErrorCategory.EXTERNAL_API
    )(func)

def handle_ml_processing_errors(func: Callable) -> Callable:
    """Decorator specifically for ML/AI processing"""
    return standardized_error_handling(
        component="ml_processing",
        category=ErrorCategory.BUSINESS_LOGIC,
        custom_context={"operation_type": "ml_processing"}
    )(func)

# Advanced decorator with retry logic
def standardized_error_handling_with_retry(
    component: str = "api",
    max_retries: int = 3,
    retry_delay: float = 1.0,
    retry_on: tuple = (Exception,),
    backoff_factor: float = 2.0
):
    """
    Advanced error handling with automatic retry logic.
    
    Args:
        component: Component name for error tracking
        max_retries: Maximum number of retry attempts
        retry_delay: Initial delay between retries (seconds)
        retry_on: Tuple of exception types to retry on
        backoff_factor: Multiplier for delay on each retry
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    if asyncio.iscoroutinefunction(func):
                        return await func(*args, **kwargs)
                    else:
                        return func(*args, **kwargs)
                        
                except retry_on as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        delay = retry_delay * (backoff_factor ** attempt)
                        logger.warning(
                            f"Attempt {attempt + 1} failed for {func.__name__}, "
                            f"retrying in {delay}s: {str(e)}"
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        # Max retries reached, handle error
                        break
                        
                except Exception as e:
                    # Non-retryable exception
                    last_exception = e
                    break
            
            # Handle the final error
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            error_details = await unified_error_handler.handle_error(
                error=last_exception,
                request=request,
                component=component,
                max_retries=max_retries,
                attempts_made=attempt + 1
            )
            
            return unified_error_handler.create_http_response(error_details)
        
        return wrapper
    return decorator

# Utility function for manual error handling
async def handle_error_manually(
    error: Exception,
    request: Optional[Request] = None,
    component: str = "manual",
    **context
) -> JSONResponse:
    """
    Manually handle an error using the standardized system.
    
    Useful for handling errors in middleware or complex logic where decorators aren't suitable.
    """
    error_details = await unified_error_handler.handle_error(
        error=error,
        request=request,
        component=component,
        **context
    )
    
    return unified_error_handler.create_http_response(error_details)

# Export commonly used decorators
__all__ = [
    'standardized_error_handling',
    'handle_auth_errors',
    'handle_validation_errors', 
    'handle_database_errors',
    'handle_file_processing_errors',
    'handle_external_api_errors',
    'handle_ml_processing_errors',
    'standardized_error_handling_with_retry',
    'handle_error_manually'
] 