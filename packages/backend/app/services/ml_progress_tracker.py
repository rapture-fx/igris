"""
ML/RL Progress Tracking Service
===============================

Comprehensive progress tracking system for ML/RL operations with detailed
status monitoring, performance metrics, and real-time updates.

Features:
- Real-time progress tracking for all ML/RL operations
- Detailed performance metrics collection
- Resource utilization monitoring
- Status persistence and recovery
- Frontend-optimized progress reporting
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict, field
from enum import Enum
import redis.asyncio as redis
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class OperationType(Enum):
    """Types of ML/RL operations that can be tracked"""
    MODEL_TRAINING = "model_training"
    MODEL_INFERENCE = "model_inference"
    DATA_PROCESSING = "data_processing"
    RL_OPTIMIZATION = "rl_optimization"
    HYPERPARAMETER_TUNING = "hyperparameter_tuning"
    DATA_QUALITY_ASSESSMENT = "data_quality_assessment"
    DOCUMENT_PROCESSING = "document_processing"
    FEATURE_ENGINEERING = "feature_engineering"
    MODEL_EVALUATION = "model_evaluation"
    BATCH_PREDICTION = "batch_prediction"


class OperationStatus(Enum):
    """Status values for ML/RL operations"""
    QUEUED = "queued"
    INITIALIZING = "initializing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class Priority(Enum):
    """Priority levels for operations"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class ProgressMetrics:
    """Progress metrics for an operation"""
    progress_percentage: float = 0.0
    current_step: str = ""
    total_steps: Optional[int] = None
    completed_steps: int = 0
    estimated_completion: Optional[datetime] = None
    processing_rate: Optional[float] = None
    items_processed: int = 0
    total_items: Optional[int] = None
    
    # Performance metrics
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    gpu_usage: Optional[float] = None
    disk_io: Optional[float] = None
    
    # ML-specific metrics
    loss_value: Optional[float] = None
    accuracy: Optional[float] = None
    validation_score: Optional[float] = None
    epoch: Optional[int] = None
    episode: Optional[int] = None


@dataclass
class OperationContext:
    """Complete context for a tracked operation"""
    operation_id: str
    operation_type: OperationType
    status: OperationStatus
    priority: Priority
    
    # Identifiers
    user_id: str
    session_id: Optional[str] = None
    model_name: Optional[str] = None
    pipeline_id: Optional[str] = None
    
    # Timing
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_updated: datetime = field(default_factory=datetime.utcnow)
    
    # Progress tracking
    progress_metrics: ProgressMetrics = field(default_factory=ProgressMetrics)
    
    # Operation details
    parameters: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    
    # Configuration
    timeout_seconds: Optional[int] = None
    max_retries: int = 0
    current_retries: int = 0
    
    # Callbacks
    progress_callback: Optional[str] = None  # WebSocket session or callback URL
    completion_callback: Optional[str] = None


