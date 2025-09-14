"""
Integration Test Configuration for Schlep-engine API

This module provides comprehensive test fixtures and configurations for integration testing
all P0 and P1 features including rate limiting, RL optimization, data quality, and system components.

Key Features:
- Database testing with PostgreSQL isolation
- Redis cache and rate limiting testing
- Mock S3 cloud storage integration
- Authentication and authorization testing
- Performance monitoring and metrics testing
"""

import asyncio
import pytest
import pytest_asyncio
from typing import Dict, Any, AsyncGenerator, List, Optional
import httpx
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.pool import StaticPool
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis
from unittest.mock import AsyncMock, MagicMock, patch
import tempfile
import os
import json
from datetime import datetime, timedelta
import uuid
from pathlib import Path

# Import application components
from app.main import app
from app.database.connection import get_async_session, Base
from app.auth.unified_auth_system import create_access_token, get_current_user
from app.core.config import settings
from app.middleware.rate_limiting_middleware import RateLimitingMiddleware, RateLimitConfig, RateLimitType
from app.auth.enhanced_security import SecurityLevel
from app.services.rl_optimization_service import RLOptimizationService
from app.services.data_quality_service import data_quality_service

# Test database configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_integration.db"


class TestConfig:
    """Centralized test configuration"""

    # Database settings
    TEST_DB_URL = TEST_DATABASE_URL
    TEST_REDIS_URL = "redis://localhost:6379/1"  # Use DB 1 for tests

    # Authentication settings
    TEST_SECRET_KEY = "test-secret-key-for-integration-tests"
    TEST_ALGORITHM = "HS256"

    # Test user profiles
    ADMIN_USER = {
        "id": "admin-test-user-id",
        "email": "admin@test.com",
        "role": "admin",
        "security_level": SecurityLevel.HIGH.value
    }

    REGULAR_USER = {
        "id": "regular-test-user-id",
        "email": "user@test.com",
        "role": "user",
        "security_level": SecurityLevel.MEDIUM.value
    }

    # Rate limiting test configurations
    RATE_LIMIT_CONFIGS = {
        "strict": RateLimitConfig(
            requests_per_minute=5,
            requests_per_hour=20,
            rate_limit_type=RateLimitType.IP_BASED,
            bypass_for_admin=False
        ),
        "user_based": RateLimitConfig(
            requests_per_minute=10,
            requests_per_hour=100,
            rate_limit_type=RateLimitType.USER_BASED,
            bypass_for_admin=True
        ),
        "admin_bypass": RateLimitConfig(
            requests_per_minute=1,
            requests_per_hour=5,
            rate_limit_type=RateLimitType.IP_BASED,
            bypass_for_admin=True
        )
    }

    # ML Pipeline test configurations
    ML_PIPELINE_CONFIGS = {
        "hyperparameter_optimization": {
            "pipeline_id": "test-hp-pipeline",
            "training_data_path": "/tmp/test_train_data.csv",
            "validation_data_path": "/tmp/test_val_data.csv",
            "optimization_config": {
                "max_episodes": 10,
                "strategy": "PPO",
                "objective": "maximize_accuracy"
            }
        },
        "resource_allocation": {
            "pipeline_configs": [
                {"id": "pipeline1", "cpu": 2, "memory": "4GB"},
                {"id": "pipeline2", "cpu": 4, "memory": "8GB"}
            ],
            "resource_constraints": {"max_cpu": 8, "max_memory": "16GB"}
        }
    }

    # Performance test thresholds
    PERFORMANCE_THRESHOLDS = {
        "api_response_time_ms": 500,
        "database_query_time_ms": 100,
        "redis_operation_time_ms": 10,
        "ml_pipeline_startup_time_s": 30,
        "memory_usage_mb": 512
    }


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_db_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create test database engine with proper isolation."""
    engine = create_async_engine(
        TestConfig.TEST_DB_URL,
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False}
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def test_db_session(test_db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Create isolated database session for each test."""
    async_session = sessionmaker(
        test_db_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session() as session:
        # Start transaction
        async with session.begin():
            yield session
            # Rollback after test
            await session.rollback()


@pytest_asyncio.fixture
async def test_redis_client() -> AsyncGenerator[redis.Redis, None]:
    """Create test Redis client with proper cleanup."""
    client = redis.from_url(TestConfig.TEST_REDIS_URL)

    # Clear test database
    await client.flushdb()

    yield client

    # Cleanup after test
    await client.flushdb()
    await client.aclose()


@pytest.fixture
def test_app_with_db(test_db_session: AsyncSession, test_redis_client: redis.Redis):
    """Create FastAPI test app with test database and Redis."""

    # Override dependencies
    def get_test_db():
        return test_db_session

    app.dependency_overrides[get_async_session] = get_test_db

    # Mock Redis in rate limiting
    with patch("app.middleware.rate_limiting_middleware.redis") as mock_redis:
        mock_redis.from_url.return_value = test_redis_client
        yield app

    # Clear overrides
    app.dependency_overrides.clear()


@pytest.fixture
def test_client(test_app_with_db):
    """Create test client for API testing."""
    return TestClient(test_app_with_db)


@pytest_asyncio.fixture
async def async_test_client(test_app_with_db) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create async test client for concurrent testing."""
    async with httpx.AsyncClient(
        app=test_app_with_db,
        base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
def admin_token() -> str:
    """Create admin user JWT token."""
    return create_access_token(
        data={
            "sub": TestConfig.ADMIN_USER["id"],
            "email": TestConfig.ADMIN_USER["email"],
            "role": TestConfig.ADMIN_USER["role"],
            "security_level": TestConfig.ADMIN_USER["security_level"]
        },
        expires_delta=timedelta(hours=1)
    )


@pytest.fixture
def regular_user_token() -> str:
    """Create regular user JWT token."""
    return create_access_token(
        data={
            "sub": TestConfig.REGULAR_USER["id"],
            "email": TestConfig.REGULAR_USER["email"],
            "role": TestConfig.REGULAR_USER["role"],
            "security_level": TestConfig.REGULAR_USER["security_level"]
        },
        expires_delta=timedelta(hours=1)
    )


@pytest.fixture
def auth_headers_admin(admin_token: str) -> Dict[str, str]:
    """Create authorization headers for admin user."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_user(regular_user_token: str) -> Dict[str, str]:
    """Create authorization headers for regular user."""
    return {"Authorization": f"Bearer {regular_user_token}"}


@pytest_asyncio.fixture
async def mock_s3_client():
    """Create mock S3 client for cloud storage testing."""
    mock_client = AsyncMock()

    # Mock S3 operations
    mock_client.put_object.return_value = {"ETag": "test-etag"}
    mock_client.get_object.return_value = {
        "Body": AsyncMock(),
        "ContentLength": 1024,
        "LastModified": datetime.utcnow()
    }
    mock_client.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "test-file.txt", "Size": 1024, "LastModified": datetime.utcnow()}
        ]
    }
    mock_client.delete_object.return_value = {}

    with patch("app.services.cloud_storage.get_s3_client", return_value=mock_client):
        yield mock_client


