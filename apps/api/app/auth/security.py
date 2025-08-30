from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.api_config import settings
import secrets
import hashlib
import os
from cryptography.hazmat.primitives import serialization

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings - Use RS256 for production security
ALGORITHM = os.getenv("JWT_ALGORITHM", "RS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # Short expiry for security
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

def get_signing_key():
    """Get signing key based on algorithm"""
    if ALGORITHM == "RS256":
        # For RS256, use private key for signing
        private_key_path = os.getenv("JWT_PRIVATE_KEY_PATH")
        private_key_str = os.getenv("JWT_PRIVATE_KEY")
        
        if private_key_path:
            with open(private_key_path, 'rb') as key_file:
                private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=None,
                )
                return private_key
        elif private_key_str:
            private_key = serialization.load_pem_private_key(
                private_key_str.encode(),
                password=None,
            )
            return private_key
        else:
            # Fallback to HS256 if no RSA keys are configured
            secret_key = os.getenv("SECRET_KEY", settings.SECRET_KEY)
            if not secret_key or secret_key == "__CHANGE_ME_GENERATE_SECURE_SECRET_KEY__":
                raise ValueError("JWT keys must be properly configured for RS256 or SECRET_KEY for HS256")
            return secret_key
    else:
        # For HS256, use secret key
        secret_key = os.getenv("SECRET_KEY", settings.SECRET_KEY)
        if not secret_key or secret_key == "__CHANGE_ME_GENERATE_SECURE_SECRET_KEY__":
            raise ValueError("SECRET_KEY must be set to a secure value")
        return secret_key

def get_verification_key():
    """Get verification key based on algorithm"""
    if ALGORITHM == "RS256":
        # For RS256, use public key for verification
        public_key_path = os.getenv("JWT_PUBLIC_KEY_PATH")
        public_key_str = os.getenv("JWT_PUBLIC_KEY")
        
        if public_key_path:
            with open(public_key_path, 'rb') as key_file:
                public_key = serialization.load_pem_public_key(key_file.read())
                return public_key
        elif public_key_str:
            public_key = serialization.load_pem_public_key(public_key_str.encode())
            return public_key
        else:
            # Fallback to HS256
            return get_signing_key()
    else:
        # For HS256, same key for signing and verification
        return get_signing_key()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token with enhanced security"""
    to_encode = data.copy()
    
    # Use shorter expiry for security
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add security claims
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
        "iss": "schlep-engine",   # Issuer
        "aud": "schlep-engine-api"  # Audience
    })
    
    # Get signing key based on algorithm
    signing_key = get_signing_key()
    
    encoded_jwt = jwt.encode(to_encode, signing_key, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Create refresh token for token renewal"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    
    # Get signing key based on algorithm
    signing_key = get_signing_key()
    
    encoded_jwt = jwt.encode(to_encode, signing_key, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify and decode JWT token"""
    try:
        # Get verification key based on algorithm
        verification_key = get_verification_key()
        payload = jwt.decode(
            token, 
            verification_key, 
            algorithms=[ALGORITHM],
            audience="schlep-engine-api",
            issuer="schlep-engine"
        )
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