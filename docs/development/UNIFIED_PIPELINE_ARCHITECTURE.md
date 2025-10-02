# Unified Data Processing Pipeline Architecture

## Overview

The Unified Data Processing Pipeline is a comprehensive, data infrastructure system that handles data from multiple sources, applies intelligent analysis and cleaning, and exports to ML frameworks. It provides a single entry point for both web UI and API requests with real-time monitoring and event-driven architecture.

## 🏗️ Architecture Components

### 1. **Pipeline Orchestrator** (`pipeline_orchestrator.py`)
- **Purpose**: Central coordination of all data processing workflows
- **Features**:
  - Unified entry point for all data processing requests
  - Intelligent routing based on data source and requirements
  - Comprehensive error handling and recovery
  - Performance monitoring and optimization
  - Real-time progress tracking

### 2. **Unified API Layer** (`unified_pipeline.py`)
- **Purpose**: Single API interface for both web UI and API clients
- **Endpoints**:
  - `POST /api/v1/pipelines/create` - Create new pipeline
  - `POST /api/v1/pipelines/upload-and-create` - Upload file and create pipeline
  - `POST /api/v1/pipelines/{id}/execute` - Execute pipeline
  - `GET /api/v1/pipelines/{id}/status` - Get pipeline status
  - `GET /api/v1/pipelines/list` - List pipelines with filtering
  - `POST /api/v1/pipelines/bulk/create` - Bulk pipeline creation

### 3. **Background Processing** (`pipeline_tasks.py`)
- **Purpose**: Asynchronous execution using Celery
- **Features**:
  - Background pipeline execution
  - Bulk processing capabilities
  - Automatic cleanup and maintenance
  - Health monitoring and alerting

### 4. **Real-time Updates** (`websocket_manager.py`)
- **Purpose**: Event-driven architecture for real-time notifications
- **Features**:
  - WebSocket connections for live updates
  - Event broadcasting to subscribed clients
  - Progress streaming
  - System health notifications

### 5. **Data Sources Integration**
- **File Upload**: CSV, JSON, Excel, Parquet files
- **Database**: PostgreSQL, MySQL, MongoDB connections
- **APIs**: REST, GraphQL endpoint integration
- **Cloud Storage**: AWS S3, GCP, Azure Blob
- **Streaming**: Kafka, Redis, WebSocket streams

### 6. **AI-Powered Processing**
- **Pattern Detection**: Automatic identification of data patterns
- **Anomaly Detection**: Real-time anomaly identification
- **Quality Assessment**: Data quality scoring and recommendations
- **Auto-Labeling**: Intelligent data labeling
- **Feature Engineering**: Automated feature generation

### 7. **ML Framework Exports**
- **TensorFlow**: tf.data.Dataset format
- **PyTorch**: DataLoader compatible format
- **Scikit-learn**: Arrays and pipelines
- **HuggingFace**: Datasets integration
- **XGBoost/LightGBM**: Structured data formats
- **ONNX**: Model interoperability

## 🚀 Getting Started

### Prerequisites

```bash
# Python dependencies
pip install -r requirements.txt

# Redis for message broker
redis-server

# PostgreSQL for database
psql -U postgres -c "CREATE DATABASE schlep_engine;"

# Celery worker processes
celery -A app.core.celery_app worker --loglevel=info
```

### Basic Usage

#### 1. File Upload Pipeline

```python
# Create pipeline for uploaded CSV file
curl -X POST "http://localhost:8000/api/v1/pipelines/upload-and-create" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data.csv" \
  -F "name=Customer Analysis" \
  -F "workspace_id=workspace_123" \
  -F "processing_config={\"enable_ai_analysis\": true, \"quality_threshold\": 0.8}" \
  -F "output_config={\"target_frameworks\": [\"scikit_learn\", \"tensorflow\"]}"
```

#### 2. Database Connection Pipeline

