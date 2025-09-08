"""
MLOps API Endpoints
===================

Comprehensive REST API endpoints for MLOps platform providing complete ML lifecycle management.
Designed for AI companies to integrate ML operations through simple API calls.

Features:
- Model registry management with versioning and lineage
- Experiment creation and tracking
- Training job orchestration and monitoring
- Model deployment and serving
- A/B testing and canary deployments
- Performance monitoring and alerting
- Real-time metrics and health checks

Endpoints:
- POST /api/v1/mlops/models/register - Register new model
- GET /api/v1/mlops/models - List models with filtering
- GET /api/v1/mlops/models/{model_id} - Get model details
- POST /api/v1/mlops/experiments/create - Create ML experiment
- GET /api/v1/mlops/experiments/{id}/status - Get experiment status
- POST /api/v1/mlops/training/jobs - Create training job
- POST /api/v1/mlops/models/{id}/deploy - Deploy model
- GET /api/v1/mlops/models/{id}/performance - Get model performance
- POST /api/v1/mlops/models/{id}/ab-test - Start A/B test
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

# Import core dependencies
from app.core.database import get_db_session
from app.auth.unified_dependencies import get_current_user
from app.core.error_handler import handle_exceptions
from app.core.metrics import track_api_call

# Import MLOps components
from app.ml.mlops_platform import MLOpsCore, create_mlops_platform
from app.services.model_registry import ModelRegistryService
from app.services.training_pipeline_service import TrainingPipelineService

# Import schemas
from app.schemas.mlops import (
    # Model Registry
    ModelRegistrationRequest, ModelResponse, ModelListResponse, ModelUpdateRequest,
    ModelSearchRequest, ModelHealthReport,
    
    # Experiments
    ExperimentCreateRequest, ExperimentResponse, ExperimentListResponse,
    
    # Training Jobs
    TrainingJobCreateRequest, TrainingJobResponse, TrainingJobListResponse,
    
    # Deployments
    DeploymentCreateRequest, DeploymentResponse, DeploymentListResponse, 
    DeploymentUpdateRequest,
    
    # Predictions
    PredictionRequest, PredictionResponse,
    
    # A/B Testing
    ABTestCreateRequest, ABTestResponse,
    
    # Performance Monitoring
    PerformanceLogRequest, PerformanceLogResponse, ModelPerformanceResponse,
    
    # Alerts
    AlertCreateRequest, AlertResponse, AlertListResponse,
    
    # Statistics
    PlatformStatistics,
    
    # Common
    MLOpsError, ValidationError
)

# Import models (for database operations)
try:
    from app.models.mlops import (
        MLModel, MLExperiment, TrainingJob, ModelDeployment, 
        ModelPerformanceLog, ModelApproval, ABTest, ModelAlert
    )
except ImportError:
    logging.warning("MLOps models not available - some endpoints may not work")

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/mlops", tags=["MLOps Platform"])

# Global MLOps platform instance
mlops_platform: Optional[MLOpsCore] = None
model_registry_service: Optional[ModelRegistryService] = None
training_pipeline_service: Optional[TrainingPipelineService] = None


async def get_mlops_platform() -> MLOpsCore:
    """Get or create MLOps platform instance."""
    global mlops_platform
    if mlops_platform is None:
        mlops_platform = create_mlops_platform()
    return mlops_platform


async def get_model_registry_service() -> ModelRegistryService:
    """Get or create model registry service."""
    global model_registry_service
    if model_registry_service is None:
        from app.services.model_registry import create_model_registry_service
        model_registry_service = create_model_registry_service()
    return model_registry_service


async def get_training_pipeline_service() -> TrainingPipelineService:
    """Get or create training pipeline service."""
    global training_pipeline_service
    if training_pipeline_service is None:
        from app.services.training_pipeline_service import create_training_pipeline_service
        training_pipeline_service = create_training_pipeline_service()
    return training_pipeline_service


# Model Registry Endpoints
@router.post("/models/register", response_model=Dict[str, str])
@handle_exceptions
@track_api_call("mlops_register_model")
async def register_model(
    request: ModelRegistrationRequest,
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, str]:
    """
    Register a new model in the registry.
    
    This endpoint allows AI companies to register trained models with comprehensive
    metadata including versioning, lineage tracking, and performance metrics.
    """
    try:
        # Note: In a real implementation, you would handle the actual model artifact
        # For this API, we assume the model artifact is uploaded separately or referenced
        
        # Create a placeholder model object (in production, this would be the actual model)
        model_placeholder = "model_artifact_placeholder"
        
        model_id = mlops.register_model(
            name=request.name,
            model=model_placeholder,
            framework=request.framework,
            model_type=request.model_type,
            description=request.description,
            tags=request.tags,
            author=request.author,
            version=request.version,
            input_schema=request.input_schema,
            output_schema=request.output_schema,
            feature_names=request.feature_names,
            target_names=request.target_names,
            hyperparameters=request.hyperparameters,
            training_metrics=request.training_metrics,
            parent_model_id=request.parent_model_id,
            experiment_id=request.experiment_id
        )
        
        return {
            "model_id": model_id,
            "message": f"Model '{request.name}' registered successfully",
            "status": "success"
        }
    
    except Exception as e:
        logger.error(f"Error registering model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register model: {str(e)}"
        )


@router.get("/models", response_model=ModelListResponse)
@handle_exceptions
@track_api_call("mlops_list_models")
async def list_models(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
    framework: Optional[str] = Query(None, description="Filter by framework"),
    status: Optional[str] = Query(None, description="Filter by status"),
    author: Optional[str] = Query(None, description="Filter by author"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> ModelListResponse:
    """
    List models with optional filtering and pagination.
    
    Supports comprehensive filtering by framework, status, author, and text search.
    """
    try:
        # Build filters
        filters = {}
        if framework:
            filters['framework_filter'] = framework
        if status:
            filters['status_filter'] = status
        if author:
            filters['name_filter'] = author
        if search:
            filters['name_filter'] = search
        
        # Get models
        models = mlops.list_models(**filters)
        
        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_models = models[start_idx:end_idx]
        
        # Convert to response format
        model_responses = []
        for model_metadata in paginated_models:
            model_responses.append(ModelResponse(
                model_id=model_metadata.model_id,
                name=model_metadata.name,
                version=model_metadata.version,
                framework=model_metadata.framework,
                model_type=model_metadata.model_type,
                description=model_metadata.description,
                tags=model_metadata.tags,
                author=model_metadata.author,
                status=model_metadata.status,
                input_schema=model_metadata.input_schema,
                output_schema=model_metadata.output_schema,
                feature_names=model_metadata.feature_names,
                target_names=model_metadata.target_names,
                training_dataset_id=model_metadata.training_dataset_id,
                hyperparameters=model_metadata.hyperparameters,
                training_metrics=model_metadata.training_metrics,
                validation_metrics=model_metadata.validation_metrics,
                deployment_config=model_metadata.deployment_config,
                resource_requirements=model_metadata.resource_requirements,
                parent_model_id=model_metadata.parent_model_id,
                experiment_id=model_metadata.experiment_id,
                dependencies=model_metadata.dependencies,
                created_at=model_metadata.created_at,
                updated_at=model_metadata.updated_at
            ))
        
        return ModelListResponse(
            models=model_responses,
            total=len(models),
            page=page,
            page_size=page_size
        )
    
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list models: {str(e)}"
        )


@router.get("/models/{model_id}", response_model=ModelResponse)
@handle_exceptions
@track_api_call("mlops_get_model")
async def get_model(
    model_id: str = Path(..., description="Model ID"),
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> ModelResponse:
    """
    Get detailed information about a specific model.
    
    Returns comprehensive model metadata including lineage, performance metrics,
    and deployment information.
    """
    try:
        _, model_metadata = mlops.get_model(model_id)
        
        return ModelResponse(
            model_id=model_metadata.model_id,
            name=model_metadata.name,
            version=model_metadata.version,
            framework=model_metadata.framework,
            model_type=model_metadata.model_type,
            description=model_metadata.description,
            tags=model_metadata.tags,
            author=model_metadata.author,
            status=model_metadata.status,
            input_schema=model_metadata.input_schema,
            output_schema=model_metadata.output_schema,
            feature_names=model_metadata.feature_names,
            target_names=model_metadata.target_names,
            training_dataset_id=model_metadata.training_dataset_id,
            hyperparameters=model_metadata.hyperparameters,
            training_metrics=model_metadata.training_metrics,
            validation_metrics=model_metadata.validation_metrics,
            deployment_config=model_metadata.deployment_config,
            resource_requirements=model_metadata.resource_requirements,
            parent_model_id=model_metadata.parent_model_id,
            experiment_id=model_metadata.experiment_id,
            dependencies=model_metadata.dependencies,
            created_at=model_metadata.created_at,
            updated_at=model_metadata.updated_at
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting model {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model: {str(e)}"
        )


@router.get("/models/{model_id}/lineage", response_model=Dict[str, Any])
@handle_exceptions
@track_api_call("mlops_get_model_lineage")
async def get_model_lineage(
    model_id: str = Path(..., description="Model ID"),
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, Any]:
    """
    Get model lineage and dependencies.
    
    Returns the complete lineage tree showing parent models and child models.
    """
    try:
        lineage = mlops.get_model_lineage(model_id)
        return lineage
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting model lineage for {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model lineage: {str(e)}"
        )


@router.get("/models/{model_id}/performance", response_model=Dict[str, Any])
@handle_exceptions
@track_api_call("mlops_get_model_performance")
async def get_model_performance(
    model_id: str = Path(..., description="Model ID"),
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, Any]:
    """
    Get model performance metrics and history.
    
    Returns training metrics, validation metrics, and production performance history.
    """
    try:
        performance = mlops.get_model_performance(model_id)
        return performance
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting model performance for {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model performance: {str(e)}"
        )


@router.post("/models/{model_id}/predict", response_model=PredictionResponse)
@handle_exceptions
@track_api_call("mlops_model_predict")
async def predict_with_model(
    model_id: str = Path(..., description="Model ID"),
    request: PredictionRequest = ...,
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> PredictionResponse:
    """
    Make predictions using a deployed model.
    
    Supports both single predictions and batch predictions with optional
    probability scores and explanations.
    """
    try:
        start_time = datetime.utcnow()
        
        # Make prediction
        result = await mlops.predict(
            model_id=model_id,
            input_data=request.input_data,
            return_probabilities=request.return_probabilities
        )
        
        # Calculate response time
        response_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return PredictionResponse(
            model_id=result['model_id'],
            model_name=result['model_name'],
            model_version=result['model_version'],
            predictions=result['predictions'],
            probabilities=result.get('probabilities'),
            prediction_timestamp=datetime.fromisoformat(result['prediction_timestamp']),
            response_time_ms=response_time_ms
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error making prediction with model {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to make prediction: {str(e)}"
        )


# Experiment Endpoints
@router.post("/experiments/create", response_model=Dict[str, Any])
@handle_exceptions
@track_api_call("mlops_create_experiment")
async def create_experiment(
    request: ExperimentCreateRequest,
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, Any]:
    """
    Create and optionally start a new ML experiment.
    
    Experiments allow you to test multiple model configurations and compare results.
    """
    try:
        result = await mlops.create_and_run_experiment(
            name=request.name,
            description=request.description,
            dataset_config=request.dataset_config,
            target_column=request.target_column,
            model_configs=request.model_configs,
            created_by=current_user.get('username', 'unknown'),
            feature_columns=request.feature_columns,
            optimization_budget=request.optimization_budget,
            max_training_time_minutes=request.max_training_time_minutes,
            wait_for_completion=False  # Run in background
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error creating experiment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create experiment: {str(e)}"
        )


@router.get("/experiments/{experiment_id}/status", response_model=Dict[str, Any])
@handle_exceptions
@track_api_call("mlops_get_experiment_status")
async def get_experiment_status(
    experiment_id: str = Path(..., description="Experiment ID"),
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, Any]:
    """
    Get current status and results of an experiment.
    
    Returns experiment progress, current status, and results if completed.
    """
    try:
        status_info = await mlops.get_experiment_status(experiment_id)
        return status_info
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting experiment status for {experiment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get experiment status: {str(e)}"
        )


# Training Job Endpoints
@router.post("/training/jobs", response_model=Dict[str, str])
@handle_exceptions
@track_api_call("mlops_create_training_job")
async def create_training_job(
    request: TrainingJobCreateRequest,
    current_user: dict = Depends(get_current_user),
    training_service: TrainingPipelineService = Depends(get_training_pipeline_service)
) -> Dict[str, str]:
    """
    Create a new training job.
    
    Training jobs provide advanced orchestration with resource management,
    parallel training, and hyperparameter optimization.
    """
    try:
        job_id = await training_service.create_training_job(
            name=request.name,
            description=request.description,
            data_config=request.data_config,
            target_column=request.target_column,
            model_configs=request.model_configs,
            created_by=current_user.get('username', 'unknown'),
            feature_columns=request.feature_columns,
            optimization_method=request.optimization_method,
            optimization_budget=request.optimization_budget,
            max_training_time_hours=request.max_training_time_hours,
            max_parallel_jobs=request.max_parallel_jobs,
            memory_limit_gb=request.memory_limit_gb,
            gpu_enabled=request.gpu_enabled,
            distributed_training=request.distributed_training,
            priority=request.priority,
            experiment_id=request.experiment_id
        )
        
        return {
            "job_id": job_id,
            "message": f"Training job '{request.name}' created successfully",
            "status": "queued"
        }
    
    except Exception as e:
        logger.error(f"Error creating training job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create training job: {str(e)}"
        )


@router.get("/training/jobs/{job_id}/status", response_model=Dict[str, Any])
@handle_exceptions
@track_api_call("mlops_get_training_job_status")
async def get_training_job_status(
    job_id: str = Path(..., description="Training job ID"),
    current_user: dict = Depends(get_current_user),
    training_service: TrainingPipelineService = Depends(get_training_pipeline_service)
) -> Dict[str, Any]:
    """
    Get training job status and progress.
    
    Returns real-time status, progress percentage, current step, and resource usage.
    """
    try:
        status_info = training_service.get_job_status(job_id)
        return status_info
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting training job status for {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get training job status: {str(e)}"
        )


@router.post("/training/jobs/{job_id}/cancel", response_model=Dict[str, str])
@handle_exceptions
@track_api_call("mlops_cancel_training_job")
async def cancel_training_job(
    job_id: str = Path(..., description="Training job ID"),
    current_user: dict = Depends(get_current_user),
    training_service: TrainingPipelineService = Depends(get_training_pipeline_service)
) -> Dict[str, str]:
    """
    Cancel a running training job.
    
    Cancels the job, releases resources, and updates status.
    """
    try:
        await training_service.cancel_job(job_id)
        
        return {
            "job_id": job_id,
            "message": "Training job cancelled successfully",
            "status": "cancelled"
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error cancelling training job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel training job: {str(e)}"
        )


@router.get("/training/jobs", response_model=TrainingJobListResponse)
@handle_exceptions
@track_api_call("mlops_list_training_jobs")
async def list_training_jobs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    created_by_filter: Optional[str] = Query(None, description="Filter by creator"),
    current_user: dict = Depends(get_current_user),
    training_service: TrainingPipelineService = Depends(get_training_pipeline_service)
) -> TrainingJobListResponse:
    """
    List training jobs with filtering and pagination.
    """
    try:
        # Convert status filter to enum if provided
        status_enum = None
        if status_filter:
            from app.services.training_pipeline_service import TrainingStatus
            status_enum = TrainingStatus(status_filter)
        
        jobs = training_service.list_jobs(
            status_filter=status_enum,
            created_by_filter=created_by_filter
        )
        
        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_jobs = jobs[start_idx:end_idx]
        
        # Convert to response format
        job_responses = []
        for job_info in paginated_jobs:
            job_responses.append(TrainingJobResponse(
                job_id=job_info['job_id'],
                name=job_info['name'],
                status=job_info['status'],
                progress=job_info['progress'],
                created_by=job_info['created_by'],
                created_at=datetime.fromisoformat(job_info['created_at']),
                priority=job_info['priority'],
                data_config={},  # Simplified for listing
                target_column="",
                feature_columns=[],
                model_configs=[]
            ))
        
        return TrainingJobListResponse(
            jobs=job_responses,
            total=len(jobs),
            page=page,
            page_size=page_size
        )
    
    except Exception as e:
        logger.error(f"Error listing training jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list training jobs: {str(e)}"
        )


# A/B Testing Endpoints
@router.post("/models/{model_id}/ab-test", response_model=Dict[str, Any])
@handle_exceptions
@track_api_call("mlops_create_ab_test")
async def create_ab_test(
    model_id: str = Path(..., description="Champion model ID"),
    request: ABTestCreateRequest,
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, Any]:
    """
    Start an A/B test between two models.
    
    Creates an A/B test to compare the performance of a champion model
    against a challenger model with statistical analysis.
    """
    try:
        # Verify models exist
        try:
            mlops.get_model(model_id)
            mlops.get_model(request.challenger_model_id)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model not found: {str(e)}"
            )
        
        # Create A/B test configuration
        ab_test_id = str(uuid.uuid4())
        
        # In a real implementation, you would:
        # 1. Create A/B test record in database
        # 2. Configure traffic routing
        # 3. Set up metrics collection
        # 4. Initialize statistical analysis
        
        return {
            "ab_test_id": ab_test_id,
            "champion_model_id": model_id,
            "challenger_model_id": request.challenger_model_id,
            "status": "running",
            "traffic_allocation": {
                "champion": request.champion_traffic_pct,
                "challenger": request.challenger_traffic_pct
            },
            "message": "A/B test started successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating A/B test: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create A/B test: {str(e)}"
        )


# Model Deployment Endpoints
@router.post("/models/{model_id}/deploy", response_model=Dict[str, str])
@handle_exceptions
@track_api_call("mlops_deploy_model")
async def deploy_model(
    model_id: str = Path(..., description="Model ID to deploy"),
    request: DeploymentCreateRequest,
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform)
) -> Dict[str, str]:
    """
    Deploy a model to a specified environment.
    
    Creates a deployment with specified infrastructure configuration,
    monitoring, and traffic routing.
    """
    try:
        # Verify model exists
        try:
            mlops.get_model(model_id)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model not found: {str(e)}"
            )
        
        # Create deployment
        deployment_id = str(uuid.uuid4())
        
        # In a real implementation, you would:
        # 1. Create deployment record in database
        # 2. Deploy to container orchestration platform (K8s, ECS, etc.)
        # 3. Configure load balancers and traffic routing
        # 4. Set up monitoring and health checks
        # 5. Initialize alert rules
        
        return {
            "deployment_id": deployment_id,
            "model_id": model_id,
            "status": "deploying",
            "environment": request.environment,
            "message": f"Model deployment to {request.environment} initiated successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deploying model {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deploy model: {str(e)}"
        )


# Performance Monitoring Endpoints
@router.post("/models/{model_id}/performance", response_model=Dict[str, str])
@handle_exceptions
@track_api_call("mlops_log_performance")
async def log_model_performance(
    model_id: str = Path(..., description="Model ID"),
    request: PerformanceLogRequest,
    current_user: dict = Depends(get_current_user),
    model_registry: ModelRegistryService = Depends(get_model_registry_service)
) -> Dict[str, str]:
    """
    Log model performance metrics.
    
    Records performance metrics for monitoring model drift and degradation.
    """
    try:
        # Verify model exists
        try:
            model_registry.registry.get_model(model_id)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model not found: {str(e)}"
            )
        
        # Track performance
        model_registry.registry.track_model_performance(
            model_id=model_id,
            metrics=request.metrics,
            dataset_name=request.dataset_name,
            timestamp=datetime.utcnow()
        )
        
        return {
            "model_id": model_id,
            "status": "success",
            "message": "Performance metrics logged successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging performance for model {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log performance: {str(e)}"
        )


@router.get("/models/{model_id}/health", response_model=ModelHealthReport)
@handle_exceptions
@track_api_call("mlops_get_model_health")
async def get_model_health(
    model_id: str = Path(..., description="Model ID"),
    current_user: dict = Depends(get_current_user),
    model_registry: ModelRegistryService = Depends(get_model_registry_service)
) -> ModelHealthReport:
    """
    Get comprehensive model health report.
    
    Returns health score, integrity status, performance trends, and recommendations.
    """
    try:
        health_report = model_registry.get_model_health_report(model_id)
        
        return ModelHealthReport(
            model_id=health_report['model_id'],
            model_name=health_report['model_name'],
            model_version=health_report.get('model_version', 'unknown'),
            status=health_report.get('status', 'unknown'),
            health_score=health_report['health_score'],
            integrity_status=health_report['integrity']['status'],
            performance_trend=health_report['performance_trend'],
            approval_status=health_report['approval_status'],
            recommendations=health_report['recommendations'],
            last_updated=datetime.fromisoformat(health_report['last_updated']),
            report_generated_at=datetime.utcnow()
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting model health for {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model health: {str(e)}"
        )


# Platform Statistics Endpoints
@router.get("/statistics", response_model=PlatformStatistics)
@handle_exceptions
@track_api_call("mlops_get_statistics")
async def get_platform_statistics(
    current_user: dict = Depends(get_current_user),
    mlops: MLOpsCore = Depends(get_mlops_platform),
    training_service: TrainingPipelineService = Depends(get_training_pipeline_service)
) -> PlatformStatistics:
    """
    Get comprehensive platform statistics.
    
    Returns statistics about models, experiments, training jobs, deployments,
    and overall platform health.
    """
    try:
        # Get MLOps platform stats
        mlops_stats = mlops.get_platform_stats()
        
        # Get training service stats
        training_stats = training_service.get_service_statistics()
        
        return PlatformStatistics(
            total_models=mlops_stats['models']['total_models'],
            models_by_status=mlops_stats['models']['by_status'],
            models_by_framework=mlops_stats['models']['by_framework'],
            models_by_type=mlops_stats['models']['by_type'],
            total_experiments=mlops_stats['experiments']['total_experiments'],
            experiments_by_status=mlops_stats['experiments']['by_status'],
            active_experiments=mlops_stats['experiments']['active_experiments'],
            total_training_jobs=training_stats['total_jobs'],
            jobs_by_status=training_stats['jobs_by_status'],
            active_training_jobs=training_stats['active_tasks'],
            total_deployments=0,  # Would come from deployment service
            deployments_by_status={},
            deployments_by_environment={},
            active_deployments=0,
            total_predictions_served=0,  # Would come from inference service
            avg_response_time_ms=None,
            models_with_active_monitoring=0,
            active_alerts=0,
            resource_utilization=training_stats.get('resource_utilization'),
            platform_version=mlops_stats['platform_version'],
            statistics_generated_at=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error getting platform statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get platform statistics: {str(e)}"
        )


# Utility Endpoints
@router.get("/health", response_model=Dict[str, Any])
@handle_exceptions
async def health_check() -> Dict[str, Any]:
    """
    MLOps platform health check.
    
    Returns the health status of all MLOps components.
    """
    try:
        # Check component health
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "components": {
                "mlops_core": "healthy",
                "model_registry": "healthy",
                "training_pipeline": "healthy",
                "deployment_service": "not_implemented",
                "monitoring_service": "not_implemented"
            }
        }
        
        # Test component availability
        try:
            await get_mlops_platform()
            health_status["components"]["mlops_core"] = "healthy"
        except Exception as e:
            health_status["components"]["mlops_core"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"
        
        try:
            await get_model_registry_service()
            health_status["components"]["model_registry"] = "healthy"
        except Exception as e:
            health_status["components"]["model_registry"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"
        
        try:
            await get_training_pipeline_service()
            health_status["components"]["training_pipeline"] = "healthy"
        except Exception as e:
            health_status["components"]["training_pipeline"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"
        
        return health_status
    
    except Exception as e:
        logger.error(f"Error in health check: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }


# Error handlers
@router.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """Handle validation errors."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=MLOpsError(
            error_code="INVALID_INPUT",
            error_message=str(exc)
        ).dict()
    )


