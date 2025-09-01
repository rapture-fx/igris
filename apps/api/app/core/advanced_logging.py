"""
Advanced Logging System for Schlep Engine
==========================================

Provides comprehensive logging with:
- Structured logging with JSON format
- Log rotation and retention policies
- Multiple output targets (console, file, remote)
- Performance monitoring integration
- Alert thresholds and anomaly detection
"""

import os
import logging
import logging.handlers
import json
import time
import asyncio
from typing import Dict, Any, Optional, List, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import gzip
from pathlib import Path
import threading
from queue import Queue
import traceback

from app.core.config import settings


class LogLevel(str, Enum):
    """Enhanced log levels"""
    TRACE = "TRACE"
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
    SECURITY = "SECURITY"
    BUSINESS = "BUSINESS"
    PERFORMANCE = "PERFORMANCE"


class LogCategory(str, Enum):
    """Log categorization for better organization"""
    SYSTEM = "system"
    APPLICATION = "application"
    SECURITY = "security"
    PERFORMANCE = "performance"
    BUSINESS = "business"
    AUDIT = "audit"
    ML_TRAINING = "ml_training"
    RL_OPTIMIZATION = "rl_optimization"
    API_ACCESS = "api_access"
    DATABASE = "database"
    CACHE = "cache"
    STORAGE = "storage"


@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: str
    level: str
    category: str
    message: str
    service: str = "schlep-engine-api"
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    duration_ms: Optional[float] = None
    error_type: Optional[str] = None
    error_trace: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    extra: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values"""
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None}
    
    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict(), separators=(',', ':'))


class LogRotationPolicy:
    """Log rotation and retention policy"""
    
    def __init__(
        self,
        max_file_size_mb: int = 100,
        max_files: int = 10,
        retention_days: int = 30,
        compression: bool = True,
        archive_old_logs: bool = True
    ):
        self.max_file_size_mb = max_file_size_mb
        self.max_files = max_files
        self.retention_days = retention_days
        self.compression = compression
        self.archive_old_logs = archive_old_logs
    
    def should_rotate(self, file_path: str) -> bool:
        """Check if log file should be rotated"""
        if not os.path.exists(file_path):
            return False
        
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        return file_size_mb >= self.max_file_size_mb
    
    def cleanup_old_logs(self, log_dir: str, base_filename: str):
        """Clean up old log files based on retention policy"""
        try:
            log_path = Path(log_dir)
            if not log_path.exists():
                return
            
            # Find all log files
            pattern = f"{base_filename}*"
            log_files = list(log_path.glob(pattern))
            
            # Remove files older than retention period
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)
            
            for log_file in log_files:
                try:
                    file_date = datetime.fromtimestamp(log_file.stat().st_mtime)
                    if file_date < cutoff_date:
                        log_file.unlink()
                except Exception as e:
                    # Log cleanup error but don't fail
                    print(f"Error cleaning up log file {log_file}: {e}")
        
        except Exception as e:
            print(f"Error during log cleanup: {e}")


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def __init__(self, include_extra: bool = True):
        super().__init__()
        self.include_extra = include_extra
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON"""
        
        # Base log entry
        log_entry = LogEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            level=record.levelname,
            category=getattr(record, 'category', LogCategory.APPLICATION),
            message=record.getMessage(),
            service=getattr(record, 'service', 'schlep-engine-api')
        )
        
        # Add request context if available
        if hasattr(record, 'request_id'):
            log_entry.request_id = record.request_id
        if hasattr(record, 'user_id'):
            log_entry.user_id = record.user_id
        if hasattr(record, 'session_id'):
            log_entry.session_id = record.session_id
        if hasattr(record, 'ip_address'):
            log_entry.ip_address = record.ip_address
        if hasattr(record, 'user_agent'):
            log_entry.user_agent = record.user_agent
        
        # Add API context if available
        if hasattr(record, 'endpoint'):
            log_entry.endpoint = record.endpoint
        if hasattr(record, 'method'):
            log_entry.method = record.method
        if hasattr(record, 'status_code'):
            log_entry.status_code = record.status_code
        if hasattr(record, 'duration_ms'):
            log_entry.duration_ms = record.duration_ms
        
        # Add error context if available
        if record.exc_info:
            log_entry.error_type = record.exc_info[0].__name__ if record.exc_info[0] else None
            log_entry.error_trace = self.formatException(record.exc_info)
        elif hasattr(record, 'error_type'):
            log_entry.error_type = record.error_type
        
        # Add metrics if available
        if hasattr(record, 'metrics'):
            log_entry.metrics = record.metrics
        
        # Add tags if available
        if hasattr(record, 'tags'):
            log_entry.tags = record.tags
        
        # Add extra fields if enabled and available
        if self.include_extra and hasattr(record, 'extra'):
            log_entry.extra = record.extra
        
        return log_entry.to_json()


