"""
Token storage and management for Schlep-engine SDK
"""

import os
import json
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime

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
            self.storage_path = home_dir / ".schlep_engine" / "tokens.json"
        
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