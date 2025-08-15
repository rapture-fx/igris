"""
Sentry integration for comprehensive error tracking and performance monitoring
Provides enhanced error context, user tracking, and performance insights
"""

import os
import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from contextlib import contextmanager

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.threading import ThreadingIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration

from app.core.config import settings
from app.core.logging_config import (
    get_correlation_id, get_trace_id, get_span_id, get_request_id, get_logger
)

logger = get_logger("app.sentry")

class SentryIntegration:
    """Enhanced Sentry integration with custom context and error handling"""
    
    def __init__(self):
        self.is_initialized = False
        self.performance_monitoring_enabled = True
        self.error_sampling_rate = 1.0
        self.performance_sampling_rate = 0.1
        
        # Error classification rules
        self.critical_error_types = {
            "DatabaseError", "ConnectionError", "SecurityError",
            "DataCorruptionError", "SystemOutOfMemoryError"
        }
        
        self.business_error_types = {
            "ValidationError", "AuthenticationError", "PaymentError",
            "QuotaExceededError", "FeatureNotAvailableError"
        }
    
    def initialize(self) -> bool:
        """Initialize Sentry with comprehensive configuration"""
        
        if self.is_initialized:
            return True
        
        sentry_dsn = getattr(settings, 'SENTRY_DSN', None)
        if not sentry_dsn:
            logger.warning("Sentry DSN not configured - error tracking disabled")
            return False
        
        try:
            # Configure logging integration
            sentry_logging = LoggingIntegration(
                level=logging.INFO,        # Capture info and above as breadcrumbs
                event_level=logging.ERROR  # Send errors as events
            )
            
            # Initialize Sentry
            sentry_sdk.init(
                dsn=sentry_dsn,
                environment=getattr(settings, 'SENTRY_ENVIRONMENT', 'development'),
                release=f"schlep-engine@{getattr(settings, 'APP_VERSION', '1.0.0')}",
                
                # Integrations
                integrations=[
                    FastApiIntegration(auto_enabling_integrations=False),
                    SqlalchemyIntegration(),
                    RedisIntegration(),
                    CeleryIntegration(),
                    sentry_logging,
                    ThreadingIntegration(propagate_hub=True),
                    HttpxIntegration(),
                ],
                
                # Sampling rates
                traces_sample_rate=getattr(settings, 'SENTRY_TRACES_SAMPLE_RATE', 0.1),
                profiles_sample_rate=getattr(settings, 'SENTRY_PROFILES_SAMPLE_RATE', 0.1),
                
                # Performance monitoring
                enable_tracing=True,
                
                # Additional options
                attach_stacktrace=True,
                send_default_pii=False,  # Don't send personally identifiable information
                max_breadcrumbs=100,
                
                # Custom error filtering
                before_send=self._before_send_error,
                before_send_transaction=self._before_send_transaction,
            )
            
            # Set global tags
            sentry_sdk.set_tag("service", "schlep-engine-api")
            sentry_sdk.set_tag("environment", getattr(settings, 'ENVIRONMENT', 'development'))
            sentry_sdk.set_tag("version", getattr(settings, 'APP_VERSION', '1.0.0'))
            
            self.is_initialized = True
            logger.info("Sentry integration initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Sentry: {str(e)}")
            return False
    
    def _before_send_error(self, event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Filter and enhance error events before sending to Sentry"""
        
        # Add correlation context
        self._add_correlation_context(event)
        
        # Classify error severity
        error_type = self._get_error_type_from_event(event)
        if error_type:
            event.setdefault("tags", {})["error_classification"] = self._classify_error(error_type)
        
        # Filter out noisy errors in development
        if settings.is_development:
            if self._is_development_noise(event):
                return None
        
        # Enhance event with business context
        self._add_business_context(event)
        
        # Rate limit certain error types
        if self._should_rate_limit_error(event):
            return None
        
        return event
    
    def _before_send_transaction(self, event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Filter and enhance transaction events before sending to Sentry"""
        
        # Add correlation context
        self._add_correlation_context(event)
        
        # Filter out health check and metrics endpoints
        transaction_name = event.get("transaction", "")
        if any(endpoint in transaction_name for endpoint in ["/health", "/metrics", "/docs"]):
            return None
        
        # Add performance context
        self._add_performance_context(event)
        
        return event
    
    def _add_correlation_context(self, event: Dict[str, Any]) -> None:
        """Add correlation and tracing context to events"""
        tags = event.setdefault("tags", {})
        extra = event.setdefault("extra", {})
        
        # Add correlation IDs
        correlation_id = get_correlation_id()
        if correlation_id:
            tags["correlation_id"] = correlation_id
            extra["correlation_id"] = correlation_id
        
        trace_id = get_trace_id()
        if trace_id:
            tags["trace_id"] = trace_id
            extra["trace_id"] = trace_id
        
        span_id = get_span_id()
        if span_id:
            extra["span_id"] = span_id
        
        request_id = get_request_id()
        if request_id:
            tags["request_id"] = request_id
            extra["request_id"] = request_id
    
    def _add_business_context(self, event: Dict[str, Any]) -> None:
        """Add business-specific context to events"""
        extra = event.setdefault("extra", {})
        
        # Add timestamp
        extra["event_timestamp"] = datetime.utcnow().isoformat()
        
        # Add service context
        extra["service_context"] = {
            "service_name": "schlep-engine-api",
            "deployment_environment": getattr(settings, 'ENVIRONMENT', 'development'),
            "feature_flags": {
                "advanced_ai": getattr(settings, 'ENABLE_ADVANCED_AI', True),
                "ml_pipeline": getattr(settings, 'ENABLE_ML_PIPELINE', True),
                "monitoring": getattr(settings, 'ENABLE_MONITORING', True),
            }
        }
    
    def _add_performance_context(self, event: Dict[str, Any]) -> None:
        """Add performance-specific context to events"""
        extra = event.setdefault("extra", {})
        
        # Add performance thresholds
        extra["performance_thresholds"] = {
            "slow_request_threshold": 5.0,
            "critical_request_threshold": 30.0,
            "memory_warning_threshold": 80.0,
            "cpu_warning_threshold": 85.0
        }
    
    def _get_error_type_from_event(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract error type from Sentry event"""
        exception = event.get("exception", {})
        if exception and "values" in exception:
            values = exception["values"]
            if values and len(values) > 0:
                return values[-1].get("type")
        return None
    
    def _classify_error(self, error_type: str) -> str:
        """Classify error based on type"""
        if error_type in self.critical_error_types:
            return "critical"
        elif error_type in self.business_error_types:
            return "business"
        else:
            return "technical"
    
    def _is_development_noise(self, event: Dict[str, Any]) -> bool:
        """Check if error is development noise that should be filtered"""
        error_type = self._get_error_type_from_event(event)
        if not error_type:
            return False
        
        # Filter out common development errors
        noisy_errors = {
            "ConnectionRefusedError",  # Development database not running
            "FileNotFoundError",       # Missing development files
            "ImportError",             # Development dependency issues
        }
        
        return error_type in noisy_errors
    
    def _should_rate_limit_error(self, event: Dict[str, Any]) -> bool:
        """Check if error should be rate limited"""
        # Implement rate limiting logic for frequent errors
        # This is a simplified implementation
        return False
    
    def capture_exception(
        self,
        exception: Exception,
        level: str = "error",
        extra_context: Optional[Dict[str, Any]] = None,
        user_context: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> str:
        """Capture exception with enhanced context"""
        
        if not self.is_initialized:
            logger.error(f"Sentry not initialized, logging error: {str(exception)}")
            return ""
        
        with sentry_sdk.push_scope() as scope:
            # Set level
            scope.set_level(level)
            
            # Add extra context
            if extra_context:
                for key, value in extra_context.items():
                    scope.set_extra(key, value)
            
            # Add user context
            if user_context:
                scope.set_user(user_context)
            
            # Add tags
            if tags:
                for key, value in tags.items():
                    scope.set_tag(key, value)
            
            # Add correlation context
            self._add_scope_correlation_context(scope)
            
            # Capture the exception
            event_id = sentry_sdk.capture_exception(exception)
            
            logger.info(f"Exception captured by Sentry with ID: {event_id}")
            return event_id
    
    def capture_message(
        self,
        message: str,
        level: str = "info",
        extra_context: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> str:
        """Capture message with context"""
        
        if not self.is_initialized:
            logger.info(f"Sentry not initialized, logging message: {message}")
            return ""
        
        with sentry_sdk.push_scope() as scope:
            # Set level
            scope.set_level(level)
            
            # Add extra context
            if extra_context:
                for key, value in extra_context.items():
                    scope.set_extra(key, value)
            
            # Add tags
            if tags:
                for key, value in tags.items():
                    scope.set_tag(key, value)
            
            # Add correlation context
            self._add_scope_correlation_context(scope)
            
            # Capture the message
            event_id = sentry_sdk.capture_message(message, level)
            
            return event_id
    
    def add_breadcrumb(
        self,
        message: str,
        category: str = "custom",
        level: str = "info",
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Add breadcrumb for debugging context"""
        
        if not self.is_initialized:
            return
        
        sentry_sdk.add_breadcrumb(
            message=message,
            category=category,
            level=level,
            data=data or {}
        )
    
    def set_user_context(
        self,
        user_id: str,
        email: Optional[str] = None,
        username: Optional[str] = None,
        user_type: Optional[str] = None,
        plan_type: Optional[str] = None
    ) -> None:
        """Set user context for error tracking"""
        
        if not self.is_initialized:
            return
        
        user_data = {"id": user_id}
        
        if email:
            user_data["email"] = email
        if username:
            user_data["username"] = username
        if user_type:
            user_data["user_type"] = user_type
        if plan_type:
            user_data["plan_type"] = plan_type
        
        sentry_sdk.set_user(user_data)
    
    def set_request_context(
        self,
        request_id: str,
        endpoint: str,
        method: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """Set request context for error tracking"""
        
        if not self.is_initialized:
            return
        
        sentry_sdk.set_tag("request_id", request_id)
        sentry_sdk.set_tag("endpoint", endpoint)
        sentry_sdk.set_tag("method", method)
        
        if ip_address:
            sentry_sdk.set_tag("ip_address", ip_address)
        if user_agent:
            sentry_sdk.set_extra("user_agent", user_agent)
    
    def _add_scope_correlation_context(self, scope) -> None:
        """Add correlation context to Sentry scope"""
        correlation_id = get_correlation_id()
        if correlation_id:
            scope.set_tag("correlation_id", correlation_id)
        
        trace_id = get_trace_id()
        if trace_id:
            scope.set_tag("trace_id", trace_id)
        
        request_id = get_request_id()
        if request_id:
            scope.set_tag("request_id", request_id)
    
    @contextmanager
    def performance_transaction(
        self,
        name: str,
        operation: str = "custom",
        description: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None
    ):
        """Context manager for performance transaction tracking"""
        
        if not self.is_initialized:
            yield
            return
        
        with sentry_sdk.start_transaction(
            name=name,
            op=operation,
            description=description
        ) as transaction:
            
            # Add tags
            if tags:
                for key, value in tags.items():
                    transaction.set_tag(key, value)
            
            # Add correlation context
            correlation_id = get_correlation_id()
            if correlation_id:
                transaction.set_tag("correlation_id", correlation_id)
            
            yield transaction
    
    def record_performance_metric(
        self,
        metric_name: str,
        value: float,
        unit: str = "second",
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Record custom performance metric"""
        
        if not self.is_initialized:
            return
        
        # Add as breadcrumb for context
        self.add_breadcrumb(
            message=f"Performance metric: {metric_name}",
            category="performance",
            data={
                "metric_name": metric_name,
                "value": value,
                "unit": unit,
                "tags": tags or {}
            }
        )
    
    def flush(self, timeout: int = 2) -> bool:
        """Flush pending events to Sentry"""
        
        if not self.is_initialized:
            return True
        
        return sentry_sdk.flush(timeout=timeout)

# Global Sentry integration instance
sentry_integration = SentryIntegration()

# Convenience functions
def initialize_sentry() -> bool:
    """Initialize Sentry integration"""
    return sentry_integration.initialize()

def capture_exception(
    exception: Exception,
    level: str = "error",
    **kwargs
) -> str:
    """Capture exception with Sentry"""
    return sentry_integration.capture_exception(exception, level, **kwargs)

def capture_message(
    message: str,
    level: str = "info",
    **kwargs
) -> str:
    """Capture message with Sentry"""
    return sentry_integration.capture_message(message, level, **kwargs)

def add_breadcrumb(
    message: str,
    category: str = "custom",
    level: str = "info",
    data: Optional[Dict[str, Any]] = None
) -> None:
    """Add breadcrumb for debugging context"""
    sentry_integration.add_breadcrumb(message, category, level, data)

def set_user_context(
    user_id: str,
    email: Optional[str] = None,
    **kwargs
) -> None:
    """Set user context for error tracking"""
    sentry_integration.set_user_context(user_id, email, **kwargs)

def set_request_context(
    request_id: str,
    endpoint: str,
    method: str,
    **kwargs
) -> None:
    """Set request context for error tracking"""
    sentry_integration.set_request_context(request_id, endpoint, method, **kwargs)

def performance_transaction(
    name: str,
    operation: str = "custom",
    **kwargs
):
    """Context manager for performance transaction tracking"""
    return sentry_integration.performance_transaction(name, operation, **kwargs)

def record_performance_metric(
    metric_name: str,
    value: float,
    unit: str = "second",
    tags: Optional[Dict[str, str]] = None
) -> None:
    """Record custom performance metric"""
    sentry_integration.record_performance_metric(metric_name, value, unit, tags)

def flush_sentry(timeout: int = 2) -> bool:
    """Flush pending events to Sentry"""
    return sentry_integration.flush(timeout)