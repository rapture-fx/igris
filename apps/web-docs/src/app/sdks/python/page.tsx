import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function PythonSDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Python SDK
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Official Python SDK for Schlep Engine - Advanced data processing, machine learning, and analytics platform with full async support and type safety.
        </p>
        
        <div className="flex items-center gap-4 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Latest: v2.1.0
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Python 3.8+
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            Async/Sync Support
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="https://pypi.org/project/schlep-engine/"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on PyPI
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/python-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            GitHub Repository
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Quick Start
          </h3>
          <p className="text-green-700">
            Install with pip and start processing data in under 2 minutes with comprehensive async support and error handling.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Install from PyPI
pip install schlep-engine

# Or with development dependencies
pip install "schlep-engine[dev]"`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">API Key Authentication</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine import SchlepEngineClient

# Initialize client with API key
client = SchlepEngineClient(api_key="your-api-key-here")

# Process a data file
result = await client.data.process_file(
    file_path="data.csv",
    transformations=[
        {"type": "filter", "condition": "age > 18"},
        {"type": "aggregate", "columns": ["revenue"], "operation": "sum"}
    ]
)

print(f"Processing complete! Job ID: {result.job_id}")`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">User Authentication</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine import SchlepEngineClient

# Initialize client
client = SchlepEngineClient()

# Login with credentials
tokens = await client.auth.login("user@example.com", "password")
print(f"Logged in as: {tokens.user.email}")

# Now you can use all API features
pipelines = await client.ml.list_pipelines()`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Synchronous Usage</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine import SchlepEngineClientSync

# Synchronous client for non-async environments
client = SchlepEngineClientSync(api_key="your-api-key")

# Same methods, but synchronous
result = client.data.process_file("data.csv")
models = client.ml.list_models()`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Key Features</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Complete API Coverage</h4>
              <p className="text-gray-600">Full support for all Schlep-engine endpoints</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Async/Await Support</h4>
              <p className="text-gray-600">Modern async Python with synchronous compatibility</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Type Safety</h4>
              <p className="text-gray-600">Full type hints for better IDE support</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Error Handling</h4>
              <p className="text-gray-600">Comprehensive error handling with retries</p>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Core Features</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Data Processing</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine.models import DataFormat, ProcessingMode, DataPipeline, TransformationRule

# Process various data formats
result = await client.data.process_file(
    file_path="sales_data.xlsx",
    data_format=DataFormat.XLSX,
    processing_mode=ProcessingMode.BATCH,
    output_format=DataFormat.JSON
)

# Create reusable data pipelines
pipeline = DataPipeline(
    name="Sales Data Pipeline",
    source_config={"type": "s3", "bucket": "my-data"},
    transformations=[
        TransformationRule("clean_nulls", "filter", {"remove_nulls": True}),
        TransformationRule("aggregate_sales", "aggregate", {
            "group_by": ["region", "product"],
            "metrics": {"revenue": "sum", "units": "count"}
        })
    ],
    destination_config={"type": "database", "table": "processed_sales"}
)

created_pipeline = await client.data.create_pipeline(pipeline)`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Machine Learning</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine.models.ml import MLPipelineConfig, MLTaskType, ModelType

# Create ML pipeline
config = MLPipelineConfig(
    name="Customer Churn Prediction",
    task_type=MLTaskType.CLASSIFICATION,
    model_type=ModelType.GRADIENT_BOOSTING,
    target_column="churned",
    feature_columns=["age", "tenure", "usage", "support_calls"],
    auto_hyperparameter_tuning=True
)

# Train model
pipeline_info = await client.ml.create_pipeline(config)
training_job = await client.ml.train_pipeline(pipeline_info["pipeline_id"])

# Monitor training
while not training_job.is_completed:
    training_job = await client.ml.get_training_job(training_job.job_id)
    print(f"Training progress: {training_job.progress_percentage}%")
    await asyncio.sleep(10)

# Make predictions
predictions = await client.ml.predict(
    model_id=training_job.model_id,
    input_data=[
        {"age": 35, "tenure": 24, "usage": 450, "support_calls": 2},
        {"age": 42, "tenure": 36, "usage": 230, "support_calls": 0}
    ],
    return_probabilities=True
)`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Document Extraction</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Extract text and tables from documents
result = await client.extract.extract_text(
    file_path="contract.pdf",
    extract_tables=True,
    extract_images=False
)

print("Extracted text:", result["text"])
print("Tables found:", len(result["tables"]))

# Extract structured data from invoices
invoice_data = await client.extract.extract_tables("invoice.pdf")
for table in invoice_data["tables"]:
    print("Table data:", table["data"])`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Data Quality Assessment</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Assess data quality
quality_report = await client.quality.assess_quality(
    data_path="customer_data.csv",
    checks=["completeness", "uniqueness", "validity", "consistency"]
)

print(f"Overall Quality Score: {quality_report.overall_score}%")
print(f"Quality Level: {quality_report.overall_quality_level}")

for metric in quality_report.metrics:
    print(f"{metric.name}: {metric.score}% ({metric.quality_level})")`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Advanced Usage</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Context Manager</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Automatic resource cleanup
async with SchlepEngineClient(api_key="your-key") as client:
    # All your API calls here
    result = await client.data.process_file("data.csv")
    models = await client.ml.list_models()
    # Client automatically closed when exiting context`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Custom Configuration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine.utils.retry import RetryConfig, RetryStrategy

# Custom retry configuration
retry_config = RetryConfig(
    max_retries=5,
    base_delay=2.0,
    strategy=RetryStrategy.EXPONENTIAL,
    backoff_factor=2.0
)

