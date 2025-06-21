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
"""

import os
import logging
from typing import Dict, Any, List, Optional, Union
from enum import Enum
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

logger = logging.getLogger(__name__)

class Environment(str, Enum):
    """Environment types"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"

class SecurityLevel(str, Enum):
    """Security levels for different operations"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class UnifiedSettings(BaseSettings):
    """
    Unified Settings Class
    
    Consolidates all configuration from:
    - app/core/config.py
    - app/core/api_config.py
    - app/core/security_config.py
    - Environment variables
    - Feature flags
    """
    
    # ==================== CORE APPLICATION SETTINGS ====================
    
    # Environment
    ENVIRONMENT: Environment = Field(default=Environment.DEVELOPMENT, description="Application environment")
    DEBUG: bool = Field(default=True, description="Debug mode")
    TESTING_MODE: bool = Field(default=False, description="Enable testing mode")
    
    # API Configuration
    API_V1_STR: str = Field(default="/api/v1", description="API v1 prefix")
    PROJECT_NAME: str = Field(default="Pollarbase", description="Project name")
    PROJECT_VERSION: str = Field(default="1.0.0", description="Project version")
    
    # ==================== DATABASE SETTINGS ====================
    
    DATABASE_URL: str = Field(
        default="postgresql://wira@localhost:5432/pollarbase_dev",
        description="Database connection URL"
    )
    
    # ==================== JWT SETTINGS ====================
    
    JWT_SECRET_KEY: str = Field(
        default="dev_jwt_secret_key_change_in_production_2024",
        description="JWT secret key"
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expiration in minutes")
    
    # ==================== SECURITY SETTINGS ====================
    
    ENHANCED_AUTH_ENABLED: bool = Field(default=True, description="Enable enhanced authentication")
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, description="Rate limit per minute")
    
    # ==================== CORS SETTINGS ====================
    
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="CORS origins"
    )
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # ==================== FILE UPLOAD SETTINGS ====================
    
    UPLOAD_DIR: str = Field(default="./uploads", description="Upload directory")
    MAX_FILE_SIZE: str = Field(default="100MB", description="Maximum file size")
    ALLOWED_FILE_TYPES: str = Field(
        default="csv,json,xlsx,xls,txt,parquet",
        description="Allowed file types"
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
        description="Security feature flags")
    
    def get_security_config_for_environment(self, environment: str) -> Dict[str, bool]:
        """Get security configuration for specific environment"""
        configs = {
            "development": {
                'encryption': False,
                'audit_logging': True,
                'mfa': False,
                'rate_limiting': False,
            },
            "production": {
                'encryption': True,
                'audit_logging': True,
                'mfa': True,
                'rate_limiting': True,
            }
        }
        return configs.get(environment, {})
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# ==================== CONFIGURATION FACTORY ====================

@lru_cache()
def get_settings() -> UnifiedSettings:
    """Get unified settings instance (cached)"""
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