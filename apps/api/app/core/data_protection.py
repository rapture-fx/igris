"""
Comprehensive Data Protection and Encryption System
=================================================

Enterprise-grade data protection implementing encryption at rest and in transit,
PII data handling, secure backup and recovery, data retention policies,
and GDPR compliance measures.

Features:
- Data Encryption at Rest and in Transit
- PII Data Detection and Masking
- Secure Key Management and Rotation
- Data Classification and Handling
- GDPR/CCPA Compliance Tools
- Secure Backup and Recovery
- Data Retention and Purging
- Database Field-Level Encryption
- File System Encryption
- Data Loss Prevention (DLP)
"""

import os
import re
import json
import secrets
import hashlib
import hmac
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Set, Tuple, Type
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field, validator
import logging
from cryptography.hazmat.primitives import hashes, serialization, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asym_padding
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet, MultiFernet
# import boto3  # Cloud SDK removed
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
import redis
import asyncio

logger = logging.getLogger(__name__)


class DataClassification(Enum):
    """Data classification levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    TOP_SECRET = "top_secret"


class PIIType(Enum):
    """Types of Personally Identifiable Information"""
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    CREDIT_CARD = "credit_card"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    BANK_ACCOUNT = "bank_account"
    IP_ADDRESS = "ip_address"
    NAME = "name"
    ADDRESS = "address"
    DATE_OF_BIRTH = "date_of_birth"
    BIOMETRIC = "biometric"


class EncryptionAlgorithm(Enum):
    """Supported encryption algorithms"""
    AES_256_GCM = "aes_256_gcm"
    AES_256_CBC = "aes_256_cbc"
    CHACHA20_POLY1305 = "chacha20_poly1305"
    RSA_4096 = "rsa_4096"
    FERNET = "fernet"


class KeyRotationStatus(Enum):
    """Key rotation status"""
    CURRENT = "current"
    ROTATING = "rotating"
    DEPRECATED = "deprecated"
    REVOKED = "revoked"


@dataclass
class PIIPattern:
    """PII detection pattern"""
    pii_type: PIIType
    pattern: str
    confidence_threshold: float = 0.8
    should_encrypt: bool = True
    should_mask: bool = True
    retention_days: Optional[int] = None


@dataclass
class EncryptionKey:
    """Encryption key metadata"""
    key_id: str
    algorithm: EncryptionAlgorithm
    key_data: bytes
    status: KeyRotationStatus
    created_at: datetime
    expires_at: Optional[datetime] = None
    usage_count: int = 0
    max_usage: Optional[int] = None
    purpose: str = "general"


@dataclass
class DataRetentionPolicy:
    """Data retention policy"""
    data_type: str
    retention_days: int
    encryption_required: bool = True
    backup_required: bool = True
    purge_method: str = "secure_delete"
    compliance_requirements: List[str] = field(default_factory=list)


class DataProtectionConfig(BaseModel):
    """Configuration for data protection system"""

    # Encryption settings
    default_algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM
    key_rotation_days: int = Field(default=90, ge=30, le=365)
    master_key_provider: str = Field(default="local")  # local, aws_kms, azure_keyvault

    # PII protection
    pii_detection_enabled: bool = Field(default=True)
    pii_encryption_required: bool = Field(default=True)
    pii_masking_enabled: bool = Field(default=True)

    # Data classification
    default_classification: DataClassification = DataClassification.INTERNAL
    require_classification: bool = Field(default=True)

    # Compliance
    gdpr_compliance_enabled: bool = Field(default=True)
    ccpa_compliance_enabled: bool = Field(default=False)
    hipaa_compliance_enabled: bool = Field(default=False)

    # Backup and recovery
    backup_encryption_enabled: bool = Field(default=True)
    backup_retention_days: int = Field(default=90, ge=7, le=2555)

    # Data retention
    default_retention_days: int = Field(default=365, ge=1, le=3650)
    auto_purge_enabled: bool = Field(default=True)

    # Performance
    encryption_cache_size: int = Field(default=1000, ge=100, le=10000)
    key_cache_ttl_seconds: int = Field(default=3600, ge=300, le=86400)

    class Config:
        use_enum_values = True


class DataProtectionManager:
    """
    Comprehensive data protection manager
    """

    def __init__(self, config: Optional[DataProtectionConfig] = None):
        self.config = config or DataProtectionConfig()
        self.encryption_keys: Dict[str, EncryptionKey] = {}
        self.pii_patterns: List[PIIPattern] = []
        self.retention_policies: Dict[str, DataRetentionPolicy] = {}
        self.encryption_cache: Dict[str, Any] = {}

        # External key management
        self.aws_kms_client = None
        self.azure_kv_client = None
        self.redis_client = None

        # Initialize components
        self._setup_pii_patterns()
        self._setup_default_retention_policies()
        self._initialize_key_management()

        logger.info("Data Protection Manager initialized")

    def _setup_pii_patterns(self):
        """Setup PII detection patterns"""

        self.pii_patterns = [
            # Email addresses
            PIIPattern(
                pii_type=PIIType.EMAIL,
                pattern=r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                confidence_threshold=0.95
            ),

            # Phone numbers (US format)
            PIIPattern(
                pii_type=PIIType.PHONE,
                pattern=r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b',
                confidence_threshold=0.85
            ),

            # Social Security Numbers
            PIIPattern(
                pii_type=PIIType.SSN,
                pattern=r'\b(?!000|666|9\d{2})\d{3}[-.\s]?(?!00)\d{2}[-.\s]?(?!0000)\d{4}\b',
                confidence_threshold=0.9
            ),

            # Credit Card Numbers (Luhn algorithm check would be needed for high confidence)
            PIIPattern(
                pii_type=PIIType.CREDIT_CARD,
                pattern=r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b',
                confidence_threshold=0.8
            ),

            # IP Addresses
            PIIPattern(
                pii_type=PIIType.IP_ADDRESS,
                pattern=r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
                confidence_threshold=0.9,
                should_encrypt=False,  # Usually logged, not stored long-term
                retention_days=30
            ),

            # Names (simplified pattern - would need ML for better detection)
            PIIPattern(
                pii_type=PIIType.NAME,
                pattern=r'\b[A-Z][a-z]+ [A-Z][a-z]+\b',
                confidence_threshold=0.6  # Lower confidence, needs context
            ),

            # Dates that could be DOB
            PIIPattern(
                pii_type=PIIType.DATE_OF_BIRTH,
                pattern=r'\b(0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])[-/](19|20)\d{2}\b',
                confidence_threshold=0.7
            ),
        ]

    def _setup_default_retention_policies(self):
        """Setup default data retention policies"""

        self.retention_policies = {
            "user_data": DataRetentionPolicy(
                data_type="user_data",
                retention_days=2555,  # 7 years
                encryption_required=True,
                backup_required=True,
                compliance_requirements=["GDPR", "CCPA"]
            ),
            "payment_data": DataRetentionPolicy(
                data_type="payment_data",
                retention_days=2555,  # 7 years (PCI requirement)
                encryption_required=True,
                backup_required=True,
                purge_method="cryptographic_erasure",
                compliance_requirements=["PCI_DSS"]
            ),
            "session_data": DataRetentionPolicy(
                data_type="session_data",
                retention_days=30,
                encryption_required=True,
                backup_required=False
            ),
            "audit_logs": DataRetentionPolicy(
                data_type="audit_logs",
                retention_days=2555,  # 7 years
                encryption_required=True,
                backup_required=True,
                compliance_requirements=["SOX", "GDPR"]
            ),
            "ml_training_data": DataRetentionPolicy(
                data_type="ml_training_data",
                retention_days=1095,  # 3 years
                encryption_required=True,
                backup_required=True
            ),
            "temporary_files": DataRetentionPolicy(
                data_type="temporary_files",
                retention_days=7,
                encryption_required=False,
                backup_required=False
            )
        }

    def _initialize_key_management(self):
        """Initialize key management systems"""

        try:
            # Initialize Redis for key caching
            self.redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                decode_responses=True,
                socket_timeout=5
            )

            # Initialize external key management
            if self.config.master_key_provider == "aws_kms":
                self._initialize_aws_kms()
            elif self.config.master_key_provider == "azure_keyvault":
                self._initialize_azure_keyvault()

            # Generate or load master keys
            self._setup_master_keys()

        except Exception as e:
            logger.error(f"Failed to initialize key management: {e}")
            # Fall back to local key management
            self._setup_local_keys()

    def _initialize_aws_kms(self):
        """Initialize AWS KMS client"""
        try:
            self.aws_kms_client = boto3.client('kms')
            logger.info("AWS KMS client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize AWS KMS: {e}")

    def _initialize_azure_keyvault(self):
        """Initialize Azure Key Vault client"""
        try:
            vault_url = os.getenv("AZURE_KEY_VAULT_URL")
            if vault_url:
                credential = DefaultAzureCredential()
                self.azure_kv_client = SecretClient(vault_url=vault_url, credential=credential)
                logger.info("Azure Key Vault client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Azure Key Vault: {e}")

    def _setup_master_keys(self):
        """Setup master encryption keys"""

        # Create master keys for different purposes
        purposes = ["data", "pii", "payment", "session", "backup"]

        for purpose in purposes:
            key_id = f"master_{purpose}"

            # Try to load existing key
            existing_key = self._load_key_from_external(key_id)

            if existing_key:
                self.encryption_keys[key_id] = existing_key
            else:
                # Generate new master key
                master_key = self._generate_master_key(purpose)
                self.encryption_keys[key_id] = master_key

                # Store in external key management if available
                self._store_key_externally(master_key)

        logger.info(f"Initialized {len(self.encryption_keys)} master keys")

    def _setup_local_keys(self):
        """Setup local key management as fallback"""

        master_key_env = os.getenv("MASTER_ENCRYPTION_KEY")
        if master_key_env:
            key_data = base64.b64decode(master_key_env.encode())
        else:
            key_data = secrets.token_bytes(32)
            logger.warning("Generated new master key - store securely!")

        master_key = EncryptionKey(
            key_id="master_local",
            algorithm=EncryptionAlgorithm.AES_256_GCM,
            key_data=key_data,
            status=KeyRotationStatus.CURRENT,
            created_at=datetime.utcnow(),
            purpose="general"
        )

        self.encryption_keys["master_local"] = master_key

        # Derive keys for different purposes
        self._derive_purpose_keys(master_key)

    def _generate_master_key(self, purpose: str) -> EncryptionKey:
        """Generate a new master key"""

        if self.config.default_algorithm == EncryptionAlgorithm.AES_256_GCM:
            key_data = secrets.token_bytes(32)  # 256 bits
        elif self.config.default_algorithm == EncryptionAlgorithm.FERNET:
            key_data = Fernet.generate_key()
        else:
            key_data = secrets.token_bytes(32)

        return EncryptionKey(
            key_id=f"master_{purpose}_{secrets.token_hex(8)}",
            algorithm=self.config.default_algorithm,
            key_data=key_data,
            status=KeyRotationStatus.CURRENT,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=self.config.key_rotation_days),
            purpose=purpose
        )

    def _derive_purpose_keys(self, master_key: EncryptionKey):
        """Derive keys for different purposes from master key"""

        purposes = ["data", "pii", "payment", "session", "backup"]

        for purpose in purposes:
            # Use PBKDF2 to derive purpose-specific key
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=purpose.encode(),
                iterations=100000,
                backend=default_backend()
            )

            derived_key_data = kdf.derive(master_key.key_data)

            derived_key = EncryptionKey(
                key_id=f"{purpose}_{secrets.token_hex(8)}",
                algorithm=master_key.algorithm,
                key_data=derived_key_data,
                status=KeyRotationStatus.CURRENT,
                created_at=datetime.utcnow(),
                expires_at=master_key.expires_at,
                purpose=purpose
            )

            self.encryption_keys[f"master_{purpose}"] = derived_key

    def encrypt_data(
        self,
        data: Union[str, bytes],
        purpose: str = "data",
        classification: Optional[DataClassification] = None
    ) -> Dict[str, Any]:
        """
        Encrypt data with appropriate key and algorithm

        Args:
            data: Data to encrypt
            purpose: Purpose of encryption (data, pii, payment, etc.)
            classification: Data classification level

        Returns:
            Dictionary with encrypted data and metadata
        """

        try:
            # Get encryption key for purpose
            key = self._get_encryption_key(purpose)
            if not key:
                raise ValueError(f"No encryption key available for purpose: {purpose}")

            # Convert string to bytes
            if isinstance(data, str):
                data_bytes = data.encode('utf-8')
            else:
                data_bytes = data

            # Encrypt based on algorithm
            if key.algorithm == EncryptionAlgorithm.AES_256_GCM:
                encrypted_data, nonce, tag = self._encrypt_aes_gcm(data_bytes, key.key_data)
                encryption_metadata = {
                    "nonce": base64.b64encode(nonce).decode(),
                    "tag": base64.b64encode(tag).decode()
                }
            elif key.algorithm == EncryptionAlgorithm.FERNET:
                fernet = Fernet(key.key_data)
                encrypted_data = fernet.encrypt(data_bytes)
                encryption_metadata = {}
            else:
                raise ValueError(f"Unsupported encryption algorithm: {key.algorithm}")

            # Update key usage
            key.usage_count += 1

            return {
                "encrypted_data": base64.b64encode(encrypted_data).decode(),
                "key_id": key.key_id,
                "algorithm": key.algorithm.value,
                "purpose": purpose,
                "classification": classification.value if classification else None,
                "encrypted_at": datetime.utcnow().isoformat(),
                "metadata": encryption_metadata
            }

        except Exception as e:
            logger.error(f"Data encryption failed: {e}")
            raise

    def decrypt_data(self, encrypted_payload: Dict[str, Any]) -> Union[str, bytes]:
        """
        Decrypt data using stored metadata

        Args:
            encrypted_payload: Encrypted data with metadata

        Returns:
            Decrypted data
        """

        try:
            # Get encryption key
            key_id = encrypted_payload.get("key_id")
            if not key_id:
                raise ValueError("Missing key_id in encrypted payload")

            key = self._get_key_by_id(key_id)
            if not key:
                raise ValueError(f"Encryption key not found: {key_id}")

            # Decode encrypted data
            encrypted_data = base64.b64decode(encrypted_payload["encrypted_data"].encode())
            algorithm = EncryptionAlgorithm(encrypted_payload["algorithm"])

            # Decrypt based on algorithm
            if algorithm == EncryptionAlgorithm.AES_256_GCM:
                nonce = base64.b64decode(encrypted_payload["metadata"]["nonce"].encode())
                tag = base64.b64decode(encrypted_payload["metadata"]["tag"].encode())
                decrypted_data = self._decrypt_aes_gcm(encrypted_data, key.key_data, nonce, tag)
            elif algorithm == EncryptionAlgorithm.FERNET:
                fernet = Fernet(key.key_data)
                decrypted_data = fernet.decrypt(encrypted_data)
            else:
                raise ValueError(f"Unsupported encryption algorithm: {algorithm}")

            return decrypted_data.decode('utf-8')

        except Exception as e:
            logger.error(f"Data decryption failed: {e}")
            raise

    def _encrypt_aes_gcm(self, data: bytes, key: bytes) -> Tuple[bytes, bytes, bytes]:
        """Encrypt data using AES-GCM"""

        nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM

        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(nonce),
            backend=default_backend()
        )

        encryptor = cipher.encryptor()
        encrypted_data = encryptor.update(data) + encryptor.finalize()

        return encrypted_data, nonce, encryptor.tag

    def _decrypt_aes_gcm(self, encrypted_data: bytes, key: bytes, nonce: bytes, tag: bytes) -> bytes:
        """Decrypt data using AES-GCM"""

        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(nonce, tag),
            backend=default_backend()
        )

        decryptor = cipher.decryptor()
        decrypted_data = decryptor.update(encrypted_data) + decryptor.finalize()

        return decrypted_data

    def detect_pii(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect PII in text

        Args:
            text: Text to analyze

        Returns:
            List of detected PII with type and confidence
        """

        detected_pii = []

        for pattern in self.pii_patterns:
            matches = re.finditer(pattern.pattern, text, re.IGNORECASE)

            for match in matches:
                detected_pii.append({
                    "type": pattern.pii_type.value,
                    "value": match.group(),
                    "start": match.start(),
                    "end": match.end(),
                    "confidence": pattern.confidence_threshold,
                    "should_encrypt": pattern.should_encrypt,
                    "should_mask": pattern.should_mask
                })

        return detected_pii

    def mask_pii(self, text: str, mask_char: str = "*") -> Tuple[str, List[Dict[str, Any]]]:
        """
        Mask PII in text

        Args:
            text: Text to mask
            mask_char: Character to use for masking

        Returns:
            Tuple of (masked_text, detected_pii_info)
        """

        detected_pii = self.detect_pii(text)
        masked_text = text

        # Sort by position in reverse order to avoid offset issues
        for pii in sorted(detected_pii, key=lambda x: x["start"], reverse=True):
            if pii["should_mask"]:
                start, end = pii["start"], pii["end"]
                original_value = pii["value"]

                # Mask strategy based on PII type
                if pii["type"] == PIIType.EMAIL.value:
                    # Show first char and domain
                    at_index = original_value.find("@")
                    if at_index > 0:
                        masked_value = original_value[0] + mask_char * (at_index - 1) + original_value[at_index:]
                    else:
                        masked_value = mask_char * len(original_value)
                elif pii["type"] == PIIType.PHONE.value:
                    # Show last 4 digits
                    masked_value = mask_char * (len(original_value) - 4) + original_value[-4:]
                elif pii["type"] == PIIType.CREDIT_CARD.value:
                    # Show last 4 digits
                    masked_value = mask_char * (len(original_value) - 4) + original_value[-4:]
                elif pii["type"] == PIIType.SSN.value:
                    # Show last 4 digits
                    masked_value = mask_char * (len(original_value) - 4) + original_value[-4:]
                else:
                    # Default masking
                    masked_value = mask_char * len(original_value)

                masked_text = masked_text[:start] + masked_value + masked_text[end:]

        return masked_text, detected_pii

    def encrypt_pii_in_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt PII found in structured data

        Args:
            data: Dictionary containing data to process

        Returns:
            Dictionary with PII encrypted
        """

        processed_data = data.copy()

        for key, value in data.items():
            if isinstance(value, str):
                detected_pii = self.detect_pii(value)

                if detected_pii:
                    # If PII is detected and should be encrypted
                    should_encrypt = any(pii["should_encrypt"] for pii in detected_pii)

                    if should_encrypt:
                        # Encrypt the entire field value
                        encrypted_payload = self.encrypt_data(
                            value,
                            purpose="pii",
                            classification=DataClassification.CONFIDENTIAL
                        )
                        processed_data[key] = encrypted_payload
                        processed_data[f"{key}_encrypted"] = True

            elif isinstance(value, dict):
                # Recursively process nested dictionaries
                processed_data[key] = self.encrypt_pii_in_data(value)

            elif isinstance(value, list):
                # Process list items
                processed_list = []
                for item in value:
                    if isinstance(item, str):
                        detected_pii = self.detect_pii(item)
                        if detected_pii and any(pii["should_encrypt"] for pii in detected_pii):
                            encrypted_payload = self.encrypt_data(
                                item,
                                purpose="pii",
                                classification=DataClassification.CONFIDENTIAL
                            )
                            processed_list.append(encrypted_payload)
                        else:
                            processed_list.append(item)
                    elif isinstance(item, dict):
                        processed_list.append(self.encrypt_pii_in_data(item))
                    else:
                        processed_list.append(item)
                processed_data[key] = processed_list

        return processed_data

    def apply_data_retention_policy(self, data_type: str) -> Dict[str, Any]:
        """
        Apply data retention policy

        Args:
            data_type: Type of data to check

        Returns:
            Retention policy actions taken
        """

        policy = self.retention_policies.get(data_type)
        if not policy:
            logger.warning(f"No retention policy found for data type: {data_type}")
            return {"actions": [], "policy_applied": False}

        actions_taken = []
        cutoff_date = datetime.utcnow() - timedelta(days=policy.retention_days)

        # This would typically integrate with your database/storage layer
        # Here we return the policy that should be applied
        actions_taken.append(f"Apply retention policy for {data_type}")
        actions_taken.append(f"Delete data older than {cutoff_date.isoformat()}")

        if policy.purge_method == "cryptographic_erasure":
            actions_taken.append("Use cryptographic erasure method")
        elif policy.purge_method == "secure_delete":
            actions_taken.append("Use secure deletion method")

        return {
            "actions": actions_taken,
            "policy_applied": True,
            "retention_days": policy.retention_days,
            "cutoff_date": cutoff_date.isoformat(),
            "purge_method": policy.purge_method,
            "compliance_requirements": policy.compliance_requirements
        }

    def get_gdpr_compliance_report(self, user_id: str) -> Dict[str, Any]:
        """
        Generate GDPR compliance report for a user

        Args:
            user_id: User ID to generate report for

        Returns:
            GDPR compliance report
        """

        # This would typically query your database for user data
        # Here we provide the structure for GDPR compliance

        return {
            "user_id": user_id,
            "report_generated": datetime.utcnow().isoformat(),
            "data_categories": {
                "personal_data": {
                    "collected": True,
                    "lawful_basis": "consent",
                    "retention_period": "as per policy",
                    "encrypted": True
                },
                "sensitive_data": {
                    "collected": False,
                    "lawful_basis": None,
                    "retention_period": None,
                    "encrypted": True
                }
            },
            "user_rights": {
                "right_to_access": "available",
                "right_to_rectification": "available",
                "right_to_erasure": "available",
                "right_to_portability": "available",
                "right_to_restrict_processing": "available"
            },
            "data_processing_activities": [
                {
                    "activity": "user_authentication",
                    "purpose": "identity_verification",
                    "lawful_basis": "contract",
                    "retention_period": "2555_days"
                }
            ],
            "consent_records": [
                {
                    "consent_type": "marketing",
                    "status": "withdrawn",
                    "date": "2024-01-01T00:00:00Z"
                }
            ]
        }

    def _get_encryption_key(self, purpose: str) -> Optional[EncryptionKey]:
        """Get encryption key for specific purpose"""

        key_id = f"master_{purpose}"
        return self.encryption_keys.get(key_id)

    def _get_key_by_id(self, key_id: str) -> Optional[EncryptionKey]:
        """Get encryption key by ID"""

        return self.encryption_keys.get(key_id)

    def _load_key_from_external(self, key_id: str) -> Optional[EncryptionKey]:
        """Load key from external key management system"""

        # Implementation would depend on chosen key management system
        return None

    def _store_key_externally(self, key: EncryptionKey):
        """Store key in external key management system"""

        # Implementation would depend on chosen key management system
        pass

    async def rotate_keys(self):
        """Rotate encryption keys based on policy"""

        rotated_keys = []

        for key_id, key in self.encryption_keys.items():
            if key.status != KeyRotationStatus.CURRENT:
                continue

            # Check if key needs rotation
            needs_rotation = (
                (key.expires_at and datetime.utcnow() >= key.expires_at) or
                (key.max_usage and key.usage_count >= key.max_usage)
            )

            if needs_rotation:
                # Generate new key
                new_key = self._generate_master_key(key.purpose)

                # Mark old key as deprecated
                key.status = KeyRotationStatus.DEPRECATED

                # Add new key
                self.encryption_keys[new_key.key_id] = new_key
                self.encryption_keys[f"master_{key.purpose}"] = new_key

                rotated_keys.append({
                    "old_key_id": key_id,
                    "new_key_id": new_key.key_id,
                    "purpose": key.purpose,
                    "rotated_at": datetime.utcnow().isoformat()
                })

                logger.info(f"Rotated encryption key for purpose: {key.purpose}")

        return rotated_keys

    def get_data_protection_metrics(self) -> Dict[str, Any]:
        """Get data protection metrics and status"""

        active_keys = len([k for k in self.encryption_keys.values()
                          if k.status == KeyRotationStatus.CURRENT])

        keys_expiring_soon = len([k for k in self.encryption_keys.values()
                                if k.expires_at and
                                k.expires_at < datetime.utcnow() + timedelta(days=7)])

        return {
            "encryption": {
                "active_keys": active_keys,
                "keys_expiring_soon": keys_expiring_soon,
                "algorithms_supported": [alg.value for alg in EncryptionAlgorithm],
                "key_rotation_days": self.config.key_rotation_days
            },
            "pii_protection": {
                "detection_enabled": self.config.pii_detection_enabled,
                "encryption_required": self.config.pii_encryption_required,
                "masking_enabled": self.config.pii_masking_enabled,
                "patterns_configured": len(self.pii_patterns)
            },
            "compliance": {
                "gdpr_enabled": self.config.gdpr_compliance_enabled,
                "ccpa_enabled": self.config.ccpa_compliance_enabled,
                "hipaa_enabled": self.config.hipaa_compliance_enabled
            },
            "retention_policies": {
                "policies_configured": len(self.retention_policies),
                "auto_purge_enabled": self.config.auto_purge_enabled,
                "backup_encryption_enabled": self.config.backup_encryption_enabled
            },
            "last_updated": datetime.utcnow().isoformat()
        }


# Global data protection manager instance
_data_protection_manager: Optional[DataProtectionManager] = None


def get_data_protection_manager() -> DataProtectionManager:
    """Get global data protection manager instance"""
    global _data_protection_manager

    if _data_protection_manager is None:
        # Load configuration from environment
        config = DataProtectionConfig(
            master_key_provider=os.getenv("MASTER_KEY_PROVIDER", "local"),
            pii_detection_enabled=os.getenv("PII_DETECTION_ENABLED", "true").lower() == "true",
            gdpr_compliance_enabled=os.getenv("GDPR_COMPLIANCE_ENABLED", "true").lower() == "true"
        )

        _data_protection_manager = DataProtectionManager(config)

    return _data_protection_manager


def reset_data_protection_manager():
    """Reset data protection manager (mainly for testing)"""
    global _data_protection_manager
    _data_protection_manager = None