"""
Unified Authentication Service
============================

This module provides a single, comprehensive authentication service for Pollarbase.
It consolidates user registration, login, password management, and session handling.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import jwt, JWTError
import redis.asyncio as redis

from app.database.models import User, UserRole, AuditLog
from app.core.config import settings

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Redis connection for session management
redis_client = None

class AuthenticationError(Exception):
    """Custom authentication error"""
    pass

class AuthResult:
    """Authentication result container"""
    def __init__(
        self,
        success: bool,
        user: Optional[User] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        session_id: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        self.success = success
        self.user = user
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.session_id = session_id
        self.error_message = error_message

class AuthService:
    """Unified authentication service"""
    
    def __init__(self):
        self.redis_client = None
    
    async def init_redis(self):
        """Initialize Redis connection for session management"""
        try:
            self.redis_client = redis.from_url(
                "redis://localhost:6379/0",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Redis connection established for session management")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Sessions will be stateless.")
            self.redis_client = None
    
    def hash_password(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            return payload
        except JWTError:
            return None
    
    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """Get user by username"""
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user by ID"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    
    async def create_user(
        self,
        db: AsyncSession,
        email: str,
        username: str,
        password: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        role: UserRole = UserRole.ANALYST
    ) -> User:
        """Create a new user"""
        
        # Check if user already exists
        existing_user = await self.get_user_by_email(db, email)
        if existing_user:
            raise AuthenticationError("User with this email already exists")
        
        existing_username = await self.get_user_by_username(db, username)
        if existing_username:
            raise AuthenticationError("Username already taken")
        
        # Create new user
        hashed_password = self.hash_password(password)
        user = User(
            email=email,
            username=username,
            hashed_password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
            is_verified=False  # Email verification required
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Log user creation
        await self.log_auth_event(
            db, user.id, "user_created", 
            {"email": email, "username": username}
        )
        
        return user
    
    async def authenticate_user(
        self,
        db: AsyncSession,
        identifier: str,  # email or username
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuthResult:
        """Authenticate user and return auth result"""
        
        # Try to find user by email or username
        user = await self.get_user_by_email(db, identifier)
        if not user:
            user = await self.get_user_by_username(db, identifier)
        
        if not user:
            await self.log_auth_event(
                db, None, "login_failed", 
                {"identifier": identifier, "reason": "user_not_found", "ip_address": ip_address}
            )
            return AuthResult(success=False, error_message="Invalid credentials")
        
        if not user.is_active:
            await self.log_auth_event(
                db, user.id, "login_failed", 
                {"reason": "user_inactive", "ip_address": ip_address}
            )
            return AuthResult(success=False, error_message="Account is inactive")
        
        if not self.verify_password(password, user.hashed_password):
            await self.log_auth_event(
                db, user.id, "login_failed", 
                {"reason": "invalid_password", "ip_address": ip_address}
            )
            return AuthResult(success=False, error_message="Invalid credentials")
        
        # Update user's last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        # Create access token
        access_token_data = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role.value
        }
        access_token = self.create_access_token(access_token_data)
        
        # Create session if Redis is available
        session_id = None
        if self.redis_client:
            session_id = str(uuid4())
            session_data = {
                "user_id": str(user.id),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "created_at": datetime.utcnow().isoformat()
            }
            await self.redis_client.setex(
                f"session:{session_id}",
                timedelta(hours=24),
                str(session_data)
            )
        
        # Log successful login
        await self.log_auth_event(
            db, user.id, "login_success", 
            {"ip_address": ip_address, "user_agent": user_agent}
        )
        
        return AuthResult(
            success=True,
            user=user,
            access_token=access_token,
            session_id=session_id
        )
    
    async def logout_user(
        self,
        db: AsyncSession,
        user_id: str,
        session_id: Optional[str] = None
    ) -> bool:
        """Logout user and invalidate session"""
        
        # Remove session from Redis if available
        if self.redis_client and session_id:
            await self.redis_client.delete(f"session:{session_id}")
        
        # Log logout
        await self.log_auth_event(
            db, user_id, "logout", 
            {"session_id": session_id}
        )
        
        return True
    
    async def change_password(
        self,
        db: AsyncSession,
        user_id: str,
        current_password: str,
        new_password: str
    ) -> bool:
        """Change user password"""
        
        user = await self.get_user_by_id(db, user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        if not self.verify_password(current_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect")
        
        # Update password
        user.hashed_password = self.hash_password(new_password)
        await db.commit()
        
        # Log password change
        await self.log_auth_event(
            db, user_id, "password_changed", {}
        )
        
        return True
    
    async def log_auth_event(
        self,
        db: AsyncSession,
        user_id: Optional[str],
        action: str,
        details: Dict[str, Any]
    ):
        """Log authentication event for audit trail"""
        
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type="auth",
            details=details,
            ip_address=details.get("ip_address"),
            user_agent=details.get("user_agent")
        )
        
        db.add(audit_log)
        await db.commit()

# Global auth service instance
auth_service = AuthService() 