class LogAggregator:
    """Aggregates logs for anomaly detection and alerting"""
    
    def __init__(self, window_minutes: int = 5):
        self.window_minutes = window_minutes
        self.log_counts: Dict[str, List[tuple]] = {}
        self.error_patterns: Dict[str, int] = {}
        self.lock = threading.Lock()
    
    def add_log_entry(self, level: str, category: str, message: str):
        """Add log entry for aggregation"""
        current_time = time.time()
        
        with self.lock:
            # Initialize counters if needed
            key = f"{level}:{category}"
            if key not in self.log_counts:
                self.log_counts[key] = []
            
            # Add current log entry
            self.log_counts[key].append((current_time, message))
            
            # Clean up old entries outside the window
            cutoff_time = current_time - (self.window_minutes * 60)
            self.log_counts[key] = [
                (t, m) for t, m in self.log_counts[key]
                if t > cutoff_time
            ]
            
            # Track error patterns
            if level in ["ERROR", "CRITICAL"]:
                if message not in self.error_patterns:
                    self.error_patterns[message] = 0
                self.error_patterns[message] += 1
    
    def get_anomalies(self) -> Dict[str, Any]:
        """Detect logging anomalies"""
        anomalies = {}
        current_time = time.time()
        
        with self.lock:
            for key, entries in self.log_counts.items():
                level, category = key.split(":", 1)
                count = len(entries)
                
                # Define thresholds based on log level
                thresholds = {
                    "ERROR": 10,
                    "CRITICAL": 3,
                    "WARNING": 20,
                    "SECURITY": 5
                }
                
                threshold = thresholds.get(level, 100)
                
                if count > threshold:
                    anomalies[key] = {
                        "count": count,
                        "threshold": threshold,
                        "window_minutes": self.window_minutes,
                        "level": level,
                        "category": category,
                        "first_occurrence": min(entries)[0] if entries else current_time,
                        "last_occurrence": max(entries)[0] if entries else current_time
                    }
        
        return anomalies
    
    def get_top_errors(self, limit: int = 10) -> Dict[str, int]:
        """Get most frequent error messages"""
        sorted_errors = sorted(
            self.error_patterns.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return dict(sorted_errors[:limit])


class AsyncLogHandler(logging.Handler):
    """Asynchronous log handler for high-performance logging"""
    
    def __init__(self, target_handler: logging.Handler, queue_size: int = 10000):
        super().__init__()
        self.target_handler = target_handler
        self.queue = Queue(maxsize=queue_size)
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()
        self.shutdown_event = threading.Event()
    
    def emit(self, record):
        """Emit log record asynchronously"""
        try:
            if not self.shutdown_event.is_set():
                self.queue.put_nowait(record)
        except:
            # Queue is full, drop the record
            pass
    
    def _worker(self):
        """Worker thread to process log records"""
        while not self.shutdown_event.is_set():
            try:
                record = self.queue.get(timeout=1.0)
                if record is not None:
                    self.target_handler.emit(record)
                self.queue.task_done()
            except:
                continue
    
    def close(self):
        """Close the handler and cleanup"""
        self.shutdown_event.set()
        self.worker_thread.join(timeout=5.0)
        self.target_handler.close()
        super().close()


class AdvancedLoggingSystem:
    """Advanced logging system with comprehensive features"""
    
    def __init__(self):
        self.loggers: Dict[str, logging.Logger] = {}
        self.log_aggregator = LogAggregator()
        self.rotation_policy = LogRotationPolicy(
            max_file_size_mb=getattr(settings, 'LOG_MAX_FILE_SIZE_MB', 100),
            max_files=getattr(settings, 'LOG_MAX_FILES', 10),
            retention_days=getattr(settings, 'LOG_RETENTION_DAYS', 30),
            compression=getattr(settings, 'LOG_COMPRESSION', True)
        )
        self.setup_logging()
    
    def setup_logging(self):
        """Setup comprehensive logging configuration"""
        
        # Create logs directory
        log_dir = getattr(settings, 'LOG_DIRECTORY', 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        # Setup different loggers for different categories
        categories = [
            LogCategory.APPLICATION,
            LogCategory.SECURITY,
            LogCategory.PERFORMANCE,
            LogCategory.BUSINESS,
            LogCategory.AUDIT,
            LogCategory.ML_TRAINING,
            LogCategory.RL_OPTIMIZATION,
            LogCategory.API_ACCESS
        ]
        
        for category in categories:
            logger = self._create_category_logger(category.value, log_dir)
            self.loggers[category.value] = logger
        
        # Setup main application logger
        main_logger = logging.getLogger("schlep_engine")
        main_logger.setLevel(logging.DEBUG)
        
        # Console handler with structured formatting
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(settings, 'LOG_CONSOLE_LEVEL', logging.INFO))
        console_handler.setFormatter(StructuredFormatter())
        
        # File handler with rotation
        main_log_file = os.path.join(log_dir, "application.log")
        file_handler = logging.handlers.RotatingFileHandler(
            main_log_file,
            maxBytes=self.rotation_policy.max_file_size_mb * 1024 * 1024,
            backupCount=self.rotation_policy.max_files
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        
        # Add async wrapper for better performance
        async_file_handler = AsyncLogHandler(file_handler)
        
        main_logger.addHandler(console_handler)
        main_logger.addHandler(async_file_handler)
        
        self.loggers["main"] = main_logger
    
    def _create_category_logger(self, category: str, log_dir: str) -> logging.Logger:
        """Create a logger for specific category"""
        logger_name = f"schlep_engine.{category}"
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.DEBUG)
        
        # Category-specific log file
        log_file = os.path.join(log_dir, f"{category}.log")
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=self.rotation_policy.max_file_size_mb * 1024 * 1024,
            backupCount=self.rotation_policy.max_files
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        
        # Add async wrapper
        async_handler = AsyncLogHandler(file_handler)
        logger.addHandler(async_handler)
        
        return logger
    
    def get_logger(self, category: str = "application") -> logging.Logger:
        """Get logger for specific category"""
        return self.loggers.get(category, self.loggers["main"])
    
    def log_structured(
        self,
        level: str,
        message: str,
        category: str = LogCategory.APPLICATION,
        **kwargs
    ):
        """Log with structured format"""
        logger = self.get_logger(category)
        
        # Add to aggregator for anomaly detection
        self.log_aggregator.add_log_entry(level, category, message)
        
        # Create log record with extra context
        extra = {
            'category': category,
            **kwargs
        }
        
        # Log at appropriate level
        if level == LogLevel.TRACE:
            logger.debug(message, extra=extra)
        elif level == LogLevel.DEBUG:
            logger.debug(message, extra=extra)
        elif level == LogLevel.INFO:
            logger.info(message, extra=extra)
        elif level == LogLevel.WARNING:
            logger.warning(message, extra=extra)
        elif level == LogLevel.ERROR:
            logger.error(message, extra=extra)
        elif level == LogLevel.CRITICAL:
            logger.critical(message, extra=extra)
        else:
            logger.info(message, extra=extra)
    
    def log_request(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log API request with structured format"""
        self.log_structured(
            LogLevel.INFO,
            f"{method} {endpoint} - {status_code} ({duration_ms:.2f}ms)",
            category=LogCategory.API_ACCESS,
            method=method,
            endpoint=endpoint,
            status_code=status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def log_security_event(
        self,
        event_type: str,
        message: str,
        severity: str = "WARNING",
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log security event"""
        self.log_structured(
            severity,
            message,
            category=LogCategory.SECURITY,
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            extra=additional_data
        )
    
    def log_performance_metric(
        self,
        metric_name: str,
        value: float,
        unit: str = "ms",
        threshold: Optional[float] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        """Log performance metric"""
        level = LogLevel.INFO
        if threshold and value > threshold:
            level = LogLevel.WARNING
        
        self.log_structured(
            level,
            f"Performance metric: {metric_name} = {value} {unit}",
            category=LogCategory.PERFORMANCE,
            metrics={
                "name": metric_name,
                "value": value,
                "unit": unit,
                "threshold": threshold
            },
            extra=context
        )
    
    def log_business_event(
        self,
        event_type: str,
        message: str,
        user_id: Optional[str] = None,
        amount: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log business event"""
        self.log_structured(
            LogLevel.INFO,
            message,
            category=LogCategory.BUSINESS,
            event_type=event_type,
            user_id=user_id,
            extra={
                "amount": amount,
                "metadata": metadata
            }
        )
    
    def get_anomalies(self) -> Dict[str, Any]:
        """Get current logging anomalies"""
        return self.log_aggregator.get_anomalies()
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get error summary for monitoring"""
        return {
            "top_errors": self.log_aggregator.get_top_errors(),
            "anomalies": self.get_anomalies(),
            "window_minutes": self.log_aggregator.window_minutes
        }
    
    def cleanup_old_logs(self):
        """Cleanup old logs based on retention policy"""
        log_dir = getattr(settings, 'LOG_DIRECTORY', 'logs')
        
        for category in self.loggers.keys():
            if category != "main":
                self.rotation_policy.cleanup_old_logs(log_dir, f"{category}.log")
        
        # Cleanup main application logs
        self.rotation_policy.cleanup_old_logs(log_dir, "application.log")


# Global logging system instance
advanced_logging = AdvancedLoggingSystem()

# Convenience functions
def get_logger(category: str = LogCategory.APPLICATION) -> logging.Logger:
    """Get logger for category"""
    return advanced_logging.get_logger(category)

def log_structured(level: str, message: str, category: str = LogCategory.APPLICATION, **kwargs):
    """Log with structured format"""
    advanced_logging.log_structured(level, message, category, **kwargs)

def log_request(method: str, endpoint: str, status_code: int, duration_ms: float, **kwargs):
    """Log API request"""
    advanced_logging.log_request(method, endpoint, status_code, duration_ms, **kwargs)

def log_security_event(event_type: str, message: str, severity: str = "WARNING", **kwargs):
    """Log security event"""
    advanced_logging.log_security_event(event_type, message, severity, **kwargs)

def log_performance_metric(metric_name: str, value: float, unit: str = "ms", **kwargs):
    """Log performance metric"""
    advanced_logging.log_performance_metric(metric_name, value, unit, **kwargs)

def log_business_event(event_type: str, message: str, **kwargs):
    """Log business event"""
    advanced_logging.log_business_event(event_type, message, **kwargs)

def get_log_anomalies() -> Dict[str, Any]:
    """Get current log anomalies"""
    return advanced_logging.get_anomalies()

def get_error_summary() -> Dict[str, Any]:
    """Get error summary"""
    return advanced_logging.get_error_summary()