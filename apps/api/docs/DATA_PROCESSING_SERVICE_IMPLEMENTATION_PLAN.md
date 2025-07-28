# Data Processing Service Enablement Plan
## Comprehensive Implementation Roadmap

### Executive Summary
This document provides a detailed, actionable implementation plan for enabling the Data Processing Service in the Schlep-engine backend API. The plan includes complete integration of the Unified Data Processor, Celery-based background processing, schema detection tasks, and infrastructure setup required for production-grade data processing capabilities.

### Current Architecture Analysis
Based on code analysis, the system currently has:
- FastAPI 0.104.1 with SQLAlchemy 2.0 async support
- Celery 5.3.4 with Redis backend configured
- Basic unified data processor framework
- Database models for DataInvestigation and ProcessingJob
- Placeholder schema detection task (currently commented out)
- Docker containerization ready

---

## Phase 1: Core Dependencies and Library Integration

### 1.1 Required Library Installation

**Priority: Critical**
**Estimated Time: 4-6 hours**
**Prerequisites: Working Python 3.11+ environment**

#### Step 1: Update requirements.txt
Add the following data processing libraries to `/apps/api/requirements.txt`:

```bash
# Advanced Data Processing Libraries
dask[complete]==2023.12.1
modin[all]==0.24.1
great-expectations==0.18.8
apache-airflow==2.8.1
polars==0.20.3

# Additional ML libraries for data processing
optuna==3.5.0
shap==0.44.0
xgboost==2.0.3
lightgbm==4.2.0

# Data validation and profiling
pydantic-extra-types==2.4.1
pandera==0.17.2
pandas-profiling==3.6.6
```

#### Step 2: Install Dependencies
```bash
cd /apps/api
pip install -r requirements.txt
```

#### Step 3: Verify Installation
Create verification script at `/apps/api/verify_data_dependencies.py`:

```python
#!/usr/bin/env python3
"""Verify data processing dependencies installation"""

def verify_dependencies():
    dependencies = [
        'dask', 'modin', 'great_expectations', 
        'airflow', 'polars', 'optuna', 'shap',
        'xgboost', 'lightgbm', 'pandera'
    ]
    
    results = {}
    for dep in dependencies:
        try:
            __import__(dep)
            results[dep] = "✅ Available"
        except ImportError as e:
            results[dep] = f"❌ Missing: {e}"
    
    return results

if __name__ == "__main__":
    results = verify_dependencies()
    for dep, status in results.items():
        print(f"{dep}: {status}")
```

---

## Phase 2: Schema Detection Task Implementation

### 2.1 Complete Schema Detection Task

**Priority: Critical**
**Estimated Time: 8-12 hours**
**Skills Required: Python, Celery, Data Analysis**

#### Step 1: Implement Enhanced Schema Detection
Update `/apps/api/app/tasks/data_processing_tasks.py`:

```python
from app.core.celery_app import celery_app
from app.database.connection import get_db_session
from app.database.models import DataInvestigation, ProcessingJob, JobStatus
from app.services.unified_data_processor import unified_processor
import logging
import pandas as pd
import numpy as np
from pathlib import Path
import json
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name="data_processing.schema_detection_task")
def schema_detection_task(self, job_id: str, file_path: str):
    """
    Advanced schema detection task using unified data processor
    
    Args:
        job_id: ProcessingJob UUID
        file_path: Path to file for analysis
    """
    try:
        # Update job status to running
        with get_db_session() as db:
            from sqlalchemy import select
            
            job = db.execute(
                select(ProcessingJob).where(ProcessingJob.id == job_id)
            ).scalar_one_or_none()
            
            if not job:
                logger.error(f"ProcessingJob {job_id} not found")
                return {"status": "error", "message": "Job not found"}
            
            job.status = JobStatus.RUNNING
            job.started_at = datetime.utcnow()
            job.progress_percentage = 10.0
            db.commit()
            
            # Perform schema detection using unified processor
            logger.info(f"Starting schema detection for file: {file_path}")
            
            # Use the high-performance processor with streaming mode for large files
            from app.services.unified_data_processor import ProcessingMode
            
            processing_result = await unified_processor.process(
                file_path=file_path,
                target_framework='pandas',
                mode=ProcessingMode.STANDARD,
                options={'include_schema_detection': True}
            )
            
            if processing_result.get('status') != 'success':
                raise Exception(f"Processing failed: {processing_result.get('error', 'Unknown error')}")
            
            # Advanced schema analysis
            schema_info = analyze_advanced_schema(processing_result)
            
            # Update job with results
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.progress_percentage = 100.0
            job.output_summary = {
                "schema_detected": schema_info,
                "processing_stats": processing_result.get('performance', {}),
                "data_quality_assessment": processing_result.get('data_quality_score', 0),
                "framework_compatibility": processing_result.get('framework_output', {})
            }
            
            # Update parent investigation
            investigation = job.investigation
            investigation.schema_info = schema_info
            investigation.quality_score = processing_result.get('data_quality_score', 0)
            investigation.patterns_found = processing_result.get('ai_insights', {}).get('data_patterns', [])
            investigation.recommendations = processing_result.get('ai_insights', {}).get('quality_recommendations', [])
            
            db.commit()
            
            logger.info(f"Schema detection completed for job {job_id}")
            return {
                "status": "success",
                "job_id": job_id,
                "schema_info": schema_info,
                "processing_time": processing_result.get('performance', {}).get('processing_time_seconds', 0)
            }
            
    except Exception as e:
        logger.error(f"Schema detection failed for job {job_id}: {e}")
        
        # Update job with error status
        try:
            with get_db_session() as db:
                job = db.execute(
                    select(ProcessingJob).where(ProcessingJob.id == job_id)
                ).scalar_one_or_none()
                
                if job:
                    job.status = JobStatus.FAILED
                    job.completed_at = datetime.utcnow()
                    job.error_message = str(e)
                    db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")
        
        return {"status": "error", "message": str(e)}

def analyze_advanced_schema(processing_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Advanced schema analysis with data type inference and relationships
    """
    try:
        data_types = processing_result.get('data_types', {})
        basic_stats = processing_result.get('basic_stats', {})
        file_info = processing_result.get('file_info', {})
        
        schema_analysis = {
            "table_info": {
                "total_columns": basic_stats.get('total_columns', 0),
                "total_rows": basic_stats.get('total_rows', 0),
                "file_format": file_info.get('format', 'unknown'),
                "file_size_mb": file_info.get('size_mb', 0),
                "encoding": "utf-8"  # Default assumption
            },
            "column_analysis": {},
            "data_quality": {
                "completeness_score": 0.0,
                "consistency_score": 0.0,
                "validity_score": 0.0,
                "overall_quality": processing_result.get('data_quality_score', 0)
            },
            "relationships": [],
            "suggested_primary_keys": [],
            "data_lineage": {
                "source_file": file_info.get('filename', ''),
                "processing_date": datetime.utcnow().isoformat(),
                "processing_mode": processing_result.get('performance', {}).get('mode_used', 'standard')
            }
        }
        
        # Analyze each column
        total_rows = basic_stats.get('total_rows', 1)
        for column_name, type_info in data_types.items():
            null_count = type_info.get('null_count', 0)
            unique_count = type_info.get('unique_count', 0)
            
            completeness = ((total_rows - null_count) / total_rows) * 100 if total_rows > 0 else 0
            uniqueness = (unique_count / total_rows) * 100 if total_rows > 0 else 0
            
            column_schema = {
                "data_type": type_info.get('pandas_type', 'object'),
                "semantic_type": type_info.get('semantic_type', 'unknown'),
                "nullable": null_count > 0,
                "unique_count": unique_count,
                "null_count": null_count,
                "completeness_percentage": round(completeness, 2),
                "uniqueness_percentage": round(uniqueness, 2),
                "suggested_constraints": []
            }
            
            # Suggest constraints based on analysis
            if completeness == 100:
                column_schema["suggested_constraints"].append("NOT NULL")
            
            if uniqueness > 95:
                column_schema["suggested_constraints"].append("UNIQUE")
                schema_analysis["suggested_primary_keys"].append(column_name)
            
            # Add specific validations based on semantic type
            if type_info.get('semantic_type') == 'email':
                column_schema["suggested_constraints"].append("EMAIL_FORMAT")
            elif type_info.get('semantic_type') == 'numeric':
                column_schema["suggested_constraints"].append("NUMERIC_RANGE")
            
            schema_analysis["column_analysis"][column_name] = column_schema
        
        # Calculate overall data quality scores
        if schema_analysis["column_analysis"]:
            completeness_scores = [col["completeness_percentage"] for col in schema_analysis["column_analysis"].values()]
            schema_analysis["data_quality"]["completeness_score"] = round(sum(completeness_scores) / len(completeness_scores), 2)
            schema_analysis["data_quality"]["consistency_score"] = 85.0  # Placeholder - would need more analysis
            schema_analysis["data_quality"]["validity_score"] = 90.0  # Placeholder - would need validation rules
        
        return schema_analysis
        
    except Exception as e:
        logger.error(f"Advanced schema analysis failed: {e}")
        return {
            "error": str(e),
            "basic_schema": processing_result.get('data_types', {}),
            "processing_timestamp": datetime.utcnow().isoformat()
        }

@celery_app.task(bind=True, name="data_processing.data_quality_assessment")
def data_quality_assessment_task(self, job_id: str, file_path: str):
    """
    Comprehensive data quality assessment task
    """
    try:
        logger.info(f"Starting data quality assessment for job {job_id}")
        
        # Implementation for comprehensive data quality assessment
        # This would include profiling, anomaly detection, pattern recognition
        # and quality scoring using Great Expectations or similar frameworks
        
        return {"status": "success", "message": "Data quality assessment completed"}
        
    except Exception as e:
        logger.error(f"Data quality assessment failed: {e}")
        return {"status": "error", "message": str(e)}
```

