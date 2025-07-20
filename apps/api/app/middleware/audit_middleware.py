"""
Audit Middleware

This middleware provides comprehensive logging and auditing of all API requests
with security context, user information, and request/response details.

Features:
- Request/response logging with timing
- User context extraction
- Security event correlation
- Sensitive data masking
- Async logging for performance
- Decorator-based implementation
- Integration with enhanced authentication

Usage:
    @audit_request
    @router.get("/sensitive-endpoint")
    async def sensitive_operation():
        return {"data": "sensitive"}
        
    @audit_request(
        log_request_body=True,
        log_response_body=False,
        mask_fields=["password", "credit_card"]
    )
    @router.post("/payment")
    async def process_payment():
        return {"status": "success"}
"""

import json
import time
import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any, Callable, Set
from functools import wraps
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import re

from fastapi import Request, Response, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from app.auth.enhanced_security import enhanced_security, SecurityLevel
from app.auth.enhanced_dependencies import get_user_session_info

logger = logging.getLogger(__name__)

class AuditEventType(Enum):
    """Types of audit events"""
    API_REQUEST = "api_request"
    API_RESPONSE = "api_response"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    ERROR = "error"
    SECURITY_VIOLATION = "security_violation"
    DATA_ACCESS = "data_access"
    SENSITIVE_OPERATION = "sensitive_operation"

class AuditSeverity(Enum):
    """Audit event severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class AuditEvent:
    """Audit event data structure"""
    event_id: str
    event_type: AuditEventType
    severity: AuditSeverity
    timestamp: datetime
    user_id: Optional[str] = None
    username: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    method: Optional[str] = None
    path: Optional[str] = None
    status_code: Optional[int] = None
    duration_ms: Optional[float] = None
    request_size: Optional[int] = None
    response_size: Optional[int] = None
    security_level: Optional[str] = None
    request_headers: Optional[Dict[str, str]] = None
    request_body_hash: Optional[str] = None
    response_body_hash: Optional[str] = None
    error_message: Optional[str] = None
    security_context: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class AuditLogger:
    """Centralized audit logging system"""
    
    def __init__(self):
        self._audit_queue = asyncio.Queue()
        self._sensitive_fields = {
            'password', 'token', 'secret', 'key', 'auth', 'authorization',
            'credit_card', 'card_number', 'cvv', 'ssn', 'social_security',
            'api_key', 'private_key', 'refresh_token', 'access_token'
        }
        self._pii_patterns = [
            (r'\b\d{3}-\d{2}-\d{4}\b', 'SSN'),  # SSN
            (r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', 'CARD'),  # Credit card
            (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'EMAIL'),  # Email
            (r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', 'PHONE'),  # Phone
        ]
        self._running = False
        self._background_task = None
    
    async def start(self):
        """Start the audit logger background task"""
        if not self._running:
            self._running = True
            self._background_task = asyncio.create_task(self._process_audit_queue())
    
    async def stop(self):
        """Stop the audit logger"""
        self._running = False
        if self._background_task:
            await self._background_task
    
    async def log_event(self, event: AuditEvent):
        """Queue an audit event for logging"""
        await self._audit_queue.put(event)
    
    async def _process_audit_queue(self):
        """Background task to process audit events"""
        while self._running:
            try:
                # Get event with timeout to allow graceful shutdown
                event = await asyncio.wait_for(
                    self._audit_queue.get(), 
                    timeout=1.0
                )
                await self._write_audit_event(event)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing audit event: {e}")
    
    async def _write_audit_event(self, event: AuditEvent):
        """Write audit event to storage"""
        try:
            # Format event for logging
            log_data = {
                "audit_event": asdict(event),
                "timestamp_iso": event.timestamp.isoformat(),
                "event_id": event.event_id
            }
            
            # Log to structured logger
            if event.severity == AuditSeverity.CRITICAL:
                logger.critical(json.dumps(log_data))
            elif event.severity == AuditSeverity.HIGH:
                logger.error(json.dumps(log_data))
            elif event.severity == AuditSeverity.MEDIUM:
                logger.warning(json.dumps(log_data))
            else:
                logger.info(json.dumps(log_data))
            
            # Store in enhanced security system for correlation
            if event.user_id and event.event_type == AuditEventType.API_REQUEST:
                enhanced_security.record_authentication_attempt(
                    username=event.username or "unknown",
                    ip_address=event.ip_address or "unknown",
                    user_agent=event.user_agent or "unknown",
                    method=enhanced_security.AuthenticationMethod.PASSWORD,
                    success=event.status_code < 400 if event.status_code else True
                )
                
        except Exception as e:
            logger.error(f"Failed to write audit event: {e}")
    
    def mask_sensitive_data(self, data: Any, mask_fields: Set[str] = None) -> Any:
        """Mask sensitive data in requests/responses"""
        if mask_fields is None:
            mask_fields = self._sensitive_fields
        
        if isinstance(data, dict):
            masked = {}
            for key, value in data.items():
                if any(field.lower() in key.lower() for field in mask_fields):
                    masked[key] = "***MASKED***"
                else:
                    masked[key] = self.mask_sensitive_data(value, mask_fields)
            return masked
        elif isinstance(data, list):
            return [self.mask_sensitive_data(item, mask_fields) for item in data]
        elif isinstance(data, str):
            # Mask PII patterns
            masked_str = data
            for pattern, replacement in self._pii_patterns:
                masked_str = re.sub(pattern, f"***{replacement}***", masked_str)
            return masked_str
        else:
            return data
    
    def hash_content(self, content: str) -> str:
        """Create SHA-256 hash of content for integrity verification"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]

