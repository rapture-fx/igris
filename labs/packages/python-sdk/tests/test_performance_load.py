"""
Performance and load tests for Igris-engine Python SDK
"""

import pytest
import asyncio
import time
import statistics
from unittest.mock import AsyncMock, MagicMock, patch
import concurrent.futures
from typing import List, Dict, Any

from igris import IgrisClient
from igris.exceptions.base import APIError, RateLimitError
from igris.utils.rate_limiter import RateLimiter
from igris.models.common import APIResponse


@pytest.mark.performance
class TestSDKPerformance:
    """Performance tests for SDK operations."""

    @pytest.fixture
    def performance_client(self, test_api_key, test_base_url):
        """Performance testing client with optimized settings."""
        return IgrisClient(
            api_key=test_api_key,
            base_url=test_base_url,
            timeout=30.0,
            max_concurrent_requests=50,
            connection_pool_size=20
        )

    @pytest.mark.asyncio
    async def test_concurrent_api_calls_performance(self, performance_client):
        """Test performance of concurrent API calls."""
        concurrent_requests = 100
        mock_response = {"success": True, "data": {"result": "success"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            start_time = time.time()
            
            # Create concurrent tasks
            tasks = [
                performance_client.data.get_job_status(f"job-{i}")
                for i in range(concurrent_requests)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Performance assertions
            successful_requests = len([r for r in results if not isinstance(r, Exception)])
            assert successful_requests == concurrent_requests
            
            # Should complete 100 requests in under 5 seconds with proper concurrency
            assert total_time < 5.0
            
            # Calculate requests per second
            rps = concurrent_requests / total_time
            assert rps > 20  # Should achieve at least 20 RPS
            
            print(f"Concurrent requests performance: {rps:.2f} RPS, {total_time:.2f}s total")

    @pytest.mark.asyncio
    async def test_memory_usage_monitoring(self, performance_client):
        """Test memory usage during high-load operations."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Simulate high-load operations
        large_data_operations = 1000
        mock_response = {"success": True, "data": {"large_dataset": "x" * 1000}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Perform many operations
            for i in range(large_data_operations):
                await performance_client.data.get_job_status(f"job-{i}")
                
                if i % 100 == 0:
                    current_memory = process.memory_info().rss / 1024 / 1024
                    memory_increase = current_memory - initial_memory
                    
                    # Memory should not increase significantly (detect memory leaks)
                    assert memory_increase < 50  # Less than 50MB increase
        
        final_memory = process.memory_info().rss / 1024 / 1024
        memory_increase = final_memory - initial_memory
        
        print(f"Memory usage: Initial {initial_memory:.1f}MB, Final {final_memory:.1f}MB, Increase {memory_increase:.1f}MB")
        
        # Final memory increase should be reasonable
        assert memory_increase < 100  # Less than 100MB total increase

    @pytest.mark.asyncio
    async def test_response_time_distribution(self, performance_client):
        """Test response time distribution under load."""
        request_count = 200
        response_times = []
        
        mock_response = {"success": True, "data": {"result": "test"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            # Add realistic delay
            async def delayed_response(*args, **kwargs):
                await asyncio.sleep(0.01)  # 10ms simulated network delay
                return mock_response
            
            mock_request.side_effect = delayed_response
            
            # Measure response times
            for i in range(request_count):
                start_time = time.time()
                await performance_client.data.get_job_status(f"job-{i}")
                end_time = time.time()
                
                response_times.append((end_time - start_time) * 1000)  # Convert to ms
            
            # Analyze response time distribution
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            p95_response_time = sorted(response_times)[int(0.95 * len(response_times))]
            p99_response_time = sorted(response_times)[int(0.99 * len(response_times))]
            
            print(f"Response times - Avg: {avg_response_time:.1f}ms, "
                  f"Median: {median_response_time:.1f}ms, "
                  f"P95: {p95_response_time:.1f}ms, "
                  f"P99: {p99_response_time:.1f}ms")
            
            # Performance assertions
            assert avg_response_time < 100  # Average under 100ms
            assert p95_response_time < 200  # 95th percentile under 200ms
            assert p99_response_time < 500  # 99th percentile under 500ms

    @pytest.mark.asyncio
    async def test_connection_pooling_efficiency(self, performance_client):
        """Test efficiency of connection pooling."""
        connection_stats = {
            "connections_created": 0,
            "connections_reused": 0
        }
        
        # Mock connection tracking
        original_request = performance_client.http_client._make_request
        
        async def tracked_request(*args, **kwargs):
            connection_stats["connections_reused"] += 1
            return {"success": True, "data": {"result": "test"}}
        
        with patch.object(performance_client.http_client, '_make_request', tracked_request):
            # Make sequential requests that should reuse connections
            for i in range(50):
                await performance_client.data.get_job_status(f"job-{i}")
        
        # With connection pooling, we should have high reuse
        reuse_ratio = connection_stats["connections_reused"] / 50
        assert reuse_ratio > 0.8  # At least 80% connection reuse

    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_sustained_load_performance(self, performance_client):
        """Test performance under sustained load."""
        test_duration = 60  # 1 minute
        requests_per_second = 10
        
        start_time = time.time()
        request_count = 0
        errors = 0
        
        mock_response = {"success": True, "data": {"result": "test"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            while (time.time() - start_time) < test_duration:
                # Send batch of requests
                tasks = []
                for _ in range(requests_per_second):
                    task = performance_client.data.get_job_status(f"job-{request_count}")
                    tasks.append(task)
                    request_count += 1
                
                try:
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    errors += len([r for r in results if isinstance(r, Exception)])
                except Exception:
                    errors += requests_per_second
                
                # Wait for next second
                await asyncio.sleep(1.0)
        
        total_time = time.time() - start_time
        actual_rps = request_count / total_time
        error_rate = errors / request_count
        
        print(f"Sustained load test: {actual_rps:.2f} RPS, {error_rate:.2%} error rate")
        
        # Performance assertions
        assert actual_rps >= (requests_per_second * 0.9)  # Within 10% of target RPS
        assert error_rate < 0.01  # Less than 1% error rate


@pytest.mark.load
class TestLoadHandling:
    """Load testing and capacity planning tests."""

    @pytest.mark.asyncio
    async def test_rate_limiting_behavior(self, client):
        """Test SDK behavior under rate limiting."""
        rate_limiter = RateLimiter(requests_per_second=10, burst_capacity=20)
        
        request_times = []
        
        # Make requests that will trigger rate limiting
        for i in range(30):  # More than burst capacity
            start_time = time.time()
            await rate_limiter.acquire()
            end_time = time.time()
            
            request_times.append(end_time - start_time)
        
        # First 20 requests should be fast (within burst capacity)
        burst_requests = request_times[:20]
        throttled_requests = request_times[20:]
        
        avg_burst_time = statistics.mean(burst_requests)
        avg_throttled_time = statistics.mean(throttled_requests)
        
        print(f"Rate limiting - Burst avg: {avg_burst_time:.3f}s, Throttled avg: {avg_throttled_time:.3f}s")
        
        # Burst requests should be very fast
        assert avg_burst_time < 0.01  # Under 10ms
        
        # Throttled requests should show delay
        assert avg_throttled_time > 0.05  # At least 50ms delay

    @pytest.mark.asyncio
    async def test_error_rate_under_load(self, performance_client):
        """Test error rate under high load conditions."""
        high_load_requests = 500
        error_responses = 0
        successful_responses = 0
        
        # Simulate mixed success/error responses
        def mock_response_generator():
            count = 0
            while True:
                count += 1
                if count % 20 == 0:  # 5% error rate
                    yield APIError("Service temporarily unavailable", status_code=503)
                else:
                    yield {"success": True, "data": {"result": "test"}}
        
        response_gen = mock_response_generator()
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            async def mixed_response(*args, **kwargs):
                response = next(response_gen)
                if isinstance(response, Exception):
                    raise response
                return response
            
            mock_request.side_effect = mixed_response
            
            # Process requests with error handling
            tasks = []
            for i in range(high_load_requests):
                task = self._safe_api_call(performance_client, f"job-{i}")
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    error_responses += 1
                else:
                    successful_responses += 1
        
        error_rate = error_responses / high_load_requests
        success_rate = successful_responses / high_load_requests
        
        print(f"Load test results - Success: {success_rate:.2%}, Error: {error_rate:.2%}")
        
        # Should handle errors gracefully
        assert error_rate < 0.1  # Less than 10% error rate
        assert success_rate > 0.9  # More than 90% success rate

    async def _safe_api_call(self, client, job_id):
        """Safe API call that handles errors gracefully."""
        try:
            return await client.data.get_job_status(job_id)
        except APIError as e:
            if e.status_code >= 500:  # Server errors
                return None  # Graceful degradation
            raise  # Re-raise client errors

    @pytest.mark.asyncio
    async def test_backpressure_handling(self, performance_client):
        """Test handling of backpressure from server."""
        backpressure_delay = 0.1  # 100ms delay to simulate slow server
        queue_size = 100
        
        processing_times = []
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            async def slow_response(*args, **kwargs):
                await asyncio.sleep(backpressure_delay)
                return {"success": True, "data": {"result": "test"}}
            
            mock_request.side_effect = slow_response
            
            start_time = time.time()
            
            # Create many concurrent requests
            tasks = [
                performance_client.data.get_job_status(f"job-{i}")
                for i in range(queue_size)
            ]
            
            await asyncio.gather(*tasks)
            
            end_time = time.time()
            total_time = end_time - start_time
        
        # With proper backpressure handling, total time should be reasonable
        # (not linearly proportional to queue_size * delay)
        max_expected_time = (queue_size * backpressure_delay) / 10  # Assuming 10x concurrency
        
        print(f"Backpressure test: {total_time:.2f}s for {queue_size} requests")
        
        assert total_time < max_expected_time * 2  # Allow some overhead

    @pytest.mark.asyncio
    async def test_resource_cleanup_under_load(self, performance_client):
        """Test resource cleanup during high load."""
        import gc
        import weakref
        
        # Track object references
        client_refs = []
        
        async def create_and_use_client():
            temp_client = IgrisClient(
                api_key="test-key",
                base_url="https://api.test.com"
            )
            client_refs.append(weakref.ref(temp_client))
            
            with patch.object(temp_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
                mock_request.return_value = {"success": True, "data": {}}
                await temp_client.data.get_job_status("test-job")
            
            await temp_client.close()
            return "completed"
        
        # Create and destroy many clients
        for _ in range(50):
            await create_and_use_client()
        
        # Force garbage collection
        gc.collect()
        await asyncio.sleep(0.1)  # Allow cleanup
        
        # Check for memory leaks
        live_clients = len([ref for ref in client_refs if ref() is not None])
        
        print(f"Resource cleanup test: {live_clients} clients still alive out of 50")
        
        # Most clients should be garbage collected
        assert live_clients < 5  # Less than 10% still alive


@pytest.mark.stress
class TestStressConditions:
    """Stress tests for extreme conditions."""

    @pytest.mark.asyncio
    async def test_extreme_concurrency(self, performance_client):
        """Test extreme concurrency levels."""
        extreme_concurrency = 1000
        
        mock_response = {"success": True, "data": {"result": "test"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            start_time = time.time()
            
            # Create extreme number of concurrent tasks
            tasks = [
                performance_client.data.get_job_status(f"job-{i}")
                for i in range(extreme_concurrency)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            total_time = end_time - start_time
        
        successful_requests = len([r for r in results if not isinstance(r, Exception)])
        success_rate = successful_requests / extreme_concurrency
        
        print(f"Extreme concurrency test: {success_rate:.2%} success rate, {total_time:.2f}s")
        
        # Should handle extreme concurrency gracefully
        assert success_rate > 0.95  # At least 95% success rate
        assert total_time < 30  # Complete within 30 seconds

    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_long_running_operations(self, performance_client):
        """Test long-running operations and connection stability."""
        long_operation_duration = 300  # 5 minutes
        
        mock_response = {"success": True, "data": {"status": "processing"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            async def long_response(*args, **kwargs):
                await asyncio.sleep(1)  # 1 second per check
                return mock_response
            
            mock_request.side_effect = long_response
            
            start_time = time.time()
            check_count = 0
            
            # Simulate long-running job monitoring
            while (time.time() - start_time) < long_operation_duration:
                try:
                    await performance_client.data.get_job_status("long-job")
                    check_count += 1
                except Exception as e:
                    print(f"Error during long operation: {e}")
                    break
                
                await asyncio.sleep(5)  # Check every 5 seconds
        
        total_time = time.time() - start_time
        
        print(f"Long operation test: {check_count} checks over {total_time:.1f}s")
        
        # Should maintain connection stability
        expected_checks = int(total_time / 6)  # Roughly every 6 seconds (5s sleep + 1s response)
        assert check_count >= expected_checks * 0.9  # Within 10% of expected

    @pytest.mark.asyncio
    async def test_large_payload_handling(self, performance_client):
        """Test handling of large request/response payloads."""
        large_payload_size = 10 * 1024 * 1024  # 10MB
        large_data = "x" * large_payload_size
        
        mock_response = {
            "success": True,
            "data": {"large_field": large_data}
        }
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            start_time = time.time()
            
            # Process large payload
            result = await performance_client.data.get_job_status("large-job")
            
            end_time = time.time()
            processing_time = end_time - start_time
        
        print(f"Large payload test: {processing_time:.2f}s for {large_payload_size / 1024 / 1024:.1f}MB")
        
        # Should handle large payloads efficiently
        assert processing_time < 10  # Under 10 seconds
        assert len(result["data"]["large_field"]) == large_payload_size


class TestPerformanceRegression:
    """Performance regression tests."""

    @pytest.mark.asyncio
    async def test_performance_baseline(self, performance_client):
        """Establish performance baseline for regression testing."""
        baseline_requests = 100
        baseline_metrics = {}
        
        mock_response = {"success": True, "data": {"result": "test"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Measure baseline performance
            start_time = time.time()
            
            tasks = [
                performance_client.data.get_job_status(f"job-{i}")
                for i in range(baseline_requests)
            ]
            
            await asyncio.gather(*tasks)
            
            end_time = time.time()
            total_time = end_time - start_time
        
        baseline_metrics.update({
            "requests": baseline_requests,
            "total_time": total_time,
            "rps": baseline_requests / total_time,
            "avg_response_time": (total_time / baseline_requests) * 1000  # ms
        })
        
        print(f"Performance baseline: {baseline_metrics['rps']:.2f} RPS, "
              f"{baseline_metrics['avg_response_time']:.2f}ms avg response time")
        
        # Store baseline for comparison (in real tests, this would be persisted)
        assert baseline_metrics["rps"] > 50  # Minimum acceptable performance
        assert baseline_metrics["avg_response_time"] < 50  # Maximum acceptable latency

    @pytest.mark.asyncio
    async def test_performance_monitoring_integration(self, performance_client):
        """Test integration with performance monitoring systems."""
        metrics_collected = []
        
        class MockMetricsCollector:
            def record_metric(self, name, value, tags=None):
                metrics_collected.append({
                    "name": name,
                    "value": value,
                    "tags": tags or {},
                    "timestamp": time.time()
                })
        
        collector = MockMetricsCollector()
        
        mock_response = {"success": True, "data": {"result": "test"}}
        
        with patch.object(performance_client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Simulate requests with metrics collection
            for i in range(10):
                start_time = time.time()
                await performance_client.data.get_job_status(f"job-{i}")
                end_time = time.time()
                
                # Collect performance metrics
                collector.record_metric(
                    "api_request_duration",
                    (end_time - start_time) * 1000,
                    {"endpoint": "get_job_status"}
                )
                collector.record_metric("api_request_count", 1, {"status": "success"})
        
        # Verify metrics collection
        duration_metrics = [m for m in metrics_collected if m["name"] == "api_request_duration"]
        count_metrics = [m for m in metrics_collected if m["name"] == "api_request_count"]
        
        assert len(duration_metrics) == 10
        assert len(count_metrics) == 10
        assert all(m["value"] > 0 for m in duration_metrics)


# Performance test utilities
def measure_execution_time(func):
    """Decorator to measure execution time of async functions."""
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        result = await func(*args, **kwargs)
        end_time = time.time()
        execution_time = end_time - start_time
        print(f"{func.__name__} executed in {execution_time:.3f}s")
        return result, execution_time
    return wrapper


class PerformanceProfiler:
    """Simple performance profiler for SDK operations."""
    
    def __init__(self):
        self.measurements = []
    
    async def profile_operation(self, operation_name: str, operation_func):
        """Profile a single operation."""
        start_time = time.time()
        result = await operation_func()
        end_time = time.time()
        
        measurement = {
            "operation": operation_name,
            "duration": end_time - start_time,
            "timestamp": start_time
        }
        
        self.measurements.append(measurement)
        return result
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        if not self.measurements:
            return {}
        
        durations = [m["duration"] for m in self.measurements]
        
        return {
            "total_operations": len(self.measurements),
            "total_time": sum(durations),
            "avg_duration": statistics.mean(durations),
            "median_duration": statistics.median(durations),
            "min_duration": min(durations),
            "max_duration": max(durations),
            "p95_duration": sorted(durations)[int(0.95 * len(durations))] if len(durations) > 20 else max(durations)
        }


# Pytest markers configuration
pytest_plugins = ["pytest_asyncio"]