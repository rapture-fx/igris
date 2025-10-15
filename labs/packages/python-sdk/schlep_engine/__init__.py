"""
Schlep-engine Python SDK

Official Python SDK for Schlep-engine API - Advanced data processing, machine learning,
and analytics platform.

Copyright (c) 2024 Schlep-engine. All rights reserved.

Example usage:
    from schlep_engine import SchlepEngineClient
    
    client = SchlepEngineClient(api_key="your-api-key")
    
    # Process data
    result = client.data.process_data(data_source="file.csv")
    
    # Run ML pipeline
    pipeline = client.ml.create_pipeline(config=pipeline_config)
"""

__title__ = "schlep-engine"
__description__ = "Official Python SDK for Schlep-engine API"
__version__ = "1.0.0"
__author__ = "Schlep-engine"
__author_email__ = "support@schlep-engine.com"
__license__ = "MIT"
__copyright__ = "Copyright 2024 Schlep-engine"
__url__ = "https://schlep-engine.com"

from .client.main import SchlepEngineClient
from .exceptions.base import SchlepEngineError, APIError, AuthenticationError, RateLimitError
from .models.common import APIResponse, PaginationInfo
from .auth.manager import AuthManager

# Version info
VERSION_INFO = (1, 0, 0)

__all__ = [
    # Main client
    "SchlepEngineClient",
    
    # Exceptions
    "SchlepEngineError",
    "APIError", 
    "AuthenticationError",
    "RateLimitError",
    
    # Models
    "APIResponse",
    "PaginationInfo",
    
    # Auth
    "AuthManager",
    
    # Metadata
    "__version__",
    "__author__",
    "__description__",
    "__title__",
    "__url__",
]

# SDK Info for debugging and support
SDK_INFO = {
    "name": "Schlep-engine Python SDK",
    "version": __version__,
    "company": "Schlep-engine", 
    "description": __description__,
    "documentation": "https://docs.schlep-engine.com/sdk/python",
    "support": "https://support.schlep-engine.com",
    "github": "https://github.com/schlep-engine/python-sdk"
}

def get_version() -> str:
    """Get the current SDK version."""
    return __version__

def get_sdk_info() -> dict:
    """Get comprehensive SDK information."""
    return SDK_INFO.copy()