"""
ML Data Preparation API
=====================

API endpoints for data infrastructure data preparation workflows focused on ML readiness.
This API orchestrates the complete pipeline from raw data to framework-ready outputs.

Key Features:
- Automated data preparation pipelines
- Quality-driven preprocessing workflows
- Framework-specific exports (TensorFlow, PyTorch, etc.)
- Real-time progress tracking
- Role-based access control
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import uuid4
import tempfile
import os
import asyncio
import logging

from app.database.connection import get_db
from app.database.models import User, Workspace
from app.database.ml_preparation_models import (
    DataPreparationPipeline, PreparationStage, DataQualityLevel, MLFrameworkType
)
from app.auth.dependencies import get_current_user
from app.services.upload_service import upload_service
from app.services.ml_preparation_engine import (
    ml_preparation_engine, PreparationConfig, PreparationResult
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml-preparation", tags=["ML Data Preparation"])

# ==================== REQUEST/RESPONSE MODELS ====================

class CreatePipelineRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    workspace_id: str
    target_frameworks: List[str] = Field(..., description="Target ML frameworks (tensorflow, pytorch, sklearn, etc.)")
    quality_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    enable_auto_labeling: bool = True
    enable_feature_engineering: bool = True
    train_test_split_ratio: float = Field(default=0.8, ge=0.1, le=0.9)
    validation_split_ratio: float = Field(default=0.1, ge=0.0, le=0.5)
    remove_duplicates: bool = True
    handle_missing_values: bool = True
    normalize_data: bool = True
    detect_outliers: bool = True
    confidence_threshold: float = Field(default=0.9, ge=0.0, le=1.0)


class PipelineResponse(BaseModel):
    pipeline_id: str
    name: str
    description: Optional[str]
    current_stage: str
    progress_percentage: float
    quality_score: Optional[float]
    quality_level: Optional[str]
    is_ml_ready: bool
    target_frameworks: List[str]
    total_records: Optional[int]
    total_columns: Optional[int]
    processing_time_seconds: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]


class ExecutePipelineRequest(BaseModel):
    pipeline_id: str
    run_async: bool = True


class PipelineExecutionResult(BaseModel):
    execution_id: str
    pipeline_id: str
    status: str
    progress_percentage: float
    estimated_completion_time: Optional[datetime]
    quality_score: Optional[float]
    frameworks_exported: List[str]
    output_paths: Dict[str, str]
    issues_resolved: List[str]
    recommendations: List[str]


class FrameworkExportRequest(BaseModel):
    pipeline_id: str
    framework_type: str
    export_config: Dict[str, Any] = Field(default_factory=dict)


class QualityAssessmentResponse(BaseModel):
    pipeline_id: str
    assessment_stage: str
    overall_quality_score: float
    quality_level: str
    completeness_score: Optional[float]
    validity_score: Optional[float]
    consistency_score: Optional[float]
    accuracy_score: Optional[float]
    issues_detected: List[str]
    recommendations: List[str]
    column_profiles: Dict[str, Any]


# ==================== PIPELINE MANAGEMENT ENDPOINTS ====================

@router.post("/pipelines", response_model=PipelineResponse)
async def create_preparation_pipeline(
    file: UploadFile = File(...),
    config: CreatePipelineRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🚀 CREATE ML DATA PREPARATION PIPELINE
    
    Upload a dataset and create an automated ML preparation pipeline.
    This will analyze your data and prepare it for ML frameworks.
    """
    
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file size (max 1GB for upload)
        max_size = 1024 * 1024 * 1024  # 1GB
        if file.size and file.size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File too large. Maximum size is 1GB."
            )
        
        # Validate workspace access
        workspace = await db.get(Workspace, config.workspace_id)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # Upload file
        upload_result = await upload_service.upload_file(
            file, 
            user_id=str(current_user.id),
            workspace_id=config.workspace_id
        )
        
        # Create preparation configuration
        prep_config = PreparationConfig(
            target_frameworks=config.target_frameworks,
            quality_threshold=config.quality_threshold,
            enable_auto_labeling=config.enable_auto_labeling,
            enable_feature_engineering=config.enable_feature_engineering,
            train_test_split_ratio=config.train_test_split_ratio,
            validation_split_ratio=config.validation_split_ratio,
            remove_duplicates=config.remove_duplicates,
            handle_missing_values=config.handle_missing_values,
            normalize_data=config.normalize_data,
            detect_outliers=config.detect_outliers,
            confidence_threshold=config.confidence_threshold
        )
        
        # Create pipeline
        pipeline = await ml_preparation_engine.create_preparation_pipeline(
            source_data_path=upload_result["file_path"],
            config=prep_config,
            workspace_id=config.workspace_id,
            user_id=str(current_user.id),
            name=config.name or f"ML Prep - {file.filename}"
        )
        
        return PipelineResponse(
            pipeline_id=str(pipeline.id),
            name=pipeline.name,
            description=pipeline.description,
            current_stage=pipeline.current_stage.value,
            progress_percentage=pipeline.progress_percentage,
            quality_score=pipeline.quality_score,
            quality_level=pipeline.quality_level.value if pipeline.quality_level else None,
            is_ml_ready=pipeline.is_ml_ready,
            target_frameworks=pipeline.target_frameworks,
            total_records=pipeline.total_records,
            total_columns=pipeline.total_columns,
            processing_time_seconds=pipeline.processing_time_seconds,
            created_at=pipeline.created_at,
            completed_at=pipeline.completed_at
        )
        
    except Exception as e:
        logger.error(f"Failed to create preparation pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pipeline: {str(e)}"
        )


