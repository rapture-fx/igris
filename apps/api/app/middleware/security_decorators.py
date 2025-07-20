"""
Security Decorators

This module provides simple security decorators that integrate with the existing
middleware and security systems to add security features to endpoints with minimal
code changes.

Decorators:
- @audit_log_endpoint: Automatic audit logging for endpoints
- @encrypt_sensitive_response: Automatic response encryption for sensitive data  
- @require_permission(permission): Permission-based access control

Usage:
    @app.route('/api/v1/clean-data')
    @audit_log_endpoint
    @encrypt_sensitive_response
    @require_permission('data_processor')
    def clean_data():
        return process_data(request.json)  # Original code unchanged
"""

import json
import asyncio
from typing import Optional, Dict, List, Any, Callable, Set, Union
from functools import wraps
from enum import Enum
import logging

from fastapi import Request, Response, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

# Import existing systems
from app.middleware.audit_middleware import (
    audit_request, audit_sensitive_operation, AuditSeverity
)
from app.middleware.encryption_middleware import (
    encrypt_sensitive_data, EncryptionLevel
)
from app.auth.enhanced_dependencies import (
    get_current_user_enhanced, SecurityLevel, get_current_active_user
)
from app.database.security_crud import SecurityCRUD
from app.database.security_mixins import AuditAction
from app.database.connection import get_db

# Import configuration
from app.core.security_config import is_security_feature_enabled

logger = logging.getLogger(__name__)


class Permission(str, Enum):
    """Standard permissions for the application"""
    # Data processing permissions
    DATA_PROCESSOR = "data_processor"
    DATA_ANALYST = "data_analyst"
    DATA_VIEWER = "data_viewer"
    
    # Administrative permissions
    ADMIN = "admin"
    USER_MANAGER = "user_manager"
    SYSTEM_CONFIG = "system_config"
    
    # Organization permissions
    ORG_ADMIN = "org_admin"
    ORG_MEMBER = "org_member"
    
    # API permissions
    API_FULL_ACCESS = "api_full_access"
    API_READ_ONLY = "api_read_only"
    
    # Security permissions
    SECURITY_ADMIN = "security_admin"
    AUDIT_VIEWER = "audit_viewer"


# ============================================================================
# AUDIT LOG ENDPOINT DECORATOR
# ============================================================================