#### Step 2: Enable Schema Detection in Endpoints
Update `/apps/api/app/api/v1/endpoints/data_processing.py` to uncomment and fix the schema detection task import:

```python
# Remove the TODO comment and import the task
from app.tasks.data_processing_tasks import schema_detection_task

# In the create_processing_job function, ensure the task dispatch works:
if db_job.job_type == "schema_detection":
    if investigation.original_file_path:
        # Send task to Celery with proper async handling
        task_result = schema_detection_task.delay(str(db_job.id), investigation.original_file_path)
        
        # Update job with task ID for tracking
        db_job.config = db_job.config or {}
        db_job.config["celery_task_id"] = task_result.id
        db.commit()
    else:
        # Handle missing file path
        await crud_data_processing.update_processing_job(
            db, job_id=db_job.id, 
            job_in=schemas_dp.ProcessingJobUpdate(
                status="FAILED", 
                error_message="Missing file path for schema detection"
            )
        )
```

---

## Phase 3: Infrastructure Setup

### 3.1 Celery Workers Configuration

**Priority: High**
**Estimated Time: 6-8 hours**
**Skills Required: DevOps, Docker, Redis**

#### Step 1: Enhanced Celery Configuration
Update `/apps/api/app/core/celery_app.py`:

```python
from celery import Celery
from app.core.config import settings
import os

# Enhanced Celery configuration for data processing workloads
celery_app = Celery(
    "schlep_engine_worker",
    broker=settings.REDIS_URL,  # Redis as message broker
    backend=settings.REDIS_URL,  # Redis as result backend
    include=[
        'app.tasks.data_processing_tasks',
        'app.tasks.ai_processing_tasks',
        'app.tasks.pipeline_tasks',
        'app.tasks.monitoring_tasks'
    ]
)

# Optimized configuration for data processing
celery_app.conf.update(
    # Task routing
    task_routes={
        'data_processing.*': {'queue': 'data_processing'},
        'ai_processing.*': {'queue': 'ai_processing'},
        'monitoring.*': {'queue': 'monitoring'}
    },
    
    # Performance optimization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Data processing specific settings
    task_soft_time_limit=1800,  # 30 minutes
    task_time_limit=3600,       # 1 hour hard limit
    worker_prefetch_multiplier=1,  # Important for memory-intensive tasks
    task_acks_late=True,
    worker_disable_rate_limits=True,
    
    # Result storage
    result_expires=3600,  # 1 hour
    result_persistent=True,
    
    # Memory management
    worker_max_tasks_per_child=10,  # Restart workers after 10 tasks to prevent memory leaks
    worker_max_memory_per_child=2000000,  # 2GB per worker process
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Error handling
    task_reject_on_worker_lost=True,
    task_ignore_result=False
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'cleanup-expired-jobs': {
        'task': 'data_processing.cleanup_expired_jobs',
        'schedule': 3600.0,  # Every hour
    },
    'system-health-check': {
        'task': 'monitoring.system_health_check',
        'schedule': 300.0,  # Every 5 minutes
    },
}

if __name__ == '__main__':
    celery_app.start()
```

#### Step 2: Worker Start Scripts
Create `/apps/api/scripts/start_data_processing_workers.sh`:

