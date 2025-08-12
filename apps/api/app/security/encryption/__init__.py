"""
Security Encryption Module

This module provides comprehensive encryption capabilities for the Schlep-engine platform:

1. Field-Level Encryption (field_encryption.py):
   - AES-256-GCM authenticated encryption
   - Context-aware encryption for different data types
   - Key derivation with PBKDF2, Scrypt, and Argon2
   - Automatic key rotation support

2. Key Management (key_management.py):
   - Comprehensive key lifecycle management
   - Automated key rotation with rollback support
   - Multiple storage backends (local, HSM, cloud)
   - Key usage tracking and compliance logging

3. PII Detection (pii_detector.py):
   - Pattern-based PII detection with validation
   - Data classification with sensitivity levels
   - Multiple masking strategies
   - GDPR/CCPA/HIPAA compliance support

Usage Examples:

Field Encryption:
    from app.security.encryption import FieldEncryption
    
    encryptor = FieldEncryption()
    master_key = FieldEncryption.generate_master_key()
    encryptor.set_master_key(master_key)
    
    encrypted = encryptor.encrypt_field("sensitive@example.com", "email")
    decrypted = encryptor.decrypt_field(encrypted, "email")

Key Management:
    from app.security.encryption import create_key_manager, generate_master_key
    
    key_manager = await create_key_manager()
    key_id = await generate_master_key(key_manager, "app")
    key_data = await key_manager.get_key(key_id)

PII Detection:
    from app.security.encryption import PIIDetector, quick_pii_scan
    
    detector = PIIDetector()
    classification = detector.classify_data("SSN: 123-45-6789")
    masked_text, _ = detector.mask_pii("SSN: 123-45-6789")

Integration Example:
    # Detect PII, then encrypt sensitive fields
    detector = PIIDetector()
    encryptor = FieldEncryption()
    
    # Classify data
    data = {"email": "user@example.com", "ssn": "123-45-6789"}
    classification = detector.classify_data(str(data))
    
    # Encrypt sensitive fields
    sensitive_fields = {"email": "email", "ssn": "ssn"}
    encrypted_data = encryptor.encrypt_dict_fields(data, sensitive_fields)
"""

# Field Encryption
from .field_encryption import (
    FieldEncryption,
    FieldEncryptionError,
    InvalidKeyError,
    DecryptionError,
    encrypt_ssn,
    decrypt_ssn,
    encrypt_email,
    decrypt_email,
    encrypt_credit_card,
    decrypt_credit_card
)

# Key Management
from .key_management import (
    KeyManager,
    KeyMetadata,
    KeyType,
    KeyStatus,
    StorageBackend,
    KeyManagementError,
    KeyNotFoundError,
    KeyExpiredError,
    KeyUsageLimitError,
    LocalFileStorage,
    create_key_manager,
    generate_master_key,
    rotate_expired_keys
)

# PII Detection
from .pii_detector import (
    PIIDetector,
    PIIPattern,
    PIIMatch,
    ClassificationResult,
    PIIType,
    SensitivityLevel,
    MaskingStrategy,
    PIIDetectionError,
    create_pii_detector,
    quick_pii_scan,
    mask_sensitive_data,
    anonymize_dataset
)

__all__ = [
    # Field Encryption
    'FieldEncryption',
    'FieldEncryptionError',
    'InvalidKeyError', 
    'DecryptionError',
    'encrypt_ssn',
    'decrypt_ssn',
    'encrypt_email',
    'decrypt_email',
    'encrypt_credit_card',
    'decrypt_credit_card',
    
    # Key Management
    'KeyManager',
    'KeyMetadata',
    'KeyType',
    'KeyStatus',
    'StorageBackend',
    'KeyManagementError',
    'KeyNotFoundError',
    'KeyExpiredError',
    'KeyUsageLimitError',
    'LocalFileStorage',
    'create_key_manager',
    'generate_master_key',
    'rotate_expired_keys',
    
    # PII Detection
    'PIIDetector',
    'PIIPattern',
    'PIIMatch',
    'ClassificationResult',
    'PIIType',
    'SensitivityLevel',
    'MaskingStrategy',
    'PIIDetectionError',
    'create_pii_detector',
    'quick_pii_scan',
    'mask_sensitive_data',
    'anonymize_dataset'
]

# Version info
__version__ = '1.0.0'
__author__ = 'Schlep-engine Security Team'
__description__ = 'Comprehensive encryption and PII protection module'

