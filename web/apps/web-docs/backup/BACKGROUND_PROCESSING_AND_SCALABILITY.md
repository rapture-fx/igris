# Background Processing & Scalability Implementation

This document outlines the comprehensive background processing and scalability implementation for the Schlep-engine platform, including Celery worker configuration, task management, monitoring, and retry mechanisms.

## Table of Contents

1. [Overview](#overview)
2. [Celery Configuration](#celery-configuration)
3. [Task Categories](#task-categories)
4. [Queue Management](#queue-management)
5. [Retry Mechanisms](#retry-mechanisms)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Performance Optimization](#performance-optimization)
8. [Deployment & Scaling](#deployment--scaling)
9. [Troubleshooting](#troubleshooting)

## Overview

The background processing system is built on Celery with Redis as the message broker and result backend. The system provides:

- **Asynchronous Task Processing**: All heavy data processing jobs run asynchronously
- **Priority-based Queues**: Different task types use different priority queues
- **Robust Retry Mechanisms**: Exponential backoff with jitter for transient failures
- **Comprehensive Monitoring**: Real-time queue health and performance monitoring
- **Scalable Architecture**: Horizontal scaling with multiple workers

## Celery Configuration

### Core Configuration

The Celery application is configured in `app/core/celery_app.py` with the following key features:

```python
# Broker and Backend
broker_url = settings.CELERY_BROKER_URL
backend_url = settings.CELERY_RESULT_BACKEND

# Task Configuration
task_time_limit = 7200  # 2 hours max per task
task_soft_time_limit = 6600  # 1 hour 50 minutes soft limit
task_acks_late = True
worker_prefetch_multiplier = 1

# Worker Configuration
worker_max_tasks_per_child = 500  # Restart worker after 500 tasks
worker_max_memory_per_child = 3000000  # 3GB memory limit
```

### Queue Configuration

The system uses priority-based queues for different task types:

| Queue | Priority | Purpose | Max Retries | Time Limit |
|-------|----------|---------|-------------|------------|
| `ai_processing` | 9 (Highest) | AI/ML tasks | 5 | 2 hours |
| `data_processing` | 6 (High) | Data processing tasks | 5 | 2 hours |
| `export` | 4 (Medium) | Data export tasks | 3 | 1 hour |
| `notifications` | 2 (Low) | Email/notification tasks | 3 | 5 minutes |
| `monitoring` | 1 (Lowest) | System monitoring tasks | 2 | 5 minutes |

## Task Categories

### 1. Data Processing Tasks (`app/tasks/data_processing_tasks.py`)

**Core Tasks:**
- `process_dataset`: Main dataset processing with AI analysis
- `clean_data`: Data cleaning and validation
- `validate_data`: Data quality validation
- `cleanup_expired_jobs`: Cleanup old jobs and results

**Features:**
- Progress tracking with real-time updates
- Comprehensive error handling
- Database session management
- Performance metrics collection

### 2. AI Processing Tasks (`app/tasks/ai_processing_tasks.py`)

**Core Tasks:**
- `analyze_data_with_ai`: AI-powered data analysis
- `train_models`: Model training and optimization
- `generate_insights`: Automated insight generation

**Features:**
- GPU support for ML tasks
- Model versioning and tracking
- Resource monitoring
- Automatic model selection

### 3. Export Tasks (`app/tasks/export_tasks.py`)

**Core Tasks:**
- `export_dataset_csv`: CSV export
- `export_dataset_excel`: Excel export
- `export_dataset_json`: JSON export
- `export_dataset_parquet`: Parquet export
- `cleanup_old_exports`: Cleanup old export files

**Features:**
- Multiple format support
- Compression for large files
- Progress tracking
- File size optimization

### 4. Notification Tasks (`app/tasks/notification_tasks.py`)

**Core Tasks:**
- `send_email_notification`: Email notifications
- `send_system_alert`: System alerts
- `send_task_completion_notification`: Task completion notifications
- `send_error_notification`: Error notifications
- `cleanup_old_notifications`: Cleanup old notifications

**Features:**
- Multiple notification channels
- Template-based messages
- Delivery tracking
- Rate limiting

### 5. Monitoring Tasks (`app/tasks/monitoring_tasks.py`)

**Core Tasks:**
- `system_health_check`: Comprehensive system health monitoring
- `monitor_queue_health`: Queue performance monitoring
- `performance_metrics_collection`: Performance data collection
- `cleanup_old_results`: Cleanup old monitoring data

**Features:**
- Real-time health monitoring
- Queue performance analysis
- Resource usage tracking
- Automated alerting

## Queue Management

### Queue Health Monitoring

The system continuously monitors queue health with the following metrics:

```python
def get_queue_stats():
    """Get queue statistics"""
    inspector = celery_app.control.inspect()
    active = inspector.active() or {}
    reserved = inspector.reserved() or {}
    
    # Count tasks by queue
    queue_stats = {}
    for worker_tasks in active.values():
        for task in worker_tasks:
            queue = task.get('delivery_info', {}).get('routing_key', 'default')
            queue_stats[queue] = queue_stats.get(queue, 0) + 1
    
    return queue_stats
```

### Queue Alerts

The system generates alerts for:

- **High Active Tasks**: > 50 active tasks
- **High Reserved Tasks**: > 100 reserved tasks
- **No Workers Available**: 0 workers
- **Low Worker Count**: < 2 workers
- **Queue Overload**: > 20 tasks in any queue

### Worker Health Monitoring

```python
def get_worker_health():
    """Get current worker health status"""
    inspector = celery_app.control.inspect()
    stats = inspector.stats() or {}
    active = inspector.active() or {}
    reserved = inspector.reserved() or {}
    
    total_active = sum(len(tasks) for tasks in active.values())
    total_reserved = sum(len(tasks) for tasks in reserved.values())
    
    return {
        'memory_usage': psutil.virtual_memory().percent,
        'cpu_usage': psutil.cpu_percent(),
        'active_tasks': total_active,
        'reserved_tasks': total_reserved,
        'worker_count': len(stats),
        'status': 'healthy' if total_active < 100 else 'overloaded'
    }
```

## Retry Mechanisms

### Retry Configuration (`app/core/retry_config.py`)

The system implements comprehensive retry mechanisms with:

#### Retry Strategies

1. **Exponential Backoff**: `delay = base_delay * (2^retry_count)`
2. **Linear Backoff**: `delay = base_delay * retry_count`
3. **Constant Delay**: `delay = base_delay`
4. **Fibonacci Backoff**: `delay = base_delay * fibonacci(retry_count)`

#### Failure Classification

The system automatically classifies failures:

- **Network Errors**: Connection, timeout, socket issues
- **Database Errors**: SQL, connection, constraint issues
- **Timeout Errors**: Operation timeouts
- **Rate Limit Errors**: API rate limiting
- **Validation Errors**: Data validation failures
- **System Errors**: Internal server errors
- **Transient Errors**: Temporary failures

#### Predefined Configurations

```python
RETRY_CONFIGS = {
    'network_operations': RetryConfig(
        max_retries=5,
        base_delay=1.0,
        max_delay=300.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_failure_types=[FailureType.NETWORK_ERROR, FailureType.TIMEOUT_ERROR]
    ),
    
    'database_operations': RetryConfig(
        max_retries=3,
        base_delay=0.5,
        max_delay=60.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_failure_types=[FailureType.DATABASE_ERROR, FailureType.TIMEOUT_ERROR]
    ),
    
    'api_calls': RetryConfig(
        max_retries=3,
        base_delay=2.0,
        max_delay=300.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_failure_types=[FailureType.NETWORK_ERROR, FailureType.RATE_LIMIT_ERROR, FailureType.TIMEOUT_ERROR]
    )
}
```

### Usage Examples

#### Decorator Usage

```python
from app.core.retry_config import retry_network_operation, retry_database_operation

@retry_network_operation
def fetch_external_data(url: str) -> Dict[str, Any]:
    # Network operation with automatic retry
    pass

@retry_database_operation
def save_to_database(data: Dict[str, Any]) -> bool:
    # Database operation with automatic retry
    pass
```

#### Manual Usage

```python
from app.core.retry_config import RetryManager, RetryConfig

config = RetryConfig(
    max_retries=3,
    base_delay=1.0,
    strategy=RetryStrategy.EXPONENTIAL_BACKOFF
)

retry_manager = RetryManager(config)
result = retry_manager.execute_with_retry(my_function, arg1, arg2)
```

## Monitoring & Health Checks

### System Health Monitoring

The system performs comprehensive health checks every 5 minutes:

```python
@celery_app.task(queue='monitoring')
def system_health_check(self) -> Dict[str, Any]:
    """Comprehensive system health check"""
    # Collect system metrics
    memory = psutil.virtual_memory()
    cpu = psutil.cpu_percent()
    disk = psutil.disk_usage('/')
    
    # Get worker and queue health
    worker_health = get_worker_health()
    queue_stats = get_queue_stats()
    
    # Determine overall status
    health_data = {
        'system': {
            'memory': {'used_percent': memory.percent, 'status': 'healthy' if memory.percent < 80 else 'warning'},
            'cpu': {'usage_percent': cpu, 'status': 'healthy' if cpu < 70 else 'warning'},
            'disk': {'used_percent': disk_usage, 'status': 'healthy' if disk_usage < 80 else 'warning'}
        },
        'workers': worker_health,
        'queues': queue_stats,
        'overall_status': 'healthy'
    }
    
    return health_data
```

### Performance Metrics Collection

The system collects detailed performance metrics:

- **Task Performance**: Execution time, success rate, retry statistics
- **System Performance**: CPU, memory, disk I/O, network usage
- **Queue Performance**: Task throughput, queue depth, worker utilization

### Automated Alerting

The system generates alerts for:

- **Critical Issues**: System down, no workers, high resource usage
- **Warning Issues**: High queue depth, resource pressure, performance degradation
- **Information**: Task completion, system status changes

## Performance Optimization

### Worker Optimization

```python
# Worker startup configuration
argv = [
    'worker',
    '-l', 'info',
    '--concurrency=8',  # 8 concurrent workers
    '--max-tasks-per-child=500',
    '--optimization=fair',
    '--max-memory-per-child=3000000',  # 3GB memory limit
    '-Q', 'default,ai_processing,data_processing,export,notifications,monitoring',
    '--without-gossip',  # Disable gossip for better performance
    '--without-mingle',  # Disable mingle for better performance
    '--without-heartbeat',  # Disable heartbeat for better performance
]
```

### Task Optimization

- **Compression**: Gzip compression for task messages and results
- **Serialization**: JSON serialization with optimization
- **Memory Management**: Automatic worker restart after memory threshold
- **Resource Limits**: Per-task time and memory limits

### Queue Optimization

- **Priority Queues**: High-priority tasks processed first
- **Fair Scheduling**: Fair distribution across workers
- **Load Balancing**: Automatic load distribution
- **Dead Letter Queues**: Failed task handling

## Deployment & Scaling

### Docker Deployment

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  celery-worker:
    build: .
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=8
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    depends_on:
      - redis
    deploy:
      replicas: 3  # Scale to 3 workers

  celery-beat:
    build: .
    command: celery -A app.core.celery_app beat --loglevel=info
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
    depends_on:
      - redis
```

### Kubernetes Deployment

```yaml
# kubernetes/celery-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: celery-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: celery-worker
  template:
    metadata:
      labels:
        app: celery-worker
    spec:
      containers:
      - name: celery-worker
        image: schlep-engine:latest
        command: ["celery", "-A", "app.core.celery_app", "worker", "--loglevel=info", "--concurrency=8"]
        env:
        - name: CELERY_BROKER_URL
          value: "redis://redis-service:6379/0"
        - name: CELERY_RESULT_BACKEND
          value: "redis://redis-service:6379/1"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
```

### Horizontal Scaling

The system supports horizontal scaling through:

1. **Multiple Workers**: Deploy multiple worker instances
2. **Queue Partitioning**: Distribute tasks across queues
3. **Load Balancing**: Automatic load distribution
4. **Auto-scaling**: Kubernetes HPA for automatic scaling

### Monitoring Deployment

```yaml
# Prometheus monitoring
apiVersion: v1
kind: ConfigMap
metadata:
  name: celery-monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'celery'
      static_configs:
      - targets: ['celery-worker:8000']
```

## Troubleshooting

### Common Issues

#### 1. Worker Not Starting

**Symptoms:**
- Workers not appearing in monitoring
- Tasks stuck in queue

**Solutions:**
```bash
# Check worker logs
docker logs celery-worker

# Check Redis connection
redis-cli ping

# Restart workers
docker-compose restart celery-worker
```

#### 2. High Memory Usage

**Symptoms:**
- Workers restarting frequently
- Slow task processing

**Solutions:**
```python
# Adjust memory limits
worker_max_memory_per_child = 4000000  # 4GB

# Reduce concurrency
--concurrency=4

# Enable garbage collection
import gc
gc.collect()
```

#### 3. Queue Backlog

**Symptoms:**
- Tasks waiting in queue
- High reserved task count

**Solutions:**
```bash
# Scale up workers
docker-compose up --scale celery-worker=5

# Check for stuck tasks
celery -A app.core.celery_app inspect reserved

# Purge stuck tasks
celery -A app.core.celery_app purge
```

#### 4. Task Failures

**Symptoms:**
- High failure rate
- Tasks not completing

**Solutions:**
```python
# Check task logs
from app.tasks.data_processing_tasks import get_task_status
status = get_task_status(task_id)

# Increase retry limits
max_retries = 5
task_default_retry_delay = 120

# Check exception details
logger.error(f"Task failed: {exception}")
logger.error(f"Traceback: {traceback}")
```

### Monitoring Commands

```bash
# Check worker status
celery -A app.core.celery_app inspect active

# Check queue status
celery -A app.core.celery_app inspect stats

# Monitor tasks
celery -A app.core.celery_app events

# Check scheduled tasks
celery -A app.core.celery_app inspect scheduled
```

### Performance Tuning

#### Memory Optimization

```python
# Optimize memory usage
import gc
import psutil

def optimize_memory():
    """Optimize memory usage"""
    gc.collect()
    
    # Check memory usage
    memory = psutil.virtual_memory()
    if memory.percent > 80:
        logger.warning(f"High memory usage: {memory.percent}%")
        # Force garbage collection
        gc.collect()
```

#### Task Optimization

```python
# Optimize task execution
@celery_app.task(bind=True, time_limit=3600)
def optimized_task(self, data):
    """Optimized task with memory management"""
    try:
        # Process in chunks
        chunk_size = 1000
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i + chunk_size]
            process_chunk(chunk)
            
            # Check memory usage
            if psutil.virtual_memory().percent > 80:
                gc.collect()
                
    except Exception as e:
        logger.error(f"Task failed: {e}")
        raise
```

## Best Practices

### 1. Task Design

- **Idempotency**: Design tasks to be idempotent
- **Error Handling**: Implement comprehensive error handling
- **Progress Tracking**: Use progress callbacks for long-running tasks
- **Resource Management**: Properly manage database connections and memory

### 2. Queue Management

- **Queue Separation**: Use separate queues for different task types
- **Priority Management**: Assign appropriate priorities to tasks
- **Load Balancing**: Distribute load across workers
- **Monitoring**: Continuously monitor queue health

### 3. Retry Strategy

- **Exponential Backoff**: Use exponential backoff for transient failures
- **Jitter**: Add jitter to prevent thundering herd
- **Failure Classification**: Classify failures appropriately
- **Max Retries**: Set reasonable max retry limits

### 4. Monitoring

- **Health Checks**: Regular system health checks
- **Performance Metrics**: Collect and analyze performance metrics
- **Alerting**: Set up automated alerting for issues
- **Logging**: Comprehensive logging for debugging

### 5. Scaling

- **Horizontal Scaling**: Scale workers horizontally
- **Resource Limits**: Set appropriate resource limits
- **Auto-scaling**: Use auto-scaling for dynamic workloads
- **Load Testing**: Regular load testing and optimization

## Conclusion

The background processing and scalability implementation provides a robust, scalable, and maintainable system for handling asynchronous tasks in the Schlep-engine platform. The comprehensive monitoring, retry mechanisms, and performance optimization ensure reliable operation under various load conditions.

For additional support or questions, refer to the monitoring dashboard or contact the development team. 