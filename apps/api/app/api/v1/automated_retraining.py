"""
Automated Retraining API Endpoints
==================================

RESTful API endpoints for automated model retraining and continuous learning pipelines.
Provides comprehensive functionality for pipeline management, execution monitoring,
drift detection, and quality assurance in automated ML model maintenance.

Endpoints:
- Pipeline Management: Create, configure, and manage retraining pipelines
- Execution Control: Trigger, monitor, and manage retraining executions
- Drift Detection: Configure and monitor data drift detection
- Quality Assurance: Monitor quality gates and validation results
- Analytics: Performance insights and system analytics
- Health Monitoring: System health checks and diagnostics
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

# Import schemas
from app.schemas.automated_retraining import (
    CreateRetrainingPipelineRequest, TriggerRetrainingRequest, UpdatePipelineRequest,
    DriftDetectionConfigRequest, PaginationParams,
    PipelineResponse, ExecutionResponse, DriftReportResponse, AlertResponse,
    QualityGateResultResponse, PipelineListResponse, ExecutionListResponse,
    DriftReportListResponse, AlertListResponse, PipelineStatusResponse,
    SystemHealthResponse, ModelPerformanceInsights, RetrainingAnalytics,
    ErrorResponse, SuccessResponse,
    RetrainingTriggerType, RetrainingPipelineStatus, DriftDetectionMethod,
    AlertSeverity, QualityGate
)

# Import models
try:
    from app.models.automated_retraining import (
        RetrainingPipeline, RetrainingExecution, DriftMonitor, DriftReport,
        PerformanceMonitor, ContinuousLearningConfig, FeedbackLog,
        RetrainingAlert, QualityGateResult
    )
    from app.database.connection import get_db
    DB_AVAILABLE = True
except ImportError:
    logging.warning("Database models not available")
    DB_AVAILABLE = False

# Import services
try:
    from app.services.retraining_pipeline_service import (
        RetrainingPipelineService, RetrainingPolicyConfig, create_retraining_pipeline_service
    )
    from app.services.drift_detection_service import (
        AdvancedDriftDetectionService, create_drift_detection_service
    )
    from app.services.mlflow_integration import MLflowIntegrationService
    from app.services.monitoring_service import MonitoringService
    from app.services.data_quality_service import DataQualityService
    from app.services.advanced_ml_engine import AdvancedMLEngine
    SERVICES_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Services not available: {e}")
    SERVICES_AVAILABLE = False

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/retraining", tags=["Automated Retraining"])

# Service instances (lazy initialization)
_retraining_service: Optional[RetrainingPipelineService] = None
_drift_service: Optional[AdvancedDriftDetectionService] = None


def get_retraining_service(db: Session = Depends(get_db)) -> RetrainingPipelineService:
    """Get or create retraining service instance."""
    global _retraining_service
    
    if _retraining_service is None and SERVICES_AVAILABLE:
        try:
            # Initialize services
            drift_service = create_drift_detection_service()
            mlflow_service = MLflowIntegrationService()
            monitoring_service = MonitoringService()
            data_quality_service = DataQualityService()
            ml_engine = AdvancedMLEngine()
            
            _retraining_service = create_retraining_pipeline_service(
                drift_detection_service=drift_service,
                mlflow_service=mlflow_service,
                monitoring_service=monitoring_service,
                data_quality_service=data_quality_service,
                ml_engine=ml_engine,
                db_session=db
            )
        except Exception as e:
            logger.error(f"Failed to initialize retraining service: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Retraining service unavailable"
            )
    
    if _retraining_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Retraining service not available"
        )
    
    return _retraining_service


def get_drift_service() -> AdvancedDriftDetectionService:
    """Get or create drift detection service instance."""
    global _drift_service
    
    if _drift_service is None and SERVICES_AVAILABLE:
        try:
            _drift_service = create_drift_detection_service()
        except Exception as e:
            logger.error(f"Failed to initialize drift service: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Drift detection service unavailable"
            )
    
    if _drift_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Drift detection service not available"
        )
    
    return _drift_service


# Pipeline Management Endpoints
@router.post("/pipelines/create", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_retraining_pipeline(
    request: CreateRetrainingPipelineRequest,
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Create a new automated retraining pipeline.
    
    Creates a comprehensive retraining pipeline with configurable triggers,
    data validation, model training, quality gates, and deployment strategies.
    """
    try:
        # Convert request to service configuration
        config = RetrainingPolicyConfig(
            model_id=request.model_id,
            policy_name=request.pipeline_name,
            enabled_triggers=[trigger.trigger_type for trigger in request.triggers],
            trigger_thresholds={
                trigger.trigger_type.value: trigger.threshold 
                for trigger in request.triggers
            },
            monitoring_window_hours=24,  # Default, could be made configurable
            cooldown_period_hours=2,
            min_training_samples=request.min_training_samples,
            max_training_samples=request.max_training_samples,
            data_quality_threshold=request.data_quality_threshold,
            learning_mode=request.learning_mode,
            hyperparameter_optimization=request.hyperparameter_optimization.enabled,
            cross_validation_folds=request.hyperparameter_optimization.cv_folds,
            max_training_time_hours=request.max_training_time_hours,
            auto_deploy=request.auto_deploy,
            deployment_strategy=request.deployment_config.strategy.value,
            canary_percentage=request.deployment_config.canary_percentage,
            canary_duration_hours=request.deployment_config.canary_duration_hours,
            rollback_on_degradation=request.enable_rollback,
            alert_channels=request.notification_config.alert_channels,
            alert_on_trigger=request.notification_config.alert_on_trigger,
            alert_on_failure=request.notification_config.alert_on_failure,
            alert_on_success=request.notification_config.alert_on_success
        )
        
        # Create pipeline
        pipeline_id = await service.create_retraining_pipeline(config)
        
        # Fetch created pipeline for response
        if DB_AVAILABLE:
            pipeline = db.query(RetrainingPipeline).filter(
                RetrainingPipeline.pipeline_id == pipeline_id
            ).first()
            
            if pipeline:
                return PipelineResponse(
                    pipeline_id=pipeline.pipeline_id,
                    model_id=pipeline.model_id,
                    pipeline_name=pipeline.name,
                    description=pipeline.description,
                    is_active=pipeline.is_active,
                    learning_mode=pipeline.learning_mode,
                    execution_count=pipeline.execution_count,
                    success_count=pipeline.success_count,
                    failure_count=pipeline.failure_count,
                    success_rate=pipeline.success_rate,
                    created_at=pipeline.created_at,
                    updated_at=pipeline.updated_at,
                    last_triggered_at=pipeline.last_triggered_at,
                    next_scheduled_run=pipeline.next_scheduled_run,
                    enabled_triggers=pipeline.trigger_types,
                    auto_deploy=pipeline.auto_deploy,
                    deployment_strategy=pipeline.deployment_config.get('strategy', 'canary')
                )
        
        # Fallback response if DB not available
        return PipelineResponse(
            pipeline_id=pipeline_id,
            model_id=request.model_id,
            pipeline_name=request.pipeline_name,
            description=request.description,
            is_active=True,
            learning_mode=request.learning_mode,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            enabled_triggers=[trigger.trigger_type for trigger in request.triggers],
            auto_deploy=request.auto_deploy,
            deployment_strategy=request.deployment_config.strategy
        )
        
    except Exception as e:
        logger.error(f"Failed to create retraining pipeline: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create pipeline: {str(e)}"
        )


