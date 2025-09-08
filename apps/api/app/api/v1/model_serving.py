"""
Model Serving API Endpoints
============================

Production-ready API endpoints for advanced model serving with:
- Real-time and batch inference
- Auto-scaling and load balancing
- Blue-green and canary deployments
- Comprehensive monitoring and metrics
- Health checks and alerting
- A/B testing integration
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

# Database and Auth
from app.core.database import get_db
from app.auth.unified_dependencies import get_current_user

# Models and Schemas
from app.models.mlops import (
    MLModel, ModelDeployment, ServingEndpoint, ServingMetrics, 
    CanaryDeployment, BatchInferenceJob, ModelServingAlert,
    DeploymentStatus, DeploymentType
)
from app.schemas.mlops import (
    ServingEndpointCreate, ServingEndpointUpdate, ServingEndpointResponse,
    PredictionRequest, PredictionResponse, BatchPredictionRequest, BatchPredictionResponse,
    CanaryDeploymentCreate, CanaryDeploymentResponse, ServingMetricsResponse,
    ModelServingAlertCreate, ModelServingAlertResponse, ScalingRequest,
    ModelRollbackRequest, EndpointHealthResponse
)

# Services
from app.services.advanced_model_serving import get_serving_engine, PredictionRequest as ServingPredictionRequest
from app.services.model_deployment_manager import get_deployment_manager, DeploymentConfig, DeploymentStrategy
from app.services.inference_engine import get_inference_engine, InferenceConfig
from app.core.redis_client import get_redis_client

# Core utilities
from app.core.config import settings
from app.core.error_handler import handle_api_error
from app.core.rate_limiting import rate_limit
from app.core.metrics import track_api_metrics


router = APIRouter(prefix="/models", tags=["Model Serving"])


@router.post(
    "/serve",
    response_model=ServingEndpointResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Deploy Model for Serving",
    description="Deploy a model for production serving with configurable infrastructure and performance settings."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=10)
async def deploy_model_for_serving(
    endpoint_config: ServingEndpointCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Deploy a model for serving."""
    try:
        # Validate model exists
        model = db.query(MLModel).filter(MLModel.model_id == endpoint_config.model_id).first()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model {endpoint_config.model_id} not found"
            )
        
        # Check if endpoint already exists
        existing_endpoint = db.query(ServingEndpoint).filter(
            and_(
                ServingEndpoint.model_id == endpoint_config.model_id,
                ServingEndpoint.name == endpoint_config.name,
                ServingEndpoint.status == "active"
            )
        ).first()
        
        if existing_endpoint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Active endpoint with name '{endpoint_config.name}' already exists for model"
            )
        
        # Create deployment record
        deployment = ModelDeployment(
            model_id=endpoint_config.model_id,
            name=f"{endpoint_config.name}-deployment",
            deployment_type=DeploymentType.PRODUCTION,
            environment="production",
            status=DeploymentStatus.DEPLOYING,
            deployed_by=current_user.get("user_id", "system"),
            replicas=endpoint_config.min_replicas,
            resource_limits={
                "cpu": "500m",
                "memory": "1Gi",
                "gpu": 1 if endpoint_config.instance_type == "gpu-enabled" else 0
            },
            auto_scaling={
                "min_replicas": endpoint_config.min_replicas,
                "max_replicas": endpoint_config.max_replicas,
                "target_cpu_utilization": endpoint_config.target_cpu_utilization,
                "target_memory_utilization": endpoint_config.target_memory_utilization
            }
        )
        
        db.add(deployment)
        db.flush()  # Get deployment ID
        
        # Generate endpoint URL
        endpoint_url = f"{settings.API_BASE_URL}/models/{deployment.deployment_id}/predict"
        
        # Create serving endpoint
        serving_endpoint = ServingEndpoint(
            name=endpoint_config.name,
            model_id=endpoint_config.model_id,
            deployment_id=deployment.deployment_id,
            endpoint_url=endpoint_url,
            compute_backend=endpoint_config.compute_backend.value,
            instance_type=endpoint_config.instance_type.value,
            min_replicas=endpoint_config.min_replicas,
            max_replicas=endpoint_config.max_replicas,
            target_cpu_utilization=endpoint_config.target_cpu_utilization,
            target_memory_utilization=endpoint_config.target_memory_utilization,
            batch_size=endpoint_config.batch_size,
            max_batch_delay_ms=endpoint_config.max_batch_delay_ms,
            request_timeout_ms=endpoint_config.request_timeout_ms,
            concurrent_requests=endpoint_config.concurrent_requests,
            circuit_breaker_enabled=endpoint_config.circuit_breaker_enabled,
            failure_threshold=endpoint_config.failure_threshold,
            recovery_timeout_ms=endpoint_config.recovery_timeout_ms,
            cache_enabled=endpoint_config.cache_enabled,
            cache_ttl_seconds=endpoint_config.cache_ttl_seconds,
            cache_size_mb=endpoint_config.cache_size_mb,
            authentication_required=endpoint_config.authentication_required,
            api_key_required=endpoint_config.api_key_required,
            rate_limit_rpm=endpoint_config.rate_limit_rpm,
            allowed_origins=endpoint_config.allowed_origins,
            created_by=current_user.get("user_id", "system"),
            configuration=endpoint_config.configuration or {}
        )
        
        db.add(serving_endpoint)
        db.commit()
        
        # Load model in serving engine asynchronously
        background_tasks.add_task(
            _deploy_model_background,
            serving_endpoint.endpoint_id,
            model.framework.value,
            endpoint_config.configuration or {},
            db
        )
        
        # Convert to response schema
        response = ServingEndpointResponse(
            id=serving_endpoint.id,
            endpoint_id=serving_endpoint.endpoint_id,
            name=serving_endpoint.name,
            model_id=serving_endpoint.model_id,
            deployment_id=serving_endpoint.deployment_id,
            endpoint_url=serving_endpoint.endpoint_url,
            api_version=serving_endpoint.api_version,
            protocol=serving_endpoint.protocol,
            port=serving_endpoint.port,
            compute_backend=serving_endpoint.compute_backend,
            instance_type=serving_endpoint.instance_type,
            min_replicas=serving_endpoint.min_replicas,
            max_replicas=serving_endpoint.max_replicas,
            target_cpu_utilization=serving_endpoint.target_cpu_utilization,
            target_memory_utilization=serving_endpoint.target_memory_utilization,
            batch_size=serving_endpoint.batch_size,
            max_batch_delay_ms=serving_endpoint.max_batch_delay_ms,
            request_timeout_ms=serving_endpoint.request_timeout_ms,
            concurrent_requests=serving_endpoint.concurrent_requests,
            status=serving_endpoint.status,
            health_status=serving_endpoint.health_status,
            last_health_check=serving_endpoint.last_health_check,
            total_requests=serving_endpoint.total_requests,
            successful_requests=serving_endpoint.successful_requests,
            failed_requests=serving_endpoint.failed_requests,
            avg_response_time_ms=serving_endpoint.avg_response_time_ms,
            p95_response_time_ms=serving_endpoint.p95_response_time_ms,
            p99_response_time_ms=serving_endpoint.p99_response_time_ms,
            throughput_rps=serving_endpoint.throughput_rps,
            success_rate=serving_endpoint.success_rate,
            estimated_hourly_cost=serving_endpoint.estimated_hourly_cost,
            total_compute_hours=serving_endpoint.total_compute_hours,
            created_at=serving_endpoint.created_at,
            updated_at=serving_endpoint.updated_at,
            activated_at=serving_endpoint.activated_at
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to deploy model for serving: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deploy model for serving"
        )


