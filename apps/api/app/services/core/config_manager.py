"""
CENTRALIZED CONFIGURATION MANAGEMENT
===================================

Replaces hardcoded values and provides environment-based configuration.

This eliminates:
- Magic numbers scattered throughout code
- Inconsistent defaults
- Environment-specific hardcoding
- Configuration drift between environments
"""

import os
from typing import List, Dict, Any, Optional
from pydantic import BaseSettings, Field, validator
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class Environment(str, Enum):
    """Environment types"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"

class LogLevel(str, Enum):
    """Log levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class ProcessingConfig(BaseSettings):
    """
    Centralized configuration for all data processing operations.
    
    Supports:
    - Environment-specific settings
    - Validation and type checking
    - Default values with documentation
    - Runtime configuration updates
    """
    
    # ==========================================
    # ENVIRONMENT & APPLICATION SETTINGS
    # ==========================================
    
    environment: Environment = Field(
        default=Environment.DEVELOPMENT,
        description="Current environment (development/staging/production/testing)"
    )
    
    debug: bool = Field(
        default=True,
        description="Enable debug mode"
    )
    
    app_name: str = Field(
        default="Schlep Engine",
        description="Application name"
    )
    
    app_version: str = Field(
        default="1.0.0",
        description="Application version"
    )
    
    log_level: LogLevel = Field(
        default=LogLevel.INFO,
        description="Logging level"
    )
    
    performance_logging: bool = Field(
        default=True,
        description="Enable performance logging"
    )
    
    # ==========================================
    # FILE PROCESSING SETTINGS
    # ==========================================
    
    max_file_size_mb: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Maximum file size in MB"
    )
    
    chunk_size: int = Field(
        default=10000,
        ge=1000,
        le=100000,
        description="Chunk size for streaming processing"
    )
    
    large_file_threshold_mb: int = Field(
        default=50,
        ge=10,
        le=500,
        description="File size threshold for streaming mode (MB)"
    )
    
    supported_formats: List[str] = Field(
        default=["csv", "json", "xlsx", "parquet", "xml"],
        description="Supported file formats"
    )
    
    max_concurrent_jobs: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum concurrent processing jobs"
    )
    
    processing_timeout_seconds: int = Field(
        default=300,
        ge=30,
        le=3600,
        description="Processing timeout in seconds"
    )
    
    # ==========================================
    # DATA QUALITY SETTINGS
    # ==========================================
    
    outlier_threshold: float = Field(
        default=3.0,
        ge=1.0,
        le=5.0,
        description="Z-score threshold for outlier detection"
    )
    
    missing_value_threshold: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Missing value percentage threshold for column removal"
    )
    
    quality_score_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum quality score for data acceptance"
    )
    
    anomaly_detection_sensitivity: float = Field(
        default=0.05,
        ge=0.01,
        le=0.2,
        description="Sensitivity for anomaly detection (lower = more sensitive)"
    )
    
    # ==========================================
    # AI & MACHINE LEARNING SETTINGS  
    # ==========================================
    
    ai_analysis_enabled: bool = Field(
        default=True,
        description="Enable AI-powered analysis"
    )
    
    pattern_confidence_threshold: float = Field(
        default=0.7,
        ge=0.1,
        le=1.0,
        description="Pattern recognition confidence threshold"
    )
    
    ml_model_cache_size: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of ML models to keep in cache"
    )
    
    feature_engineering_enabled: bool = Field(
        default=True,
        description="Enable automatic feature engineering"
    )
    
    auto_feature_selection: bool = Field(
        default=True,
        description="Enable automatic feature selection"
    )
    
    max_features: int = Field(
        default=1000,
        ge=10,
        le=10000,
        description="Maximum number of features to process"
    )
    
    # ==========================================
    # PERFORMANCE & CACHING SETTINGS
    # ==========================================
    
    max_cache_size: int = Field(
        default=100,
        ge=10,
        le=1000,
        description="Maximum number of cached results"
    )
    
    cache_ttl_seconds: int = Field(
        default=3600,
        ge=300,
        le=86400,
        description="Cache time-to-live in seconds"
    )
    
    memory_limit_mb: int = Field(
        default=1024,
        ge=256,
        le=8192,
        description="Memory limit for processing operations (MB)"
    )
    
    cpu_cores_limit: int = Field(
        default=4,
        ge=1,
        le=32,
        description="CPU cores limit for parallel processing"
    )
    
    enable_compression: bool = Field(
        default=True,
        description="Enable data compression for storage"
    )
    
    # ==========================================
    # DATABASE SETTINGS
    # ==========================================
    
    db_pool_size: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Database connection pool size"
    )
    
    db_max_overflow: int = Field(
        default=20,
        ge=0,
        le=100,
        description="Database connection pool overflow"
    )
    
    db_query_timeout: int = Field(
        default=30,
        ge=5,
        le=300,
        description="Database query timeout in seconds"
    )
    
    enable_query_logging: bool = Field(
        default=False,
        description="Enable database query logging"
    )
    
    # ==========================================
    # API SETTINGS
    # ==========================================
    
    api_rate_limit_per_minute: int = Field(
        default=100,
        ge=10,
        le=10000,
        description="API rate limit per minute per user"
    )
    
    api_request_timeout: int = Field(
        default=60,
        ge=10,
        le=300,
        description="API request timeout in seconds"
    )
    
    enable_cors: bool = Field(
        default=True,
        description="Enable CORS for API"
    )
    
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3002"],
        description="Allowed CORS origins"
    )
    
    # ==========================================
    # SECURITY SETTINGS
    # ==========================================
    
    jwt_expire_minutes: int = Field(
        default=30,
        ge=5,
        le=1440,
        description="JWT token expiration in minutes"
    )
    
    password_min_length: int = Field(
        default=8,
        ge=6,
        le=50,
        description="Minimum password length"
    )
    
    max_login_attempts: int = Field(
        default=5,
        ge=3,
        le=10,
        description="Maximum login attempts before lockout"
    )
    
    session_timeout_hours: int = Field(
        default=24,
        ge=1,
        le=168,
        description="Session timeout in hours"
    )
    
    encryption_enabled: bool = Field(
        default=True,
        description="Enable data encryption at rest"
    )
    
    # ==========================================
    # MONITORING & OBSERVABILITY
    # ==========================================
    
    metrics_enabled: bool = Field(
        default=True,
        description="Enable metrics collection"
    )
    
    metrics_retention_days: int = Field(
        default=30,
        ge=7,
        le=365,
        description="Metrics retention period in days"
    )
    
    error_tracking_enabled: bool = Field(
        default=True,
        description="Enable error tracking"
    )
    
    performance_monitoring_enabled: bool = Field(
        default=True,
        description="Enable performance monitoring"
    )
    
    audit_logging_enabled: bool = Field(
        default=True,
        description="Enable audit logging"
    )
    
    # ==========================================
    # EXTERNAL INTEGRATIONS
    # ==========================================
    
    openai_api_timeout: int = Field(
        default=30,
        ge=10,
        le=120,
        description="OpenAI API timeout in seconds"
    )
    
    anthropic_api_timeout: int = Field(
        default=30,
        ge=10,
        le=120,
        description="Anthropic API timeout in seconds"
    )
    
    webhook_timeout: int = Field(
        default=10,
        ge=5,
        le=60,
        description="Webhook timeout in seconds"
    )
    
    webhook_retry_count: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Number of webhook retry attempts"
    )
    
    # ==========================================
    # VALIDATION & CONFIGURATION
    # ==========================================
    
    @validator('environment')
    def validate_environment(cls, v):
        """Validate environment setting"""
        if v not in Environment:
            raise ValueError(f"Invalid environment: {v}")
        return v
    
    @validator('chunk_size')
    def validate_chunk_size(cls, v, values):
        """Ensure chunk size is reasonable"""
        max_file_size = values.get('max_file_size_mb', 100)
        max_chunk = max_file_size * 1024 * 1024 // 8  # Rough estimate
        if v > max_chunk:
            logger.warning(f"Chunk size {v} may be too large for max file size {max_file_size}MB")
        return v
    
    @validator('cors_origins')
    def validate_cors_origins(cls, v, values):
        """Validate CORS origins for production"""
        environment = values.get('environment')
        if environment == Environment.PRODUCTION:
            localhost_origins = [origin for origin in v if 'localhost' in origin]
            if localhost_origins:
                logger.warning(f"Localhost origins in production CORS: {localhost_origins}")
        return v
    
    class Config:
        env_prefix = "SCHLEP_ENGINE_"
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        validate_assignment = True

