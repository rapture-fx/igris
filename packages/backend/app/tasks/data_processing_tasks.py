"""
Data Processing Tasks for Schlep-engine

This module contains all data processing tasks that run asynchronously
using Celery. Tasks include data cleaning, validation, transformation,
and analysis with robust retry mechanisms and error handling.
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
from app.services.data_processing_service import DataProcessingService
from app.services.ai_processing_service import AIProcessingService

logger = get_task_logger(__name__)


class TaskRetryException(Exception):
    """Custom exception for task retries"""
    pass


def exponential_backoff_retry_delay(retry_count: int, base_delay: int = 60) -> int:
    """
    Calculate exponential backoff delay for retries.
    
    Args:
        retry_count: Current retry attempt number
        base_delay: Base delay in seconds (default: 60)
    
    Returns:
        Delay in seconds for next retry
    """
    return min(base_delay * (2 ** retry_count), 3600)  # Max 1 hour delay


@celery_app.task(
    bind=True,
    max_retries=5,
    default_retry_delay=60,
    autoretry_for=(TaskRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=7200,  # 2 hours
    soft_time_limit=6600,  # 1 hour 50 minutes
    queue='data_processing'
)
def process_dataset(self, dataset_id: int, processing_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a dataset asynchronously with comprehensive error handling and retries.
    
    Args:
        dataset_id: ID of the dataset to process
        processing_options: Processing configuration options
    
    Returns:
        Processing results and metadata
    """
    task_id = self.request.id
    logger.info(f"Starting dataset processing task {task_id} for dataset {dataset_id}")
    
    try:
        # Update task status
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Initializing processing...'}
        )
        
        # Get database session
        db = next(get_sync_db())
        
        # Initialize processing service
        processing_service = DataProcessingService(db)
        
        # Validate dataset exists
        dataset = processing_service.get_dataset(dataset_id)
        if not dataset:
            raise TaskRetryException(f"Dataset {dataset_id} not found")
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 10, 'total': 100, 'status': 'Dataset validated, starting processing...'}
        )
        
        # Process dataset
        results = processing_service.process_dataset(
            dataset_id=dataset_id,
            options=processing_options,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int(10 + (current / total) * 80),  # 10-90% range
                    'total': 100,
                    'status': status
                }
            )
        )
        
        # Update final progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 95, 'total': 100, 'status': 'Processing complete, saving results...'}
        )
        
        # Save results to database
        processing_service.save_processing_results(dataset_id, results)
        
        logger.info(f"Dataset processing task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'results': results,
            'processing_time': time.time() - self.request.timestamp,
            'task_id': task_id
        }
        
    except TaskRetryException as e:
        logger.warning(f"Task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Task {task_id} failed with unrecoverable error: {e}")
        # Update task state with error
        self.update_state(
            state='FAILURE',
            meta={'error': str(e), 'traceback': str(e.__traceback__)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(TaskRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=3600,  # 1 hour
    soft_time_limit=3300,  # 55 minutes
    queue='data_processing'
)
def clean_data(self, dataset_id: int, cleaning_rules: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean dataset data according to specified rules.
    
    Args:
        dataset_id: ID of the dataset to clean
        cleaning_rules: Rules for data cleaning
    
    Returns:
        Cleaning results and statistics
    """
    task_id = self.request.id
    logger.info(f"Starting data cleaning task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting data cleaning...'}
        )
        
        db = next(get_sync_db())
        processing_service = DataProcessingService(db)
        
        # Perform data cleaning
        cleaning_results = processing_service.clean_data(
            dataset_id=dataset_id,
            rules=cleaning_rules,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Data cleaning task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'cleaning_results': cleaning_results,
            'task_id': task_id
        }
        
    except TaskRetryException as e:
        logger.warning(f"Data cleaning task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Data cleaning task {task_id} failed: {e}")
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
    max_retries=5,
    default_retry_delay=120,
    autoretry_for=(TaskRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=7200,  # 2 hours
    soft_time_limit=6600,  # 1 hour 50 minutes
    queue='ai_processing'
)
def analyze_data_with_ai(self, dataset_id: int, analysis_type: str, ai_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform AI-powered data analysis.
    
    Args:
        dataset_id: ID of the dataset to analyze
        analysis_type: Type of analysis to perform
        ai_options: AI analysis configuration
    
    Returns:
        AI analysis results
    """
    task_id = self.request.id
    logger.info(f"Starting AI analysis task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Initializing AI analysis...'}
        )
        
        db = next(get_sync_db())
        ai_service = AIProcessingService(db)
        
        # Perform AI analysis
        analysis_results = ai_service.analyze_data(
            dataset_id=dataset_id,
            analysis_type=analysis_type,
            options=ai_options,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"AI analysis task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'analysis_type': analysis_type,
            'analysis_results': analysis_results,
            'task_id': task_id
        }
        
    except TaskRetryException as e:
        logger.warning(f"AI analysis task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries, base_delay=120),
            exc=e
        )
    except Exception as e:
        logger.error(f"AI analysis task {task_id} failed: {e}")
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
    default_retry_delay=60,
    autoretry_for=(TaskRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=1800,  # 30 minutes
    soft_time_limit=1500,  # 25 minutes
    queue='export'
)
def export_data(self, dataset_id: int, export_format: str, export_options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export dataset in specified format.
    
    Args:
        dataset_id: ID of the dataset to export
        export_format: Format for export (csv, json, excel, etc.)
        export_options: Export configuration options
    
    Returns:
        Export results with file information
    """
    task_id = self.request.id
    logger.info(f"Starting data export task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Preparing export...'}
        )
        
        db = next(get_sync_db())
        processing_service = DataProcessingService(db)
        
        # Export data
        export_results = processing_service.export_data(
            dataset_id=dataset_id,
            format=export_format,
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
        
        logger.info(f"Data export task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'export_format': export_format,
            'export_results': export_results,
            'task_id': task_id
        }
        
    except TaskRetryException as e:
        logger.warning(f"Data export task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Data export task {task_id} failed: {e}")
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
    autoretry_for=(TaskRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=600,  # 10 minutes
    soft_time_limit=500,  # 8 minutes
    queue='data_processing'
)
def validate_data(self, dataset_id: int, validation_rules: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate dataset against specified rules.
    
    Args:
        dataset_id: ID of the dataset to validate
        validation_rules: Rules for data validation
    
    Returns:
        Validation results and statistics
    """
    task_id = self.request.id
    logger.info(f"Starting data validation task {task_id} for dataset {dataset_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting validation...'}
        )
        
        db = next(get_sync_db())
        processing_service = DataProcessingService(db)
        
        # Validate data
        validation_results = processing_service.validate_data(
            dataset_id=dataset_id,
            rules=validation_rules,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Data validation task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'dataset_id': dataset_id,
            'validation_results': validation_results,
            'task_id': task_id
        }
        
    except TaskRetryException as e:
        logger.warning(f"Data validation task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Data validation task {task_id} failed: {e}")
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
    autoretry_for=(TaskRetryException,),
    retry_backoff=True,
    retry_jitter=True,
    time_limit=3600,  # 1 hour
    soft_time_limit=3300,  # 55 minutes
    queue='data_processing'
)
def cleanup_expired_jobs(self) -> Dict[str, Any]:
    """
    Clean up expired jobs and old results.
    
    Returns:
        Cleanup results and statistics
    """
    task_id = self.request.id
    logger.info(f"Starting cleanup task {task_id}")
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting cleanup...'}
        )
        
        db = next(get_sync_db())
        processing_service = DataProcessingService(db)
        
        # Clean up expired jobs
        cleanup_results = processing_service.cleanup_expired_jobs(
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={
                    'current': int((current / total) * 100),
                    'total': 100,
                    'status': status
                }
            )
        )
        
        logger.info(f"Cleanup task {task_id} completed successfully")
        
        return {
            'status': 'success',
            'cleanup_results': cleanup_results,
            'task_id': task_id
        }
        
    except TaskRetryException as e:
        logger.warning(f"Cleanup task {task_id} failed with retryable error: {e}")
        raise self.retry(
            countdown=exponential_backoff_retry_delay(self.request.retries),
            exc=e
        )
    except Exception as e:
        logger.error(f"Cleanup task {task_id} failed: {e}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        if 'db' in locals():
            db.close()


# Task utility functions
def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get the status of a specific task.
    
    Args:
        task_id: ID of the task to check
    
    Returns:
        Task status and metadata
    """
    try:
        result = celery_app.AsyncResult(task_id)
        return {
            'task_id': task_id,
            'status': result.status,
            'result': result.result if result.ready() else None,
            'info': result.info if hasattr(result, 'info') else None,
            'traceback': result.traceback if result.failed() else None
        }
    except Exception as e:
        logger.error(f"Error getting task status for {task_id}: {e}")
        return {
            'task_id': task_id,
            'status': 'ERROR',
            'error': str(e)
        }


def cancel_task(task_id: str) -> Dict[str, Any]:
    """
    Cancel a running task.
    
    Args:
        task_id: ID of the task to cancel
    
    Returns:
        Cancellation result
    """
    try:
        celery_app.control.revoke(task_id, terminate=True)
        return {
            'task_id': task_id,
            'status': 'CANCELLED',
            'message': 'Task cancelled successfully'
        }
    except Exception as e:
        logger.error(f"Error cancelling task {task_id}: {e}")
        return {
            'task_id': task_id,
            'status': 'ERROR',
            'error': str(e)
        } 