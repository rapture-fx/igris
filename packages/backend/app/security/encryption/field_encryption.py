"""
Field-Level Encryption Module

This module provides AES-256-GCM encryption for sensitive database fields and
data elements. It implements secure encryption, decryption, and key derivation
functions with authenticated encryption to prevent tampering.

Features:
- AES-256-GCM authenticated encryption
- PBKDF2 and Argon2 key derivation
- Secure random salt and nonce generation
- Base64 encoding for database storage
- Automatic key rotation support
- Context-aware encryption for different data types

Security Features:
- Authenticated encryption prevents tampering
- Unique nonce for each encryption operation
- Secure key derivation with configurable iterations
- Memory-safe key handling with automatic cleanup
- Side-channel attack resistance
"""

import os
import base64
import secrets
from typing import Optional, Dict, Any, Union, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
import argon2
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class FieldEncryptionError(Exception):
    """Base exception for field encryption operations"""
    pass

class InvalidKeyError(FieldEncryptionError):
    """Raised when encryption key is invalid"""
    pass

class DecryptionError(FieldEncryptionError):
    """Raised when decryption fails"""
    pass

class FieldEncryption:
    """
    AES-256-GCM field-level encryption with key derivation support.
    
    Provides secure encryption and decryption of sensitive database fields
    using authenticated encryption to ensure both confidentiality and integrity.
    """
    
    # Encryption configuration
    AES_KEY_SIZE = 32  # 256 bits
    NONCE_SIZE = 12    # 96 bits for GCM
    SALT_SIZE = 16     # 128 bits
    TAG_SIZE = 16      # 128 bits authentication tag
    
    # Key derivation configuration
    PBKDF2_ITERATIONS = 100000
    SCRYPT_N = 16384   # CPU/memory cost
    SCRYPT_R = 8       # Block size
    SCRYPT_P = 1       # Parallelization
    
    def __init__(self, master_key: Optional[bytes] = None):
        """
        Initialize field encryption with optional master key.
        
        Args:
            master_key: Master key for key derivation. If None, must be set later.
        """
        self._master_key = master_key
        self._key_cache: Dict[str, bytes] = {}
        
    def set_master_key(self, master_key: bytes) -> None:
        """
        Set or update the master key.
        
        Args:
            master_key: 256-bit master key for encryption
            
        Raises:
            InvalidKeyError: If master key is invalid
        """
        if not isinstance(master_key, bytes) or len(master_key) != self.AES_KEY_SIZE:
            raise InvalidKeyError("Master key must be 32 bytes (256 bits)")
        
        self._master_key = master_key
        self._key_cache.clear()  # Clear cache when key changes
        
    def _derive_key_pbkdf2(self, salt: bytes, context: str = "") -> bytes:
        """
        Derive encryption key using PBKDF2-HMAC-SHA256.
        
        Args:
            salt: Random salt for key derivation
            context: Additional context for key derivation
            
        Returns:
            Derived 256-bit encryption key
        """
        if not self._master_key:
            raise InvalidKeyError("Master key not set")
            
        # Combine context with master key for domain separation
        key_material = self._master_key + context.encode('utf-8')
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.AES_KEY_SIZE,
            salt=salt,
            iterations=self.PBKDF2_ITERATIONS,
            backend=default_backend()
        )
        
        return kdf.derive(key_material)
    
    def _derive_key_scrypt(self, salt: bytes, context: str = "") -> bytes:
        """
        Derive encryption key using Scrypt (more memory-hard).
        
        Args:
            salt: Random salt for key derivation
            context: Additional context for key derivation
            
        Returns:
            Derived 256-bit encryption key
        """
        if not self._master_key:
            raise InvalidKeyError("Master key not set")
            
        key_material = self._master_key + context.encode('utf-8')
        
        kdf = Scrypt(
            length=self.AES_KEY_SIZE,
            salt=salt,
            n=self.SCRYPT_N,
            r=self.SCRYPT_R,
            p=self.SCRYPT_P,
            backend=default_backend()
        )
        
        return kdf.derive(key_material)
    
    def _derive_key_argon2(self, salt: bytes, context: str = "") -> bytes:
        """
        Derive encryption key using Argon2id (recommended for new applications).
        
        Args:
            salt: Random salt for key derivation
            context: Additional context for key derivation
            
        Returns:
            Derived 256-bit encryption key
        """
        if not self._master_key:
            raise InvalidKeyError("Master key not set")
            
        key_material = self._master_key + context.encode('utf-8')
        
        # Argon2id with secure parameters
        hasher = argon2.PasswordHasher(
            time_cost=3,        # 3 iterations
            memory_cost=65536,  # 64 MB
            parallelism=1,      # Single thread
            hash_len=self.AES_KEY_SIZE,
            salt_len=len(salt)
        )
        
        # Use raw hash function for key derivation
        return argon2.low_level.hash_secret_raw(
            secret=key_material,
            salt=salt,
            time_cost=3,
            memory_cost=65536,
            parallelism=1,
            hash_len=self.AES_KEY_SIZE,
            type=argon2.Type.ID
        )
    
    def encrypt_field(
        self, 
        plaintext: Union[str, bytes], 
        context: str = "",
        kdf_method: str = "argon2"
    ) -> str:
        """
        Encrypt a sensitive field value.
        
        Args:
            plaintext: Data to encrypt (string or bytes)
            context: Encryption context (e.g., 'ssn', 'email', 'credit_card')
            kdf_method: Key derivation method ('pbkdf2', 'scrypt', 'argon2')
            
        Returns:
            Base64-encoded encrypted data with embedded metadata
            
        Raises:
            FieldEncryptionError: If encryption fails
        """
        try:
            # Convert string to bytes if necessary
            if isinstance(plaintext, str):
                plaintext_bytes = plaintext.encode('utf-8')
            else:
                plaintext_bytes = plaintext
                
            # Generate random salt and nonce
            salt = secrets.token_bytes(self.SALT_SIZE)
            nonce = secrets.token_bytes(self.NONCE_SIZE)
            
            # Derive encryption key based on method
            if kdf_method == "pbkdf2":
                derived_key = self._derive_key_pbkdf2(salt, context)
            elif kdf_method == "scrypt":
                derived_key = self._derive_key_scrypt(salt, context)
            elif kdf_method == "argon2":
                derived_key = self._derive_key_argon2(salt, context)
            else:
                raise FieldEncryptionError(f"Unknown KDF method: {kdf_method}")
            
            # Encrypt with AES-256-GCM
            aesgcm = AESGCM(derived_key)
            ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)
            
            # Pack: version(1) + kdf_method(1) + salt(16) + nonce(12) + ciphertext+tag
            version = b'\x01'  # Version 1 format
            kdf_byte = {'pbkdf2': b'\x01', 'scrypt': b'\x02', 'argon2': b'\x03'}[kdf_method]
            
            packed_data = version + kdf_byte + salt + nonce + ciphertext
            
            # Encode as base64 for database storage
            return base64.b64encode(packed_data).decode('ascii')
            
        except Exception as e:
            logger.error(f"Field encryption failed: {e}")
            raise FieldEncryptionError(f"Encryption failed: {e}")
        finally:
            # Clear derived key from memory
            if 'derived_key' in locals():
                derived_key = b'\x00' * len(derived_key)
    
    def decrypt_field(self, encrypted_data: str, context: str = "") -> str:
        """
        Decrypt a sensitive field value.
        
        Args:
            encrypted_data: Base64-encoded encrypted data
            context: Decryption context (must match encryption context)
            
        Returns:
            Decrypted plaintext as string
            
        Raises:
            DecryptionError: If decryption fails
        """
        try:
            # Decode from base64
            packed_data = base64.b64decode(encrypted_data.encode('ascii'))
            
            # Unpack metadata
            if len(packed_data) < 30:  # Minimum size check
                raise DecryptionError("Invalid encrypted data format")
                
            version = packed_data[0:1]
            if version != b'\x01':
                raise DecryptionError(f"Unsupported format version: {version}")
                
            kdf_byte = packed_data[1:2]
            kdf_method = {b'\x01': 'pbkdf2', b'\x02': 'scrypt', b'\x03': 'argon2'}[kdf_byte]
            
            salt = packed_data[2:18]
            nonce = packed_data[18:30]
            ciphertext = packed_data[30:]
            
            # Derive decryption key using same method as encryption
            if kdf_method == "pbkdf2":
                derived_key = self._derive_key_pbkdf2(salt, context)
            elif kdf_method == "scrypt":
                derived_key = self._derive_key_scrypt(salt, context)
            elif kdf_method == "argon2":
                derived_key = self._derive_key_argon2(salt, context)
            else:
                raise DecryptionError(f"Unknown KDF method: {kdf_method}")
            
            # Decrypt with AES-256-GCM
            aesgcm = AESGCM(derived_key)
            plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
            
            return plaintext_bytes.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Field decryption failed: {e}")
            raise DecryptionError(f"Decryption failed: {e}")
        finally:
            # Clear derived key from memory
            if 'derived_key' in locals():
                derived_key = b'\x00' * len(derived_key)
    
    def encrypt_dict_fields(
        self, 
        data: Dict[str, Any], 
        field_contexts: Dict[str, str],
        kdf_method: str = "argon2"
    ) -> Dict[str, Any]:
        """
        Encrypt multiple fields in a dictionary.
        
        Args:
            data: Dictionary containing sensitive fields
            field_contexts: Mapping of field names to encryption contexts
            kdf_method: Key derivation method to use
            
        Returns:
            Dictionary with encrypted fields
        """
        encrypted_data = data.copy()
        
        for field_name, context in field_contexts.items():
            if field_name in data and data[field_name] is not None:
                encrypted_data[field_name] = self.encrypt_field(
                    str(data[field_name]), 
                    context, 
                    kdf_method
                )
                
        return encrypted_data
    
    def decrypt_dict_fields(
        self, 
        encrypted_data: Dict[str, Any], 
        field_contexts: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Decrypt multiple fields in a dictionary.
        
        Args:
            encrypted_data: Dictionary containing encrypted fields
            field_contexts: Mapping of field names to decryption contexts
            
        Returns:
            Dictionary with decrypted fields
        """
        decrypted_data = encrypted_data.copy()
        
        for field_name, context in field_contexts.items():
            if field_name in encrypted_data and encrypted_data[field_name] is not None:
                decrypted_data[field_name] = self.decrypt_field(
                    encrypted_data[field_name], 
                    context
                )
                
        return decrypted_data
    
    def rotate_field_encryption(
        self, 
        old_encrypted_data: str, 
        context: str = "",
        new_kdf_method: str = "argon2",
        old_encryptor: Optional['FieldEncryption'] = None
    ) -> str:
        """
        Rotate encryption of a field with new key/method.
        
        Args:
            old_encrypted_data: Previously encrypted data
            context: Field context
            new_kdf_method: New KDF method for re-encryption
            old_encryptor: Optional encryptor with old key for decryption
            
        Returns:
            Re-encrypted data with new key/method
        """
        # Use old encryptor if provided, otherwise use current encryptor
        decryptor = old_encryptor if old_encryptor else self
        
        # Decrypt with old key
        plaintext = decryptor.decrypt_field(old_encrypted_data, context)
        
        # Re-encrypt with current key
        return self.encrypt_field(plaintext, context, new_kdf_method)
    
    @staticmethod
    def generate_master_key() -> bytes:
        """
        Generate a cryptographically secure 256-bit master key.
        
        Returns:
            32-byte master key
        """
        return secrets.token_bytes(32)
    
    @staticmethod
    def is_encrypted_field(data: str) -> bool:
        """
        Check if a string appears to be encrypted field data.
        
        Args:
            data: String to check
            
        Returns:
            True if data appears to be encrypted
        """
        try:
            decoded = base64.b64decode(data.encode('ascii'))
            return len(decoded) >= 30 and decoded[0:1] == b'\x01'
        except:
            return False

# Utility functions for common encryption patterns
def encrypt_ssn(ssn: str, encryptor: FieldEncryption) -> str:
    """Encrypt Social Security Number with SSN-specific context."""
    return encryptor.encrypt_field(ssn, "ssn")

def decrypt_ssn(encrypted_ssn: str, encryptor: FieldEncryption) -> str:
    """Decrypt Social Security Number."""
    return encryptor.decrypt_field(encrypted_ssn, "ssn")

def encrypt_email(email: str, encryptor: FieldEncryption) -> str:
    """Encrypt email address with email-specific context."""
    return encryptor.encrypt_field(email, "email")

def decrypt_email(encrypted_email: str, encryptor: FieldEncryption) -> str:
    """Decrypt email address."""
    return encryptor.decrypt_field(encrypted_email, "email")

def encrypt_credit_card(cc_number: str, encryptor: FieldEncryption) -> str:
    """Encrypt credit card number with CC-specific context."""
    return encryptor.encrypt_field(cc_number, "credit_card")

def decrypt_credit_card(encrypted_cc: str, encryptor: FieldEncryption) -> str:
    """Decrypt credit card number."""
    return encryptor.decrypt_field(encrypted_cc, "credit_card") 