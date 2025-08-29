from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure, task_sent, task_received
from celery.utils.log import get_task_logger
import logging
import time
import psutil
import os
import json
from datetime import timedelta
from typing import Dict, Any

from app.core.unified_config import settings

# Configure logging for Celery
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get configuration from unified settings
broker_url = settings.CELERY_BROKER_URL
backend_url = settings.CELERY_RESULT_BACKEND

celery_app = Celery(
    "schlep_engine_worker",
    broker=broker_url,
    backend=backend_url,
    include=[
        "app.tasks.data_processing_tasks",
        "app.tasks.ai_processing_tasks",
        "app.tasks.monitoring_tasks",
        "app.tasks.export_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.rl_optimization_tasks"
    ],
)

# Enhanced production-ready configuration with scalability features
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Task execution
    task_track_started=True,
    task_time_limit=7200,  # 2 hours max per task
    task_soft_time_limit=6600,  # 1 hour 50 minutes soft limit
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # Prevent worker from hogging tasks

    # Result backend
    result_expires=7200,  # Results expire after 2 hours
    result_persistent=True,

    # Worker configuration
    worker_max_tasks_per_child=500,  # Restart worker after 500 tasks
    worker_disable_rate_limits=False,

    # Routing with priority-based queues
    task_routes={
        'app.tasks.ai_processing_tasks.*': {'queue': 'ai_processing'},
        'app.tasks.data_processing_tasks.*': {'queue': 'data_processing'},
        'app.tasks.monitoring_tasks.*': {'queue': 'monitoring'},
        'app.tasks.export_tasks.*': {'queue': 'export'},
        'app.tasks.notification_tasks.*': {'queue': 'notifications'},
    },

    # Queue configuration with priorities
    task_default_queue='default',
    task_queues={
        'default': {
            'exchange': 'default',
            'routing_key': 'default',
            'priority': 3,
        },
        'ai_processing': {
            'exchange': 'ai_processing',
            'routing_key': 'ai_processing',
            'priority': 9,  # Highest priority for AI tasks
        },
        'data_processing': {
            'exchange': 'data_processing',
            'routing_key': 'data_processing',
            'priority': 6,  # High priority for data processing
        },
        'export': {
            'exchange': 'export',
            'routing_key': 'export',
            'priority': 4,  # Medium priority for exports
        },
        'notifications': {
            'exchange': 'notifications',
            'routing_key': 'notifications',
            'priority': 2,  # Low priority for notifications
        },
        'monitoring': {
            'exchange': 'monitoring',
            'routing_key': 'monitoring',
            'priority': 1,  # Lowest priority
        },
    },

    # Monitoring and health checks
    worker_send_task_events=True,
    task_send_sent_event=True,

    # Memory and resource management
    worker_max_memory_per_child=3000000,  # 3GB per worker (restart after)

    # Retry configuration with exponential backoff
    task_default_retry_delay=60,  # 1 minute initial delay
    task_max_retries=5,  # Increased max retries

    # Beat schedule for periodic tasks
    beat_schedule={
        'system-health-check': {
            'task': 'app.tasks.monitoring_tasks.system_health_check',
            'schedule': 300.0,  # Every 5 minutes
            'options': {'queue': 'monitoring'}
        },
        'cleanup-expired-jobs': {
            'task': 'app.tasks.data_processing_tasks.cleanup_expired_jobs',
            'schedule': 3600.0,  # Every hour
            'options': {'queue': 'data_processing'}
        },
        'monitor-queue-health': {
            'task': 'app.tasks.monitoring_tasks.monitor_queue_health',
            'schedule': 600.0,  # Every 10 minutes
            'options': {'queue': 'monitoring'}
        },
        'cleanup-old-results': {
            'task': 'app.tasks.monitoring_tasks.cleanup_old_results',
            'schedule': 86400.0,  # Daily
            'options': {'queue': 'monitoring'}
        },
    },

    # Performance optimization
    worker_optimization='fair',
    worker_direct=True,
    task_compression='gzip',
    result_compression='gzip',

    # Security
    task_remote_tracebacks=True,
    task_ignore_result=False,
)

# Enhanced performance monitoring signals
@task_sent.connect
def task_sent_handler(sender=None, headers=None, body=None, **kwargs):
    """Log when task is sent to queue"""
    task_name = headers.get('task') if headers else 'unknown'
    task_id = headers.get('id') if headers else 'unknown'
    logger.info(f"Task {task_name}[{task_id}] sent to queue")

