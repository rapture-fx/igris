"""
UNIFIED PIPELINE USAGE EXAMPLES
==============================

Comprehensive examples showing how to use the unified data processing pipeline
for various scenarios including web UI integration and API usage.
"""

import asyncio
import json
from typing import Dict, Any, List
from datetime import datetime

# Example configurations and usage patterns

# ==================== 1. FILE UPLOAD PIPELINE ====================

async def example_file_upload_pipeline():
    """
    Example: Upload a CSV file and create a comprehensive processing pipeline
    """
    
    # This would be called from a web UI or API client
    pipeline_config = {
        "name": "Customer Data Analysis",
        "description": "Comprehensive analysis of customer data CSV file",
        "workspace_id": "workspace_123",
        "source_type": "file_upload",
        "source_config": {
            "file_path": "/uploads/customer_data.csv"
        },
        "processing": {
            "processing_mode": "standard",
            "enable_ai_analysis": True,
            "enable_auto_cleaning": True,
            "enable_ml_preparation": True,
            "quality_threshold": 0.8,
            "auto_labeling": True,
            "feature_engineering": True,
            "parallel_processing": True,
            "memory_limit_gb": 4.0,
            "timeout_minutes": 30
        },
        "output": {
            "target_frameworks": ["scikit_learn", "tensorflow", "pytorch"],
            "export_formats": ["pandas", "numpy", "csv"],
            "enable_webhooks": True,
            "notify_on_completion": True,
            "notify_on_error": True
        }
    }
    
    # Create pipeline via API
    """
    POST /api/v1/pipelines/create
    {
        "name": "Customer Data Analysis",
        "description": "Comprehensive analysis of customer data CSV file",
        "workspace_id": "workspace_123",
        "source_type": "file_upload",
        "source_config": {...},
        "processing": {...},
        "output": {...}
    }
    
    Response:
    {
        "pipeline_id": "pipeline_abc123",
        "name": "Customer Data Analysis",
        "status": "initialization",
        "progress": 0.0,
        "created_at": "2024-01-15T10:30:00Z"
    }
    """
    
    # Execute pipeline
    """
    POST /api/v1/pipelines/pipeline_abc123/execute
    {
        "background": true,
        "webhook_url": "https://myapp.com/webhooks/pipeline-updates"
    }
    
    Response:
    {
        "pipeline_id": "pipeline_abc123",
        "job_id": "job_xyz789",
        "status": "started",
        "message": "Pipeline execution started in background",
        "background": true
    }
    """

# ==================== 2. DATABASE CONNECTION PIPELINE ====================

async def example_database_pipeline():
    """
    Example: Connect to PostgreSQL database and process data
    """
    
    pipeline_config = {
        "name": "Sales Analytics from Database",
        "description": "Extract sales data from PostgreSQL and prepare for ML",
        "workspace_id": "workspace_123",
        "source_type": "database",
        "source_config": {
            "connection_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "sales_db",
            "username": "analytics_user",
            "password": "secure_password",
            "ssl": True,
            "query": """
                SELECT 
                    customer_id,
                    product_category,
                    purchase_amount,
                    purchase_date,
                    customer_segment
                FROM sales_transactions 
                WHERE purchase_date >= '2023-01-01'
                ORDER BY purchase_date DESC
            """
        },
        "processing": {
            "processing_mode": "standard",
            "enable_ai_analysis": True,
            "enable_auto_cleaning": True,
            "enable_ml_preparation": True,
            "quality_threshold": 0.85,
            "auto_labeling": True,
            "feature_engineering": True
        },
        "output": {
            "target_frameworks": ["scikit_learn", "xgboost", "lightgbm"],
            "export_formats": ["pandas", "parquet"],
            "output_destination": "s3://ml-models/sales-analytics/",
            "enable_webhooks": True
        }
    }
    
    # The pipeline will:
    # 1. Connect to PostgreSQL database
    # 2. Execute the SQL query to extract data
    # 3. Run AI analysis for pattern detection
    # 4. Clean and transform the data
    # 5. Prepare for ML frameworks
    # 6. Export to S3 in multiple formats

# ==================== 3. API ENDPOINT PIPELINE ====================

