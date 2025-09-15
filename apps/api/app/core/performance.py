"""
Comprehensive Performance Optimization Framework for Schlep Engine
Implements database optimization, caching, streaming, and monitoring
"""

import asyncio
import time
import functools
import logging
import psutil
import threading
from typing import Any, Dict, List, Optional, Union, Callable, AsyncGenerator
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import json
import gzip
from collections import defaultdict, deque

from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.orm import Query
import redis.asyncio as redis
from fastapi import Request, Response
from fastapi.responses import StreamingResponse
import aiofiles

from app.core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Performance metrics tracking"""
    request_count: int = 0
    average_response_time: float = 0.0
    error_count: int = 0
    cache_hit_rate: float = 0.0
    database_query_count: int = 0
    database_average_time: float = 0.0
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0
    concurrent_connections: int = 0
    slow_queries_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class QueryOptimization:
    """Query optimization configuration"""
    use_query_cache: bool = True
    enable_result_streaming: bool = True
    batch_size: int = 1000
    connection_pool_size: int = 20
    max_overflow: int = 30
    query_timeout: int = 30
    enable_query_explain: bool = False
    cache_ttl_seconds: int = 300


class PerformanceOptimizer:
    """
    Comprehensive performance optimization system
    """

    def __init__(self):
        self.metrics = PerformanceMetrics()
        self.query_cache = {}
        self.redis_client: Optional[redis.Redis] = None
        self.performance_history = deque(maxlen=1000)
        self.slow_queries = deque(maxlen=100)
        self._lock = threading.Lock()
        self._memory_monitor_task: Optional[asyncio.Task] = None
        self._initialized = False

    async def initialize(self):
        """Initialize performance optimizer"""
        if self._initialized:
            return

        try:
            # Initialize Redis connection for caching
            if settings.USE_REDIS_CACHE:
                self.redis_client = redis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_keepalive=True,
                    socket_keepalive_options={},
                    health_check_interval=30,
                    retry_on_timeout=True,
                    max_connections=50,
                    connection_pool_class_kwargs={
                        "max_connections": 50,
                        "retry_on_timeout": True,
                    }
                )
                await self.redis_client.ping()
                logger.info("Redis connection established for performance optimization")

            # Start memory monitoring
            self._memory_monitor_task = asyncio.create_task(self._monitor_system_resources())

            self._initialized = True
            logger.info("Performance optimizer initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize performance optimizer: {e}")
            self.redis_client = None

    async def close(self):
        """Close performance optimizer and cleanup resources"""
        if self._memory_monitor_task:
            self._memory_monitor_task.cancel()
            try:
                await self._memory_monitor_task
            except asyncio.CancelledError:
                pass

        if self.redis_client:
            await self.redis_client.close()

        logger.info("Performance optimizer closed")

    async def _monitor_system_resources(self):
        """Monitor system resources continuously"""
        while True:
            try:
                # Get system metrics
                process = psutil.Process()
                memory_info = process.memory_info()
                cpu_percent = process.cpu_percent()

                # Update metrics
                with self._lock:
                    self.metrics.memory_usage_mb = memory_info.rss / 1024 / 1024
                    self.metrics.cpu_usage_percent = cpu_percent

                    # Record performance history
                    self.performance_history.append({
                        "timestamp": datetime.utcnow().isoformat(),
                        "memory_mb": self.metrics.memory_usage_mb,
                        "cpu_percent": self.metrics.cpu_usage_percent,
                        "request_count": self.metrics.request_count,
                        "error_count": self.metrics.error_count,
                        "cache_hit_rate": self.metrics.cache_hit_rate
                    })

                await asyncio.sleep(10)  # Monitor every 10 seconds

            except Exception as e:
                logger.error(f"Error monitoring system resources: {e}")
                await asyncio.sleep(30)  # Wait longer on error

    def record_request(self, duration: float, success: bool = True):
        """Record request metrics"""
        with self._lock:
            self.metrics.request_count += 1

            # Update average response time using exponential moving average
            alpha = 0.1
            if self.metrics.average_response_time == 0:
                self.metrics.average_response_time = duration
            else:
                self.metrics.average_response_time = (
                    alpha * duration + (1 - alpha) * self.metrics.average_response_time
                )

            if not success:
                self.metrics.error_count += 1

    def record_database_query(self, duration: float, query: str, slow_threshold: float = 1.0):
        """Record database query metrics"""
        with self._lock:
            self.metrics.database_query_count += 1

            # Update average query time
            alpha = 0.1
            if self.metrics.database_average_time == 0:
                self.metrics.database_average_time = duration
            else:
                self.metrics.database_average_time = (
                    alpha * duration + (1 - alpha) * self.metrics.database_average_time
                )

            # Track slow queries
            if duration > slow_threshold:
                self.metrics.slow_queries_count += 1
                self.slow_queries.append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "duration": duration,
                    "query": query[:500],  # Truncate long queries
                    "full_query": query
                })

    async def cache_get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.redis_client:
                cached_data = await self.redis_client.get(f"perf:{key}")
                if cached_data:
                    # Update cache hit rate
                    with self._lock:
                        total_requests = self.metrics.request_count
                        if total_requests > 0:
                            hits = total_requests * self.metrics.cache_hit_rate + 1
                            self.metrics.cache_hit_rate = hits / (total_requests + 1)

                    return json.loads(cached_data)

            # Fallback to in-memory cache
            return self.query_cache.get(key)

        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None

    async def cache_set(
        self,
        key: str,
        value: Any,
        ttl: int = 300,
        compress: bool = False
    ) -> bool:
        """Set value in cache with optional compression"""
        try:
            serialized_data = json.dumps(value, default=str)

            if compress and len(serialized_data) > 1024:  # Compress large data
                serialized_data = gzip.compress(serialized_data.encode()).decode('latin1')
                key = f"compressed:{key}"

            if self.redis_client:
                await self.redis_client.setex(f"perf:{key}", ttl, serialized_data)
            else:
                # Fallback to in-memory cache with TTL simulation
                self.query_cache[key] = {
                    "value": value,
                    "expires": time.time() + ttl
                }

            return True

        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False

    async def cache_invalidate(self, pattern: str = "*") -> int:
        """Invalidate cache entries by pattern"""
        try:
            invalidated = 0

            if self.redis_client:
                keys = await self.redis_client.keys(f"perf:{pattern}")
                if keys:
                    invalidated = await self.redis_client.delete(*keys)
            else:
                # Clear in-memory cache
                if pattern == "*":
                    invalidated = len(self.query_cache)
                    self.query_cache.clear()
                else:
                    # Simple pattern matching for in-memory cache
                    keys_to_delete = [k for k in self.query_cache.keys() if pattern in k]
                    for key in keys_to_delete:
                        del self.query_cache[key]
                    invalidated = len(keys_to_delete)

            logger.info(f"Invalidated {invalidated} cache entries with pattern: {pattern}")
            return invalidated

        except Exception as e:
            logger.error(f"Cache invalidation error for pattern {pattern}: {e}")
            return 0

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        with self._lock:
            metrics_dict = self.metrics.to_dict()

            # Add additional insights
            metrics_dict.update({
                "performance_score": self._calculate_performance_score(),
                "recommendations": self._get_performance_recommendations(),
                "slow_queries_sample": list(self.slow_queries)[-5:],  # Last 5 slow queries
                "performance_trend": self._get_performance_trend(),
                "system_health": self._assess_system_health()
            })

            return metrics_dict

    def _calculate_performance_score(self) -> float:
        """Calculate overall performance score (0-100)"""
        score = 100.0

        # Penalize for high response times
        if self.metrics.average_response_time > 2.0:
            score -= min(30, (self.metrics.average_response_time - 2.0) * 10)

        # Penalize for high error rate
        if self.metrics.request_count > 0:
            error_rate = self.metrics.error_count / self.metrics.request_count
            if error_rate > 0.01:  # More than 1% error rate
                score -= min(25, error_rate * 100 * 25)

        # Penalize for low cache hit rate
        if self.metrics.cache_hit_rate < 0.8:
            score -= (0.8 - self.metrics.cache_hit_rate) * 20

        # Penalize for high memory usage
        if self.metrics.memory_usage_mb > 1000:  # More than 1GB
            score -= min(15, (self.metrics.memory_usage_mb - 1000) / 100)

        # Penalize for slow queries
        if self.metrics.slow_queries_count > 10:
            score -= min(20, (self.metrics.slow_queries_count - 10) * 2)

        return max(0, score)

    def _get_performance_recommendations(self) -> List[str]:
        """Generate performance recommendations"""
        recommendations = []

        if self.metrics.average_response_time > 1.0:
            recommendations.append("Consider implementing response caching and query optimization")

        if self.metrics.cache_hit_rate < 0.7:
            recommendations.append("Improve caching strategy to increase hit rate")

        if self.metrics.slow_queries_count > 5:
            recommendations.append("Optimize slow database queries and add proper indexes")

        if self.metrics.memory_usage_mb > 800:
            recommendations.append("Monitor memory usage and consider implementing memory pooling")

        if self.metrics.database_average_time > 0.5:
            recommendations.append("Optimize database queries and connection pooling")

        if self.metrics.error_count > self.metrics.request_count * 0.05:
            recommendations.append("Investigate and fix high error rate")

        return recommendations

    def _get_performance_trend(self) -> str:
        """Analyze performance trend"""
        if len(self.performance_history) < 10:
            return "insufficient_data"

        recent = list(self.performance_history)[-5:]
        older = list(self.performance_history)[-10:-5]

        recent_avg_response = sum(h.get("memory_mb", 0) for h in recent) / len(recent)
        older_avg_response = sum(h.get("memory_mb", 0) for h in older) / len(older)

        if recent_avg_response > older_avg_response * 1.2:
            return "degrading"
        elif recent_avg_response < older_avg_response * 0.8:
            return "improving"
        else:
            return "stable"

    def _assess_system_health(self) -> str:
        """Assess overall system health"""
        score = self._calculate_performance_score()

        if score >= 90:
            return "excellent"
        elif score >= 80:
            return "good"
        elif score >= 70:
            return "fair"
        elif score >= 60:
            return "poor"
        else:
            return "critical"

    async def explain_query(self, session: AsyncSession, query: Union[Select, str]) -> Dict[str, Any]:
        """Get query execution plan for optimization"""
        try:
            if isinstance(query, str):
                explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"
            else:
                explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"

            result = await session.execute(text(explain_query))
            explain_result = result.scalar()

            return {
                "execution_plan": explain_result,
                "recommendations": self._analyze_execution_plan(explain_result)
            }

        except Exception as e:
            logger.error(f"Query explain error: {e}")
            return {"error": str(e)}

    def _analyze_execution_plan(self, plan: Any) -> List[str]:
        """Analyze execution plan and provide recommendations"""
        recommendations = []

        try:
            if isinstance(plan, list) and len(plan) > 0:
                plan_data = plan[0].get("Plan", {})

                # Check for sequential scans
                if "Seq Scan" in plan_data.get("Node Type", ""):
                    recommendations.append("Consider adding an index to avoid sequential scan")

                # Check for expensive operations
                total_cost = plan_data.get("Total Cost", 0)
                if total_cost > 1000:
                    recommendations.append("Query has high cost, consider optimization")

                # Check execution time
                execution_time = plan_data.get("Actual Total Time", 0)
                if execution_time > 1000:  # More than 1 second
                    recommendations.append("Query execution time is high")

        except Exception as e:
            logger.error(f"Error analyzing execution plan: {e}")

        return recommendations


# Global performance optimizer instance
performance_optimizer = PerformanceOptimizer()

# Performance monitoring decorators
def monitor_performance(
    cache_key: Optional[str] = None,
    cache_ttl: int = 300,
    enable_caching: bool = True
):
    """Decorator to monitor and optimize function performance"""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()

            # Try to get from cache if enabled
            if enable_caching and cache_key:
                cached_result = await performance_optimizer.cache_get(cache_key)
                if cached_result is not None:
                    return cached_result

            try:
                # Execute function
                result = await func(*args, **kwargs)

                # Cache result if enabled
                if enable_caching and cache_key:
                    await performance_optimizer.cache_set(cache_key, result, cache_ttl)

                # Record successful request
                duration = time.time() - start_time
                performance_optimizer.record_request(duration, success=True)

                return result

            except Exception as e:
                # Record failed request
                duration = time.time() - start_time
                performance_optimizer.record_request(duration, success=False)
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                performance_optimizer.record_request(duration, success=True)
                return result

            except Exception as e:
                duration = time.time() - start_time
                performance_optimizer.record_request(duration, success=False)
                raise

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator


def monitor_database_query(slow_threshold: float = 1.0):
    """Decorator to monitor database query performance"""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time

                # Extract query information if available
                query_info = str(func.__name__)
                if hasattr(func, '__annotations__'):
                    query_info += f" - {func.__annotations__}"

                performance_optimizer.record_database_query(
                    duration,
                    query_info,
                    slow_threshold
                )

                return result

            except Exception as e:
                duration = time.time() - start_time
                performance_optimizer.record_database_query(
                    duration,
                    f"FAILED: {func.__name__}",
                    slow_threshold
                )
                raise

        return async_wrapper if asyncio.iscoroutinefunction(func) else func

    return decorator


# Context managers for performance optimization
@asynccontextmanager
async def optimized_database_session(session: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    """Optimized database session context manager"""
    try:
        # Set session-level optimizations
        await session.execute(text("SET LOCAL work_mem = '64MB'"))
        await session.execute(text("SET LOCAL random_page_cost = 1.1"))
        await session.execute(text("SET LOCAL cpu_tuple_cost = 0.01"))

        yield session

    except Exception as e:
        logger.error(f"Database session optimization error: {e}")
        raise


# Streaming utilities
class StreamingProcessor:
    """High-performance streaming data processor"""

    def __init__(self, chunk_size: int = 8192):
        self.chunk_size = chunk_size

    async def stream_file_processing(
        self,
        file_path: str,
        processor: Callable[[bytes], bytes],
        output_path: Optional[str] = None
    ) -> AsyncGenerator[bytes, None]:
        """Stream process large files without loading into memory"""
        try:
            async with aiofiles.open(file_path, 'rb') as input_file:
                output_file = None
                if output_path:
                    output_file = await aiofiles.open(output_path, 'wb').__aenter__()

                try:
                    while True:
                        chunk = await input_file.read(self.chunk_size)
                        if not chunk:
                            break

                        processed_chunk = processor(chunk)

                        if output_file:
                            await output_file.write(processed_chunk)

                        yield processed_chunk

                        # Allow other coroutines to run
                        await asyncio.sleep(0)

                finally:
                    if output_file:
                        await output_file.__aexit__(None, None, None)

        except Exception as e:
            logger.error(f"Streaming file processing error: {e}")
            raise

    async def stream_csv_processing(
        self,
        file_path: str,
        batch_size: int = 1000
    ) -> AsyncGenerator[List[Dict[str, Any]], None]:
        """Stream process CSV files in batches"""
        import csv
        import io

        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
                content = await file.read(self.chunk_size)
                buffer = ""

                while content:
                    buffer += content
                    lines = buffer.split('\n')

                    # Keep the last incomplete line in buffer
                    buffer = lines[-1]
                    complete_lines = lines[:-1]

                    if complete_lines:
                        # Process complete lines
                        csv_data = io.StringIO('\n'.join(complete_lines))
                        reader = csv.DictReader(csv_data)

                        batch = []
                        for row in reader:
                            batch.append(row)
                            if len(batch) >= batch_size:
                                yield batch
                                batch = []

                        if batch:
                            yield batch

                    # Read next chunk
                    content = await file.read(self.chunk_size)
                    await asyncio.sleep(0)  # Allow other coroutines to run

                # Process remaining buffer
                if buffer.strip():
                    csv_data = io.StringIO(buffer)
                    reader = csv.DictReader(csv_data)
                    batch = list(reader)
                    if batch:
                        yield batch

        except Exception as e:
            logger.error(f"CSV streaming processing error: {e}")
            raise

# Global streaming processor
streaming_processor = StreamingProcessor()