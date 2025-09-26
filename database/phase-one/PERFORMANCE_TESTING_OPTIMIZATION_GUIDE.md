# Schlep Engine Phase One: Performance Testing & Optimization Guide

## Executive Summary

This guide provides comprehensive performance testing and optimization strategies for Schlep Engine's Phase One database infrastructure. It covers testing methodologies, benchmarking tools, optimization techniques, and scaling strategies for achieving 1,000+ concurrent users within the $300/month budget constraint.

**Performance Targets:**
- **Concurrent Users**: 1,000 (with growth path to 10,000+)
- **Response Time**: <100ms for 95th percentile
- **Throughput**: 1,000+ requests/second
- **Database Queries**: <50ms average response
- **Cache Hit Ratio**: >95%
- **Uptime**: 99.9%

---

## Testing Environment Setup

### Load Testing Infrastructure

**Recommended Testing Stack:**
```yaml
# docker-compose.testing.yml
version: '3.8'
services:
  # Artillery.io for load testing
  artillery:
    image: artilleryio/artillery:latest
    volumes:
      - ./load-tests:/tests
    command: run /tests/api-load-test.yml
    networks:
      - testing

  # K6 for performance testing
  k6:
    image: grafana/k6:latest
    volumes:
      - ./k6-tests:/scripts
    command: run /scripts/database-performance.js
    networks:
      - testing

  # Monitoring during tests
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    ports:
      - "8080:8080"
    volumes:
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
```

### Database Performance Testing Tools

**1. PostgreSQL Benchmarking**
```bash
# Install pgbench for database load testing
apt-get install postgresql-contrib

# Initialize test database
pgbench -i -s 50 -d schlep_engine -h localhost -U schlep_user

# Run performance test
pgbench -c 20 -j 4 -T 300 -h localhost -U schlep_user schlep_engine
```

**2. Redis Benchmarking**
```bash
# Install redis-benchmark
apt-get install redis-tools

# Run Redis performance test
redis-benchmark -h localhost -p 6379 -a schlep_redis_dev_2024 -c 50 -n 100000

# Test specific operations
redis-benchmark -h localhost -p 6379 -a schlep_redis_dev_2024 -t set,get,incr,lpush,rpush,lpop,rpop,sadd,hset,spop,lrange,mset -c 50 -n 100000
```

---

## Performance Testing Scripts

### 1. Database Load Testing

