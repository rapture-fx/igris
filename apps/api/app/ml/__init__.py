"""
Schlep-engine ML Module
Enhanced machine learning capabilities for industry-specific applications
"""

from .feature_engineering import SensorDataFeatureEngine, ColdStartFeatureEngine, RareEventFeatureEngine
from .data_quality import IndustrialDataQualityEngine, MultiSourceDataFusion
from .pipelines import ManufacturingPipeline, EcommercePipeline, FinancialPipeline
from .utils import MemoryEfficientProcessor, StreamingProcessor, FeatureCache

__all__ = [
    'SensorDataFeatureEngine',
    'ColdStartFeatureEngine', 
    'RareEventFeatureEngine',
    'IndustrialDataQualityEngine',
    'MultiSourceDataFusion',
    'ManufacturingPipeline',
    'EcommercePipeline',
    'FinancialPipeline',
    'MemoryEfficientProcessor',
    'StreamingProcessor',
    'FeatureCache'
]