from pydantic_settings import BaseSettings
from typing import List, Dict, Any
import os
from dotenv import load_dotenv

# Load environment variables from environment.env file
load_dotenv("environment.env")

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Pollarbase"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Security Features Configuration
    SECURITY_FEATURES: Dict[str, Any] = {
        'encryption': os.getenv("SECURITY_ENCRYPTION_ENABLED", "true").lower() == "true",
        'audit_logging': os.getenv("SECURITY_AUDIT_ENABLED", "true").lower() == "true",
        'mfa': os.getenv("SECURITY_MFA_ENABLED", "false").lower() == "true",
        'advanced_monitoring': os.getenv("SECURITY_MONITORING_ENABLED", "false").lower() == "true",
        'permission_checking': os.getenv("SECURITY_PERMISSIONS_ENABLED", "true").lower() == "true",
        'rate_limiting': os.getenv("SECURITY_RATE_LIMITING_ENABLED", "true").lower() == "true",
        'security_headers': os.getenv("SECURITY_HEADERS_ENABLED", "true").lower() == "true",
        'pii_detection': os.getenv("SECURITY_PII_DETECTION_ENABLED", "true").lower() == "true",
        'compliance_tracking': os.getenv("SECURITY_COMPLIANCE_ENABLED", "true").lower() == "true",
        'data_classification': os.getenv("SECURITY_DATA_CLASSIFICATION_ENABLED", "true").lower() == "true"
    }
    
    # Testing and Migration Configuration
    TESTING_MODE: bool = os.getenv("TESTING_MODE", "false").lower() == "true"
    MIGRATION_MODE: bool = os.getenv("MIGRATION_MODE", "false").lower() == "true"
    COMPARE_RESULTS: bool = os.getenv("COMPARE_RESULTS", "false").lower() == "true"
    TESTING_CONFIG: Dict[str, Any] = {
        'run_legacy_code': os.getenv("RUN_LEGACY_CODE", "true").lower() == "true",
        'run_new_code': os.getenv("RUN_NEW_CODE", "true").lower() == "true",
        'fail_on_differences': os.getenv("FAIL_ON_DIFFERENCES", "false").lower() == "true",
        'log_differences': os.getenv("LOG_DIFFERENCES", "true").lower() == "true",
        'max_difference_threshold': float(os.getenv("MAX_DIFFERENCE_THRESHOLD", "0.05")),
        'comparison_timeout_seconds': int(os.getenv("COMPARISON_TIMEOUT_SECONDS", "30")),
        'sample_percentage': float(os.getenv("TESTING_SAMPLE_PERCENTAGE", "100.0"))
    }
    
    def get_security_config_for_environment(self, environment: str = None) -> Dict[str, Any]:
        """
        Get security configuration optimized for specific environments.
        
        Args:
            environment: 'development', 'testing', 'staging', 'production'
        
        Returns:
            Dict with security feature flags appropriate for the environment
        """
        if environment is None:
            environment = os.getenv("ENVIRONMENT", "development").lower()
        
        if environment == "development":
            return {
                'encryption': False,           # Easier debugging
                'audit_logging': True,         # Keep for development tracking
                'mfa': False,                 # Skip in development
                'advanced_monitoring': False, # Too noisy in development
                'permission_checking': True,   # Test permission logic
                'rate_limiting': False,       # No limits in development
                'security_headers': True,     # Test headers
                'pii_detection': True,        # Test PII detection
                'compliance_tracking': False, # Skip in development
                'data_classification': False  # Skip in development
            }
        elif environment == "testing":
            return {
                'encryption': False,          # Easier test assertions
                'audit_logging': False,       # Reduce noise in tests
                'mfa': False,                # Skip in tests
                'advanced_monitoring': False, # Skip in tests
                'permission_checking': True,  # Test permissions
                'rate_limiting': False,      # No limits in tests
                'security_headers': False,   # Reduce complexity
                'pii_detection': True,       # Test detection
                'compliance_tracking': False,# Skip in tests
                'data_classification': False # Skip in tests
            }
        elif environment == "staging":
            return {
                'encryption': True,          # Test encryption in staging
                'audit_logging': True,       # Full audit trail
                'mfa': False,               # Enable when ready
                'advanced_monitoring': True, # Test monitoring
                'permission_checking': True, # Full permission checking
                'rate_limiting': True,      # Test rate limiting
                'security_headers': True,   # Full security headers
                'pii_detection': True,      # Full PII detection
                'compliance_tracking': True,# Test compliance
                'data_classification': True # Test classification
            }
        else:  # production
            return {
                'encryption': True,          # Full encryption
                'audit_logging': True,       # Full audit trail
                'mfa': False,               # Enable when ready
                'advanced_monitoring': True, # Full monitoring
                'permission_checking': True, # Full permission checking
                'rate_limiting': True,      # Full rate limiting
                'security_headers': True,   # Full security headers
                'pii_detection': True,      # Full PII detection
                'compliance_tracking': True,# Full compliance tracking
                'data_classification': True # Full data classification
            }
    
    # CORS - Updated to support local demo
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Frontend
        "http://localhost:8000",  # API
        "http://localhost:8001",  # API (current port)
        "http://127.0.0.1:8000",  # API localhost IP
        "http://127.0.0.1:8001",  # API current port with IP
        "https://api.pollarbase.ai",
        "https://app.pollarbase.ai",
        "null",  # For file:// protocol requests
    ]
    
    # Database
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "pollarbase_dev")
    SQLALCHEMY_DATABASE_URI: str = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}/{POSTGRES_DB}"
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", f"redis://{REDIS_HOST}:{REDIS_PORT}/1")
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Stripe
    STRIPE_API_KEY: str = os.getenv("STRIPE_API_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    
    # AI Model Settings
    MODEL_PATH: str = os.getenv("MODEL_PATH", "models/")
    BATCH_SIZE: int = 32
    
    # Monitoring
    ENABLE_METRICS: bool = True
    PROMETHEUS_MULTIPROC_DIR: str = "/tmp"
    
    class Config:
        case_sensitive = True

settings = Settings() 