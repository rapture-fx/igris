"""
Reinforcement Learning Environments for Schlep Engine Optimization

This module provides specialized RL environments for different optimization scenarios:
- Pipeline resource allocation optimization
- Data quality threshold optimization  
- Cost-performance balance optimization
- Multi-tenant scheduling optimization
"""

# Import only existing environments
try:
    from .ml_training_env import MLTrainingEnvironment
    _ML_TRAINING_AVAILABLE = True
except ImportError:
    _ML_TRAINING_AVAILABLE = False

# Other environments are not yet implemented, so we'll skip them for now
__all__ = []

if _ML_TRAINING_AVAILABLE:
    __all__.append("MLTrainingEnvironment")