"""
Unified Authentication API Router
Consolidates all authentication endpoints into a single, clean API
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
import logging

from app.auth.unified_auth_system import (
    UnifiedAuthService,
    UserLoginRequest,
    UserRegisterRequest,
    TokenResponse,
    AuthResult,
    AuthStatus,
    get_current_user,
    get_current_active_user,
    get_admin_user,
    unified_auth_service
)
from app.auth.oauth_service import oauth_service
from app.database.connection import get_async_session
from app.core.error_decorators import handle_auth_errors, handle_database_errors
from app.core.rate_limiting import rate_limiter

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

@router.post("/login", response_model=TokenResponse)
@handle_auth_errors
async def login(
    login_data: UserLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    User login endpoint
    
    Returns access token and refresh token on successful authentication
    """
    try:
        # Attempt login
        auth_result = await unified_auth_service.login_user(db, login_data)
        
        if not auth_result.success:
            # Log failed attempt
            logger.warning(f"Login failed for {login_data.email}: {auth_result.error_message}")
            
            # Return appropriate error
            if auth_result.status == AuthStatus.ACCOUNT_LOCKED:
                raise HTTPException(status_code=423, detail=auth_result.error_message)
            elif auth_result.status == AuthStatus.ACCOUNT_DISABLED:
                raise HTTPException(status_code=403, detail=auth_result.error_message)
            else:
                raise HTTPException(status_code=401, detail=auth_result.error_message)
        
        # Success - log and return tokens
        logger.info(f"Successful login for user {auth_result.user.email}")
        
        return TokenResponse(
            access_token=auth_result.access_token,
            refresh_token=auth_result.refresh_token,
            token_type="bearer",
            expires_in=auth_result.metadata.get("expires_in", 1800),
            user={
                "id": str(auth_result.user.id),
                "email": auth_result.user.email,
                "username": auth_result.user.username,
                "first_name": auth_result.user.first_name,
                "last_name": auth_result.user.last_name,
                "role": auth_result.user.role.value if auth_result.user.role else "user",
                "is_verified": auth_result.user.is_verified,
                "organization_id": str(auth_result.user.organization_id) if auth_result.user.organization_id else None
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error for {login_data.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during login")

@router.post("/register", response_model=TokenResponse)
@handle_auth_errors
async def register(
    register_data: UserRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    User registration endpoint
    
    Creates new user account and returns access tokens
    """
    try:
        # Create user
        user = await unified_auth_service.create_user(db, register_data)
        
        # Auto-login after registration
        login_data = UserLoginRequest(
            email=register_data.email,
            password=register_data.password
        )
        
        auth_result = await unified_auth_service.login_user(db, login_data)
        
        if not auth_result.success:
            # This shouldn't happen, but handle gracefully
            logger.error(f"Auto-login failed after registration for {register_data.email}")
            raise HTTPException(status_code=500, detail="Registration successful but auto-login failed")
        
        logger.info(f"New user registered: {user.email}")
        
        return TokenResponse(
            access_token=auth_result.access_token,
            refresh_token=auth_result.refresh_token,
            token_type="bearer",
            expires_in=auth_result.metadata.get("expires_in", 1800),
            user={
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role.value if user.role else "user",
                "is_verified": user.is_verified,
                "organization_id": str(user.organization_id) if user.organization_id else None
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error for {register_data.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during registration")

@router.post("/refresh", response_model=Dict[str, Any])
@handle_auth_errors
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Refresh access token using refresh token
    """
    try:
        auth_result = await unified_auth_service.refresh_access_token(db, credentials.credentials)
        
        if not auth_result.success:
            raise HTTPException(status_code=401, detail=auth_result.error_message)
        
        return {
            "access_token": auth_result.access_token,
            "token_type": "bearer",
            "expires_in": auth_result.metadata.get("expires_in", 1800)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during token refresh")

@router.get("/me", response_model=Dict[str, Any])
async def get_current_user_info(
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get current authenticated user information
    """
    # Get available authentication methods
    auth_methods = await unified_auth_service.get_user_auth_methods(db, current_user)
    
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role.value if current_user.role else "user",
        "is_verified": current_user.is_verified,
        "is_active": current_user.is_active,
        "organization_id": str(current_user.organization_id) if current_user.organization_id else None,
        "oauth_provider": current_user.oauth_provider.value if current_user.oauth_provider else None,
        "is_oauth_user": await unified_auth_service.is_oauth_user(current_user),
        "auth_methods": auth_methods,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None
    }

@router.post("/logout")
async def logout(
    current_user = Depends(get_current_active_user)
):
    """
    User logout endpoint
    
    Note: With JWT tokens, logout is mainly handled on the client side
    by discarding the token. Server-side token blacklisting could be added here.
    """
    logger.info(f"User {current_user.email} logged out")
    
    return {
        "message": "Successfully logged out",
        "user_id": str(current_user.id)
    }

@router.get("/status")
async def auth_status():
    """
    Authentication system status endpoint
    """
    return {
        "service": "Unified Authentication System",
        "status": "active",
        "version": "1.0.0",
        "features": [
            "JWT access tokens",
            "JWT refresh tokens", 
            "Role-based authorization",
            "Account lockout protection",
            "Password strength validation",
            "Organization support",
            "OAuth 2.0 authentication",
            "Google OAuth integration",
            "GitHub OAuth integration"
        ],
        "oauth_providers": [
            "google",
            "github"
        ]
    }

# Admin endpoints
@router.get("/admin/users", response_model=List[Dict[str, Any]])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    List all users (admin only)
    """
    from sqlalchemy import select
    from app.database.models import User
    
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    
    return [
        {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role.value if user.role else "user",
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None
        }
        for user in users
    ]

@router.put("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_data: Dict[str, str],
    admin_user = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Update user role (admin only)
    """
    from app.database.models import User, UserRole
    import uuid
    
    # Get user
    user = await unified_auth_service.get_user_by_id(db, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update role
    new_role = role_data.get("role")
    if new_role not in [role.value for role in UserRole]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user.role = UserRole(new_role)
    await db.commit()
    
    logger.info(f"Admin {admin_user.email} updated user {user.email} role to {new_role}")
    
    return {
        "message": "User role updated successfully",
        "user_id": str(user.id),
        "new_role": new_role
    }

# OAuth 2.0 endpoints
@router.get("/oauth/{provider}/authorize")
@rate_limiter(max_calls=5, time_window=60)  # 5 authorization attempts per minute
@handle_auth_errors
async def oauth_authorize(
    provider: str,
    request: Request
):
    """
    Start OAuth 2.0 authorization flow
    
    Supported providers: google, github
    """
    try:
        # Construct redirect URI
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}/api/v1/auth/oauth/{provider}/callback"
        
        # Get authorization URL
        auth_url, state = await oauth_service.get_authorization_url(provider, redirect_uri)
        
        return {
            "authorization_url": auth_url,
            "state": state,
            "provider": provider,
            "redirect_uri": redirect_uri
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth authorization error for {provider}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start OAuth authorization")

@router.get("/oauth/{provider}/callback", response_model=TokenResponse)
@rate_limiter(max_calls=10, time_window=60)  # 10 callback attempts per minute
@handle_auth_errors
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Handle OAuth 2.0 callback
    
    This endpoint is called by the OAuth provider after user authorization
    """
    try:
        # Construct redirect URI (must match the one used in authorization)
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}/api/v1/auth/oauth/{provider}/callback"
        
        # Handle OAuth callback
        auth_result = await oauth_service.handle_oauth_callback(
            provider, code, state, redirect_uri, db
        )
        
        if not auth_result.success:
            logger.warning(f"OAuth callback failed for {provider}: {auth_result.error_message}")
            
            if auth_result.status == AuthStatus.ACCOUNT_LOCKED:
                raise HTTPException(status_code=423, detail=auth_result.error_message)
            elif auth_result.status == AuthStatus.ACCOUNT_DISABLED:
                raise HTTPException(status_code=403, detail=auth_result.error_message)
            else:
                raise HTTPException(status_code=401, detail=auth_result.error_message)
        
        logger.info(f"OAuth login successful for user {auth_result.user.email} via {provider}")
        
        return TokenResponse(
            access_token=auth_result.access_token,
            refresh_token=auth_result.refresh_token,
            token_type="bearer",
            expires_in=auth_result.metadata.get("expires_in", 1800),
            user={
                "id": str(auth_result.user.id),
                "email": auth_result.user.email,
                "username": auth_result.user.username,
                "first_name": auth_result.user.first_name,
                "last_name": auth_result.user.last_name,
                "role": auth_result.user.role.value if auth_result.user.role else "user",
                "is_verified": auth_result.user.is_verified,
                "organization_id": str(auth_result.user.organization_id) if auth_result.user.organization_id else None,
                "oauth_provider": auth_result.metadata.get("oauth_provider")
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback error for {provider}: {str(e)}")
        raise HTTPException(status_code=500, detail="OAuth authentication failed")

@router.get("/oauth/accounts")
async def get_oauth_accounts(
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get OAuth accounts linked to current user
    """
    try:
        oauth_accounts = await oauth_service.get_user_oauth_accounts(db, current_user.id)
        
        return {
            "oauth_accounts": oauth_accounts,
            "total": len(oauth_accounts)
        }
        
    except Exception as e:
        logger.error(f"Error getting OAuth accounts for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve OAuth accounts")

@router.delete("/oauth/{provider}/unlink")
async def unlink_oauth_account(
    provider: str,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Unlink an OAuth account from current user
    """
    try:
        success = await oauth_service.unlink_oauth_account(db, current_user.id, provider)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"No {provider} OAuth account found")
        
        logger.info(f"User {current_user.email} unlinked {provider} OAuth account")
        
        return {
            "message": f"Successfully unlinked {provider} OAuth account",
            "provider": provider
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unlinking OAuth account for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to unlink OAuth account")

# Legacy compatibility endpoints
@router.get("/legacy/status")
async def legacy_auth_status():
    """
    Legacy authentication status endpoint for backwards compatibility
    """
    return {
        "message": "Legacy auth endpoints are deprecated. Use /api/v1/auth/status instead.",
        "status": "deprecated",
        "migration_guide": "https://docs.schlep-engine.com/auth-migration"
    } 