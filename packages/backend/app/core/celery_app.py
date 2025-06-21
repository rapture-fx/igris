from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
import logging
import time
import psutil
import os
from app.core.api_config import settings

# Configure logging for Celery
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get configuration from settings
broker_url = getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0")
backend_url = getattr(settings, "CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

celery_app = Celery(
    "pollarbase_worker",
    broker=broker_url,
    backend=backend_url,
    include=["app.tasks.data_processing_tasks", "app.tasks.ai_processing_tasks", "app.tasks.monitoring_tasks"],
)

# Enhanced production-ready configuration
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
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3300,  # 55 minutes soft limit
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # Prevent worker from hogging tasks
    
    # Result backend
    result_expires=3600,  # Results expire after 1 hour
    result_persistent=True,
    
    # Worker configuration
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
    worker_disable_rate_limits=False,
    
    # Routing
    task_routes={
        'app.tasks.ai_processing_tasks.*': {'queue': 'ai_processing'},
        'app.tasks.data_processing_tasks.*': {'queue': 'data_processing'},
        'app.tasks.monitoring_tasks.*': {'queue': 'monitoring'},
    },
    
    # Queue configuration
    task_default_queue='default',
    task_queues={
        'default': {
            'exchange': 'default',
            'routing_key': 'default',
        },
        'ai_processing': {
            'exchange': 'ai_processing',
            'routing_key': 'ai_processing',
            'priority': 9,  # High priority for AI tasks
        },
        'data_processing': {
            'exchange': 'data_processing',
            'routing_key': 'data_processing',
            'priority': 5,  # Medium priority
        },
        'monitoring': {
            'exchange': 'monitoring',
            'routing_key': 'monitoring',
            'priority': 1,  # Low priority
        },
    },
    
    # Monitoring and health checks
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Memory and resource management
    worker_max_memory_per_child=2000000,  # 2GB per worker (restart after)
    
    # Retry configuration
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    
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
    },
)

# Performance monitoring signals
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """Log task start and system resources"""
    logger.info(f"Task {task.name}[{task_id}] started")
    # Log system resources
    memory_usage = psutil.virtual_memory().percent
    cpu_usage = psutil.cpu_percent()
    logger.info(f"System resources - Memory: {memory_usage}%, CPU: {cpu_usage}%")

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kwds):
    """Log task completion and performance metrics"""
    logger.info(f"Task {task.name}[{task_id}] completed with state: {state}")

@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, traceback=None, einfo=None, **kwds):
    """Log task failures with detailed error information"""
    logger.error(f"Task {sender.name}[{task_id}] failed: {exception}")
    logger.error(f"Traceback: {traceback}")

# Health check function
def get_worker_health():
    """Get current worker health status"""
    return {
        'memory_usage': psutil.virtual_memory().percent,
        'cpu_usage': psutil.cpu_percent(),
        'disk_usage': psutil.disk_usage('/').percent,
        'active_tasks': len(celery_app.control.inspect().active() or {}),
        'worker_count': len(celery_app.control.inspect().stats() or {}),
    }

if __name__ == "__main__":
    # Enhanced worker startup with better configuration
    argv = [
        'worker',
        '-l', 'info',
        '--concurrency=4',  # 4 concurrent workers
        '--max-tasks-per-child=1000',
        '--optimization=fair',
        '-Q', 'default,ai_processing,data_processing,monitoring',  # Process all queues
    ]
    celery_app.worker_main(argv) 