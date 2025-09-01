"""
COMPREHENSIVE MONITORING MIDDLEWARE
===================================

Advanced monitoring middleware that integrates all monitoring systems:
- Performance tracking and baselines
- Structured logging
- Alert generation
- Metrics collection
- SLA monitoring
"""

import time
import logging
import uuid
import asyncio
from typing import Callable, Optional
from datetime import datetime

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.advanced_logging import log_structured, LogLevel, LogCategory, get_logger
from app.core.metrics import record_http_request, record_auth_event, record_security_event
from app.core.performance_baseline import record_response_time, record_error_rate, check_performance_regression, MetricType
from app.core.alerting_system import create_performance_alert, create_security_alert, AlertSeverity

logger = get_logger(LogCategory.APPLICATION)


class ComprehensiveMonitoringMiddleware(BaseHTTPMiddleware):
    """Comprehensive monitoring middleware with full observability stack"""
    
    def __init__(self, app):
        super().__init__(app)
        self.request_count = 0
        self.error_count = 0
        self.security_events = 0
        self.performance_violations = 0
        
        # Response time thresholds for alerts
        self.response_time_warning_threshold = 1000.0  # 1 second
        self.response_time_critical_threshold = 3000.0  # 3 seconds
        
        # Error rate thresholds
        self.error_rate_window = 100  # Track last 100 requests
        self.error_rate_threshold = 5.0  # 5% error rate threshold
        
        # Track recent requests for error rate calculation
        self.recent_requests = []
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with comprehensive monitoring"""
        start_time = time.time()
        
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())[:8]
        request.state.correlation_id = correlation_id
        
        # Extract request information
        method = request.method
        path = request.url.path
        user_agent = request.headers.get("user-agent", "")
        ip_address = self._get_client_ip(request)
        user_id = self._get_user_id(request)
        
        # Increment request count
        self.request_count += 1
        
        # Log request start with structured logging
        log_structured(
            LogLevel.INFO,
            f"Request started: {method} {path}",
            category=LogCategory.API_ACCESS,
            request_id=correlation_id,
            method=method,
            endpoint=path,
            ip_address=ip_address,
            user_agent=user_agent,
            user_id=user_id
        )
        
        # Security monitoring
        await self._check_security_patterns(request, correlation_id)
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = duration * 1000
            
            # Track request outcome
            is_error = response.status_code >= 400
            if is_error:
                self.error_count += 1
            
            # Update recent requests for error rate tracking
            self.recent_requests.append({
                "timestamp": time.time(),
                "is_error": is_error,
                "status_code": response.status_code,
                "duration_ms": duration_ms
            })
            
            # Keep only recent requests
            cutoff_time = time.time() - 300  # 5 minutes
            self.recent_requests = [
                req for req in self.recent_requests 
                if req["timestamp"] > cutoff_time
            ]
            
            # Keep only last N requests for error rate calculation
            if len(self.recent_requests) > self.error_rate_window:
                self.recent_requests = self.recent_requests[-self.error_rate_window:]
            
            # Record metrics
            record_http_request(
                method=method,
                endpoint=path,
                status_code=response.status_code,
                duration=duration,
                user_type="authenticated" if user_id else "anonymous"
            )
            
            # Record performance metrics
            record_response_time(duration_ms, path, method)
            
            # Calculate and record error rate
            if len(self.recent_requests) >= 10:  # Only calculate if we have enough data
                error_count = sum(1 for req in self.recent_requests if req["is_error"])
                error_rate = (error_count / len(self.recent_requests)) * 100
                record_error_rate(error_rate, path)
                
                # Check for error rate threshold breach
                if error_rate > self.error_rate_threshold:
                    asyncio.create_task(self._handle_high_error_rate(error_rate, path, correlation_id))
            
            # Check for performance regressions
            regression_check = check_performance_regression(MetricType.RESPONSE_TIME, duration_ms)
            if regression_check and regression_check.get("is_regression", False):
                asyncio.create_task(self._handle_performance_regression(
                    duration_ms, regression_check, path, correlation_id
                ))
            
            # Check for slow response times
            if duration_ms > self.response_time_critical_threshold:
                asyncio.create_task(self._handle_slow_response(duration_ms, path, correlation_id, "critical"))
            elif duration_ms > self.response_time_warning_threshold:
                asyncio.create_task(self._handle_slow_response(duration_ms, path, correlation_id, "warning"))
            
            # Log successful response
            log_structured(
                LogLevel.INFO,
                f"Request completed: {method} {path} - {response.status_code}",
                category=LogCategory.API_ACCESS,
                request_id=correlation_id,
                method=method,
                endpoint=path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                ip_address=ip_address,
                user_id=user_id
            )
            
            # Add monitoring headers to response
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            response.headers["X-Request-ID"] = correlation_id
            
            return response
            
        except Exception as e:
            # Increment error count
            self.error_count += 1
            
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = duration * 1000
            
            # Log error with full context
            log_structured(
                LogLevel.ERROR,
                f"Request failed: {method} {path} - {str(e)}",
                category=LogCategory.APPLICATION,
                request_id=correlation_id,
                method=method,
                endpoint=path,
                status_code=500,
                duration_ms=duration_ms,
                error_type=type(e).__name__,
                error_trace=str(e),
                ip_address=ip_address,
                user_id=user_id
            )
            
            # Record error metrics
            record_http_request(
                method=method,
                endpoint=path,
                status_code=500,
                duration=duration,
                user_type="authenticated" if user_id else "anonymous"
            )
            
            # Create alert for server errors
            asyncio.create_task(create_performance_alert(
                title="Server Error in API Request",
                description=f"Server error in {method} {path}: {str(e)}",
                severity=AlertSeverity.HIGH,
                metadata={
                    "method": method,
                    "endpoint": path,
                    "error_type": type(e).__name__,
                    "correlation_id": correlation_id,
                    "duration_ms": duration_ms
                }
            ))
            
            # Return error response
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "Internal server error",
                    "correlation_id": correlation_id,
                    "timestamp": datetime.utcnow().isoformat()
                },
                headers={
                    "X-Correlation-ID": correlation_id,
                    "X-Response-Time": f"{duration:.3f}s",
                    "X-Error-ID": correlation_id
                }
            )
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _get_user_id(self, request: Request) -> Optional[str]:
        """Extract user ID from request if available"""
        # This would integrate with your authentication system
        # For now, check if there's a user in the request state
        return getattr(request.state, 'user_id', None)
    
    async def _check_security_patterns(self, request: Request, correlation_id: str):
        """Check for security patterns in requests"""
        try:
            path = request.url.path.lower()
            query = str(request.url.query).lower()
            user_agent = request.headers.get("user-agent", "").lower()
            
            # Check for common attack patterns
            attack_patterns = [
                # SQL Injection
                ("' or 1=1", "sql_injection"),
                ("union select", "sql_injection"),
                ("drop table", "sql_injection"),
                # XSS
                ("<script", "xss_attempt"),
                ("javascript:", "xss_attempt"),
                # Path traversal
                ("../", "path_traversal"),
                ("..\\", "path_traversal"),
                # Command injection
                ("; rm -rf", "command_injection"),
                ("| nc ", "command_injection")
            ]
            
            # Check path and query for attack patterns
            request_content = f"{path} {query}"
            for pattern, attack_type in attack_patterns:
                if pattern in request_content:
                    self.security_events += 1
                    
                    # Log security event
                    log_structured(
                        LogLevel.WARNING,
                        f"Potential {attack_type} detected in request",
                        category=LogCategory.SECURITY,
                        request_id=correlation_id,
                        attack_type=attack_type,
                        pattern_matched=pattern,
                        endpoint=request.url.path,
                        ip_address=self._get_client_ip(request),
                        user_agent=request.headers.get("user-agent", "")
                    )
                    
                    # Create security alert for serious attempts
                    if attack_type in ["sql_injection", "command_injection"]:
                        await create_security_alert(
                            title=f"Potential {attack_type.replace('_', ' ').title()} Detected",
                            description=f"Suspicious pattern '{pattern}' detected in request to {request.url.path}",
                            severity=AlertSeverity.HIGH,
                            metadata={
                                "attack_type": attack_type,
                                "pattern": pattern,
                                "endpoint": request.url.path,
                                "ip_address": self._get_client_ip(request),
                                "user_agent": request.headers.get("user-agent", ""),
                                "correlation_id": correlation_id
                            }
                        )
                    
                    break  # Only alert on first pattern match per request
            
            # Check for suspicious user agents
            suspicious_agents = ["sqlmap", "nikto", "nmap", "masscan", "zap"]
            for agent in suspicious_agents:
                if agent in user_agent:
                    self.security_events += 1
                    
                    log_structured(
                        LogLevel.WARNING,
                        f"Suspicious user agent detected: {agent}",
                        category=LogCategory.SECURITY,
                        request_id=correlation_id,
                        suspicious_agent=agent,
                        full_user_agent=request.headers.get("user-agent", ""),
                        ip_address=self._get_client_ip(request)
                    )
                    break
            
        except Exception as e:
            # Don't let security monitoring break the request
            log_structured(
                LogLevel.ERROR,
                f"Error in security monitoring: {str(e)}",
                category=LogCategory.SYSTEM,
                request_id=correlation_id,
                error_type="security_monitoring_error"
            )
    
    async def _handle_high_error_rate(self, error_rate: float, endpoint: str, correlation_id: str):
        """Handle high error rate detection"""
        await create_performance_alert(
            title="High Error Rate Detected",
            description=f"Error rate of {error_rate:.1f}% detected for endpoint {endpoint}",
            severity=AlertSeverity.HIGH if error_rate > 10 else AlertSeverity.MEDIUM,
            metadata={
                "error_rate_percent": error_rate,
                "endpoint": endpoint,
                "threshold": self.error_rate_threshold,
                "correlation_id": correlation_id
            }
        )
    
    async def _handle_performance_regression(self, duration_ms: float, regression_data: dict, endpoint: str, correlation_id: str):
        """Handle performance regression detection"""
        self.performance_violations += 1
        
        await create_performance_alert(
            title="Performance Regression Detected",
            description=f"Response time regression detected for {endpoint}: {duration_ms:.0f}ms (baseline: {regression_data.get('baseline_value', 0):.0f}ms)",
            severity=AlertSeverity.MEDIUM,
            metadata={
                "current_response_time_ms": duration_ms,
                "baseline_response_time_ms": regression_data.get("baseline_value"),
                "regression_percent": regression_data.get("regression_percent"),
                "endpoint": endpoint,
                "correlation_id": correlation_id
            }
        )
    
    async def _handle_slow_response(self, duration_ms: float, endpoint: str, correlation_id: str, severity_level: str):
        """Handle slow response detection"""
        severity = AlertSeverity.CRITICAL if severity_level == "critical" else AlertSeverity.MEDIUM
        
        await create_performance_alert(
            title=f"Slow Response Time - {severity_level.title()}",
            description=f"Slow response detected for {endpoint}: {duration_ms:.0f}ms",
            severity=severity,
            metadata={
                "response_time_ms": duration_ms,
                "threshold_ms": self.response_time_critical_threshold if severity_level == "critical" else self.response_time_warning_threshold,
                "endpoint": endpoint,
                "correlation_id": correlation_id
            }
        )
    
    def get_comprehensive_stats(self):
        """Get comprehensive middleware statistics"""
        current_time = time.time()
        recent_requests = [
            req for req in self.recent_requests 
            if current_time - req["timestamp"] < 300  # Last 5 minutes
        ]
        
        error_count = sum(1 for req in recent_requests if req["is_error"])
        error_rate = (error_count / len(recent_requests)) * 100 if recent_requests else 0
        
        avg_response_time = sum(req["duration_ms"] for req in recent_requests) / len(recent_requests) if recent_requests else 0
        
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "security_events": self.security_events,
            "performance_violations": self.performance_violations,
            "overall_error_rate": self.error_count / max(self.request_count, 1) * 100,
            "recent_stats": {
                "requests_last_5min": len(recent_requests),
                "error_rate_last_5min": error_rate,
                "avg_response_time_ms": avg_response_time,
                "errors_last_5min": error_count
            },
            "thresholds": {
                "response_time_warning_ms": self.response_time_warning_threshold,
                "response_time_critical_ms": self.response_time_critical_threshold,
                "error_rate_threshold_percent": self.error_rate_threshold
            }
        }


# Legacy class for backward compatibility
class MonitoringMiddleware(ComprehensiveMonitoringMiddleware):
    """Legacy monitoring middleware - now uses comprehensive version"""
    
    def get_stats(self):
        """Get basic middleware statistics for backward compatibility"""
        comprehensive_stats = self.get_comprehensive_stats()
        return {
            "total_requests": comprehensive_stats["total_requests"],
            "total_errors": comprehensive_stats["total_errors"],
            "error_rate": comprehensive_stats["overall_error_rate"] / 100  # Convert back to decimal
        }


def create_monitoring_middleware():
    """Factory function to create comprehensive monitoring middleware"""
    return ComprehensiveMonitoringMiddleware