class MLProgressTracker:
    """
    Comprehensive progress tracking system for ML/RL operations
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client: Optional[redis.Redis] = None
        self.redis_url = redis_url
        self.active_operations: Dict[str, OperationContext] = {}
        self.operation_handlers: Dict[str, Callable] = {}
        
        # Cleanup and monitoring tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._monitoring_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """Initialize the progress tracker"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("ML Progress Tracker initialized with Redis")
            
            # Start background tasks
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
            self._monitoring_task = asyncio.create_task(self._monitor_operations())
            
            # Load active operations from Redis
            await self._load_active_operations()
            
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory storage: {e}")
            self.redis_client = None
    
    async def shutdown(self):
        """Shutdown the progress tracker"""
        # Cancel background tasks
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._monitoring_task:
            self._monitoring_task.cancel()
            
        # Persist active operations
        await self._persist_active_operations()
        
        if self.redis_client:
            await self.redis_client.close()
    
    async def start_operation(self,
                            operation_type: OperationType,
                            user_id: str,
                            parameters: Dict[str, Any],
                            priority: Priority = Priority.NORMAL,
                            session_id: Optional[str] = None,
                            model_name: Optional[str] = None,
                            timeout_seconds: Optional[int] = None) -> str:
        """
        Start tracking a new ML/RL operation
        
        Returns:
            operation_id: Unique identifier for the operation
        """
        operation_id = str(uuid.uuid4())
        
        # Create operation context
        context = OperationContext(
            operation_id=operation_id,
            operation_type=operation_type,
            status=OperationStatus.QUEUED,
            priority=priority,
            user_id=user_id,
            session_id=session_id,
            model_name=model_name,
            parameters=parameters,
            timeout_seconds=timeout_seconds
        )
        
        # Store operation
        self.active_operations[operation_id] = context
        await self._persist_operation(operation_id, context)
        
        logger.info(f"Started tracking operation {operation_id}: {operation_type.value}")
        
        # Notify about operation start
        await self._notify_operation_status_change(context)
        
        return operation_id
    
    async def update_progress(self,
                            operation_id: str,
                            progress_metrics: Optional[ProgressMetrics] = None,
                            status: Optional[OperationStatus] = None,
                            results: Optional[Dict[str, Any]] = None,
                            error_message: Optional[str] = None) -> bool:
        """
        Update progress for an operation
        
        Returns:
            bool: True if update was successful
        """
        if operation_id not in self.active_operations:
            logger.warning(f"Operation {operation_id} not found for progress update")
            return False
        
        context = self.active_operations[operation_id]
        
        # Update progress metrics
        if progress_metrics:
            context.progress_metrics = progress_metrics
        
        # Update status
        if status:
            old_status = context.status
            context.status = status
            
            # Set timing information
            if status == OperationStatus.RUNNING and not context.started_at:
                context.started_at = datetime.utcnow()
            elif status in [OperationStatus.COMPLETED, OperationStatus.FAILED, OperationStatus.CANCELLED]:
                context.completed_at = datetime.utcnow()
            
            # Notify if status changed
            if status != old_status:
                await self._notify_operation_status_change(context)
        
        # Update results
        if results:
            context.results.update(results)
        
        # Update error message
        if error_message:
            context.error_message = error_message
        
        # Update timestamp
        context.last_updated = datetime.utcnow()
        
        # Persist changes
        await self._persist_operation(operation_id, context)
        
        # Send progress update notification
        await self._notify_progress_update(context)
        
        return True
    
    async def complete_operation(self,
                               operation_id: str,
                               results: Dict[str, Any],
                               success: bool = True) -> bool:
        """
        Mark an operation as completed
        """
        if operation_id not in self.active_operations:
            return False
        
        context = self.active_operations[operation_id]
        context.status = OperationStatus.COMPLETED if success else OperationStatus.FAILED
        context.results.update(results)
        context.completed_at = datetime.utcnow()
        context.progress_metrics.progress_percentage = 100.0
        
        await self._persist_operation(operation_id, context)
        await self._notify_operation_status_change(context)
        
        logger.info(f"Operation {operation_id} completed with status: {context.status.value}")
        return True
    
    async def cancel_operation(self, operation_id: str, reason: str = "User requested") -> bool:
        """Cancel a running operation"""
        if operation_id not in self.active_operations:
            return False
        
        context = self.active_operations[operation_id]
        
        if context.status in [OperationStatus.COMPLETED, OperationStatus.FAILED, OperationStatus.CANCELLED]:
            return False  # Already finished
        
        context.status = OperationStatus.CANCELLED
        context.error_message = f"Cancelled: {reason}"
        context.completed_at = datetime.utcnow()
        
        await self._persist_operation(operation_id, context)
        await self._notify_operation_status_change(context)
        
        logger.info(f"Operation {operation_id} cancelled: {reason}")
        return True
    
    async def get_operation_status(self, operation_id: str) -> Optional[OperationContext]:
        """Get current status of an operation"""
        if operation_id in self.active_operations:
            return self.active_operations[operation_id]
        
        # Try to load from Redis if not in memory
        context = await self._load_operation(operation_id)
        if context:
            self.active_operations[operation_id] = context
        
        return context
    
    async def list_operations(self,
                            user_id: Optional[str] = None,
                            operation_type: Optional[OperationType] = None,
                            status: Optional[OperationStatus] = None,
                            limit: int = 50,
                            offset: int = 0) -> List[OperationContext]:
        """
        List operations with optional filtering
        """
        # Get all operations (from memory and Redis)
        all_operations = list(self.active_operations.values())
        
        # Load recent operations from Redis if available
        if self.redis_client:
            try:
                recent_ops = await self._load_recent_operations(limit * 2)  # Load more to account for filtering
                for op in recent_ops:
                    if op.operation_id not in self.active_operations:
                        all_operations.append(op)
            except Exception as e:
                logger.error(f"Error loading recent operations: {e}")
        
        # Apply filters
        filtered_operations = []
        for op in all_operations:
            if user_id and op.user_id != user_id:
                continue
            if operation_type and op.operation_type != operation_type:
                continue
            if status and op.status != status:
                continue
            filtered_operations.append(op)
        
        # Sort by creation time (most recent first)
        filtered_operations.sort(key=lambda x: x.created_at, reverse=True)
        
        # Apply pagination
        return filtered_operations[offset:offset + limit]
    
    async def get_operation_metrics(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed metrics for an operation"""
        context = await self.get_operation_status(operation_id)
        if not context:
            return None
        
        # Calculate derived metrics
        duration = None
        if context.started_at:
            end_time = context.completed_at or datetime.utcnow()
            duration = (end_time - context.started_at).total_seconds()
        
        estimated_total_duration = None
        if context.progress_metrics.progress_percentage > 0 and duration:
            estimated_total_duration = duration * (100 / context.progress_metrics.progress_percentage)
        
        return {
            "operation_id": operation_id,
            "operation_type": context.operation_type.value,
            "status": context.status.value,
            "progress_percentage": context.progress_metrics.progress_percentage,
            "duration_seconds": duration,
            "estimated_total_duration": estimated_total_duration,
            "items_processed": context.progress_metrics.items_processed,
            "total_items": context.progress_metrics.total_items,
            "processing_rate": context.progress_metrics.processing_rate,
            "performance_metrics": {
                "cpu_usage": context.progress_metrics.cpu_usage,
                "memory_usage": context.progress_metrics.memory_usage,
                "gpu_usage": context.progress_metrics.gpu_usage,
                "disk_io": context.progress_metrics.disk_io
            },
            "ml_metrics": {
                "loss_value": context.progress_metrics.loss_value,
                "accuracy": context.progress_metrics.accuracy,
                "validation_score": context.progress_metrics.validation_score,
                "epoch": context.progress_metrics.epoch,
                "episode": context.progress_metrics.episode
            },
            "timestamps": {
                "created_at": context.created_at.isoformat(),
                "started_at": context.started_at.isoformat() if context.started_at else None,
                "completed_at": context.completed_at.isoformat() if context.completed_at else None,
                "last_updated": context.last_updated.isoformat()
            }
        }
    
    async def get_user_operations_summary(self, user_id: str) -> Dict[str, Any]:
        """Get summary of operations for a user"""
        user_operations = await self.list_operations(user_id=user_id, limit=1000)
        
        summary = {
            "total_operations": len(user_operations),
            "status_breakdown": {},
            "type_breakdown": {},
            "active_operations": 0,
            "completed_operations": 0,
            "failed_operations": 0
        }
        
        for op in user_operations:
            # Status breakdown
            status_key = op.status.value
            summary["status_breakdown"][status_key] = summary["status_breakdown"].get(status_key, 0) + 1
            
            # Type breakdown
            type_key = op.operation_type.value
            summary["type_breakdown"][type_key] = summary["type_breakdown"].get(type_key, 0) + 1
            
            # Count active, completed, failed
            if op.status in [OperationStatus.QUEUED, OperationStatus.INITIALIZING, OperationStatus.RUNNING]:
                summary["active_operations"] += 1
            elif op.status == OperationStatus.COMPLETED:
                summary["completed_operations"] += 1
            elif op.status in [OperationStatus.FAILED, OperationStatus.CANCELLED, OperationStatus.TIMEOUT]:
                summary["failed_operations"] += 1
        
        return summary
    
    @asynccontextmanager
    async def track_operation(self,
                            operation_type: OperationType,
                            user_id: str,
                            parameters: Dict[str, Any],
                            **kwargs):
        """
        Context manager for tracking an operation
        
        Usage:
            async with tracker.track_operation(OperationType.MODEL_TRAINING, user_id, params) as op_id:
                # Your operation code here
                await tracker.update_progress(op_id, progress_metrics=metrics)
        """
        operation_id = await self.start_operation(
            operation_type=operation_type,
            user_id=user_id,
            parameters=parameters,
            **kwargs
        )
        
        try:
            # Update status to running
            await self.update_progress(operation_id, status=OperationStatus.RUNNING)
            yield operation_id
            
            # Mark as completed if we reach here without exception
            await self.complete_operation(operation_id, {}, success=True)
            
        except Exception as e:
            # Mark as failed if exception occurred
            await self.update_progress(
                operation_id,
                status=OperationStatus.FAILED,
                error_message=str(e)
            )
            raise
    
    # Private methods
    
    async def _persist_operation(self, operation_id: str, context: OperationContext):
        """Persist operation to Redis"""
        if not self.redis_client:
            return
        
        try:
            key = f"ml_operation:{operation_id}"
            data = json.dumps(asdict(context), default=str)
            await self.redis_client.setex(key, 7200, data)  # 2 hour TTL
            
            # Add to user operations list
            user_key = f"user_operations:{context.user_id}"
            await self.redis_client.lpush(user_key, operation_id)
            await self.redis_client.ltrim(user_key, 0, 999)  # Keep last 1000
            await self.redis_client.expire(user_key, 86400)  # 24 hours
            
        except Exception as e:
            logger.error(f"Error persisting operation {operation_id}: {e}")
    
    async def _load_operation(self, operation_id: str) -> Optional[OperationContext]:
        """Load operation from Redis"""
        if not self.redis_client:
            return None
        
        try:
            key = f"ml_operation:{operation_id}"
            data = await self.redis_client.get(key)
            if data:
                op_dict = json.loads(data)
                # Convert string dates back to datetime objects
                for date_field in ['created_at', 'started_at', 'completed_at', 'last_updated']:
                    if op_dict.get(date_field):
                        op_dict[date_field] = datetime.fromisoformat(op_dict[date_field])
                
                # Convert enums
                op_dict['operation_type'] = OperationType(op_dict['operation_type'])
                op_dict['status'] = OperationStatus(op_dict['status'])
                op_dict['priority'] = Priority(op_dict['priority'])
                
                # Reconstruct ProgressMetrics
                if 'progress_metrics' in op_dict:
                    pm_dict = op_dict['progress_metrics']
                    if pm_dict.get('estimated_completion'):
                        pm_dict['estimated_completion'] = datetime.fromisoformat(pm_dict['estimated_completion'])
                    op_dict['progress_metrics'] = ProgressMetrics(**pm_dict)
                
                return OperationContext(**op_dict)
        
        except Exception as e:
            logger.error(f"Error loading operation {operation_id}: {e}")
        
        return None
    
    async def _load_active_operations(self):
        """Load active operations from Redis on startup"""
        if not self.redis_client:
            return
        
        try:
            # Scan for operation keys
            async for key in self.redis_client.scan_iter(match="ml_operation:*"):
                operation_id = key.split(":")[-1]
                context = await self._load_operation(operation_id)
                if context and context.status not in [OperationStatus.COMPLETED, OperationStatus.FAILED, OperationStatus.CANCELLED]:
                    self.active_operations[operation_id] = context
                    
            logger.info(f"Loaded {len(self.active_operations)} active operations from Redis")
            
        except Exception as e:
            logger.error(f"Error loading active operations: {e}")
    
    async def _load_recent_operations(self, limit: int = 100) -> List[OperationContext]:
        """Load recent operations from Redis"""
        operations = []
        if not self.redis_client:
            return operations
        
        try:
            # Scan for operation keys and load them
            count = 0
            async for key in self.redis_client.scan_iter(match="ml_operation:*"):
                if count >= limit:
                    break
                    
                operation_id = key.split(":")[-1]
                context = await self._load_operation(operation_id)
                if context:
                    operations.append(context)
                count += 1
                
        except Exception as e:
            logger.error(f"Error loading recent operations: {e}")
        
        return operations
    
    async def _persist_active_operations(self):
        """Persist all active operations before shutdown"""
        for operation_id, context in self.active_operations.items():
            await self._persist_operation(operation_id, context)
    
    async def _notify_operation_status_change(self, context: OperationContext):
        """Notify about operation status changes via WebSocket"""
        try:
            # Import here to avoid circular imports
            from app.services.ml_websocket_service import ml_websocket_manager, MLEvent, MLEventType
            
            # Map status to event type
            event_type_map = {
                OperationStatus.QUEUED: MLEventType.TASK_QUEUED,
                OperationStatus.RUNNING: MLEventType.TASK_STARTED,
                OperationStatus.COMPLETED: MLEventType.TASK_COMPLETED,
                OperationStatus.FAILED: MLEventType.TASK_FAILED,
                OperationStatus.CANCELLED: MLEventType.TASK_FAILED
            }
            
            event_type = event_type_map.get(context.status, MLEventType.TASK_STARTED)
            
            event = MLEvent(
                event_type=event_type,
                session_id=context.session_id or context.operation_id,
                user_id=context.user_id,
                task_id=context.operation_id,
                model_name=context.model_name,
                progress=context.progress_metrics.progress_percentage / 100.0,
                message=f"Operation {context.operation_type.value}: {context.status.value}",
                data={
                    "operation_type": context.operation_type.value,
                    "status": context.status.value,
                    "progress_metrics": asdict(context.progress_metrics),
                    "error_message": context.error_message
                }
            )
            
            await ml_websocket_manager.broadcast_event(event, target_user_id=context.user_id)
            
        except Exception as e:
            logger.error(f"Error notifying status change: {e}")
    
    async def _notify_progress_update(self, context: OperationContext):
        """Notify about progress updates via WebSocket"""
        try:
            from app.services.ml_websocket_service import ml_websocket_manager, MLEvent, MLEventType
            
            # Choose appropriate event type based on operation type
            event_type_map = {
                OperationType.MODEL_TRAINING: MLEventType.TRAINING_PROGRESS,
                OperationType.RL_OPTIMIZATION: MLEventType.RL_SESSION_PROGRESS,
                OperationType.DATA_PROCESSING: MLEventType.DATA_PROCESSING_PROGRESS
            }
            
            event_type = event_type_map.get(context.operation_type, MLEventType.TASK_STARTED)
            
            event = MLEvent(
                event_type=event_type,
                session_id=context.session_id or context.operation_id,
                user_id=context.user_id,
                task_id=context.operation_id,
                model_name=context.model_name,
                progress=context.progress_metrics.progress_percentage / 100.0,
                message=f"{context.progress_metrics.current_step} ({context.progress_metrics.progress_percentage:.1f}%)",
                data=asdict(context.progress_metrics)
            )
            
            await ml_websocket_manager.broadcast_event(event, target_user_id=context.user_id)
            
        except Exception as e:
            logger.error(f"Error notifying progress update: {e}")
    
    async def _periodic_cleanup(self):
        """Periodic cleanup of completed operations"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                
                current_time = datetime.utcnow()
                cleanup_threshold = current_time - timedelta(hours=24)
                
                # Remove old completed operations from memory
                operations_to_remove = []
                for op_id, context in self.active_operations.items():
                    if (context.status in [OperationStatus.COMPLETED, OperationStatus.FAILED, OperationStatus.CANCELLED] and
                        context.completed_at and context.completed_at < cleanup_threshold):
                        operations_to_remove.append(op_id)
                
                for op_id in operations_to_remove:
                    del self.active_operations[op_id]
                    
                if operations_to_remove:
                    logger.info(f"Cleaned up {len(operations_to_remove)} old operations from memory")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")
    
    async def _monitor_operations(self):
        """Monitor operations for timeouts and resource usage"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                current_time = datetime.utcnow()
                
                for op_id, context in list(self.active_operations.items()):
                    # Check for timeouts
                    if (context.timeout_seconds and 
                        context.started_at and
                        (current_time - context.started_at).total_seconds() > context.timeout_seconds):
                        
                        await self.update_progress(
                            op_id,
                            status=OperationStatus.TIMEOUT,
                            error_message=f"Operation timed out after {context.timeout_seconds} seconds"
                        )
                        logger.warning(f"Operation {op_id} timed out")
                    
                    # Update resource usage metrics if available
                    # This would integrate with system monitoring tools
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in operation monitoring: {e}")


# Global progress tracker instance
ml_progress_tracker = MLProgressTracker()


# Utility functions
async def track_training_progress(operation_id: str, 
                                epoch: int, 
                                total_epochs: int,
                                loss: float,
                                accuracy: Optional[float] = None,
                                validation_score: Optional[float] = None):
    """Utility to update training progress"""
    progress_percentage = (epoch / total_epochs) * 100 if total_epochs > 0 else 0
    
    metrics = ProgressMetrics(
        progress_percentage=progress_percentage,
        current_step=f"Epoch {epoch}/{total_epochs}",
        completed_steps=epoch,
        total_steps=total_epochs,
        epoch=epoch,
        loss_value=loss,
        accuracy=accuracy,
        validation_score=validation_score
    )
    
    await ml_progress_tracker.update_progress(operation_id, progress_metrics=metrics)


async def track_rl_progress(operation_id: str,
                          episode: int,
                          reward: float,
                          average_reward: float,
                          exploration_rate: float):
    """Utility to update RL training progress"""
    metrics = ProgressMetrics(
        current_step=f"Episode {episode}",
        episode=episode,
        loss_value=reward,  # Use reward as a performance metric
        validation_score=average_reward
    )
    
    await ml_progress_tracker.update_progress(operation_id, progress_metrics=metrics)


async def track_data_processing(operation_id: str,
                              items_processed: int,
                              total_items: int,
                              current_stage: str):
    """Utility to update data processing progress"""
    progress_percentage = (items_processed / total_items) * 100 if total_items > 0 else 0
    
    metrics = ProgressMetrics(
        progress_percentage=progress_percentage,
        current_step=current_stage,
        items_processed=items_processed,
        total_items=total_items,
        processing_rate=items_processed / max(1, items_processed // 60)  # Rough rate calculation
    )
    
    await ml_progress_tracker.update_progress(operation_id, progress_metrics=metrics)