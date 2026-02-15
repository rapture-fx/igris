"""
Authentication API for Igris-engine SDK
"""

from typing import Optional, Dict, Any

from .base import BaseAPI
from ..models.auth import TokenResponse, UserInfo, LoginRequest, RegisterRequest


class AuthAPI(BaseAPI):
    """
    Authentication API client.
    
    Provides methods for user authentication, registration, and token management.
    """
    
    def __init__(self, client):
        """Initialize authentication API."""
        super().__init__(client)
        self.base_path = "/auth"
    
    async def login(
        self,
        email: str,
        password: str,
        remember_me: bool = False
    ) -> TokenResponse:
        """
        Login with email and password.
        
        Args:
            email: User email address
            password: User password
            remember_me: Whether to extend token validity
            
        Returns:
            Token response with access and refresh tokens
        """
        return await self.client.auth_manager.login(email, password, remember_me)
    
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
            email: User email address
            password: User password
            username: Username (optional)
            first_name: User's first name (optional)
            last_name: User's last name (optional)
            organization: User's organization (optional)
            
        Returns:
            Token response with access and refresh tokens
        """
        return await self.client.auth_manager.register(
            email=email,
            password=password,
            username=username,
            first_name=first_name,
            last_name=last_name,
            organization=organization
        )
    
    async def refresh_token(self) -> Optional[TokenResponse]:
        """
        Refresh the current access token.
        
        Returns:
            New token response or None if refresh failed
        """
        return await self.client.auth_manager.refresh_tokens()
    
    async def logout(self) -> None:
        """
        Logout the current user and clear tokens.
        """
        await self.client.auth_manager.logout()
    
    async def get_current_user(self) -> Optional[UserInfo]:
        """
        Get information about the currently authenticated user.
        
        Returns:
            User information or None if not authenticated
        """
        # First check if we have user info from tokens
        user = self.client.auth_manager.get_current_user()
        if user:
            return user
        
        # If not, fetch from API
        try:
            response = await self._get("/me")
            user_data = response.get("data", response)
            return UserInfo(**user_data)
        except Exception:
            return None
    
    async def update_profile(
        self,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        username: Optional[str] = None
    ) -> UserInfo:
        """
        Update user profile information.
        
        Args:
            first_name: New first name
            last_name: New last name
            username: New username
            
        Returns:
            Updated user information
        """
        update_data = {}
        if first_name is not None:
            update_data["first_name"] = first_name
        if last_name is not None:
            update_data["last_name"] = last_name
        if username is not None:
            update_data["username"] = username
        
        response = await self._patch("/me", json=update_data)
        user_data = response.get("data", response)
        return UserInfo(**user_data)
    
    async def change_password(
        self,
        current_password: str,
        new_password: str
    ) -> Dict[str, Any]:
        """
        Change user password.
        
        Args:
            current_password: Current password
            new_password: New password
            
        Returns:
            Success response
        """
        data = {
            "current_password": current_password,
            "new_password": new_password
        }
        return await self._post("/change-password", json=data)
    
    async def request_password_reset(self, email: str) -> Dict[str, Any]:
        """
        Request password reset email.
        
        Args:
            email: Email address to send reset link to
            
        Returns:
            Success response
        """
        data = {"email": email}
        return await self._post("/request-password-reset", json=data)
    
    async def verify_email(self, token: str) -> Dict[str, Any]:
        """
        Verify email address with token.
        
        Args:
            token: Email verification token
            
        Returns:
            Success response
        """
        data = {"token": token}
        return await self._post("/verify-email", json=data)
    
    async def resend_verification_email(self) -> Dict[str, Any]:
        """
        Resend email verification email.
        
        Returns:
            Success response
        """
        return await self._post("/resend-verification")