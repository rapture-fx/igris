from fastapi import HTTPException, Request
from functools import wraps
import redis
import time
from app.core.api_config import settings

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True
)

def rate_limit(max_calls=None, time_window=60):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                raise HTTPException(status_code=500, detail="Could not find request object")
            
            # Get API key from request or use IP address as fallback
            api_key = request.headers.get('X-API-Key')
            if not api_key:
                client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else 'unknown')
                api_key = f"ip:{client_ip}"
            
            # Use custom limits if provided, otherwise fall back to settings
            calls_limit = max_calls or getattr(settings, 'RATE_LIMIT_PER_MINUTE', 60)
            window = time_window
            
            # Check rate limits
            current_window = int(time.time() / window)
            
            # Rate limit key
            limit_key = f"rate_limit:{api_key}:window:{current_window}"
            current_count = redis_client.incr(limit_key)
            if current_count == 1:
                redis_client.expire(limit_key, window)
            
            if current_count > calls_limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {calls_limit} calls per {window} seconds."
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator 

# Export the decorator with the expected name
rate_limiter = rate_limit