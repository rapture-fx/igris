"""
Structured JSON logging for Python ML Service
Links logs to OpenTelemetry trace context
"""

import json
import logging
import sys
from datetime import datetime
from typing import Any, Dict, Optional

from opentelemetry import trace


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs
    Compatible with ELK/OpenSearch and log aggregation systems
    """

    def __init__(self, service_name: str = "python-ml-service"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON"""

        # Get current span context for trace/span IDs
        span = trace.get_current_span()
        span_context = span.get_span_context() if span else None

        # Build structured log entry
        log_entry = {
            "@timestamp": datetime.utcnow().isoformat() + "Z",
            "service": self.service_name,
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "thread": record.thread,
            "thread_name": record.threadName,
        }

        # Add trace context if available
        if span_context and span_context.is_valid:
            log_entry["trace_id"] = format(span_context.trace_id, '032x')
            log_entry["span_id"] = format(span_context.span_id, '016x')
            log_entry["trace_flags"] = format(span_context.trace_flags, '02x')

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info)
            }

        # Add extra fields
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)

        # Add custom attributes from record
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'created', 'filename', 'funcName',
                          'levelname', 'levelno', 'lineno', 'module', 'msecs',
                          'message', 'pathname', 'process', 'processName',
                          'relativeCreated', 'thread', 'threadName', 'exc_info',
                          'exc_text', 'stack_info', 'extra_fields']:
                log_entry[key] = value

        return json.dumps(log_entry)


class StructuredLogger:
    """
    Wrapper for structured logging with convenience methods
    """

    def __init__(self, name: str = "python-ml", service_name: str = "python-ml-service"):
        self.logger = logging.getLogger(name)
        self.service_name = service_name
        self._setup_logger()

    def _setup_logger(self):
        """Setup logger with structured formatter"""
        # Remove existing handlers
        self.logger.handlers.clear()

        # Create console handler with structured formatter
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredFormatter(self.service_name))

        # Set level from environment or default to INFO
        import os
        log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
        self.logger.setLevel(getattr(logging, log_level, logging.INFO))

        self.logger.addHandler(handler)
        self.logger.propagate = False

    def _log(self, level: int, message: str, extra: Optional[Dict[str, Any]] = None):
        """Internal log method with extra fields"""
        if extra:
            self.logger.log(level, message, extra={'extra_fields': extra})
        else:
            self.logger.log(level, message)

    def info(self, message: str, **kwargs):
        """Log info message with optional fields"""
        self._log(logging.INFO, message, kwargs if kwargs else None)

    def error(self, message: str, **kwargs):
        """Log error message with optional fields"""
        self._log(logging.ERROR, message, kwargs if kwargs else None)

    def warning(self, message: str, **kwargs):
        """Log warning message with optional fields"""
        self._log(logging.WARNING, message, kwargs if kwargs else None)

    def debug(self, message: str, **kwargs):
        """Log debug message with optional fields"""
        self._log(logging.DEBUG, message, kwargs if kwargs else None)

    def inference_request(
        self,
        model_id: str,
        features_count: int,
        latency_ms: float,
        prediction: float,
        confidence: float,
        success: bool = True,
        error: Optional[str] = None
    ):
        """Log structured inference request"""
        log_data = {
            "event": "inference_request",
            "model_id": model_id,
            "features_count": features_count,
            "latency_ms": latency_ms,
            "prediction": prediction,
            "confidence": confidence,
            "status": "success" if success else "error"
        }

        if error:
            log_data["error"] = error

        level = logging.INFO if success else logging.ERROR
        self._log(level, f"Inference request completed", log_data)


# Global logger instance
_global_logger = None


def get_logger(name: str = "python-ml", service_name: str = "python-ml-service") -> StructuredLogger:
    """Get or create global structured logger"""
    global _global_logger
    if _global_logger is None:
        _global_logger = StructuredLogger(name, service_name)
    return _global_logger


# Example usage and testing
if __name__ == "__main__":
    logger = get_logger()

    logger.info("Service starting", version="1.0.0", port=50051)
    logger.debug("Debug message", component="model_registry", models_loaded=3)
    logger.warning("High memory usage", memory_mb=512, threshold_mb=1024)

    try:
        raise ValueError("Test error")
    except Exception as e:
        logger.error("Error occurred", error_type="ValueError")

    # Inference logging
    logger.inference_request(
        model_id="default",
        features_count=10,
        latency_ms=25.5,
        prediction=0.85,
        confidence=0.92,
        success=True
    )

    print("\nStructured logging test complete!")
