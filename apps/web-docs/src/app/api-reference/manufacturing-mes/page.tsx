'use client'

import { EndpointCard } from '../../../components/ui/EndpointCard'

export default function ManufacturingMESPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Manufacturing MES Integration API</h1>
        <p className="text-gray-600 text-lg">
          Complete Manufacturing Execution System (MES) integration with production scheduling, quality control, and real-time monitoring.
        </p>
      </div>

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/mes/production-order"
        title="Create Production Order"
        description="Create and schedule a new production order with resource allocation and timeline management."
        parameters={[
          {
            name: "order_details",
            type: "object",
            required: true,
            description: "Production order information",
            properties: [
              { name: "product_id", type: "string", description: "Product identifier" },
              { name: "quantity", type: "number", description: "Production quantity" },
              { name: "priority", type: "string", description: "Order priority (low, normal, high, urgent)" },
              { name: "due_date", type: "string", description: "Expected completion date (ISO 8601)" }
            ]
          },
          {
            name: "resource_requirements",
            type: "array",
            required: true,
            description: "Required resources and constraints",
            properties: [
              { name: "resource_type", type: "string", description: "Type of resource (machine, operator, material)" },
              { name: "resource_id", type: "string", description: "Specific resource identifier" },
              { name: "duration_minutes", type: "number", description: "Estimated duration" }
            ]
          }
        ]}
        responses={[
          {
            status: 201,
            description: 'Production order created successfully',
            example: JSON.stringify({
              "production_order_id": "PO_2024_001234",
              "status": "scheduled",
              "estimated_start": "2024-01-16T08:00:00Z",
              "estimated_completion": "2024-01-16T14:30:00Z",
              "assigned_resources": [
                {"resource_id": "machine_001", "type": "cnc_mill", "duration_minutes": 240},
                {"resource_id": "operator_003", "type": "technician", "duration_minutes": 390}
              ],
              "total_cost_estimate": 1250.50,
              "material_requirements": [
                {"material_id": "steel_plate_5mm", "quantity": 12.5, "unit": "kg"}
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/mes/production-order" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "order_details": {
      "product_id": "PROD_ABC123",
      "quantity": 50,
      "priority": "high",
      "due_date": "2024-01-16T14:00:00Z"
    },
    "resource_requirements": [
      {
        "resource_type": "machine",
        "resource_id": "machine_001",
        "duration_minutes": 240
      }
    ]
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/mes/production-order",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "order_details": {
            "product_id": "PROD_ABC123",
            "quantity": 50,
            "priority": "high",
            "due_date": "2024-01-16T14:00:00Z"
        },
        "resource_requirements": [
            {
                "resource_type": "machine",
                "resource_id": "machine_001",
                "duration_minutes": 240
            }
        ]
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/mes/production-order', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    order_details: {
      product_id: 'PROD_ABC123',
      quantity: 50,
      priority: 'high',
      due_date: '2024-01-16T14:00:00Z'
    },
    resource_requirements: [
      {
        resource_type: 'machine',
        resource_id: 'machine_001',
        duration_minutes: 240
      }
    ]
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/mes/production-status/{order_id}"
        title="Get Production Status"
        description="Get real-time production status, progress, and performance metrics for a specific order."
        parameters={[
          {
            name: "order_id",
            type: "string",
            required: true,
            description: "Production order identifier"
          },
          {
            name: "include_metrics",
            type: "boolean",
            required: false,
            description: "Include detailed performance metrics"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Production status retrieved successfully',
            example: JSON.stringify({
              "production_order_id": "PO_2024_001234",
              "status": "in_progress",
              "progress_percentage": 67.5,
              "current_operation": "machining_step_3",
              "completed_quantity": 34,
              "remaining_quantity": 16,
              "actual_start": "2024-01-16T08:15:00Z",
              "estimated_completion": "2024-01-16T15:20:00Z",
              "performance_metrics": {
                "oee": 0.78,
                "cycle_time_variance": -0.05,
                "quality_rate": 0.96,
                "downtime_minutes": 12
              },
              "active_alerts": [
                {"type": "quality_warning", "message": "Tolerance approaching limits on station 2"}
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/mes/production-status/PO_2024_001234?include_metrics=true" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/mes/production-status/PO_2024_001234",
    headers={"Authorization": f"Bearer {api_key}"},
    params={"include_metrics": True}
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/mes/production-status/PO_2024_001234?include_metrics=true', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const status = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/mes/quality-check"
        title="Record Quality Control Data"
        description="Record quality inspection results and trigger automated responses for defects or non-compliance."
        parameters={[
          {
            name: "inspection_data",
            type: "object",
            required: true,
            description: "Quality inspection information",
            properties: [
              { name: "order_id", type: "string", description: "Production order identifier" },
              { name: "operation_step", type: "string", description: "Manufacturing step being inspected" },
              { name: "inspector_id", type: "string", description: "Quality inspector identifier" },
              { name: "inspection_timestamp", type: "string", description: "Inspection time (ISO 8601)" }
            ]
          },
          {
            name: "measurements",
            type: "array",
            required: true,
            description: "Quality measurements and results",
            properties: [
              { name: "parameter_name", type: "string", description: "Measured parameter" },
              { name: "measured_value", type: "number", description: "Actual measurement" },
              { name: "specification_min", type: "number", description: "Minimum acceptable value" },
              { name: "specification_max", type: "number", description: "Maximum acceptable value" },
              { name: "pass_fail", type: "boolean", description: "Whether measurement passes specification" }
            ]
          }
        ]}
        responses={[
          {
            status: 201,
            description: 'Quality check recorded successfully',
            example: JSON.stringify({
              "inspection_id": "QC_2024_005678",
              "order_id": "PO_2024_001234",
              "overall_result": "pass",
              "quality_score": 0.94,
              "measurements_summary": {
                "total_parameters": 8,
                "passed_parameters": 8,
                "failed_parameters": 0,
                "warnings": 1
              },
              "automated_actions": [
                "process_parameter_adjustment_recommended"
              ],
              "next_inspection_due": "2024-01-16T16:00:00Z",
              "compliance_status": "within_specification"
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/mes/quality-check" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "inspection_data": {
      "order_id": "PO_2024_001234",
      "operation_step": "final_inspection",
      "inspector_id": "QC_001",
      "inspection_timestamp": "2024-01-16T15:30:00Z"
    },
    "measurements": [
      {
        "parameter_name": "diameter",
        "measured_value": 25.02,
        "specification_min": 24.95,
        "specification_max": 25.05,
        "pass_fail": true
      }
    ]
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/mes/quality-check",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "inspection_data": {
            "order_id": "PO_2024_001234",
            "operation_step": "final_inspection",
            "inspector_id": "QC_001",
            "inspection_timestamp": "2024-01-16T15:30:00Z"
        },
        "measurements": [
            {
                "parameter_name": "diameter",
                "measured_value": 25.02,
                "specification_min": 24.95,
                "specification_max": 25.05,
                "pass_fail": True
            }
        ]
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/mes/quality-check', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    inspection_data: {
      order_id: 'PO_2024_001234',
      operation_step: 'final_inspection',
      inspector_id: 'QC_001',
      inspection_timestamp: '2024-01-16T15:30:00Z'
    },
    measurements: [
      {
        parameter_name: 'diameter',
        measured_value: 25.02,
        specification_min: 24.95,
        specification_max: 25.05,
        pass_fail: true
      }
    ]
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/mes/resource-utilization"
        title="Get Resource Utilization"
        description="Monitor real-time utilization of manufacturing resources including machines, operators, and materials."
        parameters={[
          {
            name: "time_period",
            type: "string",
            required: false,
            description: "Analysis time period (shift, day, week, month)"
          },
          {
            name: "resource_filter",
            type: "array",
            required: false,
            description: "Filter by specific resource types or IDs"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Resource utilization data retrieved successfully',
            example: JSON.stringify({
              "analysis_period": "day",
              "timestamp": "2024-01-16T15:00:00Z",
              "resource_utilization": {
                "machines": [
                  {
                    "resource_id": "machine_001",
                    "type": "cnc_mill",
                    "utilization_percentage": 87.2,
                    "productive_time_minutes": 419,
                    "downtime_minutes": 61,
                    "maintenance_status": "normal"
                  },
                  {
                    "resource_id": "machine_002",
                    "type": "laser_cutter",
                    "utilization_percentage": 72.8,
                    "productive_time_minutes": 350,
                    "downtime_minutes": 130,
                    "maintenance_status": "scheduled_maintenance_due"
                  }
                ],
                "operators": [
                  {
                    "operator_id": "OP_001",
                    "shift_utilization": 0.95,
                    "active_orders": ["PO_2024_001234", "PO_2024_001235"],
                    "efficiency_rating": 0.92
                  }
                ]
              },
              "overall_plant_oee": 0.74,
              "capacity_analysis": {
                "current_capacity_used": 0.78,
                "bottleneck_resources": ["machine_003"],
                "improvement_recommendations": [
                  "Schedule preventive maintenance for machine_002",
                  "Consider operator cross-training for station flexibility"
                ]
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/mes/resource-utilization?time_period=day" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/mes/resource-utilization",
    headers={"Authorization": f"Bearer {api_key}"},
    params={"time_period": "day"}
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/mes/resource-utilization?time_period=day', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const utilization = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/mes/schedule-optimization"
        title="Optimize Production Schedule"
        description="Run AI-powered schedule optimization to minimize makespan, reduce costs, and improve resource utilization."
        parameters={[
          {
            name: "optimization_parameters",
            type: "object",
            required: true,
            description: "Optimization constraints and objectives",
            properties: [
              { name: "optimization_horizon", type: "string", description: "Planning horizon (1d, 3d, 1w, 1m)" },
              { name: "primary_objective", type: "string", description: "Main optimization goal (minimize_makespan, minimize_cost, maximize_throughput)" },
              { name: "include_maintenance", type: "boolean", description: "Include scheduled maintenance windows" },
              { name: "allow_overtime", type: "boolean", description: "Allow overtime scheduling" }
            ]
          },
          {
            name: "constraints",
            type: "array",
            required: false,
            description: "Additional scheduling constraints",
            properties: [
              { name: "constraint_type", type: "string", description: "Type of constraint (resource_availability, deadline, precedence)" },
              { name: "constraint_details", type: "object", description: "Specific constraint parameters" }
            ]
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Schedule optimization completed successfully',
            example: JSON.stringify({
              "optimization_id": "OPT_2024_001",
              "status": "completed",
              "execution_time_seconds": 45.2,
              "optimization_results": {
                "original_makespan_hours": 72.5,
                "optimized_makespan_hours": 58.3,
                "improvement_percentage": 19.6,
                "cost_reduction_percentage": 12.8,
                "resource_utilization_improvement": 0.15
              },
              "optimized_schedule": [
                {
                  "order_id": "PO_2024_001234",
                  "scheduled_start": "2024-01-16T08:00:00Z",
                  "scheduled_end": "2024-01-16T14:30:00Z",
                  "assigned_resources": ["machine_001", "operator_003"]
                }
              ],
              "recommendations": [
                "Move order PO_2024_001236 to second shift for better resource balance",
                "Consider batch processing for similar orders to reduce setup time"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/mes/schedule-optimization" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "optimization_parameters": {
      "optimization_horizon": "1w",
      "primary_objective": "minimize_makespan",
      "include_maintenance": true,
      "allow_overtime": false
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/mes/schedule-optimization",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "optimization_parameters": {
            "optimization_horizon": "1w",
            "primary_objective": "minimize_makespan",
            "include_maintenance": True,
            "allow_overtime": False
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/mes/schedule-optimization', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    optimization_parameters: {
      optimization_horizon: '1w',
      primary_objective: 'minimize_makespan',
      include_maintenance: true,
      allow_overtime: false
    }
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="WebSocket"
        path="/api/v1/manufacturing/mes/realtime-monitoring/{plant_id}"
        title="Real-time MES Monitoring"
        description="Establish WebSocket connection for real-time manufacturing execution monitoring and alerts."
        parameters={[
          {
            name: "plant_id",
            type: "string",
            required: true,
            description: "Manufacturing plant identifier"
          }
        ]}
        responses={[
          {
            status: 101,
            description: 'WebSocket connection established',
            example: JSON.stringify({
              "connection_established": true,
              "plant_id": "plant_001",
              "monitoring_streams": [
                "production_status",
                "quality_alerts",
                "resource_utilization",
                "maintenance_notifications"
              ],
              "update_frequency": "2s",
              "active_subscriptions": [
                "order_status_changes",
                "quality_violations",
                "equipment_alarms"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          javascript: `const ws = new WebSocket('wss://api.schlep-engine.com/api/v1/manufacturing/mes/realtime-monitoring/plant_001');

ws.onopen = function(event) {
    console.log('Connected to MES monitoring stream');
    ws.send(JSON.stringify({
        'auth_token': apiKey,
        'subscribe': ['production_status', 'quality_alerts']
    }));
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('MES Update:', data);
    
    if (data.type === 'quality_alert') {
        // Handle quality control alerts
        handleQualityAlert(data);
    } else if (data.type === 'production_status') {
        // Update production dashboard
        updateProductionStatus(data);
    }
};`,
          python: `import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    print(f"MES Update: {data}")
    
    if data.get('type') == 'quality_alert':
        handle_quality_alert(data)
    elif data.get('type') == 'production_status':
        update_production_dashboard(data)

def on_open(ws):
    auth_msg = {
        'auth_token': api_key,
        'subscribe': ['production_status', 'quality_alerts', 'resource_utilization']
    }
    ws.send(json.dumps(auth_msg))

ws = websocket.WebSocketApp(
    "wss://api.schlep-engine.com/api/v1/manufacturing/mes/realtime-monitoring/plant_001",
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/mes/compliance-report/{time_period}"
        title="Generate Compliance Report"
        description="Generate comprehensive compliance reports for quality standards, regulations, and audit requirements."
        parameters={[
          {
            name: "time_period",
            type: "string",
            required: true,
            description: "Reporting period (daily, weekly, monthly, quarterly)"
          },
          {
            name: "compliance_standards",
            type: "array",
            required: false,
            description: "Specific standards to include (ISO9001, ISO14001, FDA, etc.)"
          },
          {
            name: "format",
            type: "string",
            required: false,
            description: "Report format (json, pdf, excel)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Compliance report generated successfully',
            example: JSON.stringify({
              "report_id": "COMP_2024_001",
              "period": "monthly",
              "generated_at": "2024-01-31T23:59:59Z",
              "compliance_summary": {
                "overall_compliance_score": 0.96,
                "total_inspections": 1247,
                "passed_inspections": 1198,
                "failed_inspections": 49,
                "non_conformances": 23,
                "corrective_actions_pending": 5
              },
              "standard_compliance": [
                {
                  "standard": "ISO9001",
                  "compliance_percentage": 97.8,
                  "non_conformances": 15,
                  "status": "compliant"
                },
                {
                  "standard": "FDA_CFR_820",
                  "compliance_percentage": 94.2,
                  "non_conformances": 8,
                  "status": "minor_issues"
                }
              ],
              "trending_analysis": {
                "quality_trend": "improving",
                "defect_rate_change": -0.15,
                "compliance_score_change": 0.03
              },
              "recommendations": [
                "Focus on reducing setup-related defects in line 3",
                "Update operator training for new FDA requirements"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/mes/compliance-report/monthly?format=json" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/mes/compliance-report/monthly",
    headers={"Authorization": f"Bearer {api_key}"},
    params={"format": "json", "compliance_standards": ["ISO9001", "FDA_CFR_820"]}
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/mes/compliance-report/monthly?format=json', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const report = await response.json();`
        }}
      />
    </div>
  )
}