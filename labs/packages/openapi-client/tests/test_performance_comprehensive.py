"""
Comprehensive Performance Tests for OpenAPI Client

This module contains performance tests covering:
- API request response times
- Concurrent request handling
- Connection pooling efficiency
- Serialization/deserialization performance
- Memory usage during operations
- Schema validation performance
- Client initialization overhead
"""

import asyncio
import time
import threading
import psutil
import statistics
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import pytest
import pytest_asyncio
from typing import List, Dict, Any, Optional
import gc
import tracemalloc
import aiohttp
import requests

# Mock OpenAPI client imports
try:
    from openapi_client import ApiClient, Configuration, DefaultApi
    from openapi_client.models import *
    from openapi_client.exceptions import ApiException
except ImportError:
    # Mock imports for testing
    class Configuration:
        def __init__(self, *args, **kwargs):
            self.host = kwargs.get('host', 'https://api.example.com')
            self.api_key = kwargs.get('api_key', {})
    
    class ApiClient:
        def __init__(self, configuration=None):
            self.configuration = configuration or Configuration()
            self.rest_client = None
    
    class DefaultApi:
        def __init__(self, api_client=None):
            self.api_client = api_client or ApiClient()
    
    class ApiException(Exception):
        def __init__(self, status=None, reason=None, http_resp=None):
            self.status = status
            self.reason = reason
            self.http_resp = http_resp


class OpenAPIPerformanceTestSuite:
    """Comprehensive performance testing suite for OpenAPI client"""
    
    def __init__(self):
        self.api_client = None
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
    """Create OpenAPI performance test suite fixture"""
    suite = OpenAPIPerformanceTestSuite()
    suite.setup_memory_tracking()
    yield suite
    # Cleanup
    tracemalloc.stop()


@pytest.fixture
def mock_api_client():
    """Create mock API client for performance testing"""
    config = Configuration(
        host='https://api.example.com',
        api_key={'ApiKeyAuth': 'test-api-key'}
    )
    
    client = Mock(spec=ApiClient)
    client.configuration = config
    
    # Mock HTTP responses
    def create_mock_response(status_code=200, data=None, headers=None):
        response = Mock()
        response.status_code = status_code
        response.status = status_code
        response.headers = headers or {'Content-Type': 'application/json'}
        response.json.return_value = data or {'status': 'success', 'data': 'test'}
        response.text = json.dumps(data or {'status': 'success', 'data': 'test'})
        response.content = response.text.encode('utf-8')
        return response
    
    # Mock synchronous requests
    def mock_request(method, url, **kwargs):
        # Simulate network latency
        time.sleep(0.01 + len(kwargs.get('json', {})) * 0.0001 if kwargs.get('json') else 0.01)
        return create_mock_response()
    
    # Mock asynchronous requests
    async def mock_async_request(method, url, **kwargs):
        # Simulate network latency
        await asyncio.sleep(0.01 + len(kwargs.get('json', {})) * 0.0001 if kwargs.get('json') else 0.01)
        return create_mock_response()
    
    client.call_api = Mock(side_effect=mock_request)
    client.call_api_async = AsyncMock(side_effect=mock_async_request)
    
    return client


