"""
Distributed Processing API Endpoints
====================================

This module provides REST API endpoints for managing distributed processing
operations, including job submission, monitoring, cluster management, and
resource optimization.

Features:
- Job submission and management
- Cluster configuration and status
- Real-time monitoring and metrics
- Resource scaling and optimization
- Error handling and retry management
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta
import os
from pathlib import Path as PathLib

from app.services.distributed_processor import (
    get_distributed_manager,
    DistributedProcessingManager,
    ProcessingJob,
    create_processing_job,
    is_large_file_suitable_for_distributed_processing,
    distributed_processing_context
)
from app.core.distributed_config import (
    get_distributed_config,
    get_cluster_config,
    get_performance_config,
    get_monitoring_config,
    is_distributed_enabled
)
from app.core.security_utils import get_current_user
from app.core.error_handler import handle_api_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/distributed", tags=["distributed-processing"])


# Pydantic Models
class JobSubmissionRequest(BaseModel):
    """Request model for job submission"""
    file_path: str = Field(..., description="Path to the input file")
    job_type: str = Field(default="comprehensive_analysis", description="Type of processing job")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Job parameters")
    priority: int = Field(default=5, ge=1, le=10, description="Job priority (1-10, higher is more priority)")
    dependencies: List[str] = Field(default_factory=list, description="List of job IDs this job depends on")
    output_path: Optional[str] = Field(None, description="Custom output path")
    callback_url: Optional[str] = Field(None, description="URL to call when job completes")
    tags: List[str] = Field(default_factory=list, description="Tags for job categorization")
    timeout: Optional[int] = Field(None, ge=60, le=7200, description="Job timeout in seconds")

    @validator('file_path')
    def validate_file_path(cls, v):
        if not os.path.exists(v):
            raise ValueError(f"File not found: {v}")
        return v

    @validator('job_type')
    def validate_job_type(cls, v):
        allowed_types = [
            'comprehensive_analysis', 'data_cleaning', 'data_analysis',
            'aggregation', 'feature_engineering', 'model_training'
        ]
        if v not in allowed_types:
            raise ValueError(f"Invalid job type. Allowed: {allowed_types}")
        return v


class JobResponse(BaseModel):
    """Response model for job operations"""
    job_id: str
    status: str
    message: str
    submitted_at: datetime


class JobStatusResponse(BaseModel):
    """Response model for job status"""
    job_id: str
    status: str
    priority: Optional[int] = None
    progress: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    dependencies: List[str] = Field(default_factory=list)
    dependencies_satisfied: Optional[bool] = None


class ClusterConfigRequest(BaseModel):
    """Request model for cluster configuration"""
    cluster_type: str = Field(..., description="Cluster type: 'dask' or 'spark'")
    num_workers: int = Field(..., ge=1, le=50, description="Number of workers")
    worker_memory: str = Field(..., description="Memory per worker (e.g., '4GB')")
    worker_cores: int = Field(..., ge=1, le=16, description="CPU cores per worker")
    auto_scale: bool = Field(default=True, description="Enable auto-scaling")


class ClusterStatusResponse(BaseModel):
    """Response model for cluster status"""
    cluster_type: str
    status: str
    workers: int
    total_cores: int
    total_memory: str
    active_jobs: int
    queued_jobs: int
    resource_utilization: Dict[str, float]


class SystemMetricsResponse(BaseModel):
    """Response model for system metrics"""
    timestamp: datetime
    queue_stats: Dict[str, Any]
    resource_metrics: Dict[str, Any]
    cluster_info: Dict[str, Any]
    active_jobs: int
    system_status: str


# Dependency to get distributed manager
async def get_manager() -> DistributedProcessingManager:
    """Get distributed processing manager"""
    if not is_distributed_enabled():
        raise HTTPException(
            status_code=503,
            detail="Distributed processing is not enabled"
        )

    try:
        return get_distributed_manager()
    except Exception as e:
        logger.error(f"Failed to get distributed manager: {e}")
        raise HTTPException(
            status_code=503,
            detail="Distributed processing service unavailable"
        )


@router.get("/status", response_model=Dict[str, Any])
async def get_service_status():
    """Get distributed processing service status"""
    try:
        config = get_distributed_config()
        enabled = is_distributed_enabled()

        status = {
            "service_status": "enabled" if enabled else "disabled",
            "cluster_type": config.cluster_type.value,
            "max_workers": config.resources.max_workers,
            "max_concurrent_jobs": config.max_concurrent_jobs,
            "auto_scaling_enabled": config.scaling.strategy.value != "manual"
        }

        if enabled:
            try:
                manager = get_distributed_manager()
                cluster_info = manager.get_cluster_info()
                status.update({
                    "cluster_initialized": True,
                    "cluster_info": cluster_info
                })
            except Exception as e:
                status.update({
                    "cluster_initialized": False,
                    "error": str(e)
                })

        return status

    except Exception as e:
        logger.error(f"Error getting service status: {e}")
        return handle_api_error(e)


@router.post("/jobs", response_model=JobResponse)
async def submit_job(
    request: JobSubmissionRequest,
    background_tasks: BackgroundTasks,
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """Submit a new distributed processing job"""
    try:
        # Check if file is suitable for distributed processing
        if not is_large_file_suitable_for_distributed_processing(request.file_path):
            logger.warning(f"File {request.file_path} may not benefit from distributed processing")

        # Create processing job
        job = create_processing_job(
            file_path=request.file_path,
            job_type=request.job_type,
            parameters=request.parameters,
            priority=request.priority,
            dependencies=request.dependencies,
            user_id=current_user.get('user_id')
        )

        # Set custom output path if provided
        if request.output_path:
            job.output_path = request.output_path

        # Set callback URL if provided
        if request.callback_url:
            job.callback_url = request.callback_url

        # Set tags
        job.tags = request.tags

        # Set timeout
        if request.timeout:
            job.timeout = request.timeout

        # Submit job
        job_id = manager.submit_job(job)

        logger.info(f"Job {job_id} submitted by user {current_user.get('user_id')}")

        return JobResponse(
            job_id=job_id,
            status="submitted",
            message="Job submitted successfully",
            submitted_at=datetime.now()
        )

    except Exception as e:
        logger.error(f"Error submitting job: {e}")
        return handle_api_error(e)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str = Path(..., description="Job ID"),
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """Get status of a specific job"""
    try:
        status = manager.get_job_status(job_id)

        if status.get('status') == 'not_found':
            raise HTTPException(status_code=404, detail="Job not found")

        # Convert timestamps to datetime objects
        start_time = None
        end_time = None

        if status.get('start_time'):
            start_time = datetime.fromtimestamp(status['start_time'])

        if status.get('end_time'):
            end_time = datetime.fromtimestamp(status['end_time'])

        return JobStatusResponse(
            job_id=job_id,
            status=status['status'],
            priority=status.get('priority'),
            start_time=start_time,
            end_time=end_time,
            duration=status.get('duration'),
            result=status.get('result'),
            error=status.get('error'),
            dependencies=status.get('dependencies', []),
            dependencies_satisfied=status.get('dependencies_satisfied')
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status for {job_id}: {e}")
        return handle_api_error(e)


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str = Path(..., description="Job ID"),
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """Cancel a queued or running job"""
    try:
        success = manager.cancel_job(job_id)

        if not success:
            raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")

        logger.info(f"Job {job_id} cancelled by user {current_user.get('user_id')}")

        return {"message": f"Job {job_id} cancelled successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling job {job_id}: {e}")
        return handle_api_error(e)


@router.get("/jobs", response_model=List[JobStatusResponse])
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by job status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of jobs to return"),
    offset: int = Query(0, ge=0, description="Number of jobs to skip"),
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """List jobs with optional filtering"""
    try:
        # Get all job IDs (this is a simplified implementation)
        # In a production system, this would be more sophisticated
        all_jobs = []

        # Add active jobs
        for job_id in manager.active_jobs.keys():
            job_status = manager.get_job_status(job_id)
            if not status or job_status.get('status') == status:
                all_jobs.append(job_status)

        # Add completed jobs
        for job_id in manager.completed_jobs.keys():
            job_status = manager.get_job_status(job_id)
            if not status or job_status.get('status') == status:
                all_jobs.append(job_status)

        # Apply pagination
        paginated_jobs = all_jobs[offset:offset + limit]

        # Convert to response models
        response_jobs = []
        for job_status in paginated_jobs:
            start_time = None
            end_time = None

            if job_status.get('start_time'):
                start_time = datetime.fromtimestamp(job_status['start_time'])

            if job_status.get('end_time'):
                end_time = datetime.fromtimestamp(job_status['end_time'])

            response_jobs.append(JobStatusResponse(
                job_id=job_status['job_id'],
                status=job_status['status'],
                priority=job_status.get('priority'),
                start_time=start_time,
                end_time=end_time,
                duration=job_status.get('duration'),
                result=job_status.get('result'),
                error=job_status.get('error'),
                dependencies=job_status.get('dependencies', [])
            ))

        return response_jobs

    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        return handle_api_error(e)


@router.get("/cluster/status", response_model=ClusterStatusResponse)
async def get_cluster_status(
    manager: DistributedProcessingManager = Depends(get_manager)
):
    """Get cluster status and resource information"""
    try:
        cluster_info = manager.get_cluster_info()
        queue_stats = manager.job_queue.get_queue_stats()
        resource_metrics = manager.resource_monitor.get_current_metrics()

        return ClusterStatusResponse(
            cluster_type=cluster_info.get('cluster_type', 'unknown'),
            status="running" if manager._running else "stopped",
            workers=cluster_info.get('workers', 0),
            total_cores=cluster_info.get('total_cores', 0),
            total_memory=cluster_info.get('total_memory', '0GB'),
            active_jobs=len(manager.active_jobs),
            queued_jobs=queue_stats.get('queued_jobs', 0),
            resource_utilization={
                'cpu_percent': resource_metrics.get('cpu_percent', 0),
                'memory_percent': resource_metrics.get('memory_percent', 0),
                'disk_percent': resource_metrics.get('disk_percent', 0)
            }
        )

    except Exception as e:
        logger.error(f"Error getting cluster status: {e}")
        return handle_api_error(e)


@router.get("/metrics", response_model=SystemMetricsResponse)
async def get_system_metrics(
    manager: DistributedProcessingManager = Depends(get_manager)
):
    """Get comprehensive system metrics"""
    try:
        metrics = manager.get_system_metrics()

        return SystemMetricsResponse(
            timestamp=datetime.now(),
            queue_stats=metrics['queue_stats'],
            resource_metrics=metrics['resource_metrics'],
            cluster_info=metrics['cluster_info'],
            active_jobs=metrics['active_jobs'],
            system_status=metrics['system_status']
        )

    except Exception as e:
        logger.error(f"Error getting system metrics: {e}")
        return handle_api_error(e)


@router.get("/metrics/history")
async def get_metrics_history(
    hours: int = Query(1, ge=1, le=24, description="Number of hours of history"),
    manager: DistributedProcessingManager = Depends(get_manager)
):
    """Get historical metrics data"""
    try:
        history = manager.resource_monitor.get_metrics_history(hours)

        return {
            "period_hours": hours,
            "data_points": len(history),
            "metrics": history
        }

    except Exception as e:
        logger.error(f"Error getting metrics history: {e}")
        return handle_api_error(e)


@router.post("/cluster/scale")
async def scale_cluster(
    num_workers: int = Query(..., ge=1, le=50, description="Target number of workers"),
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """Scale cluster to specified number of workers"""
    try:
        # This is a placeholder for cluster scaling functionality
        # Actual implementation would depend on the cluster type and deployment

        config = get_distributed_config()

        if num_workers > config.resources.max_workers:
            raise HTTPException(
                status_code=400,
                detail=f"Requested workers ({num_workers}) exceeds maximum ({config.resources.max_workers})"
            )

        # Log the scaling request
        logger.info(f"Cluster scaling requested to {num_workers} workers by user {current_user.get('user_id')}")

        return {
            "message": f"Cluster scaling to {num_workers} workers initiated",
            "current_workers": manager.get_cluster_info().get('workers', 0),
            "target_workers": num_workers
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scaling cluster: {e}")
        return handle_api_error(e)


@router.post("/cluster/restart")
async def restart_cluster(
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """Restart the distributed processing cluster"""
    try:
        logger.info(f"Cluster restart requested by user {current_user.get('user_id')}")

        # Shutdown current cluster
        await manager.shutdown()

        # Reinitialize
        success = manager.initialize()

        if success:
            return {"message": "Cluster restarted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to restart cluster")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restarting cluster: {e}")
        return handle_api_error(e)


@router.get("/config")
async def get_current_config():
    """Get current distributed processing configuration"""
    try:
        distributed_config = get_distributed_config()
        cluster_config = get_cluster_config()
        performance_config = get_performance_config()
        monitoring_config = get_monitoring_config()

        return {
            "distributed_config": {
                "cluster_type": distributed_config.cluster_type.value,
                "enable_distributed_processing": distributed_config.enable_distributed_processing,
                "max_concurrent_jobs": distributed_config.max_concurrent_jobs,
                "job_timeout_seconds": distributed_config.job_timeout_seconds,
                "job_retry_attempts": distributed_config.job_retry_attempts
            },
            "cluster_config": cluster_config,
            "performance_config": performance_config,
            "monitoring_config": monitoring_config
        }

    except Exception as e:
        logger.error(f"Error getting configuration: {e}")
        return handle_api_error(e)


@router.post("/ai-analysis")
async def submit_ai_analysis_job(
    file_path: str = Query(..., description="Path to file for AI analysis"),
    analysis_type: str = Query(default="comprehensive", description="Type of AI analysis"),
    priority: int = Query(default=5, ge=1, le=10, description="Job priority"),
    options: Dict[str, Any] = None,
    manager: DistributedProcessingManager = Depends(get_manager),
    current_user: Dict = Depends(get_current_user)
):
    """Submit an AI analysis job for distributed processing"""
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Check file size
        file_size_gb = PathLib(file_path).stat().st_size / (1024**3)
        if file_size_gb < 0.1:  # Less than 100MB
            return JSONResponse(
                status_code=200,
                content={
                    "message": "File is small and may not benefit from distributed processing",
                    "recommendation": "Consider using standard AI processing endpoints",
                    "file_size_gb": file_size_gb
                }
            )

        # Submit job
        job_id = manager.submit_ai_processing_job(
            file_path=file_path,
            job_type=f"ai_{analysis_type}",
            options=options or {},
            priority=priority,
            user_id=current_user.get('user_id')
        )

        logger.info(f"AI analysis job {job_id} submitted for file {file_path}")

        return {
            "job_id": job_id,
            "status": "submitted",
            "message": "AI analysis job submitted for distributed processing",
            "file_size_gb": file_size_gb,
            "estimated_processing_time": f"{file_size_gb * 2:.1f} minutes"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting AI analysis job: {e}")
        return handle_api_error(e)


# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check for distributed processing service"""
    try:
        enabled = is_distributed_enabled()

        if not enabled:
            return {"status": "disabled", "message": "Distributed processing is disabled"}

        manager = get_distributed_manager()
        cluster_info = manager.get_cluster_info()

        return {
            "status": "healthy",
            "cluster_type": cluster_info.get('cluster_type'),
            "workers": cluster_info.get('workers', 0),
            "active_jobs": len(manager.active_jobs),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


logger.info("Distributed processing API endpoints initialized")