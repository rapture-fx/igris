# Enhanced Schlep-Engine Features Guide

## "Messy data → ML-ready in API calls"

This document describes the enhanced distributed processing system that delivers on the core vision of transforming messy data into ML-ready datasets through simple API calls.

## 🚀 Core Enhancements

### 1. DistributedDataProcessor.process_large_dataset()

**Enhanced distributed processor with:**
- Support for CSV, JSONL, Parquet input formats
- Handle datasets up to ~50GB efficiently
- Progress tracking + job status endpoint
- Dask for parallel processing on single node
- VPS budget target: < $50/month

#### API Usage:

```python
POST /api/v1/distributed-processing/process-large-dataset
{
    "input_path": "/path/to/large_dataset.csv",
    "output_path": "/path/to/processed_output.parquet",
    "format": "csv",
    "metadata": {
        "description": "Large customer dataset",
        "source": "production_db"
    }
}
```

#### Response:
```json
{
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Processing started successfully",
    "status_endpoint": "/distributed-processing/status/550e8400-e29b-41d4-a716-446655440000"
}
```

#### Features:
- **Memory Management**: Automatically handles large datasets with memory-efficient chunking
- **Progress Tracking**: Real-time progress updates with estimated completion times
- **Fault Tolerance**: Automatic recovery from processing errors
- **Cost Optimization**: Single-node Dask processing keeps VPS costs under $50/month

### 2. TrainingDataManager

**Dataset versioning, splitting strategies, and provenance tracking:**
- Dataset versioning (store dataset hash + metadata in Postgres)
- Splitting strategies: random, stratified, temporal
- Store provenance info (dataset_id, hash, split config)

#### Create Dataset:

```python
POST /api/v1/distributed-processing/datasets
{
    "name": "customer_churn_dataset",
    "description": "Customer behavior data for churn prediction",
    "dataset_type": "classification",
    "file_path": "/data/customer_data.csv",
    "tags": ["customer", "churn", "production"],
    "auto_version": true
}
```

#### Create Dataset Splits:

```python
POST /api/v1/distributed-processing/datasets/splits
{
    "dataset_version_id": "550e8400-e29b-41d4-a716-446655440001",
    "split_strategy": "stratified",
    "train_ratio": 0.7,
    "val_ratio": 0.15,
    "test_ratio": 0.15,
    "target_column": "churn_label",
    "random_seed": 42
}
```

#### Features:
- **Version Control**: Full dataset versioning with hash-based integrity
- **Smart Splitting**: Stratified, temporal, and random splitting strategies
- **Provenance Tracking**: Complete data lineage and transformation history
- **Quality Metrics**: Automatic quality assessment for each split

### 3. FoundationModelPrep

**Foundation model preparation service:**
- Wrap Hugging Face tokenizers + datasets libraries
- Tokenization for large text corpora (streaming)
- Sequence packing + batching
- Deduplication of samples
- Text-only support (skip multimodal)

#### Prepare Dataset for Pretraining:

```python
POST /api/v1/distributed-processing/foundation-model/prepare
{
    "input_path": "/data/text_corpus.jsonl",
    "output_path": "/data/prepared_for_training/",
    "model_name_or_path": "gpt2",
    "max_sequence_length": 2048,
    "text_column": "text",
    "tokenization_strategy": "autoregressive",
    "enable_deduplication": true,
    "similarity_threshold": 0.9,
    "batch_size": 1000
}
```

#### Features:
- **Efficient Tokenization**: Streaming tokenization for large text corpora
- **Deduplication**: Removes exact and near-duplicate text samples
- **Sequence Packing**: Intelligent packing of sequences for training efficiency
- **Memory Optimization**: Handles large datasets without memory issues
- **Format Support**: JSONL, CSV, TXT input formats

### 4. RealtimeQualityMonitor.monitor_training_data_quality()

**Enhanced quality monitoring:**
- Process batch datasets (not live streams)
- Metrics: Missing values ratio, Class imbalance detection, Simple bias/drift check
- Output: JSON + optional PDF report
- Endpoint to trigger + fetch reports

#### Monitor Data Quality:

```python
POST /api/v1/distributed-processing/quality/monitor
{
    "dataset_path": "/data/training_data.csv",
    "dataset_id": "550e8400-e29b-41d4-a716-446655440002",
    "target_column": "target_variable",
    "checks_to_run": ["missing_values", "class_imbalance", "bias_drift"],
    "report_format": "both",
    "missing_threshold_warning": 10.0,
    "missing_threshold_critical": 30.0
}
```

