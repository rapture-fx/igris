"""
API-specific pytest configuration.
Provides fixtures and setup specific to the FastAPI application.
"""

import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import Mock, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Import app modules (paths are set up by root conftest.py)
try:
    from app.main import app
    from app.database.connection import get_async_session, get_test_database_url
    from app.core.config import get_settings
    # RL services removed - replaced with placeholder optimizers
    API_IMPORTS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: API imports not available: {e}")
    API_IMPORTS_AVAILABLE = False

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI app."""
    if not API_IMPORTS_AVAILABLE:
        pytest.skip("API imports not available")
    
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Create an async database session for testing."""
    if not API_IMPORTS_AVAILABLE:
        pytest.skip("API imports not available")
    
    try:
        # Create test engine
        engine = create_async_engine(
            get_test_database_url(),
            echo=False,
            pool_pre_ping=True
        )
        
        # Create session maker
        async_session_maker = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session_maker() as session:
            yield session
            await session.rollback()  # Rollback any changes
            
    except Exception as e:
        pytest.skip(f"Test database not available: {e}")

@pytest.fixture
def override_get_async_session(async_session: AsyncSession):
    """Override the database dependency for testing."""
    if not API_IMPORTS_AVAILABLE:
        pytest.skip("API imports not available")
    
    async def _get_test_session():
        yield async_session
    
    app.dependency_overrides[get_async_session] = _get_test_session
    yield
    app.dependency_overrides = {}

@pytest.fixture
async def rl_crud(async_session: AsyncSession):
    """Create RL CRUD instance for testing."""
    if not API_IMPORTS_AVAILABLE:
        pytest.skip("API imports not available")
    
    return RLOptimizationCRUD(async_session)

@pytest.fixture
async def rl_service(rl_crud):
    """Create RL service instance for testing."""
    if not API_IMPORTS_AVAILABLE:
        pytest.skip("API imports not available")
    
    return RLOptimizationService(crud=rl_crud)

@pytest.fixture
def sample_rl_session_data() -> dict:
    """Sample data for creating RL sessions."""
    return {
        "pipeline_id": "test_pipeline_001",
        "optimization_type": "hyperparameter",
        "strategy": "ppo",
        "objective": "accuracy",
        "config": {
            "max_episodes": 10,
            "learning_rate": 0.001,
            "batch_size": 32
        },
        "status": "PENDING",
        "user_id": "test_user_123"
    }

@pytest.fixture
async def sample_rl_session(
    rl_crud, 
    sample_rl_session_data: dict
):
    """Create a sample RL session for testing."""
    if not API_IMPORTS_AVAILABLE:
        pytest.skip("API imports not available")
    
    session = await rl_crud.create_session(**sample_rl_session_data)
    return session

@pytest.fixture
def mock_celery_task():
    """Mock Celery task for testing without actual task execution."""
    mock_task = Mock()
    mock_task.id = "test_task_123"
    mock_task.delay.return_value = mock_task
    return mock_task

@pytest.fixture
def mock_rl_training():
    """Mock RL training components."""
    from unittest.mock import patch, MagicMock
    
    with patch('stable_baselines3.PPO') as mock_ppo, \
         patch('gym.make') as mock_gym:
        
        # Mock PPO agent
        mock_agent = MagicMock()
        mock_agent.learn.return_value = None
        mock_agent.predict.return_value = ([0.7], None)
        mock_ppo.return_value = mock_agent
        
        # Mock Gym environment
        mock_env = MagicMock()
        mock_env.reset.return_value = [0.1, 0.2, 0.3, 0.4, 0.5]
        mock_env.step.return_value = ([0.2, 0.3, 0.4, 0.5, 0.6], 0.85, False, {})
        mock_env.close.return_value = None
        mock_gym.return_value = mock_env
        
        yield {
            'agent': mock_agent,
            'environment': mock_env,
            'ppo_class': mock_ppo,
            'gym_make': mock_gym
        }

@pytest.fixture
def test_optimization_request():
    """Sample optimization request for API testing."""
    return {
        "pipeline_id": "test_pipeline_001",
        "training_data_path": "/test/data/train.csv",
        "validation_data_path": "/test/data/val.csv",
        "optimization_config": {
            "strategy": "ppo",
            "objective": "accuracy", 
            "max_episodes": 5,
            "max_runtime_hours": 1
        },
        "priority": 5
    }

@pytest.fixture
def mock_current_user():
    """Mock current user for authentication testing."""
    user = Mock()
    user.id = "test_user_123"
    user.email = "test@schlepengine.com"
    user.role = Mock()
    user.role.value = "user"
    return user

@pytest.fixture
def mock_admin_user():
    """Mock admin user for authorization testing."""
    user = Mock() 
    user.id = "admin_user_123"
    user.email = "admin@schlepengine.com"
    user.role = Mock()
    user.role.value = "admin"
    return user

# Utility functions for testing
def assert_valid_uuid(uuid_string: str):
    """Assert that a string is a valid UUID."""
    import uuid
    try:
        uuid.UUID(uuid_string)
        return True
    except ValueError:
        return False

def assert_valid_iso_datetime(datetime_string: str):
    """Assert that a string is a valid ISO datetime."""
    from datetime import datetime
    try:
        datetime.fromisoformat(datetime_string.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False

# Skip decorator for tests requiring external dependencies
skip_if_no_db = pytest.mark.skipif(
    not API_IMPORTS_AVAILABLE,
    reason="Database or API imports not available"
)

skip_if_no_redis = pytest.mark.skipif(
    True,  # Always skip Redis tests unless explicitly configured
    reason="Redis not configured for testing"
)

skip_if_no_ml_libs = pytest.mark.skipif(
    True,  # Skip ML tests by default
    reason="ML libraries not configured for testing"
)