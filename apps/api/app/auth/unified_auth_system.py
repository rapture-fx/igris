"""
Unified Authentication System for Schlep-engine
Consolidates all authentication functionality into a single, cohesive system
"""

import asyncio
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from dataclasses import dataclass, field

# Dependencies
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

# Internal imports
from app.core.config import settings
from app.database.models import User, UserRole, Organization
from app.database.connection import get_async_session
from app.core.redis_client import get_redis_client
import logging

logger = logging.getLogger(__name__)

# Security configuration
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Enums and Models
class AuthStatus(Enum):
    SUCCESS = "success"
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_DISABLED = "account_disabled"
    TOKEN_EXPIRED = "token_expired"
    TOKEN_INVALID = "token_invalid"
    INSUFFICIENT_PERMISSIONS = "insufficient_permissions"

@dataclass
class AuthResult:
    """Result of authentication operations"""
    success: bool
    status: AuthStatus
    user: Optional[User] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

# Pydantic Models
class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class UserRegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    first_name: str
    last_name: str
    organization_name: Optional[str] = None

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]

class UnifiedAuthService:
    """Unified Authentication Service - Single source of truth for all auth operations"""
    
    def __init__(self):
        self.max_failed_attempts = 5
        self.lockout_duration_seconds = 900  # 15 minutes
        self.token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.refresh_token_expire_days = 7
    
    # Password Management
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def generate_secure_token(self, length: int = 32) -> str:
        """Generate a secure random token"""
        return secrets.token_urlsafe(length)
    
    # Account Security
    async def get_lockout_key(self, identifier: str) -> str:
        return f"auth:lockout:{identifier}"

    async def get_failed_attempts_key(self, identifier: str) -> str:
        return f"auth:failed_attempts:{identifier}"

    async def is_account_locked(self, identifier: str) -> bool:
        """Check if account is locked due to failed attempts using Redis."""
        redis = await get_redis_client()
        if not redis:
            return False
        lockout_key = await self.get_lockout_key(identifier)
        return await redis.exists(lockout_key)

    async def record_failed_attempt(self, identifier: str):
        """Record a failed authentication attempt in Redis."""
        redis = await get_redis_client()
        if not redis:
            return

        failed_attempts_key = await self.get_failed_attempts_key(identifier)
        current_attempts = await redis.incr(failed_attempts_key)
        await redis.expire(failed_attempts_key, self.lockout_duration_seconds)

        if current_attempts >= self.max_failed_attempts:
            lockout_key = await self.get_lockout_key(identifier)
            await redis.setex(lockout_key, self.lockout_duration_seconds, "locked")

    async def clear_failed_attempts(self, identifier: str):
        """Clear failed attempts for successful login from Redis."""
        redis = await get_redis_client()
        if not redis:
            return
        
        await redis.delete(await self.get_failed_attempts_key(identifier))
        await redis.delete(await self.get_lockout_key(identifier))
    
    # JWT Token Management
    def create_access_token(self, user: User, remember_me: bool = False) -> str:
        """Create JWT access token"""
        expire_minutes = self.token_expire_minutes
        if remember_me:
            expire_minutes = expire_minutes * 24  # 24x longer for remember me
        
        expire = datetime.utcnow() + timedelta(minutes=expire_minutes)
        
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role.value if user.role else "user",
            "org_id": str(user.organization_id) if user.organization_id else None,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
            "remember_me": remember_me
        }
        
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    def create_refresh_token(self, user: User) -> str:
        """Create JWT refresh token"""
        expire = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        
        payload = {
            "sub": str(user.id),
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
            "jti": str(uuid.uuid4())  # JWT ID for token revocation
        }
        
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            return payload
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    # User Management
    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email"""
        result = await db.execute(
            select(User).where(User.email == email).options(selectinload(User.organization))
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        """Get user by ID"""
        result = await db.execute(
            select(User).where(User.id == user_id).options(selectinload(User.organization))
        )
        return result.scalar_one_or_none()
    
    async def create_user(self, db: AsyncSession, user_data: UserRegisterRequest) -> User:
        """Create a new user"""
        # Check if user already exists
        existing_user = await self.get_user_by_email(db, user_data.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create organization if provided
        organization = None
        if user_data.organization_name:
            organization = Organization(
                id=uuid.uuid4(),
                name=user_data.organization_name,
                slug=user_data.organization_name.lower().replace(" ", "-"),
                subscription_plan="free",
                subscription_status="active",
                created_at=datetime.utcnow()
            )
            db.add(organization)
            await db.flush()
        
        # Create user
        user = User(
            id=uuid.uuid4(),
            email=user_data.email,
            username=user_data.username,
            hashed_password=self.hash_password(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=UserRole.USER,
            organization_id=organization.id if organization else None,
            is_active=True,
            is_verified=False,
            created_at=datetime.utcnow()
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        return user
    
    # Authentication Operations
    async def authenticate_user(self, db: AsyncSession, email: str, password: str) -> AuthResult:
        """Authenticate user with email and password"""
        
        # Check if account is locked
        if await self.is_account_locked(email):
            return AuthResult(
                success=False,
                status=AuthStatus.ACCOUNT_LOCKED,
                error_message="Account is temporarily locked due to too many failed login attempts."
            )
        
        user = await self.get_user_by_email(db, email)
        
        if user:
            # Check if this is an OAuth-only user (no password set)
            if not user.hashed_password and user.oauth_provider:
                return AuthResult(
                    success=False, 
                    status=AuthStatus.INVALID_CREDENTIALS, 
                    error_message=f"This account uses {user.oauth_provider.value} OAuth authentication. Please sign in with {user.oauth_provider.value}."
                )
            
            # Regular password authentication
            if user.hashed_password and self.verify_password(password, user.hashed_password):
                if not user.is_active:
                    return AuthResult(success=False, status=AuthStatus.ACCOUNT_DISABLED, error_message="Account is disabled")
            
                # Success - clear any failed attempts
                await self.clear_failed_attempts(email)
                
                return AuthResult(success=True, status=AuthStatus.SUCCESS, user=user)
            else:
                # Wrong password - record failed attempt
                await self.record_failed_attempt(email)
                return AuthResult(success=False, status=AuthStatus.INVALID_CREDENTIALS, error_message="Invalid email or password")
        else:
            # User not found
            return AuthResult(success=False, status=AuthStatus.INVALID_CREDENTIALS, error_message="Invalid email or password")
    
    async def login_user(self, db: AsyncSession, login_data: UserLoginRequest) -> AuthResult:
        """Login a user and return tokens"""
        
        auth_result = await self.authenticate_user(db, login_data.email, login_data.password)
        
        if not auth_result.success:
            return auth_result
        
        # Generate tokens
        access_token = self.create_access_token(auth_result.user, login_data.remember_me)
        refresh_token = self.create_refresh_token(auth_result.user)
        
        # Update user's last login
        auth_result.user.last_login = datetime.utcnow()
        await db.commit()
        
        return AuthResult(
            success=True,
            status=AuthStatus.SUCCESS,
            user=auth_result.user,
            access_token=access_token,
            refresh_token=refresh_token,
            metadata={
                "expires_in": self.token_expire_minutes * 60,
                "remember_me": login_data.remember_me
            }
        )
    
    async def refresh_access_token(self, db: AsyncSession, refresh_token: str) -> AuthResult:
        """Refresh access token using refresh token"""
        
        try:
            payload = self.verify_token(refresh_token)
            
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
            
            user_id = uuid.UUID(payload["sub"])
            user = await self.get_user_by_id(db, user_id)
            
            if not user or not user.is_active:
                raise HTTPException(status_code=401, detail="User not found or inactive")
            
            # Generate new access token
            new_access_token = self.create_access_token(user)
            
            return AuthResult(
                success=True,
                status=AuthStatus.SUCCESS,
                user=user,
                access_token=new_access_token,
                metadata={"expires_in": self.token_expire_minutes * 60}
            )
            
        except Exception as e:
            return AuthResult(
                success=False,
                status=AuthStatus.TOKEN_INVALID,
                error_message=str(e)
            )
    
    # Authorization
    def check_permissions(self, user: User, required_role: UserRole) -> bool:
        """Check if user has required permissions"""
        if not user.is_active:
            return False
        
        # Role hierarchy: ADMIN > ANALYST > USER
        role_hierarchy = {
            UserRole.ADMIN: 3,
            UserRole.ANALYST: 2,
            UserRole.USER: 1
        }
        
        user_level = role_hierarchy.get(user.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        return user_level >= required_level
    
    # OAuth Integration Methods
    async def is_oauth_user(self, user: User) -> bool:
        """Check if user is OAuth-only (no password set)"""
        return user.oauth_provider is not None and user.hashed_password is None
    
    async def can_use_password_auth(self, user: User) -> bool:
        """Check if user can authenticate with password"""
        return user.hashed_password is not None
    
    async def get_user_auth_methods(self, db: AsyncSession, user: User) -> List[str]:
        """Get available authentication methods for a user"""
        methods = []
        
        # Check for password authentication
        if user.hashed_password:
            methods.append("password")
        
        # Check for OAuth providers
        if user.oauth_provider:
            methods.append(f"oauth_{user.oauth_provider.value}")
        
        # Check for linked OAuth accounts
        from app.database.models import OAuthAccount
        from sqlalchemy import select
        
        result = await db.execute(
            select(OAuthAccount.provider).where(OAuthAccount.user_id == user.id)
        )
        linked_providers = result.scalars().all()
        
        for provider in linked_providers:
            oauth_method = f"oauth_{provider.value}"
            if oauth_method not in methods:
                methods.append(oauth_method)
        
        return methods

# Dependency injection
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_async_session)
) -> User:
    """Get current authenticated user"""
    
    auth_service = UnifiedAuthService()
    
    try:
        payload = auth_service.verify_token(credentials.credentials)
        
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = uuid.UUID(payload["sub"])
        user = await auth_service.get_user_by_id(db, user_id)
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User account is disabled")
        
        return user
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current user with admin permissions"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def get_analyst_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current user with analyst permissions"""
    if current_user.role not in [UserRole.ADMIN, UserRole.ANALYST]:
        raise HTTPException(status_code=403, detail="Analyst access required")
    return current_user

# Global instance
unified_auth_service = UnifiedAuthService()

# Backwards compatibility - expose common functions
async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """Backwards compatibility function"""
    result = await unified_auth_service.authenticate_user(db, email, password)
    return result.user if result.success else None

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Backwards compatibility function"""
    return await unified_auth_service.get_user_by_email(db, email)

async def create_user(db: AsyncSession, **kwargs) -> User:
    """Backwards compatibility function"""
    user_data = UserRegisterRequest(**kwargs)
    return await unified_auth_service.create_user(db, user_data) 