def audit_log_endpoint(
    operation_type: str = "api_operation",
    sensitivity: str = "medium",
    log_request_body: bool = False,
    log_response_body: bool = False,
    mask_fields: Set[str] = None
):
    """
    Automatic audit logging for endpoints.
    
    This decorator automatically creates audit records for endpoint access
    using the existing SecurityCRUD system.
    
    Args:
        operation_type: Type of operation being logged
        sensitivity: Sensitivity level (low, medium, high, critical)
        log_request_body: Whether to log request body
        log_response_body: Whether to log response body
        mask_fields: Fields to mask in logs
    
    Usage:
        @audit_log_endpoint
        def my_endpoint():
            return {"data": "value"}
            
        @audit_log_endpoint(
            operation_type="data_processing",
            sensitivity="high",
            log_request_body=True
        )
        def sensitive_endpoint():
            return {"sensitive": "data"}
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Check if audit logging is enabled
            if not is_security_feature_enabled('audit_logging'):
                # Skip audit logging, just execute the function
                return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            # Extract request and session from args/kwargs
            request = None
            session = None
            user = None
            
            # Look for FastAPI dependencies in kwargs
            for key, value in kwargs.items():
                if isinstance(value, Request):
                    request = value
                elif hasattr(value, 'execute'):  # AsyncSession
                    session = value
                elif hasattr(value, 'id') and hasattr(value, 'username'):  # User
                    user = value
            
            # Look in args for request/session
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            start_time = asyncio.get_event_loop().time()
            
            try:
                # Execute the original function
                result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
                
                # Calculate duration
                duration_ms = (asyncio.get_event_loop().time() - start_time) * 1000
                
                # Create audit record if we have the necessary context
                if session and user:
                    await SecurityCRUD.create_audit_record(
                        session=session,
                        model_instance=user,  # Log against user for now
                        action=AuditAction.ACCESS,
                        user_id=str(user.id),
                        metadata={
                            'operation_type': operation_type,
                            'endpoint': func.__name__,
                            'duration_ms': duration_ms,
                            'sensitivity': sensitivity,
                            'success': True,
                            'security_feature_enabled': True
                        },
                        ip_address=request.client.host if request and request.client else None,
                        user_agent=request.headers.get('user-agent') if request else None
                    )
                
                return result
                
            except Exception as e:
                # Calculate duration for error case
                duration_ms = (asyncio.get_event_loop().time() - start_time) * 1000
                
                # Log error in audit trail
                if session and user:
                    await SecurityCRUD.create_audit_record(
                        session=session,
                        model_instance=user,
                        action=AuditAction.ACCESS,
                        user_id=str(user.id),
                        metadata={
                            'operation_type': operation_type,
                            'endpoint': func.__name__,
                            'duration_ms': duration_ms,
                            'sensitivity': sensitivity,
                            'success': False,
                            'error': str(e),
                            'security_feature_enabled': True
                        },
                        ip_address=request.client.host if request and request.client else None,
                        user_agent=request.headers.get('user-agent') if request else None
                    )
                
                raise
        
        return wrapper
    return decorator


# ============================================================================
# ENCRYPT SENSITIVE RESPONSE DECORATOR
# ============================================================================

def encrypt_sensitive_response(
    encryption_level: EncryptionLevel = EncryptionLevel.MEDIUM,
    auto_detect_pii: bool = True,
    encrypt_fields: Set[str] = None,
    exclude_fields: Set[str] = None
):
    """
    Automatic encryption of sensitive data in responses.
    
    This decorator automatically encrypts sensitive fields in response data
    using the existing encryption middleware.
    
    Args:
        encryption_level: Level of encryption to apply
        auto_detect_pii: Whether to automatically detect PII
        encrypt_fields: Specific fields to encrypt
        exclude_fields: Fields to exclude from encryption
    
    Usage:
        @encrypt_sensitive_response
        def get_user():
            return {"name": "John", "ssn": "123-45-6789"}
            
        @encrypt_sensitive_response(
            encryption_level=EncryptionLevel.HIGH,
            encrypt_fields={"credit_card", "ssn"}
        )
        def get_payment_info():
            return {"card": "4111-1111-1111-1111"}
    """
    def decorator(func: Callable):
        # Check if encryption is enabled
        if not is_security_feature_enabled('encryption'):
            # Return function unchanged if encryption is disabled
            return func
        
        # Use the existing encryption middleware decorator
        return encrypt_sensitive_data(
            encrypt_fields=encrypt_fields,
            exclude_fields=exclude_fields
        )(func)
    
    return decorator


# ============================================================================
# REQUIRE PERMISSION DECORATOR
# ============================================================================

def require_permission(
    permission: Union[str, Permission, List[Union[str, Permission]]],
    security_level: SecurityLevel = SecurityLevel.MEDIUM,
    require_recent_auth: bool = False,
    max_auth_age_minutes: int = 30
):
    """
    Permission-based access control decorator.
    
    This decorator checks if the current user has the required permission(s)
    before allowing access to the endpoint.
    
    Args:
        permission: Required permission(s) - can be single permission or list
        security_level: Required security level for the session
        require_recent_auth: Whether to require recent authentication
        max_auth_age_minutes: Maximum age of authentication in minutes
    
    Usage:
        @require_permission('data_processor')
        def process_data():
            return {"processed": True}
            
        @require_permission(['admin', 'data_processor'])
        def admin_process_data():
            return {"admin_processed": True}
            
        @require_permission(
            Permission.ADMIN,
            security_level=SecurityLevel.HIGH,
            require_recent_auth=True
        )
        def critical_admin_operation():
            return {"critical": "operation"}
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Check if permission checking is enabled
            if not is_security_feature_enabled('permission_checking'):
                # Skip permission checking, just execute the function
                return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            # Convert permission(s) to list of strings
            if isinstance(permission, (str, Permission)):
                required_permissions = [str(permission)]
            else:
                required_permissions = [str(p) for p in permission]
            
            # Get current user from request context
            user = None
            request = None
            session = None
            
            # Look for user in kwargs (FastAPI dependency injection)
            for key, value in kwargs.items():
                if hasattr(value, 'id') and hasattr(value, 'username'):  # User object
                    user = value
                elif isinstance(value, Request):
                    request = value
                elif hasattr(value, 'execute'):  # AsyncSession
                    session = value
            
            # If no user found in kwargs, try to get from request
            if not user and request:
                # This would need to be adapted based on your auth setup
                # For now, assume user is passed as dependency
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check if user has required permissions
            user_permissions = set()
            
            # Get user role and convert to permissions
            if hasattr(user, 'role') and user.role:
                role = user.role.value if hasattr(user.role, 'value') else str(user.role)
                user_permissions.update(_get_permissions_for_role(role))
            
            # Get explicit permissions if available
            if hasattr(user, 'permissions'):
                if isinstance(user.permissions, list):
                    user_permissions.update(user.permissions)
                elif isinstance(user.permissions, str):
                    try:
                        perms = json.loads(user.permissions)
                        if isinstance(perms, list):
                            user_permissions.update(perms)
                    except:
                        user_permissions.add(user.permissions)
            
            # Check if user has any of the required permissions
            has_permission = any(
                perm in user_permissions for perm in required_permissions
            )
            
            if not has_permission:
                # Log unauthorized access attempt if audit logging is enabled
                if session and is_security_feature_enabled('audit_logging'):
                    await SecurityCRUD.create_audit_record(
                        session=session,
                        model_instance=user,
                        action=AuditAction.ACCESS,
                        user_id=str(user.id),
                        metadata={
                            'unauthorized_access_attempt': True,
                            'required_permissions': required_permissions,
                            'user_permissions': list(user_permissions),
                            'endpoint': func.__name__,
                            'permission_checking_enabled': True
                        },
                        ip_address=request.client.host if request and request.client else None
                    )
                
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {required_permissions}"
                )
            
            # Log successful permission check if audit logging is enabled
            if session and is_security_feature_enabled('audit_logging'):
                await SecurityCRUD.create_audit_record(
                    session=session,
                    model_instance=user,
                    action=AuditAction.ACCESS,
                    user_id=str(user.id),
                    metadata={
                        'permission_check_success': True,
                        'permissions_used': required_permissions,
                        'endpoint': func.__name__,
                        'permission_checking_enabled': True
                    },
                    ip_address=request.client.host if request and request.client else None
                )
            
            # Execute the original function
            return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
        
        return wrapper
    return decorator


