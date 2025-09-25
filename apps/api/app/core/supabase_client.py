"""
Database Client Configuration (Cloud-Agnostic)
Provides centralized database client setup for hybrid architecture
Replaces Supabase with direct PostgreSQL + Redis for cloud independence
"""

import os
import logging
from typing import Optional, Dict, Any
# from supabase import create_client, Client  # Removed for cloud-agnostic operation
from app.core.unified_config import settings
from app.database.session import get_session
from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

# Database client placeholder (now uses direct PostgreSQL)
database_client: Optional[Any] = None

def get_database_client() -> Optional[Any]:
    """
    Get database client instance (cloud-agnostic PostgreSQL)
    Replaces Supabase with direct PostgreSQL connection
    """
    global database_client

    if database_client is None:
        try:
            # Use direct PostgreSQL session
            database_client = get_session()
            logger.info("PostgreSQL database client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize database client: {e}")
            database_client = None

    return database_client

# Backward compatibility alias
def get_supabase_client() -> Optional[Any]:
    """Backward compatibility - now returns PostgreSQL client"""
    logger.warning("get_supabase_client is deprecated, using direct PostgreSQL")
    return get_database_client()

def get_supabase_auth():
    """
    Get Supabase auth client
    """
    client = get_supabase_client()
    return client.auth if client else None

def get_supabase_db():
    """
    Get Supabase database client
    """
    client = get_supabase_client()
    return client if client else None

def get_supabase_storage():
    """
    Get Supabase storage client
    """
    client = get_supabase_client()
    return client.storage if client else None

def get_supabase_realtime():
    """
    Get Supabase realtime client
    """
    client = get_supabase_client()
    return client.realtime if client else None

# For backward compatibility and convenience
supabase = get_supabase_client()

# Health check function
async def check_supabase_health() -> dict:
    """
    Check Supabase connection health
    """
    try:
        client = get_supabase_client()
        if not client:
            return {
                "status": "unhealthy",
                "error": "Supabase client not initialized"
            }
        
        # Test connection with a simple query
        result = client.table('user_profiles').select("id").limit(1).execute()
        
        return {
            "status": "healthy",
            "connection": "ok",
            "tables_accessible": True
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

# Dependency for FastAPI
async def get_supabase_dependency() -> Client:
    """
    FastAPI dependency for Supabase client
    """
    client = get_supabase_client()
    if not client:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase service unavailable"
        )
    return client