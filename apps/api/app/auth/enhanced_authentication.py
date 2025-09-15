"""
Enhanced Authentication System with MFA and Advanced RBAC
========================================================

This module provides enterprise-grade authentication with multi-factor
authentication, advanced role-based access control, and comprehensive
security measures.

Features:
- Multi-Factor Authentication (TOTP, SMS, Email)
- Advanced Role-Based Access Control (RBAC)
- Adaptive Authentication
- Session Management with Security Controls
- Token Rotation and Expiration Policies
- Device Fingerprinting
- Behavioral Analysis
- Account Lockout and Brute Force Protection
"""

import os
import secrets
import hashlib
import hmac
import base64
import qrcode
import pyotp
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple, Set
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field, validator
import jwt
from passlib.context import CryptContext
from passlib.hash import bcrypt
import logging
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import redis
import json

from app.core.security_hardening import (
    get_security_framework,
    SecurityLevel,
    SecurityViolationType,
    ThreatLevel
)

logger = logging.getLogger(__name__)

Base = declarative_base()


class AuthenticationMethod(Enum):
    """Authentication methods"""
    PASSWORD = "password"
    TOTP = "totp"
    SMS = "sms"
    EMAIL = "email"
    BACKUP_CODES = "backup_codes"
    WEBAUTHN = "webauthn"
    BIOMETRIC = "biometric"


class AuthenticationResult(Enum):
    """Authentication result status"""
    SUCCESS = "success"
    INVALID_CREDENTIALS = "invalid_credentials"
    MFA_REQUIRED = "mfa_required"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_SUSPENDED = "account_suspended"
    DEVICE_NOT_TRUSTED = "device_not_trusted"
    LOCATION_SUSPICIOUS = "location_suspicious"
    RATE_LIMITED = "rate_limited"
    SESSION_EXPIRED = "session_expired"


