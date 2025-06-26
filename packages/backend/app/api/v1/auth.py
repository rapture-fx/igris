"""
⚠️  DEPRECATED AUTHENTICATION MODULE ⚠️
====================================

This authentication module has been DEPRECATED and replaced by the unified authentication system.

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
    "app.api.v1.auth is deprecated. Use app.api.v1.auth_unified instead.",
    DeprecationWarning,
    stacklevel=2
)

from fastapi import APIRouter, Depends, HTTPException, status, Form, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from app.database.connection import get_db
from app.database.models import User, ApiKey, Organization, UserRole
from app.auth.auth_service import auth_service
from app.auth.dependencies import get_current_active_user, require_admin
from app.auth.security import verify_password, get_password_hash, generate_api_key
from app.services.usage_meter import track_api_usage

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
    token_type: str
    user: UserResponse

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ApiKeyCreate(BaseModel):
    name: str
    permissions: List[str] = ["read", "write"]
    expires_in_days: Optional[int] = None

class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_preview: str
    permissions: List[str]
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]

class ApiKeyCreatedResponse(BaseModel):
    api_key: str
    key_info: ApiKeyResponse

def user_to_response(user: User) -> UserResponse:
    """Convert User model to UserResponse"""
    org_dict = None
    if user.organization:
        org_dict = {
            "id": str(user.organization.id),
            "name": user.organization.name,
            "slug": user.organization.slug
        }
    
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

# Authentication endpoints
@router.post("/signup", response_model=TokenResponse)
async def signup(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    try:
        # Create user
        user = await auth_service.create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            first_name=user_data.first_name,
            last_name=user_data.last_name
        )
        
        # Create access token
        access_token = auth_service.create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        
        user_response = UserResponse(
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
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.post("/signin", response_model=TokenResponse)
async def signin(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return access token"""
    user = await auth_service.authenticate_user(
        db=db,
        email=user_data.email,
        password=user_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    user_response = UserResponse(
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
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user information"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role.value,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )

@router.post("/logout")
async def logout():
    """Logout user (client should remove token)"""
    return {"message": "Successfully logged out"}

@router.get("/status")
async def auth_status():
    """Authentication service status"""
    return {
        "status": "healthy",
        "service": "authentication",
        "endpoints": [
            "POST /signup - User registration",
            "POST /signin - User login", 
            "GET /me - Current user info",
            "POST /logout - User logout"
        ]
    }

@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user information"""
    
    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name
    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    
    current_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(current_user, ["organization"])
    
    return user_to_response(current_user)

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Password changed successfully"}

@router.post("/api-keys", response_model=ApiKeyCreatedResponse)
async def create_api_key(
    api_key_data: ApiKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new API key"""
    
    # Generate API key
    api_key, api_key_hash = generate_api_key()
    
    # Set expiration
    expires_at = None
    if api_key_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=api_key_data.expires_in_days)
    
    # Create API key record
    db_api_key = ApiKey(
        name=api_key_data.name,
        key_hash=api_key_hash,
        key_preview=f"...{api_key[-4:]}",
        user_id=current_user.id,
        permissions=api_key_data.permissions,
        expires_at=expires_at
    )
    
    db.add(db_api_key)
    await db.commit()
    await db.refresh(db_api_key)
    
    key_response = ApiKeyResponse(
        id=str(db_api_key.id),
        name=db_api_key.name,
        key_preview=db_api_key.key_preview,
        permissions=db_api_key.permissions,
        is_active=db_api_key.is_active,
        created_at=db_api_key.created_at,
        expires_at=db_api_key.expires_at,
        last_used=db_api_key.last_used
    )
    
    return ApiKeyCreatedResponse(
        api_key=api_key,
        key_info=key_response
    )

@router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's API keys"""
    
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == current_user.id)
    )
    api_keys = result.scalars().all()
    
    return [
        ApiKeyResponse(
            id=str(key.id),
            name=key.name,
            key_preview=key.key_preview,
            permissions=key.permissions,
            is_active=key.is_active,
            created_at=key.created_at,
            expires_at=key.expires_at,
            last_used=key.last_used
        )
        for key in api_keys
    ]

@router.delete("/api-keys/{api_key_id}")
async def revoke_api_key(
    api_key_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke an API key"""
    
    result = await db.execute(
        select(ApiKey).where(
            (ApiKey.id == api_key_id) & (ApiKey.user_id == current_user.id)
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    api_key.is_active = False
    await db.commit()
    
    return {"message": "API key revoked successfully"}

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)"""
    
    result = await db.execute(select(User))
    users = result.scalars().all()
    
    # Load organizations for all users
    for user in users:
        await db.refresh(user, ["organization"])
    
    return [user_to_response(user) for user in users] 