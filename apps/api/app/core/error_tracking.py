"""
Error tracking and alerting system for Schlep-engine
Integrates with Sentry for error monitoring and alerting
"""

import os
import sys
import traceback
import asyncio
from typing import Any, Dict, Optional, List, Callable
from datetime import datetime, timedelta
from contextlib import contextmanager
import logging
import json
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger(__name__)

class ErrorSeverity(str, Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(str, Enum):
    """Error categories for classification"""
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    VALIDATION = "validation"
    DATABASE = "database"
    EXTERNAL_API = "external_api"
    STORAGE = "storage"
    NETWORK = "network"
    SYSTEM = "system"
    BUSINESS_LOGIC = "business_logic"
    SECURITY = "security"

@dataclass
class ErrorContext:
    """Context information for error tracking"""
    user_id: Optional[str] = None
    request_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None
    environment: Optional[str] = None
    version: Optional[str] = None

@dataclass
class ErrorEvent:
    """Error event for tracking and alerting"""
    error_type: str
    message: str
    severity: ErrorSeverity
    category: ErrorCategory
    context: ErrorContext
    timestamp: datetime
    stack_trace: Optional[str] = None
    tags: Optional[Dict[str, str]] = None
    extra_data: Optional[Dict[str, Any]] = None

class ErrorTracker:
    """Main error tracking and alerting system"""
    
    def __init__(self):
        self.sentry_initialized = False
        self.error_handlers: List[Callable[[ErrorEvent], None]] = []
        self.alert_thresholds: Dict[ErrorSeverity, int] = {
            ErrorSeverity.LOW: 100,
            ErrorSeverity.MEDIUM: 50,
            ErrorSeverity.HIGH: 10,
            ErrorSeverity.CRITICAL: 1
        }
        self.error_counts: Dict[str, int] = {}
        self.last_reset = datetime.utcnow()
        
        # Initialize Sentry if available
        self._initialize_sentry()
    
    def _initialize_sentry(self) -> None:
        """Initialize Sentry SDK"""
        if not SENTRY_AVAILABLE:
            logger.warning("Sentry SDK not available. Error tracking will be limited.")
            return
        
        sentry_dsn = getattr(settings, 'SENTRY_DSN', None)
        if not sentry_dsn:
            logger.warning("SENTRY_DSN not configured. Sentry integration disabled.")
            return
        
        try:
            sentry_sdk.init(
                dsn=sentry_dsn,
                environment=getattr(settings, 'ENVIRONMENT', 'development'),
                release=getattr(settings, 'APP_VERSION', '1.0.0'),
                traces_sample_rate=getattr(settings, 'SENTRY_TRACES_SAMPLE_RATE', 0.1),
                profiles_sample_rate=getattr(settings, 'SENTRY_PROFILES_SAMPLE_RATE', 0.1),
                integrations=[
                    FastApiIntegration(),
                    SqlalchemyIntegration(),
                    RedisIntegration(),
                    CeleryIntegration(),
                ],
                before_send=self._before_send_to_sentry,
                before_breadcrumb=self._before_breadcrumb_to_sentry,
            )
            self.sentry_initialized = True
            logger.info("Sentry initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Sentry: {e}")
    
    def _before_send_to_sentry(self, event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Filter events before sending to Sentry"""
        # Don't send certain types of errors to Sentry
        if 'exception' in event:
            exception = event['exception']
            if exception and 'values' in exception:
                for value in exception['values']:
                    if 'type' in value:
                        # Filter out certain error types
                        if value['type'] in ['ValidationError', 'HTTPException']:
                            return None
        
        # Add custom tags and context
        event.setdefault('tags', {}).update({
            'service': 'schlep-engine',
            'component': 'backend'
        })
        
        return event
    
    def _before_breadcrumb_to_sentry(self, breadcrumb: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Filter breadcrumbs before sending to Sentry"""
        # Don't send sensitive breadcrumbs
        if 'message' in breadcrumb:
            message = breadcrumb['message']
            sensitive_keywords = ['password', 'token', 'secret', 'key']
            if any(keyword in message.lower() for keyword in sensitive_keywords):
                return None
        
        return breadcrumb
    
    def add_error_handler(self, handler: Callable[[ErrorEvent], None]) -> None:
        """Add a custom error handler"""
        self.error_handlers.append(handler)
    
    def capture_exception(
        self,
        exception: Exception,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        context: Optional[ErrorContext] = None,
        tags: Optional[Dict[str, str]] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Capture and track an exception"""
        try:
            # Create error event
            error_event = ErrorEvent(
                error_type=type(exception).__name__,
                message=str(exception),
                severity=severity,
                category=category,
                context=context or ErrorContext(),
                timestamp=datetime.utcnow(),
                stack_trace=traceback.format_exc(),
                tags=tags or {},
                extra_data=extra_data or {}
            )
            
            # Send to Sentry if available
            if self.sentry_initialized:
                self._send_to_sentry(error_event)
            
            # Call custom handlers
            for handler in self.error_handlers:
                try:
                    handler(error_event)
                except Exception as e:
                    logger.error(f"Error in custom error handler: {e}")
            
            # Update error counts
            self._update_error_counts(error_event)
            
            # Check for alerting
            self._check_alerting(error_event)
            
            # Log the error
            logger.error(
                f"Error captured: {error_event.error_type} - {error_event.message}",
                extra={
                    "error_event": asdict(error_event),
                    "severity": severity.value,
                    "category": category.value
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to capture exception: {e}")
    
    def capture_message(
        self,
        message: str,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        context: Optional[ErrorContext] = None,
        tags: Optional[Dict[str, str]] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Capture and track a message"""
        try:
            # Create error event
            error_event = ErrorEvent(
                error_type="Message",
                message=message,
                severity=severity,
                category=category,
                context=context or ErrorContext(),
                timestamp=datetime.utcnow(),
                tags=tags or {},
                extra_data=extra_data or {}
            )
            
            # Send to Sentry if available
            if self.sentry_initialized:
                self._send_to_sentry(error_event)
            
            # Call custom handlers
            for handler in self.error_handlers:
                try:
                    handler(error_event)
                except Exception as e:
                    logger.error(f"Error in custom error handler: {e}")
            
            # Update error counts
            self._update_error_counts(error_event)
            
            # Check for alerting
            self._check_alerting(error_event)
            
            # Log the message
            logger.warning(
                f"Message captured: {message}",
                extra={
                    "error_event": asdict(error_event),
                    "severity": severity.value,
                    "category": category.value
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to capture message: {e}")
    
    def _send_to_sentry(self, error_event: ErrorEvent) -> None:
        """Send error event to Sentry"""
        if not self.sentry_initialized:
            return
        
        try:
            # Set user context
            if error_event.context.user_id:
                sentry_sdk.set_user({"id": error_event.context.user_id})
            
            # Set tags
            tags = {
                "severity": error_event.severity.value,
                "category": error_event.category.value,
                "service": "schlep-engine",
                **error_event.tags
            }
            
            if error_event.context.request_id:
                tags["request_id"] = error_event.context.request_id
            
            sentry_sdk.set_tag("severity", error_event.severity.value)
            sentry_sdk.set_tag("category", error_event.category.value)
            
            # Set extra data
            extra_data = {
                "context": asdict(error_event.context),
                **error_event.extra_data
            }
            
            # Capture exception or message
            if error_event.stack_trace:
                # This is an exception
                sentry_sdk.capture_exception(
                    extra=extra_data,
                    tags=tags
                )
            else:
                # This is a message
                sentry_sdk.capture_message(
                    error_event.message,
                    level=self._get_sentry_level(error_event.severity),
                    extra=extra_data,
                    tags=tags
                )
                
        except Exception as e:
            logger.error(f"Failed to send to Sentry: {e}")
    
    def _get_sentry_level(self, severity: ErrorSeverity) -> str:
        """Convert severity to Sentry level"""
        mapping = {
            ErrorSeverity.LOW: "info",
            ErrorSeverity.MEDIUM: "warning",
            ErrorSeverity.HIGH: "error",
            ErrorSeverity.CRITICAL: "fatal"
        }
        return mapping.get(severity, "error")
    
    def _update_error_counts(self, error_event: ErrorEvent) -> None:
        """Update error counts for alerting"""
        # Reset counts if needed (every hour)
        if datetime.utcnow() - self.last_reset > timedelta(hours=1):
            self.error_counts.clear()
            self.last_reset = datetime.utcnow()
        
        # Create error key
        error_key = f"{error_event.category.value}:{error_event.error_type}"
        self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
    
    def _check_alerting(self, error_event: ErrorEvent) -> None:
        """Check if alerting is needed"""
        error_key = f"{error_event.category.value}:{error_event.error_type}"
        count = self.error_counts.get(error_key, 0)
        threshold = self.alert_thresholds.get(error_event.severity, 10)
        
        if count >= threshold:
            self._send_alert(error_event, count, threshold)
    
    def _send_alert(self, error_event: ErrorEvent, count: int, threshold: int) -> None:
        """Send alert for error threshold exceeded"""
        alert_message = {
            "type": "error_threshold_exceeded",
            "error_type": error_event.error_type,
            "category": error_event.category.value,
            "severity": error_event.severity.value,
            "count": count,
            "threshold": threshold,
            "message": error_event.message,
            "timestamp": datetime.utcnow().isoformat(),
            "context": asdict(error_event.context)
        }
        
        # Log alert
        logger.critical(
            f"Error threshold exceeded: {error_event.error_type} (count: {count}, threshold: {threshold})",
            extra={"alert": alert_message}
        )
        
        # Send to external alerting system (e.g., Slack, email)
        self._send_external_alert(alert_message)
    
    def _send_external_alert(self, alert_message: Dict[str, Any]) -> None:
        """Send alert to external systems"""
        # This would integrate with your preferred alerting system
        # Examples: Slack, email, PagerDuty, etc.
        
        # For now, just log the alert
        logger.critical(f"ALERT: {json.dumps(alert_message, indent=2)}")
    
    @contextmanager
    def capture_errors(self, context: Optional[ErrorContext] = None):
        """Context manager to capture errors"""
        try:
            yield
        except Exception as e:
            self.capture_exception(e, context=context)
            raise
    
    def set_user_context(self, user_id: str) -> None:
        """Set user context for error tracking"""
        if self.sentry_initialized:
            sentry_sdk.set_user({"id": user_id})
    
    def set_request_context(self, request_id: str, endpoint: str, method: str) -> None:
        """Set request context for error tracking"""
        if self.sentry_initialized:
            sentry_sdk.set_tag("request_id", request_id)
            sentry_sdk.set_tag("endpoint", endpoint)
            sentry_sdk.set_tag("method", method)
    
    def add_breadcrumb(self, message: str, category: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Add breadcrumb for debugging"""
        if self.sentry_initialized:
            sentry_sdk.add_breadcrumb(
                message=message,
                category=category,
                data=data or {},
                level="info"
            )

# Global error tracker instance
error_tracker = ErrorTracker()

# Convenience functions
def capture_exception(
    exception: Exception,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context: Optional[ErrorContext] = None,
    tags: Optional[Dict[str, str]] = None,
    extra_data: Optional[Dict[str, Any]] = None
) -> None:
    """Capture an exception"""
    error_tracker.capture_exception(exception, severity, category, context, tags, extra_data)

def capture_message(
    message: str,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context: Optional[ErrorContext] = None,
    tags: Optional[Dict[str, str]] = None,
    extra_data: Optional[Dict[str, Any]] = None
) -> None:
    """Capture a message"""
    error_tracker.capture_message(message, severity, category, context, tags, extra_data)

@contextmanager
def capture_errors(context: Optional[ErrorContext] = None):
    """Context manager to capture errors"""
    with error_tracker.capture_errors(context):
        yield

def set_user_context(user_id: str) -> None:
    """Set user context for error tracking"""
    error_tracker.set_user_context(user_id)

def set_request_context(request_id: str, endpoint: str, method: str) -> None:
    """Set request context for error tracking"""
    error_tracker.set_request_context(request_id, endpoint, method)

def add_breadcrumb(message: str, category: str, data: Optional[Dict[str, Any]] = None) -> None:
    """Add breadcrumb for debugging"""
    error_tracker.add_breadcrumb(message, category, data) 