#### Features:
- **Comprehensive Analysis**: Missing values, class imbalance, drift detection
- **Visual Reports**: JSON and PDF report generation
- **Actionable Insights**: Specific recommendations for data quality improvement
- **Automated Monitoring**: Integration with dataset lifecycle

## 📊 System Architecture

### Cost-Efficient Design
- **Single-Node Processing**: Uses Dask for parallel processing without expensive cluster setup
- **Memory Management**: Intelligent chunking and spilling to disk
- **Resource Optimization**: Configurable worker counts and memory limits
- **VPS-Friendly**: Designed to run efficiently on mid-tier VPS instances

### Database Schema

The enhanced system adds several new tables:

#### dataset_splits
- Stores train/validation/test split configurations and metadata
- Links to dataset versions for complete provenance

#### foundation_model_jobs
- Tracks foundation model preparation jobs
- Stores tokenization and deduplication results

#### distributed_processing_jobs
- Monitors large dataset processing jobs
- Tracks performance metrics and resource usage

#### quality_monitoring_jobs
- Stores quality analysis results
- Links to datasets for historical quality tracking

## 🔧 Installation & Setup

### 1. Install Dependencies

```bash
# Core dependencies
pip install dask[complete] pandas pyarrow

# Foundation model prep (optional)
pip install transformers datasets torch

# PDF generation (optional)
pip install reportlab matplotlib seaborn

# Database migration
alembic upgrade head
```

### 2. Configuration

Update your environment variables:

```bash
# Dask configuration
DASK_MAX_WORKERS=4
DASK_MEMORY_LIMIT=8GB
DASK_ENABLE_DASHBOARD=false

# Processing limits
MAX_DATASET_SIZE_GB=50
DEFAULT_CHUNK_SIZE=50000

# Storage paths
DATA_STORAGE_PATH=/data
REPORTS_OUTPUT_PATH=/data/reports
```

### 3. Service Integration

The enhanced services are automatically available through the existing FastAPI application:

```python
from app.services import (
    distributed_processor,
    training_data_manager,
    foundation_model_prep,
    realtime_quality_monitor
)
```

## 🔄 Complete Workflow Example

Here's a complete example of using all enhanced features together:

### Step 1: Process Large Dataset

```python
# Upload and process a large CSV file
POST /api/v1/distributed-processing/process-large-dataset
{
    "input_path": "/uploads/large_customer_data.csv",
    "output_path": "/processed/customer_data_clean.parquet",
    "format": "csv"
}

# Response: {"job_id": "job_123", "status_endpoint": "/status/job_123"}
```

### Step 2: Create Dataset with Versioning

```python
# Create versioned dataset
POST /api/v1/distributed-processing/datasets
{
    "name": "customer_analytics_v1",
    "description": "Cleaned customer data for analytics",
    "dataset_type": "tabular",
    "file_path": "/processed/customer_data_clean.parquet"
}

# Response: {"dataset_id": "dataset_456"}
```

### Step 3: Quality Monitoring

```python
# Analyze data quality
POST /api/v1/distributed-processing/quality/monitor
{
    "dataset_path": "/processed/customer_data_clean.parquet",
    "dataset_id": "dataset_456",
    "target_column": "churn_probability",
    "report_format": "both"
}

# Response: {"job_id": "quality_789"}
```

### Step 4: Create Training Splits

```python
# Create stratified splits for ML training
POST /api/v1/distributed-processing/datasets/splits
{
    "dataset_version_id": "version_101112",
    "split_strategy": "stratified",
    "target_column": "churn_probability",
    "train_ratio": 0.7,
    "val_ratio": 0.15,
    "test_ratio": 0.15
}

# Response: {
#   "split_id": "split_131415",
#   "train_path": "/splits/split_131415_train.parquet",
#   "val_path": "/splits/split_131415_val.parquet",
#   "test_path": "/splits/split_131415_test.parquet"
# }
```

### Step 5: Foundation Model Preparation (for text data)

