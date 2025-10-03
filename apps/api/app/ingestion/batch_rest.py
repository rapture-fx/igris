"""
Batch REST API endpoints for messy dataset ingestion
Supports multiple formats with automatic conversion to Arrow
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import tempfile
import os
from datetime import datetime

from app.core.logging_config import get_logger
from app.core.metrics import metrics_collector

logger = get_logger(__name__)

router = APIRouter()


class DataFormat(str, Enum):
    """Supported input data formats"""
    CSV = "csv"
    JSON = "json"
    PARQUET = "parquet"
    AVRO = "avro"
    EXCEL = "excel"
    AUTO = "auto"


class ProcessingMode(str, Enum):
    """Processing execution modes"""
    SYNC = "sync"
    ASYNC = "async"
    STREAM = "stream"


class BatchIngestionRequest(BaseModel):
    """Batch ingestion request schema"""
    dataset_name: str = Field(..., description="Name for the dataset")
    format: DataFormat = Field(DataFormat.AUTO, description="Input format (auto-detect if not specified)")
    processing_mode: ProcessingMode = Field(ProcessingMode.ASYNC, description="Processing mode")
    schema_inference: bool = Field(True, description="Auto-infer schema from data")
    apply_preprocessing: bool = Field(True, description="Apply Rust preprocessing kernels")
    deduplication: bool = Field(False, description="Enable deduplication")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Custom metadata")


class BatchIngestionResponse(BaseModel):
    """Batch ingestion response"""
    job_id: str
    dataset_name: str
    status: str
    format: str
    rows_ingested: Optional[int] = None
    memory_usage_mb: Optional[float] = None
    processing_time_ms: Optional[float] = None
    arrow_schema: Optional[Dict] = None
    message: str


@router.post("/batch/upload", response_model=BatchIngestionResponse)
async def upload_batch_dataset(
    file: UploadFile = File(..., description="Dataset file to upload"),
    dataset_name: Optional[str] = None,
    format: DataFormat = DataFormat.AUTO,
    processing_mode: ProcessingMode = ProcessingMode.ASYNC,
    apply_preprocessing: bool = True,
    deduplication: bool = False,
    background_tasks: BackgroundTasks = None
):
    """
    Upload and process a batch dataset

    Supports: CSV, JSON, Parquet, Avro, Excel
    Returns: Job ID for async processing or immediate results for sync
    """
    start_time = datetime.now()

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Generate dataset name if not provided
    if not dataset_name:
        dataset_name = f"dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Detect format from filename if auto
    if format == DataFormat.AUTO:
        ext = file.filename.split('.')[-1].lower()
        format = DataFormat(ext) if ext in [f.value for f in DataFormat] else DataFormat.CSV

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{format.value}") as tmp_file:
        tmp_path = tmp_file.name
        content = await file.read()
        tmp_file.write(content)
        file_size_mb = len(content) / (1024 * 1024)

    try:
        # Import Rust preprocessing bridge
        from app.hybrid_kernels.rust_bridge import process_dataset_with_rust

        # Process dataset based on mode
        if processing_mode == ProcessingMode.SYNC:
            # Synchronous processing
            result = await process_dataset_with_rust(
                file_path=tmp_path,
                format=format.value,
                dataset_name=dataset_name,
                apply_preprocessing=apply_preprocessing,
                deduplication=deduplication
            )

            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            # Record metrics
            metrics_collector.record_business_event(
                "batch_ingestion_sync",
                metadata={
                    "dataset_name": dataset_name,
                    "format": format.value,
                    "file_size_mb": file_size_mb,
                    "rows": result.get("rows_ingested", 0),
                    "processing_time_ms": processing_time
                }
            )

            return BatchIngestionResponse(
                job_id=result["job_id"],
                dataset_name=dataset_name,
                status="completed",
                format=format.value,
                rows_ingested=result.get("rows_ingested"),
                memory_usage_mb=result.get("memory_usage_mb"),
                processing_time_ms=processing_time,
                arrow_schema=result.get("arrow_schema"),
                message="Dataset processed successfully"
            )

        else:
            # Asynchronous processing
            job_id = f"job_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

            # Schedule background processing
            background_tasks.add_task(
                process_dataset_background,
                job_id=job_id,
                file_path=tmp_path,
                format=format.value,
                dataset_name=dataset_name,
                apply_preprocessing=apply_preprocessing,
                deduplication=deduplication
            )

            # Record metrics
            metrics_collector.record_business_event(
                "batch_ingestion_async_queued",
                metadata={
                    "job_id": job_id,
                    "dataset_name": dataset_name,
                    "format": format.value,
                    "file_size_mb": file_size_mb
                }
            )

            return BatchIngestionResponse(
                job_id=job_id,
                dataset_name=dataset_name,
                status="processing",
                format=format.value,
                message=f"Dataset queued for processing. Job ID: {job_id}"
            )

    except Exception as e:
        logger.error(f"Batch ingestion failed: {str(e)}")
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


async def process_dataset_background(
    job_id: str,
    file_path: str,
    format: str,
    dataset_name: str,
    apply_preprocessing: bool,
    deduplication: bool
):
    """Background task for async dataset processing"""
    try:
        from app.hybrid_kernels.rust_bridge import process_dataset_with_rust

        result = await process_dataset_with_rust(
            file_path=file_path,
            format=format,
            dataset_name=dataset_name,
            apply_preprocessing=apply_preprocessing,
            deduplication=deduplication,
            job_id=job_id
        )

        logger.info(f"Background processing completed for job {job_id}: {result}")

        # Record completion metrics
        metrics_collector.record_business_event(
            "batch_ingestion_async_completed",
            metadata={
                "job_id": job_id,
                "dataset_name": dataset_name,
                "rows": result.get("rows_ingested", 0)
            }
        )

    except Exception as e:
        logger.error(f"Background processing failed for job {job_id}: {str(e)}")
        metrics_collector.record_business_event(
            "batch_ingestion_async_failed",
            metadata={"job_id": job_id, "error": str(e)}
        )

    finally:
        # Clean up temp file
        if os.path.exists(file_path):
            os.remove(file_path)


@router.get("/batch/job/{job_id}", response_model=Dict[str, Any])
async def get_job_status(job_id: str):
    """Get status of a batch processing job"""
    # TODO: Implement job status tracking (Redis/PostgreSQL)
    return {
        "job_id": job_id,
        "status": "processing",
        "message": "Job status tracking to be implemented"
    }


@router.post("/batch/bulk-upload", response_model=List[BatchIngestionResponse])
async def bulk_upload_datasets(
    files: List[UploadFile] = File(...),
    processing_mode: ProcessingMode = ProcessingMode.ASYNC,
    background_tasks: BackgroundTasks = None
):
    """
    Bulk upload multiple datasets in a single request
    Optimal for batch migration scenarios
    """
    results = []

    for file in files:
        try:
            result = await upload_batch_dataset(
                file=file,
                dataset_name=None,
                format=DataFormat.AUTO,
                processing_mode=processing_mode,
                background_tasks=background_tasks
            )
            results.append(result)

        except Exception as e:
            logger.error(f"Failed to process file {file.filename}: {str(e)}")
            results.append(BatchIngestionResponse(
                job_id="",
                dataset_name=file.filename or "unknown",
                status="failed",
                format="unknown",
                message=f"Upload failed: {str(e)}"
            ))

    return results
