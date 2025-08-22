import { ApiLayout } from '@/components/ui/ApiLayout'
import { CpuChipIcon, ChartBarIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

export default function MlPipelineApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Create a new ML pipeline
curl -X POST "https://api.schlep-engine.com/api/v1/ml-pipeline/create" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Customer Churn Prediction",
    "description": "Predict customer churn using historical data",
    "model_type": "classification",
    "preprocessing_steps": ["normalize", "feature_selection"],
    "feature_columns": ["age", "tenure", "monthly_charges"],
    "target_column": "churn",
    "hyperparameters": {
      "max_depth": 10,
      "n_estimators": 100
    }
  }'

# Response
{
  "success": true,
  "message": "ML pipeline created successfully",
  "data": {
    "pipeline_id": "pipeline_abc123",
    "name": "Sales Forecasting Pipeline",
    "model_type": "regression",
    "status": "created",
    "created_at": "2024-01-20T10:30:00Z"
  }
}`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}

# Create ML pipeline
pipeline_data = {
    "name": "Sales Forecasting Pipeline",
    "model_type": "regression",
    "description": "Predict sales based on historical data",
    "data_source": "file_123456789"
}

response = requests.post(
    "https://api.schlep-engine.com/api/v1/ml-pipeline/create",
    headers=headers,
    json=pipeline_data
)

if response.status_code == 201:
    pipeline = response.json()
    pipeline_id = pipeline['data']['pipeline_id']
    print(f"✅ Pipeline created: {pipeline_id}")
    
    # Train the pipeline
    train_response = requests.post(
        f"https://api.schlep-engine.com/api/v1/ml-pipeline/{pipeline_id}/train",
        headers=headers,
        files={"file": open("training_data.csv", "rb")},
        data={"validation_split": 0.2}
    )
    
    if train_response.status_code == 200:
        print("🚀 Training started!")
    else:
        print(f"❌ Training failed: {train_response.text}")
        
else:
    print(f"❌ Pipeline creation failed: {response.text}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';

// Create ML pipeline
async function createMLPipeline() {
  try {
    const response = await fetch('https://api.schlep-engine.com/api/v1/ml-pipeline/create', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Sales Forecasting Pipeline',
        model_type: 'regression',
        description: 'Predict sales based on historical data',
        data_source: 'file_123456789'
      })
    });
    
    if (response.ok) {
      const pipeline = await response.json();
      const pipelineId = pipeline.data.pipeline_id;
      console.log(\`✅ Pipeline created: \${pipelineId}\`);
      
      // Train the pipeline
      const trainResponse = await fetch(\`https://api.schlep-engine.com/api/v1/ml-pipeline/\${pipelineId}/train\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${apiKey}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_column: 'sales_amount',
          feature_columns: ['month', 'region', 'product_category'],
          test_split: 0.2
        })
      });
      
      if (trainResponse.ok) {
        console.log('🚀 Training started!');
        return pipelineId;
      } else {
        console.error('❌ Training failed:', await trainResponse.text());
      }
      
    } else {
      console.error('❌ Pipeline creation failed:', await response.text());
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

createMLPipeline();`
    }
  ]

  return (
    <ApiLayout 
      title="ML Pipeline"
      description="Create, train, and deploy machine learning models with automated feature engineering and model selection."
      codeExamples={codeExamples}
    >
      {/* ML Pipeline Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">ML Pipeline Overview</h2>
        <p className="text-gray-600 mb-6">
          Our ML Pipeline API provides a complete machine learning workflow from data preprocessing 
          to model deployment. It automatically handles feature engineering, model selection, 
          hyperparameter tuning, and performance evaluation.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">AutoML</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Automatic model selection and hyperparameter optimization for optimal performance.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Real-time Inference</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Deploy models for real-time predictions with low-latency API endpoints.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cog6ToothIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">MLOps Ready</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Built-in monitoring, versioning, and automated retraining capabilities.
            </p>
          </div>
        </div>
      </section>

      {/* Create Pipeline */}
      <section className="mb-12" id="create-pipeline">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create ML Pipeline</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/ml-pipeline/create</code>
          </div>
          <p className="text-gray-600 mb-4">Initialize a new machine learning pipeline with your data source.</p>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">Request Body</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><code>name</code> - Pipeline name</li>
              <li><code>model_type</code> - regression, classification, or clustering</li>
              <li><code>data_source</code> - File ID from storage API</li>
              <li><code>description</code> - Optional pipeline description</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Train Pipeline */}
      <section className="mb-12" id="train-pipeline">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Train Pipeline</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/ml-pipeline/{`{pipeline_id}`}/train</code>
          </div>
          <p className="text-gray-600 mb-4">Start training your ML pipeline with specified configuration.</p>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">Request Body</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><code>target_column</code> - Column name to predict</li>
              <li><code>feature_columns</code> - Array of feature column names (optional)</li>
              <li><code>test_split</code> - Test data ratio (default: 0.2)</li>
              <li><code>cross_validation_folds</code> - CV folds (default: 5)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pipeline Status */}
      <section className="mb-12" id="pipeline-status">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Pipeline Status</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/ml-pipeline/{`{pipeline_id}`}/status</code>
          </div>
          <p className="text-gray-600 mb-4">Check the training status and performance metrics of your pipeline.</p>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">Response Example</h4>
            <pre className="text-sm text-gray-600">
{`{
  "success": true,
  "data": {
    "pipeline_id": "pipeline_abc123",
    "status": "completed",
    "model_type": "regression",
    "accuracy": 0.89,
    "training_time": 45.2,
    "metrics": {
      "rmse": 0.12,
      "mae": 0.08,
      "r2_score": 0.89
    }
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* List Pipelines */}
      <section className="mb-12" id="list-pipelines">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Pipelines</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/ml-pipeline/list</code>
          </div>
          <p className="text-gray-600 mb-4">Get a list of all your ML pipelines with their current status.</p>
        </div>
      </section>

      {/* Make Predictions */}
      <section className="mb-12" id="make-predictions">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Make Predictions</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/ml-pipeline/{`{pipeline_id}`}/predict</code>
          </div>
          <p className="text-gray-600 mb-4">Get predictions from a trained model using new data.</p>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">Request Body</h4>
            <pre className="text-sm text-gray-600">
{`{
  "pipeline_id": "pipeline_abc123",
  "data": [
    {"month": 1, "region": "north", "product_category": "electronics"},
    {"month": 2, "region": "south", "product_category": "clothing"}
  ]
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Deploy Pipeline */}
      <section className="mb-12" id="deploy-pipeline">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Deploy Pipeline</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/ml-pipeline/{`{pipeline_id}`}/deploy</code>
          </div>
          <p className="text-gray-600 mb-4">Deploy a trained pipeline for production use with real-time inference endpoints.</p>
        </div>
      </section>

      {/* Delete Pipeline */}
      <section className="mb-12" id="delete-pipeline">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete Pipeline</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/ml-pipeline/{`{pipeline_id}`}</code>
          </div>
          <p className="text-gray-600 mb-4">Delete a pipeline and all associated models and data.</p>
        </div>
      </section>
    </ApiLayout>
  )
}