"""
Command modules for Igris-engine CLI.
"""

# Import all command groups
from . import auth
from . import process
from . import pipeline
from . import config
from . import monitoring
from . import devops
from . import cicd
from . import batch
from . import validate
from . import analytics
from . import document
from . import quality
from . import storage
from . import ml
from . import users
from . import admin

__all__ = [
    "auth", "process", "pipeline", "config", "monitoring",
    "devops", "cicd", "batch", "validate",
    "analytics", "document", "quality", "storage", "ml", "users", "admin"
]