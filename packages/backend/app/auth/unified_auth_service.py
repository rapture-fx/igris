"""
Unified Authentication Service

This module consolidates all authentication functionality into a single, consistent service
that eliminates redundancy and provides a clean interface for all auth operations.

Features:
- Single source of truth for authentication logic
- Backward compatibility with existing implementations
- Enhanced security features with feature flags
- Consistent error handling and logging
- Session management and MFA support
"""

import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.database.models import User, ApiKey
from app.auth.enhanced_security import (
    enhanced_security, SecurityLevel, AuthenticationMethod, 
    SessionInfo, SessionStatus
)

logger = logging.getLogger(__name__)

class AuthResult:
    """Standardized authentication result"""
    def __init__(
        self, 
        success: bool,
        user: Optional[User] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        session_id: Optional[str] = None,
        mfa_required: bool = False,
        mfa_challenge_token: Optional[str] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.success = success
        self.user = user
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.session_id = session_id
        self.mfa_required = mfa_required
        self.mfa_challenge_token = mfa_challenge_token
        self.error = error
        self.metadata = metadata or {}

class UnifiedAuthService:
    """
    Unified Authentication Service
    
    Consolidates all authentication functionality into a single service,
    eliminating redundancy and providing consistent behavior.
    """
    
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.enhanced_features_enabled = getattr(settings, 'ENHANCED_AUTH_ENABLED', True)
        
    # ==================== TOKEN OPERATIONS ====================
    
    def create_access_token(
        self,
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None,
        enhanced: bool = None,
        security_level: SecurityLevel = SecurityLevel.MEDIUM
    ) -> Union[str, Tuple[str, str]]:
        """
        Create access token with unified logic.
        
        Args:
            data: Token payload data
            expires_delta: Token expiration time
            enhanced: Enable enhanced features (auto-detect if None)
            security_level: Required security level for enhanced tokens
            
        Returns:
            String token for basic mode, tuple of (token, session_id) for enhanced mode
        """
        # Auto-detect enhanced mode if not specified
        if enhanced is None:
            enhanced = self.enhanced_features_enabled
            
        # Set expiration
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=getattr(settings, 'JWT_ACCESS_TOKEN_EXPIRE_MINUTES', 30))
        
        to_encode = data.copy()
        to_encode.update({"exp": expire})
        
        if enhanced:
            # Use enhanced security with session tracking
            session_id = enhanced_security._generate_session_id()
            to_encode.update({
                "session_id": session_id,
                "security_level": security_level.value,
                "enhanced": True
            })
            
            # Create token
            token = jwt.encode(
                to_encode, 
                settings.JWT_SECRET_KEY, 
                algorithm=settings.JWT_ALGORITHM
            )
            
            return token, session_id
        else:
            # Basic token creation
            token = jwt.encode(
                to_encode,
                settings.JWT_SECRET_KEY,
                algorithm=settings.JWT_ALGORITHM
            )
            return token

    def verify_token(
        self,
        token: str,
        enhanced: bool = None,
        required_security_level: SecurityLevel = SecurityLevel.LOW
    ) -> Optional[Dict[str, Any]]:
        """
        Verify token with unified logic.
        
        Args:
            token: JWT token to verify
            enhanced: Enable enhanced validation (auto-detect if None)
            required_security_level: Minimum required security level
            
        Returns:
            Token payload if valid, None if invalid
        """
        try:
            # Decode token
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Auto-detect enhanced mode if not specified
            if enhanced is None:
                enhanced = payload.get("enhanced", False) and self.enhanced_features_enabled
            
            if enhanced:
                # Enhanced validation
                session_id = payload.get("session_id")
                token_security_level = SecurityLevel(payload.get("security_level", SecurityLevel.LOW.value))
                
                # Check security level
                if token_security_level.value < required_security_level.value:
                    logger.warning(f"Token security level {token_security_level} below required {required_security_level}")
                    return None
                
                # Validate session if present
                if session_id and session_id in enhanced_security._sessions:
                    session = enhanced_security._sessions[session_id]
                    if session.status != SessionStatus.ACTIVE:
                        logger.warning(f"Session {session_id} is not active")
                        return None
                    
                    # Update last accessed
                    session.last_accessed = datetime.utcnow()
            
            return payload
            
        except JWTError as e:
            logger.warning(f"Token verification failed: {e}")
            return None

    # ==================== USER AUTHENTICATION ====================
    
    async def authenticate_user(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        ip_address: str = "unknown",
        user_agent: str = "unknown",
        enhanced: bool = None
    ) -> AuthResult:
        """
        Authenticate user with unified logic.
        
        Args:
            db: Database session
            email: User email or username
            password: User password
            ip_address: Client IP address
            user_agent: Client user agent
            enhanced: Enable enhanced features
            
        Returns:
            AuthResult with authentication outcome
        """
        # Auto-detect enhanced mode
        if enhanced is None:
            enhanced = self.enhanced_features_enabled
            
        # Check account lockout first (if enhanced)
        if enhanced and enhanced_security.is_account_locked(email):
            return AuthResult(
                success=False,
                error="Account is temporarily locked due to suspicious activity"
            )
        
        # Find user
        result = await db.execute(
            select(User).where(
                (User.email == email) | (User.username == email)
            )
        )
        user = result.scalar_one_or_none()
        
        # Verify credentials
        if not user or not self.verify_password(password, user.hashed_password):
            # Record failed attempt if enhanced
            if enhanced:
                enhanced_security.record_authentication_attempt(
                    username=email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    method=AuthenticationMethod.PASSWORD,
                    success=False,
                    failure_reason="Invalid credentials"
                )
            
            return AuthResult(
                success=False,
                error="Invalid email or password"
            )
        
        if not user.is_active:
            return AuthResult(
                success=False,
                error="Account is inactive"
            )
        
        # Check if MFA is required
        mfa_required = enhanced and hasattr(user, 'mfa_secret') and user.mfa_secret
        
        if mfa_required:
            # Create MFA challenge
            challenge_token = enhanced_security.create_mfa_challenge(
                user_id=str(user.id),
                method=AuthenticationMethod.MFA_TOTP
            )
            
            return AuthResult(
                success=True,
                user=user,
                mfa_required=True,
                mfa_challenge_token=challenge_token
            )
        
        # Create tokens
        token_data = {"sub": str(user.id), "email": user.email}
        
        if enhanced:
            access_token, session_id = self.create_access_token(
                token_data, enhanced=True, security_level=SecurityLevel.MEDIUM
            )
            
            # Create session
            enhanced_security.create_session(
                user_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
                security_level=SecurityLevel.MEDIUM,
                mfa_verified=False
            )
            
            # Create refresh token
            refresh_token = enhanced_security.create_refresh_token(str(user.id), session_id)
            
            # Record successful attempt
            enhanced_security.record_authentication_attempt(
                username=user.username,
                ip_address=ip_address,
                user_agent=user_agent,
                method=AuthenticationMethod.PASSWORD,
                success=True
            )
            
            return AuthResult(
                success=True,
                user=user,
                access_token=access_token,
                refresh_token=refresh_token,
                session_id=session_id
            )
        else:
            # Basic authentication
            access_token = self.create_access_token(token_data, enhanced=False)
            
            return AuthResult(
                success=True,
                user=user,
                access_token=access_token
            )

    async def create_user(
        self,
        db: AsyncSession,
        email: str,
        username: str,
        password: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        enhanced: bool = None
    ) -> User:
        """
        Create new user with unified logic.
        
        Args:
            db: Database session
            email: User email
            username: Username
            password: Plain text password
            first_name: User's first name
            last_name: User's last name
            enhanced: Enable enhanced password validation
            
        Returns:
            Created User instance
            
        Raises:
            ValueError: If validation fails
        """
        # Auto-detect enhanced mode
        if enhanced is None:
            enhanced = self.enhanced_features_enabled
            
        # Check if user exists
        existing_user = await db.execute(
            select(User).where(
                (User.email == email) | (User.username == username)
            )
        )
        if existing_user.scalar_one_or_none():
            raise ValueError("User with this email or username already exists")
        
        # Validate password
        if enhanced:
            is_valid, violations = enhanced_security.validate_password_policy(
                password, username=username, email=email,
                first_name=first_name, last_name=last_name
            )
            if not is_valid:
                raise ValueError(f"Password policy violations: {', '.join(violations)}")
        
        # Create user
        hashed_password = self.get_password_hash(password)
        user = User(
            email=email,
            username=username,
            hashed_password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_verified=False
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        return user

    # ==================== CURRENT USER OPERATIONS ====================
    
    async def get_current_user(
        self,
        db: AsyncSession,
        token: str,
        enhanced: bool = None,
        required_security_level: SecurityLevel = SecurityLevel.LOW
    ) -> User:
        """
        Get current user from token with unified logic.
        
        Args:
            db: Database session
            token: JWT access token
            enhanced: Enable enhanced validation
            required_security_level: Minimum security level required
            
        Returns:
            User instance
            
        Raises:
            HTTPException: If authentication fails
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        # Verify token
        payload = self.verify_token(token, enhanced=enhanced, required_security_level=required_security_level)
        if payload is None:
            raise credentials_exception
        
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        
        # Get user from database
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if user is None:
            raise credentials_exception
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        return user

    # ==================== API KEY OPERATIONS ====================
    
    async def verify_api_key(
        self,
        db: AsyncSession,
        api_key: str
    ) -> Optional[User]:
        """
        Verify API key and return associated user.
        
        Args:
            db: Database session
            api_key: API key to verify
            
        Returns:
            User instance if valid, None if invalid
        """
        # Get all active API keys
        result = await db.execute(
            select(ApiKey).where(ApiKey.is_active == True)
        )
        api_keys = result.scalars().all()
        
        # Check against stored hashes
        for stored_key in api_keys:
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            if secrets.compare_digest(key_hash, stored_key.key_hash):
                # Update last used
                stored_key.last_used = datetime.utcnow()
                await db.commit()
                
                # Get user
                user_result = await db.execute(select(User).where(User.id == stored_key.user_id))
                user = user_result.scalar_one_or_none()
                
                if user and user.is_active:
                    return user
        
        return None

    def generate_api_key(self) -> Tuple[str, str]:
        """
        Generate API key and its hash.
        
        Returns:
            Tuple of (api_key, api_key_hash)
        """
        api_key = f"sk-{secrets.token_urlsafe(32)}"
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        return api_key, api_key_hash

    # ==================== PASSWORD OPERATIONS ====================
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return self.pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Hash password"""
        return self.pwd_context.hash(password)

# Global instance
unified_auth = UnifiedAuthService()

# Backward compatibility functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Backward compatible token creation"""
    result = unified_auth.create_access_token(data, expires_delta, enhanced=False)
    return result if isinstance(result, str) else result[0]

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Backward compatible token verification"""
    return unified_auth.verify_token(token, enhanced=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Backward compatible password verification"""
    return unified_auth.verify_password(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Backward compatible password hashing"""
    return unified_auth.get_password_hash(password)

# Export main components
__all__ = [
    'UnifiedAuthService',
    'AuthResult',
    'unified_auth',
    'create_access_token',
    'verify_token',
    'verify_password',
    'get_password_hash'
] 