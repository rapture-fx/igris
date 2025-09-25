"""
Pytest configuration for Critical P0 Fixes Validation Testing
============================================================

This module provides comprehensive testing infrastructure for validating the three
critical P0 fixes:
1. RL optimization database model implementation
2. Data quality API runtime errors
3. Production security configuration

Ensures production readiness through comprehensive test coverage.
"""

import asyncio
import os
import tempfile
import uuid
from pathlib import Path
from typing import Generator, Dict, Any, AsyncGenerator
import logging
from datetime import datetime, timedelta

import pytest
import httpx
import pandas as pd
import io
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock

# Import application components
import sys
sys.path.append('/Users/wira/Desktop/schlep-engine/apps/api')

from app.main import app
from app.database.connection import get_async_session, Base
from app.auth.unified_auth_system import get_current_user, get_current_active_user
from app.core.config import settings

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///test_critical_fixes.db")
TEST_API_BASE_URL = os.getenv("TEST_API_BASE_URL", "http://localhost:8000")

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def temp_dir():
    """Create a temporary directory for test artifacts."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)

@pytest.fixture(scope="session")
async def test_db_engine(temp_dir):
    """Create test database engine."""
    if "sqlite" in TEST_DATABASE_URL:
        # Use temporary directory for SQLite
        db_path = temp_dir / "test_critical_fixes.db"
        database_url = f"sqlite+aiosqlite:///{db_path}"
    else:
        database_url = TEST_DATABASE_URL

    engine = create_async_engine(database_url, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    await engine.dispose()

@pytest.fixture(scope="function")
async def test_db_session(test_db_engine):
    """Create test database session with transaction rollback."""
    async_session_maker = async_sessionmaker(
        test_db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        # Begin a transaction
        await session.begin()

        yield session

        # Rollback the transaction
        await session.rollback()

@pytest.fixture(scope="function")
def override_get_db(test_db_session):
    """Override database dependency for testing."""
    async def _get_test_db():
        yield test_db_session

    return _get_test_db

@pytest.fixture(scope="function")
def test_client(override_get_db):
    """Create test client with database override."""
    app.dependency_overrides[get_async_session] = override_get_db

    with TestClient(app) as client:
        yield client

    # Clean up override
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
async def async_client(override_get_db):
    """Create async HTTP client for testing."""
    app.dependency_overrides[get_async_session] = override_get_db

    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client

    # Clean up override
    app.dependency_overrides.clear()

# Mock user fixtures for authentication testing
@pytest.fixture
def mock_user():
    """Create mock user for testing."""
    from app.database.models import User, UserRole

    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "test@example.com"
    user.username = "testuser"
    user.role = UserRole.USER
    user.is_active = True
    user.is_verified = True

    return user

@pytest.fixture
def mock_admin_user():
    """Create mock admin user for testing."""
    from app.database.models import User, UserRole

    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "admin@example.com"
    user.username = "adminuser"
    user.role = UserRole.ADMIN
    user.is_active = True
    user.is_verified = True

    return user

@pytest.fixture
def override_get_current_user(mock_user):
    """Override current user dependency for testing."""
    async def _get_current_user():
        return mock_user

    return _get_current_user

@pytest.fixture
def override_get_current_admin_user(mock_admin_user):
    """Override current admin user dependency for testing."""
    async def _get_current_admin_user():
        return mock_admin_user

    return _get_current_admin_user

@pytest.fixture
def authenticated_client(test_client, override_get_current_user):
    """Create authenticated test client."""
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_user

    yield test_client

    # Clean up overrides
    app.dependency_overrides.clear()

@pytest.fixture
def authenticated_async_client(async_client, override_get_current_user):
    """Create authenticated async test client."""
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_user

    yield async_client

    # Clean up overrides
    app.dependency_overrides.clear()

@pytest.fixture
def admin_authenticated_client(test_client, override_get_current_admin_user):
    """Create admin authenticated test client."""
    app.dependency_overrides[get_current_user] = override_get_current_admin_user
    app.dependency_overrides[get_current_active_user] = override_get_current_admin_user

    yield test_client

    # Clean up overrides
    app.dependency_overrides.clear()

# Test data fixtures for comprehensive testing
@pytest.fixture
def sample_csv_data():
    """Create sample CSV data for data quality testing."""
    data = {
        'id': [1, 2, 3, 4, 5, None, 7, 8, 9, 10],
        'name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'],
        'age': [25, 30, None, 28, 35, 32, 27, 29, 31, 26],
        'salary': [50000, 60000, 55000, 70000, 1000000, 58000, 52000, 61000, 59000, 54000],  # 1M is outlier
        'department': ['IT', 'HR', 'IT', 'Finance', 'IT', 'HR', 'Finance', 'IT', 'HR', 'Finance']
    }

    df = pd.DataFrame(data)
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    return csv_buffer.getvalue().encode('utf-8')

@pytest.fixture
def malformed_csv_data():
    """Create malformed CSV data for error testing."""
    malformed_data = """id,name,age,salary