```python
# Prepare text data for foundation model training
POST /api/v1/distributed-processing/foundation-model/prepare
{
    "input_path": "/data/customer_reviews.jsonl",
    "output_path": "/prepared/reviews_tokenized/",
    "model_name_or_path": "gpt2",
    "max_sequence_length": 1024,
    "text_column": "review_text",
    "enable_deduplication": true
}

# Response: {"job_id": "prep_161718"}
```

## 📈 Performance Monitoring

### System Metrics Endpoint

```python
GET /api/v1/distributed-processing/system-metrics

# Response:
{
    "memory_usage_percent": 45.2,
    "memory_available_gb": 12.8,
    "disk_usage_percent": 30.1,
    "disk_free_gb": 250.5,
    "active_jobs": 3,
    "dask_client_connected": true,
    "dask_workers": 4,
    "dask_tasks": 12
}
```

### Job Status Tracking

```python
GET /api/v1/distributed-processing/status/{job_id}

# Response:
{
    "job_id": "job_123",
    "status": "processing",
    "progress_percentage": 65.4,
    "current_operation": "Applying custom processing",
    "elapsed_time_seconds": 1205.3,
    "estimated_completion": "2024-01-15T14:25:00Z",
    "error_count": 0,
    "warnings": []
}
```

## 🛡️ Error Handling & Recovery

### Automatic Recovery
- Jobs automatically retry on transient failures
- Memory management prevents OOM errors
- Graceful degradation for resource constraints

### Manual Recovery
```python
# Cancel stuck job
DELETE /api/v1/distributed-processing/cancel/{job_id}

# Get detailed error information
GET /api/v1/distributed-processing/status/{job_id}
```

## 🔍 Quality Reports

### JSON Report Structure
```json
{
    "report_id": "quality_789",
    "dataset_path": "/processed/customer_data_clean.parquet",
    "analysis_timestamp": "2024-01-15T12:00:00Z",
    "dataset_info": {
        "total_rows": 1000000,
        "total_columns": 25,
        "dataset_size_mb": 156.7
    },
    "quality_metrics": {
        "overall_quality_score": 87.3,
        "quality_grade": "B",
        "missing_values_ratio": 5.2,
        "class_imbalance_ratio": 0.15,
        "drift_detected": false,
        "recommendations": [
            "Consider imputation for columns with >10% missing values",
            "Monitor class balance for optimal model performance"
        ]
    }
}
```

### PDF Reports
Professional PDF reports include:
- Executive summary with key metrics
- Detailed analysis tables and charts
- Actionable recommendations
- Visual data quality indicators

## 💰 Cost Optimization

### VPS Requirements (< $50/month)
- **RAM**: 16GB recommended
- **CPU**: 4-8 cores
- **Storage**: 100GB+ SSD
- **Network**: Unmetered bandwidth

### Resource Management
```python
# Configure for cost efficiency
config = ProcessingConfig(
    max_memory_gb=8.0,      # Leave headroom for OS
    max_workers=4,          # Match CPU cores
    chunk_size=50000,       # Optimize for memory usage
    enable_compression=True  # Reduce storage costs
)
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all enhanced feature tests
pytest tests/test_distributed_processing.py -v

# Run specific service tests
pytest tests/test_distributed_processing.py::TestDistributedDataProcessor -v
pytest tests/test_distributed_processing.py::TestTrainingDataManager -v
pytest tests/test_distributed_processing.py::TestFoundationModelPrep -v
pytest tests/test_distributed_processing.py::TestRealtimeQualityMonitor -v

# Run integration tests
pytest tests/test_distributed_processing.py::TestIntegration -v
```

## 📚 Additional Resources

- **API Documentation**: Available at `/docs` when running the server
- **Database Schema**: See `alembic/versions/add_distributed_processing_models.py`
- **Service Code**: Located in `app/services/`
- **Test Examples**: See `tests/test_distributed_processing.py`

## 🎯 Key Benefits

1. **Scalability**: Handle datasets up to 50GB on a single VPS
2. **Cost Efficiency**: Sub-$50/month VPS budget
3. **Automation**: Complete "messy data → ML-ready" pipeline
4. **Quality**: Comprehensive data quality assessment and monitoring
5. **Provenance**: Full data lineage and versioning
6. **Integration**: Seamless integration with existing Schlep-Engine infrastructure

This enhanced system delivers on the core promise: transforming messy data into ML-ready datasets through simple API calls, all while maintaining cost efficiency and production readiness.