@pytest_asyncio.fixture
async def sample_ml_data():
    """Create sample ML training data for testing."""
    import pandas as pd
    import numpy as np

    # Generate synthetic dataset
    np.random.seed(42)
    n_samples = 1000

    data = {
        "feature1": np.random.normal(0, 1, n_samples),
        "feature2": np.random.exponential(1, n_samples),
        "feature3": np.random.uniform(0, 10, n_samples),
        "category": np.random.choice(["A", "B", "C"], n_samples),
        "target": np.random.randint(0, 2, n_samples)
    }

    df = pd.DataFrame(data)

    # Create temporary files
    train_file = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)
    val_file = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)

    # Split data
    train_df = df.iloc[:800]
    val_df = df.iloc[800:]

    train_df.to_csv(train_file.name, index=False)
    val_df.to_csv(val_file.name, index=False)

    yield {
        "train_path": train_file.name,
        "val_path": val_file.name,
        "train_data": train_df,
        "val_data": val_df
    }

    # Cleanup
    os.unlink(train_file.name)
    os.unlink(val_file.name)


@pytest_asyncio.fixture
async def mock_rl_service(test_db_session: AsyncSession):
    """Create mock RL optimization service for testing."""
    service = RLOptimizationService(test_db_session)

    # Mock the ML components that might not be available in test environment
    with patch.object(service, '_initialize_rl_environment') as mock_init:
        mock_init.return_value = True
        yield service


@pytest.fixture
def rate_limit_test_config():
    """Provide rate limiting test configurations."""
    return TestConfig.RATE_LIMIT_CONFIGS


@pytest.fixture
def performance_monitor():
    """Performance monitoring fixture for load testing."""
    class PerformanceMonitor:
        def __init__(self):
            self.metrics = {
                "response_times": [],
                "memory_usage": [],
                "error_counts": {},
                "throughput": 0
            }

        def record_response_time(self, duration_ms: float):
            self.metrics["response_times"].append(duration_ms)

        def record_memory_usage(self, memory_mb: float):
            self.metrics["memory_usage"].append(memory_mb)

        def record_error(self, error_type: str):
            self.metrics["error_counts"][error_type] = \
                self.metrics["error_counts"].get(error_type, 0) + 1

        def calculate_stats(self) -> Dict[str, Any]:
            response_times = self.metrics["response_times"]
            return {
                "avg_response_time": sum(response_times) / len(response_times) if response_times else 0,
                "max_response_time": max(response_times) if response_times else 0,
                "min_response_time": min(response_times) if response_times else 0,
                "p95_response_time": sorted(response_times)[int(len(response_times) * 0.95)] if response_times else 0,
                "total_requests": len(response_times),
                "error_rate": sum(self.metrics["error_counts"].values()) / len(response_times) if response_times else 0,
                "errors_by_type": self.metrics["error_counts"]
            }

    return PerformanceMonitor()