client = SchlepEngineClient(
    api_key="your-key",
    base_url="https://api.schlep-engine.com",
    timeout=60.0,
    retry_config=retry_config,
    debug=True
)`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Error Handling</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine.exceptions import (
    SchlepEngineError, APIError, AuthenticationError, 
    RateLimitError, ValidationError
)

try:
    result = await client.data.process_file("invalid_file.csv")
except AuthenticationError:
    print("Invalid API key or authentication failed")
except ValidationError as e:
    print(f"Validation failed: {e.validation_errors}")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except APIError as e:
    print(f"API error ({e.status_code}): {e.message}")
except SchlepEngineError as e:
    print(f"SDK error: {e}")`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Environment Variables</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# API Configuration
SCHLEP_ENGINE_API_KEY=your-api-key-here
SCHLEP_ENGINE_BASE_URL=https://api.schlep-engine.com
SCHLEP_ENGINE_TIMEOUT=30.0

# Debug Settings
SCHLEP_ENGINE_DEBUG=true
SCHLEP_ENGINE_LOG_LEVEL=DEBUG`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Performance Optimization</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Connection Pooling and Async</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import asyncio
import aiohttp
from schlep_engine import SchlepEngineClient
from schlep_engine.utils.retry import RetryConfig, RetryStrategy

# Optimized client configuration for high-throughput applications
async def create_optimized_client():
    # Custom HTTP connector with connection pooling
    connector = aiohttp.TCPConnector(
        limit=100,  # Total connection pool size
        limit_per_host=20,  # Per-host connection limit
        keepalive_timeout=30,
        enable_cleanup_closed=True
    )
    
    # Advanced retry configuration
    retry_config = RetryConfig(
        max_retries=5,
        base_delay=1.0,
        strategy=RetryStrategy.EXPONENTIAL,
        backoff_factor=2.0,
        max_delay=60.0,
        retry_on_status_codes=[429, 502, 503, 504]
    )
    
    client = SchlepEngineClient(
        api_key="your-api-key",
        base_url="https://api.schlep-engine.com",
        timeout=120.0,
        retry_config=retry_config,
        http_connector=connector,
        # Enable connection pooling
        enable_connection_pooling=True,
        # Optimize for high throughput
        max_concurrent_requests=50,
        # Enable request compression
        enable_compression=True
    )
    
    return client`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Requirements</h2>
        
        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Python 3.8+</li>
          <li>httpx or aiohttp (for HTTP requests)</li>
          <li>pydantic (for data validation)</li>
          <li>python-dateutil (for date handling)</li>
        </ul>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Troubleshooting</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Common Issues</h3>
        
        <div className="space-y-6 mb-8">
          <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Authentication Errors</h4>
            <p className="text-yellow-700 mb-2">Check if your API key is valid and has necessary permissions.</p>
            <div className="bg-yellow-100 rounded p-2 text-sm text-yellow-800">
              <code>AuthenticationError: Invalid API key or authentication failed</code>
            </div>
          </div>
          
          <div className="border-l-4 border-red-400 bg-red-50 p-4">
            <h4 className="font-semibold text-red-800 mb-2">Rate Limiting</h4>
            <p className="text-red-700 mb-2">Use built-in retry logic or implement exponential backoff.</p>
            <div className="bg-red-100 rounded p-2 text-sm text-red-800">
              <code>RateLimitError: Rate limited. Retry after 30 seconds</code>
            </div>
          </div>
          
          <div className="border-l-4 border-orange-400 bg-orange-50 p-4">
            <h4 className="font-semibold text-orange-800 mb-2">Connection Timeouts</h4>
            <p className="text-orange-700 mb-2">Increase timeout for large files or use async processing.</p>
            <div className="bg-orange-100 rounded p-2 text-sm text-orange-800">
              <code>TimeoutError: Request timed out after 30 seconds</code>
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Debug Mode</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import logging
from schlep_engine import SchlepEngineClient

# Enable debug mode
logging.basicConfig(level=logging.DEBUG)

client = SchlepEngineClient(
    api_key="your-key",
    debug=True,  # Enables verbose logging
    log_requests=True,  # Logs all HTTP requests
    log_responses=True,  # Logs all HTTP responses
)`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Migration Guide</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            Migrating from v1.x to v2.x
          </h3>
          <p className="text-blue-700 mb-4">
            The v2.0 release includes breaking changes. Key differences:
          </p>
          <ul className="list-disc list-inside space-y-2 text-blue-700">
            <li>Client initialization: <code>SchlepEngineClient</code> instead of <code>SchlepClient</code></li>
            <li>Async by default with sync compatibility via <code>SchlepEngineClientSync</code></li>
            <li>Enhanced error handling with specific exception types</li>
            <li>Improved response objects with rich metadata</li>
          </ul>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 mb-4">
              Complete API documentation with all methods and parameters.
            </p>
            <Link href="/api-reference" className="text-blue-600 hover:text-blue-700 font-medium">
              View API Docs →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🔧</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Examples</h3>
            <p className="text-gray-600 mb-4">
              Real-world examples and code samples for common use cases.
            </p>
            <Link href="https://github.com/schlep-engine/python-sdk-examples" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">💬</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Support</h3>
            <p className="text-gray-600 mb-4">
              Get help from our community and support team.
            </p>
            <Link href="https://support.schlep-engine.com" className="text-blue-600 hover:text-blue-700 font-medium">
              Get Support →
            </Link>
          </div>
        </div>

        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Ready to Get Started?
          </h3>
          <p className="text-green-700 mb-4">
            Install the Python SDK and start building with Schlep Engine today.
          </p>
          <div className="flex gap-4">
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Quick Start Guide
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex items-center gap-2 border border-green-300 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              View Use Cases
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}