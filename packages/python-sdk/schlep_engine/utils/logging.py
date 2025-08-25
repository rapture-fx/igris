"""
Enhanced logging utilities for Schlep-engine SDK with correlation IDs and structured logging
"""

import logging
import sys
import json
import uuid
import time
from contextvars import ContextVar
from typing import Optional, Dict, Any, Union
from dataclasses import dataclass, asdict
from datetime import datetime


# Context variable for request correlation ID
correlation_id_context: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)


@dataclass
class LogEvent:
    """Structured log event with correlation tracking."""
    
    timestamp: str
    level: str
    logger_name: str
    message: str
    correlation_id: Optional[str] = None
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    operation: Optional[str] = None
    duration_ms: Optional[float] = None
    status_code: Optional[int] = None
    error_type: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert log event to dictionary, filtering out None values."""
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None}
    
    def to_json(self) -> str:
        """Convert log event to JSON string."""
        return json.dumps(self.to_dict(), default=str)


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured logging with correlation IDs."""
    
    def __init__(self, include_correlation_id: bool = True, json_output: bool = False):
        super().__init__()
        self.include_correlation_id = include_correlation_id
        self.json_output = json_output
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with structured information."""
        # Get correlation ID from context
        correlation_id = correlation_id_context.get()
        
        # Extract additional context from record
        request_id = getattr(record, 'request_id', None)
        user_id = getattr(record, 'user_id', None)
        session_id = getattr(record, 'session_id', None)
        operation = getattr(record, 'operation', None)
        duration_ms = getattr(record, 'duration_ms', None)
        status_code = getattr(record, 'status_code', None)
        error_type = getattr(record, 'error_type', None)
        extra_fields = getattr(record, 'extra_fields', None)
        
        # Create structured log event
        log_event = LogEvent(
            timestamp=datetime.fromtimestamp(record.created).isoformat(),
            level=record.levelname,
            logger_name=record.name,
            message=record.getMessage(),
            correlation_id=correlation_id,
            request_id=request_id,
            user_id=user_id,
            session_id=session_id,
            operation=operation,
            duration_ms=duration_ms,
            status_code=status_code,
            error_type=error_type,
            extra_fields=extra_fields
        )
        
        if self.json_output:
            return log_event.to_json()
        else:
            # Human-readable format with correlation ID
            parts = [log_event.timestamp, log_event.level, log_event.logger_name]
            
            if self.include_correlation_id and correlation_id:
                parts.append(f"[{correlation_id[:8]}]")
            
            if request_id:
                parts.append(f"[req:{request_id[:8]}]")
            
            if operation:
                parts.append(f"[{operation}]")
            
            parts.append(log_event.message)
            
            if duration_ms is not None:
                parts.append(f"({duration_ms:.2f}ms)")
            
            if status_code is not None:
                parts.append(f"[{status_code}]")
            
            return " - ".join(parts)


class CorrelationTracker:
    """Utility class for managing correlation IDs across requests."""
    
    @staticmethod
    def generate_correlation_id() -> str:
        """Generate a new correlation ID."""
        return str(uuid.uuid4())
    
    @staticmethod
    def set_correlation_id(correlation_id: str) -> None:
        """Set the correlation ID for the current context."""
        correlation_id_context.set(correlation_id)
    
    @staticmethod
    def get_correlation_id() -> Optional[str]:
        """Get the current correlation ID."""
        return correlation_id_context.get()
    
    @staticmethod
    def clear_correlation_id() -> None:
        """Clear the correlation ID from context."""
        correlation_id_context.set(None)
    
    @staticmethod
    def ensure_correlation_id() -> str:
        """Ensure a correlation ID exists, creating one if needed."""
        correlation_id = correlation_id_context.get()
        if not correlation_id:
            correlation_id = CorrelationTracker.generate_correlation_id()
            CorrelationTracker.set_correlation_id(correlation_id)
        return correlation_id


class ContextualLogger:
    """Logger wrapper that adds contextual information to log messages."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def _log_with_context(
        self,
        level: int,
        message: str,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        operation: Optional[str] = None,
        duration_ms: Optional[float] = None,
        status_code: Optional[int] = None,
        error_type: Optional[str] = None,
        extra_fields: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> None:
        """Log message with contextual information."""
        extra = kwargs.get('extra', {})
        
        # Add context to extra fields
        if request_id:
            extra['request_id'] = request_id
        if user_id:
            extra['user_id'] = user_id
        if session_id:
            extra['session_id'] = session_id
        if operation:
            extra['operation'] = operation
        if duration_ms is not None:
            extra['duration_ms'] = duration_ms
        if status_code is not None:
            extra['status_code'] = status_code
        if error_type:
            extra['error_type'] = error_type
        if extra_fields:
            extra['extra_fields'] = extra_fields
        
        kwargs['extra'] = extra
        self.logger.log(level, message, **kwargs)
    
    def debug(self, message: str, **kwargs) -> None:
        self._log_with_context(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs) -> None:
        self._log_with_context(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs) -> None:
        self._log_with_context(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, **kwargs) -> None:
        self._log_with_context(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs) -> None:
        self._log_with_context(logging.CRITICAL, message, **kwargs)


