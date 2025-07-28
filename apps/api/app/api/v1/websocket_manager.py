"""
WebSocket Manager for Real-Time Pipeline Updates
===============================================

Provides real-time updates for:
- Pipeline progress and status changes
- System health and performance metrics
- Error notifications and alerts
- Data processing events
"""

from fastapi import WebSocket, WebSocketDisconnect, Depends
from fastapi.routing import APIRouter
from typing import Dict, List, Set, Optional, Any
import json
import asyncio
import logging
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from app.auth.dependencies import get_current_user
from app.database.models import User

logger = logging.getLogger(__name__)

class EventType(Enum):
    """Types of WebSocket events"""
    PIPELINE_CREATED = "pipeline_created"
    PIPELINE_STARTED = "pipeline_started"
    PIPELINE_PROGRESS = "pipeline_progress"
    PIPELINE_COMPLETED = "pipeline_completed"
    PIPELINE_FAILED = "pipeline_failed"
    PIPELINE_CANCELLED = "pipeline_cancelled"
    SYSTEM_HEALTH = "system_health"
    SYSTEM_ALERT = "system_alert"
    DATA_QUALITY_UPDATE = "data_quality_update"
    ML_MODEL_READY = "ml_model_ready"

@dataclass
class WebSocketMessage:
    """Structure for WebSocket messages"""
    event_type: EventType
    data: Dict[str, Any]
    timestamp: str
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    pipeline_id: Optional[str] = None

