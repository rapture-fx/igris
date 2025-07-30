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
            # Enhanced Redis security configuration
            redis_config = {
                "encoding": "utf-8",
                "decode_responses": True,
                "socket_connect_timeout": 5,
                "socket_timeout": 5,
                "retry_on_timeout": True,
                "health_check_interval": 30,
            }
            
            # Add SSL/TLS support for production
            if settings.is_production:
                redis_config.update({
                    "ssl": True,
                    "ssl_check_hostname": False,
                    "ssl_cert_reqs": "required",
                    "ssl_ca_certs": "/app/certs/redis-ca.pem",
                    "ssl_certfile": "/app/certs/redis-client.pem",
                    "ssl_keyfile": "/app/certs/redis-client-key.pem",
                })
            
            redis_client = redis.from_url(
                settings.REDIS_URL,
                **redis_config
            )
            await redis_client.ping()
            logger.info("Shared Redis client initialized successfully with enhanced security.")
        except Exception as e:
            logger.error(f"Failed to initialize shared Redis client: {e}")
            redis_client = None # Ensure it's None on failure
    return redis_client 