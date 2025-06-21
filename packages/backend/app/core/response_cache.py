"""
ADVANCED RESPONSE CACHING SYSTEM - POLLARBASE
============================================

Intelligent response caching with Redis backend, automatic cache invalidation,
and performance optimization for frequently accessed data.

Key Features:
- Redis-based caching with TTL management
- Intelligent cache key generation
- Automatic cache invalidation on data updates
- Cache hit/miss analytics
- Memory-efficient caching strategies
- Conditional caching based on request patterns
"""

import asyncio
import hashlib
import json
import pickle
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union, Callable, List
from functools import wraps

from fastapi import Request, Response
from redis import Redis
import logging

from app.core.api_config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Redis connection
redis_client = Redis(
    host=settings.REDIS_HOST, 
    port=settings.REDIS_PORT, 
    decode_responses=False  # Binary mode for pickle
)

class CacheConfig:
    """Cache configuration for different types of data"""
    
    # Default TTL values (in seconds)
    DEFAULT_TTL = 300        # 5 minutes
    USER_DATA_TTL = 1800     # 30 minutes
    ANALYSIS_RESULTS_TTL = 3600  # 1 hour
    SYSTEM_STATUS_TTL = 60   # 1 minute
    STATIC_DATA_TTL = 86400  # 24 hours
    
    # Cache size limits
    MAX_CACHE_SIZE = 100 * 1024 * 1024  # 100MB per key
    MAX_CACHE_ENTRIES = 10000
    
    # Cache patterns
    CACHE_PATTERNS = {
        'user_profile': {'ttl': USER_DATA_TTL, 'invalidate_on': ['user_update']},
        'analysis_result': {'ttl': ANALYSIS_RESULTS_TTL, 'invalidate_on': ['data_update']},
        'system_metrics': {'ttl': SYSTEM_STATUS_TTL, 'invalidate_on': ['system_update']},
        'api_response': {'ttl': DEFAULT_TTL, 'invalidate_on': ['data_change']},
    }