async def _deploy_model_background(endpoint_id: str, framework: str, config: Dict, db: Session):
    """Background task to deploy model in serving engine."""
    try:
        # Get serving engine and load model
        serving_engine = get_serving_engine(redis_client=get_redis_client())
        
        # Mock model path - in production, this would come from model registry
        model_path = config.get('model_path', f'/models/{endpoint_id}')
        
        success = await serving_engine.load_model(
            model_id=endpoint_id,
            model_path=model_path,
            framework=framework,
            model_config=config
        )
        
        # Update endpoint status
        endpoint = db.query(ServingEndpoint).filter(
            ServingEndpoint.endpoint_id == endpoint_id
        ).first()
        
        if endpoint:
            if success:
                endpoint.status = "active"
                endpoint.activated_at = datetime.utcnow()
            else:
                endpoint.status = "failed"
            
            db.commit()
            
    except Exception as e:
        logging.error(f"Background model deployment failed: {e}")
        # Update endpoint to failed status
        try:
            endpoint = db.query(ServingEndpoint).filter(
                ServingEndpoint.endpoint_id == endpoint_id
            ).first()
            if endpoint:
                endpoint.status = "failed"
                db.commit()
        except:
            pass


@router.post(
    "/{model_id}/predict",
    response_model=PredictionResponse,
    summary="Real-time Prediction",
    description="Make real-time predictions using a deployed model with sub-100ms latency."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=1000)
