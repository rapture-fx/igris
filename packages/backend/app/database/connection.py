from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.core.unified_config import settings
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# Create async engine for application using unified config
async_engine = create_async_engine(settings.ASYNC_DATABASE_URI)

# Create sync engine for migrations
engine = create_engine(settings.DATABASE_URL)

# Session makers
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

# Base class for models
Base = declarative_base()

# Dependency to get database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

def get_sync_db():
    """For migrations and sync operations"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 