"""
Configuration management for Schlep-engine
Integrates with environment-specific configuration
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field

from app.core.environments import get_environment_config, Environment

class Settings(BaseSettings):
    """Application settings with environment-specific configuration"""
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    APP_VERSION: str = Field(default="1.0.0", env="APP_VERSION")
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # Server
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    WORKERS: int = Field(default=1, env="WORKERS")
    RELOAD: bool = Field(default=True, env="RELOAD")
    
    # Database
    DB_HOST: str = Field(default="localhost", env="DB_HOST")
    DB_PORT: int = Field(default=5432, env="DB_PORT")
    DB_NAME: str = Field(default="schlep_engine", env="DB_NAME")
    DB_USER: str = Field(default="postgres", env="DB_USER")
    DB_PASSWORD: str = Field(default="password", env="DB_PASSWORD")
    DB_POOL_SIZE: int = Field(default=10, env="DB_POOL_SIZE")
    DB_MAX_OVERFLOW: int = Field(default=20, env="DB_MAX_OVERFLOW")
    
    # Redis
    REDIS_HOST: str = Field(default="localhost", env="REDIS_HOST")
    REDIS_PORT: int = Field(default=6379, env="REDIS_PORT")
    REDIS_PASSWORD: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    REDIS_DB: int = Field(default=0, env="REDIS_DB")
    REDIS_URL: Optional[str] = Field(default=None, env="REDIS_URL")
    USE_REDIS_CACHE: bool = Field(default=False, env="USE_REDIS_CACHE")
    
    # Storage
    STORAGE_PROVIDER: str = Field(default="local", env="STORAGE_PROVIDER")
    STORAGE_BUCKET: str = Field(default="schlep-engine", env="STORAGE_BUCKET")
    STORAGE_CREDENTIALS_PATH: Optional[str] = Field(default=None, env="STORAGE_CREDENTIALS_PATH")
    STORAGE_REGION: str = Field(default="us-central1", env="STORAGE_REGION")
    CDN_URL: Optional[str] = Field(default=None, env="CDN_URL")
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")
    JWT_SECRET_KEY: str = Field(..., env="JWT_SECRET_KEY", alias="SECRET_KEY")
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM", alias="ALGORITHM")
    
    # OAuth Configuration
    GOOGLE_CLIENT_ID: str = Field(..., env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = Field(..., env="GOOGLE_CLIENT_SECRET")
    GITHUB_CLIENT_ID: str = Field(..., env="GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: str = Field(..., env="GITHUB_CLIENT_SECRET")
    OAUTH_REDIRECT_URI: str = Field(default="http://localhost:8000/api/v1/auth/oauth/callback", env="OAUTH_REDIRECT_URI")
    
    # Monitoring
    SENTRY_DSN: Optional[str] = Field(default=None, env="SENTRY_DSN")
    SENTRY_ENVIRONMENT: str = Field(default="development", env="SENTRY_ENVIRONMENT")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1, env="SENTRY_TRACES_SAMPLE_RATE")
    SENTRY_PROFILES_SAMPLE_RATE: float = Field(default=0.1, env="SENTRY_PROFILES_SAMPLE_RATE")
    
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FILE: Optional[str] = Field(default=None, env="LOG_FILE")
    
    PROMETHEUS_ENABLED: bool = Field(default=True, env="PROMETHEUS_ENABLED")
    METRICS_RETENTION_DAYS: int = Field(default=30, env="METRICS_RETENTION_DAYS")
    
    # Celery - Enhanced for AI workloads
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0", env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/0", env="CELERY_RESULT_BACKEND")
    CELERY_WORKER_CONCURRENCY: int = Field(default=4, env="CELERY_WORKER_CONCURRENCY")
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = Field(default=1, env="CELERY_WORKER_PREFETCH_MULTIPLIER")

    # Distributed Processing - Simplified
    ENABLE_DISTRIBUTED_PROCESSING: bool = Field(default=True, env="ENABLE_DISTRIBUTED_PROCESSING")
    MAX_CONCURRENT_JOBS: int = Field(default=10, env="MAX_CONCURRENT_JOBS")
    
    # External Services
    ML_SERVICE_URL: Optional[str] = Field(default=None, env="ML_SERVICE_URL")
    EMAIL_SERVICE_URL: Optional[str] = Field(default=None, env="EMAIL_SERVICE_URL")
    NOTIFICATION_SERVICE_URL: Optional[str] = Field(default=None, env="NOTIFICATION_SERVICE_URL")
    
    # CORS
    ALLOWED_ORIGINS: list = Field(default=["http://localhost:3000"], env="ALLOWED_ORIGINS")
    ALLOWED_HOSTS: list = Field(default=["localhost", "127.0.0.1"], env="ALLOWED_HOSTS")
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    RATE_LIMIT_WINDOW: int = Field(default=60, env="RATE_LIMIT_WINDOW")
    
    # Circuit Breaker Configuration
    CIRCUIT_BREAKER_STORAGE: str = Field(default="redis", env="CIRCUIT_BREAKER_STORAGE")
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = Field(default=5, env="CIRCUIT_BREAKER_FAILURE_THRESHOLD")
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT: int = Field(default=60, env="CIRCUIT_BREAKER_RECOVERY_TIMEOUT")
    CIRCUIT_BREAKER_REDIS_TTL: int = Field(default=120, env="CIRCUIT_BREAKER_REDIS_TTL")
    
    # Health Check Configuration
    HEALTH_CHECK_INTERVAL: int = Field(default=30, env="HEALTH_CHECK_INTERVAL")
    HEALTH_CHECK_TIMEOUT: int = Field(default=10, env="HEALTH_CHECK_TIMEOUT")
    HEALTH_CHECK_CRITICAL_SERVICES: list = Field(default=["database", "redis"], env="HEALTH_CHECK_CRITICAL_SERVICES")
    HEALTH_CHECK_DEPENDENCY_TIMEOUT: float = Field(default=5.0, env="HEALTH_CHECK_DEPENDENCY_TIMEOUT")
    HEALTH_CHECK_CACHE_TTL: int = Field(default=60, env="HEALTH_CHECK_CACHE_TTL")
    
    # Reliability and Retry Configuration
    RETRY_MAX_ATTEMPTS: int = Field(default=3, env="RETRY_MAX_ATTEMPTS")
    RETRY_BASE_DELAY: float = Field(default=1.0, env="RETRY_BASE_DELAY")
    RETRY_MAX_DELAY: float = Field(default=60.0, env="RETRY_MAX_DELAY")
    RETRY_EXPONENTIAL_BASE: float = Field(default=2.0, env="RETRY_EXPONENTIAL_BASE")
    RETRY_JITTER_ENABLED: bool = Field(default=True, env="RETRY_JITTER_ENABLED")
    RETRY_JITTER_FACTOR: float = Field(default=0.1, env="RETRY_JITTER_FACTOR")
    
    # Dead Letter Queue Configuration
    DEAD_LETTER_QUEUE_ENABLED: bool = Field(default=True, env="DEAD_LETTER_QUEUE_ENABLED")
    DEAD_LETTER_QUEUE_MAX_RETRIES: int = Field(default=3, env="DEAD_LETTER_QUEUE_MAX_RETRIES")
    DEAD_LETTER_QUEUE_PROCESS_INTERVAL: int = Field(default=300, env="DEAD_LETTER_QUEUE_PROCESS_INTERVAL")
    DEAD_LETTER_QUEUE_RETENTION_DAYS: int = Field(default=7, env="DEAD_LETTER_QUEUE_RETENTION_DAYS")
    
    # Request Timeout Configuration
    REQUEST_TIMEOUT_DEFAULT: float = Field(default=30.0, env="REQUEST_TIMEOUT_DEFAULT")
    REQUEST_TIMEOUT_SHORT: float = Field(default=5.0, env="REQUEST_TIMEOUT_SHORT")
    REQUEST_TIMEOUT_LONG: float = Field(default=120.0, env="REQUEST_TIMEOUT_LONG")
    REQUEST_TIMEOUT_ML: float = Field(default=300.0, env="REQUEST_TIMEOUT_ML")
    REQUEST_TIMEOUT_STORAGE: float = Field(default=60.0, env="REQUEST_TIMEOUT_STORAGE")
    
    # Service Mesh and Observability
    DISTRIBUTED_TRACING_ENABLED: bool = Field(default=True, env="DISTRIBUTED_TRACING_ENABLED")
    DISTRIBUTED_TRACING_SAMPLE_RATE: float = Field(default=0.1, env="DISTRIBUTED_TRACING_SAMPLE_RATE")
    SERVICE_MESH_ENABLED: bool = Field(default=False, env="SERVICE_MESH_ENABLED")
    OBSERVABILITY_METRICS_RETENTION_DAYS: int = Field(default=30, env="OBSERVABILITY_METRICS_RETENTION_DAYS")
    
    # File Upload - AI-friendly limits
    MAX_FILE_SIZE: int = Field(default=2 * 1024 * 1024 * 1024, env="MAX_FILE_SIZE")  # 2GB for AI datasets
    ALLOWED_FILE_TYPES: list = Field(default=["csv", "json", "xlsx", "parquet", "txt", "jsonl", "tsv"], env="ALLOWED_FILE_TYPES")
    
    # Security Settings
    PASSWORD_MIN_LENGTH: int = Field(default=8, env="PASSWORD_MIN_LENGTH")
    MAX_LOGIN_ATTEMPTS: int = Field(default=5, env="MAX_LOGIN_ATTEMPTS")
    LOCKOUT_DURATION_MINUTES: int = Field(default=15, env="LOCKOUT_DURATION_MINUTES")
    
    # LemonSqueezy Configuration
    LEMONSQUEEZY_API_KEY: Optional[str] = Field(default=None, env="LEMONSQUEEZY_API_KEY")
    LEMONSQUEEZY_WEBHOOK_SECRET: Optional[str] = Field(default=None, env="LEMONSQUEEZY_WEBHOOK_SECRET")
    LEMONSQUEEZY_STORE_ID: Optional[str] = Field(default=None, env="LEMONSQUEEZY_STORE_ID")
    
    # Feature Flags
    ENABLE_ADVANCED_AI: bool = Field(default=True, env="ENABLE_ADVANCED_AI")
    ENABLE_ML_PIPELINE: bool = Field(default=True, env="ENABLE_ML_PIPELINE")
    ENABLE_DATA_PROCESSING: bool = Field(default=True, env="ENABLE_DATA_PROCESSING")
    ENABLE_STORAGE: bool = Field(default=True, env="ENABLE_STORAGE")
    ENABLE_MONITORING: bool = Field(default=True, env="ENABLE_MONITORING")
    ENABLE_SECURITY: bool = Field(default=True, env="ENABLE_SECURITY")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._env_config = None
        self._load_environment_config()
    
    def _load_environment_config(self):
        """Load environment-specific configuration"""
        try:
            self._env_config = get_environment_config()
            self._override_with_environment_config()
        except Exception as e:
            # Fallback to default configuration if environment config fails
            print(f"Warning: Failed to load environment config: {e}")
    
    def _override_with_environment_config(self):
        """Override settings with environment-specific configuration"""
        if not self._env_config:
            return
        
        env_config = self._env_config.config
        
        # Override app settings
        app_config = env_config["app"]
        self.HOST = app_config["host"]
        self.PORT = app_config["port"]
        self.WORKERS = app_config["workers"]
        self.DEBUG = app_config["debug"]
        
        # Override database settings
        db_config = env_config["database"]
        self.DB_HOST = db_config.host
        self.DB_PORT = db_config.port
        self.DB_NAME = db_config.database
        self.DB_USER = db_config.username
        self.DB_PASSWORD = db_config.password
        self.DB_POOL_SIZE = db_config.pool_size
        self.DB_MAX_OVERFLOW = db_config.max_overflow
        
        # Override Redis settings
        redis_config = env_config["redis"]
        self.REDIS_HOST = redis_config.host
        self.REDIS_PORT = redis_config.port
        self.REDIS_PASSWORD = redis_config.password
        self.REDIS_DB = redis_config.database
        
        # Override storage settings
        storage_config = env_config["storage"]
        self.STORAGE_PROVIDER = storage_config.provider
        self.STORAGE_BUCKET = storage_config.bucket_name
        self.STORAGE_CREDENTIALS_PATH = storage_config.credentials_path
        self.STORAGE_REGION = storage_config.region
        self.CDN_URL = storage_config.cdn_url
        
        # Override security settings
        security_config = env_config["security"]
        self.SECRET_KEY = security_config.secret_key
        self.ALGORITHM = security_config.algorithm
        self.ACCESS_TOKEN_EXPIRE_MINUTES = security_config.access_token_expire_minutes
        self.REFRESH_TOKEN_EXPIRE_DAYS = security_config.refresh_token_expire_days
        self.PASSWORD_MIN_LENGTH = security_config.password_min_length
        self.MAX_LOGIN_ATTEMPTS = security_config.max_login_attempts
        self.LOCKOUT_DURATION_MINUTES = security_config.lockout_duration_minutes
        
        # Override monitoring settings
        monitoring_config = env_config["monitoring"]
        self.SENTRY_DSN = monitoring_config.sentry_dsn
        self.LOG_LEVEL = monitoring_config.log_level
        self.LOG_FILE = monitoring_config.log_file
        self.PROMETHEUS_ENABLED = monitoring_config.prometheus_enabled
        self.METRICS_RETENTION_DAYS = monitoring_config.metrics_retention_days
        
        # Override Celery settings
        celery_config = env_config["celery"]
        self.CELERY_BROKER_URL = celery_config.broker_url
        self.CELERY_RESULT_BACKEND = celery_config.result_backend
        
        # Override external services
        external_services = env_config["external_services"]
        self.ML_SERVICE_URL = external_services["ml_service_url"]
        self.EMAIL_SERVICE_URL = external_services["email_service_url"]
        self.NOTIFICATION_SERVICE_URL = external_services["notification_service_url"]
        
        # Override feature flags
        features = env_config["features"]
        self.ENABLE_ADVANCED_AI = features["enable_advanced_ai"]
        self.ENABLE_ML_PIPELINE = features["enable_ml_pipeline"]
        self.ENABLE_DATA_PROCESSING = features["enable_data_processing"]
        self.ENABLE_STORAGE = features["enable_storage"]
        self.ENABLE_MONITORING = features["enable_monitoring"]
        self.ENABLE_SECURITY = features["enable_security"]
    
    @property
    def database_url(self) -> str:
        """Get database URL"""
        if self._env_config:
            return self._env_config.get_database_url()
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def redis_url(self) -> str:
        """Get Redis URL"""
        if self.REDIS_URL:
            return self.REDIS_URL
        if self._env_config:
            return self._env_config.get_redis_url()
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_staging(self) -> bool:
        """Check if running in staging"""
        return self.ENVIRONMENT.lower() == "staging"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in testing"""
        return self.ENVIRONMENT.lower() == "testing"
    
    def get_feature_flag(self, feature: str) -> bool:
        """Get feature flag value"""
        if self._env_config:
            return self._env_config.is_feature_enabled(feature)
        
        # Fallback to settings
        feature_map = {
            "advanced_ai": self.ENABLE_ADVANCED_AI,
            "ml_pipeline": self.ENABLE_ML_PIPELINE,
            "data_processing": self.ENABLE_DATA_PROCESSING,
            "storage": self.ENABLE_STORAGE,
            "monitoring": self.ENABLE_MONITORING,
            "security": self.ENABLE_SECURITY,
        }
        return feature_map.get(feature, False)
    
    def get_external_service_url(self, service: str) -> Optional[str]:
        """Get external service URL"""
        if self._env_config:
            return self._env_config.get_external_service_url(service)
        
        # Fallback to settings
        service_map = {
            "ml": self.ML_SERVICE_URL,
            "email": self.EMAIL_SERVICE_URL,
            "notification": self.NOTIFICATION_SERVICE_URL,
        }
        return service_map.get(service)
    
    def validate(self) -> bool:
        """Validate configuration"""
        try:
            if self._env_config:
                return self._env_config.validate_config()
            return True
        except Exception as e:
            print(f"Configuration validation failed: {e}")
            return False

# Global settings instance
settings = Settings()

# Convenience functions
def get_settings() -> Settings:
    """Get application settings"""
    return settings

def get_database_url() -> str:
    """Get database URL"""
    return settings.database_url

def get_redis_url() -> str:
    """Get Redis URL"""
    return settings.redis_url

def is_production() -> bool:
    """Check if running in production"""
    return settings.is_production

def is_staging() -> bool:
    """Check if running in staging"""
    return settings.is_staging

def is_development() -> bool:
    """Check if running in development"""
    return settings.is_development

def is_testing() -> bool:
    """Check if running in testing"""
    return settings.is_testing

def get_feature_flag(feature: str) -> bool:
    """Get feature flag value"""
    return settings.get_feature_flag(feature)

def get_external_service_url(service: str) -> Optional[str]:
    """Get external service URL"""
    return settings.get_external_service_url(service)