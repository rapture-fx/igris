"""
Enhanced Authentication API Routes

This module extends the existing authentication API with enhanced security features
including MFA, secure session management, and password policy enforcement.

Features:
- Enhanced login with MFA support
- Session management endpoints
- Password policy enforcement
- Trusted device management
- Security monitoring endpoints
- Backward compatibility with existing API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging

from app.database.connection import get_db
from app.database.models import User
from app.auth.security import verify_password, get_password_hash
from app.security.authentication.enhanced_auth import (
    enhanced_auth,
    PasswordPolicyViolation,
    AccountLockedException,
    MFARequiredException,
    SessionExpiredException,
    enhance_password_validation,
    create_enhanced_password_hash,
    SessionInfo,
    AuthenticationMethod
)
from app.security.authentication.enhanced_dependencies import (
    get_enhanced_current_active_user,
    get_client_info,
    get_session_info,
    require_mfa_verification,
    require_trusted_device,
    require_recent_authentication
)

# Import existing models for compatibility
from app.api.v1.auth import UserResponse, Token

logger = logging.getLogger(__name__)
router = APIRouter()

# Enhanced Pydantic models
class EnhancedLoginRequest(BaseModel):
    username: str
    password: str
    remember_device: bool = False
    device_name: Optional[str] = None

class MFAVerificationRequest(BaseModel):
    mfa_token: str
    mfa_code: str
    mfa_method: str = "totp"
    trust_device: bool = False

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class SessionResponse(BaseModel):
    session_id: str
    device_fingerprint: str
    ip_address: str
    user_agent: str
    device_name: Optional[str]
    created_at: datetime
    last_activity: datetime
    is_current: bool
    is_trusted_device: bool
    location: Optional[str] = None

class PasswordPolicyResponse(BaseModel):
    min_length: int
    require_uppercase: bool
    require_lowercase: bool
    require_numbers: bool
    require_symbols: bool
    max_age_days: int
    min_entropy_bits: int

class PasswordValidationRequest(BaseModel):
    password: str

class PasswordValidationResponse(BaseModel):
    is_valid: bool
    violations: List[str]
    strength_score: float

class EnhancedPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    revoke_all_sessions: bool = False

class AccountSecurityResponse(BaseModel):
    mfa_enabled: bool
    mfa_methods: List[str]
    trusted_devices_count: int
    active_sessions_count: int
    last_password_change: Optional[datetime]
    password_expires_at: Optional[datetime]
    failed_attempts_count: int
    is_locked: bool

@router.post("/enhanced-login", response_model=Dict[str, Any])
async def enhanced_login(
    request: Request,
    login_data: EnhancedLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Enhanced login with MFA support and session management.
    
    Supports both traditional login flow and MFA-enabled accounts.
    Maintains backward compatibility with existing login endpoint.
    """
    try:
        # Get client information
        ip_address, user_agent = get_client_info(request)
        
        # Authenticate with password (first factor)
        result = await enhanced_auth.authenticate_with_password(
            username=login_data.username,
            password=login_data.password,
            ip_address=ip_address,
            user_agent=user_agent,
            db=db,
            require_mfa=True  # Enable MFA by default
        )
        
        # If MFA is required, return challenge
        if result.get("requires_mfa"):
            return {
                "status": "mfa_required",
                "mfa_token": result["mfa_token"],
                "mfa_methods": result["mfa_methods"],
                "message": "Multi-factor authentication required"
            }
        
        # Full authentication successful
        return {
            "status": "success",
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": result["token_type"],
            "expires_in": result["expires_in"],
            "session_id": result["session_id"],
            "user": result["user"]
        }
        
    except AccountLockedException as e:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/verify-mfa", response_model=Dict[str, Any])
