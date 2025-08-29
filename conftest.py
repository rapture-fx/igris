"""
Global pytest configuration for the Schlep Engine monorepo.
Handles Python path setup and environment configuration for all sub-projects.
"""

import sys
import os
from pathlib import Path
import pytest
from dotenv import load_dotenv

# Get the root directory of the monorepo
REPO_ROOT = Path(__file__).parent
APPS_DIR = REPO_ROOT / "apps"
PACKAGES_DIR = REPO_ROOT / "packages"

def setup_python_paths():
    """Add all sub-project paths to sys.path for imports to work correctly."""
    paths_to_add = [
        # API app
        str(APPS_DIR / "api"),
        
        # CLI package
        str(PACKAGES_DIR / "cli" / "src"),
        
        # Python SDK package  
        str(PACKAGES_DIR / "python-sdk" / "src"),
        
        # Add root for any shared utilities
        str(REPO_ROOT),
    ]
    
    for path in paths_to_add:
        if os.path.exists(path) and path not in sys.path:
            sys.path.insert(0, path)

def setup_test_environment():
    """Load test environment variables."""
    # Set testing flags FIRST before any imports
    os.environ["TESTING"] = "true"
    os.environ["ENVIRONMENT"] = "testing"
    
    # Load test environment file
    test_env_file = REPO_ROOT / ".env.test"
    if test_env_file.exists():
        load_dotenv(test_env_file, override=True)

# Setup paths and environment before any imports
setup_python_paths()
setup_test_environment()

# Now we can safely import app modules
try:
    from apps.api.app.database.connection import get_test_database_url
    from apps.api.app.core.config import get_settings
    TEST_IMPORTS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import app modules: {e}")
    TEST_IMPORTS_AVAILABLE = False

@pytest.fixture(scope="session", autouse=True)
def setup_test_session():
    """Session-wide test setup."""
    print("Setting up test session...")
    
    # Create test directories
    test_dirs = [
        REPO_ROOT / "test_checkpoints",
        REPO_ROOT / "test_logs", 
        REPO_ROOT / "test_uploads"
    ]
    
    for test_dir in test_dirs:
        test_dir.mkdir(exist_ok=True)
    
    yield
    
    # Cleanup after tests
    print("Cleaning up test session...")
    import shutil
    for test_dir in test_dirs:
        if test_dir.exists():
            shutil.rmtree(test_dir, ignore_errors=True)

@pytest.fixture
def test_settings():
    """Provide test settings."""
    if not TEST_IMPORTS_AVAILABLE:
        pytest.skip("App imports not available")
    
    return get_settings()

@pytest.fixture
async def test_db_session():
    """Provide async test database session."""
    if not TEST_IMPORTS_AVAILABLE:
        pytest.skip("App imports not available")
        
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        
        # Use test database URL
        engine = create_async_engine(
            get_test_database_url(),
            echo=False,
            pool_pre_ping=True
        )
        
        async_session_maker = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session_maker() as session:
            yield session
            
    except Exception as e:
        pytest.skip(f"Database not available for testing: {e}")

@pytest.fixture
def mock_rl_dependencies():
    """Mock RL dependencies for testing without actual training."""
    import unittest.mock as mock
    
    with mock.patch('stable_baselines3.PPO') as mock_ppo, \
         mock.patch('gym.make') as mock_gym, \
         mock.patch('app.services.rl.monitoring.rl_monitor.RLPerformanceMonitor') as mock_monitor:
        
        # Mock RL agent
        mock_agent = mock.MagicMock()
        mock_agent.learn.return_value = None
        mock_agent.predict.return_value = ([0.5], None)
        mock_ppo.return_value = mock_agent
        
        # Mock environment
        mock_env = mock.MagicMock()
        mock_env.reset.return_value = [0.1, 0.2, 0.3]
        mock_env.step.return_value = ([0.2, 0.3, 0.4], 0.8, True, {})
        mock_gym.return_value = mock_env
        
        # Mock monitor
        mock_monitor_instance = mock.MagicMock()
        mock_monitor.return_value = mock_monitor_instance
        
        yield {
            'ppo': mock_ppo,
            'gym': mock_gym, 
            'monitor': mock_monitor,
            'agent': mock_agent,
            'env': mock_env
        }

# Pytest collection hooks for monorepo
def pytest_collection_modifyitems(config, items):
    """Modify test collection for monorepo structure."""
    for item in items:
        # Add markers based on test path
        if "apps/api/tests" in str(item.fspath):
            item.add_marker(pytest.mark.api)
        elif "packages/cli/tests" in str(item.fspath):
            item.add_marker(pytest.mark.cli)
        elif "packages/python-sdk/tests" in str(item.fspath):
            item.add_marker(pytest.mark.sdk)
        
        # Add RL marker for RL-related tests
        if "rl" in str(item.fspath) or "rl" in item.name:
            item.add_marker(pytest.mark.rl)
        
        # Mark slow tests
        if "integration" in str(item.fspath) or "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.slow)

def pytest_configure(config):
    """Configure pytest for monorepo."""
    # Register custom markers
    config.addinivalue_line(
        "markers", "api: Tests for the API application"
    )
    config.addinivalue_line(
        "markers", "cli: Tests for the CLI package"
    )
    config.addinivalue_line(
        "markers", "sdk: Tests for the Python SDK"
    )
    config.addinivalue_line(
        "markers", "rl: RL optimization related tests"
    )

# Make sure we can import from any sub-project
def pytest_sessionstart(session):
    """Session start hook."""
    print("Starting pytest session for Schlep Engine monorepo")
    print(f"Python path includes: {[p for p in sys.path if 'schlep-engine' in p]}")
    print(f"Test environment loaded: {os.getenv('TESTING', 'false')}")
    
def pytest_sessionfinish(session, exitstatus):
    """Session finish hook."""
    print(f"Pytest session finished with exit status: {exitstatus}")