class WebSocketManager:
    """
    Manages WebSocket connections and real-time event broadcasting
    """
    
    def __init__(self):
        # Active connections by user ID
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        
        # Pipeline subscriptions: pipeline_id -> set of user_ids
        self.pipeline_subscriptions: Dict[str, Set[str]] = {}
        
        # Workspace subscriptions: workspace_id -> set of user_ids
        self.workspace_subscriptions: Dict[str, Set[str]] = {}
        
        # System-wide subscriptions: set of user_ids
        self.system_subscriptions: Set[str] = set()
        
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        
        # Statistics
        self.stats = {
            "total_connections": 0,
            "active_connections": 0,
            "messages_sent": 0,
            "errors": 0
        }
    
    async def connect(self, websocket: WebSocket, user_id: str, subscriptions: Dict[str, Any]):
        """
        Accept a new WebSocket connection and set up subscriptions
        
        Args:
            websocket: WebSocket connection
            user_id: User ID for the connection
            subscriptions: Dictionary of subscription types and IDs
        """
        await websocket.accept()
        
        # Add to active connections
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        # Store connection metadata
        self.connection_metadata[websocket] = {
            "user_id": user_id,
            "connected_at": datetime.utcnow(),
            "subscriptions": subscriptions
        }
        
        # Set up subscriptions
        await self._setup_subscriptions(websocket, user_id, subscriptions)
        
        # Update stats
        self.stats["total_connections"] += 1
        self.stats["active_connections"] = len(self._get_all_connections())
        
        # Send connection confirmation
        await self._send_to_websocket(websocket, WebSocketMessage(
            event_type=EventType.SYSTEM_HEALTH,
            data={
                "status": "connected",
                "message": "WebSocket connection established",
                "subscriptions": subscriptions
            },
            timestamp=datetime.utcnow().isoformat(),
            user_id=user_id
        ))
        
        logger.info(f"WebSocket connected for user {user_id} with subscriptions: {subscriptions}")
    
    async def disconnect(self, websocket: WebSocket):
        """
        Handle WebSocket disconnection and cleanup
        """
        if websocket not in self.connection_metadata:
            return
        
        metadata = self.connection_metadata[websocket]
        user_id = metadata["user_id"]
        
        # Remove from active connections
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Remove subscriptions
        await self._cleanup_subscriptions(websocket, user_id)
        
        # Remove metadata
        del self.connection_metadata[websocket]
        
        # Update stats
        self.stats["active_connections"] = len(self._get_all_connections())
        
        logger.info(f"WebSocket disconnected for user {user_id}")
    
    async def _setup_subscriptions(self, websocket: WebSocket, user_id: str, subscriptions: Dict[str, Any]):
        """Set up subscriptions for a WebSocket connection"""
        
        # Pipeline subscriptions
        if "pipelines" in subscriptions:
            for pipeline_id in subscriptions["pipelines"]:
                if pipeline_id not in self.pipeline_subscriptions:
                    self.pipeline_subscriptions[pipeline_id] = set()
                self.pipeline_subscriptions[pipeline_id].add(user_id)
        
        # Workspace subscriptions
        if "workspaces" in subscriptions:
            for workspace_id in subscriptions["workspaces"]:
                if workspace_id not in self.workspace_subscriptions:
                    self.workspace_subscriptions[workspace_id] = set()
                self.workspace_subscriptions[workspace_id].add(user_id)
        
        # System subscriptions
        if subscriptions.get("system", False):
            self.system_subscriptions.add(user_id)
    
    async def _cleanup_subscriptions(self, websocket: WebSocket, user_id: str):
        """Clean up subscriptions for a disconnected WebSocket"""
        
        # Remove from pipeline subscriptions
        for pipeline_id in list(self.pipeline_subscriptions.keys()):
            self.pipeline_subscriptions[pipeline_id].discard(user_id)
            if not self.pipeline_subscriptions[pipeline_id]:
                del self.pipeline_subscriptions[pipeline_id]
        
        # Remove from workspace subscriptions
        for workspace_id in list(self.workspace_subscriptions.keys()):
            self.workspace_subscriptions[workspace_id].discard(user_id)
            if not self.workspace_subscriptions[workspace_id]:
                del self.workspace_subscriptions[workspace_id]
        
        # Remove from system subscriptions
        self.system_subscriptions.discard(user_id)
    
    async def broadcast_pipeline_event(
        self, 
        event_type: EventType, 
        pipeline_id: str, 
        data: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        """
        Broadcast a pipeline-related event to subscribed users
        """
        message = WebSocketMessage(
            event_type=event_type,
            data=data,
            timestamp=datetime.utcnow().isoformat(),
            user_id=user_id,
            pipeline_id=pipeline_id
        )
        
        # Get subscribed users for this pipeline
        subscribed_users = self.pipeline_subscriptions.get(pipeline_id, set())
        
        # Add the pipeline owner if specified
        if user_id:
            subscribed_users.add(user_id)
        
        # Send to all subscribed users
        await self._send_to_users(subscribed_users, message)
        
        logger.debug(f"Broadcast {event_type.value} for pipeline {pipeline_id} to {len(subscribed_users)} users")
    
    async def broadcast_workspace_event(
        self, 
        event_type: EventType, 
        workspace_id: str, 
        data: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        """
        Broadcast a workspace-related event to subscribed users
        """
        message = WebSocketMessage(
            event_type=event_type,
            data=data,
            timestamp=datetime.utcnow().isoformat(),
            user_id=user_id,
            workspace_id=workspace_id
        )
        
        # Get subscribed users for this workspace
        subscribed_users = self.workspace_subscriptions.get(workspace_id, set())
        
        # Send to all subscribed users
        await self._send_to_users(subscribed_users, message)
        
        logger.debug(f"Broadcast {event_type.value} for workspace {workspace_id} to {len(subscribed_users)} users")
    
    async def broadcast_system_event(
        self, 
        event_type: EventType, 
        data: Dict[str, Any]
    ):
        """
        Broadcast a system-wide event to all subscribed users
        """
        message = WebSocketMessage(
            event_type=event_type,
            data=data,
            timestamp=datetime.utcnow().isoformat()
        )
        
        # Send to all system subscribers
        await self._send_to_users(self.system_subscriptions, message)
        
        logger.debug(f"Broadcast {event_type.value} to {len(self.system_subscriptions)} system subscribers")
    
    async def send_to_user(
        self, 
        user_id: str, 
        event_type: EventType, 
        data: Dict[str, Any]
    ):
        """
        Send a message to a specific user
        """
        message = WebSocketMessage(
            event_type=event_type,
            data=data,
            timestamp=datetime.utcnow().isoformat(),
            user_id=user_id
        )
        
        await self._send_to_users({user_id}, message)
    
    async def _send_to_users(self, user_ids: Set[str], message: WebSocketMessage):
        """
        Send a message to multiple users
        """
        for user_id in user_ids:
            if user_id in self.active_connections:
                connections = self.active_connections[user_id].copy()
                for websocket in connections:
                    await self._send_to_websocket(websocket, message)
    
    async def _send_to_websocket(self, websocket: WebSocket, message: WebSocketMessage):
        """
        Send a message to a specific WebSocket connection
        """
        try:
            message_data = {
                "event_type": message.event_type.value,
                "data": message.data,
                "timestamp": message.timestamp,
                "user_id": message.user_id,
                "workspace_id": message.workspace_id,
                "pipeline_id": message.pipeline_id
            }
            
            await websocket.send_text(json.dumps(message_data))
            self.stats["messages_sent"] += 1
            
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {e}")
            self.stats["errors"] += 1
            
            # Remove failed connection
            await self.disconnect(websocket)
    
    def _get_all_connections(self) -> List[WebSocket]:
        """Get all active WebSocket connections"""
        connections = []
        for user_connections in self.active_connections.values():
            connections.extend(user_connections)
        return connections
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            **self.stats,
            "users_connected": len(self.active_connections),
            "pipeline_subscriptions": len(self.pipeline_subscriptions),
            "workspace_subscriptions": len(self.workspace_subscriptions),
            "system_subscriptions": len(self.system_subscriptions)
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on WebSocket connections"""
        
        # Test a few connections
        test_message = WebSocketMessage(
            event_type=EventType.SYSTEM_HEALTH,
            data={"status": "health_check", "timestamp": datetime.utcnow().isoformat()},
            timestamp=datetime.utcnow().isoformat()
        )
        
        healthy_connections = 0
        failed_connections = 0
        
        for user_id, connections in self.active_connections.items():
            for websocket in connections.copy():
                try:
                    await self._send_to_websocket(websocket, test_message)
                    healthy_connections += 1
                except:
                    failed_connections += 1
        
        return {
            "status": "healthy" if failed_connections == 0 else "degraded",
            "healthy_connections": healthy_connections,
            "failed_connections": failed_connections,
            "total_connections": healthy_connections + failed_connections
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Router for WebSocket endpoints
router = APIRouter()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    pipeline_ids: str = "",
    workspace_ids: str = "",
    system_events: bool = False
):
    """
    WebSocket endpoint for real-time updates
    
    Query parameters:
    - pipeline_ids: Comma-separated list of pipeline IDs to subscribe to
    - workspace_ids: Comma-separated list of workspace IDs to subscribe to
    - system_events: Whether to subscribe to system-wide events
    """
    
    # Parse subscriptions
    subscriptions = {}
    
    if pipeline_ids:
        subscriptions["pipelines"] = [pid.strip() for pid in pipeline_ids.split(",") if pid.strip()]
    
    if workspace_ids:
        subscriptions["workspaces"] = [wid.strip() for wid in workspace_ids.split(",") if wid.strip()]
    
    if system_events:
        subscriptions["system"] = True
    
    try:
        # Connect to WebSocket manager
        await websocket_manager.connect(websocket, user_id, subscriptions)
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                
                # Handle client messages (e.g., subscription updates)
                try:
                    message = json.loads(data)
                    await _handle_client_message(websocket, user_id, message)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client {user_id}: {data}")
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error for user {user_id}: {e}")
                break
    
    finally:
        # Clean up connection
        await websocket_manager.disconnect(websocket)

async def _handle_client_message(websocket: WebSocket, user_id: str, message: Dict[str, Any]):
    """Handle messages from WebSocket clients"""
    
    message_type = message.get("type")
    
    if message_type == "ping":
        # Respond to ping with pong
        await websocket.send_text(json.dumps({
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat()
        }))
    
    elif message_type == "subscribe":
        # Handle subscription updates
        new_subscriptions = message.get("subscriptions", {})
        await websocket_manager._setup_subscriptions(websocket, user_id, new_subscriptions)
        
        # Confirm subscription
        await websocket.send_text(json.dumps({
            "type": "subscription_confirmed",
            "subscriptions": new_subscriptions,
            "timestamp": datetime.utcnow().isoformat()
        }))
    
    elif message_type == "unsubscribe":
        # Handle unsubscription
        # TODO: Implement selective unsubscription
        pass
    
    else:
        logger.warning(f"Unknown message type from client {user_id}: {message_type}")

@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics"""
    return websocket_manager.get_connection_stats()

@router.get("/ws/health")
async def websocket_health_check():
    """Perform WebSocket health check"""
    return await websocket_manager.health_check()

# Integration functions for pipeline orchestrator

async def notify_pipeline_created(pipeline_id: str, user_id: str, workspace_id: str, data: Dict[str, Any]):
    """Notify about new pipeline creation"""
    await websocket_manager.broadcast_pipeline_event(
        EventType.PIPELINE_CREATED,
        pipeline_id,
        data,
        user_id
    )

async def notify_pipeline_progress(pipeline_id: str, user_id: str, data: Dict[str, Any]):
    """Notify about pipeline progress updates"""
    await websocket_manager.broadcast_pipeline_event(
        EventType.PIPELINE_PROGRESS,
        pipeline_id,
        data,
        user_id
    )

async def notify_pipeline_completed(pipeline_id: str, user_id: str, data: Dict[str, Any]):
    """Notify about pipeline completion"""
    await websocket_manager.broadcast_pipeline_event(
        EventType.PIPELINE_COMPLETED,
        pipeline_id,
        data,
        user_id
    )

async def notify_pipeline_failed(pipeline_id: str, user_id: str, data: Dict[str, Any]):
    """Notify about pipeline failure"""
    await websocket_manager.broadcast_pipeline_event(
        EventType.PIPELINE_FAILED,
        pipeline_id,
        data,
        user_id
    )

async def notify_system_alert(data: Dict[str, Any]):
    """Notify about system alerts"""
    await websocket_manager.broadcast_system_event(
        EventType.SYSTEM_ALERT,
        data
    ) 