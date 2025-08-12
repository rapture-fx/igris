"""
Data Processing API Router
Re-exports from endpoints for compatibility
"""

from fastapi import APIRouter

from .endpoints import data_processing, document_extraction, validation
from . import data_quality, ml_pipeline, storage

router = APIRouter()

router.include_router(data_processing.router, prefix="/processing", tags=["Data Processing"])
router.include_router(document_extraction.router, prefix="/extraction", tags=["Document Extraction"])
router.include_router(data_quality.router, prefix="/quality", tags=["Data Quality"])
router.include_router(ml_pipeline.router, prefix="/ml", tags=["ML Pipeline"])
router.include_router(storage.router, prefix="/storage", tags=["File Storage"])
router.include_router(validation.router, prefix="/validation", tags=["Validation"])
