"""
Base API class for Schlep-engine SDK
"""

from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING
from abc import ABC

from ..utils.logging import LoggerMixin
from ..models.common import APIResponse, PaginationInfo, from_dict

if TYPE_CHECKING:
    from ..client.main import SchlepEngineClient


class BaseAPI(LoggerMixin, ABC):
    """
    Base class for all API endpoint implementations.
    
    Provides common functionality for making API requests, handling responses,
    and managing pagination.
    """
    
    def __init__(self, client: 'SchlepEngineClient'):
        """
        Initialize API base class.
        
        Args:
            client: The main Schlep-engine client instance
        """
        self.client = client
        self.base_path = ""  # Override in subclasses
    
    async def _request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make API request through the client.
        
        Args:
            method: HTTP method
            path: API path (will be prefixed with base_path)
            **kwargs: Additional request parameters
            
        Returns:
            API response data
        """
        # Build full path
        if self.base_path and not path.startswith('/'):
            full_path = f"{self.base_path}/{path}"
        else:
            full_path = path
        
        return await self.client.request(method, full_path, **kwargs)
    
    async def _get(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make GET request."""
        return await self._request("GET", path, **kwargs)
    
    async def _post(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make POST request."""
        return await self._request("POST", path, **kwargs)
    
    async def _put(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make PUT request."""
        return await self._request("PUT", path, **kwargs)
    
    async def _patch(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make PATCH request."""
        return await self._request("PATCH", path, **kwargs)
    
    async def _delete(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make DELETE request."""
        return await self._request("DELETE", path, **kwargs)
    
    def _parse_response(
        self,
        response_data: Dict[str, Any],
        data_class: Optional[type] = None
    ) -> APIResponse:
        """
        Parse API response into APIResponse object.
        
        Args:
            response_data: Raw response data from API
            data_class: Optional dataclass to parse data into
            
        Returns:
            Parsed API response
        """
        # Handle different response formats
        if "success" in response_data:
            # Standard API response format
            success = response_data["success"]
            data = response_data.get("data")
            message = response_data.get("message")
            error_code = response_data.get("error_code")
        else:
            # Direct data response
            success = True
            data = response_data
            message = None
            error_code = None
        
        # Parse data using dataclass if provided
        if data_class and data:
            if isinstance(data, list):
                data = [from_dict(data_class, item) for item in data]
            elif isinstance(data, dict):
                data = from_dict(data_class, data)
        
        # Parse pagination info
        pagination = None
        if "pagination" in response_data:
            pagination = from_dict(PaginationInfo, response_data["pagination"])
        
        return APIResponse(
            success=success,
            data=data,
            message=message,
            error_code=error_code,
            pagination=pagination,
            request_id=response_data.get("request_id")
        )
    
    def _build_query_params(self, **kwargs) -> Dict[str, Any]:
        """
        Build query parameters from keyword arguments.
        
        Args:
            **kwargs: Query parameters
            
        Returns:
            Filtered query parameters (removes None values)
        """
        return {k: v for k, v in kwargs.items() if v is not None}
    
    async def _paginated_request(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data_class: Optional[type] = None,
        **kwargs
    ) -> APIResponse[List[Any]]:
        """
        Make paginated API request.
        
        Args:
            path: API path
            params: Query parameters
            data_class: Optional dataclass for parsing items
            **kwargs: Additional request parameters
            
        Returns:
            API response with paginated data
        """
        query_params = params or {}
        response_data = await self._get(path, params=query_params, **kwargs)
        return self._parse_response(response_data, data_class)
    
    async def _get_all_pages(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data_class: Optional[type] = None,
        max_pages: int = 100
    ) -> List[Any]:
        """
        Fetch all pages of a paginated endpoint.
        
        Args:
            path: API path
            params: Query parameters
            data_class: Optional dataclass for parsing items
            max_pages: Maximum number of pages to fetch
            
        Returns:
            List of all items across all pages
        """
        all_items = []
        current_page = 1
        
        while current_page <= max_pages:
            query_params = (params or {}).copy()
            query_params['page'] = current_page
            
            response = await self._paginated_request(path, query_params, data_class)
            
            if response.data:
                all_items.extend(response.data)
            
            # Check if there are more pages
            if not response.pagination or not response.pagination.has_next:
                break
                
            current_page += 1
        
        return all_items