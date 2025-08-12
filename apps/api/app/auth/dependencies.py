"""
Unified Authentication Dependencies
==================================

This module provides FastAPI dependencies for authentication that replace
all existing authentication dependency patterns in the codebase.

Features:
- Single dependency injection pattern
- Consistent error handling
- Security level enforcement
- Request context extraction
- Backward compatibility
"""

import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.database.models import User
from app.auth.unified_service import unified_auth_service
from app.auth.unified_interface import SecurityLevel, AuthError

logger = logging.getLogger(__name__)

# Security scheme for JWT tokens
security = HTTPBearer(auto_error=False)


def get_client_info(request: Request) -> Dict[str, str]:
    """Extract client information from request"""
    return {
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "origin": request.headers.get("origin", "unknown"),
        "referer": request.headers.get("referer", "unknown")
    }


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token
    
    This is the primary dependency for protected endpoints.
    Raises HTTPException if authentication fails.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user = await unified_auth_service.get_current_user(db, credentials.credentials)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user account"
            )
        
        return user
    
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (alias for backward compatibility)
    """
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise
    
    This dependency is useful for endpoints that work with or without authentication.
    Does not raise exceptions on authentication failure.
    """
    if not credentials:
        return None
    
    try:
        return await unified_auth_service.get_current_user(db, credentials.credentials)
    except Exception:
        return None


async def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Require admin role for the current user
    """
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def require_analyst_or_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Require analyst or admin role for the current user
    """
    if current_user.role.value not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst or admin access required"
        )
    return current_user


def require_security_level(required_level: SecurityLevel):
    """
    Create a dependency that requires a specific security level
    
    Usage:
        @app.get("/secure-endpoint")
        async def secure_endpoint(
            user: User = Depends(require_security_level(SecurityLevel.HIGH))
        ):
            pass
    """
    async def security_dependency(
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            result = await unified_auth_service.verify_token(
                db, 
                credentials.credentials, 
                required_security_level=required_level
            )
            
            if not result.success or not result.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            return result.user
        
        except AuthError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=e.message,
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    return security_dependency


async def get_api_key_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get user from API key authentication
    
    Looks for API key in:
    1. Authorization header (Bearer token)
    2. X-API-Key header
    3. api_key query parameter
    """
    api_key = None
    
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        api_key = auth_header[7:]
    
    # Check X-API-Key header
    if not api_key:
        api_key = request.headers.get("X-API-Key")
    
    # Check query parameter
    if not api_key:
        api_key = request.query_params.get("api_key")
    
    if not api_key:
        return None
    
    try:
        from app.auth.api_key_manager import get_api_key_manager
        
        # Use the secure API key manager
        api_key_manager = get_api_key_manager()
        user = await api_key_manager.authenticate_api_key(db, api_key)
        
        if user:
            return user
        
        return None
    except Exception as e:
        logger.error(f"API key authentication failed: {e}")
        return None


# Backward compatibility aliases
get_current_active_user_dep = get_current_user
get_current_user_dep = get_current_user 