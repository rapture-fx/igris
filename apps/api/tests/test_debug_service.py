"""
Test suite for Debug Service functionality
Tests the reliability features and debug endpoints
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

# Import the main app
from app.main import app
from app.core.api_reliability import (
    CircuitBreaker, CircuitBreakerConfig, CircuitState,
    RetryHandler, RetryConfig, TimeoutManager, TimeoutConfig
)

# Create test client
client = TestClient(app)

class TestDebugEndpoints:
    """Test debug endpoints functionality"""
    
    def test_simulate_errors_success(self):
        """Test error simulation endpoint with success scenario"""
        response = client.get("/api/v1/debug/simulate-errors?probability=0.0")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Success - no error simulated"
        assert data["simulated"] == False
    
    def test_simulate_errors_with_error(self):
        """Test error simulation endpoint with error scenario"""
        response = client.get("/api/v1/debug/simulate-errors?probability=1.0&error_type=server_error")
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert data["detail"]["simulated"] == True
    
    def test_performance_test(self):
        """Test performance testing endpoint"""
        response = client.get("/api/v1/debug/performance-test?duration=1&requests_per_second=2")
        assert response.status_code == 200
        data = response.json()
        assert "test_configuration" in data
        assert "results" in data
        assert "recommendations" in data
    
    def test_request_info(self):
        """Test request information endpoint"""
        response = client.get("/api/v1/debug/request-info")
        assert response.status_code == 200
        data = response.json()
        assert "request_info" in data
        assert "server_info" in data
        assert data["request_info"]["method"] == "GET"
    
    def test_metrics_snapshot(self):
        """Test metrics snapshot endpoint"""
        response = client.get("/api/v1/debug/metrics-snapshot")
        assert response.status_code == 200
        data = response.json()
        assert "metrics_snapshot" in data

class TestCircuitBreaker:
    """Test circuit breaker functionality"""
    
    def test_circuit_breaker_creation(self):
        """Test circuit breaker creation and basic properties"""
        config = CircuitBreakerConfig(failure_threshold=3, recovery_timeout=30)
        circuit = CircuitBreaker("test_circuit", config)
        
        assert circuit.name == "test_circuit"
        assert circuit.state == CircuitState.CLOSED
        assert circuit.failure_count == 0
        assert circuit.success_count == 0
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_success(self):
        """Test circuit breaker with successful calls"""
        config = CircuitBreakerConfig(failure_threshold=3, recovery_timeout=30)
        circuit = CircuitBreaker("test_success", config)
        
        async def success_func():
            return "success"
        
        result = await circuit.call(success_func)
        assert result == "success"
        assert circuit.success_count == 1
        assert circuit.failure_count == 0
        assert circuit.state == CircuitState.CLOSED
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_failure(self):
        """Test circuit breaker with failing calls"""
        config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout=30)
        circuit = CircuitBreaker("test_failure", config)
        
        async def failure_func():
            raise Exception("Test failure")
        
        # First failure
        with pytest.raises(Exception):
            await circuit.call(failure_func)
        assert circuit.failure_count == 1
        assert circuit.state == CircuitState.CLOSED
        
        # Second failure should open the circuit
        with pytest.raises(Exception):
            await circuit.call(failure_func)
        assert circuit.failure_count == 2
        assert circuit.state == CircuitState.OPEN

class TestRetryHandler:
    """Test retry handler functionality"""
    
    def test_retry_handler_creation(self):
        """Test retry handler creation"""
        config = RetryConfig(max_attempts=3, base_delay=1.0)
        handler = RetryHandler(config)
        
        assert handler.config.max_attempts == 3
        assert handler.config.base_delay == 1.0
    
    @pytest.mark.asyncio
    async def test_retry_handler_success(self):
        """Test retry handler with successful operation"""
        config = RetryConfig(max_attempts=3, base_delay=0.1)
        handler = RetryHandler(config)
        
        async def success_func():
            return "success"
        
        result = await handler.execute_with_retry(success_func, "test_operation")
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_retry_handler_eventual_success(self):
        """Test retry handler that succeeds after failures"""
        config = RetryConfig(max_attempts=3, base_delay=0.1)
        handler = RetryHandler(config)
        
        call_count = 0
        
        async def eventual_success_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Temporary failure")
            return "success"
        
        result = await handler.execute_with_retry(eventual_success_func, "test_operation")
        assert result == "success"
        assert call_count == 3

class TestTimeoutManager:
    """Test timeout manager functionality"""
    
    def test_timeout_manager_creation(self):
        """Test timeout manager creation"""
        config = TimeoutConfig(default_timeout=30.0, short_timeout=5.0)
        manager = TimeoutManager(config)
        
        assert manager.config.default_timeout == 30.0
        assert manager.config.short_timeout == 5.0
    
    @pytest.mark.asyncio
    async def test_timeout_manager_success(self):
        """Test timeout manager with quick operation"""
        config = TimeoutConfig(default_timeout=1.0)
        manager = TimeoutManager(config)
        
        async def quick_func():
            await asyncio.sleep(0.1)
            return "success"
        
        result = await manager.with_timeout(quick_func, timeout=1.0, endpoint="test")
        assert result == "success"

class TestHealthIntegration:
    """Test health check integration"""
    
    def test_health_endpoint(self):
        """Test basic health endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_detailed_health_endpoint(self):
        """Test detailed health endpoint"""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        # The response should contain health information
        # Note: This might fail if database/redis are not available in test environment

class TestConfigurationIntegration:
    """Test configuration integration"""
    
    def test_configuration_loaded(self):
        """Test that configuration is properly loaded"""
        from app.core.config import settings
        
        # Test that circuit breaker settings are available
        assert hasattr(settings, 'CIRCUIT_BREAKER_STORAGE')
        assert hasattr(settings, 'HEALTH_CHECK_INTERVAL')
        assert hasattr(settings, 'RETRY_MAX_ATTEMPTS')
        
        # Test default values
        assert settings.CIRCUIT_BREAKER_FAILURE_THRESHOLD == 5
        assert settings.HEALTH_CHECK_INTERVAL == 30
        assert settings.RETRY_MAX_ATTEMPTS == 3

if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])