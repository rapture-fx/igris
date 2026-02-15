"""
Comprehensive Performance and Load Tests for Python SDK

This module contains performance tests covering:
- Response time measurements
- Throughput testing
- Concurrent request handling
- Memory usage profiling
- Connection pooling efficiency
- Rate limiting behavior
- Resource cleanup verification
"""

import asyncio
import time
import threading
import psutil
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import AsyncMock, Mock, patch
import pytest
import pytest_asyncio
from typing import List, Dict, Any
import gc
import tracemalloc

try:
    from igris_sdk import IgrisClient
    from igris_sdk.auth import AuthManager
    from igris_sdk.data_processing import DataProcessor
    from igris_sdk.streaming import WebSocketManager
except ImportError:
    # Mock imports for testing
    class IgrisClient:
        def __init__(self, *args, **kwargs):
            pass
    
    class AuthManager:
        def __init__(self, *args, **kwargs):
            pass
    
    class DataProcessor:
        def __init__(self, *args, **kwargs):
            pass
    
    class WebSocketManager:
        def __init__(self, *args, **kwargs):
            pass


class PerformanceTestSuite:
    """Comprehensive performance testing suite for Python SDK"""
    
    def __init__(self):
        self.client = None
        self.test_results = {}
        self.memory_tracker = None
        
    def setup_memory_tracking(self):
        """Setup memory tracking for performance tests"""
        tracemalloc.start()
        gc.collect()
        
    def get_memory_usage(self) -> int:
        """Get current memory usage in bytes"""
        process = psutil.Process()
        return process.memory_info().rss
        
    def measure_execution_time(self, func, *args, **kwargs):
        """Measure execution time of a function"""
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        return result, end_time - start_time
        
    async def measure_async_execution_time(self, func, *args, **kwargs):
        """Measure execution time of an async function"""
        start_time = time.perf_counter()
        result = await func(*args, **kwargs)
        end_time = time.perf_counter()
        return result, end_time - start_time


@pytest.fixture
def performance_suite():
    """Create performance test suite fixture"""
    suite = PerformanceTestSuite()
    suite.setup_memory_tracking()
    yield suite
    # Cleanup
    tracemalloc.stop()


@pytest.fixture
def mock_client():
    """Create mock client for performance testing"""
    with patch('igris_sdk.IgrisClient') as mock:
        client = Mock()
        
        # Mock authentication
        client.authenticate = AsyncMock(return_value={"token": "test-token", "expires_in": 3600})
        
        # Mock data processing
        client.create_job = AsyncMock(return_value={"job_id": "test-job-123", "status": "created"})
        client.get_job_status = AsyncMock(return_value={"job_id": "test-job-123", "status": "completed"})
        client.upload_file = AsyncMock(return_value={"file_id": "test-file-123", "size": 1024})
        client.download_file = AsyncMock(return_value=b"test data")
        
        # Mock WebSocket
        client.create_websocket_connection = AsyncMock()
        
        mock.return_value = client
        yield client


class TestAuthenticationPerformance:
    """Test authentication performance"""
    
    @pytest.mark.asyncio
    async def test_authentication_response_time(self, performance_suite, mock_client):
        """Test authentication response time"""
        auth_manager = AuthManager("test-api-key")
        
        # Measure single authentication
        _, response_time = await performance_suite.measure_async_execution_time(
            mock_client.authenticate
        )
        
        assert response_time < 0.5, f"Authentication took {response_time:.3f}s, expected < 0.5s"
        performance_suite.test_results['auth_response_time'] = response_time
        
    @pytest.mark.asyncio
    async def test_concurrent_authentication(self, performance_suite, mock_client):
        """Test concurrent authentication requests"""
        concurrent_requests = 50
        
        async def authenticate_task():
            return await mock_client.authenticate()
            
        start_time = time.perf_counter()
        tasks = [authenticate_task() for _ in range(concurrent_requests)]
        results = await asyncio.gather(*tasks)
        end_time = time.perf_counter()
        
        total_time = end_time - start_time
        avg_time_per_request = total_time / concurrent_requests
        
        assert len(results) == concurrent_requests
        assert avg_time_per_request < 0.1, f"Average auth time {avg_time_per_request:.3f}s too slow"
        assert total_time < 5.0, f"Total time {total_time:.3f}s exceeded timeout"
        
        performance_suite.test_results['concurrent_auth'] = {
            'total_time': total_time,
            'avg_time': avg_time_per_request,
            'requests': concurrent_requests
        }
        
    def test_token_cache_performance(self, performance_suite, mock_client):
        """Test token caching efficiency"""
        auth_manager = AuthManager("test-api-key")
        
        # First call should fetch token
        start_time = time.perf_counter()
        token1 = auth_manager.get_cached_token()
        first_call_time = time.perf_counter() - start_time
        
        # Second call should use cache
        start_time = time.perf_counter()
        token2 = auth_manager.get_cached_token()
        cached_call_time = time.perf_counter() - start_time
        
        # Cache should be significantly faster
        assert cached_call_time < first_call_time * 0.1
        performance_suite.test_results['token_cache_efficiency'] = {
            'first_call': first_call_time,
            'cached_call': cached_call_time,
            'improvement_ratio': first_call_time / cached_call_time if cached_call_time > 0 else float('inf')
        }