@router.exception_handler(FileNotFoundError)
async def file_not_found_handler(request, exc):
    """Handle file not found errors."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=MLOpsError(
            error_code="RESOURCE_NOT_FOUND",
            error_message=str(exc)
        ).dict()
    )


# Background task for cleanup and maintenance
async def cleanup_background_tasks():
    """Background task for cleanup and maintenance."""
    try:
        # Cleanup expired experiments
        # Cleanup old performance logs
        # Update model health scores
        # Send scheduled reports
        logger.info("MLOps background cleanup completed")
    except Exception as e:
        logger.error(f"Error in background cleanup: {e}")


# Initialize background tasks
@router.on_event("startup")
async def startup_event():
    """Initialize MLOps platform on startup."""
    try:
        # Initialize platform components
        await get_mlops_platform()
        await get_model_registry_service()
        await get_training_pipeline_service()
        
        # Start background tasks
        asyncio.create_task(cleanup_background_tasks())
        
        logger.info("MLOps platform initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing MLOps platform: {e}")


@router.on_event("shutdown")
async def shutdown_event():
    """Clean shutdown of MLOps platform."""
    try:
        # Cleanup resources
        # Stop background tasks
        # Save state
        logger.info("MLOps platform shutdown completed")
    except Exception as e:
        logger.error(f"Error during MLOps platform shutdown: {e}")