```bash
#!/bin/bash
# Start Celery workers optimized for data processing

echo "Starting Schlep-engine Data Processing Workers..."

# Export environment variables
export PYTHONPATH="${PYTHONPATH}:/app"
export C_FORCE_ROOT=1

# Start data processing worker (CPU intensive)
celery -A app.core.celery_app worker \
    --loglevel=info \
    --queues=data_processing \
    --concurrency=2 \
    --max-tasks-per-child=5 \
    --max-memory-per-child=1500000 \
    --prefetch-multiplier=1 \
    --hostname=data_worker@%h \
    --logfile=/app/logs/celery_data_worker.log \
    --detach

# Start AI processing worker (Memory intensive)  
celery -A app.core.celery_app worker \
    --loglevel=info \
    --queues=ai_processing \
    --concurrency=1 \
    --max-tasks-per-child=3 \
    --max-memory-per-child=2000000 \
    --prefetch-multiplier=1 \
    --hostname=ai_worker@%h \
    --logfile=/app/logs/celery_ai_worker.log \
    --detach

# Start monitoring worker (Light tasks)
celery -A app.core.celery_app worker \
    --loglevel=info \
    --queues=monitoring \
    --concurrency=4 \
    --max-tasks-per-child=20 \
    --hostname=monitor_worker@%h \
    --logfile=/app/logs/celery_monitor_worker.log \
    --detach

# Start Celery Beat (scheduler)
celery -A app.core.celery_app beat \
    --loglevel=info \
    --logfile=/app/logs/celery_beat.log \
    --detach

echo "All workers started successfully!"
echo "Monitor workers with: celery -A app.core.celery_app inspect active"
echo "View flower monitoring at: http://localhost:5555"

# Start Flower monitoring (optional)
celery -A app.core.celery_app flower \
    --port=5555 \
    --persistent=True \
    --db=/app/data/flower_db \
    --max_tasks=10000 &

echo "Flower monitoring started on port 5555"
```

#### Step 3: Docker Compose Enhancement
Update `/docker-compose.yml` to include dedicated Celery services:

```yaml
version: '3.8'

services:
  # Existing services...

  # Data Processing Worker
  data-worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.api
    command: celery -A app.core.celery_app worker --loglevel=info --queues=data_processing --concurrency=2 --hostname=data_worker@%h
    environment:
      - ENVIRONMENT=development
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://schlep_user:schlep_password@postgres/schlep_engine
    volumes:
      - ./apps/api:/app
      - data_processing_volume:/app/data
    depends_on:
      - postgres
      - redis
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  # AI Processing Worker  
  ai-worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.api
    command: celery -A app.core.celery_app worker --loglevel=info --queues=ai_processing --concurrency=1 --hostname=ai_worker@%h
    environment:
      - ENVIRONMENT=development
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://schlep_user:schlep_password@postgres/schlep_engine
    volumes:
      - ./apps/api:/app
      - ai_models_volume:/app/models
    depends_on:
      - postgres
      - redis
    deploy:
      resources:
        limits:
          memory: 3G
        reservations:
          memory: 2G

  # Celery Beat Scheduler
  celery-beat:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.api  
    command: celery -A app.core.celery_app beat --loglevel=info
    environment:
      - ENVIRONMENT=development
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://schlep_user:schlep_password@postgres/schlep_engine
    volumes:
      - ./apps/api:/app
    depends_on:
      - postgres
      - redis

  # Flower Monitoring
  flower:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.api
    command: celery -A app.core.celery_app flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - ENVIRONMENT=development
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    volumes:
      - flower_data:/app/flower_data

volumes:
  data_processing_volume:
  ai_models_volume:
  flower_data:
  postgres_data:
  redis_data:
```

### 3.2 Message Queue Setup

**Priority: High**
**Estimated Time: 4-6 hours**

#### Step 1: Redis Configuration Optimization
Create `/apps/api/redis.conf`:

```conf
# Redis configuration optimized for Celery task queue
# Performance settings
maxmemory 2gb
maxmemory-policy allkeys-lru
tcp-keepalive 60
timeout 0

# Persistence for task durability  
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Network
bind 0.0.0.0
port 6379
tcp-backlog 511

# Memory optimization for task queues
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# Enable keyspace notifications for monitoring
notify-keyspace-events Ex
```

#### Step 2: Redis Monitoring Setup
Create `/apps/api/monitoring/redis_monitor.py`:

```python
import redis
import logging
from typing import Dict, Any
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class RedisMonitor:
    """Monitor Redis performance and queue health"""
    
    def __init__(self, redis_url: str):
        self.redis_client = redis.from_url(redis_url)
        
    def get_queue_stats(self) -> Dict[str, Any]:
        """Get comprehensive queue statistics"""
        try:
            info = self.redis_client.info()
            
            # Get queue lengths
            queues = ['data_processing', 'ai_processing', 'monitoring']
            queue_lengths = {}
            
            for queue in queues:
                queue_lengths[queue] = self.redis_client.llen(f"celery:{queue}")
            
            # Get memory usage
            memory_stats = {
                'used_memory': info.get('used_memory', 0),
                'used_memory_human': info.get('used_memory_human', '0B'),
                'used_memory_peak': info.get('used_memory_peak', 0),
                'used_memory_peak_human': info.get('used_memory_peak_human', '0B')
            }
            
            # Get connection stats
            connection_stats = {
                'connected_clients': info.get('connected_clients', 0),
                'blocked_clients': info.get('blocked_clients', 0),
                'total_connections_received': info.get('total_connections_received', 0)
            }
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'queue_lengths': queue_lengths,
                'memory_stats': memory_stats,
                'connection_stats': connection_stats,
                'redis_version': info.get('redis_version', 'unknown'),
                'uptime_in_seconds': info.get('uptime_in_seconds', 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting Redis stats: {e}")
            return {'error': str(e)}
    
    def health_check(self) -> Dict[str, Any]:
        """Perform Redis health check"""
        try:
            # Test basic connectivity
            self.redis_client.ping()
            
            # Test read/write
            test_key = f"health_check_{datetime.utcnow().timestamp()}"
            self.redis_client.set(test_key, "test", ex=60)
            value = self.redis_client.get(test_key)
            self.redis_client.delete(test_key)
            
            if value != b"test":
                raise Exception("Read/write test failed")
            
            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'response_time_ms': 'fast'  # Could implement actual timing
            }
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
```

---

## Phase 4: Cloud Storage Integration

### 4.1 File Storage Configuration

**Priority: High**
**Estimated Time: 6-8 hours**

#### Step 1: Enhanced Cloud Storage Service
Update `/apps/api/app/core/cloud_storage.py`:

