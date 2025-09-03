'use client'

import { useState } from 'react'
import { BeakerIcon, RocketLaunchIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import CodeBlock from '../../../components/ui/CodeBlock'

export default function MLOptimizationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ML Model Optimization</h1>
        <p className="text-xl text-gray-600">
          Automated ML pipeline optimization with hyperparameter tuning, architecture search, and performance monitoring. 
          Achieve optimal model performance without manual experimentation.
        </p>
      </div>

      {/* AutoML Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Automated ML Pipeline</h2>
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <BeakerIcon className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Auto Feature Engineering</h3>
              <p className="text-sm text-gray-600">Automatically discover and create optimal features from raw data</p>
            </div>
            <div className="text-center">
              <RocketLaunchIcon className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Hyperparameter Tuning</h3>
              <p className="text-sm text-gray-600">RL-powered optimization of model hyperparameters</p>
            </div>
            <div className="text-center">
              <ChartBarIcon className="h-12 w-12 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Performance Monitoring</h3>
              <p className="text-sm text-gray-600">Continuous model performance tracking and alerting</p>
            </div>
          </div>
        </div>
      </section>

      {/* ML Pipeline Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">ML Optimization Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-blue-600">🔬 Algorithm Selection</h3>
            <p className="text-sm text-gray-600 mb-4">
              Automatically test and compare multiple ML algorithms to find the best performing model for your specific dataset and use case.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Gradient Boosting (XGBoost, LightGBM, CatBoost)</li>
              <li>• Neural Networks (TensorFlow, PyTorch)</li>
              <li>• Ensemble Methods (Random Forest, Extra Trees)</li>
              <li>• Linear Models (Ridge, Lasso, Elastic Net)</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-green-600">⚙️ Hyperparameter Optimization</h3>
            <p className="text-sm text-gray-600 mb-4">
              RL-powered hyperparameter tuning that learns optimal parameter combinations faster than traditional grid search.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Proximal Policy Optimization (PPO) agents</li>
              <li>• Bayesian optimization with Gaussian processes</li>
              <li>• Multi-objective optimization (accuracy + speed)</li>
              <li>• Early stopping and pruning strategies</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-purple-600">🏗️ Architecture Search</h3>
            <p className="text-sm text-gray-600 mb-4">
              Neural Architecture Search (NAS) to automatically discover optimal network architectures for deep learning models.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Automated layer configuration</li>
              <li>• Optimal activation function selection</li>
              <li>• Skip connection and residual block optimization</li>
              <li>• Hardware-aware architecture constraints</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-orange-600">📊 Feature Engineering</h3>
            <p className="text-sm text-gray-600 mb-4">
              Automated feature discovery, transformation, and selection to maximize model performance and interpretability.
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Polynomial and interaction features</li>
              <li>• Time-based feature extraction</li>
              <li>• Categorical encoding optimization</li>
              <li>• Feature selection and dimensionality reduction</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Complete ML Optimization Pipeline</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">End-to-End AutoML Example</h3>
          <p className="text-gray-600 mb-4">
            Deploy a complete ML optimization pipeline that handles feature engineering, algorithm selection, 
            hyperparameter tuning, and model deployment with just a few API calls.
          </p>
          <CodeBlock
            code={`from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_api_key")

# Start complete ML optimization pipeline
optimization_pipeline = client.ml.create_optimization_pipeline(
    dataset_id="customer_behavior_data",
    target_column="will_purchase",
    problem_type="binary_classification",
    optimization_config={
        "max_training_time_hours": 6,
        "max_model_complexity": "medium",
        "optimization_metric": "roc_auc",
        "cross_validation_folds": 5
    },
    constraints={
        "max_inference_latency_ms": 100,
        "max_model_size_mb": 50,
        "interpretability_requirement": "medium"
    },
    feature_engineering={
        "auto_feature_discovery": True,
        "polynomial_features": True,
        "time_based_features": True,
        "interaction_features": True
    },
    algorithms_to_try=[
        "gradient_boosting",
        "random_forest", 
        "neural_network",
        "linear_model",
        "ensemble"
    ]
)

print(f"Pipeline ID: ${'{'}{optimization_pipeline.id}{'}'}")
print(f"Estimated completion: ${'{'}{optimization_pipeline.estimated_completion}{'}'}")

# Monitor optimization progress
while not optimization_pipeline.is_complete():
    status = client.ml.get_pipeline_status(optimization_pipeline.id)
    print(f"Progress: ${'{'}{status.progress_percent}{'}'}%")
    print(f"Current best model: ${'{'}{status.best_model_type}{'}'} (AUC: ${'{'}{status.best_score}{'}'})")
    print(f"Features discovered: ${'{'}{len(status.engineered_features)}{'}'}")
    time.sleep(60)  # Check every minute

# Get final results
results = client.ml.get_optimization_results(optimization_pipeline.id)
print(f"\\nFinal Results:")
print(f"Best Algorithm: ${'{'}{results.best_model.algorithm}{'}'}")
print(f"Best Score: ${'{'}{results.best_model.cross_val_score}{'}'}")
print(f"Best Hyperparameters: ${'{'}{results.best_model.hyperparameters}{'}'}")
print(f"Important Features: ${'{'}{results.feature_importance[:10]}{'}'}")

# Deploy the optimized model
deployment = client.ml.deploy_model(
    model_id=results.best_model.id,
    deployment_config={
        "instance_type": "standard",
        "auto_scaling": True,
        "monitoring": True
    }
)

print(f"\\nModel deployed at: ${'{'}{deployment.endpoint_url}{'}'}")
print(f"Model performance monitoring: ${'{'}{deployment.monitoring_dashboard}{'}'}"`}
            language="python"
            title="Complete AutoML Pipeline"
            showCopyButton={true}
          />
        </div>
      </section>

      {/* Model Monitoring */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Model Performance Monitoring</h2>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
          <h3 className="font-semibold mb-3">Continuous ML Monitoring</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <h4 className="font-medium mb-2">Performance Tracking:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time prediction accuracy monitoring</li>
                <li>• Data drift detection and alerts</li>
                <li>• Feature importance tracking over time</li>
                <li>• Model performance degradation alerts</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Automated Retraining:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Scheduled model retraining pipelines</li>
                <li>• Trigger-based retraining on performance drops</li>
                <li>• A/B testing of new model versions</li>
                <li>• Rollback mechanisms for failed deployments</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Optimization Results</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Typical ML Optimization Improvements</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">23%</p>
              <p className="text-sm text-gray-600">Model Accuracy Improvement</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">85%</p>
              <p className="text-sm text-gray-600">Faster Development Time</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">67%</p>
              <p className="text-sm text-gray-600">Reduced Manual Tuning</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">92%</p>
              <p className="text-sm text-gray-600">Automated Feature Discovery</p>
            </div>
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">ML Optimization API</h2>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono">POST /api/v1/ml/optimization-pipeline</code>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">POST</span>
            </div>
            <p className="text-sm text-gray-600">Start complete ML optimization pipeline with AutoML</p>
          </div>
          
          <div className="bg-gray-50 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono">GET /api/v1/ml/pipeline-status/{'{id}'}</code>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">GET</span>
            </div>
            <p className="text-sm text-gray-600">Monitor optimization progress and current best models</p>
          </div>
          
          <div className="bg-gray-50 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono">POST /api/v1/ml/deploy-model</code>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">POST</span>
            </div>
            <p className="text-sm text-gray-600">Deploy optimized models with monitoring and auto-scaling</p>
          </div>
        </div>
      </section>
    </div>
  )
}