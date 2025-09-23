"""
Services Module Initialization
=============================

This module exposes all the enhanced services for the Schlep-Engine distributed processing system.
"""

# Import all services for easy access
from .distributed_processor import distributed_processor, DistributedDataProcessor, ProcessingFormat
from .training_data_manager import (
    training_data_manager, TrainingDataManager, SplitStrategy,
    SplitConfig, DatasetType, DatasetMetadata
)
from .foundation_model_prep import (
    foundation_model_prep, FoundationModelPrep, TokenizationConfig,
    DeduplicationConfig, TokenizationStrategy, SequencePackingStrategy
)
from .realtime_quality_monitor import (
    realtime_quality_monitor, RealtimeQualityMonitor, QualityConfig,
    QualityCheckType, ReportFormat
)

# Legacy imports for backward compatibility
from .unified_data_processor import unified_processor, UnifiedDataProcessor
from .data_quality_service import DataQualityService

__all__ = [
    # Distributed Processing
    'distributed_processor',
    'DistributedDataProcessor',
    'ProcessingFormat',

    # Training Data Management
    'training_data_manager',
    'TrainingDataManager',
    'SplitStrategy',
    'SplitConfig',
    'DatasetType',
    'DatasetMetadata',

    # Foundation Model Preparation
    'foundation_model_prep',
    'FoundationModelPrep',
    'TokenizationConfig',
    'DeduplicationConfig',
    'TokenizationStrategy',
    'SequencePackingStrategy',

    # Quality Monitoring
    'realtime_quality_monitor',
    'RealtimeQualityMonitor',
    'QualityConfig',
    'QualityCheckType',
    'ReportFormat',

    # Legacy services
    'unified_processor',
    'UnifiedDataProcessor',
    'DataQualityService',
]