async def example_api_endpoint_pipeline():
    """
    Example: Fetch data from REST API and process
    """
    
    pipeline_config = {
        "name": "Social Media Analytics",
        "description": "Fetch and analyze social media data from API",
        "workspace_id": "workspace_123",
        "source_type": "api_endpoint",
        "source_config": {
            "url": "https://api.social-platform.com/v1/posts",
            "method": "GET",
            "headers": {
                "Accept": "application/json",
                "User-Agent": "Schlep-Engine/1.0"
            },
            "auth_type": "bearer_token",
            "auth_config": {
                "token": "your_api_token_here"
            },
            "data_path": "$.data.posts"  # JSON path to extract data
        },
        "processing": {
            "processing_mode": "ai_enhanced",
            "enable_ai_analysis": True,
            "enable_auto_cleaning": True,
            "enable_ml_preparation": True,
            "quality_threshold": 0.7,
            "auto_labeling": True,
            "feature_engineering": True
        },
        "output": {
            "target_frameworks": ["huggingface", "tensorflow"],
            "export_formats": ["json", "csv"],
            "enable_webhooks": True,
            "notify_on_completion": True
        }
    }

# ==================== 4. STREAMING DATA PIPELINE ====================

async def example_streaming_pipeline():
    """
    Example: Process real-time streaming data
    """
    
    pipeline_config = {
        "name": "Real-time IoT Data Processing",
        "description": "Process streaming IoT sensor data in real-time",
        "workspace_id": "workspace_123",
        "source_type": "streaming",
        "source_config": {
            "stream_type": "kafka",
            "kafka_config": {
                "bootstrap_servers": ["localhost:9092"],
                "topic": "iot_sensors",
                "group_id": "schlep_analytics",
                "auto_offset_reset": "latest"
            },
            "batch_size": 1000,
            "batch_timeout_seconds": 30
        },
        "processing": {
            "processing_mode": "streaming",
            "enable_ai_analysis": True,
            "enable_auto_cleaning": True,
            "enable_ml_preparation": False,  # Real-time processing
            "quality_threshold": 0.6,
            "parallel_processing": True,
            "memory_limit_gb": 8.0
        },
        "output": {
            "target_frameworks": ["pandas"],
            "export_formats": ["json"],
            "output_destination": "redis://localhost:6379/processed_data",
            "enable_webhooks": True
        }
    }

# ==================== 5. BULK PIPELINE PROCESSING ====================

async def example_bulk_pipeline_processing():
    """
    Example: Process multiple datasets in parallel
    """
    
    bulk_request = {
        "pipelines": [
            {
                "name": "January Sales Data",
                "workspace_id": "workspace_123",
                "source_type": "file_upload",
                "source_config": {"file_path": "/uploads/sales_jan_2024.csv"},
                "processing": {
                    "enable_ai_analysis": True,
                    "enable_auto_cleaning": True,
                    "quality_threshold": 0.8
                },
                "output": {
                    "target_frameworks": ["scikit_learn"]
                }
            },
            {
                "name": "February Sales Data",
                "workspace_id": "workspace_123",
                "source_type": "file_upload",
                "source_config": {"file_path": "/uploads/sales_feb_2024.csv"},
                "processing": {
                    "enable_ai_analysis": True,
                    "enable_auto_cleaning": True,
                    "quality_threshold": 0.8
                },
                "output": {
                    "target_frameworks": ["scikit_learn"]
                }
            },
            {
                "name": "March Sales Data",
                "workspace_id": "workspace_123",
                "source_type": "file_upload",
                "source_config": {"file_path": "/uploads/sales_mar_2024.csv"},
                "processing": {
                    "enable_ai_analysis": True,
                    "enable_auto_cleaning": True,
                    "quality_threshold": 0.8
                },
                "output": {
                    "target_frameworks": ["scikit_learn"]
                }
            }
        ],
        "execute_immediately": True
    }
    
    # API call:
    """
    POST /api/v1/pipelines/bulk/create
    {
        "pipelines": [...],
        "execute_immediately": true
    }
    
    Response:
    {
        "job_id": "bulk_job_123",
        "total_pipelines": 3,
        "status": "started",
        "message": "Bulk pipeline execution started in background"
    }
    """

# ==================== 6. REAL-TIME MONITORING WITH WEBSOCKETS ====================

async def example_websocket_monitoring():
    """
    Example: Monitor pipeline progress in real-time using WebSockets
    """
    
    # JavaScript client example:
    """
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:8000/api/v1/ws/user_123?pipeline_ids=pipeline_abc123&system_events=true');
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        switch(data.event_type) {
            case 'pipeline_progress':
                updateProgressBar(data.data.progress);
                updateStatusMessage(data.data.message);
                break;
                
            case 'pipeline_completed':
                showSuccessNotification(data.data);
                displayResults(data.data.results);
                break;
                
            case 'pipeline_failed':
                showErrorNotification(data.data.error_message);
                break;
                
            case 'system_alert':
                showSystemAlert(data.data);
                break;
        }
    };
    
    // Subscribe to additional pipelines
    ws.send(JSON.stringify({
        type: 'subscribe',
        subscriptions: {
            pipelines: ['pipeline_def456', 'pipeline_ghi789']
        }
    }));
    """

