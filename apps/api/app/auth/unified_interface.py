"""
Unified Authentication Interface
===============================

This module provides the single, consolidated authentication interface for Schlep-engine.
It replaces all fragmented authentication systems with a clean, unified approach.

Key Features:
- Single source of truth for authentication
- Consistent error handling
- Standardized response models
- Enhanced security features
- Backward compatibility
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from app.database.models import User


class AuthenticationMethod(Enum):
    """Authentication methods supported by the system"""
    PASSWORD = "password"
    API_KEY = "api_key"
    JWT_TOKEN = "jwt_token"
    MFA = "mfa"


class SecurityLevel(Enum):
    """Security levels for different operations"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AuthCredentials:
    """Standardized authentication credentials"""
    identifier: str  # email or username
    password: Optional[str] = None
    api_key: Optional[str] = None
    token: Optional[str] = None
    mfa_code: Optional[str] = None
    method: AuthenticationMethod = AuthenticationMethod.PASSWORD
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuthResult:
    """Standardized authentication result"""
    success: bool
    user: Optional[User] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    session_id: Optional[str] = None
    expires_in: Optional[int] = None
    mfa_required: bool = False
    mfa_challenge_token: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class UserData:
    """Standardized user creation data"""
    email: str
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class AuthenticationInterface(ABC):
    """Abstract interface for authentication operations"""

    @abstractmethod
    async def authenticate(
        self, 
        db: AsyncSession, 
        credentials: AuthCredentials,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuthResult:
        """Authenticate user with provided credentials"""
        pass

    @abstractmethod
    async def create_user(
        self, 
        db: AsyncSession, 
        user_data: UserData
    ) -> User:
        """Create a new user account"""
        pass

    @abstractmethod
    async def verify_token(
        self, 
        db: AsyncSession, 
        token: str,
        required_security_level: SecurityLevel = SecurityLevel.LOW
    ) -> AuthResult:
        """Verify and decode authentication token"""
        pass

    @abstractmethod
    async def refresh_token(
        self, 
        db: AsyncSession, 
        refresh_token: str
    ) -> AuthResult:
        """Refresh access token using refresh token"""
        pass

    @abstractmethod
    async def logout(
        self, 
        db: AsyncSession, 
        user_id: str,
        session_id: Optional[str] = None
    ) -> bool:
        """Logout user and invalidate session"""
        pass

    @abstractmethod
    async def get_current_user(
        self, 
        db: AsyncSession, 
        token: str
    ) -> Optional[User]:
        """Get current user from token"""
        pass


# Pydantic models for API requests/responses
class LoginRequest(BaseModel):
    """Login request model"""
    identifier: str
    password: str
    remember_me: bool = False
    mfa_code: Optional[str] = None


class RegisterRequest(BaseModel):
    """Registration request model"""
    email: EmailStr
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class TokenResponse(BaseModel):
    """Token response model"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    user: Dict[str, Any]


class UserResponse(BaseModel):
    """User response model"""
    id: str
    email: str
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]


class AuthError(Exception):
    """Base authentication error"""
    def __init__(self, message: str, code: str = "AUTH_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class InvalidCredentialsError(AuthError):
    """Invalid credentials error"""
    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message, "INVALID_CREDENTIALS")


class UserNotFoundError(AuthError):
    """User not found error"""
    def __init__(self, message: str = "User not found"):
        super().__init__(message, "USER_NOT_FOUND")


class UserExistsError(AuthError):
    """User already exists error"""
    def __init__(self, message: str = "User already exists"):
        super().__init__(message, "USER_EXISTS")


class TokenExpiredError(AuthError):
    """Token expired error"""
    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, "TOKEN_EXPIRED")


class MFARequiredError(AuthError):
    """MFA required error"""
    def __init__(self, message: str = "Multi-factor authentication required"):
        super().__init__(message, "MFA_REQUIRED") 