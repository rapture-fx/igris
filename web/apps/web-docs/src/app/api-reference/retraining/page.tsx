'use client'

import React from 'react'
import { EndpointCard } from '../../../components/ui/EndpointCard'

export default function AutomatedRetrainingPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Automated Model Retraining API</h1>
        <p className="text-gray-600 text-lg">
          Automated machine learning model retraining, performance monitoring, and deployment pipelines for continuous model improvement.
        </p>
      </div>

      <EndpointCard
        method="POST"
        path="/api/v1/retraining/jobs"
        title="Create Retraining Job"
        description="Initiate an automated retraining job for a machine learning model with new data."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model identifier to retrain"
          },
          {
            name: "training_config",
            type: "object",
            required: true,
            description: "Training configuration and parameters"
          },
          {
            name: "data_source",
            type: "object",
            required: true,
            description: "New training data source configuration"
          },
          {
            name: "trigger_conditions",
            type: "object",
            required: false,
            description: "Conditions that triggered the retraining"
          },
          {
            name: "deployment_strategy",
            type: "string",
            required: false,
            description: "Deployment strategy (manual, automatic, canary)"
          }
        ]}
        responses={[
          {
            status: 202,
            description: 'Retraining job created successfully',
            example: JSON.stringify({
              "job_id": "retrain_job_abc123",
              "model_id": "fraud_detection_v2",
              "status": "queued",
              "created_at": "2024-01-15T10:00:00Z",
              "estimated_duration": "45 minutes",
              "training_config": {
                "algorithm": "xgboost",
                "hyperparameters": {
                  "max_depth": 6,
                  "learning_rate": 0.1,
                  "n_estimators": 100
                },
                "validation_split": 0.2
              },
              "data_source": {
                "type": "incremental",
                "new_samples": 15420,
                "date_range": "2024-01-01 to 2024-01-14"
              },
              "monitoring_url": "/api/v1/retraining/jobs/retrain_job_abc123/status"
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/retraining/jobs" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "fraud_detection_v2",
    "training_config": {
      "algorithm": "xgboost",
      "hyperparameters": {
        "max_depth": 6,
        "learning_rate": 0.1,
        "n_estimators": 100
      },
      "validation_split": 0.2
    },
    "data_source": {
      "type": "incremental",
      "dataset_id": "fraud_data_2024_q1",
      "filters": {
        "date_from": "2024-01-01",
        "date_to": "2024-01-14"
      }
    },
    "deployment_strategy": "canary"
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/retraining/jobs",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "model_id": "fraud_detection_v2",
        "training_config": {
            "algorithm": "xgboost",
            "hyperparameters": {
                "max_depth": 6,
                "learning_rate": 0.1,
                "n_estimators": 100
            },
            "validation_split": 0.2
        },
        "data_source": {
            "type": "incremental",
            "dataset_id": "fraud_data_2024_q1",
            "filters": {
                "date_from": "2024-01-01",
                "date_to": "2024-01-14"
            }
        },
        "deployment_strategy": "canary"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/retraining/jobs', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model_id: 'fraud_detection_v2',
    training_config: {
      algorithm: 'xgboost',
      hyperparameters: {
        max_depth: 6,
        learning_rate: 0.1,
        n_estimators: 100
      },
      validation_split: 0.2
    },
    data_source: {
      type: 'incremental',
      dataset_id: 'fraud_data_2024_q1',
      filters: {
        date_from: '2024-01-01',
        date_to: '2024-01-14'
      }
    },
    deployment_strategy: 'canary'
  })
});
const job = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/retraining/jobs/{job_id}/status"
        title="Get Retraining Job Status"
        description="Monitor the progress and status of an automated retraining job."
        parameters={[
          {
            name: "job_id",
            type: "string",
            required: true,
            description: "Retraining job identifier"
          },
          {
            name: "include_metrics",
            type: "boolean",
            required: false,
            description: "Include detailed training metrics"
          },
          {
            name: "include_logs",
            type: "boolean",
            required: false,
            description: "Include training logs"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Job status retrieved successfully',
            example: JSON.stringify({
              "job_id": "retrain_job_abc123",
              "model_id": "fraud_detection_v2",
              "status": "training",
              "progress": 0.65,
              "started_at": "2024-01-15T10:05:00Z",
              "estimated_completion": "2024-01-15T10:40:00Z",
              "current_stage": "hyperparameter_tuning",
              "stages_completed": [
                "data_validation",
                "feature_engineering",
                "data_preprocessing"
              ],
              "training_metrics": {
                "current_epoch": 65,
                "total_epochs": 100,
                "current_loss": 0.0245,
                "best_validation_score": 0.945,
                "early_stopping_patience": 10
              },
              "resource_usage": {
                "cpu_utilization": 0.78,
                "memory_usage_gb": 4.2,
                "gpu_utilization": 0.92
              },
              "comparison_with_current": {
                "current_model_score": 0.928,
                "new_model_score": 0.945,
                "improvement": 0.017,
                "performance_gain": "1.7%"
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/retraining/jobs/retrain_job_abc123/status?include_metrics=true" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/retraining/jobs/retrain_job_abc123/status",
    headers={"Authorization": f"Bearer {api_key}"},
    params={
        "include_metrics": True,
        "include_logs": False
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/retraining/jobs/retrain_job_abc123/status?include_metrics=true', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const status = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/retraining/schedules"
        title="Create Retraining Schedule"
        description="Set up automated retraining schedules based on time intervals or performance thresholds."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model identifier for scheduled retraining"
          },
          {
            name: "schedule_config",
            type: "object",
            required: true,
            description: "Schedule configuration and triggers"
          },
          {
            name: "performance_thresholds",
            type: "object",
            required: false,
            description: "Performance-based trigger thresholds"
          },
          {
            name: "data_requirements",
            type: "object",
            required: false,
            description: "Minimum data requirements for retraining"
          }
        ]}
        responses={[
          {
            status: 201,
            description: 'Retraining schedule created successfully',
            example: JSON.stringify({
              "schedule_id": "schedule_fraud_weekly",
              "model_id": "fraud_detection_v2",
              "status": "active",
              "created_at": "2024-01-15T10:00:00Z",
              "schedule_config": {
                "type": "hybrid",
                "time_based": {
                  "frequency": "weekly",
                  "day_of_week": "sunday",
                  "time": "02:00:00"
                },
                "performance_based": {
                  "accuracy_threshold": 0.92,
                  "drift_threshold": 0.15,
                  "min_samples": 1000
                }
              },
              "next_scheduled_run": "2024-01-21T02:00:00Z",
              "last_triggered": null,
              "trigger_history": [],
              "deployment_config": {
                "strategy": "canary",
                "rollback_on_performance_drop": true,
                "approval_required": false
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/retraining/schedules" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "fraud_detection_v2",
    "schedule_config": {
      "type": "hybrid",
      "time_based": {
        "frequency": "weekly",
        "day_of_week": "sunday",
        "time": "02:00:00"
      },
      "performance_based": {
        "accuracy_threshold": 0.92,
        "drift_threshold": 0.15,
        "min_samples": 1000
      }
    },
    "data_requirements": {
      "min_new_samples": 500,
      "max_age_days": 30
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/retraining/schedules",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "model_id": "fraud_detection_v2",
        "schedule_config": {
            "type": "hybrid",
            "time_based": {
                "frequency": "weekly",
                "day_of_week": "sunday",
                "time": "02:00:00"
            },
            "performance_based": {
                "accuracy_threshold": 0.92,
                "drift_threshold": 0.15,
                "min_samples": 1000
            }
        },
        "data_requirements": {
            "min_new_samples": 500,
            "max_age_days": 30
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/retraining/schedules', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model_id: 'fraud_detection_v2',
    schedule_config: {
      type: 'hybrid',
      time_based: {
        frequency: 'weekly',
        day_of_week: 'sunday',
        time: '02:00:00'
      },
      performance_based: {
        accuracy_threshold: 0.92,
        drift_threshold: 0.15,
        min_samples: 1000
      }
    },
    data_requirements: {
      min_new_samples: 500,
      max_age_days: 30
    }
  })
});
const schedule = await response.json();`
        }}
      />

      <EndpointCard
        method="GET"
        path="/api/v1/retraining/models/{model_id}/performance-drift"
        title="Monitor Performance Drift"
        description="Monitor model performance drift and data distribution changes over time."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model identifier"
          },
          {
            name: "time_window",
            type: "string",
            required: false,
            description: "Analysis time window (1w, 2w, 1m, 3m)"
          },
          {
            name: "drift_metrics",
            type: "array",
            required: false,
            description: "Specific drift metrics to calculate"
          },
          {
            name: "baseline_period",
            type: "string",
            required: false,
            description: "Baseline period for comparison"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Performance drift analysis completed',
            example: JSON.stringify({
              "model_id": "fraud_detection_v2",
              "analysis_period": "2024-01-01 to 2024-01-15",
              "baseline_period": "2023-12-01 to 2023-12-31",
              "drift_summary": {
                "overall_drift_score": 0.18,
                "drift_severity": "moderate",
                "recommendation": "Schedule retraining within 1 week"
              },
              "performance_metrics": {
                "current_accuracy": 0.924,
                "baseline_accuracy": 0.945,
                "accuracy_decline": -0.021,
                "current_precision": 0.918,
                "current_recall": 0.932,
                "current_f1_score": 0.925
              },
              "data_drift": {
                "feature_drift": [
                  {
                    "feature_name": "transaction_amount",
                    "drift_score": 0.23,
                    "drift_type": "distribution_shift",
                    "severity": "high"
                  },
                  {
                    "feature_name": "merchant_category",
                    "drift_score": 0.08,
                    "drift_type": "categorical_shift",
                    "severity": "low"
                  }
                ],
                "target_drift": {
                  "fraud_rate": {
                    "baseline": 0.023,
                    "current": 0.031,
                    "change": 0.008,
                    "significance": "moderate"
                  }
                }
              },
              "prediction_intervals": [
                {
                  "date": "2024-01-15",
                  "accuracy": 0.924,
                  "confidence_interval": [0.918, 0.930]
                }
              ],
              "recommended_actions": [
                "Immediate feature importance analysis required",
                "Review transaction_amount feature engineering",
                "Schedule retraining with recent data"
              ]
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X GET "https://api.schlep-engine.com/api/v1/retraining/models/fraud_detection_v2/performance-drift?time_window=2w" \\
  -H "Authorization: Bearer $API_KEY"`,
          python: `import requests

response = requests.get(
    "https://api.schlep-engine.com/api/v1/retraining/models/fraud_detection_v2/performance-drift",
    headers={"Authorization": f"Bearer {api_key}"},
    params={
        "time_window": "2w",
        "drift_metrics": ["accuracy", "precision", "feature_drift"],
        "baseline_period": "1m"
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/retraining/models/fraud_detection_v2/performance-drift?time_window=2w', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});
const driftAnalysis = await response.json();`
        }}
      />

      <EndpointCard
        method="POST"
        path="/api/v1/retraining/models/{model_id}/deploy"
        title="Deploy Retrained Model"
        description="Deploy a successfully retrained model to production with rollback capabilities."
        parameters={[
          {
            name: "model_id",
            type: "string",
            required: true,
            description: "Model identifier"
          },
          {
            name: "job_id",
            type: "string",
            required: true,
            description: "Retraining job identifier"
          },
          {
            name: "deployment_config",
            type: "object",
            required: true,
            description: "Deployment configuration"
          },
          {
            name: "rollback_criteria",
            type: "object",
            required: false,
            description: "Automatic rollback criteria"
          }
        ]}
        responses={[
          {
            status: 200,
            description: 'Model deployment initiated successfully',
            example: JSON.stringify({
              "deployment_id": "deploy_fraud_v3_001",
              "model_id": "fraud_detection_v2",
              "new_version": "v3.1.0",
              "previous_version": "v3.0.2",
              "deployment_strategy": "canary",
              "status": "deploying",
              "started_at": "2024-01-15T10:00:00Z",
              "estimated_completion": "2024-01-15T10:15:00Z",
              "traffic_allocation": {
                "new_model": 10,
                "current_model": 90
              },
              "monitoring_period": "24h",
              "success_criteria": {
                "min_accuracy": 0.92,
                "max_latency_ms": 100,
                "error_rate_threshold": 0.01
              },
              "rollback_config": {
                "auto_rollback_enabled": true,
                "performance_threshold": 0.90,
                "error_rate_threshold": 0.05,
                "monitoring_window": "1h"
              },
              "endpoints": {
                "canary": "https://api.schlep-engine.com/v1/predict-canary",
                "production": "https://api.schlep-engine.com/v1/predict"
              }
            }, null, 2)
          }
        ]}
        examples={{
          curl: `curl -X POST "https://api.schlep-engine.com/api/v1/retraining/models/fraud_detection_v2/deploy" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "retrain_job_abc123",
    "deployment_config": {
      "strategy": "canary",
      "traffic_percentage": 10,
      "monitoring_period": "24h",
      "auto_promote": false
    },
    "rollback_criteria": {
      "accuracy_threshold": 0.90,
      "latency_threshold_ms": 100,
      "error_rate_threshold": 0.05
    }
  }'`,
          python: `import requests

response = requests.post(
    "https://api.schlep-engine.com/api/v1/retraining/models/fraud_detection_v2/deploy",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "job_id": "retrain_job_abc123",
        "deployment_config": {
            "strategy": "canary",
            "traffic_percentage": 10,
            "monitoring_period": "24h",
            "auto_promote": False
        },
        "rollback_criteria": {
            "accuracy_threshold": 0.90,
            "latency_threshold_ms": 100,
            "error_rate_threshold": 0.05
        }
    }
)
print(response.json())`,
          javascript: `const response = await fetch('https://api.schlep-engine.com/api/v1/retraining/models/fraud_detection_v2/deploy', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    job_id: 'retrain_job_abc123',
    deployment_config: {
      strategy: 'canary',
      traffic_percentage: 10,
      monitoring_period: '24h',
      auto_promote: false
    },
    rollback_criteria: {
      accuracy_threshold: 0.90,
      latency_threshold_ms: 100,
      error_rate_threshold: 0.05
    }
  })
});
const deployment = await response.json();`
        }}
      />
    </div>
  )
}