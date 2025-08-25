"""
Tests for authentication components
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, mock_open
import json
import tempfile
from pathlib import Path

from schlep_engine.auth.manager import AuthManager
from schlep_engine.auth.token_storage import TokenStorage
from schlep_engine.models.auth import TokenResponse, UserInfo, LoginRequest, RegisterRequest
from schlep_engine.exceptions.base import AuthenticationError, ConfigurationError


class TestAuthManager:
    """Test cases for AuthManager."""

    def test_initialization(self, test_api_key, test_base_url):
        """Test AuthManager initialization."""
        auth_manager = AuthManager(
            api_key=test_api_key,
            base_url=test_base_url
        )
        
        assert auth_manager.api_key == test_api_key
        assert auth_manager.base_url == test_base_url
        assert auth_manager.is_authenticated is True
        assert auth_manager.auth_method == "api_key"

    def test_auth_headers_with_api_key(self, test_api_key):
        """Test authentication headers with API key."""
        auth_manager = AuthManager(api_key=test_api_key)
        headers = auth_manager.get_auth_headers()
        
        assert "Authorization" in headers
        assert headers["Authorization"] == f"Bearer {test_api_key}"

    def test_auth_headers_with_token(self, mock_token_response):
        """Test authentication headers with JWT token."""
        auth_manager = AuthManager()
        auth_manager._current_tokens = mock_token_response
        
        headers = auth_manager.get_auth_headers()
        
        assert "Authorization" in headers
        assert headers["Authorization"] == f"Bearer {mock_token_response.access_token}"

    def test_auth_headers_no_auth(self):
        """Test authentication headers without authentication."""
        auth_manager = AuthManager()
        headers = auth_manager.get_auth_headers()
        
        assert headers == {}

    def test_set_api_key(self):
        """Test setting API key."""
        auth_manager = AuthManager()
        assert not auth_manager.is_authenticated
        
        auth_manager.set_api_key("new-key")
        assert auth_manager.api_key == "new-key"
        assert auth_manager.is_authenticated is True

    async def test_login_success(self, mock_token_response):
        """Test successful login."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        mock_http_client.post.return_value = {
            "data": {
                "access_token": mock_token_response.access_token,
                "refresh_token": mock_token_response.refresh_token,
                "token_type": "bearer",
                "expires_in": 3600,
                "user": {
                    "user_id": "test-user-123",
                    "email": "test@example.com",
                    "username": "testuser",
                    "role": "user",
                    "is_active": True
                }
            }
        }
        auth_manager.set_http_client(mock_http_client)
        
        result = await auth_manager.login("test@example.com", "password")
        
        assert isinstance(result, TokenResponse)
        assert result.access_token == mock_token_response.access_token
        assert auth_manager.is_authenticated is True
        assert auth_manager.auth_method == "jwt_token"

    async def test_login_failure(self):
        """Test login failure."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        mock_http_client.post.side_effect = Exception("Login failed")
        auth_manager.set_http_client(mock_http_client)
        
        with pytest.raises(AuthenticationError):
            await auth_manager.login("test@example.com", "wrong_password")

    async def test_register_success(self, mock_token_response):
        """Test successful registration."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        mock_http_client.post.return_value = {
            "data": {
                "access_token": mock_token_response.access_token,
                "refresh_token": mock_token_response.refresh_token,
                "token_type": "bearer",
                "expires_in": 3600,
                "user": {
                    "user_id": "test-user-123",
                    "email": "test@example.com",
                    "username": "testuser",
                    "role": "user",
                    "is_active": True
                }
            }
        }
        auth_manager.set_http_client(mock_http_client)
        
        result = await auth_manager.register(
            email="test@example.com",
            password="password",
            username="testuser",
            first_name="Test",
            last_name="User"
        )
        
        assert isinstance(result, TokenResponse)
        assert result.access_token == mock_token_response.access_token
        assert auth_manager.is_authenticated is True

    async def test_refresh_tokens_success(self, mock_token_response):
        """Test successful token refresh."""
        auth_manager = AuthManager()
        auth_manager._current_tokens = mock_token_response
        
        mock_http_client = AsyncMock()
        mock_http_client.post.return_value = {
            "data": {
                "access_token": "new-access-token",
                "refresh_token": "new-refresh-token",
                "token_type": "bearer",
                "expires_in": 3600
            }
        }
        auth_manager.set_http_client(mock_http_client)
        
        result = await auth_manager.refresh_tokens()
        
        assert result.access_token == "new-access-token"
        assert auth_manager._current_tokens.access_token == "new-access-token"

    async def test_logout(self):
        """Test logout functionality."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        auth_manager.set_http_client(mock_http_client)
        auth_manager._current_tokens = mock_token_response
        
        await auth_manager.logout()
        
        assert auth_manager._current_tokens is None
        assert not auth_manager.is_authenticated
        mock_http_client.post.assert_called_with("/auth/logout")

    def test_clear_authentication(self, mock_token_response):
        """Test clearing authentication data."""
        auth_manager = AuthManager()
        auth_manager._current_tokens = mock_token_response
        
        auth_manager.clear_authentication()
        
        assert auth_manager._current_tokens is None
        assert not auth_manager.is_authenticated

    def test_get_current_user(self, mock_token_response):
        """Test getting current user info."""
        auth_manager = AuthManager()
        auth_manager._current_tokens = mock_token_response
        
        user = auth_manager.get_current_user()
        
        assert isinstance(user, UserInfo)
        assert user.email == "test@example.com"


class TestTokenStorage:
    """Test cases for TokenStorage."""

    def test_initialization_default_path(self):
        """Test TokenStorage initialization with default path."""
        storage = TokenStorage()
        
        assert storage.storage_path.name == "tokens.json"
        assert ".schlep_engine" in str(storage.storage_path)

    def test_initialization_custom_path(self, tmp_path):
        """Test TokenStorage initialization with custom path."""
        custom_path = tmp_path / "custom_tokens.json"
        storage = TokenStorage(str(custom_path))
        
        assert storage.storage_path == custom_path

    def test_save_and_load_tokens(self, mock_token_response, tmp_path):
        """Test saving and loading tokens."""
        storage_path = tmp_path / "test_tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Save tokens
        storage.save_tokens(mock_token_response)
        
        # Verify file exists
        assert storage_path.exists()
        
        # Load tokens
        loaded_tokens = storage.load_tokens()
        
        assert loaded_tokens is not None
        assert loaded_tokens.access_token == mock_token_response.access_token
        assert loaded_tokens.refresh_token == mock_token_response.refresh_token
        assert loaded_tokens.user.email == mock_token_response.user.email

    def test_load_tokens_nonexistent_file(self, tmp_path):
        """Test loading tokens when file doesn't exist."""
        storage_path = tmp_path / "nonexistent.json"
        storage = TokenStorage(str(storage_path))
        
        tokens = storage.load_tokens()
        
        assert tokens is None

    def test_load_tokens_corrupted_file(self, tmp_path):
        """Test loading tokens with corrupted file."""
        storage_path = tmp_path / "corrupted.json"
        storage = TokenStorage(str(storage_path))
        
        # Create corrupted file
        storage_path.write_text("invalid json content")
        
        tokens = storage.load_tokens()
        
        assert tokens is None
        assert not storage_path.exists()  # Should be cleared

    def test_clear_tokens(self, mock_token_response, tmp_path):
        """Test clearing stored tokens."""
        storage_path = tmp_path / "test_tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Save tokens first
        storage.save_tokens(mock_token_response)
        assert storage_path.exists()
        
        # Clear tokens
        storage.clear_tokens()
        
        assert not storage_path.exists()

    def test_has_tokens(self, mock_token_response, tmp_path):
        """Test checking if tokens exist."""
        storage_path = tmp_path / "test_tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Initially no tokens
        assert not storage.has_tokens()
        
        # Save tokens
        storage.save_tokens(mock_token_response)
        
        # Now has tokens
        assert storage.has_tokens()

    def test_get_access_token(self, mock_token_response, tmp_path):
        """Test getting just the access token."""
        storage_path = tmp_path / "test_tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # No tokens initially
        assert storage.get_access_token() is None
        
        # Save tokens
        storage.save_tokens(mock_token_response)
        
        # Get access token
        access_token = storage.get_access_token()
        assert access_token == mock_token_response.access_token

    def test_is_token_expired(self, tmp_path):
        """Test checking if token is expired."""
        storage_path = tmp_path / "test_tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # No tokens - should be expired
        assert storage.is_token_expired() is True
        
        # Create expired token
        expired_token = TokenResponse(
            access_token="expired-token",
            refresh_token="refresh-token",
            token_type="bearer",
            expires_in=3600,
            issued_at=datetime.now() - timedelta(hours=2)  # Expired
        )
        
        storage.save_tokens(expired_token)
        assert storage.is_token_expired() is True
        
        # Create valid token
        valid_token = TokenResponse(
            access_token="valid-token",
            refresh_token="refresh-token",
            token_type="bearer",
            expires_in=3600,
            issued_at=datetime.now()  # Just issued
        )
        
        storage.save_tokens(valid_token)
        assert storage.is_token_expired() is False


