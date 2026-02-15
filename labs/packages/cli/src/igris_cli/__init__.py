"""
Igris-engine CLI

Official command-line interface for Igris-engine API - Advanced data processing,
machine learning, and analytics platform.

Copyright (c) 2024 Igris-engine. All rights reserved.
"""

__title__ = "igris-inertial-cli"
__description__ = "Official CLI for Igris-engine API"
__version__ = "1.0.0"
__author__ = "Igris-engine"
__author_email__ = "support@igris-inertial.com"
__license__ = "MIT"
__copyright__ = "Copyright 2024 Igris-engine"
__url__ = "https://igris-inertial.com"

from .main import cli

__all__ = ["cli", "__version__"]