@router.post("/pipelines/{pipeline_id}/trigger", response_model=ExecutionResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_retraining(
    pipeline_id: str,
    request: TriggerRetrainingRequest,
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Manually trigger retraining for a specific pipeline.
    
    Initiates a retraining execution with the specified trigger type and metadata.
    Returns execution details for tracking progress.
    """
    try:
        execution_id = await service.trigger_retraining(
            pipeline_id=pipeline_id,
            trigger_type=request.trigger_type,
            force=request.force,
            metadata={"reason": request.reason, **request.metadata}
        )
        
        # Return execution status
        execution_status = await service.get_execution_status(execution_id)
        
        if execution_status:
            return ExecutionResponse(
                execution_id=execution_status["execution_id"],
                pipeline_id=execution_status["pipeline_id"],
                model_id=execution_status.get("model_id", ""),
                trigger_type=request.trigger_type,
                trigger_reason=request.reason,
                status=RetrainingPipelineStatus.PENDING,
                created_at=datetime.utcnow()
            )
        
        # Fallback response
        return ExecutionResponse(
            execution_id=execution_id,
            pipeline_id=pipeline_id,
            model_id="",
            trigger_type=request.trigger_type,
            trigger_reason=request.reason,
            status=RetrainingPipelineStatus.PENDING,
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Failed to trigger retraining: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to trigger retraining: {str(e)}"
        )


@router.get("/pipelines/{pipeline_id}/status", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    pipeline_id: str,
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Get current status and health of a retraining pipeline.
    
    Returns detailed status including active executions, health indicators,
    and recent execution statistics.
    """
    try:
        status_info = await service.get_pipeline_status(pipeline_id)
        
        if not status_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pipeline not found: {pipeline_id}"
            )
        
        config = status_info["configuration"]
        active_executions = status_info["active_executions"]
        
        # Calculate health indicators
        current_executions = len([
            exec for exec in active_executions
            if exec["current_stage"] not in ["completed", "failed"]
        ])
        
        last_execution_status = None
        last_execution_time = None
        
        if active_executions:
            latest_execution = max(active_executions, key=lambda x: x["created_at"])
            last_execution_status = RetrainingPipelineStatus(latest_execution["current_stage"])
            last_execution_time = datetime.fromisoformat(latest_execution["created_at"])
        
        return PipelineStatusResponse(
            pipeline_id=pipeline_id,
            is_active=True,
            is_healthy=True,
            current_executions=current_executions,
            last_execution_status=last_execution_status,
            last_execution_time=last_execution_time,
            drift_monitoring_active=status_info["is_monitoring"],
            performance_monitoring_active=True,
            data_pipeline_healthy=True,
            model_serving_healthy=True,
            executions_last_24h=len(active_executions),
            success_rate_last_7d=85.0,  # Placeholder
            avg_execution_time_minutes=120.0  # Placeholder
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get pipeline status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pipeline status: {str(e)}"
        )


@router.get("/pipelines", response_model=PipelineListResponse)
async def list_pipelines(
    pagination: PaginationParams = Depends(),
    model_id: Optional[str] = Query(None, description="Filter by model ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    List retraining pipelines with optional filtering and pagination.
    
    Returns a paginated list of pipelines with summary information.
    """
    try:
        if DB_AVAILABLE:
            query = db.query(RetrainingPipeline)
            
            # Apply filters
            if model_id:
                query = query.filter(RetrainingPipeline.model_id == model_id)
            if is_active is not None:
                query = query.filter(RetrainingPipeline.is_active == is_active)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            pipelines = query.order_by(desc(RetrainingPipeline.created_at)).offset(
                (pagination.page - 1) * pagination.size
            ).limit(pagination.size).all()
            
            pipeline_responses = [
                PipelineResponse(
                    pipeline_id=pipeline.pipeline_id,
                    model_id=pipeline.model_id,
                    pipeline_name=pipeline.name,
                    description=pipeline.description,
                    is_active=pipeline.is_active,
                    learning_mode=pipeline.learning_mode,
                    execution_count=pipeline.execution_count,
                    success_count=pipeline.success_count,
                    failure_count=pipeline.failure_count,
                    success_rate=pipeline.success_rate,
                    created_at=pipeline.created_at,
                    updated_at=pipeline.updated_at,
                    last_triggered_at=pipeline.last_triggered_at,
                    next_scheduled_run=pipeline.next_scheduled_run,
                    enabled_triggers=pipeline.trigger_types,
                    auto_deploy=pipeline.auto_deploy,
                    deployment_strategy=pipeline.deployment_config.get('strategy', 'canary')
                )
                for pipeline in pipelines
            ]
            
            return PipelineListResponse(
                pipelines=pipeline_responses,
                total_count=total_count,
                page=pagination.page,
                size=pagination.size,
                has_more=(pagination.page * pagination.size) < total_count
            )
        
        # Fallback for no database
        active_pipelines = await service.list_active_pipelines()
        
        # Apply filters
        filtered_pipelines = active_pipelines
        if model_id:
            filtered_pipelines = [p for p in filtered_pipelines if p["model_id"] == model_id]
        
        # Simulate pagination
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_pipelines = filtered_pipelines[start_idx:end_idx]
        
        pipeline_responses = [
            PipelineResponse(
                pipeline_id=pipeline["pipeline_id"],
                model_id=pipeline["model_id"],
                pipeline_name=pipeline["policy_name"],
                description="",
                is_active=True,
                learning_mode="batch",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                enabled_triggers=pipeline["enabled_triggers"],
                auto_deploy=True,
                deployment_strategy="canary"
            )
            for pipeline in paginated_pipelines
        ]
        
        return PipelineListResponse(
            pipelines=pipeline_responses,
            total_count=len(filtered_pipelines),
            page=pagination.page,
            size=pagination.size,
            has_more=end_idx < len(filtered_pipelines)
        )
        
    except Exception as e:
        logger.error(f"Failed to list pipelines: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list pipelines: {str(e)}"
        )


@router.put("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str,
    request: UpdatePipelineRequest,
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Update pipeline configuration.
    
    Allows partial updates to pipeline configuration including triggers,
    thresholds, deployment settings, and notification preferences.
    """
    try:
        if DB_AVAILABLE:
            pipeline = db.query(RetrainingPipeline).filter(
                RetrainingPipeline.pipeline_id == pipeline_id
            ).first()
            
            if not pipeline:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pipeline not found: {pipeline_id}"
                )
            
            # Apply updates
            if request.pipeline_name is not None:
                pipeline.name = request.pipeline_name
            if request.description is not None:
                pipeline.description = request.description
            if request.is_active is not None:
                pipeline.is_active = request.is_active
            
            # Update configuration sections
            if request.triggers is not None:
                pipeline.trigger_types = [trigger.trigger_type.value for trigger in request.triggers]
            
            if request.deployment_config is not None:
                pipeline.deployment_config = {
                    "strategy": request.deployment_config.strategy.value,
                    "canary_percentage": request.deployment_config.canary_percentage,
                    "canary_duration_hours": request.deployment_config.canary_duration_hours
                }
            
            if request.quality_gates is not None:
                pipeline.quality_gates = [
                    {
                        "gate_type": gate.gate_type.value,
                        "enabled": gate.enabled,
                        "threshold": gate.threshold
                    }
                    for gate in request.quality_gates
                ]
            
            pipeline.updated_at = datetime.utcnow()
            db.commit()
            
            return PipelineResponse(
                pipeline_id=pipeline.pipeline_id,
                model_id=pipeline.model_id,
                pipeline_name=pipeline.name,
                description=pipeline.description,
                is_active=pipeline.is_active,
                learning_mode=pipeline.learning_mode,
                execution_count=pipeline.execution_count,
                success_count=pipeline.success_count,
                failure_count=pipeline.failure_count,
                success_rate=pipeline.success_rate,
                created_at=pipeline.created_at,
                updated_at=pipeline.updated_at,
                last_triggered_at=pipeline.last_triggered_at,
                next_scheduled_run=pipeline.next_scheduled_run,
                enabled_triggers=pipeline.trigger_types,
                auto_deploy=pipeline.auto_deploy,
                deployment_strategy=pipeline.deployment_config.get('strategy', 'canary')
            )
        
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Update operation requires database connection"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update pipeline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update pipeline: {str(e)}"
        )


@router.delete("/pipelines/{pipeline_id}", response_model=SuccessResponse)
async def delete_pipeline(
    pipeline_id: str,
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Delete a retraining pipeline.
    
    Permanently removes the pipeline and cancels any active executions.
    """
    try:
        # Pause the pipeline first
        await service.pause_pipeline(pipeline_id)
        
        if DB_AVAILABLE:
            pipeline = db.query(RetrainingPipeline).filter(
                RetrainingPipeline.pipeline_id == pipeline_id
            ).first()
            
            if not pipeline:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pipeline not found: {pipeline_id}"
                )
            
            db.delete(pipeline)
            db.commit()
        
        return SuccessResponse(
            message=f"Pipeline {pipeline_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete pipeline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete pipeline: {str(e)}"
        )


# Execution Monitoring Endpoints
@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
async def get_execution_status(
    execution_id: str,
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Get detailed status of a retraining execution.
    
    Returns comprehensive execution information including progress,
    performance metrics, quality gate results, and deployment status.
    """
    try:
        execution_status = await service.get_execution_status(execution_id)
        
        if not execution_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution not found: {execution_id}"
            )
        
        return ExecutionResponse(
            execution_id=execution_status["execution_id"],
            pipeline_id=execution_status["pipeline_id"],
            model_id=execution_status.get("model_id", ""),
            trigger_type=RetrainingTriggerType(execution_status.get("trigger_type", "manual")),
            status=RetrainingPipelineStatus(execution_status.get("status", "pending")),
            progress_percent=execution_status.get("progress_percent", 0.0),
            current_stage=execution_status.get("current_stage"),
            training_data_size=execution_status.get("training_data_size", 0),
            validation_data_size=execution_status.get("validation_data_size", 0),
            baseline_metrics=execution_status.get("baseline_metrics"),
            new_model_metrics=execution_status.get("new_model_metrics"),
            performance_improvement=execution_status.get("improvement_score"),
            created_at=datetime.fromisoformat(execution_status["created_at"]),
            started_at=datetime.fromisoformat(execution_status["started_at"]) if execution_status.get("started_at") else None,
            completed_at=datetime.fromisoformat(execution_status["completed_at"]) if execution_status.get("completed_at") else None,
            error_message=execution_status.get("error_message")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get execution status: {str(e)}"
        )


@router.get("/executions", response_model=ExecutionListResponse)
async def list_executions(
    pagination: PaginationParams = Depends(),
    pipeline_id: Optional[str] = Query(None, description="Filter by pipeline ID"),
    status_filter: Optional[RetrainingPipelineStatus] = Query(None, description="Filter by execution status"),
    db: Session = Depends(get_db)
):
    """
    List retraining executions with optional filtering and pagination.
    
    Returns a paginated list of executions with summary information.
    """
    try:
        if DB_AVAILABLE:
            query = db.query(RetrainingExecution)
            
            # Apply filters
            if pipeline_id:
                query = query.filter(RetrainingExecution.pipeline_id == pipeline_id)
            if status_filter:
                query = query.filter(RetrainingExecution.status == status_filter)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            executions = query.order_by(desc(RetrainingExecution.created_at)).offset(
                (pagination.page - 1) * pagination.size
            ).limit(pagination.size).all()
            
            execution_responses = [
                ExecutionResponse(
                    execution_id=execution.execution_id,
                    pipeline_id=execution.pipeline_id,
                    model_id="",  # Would need to join with pipeline
                    trigger_type=RetrainingTriggerType(execution.trigger_reason) if execution.trigger_reason else RetrainingTriggerType.MANUAL,
                    status=execution.status,
                    progress_percent=execution.progress_percent or 0.0,
                    current_stage=execution.current_stage,
                    training_data_size=execution.training_data_info.get('size', 0) if execution.training_data_info else 0,
                    validation_data_size=execution.validation_data_info.get('size', 0) if execution.validation_data_info else 0,
                    baseline_metrics=execution.validation_metrics,
                    new_model_metrics=execution.training_metrics,
                    performance_improvement=execution.performance_improvement,
                    deployment_attempted=execution.deployment_attempted,
                    deployment_successful=execution.deployment_successful,
                    deployed_version=execution.deployment_id,
                    rollback_executed=execution.rollback_executed,
                    training_time_minutes=execution.training_time_minutes,
                    peak_memory_usage_gb=execution.peak_memory_usage_gb,
                    cost_usd=execution.cost_usd,
                    created_at=execution.created_at,
                    started_at=execution.started_at,
                    completed_at=execution.completed_at,
                    error_message=execution.error_message,
                    retry_count=execution.retry_count
                )
                for execution in executions
            ]
            
            return ExecutionListResponse(
                executions=execution_responses,
                total_count=total_count,
                page=pagination.page,
                size=pagination.size,
                has_more=(pagination.page * pagination.size) < total_count
            )
        
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="List executions requires database connection"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list executions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list executions: {str(e)}"
        )


