"""
Distributed Processing API Endpoints
===================================

FastAPI endpoints for distributed data processing, training data management,
foundation model preparation, and quality monitoring.

These endpoints provide the "Messy data → ML-ready in API calls" functionality.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, File, UploadFile, Form
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, List, Any, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import logging
from pathlib import Path

# Import services
from app.services.distributed_processor import distributed_processor, ProcessingFormat, ProcessingConfig
from app.services.training_data_manager import (
    training_data_manager, SplitStrategy, SplitConfig, DatasetType, DatasetMetadata
)
from app.services.foundation_model_prep import (
    foundation_model_prep, TokenizationConfig, DeduplicationConfig, TokenizationStrategy, SequencePackingStrategy
)
from app.services.realtime_quality_monitor import (
    realtime_quality_monitor, QualityConfig, QualityCheckType, ReportFormat
)

# Import authentication
from app.auth.dependencies import get_current_user, get_current_active_user
from app.database.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/distributed-processing", tags=["distributed-processing"])

# ===== Request/Response Models =====

class ProcessLargeDatasetRequest(BaseModel):
    """Request model for processing large datasets"""
    input_path: str = Field(..., description="Path to input dataset file")
    output_path: str = Field(..., description="Path for processed output")
    format: ProcessingFormat = Field(..., description="Input file format")
    processing_function: Optional[str] = Field(None, description="Custom processing function name")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class CreateDatasetRequest(BaseModel):
    """Request model for creating a new dataset"""
    name: str = Field(..., description="Dataset name")
    description: str = Field(..., description="Dataset description")
    dataset_type: DatasetType = Field(..., description="Type of dataset")
    file_path: str = Field(..., description="Path to dataset file")
    tags: List[str] = Field(default_factory=list, description="Dataset tags")
    auto_version: bool = Field(True, description="Automatically create first version")

class CreateDatasetSplitRequest(BaseModel):
    """Request model for creating dataset splits"""
    dataset_version_id: str = Field(..., description="Dataset version ID")
    split_strategy: SplitStrategy = Field(..., description="Splitting strategy")
    train_ratio: float = Field(0.7, ge=0.1, le=0.9, description="Training set ratio")
    val_ratio: float = Field(0.15, ge=0.05, le=0.4, description="Validation set ratio")
    test_ratio: float = Field(0.15, ge=0.05, le=0.4, description="Test set ratio")
    target_column: Optional[str] = Field(None, description="Target column for stratified splitting")
    time_column: Optional[str] = Field(None, description="Time column for temporal splitting")
    random_seed: int = Field(42, description="Random seed for reproducibility")
    output_dir: Optional[str] = Field(None, description="Output directory for split files")

class PrepareFoundationModelRequest(BaseModel):
    """Request model for foundation model preparation"""
    input_path: str = Field(..., description="Path to input text dataset")
    output_path: str = Field(..., description="Path for prepared dataset")
    model_name_or_path: str = Field("gpt2", description="Tokenizer model name or path")
    max_sequence_length: int = Field(2048, ge=128, le=8192, description="Maximum sequence length")
    text_column: str = Field("text", description="Name of text column")
    tokenization_strategy: TokenizationStrategy = Field(TokenizationStrategy.AUTOREGRESSIVE)
    packing_strategy: SequencePackingStrategy = Field(SequencePackingStrategy.SIMPLE)
    enable_deduplication: bool = Field(True, description="Enable text deduplication")
    similarity_threshold: float = Field(0.9, ge=0.5, le=1.0, description="Similarity threshold for dedup")
    batch_size: int = Field(1000, ge=100, le=10000, description="Processing batch size")

class MonitorQualityRequest(BaseModel):
    """Request model for quality monitoring"""
    dataset_path: str = Field(..., description="Path to dataset file")
    dataset_id: Optional[str] = Field(None, description="Dataset ID for database linking")
    target_column: Optional[str] = Field(None, description="Target column for class analysis")
    reference_dataset_path: Optional[str] = Field(None, description="Reference dataset for drift analysis")
    checks_to_run: List[QualityCheckType] = Field(
        default=[QualityCheckType.MISSING_VALUES, QualityCheckType.CLASS_IMBALANCE],
        description="Quality checks to perform"
    )
    report_format: ReportFormat = Field(ReportFormat.JSON, description="Output report format")
    missing_threshold_warning: float = Field(10.0, description="Missing values warning threshold (%)")
    missing_threshold_critical: float = Field(30.0, description="Missing values critical threshold (%)")
    imbalance_ratio_threshold: float = Field(0.1, description="Class imbalance ratio threshold")

class JobStatusResponse(BaseModel):
    """Response model for job status"""
    job_id: str
    status: str
    progress_percentage: float
    current_operation: Optional[str] = None
    elapsed_time_seconds: Optional[float] = None
    estimated_completion: Optional[datetime] = None
    error_message: Optional[str] = None
    output_path: Optional[str] = None
    output_summary: Optional[Dict[str, Any]] = None

class DatasetResponse(BaseModel):
    """Response model for dataset operations"""
    dataset_id: str
    message: str
    created_at: datetime

class DatasetVersionResponse(BaseModel):
    """Response model for dataset version operations"""
    version_id: str
    dataset_id: str
    version: str
    message: str

class DatasetSplitResponse(BaseModel):
    """Response model for dataset split operations"""
    split_id: str
    dataset_version_id: str
    train_path: str
    val_path: str
    test_path: str
    train_rows: int
    val_rows: int
    test_rows: int
    train_quality: Optional[float] = None
    val_quality: Optional[float] = None
    test_quality: Optional[float] = None

# ===== Distributed Processing Endpoints =====

@router.post("/process-large-dataset", response_model=Dict[str, str])
async def process_large_dataset(
    request: ProcessLargeDatasetRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Process large datasets up to ~50GB with progress tracking.

    Supports CSV, JSONL, Parquet formats with automatic format detection,
    memory-efficient processing, and real-time progress updates.
    """
    try:
        # Validate input file exists
        if not Path(request.input_path).exists():
            raise HTTPException(status_code=404, detail=f"Input file not found: {request.input_path}")

        # Start processing
        job_id = await distributed_processor.process_large_dataset(
            input_path=request.input_path,
            output_path=request.output_path,
            format=request.format,
            processing_function=None,  # TODO: Support custom functions
            metadata=request.metadata
        )

        return {
            "job_id": job_id,
            "message": "Processing started successfully",
            "status_endpoint": f"/distributed-processing/status/{job_id}"
        }

    except Exception as e:
        logger.error(f"Failed to start large dataset processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_processing_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get status of a distributed processing job."""
    try:
        status = await distributed_processor.get_job_status(job_id)

        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])

        return JobStatusResponse(**status)

    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cancel/{job_id}")
