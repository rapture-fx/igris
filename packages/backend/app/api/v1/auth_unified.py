"""
Unified Authentication API
=========================

This is the single, consolidated authentication API for Schlep-engine.
It replaces all fragmented authentication endpoints with a clean, unified interface.

Features:
- Single authentication endpoint with intelligent routing
- Consistent request/response models
- Enhanced security with rate limiting
- Comprehensive error handling
- Audit logging
- Backward compatibility
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.auth.unified_service import unified_auth_service
from app.auth.unified_interface import (
    LoginRequest, RegisterRequest, TokenResponse, UserResponse,
    AuthCredentials, UserData, AuthenticationMethod, AuthError
)
from app.auth.dependencies import get_current_user, get_client_info
from app.core.rate_limiting import rate_limit

router = APIRouter(prefix="/auth", tags=["Authentication"])


def user_to_response(user) -> Dict[str, Any]:
    """Convert User model to response dictionary"""
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None
    }


@router.post("/login", response_model=TokenResponse)
@rate_limit
async def login(
    request: Request,
    login_data: LoginRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    User login endpoint
    
    Authenticates user with email/username and password.
    Returns access token and user information.
    """
    try:
        client_info = get_client_info(request)
        
        # Create authentication credentials
        credentials = AuthCredentials(
            identifier=login_data.identifier,
            password=login_data.password,
            method=AuthenticationMethod.PASSWORD
        )
        
        # Authenticate user
        auth_result = await unified_auth_service.authenticate(
            db=db,
            credentials=credentials,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"]
        )
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=auth_result.error or "Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Handle MFA requirement (if implemented)
        if auth_result.mfa_required:
            return {
                "status": "mfa_required",
                "mfa_challenge_token": auth_result.mfa_challenge_token,
                "message": "Multi-factor authentication required"
            }
        
        # Return successful authentication response
        return TokenResponse(
            access_token=auth_result.access_token,
            token_type="bearer",
            expires_in=auth_result.expires_in,
            refresh_token=auth_result.refresh_token,
            user=user_to_response(auth_result.user)
        )
        
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@rate_limit
async def register(
    request: Request,
    register_data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    User registration endpoint
    
    Creates a new user account and immediately logs them in.
    Returns access token and user information.
    """
    try:
        client_info = get_client_info(request)
        
        # Create user data
        user_data = UserData(
            email=register_data.email,
            username=register_data.username,
            password=register_data.password,
            first_name=register_data.first_name,
            last_name=register_data.last_name
        )
        
        # Create user
        user = await unified_auth_service.create_user(db=db, user_data=user_data)
        
        # Authenticate the new user immediately
        credentials = AuthCredentials(
            identifier=register_data.email,
            password=register_data.password,
            method=AuthenticationMethod.PASSWORD
        )
        
        auth_result = await unified_auth_service.authenticate(
            db=db,
            credentials=credentials,
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
            token_type="bearer",
            expires_in=auth_result.expires_in,
            refresh_token=auth_result.refresh_token,
            user=user_to_response(auth_result.user)
        )
        
    except AuthError as e:
        if "already exists" in e.message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=e.message
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.message
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration service error"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token
    
    Uses refresh token to generate a new access token.
    """
    try:
        auth_result = await unified_auth_service.refresh_token(
            db=db,
            refresh_token=refresh_token
        )
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=auth_result.error or "Token refresh failed",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return TokenResponse(
            access_token=auth_result.access_token,
            token_type="bearer",
            expires_in=auth_result.expires_in,
            refresh_token=auth_result.refresh_token,
            user=user_to_response(auth_result.user)
        )
        
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh service error"
        )


@router.post("/logout")
async def logout(
    request: Request,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User logout
    
    Invalidates the current session and tokens.
    """
    try:
        # Extract session ID from request if available
        session_id = request.headers.get("X-Session-ID")
        
        success = await unified_auth_service.logout(
            db=db,
            user_id=str(current_user.id),
            session_id=session_id
        )
        
        if success:
            return {"message": "Successfully logged out"}
        else:
            return {"message": "Logout completed (session may have already expired)"}
        
    except Exception as e:
        # Even if logout fails, we don't want to prevent the user from logging out
        return {"message": "Logout completed"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user = Depends(get_current_user)
):
    """
    Get current user information
    
    Returns the authenticated user's profile information.
    """
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


@router.post("/verify-token")
async def verify_token(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify JWT token validity
    
    Checks if a token is valid and returns user information.
    """
    try:
        auth_result = await unified_auth_service.verify_token(db=db, token=token)
        
        if not auth_result.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return {
            "valid": True,
            "user": user_to_response(auth_result.user)
        }
        
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token verification service error"
        )


# Backward compatibility endpoints
@router.post("/signin", response_model=TokenResponse)
async def signin_compat(
    request: Request,
    login_data: LoginRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Backward compatibility endpoint for signin"""
    return await login(request, login_data, background_tasks, db)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup_compat(
    request: Request,
    register_data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Backward compatibility endpoint for signup"""
    return await register(request, register_data, background_tasks, db) 