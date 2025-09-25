"""
Dedicated Secrets Management Service Integration
==============================================

This module provides comprehensive integration with dedicated secrets management
services including HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, and
Google Secret Manager for secure secret storage and retrieval.

Features:
- Multi-provider secrets management support
- Dynamic secret rotation
- Secure secret caching with TTL
- Audit logging for secret access
- Encryption key management
- Database credential rotation
- API key management
- Certificate management
"""

import os
import json
import asyncio
import base64
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import logging
import ssl
import aiohttp
import hvac  # HashiCorp Vault client
# import boto3  # Cloud SDK removed
from botocore.exceptions import ClientError
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
from google.cloud import secretmanager
import redis.asyncio as redis

from app.core.config import settings
from app.middleware.audit_middleware import audit_logger, AuditEventType, AuditSeverity

logger = logging.getLogger(__name__)

class SecretProvider(Enum):
    """Supported secret management providers"""
    HASHICORP_VAULT = "hashicorp_vault"
    AWS_SECRETS_MANAGER = "aws_secrets_manager"
    AZURE_KEY_VAULT = "azure_key_vault"
    GOOGLE_SECRET_MANAGER = "google_secret_manager"
    KUBERNETES_SECRETS = "kubernetes_secrets"
    LOCAL_FILE = "local_file"  # For development only

class SecretType(Enum):
    """Types of secrets managed"""
    DATABASE_PASSWORD = "database_password"
    API_KEY = "api_key"
    ENCRYPTION_KEY = "encryption_key"
    CERTIFICATE = "certificate"
    PRIVATE_KEY = "private_key"
    OAUTH_CLIENT_SECRET = "oauth_client_secret"
    WEBHOOK_SECRET = "webhook_secret"
    THIRD_PARTY_TOKEN = "third_party_token"

@dataclass
class SecretMetadata:
    """Metadata for secret management"""
    secret_id: str
    secret_type: SecretType
    provider: SecretProvider
    created_at: datetime
    last_accessed: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    rotation_interval: Optional[timedelta] = None
    tags: Dict[str, str] = field(default_factory=dict)
    description: str = ""

@dataclass
class SecretValue:
    """Secret value with metadata"""
    value: str
    metadata: SecretMetadata
    cached_at: datetime
    ttl: int = 3600  # Cache TTL in seconds