def setup_logging(
    level: str = "INFO",
    format_string: Optional[str] = None,
    include_timestamp: bool = True,
    include_level: bool = True,
    include_name: bool = True,
    use_structured_logging: bool = False,
    json_output: bool = False,
    include_correlation_id: bool = True
) -> None:
    """
    Setup enhanced logging configuration for the SDK.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_string: Custom format string for log messages (ignored if structured logging is enabled)
        include_timestamp: Whether to include timestamp in logs
        include_level: Whether to include log level in logs
        include_name: Whether to include logger name in logs
        use_structured_logging: Whether to use structured logging with correlation IDs
        json_output: Whether to output logs as JSON (requires structured logging)
        include_correlation_id: Whether to include correlation IDs in logs
    """
    log_level = getattr(logging, level.upper(), logging.INFO)
    
    if use_structured_logging:
        # Use structured formatter
        formatter = StructuredFormatter(
            include_correlation_id=include_correlation_id,
            json_output=json_output
        )
        
        # Configure root handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(formatter)
        
        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.handlers.clear()
        root_logger.addHandler(handler)
        root_logger.setLevel(log_level)
        
    else:
        # Use traditional logging setup
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
            level=log_level,
            format=format_string,
            stream=sys.stdout,
            force=True  # Override any existing configuration
        )
    
    # Set specific logger levels
    logger = logging.getLogger("schlep_engine")
    logger.setLevel(log_level)
    
    # Reduce noise from external libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)


def get_logger(name: str, contextual: bool = False) -> Union[logging.Logger, ContextualLogger]:
    """
    Get a logger instance for the given name.
    
    Args:
        name: Logger name
        contextual: Whether to return a contextual logger with correlation ID support
        
    Returns:
        Logger instance (regular or contextual)
    """
    # Ensure all SDK loggers are under the schlep_engine namespace
    if not name.startswith("schlep_engine"):
        name = f"schlep_engine.{name}"
    
    logger = logging.getLogger(name)
    
    if contextual:
        return ContextualLogger(logger)
    else:
        return logger


def get_contextual_logger(name: str) -> ContextualLogger:
    """
    Get a contextual logger instance with correlation ID support.
    
    Args:
        name: Logger name
        
    Returns:
        Contextual logger instance
    """
    return get_logger(name, contextual=True)


class LoggerMixin:
    """Mixin class to add logging capabilities to other classes."""
    
    @property
    def logger(self) -> logging.Logger:
        """Get standard logger for this class."""
        class_name = self.__class__.__name__
        module_name = self.__class__.__module__
        
        # Extract meaningful name from module path
        if module_name.startswith("schlep_engine."):
            name = f"{module_name}.{class_name}"
        else:
            name = f"schlep_engine.{class_name}"
        
        return get_logger(name)
    
    @property
    def contextual_logger(self) -> ContextualLogger:
        """Get contextual logger for this class with correlation ID support."""
        class_name = self.__class__.__name__
        module_name = self.__class__.__module__
        
        # Extract meaningful name from module path
        if module_name.startswith("schlep_engine."):
            name = f"{module_name}.{class_name}"
        else:
            name = f"schlep_engine.{class_name}"
        
        return get_contextual_logger(name)


def log_api_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[Any] = None,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> str:
    """
    Log API request details with correlation tracking.
    
    Args:
        method: HTTP method
        url: Request URL
        headers: Request headers
        data: Request data (will be truncated if too long)
        request_id: Optional request ID for tracking
        user_id: Optional user ID for context
    
    Returns:
        Request ID for correlation tracking
    """
    # Ensure correlation ID exists
    correlation_id = CorrelationTracker.ensure_correlation_id()
    
    # Generate request ID if not provided
    if not request_id:
        request_id = str(uuid.uuid4())[:8]
    
    logger = get_contextual_logger("http_client")
    
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
    
    # Log with structured context
    logger.debug(
        f"API Request: {method} {url}",
        request_id=request_id,
        user_id=user_id,
        operation="api_request",
        extra_fields={
            "method": method,
            "url": url,
            "headers": safe_headers,
            "data_preview": data_str if data_str else None
        }
    )
    
    return request_id


