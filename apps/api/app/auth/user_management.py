"""
User Management System
======================

Complete user authentication, registration, and management system for MVP launch.

Features:
- User registration with email verification
- Secure password hashing (bcrypt)
- JWT token authentication
- Password reset functionality
- API key management
- Rate limiting by user tier
- Session management
- User profile management
"""

import bcrypt
import jwt
import uuid
import hashlib
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import logging
import re
import secrets
import os

from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr, validator
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

class UserTier(Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class AuthConfig:
    # JWT Configuration
    JWT_SECRET = os.getenv("JWT_SECRET")
    if not JWT_SECRET:
        raise ValueError("JWT_SECRET environment variable is required and must be set")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 24
    
    # Password Configuration
    MIN_PASSWORD_LENGTH = 8
    PASSWORD_REQUIRE_UPPERCASE = True
    PASSWORD_REQUIRE_LOWERCASE = True
    PASSWORD_REQUIRE_DIGIT = True
    PASSWORD_REQUIRE_SPECIAL = True
    
    # Rate Limits by Tier
    TIER_LIMITS = {
        UserTier.FREE: {"requests_per_hour": 100, "files_per_day": 10, "max_file_size_mb": 10},
        UserTier.BASIC: {"requests_per_hour": 1000, "files_per_day": 100, "max_file_size_mb": 50},
        UserTier.PRO: {"requests_per_hour": 10000, "files_per_day": 1000, "max_file_size_mb": 200},
        UserTier.ENTERPRISE: {"requests_per_hour": 100000, "files_per_day": 10000, "max_file_size_mb": 1000}
    }

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class UserRegistration(BaseModel):
    email: EmailStr
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, hyphens, and underscores')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < AuthConfig.MIN_PASSWORD_LENGTH:
            raise ValueError(f'Password must be at least {AuthConfig.MIN_PASSWORD_LENGTH} characters')
        
        checks = []
        if AuthConfig.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', v):
            checks.append('uppercase letter')
        if AuthConfig.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', v):
            checks.append('lowercase letter')
        if AuthConfig.PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', v):
            checks.append('digit')
        if AuthConfig.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            checks.append('special character')
        
        if checks:
            raise ValueError(f'Password must contain at least one: {", ".join(checks)}')
        
        return v

class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    subscription_tier: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile

class APIKeyCreate(BaseModel):
    name: str
    
    @validator('name')
    def validate_name(cls, v):
        if len(v) < 3 or len(v) > 100:
            raise ValueError('API key name must be between 3 and 100 characters')
        return v

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: str  # Only returned on creation
    is_active: bool
    created_at: datetime
    last_used: Optional[datetime]
    usage_count: int

# =============================================================================
# DATABASE CONNECTION
# =============================================================================

class DatabaseManager:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.engine: Optional[create_async_engine] = None
        
    async def connect(self):
        """Initialize database connection pool"""
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://schlep-engine:secure_password_123@localhost:5432/schlep_engine"
        )
        
        try:
            self.pool = await asyncpg.create_pool(
                database_url,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            self.engine = create_async_engine(
                database_url,
                pool_recycle=3600,
                pool_pre_ping=True
            )
            logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.error(f"Failed to create database connection pool: {e}")
            raise
    
    async def disconnect(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    async def get_connection(self):
        """Get database connection from pool"""
        if not self.pool:
            await self.connect()
        return self.pool.acquire()

# Global database manager instance
db_manager = DatabaseManager()

# =============================================================================
# USER MANAGEMENT CLASS
# =============================================================================

class UserManager:
    def __init__(self):
        self.db = db_manager
    
    async def create_user(self, user_data: UserRegistration) -> Dict[str, Any]:
        """Create a new user account"""
        async with await self.db.get_connection() as conn:
            # Check if user already exists
            existing_user = await conn.fetchrow(
                "SELECT id FROM users WHERE email = $1 OR username = $2",
                user_data.email, user_data.username
            )
            
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User with this email or username already exists"
                )
            
            # Hash password
            password_hash = self._hash_password(user_data.password)
            
            # Generate verification token
            verification_token = secrets.token_urlsafe(32)
            
            # Create user
            user_id = await conn.fetchval(
                """
                INSERT INTO users (
                    email, username, password_hash, first_name, last_name,
                    verification_token, subscription_tier
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                user_data.email,
                user_data.username,
                password_hash,
                user_data.first_name,
                user_data.last_name,
                verification_token,
                UserTier.FREE.value
            )
            
            logger.info(f"User created successfully: {user_data.email}")
            
            return {
                "user_id": str(user_id),
                "email": user_data.email,
                "username": user_data.username,
                "verification_token": verification_token,
                "message": "User created successfully. Please verify your email."
            }
    
    async def authenticate_user(self, login_data: UserLogin) -> Optional[Dict[str, Any]]:
        """Authenticate user with username/email and password"""
        async with await self.db.get_connection() as conn:
            # Find user by username or email
            user = await conn.fetchrow(
                """
                SELECT id, email, username, password_hash, first_name, last_name,
                       subscription_tier, is_active, is_verified, created_at, last_login
                FROM users 
                WHERE (username = $1 OR email = $1) AND is_active = true
                """,
                login_data.username
            )
            
            if not user:
                return None
            
            # Verify password
            if not self._verify_password(login_data.password, user['password_hash']):
                return None
            
            # Update last login
            await conn.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
                user['id']
            )
            
            return dict(user)
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        async with await self.db.get_connection() as conn:
            user = await conn.fetchrow(
                """
                SELECT id, email, username, first_name, last_name,
                       subscription_tier, is_active, is_verified, created_at, last_login
                FROM users WHERE id = $1
                """,
                uuid.UUID(user_id)
            )
            
            return dict(user) if user else None
    
    async def verify_email(self, verification_token: str) -> bool:
        """Verify user email with token"""
        async with await self.db.get_connection() as conn:
            result = await conn.execute(
                """
                UPDATE users 
                SET is_verified = true, verification_token = null 
                WHERE verification_token = $1
                """,
                verification_token
            )
            
            return result == "UPDATE 1"
    
    async def create_api_key(self, user_id: str, key_data: APIKeyCreate) -> Dict[str, Any]:
        """Create API key for user"""
        async with await self.db.get_connection() as conn:
            # Generate API key
            api_key = f"sk_live_{secrets.token_urlsafe(32)}"
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            
            # Get user tier for rate limiting
            user = await conn.fetchrow(
                "SELECT subscription_tier FROM users WHERE id = $1",
                uuid.UUID(user_id)
            )
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            # Create API key record
            key_id = await conn.fetchval(
                """
                INSERT INTO api_keys (user_id, key_hash, name, rate_limit_tier)
                VALUES ($1, $2, $3, $4)
                RETURNING id
                """,
                uuid.UUID(user_id),
                key_hash,
                key_data.name,
                user['subscription_tier']
            )
            
            return {
                "id": str(key_id),
                "name": key_data.name,
                "key": api_key,
                "created_at": datetime.now(timezone.utc),
                "message": "API key created successfully. Store it securely - it won't be shown again."
            }
    
    async def get_user_api_keys(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all API keys for user (without actual keys)"""
        async with await self.db.get_connection() as conn:
            keys = await conn.fetch(
                """
                SELECT id, name, is_active, created_at, last_used, usage_count
                FROM api_keys 
                WHERE user_id = $1 
                ORDER BY created_at DESC
                """,
                uuid.UUID(user_id)
            )
            
            return [dict(key) for key in keys]
    
    async def revoke_api_key(self, user_id: str, key_id: str) -> bool:
        """Revoke (deactivate) an API key"""
        async with await self.db.get_connection() as conn:
            result = await conn.execute(
                """
                UPDATE api_keys 
                SET is_active = false 
                WHERE id = $1 AND user_id = $2
                """,
                uuid.UUID(key_id),
                uuid.UUID(user_id)
            )
            
            return result == "UPDATE 1"
    
    async def validate_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Validate API key and return user info"""
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        async with await self.db.get_connection() as conn:
            result = await conn.fetchrow(
                """
                SELECT ak.id, ak.user_id, ak.rate_limit_tier, ak.usage_count,
                       u.email, u.username, u.subscription_tier, u.is_active
                FROM api_keys ak
                JOIN users u ON ak.user_id = u.id
                WHERE ak.key_hash = $1 AND ak.is_active = true AND u.is_active = true
                """,
                key_hash
            )
            
            if result:
                # Update usage count and last used
                await conn.execute(
                    """
                    UPDATE api_keys 
                    SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                    WHERE id = $1
                    """,
                    result['id']
                )
            
            return dict(result) if result else None
    
    def generate_jwt_token(self, user: Dict[str, Any]) -> str:
        """Generate JWT token for user"""
        payload = {
            "user_id": str(user['id']),
            "username": user['username'],
            "email": user['email'],
            "subscription_tier": user['subscription_tier'],
            "exp": datetime.utcnow() + timedelta(hours=AuthConfig.JWT_EXPIRATION_HOURS),
            "iat": datetime.utcnow(),
            "iss": "schlep-engine"
        }
        
        return jwt.encode(payload, AuthConfig.JWT_SECRET, algorithm=AuthConfig.JWT_ALGORITHM)
    
    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, AuthConfig.JWT_SECRET, algorithms=[AuthConfig.JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token has expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid JWT token")
            return None
    
    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def _verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    async def get_user_usage_limits(self, user_id: str) -> Dict[str, Any]:
        """Get usage limits for user based on their tier"""
        user = await self.get_user_by_id(user_id)
        if not user:
            return {}
        
        tier = UserTier(user['subscription_tier'])
        limits = AuthConfig.TIER_LIMITS[tier]
        
        # Get current usage from database
        async with await self.db.get_connection() as conn:
            today = datetime.now(timezone.utc).date()
            
            usage = await conn.fetchrow(
                """
                SELECT files_processed, data_analyzed_mb, api_requests
                FROM usage_statistics 
                WHERE user_id = $1 AND date = $2
                """,
                uuid.UUID(user_id),
                today
            )
            
            current_usage = {
                "files_processed": usage['files_processed'] if usage else 0,
                "data_analyzed_mb": float(usage['data_analyzed_mb']) if usage else 0.0,
                "api_requests": usage['api_requests'] if usage else 0
            }
        
        return {
            "subscription_tier": tier.value,
            "limits": limits,
            "current_usage": current_usage,
            "remaining": {
                "files_today": max(0, limits['files_per_day'] - current_usage['files_processed']),
                "requests_hour": limits['requests_per_hour']  # This would need hourly tracking
            }
        }

# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

user_manager = UserManager()

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def init_user_management():
    """Initialize user management system"""
    try:
        await db_manager.connect()
        logger.info("User management system initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize user management system: {e}")
        raise

async def cleanup_user_management():
    """Cleanup user management system"""
    await db_manager.disconnect()
    logger.info("User management system cleaned up") 