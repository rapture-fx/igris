"""
ML WebSocket Service for Real-Time Progress Updates
=================================================

Provides WebSocket-based real-time communication for ML operations including:
- Model training progress updates
- Data processing pipeline status
- Real-time inference results
- RL optimization session monitoring
- Background task status updates

This service enables real-time UI updates for ML/RL operations.
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Set, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import weakref

from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as redis

logger = logging.getLogger(__name__)


class MLEventType(Enum):
    """Types of ML events that can be broadcasted"""
    TRAINING_STARTED = "training_started"
    TRAINING_PROGRESS = "training_progress" 
    TRAINING_COMPLETED = "training_completed"
    TRAINING_FAILED = "training_failed"
    
    INFERENCE_STARTED = "inference_started"
    INFERENCE_COMPLETED = "inference_completed"
    INFERENCE_FAILED = "inference_failed"
    
    DATA_PROCESSING_STARTED = "data_processing_started"
    DATA_PROCESSING_PROGRESS = "data_processing_progress"
    DATA_PROCESSING_COMPLETED = "data_processing_completed"
    DATA_PROCESSING_FAILED = "data_processing_failed"
    
    RL_SESSION_STARTED = "rl_session_started"
    RL_SESSION_PROGRESS = "rl_session_progress"
    RL_SESSION_COMPLETED = "rl_session_completed"
    RL_SESSION_FAILED = "rl_session_failed"
    
    DOCUMENT_PROCESSING_STARTED = "document_processing_started"
    DOCUMENT_PROCESSING_COMPLETED = "document_processing_completed"
    
    QUALITY_ASSESSMENT_COMPLETED = "quality_assessment_completed"
    
    TASK_QUEUED = "task_queued"
    TASK_STARTED = "task_started"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"


@dataclass
class MLEvent:
    """ML event data structure"""
    event_type: MLEventType
    session_id: str
    user_id: Optional[str] = None
    task_id: Optional[str] = None
    model_name: Optional[str] = None
    progress: Optional[float] = None  # 0.0 to 1.0
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class ConnectionInfo:
    """WebSocket connection information"""
    websocket: WebSocket
    user_id: str
    session_id: str
    subscribed_events: Set[MLEventType]
    connected_at: datetime
    last_ping: datetime


class MLWebSocketManager:
    """
    Manages WebSocket connections for ML operations with real-time updates
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.connections: Dict[str, ConnectionInfo] = {}
        self.user_sessions: Dict[str, Set[str]] = {}  # user_id -> session_ids
        self.session_tasks: Dict[str, Set[str]] = {}  # session_id -> task_ids
        self.redis_client: Optional[redis.Redis] = None
        self.redis_url = redis_url
        
        # Event callbacks for custom processing
        self.event_callbacks: Dict[MLEventType, List[Callable]] = {}
        
        # Cleanup task
        self._cleanup_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """Initialize Redis connection and start cleanup task"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("ML WebSocket Manager initialized with Redis")
            
            # Start periodic cleanup
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
            
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory storage: {e}")
            self.redis_client = None
    
    async def shutdown(self):
        """Cleanup resources"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            
        if self.redis_client:
            await self.redis_client.close()
            
        # Close all connections
        for connection in list(self.connections.values()):
            try:
                await connection.websocket.close()
            except:
                pass
    
    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        session_id: Optional[str] = None,
        subscribed_events: Optional[List[str]] = None
    ) -> str:
        """
        Connect a WebSocket client for ML updates
        
        Args:
            websocket: WebSocket connection
            user_id: User identifier
            session_id: Optional session ID (generated if None)
            subscribed_events: List of event types to subscribe to
            
        Returns:
            Session ID for this connection
        """
        if session_id is None:
            session_id = str(uuid.uuid4())
            
        # Parse subscribed events
        if subscribed_events is None:
            subscribed_events = list(MLEventType)
        else:
            subscribed_events = [MLEventType(event) for event in subscribed_events]
        
        # Accept WebSocket connection
        await websocket.accept()
        
        # Store connection info
        connection_info = ConnectionInfo(
            websocket=websocket,
            user_id=user_id,
            session_id=session_id,
            subscribed_events=set(subscribed_events),
            connected_at=datetime.utcnow(),
            last_ping=datetime.utcnow()
        )
        
        self.connections[session_id] = connection_info
        
        # Track user sessions
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = set()
        self.user_sessions[user_id].add(session_id)
        
        logger.info(f"ML WebSocket connected: user={user_id}, session={session_id}")
        
        # Send connection confirmation
        await self._send_to_session(session_id, {
            "event_type": "connected",
            "session_id": session_id,
            "user_id": user_id,
            "subscribed_events": [event.value for event in subscribed_events],
            "connected_at": datetime.utcnow().isoformat()
        })
        
        return session_id
    
    async def disconnect(self, session_id: str):
        """Disconnect a WebSocket session"""
        if session_id not in self.connections:
            return
            
        connection = self.connections[session_id]
        user_id = connection.user_id
        
        # Remove from tracking
        del self.connections[session_id]
        
        if user_id in self.user_sessions:
            self.user_sessions[user_id].discard(session_id)
            if not self.user_sessions[user_id]:
                del self.user_sessions[user_id]
        
        # Clean up session tasks
        if session_id in self.session_tasks:
            del self.session_tasks[session_id]
            
        logger.info(f"ML WebSocket disconnected: user={user_id}, session={session_id}")
    
    async def broadcast_event(self, event: MLEvent, target_user_id: Optional[str] = None):
        """
        Broadcast an ML event to connected clients
        
        Args:
            event: ML event to broadcast
            target_user_id: If specified, only send to this user's sessions
        """
        event_data = {
            "event_type": event.event_type.value,
            "session_id": event.session_id,
            "user_id": event.user_id,
            "task_id": event.task_id,
            "model_name": event.model_name,
            "progress": event.progress,
            "message": event.message,
            "data": event.data,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None
        }
        
        # Store event in Redis for persistence
        await self._store_event(event)
        
        # Get target sessions
        target_sessions = []
        if target_user_id:
            # Send only to specific user's sessions
            if target_user_id in self.user_sessions:
                target_sessions = list(self.user_sessions[target_user_id])
        else:
            # Send to all relevant sessions
            target_sessions = list(self.connections.keys())
        
        # Send to matching sessions
        for session_id in target_sessions:
            if session_id not in self.connections:
                continue
                
            connection = self.connections[session_id]
            
            # Check if session is subscribed to this event type
            if event.event_type not in connection.subscribed_events:
                continue
                
            # Send event
            await self._send_to_session(session_id, event_data)
        
        # Execute registered callbacks
        await self._execute_callbacks(event)
    
    async def send_training_progress(
        self,
        session_id: str,
        model_name: str,
        progress: float,
        epoch: int,
        loss: float,
        metrics: Optional[Dict[str, float]] = None,
        user_id: Optional[str] = None
    ):
        """Send training progress update"""
        event = MLEvent(
            event_type=MLEventType.TRAINING_PROGRESS,
            session_id=session_id,
            user_id=user_id,
            model_name=model_name,
            progress=progress,
            message=f"Epoch {epoch} - Loss: {loss:.4f}",
            data={
                "epoch": epoch,
                "loss": loss,
                "metrics": metrics or {},
                "training_time": datetime.utcnow().isoformat()
            }
        )
        
        await self.broadcast_event(event, target_user_id=user_id)
    
    async def send_inference_result(
        self,
        session_id: str,
        model_name: str,
        predictions: List[Any],
        confidence_scores: Optional[List[float]] = None,
        processing_time: Optional[float] = None,
        user_id: Optional[str] = None
    ):
        """Send inference results"""
        event = MLEvent(
            event_type=MLEventType.INFERENCE_COMPLETED,
            session_id=session_id,
            user_id=user_id,
            model_name=model_name,
            progress=1.0,
            message=f"Inference completed for {len(predictions)} samples",
            data={
                "predictions": predictions,
                "confidence_scores": confidence_scores,
                "processing_time": processing_time,
                "sample_count": len(predictions)
            }
        )
        
        await self.broadcast_event(event, target_user_id=user_id)
    
    async def send_data_processing_progress(
        self,
        session_id: str,
        pipeline_name: str,
        progress: float,
        current_stage: str,
        records_processed: int,
        total_records: int,
        user_id: Optional[str] = None
    ):
        """Send data processing progress update"""
        event = MLEvent(
            event_type=MLEventType.DATA_PROCESSING_PROGRESS,
            session_id=session_id,
            user_id=user_id,
            progress=progress,
            message=f"Processing {current_stage}: {records_processed}/{total_records} records",
            data={
                "pipeline_name": pipeline_name,
                "current_stage": current_stage,
                "records_processed": records_processed,
                "total_records": total_records,
                "processing_rate": records_processed / max(1, total_records)
            }
        )
        
        await self.broadcast_event(event, target_user_id=user_id)
    
    async def send_rl_session_update(
        self,
        session_id: str,
        agent_name: str,
        episode: int,
        reward: float,
        average_reward: float,
        exploration_rate: float,
        user_id: Optional[str] = None,
        max_episodes: int = 1000,
        additional_metrics: Optional[Dict[str, float]] = None
    ):
        """Send RL training session update"""
        event = MLEvent(
            event_type=MLEventType.RL_SESSION_PROGRESS,
            session_id=session_id,
            user_id=user_id,
            progress=min(episode / max_episodes, 1.0),
            message=f"Episode {episode} - Reward: {reward:.2f} (Avg: {average_reward:.2f})",
            data={
                "agent_name": agent_name,
                "episode": episode,
                "reward": reward,
                "average_reward": average_reward,
                "exploration_rate": exploration_rate,
                "max_episodes": max_episodes,
                "additional_metrics": additional_metrics or {},
                "training_time": datetime.utcnow().isoformat(),
                "progress_percentage": round((episode / max_episodes) * 100, 2)
            }
        )
        
        await self.broadcast_event(event, target_user_id=user_id)
    
    async def send_task_status(
        self,
        session_id: str,
        task_id: str,
        status: str,
        progress: Optional[float] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """Send Celery task status update"""
        if status == "started":
            event_type = MLEventType.TASK_STARTED
        elif status == "completed":
            event_type = MLEventType.TASK_COMPLETED
        elif status == "failed":
            event_type = MLEventType.TASK_FAILED
        else:
            event_type = MLEventType.TASK_QUEUED
        
        event = MLEvent(
            event_type=event_type,
            session_id=session_id,
            user_id=user_id,
            task_id=task_id,
            progress=progress,
            message=f"Task {task_id} {status}" + (f": {error}" if error else ""),
            data={
                "task_id": task_id,
                "status": status,
                "result": result,
                "error": error
            }
        )
        
        await self.broadcast_event(event, target_user_id=user_id)
    
    async def get_session_events(
        self,
        session_id: str,
        event_types: Optional[List[MLEventType]] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get recent events for a session"""
        if not self.redis_client:
            return []
            
        try:
            key = f"ml_events:{session_id}"
            events = await self.redis_client.lrange(key, 0, limit - 1)
            
            result = []
            for event_json in events:
                event_data = json.loads(event_json)
                
                # Filter by event types if specified
                if event_types:
                    event_type = MLEventType(event_data["event_type"])
                    if event_type not in event_types:
                        continue
                        
                result.append(event_data)
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting session events: {e}")
            return []
    
    async def register_callback(self, event_type: MLEventType, callback: Callable):
        """Register a callback for specific event types"""
        if event_type not in self.event_callbacks:
            self.event_callbacks[event_type] = []
        self.event_callbacks[event_type].append(callback)
    
    async def handle_websocket_message(self, session_id: str, message: str):
        """Handle incoming WebSocket message from client"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "ping":
                # Update last ping time
                if session_id in self.connections:
                    self.connections[session_id].last_ping = datetime.utcnow()
                    
                await self._send_to_session(session_id, {
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif message_type == "subscribe_events":
                # Update event subscriptions
                new_events = data.get("events", [])
                if session_id in self.connections:
                    self.connections[session_id].subscribed_events = {
                        MLEventType(event) for event in new_events
                    }
                    
                await self._send_to_session(session_id, {
                    "type": "subscription_updated",
                    "subscribed_events": new_events
                })
                
            elif message_type == "get_recent_events":
                # Send recent events for this session
                event_types = data.get("event_types")
                if event_types:
                    event_types = [MLEventType(et) for et in event_types]
                    
                recent_events = await self.get_session_events(
                    session_id, 
                    event_types, 
                    data.get("limit", 50)
                )
                
                await self._send_to_session(session_id, {
                    "type": "recent_events",
                    "events": recent_events
                })
                
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
    
    async def _send_to_session(self, session_id: str, data: Dict[str, Any]):
        """Send data to a specific session"""
        if session_id not in self.connections:
            return
            
        connection = self.connections[session_id]
        try:
            await connection.websocket.send_text(json.dumps(data))
        except Exception as e:
            logger.error(f"Error sending to session {session_id}: {e}")
            # Remove disconnected session
            await self.disconnect(session_id)
    
    async def _store_event(self, event: MLEvent):
        """Store event in Redis for persistence"""
        if not self.redis_client:
            return
            
        try:
            key = f"ml_events:{event.session_id}"
            event_json = json.dumps(asdict(event), default=str)
            
            # Store in Redis list (FIFO)
            await self.redis_client.lpush(key, event_json)
            
            # Keep only recent events (limit to 1000 per session)
            await self.redis_client.ltrim(key, 0, 999)
            
            # Set expiration (24 hours)
            await self.redis_client.expire(key, 86400)
            
        except Exception as e:
            logger.error(f"Error storing event: {e}")
    
    async def _execute_callbacks(self, event: MLEvent):
        """Execute registered callbacks for an event"""
        if event.event_type not in self.event_callbacks:
            return
            
        for callback in self.event_callbacks[event.event_type]:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                logger.error(f"Error executing callback: {e}")
    
    async def _periodic_cleanup(self):
        """Periodic cleanup of stale connections"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                current_time = datetime.utcnow()
                stale_sessions = []
                
                # Find stale connections (no ping in 10 minutes)
                for session_id, connection in self.connections.items():
                    if (current_time - connection.last_ping).total_seconds() > 600:
                        stale_sessions.append(session_id)
                
                # Remove stale connections
                for session_id in stale_sessions:
                    await self.disconnect(session_id)
                    logger.info(f"Cleaned up stale ML WebSocket session: {session_id}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")


# Global WebSocket manager instance
ml_websocket_manager = MLWebSocketManager()


# Utility functions for easy integration

async def notify_training_started(
    session_id: str,
    model_name: str,
    user_id: Optional[str] = None,
    **kwargs
):
    """Utility to notify training started"""
    event = MLEvent(
        event_type=MLEventType.TRAINING_STARTED,
        session_id=session_id,
        user_id=user_id,
        model_name=model_name,
        progress=0.0,
        message=f"Training started for model: {model_name}",
        data=kwargs
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


async def notify_training_completed(
    session_id: str,
    model_name: str,
    metadata: Dict[str, Any],
    user_id: Optional[str] = None
):
    """Utility to notify training completed"""
    event = MLEvent(
        event_type=MLEventType.TRAINING_COMPLETED,
        session_id=session_id,
        user_id=user_id,
        model_name=model_name,
        progress=1.0,
        message=f"Training completed for model: {model_name}",
        data=metadata
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


async def notify_processing_progress(
    session_id: str,
    stage: str,
    progress: float,
    message: str,
    user_id: Optional[str] = None,
    **kwargs
):
    """Utility to notify data processing progress"""
    event = MLEvent(
        event_type=MLEventType.DATA_PROCESSING_PROGRESS,
        session_id=session_id,
        user_id=user_id,
        progress=progress,
        message=message,
        data={"stage": stage, **kwargs}
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


# Enhanced frontend-specific notification functions
async def notify_model_training_metrics(
    session_id: str,
    model_name: str,
    epoch: int,
    total_epochs: int,
    metrics: Dict[str, float],
    loss_history: List[float],
    validation_metrics: Optional[Dict[str, float]] = None,
    user_id: Optional[str] = None
):
    """Send comprehensive training metrics for frontend visualization"""
    progress = epoch / total_epochs if total_epochs > 0 else 0.0
    
    event = MLEvent(
        event_type=MLEventType.TRAINING_PROGRESS,
        session_id=session_id,
        user_id=user_id,
        model_name=model_name,
        progress=progress,
        message=f"Training epoch {epoch}/{total_epochs}",
        data={
            "epoch": epoch,
            "total_epochs": total_epochs,
            "metrics": metrics,
            "loss_history": loss_history[-50:],  # Keep last 50 values for charts
            "validation_metrics": validation_metrics or {},
            "progress_percentage": round(progress * 100, 2),
            "estimated_time_remaining": _estimate_time_remaining(epoch, total_epochs),
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


async def notify_data_upload_progress(
    session_id: str,
    filename: str,
    bytes_uploaded: int,
    total_bytes: int,
    processing_stage: str = "uploading",
    user_id: Optional[str] = None
):
    """Send file upload progress updates"""
    progress = bytes_uploaded / total_bytes if total_bytes > 0 else 0.0
    
    event = MLEvent(
        event_type=MLEventType.DATA_PROCESSING_PROGRESS,
        session_id=session_id,
        user_id=user_id,
        progress=progress,
        message=f"{processing_stage.title()}: {filename} ({bytes_uploaded}/{total_bytes} bytes)",
        data={
            "filename": filename,
            "bytes_uploaded": bytes_uploaded,
            "total_bytes": total_bytes,
            "processing_stage": processing_stage,
            "upload_speed": _calculate_upload_speed(bytes_uploaded),
            "progress_percentage": round(progress * 100, 2)
        }
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


async def notify_data_quality_assessment(
    session_id: str,
    quality_metrics: Dict[str, Any],
    recommendations: List[str],
    data_issues: List[Dict[str, Any]],
    user_id: Optional[str] = None
):
    """Send data quality assessment results"""
    event = MLEvent(
        event_type=MLEventType.QUALITY_ASSESSMENT_COMPLETED,
        session_id=session_id,
        user_id=user_id,
        progress=1.0,
        message=f"Data quality assessment completed",
        data={
            "quality_score": quality_metrics.get("overall_score", 0),
            "quality_metrics": quality_metrics,
            "recommendations": recommendations,
            "data_issues": data_issues,
            "assessment_timestamp": datetime.utcnow().isoformat()
        }
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


async def notify_hyperparameter_optimization_progress(
    session_id: str,
    optimization_type: str,
    trial_number: int,
    total_trials: int,
    best_score: float,
    current_params: Dict[str, Any],
    best_params: Dict[str, Any],
    user_id: Optional[str] = None
):
    """Send hyperparameter optimization progress"""
    progress = trial_number / total_trials if total_trials > 0 else 0.0
    
    event = MLEvent(
        event_type=MLEventType.RL_SESSION_PROGRESS,
        session_id=session_id,
        user_id=user_id,
        progress=progress,
        message=f"Hyperparameter optimization trial {trial_number}/{total_trials}",
        data={
            "optimization_type": optimization_type,
            "trial_number": trial_number,
            "total_trials": total_trials,
            "best_score": best_score,
            "current_params": current_params,
            "best_params": best_params,
            "progress_percentage": round(progress * 100, 2),
            "optimization_timestamp": datetime.utcnow().isoformat()
        }
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


async def notify_batch_prediction_progress(
    session_id: str,
    model_name: str,
    samples_processed: int,
    total_samples: int,
    current_batch_size: int,
    predictions_preview: Optional[List[Any]] = None,
    user_id: Optional[str] = None
):
    """Send batch prediction progress updates"""
    progress = samples_processed / total_samples if total_samples > 0 else 0.0
    
    event = MLEvent(
        event_type=MLEventType.INFERENCE_STARTED if progress < 1.0 else MLEventType.INFERENCE_COMPLETED,
        session_id=session_id,
        user_id=user_id,
        model_name=model_name,
        progress=progress,
        message=f"Processing batch predictions: {samples_processed}/{total_samples} samples",
        data={
            "samples_processed": samples_processed,
            "total_samples": total_samples,
            "current_batch_size": current_batch_size,
            "predictions_preview": predictions_preview or [],
            "processing_rate": _calculate_processing_rate(samples_processed),
            "progress_percentage": round(progress * 100, 2),
            "estimated_completion": _estimate_completion_time(samples_processed, total_samples)
        }
    )
    await ml_websocket_manager.broadcast_event(event, target_user_id=user_id)


def _estimate_time_remaining(current_epoch: int, total_epochs: int) -> Optional[str]:
    """Estimate remaining training time"""
    if current_epoch == 0:
        return None
    # Simple linear estimation - in practice, this would use actual timing data
    remaining_epochs = total_epochs - current_epoch
    estimated_minutes = remaining_epochs * 2  # Assume 2 minutes per epoch
    return f"{estimated_minutes}m" if estimated_minutes > 0 else "Completing..."


def _calculate_upload_speed(bytes_uploaded: int) -> str:
    """Calculate and format upload speed"""
    # This is a simplified calculation - in practice, you'd track timing
    speed_mbps = bytes_uploaded / (1024 * 1024)  # Convert to MB
    return f"{speed_mbps:.2f} MB/s"


def _calculate_processing_rate(samples_processed: int) -> str:
    """Calculate samples processing rate"""
    # Simplified rate calculation
    rate = samples_processed / max(1, samples_processed // 100)  # Samples per unit time
    return f"{rate:.1f} samples/sec"


def _estimate_completion_time(processed: int, total: int) -> Optional[str]:
    """Estimate completion time for batch operations"""
    if processed == 0:
        return None
    remaining = total - processed
    estimated_seconds = (remaining / processed) * 60  # Rough estimation
    if estimated_seconds < 60:
        return f"{int(estimated_seconds)}s"
    else:
        return f"{int(estimated_seconds // 60)}m {int(estimated_seconds % 60)}s"