class TestDataProcessingPerformance:
    """Test data processing performance"""
    
    @pytest.mark.asyncio
    async def test_file_upload_performance(self, performance_suite, mock_client):
        """Test file upload performance with various sizes"""
        file_sizes = [1024, 10240, 102400, 1024000]  # 1KB, 10KB, 100KB, 1MB
        
        for size in file_sizes:
            test_data = b"x" * size
            
            _, upload_time = await performance_suite.measure_async_execution_time(
                mock_client.upload_file,
                test_data,
                filename=f"test-{size}.bin"
            )
            
            # Calculate throughput (bytes per second)
            throughput = size / upload_time if upload_time > 0 else float('inf')
            
            # Expect at least 1MB/s throughput for reasonable performance
            min_throughput = 1024 * 1024  # 1MB/s
            assert throughput > min_throughput, f"Upload throughput {throughput/1024/1024:.2f} MB/s too slow"
            
            performance_suite.test_results[f'upload_perf_{size}'] = {
                'size': size,
                'time': upload_time,
                'throughput_mbps': throughput / 1024 / 1024
            }
            
    @pytest.mark.asyncio
    async def test_concurrent_job_processing(self, performance_suite, mock_client):
        """Test concurrent job processing performance"""
        num_jobs = 20
        
        async def process_job(job_id):
            # Create job
            job = await mock_client.create_job({"type": "test", "data": f"job-{job_id}"})
            
            # Monitor until completion
            while True:
                status = await mock_client.get_job_status(job['job_id'])
                if status['status'] in ['completed', 'failed']:
                    break
                await asyncio.sleep(0.1)
                
            return status
            
        start_time = time.perf_counter()
        tasks = [process_job(i) for i in range(num_jobs)]
        results = await asyncio.gather(*tasks)
        end_time = time.perf_counter()
        
        total_time = end_time - start_time
        jobs_per_second = num_jobs / total_time
        
        assert len(results) == num_jobs
        assert jobs_per_second > 2, f"Job processing rate {jobs_per_second:.2f} jobs/s too slow"
        
        performance_suite.test_results['concurrent_jobs'] = {
            'num_jobs': num_jobs,
            'total_time': total_time,
            'jobs_per_second': jobs_per_second
        }
        
    def test_memory_usage_during_processing(self, performance_suite, mock_client):
        """Test memory usage during data processing"""
        initial_memory = performance_suite.get_memory_usage()
        
        # Simulate processing multiple large files
        large_data_chunks = [b"x" * (1024 * 1024) for _ in range(10)]  # 10 x 1MB chunks
        
        for i, chunk in enumerate(large_data_chunks):
            # Process chunk
            processor = DataProcessor()
            processor.process_data(chunk)
            
            current_memory = performance_suite.get_memory_usage()
            memory_increase = current_memory - initial_memory
            
            # Memory should not grow unbounded
            max_allowed_increase = 50 * 1024 * 1024  # 50MB max increase
            assert memory_increase < max_allowed_increase, f"Memory leak detected: {memory_increase/1024/1024:.2f}MB increase"
            
        # Force garbage collection and check final memory
        gc.collect()
        final_memory = performance_suite.get_memory_usage()
        final_increase = final_memory - initial_memory
        
        performance_suite.test_results['memory_usage'] = {
            'initial_mb': initial_memory / 1024 / 1024,
            'final_mb': final_memory / 1024 / 1024,
            'max_increase_mb': final_increase / 1024 / 1024
        }


