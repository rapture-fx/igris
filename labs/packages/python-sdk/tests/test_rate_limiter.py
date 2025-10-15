"""
Tests for rate limiting functionality
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, patch

from schlep_engine.utils.rate_limiter import AdaptiveRateLimiter, RateLimitInfo, QueuedRequest
from schlep_engine.exceptions.base import RateLimitError


class TestRateLimitInfo:
    """Tests for RateLimitInfo dataclass."""
    
    def test_default_values(self):
        """Test default rate limit values."""
        info = RateLimitInfo()
        assert info.requests_per_second == 10.0
        assert info.requests_per_minute == 600
        assert info.requests_per_hour == 3600
        assert info.current_usage == 0
        assert info.reset_time is None
        assert info.retry_after is None


class TestQueuedRequest:
    """Tests for QueuedRequest dataclass."""
    
    def test_creation(self):
        """Test QueuedRequest creation."""
        async def dummy_func():
            return "test"
        
        future = asyncio.Future()
        request = QueuedRequest(
            func=dummy_func,
            future=future,
            priority=5
        )
        
        assert request.func == dummy_func
        assert request.future == future
        assert request.priority == 5
        assert isinstance(request.created_at, float)


class TestAdaptiveRateLimiter:
    """Tests for AdaptiveRateLimiter class."""
    
    def test_init_default_params(self):
        """Test rate limiter initialization with default parameters."""
        limiter = AdaptiveRateLimiter()
        assert limiter.rate_limit_info.requests_per_second == 10.0
        assert limiter.max_queue_size == 1000
        assert limiter.auto_adjust is True
        assert not limiter.is_rate_limited
        assert len(limiter.request_times) == 0
        assert len(limiter.request_queue) == 0
    
    def test_init_custom_params(self):
        """Test rate limiter initialization with custom parameters."""
        limiter = AdaptiveRateLimiter(
            initial_rps=5.0,
            max_queue_size=500,
            auto_adjust=False
        )
        assert limiter.rate_limit_info.requests_per_second == 5.0
        assert limiter.max_queue_size == 500
        assert limiter.auto_adjust is False
    
    @pytest.mark.asyncio
    async def test_can_execute_now_not_rate_limited(self):
        """Test can_execute_now when not rate limited."""
        limiter = AdaptiveRateLimiter(initial_rps=1000.0)  # Very high limit
        result = await limiter._can_execute_now()
        assert result is True
    
    @pytest.mark.asyncio
    async def test_can_execute_now_rate_limited(self):
        """Test can_execute_now when rate limited."""
        limiter = AdaptiveRateLimiter()
        
        # Set rate limited state
        limiter.is_rate_limited = True
        limiter.rate_limit_until = time.time() + 60  # 1 minute in future
        
        result = await limiter._can_execute_now()
        assert result is False
    
    @pytest.mark.asyncio
    async def test_can_execute_now_rate_limit_expired(self):
        """Test can_execute_now when rate limit period has expired."""
        limiter = AdaptiveRateLimiter()
        
        # Set rate limited state in the past
        limiter.is_rate_limited = True
        limiter.rate_limit_until = time.time() - 1  # 1 second ago
        
        result = await limiter._can_execute_now()
        assert result is True
        assert not limiter.is_rate_limited
        assert limiter.rate_limit_until == 0.0
    
    def test_check_current_rate_under_limit(self):
        """Test check_current_rate when under rate limit."""
        limiter = AdaptiveRateLimiter(initial_rps=10.0)
        
        # Add some old requests (shouldn't count)
        old_time = time.time() - 70  # Over 1 minute ago
        limiter.request_times.extend([old_time, old_time + 1])
        
        # Add a few recent requests (under limit)
        current_time = time.time()
        limiter.request_times.extend([current_time - 0.5, current_time - 0.3])
        
        result = limiter._check_current_rate()
        assert result is True
    
    def test_check_current_rate_over_rps_limit(self):
        """Test check_current_rate when over RPS limit."""
        limiter = AdaptiveRateLimiter(initial_rps=2.0)
        
        # Add requests that exceed RPS limit
        current_time = time.time()
        limiter.request_times.extend([
            current_time - 0.1,
            current_time - 0.2,
            current_time - 0.3  # 3 requests in last second, limit is 2
        ])
        
        result = limiter._check_current_rate()
        assert result is False
    
    def test_check_current_rate_over_rpm_limit(self):
        """Test check_current_rate when over RPM limit."""
        limiter = AdaptiveRateLimiter()
        limiter.rate_limit_info.requests_per_minute = 5  # Very low limit
        
        # Fill up the request times to exceed minute limit
        current_time = time.time()
        for i in range(6):
            limiter.request_times.append(current_time - i)
        
        result = limiter._check_current_rate()
        assert result is False
    
    @pytest.mark.asyncio
    async def test_execute_request_immediate_success(self):
        """Test execute_request with immediate success."""
        limiter = AdaptiveRateLimiter(initial_rps=1000.0)  # Very high limit
        
        async def test_request():
            return "success"
        
        result = await limiter.execute_request(test_request)
        assert result == "success"
        assert len(limiter.request_times) == 1
    
    @pytest.mark.asyncio
    async def test_execute_request_with_rate_limit_error(self):
        """Test execute_request handling rate limit error."""
        limiter = AdaptiveRateLimiter(initial_rps=1000.0)
        
        async def test_request():
            raise RateLimitError("Rate limited", retry_after=1)
        
        # Mock the queue processor to avoid actual waiting
        with patch.object(limiter, '_process_queue', new_callable=AsyncMock) as mock_processor:
            # Create a future that will be resolved by our mock
            future = asyncio.Future()
            future.set_result("queued_success")
            
            # Mock the request being added to queue and processed
            original_execute_request = limiter.execute_request
            
            async def mock_execute_request(request_func, priority=0):
                if limiter.is_rate_limited:
                    # Simulate queued request being processed
                    return "queued_success"
                else:
                    # First call will trigger rate limit
                    await limiter._handle_rate_limit_response(RateLimitError("Rate limited", retry_after=1))
                    return "queued_success"
            
            with patch.object(limiter, 'execute_request', side_effect=mock_execute_request):
                result = await mock_execute_request(test_request)
                assert result == "queued_success"
    
    @pytest.mark.asyncio
    async def test_execute_request_queue_full(self):
        """Test execute_request when queue is full."""
        limiter = AdaptiveRateLimiter(max_queue_size=0)  # No queue capacity
        
        async def test_request():
            raise RateLimitError("Rate limited")
        
        with pytest.raises(RateLimitError, match="queue is full"):
            await limiter.execute_request(test_request)
    
    @pytest.mark.asyncio
    async def test_handle_rate_limit_response_with_retry_after(self):
        """Test handling rate limit response with retry-after header."""
        limiter = AdaptiveRateLimiter()
        
        rate_limit_error = RateLimitError("Rate limited", retry_after=30)
        await limiter._handle_rate_limit_response(rate_limit_error)
        
        assert limiter.is_rate_limited is True
        assert limiter.rate_limit_until > time.time()
        assert limiter.rate_limit_until <= time.time() + 30
    
    @pytest.mark.asyncio
    async def test_handle_rate_limit_response_without_retry_after(self):
        """Test handling rate limit response without retry-after header."""
        limiter = AdaptiveRateLimiter()
        
        rate_limit_error = RateLimitError("Rate limited")
        await limiter._handle_rate_limit_response(rate_limit_error)
        
        assert limiter.is_rate_limited is True
        assert limiter.rate_limit_until > time.time()
        assert limiter.rate_limit_until <= time.time() + 60  # Default 1 minute
    
    @pytest.mark.asyncio
    async def test_handle_rate_limit_response_auto_adjust(self):
        """Test rate limit auto-adjustment."""
        limiter = AdaptiveRateLimiter(initial_rps=10.0, auto_adjust=True)
        original_rps = limiter.rate_limit_info.requests_per_second
        
        rate_limit_error = RateLimitError("Rate limited", retry_after=10)
        await limiter._handle_rate_limit_response(rate_limit_error)
        
        # Should have reduced rate limit
        assert limiter.rate_limit_info.requests_per_second < original_rps
        assert limiter.rate_limit_info.requests_per_second == original_rps * 0.5
    
    @pytest.mark.asyncio
    async def test_handle_rate_limit_response_no_auto_adjust(self):
        """Test rate limit handling without auto-adjustment."""
        limiter = AdaptiveRateLimiter(initial_rps=10.0, auto_adjust=False)
        original_rps = limiter.rate_limit_info.requests_per_second
        
        rate_limit_error = RateLimitError("Rate limited", retry_after=10)
        await limiter._handle_rate_limit_response(rate_limit_error)
        
        # Should not have changed rate limit
        assert limiter.rate_limit_info.requests_per_second == original_rps
    
    @pytest.mark.asyncio
    async def test_execute_and_track_success(self):
        """Test execute_and_track with successful request."""
        limiter = AdaptiveRateLimiter()
        
        async def test_request():
            return "success"
        
        result = await limiter._execute_and_track(test_request)
        assert result == "success"
        assert len(limiter.request_times) == 1
    
    @pytest.mark.asyncio
    async def test_execute_and_track_rate_limit_error(self):
        """Test execute_and_track with rate limit error."""
        limiter = AdaptiveRateLimiter()
        
        async def test_request():
            raise RateLimitError("Rate limited")
        
        with pytest.raises(RateLimitError):
            await limiter._execute_and_track(test_request)
        
        # Should not track rate limited requests
        assert len(limiter.request_times) == 0
    
    @pytest.mark.asyncio
    async def test_execute_and_track_other_error(self):
        """Test execute_and_track with non-rate-limit error."""
        limiter = AdaptiveRateLimiter()
        
        async def test_request():
            raise ValueError("Other error")
        
        with pytest.raises(ValueError):
            await limiter._execute_and_track(test_request)
        
        # Should still track the request timing
        assert len(limiter.request_times) == 1
    
    def test_update_rate_limits_from_headers(self):
        """Test updating rate limits from response headers."""
        limiter = AdaptiveRateLimiter()
        
        headers = {
            "X-RateLimit-Limit": "1000",
            "X-RateLimit-Remaining": "850",
            "X-RateLimit-Reset": "1650000000"
        }
        
        limiter.update_rate_limits(headers)
        
        assert limiter.rate_limit_info.requests_per_minute == 1000
        assert limiter.rate_limit_info.current_usage == 150  # 1000 - 850
        assert limiter.rate_limit_info.reset_time == 1650000000.0
    
    def test_update_rate_limits_alternative_headers(self):
        """Test updating rate limits from alternative header formats."""
        limiter = AdaptiveRateLimiter()
        
        headers = {
            "Rate-Limit-Limit": "500",
            "Rate-Limit-Remaining": "300",
            "Rate-Limit-Reset": "1650001000"
        }
        
        limiter.update_rate_limits(headers)
        
        assert limiter.rate_limit_info.requests_per_minute == 500
        assert limiter.rate_limit_info.current_usage == 200
        assert limiter.rate_limit_info.reset_time == 1650001000.0
    
    def test_update_rate_limits_invalid_headers(self):
        """Test updating rate limits with invalid header values."""
        limiter = AdaptiveRateLimiter()
        original_limit = limiter.rate_limit_info.requests_per_minute
        
        headers = {
            "X-RateLimit-Limit": "not-a-number",
            "X-RateLimit-Remaining": "invalid",
            "X-RateLimit-Reset": "bad-timestamp"
        }
        
        limiter.update_rate_limits(headers)
        
        # Should not have changed anything
        assert limiter.rate_limit_info.requests_per_minute == original_limit
        assert limiter.rate_limit_info.current_usage == 0
        assert limiter.rate_limit_info.reset_time is None
    
    @pytest.mark.asyncio
    async def test_close_cleanup(self):
        """Test proper cleanup when closing rate limiter."""
        limiter = AdaptiveRateLimiter()
        
        # Add some queued requests
        future1 = asyncio.Future()
        future2 = asyncio.Future()
        
        async def dummy_func():
            return "test"
        
        limiter.request_queue.append(QueuedRequest(func=dummy_func, future=future1))
        limiter.request_queue.append(QueuedRequest(func=dummy_func, future=future2))
        
        await limiter.close()
        
        # Futures should be cancelled
        assert future1.cancelled()
        assert future2.cancelled()
        assert len(limiter.request_queue) == 0
    
    def test_get_stats(self):
        """Test getting rate limiter statistics."""
        limiter = AdaptiveRateLimiter(initial_rps=5.0)
        
        # Add some request history
        current_time = time.time()
        limiter.request_times.extend([
            current_time - 0.5,
            current_time - 30,
            current_time - 90  # This should be cleaned up
        ])
        
        # Add some queued requests
        async def dummy_func():
            return "test"
        
        future = asyncio.Future()
        limiter.request_queue.append(QueuedRequest(func=dummy_func, future=future))
        
        stats = limiter.get_stats()
        
        assert stats["current_rps"] == 5.0
        assert stats["queue_size"] == 1
        assert stats["is_rate_limited"] is False
        assert stats["recent_requests_1s"] == 1  # Only one request in last second
        assert "rate_limit" in stats


@pytest.mark.asyncio
async def test_rate_limited_session():
    """Test rate limited session context manager."""
    from schlep_engine.utils.rate_limiter import rate_limited_session
    
    limiter = AdaptiveRateLimiter()
    
    async with rate_limited_session(limiter) as session_limiter:
        assert session_limiter is limiter
        # Add some test requests to queue to verify cleanup
        future = asyncio.Future()
        async def dummy_func():
            return "test"
        session_limiter.request_queue.append(QueuedRequest(func=dummy_func, future=future))
    
    # Should have been cleaned up
    assert future.cancelled()
    assert len(limiter.request_queue) == 0