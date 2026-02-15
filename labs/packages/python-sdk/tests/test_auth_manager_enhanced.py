"""
Tests for enhanced authentication manager functionality
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from igris.auth.manager import AuthManager
from igris.auth.token_storage import SecureTokenStorage
from igris.models.auth import TokenResponse, UserInfo
from igris.exceptions.base import AuthenticationError, ConfigurationError


class TestAuthManagerEnhanced:
    """Tests for enhanced AuthManager functionality."""
    
    def test_init_with_secure_storage_enabled(self):
        """Test AuthManager initialization with secure storage enabled."""
        auth_manager = AuthManager(use_secure_storage=True)
        assert isinstance(auth_manager.token_storage, SecureTokenStorage)
    
    def test_init_with_secure_storage_disabled(self):
        """Test AuthManager initialization with secure storage disabled."""
        from igris.auth.token_storage import TokenStorage
        auth_manager = AuthManager(use_secure_storage=False)
        assert isinstance(auth_manager.token_storage, TokenStorage)
        assert not isinstance(auth_manager.token_storage, SecureTokenStorage)
    
    @pytest.mark.asyncio
    async def test_get_valid_access_token_async_fresh_token(self):
        """Test get_valid_access_token_async with fresh token."""
        auth_manager = AuthManager()
        
        # Create a fresh token
        fresh_token = TokenResponse(
            access_token="fresh_token",
            refresh_token="refresh_token",
            issued_at=datetime.now(),
            expires_in=3600
        )
        
        auth_manager._current_tokens = fresh_token
        
        result = await auth_manager.get_valid_access_token_async()
        assert result == "fresh_token"
    
    @pytest.mark.asyncio
    async def test_get_valid_access_token_async_expires_soon(self):
        """Test get_valid_access_token_async with token that expires soon."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        auth_manager.set_http_client(mock_http_client)
        
        # Create a token that expires soon
        expires_soon_token = TokenResponse(
            access_token="expires_soon_token",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(minutes=58),  # Expires in 2 minutes
            expires_in=3600
        )
        
        auth_manager._current_tokens = expires_soon_token
        
        # Mock refresh response
        mock_http_client.post.return_value = {
            "access_token": "refreshed_token",
            "refresh_token": "new_refresh_token",
            "token_type": "bearer",
            "expires_in": 3600
        }
        
        result = await auth_manager.get_valid_access_token_async()
        assert result == "refreshed_token"
        
        # Should have called refresh endpoint
        mock_http_client.post.assert_called_with("/auth/refresh", json={"refresh_token": "refresh_token"})
    
    @pytest.mark.asyncio
    async def test_get_valid_access_token_async_expired_token(self):
        """Test get_valid_access_token_async with expired token."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        auth_manager.set_http_client(mock_http_client)
        
        # Create an expired token
        expired_token = TokenResponse(
            access_token="expired_token",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(hours=2),
            expires_in=3600
        )
        
        with patch.object(auth_manager.token_storage, 'load_tokens', return_value=expired_token):
            # Mock refresh response
            mock_http_client.post.return_value = {
                "access_token": "refreshed_token",
                "refresh_token": "new_refresh_token",
                "token_type": "bearer",
                "expires_in": 3600
            }
            
            result = await auth_manager.get_valid_access_token_async()
            assert result == "refreshed_token"
    
    @pytest.mark.asyncio
    async def test_get_valid_access_token_async_no_tokens(self):
        """Test get_valid_access_token_async with no tokens available."""
        auth_manager = AuthManager()
        
        with patch.object(auth_manager.token_storage, 'load_tokens', return_value=None):
            result = await auth_manager.get_valid_access_token_async()
            assert result is None
    
    @pytest.mark.asyncio
    async def test_ensure_valid_token_success(self):
        """Test ensure_valid_token with valid token available."""
        auth_manager = AuthManager()
        
        fresh_token = TokenResponse(
            access_token="fresh_token",
            refresh_token="refresh_token",
            issued_at=datetime.now(),
            expires_in=3600
        )
        
        auth_manager._current_tokens = fresh_token
        
        result = await auth_manager.ensure_valid_token()
        assert result is True
    
    @pytest.mark.asyncio
    async def test_ensure_valid_token_failure(self):
        """Test ensure_valid_token with no valid token available."""
        auth_manager = AuthManager()
        
        with patch.object(auth_manager.token_storage, 'load_tokens', return_value=None):
            result = await auth_manager.ensure_valid_token()
            assert result is False
    
    @pytest.mark.asyncio
    async def test_refresh_tokens_success(self):
        """Test successful token refresh."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        auth_manager.set_http_client(mock_http_client)
        
        # Set up existing tokens
        existing_tokens = TokenResponse(
            access_token="old_token",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(minutes=50),
            expires_in=3600
        )
        auth_manager._current_tokens = existing_tokens
        
        # Mock refresh response
        mock_http_client.post.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "token_type": "bearer",
            "expires_in": 3600
        }
        
        result = await auth_manager.refresh_tokens()
        
        assert result is not None
        assert result.access_token == "new_access_token"
        assert result.refresh_token == "new_refresh_token"
        
        # Should have saved new tokens
        assert auth_manager._current_tokens.access_token == "new_access_token"
        
        # Should have called API
        mock_http_client.post.assert_called_once_with("/auth/refresh", json={"refresh_token": "refresh_token"})
    
    @pytest.mark.asyncio
    async def test_refresh_tokens_no_refresh_token(self):
        """Test token refresh with no refresh token available."""
        auth_manager = AuthManager()
        
        result = await auth_manager.refresh_tokens()
        assert result is None
    
    @pytest.mark.asyncio
    async def test_refresh_tokens_api_failure(self):
        """Test token refresh with API failure."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        auth_manager.set_http_client(mock_http_client)
        
        existing_tokens = TokenResponse(
            access_token="old_token",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(minutes=50),
            expires_in=3600
        )
        auth_manager._current_tokens = existing_tokens
        
        # Mock API failure
        mock_http_client.post.side_effect = Exception("API error")
        
        result = await auth_manager.refresh_tokens()
        assert result is None
        
        # Should have cleared authentication
        assert auth_manager._current_tokens is None
    
    def test_save_api_key_securely_with_secure_storage(self):
        """Test saving API key securely with secure storage enabled."""
        auth_manager = AuthManager(use_secure_storage=True)
        
        with patch.object(auth_manager.token_storage, 'save_api_key') as mock_save:
            auth_manager.save_api_key_securely("test-api-key", "test-id")
            mock_save.assert_called_once_with("test-api-key", "test-id")
    
    def test_save_api_key_securely_without_secure_storage(self):
        """Test saving API key securely without secure storage raises error."""
        auth_manager = AuthManager(use_secure_storage=False)
        
        with pytest.raises(ConfigurationError, match="Secure storage not available"):
            auth_manager.save_api_key_securely("test-api-key", "test-id")
    
    def test_load_api_key_securely_with_secure_storage(self):
        """Test loading API key securely with secure storage enabled."""
        auth_manager = AuthManager(use_secure_storage=True)
        
        with patch.object(auth_manager.token_storage, 'load_api_key', return_value="loaded-key") as mock_load:
            result = auth_manager.load_api_key_securely("test-id")
            assert result == "loaded-key"
            mock_load.assert_called_once_with("test-id")
    
    def test_load_api_key_securely_without_secure_storage(self):
        """Test loading API key securely without secure storage raises error."""
        auth_manager = AuthManager(use_secure_storage=False)
        
        with pytest.raises(ConfigurationError, match="Secure storage not available"):
            auth_manager.load_api_key_securely("test-id")
    
    def test_delete_api_key_securely_with_secure_storage(self):
        """Test deleting API key securely with secure storage enabled."""
        auth_manager = AuthManager(use_secure_storage=True)
        
        with patch.object(auth_manager.token_storage, 'delete_api_key') as mock_delete:
            auth_manager.delete_api_key_securely("test-id")
            mock_delete.assert_called_once_with("test-id")
    
    def test_delete_api_key_securely_without_secure_storage(self):
        """Test deleting API key securely without secure storage raises error."""
        auth_manager = AuthManager(use_secure_storage=False)
        
        with pytest.raises(ConfigurationError, match="Secure storage not available"):
            auth_manager.delete_api_key_securely("test-id")
    
    @pytest.mark.asyncio
    async def test_proactive_refresh_integration(self):
        """Test proactive token refresh in real scenario."""
        auth_manager = AuthManager()
        mock_http_client = AsyncMock()
        auth_manager.set_http_client(mock_http_client)
        
        # Create token that expires in 3 minutes (should trigger proactive refresh)
        expires_soon_token = TokenResponse(
            access_token="expires_soon",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(minutes=57),  # 3 minutes until expiry
            expires_in=3600
        )
        
        # Mock storage to return the expires-soon token
        with patch.object(auth_manager.token_storage, 'load_tokens', return_value=expires_soon_token):
            with patch.object(auth_manager.token_storage, 'save_tokens') as mock_save:
                # Mock successful refresh
                mock_http_client.post.return_value = {
                    "access_token": "refreshed_proactive",
                    "refresh_token": "new_refresh",
                    "token_type": "bearer",
                    "expires_in": 3600
                }
                
                result = await auth_manager.get_valid_access_token_async()
                
                # Should have gotten the refreshed token
                assert result == "refreshed_proactive"
                
                # Should have called refresh endpoint
                mock_http_client.post.assert_called_with("/auth/refresh", json={"refresh_token": "refresh_token"})
                
                # Should have saved the new tokens
                mock_save.assert_called_once()
    
    def test_get_auth_headers_with_async_token_refresh(self):
        """Test that get_auth_headers works with current token state."""
        auth_manager = AuthManager()
        
        # Set current tokens
        tokens = TokenResponse(
            access_token="current_access_token",
            refresh_token="refresh_token",
            issued_at=datetime.now(),
            expires_in=3600
        )
        auth_manager._current_tokens = tokens
        
        headers = auth_manager.get_auth_headers()
        assert headers["Authorization"] == "Bearer current_access_token"
    
    def test_auth_method_detection(self):
        """Test authentication method detection."""
        # Test API key method
        auth_manager = AuthManager(api_key="test-api-key")
        assert auth_manager.auth_method == "api_key"
        
        # Test JWT token method
        auth_manager = AuthManager()
        tokens = TokenResponse(
            access_token="jwt_token",
            refresh_token="refresh_token",
            issued_at=datetime.now(),
            expires_in=3600
        )
        auth_manager._current_tokens = tokens
        assert auth_manager.auth_method == "jwt_token"
        
        # Test no authentication
        auth_manager = AuthManager()
        assert auth_manager.auth_method == "none"
    
    def test_is_authenticated_property(self):
        """Test is_authenticated property with different auth states."""
        # Test with API key
        auth_manager = AuthManager(api_key="test-api-key")
        assert auth_manager.is_authenticated is True
        
        # Test with valid JWT token
        auth_manager = AuthManager()
        tokens = TokenResponse(
            access_token="jwt_token",
            refresh_token="refresh_token",
            issued_at=datetime.now(),
            expires_in=3600
        )
        auth_manager._current_tokens = tokens
        assert auth_manager.is_authenticated is True
        
        # Test with expired JWT token
        expired_tokens = TokenResponse(
            access_token="expired_token",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(hours=2),
            expires_in=3600
        )
        auth_manager._current_tokens = expired_tokens
        assert auth_manager.is_authenticated is False
        
        # Test with no authentication
        auth_manager = AuthManager()
        assert auth_manager.is_authenticated is False