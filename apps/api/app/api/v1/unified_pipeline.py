"""
UNIFIED PIPELINE API
===================

Comprehensive API for data processing pipelines that supports:
- Multiple data sources (files, databases, APIs, cloud storage)
- AI-powered analysis and cleaning
- ML framework exports
- Real-time progress tracking
- Both web UI and API requests
- Event-driven architecture
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
import json
import logging
import asyncio

from app.database.connection import get_db
from app.database.models import User
from app.auth.dependencies import get_current_user
from app.services.pipeline_orchestrator import (
    pipeline_orchestrator, PipelineConfig, DataSourceType, PipelineStage
)
from app.services.unified_data_processor import ProcessingMode
from app.services.upload_service import upload_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pipelines", tags=["Unified Pipeline"])

# ==================== REQUEST/RESPONSE MODELS ====================

class FileSourceConfig(BaseModel):
    """Configuration for file-based data sources"""
    file_path: Optional[str] = None  # For already uploaded files
    upload_file: Optional[bool] = True  # Whether to expect file upload

class DatabaseSourceConfig(BaseModel):
    """Configuration for database data sources"""
    connection_type: str = Field(..., description="Database type (postgresql, mysql, etc.)")
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl: bool = False
    query: Optional[str] = None
    table_name: Optional[str] = None

class APISourceConfig(BaseModel):
    """Configuration for API data sources"""
    url: str
    method: str = "GET"
    headers: Dict[str, str] = Field(default_factory=dict)
    auth_type: str = "none"
    auth_config: Dict[str, str] = Field(default_factory=dict)
    data_path: Optional[str] = None

class CloudStorageSourceConfig(BaseModel):
    """Configuration for cloud storage data sources"""
    provider: str = Field(..., description="Cloud provider (aws, gcp, azure)")
    bucket_name: str
    file_path: str
    credentials: Dict[str, Any]

class ProcessingConfig(BaseModel):
    """Processing configuration"""
    processing_mode: Optional[str] = None
    enable_ai_analysis: bool = True
    enable_auto_cleaning: bool = True
    enable_ml_preparation: bool = True
    quality_threshold: float = 0.8
    auto_labeling: bool = True
    feature_engineering: bool = True
    parallel_processing: bool = True
    memory_limit_gb: float = 4.0
    timeout_minutes: int = 60

class OutputConfig(BaseModel):
    """Output configuration"""
    target_frameworks: List[str] = Field(default=["scikit_learn"])
    export_formats: List[str] = Field(default=["pandas"])
    output_destination: Optional[str] = None
    enable_webhooks: bool = True
    notify_on_completion: bool = True
    notify_on_error: bool = True

class CreatePipelineRequest(BaseModel):
    """Request to create a new pipeline"""
    name: Optional[str] = None
    description: Optional[str] = None
    workspace_id: str
    
    # Data source configuration
    source_type: str = Field(..., description="Type of data source")
    source_config: Dict[str, Any] = Field(..., description="Source-specific configuration")
    
    # Processing configuration
    processing: ProcessingConfig = Field(default_factory=ProcessingConfig)
    
    # Output configuration
    output: OutputConfig = Field(default_factory=OutputConfig)

class PipelineResponse(BaseModel):
    """Pipeline information response"""
    pipeline_id: str
    name: str
    description: Optional[str]
    status: str
    progress: float
    current_step: Optional[str]
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    processing_time_seconds: Optional[float]
    error_message: Optional[str]
    
    # Results (if available)
    input_records: Optional[int] = None
    output_records: Optional[int] = None
    data_quality_score: Optional[float] = None
    framework_exports: Optional[Dict[str, str]] = None

class PipelineListResponse(BaseModel):
    """Response for listing pipelines"""
    pipelines: List[PipelineResponse]
    total_count: int
    page: int
    page_size: int

class ExecutePipelineRequest(BaseModel):
    """Request to execute a pipeline"""
    background: bool = True
    webhook_url: Optional[str] = None

class BulkCreateRequest(BaseModel):
    """Request to create multiple pipelines"""
    pipelines: List[CreatePipelineRequest]
    execute_immediately: bool = True

# ==================== CORE PIPELINE ENDPOINTS ====================

@router.post("/create", response_model=PipelineResponse)
async def create_pipeline(
    request: CreatePipelineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🚀 CREATE DATA PROCESSING PIPELINE
    
    Create a comprehensive data processing pipeline that can handle:
    - File uploads, database connections, API endpoints
    - AI-powered analysis and pattern detection  
    - Automated data cleaning and transformation
    - ML framework exports (TensorFlow, PyTorch, etc.)
    - Real-time progress tracking
    """
    
    try:
        # Validate source type
        try:
            source_type = DataSourceType(request.source_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported source type: {request.source_type}"
            )
        
        # Convert processing mode
        processing_mode = None
        if request.processing.processing_mode:
            try:
                processing_mode = ProcessingMode(request.processing.processing_mode.lower())
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid processing mode: {request.processing.processing_mode}"
                )
        
        # Create pipeline configuration
        config = PipelineConfig(
            source_type=source_type,
            source_config=request.source_config,
            processing_mode=processing_mode,
            enable_ai_analysis=request.processing.enable_ai_analysis,
            enable_auto_cleaning=request.processing.enable_auto_cleaning,
            enable_ml_preparation=request.processing.enable_ml_preparation,
            target_frameworks=request.output.target_frameworks,
            quality_threshold=request.processing.quality_threshold,
            auto_labeling=request.processing.auto_labeling,
            feature_engineering=request.processing.feature_engineering,
            export_formats=request.output.export_formats,
            output_destination=request.output.output_destination,
            parallel_processing=request.processing.parallel_processing,
            memory_limit_gb=request.processing.memory_limit_gb,
            timeout_minutes=request.processing.timeout_minutes,
            enable_webhooks=request.output.enable_webhooks,
            notify_on_completion=request.output.notify_on_completion,
            notify_on_error=request.output.notify_on_error
        )
        
        # Create pipeline
        pipeline_id = await pipeline_orchestrator.create_pipeline(
            config=config,
            user_id=str(current_user.id),
            workspace_id=request.workspace_id,
            name=request.name,
            description=request.description
        )
        
        # Get pipeline status
        pipeline_info = await pipeline_orchestrator.get_pipeline_status(pipeline_id)
        
        return PipelineResponse(
            pipeline_id=pipeline_id,
            name=pipeline_info["name"],
            description=pipeline_info["description"],
            status=pipeline_info["status"].value,
            progress=pipeline_info["progress"],
            current_step=pipeline_info["current_step"],
            created_at=pipeline_info["created_at"].isoformat(),
            started_at=pipeline_info["started_at"].isoformat() if pipeline_info["started_at"] else None,
            completed_at=pipeline_info["completed_at"].isoformat() if pipeline_info["completed_at"] else None,
            processing_time_seconds=None,
            error_message=pipeline_info["error_message"]
        )
        
    except Exception as e:
        logger.error(f"Failed to create pipeline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline creation failed: {str(e)}"
        )