from typing import Dict, Any, List, Optional
from enum import Enum

class EncryptionAlgorithm(Enum):
    """Supported encryption algorithms"""
    AES_256_GCM = "aes_256_gcm"
    AES_256_CBC = "aes_256_cbc"
    AES_256_CTR = "aes_256_ctr"
    CHACHA20_POLY1305 = "chacha20_poly1305"
    RSA_4096 = "rsa_4096"
    ECC_P384 = "ecc_p384"
    ED25519 = "ed25519"

class HashAlgorithm(Enum):
    """Supported hashing algorithms"""
    SHA3_256 = "sha3_256"
    SHA3_512 = "sha3_512"
    BLAKE3 = "blake3"
    ARGON2ID = "argon2id"
    PBKDF2 = "pbkdf2"
    SCRYPT = "scrypt"

class EncryptionContext(Enum):
    """Data encryption contexts"""
    AT_REST = "at_rest"           # Database and file storage
    IN_TRANSIT = "in_transit"     # Network communications
    IN_MEMORY = "in_memory"       # Runtime data processing
    FIELD_LEVEL = "field_level"   # Selective column encryption
    BACKUP = "backup"             # Backup and archival data

# Encryption configuration defaults
ENCRYPTION_DEFAULTS = {
    "default_algorithm": EncryptionAlgorithm.AES_256_GCM,
    "key_rotation_days": 90,
    "master_key_rotation_days": 365,
    "min_key_size": 256,
    "max_key_age_hours": 8760,  # 1 year
    "secure_delete_passes": 3,
    "entropy_sources": ["hardware", "os", "user"]
}

# Key management policies
KEY_POLICIES = {
    "generation": {
        "require_hsm": True,
        "min_entropy_bits": 256,
        "key_derivation_iterations": 100000
    },
    "storage": {
        "encrypt_at_rest": True,
        "require_authentication": True,
        "backup_encryption": True
    },
    "rotation": {
        "automatic": True,
        "usage_threshold": 1000000,  # operations
        "time_threshold_days": 90
    },
    "destruction": {
        "secure_delete": True,
        "verification_required": True,
        "audit_retention_days": 2555  # 7 years
    }
}

# Compliance standards supported
COMPLIANCE_STANDARDS = {
    "fips_140_2": {
        "level": 3,
        "validated_modules": True,
        "tamper_resistance": True
    },
    "common_criteria": {
        "evaluation_level": "EAL4+",
        "protection_profile": "General Purpose OS"
    },
    "nist_guidelines": [
        "SP 800-57 (Key Management)",
        "SP 800-38D (GCM Mode)",
        "SP 800-108 (Key Derivation)"
    ]
}

def get_encryption_config() -> Dict[str, Any]:
    """
    Get encryption module configuration.
    
    Returns:
        Dict containing encryption settings and capabilities
    """
    return {
        "version": __version__,
        "algorithms": [alg.value for alg in EncryptionAlgorithm],
        "hash_algorithms": [hash_alg.value for hash_alg in HashAlgorithm],
        "contexts": [ctx.value for ctx in EncryptionContext],
        "defaults": ENCRYPTION_DEFAULTS,
        "policies": KEY_POLICIES,
        "compliance": COMPLIANCE_STANDARDS,
        "status": "ready_for_implementation"
    }

def validate_key_strength(key_size: int, algorithm: EncryptionAlgorithm) -> bool:
    """
    Validate cryptographic key strength requirements.
    
    Args:
        key_size: Key size in bits
        algorithm: Encryption algorithm
        
    Returns:
        True if key meets minimum strength requirements
    """
    min_sizes = {
        EncryptionAlgorithm.AES_256_GCM: 256,
        EncryptionAlgorithm.AES_256_CBC: 256,
        EncryptionAlgorithm.AES_256_CTR: 256,
        EncryptionAlgorithm.CHACHA20_POLY1305: 256,
        EncryptionAlgorithm.RSA_4096: 4096,
        EncryptionAlgorithm.ECC_P384: 384,
        EncryptionAlgorithm.ED25519: 256
    }
    
    return key_size >= min_sizes.get(algorithm, 256)

# Future class imports will be added here
# from .data_encryption import DataEncryption
# from .hsm_provider import HSMProvider
# from .crypto_utils import CryptoUtils
# from .key_rotation import KeyRotationManager
# from .secure_delete import SecureDeleteManager 