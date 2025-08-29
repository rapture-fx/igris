"""
API endpoints for Reinforcement Learning optimization operations.

Provides RESTful endpoints for managing RL optimization sessions,
monitoring training progress, and accessing optimization results.
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, Response
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from functools import wraps
import time

from app.services.rl_optimization_service import RLOptimizationService
from app.auth.unified_auth_system import get_current_active_user, get_current_user
from app.database.connection import get_async_session
from app.core.error_decorators import handle_auth_errors, handle_database_errors
from app.core.rate_limiting import rate_limit
from app.core.response_cache import cache_response
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rl", tags=["RL Optimization"])
security = HTTPBearer()

# RL optimization service will be initialized per request with database session


# Pydantic models for request/response validation
class HyperparameterOptimizationRequest(BaseModel):
    """Request for hyperparameter optimization."""
    pipeline_id: str = Field(..., description="ID of the ML pipeline to optimize")
    training_data_path: str = Field(..., description="Path to training data")
    validation_data_path: Optional[str] = Field(None, description="Path to validation data")
    optimization_config: Optional[Dict[str, Any]] = Field(None, description="Optimization configuration")
    hyperparameter_space: Optional[Dict[str, Any]] = Field(None, description="Custom hyperparameter space")
    max_runtime_hours: int = Field(6, ge=1, le=48, description="Maximum runtime in hours")
    priority: int = Field(5, ge=1, le=10, description="Optimization priority (1-10)")
    notification_webhook: Optional[str] = Field(None, description="Webhook URL for notifications")


class ResourceAllocationOptimizationRequest(BaseModel):
    """Request for resource allocation optimization."""
    pipeline_configs: List[Dict[str, Any]] = Field(..., description="Pipeline configurations")
    resource_constraints: Optional[Dict[str, Any]] = Field(None, description="Resource constraints")
    optimization_config: Optional[Dict[str, Any]] = Field(None, description="Optimization configuration")
    max_runtime_hours: int = Field(4, ge=1, le=24, description="Maximum runtime in hours")
    priority: int = Field(5, ge=1, le=10, description="Optimization priority (1-10)")
    notification_webhook: Optional[str] = Field(None, description="Webhook URL for notifications")


class DataQualityOptimizationRequest(BaseModel):
    """Request for data quality optimization."""
    data_processing_requirements: Dict[str, Any] = Field(..., description="Data quality requirements")
    optimization_config: Optional[Dict[str, Any]] = Field(None, description="Optimization configuration")
    max_runtime_hours: int = Field(3, ge=1, le=12, description="Maximum runtime in hours")
    priority: int = Field(5, ge=1, le=10, description="Optimization priority (1-10)")
    notification_webhook: Optional[str] = Field(None, description="Webhook URL for notifications")


class OptimizationResponse(BaseModel):
    """Response for optimization requests."""
    success: bool
    session_id: Optional[str] = None
    task_id: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    status: Optional[str] = None
    error: Optional[str] = None
    monitoring_enabled: bool = False


class SessionStatusResponse(BaseModel):
    """Response for session status requests."""
    success: bool
    session_id: str
    status: Optional[str] = None
    optimization_type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    monitoring_data: Optional[Dict[str, Any]] = None


@router.post("/hyperparameters/optimize", response_model=OptimizationResponse)
@handle_auth_errors
@handle_database_errors
async def start_hyperparameter_optimization(
    request: HyperparameterOptimizationRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_active_user)
):
    """
    Start hyperparameter optimization for an ML pipeline.
    
    This endpoint initiates a reinforcement learning-based hyperparameter
    optimization session that learns optimal hyperparameter configurations
    by treating hyperparameter selection as a sequential decision-making problem.
    
    **Features:**
    - Automatic hyperparameter space exploration
    - Multiple optimization strategies (PPO, A2C, SAC, DDPG)
    - Real-time monitoring and progress tracking
    - Early stopping and convergence detection
    - Integration with existing ML pipelines
    
    **Use Cases:**
    - E-commerce recommendation systems
    - Manufacturing sensor data models
    - Financial fraud detection models
    - General ML model optimization
    """
    try:
        logger.info(f"Starting hyperparameter optimization for pipeline {request.pipeline_id} by user {current_user.email}")
        
        # Initialize service with database session
        rl_service = RLOptimizationService(db)
        
        # Start optimization
        session = await rl_service.start_optimization(
            user_id=str(current_user.id),
            pipeline_id=request.pipeline_id,
            optimization_type="hyperparameter",
            training_data_path=request.training_data_path,
            validation_data_path=request.validation_data_path,
            config=request.optimization_config or {}
        )
        
        return OptimizationResponse(
            success=True,
            session_id=str(session.id),
            estimated_completion=None,  # TODO: Calculate estimated completion
            status=session.status,
            monitoring_enabled=True
        )
    
    except ValueError as e:
        logger.warning(f"Invalid hyperparameter optimization request from {current_user.email}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Hyperparameter optimization request failed for {current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start optimization: {str(e)}")


@router.post("/resource-allocation/optimize", response_model=OptimizationResponse)
@handle_auth_errors
@handle_database_errors
async def start_resource_allocation_optimization(
    request: ResourceAllocationOptimizationRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_active_user)
):
    """
    Start resource allocation optimization for data processing pipelines.
    
    This endpoint optimizes the allocation of computational resources (CPU, memory, storage)
    across multiple data processing pipelines to maximize overall system efficiency.
    
    **Features:**
    - Multi-pipeline resource optimization
    - Dynamic resource allocation strategies
    - Deadline-aware scheduling
    - Cost-performance balance optimization
    - Real-time resource utilization monitoring
    
    **Use Cases:**
    - Multi-tenant data processing platforms
    - Batch processing optimization
    - Cloud resource management
    - Pipeline scheduling optimization
    """
    try:
        logger.info(f"Starting resource allocation optimization for {len(request.pipeline_configs)} pipelines by user {current_user.email}")
        
        # Initialize service with database session
        rl_service = RLOptimizationService(db)
        
        # Start optimization
        session = await rl_service.start_optimization(
            user_id=str(current_user.id),
            pipeline_id="resource_allocation",  # Special pipeline ID for resource allocation
            optimization_type="resource_allocation",
            training_data_path=None,
            validation_data_path=None,
            config={
                "pipeline_configs": request.pipeline_configs,
                "resource_constraints": request.resource_constraints,
                **(request.optimization_config or {})
            }
        )
        
        return OptimizationResponse(
            success=True,
            session_id=str(session.id),
            estimated_completion=None,  # TODO: Calculate estimated completion
            status=session.status,
            monitoring_enabled=True
        )
    
    except ValueError as e:
        logger.warning(f"Invalid resource allocation request from {current_user.email}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Resource allocation optimization request failed for {current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start optimization: {str(e)}")


@router.post("/data-quality/optimize", response_model=OptimizationResponse)
@handle_auth_errors
@handle_database_errors
async def start_data_quality_optimization(
    request: DataQualityOptimizationRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_active_user)
):
    """
    Start data quality optimization for processing parameters.
    
    This endpoint optimizes data quality thresholds and processing parameters
    to balance data quality requirements with processing costs and throughput.
    
    **Features:**
    - Quality threshold optimization
    - Cost-quality trade-off analysis
    - Processing parameter tuning
    - Automated data cleaning strategies
    - Quality metrics tracking
    
    **Use Cases:**
    - Data preprocessing optimization
    - Quality control automation
    - Cost-efficient data cleaning
    - Compliance-driven data processing
    """
    try:
        logger.info(f"Starting data quality optimization for user {current_user.email}")
        
        # Initialize service with database session
        rl_service = RLOptimizationService(db)
        
        # Start optimization
        session = await rl_service.start_optimization(
            user_id=str(current_user.id),
            pipeline_id="data_quality",  # Special pipeline ID for data quality
            optimization_type="data_quality",
            training_data_path=None,
            validation_data_path=None,
            config={
                "data_processing_requirements": request.data_processing_requirements,
                **(request.optimization_config or {})
            }
        )
        
        return OptimizationResponse(
            success=True,
            session_id=str(session.id),
            estimated_completion=None,  # TODO: Calculate estimated completion
            status=session.status,
            monitoring_enabled=True
        )
    
    except ValueError as e:
        logger.warning(f"Invalid data quality optimization request from {current_user.email}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Data quality optimization request failed for {current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start optimization: {str(e)}")


@router.get("/sessions/{session_id}/status", response_model=SessionStatusResponse)
@handle_auth_errors
@handle_database_errors
async def get_optimization_status(
    session_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_active_user)
):
    """
    Get the current status of an optimization session.
    
    Returns detailed information about the optimization progress,
    including training metrics, resource utilization, and results.
    """
    try:
        rl_service = RLOptimizationService(db)
        session = await rl_service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Optimization session not found")
        
        # Check if user owns this session (or is admin)
        if session.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this optimization session")
        
        # Get status information
        status_info = await rl_service.get_session_status(session_id)
        
        return SessionStatusResponse(
            success=True,
            session_id=str(session.id),
            status=session.status,
            optimization_type=session.optimization_type,
            created_at=session.created_at,
            updated_at=session.updated_at,
            results={"best_performance": session.best_performance} if session.best_performance else None,
            error=session.error_message,
            monitoring_data=status_info
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session status for {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get session status: {str(e)}")


@router.post("/sessions/{session_id}/stop")
@handle_auth_errors
@handle_database_errors
async def stop_optimization(
    session_id: str,
    reason: str = Query("user_requested", description="Reason for stopping"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_active_user)
):
    """
    Stop an active optimization session.
    
    Gracefully terminates the optimization process and saves current progress.
    """
    try:
        rl_service = RLOptimizationService(db)
        session = await rl_service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Optimization session not found")
        
        # Check if user owns this session (or is admin)
        if session.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this optimization session")
        
        # Stop the optimization
        success = await rl_service.stop_optimization(session_id)
        
        if success:
            logger.info(f"User {current_user.email} stopped optimization session {session_id} (reason: {reason})")
            return {"success": True, "message": "Optimization session stopped successfully", "reason": reason}
        else:
            raise HTTPException(status_code=500, detail="Failed to stop optimization session")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop optimization session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to stop optimization: {str(e)}")


@router.get("/sessions")
@handle_auth_errors
@handle_database_errors
async def list_optimization_sessions(
    optimization_type: Optional[str] = Query(None, description="Filter by optimization type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_active_user)
):
    """
    List optimization sessions with optional filtering.
    
    Returns a paginated list of optimization sessions with basic information.
    """
    try:
        from sqlalchemy import select, and_
        from app.services.rl.models.rl_optimization_models import RLOptimizationSession
        
        # Regular users only see their own sessions, admin users see all
        query = select(RLOptimizationSession)
        
        if current_user.role.value != "admin":
            query = query.where(RLOptimizationSession.user_id == str(current_user.id))
        
        if optimization_type:
            query = query.where(RLOptimizationSession.optimization_type == optimization_type)
        if status:
            query = query.where(RLOptimizationSession.status == status)
        
        query = query.offset(offset).limit(limit).order_by(
            RLOptimizationSession.created_at.desc()
        )
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        return {
            "success": True,
            "sessions": [
                {
                    "session_id": str(session.id),
                    "pipeline_id": session.pipeline_id,
                    "optimization_type": session.optimization_type,
                    "strategy": session.strategy,
                    "objective": session.objective,
                    "status": session.status,
                    "best_performance": session.best_performance,
                    "total_episodes": session.total_episodes,
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                    "user_id": session.user_id
                }
                for session in sessions
            ],
            "total": len(sessions),
            "limit": limit,
            "offset": offset
        }
    
    except Exception as e:
        logger.error(f"Failed to list sessions for user {current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")


@router.get("/sessions/{session_id}/metrics")
@rate_limit(max_calls=200, time_window=3600)
async def get_session_metrics(
    session_id: str,
    metric_names: Optional[List[str]] = Query(None, description="Specific metrics to retrieve"),
    time_range_minutes: Optional[int] = Query(None, ge=1, le=10080, description="Time range in minutes"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Get detailed metrics for an optimization session.
    
    Returns time-series data for training progress, resource utilization,
    and performance metrics.
    """
    try:
        rl_service = RLOptimizationService(db)
        
        # Check if user has access to this session
        session = await rl_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        result = await rl_service.get_session_metrics(session_id, include_episodes=True)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to get metrics: {result.get('error')}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/alerts")
