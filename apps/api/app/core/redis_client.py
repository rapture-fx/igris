"""
Enhanced Redis Client with Performance Optimizations and Caching
"""
import redis.asyncio as redis
import json
import pickle
import hashlib
import logging
import time
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
from functools import wraps
from app.core.unified_config import settings

logger = logging.getLogger(__name__)

# Redis client instance
redis_client = None

# Cache configuration
class CacheConfig:
    DEFAULT_TTL = 3600  # 1 hour
    PROCESSING_CACHE_TTL = 7200  # 2 hours for ML processing
    QUERY_CACHE_TTL = 1800  # 30 minutes for query results
    SESSION_CACHE_TTL = 86400  # 24 hours for sessions
    MAX_CACHE_SIZE = 1000  # Maximum items in memory cache
    COMPRESSION_THRESHOLD = 1024  # Compress data larger than 1KB

# Performance metrics
cache_metrics = {
    "hits": 0,
    "misses": 0,
    "sets": 0,
    "deletes": 0,
    "errors": 0,
    "total_operations": 0,
    "avg_response_time": 0.0
}

def update_cache_metrics(operation: str, response_time: float, success: bool = True):
    """Update cache performance metrics"""
    cache_metrics["total_operations"] += 1
    if success:
        cache_metrics[operation] += 1
    else:
        cache_metrics["errors"] += 1
    
    # Update average response time
    current_avg = cache_metrics["avg_response_time"]
    count = cache_metrics["total_operations"]
    cache_metrics["avg_response_time"] = (current_avg * (count - 1) + response_time) / count

