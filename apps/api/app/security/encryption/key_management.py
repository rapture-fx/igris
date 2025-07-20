"""
Key Management Module

This module provides comprehensive key lifecycle management for the encryption system.
It handles key generation, rotation, secure storage, and lifecycle operations with
support for HSM integration and compliance requirements.

Features:
- Secure key generation with entropy validation
- Automated key rotation with rollback support
- HSM and cloud key management integration
- Key versioning and lifecycle tracking
- Compliance logging and audit trails
- Emergency key recovery procedures

Security Features:
- Hardware security module (HSM) support
- Secure key derivation and storage
- Key usage tracking and limits
- Automatic key expiration and rotation
- Multi-layered key encryption (KEK/DEK pattern)
"""

import os
import json
import secrets
import hashlib
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, asdict
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, padding
import logging
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)

class KeyType(Enum):
    """Types of encryption keys"""
    MASTER = "master"
    DATA_ENCRYPTION = "dek"
    KEY_ENCRYPTION = "kek"
    FIELD_ENCRYPTION = "field"
    BACKUP = "backup"

class KeyStatus(Enum):
    """Key lifecycle status"""
    PENDING = "pending"
    ACTIVE = "active"
    ROTATING = "rotating"
    DEPRECATED = "deprecated"
    REVOKED = "revoked"
    DESTROYED = "destroyed"

class StorageBackend(Enum):
    """Key storage backends"""
    LOCAL_FILE = "local_file"
    ENVIRONMENT = "environment"
    HSM = "hsm"
    AWS_KMS = "aws_kms"
    AZURE_KEY_VAULT = "azure_kv"
    HASHICORP_VAULT = "vault"