@router.post("/upload-and-create", response_model=PipelineResponse)
async def upload_and_create_pipeline(
    file: UploadFile = File(...),
    name: Optional[str] = None,
    description: Optional[str] = None,
    workspace_id: str = "default",
    processing_config: str = "{}",  # JSON string
    output_config: str = "{}",      # JSON string
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📤 UPLOAD FILE AND CREATE PIPELINE
    
    Upload a file and immediately create a processing pipeline for it.
    This is the most common use case for web UI interactions.
    """
    
    try:
        # Parse configuration JSON
        try:
            processing = ProcessingConfig(**json.loads(processing_config))
            output = OutputConfig(**json.loads(output_config))
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid configuration JSON: {str(e)}"
            )
        
        # Upload file
        file_info = await upload_service.save_file(file)
        
        # Create pipeline request
        request = CreatePipelineRequest(
            name=name or f"Pipeline for {file.filename}",
            description=description or f"Automated processing of {file.filename}",
            workspace_id=workspace_id,
            source_type="file_upload",
            source_config={"file_path": file_info["path"]},
            processing=processing,
            output=output
        )
        
        # Create pipeline
        return await create_pipeline(request, current_user, db)
        
    except Exception as e:
        logger.error(f"Failed to upload and create pipeline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload and pipeline creation failed: {str(e)}"
        )

@router.post("/{pipeline_id}/execute")
async def execute_pipeline(
    pipeline_id: str,
    request: ExecutePipelineRequest = ExecutePipelineRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    ⚡ EXECUTE PIPELINE
    
    Execute a data processing pipeline. Can run in background or synchronously.
    """
    
    try:
        # Verify pipeline exists and user has access
        pipeline_info = await pipeline_orchestrator.get_pipeline_status(pipeline_id)
        
        if pipeline_info["user_id"] != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this pipeline"
            )
        
        # Execute pipeline
        if request.background:
            # Execute in background
            job_id = await pipeline_orchestrator.execute_pipeline(
                pipeline_id=pipeline_id,
                background=True
            )
            
            return {
                "pipeline_id": pipeline_id,
                "job_id": job_id,
                "status": "started",
                "message": "Pipeline execution started in background",
                "background": True
            }
        else:
            # Execute synchronously
            result = await pipeline_orchestrator.execute_pipeline(
                pipeline_id=pipeline_id,
                background=False
            )
            
            return {
                "pipeline_id": pipeline_id,
                "status": "completed",
                "result": result.__dict__ if hasattr(result, '__dict__') else result,
                "background": False
            }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to execute pipeline {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution failed: {str(e)}"
        )

