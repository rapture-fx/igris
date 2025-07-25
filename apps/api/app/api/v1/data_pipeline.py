"""
Data Processing Pipeline API
===========================

This module provides the core data processing pipeline for Schlep-engine.
It handles the complete user flow: Upload → Process → Results → Insights
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import uuid4
import json
import logging
import os

from app.database.connection import get_db
from app.database.models import User, DataInvestigation, ProcessingJob, JobStatus, DataSourceType
from app.auth.dependencies import get_current_user
from app.services.file_processor import file_upload_service
from app.services.unified_data_processor import unified_processor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data", tags=["Data Processing"])

# ==================== REQUEST/RESPONSE MODELS ====================

class ProcessingRequest(BaseModel):
    investigation_id: str = Field(..., description="Investigation ID")
    processing_options: Dict[str, Any] = Field(default={}, description="Processing configuration")

class InvestigationResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    progress_percentage: float
    quality_score: Optional[float]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProcessingResult(BaseModel):
    investigation_id: str
    status: str
    progress_percentage: float
    quality_score: Optional[float]
    insights: Dict[str, Any]
    recommendations: List[str]
    anomalies: List[Dict[str, Any]]

class UploadResponse(BaseModel):
    investigation_id: str
    filename: str
    file_size: int
    status: str
    message: str

class PipelineStats(BaseModel):
    active: int
    completed: int
    failed: int

# ==================== CORE PIPELINE ENDPOINTS ====================

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="Data file to upload"),
    name: Optional[str] = Form(None, description="Investigation name"),
    description: Optional[str] = Form(None, description="Investigation description"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a data file and create a new investigation
    
    This is the first step in the data processing pipeline.
    """
    try:
        # Save file
        file_info = await file_upload_service.save_file(file)
        
        # Determine data source type
        data_source_type = file_upload_service._get_file_type(file.filename)
        
        # Create investigation
        investigation = DataInvestigation(
            name=name or f"Analysis of {file.filename}",
            description=description or f"Automated analysis of uploaded file: {file.filename}",
            workspace_id=None,  # Will be set when workspaces are implemented
            created_by_id=current_user.id,
            data_source_type=data_source_type,
            data_source_config={
                "filename": file.filename,
                "file_size": file_info["size"],
                "file_path": file_info["path"]
            },
            original_file_path=file_info["path"],
            status=JobStatus.PENDING,
            progress_percentage=0.0
        )
        
        db.add(investigation)
        await db.commit()
        await db.refresh(investigation)
        
        # Schedule background processing
        background_tasks.add_task(
            process_data_async,
            str(investigation.id),
            file_info["path"]
        )
        
        return UploadResponse(
            investigation_id=str(investigation.id),
            filename=file.filename,
            file_size=file_info["size"],
            status="uploaded",
            message="File uploaded successfully. Processing started in background."
        )
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@router.get("/pipelines/stats", response_model=PipelineStats)
async def get_pipeline_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get statistics about processing pipelines."""
    try:
        from sqlalchemy import select, func

        result = await db.execute(
            select(
                ProcessingJob.status,
                func.count(ProcessingJob.id)
            )
            .join(DataInvestigation, ProcessingJob.investigation_id == DataInvestigation.id)
            .where(DataInvestigation.created_by_id == current_user.id)
            .group_by(ProcessingJob.status)
        )
        
        stats = result.all()
        
        pipeline_stats = {
            "active": 0,
            "completed": 0,
            "failed": 0
        }
        
        for status, count in stats:
            if status in [JobStatus.PENDING, JobStatus.PROCESSING]:
                pipeline_stats["active"] += count
            elif status == JobStatus.COMPLETED:
                pipeline_stats["completed"] = count
            elif status == JobStatus.FAILED:
                pipeline_stats["failed"] = count
                
        return PipelineStats(**pipeline_stats)

    except Exception as e:
        logger.error(f"Failed to get pipeline stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pipeline statistics"
        )

@router.get("/investigations", response_model=List[InvestigationResponse])
async def list_investigations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all investigations for the current user
    """
    try:
        from sqlalchemy import select
        
        result = await db.execute(
            select(DataInvestigation)
            .where(DataInvestigation.created_by_id == current_user.id)
            .order_by(DataInvestigation.created_at.desc())
        )
        investigations = result.scalars().all()
        
        return [
            InvestigationResponse(
                id=str(inv.id),
                name=inv.name,
                description=inv.description,
                status=inv.status.value,
                progress_percentage=inv.progress_percentage,
                quality_score=inv.quality_score,
                created_at=inv.created_at,
                updated_at=inv.updated_at
            )
            for inv in investigations
        ]
        
    except Exception as e:
        logger.error(f"Failed to list investigations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve investigations"
        )