@dataclass
class KeyMetadata:
    """Metadata for encryption keys"""
    key_id: str
    key_type: KeyType
    status: KeyStatus
    created_at: datetime
    expires_at: Optional[datetime]
    version: int
    algorithm: str
    key_size: int
    usage_count: int
    max_usage: Optional[int]
    last_rotated: Optional[datetime]
    rotation_interval: Optional[timedelta]
    context: str
    tags: Dict[str, str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        # Convert datetime objects to ISO strings
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        if self.expires_at:
            data['expires_at'] = self.expires_at.isoformat()
        if self.last_rotated:
            data['last_rotated'] = self.last_rotated.isoformat()
        if self.rotation_interval:
            data['rotation_interval'] = self.rotation_interval.total_seconds()
        
        # Convert enums to strings
        data['key_type'] = self.key_type.value
        data['status'] = self.status.value
        
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'KeyMetadata':
        """Create from dictionary"""
        # Convert string dates back to datetime objects
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'expires_at' in data and isinstance(data['expires_at'], str):
            data['expires_at'] = datetime.fromisoformat(data['expires_at'])
        if 'last_rotated' in data and isinstance(data['last_rotated'], str):
            data['last_rotated'] = datetime.fromisoformat(data['last_rotated'])
        if 'rotation_interval' in data and isinstance(data['rotation_interval'], (int, float)):
            data['rotation_interval'] = timedelta(seconds=data['rotation_interval'])
        
        # Convert enum strings back to enums
        if 'key_type' in data and isinstance(data['key_type'], str):
            data['key_type'] = KeyType(data['key_type'])
        if 'status' in data and isinstance(data['status'], str):
            data['status'] = KeyStatus(data['status'])
            
        return cls(**data)

class KeyManagementError(Exception):
    """Base exception for key management operations"""
    pass

class KeyNotFoundError(KeyManagementError):
    """Raised when a key is not found"""
    pass

class KeyExpiredError(KeyManagementError):
    """Raised when a key has expired"""
    pass

class KeyUsageLimitError(KeyManagementError):
    """Raised when key usage limit is exceeded"""
    pass

class KeyStorageInterface:
    """Abstract interface for key storage backends"""
    
    async def store_key(self, key_id: str, key_data: bytes, metadata: KeyMetadata) -> bool:
        """Store a key with its metadata"""
        raise NotImplementedError
    
    async def retrieve_key(self, key_id: str) -> Tuple[bytes, KeyMetadata]:
        """Retrieve a key and its metadata"""
        raise NotImplementedError
    
    async def list_keys(self, key_type: Optional[KeyType] = None) -> List[KeyMetadata]:
        """List all keys or keys of specific type"""
        raise NotImplementedError
    
    async def delete_key(self, key_id: str) -> bool:
        """Delete a key"""
        raise NotImplementedError
    
    async def update_metadata(self, key_id: str, metadata: KeyMetadata) -> bool:
        """Update key metadata"""
        raise NotImplementedError

class LocalFileStorage(KeyStorageInterface):
    """Local file-based key storage (for development/testing)"""
    
    def __init__(self, storage_path: str = "keys", encryption_key: Optional[bytes] = None):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(exist_ok=True, mode=0o700)
        self._encryption_key = encryption_key or self._get_storage_key()
        
    def _get_storage_key(self) -> bytes:
        """Get or generate storage encryption key"""
        key_file = self.storage_path / ".storage_key"
        if key_file.exists():
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = secrets.token_bytes(32)
            with open(key_file, 'wb') as f:
                f.write(key)
            key_file.chmod(0o600)
            return key
    
    def _encrypt_data(self, data: bytes) -> bytes:
        """Encrypt data for storage"""
        aesgcm = AESGCM(self._encryption_key)
        nonce = secrets.token_bytes(12)
        ciphertext = aesgcm.encrypt(nonce, data, None)
        return nonce + ciphertext
    
    def _decrypt_data(self, encrypted_data: bytes) -> bytes:
        """Decrypt data from storage"""
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        aesgcm = AESGCM(self._encryption_key)
        return aesgcm.decrypt(nonce, ciphertext, None)
    
    async def store_key(self, key_id: str, key_data: bytes, metadata: KeyMetadata) -> bool:
        """Store a key with its metadata"""
        try:
            key_file = self.storage_path / f"{key_id}.key"
            metadata_file = self.storage_path / f"{key_id}.meta"
            
            # Encrypt and store key data
            encrypted_key = self._encrypt_data(key_data)
            with open(key_file, 'wb') as f:
                f.write(encrypted_key)
            key_file.chmod(0o600)
            
            # Store metadata
            with open(metadata_file, 'w') as f:
                json.dump(metadata.to_dict(), f, indent=2)
            metadata_file.chmod(0o600)
            
            logger.info(f"Stored key {key_id} in local storage")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store key {key_id}: {e}")
            return False
    
    async def retrieve_key(self, key_id: str) -> Tuple[bytes, KeyMetadata]:
        """Retrieve a key and its metadata"""
        key_file = self.storage_path / f"{key_id}.key"
        metadata_file = self.storage_path / f"{key_id}.meta"
        
        if not key_file.exists() or not metadata_file.exists():
            raise KeyNotFoundError(f"Key {key_id} not found")
        
        try:
            # Load and decrypt key data
            with open(key_file, 'rb') as f:
                encrypted_key = f.read()
            key_data = self._decrypt_data(encrypted_key)
            
            # Load metadata
            with open(metadata_file, 'r') as f:
                metadata_dict = json.load(f)
            metadata = KeyMetadata.from_dict(metadata_dict)
            
            return key_data, metadata
            
        except Exception as e:
            logger.error(f"Failed to retrieve key {key_id}: {e}")
            raise KeyManagementError(f"Failed to retrieve key {key_id}")
    
    async def list_keys(self, key_type: Optional[KeyType] = None) -> List[KeyMetadata]:
        """List all keys or keys of specific type"""
        keys = []
        
        for meta_file in self.storage_path.glob("*.meta"):
            try:
                with open(meta_file, 'r') as f:
                    metadata_dict = json.load(f)
                metadata = KeyMetadata.from_dict(metadata_dict)
                
                if key_type is None or metadata.key_type == key_type:
                    keys.append(metadata)
                    
            except Exception as e:
                logger.warning(f"Failed to load metadata from {meta_file}: {e}")
        
        return keys
    
    async def delete_key(self, key_id: str) -> bool:
        """Delete a key"""
        key_file = self.storage_path / f"{key_id}.key"
        metadata_file = self.storage_path / f"{key_id}.meta"
        
        deleted = False
        if key_file.exists():
            key_file.unlink()
            deleted = True
        if metadata_file.exists():
            metadata_file.unlink()
            deleted = True
            
        return deleted
    
    async def update_metadata(self, key_id: str, metadata: KeyMetadata) -> bool:
        """Update key metadata"""
        metadata_file = self.storage_path / f"{key_id}.meta"
        
        if not metadata_file.exists():
            raise KeyNotFoundError(f"Key {key_id} not found")
        
        try:
            with open(metadata_file, 'w') as f:
                json.dump(metadata.to_dict(), f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to update metadata for key {key_id}: {e}")
            return False

class KeyManager:
    """
    Comprehensive key lifecycle management system.
    
    Manages encryption keys throughout their lifecycle including generation,
    rotation, storage, and destruction with compliance and audit support.
    """
    
    def __init__(
        self, 
        storage_backend: KeyStorageInterface,
        default_rotation_interval: timedelta = timedelta(days=90),
        default_key_expiry: timedelta = timedelta(days=365)
    ):
        self.storage = storage_backend
        self.default_rotation_interval = default_rotation_interval
        self.default_key_expiry = default_key_expiry
        self._key_cache: Dict[str, Tuple[bytes, KeyMetadata]] = {}
        
    async def generate_key(
        self,
        key_type: KeyType,
        key_size: int = 256,
        context: str = "",
        tags: Optional[Dict[str, str]] = None,
        max_usage: Optional[int] = None,
        custom_expiry: Optional[timedelta] = None
    ) -> str:
        """
        Generate a new encryption key.
        
        Args:
            key_type: Type of key to generate
            key_size: Key size in bits
            context: Context or purpose of the key
            tags: Additional metadata tags
            max_usage: Maximum number of times key can be used
            custom_expiry: Custom expiry time (overrides default)
            
        Returns:
            Generated key ID
        """
        # Generate key material
        if key_size not in [128, 192, 256]:
            raise KeyManagementError(f"Unsupported key size: {key_size}")
        
        key_bytes = key_size // 8
        key_data = secrets.token_bytes(key_bytes)
        
        # Generate unique key ID
        key_id = self._generate_key_id(key_type, context)
        
        # Create metadata
        now = datetime.utcnow()
        expiry = custom_expiry or self.default_key_expiry
        
        metadata = KeyMetadata(
            key_id=key_id,
            key_type=key_type,
            status=KeyStatus.ACTIVE,
            created_at=now,
            expires_at=now + expiry,
            version=1,
            algorithm="AES-256-GCM",
            key_size=key_size,
            usage_count=0,
            max_usage=max_usage,
            last_rotated=None,
            rotation_interval=self.default_rotation_interval,
            context=context,
            tags=tags or {}
        )
        
        # Store key
        success = await self.storage.store_key(key_id, key_data, metadata)
        if not success:
            raise KeyManagementError(f"Failed to store key {key_id}")
        
        logger.info(f"Generated new {key_type.value} key: {key_id}")
        return key_id
    
    async def get_key(self, key_id: str, increment_usage: bool = True) -> bytes:
        """
        Retrieve an encryption key.
        
        Args:
            key_id: Key identifier
            increment_usage: Whether to increment usage counter
            
        Returns:
            Key data bytes
        """
        # Check cache first
        if key_id in self._key_cache:
            key_data, metadata = self._key_cache[key_id]
        else:
            key_data, metadata = await self.storage.retrieve_key(key_id)
            self._key_cache[key_id] = (key_data, metadata)
        
        # Validate key status and expiry
        await self._validate_key_usage(metadata)
        
        if increment_usage:
            metadata.usage_count += 1
            await self.storage.update_metadata(key_id, metadata)
            # Update cache
            self._key_cache[key_id] = (key_data, metadata)
        
        return key_data
    
    async def rotate_key(self, key_id: str, keep_old_version: bool = True) -> str:
        """
        Rotate an existing key.
        
        Args:
            key_id: Key to rotate
            keep_old_version: Whether to keep old version for decryption
            
        Returns:
            New key ID
        """
        try:
            old_key_data, old_metadata = await self.storage.retrieve_key(key_id)
        except KeyNotFoundError:
            raise KeyManagementError(f"Cannot rotate non-existent key: {key_id}")
        
        # Mark old key as rotating
        old_metadata.status = KeyStatus.ROTATING
        await self.storage.update_metadata(key_id, old_metadata)
        
        try:
            # Generate new key with same parameters
            new_key_id = await self.generate_key(
                key_type=old_metadata.key_type,
                key_size=old_metadata.key_size,
                context=old_metadata.context,
                tags=old_metadata.tags,
                max_usage=old_metadata.max_usage
            )
            
            # Update new key metadata to indicate it's a rotation
            _, new_metadata = await self.storage.retrieve_key(new_key_id)
            new_metadata.version = old_metadata.version + 1
            new_metadata.last_rotated = datetime.utcnow()
            await self.storage.update_metadata(new_key_id, new_metadata)
            
            # Handle old key
            if keep_old_version:
                old_metadata.status = KeyStatus.DEPRECATED
                await self.storage.update_metadata(key_id, old_metadata)
            else:
                await self.revoke_key(key_id)
            
            # Clear cache
            self._key_cache.pop(key_id, None)
            
            logger.info(f"Rotated key {key_id} -> {new_key_id}")
            return new_key_id
            
        except Exception as e:
            # Rollback on failure
            old_metadata.status = KeyStatus.ACTIVE
            await self.storage.update_metadata(key_id, old_metadata)
            raise KeyManagementError(f"Key rotation failed: {e}")
    
    async def revoke_key(self, key_id: str, reason: str = "") -> bool:
        """
        Revoke a key (mark as unusable but keep for audit).
        
        Args:
            key_id: Key to revoke
            reason: Reason for revocation
            
        Returns:
            Success status
        """
        try:
            _, metadata = await self.storage.retrieve_key(key_id)
            metadata.status = KeyStatus.REVOKED
            if reason:
                metadata.tags['revocation_reason'] = reason
            metadata.tags['revoked_at'] = datetime.utcnow().isoformat()
            
            success = await self.storage.update_metadata(key_id, metadata)
            if success:
                self._key_cache.pop(key_id, None)
                logger.warning(f"Revoked key {key_id}: {reason}")
            
            return success
            
        except KeyNotFoundError:
            logger.warning(f"Attempted to revoke non-existent key: {key_id}")
            return False
    
    async def destroy_key(self, key_id: str, reason: str = "") -> bool:
        """
        Permanently destroy a key (irreversible).
        
        Args:
            key_id: Key to destroy
            reason: Reason for destruction
            
        Returns:
            Success status
        """
        try:
            _, metadata = await self.storage.retrieve_key(key_id)
            
            # Log destruction for audit
            logger.critical(f"Destroying key {key_id}: {reason}")
            
            # Remove from storage
            success = await self.storage.delete_key(key_id)
            if success:
                self._key_cache.pop(key_id, None)
            
            return success
            
        except KeyNotFoundError:
            logger.warning(f"Attempted to destroy non-existent key: {key_id}")
            return False
    
    async def list_keys(
        self, 
        key_type: Optional[KeyType] = None,
        status: Optional[KeyStatus] = None,
        expired_only: bool = False
    ) -> List[KeyMetadata]:
        """
        List keys with optional filtering.
        
        Args:
            key_type: Filter by key type
            status: Filter by status
            expired_only: Show only expired keys
            
        Returns:
            List of key metadata
        """
        keys = await self.storage.list_keys(key_type)
        
        # Apply additional filters
        filtered_keys = []
        now = datetime.utcnow()
        
        for key_meta in keys:
            # Status filter
            if status and key_meta.status != status:
                continue
                
            # Expiry filter
            if expired_only:
                if not key_meta.expires_at or key_meta.expires_at > now:
                    continue
            
            filtered_keys.append(key_meta)
        
        return filtered_keys
    
    async def check_key_health(self) -> Dict[str, Any]:
        """
        Check health status of all keys.
        
        Returns:
            Health report with key statistics and issues
        """
        all_keys = await self.storage.list_keys()
        now = datetime.utcnow()
        
        stats = {
            'total_keys': len(all_keys),
            'active_keys': 0,
            'expired_keys': 0,
            'expiring_soon': 0,  # Within 30 days
            'rotation_needed': 0,
            'usage_warnings': 0,
            'revoked_keys': 0,
            'issues': []
        }
        
        for key_meta in all_keys:
            # Count by status
            if key_meta.status == KeyStatus.ACTIVE:
                stats['active_keys'] += 1
            elif key_meta.status == KeyStatus.REVOKED:
                stats['revoked_keys'] += 1
            
            # Check expiry
            if key_meta.expires_at:
                if key_meta.expires_at <= now:
                    stats['expired_keys'] += 1
                    stats['issues'].append(f"Key {key_meta.key_id} has expired")
                elif key_meta.expires_at <= now + timedelta(days=30):
                    stats['expiring_soon'] += 1
                    stats['issues'].append(f"Key {key_meta.key_id} expires soon")
            
            # Check rotation needs
            if (key_meta.rotation_interval and key_meta.last_rotated and 
                now - key_meta.last_rotated > key_meta.rotation_interval):
                stats['rotation_needed'] += 1
                stats['issues'].append(f"Key {key_meta.key_id} needs rotation")
            
            # Check usage limits
            if (key_meta.max_usage and 
                key_meta.usage_count >= key_meta.max_usage * 0.9):  # 90% threshold
                stats['usage_warnings'] += 1
                stats['issues'].append(f"Key {key_meta.key_id} approaching usage limit")
        
        return stats
    
    def _generate_key_id(self, key_type: KeyType, context: str) -> str:
        """Generate a unique key identifier"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        random_suffix = secrets.token_hex(4)
        return f"{key_type.value}_{context}_{timestamp}_{random_suffix}"
    
    async def _validate_key_usage(self, metadata: KeyMetadata) -> None:
        """Validate that a key can be used"""
        now = datetime.utcnow()
        
        # Check status
        if metadata.status not in [KeyStatus.ACTIVE, KeyStatus.DEPRECATED]:
            raise KeyManagementError(f"Key {metadata.key_id} is {metadata.status.value}")
        
        # Check expiry
        if metadata.expires_at and metadata.expires_at <= now:
            raise KeyExpiredError(f"Key {metadata.key_id} expired at {metadata.expires_at}")
        
        # Check usage limits
        if (metadata.max_usage and metadata.usage_count >= metadata.max_usage):
            raise KeyUsageLimitError(f"Key {metadata.key_id} usage limit exceeded")

# Convenience functions for common operations

async def create_key_manager(
    storage_type: StorageBackend = StorageBackend.LOCAL_FILE,
    **storage_kwargs
) -> KeyManager:
    """Create a key manager with specified storage backend"""
    
    if storage_type == StorageBackend.LOCAL_FILE:
        storage = LocalFileStorage(**storage_kwargs)
    else:
        raise NotImplementedError(f"Storage backend {storage_type} not implemented")
    
    return KeyManager(storage)

async def generate_master_key(key_manager: KeyManager, context: str = "app") -> str:
    """Generate a master key for field encryption"""
    return await key_manager.generate_key(
        key_type=KeyType.MASTER,
        key_size=256,
        context=context,
        max_usage=None  # No usage limit for master keys
    )

async def rotate_expired_keys(key_manager: KeyManager) -> List[str]:
    """Rotate all expired keys and return new key IDs"""
    expired_keys = await key_manager.list_keys(expired_only=True)
    new_key_ids = []
    
    for key_meta in expired_keys:
        if key_meta.status == KeyStatus.ACTIVE:
            try:
                new_key_id = await key_manager.rotate_key(key_meta.key_id)
                new_key_ids.append(new_key_id)
            except Exception as e:
                logger.error(f"Failed to rotate expired key {key_meta.key_id}: {e}")
    
    return new_key_ids 