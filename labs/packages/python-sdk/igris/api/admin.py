"""
Admin API for Igris-engine SDK
"""

from typing import Any, Dict, List, Optional

from .base import BaseAPI
from ..models.common import APIResponse


class AdminAPI(BaseAPI):
    """
    Admin API client.
    
    Provides methods for administrative functions.
    """
    
    def __init__(self, client):
        """Initialize admin API."""
        super().__init__(client)
        self.base_path = "/admin"
    
    async def get_system_stats(self) -> Dict[str, Any]:
        """
        Get system statistics.
        
        Returns:
            System statistics
        """
        response = await self._get("/stats")
        return response.get("data", response)
    
    async def list_users(
        self,
        page: int = 1,
        page_size: int = 20
    ) -> APIResponse[List[Dict[str, Any]]]:
        """
        List all users (admin only).
        
        Args:
            page: Page number
            page_size: Items per page
            
        Returns:
            Paginated list of users
        """
        params = self._build_query_params(page=page, page_size=page_size)
        return await self._paginated_request("/users", params)