"""
Tests for secure token storage
"""

import pytest
import json
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

from igris.auth.token_storage import TokenStorage, SecureTokenStorage
from igris.models.auth import TokenResponse, UserInfo
from igris.exceptions.base import ConfigurationError


class TestTokenStorage:
    """Tests for basic TokenStorage class."""
    
    def test_init_default_path(self):
        """Test TokenStorage initialization with default path."""
        storage = TokenStorage()
        assert storage.storage_path.name == "tokens.json"
        assert ".igris" in str(storage.storage_path)
    
    def test_init_custom_path(self, tmp_path):
        """Test TokenStorage initialization with custom path."""
        custom_path = tmp_path / "custom_tokens.json"
        storage = TokenStorage(str(custom_path))
        assert storage.storage_path == custom_path
    
    def test_save_and_load_tokens(self, tmp_path, mock_token_response):
        """Test saving and loading tokens."""
        storage_path = tmp_path / "tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Save tokens
        storage.save_tokens(mock_token_response)
        assert storage_path.exists()
        
        # Load tokens
        loaded_tokens = storage.load_tokens()
        assert loaded_tokens is not None
        assert loaded_tokens.access_token == mock_token_response.access_token
        assert loaded_tokens.refresh_token == mock_token_response.refresh_token
        assert loaded_tokens.token_type == mock_token_response.token_type
    
    def test_save_tokens_creates_directory(self, tmp_path, mock_token_response):
        """Test that saving tokens creates necessary directories."""
        nested_path = tmp_path / "nested" / "dir" / "tokens.json"
        storage = TokenStorage(str(nested_path))
        
        storage.save_tokens(mock_token_response)
        assert nested_path.exists()
        assert nested_path.parent.exists()
    
    def test_load_tokens_nonexistent_file(self, tmp_path):
        """Test loading tokens from non-existent file."""
        storage_path = tmp_path / "nonexistent.json"
        storage = TokenStorage(str(storage_path))
        
        result = storage.load_tokens()
        assert result is None
    
    def test_load_tokens_corrupted_file(self, tmp_path):
        """Test loading tokens from corrupted file."""
        storage_path = tmp_path / "corrupted.json"
        storage = TokenStorage(str(storage_path))
        
        # Write corrupted JSON
        storage_path.write_text("invalid json content")
        
        result = storage.load_tokens()
        assert result is None
        assert not storage_path.exists()  # Should be cleaned up
    
    def test_clear_tokens(self, tmp_path, mock_token_response):
        """Test clearing stored tokens."""
        storage_path = tmp_path / "tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Save tokens first
        storage.save_tokens(mock_token_response)
        assert storage_path.exists()
        
        # Clear tokens
        storage.clear_tokens()
        assert not storage_path.exists()
    
    def test_has_tokens(self, tmp_path, mock_token_response):
        """Test checking if tokens exist."""
        storage_path = tmp_path / "tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Initially no tokens
        assert not storage.has_tokens()
        
        # After saving tokens
        storage.save_tokens(mock_token_response)
        assert storage.has_tokens()
        
        # After clearing tokens
        storage.clear_tokens()
        assert not storage.has_tokens()
    
    def test_get_access_token(self, tmp_path, mock_token_response):
        """Test getting access token only."""
        storage_path = tmp_path / "tokens.json"
        storage = TokenStorage(str(storage_path))
        
        storage.save_tokens(mock_token_response)
        access_token = storage.get_access_token()
        assert access_token == mock_token_response.access_token
    
    def test_is_token_expired(self, tmp_path, mock_token_response):
        """Test checking if token is expired."""
        storage_path = tmp_path / "tokens.json"
        storage = TokenStorage(str(storage_path))
        
        # Create expired token
        expired_token = TokenResponse(
            access_token="expired_token",
            refresh_token="refresh_token",
            issued_at=datetime.now() - timedelta(hours=2),
            expires_in=3600  # 1 hour
        )
        
        storage.save_tokens(expired_token)
        assert storage.is_token_expired()
        
        # Test with valid token
        storage.save_tokens(mock_token_response)
        assert not storage.is_token_expired()
    
    def test_file_permissions(self, tmp_path, mock_token_response):
        """Test that token file has restrictive permissions."""
        storage_path = tmp_path / "tokens.json"
        storage = TokenStorage(str(storage_path))
        
        storage.save_tokens(mock_token_response)
        
        # Check file permissions (should be 0o600)
        import stat
        file_mode = storage_path.stat().st_mode
        permissions = stat.filemode(file_mode)
        # Should be read/write for owner only
        assert permissions.startswith('-rw-------') or permissions.startswith('-rw-r--r--')


