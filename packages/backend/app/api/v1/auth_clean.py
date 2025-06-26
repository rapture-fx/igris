"""
Clean Unified Authentication API
==============================

This module provides a clean, single authentication API for Pollarbase.
It replaces all other authentication modules with a simple, unified interface.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from app.database.connection import get_db
from app.database.models import User
from app.auth.auth_service import auth_service, AuthenticationError
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# ==================== REQUEST/RESPONSE MODELS ====================

class UserRegistration(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    first_name: Optional[str] = Field(None, max_length=100, description="First name")
    last_name: Optional[str] = Field(None, max_length=100, description="Last name")

class UserLogin(BaseModel):
    identifier: str = Field(..., description="Email or username")
    password: str = Field(..., description="Password")
    remember_me: bool = Field(False, description="Keep session longer")

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

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class PasswordChange(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")

class MessageResponse(BaseModel):
    message: str

# ==================== UTILITY FUNCTIONS ====================

def get_client_info(request: Request) -> Dict[str, Any]:
    """Extract client information from request"""
    return {
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown")
    }

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

# ==================== AUTHENTICATION ENDPOINTS ====================

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegistration,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user account
    
    Creates a new user and immediately logs them in.
    """
    try:
        client_info = get_client_info(request)
        
        # Create user
        user = await auth_service.create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            first_name=user_data.first_name,
            last_name=user_data.last_name
        )
        
        # Authenticate immediately
        auth_result = await auth_service.authenticate_user(
            db=db,
            identifier=user_data.email,
            password=user_data.password,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to authenticate new user"
            )
        
        return TokenResponse(
            access_token=auth_result.access_token,
            expires_in=30 * 60,  # 30 minutes in seconds
            user=user_to_response(auth_result.user)
        )
        
    except AuthenticationError as e:
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

@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email/username and password
    
    Returns access token for authenticated requests.
    """
    try:
        client_info = get_client_info(request)
        
        auth_result = await auth_service.authenticate_user(
            db=db,
            identifier=login_data.identifier,
            password=login_data.password,
            ip_address=client_info["ip_address"],  
            user_agent=client_info["user_agent"]
        )
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=auth_result.error_message
            )
        
        return TokenResponse(
            access_token=auth_result.access_token,
            expires_in=30 * 60,  # 30 minutes in seconds
            user=user_to_response(auth_result.user)
        )
        
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Logout current user
    
    Invalidates the user session.
    """
    try:
        await auth_service.logout_user(db, str(current_user.id))
        return MessageResponse(message="Successfully logged out")
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

@router.get("/me", response_model=UserResponse)
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user profile
    
    Returns the authenticated user's profile information.
    """
    return user_to_response(current_user)

@router.put("/me", response_model=UserResponse)
async def update_profile(
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user profile
    
    Update the authenticated user's profile information.
    """
    try:
        if first_name is not None:
            current_user.first_name = first_name
        if last_name is not None:
            current_user.last_name = last_name
            
        await db.commit()
        await db.refresh(current_user)
        
        return user_to_response(current_user)
    except Exception as e:
        logger.error(f"Profile update failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Change user password
    
    Updates the authenticated user's password.
    """
    try:
        await auth_service.change_password(
            db=db,
            user_id=str(current_user.id),
            current_password=password_data.current_password,
            new_password=password_data.new_password
        )
        
        return MessageResponse(message="Password changed successfully")
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password change failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )

@router.get("/status")
async def auth_status():
    """
    Get authentication system status
    
    Returns system information and health check.
    """
    return {
        "status": "active",
        "version": "1.0.0",
        "features": {
            "registration": True,
            "login": True,
            "password_change": True,
            "session_management": auth_service.redis_client is not None,
            "audit_logging": True
        },
        "timestamp": datetime.utcnow().isoformat()
    } 