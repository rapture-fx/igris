import { EndpointCard } from '@/components/ui/EndpointCard'

export default function ExperimentsApiPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Enhanced Experiment Tracking API</h1>
        <p className="text-xl text-gray-600">
          Advanced experiment tracking platform with real-time metrics logging, automated insights generation, statistical comparison, and collaborative experiment sharing capabilities.
        </p>
      </div>

      <div className="space-y-8">
        <EndpointCard
          method="POST"
          path="/api/v1/experiments/create"
          title="Create Enhanced Experiment"
          description="Create a new enhanced experiment with advanced tracking capabilities, real-time monitoring, and automated insights generation. Supports collaborative features and experiment genealogy."
          parameters={[
            {
              name: "name",
              type: "string",
              required: true,
              description: "Descriptive name for the experiment",
              example: "deep-learning-hyperopt-v2"
            },
            {
              name: "project",
              type: "string",
              required: true,
              description: "Project identifier to group related experiments",
              example: "customer-analytics"
            },
            {
              name: "description",
              type: "string",
              required: false,
              description: "Detailed description of experiment objectives and methodology",
              example: "Advanced hyperparameter optimization using Bayesian optimization for deep neural networks"
            },
            {
              name: "tags",
              type: "array",
              required: false,
              description: "Tags for categorization and filtering",
              example: '["deep-learning", "hyperopt", "pytorch", "production"]'
            },
            {
              name: "parameters",
              type: "object",
              required: false,
              description: "Initial experiment parameters and hyperparameters",
              example: '{"learning_rate": 0.001, "batch_size": 64, "optimizer": "adam", "architecture": "resnet50"}'
            },
            {
              name: "parent_experiment_id",
              type: "string",
              required: false,
              description: "ID of parent experiment for experiment lineage tracking",
              example: "exp_parent_123abc"
            },
            {
              name: "collaboration_settings",
              type: "object",
              required: false,
              description: "Collaboration and sharing settings",
              example: '{"visibility": "team", "collaborators": ["user@company.com"], "permissions": {"read": true, "write": false}}'
            },
            {
              name: "monitoring_config",
              type: "object",
              required: false,
              description: "Real-time monitoring configuration",
              example: '{"enable_realtime": true, "metric_frequency": 10, "alert_thresholds": {"loss": 0.1, "accuracy": 0.9}}'
            }
          ]}
          responses={[
            {
              status: 201,
              description: "Enhanced experiment created successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_enhanced_789xyz012",
    "name": "deep-learning-hyperopt-v2",
    "project": "customer-analytics",
    "status": "created",
    "created_at": "2024-01-15T10:30:00Z",
    "created_by": "researcher@company.com",
    "description": "Advanced hyperparameter optimization using Bayesian optimization",
    "tags": ["deep-learning", "hyperopt", "pytorch", "production"],
    "parameters": {
      "learning_rate": 0.001,
      "batch_size": 64,
      "optimizer": "adam",
      "architecture": "resnet50"
    },
    "tracking_config": {
      "realtime_enabled": true,
      "metric_logging_frequency": 10,
      "auto_insights": true
    },
    "collaboration": {
      "visibility": "team",
      "share_url": "https://experiments.schlep-engine.com/shared/exp_enhanced_789xyz012",
      "collaborators_count": 1
    },
    "genealogy": {
      "parent_experiment_id": "exp_parent_123abc",
      "generation": 2,
      "lineage_path": ["exp_root_001", "exp_parent_123abc", "exp_enhanced_789xyz012"]
    },
    "dashboard_url": "https://experiments.schlep-engine.com/exp_enhanced_789xyz012",
    "api_endpoints": {
      "log_metrics": "/api/v1/experiments/exp_enhanced_789xyz012/metrics/log",
      "realtime_metrics": "/api/v1/experiments/exp_enhanced_789xyz012/metrics/realtime"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_exp_create_456"
  }
}`
            },
            {
              status: 400,
              description: "Invalid experiment configuration",
              example: `{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Invalid experiment parameters",
    "code": "invalid_parameters",
    "details": {
      "learning_rate": "Must be between 0.0001 and 1.0",
      "batch_size": "Must be a positive integer"
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/experiments/create \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "deep-learning-hyperopt-v2",
    "project": "customer-analytics",
    "description": "Advanced hyperparameter optimization using Bayesian optimization",
    "tags": ["deep-learning", "hyperopt", "pytorch", "production"],
    "parameters": {
      "learning_rate": 0.001,
      "batch_size": 64,
      "optimizer": "adam",
      "architecture": "resnet50"
    },
    "parent_experiment_id": "exp_parent_123abc",
    "collaboration_settings": {
      "visibility": "team",
      "collaborators": ["colleague@company.com"]
    },
    "monitoring_config": {
      "enable_realtime": true,
      "metric_frequency": 10
    }
  }'`,
            python: `import requests

experiment_config = {
    "name": "deep-learning-hyperopt-v2",
    "project": "customer-analytics", 
    "description": "Advanced hyperparameter optimization using Bayesian optimization",
    "tags": ["deep-learning", "hyperopt", "pytorch", "production"],
    "parameters": {
        "learning_rate": 0.001,
        "batch_size": 64,
        "optimizer": "adam",
        "architecture": "resnet50"
    },
    "parent_experiment_id": "exp_parent_123abc",
    "collaboration_settings": {
        "visibility": "team",
        "collaborators": ["colleague@company.com"]
    },
    "monitoring_config": {
        "enable_realtime": True,
        "metric_frequency": 10
    }
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/experiments/create',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=experiment_config
)

if response.status_code == 201:
    experiment = response.json()['data']
    print(f"Enhanced experiment created: {experiment['experiment_id']}")
    print(f"Dashboard URL: {experiment['dashboard_url']}")
    print(f"Share URL: {experiment['collaboration']['share_url']}")
    print(f"Realtime metrics endpoint: {experiment['api_endpoints']['realtime_metrics']}")
else:
    print(f"Creation failed: {response.text}")`,
            javascript: `const experimentConfig = {
  name: "deep-learning-hyperopt-v2",
  project: "customer-analytics",
  description: "Advanced hyperparameter optimization using Bayesian optimization",
  tags: ["deep-learning", "hyperopt", "pytorch", "production"],
  parameters: {
    learning_rate: 0.001,
    batch_size: 64,
    optimizer: "adam",
    architecture: "resnet50"
  },
  parent_experiment_id: "exp_parent_123abc",
  collaboration_settings: {
    visibility: "team",
    collaborators: ["colleague@company.com"]
  },
  monitoring_config: {
    enable_realtime: true,
    metric_frequency: 10
  }
};

fetch('https://api.schlep-engine.com/api/v1/experiments/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(experimentConfig)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const experiment = data.data;
    console.log('Enhanced experiment created:', experiment.experiment_id);
    console.log('Dashboard URL:', experiment.dashboard_url);
    console.log('Share URL:', experiment.collaboration.share_url);
    console.log('Realtime metrics endpoint:', experiment.api_endpoints.realtime_metrics);
  } else {
    console.error('Creation failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="POST"
          path="/api/v1/experiments/{id}/metrics/log"
          title="Log Real-time Metrics"
          description="Log metrics and parameters to an experiment in real-time with high-frequency updates, batch logging support, and automatic visualization generation."
          parameters={[
            {
              name: "experiment_id",
              type: "string",
              required: true,
              description: "The unique identifier of the experiment",
              example: "exp_enhanced_789xyz012"
            },
            {
              name: "metrics",
              type: "object",
              required: true,
              description: "Metrics to log with their values",
              example: '{"loss": 0.156, "accuracy": 0.934, "val_loss": 0.178, "val_accuracy": 0.921}'
            },
            {
              name: "step",
              type: "integer",
              required: false,
              description: "Step/epoch number for the metrics",
              example: "150"
            },
            {
              name: "timestamp",
              type: "string",
              required: false,
              description: "Custom timestamp (ISO 8601 format, defaults to current time)",
              example: "2024-01-15T11:30:00Z"
            },
            {
              name: "parameters",
              type: "object",
              required: false,
              description: "Additional parameters to log",
              example: '{"current_lr": 0.0008, "momentum": 0.9}'
            },
            {
              name: "tags",
              type: "array",
              required: false,
              description: "Tags for this metrics entry",
              example: '["checkpoint", "validation"]'
            },
            {
              name: "metadata",
              type: "object",
              required: false,
              description: "Additional metadata for context",
              example: '{"gpu_utilization": 0.85, "memory_usage": "4.2GB", "batch_time": 0.032}'
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Metrics logged successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_enhanced_789xyz012",
    "logged_at": "2024-01-15T11:30:00Z",
    "step": 150,
    "metrics_count": 4,
    "logged_metrics": ["loss", "accuracy", "val_loss", "val_accuracy"],
    "realtime_dashboard_updated": true,
    "insights_generated": {
      "trend_analysis": true,
      "anomaly_detection": false,
      "performance_alerts": []
    },
    "next_log_id": "log_abc123def456"
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
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/metrics/log \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "metrics": {
      "loss": 0.156,
      "accuracy": 0.934,
      "val_loss": 0.178,
      "val_accuracy": 0.921
    },
    "step": 150,
    "parameters": {
      "current_lr": 0.0008,
      "momentum": 0.9
    },
    "metadata": {
      "gpu_utilization": 0.85,
      "memory_usage": "4.2GB",
      "batch_time": 0.032
    },
    "tags": ["checkpoint", "validation"]
  }'`,
            python: `import requests
import time

# Single metric log
metrics_data = {
    "metrics": {
        "loss": 0.156,
        "accuracy": 0.934,
        "val_loss": 0.178,
        "val_accuracy": 0.921
    },
    "step": 150,
    "parameters": {
        "current_lr": 0.0008,
        "momentum": 0.9
    },
    "metadata": {
        "gpu_utilization": 0.85,
        "memory_usage": "4.2GB", 
        "batch_time": 0.032
    },
    "tags": ["checkpoint", "validation"]
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/metrics/log',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=metrics_data
)

if response.status_code == 200:
    result = response.json()['data']
    print(f"Metrics logged at step {result['step']}")
    print(f"Logged metrics: {', '.join(result['logged_metrics'])}")
    print(f"Insights generated: {result['insights_generated']}")
else:
    print(f"Logging failed: {response.text}")

# For batch logging in training loop
def log_training_metrics(experiment_id, epoch, metrics):
    return requests.post(
        f'https://api.schlep-engine.com/api/v1/experiments/{experiment_id}/metrics/log',
        headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
        json={"metrics": metrics, "step": epoch}
    )`,
            javascript: `// Single metric log
const metricsData = {
  metrics: {
    loss: 0.156,
    accuracy: 0.934,
    val_loss: 0.178,
    val_accuracy: 0.921
  },
  step: 150,
  parameters: {
    current_lr: 0.0008,
    momentum: 0.9
  },
  metadata: {
    gpu_utilization: 0.85,
    memory_usage: "4.2GB",
    batch_time: 0.032
  },
  tags: ["checkpoint", "validation"]
};

fetch('https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/metrics/log', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(metricsData)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const result = data.data;
    console.log(\`Metrics logged at step \${result.step}\`);
    console.log(\`Logged metrics: \${result.logged_metrics.join(', ')}\`);
    console.log('Insights generated:', result.insights_generated);
  } else {
    console.error('Logging failed:', data.error);
  }
});

// Helper function for batch logging
async function logTrainingMetrics(experimentId, epoch, metrics) {
  return await fetch(\`https://api.schlep-engine.com/api/v1/experiments/\${experimentId}/metrics/log\`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ metrics, step: epoch })
  }).then(res => res.json());
}`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/experiments/{id}/metrics/realtime"
          title="Get Real-time Metrics"
          description="Retrieve real-time metrics and live experiment status with streaming support, configurable intervals, and automatic trend analysis."
          parameters={[
            {
              name: "experiment_id",
              type: "string",
              required: true,
              description: "The unique identifier of the experiment",
              example: "exp_enhanced_789xyz012"
            },
            {
              name: "metrics",
              type: "array",
              required: false,
              description: "Specific metrics to retrieve (default: all)",
              example: '["loss", "accuracy", "val_accuracy"]'
            },
            {
              name: "last_n_steps",
              type: "integer",
              required: false,
              description: "Number of recent steps to include (default: 100)",
              example: "50"
            },
            {
              name: "include_trends",
              type: "boolean",
              required: false,
              description: "Include trend analysis in response (default: true)",
              example: "true"
            },
            {
              name: "format",
              type: "string",
              required: false,
              description: "Response format: json, csv, stream (default: json)",
              example: "json"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Real-time metrics retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_enhanced_789xyz012",
    "status": "running",
    "last_updated": "2024-01-15T11:45:00Z",
    "current_step": 175,
    "duration_seconds": 5400,
    "metrics_history": {
      "loss": {
        "current": 0.142,
        "previous": 0.156,
        "change": -0.014,
        "change_percentage": -8.97,
        "data_points": [
          {"step": 170, "value": 0.151, "timestamp": "2024-01-15T11:40:00Z"},
          {"step": 175, "value": 0.142, "timestamp": "2024-01-15T11:45:00Z"}
        ]
      },
      "accuracy": {
        "current": 0.946,
        "previous": 0.934,
        "change": 0.012,
        "change_percentage": 1.28,
        "data_points": [
          {"step": 170, "value": 0.939, "timestamp": "2024-01-15T11:40:00Z"},
          {"step": 175, "value": 0.946, "timestamp": "2024-01-15T11:45:00Z"}
        ]
      }
    },
    "trend_analysis": {
      "loss": {
        "trend": "decreasing",
        "strength": "strong",
        "slope": -0.0028,
        "r_squared": 0.94,
        "projection_next_10_steps": [0.140, 0.138, 0.136]
      },
      "accuracy": {
        "trend": "increasing", 
        "strength": "moderate",
        "slope": 0.0012,
        "r_squared": 0.87,
        "projection_next_10_steps": [0.948, 0.950, 0.951]
      }
    },
    "performance_indicators": {
      "convergence_status": "converging",
      "overfitting_risk": "low",
      "training_efficiency": "high",
      "estimated_completion": "2024-01-15T13:30:00Z"
    },
    "alerts": [],
    "streaming_url": "wss://realtime.schlep-engine.com/experiments/exp_enhanced_789xyz012/metrics"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/metrics/realtime?metrics=loss,accuracy&last_n_steps=50&include_trends=true" \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/metrics/realtime',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'metrics': ['loss', 'accuracy', 'val_accuracy'],
        'last_n_steps': 50,
        'include_trends': True
    }
)

if response.status_code == 200:
    data = response.json()['data']
    print(f"Experiment Status: {data['status']}")
    print(f"Current Step: {data['current_step']}")
    print(f"Duration: {data['duration_seconds']} seconds")
    
    # Display current metrics
    for metric_name, metric_data in data['metrics_history'].items():
        current = metric_data['current']
        change = metric_data['change_percentage']
        print(f"{metric_name}: {current:.4f} ({change:+.2f}%)")
    
    # Display trend analysis
    print("\\nTrend Analysis:")
    for metric_name, trend_data in data['trend_analysis'].items():
        trend = trend_data['trend']
        strength = trend_data['strength']
        print(f"{metric_name}: {trend} ({strength})")
        
    print(f"\\nConvergence Status: {data['performance_indicators']['convergence_status']}")
    print(f"Overfitting Risk: {data['performance_indicators']['overfitting_risk']}")
else:
    print(f"Error: {response.text}")

# For real-time streaming (using websockets)
import websocket

def on_message(ws, message):
    import json
    data = json.loads(message)
    print(f"Real-time update: {data}")

def start_realtime_monitoring(experiment_id):
    ws = websocket.WebSocketApp(
        f"wss://realtime.schlep-engine.com/experiments/{experiment_id}/metrics",
        on_message=on_message,
        header={"Authorization": "Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"}
    )
    ws.run_forever()`,
            javascript: `// Fetch real-time metrics
const params = new URLSearchParams({
  metrics: ['loss', 'accuracy', 'val_accuracy'].join(','),
  last_n_steps: '50',
  include_trends: 'true'
});

fetch(\`https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/metrics/realtime?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const experimentData = data.data;
    console.log(\`Experiment Status: \${experimentData.status}\`);
    console.log(\`Current Step: \${experimentData.current_step}\`);
    console.log(\`Duration: \${experimentData.duration_seconds} seconds\`);
    
    // Display current metrics
    Object.entries(experimentData.metrics_history).forEach(([metricName, metricData]) => {
      const current = metricData.current;
      const change = metricData.change_percentage;
      console.log(\`\${metricName}: \${current.toFixed(4)} (\${change > 0 ? '+' : ''}\${change.toFixed(2)}%)\`);
    });
    
    // Display trend analysis  
    console.log('\\nTrend Analysis:');
    Object.entries(experimentData.trend_analysis).forEach(([metricName, trendData]) => {
      console.log(\`\${metricName}: \${trendData.trend} (\${trendData.strength})\`);
    });
    
    console.log(\`\\nConvergence Status: \${experimentData.performance_indicators.convergence_status}\`);
    console.log(\`Overfitting Risk: \${experimentData.performance_indicators.overfitting_risk}\`);
  } else {
    console.error('Error:', data.error);
  }
});

// Real-time streaming with WebSockets
function startRealtimeMonitoring(experimentId) {
  const ws = new WebSocket(\`wss://realtime.schlep-engine.com/experiments/\${experimentId}/metrics\`);
  
  ws.onopen = function() {
    console.log('Connected to real-time metrics stream');
    // Send authentication
    ws.send(JSON.stringify({
      type: 'auth',
      token: 'sk_live_4eC39HqLyjWDarjtT1zdp7dc'
    }));
  };
  
  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Real-time update:', data);
    
    // Update your UI with real-time metrics
    if (data.type === 'metrics_update') {
      updateMetricsDisplay(data.metrics);
    }
  };
  
  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}

function updateMetricsDisplay(metrics) {
  // Your real-time UI update logic here
  console.log('Updating metrics display:', metrics);
}`
          }}
        />

        <EndpointCard
          method="POST"
          path="/api/v1/experiments/compare"
          title="Compare Experiments Statistically"
          description="Perform statistical comparison between multiple experiments with significance testing, confidence intervals, and comprehensive analysis reports."
          parameters={[
            {
              name: "experiment_ids",
              type: "array",
              required: true,
              description: "List of experiment IDs to compare (2-10 experiments)",
              example: '["exp_enhanced_789xyz012", "exp_baseline_456def", "exp_variant_123ghi"]'
            },
            {
              name: "metrics",
              type: "array",
              required: true,
              description: "Metrics to compare across experiments",
              example: '["accuracy", "loss", "f1_score", "training_time"]'
            },
            {
              name: "comparison_type",
              type: "string",
              required: false,
              description: "Type of statistical comparison: pairwise, best_vs_rest, full_anova",
              example: "pairwise"
            },
            {
              name: "significance_level",
              type: "number",
              required: false,
              description: "Statistical significance level (default: 0.05)",
              example: "0.05"
            },
            {
              name: "confidence_level",
              type: "number",
              required: false,
              description: "Confidence level for intervals (default: 0.95)",
              example: "0.95"
            },
            {
              name: "include_visualizations",
              type: "boolean",
              required: false,
              description: "Generate comparison visualizations (default: true)",
              example: "true"
            },
            {
              name: "business_context",
              type: "object",
              required: false,
              description: "Business context for interpretation",
              example: '{"primary_metric": "accuracy", "minimum_improvement": 0.02, "cost_considerations": true}'
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Statistical comparison completed successfully",
              example: `{
  "success": true,
  "data": {
    "comparison_id": "comp_abc123def456",
    "generated_at": "2024-01-15T12:00:00Z",
    "experiments": [
      {
        "experiment_id": "exp_enhanced_789xyz012",
        "name": "deep-learning-hyperopt-v2",
        "status": "completed"
      },
      {
        "experiment_id": "exp_baseline_456def",
        "name": "baseline-model",
        "status": "completed"
      }
    ],
    "statistical_results": {
      "accuracy": {
        "summary_statistics": {
          "exp_enhanced_789xyz012": {"mean": 0.946, "std": 0.008, "n": 100},
          "exp_baseline_456def": {"mean": 0.923, "std": 0.012, "n": 100}
        },
        "pairwise_tests": [
          {
            "experiment_1": "exp_enhanced_789xyz012",
            "experiment_2": "exp_baseline_456def",
            "test_statistic": 15.67,
            "p_value": 0.0001,
            "significant": true,
            "effect_size": 0.89,
            "confidence_interval": {
              "lower": 0.018,
              "upper": 0.028,
              "level": 0.95
            },
            "interpretation": "Enhanced model significantly outperforms baseline"
          }
        ],
        "best_performer": {
          "experiment_id": "exp_enhanced_789xyz012",
          "mean_value": 0.946,
          "improvement_vs_baseline": 0.023,
          "improvement_percentage": 2.49
        }
      },
      "loss": {
        "summary_statistics": {
          "exp_enhanced_789xyz012": {"mean": 0.142, "std": 0.015, "n": 100},
          "exp_baseline_456def": {"mean": 0.189, "std": 0.023, "n": 100}
        },
        "pairwise_tests": [
          {
            "experiment_1": "exp_enhanced_789xyz012", 
            "experiment_2": "exp_baseline_456def",
            "test_statistic": -12.34,
            "p_value": 0.0002,
            "significant": true,
            "effect_size": -0.76,
            "confidence_interval": {
              "lower": -0.055,
              "upper": -0.039,
              "level": 0.95
            },
            "interpretation": "Enhanced model has significantly lower loss"
          }
        ],
        "best_performer": {
          "experiment_id": "exp_enhanced_789xyz012",
          "mean_value": 0.142,
          "improvement_vs_baseline": -0.047,
          "improvement_percentage": -24.87
        }
      }
    },
    "overall_ranking": [
      {
        "rank": 1,
        "experiment_id": "exp_enhanced_789xyz012",
        "name": "deep-learning-hyperopt-v2",
        "composite_score": 0.92,
        "wins": 2,
        "losses": 0
      },
      {
        "rank": 2,
        "experiment_id": "exp_baseline_456def",
        "name": "baseline-model", 
        "composite_score": 0.78,
        "wins": 0,
        "losses": 2
      }
    ],
    "recommendations": [
      {
        "title": "Deploy Enhanced Model",
        "description": "The enhanced model shows statistically significant improvements across all key metrics",
        "confidence": "high",
        "action_items": [
          "Proceed with production deployment of exp_enhanced_789xyz012",
          "Monitor performance closely during initial rollout",
          "Consider A/B testing with 20% traffic split"
        ]
      }
    ],
    "visualizations": {
      "comparison_charts": [
        "https://viz.schlep-engine.com/comparison/comp_abc123def456/accuracy_comparison.png",
        "https://viz.schlep-engine.com/comparison/comp_abc123def456/loss_comparison.png"
      ],
      "statistical_plots": [
        "https://viz.schlep-engine.com/comparison/comp_abc123def456/confidence_intervals.png"
      ]
    },
    "report_url": "https://reports.schlep-engine.com/comparison/comp_abc123def456"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/experiments/compare \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "experiment_ids": [
      "exp_enhanced_789xyz012",
      "exp_baseline_456def", 
      "exp_variant_123ghi"
    ],
    "metrics": ["accuracy", "loss", "f1_score", "training_time"],
    "comparison_type": "pairwise",
    "significance_level": 0.05,
    "confidence_level": 0.95,
    "include_visualizations": true,
    "business_context": {
      "primary_metric": "accuracy",
      "minimum_improvement": 0.02,
      "cost_considerations": true
    }
  }'`,
            python: `import requests

comparison_config = {
    "experiment_ids": [
        "exp_enhanced_789xyz012",
        "exp_baseline_456def",
        "exp_variant_123ghi"
    ],
    "metrics": ["accuracy", "loss", "f1_score", "training_time"],
    "comparison_type": "pairwise",
    "significance_level": 0.05,
    "confidence_level": 0.95,
    "include_visualizations": True,
    "business_context": {
        "primary_metric": "accuracy",
        "minimum_improvement": 0.02,
        "cost_considerations": True
    }
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/experiments/compare',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=comparison_config
)

if response.status_code == 200:
    comparison = response.json()['data']
    print(f"Comparison ID: {comparison['comparison_id']}")
    print(f"Report URL: {comparison['report_url']}")
    
    # Display overall ranking
    print("\\nOverall Ranking:")
    for ranking in comparison['overall_ranking']:
        print(f"  {ranking['rank']}. {ranking['name']} (score: {ranking['composite_score']:.3f})")
    
    # Display statistical results
    print("\\nStatistical Results:")
    for metric, results in comparison['statistical_results'].items():
        print(f"\\n{metric.upper()}:")
        best = results['best_performer']
        print(f"  Best: {best['experiment_id']} (mean: {best['mean_value']:.4f})")
        
        for test in results['pairwise_tests']:
            if test['significant']:
                print(f"  {test['interpretation']} (p={test['p_value']:.4f})")
    
    # Display recommendations
    print("\\nRecommendations:")
    for rec in comparison['recommendations']:
        print(f"  - {rec['title']}: {rec['description']}")
        for action in rec['action_items']:
            print(f"    • {action}")

else:
    print(f"Comparison failed: {response.text}")`,
            javascript: `const comparisonConfig = {
  experiment_ids: [
    "exp_enhanced_789xyz012",
    "exp_baseline_456def",
    "exp_variant_123ghi"
  ],
  metrics: ["accuracy", "loss", "f1_score", "training_time"],
  comparison_type: "pairwise",
  significance_level: 0.05,
  confidence_level: 0.95,
  include_visualizations: true,
  business_context: {
    primary_metric: "accuracy",
    minimum_improvement: 0.02,
    cost_considerations: true
  }
};

fetch('https://api.schlep-engine.com/api/v1/experiments/compare', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(comparisonConfig)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const comparison = data.data;
    console.log('Comparison ID:', comparison.comparison_id);
    console.log('Report URL:', comparison.report_url);
    
    // Display overall ranking
    console.log('\\nOverall Ranking:');
    comparison.overall_ranking.forEach(ranking => {
      console.log(\`  \${ranking.rank}. \${ranking.name} (score: \${ranking.composite_score.toFixed(3)})\`);
    });
    
    // Display statistical results
    console.log('\\nStatistical Results:');
    Object.entries(comparison.statistical_results).forEach(([metric, results]) => {
      console.log(\`\\n\${metric.toUpperCase()}:\`);
      const best = results.best_performer;
      console.log(\`  Best: \${best.experiment_id} (mean: \${best.mean_value.toFixed(4)})\`);
      
      results.pairwise_tests.forEach(test => {
        if (test.significant) {
          console.log(\`  \${test.interpretation} (p=\${test.p_value.toFixed(4)})\`);
        }
      });
    });
    
    // Display recommendations
    console.log('\\nRecommendations:');
    comparison.recommendations.forEach(rec => {
      console.log(\`  - \${rec.title}: \${rec.description}\`);
      rec.action_items.forEach(action => {
        console.log(\`    • \${action}\`);
      });
    });
    
  } else {
    console.error('Comparison failed:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/experiments/{id}/insights"
          title="Get Automated Insights"
          description="Retrieve AI-generated insights and recommendations for an experiment based on performance patterns, anomalies, and optimization opportunities."
          parameters={[
            {
              name: "experiment_id",
              type: "string", 
              required: true,
              description: "The unique identifier of the experiment",
              example: "exp_enhanced_789xyz012"
            },
            {
              name: "insight_types",
              type: "array",
              required: false,
              description: "Types of insights to generate: performance, optimization, anomalies, recommendations",
              example: '["performance", "optimization", "recommendations"]'
            },
            {
              name: "include_predictions",
              type: "boolean",
              required: false,
              description: "Include performance predictions and projections (default: true)",
              example: "true"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Automated insights generated successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_enhanced_789xyz012",
    "generated_at": "2024-01-15T12:15:00Z",
    "insights": {
      "performance_analysis": {
        "overall_score": 8.7,
        "convergence_quality": "excellent",
        "training_efficiency": "high",
        "key_findings": [
          "Model is converging steadily with strong performance gains",
          "No signs of overfitting detected in validation metrics",
          "Training efficiency is 23% higher than similar experiments"
        ],
        "metrics_summary": {
          "accuracy": {"current": 0.946, "trend": "improving", "confidence": 0.94},
          "loss": {"current": 0.142, "trend": "decreasing", "confidence": 0.92}
        }
      },
      "optimization_opportunities": [
        {
          "category": "hyperparameters",
          "title": "Learning Rate Optimization",
          "description": "Current learning rate could be increased by 15-20% for faster convergence",
          "confidence": "medium",
          "potential_improvement": "5-8% faster training",
          "recommended_action": "Try learning_rate=0.0012 in next experiment",
          "risk_level": "low"
        },
        {
          "category": "architecture",
          "title": "Batch Size Optimization", 
          "description": "Increasing batch size to 128 may improve convergence stability",
          "confidence": "high",
          "potential_improvement": "10-15% more stable training",
          "recommended_action": "Test with batch_size=128",
          "risk_level": "low"
        }
      ],
      "anomaly_detection": {
        "anomalies_found": 1,
        "anomalies": [
          {
            "type": "metric_spike",
            "metric": "val_loss",
            "detected_at": "2024-01-15T11:20:00Z",
            "step": 135,
            "severity": "low",
            "description": "Temporary validation loss spike detected, but quickly recovered",
            "likely_cause": "Normal training variance",
            "action_required": false
          }
        ]
      },
      "predictions": {
        "convergence_prediction": {
          "estimated_final_accuracy": 0.952,
          "confidence_interval": [0.948, 0.956],
          "steps_to_convergence": 45,
          "estimated_completion_time": "2024-01-15T13:30:00Z"
        },
        "resource_predictions": {
          "total_compute_time": "2.3 hours",
          "estimated_cost": "$15.60",
          "memory_peak": "6.2GB"
        }
      },
      "recommendations": [
        {
          "priority": "high",
          "category": "performance",
          "title": "Continue Current Training",
          "description": "Experiment is performing exceptionally well. Continue to completion.",
          "reasoning": "Strong convergence pattern with no concerning issues",
          "action_items": [
            "Monitor for next 50 steps",
            "Save checkpoint at step 200",
            "Prepare for production evaluation"
          ]
        },
        {
          "priority": "medium",
          "category": "optimization",
          "title": "Plan Follow-up Experiment",
          "description": "Test optimized hyperparameters identified in analysis",
          "reasoning": "Potential for 5-15% performance improvements identified",
          "action_items": [
            "Create experiment with learning_rate=0.0012",
            "Test batch_size=128",
            "Compare against current best results"
          ]
        }
      ]
    },
    "confidence_score": 0.89,
    "next_analysis_at": "2024-01-15T13:00:00Z"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/insights?insight_types=performance,optimization,recommendations&include_predictions=true" \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/insights',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'insight_types': ['performance', 'optimization', 'recommendations'],
        'include_predictions': True
    }
)

if response.status_code == 200:
    insights = response.json()['data']
    print(f"Insights for Experiment: {insights['experiment_id']}")
    print(f"Overall Performance Score: {insights['insights']['performance_analysis']['overall_score']}/10")
    print(f"Confidence: {insights['confidence_score']:.2%}")
    
    # Performance Analysis
    perf = insights['insights']['performance_analysis']
    print(f"\\nPerformance Analysis:")
    print(f"  Convergence Quality: {perf['convergence_quality']}")
    print(f"  Training Efficiency: {perf['training_efficiency']}")
    
    print("\\nKey Findings:")
    for finding in perf['key_findings']:
        print(f"  - {finding}")
    
    # Optimization Opportunities
    print("\\nOptimization Opportunities:")
    for opp in insights['insights']['optimization_opportunities']:
        print(f"  {opp['title']} ({opp['confidence']} confidence)")
        print(f"    {opp['description']}")
        print(f"    Potential improvement: {opp['potential_improvement']}")
        print(f"    Action: {opp['recommended_action']}")
        print()
    
    # Predictions
    pred = insights['insights']['predictions']['convergence_prediction']
    print(f"Predictions:")
    print(f"  Final accuracy estimate: {pred['estimated_final_accuracy']:.4f}")
    print(f"  Steps to convergence: {pred['steps_to_convergence']}")
    print(f"  Completion time: {pred['estimated_completion_time']}")
    
    # Recommendations
    print("\\nRecommendations:")
    for rec in insights['insights']['recommendations']:
        print(f"  [{rec['priority'].upper()}] {rec['title']}")
        print(f"    {rec['description']}")
        for action in rec['action_items']:
            print(f"    - {action}")
        print()

else:
    print(f"Error: {response.text}")`,
            javascript: `const params = new URLSearchParams({
  insight_types: ['performance', 'optimization', 'recommendations'].join(','),
  include_predictions: 'true'
});

fetch(\`https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/insights?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const insights = data.data;
    console.log(\`Insights for Experiment: \${insights.experiment_id}\`);
    console.log(\`Overall Performance Score: \${insights.insights.performance_analysis.overall_score}/10\`);
    console.log(\`Confidence: \${(insights.confidence_score * 100).toFixed(0)}%\`);
    
    // Performance Analysis
    const perf = insights.insights.performance_analysis;
    console.log('\\nPerformance Analysis:');
    console.log(\`  Convergence Quality: \${perf.convergence_quality}\`);
    console.log(\`  Training Efficiency: \${perf.training_efficiency}\`);
    
    console.log('\\nKey Findings:');
    perf.key_findings.forEach(finding => {
      console.log(\`  - \${finding}\`);
    });
    
    // Optimization Opportunities
    console.log('\\nOptimization Opportunities:');
    insights.insights.optimization_opportunities.forEach(opp => {
      console.log(\`  \${opp.title} (\${opp.confidence} confidence)\`);
      console.log(\`    \${opp.description}\`);
      console.log(\`    Potential improvement: \${opp.potential_improvement}\`);
      console.log(\`    Action: \${opp.recommended_action}\`);
      console.log('');
    });
    
    // Predictions
    const pred = insights.insights.predictions.convergence_prediction;
    console.log('Predictions:');
    console.log(\`  Final accuracy estimate: \${pred.estimated_final_accuracy.toFixed(4)}\`);
    console.log(\`  Steps to convergence: \${pred.steps_to_convergence}\`);
    console.log(\`  Completion time: \${pred.estimated_completion_time}\`);
    
    // Recommendations
    console.log('\\nRecommendations:');
    insights.insights.recommendations.forEach(rec => {
      console.log(\`  [\${rec.priority.toUpperCase()}] \${rec.title}\`);
      console.log(\`    \${rec.description}\`);
      rec.action_items.forEach(action => {
        console.log(\`    - \${action}\`);
      });
      console.log('');
    });
    
  } else {
    console.error('Error:', data.error);
  }
});`
          }}
        />

        <EndpointCard
          method="POST"
          path="/api/v1/experiments/{id}/share"
          title="Share Experiment with Team"
          description="Share an experiment with team members or external collaborators with configurable permissions, access controls, and collaboration features."
          parameters={[
            {
              name: "experiment_id",
              type: "string",
              required: true,
              description: "The unique identifier of the experiment to share",
              example: "exp_enhanced_789xyz012"
            },
            {
              name: "recipients",
              type: "array",
              required: true,
              description: "List of email addresses or user IDs to share with",
              example: '["colleague@company.com", "researcher@university.edu", "user_id_123"]'
            },
            {
              name: "permissions",
              type: "object",
              required: false,
              description: "Access permissions for shared users",
              example: '{"read": true, "write": false, "download": true, "comment": true}'
            },
            {
              name: "visibility",
              type: "string",
              required: false,
              description: "Visibility level: private, team, organization, public",
              example: "team"
            },
            {
              name: "expiry_date",
              type: "string",
              required: false,
              description: "Share link expiry date (ISO 8601 format)",
              example: "2024-02-15T23:59:59Z"
            },
            {
              name: "message",
              type: "string",
              required: false,
              description: "Optional message to include with the share notification",
              example: "Please review the results and provide feedback on the hyperparameter optimization approach."
            },
            {
              name: "include_artifacts",
              type: "boolean",
              required: false,
              description: "Include experiment artifacts (models, logs, etc.) in share",
              example: "true"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Experiment shared successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_enhanced_789xyz012",
    "share_id": "share_abc123def456",
    "shared_at": "2024-01-15T12:30:00Z",
    "shared_by": "researcher@company.com",
    "recipients": [
      {
        "email": "colleague@company.com",
        "status": "invited",
        "permissions": {
          "read": true,
          "write": false,
          "download": true,
          "comment": true
        }
      },
      {
        "email": "researcher@university.edu",
        "status": "invited", 
        "permissions": {
          "read": true,
          "write": false,
          "download": true,
          "comment": true
        }
      }
    ],
    "share_links": {
      "public_url": "https://experiments.schlep-engine.com/shared/exp_enhanced_789xyz012/share_abc123def456",
      "direct_access": "https://experiments.schlep-engine.com/shared/share_abc123def456",
      "embed_url": "https://experiments.schlep-engine.com/embed/share_abc123def456"
    },
    "access_settings": {
      "visibility": "team",
      "requires_authentication": true,
      "download_enabled": true,
      "comments_enabled": true,
      "expiry_date": "2024-02-15T23:59:59Z"
    },
    "shared_content": {
      "includes_metrics": true,
      "includes_parameters": true,
      "includes_artifacts": true,
      "includes_code": false,
      "includes_logs": true
    },
    "collaboration_features": {
      "comments_enabled": true,
      "annotations_enabled": true,
      "download_tracking": true,
      "view_analytics": true
    },
    "notifications_sent": 2,
    "estimated_access_duration": "30 days"
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/share \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipients": [
      "colleague@company.com",
      "researcher@university.edu"
    ],
    "permissions": {
      "read": true,
      "write": false,
      "download": true,
      "comment": true
    },
    "visibility": "team",
    "expiry_date": "2024-02-15T23:59:59Z",
    "message": "Please review the results and provide feedback on the hyperparameter optimization approach.",
    "include_artifacts": true
  }'`,
            python: `import requests
from datetime import datetime, timedelta

# Calculate expiry date (30 days from now)
expiry_date = (datetime.now() + timedelta(days=30)).isoformat() + 'Z'

share_config = {
    "recipients": [
        "colleague@company.com",
        "researcher@university.edu"
    ],
    "permissions": {
        "read": True,
        "write": False,
        "download": True,
        "comment": True
    },
    "visibility": "team",
    "expiry_date": expiry_date,
    "message": "Please review the results and provide feedback on the hyperparameter optimization approach.",
    "include_artifacts": True
}

response = requests.post(
    'https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/share',
    headers={
        'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
        'Content-Type': 'application/json'
    },
    json=share_config
)

if response.status_code == 200:
    share_info = response.json()['data']
    print(f"Experiment shared successfully!")
    print(f"Share ID: {share_info['share_id']}")
    print(f"Public URL: {share_info['share_links']['public_url']}")
    print(f"Direct Access: {share_info['share_links']['direct_access']}")
    print(f"Notifications sent: {share_info['notifications_sent']}")
    
    print("\\nRecipients:")
    for recipient in share_info['recipients']:
        print(f"  - {recipient['email']} ({recipient['status']})")
    
    print(f"\\nAccess Settings:")
    settings = share_info['access_settings']
    print(f"  - Visibility: {settings['visibility']}")
    print(f"  - Requires authentication: {settings['requires_authentication']}")
    print(f"  - Download enabled: {settings['download_enabled']}")
    print(f"  - Comments enabled: {settings['comments_enabled']}")
    print(f"  - Expires: {settings['expiry_date']}")

else:
    print(f"Sharing failed: {response.text}")

# Helper function to share with default settings
def share_experiment_quick(experiment_id, recipients, message=None):
    """Quick share with sensible defaults"""
    config = {
        "recipients": recipients,
        "permissions": {"read": True, "comment": True},
        "visibility": "team",
        "include_artifacts": False
    }
    if message:
        config["message"] = message
    
    return requests.post(
        f'https://api.schlep-engine.com/api/v1/experiments/{experiment_id}/share',
        headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
        json=config
    )`,
            javascript: `// Calculate expiry date (30 days from now)
const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const shareConfig = {
  recipients: [
    "colleague@company.com",
    "researcher@university.edu"
  ],
  permissions: {
    read: true,
    write: false,
    download: true,
    comment: true
  },
  visibility: "team",
  expiry_date: expiryDate,
  message: "Please review the results and provide feedback on the hyperparameter optimization approach.",
  include_artifacts: true
};

fetch('https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/share', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(shareConfig)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const shareInfo = data.data;
    console.log('Experiment shared successfully!');
    console.log('Share ID:', shareInfo.share_id);
    console.log('Public URL:', shareInfo.share_links.public_url);
    console.log('Direct Access:', shareInfo.share_links.direct_access);
    console.log('Notifications sent:', shareInfo.notifications_sent);
    
    console.log('\\nRecipients:');
    shareInfo.recipients.forEach(recipient => {
      console.log(\`  - \${recipient.email} (\${recipient.status})\`);
    });
    
    const settings = shareInfo.access_settings;
    console.log('\\nAccess Settings:');
    console.log(\`  - Visibility: \${settings.visibility}\`);
    console.log(\`  - Requires authentication: \${settings.requires_authentication}\`);
    console.log(\`  - Download enabled: \${settings.download_enabled}\`);
    console.log(\`  - Comments enabled: \${settings.comments_enabled}\`);
    console.log(\`  - Expires: \${settings.expiry_date}\`);
    
  } else {
    console.error('Sharing failed:', data.error);
  }
});

// Helper function for quick sharing
async function shareExperimentQuick(experimentId, recipients, message = null) {
  const config = {
    recipients: recipients,
    permissions: { read: true, comment: true },
    visibility: "team",
    include_artifacts: false
  };
  
  if (message) {
    config.message = message;
  }
  
  return await fetch(\`https://api.schlep-engine.com/api/v1/experiments/\${experimentId}/share\`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  }).then(res => res.json());
}`
          }}
        />

        <EndpointCard
          method="GET"
          path="/api/v1/experiments/{id}/genealogy"
          title="Get Experiment Lineage"
          description="Retrieve the complete genealogy and lineage tree for an experiment, showing parent experiments, child experiments, and the full evolution history."
          parameters={[
            {
              name: "experiment_id",
              type: "string",
              required: true,
              description: "The unique identifier of the experiment",
              example: "exp_enhanced_789xyz012"
            },
            {
              name: "depth",
              type: "integer",
              required: false,
              description: "Maximum depth to traverse (default: unlimited)",
              example: "3"
            },
            {
              name: "include_metrics",
              type: "boolean",
              required: false,
              description: "Include performance metrics for each experiment in lineage",
              example: "true"
            },
            {
              name: "format",
              type: "string",
              required: false,
              description: "Response format: tree, flat, graph (default: tree)",
              example: "tree"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Experiment genealogy retrieved successfully",
              example: `{
  "success": true,
  "data": {
    "experiment_id": "exp_enhanced_789xyz012",
    "name": "deep-learning-hyperopt-v2",
    "genealogy": {
      "current_generation": 3,
      "total_generations": 4,
      "lineage_depth": 3,
      "family_size": 12,
      "root_experiment": {
        "experiment_id": "exp_root_001",
        "name": "baseline-exploration",
        "created_at": "2024-01-01T10:00:00Z",
        "generation": 1,
        "metrics": {
          "accuracy": 0.78,
          "loss": 0.45
        }
      },
      "ancestry_path": [
        {
          "experiment_id": "exp_root_001",
          "name": "baseline-exploration",
          "generation": 1,
          "relationship": "great-grandparent",
          "created_at": "2024-01-01T10:00:00Z",
          "metrics": {"accuracy": 0.78, "loss": 0.45},
          "key_innovations": ["initial architecture", "basic hyperparameters"]
        },
        {
          "experiment_id": "exp_gen2_456",
          "name": "architecture-optimization",
          "generation": 2,
          "relationship": "grandparent",
          "created_at": "2024-01-05T14:00:00Z",
          "metrics": {"accuracy": 0.85, "loss": 0.32},
          "key_innovations": ["deeper network", "dropout layers"],
          "improvement_vs_parent": {"accuracy": 0.07, "loss": -0.13}
        },
        {
          "experiment_id": "exp_parent_123abc",
          "name": "hyperparameter-tuning",
          "generation": 3,
          "relationship": "parent",
          "created_at": "2024-01-10T09:00:00Z",
          "metrics": {"accuracy": 0.89, "loss": 0.28},
          "key_innovations": ["learning rate scheduling", "batch normalization"],
          "improvement_vs_parent": {"accuracy": 0.04, "loss": -0.04}
        }
      ],
      "current_experiment": {
        "experiment_id": "exp_enhanced_789xyz012",
        "name": "deep-learning-hyperopt-v2",
        "generation": 4,
        "created_at": "2024-01-15T10:30:00Z",
        "metrics": {"accuracy": 0.946, "loss": 0.142},
        "key_innovations": ["Bayesian optimization", "advanced regularization", "ensemble techniques"],
        "improvement_vs_parent": {"accuracy": 0.056, "loss": -0.138},
        "improvement_vs_root": {"accuracy": 0.166, "loss": -0.308}
      },
      "siblings": [
        {
          "experiment_id": "exp_sibling_789def",
          "name": "alternative-approach",
          "generation": 4,
          "created_at": "2024-01-14T16:00:00Z",
          "metrics": {"accuracy": 0.921, "loss": 0.167},
          "status": "completed",
          "relationship": "sibling"
        }
      ],
      "children": [],
      "evolution_summary": {
        "total_improvement_vs_root": {
          "accuracy": 0.166,
          "accuracy_percentage": 21.28,
          "loss": -0.308,
          "loss_percentage": -68.44
        },
        "generational_improvements": [
          {"generation": 2, "accuracy_gain": 0.07, "loss_reduction": 0.13},
          {"generation": 3, "accuracy_gain": 0.04, "loss_reduction": 0.04},
          {"generation": 4, "accuracy_gain": 0.056, "loss_reduction": 0.138}
        ],
        "innovation_timeline": [
          {"generation": 1, "innovations": ["initial architecture", "basic hyperparameters"]},
          {"generation": 2, "innovations": ["deeper network", "dropout layers"]},
          {"generation": 3, "innovations": ["learning rate scheduling", "batch normalization"]},
          {"generation": 4, "innovations": ["Bayesian optimization", "advanced regularization", "ensemble techniques"]}
        ]
      }
    },
    "visualization": {
      "family_tree_url": "https://viz.schlep-engine.com/genealogy/exp_enhanced_789xyz012/tree.svg",
      "timeline_url": "https://viz.schlep-engine.com/genealogy/exp_enhanced_789xyz012/timeline.svg",
      "metrics_evolution_url": "https://viz.schlep-engine.com/genealogy/exp_enhanced_789xyz012/metrics.svg"
    },
    "insights": {
      "best_performer_in_family": "exp_enhanced_789xyz012",
      "most_innovative_generation": 4,
      "convergence_pattern": "steady_improvement",
      "recommended_next_steps": [
        "Explore ensemble methods further",
        "Test on different datasets", 
        "Consider transfer learning approaches"
      ]
    }
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/genealogy?include_metrics=true&format=tree&depth=5" \\
  -H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/genealogy',
    headers={'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'},
    params={
        'include_metrics': True,
        'format': 'tree',
        'depth': 5
    }
)

if response.status_code == 200:
    genealogy = response.json()['data']
    print(f"Genealogy for: {genealogy['name']}")
    print(f"Generation: {genealogy['genealogy']['current_generation']}")
    print(f"Family Size: {genealogy['genealogy']['family_size']} experiments")
    
    # Display ancestry path
    print("\\nAncestry Path:")
    for ancestor in genealogy['genealogy']['ancestry_path']:
        gen = ancestor['generation']
        name = ancestor['name']
        relationship = ancestor['relationship']
        accuracy = ancestor['metrics']['accuracy']
        print(f"  Gen {gen}: {name} ({relationship}) - Accuracy: {accuracy:.3f}")
        
        if 'improvement_vs_parent' in ancestor:
            improvement = ancestor['improvement_vs_parent']['accuracy']
            print(f"    Improvement: +{improvement:.3f} accuracy")
    
    # Current experiment
    current = genealogy['genealogy']['current_experiment']
    print(f"\\nCurrent Experiment:")
    print(f"  {current['name']} (Gen {current['generation']})")
    print(f"  Accuracy: {current['metrics']['accuracy']:.4f}")
    print(f"  Improvement vs Root: +{current['improvement_vs_root']['accuracy']:.3f}")
    print(f"  Improvement %: +{genealogy['genealogy']['evolution_summary']['total_improvement_vs_root']['accuracy_percentage']:.1f}%")
    
    # Key innovations
    print("\\nInnovation Timeline:")
    for innovation in genealogy['genealogy']['evolution_summary']['innovation_timeline']:
        gen = innovation['generation']
        innovations = ', '.join(innovation['innovations'])
        print(f"  Gen {gen}: {innovations}")
    
    # Siblings
    if genealogy['genealogy']['siblings']:
        print("\\nSiblings:")
        for sibling in genealogy['genealogy']['siblings']:
            print(f"  - {sibling['name']}: {sibling['metrics']['accuracy']:.3f} accuracy")
    
    # Visualization links
    print("\\nVisualizations:")
    viz = genealogy['visualization']
    print(f"  Family Tree: {viz['family_tree_url']}")
    print(f"  Timeline: {viz['timeline_url']}")
    print(f"  Metrics Evolution: {viz['metrics_evolution_url']}")
    
    # Insights
    insights = genealogy['insights']
    print(f"\\nInsights:")
    print(f"  Best Performer: {insights['best_performer_in_family']}")
    print(f"  Most Innovative Generation: {insights['most_innovative_generation']}")
    print(f"  Pattern: {insights['convergence_pattern']}")
    
    print("\\nRecommended Next Steps:")
    for step in insights['recommended_next_steps']:
        print(f"  - {step}")

else:
    print(f"Error: {response.text}")`,
            javascript: `const params = new URLSearchParams({
  include_metrics: 'true',
  format: 'tree',
  depth: '5'
});

fetch(\`https://api.schlep-engine.com/api/v1/experiments/exp_enhanced_789xyz012/genealogy?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const genealogy = data.data;
    console.log(\`Genealogy for: \${genealogy.name}\`);
    console.log(\`Generation: \${genealogy.genealogy.current_generation}\`);
    console.log(\`Family Size: \${genealogy.genealogy.family_size} experiments\`);
    
    // Display ancestry path
    console.log('\\nAncestry Path:');
    genealogy.genealogy.ancestry_path.forEach(ancestor => {
      const gen = ancestor.generation;
      const name = ancestor.name;
      const relationship = ancestor.relationship;
      const accuracy = ancestor.metrics.accuracy;
      console.log(\`  Gen \${gen}: \${name} (\${relationship}) - Accuracy: \${accuracy.toFixed(3)}\`);
      
      if (ancestor.improvement_vs_parent) {
        const improvement = ancestor.improvement_vs_parent.accuracy;
        console.log(\`    Improvement: +\${improvement.toFixed(3)} accuracy\`);
      }
    });
    
    // Current experiment
    const current = genealogy.genealogy.current_experiment;
    console.log('\\nCurrent Experiment:');
    console.log(\`  \${current.name} (Gen \${current.generation})\`);
    console.log(\`  Accuracy: \${current.metrics.accuracy.toFixed(4)}\`);
    console.log(\`  Improvement vs Root: +\${current.improvement_vs_root.accuracy.toFixed(3)}\`);
    
    const improvementPercent = genealogy.genealogy.evolution_summary.total_improvement_vs_root.accuracy_percentage;
    console.log(\`  Improvement %: +\${improvementPercent.toFixed(1)}%\`);
    
    // Key innovations
    console.log('\\nInnovation Timeline:');
    genealogy.genealogy.evolution_summary.innovation_timeline.forEach(innovation => {
      const gen = innovation.generation;
      const innovations = innovation.innovations.join(', ');
      console.log(\`  Gen \${gen}: \${innovations}\`);
    });
    
    // Siblings
    if (genealogy.genealogy.siblings.length > 0) {
      console.log('\\nSiblings:');
      genealogy.genealogy.siblings.forEach(sibling => {
        console.log(\`  - \${sibling.name}: \${sibling.metrics.accuracy.toFixed(3)} accuracy\`);
      });
    }
    
    // Visualization links
    console.log('\\nVisualizations:');
    const viz = genealogy.visualization;
    console.log(\`  Family Tree: \${viz.family_tree_url}\`);
    console.log(\`  Timeline: \${viz.timeline_url}\`);
    console.log(\`  Metrics Evolution: \${viz.metrics_evolution_url}\`);
    
    // Insights
    const insights = genealogy.insights;
    console.log('\\nInsights:');
    console.log(\`  Best Performer: \${insights.best_performer_in_family}\`);
    console.log(\`  Most Innovative Generation: \${insights.most_innovative_generation}\`);
    console.log(\`  Pattern: \${insights.convergence_pattern}\`);
    
    console.log('\\nRecommended Next Steps:');
    insights.recommended_next_steps.forEach(step => {
      console.log(\`  - \${step}\`);
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