# Global audit logger instance
audit_logger = AuditLogger()

def extract_user_context(request: Request) -> Dict[str, Any]:
    """Extract user context from request"""
    context = {
        "user_id": None,
        "username": None,
        "session_id": None,
        "security_level": None,
        "mfa_verified": False
    }
    
    try:
        # Extract from Authorization header
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            payload = enhanced_security.enhanced_verify_token(token)
            if payload:
                context["user_id"] = payload.get("sub")
                context["session_id"] = payload.get("session_id")
                context["security_level"] = payload.get("security_level")
                
                # Get session info for additional context
                session_id = payload.get("session_id")
                if session_id and session_id in enhanced_security._sessions:
                    session = enhanced_security._sessions[session_id]
                    context["mfa_verified"] = session.mfa_verified
                    context["username"] = getattr(session, 'username', None)
    except Exception as e:
        logger.debug(f"Could not extract user context: {e}")
    
    return context

def get_client_info(request: Request) -> Dict[str, str]:
    """Extract client information from request"""
    return {
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "origin": request.headers.get("origin", "unknown"),
        "referer": request.headers.get("referer", "unknown"),
        "x_forwarded_for": request.headers.get("x-forwarded-for", "unknown")
    }

def determine_event_severity(
    method: str, 
    path: str, 
    status_code: int,
    user_context: Dict[str, Any]
) -> AuditSeverity:
    """Determine audit event severity based on context"""
    # Critical operations
    if any(keyword in path.lower() for keyword in [
        'admin', 'delete', 'remove', 'destroy', 'wipe', 'purge'
    ]):
        return AuditSeverity.CRITICAL
    
    # High severity for authentication and sensitive operations
    if any(keyword in path.lower() for keyword in [
        'auth', 'login', 'password', 'mfa', 'token', 'key', 'secret'
    ]):
        return AuditSeverity.HIGH
    
    # High severity for errors
    if status_code >= 500:
        return AuditSeverity.HIGH
    elif status_code >= 400:
        return AuditSeverity.MEDIUM
    
    # Medium severity for sensitive data access
    if any(keyword in path.lower() for keyword in [
        'user', 'profile', 'account', 'payment', 'billing'
    ]):
        return AuditSeverity.MEDIUM
    
    return AuditSeverity.LOW

async def create_audit_event(
    request: Request,
    response: Optional[Response] = None,
    duration_ms: Optional[float] = None,
    error: Optional[Exception] = None,
    **kwargs
) -> AuditEvent:
    """Create audit event from request/response"""
    user_context = extract_user_context(request)
    client_info = get_client_info(request)
    
    event_id = f"audit_{int(time.time())}_{hashlib.md5(str(request.url).encode()).hexdigest()[:8]}"
    
    status_code = response.status_code if response else (500 if error else 200)
    severity = determine_event_severity(
        request.method, 
        request.url.path, 
        status_code,
        user_context
    )
    
    # Extract request size
    request_size = None
    if hasattr(request, 'body'):
        try:
            body = await request.body()
            request_size = len(body)
        except:
            pass
    
    # Extract response size
    response_size = None
    if response and hasattr(response, 'body'):
        try:
            response_size = len(response.body)
        except:
            pass
    
    return AuditEvent(
        event_id=event_id,
        event_type=AuditEventType.API_REQUEST,
        severity=severity,
        timestamp=datetime.now(timezone.utc),
        user_id=user_context.get("user_id"),
        username=user_context.get("username"),
        session_id=user_context.get("session_id"),
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"],
        request_id=getattr(request.state, "request_id", None),
        method=request.method,
        path=request.url.path,
        status_code=status_code,
        duration_ms=duration_ms,
        request_size=request_size,
        response_size=response_size,
        security_level=user_context.get("security_level"),
        request_headers=dict(request.headers),
        error_message=str(error) if error else None,
        security_context=user_context,
        metadata=kwargs
    )

