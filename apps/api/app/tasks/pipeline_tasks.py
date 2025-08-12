"""
Pipeline Execution Tasks
=======================

Celery tasks for executing data processing pipelines in the background.
Integrates with the pipeline orchestrator for comprehensive workflow management.
"""

import asyncio
import logging
from typing import Dict, Any
from celery import current_task

from app.core.celery_app import celery_app
from app.services.pipeline_orchestrator import pipeline_orchestrator, PipelineResult

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="pipeline.execute", queue="pipeline_execution")
def execute_pipeline_task(self, pipeline_id: str) -> Dict[str, Any]:
    """
    Execute a data processing pipeline in the background
    
    Args:
        pipeline_id: Unique pipeline identifier
        
    Returns:
        Pipeline result as dictionary
    """
    logger.info(f"[Pipeline {pipeline_id}] Starting background execution")
    
    try:
        # Update task state
        current_task.update_state(
            state='PROGRESS',
            meta={
                'pipeline_id': pipeline_id,
                'status': 'initializing',
                'progress': 0.0,
                'message': 'Starting pipeline execution'
            }
        )
        
        # Execute pipeline synchronously within the task
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                pipeline_orchestrator._execute_pipeline_sync(pipeline_id)
            )
        finally:
            loop.close()
        
        # Update task state on success
        current_task.update_state(
            state='SUCCESS',
            meta={
                'pipeline_id': pipeline_id,
                'status': 'completed',
                'progress': 100.0,
                'message': 'Pipeline execution completed successfully',
                'result': result.__dict__ if hasattr(result, '__dict__') else result
            }
        )
        
        logger.info(f"[Pipeline {pipeline_id}] Background execution completed successfully")
        return result.__dict__ if hasattr(result, '__dict__') else result
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Pipeline {pipeline_id}] Background execution failed: {error_msg}")
        
        # Update task state on failure
        current_task.update_state(
            state='FAILURE',
            meta={
                'pipeline_id': pipeline_id,
                'status': 'failed',
                'progress': 0.0,
                'message': f'Pipeline execution failed: {error_msg}',
                'error': error_msg
            }
        )
        
        raise


@celery_app.task(bind=True, name="pipeline.bulk_execute", queue="pipeline_execution")
def bulk_execute_pipelines_task(self, pipeline_configs: list) -> Dict[str, Any]:
    """
    Execute multiple pipelines in parallel
    
    Args:
        pipeline_configs: List of pipeline configuration dictionaries
        
    Returns:
        Results summary with individual pipeline results
    """
    logger.info(f"Starting bulk execution of {len(pipeline_configs)} pipelines")
    
    try:
        current_task.update_state(
            state='PROGRESS',
            meta={
                'total_pipelines': len(pipeline_configs),
                'completed_pipelines': 0,
                'failed_pipelines': 0,
                'progress': 0.0,
                'message': 'Initializing bulk pipeline execution'
            }
        )
        
        # Execute pipelines
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            results = loop.run_until_complete(
                _execute_pipelines_parallel(pipeline_configs)
            )
        finally:
            loop.close()
        
        # Aggregate results
        successful = sum(1 for r in results if r.get('success', False))
        failed = len(results) - successful
        
        summary = {
            'total_pipelines': len(pipeline_configs),
            'successful_pipelines': successful,
            'failed_pipelines': failed,
            'success_rate': successful / len(pipeline_configs) if pipeline_configs else 0,
            'results': results
        }
        
        current_task.update_state(
            state='SUCCESS',
            meta={
                **summary,
                'progress': 100.0,
                'message': f'Bulk execution completed: {successful} successful, {failed} failed'
            }
        )
        
        logger.info(f"Bulk execution completed: {successful} successful, {failed} failed")
        return summary
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Bulk pipeline execution failed: {error_msg}")
        
        current_task.update_state(
            state='FAILURE',
            meta={
                'error': error_msg,
                'message': f'Bulk execution failed: {error_msg}'
            }
        )
        
        raise


@celery_app.task(bind=True, name="pipeline.schedule_cleanup", queue="maintenance")
def cleanup_completed_pipelines_task(self, max_age_hours: int = 24) -> Dict[str, Any]:
    """
    Clean up completed pipelines and temporary files
    
    Args:
        max_age_hours: Maximum age of completed pipelines to keep
        
    Returns:
        Cleanup summary
    """
    logger.info(f"Starting pipeline cleanup (max age: {max_age_hours} hours)")
    
    try:
        current_task.update_state(
            state='PROGRESS',
            meta={
                'progress': 10.0,
                'message': 'Scanning for old pipelines'
            }
        )
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            cleanup_result = loop.run_until_complete(
                _cleanup_old_pipelines(max_age_hours)
            )
        finally:
            loop.close()
        
        current_task.update_state(
            state='SUCCESS',
            meta={
                **cleanup_result,
                'progress': 100.0,
                'message': 'Pipeline cleanup completed'
            }
        )
        
        logger.info(f"Pipeline cleanup completed: {cleanup_result}")
        return cleanup_result
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Pipeline cleanup failed: {error_msg}")
        
        current_task.update_state(
            state='FAILURE',
            meta={
                'error': error_msg,
                'message': f'Cleanup failed: {error_msg}'
            }
        )
        
        raise