class EnhancedRedisClient:
    """Enhanced Redis client with caching, compression, and monitoring"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.memory_cache = {}  # Local memory cache for frequently accessed items
        
    async def get(self, key: str, use_memory_cache: bool = True) -> Optional[Any]:
        """Get value with optional memory caching"""
        start_time = time.time()
        try:
            # Check memory cache first
            if use_memory_cache and key in self.memory_cache:
                item = self.memory_cache[key]
                if item["expires"] > time.time():
                    update_cache_metrics("hits", time.time() - start_time)
                    return item["value"]
                else:
                    del self.memory_cache[key]
            
            # Get from Redis
            data = await self.redis.get(key)
            if data is None:
                update_cache_metrics("misses", time.time() - start_time)
                return None
            
            # Deserialize data
            try:
                # Try JSON first (faster)
                value = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                # Fall back to pickle for complex objects
                value = pickle.loads(data.encode('latin1'))
            
            # Store in memory cache if small enough
            if use_memory_cache and len(str(value)) < CacheConfig.COMPRESSION_THRESHOLD:
                self._store_in_memory_cache(key, value, CacheConfig.DEFAULT_TTL)
            
            update_cache_metrics("hits", time.time() - start_time)
            return value
            
        except Exception as e:
            logger.error(f"Redis get error for key {key}: {str(e)}")
            update_cache_metrics("misses", time.time() - start_time, success=False)
            return None
    
    async def set(self, key: str, value: Any, ttl: int = None, compress: bool = True) -> bool:
        """Set value with optional compression"""
        start_time = time.time()
        try:
            if ttl is None:
                ttl = CacheConfig.DEFAULT_TTL
            
            # Serialize data
            try:
                # Try JSON first (more efficient)
                serialized = json.dumps(value)
            except (TypeError, ValueError):
                # Fall back to pickle for complex objects
                serialized = pickle.dumps(value).decode('latin1')
            
            # Compress if data is large and compression is enabled
            if compress and len(serialized) > CacheConfig.COMPRESSION_THRESHOLD:
                import gzip
                serialized = gzip.compress(serialized.encode()).decode('latin1')
                key = f"compressed:{key}"
            
            # Set in Redis
            result = await self.redis.setex(key, ttl, serialized)
            
            # Store in memory cache if small enough
            if len(str(value)) < CacheConfig.COMPRESSION_THRESHOLD:
                self._store_in_memory_cache(key, value, ttl)
            
            update_cache_metrics("sets", time.time() - start_time)
            return result
            
        except Exception as e:
            logger.error(f"Redis set error for key {key}: {str(e)}")
            update_cache_metrics("sets", time.time() - start_time, success=False)
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from both Redis and memory cache"""
        start_time = time.time()
        try:
            # Remove from memory cache
            if key in self.memory_cache:
                del self.memory_cache[key]
            
            # Remove from Redis
            result = await self.redis.delete(key)
            update_cache_metrics("deletes", time.time() - start_time)
            return bool(result)
            
        except Exception as e:
            logger.error(f"Redis delete error for key {key}: {str(e)}")
            update_cache_metrics("deletes", time.time() - start_time, success=False)
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        try:
            # Check memory cache first
            if key in self.memory_cache:
                item = self.memory_cache[key]
                if item["expires"] > time.time():
                    return True
                else:
                    del self.memory_cache[key]
            
            return bool(await self.redis.exists(key))
        except Exception as e:
            logger.error(f"Redis exists error for key {key}: {str(e)}")
            return False
    
    async def get_hash(self, key: str, field: str) -> Optional[Any]:
        """Get hash field value"""
        try:
            data = await self.redis.hget(key, field)
            if data is None:
                return None
            return json.loads(data)
        except Exception as e:
            logger.error(f"Redis hget error for key {key}, field {field}: {str(e)}")
            return None
    
    async def set_hash(self, key: str, field: str, value: Any, ttl: int = None) -> bool:
        """Set hash field value"""
        try:
            serialized = json.dumps(value)
            result = await self.redis.hset(key, field, serialized)
            if ttl:
                await self.redis.expire(key, ttl)
            return bool(result)
        except Exception as e:
            logger.error(f"Redis hset error for key {key}, field {field}: {str(e)}")
            return False
    
    async def increment(self, key: str, amount: int = 1, ttl: int = None) -> Optional[int]:
        """Increment counter"""
        try:
            result = await self.redis.incrby(key, amount)
            if ttl and result == amount:  # First time setting the key
                await self.redis.expire(key, ttl)
            return result
        except Exception as e:
            logger.error(f"Redis increment error for key {key}: {str(e)}")
            return None
    
    async def get_list(self, key: str, start: int = 0, end: int = -1) -> List[Any]:
        """Get list range"""
        try:
            data = await self.redis.lrange(key, start, end)
            return [json.loads(item) for item in data]
        except Exception as e:
            logger.error(f"Redis lrange error for key {key}: {str(e)}")
            return []
    
    async def push_to_list(self, key: str, value: Any, ttl: int = None, max_length: int = None) -> bool:
        """Push to list with optional max length"""
        try:
            serialized = json.dumps(value)
            await self.redis.lpush(key, serialized)
            
            if max_length:
                await self.redis.ltrim(key, 0, max_length - 1)
            
            if ttl:
                await self.redis.expire(key, ttl)
            
            return True
        except Exception as e:
            logger.error(f"Redis lpush error for key {key}: {str(e)}")
            return False
    
    def _store_in_memory_cache(self, key: str, value: Any, ttl: int):
        """Store item in memory cache with TTL"""
        if len(self.memory_cache) >= CacheConfig.MAX_CACHE_SIZE:
            # Remove oldest item
            oldest_key = min(self.memory_cache.keys(), 
                           key=lambda k: self.memory_cache[k]["created"])
            del self.memory_cache[oldest_key]
        
        self.memory_cache[key] = {
            "value": value,
            "created": time.time(),
            "expires": time.time() + ttl
        }
    
    def clear_memory_cache(self):
        """Clear memory cache"""
        self.memory_cache.clear()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        return {
            "metrics": cache_metrics.copy(),
            "memory_cache_size": len(self.memory_cache),
            "hit_rate": cache_metrics["hits"] / max(1, cache_metrics["hits"] + cache_metrics["misses"]),
            "error_rate": cache_metrics["errors"] / max(1, cache_metrics["total_operations"])
        }

