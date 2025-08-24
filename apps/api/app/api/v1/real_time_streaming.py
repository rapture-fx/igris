"""
Real-Time Streaming Dashboard API
=================================

Comprehensive real-time streaming endpoints for:
- Live stream monitoring and metrics
- WebSocket connections for real-time updates
- Stream health and performance monitoring
- Event-driven notifications
- Stream replay and analysis capabilities

Features:
- Real-time stream metrics and analytics
- Live WebSocket dashboards with filtering
- Stream health monitoring and alerts
- Historical data analysis and replay
- Performance optimization insights
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, AsyncGenerator
from collections import defaultdict
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User
from app.api.v1.auth_unified import get_current_user
from app.core.redis_streams import get_streams_client, StreamType, EventType
from app.services.stream_consumers import get_stream_consumer_stats
from app.services.stream_producers import stream_orchestrator
from app.api.v1.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== MODELS ====================

class StreamMetricsRequest(BaseModel):
    """Request model for stream metrics"""
    stream_types: Optional[List[str]] = Field(default=None, description="Filter by stream types")
    time_range: Optional[int] = Field(default=3600, description="Time range in seconds")
    include_consumer_stats: bool = Field(default=True, description="Include consumer statistics")

class StreamMetricsResponse(BaseModel):
    """Response model for stream metrics"""
    stream_health: Dict[str, Any]
    consumer_stats: Dict[str, Any]
    producer_stats: Dict[str, Any]
    real_time_metrics: Dict[str, Any]
    timestamp: str

class LiveStreamConfig(BaseModel):
    """Configuration for live stream monitoring"""
    stream_types: List[str] = Field(default_factory=list)
    event_types: List[str] = Field(default_factory=list)
    update_interval: int = Field(default=1, ge=1, le=60, description="Update interval in seconds")
    max_events_per_update: int = Field(default=50, ge=1, le=1000)
    include_historical: bool = Field(default=False)

class StreamReplayRequest(BaseModel):
    """Request model for stream replay"""
    stream_name: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    event_types: Optional[List[str]] = None
    max_messages: int = Field(default=1000, le=10000)

# ==================== WEBSOCKET CONNECTION MANAGER ====================

class StreamingWebSocketManager:
    """Manages WebSocket connections for streaming data"""
    
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        self.connection_configs: Dict[str, LiveStreamConfig] = {}
        self.broadcast_tasks: Dict[str, asyncio.Task] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str, config: LiveStreamConfig):
        """Connect a new WebSocket for streaming"""
        await websocket.accept()
        
        self.active_connections[connection_id] = {
            "websocket": websocket,
            "connected_at": datetime.utcnow(),
            "last_update": datetime.utcnow(),
            "messages_sent": 0
        }
        
        self.connection_configs[connection_id] = config
        
        # Start broadcasting task for this connection
        self.broadcast_tasks[connection_id] = asyncio.create_task(
            self._broadcast_to_connection(connection_id)
        )
        
        logger.info(f"WebSocket connected: {connection_id}")
    
    async def disconnect(self, connection_id: str):
        """Disconnect WebSocket and cleanup"""
        
        # Cancel broadcast task
        if connection_id in self.broadcast_tasks:
            self.broadcast_tasks[connection_id].cancel()
            del self.broadcast_tasks[connection_id]
        
        # Remove connection
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        if connection_id in self.connection_configs:
            del self.connection_configs[connection_id]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def _broadcast_to_connection(self, connection_id: str):
        """Broadcast stream updates to a specific connection"""
        
        connection = self.active_connections.get(connection_id)
        config = self.connection_configs.get(connection_id)
        
        if not connection or not config:
            return
        
        websocket = connection["websocket"]
        
        try:
            while connection_id in self.active_connections:
                # Get stream data based on configuration
                stream_data = await self._get_stream_data_for_connection(config)
                
                if stream_data:
                    await websocket.send_text(json.dumps({
                        "type": "stream_update",
                        "timestamp": datetime.utcnow().isoformat(),
                        "data": stream_data
                    }))
                    
                    connection["messages_sent"] += 1
                    connection["last_update"] = datetime.utcnow()
                
                # Wait for next update interval
                await asyncio.sleep(config.update_interval)
                
        except WebSocketDisconnect:
            await self.disconnect(connection_id)
        except Exception as e:
            logger.error(f"Error broadcasting to connection {connection_id}: {e}")
            await self.disconnect(connection_id)
    
    async def _get_stream_data_for_connection(self, config: LiveStreamConfig) -> Dict[str, Any]:
        """Get stream data for a specific connection configuration"""
        
        try:
            streams_client = await get_streams_client()
            data = {
                "streams": {},
                "metrics": {},
                "alerts": [],
                "recent_events": []
            }
            
            # Get data for each configured stream type
            for stream_type in config.stream_types:
                if hasattr(StreamType, stream_type.upper()):
                    stream_name = StreamType[stream_type.upper()].value
                    
                    # Get stream info
                    stream_info = await streams_client.get_stream_info(stream_name)
                    data["streams"][stream_type] = stream_info
                    
                    # Get recent messages if configured
                    if config.max_events_per_update > 0:
                        recent_messages = []
                        async for message in streams_client.replay_messages(
                            stream_name,
                            start_id="-",  # Recent messages
                            count=config.max_events_per_update
                        ):
                            recent_messages.append({
                                "id": message.id,
                                "event_type": message.event_type.value,
                                "timestamp": message.timestamp,
                                "data": message.data,
                                "source": message.source
                            })
                        
                        data["recent_events"].extend(recent_messages)
            
            # Get consumer metrics
            consumer_stats = get_stream_consumer_stats()
            data["metrics"]["consumers"] = consumer_stats
            
            # Get streams client metrics
            streams_metrics = streams_client.get_metrics()
            data["metrics"]["client"] = streams_metrics
            
            return data
            
        except Exception as e:
            logger.error(f"Error getting stream data: {e}")
            return {}
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        
        total_messages = sum(
            conn["messages_sent"] for conn in self.active_connections.values()
        )
        
        return {
            "active_connections": len(self.active_connections),
            "total_messages_sent": total_messages,
            "active_broadcast_tasks": len(self.broadcast_tasks)
        }

# Global WebSocket manager
streaming_ws_manager = StreamingWebSocketManager()

# ==================== API ENDPOINTS ====================

@router.get("/metrics", response_model=StreamMetricsResponse)
async def get_stream_metrics(
    request: StreamMetricsRequest = Depends(),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive real-time streaming metrics
    
    Returns detailed metrics about:
    - Stream health and performance
    - Consumer processing statistics
    - Producer throughput rates
    - Real-time event counts
    """
    
    try:
        streams_client = await get_streams_client()
        
        # Get stream health
        stream_health = await streams_client.health_check()
        
        # Get consumer stats
        consumer_stats = {}
        if request.include_consumer_stats:
            consumer_stats = get_stream_consumer_stats()
        
        # Get producer stats
        producer_stats = {}
        if stream_orchestrator.producers:
            for name, producer in stream_orchestrator.producers.items():
                producer_stats[name] = {
                    "enabled": producer.config.enabled,
                    "rate_per_second": producer.config.rate_per_second,
                    "running": getattr(producer, 'running', False)
                }
        
        # Get real-time metrics from Redis Streams client
        real_time_metrics = streams_client.get_metrics()
        
        # Add WebSocket connection stats
        ws_stats = streaming_ws_manager.get_connection_stats()
        real_time_metrics["websocket_connections"] = ws_stats
        
        return StreamMetricsResponse(
            stream_health=stream_health,
            consumer_stats=consumer_stats,
            producer_stats=producer_stats,
            real_time_metrics=real_time_metrics,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error getting stream metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve stream metrics"
        )

