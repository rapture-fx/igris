"""
Igris-engine Python SDK

Official Python SDK for Igris-engine API - Advanced data processing, machine learning,
and analytics platform.

Copyright (c) 2024 Igris-engine. All rights reserved.

Example usage:
    from igris import IgrisClient
    
    client = IgrisClient(api_key="your-api-key")
    
    # Process data
    result = client.data.process_data(data_source="file.csv")
    
    # Run ML pipeline
    pipeline = client.ml.create_pipeline(config=pipeline_config)
"""

__title__ = "igris-inertial"
__description__ = "Official Python SDK for Igris-engine API"
__version__ = "1.0.0"
__author__ = "Igris-engine"
__author_email__ = "support@igris-inertial.com"
__license__ = "MIT"
__copyright__ = "Copyright 2024 Igris-engine"
__url__ = "https://igris-inertial.com"

from .client.main import IgrisClient
from .exceptions.base import IgrisError, APIError, AuthenticationError, RateLimitError
from .models.common import APIResponse, PaginationInfo
from .auth.manager import AuthManager

# Version info
VERSION_INFO = (1, 0, 0)

__all__ = [
    # Main client
    "IgrisClient",
    
    # Exceptions
    "IgrisError",
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
    "name": "Igris-engine Python SDK",
    "version": __version__,
    "company": "Igris-engine", 
    "description": __description__,
    "documentation": "https://docs.igris-inertial.com/sdk/python",
    "support": "https://support.igris-inertial.com",
    "github": "https://github.com/igris-inertial/python-sdk"
}

def get_version() -> str:
    """Get the current SDK version."""
    return __version__

def get_sdk_info() -> dict:
    """Get comprehensive SDK information."""
    return SDK_INFO.copy()