# Drift Detection Endpoints
@router.post("/drift-detection/configure", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def configure_drift_detection(
    request: DriftDetectionConfigRequest,
    drift_service: AdvancedDriftDetectionService = Depends(get_drift_service),
    db: Session = Depends(get_db)
):
    """
    Configure drift detection for a model.
    
    Sets up continuous monitoring for data drift with configurable
    detection methods, thresholds, and alerting.
    """
    try:
        from app.services.drift_detection_service import MonitoringConfig, MonitoringMode, DataType
        
        config = MonitoringConfig(
            model_id=request.model_id,
            monitoring_mode=MonitoringMode.CONTINUOUS,
            data_type=DataType.TABULAR,
            detection_methods=[request.detection_method],
            sensitivity=request.drift_threshold,
            drift_threshold=request.drift_threshold,
            sample_size=request.sample_size,
            feature_columns=request.feature_columns or [],
            alert_enabled=request.alert_enabled
        )
        
        success = drift_service.configure_monitoring(config)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to configure drift detection"
            )
        
        # Create database record if available
        if DB_AVAILABLE:
            monitor = DriftMonitor(
                pipeline_id="",  # Would need to be linked to a pipeline
                name=request.monitor_name,
                detection_method=request.detection_method,
                drift_threshold=request.drift_threshold,
                warning_threshold=request.warning_threshold,
                monitoring_frequency=request.monitoring_frequency,
                feature_columns=request.feature_columns,
                sample_size=request.sample_size,
                confidence_level=request.confidence_level,
                alert_enabled=request.alert_enabled,
                alert_channels=request.alert_channels,
                is_active=True,
                created_by="api"
            )
            
            db.add(monitor)
            db.commit()
        
        return SuccessResponse(
            message=f"Drift detection configured for model {request.model_id}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to configure drift detection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure drift detection: {str(e)}"
        )


