'use client'

import Link from 'next/link'
import { CpuChipIcon, BeakerIcon, CloudIcon, ChartBarIcon, CodeBracketIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function MLOpsSetupTutorial() {
  const [activeTab, setActiveTab] = useState('overview')

  const codeExamples = {
    environment: `# requirements.txt
schlep-engine>=2.0.0
pandas>=1.5.0
numpy>=1.20.0
scikit-learn>=1.1.0
torch>=1.12.0  # or tensorflow>=2.9.0
mlflow>=2.0.0
jupyter>=1.0.0

# .env
SCHLEP_ENGINE_API_KEY=your_api_key_here
SCHLEP_ENGINE_ENV=production
MLFLOW_TRACKING_URI=https://api.schlep-engine.com/mlflow
EXPERIMENT_NAME=my_ml_project`,

    client: `from schlep_engine import SchlepClient
import mlflow
import os

# Initialize Schlep Engine client
client = SchlepClient(
    api_key=os.getenv('SCHLEP_ENGINE_API_KEY'),
    environment=os.getenv('SCHLEP_ENGINE_ENV', 'sandbox')
)

# Configure MLflow integration
mlflow.set_tracking_uri(os.getenv('MLFLOW_TRACKING_URI'))
mlflow.set_experiment(os.getenv('EXPERIMENT_NAME'))

# Verify connection
status = client.health_check()
print(f"Schlep Engine Status: {status}")

# Test MLOps platform access
mlops_status = client.mlops.get_platform_status()
print(f"MLOps Platform: {mlops_status}")`,

    experiment: `import mlflow
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score
import pandas as pd
import numpy as np

# Start MLflow experiment run
with mlflow.start_run() as run:
    # Log experiment parameters
    params = {
        "n_estimators": 100,
        "max_depth": 10,
        "random_state": 42,
        "test_size": 0.2
    }
    mlflow.log_params(params)
    
    # Load and prepare data (example with iris dataset)
    from sklearn.datasets import load_iris
    data = load_iris()
    X, y = data.data, data.target
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=params["test_size"], 
        random_state=params["random_state"]
    )
    
    # Train model
    model = RandomForestClassifier(
        n_estimators=params["n_estimators"],
        max_depth=params["max_depth"],
        random_state=params["random_state"]
    )
    model.fit(X_train, y_train)
    
    # Make predictions
    y_pred = model.predict(X_test)
    
    # Calculate and log metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted')
    recall = recall_score(y_test, y_pred, average='weighted')
    
    metrics = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall
    }
    mlflow.log_metrics(metrics)
    
    # Log model
    mlflow.sklearn.log_model(
        model, 
        "random_forest_model",
        registered_model_name="iris_classifier"
    )
    
    # Log artifacts (feature importance plot)
    import matplotlib.pyplot as plt
    
    plt.figure(figsize=(10, 6))
    feature_names = data.feature_names
    importances = model.feature_importances_
    plt.bar(feature_names, importances)
    plt.title('Feature Importance')
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('feature_importance.png')
    mlflow.log_artifact('feature_importance.png')
    
    print(f"Experiment run ID: {run.info.run_id}")
    print(f"Model accuracy: {accuracy:.3f}")`,

    deployment: `# Deploy model using Schlep Engine
from schlep_engine import SchlepClient
import mlflow

client = SchlepClient()

# Get the best model from experiments
experiment = mlflow.get_experiment_by_name("my_ml_project")
runs = mlflow.search_runs(
    experiment_ids=[experiment.experiment_id],
    order_by=["metrics.accuracy DESC"],
    max_results=1
)

best_run_id = runs.iloc[0]['run_id']
model_uri = f"runs:/{best_run_id}/random_forest_model"

# Register model in Schlep Engine Model Registry
model_version = client.models.register(
    name="iris_classifier",
    version="1.0.0",
    model_uri=model_uri,
    framework="scikit-learn",
    description="Random Forest classifier for iris species prediction",
    tags=["classification", "iris", "random_forest"],
    metadata={
        "training_accuracy": runs.iloc[0]['metrics.accuracy'],
        "training_date": runs.iloc[0]['start_time'],
        "features": ["sepal_length", "sepal_width", "petal_length", "petal_width"]
    }
)

print(f"Model registered with ID: {model_version.model_id}")

# Deploy to staging environment
staging_deployment = client.deployments.create(
    model_version_id=model_version.model_id,
    environment="staging",
    deployment_name="iris-classifier-staging",
    scaling_config={
        "min_replicas": 1,
        "max_replicas": 3,
        "target_cpu_utilization": 60
    },
    health_check_config={
        "endpoint": "/health",
        "timeout_seconds": 30,
        "interval_seconds": 10
    }
)

print(f"Staging deployment created: {staging_deployment.endpoint_url}")

# Test the deployment
test_data = [[5.1, 3.5, 1.4, 0.2]]  # Sample iris data
prediction = client.predict(
    deployment_id=staging_deployment.deployment_id,
    data={"features": test_data}
)

print(f"Test prediction: {prediction}")

# If staging tests pass, deploy to production
if prediction['status'] == 'success':
    production_deployment = client.deployments.create(
        model_version_id=model_version.model_id,
        environment="production",
        deployment_name="iris-classifier-prod",
        scaling_config={
            "min_replicas": 2,
            "max_replicas": 10,
            "target_cpu_utilization": 70
        },
        monitoring_config={
            "enable_drift_detection": True,
            "performance_alerts": True,
            "log_predictions": True
        }
    )
    
    print(f"Production deployment: {production_deployment.endpoint_url}")`,

    monitoring: `# Set up model monitoring and drift detection
from schlep_engine import SchlepClient
import pandas as pd

client = SchlepClient()

# Configure monitoring for production deployment
monitoring_config = client.monitoring.setup_model_monitoring(
    deployment_id="iris-classifier-prod",
    metrics=[
        {
            "name": "prediction_accuracy",
            "type": "performance",
            "threshold": 0.85,
            "alert_on": "below"
        },
        {
            "name": "response_latency",
            "type": "operational",
            "threshold": 500,  # milliseconds
            "alert_on": "above"
        },
        {
            "name": "feature_drift",
            "type": "drift",
            "method": "kolmogorov_smirnov",
            "threshold": 0.05,
            "reference_window": "7d"
        }
    ],
    alert_channels=[
        {
            "type": "email",
            "recipients": ["ml-team@company.com"]
        },
        {
            "type": "webhook",
            "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
        }
    ]
)

# Set up automated retraining pipeline
retraining_config = client.retraining.configure_pipeline(
    model_name="iris_classifier",
    trigger_conditions=[
        {
            "type": "performance_degradation",
            "metric": "accuracy",
            "threshold": 0.8
        },
        {
            "type": "drift_detection",
            "drift_score": 0.1
        },
        {
            "type": "schedule",
            "cron": "0 2 * * 0"  # Weekly on Sunday at 2 AM
        }
    ],
    retraining_config={
        "data_source": "production_logs",
        "validation_split": 0.2,
        "approval_required": True,
        "auto_deploy_threshold": 0.05  # Deploy if 5% improvement
    }
)

print(f"Monitoring configured: {monitoring_config.monitoring_id}")
print(f"Retraining pipeline: {retraining_config.pipeline_id}")

# Check model health dashboard
dashboard_url = client.monitoring.get_dashboard_url(
    deployment_id="iris-classifier-prod"
)
print(f"Monitor your model at: {dashboard_url}")`
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: CpuChipIcon },
    { id: 'environment', name: 'Environment', icon: CodeBracketIcon },
    { id: 'experiments', name: 'Experiments', icon: BeakerIcon },
    { id: 'deployment', name: 'Deployment', icon: CloudIcon },
    { id: 'monitoring', name: 'Monitoring', icon: ChartBarIcon }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <CpuChipIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">MLOps Platform Setup Tutorial</h1>
        </div>
        <p className="text-xl text-gray-600">
          Complete guide to setting up a production-ready MLOps workflow with Schlep Engine. 
          From experiment tracking to automated deployment and monitoring.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What You'll Build</h2>
              <p className="text-gray-700 mb-4">
                In this tutorial, you'll create a complete MLOps pipeline that includes:
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-blue-900">Experiment Management</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Parameter and metric tracking</li>
                    <li>• Model versioning and comparison</li>
                    <li>• Artifact storage and organization</li>
                    <li>• Hyperparameter optimization</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-blue-900">Production Deployment</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Automated model serving</li>
                    <li>• A/B testing and canary deployments</li>
                    <li>• Auto-scaling and load balancing</li>
                    <li>• Health monitoring and alerting</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <BeakerIcon className="h-8 w-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Experiment Tracking</h3>
                <p className="text-sm text-gray-600">
                  Track experiments, compare models, and manage the complete ML lifecycle with integrated MLflow support.
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <CloudIcon className="h-8 w-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Model Serving</h3>
                <p className="text-sm text-gray-600">
                  Deploy models with automatic scaling, load balancing, and zero-downtime updates.
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <ChartBarIcon className="h-8 w-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Monitoring</h3>
                <p className="text-sm text-gray-600">
                  Monitor model performance, detect drift, and trigger automated retraining pipelines.
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Prerequisites</h3>
              <ul className="space-y-1 text-sm text-yellow-700">
                <li>• Python 3.8+ or Node.js 16+</li>
                <li>• Basic knowledge of machine learning concepts</li>
                <li>• Schlep Engine API key (get one from the <Link href="/getting-started/ai-company" className="underline">quick start guide</Link>)</li>
                <li>• Familiarity with scikit-learn or PyTorch/TensorFlow</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'environment' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Environment Setup</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Install Dependencies</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.environment}
              </pre>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Initialize Client</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.client}
              </pre>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Environment Configuration Tips</h3>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>• Use environment variables for API keys (never hardcode them)</li>
                <li>• Set up separate environments for development, staging, and production</li>
                <li>• Configure MLflow tracking URI to use Schlep Engine's managed service</li>
                <li>• Use virtual environments to avoid dependency conflicts</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'experiments' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Experiment Tracking</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Experiment Example</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.experiment}
              </pre>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Experiment Best Practices</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Log all hyperparameters consistently</li>
                  <li>• Track both training and validation metrics</li>
                  <li>• Save model artifacts and visualizations</li>
                  <li>• Use meaningful experiment and run names</li>
                  <li>• Tag experiments for easy organization</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Tracked Metrics</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Performance:</strong> Accuracy, precision, recall, F1</li>
                  <li>• <strong>Loss:</strong> Training and validation loss curves</li>
                  <li>• <strong>Resources:</strong> Training time, memory usage</li>
                  <li>• <strong>Custom:</strong> Domain-specific metrics</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deployment' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Model Deployment</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Deploy Your Best Model</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.deployment}
              </pre>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-3">Deployment Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-green-800 mb-2">Scaling</h4>
                  <ul className="space-y-1 text-sm text-green-700">
                    <li>• Auto-scaling based on CPU/memory</li>
                    <li>• Min/max replica configuration</li>
                    <li>• Load balancing across instances</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-green-800 mb-2">Reliability</h4>
                  <ul className="space-y-1 text-sm text-green-700">
                    <li>• Health checks and auto-recovery</li>
                    <li>• Rolling updates with zero downtime</li>
                    <li>• A/B testing and canary deployments</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Model Monitoring & Retraining</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Up Comprehensive Monitoring</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.monitoring}
              </pre>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Performance Monitoring</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Model accuracy tracking</li>
                  <li>• Response latency monitoring</li>
                  <li>• Throughput and error rates</li>
                  <li>• Resource utilization</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Data Drift Detection</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Feature drift monitoring</li>
                  <li>• Statistical tests (KS, PSI)</li>
                  <li>• Concept drift detection</li>
                  <li>• Automated alerts</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Automated Retraining</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Triggered by performance drop</li>
                  <li>• Scheduled retraining jobs</li>
                  <li>• Data validation pipelines</li>
                  <li>• Approval workflows</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-100">
        <div className="flex items-center space-x-3 mb-4">
          <PlayCircleIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Next Steps</h2>
        </div>
        <p className="text-gray-600 mb-6">
          You've built a complete MLOps pipeline! Now explore advanced features and real-world examples.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/examples/ai-company" className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Production Examples</h3>
            <p className="text-sm text-gray-600">Real-world MLOps implementations</p>
          </Link>
          <Link href="/guides/mlops-workflows" className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Best Practices</h3>
            <p className="text-sm text-gray-600">MLOps workflow optimization</p>
          </Link>
          <Link href="/api-reference/mlops" className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-sm text-gray-600">Complete MLOps API docs</p>
          </Link>
        </div>
      </div>
    </div>
  )
}