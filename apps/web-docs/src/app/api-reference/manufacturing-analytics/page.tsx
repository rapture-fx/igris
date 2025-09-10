'use client'

import React from 'react'
import { EndpointCard } from '../../../components/ui/EndpointCard'

export default function ManufacturingAnalyticsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Manufacturing Analytics & SPC API</h1>
        <p className="text-gray-600 text-lg">
          Statistical Process Control (SPC) and advanced analytics for manufacturing quality monitoring, defect detection, and performance optimization.
        </p>
      </div>

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/analytics/spc-analysis"
        title="Statistical Process Control Analysis"
        description="Perform SPC analysis on manufacturing process data with control charts and capability studies."
        parameters={[
          {
            name: "process_id",
            type: "string",
            required: true,
            description: "Manufacturing process identifier"
          },
          {
            name: "measurement_data",
            type: "array",
            required: true,
            description: "Array of measurement values"
          },
          {
            name: "control_limits",
            type: "object",
            required: false,
            description: "Custom control limits (UCL, LCL)"
          },
          {
            name: "analysis_type",
            type: "string",
            required: false,
            description: "Type of SPC analysis (xbar_r, xbar_s, individuals)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'SPC analysis completed successfully',
            example: JSON.stringify({
              "process_id": "PROC_001",
              "analysis_type": "xbar_r",
              "control_chart": {
                "ucl": 25.6,
                "lcl": 24.2,
                "centerline": 24.9,
                "out_of_control_points": [15, 23]
              },
              "capability_study": {
                "cp": 1.33,
                "cpk": 1.25,
                "pp": 1.28,
                "ppk": 1.22
              },
              "recommendations": [
                "Investigate points 15 and 23 for special causes",
                "Process capability is acceptable (Cpk > 1.0)"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/analytics/spc-analysis" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "process_id": "PROC_001",
    "measurement_data": [24.5, 24.8, 25.1, 24.6, 24.9],
    "analysis_type": "xbar_r"
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/analytics/spc-analysis",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "process_id": "PROC_001",
        "measurement_data": [24.5, 24.8, 25.1, 24.6, 24.9],
        "analysis_type": "xbar_r"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/analytics/spc-analysis', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    process_id: 'PROC_001',
    measurement_data: [24.5, 24.8, 25.1, 24.6, 24.9],
    analysis_type: 'xbar_r'
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/analytics/defect-detection"
        title="Automated Defect Detection"
        description="AI-powered defect detection and classification for manufacturing products."
        parameters={[
          {
            name: "product_line",
            type: "string",
            required: true,
            description: "Product line identifier"
          },
          {
            name: "inspection_data",
            type: "object",
            required: true,
            description: "Inspection measurements and images"
          },
          {
            name: "detection_model",
            type: "string",
            required: false,
            description: "AI model to use for detection"
          },
          {
            name: "confidence_threshold",
            type: "number",
            required: false,
            description: "Minimum confidence for defect classification"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Defect detection completed successfully',
            example: JSON.stringify({
              "product_line": "LINE_A",
              "inspection_id": "INS_12345",
              "defects_detected": [
                {
                  "type": "surface_scratch",
                  "confidence": 0.92,
                  "location": {"x": 150, "y": 200},
                  "severity": "minor"
                },
                {
                  "type": "dimensional_variance",
                  "confidence": 0.87,
                  "measurement": "width_out_of_spec",
                  "severity": "major"
                }
              ],
              "overall_quality_score": 0.78,
              "pass_fail_status": "fail",
              "recommended_actions": [
                "Reject item due to dimensional variance",
                "Investigate tooling wear on Line A"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/analytics/defect-detection" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "product_line": "LINE_A",
    "inspection_data": {
      "dimensions": {"width": 24.8, "height": 12.1},
      "image_url": "https://storage.com/inspect_001.jpg"
    },
    "confidence_threshold": 0.85
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/analytics/defect-detection",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "product_line": "LINE_A",
        "inspection_data": {
            "dimensions": {"width": 24.8, "height": 12.1},
            "image_url": "https://storage.com/inspect_001.jpg"
        },
        "confidence_threshold": 0.85
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/analytics/defect-detection', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    product_line: 'LINE_A',
    inspection_data: {
      dimensions: {width: 24.8, height: 12.1},
      image_url: 'https://storage.com/inspect_001.jpg'
    },
    confidence_threshold: 0.85
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/analytics/oee-dashboard"
        title="Overall Equipment Effectiveness (OEE)"
        description="Real-time OEE calculation and dashboard data for manufacturing equipment."
        parameters={[
          {
            name: "equipment_id",
            type: "string",
            required: true,
            description: "Equipment identifier"
          },
          {
            name: "time_period",
            type: "string",
            required: false,
            description: "Time period for analysis (1h, 8h, 24h, 7d)"
          },
          {
            name: "include_breakdown",
            type: "boolean",
            required: false,
            description: "Include detailed breakdown of availability, performance, quality"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'OEE data retrieved successfully',
            example: JSON.stringify({
              "equipment_id": "MACHINE_001",
              "time_period": "24h",
              "oee_score": 0.78,
              "availability": 0.85,
              "performance": 0.92,
              "quality": 0.96,
              "breakdown": {
                "planned_production_time": 1440,
                "actual_runtime": 1224,
                "downtime_minutes": 216,
                "ideal_cycle_time": 60,
                "total_pieces": 1180,
                "good_pieces": 1133
              },
              "trends": [
                {"hour": "00:00", "oee": 0.82},
                {"hour": "01:00", "oee": 0.75}
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/analytics/oee-dashboard?equipment_id=MACHINE_001&time_period=24h" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/analytics/oee-dashboard",
    headers={"Authorization": f"Bearer {api_key}"},
    params={
        "equipment_id": "MACHINE_001",
        "time_period": "24h",
        "include_breakdown": True
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/analytics/oee-dashboard?equipment_id=MACHINE_001&time_period=24h', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const oeeData = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/manufacturing/analytics/root-cause-analysis"
        title="Root Cause Analysis"
        description="AI-powered root cause analysis for manufacturing defects and process variations."
        parameters={[
          {
            name: "incident_id",
            type: "string",
            required: true,
            description: "Manufacturing incident identifier"
          },
          {
            name: "incident_data",
            type: "object",
            required: true,
            description: "Incident details and context"
          },
          {
            name: "analysis_depth",
            type: "string",
            required: false,
            description: "Analysis depth (basic, detailed, comprehensive)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Root cause analysis completed',
            example: JSON.stringify({
              "incident_id": "INC_001",
              "analysis_timestamp": "2024-01-15T10:00:00Z",
              "root_causes": [
                {
                  "cause": "Tool wear exceeding threshold",
                  "probability": 0.85,
                  "supporting_evidence": [
                    "Dimensional drift pattern matches tool wear signature",
                    "Tool change overdue by 150 cycles"
                  ]
                },
                {
                  "cause": "Material property variation",
                  "probability": 0.23,
                  "supporting_evidence": [
                    "Batch material hardness 5% above specification"
                  ]
                }
              ],
              "recommended_actions": [
                "Immediate tool replacement required",
                "Implement predictive tool life monitoring",
                "Review material incoming inspection"
              ],
              "prevention_strategies": [
                "Reduce tool change interval by 10%",
                "Add real-time tool condition monitoring"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/manufacturing/analytics/root-cause-analysis" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "incident_id": "INC_001",
    "incident_data": {
      "defect_type": "dimensional_variance",
      "equipment": "MACHINE_001",
      "timestamp": "2024-01-15T09:30:00Z",
      "process_parameters": {
        "spindle_speed": 2400,
        "feed_rate": 800
      }
    },
    "analysis_depth": "detailed"
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/manufacturing/analytics/root-cause-analysis",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "incident_id": "INC_001",
        "incident_data": {
            "defect_type": "dimensional_variance",
            "equipment": "MACHINE_001",
            "timestamp": "2024-01-15T09:30:00Z",
            "process_parameters": {
                "spindle_speed": 2400,
                "feed_rate": 800
            }
        },
        "analysis_depth": "detailed"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/analytics/root-cause-analysis', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    incident_id: 'INC_001',
    incident_data: {
      defect_type: 'dimensional_variance',
      equipment: 'MACHINE_001',
      timestamp: '2024-01-15T09:30:00Z',
      process_parameters: {
        spindle_speed: 2400,
        feed_rate: 800
      }
    },
    analysis_depth: 'detailed'
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/manufacturing/analytics/performance-trends"
        title="Performance Trend Analysis"
        description="Analyze manufacturing performance trends over time with predictive insights."
        parameters={[
          {
            name: "production_line",
            type: "string",
            required: true,
            description: "Production line identifier"
          },
          {
            name: "metrics",
            type: "array",
            required: false,
            description: "Metrics to analyze (throughput, quality, efficiency)"
          },
          {
            name: "time_range",
            type: "string",
            required: false,
            description: "Analysis time range (1w, 1m, 3m, 6m)"
          },
          {
            name: "forecast_horizon",
            type: "string",
            required: false,
            description: "Forecast period (1w, 2w, 1m)"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Performance trends retrieved successfully',
            example: JSON.stringify({
              "production_line": "LINE_A",
              "analysis_period": "1m",
              "trends": {
                "throughput": {
                  "current": 1250,
                  "trend": "increasing",
                  "change_rate": 0.05,
                  "forecast": [1280, 1310, 1340]
                },
                "quality": {
                  "current": 0.96,
                  "trend": "stable",
                  "change_rate": 0.001,
                  "forecast": [0.96, 0.96, 0.97]
                },
                "efficiency": {
                  "current": 0.82,
                  "trend": "declining",
                  "change_rate": -0.02,
                  "forecast": [0.81, 0.80, 0.79]
                }
              },
              "insights": [
                "Throughput improving due to recent process optimization",
                "Efficiency declining - investigate equipment maintenance",
                "Quality remains stable within control limits"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/manufacturing/analytics/performance-trends?production_line=LINE_A&time_range=1m" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/manufacturing/analytics/performance-trends",
    headers={"Authorization": f"Bearer {api_key}"},
    params={
        "production_line": "LINE_A",
        "metrics": ["throughput", "quality", "efficiency"],
        "time_range": "1m",
        "forecast_horizon": "2w"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/manufacturing/analytics/performance-trends?production_line=LINE_A&time_range=1m', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const trends = await response.json();`
        }}
      />
    </div>
  )
}