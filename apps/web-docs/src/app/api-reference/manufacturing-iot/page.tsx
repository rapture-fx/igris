'use client'

import React from 'react'
import { EndpointCard } from '../../../components/ui/EndpointCard'

export default function ManufacturingIoTPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Manufacturing IoT API</h1>
        <p className="text-gray-600 text-lg">
          Industrial IoT data processing with OPC-UA, MQTT, and Modbus protocol support for real-time equipment monitoring and control.
        </p>
      </div>

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/iot/connect-device"
        title="Connect IoT Device"
        description="Register and connect a new IoT device to the manufacturing network."
        parameters={[
          {
            name: "device_id",
            type: "string",
            required: true,
            description: "Unique device identifier"
          },
          {
            name: "device_type",
            type: "string",
            required: true,
            description: "Type of device (sensor, plc, gateway, machine)"
          },
          {
            name: "protocol",
            type: "string",
            required: true,
            description: "Communication protocol (opcua, mqtt, modbus, ethernet_ip)"
          },
          {
            name: "connection_config",
            type: "object",
            required: true,
            description: "Protocol-specific connection configuration"
          },
          {
            name: "data_points",
            type: "array",
            required: true,
            description: "List of data points to monitor"
          }
        ]}
        responses={[
          {
            status: 201,
            description: 'Device connected successfully',
            example: JSON.stringify({
              "device_id": "PLC_001",
              "connection_status": "connected",
              "protocol": "opcua",
              "endpoint_url": "opc.tcp://192.168.1.100:4840",
              "data_points_registered": 24,
              "last_heartbeat": "2024-01-15T10:00:00Z",
              "telemetry_config": {
                "sampling_interval": 1000,
                "publishing_interval": 5000,
                "buffer_size": 100
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/iot/connect-device" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_id": "PLC_001",
    "device_type": "plc",
    "protocol": "opcua",
    "connection_config": {
      "endpoint_url": "opc.tcp://192.168.1.100:4840",
      "security_mode": "SignAndEncrypt",
      "auth": {
        "username": "admin",
        "password": "password123"
      }
    },
    "data_points": [
      {
        "node_id": "ns=2;i=1001",
        "name": "temperature",
        "data_type": "float"
      }
    ]
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/connect-device",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "device_id": "PLC_001",
        "device_type": "plc",
        "protocol": "opcua",
        "connection_config": {
            "endpoint_url": "opc.tcp://192.168.1.100:4840",
            "security_mode": "SignAndEncrypt",
            "auth": {
                "username": "admin",
                "password": "password123"
            }
        },
        "data_points": [
            {
                "node_id": "ns=2;i=1001",
                "name": "temperature",
                "data_type": "float"
            }
        ]
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/connect-device', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    device_id: 'PLC_001',
    device_type: 'plc',
    protocol: 'opcua',
    connection_config: {
      endpoint_url: 'opc.tcp://192.168.1.100:4840',
      security_mode: 'SignAndEncrypt',
      auth: {
        username: 'admin',
        password: 'password123'
      }
    },
    data_points: [
      {
        node_id: 'ns=2;i=1001',
        name: 'temperature',
        data_type: 'float'
      }
    ]
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/iot/devices/{device_id}/data"
        title="Get Real-time Device Data"
        description="Retrieve real-time telemetry data from a connected IoT device."
        parameters={[
          {
            name: "device_id",
            type: "string",
            required: true,
            description: "Device identifier"
          },
          {
            name: "data_points",
            type: "array",
            required: false,
            description: "Specific data points to retrieve"
          },
          {
            name: "time_window",
            type: "string",
            required: false,
            description: "Time window for historical data (1m, 5m, 1h)"
          },
          {
            name: "aggregation",
            type: "string",
            required: false,
            description: "Data aggregation method (raw, avg, min, max)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Device data retrieved successfully',
            example: JSON.stringify({
              "device_id": "PLC_001",
              "timestamp": "2024-01-15T10:00:00Z",
              "connection_status": "online",
              "data_points": [
                {
                  "name": "temperature",
                  "value": 72.5,
                  "unit": "celsius",
                  "quality": "good",
                  "timestamp": "2024-01-15T10:00:00Z"
                },
                {
                  "name": "pressure",
                  "value": 145.2,
                  "unit": "psi",
                  "quality": "good",
                  "timestamp": "2024-01-15T10:00:00Z"
                },
                {
                  "name": "vibration",
                  "value": 0.25,
                  "unit": "mm/s",
                  "quality": "uncertain",
                  "timestamp": "2024-01-15T09:59:58Z"
                }
              ],
              "alarms": [
                {
                  "type": "high_temperature",
                  "severity": "warning",
                  "message": "Temperature approaching upper limit"
                }
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/iot/devices/PLC_001/data?time_window=5m" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/devices/PLC_001/data",
    headers={"Authorization": f"Bearer {api_key}"},
    params={
        "data_points": ["temperature", "pressure"],
        "time_window": "5m",
        "aggregation": "avg"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/devices/PLC_001/data?time_window=5m', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const deviceData = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/iot/devices/{device_id}/control"
        title="Send Control Command"
        description="Send control commands to IoT devices for remote operation and parameter adjustment."
        parameters={[
          {
            name: "device_id",
            type: "string",
            required: true,
            description: "Device identifier"
          },
          {
            name: "command_type",
            type: "string",
            required: true,
            description: "Type of command (set_parameter, start, stop, reset)"
          },
          {
            name: "parameters",
            type: "object",
            required: true,
            description: "Command parameters"
          },
          {
            name: "execution_mode",
            type: "string",
            required: false,
            description: "Execution mode (immediate, scheduled, conditional)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Control command executed successfully',
            example: JSON.stringify({
              "device_id": "PLC_001",
              "command_id": "CMD_12345",
              "command_type": "set_parameter",
              "execution_status": "completed",
              "execution_time": "2024-01-15T10:00:00Z",
              "parameters_set": [
                {
                  "parameter": "target_temperature",
                  "old_value": 70.0,
                  "new_value": 75.0,
                  "unit": "celsius"
                }
              ],
              "device_response": {
                "status": "acknowledged",
                "message": "Parameter updated successfully"
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/iot/devices/PLC_001/control" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "command_type": "set_parameter",
    "parameters": {
      "target_temperature": 75.0,
      "setpoint_ramp_rate": 2.0
    },
    "execution_mode": "immediate"
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/devices/PLC_001/control",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "command_type": "set_parameter",
        "parameters": {
            "target_temperature": 75.0,
            "setpoint_ramp_rate": 2.0
        },
        "execution_mode": "immediate"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/devices/PLC_001/control', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    command_type: 'set_parameter',
    parameters: {
      target_temperature: 75.0,
      setpoint_ramp_rate: 2.0
    },
    execution_mode: 'immediate'
  })
});
const result = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/iot/edge-processing/deploy"
        title="Deploy Edge Processing Logic"
        description="Deploy custom edge processing logic to IoT gateways for real-time data processing."
        parameters={[
          {
            name: "gateway_id",
            type: "string",
            required: true,
            description: "Edge gateway identifier"
          },
          {
            name: "processing_logic",
            type: "object",
            required: true,
            description: "Edge processing configuration"
          },
          {
            name: "deployment_mode",
            type: "string",
            required: false,
            description: "Deployment mode (hot_swap, scheduled, manual)"
          }
        ]}
        responses={[
          {
            status: 202,
            description: 'Edge processing deployment initiated',
            example: JSON.stringify({
              "gateway_id": "GATEWAY_001",
              "deployment_id": "DEPLOY_12345",
              "status": "deploying",
              "processing_logic": {
                "name": "vibration_anomaly_detection",
                "version": "v1.2.0",
                "runtime": "python3.9"
              },
              "estimated_completion": "2024-01-15T10:05:00Z",
              "rollback_available": true,
              "previous_version": "v1.1.0"
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/iot/edge-processing/deploy" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "gateway_id": "GATEWAY_001",
    "processing_logic": {
      "name": "vibration_anomaly_detection",
      "code": "base64_encoded_python_code",
      "dependencies": ["numpy", "scipy"],
      "triggers": ["vibration_data_received"],
      "output_actions": ["send_alert", "log_anomaly"]
    },
    "deployment_mode": "hot_swap"
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/edge-processing/deploy",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "gateway_id": "GATEWAY_001",
        "processing_logic": {
            "name": "vibration_anomaly_detection",
            "code": "base64_encoded_python_code",
            "dependencies": ["numpy", "scipy"],
            "triggers": ["vibration_data_received"],
            "output_actions": ["send_alert", "log_anomaly"]
        },
        "deployment_mode": "hot_swap"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/edge-processing/deploy', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    gateway_id: 'GATEWAY_001',
    processing_logic: {
      name: 'vibration_anomaly_detection',
      code: 'base64_encoded_python_code',
      dependencies: ['numpy', 'scipy'],
      triggers: ['vibration_data_received'],
      output_actions: ['send_alert', 'log_anomaly']
    },
    deployment_mode: 'hot_swap'
  })
});
const deployment = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/iot/network-topology"
        title="Get Network Topology"
        description="Retrieve the current IoT network topology and device connectivity status."
        parameters={[
          {
            name: "plant_id",
            type: "string",
            required: false,
            description: "Filter by plant identifier"
          },
          {
            name: "include_offline",
            type: "boolean",
            required: false,
            description: "Include offline devices in topology"
          },
          {
            name: "detail_level",
            type: "string",
            required: false,
            description: "Level of detail (basic, detailed, comprehensive)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Network topology retrieved successfully',
            example: JSON.stringify({
              "plant_id": "PLANT_001",
              "topology_timestamp": "2024-01-15T10:00:00Z",
              "total_devices": 156,
              "online_devices": 152,
              "network_segments": [
                {
                  "segment_id": "PRODUCTION_LINE_A",
                  "gateway": "GATEWAY_001",
                  "devices": [
                    {
                      "device_id": "PLC_001",
                      "device_type": "plc",
                      "status": "online",
                      "protocol": "opcua",
                      "last_seen": "2024-01-15T09:59:58Z",
                      "data_points": 24,
                      "network_quality": {
                        "signal_strength": -45,
                        "packet_loss": 0.01,
                        "latency_ms": 12
                      }
                    }
                  ]
                }
              ],
              "communication_paths": [
                {
                  "from": "PLC_001",
                  "to": "GATEWAY_001",
                  "protocol": "opcua",
                  "bandwidth_usage": 0.35,
                  "health_status": "good"
                }
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/iot/network-topology?plant_id=PLANT_001&detail_level=detailed" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/network-topology",
    headers={"Authorization": f"Bearer {api_key}"},
    params={
        "plant_id": "PLANT_001",
        "include_offline": True,
        "detail_level": "detailed"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/network-topology?plant_id=PLANT_001&detail_level=detailed', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const topology = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/iot/predictive-maintenance"
        title="Predictive Maintenance Analysis"
        description="Run predictive maintenance analysis on IoT sensor data to predict equipment failures."
        parameters={[
          {
            name: "equipment_id",
            type: "string",
            required: true,
            description: "Equipment identifier"
          },
          {
            name: "sensor_data",
            type: "object",
            required: true,
            description: "Recent sensor readings"
          },
          {
            name: "analysis_model",
            type: "string",
            required: false,
            description: "ML model to use for analysis"
          },
          {
            name: "prediction_horizon",
            type: "string",
            required: false,
            description: "Prediction time horizon (1w, 2w, 1m, 3m)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Predictive maintenance analysis completed',
            example: JSON.stringify({
              "equipment_id": "MACHINE_001",
              "analysis_timestamp": "2024-01-15T10:00:00Z",
              "health_score": 0.72,
              "risk_level": "medium",
              "predicted_failures": [
                {
                  "component": "bearing_main",
                  "failure_probability": 0.15,
                  "estimated_time_to_failure": "28 days",
                  "confidence": 0.82,
                  "contributing_factors": [
                    "Increased vibration amplitude",
                    "Temperature trend upward"
                  ]
                }
              ],
              "maintenance_recommendations": [
                {
                  "action": "Inspect bearing condition",
                  "priority": "high",
                  "suggested_date": "2024-01-22T08:00:00Z",
                  "estimated_duration": "2 hours"
                },
                {
                  "action": "Replace vibration sensor",
                  "priority": "medium",
                  "suggested_date": "2024-01-25T10:00:00Z",
                  "estimated_duration": "30 minutes"
                }
              ],
              "cost_analysis": {
                "preventive_maintenance_cost": 2500,
                "potential_failure_cost": 15000,
                "savings_opportunity": 12500
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/iot/predictive-maintenance" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "equipment_id": "MACHINE_001",
    "sensor_data": {
      "vibration": {
        "x_axis": 2.5,
        "y_axis": 1.8,
        "z_axis": 3.2,
        "overall": 4.1
      },
      "temperature": {
        "bearing_1": 65.5,
        "bearing_2": 68.2,
        "motor": 72.1
      },
      "current": {
        "phase_a": 12.5,
        "phase_b": 12.8,
        "phase_c": 12.3
      }
    },
    "prediction_horizon": "1m"
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/iot/predictive-maintenance",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "equipment_id": "MACHINE_001",
        "sensor_data": {
            "vibration": {
                "x_axis": 2.5,
                "y_axis": 1.8,
                "z_axis": 3.2,
                "overall": 4.1
            },
            "temperature": {
                "bearing_1": 65.5,
                "bearing_2": 68.2,
                "motor": 72.1
            },
            "current": {
                "phase_a": 12.5,
                "phase_b": 12.8,
                "phase_c": 12.3
            }
        },
        "prediction_horizon": "1m"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/iot/predictive-maintenance', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    equipment_id: 'MACHINE_001',
    sensor_data: {
      vibration: {
        x_axis: 2.5,
        y_axis: 1.8,
        z_axis: 3.2,
        overall: 4.1
      },
      temperature: {
        bearing_1: 65.5,
        bearing_2: 68.2,
        motor: 72.1
      },
      current: {
        phase_a: 12.5,
        phase_b: 12.8,
        phase_c: 12.3
      }
    },
    prediction_horizon: '1m'
  })
});
const analysis = await response.json();`
        }}
      />
    </div>
  )
}