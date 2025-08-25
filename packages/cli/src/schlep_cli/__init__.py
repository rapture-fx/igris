"""
Schlep-engine CLI

Official command-line interface for Schlep-engine API - Advanced data processing,
machine learning, and analytics platform.

Copyright (c) 2024 Schlep-engine. All rights reserved.
"""

__title__ = "schlep-engine-cli"
__description__ = "Official CLI for Schlep-engine API"
__version__ = "1.0.0"
__author__ = "Schlep-engine"
__author_email__ = "support@schlep-engine.com"
__license__ = "MIT"
__copyright__ = "Copyright 2024 Schlep-engine"
__url__ = "https://schlep-engine.com"

from .main import cli

__all__ = ["cli", "__version__"]