@task_received.connect
def task_received_handler(sender=None, request=None, **kwargs):
    """Log when task is received by worker"""
    logger.info(f"Task {request.name}[{request.id}] received by worker")

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """Log task start and system resources"""
    start_time = time.time()
    logger.info(f"Task {task.name}[{task_id}] started")

    # Log system resources
    memory_usage = psutil.virtual_memory().percent
    cpu_usage = psutil.cpu_percent()
    disk_usage = psutil.disk_usage('/').percent

    logger.info(f"System resources - Memory: {memory_usage}%, CPU: {cpu_usage}%, Disk: {disk_usage}%")

    # Store start time for performance tracking
    if not hasattr(task, '_start_times'):
        task._start_times = {}
    task._start_times[task_id] = start_time

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kwds):
    """Log task completion and performance metrics"""
    end_time = time.time()
    start_time = getattr(task, '_start_times', {}).get(task_id, end_time)
    execution_time = end_time - start_time

    # Log completion with performance metrics
    logger.info(f"Task {task.name}[{task_id}] completed with state: {state} in {execution_time:.2f}s")

    # Log system resources after completion
    memory_usage = psutil.virtual_memory().percent
    cpu_usage = psutil.cpu_percent()
    logger.info(f"Post-task resources - Memory: {memory_usage}%, CPU: {cpu_usage}%")

    # Clean up start time
    if hasattr(task, '_start_times') and task_id in task._start_times:
        del task._start_times[task_id]

@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, traceback=None, einfo=None, **kwds):
    """Log task failures with detailed error information"""
    logger.error(f"Task {sender.name}[{task_id}] failed: {exception}")
    logger.error(f"Traceback: {traceback}")

    # Log system resources at failure
    memory_usage = psutil.virtual_memory().percent
    cpu_usage = psutil.cpu_percent()
    logger.error(f"System resources at failure - Memory: {memory_usage}%, CPU: {cpu_usage}%")

# Enhanced health check and monitoring functions
def get_worker_health():
    """Get current worker health status"""
    try:
        inspector = celery_app.control.inspect()
        stats = inspector.stats() or {}
        active = inspector.active() or {}
        reserved = inspector.reserved() or {}
        registered = inspector.registered() or {}

        # Count active tasks across all workers
        total_active = sum(len(tasks) for tasks in active.values())
        total_reserved = sum(len(tasks) for tasks in reserved.values())

        return {
            'memory_usage': psutil.virtual_memory().percent,
            'cpu_usage': psutil.cpu_percent(),
            'disk_usage': psutil.disk_usage('/').percent,
            'active_tasks': total_active,
            'reserved_tasks': total_reserved,
            'worker_count': len(stats),
            'registered_tasks': len(registered.get(list(registered.keys())[0], []) if registered else []),
            'workers': list(stats.keys()),
            'status': 'healthy' if total_active < 100 else 'overloaded'
        }
    except Exception as e:
        logger.error(f"Error getting worker health: {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

def get_queue_stats():
    """Get queue statistics"""
    try:
        inspector = celery_app.control.inspect()
        active = inspector.active() or {}
        reserved = inspector.reserved() or {}

        # Count tasks by queue
        queue_stats = {}
        for worker_tasks in active.values():
            for task in worker_tasks:
                queue = task.get('delivery_info', {}).get('routing_key', 'default')
                queue_stats[queue] = queue_stats.get(queue, 0) + 1

        for worker_tasks in reserved.values():
            for task in worker_tasks:
                queue = task.get('delivery_info', {}).get('routing_key', 'default')
                queue_stats[queue] = queue_stats.get(queue, 0) + 1

        return queue_stats
    except Exception as e:
        logger.error(f"Error getting queue stats: {e}")
        return {}

def get_task_performance():
    """Get task performance metrics"""
    try:
        inspector = celery_app.control.inspect()
        stats = inspector.stats() or {}

        performance = {}
        for worker_name, worker_stats in stats.items():
            if 'total' in worker_stats:
                performance[worker_name] = {
                    'total_tasks': worker_stats['total'].get('total', 0),
                    'avg_time': worker_stats['total'].get('avg', 0),
                    'min_time': worker_stats['total'].get('min', 0),
                    'max_time': worker_stats['total'].get('max', 0),
                }

        return performance
    except Exception as e:
        logger.error(f"Error getting task performance: {e}")
        return {}

if __name__ == "__main__":
    # Enhanced worker startup with better configuration
    argv = [
        'worker',
        '-l', 'info',
        '--concurrency=8',  # 8 concurrent workers for better scalability
        '--max-tasks-per-child=500',
        '--optimization=fair',
        '--max-memory-per-child=3000000',  # 3GB memory limit
        '-Q', 'default,ai_processing,data_processing,export,notifications,monitoring',  # Process all queues
        '--without-gossip',  # Disable gossip for better performance
        '--without-mingle',  # Disable mingle for better performance
        '--without-heartbeat',  # Disable heartbeat for better performance
    ]
    celery_app.worker_main(argv)
