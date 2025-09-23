"""
Multi-Modal Data Processing API
===============================

API endpoints for processing multi-modal datasets (text + images) for AI companies.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.services.multimodal_processor import MultiModalProcessor
from app.auth.dependencies import get_current_user
from app.database.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

class MultiModalRequest(BaseModel):
    """Request for multi-modal dataset processing"""
    text_data: List[str] = Field(..., description="List of text samples")
    image_paths: List[str] = Field(..., description="List of image file paths")
    labels: Optional[List[Any]] = Field(None, description="Optional labels for supervised learning")
    validate_alignment: bool = Field(True, description="Whether to validate text-image alignment")
    config: Optional[Dict[str, Any]] = Field(None, description="Processing configuration")

class MultiModalResponse(BaseModel):
    """Response from multi-modal processing"""
    status: str
    dataset_stats: Optional[Dict[str, Any]] = None
    quality_report: Optional[Dict[str, Any]] = None
    processing_results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ExportRequest(BaseModel):
    """Request for exporting processed dataset"""
    export_format: str = Field(..., description="Export format (json_manifest, pytorch_dataset, etc.)")
    output_path: str = Field(..., description="Output file path")

@router.post("/process", response_model=MultiModalResponse)
async def process_multimodal_dataset(
    request: MultiModalRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Process a multi-modal dataset (text + images) for AI training

    This endpoint validates, processes, and assesses the quality of
    multi-modal datasets commonly used by AI companies.
    """
    try:
        logger.info(f"Processing multi-modal dataset for user {current_user.id}")

        # Initialize processor
        processor = MultiModalProcessor(config=request.config)

        # Process the dataset
        results = processor.process_multimodal_dataset(
            text_data=request.text_data,
            image_paths=request.image_paths,
            labels=request.labels,
            validate_alignment=request.validate_alignment
        )

        if results['status'] == 'error':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=results['error']
            )

        return MultiModalResponse(
            status="success",
            dataset_stats=results['dataset_stats'],
            quality_report=results['quality_report'],
            processing_results={
                'text_processing': results['text_processing'],
                'image_processing': results['image_processing'],
                'alignment_validation': results['alignment_validation'],
                'export_options': results['export_options']
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multi-modal processing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )

@router.get("/capabilities")
async def get_multimodal_capabilities():
    """
    Get capabilities and configuration options for multi-modal processing
    """
    return {
        "supported_modalities": ["text", "image"],
        "supported_image_formats": [".jpg", ".jpeg", ".png", ".webp"],
        "max_file_size_mb": 50,
        "max_dataset_size": 10000,
        "quality_metrics": [
            "text_quality_score",
            "image_quality_score",
            "alignment_score",
            "overall_quality_score"
        ],
        "export_formats": [
            {
                "format": "json_manifest",
                "description": "JSON manifest with file references",
                "ready": True
            },
            {
                "format": "huggingface_datasets",
                "description": "HuggingFace Datasets format",
                "ready": False
            },
            {
                "format": "pytorch_dataset",
                "description": "PyTorch Dataset class",
                "ready": False
            }
        ],
        "validation_features": [
            "text_length_validation",
            "image_format_validation",
            "file_existence_check",
            "semantic_alignment_check"
        ]
    }

@router.post("/validate")
async def validate_multimodal_dataset(
    text_data: List[str],
    image_paths: List[str],
    labels: Optional[List[Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Quick validation of multi-modal dataset without full processing
    """
    try:
        processor = MultiModalProcessor()

        # Basic validation only
        from app.services.multimodal_processor import MultiModalDataset
        dataset = MultiModalDataset(
            text_data=text_data,
            image_paths=image_paths,
            labels=labels
        )

        validation_results = processor._validate_dataset(dataset)

        if not validation_results['valid']:
            return {
                "valid": False,
                "error": validation_results['error'],
                "recommendations": [
                    "Ensure text and image counts match",
                    "Verify all image paths exist",
                    "Check that labels count matches data if provided"
                ]
            }

        # Quick statistics
        stats = {
            "total_samples": len(text_data),
            "text_samples": len(text_data),
            "image_samples": len(image_paths),
            "labeled": labels is not None,
            "label_count": len(labels) if labels else 0
        }

        return {
            "valid": True,
            "dataset_stats": stats,
            "ready_for_processing": True
        }

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )

@router.get("/examples")
async def get_multimodal_examples():
    """
    Get examples of how to structure multi-modal datasets
    """
    return {
        "text_image_pairs": {
            "description": "Example of aligned text-image pairs",
            "example": {
                "text_data": [
                    "A red sports car parked in a garage",
                    "A blue ocean with white waves crashing on the shore",
                    "A green forest with tall pine trees"
                ],
                "image_paths": [
                    "/path/to/red_car.jpg",
                    "/path/to/ocean_waves.jpg",
                    "/path/to/forest.jpg"
                ],
                "labels": ["vehicle", "nature", "nature"]
            }
        },
        "classification_dataset": {
            "description": "Multi-modal classification dataset",
            "example": {
                "text_data": [
                    "Product description: High-quality running shoes with breathable mesh",
                    "Product description: Elegant evening dress in navy blue",
                    "Product description: Professional laptop with 16GB RAM"
                ],
                "image_paths": [
                    "/products/shoes_001.jpg",
                    "/products/dress_002.jpg",
                    "/products/laptop_003.jpg"
                ],
                "labels": ["footwear", "clothing", "electronics"]
            }
        },
        "common_use_cases": [
            "Product catalog with descriptions and images",
            "Social media posts with text and photos",
            "News articles with accompanying images",
            "E-commerce product classification",
            "Content moderation for text-image pairs",
            "Multi-modal search and retrieval"
        ]
    }