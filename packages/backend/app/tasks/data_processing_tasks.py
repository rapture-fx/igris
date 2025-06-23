import time
import logging
import uuid
import asyncio
import gc
import psutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd

from app.core.celery_app import celery_app
from app.services.ai_engine import DataQualityAnalyzer, DataCleaner
from app.services.ai_data_intelligence_processor import AIDataIntelligenceProcessor
from app.services.file_processor import ProcessingJobManager
from celery import current_task

# For database updates from within the task, we'll need a way to get a DB session.
# This is a common pattern for Celery tasks interacting with SQLAlchemy.
# from app.database.connection import AsyncSessionLocal # If using AsyncSessionLocal directly
# from app.crud import crud_data_processing # To update job status
# from app.database.models import JobStatus # For enum

logger = logging.getLogger(__name__)

# Performance constants
MAX_MEMORY_USAGE_PERCENT = 85
CHUNK_SIZE = 10000  # Process in chunks for large files

@celery_app.task(bind=True, name="tasks.detect_schema")
def schema_detection_task(self, job_id: str, file_path: str):
    """
    Celery task to detect schema from a given file.
    Updates the ProcessingJob status and results.
    """
    logger.info(f"[Job ID: {job_id}] Starting schema detection for file: {file_path}")
    
    # Simulate actual work
    try:
        # This is where you'd put actual schema detection logic
        # e.g., using pandas to read the file and infer dtypes
        time.sleep(10) # Simulate a 10-second processing time
        detected_schema = {
            "columns": [
                {"name": "column_A", "type": "string", "inferred_type": "text"},
                {"name": "column_B", "type": "integer", "inferred_type": "numeric"},
                {"name": "column_C", "type": "datetime", "inferred_type": "timestamp"}
            ],
            "row_count": 1000,
            "file_size_bytes": 20480
        }
        logger.info(f"[Job ID: {job_id}] Schema detection successful. Schema: {detected_schema}")
        
        # TODO: Update ProcessingJob in database with status=COMPLETED, result=detected_schema
        # Example (requires db session setup within task):
        # async def update_db():
        #     async with AsyncSessionLocal() as db:
        #         await crud_data_processing.update_processing_job(
        #             db, 
        #             job_id=uuid.UUID(job_id), 
        #             job_in=schemas.ProcessingJobUpdate(
        #                 status=JobStatus.COMPLETED, 
        #                 output_summary=detected_schema,
        #                 progress_percentage=100.0
        #             )
        #         )
        # asyncio.run(update_db()) # Running async code from sync task context if needed, or make task async

        return {"status": "SUCCESS", "file": file_path, "schema": detected_schema}

    except Exception as e:
        logger.error(f"[Job ID: {job_id}] Error during schema detection for {file_path}: {e}", exc_info=True)
        # TODO: Update ProcessingJob in database with status=FAILED, error_message=str(e)
        # Example (requires db session setup within task):
        # async def update_db_failed():
        #     async with AsyncSessionLocal() as db:
        #         await crud_data_processing.update_processing_job(
        #             db, 
        #             job_id=uuid.UUID(job_id), 
        #             job_in=schemas.ProcessingJobUpdate(
        #                 status=JobStatus.FAILED, 
        #                 error_message=str(e)
        #             )
        #         )
        # asyncio.run(update_db_failed())
        # self.update_state(state='FAILURE', meta={'exc_type': type(e).__name__, 'exc_message': str(e)})
        # raise # Or handle gracefully and just return error status
        return {"status": "FAILURE", "file": file_path, "error": str(e)}

@celery_app.task(bind=True, name="tasks.process_large_file", queue="data_processing")
def process_large_file_task(self, job_id: str, file_path: str, processing_options: Dict[str, Any] = None):
    """
    Enhanced file processing task with streaming support for large files
    
    Args:
        job_id: Unique job identifier
        file_path: Path to the file to process
        processing_options: Processing configuration options
    """
    logger.info(f"[Job {job_id}] Starting enhanced file processing for: {file_path}")
    
    if processing_options is None:
        processing_options = {
            'run_ai_analysis': True,
            'chunk_processing': True,
            'memory_limit_mb': 2000
        }
    
    try:
        # Update task progress
        current_task.update_state(
            state='PROGRESS',
            meta={'progress': 10, 'status': 'Initializing file processing...'}
        )
        
        # Check file size to determine processing strategy
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        file_size_gb = file_path_obj.stat().st_size / (1024**3)
        use_streaming = file_size_gb > 0.5  # Use streaming for files > 500MB
        
        logger.info(f"[Job {job_id}] File size: {file_size_gb:.2f}GB, Using streaming: {use_streaming}")
        
        # Initialize processors
        job_manager = ProcessingJobManager()
        
        current_task.update_state(
            state='PROGRESS',
            meta={'progress': 20, 'status': 'Processing file...'}
        )
        
        if use_streaming:
            result = _process_file_streaming(job_id, file_path, processing_options)
        else:
            # Use existing job manager for small files
            result = asyncio.run(job_manager.process_file_async(job_id))
        
        current_task.update_state(
            state='SUCCESS',
            meta={
                'progress': 100,
                'status': 'File processing completed successfully',
                'result': result
            }
        )
        
        logger.info(f"[Job {job_id}] File processing completed successfully")
        return result
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Job {job_id}] File processing failed: {error_msg}")
        
        current_task.update_state(
            state='FAILURE',
            meta={
                'progress': 0,
                'status': f'File processing failed: {error_msg}',
                'error': error_msg
            }
        )
        
        raise