# ==================== 7. PYTHON SDK USAGE ====================

async def example_python_sdk_usage():
    """
    Example: Using the pipeline system with Python SDK
    """
    
    # Python SDK wrapper example:
    """
    from schlep_engine import PipelineClient
    
    # Initialize client
    client = PipelineClient(
        api_url="https://api.schlep-engine.com",
        api_key="your_api_key_here"
    )
    
    # Create and execute pipeline
    pipeline = await client.create_pipeline(
        name="Customer Analysis",
        source_type="file_upload",
        file_path="/path/to/data.csv",
        processing_config={
            "enable_ai_analysis": True,
            "enable_auto_cleaning": True,
            "quality_threshold": 0.8
        },
        output_config={
            "target_frameworks": ["scikit_learn", "tensorflow"]
        }
    )
    
    # Execute pipeline
    result = await client.execute_pipeline(
        pipeline.id,
        background=False  # Wait for completion
    )
    
    # Get results
    print(f"Pipeline completed with quality score: {result.data_quality_score}")
    print(f"Input records: {result.input_records}")
    print(f"Output records: {result.output_records}")
    print(f"Framework exports: {result.framework_exports}")
    
    # Download processed data
    data = await client.download_processed_data(pipeline.id, format="pandas")
    print(data.head())
    """

# ==================== 8. WEBHOOK INTEGRATION ====================

async def example_webhook_integration():
    """
    Example: Integrate with external systems using webhooks
    """
    
    # Webhook endpoint example (Flask):
    """
    from flask import Flask, request, jsonify
    
    app = Flask(__name__)
    
    @app.route('/webhooks/pipeline-updates', methods=['POST'])
    def handle_pipeline_webhook():
        data = request.get_json()
        
        event_type = data.get('event_type')
        pipeline_id = data.get('pipeline_id')
        
        if event_type == 'pipeline_completed':
            # Pipeline completed successfully
            result = data.get('data', {})
            
            # Send notification to team
            send_slack_notification(
                f"Pipeline {pipeline_id} completed successfully! "
                f"Quality score: {result.get('quality_score', 'N/A')}"
            )
            
            # Trigger downstream processes
            trigger_model_training(pipeline_id, result)
            
        elif event_type == 'pipeline_failed':
            # Pipeline failed
            error_message = data.get('data', {}).get('error_message', 'Unknown error')
            
            # Send alert to on-call team
            send_pagerduty_alert(
                f"Pipeline {pipeline_id} failed: {error_message}"
            )
            
        return jsonify({'status': 'received'})
    
    def send_slack_notification(message):
        # Implementation for Slack notification
        pass
    
    def trigger_model_training(pipeline_id, result):
        # Implementation for triggering ML model training
        pass
    
    def send_pagerduty_alert(message):
        # Implementation for PagerDuty alert
        pass
    """

# ==================== 9. ADVANCED CONFIGURATION ====================

async def example_advanced_configuration():
    """
    Example: Advanced pipeline configuration with custom processing
    """
    
    advanced_config = {
        "name": "Advanced Analytics Pipeline",
        "description": "Complex multi-stage data processing with custom configurations",
        "workspace_id": "workspace_123",
        "source_type": "database",
        "source_config": {
            "connection_type": "postgresql",
            "host": "data-warehouse.company.com",
            "port": 5432,
            "database": "analytics_db",
            "username": "analytics_user",
            "password": "secure_password",
            "ssl": True,
            "query": "SELECT * FROM customer_behavior_data WHERE date >= '2024-01-01'"
        },
        "processing": {
            "processing_mode": "ai_enhanced",
            "enable_ai_analysis": True,
            "enable_auto_cleaning": True,
            "enable_ml_preparation": True,
            "quality_threshold": 0.9,
            "auto_labeling": True,
            "feature_engineering": True,
            "parallel_processing": True,
            "memory_limit_gb": 16.0,
            "timeout_minutes": 120,
            # Custom processing options
            "custom_processing": {
                "remove_pii": True,
                "anonymize_data": True,
                "apply_business_rules": True,
                "generate_derived_features": True,
                "validate_data_quality": True
            }
        },
        "output": {
            "target_frameworks": [
                "scikit_learn",
                "tensorflow",
                "pytorch",
                "huggingface",
                "xgboost",
                "lightgbm"
            ],
            "export_formats": ["pandas", "parquet", "csv", "json"],
            "output_destination": "s3://ml-data-lake/processed/",
            "enable_webhooks": True,
            "notify_on_completion": True,
            "notify_on_error": True,
            "custom_webhooks": [
                {
                    "url": "https://api.internal.com/data-pipeline-updates",
                    "events": ["pipeline_completed", "pipeline_failed"],
                    "headers": {
                        "Authorization": "Bearer internal_token"
                    }
                },
                {
                    "url": "https://monitoring.company.com/webhooks/pipeline-metrics",
                    "events": ["pipeline_progress"],
                    "headers": {
                        "X-API-Key": "monitoring_key"
                    }
                }
            ]
        }
    }

