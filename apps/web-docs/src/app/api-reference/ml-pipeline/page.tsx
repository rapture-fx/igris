import { EndpointCard } from '@/components/ui/EndpointCard'

export default function MlPipelineApiPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ML Pipeline API</h1>
        <p className="text-xl text-gray-600">
          Advanced machine learning pipeline orchestration with automated model training, deployment, and monitoring capabilities.
        </p>
      </div>

      <div className="space-y-8">
        <EndpointCard
          method="POST"
          path="/ml-pipeline/pipelines/"
          title="Create ML Pipeline"
          description="Create a new machine learning pipeline with automated feature engineering, model selection, and hyperparameter tuning."
          parameters={[
            {
              name: "name",
              type: "string",
              required: true,
              description: "Name of the ML pipeline",
              example: "Customer Churn Prediction"
            },
            {
              name: "dataset_id",
              type: "string",
              required: true,
              description: "UUID of the dataset to train on",
              example: "550e8400-e29b-41d4-a716-446655440000"
            },
            {
              name: "target_column",
              type: "string",
              required: true,
              description: "Name of the target column for prediction",
              example: "churn_label"
            },
            {
              name: "problem_type",
              type: "string",
              required: true,
              description: "Type of ML problem: classification, regression, clustering",
              example: "classification"
            },
            {
              name: "auto_feature_engineering",
              type: "boolean",
              required: false,
              description: "Enable automated feature engineering (default: true)",
              example: "true"
            },
            {
              name: "algorithms",
              type: "array",
              required: false,
              description: "Specific algorithms to try (if not specified, auto-select)",
              example: `["random_forest", "xgboost", "neural_network"]`
            }
          ]}
          responses={[
            {
              status: 201,
              description: "ML Pipeline created successfully",
              example: `{
  "pipeline_id": "550e8400-e29b-41d4-a716-446655440004",
  "name": "Customer Churn Prediction",
  "status": "created",
  "dataset_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_column": "churn_label",
  "problem_type": "classification",
  "auto_feature_engineering": true,
  "algorithms": ["random_forest", "xgboost", "neural_network"],
  "created_at": "2024-01-15T10:30:00Z",
  "estimated_completion": "2024-01-15T11:30:00Z"
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/ml-pipeline/pipelines/ \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Customer Churn Prediction",
    "dataset_id": "550e8400-e29b-41d4-a716-446655440000",
    "target_column": "churn_label",
    "problem_type": "classification",
    "auto_feature_engineering": true,
    "algorithms": ["random_forest", "xgboost", "neural_network"]
  }'`,
            python: `import requests

pipeline_config = {
    'name': 'Customer Churn Prediction',
    'dataset_id': '550e8400-e29b-41d4-a716-446655440000',
    'target_column': 'churn_label',
    'problem_type': 'classification',
    'auto_feature_engineering': True,
    'algorithms': ['random_forest', 'xgboost', 'neural_network']
}

response = requests.post(
    'https://api.schlepengine.com/v1/ml-pipeline/pipelines/',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json=pipeline_config
)

if response.status_code == 201:
    pipeline = response.json()
    print(f"Pipeline created: {pipeline['pipeline_id']}")
    print(f"Status: {pipeline['status']}")
    print(f"Estimated completion: {pipeline['estimated_completion']}")
else:
    print(f"Error: {response.text}")`,
            javascript: `const pipelineConfig = {
  name: 'Customer Churn Prediction',
  dataset_id: '550e8400-e29b-41d4-a716-446655440000',
  target_column: 'churn_label',
  problem_type: 'classification',
  auto_feature_engineering: true,
  algorithms: ['random_forest', 'xgboost', 'neural_network']
};

fetch('https://api.schlepengine.com/v1/ml-pipeline/pipelines/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(pipelineConfig)
})
.then(response => response.json())
.then(pipeline => {
  console.log(\`Pipeline created: \${pipeline.pipeline_id}\`);
  console.log(\`Status: \${pipeline.status}\`);
  console.log(\`Estimated completion: \${pipeline.estimated_completion}\`);
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="GET"
          path="/ml-pipeline/pipelines/{pipeline_id}"
          title="Get ML Pipeline Status"
          description="Get detailed status and results of an ML pipeline including model performance metrics, feature importance, and training progress."
          parameters={[
            {
              name: "pipeline_id",
              type: "string",
              required: true,
              description: "UUID of the ML pipeline",
              example: "550e8400-e29b-41d4-a716-446655440004"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "ML Pipeline status retrieved successfully",
              example: `{
  "pipeline_id": "550e8400-e29b-41d4-a716-446655440004",
  "name": "Customer Churn Prediction",
  "status": "completed",
  "dataset_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_column": "churn_label",
  "problem_type": "classification",
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T11:15:30Z",
  "training_progress": 100,
  "best_model": {
    "algorithm": "xgboost",
    "accuracy": 0.934,
    "precision": 0.912,
    "recall": 0.889,
    "f1_score": 0.900,
    "auc_roc": 0.965,
    "hyperparameters": {
      "max_depth": 6,
      "learning_rate": 0.1,
      "n_estimators": 100
    }
  },
  "feature_importance": [
    {"feature": "monthly_charges", "importance": 0.234},
    {"feature": "total_charges", "importance": 0.187},
    {"feature": "contract_length", "importance": 0.156},
    {"feature": "customer_service_calls", "importance": 0.143},
    {"feature": "tenure_months", "importance": 0.128}
  ],
  "model_comparison": [
    {
      "algorithm": "xgboost",
      "accuracy": 0.934,
      "training_time": "00:12:45",
      "selected": true
    },
    {
      "algorithm": "random_forest",
      "accuracy": 0.921,
      "training_time": "00:08:32",
      "selected": false
    },
    {
      "algorithm": "neural_network",
      "accuracy": 0.918,
      "training_time": "00:18:23",
      "selected": false
    }
  ],
  "deployment_ready": true,
  "prediction_endpoint": "/ml-pipeline/predictions/550e8400-e29b-41d4-a716-446655440004"
}`
            }
          ]}
          examples={{
            curl: `curl -X GET https://api.schlepengine.com/v1/ml-pipeline/pipelines/550e8400-e29b-41d4-a716-446655440004 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/ml-pipeline/pipelines/550e8400-e29b-41d4-a716-446655440004',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

if response.status_code == 200:
    pipeline = response.json()
    print(f"Pipeline: {pipeline['name']} ({pipeline['status']})")
    
    if pipeline['status'] == 'completed':
        model = pipeline['best_model']
        print(f"\\nBest Model: {model['algorithm']}")
        print(f"Accuracy: {model['accuracy']:.3f}")
        print(f"F1 Score: {model['f1_score']:.3f}")
        print(f"AUC-ROC: {model['auc_roc']:.3f}")
        
        print("\\nTop 5 Features:")
        for feat in pipeline['feature_importance'][:5]:
            print(f"- {feat['feature']}: {feat['importance']:.3f}")
        
        if pipeline['deployment_ready']:
            print(f"\\nReady for deployment at: {pipeline['prediction_endpoint']}")
    else:
        print(f"Training progress: {pipeline.get('training_progress', 0)}%")
else:
    print(f"Error: {response.text}")`,
            javascript: `fetch('https://api.schlepengine.com/v1/ml-pipeline/pipelines/550e8400-e29b-41d4-a716-446655440004', {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(pipeline => {
  console.log(\`Pipeline: \${pipeline.name} (\${pipeline.status})\`);
  
  if (pipeline.status === 'completed') {
    const model = pipeline.best_model;
    console.log(\`\\nBest Model: \${model.algorithm}\`);
    console.log(\`Accuracy: \${model.accuracy.toFixed(3)}\`);
    console.log(\`F1 Score: \${model.f1_score.toFixed(3)}\`);
    console.log(\`AUC-ROC: \${model.auc_roc.toFixed(3)}\`);
    
    console.log('\\nTop 5 Features:');
    pipeline.feature_importance.slice(0, 5).forEach(feat => {
      console.log(\`- \${feat.feature}: \${feat.importance.toFixed(3)}\`);
    });
    
    if (pipeline.deployment_ready) {
      console.log(\`\\nReady for deployment at: \${pipeline.prediction_endpoint}\`);
    }
  } else {
    console.log(\`Training progress: \${pipeline.training_progress || 0}%\`);
  }
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="POST"
          path="/ml-pipeline/predictions/{pipeline_id}"
          title="Make Predictions"
          description="Make predictions using a trained ML model. Supports both single predictions and batch predictions with confidence scores."
          parameters={[
            {
              name: "pipeline_id",
              type: "string",
              required: true,
              description: "UUID of the trained ML pipeline",
              example: "550e8400-e29b-41d4-a716-446655440004"
            },
            {
              name: "features",
              type: "object",
              required: true,
              description: "Feature values for prediction (single record) or array for batch",
              example: `{"monthly_charges": 79.95, "total_charges": 1200.50, "contract_length": 12, "customer_service_calls": 2, "tenure_months": 24}`
            },
            {
              name: "return_confidence",
              type: "boolean",
              required: false,
              description: "Return confidence scores with predictions (default: true)",
              example: "true"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Predictions generated successfully",
              example: `{
  "pipeline_id": "550e8400-e29b-41d4-a716-446655440004",
  "predictions": [
    {
      "prediction": 0,
      "probability": [0.823, 0.177],
      "confidence": 0.823,
      "prediction_label": "no_churn"
    }
  ],
  "model_info": {
    "algorithm": "xgboost",
    "version": "1.0",
    "accuracy": 0.934
  },
  "processing_time_ms": 23,
  "timestamp": "2024-01-15T12:00:00Z"
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/ml-pipeline/predictions/550e8400-e29b-41d4-a716-446655440004 \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "features": {
      "monthly_charges": 79.95,
      "total_charges": 1200.50,
      "contract_length": 12,
      "customer_service_calls": 2,
      "tenure_months": 24
    },
    "return_confidence": true
  }'`,
            python: `import requests

# Single prediction
prediction_data = {
    'features': {
        'monthly_charges': 79.95,
        'total_charges': 1200.50,
        'contract_length': 12,
        'customer_service_calls': 2,
        'tenure_months': 24
    },
    'return_confidence': True
}

response = requests.post(
    'https://api.schlepengine.com/v1/ml-pipeline/predictions/550e8400-e29b-41d4-a716-446655440004',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json=prediction_data
)

if response.status_code == 200:
    result = response.json()
    prediction = result['predictions'][0]
    
    print(f"Prediction: {prediction['prediction_label']}")
    print(f"Confidence: {prediction['confidence']:.3f}")
    print(f"Probabilities: {prediction['probability']}")
    print(f"Model: {result['model_info']['algorithm']} (accuracy: {result['model_info']['accuracy']:.3f})")
    print(f"Processing time: {result['processing_time_ms']}ms")
else:
    print(f"Error: {response.text}")`,
            javascript: `const predictionData = {
  features: {
    monthly_charges: 79.95,
    total_charges: 1200.50,
    contract_length: 12,
    customer_service_calls: 2,
    tenure_months: 24
  },
  return_confidence: true
};

fetch('https://api.schlepengine.com/v1/ml-pipeline/predictions/550e8400-e29b-41d4-a716-446655440004', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(predictionData)
})
.then(response => response.json())
.then(result => {
  const prediction = result.predictions[0];
  
  console.log(\`Prediction: \${prediction.prediction_label}\`);
  console.log(\`Confidence: \${prediction.confidence.toFixed(3)}\`);
  console.log(\`Probabilities: \${prediction.probability}\`);
  console.log(\`Model: \${result.model_info.algorithm} (accuracy: \${result.model_info.accuracy.toFixed(3)})\`);
  console.log(\`Processing time: \${result.processing_time_ms}ms\`);
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="GET"
          path="/ml-pipeline/models"
          title="List Available Models"
          description="Get a list of all trained ML models with their performance metrics, deployment status, and available endpoints."
          parameters={[
            {
              name: "status",
              type: "string",
              required: false,
              description: "Filter by model status: training, completed, deployed, failed",
              example: "deployed"
            },
            {
              name: "problem_type",
              type: "string",
              required: false,
              description: "Filter by problem type: classification, regression, clustering",
              example: "classification"
            },
            {
              name: "limit",
              type: "integer",
              required: false,
              description: "Maximum number of models to return (default: 50)",
              example: "10"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Available models retrieved successfully",
              example: `{
  "models": [
    {
      "pipeline_id": "550e8400-e29b-41d4-a716-446655440004",
      "name": "Customer Churn Prediction",
      "status": "deployed",
      "problem_type": "classification",
      "algorithm": "xgboost",
      "accuracy": 0.934,
      "created_at": "2024-01-15T10:30:00Z",
      "deployed_at": "2024-01-15T11:30:00Z",
      "prediction_endpoint": "/ml-pipeline/predictions/550e8400-e29b-41d4-a716-446655440004",
      "predictions_made": 15420,
      "avg_response_time_ms": 23
    },
    {
      "pipeline_id": "550e8400-e29b-41d4-a716-446655440005",
      "name": "Sales Forecasting",
      "status": "training",
      "problem_type": "regression",
      "algorithm": null,
      "accuracy": null,
      "created_at": "2024-01-15T14:00:00Z",
      "deployed_at": null,
      "prediction_endpoint": null,
      "predictions_made": 0,
      "training_progress": 67
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}`
            }
          ]}
          examples={{
            curl: `curl -X GET "https://api.schlepengine.com/v1/ml-pipeline/models?status=deployed&limit=10" \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"`,
            python: `import requests

response = requests.get(
    'https://api.schlepengine.com/v1/ml-pipeline/models',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    params={'status': 'deployed', 'limit': 10}
)

if response.status_code == 200:
    data = response.json()
    models = data['models']
    
    print(f"Found {len(models)} models:")
    for model in models:
        print(f"\\n- {model['name']}")
        print(f"  Status: {model['status']}")
        print(f"  Algorithm: {model['algorithm'] or 'Training...'}")
        
        if model['accuracy']:
            print(f"  Accuracy: {model['accuracy']:.3f}")
        
        if model['status'] == 'deployed':
            print(f"  Predictions made: {model['predictions_made']:,}")
            print(f"  Avg response time: {model['avg_response_time_ms']}ms")
        elif model['status'] == 'training':
            print(f"  Training progress: {model.get('training_progress', 0)}%")
else:
    print(f"Error: {response.text}")`,
            javascript: `const params = new URLSearchParams({
  status: 'deployed',
  limit: '10'
});

fetch(\`https://api.schlepengine.com/v1/ml-pipeline/models?\${params}\`, {
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
  }
})
.then(response => response.json())
.then(data => {
  const models = data.models;
  
  console.log(\`Found \${models.length} models:\`);
  models.forEach(model => {
    console.log(\`\\n- \${model.name}\`);
    console.log(\`  Status: \${model.status}\`);
    console.log(\`  Algorithm: \${model.algorithm || 'Training...'}\`);
    
    if (model.accuracy) {
      console.log(\`  Accuracy: \${model.accuracy.toFixed(3)}\`);
    }
    
    if (model.status === 'deployed') {
      console.log(\`  Predictions made: \${model.predictions_made.toLocaleString()}\`);
      console.log(\`  Avg response time: \${model.avg_response_time_ms}ms\`);
    } else if (model.status === 'training') {
      console.log(\`  Training progress: \${model.training_progress || 0}%\`);
    }
  });
})
.catch(error => console.error('Error:', error));`
          }}
        />

        <EndpointCard
          method="POST"
          path="/ml-pipeline/pipelines/{pipeline_id}/deploy"
          title="Deploy Model"
          description="Deploy a trained ML model to production with automatic scaling and monitoring. Creates a real-time prediction endpoint."
          parameters={[
            {
              name: "pipeline_id",
              type: "string",
              required: true,
              description: "UUID of the completed ML pipeline to deploy",
              example: "550e8400-e29b-41d4-a716-446655440004"
            },
            {
              name: "deployment_name",
              type: "string",
              required: false,
              description: "Custom name for the deployment (defaults to pipeline name)",
              example: "churn-prediction-v1"
            },
            {
              name: "auto_scaling",
              type: "boolean",
              required: false,
              description: "Enable automatic scaling based on request volume (default: true)",
              example: "true"
            },
            {
              name: "max_replicas",
              type: "integer",
              required: false,
              description: "Maximum number of model replicas for scaling (default: 5)",
              example: "5"
            }
          ]}
          responses={[
            {
              status: 200,
              description: "Model deployed successfully",
              example: `{
  "deployment_id": "deploy_550e8400-e29b-41d4-a716-446655440004",
  "pipeline_id": "550e8400-e29b-41d4-a716-446655440004",
  "deployment_name": "churn-prediction-v1",
  "status": "deployed",
  "prediction_endpoint": "/ml-pipeline/predictions/550e8400-e29b-41d4-a716-446655440004",
  "monitoring_dashboard": "/ml-pipeline/monitoring/deploy_550e8400-e29b-41d4-a716-446655440004",
  "auto_scaling": true,
  "max_replicas": 5,
  "current_replicas": 1,
  "deployed_at": "2024-01-15T13:45:00Z",
  "health_status": "healthy"
}`
            }
          ]}
          examples={{
            curl: `curl -X POST https://api.schlepengine.com/v1/ml-pipeline/pipelines/550e8400-e29b-41d4-a716-446655440004/deploy \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "deployment_name": "churn-prediction-v1",
    "auto_scaling": true,
    "max_replicas": 5
  }'`,
            python: `import requests

deployment_config = {
    'deployment_name': 'churn-prediction-v1',
    'auto_scaling': True,
    'max_replicas': 5
}

response = requests.post(
    'https://api.schlepengine.com/v1/ml-pipeline/pipelines/550e8400-e29b-41d4-a716-446655440004/deploy',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json=deployment_config
)

if response.status_code == 200:
    deployment = response.json()
    print(f"Deployment successful: {deployment['deployment_name']}")
    print(f"Status: {deployment['status']}")
    print(f"Prediction endpoint: {deployment['prediction_endpoint']}")
    print(f"Monitoring dashboard: {deployment['monitoring_dashboard']}")
    print(f"Current replicas: {deployment['current_replicas']}")
    print(f"Health status: {deployment['health_status']}")
else:
    print(f"Error: {response.text}")`,
            javascript: `const deploymentConfig = {
  deployment_name: 'churn-prediction-v1',
  auto_scaling: true,
  max_replicas: 5
};

fetch('https://api.schlepengine.com/v1/ml-pipeline/pipelines/550e8400-e29b-41d4-a716-446655440004/deploy', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(deploymentConfig)
})
.then(response => response.json())
.then(deployment => {
  console.log(\`Deployment successful: \${deployment.deployment_name}\`);
  console.log(\`Status: \${deployment.status}\`);
  console.log(\`Prediction endpoint: \${deployment.prediction_endpoint}\`);
  console.log(\`Monitoring dashboard: \${deployment.monitoring_dashboard}\`);
  console.log(\`Current replicas: \${deployment.current_replicas}\`);
  console.log(\`Health status: \${deployment.health_status}\`);
})
.catch(error => console.error('Error:', error));`
          }}
        />
      </div>
    </div>
  )
}