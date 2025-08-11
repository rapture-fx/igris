"""
Enhanced Monitoring Tasks for Schlep-engine

This module contains comprehensive monitoring tasks that run asynchronously using Celery.
Tasks include system health checks, performance monitoring, resource tracking,
queue monitoring, and automated alerting.
"""

import logging
import time
import psutil
import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from celery import current_task
from celery.utils.log import get_task_logger

from app.core.celery_app import celery_app, get_worker_health, get_queue_stats, get_task_performance
from app.core.unified_config import settings
from app.database.connection import get_sync_db
from app.services.monitoring_service import MonitoringService

logger = get_task_logger(__name__)


class MonitoringRetryException(Exception):
    """Custom exception for monitoring task retries"""
    pass


def exponential_backoff_retry_delay(retry_count: int, base_delay: int = 30) -> int:
    """
    Calculate exponential backoff delay for monitoring retries.
    
    Args:
        retry_count: Current retry attempt number
        base_delay: Base delay in seconds (default: 30)
    
    Returns:
        Delay in seconds for next retry
    """
    return min(base_delay * (2 ** retry_count), 1800)  # Max 30 minutes delay


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(MonitoringRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=300,  # 5 minutes
    soft_time_limit=240,  # 4 minutes
    queue='monitoring'
)
def system_health_check(self) -> Dict[str, Any]:
    """
    Comprehensive system health check task with enhanced monitoring.
    
    Returns:
        System health data and status
    """
    task_id = self.request.id
    logger.info(f"Starting enhanced system health check task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Collecting system metrics...'}
        )
        
        # Get system metrics
        memory = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()
        
        self.update_state(
            state='PROGRESS',
            meta={'current': 30, 'total': 100, 'status': 'Analyzing system health...'}
        )
        
        # Get worker health
        worker_health = get_worker_health()
        
        self.update_state(
            state='PROGRESS',
            meta={'current': 60, 'total': 100, 'status': 'Checking queue status...'}
        )
        
        # Get queue statistics
        queue_stats = get_queue_stats()
        
        self.update_state(
            state='PROGRESS',
            meta={'current': 80, 'total': 100, 'status': 'Finalizing health report...'}
        )
        
        # Get task performance metrics
        task_performance = get_task_performance()
        
        health_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'task_id': task_id,
            'system': {
                'memory': {
                    'total_gb': round(memory.total / (1024**3), 2),
                    'available_gb': round(memory.available / (1024**3), 2),
                    'used_percent': memory.percent,
                    'status': 'healthy' if memory.percent < 80 else 'warning' if memory.percent < 90 else 'critical'
                },
                'cpu': {
                    'usage_percent': cpu,
                    'status': 'healthy' if cpu < 70 else 'warning' if cpu < 85 else 'critical'
                },
                'disk': {
                    'total_gb': round(disk.total / (1024**3), 2),
                    'free_gb': round(disk.free / (1024**3), 2),
                    'used_percent': round((disk.total - disk.free) / disk.total * 100, 2),
                    'status': 'healthy' if (disk.total - disk.free) / disk.total < 0.8 else 'warning' if (disk.total - disk.free) / disk.total < 0.9 else 'critical'
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                }
            },
            'workers': worker_health,
            'queues': queue_stats,
            'performance': task_performance,
            'overall_status': 'healthy'
        }
        
        # Determine overall status
        critical_metrics = []
        warning_metrics = []
        
        # Check system metrics
        for metric_name, metric_data in health_data['system'].items():
            if metric_name == 'network':
                continue  # Skip network for status determination
            if metric_data.get('status') == 'critical':
                critical_metrics.append(f"{metric_name}: {metric_data.get('used_percent', metric_data.get('usage_percent', 'N/A'))}%")
            elif metric_data.get('status') == 'warning':
                warning_metrics.append(f"{metric_name}: {metric_data.get('used_percent', metric_data.get('usage_percent', 'N/A'))}%")
        
        # Check worker status
        if worker_health.get('status') == 'error':
            critical_metrics.append("workers: connection error")
        elif worker_health.get('status') == 'overloaded':
            warning_metrics.append("workers: overloaded")
        
        # Set overall status
        if critical_metrics:
            health_data['overall_status'] = 'critical'
            health_data['critical_alerts'] = critical_metrics
        elif warning_metrics:
            health_data['overall_status'] = 'warning'
            health_data['warning_alerts'] = warning_metrics
        
        # Save health data to database
        db = next(get_sync_db())
        monitoring_service = MonitoringService(db)
        monitoring_service.save_health_check(health_data)
        
        logger.info(f"System health check task {task_id} completed: {health_data['overall_status']}")
        
        return health_data
        
    except MonitoringRetryException as e:
        logger.warning(f"System health check task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"System health check task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(MonitoringRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=180,  # 3 minutes
    soft_time_limit=120,  # 2 minutes
    queue='monitoring'
)
def monitor_queue_health(self) -> Dict[str, Any]:
    """
    Monitor queue health and performance.
    
    Returns:
        Queue health data and alerts
    """
    task_id = self.request.id
    logger.info(f"Starting queue health monitoring task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Analyzing queue health...'}
        )
        
        # Get queue statistics
        queue_stats = get_queue_stats()
        worker_health = get_worker_health()
        
        self.update_state(
            state='PROGRESS',
            meta={'current': 50, 'total': 100, 'status': 'Evaluating queue performance...'}
        )
        
        # Analyze queue health
        queue_health = {
            'timestamp': datetime.utcnow().isoformat(),
            'task_id': task_id,
            'queue_stats': queue_stats,
            'worker_health': worker_health,
            'alerts': [],
            'status': 'healthy'
        }
        
        # Check for queue issues
        total_active = worker_health.get('active_tasks', 0)
        total_reserved = worker_health.get('reserved_tasks', 0)
        worker_count = worker_health.get('worker_count', 0)
        
        # Queue overload alerts
        if total_active > 50:
            queue_health['alerts'].append({
                'type': 'warning',
                'message': f'High active tasks: {total_active}',
                'severity': 'medium'
            })
            queue_health['status'] = 'warning'
        
        if total_reserved > 100:
            queue_health['alerts'].append({
                'type': 'critical',
                'message': f'High reserved tasks: {total_reserved}',
                'severity': 'high'
            })
            queue_health['status'] = 'critical'
        
        # Worker availability alerts
        if worker_count == 0:
            queue_health['alerts'].append({
                'type': 'critical',
                'message': 'No workers available',
                'severity': 'critical'
            })
            queue_health['status'] = 'critical'
        elif worker_count < 2:
            queue_health['alerts'].append({
                'type': 'warning',
                'message': f'Low worker count: {worker_count}',
                'severity': 'medium'
            })
            if queue_health['status'] != 'critical':
                queue_health['status'] = 'warning'
        
        # Queue-specific alerts
        for queue_name, task_count in queue_stats.items():
            if task_count > 20:
                queue_health['alerts'].append({
                    'type': 'warning',
                    'message': f'Queue {queue_name} has {task_count} tasks',
                    'severity': 'medium'
                })
                if queue_health['status'] != 'critical':
                    queue_health['status'] = 'warning'
        
        # Save queue health data
        db = next(get_sync_db())
        monitoring_service = MonitoringService(db)
        monitoring_service.save_queue_health(queue_health)
        
        logger.info(f"Queue health monitoring task {task_id} completed: {queue_health['status']}")
        
        return queue_health
        
    except MonitoringRetryException as e:
        logger.warning(f"Queue health monitoring task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Queue health monitoring task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


@celery_app.task(
    bind=True,
    max_retries=1,
    default_retry_delay=60,
    autoretry_for=(MonitoringRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=600,  # 10 minutes
    soft_time_limit=500,  # 8 minutes
    queue='monitoring'
)
def cleanup_old_results(self) -> Dict[str, Any]:
    """
    Clean up old task results and monitoring data.
    
    Returns:
        Cleanup results and statistics
    """
    task_id = self.request.id
    logger.info(f"Starting cleanup old results task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting cleanup...'}
        )
        
        db = next(get_sync_db())
        monitoring_service = MonitoringService(db)
        
        # Clean up old results
        cleanup_results = monitoring_service.cleanup_old_results(
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Cleanup old results task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'cleanup_results': cleanup_results,
            'task_id': task_id
        }
        
    except MonitoringRetryException as e:
        logger.warning(f"Cleanup old results task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Cleanup old results task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(MonitoringRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=120,  # 2 minutes
    soft_time_limit=90,  # 1.5 minutes
    queue='monitoring'
)
def performance_metrics_collection(self) -> Dict[str, Any]:
    """
    Collect detailed performance metrics.
    
    Returns:
        Performance metrics data
    """
    task_id = self.request.id
    logger.info(f"Starting performance metrics collection task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Collecting performance metrics...'}
        )
        
        # Get task performance
        task_performance = get_task_performance()
        
        self.update_state(
            state='PROGRESS',
            meta={'current': 50, 'total': 100, 'status': 'Analyzing performance data...'}
        )
        
        # Get system performance
        cpu_times = psutil.cpu_times_percent()
        memory = psutil.virtual_memory()
        disk_io = psutil.disk_io_counters()
        
        performance_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'task_id': task_id,
            'task_performance': task_performance,
            'system_performance': {
                'cpu': {
                    'user': cpu_times.user,
                    'system': cpu_times.system,
                    'idle': cpu_times.idle,
                    'iowait': cpu_times.iowait
                },
                'memory': {
                    'used_percent': memory.percent,
                    'available_gb': round(memory.available / (1024**3), 2)
                },
                'disk_io': {
                    'read_bytes': disk_io.read_bytes,
                    'write_bytes': disk_io.write_bytes,
                    'read_count': disk_io.read_count,
                    'write_count': disk_io.write_count
                }
            }
        }
        
        # Save performance data
        db = next(get_sync_db())
        monitoring_service = MonitoringService(db)
        monitoring_service.save_performance_metrics(performance_data)
        
        logger.info(f"Performance metrics collection task {task_id} completed successfully")
        
        return performance_data
        
    except MonitoringRetryException as e:
        logger.warning(f"Performance metrics collection task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Performance metrics collection task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


# Monitoring utility functions
def get_monitoring_status(monitoring_id: str) -> Dict[str, Any]:
    """
    Get the status of a specific monitoring task.
    
    Args:
        monitoring_id: ID of the monitoring task to check
    
    Returns:
        Monitoring task status and metadata
    """
    try:
        result = celery_app.AsyncResult(monitoring_id)
        return {
            'monitoring_id': monitoring_id,
            'status': result.status,
            'result': result.result if result.ready() else None,
            'info': result.info if hasattr(result, 'info') else None,
            'traceback': result.traceback if result.failed() else None
        }
    except Exception as e:
        logger.error(f"Error getting monitoring status for {monitoring_id}: {e}")
        return {
            'monitoring_id': monitoring_id,
            'status': 'ERROR',
            'error': str(e)
        }


def get_system_health_summary() -> Dict[str, Any]:
    """
    Get a summary of system health.
    
    Returns:
        System health summary
    """
    try:
        # Get current health data
        memory = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        disk = psutil.disk_usage('/')
        worker_health = get_worker_health()
        
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'system': {
                'memory_usage': memory.percent,
                'cpu_usage': cpu,
                'disk_usage': round((disk.total - disk.free) / disk.total * 100, 2)
            },
            'workers': worker_health,
            'status': 'healthy'
        }
    except Exception as e:
        logger.error(f"Error getting system health summary: {e}")
        return {
            'status': 'error',
            'error': str(e)
        } 