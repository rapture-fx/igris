"""
Monitoring middleware for Schlep-engine
Integrates logging, metrics, and error tracking for comprehensive monitoring
"""

import time
import uuid
import json
from typing import Callable, Optional
from contextvars import ContextVar
from fastapi import Request, Response
from fastapi.responses import StreamingResponse
import logging

from app.core.logging_config import (
    log_request_start, log_request_end, request_id_var, user_id_var, session_id_var
)
from app.core.metrics import record_http_request
from app.core.error_tracking import (
    capture_exception, ErrorSeverity, ErrorCategory, ErrorContext, set_user_context, set_request_context, add_breadcrumb
)

logger = logging.getLogger(__name__)

# Context variables for request tracking
request_start_time_var: ContextVar[Optional[float]] = ContextVar('request_start_time', default=None)

class MonitoringMiddleware:
    """Comprehensive monitoring middleware"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Create request object
        request = Request(scope, receive)
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        request_start_time = time.time()
        
        # Set context variables
        request_id_var.set(request_id)
        request_start_time_var.set(request_start_time)
        
        # Extract user information if available
        user_id = None
        session_id = None
        
        # Try to get user from authorization header or session
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # In a real implementation, you'd decode the JWT token here
            # For now, we'll use a placeholder
            user_id = "user_from_token"
        
        # Get session ID from cookies
        session_id = request.cookies.get("session_id")
        
        # Set user context
        if user_id:
            user_id_var.set(user_id)
            set_user_context(user_id)
        
        if session_id:
            session_id_var.set(session_id)
        
        # Set request context for error tracking
        set_request_context(
            request_id=request_id,
            endpoint=str(request.url.path),
            method=request.method
        )
        
        # Add breadcrumb for request start
        add_breadcrumb(
            message=f"Request started: {request.method} {request.url.path}",
            category="http",
            data={
                "method": request.method,
                "url": str(request.url),
                "headers": dict(request.headers),
                "query_params": dict(request.query_params)
            }
        )
        
        # Log request start
        log_request_start(
            request_id=request_id,
            method=request.method,
            url=str(request.url.path),
            user_id=user_id
        )
        
        # Create custom send function to capture response
        async def custom_send(message):
            if message["type"] == "http.response.start":
                # Capture response status
                status_code = message.get("status", 500)
                
                # Record metrics
                duration = time.time() - request_start_time
                record_http_request(
                    method=request.method,
                    endpoint=str(request.url.path),
                    status_code=status_code,
                    duration=duration,
                    request_size=len(await request.body()) if request.method in ["POST", "PUT", "PATCH"] else None,
                    user_type="authenticated" if user_id else "anonymous"
                )
                
                # Log request end
                log_request_end(
                    request_id=request_id,
                    method=request.method,
                    url=str(request.url.path),
                    status_code=status_code,
                    duration=duration,
                    user_id=user_id
                )
                
                # Add breadcrumb for request completion
                add_breadcrumb(
                    message=f"Request completed: {request.method} {request.url.path} - {status_code}",
                    category="http",
                    data={
                        "status_code": status_code,
                        "duration": duration,
                        "response_size": message.get("headers", {}).get("content-length", 0)
                    }
                )
                
                # Capture errors for non-2xx status codes
                if status_code >= 400:
                    error_context = ErrorContext(
                        user_id=user_id,
                        request_id=request_id,
                        session_id=session_id,
                        ip_address=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        endpoint=str(request.url.path),
                        method=request.method,
                        parameters=dict(request.query_params),
                        headers=dict(request.headers)
                    )
                    
                    if status_code >= 500:
                        capture_exception(
                            Exception(f"HTTP {status_code} error"),
                            severity=ErrorSeverity.HIGH,
                            category=ErrorCategory.SYSTEM,
                            context=error_context
                        )
                    else:
                        capture_exception(
                            Exception(f"HTTP {status_code} error"),
                            severity=ErrorSeverity.MEDIUM,
                            category=ErrorCategory.VALIDATION,
                            context=error_context
                        )
            
            await send(message)
        
        try:
            await self.app(scope, receive, custom_send)
        except Exception as e:
            # Capture unhandled exceptions
            duration = time.time() - request_start_time
            
            error_context = ErrorContext(
                user_id=user_id,
                request_id=request_id,
                session_id=session_id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                endpoint=str(request.url.path),
                method=request.method,
                parameters=dict(request.query_params),
                headers=dict(request.headers)
            )
            
            capture_exception(
                e,
                severity=ErrorSeverity.CRITICAL,
                category=ErrorCategory.SYSTEM,
                context=error_context
            )
            
            # Record error metrics
            record_http_request(
                method=request.method,
                endpoint=str(request.url.path),
                status_code=500,
                duration=duration,
                user_type="authenticated" if user_id else "anonymous"
            )
            
            # Log request end with error
            log_request_end(
                request_id=request_id,
                method=request.method,
                url=str(request.url.path),
                status_code=500,
                duration=duration,
                user_id=user_id
            )
            
            # Re-raise the exception
            raise

class PerformanceMonitoringMiddleware:
    """Middleware for performance monitoring and profiling"""
    
    def __init__(self, app):
        self.app = app
        self.slow_request_threshold = 5.0  # seconds
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        start_time = time.time()
        
        # Create custom send function to measure response time
        async def custom_send(message):
            if message["type"] == "http.response.start":
                duration = time.time() - start_time
                
                # Log slow requests
                if duration > self.slow_request_threshold:
                    logger.warning(
                        f"Slow request detected: {request.method} {request.url.path} took {duration:.2f}s",
                        extra={
                            "slow_request": True,
                            "duration": duration,
                            "threshold": self.slow_request_threshold,
                            "method": request.method,
                            "endpoint": str(request.url.path)
                        }
                    )
                    
                    # Capture slow request as performance issue
                    add_breadcrumb(
                        message=f"Slow request: {request.method} {request.url.path}",
                        category="performance",
                        data={
                            "duration": duration,
                            "threshold": self.slow_request_threshold,
                            "method": request.method,
                            "endpoint": str(request.url.path)
                        }
                    )
            
            await send(message)
        
        await self.app(scope, receive, custom_send)

class SecurityMonitoringMiddleware:
    """Middleware for security monitoring and threat detection"""
    
    def __init__(self, app):
        self.app = app
        self.suspicious_patterns = [
            "sql injection",
            "xss",
            "path traversal",
            "command injection",
            "ldap injection"
        ]
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        
        # Check for suspicious patterns in request
        await self._check_security_threats(request)
        
        # Create custom send function to monitor responses
        async def custom_send(message):
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                
                # Monitor for security-related status codes
                if status_code in [401, 403, 429]:
                    add_breadcrumb(
                        message=f"Security-related response: {status_code}",
                        category="security",
                        data={
                            "status_code": status_code,
                            "method": request.method,
                            "endpoint": str(request.url.path),
                            "ip_address": request.client.host if request.client else None
                        }
                    )
            
            await send(message)
        
        await self.app(scope, receive, custom_send)
    
    async def _check_security_threats(self, request: Request):
        """Check for potential security threats"""
        # Check URL for suspicious patterns
        url_str = str(request.url).lower()
        for pattern in self.suspicious_patterns:
            if pattern in url_str:
                self._log_security_threat("suspicious_url_pattern", request, pattern)
        
        # Check query parameters
        for param_name, param_value in request.query_params.items():
            param_str = f"{param_name}={param_value}".lower()
            for pattern in self.suspicious_patterns:
                if pattern in param_str:
                    self._log_security_threat("suspicious_query_param", request, pattern)
        
        # Check headers for suspicious values
        user_agent = request.headers.get("user-agent", "").lower()
        if any(pattern in user_agent for pattern in ["sqlmap", "nikto", "nmap"]):
            self._log_security_threat("suspicious_user_agent", request, user_agent)
        
        # Check for excessive request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB
            self._log_security_threat("large_request", request, f"Size: {content_length}")
    
    def _log_security_threat(self, threat_type: str, request: Request, details: str):
        """Log security threat detection"""
        from app.core.error_tracking import log_security_event
        
        log_security_event(
            event_type=threat_type,
            details={
                "method": request.method,
                "url": str(request.url),
                "ip_address": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "details": details
            },
            user_id=None,  # Unknown user for security threats
            ip_address=request.client.host if request.client else None
        )
        
        add_breadcrumb(
            message=f"Security threat detected: {threat_type}",
            category="security",
            data={
                "threat_type": threat_type,
                "method": request.method,
                "url": str(request.url),
                "ip_address": request.client.host if request.client else None,
                "details": details
            }
        )

class BusinessMetricsMiddleware:
    """Middleware for tracking business metrics"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        
        # Create custom send function to track business metrics
        async def custom_send(message):
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                
                # Track API usage
                if status_code == 200:
                    from app.core.metrics import record_business_event
                    
                    # Determine user type and plan
                    user_type = "authenticated"  # This would be determined from auth
                    plan_type = "free"  # This would be determined from user data
                    
                    record_business_event(
                        event_type="api_call",
                        user_type=user_type,
                        plan_type=plan_type
                    )
                
                # Track successful operations
                if status_code == 200 and request.method in ["POST", "PUT", "DELETE"]:
                    endpoint = str(request.url.path)
                    
                    if "/upload" in endpoint:
                        from app.core.metrics import record_data_processing
                        record_data_processing(
                            file_type="unknown",
                            processing_type="upload",
                            status="uploaded",
                            duration=0.1,  # Placeholder
                            user_type="user"
                        )
                    elif "/ml" in endpoint:
                        from app.core.metrics import record_ml_job
                        record_ml_job(
                            job_type="training",
                            model_type="unknown",
                            status="created",
                            user_type="user"
                        )
            
            await send(message)
        
        await self.app(scope, receive, custom_send)

def create_monitoring_middleware(app):
    """Create and apply all monitoring middleware"""
    app = MonitoringMiddleware(app)
    app = PerformanceMonitoringMiddleware(app)
    app = SecurityMonitoringMiddleware(app)
    app = BusinessMetricsMiddleware(app)
    return app 