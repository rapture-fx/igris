"""
Supabase Client Configuration
Provides centralized Supabase client setup for hybrid architecture
"""

import os
import logging
from typing import Optional
from supabase import create_client, Client
from app.core.unified_config import settings

logger = logging.getLogger(__name__)

# Global Supabase client
supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """
    Get or create Supabase client instance
    """
    global supabase_client
    
    if supabase_client is None:
        try:
            # Validate required environment variables
            if not hasattr(settings, 'SUPABASE_URL') or not settings.SUPABASE_URL:
                raise ValueError("SUPABASE_URL is required")
            
            if not hasattr(settings, 'SUPABASE_SERVICE_KEY') or not settings.SUPABASE_SERVICE_KEY:
                raise ValueError("SUPABASE_SERVICE_KEY is required")
            
            # Create Supabase client
            supabase_client = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_SERVICE_KEY,
                options={
                    'schema': 'public',
                    'headers': {
                        'apikey': settings.SUPABASE_SERVICE_KEY,
                        'authorization': f'Bearer {settings.SUPABASE_SERVICE_KEY}'
                    },
                    'auto_refresh_token': True,
                    'persist_session': True,
                    'detect_session_in_url': True,
                    'realtime': {
                        'enabled': True,
                        'timeout': 30000,
                        'heartbeat_interval': 30000
                    }
                }
            )
            
            logger.info("Supabase client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            # Return None to allow graceful degradation
            supabase_client = None
            
    return supabase_client

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