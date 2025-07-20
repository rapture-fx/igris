"""
Centralized logging configuration for Schlep-engine
Supports structured logging, multiple outputs, and log aggregation
"""

import logging
import logging.config
import json
import sys
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path
import traceback
from contextvars import ContextVar
import uuid

from app.core.config import settings

# Context variables for request tracking
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar('session_id', default=None)

class StructuredFormatter(logging.Formatter):
    """Structured JSON formatter for log aggregation"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process_id": record.process,
            "thread_id": record.thread,
        }
        
        # Add request context if available
        request_id = request_id_var.get()
        if request_id:
            log_entry["request_id"] = request_id
        
        user_id = user_id_var.get()
        if user_id:
            log_entry["user_id"] = user_id
        
        session_id = session_id_var.get()
        if session_id:
            log_entry["session_id"] = session_id
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info)
            }
        
        # Add extra fields
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
        
        return json.dumps(log_entry, ensure_ascii=False)

class RequestContextFilter(logging.Filter):
    """Filter to add request context to log records"""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add request context to log record"""
        request_id = request_id_var.get()
        if request_id:
            record.request_id = request_id
        
        user_id = user_id_var.get()
        if user_id:
            record.user_id = user_id
        
        session_id = session_id_var.get()
        if session_id:
            record.session_id = session_id
        
        return True

class SecurityFilter(logging.Filter):
    """Filter to remove sensitive information from logs"""
    
    SENSITIVE_FIELDS = {
        'password', 'token', 'secret', 'key', 'authorization',
        'cookie', 'session', 'credential', 'private'
    }
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Remove sensitive information from log message"""
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            # Simple pattern matching for sensitive data
            for field in self.SENSITIVE_FIELDS:
                if field.lower() in record.msg.lower():
                    record.msg = self._redact_sensitive_data(record.msg)
                    break
        
        return True
    
    def _redact_sensitive_data(self, message: str) -> str:
        """Redact sensitive data from message"""
        # This is a simple implementation - in production, use more sophisticated patterns
        import re
        
        # Redact passwords
        message = re.sub(r'password["\']?\s*[:=]\s*["\']?[^"\s]+["\']?', 'password="***"', message, flags=re.IGNORECASE)
        
        # Redact tokens
        message = re.sub(r'token["\']?\s*[:=]\s*["\']?[^"\s]+["\']?', 'token="***"', message, flags=re.IGNORECASE)
        
        # Redact API keys
        message = re.sub(r'api_key["\']?\s*[:=]\s*["\']?[^"\s]+["\']?', 'api_key="***"', message, flags=re.IGNORECASE)
        
        return message

class PerformanceFilter(logging.Filter):
    """Filter to track performance metrics"""
    
    def __init__(self, name: str = ""):
        super().__init__(name)
        self.slow_query_threshold = 1.0  # seconds
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Track performance metrics"""
        if hasattr(record, 'duration'):
            duration = record.duration
            if duration > self.slow_query_threshold:
                record.msg = f"SLOW_QUERY: {record.msg} (duration: {duration:.3f}s)"
                record.levelno = logging.WARNING
        
        return True

def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    enable_console: bool = True,
    enable_file: bool = True,
    enable_json: bool = True,
    enable_structured: bool = True
) -> None:
    """Setup comprehensive logging configuration"""
    
    # Create logs directory if it doesn't exist
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Define loggers
    loggers = {
        "": {  # Root logger
            "level": log_level,
            "handlers": [],
            "propagate": False
        },
        "app": {  # Application logger
            "level": log_level,
            "handlers": ["console", "file", "json_file"],
            "propagate": False
        },
        "app.api": {  # API logger
            "level": log_level,
            "handlers": ["console", "file", "json_file"],
            "propagate": False
        },
        "app.auth": {  # Authentication logger
            "level": log_level,
            "handlers": ["console", "file", "json_file", "security_file"],
            "propagate": False
        },
        "app.database": {  # Database logger
            "level": log_level,
            "handlers": ["console", "file", "json_file"],
            "propagate": False
        },
        "app.security": {  # Security logger
            "level": log_level,
            "handlers": ["console", "file", "json_file", "security_file"],
            "propagate": False
        },
        "app.audit": {  # Audit logger
            "level": "INFO",
            "handlers": ["audit_file"],
            "propagate": False
        },
        "uvicorn": {  # Uvicorn logger
            "level": "INFO",
            "handlers": ["console", "file"],
            "propagate": False
        },
        "sqlalchemy": {  # SQLAlchemy logger
            "level": "WARNING",
            "handlers": ["console", "file"],
            "propagate": False
        }
    }
    
    # Define handlers
    handlers = {}
    
    if enable_console:
        handlers["console"] = {
            "class": "logging.StreamHandler",
            "level": log_level,
            "formatter": "structured" if enable_structured else "simple",
            "stream": "ext://sys.stdout"
        }
    
    if enable_file and log_file:
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": log_level,
            "formatter": "detailed",
            "filename": log_file,
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5
        }
        
        # JSON file handler for log aggregation
        if enable_json:
            json_log_file = str(Path(log_file).with_suffix('.json'))
            handlers["json_file"] = {
                "class": "logging.handlers.RotatingFileHandler",
                "level": log_level,
                "formatter": "json",
                "filename": json_log_file,
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5
            }
        
        # Security-specific log file
        security_log_file = str(Path(log_file).parent / "security.log")
        handlers["security_file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "json",
            "filename": security_log_file,
            "maxBytes": 10485760,  # 10MB
            "backupCount": 10
        }
        
        # Audit log file
        audit_log_file = str(Path(log_file).parent / "audit.log")
        handlers["audit_file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "json",
            "filename": audit_log_file,
            "maxBytes": 10485760,  # 10MB
            "backupCount": 20
        }
    
    # Define formatters
    formatters = {
        "simple": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        },
        "detailed": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(lineno)d - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        },
        "structured": {
            "()": StructuredFormatter
        },
        "json": {
            "()": StructuredFormatter
        }
    }
    
    # Define filters
    filters = {
        "request_context": {
            "()": RequestContextFilter
        },
        "security": {
            "()": SecurityFilter
        },
        "performance": {
            "()": PerformanceFilter
        }
    }
    
    # Apply filters to handlers
    for handler_name, handler_config in handlers.items():
        if "filters" not in handler_config:
            handler_config["filters"] = []
        
        # Add security filter to all handlers
        handler_config["filters"].append("security")
        
        # Add request context filter to JSON handlers
        if "json" in handler_name or handler_name == "console":
            handler_config["filters"].append("request_context")
        
        # Add performance filter to database handlers
        if "database" in handler_name:
            handler_config["filters"].append("performance")
    
    # Create logging configuration
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": formatters,
        "filters": filters,
        "handlers": handlers,
        "loggers": loggers
    }
    
    # Apply configuration
    logging.config.dictConfig(logging_config)