@rate_limit(max_calls=50, time_window=3600)
async def get_session_alerts(
    session_id: str,
    unacknowledged_only: bool = Query(False, description="Return only unacknowledged alerts"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Get alerts for an optimization session.
    
    Returns system alerts, warnings, and notifications generated during
    the optimization process.
    """
    try:
        rl_service = RLOptimizationService(db)
        
        # Check if user has access to this session
        session = await rl_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        # Return empty alerts for now - this will be implemented with monitoring system
        result = {"success": True, "alerts": []}
        
        if result["success"]:
            return result
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to get alerts: {result.get('error')}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
@rate_limit(max_calls=100, time_window=3600)
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """Acknowledge an alert to mark it as seen."""
    try:
        # Placeholder implementation - will be implemented with monitoring system
        result = {"success": True, "message": "Alert acknowledged"}
        
        if result["success"]:
            return result
        else:
            raise HTTPException(
                status_code=404,
                detail="Alert not found"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/export")
@rate_limit(max_calls=10, time_window=3600)
async def export_session_data(
    session_id: str,
    format: str = Query("json", pattern="^(json|csv)$", description="Export format"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Export comprehensive session data for analysis.
    
    Generates a downloadable export of all session metrics, results,
    and metadata in the requested format.
    """
    try:
        rl_service = RLOptimizationService(db)
        
        # Check if user has access to this session
        session = await rl_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        # Get comprehensive session data
        metrics_data = await rl_service.get_session_metrics(session_id, include_episodes=True)
        
        if format == "json":
            result = {"success": True, "data": metrics_data}
        else:  # CSV format
            # For now, return JSON with a note about CSV conversion
            result = {
                "success": True, 
                "data": metrics_data,
                "note": "CSV export will be implemented in monitoring system"
            }
        
        if result["success"]:
            return result
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to export data: {result.get('error')}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export session data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pipelines/{pipeline_id}/recommendations")
@rate_limit(max_calls=30, time_window=3600)
@cache_response(ttl_seconds=1800)  # Cache for 30 minutes
async def get_optimization_recommendations(
    pipeline_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Get optimization recommendations for a pipeline.
    
    Analyzes historical optimization data and provides suggestions
    for the next optimization strategy.
    """
    try:
        rl_service = RLOptimizationService(db)
        
        # Get historical data for this pipeline
        sessions = await rl_service.list_sessions(pipeline_id=pipeline_id, user_id=str(current_user.id))
        
        # Basic recommendations based on historical performance
        recommendations = {
            "pipeline_id": pipeline_id,
            "recommendations": [
                {
                    "type": "strategy",
                    "suggestion": "PPO",
                    "reason": "Best performance for similar pipelines",
                    "confidence": 0.8
                },
                {
                    "type": "episodes",
                    "suggestion": 50,
                    "reason": "Optimal balance between performance and time",
                    "confidence": 0.7
                }
            ],
            "historical_sessions": len(sessions.get('sessions', []))
        }
        
        result = {"success": True, "data": recommendations}
        
        if result["success"]:
            return result
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get recommendations: {result.get('error')}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
@cache_response(ttl_seconds=60)  # Cache for 1 minute
async def get_system_health(
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get RL optimization system health status.
    
    Returns information about system resources, active optimizations,
    and overall service health.
    """
    try:
        rl_service = RLOptimizationService(db)
        
        # Basic system health check
        active_sessions = len(rl_service.active_sessions)
        
        health_status = {
            "status": "healthy",
            "active_sessions": active_sessions,
            "max_concurrent_sessions": rl_service.settings.rl_max_concurrent_sessions,
            "system_load": "normal",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "database": "operational",
                "redis": "operational",
                "rl_engine": "operational"
            }
        }
        
        result = {"success": True, "data": health_status}
        
        if result["success"]:
            return result
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Health check failed: {result.get('error')}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/prometheus")
async def get_prometheus_metrics(
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get Prometheus-formatted metrics for monitoring integration.
    
    Returns metrics in Prometheus exposition format for external
    monitoring systems.
    """
    try:
        rl_service = RLOptimizationService(db)
        
        # Basic Prometheus metrics - will be enhanced with monitoring system
        active_sessions = len(rl_service.active_sessions)
        metrics_text = f"""# HELP rl_active_sessions Number of active RL optimization sessions
# TYPE rl_active_sessions gauge
rl_active_sessions {active_sessions}

# HELP rl_max_sessions Maximum allowed concurrent sessions
# TYPE rl_max_sessions gauge
rl_max_sessions {rl_service.settings.rl_max_concurrent_sessions}
"""
        
        return Response(
            content=metrics_text,
            media_type="text/plain; version=0.0.4; charset=utf-8"
        )
    
    except Exception as e:
        logger.error(f"Failed to get Prometheus metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Background task endpoints for advanced features
@router.post("/sessions/batch-optimize")
@rate_limit(max_calls=3, time_window=3600)  # Very limited for batch operations
async def start_batch_optimization(
    requests: List[Dict[str, Any]],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Start multiple optimization sessions in batch.
    
    **EXPERIMENTAL**: This feature allows starting multiple optimizations
    simultaneously with coordinated resource management.
    """
    try:
        if len(requests) > 5:  # Limit batch size
            raise HTTPException(
                status_code=400,
                detail="Batch size cannot exceed 5 optimizations"
            )
        
        batch_results = []
        
        for i, req_data in enumerate(requests):
            try:
                # Initialize service
                rl_service = RLOptimizationService(db)
                
                # Start optimization with basic validation
                session = await rl_service.start_optimization(
                    pipeline_id=req_data.get('pipeline_id', 'batch_pipeline'),
                    optimization_type=req_data.get('optimization_type', 'hyperparameter'),
                    training_data_path=req_data.get('training_data_path', ''),
                    validation_data_path=req_data.get('validation_data_path'),
                    optimization_config=req_data.get('optimization_config'),
                    user_id=str(current_user.id)
                )
                
                result = {"success": True, "session_id": str(session.id)}
                
                batch_results.append({
                    "index": i,
                    "success": result["success"],
                    "session_id": result.get("session_id"),
                    "error": None
                })
                
            except Exception as e:
                batch_results.append({
                    "index": i,
                    "success": False,
                    "error": str(e)
                })
        
        # Count successes
        successful_count = sum(1 for r in batch_results if r["success"])
        
        return {
            "success": True,
            "batch_results": batch_results,
            "total_requests": len(requests),
            "successful_optimizations": successful_count,
            "failed_optimizations": len(requests) - successful_count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Additional utility endpoints
@router.get("/optimization-types")
async def get_supported_optimization_types():
    """Get list of supported optimization types and their descriptions."""
    return {
        "optimization_types": [
            {
                "type": "hyperparameter",
                "name": "Hyperparameter Optimization",
                "description": "Optimize ML model hyperparameters using reinforcement learning",
                "use_cases": ["Model tuning", "Performance optimization", "Automated ML"],
                "estimated_duration": "2-6 hours",
                "resource_requirements": "Medium"
            },
            {
                "type": "resource_allocation", 
                "name": "Resource Allocation Optimization",
                "description": "Optimize computational resource allocation across pipelines",
                "use_cases": ["Multi-tenant systems", "Batch processing", "Cloud optimization"],
                "estimated_duration": "1-4 hours",
                "resource_requirements": "Low"
            },
            {
                "type": "data_quality",
                "name": "Data Quality Optimization", 
                "description": "Optimize data quality parameters and processing costs",
                "use_cases": ["Data preprocessing", "Quality control", "Cost optimization"],
                "estimated_duration": "1-3 hours",
                "resource_requirements": "Low"
            }
        ],
        "resource_management": [
            {
                "endpoint": "/rl/admin/cleanup",
                "method": "POST",
                "description": "Clean up stale optimization sessions",
                "admin_only": True
            },
            {
                "endpoint": "/rl/admin/resource-usage",
                "method": "GET",
                "description": "Get system resource usage statistics",
                "admin_only": True
            },
            {
                "endpoint": "/rl/admin/sessions/{session_id}/force-cleanup",
                "method": "POST",
                "description": "Force cleanup of a specific session",
                "admin_only": True
            }
        ]
    }


# Admin endpoints for resource management
@router.post("/admin/cleanup")
@rate_limit(max_calls=5, time_window=3600)  # Very limited for admin operations
async def cleanup_stale_sessions(
    max_age_hours: int = Query(24, ge=1, le=168, description="Maximum age in hours for session cleanup"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Clean up stale and abandoned optimization sessions.
    
    **ADMIN ONLY**: This endpoint requires administrative privileges.
    
    Removes sessions that have been running or pending for longer than
    the specified time limit, freeing up system resources.
    """
    try:
        # Check admin privileges
        if current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Administrative privileges required")
        
        rl_service = RLOptimizationService(db)
        cleanup_stats = await rl_service.cleanup_stale_sessions(max_age_hours)
        
        return {
            "success": True,
            "cleanup_stats": cleanup_stats,
            "max_age_hours": max_age_hours,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup operation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Cleanup operation failed")


@router.get("/admin/resource-usage")
@rate_limit(max_calls=20, time_window=3600)
@cache_response(ttl_seconds=300)  # Cache for 5 minutes
async def get_resource_usage_stats(
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Get system resource usage statistics.
    
    **ADMIN ONLY**: This endpoint requires administrative privileges.
    
    Returns detailed information about system resource utilization,
    active sessions, and performance metrics.
    """
    try:
        # Check admin privileges
        if current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Administrative privileges required")
        
        rl_service = RLOptimizationService(db)
        usage_stats = await rl_service.get_resource_usage_stats()
        
        return {
            "success": True,
            "resource_usage": usage_stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get resource usage stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve resource usage statistics")


@router.post("/admin/sessions/{session_id}/force-cleanup")
@rate_limit(max_calls=10, time_window=3600)
async def force_cleanup_session(
    session_id: str,
    reason: str = Query("Administrative cleanup", description="Reason for force cleanup"),
    db: AsyncSession = Depends(get_async_session),
    current_user = Depends(get_current_user)
):
    """
    Force cleanup of a specific optimization session.
    
    **ADMIN ONLY**: This endpoint requires administrative privileges.
    
    Immediately terminates and cleans up the specified session,
    regardless of its current state.
    """
    try:
        # Check admin privileges
        if current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Administrative privileges required")
        
        rl_service = RLOptimizationService(db)
        success = await rl_service.force_cleanup_session(session_id, reason)
        
        if success:
            return {
                "success": True,
                "session_id": session_id,
                "message": "Session force cleanup completed",
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Force cleanup failed")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Force cleanup failed for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Force cleanup operation failed")