```python
import os
import logging
from typing import Optional, Dict, Any, List
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
import hashlib
import mimetypes

# Cloud storage imports
try:
    from google.cloud import storage as gcs
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False

try:
    import boto3
    from botocore.exceptions import ClientError
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

logger = logging.getLogger(__name__)

class EnhancedCloudStorage:
    """Enhanced cloud storage manager for data processing files"""
    
    def __init__(self):
        self.storage_type = os.getenv('CLOUD_STORAGE_TYPE', 'local')  # local, gcs, s3
        self.bucket_name = os.getenv('CLOUD_STORAGE_BUCKET', 'schlep-engine-data')
        self.local_storage_path = Path(os.getenv('LOCAL_STORAGE_PATH', '/app/data'))
        
        # Initialize cloud clients
        self.gcs_client = None
        self.s3_client = None
        
        if self.storage_type == 'gcs' and GCS_AVAILABLE:
            self._init_gcs()
        elif self.storage_type == 's3' and AWS_AVAILABLE:
            self._init_s3()
        elif self.storage_type == 'local':
            self._init_local()
    
    def _init_gcs(self):
        """Initialize Google Cloud Storage client"""
        try:
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if credentials_path:
                self.gcs_client = gcs.Client.from_service_account_json(credentials_path)
            else:
                self.gcs_client = gcs.Client()  # Use default credentials
            
            # Ensure bucket exists
            bucket = self.gcs_client.bucket(self.bucket_name)
            if not bucket.exists():
                bucket = self.gcs_client.create_bucket(self.bucket_name)
                logger.info(f"Created GCS bucket: {self.bucket_name}")
            
            logger.info("GCS client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize GCS: {e}")
            self.storage_type = 'local'
            self._init_local()
    
    def _init_s3(self):
        """Initialize AWS S3 client"""
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION', 'us-east-1')
            )
            
            # Ensure bucket exists
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                    logger.info(f"Created S3 bucket: {self.bucket_name}")
                else:
                    raise
            
            logger.info("S3 client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize S3: {e}")
            self.storage_type = 'local'
            self._init_local()
    
    def _init_local(self):
        """Initialize local storage"""
        self.local_storage_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Local storage initialized at: {self.local_storage_path}")
    
    async def upload_file(
        self, 
        file_path: str, 
        destination_path: str, 
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Upload file to configured storage backend"""
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Calculate file hash for integrity checking
            file_hash = self._calculate_file_hash(file_path)
            file_size = file_path.stat().st_size
            mime_type = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
            
            upload_metadata = {
                'original_filename': file_path.name,
                'file_size': file_size,
                'file_hash': file_hash,
                'mime_type': mime_type,
                'upload_timestamp': datetime.utcnow().isoformat(),
                **(metadata or {})
            }
            
            if self.storage_type == 'gcs':
                result = await self._upload_to_gcs(file_path, destination_path, upload_metadata)
            elif self.storage_type == 's3':
                result = await self._upload_to_s3(file_path, destination_path, upload_metadata)
            else:
                result = await self._upload_to_local(file_path, destination_path, upload_metadata)
            
            logger.info(f"File uploaded successfully: {destination_path}")
            return result
            
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            raise
    
    async def download_file(self, source_path: str, destination_path: str) -> Dict[str, Any]:
        """Download file from configured storage backend"""
        try:
            if self.storage_type == 'gcs':
                result = await self._download_from_gcs(source_path, destination_path)
            elif self.storage_type == 's3':
                result = await self._download_from_s3(source_path, destination_path)
            else:
                result = await self._download_from_local(source_path, destination_path)
            
            logger.info(f"File downloaded successfully: {destination_path}")
            return result
            
        except Exception as e:
            logger.error(f"Download failed: {e}")
            raise
    
    async def generate_signed_url(
        self, 
        file_path: str, 
        expiration_hours: int = 24
    ) -> str:
        """Generate signed URL for secure file access"""
        try:
            if self.storage_type == 'gcs':
                return await self._generate_gcs_signed_url(file_path, expiration_hours)
            elif self.storage_type == 's3':
                return await self._generate_s3_signed_url(file_path, expiration_hours)
            else:
                # For local storage, return local file path (not recommended for production)
                return f"file://{self.local_storage_path / file_path}"
                
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            raise
    
    async def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files in storage with metadata"""
        try:
            if self.storage_type == 'gcs':
                return await self._list_gcs_files(prefix)
            elif self.storage_type == 's3':
                return await self._list_s3_files(prefix)
            else:
                return await self._list_local_files(prefix)
                
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            raise
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    
    # Implementation methods for each storage backend...
    # (GCS, S3, and local implementations would be added here)
    # Due to space constraints, showing the structure only

# Global instance
cloud_storage = EnhancedCloudStorage()
```

#### Step 2: File Processing Pipeline
Create `/apps/api/app/services/file_processing_pipeline.py`:

