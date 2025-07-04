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
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: str = "100MB"
    ALLOWED_FILE_TYPES: str = "csv,json,xlsx,xls,txt,parquet"
    
    # Security
    ENCRYPTION_KEY: str = "dev_encryption_key_32_chars_long"
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Environment
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    class Config:
        env_file = ".env.development"
        case_sensitive = True

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings() 