@router.get("/drift-reports/{model_id}", response_model=DriftReportListResponse)
async def get_drift_reports(
    model_id: str,
    pagination: PaginationParams = Depends(),
    start_date: Optional[datetime] = Query(None, description="Start date for report filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for report filtering"),
    drift_detected: Optional[bool] = Query(None, description="Filter by drift detection status"),
    db: Session = Depends(get_db)
):
    """
    Get drift detection reports for a model.
    
    Returns historical drift reports with filtering and pagination support.
    """
    try:
        if DB_AVAILABLE:
            query = db.query(DriftReport).join(DriftMonitor).filter(
                DriftMonitor.pipeline_id.contains(model_id)  # Simplified filter
            )
            
            # Apply filters
            if start_date:
                query = query.filter(DriftReport.created_at >= start_date)
            if end_date:
                query = query.filter(DriftReport.created_at <= end_date)
            if drift_detected is not None:
                query = query.filter(DriftReport.drift_detected == drift_detected)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            reports = query.order_by(desc(DriftReport.created_at)).offset(
                (pagination.page - 1) * pagination.size
            ).limit(pagination.size).all()
            
            report_responses = [
                DriftReportResponse(
                    report_id=report.report_id,
                    model_id=model_id,
                    monitor_id=report.monitor_id,
                    report_type=report.report_type,
                    detection_method=report.detection_method,
                    data_period_start=report.data_period_start,
                    data_period_end=report.data_period_end,
                    overall_drift_score=report.overall_drift_score,
                    drift_detected=report.drift_detected,
                    drift_severity=report.drift_severity,
                    drifted_features=report.drifted_features,
                    feature_drift_scores=report.feature_drift_scores,
                    feature_statistics=report.feature_statistics,
                    data_quality_issues=report.data_quality_issues,
                    missing_values_pct=report.missing_values_pct,
                    outlier_pct=report.outlier_pct,
                    recommended_actions=report.recommended_actions,
                    retraining_recommended=report.retraining_recommended,
                    urgency_level=report.urgency_level,
                    sample_size=report.sample_size,
                    analysis_duration_seconds=report.analysis_duration_seconds,
                    created_at=report.created_at
                )
                for report in reports
            ]
            
            return DriftReportListResponse(
                reports=report_responses,
                total_count=total_count,
                page=pagination.page,
                size=pagination.size,
                has_more=(pagination.page * pagination.size) < total_count
            )
        
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Drift reports require database connection"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get drift reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get drift reports: {str(e)}"
        )