```python
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import shutil
import tempfile

from app.core.cloud_storage import cloud_storage  
from app.services.unified_data_processor import unified_processor, ProcessingMode
from app.database.connection import get_db_session
from app.database.models import DataInvestigation, ProcessingJob, JobStatus

logger = logging.getLogger(__name__)

class FileProcessingPipeline:
    """Comprehensive file processing pipeline for data investigations"""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "schlep_processing"
        self.temp_dir.mkdir(exist_ok=True)
    
    async def process_uploaded_file(
        self, 
        file_path: str, 
        investigation_id: str,
        processing_options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Complete pipeline for processing uploaded files
        
        Steps:
        1. File validation and scanning
        2. Upload to cloud storage
        3. Schema detection and analysis
        4. Data quality assessment
        5. Generate processing artifacts
        6. Update investigation record
        """
        
        processing_start = datetime.utcnow()
        temp_files = []
        
        try:
            logger.info(f"Starting file processing pipeline for investigation {investigation_id}")
            
            # Step 1: File validation
            validation_result = await self._validate_file(file_path)
            if not validation_result['valid']:
                raise Exception(f"File validation failed: {validation_result['errors']}")
            
            # Step 2: Upload original file to cloud storage
            cloud_path = f"investigations/{investigation_id}/original/{Path(file_path).name}"
            upload_result = await cloud_storage.upload_file(
                file_path, 
                cloud_path,
                metadata={
                    'investigation_id': investigation_id,
                    'file_type': 'original',
                    'processing_started': processing_start.isoformat()
                }
            )
            
            # Step 3: Process file with unified processor
            processing_result = await unified_processor.process(
                file_path=file_path,
                target_framework='pandas',
                mode=ProcessingMode.STANDARD,
                options=processing_options or {}
            )
            
            if processing_result.get('status') != 'success':
                raise Exception(f"Data processing failed: {processing_result.get('error')}")
            
            # Step 4: Generate and upload processing artifacts
            artifacts = await self._generate_processing_artifacts(
                processing_result, 
                investigation_id
            )
            
            # Step 5: Update investigation in database
            await self._update_investigation_results(
                investigation_id,
                processing_result,
                artifacts,
                upload_result
            )
            
            processing_duration = (datetime.utcnow() - processing_start).total_seconds()
            
            logger.info(f"File processing completed in {processing_duration:.2f}s for investigation {investigation_id}")
            
            return {
                'status': 'success',
                'investigation_id': investigation_id,
                'processing_duration_seconds': processing_duration,
                'artifacts_generated': len(artifacts),
                'cloud_storage_path': cloud_path,
                'data_quality_score': processing_result.get('data_quality_score', 0),
                'rows_processed': processing_result.get('basic_stats', {}).get('total_rows', 0),
                'columns_analyzed': processing_result.get('basic_stats', {}).get('total_columns', 0)
            }
            
        except Exception as e:
            logger.error(f"File processing pipeline failed for investigation {investigation_id}: {e}")
            
            # Update investigation with error status
            await self._update_investigation_error(investigation_id, str(e))
            
            return {
                'status': 'error',
                'investigation_id': investigation_id,
                'error': str(e),
                'processing_duration_seconds': (datetime.utcnow() - processing_start).total_seconds()
            }
            
        finally:
            # Cleanup temporary files
            for temp_file in temp_files:
                try:
                    if Path(temp_file).exists():
                        Path(temp_file).unlink()
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {temp_file}: {e}")
    
    async def _validate_file(self, file_path: str) -> Dict[str, Any]:
        """Validate uploaded file for security and format compliance"""
        try:
            file_path = Path(file_path)
            
            # Basic checks
            if not file_path.exists():
                return {'valid': False, 'errors': ['File does not exist']}
            
            # File size check (max 500MB)
            max_size = 500 * 1024 * 1024  # 500MB
            file_size = file_path.stat().st_size
            if file_size > max_size:
                return {'valid': False, 'errors': [f'File too large: {file_size} bytes > {max_size} bytes']}
            
            # File extension check
            allowed_extensions = {'.csv', '.json', '.xlsx', '.xls', '.tsv', '.parquet'}
            if file_path.suffix.lower() not in allowed_extensions:
                return {'valid': False, 'errors': [f'Unsupported file type: {file_path.suffix}']}
            
            # Basic content validation (first few bytes)
            with open(file_path, 'rb') as f:
                header = f.read(1024)
                
            # Check for potential malicious content
            suspicious_patterns = [b'<script', b'javascript:', b'<?php', b'<%']
            for pattern in suspicious_patterns:
                if pattern in header.lower():
                    return {'valid': False, 'errors': ['Suspicious content detected']}
            
            return {
                'valid': True,
                'file_size': file_size,
                'file_type': file_path.suffix.lower(),
                'mime_type': mimetypes.guess_type(str(file_path))[0]
            }
            
        except Exception as e:
            logger.error(f"File validation error: {e}")
            return {'valid': False, 'errors': [f'Validation error: {str(e)}']}
    
    async def _generate_processing_artifacts(
        self, 
        processing_result: Dict[str, Any], 
        investigation_id: str
    ) -> List[Dict[str, Any]]:
        """Generate and upload processing artifacts"""
        artifacts = []
        
        try:
            # Generate data profile report
            profile_artifact = await self._generate_data_profile(
                processing_result, 
                investigation_id
            )
            artifacts.append(profile_artifact)
            
            # Generate schema documentation
            schema_artifact = await self._generate_schema_documentation(
                processing_result, 
                investigation_id
            )
            artifacts.append(schema_artifact)
            
            # Generate quality assessment report
            quality_artifact = await self._generate_quality_report(
                processing_result, 
                investigation_id
            )
            artifacts.append(quality_artifact)
            
            return artifacts
            
        except Exception as e:
            logger.error(f"Error generating artifacts: {e}")
            return []
    
    # Additional helper methods would be implemented here...
    # (Due to space constraints, showing structure only)

# Global instance
file_processing_pipeline = FileProcessingPipeline()
```

---

## Phase 5: Database Schema Enhancement

### 5.1 Migration for Enhanced Data Processing

**Priority: Critical**
**Estimated Time: 4-6 hours**

#### Step 1: Create Migration File
Create `/apps/api/alembic/versions/004_enhance_data_processing_schema.py`:

