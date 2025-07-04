import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://wira@localhost:5432/Schlep-engine_dev"
    
    # JWT
    JWT_SECRET_KEY: str = "dev_jwt_secret_key_change_in_production_2024"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Cache
    USE_REDIS_CACHE: bool = False
    
    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Schlep-engine"
    
    # CORS - Secure configuration
    BACKEND_CORS_ORIGINS: List[str] = []
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Environment
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    @property
    def secure_cors_origins(self) -> List[str]:
        """Get environment-appropriate CORS origins"""
        if self.ENVIRONMENT == "development":
            return [
                "http://localhost:3000",
                "http://localhost:3001", 
                "http://localhost:3002",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:3002"
            ]
        elif self.ENVIRONMENT == "staging":
            return [
                "https://staging.schlep-engine.com",
                "https://staging-admin.schlep-engine.com"
            ]
        elif self.ENVIRONMENT == "production":
            return [
                "https://schlep-engine.com",
                "https://www.schlep-engine.com",
                "https://admin.schlep-engine.com"
            ]
        return self.BACKEND_CORS_ORIGINS if self.BACKEND_CORS_ORIGINS else []
    
    @property
    def cors_allow_credentials(self) -> bool:
        """Whether to allow credentials in CORS"""
        return self.ENVIRONMENT != "development"
    
    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: str = "100MB"
    ALLOWED_FILE_TYPES: str = "csv,json,xlsx,xls,txt,parquet"
    
    # Security
    ENCRYPTION_KEY: str = "dev_encryption_key_32_chars_long"
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Rate Limiting - Environment based
    @property
    def rate_limit_per_minute(self) -> int:
        """Get environment-appropriate rate limit"""
        if self.ENVIRONMENT == "development":
            return 1000  # Relaxed for development
        elif self.ENVIRONMENT == "staging":
            return 200   # Moderate for staging
        else:
            return 60    # Strict for production
    
    class Config:
        env_file = ".env.development"
        case_sensitive = True

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings() 