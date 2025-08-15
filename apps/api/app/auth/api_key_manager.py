"""
Secure API Key Management System
===============================

Production-ready API key authentication with proper hashing, validation, and audit logging.
"""

import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from fastapi import HTTPException, status

from app.database.models import User, APIKey
from app.core.secure_config import get_security_config

logger = logging.getLogger(__name__)

class APIKeyScope(Enum):
    """API key permission scopes"""
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    BILLING = "billing"
    ANALYTICS = "analytics"

class APIKeyStatus(Enum):
    """API key status"""
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    SUSPENDED = "suspended"

@dataclass
class APIKeyInfo:
    """API key information without sensitive data"""
    id: str
    name: str
    scopes: List[str]
    status: str
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    usage_count: int
    key_preview: str  # First 8 chars + ... + last 4 chars

class SecureAPIKeyManager:
    """Secure API key management with proper hashing and validation"""

    def __init__(self):
        self.security_config = get_security_config()
        self.key_prefix_mapping = {
            'sk_': 'secret_key',
            'pk_': 'public_key',
            'rk_': 'restricted_key'
        }

    def generate_api_key(self, key_type: str = 'sk_') -> str:
        """Generate a cryptographically secure API key"""
        if key_type not in self.key_prefix_mapping:
            raise ValueError(f"Invalid key type: {key_type}")

        # Generate 32 bytes (256 bits) of secure random data
        random_bytes = secrets.token_bytes(32)
        key_suffix = secrets.token_urlsafe(32)

        return f"{key_type}{key_suffix}"

    def hash_api_key(self, api_key: str) -> str:
        """Hash API key for secure storage using SHA-256"""
        if not self.validate_api_key_format(api_key):
            raise ValueError("Invalid API key format")

        # Add salt to prevent rainbow table attacks
        salt = "schlep_engine_api_salt_2024"
        salted_key = f"{salt}{api_key}"

        return hashlib.sha256(salted_key.encode()).hexdigest()

    def validate_api_key_format(self, api_key: str) -> bool:
        """Validate API key format and structure"""
        if not api_key or not isinstance(api_key, str):
            return False

        # Check for valid prefix
        valid_prefix = any(api_key.startswith(prefix) for prefix in self.key_prefix_mapping.keys())
        if not valid_prefix:
            return False

        # Check minimum length (prefix + 32 chars minimum)
        if len(api_key) < 35:
            return False

        # Check for valid characters (base64url safe)
        pattern = r'^[a-zA-Z0-9_-]+$'
        if not re.match(pattern, api_key[3:]):  # Skip prefix in validation
            return False

        return True

    async def create_api_key(
        self,
        db: AsyncSession,
        user_id: str,
        name: str,
        scopes: List[APIKeyScope],
        expires_in_days: Optional[int] = None
    ) -> Dict[str, Any]:
        """Create a new API key for a user"""
        try:
            # Generate new API key
            api_key = self.generate_api_key('sk_')
            key_hash = self.hash_api_key(api_key)

            # Calculate expiration
            expires_at = None
            if expires_in_days:
                expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

            # Create database record
            db_api_key = APIKey(
                user_id=user_id,
                name=name,
                key_hash=key_hash,
                scopes=[scope.value for scope in scopes],
                status=APIKeyStatus.ACTIVE.value,
                expires_at=expires_at,
                created_at=datetime.utcnow(),
                usage_count=0
            )

            db.add(db_api_key)
            await db.commit()
            await db.refresh(db_api_key)

            # Log key creation
            logger.info(f"API key created for user {user_id}: {name}")

            # Return key info (key is only shown once)
            return {
                "api_key": api_key,  # Only returned once!
                "key_info": APIKeyInfo(
                    id=str(db_api_key.id),
                    name=db_api_key.name,
                    scopes=db_api_key.scopes,
                    status=db_api_key.status,
                    created_at=db_api_key.created_at,
                    expires_at=db_api_key.expires_at,
                    last_used_at=None,
                    usage_count=0,
                    key_preview=f"{api_key[:8]}...{api_key[-4:]}"
                )
            }

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create API key: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create API key"
            )

    async def authenticate_api_key(
        self,
        db: AsyncSession,
        api_key: str,
        required_scopes: Optional[List[str]] = None
    ) -> Optional[User]:
        """Authenticate API key and return associated user"""
        try:
            # Validate format first
            if not self.validate_api_key_format(api_key):
                logger.warning(f"Invalid API key format attempted")
                return None

            # Hash the provided key
            key_hash = self.hash_api_key(api_key)

            # Find the API key in database
            stmt = select(APIKey).where(APIKey.key_hash == key_hash)
            result = await db.execute(stmt)
            db_api_key = result.scalar_one_or_none()

            if not db_api_key:
                logger.warning(f"API key not found in database")
                return None

            # Check if key is active
            if db_api_key.status != APIKeyStatus.ACTIVE.value:
                logger.warning(f"Inactive API key attempted: {db_api_key.status}")
                return None

            # Check expiration
            if db_api_key.expires_at and db_api_key.expires_at < datetime.utcnow():
                logger.warning(f"Expired API key attempted")
                # Auto-update status to expired
                await self._update_key_status(db, db_api_key.id, APIKeyStatus.EXPIRED)
                return None

            # Check scopes if required
            if required_scopes:
                if not all(scope in db_api_key.scopes for scope in required_scopes):
                    logger.warning(f"Insufficient API key scopes")
                    return None

            # Get associated user
            stmt = select(User).where(User.id == db_api_key.user_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()

            if not user or not user.is_active:
                logger.warning(f"API key user inactive or not found")
                return None

            # Update last used timestamp and usage count
            await self._update_key_usage(db, db_api_key.id)

            logger.info(f"Successful API key authentication for user {user.id}")
            return user

        except Exception as e:
            logger.error(f"API key authentication error: {e}")
            return None

    async def revoke_api_key(
        self,
        db: AsyncSession,
        api_key_id: str,
        user_id: str
    ) -> bool:
        """Revoke an API key"""
        try:
            stmt = (
                update(APIKey)
                .where(APIKey.id == api_key_id, APIKey.user_id == user_id)
                .values(status=APIKeyStatus.REVOKED.value, updated_at=datetime.utcnow())
            )

            result = await db.execute(stmt)
            await db.commit()

            if result.rowcount > 0:
                logger.info(f"API key revoked: {api_key_id}")
                return True

            return False

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to revoke API key: {e}")
            return False

    async def list_user_api_keys(
        self,
        db: AsyncSession,
        user_id: str
    ) -> List[APIKeyInfo]:
        """List all API keys for a user (without sensitive data)"""
        try:
            stmt = select(APIKey).where(APIKey.user_id == user_id)
            result = await db.execute(stmt)
            api_keys = result.scalars().all()

            return [
                APIKeyInfo(
                    id=str(key.id),
                    name=key.name,
                    scopes=key.scopes,
                    status=key.status,
                    created_at=key.created_at,
                    expires_at=key.expires_at,
                    last_used_at=key.last_used_at,
                    usage_count=key.usage_count,
                    key_preview=f"sk_{'*' * 8}...{'*' * 4}"  # Always masked
                )
                for key in api_keys
            ]

        except Exception as e:
            logger.error(f"Failed to list API keys: {e}")
            return []

    async def _update_key_usage(self, db: AsyncSession, api_key_id: str):
        """Update API key last used timestamp and usage count"""
        try:
            stmt = (
                update(APIKey)
                .where(APIKey.id == api_key_id)
                .values(
                    last_used_at=datetime.utcnow(),
                    usage_count=APIKey.usage_count + 1
                )
            )
            await db.execute(stmt)
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to update API key usage: {e}")

    async def _update_key_status(self, db: AsyncSession, api_key_id: str, status: APIKeyStatus):
        """Update API key status"""
        try:
            stmt = (
                update(APIKey)
                .where(APIKey.id == api_key_id)
                .values(status=status.value, updated_at=datetime.utcnow())
            )
            await db.execute(stmt)
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to update API key status: {e}")

# Global API key manager instance
api_key_manager = SecureAPIKeyManager()

def get_api_key_manager() -> SecureAPIKeyManager:
    """Get the global API key manager"""
    return api_key_manager