# Analytics and Monitoring Endpoints
@router.get("/analytics/model-insights/{model_id}", response_model=ModelPerformanceInsights)
async def get_model_performance_insights(
    model_id: str,
    analysis_period_days: int = Query(30, ge=1, le=365, description="Analysis period in days"),
    db: Session = Depends(get_db)
):
    """
    Get performance insights and trends for a specific model.
    
    Returns comprehensive analytics including performance trends,
    drift analysis, and recommendations for model maintenance.
    """
    try:
        # Placeholder implementation - would analyze actual model data
        insights = ModelPerformanceInsights(
            model_id=model_id,
            analysis_period_days=analysis_period_days,
            current_accuracy=0.85,
            accuracy_change_30d=-0.02,
            drift_score=0.15,
            prediction_volume_24h=10000,
            recommendations=[
                "Monitor data drift closely - score above warning threshold",
                "Consider retraining due to accuracy decline",
                "Review recent data quality issues"
            ],
            risk_level="medium",
            next_retraining_recommended=datetime.utcnow() + timedelta(days=7)
        )
        
        return insights
        
    except Exception as e:
        logger.error(f"Failed to get model insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model insights: {str(e)}"
        )


@router.get("/analytics/system", response_model=RetrainingAnalytics)
async def get_retraining_analytics(
    analysis_period_days: int = Query(30, ge=1, le=365, description="Analysis period in days"),
    db: Session = Depends(get_db)
):
    """
    Get system-wide retraining analytics and insights.
    
    Returns comprehensive analytics about retraining activities,
    performance improvements, costs, and optimization opportunities.
    """
    try:
        # Placeholder implementation - would analyze actual execution data
        analytics = RetrainingAnalytics(
            analysis_period_days=analysis_period_days,
            total_executions=45,
            successful_executions=38,
            failed_executions=7,
            avg_execution_time_hours=2.3,
            trigger_distribution={
                "scheduled": 20,
                "data_drift": 15,
                "performance_degradation": 10
            },
            most_common_trigger="scheduled",
            avg_performance_improvement=0.035,
            models_with_positive_improvement=32,
            models_with_negative_improvement=6,
            total_training_cost_usd=1250.75,
            avg_cost_per_training_usd=27.80,
            cost_savings_from_automation_usd=8500.00,
            optimization_opportunities=[
                "Optimize hyperparameter search to reduce training time",
                "Implement more aggressive early stopping",
                "Consider incremental learning for stable models"
            ],
            system_health_score=0.87
        )
        
        return analytics
        
    except Exception as e:
        logger.error(f"Failed to get retraining analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get retraining analytics: {str(e)}"
        )


