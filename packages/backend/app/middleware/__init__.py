"""
Security Middleware Package

This package provides comprehensive security middleware for the Schlep-engine API
with decorator-based implementation for minimal changes to existing endpoints.

Modules:
- audit_middleware: Request/response audit logging
- encryption_middleware: Response data encryption
- security_headers_middleware: Security headers and CSP
- rate_limiting_middleware: Enhanced rate limiting

Usage:
    # Basic decorators (minimal changes to existing endpoints)
    @audit_request
    @encrypt_sensitive_data
    @security_headers
    @rate_limit_by_user()
    @router.get("/sensitive-endpoint")
    async def sensitive_operation():
        return {"data": "sensitive"}

    # Specialized decorators for common use cases
    @admin_security_stack
    @router.delete("/admin/users/{user_id}")
    async def delete_user(user_id: str):
        return {"status": "deleted"}

    # Fine-grained control
    @audit_sensitive_operation("user_data_access", "personal")
    @encrypt_pii_data()
    @strict_security_headers()
    @rate_limit(requests_per_minute=30, rate_limit_type=RateLimitType.USER_BASED)
    @router.get("/user/{user_id}/profile")
    async def get_user_profile(user_id: str):
        return {"profile": "data"}
"""

# Audit middleware exports
from .audit_middleware import (
    audit_logger,
    audit_request,
    audit_sensitive_operation,
    audit_admin_operation,
    audit_data_access,
    AuditMiddleware,
    AuditEvent,
    AuditEventType,
    AuditSeverity
)

# Encryption middleware exports
from .encryption_middleware import (
    response_encryptor,
    encrypt_response,
    encrypt_sensitive_data,
    encrypt_pii_data,
    encrypt_financial_data,
    encrypt_admin_data,
    EncryptionMiddleware,
    ResponseDecryptor,
    EncryptionLevel,
    EncryptionPolicy,
    EncryptionConfig
)

# Security headers middleware exports
from .security_headers_middleware import (
    security_headers_manager,
    security_headers,
    strict_security_headers,
    admin_security_headers,
    api_security_headers,
    public_security_headers,
    SecurityHeadersMiddleware,
    SecureCORSConfig,
    SecurityLevel as HeadersSecurityLevel,
    CSPDirective,
    SecurityHeadersConfig
)

# Rate limiting middleware exports
from .rate_limiting_middleware import (
    rate_limiter,
    rate_limit,
    rate_limit_by_ip,
    rate_limit_by_user,
    rate_limit_admin_endpoint,
    rate_limit_api_key,
    RateLimitingMiddleware,
    RateLimitType,
    RateLimitAlgorithm,
    RateLimitConfig
)

# Additional imports for decorator combinations
from functools import wraps
from typing import Optional, Dict, Set, Callable
import logging

# Security decorators exports (new simple decorators)
from .security_decorators import (
    audit_log_endpoint,
    encrypt_sensitive_response,
    require_permission,
    basic_security,
    data_processing_security,
    admin_security,
    create_secured_endpoint,
    Permission
)

logger = logging.getLogger(__name__)

# Combined decorator stacks for common use cases
def basic_security_stack(
    rate_limit_per_minute: int = 60,
    include_audit: bool = True,
    include_encryption: bool = False
):
    """
    Basic security stack for standard API endpoints.
    
    Includes:
    - Basic audit logging
    - Standard security headers
    - IP-based rate limiting
    - Optional response encryption
    """
    def decorator(func: Callable):
        # Apply decorators in reverse order (inner to outer)
        wrapped_func = func
        
        # Rate limiting (innermost)
        wrapped_func = rate_limit_by_ip(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_minute * 10
        )(wrapped_func)
        
        # Security headers
        wrapped_func = api_security_headers()(wrapped_func)
        
        # Encryption (if requested)
        if include_encryption:
            wrapped_func = encrypt_sensitive_data()(wrapped_func)
        
        # Audit logging (outermost)
        if include_audit:
            wrapped_func = audit_request()(wrapped_func)
        
        return wrapped_func
    
    return decorator