**PostgreSQL Stress Test Script**
```python
#!/usr/bin/env python3
"""
PostgreSQL performance testing for Schlep Engine
Tests concurrent database operations under load
"""

import asyncio
import asyncpg
import time
import statistics
from typing import List, Dict, Any
import random
import uuid

class DatabaseLoadTester:
    def __init__(self, connection_string: str, concurrent_connections: int = 50):
        self.connection_string = connection_string
        self.concurrent_connections = concurrent_connections
        self.results = []

    async def create_connection_pool(self):
        """Create connection pool for load testing"""
        self.pool = await asyncpg.create_pool(
            self.connection_string,
            min_size=self.concurrent_connections,
            max_size=self.concurrent_connections * 2,
            command_timeout=60
        )

    async def test_read_operations(self, duration_seconds: int = 300):
        """Test read-heavy workload"""
        print(f"Starting read operations test for {duration_seconds} seconds...")

        start_time = time.time()
        tasks = []

        async def read_worker():
            operation_times = []
            while time.time() - start_time < duration_seconds:
                async with self.pool.acquire() as conn:
                    # Test various read operations
                    ops_start = time.time()

                    # Random organization query
                    await conn.fetchrow(
                        "SELECT * FROM organizations WHERE deleted_at IS NULL ORDER BY RANDOM() LIMIT 1"
                    )

                    # User lookup
                    await conn.fetch(
                        "SELECT * FROM users WHERE organization_id = $1 LIMIT 10",
                        str(uuid.uuid4())  # Random UUID
                    )

                    # Task execution stats
                    await conn.fetchrow(
                        "SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FROM task_executions WHERE created_at > NOW() - INTERVAL '1 hour'"
                    )

                    operation_times.append(time.time() - ops_start)

                    await asyncio.sleep(0.01)  # Small delay to simulate real usage

            return operation_times

        # Start concurrent workers
        for _ in range(self.concurrent_connections):
            tasks.append(asyncio.create_task(read_worker()))

        all_times = []
        for task in tasks:
            times = await task
            all_times.extend(times)

        return {
            "operation": "read_operations",
            "total_operations": len(all_times),
            "avg_response_time": statistics.mean(all_times),
            "p95_response_time": statistics.quantiles(all_times, n=20)[18],  # 95th percentile
            "p99_response_time": statistics.quantiles(all_times, n=100)[98],  # 99th percentile
            "ops_per_second": len(all_times) / duration_seconds,
        }

    async def test_write_operations(self, duration_seconds: int = 300):
        """Test write-heavy workload"""
        print(f"Starting write operations test for {duration_seconds} seconds...")

        start_time = time.time()
        tasks = []

        async def write_worker():
            operation_times = []
            while time.time() - start_time < duration_seconds:
                async with self.pool.acquire() as conn:
                    async with conn.transaction():
                        ops_start = time.time()

                        # Insert task execution
                        task_id = str(uuid.uuid4())
                        await conn.execute("""
                            INSERT INTO task_executions (id, task_definition_id, organization_id, status, input_data)
                            VALUES ($1, $2, $3, 'pending', '{"test": true}')
                        """, task_id, str(uuid.uuid4()), str(uuid.uuid4()))

                        # Update task status
                        await conn.execute("""
                            UPDATE task_executions SET status = 'running', started_at = NOW() WHERE id = $1
                        """, task_id)

                        # Insert audit log
                        await conn.execute("""
                            INSERT INTO audit_logs (organization_id, event_type, resource_type, resource_id, event_data)
                            VALUES ($1, 'task_execution.start', 'task_execution', $2, '{"automated_test": true}')
                        """, str(uuid.uuid4()), task_id)

                        operation_times.append(time.time() - ops_start)

                await asyncio.sleep(0.02)  # Slightly longer delay for write operations

            return operation_times

        # Start concurrent workers
        for _ in range(self.concurrent_connections // 2):  # Fewer write workers
            tasks.append(asyncio.create_task(write_worker()))

        all_times = []
        for task in tasks:
            times = await task
            all_times.extend(times)

        return {
            "operation": "write_operations",
            "total_operations": len(all_times),
            "avg_response_time": statistics.mean(all_times),
            "p95_response_time": statistics.quantiles(all_times, n=20)[18],
            "p99_response_time": statistics.quantiles(all_times, n=100)[98],
            "ops_per_second": len(all_times) / duration_seconds,
        }

    async def test_mixed_workload(self, duration_seconds: int = 600):
        """Test realistic mixed read/write workload"""
        print(f"Starting mixed workload test for {duration_seconds} seconds...")

        # 70% reads, 30% writes (typical web application ratio)
        read_tasks = []
        write_tasks = []

        # Create read workers
        for _ in range(int(self.concurrent_connections * 0.7)):
            read_tasks.append(asyncio.create_task(self.test_read_operations(duration_seconds)))

        # Create write workers
        for _ in range(int(self.concurrent_connections * 0.3)):
            write_tasks.append(asyncio.create_task(self.test_write_operations(duration_seconds)))

        # Wait for all tasks
        results = await asyncio.gather(*read_tasks, *write_tasks)

        return {
            "operation": "mixed_workload",
            "read_results": [r for r in results if r["operation"] == "read_operations"],
            "write_results": [r for r in results if r["operation"] == "write_operations"],
        }

    async def run_comprehensive_test(self):
        """Run comprehensive database performance test"""
        await self.create_connection_pool()

        tests = [
            ("Read Heavy", self.test_read_operations, 300),
            ("Write Heavy", self.test_write_operations, 300),
            ("Mixed Workload", self.test_mixed_workload, 600),
        ]

        results = {}
        for test_name, test_func, duration in tests:
            print(f"\n=== {test_name} Test ===")
            result = await test_func(duration)
            results[test_name.lower().replace(" ", "_")] = result

            print(f"Operations: {result.get('total_operations', 'N/A')}")
            print(f"Avg Response: {result.get('avg_response_time', 0)*1000:.2f}ms")
            print(f"P95 Response: {result.get('p95_response_time', 0)*1000:.2f}ms")
            print(f"Ops/sec: {result.get('ops_per_second', 0):.1f}")

        await self.pool.close()
        return results

# Usage
async def main():
    connection_string = "postgresql://schlep_user:schlep_postgres_dev_2024@localhost:5432/schlep_engine"
    tester = DatabaseLoadTester(connection_string, concurrent_connections=50)
    results = await tester.run_comprehensive_test()

    # Save results
    import json
    with open("database_performance_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

if __name__ == "__main__":
    asyncio.run(main())
```

