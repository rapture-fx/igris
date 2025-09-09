import { EndpointCard } from '@/components/ui/EndpointCard'

export default function MLOpsApiPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">MLOps Platform API</h1>
        <p className="text-xl text-gray-600">
          Comprehensive machine learning operations platform for model lifecycle management, experiment tracking, deployment, and monitoring.
        </p>
      </div>

      <div className="space-y-8">
        <EndpointCard
          method="POST"
          path="/api/v1/mlops/models/register"
          title="Register New Model"
          description="Register a new machine learning model in the MLOps platform. Supports multiple frameworks including TensorFlow, PyTorch, scikit-learn, and custom models."
          parameters={[
            {
              name: "name",
              type: "string",
              required: true,
              description: "Unique name for the model",
              example: "customer-churn-predictor"
            },
            {
              name: "framework",
              type: "string",
              required: true,
              description: "ML framework used: tensorflow, pytorch, scikit-learn, xgboost, custom",
              example: "pytorch"
            },
            {
              name: "version",
              type: "string",
              required: true,
              description: "Model version following semantic versioning",
              example: "1.0.0"
            },
            {
              name: "model_file",
              type: "file",
              required: true,
              description: "Serialized model file (.pkl, .pt, .h5, .pb)",
              example: "model.pkl"
            },
            {
              name: "metadata",
              type: "object",
              required: false,
              description: "Additional model metadata including metrics, parameters, and tags",
              example: '{"accuracy": 0.95, "f1_score": 0.92, "tags": ["production-ready"]}'
            },
            {
              name: "requirements",
              type: "array",
              required: false,
              description: "Python dependencies required for the model",
              example: '["numpy>=1.20.0", "pandas>=1.3.0", "scikit-learn>=1.0.0"]'
            }
          ]}
          responses={[
            {
              status: 201,
              description: "Model registered successfully",
              example: `{
  "success": true,
  "data": {
    "model_id": "model_abc123def456",
    "name": "customer-churn-predictor",
    "framework": "pytorch",
    "version": "1.0.0",
    "status": "registered",
    "created_at": "2024-01-15T10:30:00Z",
    "size_bytes": 15728640,
    "model_uri": "s3://models/customer-churn-predictor/1.0.0/model.pkl",
    "metadata": {
      "accuracy": 0.95,
      "f1_score": 0.92,
      "tags": ["production-ready"]
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_model_123"
  }
}`
            },
            {
              status: 400,
              description: "Invalid model format or metadata",
              example: `{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Unsupported model framework",
    "code": "invalid_framework",
    "details": {
      "provided": "unknown_framework",
      "supported": ["tensorflow", "pytorch", "scikit-learn", "xgboost", "custom"]
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/mlops/models/register \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: multipart/form-data" \\
  -F "name=customer-churn-predictor" \\
  -F "framework=pytorch" \\
  -F "version=1.0.0" \\
  -F "model_file=@model.pkl" \\
  -F 'metadata={"accuracy": 0.95, "f1_score": 0.92}' \\
  -F 'requirements=["numpy>=1.20.0", "pandas>=1.3.0"]'`,
            python: `import requests

# Register model
with open('model.pkl', 'rb') as model_file:
    response = requests.post(
        'https://api.schlep-engine.com/api/v1/mlops/models/register',
        headers={
            'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
        },
        files={'model_file': model_file},
        data={
            'name': 'customer-churn-predictor',
            'framework': 'pytorch',
            'version': '1.0.0',
            'metadata': '{"accuracy": 0.95, "f1_score": 0.92}',
            'requirements': '["numpy>=1.20.0", "pandas>=1.3.0"]'
        }
    )

if response.status_code == 201:
    model_data = response.json()
    print(f"Model registered: {model_data['data']['model_id']}")
else:
    print(f"Registration failed: {response.text}")`,
            javascript: `const formData = new FormData();
formData.append('name', 'customer-churn-predictor');
formData.append('framework', 'pytorch');
formData.append('version', '1.0.0');
formData.append('model_file', modelFile);
formData.append('metadata', JSON.stringify({
  "accuracy": 0.95,
  "f1_score": 0.92
}));
formData.append('requirements', JSON.stringify([
  "numpy>=1.20.0", 
  "pandas>=1.3.0"
]));

fetch('https://api.schlep-engine.com/api/v1/mlops/models/register', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  },
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Model registered:', data.data.model_id);
  } else {
    console.error('Registration failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="POST"
          path="/api/v1/mlops/experiments/create"
          title="Create ML Experiment"
          description="Create a new machine learning experiment with experiment tracking capabilities. Supports hyperparameter logging, metric tracking, and artifact storage."
          parameters={[
            {
              name: "name",
              type: "string",
              required: true,
              description: "Descriptive name for the experiment",
              example: "churn-prediction-hyperopt"
            },
            {
              name: "project",
              type: "string",
              required: true,
              description: "Project identifier to group related experiments",
              example: "customer-analytics"
            },
            {
              name: "tags",
              type: "array",
              required: false,
              description: "Tags to categorize and filter experiments",
              example: '["hyperparameter-tuning", "pytorch", "production"]'
            },
            {
              name: "parameters",
              type: "object",
              required: false,
              description: "Initial experiment parameters and hyperparameters",
              example: '{"learning_rate": 0.001, "batch_size": 32, "epochs": 100}'
            },
            {
              name: "description",
              type: "string",
              required: false,
              description: "Detailed description of the experiment objectives",
              example: "Hyperparameter optimization for customer churn prediction model"
            }
          ]}
          responses={[
            {
              status: 201,
              description: "Experiment created successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_789xyz012",
    "name": "churn-prediction-hyperopt",
    "project": "customer-analytics",
    "status": "created",
    "created_at": "2024-01-15T10:30:00Z",
    "tags": ["hyperparameter-tuning", "pytorch", "production"],
    "parameters": {
      "learning_rate": 0.001,
      "batch_size": 32,
      "epochs": 100
    },
    "tracking_uri": "https://tracking.schlep-engine.com/exp_789xyz012"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/mlops/experiments/create \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "churn-prediction-hyperopt",
    "project": "customer-analytics",
    "tags": ["hyperparameter-tuning", "pytorch"],
    "parameters": {
      "learning_rate": 0.001,
      "batch_size": 32,
      "epochs": 100
    },
    "description": "Hyperparameter optimization for customer churn prediction"
  }'`,
            python: `import requests

experiment_data = {
    "name": "churn-prediction-hyperopt",
    "project": "customer-analytics",
    "tags": ["hyperparameter-tuning", "pytorch"],
    "parameters": {
        "learning_rate": 0.001,
        "batch_size": 32,
        "epochs": 100
    },
    "description": "Hyperparameter optimization for customer churn prediction"
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/mlops/experiments/create',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=experiment_data
)

if response.status_code == 201:
    experiment = response.json()['data']
    print(f"Experiment created: {experiment['experiment_id']}")
    print(f"Tracking URI: {experiment['tracking_uri']}")
else:
    print(f"Creation failed: {response.text}")`,
            javascript: `const experimentData = {
  name: "churn-prediction-hyperopt",
  project: "customer-analytics",
  tags: ["hyperparameter-tuning", "pytorch"],
  parameters: {
    learning_rate: 0.001,
    batch_size: 32,
    epochs: 100
  },
  description: "Hyperparameter optimization for customer churn prediction"
};

fetch('https://api.schlep-engine.com/api/v1/mlops/experiments/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(experimentData)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Experiment created:', data.data.experiment_id);
    console.log('Tracking URI:', data.data.tracking_uri);
  } else {
    console.error('Creation failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/mlops/experiments/{id}/status"
          title="Get Experiment Status"
          description="Retrieve detailed status information for a specific experiment including current metrics, parameters, and execution state."
          parameters={[
            {
              name: "experiment_id",
              type: "string",
              required: true,
              description: "The unique identifier of the experiment",
              example: "exp_789xyz012"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Experiment status retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_789xyz012",
    "name": "churn-prediction-hyperopt",
    "project": "customer-analytics",
    "status": "running",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:45:00Z",
    "duration_seconds": 4500,
    "current_metrics": {
      "accuracy": 0.94,
      "loss": 0.15,
      "epoch": 85
    },
    "parameters": {
      "learning_rate": 0.001,
      "batch_size": 32,
      "epochs": 100
    },
    "artifacts": [
      {
        "name": "model_checkpoint_epoch_85.pt",
        "type": "model_checkpoint",
        "size_bytes": 15728640,
        "created_at": "2024-01-15T11:40:00Z"
      }
    ],
    "tags": ["hyperparameter-tuning", "pytorch", "production"]
  }
}`
            },
            {
              status: 404,
              description: "Experiment not found",
              example: `{
  "success": false,
  "error": {
    "type": "not_found",
    "message": "Experiment not found",
    "code": "experiment_not_found"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlep-engine.com/api/v1/mlops/experiments/exp_789xyz012/status \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/mlops/experiments/exp_789xyz012/status',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    experiment = response.json()['data']
    print(f"Experiment: {experiment['name']}")
    print(f"Status: {experiment['status']}")
    print(f"Current Metrics: {experiment['current_metrics']}")
    print(f"Duration: {experiment['duration_seconds']} seconds")
else:
    print(f"Error: {response.text}")`,
            javascript: `fetch('https://api.schlep-engine.com/api/v1/mlops/experiments/exp_789xyz012/status', {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const experiment = data.data;
    console.log(\`Experiment: \${experiment.name}\`);
    console.log(\`Status: \${experiment.status}\`);
    console.log(\`Current Metrics:\`, experiment.current_metrics);
    console.log(\`Duration: \${experiment.duration_seconds} seconds\`);
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="POST"
          path="/api/v1/mlops/models/deploy"
          title="Deploy Model to Production"
          description="Deploy a registered model to production with configurable scaling, routing, and monitoring options. Supports blue-green and canary deployment strategies."
          parameters={[
            {
              name: "model_id",
              type: "string",
              required: true,
              description: "The unique identifier of the registered model",
              example: "model_abc123def456"
            },
            {
              name: "deployment_name",
              type: "string",
              required: true,
              description: "Name for the deployment endpoint",
              example: "churn-predictor-prod"
            },
            {
              name: "strategy",
              type: "string",
              required: false,
              description: "Deployment strategy: blue_green, canary, rolling, direct",
              example: "blue_green"
            },
            {
              name: "scaling_config",
              type: "object",
              required: false,
              description: "Auto-scaling configuration for the deployment",
              example: '{"min_replicas": 2, "max_replicas": 10, "cpu_threshold": 70, "memory_threshold": 80}'
            },
            {
              name: "traffic_percentage",
              type: "number",
              required: false,
              description: "Initial traffic percentage for canary deployments (0-100)",
              example: "10"
            },
            {
              name: "environment_variables",
              type: "object",
              required: false,
              description: "Environment variables for the model container",
              example: '{"MODEL_CACHE_SIZE": "1000", "BATCH_SIZE": "32"}'
            }
          ]}
          responses={[
            {
              status: 201,
              description: "Model deployed successfully",
              example: `{
  "success": true,
  "data": {
    "deployment_id": "deploy_xyz789abc",
    "deployment_name": "churn-predictor-prod",
    "model_id": "model_abc123def456",
    "status": "deploying",
    "strategy": "blue_green",
    "endpoint_url": "https://api.schlep-engine.com/predict/churn-predictor-prod",
    "created_at": "2024-01-15T12:00:00Z",
    "estimated_ready_at": "2024-01-15T12:05:00Z",
    "scaling_config": {
      "min_replicas": 2,
      "max_replicas": 10,
      "cpu_threshold": 70,
      "memory_threshold": 80
    },
    "monitoring": {
      "health_check_url": "https://api.schlep-engine.com/health/deploy_xyz789abc",
      "metrics_url": "https://monitoring.schlep-engine.com/deploy_xyz789abc"
    }
  }
}`
            },
            {
              status: 400,
              description: "Invalid deployment configuration",
              example: `{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Invalid scaling configuration",
    "code": "invalid_scaling_config",
    "details": {
      "min_replicas": "Must be >= 1",
      "max_replicas": "Must be >= min_replicas"
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/mlops/models/deploy \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "model_abc123def456",
    "deployment_name": "churn-predictor-prod",
    "strategy": "blue_green",
    "scaling_config": {
      "min_replicas": 2,
      "max_replicas": 10,
      "cpu_threshold": 70,
      "memory_threshold": 80
    },
    "environment_variables": {
      "MODEL_CACHE_SIZE": "1000",
      "BATCH_SIZE": "32"
    }
  }'`,
            python: `import requests

deployment_config = {
    "model_id": "model_abc123def456",
    "deployment_name": "churn-predictor-prod",
    "strategy": "blue_green",
    "scaling_config": {
        "min_replicas": 2,
        "max_replicas": 10,
        "cpu_threshold": 70,
        "memory_threshold": 80
    },
    "environment_variables": {
        "MODEL_CACHE_SIZE": "1000",
        "BATCH_SIZE": "32"
    }
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/mlops/models/deploy',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=deployment_config
)

if response.status_code == 201:
    deployment = response.json()['data']
    print(f"Deployment created: {deployment['deployment_id']}")
    print(f"Endpoint URL: {deployment['endpoint_url']}")
    print(f"Status: {deployment['status']}")
else:
    print(f"Deployment failed: {response.text}")`,
            javascript: `const deploymentConfig = {
  model_id: "model_abc123def456",
  deployment_name: "churn-predictor-prod",
  strategy: "blue_green",
  scaling_config: {
    min_replicas: 2,
    max_replicas: 10,
    cpu_threshold: 70,
    memory_threshold: 80
  },
  environment_variables: {
    "MODEL_CACHE_SIZE": "1000",
    "BATCH_SIZE": "32"
  }
};

fetch('https://api.schlep-engine.com/api/v1/mlops/models/deploy', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(deploymentConfig)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Deployment created:', data.data.deployment_id);
    console.log('Endpoint URL:', data.data.endpoint_url);
    console.log('Status:', data.data.status);
  } else {
    console.error('Deployment failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/models/{id}/performance"
          title="Get Model Performance Metrics"
          description="Retrieve comprehensive performance metrics for a deployed model including accuracy, latency, throughput, and business metrics."
          parameters={[
            {
              name: "model_id",
              type: "string",
              required: true,
              description: "The unique identifier of the model",
              example: "model_abc123def456"
            },
            {
              name: "time_range",
              type: "string",
              required: false,
              description: "Time range for metrics: 1h, 24h, 7d, 30d",
              example: "24h"
            },
            {
              name: "metrics",
              type: "array",
              required: false,
              description: "Specific metrics to retrieve",
              example: '["accuracy", "latency", "throughput", "error_rate"]'
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Performance metrics retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "model_id": "model_abc123def456",
    "time_range": "24h",
    "performance_metrics": {
      "accuracy": {
        "current": 0.94,
        "baseline": 0.95,
        "trend": "declining",
        "change_percentage": -1.05
      },
      "latency": {
        "p50_ms": 45,
        "p90_ms": 120,
        "p99_ms": 250,
        "average_ms": 65
      },
      "throughput": {
        "requests_per_second": 1250,
        "total_requests": 108000,
        "successful_requests": 107460
      },
      "error_rate": {
        "percentage": 0.5,
        "total_errors": 540,
        "error_types": {
          "timeout": 320,
          "validation": 180,
          "server_error": 40
        }
      }
    },
    "drift_detection": {
      "data_drift_score": 0.15,
      "model_drift_score": 0.08,
      "drift_status": "stable",
      "last_checked": "2024-01-15T12:00:00Z"
    },
    "generated_at": "2024-01-15T12:30:00Z"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlep-engine.com/api/v1/models/model_abc123def456/performance?time_range=24h&metrics=accuracy,latency,throughput" \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/models/model_abc123def456/performance',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'time_range': '24h',
        'metrics': ['accuracy', 'latency', 'throughput', 'error_rate']
    }
)

if response.status_code == 200:
    metrics = response.json()['data']
    print(f"Model Performance (24h):")
    print(f"Accuracy: {metrics['performance_metrics']['accuracy']['current']}")
    print(f"Average Latency: {metrics['performance_metrics']['latency']['average_ms']}ms")
    print(f"Throughput: {metrics['performance_metrics']['throughput']['requests_per_second']} RPS")
    print(f"Error Rate: {metrics['performance_metrics']['error_rate']['percentage']}%")
else:
    print(f"Error: {response.text}")`,
            javascript: `const params = new URLSearchParams({
  time_range: '24h',
  metrics: ['accuracy', 'latency', 'throughput', 'error_rate'].join(',')
});

fetch(\`https://api.schlep-engine.com/api/v1/models/model_abc123def456/performance?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const metrics = data.data.performance_metrics;
    console.log('Model Performance (24h):');
    console.log(\`Accuracy: \${metrics.accuracy.current}\`);
    console.log(\`Average Latency: \${metrics.latency.average_ms}ms\`);
    console.log(\`Throughput: \${metrics.throughput.requests_per_second} RPS\`);
    console.log(\`Error Rate: \${metrics.error_rate.percentage}%\`);
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="POST"
          path="/api/v1/models/{id}/ab-test"
          title="Start A/B Test"
          description="Initiate an A/B test between two model versions to compare performance and determine the better performing model for production traffic."
          parameters={[
            {
              name: "model_id",
              type: "string",
              required: true,
              description: "The unique identifier of the current production model",
              example: "model_abc123def456"
            },
            {
              name: "challenger_model_id",
              type: "string",
              required: true,
              description: "The unique identifier of the challenger model to test",
              example: "model_def456ghi789"
            },
            {
              name: "test_name",
              type: "string",
              required: true,
              description: "Descriptive name for the A/B test",
              example: "churn-model-v2-test"
            },
            {
              name: "traffic_split",
              type: "object",
              required: true,
              description: "Traffic allocation percentages for control and treatment",
              example: '{"control": 70, "treatment": 30}'
            },
            {
              name: "duration_days",
              type: "number",
              required: false,
              description: "Duration of the test in days (default: 14)",
              example: "14"
            },
            {
              name: "success_metrics",
              type: "array",
              required: true,
              description: "Metrics to evaluate for determining the winner",
              example: '["accuracy", "precision", "recall", "business_impact"]'
            },
            {
              name: "significance_level",
              type: "number",
              required: false,
              description: "Statistical significance level (default: 0.05)",
              example: "0.05"
            }
          ]}
          responses={[
            {
              status: 201,
              description: "A/B test started successfully",
              example: `{
  "success": true,
  "data": {
    "ab_test_id": "abtest_uvw012xyz",
    "test_name": "churn-model-v2-test",
    "status": "active",
    "control_model_id": "model_abc123def456",
    "treatment_model_id": "model_def456ghi789",
    "traffic_split": {
      "control": 70,
      "treatment": 30
    },
    "duration_days": 14,
    "start_date": "2024-01-15T12:30:00Z",
    "estimated_end_date": "2024-01-29T12:30:00Z",
    "success_metrics": ["accuracy", "precision", "recall", "business_impact"],
    "significance_level": 0.05,
    "current_stats": {
      "total_requests": 0,
      "control_requests": 0,
      "treatment_requests": 0
    },
    "dashboard_url": "https://dashboard.schlep-engine.com/ab-tests/abtest_uvw012xyz"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/models/model_abc123def456/ab-test \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "challenger_model_id": "model_def456ghi789",
    "test_name": "churn-model-v2-test",
    "traffic_split": {
      "control": 70,
      "treatment": 30
    },
    "duration_days": 14,
    "success_metrics": ["accuracy", "precision", "recall", "business_impact"],
    "significance_level": 0.05
  }'`,
            python: `import requests

ab_test_config = {
    "challenger_model_id": "model_def456ghi789",
    "test_name": "churn-model-v2-test",
    "traffic_split": {
        "control": 70,
        "treatment": 30
    },
    "duration_days": 14,
    "success_metrics": ["accuracy", "precision", "recall", "business_impact"],
    "significance_level": 0.05
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/models/model_abc123def456/ab-test',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=ab_test_config
)

if response.status_code == 201:
    ab_test = response.json()['data']
    print(f"A/B Test started: {ab_test['ab_test_id']}")
    print(f"Dashboard: {ab_test['dashboard_url']}")
    print(f"Duration: {ab_test['duration_days']} days")
else:
    print(f"A/B Test creation failed: {response.text}")`,
            javascript: `const abTestConfig = {
  challenger_model_id: "model_def456ghi789",
  test_name: "churn-model-v2-test",
  traffic_split: {
    control: 70,
    treatment: 30
  },
  duration_days: 14,
  success_metrics: ["accuracy", "precision", "recall", "business_impact"],
  significance_level: 0.05
};

fetch('https://api.schlep-engine.com/api/v1/models/model_abc123def456/ab-test', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(abTestConfig)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('A/B Test started:', data.data.ab_test_id);
    console.log('Dashboard:', data.data.dashboard_url);
    console.log('Duration:', data.data.duration_days, 'days');
  } else {
    console.error('A/B Test creation failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/mlops/models"
          title="List Models with Filtering"
          description="Retrieve a paginated list of registered models with advanced filtering, sorting, and search capabilities."
          parameters={[
            {
              name: "limit",
              type: "integer",
              required: false,
              description: "Maximum number of models to return (default: 50, max: 100)",
              example: "20"
            },
            {
              name: "offset",
              type: "integer",
              required: false,
              description: "Number of models to skip for pagination",
              example: "0"
            },
            {
              name: "framework",
              type: "string",
              required: false,
              description: "Filter by ML framework",
              example: "pytorch"
            },
            {
              name: "status",
              type: "string",
              required: false,
              description: "Filter by model status: registered, deployed, archived, failed",
              example: "deployed"
            },
            {
              name: "tags",
              type: "string",
              required: false,
              description: "Filter by tags (comma-separated)",
              example: "production,pytorch"
            },
            {
              name: "search",
              type: "string",
              required: false,
              description: "Search in model names and descriptions",
              example: "churn"
            },
            {
              name: "sort_by",
              type: "string",
              required: false,
              description: "Sort field: name, created_at, version, accuracy",
              example: "created_at"
            },
            {
              name: "sort_order",
              type: "string",
              required: false,
              description: "Sort order: asc, desc",
              example: "desc"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Models list retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "models": [
      {
        "model_id": "model_abc123def456",
        "name": "customer-churn-predictor",
        "framework": "pytorch",
        "version": "2.1.0",
        "status": "deployed",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T12:00:00Z",
        "tags": ["production", "pytorch", "customer-analytics"],
        "metadata": {
          "accuracy": 0.95,
          "f1_score": 0.92,
          "model_size_mb": 15.2
        },
        "deployment_info": {
          "deployment_id": "deploy_xyz789abc",
          "endpoint_url": "https://api.schlep-engine.com/predict/churn-predictor-prod",
          "status": "healthy"
        }
      },
      {
        "model_id": "model_def456ghi789",
        "name": "recommendation-engine",
        "framework": "tensorflow",
        "version": "1.0.0",
        "status": "registered",
        "created_at": "2024-01-14T15:20:00Z",
        "updated_at": "2024-01-14T15:20:00Z",
        "tags": ["staging", "tensorflow", "recommendations"],
        "metadata": {
          "map_at_10": 0.85,
          "ndcg": 0.88,
          "model_size_mb": 245.7
        }
      }
    ],
    "pagination": {
      "total": 47,
      "limit": 20,
      "offset": 0,
      "has_more": true
    },
    "filters_applied": {
      "framework": null,
      "status": null,
      "tags": null,
      "search": null
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlep-engine.com/api/v1/mlops/models?limit=20&status=deployed&framework=pytorch&sort_by=created_at&sort_order=desc" \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/mlops/models',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'limit': 20,
        'status': 'deployed',
        'framework': 'pytorch',
        'tags': 'production',
        'sort_by': 'created_at',
        'sort_order': 'desc'
    }
)

if response.status_code == 200:
    data = response.json()['data']
    models = data['models']
    print(f"Found {data['pagination']['total']} models")
    
    for model in models:
        print(f"- {model['name']} v{model['version']} ({model['framework']})")
        print(f"  Status: {model['status']}")
        if 'deployment_info' in model:
            print(f"  Endpoint: {model['deployment_info']['endpoint_url']}")
        print()
else:
    print(f"Error: {response.text}")`,
            javascript: `const params = new URLSearchParams({
  limit: '20',
  status: 'deployed',
  framework: 'pytorch',
  tags: 'production',
  sort_by: 'created_at',
  sort_order: 'desc'
});

fetch(\`https://api.schlep-engine.com/api/v1/mlops/models?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const { models, pagination } = data.data;
    console.log(\`Found \${pagination.total} models\`);
    
    models.forEach(model => {
      console.log(\`- \${model.name} v\${model.version} (\${model.framework})\`);
      console.log(\`  Status: \${model.status}\`);
      if (model.deployment_info) {
        console.log(\`  Endpoint: \${model.deployment_info.endpoint_url}\`);
      }
      console.log('');
    });
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/mlops/models/{id}"
          title="Get Model Details"
          description="Retrieve comprehensive details for a specific registered model including metadata, deployment status, performance metrics, and version history."
          parameters={[
            {
              name: "model_id",
              type: "string",
              required: true,
              description: "The unique identifier of the model",
              example: "model_abc123def456"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Model details retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "model_id": "model_abc123def456",
    "name": "customer-churn-predictor",
    "framework": "pytorch",
    "version": "2.1.0",
    "status": "deployed",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T12:00:00Z",
    "created_by": "data-science-team@company.com",
    "description": "Advanced customer churn prediction model using deep neural networks",
    "tags": ["production", "pytorch", "customer-analytics"],
    "model_info": {
      "size_bytes": 15728640,
      "size_mb": 15.2,
      "model_uri": "s3://models/customer-churn-predictor/2.1.0/model.pkl",
      "checksum": "sha256:abc123def456ghi789",
      "requirements": ["numpy>=1.20.0", "pandas>=1.3.0", "torch>=1.9.0"]
    },
    "metadata": {
      "training_data": {
        "dataset_id": "dataset_train_123",
        "samples": 100000,
        "features": 47,
        "training_time_hours": 2.5
      },
      "performance_metrics": {
        "accuracy": 0.95,
        "precision": 0.93,
        "recall": 0.91,
        "f1_score": 0.92,
        "auc_roc": 0.97
      },
      "hyperparameters": {
        "learning_rate": 0.001,
        "batch_size": 32,
        "epochs": 100,
        "dropout": 0.2,
        "hidden_layers": [128, 64, 32]
      }
    },
    "deployment_info": {
      "deployment_id": "deploy_xyz789abc",
      "deployment_name": "churn-predictor-prod",
      "status": "healthy",
      "endpoint_url": "https://api.schlep-engine.com/predict/churn-predictor-prod",
      "deployed_at": "2024-01-15T12:00:00Z",
      "current_replicas": 3,
      "resource_usage": {
        "cpu_usage_percent": 45,
        "memory_usage_percent": 62,
        "requests_per_minute": 1250
      }
    },
    "version_history": [
      {
        "version": "2.1.0",
        "created_at": "2024-01-15T10:30:00Z",
        "status": "deployed",
        "accuracy": 0.95
      },
      {
        "version": "2.0.0",
        "created_at": "2024-01-10T14:20:00Z",
        "status": "archived",
        "accuracy": 0.93
      },
      {
        "version": "1.0.0",
        "created_at": "2024-01-05T09:15:00Z",
        "status": "archived",
        "accuracy": 0.89
      }
    ]
  }
}`
            },
            {
              status: 404,
              description: "Model not found",
              example: `{
  "success": false,
  "error": {
    "type": "not_found",
    "message": "Model not found",
    "code": "model_not_found"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlep-engine.com/api/v1/mlops/models/model_abc123def456 \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/mlops/models/model_abc123def456',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    model = response.json()['data']
    print(f"Model: {model['name']} v{model['version']}")
    print(f"Framework: {model['framework']}")
    print(f"Status: {model['status']}")
    print(f"Accuracy: {model['metadata']['performance_metrics']['accuracy']}")
    
    if 'deployment_info' in model:
        deployment = model['deployment_info']
        print(f"Deployment Status: {deployment['status']}")
        print(f"Endpoint: {deployment['endpoint_url']}")
        print(f"Current Replicas: {deployment['current_replicas']}")
        print(f"CPU Usage: {deployment['resource_usage']['cpu_usage_percent']}%")
    
    print(f"Version History:")
    for version in model['version_history']:
        print(f"  - v{version['version']}: {version['status']} (acc: {version['accuracy']})")
        
else:
    print(f"Error: {response.text}")`,
            javascript: `fetch('https://api.schlep-engine.com/api/v1/mlops/models/model_abc123def456', {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const model = data.data;
    console.log(\`Model: \${model.name} v\${model.version}\`);
    console.log(\`Framework: \${model.framework}\`);
    console.log(\`Status: \${model.status}\`);
    console.log(\`Accuracy: \${model.metadata.performance_metrics.accuracy}\`);
    
    if (model.deployment_info) {
      const deployment = model.deployment_info;
      console.log(\`Deployment Status: \${deployment.status}\`);
      console.log(\`Endpoint: \${deployment.endpoint_url}\`);
      console.log(\`Current Replicas: \${deployment.current_replicas}\`);
      console.log(\`CPU Usage: \${deployment.resource_usage.cpu_usage_percent}%\`);
    }
    
    console.log('Version History:');
    model.version_history.forEach(version => {
      console.log(\`  - v\${version.version}: \${version.status} (acc: \${version.accuracy})\`);
    });
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />
      </div>
    </div>
  )
}