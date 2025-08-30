"""
Pytest configuration for Schlep-engine performance testing
========================================================

This module provides shared fixtures and configuration for all performance tests,
ensuring consistent test environments and data setup across the testing suite.
"""

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Generator, Dict, Any
import logging

import pytest
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite:///test_performance.db")
TEST_API_BASE_URL = os.getenv("TEST_API_BASE_URL", "http://localhost:8000")

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def temp_dir():
    """Create a temporary directory for test artifacts."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)

@pytest.fixture(scope="session")
def test_database_url(temp_dir):
    """Provide test database URL."""
    if "sqlite" in TEST_DATABASE_URL:
        # Use temporary directory for SQLite
        db_path = temp_dir / "test_performance.db"
        return f"sqlite:///{db_path}"
    return TEST_DATABASE_URL

@pytest.fixture(scope="function")
async def http_client():
    """Provide HTTP client for API testing."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        yield client

@pytest.fixture(scope="function")
def performance_config():
    """Provide performance test configuration."""
    return {
        "base_url": TEST_API_BASE_URL,
        "default_iterations": 10,  # Reduced for faster tests
        "default_concurrent_requests": 5,
        "timeout_seconds": 30,
        "memory_sample_interval": 0.1,
        "performance_thresholds": {
            "max_response_time_ms": 1000,
            "min_success_rate_percent": 90,
            "max_memory_increase_mb": 100,
            "min_throughput_rps": 1
        }
    }

@pytest.fixture(scope="function")
def sample_test_data():
    """Provide sample test data for performance tests."""
    return {
        "small_dataset": [
            {"id": i, "name": f"Item {i}", "value": i * 10}
            for i in range(100)
        ],
        "medium_dataset": [
            {"id": i, "name": f"Item {i}", "value": i * 10, "category": f"Cat {i % 5}"}
            for i in range(1000)
        ],
        "large_dataset": [
            {
                "id": i, 
                "name": f"Item {i}", 
                "value": i * 10,
                "category": f"Category {i % 10}",
                "metadata": {"created": "2023-01-01", "tags": [f"tag{j}" for j in range(3)]}
            }
            for i in range(5000)
        ]
    }

@pytest.fixture(scope="function")
def mock_api_responses():
    """Provide mock API responses for testing."""
    return {
        "health": {"status": "healthy", "timestamp": "2023-01-01T00:00:00Z"},
        "auth_status": {"authenticated": False, "user": None},
        "data_process": {"success": True, "processed_count": 0, "job_id": "test-job"}
    }

# Performance test markers
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "performance: mark test as a performance test")
    config.addinivalue_line("markers", "load_test: mark test as a load test")
    config.addinivalue_line("markers", "memory_test: mark test as a memory profiling test")
    config.addinivalue_line("markers", "volume_test: mark test as a data volume test")
    config.addinivalue_line("markers", "regression_test: mark test as a regression test")

