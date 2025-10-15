"""
Pytest configuration and fixtures for Schlep-engine SDK tests
"""

import pytest
import asyncio
from typing import Generator, AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

from schlep_engine import SchlepEngineClient
from schlep_engine.client.main import SchlepEngineClientSync
from schlep_engine.auth.manager import AuthManager
from schlep_engine.utils.retry import RetryConfig
from schlep_engine.models.auth import TokenResponse, UserInfo
from schlep_engine.models.common import APIResponse


@pytest.fixture
def test_api_key() -> str:
    """Test API key fixture."""
    return "test-api-key-12345"


@pytest.fixture
def test_base_url() -> str:
    """Test base URL fixture."""
    return "https://api.test.schlep-engine.com"


@pytest.fixture
def retry_config() -> RetryConfig:
    """Test retry configuration."""
    return RetryConfig(
        max_retries=2,
        base_delay=0.1,
        max_delay=1.0
    )


@pytest.fixture
async def client(test_api_key: str, test_base_url: str) -> AsyncGenerator[SchlepEngineClient, None]:
    """Test client fixture."""
    client = SchlepEngineClient(
        api_key=test_api_key,
        base_url=test_base_url,
        timeout=5.0
    )
    
    # Mock the HTTP client to avoid real requests
    with patch.object(client.http_client, '_make_request', new_callable=AsyncMock) as mock_request:
        mock_request.return_value = {"success": True, "data": {}}
        yield client
    
    await client.close()


@pytest.fixture
def sync_client(test_api_key: str, test_base_url: str) -> Generator[SchlepEngineClientSync, None, None]:
    """Test synchronous client fixture."""
    client = SchlepEngineClientSync(
        api_key=test_api_key,
        base_url=test_base_url,
        timeout=5.0
    )
    yield client
    client.close()


@pytest.fixture
def auth_manager(test_api_key: str, test_base_url: str) -> AuthManager:
    """Test authentication manager fixture."""
    return AuthManager(
        api_key=test_api_key,
        base_url=test_base_url
    )


@pytest.fixture
def mock_token_response() -> TokenResponse:
    """Mock token response fixture."""
    user = UserInfo(
        user_id="test-user-123",
        email="test@example.com",
        username="testuser",
        role="user",
        is_active=True
    )
    
    return TokenResponse(
        access_token="test-access-token",
        refresh_token="test-refresh-token",
        token_type="bearer",
        expires_in=3600,
        user=user,
        scope="read write"
    )


@pytest.fixture
def mock_api_response() -> APIResponse:
    """Mock API response fixture."""
    return APIResponse.success_response(
        data={"message": "Success", "id": 123},
        request_id="test-request-123"
    )


@pytest.fixture
def mock_http_client():
    """Mock HTTP client fixture."""
    mock_client = AsyncMock()
    mock_client.get.return_value = {"success": True, "data": {}}
    mock_client.post.return_value = {"success": True, "data": {}}
    mock_client.put.return_value = {"success": True, "data": {}}
    mock_client.patch.return_value = {"success": True, "data": {}}
    mock_client.delete.return_value = {"success": True, "data": {}}
    return mock_client


@pytest.fixture(scope="session")
def event_loop():
    """Event loop fixture for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_token_storage(tmp_path):
    """Temporary token storage path."""
    return str(tmp_path / "test_tokens.json")


# Mark all tests as asyncio by default
pytest_plugins = ["pytest_asyncio"]