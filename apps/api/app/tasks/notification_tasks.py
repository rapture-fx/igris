"""
Notification Tasks for Schlep-engine

This module contains all notification-related tasks that run asynchronously
using Celery. Tasks include email notifications, system alerts, and user
notifications with proper error handling and retry mechanisms.
"""

import logging
import time
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from celery import current_task
from celery.utils.log import get_task_logger

from app.core.celery_app import celery_app
from app.core.unified_config import settings
from app.database.connection import get_sync_db
from app.services.notification_service import NotificationService

logger = get_task_logger(__name__)


class NotificationRetryException(Exception):
    """Custom exception for notification task retries"""
    pass


def exponential_backoff_retry_delay(retry_count: int, base_delay: int = 30) -> int:
    """
    Calculate exponential backoff delay for notification retries.
    
    Args:
        retry_count: Current retry attempt number
        base_delay: Base delay in seconds (default: 30)
    
    Returns:
        Delay in seconds for next retry
    """
    return min(base_delay * (2 ** retry_count), 1800)  # Max 30 minutes delay


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(NotificationRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=300,  # 5 minutes
    soft_time_limit=240,  # 4 minutes
    queue='notifications'
)
def send_email_notification(self, user_id: int, email_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send email notification to user.
    
    Args:
        user_id: ID of the user to notify
        email_data: Email content and configuration
    
    Returns:
        Email sending results
    """
    task_id = self.request.id
    logger.info(f"Starting email notification task {task_id} for user {user_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing email...'}
        )
        
        db = next(get_sync_db())
        notification_service = NotificationService(db)
        
        # Send email
        email_results = notification_service.send_email(
            user_id=user_id,
            email_data=email_data,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Email notification task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'email_results': email_results,
            'task_id': task_id
        }
        
    except NotificationRetryException as e:
        logger.warning(f"Email notification task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Email notification task {task_id} failed: {e}")
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
    default_retry_delay=15,
    autoretry_for=(NotificationRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=120,  # 2 minutes
    soft_time_limit=90,  # 1.5 minutes
    queue='notifications'
)
def send_system_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send system alert notification.
    
    Args:
        alert_data: Alert content and configuration
    
    Returns:
        Alert sending results
    """
    task_id = self.request.id
    logger.info(f"Starting system alert task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing system alert...'}
        )
        
        db = next(get_sync_db())
        notification_service = NotificationService(db)
        
        # Send system alert
        alert_results = notification_service.send_system_alert(
            alert_data=alert_data,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"System alert task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'alert_results': alert_results,
            'task_id': task_id
        }
        
    except NotificationRetryException as e:
        logger.warning(f"System alert task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"System alert task {task_id} failed: {e}")
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
    default_retry_delay=15,
    autoretry_for=(NotificationRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=180,  # 3 minutes
    soft_time_limit=150,  # 2.5 minutes
    queue='notifications'
)
def send_task_completion_notification(self, user_id: int, task_id: str, task_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send task completion notification to user.
    
    Args:
        user_id: ID of the user to notify
        task_id: ID of the completed task
        task_result: Task completion results
    
    Returns:
        Notification results
    """
    task_id_notification = self.request.id
    logger.info(f"Starting task completion notification {task_id_notification} for user {user_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing task completion notification...'}
        )
        
        db = next(get_sync_db())
        notification_service = NotificationService(db)
        
        # Send task completion notification
        notification_results = notification_service.send_task_completion_notification(
            user_id=user_id,
            task_id=task_id,
            task_result=task_result,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Task completion notification {task_id_notification} completed successfully")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'task_id': task_id,
            'notification_results': notification_results,
            'notification_task_id': task_id_notification
        }
        
    except NotificationRetryException as e:
        logger.warning(f"Task completion notification {task_id_notification} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Task completion notification {task_id_notification} failed: {e}")
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
    default_retry_delay=15,
    autoretry_for=(NotificationRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=180,  # 3 minutes
    soft_time_limit=150,  # 2.5 minutes
    queue='notifications'
)
def send_error_notification(self, user_id: int, error_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send error notification to user.
    
    Args:
        user_id: ID of the user to notify
        error_data: Error information and context
    
    Returns:
        Error notification results
    """
    task_id = self.request.id
    logger.info(f"Starting error notification task {task_id} for user {user_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing error notification...'}
        )
        
        db = next(get_sync_db())
        notification_service = NotificationService(db)
        
        # Send error notification
        error_notification_results = notification_service.send_error_notification(
            user_id=user_id,
            error_data=error_data,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Error notification task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'error_notification_results': error_notification_results,
            'task_id': task_id
        }
        
    except NotificationRetryException as e:
        logger.warning(f"Error notification task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Error notification task {task_id} failed: {e}")
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
    autoretry_for=(NotificationRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=600,  # 10 minutes
    soft_time_limit=500,  # 8 minutes
    queue='notifications'
)
def cleanup_old_notifications(self) -> Dict[str, Any]:
    """
    Clean up old notifications.
    
    Returns:
        Cleanup results and statistics
    """
    task_id = self.request.id
    logger.info(f"Starting notification cleanup task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting notification cleanup...'}
        )
        
        db = next(get_sync_db())
        notification_service = NotificationService(db)
        
        # Clean up old notifications
        cleanup_results = notification_service.cleanup_old_notifications(
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Notification cleanup task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'cleanup_results': cleanup_results,
            'task_id': task_id
        }
        
    except NotificationRetryException as e:
        logger.warning(f"Notification cleanup task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Notification cleanup task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


# Notification utility functions
def get_notification_status(notification_id: str) -> Dict[str, Any]:
    """
    Get the status of a specific notification.
    
    Args:
        notification_id: ID of the notification to check
    
    Returns:
        Notification status and metadata
    """
    try:
        result = celery_app.AsyncResult(notification_id)
        return {
            'notification_id': notification_id,
            'status': result.status,
            'result': result.result if result.ready() else None,
            'info': result.info if hasattr(result, 'info') else None,
            'traceback': result.traceback if result.failed() else None
        }
    except Exception as e:
        logger.error(f"Error getting notification status for {notification_id}: {e}")
        return {
            'notification_id': notification_id,
            'status': 'ERROR',
            'error': str(e)
        }


def cancel_notification(notification_id: str) -> Dict[str, Any]:
    """
    Cancel a running notification.
    
    Args:
        notification_id: ID of the notification to cancel
    
    Returns:
        Cancellation result
    """
    try:
        celery_app.control.revoke(notification_id, terminate=True)
        return {
            'notification_id': notification_id,
            'status': 'CANCELLED',
            'message': 'Notification cancelled successfully'
        }
    except Exception as e:
        logger.error(f"Error cancelling notification {notification_id}: {e}")
        return {
            'notification_id': notification_id,
            'status': 'ERROR',
            'error': str(e)
        } 