1,Alice,25,50000
2,Bob,30
3,Charlie,invalid_age,55000
4,"Diana,28,70000
5,Eve,35,"""

    return malformed_data.encode('utf-8')

@pytest.fixture
def sample_json_data():
    """Create sample JSON data for data quality testing."""
    import json

    data = [
        {"id": 1, "name": "Alice", "score": 95.5, "active": True},
        {"id": 2, "name": "Bob", "score": 87.2, "active": False},
        {"id": 3, "name": "Charlie", "score": None, "active": True},
        {"id": 4, "name": "Diana", "score": 92.8, "active": True},
        {"id": 5, "name": "Eve", "score": 88.1, "active": None}
    ]

    return json.dumps(data).encode('utf-8')

@pytest.fixture
def malformed_json_data():
    """Create malformed JSON data for error testing."""
    malformed_json = '{"id": 1, "name": "Alice", "incomplete":'
    return malformed_json.encode('utf-8')

@pytest.fixture
def large_dataset():
    """Create large dataset for performance testing."""
    import json

    data = []
    for i in range(10000):
        data.append({
            "id": i,
            "name": f"User_{i}",
            "email": f"user_{i}@example.com",
            "score": (i * 7) % 100,
            "category": f"Category_{i % 10}",
            "metadata": {
                "created_at": "2023-01-01",
                "tags": [f"tag_{j}" for j in range(i % 5)]
            }
        })

    return json.dumps(data).encode('utf-8')

@pytest.fixture
def rl_optimization_test_config():
    """Configuration for RL optimization testing."""
    return {
        "hyperparameter_config": {
            "pipeline_id": "test_pipeline_001",
            "training_data_path": "/tmp/test_training_data.csv",
            "validation_data_path": "/tmp/test_validation_data.csv",
            "optimization_config": {
                "algorithm": "PPO",
                "max_episodes": 10,
                "learning_rate_range": [0.001, 0.01],
                "batch_size_range": [32, 128]
            },
            "max_runtime_hours": 1,
            "priority": 5
        },
        "resource_allocation_config": {
            "pipeline_configs": [
                {"id": "pipeline_1", "cpu_req": 2, "memory_req": "4Gi"},
                {"id": "pipeline_2", "cpu_req": 4, "memory_req": "8Gi"}
            ],
            "resource_constraints": {
                "max_cpu": 16,
                "max_memory": "32Gi",
                "max_pipelines": 10
            },
            "max_runtime_hours": 2,
            "priority": 7
        },
        "data_quality_config": {
            "data_processing_requirements": {
                "min_quality_score": 0.8,
                "max_missing_values_percent": 10,
                "outlier_detection": True,
                "bias_detection": True
            },
            "max_runtime_hours": 1,
            "priority": 6
        }
    }

@pytest.fixture
def security_test_scenarios():
    """Security testing scenarios for CSRF and authentication."""
    return {
        "csrf_scenarios": [
            {
                "name": "missing_csrf_token",
                "method": "POST",
                "headers": {},
                "cookies": {"csrftoken": "valid_token"},
                "expected_status": 403
            },
            {
                "name": "invalid_csrf_token",
                "method": "POST",
                "headers": {"x-csrf-token": "invalid_token"},
                "cookies": {"csrftoken": "valid_token"},
                "expected_status": 403
            },
            {
                "name": "missing_csrf_cookie",
                "method": "POST",
                "headers": {"x-csrf-token": "token"},
                "cookies": {},
                "expected_status": 403
            },
            {
                "name": "valid_csrf_protection",
                "method": "POST",
                "headers": {"x-csrf-token": "matching_token"},
                "cookies": {"csrftoken": "matching_token"},
                "expected_status": 200
            }
        ],
        "rate_limiting_scenarios": [
            {
                "name": "normal_rate",
                "requests_per_minute": 10,
                "expected_success": True
            },
            {
                "name": "exceeded_rate",
                "requests_per_minute": 150,  # Exceeds the 100/min limit
                "expected_success": False
            }
        ]
    }

# Performance testing fixtures
@pytest.fixture
def performance_thresholds():
    """Performance testing thresholds."""
    return {
        "data_quality_api": {
            "max_response_time_ms": 5000,  # 5 seconds for file processing
            "min_success_rate_percent": 95,
            "max_memory_usage_mb": 500
        },
        "rl_optimization": {
            "max_session_creation_time_ms": 1000,
            "min_success_rate_percent": 90,
            "max_memory_usage_mb": 1000
        },
        "security_middleware": {
            "max_response_time_ms": 100,  # Security checks should be fast
            "min_success_rate_percent": 99,
            "max_memory_usage_mb": 50
        },
        "database_operations": {
            "max_query_time_ms": 500,
            "min_success_rate_percent": 99,
            "max_memory_usage_mb": 200
        }
    }

@pytest.fixture
def load_test_config():
    """Load testing configuration."""
    return {
        "concurrent_users": [1, 5, 10, 20],
        "test_duration_seconds": 30,
        "ramp_up_seconds": 5,
        "endpoints_to_test": [
            "/api/v1/quality/assess",
            "/api/v1/rl/sessions",
            "/api/v1/health",
            "/api/v1/metrics"
        ]
    }

# Custom pytest markers
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "critical_fix: mark test as critical P0 fix validation")
    config.addinivalue_line("markers", "rl_optimization: mark test as RL optimization system test")
    config.addinivalue_line("markers", "data_quality: mark test as data quality API test")
    config.addinivalue_line("markers", "security: mark test as security configuration test")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "performance: mark test as performance test")
    config.addinivalue_line("markers", "load_test: mark test as load test")
    config.addinivalue_line("markers", "database: mark test as database test")

def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on test content."""
    for item in items:
        # Add markers based on test file location
        if "critical_fixes" in str(item.fspath):
            item.add_marker(pytest.mark.critical_fix)

        # Add specific markers based on test names
        if "rl_optimization" in item.name or "rl_" in item.name:
            item.add_marker(pytest.mark.rl_optimization)
        elif "data_quality" in item.name or "quality_" in item.name:
            item.add_marker(pytest.mark.data_quality)
        elif "security" in item.name or "csrf" in item.name or "auth" in item.name:
            item.add_marker(pytest.mark.security)
        elif "integration" in item.name:
            item.add_marker(pytest.mark.integration)
        elif "performance" in item.name or "load" in item.name:
            item.add_marker(pytest.mark.performance)
        elif "database" in item.name or "db_" in item.name:
            item.add_marker(pytest.mark.database)

