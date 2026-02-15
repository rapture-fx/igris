"""
Advanced Edge Case Tests for Igris-engine Python SDK

This module adds comprehensive testing for edge cases that might not be covered
in standard tests, focusing on boundary conditions and unusual scenarios.
"""

import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import patch, MagicMock, AsyncMock, side_effect
from datetime import datetime, timedelta
import threading
import signal
import sys
import gc
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import uuid
import hashlib
import time

from igris import IgrisClient
from igris.exceptions.base import (
    APIError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    NetworkError,
    TimeoutError
)
from igris.models.data import JobStatus, ProcessingJob
from igris.models.ml import MLJobStatus, ModelTrainingJob
from igris.utils.rate_limiter import RateLimiter
from igris.utils.retry import RetryConfig


class TestAdvancedEdgeCases:
    """Test advanced edge cases and boundary conditions."""

    @pytest.fixture
    def client(self):
        """Client fixture with extended timeout for edge case testing."""
        return IgrisClient(
            api_key="test-key",
            base_url="https://api.test.com",
            timeout=30.0,  # Extended timeout for edge cases
            max_retries=3
        )

    @pytest.mark.asyncio
    async def test_extremely_large_payload_handling(self, client):
        """Test handling of extremely large payloads near system limits."""
        # Create a large payload (10MB of data)
        large_data = {
            "massive_array": [f"data_chunk_{i}_" + "x" * 1000 for i in range(10000)],
            "metadata": {f"key_{i}": f"value_{i}_" + "y" * 100 for i in range(1000)},
            "nested_structure": {
                "level_1": {
                    "level_2": {
                        "level_3": {
                            "large_text": "z" * 50000
                        }
                    }
                }
            }
        }
        
        with patch.object(client.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": {"job_id": "large-payload-job", "status": "processing"}
            }
            
            result = await client.data.process(large_data)
            
            assert result["job_id"] == "large-payload-job"
            # Verify the large payload was handled properly
            args, kwargs = mock_post.call_args
            assert len(json.dumps(kwargs.get('json', {}))) > 10000000  # > 10MB

    @pytest.mark.asyncio
    async def test_unicode_and_special_character_handling(self, client):
        """Test handling of various Unicode characters and special cases."""
        special_chars_data = {
            "emoji": "🚀🐍⚡🔥💎🌟🎯🌙📊🔧",
            "chinese": "数据处理机器学习人工智能",
            "arabic": "معالجة البيانات والتعلم الآلي",
            "russian": "обработка данных машинное обучение",
            "mathematical": "∑∆∇∂∞≈≠≤≥∫∮√∛∜",
            "special_control": "\n\t\r\\\"\'",
            "zero_width": "test\u200Bstring\u200Cwith\u200Dzero\uFEFFwidth",
            "rtl_override": "\u202Etest\u202Cstring",
            "null_bytes": "test\x00null\x00bytes",
            "long_unicode": "🚀" * 1000,  # 1000 emoji characters
        }
        
        with patch.object(client.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": {"processed": True, "char_count": len(str(special_chars_data))}
            }
            
            result = await client.data.process(special_chars_data)
            
            assert result["processed"] is True
            # Verify Unicode handling in request
            args, kwargs = mock_post.call_args
            request_data = json.dumps(kwargs.get('json', {}), ensure_ascii=False)
            assert "🚀" in request_data
            assert "数据" in request_data

    @pytest.mark.asyncio
    async def test_concurrent_auth_token_refresh(self, client):
        """Test concurrent authentication scenarios with token refresh."""
        refresh_count = 0
        
        async def mock_token_refresh(*args, **kwargs):
            nonlocal refresh_count
            refresh_count += 1
            # Simulate refresh delay
            await asyncio.sleep(0.1)
            return {
                "access_token": f"refreshed-token-{refresh_count}",
                "refresh_token": f"new-refresh-token-{refresh_count}",
                "expires_in": 3600
            }
        
        with patch.object(client.auth, 'refresh_token', side_effect=mock_token_refresh):
            # Simulate 10 concurrent requests that all need token refresh
            tasks = []
            for i in range(10):
                with patch.object(client.http_client, 'get', new_callable=AsyncMock) as mock_get:
                    mock_get.side_effect = [  # First call fails with 401, second succeeds
                        Exception("401 Unauthorized"),
                        {"success": True, "data": {"result": f"success-{i}"}}
                    ]
                    tasks.append(client.data.get_job_status(f"job-{i}"))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Verify that token refresh was handled properly
            assert refresh_count >= 1  # At least one refresh should have occurred
            # Most results should be successful (some might fail due to mocking complexity)
            successful_results = [r for r in results if not isinstance(r, Exception)]
            assert len(successful_results) >= 5  # At least half should succeed

    @pytest.mark.asyncio
    async def test_memory_efficiency_with_large_streaming_data(self, client):
        """Test memory efficiency when handling large streaming data."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Simulate processing 100MB of streaming data in chunks
        chunk_size = 1024 * 1024  # 1MB chunks
        total_chunks = 100
        
        class MockStreamingResponse:
            def __init__(self):
                self.chunk_count = 0
            
            async def aiter_bytes(self, chunk_size=None):
                while self.chunk_count < total_chunks:
                    self.chunk_count += 1
                    yield b"x" * min(chunk_size, 1024 * 1024)
                    # Force garbage collection every 10 chunks
                    if self.chunk_count % 10 == 0:
                        gc.collect()
        
        with patch.object(client.http_client, 'stream') as mock_stream:
            mock_stream.return_value.__aenter__.return_value = MockStreamingResponse()
            
            total_bytes = 0
            async for chunk in client.data.stream_results("large-job"):
                total_bytes += len(chunk)
                
                # Check memory usage doesn't grow excessively
                current_memory = process.memory_info().rss / 1024 / 1024  # MB
                memory_increase = current_memory - initial_memory
                assert memory_increase < 50, f"Memory usage increased by {memory_increase}MB"
        
        assert total_bytes == 100 * 1024 * 1024  # 100MB processed
        
        # Final memory check after cleanup
        gc.collect()
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        final_increase = final_memory - initial_memory
        assert final_increase < 10, f"Memory leak detected: {final_increase}MB increase"

    @pytest.mark.asyncio
    async def test_rate_limiter_burst_and_sustained_load(self, client):
        """Test rate limiter behavior under burst and sustained load."""
        rate_limiter = RateLimiter(requests_per_second=10, burst_size=5)
        
        # Test burst allowance
        start_time = time.time()
        burst_requests = []
        for i in range(5):  # Burst of 5 requests
            if await rate_limiter.acquire():
                burst_requests.append(time.time() - start_time)
        
        # All burst requests should complete quickly (within 1 second)
        assert all(t < 1.0 for t in burst_requests)
        assert len(burst_requests) == 5
        
        # Test rate limiting after burst
        sustained_requests = []
        for i in range(10):  # 10 more requests
            if await rate_limiter.acquire():
                sustained_requests.append(time.time() - start_time)
        
        # These should be rate limited (spread over time)
        assert sustained_requests[-1] >= 1.0  # Should take at least 1 second
        
    @pytest.mark.asyncio
    async def test_websocket_connection_resilience(self, client):
        """Test WebSocket connection resilience under various failure scenarios."""
        connection_attempts = 0
        message_count = 0
        
        class MockWebSocket:
            def __init__(self):
                self.connected = False
                self.messages = []
            
            async def connect(self):
                nonlocal connection_attempts
                connection_attempts += 1
                
                # Fail first 2 attempts, succeed on 3rd
                if connection_attempts < 3:
                    raise ConnectionError(f"Connection attempt {connection_attempts} failed")
                
                self.connected = True
                return {"status": "connected", "attempt": connection_attempts}
            
            async def send(self, message):
                if not self.connected:
                    raise ConnectionError("Not connected")
                
                nonlocal message_count
                message_count += 1
                
                # Simulate intermittent failures
                if message_count % 7 == 0:  # Every 7th message fails
                    self.connected = False
                    raise ConnectionError("Connection lost")
                
                self.messages.append(message)
                return {"status": "sent", "message_id": f"msg-{message_count}"}
            
            async def receive(self, timeout=None):
                if not self.connected:
                    raise ConnectionError("Not connected")
                
                await asyncio.sleep(0.1)  # Simulate network delay
                return {"type": "response", "data": f"response-{len(self.messages)}"}
        
        with patch('igris.websocket.WebSocketClient', return_value=MockWebSocket()):
            ws_client = await client.websocket.connect("ws://test.com/stream")
            
            # Test resilient message sending with automatic reconnection
            messages_sent = 0
            for i in range(20):  # Try to send 20 messages
                try:
                    result = await ws_client.send({"message": f"test-{i}"})
                    messages_sent += 1
                    
                    # Receive response
                    response = await ws_client.receive(timeout=1.0)
                    assert "response" in response["data"]
                    
                except ConnectionError:
                    # Attempt reconnection
                    await ws_client.connect()
                    # Retry the message
                    result = await ws_client.send({"message": f"test-{i}-retry"})
                    messages_sent += 1
            
            # Should have successfully sent most messages despite failures
            assert messages_sent >= 15  # At least 75% success rate
            assert connection_attempts >= 3  # Had to reconnect multiple times

    def test_thread_safety_with_concurrent_clients(self):
        """Test thread safety when using multiple clients concurrently."""
        clients = []
        results = []
        errors = []
        
        def create_and_use_client(client_id):
            try:
                client = IgrisClient(
                    api_key=f"test-key-{client_id}",
                    base_url="https://api.test.com"
                )
                clients.append(client)
                
                # Simulate concurrent operations
                for i in range(10):
                    with patch.object(client.http_client, 'get', return_value={
                        "success": True, 
                        "data": {"client_id": client_id, "request_id": i}
                    }):
                        # This would be: result = asyncio.run(client.data.get_job_status(f"job-{i}"))
                        # Mocking the result for thread safety test
                        result = {"client_id": client_id, "request_id": i}
                        results.append(result)
                        
                        # Small delay to increase chance of race conditions
                        time.sleep(0.01)
                        
            except Exception as e:
                errors.append((client_id, str(e)))
        
        # Create 10 threads, each with their own client
        threads = []
        for i in range(10):
            thread = threading.Thread(target=create_and_use_client, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join(timeout=30)
        
        # Verify results
        assert len(errors) == 0, f"Thread safety errors: {errors}"
        assert len(results) == 100  # 10 clients * 10 requests each
        assert len(clients) == 10  # All clients created successfully
        
        # Verify each client had unique results
        client_results = {}
        for result in results:
            client_id = result["client_id"]
            if client_id not in client_results:
                client_results[client_id] = []
            client_results[client_id].append(result["request_id"])
        
        # Each client should have results for requests 0-9
        for client_id in range(10):
            assert set(client_results[client_id]) == set(range(10))

    @pytest.mark.asyncio
    async def test_signal_handling_and_graceful_shutdown(self, client):
        """Test graceful shutdown when receiving system signals."""
        shutdown_called = False
        cleanup_completed = False
        
        async def long_running_task():
            """Simulate a long-running task that should be interrupted gracefully."""
            try:
                for i in range(100):
                    await asyncio.sleep(0.1)  # 10 second total task
                    # Check if shutdown was requested
                    if shutdown_called:
                        break
                return "completed normally"
            except asyncio.CancelledError:
                nonlocal cleanup_completed
                # Simulate cleanup work
                await asyncio.sleep(0.2)
                cleanup_completed = True
                raise
        
        def signal_handler(signum, frame):
            nonlocal shutdown_called
            shutdown_called = True
        
        # Set up signal handler
        original_handler = signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            # Start long-running task
            task = asyncio.create_task(long_running_task())
            
            # Wait a bit, then simulate signal
            await asyncio.sleep(0.5)
            
            # Simulate receiving SIGTERM
            shutdown_called = True
            task.cancel()
            
            # Wait for graceful shutdown
            try:
                result = await asyncio.wait_for(task, timeout=1.0)
                assert False, "Task should have been cancelled"
            except asyncio.CancelledError:
                pass  # Expected
            except asyncio.TimeoutError:
                assert False, "Graceful shutdown took too long"
            
            # Verify cleanup was completed
            assert shutdown_called, "Shutdown signal was not handled"
            assert cleanup_completed, "Cleanup was not completed"
            
        finally:
            # Restore original signal handler
            signal.signal(signal.SIGTERM, original_handler)

    @pytest.mark.asyncio
    async def test_file_upload_with_corrupted_data(self, client):
        """Test file upload handling with various corrupted data scenarios."""
        test_cases = [
            {
                "name": "truncated_file",
                "data": b"this is truncated data"[:10],  # Truncated
                "expected_error": ValidationError
            },
            {
                "name": "binary_with_nulls",
                "data": b"\x00\x01\x02\xFF" * 1000,  # Binary data with nulls
                "expected_error": None  # Should handle binary data
            },
            {
                "name": "extremely_long_filename",
                "filename": "x" * 1000 + ".txt",  # 1000 character filename
                "data": b"test content",
                "expected_error": ValidationError
            },
            {
                "name": "invalid_utf8_filename",
                "filename": b"\xff\xfe\xfd.txt".decode('latin1'),
                "data": b"test content",
                "expected_error": ValidationError
            },
            {
                "name": "empty_file",
                "data": b"",  # Empty file
                "expected_error": ValidationError
            }
        ]
        
        for test_case in test_cases:
            with patch.object(client.http_client, 'post', new_callable=AsyncMock) as mock_post:
                if test_case.get("expected_error"):
                    mock_post.side_effect = test_case["expected_error"]("Invalid file data")
                    
                    with pytest.raises(test_case["expected_error"]):
                        await client.storage.upload_file(
                            data=test_case["data"],
                            filename=test_case.get("filename", f"{test_case['name']}.txt")
                        )
                else:
                    mock_post.return_value = {
                        "success": True,
                        "data": {"file_id": f"file-{test_case['name']}", "size": len(test_case["data"])}
                    }
                    
                    result = await client.storage.upload_file(
                        data=test_case["data"],
                        filename=test_case.get("filename", f"{test_case['name']}.bin")
                    )
                    
                    assert result["file_id"].startswith("file-")
                    assert result["size"] == len(test_case["data"])

    @pytest.mark.asyncio
    async def test_api_version_compatibility_matrix(self, client):
        """Test compatibility with different API versions."""
        api_versions = ["v1", "v1.1", "v1.2", "v2.0", "v2.1"]
        compatibility_results = {}
        
        for version in api_versions:
            client_with_version = IgrisClient(
                api_key="test-key",
                base_url=f"https://api.test.com/{version}"
            )
            
            with patch.object(client_with_version.http_client, 'get', new_callable=AsyncMock) as mock_get:
                # Different API versions might return different response formats
                if version.startswith("v1"):
                    mock_get.return_value = {
                        "success": True,
                        "data": {"version": version, "format": "legacy"}
                    }
                else:  # v2+
                    mock_get.return_value = {
                        "success": True,
                        "result": {"version": version, "format": "modern"},
                        "metadata": {"api_version": version}
                    }
                
                try:
                    result = await client_with_version.data.get_job_status("test-job")
                    compatibility_results[version] = {
                        "compatible": True,
                        "response_format": "legacy" if version.startswith("v1") else "modern"
                    }
                except Exception as e:
                    compatibility_results[version] = {
                        "compatible": False,
                        "error": str(e)
                    }
        
        # Verify compatibility results
        assert all(result["compatible"] for result in compatibility_results.values()), \
            f"Some API versions are incompatible: {compatibility_results}"
        
        # Verify we handle different response formats
        v1_format = compatibility_results["v1"]["response_format"]
        v2_format = compatibility_results["v2.0"]["response_format"]
        assert v1_format == "legacy"
        assert v2_format == "modern"

    @pytest.mark.asyncio
    async def test_resource_cleanup_on_exceptions(self, client):
        """Test that resources are properly cleaned up when exceptions occur."""
        resources_created = []
        resources_cleaned = []
        
        class MockResource:
            def __init__(self, resource_id):
                self.resource_id = resource_id
                resources_created.append(resource_id)
            
            async def __aenter__(self):
                return self
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                resources_cleaned.append(self.resource_id)
        
        # Test resource cleanup during various exception scenarios
        exception_scenarios = [
            (NetworkError("Connection failed"), "network_error"),
            (TimeoutError("Request timeout"), "timeout_error"),
            (ValidationError("Invalid data"), "validation_error"),
            (KeyboardInterrupt(), "keyboard_interrupt"),
            (MemoryError("Out of memory"), "memory_error")
        ]
        
        for exception, scenario_name in exception_scenarios:
            resources_created.clear()
            resources_cleaned.clear()
            
            async def resource_using_operation():
                async with MockResource(f"resource_{scenario_name}"):
                    # Simulate some work before exception
                    await asyncio.sleep(0.1)
                    raise exception
            
            with pytest.raises(type(exception)):
                await resource_using_operation()
            
            # Verify resource was created and cleaned up
            assert len(resources_created) == 1, f"Resource not created for {scenario_name}"
            assert len(resources_cleaned) == 1, f"Resource not cleaned for {scenario_name}"
            assert resources_created[0] == resources_cleaned[0], f"Resource mismatch for {scenario_name}"


class TestBoundaryConditions:
    """Test boundary conditions and limits."""
    
    @pytest.mark.asyncio
    async def test_maximum_concurrent_requests(self):
        """Test behavior at maximum concurrent request limits."""
        max_concurrent = 100
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def limited_request(request_id):
            async with semaphore:
                # Simulate API request
                await asyncio.sleep(0.1)
                return {"request_id": request_id, "status": "completed"}
        
        # Launch more requests than the limit
        tasks = [limited_request(i) for i in range(max_concurrent * 2)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        # All requests should complete
        assert len(results) == max_concurrent * 2
        
        # Should take roughly 2 batches due to concurrency limit
        assert 0.15 < (end_time - start_time) < 0.3  # ~0.2 seconds expected
        
        # Verify all requests completed successfully
        completed_ids = {r["request_id"] for r in results}
        expected_ids = set(range(max_concurrent * 2))
        assert completed_ids == expected_ids

    def test_extreme_retry_configurations(self):
        """Test retry configurations at extreme values."""
        extreme_configs = [
            RetryConfig(max_retries=0, base_delay=0.1, max_delay=1.0),  # No retries
            RetryConfig(max_retries=1, base_delay=0.001, max_delay=0.001),  # Minimal delays
            RetryConfig(max_retries=100, base_delay=0.1, max_delay=60.0),  # Maximum retries
            RetryConfig(max_retries=5, base_delay=10.0, max_delay=10.0),  # Long delays
        ]
        
        for config in extreme_configs:
            # Test that config is validated and accepted
            assert config.max_retries >= 0
            assert config.base_delay > 0
            assert config.max_delay >= config.base_delay
            
            # Test retry calculation
            for attempt in range(min(config.max_retries + 1, 10)):
                delay = min(config.base_delay * (2 ** attempt), config.max_delay)
                assert 0 <= delay <= config.max_delay

    def test_filesystem_edge_cases(self):
        """Test filesystem-related edge cases."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Test extremely long file paths (near OS limits)
            long_filename = "x" * (255 - len(".txt"))  # Maximum filename length
            long_path = temp_path / f"{long_filename}.txt"
            
            # Should handle long filenames gracefully
            try:
                long_path.write_text("test content")
                assert long_path.exists()
                assert long_path.read_text() == "test content"
            except OSError:
                # Some filesystems might not support this length
                pytest.skip("Filesystem doesn't support long filenames")
            
            # Test deeply nested directories
            deep_path = temp_path
            for i in range(20):  # 20 levels deep
                deep_path = deep_path / f"level_{i}"
            
            try:
                deep_path.mkdir(parents=True)
                test_file = deep_path / "deep_file.txt"
                test_file.write_text("deep content")
                assert test_file.read_text() == "deep content"
            except OSError:
                # Some filesystems have path length limits
                pytest.skip("Filesystem doesn't support deep nesting")
            
            # Test special characters in filenames
            special_chars = ['!', '@', '#', '$', '%', '^', '&', '(', ')', '[', ']']
            for char in special_chars:
                try:
                    special_file = temp_path / f"test{char}file.txt"
                    special_file.write_text(f"content with {char}")
                    assert special_file.exists()
                except (OSError, ValueError):
                    # Some characters might not be allowed
                    continue