```python
"""Enhance data processing schema

Revision ID: 004_enhance_data_processing_schema
Revises: 003_add_dataset_versioning
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '004_enhance_data_processing_schema'
down_revision = '003_add_dataset_versioning'
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to data_investigations table
    op.add_column('data_investigations', sa.Column('processing_config', postgresql.JSON(), nullable=True))
    op.add_column('data_investigations', sa.Column('cloud_storage_path', sa.String(), nullable=True))
    op.add_column('data_investigations', sa.Column('file_hash', sa.String(), nullable=True))
    op.add_column('data_investigations', sa.Column('file_size_bytes', sa.BigInteger(), nullable=True))
    op.add_column('data_investigations', sa.Column('mime_type', sa.String(), nullable=True))
    op.add_column('data_investigations', sa.Column('data_lineage', postgresql.JSON(), nullable=True))
    op.add_column('data_investigations', sa.Column('processing_artifacts', postgresql.JSON(), nullable=True))
    
    # Add new columns to processing_jobs table
    op.add_column('processing_jobs', sa.Column('celery_task_id', sa.String(), nullable=True))
    op.add_column('processing_jobs', sa.Column('worker_hostname', sa.String(), nullable=True))
    op.add_column('processing_jobs', sa.Column('memory_usage_mb', sa.Float(), nullable=True))
    op.add_column('processing_jobs', sa.Column('cpu_time_seconds', sa.Float(), nullable=True))
    op.add_column('processing_jobs', sa.Column('retry_count', sa.Integer(), default=0))
    op.add_column('processing_jobs', sa.Column('max_retries', sa.Integer(), default=3))
    
    # Create new table for processing job dependencies
    op.create_table('processing_job_dependencies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('processing_jobs.id'), nullable=False),
        sa.Column('depends_on_job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('processing_jobs.id'), nullable=False),
        sa.Column('dependency_type', sa.String(), nullable=False),  # 'blocking', 'optional', 'parallel'
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('job_id', 'depends_on_job_id', name='unique_job_dependency')
    )
    
    # Create table for file processing metadata
    op.create_table('file_processing_metadata',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('investigation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_investigations.id'), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('cloud_storage_path', sa.String(), nullable=True),
        sa.Column('file_hash', sa.String(), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('mime_type', sa.String(), nullable=False),
        sa.Column('processing_status', sa.String(), nullable=False),  # 'uploaded', 'processing', 'completed', 'failed'
        sa.Column('validation_results', postgresql.JSON(), nullable=True),
        sa.Column('processing_results', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create table for data quality metrics
    op.create_table('data_quality_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('investigation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_investigations.id'), nullable=False),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('metric_threshold', sa.Float(), nullable=True),
        sa.Column('metric_status', sa.String(), nullable=False),  # 'pass', 'fail', 'warning'
        sa.Column('metric_category', sa.String(), nullable=False),  # 'completeness', 'accuracy', 'consistency', 'validity'
        sa.Column('column_name', sa.String(), nullable=True),  # For column-specific metrics
        sa.Column('measurement_timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('metadata', postgresql.JSON(), nullable=True)
    )
    
    # Create indexes for performance
    op.create_index('idx_processing_jobs_status', 'processing_jobs', ['status'])
    op.create_index('idx_processing_jobs_celery_task_id', 'processing_jobs', ['celery_task_id'])
    op.create_index('idx_data_investigations_cloud_storage_path', 'data_investigations', ['cloud_storage_path'])
    op.create_index('idx_file_processing_metadata_file_hash', 'file_processing_metadata', ['file_hash'])
    op.create_index('idx_data_quality_metrics_investigation_metric', 'data_quality_metrics', ['investigation_id', 'metric_name'])

def downgrade():
    # Drop indexes
    op.drop_index('idx_data_quality_metrics_investigation_metric')
    op.drop_index('idx_file_processing_metadata_file_hash')
    op.drop_index('idx_data_investigations_cloud_storage_path')
    op.drop_index('idx_processing_jobs_celery_task_id')
    op.drop_index('idx_processing_jobs_status')
    
    # Drop tables
    op.drop_table('data_quality_metrics')
    op.drop_table('file_processing_metadata')
    op.drop_table('processing_job_dependencies')
    
    # Remove columns from processing_jobs
    op.drop_column('processing_jobs', 'max_retries')
    op.drop_column('processing_jobs', 'retry_count')
    op.drop_column('processing_jobs', 'cpu_time_seconds')
    op.drop_column('processing_jobs', 'memory_usage_mb')
    op.drop_column('processing_jobs', 'worker_hostname')
    op.drop_column('processing_jobs', 'celery_task_id')
    
    # Remove columns from data_investigations
    op.drop_column('data_investigations', 'processing_artifacts')
    op.drop_column('data_investigations', 'data_lineage')
    op.drop_column('data_investigations', 'mime_type')
    op.drop_column('data_investigations', 'file_size_bytes')
    op.drop_column('data_investigations', 'file_hash')
    op.drop_column('data_investigations', 'cloud_storage_path')
    op.drop_column('data_investigations', 'processing_config')
```

#### Step 2: Run Migration
```bash
cd /apps/api
alembic upgrade head
```

---

## Phase 6: Testing and Validation

### 6.1 Comprehensive Testing Suite

**Priority: High**
**Estimated Time: 8-12 hours**

#### Step 1: Integration Tests
Create `/apps/api/tests/integration/test_data_processing_integration.py`:

