import { EndpointCard } from '../../components/ui/EndpointCard'

export default function ManufacturingAnalyticsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Manufacturing Analytics API</h1>
        <p className="text-gray-600 text-lg">
          Advanced real-time analytics, forecasting, and statistical process control for manufacturing operations.
        </p>
      </div>

      <EndpointCard
        method="POST"
        endpoint="/api/v1/manufacturing/analytics/stream-analyze"
        title="Stream Analytics"
        description="Perform real-time analytics on streaming manufacturing data with <100ms response time."
        parameters={[
          {
            name: "equipment_id",
            type: "string",
            required: true,
            description: "Equipment identifier for analysis"
          },
          {
            name: "analysis_type",
            type: "array",
            required: true,
            description: "Types of analysis to perform",
            properties: [
              { name: "predictive_maintenance", type: "boolean", description: "Enable predictive maintenance analysis" },
              { name: "anomaly_detection", type: "boolean", description: "Enable anomaly detection" },
              { name: "quality_prediction", type: "boolean", description: "Enable quality prediction" }
            ]
          }
        ]}
        response={{
          "analysis_id": "analysis_abc123",
          "equipment_id": "press_001",
          "results": {
            "health_score": 0.87,
            "anomaly_probability": 0.12,
            "quality_prediction": 0.94,
            "maintenance_recommendation": "Schedule inspection within 7 days"
          },
          "processing_time_ms": 67,
          "confidence": 0.92
        }}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/analytics/stream-analyze" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "equipment_id": "press_001",
    "analysis_type": {
      "predictive_maintenance": true,
      "anomaly_detection": true,
      "quality_prediction": true
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/analytics/stream-analyze",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "equipment_id": "press_001",
        "analysis_type": {
            "predictive_maintenance": True,
            "anomaly_detection": True,
            "quality_prediction": True
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/analytics/stream-analyze', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    equipment_id: 'press_001',
    analysis_type: {
      predictive_maintenance: true,
      anomaly_detection: true,
      quality_prediction: true
    }
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/manufacturing/analytics/forecasts/{equipment_id}"
        title="Get Equipment Forecasts"
        description="Get predictive forecasts for equipment performance and maintenance needs."
        parameters={[
          {
            name: "equipment_id",
            type: "string",
            required: true,
            description: "Equipment identifier"
          },
          {
            name: "forecast_horizon",
            type: "string",
            required: false,
            description: "Forecast time horizon (1d, 7d, 30d, 90d)"
          }
        ]}
        response={{
          "equipment_id": "press_001",
          "forecast_horizon": "30d",
          "forecasts": {
            "failure_probability": [
              {"date": "2024-01-16", "probability": 0.05},
              {"date": "2024-01-23", "probability": 0.12},
              {"date": "2024-01-30", "probability": 0.28}
            ],
            "performance_degradation": {
              "current_efficiency": 0.87,
              "predicted_efficiency": 0.82,
              "degradation_rate": 0.02
            },
            "maintenance_windows": [
              {"start": "2024-01-25T08:00:00Z", "end": "2024-01-25T12:00:00Z", "type": "preventive"},
              {"start": "2024-02-08T08:00:00Z", "end": "2024-02-08T16:00:00Z", "type": "major_service"}
            ]
          }
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/manufacturing/analytics/spc/configure"
        title="Configure Statistical Process Control"
        description="Set up automated SPC monitoring with control limits and violation detection."
        parameters={[
          {
            name: "process_id",
            type: "string",
            required: true,
            description: "Process identifier"
          },
          {
            name: "spc_config",
            type: "object",
            required: true,
            description: "SPC configuration",
            properties: [
              { name: "control_limits", type: "object", description: "Upper and lower control limits" },
              { name: "chart_type", type: "string", description: "Control chart type (x_bar, r_chart, p_chart, etc.)" },
              { name: "sample_size", type: "number", description: "Sample size for control chart" },
              { name: "violation_rules", type: "array", description: "Western Electric rules to monitor" }
            ]
          }
        ]}
        response={{
          "spc_id": "spc_abc123",
          "process_id": "quality_line_01",
          "status": "active",
          "control_limits": {
            "ucl": 45.2,
            "lcl": 38.8,
            "center_line": 42.0
          },
          "monitoring_rules": [
            "point_beyond_limits",
            "two_of_three_beyond_2sigma",
            "four_of_five_beyond_1sigma"
          ],
          "configured_at": "2024-01-15T10:00:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/manufacturing/analytics/efficiency/{line_id}"
        title="Get Production Efficiency Metrics"
        description="Calculate and retrieve Overall Equipment Effectiveness (OEE) and efficiency metrics."
        parameters={[
          {
            name: "line_id",
            type: "string",
            required: true,
            description: "Production line identifier"
          },
          {
            name: "time_period",
            type: "string",
            required: false,
            description: "Time period for metrics (shift, day, week, month)"
          }
        ]}
        response={{
          "line_id": "production_line_01",
          "time_period": "day",
          "oee_metrics": {
            "overall_oee": 0.72,
            "availability": 0.85,
            "performance": 0.89,
            "quality": 0.95
          },
          "efficiency_breakdown": {
            "planned_production_time": 480,
            "actual_runtime": 408,
            "downtime_minutes": 72,
            "units_produced": 1450,
            "target_units": 1600,
            "quality_units": 1378
          },
          "improvement_recommendations": [
            "Reduce setup time by 15 minutes per changeover",
            "Address quality issues in station 3"
          ]
        }}
      />

      <EndpointCard
        method="WebSocket"
        endpoint="/api/v1/manufacturing/analytics/realtime/{equipment_id}"
        title="Real-time Analytics WebSocket"
        description="Establish WebSocket connection for real-time analytics updates."
        parameters={[
          {
            name: "equipment_id",
            type: "string",
            required: true,
            description: "Equipment identifier for real-time updates"
          }
        ]}
        response={{
          "connection_established": true,
          "equipment_id": "press_001",
          "update_frequency": "1s",
          "data_streams": [
            "health_score",
            "anomaly_probability",
            "quality_prediction",
            "efficiency_metrics"
          ]
        }}
        examples={{
          javascript: `const ws = new WebSocket('wss://api.schlep-engine.com/api/v1/manufacturing/analytics/realtime/press_001');

ws.onopen = function(event) {
    console.log('Connected to real-time analytics stream');
    ws.send(JSON.stringify({
        'auth_token': apiKey,
        'subscribe': ['health_score', 'anomaly_probability']
    }));
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Real-time analytics:', data);
    // Handle real-time data updates
};`,
          python: `import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    print(f"Real-time analytics: {data}")

def on_open(ws):
    auth_msg = {
        'auth_token': api_key,
        'subscribe': ['health_score', 'anomaly_probability']
    }
    ws.send(json.dumps(auth_msg))

ws = websocket.WebSocketApp(
    "wss://api.schlep-engine.com/api/v1/manufacturing/analytics/realtime/press_001",
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()`
        }}
      />
    </div>
  )
}