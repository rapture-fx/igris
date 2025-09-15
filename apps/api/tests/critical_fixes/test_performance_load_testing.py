"""
Performance and Load Testing Suite
==================================

Comprehensive performance and load testing suite for validating system behavior
under various load conditions. Tests performance benchmarks, scalability limits,
and system stability under stress.

Test Coverage:
- System behavior under load for all critical components
- Response time validation under concurrent users
- Resource utilization monitoring
- Throughput and latency benchmarks
- Memory usage and leak detection
- Database performance under load
- Security middleware performance impact
- Recovery time from peak loads
"""

import pytest
import asyncio
import time
import psutil
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
from unittest.mock import AsyncMock, MagicMock, patch
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import io
import httpx

# Import application components
import sys
sys.path.append('/Users/wira/Desktop/schlep-engine/apps/api')


class TestSystemPerformanceBaselines:
    """Test system performance baselines for critical components."""

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_data_quality_api_baseline_performance(self, authenticated_async_client, sample_csv_data, test_metrics, performance_thresholds):
        """Test baseline performance of data quality API."""
        test_metrics.start_timer()

        files = {"file": ("baseline_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({
            "check_duplicates": True,
            "check_missing": True,
            "check_outliers": True,
            "generate_profile": True
        })}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        test_metrics.end_timer()

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Validate baseline performance
        thresholds = performance_thresholds["data_quality_api"]
        test_metrics.assert_performance({
            "execution_time_ms": thresholds["max_response_time_ms"]
        })

        # Record baseline metrics
        test_metrics.record_metric("baseline_response_time_ms", test_metrics.metrics["execution_time_ms"])
        test_metrics.record_metric("baseline_rows_processed", result["total_rows"])
        test_metrics.record_metric("baseline_columns_processed", result["total_columns"])

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_rl_optimization_baseline_performance(self, authenticated_async_client, test_metrics, performance_thresholds):
        """Test baseline performance of RL optimization API."""
        test_metrics.start_timer()

        rl_config = {
            "pipeline_id": "baseline_performance_test",
            "training_data_path": "/tmp/baseline_test.csv",
            "optimization_config": {
                "algorithm": "PPO",
                "max_episodes": 5  # Minimal for performance test
            },
            "max_runtime_hours": 1
        }

        response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=rl_config
        )

        test_metrics.end_timer()

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Validate baseline performance
        thresholds = performance_thresholds["rl_optimization"]
        test_metrics.assert_performance({
            "execution_time_ms": thresholds["max_session_creation_time_ms"]
        })

        test_metrics.record_metric("baseline_rl_creation_time_ms", test_metrics.metrics["execution_time_ms"])
        test_metrics.record_metric("baseline_session_id", result["session_id"])

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_security_middleware_baseline_performance(self, authenticated_async_client, test_metrics, performance_thresholds):
        """Test baseline performance impact of security middleware."""
        test_metrics.start_timer()

        # Make multiple requests to measure security overhead
        responses = []
        for i in range(10):
            response = await authenticated_async_client.get("/api/v1/health")
            responses.append(response)

        test_metrics.end_timer()

        # All requests should succeed
        successful_count = len([r for r in responses if r.status_code == 200])
        assert successful_count == 10

        # Security middleware should have minimal performance impact
        thresholds = performance_thresholds["security_middleware"]
        test_metrics.assert_performance({
            "execution_time_ms": thresholds["max_response_time_ms"]
        })

        avg_response_time = test_metrics.metrics["execution_time_ms"] / 10
        test_metrics.record_metric("baseline_security_overhead_ms", avg_response_time)


