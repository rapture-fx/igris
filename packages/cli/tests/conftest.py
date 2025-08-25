"""
Pytest configuration and fixtures for Schlep-engine CLI tests.
"""

import os
import tempfile
import pytest
from pathlib import Path
from unittest.mock import Mock, patch
from click.testing import CliRunner

from schlep_cli.main import cli
from schlep_cli.core.config import Config
from schlep_cli.core.client import APIClient


@pytest.fixture
def runner():
    """Click CLI test runner."""
    return CliRunner()


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def config_dir(temp_dir):
    """Create a temporary config directory."""
    config_dir = temp_dir / ".schlep"
    config_dir.mkdir()
    return config_dir


@pytest.fixture
def sample_config(config_dir):
    """Create a sample configuration."""
    config = Config()
    config.api_key = "sk-test-key-123"
    config.base_url = "https://api.test.com"
    config.parallel_jobs = 4
    return config


@pytest.fixture
def mock_client():
    """Mock API client."""
    client = Mock(spec=APIClient)
    client.is_authenticated = True
    client.health_check.return_value = True
    client.get_user_info.return_value = {
        'email': 'test@example.com',
        'organization': 'Test Org',
        'plan': 'Pro'
    }
    return client


@pytest.fixture
def auth_context(sample_config, mock_client):
    """Context with authenticated configuration and client."""
    return {
        'config': sample_config,
        'client': mock_client,
        'debug': False
    }


@pytest.fixture
def sample_data_file(temp_dir):
    """Create a sample CSV data file."""
    data_file = temp_dir / "sample.csv"
    with open(data_file, 'w') as f:
        f.write("id,name,value\n")
        f.write("1,Alice,100\n")
        f.write("2,Bob,200\n")
        f.write("3,Charlie,300\n")
    return data_file


@pytest.fixture
def sample_pipeline_config(temp_dir):
    """Create a sample pipeline configuration file."""
    config_file = temp_dir / "pipeline.yml"
    with open(config_file, 'w') as f:
        f.write("""
name: test-pipeline
description: Test pipeline for unit tests
model_type: random_forest
features:
  - feature1
  - feature2
target: target_column
parameters:
  n_estimators: 100
  max_depth: 10
""")
    return config_file


@pytest.fixture(autouse=True)
def mock_config_paths(config_dir, monkeypatch):
    """Mock configuration paths to use temporary directory."""
    monkeypatch.setattr(
        "schlep_cli.core.config.Config.get_config_dir",
        lambda: config_dir
    )
    monkeypatch.setattr(
        "schlep_cli.core.config.Config.get_config_file",
        lambda: config_dir / "config.yml"
    )
    monkeypatch.setattr(
        "schlep_cli.core.config.Config.get_auth_file",
        lambda: config_dir / "auth.json"
    )


@pytest.fixture
def mock_sdk_available():
    """Mock SDK availability."""
    with patch('schlep_cli.core.client.SDK_AVAILABLE', True):
        with patch('schlep_cli.core.client.SchlepEngineClient') as mock_sdk:
            mock_client = Mock()
            mock_client.health.check.return_value = {'status': 'healthy'}
            mock_client.users.get_current.return_value = {
                'email': 'test@example.com',
                'organization': 'Test Org'
            }
            mock_sdk.return_value = mock_client
            yield mock_sdk


@pytest.fixture
def mock_sdk_unavailable():
    """Mock SDK unavailability."""
    with patch('schlep_cli.core.client.SDK_AVAILABLE', False):
        yield


class MockResponse:
    """Mock HTTP response for testing."""
    
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code
    
    def json(self):
        return self.json_data
    
    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


@pytest.fixture
def mock_successful_response():
    """Mock successful API response."""
    return MockResponse({
        'success': True,
        'data': {'message': 'Operation completed successfully'}
    })


@pytest.fixture
def mock_error_response():
    """Mock error API response."""
    return MockResponse({
        'success': False,
        'error': 'Operation failed'
    }, status_code=400)


# Test data fixtures
@pytest.fixture
def sample_pipelines():
    """Sample pipeline data for testing."""
    return [
        {
            'id': 'pipeline-1',
            'name': 'test-pipeline-1',
            'status': 'running',
            'progress': 45.5,
            'created_at': '2024-01-01T12:00:00Z',
            'duration': 1800
        },
        {
            'id': 'pipeline-2', 
            'name': 'test-pipeline-2',
            'status': 'completed',
            'progress': 100.0,
            'created_at': '2024-01-01T10:00:00Z',
            'duration': 3600
        }
    ]


@pytest.fixture
def sample_jobs():
    """Sample job data for testing."""
    return [
        {
            'id': 'job-1',
            'type': 'data_processing',
            'status': 'running',
            'progress': {'current': 50, 'total': 100},
            'created_at': '2024-01-01T12:30:00Z'
        },
        {
            'id': 'job-2',
            'type': 'model_training', 
            'status': 'completed',
            'progress': {'current': 100, 'total': 100},
            'created_at': '2024-01-01T11:00:00Z'
        }
    ]


@pytest.fixture
def sample_metrics():
    """Sample metrics data for testing."""
    return {
        'cpu_usage': 65.5,
        'memory_usage': 78.2,
        'disk_usage': 45.0,
        'active_connections': 150,
        'requests_per_minute': 1250,
        'error_rate': 0.5,
        'response_time': 245
    }


# Environment fixtures
@pytest.fixture
def clean_env(monkeypatch):
    """Clean environment variables."""
    env_vars = [
        'SCHLEP_API_KEY',
        'SCHLEP_BASE_URL',
        'SCHLEP_TIMEOUT',
        'SCHLEP_PARALLEL_JOBS',
        'SCHLEP_DEBUG'
    ]
    
    for var in env_vars:
        monkeypatch.delenv(var, raising=False)


@pytest.fixture
def env_with_api_key(monkeypatch):
    """Environment with API key set."""
    monkeypatch.setenv('SCHLEP_API_KEY', 'sk-test-env-key')
    monkeypatch.setenv('SCHLEP_BASE_URL', 'https://api.test-env.com')


# Parametrized fixtures
@pytest.fixture(params=['csv', 'json', 'parquet'])
def file_format(request):
    """Parametrized file format fixture."""
    return request.param


@pytest.fixture(params=[1, 4, 8])
def parallel_jobs(request):
    """Parametrized parallel jobs fixture."""
    return request.param


# Custom markers for test organization
def pytest_configure(config):
    """Configure custom pytest markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", "cli: marks tests as CLI tests"
    )
    config.addinivalue_line(
        "markers", "auth: marks tests as authentication tests"
    )
    config.addinivalue_line(
        "markers", "config: marks tests as configuration tests"
    )