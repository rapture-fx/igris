"""
Token storage and management for Igris-engine SDK
"""

import os
import json
import logging
from typing import Optional, Dict, Any, Union
from pathlib import Path
from datetime import datetime

try:
    import keyring
    HAS_KEYRING = True
except ImportError:
    HAS_KEYRING = False

from ..models.auth import TokenResponse
from ..exceptions.base import ConfigurationError


class TokenStorage:
    """
    Manages secure storage and retrieval of authentication tokens.
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize token storage.
        
        Args:
            storage_path: Custom path for token storage. If None, uses default.
        """
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            # Default to user's home directory
            home_dir = Path.home()
            self.storage_path = home_dir / ".igris" / "tokens.json"
        
        # Ensure directory exists
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
    
    def save_tokens(self, tokens: TokenResponse) -> None:
        """
        Save authentication tokens to storage.
        
        Args:
            tokens: Token response containing access and refresh tokens
        """
        try:
            data = {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "token_type": tokens.token_type,
                "expires_in": tokens.expires_in,
                "issued_at": tokens.issued_at.isoformat() if tokens.issued_at else None,
                "scope": tokens.scope,
                "saved_at": datetime.now().isoformat()
            }
            
            if tokens.user:
                data["user"] = tokens.user.to_dict()
            
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=2)
                
            # Set restrictive permissions (readable only by owner)
            os.chmod(self.storage_path, 0o600)
            
        except Exception as e:
            raise ConfigurationError(f"Failed to save tokens: {str(e)}")
    
    def load_tokens(self) -> Optional[TokenResponse]:
        """
        Load authentication tokens from storage.
        
        Returns:
            TokenResponse if tokens exist and are valid, None otherwise
        """
        if not self.storage_path.exists():
            return None
            
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
            
            # Parse datetime fields
            if data.get("issued_at"):
                data["issued_at"] = datetime.fromisoformat(data["issued_at"])
            
            # Create user info if present
            user = None
            if data.get("user"):
                from ..models.auth import UserInfo
                user_data = data["user"]
                if user_data.get("created_at"):
                    user_data["created_at"] = datetime.fromisoformat(user_data["created_at"])
                if user_data.get("last_login"):
                    user_data["last_login"] = datetime.fromisoformat(user_data["last_login"])
                user = UserInfo(**user_data)
            
            return TokenResponse(
                access_token=data["access_token"],
                refresh_token=data["refresh_token"],
                token_type=data.get("token_type", "bearer"),
                expires_in=data.get("expires_in", 3600),
                issued_at=data.get("issued_at"),
                scope=data.get("scope"),
                user=user
            )
            
        except Exception as e:
            # If we can't load tokens, remove the corrupted file
            self.clear_tokens()
            return None
    
    def clear_tokens(self) -> None:
        """Remove stored tokens."""
        try:
            if self.storage_path.exists():
                self.storage_path.unlink()
        except Exception:
            # Ignore errors when clearing
            pass
    
    def has_tokens(self) -> bool:
        """Check if tokens are stored."""
        return self.storage_path.exists()
    
    def get_access_token(self) -> Optional[str]:
        """Get only the access token."""
        tokens = self.load_tokens()
        return tokens.access_token if tokens else None
    
    def is_token_expired(self) -> bool:
        """Check if stored token is expired."""
        tokens = self.load_tokens()
        return tokens.is_expired if tokens else True