def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name"""
    return logging.getLogger(name)

def log_request_start(request_id: str, method: str, url: str, user_id: Optional[str] = None) -> None:
    """Log the start of a request"""
    logger = get_logger("app.api")
    logger.info(
        "Request started",
        extra={
            "extra_fields": {
                "event": "request_start",
                "method": method,
                "url": url,
                "user_id": user_id
            }
        }
    )

def log_request_end(request_id: str, method: str, url: str, status_code: int, duration: float, user_id: Optional[str] = None) -> None:
    """Log the end of a request"""
    logger = get_logger("app.api")
    logger.info(
        "Request completed",
        extra={
            "extra_fields": {
                "event": "request_end",
                "method": method,
                "url": url,
                "status_code": status_code,
                "duration": duration,
                "user_id": user_id
            }
        }
    )

def log_security_event(event_type: str, details: Dict[str, Any], user_id: Optional[str] = None, ip_address: Optional[str] = None) -> None:
    """Log security events"""
    logger = get_logger("app.security")
    logger.warning(
        f"Security event: {event_type}",
        extra={
            "extra_fields": {
                "event": "security_event",
                "event_type": event_type,
                "details": details,
                "user_id": user_id,
                "ip_address": ip_address
            }
        }
    )

def log_audit_event(event_type: str, resource: str, action: str, details: Dict[str, Any], user_id: Optional[str] = None) -> None:
    """Log audit events"""
    logger = get_logger("app.audit")
    logger.info(
        f"Audit event: {event_type}",
        extra={
            "extra_fields": {
                "event": "audit_event",
                "event_type": event_type,
                "resource": resource,
                "action": action,
                "details": details,
                "user_id": user_id
            }
        }
    )

def log_performance_metric(metric_name: str, value: float, unit: str = "seconds", tags: Optional[Dict[str, str]] = None) -> None:
    """Log performance metrics"""
    logger = get_logger("app.performance")
    logger.info(
        f"Performance metric: {metric_name}",
        extra={
            "extra_fields": {
                "event": "performance_metric",
                "metric_name": metric_name,
                "value": value,
                "unit": unit,
                "tags": tags or {}
            }
        }
    )

def log_business_event(event_type: str, details: Dict[str, Any], user_id: Optional[str] = None) -> None:
    """Log business events"""
    logger = get_logger("app.business")
    logger.info(
        f"Business event: {event_type}",
        extra={
            "extra_fields": {
                "event": "business_event",
                "event_type": event_type,
                "details": details,
                "user_id": user_id
            }
        }
    )

def log_error(error: Exception, context: Optional[Dict[str, Any]] = None, user_id: Optional[str] = None) -> None:
    """Log errors with context"""
    logger = get_logger("app.error")
    logger.error(
        f"Error occurred: {str(error)}",
        exc_info=True,
        extra={
            "extra_fields": {
                "event": "error",
                "error_type": type(error).__name__,
                "context": context or {},
                "user_id": user_id
            }
        }
    )

# Initialize logging on module import
setup_logging(
    log_level=getattr(settings, 'LOG_LEVEL', 'INFO'),
    log_file=getattr(settings, 'LOG_FILE', 'logs/app.log'),
    enable_console=True,
    enable_file=True,
    enable_json=True,
    enable_structured=True
) 