from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from fastapi import HTTPException, status
from app.core.unified_config import settings
import logging
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)

# Initialize engines
async_engine: Optional[create_async_engine] = None
engine: Optional[create_engine] = None
SessionLocal: Optional[sessionmaker] = None
AsyncSessionLocal: Optional[async_sessionmaker] = None

try:
    # Create async engine for application using unified config with security hardening
    async_engine = create_async_engine(
        settings.ASYNC_DATABASE_URI,
        echo=settings.ENVIRONMENT == "development",  # Enable SQL logging in dev
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=3600,   # Recycle connections every hour
        # Security hardening
        connect_args={
            "sslmode": "require" if settings.is_production else "prefer",
            "sslcert": "/app/certs/client-cert.pem" if settings.is_production else None,
            "sslkey": "/app/certs/client-key.pem" if settings.is_production else None,
            "sslrootcert": "/app/certs/ca-cert.pem" if settings.is_production else None,
            "application_name": f"schlep-engine-{settings.ENVIRONMENT}",
            "connect_timeout": 10,
            "command_timeout": 30,
        } if settings.is_production else {
            "sslmode": "prefer",
            "application_name": f"schlep-engine-{settings.ENVIRONMENT}",
        }
    )
    
    # Create sync engine for migrations (build sync URL without query params)
    sync_database_url = (
        f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
        f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )
    engine = create_engine(
        sync_database_url,
        echo=settings.ENVIRONMENT == "development",
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    
    # Session makers
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=async_engine)
    
    logger.info("Database engines initialized successfully")
    
except Exception as e:
    logger.warning(f"Database initialization failed: {e}. Running without database connection.")
    async_engine = None
    engine = None
    SessionLocal = None
    AsyncSessionLocal = None

# Base class for models
Base = declarative_base()

# Dependency to get database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

# Alias for backwards compatibility
get_async_session = get_db

def get_sync_db():
    """For migrations and sync operations"""
    if SessionLocal is None:
        raise Exception("Database not available")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()