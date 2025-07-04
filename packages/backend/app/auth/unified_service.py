"""
Unified Authentication Service
=============================

This is the single, consolidated authentication service for Pollarbase.
It replaces all existing authentication modules and provides a clean,
unified interface for all authentication operations.

Features:
- Single source of truth for authentication logic
- Consistent error handling and logging
- Enhanced security features
- Session management
- API key management
- Password policies
- Audit logging
"""

import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from passlib.context import CryptContext
from jose import jwt, JWTError
import redis.asyncio as redis

from app.core.config import settings
from app.database.models import User, UserRole, AuditLog
from app.auth.unified_interface import (
    AuthenticationInterface, AuthCredentials, AuthResult, UserData,
    SecurityLevel, AuthenticationMethod, AuthError, InvalidCredentialsError,
    UserNotFoundError, UserExistsError, TokenExpiredError
)
from app.core.security_utils import hash_password, verify_password

logger = logging.getLogger(__name__)

class UnifiedAuthService(AuthenticationInterface):
    """
    Unified Authentication Service
    
    This service consolidates all authentication functionality into a single,
    maintainable class that implements the AuthenticationInterface.
    """
    
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.redis_client = None
        if settings.USE_REDIS_CACHE:
            try:
                self.redis_client = redis.from_url(
                    f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}",
                    decode_responses=True
                )
                # This is a synchronous check, but the library handles it.
                # For a fully async setup, this would need to be handled differently.
                self.redis_client.ping()
                logger.info("Redis connection established for session management")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}. Session management will be limited.")
                self.redis_client = None
    
    async def initialize(self):
        pass
    
    # ==================== CORE AUTHENTICATION METHODS ====================
    
    async def authenticate(
        self, 
        db: AsyncSession, 
        credentials: AuthCredentials,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuthResult:
        """
        Authenticate user with provided credentials
        
        Supports multiple authentication methods:
        - Password-based authentication
        - API key authentication
        - JWT token verification
        """
        try:
            if credentials.method == AuthenticationMethod.PASSWORD:
                return await self._authenticate_password(
                    db, credentials, ip_address, user_agent
                )
            elif credentials.method == AuthenticationMethod.API_KEY:
                return await self._authenticate_api_key(
                    db, credentials, ip_address, user_agent
                )
            elif credentials.method == AuthenticationMethod.JWT_TOKEN:
                return await self._authenticate_token(
                    db, credentials, ip_address, user_agent
                )
            else:
                return AuthResult(
                    success=False,
                    error="Unsupported authentication method",
                    error_code="UNSUPPORTED_METHOD"
                )
        except AuthError as e:
            return AuthResult(
                success=False,
                error=e.message,
                error_code=e.code
            )
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return AuthResult(
                success=False,
                error="Authentication failed",
                error_code="INTERNAL_ERROR"
            )
    
    async def _authenticate_password(
        self, 
        db: AsyncSession, 
        credentials: AuthCredentials,
        ip_address: Optional[str],
        user_agent: Optional[str]
    ) -> AuthResult:
        """Authenticate user with password"""
        
        # Check for brute force attempts
        if await self._is_account_locked(credentials.identifier, ip_address):
            return AuthResult(
                success=False,
                error="Account temporarily locked due to multiple failed attempts",
                error_code="ACCOUNT_LOCKED"
            )
        
        # Find user by email or username
        user = await self._get_user_by_identifier(db, credentials.identifier)
        if not user:
            await self._record_failed_attempt(credentials.identifier, ip_address)
            raise InvalidCredentialsError()
        
        # Check if user is active
        if not user.is_active:
            await self._record_failed_attempt(credentials.identifier, ip_address)
            return AuthResult(
                success=False,
                error="Account is inactive",
                error_code="ACCOUNT_INACTIVE"
            )
        
        # Verify password
        if not self._verify_password(credentials.password, user.hashed_password):
            await self._record_failed_attempt(credentials.identifier, ip_address)
            raise InvalidCredentialsError()
        
        # Clear failed attempts on successful login
        await self._clear_failed_attempts(credentials.identifier, ip_address)
        
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        # Create tokens and session
        tokens = await self._create_tokens(user)
        session_id = await self._create_session(user, ip_address, user_agent)
        
        # Log successful authentication
        await self._log_auth_event(
            db, user.id, "login_success", 
            {"ip_address": ip_address, "user_agent": user_agent}
        )
        
        return AuthResult(
            success=True,
            user=user,
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            session_id=session_id,
            expires_in=tokens["expires_in"]
        )
    
    async def _authenticate_api_key(
        self, 
        db: AsyncSession, 
        credentials: AuthCredentials,
        ip_address: Optional[str],
        user_agent: Optional[str]
    ) -> AuthResult:
        """Authenticate user with API key"""
        # Implementation for API key authentication
        # This would check against stored API key hashes
        raise NotImplementedError("API key authentication not yet implemented")
    
    async def _authenticate_token(
        self, 
        db: AsyncSession, 
        credentials: AuthCredentials,
        ip_address: Optional[str],
        user_agent: Optional[str]
    ) -> AuthResult:
        """Authenticate user with JWT token"""
        try:
            payload = jwt.decode(
                credentials.token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM]
            )
            user_id = payload.get("sub")
            if not user_id:
                raise TokenExpiredError("Invalid token payload")
            
            user = await self._get_user_by_id(db, user_id)
            if not user or not user.is_active:
                raise UserNotFoundError("User not found or inactive")
            
            return AuthResult(
                success=True,
                user=user
            )
        except JWTError:
            raise TokenExpiredError("Invalid or expired token")
    
    # ==================== USER MANAGEMENT ====================
    
    async def create_user(
        self, 
        db: AsyncSession, 
        user_data: UserData
    ) -> User:
        """Create a new user account"""
        
        # Check if user already exists
        existing_user = await self._get_user_by_identifier(db, user_data.email)
        if existing_user:
            raise UserExistsError("User with this email already exists")
        
        existing_username = await self._get_user_by_identifier(db, user_data.username)
        if existing_username:
            raise UserExistsError("Username already taken")
        
        # Validate password strength
        if not self._validate_password_strength(user_data.password):
            raise AuthError("Password does not meet security requirements", "WEAK_PASSWORD")
        
        # Create user
        hashed_password = self._hash_password(user_data.password)
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=UserRole.ANALYST,
            is_active=True,
            is_verified=False,
            created_at=datetime.utcnow()
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Log user creation
        await self._log_auth_event(
            db, user.id, "user_created", 
            {"email": user_data.email, "username": user_data.username}
        )
        
        return user
    
    # ==================== TOKEN MANAGEMENT ====================
    
    async def verify_token(
        self, 
        db: AsyncSession, 
        token: str,
        required_security_level: SecurityLevel = SecurityLevel.LOW
    ) -> AuthResult:
        """Verify and decode authentication token"""
        credentials = AuthCredentials(
            identifier="",
            token=token,
            method=AuthenticationMethod.JWT_TOKEN
        )
        return await self._authenticate_token(db, credentials, None, None)
    
    async def refresh_token(
        self, 
        db: AsyncSession, 
        refresh_token: str
    ) -> AuthResult:
        """Refresh access token using refresh token"""
        try:
            payload = jwt.decode(
                refresh_token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM]
            )
            
            if payload.get("type") != "refresh":
                raise TokenExpiredError("Invalid refresh token")
            
            user_id = payload.get("sub")
            user = await self._get_user_by_id(db, user_id)
            
            if not user or not user.is_active:
                raise UserNotFoundError("User not found or inactive")
            
            # Create new tokens
            tokens = await self._create_tokens(user)
            
            return AuthResult(
                success=True,
                user=user,
                access_token=tokens["access_token"],
                refresh_token=tokens["refresh_token"],
                expires_in=tokens["expires_in"]
            )
        except JWTError:
            raise TokenExpiredError("Invalid or expired refresh token")
    
    async def logout(
        self, 
        db: AsyncSession, 
        user_id: str,
        session_id: Optional[str] = None
    ) -> bool:
        """Logout user and invalidate session"""
        try:
            # Remove session from Redis
            if self.redis_client and session_id:
                await self.redis_client.delete(f"session:{session_id}")
            
            # Log logout event
            await self._log_auth_event(
                db, user_id, "logout", 
                {"session_id": session_id}
            )
            
            return True
        except Exception as e:
            logger.error(f"Logout error: {e}")
            return False
    
    async def get_current_user(
        self, 
        db: AsyncSession, 
        token: str
    ) -> Optional[User]:
        """Get current user from token"""
        if not token:
            return None
        try:
            result = await self.verify_token(db, token)
            return result.user if result.success else None
        except Exception:
            return None
    
    # ==================== HELPER METHODS ====================
    
    async def _get_user_by_identifier(self, db: AsyncSession, identifier: str) -> Optional[User]:
        """Get user by email or username"""
        result = await db.execute(
            select(User).where(
                (User.email == identifier) | (User.username == identifier)
            )
        )
        return result.scalar_one_or_none()
    
    async def _get_user_by_id(self, db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user by ID"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    
    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        return self.pwd_context.hash(password)
    
    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def _validate_password_strength(self, password: str) -> bool:
        """Validate password strength"""
        if len(password) < 8:
            return False
        # Add more password validation rules as needed
        return True
    
    async def _create_tokens(self, user: User) -> Dict[str, Any]:
        """Create access and refresh tokens"""
        access_token_data = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role.value,
            "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        
        refresh_token_data = {
            "sub": str(user.id),
            "type": "refresh",
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        
        access_token = jwt.encode(access_token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        refresh_token = jwt.encode(refresh_token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    async def _create_session(
        self, 
        user: User, 
        ip_address: Optional[str], 
        user_agent: Optional[str]
    ) -> Optional[str]:
        """Create user session in Redis"""
        if not self.redis_client:
            return None
        
        session_id = str(uuid4())
        session_data = {
            "user_id": str(user.id),
            "ip_address": ip_address or "",
            "user_agent": user_agent or "",
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            await self.redis_client.setex(
                f"session:{session_id}",
                timedelta(hours=24),
                str(session_data)
            )
            return session_id
        except Exception as e:
            logger.error(f"Session creation failed: {e}")
            return None
    
    async def _is_account_locked(self, identifier: str, ip_address: Optional[str]) -> bool:
        """Check if account is locked due to failed attempts"""
        if not self.redis_client:
            return False
        
        lockout_key = f"auth_lockout:{ip_address}:{identifier}"
        return await self.redis_client.exists(lockout_key)
    
    async def _record_failed_attempt(self, identifier: str, ip_address: Optional[str]):
        """Record failed authentication attempt"""
        if not self.redis_client:
            return
        
        attempt_key = f"auth_attempts:{ip_address}:{identifier}"
        lockout_key = f"auth_lockout:{ip_address}:{identifier}"
        
        attempts = await self.redis_client.incr(attempt_key)
        await self.redis_client.expire(attempt_key, 900)  # 15 minutes
        
        if attempts >= 5:  # Lock after 5 failed attempts
            await self.redis_client.setex(lockout_key, 900, "locked")
            logger.warning(f"Account locked for {identifier} from {ip_address}")
    
    async def _clear_failed_attempts(self, identifier: str, ip_address: Optional[str]):
        """Clear failed authentication attempts"""
        if not self.redis_client:
            return
        
        attempt_key = f"auth_attempts:{ip_address}:{identifier}"
        lockout_key = f"auth_lockout:{ip_address}:{identifier}"
        
        await self.redis_client.delete(attempt_key, lockout_key)
    
    async def _log_auth_event(
        self, 
        db: AsyncSession, 
        user_id: Optional[str], 
        action: str, 
        metadata: Dict[str, Any]
    ):
        """Log authentication event for audit purposes"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=action,
                resource="authentication",
                metadata=metadata,
                created_at=datetime.utcnow()
            )
            db.add(audit_log)
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to log auth event: {e}")


# Global instance
unified_auth_service = UnifiedAuthService() 