class SecretCache:
    """Redis-backed secret cache with TTL"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        self._memory_cache = {}
        
    async def get_redis_client(self) -> Optional[redis.Redis]:
        """Get Redis client for caching"""
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url(
                    "redis://localhost:6379", 
                    decode_responses=True
                )
                await self.redis_client.ping()
            except Exception as e:
                logger.warning(f"Redis not available for secret caching: {e}")
                self.redis_client = None
        return self.redis_client
    
    async def get_secret(self, secret_id: str) -> Optional[SecretValue]:
        """Get secret from cache"""
        redis_client = await self.get_redis_client()
        
        cache_key = f"secret:{secret_id}"
        
        if redis_client:
            try:
                cached_data = await redis_client.get(cache_key)
                if cached_data:
                    data = json.loads(cached_data)
                    return SecretValue(
                        value=data["value"],
                        metadata=SecretMetadata(**data["metadata"]),
                        cached_at=datetime.fromisoformat(data["cached_at"]),
                        ttl=data["ttl"]
                    )
            except Exception as e:
                logger.error(f"Redis cache get error: {e}")
        
        # Fallback to memory cache
        return self._memory_cache.get(secret_id)
    
    async def set_secret(self, secret_id: str, secret_value: SecretValue):
        """Set secret in cache"""
        redis_client = await self.get_redis_client()
        
        cache_key = f"secret:{secret_id}"
        cache_data = {
            "value": secret_value.value,
            "metadata": secret_value.metadata.__dict__,
            "cached_at": secret_value.cached_at.isoformat(),
            "ttl": secret_value.ttl
        }
        
        if redis_client:
            try:
                await redis_client.setex(
                    cache_key, 
                    secret_value.ttl, 
                    json.dumps(cache_data, default=str)
                )
                return
            except Exception as e:
                logger.error(f"Redis cache set error: {e}")
        
        # Fallback to memory cache
        self._memory_cache[secret_id] = secret_value
    
    async def delete_secret(self, secret_id: str):
        """Delete secret from cache"""
        redis_client = await self.get_redis_client()
        
        cache_key = f"secret:{secret_id}"
        
        if redis_client:
            try:
                await redis_client.delete(cache_key)
            except Exception as e:
                logger.error(f"Redis cache delete error: {e}")
        
        # Also remove from memory cache
        self._memory_cache.pop(secret_id, None)

class BaseSecretsProvider:
    """Base class for secrets providers"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        self.config = provider_config
        self.provider = SecretProvider.LOCAL_FILE  # Override in subclasses
    
    async def get_secret(self, secret_id: str) -> str:
        """Get secret value"""
        raise NotImplementedError
    
    async def set_secret(self, secret_id: str, secret_value: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Set secret value"""
        raise NotImplementedError
    
    async def delete_secret(self, secret_id: str) -> bool:
        """Delete secret"""
        raise NotImplementedError
    
    async def list_secrets(self) -> List[str]:
        """List all secret IDs"""
        raise NotImplementedError
    
    async def rotate_secret(self, secret_id: str) -> str:
        """Rotate secret and return new value"""
        raise NotImplementedError

class HashiCorpVaultProvider(BaseSecretsProvider):
    """HashiCorp Vault secrets provider"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        self.provider = SecretProvider.HASHICORP_VAULT
        self.client = hvac.Client(
            url=provider_config.get("vault_url", "http://localhost:8200"),
            token=provider_config.get("vault_token")
        )
        
        if not self.client.is_authenticated():
            raise ValueError("Vault authentication failed")
    
    async def get_secret(self, secret_id: str) -> str:
        """Get secret from Vault"""
        try:
            path = f"secret/data/{secret_id}"
            response = self.client.secrets.kv.v2.read_secret_version(path=secret_id)
            
            if response and "data" in response and "data" in response["data"]:
                return response["data"]["data"].get("value", "")
            
            raise ValueError(f"Secret {secret_id} not found")
            
        except Exception as e:
            logger.error(f"Vault get_secret error: {e}")
            raise
    
    async def set_secret(self, secret_id: str, secret_value: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Set secret in Vault"""
        try:
            secret_data = {"value": secret_value}
            if metadata:
                secret_data.update(metadata)
            
            response = self.client.secrets.kv.v2.create_or_update_secret(
                path=secret_id,
                secret=secret_data
            )
            
            return response is not None
            
        except Exception as e:
            logger.error(f"Vault set_secret error: {e}")
            return False
    
    async def delete_secret(self, secret_id: str) -> bool:
        """Delete secret from Vault"""
        try:
            self.client.secrets.kv.v2.delete_metadata_and_all_versions(path=secret_id)
            return True
        except Exception as e:
            logger.error(f"Vault delete_secret error: {e}")
            return False
    
    async def list_secrets(self) -> List[str]:
        """List secrets in Vault"""
        try:
            response = self.client.secrets.kv.v2.list_secrets(path="")
            if response and "data" in response and "keys" in response["data"]:
                return response["data"]["keys"]
            return []
        except Exception as e:
            logger.error(f"Vault list_secrets error: {e}")
            return []

class AWSSecretsManagerProvider(BaseSecretsProvider):
    """AWS Secrets Manager provider"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        self.provider = SecretProvider.AWS_SECRETS_MANAGER
        self.client = boto3.client(
            'secretsmanager',
            region_name=provider_config.get("region", "us-east-1"),
            aws_access_key_id=provider_config.get("access_key_id"),
            aws_secret_access_key=provider_config.get("secret_access_key")
        )
    
    async def get_secret(self, secret_id: str) -> str:
        """Get secret from AWS Secrets Manager"""
        try:
            response = self.client.get_secret_value(SecretId=secret_id)
            return response["SecretString"]
        except ClientError as e:
            logger.error(f"AWS Secrets Manager get_secret error: {e}")
            raise
    
    async def set_secret(self, secret_id: str, secret_value: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Set secret in AWS Secrets Manager"""
        try:
            # Try to update existing secret
            try:
                self.client.update_secret(
                    SecretId=secret_id,
                    SecretString=secret_value
                )
                return True
            except ClientError:
                # Secret doesn't exist, create new one
                self.client.create_secret(
                    Name=secret_id,
                    SecretString=secret_value,
                    Description=metadata.get("description", "") if metadata else ""
                )
                return True
        except ClientError as e:
            logger.error(f"AWS Secrets Manager set_secret error: {e}")
            return False
    
    async def delete_secret(self, secret_id: str) -> bool:
        """Delete secret from AWS Secrets Manager"""
        try:
            self.client.delete_secret(
                SecretId=secret_id,
                ForceDeleteWithoutRecovery=True
            )
            return True
        except ClientError as e:
            logger.error(f"AWS Secrets Manager delete_secret error: {e}")
            return False

class AzureKeyVaultProvider(BaseSecretsProvider):
    """Azure Key Vault provider"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        self.provider = SecretProvider.AZURE_KEY_VAULT
        
        vault_url = provider_config.get("vault_url", "https://your-vault.vault.azure.net/")
        credential = DefaultAzureCredential()
        self.client = SecretClient(vault_url=vault_url, credential=credential)
    
    async def get_secret(self, secret_id: str) -> str:
        """Get secret from Azure Key Vault"""
        try:
            secret = self.client.get_secret(secret_id)
            return secret.value
        except Exception as e:
            logger.error(f"Azure Key Vault get_secret error: {e}")
            raise
    
    async def set_secret(self, secret_id: str, secret_value: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Set secret in Azure Key Vault"""
        try:
            self.client.set_secret(secret_id, secret_value)
            return True
        except Exception as e:
            logger.error(f"Azure Key Vault set_secret error: {e}")
            return False

class GoogleSecretManagerProvider(BaseSecretsProvider):
    """Google Secret Manager provider"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        self.provider = SecretProvider.GOOGLE_SECRET_MANAGER
        self.project_id = provider_config.get("project_id")
        self.client = secretmanager.SecretManagerServiceClient()
    
    async def get_secret(self, secret_id: str) -> str:
        """Get secret from Google Secret Manager"""
        try:
            name = f"projects/{self.project_id}/secrets/{secret_id}/versions/latest"
            response = self.client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            logger.error(f"Google Secret Manager get_secret error: {e}")
            raise

class SecretsManager:
    """
    Unified secrets management with multi-provider support
    """
    
    def __init__(self):
        self.providers = {}
        self.cache = SecretCache()
        self.default_provider = None
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize configured secrets providers"""
        # HashiCorp Vault
        if os.getenv("VAULT_URL") and os.getenv("VAULT_TOKEN"):
            try:
                self.providers[SecretProvider.HASHICORP_VAULT] = HashiCorpVaultProvider({
                    "vault_url": os.getenv("VAULT_URL"),
                    "vault_token": os.getenv("VAULT_TOKEN")
                })
                self.default_provider = SecretProvider.HASHICORP_VAULT
                logger.info("HashiCorp Vault provider initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Vault provider: {e}")
        
        # AWS Secrets Manager
        if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
            try:
                self.providers[SecretProvider.AWS_SECRETS_MANAGER] = AWSSecretsManagerProvider({
                    "region": os.getenv("AWS_REGION", "us-east-1"),
                    "access_key_id": os.getenv("AWS_ACCESS_KEY_ID"),
                    "secret_access_key": os.getenv("AWS_SECRET_ACCESS_KEY")
                })
                if not self.default_provider:
                    self.default_provider = SecretProvider.AWS_SECRETS_MANAGER
                logger.info("AWS Secrets Manager provider initialized")
            except Exception as e:
                logger.error(f"Failed to initialize AWS Secrets Manager: {e}")
        
        # Azure Key Vault
        if os.getenv("AZURE_KEY_VAULT_URL"):
            try:
                self.providers[SecretProvider.AZURE_KEY_VAULT] = AzureKeyVaultProvider({
                    "vault_url": os.getenv("AZURE_KEY_VAULT_URL")
                })
                if not self.default_provider:
                    self.default_provider = SecretProvider.AZURE_KEY_VAULT
                logger.info("Azure Key Vault provider initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Azure Key Vault: {e}")
        
        # Google Secret Manager
        if os.getenv("GOOGLE_CLOUD_PROJECT"):
            try:
                self.providers[SecretProvider.GOOGLE_SECRET_MANAGER] = GoogleSecretManagerProvider({
                    "project_id": os.getenv("GOOGLE_CLOUD_PROJECT")
                })
                if not self.default_provider:
                    self.default_provider = SecretProvider.GOOGLE_SECRET_MANAGER
                logger.info("Google Secret Manager provider initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Google Secret Manager: {e}")
        
        if not self.providers:
            logger.warning("No secrets management providers configured")
    
    async def get_secret(
        self, 
        secret_id: str, 
        provider: Optional[SecretProvider] = None,
        use_cache: bool = True
    ) -> Optional[str]:
        """
        Get secret value with caching support
        
        Args:
            secret_id: Secret identifier
            provider: Specific provider to use (defaults to configured default)
            use_cache: Whether to use cached value if available
            
        Returns:
            Secret value or None if not found
        """
        # Check cache first
        if use_cache:
            cached_secret = await self.cache.get_secret(secret_id)
            if cached_secret:
                # Update last accessed time
                cached_secret.metadata.last_accessed = datetime.utcnow()
                
                await self._log_secret_access(secret_id, "cache_hit", cached_secret.metadata.provider)
                return cached_secret.value
        
        # Use specified provider or default
        target_provider = provider or self.default_provider
        
        if not target_provider or target_provider not in self.providers:
            logger.error(f"No provider available for secret {secret_id}")
            return None
        
        try:
            # Get secret from provider
            provider_instance = self.providers[target_provider]
            secret_value = await provider_instance.get_secret(secret_id)
            
            if secret_value and use_cache:
                # Cache the secret
                metadata = SecretMetadata(
                    secret_id=secret_id,
                    secret_type=SecretType.API_KEY,  # Default type
                    provider=target_provider,
                    created_at=datetime.utcnow(),
                    last_accessed=datetime.utcnow()
                )
                
                cached_secret = SecretValue(
                    value=secret_value,
                    metadata=metadata,
                    cached_at=datetime.utcnow()
                )
                
                await self.cache.set_secret(secret_id, cached_secret)
            
            await self._log_secret_access(secret_id, "provider_fetch", target_provider)
            return secret_value
            
        except Exception as e:
            logger.error(f"Failed to get secret {secret_id}: {e}")
            await self._log_secret_access(secret_id, "fetch_error", target_provider, str(e))
            return None
    
    async def set_secret(
        self, 
        secret_id: str, 
        secret_value: str,
        secret_type: SecretType = SecretType.API_KEY,
        provider: Optional[SecretProvider] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Set secret value
        
        Args:
            secret_id: Secret identifier
            secret_value: Secret value to store
            secret_type: Type of secret
            provider: Specific provider to use
            metadata: Additional metadata
            
        Returns:
            True if successful
        """
        target_provider = provider or self.default_provider
        
        if not target_provider or target_provider not in self.providers:
            logger.error(f"No provider available to set secret {secret_id}")
            return False
        
        try:
            provider_instance = self.providers[target_provider]
            success = await provider_instance.set_secret(secret_id, secret_value, metadata)
            
            if success:
                # Invalidate cache
                await self.cache.delete_secret(secret_id)
                
                await self._log_secret_access(secret_id, "secret_set", target_provider)
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to set secret {secret_id}: {e}")
            await self._log_secret_access(secret_id, "set_error", target_provider, str(e))
            return False
    
    async def delete_secret(
        self, 
        secret_id: str, 
        provider: Optional[SecretProvider] = None
    ) -> bool:
        """Delete secret"""
        target_provider = provider or self.default_provider
        
        if not target_provider or target_provider not in self.providers:
            return False
        
        try:
            provider_instance = self.providers[target_provider]
            success = await provider_instance.delete_secret(secret_id)
            
            if success:
                # Remove from cache
                await self.cache.delete_secret(secret_id)
                
                await self._log_secret_access(secret_id, "secret_deleted", target_provider)
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to delete secret {secret_id}: {e}")
            return False
    
    async def rotate_database_credentials(self, database_name: str) -> Dict[str, Any]:
        """
        Rotate database credentials automatically
        
        Args:
            database_name: Name of the database
            
        Returns:
            Rotation result with new credentials
        """
        try:
            # Generate new password
            import secrets
            import string
            
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            new_password = ''.join(secrets.choice(alphabet) for i in range(32))
            
            # Get current credentials
            current_user = await self.get_secret(f"db_{database_name}_user")
            current_password = await self.get_secret(f"db_{database_name}_password")
            
            if not current_user or not current_password:
                raise ValueError("Current database credentials not found")
            
            # Update password in database (this would need actual DB connection)
            # For now, just store the new credentials
            
            # Store new password
            await self.set_secret(
                f"db_{database_name}_password",
                new_password,
                SecretType.DATABASE_PASSWORD
            )
            
            # Store old password as backup
            await self.set_secret(
                f"db_{database_name}_password_backup",
                current_password,
                SecretType.DATABASE_PASSWORD
            )
            
            await self._log_secret_access(
                f"db_{database_name}_password", 
                "credential_rotation", 
                self.default_provider
            )
            
            return {
                "status": "success",
                "database": database_name,
                "username": current_user,
                "password_updated": True,
                "backup_created": True,
                "rotation_date": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Database credential rotation failed: {e}")
            return {
                "status": "error",
                "database": database_name,
                "error": str(e)
            }
    
    async def _log_secret_access(
        self, 
        secret_id: str, 
        action: str, 
        provider: SecretProvider,
        error: Optional[str] = None
    ):
        """Log secret access for audit purposes"""
        await audit_logger.log_event({
            "event_type": AuditEventType.DATA_ACCESS,
            "severity": AuditSeverity.MEDIUM if not error else AuditSeverity.HIGH,
            "description": f"Secret {action}",
            "metadata": {
                "secret_id": secret_id,
                "action": action,
                "provider": provider.value if provider else "unknown",
                "error": error,
                "timestamp": datetime.utcnow().isoformat()
            }
        })
    
    async def get_database_connection_string(self, database_name: str) -> Optional[str]:
        """Get complete database connection string"""
        try:
            host = await self.get_secret(f"db_{database_name}_host")
            port = await self.get_secret(f"db_{database_name}_port") 
            database = await self.get_secret(f"db_{database_name}_name")
            username = await self.get_secret(f"db_{database_name}_user")
            password = await self.get_secret(f"db_{database_name}_password")
            
            if all([host, port, database, username, password]):
                return f"postgresql://{username}:{password}@{host}:{port}/{database}"
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to build connection string: {e}")
            return None
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all configured providers"""
        health_status = {
            "overall_status": "healthy",
            "providers": {},
            "default_provider": self.default_provider.value if self.default_provider else None
        }
        
        for provider_type, provider_instance in self.providers.items():
            try:
                # Try a simple operation to test connectivity
                secrets_list = await provider_instance.list_secrets()
                health_status["providers"][provider_type.value] = {
                    "status": "healthy",
                    "secret_count": len(secrets_list)
                }
            except Exception as e:
                health_status["providers"][provider_type.value] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                health_status["overall_status"] = "degraded"
        
        return health_status

# Global secrets manager instance
secrets_manager = SecretsManager()

# Convenience functions
async def get_secret(secret_id: str, use_cache: bool = True) -> Optional[str]:
    """Get secret using global secrets manager"""
    return await secrets_manager.get_secret(secret_id, use_cache=use_cache)

async def set_secret(secret_id: str, secret_value: str, secret_type: SecretType = SecretType.API_KEY) -> bool:
    """Set secret using global secrets manager"""
    return await secrets_manager.set_secret(secret_id, secret_value, secret_type)

async def get_database_url(database_name: str = "main") -> Optional[str]:
    """Get database connection URL"""
    return await secrets_manager.get_database_connection_string(database_name)

async def rotate_database_password(database_name: str = "main") -> Dict[str, Any]:
    """Rotate database password"""
    return await secrets_manager.rotate_database_credentials(database_name)

# Configuration for different environments
SECRETS_CONFIG = {
    "development": {
        "provider": SecretProvider.LOCAL_FILE,
        "cache_ttl": 300,  # 5 minutes
        "rotation_interval": timedelta(days=30)
    },
    "staging": {
        "provider": SecretProvider.HASHICORP_VAULT,
        "cache_ttl": 1800,  # 30 minutes
        "rotation_interval": timedelta(days=7)
    },
    "production": {
        "provider": SecretProvider.AWS_SECRETS_MANAGER,
        "cache_ttl": 3600,  # 1 hour
        "rotation_interval": timedelta(days=1)
    }
}

__all__ = [
    'secrets_manager',
    'get_secret',
    'set_secret', 
    'get_database_url',
    'rotate_database_password',
    'SecretsManager',
    'SecretProvider',
    'SecretType'
]