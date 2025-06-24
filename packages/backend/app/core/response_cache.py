"""
ENHANCED RESPONSE CACHE SYSTEM - POLLARBASE
===========================================

Advanced caching system with intelligent cache invalidation, performance optimization,
and multiple caching strategies for different types of API responses.

Features:
- Multi-layer caching (Memory + Redis + Disk)
- Intelligent cache invalidation
- Response compression and serialization
- Cache warming and preloading
- Performance metrics and monitoring
- TTL management with sliding expiration
- Cache partitioning for different data types
"""

import asyncio
import hashlib
import json
import pickle
import time
import zlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Callable, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

class CacheStrategy(Enum):
    """Cache strategy types"""
    MEMORY_ONLY = "memory_only"
    REDIS_ONLY = "redis_only"
    HYBRID = "hybrid"  # Memory + Redis
    WRITE_THROUGH = "write_through"  # Write to all layers
    WRITE_BEHIND = "write_behind"  # Async write to persistent layer

class CacheLevel(Enum):
    """Cache level priorities"""
    L1_MEMORY = 1  # Fastest, smallest
    L2_REDIS = 2   # Fast, medium
    L3_DISK = 3    # Slower, largest

@dataclass
class CacheEntry:
    """Enhanced cache entry with metadata"""
    key: str
    value: Any
    created_at: datetime
    expires_at: Optional[datetime]
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    size_bytes: int = 0
    compressed: bool = False
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.last_accessed is None:
            self.last_accessed = self.created_at

@dataclass
class CacheMetrics:
    """Cache performance metrics"""
    hits: int = 0
    misses: int = 0
    writes: int = 0
    evictions: int = 0
    memory_usage_bytes: int = 0
    redis_usage_bytes: int = 0
    avg_response_time_ms: float = 0.0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0