class ConfigManager:
    """
    Configuration manager with runtime updates and validation.
    """
    
    def __init__(self):
        self._config = ProcessingConfig()
        self._listeners: List[callable] = []
        self._overrides: Dict[str, Any] = {}
    
    @property
    def config(self) -> ProcessingConfig:
        """Get current configuration"""
        return self._config
    
    def reload(self):
        """Reload configuration from environment"""
        old_config = self._config.dict()
        self._config = ProcessingConfig()
        
        # Apply any runtime overrides
        for key, value in self._overrides.items():
            if hasattr(self._config, key):
                setattr(self._config, key, value)
        
        new_config = self._config.dict()
        
        # Notify listeners of changes
        if old_config != new_config:
            self._notify_listeners(old_config, new_config)
        
        logger.info("Configuration reloaded")
    
    def override(self, key: str, value: Any):
        """Set runtime override for configuration value"""
        if not hasattr(self._config, key):
            raise ValueError(f"Unknown configuration key: {key}")
        
        old_value = getattr(self._config, key)
        self._overrides[key] = value
        setattr(self._config, key, value)
        
        logger.info(f"Configuration override: {key} = {value} (was {old_value})")
        
        # Notify listeners
        self._notify_listeners({key: old_value}, {key: value})
    
    def remove_override(self, key: str):
        """Remove runtime override"""
        if key in self._overrides:
            del self._overrides[key]
            # Reload to get original value
            self.reload()
    
    def add_listener(self, callback: callable):
        """Add configuration change listener"""
        self._listeners.append(callback)
    
    def remove_listener(self, callback: callable):
        """Remove configuration change listener"""
        if callback in self._listeners:
            self._listeners.remove(callback)
    
    def _notify_listeners(self, old_config: Dict, new_config: Dict):
        """Notify listeners of configuration changes"""
        for listener in self._listeners:
            try:
                listener(old_config, new_config)
            except Exception as e:
                logger.error(f"Error in configuration listener: {e}")
    
    def get_environment_summary(self) -> Dict[str, Any]:
        """Get summary of current configuration for debugging"""
        return {
            "environment": self._config.environment,
            "debug": self._config.debug,
            "app_version": self._config.app_version,
            "max_file_size_mb": self._config.max_file_size_mb,
            "ai_analysis_enabled": self._config.ai_analysis_enabled,
            "metrics_enabled": self._config.metrics_enabled,
            "overrides": list(self._overrides.keys()),
            "performance_settings": {
                "chunk_size": self._config.chunk_size,
                "max_concurrent_jobs": self._config.max_concurrent_jobs,
                "memory_limit_mb": self._config.memory_limit_mb,
                "cpu_cores_limit": self._config.cpu_cores_limit
            }
        }
    
    def validate_for_environment(self, environment: Environment) -> List[str]:
        """Validate configuration for specific environment"""
        warnings = []
        
        if environment == Environment.PRODUCTION:
            if self._config.debug:
                warnings.append("Debug mode enabled in production")
            
            if self._config.log_level == LogLevel.DEBUG:
                warnings.append("Debug logging enabled in production")
            
            if any('localhost' in origin for origin in self._config.cors_origins):
                warnings.append("Localhost CORS origins in production")
        
        elif environment == Environment.DEVELOPMENT:
            if not self._config.debug:
                warnings.append("Debug mode disabled in development")
        
        return warnings

# Global configuration manager
config_manager = ConfigManager()

# Convenience access to configuration
def get_config() -> ProcessingConfig:
    """Get current configuration instance"""
    return config_manager.config

def reload_config():
    """Reload configuration from environment"""
    config_manager.reload()

def override_config(key: str, value: Any):
    """Set runtime configuration override"""
    config_manager.override(key, value)

# Auto-configure based on environment
def configure_for_environment():
    """Auto-configure based on current environment"""
    config = get_config()
    
    if config.environment == Environment.PRODUCTION:
        # Production optimizations
        override_config('debug', False)
        override_config('log_level', LogLevel.WARNING)
        override_config('performance_logging', False)
        
    elif config.environment == Environment.DEVELOPMENT:
        # Development conveniences
        override_config('debug', True)
        override_config('log_level', LogLevel.DEBUG)
        override_config('performance_logging', True)
        
    elif config.environment == Environment.TESTING:
        # Testing optimizations
        override_config('debug', False)
        override_config('metrics_enabled', False)
        override_config('ai_analysis_enabled', False)
    
    logger.info(f"Configured for {config.environment} environment")

# Initialize configuration
configure_for_environment()