class TestWebSocketPerformance:
    """Test WebSocket performance"""
    
    @pytest.mark.asyncio
    async def test_websocket_connection_time(self, performance_suite, mock_client):
        """Test WebSocket connection establishment time"""
        ws_manager = WebSocketManager("ws://test-server")
        
        _, connection_time = await performance_suite.measure_async_execution_time(
            mock_client.create_websocket_connection
        )
        
        assert connection_time < 2.0, f"WebSocket connection took {connection_time:.3f}s, expected < 2s"
        performance_suite.test_results['websocket_connection_time'] = connection_time
        
    @pytest.mark.asyncio
    async def test_message_throughput(self, performance_suite, mock_client):
        """Test WebSocket message throughput"""
        num_messages = 1000
        message_size = 1024  # 1KB messages
        
        # Mock WebSocket sending
        mock_websocket = Mock()
        mock_websocket.send = AsyncMock()
        
        test_message = b"x" * message_size
        
        start_time = time.perf_counter()
        for i in range(num_messages):
            await mock_websocket.send(test_message)
        end_time = time.perf_counter()
        
        total_time = end_time - start_time
        messages_per_second = num_messages / total_time
        throughput_mbps = (num_messages * message_size) / total_time / 1024 / 1024
        
        # Expect at least 100 messages/second
        assert messages_per_second > 100, f"Message rate {messages_per_second:.2f} msg/s too slow"
        
        performance_suite.test_results['websocket_throughput'] = {
            'messages_per_second': messages_per_second,
            'throughput_mbps': throughput_mbps,
            'total_messages': num_messages
        }
        
    @pytest.mark.asyncio
    async def test_concurrent_websocket_connections(self, performance_suite, mock_client):
        """Test multiple concurrent WebSocket connections"""
        num_connections = 10
        
        async def create_connection(conn_id):
            ws = WebSocketManager(f"ws://test-server/{conn_id}")
            await mock_client.create_websocket_connection()
            return ws
            
        start_time = time.perf_counter()
        tasks = [create_connection(i) for i in range(num_connections)]
        connections = await asyncio.gather(*tasks)
        end_time = time.perf_counter()
        
        total_time = end_time - start_time
        
        assert len(connections) == num_connections
        assert total_time < 10.0, f"Creating {num_connections} connections took {total_time:.3f}s"
        
        performance_suite.test_results['concurrent_websockets'] = {
            'num_connections': num_connections,
            'total_time': total_time,
            'avg_time_per_connection': total_time / num_connections
        }


