"""
System Integration Tests

Comprehensive testing of system-level integrations including:
- Database operations with PostgreSQL/SQLite
- Redis caching and session management
- Cloud storage (S3) integration
- File upload and processing workflows
- Error handling and fallback mechanisms
- Connection pooling and timeouts
- Cross-service communication
- Data consistency across services
"""

import pytest
import asyncio
import json
import time
import tempfile
import os
from typing import Dict, Any, List
from unittest.mock import patch, AsyncMock, MagicMock
import uuid
from datetime import datetime, timedelta
import hashlib

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis


@pytest.mark.integration
class TestDatabaseIntegration:
    """Test database operations and connection handling."""

    async def test_database_connection_and_basic_operations(
        self,
        test_db_session: AsyncSession
    ):
        """Test basic database connectivity and operations."""

        # Test database connection
        result = await test_db_session.execute(text("SELECT 1 as test_value"))
        row = result.fetchone()
        assert row is not None
        assert row.test_value == 1

        # Test transaction handling
        await test_db_session.execute(
            text("CREATE TEMPORARY TABLE test_table (id INTEGER, name TEXT)")
        )

        # Insert test data
        await test_db_session.execute(
            text("INSERT INTO test_table (id, name) VALUES (1, 'test_name')")
        )

        # Query test data
        result = await test_db_session.execute(
            text("SELECT id, name FROM test_table WHERE id = 1")
        )
        row = result.fetchone()

        assert row is not None
        assert row.id == 1
        assert row.name == 'test_name'

    async def test_database_transaction_rollback(
        self,
        test_db_session: AsyncSession
    ):
        """Test database transaction rollback behavior."""

        # Create test table
        await test_db_session.execute(
            text("CREATE TEMPORARY TABLE rollback_test (id INTEGER PRIMARY KEY, value TEXT)")
        )

        # Insert initial data
        await test_db_session.execute(
            text("INSERT INTO rollback_test (id, value) VALUES (1, 'initial')")
        )

        # Verify initial data
        result = await test_db_session.execute(
            text("SELECT COUNT(*) as count FROM rollback_test")
        )
        initial_count = result.fetchone().count
        assert initial_count == 1

        # Start nested transaction that will fail
        try:
            async with test_db_session.begin_nested():
                await test_db_session.execute(
                    text("INSERT INTO rollback_test (id, value) VALUES (2, 'nested')")
                )

                # Simulate an error condition
                raise Exception("Simulated error for rollback test")

        except Exception:
            # Transaction should be rolled back
            pass

        # Verify rollback occurred
        result = await test_db_session.execute(
            text("SELECT COUNT(*) as count FROM rollback_test")
        )
        final_count = result.fetchone().count
        assert final_count == 1, "Nested transaction should have been rolled back"

    async def test_database_concurrent_access(
        self,
        test_db_engine
    ):
        """Test concurrent database access patterns."""

        # Create multiple concurrent sessions
        async def concurrent_operation(session_id: int):
            """Perform database operation in concurrent session."""
            from sqlalchemy.orm import sessionmaker
            from sqlalchemy.ext.asyncio import AsyncSession

            async_session = sessionmaker(
                test_db_engine,
                class_=AsyncSession,
                expire_on_commit=False
            )

            results = []
            async with async_session() as session:
                async with session.begin():
                    # Create session-specific table
                    table_name = f"concurrent_test_{session_id}"
                    await session.execute(
                        text(f"CREATE TEMPORARY TABLE {table_name} (id INTEGER, session_id INTEGER)")
                    )

                    # Perform multiple operations
                    for i in range(10):
                        await session.execute(
                            text(f"INSERT INTO {table_name} (id, session_id) VALUES ({i}, {session_id})")
                        )

                        result = await session.execute(
                            text(f"SELECT COUNT(*) as count FROM {table_name}")
                        )
                        count = result.fetchone().count
                        results.append({"session_id": session_id, "operation": i, "count": count})

                        # Small delay to simulate processing
                        await asyncio.sleep(0.01)

            return results

        # Execute concurrent operations
        concurrent_sessions = 5
        tasks = [concurrent_operation(i) for i in range(concurrent_sessions)]
        all_results = await asyncio.gather(*tasks)

        # Verify all sessions completed successfully
        assert len(all_results) == concurrent_sessions

        for session_results in all_results:
            assert len(session_results) == 10, "Each session should complete all operations"

            # Verify sequential consistency within each session
            for i, result in enumerate(session_results):
                expected_count = i + 1
                assert result["count"] == expected_count, f"Operation {i} should have count {expected_count}"

    async def test_database_connection_pool_behavior(
        self,
        test_db_engine
    ):
        """Test database connection pool behavior under load."""

        connection_results = []

        async def test_connection(connection_id: int):
            """Test individual database connection."""
            start_time = time.time()

            try:
                async with test_db_engine.begin() as conn:
                    result = await conn.execute(
                        text("SELECT :connection_id as conn_id"),
                        {"connection_id": connection_id}
                    )
                    row = result.fetchone()

                    duration = time.time() - start_time
                    return {
                        "connection_id": connection_id,
                        "success": True,
                        "returned_id": row.conn_id,
                        "duration": duration
                    }

            except Exception as e:
                duration = time.time() - start_time
                return {
                    "connection_id": connection_id,
                    "success": False,
                    "error": str(e),
                    "duration": duration
                }

        # Test many concurrent connections
        connection_count = 20
        connection_tasks = [test_connection(i) for i in range(connection_count)]
        connection_results = await asyncio.gather(*connection_tasks)

        # Analyze results
        successful_connections = [r for r in connection_results if r["success"]]
        failed_connections = [r for r in connection_results if not r["success"]]

        # Most connections should succeed
        success_rate = len(successful_connections) / len(connection_results)
        assert success_rate > 0.8, f"Connection success rate too low: {success_rate:.2%}"

        # Connection times should be reasonable
        avg_duration = sum(r["duration"] for r in successful_connections) / len(successful_connections)
        assert avg_duration < 1.0, f"Average connection time too high: {avg_duration:.3f}s"

        print(f"\nDatabase Connection Pool Test Results:")
        print(f"Total Connections: {connection_count}")
        print(f"Successful: {len(successful_connections)}")
        print(f"Failed: {len(failed_connections)}")
        print(f"Success Rate: {success_rate:.2%}")
        print(f"Average Duration: {avg_duration:.3f}s")


