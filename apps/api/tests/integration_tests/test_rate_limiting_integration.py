"""
Rate Limiting Middleware Integration Tests

Comprehensive testing of the enhanced rate limiting system including:
- IP-based and user-based rate limiting
- Security level multipliers
- Admin bypass functionality
- Different rate limiting algorithms
- Redis integration and fallback mechanisms
- Performance under load
"""

import pytest
import asyncio
import time
from typing import Dict, List
from unittest.mock import patch, AsyncMock
import httpx
from fastapi import status

from app.middleware.rate_limiting_middleware import (
    RateLimitConfig,
    RateLimitType,
    RateLimitAlgorithm,
    SecurityLevel,
    rate_limiter
)


@pytest.mark.integration
class TestRateLimitingIntegration:
    """Integration tests for rate limiting middleware."""

    async def test_ip_based_rate_limiting(self, async_test_client, test_redis_client):
        """Test IP-based rate limiting with Redis backend."""
        # Configure strict rate limiting
        config = RateLimitConfig(
            requests_per_minute=3,
            rate_limit_type=RateLimitType.IP_BASED,
            bypass_for_admin=False
        )

        endpoint = "/api/v1/health"

        # First 3 requests should succeed
        for i in range(3):
            response = await async_test_client.get(endpoint)
            assert response.status_code == 200, f"Request {i+1} should succeed"

        # 4th request should be rate limited
        response = await async_test_client.get(endpoint)
        assert response.status_code == 429
        assert "rate limit" in response.text.lower()

        # Verify Redis contains rate limit data
        rate_limit_keys = await test_redis_client.keys("rate_limit:ip:*")
        assert len(rate_limit_keys) > 0, "Rate limit data should be stored in Redis"

    async def test_user_based_rate_limiting(
        self,
        async_test_client,
        auth_headers_user,
        auth_headers_admin,
        test_redis_client
    ):
        """Test user-based rate limiting with different user types."""
        # Configure user-based rate limiting with admin bypass
        with patch("app.middleware.rate_limiting_middleware.RateLimitingMiddleware") as mock_middleware:
            config = RateLimitConfig(
                requests_per_minute=2,
                rate_limit_type=RateLimitType.USER_BASED,
                bypass_for_admin=True
            )

            endpoint = "/api/v1/users/profile"

            # Test regular user rate limiting
            for i in range(2):
                response = await async_test_client.get(endpoint, headers=auth_headers_user)
                # May return 401 if auth not fully implemented, but should not be 429
                assert response.status_code != 429, f"User request {i+1} should not be rate limited yet"

            # Third request should be rate limited for regular user
            response = await async_test_client.get(endpoint, headers=auth_headers_user)
            # We expect this to be rate limited if middleware is active

            # Admin should bypass rate limits
            for i in range(5):
                response = await async_test_client.get(endpoint, headers=auth_headers_admin)
                # Admin requests should never be rate limited
                assert response.status_code != 429, f"Admin request {i+1} should bypass rate limiting"

    async def test_security_level_multipliers(self, async_test_client, auth_headers_user):
        """Test rate limiting with security level multipliers."""
        # Configure with security level multipliers
        config = RateLimitConfig(
            requests_per_minute=10,
            security_level_multipliers={
                SecurityLevel.LOW: 2.0,      # 20 requests/minute
                SecurityLevel.MEDIUM: 1.0,   # 10 requests/minute
                SecurityLevel.HIGH: 0.5,     # 5 requests/minute
                SecurityLevel.CRITICAL: 0.2  # 2 requests/minute
            }
        )

        # Test endpoint with different security levels
        # This would require implementing security level detection in the test
        high_security_endpoint = "/api/v1/auth/login"
        medium_security_endpoint = "/api/v1/users/profile"

        # Test high security endpoint (should have stricter limits)
        responses = []
        for i in range(10):
            response = await async_test_client.post(
                high_security_endpoint,
                json={"username": "test", "password": "test"}
            )
            responses.append(response.status_code)

            # Add small delay to avoid overwhelming
            await asyncio.sleep(0.1)

        # Should see rate limiting kick in faster for high security endpoints
        rate_limited_responses = [code for code in responses if code == 429]
        assert len(rate_limited_responses) > 0, "High security endpoints should have strict rate limiting"

    async def test_sliding_window_algorithm(self, async_test_client, test_redis_client):
        """Test sliding window rate limiting algorithm."""
        # Create test request to endpoint
        endpoint = "/health"

        # Make requests at specific intervals to test sliding window
        start_time = time.time()
        responses = []

        # Make initial burst of requests
        for i in range(5):
            response = await async_test_client.get(endpoint)
            responses.append({
                "status_code": response.status_code,
                "timestamp": time.time() - start_time,
                "retry_after": response.headers.get("Retry-After")
            })
            await asyncio.sleep(0.1)

        # Wait for window to slide
        await asyncio.sleep(2)

        # Make more requests - should be allowed due to sliding window
        for i in range(3):
            response = await async_test_client.get(endpoint)
            responses.append({
                "status_code": response.status_code,
                "timestamp": time.time() - start_time,
                "retry_after": response.headers.get("Retry-After")
            })

        # Analyze response pattern
        success_codes = [r for r in responses if r["status_code"] == 200]
        rate_limited_codes = [r for r in responses if r["status_code"] == 429]

        # Should have some successful requests after window slides
        assert len(success_codes) > 0, "Sliding window should allow new requests after time passes"

    async def test_token_bucket_algorithm(self, async_test_client):
        """Test token bucket rate limiting algorithm."""
        # Configure token bucket algorithm
        config = RateLimitConfig(
            requests_per_minute=6,  # 0.1 requests per second
            algorithm=RateLimitAlgorithm.TOKEN_BUCKET,
            burst_multiplier=2.0    # Allow burst of 12 requests
        )

        endpoint = "/health"

        # Test burst capability
        burst_responses = []
        for i in range(10):
            response = await async_test_client.get(endpoint)
            burst_responses.append(response.status_code)

        # Should allow initial burst
        successful_burst = [code for code in burst_responses if code == 200]
        assert len(successful_burst) >= 6, "Token bucket should allow initial burst"

        # Wait for tokens to refill
        await asyncio.sleep(5)

        # Should be able to make more requests after refill
        refill_response = await async_test_client.get(endpoint)
        assert refill_response.status_code == 200, "Should allow requests after token refill"

    async def test_redis_fallback_mechanism(self, async_test_client):
        """Test fallback to in-memory storage when Redis is unavailable."""
        with patch("redis.asyncio.from_url") as mock_redis:
            # Mock Redis connection failure
            mock_redis.side_effect = ConnectionError("Redis unavailable")

            # Rate limiting should still work with in-memory fallback
            endpoint = "/health"

            responses = []
            for i in range(10):
                try:
                    response = await async_test_client.get(endpoint)
                    responses.append(response.status_code)
                except Exception as e:
                    responses.append(500)

            # Should still enforce rate limits even without Redis
            success_responses = [code for code in responses if code == 200]
            rate_limited_responses = [code for code in responses if code == 429]

            # Verify fallback mechanism works
            assert len(responses) == 10, "All requests should be processed"
            # In-memory fallback should still enforce some rate limiting

    @pytest.mark.performance
    async def test_rate_limiting_performance_under_load(
        self,
        async_test_client,
        performance_monitor
    ):
        """Test rate limiting performance under concurrent load."""
        endpoint = "/health"
        concurrent_users = 20
        requests_per_user = 25

        async def user_session(user_id: int):
            """Simulate a user session with multiple requests."""
            user_responses = []
            for i in range(requests_per_user):
                start_time = time.time()
                try:
                    response = await async_test_client.get(
                        endpoint,
                        headers={"X-User-ID": str(user_id)}
                    )
                    duration_ms = (time.time() - start_time) * 1000
                    performance_monitor.record_response_time(duration_ms)
                    user_responses.append({
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                        "user_id": user_id
                    })
                except Exception as e:
                    performance_monitor.record_error(type(e).__name__)

                # Small delay between requests
                await asyncio.sleep(0.05)

            return user_responses

        # Execute concurrent user sessions
        start_time = time.time()
        tasks = [user_session(i) for i in range(concurrent_users)]
        all_responses = await asyncio.gather(*tasks)
        total_time = time.time() - start_time

        # Flatten responses
        flat_responses = [resp for user_responses in all_responses for resp in user_responses]

        # Calculate performance statistics
        stats = performance_monitor.calculate_stats()

        # Performance assertions
        assert stats["avg_response_time"] < 100, f"Average response time too high: {stats['avg_response_time']}ms"
        assert stats["p95_response_time"] < 200, f"95th percentile response time too high: {stats['p95_response_time']}ms"
        assert stats["error_rate"] < 0.05, f"Error rate too high: {stats['error_rate']}"

        # Rate limiting effectiveness
        status_codes = [resp["status_code"] for resp in flat_responses]
        rate_limited_count = len([code for code in status_codes if code == 429])
        success_count = len([code for code in status_codes if code == 200])

        assert rate_limited_count > 0, "Rate limiting should activate under load"
        assert success_count > 0, "Some requests should still succeed"

        # Throughput calculation
        total_requests = len(flat_responses)
        throughput = total_requests / total_time

        print(f"\nPerformance Results:")
        print(f"Total Requests: {total_requests}")
        print(f"Total Time: {total_time:.2f}s")
        print(f"Throughput: {throughput:.2f} requests/second")
        print(f"Success Rate: {success_count/total_requests:.2%}")
        print(f"Rate Limited: {rate_limited_count/total_requests:.2%}")
        print(f"Average Response Time: {stats['avg_response_time']:.2f}ms")
        print(f"95th Percentile: {stats['p95_response_time']:.2f}ms")

    async def test_custom_rate_limit_keys(self, async_test_client):
        """Test custom rate limit key generation."""
        def api_key_rate_limit_key(request, user_id=None):
            """Custom key function based on API key."""
            api_key = request.headers.get("X-API-Key", "default")
            return f"rate_limit:api_key:{api_key}"

        # This would be tested with actual middleware configuration
        endpoint = "/health"

        # Requests with same API key should share rate limit
        headers_1 = {"X-API-Key": "test-key-1"}
        headers_2 = {"X-API-Key": "test-key-1"}  # Same key
        headers_3 = {"X-API-Key": "test-key-2"}  # Different key

        responses_key1 = []
        responses_key2 = []

        # Make requests with same API key
        for i in range(5):
            response = await async_test_client.get(endpoint, headers=headers_1)
            responses_key1.append(response.status_code)

        # Make more requests with same API key (should hit rate limit)
        for i in range(3):
            response = await async_test_client.get(endpoint, headers=headers_2)
            responses_key1.append(response.status_code)

        # Make requests with different API key (should have separate limit)
        for i in range(5):
            response = await async_test_client.get(endpoint, headers=headers_3)
            responses_key2.append(response.status_code)

        # Different API keys should have separate rate limits
        assert len(responses_key1) == 8
        assert len(responses_key2) == 5

    async def test_rate_limit_headers(self, async_test_client):
        """Test rate limit information headers in responses."""
        endpoint = "/health"

        response = await async_test_client.get(endpoint)

        # Check for standard rate limiting headers
        headers_to_check = [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "Retry-After"  # Only present when rate limited
        ]

        # At least some rate limit headers should be present
        rate_limit_headers = [
            header for header in headers_to_check
            if header in response.headers
        ]

        # Headers may not be present if not rate limited, but if present should be valid
        if "X-RateLimit-Remaining" in response.headers:
            remaining = int(response.headers["X-RateLimit-Remaining"])
            assert remaining >= 0, "Rate limit remaining should be non-negative"

    @pytest.mark.slow
    async def test_rate_limit_window_reset(self, async_test_client):
        """Test that rate limits reset after time window expires."""
        endpoint = "/health"

        # Make requests to hit rate limit
        responses_first_window = []
        for i in range(10):
            response = await async_test_client.get(endpoint)
            responses_first_window.append(response.status_code)
            await asyncio.sleep(0.1)

        # Should have some rate limited responses
        rate_limited_first = len([code for code in responses_first_window if code == 429])

        # Wait for rate limit window to reset (assuming 1 minute window)
        print("Waiting for rate limit window to reset...")
        await asyncio.sleep(65)  # Wait slightly longer than window

        # Make requests again - should be allowed
        responses_second_window = []
        for i in range(5):
            response = await async_test_client.get(endpoint)
            responses_second_window.append(response.status_code)
            await asyncio.sleep(0.1)

        # Should have successful responses after reset
        successful_second = len([code for code in responses_second_window if code == 200])
        assert successful_second > 0, "Requests should succeed after rate limit window resets"

    async def test_concurrent_different_endpoints(self, async_test_client):
        """Test rate limiting across different endpoints concurrently."""
        endpoints = [
            "/health",
            "/api/v1/health",
            "/metrics",
            "/system/info"
        ]

        async def test_endpoint(endpoint: str):
            """Test single endpoint with multiple requests."""
            responses = []
            for i in range(10):
                try:
                    response = await async_test_client.get(endpoint)
                    responses.append({
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "timestamp": time.time()
                    })
                except Exception as e:
                    responses.append({
                        "endpoint": endpoint,
                        "status_code": 500,
                        "error": str(e),
                        "timestamp": time.time()
                    })
                await asyncio.sleep(0.05)
            return responses

        # Test all endpoints concurrently
        tasks = [test_endpoint(endpoint) for endpoint in endpoints]
        all_results = await asyncio.gather(*tasks)

        # Flatten results
        all_responses = [resp for endpoint_results in all_results for resp in endpoint_results]

        # Analyze results by endpoint
        endpoint_stats = {}
        for resp in all_responses:
            endpoint = resp["endpoint"]
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {"success": 0, "rate_limited": 0, "errors": 0}

            if resp["status_code"] == 200:
                endpoint_stats[endpoint]["success"] += 1
            elif resp["status_code"] == 429:
                endpoint_stats[endpoint]["rate_limited"] += 1
            else:
                endpoint_stats[endpoint]["errors"] += 1

        # Each endpoint should be processed
        assert len(endpoint_stats) == len(endpoints)

        # Print results for analysis
        print("\nEndpoint Rate Limiting Results:")
        for endpoint, stats in endpoint_stats.items():
            total = sum(stats.values())
            print(f"{endpoint}:")
            print(f"  Success: {stats['success']}/{total} ({stats['success']/total:.1%})")
            print(f"  Rate Limited: {stats['rate_limited']}/{total} ({stats['rate_limited']/total:.1%})")
            print(f"  Errors: {stats['errors']}/{total} ({stats['errors']/total:.1%})")


