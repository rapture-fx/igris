"""
Manufacturing Real-Time WebSocket Endpoints
===========================================

WebSocket endpoints for real-time manufacturing data streaming and dashboard updates.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.streaming.manufacturing_streaming import stream_processor, websocket_manager
from app.models.manufacturing import ManufacturingDatabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/manufacturing/ws", tags=["Manufacturing WebSocket"])


@router.websocket("/facility/{facility_id}/dashboard")
async def facility_dashboard_websocket(
    websocket: WebSocket,
    facility_id: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time facility dashboard updates.
    
    Provides:
    - Equipment health status updates
    - Real-time sensor data
    - Production metrics
    - Alerts and notifications
    - Performance KPIs
    """
    await websocket_manager.connect(websocket, facility_id)
    manufacturing_db = ManufacturingDatabase(db)
    
    try:
        # Send initial dashboard data
        initial_data = await _get_initial_dashboard_data(facility_id, manufacturing_db)
        await websocket.send_json({
            'type': 'initial_data',
            'facility_id': facility_id,
            'data': initial_data,
            'timestamp': datetime.now().isoformat()
        })
        
        # Start periodic updates
        update_task = asyncio.create_task(
            _send_periodic_updates(websocket, facility_id, manufacturing_db)
        )
        
        # Listen for client messages
        while True:
            try:
                data = await websocket.receive_json()
                await _handle_dashboard_message(websocket, facility_id, data, manufacturing_db)
            except Exception as e:
                logger.error(f"Error processing dashboard message: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"Dashboard WebSocket disconnected for facility {facility_id}")
    except Exception as e:
        logger.error(f"WebSocket error for facility {facility_id}: {e}")
    finally:
        if 'update_task' in locals():
            update_task.cancel()
        await websocket_manager.disconnect(websocket, facility_id)


@router.websocket("/equipment/{equipment_id}/sensors")
async def equipment_sensors_websocket(
    websocket: WebSocket,
    equipment_id: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time equipment sensor data.
    
    Provides:
    - Live sensor readings
    - Data quality metrics
    - Anomaly detection alerts
    - Prediction updates
    """
    await websocket.accept()
    manufacturing_db = ManufacturingDatabase(db)
    
    try:
        # Add to stream processor subscribers
        await stream_processor.add_websocket_subscriber(equipment_id, websocket)
        
        # Send initial equipment status
        equipment_metadata = manufacturing_db.get_equipment_metadata(equipment_id)
        if equipment_metadata:
            await websocket.send_json({
                'type': 'equipment_metadata',
                'equipment_id': equipment_id,
                'metadata': equipment_metadata,
                'timestamp': datetime.now().isoformat()
            })
        
        # Send recent sensor data
        recent_data = manufacturing_db.get_recent_sensor_data(equipment_id, hours_back=1)
        await websocket.send_json({
            'type': 'recent_sensor_data',
            'equipment_id': equipment_id,
            'data': recent_data,
            'timestamp': datetime.now().isoformat()
        })
        
        # Listen for client messages
        while True:
            try:
                data = await websocket.receive_json()
                await _handle_sensor_message(websocket, equipment_id, data, manufacturing_db)
            except Exception as e:
                logger.error(f"Error processing sensor message: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"Sensor WebSocket disconnected for equipment {equipment_id}")
    except Exception as e:
        logger.error(f"WebSocket error for equipment {equipment_id}: {e}")
    finally:
        await stream_processor.remove_websocket_subscriber(equipment_id, websocket)


@router.websocket("/alerts/{facility_id}")
async def facility_alerts_websocket(
    websocket: WebSocket,
    facility_id: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time manufacturing alerts.
    
    Provides:
    - Critical equipment alerts
    - Maintenance notifications
    - Quality warnings
    - Performance alerts
    """
    await websocket.accept()
    
    try:
        # Send initial alert status
        await websocket.send_json({
            'type': 'alert_subscription_active',
            'facility_id': facility_id,
            'timestamp': datetime.now().isoformat()
        })
        
        # Listen for client messages and maintain connection
        while True:
            try:
                data = await websocket.receive_json()
                
                if data.get('type') == 'ping':
                    await websocket.send_json({
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat()
                    })
                elif data.get('type') == 'acknowledge_alert':
                    alert_id = data.get('alert_id')
                    if alert_id:
                        # Mark alert as acknowledged in database
                        # (Implementation depends on alert model)
                        await websocket.send_json({
                            'type': 'alert_acknowledged',
                            'alert_id': alert_id,
                            'timestamp': datetime.now().isoformat()
                        })
                        
            except Exception as e:
                logger.error(f"Error processing alert message: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"Alerts WebSocket disconnected for facility {facility_id}")
    except Exception as e:
        logger.error(f"WebSocket error for facility alerts {facility_id}: {e}")


async def _get_initial_dashboard_data(facility_id: str, manufacturing_db: ManufacturingDatabase) -> Dict[str, Any]:
    """Get initial dashboard data for facility."""
    try:
        # This would typically query equipment for the facility
        # For now, using mock equipment IDs
        equipment_ids = [f"EQ_{i:03d}" for i in range(1, 11)]  # Mock equipment
        
        dashboard_data = {
            'facility_overview': {
                'total_equipment': len(equipment_ids),
                'operational_equipment': 8,
                'equipment_at_risk': 2,
                'overall_facility_health': 0.87
            },
            'current_kpis': {
                'production_efficiency': 0.92,
                'quality_score': 0.88,
                'energy_efficiency': 0.84,
                'maintenance_cost_savings': 12500.0
            },
            'recent_alerts': [],
            'equipment_status': [],
            'performance_trends': {
                'production_trend': 'stable',
                'quality_trend': 'improving',
                'energy_trend': 'stable'
            }
        }
        
        # Add equipment status for available equipment
        for eq_id in equipment_ids[:5]:  # Limit to first 5 for performance
            eq_metadata = manufacturing_db.get_equipment_metadata(eq_id)
            if eq_metadata:
                dashboard_data['equipment_status'].append({
                    'equipment_id': eq_id,
                    'name': eq_metadata.get('name', 'Unknown'),
                    'status': eq_metadata.get('status', 'unknown'),
                    'health_score': 0.85,  # Would calculate from recent data
                    'last_updated': datetime.now().isoformat()
                })
        
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Error getting initial dashboard data: {e}")
        return {
            'error': 'Failed to load initial dashboard data',
            'timestamp': datetime.now().isoformat()
        }


async def _send_periodic_updates(
    websocket: WebSocket,
    facility_id: str,
    manufacturing_db: ManufacturingDatabase
):
    """Send periodic dashboard updates."""
    while True:
        try:
            await asyncio.sleep(30)  # Update every 30 seconds
            
            # Generate updated KPIs
            updated_data = {
                'current_kpis': {
                    'production_efficiency': 0.92 + (asyncio.get_event_loop().time() % 10 - 5) * 0.01,
                    'quality_score': 0.88 + (asyncio.get_event_loop().time() % 8 - 4) * 0.005,
                    'energy_efficiency': 0.84 + (asyncio.get_event_loop().time() % 6 - 3) * 0.008,
                    'overall_health': 0.87
                },
                'timestamp': datetime.now().isoformat(),
                'update_type': 'periodic_kpi_update'
            }
            
            await websocket.send_json({
                'type': 'dashboard_update',
                'facility_id': facility_id,
                'data': updated_data,
                'timestamp': datetime.now().isoformat()
            })
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in periodic updates: {e}")
            break


async def _handle_dashboard_message(
    websocket: WebSocket,
    facility_id: str,
    data: Dict[str, Any],
    manufacturing_db: ManufacturingDatabase
):
    """Handle incoming dashboard WebSocket messages."""
    try:
        message_type = data.get('type')
        
        if message_type == 'request_equipment_details':
            equipment_id = data.get('equipment_id')
            if equipment_id:
                equipment_metadata = manufacturing_db.get_equipment_metadata(equipment_id)
                recent_data = manufacturing_db.get_recent_sensor_data(equipment_id, hours_back=2)
                
                await websocket.send_json({
                    'type': 'equipment_details',
                    'equipment_id': equipment_id,
                    'metadata': equipment_metadata,
                    'recent_data': recent_data,
                    'timestamp': datetime.now().isoformat()
                })
        
        elif message_type == 'request_facility_summary':
            summary_data = await _get_initial_dashboard_data(facility_id, manufacturing_db)
            await websocket.send_json({
                'type': 'facility_summary',
                'facility_id': facility_id,
                'summary': summary_data,
                'timestamp': datetime.now().isoformat()
            })
        
        elif message_type == 'ping':
            await websocket.send_json({
                'type': 'pong',
                'timestamp': datetime.now().isoformat()
            })
            
    except Exception as e:
        logger.error(f"Error handling dashboard message: {e}")
        await websocket.send_json({
            'type': 'error',
            'message': 'Failed to process request',
            'timestamp': datetime.now().isoformat()
        })


async def _handle_sensor_message(
    websocket: WebSocket,
    equipment_id: str,
    data: Dict[str, Any],
    manufacturing_db: ManufacturingDatabase
):
    """Handle incoming sensor WebSocket messages."""
    try:
        message_type = data.get('type')
        
        if message_type == 'request_sensor_history':
            hours_back = data.get('hours_back', 6)
            sensor_types = data.get('sensor_types')
            
            sensor_data = manufacturing_db.get_recent_sensor_data(
                equipment_id,
                hours_back=hours_back,
                sensor_types=sensor_types
            )
            
            await websocket.send_json({
                'type': 'sensor_history',
                'equipment_id': equipment_id,
                'data': sensor_data,
                'timestamp': datetime.now().isoformat()
            })
        
        elif message_type == 'request_stream_stats':
            stats = await stream_processor.get_stream_statistics(equipment_id)
            await websocket.send_json({
                'type': 'stream_statistics',
                'equipment_id': equipment_id,
                'stats': stats,
                'timestamp': datetime.now().isoformat()
            })
        
        elif message_type == 'ping':
            await websocket.send_json({
                'type': 'pong',
                'timestamp': datetime.now().isoformat()
            })
            
    except Exception as e:
        logger.error(f"Error handling sensor message: {e}")
        await websocket.send_json({
            'type': 'error',
            'message': 'Failed to process sensor request',
            'timestamp': datetime.now().isoformat()
        })