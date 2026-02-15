"""
Authentication manager for Igris-engine SDK
"""

import logging
from typing import Optional, Dict, Any, Union
from datetime import datetime, timedelta

from ..models.auth import TokenResponse, LoginRequest, RegisterRequest, RefreshTokenRequest, UserInfo
from ..exceptions.base import AuthenticationError, ConfigurationError
from .token_storage import TokenStorage, SecureTokenStorage


logger = logging.getLogger(__name__)


class AuthManager:
    """
    Manages authentication for the Igris-engine SDK.
    Handles API keys, JWT tokens, token refresh, and user authentication.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        token_storage_path: Optional[str] = None,
        use_secure_storage: bool = True
    ):
        """
        Initialize authentication manager.
        
        Args:
            api_key: API key for authentication
            base_url: Base URL for the API
            token_storage_path: Custom path for token storage
            use_secure_storage: Whether to use secure keyring storage (default: True)
        """
        self.api_key = api_key
        self.base_url = base_url or "https://api.igris-inertial.com"
        
        # Initialize appropriate token storage
        if use_secure_storage:
            self.token_storage = SecureTokenStorage(token_storage_path)
        else:
            self.token_storage = TokenStorage(token_storage_path)
        
        self._current_tokens: Optional[TokenResponse] = None
        self._http_client = None  # Will be injected by main client
    
    def set_http_client(self, http_client):
        """Set the HTTP client for API requests."""
        self._http_client = http_client
    
    @property
    def is_authenticated(self) -> bool:
        """Check if user is currently authenticated."""
        return bool(self.api_key or self.get_valid_access_token())
    
    @property
    def auth_method(self) -> str:
        """Get current authentication method."""
        if self.api_key:
            return "api_key"
        elif self.get_valid_access_token():
            return "jwt_token"
        else:
            return "none"
    
    def get_auth_headers(self) -> Dict[str, str]:
        """
        Get authentication headers for API requests.
        
        Returns:
            Dictionary of headers to include in requests
        """
        headers = {}
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        else:
            access_token = self.get_valid_access_token()
            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"
        
        return headers
    
    def get_valid_access_token(self) -> Optional[str]:
        """
        Get a valid access token, refreshing if necessary.
        
        Returns:
            Valid access token or None if not available
        """
        # Check if we have tokens in memory
        if self._current_tokens:
            if not self._current_tokens.is_expired:
                # Check if token expires soon and refresh proactively
                if self._current_tokens.expires_soon and self._current_tokens.refresh_token:
                    logger.debug("Access token expires soon, attempting proactive refresh")
                    try:
                        # This will require async context, so we'll handle it differently
                        pass
                    except Exception as e:
                        logger.debug(f"Proactive refresh failed: {e}")
                
                return self._current_tokens.access_token
        
        # Try to load from storage
        stored_tokens = self.token_storage.load_tokens()
        if stored_tokens and not stored_tokens.is_expired:
            self._current_tokens = stored_tokens
            return stored_tokens.access_token
        
        # Try to refresh if we have a refresh token
        if stored_tokens and stored_tokens.refresh_token:
            try:
                refreshed_tokens = self._refresh_access_token(stored_tokens.refresh_token)
                if refreshed_tokens:
                    self._current_tokens = refreshed_tokens
                    self.token_storage.save_tokens(refreshed_tokens)
                    return refreshed_tokens.access_token
            except Exception as e:
                logger.warning(f"Failed to refresh access token: {e}")
                self.clear_authentication()
        
        return None
    
    async def get_valid_access_token_async(self) -> Optional[str]:
        """
        Get a valid access token with automatic refresh (async version).
        
        Returns:
            Valid access token or None if not available
        """
        # Check if we have tokens in memory
        if self._current_tokens:
            if not self._current_tokens.is_expired:
                # Check if token expires soon and refresh proactively
                if self._current_tokens.expires_soon and self._current_tokens.refresh_token:
                    logger.info("Access token expires soon, refreshing proactively")
                    try:
                        refreshed_tokens = await self.refresh_tokens()
                        if refreshed_tokens:
                            return refreshed_tokens.access_token
                    except Exception as e:
                        logger.warning(f"Proactive refresh failed: {e}")
                
                return self._current_tokens.access_token
        
        # Try to load from storage
        stored_tokens = self.token_storage.load_tokens()
        if stored_tokens and not stored_tokens.is_expired:
            self._current_tokens = stored_tokens
            # Check if this stored token also expires soon
            if stored_tokens.expires_soon and stored_tokens.refresh_token:
                logger.info("Stored token expires soon, refreshing proactively")
                try:
                    refreshed_tokens = await self.refresh_tokens()
                    if refreshed_tokens:
                        return refreshed_tokens.access_token
                except Exception as e:
                    logger.warning(f"Proactive refresh of stored token failed: {e}")
            
            return stored_tokens.access_token
        
        # Try to refresh if we have a refresh token
        if stored_tokens and stored_tokens.refresh_token:
            try:
                refreshed_tokens = await self.refresh_tokens()
                if refreshed_tokens:
                    return refreshed_tokens.access_token
            except Exception as e:
                logger.warning(f"Failed to refresh access token: {e}")
                self.clear_authentication()
        
        return None
    
    async def ensure_valid_token(self) -> bool:
        """
        Ensure we have a valid access token, refreshing if necessary.
        
        Returns:
            True if valid token is available, False otherwise
        """
        token = await self.get_valid_access_token_async()
        return token is not None
    
    async def login(self, email: str, password: str, remember_me: bool = False) -> TokenResponse:
        """
        Login with email and password.
        
        Args:
            email: User email
            password: User password
            remember_me: Whether to remember the login
            
        Returns:
            Token response with access and refresh tokens
        """
        if not self._http_client:
            raise ConfigurationError("HTTP client not initialized")
        
        login_request = LoginRequest(
            email=email,
            password=password,
            remember_me=remember_me
        )
        
        try:
            response = await self._http_client.post("/auth/login", json=login_request.to_dict())
            token_data = response.get("data", response)
            
            # Parse user data if present
            user = None
            if token_data.get("user"):
                user_data = token_data["user"]
                # Convert datetime strings if needed
                for field in ["created_at", "last_login"]:
                    if user_data.get(field) and isinstance(user_data[field], str):
                        try:
                            user_data[field] = datetime.fromisoformat(user_data[field])
                        except ValueError:
                            pass
                user = UserInfo(**user_data)
            
            tokens = TokenResponse(
                access_token=token_data["access_token"],
                refresh_token=token_data["refresh_token"],
                token_type=token_data.get("token_type", "bearer"),
                expires_in=token_data.get("expires_in", 3600),
                user=user,
                scope=token_data.get("scope")
            )
            
            # Store tokens
            self._current_tokens = tokens
            self.token_storage.save_tokens(tokens)
            
            logger.info(f"Successfully logged in user: {email}")
            return tokens
            
        except Exception as e:
            logger.error(f"Login failed for {email}: {e}")
            raise AuthenticationError(f"Login failed: {str(e)}")
    
    async def register(
        self,
        email: str,
        password: str,
        username: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        organization: Optional[str] = None
    ) -> TokenResponse:
        """
        Register a new user account.
        
        Args:
            email: User email
            password: User password
            username: Username (optional)
            first_name: First name (optional)
            last_name: Last name (optional)
            organization: Organization name (optional)
            
        Returns:
            Token response with access and refresh tokens
        """
        if not self._http_client:
            raise ConfigurationError("HTTP client not initialized")
        
        register_request = RegisterRequest(
            email=email,
            password=password,
            username=username,
            first_name=first_name,
            last_name=last_name,
            organization=organization
        )
        
        try:
            response = await self._http_client.post("/auth/register", json=register_request.to_dict())
            token_data = response.get("data", response)
            
            # Parse user data if present
            user = None
            if token_data.get("user"):
                user_data = token_data["user"]
                # Convert datetime strings if needed
                for field in ["created_at", "last_login"]:
                    if user_data.get(field) and isinstance(user_data[field], str):
                        try:
                            user_data[field] = datetime.fromisoformat(user_data[field])
                        except ValueError:
                            pass
                user = UserInfo(**user_data)
            
            tokens = TokenResponse(
                access_token=token_data["access_token"],
                refresh_token=token_data["refresh_token"],
                token_type=token_data.get("token_type", "bearer"),
                expires_in=token_data.get("expires_in", 3600),
                user=user,
                scope=token_data.get("scope")
            )
            
            # Store tokens
            self._current_tokens = tokens
            self.token_storage.save_tokens(tokens)
            
            logger.info(f"Successfully registered user: {email}")
            return tokens
            
        except Exception as e:
            logger.error(f"Registration failed for {email}: {e}")
            raise AuthenticationError(f"Registration failed: {str(e)}")
    
    def _refresh_access_token(self, refresh_token: str) -> Optional[TokenResponse]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Refresh token
            
        Returns:
            New token response or None if refresh failed
        """
        if not self._http_client:
            return None
        
        try:
            refresh_request = RefreshTokenRequest(refresh_token=refresh_token)
            # Note: This would need to be a synchronous call or handled differently
            # For now, we'll return None and handle refresh in async context
            return None
        except Exception as e:
            logger.warning(f"Token refresh failed: {e}")
            return None
    
    async def refresh_tokens(self) -> Optional[TokenResponse]:
        """
        Refresh access token asynchronously.
        
        Returns:
            New token response or None if refresh failed
        """
        if not self._http_client:
            raise ConfigurationError("HTTP client not initialized")
        
        current_tokens = self._current_tokens or self.token_storage.load_tokens()
        if not current_tokens or not current_tokens.refresh_token:
            return None
        
        try:
            refresh_request = RefreshTokenRequest(refresh_token=current_tokens.refresh_token)
            response = await self._http_client.post("/auth/refresh", json=refresh_request.to_dict())
            token_data = response.get("data", response)
            
            tokens = TokenResponse(
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token", current_tokens.refresh_token),
                token_type=token_data.get("token_type", "bearer"),
                expires_in=token_data.get("expires_in", 3600),
                user=current_tokens.user,  # Keep existing user info
                scope=token_data.get("scope")
            )
            
            # Store new tokens
            self._current_tokens = tokens
            self.token_storage.save_tokens(tokens)
            
            logger.info("Successfully refreshed access token")
            return tokens
            
        except Exception as e:
            logger.warning(f"Token refresh failed: {e}")
            self.clear_authentication()
            return None
    
    async def logout(self) -> None:
        """
        Logout user and clear stored tokens.
        """
        try:
            # Try to revoke tokens on server if possible
            if self._http_client and self.get_valid_access_token():
                try:
                    await self._http_client.post("/auth/logout")
                except Exception:
                    # Ignore errors during logout
                    pass
        finally:
            # Always clear local tokens
            self.clear_authentication()
    
    def clear_authentication(self) -> None:
        """Clear all authentication data."""
        self._current_tokens = None
        self.token_storage.clear_tokens()
        logger.info("Authentication data cleared")
    
    def get_current_user(self) -> Optional[UserInfo]:
        """
        Get current user information.
        
        Returns:
            User info if available, None otherwise
        """
        tokens = self._current_tokens or self.token_storage.load_tokens()
        return tokens.user if tokens else None
    
    def set_api_key(self, api_key: str) -> None:
        """
        Set API key for authentication.
        
        Args:
            api_key: API key to use
        """
        self.api_key = api_key
        logger.info("API key set for authentication")
    
    def save_api_key_securely(self, api_key: str, identifier: str = "default") -> None:
        """
        Securely save API key using keyring when available.
        
        Args:
            api_key: The API key to store securely
            identifier: Unique identifier for the API key (default: "default")
        """
        if isinstance(self.token_storage, SecureTokenStorage):
            self.token_storage.save_api_key(api_key, identifier)
        else:
            raise ConfigurationError("Secure storage not available. Initialize with use_secure_storage=True")
    
    def load_api_key_securely(self, identifier: str = "default") -> Optional[str]:
        """
        Load API key from secure keyring storage.
        
        Args:
            identifier: Unique identifier for the API key (default: "default")
            
        Returns:
            API key if found, None otherwise
        """
        if isinstance(self.token_storage, SecureTokenStorage):
            return self.token_storage.load_api_key(identifier)
        else:
            raise ConfigurationError("Secure storage not available. Initialize with use_secure_storage=True")
    
    def delete_api_key_securely(self, identifier: str = "default") -> None:
        """
        Delete API key from secure keyring storage.
        
        Args:
            identifier: Unique identifier for the API key (default: "default")
        """
        if isinstance(self.token_storage, SecureTokenStorage):
            self.token_storage.delete_api_key(identifier)
        else:
            raise ConfigurationError("Secure storage not available. Initialize with use_secure_storage=True")