# Enhanced Redis client instance
enhanced_redis_client = None

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
                # Performance optimizations
                "connection_pool_kwargs": {
                    "max_connections": 50,
                    "retry_on_timeout": True,
                }
            }
            
            # Add SSL/TLS support for production
            if hasattr(settings, 'is_production') and settings.is_production:
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

async def get_enhanced_redis_client() -> Optional[EnhancedRedisClient]:
    """Get enhanced Redis client with caching capabilities"""
    global enhanced_redis_client
    if enhanced_redis_client is None:
        base_client = await get_redis_client()
        if base_client:
            enhanced_redis_client = EnhancedRedisClient(base_client)
    return enhanced_redis_client

# Cache decorators
def cache_result(key_prefix: str = "", ttl: int = None):
    """Decorator to cache function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key_data = f"{key_prefix}:{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            cache_key = hashlib.md5(key_data.encode()).hexdigest()
            
            client = await get_enhanced_redis_client()
            if not client:
                return await func(*args, **kwargs)
            
            # Try to get from cache
            cached_result = await client.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            if result is not None:
                await client.set(cache_key, result, ttl or CacheConfig.DEFAULT_TTL)
            
            return result
        return wrapper
    return decorator

def invalidate_cache_pattern(pattern: str):
    """Decorator to invalidate cache keys matching a pattern after function execution"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate matching cache keys
            base_client = await get_redis_client()
            if base_client:
                try:
                    keys = await base_client.keys(pattern)
                    if keys:
                        await base_client.delete(*keys)
                        logger.info(f"Invalidated {len(keys)} cache keys matching pattern: {pattern}")
                except Exception as e:
                    logger.error(f"Failed to invalidate cache pattern {pattern}: {str(e)}")
            
            return result
        return wrapper
    return decorator

# Utility functions
async def cache_processing_result(job_id: str, result: Dict[str, Any], ttl: int = None) -> bool:
    """Cache processing job result"""
    client = await get_enhanced_redis_client()
    if not client:
        return False
    
    cache_key = f"processing_result:{job_id}"
    return await client.set(cache_key, result, ttl or CacheConfig.PROCESSING_CACHE_TTL)

async def get_cached_processing_result(job_id: str) -> Optional[Dict[str, Any]]:
    """Get cached processing job result"""
    client = await get_enhanced_redis_client()
    if not client:
        return None
    
    cache_key = f"processing_result:{job_id}"
    return await client.get(cache_key)

async def cache_query_result(query_hash: str, result: Any, ttl: int = None) -> bool:
    """Cache database query result"""
    client = await get_enhanced_redis_client()
    if not client:
        return False
    
    cache_key = f"query_result:{query_hash}"
    return await client.set(cache_key, result, ttl or CacheConfig.QUERY_CACHE_TTL)

async def get_cached_query_result(query_hash: str) -> Optional[Any]:
    """Get cached database query result"""
    client = await get_enhanced_redis_client()
    if not client:
        return None
    
    cache_key = f"query_result:{query_hash}"
    return await client.get(cache_key)

async def get_cache_health() -> Dict[str, Any]:
    """Get Redis cache health status"""
    try:
        client = await get_redis_client()
        if not client:
            return {"status": "unhealthy", "error": "Redis client not available"}
        
        # Test connection
        await client.ping()
        
        # Get info
        info = await client.info()
        
        # Get enhanced client stats
        enhanced_client = await get_enhanced_redis_client()
        cache_stats = enhanced_client.get_cache_stats() if enhanced_client else {}
        
        return {
            "status": "healthy",
            "redis_info": {
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
            },
            "cache_stats": cache_stats
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)} 