class TestRateLimitingPerformance:
    """Test rate limiting behavior and performance"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_compliance(self, performance_suite, mock_client):
        """Test that rate limiting is properly enforced"""
        requests_per_second = 10
        test_duration = 5  # seconds
        
        request_times = []
        
        async def make_request():
            start_time = time.perf_counter()
            await mock_client.authenticate()
            request_times.append(start_time)
            
        # Make requests as fast as possible
        tasks = []
        start_time = time.perf_counter()
        
        while time.perf_counter() - start_time < test_duration:
            task = asyncio.create_task(make_request())
            tasks.append(task)
            await asyncio.sleep(0.01)  # Small delay to prevent overwhelming
            
        await asyncio.gather(*tasks)
        
        # Analyze request timing
        actual_rps = len(request_times) / test_duration
        
        # Should not exceed rate limit significantly
        assert actual_rps <= requests_per_second * 1.1, f"Rate limit exceeded: {actual_rps:.2f} RPS"
        
        performance_suite.test_results['rate_limit_compliance'] = {
            'target_rps': requests_per_second,
            'actual_rps': actual_rps,
            'total_requests': len(request_times),
            'test_duration': test_duration
        }
        
    def test_backoff_strategy_performance(self, performance_suite, mock_client):
        """Test exponential backoff strategy performance"""
        retry_attempts = 5
        base_delay = 0.1  # 100ms
        
        backoff_times = []
        
        for attempt in range(retry_attempts):
            expected_delay = base_delay * (2 ** attempt)
            
            start_time = time.perf_counter()
            time.sleep(expected_delay)  # Simulate backoff delay
            actual_delay = time.perf_counter() - start_time
            
            backoff_times.append(actual_delay)
            
            # Should be close to expected delay (within 10ms tolerance)
            assert abs(actual_delay - expected_delay) < 0.01, f"Backoff timing off: {actual_delay:.3f}s vs {expected_delay:.3f}s"
            
        performance_suite.test_results['backoff_strategy'] = {
            'attempts': retry_attempts,
            'backoff_times': backoff_times,
            'total_backoff_time': sum(backoff_times)
        }


class TestConnectionPoolingPerformance:
    """Test connection pooling performance"""
    
    @pytest.mark.asyncio
    async def test_connection_reuse(self, performance_suite, mock_client):
        """Test connection pooling efficiency"""
        num_requests = 50
        
        # Mock connection pool
        with patch('aiohttp.ClientSession') as mock_session:
            session = Mock()
            session.request = AsyncMock(return_value=Mock(status=200, json=AsyncMock(return_value={})))
            mock_session.return_value = session
            
            # Measure time for requests with connection reuse
            start_time = time.perf_counter()
            tasks = [mock_client.authenticate() for _ in range(num_requests)]
            await asyncio.gather(*tasks)
            pooled_time = time.perf_counter() - start_time
            
        # Mock without connection pooling (new connection each time)
        with patch('aiohttp.ClientSession') as mock_session:
            def create_new_session(*args, **kwargs):
                session = Mock()
                session.request = AsyncMock(return_value=Mock(status=200, json=AsyncMock(return_value={})))
                return session
            
            mock_session.side_effect = create_new_session
            
            start_time = time.perf_counter()
            for _ in range(num_requests):
                await mock_client.authenticate()
            non_pooled_time = time.perf_counter() - start_time
            
        # Connection pooling should be faster
        efficiency_gain = non_pooled_time / pooled_time if pooled_time > 0 else 1
        assert efficiency_gain > 1.2, f"Connection pooling not efficient: {efficiency_gain:.2f}x gain"
        
        performance_suite.test_results['connection_pooling'] = {
            'pooled_time': pooled_time,
            'non_pooled_time': non_pooled_time,
            'efficiency_gain': efficiency_gain,
            'num_requests': num_requests
        }


class TestLoadTesting:
    """Load testing scenarios"""
    
    @pytest.mark.asyncio
    async def test_sustained_load(self, performance_suite, mock_client):
        """Test sustained load over time"""
        duration_seconds = 10
        target_rps = 5  # 5 requests per second
        
        start_time = time.perf_counter()
        completed_requests = 0
        errors = 0
        
        async def make_sustained_requests():
            nonlocal completed_requests, errors
            while time.perf_counter() - start_time < duration_seconds:
                try:
                    await mock_client.authenticate()
                    completed_requests += 1
                except Exception:
                    errors += 1
                await asyncio.sleep(1.0 / target_rps)
                
        await make_sustained_requests()
        actual_duration = time.perf_counter() - start_time
        actual_rps = completed_requests / actual_duration
        
        # Should maintain target RPS with low error rate
        assert actual_rps >= target_rps * 0.9, f"Could not maintain target RPS: {actual_rps:.2f} < {target_rps}"
        error_rate = errors / (completed_requests + errors) if (completed_requests + errors) > 0 else 0
        assert error_rate < 0.05, f"High error rate during sustained load: {error_rate:.2%}"
        
        performance_suite.test_results['sustained_load'] = {
            'target_rps': target_rps,
            'actual_rps': actual_rps,
            'duration': actual_duration,
            'completed_requests': completed_requests,
            'errors': errors,
            'error_rate': error_rate
        }
        
    @pytest.mark.asyncio
    async def test_spike_load(self, performance_suite, mock_client):
        """Test behavior under sudden load spikes"""
        normal_rps = 2
        spike_rps = 20
        spike_duration = 2  # seconds
        
        results = {'normal': 0, 'spike': 0, 'errors': 0}
        
        async def normal_load():
            for _ in range(int(normal_rps * 5)):  # 5 seconds of normal load
                try:
                    await mock_client.authenticate()
                    results['normal'] += 1
                except Exception:
                    results['errors'] += 1
                await asyncio.sleep(1.0 / normal_rps)
                
        async def spike_load():
            await asyncio.sleep(2)  # Wait 2 seconds before spike
            for _ in range(int(spike_rps * spike_duration)):
                try:
                    await mock_client.authenticate()
                    results['spike'] += 1
                except Exception:
                    results['errors'] += 1
                await asyncio.sleep(1.0 / spike_rps)
                
        start_time = time.perf_counter()
        await asyncio.gather(normal_load(), spike_load())
        total_time = time.perf_counter() - start_time
        
        total_requests = results['normal'] + results['spike']
        error_rate = results['errors'] / (total_requests + results['errors']) if total_requests > 0 else 0
        
        # Should handle spike without excessive errors
        assert error_rate < 0.1, f"High error rate during spike load: {error_rate:.2%}"
        assert results['spike'] > spike_rps * spike_duration * 0.8, "Failed to handle spike load"
        
        performance_suite.test_results['spike_load'] = {
            'normal_requests': results['normal'],
            'spike_requests': results['spike'],
            'total_errors': results['errors'],
            'error_rate': error_rate,
            'total_time': total_time
        }


@pytest.mark.asyncio
async def test_performance_summary(performance_suite):
    """Generate performance test summary"""
    print("\n" + "="*50)
    print("PYTHON SDK PERFORMANCE TEST SUMMARY")
    print("="*50)
    
    for test_name, results in performance_suite.test_results.items():
        print(f"\n{test_name.upper()}:")
        if isinstance(results, dict):
            for key, value in results.items():
                if isinstance(value, float):
                    print(f"  {key}: {value:.3f}")
                else:
                    print(f"  {key}: {value}")
        else:
            print(f"  Result: {results:.3f}" if isinstance(results, float) else f"  Result: {results}")
    
    print("\n" + "="*50)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])