def _get_permissions_for_role(role: str) -> Set[str]:
    """
    Map user roles to permissions.
    
    This should be configured based on your application's role/permission model.
    """
    role_permissions = {
        'admin': {
            Permission.ADMIN,
            Permission.USER_MANAGER,
            Permission.SYSTEM_CONFIG,
            Permission.DATA_PROCESSOR,
            Permission.DATA_ANALYST,
            Permission.DATA_VIEWER,
            Permission.API_FULL_ACCESS,
            Permission.SECURITY_ADMIN,
            Permission.AUDIT_VIEWER
        },
        'data_processor': {
            Permission.DATA_PROCESSOR,
            Permission.DATA_ANALYST,
            Permission.DATA_VIEWER,
            Permission.API_FULL_ACCESS
        },
        'data_analyst': {
            Permission.DATA_ANALYST,
            Permission.DATA_VIEWER,
            Permission.API_READ_ONLY
        },
        'org_admin': {
            Permission.ORG_ADMIN,
            Permission.ORG_MEMBER,
            Permission.USER_MANAGER,
            Permission.DATA_PROCESSOR,
            Permission.DATA_ANALYST,
            Permission.DATA_VIEWER
        },
        'org_member': {
            Permission.ORG_MEMBER,
            Permission.DATA_VIEWER,
            Permission.API_READ_ONLY
        },
        'viewer': {
            Permission.DATA_VIEWER,
            Permission.API_READ_ONLY
        }
    }
    
    return {str(perm) for perm in role_permissions.get(role.lower(), set())}