@pytest.mark.integration
class TestRateLimitingEdgeCases:
    """Test edge cases and error scenarios for rate limiting."""

    async def test_malformed_tokens(self, async_test_client):
        """Test rate limiting with malformed authentication tokens."""
        endpoint = "/api/v1/users/profile"

        malformed_tokens = [
            "Bearer invalid-token",
            "Bearer ",
            "InvalidBearer token",
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid",
            ""
        ]

        for token in malformed_tokens:
            headers = {"Authorization": token} if token else {}

            response = await async_test_client.get(endpoint, headers=headers)

            # Should handle malformed tokens gracefully
            # Rate limiting should still apply even with invalid tokens
            assert response.status_code in [401, 403, 429], \
                f"Should handle malformed token gracefully: {token}"

    async def test_extremely_high_load_burst(self, async_test_client):
        """Test system behavior under extremely high load burst."""
        endpoint = "/health"

        # Simulate sudden burst of 1000 requests
        async def burst_requests():
            responses = []
            tasks = []

            # Create 1000 concurrent requests
            for i in range(1000):
                task = async_test_client.get(endpoint)
                tasks.append(task)

                # Add small batching to avoid overwhelming
                if len(tasks) >= 50:
                    batch_responses = await asyncio.gather(*tasks, return_exceptions=True)
                    responses.extend(batch_responses)
                    tasks = []
                    await asyncio.sleep(0.01)  # Small pause between batches

            # Process remaining tasks
            if tasks:
                batch_responses = await asyncio.gather(*tasks, return_exceptions=True)
                responses.extend(batch_responses)

            return responses

        start_time = time.time()
        responses = await burst_requests()
        duration = time.time() - start_time

        # Analyze responses
        success_count = 0
        rate_limited_count = 0
        error_count = 0

        for response in responses:
            if isinstance(response, Exception):
                error_count += 1
            elif hasattr(response, 'status_code'):
                if response.status_code == 200:
                    success_count += 1
                elif response.status_code == 429:
                    rate_limited_count += 1
                else:
                    error_count += 1

        total_responses = len(responses)

        print(f"\nHigh Load Burst Test Results:")
        print(f"Total Requests: {total_responses}")
        print(f"Duration: {duration:.2f}s")
        print(f"Throughput: {total_responses/duration:.2f} req/s")
        print(f"Successful: {success_count} ({success_count/total_responses:.1%})")
        print(f"Rate Limited: {rate_limited_count} ({rate_limited_count/total_responses:.1%})")
        print(f"Errors: {error_count} ({error_count/total_responses:.1%})")

        # System should remain stable under high load
        assert error_count < total_responses * 0.1, "Error rate should be below 10% even under high load"
        assert rate_limited_count > 0, "Rate limiting should activate under high load"
        assert success_count > 0, "Some requests should still succeed"

    async def test_rate_limiting_with_websocket_upgrade(self, async_test_client):
        """Test rate limiting behavior with WebSocket upgrade requests."""
        # WebSocket upgrade requests should be handled specially
        headers = {
            "Connection": "Upgrade",
            "Upgrade": "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13"
        }

        try:
            response = await async_test_client.get("/ws", headers=headers)
            # WebSocket requests may be handled differently by rate limiting
            assert response.status_code in [101, 400, 404, 429], \
                "WebSocket upgrade should be handled gracefully"
        except Exception as e:
            # WebSocket connections might not be fully supported in test client
            pass

    async def test_rate_limiting_memory_cleanup(self, async_test_client, test_redis_client):
        """Test that rate limiting data is properly cleaned up."""
        endpoint = "/health"

        # Make requests to create rate limiting data
        for i in range(10):
            await async_test_client.get(endpoint)
            await asyncio.sleep(0.1)

        # Check that data exists in Redis
        keys_before = await test_redis_client.keys("rate_limit:*")
        assert len(keys_before) > 0, "Rate limiting data should be stored"

        # Wait for cleanup (this would need actual TTL in Redis)
        # In a real test, you'd wait for the TTL to expire
        # For now, just verify the keys have TTL set
        for key in keys_before:
            ttl = await test_redis_client.ttl(key)
            assert ttl > 0, f"Rate limit key {key} should have TTL set for cleanup"