# ==================== 10. ERROR HANDLING AND RECOVERY ====================

async def example_error_handling():
    """
    Example: Comprehensive error handling and recovery strategies
    """
    
    # Error handling configuration
    error_config = {
        "retry_policy": {
            "max_retries": 3,
            "retry_delay_seconds": 60,
            "exponential_backoff": True,
            "retry_on_errors": [
                "connection_timeout",
                "temporary_resource_unavailable",
                "rate_limit_exceeded"
            ]
        },
        "fallback_strategies": {
            "on_data_source_failure": "use_cached_data",
            "on_processing_failure": "partial_processing",
            "on_export_failure": "save_to_local_storage"
        },
        "notification_settings": {
            "notify_on_retry": True,
            "notify_on_fallback": True,
            "escalation_threshold": 2
        }
    }
    
    # API response for error scenarios:
    """
    {
        "pipeline_id": "pipeline_abc123",
        "status": "failed",
        "error_message": "Connection to database failed after 3 retries",
        "error_details": {
            "error_type": "connection_timeout",
            "retry_count": 3,
            "last_retry_at": "2024-01-15T10:45:00Z",
            "fallback_strategy": "use_cached_data",
            "fallback_applied": true
        },
        "recovery_suggestions": [
            "Check database connectivity",
            "Verify credentials",
            "Try again with smaller batch size"
        ]
    }
    """

# ==================== USAGE SUMMARY ====================

def print_usage_summary():
    """
    Print a summary of all available pipeline features
    """
    
    summary = """
    🚀 UNIFIED PIPELINE SYSTEM - USAGE SUMMARY
    ==========================================
    
    📥 DATA SOURCES SUPPORTED:
    • File Upload (CSV, JSON, Excel, Parquet)
    • Database Connections (PostgreSQL, MySQL, MongoDB)
    • API Endpoints (REST, GraphQL)
    • Cloud Storage (AWS S3, GCP, Azure)
    • Streaming Data (Kafka, Redis, WebSocket)
    • Web URLs (scraping)
    
    🤖 AI-POWERED FEATURES:
    • Automatic pattern detection
    • Anomaly detection and alerting
    • Data quality assessment
    • Auto-labeling and classification
    • Feature engineering
    • Intelligent data cleaning
    
    🔧 PROCESSING CAPABILITIES:
    • Smart duplicate removal
    • Missing value imputation
    • Outlier detection and handling
    • Format normalization
    • Data validation
    • Custom transformations
    
    📊 ML FRAMEWORK EXPORTS:
    • TensorFlow (tf.data.Dataset)
    • PyTorch (DataLoader)
    • Scikit-learn (arrays, pipelines)
    • HuggingFace (datasets)
    • XGBoost & LightGBM
    • ONNX model format
    
    🔄 EXECUTION MODES:
    • Synchronous (wait for completion)
    • Asynchronous (background processing)
    • Bulk processing (multiple pipelines)
    • Streaming (real-time processing)
    
    📡 REAL-TIME UPDATES:
    • WebSocket connections
    • Server-Sent Events (SSE)
    • Webhook notifications
    • Progress streaming
    
    🛠️ INTEGRATION OPTIONS:
    • REST API endpoints
    • Python SDK
    • CLI tools
    • Web dashboard
    • Webhook integrations
    
    📈 MONITORING & OBSERVABILITY:
    • Performance metrics
    • System health checks
    • Error tracking
    • Resource usage monitoring
    • Audit logs
    """
    
    print(summary)

if __name__ == "__main__":
    print_usage_summary() 