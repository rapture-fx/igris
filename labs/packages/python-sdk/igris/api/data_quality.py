"""
Data Quality API for Igris-engine SDK
"""

from typing import Any, Dict, List, Optional, Union
from pathlib import Path

from .base import BaseAPI
from ..models.data import DataQualityReport
from ..models.common import APIResponse


class DataQualityAPI(BaseAPI):
    """
    Data Quality API client.
    
    Provides methods for assessing and monitoring data quality.
    """
    
    def __init__(self, client):
        """Initialize data quality API."""
        super().__init__(client)
        self.base_path = "/quality"
    
    async def assess_quality(
        self,
        data_path: str,
        checks: Optional[List[str]] = None
    ) -> DataQualityReport:
        """
        Assess data quality.
        
        Args:
            data_path: Path to data file
            checks: Specific quality checks to run
            
        Returns:
            Data quality report
        """
        data = {
            "data_path": data_path,
            "checks": checks or []
        }
        
        response = await self._post("/assess", json=data)
        report_data = response.get("data", response)
        
        return DataQualityReport(**report_data)
    
    async def get_report(self, report_id: str) -> DataQualityReport:
        """
        Get quality assessment report.
        
        Args:
            report_id: Report ID
            
        Returns:
            Data quality report
        """
        response = await self._get(f"/reports/{report_id}")
        report_data = response.get("data", response)
        
        return DataQualityReport(**report_data)