# Decorator for endpoint-level auditing
def audit_request(
    log_request_body: bool = False,
    log_response_body: bool = False,
    mask_fields: Set[str] = None,
    severity_override: Optional[AuditSeverity] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Decorator to add audit logging to API endpoints.
    
    Args:
        log_request_body: Whether to log request body (hashed)
        log_response_body: Whether to log response body (hashed)
        mask_fields: Additional fields to mask beyond defaults
        severity_override: Override automatic severity determination
        metadata: Additional metadata to include in audit log
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # Look in kwargs
                request = kwargs.get('request')
            
            if not request:
                # If no request found, execute function normally
                return await func(*args, **kwargs)
            
            start_time = time.time()
            response = None
            error = None
            
            try:
                # Execute the function
                response = await func(*args, **kwargs)
                return response
            except Exception as e:
                error = e
                raise
            finally:
                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000
                
                # Create audit event
                audit_metadata = metadata or {}
                audit_metadata.update({
                    "function_name": func.__name__,
                    "module": func.__module__,
                    "log_request_body": log_request_body,
                    "log_response_body": log_response_body
                })
                
                try:
                    event = await create_audit_event(
                        request=request,
                        response=response,
                        duration_ms=duration_ms,
                        error=error,
                        **audit_metadata
                    )
                    
                    # Override severity if specified
                    if severity_override:
                        event.severity = severity_override
                    
                    # Add request/response body hashes if requested
                    if log_request_body:
                        try:
                            body = await request.body()
                            if body:
                                masked_body = audit_logger.mask_sensitive_data(
                                    body.decode('utf-8'), 
                                    mask_fields
                                )
                                event.request_body_hash = audit_logger.hash_content(str(masked_body))
                        except:
                            pass
                    
                    if log_response_body and response:
                        try:
                            response_data = str(response)
                            masked_response = audit_logger.mask_sensitive_data(
                                response_data, 
                                mask_fields
                            )
                            event.response_body_hash = audit_logger.hash_content(str(masked_response))
                        except:
                            pass
                    
                    # Queue audit event
                    await audit_logger.log_event(event)
                    
                except Exception as audit_error:
                    logger.error(f"Failed to create audit event: {audit_error}")
        
        return wrapper
    return decorator

# Middleware class for application-wide auditing
class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic audit logging of all requests.
    
    This provides baseline auditing for all endpoints, while the decorator
    provides enhanced auditing for specific endpoints.
    """
    
    def __init__(
        self,
        app,
        enabled: bool = True,
        log_all_requests: bool = True,
        exclude_paths: Set[str] = None
    ):
        super().__init__(app)
        self.enabled = enabled
        self.log_all_requests = log_all_requests
        self.exclude_paths = exclude_paths or {'/health', '/docs', '/openapi.json', '/redoc'}
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path in self.exclude_paths:
            return await call_next(request)
        
        start_time = time.time()
        response = None
        error = None
        
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            error = e
            # Re-raise the exception
            raise
        finally:
            if self.log_all_requests:
                try:
                    duration_ms = (time.time() - start_time) * 1000
                    
                    event = await create_audit_event(
                        request=request,
                        response=response,
                        duration_ms=duration_ms,
                        error=error,
                        middleware="AuditMiddleware"
                    )
                    
                    await audit_logger.log_event(event)
                except Exception as audit_error:
                    logger.error(f"Middleware audit logging failed: {audit_error}")

# Specialized audit decorators for common use cases
def audit_sensitive_operation(
    operation_type: str,
    data_classification: str = "sensitive"
):
    """Decorator for sensitive operations that require enhanced auditing"""
    return audit_request(
        log_request_body=True,
        log_response_body=True,
        severity_override=AuditSeverity.HIGH,
        metadata={
            "operation_type": operation_type,
            "data_classification": data_classification,
            "requires_review": True
        }
    )

def audit_admin_operation(operation_description: str):
    """Decorator for administrative operations"""
    return audit_request(
        log_request_body=True,
        log_response_body=True,
        severity_override=AuditSeverity.CRITICAL,
        metadata={
            "admin_operation": operation_description,
            "requires_approval": True,
            "compliance_relevant": True
        }
    )

def audit_data_access(
    data_type: str,
    access_level: str = "read"
):
    """Decorator for data access operations"""
    severity = AuditSeverity.HIGH if access_level in ["write", "delete"] else AuditSeverity.MEDIUM
    return audit_request(
        log_request_body=access_level != "read",
        log_response_body=False,
        severity_override=severity,
        metadata={
            "data_type": data_type,
            "access_level": access_level,
            "data_protection_relevant": True
        }
    )

# Export audit logger instance and decorators
__all__ = [
    'audit_logger',
    'audit_request',
    'audit_sensitive_operation',
    'audit_admin_operation',
    'audit_data_access',
    'AuditMiddleware',
    'AuditEvent',
    'AuditEventType',
    'AuditSeverity'
] 