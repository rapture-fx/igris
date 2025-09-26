#!/usr/bin/env python3
"""
Redis/Cache management utilities for Schlep Engine Phase One
Designed for compatibility with DragonflyDB migration in Phase Two
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import redis.asyncio as redis
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

class CacheNamespace(Enum):
    """Cache namespaces for different data types"""
    USER_PROFILES = "user_profiles"
    API_RESPONSES = "api_responses"
    TASK_RESULTS = "task_results"
    SESSIONS = "sessions"
    RATE_LIMITS = "rate_limits"
    METRICS = "metrics"
    LOCKS = "locks"

@dataclass
class CacheKey:
    """Structured cache key for consistent naming"""
    namespace: CacheNamespace
    identifier: str
    subkey: Optional[str] = None

    def __str__(self) -> str:
        key = f"schlep:cache:{self.namespace.value}:{self.identifier}"
        if self.subkey:
            key += f":{self.subkey}"
        return key

@dataclass
class TaskQueueItem:
    """Task queue item structure"""
    task_id: str
    organization_id: str
    task_definition_id: str
    priority: str
    input_data: Dict[str, Any]
    created_at: datetime
    retry_count: int = 0

class CacheManager:
    """
    Redis cache management with DragonflyDB compatibility
    """

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    # =========================================================================
    # Basic Cache Operations (DragonflyDB Compatible)
    # =========================================================================

    async def set(
        self,
        key: Union[str, CacheKey],
        value: Any,
        ttl: Optional[int] = None,
        json_encode: bool = True
    ) -> bool:
        """Set a cache value with optional TTL"""
        key_str = str(key)

        if json_encode and not isinstance(value, (str, bytes)):
            value = json.dumps(value, default=str)

        if ttl:
            return await self.redis.setex(key_str, ttl, value)
        else:
            return await self.redis.set(key_str, value)

    async def get(
        self,
        key: Union[str, CacheKey],
        json_decode: bool = True
    ) -> Optional[Any]:
        """Get a cache value with optional JSON decoding"""
        key_str = str(key)
        value = await self.redis.get(key_str)

        if value is None:
            return None

        if json_decode:
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value

        return value

    async def delete(self, key: Union[str, CacheKey]) -> int:
        """Delete a cache key"""
        key_str = str(key)
        return await self.redis.delete(key_str)

    async def exists(self, key: Union[str, CacheKey]) -> bool:
        """Check if a cache key exists"""
        key_str = str(key)
        return await self.redis.exists(key_str)

    async def expire(self, key: Union[str, CacheKey], ttl: int) -> bool:
        """Set TTL on an existing key"""
        key_str = str(key)
        return await self.redis.expire(key_str, ttl)

    async def ttl(self, key: Union[str, CacheKey]) -> int:
        """Get TTL of a key"""
        key_str = str(key)
        return await self.redis.ttl(key_str)

    # =========================================================================
    # Hash Operations (for structured data)
    # =========================================================================

    async def hset(self, key: Union[str, CacheKey], field: str, value: Any) -> int:
        """Set a hash field"""
        key_str = str(key)
        if not isinstance(value, (str, bytes)):
            value = json.dumps(value, default=str)
        return await self.redis.hset(key_str, field, value)

    async def hget(self, key: Union[str, CacheKey], field: str) -> Optional[Any]:
        """Get a hash field"""
        key_str = str(key)
        value = await self.redis.hget(key_str, field)
        if value is None:
            return None

        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value

    async def hmset(self, key: Union[str, CacheKey], data: Dict[str, Any]) -> bool:
        """Set multiple hash fields"""
        key_str = str(key)
        encoded_data = {}
        for field, value in data.items():
            if not isinstance(value, (str, bytes)):
                value = json.dumps(value, default=str)
            encoded_data[field] = value

        return await self.redis.hmset(key_str, encoded_data)

    async def hgetall(self, key: Union[str, CacheKey]) -> Dict[str, Any]:
        """Get all hash fields"""
        key_str = str(key)
        data = await self.redis.hgetall(key_str)

        result = {}
        for field, value in data.items():
            try:
                result[field] = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                result[field] = value

        return result

    # =========================================================================
    # Set Operations (for indexes and lookups)
    # =========================================================================

    async def sadd(self, key: Union[str, CacheKey], *members: str) -> int:
        """Add members to a set"""
        key_str = str(key)
        return await self.redis.sadd(key_str, *members)

    async def srem(self, key: Union[str, CacheKey], *members: str) -> int:
        """Remove members from a set"""
        key_str = str(key)
        return await self.redis.srem(key_str, *members)

    async def smembers(self, key: Union[str, CacheKey]) -> set:
        """Get all set members"""
        key_str = str(key)
        return await self.redis.smembers(key_str)

    async def sismember(self, key: Union[str, CacheKey], member: str) -> bool:
        """Check if member is in set"""
        key_str = str(key)
        return await self.redis.sismember(key_str, member)

    # =========================================================================
    # Sorted Set Operations (for rankings and scheduling)
    # =========================================================================

    async def zadd(
        self,
        key: Union[str, CacheKey],
        mapping: Dict[str, float]
    ) -> int:
        """Add scored members to sorted set"""
        key_str = str(key)
        return await self.redis.zadd(key_str, mapping)

    async def zrange(
        self,
        key: Union[str, CacheKey],
        start: int,
        end: int,
        withscores: bool = False
    ) -> List:
        """Get range from sorted set"""
        key_str = str(key)
        return await self.redis.zrange(key_str, start, end, withscores=withscores)

    async def zrem(self, key: Union[str, CacheKey], *members: str) -> int:
        """Remove members from sorted set"""
        key_str = str(key)
        return await self.redis.zrem(key_str, *members)

    # =========================================================================
    # Stream Operations (for task queues and events)
    # =========================================================================

    async def xadd(
        self,
        stream: str,
        fields: Dict[str, Any],
        message_id: str = "*"
    ) -> str:
        """Add message to stream"""
        # Encode all field values as JSON
        encoded_fields = {}
        for key, value in fields.items():
            if not isinstance(value, (str, bytes)):
                encoded_fields[key] = json.dumps(value, default=str)
            else:
                encoded_fields[key] = value

        return await self.redis.xadd(stream, encoded_fields, id=message_id)

    async def xread(
        self,
        streams: Dict[str, str],
        count: Optional[int] = None,
        block: Optional[int] = None
    ) -> List:
        """Read from streams"""
        return await self.redis.xread(streams, count=count, block=block)

    async def xgroup_create(
        self,
        stream: str,
        groupname: str,
        message_id: str = "$",
        mkstream: bool = False
    ) -> bool:
        """Create consumer group"""
        try:
            await self.redis.xgroup_create(stream, groupname, id=message_id, mkstream=mkstream)
            return True
        except Exception as e:
            if "BUSYGROUP" in str(e):
                return True  # Group already exists
            raise

    # =========================================================================
    # High-level Cache Operations
    # =========================================================================

    async def cache_user_profile(
        self,
        user_id: str,
        profile_data: Dict[str, Any],
        ttl: int = 1800  # 30 minutes
    ) -> bool:
        """Cache user profile data"""
        cache_key = CacheKey(CacheNamespace.USER_PROFILES, user_id)
        return await self.set(cache_key, profile_data, ttl=ttl)

    async def get_cached_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached user profile"""
        cache_key = CacheKey(CacheNamespace.USER_PROFILES, user_id)
        return await self.get(cache_key)

    async def cache_api_response(
        self,
        endpoint_key: str,
        response_data: Any,
        ttl: int = 300  # 5 minutes
    ) -> bool:
        """Cache API response"""
        cache_key = CacheKey(CacheNamespace.API_RESPONSES, endpoint_key)
        return await self.set(cache_key, response_data, ttl=ttl)

    async def get_cached_api_response(self, endpoint_key: str) -> Optional[Any]:
        """Get cached API response"""
        cache_key = CacheKey(CacheNamespace.API_RESPONSES, endpoint_key)
        return await self.get(cache_key)

    async def cache_task_result(
        self,
        task_execution_id: str,
        result_data: Dict[str, Any],
        ttl: int = 86400  # 24 hours
    ) -> bool:
        """Cache task execution result"""
        cache_key = CacheKey(CacheNamespace.TASK_RESULTS, task_execution_id)
        return await self.set(cache_key, result_data, ttl=ttl)

    async def get_cached_task_result(self, task_execution_id: str) -> Optional[Dict[str, Any]]:
        """Get cached task result"""
        cache_key = CacheKey(CacheNamespace.TASK_RESULTS, task_execution_id)
        return await self.get(cache_key)

    # =========================================================================
    # Session Management
    # =========================================================================

    async def create_session(
        self,
        user_id: str,
        session_data: Dict[str, Any],
        ttl: int = 86400  # 24 hours
    ) -> str:
        """Create a new session"""
        session_id = f"sess:{user_id}:{int(datetime.utcnow().timestamp())}"
        session_key = CacheKey(CacheNamespace.SESSIONS, session_id)

        session_data.update({
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "last_accessed": datetime.utcnow().isoformat(),
        })

        await self.set(session_key, session_data, ttl=ttl)
        return session_id

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        session_key = CacheKey(CacheNamespace.SESSIONS, session_id)
        session_data = await self.get(session_key)

        if session_data:
            # Update last accessed time
            session_data["last_accessed"] = datetime.utcnow().isoformat()
            await self.set(session_key, session_data, ttl=await self.ttl(session_key))

        return session_data

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        session_key = CacheKey(CacheNamespace.SESSIONS, session_id)
        return bool(await self.delete(session_key))

    # =========================================================================
    # Rate Limiting
    # =========================================================================

    async def check_rate_limit(
        self,
        identifier: str,
        limit: int,
        window_seconds: int = 60
    ) -> Dict[str, Any]:
        """Check rate limit using sliding window"""
        rate_limit_key = CacheKey(CacheNamespace.RATE_LIMITS, identifier)
        current_time = datetime.utcnow().timestamp()
        window_start = current_time - window_seconds

        # Use sorted set for sliding window
        await self.redis.zremrangebyscore(str(rate_limit_key), 0, window_start)
        current_count = await self.redis.zcard(str(rate_limit_key))

        if current_count >= limit:
            return {
                "allowed": False,
                "limit": limit,
                "remaining": 0,
                "reset_time": window_start + window_seconds,
            }

        # Add current request
        await self.redis.zadd(str(rate_limit_key), {str(current_time): current_time})
        await self.redis.expire(str(rate_limit_key), window_seconds + 1)

        return {
            "allowed": True,
            "limit": limit,
            "remaining": limit - current_count - 1,
            "reset_time": current_time + window_seconds,
        }

    # =========================================================================
    # Task Queue Management (Redis Streams)
    # =========================================================================

    async def enqueue_task(
        self,
        task_item: TaskQueueItem,
        priority: str = "normal"
    ) -> str:
        """Enqueue a task using Redis Streams"""
        stream_name = f"schlep:tasks:{priority}"

        message_fields = {
            "task_id": task_item.task_id,
            "organization_id": task_item.organization_id,
            "task_definition_id": task_item.task_definition_id,
            "priority": task_item.priority,
            "input_data": task_item.input_data,
            "created_at": task_item.created_at.isoformat(),
            "retry_count": task_item.retry_count,
        }

        return await self.xadd(stream_name, message_fields)

    async def setup_task_queues(self) -> bool:
        """Set up task queues and consumer groups"""
        try:
            queues = ["high", "normal", "low", "failed"]
            for queue in queues:
                stream_name = f"schlep:tasks:{queue}"
                await self.xgroup_create(stream_name, "processors", mkstream=True)

            logger.info("Task queues set up successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to set up task queues: {e}")
            return False

    # =========================================================================
    # Metrics and Monitoring
    # =========================================================================

    async def increment_metric(self, metric_name: str, value: int = 1) -> int:
        """Increment a metric counter"""
        metric_key = f"schlep:metrics:{metric_name}"
        return await self.redis.incrby(metric_key, value)

    async def set_gauge_metric(self, metric_name: str, value: float) -> bool:
        """Set a gauge metric value"""
        metric_key = f"schlep:metrics:{metric_name}"
        return await self.redis.set(metric_key, value)

    async def get_metric(self, metric_name: str) -> Optional[float]:
        """Get a metric value"""
        metric_key = f"schlep:metrics:{metric_name}"
        value = await self.redis.get(metric_key)
        return float(value) if value else None

    # =========================================================================
    # Cleanup and Maintenance
    # =========================================================================

    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        pattern = str(CacheKey(CacheNamespace.SESSIONS, "*"))
        cursor = 0
        cleaned_count = 0

        while True:
            cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)

            for key in keys:
                ttl_value = await self.ttl(key)
                if ttl_value == -1:  # No TTL set
                    await self.redis.expire(key, 86400)  # Set 24h TTL
                elif ttl_value == -2:  # Key expired
                    await self.delete(key)
                    cleaned_count += 1

            if cursor == 0:
                break

        return cleaned_count

    async def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache usage statistics"""
        info = await self.redis.info()
        memory_info = await self.redis.info("memory")
        keyspace_info = await self.redis.info("keyspace")

        return {
            "connected_clients": info.get("connected_clients", 0),
            "used_memory_bytes": memory_info.get("used_memory", 0),
            "used_memory_human": memory_info.get("used_memory_human", "0B"),
            "keyspace": keyspace_info,
            "total_commands_processed": info.get("total_commands_processed", 0),
            "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec", 0),
        }