```python
# Create pipeline from database query
curl -X POST "http://localhost:8000/api/v1/pipelines/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Analytics",
    "workspace_id": "workspace_123",
    "source_type": "database",
    "source_config": {
      "connection_type": "postgresql",
      "host": "localhost",
      "port": 5432,
      "database": "sales_db",
      "username": "user",
      "password": "password",
      "query": "SELECT * FROM sales_data WHERE date >= '2024-01-01'"
    },
    "processing": {
      "enable_ai_analysis": true,
      "enable_auto_cleaning": true,
      "quality_threshold": 0.8
    },
    "output": {
      "target_frameworks": ["scikit_learn", "xgboost"]
    }
  }'
```

#### 3. Real-time Monitoring

```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:8000/api/v1/ws/user_123?pipeline_ids=pipeline_abc123');

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Pipeline update:', data);
    
    if (data.event_type === 'pipeline_progress') {
        updateProgressBar(data.data.progress);
    }
};
```

## 📊 Configuration Options

### Processing Configuration

```json
{
  "processing": {
    "processing_mode": "standard",        // fast, standard, streaming, ai_enhanced
    "enable_ai_analysis": true,           // Enable AI pattern detection
    "enable_auto_cleaning": true,         // Enable automatic data cleaning
    "enable_ml_preparation": true,        // Prepare data for ML frameworks
    "quality_threshold": 0.8,             // Data quality threshold (0-1)
    "auto_labeling": true,                // Enable automatic labeling
    "feature_engineering": true,          // Enable feature engineering
    "parallel_processing": true,          // Enable parallel processing
    "memory_limit_gb": 4.0,               // Memory limit in GB
    "timeout_minutes": 60                 // Processing timeout
  }
}
```

### Output Configuration

```json
{
  "output": {
    "target_frameworks": [                // Target ML frameworks
      "scikit_learn",
      "tensorflow", 
      "pytorch",
      "huggingface",
      "xgboost",
      "lightgbm"
    ],
    "export_formats": [                   // Export formats
      "pandas",
      "numpy",
      "csv",
      "json",
      "parquet"
    ],
    "output_destination": "s3://bucket/path/",  // Optional output destination
    "enable_webhooks": true,              // Enable webhook notifications
    "notify_on_completion": true,         // Notify when completed
    "notify_on_error": true               // Notify on errors
  }
}
```

## 🔧 Advanced Features

### Bulk Processing

```python
# Process multiple datasets in parallel
curl -X POST "http://localhost:8000/api/v1/pipelines/bulk/create" \
  -H "Content-Type: application/json" \
  -d '{
    "pipelines": [
      {
        "name": "Dataset 1",
        "workspace_id": "workspace_123",
        "source_type": "file_upload",
        "source_config": {"file_path": "/uploads/data1.csv"},
        "processing": {"enable_ai_analysis": true},
        "output": {"target_frameworks": ["scikit_learn"]}
      },
      {
        "name": "Dataset 2", 
        "workspace_id": "workspace_123",
        "source_type": "file_upload",
        "source_config": {"file_path": "/uploads/data2.csv"},
        "processing": {"enable_ai_analysis": true},
        "output": {"target_frameworks": ["scikit_learn"]}
      }
    ],
    "execute_immediately": true
  }'
```

### Streaming Data Processing

```python
# Process streaming data from Kafka
pipeline_config = {
    "name": "Real-time IoT Processing",
    "source_type": "streaming",
    "source_config": {
        "stream_type": "kafka",
        "kafka_config": {
            "bootstrap_servers": ["localhost:9092"],
            "topic": "iot_sensors",
            "group_id": "analytics_group"
        }
    },
    "processing": {
        "processing_mode": "streaming",
        "enable_ai_analysis": true,
        "memory_limit_gb": 8.0
    }
}
```

### Custom Webhook Integration

```python
# Set up webhook notifications
webhook_config = {
    "output": {
        "enable_webhooks": true,
        "custom_webhooks": [
            {
                "url": "https://api.yourapp.com/pipeline-updates",
                "events": ["pipeline_completed", "pipeline_failed"],
                "headers": {
                    "Authorization": "Bearer your_token"
                }
            }
        ]
    }
}
```

## 🛠️ Deployment Guide

### Development Environment