# Helper functions

async def _execute_pipelines_parallel(pipeline_configs: list) -> list:
    """Execute multiple pipelines in parallel"""
    
    # Create pipelines
    pipeline_ids = []
    for config in pipeline_configs:
        pipeline_id = await pipeline_orchestrator.create_pipeline(
            config=config['config'],
            user_id=config['user_id'],
            workspace_id=config['workspace_id'],
            name=config.get('name'),
            description=config.get('description')
        )
        pipeline_ids.append(pipeline_id)
    
    # Execute pipelines concurrently
    tasks = [
        pipeline_orchestrator._execute_pipeline_sync(pipeline_id)
        for pipeline_id in pipeline_ids
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Convert results to dictionaries
    processed_results = []
    for result in results:
        if isinstance(result, Exception):
            processed_results.append({
                'success': False,
                'error': str(result)
            })
        else:
            processed_results.append(result.__dict__ if hasattr(result, '__dict__') else result)
    
    return processed_results


async def _cleanup_old_pipelines(max_age_hours: int) -> Dict[str, Any]:
    """Clean up old pipeline data and temporary files"""
    from datetime import datetime, timedelta
    import os
    import shutil
    from pathlib import Path
    
    cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
    
    cleanup_stats = {
        'pipelines_cleaned': 0,
        'files_deleted': 0,
        'space_freed_mb': 0.0,
        'errors': []
    }
    
    # Clean up pipeline records
    pipelines_to_remove = []
    for pipeline_id, pipeline_info in pipeline_orchestrator.active_pipelines.items():
        if (pipeline_info.get('completed_at') and 
            pipeline_info['completed_at'] < cutoff_time):
            pipelines_to_remove.append(pipeline_id)
    
    for pipeline_id in pipelines_to_remove:
        del pipeline_orchestrator.active_pipelines[pipeline_id]
        cleanup_stats['pipelines_cleaned'] += 1
    
    # Clean up temporary files
    temp_dir = Path('/tmp')
    if temp_dir.exists():
        for file_path in temp_dir.glob('pipeline_*'):
            try:
                if file_path.stat().st_mtime < cutoff_time.timestamp():
                    if file_path.is_file():
                        size_mb = file_path.stat().st_size / (1024 * 1024)
                        file_path.unlink()
                        cleanup_stats['files_deleted'] += 1
                        cleanup_stats['space_freed_mb'] += size_mb
                    elif file_path.is_dir():
                        size_mb = sum(
                            f.stat().st_size for f in file_path.rglob('*') if f.is_file()
                        ) / (1024 * 1024)
                        shutil.rmtree(file_path)
                        cleanup_stats['files_deleted'] += 1
                        cleanup_stats['space_freed_mb'] += size_mb
            except Exception as e:
                cleanup_stats['errors'].append(f"Failed to delete {file_path}: {str(e)}")
    
    return cleanup_stats


# Periodic task for automatic cleanup
@celery_app.task(name="pipeline.auto_cleanup")
def auto_cleanup_task():
    """Periodic task for automatic pipeline cleanup"""
    return cleanup_completed_pipelines_task.delay(max_age_hours=24)


# Task monitoring
@celery_app.task(bind=True, name="pipeline.monitor_health")
def monitor_pipeline_health_task(self):
    """Monitor pipeline system health and performance"""
    
    try:
        metrics = pipeline_orchestrator.get_performance_metrics()
        
        # Check for performance issues
        alerts = []
        
        if metrics['failed_pipelines'] > 0:
            failure_rate = metrics['failed_pipelines'] / metrics['total_pipelines']
            if failure_rate > 0.1:  # More than 10% failure rate
                alerts.append({
                    'type': 'high_failure_rate',
                    'message': f'High pipeline failure rate: {failure_rate:.1%}',
                    'severity': 'warning'
                })
        
        if metrics['average_processing_time'] > 300:  # More than 5 minutes
            alerts.append({
                'type': 'slow_processing',
                'message': f'Average processing time is high: {metrics["average_processing_time"]:.1f}s',
                'severity': 'info'
            })
        
        health_report = {
            'status': 'healthy' if not alerts else 'warning',
            'metrics': metrics,
            'alerts': alerts,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        logger.info(f"Pipeline health check: {health_report['status']}")
        return health_report
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Pipeline health monitoring failed: {error_msg}")
        
        return {
            'status': 'error',
            'error': error_msg,
            'timestamp': datetime.utcnow().isoformat()
        } 