def _process_file_streaming(job_id: str, file_path: str, options: Dict[str, Any]) -> Dict[str, Any]:
    """Process large files using streaming approach with memory management"""
    
    logger.info(f"[Job {job_id}] Starting streaming file processing")
    
    # Memory monitoring
    def get_memory_usage():
        return psutil.virtual_memory().percent
    
    def force_garbage_collection():
        gc.collect()
        logger.info(f"Garbage collection completed. Memory usage: {get_memory_usage()}%")
    
    # Initialize results
    processing_result = {
        'total_rows': 0,
        'chunks_processed': 0,
        'processing_time_seconds': 0,
        'memory_peak_usage_percent': 0,
        'ai_analysis_summary': None
    }
    
    start_time = time.time()
    peak_memory = 0
    
    try:
        # Process file in chunks
        chunk_count = 0
        total_rows = 0
        
        # Read file in chunks
        file_extension = Path(file_path).suffix.lower()
        
        if file_extension == '.csv':
            chunk_iter = pd.read_csv(file_path, chunksize=CHUNK_SIZE)
        elif file_extension == '.json':
            # For JSON, read full file but process in chunks
            df = pd.read_json(file_path)
            chunk_iter = [df[i:i+CHUNK_SIZE] for i in range(0, len(df), CHUNK_SIZE)]
        elif file_extension in ['.xlsx', '.xls']:
            # Excel files need to be read completely first
            df = pd.read_excel(file_path)
            chunk_iter = [df[i:i+CHUNK_SIZE] for i in range(0, len(df), CHUNK_SIZE)]
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
        
        for chunk_idx, chunk in enumerate(chunk_iter):
            logger.info(f"[Job {job_id}] Processing chunk {chunk_idx + 1}, size: {len(chunk)} rows")
            
            # Monitor memory usage
            current_memory = get_memory_usage()
            peak_memory = max(peak_memory, current_memory)
            
            if current_memory > MAX_MEMORY_USAGE_PERCENT:
                logger.warning(f"[Job {job_id}] High memory usage: {current_memory}%")
                force_garbage_collection()
            
            # Process chunk
            chunk_count += 1
            total_rows += len(chunk)
            
            # Update progress
            progress = min(80, 20 + chunk_idx * 50 / max(chunk_count, 1))
            current_task.update_state(
                state='PROGRESS',
                meta={
                    'progress': progress,
                    'status': f'Processed {total_rows} rows in {chunk_count} chunks'
                }
            )
            
            # Optional: Run AI analysis on first chunk if requested
            if options.get('run_ai_analysis', False) and chunk_idx == 0:
                logger.info(f"[Job {job_id}] Running AI analysis on sample chunk")
                detective = AIDataIntelligenceProcessor()
                chunk_analysis = asyncio.run(detective.comprehensive_analysis(chunk, options))
                processing_result['ai_analysis_summary'] = chunk_analysis
        
        # Finalize results
        processing_result.update({
            'total_rows': total_rows,
            'chunks_processed': chunk_count,
            'processing_time_seconds': time.time() - start_time,
            'memory_peak_usage_percent': peak_memory,
            'status': 'completed',
            'processing_method': 'streaming'
        })
        
        logger.info(f"[Job {job_id}] Streaming processing completed: {processing_result}")
        
        return processing_result
        
    except Exception as e:
        logger.error(f"[Job {job_id}] Streaming processing failed: {e}")
        raise

@celery_app.task(bind=True, name="tasks.cleanup_expired_jobs", queue="data_processing")
def cleanup_expired_jobs(self):
    """
    Clean up expired processing jobs and temporary files
    """
    logger.info("Starting cleanup of expired processing jobs")
    
    try:
        cleanup_stats = {
            'jobs_cleaned': 0,
            'files_deleted': 0,
            'size_freed_mb': 0,
            'errors': []
        }
        
        # Clean up old upload files (older than 7 days)
        uploads_path = Path("uploads")
        if uploads_path.exists():
            cutoff_time = datetime.now().timestamp() - (7 * 24 * 3600)  # 7 days ago
            
            for file_path in uploads_path.rglob('*'):
                if file_path.is_file():
                    try:
                        if file_path.stat().st_mtime < cutoff_time:
                            file_size = file_path.stat().st_size
                            file_path.unlink()
                            cleanup_stats['files_deleted'] += 1
                            cleanup_stats['size_freed_mb'] += file_size / (1024**2)
                    except Exception as e:
                        cleanup_stats['errors'].append(f"Failed to delete {file_path}: {e}")
        
        # TODO: Clean up old database records
        # This would require database session setup
        
        logger.info(f"Cleanup completed: {cleanup_stats}")
        return cleanup_stats
        
    except Exception as e:
        logger.error(f"Cleanup task failed: {e}")
        return {'error': str(e)}