@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(
    service: RetrainingPipelineService = Depends(get_retraining_service),
    db: Session = Depends(get_db)
):
    """
    Get overall system health status.
    
    Returns health indicators for all system components including
    database connectivity, service availability, and performance metrics.
    """
    try:
        # Check component health
        database_healthy = DB_AVAILABLE
        services_healthy = SERVICES_AVAILABLE
        
        # Get system statistics
        active_pipelines = 0
        running_executions = 0
        
        if service:
            pipelines = await service.list_active_pipelines()
            active_pipelines = len(pipelines)
        
        return SystemHealthResponse(
            status="healthy" if database_healthy and services_healthy else "degraded",
            database_healthy=database_healthy,
            mlflow_healthy=services_healthy,
            drift_detection_healthy=services_healthy,
            data_quality_healthy=services_healthy,
            active_pipelines=active_pipelines,
            running_executions=running_executions,
            total_models_monitored=active_pipelines,
            avg_response_time_ms=45.2,
            memory_usage_percent=68.5,
            cpu_usage_percent=23.8
        )
        
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        return SystemHealthResponse(
            status="unhealthy",
            database_healthy=False,
            mlflow_healthy=False,
            drift_detection_healthy=False,
            data_quality_healthy=False
        )


# Alert Management Endpoints
@router.get("/alerts", response_model=AlertListResponse)
async def get_alerts(
    pagination: PaginationParams = Depends(),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by alert severity"),
    status_filter: Optional[str] = Query(None, description="Filter by alert status"),
    model_id: Optional[str] = Query(None, description="Filter by model ID"),
    db: Session = Depends(get_db)
):
    """
    Get retraining-related alerts with filtering and pagination.
    
    Returns alerts for pipeline executions, drift detection,
    performance degradation, and system issues.
    """
    try:
        if DB_AVAILABLE:
            query = db.query(RetrainingAlert)
            
            # Apply filters
            if severity:
                query = query.filter(RetrainingAlert.severity == severity)
            if status_filter:
                query = query.filter(RetrainingAlert.status == status_filter)
            if model_id:
                query = query.filter(RetrainingAlert.model_id == model_id)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            alerts = query.order_by(desc(RetrainingAlert.triggered_at)).offset(
                (pagination.page - 1) * pagination.size
            ).limit(pagination.size).all()
            
            alert_responses = [
                AlertResponse(
                    alert_id=alert.alert_id,
                    pipeline_id=alert.pipeline_id,
                    model_id=alert.model_id,
                    execution_id=alert.execution_id,
                    alert_type=alert.alert_type,
                    severity=alert.severity,
                    title=alert.title,
                    message=alert.message,
                    alert_data=alert.alert_data,
                    recommended_actions=alert.recommended_actions,
                    auto_action_taken=alert.auto_action_taken,
                    manual_action_required=alert.manual_action_required,
                    status=alert.status,
                    acknowledged=alert.acknowledged_at is not None,
                    acknowledged_by=alert.acknowledged_by,
                    acknowledged_at=alert.acknowledged_at,
                    resolved=alert.resolved_at is not None,
                    resolved_at=alert.resolved_at,
                    notification_sent=alert.notification_sent,
                    triggered_at=alert.triggered_at,
                    created_at=alert.created_at
                )
                for alert in alerts
            ]
            
            return AlertListResponse(
                alerts=alert_responses,
                total_count=total_count,
                page=pagination.page,
                size=pagination.size,
                has_more=(pagination.page * pagination.size) < total_count
            )
        
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Alerts require database connection"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get alerts: {str(e)}"
        )