class CacheKeyGenerator:
    """Generates consistent cache keys"""
    
    @staticmethod
    def generate_key(
        prefix: str,
        identifier: str,
        params: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> str:
        """Generate a consistent cache key"""
        
        key_parts = [prefix, identifier]
        
        # Add user context if provided
        if user_id:
            key_parts.append(f"user:{user_id}")
        
        # Add parameters hash if provided
        if params:
            # Sort parameters for consistent hashing
            sorted_params = json.dumps(params, sort_keys=True)
            param_hash = hashlib.md5(sorted_params.encode()).hexdigest()[:8]
            key_parts.append(f"params:{param_hash}")
        
        return ":".join(key_parts)
    
    @staticmethod
    def generate_request_key(request: Request, user_id: Optional[str] = None) -> str:
        """Generate cache key from FastAPI request"""
        
        # Use URL path as base
        path = request.url.path
        
        # Include query parameters
        query_params = dict(request.query_params)
        
        # Generate key
        return CacheKeyGenerator.generate_key(
            prefix="api_response",
            identifier=path.replace("/", "_"),
            params=query_params,
            user_id=user_id
        )

class CacheAnalytics:
    """Tracks cache performance metrics"""
    
    def __init__(self):
        self.metrics_key = "cache:metrics"
        self.daily_metrics_key = f"cache:daily:{datetime.utcnow().strftime('%Y%m%d')}"
    
    async def record_hit(self, cache_key: str, response_size: int = 0):
        """Record cache hit"""
        try:
            redis_client.hincrby(self.metrics_key, "hits", 1)
            redis_client.hincrby(self.daily_metrics_key, "hits", 1)
            
            if response_size > 0:
                redis_client.hincrby(self.metrics_key, "bytes_served", response_size)
            
            # Set expiration for daily metrics
            redis_client.expire(self.daily_metrics_key, 86400 * 7)  # Keep for 7 days
            
        except Exception as e:
            logger.warning(f"Failed to record cache hit: {e}")
    
    async def record_miss(self, cache_key: str):
        """Record cache miss"""
        try:
            redis_client.hincrby(self.metrics_key, "misses", 1)
            redis_client.hincrby(self.daily_metrics_key, "misses", 1)
            
        except Exception as e:
            logger.warning(f"Failed to record cache miss: {e}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        try:
            metrics = redis_client.hgetall(self.metrics_key)
            daily_metrics = redis_client.hgetall(self.daily_metrics_key)
            
            # Convert bytes to int
            metrics = {k.decode(): int(v) for k, v in metrics.items()}
            daily_metrics = {k.decode(): int(v) for k, v in daily_metrics.items()}
            
            # Calculate hit rate
            total_requests = metrics.get('hits', 0) + metrics.get('misses', 0)
            hit_rate = (metrics.get('hits', 0) / total_requests * 100) if total_requests > 0 else 0
            
            daily_total = daily_metrics.get('hits', 0) + daily_metrics.get('misses', 0)
            daily_hit_rate = (daily_metrics.get('hits', 0) / daily_total * 100) if daily_total > 0 else 0
            
            return {
                'total_hits': metrics.get('hits', 0),
                'total_misses': metrics.get('misses', 0),
                'hit_rate_percent': round(hit_rate, 2),
                'bytes_served': metrics.get('bytes_served', 0),
                'daily_hits': daily_metrics.get('hits', 0),
                'daily_misses': daily_metrics.get('misses', 0),
                'daily_hit_rate_percent': round(daily_hit_rate, 2),
                'cache_efficiency': 'excellent' if hit_rate > 80 else 'good' if hit_rate > 60 else 'needs_improvement'
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {'error': str(e)}

class IntelligentCache:
    """Advanced caching system with intelligent features"""
    
    def __init__(self):
        self.analytics = CacheAnalytics()
        self.key_generator = CacheKeyGenerator()
    
    async def get(
        self, 
        key: str, 
        default: Any = None,
        deserialize: bool = True
    ) -> Any:
        """Get value from cache"""
        
        try:
            cached_data = redis_client.get(key)
            
            if cached_data is None:
                await self.analytics.record_miss(key)
                return default
            
            # Deserialize data
            if deserialize:
                try:
                    # Try JSON first (for simple data)
                    if isinstance(cached_data, bytes):
                        cached_data = cached_data.decode('utf-8')
                    data = json.loads(cached_data)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Fall back to pickle for complex objects
                    data = pickle.loads(cached_data)
            else:
                data = cached_data
            
            # Record cache hit
            await self.analytics.record_hit(key, len(str(data)))
            
            return data
            
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            await self.analytics.record_miss(key)
            return default
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None,
        serialize: bool = True
    ) -> bool:
        """Set value in cache"""
        
        try:
            # Use default TTL if not specified
            if ttl is None:
                ttl = CacheConfig.DEFAULT_TTL
            
            # Serialize data
            if serialize:
                try:
                    # Try JSON first (more efficient)
                    serialized_data = json.dumps(value, default=str)
                except (TypeError, ValueError):
                    # Fall back to pickle for complex objects
                    serialized_data = pickle.dumps(value)
            else:
                serialized_data = value
            
            # Check size limit
            data_size = len(str(serialized_data))
            if data_size > CacheConfig.MAX_CACHE_SIZE:
                logger.warning(f"Cache value too large for key {key}: {data_size} bytes")
                return False
            
            # Set in Redis with TTL
            redis_client.setex(key, ttl, serialized_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        
        try:
            result = redis_client.delete(key)
            return result > 0
            
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        
        try:
            keys = redis_client.keys(pattern)
            if keys:
                return redis_client.delete(*keys)
            return 0
            
        except Exception as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        
        try:
            return redis_client.exists(key) > 0
            
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {e}")
            return False
    
    async def get_ttl(self, key: str) -> int:
        """Get TTL for key"""
        
        try:
            return redis_client.ttl(key)
            
        except Exception as e:
            logger.error(f"Cache TTL error for key {key}: {e}")
            return -1
    
    async def extend_ttl(self, key: str, additional_seconds: int) -> bool:
        """Extend TTL for existing key"""
        
        try:
            current_ttl = redis_client.ttl(key)
            if current_ttl > 0:
                new_ttl = current_ttl + additional_seconds
                redis_client.expire(key, new_ttl)
                return True
            return False
            
        except Exception as e:
            logger.error(f"Cache extend TTL error for key {key}: {e}")
            return False
    
    async def invalidate_by_tags(self, tags: List[str]):
        """Invalidate cache entries by tags"""
        
        try:
            for tag in tags:
                pattern = f"*{tag}*"
                await self.delete_pattern(pattern)
                
        except Exception as e:
            logger.error(f"Cache invalidation error for tags {tags}: {e}")

# Initialize cache instance
intelligent_cache = IntelligentCache()

# ==================== DECORATORS ====================

def cache_response(
    ttl: Optional[int] = None,
    key_prefix: Optional[str] = None,
    include_user: bool = True,
    cache_condition: Optional[Callable] = None
):
    """
    Decorator for caching API responses
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request and user from arguments
            request = None
            user = None
            
            for arg in args:
                if hasattr(arg, 'url'):  # FastAPI Request object
                    request = arg
                elif hasattr(arg, 'id'):  # User object
                    user = arg
            
            # Check kwargs for user
            if not user and 'current_user' in kwargs:
                user = kwargs['current_user']
            
            # Generate cache key
            if key_prefix:
                cache_key = key_prefix
            elif request:
                cache_key = intelligent_cache.key_generator.generate_request_key(
                    request, 
                    str(user.id) if user and include_user else None
                )
            else:
                cache_key = f"func:{func.__name__}"
            
            # Check cache condition
            if cache_condition and not cache_condition(*args, **kwargs):
                # Skip caching, execute function directly
                return await func(*args, **kwargs)
            
            # Try to get from cache
            cached_result = await intelligent_cache.get(cache_key)
            
            if cached_result is not None:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache the result
            cache_ttl = ttl or CacheConfig.DEFAULT_TTL
            await intelligent_cache.set(cache_key, result, cache_ttl)
            
            return result
        
        return wrapper
    return decorator

def cache_invalidate(tags: List[str]):
    """
    Decorator to invalidate cache entries after function execution
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Execute function first
            result = await func(*args, **kwargs)
            
            # Invalidate cache entries
            await intelligent_cache.invalidate_by_tags(tags)
            
            return result
        
        return wrapper
    return decorator

def conditional_cache(condition_func: Callable):
    """
    Decorator for conditional caching based on custom logic
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            should_cache = condition_func(*args, **kwargs)
            
            if not should_cache:
                return await func(*args, **kwargs)
            
            # Use standard caching logic
            return await cache_response()(func)(*args, **kwargs)
        
        return wrapper
    return decorator

# ==================== UTILITY FUNCTIONS ====================

async def warm_cache(cache_keys: List[str], data_loader: Callable):
    """Warm up cache with frequently accessed data"""
    
    try:
        for key in cache_keys:
            if not await intelligent_cache.exists(key):
                data = await data_loader(key)
                if data is not None:
                    await intelligent_cache.set(key, data)
                    
        logger.info(f"Cache warmed up with {len(cache_keys)} keys")
        
    except Exception as e:
        logger.error(f"Cache warm-up error: {e}")

async def cleanup_expired_cache():
    """Clean up expired cache entries (background task)"""
    
    try:
        # Get all cache keys
        all_keys = redis_client.keys("*")
        expired_count = 0
        
        for key in all_keys:
            ttl = redis_client.ttl(key)
            if ttl == -2:  # Key doesn't exist
                expired_count += 1
        
        logger.info(f"Cache cleanup completed. {expired_count} expired entries found")
        
    except Exception as e:
        logger.error(f"Cache cleanup error: {e}")

async def get_cache_health() -> Dict[str, Any]:
    """Get cache system health information"""
    
    try:
        # Get Redis info
        redis_info = redis_client.info()
        
        # Get cache statistics
        cache_stats = await intelligent_cache.analytics.get_stats()
        
        # Calculate health score
        memory_usage_percent = (redis_info.get('used_memory', 0) / redis_info.get('maxmemory', 1)) * 100
        hit_rate = cache_stats.get('hit_rate_percent', 0)
        
        health_score = (hit_rate + (100 - memory_usage_percent)) / 2
        
        return {
            'status': 'healthy' if health_score > 70 else 'degraded' if health_score > 40 else 'unhealthy',
            'health_score': round(health_score, 2),
            'redis_status': 'connected',
            'memory_usage_percent': round(memory_usage_percent, 2),
            'cache_stats': cache_stats,
            'recommendations': [
                'Consider increasing cache TTL' if hit_rate < 60 else None,
                'Monitor memory usage' if memory_usage_percent > 80 else None,
                'Cache is performing well' if health_score > 80 else None
            ]
        }
        
    except Exception as e:
        logger.error(f"Cache health check error: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e),
            'redis_status': 'disconnected'
        } 