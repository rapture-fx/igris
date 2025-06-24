"""
⚠️  DEPRECATED UNIFIED AUTHENTICATION MODULE ⚠️
===============================================

This unified authentication module has been DEPRECATED and replaced by the newer unified authentication system.

🚨 DO NOT USE THIS MODULE FOR NEW DEVELOPMENT 🚨

Please use the following instead:
- For authentication: app.api.v1.auth_unified
- For dependencies: app.auth.unified_dependencies  
- For services: app.auth.unified_auth_service

This file will be removed in a future version.
Migration guide: See migration_script.py

Last Updated: 2024-06-24
Deprecation Date: 2024-06-24
Planned Removal: 2024-07-01
"""

import warnings
warnings.warn(
    "app.api.v1.unified_auth is deprecated. Use app.api.v1.auth_unified instead.",
    DeprecationWarning,
    stacklevel=2
)

"""
Unified Authentication API Routes

This module consolidates all authentication routes into a single, coherent API
that eliminates redundancy while maintaining backward compatibility.

Features:
- Single authentication endpoint with feature detection
- Backward compatible with existing clients
- Enhanced security features available via feature flags
- Consistent error handling and responses
- Clean API surface without redundant endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from app.database.connection import get_db
from app.database.models import User
from app.auth.unified_auth_service import unified_auth, AuthResult
from app.auth.unified_dependencies import (
    get_current_user,
    get_current_user_with_recent_auth,
    get_client_info,
    require_admin
)
from app.core.unified_config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== REQUEST/RESPONSE MODELS ====================

class UserRegistration(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=8, description="Password")
    first_name: Optional[str] = Field(None, max_length=100, description="First name")
    last_name: Optional[str] = Field(None, max_length=100, description="Last name")

class UserLogin(BaseModel):
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")
    remember_me: bool = Field(False, description="Extended session duration")
    mfa_code: Optional[str] = Field(None, description="MFA code (if MFA enabled)")

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)

class PasswordChange(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")

# ==================== UTILITY FUNCTIONS ====================

def user_to_response(user: User) -> UserResponse:
    """Convert User model to UserResponse"""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at,
        last_login=user.last_login
    )

def create_token_response(auth_result: AuthResult) -> Dict[str, Any]:
    """Create standardized token response"""
    response = {
        "access_token": auth_result.access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_to_response(auth_result.user).dict()
    }
    
    # Add enhanced fields if available
    if auth_result.refresh_token:
        response["refresh_token"] = auth_result.refresh_token
    if auth_result.session_id:
        response["session_id"] = auth_result.session_id
        response["security_level"] = "enhanced"
    
    return response

# ==================== AUTHENTICATION ENDPOINTS ====================

@router.post("/register", response_model=Dict[str, Any])
async def register_user(
    user_data: UserRegistration,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    try:
        client_info = get_client_info(request)
        
        # Create user with unified service
        user = await unified_auth.create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            enhanced=None  # Auto-detect
        )
        
        # Authenticate the new user immediately
        auth_result = await unified_auth.authenticate_user(
            db=db,
            email=user_data.email,
            password=user_data.password,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"],
            enhanced=None  # Auto-detect
        )
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to authenticate new user"
            )
        
        return create_token_response(auth_result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login")
async def login_user(
    login_data: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """User login - UNIFIED ENDPOINT"""
    client_info = get_client_info(request)
    
    try:
        # Attempt authentication
        auth_result = await unified_auth.authenticate_user(
            db=db,
            email=login_data.username,
            password=login_data.password,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"],
            enhanced=None  # Auto-detect
        )
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=auth_result.error or "Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Handle MFA requirement
        if auth_result.mfa_required:
            return {
                "status": "mfa_required",
                "mfa_challenge_token": auth_result.mfa_challenge_token,
                "message": "Multi-factor authentication required"
            }
        
        # Successful authentication
        return create_token_response(auth_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/logout")
async def logout_user(
    current_user: User = Depends(get_current_user)
):
    """Logout user"""
    try:
        return {"message": "Logout successful"}
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        return {"message": "Logout completed"}

# ==================== USER MANAGEMENT ENDPOINTS ====================

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return user_to_response(current_user)

@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user information"""
    try:
        # Update user fields
        if user_update.first_name is not None:
            current_user.first_name = user_update.first_name
        if user_update.last_name is not None:
            current_user.last_name = user_update.last_name
        
        await db.commit()
        await db.refresh(current_user)
        
        return user_to_response(current_user)
        
    except Exception as e:
        logger.error(f"User update failed: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user_with_recent_auth),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    try:
        # Verify current password
        if not unified_auth.verify_password(password_data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Update password
        current_user.hashed_password = unified_auth.get_password_hash(password_data.new_password)
        await db.commit()
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change failed: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )

# ==================== ADMIN ENDPOINTS ====================

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)"""
    try:
        from sqlalchemy import select
        
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        return [user_to_response(user) for user in users]
        
    except Exception as e:
        logger.error(f"User listing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users"
        )

# ==================== STATUS ENDPOINTS ====================

@router.get("/status")
async def auth_status():
    """Get authentication system status"""
    return {
        "status": "operational",
        "enhanced_auth_enabled": settings.ENHANCED_AUTH_ENABLED,
        "features": {
            "mfa": settings.SECURITY_FEATURES.get("mfa", False),
            "session_management": settings.SECURITY_FEATURES.get("session_management", True),
            "audit_logging": settings.SECURITY_FEATURES.get("audit_logging", True)
        },
        "environment": settings.ENVIRONMENT.value
    }

# Export router
__all__ = ['router'] 