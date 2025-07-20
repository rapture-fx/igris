"""
Data Processing API Router
Re-exports from endpoints/data_processing.py for compatibility
"""

from .endpoints.data_processing import router

__all__ = ['router']