### 2. Redis Cache Performance Testing

**Redis Load Testing Script**
```python
#!/usr/bin/env python3
"""
Redis performance testing for Schlep Engine
Tests cache operations under concurrent load
"""

import asyncio
import redis.asyncio as redis
import time
import statistics
import json
import random
import string
from typing import List, Dict, Any

class CacheLoadTester:
    def __init__(self, redis_url: str, concurrent_connections: int = 100):
        self.redis_url = redis_url
        self.concurrent_connections = concurrent_connections
        self.pool = None

    async def setup_connection_pool(self):
        """Set up Redis connection pool"""
        self.pool = redis.ConnectionPool.from_url(
            self.redis_url,
            max_connections=self.concurrent_connections * 2,
            decode_responses=True
        )
        self.redis_client = redis.Redis(connection_pool=self.pool)

    def generate_test_data(self, size_kb: int = 1) -> str:
        """Generate test data of specified size"""
        return json.dumps({
            "id": "".join(random.choices(string.ascii_letters, k=32)),
            "data": "x" * (size_kb * 1024 - 100),  # Approximate size
            "timestamp": time.time(),
            "metadata": {"test": True, "size": size_kb}
        })

    async def test_basic_operations(self, duration_seconds: int = 300):
        """Test basic GET/SET operations"""
        print(f"Starting basic operations test for {duration_seconds} seconds...")

        start_time = time.time()
        tasks = []

        async def basic_worker():
            operation_times = []
            keys_created = []

            while time.time() - start_time < duration_seconds:
                # SET operation
                key = f"test:basic:{random.randint(1, 10000)}"
                value = self.generate_test_data(1)  # 1KB data

                set_start = time.time()
                await self.redis_client.set(key, value, ex=300)  # 5-minute TTL
                set_time = time.time() - set_start

                keys_created.append(key)

                # GET operation
                get_start = time.time()
                retrieved = await self.redis_client.get(key)
                get_time = time.time() - get_start

                operation_times.extend([set_time, get_time])

                # Occasionally delete keys to prevent memory bloat
                if len(keys_created) > 100:
                    old_key = keys_created.pop(0)
                    await self.redis_client.delete(old_key)

                await asyncio.sleep(0.001)  # Very small delay

            return operation_times

        # Start concurrent workers
        for _ in range(self.concurrent_connections):
            tasks.append(asyncio.create_task(basic_worker()))

        all_times = []
        for task in tasks:
            times = await task
            all_times.extend(times)

        return {
            "operation": "basic_operations",
            "total_operations": len(all_times),
            "avg_response_time": statistics.mean(all_times),
            "p95_response_time": statistics.quantiles(all_times, n=20)[18],
            "p99_response_time": statistics.quantiles(all_times, n=100)[98],
            "ops_per_second": len(all_times) / duration_seconds,
        }

    async def test_hash_operations(self, duration_seconds: int = 300):
        """Test Redis hash operations (user profiles, sessions)"""
        print(f"Starting hash operations test for {duration_seconds} seconds...")

        start_time = time.time()
        tasks = []

        async def hash_worker():
            operation_times = []

            while time.time() - start_time < duration_seconds:
                hash_key = f"test:hash:{random.randint(1, 1000)}"

                # HSET operation
                hset_start = time.time()
                await self.redis_client.hset(hash_key, mapping={
                    "user_id": f"user_{random.randint(1, 10000)}",
                    "session_data": self.generate_test_data(2),  # 2KB session data
                    "last_accessed": str(time.time()),
                    "preferences": json.dumps({"theme": "dark", "lang": "en"})
                })
                hset_time = time.time() - hset_start

                # HGETALL operation
                hgetall_start = time.time()
                data = await self.redis_client.hgetall(hash_key)
                hgetall_time = time.time() - hgetall_start

                # HGET operation
                hget_start = time.time()
                user_id = await self.redis_client.hget(hash_key, "user_id")
                hget_time = time.time() - hget_start

                operation_times.extend([hset_time, hgetall_time, hget_time])

                await asyncio.sleep(0.002)

            return operation_times

        # Start concurrent workers
        for _ in range(self.concurrent_connections // 2):
            tasks.append(asyncio.create_task(hash_worker()))

        all_times = []
        for task in tasks:
            times = await task
            all_times.extend(times)

        return {
            "operation": "hash_operations",
            "total_operations": len(all_times),
            "avg_response_time": statistics.mean(all_times),
            "p95_response_time": statistics.quantiles(all_times, n=20)[18],
            "p99_response_time": statistics.quantiles(all_times, n=100)[98],
            "ops_per_second": len(all_times) / duration_seconds,
        }

    async def test_stream_operations(self, duration_seconds: int = 300):
        """Test Redis Streams (task queues)"""
        print(f"Starting stream operations test for {duration_seconds} seconds...")

        # Set up streams and consumer groups
        streams = ["test:stream:high", "test:stream:normal", "test:stream:low"]
        for stream in streams:
            try:
                await self.redis_client.xgroup_create(stream, "test_processors", id="0", mkstream=True)
            except:
                pass  # Group might already exist

        start_time = time.time()
        producer_tasks = []
        consumer_tasks = []

        async def producer_worker():
            operation_times = []

            while time.time() - start_time < duration_seconds:
                stream = random.choice(streams)

                xadd_start = time.time()
                message_id = await self.redis_client.xadd(stream, {
                    "task_id": f"task_{random.randint(1, 100000)}",
                    "priority": stream.split(":")[-1],
                    "data": self.generate_test_data(1),
                    "created_at": str(time.time())
                })
                xadd_time = time.time() - xadd_start

                operation_times.append(xadd_time)
                await asyncio.sleep(0.01)

            return operation_times

        async def consumer_worker():
            operation_times = []

            while time.time() - start_time < duration_seconds:
                xread_start = time.time()
                messages = await self.redis_client.xreadgroup(
                    "test_processors",
                    "consumer_1",
                    {stream: ">" for stream in streams},
                    count=10,
                    block=100
                )
                xread_time = time.time() - xread_start

                if messages:
                    operation_times.append(xread_time)

                    # Acknowledge messages
                    for stream_name, stream_messages in messages:
                        if stream_messages:
                            message_ids = [msg[0] for msg in stream_messages]
                            await self.redis_client.xack(stream_name, "test_processors", *message_ids)

                await asyncio.sleep(0.01)

            return operation_times

        # Start producers and consumers
        for _ in range(self.concurrent_connections // 4):
            producer_tasks.append(asyncio.create_task(producer_worker()))

        for _ in range(self.concurrent_connections // 4):
            consumer_tasks.append(asyncio.create_task(consumer_worker()))

        all_producer_times = []
        all_consumer_times = []

        for task in producer_tasks:
            times = await task
            all_producer_times.extend(times)

        for task in consumer_tasks:
            times = await task
            all_consumer_times.extend(times)

        return {
            "operation": "stream_operations",
            "producer_operations": len(all_producer_times),
            "consumer_operations": len(all_consumer_times),
            "producer_avg_time": statistics.mean(all_producer_times) if all_producer_times else 0,
            "consumer_avg_time": statistics.mean(all_consumer_times) if all_consumer_times else 0,
            "producer_ops_per_sec": len(all_producer_times) / duration_seconds,
            "consumer_ops_per_sec": len(all_consumer_times) / duration_seconds,
        }

    async def test_cache_hit_ratio(self, duration_seconds: int = 300):
        """Test cache hit ratio with realistic access patterns"""
        print(f"Starting cache hit ratio test for {duration_seconds} seconds...")

        # Pre-populate cache with test data
        keys = []
        for i in range(1000):
            key = f"test:cache:{i}"
            await self.redis_client.set(key, self.generate_test_data(1), ex=600)
            keys.append(key)

        start_time = time.time()
        tasks = []

        async def cache_access_worker():
            hits = 0
            misses = 0

            while time.time() - start_time < duration_seconds:
                # 80% chance to access existing key, 20% chance to access non-existing
                if random.random() < 0.8:
                    key = random.choice(keys)
                else:
                    key = f"test:cache:missing:{random.randint(10000, 20000)}"

                value = await self.redis_client.get(key)
                if value is not None:
                    hits += 1
                else:
                    misses += 1

                await asyncio.sleep(0.001)

            return {"hits": hits, "misses": misses}

        # Start concurrent workers
        for _ in range(self.concurrent_connections):
            tasks.append(asyncio.create_task(cache_access_worker()))

        total_hits = 0
        total_misses = 0

        for task in tasks:
            result = await task
            total_hits += result["hits"]
            total_misses += result["misses"]

        hit_ratio = total_hits / (total_hits + total_misses) if (total_hits + total_misses) > 0 else 0

        return {
            "operation": "cache_hit_ratio",
            "total_requests": total_hits + total_misses,
            "hits": total_hits,
            "misses": total_misses,
            "hit_ratio": hit_ratio,
            "requests_per_second": (total_hits + total_misses) / duration_seconds,
        }

    async def run_comprehensive_test(self):
        """Run comprehensive Redis performance test"""
        await self.setup_connection_pool()

        tests = [
            ("Basic Operations", self.test_basic_operations, 300),
            ("Hash Operations", self.test_hash_operations, 300),
            ("Stream Operations", self.test_stream_operations, 300),
            ("Cache Hit Ratio", self.test_cache_hit_ratio, 300),
        ]

        results = {}
        for test_name, test_func, duration in tests:
            print(f"\n=== {test_name} Test ===")
            result = await test_func(duration)
            results[test_name.lower().replace(" ", "_")] = result

            if "avg_response_time" in result:
                print(f"Operations: {result.get('total_operations', 'N/A')}")
                print(f"Avg Response: {result.get('avg_response_time', 0)*1000:.3f}ms")
                print(f"P95 Response: {result.get('p95_response_time', 0)*1000:.3f}ms")
                print(f"Ops/sec: {result.get('ops_per_second', 0):.1f}")
            elif "hit_ratio" in result:
                print(f"Hit Ratio: {result['hit_ratio']:.1%}")
                print(f"Requests/sec: {result.get('requests_per_second', 0):.1f}")

        await self.pool.disconnect()
        return results

# Usage
async def main():
    redis_url = "redis://:schlep_redis_dev_2024@localhost:6379/0"
    tester = CacheLoadTester(redis_url, concurrent_connections=100)
    results = await tester.run_comprehensive_test()

    # Save results
    with open("cache_performance_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Performance Optimization Techniques

### PostgreSQL Optimization

**1. Configuration Tuning**
```sql
-- postgresql.conf optimizations for 1000+ concurrent users
shared_buffers = 1GB                    # 25% of available RAM
effective_cache_size = 3GB              # 75% of available RAM
work_mem = 4MB                          # Per-connection work memory
maintenance_work_mem = 256MB            # For VACUUM, CREATE INDEX
wal_buffers = 16MB                      # WAL buffer size
checkpoint_completion_target = 0.9      # Spread checkpoints
max_wal_size = 2GB                      # Maximum WAL size
min_wal_size = 256MB                    # Minimum WAL size
random_page_cost = 1.1                  # SSD-optimized
effective_io_concurrency = 200          # For SSD storage