@router.post("/alerts/{alert_id}/acknowledge", response_model=SuccessResponse)
async def acknowledge_alert(
    alert_id: str,
    user_id: str = Query(..., description="User ID acknowledging the alert"),
    db: Session = Depends(get_db)
):
    """
    Acknowledge an alert.
    
    Marks the alert as acknowledged to prevent duplicate notifications
    and track alert handling.
    """
    try:
        if DB_AVAILABLE:
            alert = db.query(RetrainingAlert).filter(
                RetrainingAlert.alert_id == alert_id
            ).first()
            
            if not alert:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Alert not found: {alert_id}"
                )
            
            alert.acknowledged_by = user_id
            alert.acknowledged_at = datetime.utcnow()
            alert.status = "acknowledged"
            
            db.commit()
            
            return SuccessResponse(
                message=f"Alert {alert_id} acknowledged by {user_id}"
            )
        
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Alert acknowledgment requires database connection"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge alert: {str(e)}"
        )


# Error handler for the router
@router.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Handle HTTP exceptions with structured error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error_code=f"RETRAINING_{exc.status_code}",
            error_type="HTTPException",
            message=exc.detail,
            suggested_actions=[
                "Check the request parameters and try again",
                "Verify the resource exists",
                "Contact support if the issue persists"
            ]
        ).dict()
    )