@pytest.fixture(autouse=True)
def test_environment_setup(monkeypatch):
    """Setup test environment variables."""
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("ENVIRONMENT", "testing")
    monkeypatch.setenv("CSRF_PROTECTION_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMITING_ENABLED", "true")

# Test utilities
class TestMetrics:
    """Utility class for collecting test metrics."""

    def __init__(self):
        self.metrics = {}
        self.start_time = None
        self.end_time = None

    def start_timer(self):
        """Start timing a test."""
        self.start_time = datetime.utcnow()

    def end_timer(self):
        """End timing a test."""
        self.end_time = datetime.utcnow()
        if self.start_time:
            self.metrics['execution_time_ms'] = (
                self.end_time - self.start_time
            ).total_seconds() * 1000

    def record_metric(self, name: str, value: Any):
        """Record a metric."""
        self.metrics[name] = value

    def get_metrics(self) -> Dict[str, Any]:
        """Get all recorded metrics."""
        return self.metrics.copy()

    def assert_performance(self, thresholds: Dict[str, float]):
        """Assert performance meets thresholds."""
        for metric, threshold in thresholds.items():
            if metric in self.metrics:
                actual = self.metrics[metric]
                assert actual <= threshold, (
                    f"{metric} {actual} exceeds threshold {threshold}"
                )

@pytest.fixture
def test_metrics():
    """Provide test metrics collector."""
    return TestMetrics()

# Cleanup fixtures
@pytest.fixture(autouse=True)
def cleanup_test_artifacts():
    """Clean up test artifacts after each test."""
    yield

    # Clean up any test files
    test_patterns = [
        "test_*.csv",
        "test_*.json",
        "test_*.db",
        "critical_fixes_*.log"
    ]

    current_dir = Path.cwd()
    for pattern in test_patterns:
        for file in current_dir.glob(pattern):
            try:
                file.unlink()
                logger.debug(f"Cleaned up test file: {file}")
            except OSError as e:
                logger.warning(f"Could not clean up {file}: {e}")

# Database state verification utilities
class DatabaseStateVerifier:
    """Utility for verifying database state in tests."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def verify_rl_session_exists(self, session_id: str) -> bool:
        """Verify RL optimization session exists in database."""
        # RLOptimizationSession removed - replaced with placeholder

        result = await self.session.execute(
            text("SELECT COUNT(*) FROM rl_optimization_sessions WHERE id = :session_id"),
            {"session_id": session_id}
        )
        count = result.scalar()
        return count > 0

    async def verify_rl_session_status(self, session_id: str, expected_status: str) -> bool:
        """Verify RL optimization session has expected status."""
        result = await self.session.execute(
            text("SELECT status FROM rl_optimization_sessions WHERE id = :session_id"),
            {"session_id": session_id}
        )
        status = result.scalar()
        return status == expected_status

    async def get_rl_session_count(self) -> int:
        """Get total number of RL optimization sessions."""
        result = await self.session.execute(
            text("SELECT COUNT(*) FROM rl_optimization_sessions")
        )
        return result.scalar()

    async def verify_table_exists(self, table_name: str) -> bool:
        """Verify database table exists."""
        if "sqlite" in str(self.session.bind.url):
            result = await self.session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
                {"table_name": table_name}
            )
        else:
            result = await self.session.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_name=:table_name"),
                {"table_name": table_name}
            )
        return result.scalar() is not None

@pytest.fixture
def db_verifier(test_db_session):
    """Provide database state verifier."""
    return DatabaseStateVerifier(test_db_session)