```bash
# 1. Start Redis
redis-server

# 2. Start PostgreSQL
sudo systemctl start postgresql

# 3. Run database migrations
alembic upgrade head

# 4. Start Celery worker
celery -A app.core.celery_app worker --loglevel=info --queue=pipeline_execution,data_processing,ai_processing

# 5. Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Deployment

#### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  
  worker:
    build: .
    command: celery -A app.core.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=schlep_engine
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

#### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pipeline-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pipeline-api
  template:
    metadata:
      labels:
        app: pipeline-api
    spec:
      containers:
      - name: api
        image: schlep-engine:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pipeline-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: pipeline-secrets
              key: redis-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

## 📈 Monitoring and Observability

### Health Checks

```python
# System health endpoint
GET /api/v1/pipelines/health

# Response:
{
  "status": "healthy",
  "components": {
    "orchestrator": "healthy",
    "unified_processor": "healthy",
    "ml_engine": "healthy",
    "framework_integrator": "healthy"
  },
  "active_pipelines": 5,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Performance Metrics

```python
# Performance metrics endpoint
GET /api/v1/pipelines/metrics

# Response:
{
  "performance_metrics": {
    "total_pipelines": 1250,
    "successful_pipelines": 1180,
    "failed_pipelines": 70,
    "average_processing_time": 45.2,
    "total_data_processed_gb": 2048.5
  },
  "system_status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### WebSocket Statistics

```python
# WebSocket connection stats
GET /api/v1/ws/stats

# Response:
{
  "total_connections": 1500,
  "active_connections": 42,
  "messages_sent": 25000,
  "errors": 15,
  "users_connected": 38,
  "pipeline_subscriptions": 15,
  "workspace_subscriptions": 8,
  "system_subscriptions": 5
}
```

## 🔒 Security Considerations

### Authentication & Authorization

```python
# All endpoints require authentication
headers = {
    "Authorization": "Bearer your_jwt_token"
}

# User can only access their own pipelines
# Workspace-level access control
# Admin users can access all pipelines
```

### Data Privacy

```python
# PII removal and anonymization
processing_config = {
    "custom_processing": {
        "remove_pii": True,
        "anonymize_data": True,
        "apply_privacy_filters": True
    }
}
```

### Encryption

```python
# Data encryption at rest and in transit
# Secure database connections (SSL/TLS)
# Encrypted temporary file storage
# Secure API communication
```

## 🎯 Best Practices

### 1. **Pipeline Configuration**
- Use appropriate processing modes based on data size
- Set reasonable memory limits and timeouts
- Enable AI analysis for better insights
- Configure webhooks for monitoring

### 2. **Error Handling**
- Implement retry policies for transient failures
- Set up comprehensive monitoring and alerting
- Use fallback strategies for critical pipelines
- Log all errors for debugging

### 3. **Performance Optimization**
- Use streaming mode for large datasets (>1GB)
- Enable parallel processing when possible
- Configure appropriate memory limits
- Monitor resource usage

### 4. **Data Quality**
- Set appropriate quality thresholds
- Enable automatic cleaning
- Review AI recommendations
- Validate results before ML training

### 5. **Security**
- Use secure connections for all data sources
- Implement proper authentication
- Remove PII data when possible
- Audit all pipeline activities

## 🚀 Future Enhancements

### Planned Features
- **AutoML Integration**: Automatic model selection and training
- **Data Lineage Tracking**: Complete data provenance
- **Advanced Scheduling**: Cron-based pipeline execution
- **Multi-cloud Support**: Support for multiple cloud providers
- **Custom Transformations**: User-defined processing steps
- **Integration Hub**: Pre-built connectors for popular services

### Roadmap
- Q1 2024: Advanced monitoring and alerting
- Q2 2024: AutoML integration
- Q3 2024: Multi-cloud deployment
- Q4 2024: Enterprise features and compliance

## 📞 Support

For technical support and questions:
- Documentation: [docs.schlep-engine.com](https://docs.schlep-engine.com)
- GitHub Issues: [github.com/schlep-engine/issues](https://github.com/schlep-engine/issues)
- Community Discord: [discord.gg/schlep-engine](https://discord.gg/schlep-engine)
- Email: support@schlep-engine.com

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

---

*Built with ❤️ for the data science community* 