# Schlep-engine Python SDK

[![PyPI version](https://badge.fury.io/py/schlep-engine.svg)](https://badge.fury.io/py/schlep-engine)
[![Python Support](https://img.shields.io/pypi/pyversions/schlep-engine.svg)](https://pypi.org/project/schlep-engine/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Python SDK for the **Schlep-engine** API - Advanced data processing, machine learning, and analytics platform.

## Features

- **Complete API Coverage**: Full support for all Schlep-engine endpoints
- **Async/Await Support**: Modern async Python with full synchronous compatibility
- **Authentication Management**: Automatic token handling and refresh
- **Error Handling**: Comprehensive error handling with automatic retries
- **Type Safety**: Full type hints for better IDE support and code quality
- **Data Processing**: Upload, process, and transform data at scale
- **ML Pipelines**: Create, train, and deploy machine learning models
- **Document Extraction**: Extract text, tables, and metadata from documents
- **Data Quality**: Assess and monitor data quality metrics
- **Analytics**: Run complex analytics queries and generate insights

## Installation

```bash
pip install schlep-engine
```

For development dependencies:

```bash
pip install "schlep-engine[dev]"
```

## Quick Start

### API Key Authentication

```python
from schlep_engine import SchlepEngineClient

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

print(f"Processing complete! Job ID: {result.job_id}")
```

### User Authentication

```python
from schlep_engine import SchlepEngineClient

# Initialize client
client = SchlepEngineClient()

# Login with credentials
tokens = await client.auth.login("user@example.com", "password")
print(f"Logged in as: {tokens.user.email}")

# Now you can use all API features
pipelines = await client.ml.list_pipelines()
```

### Synchronous Usage

```python
from schlep_engine import SchlepEngineClientSync

# Synchronous client for non-async environments
client = SchlepEngineClientSync(api_key="your-api-key")

# Same methods, but synchronous
result = client.data.process_file("data.csv")
models = client.ml.list_models()
```

## Core Features

### Data Processing

```python
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

created_pipeline = await client.data.create_pipeline(pipeline)
```

### Machine Learning

```python
from schlep_engine.models.ml import MLPipelineConfig, MLTaskType, ModelType

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
)
```

### Document Extraction

```python
# Extract text and tables from documents
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
    print("Table data:", table["data"])
```

### Data Quality Assessment

```python
# Assess data quality
quality_report = await client.quality.assess_quality(
    data_path="customer_data.csv",
    checks=["completeness", "uniqueness", "validity", "consistency"]
)

print(f"Overall Quality Score: {quality_report.overall_score}%")
print(f"Quality Level: {quality_report.overall_quality_level}")

for metric in quality_report.metrics:
    print(f"{metric.name}: {metric.score}% ({metric.quality_level})")
```

### Analytics Queries

```python
from schlep_engine.models.analytics import AnalyticsQuery, AggregationType

# Run analytics query
query = AnalyticsQuery(
    dataset="sales_data",
    metrics=[
        {"name": "total_revenue", "column": "revenue", "aggregation": "sum"},
        {"name": "avg_order_value", "column": "revenue", "aggregation": "avg"}
    ],
    dimensions=["region", "product_category"],
    filters=[
        {"column": "date", "operator": ">=", "value": "2024-01-01"},
        {"column": "status", "operator": "=", "value": "completed"}
    ],
    time_granularity=TimeGranularity.MONTH
)

results = await client.analytics.query(query)
print(f"Query returned {results.total_rows} rows")
for row in results.data:
    print(row)
```

## Advanced Usage

### Context Manager

```python
# Automatic resource cleanup
async with SchlepEngineClient(api_key="your-key") as client:
    # All your API calls here
    result = await client.data.process_file("data.csv")
    models = await client.ml.list_models()
    # Client automatically closed when exiting context
```

### Custom Configuration

```python
from schlep_engine.utils.retry import RetryConfig, RetryStrategy

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
)
```

### Error Handling

```python
from schlep_engine.exceptions import (
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
    print(f"SDK error: {e}")
```

## Environment Variables

The SDK supports configuration via environment variables:

```bash
# API Configuration
SCHLEP_ENGINE_API_KEY=your-api-key-here
SCHLEP_ENGINE_BASE_URL=https://api.schlep-engine.com
SCHLEP_ENGINE_TIMEOUT=30.0

# Debug Settings
SCHLEP_ENGINE_DEBUG=true
SCHLEP_ENGINE_LOG_LEVEL=DEBUG
```

## Requirements

- Python 3.8+
- httpx or aiohttp (for HTTP requests)
- pydantic (for data validation)
- python-dateutil (for date handling)

## Documentation

- [API Documentation](https://docs.schlep-engine.com/api)
- [SDK Documentation](https://docs.schlep-engine.com/sdk/python)
- [Getting Started Guide](https://docs.schlep-engine.com/getting-started)
- [Examples Repository](https://github.com/schlep-engine/python-sdk-examples)

## Support

- [Support Center](https://support.schlep-engine.com)
- [GitHub Issues](https://github.com/schlep-engine/python-sdk/issues)
- [Community Forum](https://community.schlep-engine.com)
- Email: support@schlep-engine.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

Made with ❤️ by the **Schlep-engine** team