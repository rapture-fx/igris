"""
Export Tasks for Schlep-engine

This module contains all export-related tasks that run asynchronously
using Celery. Tasks include data export in various formats, file generation,
and delivery mechanisms.
"""

import logging
import time
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
from celery import current_task
from celery.utils.log import get_task_logger

from app.core.celery_app import celery_app
from app.core.unified_config import settings
from app.database.connection import get_sync_db
from app.services.export_service import ExportService

logger = get_task_logger(__name__)


class ExportRetryException(Exception):
    """Custom exception for export task retries"""
    pass


def exponential_backoff_retry_delay(retry_count: int, base_delay: int = 30) -> int:
    """
    Calculate exponential backoff delay for export retries.
    
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
    autoretry_for=(ExportRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=3600,  # 1 hour
    soft_time_limit=3300,  # 55 minutes
    queue='export'
)
def export_dataset_csv(self, dataset_id: int, export_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export dataset to CSV format.
    
    Args:
        dataset_id: ID of the dataset to export
        export_options: Export configuration options
    
    Returns:
        Export results with file information
    """
    task_id = self.request.id
    logger.info(f"Starting CSV export task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing CSV export...'}
        )
        
        db = next(get_sync_db())
        export_service = ExportService(db)
        
        # Export to CSV
        export_results = export_service.export_to_csv(
            dataset_id=dataset_id,
            options=export_options,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"CSV export task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'format': 'csv',
            'export_results': export_results,
            'task_id': task_id
        }
        
    except ExportRetryException as e:
        logger.warning(f"CSV export task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"CSV export task {task_id} failed: {e}")
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
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(ExportRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=3600,  # 1 hour
    soft_time_limit=3300,  # 55 minutes
    queue='export'
)
def export_dataset_excel(self, dataset_id: int, export_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export dataset to Excel format.
    
    Args:
        dataset_id: ID of the dataset to export
        export_options: Export configuration options
    
    Returns:
        Export results with file information
    """
    task_id = self.request.id
    logger.info(f"Starting Excel export task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing Excel export...'}
        )
        
        db = next(get_sync_db())
        export_service = ExportService(db)
        
        # Export to Excel
        export_results = export_service.export_to_excel(
            dataset_id=dataset_id,
            options=export_options,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Excel export task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'format': 'excel',
            'export_results': export_results,
            'task_id': task_id
        }
        
    except ExportRetryException as e:
        logger.warning(f"Excel export task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Excel export task {task_id} failed: {e}")
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
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(ExportRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=3600,  # 1 hour
    soft_time_limit=3300,  # 55 minutes
    queue='export'
)
def export_dataset_json(self, dataset_id: int, export_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export dataset to JSON format.
    
    Args:
        dataset_id: ID of the dataset to export
        export_options: Export configuration options
    
    Returns:
        Export results with file information
    """
    task_id = self.request.id
    logger.info(f"Starting JSON export task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing JSON export...'}
        )
        
        db = next(get_sync_db())
        export_service = ExportService(db)
        
        # Export to JSON
        export_results = export_service.export_to_json(
            dataset_id=dataset_id,
            options=export_options,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"JSON export task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'format': 'json',
            'export_results': export_results,
            'task_id': task_id
        }
        
    except ExportRetryException as e:
        logger.warning(f"JSON export task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"JSON export task {task_id} failed: {e}")
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
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(ExportRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=3600,  # 1 hour
    soft_time_limit=3300,  # 55 minutes
    queue='export'
)
def export_dataset_parquet(self, dataset_id: int, export_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export dataset to Parquet format.
    
    Args:
        dataset_id: ID of the dataset to export
        export_options: Export configuration options
    
    Returns:
        Export results with file information
    """
    task_id = self.request.id
    logger.info(f"Starting Parquet export task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing Parquet export...'}
        )
        
        db = next(get_sync_db())
        export_service = ExportService(db)
        
        # Export to Parquet
        export_results = export_service.export_to_parquet(
            dataset_id=dataset_id,
            options=export_options,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Parquet export task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'format': 'parquet',
            'export_results': export_results,
            'task_id': task_id
        }
        
    except ExportRetryException as e:
        logger.warning(f"Parquet export task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Parquet export task {task_id} failed: {e}")
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
    default_retry_delay=60,
    autoretry_for=(ExportRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=1800,  # 30 minutes
    soft_time_limit=1500,  # 25 minutes
    queue='export'
)
def cleanup_old_exports(self) -> Dict[str, Any]:
    """
    Clean up old export files.
    
    Returns:
        Cleanup results and statistics
    """
    task_id = self.request.id
    logger.info(f"Starting export cleanup task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting export cleanup...'}
        )
        
        db = next(get_sync_db())
        export_service = ExportService(db)
        
        # Clean up old exports
        cleanup_results = export_service.cleanup_old_exports(
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Export cleanup task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'cleanup_results': cleanup_results,
            'task_id': task_id
        }
        
    except ExportRetryException as e:
        logger.warning(f"Export cleanup task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Export cleanup task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


# Export utility functions
def get_export_status(export_id: str) -> Dict[str, Any]:
    """
    Get the status of a specific export.
    
    Args:
        export_id: ID of the export to check
    
    Returns:
        Export status and metadata
    """
    try:
        result = celery_app.AsyncResult(export_id)
        return {
            'export_id': export_id,
            'status': result.status,
            'result': result.result if result.ready() else None,
            'info': result.info if hasattr(result, 'info') else None,
            'traceback': result.traceback if result.failed() else None
        }
    except Exception as e:
        logger.error(f"Error getting export status for {export_id}: {e}")
        return {
            'export_id': export_id,
            'status': 'ERROR',
            'error': str(e)
        }


def cancel_export(export_id: str) -> Dict[str, Any]:
    """
    Cancel a running export.
    
    Args:
        export_id: ID of the export to cancel
    
    Returns:
        Cancellation result
    """
    try:
        celery_app.control.revoke(export_id, terminate=True)
        return {
            'export_id': export_id,
            'status': 'CANCELLED',
            'message': 'Export cancelled successfully'
        }
    except Exception as e:
        logger.error(f"Error cancelling export {export_id}: {e}")
        return {
            'export_id': export_id,
            'status': 'ERROR',
            'error': str(e)
        } 