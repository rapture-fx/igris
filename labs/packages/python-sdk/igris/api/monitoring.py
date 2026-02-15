"""
Monitoring API for Igris-engine SDK
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from .base import BaseAPI
from ..models.common import APIResponse


class MonitoringAPI(BaseAPI):
    """
    Monitoring API client.
    
    Provides methods for system monitoring and health checks.
    """
    
    def __init__(self, client):
        """Initialize monitoring API."""
        super().__init__(client)
        self.base_path = "/monitoring"
    
    async def get_system_health(self) -> Dict[str, Any]:
        """
        Get system health status.
        
        Returns:
            System health information
        """
        response = await self._get("/health")
        return response.get("data", response)
    
    async def get_metrics(
        self,
        metric_names: Optional[List[str]] = None,
        time_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Get system metrics.
        
        Args:
            metric_names: Specific metrics to retrieve
            time_range: Time range for metrics
            
        Returns:
            System metrics
        """
        params = {}
        if metric_names:
            params['metrics'] = ','.join(metric_names)
        if time_range:
            params.update(time_range)
        
        response = await self._get("/metrics", params=params)
        return response.get("data", response)