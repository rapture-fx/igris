"""
Enhanced Authentication Dependencies

This module provides enhanced authentication dependencies that add MFA support,
session management, and additional security features while maintaining full
backward compatibility with existing authentication flows.

Features:
- MFA-aware authentication dependencies
- Session-based authentication with security levels
- Recent authentication requirements for sensitive operations
- Device trust and risk-based authentication
- Gradual MFA rollout without breaking existing flows

Backward Compatibility:
- All existing dependencies continue to work unchanged
- Enhanced features are opt-in via new dependency functions
- No breaking changes to existing route handlers
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Callable, Dict, Any
from datetime import datetime, timedelta
import logging

from app.database.connection import get_db
from app.database.models import User, ApiKey
from app.auth.security import verify_api_key
from app.auth.enhanced_security import (
    enhanced_security,
    verify_token,
    SecurityLevel,
    SessionStatus,
    AuthenticationMethod
)

logger = logging.getLogger(__name__)

# Security schemes
security = HTTPBearer()

def get_client_info(request: Request) -> Dict[str, str]:
    """Extract client information from request"""
    return {
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "origin": request.headers.get("origin", "unknown")
    }

async def get_current_user_enhanced(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    required_security_level: SecurityLevel = SecurityLevel.LOW
) -> User:
    """
    Enhanced user authentication with session validation and security levels.
    
    Maintains backward compatibility with existing JWT tokens while adding
    enhanced security features for new sessions.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    # Extract client information
    client_info = get_client_info(request) if request else {}
    
    # Verify token with enhanced validation
    payload = verify_token(
        credentials.credentials, 
        enhanced=True,
        required_security_level=required_security_level
    )
    
    if payload is None:
        # Record failed authentication attempt
        enhanced_security.record_authentication_attempt(
            username="unknown",
            ip_address=client_info.get("ip_address", "unknown"),
            user_agent=client_info.get("user_agent", "unknown"),
            method=AuthenticationMethod.PASSWORD,
            success=False,
            failure_reason="Invalid token"
        )
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Get user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Check account lockout
    if enhanced_security.is_account_locked(user.username):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is temporarily locked due to suspicious activity"
        )
    
    # Record successful authentication
    enhanced_security.record_authentication_attempt(
        username=user.username,
        ip_address=client_info.get("ip_address", "unknown"),
        user_agent=client_info.get("user_agent", "unknown"),
        method=AuthenticationMethod.PASSWORD,
        success=True
    )
    
    return user