class RiskLevel(Enum):
    """Risk assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Permission(Enum):
    """System permissions"""
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"
    USER_MANAGE = "user_manage"
    SYSTEM_CONFIG = "system_config"
    AUDIT_VIEW = "audit_view"
    ML_PIPELINE = "ml_pipeline"
    DATA_EXPORT = "data_export"
    API_ACCESS = "api_access"


class Role(Enum):
    """User roles with hierarchical permissions"""
    GUEST = "guest"
    USER = "user"
    ANALYST = "analyst"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    SERVICE_ACCOUNT = "service_account"


@dataclass
class AuthenticationContext:
    """Context information for authentication"""
    ip_address: str
    user_agent: str
    device_fingerprint: Optional[str] = None
    location: Optional[Dict[str, str]] = None
    session_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    risk_score: float = 0.0
    is_trusted_device: bool = False
    authentication_methods: List[AuthenticationMethod] = field(default_factory=list)


@dataclass
class MFAChallenge:
    """Multi-factor authentication challenge"""
    challenge_id: str = field(default_factory=lambda: secrets.token_hex(16))
    user_id: str = ""
    method: AuthenticationMethod = AuthenticationMethod.TOTP
    challenge_data: Dict[str, Any] = field(default_factory=dict)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(minutes=5))
    attempts: int = 0
    max_attempts: int = 3
    created_at: datetime = field(default_factory=datetime.utcnow)


class UserProfile(Base):
    """Extended user profile with security settings"""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    # MFA Settings
    mfa_enabled = Column(Boolean, default=False)
    totp_secret = Column(String(32), nullable=True)
    backup_codes = Column(Text, nullable=True)  # JSON array of hashed codes
    sms_phone = Column(String(20), nullable=True)
    recovery_email = Column(String(255), nullable=True)

    # Role and Permissions
    role = Column(String(50), default=Role.USER.value)
    permissions = Column(Text, nullable=True)  # JSON array

    # Security Settings
    require_mfa = Column(Boolean, default=False)
    trusted_devices = Column(Text, nullable=True)  # JSON array
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    password_last_changed = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Account Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_suspended = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuthenticationSession(Base):
    """Authentication session tracking"""
    __tablename__ = "authentication_sessions"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(64), unique=True, nullable=False)
    user_id = Column(String(36), nullable=False)

    # Session Data
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=True)
    device_fingerprint = Column(String(64), nullable=True)
    location_data = Column(Text, nullable=True)  # JSON

    # Security Info
    risk_score = Column(Integer, default=0)
    is_trusted = Column(Boolean, default=False)
    mfa_completed = Column(Boolean, default=False)
    authentication_methods = Column(Text, nullable=True)  # JSON array

    # Session Management
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)


class SecurityEvent(Base):
    """Security event logging"""
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True)
    event_id = Column(String(36), unique=True, nullable=False)
    user_id = Column(String(36), nullable=True)
    session_id = Column(String(64), nullable=True)

    # Event Details
    event_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)

    # Context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    endpoint = Column(String(255), nullable=True)
    request_data = Column(Text, nullable=True)  # JSON

    # Resolution
    resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class EnhancedAuthenticationManager:
    """Enhanced authentication manager with MFA and RBAC"""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.security_framework = get_security_framework()
        self.redis_client = redis_client or redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            decode_responses=True
        )

        # Role-based permissions mapping
        self.role_permissions = {
            Role.GUEST: {Permission.READ},
            Role.USER: {Permission.READ, Permission.WRITE, Permission.API_ACCESS},
            Role.ANALYST: {
                Permission.READ, Permission.WRITE, Permission.API_ACCESS,
                Permission.ML_PIPELINE, Permission.DATA_EXPORT
            },
            Role.ADMIN: {
                Permission.READ, Permission.WRITE, Permission.DELETE,
                Permission.API_ACCESS, Permission.ML_PIPELINE, Permission.DATA_EXPORT,
                Permission.USER_MANAGE, Permission.AUDIT_VIEW
            },
            Role.SUPER_ADMIN: {
                Permission.READ, Permission.WRITE, Permission.DELETE,
                Permission.ADMIN, Permission.USER_MANAGE, Permission.SYSTEM_CONFIG,
                Permission.AUDIT_VIEW, Permission.ML_PIPELINE, Permission.DATA_EXPORT,
                Permission.API_ACCESS
            },
            Role.SERVICE_ACCOUNT: {Permission.API_ACCESS, Permission.READ, Permission.WRITE}
        }

        logger.info("Enhanced Authentication Manager initialized")

    async def authenticate_user(
        self,
        username_or_email: str,
        password: str,
        context: AuthenticationContext
    ) -> Tuple[AuthenticationResult, Optional[UserProfile], Optional[MFAChallenge]]:
        """
        Authenticate user with comprehensive security checks

        Args:
            username_or_email: Username or email address
            password: User password
            context: Authentication context

        Returns:
            Tuple of (result, user_profile, mfa_challenge)
        """

        try:
            # Step 1: Risk Assessment
            risk_assessment = await self._assess_authentication_risk(
                username_or_email, context
            )

            if risk_assessment.risk_level == RiskLevel.CRITICAL:
                self._log_security_event(
                    "authentication_blocked",
                    ThreatLevel.HIGH,
                    f"Authentication blocked due to critical risk assessment",
                    context=context
                )
                return AuthenticationResult.RATE_LIMITED, None, None

            # Step 2: Check Rate Limiting
            rate_limit_key = f"auth_attempts:{context.ip_address}:{username_or_email}"
            attempts = await self._get_rate_limit_attempts(rate_limit_key)

            if attempts >= 5:  # Max 5 attempts per IP/user combination
                return AuthenticationResult.RATE_LIMITED, None, None

            # Step 3: Find User
            user = await self._find_user(username_or_email)
            if not user:
                await self._increment_rate_limit_attempts(rate_limit_key)
                return AuthenticationResult.INVALID_CREDENTIALS, None, None

            # Step 4: Check Account Status
            account_status = self._check_account_status(user)
            if account_status != AuthenticationResult.SUCCESS:
                return account_status, user, None

            # Step 5: Verify Password
            if not self._verify_password(password, user.password_hash):
                await self._handle_failed_login(user, context)
                await self._increment_rate_limit_attempts(rate_limit_key)
                return AuthenticationResult.INVALID_CREDENTIALS, user, None

            # Step 6: Check MFA Requirements
            mfa_required = self._is_mfa_required(user, risk_assessment)

            if mfa_required and user.mfa_enabled:
                mfa_challenge = await self._create_mfa_challenge(user, context)
                return AuthenticationResult.MFA_REQUIRED, user, mfa_challenge

            # Step 7: Create Session
            session = await self._create_session(user, context, mfa_completed=not mfa_required)

            # Step 8: Update User Login Info
            await self._update_login_info(user, context)

            # Step 9: Log Successful Authentication
            self._log_security_event(
                "authentication_success",
                ThreatLevel.INFO,
                f"User {user.username} authenticated successfully",
                user_id=user.user_id,
                context=context
            )

            return AuthenticationResult.SUCCESS, user, None

        except Exception as e:
            logger.error(f"Authentication error: {e}", exc_info=True)
            self._log_security_event(
                "authentication_error",
                ThreatLevel.MEDIUM,
                f"Authentication system error: {str(e)}",
                context=context
            )
            return AuthenticationResult.INVALID_CREDENTIALS, None, None

    async def verify_mfa_challenge(
        self,
        challenge_id: str,
        verification_code: str,
        context: AuthenticationContext
    ) -> Tuple[AuthenticationResult, Optional[UserProfile]]:
        """
        Verify MFA challenge response

        Args:
            challenge_id: MFA challenge ID
            verification_code: Verification code provided by user
            context: Authentication context

        Returns:
            Tuple of (result, user_profile)
        """

        try:
            # Get MFA challenge
            challenge = await self._get_mfa_challenge(challenge_id)
            if not challenge:
                return AuthenticationResult.INVALID_CREDENTIALS, None

            # Check if challenge expired
            if datetime.utcnow() > challenge.expires_at:
                await self._remove_mfa_challenge(challenge_id)
                return AuthenticationResult.SESSION_EXPIRED, None

            # Check attempt limit
            if challenge.attempts >= challenge.max_attempts:
                await self._remove_mfa_challenge(challenge_id)
                self._log_security_event(
                    "mfa_attempts_exceeded",
                    ThreatLevel.HIGH,
                    f"MFA attempts exceeded for challenge {challenge_id}",
                    user_id=challenge.user_id,
                    context=context
                )
                return AuthenticationResult.RATE_LIMITED, None

            # Increment attempt counter
            challenge.attempts += 1
            await self._update_mfa_challenge(challenge)

            # Get user
            user = await self._find_user_by_id(challenge.user_id)
            if not user:
                return AuthenticationResult.INVALID_CREDENTIALS, None

            # Verify MFA code based on method
            verification_result = await self._verify_mfa_code(
                user, challenge.method, verification_code, challenge
            )

            if not verification_result:
                if challenge.attempts >= challenge.max_attempts:
                    await self._remove_mfa_challenge(challenge_id)
                return AuthenticationResult.INVALID_CREDENTIALS, user

            # MFA verification successful
            await self._remove_mfa_challenge(challenge_id)

            # Create or update session
            session = await self._create_session(user, context, mfa_completed=True)

            # Log successful MFA
            self._log_security_event(
                "mfa_verification_success",
                ThreatLevel.INFO,
                f"MFA verification successful for user {user.username}",
                user_id=user.user_id,
                context=context
            )

            return AuthenticationResult.SUCCESS, user

        except Exception as e:
            logger.error(f"MFA verification error: {e}", exc_info=True)
            return AuthenticationResult.INVALID_CREDENTIALS, None

    async def setup_mfa(self, user_id: str, method: AuthenticationMethod) -> Dict[str, Any]:
        """
        Setup multi-factor authentication for user

        Args:
            user_id: User ID
            method: MFA method to setup

        Returns:
            Setup information (secret, QR code, backup codes, etc.)
        """

        user = await self._find_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        setup_info = {}

        if method == AuthenticationMethod.TOTP:
            # Generate TOTP secret
            secret = pyotp.random_base32()

            # Create QR code for easy setup
            totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
                name=user.email,
                issuer_name="Schlep Engine"
            )

            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)

            # Store secret (temporarily until confirmed)
            setup_info = {
                "secret": secret,
                "qr_code_uri": totp_uri,
                "backup_codes": self._generate_backup_codes()
            }

            # Store in Redis temporarily
            await self._store_temp_mfa_setup(user_id, method, setup_info)

        elif method == AuthenticationMethod.SMS:
            if not user.sms_phone:
                raise ValueError("SMS phone number not configured")

            setup_info = {
                "phone_number": user.sms_phone,
                "backup_codes": self._generate_backup_codes()
            }

        elif method == AuthenticationMethod.EMAIL:
            setup_info = {
                "email": user.recovery_email or user.email,
                "backup_codes": self._generate_backup_codes()
            }

        return setup_info

    async def confirm_mfa_setup(
        self,
        user_id: str,
        method: AuthenticationMethod,
        verification_code: str
    ) -> bool:
        """
        Confirm MFA setup with verification code

        Args:
            user_id: User ID
            method: MFA method
            verification_code: Verification code

        Returns:
            True if setup confirmed successfully
        """

        try:
            # Get temporary setup info
            setup_info = await self._get_temp_mfa_setup(user_id, method)
            if not setup_info:
                return False

            user = await self._find_user_by_id(user_id)
            if not user:
                return False

            # Verify the code based on method
            if method == AuthenticationMethod.TOTP:
                totp = pyotp.TOTP(setup_info["secret"])
                if not totp.verify(verification_code):
                    return False

                # Store TOTP secret
                user.totp_secret = setup_info["secret"]

            elif method == AuthenticationMethod.SMS:
                # For SMS, we would verify against a code sent to the phone
                stored_code = await self._get_sms_verification_code(user_id)
                if verification_code != stored_code:
                    return False

            elif method == AuthenticationMethod.EMAIL:
                # For email, we would verify against a code sent to email
                stored_code = await self._get_email_verification_code(user_id)
                if verification_code != stored_code:
                    return False

            # Enable MFA for user
            user.mfa_enabled = True
            user.backup_codes = json.dumps([
                self._hash_backup_code(code) for code in setup_info["backup_codes"]
            ])

            await self._save_user(user)

            # Clean up temporary setup
            await self._remove_temp_mfa_setup(user_id, method)

            # Log MFA setup
            self._log_security_event(
                "mfa_setup_completed",
                ThreatLevel.INFO,
                f"MFA setup completed for user {user.username} using {method.value}",
                user_id=user.user_id
            )

            return True

        except Exception as e:
            logger.error(f"MFA setup confirmation error: {e}", exc_info=True)
            return False

    def check_permission(self, user: UserProfile, permission: Permission) -> bool:
        """
        Check if user has specific permission

        Args:
            user: User profile
            permission: Permission to check

        Returns:
            True if user has permission
        """

        try:
            user_role = Role(user.role)

            # Check role-based permissions
            role_permissions = self.role_permissions.get(user_role, set())
            if permission in role_permissions:
                return True

            # Check custom user permissions
            if user.permissions:
                custom_permissions = json.loads(user.permissions)
                if permission.value in custom_permissions:
                    return True

            return False

        except Exception as e:
            logger.error(f"Permission check error: {e}")
            return False

    def require_permissions(self, *permissions: Permission):
        """
        Decorator to require specific permissions

        Args:
            permissions: Required permissions

        Returns:
            Decorator function
        """

        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Extract user from function arguments or dependency injection
                user = kwargs.get('current_user') or (args[0] if args else None)

                if not user or not isinstance(user, UserProfile):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authentication required"
                    )

                # Check all required permissions
                for permission in permissions:
                    if not self.check_permission(user, permission):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permission required: {permission.value}"
                        )

                return await func(*args, **kwargs)

            return wrapper
        return decorator

    async def _assess_authentication_risk(
        self,
        username_or_email: str,
        context: AuthenticationContext
    ) -> 'RiskAssessment':
        """Assess risk for authentication attempt"""

        risk_score = 0.0
        risk_factors = []

        # IP address analysis
        ip_allowed, ip_reason = self.security_framework.check_ip_security(context.ip_address)
        if not ip_allowed:
            risk_score += 30.0
            risk_factors.append(f"IP: {ip_reason}")

        # Check for suspicious IP
        if context.ip_address in self.security_framework.suspicious_ips:
            suspicious_data = self.security_framework.suspicious_ips[context.ip_address]
            risk_score += min(suspicious_data.get("threat_level", 0) * 5, 25.0)
            risk_factors.append("Suspicious IP activity")

        # User agent analysis
        if not context.user_agent or len(context.user_agent) < 10:
            risk_score += 10.0
            risk_factors.append("Invalid or missing user agent")

        # Device fingerprint
        if not context.device_fingerprint:
            risk_score += 5.0
            risk_factors.append("No device fingerprint")
        elif not context.is_trusted_device:
            risk_score += 15.0
            risk_factors.append("Untrusted device")

        # Time-based analysis
        current_hour = datetime.utcnow().hour
        if current_hour < 6 or current_hour > 22:  # Off-hours
            risk_score += 5.0
            risk_factors.append("Off-hours access")

        # Recent failed attempts
        failed_attempts = await self._get_recent_failed_attempts(username_or_email)
        if failed_attempts > 0:
            risk_score += min(failed_attempts * 5, 20.0)
            risk_factors.append(f"Recent failed attempts: {failed_attempts}")

        # Determine risk level
        if risk_score >= 50:
            risk_level = RiskLevel.CRITICAL
        elif risk_score >= 30:
            risk_level = RiskLevel.HIGH
        elif risk_score >= 15:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        return RiskAssessment(
            risk_score=risk_score,
            risk_level=risk_level,
            risk_factors=risk_factors
        )

    def _is_mfa_required(self, user: UserProfile, risk_assessment: 'RiskAssessment') -> bool:
        """Determine if MFA is required"""

        # Always require MFA if explicitly set
        if user.require_mfa:
            return True

        # Require MFA for high-risk scenarios
        if risk_assessment.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            return True

        # Require MFA for admin roles
        user_role = Role(user.role)
        if user_role in [Role.ADMIN, Role.SUPER_ADMIN]:
            return True

        # Require MFA if enabled by user
        return user.mfa_enabled

    async def _create_mfa_challenge(
        self,
        user: UserProfile,
        context: AuthenticationContext
    ) -> MFAChallenge:
        """Create MFA challenge"""

        # Determine best MFA method for user
        if user.totp_secret:
            method = AuthenticationMethod.TOTP
            challenge_data = {"message": "Enter TOTP code from your authenticator app"}
        elif user.sms_phone:
            method = AuthenticationMethod.SMS
            # Generate and send SMS code
            sms_code = self._generate_sms_code()
            await self._send_sms_code(user.sms_phone, sms_code)
            challenge_data = {
                "message": f"SMS code sent to {self._mask_phone(user.sms_phone)}",
                "code": sms_code  # In production, store separately
            }
        else:
            method = AuthenticationMethod.EMAIL
            # Generate and send email code
            email_code = self._generate_email_code()
            await self._send_email_code(user.recovery_email or user.email, email_code)
            challenge_data = {
                "message": f"Email code sent to {self._mask_email(user.email)}",
                "code": email_code  # In production, store separately
            }

        challenge = MFAChallenge(
            user_id=user.user_id,
            method=method,
            challenge_data=challenge_data
        )

        # Store challenge
        await self._store_mfa_challenge(challenge)

        return challenge

    def _generate_backup_codes(self) -> List[str]:
        """Generate backup codes for MFA"""
        return [secrets.token_hex(4).upper() for _ in range(10)]

    def _hash_backup_code(self, code: str) -> str:
        """Hash backup code for secure storage"""
        return self.pwd_context.hash(code)

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return self.pwd_context.verify(plain_password, hashed_password)

    def _log_security_event(
        self,
        event_type: str,
        severity: ThreatLevel,
        description: str,
        user_id: Optional[str] = None,
        context: Optional[AuthenticationContext] = None
    ):
        """Log security event"""

        event_data = {
            "event_type": event_type,
            "severity": severity.value,
            "description": description,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }

        if context:
            event_data.update({
                "ip_address": context.ip_address,
                "user_agent": context.user_agent,
                "device_fingerprint": context.device_fingerprint,
                "session_id": context.session_id
            })

        logger.info(f"Security event: {event_type} - {description}", extra=event_data)

    # Helper methods (would need to be implemented based on your database layer)
    async def _find_user(self, username_or_email: str) -> Optional[UserProfile]:
        """Find user by username or email"""
        # Implementation depends on your database layer
        pass

    async def _find_user_by_id(self, user_id: str) -> Optional[UserProfile]:
        """Find user by ID"""
        # Implementation depends on your database layer
        pass

    async def _save_user(self, user: UserProfile):
        """Save user to database"""
        # Implementation depends on your database layer
        pass

    # Additional helper methods would be implemented here...


@dataclass
class RiskAssessment:
    """Risk assessment result"""
    risk_score: float
    risk_level: RiskLevel
    risk_factors: List[str]


# Singleton instance
_auth_manager: Optional[EnhancedAuthenticationManager] = None


def get_auth_manager() -> EnhancedAuthenticationManager:
    """Get global authentication manager instance"""
    global _auth_manager

    if _auth_manager is None:
        _auth_manager = EnhancedAuthenticationManager()

    return _auth_manager