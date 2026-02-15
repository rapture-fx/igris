"""
Comprehensive authentication tests for Igris-engine Python SDK
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
import json

from igris.auth.manager import AuthManager
from igris.auth.token_storage import MemoryTokenStorage, FileTokenStorage
from igris.models.auth import TokenResponse, UserInfo
from igris.exceptions.base import AuthenticationError, APIError


class TestAuthManager:
    """Comprehensive tests for AuthManager."""

    @pytest.mark.asyncio
    async def test_login_with_credentials_success(self, auth_manager, mock_token_response):
        """Test successful login with credentials."""
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": mock_token_response.dict()
            }
            
            result = await auth_manager.login("test@example.com", "password123")
            
            assert isinstance(result, TokenResponse)
            assert result.access_token == mock_token_response.access_token
            assert result.user.email == "test@example.com"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_with_invalid_credentials(self, auth_manager):
        """Test login with invalid credentials."""
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Invalid credentials", status_code=401)
            
            with pytest.raises(AuthenticationError):
                await auth_manager.login("invalid@example.com", "wrongpassword")

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, auth_manager, mock_token_response):
        """Test successful token refresh."""
        # Set up existing token
        auth_manager.current_token = mock_token_response
        
        new_token_response = TokenResponse(
            access_token="new-access-token",
            refresh_token="new-refresh-token",
            token_type="bearer",
            expires_in=3600,
            user=mock_token_response.user
        )
        
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": new_token_response.dict()
            }
            
            result = await auth_manager.refresh_token()
            
            assert result.access_token == "new-access-token"
            assert auth_manager.current_token.access_token == "new-access-token"

    @pytest.mark.asyncio
    async def test_refresh_token_expired(self, auth_manager):
        """Test refresh token when it's expired."""
        expired_token = TokenResponse(
            access_token="expired-token",
            refresh_token="expired-refresh-token",
            token_type="bearer",
            expires_in=-1,  # Already expired
            user=UserInfo(
                user_id="test-user",
                email="test@example.com",
                username="testuser",
                role="user",
                is_active=True
            )
        )
        auth_manager.current_token = expired_token
        
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Refresh token expired", status_code=401)
            
            with pytest.raises(AuthenticationError):
                await auth_manager.refresh_token()

    @pytest.mark.asyncio
    async def test_logout_success(self, auth_manager, mock_token_response):
        """Test successful logout."""
        auth_manager.current_token = mock_token_response
        
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {"success": True}
            
            await auth_manager.logout()
            
            assert auth_manager.current_token is None
            mock_post.assert_called_once()

    def test_is_authenticated_with_valid_token(self, auth_manager, mock_token_response):
        """Test is_authenticated with valid token."""
        auth_manager.current_token = mock_token_response
        assert auth_manager.is_authenticated() is True

    def test_is_authenticated_without_token(self, auth_manager):
        """Test is_authenticated without token."""
        auth_manager.current_token = None
        assert auth_manager.is_authenticated() is False

    def test_is_authenticated_with_expired_token(self, auth_manager):
        """Test is_authenticated with expired token."""
        expired_token = TokenResponse(
            access_token="expired-token",
            refresh_token="refresh-token",
            token_type="bearer",
            expires_in=-1,  # Already expired
            user=UserInfo(
                user_id="test-user",
                email="test@example.com",
                username="testuser",
                role="user",
                is_active=True
            )
        )
        auth_manager.current_token = expired_token
        assert auth_manager.is_authenticated() is False

    def test_get_auth_header_with_token(self, auth_manager, mock_token_response):
        """Test getting authorization header with valid token."""
        auth_manager.current_token = mock_token_response
        
        headers = auth_manager.get_auth_headers()
        
        assert "Authorization" in headers
        assert headers["Authorization"] == f"Bearer {mock_token_response.access_token}"

    def test_get_auth_header_without_token(self, auth_manager):
        """Test getting authorization header without token."""
        auth_manager.current_token = None
        
        headers = auth_manager.get_auth_headers()
        
        assert headers == {}

    @pytest.mark.asyncio
    async def test_auto_refresh_on_401(self, auth_manager, mock_token_response):
        """Test automatic token refresh on 401 error."""
        auth_manager.current_token = mock_token_response
        
        new_token_response = TokenResponse(
            access_token="refreshed-token",
            refresh_token="new-refresh-token",
            token_type="bearer",
            expires_in=3600,
            user=mock_token_response.user
        )
        
        with patch.object(auth_manager, 'refresh_token', new_callable=AsyncMock) as mock_refresh:
            mock_refresh.return_value = new_token_response
            
            # Simulate a 401 error that triggers auto-refresh
            with patch.object(auth_manager.http_client, 'get', new_callable=AsyncMock) as mock_get:
                # First call returns 401, second call succeeds
                mock_get.side_effect = [
                    APIError("Unauthorized", status_code=401),
                    {"success": True, "data": {"user": "info"}}
                ]
                
                result = await auth_manager._make_authenticated_request('GET', '/api/user')
                
                mock_refresh.assert_called_once()
                assert mock_get.call_count == 2