@router.websocket("/live")
async def live_stream_websocket(
    websocket: WebSocket,
    stream_types: str = Query(default="iot_sensors,financial_transactions,ecommerce_events"),
    event_types: str = Query(default=""),
    update_interval: int = Query(default=2, ge=1, le=60),
    max_events: int = Query(default=50, ge=1, le=1000)
):
    """
    WebSocket endpoint for real-time stream monitoring
    
    Query Parameters:
    - stream_types: Comma-separated list of stream types to monitor
    - event_types: Comma-separated list of event types to filter
    - update_interval: Update frequency in seconds
    - max_events: Maximum events per update
    """
    
    # Parse configuration
    config = LiveStreamConfig(
        stream_types=[s.strip() for s in stream_types.split(",") if s.strip()],
        event_types=[e.strip() for e in event_types.split(",") if e.strip()],
        update_interval=update_interval,
        max_events_per_update=max_events
    )
    
    connection_id = f"stream_ws_{int(time.time())}_{id(websocket)}"
    
    try:
        await streaming_ws_manager.connect(websocket, connection_id, config)
        
        # Keep connection alive
        while True:
            try:
                # Handle client messages (ping/pong, config updates)
                message = await websocket.receive_text()
                
                try:
                    client_data = json.loads(message)
                    
                    if client_data.get("type") == "ping":
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                    
                    elif client_data.get("type") == "config_update":
                        # Update configuration
                        new_config = LiveStreamConfig(**client_data.get("config", {}))
                        streaming_ws_manager.connection_configs[connection_id] = new_config
                        
                        await websocket.send_text(json.dumps({
                            "type": "config_updated",
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client: {message}")
            
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error for connection {connection_id}: {e}")
                break
    
    finally:
        await streaming_ws_manager.disconnect(connection_id)

@router.post("/replay")
async def replay_stream_messages(
    request: StreamReplayRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Replay messages from a stream for analysis or recovery
    
    Allows replaying historical messages from streams with filtering options.
    Useful for:
    - Debugging stream processing issues
    - Re-processing historical data
    - Data analysis and auditing
    """
    
    try:
        streams_client = await get_streams_client()
        
        # Validate stream name
        try:
            StreamType(request.stream_name)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid stream name: {request.stream_name}"
            )
        
        messages = []
        message_count = 0
        
        # Calculate start and end IDs based on timestamps
        start_id = "0"
        end_id = "+"
        
        if request.start_time:
            # Convert timestamp to Redis stream ID format
            start_timestamp = int(request.start_time.timestamp() * 1000)
            start_id = f"{start_timestamp}-0"
        
        if request.end_time:
            end_timestamp = int(request.end_time.timestamp() * 1000)
            end_id = f"{end_timestamp}-0"
        
        # Replay messages
        async for message in streams_client.replay_messages(
            request.stream_name,
            start_id=start_id,
            end_id=end_id,
            count=100  # Process in batches
        ):
            # Apply event type filter if specified
            if request.event_types and message.event_type.value not in request.event_types:
                continue
            
            messages.append({
                "id": message.id,
                "event_type": message.event_type.value,
                "timestamp": message.timestamp,
                "source": message.source,
                "correlation_id": message.correlation_id,
                "data": message.data
            })
            
            message_count += 1
            
            # Limit results
            if message_count >= request.max_messages:
                break
        
        return {
            "stream_name": request.stream_name,
            "message_count": len(messages),
            "messages": messages,
            "replay_config": {
                "start_time": request.start_time.isoformat() if request.start_time else None,
                "end_time": request.end_time.isoformat() if request.end_time else None,
                "event_types": request.event_types,
                "max_messages": request.max_messages
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error replaying stream messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to replay stream messages"
        )

@router.get("/health")
async def get_streaming_health(
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive health status of the streaming system
    
    Returns health information for:
    - Redis Streams connectivity
    - Producer status
    - Consumer status
    - WebSocket connections
    """
    
    try:
        # Get streams client health
        streams_client = await get_streams_client()
        streams_health = await streams_client.health_check()
        
        # Get consumer stats
        consumer_stats = get_stream_consumer_stats()
        consumer_health = "healthy"
        
        for stream_name, stats in consumer_stats.items():
            if stats["success_rate"] < 0.9:  # Less than 90% success rate
                consumer_health = "degraded"
            if stats["success_rate"] < 0.5:  # Less than 50% success rate
                consumer_health = "unhealthy"
                break
        
        # Get producer health
        producer_health = "healthy"
        producer_count = len(stream_orchestrator.producers)
        running_producers = sum(
            1 for p in stream_orchestrator.producers.values() 
            if getattr(p, 'running', False)
        )
        
        if producer_count == 0:
            producer_health = "not_configured"
        elif running_producers < producer_count:
            producer_health = "degraded"
        
        # Get WebSocket health
        ws_stats = streaming_ws_manager.get_connection_stats()
        
        # Overall health assessment
        overall_health = "healthy"
        if (streams_health["status"] == "unhealthy" or 
            consumer_health == "unhealthy" or 
            producer_health == "unhealthy"):
            overall_health = "unhealthy"
        elif (streams_health["status"] == "degraded" or 
              consumer_health == "degraded" or 
              producer_health == "degraded"):
            overall_health = "degraded"
        
        return {
            "overall_health": overall_health,
            "components": {
                "redis_streams": streams_health,
                "consumers": {
                    "health": consumer_health,
                    "stats": consumer_stats
                },
                "producers": {
                    "health": producer_health,
                    "total_configured": producer_count,
                    "running": running_producers
                },
                "websocket_connections": ws_stats
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting streaming health: {e}")
        return {
            "overall_health": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.get("/analytics")
async def get_stream_analytics(
    stream_type: Optional[str] = Query(None),
    time_range: int = Query(default=3600, description="Time range in seconds"),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed analytics about stream processing
    
    Returns analytics including:
    - Message throughput over time
    - Error rates and patterns
    - Consumer performance metrics
    - Stream-specific insights
    """
    
    try:
        # Get consumer stats
        consumer_stats = get_stream_consumer_stats()
        
        # Get streams client metrics
        streams_client = await get_streams_client()
        streams_metrics = streams_client.get_metrics()
        
        # Calculate analytics
        analytics = {
            "time_range_seconds": time_range,
            "throughput_analysis": {},
            "error_analysis": {},
            "performance_insights": [],
            "stream_summary": {}
        }
        
        # Throughput analysis
        total_processed = streams_metrics["stream_metrics"]["messages_consumed"]
        throughput = streams_metrics["stream_metrics"]["throughput"]
        
        analytics["throughput_analysis"] = {
            "messages_per_second": throughput,
            "total_messages_processed": total_processed,
            "estimated_daily_volume": throughput * 86400  # 24 hours
        }
        
        # Error analysis
        error_rate = streams_metrics["stream_metrics"]["error_rate"]
        analytics["error_analysis"] = {
            "error_rate": error_rate,
            "error_trend": "stable" if error_rate < 0.1 else "elevated",
            "total_errors": streams_metrics["stream_metrics"]["messages_failed"]
        }
        
        # Performance insights
        avg_processing_time = streams_metrics["stream_metrics"]["processing_time_avg"]
        
        if avg_processing_time > 1.0:  # Over 1 second
            analytics["performance_insights"].append({
                "type": "slow_processing",
                "message": f"Average processing time is {avg_processing_time:.2f}s - consider optimization",
                "severity": "medium"
            })
        
        if error_rate > 0.1:  # Over 10% error rate
            analytics["performance_insights"].append({
                "type": "high_error_rate",
                "message": f"Error rate is {error_rate:.1%} - investigate consumer issues",
                "severity": "high"
            })
        
        # Stream-specific summary
        for stream_name, stats in consumer_stats.items():
            analytics["stream_summary"][stream_name] = {
                "success_rate": stats["success_rate"],
                "avg_processing_time": stats["avg_processing_time"],
                "total_processed": stats["processed"],
                "health_status": "healthy" if stats["success_rate"] > 0.9 else "degraded"
            }
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error getting stream analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve stream analytics"
        )

@router.post("/control/start-producers")
async def start_producers(
    background_tasks: BackgroundTasks,
    config: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Start stream producers with optional configuration
    
    Starts data generation for all configured stream types.
    Useful for testing and demonstration purposes.
    """
    
    try:
        from app.services.stream_producers import start_stream_producers
        
        # Start producers in background
        background_tasks.add_task(start_stream_producers, config)
        
        return {
            "status": "started",
            "message": "Stream producers started successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting producers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start stream producers"
        )

@router.post("/control/stop-producers")
async def stop_producers(
    current_user: User = Depends(get_current_user)
):
    """
    Stop all stream producers
    
    Stops data generation for all stream types.
    """
    
    try:
        from app.services.stream_producers import stop_stream_producers
        
        stop_stream_producers()
        
        return {
            "status": "stopped",
            "message": "Stream producers stopped successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error stopping producers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop stream producers"
        )

@router.get("/dashboard/summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user)
):
    """
    Get summary data for the real-time streaming dashboard
    
    Returns key metrics and status information for dashboard display.
    """
    
    try:
        # Get comprehensive system status
        health_data = await get_streaming_health(current_user)
        metrics_data = await get_stream_metrics(
            StreamMetricsRequest(include_consumer_stats=True),
            current_user
        )
        
        # Calculate summary statistics
        total_messages = metrics_data.real_time_metrics["stream_metrics"]["messages_consumed"]
        throughput = metrics_data.real_time_metrics["stream_metrics"]["throughput"]
        error_rate = metrics_data.real_time_metrics["stream_metrics"]["error_rate"]
        
        # Get stream info
        streams_client = await get_streams_client()
        stream_info = {}
        
        for stream_type in StreamType:
            try:
                info = await streams_client.get_stream_info(stream_type.value)
                stream_info[stream_type.value] = {
                    "length": info.get("length", 0),
                    "consumer_groups": len(info.get("consumer_groups", []))
                }
            except:
                stream_info[stream_type.value] = {"length": 0, "consumer_groups": 0}
        
        return {
            "overall_health": health_data["overall_health"],
            "key_metrics": {
                "total_messages_processed": total_messages,
                "current_throughput": round(throughput, 2),
                "error_rate": round(error_rate * 100, 2),  # As percentage
                "active_streams": len([s for s in stream_info.values() if s["length"] > 0]),
                "total_stream_length": sum(s["length"] for s in stream_info.values())
            },
            "stream_details": stream_info,
            "consumer_performance": metrics_data.consumer_stats,
            "websocket_connections": metrics_data.real_time_metrics.get("websocket_connections", {}),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard summary"
        )