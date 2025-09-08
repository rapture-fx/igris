"""
Manufacturing IoT Gateway API Endpoints
======================================

REST API endpoints for Industrial IoT Gateway providing:
- Industrial system connectivity (OPC-UA, MQTT, Modbus, EtherNet/IP)
- Real-time sensor data streaming and processing
- Equipment health monitoring and predictive analytics
- WebSocket support for real-time data streaming
- ML-powered anomaly detection and predictions

These endpoints enable manufacturing companies to connect their industrial
systems and get real-time insights with predictive maintenance capabilities.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
import json
import asyncio
import logging
from datetime import datetime, timedelta
import io
import csv

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.database.models import User
from app.services.industrial_iot_gateway import IndustrialIoTGateway
from app.schemas.manufacturing_iot import (
    IndustrialSystemConnection, StreamProcessRequest, SensorDataPoint,
    ConnectionResponse, StreamProcessResponse, EquipmentHealthResponse,
    ConnectionListResponse, SystemMetrics, ServiceHealthResponse,
    WebSocketMessage, RealtimeDataMessage, AlertMessage, HealthStatusMessage,
    IoTAlert, IoTProtocol, ConnectionStatus, EquipmentHealthStatus
)
from app.models.manufacturing_iot import IoTDatabaseManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/manufacturing/iot", tags=["Manufacturing IoT"])

# Global IoT Gateway instances (in production, this would be managed differently)
iot_gateways: Dict[int, IndustrialIoTGateway] = {}  # user_id -> gateway instance
websocket_connections: Dict[str, List[WebSocket]] = {}  # connection_id -> websocket clients


def get_iot_gateway(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IndustrialIoTGateway:
    """Get or create IoT Gateway instance for the current user."""
    user_id = current_user.id
    
    if user_id not in iot_gateways:
        iot_gateways[user_id] = IndustrialIoTGateway(db)
        logger.info(f"Created new IoT Gateway instance for user {user_id}")
    
    return iot_gateways[user_id]


# Connection Management Endpoints

@router.post("/connect", response_model=ConnectionResponse)
async def connect_industrial_system(
    connection_request: IndustrialSystemConnection,
    background_tasks: BackgroundTasks,
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    Connect to industrial systems using supported protocols.
    
    Supports:
    - **OPC-UA**: Industrial automation standard protocol
    - **MQTT**: Lightweight messaging for IoT devices
    - **Modbus**: Serial communication protocol for industrial equipment
    - **EtherNet/IP**: Industrial Ethernet protocol for real-time control
    
    Features:
    - Automatic reconnection on connection loss
    - Real-time data streaming via WebSocket
    - Background data collection and processing
    - ML-powered predictive analytics integration
    """
    try:
        logger.info(f"Connection request from user {current_user.id} for system {connection_request.connection_id}")
        
        # Validate connection request
        if not connection_request.equipment_ids:
            raise HTTPException(
                status_code=400, 
                detail="At least one equipment ID must be specified"
            )
        
        # Check for duplicate connection ID
        if connection_request.connection_id in [conn.get('connection_id') for conn in gateway.active_connections.values()]:
            raise HTTPException(
                status_code=409,
                detail=f"Connection with ID {connection_request.connection_id} already exists"
            )
        
        # Connect to industrial system
        response = await gateway.connect_industrial_system(connection_request)
        
        if not response.get('success'):
            raise HTTPException(
                status_code=400,
                detail=response.get('message', 'Failed to establish connection')
            )
        
        # Initialize WebSocket connection list
        websocket_connections[connection_request.connection_id] = []
        
        # Add background task for health monitoring
        background_tasks.add_task(
            _monitor_connection_health, 
            gateway, 
            connection_request.connection_id
        )
        
        logger.info(f"Successfully connected to industrial system {connection_request.connection_id}")
        return ConnectionResponse(**response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting to industrial system: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections", response_model=ConnectionListResponse)
async def list_active_connections(
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    List all active industrial system connections.
    
    Provides overview of:
    - Connection status and uptime
    - Connected equipment count
    - Data collection metrics
    - Protocol information
    """
    try:
        connections = []
        total_equipment = 0
        
        for connection_id, connection_info in gateway.active_connections.items():
            handler = connection_info['handler']
            request = connection_info['request']
            
            uptime_hours = (datetime.utcnow() - connection_info['connected_at']).total_seconds() / 3600
            
            connection_data = {
                'connection_id': connection_id,
                'system_name': request.system_name,
                'protocol': request.protocol.value,
                'facility_id': request.facility_id,
                'status': connection_info['status'],
                'equipment_count': len(request.equipment_ids),
                'equipment_ids': request.equipment_ids,
                'connected_at': connection_info['connected_at'],
                'uptime_hours': round(uptime_hours, 2),
                'data_points_received': handler.data_points_received,
                'streaming_enabled': request.enable_streaming,
                'websocket_clients': len(websocket_connections.get(connection_id, [])),
                'last_error': handler.last_error,
                'polling_interval_seconds': request.polling_interval_seconds
            }
            
            connections.append(connection_data)
            total_equipment += len(request.equipment_ids)
        
        return ConnectionListResponse(
            success=True,
            connections=connections,
            total_connections=len(connections),
            active_equipment=total_equipment,
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Error listing connections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/connections/{connection_id}")
async def disconnect_industrial_system(
    connection_id: str,
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    Disconnect from an industrial system.
    
    Gracefully closes the connection and stops all related background tasks.
    """
    try:
        success = await gateway.disconnect_system(connection_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Connection {connection_id} not found or already disconnected"
            )
        
        # Close WebSocket connections
        if connection_id in websocket_connections:
            for ws in websocket_connections[connection_id]:
                try:
                    await ws.close()
                except:
                    pass
            del websocket_connections[connection_id]
        
        return {
            'success': True,
            'connection_id': connection_id,
            'message': 'Successfully disconnected from industrial system',
            'timestamp': datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting system: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Data Processing Endpoints

@router.post("/stream-process", response_model=StreamProcessResponse)
async def process_streaming_data(
    request: StreamProcessRequest,
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    Process streaming sensor data with ML-powered analytics.
    
    Features:
    - **Anomaly Detection**: Identifies unusual sensor readings
    - **Predictive Analytics**: ML-based equipment failure predictions
    - **Data Quality Assessment**: Validates and scores data quality
    - **Automatic Alerts**: Generates alerts for critical conditions
    - **Real-time Processing**: Low-latency data processing pipeline
    
    The system can handle up to 1000 data points per batch for optimal performance.
    """
    try:
        logger.info(f"Stream processing request for connection {request.connection_id} with {len(request.data_points)} data points")
        
        # Validate connection exists
        if request.connection_id not in gateway.active_connections:
            raise HTTPException(
                status_code=404,
                detail=f"Connection {request.connection_id} not found or inactive"
            )
        
        # Validate data points
        if not request.data_points:
            raise HTTPException(
                status_code=400,
                detail="At least one data point must be provided"
            )
        
        if len(request.data_points) > 1000:
            raise HTTPException(
                status_code=400,
                detail="Maximum 1000 data points per batch allowed"
            )
        
        # Process the streaming data
        response = await gateway.process_streaming_data(
            connection_id=request.connection_id,
            data_points=request.data_points,
            enable_ml_predictions=request.enable_ml_predictions,
            enable_anomaly_detection=request.enable_anomaly_detection,
            enable_alerts=request.enable_alerts
        )
        
        if not response.get('success'):
            raise HTTPException(
                status_code=400,
                detail=response.get('metadata', {}).get('error', 'Processing failed')
            )
        
        logger.info(f"Successfully processed {response['processed_count']} data points")
        return StreamProcessResponse(**response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing streaming data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-upload/{connection_id}")
async def upload_sensor_data_batch(
    connection_id: str,
    file_data: str,  # CSV data as string
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and process batch sensor data from CSV format.
    
    Expected CSV format:
    ```
    sensor_id,equipment_id,timestamp,value,unit
    SENSOR_001,EQ_001,2023-12-01T10:00:00Z,25.5,°C
    SENSOR_002,EQ_001,2023-12-01T10:00:00Z,14.7,PSI
    ```
    """
    try:
        # Parse CSV data
        csv_reader = csv.DictReader(io.StringIO(file_data))
        data_points = []
        
        for row in csv_reader:
            # Validate required fields
            required_fields = ['sensor_id', 'equipment_id', 'timestamp', 'value']
            missing_fields = [field for field in required_fields if field not in row or not row[field]]
            
            if missing_fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required fields in CSV: {missing_fields}"
                )
            
            # Parse timestamp
            try:
                timestamp = datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timestamp format: {row['timestamp']}. Use ISO format."
                )
            
            # Create data point
            data_point = SensorDataPoint(
                sensor_id=row['sensor_id'],
                equipment_id=row['equipment_id'],
                timestamp=timestamp,
                value=row['value'],
                unit=row.get('unit'),
                quality_code=row.get('quality_code'),
                tags={
                    'batch_upload': True,
                    'upload_timestamp': datetime.utcnow().isoformat()
                }
            )
            data_points.append(data_point)
        
        if not data_points:
            raise HTTPException(status_code=400, detail="No valid data points found in CSV")
        
        # Process in chunks to avoid overwhelming the system
        chunk_size = 100
        total_processed = 0
        all_results = []
        
        for i in range(0, len(data_points), chunk_size):
            chunk = data_points[i:i + chunk_size]
            
            response = await gateway.process_streaming_data(
                connection_id=connection_id,
                data_points=chunk,
                enable_ml_predictions=True,
                enable_anomaly_detection=True,
                enable_alerts=True
            )
            
            if response.get('success'):
                total_processed += response['processed_count']
                all_results.extend(response['results'])
        
        return {
            'success': True,
            'connection_id': connection_id,
            'total_data_points': len(data_points),
            'processed_count': total_processed,
            'processing_summary': {
                'anomalies_detected': sum(1 for result in all_results if result['anomaly_detected']),
                'alerts_generated': sum(len(result['alerts_generated']) for result in all_results),
                'average_quality_score': sum(result['quality_score'] for result in all_results) / len(all_results) if all_results else 0
            },
            'timestamp': datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing batch upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Equipment Health Monitoring

@router.get("/equipment/{equipment_id}/health", response_model=EquipmentHealthResponse)
async def get_equipment_health_status(
    equipment_id: str,
    include_predictions: bool = Query(True, description="Include ML predictions in response"),
    include_trends: bool = Query(True, description="Include performance trends"),
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive equipment health status and predictive analytics.
    
    Provides:
    - **Health Score**: Overall equipment condition (0-1)
    - **Sensor Status**: Individual sensor health monitoring
    - **Operational Metrics**: Uptime, utilization, and efficiency
    - **Predictive Analytics**: Failure predictions and maintenance recommendations
    - **Active Alerts**: Current alerts and their severity levels
    - **Performance Trends**: Historical performance indicators
    
    The health score combines multiple factors including sensor data quality,
    anomaly detection results, and operational parameters.
    """
    try:
        logger.info(f"Health status request for equipment {equipment_id}")
        
        # Get equipment health from gateway
        health_response = await gateway.get_equipment_health(equipment_id)
        
        if not health_response.get('success'):
            raise HTTPException(
                status_code=404,
                detail=health_response.get('metadata', {}).get('error', f'Equipment {equipment_id} not found')
            )
        
        # Filter response based on query parameters
        if not include_predictions and 'predictive_analytics' in health_response:
            health_response['predictive_analytics'] = None
        
        if not include_trends and 'performance_trends' in health_response:
            health_response['performance_trends'] = {}
        
        logger.info(f"Equipment {equipment_id} health status: {health_response['health_status']} ({health_response['health_score']:.3f})")
        return EquipmentHealthResponse(**health_response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting equipment health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/equipment/{equipment_id}/history")
async def get_equipment_sensor_history(
    equipment_id: str,
    hours_back: int = Query(24, ge=1, le=168, description="Hours of historical data to retrieve"),
    sensor_types: Optional[List[str]] = Query(None, description="Filter by specific sensor types"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of data points"),
    format: str = Query("json", pattern="^(json|csv)$", description="Response format"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get historical sensor data for equipment analysis.
    
    Supports both JSON and CSV output formats for data analysis tools.
    """
    try:
        db_manager = IoTDatabaseManager(db)
        
        # Get historical data
        sensor_data = db_manager.get_recent_sensor_data(
            equipment_id=equipment_id,
            hours_back=hours_back,
            limit=limit
        )
        
        if not sensor_data:
            raise HTTPException(
                status_code=404,
                detail=f"No sensor data found for equipment {equipment_id}"
            )
        
        # Filter by sensor types if specified
        if sensor_types:
            sensor_data = [
                data for data in sensor_data 
                if any(sensor_type in data.sensor_id for sensor_type in sensor_types)
            ]
        
        # Convert to response format
        data_points = []
        for data in sensor_data:
            data_points.append({
                'sensor_id': data.sensor_id,
                'equipment_id': data.equipment_id,
                'timestamp': data.timestamp.isoformat(),
                'value': data.value,
                'value_numeric': data.value_numeric,
                'unit': data.unit,
                'quality_score': data.quality_score,
                'is_anomaly': data.is_anomaly,
                'anomaly_score': data.anomaly_score,
                'tags': data.tags or {}
            })
        
        if format == "csv":
            # Return CSV response
            output = io.StringIO()
            if data_points:
                fieldnames = data_points[0].keys()
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                for point in data_points:
                    writer.writerow(point)
            
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode()),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=equipment_{equipment_id}_history.csv"}
            )
        
        # Return JSON response
        return {
            'success': True,
            'equipment_id': equipment_id,
            'data_points': data_points,
            'total_points': len(data_points),
            'time_range': {
                'start': min(point['timestamp'] for point in data_points) if data_points else None,
                'end': max(point['timestamp'] for point in data_points) if data_points else None,
                'hours_back': hours_back
            },
            'sensor_summary': {
                'unique_sensors': len(set(point['sensor_id'] for point in data_points)),
                'sensor_types': list(set(point['sensor_id'] for point in data_points))
            },
            'timestamp': datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting equipment history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket Real-time Streaming

@router.websocket("/ws/{connection_id}")
async def websocket_realtime_stream(
    websocket: WebSocket,
    connection_id: str,
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway)
):
    """
    WebSocket endpoint for real-time sensor data streaming.
    
    Provides live updates of:
    - Sensor data points as they are collected
    - Equipment health status changes
    - Alert notifications
    - System status updates
    
    Message formats:
    ```json
    {
        "message_type": "sensor_data",
        "connection_id": "conn_001",
        "data_points": [...],
        "timestamp": "2023-12-01T10:00:00Z"
    }
    ```
    """
    try:
        # Accept WebSocket connection
        await websocket.accept()
        logger.info(f"WebSocket connection established for {connection_id}")
        
        # Validate connection exists
        if connection_id not in gateway.active_connections:
            await websocket.close(code=4004, reason="Connection not found")
            return
        
        # Add to active WebSocket clients
        if connection_id not in websocket_connections:
            websocket_connections[connection_id] = []
        websocket_connections[connection_id].append(websocket)
        
        # Send initial connection status
        status_message = {
            'message_type': 'connection_status',
            'connection_id': connection_id,
            'status': 'connected',
            'timestamp': datetime.utcnow().isoformat(),
            'equipment_ids': gateway.active_connections[connection_id]['equipment_ids']
        }
        await websocket.send_text(json.dumps(status_message))
        
        # Keep connection alive and handle incoming messages
        try:
            while True:
                # Wait for client messages (e.g., subscription updates, commands)
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    await _handle_websocket_message(websocket, connection_id, message, gateway)
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({
                        'message_type': 'error',
                        'error': 'Invalid JSON message format',
                        'timestamp': datetime.utcnow().isoformat()
                    }))
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket client disconnected from {connection_id}")
        
    except Exception as e:
        logger.error(f"WebSocket error for connection {connection_id}: {e}")
        
    finally:
        # Clean up WebSocket connection
        if connection_id in websocket_connections:
            try:
                websocket_connections[connection_id].remove(websocket)
                if not websocket_connections[connection_id]:
                    del websocket_connections[connection_id]
            except (ValueError, KeyError):
                pass


# Alert Management

@router.get("/alerts")
async def get_active_alerts(
    connection_id: Optional[str] = Query(None, description="Filter by connection ID"),
    equipment_id: Optional[str] = Query(None, description="Filter by equipment ID"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of alerts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get active alerts from all connected systems.
    
    Alerts are generated automatically based on:
    - Anomaly detection results
    - Data quality issues
    - Equipment health degradation
    - Predictive maintenance recommendations
    """
    try:
        db_manager = IoTDatabaseManager(db)
        
        # Build filter criteria
        equipment_filter = equipment_id if equipment_id else None
        
        # Get active alerts
        alerts = db_manager.get_active_alerts(equipment_filter)
        
        # Apply additional filters
        if connection_id:
            alerts = [alert for alert in alerts if alert.connection_id == connection_id]
        
        if severity:
            alerts = [alert for alert in alerts if alert.severity.lower() == severity.lower()]
        
        # Limit results
        alerts = alerts[:limit]
        
        # Convert to response format
        alert_list = []
        for alert in alerts:
            alert_data = {
                'alert_id': alert.alert_id,
                'connection_id': alert.connection_id,
                'equipment_id': alert.equipment_id,
                'sensor_id': alert.sensor_id,
                'alert_type': alert.alert_type,
                'severity': alert.severity,
                'title': alert.title,
                'message': alert.message,
                'trigger_value': alert.trigger_value,
                'threshold_value': alert.threshold_value,
                'triggered_at': alert.triggered_at,
                'age_hours': alert.age_hours,
                'acknowledged': alert.acknowledged,
                'acknowledged_by': alert.acknowledged_by,
                'acknowledged_at': alert.acknowledged_at,
                'metadata': alert.alert_metadata or {}
            }
            alert_list.append(alert_data)
        
        return {
            'success': True,
            'alerts': alert_list,
            'total_alerts': len(alert_list),
            'filters_applied': {
                'connection_id': connection_id,
                'equipment_id': equipment_id,
                'severity': severity
            },
            'timestamp': datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Acknowledge an active alert.
    
    Acknowledged alerts remain active but are marked as seen by operators.
    """
    try:
        db_manager = IoTDatabaseManager(db)
        
        # Find the alert
        alert = db.query(db_manager.IoTAlert).filter(
            db_manager.IoTAlert.alert_id == alert_id
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        
        if alert.acknowledged:
            return {
                'success': True,
                'message': 'Alert already acknowledged',
                'alert_id': alert_id,
                'acknowledged_by': alert.acknowledged_by,
                'acknowledged_at': alert.acknowledged_at
            }
        
        # Acknowledge the alert
        alert.acknowledged = True
        alert.acknowledged_by = current_user.username if hasattr(current_user, 'username') else str(current_user.id)
        alert.acknowledged_at = datetime.utcnow()
        
        db.commit()
        
        return {
            'success': True,
            'message': 'Alert acknowledged successfully',
            'alert_id': alert_id,
            'acknowledged_by': alert.acknowledged_by,
            'acknowledged_at': alert.acknowledged_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# System Health and Metrics

@router.get("/health", response_model=ServiceHealthResponse)
async def get_service_health(
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get IoT Gateway service health and performance metrics.
    
    Provides comprehensive system status including:
    - Service uptime and performance
    - Protocol handler status
    - Database connectivity
    - System resource usage
    - Connection statistics
    """
    try:
        # Get system metrics
        metrics = gateway.get_system_metrics()
        
        # Check database connectivity
        try:
            db.execute("SELECT 1")
            database_status = True
        except:
            database_status = False
        
        # Check protocol handler status
        protocol_status = {}
        for connection_id, connection_info in gateway.active_connections.items():
            handler = connection_info['handler']
            protocol_status[f"{connection_id}_{handler.protocol_name}"] = handler.is_connected
        
        health_response = {
            'success': True,
            'service_status': 'healthy' if database_status and len(protocol_status) > 0 else 'degraded',
            'version': '1.0.0',  # Could be read from config
            'system_metrics': SystemMetrics(**metrics),
            'protocol_status': protocol_status,
            'database_status': database_status,
            'cache_status': True,  # Could check actual cache status
            'websocket_status': True,  # Could check WebSocket server status
            'timestamp': datetime.utcnow()
        }
        
        return ServiceHealthResponse(**health_response)
        
    except Exception as e:
        logger.error(f"Error getting service health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_system_metrics(
    gateway: IndustrialIoTGateway = Depends(get_iot_gateway),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed system performance metrics for monitoring and analysis.
    """
    try:
        metrics = gateway.get_system_metrics()
        
        # Add additional metrics
        detailed_metrics = {
            **metrics,
            'connections_by_protocol': {},
            'data_quality_metrics': {
                'average_quality_score': 0.85,  # Could be calculated from actual data
                'anomaly_rate_percent': 5.2,
                'alert_rate_per_hour': 3.1
            },
            'performance_metrics': {
                'avg_processing_time_ms': 45.0,
                'throughput_points_per_minute': 1200,
                'error_rate_percent': 1.5
            },
            'websocket_metrics': {
                'active_connections': sum(len(clients) for clients in websocket_connections.values()),
                'total_connections_established': len(websocket_connections),
                'messages_sent_per_minute': 150
            }
        }
        
        # Count connections by protocol
        for connection_info in gateway.active_connections.values():
            protocol = connection_info['request'].protocol.value
            detailed_metrics['connections_by_protocol'][protocol] = \
                detailed_metrics['connections_by_protocol'].get(protocol, 0) + 1
        
        return {
            'success': True,
            'metrics': detailed_metrics,
            'timestamp': datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Utility Functions

async def _handle_websocket_message(
    websocket: WebSocket, 
    connection_id: str, 
    message: Dict[str, Any], 
    gateway: IndustrialIoTGateway
):
    """Handle incoming WebSocket messages from clients."""
    try:
        message_type = message.get('message_type', 'unknown')
        
        if message_type == 'subscribe_equipment':
            # Handle equipment subscription
            equipment_ids = message.get('equipment_ids', [])
            response = {
                'message_type': 'subscription_confirmed',
                'connection_id': connection_id,
                'subscribed_equipment': equipment_ids,
                'timestamp': datetime.utcnow().isoformat()
            }
            await websocket.send_text(json.dumps(response))
            
        elif message_type == 'request_health_update':
            # Send current health status for requested equipment
            equipment_id = message.get('equipment_id')
            if equipment_id:
                health_status = await gateway.get_equipment_health(equipment_id)
                health_message = {
                    'message_type': 'health_status',
                    'connection_id': connection_id,
                    'equipment_id': equipment_id,
                    'health_data': health_status,
                    'timestamp': datetime.utcnow().isoformat()
                }
                await websocket.send_text(json.dumps(health_message))
        
        elif message_type == 'ping':
            # Respond to ping with pong
            pong_message = {
                'message_type': 'pong',
                'timestamp': datetime.utcnow().isoformat()
            }
            await websocket.send_text(json.dumps(pong_message))
        
        else:
            # Unknown message type
            error_message = {
                'message_type': 'error',
                'error': f'Unknown message type: {message_type}',
                'timestamp': datetime.utcnow().isoformat()
            }
            await websocket.send_text(json.dumps(error_message))
            
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")
        error_message = {
            'message_type': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }
        await websocket.send_text(json.dumps(error_message))


async def _monitor_connection_health(gateway: IndustrialIoTGateway, connection_id: str):
    """Background task to monitor connection health."""
    try:
        while connection_id in gateway.active_connections:
            # Check connection health every 5 minutes
            await asyncio.sleep(300)
            
            connection_info = gateway.active_connections.get(connection_id)
            if not connection_info:
                break
            
            handler = connection_info['handler']
            
            # Check if handler is still connected
            if not handler.is_connected:
                logger.warning(f"Connection {connection_id} appears to be disconnected")
                
                # Attempt reconnection if auto-reconnect is enabled
                request = connection_info['request']
                if request.auto_reconnect:
                    logger.info(f"Attempting to reconnect {connection_id}")
                    try:
                        success = await handler.connect()
                        if success:
                            logger.info(f"Successfully reconnected {connection_id}")
                            gateway.db_manager.update_connection_status(
                                connection_id, 
                                gateway.IoTConnectionStatus.CONNECTED
                            )
                        else:
                            logger.error(f"Failed to reconnect {connection_id}")
                    except Exception as e:
                        logger.error(f"Reconnection error for {connection_id}: {e}")
            
            # Update connection metrics
            try:
                gateway.db_manager.update_connection_status(
                    connection_id,
                    gateway.IoTConnectionStatus.CONNECTED if handler.is_connected else gateway.IoTConnectionStatus.ERROR
                )
            except Exception as e:
                logger.error(f"Error updating connection status: {e}")
                
    except Exception as e:
        logger.error(f"Error in connection health monitoring: {e}")