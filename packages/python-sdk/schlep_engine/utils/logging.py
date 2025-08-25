"""
Logging utilities for Schlep-engine SDK
"""

import logging
import sys
from typing import Optional, Dict, Any


def setup_logging(
    level: str = "INFO",
    format_string: Optional[str] = None,
    include_timestamp: bool = True,
    include_level: bool = True,
    include_name: bool = True
) -> None:
    """
    Setup logging configuration for the SDK.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_string: Custom format string for log messages
        include_timestamp: Whether to include timestamp in logs
        include_level: Whether to include log level in logs
        include_name: Whether to include logger name in logs
    """
    if format_string is None:
        # Build default format string
        parts = []
        if include_timestamp:
            parts.append("%(asctime)s")
        if include_level:
            parts.append("%(levelname)s")
        if include_name:
            parts.append("%(name)s")
        parts.append("%(message)s")
        
        format_string = " - ".join(parts)
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=format_string,
        stream=sys.stdout
    )
    
    # Set specific logger levels
    logger = logging.getLogger("schlep_engine")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Reduce noise from external libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for the given name.
    
    Args:
        name: Logger name
        
    Returns:
        Logger instance
    """
    # Ensure all SDK loggers are under the schlep_engine namespace
    if not name.startswith("schlep_engine"):
        name = f"schlep_engine.{name}"
    
    return logging.getLogger(name)


class LoggerMixin:
    """Mixin class to add logging capabilities to other classes."""
    
    @property
    def logger(self) -> logging.Logger:
        """Get logger for this class."""
        class_name = self.__class__.__name__
        module_name = self.__class__.__module__
        
        # Extract meaningful name from module path
        if module_name.startswith("schlep_engine."):
            name = f"{module_name}.{class_name}"
        else:
            name = f"schlep_engine.{class_name}"
        
        return get_logger(name)


def log_api_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[Any] = None
) -> None:
    """
    Log API request details.
    
    Args:
        method: HTTP method
        url: Request URL
        headers: Request headers
        data: Request data (will be truncated if too long)
    """
    logger = get_logger("http_client")
    
    # Sanitize headers (remove sensitive information)
    safe_headers = {}
    if headers:
        for key, value in headers.items():
            if key.lower() in ("authorization", "x-api-key"):
                safe_headers[key] = "***REDACTED***"
            else:
                safe_headers[key] = value
    
    # Truncate data if too long
    data_str = ""
    if data:
        data_str = str(data)
        if len(data_str) > 200:
            data_str = data_str[:200] + "..."
    
    logger.debug(
        f"API Request: {method} {url}\n"
        f"Headers: {safe_headers}\n"
        f"Data: {data_str}"
    )


def log_api_response(
    status_code: int,
    response_data: Optional[Any] = None,
    duration: Optional[float] = None
) -> None:
    """
    Log API response details.
    
    Args:
        status_code: HTTP status code
        response_data: Response data (will be truncated if too long)
        duration: Request duration in seconds
    """
    logger = get_logger("http_client")
    
    # Truncate response data if too long
    data_str = ""
    if response_data:
        data_str = str(response_data)
        if len(data_str) > 200:
            data_str = data_str[:200] + "..."
    
    duration_str = f" ({duration:.2f}s)" if duration else ""
    
    logger.debug(
        f"API Response: {status_code}{duration_str}\n"
        f"Data: {data_str}"
    )