@pytest_asyncio.fixture
async def integration_test_data():
    """Comprehensive test data for integration scenarios."""
    return {
        "users": {
            "admin": TestConfig.ADMIN_USER,
            "regular": TestConfig.REGULAR_USER
        },
        "ml_configs": TestConfig.ML_PIPELINE_CONFIGS,
        "test_files": {
            "csv_data": "feature1,feature2,target\n1,2,0\n3,4,1\n5,6,0",
            "json_data": {"test": "data", "values": [1, 2, 3]},
            "invalid_data": "invalid,csv,data\nwith,missing,values\n"
        },
        "api_endpoints": {
            "rl_optimization": "/api/v1/rl/hyperparameters/optimize",
            "data_quality": "/api/v1/quality/assess",
            "ml_pipeline": "/api/v1/ml/pipeline/create",
            "monitoring": "/api/v1/monitoring/metrics"
        }
    }


@pytest.fixture(scope="session")
def test_environment_setup():
    """Set up test environment variables and configurations."""
    original_env = os.environ.copy()

    # Set test environment variables
    os.environ.update({
        "ENVIRONMENT": "test",
        "DATABASE_URL": TestConfig.TEST_DB_URL,
        "REDIS_URL": TestConfig.TEST_REDIS_URL,
        "SECRET_KEY": TestConfig.TEST_SECRET_KEY,
        "ENABLE_STREAM_PRODUCERS": "false",  # Disable streaming for tests
        "ENABLE_MODEL_SERVING": "false",     # Disable model serving for tests
        "LOG_LEVEL": "WARNING"               # Reduce log noise in tests
    })

    yield

    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def load_test_scenarios():
    """Define load testing scenarios for performance validation."""
    return {
        "light_load": {
            "concurrent_users": 10,
            "requests_per_user": 50,
            "ramp_up_time": 5
        },
        "moderate_load": {
            "concurrent_users": 50,
            "requests_per_user": 100,
            "ramp_up_time": 15
        },
        "heavy_load": {
            "concurrent_users": 100,
            "requests_per_user": 200,
            "ramp_up_time": 30
        },
        "stress_test": {
            "concurrent_users": 200,
            "requests_per_user": 500,
            "ramp_up_time": 60
        }
    }


class IntegrationTestHelpers:
    """Helper methods for integration testing."""

    @staticmethod
    async def wait_for_service_ready(client: httpx.AsyncClient, endpoint: str, timeout: int = 30):
        """Wait for service to be ready."""
        import asyncio
        for _ in range(timeout):
            try:
                response = await client.get(endpoint)
                if response.status_code == 200:
                    return True
            except:
                pass
            await asyncio.sleep(1)
        return False

    @staticmethod
    def create_test_file(content: str, file_type: str = "csv") -> str:
        """Create temporary test file."""
        suffix = f".{file_type}"
        temp_file = tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name

    @staticmethod
    async def simulate_concurrent_requests(
        client: httpx.AsyncClient,
        endpoint: str,
        method: str = "GET",
        count: int = 10,
        **kwargs
    ) -> List[httpx.Response]:
        """Simulate concurrent requests for load testing."""
        tasks = []
        for _ in range(count):
            if method.upper() == "GET":
                tasks.append(client.get(endpoint, **kwargs))
            elif method.upper() == "POST":
                tasks.append(client.post(endpoint, **kwargs))
            elif method.upper() == "PUT":
                tasks.append(client.put(endpoint, **kwargs))
            elif method.upper() == "DELETE":
                tasks.append(client.delete(endpoint, **kwargs))

        return await asyncio.gather(*tasks, return_exceptions=True)


@pytest.fixture
def integration_helpers():
    """Provide integration test helper methods."""
    return IntegrationTestHelpers


# Pytest configuration
def pytest_configure(config):
    """Configure pytest for integration testing."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "load_test: mark test as load test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )


def pytest_collection_modifyitems(config, items):
    """Add markers to tests based on their location."""
    for item in items:
        if "integration_tests" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        if "performance" in str(item.fspath) or "load" in str(item.fspath):
            item.add_marker(pytest.mark.performance)