class TestTokenStorage:
    """Comprehensive tests for token storage implementations."""

    def test_memory_token_storage(self, mock_token_response):
        """Test memory-based token storage."""
        storage = MemoryTokenStorage()
        
        # Initially no token
        assert storage.get_token() is None
        
        # Store token
        storage.store_token(mock_token_response)
        retrieved = storage.get_token()
        
        assert retrieved is not None
        assert retrieved.access_token == mock_token_response.access_token
        
        # Clear token
        storage.clear_token()
        assert storage.get_token() is None

    def test_file_token_storage(self, temp_token_storage, mock_token_response):
        """Test file-based token storage."""
        storage = FileTokenStorage(temp_token_storage)
        
        # Initially no token
        assert storage.get_token() is None
        
        # Store token
        storage.store_token(mock_token_response)
        
        # Verify file was created and can be read
        retrieved = storage.get_token()
        assert retrieved is not None
        assert retrieved.access_token == mock_token_response.access_token
        
        # Test persistence - create new storage instance
        new_storage = FileTokenStorage(temp_token_storage)
        persisted = new_storage.get_token()
        assert persisted.access_token == mock_token_response.access_token
        
        # Clear token
        storage.clear_token()
        assert storage.get_token() is None

    def test_file_token_storage_corrupted_file(self, temp_token_storage):
        """Test file token storage with corrupted file."""
        # Write invalid JSON to file
        with open(temp_token_storage, 'w') as f:
            f.write("invalid json content")
        
        storage = FileTokenStorage(temp_token_storage)
        
        # Should handle corrupted file gracefully
        assert storage.get_token() is None

    def test_file_token_storage_missing_file(self, temp_token_storage):
        """Test file token storage with missing file."""
        # Use non-existent file path
        non_existent_path = temp_token_storage.replace("test_tokens.json", "missing.json")
        storage = FileTokenStorage(non_existent_path)
        
        # Should handle missing file gracefully
        assert storage.get_token() is None