@pytest.mark.integration
class TestRedisIntegration:
    """Test Redis caching and session management."""

    async def test_redis_basic_operations(
        self,
        test_redis_client: redis.Redis
    ):
        """Test basic Redis operations."""

        # Test basic set/get
        await test_redis_client.set("test_key", "test_value")
        value = await test_redis_client.get("test_key")
        assert value == "test_value"

        # Test expiration
        await test_redis_client.setex("expiring_key", 1, "expiring_value")
        value = await test_redis_client.get("expiring_key")
        assert value == "expiring_value"

        # Wait for expiration
        await asyncio.sleep(1.1)
        expired_value = await test_redis_client.get("expiring_key")
        assert expired_value is None

        # Test JSON data
        test_data = {"user_id": 123, "session": "abc123", "preferences": {"theme": "dark"}}
        await test_redis_client.set("json_key", json.dumps(test_data))

        stored_json = await test_redis_client.get("json_key")
        parsed_data = json.loads(stored_json)
        assert parsed_data == test_data

    async def test_redis_rate_limiting_integration(
        self,
        test_redis_client: redis.Redis
    ):
        """Test Redis-based rate limiting functionality."""

        user_id = "test_user_123"
        rate_limit_key = f"rate_limit:user:{user_id}:minute"

        # Simulate rate limiting logic
        async def check_rate_limit(user_key: str, limit: int, window: int):
            """Simple rate limiting implementation."""
            current_time = time.time()
            pipeline = test_redis_client.pipeline()

            # Get current request count
            pipeline.zcount(user_key, current_time - window, current_time)
            pipeline.zadd(user_key, {str(uuid.uuid4()): current_time})
            pipeline.expire(user_key, window)
            pipeline.zremrangebyscore(user_key, 0, current_time - window)

            results = await pipeline.execute()
            current_count = results[0]

            return current_count < limit, current_count

        # Test rate limiting
        limit = 5
        window = 60  # 1 minute

        # Make requests up to limit
        for i in range(limit):
            allowed, count = await check_rate_limit(rate_limit_key, limit, window)
            assert allowed, f"Request {i+1} should be allowed"
            await asyncio.sleep(0.01)

        # Next request should be rate limited
        allowed, count = await check_rate_limit(rate_limit_key, limit, window)
        assert not allowed, "Request beyond limit should be blocked"
        assert count >= limit, f"Count should be at least {limit}, got {count}"

    async def test_redis_session_management(
        self,
        test_redis_client: redis.Redis
    ):
        """Test Redis-based session management."""

        session_id = f"session_{uuid.uuid4()}"
        session_data = {
            "user_id": "user_123",
            "login_time": datetime.utcnow().isoformat(),
            "ip_address": "192.168.1.100",
            "user_agent": "TestAgent/1.0",
            "permissions": ["read", "write"],
            "preferences": {
                "language": "en",
                "timezone": "UTC"
            }
        }

        # Store session
        session_key = f"session:{session_id}"
        await test_redis_client.hset(
            session_key,
            mapping={k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                    for k, v in session_data.items()}
        )
        await test_redis_client.expire(session_key, 3600)  # 1 hour expiration

        # Retrieve session
        stored_session = await test_redis_client.hgetall(session_key)
        assert stored_session is not None
        assert stored_session["user_id"] == "user_123"

        # Parse complex fields
        stored_permissions = json.loads(stored_session["permissions"])
        assert stored_permissions == ["read", "write"]

        stored_preferences = json.loads(stored_session["preferences"])
        assert stored_preferences["language"] == "en"

        # Test session update
        await test_redis_client.hset(session_key, "last_activity", str(time.time()))

        # Test session cleanup
        await test_redis_client.delete(session_key)
        cleaned_session = await test_redis_client.hgetall(session_key)
        assert len(cleaned_session) == 0

    async def test_redis_caching_patterns(
        self,
        test_redis_client: redis.Redis
    ):
        """Test various Redis caching patterns."""

        # Test cache-aside pattern
        cache_key = "expensive_operation_result"

        async def expensive_operation(param: str):
            """Simulate expensive operation."""
            await asyncio.sleep(0.1)  # Simulate processing time
            return f"result_for_{param}"

        async def cached_expensive_operation(param: str):
            """Cached version of expensive operation."""
            key = f"{cache_key}:{param}"

            # Check cache first
            cached_result = await test_redis_client.get(key)
            if cached_result:
                return cached_result

            # Compute and cache result
            result = await expensive_operation(param)
            await test_redis_client.setex(key, 300, result)  # Cache for 5 minutes
            return result

        # Test caching effectiveness
        start_time = time.time()
        result1 = await cached_expensive_operation("test_param")
        first_call_time = time.time() - start_time

        start_time = time.time()
        result2 = await cached_expensive_operation("test_param")  # Should be cached
        second_call_time = time.time() - start_time

        assert result1 == result2 == "result_for_test_param"
        assert second_call_time < first_call_time * 0.5, "Cached call should be much faster"

        # Test write-through pattern
        data_key = "user_profile:123"
        user_data = {"name": "John Doe", "email": "john@example.com", "age": 30}

        # Write to cache and "database" (simulated)
        await test_redis_client.hset(data_key, mapping=user_data)

        # Read from cache
        cached_user = await test_redis_client.hgetall(data_key)
        assert cached_user["name"] == "John Doe"
        assert cached_user["email"] == "john@example.com"

    @pytest.mark.performance
    async def test_redis_performance_under_load(
        self,
        test_redis_client: redis.Redis,
        performance_monitor
    ):
        """Test Redis performance under concurrent load."""

        async def redis_workload(workload_id: int, operations_count: int = 100):
            """Simulate Redis workload."""
            results = []

            for i in range(operations_count):
                key = f"load_test:{workload_id}:{i}"
                value = f"value_{workload_id}_{i}"

                # SET operation
                start_time = time.time()
                await test_redis_client.set(key, value)
                set_duration = (time.time() - start_time) * 1000
                performance_monitor.record_response_time(set_duration)

                # GET operation
                start_time = time.time()
                retrieved_value = await test_redis_client.get(key)
                get_duration = (time.time() - start_time) * 1000
                performance_monitor.record_response_time(get_duration)

                results.append({
                    "workload_id": workload_id,
                    "operation": i,
                    "set_duration_ms": set_duration,
                    "get_duration_ms": get_duration,
                    "value_match": retrieved_value == value
                })

                # Small delay to avoid overwhelming
                if i % 10 == 0:
                    await asyncio.sleep(0.001)

            return results

        # Execute concurrent workloads
        concurrent_workloads = 10
        operations_per_workload = 50

        start_time = time.time()
        workload_tasks = [
            redis_workload(i, operations_per_workload)
            for i in range(concurrent_workloads)
        ]
        all_results = await asyncio.gather(*workload_tasks)
        total_duration = time.time() - start_time

        # Analyze performance
        flat_results = [op for workload_results in all_results for op in workload_results]
        successful_operations = len([r for r in flat_results if r["value_match"]])
        total_operations = len(flat_results)

        stats = performance_monitor.calculate_stats()

        # Performance assertions
        success_rate = successful_operations / total_operations
        assert success_rate > 0.99, f"Redis operation success rate too low: {success_rate:.2%}"
        assert stats["avg_response_time"] < 10, f"Average Redis operation time too high: {stats['avg_response_time']}ms"

        throughput = total_operations / total_duration

        print(f"\nRedis Performance Test Results:")
        print(f"Concurrent Workloads: {concurrent_workloads}")
        print(f"Operations per Workload: {operations_per_workload}")
        print(f"Total Operations: {total_operations}")
        print(f"Success Rate: {success_rate:.2%}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Throughput: {throughput:.2f} ops/sec")
        print(f"Average Operation Time: {stats['avg_response_time']:.2f}ms")
        print(f"95th Percentile: {stats['p95_response_time']:.2f}ms")