# Connection and resource limits
max_connections = 200                   # Adjust based on connection pooling
max_locks_per_transaction = 64          # Default is usually fine
max_pred_locks_per_transaction = 64     # For serializable transactions

# Query planner settings
default_statistics_target = 100         # Better query planning
constraint_exclusion = partition        # For partitioned tables
```

**2. Index Optimization**
```sql
-- Create performance-critical indexes
CREATE INDEX CONCURRENTLY idx_task_executions_hot_path
ON task_executions(organization_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_active_by_org
ON users(organization_id, role, last_login_at)
WHERE deleted_at IS NULL AND email_verified_at IS NOT NULL;

-- Covering indexes to avoid table lookups
CREATE INDEX CONCURRENTLY idx_task_definitions_with_config
ON task_definitions(organization_id, is_active)
INCLUDE (name, version, runtime_config)
WHERE deleted_at IS NULL;

-- Monitor index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE idx_scan < 100  -- Potentially unused indexes
ORDER BY idx_scan;
```

**3. Query Optimization**
```sql
-- Use prepared statements for better performance
PREPARE get_user_tasks(uuid, text) AS
SELECT te.id, te.status, te.created_at, td.name
FROM task_executions te
JOIN task_definitions td ON te.task_definition_id = td.id
WHERE te.organization_id = $1 AND te.status = $2
ORDER BY te.created_at DESC
LIMIT 50;

-- Optimize pagination with cursor-based pagination
SELECT id, name, created_at
FROM organizations
WHERE created_at > $1  -- cursor
ORDER BY created_at
LIMIT 20;

-- Use CTEs for complex queries
WITH recent_executions AS (
    SELECT organization_id, status, COUNT(*) as count
    FROM task_executions
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY organization_id, status
)
SELECT o.name, re.status, re.count
FROM organizations o
JOIN recent_executions re ON o.id = re.organization_id;
```

### Redis Optimization

**1. Memory Optimization**
```conf
# redis.conf memory settings
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Hash optimizations
hash-max-ziplist-entries 512
hash-max-ziplist-value 64

# List optimizations
list-max-ziplist-size -2
list-compress-depth 0

# Set optimizations
set-max-intset-entries 512

# Sorted set optimizations
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

**2. Connection Pool Optimization**
```python
# Optimized Redis connection pool
REDIS_POOL_CONFIG = {
    "max_connections": 100,
    "retry_on_timeout": True,
    "retry_on_error": [redis.BusyLoadingError, redis.ConnectionError],
    "health_check_interval": 30,
    "socket_keepalive": True,
    "socket_keepalive_options": {
        1: 600,  # TCP_KEEPIDLE - 10 minutes
        2: 30,   # TCP_KEEPINTVL - 30 seconds
        3: 3,    # TCP_KEEPCNT - 3 probes
    },
    "socket_connect_timeout": 5,
    "socket_timeout": 5,
}
```

**3. Data Structure Optimization**
```python
# Efficient key naming for better memory usage
class OptimizedCacheManager:
    def __init__(self):
        # Use shorter key prefixes
        self.prefixes = {
            "user": "u:",
            "session": "s:",
            "task": "t:",
            "api_cache": "a:",
        }

    def get_user_key(self, user_id: str) -> str:
        return f"{self.prefixes['user']}{user_id}"

    async def cache_with_compression(self, key: str, data: dict, ttl: int = 3600):
        """Cache data with JSON compression"""
        import gzip
        import json

        json_data = json.dumps(data, separators=(',', ':'))  # Compact JSON
        compressed = gzip.compress(json_data.encode())

        await self.redis.set(key, compressed, ex=ttl)

    async def pipeline_operations(self, operations: list):
        """Use Redis pipeline for batch operations"""
        pipe = self.redis.pipeline()

        for op_type, args in operations:
            if op_type == "set":
                pipe.set(*args)
            elif op_type == "get":
                pipe.get(*args)
            elif op_type == "hset":
                pipe.hset(*args)

        return await pipe.execute()
```

---

## Monitoring and Alerting for Performance

### Key Performance Metrics

**Database Metrics to Monitor:**
```yaml
# Prometheus alert rules
groups:
  - name: performance_alerts
    rules:
      # Database response time alert
      - alert: DatabaseSlowQueries
        expr: pg_stat_statements_mean_time_ms > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database queries are running slowly"

      # High connection usage
      - alert: DatabaseHighConnections
        expr: (pg_stat_activity_count / pg_settings_max_connections) > 0.8
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection usage is high"

      # Cache hit ratio too low
      - alert: CacheHitRatioLow
        expr: (redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)) < 0.95
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit ratio is below optimal"
```

**Application Metrics:**
```python
# Custom metrics collection
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
ACTIVE_CONNECTIONS = Gauge('active_database_connections', 'Active database connections')

# Database operation metrics
DB_QUERY_DURATION = Histogram('database_query_duration_seconds', 'Database query duration', ['query_type'])
CACHE_OPERATIONS = Counter('cache_operations_total', 'Cache operations', ['operation', 'result'])

# Custom task execution metrics
TASK_EXECUTION_DURATION = Histogram('task_execution_duration_seconds', 'Task execution duration')
TASK_QUEUE_SIZE = Gauge('task_queue_size', 'Current task queue size', ['priority'])
```

---

## Scaling Strategies

### Vertical Scaling (Within Budget Constraints)

**Resource Allocation Strategy:**
```yaml
# Docker resource limits for optimal performance
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 3G      # 75% of 4GB server
          cpus: '2.0'     # 2 cores dedicated
        reservations:
          memory: 2G
          cpus: '1.5'

  redis:
    deploy:
      resources:
        limits:
          memory: 1G      # 25% of 4GB server
          cpus: '1.0'     # 1 core dedicated
        reservations:
          memory: 512M
          cpus: '0.5'
```

### Connection Pool Optimization

**Application-Level Connection Pooling:**
```python
class OptimizedDatabaseManager:
    def __init__(self):
        # PostgreSQL connection pool
        self.pg_pool_config = {
            "min_size": 20,
            "max_size": 50,
            "max_queries": 50000,
            "max_inactive_connection_lifetime": 300,
            "command_timeout": 60,
        }

        # Redis connection pool
        self.redis_pool_config = {
            "max_connections": 100,
            "retry_on_timeout": True,
            "health_check_interval": 30,
        }

    async def get_optimized_connection(self, read_only: bool = False):
        """Get connection optimized for query type"""
        if read_only:
            # Use read replica if available
            return await self.read_pool.acquire()
        else:
            return await self.write_pool.acquire()
```

### Horizontal Scaling Preparation

**Read Replica Setup:**
```sql
-- Prepare for read replica (when scaling beyond single instance)
-- Configure streaming replication
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_segments = 64;
ALTER SYSTEM SET hot_standby = on;

-- Create replication user
CREATE USER replicator REPLICATION ENCRYPTED PASSWORD 'secure_replication_password';
```

**Application-Level Read/Write Splitting:**
```python
class DatabaseRouter:
    def __init__(self, write_pool, read_pool):
        self.write_pool = write_pool
        self.read_pool = read_pool

    async def execute_query(self, query: str, *args, read_only: bool = False):
        """Route query to appropriate database instance"""
        pool = self.read_pool if read_only else self.write_pool

        async with pool.acquire() as conn:
            if read_only:
                return await conn.fetch(query, *args)
            else:
                return await conn.execute(query, *args)
```

---

## Cost-Performance Optimization

### Resource Right-Sizing

**Monthly Cost Breakdown Analysis:**
```python
# Cost monitoring script
class CostPerformanceAnalyzer:
    def analyze_resource_utilization(self):
        metrics = {
            "cpu_utilization": self.get_avg_cpu_usage(),
            "memory_utilization": self.get_avg_memory_usage(),
            "storage_utilization": self.get_storage_usage(),
            "network_utilization": self.get_network_usage(),
        }

        # Calculate cost efficiency
        cost_per_transaction = self.monthly_cost / self.monthly_transactions

        recommendations = []

        if metrics["cpu_utilization"] < 30:
            recommendations.append("Consider reducing CPU allocation")
        if metrics["memory_utilization"] < 50:
            recommendations.append("Consider reducing memory allocation")
        if metrics["storage_utilization"] > 80:
            recommendations.append("Consider storage cleanup or expansion")

        return {
            "current_metrics": metrics,
            "cost_per_transaction": cost_per_transaction,
            "recommendations": recommendations
        }
```

### Performance per Dollar Optimization

**Optimization Priorities:**
1. **Database Connection Pooling**: Highest impact, lowest cost
2. **Query Optimization**: High impact, low cost
3. **Index Optimization**: High impact, minimal cost
4. **Caching Strategy**: High impact, low cost
5. **Resource Right-sizing**: Medium impact, potential cost savings

---

## Benchmarking Results Template

### Expected Performance Baselines

**Target Benchmarks for Phase One:**

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Database Response Time** | <50ms avg, <100ms p95 | pgbench, custom load tests |
| **Cache Response Time** | <1ms avg, <5ms p95 | redis-benchmark |
| **Concurrent Users** | 1,000+ | Load testing with realistic workload |
| **Throughput** | 1,000+ RPS | HTTP load testing |
| **Cache Hit Ratio** | >95% | Redis INFO stats |
| **Database CPU** | <70% avg | System monitoring |
| **Memory Usage** | <80% of allocated | System monitoring |
| **Storage I/O** | <100 IOPS average | System monitoring |

**Sample Benchmark Report:**
```json
{
  "test_date": "2024-01-15",
  "duration_minutes": 60,
  "results": {
    "database_performance": {
      "avg_response_time_ms": 45.2,
      "p95_response_time_ms": 89.7,
      "p99_response_time_ms": 156.3,
      "transactions_per_second": 1247,
      "connection_pool_utilization": 0.68
    },
    "cache_performance": {
      "avg_response_time_ms": 0.8,
      "p95_response_time_ms": 2.1,
      "p99_response_time_ms": 4.7,
      "operations_per_second": 15420,
      "hit_ratio": 0.967
    },
    "system_resources": {
      "cpu_utilization": 0.62,
      "memory_utilization": 0.74,
      "storage_io_utilization": 0.45,
      "network_utilization": 0.23
    },
    "cost_analysis": {
      "monthly_projected_cost": 285,
      "cost_per_user": 0.285,
      "cost_per_transaction": 0.0023
    }
  }
}
```

This comprehensive performance testing and optimization guide ensures that Schlep Engine's Phase One infrastructure can efficiently handle 1,000+ concurrent users while maintaining costs under $300/month and providing a clear path for scaling to Phase Two.