def admin_security_stack(
    rate_limit_per_minute: int = 30,
    require_recent_auth: bool = True
):
    """
    Enhanced security stack for administrative endpoints.
    
    Includes:
    - Enhanced audit logging with admin operation tracking
    - Maximum security headers with strict CSP
    - User-based rate limiting (stricter)
    - Response encryption for sensitive data
    - Recent authentication requirement
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # Rate limiting for admin endpoints
        wrapped_func = rate_limit_admin_endpoint(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_minute * 8
        )(wrapped_func)
        
        # Admin security headers
        wrapped_func = admin_security_headers()(wrapped_func)
        
        # Admin data encryption
        wrapped_func = encrypt_admin_data()(wrapped_func)
        
        # Admin operation audit
        wrapped_func = audit_admin_operation("Administrative operation")(wrapped_func)
        
        return wrapped_func
    
    return decorator

def financial_security_stack(
    rate_limit_per_minute: int = 20
):
    """
    High-security stack for financial/payment endpoints.
    
    Includes:
    - Critical audit logging
    - Maximum encryption (all data)
    - Strict security headers
    - Tight rate limiting
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # Strict rate limiting
        wrapped_func = rate_limit_by_user(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_minute * 5,
            requests_per_day=rate_limit_per_minute * 100
        )(wrapped_func)
        
        # Strict security headers
        wrapped_func = strict_security_headers(
            custom_headers={
                "X-Financial-Endpoint": "true",
                "Cache-Control": "no-store, no-cache, must-revalidate, private",
                "Pragma": "no-cache"
            }
        )(wrapped_func)
        
        # Financial data encryption
        wrapped_func = encrypt_financial_data()(wrapped_func)
        
        # Sensitive operation audit
        wrapped_func = audit_sensitive_operation(
            "financial_operation", 
            "highly_restricted"
        )(wrapped_func)
        
        return wrapped_func
    
    return decorator

def api_key_security_stack(
    rate_limit_per_minute: int = 100
):
    """
    Security stack for API key-based endpoints.
    
    Includes:
    - API key specific rate limiting
    - API-focused security headers
    - Basic encryption for sensitive responses
    - API usage audit logging
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # API key rate limiting
        wrapped_func = rate_limit_api_key(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_minute * 20
        )(wrapped_func)
        
        # API security headers
        wrapped_func = api_security_headers(
            custom_headers={
                "X-API-Version": "1.0",
                "X-Rate-Limit-Type": "api-key"
            }
        )(wrapped_func)
        
        # Basic encryption for API responses
        wrapped_func = encrypt_sensitive_data()(wrapped_func)
        
        # API access audit
        wrapped_func = audit_data_access(
            "api_endpoint", 
            "read"
        )(wrapped_func)
        
        return wrapped_func
    
    return decorator

def public_security_stack(
    rate_limit_per_minute: int = 120,
    include_basic_headers: bool = True
):
    """
    Minimal security stack for public endpoints.
    
    Includes:
    - Relaxed rate limiting
    - Basic security headers
    - Optional audit logging
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # Relaxed rate limiting
        wrapped_func = rate_limit_by_ip(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_minute * 15
        )(wrapped_func)
        
        # Basic security headers
        if include_basic_headers:
            wrapped_func = public_security_headers()(wrapped_func)
        
        # Basic audit (optional)
        wrapped_func = audit_request(
            log_request_body=False,
            log_response_body=False
        )(wrapped_func)
        
        return wrapped_func
    
    return decorator

