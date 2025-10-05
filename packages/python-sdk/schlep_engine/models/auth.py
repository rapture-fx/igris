"""
Authentication models for Schlep-engine SDK
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime


@dataclass
class LoginRequest:
    """Login request data."""
    
    email: str
    password: str
    remember_me: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        return {
            "email": self.email,
            "password": self.password,
            "remember_me": self.remember_me
        }


@dataclass
class RegisterRequest:
    """User registration request data."""
    
    email: str
    password: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization: Optional[str] = None
    agree_to_terms: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        data = {
            "email": self.email,
            "password": self.password,
            "agree_to_terms": self.agree_to_terms
        }
        
        if self.username:
            data["username"] = self.username
        if self.first_name:
            data["first_name"] = self.first_name
        if self.last_name:
            data["last_name"] = self.last_name
        if self.organization:
            data["organization"] = self.organization
            
        return data


@dataclass
class UserInfo:
    """User information."""
    
    id: str
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "user"
    is_verified: bool = False
    is_active: bool = True
    organization_id: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def full_name(self) -> Optional[str]:
        """Get full name if available."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name
    
    @property
    def display_name(self) -> str:
        """Get display name (full name, username, or email)."""
        return self.full_name or self.username or self.email
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "role": self.role,
            "is_verified": self.is_verified,
            "is_active": self.is_active,
            "organization_id": self.organization_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "metadata": self.metadata
        }


@dataclass
class TokenResponse:
    """Authentication token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600  # seconds
    user: Optional[UserInfo] = None
    scope: Optional[str] = None
    issued_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.issued_at is None:
            self.issued_at = datetime.now()
    
    @property
    def expires_at(self) -> Optional[datetime]:
        """Calculate token expiration time."""
        if self.issued_at:
            from datetime import timedelta
            return self.issued_at + timedelta(seconds=self.expires_in)
        return None
    
    @property
    def is_expired(self) -> bool:
        """Check if token is expired."""
        expires_at = self.expires_at
        if expires_at:
            return datetime.now() > expires_at
        return False
    
    @property
    def expires_soon(self) -> bool:
        """Check if token expires within 5 minutes."""
        expires_at = self.expires_at
        if expires_at:
            from datetime import timedelta
            return datetime.now() + timedelta(minutes=5) > expires_at
        return False
    
    @property
    def time_until_expiry(self) -> Optional[int]:
        """Get seconds until token expires."""
        expires_at = self.expires_at
        if expires_at:
            delta = expires_at - datetime.now()
            return max(0, int(delta.total_seconds()))
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "token_type": self.token_type,
            "expires_in": self.expires_in,
            "scope": self.scope,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None
        }
        
        if self.user:
            result["user"] = self.user.to_dict()
            
        return {k: v for k, v in result.items() if v is not None}


@dataclass
class APIKeyInfo:
    """API key information."""
    
    key_id: str
    name: str
    prefix: str
    created_at: datetime
    last_used: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    permissions: list = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_expired(self) -> bool:
        """Check if API key is expired."""
        if self.expires_at:
            return datetime.now() > self.expires_at
        return False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "key_id": self.key_id,
            "name": self.name,
            "prefix": self.prefix,
            "created_at": self.created_at.isoformat(),
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "permissions": self.permissions,
            "metadata": self.metadata
        }


@dataclass
class RefreshTokenRequest:
    """Refresh token request."""
    
    refresh_token: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        return {"refresh_token": self.refresh_token}