async def cancel_processing_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a running distributed processing job."""
    try:
        success = await distributed_processor.cancel_job(job_id)

        if not success:
            raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")

        return {"message": "Job cancelled successfully"}

    except Exception as e:
        logger.error(f"Failed to cancel job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system-metrics")
async def get_system_metrics(
    current_user: User = Depends(get_current_active_user)
):
    """Get current system performance metrics."""
    try:
        metrics = distributed_processor.get_system_metrics()
        return metrics

    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Training Data Management Endpoints =====

@router.post("/datasets", response_model=DatasetResponse)
async def create_dataset(
    request: CreateDatasetRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new dataset with versioning and metadata tracking."""
    try:
        # Create dataset metadata
        metadata = DatasetMetadata(
            name=request.name,
            description=request.description,
            dataset_type=request.dataset_type,
            file_path=request.file_path,
            total_rows=0,  # Will be calculated during analysis
            total_columns=0,
            size_bytes=0,
            schema_info={},
            tags=request.tags
        )

        dataset_id = await training_data_manager.create_dataset(
            metadata=metadata,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            auto_version=request.auto_version
        )

        return DatasetResponse(
            dataset_id=dataset_id,
            message="Dataset created successfully",
            created_at=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Failed to create dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/datasets/{dataset_id}/versions", response_model=DatasetVersionResponse)
async def create_dataset_version(
    dataset_id: str,
    file_path: str = Form(...),
    version: str = Form(...),
    description: str = Form(...),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new version of an existing dataset."""
    try:
        version_id = await training_data_manager.create_dataset_version(
            dataset_id=uuid.UUID(dataset_id),
            file_path=file_path,
            version=version,
            description=description,
            user_id=current_user.id
        )

        return DatasetVersionResponse(
            version_id=version_id,
            dataset_id=dataset_id,
            version=version,
            message="Dataset version created successfully"
        )

    except Exception as e:
        logger.error(f"Failed to create dataset version: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/datasets/{dataset_id}/versions")
async def get_dataset_versions(
    dataset_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    """Get all versions of a dataset."""
    try:
        versions = await training_data_manager.get_dataset_versions(
            dataset_id=uuid.UUID(dataset_id),
            limit=limit
        )

        return {"dataset_id": dataset_id, "versions": versions}

    except Exception as e:
        logger.error(f"Failed to get dataset versions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/datasets/splits", response_model=DatasetSplitResponse)
async def create_dataset_split(
    request: CreateDatasetSplitRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Create train/validation/test splits for a dataset version."""
    try:
        # Validate split ratios
        total_ratio = request.train_ratio + request.val_ratio + request.test_ratio
        if abs(total_ratio - 1.0) > 0.001:
            raise HTTPException(
                status_code=400,
                detail=f"Split ratios must sum to 1.0, got {total_ratio}"
            )

        # Create split configuration
        split_config = SplitConfig(
            strategy=request.split_strategy,
            train_ratio=request.train_ratio,
            val_ratio=request.val_ratio,
            test_ratio=request.test_ratio,
            target_column=request.target_column,
            time_column=request.time_column,
            random_seed=request.random_seed
        )

        # Create dataset split
        dataset_split = await training_data_manager.create_dataset_split(
            dataset_version_id=uuid.UUID(request.dataset_version_id),
            split_config=split_config,
            output_dir=request.output_dir,
            user_id=current_user.id
        )

        return DatasetSplitResponse(
            split_id=dataset_split.split_id,
            dataset_version_id=dataset_split.dataset_version_id,
            train_path=dataset_split.train_path,
            val_path=dataset_split.val_path,
            test_path=dataset_split.test_path,
            train_rows=dataset_split.train_rows,
            val_rows=dataset_split.val_rows,
            test_rows=dataset_split.test_rows,
            train_quality=dataset_split.train_quality,
            val_quality=dataset_split.val_quality,
            test_quality=dataset_split.test_quality
        )

    except Exception as e:
        logger.error(f"Failed to create dataset split: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/datasets/{dataset_id}/provenance")
async def get_dataset_provenance(
    dataset_id: str,
    include_transformations: bool = True,
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive provenance information for a dataset."""
    try:
        provenance = await training_data_manager.get_dataset_provenance(
            dataset_id=uuid.UUID(dataset_id),
            include_transformations=include_transformations
        )

        return provenance

    except Exception as e:
        logger.error(f"Failed to get dataset provenance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Foundation Model Preparation Endpoints =====

@router.post("/foundation-model/prepare", response_model=Dict[str, str])
async def prepare_foundation_model_dataset(
    request: PrepareFoundationModelRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Prepare text dataset for foundation model training with tokenization and deduplication."""
    try:
        # Create tokenization config
        tokenization_config = TokenizationConfig(
            model_name_or_path=request.model_name_or_path,
            max_sequence_length=request.max_sequence_length,
            batch_size=request.batch_size,
            packing_strategy=request.packing_strategy
        )

        # Create deduplication config if enabled
        dedup_config = None
        if request.enable_deduplication:
            dedup_config = DeduplicationConfig(
                similarity_threshold=request.similarity_threshold
            )

        # Start preparation
        job_id = await foundation_model_prep.prepare_dataset_for_pretraining(
            input_path=request.input_path,
            output_path=request.output_path,
            tokenization_config=tokenization_config,
            dedup_config=dedup_config,
            text_column=request.text_column
        )

        return {
            "job_id": job_id,
            "message": "Foundation model preparation started successfully",
            "status_endpoint": f"/distributed-processing/foundation-model/status/{job_id}"
        }

    except Exception as e:
        logger.error(f"Failed to start foundation model preparation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/foundation-model/status/{job_id}", response_model=JobStatusResponse)
async def get_foundation_model_prep_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get status of foundation model preparation job."""
    try:
        status = await foundation_model_prep.get_prep_job_status(job_id)

        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])

        return JobStatusResponse(**status)

    except Exception as e:
        logger.error(f"Failed to get foundation model prep status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Quality Monitoring Endpoints =====

@router.post("/quality/monitor", response_model=Dict[str, str])
async def monitor_training_data_quality(
    request: MonitorQualityRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Monitor training data quality with comprehensive analysis and reporting."""
    try:
        # Create quality config
        quality_config = QualityConfig(
            checks_to_run=request.checks_to_run,
            target_column=request.target_column,
            reference_dataset_path=request.reference_dataset_path,
            report_format=request.report_format,
            missing_threshold_warning=request.missing_threshold_warning,
            missing_threshold_critical=request.missing_threshold_critical,
            imbalance_ratio_threshold=request.imbalance_ratio_threshold
        )

        # Start quality monitoring
        job_id = await realtime_quality_monitor.monitor_training_data_quality(
            dataset_path=request.dataset_path,
            config=quality_config,
            dataset_id=uuid.UUID(request.dataset_id) if request.dataset_id else None
        )

        return {
            "job_id": job_id,
            "message": "Quality monitoring started successfully",
            "status_endpoint": f"/distributed-processing/quality/status/{job_id}"
        }

    except Exception as e:
        logger.error(f"Failed to start quality monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quality/status/{job_id}", response_model=JobStatusResponse)
async def get_quality_monitoring_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get status of quality monitoring job."""
    try:
        status = await realtime_quality_monitor.get_quality_job_status(job_id)

        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])

        return JobStatusResponse(**status)

    except Exception as e:
        logger.error(f"Failed to get quality monitoring status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quality/report/{report_id}")
async def get_quality_report(
    report_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get quality monitoring report."""
    try:
        report = await realtime_quality_monitor.get_quality_report(report_id)

        if report is None:
            raise HTTPException(status_code=404, detail="Quality report not found")

        return report

    except Exception as e:
        logger.error(f"Failed to get quality report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quality/report/{report_id}/download")
async def download_quality_report(
    report_id: str,
    format: str = "json",  # json or pdf
    current_user: User = Depends(get_current_active_user)
):
    """Download quality monitoring report file."""
    try:
        reports_dir = Path("data/quality_reports")

        if format.lower() == "pdf":
            file_path = reports_dir / f"{report_id}_quality_report.pdf"
            media_type = "application/pdf"
        else:
            file_path = reports_dir / f"{report_id}_quality_report.json"
            media_type = "application/json"

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Report file not found: {format}")

        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=file_path.name
        )

    except Exception as e:
        logger.error(f"Failed to download quality report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Utility Endpoints =====

@router.get("/formats/supported")
async def get_supported_formats():
    """Get list of supported file formats for processing."""
    return {
        "processing_formats": [format.value for format in ProcessingFormat],
        "dataset_types": [dtype.value for dtype in DatasetType],
        "split_strategies": [strategy.value for strategy in SplitStrategy],
        "tokenization_strategies": [strategy.value for strategy in TokenizationStrategy],
        "quality_check_types": [check.value for check in QualityCheckType]
    }

@router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    destination_dir: str = Form("data/uploads"),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a file for processing."""
    try:
        # Create destination directory
        dest_path = Path(destination_dir)
        dest_path.mkdir(parents=True, exist_ok=True)

        # Save uploaded file
        file_path = dest_path / file.filename

        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        file_size_mb = len(content) / (1024 * 1024)

        return {
            "filename": file.filename,
            "file_path": str(file_path),
            "size_mb": round(file_size_mb, 2),
            "message": "File uploaded successfully"
        }

    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail=str(e))