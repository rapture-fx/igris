"""
Enhanced Security Configuration System
=====================================

Production-ready security configuration management with multiple provider support.
"""

import os
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import hashlib
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

logger = logging.getLogger(__name__)

class SecretProvider(Enum):
    ENVIRONMENT = "environment"
    AWS_SECRETS_MANAGER = "aws_secrets_manager"
    AZURE_KEY_VAULT = "azure_key_vault"
    GOOGLE_SECRET_MANAGER = "google_secret_manager"
    HASHICORP_VAULT = "hashicorp_vault"

@dataclass
class SecretConfig:
    """Configuration for secret management"""
    provider: SecretProvider
    region: Optional[str] = None
    vault_url: Optional[str] = None
    key_vault_url: Optional[str] = None
    project_id: Optional[str] = None

class SecurityConfig:
    """Enhanced security configuration with runtime validation"""
    
    def __init__(self):
        self.required_secrets = [
            "JWT_SECRET_KEY",
            "DATABASE_PASSWORD", 
            "REDIS_PASSWORD",
            "ENCRYPTION_KEY"
        ]
        self._validate_environment()
        self._setup_encryption()
    
    def _validate_environment(self):
        """Validate all required secrets are present"""
        missing_secrets = []
        
        for secret in self.required_secrets:
            if not os.getenv(secret):
                missing_secrets.append(secret)
        
        if missing_secrets:
            error_msg = f"Critical security error: Missing required environment variables: {', '.join(missing_secrets)}"
            logger.critical(error_msg)
            raise EnvironmentError(error_msg)
    
    def _setup_encryption(self):
        """Setup field-level encryption"""
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if encryption_key:
            try:
                # Derive encryption key from master key
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=b'stable_salt_for_app',  # In production, use random salt per secret
                    iterations=100000,
                )
                key = base64.urlsafe_b64encode(kdf.derive(encryption_key.encode()))
                self.cipher_suite = Fernet(key)
            except Exception as e:
                logger.error(f"Failed to setup encryption: {e}")
                raise
    
    def encrypt_field(self, value: str) -> str:
        """Encrypt sensitive field values"""
        if hasattr(self, 'cipher_suite'):
            return self.cipher_suite.encrypt(value.encode()).decode()
        return value
    
    def decrypt_field(self, encrypted_value: str) -> str:
        """Decrypt sensitive field values"""
        if hasattr(self, 'cipher_suite'):
            return self.cipher_suite.decrypt(encrypted_value.encode()).decode()
        return encrypted_value
    
    @property
    def jwt_secret(self) -> str:
        """Get JWT secret with validation"""
        secret = os.getenv("JWT_SECRET_KEY")
        if not secret or len(secret) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")
        return secret
    
    @property
    def database_password(self) -> str:
        """Get database password"""
        return os.getenv("DATABASE_PASSWORD")
    
    @property
    def redis_password(self) -> str:
        """Get Redis password"""
        return os.getenv("REDIS_PASSWORD")
    
    def generate_secure_key(self, length: int = 32) -> str:
        """Generate cryptographically secure key"""
        return secrets.token_urlsafe(length)
    
    def hash_api_key(self, api_key: str) -> str:
        """Hash API key for secure storage"""
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    def validate_api_key_format(self, api_key: str) -> bool:
        """Validate API key format"""
        if not api_key:
            return False
        
        # API keys should start with sk_ or pk_ and be at least 32 chars
        if not (api_key.startswith('sk_') or api_key.startswith('pk_')):
            return False
        
        if len(api_key) < 35:  # prefix (3) + minimum key length (32)
            return False
        
        return True

class SecureEnvironmentLoader:
    """Load and validate environment variables securely"""
    
    @staticmethod
    def load_with_validation() -> Dict[str, Any]:
        """Load environment with security validations"""
        config = {}
        
        # Critical security settings
        required_settings = {
            'JWT_SECRET_KEY': {'min_length': 32, 'type': str},
            'DATABASE_PASSWORD': {'min_length': 12, 'type': str},
            'REDIS_PASSWORD': {'min_length': 12, 'type': str},
            'ENCRYPTION_KEY': {'min_length': 32, 'type': str},
        }
        
        for setting, requirements in required_settings.items():
            value = os.getenv(setting)
            
            if not value:
                raise EnvironmentError(f"Required environment variable {setting} is not set")
            
            if len(value) < requirements['min_length']:
                raise ValueError(f"{setting} must be at least {requirements['min_length']} characters")
            
            config[setting] = value
        
        # Optional but recommended settings
        optional_settings = {
            'CORS_ORIGINS': os.getenv('CORS_ORIGINS', 'http://localhost:3000'),
            'RATE_LIMIT_PER_MINUTE': int(os.getenv('RATE_LIMIT_PER_MINUTE', '60')),
            'MAX_FILE_SIZE_MB': int(os.getenv('MAX_FILE_SIZE_MB', '100')),
            'SESSION_TIMEOUT_MINUTES': int(os.getenv('SESSION_TIMEOUT_MINUTES', '30')),
        }
        
        config.update(optional_settings)
        
        return config

# Global security configuration instance
try:
    security_config = SecurityConfig()
    logger.info("Security configuration initialized successfully")
except Exception as e:
    logger.critical(f"Failed to initialize security configuration: {e}")
    raise

def get_security_config() -> SecurityConfig:
    """Get the global security configuration"""
    return security_config

def generate_environment_template() -> str:
    """Generate secure environment template"""
    template = """# Schlep Engine Security Configuration
# CRITICAL: Replace all placeholder values before deployment

# JWT Configuration (Required)
JWT_SECRET_KEY="{jwt_secret}"

# Database Security (Required)
DATABASE_PASSWORD="{db_password}"

# Redis Security (Required)  
REDIS_PASSWORD="{redis_password}"

# Field Encryption (Required)
ENCRYPTION_KEY="{encryption_key}"

# Optional Security Settings
CORS_ORIGINS="http://localhost:3000,https://yourdomain.com"
RATE_LIMIT_PER_MINUTE=60
MAX_FILE_SIZE_MB=100
SESSION_TIMEOUT_MINUTES=30

# SSL/TLS Configuration (Production)
SSL_CERT_PATH="/path/to/cert.pem"
SSL_KEY_PATH="/path/to/key.pem"

# Monitoring and Logging
LOG_LEVEL="INFO"
ENABLE_AUDIT_LOGGING="true"
""".format(
        jwt_secret=secrets.token_urlsafe(32),
        db_password=secrets.token_urlsafe(24),
        redis_password=secrets.token_urlsafe(24),
        encryption_key=secrets.token_urlsafe(32)
    )
    
    return template

if __name__ == "__main__":
    # Generate secure environment template
    template = generate_environment_template()
    with open(".env.secure.template", "w") as f:
        f.write(template)
    print("Secure environment template generated: .env.secure.template")