class SecureTokenStorage(TokenStorage):
    """
    Enhanced token storage with keyring support for secure credential storage.
    Falls back to file-based storage if keyring is not available.
    """
    
    KEYRING_SERVICE_NAME = "igris-inertial-sdk"
    KEYRING_USERNAME = "default"
    API_KEY_KEYRING_SERVICE = "igris-inertial-api-key"
    
    def __init__(self, storage_path: Optional[str] = None, use_keyring: bool = True):
        """
        Initialize secure token storage.
        
        Args:
            storage_path: Custom path for file-based token storage fallback
            use_keyring: Whether to use keyring for secure storage (default: True)
        """
        super().__init__(storage_path)
        self.use_keyring = use_keyring and HAS_KEYRING
        self.logger = logging.getLogger(__name__)
        
        if use_keyring and not HAS_KEYRING:
            self.logger.warning(
                "Keyring requested but not available. Install 'keyring' package for secure storage. "
                "Falling back to file-based storage."
            )
    
    def save_tokens(self, tokens: TokenResponse) -> None:
        """
        Save authentication tokens using secure storage when available.
        
        Args:
            tokens: Token response containing access and refresh tokens
        """
        if self.use_keyring:
            try:
                self._save_tokens_to_keyring(tokens)
                return
            except Exception as e:
                self.logger.warning(f"Failed to save tokens to keyring: {e}. Falling back to file storage.")
        
        # Fall back to file-based storage
        super().save_tokens(tokens)
    
    def load_tokens(self) -> Optional[TokenResponse]:
        """
        Load authentication tokens from secure storage.
        
        Returns:
            TokenResponse if tokens exist and are valid, None otherwise
        """
        if self.use_keyring:
            try:
                tokens = self._load_tokens_from_keyring()
                if tokens:
                    return tokens
            except Exception as e:
                self.logger.warning(f"Failed to load tokens from keyring: {e}. Trying file storage.")
        
        # Fall back to file-based storage
        return super().load_tokens()
    
    def clear_tokens(self) -> None:
        """Remove stored tokens from both keyring and file storage."""
        if self.use_keyring:
            try:
                keyring.delete_password(self.KEYRING_SERVICE_NAME, self.KEYRING_USERNAME)
            except Exception as e:
                self.logger.debug(f"Error clearing keyring tokens: {e}")
        
        # Also clear file-based storage
        super().clear_tokens()
    
    def save_api_key(self, api_key: str, identifier: str = "default") -> None:
        """
        Securely save API key using keyring when available.
        
        Args:
            api_key: The API key to store securely
            identifier: Unique identifier for the API key (default: "default")
        """
        if not api_key:
            raise ConfigurationError("API key cannot be empty")
        
        if self.use_keyring:
            try:
                keyring.set_password(self.API_KEY_KEYRING_SERVICE, identifier, api_key)
                self.logger.info(f"API key '{identifier}' saved securely to keyring")
                return
            except Exception as e:
                self.logger.warning(f"Failed to save API key to keyring: {e}")
                raise ConfigurationError(f"Failed to save API key securely: {e}")
        else:
            raise ConfigurationError("Keyring not available for secure API key storage")
    
    def load_api_key(self, identifier: str = "default") -> Optional[str]:
        """
        Load API key from secure keyring storage.
        
        Args:
            identifier: Unique identifier for the API key (default: "default")
            
        Returns:
            API key if found, None otherwise
        """
        if self.use_keyring:
            try:
                api_key = keyring.get_password(self.API_KEY_KEYRING_SERVICE, identifier)
                if api_key:
                    self.logger.debug(f"API key '{identifier}' loaded from keyring")
                return api_key
            except Exception as e:
                self.logger.warning(f"Failed to load API key from keyring: {e}")
        
        return None
    
    def delete_api_key(self, identifier: str = "default") -> None:
        """
        Delete API key from secure keyring storage.
        
        Args:
            identifier: Unique identifier for the API key (default: "default")
        """
        if self.use_keyring:
            try:
                keyring.delete_password(self.API_KEY_KEYRING_SERVICE, identifier)
                self.logger.info(f"API key '{identifier}' deleted from keyring")
            except Exception as e:
                self.logger.warning(f"Failed to delete API key from keyring: {e}")
    
    def has_tokens(self) -> bool:
        """Check if tokens are stored in either keyring or file storage."""
        if self.use_keyring:
            try:
                token_data = keyring.get_password(self.KEYRING_SERVICE_NAME, self.KEYRING_USERNAME)
                if token_data:
                    return True
            except Exception:
                pass
        
        # Fall back to file-based storage check
        return super().has_tokens()
    
    def _save_tokens_to_keyring(self, tokens: TokenResponse) -> None:
        """Save tokens to keyring storage."""
        data = {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "token_type": tokens.token_type,
            "expires_in": tokens.expires_in,
            "issued_at": tokens.issued_at.isoformat() if tokens.issued_at else None,
            "scope": tokens.scope,
            "saved_at": datetime.now().isoformat()
        }
        
        if tokens.user:
            data["user"] = tokens.user.to_dict()
        
        # Store as JSON string in keyring
        token_json = json.dumps(data)
        keyring.set_password(self.KEYRING_SERVICE_NAME, self.KEYRING_USERNAME, token_json)
        self.logger.debug("Tokens saved to keyring")
    
    def _load_tokens_from_keyring(self) -> Optional[TokenResponse]:
        """Load tokens from keyring storage."""
        token_data = keyring.get_password(self.KEYRING_SERVICE_NAME, self.KEYRING_USERNAME)
        if not token_data:
            return None
        
        try:
            data = json.loads(token_data)
            
            # Parse datetime fields
            if data.get("issued_at"):
                data["issued_at"] = datetime.fromisoformat(data["issued_at"])
            
            # Create user info if present
            user = None
            if data.get("user"):
                from ..models.auth import UserInfo
                user_data = data["user"]
                if user_data.get("created_at"):
                    user_data["created_at"] = datetime.fromisoformat(user_data["created_at"])
                if user_data.get("last_login"):
                    user_data["last_login"] = datetime.fromisoformat(user_data["last_login"])
                user = UserInfo(**user_data)
            
            tokens = TokenResponse(
                access_token=data["access_token"],
                refresh_token=data["refresh_token"],
                token_type=data.get("token_type", "bearer"),
                expires_in=data.get("expires_in", 3600),
                issued_at=data.get("issued_at"),
                scope=data.get("scope"),
                user=user
            )
            
            self.logger.debug("Tokens loaded from keyring")
            return tokens
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            self.logger.warning(f"Invalid token data in keyring: {e}")
            # Clear corrupted data
            try:
                keyring.delete_password(self.KEYRING_SERVICE_NAME, self.KEYRING_USERNAME)
            except Exception:
                pass
            return None