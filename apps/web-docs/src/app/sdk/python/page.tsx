'use client'

import { useState } from 'react'
import { CodeBlock } from '../../../components/ui/CodeBlock'
import { CommandLineIcon, CpuChipIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function PythonSDKPage() {
  const [activeSection, setActiveSection] = useState('installation')

  const sections = {
    installation: {
      title: 'Installation & Setup',
      icon: CommandLineIcon,
      content: `# Schlep Engine Python SDK

## Installation

Install the Schlep Engine Python SDK using pip:

\`\`\`bash
pip install schlep-engine
\`\`\`

For development with all optional dependencies:

\`\`\`bash
pip install "schlep-engine[dev,ml,manufacturing]"
\`\`\`

## Authentication

Set up your API credentials:

\`\`\`python
import os
from schlep_engine import SchlepEngine

# Method 1: Environment variable (recommended)
os.environ['SCHLEP_API_KEY'] = 'your_api_key_here'
client = SchlepEngine()

# Method 2: Direct instantiation
client = SchlepEngine(api_key='your_api_key_here')

# Method 3: Configuration file
client = SchlepEngine.from_config('~/.schlep/config.yaml')
\`\`\`

## Configuration File Format

Create \`~/.schlep/config.yaml\`:

\`\`\`yaml
api_key: your_api_key_here
base_url: https://api.schlep-engine.com
timeout: 30
retry_attempts: 3
log_level: INFO

# Environment-specific settings
environments:
  production:
    api_key: prod_key_here
    base_url: https://api.schlep-engine.com
  staging:
    api_key: staging_key_here
    base_url: https://staging-api.schlep-engine.com
\`\`\`

## Basic Usage

\`\`\`python
from schlep_engine import SchlepEngine

# Initialize client
client = SchlepEngine()

# Check API status
status = client.health_check()
print(f"API Status: {status}")

# List available modules
modules = client.list_modules()
for module in modules:
    print(f"Module: {module['name']} - {module['description']}")
\`\`\``
    },
    mlops: {
      title: 'MLOps Integration',
      icon: CpuChipIcon,
      content: `# MLOps Platform SDK

## Creating ML Pipelines

\`\`\`python
from schlep_engine import MLOps
import pandas as pd

# Initialize MLOps client
mlops = MLOps(api_key='your_api_key')

# Upload dataset
dataset = pd.read_csv('sales_data.csv')
dataset_info = mlops.datasets.upload(
    data=dataset,
    name='sales_forecast_data',
    description='Historical sales data for forecasting'
)

# Create ML pipeline
pipeline = mlops.pipelines.create(
    name='sales_forecasting_pipeline',
    model_type='regression',
    data_source=dataset_info['dataset_id']
)

print(f"Pipeline created: {pipeline['pipeline_id']}")
\`\`\`

## Training Models

\`\`\`python
# Configure and start training
training_config = {
    'target_column': 'sales_amount',
    'feature_columns': ['month', 'region', 'product_category'],
    'test_split': 0.2,
    'cross_validation_folds': 5,
    'hyperparameter_optimization': True
}

training_job = mlops.pipelines.train(
    pipeline_id=pipeline['pipeline_id'],
    config=training_config
)

# Monitor training progress
import time
while training_job['status'] in ['pending', 'running']:
    time.sleep(10)
    training_job = mlops.pipelines.get_status(training_job['job_id'])
    print(f"Training progress: {training_job.get('progress', 0)}%")

print(f"Training completed with accuracy: {training_job['metrics']['accuracy']}")
\`\`\`

## Making Predictions

\`\`\`python
# Make single prediction
prediction = mlops.pipelines.predict(
    pipeline_id=pipeline['pipeline_id'],
    data={
        'month': 3,
        'region': 'north',
        'product_category': 'electronics'
    }
)

print(f"Predicted sales: \${prediction['prediction']:.2f}")
print(f"Confidence: {prediction['confidence']:.2%}")

# Batch predictions
batch_data = [
    {'month': 3, 'region': 'north', 'product_category': 'electronics'},
    {'month': 3, 'region': 'south', 'product_category': 'clothing'},
    {'month': 4, 'region': 'east', 'product_category': 'electronics'}
]

batch_predictions = mlops.pipelines.predict_batch(
    pipeline_id=pipeline['pipeline_id'],
    data=batch_data
)

for i, pred in enumerate(batch_predictions['predictions']):
    print(f"Sample {i+1}: \${pred['prediction']:.2f} (confidence: {pred['confidence']:.2%})")
\`\`\`

## Experiment Tracking

\`\`\`python
# Create experiment
experiment = mlops.experiments.create(
    name='sales_forecasting_v2',
    description='Improved sales forecasting with feature engineering'
)

# Log hyperparameters
mlops.experiments.log_params(
    experiment_id=experiment['experiment_id'],
    params={
        'learning_rate': 0.01,
        'n_estimators': 100,
        'max_depth': 8,
        'feature_selection': 'recursive'
    }
)

# Log metrics during training
for epoch in range(100):
    # Your training code here
    train_loss = your_training_step()
    val_loss = your_validation_step()
    
    mlops.experiments.log_metrics(
        experiment_id=experiment['experiment_id'],
        step=epoch,
        metrics={
            'train_loss': train_loss,
            'val_loss': val_loss
        }
    )

# Log model artifacts
mlops.experiments.log_artifact(
    experiment_id=experiment['experiment_id'],
    artifact_path='model.pkl',
    artifact_type='model'
)
\`\`\`

## Model Serving

\`\`\`python
# Deploy model for serving
deployment = mlops.serving.deploy(
    model_id=training_job['model_id'],
    deployment_config={
        'instance_type': 't3.medium',
        'min_replicas': 1,
        'max_replicas': 10,
        'auto_scaling': True
    }
)

# Test deployed model
response = mlops.serving.predict(
    deployment_id=deployment['deployment_id'],
    data={'month': 5, 'region': 'west', 'product_category': 'home'}
)

print(f"Served prediction: \${response['prediction']:.2f}")
\`\`\``
    },
    manufacturing: {
      title: 'Manufacturing Integration',
      icon: CogIcon,
      content: `# Manufacturing SDK Integration

## IoT Data Collection

\`\`\`python
from schlep_engine import ManufacturingIoT
import asyncio

# Initialize IoT client
iot = ManufacturingIoT(api_key='your_api_key')

# Connect to OPC-UA server
async def connect_to_equipment():
    config = {
        'protocol': 'opc_ua',
        'endpoint': 'opc.tcp://192.168.1.100:4840',
        'equipment_id': 'cnc_mill_001',
        'sensor_mapping': [
            {'node_id': 'ns=2;s=Temperature', 'parameter': 'spindle_temp'},
            {'node_id': 'ns=2;s=Vibration', 'parameter': 'vibration'},
            {'node_id': 'ns=2;s=Power', 'parameter': 'power_consumption'}
        ]
    }
    
    connection = await iot.connect_opc_ua(config)
    return connection

# Real-time data streaming
async def stream_sensor_data():
    connection = await connect_to_equipment()
    
    async for data_point in connection.stream():
        print(f"Equipment: {data_point['equipment_id']}")
        print(f"Timestamp: {data_point['timestamp']}")
        print(f"Sensors: {data_point['sensor_data']}")
        
        # Process data for analytics
        await process_sensor_reading(data_point)

async def process_sensor_reading(data_point):
    # Check for anomalies
    if data_point['sensor_data']['spindle_temp'] > 70:
        await trigger_alert('Temperature alert', data_point)
    
    # Store for historical analysis
    await store_historical_data(data_point)

# Run the streaming
asyncio.run(stream_sensor_data())
\`\`\`

## MES Integration

\`\`\`python
from schlep_engine import MES

# Initialize MES client
mes = MES(api_key='your_api_key')

# Create production order
production_order = mes.create_production_order({
    'order_details': {
        'product_id': 'PART_ABC_001',
        'quantity': 100,
        'priority': 'high',
        'due_date': '2024-02-15T16:00:00Z'
    },
    'resource_requirements': [
        {
            'resource_type': 'machine',
            'resource_id': 'cnc_mill_001',
            'duration_minutes': 240
        },
        {
            'resource_type': 'operator',
            'skill_level': 'advanced',
            'duration_minutes': 480
        }
    ]
})

print(f"Production order created: {production_order['production_order_id']}")

# Monitor production status
order_id = production_order['production_order_id']
status = mes.get_production_status(order_id, include_metrics=True)

print(f"Order Status: {status['status']}")
print(f"Progress: {status['progress_percentage']}%")
print(f"OEE: {status['performance_metrics']['oee']}")

# Record quality check
quality_result = mes.record_quality_check({
    'inspection_data': {
        'order_id': order_id,
        'operation_step': 'machining',
        'inspector_id': 'QC_001',
        'inspection_timestamp': '2024-01-16T10:30:00Z'
    },
    'measurements': [
        {
            'parameter_name': 'diameter',
            'measured_value': 25.02,
            'specification_min': 24.95,
            'specification_max': 25.05,
            'pass_fail': True
        }
    ]
})
\`\`\`

## Digital Twin Operations

\`\`\`python
from schlep_engine import DigitalTwin

# Initialize Digital Twin client
twin = DigitalTwin(api_key='your_api_key')

# Create digital twin
twin_config = {
    'asset_details': {
        'asset_id': 'cnc_mill_001',
        'asset_type': 'cnc_machine',
        'manufacturer': 'Haas',
        'model': 'VF-2SS'
    },
    'twin_configuration': {
        'physics_model': 'detailed',
        'update_frequency': '5s',
        'simulation_fidelity': 'high'
    }
}

digital_twin = twin.create_digital_twin(twin_config)
twin_id = digital_twin['digital_twin_id']

# Get real-time twin state
state = twin.get_twin_state(twin_id, include_predictions=True)
print(f"Twin Status: {state['sync_status']}")
print(f"Spindle Speed: {state['current_state']['spindle_speed_rpm']} RPM")
print(f"Health Score: {state['predictive_insights']['health_score']}")

# Run scenario testing
scenario_config = {
    'scenario_config': {
        'scenario_name': 'Increased Production Speed',
        'test_duration': '8h',
        'simulation_speed': 100
    },
    'test_parameters': [
        {
            'parameter_name': 'spindle_speed_rpm',
            'new_value': 3200,
            'change_schedule': 'immediate'
        }
    ]
}

scenario_test = twin.run_scenario_test(twin_id, scenario_config)
print(f"Scenario test started: {scenario_test['scenario_test_id']}")

# Optimize parameters
optimization = twin.optimize_parameters(twin_id, {
    'optimization_config': {
        'primary_objective': 'maximize_throughput',
        'optimization_horizon': '24h'
    },
    'constraints': [
        {
            'parameter_name': 'spindle_speed_rpm',
            'min_value': 1000,
            'max_value': 4000,
            'constraint_type': 'hard_limit'
        }
    ]
})

for param in optimization['recommended_parameters']:
    print(f"{param['parameter_name']}: {param['current_value']} → {param['optimal_value']}")
\`\`\`

## Analytics Integration

\`\`\`python
from schlep_engine import Analytics

# Initialize Analytics client
analytics = Analytics(api_key='your_api_key')

# Configure predictive maintenance
config = {
    'equipment_id': 'cnc_mill_001',
    'analysis_type': {
        'predictive_maintenance': True,
        'anomaly_detection': True,
        'quality_prediction': True
    }
}

# Start real-time analysis
analysis = analytics.stream_analyze(config)
print(f"Analysis started: {analysis['analysis_id']}")

# Get equipment forecasts
forecasts = analytics.get_equipment_forecasts(
    equipment_id='cnc_mill_001',
    forecast_horizon='30d'
)

print("Failure Probability Forecast:")
for forecast_point in forecasts['forecasts']['failure_probability']:
    print(f"  {forecast_point['date']}: {forecast_point['probability']:.2%}")

# Configure Statistical Process Control
spc_config = {
    'process_id': 'machining_line_01',
    'spc_config': {
        'control_limits': {
            'ucl': 45.2,
            'lcl': 38.8,
            'center_line': 42.0
        },
        'chart_type': 'x_bar',
        'sample_size': 5,
        'violation_rules': [
            'point_beyond_limits',
            'seven_points_one_side'
        ]
    }
}

spc_system = analytics.configure_spc(spc_config)
print(f"SPC configured: {spc_system['spc_id']}")
\`\`\``
    },
    advanced: {
      title: 'Advanced Features',
      icon: ChartBarIcon,
      content: `# Advanced SDK Features

## Async Support

The Schlep Engine SDK provides full async/await support for better performance:

\`\`\`python
import asyncio
from schlep_engine import AsyncSchlepEngine

async def main():
    # Use async client for better performance
    client = AsyncSchlepEngine(api_key='your_api_key')
    
    # Concurrent operations
    tasks = [
        client.mlops.get_pipeline_status(pipeline_id) 
        for pipeline_id in pipeline_ids
    ]
    
    results = await asyncio.gather(*tasks)
    
    for result in results:
        print(f"Pipeline {result['pipeline_id']}: {result['status']}")

asyncio.run(main())
\`\`\`

## Error Handling

Comprehensive error handling with custom exceptions:

\`\`\`python
from schlep_engine import SchlepEngine
from schlep_engine.exceptions import (
    SchlepAPIError,
    AuthenticationError,
    RateLimitError,
    ValidationError
)

client = SchlepEngine(api_key='your_api_key')

try:
    result = client.mlops.create_pipeline(invalid_config)
except ValidationError as e:
    print(f"Configuration error: {e.message}")
    print(f"Invalid fields: {e.details['invalid_fields']}")
except AuthenticationError as e:
    print(f"Authentication failed: {e.message}")
except RateLimitError as e:
    print(f"Rate limit exceeded. Retry after: {e.retry_after} seconds")
except SchlepAPIError as e:
    print(f"API error: {e.message} (status: {e.status_code})")
\`\`\`

## Pagination and Filtering

Handle large datasets with built-in pagination:

\`\`\`python
# Paginated results
paginator = client.mlops.list_experiments(
    page_size=50,
    filters={
        'status': 'completed',
        'created_after': '2024-01-01'
    }
)

for experiment in paginator:
    print(f"Experiment: {experiment['name']}")

# Manual pagination
page = client.mlops.list_experiments(page=1, page_size=100)
while page['has_next']:
    for experiment in page['data']:
        process_experiment(experiment)
    
    page = client.mlops.list_experiments(
        page=page['next_page'], 
        page_size=100
    )
\`\`\`

## Batch Operations

Efficient batch processing for large-scale operations:

\`\`\`python
# Batch predictions
batch_requests = [
    {'data': {'feature1': 1.2, 'feature2': 3.4}},
    {'data': {'feature1': 2.1, 'feature2': 4.5}},
    {'data': {'feature1': 3.3, 'feature2': 2.1}}
]

# Process in batches of 100
batch_results = client.mlops.predict_batch(
    pipeline_id='pipeline_123',
    requests=batch_requests,
    batch_size=100
)

for result in batch_results:
    print(f"Prediction: {result['prediction']}")

# Batch dataset upload
datasets = [
    {'name': 'dataset1', 'data': df1},
    {'name': 'dataset2', 'data': df2},
    {'name': 'dataset3', 'data': df3}
]

upload_results = client.datasets.upload_batch(datasets)
\`\`\`

## Webhooks Integration

Set up webhooks for real-time event notifications:

\`\`\`python
# Configure webhook endpoint
webhook_config = {
    'url': 'https://your-app.com/webhooks/schlep',
    'events': [
        'pipeline.training.completed',
        'prediction.batch.completed',
        'equipment.alert.triggered'
    ],
    'secret': 'your_webhook_secret'
}

webhook = client.webhooks.create(webhook_config)

# Webhook handler example (Flask)
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)

@app.route('/webhooks/schlep', methods=['POST'])
def handle_webhook():
    # Verify webhook signature
    signature = request.headers.get('X-Schlep-Signature')
    payload = request.get_data()
    
    expected_signature = hmac.new(
        webhook_secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        return 'Invalid signature', 401
    
    event_data = request.get_json()
    
    # Handle different event types
    if event_data['event'] == 'pipeline.training.completed':
        handle_training_completed(event_data)
    elif event_data['event'] == 'equipment.alert.triggered':
        handle_equipment_alert(event_data)
    
    return 'OK', 200
\`\`\`

## Custom Data Processors

Extend the SDK with custom data processing:

\`\`\`python
from schlep_engine.processors import BaseProcessor

class CustomFeatureProcessor(BaseProcessor):
    def __init__(self, config):
        super().__init__(config)
        self.scaler = StandardScaler()
        
    def fit(self, data):
        # Custom fitting logic
        self.scaler.fit(data)
        return self
        
    def transform(self, data):
        # Custom transformation logic
        scaled_data = self.scaler.transform(data)
        
        # Add custom features
        scaled_data['custom_feature'] = (
            scaled_data['feature1'] * scaled_data['feature2']
        )
        
        return scaled_data

# Register custom processor
client.mlops.register_processor('custom_feature', CustomFeatureProcessor)

# Use in pipeline
pipeline_config = {
    'processors': [
        {'type': 'custom_feature', 'config': {'normalize': True}}
    ]
}
\`\`\`

## Monitoring and Logging

Built-in monitoring and structured logging:

\`\`\`python
import logging
from schlep_engine import SchlepEngine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('schlep_engine')

# Enable performance monitoring
client = SchlepEngine(
    api_key='your_api_key',
    enable_monitoring=True,
    log_level='INFO'
)

# Custom metrics
with client.monitor.timer('custom_operation'):
    # Your code here
    result = expensive_operation()

client.monitor.increment('custom.counter')
client.monitor.gauge('custom.metric', 42.0)

# Structured logging
logger.info(
    "Pipeline training completed",
    extra={
        'pipeline_id': 'pipeline_123',
        'accuracy': 0.95,
        'training_time': 120.5
    }
)
\`\`\`

## Configuration Management

Environment-based configuration management:

\`\`\`python
from schlep_engine import SchlepEngine
import os

# Environment-based configuration
env = os.getenv('ENVIRONMENT', 'development')

config = {
    'development': {
        'api_key': 'dev_key',
        'base_url': 'https://dev-api.schlep-engine.com',
        'timeout': 60,
        'retries': 2
    },
    'production': {
        'api_key': os.getenv('SCHLEP_PROD_API_KEY'),
        'base_url': 'https://api.schlep-engine.com',
        'timeout': 30,
        'retries': 3
    }
}

client = SchlepEngine(**config[env])

# Dynamic configuration updates
client.update_config({
    'timeout': 45,
    'enable_caching': True
})
\`\`\``
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Python SDK Documentation</h1>
        <p className="text-gray-600 text-lg">
          Comprehensive Python SDK for integrating Schlep Engine's MLOps and Manufacturing capabilities 
          into your applications with full async support and type hints.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {Object.entries(sections).map(([key, section]) => {
          const Icon = section.icon
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeSection === key
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{section.title}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6">
          <CodeBlock
            code={sections[activeSection].content}
            language="python"
            title={sections[activeSection].title}
          />
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quick Start Example</h2>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <CodeBlock
            code={`# Install and quick start
pip install schlep-engine

# Simple MLOps example
from schlep_engine import MLOps
import pandas as pd

# Initialize client
mlops = MLOps(api_key='your_api_key')

# Create and train a model
data = pd.read_csv('your_data.csv')
pipeline = mlops.create_pipeline('my_model', 'regression', data)
mlops.train(pipeline.id, target_column='sales')

# Make predictions
result = mlops.predict(pipeline.id, {'feature1': 1.0, 'feature2': 2.0})
print(f"Prediction: {result['prediction']}")`}
            language="python"
          />
        </div>
      </div>

      {/* SDK Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Features</h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Full async/await support for better performance
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Type hints and IDE auto-completion
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Built-in error handling and retries
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Automatic pagination for large datasets
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Webhook integration for real-time events
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>
              Comprehensive logging and monitoring
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Supported Modules</h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center">
              <CpuChipIcon className="h-4 w-4 text-blue-600 mr-3" />
              MLOps Platform with AutoML
            </li>
            <li className="flex items-center">
              <ChartBarIcon className="h-4 w-4 text-green-600 mr-3" />
              Experiment Tracking & Management
            </li>
            <li className="flex items-center">
              <CogIcon className="h-4 w-4 text-orange-600 mr-3" />
              Manufacturing IoT Integration
            </li>
            <li className="flex items-center">
              <CommandLineIcon className="h-4 w-4 text-purple-600 mr-3" />
              Digital Twin Operations
            </li>
            <li className="flex items-center">
              <CpuChipIcon className="h-4 w-4 text-red-600 mr-3" />
              Real-time Analytics & SPC
            </li>
            <li className="flex items-center">
              <ChartBarIcon className="h-4 w-4 text-indigo-600 mr-3" />
              Dataset Marketplace
            </li>
          </ul>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Additional Resources</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">GitHub Repository</h3>
            <p className="text-gray-600 text-sm mb-4">
              Source code, examples, and contribution guidelines
            </p>
            <a 
              href="https://github.com/schlep-engine/python-sdk" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub →
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 text-sm mb-4">
              Complete API documentation with examples
            </p>
            <a 
              href="/api-reference/mlops" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Browse APIs →
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Community</h3>
            <p className="text-gray-600 text-sm mb-4">
              Join our community for support and discussions
            </p>
            <a 
              href="https://discord.gg/schlep-engine" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join Discord →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}