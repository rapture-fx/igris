"""
Unified Configuration System

This module consolidates all configuration functionality into a single,
consistent configuration system that eliminates redundancy and provides
environment-specific overrides.

Features:
- Single source of truth for all configuration
- Environment-specific overrides
- Feature flag management
- Security configuration
- Validation and defaults
- Runtime configuration updates
- Secure secrets management via environment variables
"""

import os
import logging
from typing import Dict, Any, List, Optional, Union
from enum import Enum
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, ConfigDict

logger = logging.getLogger(__name__)

class Environment(str, Enum):
    """Environment types"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class SecurityLevel(str, Enum):
    """Security levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    MAXIMUM = "maximum"


class UnifiedSettings(BaseSettings):
    """
    Unified Settings Class
    
    Consolidates all configuration from:
    - app/core/config.py
    - app/core/api_config.py
    - app/core/security_config.py
    - Environment variables
    - Feature flags
    
    All sensitive values are loaded from environment variables.
    """
    
    # ==================== CORE APPLICATION SETTINGS ====================
    
    # Environment
    ENVIRONMENT: Environment = Field(
        default=Environment.DEVELOPMENT, 
        description="Application environment"
    )
    DEBUG: bool = Field(
        default=True, 
        description="Debug mode"
    )
    TESTING_MODE: bool = Field(
        default=False, 
        description="Enable testing mode"
    )
    
    # API Configuration
    API_V1_STR: str = Field(
        default="/api/v1", 
        description="API v1 prefix"
    )
    PROJECT_NAME: str = Field(
        default="Schlep-engine", 
        description="Project name"
    )
    PROJECT_VERSION: str = Field(
        default="1.0.0", 
        description="Project version"
    )
    
    # ==================== DATABASE SETTINGS ====================
    
    # Database connection - supports both traditional PostgreSQL and Supabase
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/schlep_engine_dev",
        description="Database connection URL"
    )
    
    # Supabase Configuration (for hybrid architecture)
    SUPABASE_URL: str = Field(
        default="",
        description="Supabase project URL (e.g., https://xyz.supabase.co)"
    )
    SUPABASE_ANON_KEY: str = Field(
        default="",
        description="Supabase anonymous key"
    )
    SUPABASE_SERVICE_KEY: str = Field(
        default="",
        description="Supabase service role key"
    )
    SUPABASE_JWT_SECRET: str = Field(
        default="",
        description="Supabase JWT secret"
    )
    
    # Database connection components (for backward compatibility)
    DB_HOST: str = Field(
        default="localhost",
        description="Database host"
    )
    DB_PORT: int = Field(
        default=5432,
        description="Database port"
    )
    DB_USER: str = Field(
        default="postgres",
        description="Database user"
    )
    DB_PASSWORD: str = Field(
        default="postgres",
        description="Database password"
    )
    DB_NAME: str = Field(
        default="schlep_engine_dev",
        description="Database name"
    )
    
    # Connection pooling settings
    DB_POOL_SIZE: int = Field(
        default=10,
        description="Database connection pool size"
    )
    DB_MAX_OVERFLOW: int = Field(
        default=20,
        description="Database connection pool max overflow"
    )
    
    @property
    def ASYNC_DATABASE_URI(self) -> str:
        """Generate async database URI without connection pooling parameters"""
        # If DATABASE_URL is already set (like from Supabase), use it
        if self.DATABASE_URL and self.DATABASE_URL != "postgresql://postgres:postgres@localhost:5432/schlep_engine_dev":
            # Convert postgresql:// to postgresql+asyncpg:// for SQLAlchemy async
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL

        # Fallback to component-based construction without pool parameters
        # Pool parameters should be passed to create_async_engine, not in URL
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )
    
    @property
    def is_supabase_enabled(self) -> bool:
        """Check if Supabase configuration is available"""
        return bool(self.SUPABASE_URL and self.SUPABASE_ANON_KEY and self.SUPABASE_SERVICE_KEY)
    
    # ==================== REDIS SETTINGS ====================
    
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    REDIS_HOST: str = Field(
        default="localhost",
        description="Redis host"
    )
    REDIS_PORT: int = Field(
        default=6379,
        description="Redis port"
    )
    REDIS_DB: int = Field(
        default=0,
        description="Redis database number"
    )
    
    # Redis performance settings
    REDIS_MAX_CONNECTIONS: int = Field(
        default=50,
        description="Maximum Redis connections"
    )
    REDIS_CONNECTION_TIMEOUT: int = Field(
        default=5,
        description="Redis connection timeout in seconds"
    )
    
    # ==================== JWT SETTINGS ====================
    
    JWT_SECRET_KEY: str = Field(
        default="",  # Must be set via environment variable
        description="JWT secret key (REQUIRED - set via JWT_SECRET_KEY env var)"
    )
    JWT_ALGORITHM: str = Field(
        default="HS256", 
        description="JWT algorithm"
    )
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30, 
        description="Access token expiration in minutes"
    )
    
    # ==================== SECURITY SETTINGS ====================
    
    # Encryption key - must be set via environment variable
    ENCRYPTION_KEY: str = Field(
        default="",  # Must be set via environment variable
        description="Encryption key (REQUIRED - set via ENCRYPTION_KEY env var)"
    )
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = Field(
        default=60, 
        description="Rate limit per minute"
    )
    RATE_LIMIT_PER_HOUR: int = Field(
        default=1000,
        description="Rate limit per hour"
    )
    
    # Security features
    ENHANCED_AUTH_ENABLED: bool = Field(
        default=True, 
        description="Enable enhanced authentication"
    )
    
    # ==================== CORS SETTINGS ====================
    
    BACKEND_CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="CORS origins (comma-separated)"
    )
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list for FastAPI."""
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]
    
    @property
    def secure_cors_origins(self) -> List[str]:
        """Get environment-appropriate CORS origins with security validation"""
        # Start with environment-specific origins
        if self.ENVIRONMENT == Environment.DEVELOPMENT:
            base_origins = [
                "http://localhost:3000",
                "http://localhost:3001", 
                "http://localhost:3002",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:3002"
            ]
        elif self.ENVIRONMENT == Environment.STAGING:
            base_origins = [
                "https://staging.schlep-engine.com",
                "https://staging-admin.schlep-engine.com"
            ]
        elif self.ENVIRONMENT == Environment.PRODUCTION:
            base_origins = [
                "https://schlep-engine.com",
                "https://www.schlep-engine.com",
                "https://admin.schlep-engine.com"
            ]
        else:
            base_origins = []
        
        # Add custom origins from environment variable
        custom_origins = self.cors_origins_list
        
        # Combine and validate origins
        all_origins = list(set(base_origins + custom_origins))
        
        # Security validation: ensure HTTPS in production/staging
        if self.ENVIRONMENT in [Environment.STAGING, Environment.PRODUCTION]:
            validated_origins = []
            for origin in all_origins:
                if origin.startswith("https://") or origin == "null":
                    validated_origins.append(origin)
                else:
                    print(f"⚠️  Security warning: Non-HTTPS origin '{origin}' ignored in {self.ENVIRONMENT} environment")
            return validated_origins
        
        return all_origins
    
    @property
    def cors_allow_credentials(self) -> bool:
        """Whether to allow credentials in CORS"""
        return self.ENVIRONMENT != Environment.DEVELOPMENT
    
    # ==================== FILE UPLOAD SETTINGS ====================
    
    UPLOAD_DIR: str = Field(
        default="./uploads", 
        description="Upload directory"
    )
    MAX_FILE_SIZE: str = Field(
        default="100MB", 
        description="Maximum file size"
    )
    ALLOWED_FILE_TYPES: str = Field(
        default="csv,json,xlsx,xls,txt,parquet",
        description="Allowed file types"
    )
    
    # ==================== CELERY SETTINGS ====================
    
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Celery broker URL"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/1",
        description="Celery result backend URL"
    )
    
    # ==================== CLOUD STORAGE SETTINGS ====================
    
    CLOUD_STORAGE_BUCKET_NAME: str = Field(
        default="schlep-engine-storage",
        description="Google Cloud Storage bucket name"
    )
    CDN_DOMAIN: Optional[str] = Field(
        default=None,
        description="CDN domain for serving files (e.g., cdn.schlep-engine.com)"
    )
    MAX_FILE_SIZE_BYTES: int = Field(
        default=100 * 1024 * 1024,  # 100MB
        description="Maximum file size in bytes"
    )
    FILE_RETENTION_DAYS: int = Field(
        default=30,
        description="File retention period in days"
    )
    GOOGLE_CLOUD_CREDENTIALS_PATH: Optional[str] = Field(
        default=None,
        description="Path to Google Cloud service account credentials file"
    )
    
    # ==================== EXTERNAL SERVICES ====================
    
    # LemonSqueezy (if using)
    LEMONSQUEEZY_API_KEY: str = Field(
        default="",
        description="LemonSqueezy API key"
    )
    LEMONSQUEEZY_WEBHOOK_SECRET: str = Field(
        default="",
        description="LemonSqueezy webhook secret"
    )
    
    # AI Model Settings
    MODEL_PATH: str = Field(
        default="models/",
        description="Path to AI models"
    )
    BATCH_SIZE: int = Field(
        default=32,
        description="Default batch size for processing"
    )
    
    # ==================== MONITORING SETTINGS ====================
    
    ENABLE_METRICS: bool = Field(
        default=True,
        description="Enable metrics collection"
    )
    PROMETHEUS_MULTIPROC_DIR: str = Field(
        default="/tmp",
        description="Prometheus multiprocess directory"
    )
    
    # ==================== PERFORMANCE SETTINGS ====================
    
    # Data processing optimization
    LARGE_FILE_THRESHOLD_MB: int = Field(
        default=100,
        description="Threshold for switching to streaming mode (MB)"
    )
    DEFAULT_CHUNK_SIZE: int = Field(
        default=10000,
        description="Default chunk size for streaming processing"
    )
    MAX_CACHE_SIZE: int = Field(
        default=1000,
        description="Maximum number of items in memory cache"
    )
    MISSING_VALUE_THRESHOLD: float = Field(
        default=0.8,
        description="Threshold for dropping columns with missing values"
    )
    
    # Performance monitoring
    PERFORMANCE_MONITORING_INTERVAL: int = Field(
        default=60,
        description="Performance monitoring interval in seconds"
    )
    SLOW_QUERY_THRESHOLD: float = Field(
        default=1.0,
        description="Slow query threshold in seconds"
    )
    
    # Memory management
    MEMORY_WARNING_THRESHOLD: float = Field(
        default=80.0,
        description="Memory usage warning threshold (percentage)"
    )
    MEMORY_CRITICAL_THRESHOLD: float = Field(
        default=95.0,
        description="Memory usage critical threshold (percentage)"
    )
    
    # CPU management
    CPU_WARNING_THRESHOLD: float = Field(
        default=75.0,
        description="CPU usage warning threshold (percentage)"
    )
    CPU_CRITICAL_THRESHOLD: float = Field(
        default=90.0,
        description="CPU usage critical threshold (percentage)"
    )
    
    # ==================== FEATURE FLAGS ====================
    
    SECURITY_FEATURES: Dict[str, bool] = Field(
        default={
            'encryption': False,
            'audit_logging': True,
            'mfa': False,
            'enhanced_dependencies': True,
            'session_management': True,
        },
        description="Security feature flags"
    )
    
    def get_security_config_for_environment(self, environment: str = None) -> Dict[str, bool]:
        """Get security configuration for specific environment"""
        if environment is None:
            environment = self.ENVIRONMENT.value
            
        configs = {
            Environment.DEVELOPMENT.value: {
                'encryption': False,
                'audit_logging': True,
                'mfa': False,
                'rate_limiting': False,
                'advanced_monitoring': False,
                'permission_checking': True,
                'security_headers': True,
                'pii_detection': True,
                'compliance_tracking': False,
                'data_classification': False
            },
            Environment.TESTING.value: {
                'encryption': False,
                'audit_logging': False,
                'mfa': False,
                'rate_limiting': False,
                'advanced_monitoring': False,
                'permission_checking': True,
                'security_headers': False,
                'pii_detection': True,
                'compliance_tracking': False,
                'data_classification': False
            },
            Environment.STAGING.value: {
                'encryption': True,
                'audit_logging': True,
                'mfa': False,
                'rate_limiting': True,
                'advanced_monitoring': True,
                'permission_checking': True,
                'security_headers': True,
                'pii_detection': True,
                'compliance_tracking': True,
                'data_classification': True
            },
            Environment.PRODUCTION.value: {
                'encryption': True,
                'audit_logging': True,
                'mfa': False,  # Enable when ready
                'rate_limiting': True,
                'advanced_monitoring': True,
                'permission_checking': True,
                'security_headers': True,
                'pii_detection': True,
                'compliance_tracking': True,
                'data_classification': True
            }
        }
        return configs.get(environment, {})
    
    @property
    def rate_limit_per_minute(self) -> int:
        """Get environment-appropriate rate limit"""
        if self.ENVIRONMENT == Environment.DEVELOPMENT:
            return 1000  # Relaxed for development
        elif self.ENVIRONMENT == Environment.STAGING:
            return 200   # Moderate for staging
        else:
            return 60    # Strict for production
    
    # ==================== VALIDATION ====================
    
    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret_key(cls, v):
        if not v:
            raise ValueError("JWT_SECRET_KEY must be set via environment variable")
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")
        return v
    
    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, v):
        if not v:
            raise ValueError("ENCRYPTION_KEY must be set via environment variable")
        if len(v) < 32:
            raise ValueError("ENCRYPTION_KEY must be at least 32 characters long")
        return v
    
    model_config = ConfigDict(
        env_file=".env.development",  # Default to development
        case_sensitive=True
    )


@lru_cache()
def get_settings() -> UnifiedSettings:
    """Get cached settings instance"""
    return UnifiedSettings()


# Create settings instance
settings = get_settings()

# Backward compatibility aliases
DATABASE_URL = settings.DATABASE_URL
JWT_SECRET_KEY = settings.JWT_SECRET_KEY
JWT_ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
SECRET_KEY = settings.JWT_SECRET_KEY  # Legacy alias

# Export main components
__all__ = [
    'UnifiedSettings',
    'Environment', 
    'SecurityLevel',
    'get_settings',
    'settings',
    'DATABASE_URL',
    'JWT_SECRET_KEY',
    'JWT_ALGORITHM',
    'ACCESS_TOKEN_EXPIRE_MINUTES',
    'SECRET_KEY'
] 