"""
Shared Redis Client for the Application
"""
import redis.asyncio as redis
import logging
from app.core.unified_config import settings

logger = logging.getLogger(__name__)

redis_client = None

async def get_redis_client():
    """
    Returns a shared instance of the Redis client.
    Initializes the client if it doesn't exist.
    """
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await redis_client.ping()
            logger.info("Shared Redis client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize shared Redis client: {e}")
            redis_client = None # Ensure it's None on failure
    return redis_client 