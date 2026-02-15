"""
Comprehensive error handling tests for Igris-engine Python SDK
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import json

from igris.exceptions.base import (
    IgrisError, APIError, AuthenticationError, RateLimitError,
    NetworkError, ValidationError, TimeoutError
)
from igris.utils.retry import RetryHandler, RetryConfig
from igris.utils.http_client import HTTPClient


class TestExceptionHierarchy:
    """Test exception class hierarchy and behavior."""

    def test_base_exception_properties(self):
        """Test base exception properties."""
        error = IgrisError("Test error", error_code="TEST_ERROR")
        
        assert str(error) == "Test error"
        assert error.message == "Test error"
        assert error.error_code == "TEST_ERROR"
        assert isinstance(error, Exception)

    def test_api_error_properties(self):
        """Test APIError specific properties."""
        error = APIError(
            "API request failed",
            status_code=400,
            error_code="BAD_REQUEST",
            request_id="req-123"
        )
        
        assert error.status_code == 400
        assert error.error_code == "BAD_REQUEST"
        assert error.request_id == "req-123"
        assert isinstance(error, IgrisError)

    def test_authentication_error(self):
        """Test AuthenticationError."""
        error = AuthenticationError("Invalid token")
        
        assert str(error) == "Invalid token"
        assert isinstance(error, APIError)
        assert isinstance(error, IgrisError)

    def test_rate_limit_error_properties(self):
        """Test RateLimitError specific properties."""
        error = RateLimitError(
            "Rate limit exceeded",
            retry_after=60,
            limit=1000,
            remaining=0
        )
        
        assert error.retry_after == 60
        assert error.limit == 1000
        assert error.remaining == 0
        assert isinstance(error, APIError)

    def test_network_error(self):
        """Test NetworkError."""
        error = NetworkError("Connection failed", timeout=30.0)
        
        assert error.timeout == 30.0
        assert isinstance(error, IgrisError)

    def test_validation_error(self):
        """Test ValidationError."""
        error = ValidationError("Invalid input", field="email")
        
        assert error.field == "email"
        assert isinstance(error, IgrisError)

    def test_timeout_error(self):
        """Test TimeoutError."""
        error = TimeoutError("Request timed out", timeout=30.0)
        
        assert error.timeout == 30.0
        assert isinstance(error, IgrisError)


class TestRetryHandler:
    """Test retry handling logic."""

    def test_retry_config_defaults(self):
        """Test default retry configuration."""
        config = RetryConfig()
        
        assert config.max_retries == 3
        assert config.base_delay == 1.0
        assert config.max_delay == 60.0
        assert config.exponential_base == 2.0
        assert config.jitter is True

    def test_retry_config_custom(self):
        """Test custom retry configuration."""
        config = RetryConfig(
            max_retries=5,
            base_delay=0.5,
            max_delay=30.0,
            exponential_base=1.5,
            jitter=False
        )
        
        assert config.max_retries == 5
        assert config.base_delay == 0.5
        assert config.max_delay == 30.0
        assert config.exponential_base == 1.5
        assert config.jitter is False

    @pytest.mark.asyncio
    async def test_retry_on_transient_errors(self):
        """Test retry on transient errors."""
        retry_handler = RetryHandler(RetryConfig(max_retries=3, base_delay=0.1))
        
        call_count = 0
        
        async def failing_operation():
            nonlocal call_count
            call_count += 1
            
            if call_count < 3:
                raise NetworkError("Temporary network error")
            return "success"
        
        result = await retry_handler.execute(failing_operation)
        
        assert result == "success"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_retry_exhausted(self):
        """Test retry exhaustion."""
        retry_handler = RetryHandler(RetryConfig(max_retries=2, base_delay=0.1))
        
        call_count = 0
        
        async def always_failing_operation():
            nonlocal call_count
            call_count += 1
            raise NetworkError("Persistent network error")
        
        with pytest.raises(NetworkError):
            await retry_handler.execute(always_failing_operation)
        
        assert call_count == 3  # Initial call + 2 retries

    @pytest.mark.asyncio
    async def test_no_retry_on_client_errors(self):
        """Test no retry on client errors (4xx)."""
        retry_handler = RetryHandler(RetryConfig(max_retries=3, base_delay=0.1))
        
        call_count = 0
        
        async def client_error_operation():
            nonlocal call_count
            call_count += 1
            raise APIError("Bad request", status_code=400)
        
        with pytest.raises(APIError):
            await retry_handler.execute(client_error_operation)
        
        assert call_count == 1  # No retries on client errors

    @pytest.mark.asyncio
    async def test_retry_on_server_errors(self):
        """Test retry on server errors (5xx)."""
        retry_handler = RetryHandler(RetryConfig(max_retries=2, base_delay=0.1))
        
        call_count = 0
        
        async def server_error_operation():
            nonlocal call_count
            call_count += 1
            
            if call_count < 3:
                raise APIError("Internal server error", status_code=500)
            return "recovered"
        
        result = await retry_handler.execute(server_error_operation)
        
        assert result == "recovered"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_retry_delay_calculation(self):
        """Test retry delay calculation."""
        retry_handler = RetryHandler(
            RetryConfig(max_retries=3, base_delay=1.0, exponential_base=2.0, jitter=False)
        )
        
        # Test delay calculation
        assert retry_handler._calculate_delay(0) == 1.0
        assert retry_handler._calculate_delay(1) == 2.0
        assert retry_handler._calculate_delay(2) == 4.0

    @pytest.mark.asyncio
    async def test_retry_with_jitter(self):
        """Test retry with jitter."""
        retry_handler = RetryHandler(
            RetryConfig(max_retries=2, base_delay=1.0, jitter=True)
        )
        
        delays = []
        
        async def record_delay_operation():
            raise NetworkError("Test error")
        
        original_sleep = asyncio.sleep
        
        async def mock_sleep(delay):
            delays.append(delay)
            await original_sleep(0.01)  # Short sleep for testing
        
        with patch('asyncio.sleep', mock_sleep):
            with pytest.raises(NetworkError):
                await retry_handler.execute(record_delay_operation)
        
        # Delays should have jitter (not exactly base_delay * exponential_base^attempt)
        assert len(delays) == 2
        assert all(0.5 <= delay <= 2.0 for delay in delays)  # With jitter range

    @pytest.mark.asyncio
    async def test_retry_callback(self):
        """Test retry callback functionality."""
        retry_attempts = []
        
        def retry_callback(attempt, error, delay):
            retry_attempts.append({
                'attempt': attempt,
                'error': str(error),
                'delay': delay
            })
        
        retry_handler = RetryHandler(
            RetryConfig(max_retries=2, base_delay=0.1),
            retry_callback=retry_callback
        )
        
        call_count = 0
        
        async def failing_operation():
            nonlocal call_count
            call_count += 1
            raise NetworkError(f"Error {call_count}")
        
        with pytest.raises(NetworkError):
            await retry_handler.execute(failing_operation)
        
        assert len(retry_attempts) == 2
        assert retry_attempts[0]['attempt'] == 1
        assert "Error 1" in retry_attempts[0]['error']


class TestHTTPClientErrorHandling:
    """Test HTTP client error handling."""

    @pytest.fixture
    def http_client(self):
        """HTTP client fixture."""
        return HTTPClient(
            base_url="https://api.test.com",
            default_headers={"Authorization": "Bearer test-token"}
        )

    @pytest.mark.asyncio
    async def test_http_status_error_mapping(self, http_client):
        """Test HTTP status code to exception mapping."""
        with patch('aiohttp.ClientSession.request') as mock_request:
            # Test 400 Bad Request
            mock_response = MagicMock()
            mock_response.status = 400
            mock_response.json = AsyncMock(return_value={
                "error": "Bad request",
                "message": "Invalid input"
            })
            mock_request.return_value.__aenter__.return_value = mock_response
            
            with pytest.raises(APIError) as exc_info:
                await http_client.get("/test")
            
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_authentication_error_mapping(self, http_client):
        """Test 401 Unauthorized mapping to AuthenticationError."""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_response = MagicMock()
            mock_response.status = 401
            mock_response.json = AsyncMock(return_value={
                "error": "Unauthorized",
                "message": "Invalid token"
            })
            mock_request.return_value.__aenter__.return_value = mock_response
            
            with pytest.raises(AuthenticationError) as exc_info:
                await http_client.get("/test")
            
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_rate_limit_error_mapping(self, http_client):
        """Test 429 Rate Limit mapping to RateLimitError."""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_response = MagicMock()
            mock_response.status = 429
            mock_response.headers = {
                'Retry-After': '60',
                'X-RateLimit-Limit': '1000',
                'X-RateLimit-Remaining': '0'
            }
            mock_response.json = AsyncMock(return_value={
                "error": "Rate limit exceeded"
            })
            mock_request.return_value.__aenter__.return_value = mock_response
            
            with pytest.raises(RateLimitError) as exc_info:
                await http_client.get("/test")
            
            assert exc_info.value.status_code == 429
            assert exc_info.value.retry_after == 60
            assert exc_info.value.limit == 1000
            assert exc_info.value.remaining == 0

    @pytest.mark.asyncio
    async def test_network_timeout_error(self, http_client):
        """Test network timeout error handling."""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_request.side_effect = asyncio.TimeoutError()
            
            with pytest.raises(TimeoutError):
                await http_client.get("/test")

    @pytest.mark.asyncio
    async def test_connection_error(self, http_client):
        """Test connection error handling."""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_request.side_effect = aiohttp.ClientConnectorError(
                connection_key=None,
                os_error=OSError("Connection refused")
            )
            
            with pytest.raises(NetworkError):
                await http_client.get("/test")

    @pytest.mark.asyncio
    async def test_json_decode_error(self, http_client):
        """Test JSON decode error handling."""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_response = MagicMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(side_effect=json.JSONDecodeError("Invalid JSON", "", 0))
            mock_response.text = AsyncMock(return_value="Invalid JSON response")
            mock_request.return_value.__aenter__.return_value = mock_response
            
            with pytest.raises(APIError) as exc_info:
                await http_client.get("/test")
            
            assert "Invalid JSON" in str(exc_info.value)


class TestErrorRecovery:
    """Test error recovery mechanisms."""

    @pytest.mark.asyncio
    async def test_circuit_breaker_pattern(self):
        """Test circuit breaker for error recovery."""
        class MockCircuitBreaker:
            def __init__(self):
                self.failure_count = 0
                self.state = "closed"  # closed, open, half-open
                self.failure_threshold = 3
                
            async def execute(self, operation):
                if self.state == "open":
                    raise APIError("Circuit breaker is open", status_code=503)
                
                try:
                    result = await operation()
                    # Reset on success
                    self.failure_count = 0
                    self.state = "closed"
                    return result
                except Exception as e:
                    self.failure_count += 1
                    if self.failure_count >= self.failure_threshold:
                        self.state = "open"
                    raise
        
        circuit_breaker = MockCircuitBreaker()
        call_count = 0
        
        async def failing_operation():
            nonlocal call_count
            call_count += 1
            raise APIError("Service unavailable", status_code=503)
        
        # First 3 calls should fail and open the circuit
        for _ in range(3):
            with pytest.raises(APIError):
                await circuit_breaker.execute(failing_operation)
        
        # Circuit should now be open
        assert circuit_breaker.state == "open"
        
        # Next call should fail immediately due to open circuit
        with pytest.raises(APIError) as exc_info:
            await circuit_breaker.execute(failing_operation)
        
        assert "Circuit breaker is open" in str(exc_info.value)
        assert call_count == 3  # No additional call made due to open circuit

    @pytest.mark.asyncio
    async def test_graceful_degradation(self):
        """Test graceful degradation on errors."""
        class MockService:
            def __init__(self):
                self.cache = {}
                self.fallback_enabled = True
            
            async def get_data(self, key):
                try:
                    # Simulate API call
                    raise APIError("Service unavailable", status_code=503)
                except APIError:
                    if self.fallback_enabled:
                        # Return cached data or default
                        return self.cache.get(key, {"data": "fallback_value", "cached": True})
                    raise
        
        service = MockService()
        service.cache["test_key"] = {"data": "cached_value", "cached": True}
        
        result = await service.get_data("test_key")
        
        assert result["data"] == "cached_value"
        assert result["cached"] is True

    @pytest.mark.asyncio
    async def test_error_aggregation(self):
        """Test error aggregation for batch operations."""
        class BatchProcessor:
            async def process_batch(self, items):
                results = []
                errors = []
                
                for i, item in enumerate(items):
                    try:
                        if item == "fail":
                            raise APIError(f"Failed to process item {i}", status_code=400)
                        results.append(f"processed_{item}")
                    except APIError as e:
                        errors.append({
                            "index": i,
                            "item": item,
                            "error": str(e)
                        })
                
                return {
                    "results": results,
                    "errors": errors,
                    "success_count": len(results),
                    "error_count": len(errors)
                }
        
        processor = BatchProcessor()
        items = ["item1", "fail", "item3", "fail", "item5"]
        
        result = await processor.process_batch(items)
        
        assert result["success_count"] == 3
        assert result["error_count"] == 2
        assert len(result["results"]) == 3
        assert len(result["errors"]) == 2


class TestErrorLogging:
    """Test error logging and reporting."""

    @pytest.mark.asyncio
    async def test_error_context_preservation(self):
        """Test that error context is preserved through the call stack."""
        class ContextualError(IgrisError):
            def __init__(self, message, context=None):
                super().__init__(message)
                self.context = context or {}
        
        async def operation_with_context():
            context = {
                "user_id": "user-123",
                "operation": "data_processing",
                "timestamp": "2024-01-01T12:00:00Z"
            }
            raise ContextualError("Operation failed", context=context)
        
        with pytest.raises(ContextualError) as exc_info:
            await operation_with_context()
        
        error = exc_info.value
        assert error.context["user_id"] == "user-123"
        assert error.context["operation"] == "data_processing"

    def test_error_serialization(self):
        """Test error serialization for logging."""
        error = APIError(
            "Request failed",
            status_code=500,
            error_code="INTERNAL_ERROR",
            request_id="req-123"
        )
        
        error_dict = {
            "type": error.__class__.__name__,
            "message": error.message,
            "status_code": error.status_code,
            "error_code": error.error_code,
            "request_id": error.request_id
        }
        
        assert error_dict["type"] == "APIError"
        assert error_dict["message"] == "Request failed"
        assert error_dict["status_code"] == 500

    @pytest.mark.asyncio
    async def test_error_reporting_integration(self):
        """Test integration with error reporting services."""
        reported_errors = []
        
        class MockErrorReporter:
            def report_error(self, error, context=None):
                reported_errors.append({
                    "error": error,
                    "context": context,
                    "timestamp": "2024-01-01T12:00:00Z"
                })
        
        reporter = MockErrorReporter()
        
        try:
            raise APIError("Test error for reporting", status_code=500)
        except APIError as e:
            reporter.report_error(e, context={"user_id": "user-123"})
        
        assert len(reported_errors) == 1
        assert reported_errors[0]["error"].message == "Test error for reporting"
        assert reported_errors[0]["context"]["user_id"] == "user-123"


@pytest.mark.integration
class TestErrorHandlingIntegration:
    """Integration tests for error handling (requires test API)."""

    @pytest.mark.asyncio
    async def test_real_api_error_handling(self):
        """Test error handling with real API responses."""
        pytest.skip("Integration test - requires real API endpoint")

    @pytest.mark.asyncio
    async def test_error_recovery_workflows(self):
        """Test complete error recovery workflows."""
        pytest.skip("Integration test - requires real API endpoint")


# Additional fixtures for error testing
@pytest.fixture
def sample_api_error():
    """Sample API error for testing."""
    return APIError(
        "Bad request",
        status_code=400,
        error_code="INVALID_INPUT",
        request_id="req-123"
    )


@pytest.fixture
def sample_rate_limit_error():
    """Sample rate limit error for testing."""
    return RateLimitError(
        "Rate limit exceeded",
        status_code=429,
        retry_after=60,
        limit=1000,
        remaining=0
    )