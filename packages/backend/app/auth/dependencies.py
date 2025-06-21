from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.database.models import User, ApiKey
from app.auth.security import verify_token, verify_api_key
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Security schemes
security = HTTPBearer()
api_key_header = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    payload = verify_token(credentials.credentials)
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
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_user_from_api_key(
    credentials: HTTPAuthorizationCredentials = Security(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user from API key"""
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
    from datetime import datetime
    valid_api_key.last_used = datetime.utcnow()
    await db.commit()
    
    # Get the user
    result = await db.execute(select(User).where(User.id == valid_api_key.user_id))
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user

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

# Convenience dependencies
require_admin = require_role("admin")
require_analyst = require_any_role(["admin", "analyst"])
require_viewer = require_any_role(["admin", "analyst", "viewer"]) 