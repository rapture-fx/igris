import { EndpointCard } from '../../../components/ui/EndpointCard'

export default function ModelServingPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Advanced Model Serving API</h1>
        <p className="text-gray-600 text-lg">
          Production-ready model serving infrastructure with auto-scaling, A/B testing, and multi-framework support.
        </p>
      </div>

      <EndpointCard
        method="POST"
        endpoint="/api/v1/serving/serve"
        title="Deploy Model for Serving"
        description="Deploy a trained model to production with auto-scaling and monitoring capabilities."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the model to deploy"
          },
          {
            name: "deployment_config",
            type: "object",
            required: true,
            description: "Deployment configuration",
            properties: [
              { name: "instances", type: "number", description: "Initial number of instances" },
              { name: "auto_scaling", type: "boolean", description: "Enable auto-scaling" },
              { name: "max_instances", type: "number", description: "Maximum instances for scaling" }
            ]
          }
        ]}
        response={{
          "serving_id": "serve_abc123",
          "model_id": "model_xyz789",
          "status": "deploying",
          "endpoint_url": "https://api.schlep-engine.com/serving/serve_abc123/predict",
          "estimated_ready_time": "2024-01-15T10:05:00Z"
        }}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/serving/serve" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "model_xyz789",
    "deployment_config": {
      "instances": 2,
      "auto_scaling": true,
      "max_instances": 10
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/serving/serve",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "model_id": "model_xyz789",
        "deployment_config": {
            "instances": 2,
            "auto_scaling": True,
            "max_instances": 10
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/serving/serve', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model_id: 'model_xyz789',
    deployment_config: {
      instances: 2,
      auto_scaling: true,
      max_instances: 10
    }
  })
});
const data = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/serving/{model_id}/predict"
        title="Real-time Predictions"
        description="Make real-time predictions using a deployed model with sub-100ms latency."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the serving model"
          },
          {
            name: "data",
            type: "object",
            required: true,
            description: "Input data for prediction",
            properties: [
              { name: "features", type: "array", description: "Feature vector for prediction" },
              { name: "metadata", type: "object", description: "Optional prediction metadata" }
            ]
          }
        ]}
        response={{
          "prediction": [0.85, 0.15],
          "confidence": 0.92,
          "model_version": "v1.2.3",
          "processing_time_ms": 45,
          "prediction_id": "pred_abc123"
        }}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/serving/model_xyz789/predict" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "features": [1.2, 3.4, 5.6, 7.8],
      "metadata": {"user_id": "user_123"}
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/serving/model_xyz789/predict",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "data": {
            "features": [1.2, 3.4, 5.6, 7.8],
            "metadata": {"user_id": "user_123"}
        }
    }
)
prediction = response.json()`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/serving/model_xyz789/predict', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      features: [1.2, 3.4, 5.6, 7.8],
      metadata: {user_id: 'user_123'}
    }
  })
});
const prediction = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/serving/{model_id}/batch-predict"
        title="Batch Predictions"
        description="Process multiple predictions in a single batch for improved throughput."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the serving model"
          },
          {
            name: "batch_data",
            type: "array",
            required: true,
            description: "Array of input data for batch prediction"
          }
        ]}
        response={{
          "batch_id": "batch_abc123",
          "status": "processing",
          "predictions": [
            {"prediction": [0.85, 0.15], "confidence": 0.92},
            {"prediction": [0.23, 0.77], "confidence": 0.88}
          ],
          "processing_time_ms": 156
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/serving/{model_id}/status"
        title="Get Serving Status"
        description="Get the current status and health of a deployed model."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the serving model"
          }
        ]}
        response={{
          "model_id": "model_xyz789",
          "status": "running",
          "health": "healthy",
          "instances": 3,
          "requests_per_minute": 1250,
          "average_latency_ms": 65,
          "uptime_hours": 72.5
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/serving/{model_id}/scale"
        title="Manual Scaling"
        description="Manually scale the number of model serving instances."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the serving model"
          },
          {
            name: "instances",
            type: "number",
            required: true,
            description: "Target number of instances"
          }
        ]}
        response={{
          "model_id": "model_xyz789",
          "previous_instances": 3,
          "target_instances": 5,
          "scaling_status": "in_progress",
          "estimated_completion": "2024-01-15T10:05:00Z"
        }}
      />

      <EndpointCard
        method="GET"
        endpoint="/api/v1/serving/{model_id}/metrics"
        title="Performance Metrics"
        description="Get detailed performance metrics and monitoring data for a served model."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the serving model"
          },
          {
            name: "timeframe",
            type: "string",
            required: false,
            description: "Time range for metrics (1h, 24h, 7d, 30d)"
          }
        ]}
        response={{
          "model_id": "model_xyz789",
          "timeframe": "24h",
          "metrics": {
            "total_requests": 45280,
            "successful_requests": 44950,
            "error_rate": 0.007,
            "average_latency_ms": 67,
            "p95_latency_ms": 125,
            "p99_latency_ms": 245
          }
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/serving/{model_id}/canary"
        title="Canary Deployment"
        description="Deploy a new model version using canary deployment with traffic splitting."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the current serving model"
          },
          {
            name: "new_model_id",
            type: "string",
            required: true,
            description: "The ID of the new model version"
          },
          {
            name: "traffic_percentage",
            type: "number",
            required: true,
            description: "Percentage of traffic to route to new model (1-50)"
          }
        ]}
        response={{
          "canary_id": "canary_abc123",
          "current_model": "model_xyz789",
          "canary_model": "model_xyz790",
          "traffic_split": {
            "current": 80,
            "canary": 20
          },
          "status": "active"
        }}
      />

      <EndpointCard
        method="POST"
        endpoint="/api/v1/serving/{model_id}/rollback"
        title="Rollback Deployment"
        description="Rollback to the previous model version in case of issues."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "The ID of the serving model"
          },
          {
            name: "reason",
            type: "string",
            required: false,
            description: "Reason for rollback"
          }
        ]}
        response={{
          "model_id": "model_xyz789",
          "rollback_status": "in_progress",
          "previous_version": "v1.2.3",
          "target_version": "v1.2.2",
          "estimated_completion": "2024-01-15T10:02:00Z"
        }}
      />
    </div>
  )
}