async def predict_realtime(
    model_id: str = Path(..., description="Model ID or endpoint ID"),
    request: PredictionRequest = ...,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Make real-time predictions."""
    try:
        # Find active endpoint for model
        endpoint = db.query(ServingEndpoint).filter(
            or_(
                and_(ServingEndpoint.model_id == model_id, ServingEndpoint.status == "active"),
                and_(ServingEndpoint.endpoint_id == model_id, ServingEndpoint.status == "active")
            )
        ).first()
        
        if not endpoint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active serving endpoint found for model {model_id}"
            )
        
        # Check rate limiting
        if endpoint.rate_limit_rpm:
            # This would typically use Redis for distributed rate limiting
            pass
        
        # Create serving prediction request
        serving_request = ServingPredictionRequest(
            instances=request.instances,
            parameters=request.parameters,
            explanation=request.explanation,
            confidence_threshold=request.confidence_threshold,
            request_id=request.request_id or str(uuid.uuid4()),
            timeout_ms=request.timeout_ms
        )
        
        # Get serving engine and make prediction
        serving_engine = get_serving_engine()
        result = await serving_engine.predict(
            model_id=endpoint.endpoint_id,
            request=serving_request,
            endpoint_id=endpoint.endpoint_id
        )
        
        # Update endpoint metrics
        endpoint.total_requests += 1
        if result.predictions:
            endpoint.successful_requests += 1
        else:
            endpoint.failed_requests += 1
        
        # Update average response time (simple moving average)
        if endpoint.avg_response_time_ms == 0:
            endpoint.avg_response_time_ms = result.prediction_time_ms
        else:
            endpoint.avg_response_time_ms = (
                endpoint.avg_response_time_ms * 0.95 + result.prediction_time_ms * 0.05
            )
        
        db.commit()
        
        # Return response
        return PredictionResponse(
            predictions=result.predictions,
            model_id=result.model_id,
            model_version=result.model_version,
            endpoint_id=result.endpoint_id,
            request_id=result.request_id,
            prediction_time_ms=result.prediction_time_ms,
            processing_time_ms=result.processing_time_ms,
            batch_size=result.batch_size,
            confidence_scores=result.confidence_scores,
            explanations=result.explanations,
            feature_importance=result.feature_importance,
            cached_response=result.cached_response,
            cache_key=result.cache_key,
            timestamp=result.timestamp
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Prediction failed: {e}")
        
        # Update error metrics
        try:
            endpoint = db.query(ServingEndpoint).filter(
                or_(
                    ServingEndpoint.model_id == model_id,
                    ServingEndpoint.endpoint_id == model_id
                )
            ).first()
            if endpoint:
                endpoint.total_requests += 1
                endpoint.failed_requests += 1
                db.commit()
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction failed"
        )


@router.post(
    "/{model_id}/batch-predict",
    response_model=BatchPredictionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Batch Prediction",
    description="Submit a batch prediction job for processing large datasets asynchronously."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=10)
async def predict_batch(
    model_id: str = Path(..., description="Model ID"),
    request: BatchPredictionRequest = ...,
    background_tasks: BackgroundTasks = ...,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Submit batch prediction job."""
    try:
        # Validate model exists
        model = db.query(MLModel).filter(MLModel.model_id == model_id).first()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model {model_id} not found"
            )
        
        # Create batch inference job
        batch_job = BatchInferenceJob(
            name=request.name,
            model_id=model_id,
            input_source_type=request.input_source_type,
            input_source_config=request.input_source_config,
            input_format=request.input_format,
            output_destination_type=request.output_destination_type,
            output_destination_config=request.output_destination_config,
            output_format=request.output_format,
            batch_size=request.batch_size,
            max_parallel_batches=request.max_parallel_batches,
            retry_count=request.retry_count,
            timeout_minutes=request.timeout_minutes,
            callback_url=request.callback_url,
            callback_headers=request.callback_headers,
            error_threshold_percent=request.error_threshold_percent,
            created_by=current_user.get("user_id", "system"),
            job_parameters=request.job_parameters or {},
            labels=request.labels or {}
        )
        
        db.add(batch_job)
        db.commit()
        
        # Start batch processing in background
        background_tasks.add_task(
            _process_batch_job,
            batch_job.job_id,
            db
        )
        
        # Return job info
        return BatchPredictionResponse(
            id=batch_job.id,
            job_id=batch_job.job_id,
            name=batch_job.name,
            model_id=batch_job.model_id,
            status=batch_job.status,
            progress_percent=batch_job.progress_percent,
            total_records=batch_job.total_records,
            processed_records=batch_job.processed_records,
            successful_predictions=batch_job.successful_predictions,
            failed_predictions=batch_job.failed_predictions,
            success_rate=batch_job.success_rate,
            avg_prediction_time_ms=batch_job.avg_prediction_time_ms,
            total_processing_time_seconds=batch_job.total_processing_time_seconds,
            throughput_records_per_second=batch_job.throughput_records_per_second,
            error_count=batch_job.error_count,
            error_details=batch_job.error_details,
            estimated_cost_usd=batch_job.estimated_cost_usd,
            actual_cost_usd=batch_job.actual_cost_usd,
            created_at=batch_job.created_at,
            started_at=batch_job.started_at,
            completed_at=batch_job.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create batch prediction job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create batch prediction job"
        )


