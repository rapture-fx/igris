"""
Base exception classes for Igris-engine SDK
"""

from typing import Optional, Dict, Any
import json


class IgrisError(Exception):
    """Base exception class for all Igris-engine SDK errors."""
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)
    
    def __str__(self) -> str:
        if self.error_code:
            return f"[{self.error_code}] {self.message}"
        return self.message
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary format."""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details
        }


class APIError(IgrisError):
    """Exception raised for API-related errors."""
    
    def __init__(
        self, 
        message: str,
        status_code: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None
    ):
        self.status_code = status_code
        self.response_data = response_data or {}
        super().__init__(message, error_code, {"status_code": status_code, "response": response_data})


class AuthenticationError(APIError):
    """Exception raised for authentication failures."""
    
    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(message, status_code=401, **kwargs)


class AuthorizationError(APIError):
    """Exception raised for authorization failures."""
    
    def __init__(self, message: str = "Access denied", **kwargs):
        super().__init__(message, status_code=403, **kwargs)


class ValidationError(APIError):
    """Exception raised for validation failures."""
    
    def __init__(
        self, 
        message: str = "Validation failed",
        validation_errors: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        self.validation_errors = validation_errors or {}
        details = kwargs.get("details", {})
        details.update({"validation_errors": self.validation_errors})
        kwargs["details"] = details
        super().__init__(message, status_code=422, **kwargs)


class RateLimitError(APIError):
    """Exception raised when rate limits are exceeded."""
    
    def __init__(
        self, 
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs
    ):
        self.retry_after = retry_after
        details = kwargs.get("details", {})
        details.update({"retry_after": retry_after})
        kwargs["details"] = details
        super().__init__(message, status_code=429, **kwargs)


class ServerError(APIError):
    """Exception raised for server-side errors (5xx)."""
    
    def __init__(self, message: str = "Internal server error", **kwargs):
        if "status_code" not in kwargs:
            kwargs["status_code"] = 500
        super().__init__(message, **kwargs)


class NetworkError(IgrisError):
    """Exception raised for network-related errors."""
    
    def __init__(self, message: str = "Network error occurred", original_error: Optional[Exception] = None):
        self.original_error = original_error
        super().__init__(message, details={"original_error": str(original_error) if original_error else None})


class TimeoutError(NetworkError):
    """Exception raised when requests timeout."""
    
    def __init__(self, message: str = "Request timeout", timeout_duration: Optional[float] = None):
        self.timeout_duration = timeout_duration
        super().__init__(message)
        self.details.update({"timeout_duration": timeout_duration})


class ConfigurationError(IgrisError):
    """Exception raised for configuration-related errors."""
    
    def __init__(self, message: str = "Configuration error", config_key: Optional[str] = None):
        self.config_key = config_key
        super().__init__(message, details={"config_key": config_key})


def parse_api_error(response_data: Dict[str, Any], status_code: int) -> APIError:
    """
    Parse API response and return appropriate exception.
    
    Args:
        response_data: The response data from the API
        status_code: HTTP status code
        
    Returns:
        Appropriate APIError subclass instance
    """
    message = response_data.get("detail", response_data.get("message", "API error"))
    error_code = response_data.get("error_code")
    
    # Handle specific status codes
    if status_code == 401:
        return AuthenticationError(message, error_code=error_code, response_data=response_data)
    elif status_code == 403:
        return AuthorizationError(message, error_code=error_code, response_data=response_data)
    elif status_code == 422:
        validation_errors = response_data.get("validation_errors", {})
        return ValidationError(message, validation_errors=validation_errors, error_code=error_code, response_data=response_data)
    elif status_code == 429:
        retry_after = response_data.get("retry_after")
        return RateLimitError(message, retry_after=retry_after, error_code=error_code, response_data=response_data)
    elif status_code >= 500:
        return ServerError(message, status_code=status_code, error_code=error_code, response_data=response_data)
    else:
        return APIError(message, status_code=status_code, error_code=error_code, response_data=response_data)