async def verify_mfa(
    request: Request,
    mfa_data: MFAVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify MFA code and complete authentication.
    
    Called after enhanced login when MFA is required.
    """
    try:
        # Get client information
        ip_address, user_agent = get_client_info(request)
        
        # Verify MFA and complete authentication
        result = await enhanced_auth.verify_mfa_and_complete_authentication(
            mfa_token=mfa_data.mfa_token,
            mfa_code=mfa_data.mfa_code,
            mfa_method=mfa_data.mfa_method,
            ip_address=ip_address,
            user_agent=user_agent,
            db=db,
            trust_device=mfa_data.trust_device
        )
        
        return {
            "status": "success",
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": result["token_type"],
            "expires_in": result["expires_in"],
            "session_id": result["session_id"],
            "user": result["user"],
            "device_trusted": mfa_data.trust_device
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA verification failed"
        )

@router.post("/refresh-token", response_model=Dict[str, Any])
async def refresh_access_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    
    Provides secure token rotation with session validation.
    """
    try:
        result = await enhanced_auth.refresh_access_token(
            refresh_token=refresh_data.refresh_token,
            db=db
        )
        
        return {
            "status": "success",
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )

@router.get("/sessions", response_model=List[SessionResponse])
async def get_user_sessions(
    request: Request,
    current_user: User = Depends(get_enhanced_current_active_user),
    session_info: Optional[SessionInfo] = Depends(get_session_info)
):
    """Get all active sessions for the current user"""
    try:
        user_sessions = enhanced_auth.get_user_sessions(str(current_user.id))
        current_session_id = session_info.session_id if session_info else None
        
        sessions = []
        for session in user_sessions:
            sessions.append(SessionResponse(
                session_id=session.session_id,
                device_fingerprint=session.device_fingerprint,
                ip_address=session.ip_address,
                user_agent=session.user_agent,
                device_name=None,  # Would be stored in database
                created_at=session.created_at,
                last_activity=session.last_activity,
                is_current=session.session_id == current_session_id,
                is_trusted_device=session.is_trusted_device,
                location=None  # Would be resolved from IP
            ))
        
        return sessions
        
    except Exception as e:
        logger.error(f"Failed to get user sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )

@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_enhanced_current_active_user)
):
    """Revoke a specific session"""
    try:
        # Verify session belongs to current user
        user_sessions = enhanced_auth.get_user_sessions(str(current_user.id))
        
        if not any(s.session_id == session_id for s in user_sessions):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        await enhanced_auth.revoke_session(session_id)
        
        return {"message": "Session revoked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        )

@router.delete("/sessions")
async def revoke_all_sessions(
    current_user: User = Depends(get_enhanced_current_active_user)
):
    """Revoke all sessions for the current user"""
    try:
        await enhanced_auth.revoke_all_user_sessions(str(current_user.id))
        
        return {"message": "All sessions revoked successfully"}
        
    except Exception as e:
        logger.error(f"Failed to revoke all sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke sessions"
        )

@router.get("/password-policy", response_model=PasswordPolicyResponse)
async def get_password_policy():
    """Get current password policy requirements"""
    policy = enhanced_auth.password_policy
    
    return PasswordPolicyResponse(
        min_length=policy.min_length,
        require_uppercase=policy.require_uppercase,
        require_lowercase=policy.require_lowercase,
        require_numbers=policy.require_numbers,
        require_symbols=policy.require_symbols,
        max_age_days=policy.max_age_days,
        min_entropy_bits=policy.min_entropy_bits
    )

@router.post("/validate-password", response_model=PasswordValidationResponse)
async def validate_password(validation_data: PasswordValidationRequest):
    """Validate password against policy requirements"""
    try:
        is_valid, violations = enhanced_auth.validate_password_policy(validation_data.password)
        
        # Calculate strength score (0-100)
        entropy = enhanced_auth._calculate_password_entropy(validation_data.password)
        max_entropy = enhanced_auth.password_policy.min_entropy_bits * 2  # Reasonable max
        strength_score = min(100.0, (entropy / max_entropy) * 100)
        
        return PasswordValidationResponse(
            is_valid=is_valid,
            violations=violations,
            strength_score=round(strength_score, 1)
        )
        
    except Exception as e:
        logger.error(f"Password validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password validation failed"
        )

@router.post("/change-password-enhanced")
async def change_password_enhanced(
    password_data: EnhancedPasswordChangeRequest,
    current_user: User = Depends(require_recent_authentication(30)),  # Require recent auth
    db: AsyncSession = Depends(get_db)
):
    """
    Enhanced password change with policy enforcement.
    
    Requires recent authentication and enforces password policy.
    """
    try:
        # Verify current password
        if not verify_password(password_data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password"
            )
        
        # Validate new password against policy
        try:
            enhance_password_validation(password_data.new_password)
        except PasswordPolicyViolation as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
        # Check password reuse (simplified - would check database history)
        if password_data.new_password == password_data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password"
            )
        
        # Update password
        current_user.hashed_password = create_enhanced_password_hash(password_data.new_password)
        current_user.updated_at = datetime.utcnow()
        await db.commit()
        
        # Revoke all sessions if requested
        if password_data.revoke_all_sessions:
            await enhanced_auth.revoke_all_user_sessions(str(current_user.id))
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced password change failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )

@router.get("/security-status", response_model=AccountSecurityResponse)
async def get_account_security_status(
    current_user: User = Depends(get_enhanced_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive account security status"""
    try:
        # Get user sessions
        user_sessions = enhanced_auth.get_user_sessions(str(current_user.id))
        
        # Get authentication attempts
        user_attempts = enhanced_auth._auth_attempts.get(current_user.username, [])
        recent_failures = [
            a for a in user_attempts
            if not a.success and a.timestamp > datetime.utcnow() - timedelta(hours=24)
        ]
        
        # Check if account is locked
        is_locked = enhanced_auth.is_account_locked(current_user.username)
        
        return AccountSecurityResponse(
            mfa_enabled=await enhanced_auth._user_has_mfa_enabled(str(current_user.id), db),
            mfa_methods=await enhanced_auth._get_user_mfa_methods(str(current_user.id), db),
            trusted_devices_count=0,  # Would query database
            active_sessions_count=len(user_sessions),
            last_password_change=current_user.updated_at,
            password_expires_at=None,  # Would calculate based on policy
            failed_attempts_count=len(recent_failures),
            is_locked=is_locked
        )
        
    except Exception as e:
        logger.error(f"Failed to get security status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve security status"
        )

# Endpoints that require MFA verification
@router.get("/sensitive-data")
async def get_sensitive_data(
    current_user: User = Depends(require_mfa_verification()),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint requiring MFA verification"""
    return {
        "message": "This is sensitive data that requires MFA",
        "user_id": str(current_user.id),
        "timestamp": datetime.utcnow()
    }

# Endpoints that require trusted device
@router.get("/admin-functions")
async def admin_functions(
    current_user: User = Depends(require_trusted_device()),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint requiring trusted device"""
    return {
        "message": "This admin function requires a trusted device",
        "user_id": str(current_user.id),
        "timestamp": datetime.utcnow()
    }

# Backward compatibility endpoint - delegates to existing auth
@router.post("/login-legacy", response_model=Token)
async def login_legacy(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Legacy login endpoint for backward compatibility.
    
    This endpoint maintains the exact same behavior as the original login
    but can be gradually migrated to enhanced login.
    """
    # Import and use existing login logic
    from app.api.v1.auth import login
    return await login(form_data, db) 