@router.get("/investigations/{investigation_id}", response_model=ProcessingResult)
async def get_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed investigation results
    """
    try:
        from sqlalchemy import select
        
        # Get investigation
        result = await db.execute(
            select(DataInvestigation)
            .where(DataInvestigation.id == investigation_id)
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        investigation = result.scalar_one_or_none()
        
        if not investigation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        # Build response
        return ProcessingResult(
            investigation_id=str(investigation.id),
            status=investigation.status.value,
            progress_percentage=investigation.progress_percentage,
            quality_score=investigation.quality_score,
            insights={
                "patterns": investigation.patterns_found or [],
                "schema": investigation.schema_info or {},
                "statistics": {
                    "total_records": investigation.data_source_config.get("total_records", 0),
                    "columns": investigation.data_source_config.get("columns", 0)
                }
            },
            recommendations=investigation.recommendations or [],
            anomalies=investigation.anomalies_detected or []
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get investigation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve investigation details"
        )

@router.post("/investigations/{investigation_id}/reprocess", response_model=ProcessingResult)
async def reprocess_investigation(
    investigation_id: str,
    processing_options: Dict[str, Any] = {},
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reprocess an investigation with new options
    """
    try:
        from sqlalchemy import select
        
        # Get investigation
        result = await db.execute(
            select(DataInvestigation)
            .where(DataInvestigation.id == investigation_id)
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        investigation = result.scalar_one_or_none()
        
        if not investigation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        # Reset investigation status
        investigation.status = JobStatus.PENDING
        investigation.progress_percentage = 0.0
        investigation.analysis_config = processing_options
        await db.commit()
        
        # Schedule reprocessing
        background_tasks.add_task(
            process_data_async,
            investigation_id,
            investigation.original_file_path
        )
        
        return ProcessingResult(
            investigation_id=investigation_id,
            status="pending",
            progress_percentage=0.0,
            quality_score=None,
            insights={},
            recommendations=[],
            anomalies=[]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reprocess investigation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart processing"
        )

@router.delete("/investigations/{investigation_id}")
async def delete_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an investigation and its associated files
    """
    try:
        from sqlalchemy import select
        
        # Get investigation
        result = await db.execute(
            select(DataInvestigation)
            .where(DataInvestigation.id == investigation_id)
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        investigation = result.scalar_one_or_none()
        
        if not investigation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        # Delete associated files
        if investigation.original_file_path and os.path.exists(investigation.original_file_path):
            os.remove(investigation.original_file_path)
        
        if investigation.processed_file_path and os.path.exists(investigation.processed_file_path):
            os.remove(investigation.processed_file_path)
        
        # Delete from database
        await db.delete(investigation)
        await db.commit()
        
        return {"message": "Investigation deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete investigation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete investigation"
        )



# ==================== QUICK INSIGHTS ENDPOINT ====================

@router.get("/quick-insights/{investigation_id}")
async def get_quick_insights(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get quick insights for an investigation (for real-time dashboard updates)
    """
    try:
        from sqlalchemy import select
        
        result = await db.execute(
            select(DataInvestigation)
            .where(DataInvestigation.id == investigation_id)
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        investigation = result.scalar_one_or_none()
        
        if not investigation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        return {
            "status": investigation.status.value,
            "progress": investigation.progress_percentage,
            "quality_score": investigation.quality_score,
            "total_records": investigation.data_source_config.get("total_records", 0),
            "issues_found": len(investigation.anomalies_detected or []),
            "patterns_found": len(investigation.patterns_found or []),
            "last_updated": investigation.updated_at.isoformat() if investigation.updated_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get quick insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve insights"
        ) 