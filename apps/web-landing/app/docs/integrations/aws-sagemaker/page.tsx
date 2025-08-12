import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'
import { CodeBlock } from '@/src/components/docs/CodeBlock'
import Link from 'next/link'

export default function SageMakerIntegration() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                AWS SageMaker Integration
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  Deploy and scale your schlep-engine pipelines on AWS SageMaker for production-ready machine learning workflows.
                </p>

                <div className="bg-orange-50 border-l-4 border-orange-400 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-orange-800 mb-2">
                    Enterprise-Grade ML Operations
                  </h3>
                  <ul className="text-orange-700 space-y-1">
                    <li>Scalable processing with SageMaker Processing Jobs</li>
                    <li>Automated model training and hyperparameter tuning</li>
                    <li>Production deployment with SageMaker Endpoints</li>
                    <li>Built-in monitoring and logging</li>
                  </ul>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Prerequisites</h2>
                
                <ul className="list-disc list-inside space-y-2 mb-6">
                  <li>AWS Account with SageMaker access</li>
                  <li>Configured AWS CLI or SageMaker Studio</li>
                  <li>S3 bucket for data storage</li>
                  <li>IAM role with SageMaker permissions</li>
                </ul>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Installation & Setup</h2>
                
                <CodeBlock 
                  language="bash"
                  code={`# Install schlep-engine with AWS dependencies
pip install schlep-engine[aws]

# Install SageMaker SDK
pip install sagemaker boto3`}
                />

                <h3 className="text-2xl font-semibold mt-8 mb-4">AWS Configuration</h3>
                
                <CodeBlock 
                  language="python"
                  code={`import sagemaker
import boto3
from sagemaker import get_execution_role
import schlep_engine as se

# Initialize SageMaker session
sagemaker_session = sagemaker.Session()
role = get_execution_role()
bucket = sagemaker_session.default_bucket()

# Configure schlep-engine for AWS
client = se.Client(
    api_key="your-api-key",
    cloud_provider="aws",
    aws_config={
        "region": "us-east-1",
        "bucket": bucket,
        "role": role
    }
)`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">SageMaker Processing Jobs</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Data Processing at Scale</h3>
                
                <CodeBlock 
                  language="python"
                  code={`# Create scalable processing pipeline
processing_pipeline = client.create_sagemaker_pipeline(
    name="large-scale-processing",
    instance_type="ml.m5.xlarge",
    instance_count=5,
    operations=[
        se.operations.clean_data(),
        se.operations.feature_engineering(),
        se.operations.data_validation()
    ]
)

# Submit processing job
job = processing_pipeline.submit_job(
    input_data="s3://your-bucket/raw-data/",
    output_path="s3://your-bucket/processed-data/",
    max_runtime_in_seconds=3600
)

# Monitor job progress
job.wait_for_completion()
print(f"Job completed with status: {job.describe()['ProcessingJobStatus']}")`}
                />

                <h3 className="text-2xl font-semibold mt-8 mb-4">Custom Processing Container</h3>
                
                <CodeBlock 
                  language="python"
                  code={`# Build custom processing container
from sagemaker.processing import ScriptProcessor

processor = ScriptProcessor(
    command=['python3'],
    image_uri='your-account.dkr.ecr.us-east-1.amazonaws.com/schlep-engine:latest',
    role=role,
    instance_count=1,
    instance_type='ml.m5.large'
)

# Run processing with custom script
processor.run(
    code='process_data.py',
    inputs=[
        ProcessingInput(source='s3://bucket/input', destination='/opt/ml/processing/input')
    ],
    outputs=[
        ProcessingOutput(source='/opt/ml/processing/output', destination='s3://bucket/output')
    ]
)`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Model Training Integration</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Automated Training Pipeline</h3>
                
                <CodeBlock 
                  language="python"
                  code={`from sagemaker.sklearn.estimator import SKLearn

# Prepare training data with Schlep Engine
train_pipeline = client.create_pipeline(
    name="ml-preprocessing",
    operations=[
        se.operations.feature_selection(),
        se.operations.train_test_split(test_size=0.2),
        se.operations.export_for_training()
    ]
)

# Execute preprocessing
processed_data = train_pipeline.execute()

# Create SageMaker estimator
estimator = SKLearn(
    entry_point='train.py',
    framework_version='0.23-1',
    instance_type='ml.m5.large',
    role=role,
    hyperparameters={
        'n-estimators': 100,
        'max-depth': 5
    }
)

# Train model
estimator.fit({'training': processed_data['train_path']})`}
                />

                <h3 className="text-2xl font-semibold mt-8 mb-4">Hyperparameter Tuning</h3>
                
                <CodeBlock 
                  language="python"
                  code={`from sagemaker.tuner import HyperparameterTuner, IntegerParameter, ContinuousParameter

# Define hyperparameter ranges
hyperparameter_ranges = {
    'n-estimators': IntegerParameter(50, 200),
    'max-depth': IntegerParameter(3, 10),
    'learning-rate': ContinuousParameter(0.01, 0.3)
}

# Create tuner
tuner = HyperparameterTuner(
    estimator,
    objective_metric_name='validation:accuracy',
    hyperparameter_ranges=hyperparameter_ranges,
    max_jobs=20,
    max_parallel_jobs=3
)

# Start tuning job
tuner.fit({'training': processed_data['train_path']})`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Production Deployment</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Real-time Endpoints</h3>
                
                <CodeBlock 
                  language="python"
                  code={`# Create inference pipeline with preprocessing
inference_pipeline = client.create_inference_pipeline(
    name="production-inference",
    preprocessing=[
        se.operations.input_validation(),
        se.operations.feature_transformation(),
    ],
    model=best_model,
    postprocessing=[
        se.operations.format_predictions(),
        se.operations.add_metadata()
    ]
)

# Deploy to SageMaker endpoint
endpoint = inference_pipeline.deploy_to_sagemaker(
    instance_type='ml.m5.large',
    initial_instance_count=2,
    endpoint_name='schlep-engine-inference'
)

# Test endpoint
test_data = {"features": [1, 2, 3, 4, 5]}
prediction = endpoint.predict(test_data)
print(f"Prediction: {prediction}")`}
                />

                <h3 className="text-2xl font-semibold mt-8 mb-4">Batch Transform Jobs</h3>
                
                <CodeBlock 
                  language="python"
                  code={`# Create batch transform job
transformer = estimator.transformer(
    instance_count=1,
    instance_type='ml.m5.large',
    output_path='s3://bucket/batch-predictions/'
)

# Run batch prediction
transformer.transform(
    data='s3://bucket/batch-input-data/',
    content_type='text/csv',
    split_type='Line'
)

transformer.wait()`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Monitoring & Operations</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Model Monitoring</h3>
                
                <CodeBlock 
                  language="python"
                  code={`from sagemaker.model_monitor import DefaultModelMonitor

# Set up data quality monitoring
monitor = DefaultModelMonitor(
    role=role,
    instance_count=1,
    instance_type='ml.m5.large',
    volume_size_in_gb=20,
    max_runtime_in_seconds=3600,
)

# Create baseline
monitor.suggest_baseline(
    baseline_dataset='s3://bucket/baseline-data/train.csv',
    dataset_format={'csv': {'header': True}},
    output_s3_uri='s3://bucket/baseline-results'
)

# Enable monitoring
monitor.create_monitoring_schedule(
    endpoint_input=endpoint_name,
    output_s3_uri='s3://bucket/monitoring-results',
    schedule_cron_expression='cron(0 * * * ? *)'  # Hourly
)`}
                />

                <h2 className="text-3xl font-semibold mt-12 mb-6">Cost Optimization</h2>
                
                <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-green-800 mb-4">
                    Cost-Saving Strategies
                  </h3>
                  <ul className="text-green-700 space-y-2">
                    <li><strong>Spot Instances:</strong> Use spot training for non-urgent jobs (up to 90% savings)</li>
                    <li><strong>Auto Scaling:</strong> Configure endpoint auto-scaling based on traffic</li>
                    <li><strong>Scheduled Jobs:</strong> Run processing during off-peak hours</li>
                    <li><strong>Right-sizing:</strong> Monitor resource usage and adjust instance types</li>
                  </ul>
                </div>

                <CodeBlock 
                  language="python"
                  code={`# Enable spot training
estimator = SKLearn(
    entry_point='train.py',
    framework_version='0.23-1',
    instance_type='ml.m5.large',
    role=role,
    use_spot_instances=True,
    max_wait=3600,  # Max wait time for spot instances
    max_run=3600    # Max training time
)

# Configure auto-scaling
endpoint.auto_scale(
    min_capacity=1,
    max_capacity=10,
    target_value=70.0,  # Target CPU utilization
    scale_in_cooldown=300,
    scale_out_cooldown=60
)`}
                />

                <div className="bg-gray-50 p-6 rounded-lg mt-12">
                  <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
                  <ul className="space-y-2">
                    <li><Link href="/docs/sdks/python" className="text-blue-600 hover:underline">→ Python SDK Documentation</Link></li>
                    <li><Link href="/docs/integrations/jupyter" className="text-blue-600 hover:underline">→ Jupyter Integration</Link></li>
                    <li><Link href="/docs/api-reference" className="text-blue-600 hover:underline">→ Complete API Reference</Link></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}