async def get_current_user_mfa(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current user with MFA verification required.
    
    This dependency ensures the user has completed MFA verification
    for the current session.
    """
    user = await get_current_user_enhanced(
        credentials=credentials,
        request=request,
        db=db,
        required_security_level=SecurityLevel.HIGH
    )
    
    # Check if token has MFA verification
    payload = verify_token(credentials.credentials, enhanced=True)
    session_id = payload.get("session_id") if payload else None
    
    if session_id and session_id in enhanced_security._sessions:
        session = enhanced_security._sessions[session_id]
        if not session.mfa_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA verification required for this operation",
                headers={"WWW-Authenticate": "MFA"}
            )
    
    return user

async def get_current_user_with_recent_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    max_age_minutes: int = 30
) -> User:
    """
    Get current user requiring recent authentication.
    
    For sensitive operations, require that the user has authenticated
    within the specified time window.
    """
    user = await get_current_user_enhanced(
        credentials=credentials,
        request=request,
        db=db,
        required_security_level=SecurityLevel.MEDIUM
    )
    
    # Check authentication recency
    payload = verify_token(credentials.credentials, enhanced=True)
    session_id = payload.get("session_id") if payload else None
    
    if session_id and session_id in enhanced_security._sessions:
        session = enhanced_security._sessions[session_id]
        auth_age = datetime.utcnow() - session.created_at
        
        if auth_age > timedelta(minutes=max_age_minutes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Recent authentication required (within {max_age_minutes} minutes)",
                headers={"WWW-Authenticate": "Recent"}
            )
    
    return user

# Backward compatible dependency (unchanged behavior)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Original user authentication dependency for backward compatibility.
    
    This maintains the exact same behavior as the original implementation
    to ensure existing routes continue to work without modification.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    # Use original token verification for backward compatibility
    payload = verify_token(credentials.credentials, enhanced=False)
    if payload is None:
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Get user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user (backward compatible)"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_user_from_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user from API key (unchanged for backward compatibility)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate API key",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    api_key = credentials.credentials
    
    # Find API key in database
    result = await db.execute(
        select(ApiKey).where(ApiKey.is_active == True)
    )
    api_keys = result.scalars().all()
    
    valid_api_key = None
    for stored_key in api_keys:
        if verify_api_key(api_key, stored_key.key_hash):
            valid_api_key = stored_key
            break
    
    if valid_api_key is None:
        raise credentials_exception
    
    # Update last used timestamp
    valid_api_key.last_used = datetime.utcnow()
    await db.commit()
    
    # Get the user
    result = await db.execute(select(User).where(User.id == valid_api_key.user_id))
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user

# Role-based access control (backward compatible)
def require_role(required_role: str):
    """Dependency factory for role-based access control"""
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role.value != required_role and current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

def require_any_role(required_roles: list[str]):
    """Dependency factory for multiple role access control"""
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role.value not in required_roles and current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

# Enhanced role-based access control with security levels
def require_role_enhanced(
    required_role: str,
    security_level: SecurityLevel = SecurityLevel.MEDIUM
):
    """Enhanced dependency factory with security level requirements"""
    async def role_checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        request: Request = None,
        db: AsyncSession = Depends(get_db)
    ):
        current_user = await get_current_user_enhanced(
            credentials=credentials,
            request=request,
            db=db,
            required_security_level=security_level
        )
        if current_user.role.value != required_role and current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

def require_mfa_for_role(required_role: str):
    """Dependency factory requiring MFA for specific roles"""
    async def role_checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        request: Request = None,
        db: AsyncSession = Depends(get_db)
    ):
        current_user = await get_current_user_mfa(
            credentials=credentials,
            request=request,
            db=db
        )
        if current_user.role.value != required_role and current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

def require_recent_authentication(max_age_minutes: int = 30):
    """Dependency factory requiring recent authentication"""
    async def auth_checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        request: Request = None,
        db: AsyncSession = Depends(get_db)
    ):
        return await get_current_user_with_recent_auth(
            credentials=credentials,
            request=request,
            db=db,
            max_age_minutes=max_age_minutes
        )
    return auth_checker

# Enhanced convenience dependencies
require_admin = require_role("admin")
require_analyst = require_any_role(["admin", "analyst"])
require_viewer = require_any_role(["admin", "analyst", "viewer"])

# Enhanced dependencies with security levels
require_admin_enhanced = require_role_enhanced("admin", SecurityLevel.HIGH)
require_admin_mfa = require_mfa_for_role("admin")
require_recent_authentication_default = require_recent_authentication(30)

# Session management helpers
def get_user_session_info(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[Dict[str, Any]]:
    """Get session information for current user"""
    if not credentials:
        return None
    
    payload = verify_token(credentials.credentials, enhanced=True)
    if not payload:
        return None
    
    session_id = payload.get("session_id")
    if session_id and session_id in enhanced_security._sessions:
        session = enhanced_security._sessions[session_id]
        return {
            "session_id": session.session_id,
            "created_at": session.created_at,
            "last_accessed": session.last_accessed,
            "expires_at": session.expires_at,
            "status": session.status.value,
            "security_level": session.security_level.value,
            "mfa_verified": session.mfa_verified,
            "risk_score": session.risk_score,
            "device_fingerprint": session.device_fingerprint
        }
    
    return None

# Export all dependencies
__all__ = [
    # Enhanced dependencies
    'get_current_user_enhanced',
    'get_current_user_mfa', 
    'get_current_user_with_recent_auth',
    'require_role_enhanced',
    'require_mfa_for_role',
    'require_recent_authentication',
    'get_user_session_info',
    
    # Backward compatible dependencies (unchanged)
    'get_current_user',
    'get_current_active_user',
    'get_current_user_from_api_key',
    'require_role',
    'require_any_role',
    'require_admin',
    'require_analyst',
    'require_viewer',
    
    # Enhanced convenience dependencies
    'require_admin_enhanced',
    'require_admin_mfa',
    'require_recent_authentication_default'
] 