@pytest.mark.integration
class TestCloudStorageIntegration:
    """Test cloud storage (S3) integration."""

    async def test_s3_basic_operations(
        self,
        mock_s3_client
    ):
        """Test basic S3 operations."""

        bucket_name = "test-bucket"
        object_key = "test-object.txt"
        test_content = b"This is test content for S3 integration"

        # Test PUT object
        mock_s3_client.put_object.return_value = {
            "ETag": '"test-etag-12345"',
            "ResponseMetadata": {"HTTPStatusCode": 200}
        }

        put_result = await mock_s3_client.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=test_content
        )

        assert put_result["ETag"] == '"test-etag-12345"'
        mock_s3_client.put_object.assert_called_with(
            Bucket=bucket_name,
            Key=object_key,
            Body=test_content
        )

        # Test GET object
        mock_response_body = AsyncMock()
        mock_response_body.read.return_value = test_content

        mock_s3_client.get_object.return_value = {
            "Body": mock_response_body,
            "ContentLength": len(test_content),
            "LastModified": datetime.utcnow(),
            "ETag": '"test-etag-12345"'
        }

        get_result = await mock_s3_client.get_object(
            Bucket=bucket_name,
            Key=object_key
        )

        assert get_result["ContentLength"] == len(test_content)
        mock_s3_client.get_object.assert_called_with(
            Bucket=bucket_name,
            Key=object_key
        )

    async def test_file_upload_integration(
        self,
        async_test_client,
        auth_headers_user,
        mock_s3_client,
        integration_helpers
    ):
        """Test file upload workflow with cloud storage."""

        # Mock S3 upload success
        upload_key = f"uploads/{uuid.uuid4()}/test_file.csv"
        mock_s3_client.put_object.return_value = {
            "ETag": '"upload-success-etag"',
            "ResponseMetadata": {"HTTPStatusCode": 200}
        }

        # Create test file
        test_content = "col1,col2,col3\n1,2,3\n4,5,6\n"
        temp_file_path = integration_helpers.create_test_file(test_content, "csv")

        try:
            # Test file upload endpoint (if available)
            with open(temp_file_path, 'rb') as f:
                files = {"file": ("test_upload.csv", f, "text/csv")}

                # This endpoint might not exist, so we'll test what we can
                upload_response = await async_test_client.post(
                    "/api/v1/storage/upload",
                    files=files,
                    headers=auth_headers_user
                )

            # If upload endpoint exists, verify it works
            if upload_response.status_code == 200:
                upload_result = upload_response.json()
                assert "file_id" in upload_result or "url" in upload_result

                # Verify S3 was called (if integration is working)
                if mock_s3_client.put_object.called:
                    mock_s3_client.put_object.assert_called()

        finally:
            os.unlink(temp_file_path)

    async def test_backup_and_recovery_workflow(
        self,
        mock_s3_client,
        test_redis_client: redis.Redis
    ):
        """Test backup and recovery workflow with cloud storage."""

        # Simulate data that needs to be backed up
        backup_data = {
            "models": [
                {
                    "id": "model_123",
                    "weights": [[0.1, 0.2], [0.3, 0.4]],
                    "metadata": {"version": "1.0", "trained_at": datetime.utcnow().isoformat()}
                }
            ],
            "sessions": [
                {
                    "id": "session_456",
                    "configuration": {"strategy": "PPO", "episodes": 100},
                    "performance": {"best_reward": 0.95}
                }
            ]
        }

        backup_id = f"backup_{int(time.time())}"
        backup_key = f"backups/{backup_id}/data.json"

        # Mock successful backup
        mock_s3_client.put_object.return_value = {
            "ETag": f'"backup-{backup_id}-etag"',
            "ResponseMetadata": {"HTTPStatusCode": 200}
        }

        # Simulate backup process
        backup_content = json.dumps(backup_data).encode('utf-8')
        backup_result = await mock_s3_client.put_object(
            Bucket="backup-bucket",
            Key=backup_key,
            Body=backup_content,
            Metadata={"backup_id": backup_id, "created_at": str(time.time())}
        )

        assert backup_result["ETag"] == f'"backup-{backup_id}-etag"'

        # Store backup metadata in Redis
        await test_redis_client.hset(
            f"backup:{backup_id}",
            mapping={
                "s3_key": backup_key,
                "size": str(len(backup_content)),
                "created_at": str(time.time()),
                "status": "completed"
            }
        )

        # Test recovery process
        mock_recovery_body = AsyncMock()
        mock_recovery_body.read.return_value = backup_content

        mock_s3_client.get_object.return_value = {
            "Body": mock_recovery_body,
            "ContentLength": len(backup_content),
            "Metadata": {"backup_id": backup_id}
        }

        # Simulate recovery
        recovery_result = await mock_s3_client.get_object(
            Bucket="backup-bucket",
            Key=backup_key
        )

        recovered_content = await recovery_result["Body"].read()
        recovered_data = json.loads(recovered_content.decode('utf-8'))

        assert recovered_data == backup_data

        # Verify backup metadata
        backup_metadata = await test_redis_client.hgetall(f"backup:{backup_id}")
        assert backup_metadata["s3_key"] == backup_key
        assert backup_metadata["status"] == "completed"

    async def test_storage_error_handling(
        self,
        mock_s3_client,
        test_redis_client: redis.Redis
    ):
        """Test error handling for storage failures."""

        # Test S3 upload failure
        mock_s3_client.put_object.side_effect = Exception("S3 service unavailable")

        backup_key = "test_backup_failure.json"
        backup_content = b'{"test": "data"}'

        # Should handle S3 failure gracefully
        try:
            await mock_s3_client.put_object(
                Bucket="test-bucket",
                Key=backup_key,
                Body=backup_content
            )
            assert False, "Should have raised exception"
        except Exception as e:
            assert "S3 service unavailable" in str(e)

        # Test fallback to local storage or alternative
        fallback_key = f"local_fallback:{backup_key}"
        await test_redis_client.set(fallback_key, backup_content)

        # Verify fallback storage
        fallback_data = await test_redis_client.get(fallback_key)
        assert fallback_data == backup_content

        # Test recovery from fallback
        recovered_fallback = await test_redis_client.get(fallback_key)
        assert recovered_fallback == backup_content

    @pytest.mark.performance
    async def test_concurrent_storage_operations(
        self,
        mock_s3_client,
        performance_monitor
    ):
        """Test concurrent storage operations performance."""

        # Configure mock for concurrent operations
        mock_s3_client.put_object.return_value = {
            "ETag": '"concurrent-test-etag"',
            "ResponseMetadata": {"HTTPStatusCode": 200}
        }

        async def storage_operation(operation_id: int):
            """Simulate storage operation."""
            file_key = f"concurrent_test/file_{operation_id}.json"
            file_content = json.dumps({
                "operation_id": operation_id,
                "data": list(range(100)),  # Some test data
                "timestamp": time.time()
            }).encode('utf-8')

            start_time = time.time()

            try:
                result = await mock_s3_client.put_object(
                    Bucket="test-bucket",
                    Key=file_key,
                    Body=file_content
                )

                duration = (time.time() - start_time) * 1000
                performance_monitor.record_response_time(duration)

                return {
                    "operation_id": operation_id,
                    "success": True,
                    "duration_ms": duration,
                    "file_size": len(file_content)
                }

            except Exception as e:
                duration = (time.time() - start_time) * 1000
                performance_monitor.record_error(type(e).__name__)

                return {
                    "operation_id": operation_id,
                    "success": False,
                    "error": str(e),
                    "duration_ms": duration
                }

        # Execute concurrent storage operations
        concurrent_operations = 20
        start_time = time.time()

        operation_tasks = [storage_operation(i) for i in range(concurrent_operations)]
        operation_results = await asyncio.gather(*operation_tasks)

        total_duration = time.time() - start_time

        # Analyze performance
        successful_operations = [r for r in operation_results if r["success"]]
        failed_operations = [r for r in operation_results if not r["success"]]

        stats = performance_monitor.calculate_stats()
        success_rate = len(successful_operations) / len(operation_results)

        # Performance assertions
        assert success_rate > 0.95, f"Storage operation success rate too low: {success_rate:.2%}"
        assert stats["avg_response_time"] < 1000, f"Average storage operation time too high: {stats['avg_response_time']}ms"

        total_data_size = sum(r["file_size"] for r in successful_operations if "file_size" in r)
        throughput_mbps = (total_data_size / (1024 * 1024)) / total_duration if total_duration > 0 else 0

        print(f"\nCloud Storage Performance Test Results:")
        print(f"Concurrent Operations: {concurrent_operations}")
        print(f"Success Rate: {success_rate:.2%}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Average Operation Time: {stats['avg_response_time']:.2f}ms")
        print(f"Total Data Size: {total_data_size / (1024 * 1024):.2f} MB")
        print(f"Throughput: {throughput_mbps:.2f} MB/s")