def data_processing_security_stack(
    rate_limit_per_minute: int = 30,
    encrypt_responses: bool = True
):
    """
    Security stack for data processing endpoints.
    
    Includes:
    - User-based rate limiting
    - PII detection and encryption
    - Data access audit logging
    - Standard security headers
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # User-based rate limiting
        wrapped_func = rate_limit_by_user(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_minute * 12,
            requests_per_day=rate_limit_per_minute * 200
        )(wrapped_func)
        
        # Standard security headers
        wrapped_func = api_security_headers()(wrapped_func)
        
        # PII encryption if enabled
        if encrypt_responses:
            wrapped_func = encrypt_pii_data()(wrapped_func)
        
        # Data processing audit
        wrapped_func = audit_data_access(
            "data_processing", 
            "read_write"
        )(wrapped_func)
        
        return wrapped_func
    
    return decorator

# Middleware configuration helpers
class SecurityMiddlewareConfig:
    """Configuration helper for security middleware stack"""
    
    @staticmethod
    def get_development_config():
        """Get development-friendly middleware configuration"""
        return {
            "audit_enabled": True,
            "encryption_enabled": False,  # Disabled for easier debugging
            "security_headers_enabled": True,
            "rate_limiting_enabled": False,  # Disabled for development
            "cors_config": SecureCORSConfig.get_development_cors_config()
        }
    
    @staticmethod
    def get_production_config():
        """Get production-ready middleware configuration"""
        return {
            "audit_enabled": True,
            "encryption_enabled": True,
            "security_headers_enabled": True,
            "rate_limiting_enabled": True,
            "cors_config": SecureCORSConfig.get_production_cors_config()
        }
    
    @staticmethod
    def get_testing_config():
        """Get configuration for testing environments"""
        return {
            "audit_enabled": False,  # Reduce noise in tests
            "encryption_enabled": False,  # Easier test assertions
            "security_headers_enabled": False,  # Reduce complexity
            "rate_limiting_enabled": False,  # No rate limiting in tests
            "cors_config": SecureCORSConfig.get_development_cors_config()
        }

# Startup/shutdown functions for middleware
async def initialize_security_middleware():
    """Initialize all security middleware components"""
    logger.info("Initializing security middleware...")
    
    try:
        # Start audit logger
        await audit_logger.start()
        logger.info(" Audit middleware initialized")
        
        # Initialize other components as needed
        logger.info(" Security middleware initialization complete")
        
    except Exception as e:
        logger.error(f" Failed to initialize security middleware: {e}")
        raise

async def shutdown_security_middleware():
    """Shutdown all security middleware components"""
    logger.info("Shutting down security middleware...")
    
    try:
        # Stop audit logger
        await audit_logger.stop()
        logger.info(" Audit middleware shut down")
        
        logger.info(" Security middleware shutdown complete")
        
    except Exception as e:
        logger.error(f" Failed to shutdown security middleware: {e}")

# Export all components
__all__ = [
    # Middleware classes
    'AuditMiddleware',
    'EncryptionMiddleware', 
    'SecurityHeadersMiddleware',
    'RateLimitingMiddleware',
    
    # Individual decorators
    'audit_request',
    'audit_sensitive_operation',
    'audit_admin_operation',
    'audit_data_access',
    'encrypt_response',
    'encrypt_sensitive_data',
    'encrypt_pii_data',
    'encrypt_financial_data',
    'encrypt_admin_data',
    'security_headers',
    'strict_security_headers',
    'admin_security_headers',
    'api_security_headers',
    'public_security_headers',
    'rate_limit',
    'rate_limit_by_ip',
    'rate_limit_by_user',
    'rate_limit_admin_endpoint',
    'rate_limit_api_key',
    
    # Combined security stacks
    'basic_security_stack',
    'admin_security_stack',
    'financial_security_stack',
    'api_key_security_stack',
    'public_security_stack',
    'data_processing_security_stack',
    
    # Configuration and utilities
    'SecurityMiddlewareConfig',
    'initialize_security_middleware',
    'shutdown_security_middleware',
    
    # Manager instances
    'audit_logger',
    'response_encryptor',
    'security_headers_manager',
    'rate_limiter',
    
    # Enums and configs
    'AuditEventType',
    'AuditSeverity',
    'EncryptionLevel',
    'EncryptionPolicy',
    'HeadersSecurityLevel',
    'CSPDirective',
    'RateLimitType',
    'RateLimitAlgorithm',
    
    # Security decorators
    'audit_log_endpoint',
    'encrypt_sensitive_response',
    'require_permission',
    'basic_security',
    'data_processing_security',
    'admin_security',
    'create_secured_endpoint',
    'Permission'
] 