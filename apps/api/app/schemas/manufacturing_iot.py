"""
Manufacturing IoT API Schemas
============================

Pydantic schemas for Industrial IoT Gateway API validation and serialization.
Supports OPC-UA, MQTT, Modbus, and EtherNet/IP protocols.
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from enum import Enum


class IoTProtocol(str, Enum):
    """Supported industrial protocols."""
    OPC_UA = "opc_ua"
    MQTT = "mqtt"
    MODBUS = "modbus"
    ETHERNET_IP = "ethernet_ip"
    HTTP = "http"


class ConnectionStatus(str, Enum):
    """Connection status states."""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    TIMEOUT = "timeout"


class EquipmentHealthStatus(str, Enum):
    """Equipment health status levels."""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class SeverityLevel(str, Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Connection Schemas

class OpcUaConnectionConfig(BaseModel):
    """OPC-UA connection configuration."""
    endpoint_url: str = Field(..., description="OPC-UA server endpoint URL")
    username: Optional[str] = Field(None, description="Authentication username")
    password: Optional[str] = Field(None, description="Authentication password")
    certificate_path: Optional[str] = Field(None, description="Path to client certificate")
    private_key_path: Optional[str] = Field(None, description="Path to private key")
    security_policy: str = Field("None", description="Security policy (None, Basic256Sha256, etc.)")
    security_mode: str = Field("None", description="Security mode (None, Sign, SignAndEncrypt)")
    timeout_seconds: int = Field(30, ge=5, le=300, description="Connection timeout")
    
    @validator('endpoint_url')
    def validate_endpoint_url(cls, v):
        if not v.startswith(('opc.tcp://', 'https://')):
            raise ValueError('OPC-UA endpoint must start with opc.tcp:// or https://')
        return v


class MqttConnectionConfig(BaseModel):
    """MQTT broker connection configuration."""
    host: str = Field(..., description="MQTT broker host")
    port: int = Field(1883, ge=1, le=65535, description="MQTT broker port")
    username: Optional[str] = Field(None, description="MQTT username")
    password: Optional[str] = Field(None, description="MQTT password")
    client_id: Optional[str] = Field(None, description="MQTT client ID")
    keepalive_seconds: int = Field(60, ge=10, le=300, description="Keepalive interval")
    use_tls: bool = Field(False, description="Use TLS encryption")
    ca_cert_path: Optional[str] = Field(None, description="CA certificate path for TLS")
    cert_path: Optional[str] = Field(None, description="Client certificate path for TLS")
    key_path: Optional[str] = Field(None, description="Client private key path for TLS")


class ModbusConnectionConfig(BaseModel):
    """Modbus connection configuration."""
    host: str = Field(..., description="Modbus server host")
    port: int = Field(502, ge=1, le=65535, description="Modbus port")
    unit_id: int = Field(1, ge=1, le=255, description="Modbus unit/slave ID")
    timeout_seconds: int = Field(10, ge=1, le=60, description="Response timeout")
    connection_type: str = Field("tcp", pattern="^(tcp|rtu|ascii)$", description="Connection type")
    serial_port: Optional[str] = Field(None, description="Serial port for RTU/ASCII")
    baudrate: Optional[int] = Field(9600, description="Serial baudrate")
    parity: Optional[str] = Field("N", pattern="^(N|E|O)$", description="Serial parity")
    stopbits: Optional[int] = Field(1, ge=1, le=2, description="Serial stop bits")


class EtherNetIpConnectionConfig(BaseModel):
    """EtherNet/IP connection configuration."""
    host: str = Field(..., description="EtherNet/IP device host")
    port: int = Field(44818, ge=1, le=65535, description="EtherNet/IP port")
    slot: int = Field(0, ge=0, le=255, description="Device slot number")
    timeout_seconds: int = Field(10, ge=1, le=60, description="Response timeout")
    connection_size: int = Field(504, ge=100, le=2000, description="Connection packet size")


class IndustrialSystemConnection(BaseModel):
    """Industrial system connection request."""
    connection_id: str = Field(..., description="Unique connection identifier")
    system_name: str = Field(..., description="Human-readable system name")
    protocol: IoTProtocol = Field(..., description="Industrial protocol to use")
    facility_id: str = Field(..., description="Manufacturing facility ID")
    equipment_ids: List[str] = Field(..., description="Equipment IDs to connect")
    
    # Protocol-specific configurations
    opc_ua_config: Optional[OpcUaConnectionConfig] = Field(None, description="OPC-UA configuration")
    mqtt_config: Optional[MqttConnectionConfig] = Field(None, description="MQTT configuration")
    modbus_config: Optional[ModbusConnectionConfig] = Field(None, description="Modbus configuration")
    ethernet_ip_config: Optional[EtherNetIpConnectionConfig] = Field(None, description="EtherNet/IP configuration")
    
    # General settings
    polling_interval_seconds: int = Field(5, ge=1, le=3600, description="Data polling interval")
    auto_reconnect: bool = Field(True, description="Enable automatic reconnection")
    buffer_size: int = Field(1000, ge=100, le=10000, description="Data buffer size")
    enable_streaming: bool = Field(True, description="Enable real-time streaming")
    
    @validator('protocol')
    def validate_protocol_config(cls, v, values):
        """Validate that appropriate configuration is provided for the protocol."""
        protocol_configs = {
            IoTProtocol.OPC_UA: 'opc_ua_config',
            IoTProtocol.MQTT: 'mqtt_config',
            IoTProtocol.MODBUS: 'modbus_config',
            IoTProtocol.ETHERNET_IP: 'ethernet_ip_config'
        }
        
        config_field = protocol_configs.get(v)
        if config_field and config_field in values and values[config_field] is None:
            raise ValueError(f'{config_field} is required for protocol {v}')
        
        return v


# Streaming Schemas

class SensorDataPoint(BaseModel):
    """Single sensor data point."""
    sensor_id: str = Field(..., description="Sensor identifier")
    equipment_id: str = Field(..., description="Equipment identifier")
    timestamp: datetime = Field(..., description="Data timestamp")
    value: Union[float, int, str, bool] = Field(..., description="Sensor reading value")
    unit: Optional[str] = Field(None, description="Measurement unit")
    quality_code: Optional[str] = Field(None, description="Data quality indicator")
    tags: Optional[Dict[str, Any]] = Field(None, description="Additional metadata tags")


class StreamProcessRequest(BaseModel):
    """Streaming sensor data processing request."""
    connection_id: str = Field(..., description="Connection identifier")
    data_points: List[SensorDataPoint] = Field(..., min_items=1, max_items=1000, description="Sensor data batch")
    processing_options: Optional[Dict[str, Any]] = Field(None, description="Processing preferences")
    enable_ml_predictions: bool = Field(True, description="Enable ML-based predictions")
    enable_anomaly_detection: bool = Field(True, description="Enable anomaly detection")
    enable_alerts: bool = Field(True, description="Enable automatic alerts")


# Response Schemas

class ConnectionResponse(BaseModel):
    """Connection establishment response."""
    success: bool = Field(..., description="Connection success status")
    connection_id: str = Field(..., description="Connection identifier")
    status: ConnectionStatus = Field(..., description="Current connection status")
    connected_equipment: List[str] = Field(..., description="Successfully connected equipment")
    failed_equipment: List[str] = Field(..., description="Equipment that failed to connect")
    websocket_url: Optional[str] = Field(None, description="WebSocket URL for real-time updates")
    message: str = Field(..., description="Status message")
    timestamp: datetime = Field(..., description="Response timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional connection metadata")


class ProcessingResult(BaseModel):
    """Data processing result for a single data point."""
    sensor_id: str = Field(..., description="Sensor identifier")
    equipment_id: str = Field(..., description="Equipment identifier")
    original_value: Union[float, int, str, bool] = Field(..., description="Original sensor value")
    processed_value: Optional[Union[float, int, str, bool]] = Field(None, description="Processed sensor value")
    anomaly_detected: bool = Field(..., description="Anomaly detection result")
    anomaly_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Anomaly confidence score")
    predictions: Optional[Dict[str, Any]] = Field(None, description="ML prediction results")
    quality_score: float = Field(..., ge=0.0, le=1.0, description="Data quality score")
    alerts_generated: List[str] = Field(default_factory=list, description="Generated alert IDs")


class StreamProcessResponse(BaseModel):
    """Stream processing response."""
    success: bool = Field(..., description="Processing success status")
    connection_id: str = Field(..., description="Connection identifier")
    processed_count: int = Field(..., ge=0, description="Number of processed data points")
    results: List[ProcessingResult] = Field(..., description="Processing results per data point")
    processing_time_ms: int = Field(..., ge=0, description="Total processing time in milliseconds")
    alerts_count: int = Field(..., ge=0, description="Number of alerts generated")
    anomalies_detected: int = Field(..., ge=0, description="Number of anomalies detected")
    timestamp: datetime = Field(..., description="Processing completion timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional processing metadata")


class PredictiveAnalytics(BaseModel):
    """Predictive analytics results."""
    failure_probability: float = Field(..., ge=0.0, le=1.0, description="Failure probability score")
    maintenance_recommendation: str = Field(..., description="Maintenance recommendation")
    estimated_remaining_life: Optional[int] = Field(None, description="Estimated remaining useful life in hours")
    risk_factors: List[str] = Field(default_factory=list, description="Identified risk factors")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence score")


class EquipmentHealthResponse(BaseModel):
    """Equipment health status response."""
    success: bool = Field(..., description="Request success status")
    equipment_id: str = Field(..., description="Equipment identifier")
    equipment_name: Optional[str] = Field(None, description="Equipment display name")
    health_status: EquipmentHealthStatus = Field(..., description="Overall health status")
    health_score: float = Field(..., ge=0.0, le=1.0, description="Health score (0-1)")
    
    # Sensor status
    active_sensors: int = Field(..., ge=0, description="Number of active sensors")
    total_sensors: int = Field(..., ge=0, description="Total number of sensors")
    sensor_health: Dict[str, str] = Field(default_factory=dict, description="Individual sensor health status")
    
    # Operational metrics
    uptime_hours: float = Field(..., ge=0, description="Equipment uptime in hours")
    utilization_percent: float = Field(..., ge=0.0, le=100.0, description="Equipment utilization percentage")
    efficiency_score: float = Field(..., ge=0.0, le=1.0, description="Operational efficiency score")
    
    # Predictive analytics
    predictive_analytics: Optional[PredictiveAnalytics] = Field(None, description="Predictive maintenance insights")
    
    # Alerts and maintenance
    active_alerts: List[Dict[str, Any]] = Field(default_factory=list, description="Active alerts")
    last_maintenance_date: Optional[datetime] = Field(None, description="Last maintenance date")
    next_maintenance_due: Optional[datetime] = Field(None, description="Next scheduled maintenance")
    
    # Performance trends
    performance_trends: Dict[str, str] = Field(default_factory=dict, description="Performance trend indicators")
    
    timestamp: datetime = Field(..., description="Status timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional equipment metadata")


# Alert and Notification Schemas

class IoTAlert(BaseModel):
    """IoT alert schema."""
    alert_id: str = Field(..., description="Unique alert identifier")
    connection_id: str = Field(..., description="Connection identifier")
    equipment_id: str = Field(..., description="Equipment identifier")
    sensor_id: Optional[str] = Field(None, description="Sensor identifier if applicable")
    alert_type: str = Field(..., description="Alert type")
    severity: SeverityLevel = Field(..., description="Alert severity level")
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Alert message")
    value: Optional[Union[float, int, str]] = Field(None, description="Trigger value")
    threshold: Optional[Union[float, int, str]] = Field(None, description="Threshold value")
    timestamp: datetime = Field(..., description="Alert timestamp")
    acknowledged: bool = Field(False, description="Acknowledgment status")
    resolved: bool = Field(False, description="Resolution status")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional alert metadata")


# WebSocket Message Schemas

class WebSocketMessage(BaseModel):
    """WebSocket message schema."""
    message_type: str = Field(..., description="Message type")
    connection_id: str = Field(..., description="Connection identifier")
    data: Dict[str, Any] = Field(..., description="Message payload")
    timestamp: datetime = Field(..., description="Message timestamp")


class RealtimeDataMessage(BaseModel):
    """Real-time sensor data message."""
    message_type: str = Field(default="sensor_data", description="Message type")
    connection_id: str = Field(..., description="Connection identifier")
    sensor_data: List[SensorDataPoint] = Field(..., description="Real-time sensor data")
    timestamp: datetime = Field(..., description="Message timestamp")


class AlertMessage(BaseModel):
    """Alert notification message."""
    message_type: str = Field(default="alert", description="Message type")
    connection_id: str = Field(..., description="Connection identifier")
    alert: IoTAlert = Field(..., description="Alert information")
    timestamp: datetime = Field(..., description="Message timestamp")


class HealthStatusMessage(BaseModel):
    """Equipment health status message."""
    message_type: str = Field(default="health_status", description="Message type")
    connection_id: str = Field(..., description="Connection identifier")
    equipment_id: str = Field(..., description="Equipment identifier")
    health_data: Dict[str, Any] = Field(..., description="Health status data")
    timestamp: datetime = Field(..., description="Message timestamp")


# Utility Schemas

class ConnectionListResponse(BaseModel):
    """Active connections list response."""
    success: bool = Field(..., description="Request success status")
    connections: List[Dict[str, Any]] = Field(..., description="Active connections")
    total_connections: int = Field(..., ge=0, description="Total number of connections")
    active_equipment: int = Field(..., ge=0, description="Total active equipment")
    timestamp: datetime = Field(..., description="Response timestamp")


class SystemMetrics(BaseModel):
    """IoT Gateway system metrics."""
    total_connections: int = Field(..., ge=0, description="Total active connections")
    total_equipment: int = Field(..., ge=0, description="Total connected equipment")
    total_sensors: int = Field(..., ge=0, description="Total active sensors")
    data_points_per_second: float = Field(..., ge=0, description="Data ingestion rate")
    processing_latency_ms: float = Field(..., ge=0, description="Average processing latency")
    error_rate_percent: float = Field(..., ge=0.0, le=100.0, description="System error rate")
    uptime_hours: float = Field(..., ge=0, description="System uptime")
    memory_usage_mb: float = Field(..., ge=0, description="Memory usage in MB")
    cpu_usage_percent: float = Field(..., ge=0.0, le=100.0, description="CPU usage percentage")
    timestamp: datetime = Field(..., description="Metrics timestamp")


class ServiceHealthResponse(BaseModel):
    """IoT Gateway service health response."""
    success: bool = Field(..., description="Health check success")
    service_status: str = Field(..., description="Overall service status")
    version: str = Field(..., description="Service version")
    system_metrics: SystemMetrics = Field(..., description="System performance metrics")
    protocol_status: Dict[str, bool] = Field(..., description="Protocol handler status")
    database_status: bool = Field(..., description="Database connection status")
    cache_status: bool = Field(..., description="Cache system status")
    websocket_status: bool = Field(..., description="WebSocket service status")
    timestamp: datetime = Field(..., description="Health check timestamp")