class TestSecureTokenStorage:
    """Tests for SecureTokenStorage class."""
    
    def test_init_with_keyring(self, tmp_path):
        """Test SecureTokenStorage initialization with keyring available."""
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
            assert storage.use_keyring is True
    
    def test_init_without_keyring(self, tmp_path):
        """Test SecureTokenStorage initialization without keyring."""
        with patch('igris.auth.token_storage.HAS_KEYRING', False):
            storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
            assert storage.use_keyring is False
    
    def test_save_tokens_with_keyring(self, tmp_path, mock_token_response):
        """Test saving tokens to keyring."""
        mock_keyring = MagicMock()
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
                storage.save_tokens(mock_token_response)
                
                # Should have called keyring.set_password
                mock_keyring.set_password.assert_called_once()
                service_name, username, token_data = mock_keyring.set_password.call_args[0]
                assert service_name == SecureTokenStorage.KEYRING_SERVICE_NAME
                assert username == SecureTokenStorage.KEYRING_USERNAME
                
                # Verify token data is valid JSON
                data = json.loads(token_data)
                assert data["access_token"] == mock_token_response.access_token
    
    def test_save_tokens_keyring_fallback(self, tmp_path, mock_token_response):
        """Test saving tokens falls back to file storage when keyring fails."""
        mock_keyring = MagicMock()
        mock_keyring.set_password.side_effect = Exception("Keyring error")
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
                storage.save_tokens(mock_token_response)
                
                # Should have tried keyring
                mock_keyring.set_password.assert_called_once()
                
                # Should have fallen back to file storage
                assert storage.storage_path.exists()
    
    def test_load_tokens_from_keyring(self, tmp_path, mock_token_response):
        """Test loading tokens from keyring."""
        # Prepare keyring data
        token_data = {
            "access_token": mock_token_response.access_token,
            "refresh_token": mock_token_response.refresh_token,
            "token_type": mock_token_response.token_type,
            "expires_in": mock_token_response.expires_in,
            "issued_at": mock_token_response.issued_at.isoformat(),
            "scope": mock_token_response.scope,
            "saved_at": datetime.now().isoformat()
        }
        
        mock_keyring = MagicMock()
        mock_keyring.get_password.return_value = json.dumps(token_data)
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
                loaded_tokens = storage.load_tokens()
                
                assert loaded_tokens is not None
                assert loaded_tokens.access_token == mock_token_response.access_token
                assert loaded_tokens.refresh_token == mock_token_response.refresh_token
    
    def test_load_tokens_keyring_fallback(self, tmp_path, mock_token_response):
        """Test loading tokens falls back to file storage when keyring fails."""
        mock_keyring = MagicMock()
        mock_keyring.get_password.side_effect = Exception("Keyring error")
        
        # Create file-based tokens
        file_storage = TokenStorage(str(tmp_path / "tokens.json"))
        file_storage.save_tokens(mock_token_response)
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
                loaded_tokens = storage.load_tokens()
                
                # Should have tried keyring
                mock_keyring.get_password.assert_called_once()
                
                # Should have fallen back to file storage
                assert loaded_tokens is not None
                assert loaded_tokens.access_token == mock_token_response.access_token
    
    def test_clear_tokens_both_storages(self, tmp_path, mock_token_response):
        """Test clearing tokens from both keyring and file storage."""
        mock_keyring = MagicMock()
        
        # Create tokens in both storages
        file_storage = TokenStorage(str(tmp_path / "tokens.json"))
        file_storage.save_tokens(mock_token_response)
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
                storage.clear_tokens()
                
                # Should have called keyring delete
                mock_keyring.delete_password.assert_called_once()
                
                # Should have cleared file storage too
                assert not storage.storage_path.exists()
    
    def test_save_api_key(self):
        """Test saving API key securely."""
        mock_keyring = MagicMock()
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage()
                storage.save_api_key("test-api-key", "test-identifier")
                
                mock_keyring.set_password.assert_called_once_with(
                    SecureTokenStorage.API_KEY_KEYRING_SERVICE,
                    "test-identifier",
                    "test-api-key"
                )
    
    def test_save_api_key_empty(self):
        """Test saving empty API key raises error."""
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            storage = SecureTokenStorage()
            
            with pytest.raises(ConfigurationError, match="cannot be empty"):
                storage.save_api_key("")
    
    def test_save_api_key_no_keyring(self):
        """Test saving API key without keyring raises error."""
        with patch('igris.auth.token_storage.HAS_KEYRING', False):
            storage = SecureTokenStorage()
            
            with pytest.raises(ConfigurationError, match="not available"):
                storage.save_api_key("test-key")
    
    def test_load_api_key(self):
        """Test loading API key securely."""
        mock_keyring = MagicMock()
        mock_keyring.get_password.return_value = "test-api-key"
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage()
                api_key = storage.load_api_key("test-identifier")
                
                assert api_key == "test-api-key"
                mock_keyring.get_password.assert_called_once_with(
                    SecureTokenStorage.API_KEY_KEYRING_SERVICE,
                    "test-identifier"
                )
    
    def test_load_api_key_not_found(self):
        """Test loading non-existent API key."""
        mock_keyring = MagicMock()
        mock_keyring.get_password.return_value = None
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage()
                api_key = storage.load_api_key("nonexistent")
                
                assert api_key is None
    
    def test_delete_api_key(self):
        """Test deleting API key securely."""
        mock_keyring = MagicMock()
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage()
                storage.delete_api_key("test-identifier")
                
                mock_keyring.delete_password.assert_called_once_with(
                    SecureTokenStorage.API_KEY_KEYRING_SERVICE,
                    "test-identifier"
                )
    
    def test_has_tokens_keyring_priority(self):
        """Test has_tokens checks keyring first."""
        mock_keyring = MagicMock()
        mock_keyring.get_password.return_value = "some token data"
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage()
                result = storage.has_tokens()
                
                assert result is True
                mock_keyring.get_password.assert_called_once()
    
    def test_load_tokens_corrupted_keyring_data(self, tmp_path):
        """Test loading corrupted data from keyring."""
        mock_keyring = MagicMock()
        mock_keyring.get_password.return_value = "invalid json data"
        
        with patch('igris.auth.token_storage.HAS_KEYRING', True):
            with patch('igris.auth.token_storage.keyring', mock_keyring):
                storage = SecureTokenStorage(str(tmp_path / "tokens.json"))
                loaded_tokens = storage.load_tokens()
                
                assert loaded_tokens is None
                # Should have cleared corrupted keyring data
                mock_keyring.delete_password.assert_called_once()


@pytest.fixture
def mock_token_response():
    """Mock token response for testing."""
    user = UserInfo(
        id="test-user-123",
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
        scope="read write",
        issued_at=datetime.now()
    )