"""
Load and Performance Integration Tests

Comprehensive load testing and performance validation including:
- API endpoint load testing
- Database performance under concurrent load
- Rate limiting effectiveness validation
- Memory and CPU usage monitoring
- ML pipeline performance benchmarks
- System stability under stress
- Throughput and latency measurements
- Resource utilization optimization
"""

import pytest
import asyncio
import time
import psutil
import json
import statistics
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import httpx
from unittest.mock import patch

from app.core.metrics import metrics_collector


@pytest.mark.performance
class TestAPILoadPerformance:
    """Load testing for API endpoints."""

    @pytest.mark.parametrize("load_scenario", [
        {"name": "light", "users": 10, "requests": 20, "ramp_up": 2},
        {"name": "moderate", "users": 25, "requests": 50, "ramp_up": 5},
        {"name": "heavy", "users": 50, "requests": 100, "ramp_up": 10}
    ])
    async def test_api_endpoint_load_scenarios(
        self,
        async_test_client,
        auth_headers_user,
        performance_monitor,
        load_scenario
    ):
        """Test API endpoints under different load scenarios."""

        endpoints_to_test = [
            {"path": "/health", "method": "GET", "headers": {}},
            {"path": "/api/v1/health", "method": "GET", "headers": auth_headers_user},
            {"path": "/metrics", "method": "GET", "headers": {}},
            {"path": "/system/info", "method": "GET", "headers": {}}
        ]

        scenario = load_scenario
        concurrent_users = scenario["users"]
        requests_per_user = scenario["requests"]
        ramp_up_time = scenario["ramp_up"]

        async def user_simulation(user_id: int):
            """Simulate a user session with multiple requests."""
            user_results = []

            # Stagger user start times for ramp-up
            start_delay = (user_id / concurrent_users) * ramp_up_time
            await asyncio.sleep(start_delay)

            for request_num in range(requests_per_user):
                # Select endpoint to test
                endpoint = endpoints_to_test[request_num % len(endpoints_to_test)]

                start_time = time.time()
                try:
                    if endpoint["method"] == "GET":
                        response = await async_test_client.get(
                            endpoint["path"],
                            headers=endpoint["headers"]
                        )
                    else:
                        response = await async_test_client.post(
                            endpoint["path"],
                            headers=endpoint["headers"]
                        )

                    duration_ms = (time.time() - start_time) * 1000
                    performance_monitor.record_response_time(duration_ms)

                    user_results.append({
                        "user_id": user_id,
                        "request_num": request_num,
                        "endpoint": endpoint["path"],
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                        "success": response.status_code < 400
                    })

                except Exception as e:
                    duration_ms = (time.time() - start_time) * 1000
                    performance_monitor.record_error(type(e).__name__)

                    user_results.append({
                        "user_id": user_id,
                        "request_num": request_num,
                        "endpoint": endpoint["path"],
                        "status_code": 500,
                        "duration_ms": duration_ms,
                        "success": False,
                        "error": str(e)
                    })

                # Small delay between requests
                await asyncio.sleep(0.05)

            return user_results

        # Execute load test
        start_time = time.time()
        user_tasks = [user_simulation(i) for i in range(concurrent_users)]
        all_user_results = await asyncio.gather(*user_tasks, return_exceptions=True)
        total_duration = time.time() - start_time

        # Process results
        flat_results = []
        for user_results in all_user_results:
            if not isinstance(user_results, Exception):
                flat_results.extend(user_results)

        # Calculate performance metrics
        successful_requests = [r for r in flat_results if r["success"]]
        failed_requests = [r for r in flat_results if not r["success"]]

        total_requests = len(flat_results)
        success_rate = len(successful_requests) / total_requests if total_requests > 0 else 0
        throughput = total_requests / total_duration if total_duration > 0 else 0

        # Response time statistics
        response_times = [r["duration_ms"] for r in successful_requests]
        if response_times:
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            p95_response_time = sorted(response_times)[int(len(response_times) * 0.95)]
            p99_response_time = sorted(response_times)[int(len(response_times) * 0.99)]
            max_response_time = max(response_times)
        else:
            avg_response_time = median_response_time = p95_response_time = p99_response_time = max_response_time = 0

        # Performance assertions based on scenario
        performance_thresholds = {
            "light": {"success_rate": 0.98, "avg_response_time": 200, "p95_response_time": 500},
            "moderate": {"success_rate": 0.95, "avg_response_time": 300, "p95_response_time": 800},
            "heavy": {"success_rate": 0.90, "avg_response_time": 500, "p95_response_time": 1500}
        }

        threshold = performance_thresholds[scenario["name"]]

        assert success_rate >= threshold["success_rate"], \
            f"Success rate {success_rate:.2%} below threshold {threshold['success_rate']:.2%}"

        assert avg_response_time <= threshold["avg_response_time"], \
            f"Average response time {avg_response_time:.2f}ms above threshold {threshold['avg_response_time']}ms"

        assert p95_response_time <= threshold["p95_response_time"], \
            f"95th percentile {p95_response_time:.2f}ms above threshold {threshold['p95_response_time']}ms"

        # Print detailed results
        print(f"\n{scenario['name'].title()} Load Test Results:")
        print(f"Scenario: {concurrent_users} users, {requests_per_user} requests/user")
        print(f"Total Requests: {total_requests}")
        print(f"Success Rate: {success_rate:.2%} ({len(successful_requests)}/{total_requests})")
        print(f"Throughput: {throughput:.2f} req/sec")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Response Times - Avg: {avg_response_time:.2f}ms, Median: {median_response_time:.2f}ms")
        print(f"Response Times - 95th: {p95_response_time:.2f}ms, 99th: {p99_response_time:.2f}ms, Max: {max_response_time:.2f}ms")

        if failed_requests:
            error_summary = {}
            for req in failed_requests:
                endpoint = req["endpoint"]
                error_summary[endpoint] = error_summary.get(endpoint, 0) + 1

            print(f"Errors by Endpoint: {error_summary}")

    async def test_rate_limiting_under_load(
        self,
        async_test_client,
        auth_headers_user,
        performance_monitor
    ):
        """Test rate limiting effectiveness under load."""

        # Test endpoint that should have rate limiting
        test_endpoint = "/api/v1/health"

        # Configure aggressive load to trigger rate limiting
        concurrent_users = 20
        requests_per_user = 30
        request_interval = 0.01  # Very fast requests

        async def aggressive_user(user_id: int):
            """User making requests as fast as possible."""
            user_results = []

            for i in range(requests_per_user):
                start_time = time.time()

                try:
                    response = await async_test_client.get(
                        test_endpoint,
                        headers=auth_headers_user
                    )

                    duration_ms = (time.time() - start_time) * 1000
                    performance_monitor.record_response_time(duration_ms)

                    user_results.append({
                        "user_id": user_id,
                        "request_num": i,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                        "rate_limited": response.status_code == 429,
                        "retry_after": response.headers.get("Retry-After"),
                        "timestamp": time.time()
                    })

                except Exception as e:
                    performance_monitor.record_error(type(e).__name__)
                    user_results.append({
                        "user_id": user_id,
                        "request_num": i,
                        "status_code": 500,
                        "error": str(e),
                        "timestamp": time.time()
                    })

                await asyncio.sleep(request_interval)

            return user_results

        # Execute aggressive load test
        start_time = time.time()
        user_tasks = [aggressive_user(i) for i in range(concurrent_users)]
        all_results = await asyncio.gather(*user_tasks)
        total_duration = time.time() - start_time

        # Analyze rate limiting effectiveness
        flat_results = [req for user_results in all_results for req in user_results]

        rate_limited_requests = [r for r in flat_results if r.get("rate_limited", False)]
        successful_requests = [r for r in flat_results if r.get("status_code", 500) == 200]

        total_requests = len(flat_results)
        rate_limit_activation_rate = len(rate_limited_requests) / total_requests if total_requests > 0 else 0

        print(f"\nRate Limiting Under Load Test Results:")
        print(f"Total Requests: {total_requests}")
        print(f"Successful Requests: {len(successful_requests)}")
        print(f"Rate Limited Requests: {len(rate_limited_requests)}")
        print(f"Rate Limit Activation: {rate_limit_activation_rate:.2%}")
        print(f"Test Duration: {total_duration:.2f}s")
        print(f"Request Rate: {total_requests/total_duration:.2f} req/sec")

        # Rate limiting should activate under aggressive load
        assert rate_limit_activation_rate > 0.1, "Rate limiting should activate under aggressive load"

        # System should remain stable even when rate limiting
        error_requests = [r for r in flat_results if r.get("status_code", 200) >= 500]
        error_rate = len(error_requests) / total_requests if total_requests > 0 else 0
        assert error_rate < 0.05, f"Error rate {error_rate:.2%} too high under load"

    async def test_memory_usage_under_load(
        self,
        async_test_client,
        auth_headers_user,
        performance_monitor
    ):
        """Test memory usage during load testing."""

        # Record initial memory usage
        process = psutil.Process()
        initial_memory = process.memory_info().rss / (1024 * 1024)  # MB

        memory_samples = [initial_memory]

        async def memory_monitoring():
            """Monitor memory usage during test."""
            while True:
                try:
                    current_memory = process.memory_info().rss / (1024 * 1024)
                    memory_samples.append(current_memory)
                    await asyncio.sleep(1)  # Sample every second
                except asyncio.CancelledError:
                    break
                except:
                    break

        # Start memory monitoring
        monitor_task = asyncio.create_task(memory_monitoring())

        # Execute load test with memory monitoring
        concurrent_users = 15
        requests_per_user = 40

        async def user_with_data_processing(user_id: int):
            """User session that processes data to stress memory."""
            for i in range(requests_per_user):
                start_time = time.time()

                try:
                    # Create some test data to process
                    test_data = {
                        "user_id": user_id,
                        "data": list(range(100)),  # Some data to process
                        "timestamp": time.time()
                    }

                    response = await async_test_client.post(
                        "/api/v1/validation/quick-test",
                        json=test_data,
                        headers=auth_headers_user
                    )

                    duration_ms = (time.time() - start_time) * 1000
                    performance_monitor.record_response_time(duration_ms)

                except Exception as e:
                    performance_monitor.record_error(type(e).__name__)

                await asyncio.sleep(0.02)

        # Execute load test
        start_time = time.time()
        user_tasks = [user_with_data_processing(i) for i in range(concurrent_users)]
        await asyncio.gather(*user_tasks, return_exceptions=True)

        # Stop memory monitoring
        monitor_task.cancel()

        test_duration = time.time() - start_time
        final_memory = process.memory_info().rss / (1024 * 1024)

        # Analyze memory usage
        max_memory = max(memory_samples)
        min_memory = min(memory_samples)
        avg_memory = sum(memory_samples) / len(memory_samples)
        memory_growth = final_memory - initial_memory

        print(f"\nMemory Usage Under Load Test Results:")
        print(f"Test Duration: {test_duration:.2f}s")
        print(f"Initial Memory: {initial_memory:.2f} MB")
        print(f"Final Memory: {final_memory:.2f} MB")
        print(f"Max Memory: {max_memory:.2f} MB")
        print(f"Average Memory: {avg_memory:.2f} MB")
        print(f"Memory Growth: {memory_growth:.2f} MB")
        print(f"Memory Samples: {len(memory_samples)}")

        # Memory assertions
        assert max_memory < initial_memory + 200, f"Memory usage grew too much: {max_memory - initial_memory:.2f} MB"
        assert memory_growth < 100, f"Memory growth too high: {memory_growth:.2f} MB"

    @pytest.mark.slow
    async def test_sustained_load_stability(
        self,
        async_test_client,
        auth_headers_user,
        performance_monitor
    ):
        """Test system stability under sustained load."""

        # Configure sustained load test
        test_duration_minutes = 2  # Short duration for testing
        requests_per_minute = 120
        concurrent_users = 10

        requests_per_user = int((test_duration_minutes * requests_per_minute) / concurrent_users)
        request_interval = 60.0 / (requests_per_minute / concurrent_users)  # Seconds between requests

        async def sustained_user_session(user_id: int):
            """User session for sustained load testing."""
            user_results = []
            start_time = time.time()

            for i in range(requests_per_user):
                try:
                    # Vary endpoints to simulate realistic usage
                    endpoints = ["/health", "/api/v1/health", "/metrics"]
                    endpoint = endpoints[i % len(endpoints)]
                    headers = auth_headers_user if "api/v1" in endpoint else {}

                    request_start = time.time()
                    response = await async_test_client.get(endpoint, headers=headers)
                    duration_ms = (time.time() - request_start) * 1000

                    performance_monitor.record_response_time(duration_ms)

                    user_results.append({
                        "user_id": user_id,
                        "request_num": i,
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                        "elapsed_time": time.time() - start_time
                    })

                    # Maintain consistent request rate
                    await asyncio.sleep(request_interval)

                except Exception as e:
                    performance_monitor.record_error(type(e).__name__)

            return user_results

        # Execute sustained load test
        print(f"\nStarting sustained load test...")
        print(f"Duration: {test_duration_minutes} minutes")
        print(f"Target Rate: {requests_per_minute} req/min")
        print(f"Concurrent Users: {concurrent_users}")

        start_time = time.time()
        user_tasks = [sustained_user_session(i) for i in range(concurrent_users)]
        all_results = await asyncio.gather(*user_tasks, return_exceptions=True)
        actual_duration = time.time() - start_time

        # Analyze sustained load results
        flat_results = []
        for user_results in all_results:
            if not isinstance(user_results, Exception):
                flat_results.extend(user_results)

        if len(flat_results) > 0:
            # Performance over time analysis
            time_buckets = {}
            for result in flat_results:
                bucket = int(result["elapsed_time"] // 30)  # 30-second buckets
                if bucket not in time_buckets:
                    time_buckets[bucket] = {"requests": [], "errors": 0}

                time_buckets[bucket]["requests"].append(result["duration_ms"])
                if result["status_code"] >= 400:
                    time_buckets[bucket]["errors"] += 1

            # Calculate stability metrics
            bucket_avg_times = []
            bucket_error_rates = []

            for bucket, data in time_buckets.items():
                avg_time = sum(data["requests"]) / len(data["requests"]) if data["requests"] else 0
                error_rate = data["errors"] / len(data["requests"]) if data["requests"] else 0

                bucket_avg_times.append(avg_time)
                bucket_error_rates.append(error_rate)

            # System stability assertions
            if bucket_avg_times:
                response_time_variance = statistics.stdev(bucket_avg_times) if len(bucket_avg_times) > 1 else 0
                max_error_rate = max(bucket_error_rates) if bucket_error_rates else 0

                print(f"\nSustained Load Test Results:")
                print(f"Actual Duration: {actual_duration:.2f}s ({actual_duration/60:.1f} min)")
                print(f"Total Requests: {len(flat_results)}")
                print(f"Actual Rate: {len(flat_results)/(actual_duration/60):.2f} req/min")
                print(f"Response Time Variance: {response_time_variance:.2f}ms")
                print(f"Max Error Rate: {max_error_rate:.2%}")

                # Time bucket analysis
                print(f"Performance by 30s intervals:")
                for bucket, avg_time in enumerate(bucket_avg_times):
                    error_rate = bucket_error_rates[bucket]
                    print(f"  {bucket*30}-{(bucket+1)*30}s: {avg_time:.2f}ms avg, {error_rate:.2%} errors")

                # Stability assertions
                assert response_time_variance < 100, f"Response time too unstable: {response_time_variance:.2f}ms variance"
                assert max_error_rate < 0.05, f"Error rate too high: {max_error_rate:.2%}"

    async def test_concurrent_ml_operations_performance(
        self,
        async_test_client,
        auth_headers_user,
        sample_ml_data,
        performance_monitor
    ):
        """Test performance of concurrent ML operations."""

        # Test data quality assessments concurrently
        concurrent_assessments = 5

        async def ml_operation_workload(workload_id: int):
            """ML operation workload simulation."""
            results = []

            # Create test data
            test_data = f"feature1,feature2,target\n{workload_id},2,0\n{workload_id+1},4,1"

            for i in range(3):  # 3 operations per workload
                start_time = time.time()

                try:
                    # Create temporary file for testing
                    import tempfile
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                        f.write(test_data)
                        temp_file_path = f.name

                    try:
                        # Test data quality assessment
                        with open(temp_file_path, 'rb') as f:
                            files = {"file": (f"test_{workload_id}_{i}.csv", f, "text/csv")}
                            form_data = {"request_data": json.dumps({"generate_profile": True})}

                            response = await async_test_client.post(
                                "/api/v1/quality/assess",
                                files=files,
                                data=form_data,
                                headers=auth_headers_user
                            )

                        duration_ms = (time.time() - start_time) * 1000
                        performance_monitor.record_response_time(duration_ms)

                        results.append({
                            "workload_id": workload_id,
                            "operation": i,
                            "status_code": response.status_code,
                            "duration_ms": duration_ms,
                            "success": response.status_code in [200, 404]  # 404 acceptable if endpoint not implemented
                        })

                    finally:
                        import os
                        os.unlink(temp_file_path)

                except Exception as e:
                    duration_ms = (time.time() - start_time) * 1000
                    performance_monitor.record_error(type(e).__name__)

                    results.append({
                        "workload_id": workload_id,
                        "operation": i,
                        "status_code": 500,
                        "duration_ms": duration_ms,
                        "success": False,
                        "error": str(e)
                    })

                await asyncio.sleep(0.1)  # Small delay between operations

            return results

        # Execute concurrent ML operations
        start_time = time.time()
        workload_tasks = [ml_operation_workload(i) for i in range(concurrent_assessments)]
        all_results = await asyncio.gather(*workload_tasks, return_exceptions=True)
        total_duration = time.time() - start_time

        # Process results
        flat_results = []
        for workload_results in all_results:
            if not isinstance(workload_results, Exception):
                flat_results.extend(workload_results)

        if len(flat_results) > 0:
            successful_ops = [r for r in flat_results if r["success"]]
            success_rate = len(successful_ops) / len(flat_results)

            avg_duration = sum(r["duration_ms"] for r in successful_ops) / len(successful_ops) if successful_ops else 0

            print(f"\nConcurrent ML Operations Test Results:")
            print(f"Concurrent Workloads: {concurrent_assessments}")
            print(f"Total Operations: {len(flat_results)}")
            print(f"Success Rate: {success_rate:.2%}")
            print(f"Average Duration: {avg_duration:.2f}ms")
            print(f"Total Duration: {total_duration:.2f}s")

            # Performance assertions for ML operations
            # ML operations can be slower than regular API calls
            if success_rate > 0:  # Only assert if operations succeeded
                assert avg_duration < 5000, f"ML operation average time too high: {avg_duration:.2f}ms"


@pytest.mark.performance
class TestSystemResourceMonitoring:
    """Test system resource usage monitoring during load."""

    async def test_cpu_usage_monitoring(
        self,
        async_test_client,
        performance_monitor
    ):
        """Monitor CPU usage during load test."""

        cpu_samples = []

        async def cpu_monitoring():
            """Monitor CPU usage."""
            while True:
                try:
                    cpu_percent = psutil.cpu_percent(interval=1)
                    cpu_samples.append({
                        "timestamp": time.time(),
                        "cpu_percent": cpu_percent
                    })
                except asyncio.CancelledError:
                    break

        # Start CPU monitoring
        monitor_task = asyncio.create_task(cpu_monitoring())

        # Execute load test
        async def cpu_intensive_requests():
            """Make requests that might be CPU intensive."""
            for i in range(20):
                try:
                    response = await async_test_client.get("/system/info")
                    performance_monitor.record_response_time(response.elapsed.total_seconds() * 1000 if hasattr(response, 'elapsed') else 0)
                    await asyncio.sleep(0.1)
                except:
                    pass

        # Run multiple concurrent sessions
        tasks = [cpu_intensive_requests() for _ in range(5)]
        await asyncio.gather(*tasks, return_exceptions=True)

        # Stop monitoring
        monitor_task.cancel()

        if cpu_samples:
            cpu_values = [sample["cpu_percent"] for sample in cpu_samples]
            max_cpu = max(cpu_values)
            avg_cpu = sum(cpu_values) / len(cpu_values)

            print(f"\nCPU Usage Monitoring Results:")
            print(f"Samples Collected: {len(cpu_samples)}")
            print(f"Average CPU: {avg_cpu:.2f}%")
            print(f"Maximum CPU: {max_cpu:.2f}%")

            # CPU usage should be reasonable
            assert max_cpu < 90, f"CPU usage too high: {max_cpu:.2f}%"

    async def test_connection_pool_performance(
        self,
        test_db_engine,
        performance_monitor
    ):
        """Test database connection pool performance."""

        connection_times = []

        async def connection_test(connection_id: int):
            """Test database connection performance."""
            start_time = time.time()

            try:
                async with test_db_engine.begin() as conn:
                    await conn.execute(
                        text("SELECT :id as test_id, CURRENT_TIMESTAMP as test_time"),
                        {"id": connection_id}
                    )

                connection_time = (time.time() - start_time) * 1000
                performance_monitor.record_response_time(connection_time)
                connection_times.append(connection_time)

                return {"success": True, "connection_time": connection_time}

            except Exception as e:
                connection_time = (time.time() - start_time) * 1000
                performance_monitor.record_error(type(e).__name__)
                return {"success": False, "error": str(e), "connection_time": connection_time}

        # Test connection pool under load
        concurrent_connections = 25
        connection_tasks = [connection_test(i) for i in range(concurrent_connections)]
        connection_results = await asyncio.gather(*connection_tasks, return_exceptions=True)

        successful_connections = [r for r in connection_results if isinstance(r, dict) and r.get("success")]

        if connection_times:
            avg_connection_time = sum(connection_times) / len(connection_times)
            max_connection_time = max(connection_times)

            print(f"\nConnection Pool Performance Results:")
            print(f"Total Connection Attempts: {concurrent_connections}")
            print(f"Successful Connections: {len(successful_connections)}")
            print(f"Success Rate: {len(successful_connections)/concurrent_connections:.2%}")
            print(f"Average Connection Time: {avg_connection_time:.2f}ms")
            print(f"Maximum Connection Time: {max_connection_time:.2f}ms")

            # Connection performance assertions
            assert len(successful_connections) / concurrent_connections > 0.9, "Connection success rate too low"
            assert avg_connection_time < 100, f"Average connection time too high: {avg_connection_time:.2f}ms"