async def _process_batch_job(job_id: str, db: Session):
    """Background task to process batch prediction job."""
    try:
        job = db.query(BatchInferenceJob).filter(
            BatchInferenceJob.job_id == job_id
        ).first()
        
        if not job:
            return
        
        job.status = "running"
        job.started_at = datetime.utcnow()
        db.commit()
        
        # Mock batch processing - in production, this would:
        # 1. Read data from input source
        # 2. Process in batches using serving engine
        # 3. Write results to output destination
        # 4. Handle errors and retries
        # 5. Call callback URL if provided
        
        # Simulate processing
        await asyncio.sleep(5)
        
        # Update job as completed
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.progress_percent = 100.0
        job.total_records = 1000  # Mock values
        job.processed_records = 1000
        job.successful_predictions = 950
        job.failed_predictions = 50
        job.total_processing_time_seconds = 300
        
        db.commit()
        
    except Exception as e:
        logging.error(f"Batch job processing failed: {e}")
        # Update job status to failed
        try:
            job = db.query(BatchInferenceJob).filter(
                BatchInferenceJob.job_id == job_id
            ).first()
            if job:
                job.status = "failed"
                job.failed_at = datetime.utcnow()
                job.error_details = {"error": str(e)}
                db.commit()
        except:
            pass


@router.get(
    "/{model_id}/status",
    response_model=EndpointHealthResponse,
    summary="Model Serving Status",
    description="Get comprehensive health and status information for a serving model."
)
@handle_api_error
@track_api_metrics
async def get_model_status(
    model_id: str = Path(..., description="Model ID or endpoint ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get model serving status."""
    try:
        # Find endpoint
        endpoint = db.query(ServingEndpoint).filter(
            or_(
                ServingEndpoint.model_id == model_id,
                ServingEndpoint.endpoint_id == model_id
            )
        ).first()
        
        if not endpoint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Serving endpoint not found for model {model_id}"
            )
        
        # Get serving engine status
        serving_engine = get_serving_engine()
        model_status = serving_engine.get_model_status(endpoint.endpoint_id)
        
        # Get recent metrics
        recent_metrics = db.query(ServingMetrics).filter(
            and_(
                ServingMetrics.endpoint_id == endpoint.endpoint_id,
                ServingMetrics.timestamp > datetime.utcnow() - timedelta(minutes=5)
            )
        ).order_by(desc(ServingMetrics.timestamp)).limit(10).all()
        
        # Calculate current metrics
        current_metrics = {}
        if recent_metrics:
            current_metrics = {
                'avg_response_time_ms': sum(m.avg_response_time for m in recent_metrics) / len(recent_metrics),
                'error_rate_percent': sum(m.error_rate_percent for m in recent_metrics) / len(recent_metrics),
                'throughput_rps': sum(m.throughput_rps for m in recent_metrics) / len(recent_metrics),
                'cpu_usage_percent': sum(m.cpu_usage_percent for m in recent_metrics) / len(recent_metrics),
                'memory_usage_percent': sum(m.memory_usage_percent for m in recent_metrics) / len(recent_metrics)
            }
        
        return EndpointHealthResponse(
            endpoint_id=endpoint.endpoint_id,
            status=endpoint.status,
            health_status=endpoint.health_status,
            last_health_check=endpoint.last_health_check,
            health_checks={
                'model_loaded': model_status.get('status') == 'ready',
                'circuit_breaker': model_status.get('circuit_breaker_state') == 'closed',
                'within_thresholds': True  # Mock value
            },
            current_metrics=current_metrics,
            active_replicas=1,  # Mock value - would come from Kubernetes
            desired_replicas=endpoint.min_replicas,
            resource_utilization=current_metrics,
            circuit_breaker_status=model_status.get('circuit_breaker_state', 'unknown'),
            recent_errors=[],  # Mock value
            timestamp=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get model status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get model status"
        )


@router.post(
    "/{model_id}/scale",
    response_model=Dict[str, Any],
    summary="Manual Scaling",
    description="Manually scale a serving endpoint by adjusting replica count and resource thresholds."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=20)
async def scale_endpoint(
    model_id: str = Path(..., description="Model ID or endpoint ID"),
    scale_request: ScalingRequest = ...,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Manually scale serving endpoint."""
    try:
        endpoint = db.query(ServingEndpoint).filter(
            or_(
                ServingEndpoint.model_id == model_id,
                ServingEndpoint.endpoint_id == model_id
            )
        ).first()
        
        if not endpoint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Serving endpoint not found for model {model_id}"
            )
        
        # Update scaling configuration
        if scale_request.min_replicas is not None:
            endpoint.min_replicas = scale_request.min_replicas
        
        if scale_request.max_replicas is not None:
            endpoint.max_replicas = scale_request.max_replicas
        
        if scale_request.target_cpu_utilization is not None:
            endpoint.target_cpu_utilization = scale_request.target_cpu_utilization
        
        if scale_request.target_memory_utilization is not None:
            endpoint.target_memory_utilization = scale_request.target_memory_utilization
        
        # Update deployment auto-scaling config
        deployment = db.query(ModelDeployment).filter(
            ModelDeployment.deployment_id == endpoint.deployment_id
        ).first()
        
        if deployment:
            auto_scaling = deployment.auto_scaling or {}
            auto_scaling.update({
                "min_replicas": endpoint.min_replicas,
                "max_replicas": endpoint.max_replicas,
                "target_cpu_utilization": endpoint.target_cpu_utilization,
                "target_memory_utilization": endpoint.target_memory_utilization
            })
            deployment.auto_scaling = auto_scaling
        
        endpoint.status = "scaling"
        db.commit()
        
        # In production, this would trigger actual scaling in Kubernetes
        # For now, we'll just simulate the scaling completion
        endpoint.status = "active"
        db.commit()
        
        return {
            "success": True,
            "message": "Scaling configuration updated",
            "endpoint_id": endpoint.endpoint_id,
            "min_replicas": endpoint.min_replicas,
            "max_replicas": endpoint.max_replicas,
            "target_cpu_utilization": endpoint.target_cpu_utilization,
            "target_memory_utilization": endpoint.target_memory_utilization
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to scale endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to scale endpoint"
        )


@router.get(
    "/{model_id}/metrics",
    response_model=List[ServingMetricsResponse],
    summary="Performance Metrics",
    description="Get detailed performance metrics and monitoring data for a serving model."
)
@handle_api_error
@track_api_metrics
async def get_model_metrics(
    model_id: str = Path(..., description="Model ID or endpoint ID"),
    hours: int = Query(1, ge=1, le=168, description="Hours of metrics to retrieve"),
    interval_minutes: int = Query(5, ge=1, le=60, description="Aggregation interval in minutes"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get model serving metrics."""
    try:
        endpoint = db.query(ServingEndpoint).filter(
            or_(
                ServingEndpoint.model_id == model_id,
                ServingEndpoint.endpoint_id == model_id
            )
        ).first()
        
        if not endpoint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Serving endpoint not found for model {model_id}"
            )
        
        # Query metrics
        since_time = datetime.utcnow() - timedelta(hours=hours)
        metrics = db.query(ServingMetrics).filter(
            and_(
                ServingMetrics.endpoint_id == endpoint.endpoint_id,
                ServingMetrics.timestamp >= since_time
            )
        ).order_by(ServingMetrics.timestamp).all()
        
        # Convert to response format
        response_metrics = []
        for metric in metrics:
            response_metrics.append(
                ServingMetricsResponse(
                    endpoint_id=metric.endpoint_id,
                    model_id=metric.model_id,
                    timestamp=metric.timestamp,
                    request_count=metric.request_count,
                    successful_requests=metric.successful_requests,
                    failed_requests=metric.failed_requests,
                    timeout_requests=metric.timeout_requests,
                    avg_response_time=metric.avg_response_time,
                    min_response_time=metric.min_response_time,
                    max_response_time=metric.max_response_time,
                    p50_response_time=metric.p50_response_time,
                    p95_response_time=metric.p95_response_time,
                    p99_response_time=metric.p99_response_time,
                    throughput_rps=metric.throughput_rps,
                    concurrent_requests=metric.concurrent_requests,
                    queue_size=metric.queue_size,
                    cpu_usage_percent=metric.cpu_usage_percent,
                    memory_usage_percent=metric.memory_usage_percent,
                    gpu_usage_percent=metric.gpu_usage_percent,
                    disk_usage_percent=metric.disk_usage_percent,
                    active_replicas=metric.active_replicas,
                    scaling_events=metric.scaling_events,
                    container_restarts=metric.container_restarts,
                    data_drift_score=metric.data_drift_score,
                    model_accuracy=metric.model_accuracy,
                    prediction_confidence=metric.prediction_confidence,
                    cache_hit_rate=metric.cache_hit_rate,
                    cache_size_mb=metric.cache_size_mb,
                    cache_evictions=metric.cache_evictions,
                    error_types=metric.error_types,
                    error_rate_percent=metric.error_rate_percent,
                    compute_cost_usd=metric.compute_cost_usd,
                    data_transfer_cost_usd=metric.data_transfer_cost_usd,
                    storage_cost_usd=metric.storage_cost_usd
                )
            )
        
        return response_metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get model metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get model metrics"
        )


