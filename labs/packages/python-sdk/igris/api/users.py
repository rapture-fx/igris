"""
Users API for Igris-engine SDK
"""

from typing import Any, Dict, List, Optional

from .base import BaseAPI
from ..models.auth import UserInfo
from ..models.common import APIResponse


class UsersAPI(BaseAPI):
    """
    Users API client.
    
    Provides methods for user management.
    """
    
    def __init__(self, client):
        """Initialize users API."""
        super().__init__(client)
        self.base_path = "/users"
    
    async def get_profile(self) -> UserInfo:
        """
        Get current user profile.
        
        Returns:
            User information
        """
        response = await self._get("/me")
        user_data = response.get("data", response)
        return UserInfo(**user_data)
    
    async def update_profile(self, **updates) -> UserInfo:
        """
        Update user profile.
        
        Args:
            **updates: Fields to update
            
        Returns:
            Updated user information
        """
        response = await self._patch("/me", json=updates)
        user_data = response.get("data", response)
        return UserInfo(**user_data)