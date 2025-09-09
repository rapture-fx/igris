import { EndpointCard } from '../../components/ui/EndpointCard'

export default function AutomatedRetrainingPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Automated Retraining API</h1>
        <p className="text-gray-600 text-lg">
          Continuous learning infrastructure with drift detection, automated retraining pipelines, and model maintenance.
        </p>
      </div>

      <EndpointCard
        method="POST"
        endpoint="/api/v1/retraining/pipelines/create"
        title="Create Retraining Pipeline"
        description="Create an automated retraining pipeline with configurable triggers and policies."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The model ID to create retraining pipeline for"
          },
          {
            name: "pipeline_config",
            type: "object",
            required: true,
            description: "Pipeline configuration",
            properties: [
              { name: "triggers", type: "array", description: "Retraining trigger conditions" },
              { name: "schedule", type: "string", description: "Cron-style schedule expression" },
              { name: "data_source", type: "object", description: "Training data source configuration" },
              { name: "quality_gates", type: "object", description: "Quality gate thresholds" }
            ]
          }
        ]}
        response={{
          "pipeline_id": "pipeline_abc123",
          "model_id": "model_xyz789",
          "status": "active",
          "triggers": [
            {"type": "performance_degradation", "threshold": 0.05},
            {"type": "data_drift", "threshold": 0.1},
            {"type": "schedule", "expression": "0 2 * * 0"}
          ],
          "created_at": "2024-01-15T10:00:00Z"
        }}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/retraining/pipelines/create" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "model_xyz789",
    "pipeline_config": {
      "triggers": [
        {"type": "performance_degradation", "threshold": 0.05},
        {"type": "data_drift", "threshold": 0.1}
      ],
      "schedule": "0 2 * * 0",
      "data_source": {
        "type": "dataset",
        "dataset_id": "ds_abc123"
      },
      "quality_gates": {
        "min_accuracy": 0.85,
        "max_training_time": 3600
      }
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/retraining/pipelines/create",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "model_id": "model_xyz789",
        "pipeline_config": {
            "triggers": [
                {"type": "performance_degradation", "threshold": 0.05},
                {"type": "data_drift", "threshold": 0.1}
            ],
            "schedule": "0 2 * * 0",
            "data_source": {
                "type": "dataset",
                "dataset_id": "ds_abc123"
            },
            "quality_gates": {
                "min_accuracy": 0.85,
                "max_training_time": 3600
            }
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/retraining/pipelines/create', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model_id: 'model_xyz789',
    pipeline_config: {
      triggers: [
        {type: 'performance_degradation', threshold: 0.05},
        {type: 'data_drift', threshold: 0.1}
      ],
      schedule: '0 2 * * 0',
      data_source: {
        type: 'dataset',
        dataset_id: 'ds_abc123'
      },
      quality_gates: {
        min_accuracy: 0.85,
        max_training_time: 3600
      }
    }
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/retraining/pipelines/{id}/trigger"
        title="Trigger Manual Retraining"
        description="Manually trigger a retraining job for immediate model updates."
        parameters={[
          {
            name: "id",
            type: "string",
            required: true,
            description: "Pipeline ID"
          },
          {
            name: "reason",
            type: "string",
            required: false,
            description: "Reason for manual trigger"
          },
          {
            name: "override_config",
            type: "object",
            required: false,
            description: "Override pipeline configuration for this run"
          }
        ]}
        response={{
          "job_id": "job_abc123",
          "pipeline_id": "pipeline_abc123",
          "status": "queued",
          "trigger_reason": "manual_trigger",
          "estimated_start_time": "2024-01-15T10:05:00Z",
          "estimated_completion": "2024-01-15T12:05:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/retraining/pipelines/{id}/status"
        title="Get Pipeline Status"
        description="Get the current status and execution history of a retraining pipeline."
        parameters={[
          {
            name: "id",
            type: "string",
            required: true,
            description: "Pipeline ID"
          }
        ]}
        response={{
          "pipeline_id": "pipeline_abc123",
          "model_id": "model_xyz789",
          "status": "active",
          "last_execution": {
            "job_id": "job_def456",
            "status": "completed",
            "started_at": "2024-01-14T02:00:00Z",
            "completed_at": "2024-01-14T04:15:00Z",
            "metrics": {
              "accuracy_improvement": 0.03,
              "training_time_minutes": 135
            }
          },
          "next_scheduled_run": "2024-01-21T02:00:00Z",
          "total_executions": 12,
          "success_rate": 0.92
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/retraining/drift-detection/configure"
        title="Configure Drift Detection"
        description="Configure data and concept drift detection for automated retraining triggers."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model ID to configure drift detection for"
          },
          {
            name: "drift_config",
            type: "object",
            required: true,
            description: "Drift detection configuration",
            properties: [
              { name: "data_drift", type: "object", description: "Data drift detection settings" },
              { name: "concept_drift", type: "object", description: "Concept drift detection settings" },
              { name: "monitoring_frequency", type: "string", description: "How often to check for drift" }
            ]
          }
        ]}
        response={{
          "drift_detector_id": "drift_abc123",
          "model_id": "model_xyz789",
          "config": {
            "data_drift": {
              "method": "kolmogorov_smirnov",
              "threshold": 0.05,
              "features_monitored": ["feature1", "feature2", "feature3"]
            },
            "concept_drift": {
              "method": "page_hinkley",
              "threshold": 0.1,
              "detection_delay": 100
            },
            "monitoring_frequency": "hourly"
          },
          "status": "active",
          "created_at": "2024-01-15T10:00:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/retraining/drift-reports/{model_id}"
        title="Get Drift Reports"
        description="Get comprehensive drift detection reports and analysis."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model ID"
          },
          {
            name: "timeframe",
            type: "string",
            required: false,
            description: "Time range for drift analysis (24h, 7d, 30d)"
          }
        ]}
        response={{
          "model_id": "model_xyz789",
          "timeframe": "7d",
          "drift_summary": {
            "data_drift_detected": true,
            "concept_drift_detected": false,
            "overall_drift_score": 0.23,
            "recommendation": "Consider retraining due to significant data drift"
          },
          "feature_drift_analysis": [
            {
              "feature": "age",
              "drift_score": 0.45,
              "drift_detected": true,
              "p_value": 0.002
            },
            {
              "feature": "income",
              "drift_score": 0.12,
              "drift_detected": false,
              "p_value": 0.156
            }
          ],
          "performance_impact": {
            "accuracy_decline": 0.08,
            "predicted_performance": 0.79
          },
          "generated_at": "2024-01-15T10:00:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/retraining/jobs"
        title="List Retraining Jobs"
        description="Get a list of retraining jobs with filtering and pagination."
        parameters={[
          {
            name: "status",
            type: "string",
            required: false,
            description: "Filter by job status (queued, running, completed, failed)"
          },
          {
            name: "model_id",
            type: "string",
            required: false,
            description: "Filter by model ID"
          },
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Maximum number of results (default: 50)"
          },
          {
            name: "offset",
            type: "number",
            required: false,
            description: "Number of results to skip for pagination"
          }
        ]}
        response={{
          "total_jobs": 156,
          "jobs": [
            {
              "job_id": "job_abc123",
              "pipeline_id": "pipeline_def456",
              "model_id": "model_xyz789",
              "status": "completed",
              "started_at": "2024-01-14T02:00:00Z",
              "completed_at": "2024-01-14T04:15:00Z",
              "trigger_reason": "scheduled",
              "performance_improvement": 0.03
            }
          ],
          "pagination": {
            "limit": 50,
            "offset": 0,
            "has_next": true
          }
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/retraining/feedback/submit"
        title="Submit Model Feedback"
        description="Submit feedback about model performance to improve future retraining."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model ID"
          },
          {
            name: "feedback_data",
            type: "object",
            required: true,
            description: "Feedback information",
            properties: [
              { name: "prediction_id", type: "string", description: "ID of the prediction being feedback on" },
              { name: "actual_outcome", type: "string", description: "Actual outcome or correct label" },
              { name: "confidence", type: "number", description: "Confidence in the feedback (0-1)" },
              { name: "feedback_type", type: "string", description: "Type of feedback (correction, validation, etc.)" }
            ]
          }
        ]}
        response={{
          "feedback_id": "feedback_abc123",
          "model_id": "model_xyz789",
          "status": "accepted",
          "impact_assessment": {
            "affects_retraining": true,
            "priority": "medium",
            "estimated_improvement": 0.02
          },
          "submitted_at": "2024-01-15T10:00:00Z"
        }}
      />
    </div>
  )
}