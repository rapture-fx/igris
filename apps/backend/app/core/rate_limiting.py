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

def rate_limit(func):
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
        
        # Get API key from request
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            raise HTTPException(status_code=401, detail="API key required")
        
        # Check rate limits
        current_minute = int(time.time() / 60)
        current_hour = int(time.time() / 3600)
        
        # Per-minute limit
        minute_key = f"rate_limit:{api_key}:minute:{current_minute}"
        minute_count = redis_client.incr(minute_key)
        if minute_count == 1:
            redis_client.expire(minute_key, 60)
        
        if minute_count > settings.RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again in a minute."
            )
        
        # Per-hour limit
        hour_key = f"rate_limit:{api_key}:hour:{current_hour}"
        hour_count = redis_client.incr(hour_key)
        if hour_count == 1:
            redis_client.expire(hour_key, 3600)
        
        if hour_count > settings.RATE_LIMIT_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail="Hourly rate limit exceeded. Please try again later."
            )
        
        return await func(*args, **kwargs)
    
    return wrapper 