def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on test location."""
    for item in items:
        # Add performance marker to all tests in performance test files
        if "performance" in str(item.fspath):
            item.add_marker(pytest.mark.performance)
        
        # Add specific markers based on test file names
        if "load_test" in str(item.fspath):
            item.add_marker(pytest.mark.load_test)
        elif "memory_profiling" in str(item.fspath):
            item.add_marker(pytest.mark.memory_test)
        elif "volume_test" in str(item.fspath):
            item.add_marker(pytest.mark.volume_test)

@pytest.fixture(autouse=True)
def test_environment_setup(monkeypatch):
    """Setup test environment variables."""
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("PERFORMANCE_TESTING", "true")

# Cleanup fixtures
@pytest.fixture(scope="function", autouse=True)
def cleanup_test_files():
    """Clean up test files after each test."""
    yield
    
    # Clean up any test artifacts
    test_patterns = [
        "test_*.json",
        "load_test_*.csv",
        "memory_*.html",
        "performance_*.db"
    ]
    
    current_dir = Path.cwd()
    for pattern in test_patterns:
        for file in current_dir.glob(pattern):
            try:
                file.unlink()
            except OSError:
                pass  # File might be in use

# Custom assertions for performance tests
class PerformanceAssertions:
    """Custom assertions for performance testing."""
    
    @staticmethod
    def assert_response_time(actual_ms: float, max_ms: float, test_name: str = ""):
        """Assert response time is within acceptable limits."""
        assert actual_ms <= max_ms, (
            f"{test_name} response time {actual_ms:.2f}ms exceeds limit of {max_ms}ms"
        )
    
    @staticmethod
    def assert_throughput(actual_rps: float, min_rps: float, test_name: str = ""):
        """Assert throughput meets minimum requirements."""
        assert actual_rps >= min_rps, (
            f"{test_name} throughput {actual_rps:.2f} req/s below minimum of {min_rps} req/s"
        )
    
    @staticmethod
    def assert_success_rate(actual_percent: float, min_percent: float, test_name: str = ""):
        """Assert success rate meets minimum requirements."""
        assert actual_percent >= min_percent, (
            f"{test_name} success rate {actual_percent:.1f}% below minimum of {min_percent}%"
        )
    
    @staticmethod
    def assert_memory_usage(actual_mb: float, max_mb: float, test_name: str = ""):
        """Assert memory usage is within acceptable limits."""
        assert actual_mb <= max_mb, (
            f"{test_name} memory usage {actual_mb:.2f}MB exceeds limit of {max_mb}MB"
        )
    
    @staticmethod
    def assert_no_memory_leaks(baseline_mb: float, final_mb: float, 
                              tolerance_mb: float = 10, test_name: str = ""):
        """Assert no significant memory leaks detected."""
        memory_increase = final_mb - baseline_mb
        assert memory_increase <= tolerance_mb, (
            f"{test_name} potential memory leak detected: {memory_increase:.2f}MB increase"
        )

@pytest.fixture
def performance_assertions():
    """Provide performance assertion helpers."""
    return PerformanceAssertions()

# Test data generation helpers
class TestDataFactory:
    """Factory for generating test data."""
    
    @staticmethod
    def create_user_data(count: int) -> list:
        """Create user test data."""
        return [
            {
                "id": i,
                "username": f"user{i}",
                "email": f"user{i}@test.com",
                "active": i % 2 == 0
            }
            for i in range(count)
        ]
    
    @staticmethod
    def create_transaction_data(count: int) -> list:
        """Create transaction test data."""
        import random
        return [
            {
                "id": i,
                "amount": random.uniform(10.0, 1000.0),
                "currency": random.choice(["USD", "EUR", "GBP"]),
                "status": random.choice(["completed", "pending", "failed"])
            }
            for i in range(count)
        ]
    
    @staticmethod
    def create_large_payload(size_mb: float) -> dict:
        """Create large payload for testing."""
        # Generate approximately size_mb of JSON data
        chars_per_mb = 1024 * 1024
        target_chars = int(size_mb * chars_per_mb)
        
        data = []
        current_chars = 0
        i = 0
        
        while current_chars < target_chars:
            item = {
                "id": i,
                "data": "x" * 1000,  # 1KB of data per item
                "metadata": {"index": i, "type": "large_payload_test"}
            }
            data.append(item)
            current_chars += len(str(item))
            i += 1
        
        return {"payload": data, "size_info": {"target_mb": size_mb, "actual_items": len(data)}}

@pytest.fixture
def test_data_factory():
    """Provide test data factory."""
    return TestDataFactory()

# Performance monitoring context managers
@pytest.fixture
def performance_monitor(performance_config):
    """Provide performance monitoring context."""
    class PerformanceMonitor:
        def __init__(self, config):
            self.config = config
            self.results = {}
        
        def record_metric(self, name: str, value: float):
            """Record a performance metric."""
            self.results[name] = value
        
        def get_results(self) -> dict:
            """Get recorded results."""
            return self.results.copy()
    
    return PerformanceMonitor(performance_config)

# Benchmarking fixtures
@pytest.fixture
def benchmark_comparison():
    """Provide benchmark comparison utilities."""
    class BenchmarkComparison:
        def __init__(self):
            self.baselines = {}
        
        def set_baseline(self, test_name: str, metrics: dict):
            """Set baseline metrics for comparison."""
            self.baselines[test_name] = metrics
        
        def compare_with_baseline(self, test_name: str, current_metrics: dict) -> dict:
            """Compare current metrics with baseline."""
            if test_name not in self.baselines:
                return {"status": "no_baseline", "changes": {}}
            
            baseline = self.baselines[test_name]
            changes = {}
            
            for metric, current_value in current_metrics.items():
                if metric in baseline:
                    baseline_value = baseline[metric]
                    if baseline_value > 0:
                        change_percent = ((current_value - baseline_value) / baseline_value) * 100
                        changes[metric] = {
                            "current": current_value,
                            "baseline": baseline_value,
                            "change_percent": change_percent
                        }
            
            return {"status": "compared", "changes": changes}
    
    return BenchmarkComparison()

# Skip conditions for performance tests
def skip_if_no_api_server():
    """Skip test if API server is not running."""
    import requests
    try:
        response = requests.get(f"{TEST_API_BASE_URL}/health", timeout=5)
        return response.status_code != 200
    except:
        return True

skip_without_api = pytest.mark.skipif(
    skip_if_no_api_server(),
    reason="API server not running"
)