def log_api_response(
    status_code: int,
    response_data: Optional[Any] = None,
    duration: Optional[float] = None,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    error_type: Optional[str] = None
) -> None:
    """
    Log API response details with correlation tracking.
    
    Args:
        status_code: HTTP status code
        response_data: Response data (will be truncated if too long)
        duration: Request duration in seconds
        request_id: Request ID for correlation
        user_id: User ID for context
        error_type: Error type if response indicates an error
    """
    logger = get_contextual_logger("http_client")
    
    # Truncate response data if too long
    data_str = ""
    if response_data:
        data_str = str(response_data)
        if len(data_str) > 200:
            data_str = data_str[:200] + "..."
    
    # Convert duration to milliseconds
    duration_ms = duration * 1000 if duration else None
    
    # Determine log level based on status code
    if status_code >= 500:
        log_level = "error"
    elif status_code >= 400:
        log_level = "warning"
    else:
        log_level = "debug"
    
    message = f"API Response: {status_code}"
    if duration:
        message += f" ({duration:.2f}s)"
    
    # Log with structured context
    getattr(logger, log_level)(
        message,
        request_id=request_id,
        user_id=user_id,
        operation="api_response",
        duration_ms=duration_ms,
        status_code=status_code,
        error_type=error_type,
        extra_fields={
            "response_preview": data_str if data_str else None,
            "success": status_code < 400
        }
    )


def log_operation_start(
    operation: str,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    **kwargs
) -> str:
    """
    Log the start of an operation with correlation tracking.
    
    Args:
        operation: Name of the operation
        request_id: Optional request ID
        user_id: Optional user ID
        **kwargs: Additional context fields
    
    Returns:
        Request ID for tracking
    """
    # Ensure correlation ID exists
    correlation_id = CorrelationTracker.ensure_correlation_id()
    
    # Generate request ID if not provided
    if not request_id:
        request_id = str(uuid.uuid4())[:8]
    
    logger = get_contextual_logger("operations")
    
    logger.info(
        f"Operation started: {operation}",
        request_id=request_id,
        user_id=user_id,
        operation=operation,
        extra_fields=kwargs if kwargs else None
    )
    
    return request_id


def log_operation_end(
    operation: str,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
    success: bool = True,
    error_type: Optional[str] = None,
    **kwargs
) -> None:
    """
    Log the end of an operation with correlation tracking.
    
    Args:
        operation: Name of the operation
        request_id: Request ID for correlation
        user_id: Optional user ID
        duration_ms: Operation duration in milliseconds
        success: Whether the operation succeeded
        error_type: Error type if operation failed
        **kwargs: Additional context fields
    """
    logger = get_contextual_logger("operations")
    
    log_level = "info" if success else "error"
    status = "completed" if success else "failed"
    message = f"Operation {status}: {operation}"
    
    getattr(logger, log_level)(
        message,
        request_id=request_id,
        user_id=user_id,
        operation=operation,
        duration_ms=duration_ms,
        error_type=error_type,
        extra_fields={
            "success": success,
            **kwargs
        } if kwargs else {"success": success}
    )


# Context manager for tracking operations
class OperationTracker:
    """Context manager for tracking operations with correlation IDs."""
    
    def __init__(
        self,
        operation: str,
        user_id: Optional[str] = None,
        auto_correlation: bool = True,
        **kwargs
    ):
        self.operation = operation
        self.user_id = user_id
        self.auto_correlation = auto_correlation
        self.extra_fields = kwargs
        self.request_id = None
        self.start_time = None
        
    def __enter__(self) -> 'OperationTracker':
        if self.auto_correlation:
            CorrelationTracker.ensure_correlation_id()
        
        self.start_time = time.time()
        self.request_id = log_operation_start(
            self.operation,
            user_id=self.user_id,
            **self.extra_fields
        )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration_ms = (time.time() - self.start_time) * 1000
        else:
            duration_ms = None
        
        success = exc_type is None
        error_type = exc_type.__name__ if exc_type else None
        
        log_operation_end(
            self.operation,
            request_id=self.request_id,
            user_id=self.user_id,
            duration_ms=duration_ms,
            success=success,
            error_type=error_type,
            **self.extra_fields
        )
        
        return False  # Don't suppress exceptions