class TestAuthModels:
    """Test authentication model classes."""

    def test_token_response_expiration(self):
        """Test TokenResponse expiration logic."""
        # Non-expired token
        token = TokenResponse(
            access_token="token",
            refresh_token="refresh",
            expires_in=3600,
            issued_at=datetime.now()
        )
        assert not token.is_expired
        
        # Expired token
        expired_token = TokenResponse(
            access_token="token",
            refresh_token="refresh", 
            expires_in=3600,
            issued_at=datetime.now() - timedelta(hours=2)
        )
        assert expired_token.is_expired

    def test_user_info_properties(self):
        """Test UserInfo property methods."""
        user = UserInfo(
            user_id="123",
            email="test@example.com",
            username="testuser",
            first_name="Test",
            last_name="User",
            role="admin",
            is_active=True
        )
        
        assert user.full_name == "Test User"
        assert user.display_name == "testuser"
        assert user.is_admin is True

    def test_login_request_serialization(self):
        """Test LoginRequest serialization."""
        request = LoginRequest(
            email="test@example.com",
            password="password",
            remember_me=True
        )
        
        data = request.to_dict()
        assert data["email"] == "test@example.com"
        assert data["password"] == "password"
        assert data["remember_me"] is True

    def test_register_request_serialization(self):
        """Test RegisterRequest serialization."""
        request = RegisterRequest(
            email="test@example.com",
            password="password",
            username="testuser",
            first_name="Test",
            last_name="User"
        )
        
        data = request.to_dict()
        assert data["email"] == "test@example.com"
        assert data["username"] == "testuser"
        assert data["first_name"] == "Test"
        assert data["last_name"] == "User"


class TestAuthErrorHandling:
    """Test error handling in authentication components."""

    def test_auth_manager_no_http_client(self):
        """Test AuthManager without HTTP client."""
        auth_manager = AuthManager()
        
        with pytest.raises(ConfigurationError):
            auth_manager.login("test@example.com", "password")

    def test_token_storage_save_error(self, mock_token_response, tmp_path):
        """Test TokenStorage save error handling."""
        # Use invalid path to trigger error
        storage = TokenStorage("/invalid/path/tokens.json")
        
        with pytest.raises(ConfigurationError):
            storage.save_tokens(mock_token_response)