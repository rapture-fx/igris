"""
Environment configuration management for Schlep-engine
Supports staging and production environments with proper separation
"""

import os
from typing import Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass
from pathlib import Path

class Environment(str, Enum):
    """Environment types"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"

@dataclass
class DatabaseConfig:
    """Database configuration"""
    host: str
    port: int
    database: str
    username: str
    password: str
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 3600

@dataclass
class RedisConfig:
    """Redis configuration"""
    host: str
    port: int
    password: Optional[str] = None
    database: int = 0
    max_connections: int = 20

@dataclass
class StorageConfig:
    """Storage configuration"""
    provider: str  # gcs, s3, local
    bucket_name: str
    credentials_path: Optional[str] = None
    region: Optional[str] = None
    cdn_url: Optional[str] = None

@dataclass
class SecurityConfig:
    """Security configuration"""
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    password_min_length: int = 8
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 15

@dataclass
class MonitoringConfig:
    """Monitoring configuration"""
    sentry_dsn: Optional[str] = None
    prometheus_enabled: bool = True
    log_level: str = "INFO"
    log_file: Optional[str] = None
    metrics_retention_days: int = 30

@dataclass
class CeleryConfig:
    """Celery configuration"""
    broker_url: str
    result_backend: str
    task_serializer: str = "json"
    accept_content: list = None
    result_serializer: str = "json"
    timezone: str = "UTC"
    enable_utc: bool = True
    task_track_started: bool = True
    task_time_limit: int = 30 * 60
    task_soft_time_limit: int = 25 * 60

class EnvironmentConfig:
    """Environment configuration manager"""
    
    def __init__(self, environment: Environment):
        self.environment = environment
        self.config = self._load_environment_config()
    
    def _load_environment_config(self) -> Dict[str, Any]:
        """Load configuration for the specified environment"""
        configs = {
            Environment.DEVELOPMENT: self._get_development_config(),
            Environment.STAGING: self._get_staging_config(),
            Environment.PRODUCTION: self._get_production_config(),
            Environment.TESTING: self._get_testing_config(),
        }
        return configs.get(self.environment, configs[Environment.DEVELOPMENT])
    
    def _get_development_config(self) -> Dict[str, Any]:
        """Development environment configuration"""
        return {
            "app": {
                "name": "Schlep-engine",
                "version": "1.0.0",
                "debug": True,
                "host": "0.0.0.0",
                "port": 8000,
                "workers": 1,
                "reload": True,
            },
            "database": DatabaseConfig(
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", "5432")),
                database=os.getenv("DB_NAME", "schlep_engine_dev"),
                username=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "password"),
                pool_size=5,
                max_overflow=10,
            ),
            "redis": RedisConfig(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", "6379")),
                password=os.getenv("REDIS_PASSWORD"),
                database=0,
                max_connections=10,
            ),
            "storage": StorageConfig(
                provider=os.getenv("STORAGE_PROVIDER", "local"),
                bucket_name=os.getenv("STORAGE_BUCKET", "schlep-engine-dev"),
                credentials_path=os.getenv("STORAGE_CREDENTIALS_PATH"),
                region=os.getenv("STORAGE_REGION", "us-central1"),
            ),
            "security": SecurityConfig(
                secret_key=os.getenv("SECRET_KEY", "dev-secret-key-change-in-production"),
                access_token_expire_minutes=60,
                refresh_token_expire_days=30,
                password_min_length=6,
                max_login_attempts=10,
                lockout_duration_minutes=5,
            ),
            "monitoring": MonitoringConfig(
                sentry_dsn=os.getenv("SENTRY_DSN"),
                prometheus_enabled=True,
                log_level="DEBUG",
                log_file="logs/app.log",
                metrics_retention_days=7,
            ),
            "celery": CeleryConfig(
                broker_url=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
                result_backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
                task_time_limit=10 * 60,
                task_soft_time_limit=8 * 60,
            ),
            "external_services": {
                "ml_service_url": os.getenv("ML_SERVICE_URL"),
                "email_service_url": os.getenv("EMAIL_SERVICE_URL"),
                "notification_service_url": os.getenv("NOTIFICATION_SERVICE_URL"),
            },
            "features": {
                "enable_advanced_ai": True,
                "enable_ml_pipeline": True,
                "enable_data_processing": True,
                "enable_storage": True,
                "enable_monitoring": True,
                "enable_security": True,
            },
        }
    
    def _get_staging_config(self) -> Dict[str, Any]:
        """Staging environment configuration"""
        return {
            "app": {
                "name": "Schlep-engine",
                "version": "1.0.0",
                "debug": False,
                "host": "0.0.0.0",
                "port": 8000,
                "workers": 4,
                "reload": False,
            },
            "database": DatabaseConfig(
                host=os.getenv("STAGING_DB_HOST", "staging-db.schlep-engine.com"),
                port=int(os.getenv("STAGING_DB_PORT", "5432")),
                database=os.getenv("STAGING_DB_NAME", "schlep_engine_staging"),
                username=os.getenv("STAGING_DB_USER", "schlep_staging"),
                password=os.getenv("STAGING_DB_PASSWORD"),
                pool_size=20,
                max_overflow=40,
                pool_recycle=1800,
            ),
            "redis": RedisConfig(
                host=os.getenv("STAGING_REDIS_HOST", "staging-redis.schlep-engine.com"),
                port=int(os.getenv("STAGING_REDIS_PORT", "6379")),
                password=os.getenv("STAGING_REDIS_PASSWORD"),
                database=0,
                max_connections=50,
            ),
            "storage": StorageConfig(
                provider=os.getenv("STAGING_STORAGE_PROVIDER", "gcs"),
                bucket_name=os.getenv("STAGING_STORAGE_BUCKET", "schlep-engine-staging"),
                credentials_path=os.getenv("STAGING_STORAGE_CREDENTIALS_PATH"),
                region=os.getenv("STAGING_STORAGE_REGION", "us-central1"),
                cdn_url=os.getenv("STAGING_CDN_URL"),
            ),
            "security": SecurityConfig(
                secret_key=os.getenv("STAGING_SECRET_KEY"),
                access_token_expire_minutes=30,
                refresh_token_expire_days=7,
                password_min_length=8,
                max_login_attempts=5,
                lockout_duration_minutes=15,
            ),
            "monitoring": MonitoringConfig(
                sentry_dsn=os.getenv("STAGING_SENTRY_DSN"),
                prometheus_enabled=True,
                log_level="INFO",
                log_file="/var/log/schlep-engine/app.log",
                metrics_retention_days=30,
            ),
            "celery": CeleryConfig(
                broker_url=os.getenv("STAGING_CELERY_BROKER_URL", "redis://staging-redis.schlep-engine.com:6379/0"),
                result_backend=os.getenv("STAGING_CELERY_RESULT_BACKEND", "redis://staging-redis.schlep-engine.com:6379/0"),
                task_time_limit=30 * 60,
                task_soft_time_limit=25 * 60,
            ),
            "external_services": {
                "ml_service_url": os.getenv("STAGING_ML_SERVICE_URL"),
                "email_service_url": os.getenv("STAGING_EMAIL_SERVICE_URL"),
                "notification_service_url": os.getenv("STAGING_NOTIFICATION_SERVICE_URL"),
            },
            "features": {
                "enable_advanced_ai": True,
                "enable_ml_pipeline": True,
                "enable_data_processing": True,
                "enable_storage": True,
                "enable_monitoring": True,
                "enable_security": True,
            },
        }
    
    def _get_production_config(self) -> Dict[str, Any]:
        """Production environment configuration"""
        return {
            "app": {
                "name": "Schlep-engine",
                "version": "1.0.0",
                "debug": False,
                "host": "0.0.0.0",
                "port": 8000,
                "workers": 8,
                "reload": False,
            },
            "database": DatabaseConfig(
                host=os.getenv("PROD_DB_HOST", "prod-db.schlep-engine.com"),
                port=int(os.getenv("PROD_DB_PORT", "5432")),
                database=os.getenv("PROD_DB_NAME", "schlep_engine_prod"),
                username=os.getenv("PROD_DB_USER", "schlep_prod"),
                password=os.getenv("PROD_DB_PASSWORD"),
                pool_size=50,
                max_overflow=100,
                pool_recycle=1800,
            ),
            "redis": RedisConfig(
                host=os.getenv("PROD_REDIS_HOST", "prod-redis.schlep-engine.com"),
                port=int(os.getenv("PROD_REDIS_PORT", "6379")),
                password=os.getenv("PROD_REDIS_PASSWORD"),
                database=0,
                max_connections=100,
            ),
            "storage": StorageConfig(
                provider=os.getenv("PROD_STORAGE_PROVIDER", "gcs"),
                bucket_name=os.getenv("PROD_STORAGE_BUCKET", "schlep-engine-prod"),
                credentials_path=os.getenv("PROD_STORAGE_CREDENTIALS_PATH"),
                region=os.getenv("PROD_STORAGE_REGION", "us-central1"),
                cdn_url=os.getenv("PROD_CDN_URL"),
            ),
            "security": SecurityConfig(
                secret_key=os.getenv("PROD_SECRET_KEY"),
                access_token_expire_minutes=15,
                refresh_token_expire_days=7,
                password_min_length=12,
                max_login_attempts=3,
                lockout_duration_minutes=30,
            ),
            "monitoring": MonitoringConfig(
                sentry_dsn=os.getenv("PROD_SENTRY_DSN"),
                prometheus_enabled=True,
                log_level="WARNING",
                log_file="/var/log/schlep-engine/app.log",
                metrics_retention_days=90,
            ),
            "celery": CeleryConfig(
                broker_url=os.getenv("PROD_CELERY_BROKER_URL", "redis://prod-redis.schlep-engine.com:6379/0"),
                result_backend=os.getenv("PROD_CELERY_RESULT_BACKEND", "redis://prod-redis.schlep-engine.com:6379/0"),
                task_time_limit=60 * 60,
                task_soft_time_limit=50 * 60,
            ),
            "external_services": {
                "ml_service_url": os.getenv("PROD_ML_SERVICE_URL"),
                "email_service_url": os.getenv("PROD_EMAIL_SERVICE_URL"),
                "notification_service_url": os.getenv("PROD_NOTIFICATION_SERVICE_URL"),
            },
            "features": {
                "enable_advanced_ai": True,
                "enable_ml_pipeline": True,
                "enable_data_processing": True,
                "enable_storage": True,
                "enable_monitoring": True,
                "enable_security": True,
            },
        }
    
    def _get_testing_config(self) -> Dict[str, Any]:
        """Testing environment configuration"""
        return {
            "app": {
                "name": "Schlep-engine",
                "version": "1.0.0",
                "debug": True,
                "host": "0.0.0.0",
                "port": 8001,
                "workers": 1,
                "reload": True,
            },
            "database": DatabaseConfig(
                host=os.getenv("TEST_DB_HOST", "localhost"),
                port=int(os.getenv("TEST_DB_PORT", "5433")),
                database=os.getenv("TEST_DB_NAME", "schlep_engine_test"),
                username=os.getenv("TEST_DB_USER", "postgres"),
                password=os.getenv("TEST_DB_PASSWORD", "password"),
                pool_size=2,
                max_overflow=5,
            ),
            "redis": RedisConfig(
                host=os.getenv("TEST_REDIS_HOST", "localhost"),
                port=int(os.getenv("TEST_REDIS_PORT", "6380")),
                password=os.getenv("TEST_REDIS_PASSWORD"),
                database=1,
                max_connections=5,
            ),
            "storage": StorageConfig(
                provider="local",
                bucket_name="test-bucket",
                credentials_path=None,
                region=None,
            ),
            "security": SecurityConfig(
                secret_key="test-secret-key",
                access_token_expire_minutes=5,
                refresh_token_expire_days=1,
                password_min_length=4,
                max_login_attempts=100,
                lockout_duration_minutes=1,
            ),
            "monitoring": MonitoringConfig(
                sentry_dsn=None,
                prometheus_enabled=False,
                log_level="DEBUG",
                log_file="logs/test.log",
                metrics_retention_days=1,
            ),
            "celery": CeleryConfig(
                broker_url=os.getenv("TEST_CELERY_BROKER_URL", "redis://localhost:6380/1"),
                result_backend=os.getenv("TEST_CELERY_RESULT_BACKEND", "redis://localhost:6380/1"),
                task_time_limit=5 * 60,
                task_soft_time_limit=4 * 60,
            ),
            "external_services": {
                "ml_service_url": None,
                "email_service_url": None,
                "notification_service_url": None,
            },
            "features": {
                "enable_advanced_ai": False,
                "enable_ml_pipeline": False,
                "enable_data_processing": True,
                "enable_storage": True,
                "enable_monitoring": False,
                "enable_security": True,
            },
        }
    
    def get_database_url(self) -> str:
        """Get database URL for SQLAlchemy"""
        db_config = self.config["database"]
        return f"postgresql+asyncpg://{db_config.username}:{db_config.password}@{db_config.host}:{db_config.port}/{db_config.database}"
    
    def get_redis_url(self) -> str:
        """Get Redis URL"""
        redis_config = self.config["redis"]
        if redis_config.password:
            return f"redis://:{redis_config.password}@{redis_config.host}:{redis_config.port}/{redis_config.database}"
        return f"redis://{redis_config.host}:{redis_config.port}/{redis_config.database}"
    
    def get_storage_config(self) -> StorageConfig:
        """Get storage configuration"""
        return self.config["storage"]
    
    def get_security_config(self) -> SecurityConfig:
        """Get security configuration"""
        return self.config["security"]
    
    def get_monitoring_config(self) -> MonitoringConfig:
        """Get monitoring configuration"""
        return self.config["monitoring"]
    
    def get_celery_config(self) -> CeleryConfig:
        """Get Celery configuration"""
        return self.config["celery"]
    
    def is_feature_enabled(self, feature: str) -> bool:
        """Check if a feature is enabled"""
        return self.config["features"].get(feature, False)
    
    def get_external_service_url(self, service: str) -> Optional[str]:
        """Get external service URL"""
        return self.config["external_services"].get(service)
    
    def get_app_config(self) -> Dict[str, Any]:
        """Get application configuration"""
        return self.config["app"]
    
    def validate_config(self) -> bool:
        """Validate configuration"""
        required_fields = [
            "database.host", "database.database", "database.username", "database.password",
            "redis.host", "redis.port",
            "security.secret_key",
        ]
        
        for field in required_fields:
            keys = field.split(".")
            value = self.config
            for key in keys:
                if key not in value:
                    raise ValueError(f"Missing required configuration: {field}")
                value = value[key]
        
        return True

# Global environment configuration
def get_environment_config() -> EnvironmentConfig:
    """Get environment configuration based on ENVIRONMENT variable"""
    env_name = os.getenv("ENVIRONMENT", "development")
    try:
        environment = Environment(env_name)
    except ValueError:
        environment = Environment.DEVELOPMENT
    
    return EnvironmentConfig(environment)

# Convenience functions
def get_current_environment() -> Environment:
    """Get current environment"""
    env_name = os.getenv("ENVIRONMENT", "development")
    try:
        return Environment(env_name)
    except ValueError:
        return Environment.DEVELOPMENT

def is_production() -> bool:
    """Check if running in production"""
    return get_current_environment() == Environment.PRODUCTION

def is_staging() -> bool:
    """Check if running in staging"""
    return get_current_environment() == Environment.STAGING

def is_development() -> bool:
    """Check if running in development"""
    return get_current_environment() == Environment.DEVELOPMENT

def is_testing() -> bool:
    """Check if running in testing"""
    return get_current_environment() == Environment.TESTING 