import { EndpointCard } from '../../components/ui/EndpointCard'

export default function ManufacturingIoTPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Manufacturing IoT Gateway API</h1>
        <p className="text-gray-600 text-lg">
          Connect and manage industrial IoT systems with support for OPC-UA, MQTT, Modbus, and EtherNet/IP protocols.
        </p>
      </div>

      <EndpointCard
        method="POST"
        endpoint="/api/v1/manufacturing/iot/connect"
        title="Connect Industrial System"
        description="Establish connection to industrial systems using standard protocols."
        parameters={[
          {
            name: "connection_config",
            type: "object",
            required: true,
            description: "Connection configuration",
            properties: [
              { name: "protocol", type: "string", description: "Protocol type (opc_ua, mqtt, modbus, ethernet_ip)" },
              { name: "endpoint", type: "string", description: "Connection endpoint or address" },
              { name: "authentication", type: "object", description: "Authentication credentials" },
              { name: "settings", type: "object", description: "Protocol-specific settings" }
            ]
          },
          {
            name: "equipment_config",
            type: "object",
            required: true,
            description: "Equipment configuration",
            properties: [
              { name: "equipment_ids", type: "array", description: "List of equipment identifiers" },
              { name: "tags", type: "array", description: "Data tags to monitor" },
              { name: "sampling_rate", type: "number", description: "Data sampling rate in seconds" }
            ]
          }
        ]}
        response={{
          "connection_id": "conn_abc123",
          "status": "connected",
          "protocol": "opc_ua",
          "equipment_count": 5,
          "tags_monitored": 47,
          "streaming_url": "wss://stream.schlep-engine.com/manufacturing/conn_abc123",
          "connected_at": "2024-01-15T10:00:00Z"
        }}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/iot/connect" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "connection_config": {
      "protocol": "opc_ua",
      "endpoint": "opc.tcp://factory-server:4840",
      "authentication": {
        "type": "username_password",
        "username": "admin",
        "password": "secure_password"
      },
      "settings": {
        "security_policy": "Basic256Sha256",
        "security_mode": "SignAndEncrypt"
      }
    },
    "equipment_config": {
      "equipment_ids": ["press_001", "conveyor_002", "robot_003"],
      "tags": ["temperature", "pressure", "vibration", "status"],
      "sampling_rate": 1
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/connect",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "connection_config": {
            "protocol": "opc_ua",
            "endpoint": "opc.tcp://factory-server:4840",
            "authentication": {
                "type": "username_password",
                "username": "admin",
                "password": "secure_password"
            },
            "settings": {
                "security_policy": "Basic256Sha256",
                "security_mode": "SignAndEncrypt"
            }
        },
        "equipment_config": {
            "equipment_ids": ["press_001", "conveyor_002", "robot_003"],
            "tags": ["temperature", "pressure", "vibration", "status"],
            "sampling_rate": 1
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/connect', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    connection_config: {
      protocol: 'opc_ua',
      endpoint: 'opc.tcp://factory-server:4840',
      authentication: {
        type: 'username_password',
        username: 'admin',
        password: 'secure_password'
      },
      settings: {
        security_policy: 'Basic256Sha256',
        security_mode: 'SignAndEncrypt'
      }
    },
    equipment_config: {
      equipment_ids: ['press_001', 'conveyor_002', 'robot_003'],
      tags: ['temperature', 'pressure', 'vibration', 'status'],
      sampling_rate: 1
    }
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/manufacturing/iot/stream-process"
        title="Stream Process Data"
        description="Configure real-time data processing rules for streaming sensor data."
        parameters={[
          {
            name: "connection_id",
            type: "string",
            required: true,
            description: "Connection ID from established IoT connection"
          },
          {
            name: "processing_rules",
            type: "array",
            required: true,
            description: "Data processing rules",
            properties: [
              { name: "type", type: "string", description: "Processing type (predictive_maintenance, quality_control, anomaly_detection)" },
              { name: "threshold", type: "number", description: "Alert threshold value" },
              { name: "sensitivity", type: "string", description: "Detection sensitivity (low, medium, high)" }
            ]
          },
          {
            name: "alert_config",
            type: "object",
            required: false,
            description: "Alert configuration",
            properties: [
              { name: "webhook_url", type: "string", description: "Webhook URL for alerts" },
              { name: "email_notifications", type: "array", description: "Email addresses for notifications" }
            ]
          }
        ]}
        response={{
          "processing_id": "proc_abc123",
          "connection_id": "conn_abc123",
          "rules_active": 3,
          "status": "processing",
          "real_time_analytics": {
            "predictive_maintenance": "enabled",
            "quality_control": "enabled",
            "anomaly_detection": "enabled"
          },
          "started_at": "2024-01-15T10:00:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/manufacturing/iot/equipment/{equipment_id}/health"
        title="Equipment Health Status"
        description="Get real-time health status and predictive maintenance insights for specific equipment."
        parameters={[
          {
            name: "equipment_id",
            type: "string",
            required: true,
            description: "Equipment identifier"
          }
        ]}
        response={{
          "equipment_id": "press_001",
          "health_score": 0.87,
          "status": "operational",
          "current_metrics": {
            "temperature": 72.5,
            "pressure": 145.2,
            "vibration": 2.1,
            "runtime_hours": 2847.3
          },
          "predictive_maintenance": {
            "next_maintenance": "2024-01-25T08:00:00Z",
            "predicted_failure": "2024-02-10T14:30:00Z",
            "confidence": 0.92,
            "recommended_actions": [
              "Replace hydraulic seals",
              "Check belt tension"
            ]
          },
          "anomalies": [
            {
              "type": "temperature_spike",
              "severity": "medium",
              "detected_at": "2024-01-15T09:45:00Z",
              "description": "Temperature elevated above normal range"
            }
          ]
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/manufacturing/iot/connections"
        title="List Connections"
        description="Get a list of all active IoT connections with their status."
        parameters={[
          {
            name: "status",
            type: "string",
            required: false,
            description: "Filter by connection status (connected, disconnected, error)"
          },
          {
            name: "protocol",
            type: "string",
            required: false,
            description: "Filter by protocol type"
          }
        ]}
        response={{
          "total_connections": 8,
          "connections": [
            {
              "connection_id": "conn_abc123",
              "protocol": "opc_ua",
              "endpoint": "opc.tcp://factory-server:4840",
              "status": "connected",
              "equipment_count": 5,
              "data_points_per_minute": 1200,
              "uptime": "7d 12h 45m",
              "last_seen": "2024-01-15T10:00:00Z"
            }
          ]
        }}
      />

      <EndpointCard
        method="DELETE"
        endpoint="/api/v1/manufacturing/iot/connections/{connection_id}"
        title="Delete Connection"
        description="Disconnect and remove an IoT connection."
        parameters={[
          {
            name: "connection_id",
            type: "string",
            required: true,
            description: "Connection ID to delete"
          }
        ]}
        response={{
          "connection_id": "conn_abc123",
          "status": "disconnected",
          "message": "Connection successfully removed",
          "disconnected_at": "2024-01-15T10:00:00Z"
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/manufacturing/iot/batch-upload/{connection_id}"
        title="Batch Upload Data"
        description="Upload historical or batch sensor data for analysis and training."
        parameters={[
          {
            name: "connection_id",
            type: "string",
            required: true,
            description: "Connection ID for the data"
          },
          {
            name: "data",
            type: "array",
            required: true,
            description: "Batch sensor data points",
            properties: [
              { name: "timestamp", type: "string", description: "ISO timestamp" },
              { name: "equipment_id", type: "string", description: "Equipment identifier" },
              { name: "tags", type: "object", description: "Tag-value pairs" }
            ]
          }
        ]}
        response={{
          "upload_id": "upload_abc123",
          "connection_id": "conn_abc123",
          "records_processed": 15420,
          "processing_time_ms": 3450,
          "quality_score": 0.94,
          "anomalies_detected": 7,
          "uploaded_at": "2024-01-15T10:00:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/manufacturing/iot/alerts"
        title="Get Alerts"
        description="Retrieve active and historical alerts from IoT monitoring."
        parameters={[
          {
            name: "severity",
            type: "string",
            required: false,
            description: "Filter by alert severity (low, medium, high, critical)"
          },
          {
            name: "equipment_id",
            type: "string",
            required: false,
            description: "Filter by equipment ID"
          },
          {
            name: "status",
            type: "string",
            required: false,
            description: "Filter by alert status (active, acknowledged, resolved)"
          },
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Maximum number of alerts to return"
          }
        ]}
        response={{
          "total_alerts": 23,
          "alerts": [
            {
              "alert_id": "alert_abc123",
              "equipment_id": "press_001",
              "type": "temperature_anomaly",
              "severity": "medium",
              "status": "active",
              "message": "Equipment temperature above normal threshold",
              "current_value": 85.2,
              "threshold": 75.0,
              "detected_at": "2024-01-15T09:45:00Z",
              "estimated_impact": "Minor performance degradation"
            }
          ]
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/manufacturing/iot/alerts/configure"
        title="Configure Alerts"
        description="Set up custom alert rules and notification preferences."
        parameters={[
          {
            name: "alert_rules",
            type: "array",
            required: true,
            description: "Alert rule definitions",
            properties: [
              { name: "name", type: "string", description: "Rule name" },
              { name: "condition", type: "object", description: "Alert trigger condition" },
              { name: "severity", type: "string", description: "Alert severity level" },
              { name: "cooldown_minutes", type: "number", description: "Minimum time between alerts" }
            ]
          },
          {
            name: "notification_config",
            type: "object",
            required: true,
            description: "Notification preferences",
            properties: [
              { name: "email_enabled", type: "boolean", description: "Enable email notifications" },
              { name: "webhook_enabled", type: "boolean", description: "Enable webhook notifications" },
              { name: "dashboard_enabled", type: "boolean", description: "Show on dashboard" }
            ]
          }
        ]}
        response={{
          "config_id": "config_abc123",
          "rules_configured": 5,
          "notification_channels": 3,
          "status": "active",
          "configured_at": "2024-01-15T10:00:00Z"
        }}
      />
    </div>
  )
}