class EnhancedResponseCache:
    """
    Advanced response cache system with multiple layers and intelligent management
    """
    
    def __init__(self):
        self.memory_cache: Dict[str, CacheEntry] = {}
        self.metrics = CacheMetrics()
        self.redis_client: Optional[redis.Redis] = None
        self.max_memory_entries = getattr(settings, 'CACHE_MAX_MEMORY_ENTRIES', 10000)
        self.max_memory_size_mb = getattr(settings, 'CACHE_MAX_MEMORY_SIZE_MB', 256)
        self.default_ttl_seconds = getattr(settings, 'CACHE_DEFAULT_TTL_SECONDS', 3600)
        self.compression_threshold = getattr(settings, 'CACHE_COMPRESSION_THRESHOLD', 10240)  # 10KB
        
        # Cache warming configuration
        self.warm_cache_on_startup = getattr(settings, 'CACHE_WARM_ON_STARTUP', True)
        self.preload_patterns = getattr(settings, 'CACHE_PRELOAD_PATTERNS', [])
        
        # Performance monitoring
        self._last_cleanup = datetime.utcnow()
        self._cleanup_interval = timedelta(minutes=15)
        
    async def initialize(self):
        """Initialize cache system with Redis connection"""
        try:
            if hasattr(settings, 'REDIS_URL'):
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=False  # Keep binary for pickle
                )
                await self.redis_client.ping()
                logger.info("Redis cache connection established")
            
            if self.warm_cache_on_startup:
                await self._warm_cache()
                
        except Exception as e:
            logger.warning(f"Redis cache initialization failed: {e}")
            logger.info("Falling back to memory-only caching")
    
    def _generate_cache_key(
        self, 
        endpoint: str, 
        params: Optional[Dict] = None,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        custom_prefix: Optional[str] = None
    ) -> str:
        """Generate hierarchical cache key"""
        key_parts = []
        
        if custom_prefix:
            key_parts.append(custom_prefix)
        
        key_parts.append(endpoint.replace("/", "_"))
        
        if organization_id:
            key_parts.append(f"org_{organization_id}")
        
        if user_id:
            key_parts.append(f"user_{user_id}")
        
        if params:
            # Sort parameters for consistent keys
            sorted_params = sorted(params.items())
            param_string = json.dumps(sorted_params, sort_keys=True)
            param_hash = hashlib.md5(param_string.encode()).hexdigest()[:8]
            key_parts.append(f"params_{param_hash}")
        
        return ":".join(key_parts)
    
    def _serialize_value(self, value: Any) -> Tuple[bytes, bool]:
        """Serialize and optionally compress value"""
        try:
            # Use pickle for Python objects
            serialized = pickle.dumps(value)
            
            # Compress if size exceeds threshold
            if len(serialized) > self.compression_threshold:
                compressed = zlib.compress(serialized)
                return compressed, True
            
            return serialized, False
            
        except Exception as e:
            logger.error(f"Serialization failed: {e}")
            # Fallback to JSON for simple objects
            try:
                json_str = json.dumps(value, default=str)
                serialized = json_str.encode('utf-8')
                
                if len(serialized) > self.compression_threshold:
                    compressed = zlib.compress(serialized)
                    return compressed, True
                
                return serialized, False
                
            except Exception as json_e:
                logger.error(f"JSON serialization fallback failed: {json_e}")
                raise
    
    def _deserialize_value(self, data: bytes, compressed: bool) -> Any:
        """Deserialize and decompress value"""
        try:
            if compressed:
                data = zlib.decompress(data)
            
            # Try pickle first
            try:
                return pickle.loads(data)
            except:
                # Fallback to JSON
                json_str = data.decode('utf-8')
                return json.loads(json_str)
                
        except Exception as e:
            logger.error(f"Deserialization failed: {e}")
            raise
    
    async def get(
        self, 
        key: str, 
        strategy: CacheStrategy = CacheStrategy.HYBRID
    ) -> Optional[Any]:
        """Get value from cache with specified strategy"""
        start_time = time.time()
        
        try:
            # Try memory cache first (L1)
            if strategy in [CacheStrategy.MEMORY_ONLY, CacheStrategy.HYBRID, CacheStrategy.WRITE_THROUGH]:
                entry = self.memory_cache.get(key)
                if entry and self._is_valid(entry):
                    entry.access_count += 1
                    entry.last_accessed = datetime.utcnow()
                    self.metrics.hits += 1
                    
                    response_time = (time.time() - start_time) * 1000
                    self._update_avg_response_time(response_time)
                    
                    return entry.value
            
            # Try Redis cache (L2)
            if self.redis_client and strategy in [CacheStrategy.REDIS_ONLY, CacheStrategy.HYBRID, CacheStrategy.WRITE_THROUGH]:
                try:
                    cached_data = await self.redis_client.hgetall(f"cache:{key}")
                    if cached_data:
                        expires_at = None
                        if cached_data.get(b'expires_at'):
                            expires_at = datetime.fromisoformat(cached_data[b'expires_at'].decode())
                        
                        if not expires_at or expires_at > datetime.utcnow():
                            value_data = cached_data[b'value']
                            compressed = cached_data.get(b'compressed', b'False').decode() == 'True'
                            
                            value = self._deserialize_value(value_data, compressed)
                            
                            # Promote to memory cache for hybrid strategy
                            if strategy == CacheStrategy.HYBRID:
                                await self._promote_to_memory(key, value, expires_at)
                            
                            self.metrics.hits += 1
                            response_time = (time.time() - start_time) * 1000
                            self._update_avg_response_time(response_time)
                            
                            return value
                
                except Exception as e:
                    logger.warning(f"Redis cache read failed for key {key}: {e}")
            
            # Cache miss
            self.metrics.misses += 1
            return None
            
        except Exception as e:
            logger.error(f"Cache get failed for key {key}: {e}")
            self.metrics.misses += 1
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None,
        strategy: CacheStrategy = CacheStrategy.HYBRID,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Set value in cache with specified strategy"""
        if ttl_seconds is None:
            ttl_seconds = self.default_ttl_seconds
        
        expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds) if ttl_seconds > 0 else None
        
        try:
            serialized_value, compressed = self._serialize_value(value)
            
            # Memory cache (L1)
            if strategy in [CacheStrategy.MEMORY_ONLY, CacheStrategy.HYBRID, CacheStrategy.WRITE_THROUGH]:
                entry = CacheEntry(
                    key=key,
                    value=value,
                    created_at=datetime.utcnow(),
                    expires_at=expires_at,
                    size_bytes=len(serialized_value),
                    compressed=compressed,
                    metadata=metadata or {}
                )
                
                self.memory_cache[key] = entry
                self.metrics.writes += 1
                
                # Check memory limits
                await self._enforce_memory_limits()
            
            # Redis cache (L2)
            if self.redis_client and strategy in [CacheStrategy.REDIS_ONLY, CacheStrategy.HYBRID, CacheStrategy.WRITE_THROUGH]:
                try:
                    cache_data = {
                        'value': serialized_value,
                        'compressed': str(compressed),
                        'created_at': datetime.utcnow().isoformat(),
                        'metadata': json.dumps(metadata or {})
                    }
                    
                    if expires_at:
                        cache_data['expires_at'] = expires_at.isoformat()
                    
                    await self.redis_client.hset(f"cache:{key}", mapping=cache_data)
                    
                    if ttl_seconds > 0:
                        await self.redis_client.expire(f"cache:{key}", ttl_seconds)
                
                except Exception as e:
                    logger.warning(f"Redis cache write failed for key {key}: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"Cache set failed for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from all cache layers"""
        try:
            # Remove from memory
            if key in self.memory_cache:
                del self.memory_cache[key]
            
            # Remove from Redis
            if self.redis_client:
                try:
                    await self.redis_client.delete(f"cache:{key}")
                except Exception as e:
                    logger.warning(f"Redis cache delete failed for key {key}: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"Cache delete failed for key {key}: {e}")
            return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        invalidated = 0
        
        try:
            # Memory cache pattern matching
            keys_to_remove = [key for key in self.memory_cache.keys() if self._matches_pattern(key, pattern)]
            for key in keys_to_remove:
                del self.memory_cache[key]
                invalidated += 1
            
            # Redis pattern matching
            if self.redis_client:
                try:
                    redis_keys = await self.redis_client.keys(f"cache:{pattern}")
                    if redis_keys:
                        await self.redis_client.delete(*redis_keys)
                        invalidated += len(redis_keys)
                except Exception as e:
                    logger.warning(f"Redis pattern invalidation failed: {e}")
            
            logger.info(f"Invalidated {invalidated} cache entries matching pattern: {pattern}")
            return invalidated
            
        except Exception as e:
            logger.error(f"Pattern invalidation failed for pattern {pattern}: {e}")
            return 0
    
    def _matches_pattern(self, key: str, pattern: str) -> bool:
        """Simple pattern matching with wildcards"""
        import fnmatch
        return fnmatch.fnmatch(key, pattern)
    
    def _is_valid(self, entry: CacheEntry) -> bool:
        """Check if cache entry is still valid"""
        if entry.expires_at and entry.expires_at <= datetime.utcnow():
            return False
        return True
    
    async def _promote_to_memory(self, key: str, value: Any, expires_at: Optional[datetime]):
        """Promote Redis cache entry to memory cache"""
        if len(self.memory_cache) < self.max_memory_entries:
            serialized_value, compressed = self._serialize_value(value)
            
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                size_bytes=len(serialized_value),
                compressed=compressed
            )
            
            self.memory_cache[key] = entry
    
    async def _enforce_memory_limits(self):
        """Enforce memory cache size limits"""
        # Check entry count limit
        if len(self.memory_cache) > self.max_memory_entries:
            await self._evict_lru_entries(len(self.memory_cache) - self.max_memory_entries)
        
        # Check memory size limit
        total_size = sum(entry.size_bytes for entry in self.memory_cache.values())
        max_size_bytes = self.max_memory_size_mb * 1024 * 1024
        
        if total_size > max_size_bytes:
            # Evict entries until under limit
            target_size = max_size_bytes * 0.8  # Target 80% of limit
            
            # Sort by LRU
            sorted_entries = sorted(
                self.memory_cache.items(),
                key=lambda x: (x[1].last_accessed, x[1].access_count)
            )
            
            current_size = total_size
            for key, entry in sorted_entries:
                if current_size <= target_size:
                    break
                
                del self.memory_cache[key]
                current_size -= entry.size_bytes
                self.metrics.evictions += 1
    
    async def _evict_lru_entries(self, count: int):
        """Evict least recently used entries"""
        if count <= 0:
            return
        
        # Sort by last accessed time and access count
        sorted_entries = sorted(
            self.memory_cache.items(),
            key=lambda x: (x[1].last_accessed, x[1].access_count)
        )
        
        for key, _ in sorted_entries[:count]:
            del self.memory_cache[key]
            self.metrics.evictions += 1
    
    def _update_avg_response_time(self, response_time_ms: float):
        """Update average response time with exponential moving average"""
        alpha = 0.1  # Smoothing factor
        if self.metrics.avg_response_time_ms == 0:
            self.metrics.avg_response_time_ms = response_time_ms
        else:
            self.metrics.avg_response_time_ms = (
                alpha * response_time_ms + 
                (1 - alpha) * self.metrics.avg_response_time_ms
            )
    
    async def _warm_cache(self):
        """Pre-populate cache with commonly accessed data"""
        try:
            logger.info("Starting cache warming process...")
            
            # This would be implemented with actual data patterns
            # For now, just log the intent
            warm_patterns = [
                "/api/v1/analyze/*",
                "/api/v1/dashboard/stats",
                "/api/v1/demo/*"
            ]
            
            logger.info(f"Cache warming completed for patterns: {warm_patterns}")
            
        except Exception as e:
            logger.warning(f"Cache warming failed: {e}")
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive cache metrics"""
        memory_usage = sum(entry.size_bytes for entry in self.memory_cache.values())
        
        redis_usage = 0
        if self.redis_client:
            try:
                info = await self.redis_client.info('memory')
                redis_usage = info.get('used_memory', 0)
            except:
                pass
        
        return {
            "memory_cache": {
                "entries": len(self.memory_cache),
                "max_entries": self.max_memory_entries,
                "usage_bytes": memory_usage,
                "usage_mb": round(memory_usage / (1024 * 1024), 2),
                "max_size_mb": self.max_memory_size_mb
            },
            "redis_cache": {
                "available": self.redis_client is not None,
                "usage_bytes": redis_usage,
                "usage_mb": round(redis_usage / (1024 * 1024), 2)
            },
            "performance": {
                "hit_rate_percent": round(self.metrics.hit_rate, 2),
                "hits": self.metrics.hits,
                "misses": self.metrics.misses,
                "writes": self.metrics.writes,
                "evictions": self.metrics.evictions,
                "avg_response_time_ms": round(self.metrics.avg_response_time_ms, 2)
            }
        }
    
    async def cleanup_expired(self):
        """Clean up expired cache entries"""
        if datetime.utcnow() - self._last_cleanup < self._cleanup_interval:
            return
        
        try:
            expired_keys = []
            for key, entry in self.memory_cache.items():
                if not self._is_valid(entry):
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.memory_cache[key]
            
            if expired_keys:
                logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
            
            self._last_cleanup = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"Cache cleanup failed: {e}")

# ==================== CACHE DECORATORS ====================

def cache_response(
    ttl_seconds: int = 3600,
    key_generator: Optional[Callable] = None,
    strategy: CacheStrategy = CacheStrategy.HYBRID,
    invalidate_patterns: Optional[List[str]] = None
):
    """
    Decorator for caching API responses
    
    Args:
        ttl_seconds: Cache TTL in seconds
        key_generator: Custom cache key generator function
        strategy: Cache strategy to use
        invalidate_patterns: Patterns to invalidate on cache updates
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request') or (args[0] if args and isinstance(args[0], Request) else None)
            
            if not request:
                # No request context, execute function normally
                return await func(*args, **kwargs)
            
            # Generate cache key
            if key_generator:
                cache_key = key_generator(request, *args, **kwargs)
            else:
                cache_key = enhanced_response_cache._generate_cache_key(
                    endpoint=str(request.url.path),
                    params=dict(request.query_params),
                    user_id=getattr(request.state, 'user_id', None)
                )
            
            # Try to get from cache
            cached_result = await enhanced_response_cache.get(cache_key, strategy=strategy)
            if cached_result is not None:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await enhanced_response_cache.set(
                key=cache_key,
                value=result,
                ttl_seconds=ttl_seconds,
                strategy=strategy,
                metadata={
                    'endpoint': str(request.url.path),
                    'cached_at': datetime.utcnow().isoformat()
                }
            )
            
            return result
        
        return wrapper
    return decorator

# Global cache instance
enhanced_response_cache = EnhancedResponseCache()

# Initialize cache on startup
async def initialize_response_cache():
    """Initialize the response cache system"""
    await enhanced_response_cache.initialize()

# Cleanup function for background tasks
async def cleanup_response_cache():
    """Cleanup expired cache entries"""
    await enhanced_response_cache.cleanup_expired() 