@pytest.fixture
def mock_default_api(mock_api_client):
    """Create mock Default API for performance testing"""
    api = Mock(spec=DefaultApi)
    api.api_client = mock_api_client
    
    # Mock common API operations
    def mock_get_operation(*args, **kwargs):
        time.sleep(0.02)  # Simulate processing time
        return {'id': 'test-123', 'data': 'test response', 'timestamp': time.time()}
    
    def mock_post_operation(body=None, **kwargs):
        time.sleep(0.05)  # POST operations take longer
        return {'id': 'created-456', 'status': 'created', 'data': body}
    
    def mock_put_operation(id, body=None, **kwargs):
        time.sleep(0.03)
        return {'id': id, 'status': 'updated', 'data': body}
    
    def mock_delete_operation(id, **kwargs):
        time.sleep(0.02)
        return {'id': id, 'status': 'deleted'}
    
    async def mock_async_get_operation(*args, **kwargs):
        await asyncio.sleep(0.02)
        return {'id': 'test-123', 'data': 'async test response', 'timestamp': time.time()}
    
    async def mock_async_post_operation(body=None, **kwargs):
        await asyncio.sleep(0.05)
        return {'id': 'async-created-456', 'status': 'created', 'data': body}
    
    # Assign mock methods
    api.get_resource = Mock(side_effect=mock_get_operation)
    api.create_resource = Mock(side_effect=mock_post_operation)
    api.update_resource = Mock(side_effect=mock_put_operation)
    api.delete_resource = Mock(side_effect=mock_delete_operation)
    
    api.get_resource_async = AsyncMock(side_effect=mock_async_get_operation)
    api.create_resource_async = AsyncMock(side_effect=mock_async_post_operation)
    api.update_resource_async = AsyncMock(side_effect=mock_put_operation)
    api.delete_resource_async = AsyncMock(side_effect=mock_delete_operation)
    
    return api


class TestClientInitializationPerformance:
    """Test OpenAPI client initialization performance"""
    
    def test_client_initialization_time(self, performance_suite):
        """Test client initialization overhead"""
        initialization_times = []
        
        for _ in range(10):
            _, init_time = performance_suite.measure_execution_time(
                lambda: ApiClient(Configuration(host='https://api.example.com'))
            )
            initialization_times.append(init_time)
        
        avg_init_time = statistics.mean(initialization_times)
        max_init_time = max(initialization_times)
        
        # Client initialization should be fast
        assert avg_init_time < 0.01, f"Average client init time {avg_init_time:.3f}s too slow"
        assert max_init_time < 0.05, f"Max client init time {max_init_time:.3f}s too slow"
        
        performance_suite.test_results['client_initialization'] = {
            'avg_init_time': avg_init_time,
            'max_init_time': max_init_time,
            'min_init_time': min(initialization_times),
            'init_times': initialization_times
        }
    
    def test_configuration_loading_performance(self, performance_suite):
        """Test configuration object creation performance"""
        config_params = {
            'host': 'https://api.example.com',
            'api_key': {'ApiKeyAuth': 'very-long-api-key-' + 'x' * 100},
            'username': 'test-user',
            'password': 'test-password',
            'access_token': 'access-token-' + 'y' * 200,
            'refresh_token': 'refresh-token-' + 'z' * 150,
            'debug': True,
            'verify_ssl': True,
            'ssl_ca_cert': '/path/to/ca/cert.pem',
            'cert_file': '/path/to/cert.pem',
            'key_file': '/path/to/key.pem',
            'assert_hostname': True,
            'connection_pool_maxsize': 50,
            'proxy': 'http://proxy.example.com:8080',
            'proxy_headers': {'Proxy-Authorization': 'Bearer token'},
            'safe_chars_for_path_param': ':/?#[]@!$&\'()*+,;=',
            'retries': 3,
            'timeout': 30
        }
        
        _, config_time = performance_suite.measure_execution_time(
            lambda: Configuration(**config_params)
        )
        
        # Configuration should load quickly even with many parameters
        assert config_time < 0.001, f"Configuration loading took {config_time:.3f}s"
        
        performance_suite.test_results['configuration_loading'] = {
            'config_time': config_time,
            'num_parameters': len(config_params)
        }


