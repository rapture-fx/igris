"""
Authentication API Router
Re-exports from auth_unified.py for compatibility
"""

from .auth_unified import router

__all__ = ['router']