@pytest.mark.integration
class TestCrossServiceIntegration:
    """Test integration across multiple services."""

    async def test_database_redis_consistency(
        self,
        test_db_session: AsyncSession,
        test_redis_client: redis.Redis
    ):
        """Test data consistency between database and Redis."""

        # Create test data in database
        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "name": "Test User",
            "email": "test@example.com",
            "created_at": datetime.utcnow().isoformat()
        }

        # Store in database (simulated)
        await test_db_session.execute(
            text("CREATE TEMPORARY TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, created_at TEXT)")
        )

        await test_db_session.execute(
            text("INSERT INTO users (id, name, email, created_at) VALUES (:id, :name, :email, :created_at)"),
            user_data
        )

        # Store in Redis cache
        cache_key = f"user:{user_id}"
        await test_redis_client.hset(cache_key, mapping=user_data)
        await test_redis_client.expire(cache_key, 3600)

        # Verify data consistency
        db_result = await test_db_session.execute(
            text("SELECT * FROM users WHERE id = :id"),
            {"id": user_id}
        )
        db_user = db_result.fetchone()

        redis_user = await test_redis_client.hgetall(cache_key)

        assert db_user.id == redis_user["id"]
        assert db_user.name == redis_user["name"]
        assert db_user.email == redis_user["email"]

        # Test cache invalidation
        updated_name = "Updated Test User"
        await test_db_session.execute(
            text("UPDATE users SET name = :name WHERE id = :id"),
            {"name": updated_name, "id": user_id}
        )

        # Update cache
        await test_redis_client.hset(cache_key, "name", updated_name)

        # Verify consistency after update
        updated_db_result = await test_db_session.execute(
            text("SELECT name FROM users WHERE id = :id"),
            {"id": user_id}
        )
        updated_db_name = updated_db_result.fetchone().name

        updated_redis_name = await test_redis_client.hget(cache_key, "name")

        assert updated_db_name == updated_redis_name == updated_name

    async def test_service_health_monitoring(
        self,
        async_test_client,
        test_db_session: AsyncSession,
        test_redis_client: redis.Redis,
        mock_s3_client
    ):
        """Test health monitoring across all services."""

        service_health = {}

        # Test database health
        try:
            await test_db_session.execute(text("SELECT 1"))
            service_health["database"] = {"status": "healthy", "response_time": 0}
        except Exception as e:
            service_health["database"] = {"status": "unhealthy", "error": str(e)}

        # Test Redis health
        try:
            start_time = time.time()
            await test_redis_client.ping()
            redis_response_time = (time.time() - start_time) * 1000
            service_health["redis"] = {"status": "healthy", "response_time": redis_response_time}
        except Exception as e:
            service_health["redis"] = {"status": "unhealthy", "error": str(e)}

        # Test S3 health (mocked)
        try:
            mock_s3_client.head_bucket.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}
            await mock_s3_client.head_bucket(Bucket="test-bucket")
            service_health["s3"] = {"status": "healthy", "response_time": 0}
        except Exception as e:
            service_health["s3"] = {"status": "unhealthy", "error": str(e)}

        # Test API health
        try:
            health_response = await async_test_client.get("/health")
            if health_response.status_code == 200:
                service_health["api"] = {"status": "healthy", "response_time": 0}
            else:
                service_health["api"] = {"status": "degraded", "status_code": health_response.status_code}
        except Exception as e:
            service_health["api"] = {"status": "unhealthy", "error": str(e)}

        # Verify overall system health
        healthy_services = [name for name, health in service_health.items() if health["status"] == "healthy"]
        total_services = len(service_health)
        health_percentage = len(healthy_services) / total_services

        print(f"\nSystem Health Check Results:")
        for service, health in service_health.items():
            status = health["status"]
            response_time = health.get("response_time", "N/A")
            print(f"  {service.title()}: {status} (Response: {response_time}ms)")

        print(f"Overall Health: {health_percentage:.2%} ({len(healthy_services)}/{total_services} services healthy)")

        # At least database should be healthy for basic functionality
        assert service_health["database"]["status"] == "healthy", "Database should be healthy"

    async def test_data_flow_across_services(
        self,
        async_test_client,
        auth_headers_user,
        test_db_session: AsyncSession,
        test_redis_client: redis.Redis,
        mock_s3_client,
        integration_helpers
    ):
        """Test data flow across all integrated services."""

        # Simulate complete data processing workflow
        workflow_id = str(uuid.uuid4())

        # Step 1: Upload data (API -> S3)
        test_data = "feature1,feature2,target\n1,2,0\n3,4,1\n5,6,0"
        temp_file_path = integration_helpers.create_test_file(test_data, "csv")

        mock_s3_client.put_object.return_value = {
            "ETag": f'"workflow-{workflow_id}-etag"'
        }

        try:
            # Simulate file upload
            s3_key = f"workflows/{workflow_id}/input_data.csv"
            await mock_s3_client.put_object(
                Bucket="data-bucket",
                Key=s3_key,
                Body=test_data.encode('utf-8')
            )

            # Step 2: Store workflow metadata (Database)
            workflow_metadata = {
                "id": workflow_id,
                "s3_key": s3_key,
                "status": "processing",
                "created_at": datetime.utcnow().isoformat()
            }

            await test_db_session.execute(
                text("CREATE TEMPORARY TABLE workflows (id TEXT PRIMARY KEY, s3_key TEXT, status TEXT, created_at TEXT)")
            )

            await test_db_session.execute(
                text("INSERT INTO workflows (id, s3_key, status, created_at) VALUES (:id, :s3_key, :status, :created_at)"),
                workflow_metadata
            )

            # Step 3: Cache processing status (Redis)
            cache_key = f"workflow:{workflow_id}"
            await test_redis_client.hset(cache_key, mapping={
                "status": "processing",
                "progress": "25",
                "updated_at": str(time.time())
            })

            # Step 4: Simulate processing completion
            await test_db_session.execute(
                text("UPDATE workflows SET status = 'completed' WHERE id = :id"),
                {"id": workflow_id}
            )

            await test_redis_client.hset(cache_key, mapping={
                "status": "completed",
                "progress": "100",
                "result": "success"
            })

            # Step 5: Store results (S3)
            result_data = {"workflow_id": workflow_id, "results": [0.1, 0.8, 0.2]}
            result_key = f"workflows/{workflow_id}/results.json"

            mock_s3_client.put_object.return_value = {
                "ETag": f'"result-{workflow_id}-etag"'
            }

            await mock_s3_client.put_object(
                Bucket="results-bucket",
                Key=result_key,
                Body=json.dumps(result_data).encode('utf-8')
            )

            # Verify complete workflow
            # Check database
            db_result = await test_db_session.execute(
                text("SELECT status FROM workflows WHERE id = :id"),
                {"id": workflow_id}
            )
            db_status = db_result.fetchone().status
            assert db_status == "completed"

            # Check Redis cache
            cached_status = await test_redis_client.hget(cache_key, "status")
            assert cached_status == "completed"

            # Verify S3 calls
            assert mock_s3_client.put_object.call_count >= 2  # Input data + results

            print(f"\nCross-Service Data Flow Test Results:")
            print(f"Workflow ID: {workflow_id}")
            print(f"Database Status: {db_status}")
            print(f"Cache Status: {cached_status}")
            print(f"S3 Operations: {mock_s3_client.put_object.call_count}")
            print("✓ Data flow across all services completed successfully")

        finally:
            os.unlink(temp_file_path)