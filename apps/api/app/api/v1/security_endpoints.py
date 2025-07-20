"""
Enhanced Security API Endpoints
==============================

Comprehensive API endpoints for the enhanced security system:
- Password reset flow
- Two-Factor Authentication (2FA)
- Session management
- API key management
- Security audit logging
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime

from app.auth.enhanced_security_system import (
    EnhancedSecuritySystem,
    PasswordResetRequest,
    PasswordResetConfirm,
    MFAEnableRequest,
    MFAVerifyRequest,
    APIKeyCreateRequest,
    APIKeyUpdateRequest,
    MFAMethod,
    SecurityLevel,
    enhanced_security
)
from app.database.connection import get_async_session
from app.database.models import User
from app.auth.unified_auth_system import get_current_active_user
from app.core.error_decorators import handle_auth_errors, handle_database_errors

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/security", tags=["Security & Compliance"])
security = HTTPBearer()

# ==================== PASSWORD RESET ENDPOINTS ====================

@router.post("/password-reset/request")
@handle_auth_errors
async def request_password_reset(
    request_data: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    🔐 REQUEST PASSWORD RESET
    
    Initiate password reset process for a user account.
    Sends reset link to user's email address.
    """
    try:
        # Get client IP address
        client_ip = request.client.host
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        result = await enhanced_security.initiate_password_reset(
            db, request_data.email, client_ip
        )
        
        return {
            "message": result["message"],
            "success": result["success"],
            "expires_at": result.get("expires_at")
        }
        
    except Exception as e:
        logger.error(f"Password reset request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )

@router.post("/password-reset/verify")
@handle_auth_errors
async def verify_password_reset_token(
    token: str,
    db: AsyncSession = Depends(get_async_session)
):
    """
    🔍 VERIFY PASSWORD RESET TOKEN
    
    Verify that a password reset token is valid and not expired.
    Returns user information if token is valid.
    """
    try:
        user_info = await enhanced_security.verify_password_reset_token(db, token)
        
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        return {
            "valid": True,
            "user": {
                "email": user_info["email"],
                "username": user_info["username"]
            },
            "expires_at": user_info["expires_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify reset token"
        )

@router.post("/password-reset/complete")
@handle_auth_errors
async def complete_password_reset(
    reset_data: PasswordResetConfirm,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    ✅ COMPLETE PASSWORD RESET
    
    Complete password reset process with new password.
    Requires valid reset token and strong password.
    """
    try:
        # Get client IP address
        client_ip = request.client.host
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        success = await enhanced_security.complete_password_reset(
            db, reset_data.token, reset_data.new_password, client_ip
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to complete password reset"
            )
        
        return {
            "message": "Password reset completed successfully",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset completion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete password reset"
        )

# ==================== TWO-FACTOR AUTHENTICATION ENDPOINTS ====================

@router.post("/mfa/enable")
@handle_auth_errors
async def enable_mfa(
    mfa_data: MFAEnableRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🔐 ENABLE TWO-FACTOR AUTHENTICATION
    
    Enable 2FA for user account with specified method.
    Supports TOTP, SMS, and email verification.
    """
    try:
        result = await enhanced_security.enable_mfa(
            db, str(current_user.id), mfa_data.method, mfa_data.phone_number
        )
        
        return {
            "message": f"2FA enabled with {mfa_data.method.value}",
            "setup_required": result.get("verification_required", False),
            "data": result
        }
        
    except Exception as e:
        logger.error(f"MFA enable failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable 2FA: {str(e)}"
        )

@router.post("/mfa/verify-setup")
@handle_auth_errors
async def verify_mfa_setup(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    ✅ VERIFY MFA SETUP
    
    Verify 2FA setup with provided verification code.
    Completes the 2FA setup process.
    """
    try:
        success = await enhanced_security.verify_mfa_setup(
            db, str(current_user.id), verify_data.method, verify_data.code
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        return {
            "message": "2FA setup verified successfully",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA setup verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify 2FA setup"
        )

@router.post("/mfa/verify-login")
@handle_auth_errors
async def verify_mfa_login(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🔐 VERIFY MFA LOGIN
    
    Verify 2FA during login process.
    Required for accounts with 2FA enabled.
    """
    try:
        success = await enhanced_security.verify_mfa_login(
            db, str(current_user.id), verify_data.method, verify_data.code, verify_data.remember_device
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid 2FA code"
            )
        
        return {
            "message": "2FA verification successful",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA login verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify 2FA"
        )

@router.delete("/mfa/disable")
@handle_auth_errors
async def disable_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🚫 DISABLE TWO-FACTOR AUTHENTICATION
    
    Disable 2FA for user account.
    Requires additional verification in production.
    """
    try:
        success = await enhanced_security.disable_mfa(db, str(current_user.id))
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to disable 2FA"
            )
        
        return {
            "message": "2FA disabled successfully",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA disable failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable 2FA"
        )

@router.get("/mfa/status")
async def get_mfa_status(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    📊 GET MFA STATUS
    
    Get current 2FA status and configuration for user.
    """
    try:
        mfa_info = await enhanced_security._get_mfa_info(str(current_user.id))
        
        return {
            "enabled": mfa_info.is_enabled if mfa_info else False,
            "method": mfa_info.method.value if mfa_info else None,
            "created_at": mfa_info.created_at.isoformat() if mfa_info else None,
            "last_used": mfa_info.last_used.isoformat() if mfa_info and mfa_info.last_used else None
        }
        
    except Exception as e:
        logger.error(f"Failed to get MFA status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA status"
        )

# ==================== SESSION MANAGEMENT ENDPOINTS ====================

@router.get("/sessions")
async def get_user_sessions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    📱 GET USER SESSIONS
    
    Get all active sessions for the current user.
    Shows device information and security status.
    """
    try:
        sessions = await enhanced_security.get_user_sessions(str(current_user.id))
        
        return {
            "sessions": [
                {
                    "session_id": session.session_id,
                    "ip_address": session.ip_address,
                    "user_agent": session.user_agent,
                    "created_at": session.created_at.isoformat(),
                    "last_accessed": session.last_accessed.isoformat(),
                    "expires_at": session.expires_at.isoformat(),
                    "status": session.status.value,
                    "security_level": session.security_level.value,
                    "mfa_verified": session.mfa_verified,
                    "risk_score": session.risk_score,
                    "device_fingerprint": session.device_fingerprint[:8] + "..."
                }
                for session in sessions
            ],
            "total_sessions": len(sessions)
        }
        
    except Exception as e:
        logger.error(f"Failed to get user sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user sessions"
        )

@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🚫 REVOKE SESSION
    
    Revoke a specific user session.
    Useful for logging out from specific devices.
    """
    try:
        # Verify session belongs to user
        session = await enhanced_security.get_session(session_id)
        if not session or session.user_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        success = await enhanced_security.revoke_session(session_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to revoke session"
            )
        
        return {
            "message": "Session revoked successfully",
            "success": True
        }
        
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
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🚫 REVOKE ALL SESSIONS
    
    Revoke all sessions for the current user except the current one.
    Useful for security incidents or password changes.
    """
    try:
        revoked_count = await enhanced_security.revoke_user_sessions(str(current_user.id))
        
        return {
            "message": f"Revoked {revoked_count} sessions",
            "revoked_count": revoked_count,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Failed to revoke all sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke sessions"
        )

# ==================== API KEY MANAGEMENT ENDPOINTS ====================

@router.post("/api-keys")
@handle_auth_errors
async def create_api_key(
    key_data: APIKeyCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🔑 CREATE API KEY
    
    Create a new API key with specified permissions and rate limits.
    The full key is shown only once for security.
    """
    try:
        result = await enhanced_security.create_api_key(
            db, str(current_user.id), key_data.name, 
            key_data.permissions, key_data.expires_at, key_data.rate_limit
        )
        
        return {
            "message": "API key created successfully",
            "api_key": result,
            "warning": "Store the API key securely - it won't be shown again"
        }
        
    except Exception as e:
        logger.error(f"API key creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create API key: {str(e)}"
        )

@router.get("/api-keys")
async def get_api_keys(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    📋 GET API KEYS
    
    Get all API keys for the current user.
    Full keys are not returned for security.
    """
    try:
        api_keys = await enhanced_security.get_user_api_keys(db, str(current_user.id))
        
        return {
            "api_keys": api_keys,
            "total_keys": len(api_keys)
        }
        
    except Exception as e:
        logger.error(f"Failed to get API keys: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get API keys"
        )

@router.put("/api-keys/{key_id}")
@handle_auth_errors
async def update_api_key(
    key_id: str,
    updates: APIKeyUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    ✏️ UPDATE API KEY
    
    Update API key properties like name, permissions, or status.
    """
    try:
        success = await enhanced_security.update_api_key(db, key_id, updates)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        return {
            "message": "API key updated successfully",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API key update failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update API key"
        )

@router.delete("/api-keys/{key_id}")
@handle_auth_errors
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🚫 REVOKE API KEY
    
    Revoke an API key to prevent further access.
    """
    try:
        success = await enhanced_security.revoke_api_key(db, key_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        return {
            "message": "API key revoked successfully",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API key revocation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke API key"
        )

# ==================== SECURITY STATUS ENDPOINTS ====================

@router.get("/status")
async def get_security_status(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    📊 GET SECURITY STATUS
    
    Get comprehensive security status for the current user.
    """
    try:
        # Get MFA status
        mfa_info = await enhanced_security._get_mfa_info(str(current_user.id))
        
        # Get active sessions
        sessions = await enhanced_security.get_user_sessions(str(current_user.id))
        
        # Get API keys
        api_keys = await enhanced_security.get_user_api_keys(db, str(current_user.id))
        
        return {
            "user_id": str(current_user.id),
            "email": current_user.email,
            "security_features": {
                "mfa_enabled": mfa_info.is_enabled if mfa_info else False,
                "mfa_method": mfa_info.method.value if mfa_info else None,
                "active_sessions": len(sessions),
                "api_keys_count": len(api_keys),
                "last_login": current_user.last_login.isoformat() if current_user.last_login else None
            },
            "security_recommendations": [
                "Enable 2FA for enhanced security" if not mfa_info or not mfa_info.is_enabled else None,
                "Review active sessions regularly" if len(sessions) > 3 else None,
                "Rotate API keys periodically" if len(api_keys) > 0 else None
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get security status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get security status"
        )

@router.post("/cleanup")
async def cleanup_security_data(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    🧹 CLEANUP SECURITY DATA
    
    Clean up expired sessions and security data.
    Admin function for maintenance.
    """
    try:
        # Clean up expired sessions
        expired_count = await enhanced_security.cleanup_expired_sessions()
        
        return {
            "message": "Security data cleanup completed",
            "expired_sessions_removed": expired_count,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Security cleanup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup security data"
        )

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    📋 GET AUDIT LOGS (ADMIN)
    
    Get security audit logs for monitoring and compliance.
    Admin access required.
    """
    try:
        # Check if user is admin
        if current_user.role.value not in ["admin", "enterprise_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        from sqlalchemy import select, and_
        from app.database.models import AuditLog
        
        # Build query
        query = select(AuditLog)
        conditions = []
        
        if user_id:
            conditions.append(AuditLog.user_id == user_id)
        if action:
            conditions.append(AuditLog.action == action)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.offset(skip).limit(limit).order_by(AuditLog.created_at.desc())
        
        result = await db.execute(query)
        audit_logs = result.scalars().all()
        
        return {
            "audit_logs": [
                {
                    "id": str(log.id),
                    "user_id": str(log.user_id),
                    "action": log.action,
                    "resource_type": log.resource_type,
                    "resource_id": log.resource_id,
                    "details": log.details,
                    "ip_address": log.ip_address,
                    "user_agent": log.user_agent,
                    "created_at": log.created_at.isoformat()
                }
                for log in audit_logs
            ],
            "total": len(audit_logs)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get audit logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get audit logs"
        ) 