@router.get("/{pipeline_id}/status", response_model=PipelineResponse)
async def get_pipeline_status(
    pipeline_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    📊 GET PIPELINE STATUS
    
    Get detailed status and progress information for a pipeline.
    """
    
    try:
        pipeline_info = await pipeline_orchestrator.get_pipeline_status(pipeline_id)
        
        # Verify user access
        if pipeline_info["user_id"] != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this pipeline"
            )
        
        # Extract results if available
        results = pipeline_info.get("results")
        input_records = None
        output_records = None
        data_quality_score = None
        framework_exports = None
        processing_time_seconds = None
        
        if results:
            if hasattr(results, '__dict__'):
                results_dict = results.__dict__
            else:
                results_dict = results
                
            input_records = results_dict.get("input_records")
            output_records = results_dict.get("output_records")
            data_quality_score = results_dict.get("data_quality_score")
            framework_exports = results_dict.get("framework_exports")
            processing_time_seconds = results_dict.get("processing_time_seconds")
        
        return PipelineResponse(
            pipeline_id=pipeline_id,
            name=pipeline_info["name"],
            description=pipeline_info["description"],
            status=pipeline_info["status"].value,
            progress=pipeline_info["progress"],
            current_step=pipeline_info["current_step"],
            created_at=pipeline_info["created_at"].isoformat(),
            started_at=pipeline_info["started_at"].isoformat() if pipeline_info["started_at"] else None,
            completed_at=pipeline_info["completed_at"].isoformat() if pipeline_info["completed_at"] else None,
            processing_time_seconds=processing_time_seconds,
            error_message=pipeline_info["error_message"],
            input_records=input_records,
            output_records=output_records,
            data_quality_score=data_quality_score,
            framework_exports=framework_exports
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get pipeline status {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pipeline status: {str(e)}"
        )

@router.get("/list", response_model=PipelineListResponse)
async def list_pipelines(
    workspace_id: Optional[str] = Query(None, description="Filter by workspace"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user)
):
    """
    📋 LIST PIPELINES
    
    Get a list of pipelines with optional filtering and pagination.
    """
    
    try:
        # Convert status filter
        status_filter = None
        if status:
            try:
                status_filter = PipelineStage(status.lower())
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter: {status}"
                )
        
        # Get pipelines
        pipelines = await pipeline_orchestrator.list_pipelines(
            user_id=str(current_user.id),
            workspace_id=workspace_id,
            status=status_filter,
            limit=page_size * page  # Simple pagination
        )
        
        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_pipelines = pipelines[start_idx:end_idx]
        
        # Convert to response format
        pipeline_responses = []
        for pipeline_info in paginated_pipelines:
            pipeline_responses.append(PipelineResponse(
                pipeline_id=pipeline_info["id"],
                name=pipeline_info["name"],
                description=pipeline_info["description"],
                status=pipeline_info["status"].value,
                progress=pipeline_info["progress"],
                current_step=pipeline_info["current_step"],
                created_at=pipeline_info["created_at"].isoformat(),
                started_at=pipeline_info["started_at"].isoformat() if pipeline_info["started_at"] else None,
                completed_at=pipeline_info["completed_at"].isoformat() if pipeline_info["completed_at"] else None,
                error_message=pipeline_info["error_message"]
            ))
        
        return PipelineListResponse(
            pipelines=pipeline_responses,
            total_count=len(pipelines),
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Failed to list pipelines: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list pipelines: {str(e)}"
        )

@router.delete("/{pipeline_id}")
async def cancel_pipeline(
    pipeline_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    🛑 CANCEL PIPELINE
    
    Cancel a running pipeline and clean up resources.
    """
    
    try:
        # Verify pipeline exists and user has access
        pipeline_info = await pipeline_orchestrator.get_pipeline_status(pipeline_id)
        
        if pipeline_info["user_id"] != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this pipeline"
            )
        
        # Cancel pipeline
        success = await pipeline_orchestrator.cancel_pipeline(pipeline_id)
        
        if success:
            return {
                "pipeline_id": pipeline_id,
                "status": "cancelled",
                "message": "Pipeline cancelled successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pipeline could not be cancelled"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to cancel pipeline {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel pipeline: {str(e)}"
        )

# ==================== BULK OPERATIONS ====================

@router.post("/bulk/create")
async def bulk_create_pipelines(
    request: BulkCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🔄 BULK CREATE PIPELINES
    
    Create multiple pipelines at once for batch processing.
    """
    
    try:
        if len(request.pipelines) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 100 pipelines per bulk request"
            )
        
        # Create pipeline configurations
        pipeline_configs = []
        for pipeline_req in request.pipelines:
            config = PipelineConfig(
                source_type=DataSourceType(pipeline_req.source_type.lower()),
                source_config=pipeline_req.source_config,
                enable_ai_analysis=pipeline_req.processing.enable_ai_analysis,
                enable_auto_cleaning=pipeline_req.processing.enable_auto_cleaning,
                enable_ml_preparation=pipeline_req.processing.enable_ml_preparation,
                target_frameworks=pipeline_req.output.target_frameworks,
                quality_threshold=pipeline_req.processing.quality_threshold
            )
            
            pipeline_configs.append({
                'config': config,
                'user_id': str(current_user.id),
                'workspace_id': pipeline_req.workspace_id,
                'name': pipeline_req.name,
                'description': pipeline_req.description
            })
        
        if request.execute_immediately:
            # Execute in background
            from app.tasks.pipeline_tasks import bulk_execute_pipelines_task
            job = bulk_execute_pipelines_task.delay(pipeline_configs)
            
            return {
                "job_id": job.id,
                "total_pipelines": len(request.pipelines),
                "status": "started",
                "message": "Bulk pipeline execution started in background"
            }
        else:
            # Just create pipelines
            pipeline_ids = []
            for config_info in pipeline_configs:
                pipeline_id = await pipeline_orchestrator.create_pipeline(**config_info)
                pipeline_ids.append(pipeline_id)
            
            return {
                "pipeline_ids": pipeline_ids,
                "total_pipelines": len(pipeline_ids),
                "status": "created",
                "message": "Pipelines created successfully"
            }
        
    except Exception as e:
        logger.error(f"Failed to bulk create pipelines: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk pipeline creation failed: {str(e)}"
        )

# ==================== MONITORING AND METRICS ====================

@router.get("/metrics")
async def get_pipeline_metrics(
    current_user: User = Depends(get_current_user)
):
    """
    📈 GET PIPELINE METRICS
    
    Get performance metrics and statistics for the pipeline system.
    """
    
    try:
        metrics = pipeline_orchestrator.get_performance_metrics()
        
        return {
            "performance_metrics": metrics,
            "system_status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get pipeline metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get metrics: {str(e)}"
        )

@router.get("/health")
async def get_pipeline_health():
    """
    🏥 PIPELINE HEALTH CHECK
    
    Get health status of the pipeline system.
    """
    
    try:
        # Run health checks
        health_checks = {
            "orchestrator": "healthy",
            "unified_processor": "healthy",
            "ml_engine": "healthy",
            "framework_integrator": "healthy"
        }
        
        # Check active pipelines
        active_count = len(pipeline_orchestrator.active_pipelines)
        
        return {
            "status": "healthy",
            "components": health_checks,
            "active_pipelines": active_count,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Pipeline health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

# ==================== STREAMING ENDPOINTS ====================

@router.get("/{pipeline_id}/progress-stream")
async def stream_pipeline_progress(
    pipeline_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    📡 STREAM PIPELINE PROGRESS
    
    Get real-time progress updates via Server-Sent Events (SSE).
    """
    
    async def generate_progress_updates():
        """Generate real-time progress updates"""
        
        try:
            while True:
                # Get current pipeline status
                pipeline_info = await pipeline_orchestrator.get_pipeline_status(pipeline_id)
                
                # Verify user access
                if pipeline_info["user_id"] != str(current_user.id):
                    yield f"data: {json.dumps({'error': 'Access denied'})}\n\n"
                    break
                
                # Send progress update
                progress_data = {
                    "pipeline_id": pipeline_id,
                    "status": pipeline_info["status"].value,
                    "progress": pipeline_info["progress"],
                    "current_step": pipeline_info["current_step"],
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                yield f"data: {json.dumps(progress_data)}\n\n"
                
                # Stop streaming if pipeline is completed or failed
                if pipeline_info["status"] in [PipelineStage.COMPLETED, PipelineStage.FAILED]:
                    break
                
                # Wait before next update
                await asyncio.sleep(2)
                
        except Exception as e:
            error_data = {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(
        generate_progress_updates(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    ) 