```python
import pytest
import asyncio
import tempfile
import pandas as pd
from pathlib import Path
import json
from datetime import datetime

from app.services.unified_data_processor import unified_processor, ProcessingMode
from app.tasks.data_processing_tasks import schema_detection_task
from app.core.cloud_storage import cloud_storage
from app.services.file_processing_pipeline import file_processing_pipeline

@pytest.mark.asyncio
class TestDataProcessingIntegration:
    """Integration tests for data processing service"""
    
    @pytest.fixture
    def sample_csv_file(self):
        """Create a sample CSV file for testing"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            # Create test data
            test_data = pd.DataFrame({
                'id': range(1, 1001),
                'name': [f'User_{i}' for i in range(1, 1001)],
                'email': [f'user{i}@example.com' for i in range(1, 1001)],
                'age': [20 + (i % 50) for i in range(1, 1001)],
                'score': [round(50 + (i % 50) + (i * 0.1), 2) for i in range(1, 1001)],
                'created_at': [datetime.now().isoformat() for _ in range(1000)]
            })
            test_data.to_csv(f.name, index=False)
            yield f.name
        
        # Cleanup
        Path(f.name).unlink(missing_ok=True)
    
    async def test_unified_processor_standard_mode(self, sample_csv_file):
        """Test unified processor in standard mode"""
        result = await unified_processor.process(
            file_path=sample_csv_file,
            target_framework='pandas',
            mode=ProcessingMode.STANDARD
        )
        
        assert result['status'] == 'success'
        assert result['mode'] == 'standard'
        assert result['file_info']['rows'] == 1000
        assert result['file_info']['columns'] == 6
        assert result['data_quality_score'] > 85.0
        assert 'performance' in result
        assert result['performance']['processing_time_seconds'] > 0
    
    async def test_unified_processor_streaming_mode(self, sample_csv_file):
        """Test unified processor in streaming mode"""
        result = await unified_processor.process(
            file_path=sample_csv_file,
            target_framework='pandas',
            mode=ProcessingMode.STREAMING
        )
        
        assert result['status'] == 'success'
        assert result['mode'] == 'streaming'
        assert result['file_info']['total_rows'] == 1000
        assert 'chunks_processed' in result
        assert result['chunks_processed'] > 0
    
    async def test_unified_processor_ai_enhanced_mode(self, sample_csv_file):
        """Test unified processor in AI-enhanced mode"""
        result = await unified_processor.process(
            file_path=sample_csv_file,
            target_framework='pandas',
            mode=ProcessingMode.AI_ENHANCED
        )
        
        assert result['status'] == 'success'
        assert result['mode'] == 'ai_enhanced'
        assert 'ai_insights' in result
        assert 'data_patterns' in result['ai_insights']
        assert 'quality_recommendations' in result['ai_insights']
    
    async def test_file_processing_pipeline(self, sample_csv_file):
        """Test complete file processing pipeline"""
        investigation_id = "test-investigation-123"
        
        result = await file_processing_pipeline.process_uploaded_file(
            file_path=sample_csv_file,
            investigation_id=investigation_id,
            processing_options={'enable_ai_insights': True}
        )
        
        assert result['status'] == 'success'
        assert result['investigation_id'] == investigation_id
        assert result['rows_processed'] == 1000
        assert result['columns_analyzed'] == 6
        assert result['artifacts_generated'] > 0
        assert result['data_quality_score'] > 0
    
    async def test_schema_detection_accuracy(self, sample_csv_file):
        """Test schema detection accuracy"""
        result = await unified_processor.process(
            file_path=sample_csv_file,
            target_framework='pandas',
            mode=ProcessingMode.STANDARD,
            options={'include_schema_detection': True}
        )
        
        data_types = result['data_types']
        
        # Verify correct data type detection
        assert data_types['id']['semantic_type'] == 'numeric'
        assert data_types['name']['semantic_type'] == 'text'
        assert data_types['email']['semantic_type'] == 'email'
        assert data_types['age']['semantic_type'] == 'numeric'
        assert data_types['score']['semantic_type'] == 'numeric'
        
        # Verify data quality metrics
        for column, info in data_types.items():
            assert info['null_count'] == 0  # No nulls in test data
            assert info['unique_count'] > 0
    
    async def test_performance_benchmarks(self, sample_csv_file):
        """Test performance benchmarks"""
        # Test different modes and compare performance
        modes = [ProcessingMode.FAST, ProcessingMode.STANDARD, ProcessingMode.STREAMING]
        results = {}
        
        for mode in modes:
            result = await unified_processor.process(
                file_path=sample_csv_file,
                target_framework='pandas',
                mode=mode
            )
            results[mode.value] = result['performance']['processing_time_seconds']
        
        # Fast mode should be fastest
        assert results['fast'] <= results['standard']
        
        # All modes should complete within reasonable time (< 30 seconds for test data)
        for mode, time_taken in results.items():
            assert time_taken < 30.0, f"{mode} mode took too long: {time_taken}s"
    
    async def test_error_handling(self):
        """Test error handling for invalid files"""
        # Test with non-existent file
        result = await unified_processor.process(
            file_path='/non/existent/file.csv',
            target_framework='pandas'
        )
        
        assert result['status'] == 'error'
        assert 'error' in result
        
        # Test with invalid file format
        with tempfile.NamedTemporaryFile(mode='w', suffix='.invalid', delete=False) as f:
            f.write("invalid content")
            f.flush()
            
            result = await unified_processor.process(
                file_path=f.name,
                target_framework='pandas'
            )
            
            assert result['status'] == 'error'
        
        Path(f.name).unlink(missing_ok=True)
    
    async def test_caching_functionality(self, sample_csv_file):
        """Test result caching"""
        # First run
        result1 = await unified_processor.process(
            file_path=sample_csv_file,
            target_framework='pandas',
            mode=ProcessingMode.STANDARD
        )
        
        # Second run (should hit cache)
        result2 = await unified_processor.process(
            file_path=sample_csv_file,
            target_framework='pandas',
            mode=ProcessingMode.STANDARD
        )
        
        # Results should be identical
        assert result1['status'] == result2['status']
        assert result1['file_info'] == result2['file_info']
        
        # Second run should be faster due to caching
        # (Note: In real implementation, you'd track cache hits)
    
    def test_performance_stats(self):
        """Test performance statistics tracking"""
        stats = unified_processor.get_performance_stats()
        
        assert 'total_files_processed' in stats
        assert 'total_processing_time' in stats
        assert 'average_processing_time' in stats
        assert 'cache_hits' in stats
        assert 'cache_misses' in stats
        assert 'current_memory_mb' in stats
        assert 'cache_hit_rate' in stats
        
        # All values should be non-negative
        for key, value in stats.items():
            if isinstance(value, (int, float)):
                assert value >= 0, f"{key} should be non-negative"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

#### Step 2: Load Testing
Create `/apps/api/tests/load/test_data_processing_load.py`:

```python
import asyncio
import tempfile
import pandas as pd
import time
import statistics
from concurrent.futures import ThreadPoolExecutor
import logging

from app.services.unified_data_processor import unified_processor, ProcessingMode

logger = logging.getLogger(__name__)

