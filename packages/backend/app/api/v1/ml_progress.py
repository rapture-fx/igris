"""
ML/RL Progress Tracking API Endpoints
=====================================

REST API endpoints for monitoring and managing ML/RL operation progress,
providing comprehensive status information and real-time updates.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.auth.dependencies import get_current_user, get_current_active_user
from app.database.models import User
from app.services.ml_progress_tracker import (
    ml_progress_tracker, 
    OperationType, 
    OperationStatus, 
    Priority,
    ProgressMetrics
)
from app.services.ml_websocket_service import ml_websocket_manager
from app.services.ml_data_serializers import ml_data_serializer, DataType

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ml/progress", tags=["ML Progress Tracking"])


# Pydantic models for API requests/responses
class ProgressUpdateRequest(BaseModel):
    """Request to update operation progress"""
    progress_percentage: Optional[float] = Field(None, ge=0, le=100)
    current_step: Optional[str] = None
    items_processed: Optional[int] = Field(None, ge=0)
    total_items: Optional[int] = Field(None, ge=0)
    loss_value: Optional[float] = None
    accuracy: Optional[float] = Field(None, ge=0, le=1)
    epoch: Optional[int] = Field(None, ge=0)
    episode: Optional[int] = Field(None, ge=0)
    cpu_usage: Optional[float] = Field(None, ge=0, le=100)
    memory_usage: Optional[float] = Field(None, ge=0, le=100)
    gpu_usage: Optional[float] = Field(None, ge=0, le=100)


class OperationResponse(BaseModel):
    """Response containing operation information"""
    operation_id: str
    operation_type: str
    status: str
    progress_percentage: float
    current_step: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    user_id: str
    model_name: Optional[str] = None
    error_message: Optional[str] = None


class OperationListResponse(BaseModel):
    """Response for operation listing"""
    operations: List[OperationResponse]
    total_count: int
    has_more: bool


class UserSummaryResponse(BaseModel):
    """Response for user operations summary"""
    total_operations: int
    active_operations: int
    completed_operations: int
    failed_operations: int
    status_breakdown: Dict[str, int]
    type_breakdown: Dict[str, int]


@router.get("/operations", response_model=OperationListResponse)
async def list_operations(
    operation_type: Optional[str] = Query(None, description="Filter by operation type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Number of operations to return"),
    offset: int = Query(0, ge=0, description="Number of operations to skip"),
    current_user: User = Depends(get_current_active_user)
):
    """
    List ML/RL operations with optional filtering
    
    Returns paginated list of operations for the current user with detailed
    progress information and status updates.
    """
    try:
        # Parse filter parameters
        op_type = OperationType(operation_type) if operation_type else None
        op_status = OperationStatus(status) if status else None
        
        # Get operations from tracker
        operations = await ml_progress_tracker.list_operations(
            user_id=str(current_user.id),
            operation_type=op_type,
            status=op_status,
            limit=limit + 1,  # Get one extra to check if there are more
            offset=offset
        )
        
        # Check if there are more operations
        has_more = len(operations) > limit
        if has_more:
            operations = operations[:limit]
        
        # Convert to response format
        operation_responses = []
        for op in operations:
            duration = None
            if op.started_at:
                end_time = op.completed_at or datetime.utcnow()
                duration = (end_time - op.started_at).total_seconds()
            
            operation_responses.append(OperationResponse(
                operation_id=op.operation_id,
                operation_type=op.operation_type.value,
                status=op.status.value,
                progress_percentage=op.progress_metrics.progress_percentage,
                current_step=op.progress_metrics.current_step,
                created_at=op.created_at.isoformat(),
                started_at=op.started_at.isoformat() if op.started_at else None,
                completed_at=op.completed_at.isoformat() if op.completed_at else None,
                duration_seconds=duration,
                user_id=op.user_id,
                model_name=op.model_name,
                error_message=op.error_message
            ))
        
        return OperationListResponse(
            operations=operation_responses,
            total_count=len(operation_responses),
            has_more=has_more
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")
    except Exception as e:
        logger.error(f"Error listing operations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list operations")


@router.get("/operations/{operation_id}")
async def get_operation_status(
    operation_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get detailed status information for a specific operation
    
    Returns comprehensive progress metrics, performance data, and
    operation metadata for real-time monitoring.
    """
    try:
        # Get operation context
        context = await ml_progress_tracker.get_operation_status(operation_id)
        if not context:
            raise HTTPException(status_code=404, detail="Operation not found")
        
        # Check ownership (admin can view all)
        if context.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this operation")
        
        # Get detailed metrics
        metrics = await ml_progress_tracker.get_operation_metrics(operation_id)
        
        # Serialize data for frontend
        serialized = ml_data_serializer.serialize_training_metrics(
            metrics=metrics.get("ml_metrics", {}),
            epoch=metrics.get("ml_metrics", {}).get("epoch", 0),
            loss_history=[],  # Would come from operation history
            validation_metrics={}
        )
        
        return {
            "success": True,
            "operation": metrics,
            "serialized_data": serialized.data,
            "last_updated": context.last_updated.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting operation status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get operation status")


@router.post("/operations/{operation_id}/progress")
async def update_operation_progress(
    operation_id: str,
    request: ProgressUpdateRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Update progress for an operation
    
    Allows updating progress metrics, performance data, and status
    information for ongoing ML/RL operations.
    """
    try:
        # Get operation context to verify ownership
        context = await ml_progress_tracker.get_operation_status(operation_id)
        if not context:
            raise HTTPException(status_code=404, detail="Operation not found")
        
        # Check ownership
        if context.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied to this operation")
        
        # Create progress metrics from request
        progress_metrics = ProgressMetrics(
            progress_percentage=request.progress_percentage or context.progress_metrics.progress_percentage,
            current_step=request.current_step or context.progress_metrics.current_step,
            items_processed=request.items_processed or context.progress_metrics.items_processed,
            total_items=request.total_items or context.progress_metrics.total_items,
            loss_value=request.loss_value,
            accuracy=request.accuracy,
            epoch=request.epoch,
            episode=request.episode,
            cpu_usage=request.cpu_usage,
            memory_usage=request.memory_usage,
            gpu_usage=request.gpu_usage,
        )
        
        # Update progress
        success = await ml_progress_tracker.update_progress(
            operation_id,
            progress_metrics=progress_metrics
        )
        
        if success:
            return {
                "success": True,
                "message": "Progress updated successfully",
                "operation_id": operation_id,
                "updated_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update progress")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update progress")


@router.post("/operations/{operation_id}/cancel")
async def cancel_operation(
    operation_id: str,
    reason: str = Query("User requested cancellation", description="Reason for cancellation"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancel a running operation
    
    Gracefully stops an ongoing ML/RL operation and updates its status
    to cancelled with the specified reason.
    """
    try:
        # Get operation context to verify ownership
        context = await ml_progress_tracker.get_operation_status(operation_id)
        if not context:
            raise HTTPException(status_code=404, detail="Operation not found")
        
        # Check ownership (admin can cancel any operation)
        if context.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this operation")
        
        # Cancel the operation
        success = await ml_progress_tracker.cancel_operation(operation_id, reason)
        
        if success:
            logger.info(f"User {current_user.email} cancelled operation {operation_id}: {reason}")
            return {
                "success": True,
                "message": "Operation cancelled successfully",
                "operation_id": operation_id,
                "reason": reason,
                "cancelled_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail="Operation cannot be cancelled (already finished)")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling operation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel operation")


@router.get("/summary", response_model=UserSummaryResponse)
async def get_operations_summary(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get summary statistics for user's operations
    
    Returns overview of operation counts, status breakdown, and
    type distribution for the current user.
    """
    try:
        summary = await ml_progress_tracker.get_user_operations_summary(str(current_user.id))
        
        return UserSummaryResponse(**summary)
        
    except Exception as e:
        logger.error(f"Error getting operations summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get operations summary")


@router.get("/types")
async def get_operation_types():
    """
    Get list of supported operation types
    
    Returns available operation types with descriptions and
    typical use cases for frontend operation creation forms.
    """
    operation_types = []
    for op_type in OperationType:
        # Map operation types to descriptions and use cases
        type_info = {
            "type": op_type.value,
            "display_name": op_type.value.replace("_", " ").title(),
            "description": _get_operation_description(op_type),
            "typical_duration": _get_typical_duration(op_type),
            "resource_requirements": _get_resource_requirements(op_type)
        }
        operation_types.append(type_info)
    
    return {
        "operation_types": operation_types,
        "supported_statuses": [status.value for status in OperationStatus],
        "priority_levels": [priority.value for priority in Priority]
    }


@router.websocket("/ws/{user_id}")
async def progress_websocket(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint for real-time progress updates
    
    Provides live updates for all ML/RL operations belonging to the user,
    including progress metrics, status changes, and completion notifications.
    """
    try:
        # Connect to WebSocket manager
        session_id = await ml_websocket_manager.connect(
            websocket=websocket,
            user_id=user_id,
            subscribed_events=[
                "training_progress",
                "training_completed",
                "rl_session_progress",
                "data_processing_progress",
                "task_started",
                "task_completed",
                "task_failed"
            ]
        )
        
        logger.info(f"WebSocket connected for progress updates: user={user_id}, session={session_id}")
        
        try:
            while True:
                # Handle incoming messages
                message = await websocket.receive_text()
                await ml_websocket_manager.handle_websocket_message(session_id, message)
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: user={user_id}, session={session_id}")
        finally:
            await ml_websocket_manager.disconnect(session_id)
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass


@router.get("/operations/{operation_id}/history")
async def get_operation_history(
    operation_id: str,
    limit: int = Query(100, ge=1, le=1000, description="Number of history entries"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get historical progress data for an operation
    
    Returns time-series data of progress updates, metrics evolution,
    and performance trends for detailed analysis and visualization.
    """
    try:
        # Verify operation exists and user has access
        context = await ml_progress_tracker.get_operation_status(operation_id)
        if not context:
            raise HTTPException(status_code=404, detail="Operation not found")
        
        if context.user_id != str(current_user.id) and current_user.role.value != "admin":
            raise HTTPException(status_code=403, detail="Access denied to this operation")
        
        # Get historical events from WebSocket manager
        from app.services.ml_websocket_service import MLEventType
        history_events = await ml_websocket_manager.get_session_events(
            session_id=operation_id,
            event_types=[
                MLEventType.TRAINING_PROGRESS,
                MLEventType.RL_SESSION_PROGRESS,
                MLEventType.DATA_PROCESSING_PROGRESS
            ],
            limit=limit
        )
        
        # Format history for frontend visualization
        formatted_history = []
        for event in history_events:
            formatted_history.append({
                "timestamp": event.get("timestamp"),
                "event_type": event.get("event_type"),
                "progress": event.get("progress", 0),
                "message": event.get("message", ""),
                "data": event.get("data", {})
            })
        
        return {
            "success": True,
            "operation_id": operation_id,
            "history": formatted_history,
            "total_entries": len(formatted_history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting operation history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get operation history")


# Helper functions
def _get_operation_description(op_type: OperationType) -> str:
    """Get description for operation type"""
    descriptions = {
        OperationType.MODEL_TRAINING: "Train machine learning models with various algorithms and parameters",
        OperationType.MODEL_INFERENCE: "Generate predictions using trained models on new data",
        OperationType.DATA_PROCESSING: "Process and transform data for machine learning workflows",
        OperationType.RL_OPTIMIZATION: "Optimize systems using reinforcement learning algorithms",
        OperationType.HYPERPARAMETER_TUNING: "Automatically optimize model hyperparameters",
        OperationType.DATA_QUALITY_ASSESSMENT: "Analyze data quality and identify issues",
        OperationType.DOCUMENT_PROCESSING: "Extract and process information from documents",
        OperationType.FEATURE_ENGINEERING: "Create and select features for model training",
        OperationType.MODEL_EVALUATION: "Evaluate model performance with various metrics",
        OperationType.BATCH_PREDICTION: "Generate predictions for large datasets in batches"
    }
    return descriptions.get(op_type, "Machine learning operation")


def _get_typical_duration(op_type: OperationType) -> str:
    """Get typical duration for operation type"""
    durations = {
        OperationType.MODEL_TRAINING: "30 minutes - 4 hours",
        OperationType.MODEL_INFERENCE: "1 minute - 30 minutes",
        OperationType.DATA_PROCESSING: "5 minutes - 2 hours",
        OperationType.RL_OPTIMIZATION: "1 hour - 8 hours",
        OperationType.HYPERPARAMETER_TUNING: "2 hours - 12 hours",
        OperationType.DATA_QUALITY_ASSESSMENT: "5 minutes - 1 hour",
        OperationType.DOCUMENT_PROCESSING: "10 minutes - 2 hours",
        OperationType.FEATURE_ENGINEERING: "15 minutes - 1 hour",
        OperationType.MODEL_EVALUATION: "5 minutes - 30 minutes",
        OperationType.BATCH_PREDICTION: "10 minutes - 3 hours"
    }
    return durations.get(op_type, "Variable duration")


def _get_resource_requirements(op_type: OperationType) -> str:
    """Get resource requirements for operation type"""
    requirements = {
        OperationType.MODEL_TRAINING: "High CPU/GPU, Moderate Memory",
        OperationType.MODEL_INFERENCE: "Low CPU/GPU, Low Memory",
        OperationType.DATA_PROCESSING: "Moderate CPU, High Memory",
        OperationType.RL_OPTIMIZATION: "High CPU/GPU, Moderate Memory",
        OperationType.HYPERPARAMETER_TUNING: "Very High CPU/GPU, High Memory",
        OperationType.DATA_QUALITY_ASSESSMENT: "Low CPU, Moderate Memory",
        OperationType.DOCUMENT_PROCESSING: "Moderate CPU, Low Memory",
        OperationType.FEATURE_ENGINEERING: "Moderate CPU, Moderate Memory",
        OperationType.MODEL_EVALUATION: "Low CPU, Low Memory",
        OperationType.BATCH_PREDICTION: "Moderate CPU/GPU, High Memory"
    }
    return requirements.get(op_type, "Variable requirements")