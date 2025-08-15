"""
Core Data Processing Services

This module provides the consolidated data processing infrastructure
to eliminate duplication and provide consistent interfaces.
"""

from .unified_processor import UnifiedDataProcessor
from .dependency_container import DependencyContainer
from .error_handling import standardized_error_handling
from .config_manager import ProcessingConfig

__all__ = [
    'UnifiedDataProcessor',
    'DependencyContainer', 
    'standardized_error_handling',
    'ProcessingConfig'
]