class TestAuthenticationFlow:
    """Test complete authentication flows."""

    @pytest.mark.asyncio
    async def test_complete_login_flow(self, auth_manager, mock_token_response):
        """Test complete login to logout flow."""
        # Mock HTTP responses
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": mock_token_response.dict()
            }
            
            # Login
            login_result = await auth_manager.login("test@example.com", "password123")
            assert login_result.access_token == mock_token_response.access_token
            assert auth_manager.is_authenticated()
            
            # Make authenticated request
            with patch.object(auth_manager.http_client, 'get', new_callable=AsyncMock) as mock_get:
                mock_get.return_value = {"success": True, "data": {"profile": "data"}}
                
                headers = auth_manager.get_auth_headers()
                assert "Authorization" in headers
            
            # Logout
            await auth_manager.logout()
            assert not auth_manager.is_authenticated()
            assert auth_manager.get_auth_headers() == {}

    @pytest.mark.asyncio
    async def test_token_refresh_flow(self, auth_manager, mock_token_response):
        """Test token refresh flow when token expires."""
        # Set up an expiring token
        expiring_token = TokenResponse(
            access_token="expiring-token",
            refresh_token="valid-refresh-token",
            token_type="bearer",
            expires_in=1,  # Will expire soon
            user=mock_token_response.user
        )
        auth_manager.current_token = expiring_token
        
        # Wait for token to expire
        await asyncio.sleep(1.1)
        
        # Mock refresh response
        refreshed_token = TokenResponse(
            access_token="new-access-token",
            refresh_token="new-refresh-token",
            token_type="bearer",
            expires_in=3600,
            user=mock_token_response.user
        )
        
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": refreshed_token.dict()
            }
            
            result = await auth_manager.refresh_token()
            
            assert result.access_token == "new-access-token"
            assert auth_manager.current_token.access_token == "new-access-token"

    @pytest.mark.asyncio
    async def test_concurrent_authentication_requests(self, auth_manager, mock_token_response):
        """Test handling of concurrent authentication requests."""
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": mock_token_response.dict()
            }
            
            # Make concurrent login requests
            tasks = [
                auth_manager.login("test@example.com", "password123")
                for _ in range(5)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # All should succeed
            for result in results:
                if isinstance(result, Exception):
                    pytest.fail(f"Concurrent request failed: {result}")
                assert isinstance(result, TokenResponse)


class TestSecurityFeatures:
    """Test security-related authentication features."""

    @pytest.mark.asyncio
    async def test_rate_limiting_authentication(self, auth_manager):
        """Test authentication rate limiting."""
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Too many requests", status_code=429)
            
            with pytest.raises(APIError) as exc_info:
                await auth_manager.login("test@example.com", "password123")
            
            assert exc_info.value.status_code == 429

    def test_secure_token_handling(self, auth_manager, mock_token_response):
        """Test secure token handling and no token leakage."""
        auth_manager.current_token = mock_token_response
        
        # Ensure token is not exposed in string representation
        auth_str = str(auth_manager)
        assert mock_token_response.access_token not in auth_str
        assert "***" in auth_str or "hidden" in auth_str.lower()

    @pytest.mark.asyncio
    async def test_token_validation(self, auth_manager):
        """Test token validation for malformed tokens."""
        # Test with malformed token data
        malformed_data = {
            "access_token": "token",
            # Missing required fields
        }
        
        with patch.object(auth_manager.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": malformed_data
            }
            
            with pytest.raises((ValidationError, AuthenticationError, KeyError)):
                await auth_manager.login("test@example.com", "password123")


@pytest.mark.integration
class TestAuthenticationIntegration:
    """Integration tests for authentication (requires test API)."""

    @pytest.mark.asyncio
    async def test_real_authentication_flow(self):
        """Test authentication against real API (if available)."""
        # This test should be run only in integration test environments
        # with real test credentials
        pytest.skip("Integration test - requires real API endpoint")

    @pytest.mark.asyncio
    async def test_oauth_flow(self):
        """Test OAuth authentication flow."""
        # OAuth flow testing
        pytest.skip("OAuth flow not implemented yet")


# Test data and fixtures for auth tests
@pytest.fixture
def invalid_token_response():
    """Invalid token response for testing error handling."""
    return {
        "access_token": "invalid-token",
        # Missing required fields
    }


@pytest.fixture
def expired_token_response():
    """Expired token response for testing."""
    return TokenResponse(
        access_token="expired-token",
        refresh_token="expired-refresh",
        token_type="bearer",
        expires_in=-1,  # Already expired
        user=UserInfo(
            user_id="test-user",
            email="test@example.com",
            username="testuser",
            role="user",
            is_active=True
        )
    )