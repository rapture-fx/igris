"""
Users API Router
User management endpoints for the Schlep-engine platform
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import logging

from app.database.connection import get_async_session
from app.auth.unified_auth_system import get_current_user, get_admin_user
from app.core.error_decorators import handle_database_errors, handle_auth_errors

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
    created_at: str
    updated_at: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@router.get("/me", response_model=UserProfile)
@handle_auth_errors
async def get_current_user_profile(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get current user's profile"""
    try:
        return UserProfile(
            id=str(current_user.id),
            email=current_user.email,
            full_name=current_user.full_name,
            is_active=current_user.is_active,
            is_admin=current_user.is_admin,
            created_at=current_user.created_at.isoformat(),
            updated_at=current_user.updated_at.isoformat()
        )
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user profile"
        )

@router.put("/me", response_model=UserResponse)
@handle_auth_errors
@handle_database_errors
async def update_current_user(
    user_data: UserUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update current user's profile"""
    try:
        # Update user fields
        if user_data.full_name is not None:
            current_user.full_name = user_data.full_name
        if user_data.email is not None:
            current_user.email = user_data.email
        
        # Save changes
        await db.commit()
        await db.refresh(current_user)
        
        return UserResponse(
            success=True,
            message="User profile updated successfully",
            data={
                "id": str(current_user.id),
                "email": current_user.email,
                "full_name": current_user.full_name
            }
        )
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )

@router.get("/", response_model=List[UserProfile])
@handle_auth_errors
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List all users (admin only)"""
    try:
        # For now, return empty list until we implement proper user database
        # In a real implementation, this would query the user table
        return []
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )

@router.get("/{user_id}", response_model=UserProfile)
@handle_auth_errors
async def get_user(
    user_id: str,
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get user by ID (admin only)"""
    try:
        # For now, return 404 until we implement proper user database
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user"
        )

@router.delete("/{user_id}", response_model=UserResponse)
@handle_auth_errors
@handle_database_errors
async def delete_user(
    user_id: str,
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete user (admin only)"""
    try:
        # For now, return 404 until we implement proper user database
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )

@router.post("/{user_id}/activate", response_model=UserResponse)
@handle_auth_errors
@handle_database_errors
async def activate_user(
    user_id: str,
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Activate user account (admin only)"""
    try:
        # For now, return 404 until we implement proper user database
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate user"
        )

@router.post("/{user_id}/deactivate", response_model=UserResponse)
@handle_auth_errors
@handle_database_errors
async def deactivate_user(
    user_id: str,
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Deactivate user account (admin only)"""
    try:
        # For now, return 404 until we implement proper user database
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate user"
        )