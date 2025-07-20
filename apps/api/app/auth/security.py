from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.api_config import settings
import secrets
import hashlib

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return payload
    except JWTError:
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def generate_api_key() -> tuple[str, str]:
    """Generate API key and its hash"""
    # Generate a secure random API key
    api_key = f"sk-{secrets.token_urlsafe(32)}"
    
    # Create hash for storage
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    return api_key, api_key_hash

def verify_api_key(api_key: str, stored_hash: str) -> bool:
    """Verify API key against stored hash"""
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    return secrets.compare_digest(key_hash, stored_hash)

def generate_webhook_secret() -> str:
    """Generate webhook secret for signing"""
    return secrets.token_urlsafe(32) 