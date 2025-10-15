'use client'

import { EndpointCard } from '../../../components/ui/EndpointCard'

export default function DigitalTwinPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Digital Twin Framework API</h1>
        <p className="text-gray-600 text-lg">
          Create and manage digital twins of manufacturing assets with real-time simulation, predictive modeling, and virtual testing capabilities.
        </p>
      </div>

      <EndpointCard
        method="POST"
        path="/api/v1/digital-twin/create"
        title="Create Digital Twin"
        description="Initialize a new digital twin for manufacturing equipment with physics-based modeling and simulation capabilities."
        parameters={[
          {
            name: "asset_details",
            type: "object",
            required: true,
            description: "Physical asset information (asset_id, asset_type, manufacturer, model)"
          },
          {
            name: "twin_configuration",
            type: "object",
            required: true,
            description: "Digital twin simulation settings (physics_model, update_frequency, simulation_fidelity, predictive_horizon)"
          },
          {
            name: "sensor_mapping",
            type: "array",
            required: true,
            description: "Sensor data source configuration array (sensor_id, parameter_type, mapping_function)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Digital twin creation successful',
            example: JSON.stringify({
              "digital_twin_id": "DT_ASSET_001_2024",
              "asset_id": "CNC_MILL_001",
              "status": "initializing",
              "twin_configuration": {
                "physics_model": "detailed",
                "simulation_state": "calibrating",
                "calibration_progress": 0.15,
                "estimated_ready_time": "2024-01-16T10:30:00Z"
              },
              "sensor_connections": [
                {"sensor_id": "TEMP_001", "status": "connected", "last_reading": "2024-01-16T09:00:00Z"},
                {"sensor_id": "VIB_001", "status": "connected", "last_reading": "2024-01-16T09:00:00Z"}
              ],
              "simulation_endpoints": {
                "real_time_sync": "/api/v1/digital-twin/DT_ASSET_001_2024/sync",
                "prediction_api": "/api/v1/digital-twin/DT_ASSET_001_2024/predict",
                "scenario_testing": "/api/v1/digital-twin/DT_ASSET_001_2024/scenario"
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/digital-twin/create" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "asset_details": {
      "asset_id": "CNC_MILL_001",
      "asset_type": "cnc_machine",
      "manufacturer": "Haas",
      "model": "VF-2SS"
    },
    "twin_configuration": {
      "physics_model": "detailed",
      "update_frequency": "5s",
      "simulation_fidelity": "high",
      "predictive_horizon": "24h"
    },
    "sensor_mapping": [
      {
        "sensor_id": "TEMP_001",
        "parameter_type": "spindle_temperature",
        "mapping_function": "celsius_to_simulation"
      }
    ]
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/digital-twin/create",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "asset_details": {
            "asset_id": "CNC_MILL_001",
            "asset_type": "cnc_machine",
            "manufacturer": "Haas",
            "model": "VF-2SS"
        },
        "twin_configuration": {
            "physics_model": "detailed",
            "update_frequency": "5s",
            "simulation_fidelity": "high",
            "predictive_horizon": "24h"
        },
        "sensor_mapping": [
            {
                "sensor_id": "TEMP_001",
                "parameter_type": "spindle_temperature",
                "mapping_function": "celsius_to_simulation"
            }
        ]
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/digital-twin/create', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    asset_details: {
      asset_id: 'CNC_MILL_001',
      asset_type: 'cnc_machine',
      manufacturer: 'Haas',
      model: 'VF-2SS'
    },
    twin_configuration: {
      physics_model: 'detailed',
      update_frequency: '5s',
      simulation_fidelity: 'high',
      predictive_horizon: '24h'
    },
    sensor_mapping: [
      {
        sensor_id: 'TEMP_001',
        parameter_type: 'spindle_temperature',
        mapping_function: 'celsius_to_simulation'
      }
    ]
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/digital-twin/{twin_id}/state"
        title="Get Digital Twin State"
        description="Retrieve current real-time state of the digital twin including simulation data and synchronized sensor values."
        parameters={[
          {
            name: "twin_id",
            type: "string",
            required: true,
            description: "Digital twin identifier"
          },
          {
            name: "include_predictions",
            type: "boolean",
            required: false,
            description: "Include predictive analysis in response"
          },
          {
            name: "historical_window",
            type: "string",
            required: false,
            description: "Historical data window (1h, 6h, 24h)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Digital twin state retrieved successfully',
            example: JSON.stringify({
              "twin_id": "DT_ASSET_001_2024",
              "asset_id": "CNC_MILL_001",
              "last_updated": "2024-01-16T15:30:45Z",
              "sync_status": "synchronized",
              "current_state": {
                "operational_status": "running",
                "spindle_speed_rpm": 2400,
                "spindle_temperature_c": 45.2,
                "vibration_amplitude": 0.15,
                "power_consumption_kw": 12.8,
                "tool_wear_percentage": 23.5
              },
              "simulation_state": {
                "physics_engine_status": "stable",
                "simulation_accuracy": 0.94,
                "model_confidence": 0.91,
                "last_calibration": "2024-01-16T08:00:00Z"
              },
              "predictive_insights": {
                "remaining_useful_life_hours": 156,
                "next_maintenance_recommendation": "2024-01-22T08:00:00Z",
                "failure_probability_24h": 0.03,
                "performance_degradation_trend": "stable"
              },
              "alerts": [
                {
                  "type": "predictive_warning",
                  "severity": "medium",
                  "message": "Tool wear approaching replacement threshold",
                  "expected_action_date": "2024-01-18T10:00:00Z"
                }
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/state?include_predictions=true" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/state",
    headers={"Authorization": f"Bearer {api_key}"},
    params={"include_predictions": True}
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/state?include_predictions=true', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const state = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/digital-twin/{twin_id}/scenario-test"
        title="Run Scenario Testing"
        description="Execute what-if scenarios on the digital twin to test operational changes, maintenance schedules, or process optimizations."
        parameters={[
          {
            name: "twin_id",
            type: "string",
            required: true,
            description: "Digital twin identifier"
          },
          {
            name: "scenario_config",
            type: "object",
            required: true,
            description: "Scenario testing parameters (scenario_name, test_duration, parameter_changes, simulation_speed)"
          },
          {
            name: "test_parameters",
            type: "array",
            required: true,
            description: "Parameters to modify during scenario array (parameter_name, new_value, change_schedule)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Scenario test started successfully',
            example: JSON.stringify({
              "scenario_test_id": "SCENARIO_TEST_001",
              "twin_id": "DT_ASSET_001_2024",
              "test_status": "running",
              "scenario_name": "Increased Production Speed",
              "estimated_completion": "2024-01-16T15:45:00Z",
              "test_progress": {
                "completion_percentage": 25,
                "virtual_time_elapsed": "2h 15m",
                "simulation_speed": "100x"
              },
              "preliminary_results": {
                "performance_impact": {
                  "throughput_increase": 0.18,
                  "energy_consumption_change": 0.12,
                  "tool_wear_acceleration": 0.28
                },
                "risk_assessment": {
                  "failure_probability_change": 0.05,
                  "quality_impact_risk": "low",
                  "maintenance_frequency_change": 1.15
                }
              },
              "real_time_monitoring": {
                "monitoring_url": "/api/v1/digital-twin/DT_ASSET_001_2024/scenario/SCENARIO_TEST_001/monitor",
                "results_webhook": "https://your-system.com/webhooks/scenario-results"
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/scenario-test" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scenario_config": {
      "scenario_name": "Increased Production Speed",
      "test_duration": "8h",
      "simulation_speed": 100
    },
    "test_parameters": [
      {
        "parameter_name": "spindle_speed_rpm",
        "new_value": 2800,
        "change_schedule": "immediate"
      }
    ]
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/scenario-test",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "scenario_config": {
            "scenario_name": "Increased Production Speed",
            "test_duration": "8h",
            "simulation_speed": 100
        },
        "test_parameters": [
            {
                "parameter_name": "spindle_speed_rpm",
                "new_value": 2800,
                "change_schedule": "immediate"
            }
        ]
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/scenario-test', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    scenario_config: {
      scenario_name: 'Increased Production Speed',
      test_duration: '8h',
      simulation_speed: 100
    },
    test_parameters: [
      {
        parameter_name: 'spindle_speed_rpm',
        new_value: 2800,
        change_schedule: 'immediate'
      }
    ]
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/digital-twin/{twin_id}/optimization"
        title="Optimize Twin Parameters"
        description="Run AI-powered optimization to find optimal operating parameters for maximum efficiency, quality, or cost reduction."
        parameters={[
          {
            name: "twin_id",
            type: "string",
            required: true,
            description: "Digital twin identifier"
          },
          {
            name: "optimization_config",
            type: "object",
            required: true,
            description: "Optimization objectives and constraints (primary_objective, optimization_horizon, algorithm)"
          },
          {
            name: "constraints",
            type: "array",
            required: false,
            description: "Operating constraints and limits array (parameter_name, min_value, max_value, constraint_type)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Optimization completed successfully',
            example: JSON.stringify({
              "optimization_id": "OPT_DT_001_2024",
              "twin_id": "DT_ASSET_001_2024",
              "status": "completed",
              "execution_time_seconds": 234.7,
              "optimization_results": {
                "objective_improvement": 0.23,
                "current_objective_value": 87.3,
                "optimized_objective_value": 107.4,
                "confidence_level": 0.89
              },
              "recommended_parameters": [
                {
                  "parameter_name": "spindle_speed_rpm",
                  "current_value": 2400,
                  "optimal_value": 2650,
                  "improvement_impact": 0.15
                },
                {
                  "parameter_name": "feed_rate_mm_min",
                  "current_value": 800,
                  "optimal_value": 920,
                  "improvement_impact": 0.08
                }
              ],
              "implementation_plan": {
                "phased_rollout": true,
                "validation_period": "24h",
                "rollback_criteria": [
                  "quality_degradation > 5%",
                  "tool_wear_increase > 20%"
                ]
              },
              "risk_analysis": {
                "implementation_risk": "low",
                "potential_side_effects": [
                  "Slight increase in tool wear rate",
                  "Higher energy consumption during peak operation"
                ],
                "monitoring_recommendations": [
                  "Monitor tool wear closely for first 48 hours",
                  "Track quality metrics continuously"
                ]
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/optimization" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "optimization_config": {
      "primary_objective": "maximize_throughput",
      "optimization_horizon": "24h",
      "algorithm": "genetic_algorithm"
    },
    "constraints": [
      {
        "parameter_name": "spindle_speed_rpm",
        "min_value": 1000,
        "max_value": 3000,
        "constraint_type": "hard_limit"
      }
    ]
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/optimization",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "optimization_config": {
            "primary_objective": "maximize_throughput",
            "optimization_horizon": "24h",
            "algorithm": "genetic_algorithm"
        },
        "constraints": [
            {
                "parameter_name": "spindle_speed_rpm",
                "min_value": 1000,
                "max_value": 3000,
                "constraint_type": "hard_limit"
            }
        ]
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/optimization', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    optimization_config: {
      primary_objective: 'maximize_throughput',
      optimization_horizon: '24h',
      algorithm: 'genetic_algorithm'
    },
    constraints: [
      {
        parameter_name: 'spindle_speed_rpm',
        min_value: 1000,
        max_value: 3000,
        constraint_type: 'hard_limit'
      }
    ]
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/digital-twin/{twin_id}/analytics"
        title="Get Twin Analytics"
        description="Retrieve comprehensive analytics and insights from digital twin historical data and simulation results."
        parameters={[
          {
            name: "twin_id",
            type: "string",
            required: true,
            description: "Digital twin identifier"
          },
          {
            name: "analytics_type",
            type: "array",
            required: false,
            description: "Types of analytics to include array (performance_trends, predictive_insights, anomaly_detection, cost_analysis)"
          },
          {
            name: "time_period",
            type: "string",
            required: false,
            description: "Analysis time period (24h, 7d, 30d, 90d)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Analytics retrieved successfully',
            example: JSON.stringify({
              "twin_id": "DT_ASSET_001_2024",
              "analysis_period": "30d",
              "generated_at": "2024-01-16T15:30:00Z",
              "performance_analytics": {
                "overall_efficiency": 0.847,
                "efficiency_trend": "improving",
                "availability": 0.923,
                "utilization_rate": 0.789,
                "quality_consistency": 0.956
              },
              "predictive_insights": {
                "failure_predictions": [
                  {
                    "component": "spindle_bearings",
                    "predicted_failure_date": "2024-02-15T12:00:00Z",
                    "confidence": 0.78,
                    "recommended_action": "Schedule bearing replacement during next maintenance window"
                  }
                ],
                "performance_forecasts": {
                  "7_day_efficiency_forecast": [0.85, 0.86, 0.84, 0.87, 0.85, 0.88, 0.86],
                  "maintenance_schedule_optimization": "Shift weekly maintenance to Tuesday for 3% efficiency gain"
                }
              },
              "anomaly_detection": {
                "anomalies_detected": 3,
                "anomaly_types": [
                  {
                    "type": "vibration_spike",
                    "occurrences": 2,
                    "severity": "medium",
                    "pattern": "correlates_with_tool_changes"
                  }
                ],
                "false_positive_rate": 0.05
              },
              "cost_optimization": {
                "current_operating_cost_per_hour": 45.80,
                "optimized_cost_per_hour": 41.20,
                "potential_savings_percent": 10.0,
                "energy_efficiency_opportunities": [
                  "Implement load-based power management: $12/day savings",
                  "Optimize idle time operations: $8/day savings"
                ]
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/analytics?time_period=30d" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/analytics",
    headers={"Authorization": f"Bearer {api_key}"},
    params={"time_period": "30d"}
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/analytics?time_period=30d', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const analytics = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/digital-twin/{twin_id}/realtime-sync"
        title="Real-time Twin Synchronization"
        description="Establish WebSocket connection for real-time digital twin synchronization with live sensor data and simulation updates."
        parameters={[
          {
            name: "twin_id",
            type: "string",
            required: true,
            description: "Digital twin identifier"
          }
        ]}
        responses={[
          {
            status: 101,
            description: 'WebSocket connection established',
            example: JSON.stringify({
              "connection_established": true,
              "twin_id": "DT_ASSET_001_2024",
              "sync_frequency": "1s",
              "data_streams": [
                "sensor_readings",
                "simulation_state",
                "predictive_alerts",
                "performance_metrics"
              ],
              "simulation_quality": {
                "accuracy": 0.94,
                "latency_ms": 45,
                "sync_status": "optimal"
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/realtime-sync" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Upgrade: websocket"`,
          javascript: `const ws = new WebSocket('wss://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/realtime-sync');

ws.onopen = function(event) {
    console.log('Connected to digital twin real-time sync');
    ws.send(JSON.stringify({
        'auth_token': apiKey,
        'subscribe': ['sensor_readings', 'predictive_alerts', 'performance_metrics'],
        'sync_quality': 'high_fidelity'
    }));
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'sensor_update') {
        updateTwinVisualization(data.sensor_readings);
    } else if (data.type === 'predictive_alert') {
        handlePredictiveAlert(data);
    } else if (data.type === 'simulation_state') {
        updateSimulationDisplay(data);
    }
};`,
          python: `import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    
    if data.get('type') == 'sensor_update':
        process_sensor_data(data['sensor_readings'])
    elif data.get('type') == 'predictive_alert':
        handle_alert(data)
    elif data.get('type') == 'simulation_state':
        update_twin_model(data)

def on_open(ws):
    auth_msg = {
        'auth_token': api_key,
        'subscribe': ['sensor_readings', 'predictive_alerts', 'simulation_state'],
        'update_frequency': '1s'
    }
    ws.send(json.dumps(auth_msg))

ws = websocket.WebSocketApp(
    "wss://api.schlep-engine.com/api/v1/digital-twin/DT_ASSET_001_2024/realtime-sync",
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()`
        }}
      />
    </div>
  )
}