@router.post("/pipelines/{pipeline_id}/execute", response_model=PipelineExecutionResult)
async def execute_preparation_pipeline(
    pipeline_id: str,
    background_tasks: BackgroundTasks,
    run_async: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    ⚡ EXECUTE ML PREPARATION PIPELINE
    
    Execute the complete data preparation workflow from raw data to ML-ready format.
    This includes profiling, cleaning, transformation, labeling, and framework export.
    """
    
    try:
        # Validate pipeline exists and user has access
        pipeline = await db.get(DataPreparationPipeline, pipeline_id)
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        if pipeline.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this pipeline"
            )
        
        execution_id = str(uuid4())
        
        if run_async:
            # Execute pipeline in background
            background_tasks.add_task(
                execute_pipeline_async,
                pipeline_id,
                execution_id
            )
            
            return PipelineExecutionResult(
                execution_id=execution_id,
                pipeline_id=pipeline_id,
                status="started",
                progress_percentage=0.0,
                estimated_completion_time=None,
                quality_score=None,
                frameworks_exported=[],
                output_paths={},
                issues_resolved=[],
                recommendations=[]
            )
        else:
            # Execute pipeline synchronously
            result = await ml_preparation_engine.execute_preparation_pipeline(pipeline_id)
            
            return PipelineExecutionResult(
                execution_id=execution_id,
                pipeline_id=pipeline_id,
                status="completed",
                progress_percentage=100.0,
                estimated_completion_time=None,
                quality_score=result.quality_score,
                frameworks_exported=result.frameworks_exported,
                output_paths=result.output_paths,
                issues_resolved=result.issues_resolved,
                recommendations=result.recommendations
            )
            
    except Exception as e:
        logger.error(f"Failed to execute pipeline {pipeline_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute pipeline: {str(e)}"
        )


@router.get("/pipelines", response_model=List[PipelineResponse])
async def list_preparation_pipelines(
    workspace_id: Optional[str] = None,
    stage: Optional[str] = None,
    quality_level: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📋 LIST ML PREPARATION PIPELINES
    
    Get a list of data preparation pipelines with optional filtering.
    """
    
    try:
        from sqlalchemy import select, and_, or_
        
        # Build query
        query = select(DataPreparationPipeline).where(
            DataPreparationPipeline.created_by_id == current_user.id
        )
        
        # Apply filters
        if workspace_id:
            query = query.where(DataPreparationPipeline.workspace_id == workspace_id)
        
        if stage:
            query = query.where(DataPreparationPipeline.current_stage == stage)
        
        if quality_level:
            query = query.where(DataPreparationPipeline.quality_level == quality_level)
        
        # Apply pagination
        query = query.offset(offset).limit(limit).order_by(DataPreparationPipeline.created_at.desc())
        
        # Execute query
        result = await db.execute(query)
        pipelines = result.scalars().all()
        
        # Convert to response models
        return [
            PipelineResponse(
                pipeline_id=str(pipeline.id),
                name=pipeline.name,
                description=pipeline.description,
                current_stage=pipeline.current_stage.value,
                progress_percentage=pipeline.progress_percentage,
                quality_score=pipeline.quality_score,
                quality_level=pipeline.quality_level.value if pipeline.quality_level else None,
                is_ml_ready=pipeline.is_ml_ready,
                target_frameworks=pipeline.target_frameworks,
                total_records=pipeline.total_records,
                total_columns=pipeline.total_columns,
                processing_time_seconds=pipeline.processing_time_seconds,
                created_at=pipeline.created_at,
                completed_at=pipeline.completed_at
            )
            for pipeline in pipelines
        ]
        
    except Exception as e:
        logger.error(f"Failed to list pipelines: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pipelines"
        )


@router.get("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def get_preparation_pipeline(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🔍 GET ML PREPARATION PIPELINE DETAILS
    
    Get detailed information about a specific preparation pipeline.
    """
    
    try:
        pipeline = await db.get(DataPreparationPipeline, pipeline_id)
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        if pipeline.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this pipeline"
            )
        
        return PipelineResponse(
            pipeline_id=str(pipeline.id),
            name=pipeline.name,
            description=pipeline.description,
            current_stage=pipeline.current_stage.value,
            progress_percentage=pipeline.progress_percentage,
            quality_score=pipeline.quality_score,
            quality_level=pipeline.quality_level.value if pipeline.quality_level else None,
            is_ml_ready=pipeline.is_ml_ready,
            target_frameworks=pipeline.target_frameworks,
            total_records=pipeline.total_records,
            total_columns=pipeline.total_columns,
            processing_time_seconds=pipeline.processing_time_seconds,
            created_at=pipeline.created_at,
            completed_at=pipeline.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get pipeline {pipeline_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pipeline"
        )


# ==================== QUALITY ASSESSMENT ENDPOINTS ====================

@router.get("/pipelines/{pipeline_id}/quality", response_model=List[QualityAssessmentResponse])
async def get_quality_assessments(
    pipeline_id: str,
    stage: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📊 GET QUALITY ASSESSMENTS
    
    Get quality assessment results for each stage of the preparation pipeline.
    """
    
    try:
        from sqlalchemy import select
        
        # Verify pipeline access
        pipeline = await db.get(DataPreparationPipeline, pipeline_id)
        if not pipeline or pipeline.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        # Build query
        from app.database.ml_preparation_models import DataQualityAssessment
        query = select(DataQualityAssessment).where(
            DataQualityAssessment.pipeline_id == pipeline_id
        )
        
        if stage:
            query = query.where(DataQualityAssessment.assessment_stage == stage)
        
        query = query.order_by(DataQualityAssessment.assessment_timestamp.desc())
        
        # Execute query
        result = await db.execute(query)
        assessments = result.scalars().all()
        
        return [
            QualityAssessmentResponse(
                pipeline_id=str(assessment.pipeline_id),
                assessment_stage=assessment.assessment_stage.value,
                overall_quality_score=assessment.overall_quality_score,
                quality_level=assessment.quality_level.value,
                completeness_score=assessment.completeness_score,
                validity_score=assessment.validity_score,
                consistency_score=assessment.consistency_score,
                accuracy_score=assessment.accuracy_score,
                issues_detected=assessment.issues_detected or [],
                recommendations=assessment.recommendations or [],
                column_profiles=assessment.column_profiles or {}
            )
            for assessment in assessments
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get quality assessments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve quality assessments"
        )


# ==================== FRAMEWORK EXPORT ENDPOINTS ====================

@router.post("/pipelines/{pipeline_id}/export/{framework_type}")
async def export_to_framework(
    pipeline_id: str,
    framework_type: str,
    export_config: Dict[str, Any] = {},
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📤 EXPORT TO ML FRAMEWORK
    
    Export prepared data to a specific ML framework (TensorFlow, PyTorch, scikit-learn, etc.)
    """
    
    try:
        # Verify pipeline access
        pipeline = await db.get(DataPreparationPipeline, pipeline_id)
        if not pipeline or pipeline.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        if not pipeline.is_ml_ready:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pipeline is not ML-ready. Execute the pipeline first."
            )
        
        # Validate framework type
        try:
            framework_enum = MLFrameworkType(framework_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported framework: {framework_type}"
            )
        
        # Load data and export
        df = await ml_preparation_engine._load_data(pipeline.source_data_path)
        
        export_result = await ml_preparation_engine._export_to_framework(
            pipeline,
            df,
            framework_enum,
            export_config
        )
        
        return {
            "framework_type": framework_type,
            "export_status": "completed",
            "output_path": export_result.get("output_path"),
            "output_size_mb": export_result.get("size_mb"),
            "validation_passed": export_result.get("validation_passed"),
            "export_metadata": export_result.get("metadata", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export to {framework_type}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export to {framework_type}"
        )


@router.get("/frameworks", response_model=List[Dict[str, Any]])
async def list_supported_frameworks():
    """
    📚 LIST SUPPORTED ML FRAMEWORKS
    
    Get a list of all supported ML frameworks for export.
    """
    
    frameworks = [
        {
            "name": "TensorFlow",
            "key": "tensorflow",
            "description": "Google's open-source machine learning framework",
            "supported_formats": ["tf.data.Dataset", "SavedModel"],
            "use_cases": ["Deep Learning", "Production ML", "Large-scale Training"]
        },
        {
            "name": "PyTorch",
            "key": "pytorch", 
            "description": "Facebook's dynamic neural network framework",
            "supported_formats": ["DataLoader", "TensorDataset"],
            "use_cases": ["Research", "Deep Learning", "Computer Vision"]
        },
        {
            "name": "scikit-learn",
            "key": "scikit_learn",
            "description": "Machine learning library for Python",
            "supported_formats": ["numpy arrays", "pandas DataFrame"],
            "use_cases": ["Traditional ML", "Data Science", "Quick Prototyping"]
        },
        {
            "name": "Hugging Face",
            "key": "huggingface",
            "description": "Transformers and NLP model hub",
            "supported_formats": ["datasets.Dataset", "transformers compatible"],
            "use_cases": ["NLP", "Transformers", "Pre-trained Models"]
        },
        {
            "name": "XGBoost",
            "key": "xgboost",
            "description": "Gradient boosting framework",
            "supported_formats": ["DMatrix", "numpy arrays"],
            "use_cases": ["Tabular Data", "Competitions", "Structured Data"]
        },
        {
            "name": "LightGBM",
            "key": "lightgbm",
            "description": "Microsoft's gradient boosting framework",
            "supported_formats": ["Dataset", "numpy arrays"],
            "use_cases": ["Fast Training", "Large Datasets", "Feature Engineering"]
        }
    ]
    
    return frameworks


# ==================== BACKGROUND TASKS ====================

async def execute_pipeline_async(pipeline_id: str, execution_id: str):
    """
    Background task to execute ML preparation pipeline
    """
    try:
        logger.info(f"Starting async execution of pipeline {pipeline_id}")
        
        # Progress callback for real-time updates
        def progress_callback(progress: float, message: str):
            logger.info(f"Pipeline {pipeline_id}: {progress:.1f}% - {message}")
            # Here you could emit WebSocket events for real-time UI updates
        
        # Execute the pipeline
        result = await ml_preparation_engine.execute_preparation_pipeline(
            pipeline_id,
            progress_callback=progress_callback
        )
        
        logger.info(f"Pipeline {pipeline_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Pipeline {pipeline_id} failed: {str(e)}")
        # Update pipeline status to failed
        async with ml_preparation_engine.get_db_session() as db:
            pipeline = await db.get(DataPreparationPipeline, pipeline_id)
            if pipeline:
                pipeline.current_stage = PreparationStage.INGESTION  # Reset to initial stage
                pipeline.progress_percentage = 0.0
                await db.commit()


# ==================== UTILITY ENDPOINTS ====================

@router.get("/pipelines/{pipeline_id}/steps")
async def get_pipeline_steps(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📝 GET PIPELINE EXECUTION STEPS
    
    Get detailed information about each step in the pipeline execution.
    """
    
    try:
        from sqlalchemy import select
        
        # Verify pipeline access
        pipeline = await db.get(DataPreparationPipeline, pipeline_id)
        if not pipeline or pipeline.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        # Get preparation steps
        from app.database.ml_preparation_models import PreparationStep
        query = select(PreparationStep).where(
            PreparationStep.pipeline_id == pipeline_id
        ).order_by(PreparationStep.step_order)
        
        result = await db.execute(query)
        steps = result.scalars().all()
        
        return [
            {
                "step_id": str(step.id),
                "step_name": step.step_name,
                "step_type": step.step_type.value,
                "step_order": step.step_order,
                "status": step.status,
                "transformation_applied": step.transformation_applied,
                "records_processed": step.records_processed,
                "records_modified": step.records_modified,
                "execution_time_seconds": step.execution_time_seconds,
                "quality_improvement": step.quality_improvement,
                "issues_resolved": step.issues_resolved or [],
                "created_at": step.created_at,
                "completed_at": step.completed_at
            }
            for step in steps
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get pipeline steps: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pipeline steps"
        ) 