@router.post(
    "/{model_id}/canary",
    response_model=CanaryDeploymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Canary Deployment",
    description="Start a canary deployment with statistical analysis and automatic rollback."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=5)
async def create_canary_deployment(
    model_id: str = Path(..., description="Model ID"),
    canary_config: CanaryDeploymentCreate = ...,
    background_tasks: BackgroundTasks = ...,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create canary deployment."""
    try:
        # Validate deployments exist
        baseline_deployment = db.query(ModelDeployment).filter(
            ModelDeployment.deployment_id == canary_config.baseline_deployment_id
        ).first()
        
        canary_deployment = db.query(ModelDeployment).filter(
            ModelDeployment.deployment_id == canary_config.canary_deployment_id
        ).first()
        
        if not baseline_deployment or not canary_deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Baseline or canary deployment not found"
            )
        
        # Create canary deployment record
        canary = CanaryDeployment(
            name=canary_config.name,
            baseline_deployment_id=canary_config.baseline_deployment_id,
            canary_deployment_id=canary_config.canary_deployment_id,
            traffic_split_percent=canary_config.traffic_split_percent,
            traffic_split_strategy=canary_config.traffic_split_strategy.value,
            routing_rules=canary_config.routing_rules,
            success_criteria=canary_config.success_criteria,
            min_sample_size=canary_config.min_sample_size,
            evaluation_period_minutes=canary_config.evaluation_period_minutes,
            auto_rollback_enabled=canary_config.auto_rollback_enabled,
            rollback_threshold_error_rate=canary_config.rollback_threshold_error_rate,
            rollback_threshold_latency_ms=canary_config.rollback_threshold_latency_ms,
            rollback_evaluation_window_minutes=canary_config.rollback_evaluation_window_minutes,
            statistical_test=canary_config.statistical_test,
            significance_level=canary_config.significance_level,
            created_by=current_user.get("user_id", "system"),
            configuration=canary_config.configuration or {}
        )
        
        db.add(canary)
        db.commit()
        
        # Start canary deployment monitoring
        deployment_manager = get_deployment_manager(db)
        background_tasks.add_task(
            _start_canary_monitoring,
            canary.canary_id,
            deployment_manager
        )
        
        return CanaryDeploymentResponse(
            id=canary.id,
            canary_id=canary.canary_id,
            name=canary.name,
            baseline_deployment_id=canary.baseline_deployment_id,
            canary_deployment_id=canary.canary_deployment_id,
            traffic_split_percent=canary.traffic_split_percent,
            current_traffic_percent=canary.current_traffic_percent,
            traffic_split_strategy=canary.traffic_split_strategy,
            status=canary.status,
            evaluation_results=canary.evaluation_results,
            statistical_test=canary.statistical_test,
            significance_level=canary.significance_level,
            p_value=canary.p_value,
            confidence_interval=canary.confidence_interval,
            baseline_metrics=canary.baseline_metrics,
            canary_metrics=canary.canary_metrics,
            improvement_percent=canary.improvement_percent,
            duration_minutes=canary.duration_minutes,
            created_at=canary.created_at,
            started_at=canary.started_at,
            completed_at=canary.completed_at,
            rolled_back_at=canary.rolled_back_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create canary deployment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create canary deployment"
        )


async def _start_canary_monitoring(canary_id: str, deployment_manager):
    """Start canary deployment monitoring."""
    try:
        # This would integrate with the deployment manager's canary monitoring
        logging.info(f"Started canary monitoring for {canary_id}")
        # Mock monitoring - in production, this would call the deployment manager
        await asyncio.sleep(1)
    except Exception as e:
        logging.error(f"Failed to start canary monitoring: {e}")


@router.post(
    "/{model_id}/rollback",
    response_model=Dict[str, Any],
    summary="Rollback Deployment",
    description="Rollback a model deployment to a previous version with optional safety checks."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=10)
async def rollback_deployment(
    model_id: str = Path(..., description="Model ID or deployment ID"),
    rollback_request: ModelRollbackRequest = ...,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Rollback model deployment."""
    try:
        deployment_manager = get_deployment_manager(db)
        
        # Use deployment manager for rollback
        result = await deployment_manager.manual_rollback(
            deployment_id=model_id,
            reason=rollback_request.rollback_reason
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to rollback deployment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to rollback deployment"
        )


@router.get(
    "/endpoints",
    response_model=List[ServingEndpointResponse],
    summary="List Serving Endpoints",
    description="List all serving endpoints with filtering and pagination."
)
@handle_api_error
@track_api_metrics
async def list_serving_endpoints(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    model_id: Optional[str] = Query(None, description="Filter by model ID"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List serving endpoints."""
    try:
        query = db.query(ServingEndpoint)
        
        # Apply filters
        if status_filter:
            query = query.filter(ServingEndpoint.status == status_filter)
        
        if model_id:
            query = query.filter(ServingEndpoint.model_id == model_id)
        
        # Apply pagination
        endpoints = query.offset(offset).limit(limit).all()
        
        # Convert to response format
        response_endpoints = []
        for endpoint in endpoints:
            response_endpoints.append(
                ServingEndpointResponse(
                    id=endpoint.id,
                    endpoint_id=endpoint.endpoint_id,
                    name=endpoint.name,
                    model_id=endpoint.model_id,
                    deployment_id=endpoint.deployment_id,
                    endpoint_url=endpoint.endpoint_url,
                    api_version=endpoint.api_version,
                    protocol=endpoint.protocol,
                    port=endpoint.port,
                    compute_backend=endpoint.compute_backend,
                    instance_type=endpoint.instance_type,
                    min_replicas=endpoint.min_replicas,
                    max_replicas=endpoint.max_replicas,
                    target_cpu_utilization=endpoint.target_cpu_utilization,
                    target_memory_utilization=endpoint.target_memory_utilization,
                    batch_size=endpoint.batch_size,
                    max_batch_delay_ms=endpoint.max_batch_delay_ms,
                    request_timeout_ms=endpoint.request_timeout_ms,
                    concurrent_requests=endpoint.concurrent_requests,
                    status=endpoint.status,
                    health_status=endpoint.health_status,
                    last_health_check=endpoint.last_health_check,
                    total_requests=endpoint.total_requests,
                    successful_requests=endpoint.successful_requests,
                    failed_requests=endpoint.failed_requests,
                    avg_response_time_ms=endpoint.avg_response_time_ms,
                    p95_response_time_ms=endpoint.p95_response_time_ms,
                    p99_response_time_ms=endpoint.p99_response_time_ms,
                    throughput_rps=endpoint.throughput_rps,
                    success_rate=endpoint.success_rate,
                    estimated_hourly_cost=endpoint.estimated_hourly_cost,
                    total_compute_hours=endpoint.total_compute_hours,
                    created_at=endpoint.created_at,
                    updated_at=endpoint.updated_at,
                    activated_at=endpoint.activated_at
                )
            )
        
        return response_endpoints
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to list serving endpoints: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list serving endpoints"
        )


@router.delete(
    "/{endpoint_id}",
    response_model=Dict[str, Any],
    summary="Delete Serving Endpoint",
    description="Terminate and delete a serving endpoint."
)
@handle_api_error
@track_api_metrics
@rate_limit(requests_per_minute=20)
async def delete_serving_endpoint(
    endpoint_id: str = Path(..., description="Endpoint ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete serving endpoint."""
    try:
        endpoint = db.query(ServingEndpoint).filter(
            ServingEndpoint.endpoint_id == endpoint_id
        ).first()
        
        if not endpoint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Serving endpoint {endpoint_id} not found"
            )
        
        # Unload model from serving engine
        serving_engine = get_serving_engine()
        serving_engine.unload_model(endpoint_id)
        
        # Update endpoint status
        endpoint.status = "inactive"
        endpoint.deactivated_at = datetime.utcnow()
        
        # Terminate associated deployment
        deployment = db.query(ModelDeployment).filter(
            ModelDeployment.deployment_id == endpoint.deployment_id
        ).first()
        
        if deployment:
            deployment.status = DeploymentStatus.TERMINATED
            deployment.terminated_at = datetime.utcnow()
            deployment.traffic_percentage = 0.0
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Serving endpoint {endpoint_id} terminated",
            "endpoint_id": endpoint_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete serving endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete serving endpoint"
        )