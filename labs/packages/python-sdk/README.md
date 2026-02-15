# Igris-engine Python SDK

[![PyPI version](https://badge.fury.io/py/igris-inertial.svg)](https://badge.fury.io/py/igris-inertial)
[![Python Support](https://img.shields.io/pypi/pyversions/igris-inertial.svg)](https://pypi.org/project/igris-inertial/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Python SDK for the **Igris-engine** API - Advanced data processing, machine learning, and analytics platform.

## Features

- **Complete API Coverage**: Full support for all Igris-engine endpoints
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
pip install igris-inertial
```

For development dependencies:

```bash
pip install "igris-inertial[dev]"
```

## Quick Start

### API Key Authentication

```python
from igris_overture import IgrisClient

# Initialize client with API key
client = IgrisClient(api_key="your-api-key-here")

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
from igris_overture import IgrisClient

# Initialize client
client = IgrisClient()

# Login with credentials
tokens = await client.auth.login("user@example.com", "password")
print(f"Logged in as: {tokens.user.email}")

# Now you can use all API features
pipelines = await client.ml.list_pipelines()
```

### Synchronous Usage

```python
from igris_overture import IgrisClientSync

# Synchronous client for non-async environments
client = IgrisClientSync(api_key="your-api-key")

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
from igris_overture.models.ml import MLPipelineConfig, MLTaskType, ModelType

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
from igris_overture.models.analytics import AnalyticsQuery, AggregationType

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
async with IgrisClient(api_key="your-key") as client:
    # All your API calls here
    result = await client.data.process_file("data.csv")
    models = await client.ml.list_models()
    # Client automatically closed when exiting context
```

### Custom Configuration

```python
from igris_overture.utils.retry import RetryConfig, RetryStrategy

# Custom retry configuration
retry_config = RetryConfig(
    max_retries=5,
    base_delay=2.0,
    strategy=RetryStrategy.EXPONENTIAL,
    backoff_factor=2.0
)

client = IgrisClient(
    api_key="your-key",
    base_url="https://api.igris-inertial.com",
    timeout=60.0,
    retry_config=retry_config,
    debug=True
)
```

### Error Handling

```python
from igris_overture.exceptions import (
    IgrisError, APIError, AuthenticationError, 
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
except IgrisError as e:
    print(f"SDK error: {e}")
```

## Environment Variables

The SDK supports configuration via environment variables:

```bash
# API Configuration
IGRIS_OVERTURE_API_KEY=your-api-key-here
IGRIS_OVERTURE_BASE_URL=https://api.igris-inertial.com
IGRIS_OVERTURE_TIMEOUT=30.0

# Debug Settings
IGRIS_OVERTURE_DEBUG=true
IGRIS_OVERTURE_LOG_LEVEL=DEBUG
```

## Real-world Examples

### E-commerce Data Processing Pipeline

```python
from igris_overture import IgrisClient
from igris_overture.models import DataPipeline, TransformationRule, ProcessingMode
import asyncio

async def process_ecommerce_data():
    client = IgrisClient(api_key="your-api-key")
    
    # Define transformation pipeline for e-commerce data
    pipeline = DataPipeline(
        name="E-commerce Customer Analytics",
        source_config={
            "type": "s3",
            "bucket": "ecommerce-raw-data",
            "prefix": "customer_orders/"
        },
        transformations=[
            TransformationRule(
                "clean_data",
                "filter",
                {
                    "remove_nulls": True,
                    "remove_duplicates": True,
                    "validate_email_format": True
                }
            ),
            TransformationRule(
                "feature_engineering",
                "map",
                {
                    "customer_lifetime_value": {
                        "formula": "sum(order_total) / count(distinct(order_date))",
                        "group_by": "customer_id"
                    },
                    "customer_segment": {
                        "bins": [0, 100, 500, 1000, float('inf')],
                        "labels": ["low", "medium", "high", "premium"]
                    }
                }
            ),
            TransformationRule(
                "aggregate_metrics",
                "aggregate",
                {
                    "group_by": ["customer_segment", "product_category"],
                    "metrics": {
                        "total_revenue": "sum(order_total)",
                        "avg_order_value": "avg(order_total)",
                        "customer_count": "count(distinct(customer_id))"
                    }
                }
            )
        ],
        destination_config={
            "type": "database",
            "table": "customer_analytics_summary"
        }
    )
    
    # Create and execute pipeline
    created_pipeline = await client.data.create_pipeline(pipeline)
    execution = await client.data.execute_pipeline(created_pipeline.pipeline_id)
    
    # Monitor execution
    while not execution.is_completed:
        execution = await client.data.get_execution_status(execution.execution_id)
        print(f"Pipeline progress: {execution.progress_percentage}%")
        
        if execution.status == "failed":
            print(f"Pipeline failed: {execution.error_message}")
            break
            
        await asyncio.sleep(10)
    
    return execution

# Run the pipeline
asyncio.run(process_ecommerce_data())
```

### Fraud Detection ML Pipeline

```python
from igris_overture import IgrisClient
from igris_overture.models.ml import MLPipelineConfig, MLTaskType, ModelType

async def setup_fraud_detection():
    client = IgrisClient(api_key="your-api-key")
    
    # Configure ML pipeline for fraud detection
    config = MLPipelineConfig(
        name="Real-time Fraud Detection",
        task_type=MLTaskType.CLASSIFICATION,
        model_type=ModelType.GRADIENT_BOOSTING,
        target_column="is_fraud",
        feature_columns=[
            "transaction_amount",
            "merchant_category",
            "time_of_day_hour",
            "day_of_week",
            "user_account_age_days",
            "previous_transaction_count_24h",
            "avg_transaction_amount_30d",
            "merchant_risk_score",
            "location_risk_score"
        ],
        feature_engineering={
            "auto_feature_selection": True,
            "scaling_method": "robust",
            "handle_categorical": "target_encoding",
            "create_interactions": True
        },
        model_params={
            "n_estimators": 200,
            "max_depth": 10,
            "learning_rate": 0.1,
            "subsample": 0.8
        },
        auto_hyperparameter_tuning=True,
        validation_strategy="time_series_split",
        deployment_config={
            "auto_deploy": True,
            "deployment_type": "real_time",
            "performance_monitoring": True,
            "drift_detection": True
        }
    )
    
    # Create and train model
    pipeline = await client.ml.create_pipeline(config)
    training_job = await client.ml.train_pipeline(
        pipeline.pipeline_id,
        training_data_path="s3://fraud-detection-data/training/"
    )
    
    # Monitor training with detailed metrics
    while not training_job.is_completed:
        training_job = await client.ml.get_training_job(training_job.job_id)
        
        print(f"Training Progress: {training_job.progress_percentage}%")
        if training_job.current_metrics:
            print(f"Current Accuracy: {training_job.current_metrics.accuracy:.4f}")
            print(f"Current F1-Score: {training_job.current_metrics.f1_score:.4f}")
            print(f"Current Precision: {training_job.current_metrics.precision:.4f}")
            print(f"Current Recall: {training_job.current_metrics.recall:.4f}")
        
        await asyncio.sleep(30)
    
    if training_job.status == "completed":
        print(f"Model trained successfully! Model ID: {training_job.model_id}")
        print(f"Final Performance Metrics:")
        print(f"  Accuracy: {training_job.final_metrics.accuracy:.4f}")
        print(f"  F1-Score: {training_job.final_metrics.f1_score:.4f}")
        print(f"  AUC-ROC: {training_job.final_metrics.auc_roc:.4f}")
        
        return training_job.model_id
    
    return None

# Setup and deploy fraud detection model
model_id = asyncio.run(setup_fraud_detection())
```

### Data Quality Monitoring System

```python
from igris_overture import IgrisClient
from igris_overture.models.quality import DataQualityRules, QualityThreshold

async def setup_data_quality_monitoring():
    client = IgrisClient(api_key="your-api-key")
    
    # Define comprehensive data quality rules
    quality_rules = DataQualityRules(
        completeness_rules=[
            {"column": "customer_id", "threshold": 1.0},  # 100% completeness required
            {"column": "order_date", "threshold": 1.0},
            {"column": "order_total", "threshold": 0.95}  # 95% completeness acceptable
        ],
        uniqueness_rules=[
            {"column": "order_id", "threshold": 1.0},
            {"column": "customer_email", "threshold": 0.98}
        ],
        validity_rules=[
            {
                "column": "email",
                "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                "threshold": 0.99
            },
            {
                "column": "phone",
                "pattern": r"^\+?1?\d{9,15}$",
                "threshold": 0.95
            },
            {
                "column": "order_total",
                "min_value": 0,
                "max_value": 10000,
                "threshold": 0.99
            }
        ],
        consistency_rules=[
            {
                "rule": "order_total == sum(line_item_totals)",
                "threshold": 1.0
            },
            {
                "rule": "order_date <= shipping_date",
                "threshold": 0.98
            }
        ],
        freshness_rules=[
            {
                "column": "last_updated",
                "max_age_hours": 24,
                "threshold": 0.95
            }
        ]
    )
    
    # Run comprehensive quality assessment
    quality_report = await client.quality.assess_quality(
        data_path="s3://customer-data/daily/",
        rules=quality_rules,
        generate_report=True,
        send_alerts=True
    )
    
    # Print detailed quality report
    print(f"Overall Quality Score: {quality_report.overall_score}%")
    print(f"Quality Level: {quality_report.overall_quality_level}")
    print(f"Data Points Analyzed: {quality_report.total_records:,}")
    
    print("\nDetailed Quality Metrics:")
    for metric in quality_report.metrics:
        status = "✅" if metric.passed else "❌"
        print(f"{status} {metric.name}: {metric.score}% ({metric.quality_level})")
        if not metric.passed:
            print(f"   Issues found: {metric.issue_count}")
            print(f"   Threshold: {metric.threshold}%")
    
    # Setup automated quality monitoring
    if quality_report.overall_score < 90:
        print("\n⚠️  Quality below acceptable threshold. Setting up monitoring...")
        
        monitor = await client.quality.create_monitor(
            name="Customer Data Quality Monitor",
            data_source="s3://customer-data/daily/",
            rules=quality_rules,
            schedule="hourly",
            alert_thresholds={
                "overall_score": 85,
                "completeness": 90,
                "validity": 95
            },
            notification_channels=["email", "slack"]
        )
        
        print(f"Quality monitor created: {monitor.monitor_id}")
    
    return quality_report

# Run quality monitoring
asyncio.run(setup_data_quality_monitoring())
```

## Performance Optimization

### Connection Pooling and Async Optimization

```python
from igris_overture import IgrisClient
from igris_overture.utils.retry import RetryConfig, RetryStrategy
import asyncio
import aiohttp

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
    
    client = IgrisClient(
        api_key="your-api-key",
        base_url="https://api.igris-inertial.com",
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
    
    return client

# Batch processing with optimized concurrency
async def process_files_concurrently(file_paths):
    client = await create_optimized_client()
    
    semaphore = asyncio.Semaphore(10)  # Limit concurrent operations
    
    async def process_single_file(file_path):
        async with semaphore:
            try:
                result = await client.data.process_file(
                    file_path=file_path,
                    processing_mode=ProcessingMode.ASYNC,
                    enable_caching=True
                )
                print(f"✅ Processed: {file_path}")
                return result
            except Exception as e:
                print(f"❌ Failed: {file_path} - {e}")
                return None
    
    # Process all files concurrently
    tasks = [process_single_file(fp) for fp in file_paths]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    await client.close()
    return results

# Example usage
file_paths = ["data1.csv", "data2.csv", "data3.csv", "data4.csv"]
results = asyncio.run(process_files_concurrently(file_paths))
```

## Migration Guide

### Migrating from v1.x to v2.x

The v2.0 release includes several breaking changes and new features:

#### Breaking Changes

1. **Client Initialization**
   ```python
   # v1.x (deprecated)
   from igris_overture import IgrisClient
   client = IgrisClient(api_key="your-key")
   
   # v2.x (new)
   from igris_overture import IgrisClient
   client = IgrisClient(api_key="your-key")
   ```

2. **Method Names**
   ```python
   # v1.x (deprecated)
   result = client.upload_csv("data.csv")
   data = client.download_pandas(result.id)
   
   # v2.x (new)
   result = await client.data.process_file("data.csv")
   data = await client.data.download_result(result.job_id)
   ```

3. **Response Objects**
   ```python
   # v1.x (deprecated)
   result.id  # String ID
   result.status  # String status
   
   # v2.x (new)
   result.job_id  # UUID object
   result.status  # Enum with type safety
   result.metadata  # Rich metadata object
   ```

#### Migration Script

```python
# migration_helper.py
import asyncio
from typing import Dict, Any

class IgrisV2Migrator:
    """Helper class to migrate from v1.x to v2.x"""
    
    def __init__(self, old_client, new_client):
        self.old_client = old_client
        self.new_client = new_client
    
    async def migrate_processing_job(self, v1_job_data: Dict[str, Any]):
        """Migrate a v1.x processing job to v2.x format"""
        try:
            # Map v1.x parameters to v2.x format
            v2_params = {
                "file_path": v1_job_data.get("file_path"),
                "transformations": self._convert_transformations(
                    v1_job_data.get("transformations", [])
                ),
                "output_format": self._map_output_format(
                    v1_job_data.get("output_format")
                )
            }
            
            # Execute with new client
            result = await self.new_client.data.process_file(**v2_params)
            
            return {
                "success": True,
                "v2_job_id": result.job_id,
                "migration_notes": "Successfully migrated to v2.x format"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "migration_notes": "Manual intervention required"
            }
    
    def _convert_transformations(self, v1_transformations):
        """Convert v1.x transformations to v2.x format"""
        v2_transformations = []
        for transform in v1_transformations:
            v2_transformations.append({
                "type": transform.get("type"),
                "name": transform.get("name", f"transform_{len(v2_transformations)}"),
                "parameters": transform.get("params", {}),
                "enabled": transform.get("enabled", True)
            })
        return v2_transformations
    
    def _map_output_format(self, v1_format):
        """Map v1.x output format to v2.x enum"""
        format_mapping = {
            "csv": "CSV",
            "json": "JSON",
            "parquet": "PARQUET",
            "xlsx": "XLSX"
        }
        return format_mapping.get(v1_format, "JSON")

# Usage example
async def migrate_existing_workflows():
    from igris_overture import IgrisClient
    
    # Initialize new client
    new_client = IgrisClient(api_key="your-api-key")
    
    # Your existing v1.x job configurations
    v1_jobs = [
        {
            "file_path": "data1.csv",
            "transformations": [
                {"type": "filter", "params": {"remove_nulls": True}}
            ],
            "output_format": "parquet"
        }
        # ... more jobs
    ]
    
    migrator = IgrisV2Migrator(None, new_client)
    
    migration_results = []
    for job in v1_jobs:
        result = await migrator.migrate_processing_job(job)
        migration_results.append(result)
        
        if result["success"]:
            print(f"✅ Migrated job: {result['v2_job_id']}")
        else:
            print(f"❌ Migration failed: {result['error']}")
    
    await new_client.close()
    return migration_results

# Run migration
asyncio.run(migrate_existing_workflows())
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Errors

```python
from igris_overture.exceptions import AuthenticationError

try:
    client = IgrisClient(api_key="invalid-key")
    result = await client.data.process_file("data.csv")
except AuthenticationError as e:
    print(f"Authentication failed: {e}")
    # Solutions:
    # 1. Verify your API key is correct
    # 2. Check if API key has expired
    # 3. Ensure API key has necessary permissions
    # 4. Try regenerating API key from dashboard
```

#### 2. Rate Limiting Issues

```python
from igris_overture.exceptions import RateLimitError
import asyncio

try:
    # Process multiple files
    for file_path in large_file_list:
        result = await client.data.process_file(file_path)
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
    
    # Solution: Implement exponential backoff
    await asyncio.sleep(e.retry_after)
    
    # Or use built-in rate limiting
    client = IgrisClient(
        api_key="your-key",
        enable_rate_limiting=True,
        rate_limit_requests_per_second=5
    )
```

#### 3. Connection Timeouts

```python
from igris_overture.exceptions import TimeoutError
import asyncio

try:
    # Long-running operation
    result = await client.ml.train_pipeline(pipeline_id, large_dataset)
except TimeoutError:
    # Solutions:
    # 1. Increase timeout
    client = IgrisClient(
        api_key="your-key",
        timeout=300.0  # 5 minutes
    )
    
    # 2. Use async processing
    result = await client.ml.train_pipeline(
        pipeline_id, 
        large_dataset, 
        async_processing=True
    )
    
    # 3. Monitor long-running jobs
    job_id = result.job_id
    while True:
        status = await client.ml.get_training_job(job_id)
        if status.is_completed:
            break
        await asyncio.sleep(30)
```

#### 4. Memory Issues with Large Files

```python
# Problem: Loading large files into memory
# ❌ Don't do this:
with open("large_file.csv", "r") as f:
    content = f.read()  # Loads entire file into memory
    result = await client.data.process_file(content=content)

# ✅ Do this instead:
# Use streaming upload for large files
async def process_large_file(file_path):
    client = IgrisClient(api_key="your-key")
    
    # Enable streaming mode
    result = await client.data.process_file(
        file_path=file_path,
        streaming_mode=True,
        chunk_size=1024*1024,  # 1MB chunks
    )
    
    return result

# Or use chunked processing
async def process_file_in_chunks(file_path, chunk_size=10000):
    import pandas as pd
    
    chunk_results = []
    for chunk in pd.read_csv(file_path, chunksize=chunk_size):
        # Process each chunk separately
        chunk_file = f"temp_chunk_{len(chunk_results)}.csv"
        chunk.to_csv(chunk_file, index=False)
        
        result = await client.data.process_file(chunk_file)
        chunk_results.append(result.job_id)
        
        # Clean up temp file
        os.remove(chunk_file)
    
    # Combine results if needed
    combined_result = await client.data.combine_results(chunk_results)
    return combined_result
```

#### 5. SSL/TLS Certificate Issues

```python
# If you encounter SSL certificate verification errors
import ssl

# Option 1: Use custom SSL context (not recommended for production)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

client = IgrisClient(
    api_key="your-key",
    ssl_context=ssl_context
)

# Option 2: Configure custom certificate bundle
client = IgrisClient(
    api_key="your-key",
    ca_cert_path="/path/to/custom/ca-bundle.crt"
)

# Option 3: Disable SSL verification (development only)
client = IgrisClient(
    api_key="your-key",
    verify_ssl=False  # Only for development!
)
```

### Debug Mode and Logging

```python
import logging
from igris_overture import IgrisClient

# Enable debug mode
logging.basicConfig(level=logging.DEBUG)

client = IgrisClient(
    api_key="your-key",
    debug=True,  # Enables verbose logging
    log_requests=True,  # Logs all HTTP requests
    log_responses=True,  # Logs all HTTP responses
)

# Custom logger configuration
logger = logging.getLogger('igris_overture')
logger.setLevel(logging.DEBUG)

# File handler for persistent logging
file_handler = logging.FileHandler('igris_overture_debug.log')
file_handler.setLevel(logging.DEBUG)

# Console handler for immediate feedback
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Detailed formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)
```

## Requirements

- Python 3.8+
- httpx or aiohttp (for HTTP requests)
- pydantic (for data validation)
- python-dateutil (for date handling)

## Documentation

- [API Documentation](https://docs.igris-inertial.com/api)
- [SDK Documentation](https://docs.igris-inertial.com/sdk/python)
- [Getting Started Guide](https://docs.igris-inertial.com/getting-started)
- [Examples Repository](https://github.com/igris-inertial/python-sdk-examples)

## Support

- [Support Center](https://support.igris-inertial.com)
- [GitHub Issues](https://github.com/igris-inertial/python-sdk/issues)
- [Community Forum](https://community.igris-inertial.com)
- Email: support@igris-inertial.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

Made with ❤️ by the **Igris-engine** team