class TestAPIRequestPerformance:
    """Test API request performance"""
    
    def test_single_request_response_time(self, performance_suite, mock_default_api):
        """Test single API request response time"""
        request_types = [
            ('GET', mock_default_api.get_resource),
            ('POST', lambda: mock_default_api.create_resource({'data': 'test'})),
            ('PUT', lambda: mock_default_api.update_resource('123', {'data': 'updated'})),
            ('DELETE', lambda: mock_default_api.delete_resource('123'))
        ]
        
        for method, request_func in request_types:
            _, response_time = performance_suite.measure_execution_time(request_func)
            
            # Different methods have different acceptable response times
            max_time = 0.1 if method == 'POST' else 0.05
            assert response_time < max_time, f"{method} request took {response_time:.3f}s, expected < {max_time}s"
            
            performance_suite.test_results[f'{method.lower()}_response_time'] = {
                'method': method,
                'response_time': response_time,
                'acceptable': response_time < max_time
            }
    
    @pytest.mark.asyncio
    async def test_async_request_performance(self, performance_suite, mock_default_api):
        """Test async API request performance"""
        async_requests = [
            ('GET', mock_default_api.get_resource_async),
            ('POST', lambda: mock_default_api.create_resource_async({'data': 'async test'}))
        ]
        
        for method, request_func in async_requests:
            _, response_time = await performance_suite.measure_async_execution_time(request_func)
            
            max_time = 0.1
            assert response_time < max_time, f"Async {method} took {response_time:.3f}s, expected < {max_time}s"
            
            performance_suite.test_results[f'async_{method.lower()}_response_time'] = {
                'method': f'Async {method}',
                'response_time': response_time,
                'acceptable': response_time < max_time
            }
    
    def test_concurrent_requests(self, performance_suite, mock_default_api):
        """Test concurrent API requests performance"""
        num_requests = 50
        
        start_time = time.perf_counter()
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(mock_default_api.get_resource, f'resource-{i}')
                for i in range(num_requests)
            ]
            
            results = []
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=30)
                    results.append(result)
                except Exception as e:
                    results.append({'error': str(e)})
        
        total_time = time.perf_counter() - start_time
        successful_requests = len([r for r in results if 'error' not in r])
        requests_per_second = successful_requests / total_time
        
        assert len(results) == num_requests
        assert requests_per_second > 20, f"Request rate {requests_per_second:.2f}/s too slow"
        assert successful_requests >= num_requests * 0.95, "Too many failed requests"
        
        performance_suite.test_results['concurrent_requests'] = {
            'total_requests': num_requests,
            'successful_requests': successful_requests,
            'total_time': total_time,
            'requests_per_second': requests_per_second,
            'success_rate': successful_requests / num_requests
        }
    
    @pytest.mark.asyncio
    async def test_concurrent_async_requests(self, performance_suite, mock_default_api):
        """Test concurrent async API requests performance"""
        num_requests = 100
        
        async def make_request(request_id):
            return await mock_default_api.get_resource_async(f'async-resource-{request_id}')
        
        start_time = time.perf_counter()
        tasks = [make_request(i) for i in range(num_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.perf_counter() - start_time
        
        successful_requests = len([r for r in results if not isinstance(r, Exception)])
        requests_per_second = successful_requests / total_time
        
        assert successful_requests >= num_requests * 0.95
        assert requests_per_second > 50, f"Async request rate {requests_per_second:.2f}/s too slow"
        
        performance_suite.test_results['concurrent_async_requests'] = {
            'total_requests': num_requests,
            'successful_requests': successful_requests,
            'total_time': total_time,
            'requests_per_second': requests_per_second
        }


class TestSerializationPerformance:
    """Test serialization/deserialization performance"""
    
    def test_json_serialization_performance(self, performance_suite):
        """Test JSON serialization/deserialization performance"""
        # Create test data of various sizes
        test_data_sets = {
            'small': {'id': 123, 'name': 'test', 'active': True},
            'medium': {
                'id': 123,
                'items': [{'id': i, 'value': f'item_{i}'} for i in range(100)],
                'metadata': {f'key_{i}': f'value_{i}' for i in range(50)}
            },
            'large': {
                'dataset': [
                    {
                        'id': i,
                        'data': [j for j in range(100)],
                        'text': 'Lorem ipsum ' * 50,
                        'nested': {
                            'level1': {
                                'level2': {f'item_{k}': k for k in range(20)}
                            }
                        }
                    }
                    for i in range(100)
                ]
            }
        }
        
        for size_name, test_data in test_data_sets.items():
            # Test serialization
            _, serialization_time = performance_suite.measure_execution_time(
                json.dumps, test_data
            )
            
            # Test deserialization
            json_str = json.dumps(test_data)
            _, deserialization_time = performance_suite.measure_execution_time(
                json.loads, json_str
            )
            
            data_size_bytes = len(json_str.encode('utf-8'))
            serialization_mbps = data_size_bytes / serialization_time / 1024 / 1024 if serialization_time > 0 else float('inf')
            deserialization_mbps = data_size_bytes / deserialization_time / 1024 / 1024 if deserialization_time > 0 else float('inf')
            
            # Should maintain good throughput
            min_throughput = 1.0  # 1 MB/s minimum
            assert serialization_mbps > min_throughput, f"Serialization too slow: {serialization_mbps:.2f} MB/s"
            assert deserialization_mbps > min_throughput, f"Deserialization too slow: {deserialization_mbps:.2f} MB/s"
            
            performance_suite.test_results[f'json_{size_name}_serialization'] = {
                'size': size_name,
                'data_size_bytes': data_size_bytes,
                'serialization_time': serialization_time,
                'deserialization_time': deserialization_time,
                'serialization_mbps': serialization_mbps,
                'deserialization_mbps': deserialization_mbps
            }
    
    def test_model_object_serialization(self, performance_suite):
        """Test OpenAPI model object serialization performance"""
        # Mock model classes
        class MockModel:
            def __init__(self, **kwargs):
                self.data = kwargs
                
            def to_dict(self):
                return self.data
                
            @classmethod
            def from_dict(cls, data):
                return cls(**data)
        
        # Create model instances
        num_models = 1000
        models = [
            MockModel(
                id=i,
                name=f'model_{i}',
                value=i * 2,
                active=i % 2 == 0,
                tags=[f'tag_{j}' for j in range(5)]
            )
            for i in range(num_models)
        ]
        
        # Test model serialization
        _, serialization_time = performance_suite.measure_execution_time(
            lambda: [model.to_dict() for model in models]
        )
        
        # Test model deserialization
        model_dicts = [model.to_dict() for model in models]
        _, deserialization_time = performance_suite.measure_execution_time(
            lambda: [MockModel.from_dict(data) for data in model_dicts]
        )
        
        models_per_second_serialize = num_models / serialization_time if serialization_time > 0 else float('inf')
        models_per_second_deserialize = num_models / deserialization_time if deserialization_time > 0 else float('inf')
        
        # Should handle many models per second
        min_rate = 1000  # 1000 models/second minimum
        assert models_per_second_serialize > min_rate, f"Model serialization rate {models_per_second_serialize:.2f}/s too slow"
        assert models_per_second_deserialize > min_rate, f"Model deserialization rate {models_per_second_deserialize:.2f}/s too slow"
        
        performance_suite.test_results['model_serialization'] = {
            'num_models': num_models,
            'serialization_time': serialization_time,
            'deserialization_time': deserialization_time,
            'serialize_rate': models_per_second_serialize,
            'deserialize_rate': models_per_second_deserialize
        }


class TestConnectionPoolingPerformance:
    """Test connection pooling performance"""
    
    def test_connection_reuse_efficiency(self, performance_suite, mock_api_client):
        """Test connection pooling efficiency"""
        num_requests = 100
        
        # Mock connection pooling behavior
        with patch('requests.Session') as mock_session_class:
            session = Mock()
            session.request = Mock(return_value=Mock(
                status_code=200,
                headers={'Content-Type': 'application/json'},
                json=Mock(return_value={'status': 'success'}),
                text='{"status": "success"}'
            ))
            mock_session_class.return_value = session
            
            # Test with connection pooling (reused session)
            start_time = time.perf_counter()
            for i in range(num_requests):
                mock_api_client.call_api(
                    method='GET',
                    url=f'/api/resource/{i}',
                    header_params={},
                    query_params={},
                    body=None,
                    response_type='object'
                )
            pooled_time = time.perf_counter() - start_time
        
        # Test without connection pooling (new session each time)
        with patch('requests.request') as mock_request:
            mock_request.return_value = Mock(
                status_code=200,
                headers={'Content-Type': 'application/json'},
                json=Mock(return_value={'status': 'success'}),
                text='{"status": "success"}'
            )
            
            start_time = time.perf_counter()
            for i in range(num_requests):
                mock_api_client.call_api(
                    method='GET',
                    url=f'/api/resource/{i}',
                    header_params={},
                    query_params={},
                    body=None,
                    response_type='object'
                )
            non_pooled_time = time.perf_counter() - start_time
        
        efficiency_gain = non_pooled_time / pooled_time if pooled_time > 0 else 1
        
        # Connection pooling should provide improvement
        assert efficiency_gain > 1.1, f"Connection pooling not efficient: {efficiency_gain:.2f}x gain"
        
        performance_suite.test_results['connection_pooling'] = {
            'pooled_time': pooled_time,
            'non_pooled_time': non_pooled_time,
            'efficiency_gain': efficiency_gain,
            'num_requests': num_requests
        }


class TestMemoryPerformance:
    """Test memory usage during operations"""
    
    def test_memory_usage_during_bulk_operations(self, performance_suite, mock_default_api):
        """Test memory usage during bulk API operations"""
        initial_memory = performance_suite.get_memory_usage()
        
        # Perform bulk operations
        num_operations = 1000
        results = []
        
        for i in range(num_operations):
            # Create large request data
            large_data = {
                'id': i,
                'data': [j for j in range(100)],
                'text': 'Large text data ' * 100,
                'metadata': {f'key_{k}': f'value_{k}' for k in range(50)}
            }
            
            result = mock_default_api.create_resource(large_data)
            results.append(result)
            
            # Periodic memory check
            if i % 100 == 0:
                current_memory = performance_suite.get_memory_usage()
                memory_increase = current_memory - initial_memory
                memory_increase_mb = memory_increase / 1024 / 1024
                
                # Memory should not grow unbounded
                max_allowed_increase = 100  # 100MB max
                assert memory_increase_mb < max_allowed_increase, \
                    f"Memory leak detected: {memory_increase_mb:.2f}MB increase after {i} operations"
        
        # Force garbage collection
        gc.collect()
        final_memory = performance_suite.get_memory_usage()
        total_memory_increase = final_memory - initial_memory
        
        performance_suite.test_results['bulk_operations_memory'] = {
            'operations': num_operations,
            'initial_memory_mb': initial_memory / 1024 / 1024,
            'final_memory_mb': final_memory / 1024 / 1024,
            'memory_increase_mb': total_memory_increase / 1024 / 1024,
            'results_count': len(results)
        }
    
    def test_client_cleanup_efficiency(self, performance_suite):
        """Test client cleanup and resource release"""
        initial_memory = performance_suite.get_memory_usage()
        clients = []
        
        # Create multiple clients
        num_clients = 50
        for i in range(num_clients):
            config = Configuration(
                host=f'https://api-{i}.example.com',
                api_key={'ApiKeyAuth': f'key-{i}'}
            )
            client = ApiClient(config)
            clients.append(client)
        
        after_creation_memory = performance_suite.get_memory_usage()
        
        # Clean up clients
        clients.clear()
        gc.collect()
        
        after_cleanup_memory = performance_suite.get_memory_usage()
        
        creation_memory_increase = after_creation_memory - initial_memory
        cleanup_efficiency = (after_creation_memory - after_cleanup_memory) / creation_memory_increase if creation_memory_increase > 0 else 0
        
        # Should clean up most of the allocated memory
        assert cleanup_efficiency > 0.8, f"Poor cleanup efficiency: {cleanup_efficiency:.2f}"
        
        performance_suite.test_results['client_cleanup'] = {
            'num_clients': num_clients,
            'initial_memory_mb': initial_memory / 1024 / 1024,
            'after_creation_mb': after_creation_memory / 1024 / 1024,
            'after_cleanup_mb': after_cleanup_memory / 1024 / 1024,
            'cleanup_efficiency': cleanup_efficiency
        }


class TestRateLimitingPerformance:
    """Test rate limiting behavior and performance"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_handling(self, performance_suite, mock_default_api):
        """Test rate limiting behavior"""
        requests_per_second = 10
        test_duration = 5  # seconds
        
        request_times = []
        rate_limit_errors = 0
        
        async def make_rate_limited_request():
            nonlocal rate_limit_errors
            try:
                # Simulate rate limiting by occasionally throwing exceptions
                if len(request_times) > requests_per_second * 2 and len(request_times) % 15 == 0:
                    raise ApiException(status=429, reason="Rate limit exceeded")
                
                start_time = time.perf_counter()
                result = await mock_default_api.get_resource_async('test')
                request_times.append(start_time)
                return result
            except ApiException as e:
                if e.status == 429:
                    rate_limit_errors += 1
                    # Simulate backoff
                    await asyncio.sleep(0.5)
                raise
        
        # Make requests for specified duration
        start_time = time.perf_counter()
        tasks = []
        
        while time.perf_counter() - start_time < test_duration:
            task = asyncio.create_task(make_rate_limited_request())
            tasks.append(task)
            await asyncio.sleep(1 / requests_per_second)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful_requests = len([r for r in results if not isinstance(r, Exception)])
        actual_rps = successful_requests / test_duration
        
        # Should handle rate limiting gracefully
        assert rate_limit_errors < len(tasks) * 0.2, "Too many rate limit errors"
        assert successful_requests > 0, "No successful requests"
        
        performance_suite.test_results['rate_limit_handling'] = {
            'target_rps': requests_per_second,
            'actual_rps': actual_rps,
            'total_requests': len(tasks),
            'successful_requests': successful_requests,
            'rate_limit_errors': rate_limit_errors,
            'test_duration': test_duration
        }


@pytest.mark.asyncio
async def test_performance_summary(performance_suite):
    """Generate comprehensive OpenAPI client performance test summary"""
    print("\n" + "="*60)
    print("OPENAPI CLIENT PERFORMANCE TEST SUMMARY")
    print("="*60)
    
    # System information
    cpu_count = psutil.cpu_count()
    memory = psutil.virtual_memory()
    
    print(f"\nSYSTEM INFORMATION:")
    print(f"  CPU Cores: {cpu_count}")
    print(f"  Total Memory: {memory.total / 1024 / 1024 / 1024:.2f} GB")
    print(f"  Available Memory: {memory.available / 1024 / 1024 / 1024:.2f} GB")
    print(f"  Memory Usage: {memory.percent:.1f}%")
    
    # Test results
    for test_name, results in performance_suite.test_results.items():
        print(f"\n{test_name.upper().replace('_', ' ')}:")
        if isinstance(results, dict):
            for key, value in results.items():
                if isinstance(value, float):
                    if 'time' in key.lower() or 'duration' in key.lower():
                        print(f"  {key}: {value:.3f}s")
                    elif 'mbps' in key.lower() or 'throughput' in key.lower():
                        print(f"  {key}: {value:.2f} MB/s")
                    elif 'per_second' in key.lower() or '_rate' in key.lower():
                        print(f"  {key}: {value:.2f}/s")
                    elif 'memory' in key.lower() and 'mb' in key.lower():
                        print(f"  {key}: {value:.2f} MB")
                    elif 'ratio' in key.lower() or 'efficiency' in key.lower() or 'gain' in key.lower():
                        print(f"  {key}: {value:.2f}x")
                    else:
                        print(f"  {key}: {value:.3f}")
                else:
                    print(f"  {key}: {value}")
        else:
            print(f"  Result: {results:.3f}" if isinstance(results, float) else f"  Result: {results}")
    
    print("\n" + "="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])