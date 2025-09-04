"""
Real-Time Manufacturing Data Streaming Infrastructure
====================================================

Real-time streaming system for manufacturing sensor data using Redis Streams and WebSocket
connections for live monitoring and alerting.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, AsyncGenerator
import redis.asyncio as redis
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from ..models.manufacturing import ManufacturingDatabase, ManufacturingAlert
from ..ml.data_quality import IndustrialDataQualityEngine
from ..services.manufacturing_forecasting_service import ManufacturingForecastingService

logger = logging.getLogger(__name__)


class ManufacturingStreamProcessor:
    """Real-time processor for manufacturing sensor data streams."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_pool = redis.ConnectionPool.from_url(redis_url)
        self.redis_client = None
        self.data_quality_engine = IndustrialDataQualityEngine()
        self.processing_tasks = {}
        self.websocket_connections = {}
        
    async def initialize(self):
        """Initialize Redis connection."""
        self.redis_client = redis.Redis(connection_pool=self.redis_pool)
        logger.info("Manufacturing stream processor initialized")
    
    async def close(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    async def publish_sensor_data(
        self,
        equipment_id: str,
        sensor_data: Dict[str, Any],
        db_session: Optional[Session] = None
    ) -> bool:
        """
        Publish sensor data to Redis stream for real-time processing.
        
        Args:
            equipment_id: Equipment identifier
            sensor_data: Sensor readings with timestamp
            db_session: Database session for persistence
            
        Returns:
            Success status
        """
        try:
            # Validate and enrich sensor data
            enriched_data = await self._enrich_sensor_data(equipment_id, sensor_data, db_session)
            
            # Publish to Redis stream
            stream_name = f"sensors:{equipment_id}"
            message_id = await self.redis_client.xadd(
                stream_name,
                enriched_data,
                maxlen=1000  # Keep last 1000 readings
            )
            
            # Trigger real-time processing
            await self._trigger_real_time_analysis(equipment_id, enriched_data, db_session)
            
            # Notify WebSocket subscribers
            await self._notify_websocket_subscribers(equipment_id, enriched_data)
            
            logger.debug(f"Published sensor data for {equipment_id}: {message_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing sensor data for {equipment_id}: {e}")
            return False
    
    async def subscribe_to_equipment_stream(
        self,
        equipment_id: str,
        callback: callable,
        group_name: str = "processors",
        consumer_name: str = "worker-1"
    ):
        """
        Subscribe to equipment sensor data stream.
        
        Args:
            equipment_id: Equipment to monitor
            callback: Function to process incoming data
            group_name: Redis consumer group name
            consumer_name: Consumer identifier
        """
        stream_name = f"sensors:{equipment_id}"
        
        try:
            # Create consumer group if it doesn't exist
            try:
                await self.redis_client.xgroup_create(
                    stream_name,
                    group_name,
                    id="0",
                    mkstream=True
                )
            except redis.ResponseError as e:
                if "BUSYGROUP" not in str(e):
                    raise e
            
            # Start consuming messages
            while True:
                try:
                    messages = await self.redis_client.xreadgroup(
                        group_name,
                        consumer_name,
                        {stream_name: ">"},
                        count=10,
                        block=1000  # Block for 1 second
                    )
                    
                    for stream, msgs in messages:
                        for msg_id, fields in msgs:
                            try:
                                # Process message
                                await callback(equipment_id, msg_id, fields)
                                
                                # Acknowledge message
                                await self.redis_client.xack(stream_name, group_name, msg_id)
                                
                            except Exception as e:
                                logger.error(f"Error processing message {msg_id}: {e}")
                
                except redis.ResponseError as e:
                    logger.error(f"Redis error in subscription: {e}")
                    await asyncio.sleep(5)
                    
        except Exception as e:
            logger.error(f"Error in stream subscription for {equipment_id}: {e}")
    
    async def _enrich_sensor_data(
        self,
        equipment_id: str,
        sensor_data: Dict[str, Any],
        db_session: Optional[Session]
    ) -> Dict[str, Any]:
        """Enrich sensor data with quality assessment and metadata."""
        enriched = sensor_data.copy()
        
        # Add timestamp if missing
        if 'timestamp' not in enriched:
            enriched['timestamp'] = datetime.now().isoformat()
        
        # Add equipment metadata
        enriched['equipment_id'] = equipment_id
        enriched['processed_at'] = datetime.now().isoformat()
        
        # Perform data quality assessment
        try:
            df = pd.DataFrame([sensor_data])
            
            # Run industrial data quality checks
            quality_result = self.data_quality_engine.assess_industrial_data_quality(
                data=df,
                sensor_metadata={'equipment_id': equipment_id}
            )
            
            enriched['quality_score'] = quality_result.get('overall_score', 1.0)
            enriched['quality_issues'] = quality_result.get('issues', [])
            
            # Detect anomalies
            anomaly_score = self.data_quality_engine.detect_multi_modal_anomalies(df)
            enriched['anomaly_score'] = float(anomaly_score[0]) if len(anomaly_score) > 0 else 0.0
            enriched['is_anomaly'] = enriched['anomaly_score'] > 0.5
            
        except Exception as e:
            logger.warning(f"Error in data quality assessment: {e}")
            enriched['quality_score'] = 0.8  # Default
            enriched['is_anomaly'] = False
        
        return enriched
    
    async def _trigger_real_time_analysis(
        self,
        equipment_id: str,
        sensor_data: Dict[str, Any],
        db_session: Optional[Session]
    ):
        """Trigger real-time analysis and alerting based on sensor data."""
        try:
            # Check for critical conditions
            critical_alerts = await self._check_critical_conditions(equipment_id, sensor_data)
            
            # Store alerts if database session available
            if critical_alerts and db_session:
                manufacturing_db = ManufacturingDatabase(db_session)
                
                for alert in critical_alerts:
                    manufacturing_db.create_alert(
                        equipment_id=equipment_id,
                        alert_type=alert['type'],
                        severity=alert['severity'],
                        title=alert['title'],
                        message=alert['message'],
                        metadata={'sensor_data': sensor_data}
                    )
            
            # Trigger predictive analysis for high-risk conditions
            if sensor_data.get('is_anomaly') or sensor_data.get('quality_score', 1.0) < 0.7:
                await self._trigger_predictive_analysis(equipment_id, sensor_data, db_session)
                
        except Exception as e:
            logger.error(f"Error in real-time analysis for {equipment_id}: {e}")
    
    async def _check_critical_conditions(
        self,
        equipment_id: str,
        sensor_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for critical operating conditions requiring immediate alerts."""
        alerts = []
        
        # Temperature thresholds
        if 'temperature' in sensor_data:
            temp = sensor_data['temperature']
            if temp > 85:  # Critical temperature threshold
                alerts.append({
                    'type': 'temperature_critical',
                    'severity': 'critical',
                    'title': 'Critical Temperature Alert',
                    'message': f'Equipment temperature reached {temp}°C, exceeding safe operating limits'
                })
            elif temp > 75:  # Warning threshold
                alerts.append({
                    'type': 'temperature_warning',
                    'severity': 'high',
                    'title': 'High Temperature Warning',
                    'message': f'Equipment temperature at {temp}°C, approaching critical limits'
                })
        
        # Vibration thresholds
        if 'vibration' in sensor_data:
            vib = sensor_data['vibration']
            if vib > 15:  # Critical vibration
                alerts.append({
                    'type': 'vibration_critical',
                    'severity': 'critical',
                    'title': 'Critical Vibration Alert',
                    'message': f'Vibration level at {vib}Hz indicates potential mechanical failure'
                })
        
        # Pressure thresholds
        if 'pressure' in sensor_data:
            pressure = sensor_data['pressure']
            if pressure > 150 or pressure < 20:  # Outside safe operating range
                alerts.append({
                    'type': 'pressure_critical',
                    'severity': 'critical',
                    'title': 'Pressure Out of Range',
                    'message': f'System pressure at {pressure} PSI is outside safe operating range'
                })
        
        # Data quality alerts
        if sensor_data.get('quality_score', 1.0) < 0.5:
            alerts.append({
                'type': 'data_quality',
                'severity': 'medium',
                'title': 'Sensor Data Quality Issue',
                'message': f'Sensor data quality score: {sensor_data["quality_score"]:.2f}'
            })
        
        # Anomaly alerts
        if sensor_data.get('is_anomaly'):
            alerts.append({
                'type': 'anomaly_detected',
                'severity': 'high',
                'title': 'Equipment Anomaly Detected',
                'message': f'Anomaly detected with score: {sensor_data.get("anomaly_score", 0):.2f}'
            })
        
        return alerts
    
    async def _trigger_predictive_analysis(
        self,
        equipment_id: str,
        sensor_data: Dict[str, Any],
        db_session: Optional[Session]
    ):
        """Trigger predictive analysis for equipment at risk."""
        try:
            # Avoid triggering too frequently
            task_key = f"prediction:{equipment_id}"
            if task_key in self.processing_tasks:
                last_run = self.processing_tasks[task_key]
                if datetime.now() - last_run < timedelta(minutes=15):
                    return  # Skip if analyzed recently
            
            # Update task tracking
            self.processing_tasks[task_key] = datetime.now()
            
            # Get recent sensor history for prediction
            if db_session:
                manufacturing_db = ManufacturingDatabase(db_session)
                recent_data = manufacturing_db.get_recent_sensor_data(equipment_id, hours_back=24)
                
                if recent_data:
                    # Initialize forecasting service
                    forecasting_service = ManufacturingForecastingService(db_session=db_session)
                    
                    # Convert to DataFrame
                    sensor_df = self._convert_sensor_data_to_df(recent_data)\n                    \n                    # Run failure prediction\n                    result = await forecasting_service.predict_equipment_failure(\n                        equipment_id=equipment_id,\n                        sensor_data=sensor_df,\n                        forecast_horizon_days=7,\n                        model_preference='ensemble'\n                    )\n                    \n                    # Create alerts for high-risk predictions\n                    if result.get('risk_assessment', {}).get('risk_level') in ['high', 'critical']:\n                        manufacturing_db.create_alert(\n                            equipment_id=equipment_id,\n                            alert_type='predictive_maintenance',\n                            severity='high',\n                            title='Predictive Maintenance Alert',\n                            message=f'Equipment failure risk: {result.get(\"risk_assessment\", {}).get(\"risk_level\", \"unknown\")}',\n                            metadata={'prediction_result': result}\n                        )\n                        \n        except Exception as e:\n            logger.error(f'Error in predictive analysis for {equipment_id}: {e}')\n    \n    def _convert_sensor_data_to_df(self, sensor_data: Dict[str, List[Dict]]) -> pd.DataFrame:\n        \"\"\"Convert sensor data dictionary to DataFrame for analysis.\"\"\"\n        records = []\n        \n        for sensor_type, readings in sensor_data.items():\n            for reading in readings:\n                record = {\n                    'timestamp': reading['timestamp'],\n                    sensor_type: reading['value'],\n                    f'{sensor_type}_quality': reading.get('quality_score', 1.0),\n                    f'{sensor_type}_anomaly': reading.get('is_anomaly', False)\n                }\n                records.append(record)\n        \n        if records:\n            df = pd.DataFrame(records)\n            df['timestamp'] = pd.to_datetime(df['timestamp'])\n            df.set_index('timestamp', inplace=True)\n            return df\n        else:\n            return pd.DataFrame()\n    \n    async def _notify_websocket_subscribers(\n        self,\n        equipment_id: str,\n        sensor_data: Dict[str, Any]\n    ):\n        \"\"\"Notify WebSocket subscribers of new sensor data.\"\"\"\n        if equipment_id in self.websocket_connections:\n            message = {\n                'type': 'sensor_update',\n                'equipment_id': equipment_id,\n                'data': sensor_data,\n                'timestamp': datetime.now().isoformat()\n            }\n            \n            # Send to all subscribers for this equipment\n            disconnected = []\n            for connection in self.websocket_connections[equipment_id]:\n                try:\n                    await connection.send_json(message)\n                except Exception as e:\n                    logger.warning(f'WebSocket send failed: {e}')\n                    disconnected.append(connection)\n            \n            # Remove disconnected connections\n            for conn in disconnected:\n                self.websocket_connections[equipment_id].remove(conn)\n    \n    async def add_websocket_subscriber(self, equipment_id: str, websocket: WebSocket):\n        \"\"\"Add WebSocket subscriber for equipment updates.\"\"\"\n        if equipment_id not in self.websocket_connections:\n            self.websocket_connections[equipment_id] = []\n        \n        self.websocket_connections[equipment_id].append(websocket)\n        logger.info(f'Added WebSocket subscriber for equipment {equipment_id}')\n    \n    async def remove_websocket_subscriber(self, equipment_id: str, websocket: WebSocket):\n        \"\"\"Remove WebSocket subscriber.\"\"\"\n        if equipment_id in self.websocket_connections:\n            if websocket in self.websocket_connections[equipment_id]:\n                self.websocket_connections[equipment_id].remove(websocket)\n                logger.info(f'Removed WebSocket subscriber for equipment {equipment_id}')\n    \n    async def get_stream_statistics(self, equipment_id: str) -> Dict[str, Any]:\n        \"\"\"Get statistics for equipment data stream.\"\"\"\n        stream_name = f'sensors:{equipment_id}'\n        \n        try:\n            info = await self.redis_client.xinfo_stream(stream_name)\n            \n            return {\n                'stream_name': stream_name,\n                'message_count': info.get('length', 0),\n                'last_entry_id': info.get('last-entry', [None])[0],\n                'first_entry_id': info.get('first-entry', [None])[0],\n                'consumer_groups': info.get('groups', 0)\n            }\n            \n        except redis.ResponseError:\n            return {\n                'stream_name': stream_name,\n                'message_count': 0,\n                'status': 'stream_not_found'\n            }\n\n\n# WebSocket manager for real-time dashboard connections\nclass ManufacturingWebSocketManager:\n    \"\"\"WebSocket manager for real-time manufacturing dashboard.\"\"\"\n    \n    def __init__(self, stream_processor: ManufacturingStreamProcessor):\n        self.active_connections: Dict[str, List[WebSocket]] = {}\n        self.stream_processor = stream_processor\n    \n    async def connect(self, websocket: WebSocket, facility_id: str):\n        \"\"\"Accept new WebSocket connection for facility monitoring.\"\"\"\n        await websocket.accept()\n        \n        if facility_id not in self.active_connections:\n            self.active_connections[facility_id] = []\n        \n        self.active_connections[facility_id].append(websocket)\n        logger.info(f'WebSocket connected for facility {facility_id}')\n    \n    async def disconnect(self, websocket: WebSocket, facility_id: str):\n        \"\"\"Remove WebSocket connection.\"\"\"\n        if facility_id in self.active_connections:\n            if websocket in self.active_connections[facility_id]:\n                self.active_connections[facility_id].remove(websocket)\n                logger.info(f'WebSocket disconnected for facility {facility_id}')\n    \n    async def broadcast_facility_update(\n        self,\n        facility_id: str,\n        update_data: Dict[str, Any]\n    ):\n        \"\"\"Broadcast update to all WebSocket connections for a facility.\"\"\"\n        if facility_id in self.active_connections:\n            message = {\n                'type': 'facility_update',\n                'facility_id': facility_id,\n                'data': update_data,\n                'timestamp': datetime.now().isoformat()\n            }\n            \n            disconnected = []\n            for connection in self.active_connections[facility_id]:\n                try:\n                    await connection.send_json(message)\n                except Exception as e:\n                    logger.warning(f'WebSocket broadcast failed: {e}')\n                    disconnected.append(connection)\n            \n            # Remove disconnected connections\n            for conn in disconnected:\n                self.active_connections[facility_id].remove(conn)\n    \n    async def send_alert(\n        self,\n        facility_id: str,\n        alert_data: Dict[str, Any]\n    ):\n        \"\"\"Send real-time alert to facility dashboard.\"\"\"\n        message = {\n            'type': 'alert',\n            'facility_id': facility_id,\n            'alert': alert_data,\n            'timestamp': datetime.now().isoformat()\n        }\n        \n        await self.broadcast_facility_update(facility_id, message)\n    \n    def get_connection_count(self, facility_id: str) -> int:\n        \"\"\"Get number of active connections for facility.\"\"\"\n        return len(self.active_connections.get(facility_id, []))\n\n\n# Global instances\nstream_processor = ManufacturingStreamProcessor()\nwebsocket_manager = ManufacturingWebSocketManager(stream_processor)"