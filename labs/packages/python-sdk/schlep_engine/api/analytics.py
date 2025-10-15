"""
Analytics API for Schlep-engine SDK
"""

from typing import Any, Dict, List, Optional

from .base import BaseAPI
from ..models.analytics import AnalyticsQuery, AnalyticsResult, AggregationType, TimeGranularity
from ..models.common import APIResponse


class AnalyticsAPI(BaseAPI):
    """
    Analytics API client.
    
    Provides methods for running analytics queries and generating insights.
    """
    
    def __init__(self, client):
        """Initialize analytics API."""
        super().__init__(client)
        self.base_path = "/analytics"
    
    async def query(self, query: AnalyticsQuery) -> AnalyticsResult:
        """
        Execute analytics query.
        
        Args:
            query: Analytics query configuration
            
        Returns:
            Query results
        """
        response = await self._post("/query", json=query.to_dict())
        result_data = response.get("data", response)
        
        return AnalyticsResult(**result_data)
    
    async def get_datasets(self) -> List[Dict[str, Any]]:
        """
        Get available datasets for analytics.
        
        Returns:
            List of available datasets
        """
        response = await self._get("/datasets")
        return response.get("data", response).get("datasets", [])
    
    async def get_schema(self, dataset: str) -> Dict[str, Any]:
        """
        Get dataset schema.
        
        Args:
            dataset: Dataset name
            
        Returns:
            Dataset schema information
        """
        response = await self._get(f"/datasets/{dataset}/schema")
        return response.get("data", response)