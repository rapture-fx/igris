"""
Enhanced Security & Compliance System
====================================

Comprehensive authentication and authorization system with:
- Secure password reset flow
- Two-Factor Authentication (2FA)
- Robust session management
- API key management system
- Security audit logging
- Compliance tracking
"""

import secrets
import hashlib
import re
import uuid
import json
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any, Tuple, Union
from enum import Enum
from dataclasses import dataclass, asdict
from cryptography.fernet import Fernet
import pyotp
import qrcode
from io import BytesIO
import logging
from passlib.context import CryptContext
from jose import JWTError, jwt
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from pydantic import BaseModel, EmailStr, validator

from app.core.config import settings
from app.database.models import User, ApiKey, AuditLog
from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

# ==================== ENUMS AND MODELS ====================

class SecurityLevel(Enum):
    """Security levels for different operations"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class MFAMethod(Enum):
    """MFA methods supported"""
    TOTP = "totp"  # Time-based One-Time Password
    SMS = "sms"    # SMS verification
    EMAIL = "email"  # Email verification
    BACKUP_CODES = "backup_codes"  # Backup codes

class SessionStatus(Enum):
    """Session status"""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    SUSPICIOUS = "suspicious"

class PasswordResetStatus(Enum):
    """Password reset status"""
    PENDING = "pending"
    COMPLETED = "completed"
    EXPIRED = "expired"
    INVALID = "invalid"

# ==================== PYDANTIC MODELS ====================

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v

class MFAEnableRequest(BaseModel):
    method: MFAMethod
    phone_number: Optional[str] = None  # For SMS

class MFAVerifyRequest(BaseModel):
    method: MFAMethod
    code: str
    remember_device: bool = False

class APIKeyCreateRequest(BaseModel):
    name: str
    permissions: List[str] = []
    expires_at: Optional[datetime] = None
    rate_limit: Optional[int] = None

class APIKeyUpdateRequest(BaseModel):
    name: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    rate_limit: Optional[int] = None

# ==================== DATACLASSES ====================

@dataclass
class SessionInfo:
    """Session information"""
    session_id: str
    user_id: str
    ip_address: str
    user_agent: str
    created_at: datetime
    last_accessed: datetime
    expires_at: datetime
    status: SessionStatus
    security_level: SecurityLevel
    mfa_verified: bool
    device_fingerprint: str
    risk_score: float
    metadata: Dict[str, Any]

@dataclass
class PasswordResetInfo:
    """Password reset information"""
    token: str
    user_id: str
    email: str
    created_at: datetime
    expires_at: datetime
    status: PasswordResetStatus
    attempts: int
    ip_address: str

@dataclass
class MFAInfo:
    """MFA information"""
    user_id: str
    method: MFAMethod
    secret: str  # Encrypted
    backup_codes: List[str]  # Encrypted
    is_enabled: bool
    created_at: datetime
    last_used: Optional[datetime] = None

# ==================== ENHANCED SECURITY SYSTEM ====================

class EnhancedSecuritySystem:
    """
    Enhanced Security & Compliance System
    
    Provides comprehensive authentication and authorization features:
    - Secure password reset flow
    - Two-Factor Authentication (2FA)
    - Robust session management
    - API key management
    - Security audit logging
    """
    
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.redis_client = None
        self._encryption_key = Fernet.generate_key()
        self._cipher = Fernet(self._encryption_key)
        
        # Security settings
        self.max_failed_attempts = 5
        self.lockout_duration = timedelta(minutes=30)
        self.session_timeout = timedelta(hours=8)
        self.password_reset_timeout = timedelta(hours=1)
        self.mfa_challenge_timeout = timedelta(minutes=5)
        self.max_concurrent_sessions = 5
        self.max_api_keys_per_user = 10
        
        # Initialize Redis connection
        self._init_redis()
    
    async def _init_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = await get_redis_client()
            if self.redis_client:
                await self.redis_client.ping()
                logger.info("Redis connection established for enhanced security")
            else:
                logger.warning("Redis not available - some security features will be limited")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Some security features will be limited.")
            self.redis_client = None
    
    # ==================== PASSWORD RESET FLOW ====================
    
    async def initiate_password_reset(
        self, 
        db: AsyncSession, 
        email: str, 
        ip_address: str
    ) -> Dict[str, Any]:
        """
        Initiate password reset process
        
        Returns:
            Dict with reset token and expiry information
        """
        try:
            # Find user by email
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if not user:
                # Don't reveal if user exists
                logger.info(f"Password reset requested for non-existent email: {email}")
                return {
                    "message": "If the email exists, a password reset link has been sent",
                    "success": True
                }
            
            if not user.is_active:
                raise ValueError("Account is inactive")
            
            # Generate secure reset token
            reset_token = self._generate_secure_token(32)
            expires_at = datetime.utcnow() + self.password_reset_timeout
            
            # Store reset information in Redis
            reset_info = PasswordResetInfo(
                token=reset_token,
                user_id=str(user.id),
                email=email,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                status=PasswordResetStatus.PENDING,
                attempts=0,
                ip_address=ip_address
            )
            
            await self._store_password_reset_info(reset_token, reset_info)
            
            # Log security event
            await self._log_security_event(
                db, user.id, "password_reset_initiated",
                {"ip_address": ip_address, "email": email}
            )
            
            # In production, send email here
            logger.info(f"Password reset initiated for user {email} from {ip_address}")
            
            return {
                "message": "Password reset link sent to your email",
                "success": True,
                "expires_at": expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Password reset initiation failed: {e}")
            raise
    
    async def verify_password_reset_token(
        self, 
        db: AsyncSession, 
        token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Verify password reset token
        
        Returns:
            User information if token is valid
        """
        try:
            # Get reset info from Redis
            reset_info = await self._get_password_reset_info(token)
            
            if not reset_info:
                return None
            
            # Check if token is expired
            if datetime.utcnow() > reset_info.expires_at:
                await self._invalidate_password_reset_token(token)
                return None
            
            # Check if already used
            if reset_info.status != PasswordResetStatus.PENDING:
                return None
            
            # Get user information
            result = await db.execute(select(User).where(User.id == reset_info.user_id))
            user = result.scalar_one_or_none()
            
            if not user or not user.is_active:
                return None
            
            return {
                "user_id": str(user.id),
                "email": user.email,
                "username": user.username,
                "expires_at": reset_info.expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Password reset token verification failed: {e}")
            return None
    
    async def complete_password_reset(
        self, 
        db: AsyncSession, 
        token: str, 
        new_password: str,
        ip_address: str
    ) -> bool:
        """
        Complete password reset process
        
        Returns:
            True if successful
        """
        try:
            # Verify token
            reset_info = await self._get_password_reset_info(token)
            
            if not reset_info:
                raise ValueError("Invalid or expired reset token")
            
            if reset_info.status != PasswordResetStatus.PENDING:
                raise ValueError("Reset token already used")
            
            if datetime.utcnow() > reset_info.expires_at:
                await self._invalidate_password_reset_token(token)
                raise ValueError("Reset token expired")
            
            # Get user
            result = await db.execute(select(User).where(User.id == reset_info.user_id))
            user = result.scalar_one_or_none()
            
            if not user or not user.is_active:
                raise ValueError("User not found or inactive")
            
            # Hash new password
            hashed_password = self.pwd_context.hash(new_password)
            
            # Update user password
            await db.execute(
                update(User)
                .where(User.id == user.id)
                .values(hashed_password=hashed_password)
            )
            
            # Mark reset token as completed
            reset_info.status = PasswordResetStatus.COMPLETED
            await self._store_password_reset_info(token, reset_info)
            
            # Revoke all existing sessions
            await self._revoke_user_sessions(str(user.id))
            
            # Log security event
            await self._log_security_event(
                db, user.id, "password_reset_completed",
                {"ip_address": ip_address, "reset_token": token}
            )
            
            await db.commit()
            
            logger.info(f"Password reset completed for user {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Password reset completion failed: {e}")
            await db.rollback()
            raise
    
    # ==================== TWO-FACTOR AUTHENTICATION ====================
    
    async def enable_mfa(
        self, 
        db: AsyncSession, 
        user_id: str, 
        method: MFAMethod,
        phone_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enable MFA for user
        
        Returns:
            MFA setup information (QR code, backup codes, etc.)
        """
        try:
            if method == MFAMethod.TOTP:
                return await self._enable_totp_mfa(db, user_id)
            elif method == MFAMethod.SMS:
                if not phone_number:
                    raise ValueError("Phone number required for SMS MFA")
                return await self._enable_sms_mfa(db, user_id, phone_number)
            elif method == MFAMethod.EMAIL:
                return await self._enable_email_mfa(db, user_id)
            else:
                raise ValueError(f"Unsupported MFA method: {method}")
                
        except Exception as e:
            logger.error(f"MFA enable failed: {e}")
            raise
    
    async def _enable_totp_mfa(self, db: AsyncSession, user_id: str) -> Dict[str, Any]:
        """Enable TOTP-based MFA"""
        # Generate TOTP secret
        secret = pyotp.random_base32()
        
        # Get user for QR code generation
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("User not found")
        
        # Generate QR code
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name="Schlep-engine"
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Generate backup codes
        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        
        # Store MFA info (encrypted)
        mfa_info = MFAInfo(
            user_id=user_id,
            method=MFAMethod.TOTP,
            secret=self._encrypt_data(secret),
            backup_codes=[self._encrypt_data(code) for code in backup_codes],
            is_enabled=True,
            created_at=datetime.utcnow()
        )
        
        await self._store_mfa_info(user_id, mfa_info)
        
        # Log security event
        await self._log_security_event(
            db, user_id, "mfa_enabled",
            {"method": MFAMethod.TOTP.value}
        )
        
        return {
            "method": MFAMethod.TOTP.value,
            "qr_code": f"data:image/png;base64,{qr_code_base64}",
            "secret": secret,  # Show only once
            "backup_codes": backup_codes,  # Show only once
            "setup_complete": False
        }
    
    async def _enable_sms_mfa(self, db: AsyncSession, user_id: str, phone_number: str) -> Dict[str, Any]:
        """Enable SMS-based MFA"""
        # Generate verification code
        verification_code = str(secrets.randbelow(1000000)).zfill(6)
        
        # Store verification code temporarily
        await self._store_mfa_verification_code(user_id, verification_code)
        
        # In production, send SMS here
        logger.info(f"SMS verification code for user {user_id}: {verification_code}")
        
        return {
            "method": MFAMethod.SMS.value,
            "phone_number": phone_number,
            "verification_required": True,
            "setup_complete": False
        }
    
    async def _enable_email_mfa(self, db: AsyncSession, user_id: str) -> Dict[str, Any]:
        """Enable email-based MFA"""
        # Generate verification code
        verification_code = str(secrets.randbelow(1000000)).zfill(6)
        
        # Store verification code temporarily
        await self._store_mfa_verification_code(user_id, verification_code)
        
        # Get user email
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("User not found")
        
        # In production, send email here
        logger.info(f"Email verification code for user {user.email}: {verification_code}")
        
        return {
            "method": MFAMethod.EMAIL.value,
            "email": user.email,
            "verification_required": True,
            "setup_complete": False
        }
    
    async def verify_mfa_setup(
        self, 
        db: AsyncSession, 
        user_id: str, 
        method: MFAMethod,
        code: str
    ) -> bool:
        """
        Verify MFA setup with provided code
        
        Returns:
            True if verification successful
        """
        try:
            if method == MFAMethod.TOTP:
                return await self._verify_totp_setup(db, user_id, code)
            elif method == MFAMethod.SMS:
                return await self._verify_sms_setup(db, user_id, code)
            elif method == MFAMethod.EMAIL:
                return await self._verify_email_setup(db, user_id, code)
            else:
                return False
                
        except Exception as e:
            logger.error(f"MFA setup verification failed: {e}")
            return False
    
    async def _verify_totp_setup(self, db: AsyncSession, user_id: str, code: str) -> bool:
        """Verify TOTP setup"""
        mfa_info = await self._get_mfa_info(user_id)
        
        if not mfa_info or mfa_info.method != MFAMethod.TOTP:
            return False
        
        secret = self._decrypt_data(mfa_info.secret)
        totp = pyotp.TOTP(secret)
        
        if totp.verify(code):
            # Mark setup as complete
            mfa_info.is_enabled = True
            await self._store_mfa_info(user_id, mfa_info)
            
            # Log security event
            await self._log_security_event(
                db, user_id, "mfa_setup_verified",
                {"method": MFAMethod.TOTP.value}
            )
            
            return True
        
        return False
    
    async def verify_mfa_login(
        self, 
        db: AsyncSession, 
        user_id: str, 
        method: MFAMethod,
        code: str,
        remember_device: bool = False
    ) -> bool:
        """
        Verify MFA during login
        
        Returns:
            True if verification successful
        """
        try:
            mfa_info = await self._get_mfa_info(user_id)
            
            if not mfa_info or not mfa_info.is_enabled:
                return False
            
            if method == MFAMethod.TOTP:
                return await self._verify_totp_login(db, user_id, code)
            elif method == MFAMethod.BACKUP_CODES:
                return await self._verify_backup_code(db, user_id, code)
            else:
                return False
                
        except Exception as e:
            logger.error(f"MFA login verification failed: {e}")
            return False
    
    async def _verify_totp_login(self, db: AsyncSession, user_id: str, code: str) -> bool:
        """Verify TOTP during login"""
        mfa_info = await self._get_mfa_info(user_id)
        
        if not mfa_info or mfa_info.method != MFAMethod.TOTP:
            return False
        
        secret = self._decrypt_data(mfa_info.secret)
        totp = pyotp.TOTP(secret)
        
        if totp.verify(code):
            # Update last used
            mfa_info.last_used = datetime.utcnow()
            await self._store_mfa_info(user_id, mfa_info)
            
            # Log security event
            await self._log_security_event(
                db, user_id, "mfa_login_verified",
                {"method": MFAMethod.TOTP.value}
            )
            
            return True
        
        return False
    
    async def _verify_backup_code(self, db: AsyncSession, user_id: str, code: str) -> bool:
        """Verify backup code"""
        mfa_info = await self._get_mfa_info(user_id)
        
        if not mfa_info:
            return False
        
        # Check if code matches any backup code
        for encrypted_code in mfa_info.backup_codes:
            if self._decrypt_data(encrypted_code) == code:
                # Remove used backup code
                mfa_info.backup_codes.remove(encrypted_code)
                await self._store_mfa_info(user_id, mfa_info)
                
                # Log security event
                await self._log_security_event(
                    db, user_id, "backup_code_used",
                    {"remaining_codes": len(mfa_info.backup_codes)}
                )
                
                return True
        
        return False
    
    async def disable_mfa(self, db: AsyncSession, user_id: str) -> bool:
        """Disable MFA for user"""
        try:
            await self._remove_mfa_info(user_id)
            
            # Log security event
            await self._log_security_event(
                db, user_id, "mfa_disabled",
                {}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"MFA disable failed: {e}")
            return False
    
    # ==================== SESSION MANAGEMENT ====================
    
    async def create_session(
        self,
        user_id: str,
        ip_address: str,
        user_agent: str,
        security_level: SecurityLevel = SecurityLevel.MEDIUM,
        mfa_verified: bool = False
    ) -> str:
        """
        Create a new secure session
        
        Returns:
            Session ID
        """
        session_id = self._generate_secure_token(32)
        device_fingerprint = self._generate_device_fingerprint(ip_address, user_agent)
        
        # Check for maximum concurrent sessions
        user_sessions = await self.get_user_sessions(user_id)
        if len(user_sessions) >= self.max_concurrent_sessions:
            # Revoke oldest session
            oldest_session = min(user_sessions, key=lambda s: s.created_at)
            await self.revoke_session(oldest_session.session_id)
        
        session = SessionInfo(
            session_id=session_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.utcnow(),
            last_accessed=datetime.utcnow(),
            expires_at=datetime.utcnow() + self.session_timeout,
            status=SessionStatus.ACTIVE,
            security_level=security_level,
            mfa_verified=mfa_verified,
            device_fingerprint=device_fingerprint,
            risk_score=self._calculate_session_risk(ip_address, user_agent, device_fingerprint),
            metadata={}
        )
        
        await self._store_session(session_id, session)
        
        logger.info(f"Created session {session_id} for user {user_id}")
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[SessionInfo]:
        """Get session information"""
        if not self.redis_client:
            return None
        
        try:
            session_data = await self.redis_client.get(f"session:{session_id}")
            if session_data:
                session_dict = json.loads(session_data)
                return SessionInfo(**session_dict)
        except Exception as e:
            logger.error(f"Error getting session {session_id}: {e}")
        
        return None
    
    async def get_user_sessions(self, user_id: str) -> List[SessionInfo]:
        """Get all active sessions for a user"""
        if not self.redis_client:
            return []
        
        try:
            # Get all session keys for user
            pattern = f"session:*"
            session_keys = await self.redis_client.keys(pattern)
            
            sessions = []
            for key in session_keys:
                session_data = await self.redis_client.get(key)
                if session_data:
                    session_dict = json.loads(session_data)
                    session = SessionInfo(**session_dict)
                    if session.user_id == user_id and session.status == SessionStatus.ACTIVE:
                        sessions.append(session)
            
            return sessions
        except Exception as e:
            logger.error(f"Error getting user sessions: {e}")
            return []
    
    async def update_session_access(self, session_id: str) -> bool:
        """Update session last accessed time"""
        session = await self.get_session(session_id)
        if not session:
            return False
        
        session.last_accessed = datetime.utcnow()
        await self._store_session(session_id, session)
        return True
    
    async def revoke_session(self, session_id: str) -> bool:
        """Revoke a specific session"""
        if not self.redis_client:
            return False
        
        try:
            await self.redis_client.delete(f"session:{session_id}")
            logger.info(f"Revoked session {session_id}")
            return True
        except Exception as e:
            logger.error(f"Error revoking session {session_id}: {e}")
            return False
    
    async def revoke_user_sessions(self, user_id: str, exclude_session_id: Optional[str] = None) -> int:
        """Revoke all sessions for a user except the specified one"""
        sessions = await self.get_user_sessions(user_id)
        revoked_count = 0
        
        for session in sessions:
            if exclude_session_id and session.session_id == exclude_session_id:
                continue
            
            if await self.revoke_session(session.session_id):
                revoked_count += 1
        
        logger.info(f"Revoked {revoked_count} sessions for user {user_id}")
        return revoked_count
    
    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        if not self.redis_client:
            return 0
        
        try:
            pattern = f"session:*"
            session_keys = await self.redis_client.keys(pattern)
            
            expired_count = 0
            for key in session_keys:
                session_data = await self.redis_client.get(key)
                if session_data:
                    session_dict = json.loads(session_data)
                    session = SessionInfo(**session_dict)
                    
                    if datetime.utcnow() > session.expires_at:
                        await self.redis_client.delete(key)
                        expired_count += 1
            
            logger.info(f"Cleaned up {expired_count} expired sessions")
            return expired_count
        except Exception as e:
            logger.error(f"Error cleaning up expired sessions: {e}")
            return 0
    
    # ==================== API KEY MANAGEMENT ====================
    
    async def create_api_key(
        self, 
        db: AsyncSession, 
        user_id: str, 
        name: str,
        permissions: List[str] = None,
        expires_at: Optional[datetime] = None,
        rate_limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create a new API key
        
        Returns:
            API key information (key shown only once)
        """
        try:
            # Check API key limit
            existing_keys = await self.get_user_api_keys(db, user_id)
            if len(existing_keys) >= self.max_api_keys_per_user:
                raise ValueError(f"Maximum {self.max_api_keys_per_user} API keys allowed per user")
            
            # Generate API key
            api_key = f"sk_{secrets.token_hex(32)}"
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            key_preview = f"{api_key[:8]}...{api_key[-4:]}"
            
            # Create API key record
            api_key_record = ApiKey(
                name=name,
                key_hash=key_hash,
                key_preview=key_preview,
                user_id=user_id,
                permissions=permissions or [],
                is_active=True,
                expires_at=expires_at
            )
            
            db.add(api_key_record)
            await db.commit()
            
            # Log security event
            await self._log_security_event(
                db, user_id, "api_key_created",
                {"key_name": name, "permissions": permissions or []}
            )
            
            return {
                "id": str(api_key_record.id),
                "name": name,
                "key": api_key,  # Show only once
                "key_preview": key_preview,
                "permissions": permissions or [],
                "created_at": api_key_record.created_at.isoformat(),
                "expires_at": expires_at.isoformat() if expires_at else None
            }
            
        except Exception as e:
            logger.error(f"API key creation failed: {e}")
            await db.rollback()
            raise
    
    async def get_user_api_keys(self, db: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
        """Get all API keys for a user"""
        try:
            result = await db.execute(
                select(ApiKey).where(ApiKey.user_id == user_id)
            )
            api_keys = result.scalars().all()
            
            return [
                {
                    "id": str(key.id),
                    "name": key.name,
                    "key_preview": key.key_preview,
                    "permissions": key.permissions,
                    "is_active": key.is_active,
                    "created_at": key.created_at.isoformat(),
                    "last_used": key.last_used.isoformat() if key.last_used else None,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None
                }
                for key in api_keys
            ]
        except Exception as e:
            logger.error(f"Error getting user API keys: {e}")
            return []
    
    async def update_api_key(
        self, 
        db: AsyncSession, 
        key_id: str, 
        updates: APIKeyUpdateRequest
    ) -> bool:
        """Update API key"""
        try:
            result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
            api_key = result.scalar_one_or_none()
            
            if not api_key:
                return False
            
            # Update fields
            if updates.name is not None:
                api_key.name = updates.name
            if updates.permissions is not None:
                api_key.permissions = updates.permissions
            if updates.is_active is not None:
                api_key.is_active = updates.is_active
            if updates.expires_at is not None:
                api_key.expires_at = updates.expires_at
            
            await db.commit()
            
            # Log security event
            await self._log_security_event(
                db, api_key.user_id, "api_key_updated",
                {"key_id": str(key_id), "updates": updates.dict()}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"API key update failed: {e}")
            await db.rollback()
            return False
    
    async def revoke_api_key(self, db: AsyncSession, key_id: str) -> bool:
        """Revoke API key"""
        try:
            result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
            api_key = result.scalar_one_or_none()
            
            if not api_key:
                return False
            
            api_key.is_active = False
            await db.commit()
            
            # Log security event
            await self._log_security_event(
                db, api_key.user_id, "api_key_revoked",
                {"key_id": str(key_id)}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"API key revocation failed: {e}")
            await db.rollback()
            return False
    
    async def validate_api_key(self, db: AsyncSession, api_key: str) -> Optional[Dict[str, Any]]:
        """Validate API key and return user info"""
        try:
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            
            result = await db.execute(
                select(ApiKey).where(
                    and_(
                        ApiKey.key_hash == key_hash,
                        ApiKey.is_active == True
                    )
                )
            )
            api_key_record = result.scalar_one_or_none()
            
            if not api_key_record:
                return None
            
            # Check expiration
            if api_key_record.expires_at and datetime.utcnow() > api_key_record.expires_at:
                return None
            
            # Get user
            user_result = await db.execute(
                select(User).where(User.id == api_key_record.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user or not user.is_active:
                return None
            
            # Update last used
            api_key_record.last_used = datetime.utcnow()
            await db.commit()
            
            return {
                "user_id": str(user.id),
                "email": user.email,
                "username": user.username,
                "role": user.role.value if user.role else "user",
                "permissions": api_key_record.permissions,
                "key_id": str(api_key_record.id)
            }
            
        except Exception as e:
            logger.error(f"API key validation failed: {e}")
            return None
    
    # ==================== HELPER METHODS ====================
    
    def _generate_secure_token(self, length: int = 32) -> str:
        """Generate a secure random token"""
        return secrets.token_urlsafe(length)
    
    def _generate_device_fingerprint(self, ip_address: str, user_agent: str) -> str:
        """Generate device fingerprint"""
        fingerprint_data = f"{ip_address}:{user_agent}"
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()
    
    def _calculate_session_risk(self, ip_address: str, user_agent: str, device_fingerprint: str) -> float:
        """Calculate session risk score"""
        risk_score = 0.0
        
        # Check for suspicious patterns
        suspicious_patterns = [
            "bot", "crawler", "spider", "scraper",
            "headless", "phantom", "selenium"
        ]
        
        user_agent_lower = user_agent.lower()
        for pattern in suspicious_patterns:
            if pattern in user_agent_lower:
                risk_score += 0.3
        
        # Check for known VPN/Tor exit nodes (simplified)
        # In production, use a proper IP reputation service
        if ip_address.startswith("10.") or ip_address.startswith("192.168."):
            risk_score += 0.1
        
        return min(risk_score, 1.0)
    
    def _encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self._cipher.encrypt(data.encode()).decode()
    
    def _decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self._cipher.decrypt(encrypted_data.encode()).decode()
    
    async def _store_password_reset_info(self, token: str, reset_info: PasswordResetInfo):
        """Store password reset information in Redis"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.setex(
                f"password_reset:{token}",
                int(self.password_reset_timeout.total_seconds()),
                json.dumps(asdict(reset_info))
            )
        except Exception as e:
            logger.error(f"Error storing password reset info: {e}")
    
    async def _get_password_reset_info(self, token: str) -> Optional[PasswordResetInfo]:
        """Get password reset information from Redis"""
        if not self.redis_client:
            return None
        
        try:
            data = await self.redis_client.get(f"password_reset:{token}")
            if data:
                reset_dict = json.loads(data)
                return PasswordResetInfo(**reset_dict)
        except Exception as e:
            logger.error(f"Error getting password reset info: {e}")
        
        return None
    
    async def _invalidate_password_reset_token(self, token: str):
        """Invalidate password reset token"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.delete(f"password_reset:{token}")
        except Exception as e:
            logger.error(f"Error invalidating password reset token: {e}")
    
    async def _store_mfa_info(self, user_id: str, mfa_info: MFAInfo):
        """Store MFA information in Redis"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.setex(
                f"mfa:{user_id}",
                86400,  # 24 hours
                json.dumps(asdict(mfa_info))
            )
        except Exception as e:
            logger.error(f"Error storing MFA info: {e}")
    
    async def _get_mfa_info(self, user_id: str) -> Optional[MFAInfo]:
        """Get MFA information from Redis"""
        if not self.redis_client:
            return None
        
        try:
            data = await self.redis_client.get(f"mfa:{user_id}")
            if data:
                mfa_dict = json.loads(data)
                return MFAInfo(**mfa_dict)
        except Exception as e:
            logger.error(f"Error getting MFA info: {e}")
        
        return None
    
    async def _remove_mfa_info(self, user_id: str):
        """Remove MFA information from Redis"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.delete(f"mfa:{user_id}")
        except Exception as e:
            logger.error(f"Error removing MFA info: {e}")
    
    async def _store_mfa_verification_code(self, user_id: str, code: str):
        """Store MFA verification code temporarily"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.setex(
                f"mfa_verification:{user_id}",
                int(self.mfa_challenge_timeout.total_seconds()),
                code
            )
        except Exception as e:
            logger.error(f"Error storing MFA verification code: {e}")
    
    async def _store_session(self, session_id: str, session: SessionInfo):
        """Store session in Redis"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.setex(
                f"session:{session_id}",
                int(self.session_timeout.total_seconds()),
                json.dumps(asdict(session))
            )
        except Exception as e:
            logger.error(f"Error storing session: {e}")
    
    async def _log_security_event(
        self, 
        db: AsyncSession, 
        user_id: str, 
        action: str, 
        details: Dict[str, Any]
    ):
        """Log security event to audit log"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=action,
                resource_type="security",
                details=details
            )
            db.add(audit_log)
            await db.commit()
        except Exception as e:
            logger.error(f"Error logging security event: {e}")

# Global instance
enhanced_security = EnhancedSecuritySystem() 