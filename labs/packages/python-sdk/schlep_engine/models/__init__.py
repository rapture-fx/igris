"""
Schlep-engine SDK Models

Data models and response classes for the Schlep-engine Python SDK.
"""

from .common import APIResponse, PaginationInfo, FileUpload, JobStatus
from .auth import TokenResponse, UserInfo, LoginRequest, RegisterRequest
from .data import DataProcessingRequest, DataProcessingResult, DataQualityReport
from .ml import MLPipelineConfig, MLPipelineResult, TrainingJob
from .analytics import AnalyticsQuery, AnalyticsResult

__all__ = [
    # Common
    "APIResponse",
    "PaginationInfo", 
    "FileUpload",
    "JobStatus",
    
    # Auth
    "TokenResponse",
    "UserInfo",
    "LoginRequest",
    "RegisterRequest",
    
    # Data
    "DataProcessingRequest",
    "DataProcessingResult",
    "DataQualityReport",
    
    # ML
    "MLPipelineConfig",
    "MLPipelineResult", 
    "TrainingJob",
    
    # Analytics
    "AnalyticsQuery",
    "AnalyticsResult"
]