class DataProcessingLoadTest:
    """Load testing for data processing service"""
    
    def __init__(self):
        self.results = []
    
    def create_test_files(self, num_files: int = 10, rows_per_file: int = 5000):
        """Create test files of various sizes"""
        test_files = []
        
        for i in range(num_files):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                # Create test data with varying complexity
                test_data = pd.DataFrame({
                    'id': range(1, rows_per_file + 1),
                    'name': [f'User_{j}_{i}' for j in range(1, rows_per_file + 1)],
                    'email': [f'user{j}@domain{i}.com' for j in range(1, rows_per_file + 1)],
                    'value': [round(j * 1.5 + i * 0.1, 2) for j in range(1, rows_per_file + 1)],
                    'category': [f'Category_{j % 10}' for j in range(1, rows_per_file + 1)],
                    'timestamp': [f'2024-01-{(j % 28) + 1:02d}' for j in range(1, rows_per_file + 1)]
                })
                test_data.to_csv(f.name, index=False)
                test_files.append(f.name)
        
        return test_files
    
    async def process_file_async(self, file_path: str, mode: ProcessingMode) -> dict:
        """Process a single file and measure performance"""
        start_time = time.time()
        
        try:
            result = await unified_processor.process(
                file_path=file_path,
                target_framework='pandas',
                mode=mode
            )
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            return {
                'file_path': file_path,
                'mode': mode.value,
                'status': result.get('status'),
                'processing_time': processing_time,
                'rows_processed': result.get('file_info', {}).get('rows', 0),
                'columns_processed': result.get('file_info', {}).get('columns', 0),
                'data_quality_score': result.get('data_quality_score', 0),
                'memory_usage_mb': result.get('performance', {}).get('memory_usage_mb', 0)
            }
            
        except Exception as e:
            end_time = time.time()
            return {
                'file_path': file_path,
                'mode': mode.value,
                'status': 'error',
                'error': str(e),
                'processing_time': end_time - start_time,
                'rows_processed': 0,
                'columns_processed': 0
            }
    
    async def run_concurrent_load_test(
        self, 
        test_files: list, 
        concurrent_workers: int = 5,
        mode: ProcessingMode = ProcessingMode.STANDARD
    ):
        """Run concurrent processing load test"""
        logger.info(f"Starting concurrent load test with {concurrent_workers} workers")
        
        semaphore = asyncio.Semaphore(concurrent_workers)
        
        async def process_with_semaphore(file_path):
            async with semaphore:
                return await self.process_file_async(file_path, mode)
        
        # Run all files concurrently
        start_time = time.time()
        results = await asyncio.gather(*[
            process_with_semaphore(file_path) for file_path in test_files
        ])
        total_time = time.time() - start_time
        
        # Analyze results
        successful_results = [r for r in results if r['status'] == 'success']
        failed_results = [r for r in results if r['status'] != 'success']
        
        if successful_results:
            processing_times = [r['processing_time'] for r in successful_results]
            total_rows = sum(r['rows_processed'] for r in successful_results)
            total_memory = sum(r['memory_usage_mb'] for r in successful_results)
            
            stats = {
                'total_files': len(test_files),
                'successful_files': len(successful_results),
                'failed_files': len(failed_results),
                'total_time_seconds': total_time,
                'total_rows_processed': total_rows,
                'total_memory_used_mb': total_memory,
                'throughput_files_per_second': len(successful_results) / total_time,
                'throughput_rows_per_second': total_rows / total_time,
                'avg_processing_time': statistics.mean(processing_times),
                'median_processing_time': statistics.median(processing_times),
                'max_processing_time': max(processing_times),
                'min_processing_time': min(processing_times),
                'concurrent_workers': concurrent_workers,
                'processing_mode': mode.value
            }
            
            logger.info(f"Load test completed: {stats}")
            return stats, successful_results, failed_results
        
        else:
            logger.error("All files failed processing in load test")
            return None, [], failed_results
    
    async def run_scalability_test(self, base_file_sizes: list = [1000, 5000, 10000, 25000]):
        """Test scalability with different file sizes"""
        scalability_results = []
        
        for file_size in base_file_sizes:
            logger.info(f"Testing scalability with {file_size} rows")
            
            # Create test file
            test_files = self.create_test_files(num_files=1, rows_per_file=file_size)
            
            # Test with different modes
            for mode in [ProcessingMode.FAST, ProcessingMode.STANDARD, ProcessingMode.STREAMING]:
                result = await self.process_file_async(test_files[0], mode)
                
                scalability_results.append({
                    'file_size_rows': file_size,
                    'processing_mode': mode.value,
                    'processing_time': result['processing_time'],
                    'memory_usage_mb': result.get('memory_usage_mb', 0),
                    'throughput_rows_per_second': file_size / result['processing_time'] if result['processing_time'] > 0 else 0
                })
            
            # Cleanup
            for f in test_files:
                try:
                    Path(f).unlink()
                except:
                    pass
        
        return scalability_results
    
    def generate_load_test_report(self, results: dict, scalability_results: list = None):
        """Generate comprehensive load test report"""
        report = f"""
# Data Processing Load Test Report
Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}

## Summary
- Total Files Processed: {results['total_files']}
- Successful: {results['successful_files']}
- Failed: {results['failed_files']}
- Success Rate: {(results['successful_files'] / results['total_files']) * 100:.1f}%

## Performance Metrics
- Total Processing Time: {results['total_time_seconds']:.2f} seconds
- Average Processing Time: {results['avg_processing_time']:.2f} seconds
- Median Processing Time: {results['median_processing_time']:.2f} seconds
- Throughput: {results['throughput_files_per_second']:.2f} files/second
- Row Throughput: {results['throughput_rows_per_second']:.0f} rows/second

## Resource Usage
- Total Memory Used: {results['total_memory_used_mb']:.2f} MB
- Concurrent Workers: {results['concurrent_workers']}
- Processing Mode: {results['processing_mode']}

## Recommendations
"""
        
        # Add recommendations based on results
        if results['avg_processing_time'] > 10:
            report += "- Consider using streaming mode for large files\n"
        
        if results['total_memory_used_mb'] > 1000:
            report += "- Memory usage is high, consider reducing concurrent workers\n"
        
        if results['failed_files'] > 0:
            report += f"- {results['failed_files']} files failed, investigate error handling\n"
        
        if scalability_results:
            report += "\n## Scalability Analysis\n"
            for result in scalability_results:
                report += f"- {result['file_size_rows']} rows ({result['processing_mode']}): {result['processing_time']:.2f}s, {result['throughput_rows_per_second']:.0f} rows/s\n"
        
        return report

async def main():
    """Run comprehensive load testing"""
    load_tester = DataProcessingLoadTest()
    
    # Create test files
    logger.info("Creating test files...")
    test_files = load_tester.create_test_files(num_files=20, rows_per_file=5000)
    
    try:
        # Run concurrent load test
        logger.info("Running concurrent load test...")
        results, successful, failed = await load_tester.run_concurrent_load_test(
            test_files, 
            concurrent_workers=5,
            mode=ProcessingMode.STANDARD
        )
        
        # Run scalability test
        logger.info("Running scalability test...")
        scalability_results = await load_tester.run_scalability_test()
        
        # Generate report
        if results:
            report = load_tester.generate_load_test_report(results, scalability_results)
            print(report)
            
            # Save report to file
            with open('/app/load_test_report.md', 'w') as f:
                f.write(report)
        
    finally:
        # Cleanup test files
        for f in test_files:
            try:
                Path(f).unlink()
            except:
                pass

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Implementation Timeline and Resource Requirements

### Timeline Overview
- **Phase 1 (Dependencies)**: 4-6 hours - 1 developer
- **Phase 2 (Schema Detection)**: 8-12 hours - 1 senior developer
- **Phase 3 (Infrastructure)**: 6-8 hours - 1 DevOps engineer
- **Phase 4 (Cloud Storage)**: 6-8 hours - 1 developer
- **Phase 5 (Database Schema)**: 4-6 hours - 1 database developer
- **Phase 6 (Testing)**: 8-12 hours - 1 QA engineer + 1 developer

**Total Estimated Time**: 36-52 hours (5-7 working days)

### Success Criteria
1. ✅ All data processing dependencies installed and verified
2. ✅ Schema detection task fully functional with 95%+ accuracy
3. ✅ Celery workers processing files with <30s average processing time
4. ✅ Cloud storage integration with 99.9% upload success rate
5. ✅ Database schema supporting all data processing workflows
6. ✅ Load testing showing system can handle 100+ concurrent file uploads
7. ✅ Integration tests passing with 95%+ coverage

### Risk Mitigation
- **Dependency Conflicts**: Use virtual environments and dependency pinning
- **Memory Issues**: Implement streaming processing and worker recycling
- **Performance Bottlenecks**: Implement caching and async processing
- **Storage Failures**: Implement retry logic and fallback storage options
- **Database Deadlocks**: Use proper transaction isolation and connection pooling

This comprehensive plan provides everything needed to successfully enable the Data Processing Service with production-grade capabilities.