class TestConcurrentUserLoadTesting:
    """Test system behavior under concurrent user load."""

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_concurrent_data_quality_requests(self, authenticated_async_client, sample_csv_data, test_metrics, load_test_config):
        """Test concurrent data quality API requests."""
        concurrent_users = load_test_config["concurrent_users"]

        for user_count in concurrent_users:
            test_metrics.start_timer()

            async def make_quality_request(user_id: int):
                files = {"file": (f"user_{user_id}_data.csv", sample_csv_data, "text/csv")}
                data = {"request_data": json.dumps({"generate_profile": True})}

                start_time = time.time()
                response = await authenticated_async_client.post(
                    "/api/v1/quality/assess",
                    files=files,
                    data=data
                )
                end_time = time.time()

                return {
                    "user_id": user_id,
                    "status_code": response.status_code,
                    "response_time_ms": (end_time - start_time) * 1000,
                    "success": response.status_code == 200
                }

            # Run concurrent requests
            tasks = [make_quality_request(i) for i in range(user_count)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            test_metrics.end_timer()

            # Analyze results
            successful_results = [r for r in results if isinstance(r, dict) and r["success"]]
            failed_results = [r for r in results if isinstance(r, dict) and not r["success"]]
            error_results = [r for r in results if not isinstance(r, dict)]

            success_rate = len(successful_results) / user_count * 100
            avg_response_time = sum(r["response_time_ms"] for r in successful_results) / len(successful_results) if successful_results else 0

            test_metrics.record_metric(f"concurrent_{user_count}_success_rate", success_rate)
            test_metrics.record_metric(f"concurrent_{user_count}_avg_response_time", avg_response_time)
            test_metrics.record_metric(f"concurrent_{user_count}_failed_requests", len(failed_results))
            test_metrics.record_metric(f"concurrent_{user_count}_error_requests", len(error_results))

            # Assert minimum success rate
            assert success_rate >= 80, f"Success rate {success_rate}% below 80% for {user_count} concurrent users"

            # Assert reasonable response times
            if successful_results:
                max_response_time = max(r["response_time_ms"] for r in successful_results)
                assert max_response_time <= 10000, f"Max response time {max_response_time}ms too high for {user_count} users"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_concurrent_rl_optimization_requests(self, authenticated_async_client, test_metrics, load_test_config):
        """Test concurrent RL optimization requests."""
        concurrent_users = [1, 3, 5]  # RL optimization is more resource intensive

        for user_count in concurrent_users:
            test_metrics.start_timer()

            async def make_rl_request(user_id: int):
                rl_config = {
                    "pipeline_id": f"concurrent_test_{user_id}_{int(time.time())}",
                    "training_data_path": f"/tmp/user_{user_id}_data.csv",
                    "optimization_config": {
                        "algorithm": "PPO",
                        "max_episodes": 3  # Keep small for load test
                    },
                    "max_runtime_hours": 1
                }

                start_time = time.time()
                response = await authenticated_async_client.post(
                    "/api/v1/rl/hyperparameters/optimize",
                    json=rl_config
                )
                end_time = time.time()

                return {
                    "user_id": user_id,
                    "status_code": response.status_code,
                    "response_time_ms": (end_time - start_time) * 1000,
                    "success": response.status_code == 200
                }

            # Run concurrent RL requests
            tasks = [make_rl_request(i) for i in range(user_count)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            test_metrics.end_timer()

            # Analyze results
            successful_results = [r for r in results if isinstance(r, dict) and r["success"]]
            success_rate = len(successful_results) / user_count * 100

            test_metrics.record_metric(f"concurrent_rl_{user_count}_success_rate", success_rate)

            # RL optimization should handle at least some concurrent users
            if user_count <= 3:
                assert success_rate >= 60, f"RL success rate {success_rate}% too low for {user_count} concurrent users"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_mixed_workload_performance(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test performance under mixed workload (different API endpoints)."""
        test_metrics.start_timer()

        async def mixed_workload_user(user_id: int):
            tasks = []

            # Data quality request
            if user_id % 3 == 0:
                files = {"file": (f"mixed_{user_id}.csv", sample_csv_data, "text/csv")}
                data = {"request_data": json.dumps({})}
                task = authenticated_async_client.post("/api/v1/quality/assess", files=files, data=data)

            # RL session list request
            elif user_id % 3 == 1:
                task = authenticated_async_client.get("/api/v1/rl/sessions")

            # Health check request
            else:
                task = authenticated_async_client.get("/api/v1/health")

            response = await task
            return {
                "user_id": user_id,
                "workload_type": user_id % 3,
                "status_code": response.status_code,
                "success": response.status_code == 200
            }

        # Run mixed workload with 15 users (5 each type)
        tasks = [mixed_workload_user(i) for i in range(15)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        test_metrics.end_timer()

        # Analyze by workload type
        workload_types = {0: "data_quality", 1: "rl_sessions", 2: "health_check"}

        for workload_type, name in workload_types.items():
            type_results = [r for r in results if isinstance(r, dict) and r["workload_type"] == workload_type]
            success_rate = len([r for r in type_results if r["success"]]) / len(type_results) * 100 if type_results else 0

            test_metrics.record_metric(f"mixed_workload_{name}_success_rate", success_rate)

        # Overall success rate should be high
        overall_success_rate = len([r for r in results if isinstance(r, dict) and r["success"]]) / len(results) * 100
        test_metrics.record_metric("mixed_workload_overall_success_rate", overall_success_rate)

        assert overall_success_rate >= 85, f"Mixed workload success rate {overall_success_rate}% too low"


class TestResourceUtilizationMonitoring:
    """Test resource utilization under various loads."""

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    def test_memory_usage_monitoring(self, authenticated_client, sample_csv_data, test_metrics):
        """Test memory usage under load."""
        # Get baseline memory usage
        process = psutil.Process()
        baseline_memory_mb = process.memory_info().rss / 1024 / 1024

        test_metrics.record_metric("baseline_memory_mb", baseline_memory_mb)

        # Perform memory-intensive operations
        for i in range(10):
            files = {"file": (f"memory_test_{i}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({
                "check_duplicates": True,
                "check_missing": True,
                "check_outliers": True,
                "generate_profile": True
            })}

            response = authenticated_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )

            # Monitor memory after each request
            current_memory_mb = process.memory_info().rss / 1024 / 1024
            test_metrics.record_metric(f"memory_after_request_{i}_mb", current_memory_mb)

        # Final memory usage
        final_memory_mb = process.memory_info().rss / 1024 / 1024
        memory_increase_mb = final_memory_mb - baseline_memory_mb

        test_metrics.record_metric("final_memory_mb", final_memory_mb)
        test_metrics.record_metric("memory_increase_mb", memory_increase_mb)

        # Memory increase should be reasonable (no major leaks)
        assert memory_increase_mb <= 200, f"Memory increase {memory_increase_mb}MB too high"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    def test_cpu_usage_monitoring(self, authenticated_client, sample_csv_data, test_metrics):
        """Test CPU usage under load."""
        # Monitor CPU usage during operations
        cpu_measurements = []

        def monitor_cpu():
            for _ in range(20):  # Monitor for 10 seconds
                cpu_percent = psutil.cpu_percent(interval=0.5)
                cpu_measurements.append(cpu_percent)

        # Start CPU monitoring in background
        cpu_thread = threading.Thread(target=monitor_cpu)
        cpu_thread.start()

        # Perform CPU-intensive operations
        for i in range(5):
            files = {"file": (f"cpu_test_{i}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({
                "check_duplicates": True,
                "check_missing": True,
                "check_outliers": True,
                "generate_profile": True
            })}

            response = authenticated_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )

        # Wait for monitoring to complete
        cpu_thread.join()

        # Analyze CPU usage
        if cpu_measurements:
            avg_cpu = sum(cpu_measurements) / len(cpu_measurements)
            max_cpu = max(cpu_measurements)

            test_metrics.record_metric("avg_cpu_percent", avg_cpu)
            test_metrics.record_metric("max_cpu_percent", max_cpu)

            # CPU usage should be reasonable
            assert max_cpu <= 90, f"Max CPU usage {max_cpu}% too high"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_database_connection_usage(self, authenticated_async_client, sample_csv_data, test_metrics, test_db_session):
        """Test database connection usage under load."""
        # Monitor database connections during load
        initial_connections = len(asyncio.all_tasks())  # Approximation

        # Perform database-intensive operations
        tasks = []
        for i in range(10):
            # Data quality assessment (uses database)
            files = {"file": (f"db_test_{i}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}
            task = authenticated_async_client.post("/api/v1/quality/assess", files=files, data=data)
            tasks.append(task)

            # RL optimization (uses database)
            rl_config = {
                "pipeline_id": f"db_load_test_{i}",
                "training_data_path": f"/tmp/db_test_{i}.csv",
                "optimization_config": {"algorithm": "PPO", "max_episodes": 2},
                "max_runtime_hours": 1
            }
            rl_task = authenticated_async_client.post("/api/v1/rl/hyperparameters/optimize", json=rl_config)
            tasks.append(rl_task)

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successful operations
        successful_operations = len([r for r in results if hasattr(r, 'status_code') and r.status_code == 200])
        test_metrics.record_metric("successful_db_operations", successful_operations)

        # Should handle database load gracefully
        assert successful_operations >= len(tasks) * 0.6, "Database operations success rate too low"


class TestThroughputAndLatencyBenchmarks:
    """Test throughput and latency benchmarks."""

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_data_quality_throughput(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test data quality API throughput."""
        test_duration_seconds = 30
        start_time = time.time()

        completed_requests = []
        active_tasks = set()

        async def process_single_request(request_id: int):
            request_start = time.time()

            files = {"file": (f"throughput_{request_id}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}

            try:
                response = await authenticated_async_client.post(
                    "/api/v1/quality/assess",
                    files=files,
                    data=data
                )

                request_end = time.time()
                return {
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "latency_ms": (request_end - request_start) * 1000,
                    "success": response.status_code == 200
                }
            except Exception as e:
                request_end = time.time()
                return {
                    "request_id": request_id,
                    "status_code": 0,
                    "latency_ms": (request_end - request_start) * 1000,
                    "success": False,
                    "error": str(e)
                }

        # Generate requests for the test duration
        request_id = 0
        while time.time() - start_time < test_duration_seconds:
            # Limit concurrent requests to avoid overwhelming
            while len(active_tasks) < 5:
                task = asyncio.create_task(process_single_request(request_id))
                active_tasks.add(task)
                request_id += 1

            # Check for completed tasks
            done_tasks = [task for task in active_tasks if task.done()]
            for task in done_tasks:
                active_tasks.remove(task)
                try:
                    result = await task
                    completed_requests.append(result)
                except Exception as e:
                    completed_requests.append({
                        "request_id": -1,
                        "status_code": 0,
                        "latency_ms": 0,
                        "success": False,
                        "error": str(e)
                    })

            await asyncio.sleep(0.1)  # Small delay

        # Wait for remaining tasks
        if active_tasks:
            remaining_results = await asyncio.gather(*active_tasks, return_exceptions=True)
            for result in remaining_results:
                if isinstance(result, dict):
                    completed_requests.append(result)

        # Calculate throughput metrics
        total_requests = len(completed_requests)
        successful_requests = len([r for r in completed_requests if r["success"]])

        throughput_rps = total_requests / test_duration_seconds
        success_rate = (successful_requests / total_requests * 100) if total_requests > 0 else 0

        # Calculate latency metrics
        successful_latencies = [r["latency_ms"] for r in completed_requests if r["success"]]
        if successful_latencies:
            avg_latency = sum(successful_latencies) / len(successful_latencies)
            p95_latency = sorted(successful_latencies)[int(len(successful_latencies) * 0.95)]
            p99_latency = sorted(successful_latencies)[int(len(successful_latencies) * 0.99)]
        else:
            avg_latency = p95_latency = p99_latency = 0

        test_metrics.record_metric("throughput_rps", throughput_rps)
        test_metrics.record_metric("success_rate_percent", success_rate)
        test_metrics.record_metric("avg_latency_ms", avg_latency)
        test_metrics.record_metric("p95_latency_ms", p95_latency)
        test_metrics.record_metric("p99_latency_ms", p99_latency)

        # Assert minimum performance requirements
        assert throughput_rps >= 0.5, f"Throughput {throughput_rps} RPS too low"
        assert success_rate >= 80, f"Success rate {success_rate}% too low"
        if avg_latency > 0:
            assert avg_latency <= 10000, f"Average latency {avg_latency}ms too high"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_api_endpoint_latency_distribution(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test latency distribution across different API endpoints."""
        endpoints_to_test = [
            ("/api/v1/health", "GET", None),
            ("/api/v1/rl/sessions", "GET", None),
            ("/api/v1/quality/assess", "POST", {"files": {"file": ("test.csv", sample_csv_data, "text/csv")}, "data": {"request_data": "{}"}}),
        ]

        latency_measurements = {}

        for endpoint, method, payload in endpoints_to_test:
            endpoint_latencies = []

            for i in range(10):  # 10 measurements per endpoint
                start_time = time.time()

                try:
                    if method == "GET":
                        response = await authenticated_async_client.get(endpoint)
                    elif method == "POST" and payload:
                        response = await authenticated_async_client.post(endpoint, **payload)
                    else:
                        response = await authenticated_async_client.post(endpoint, json={})

                    end_time = time.time()
                    latency_ms = (end_time - start_time) * 1000

                    if response.status_code == 200:
                        endpoint_latencies.append(latency_ms)

                except Exception as e:
                    # Skip failed requests for latency calculation
                    pass

            if endpoint_latencies:
                avg_latency = sum(endpoint_latencies) / len(endpoint_latencies)
                min_latency = min(endpoint_latencies)
                max_latency = max(endpoint_latencies)

                latency_measurements[endpoint] = {
                    "avg_latency_ms": avg_latency,
                    "min_latency_ms": min_latency,
                    "max_latency_ms": max_latency,
                    "sample_count": len(endpoint_latencies)
                }

                test_metrics.record_metric(f"latency_{endpoint.replace('/', '_')}_avg_ms", avg_latency)
                test_metrics.record_metric(f"latency_{endpoint.replace('/', '_')}_max_ms", max_latency)

        # Validate latency requirements
        for endpoint, metrics in latency_measurements.items():
            if "health" in endpoint:
                assert metrics["avg_latency_ms"] <= 100, f"Health endpoint latency {metrics['avg_latency_ms']}ms too high"
            elif "quality" in endpoint:
                assert metrics["avg_latency_ms"] <= 5000, f"Quality endpoint latency {metrics['avg_latency_ms']}ms too high"


class TestScalabilityLimits:
    """Test system scalability limits and breaking points."""

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_maximum_concurrent_users(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test maximum number of concurrent users system can handle."""
        max_users_tested = [5, 10, 15, 20, 25]
        scalability_results = {}

        for max_users in max_users_tested:
            test_metrics.start_timer()

            async def user_simulation(user_id: int):
                try:
                    files = {"file": (f"scale_test_{user_id}.csv", sample_csv_data, "text/csv")}
                    data = {"request_data": json.dumps({})}

                    response = await authenticated_async_client.post(
                        "/api/v1/quality/assess",
                        files=files,
                        data=data
                    )

                    return {
                        "user_id": user_id,
                        "success": response.status_code == 200,
                        "status_code": response.status_code
                    }
                except Exception as e:
                    return {
                        "user_id": user_id,
                        "success": False,
                        "error": str(e)
                    }

            # Run concurrent user simulation
            tasks = [user_simulation(i) for i in range(max_users)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            test_metrics.end_timer()

            # Analyze results
            successful_users = len([r for r in results if isinstance(r, dict) and r.get("success", False)])
            success_rate = (successful_users / max_users * 100) if max_users > 0 else 0

            scalability_results[max_users] = {
                "success_rate": success_rate,
                "successful_users": successful_users,
                "total_time_ms": test_metrics.metrics.get("execution_time_ms", 0)
            }

            test_metrics.record_metric(f"scalability_{max_users}_users_success_rate", success_rate)

            # If success rate drops below 50%, we've likely hit a limit
            if success_rate < 50:
                test_metrics.record_metric("scalability_limit_users", max_users)
                break

        # Record scalability metrics
        test_metrics.record_metric("scalability_results", scalability_results)

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_database_connection_limits(self, authenticated_async_client, test_metrics, test_db_session):
        """Test database connection limits under load."""
        # Test increasing database load
        connection_loads = [5, 10, 15, 20]

        for load in connection_loads:
            test_metrics.start_timer()

            async def db_intensive_operation(op_id: int):
                try:
                    # Operations that create database sessions
                    rl_config = {
                        "pipeline_id": f"db_limit_test_{op_id}_{int(time.time())}",
                        "training_data_path": f"/tmp/db_limit_{op_id}.csv",
                        "optimization_config": {"algorithm": "PPO", "max_episodes": 1},
                        "max_runtime_hours": 1
                    }

                    response = await authenticated_async_client.post(
                        "/api/v1/rl/hyperparameters/optimize",
                        json=rl_config
                    )

                    return {
                        "op_id": op_id,
                        "success": response.status_code == 200,
                        "status_code": response.status_code
                    }
                except Exception as e:
                    return {
                        "op_id": op_id,
                        "success": False,
                        "error": str(e)
                    }

            # Run database-intensive operations
            tasks = [db_intensive_operation(i) for i in range(load)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            test_metrics.end_timer()

            # Analyze database performance under load
            successful_ops = len([r for r in results if isinstance(r, dict) and r.get("success", False)])
            success_rate = (successful_ops / load * 100) if load > 0 else 0

            test_metrics.record_metric(f"db_load_{load}_success_rate", success_rate)

            # Database should handle reasonable loads
            if load <= 10:
                assert success_rate >= 60, f"Database success rate {success_rate}% too low for load {load}"


class TestRecoveryAndStabilityUnderStress:
    """Test system recovery and stability under stress conditions."""

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_recovery_after_peak_load(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test system recovery after experiencing peak load."""
        # Phase 1: Apply peak load
        test_metrics.start_timer()

        peak_load_tasks = []
        for i in range(20):  # High load
            files = {"file": (f"peak_load_{i}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}

            task = authenticated_async_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )
            peak_load_tasks.append(task)

        # Execute peak load
        peak_results = await asyncio.gather(*peak_load_tasks, return_exceptions=True)

        # Phase 2: Recovery period
        await asyncio.sleep(5)  # Allow system to recover

        # Phase 3: Test normal operations after recovery
        recovery_tasks = []
        for i in range(5):  # Normal load
            files = {"file": (f"recovery_{i}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}

            task = authenticated_async_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )
            recovery_tasks.append(task)

        recovery_results = await asyncio.gather(*recovery_tasks, return_exceptions=True)

        test_metrics.end_timer()

        # Analyze recovery
        peak_success_count = len([r for r in peak_results if hasattr(r, 'status_code') and r.status_code == 200])
        recovery_success_count = len([r for r in recovery_results if hasattr(r, 'status_code') and r.status_code == 200])

        peak_success_rate = peak_success_count / len(peak_load_tasks) * 100
        recovery_success_rate = recovery_success_count / len(recovery_tasks) * 100

        test_metrics.record_metric("peak_load_success_rate", peak_success_rate)
        test_metrics.record_metric("recovery_success_rate", recovery_success_rate)

        # System should recover well after peak load
        assert recovery_success_rate >= 80, f"Recovery success rate {recovery_success_rate}% too low"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_system_stability_under_sustained_load(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test system stability under sustained load over time."""
        test_duration_seconds = 60  # 1 minute sustained load
        start_time = time.time()

        stability_measurements = []
        completed_requests = []

        async def sustained_load_worker():
            request_count = 0
            while time.time() - start_time < test_duration_seconds:
                try:
                    files = {"file": (f"sustained_{request_count}.csv", sample_csv_data, "text/csv")}
                    data = {"request_data": json.dumps({})}

                    request_start = time.time()
                    response = await authenticated_async_client.post(
                        "/api/v1/quality/assess",
                        files=files,
                        data=data
                    )
                    request_end = time.time()

                    completed_requests.append({
                        "timestamp": request_end,
                        "success": response.status_code == 200,
                        "response_time_ms": (request_end - request_start) * 1000
                    })

                    request_count += 1
                    await asyncio.sleep(1)  # 1 request per second per worker

                except Exception as e:
                    completed_requests.append({
                        "timestamp": time.time(),
                        "success": False,
                        "error": str(e)
                    })

        # Run multiple workers for sustained load
        workers = [sustained_load_worker() for _ in range(3)]
        await asyncio.gather(*workers)

        # Analyze stability over time
        if completed_requests:
            # Group requests by 10-second intervals
            intervals = {}
            for req in completed_requests:
                interval = int((req["timestamp"] - start_time) // 10) * 10
                if interval not in intervals:
                    intervals[interval] = []
                intervals[interval].append(req)

            # Calculate stability metrics per interval
            for interval, requests in intervals.items():
                success_rate = len([r for r in requests if r["success"]]) / len(requests) * 100
                avg_response_time = sum(r.get("response_time_ms", 0) for r in requests if r["success"]) / max(1, len([r for r in requests if r["success"]]))

                stability_measurements.append({
                    "interval": interval,
                    "success_rate": success_rate,
                    "avg_response_time_ms": avg_response_time,
                    "request_count": len(requests)
                })

                test_metrics.record_metric(f"stability_interval_{interval}_success_rate", success_rate)

            # Overall stability should be maintained
            overall_success_rate = len([r for r in completed_requests if r["success"]]) / len(completed_requests) * 100
            test_metrics.record_metric("sustained_load_overall_success_rate", overall_success_rate)

            assert overall_success_rate >= 70, f"Sustained load success rate {overall_success_rate}% too low"

    @pytest.mark.critical_fix
    @pytest.mark.performance
    @pytest.mark.load_test
    async def test_error_rate_under_stress(self, authenticated_async_client, test_metrics):
        """Test error rates under various stress conditions."""
        stress_scenarios = [
            ("invalid_file_format", {"file": ("test.txt", b"invalid data", "text/plain")}),
            ("oversized_request", {"file": ("huge.csv", b"x" * (1024 * 1024), "text/csv")}),  # 1MB
            ("malformed_json", {"file": ("test.csv", b"name,age\nAlice,25", "text/csv"), "data": {"request_data": "invalid json"}}),
        ]

        error_rates = {}

        for scenario_name, request_data in stress_scenarios:
            scenario_results = []

            # Test each scenario multiple times
            for i in range(10):
                try:
                    if "data" in request_data:
                        response = await authenticated_async_client.post(
                            "/api/v1/quality/assess",
                            files={"file": request_data["file"]},
                            data=request_data["data"]
                        )
                    else:
                        response = await authenticated_async_client.post(
                            "/api/v1/quality/assess",
                            files=request_data
                        )

                    scenario_results.append({
                        "status_code": response.status_code,
                        "handled_gracefully": response.status_code in [400, 413, 422]  # Expected error codes
                    })

                except Exception as e:
                    scenario_results.append({
                        "status_code": 0,
                        "handled_gracefully": False,
                        "error": str(e)
                    })

            # Analyze error handling
            graceful_handling_rate = len([r for r in scenario_results if r["handled_gracefully"]]) / len(scenario_results) * 100
            error_rates[scenario_name] = graceful_handling_rate

            test_metrics.record_metric(f"error_handling_{scenario_name}_graceful_rate", graceful_handling_rate)

            # System should handle errors gracefully
            assert graceful_handling_rate >= 80, f"Graceful error handling rate {graceful_handling_rate}% too low for {scenario_name}"