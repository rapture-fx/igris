"""
API modules for Igris-engine SDK
"""

from .base import BaseAPI
from .auth import AuthAPI
from .data_processing import DataProcessingAPI
from .ml_pipeline import MLPipelineAPI
from .analytics import AnalyticsAPI
from .document_extraction import DocumentExtractionAPI
from .data_quality import DataQualityAPI
from .storage import StorageAPI
from .monitoring import MonitoringAPI
from .users import UsersAPI
from .admin import AdminAPI
# RL optimization API removed - future adaptive optimizer extension point

__all__ = [
    "BaseAPI",
    "AuthAPI",
    "DataProcessingAPI",
    "MLPipelineAPI",
    "AnalyticsAPI",
    "DocumentExtractionAPI",
    "DataQualityAPI",
    "StorageAPI",
    "MonitoringAPI",
    "UsersAPI",
    "AdminAPI",
    # "AdaptiveOptimizerAPI"  # Future extension point
]