# ============================================================================
# CONVENIENCE DECORATORS
# ============================================================================

def basic_security():
    """
    Basic security stack - audit logging and permission check.
    
    Usage:
        @basic_security()
        def my_endpoint():
            return {"data": "value"}
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # Apply decorators only if features are enabled
        if is_security_feature_enabled('permission_checking'):
            wrapped_func = require_permission(Permission.API_READ_ONLY)(wrapped_func)
        
        if is_security_feature_enabled('audit_logging'):
            wrapped_func = audit_log_endpoint()(wrapped_func)
        
        @wraps(wrapped_func)
        def wrapper(*args, **kwargs):
            return wrapped_func(*args, **kwargs)
        return wrapper
    return decorator


def data_processing_security():
    """
    Security stack for data processing endpoints.
    
    Usage:
        @data_processing_security()
        def process_data():
            return {"processed": True}
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # Apply decorators only if features are enabled
        if is_security_feature_enabled('permission_checking'):
            wrapped_func = require_permission(Permission.DATA_PROCESSOR)(wrapped_func)
        
        if is_security_feature_enabled('encryption'):
            wrapped_func = encrypt_sensitive_response()(wrapped_func)
        
        if is_security_feature_enabled('audit_logging'):
            wrapped_func = audit_log_endpoint(
                operation_type="data_processing",
                sensitivity="high"
            )(wrapped_func)
        
        @wraps(wrapped_func)
        def wrapper(*args, **kwargs):
            return wrapped_func(*args, **kwargs)
        return wrapper
    return decorator


def admin_security():
    """
    Security stack for administrative endpoints.
    
    Usage:
        @admin_security()
        def admin_operation():
            return {"admin": True}
    """
    def decorator(func: Callable):
        wrapped_func = func
        
        # Apply decorators only if features are enabled
        if is_security_feature_enabled('permission_checking'):
            wrapped_func = require_permission(
                Permission.ADMIN,
                security_level=SecurityLevel.HIGH,
                require_recent_auth=True
            )(wrapped_func)
        
        if is_security_feature_enabled('encryption'):
            wrapped_func = encrypt_sensitive_response(encryption_level=EncryptionLevel.HIGH)(wrapped_func)
        
        if is_security_feature_enabled('audit_logging'):
            wrapped_func = audit_log_endpoint(
                operation_type="admin_operation",
                sensitivity="critical",
                log_request_body=True
            )(wrapped_func)
        
        @wraps(wrapped_func)
        def wrapper(*args, **kwargs):
            return wrapped_func(*args, **kwargs)
        return wrapper
    return decorator


# ============================================================================
# INTEGRATION WITH FASTAPI DEPENDENCIES
# ============================================================================

def create_secured_endpoint(
    permission: Union[str, Permission],
    audit_operation: str = "api_operation",
    encrypt_response: bool = False,
    security_level: SecurityLevel = SecurityLevel.MEDIUM
):
    """
    Create a secured endpoint with automatic dependency injection.
    
    This is a FastAPI-specific helper that automatically injects the required
    dependencies for security decorators.
    
    Usage:
        @router.get("/secure-endpoint")
        @create_secured_endpoint(Permission.DATA_PROCESSOR, encrypt_response=True)
        async def my_endpoint(
            user: User = Depends(get_current_active_user),
            db: AsyncSession = Depends(get_db),
            request: Request = None
        ):
            return {"data": "secure"}
    """
    def decorator(func: Callable):
        # Add the security decorators with proper order
        secured_func = func
        
        if encrypt_response:
            secured_func = encrypt_sensitive_response()(secured_func)
        
        secured_func = require_permission(permission, security_level)(secured_func)
        secured_func = audit_log_endpoint(audit_operation)(secured_func)
        
        return secured_func
    
    return decorator


# Export all decorators
__all__ = [
    'audit_log_endpoint',
    'encrypt_sensitive_response', 
    'require_permission',
    'basic_security',
    'data_processing_security',
    'admin_security',
    'create_secured_endpoint',
    'Permission'
] 