@celery_app.task(bind=True, name="tasks.memory_monitoring", queue="monitoring")
def memory_monitoring_task(self):
    """
    Monitor system memory usage and trigger alerts if needed
    """
    try:
        memory = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        
        monitoring_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'memory_usage_percent': memory.percent,
            'memory_available_gb': memory.available / (1024**3),
            'cpu_usage_percent': cpu,
            'status': 'healthy'
        }
        
        # Determine status
        if memory.percent > 90 or cpu > 95:
            monitoring_data['status'] = 'critical'
            logger.error(f"Critical resource usage: Memory: {memory.percent}%, CPU: {cpu}%")
        elif memory.percent > 80 or cpu > 80:
            monitoring_data['status'] = 'warning'
            logger.warning(f"High resource usage: Memory: {memory.percent}%, CPU: {cpu}%")
        
        return monitoring_data
        
    except Exception as e:
        logger.error(f"Memory monitoring failed: {e}")
        return {'error': str(e)}

# Enhanced schema detection with better error handling and memory management
@celery_app.task(bind=True, name="tasks.enhanced_schema_detection", queue="data_processing")
def enhanced_schema_detection_task(self, job_id: str, file_path: str):
    """
    Enhanced schema detection with memory management and streaming support
    """
    logger.info(f"[Job ID: {job_id}] Starting enhanced schema detection for file: {file_path}")
    
    try:
        current_task.update_state(
            state='PROGRESS',
            meta={'progress': 10, 'status': 'Initializing schema detection...'}
        )
        
        # Check file size
        file_path_obj = Path(file_path)
        file_size_gb = file_path_obj.stat().st_size / (1024**3)
        
        if file_size_gb > 1.0:  # Large file
            logger.info(f"[Job ID: {job_id}] Large file detected ({file_size_gb:.2f}GB), using sampling")
            result = _detect_schema_from_sample(job_id, file_path)
        else:
            logger.info(f"[Job ID: {job_id}] Small file ({file_size_gb:.2f}GB), using full analysis")
            result = _detect_schema_full_analysis(job_id, file_path)
        
        current_task.update_state(
            state='SUCCESS',
            meta={
                'progress': 100,
                'status': 'Schema detection completed',
                'result': result
            }
        )
        
        return result
        
    except Exception as e:
        logger.error(f"[Job ID: {job_id}] Enhanced schema detection failed: {e}")
        current_task.update_state(
            state='FAILURE',
            meta={
                'progress': 0,
                'status': f'Schema detection failed: {str(e)}',
                'error': str(e)
            }
        )
        raise

def _detect_schema_from_sample(job_id: str, file_path: str) -> Dict[str, Any]:
    """Detect schema from a sample of a large file"""
    
    logger.info(f"[Job ID: {job_id}] Using sampling for schema detection")
    
    # Load only first chunk for schema detection
    file_extension = Path(file_path).suffix.lower()
    
    if file_extension == '.csv':
        # Read first 1000 rows for schema detection
        sample_df = pd.read_csv(file_path, nrows=1000)
    elif file_extension == '.json':
        # For JSON, read full file but limit processing
        df_full = pd.read_json(file_path)
        sample_df = df_full.head(1000)
    elif file_extension in ['.xlsx', '.xls']:
        sample_df = pd.read_excel(file_path, nrows=1000)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    
    # Analyze schema using AI engine
    analyzer = DataQualityAnalyzer()
    schema_info = analyzer.analyze_schema(sample_df)
    
    return {
        "status": "SUCCESS",
        "file": file_path,
        "schema": schema_info,
        "sample_rows": len(sample_df),
        "method": "sampling"
    }

def _detect_schema_full_analysis(job_id: str, file_path: str) -> Dict[str, Any]:
    """Detect schema from full file analysis"""
    
    logger.info(f"[Job ID: {job_id}] Using full analysis for schema detection")
    
    # Load full file
    file_extension = Path(file_path).suffix.lower()
    
    if file_extension == '.csv':
        df = pd.read_csv(file_path)
    elif file_extension == '.json':
        df = pd.read_json(file_path)
    elif file_extension in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
    elif file_extension == '.parquet':
        df = pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    
    # Analyze schema using AI engine
    analyzer = DataQualityAnalyzer()
    schema_info = analyzer.analyze_schema(df)
    
    return {
        "status": "SUCCESS", 
        "file": file_path,
        "schema": schema_info,
        "total_rows": len(df),
        "method": "full_analysis"
    }

# You can add more data processing tasks here
# e.g., @celery_app.task(name="tasks.clean_data")
# def clean_data_task(job_id: str, ...):
#     pass 