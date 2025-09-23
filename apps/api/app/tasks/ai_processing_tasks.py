"""
AI Processing Tasks with Stream Processing and Memory Management
===============================================================

This module implements high-performance AI processing tasks that can handle large datasets
through streaming and memory-optimized processing. Addresses critical bottlenecks identified
in system analysis.

Key Features:
- Streaming data processing for large files (>1GB)
- Memory usage monitoring and limits
- Parallel processing for AI operations
- Progress tracking and cancellation support
- Error recovery and retry mechanisms
"""

import asyncio
import logging
import time
import traceback
import gc
import psutil
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, List, Iterator
from celery import current_task
import json
import os
import mmap
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import threading
from dataclasses import dataclass

from app.core.celery_app import celery_app
from app.services.ai_engine import DataQualityAnalyzer, DataCleaner, AutoLabeler
from app.services.ai_data_intelligence_processor import AIDataIntelligenceProcessor
from app.services.distributed_processor import (
    get_distributed_manager,
    create_processing_job,
    is_large_file_suitable_for_distributed_processing,
    distributed_processing_context
)
from app.core.distributed_config import is_distributed_enabled, get_distributed_config

logger = logging.getLogger(__name__)

@dataclass
class ProcessingConfig:
    """Configuration for large file processing"""
    chunk_size: int = 10000
    max_memory_percent: float = 85.0
    use_memory_mapping: bool = True
    parallel_workers: int = 4
    progress_update_interval: int = 1000  # rows
    enable_compression: bool = True

# Memory management constants
MAX_MEMORY_USAGE_PERCENT = 85
CHUNK_SIZE = 10000  # Process in chunks of 10k rows
# Removed MAX_FILE_SIZE_GB - now supports unlimited file sizes through streaming
LARGE_FILE_THRESHOLD_GB = 0.1  # Switch to streaming for files > 100MB
HUGE_FILE_THRESHOLD_GB = 1.0   # Use memory-mapped files for files > 1GB
DISTRIBUTED_PROCESSING_THRESHOLD_GB = 2.0  # Use distributed processing for files > 2GB

class MemoryMonitor:
    """Monitor and manage memory usage during processing"""
    
    @staticmethod
    def get_memory_usage() -> float:
        """Get current memory usage percentage"""
        return psutil.virtual_memory().percent
    
    @staticmethod
    def check_memory_limit() -> bool:
        """Check if we're approaching memory limits"""
        return MemoryMonitor.get_memory_usage() < MAX_MEMORY_USAGE_PERCENT
    
    @staticmethod
    def force_garbage_collection():
        """Force garbage collection to free memory"""
        gc.collect()
        logger.info(f"Garbage collection completed. Memory usage: {MemoryMonitor.get_memory_usage()}%")

class MemoryMappedFileProcessor:
    """Memory-mapped file processor for extremely large files"""

    def __init__(self, config: ProcessingConfig = None):
        self.config = config or ProcessingConfig()
        self.executor = ThreadPoolExecutor(max_workers=self.config.parallel_workers)

    def read_csv_chunks_mmap(self, file_path: str) -> Iterator[pd.DataFrame]:
        """Read CSV file using memory mapping for huge files"""
        file_path = Path(file_path)

        try:
            with open(file_path, 'rb') as file:
                with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as mmapped_file:
                    # Find header line
                    header_line = mmapped_file.readline().decode('utf-8').strip()
                    headers = header_line.split(',')

                    current_pos = mmapped_file.tell()
                    chunk_data = []

                    while current_pos < len(mmapped_file):
                        chunk_lines = []
                        rows_read = 0

                        # Read chunk_size rows
                        while rows_read < self.config.chunk_size and current_pos < len(mmapped_file):
                            line = mmapped_file.readline()
                            if not line:
                                break

                            line_str = line.decode('utf-8').strip()
                            if line_str:
                                chunk_lines.append(line_str.split(','))
                                rows_read += 1

                            current_pos = mmapped_file.tell()

                        if chunk_lines:
                            # Create DataFrame from chunk
                            df_chunk = pd.DataFrame(chunk_lines, columns=headers)

                            # Memory check before yielding
                            if not MemoryMonitor.check_memory_limit():
                                MemoryMonitor.force_garbage_collection()

                            yield df_chunk

        except Exception as e:
            logger.error(f"Memory-mapped file reading failed: {e}")
            raise

    def process_parallel_chunks(self, file_path: str, processor_func, *args) -> List[Any]:
        """Process file chunks in parallel using thread pool"""
        chunks = list(self.read_csv_chunks_mmap(file_path))

        if not chunks:
            return []

        # Process chunks in parallel
        futures = []
        for chunk in chunks:
            future = self.executor.submit(processor_func, chunk, *args)
            futures.append(future)

        # Collect results
        results = []
        for future in futures:
            try:
                result = future.result(timeout=300)  # 5 minute timeout per chunk
                results.append(result)
            except Exception as e:
                logger.error(f"Parallel chunk processing failed: {e}")
                results.append(None)

        return results

    def __del__(self):
        """Cleanup executor"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=True)

class StreamingDataProcessor:
    """Process large datasets in streaming chunks"""

    def __init__(self, config: ProcessingConfig = None):
        self.config = config or ProcessingConfig()
        self.chunk_size = self.config.chunk_size
        self.memory_monitor = MemoryMonitor()
        self.mmap_processor = MemoryMappedFileProcessor(self.config)
        self.progress_counter = 0
    
    def read_file_chunks(self, file_path: str, file_type: str = None) -> Iterator[pd.DataFrame]:
        """Read file in chunks to manage memory usage"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Check file size to determine processing strategy
        file_size_gb = file_path.stat().st_size / (1024**3)
        logger.info(f"Processing file of size: {file_size_gb:.2f}GB")

        # Use memory-mapped processing for huge files
        if file_size_gb > HUGE_FILE_THRESHOLD_GB:
            logger.info(f"Using memory-mapped processing for huge file: {file_size_gb:.2f}GB")
            file_extension = file_path.suffix.lower()

            if file_extension == '.csv':
                # Use memory-mapped processing for huge CSV files
                yield from self.mmap_processor.read_csv_chunks_mmap(str(file_path))
                return
            else:
                logger.warning(f"Memory-mapped processing not supported for {file_extension}, falling back to standard streaming")
        
        file_extension = file_path.suffix.lower()
        
        try:
            if file_extension == '.csv':
                chunk_iter = pd.read_csv(file_path, chunksize=self.chunk_size)
            elif file_extension == '.json':
                # For JSON, we need to read the whole file but can process in chunks
                df = pd.read_json(file_path)
                chunk_iter = [df[i:i+self.chunk_size] for i in range(0, len(df), self.chunk_size)]
            elif file_extension in ['.xlsx', '.xls']:
                # Excel files need to be read completely first
                df = pd.read_excel(file_path)
                chunk_iter = [df[i:i+self.chunk_size] for i in range(0, len(df), self.chunk_size)]
            elif file_extension == '.parquet':
                # Parquet supports chunked reading
                chunk_iter = pd.read_parquet(file_path, chunksize=self.chunk_size)
            else:
                raise ValueError(f"Unsupported file format: {file_extension}")
            
            for chunk in chunk_iter:
                # Check memory before processing each chunk
                if not self.memory_monitor.check_memory_limit():
                    self.memory_monitor.force_garbage_collection()

                    if not self.memory_monitor.check_memory_limit():
                        raise MemoryError(f"Memory usage too high: {self.memory_monitor.get_memory_usage()}%")

                # Update progress counter
                self.progress_counter += len(chunk)

                # Log progress at intervals
                if self.progress_counter % self.config.progress_update_interval == 0:
                    logger.info(f"Processed {self.progress_counter} rows, memory usage: {self.memory_monitor.get_memory_usage()}%")

                yield chunk
                
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            raise

@celery_app.task(bind=True, name="ai_processing.comprehensive_analysis", queue="ai_processing")
def comprehensive_ai_analysis_task(self, job_id: str, file_path: str, options: Dict[str, Any] = None):
    """
    Comprehensive AI analysis with streaming support for large files
    
    Args:
        job_id: Unique job identifier
        file_path: Path to the file to analyze
        options: Analysis options and configuration
    """
    logger.info(f"[Job {job_id}] Starting comprehensive AI analysis for: {file_path}")
    
    if options is None:
        options = {}
    
    try:
        # Update task progress
        current_task.update_state(
            state='PROGRESS',
            meta={'progress': 10, 'status': 'Initializing AI analysis...'}
        )
        
        # Initialize processors with enhanced configuration
        detective = AIDataIntelligenceProcessor()

        # Configure processing based on options
        processing_config = ProcessingConfig(
            chunk_size=options.get('chunk_size', CHUNK_SIZE),
            max_memory_percent=options.get('max_memory_percent', MAX_MEMORY_USAGE_PERCENT),
            use_memory_mapping=options.get('use_memory_mapping', True),
            parallel_workers=options.get('parallel_workers', 4),
            progress_update_interval=options.get('progress_update_interval', 1000)
        )

        processor = StreamingDataProcessor(processing_config)
        
        # Check file size to determine processing strategy
        file_path_obj = Path(file_path)
        file_size_gb = file_path_obj.stat().st_size / (1024**3)

        # Determine processing strategy based on file size and configuration
        use_distributed = (
            is_distributed_enabled() and
            file_size_gb > DISTRIBUTED_PROCESSING_THRESHOLD_GB and
            options.get('enable_distributed', True)
        )

        if use_distributed:
            logger.info(f"[Job {job_id}] Using distributed processing for very large file ({file_size_gb:.2f}GB)")
            result = _process_with_distributed_system(job_id, file_path, options)
        else:
            # Use existing streaming/standard processing
            # Initialize processors with enhanced configuration
            detective = AIDataIntelligenceProcessor()

            # Configure processing based on options
            processing_config = ProcessingConfig(
                chunk_size=options.get('chunk_size', CHUNK_SIZE),
                max_memory_percent=options.get('max_memory_percent', MAX_MEMORY_USAGE_PERCENT),
                use_memory_mapping=options.get('use_memory_mapping', True),
                parallel_workers=options.get('parallel_workers', 4),
                progress_update_interval=options.get('progress_update_interval', 1000)
            )

            processor = StreamingDataProcessor(processing_config)

            use_streaming = file_size_gb > LARGE_FILE_THRESHOLD_GB  # Use streaming for files > 100MB

            if use_streaming:
                logger.info(f"[Job {job_id}] Using streaming processing for large file ({file_size_gb:.2f}GB)")
                result = _process_large_file_streaming(job_id, file_path, detective, processor, options)
            else:
                logger.info(f"[Job {job_id}] Using standard processing for small file ({file_size_gb:.2f}GB)")
                result = _process_small_file_standard(job_id, file_path, detective, options)
        
        # Final progress update
        current_task.update_state(
            state='SUCCESS',
            meta={
                'progress': 100,
                'status': 'Analysis completed successfully',
                'result': result
            }
        )
        
        logger.info(f"[Job {job_id}] AI analysis completed successfully")
        return result
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        logger.error(f"[Job {job_id}] AI analysis failed: {error_msg}")
        logger.error(f"[Job {job_id}] Traceback: {error_trace}")
        
        current_task.update_state(
            state='FAILURE',
            meta={
                'progress': 0,
                'status': f'Analysis failed: {error_msg}',
                'error': error_msg,
                'traceback': error_trace
            }
        )
        
        raise

def _process_large_file_streaming(job_id: str, file_path: str, detective: AIDataIntelligenceProcessor, 
                                 processor: StreamingDataProcessor, options: Dict[str, Any]) -> Dict[str, Any]:
    """Process large files using streaming approach"""
    
    logger.info(f"[Job {job_id}] Starting streaming analysis")
    
    # Initialize aggregated results
    chunk_results = []
    total_rows = 0
    total_chunks = 0
    combined_schema = {}
    quality_scores = []
    
    # Update progress
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 20, 'status': 'Processing file in chunks...'}
    )
    
    # Process file in chunks
    for chunk_idx, chunk in enumerate(processor.read_file_chunks(file_path)):
        logger.info(f"[Job {job_id}] Processing chunk {chunk_idx + 1}, size: {len(chunk)} rows")
        
        # Analyze chunk
        chunk_analysis = asyncio.run(detective.comprehensive_analysis(chunk, options))
        chunk_results.append(chunk_analysis)
        
        total_rows += len(chunk)
        total_chunks += 1
        
        # Update schema information
        if chunk_analysis.get('schema_analysis'):
            for col, col_info in chunk_analysis['schema_analysis'].items():
                if col not in combined_schema:
                    combined_schema[col] = col_info
                # TODO: Merge schema information from multiple chunks
        
        # Collect quality scores
        if chunk_analysis.get('quality_score'):
            quality_scores.append(chunk_analysis['quality_score'])
        
        # Update progress
        progress = min(80, 20 + (chunk_idx + 1) * 50 / max(total_chunks, 1))
        current_task.update_state(
            state='PROGRESS',
            meta={
                'progress': progress,
                'status': f'Processed {total_rows} rows in {total_chunks} chunks'
            }
        )
        
        # Memory management
        MemoryMonitor.force_garbage_collection()
    
    # Aggregate results from all chunks
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 90, 'status': 'Aggregating results...'}
    )
    
    aggregated_result = _aggregate_chunk_results(chunk_results, total_rows, total_chunks)
    aggregated_result['processing_method'] = 'streaming'
    aggregated_result['total_chunks_processed'] = total_chunks
    
    return aggregated_result

def _process_small_file_standard(job_id: str, file_path: str, detective: AIDataIntelligenceProcessor, 
                                options: Dict[str, Any]) -> Dict[str, Any]:
    """Process small files using standard approach"""
    
    logger.info(f"[Job {job_id}] Starting standard analysis")
    
    # Update progress
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 30, 'status': 'Loading file...'}
    )
    
    # Load file
    df = _load_file(file_path)
    
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 50, 'status': 'Running AI analysis...'}
    )
    
    # Run comprehensive analysis
    result = asyncio.run(detective.comprehensive_analysis(df, options))
    result['processing_method'] = 'standard'
    result['total_rows'] = len(df)
    
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 90, 'status': 'Finalizing results...'}
    )
    
    return result

def _load_file(file_path: str) -> pd.DataFrame:
    """Load file into DataFrame"""
    file_path_obj = Path(file_path)
    file_extension = file_path_obj.suffix.lower()
    
    if file_extension == '.csv':
        return pd.read_csv(file_path)
    elif file_extension == '.json':
        return pd.read_json(file_path)
    elif file_extension in ['.xlsx', '.xls']:
        return pd.read_excel(file_path)
    elif file_extension == '.parquet':
        return pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")

def _aggregate_chunk_results(chunk_results: List[Dict[str, Any]], total_rows: int, 
                            total_chunks: int) -> Dict[str, Any]:
    """Aggregate results from multiple chunks"""
    
    if not chunk_results:
        return {'error': 'No chunk results to aggregate'}
    
    # Initialize aggregated result
    aggregated = {
        'quality_score': 0.0,
        'insights': [],
        'patterns': [],
        'recommendations': [],
        'anomalies': [],
        'schema_analysis': {},
        'total_rows': total_rows,
        'total_chunks': total_chunks,
        'chunk_count': len(chunk_results)
    }
    
    # Aggregate quality scores (weighted average)
    total_weight = 0
    weighted_score = 0
    
    for chunk_result in chunk_results:
        chunk_rows = chunk_result.get('total_rows', 0)
        chunk_score = chunk_result.get('quality_score', 0)
        
        if chunk_rows > 0:
            weighted_score += chunk_score * chunk_rows
            total_weight += chunk_rows
    
    if total_weight > 0:
        aggregated['quality_score'] = weighted_score / total_weight
    
    # Combine insights, patterns, recommendations, anomalies
    for chunk_result in chunk_results:
        aggregated['insights'].extend(chunk_result.get('insights', []))
        aggregated['patterns'].extend(chunk_result.get('patterns', []))
        aggregated['recommendations'].extend(chunk_result.get('recommendations', []))
        aggregated['anomalies'].extend(chunk_result.get('anomalies', []))
    
    # Remove duplicates from recommendations
    unique_recommendations = list(set(aggregated['recommendations']))
    aggregated['recommendations'] = unique_recommendations
    
    # Merge schema analysis (take first occurrence for now)
    for chunk_result in chunk_results:
        chunk_schema = chunk_result.get('schema_analysis', {})
        for col, col_info in chunk_schema.items():
            if col not in aggregated['schema_analysis']:
                aggregated['schema_analysis'][col] = col_info
    
    return aggregated

@celery_app.task(bind=True, name="ai_processing.data_cleaning", queue="ai_processing")
def data_cleaning_task(self, job_id: str, file_path: str, cleaning_options: Dict[str, Any] = None):
    """
    Advanced data cleaning task with streaming support
    
    Args:
        job_id: Unique job identifier
        file_path: Path to the file to clean
        cleaning_options: Cleaning configuration options
    """
    logger.info(f"[Job {job_id}] Starting data cleaning for: {file_path}")
    
    if cleaning_options is None:
        cleaning_options = {
            'remove_duplicates': True,
            'handle_missing_values': True,
            'normalize_formats': True,
            'remove_outliers': False
        }
    
    try:
        current_task.update_state(
            state='PROGRESS',
            meta={'progress': 10, 'status': 'Initializing data cleaning...'}
        )
        
        cleaner = DataCleaner()
        processor = StreamingDataProcessor()
        
        # Check file size for processing strategy
        file_path_obj = Path(file_path)
        file_size_gb = file_path_obj.stat().st_size / (1024**3)
        
        if file_size_gb > 0.5:  # Use streaming for large files
            result = _clean_large_file_streaming(job_id, file_path, cleaner, processor, cleaning_options)
        else:
            result = _clean_small_file_standard(job_id, file_path, cleaner, cleaning_options)
        
        current_task.update_state(
            state='SUCCESS',
            meta={
                'progress': 100,
                'status': 'Data cleaning completed successfully',
                'result': result
            }
        )
        
        logger.info(f"[Job {job_id}] Data cleaning completed successfully")
        return result
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Job {job_id}] Data cleaning failed: {error_msg}")
        
        current_task.update_state(
            state='FAILURE',
            meta={
                'progress': 0,
                'status': f'Data cleaning failed: {error_msg}',
                'error': error_msg
            }
        )
        
        raise

def _clean_large_file_streaming(job_id: str, file_path: str, cleaner: DataCleaner,
                                processor: StreamingDataProcessor, options: Dict[str, Any]) -> Dict[str, Any]:
    """Clean large files using streaming approach"""
    
    # Create output file path
    input_path = Path(file_path)
    output_path = input_path.parent / f"{input_path.stem}_cleaned{input_path.suffix}"
    
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 20, 'status': 'Processing file in chunks for cleaning...'}
    )
    
    # Process chunks and write to output file
    total_rows_processed = 0
    total_rows_output = 0
    chunk_count = 0
    
    # Initialize output file
    first_chunk = True
    
    for chunk_idx, chunk in enumerate(processor.read_file_chunks(file_path)):
        logger.info(f"[Job {job_id}] Cleaning chunk {chunk_idx + 1}, size: {len(chunk)} rows")
        
        # Clean chunk
        cleaned_chunk = chunk.copy()
        
        if options.get('remove_duplicates', True):
            cleaned_chunk, _ = cleaner.remove_duplicates(cleaned_chunk)
        
        if options.get('handle_missing_values', True):
            cleaned_chunk, _ = cleaner.handle_missing_values(cleaned_chunk)
        
        if options.get('normalize_formats', True):
            cleaned_chunk, _ = cleaner.normalize_formats(cleaned_chunk)
        
        # Write cleaned chunk to output file
        if first_chunk:
            cleaned_chunk.to_csv(output_path, index=False, mode='w')
            first_chunk = False
        else:
            cleaned_chunk.to_csv(output_path, index=False, mode='a', header=False)
        
        total_rows_processed += len(chunk)
        total_rows_output += len(cleaned_chunk)
        chunk_count += 1
        
        # Update progress
        progress = min(80, 20 + chunk_idx * 50 / max(chunk_count, 1))
        current_task.update_state(
            state='PROGRESS',
            meta={
                'progress': progress,
                'status': f'Processed {total_rows_processed} rows, output {total_rows_output} rows'
            }
        )
        
        # Memory management
        MemoryMonitor.force_garbage_collection()
    
    return {
        'cleaned_file_path': str(output_path),
        'total_rows_input': total_rows_processed,
        'total_rows_output': total_rows_output,
        'rows_removed': total_rows_processed - total_rows_output,
        'cleaning_method': 'streaming',
        'chunks_processed': chunk_count
    }

def _clean_small_file_standard(job_id: str, file_path: str, cleaner: DataCleaner,
                              options: Dict[str, Any]) -> Dict[str, Any]:
    """Clean small files using standard approach"""
    
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 30, 'status': 'Loading file for cleaning...'}
    )
    
    # Load file
    df = _load_file(file_path)
    initial_rows = len(df)
    
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 50, 'status': 'Applying cleaning operations...'}
    )
    
    # Apply cleaning operations
    if options.get('remove_duplicates', True):
        df, _ = cleaner.remove_duplicates(df)
    
    if options.get('handle_missing_values', True):
        df, _ = cleaner.handle_missing_values(df)
    
    if options.get('normalize_formats', True):
        df, _ = cleaner.normalize_formats(df)
    
    # Save cleaned file
    input_path = Path(file_path)
    output_path = input_path.parent / f"{input_path.stem}_cleaned{input_path.suffix}"
    
    current_task.update_state(
        state='PROGRESS',
        meta={'progress': 80, 'status': 'Saving cleaned file...'}
    )
    
    # Save based on file type
    if input_path.suffix.lower() == '.csv':
        df.to_csv(output_path, index=False)
    elif input_path.suffix.lower() == '.json':
        df.to_json(output_path, orient='records')
    elif input_path.suffix.lower() in ['.xlsx', '.xls']:
        df.to_excel(output_path, index=False)
    elif input_path.suffix.lower() == '.parquet':
        df.to_parquet(output_path, index=False)
    
    return {
        'cleaned_file_path': str(output_path),
        'total_rows_input': initial_rows,
        'total_rows_output': len(df),
        'rows_removed': initial_rows - len(df),
        'cleaning_method': 'standard'
    }

def _process_with_distributed_system(job_id: str, file_path: str, options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process very large files using distributed processing system
    """
    logger.info(f"[Job {job_id}] Starting distributed processing")

    try:
        # Get distributed manager
        manager = get_distributed_manager()

        # Create distributed processing job
        distributed_job = create_processing_job(
            file_path=file_path,
            job_type='comprehensive_analysis',
            parameters=options,
            priority=options.get('priority', 5)
        )

        # Submit job to distributed system
        distributed_job_id = manager.submit_job(distributed_job)

        # Update progress
        current_task.update_state(
            state='PROGRESS',
            meta={
                'progress': 20,
                'status': f'Submitted to distributed processing (job: {distributed_job_id})'
            }
        )

        # Monitor distributed job progress
        poll_interval = 5  # seconds
        max_wait_time = options.get('timeout', 3600)  # 1 hour default
        elapsed_time = 0

        while elapsed_time < max_wait_time:
            distributed_status = manager.get_job_status(distributed_job_id)

            if distributed_status['status'] == 'completed':
                logger.info(f"[Job {job_id}] Distributed processing completed")

                # Update final progress
                current_task.update_state(
                    state='PROGRESS',
                    meta={
                        'progress': 90,
                        'status': 'Retrieving distributed processing results'
                    }
                )

                result = distributed_status.get('result', {})
                result['processing_method'] = 'distributed'
                result['distributed_job_id'] = distributed_job_id
                result['processing_time'] = distributed_status.get('duration')

                return result

            elif distributed_status['status'] == 'failed':
                error_msg = distributed_status.get('error', 'Distributed processing failed')
                logger.error(f"[Job {job_id}] Distributed processing failed: {error_msg}")
                raise Exception(f"Distributed processing failed: {error_msg}")

            elif distributed_status['status'] == 'running':
                # Update progress based on elapsed time (estimated)
                progress = min(80, 20 + (elapsed_time / max_wait_time) * 60)
                current_task.update_state(
                    state='PROGRESS',
                    meta={
                        'progress': progress,
                        'status': f'Distributed processing in progress (elapsed: {elapsed_time}s)'
                    }
                )

            # Wait before next poll
            time.sleep(poll_interval)
            elapsed_time += poll_interval

        # Timeout reached
        logger.warning(f"[Job {job_id}] Distributed processing timeout after {max_wait_time}s")

        # Try to cancel the distributed job
        manager.cancel_job(distributed_job_id)

        raise TimeoutError(f"Distributed processing timeout after {max_wait_time} seconds")

    except Exception as e:
        logger.error(f"[Job {job_id}] Distributed processing error: {e}")

        # Fallback to streaming processing if distributed fails
        if options.get('fallback_to_streaming', True):
            logger.info(f"[Job {job_id}] Falling back to streaming processing")

            current_task.update_state(
                state='PROGRESS',
                meta={
                    'progress': 15,
                    'status': 'Distributed processing failed, falling back to streaming'
                }
            )

            # Initialize processors for fallback
            detective = AIDataIntelligenceProcessor()
            processing_config = ProcessingConfig(
                chunk_size=options.get('chunk_size', CHUNK_SIZE),
                max_memory_percent=options.get('max_memory_percent', MAX_MEMORY_USAGE_PERCENT),
                use_memory_mapping=options.get('use_memory_mapping', True),
                parallel_workers=options.get('parallel_workers', 4)
            )
            processor = StreamingDataProcessor(processing_config)

            result = _process_large_file_streaming(job_id, file_path, detective, processor, options)
            result['processing_method'] = 'streaming_fallback'
            result['distributed_error'] = str(e)

            return result
        else:
            raise

@celery_app.task(bind=True, name="ai_processing.distributed_analysis", queue="ai_processing")
def distributed_ai_analysis_task(self, job_id: str, file_path: str, options: Dict[str, Any] = None):
    """
    Dedicated task for distributed AI analysis of very large files

    Args:
        job_id: Unique job identifier
        file_path: Path to the file to analyze
        options: Analysis options and configuration
    """
    logger.info(f"[Job {job_id}] Starting dedicated distributed AI analysis for: {file_path}")

    if options is None:
        options = {}

    try:
        # Force distributed processing
        options['enable_distributed'] = True
        options['fallback_to_streaming'] = False

        # Update task progress
        current_task.update_state(
            state='PROGRESS',
            meta={'progress': 10, 'status': 'Initializing distributed AI analysis...'}
        )

        # Check if distributed processing is available
        if not is_distributed_enabled():
            raise Exception("Distributed processing is not enabled")

        # Check file size
        file_path_obj = Path(file_path)
        file_size_gb = file_path_obj.stat().st_size / (1024**3)

        if file_size_gb < DISTRIBUTED_PROCESSING_THRESHOLD_GB:
            logger.warning(f"[Job {job_id}] File size ({file_size_gb:.2f}GB) is below distributed processing threshold")

        # Process with distributed system
        result = _process_with_distributed_system(job_id, file_path, options)

        # Final progress update
        current_task.update_state(
            state='SUCCESS',
            meta={
                'progress': 100,
                'status': 'Distributed analysis completed successfully',
                'result': result
            }
        )

        logger.info(f"[Job {job_id}] Distributed AI analysis completed successfully")
        return result

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()

        logger.error(f"[Job {job_id}] Distributed AI analysis failed: {error_msg}")
        logger.error(f"[Job {job_id}] Traceback: {error_trace}")

        current_task.update_state(
            state='FAILURE',
            meta={
                'progress': 0,
                'status': f'Distributed analysis failed: {error_msg}',
                'error': error_msg,
                'traceback': error_trace
            }
        )

        raise

def should_use_distributed_processing(file_path: str, options: Dict[str, Any] = None) -> bool:
    """
    Determine if a file should be processed using distributed processing

    Args:
        file_path: Path to the file
        options: Processing options

    Returns:
        bool: True if distributed processing should be used
    """
    if options is None:
        options = {}

    # Check if distributed processing is enabled
    if not is_distributed_enabled():
        return False

    # Check if explicitly disabled
    if not options.get('enable_distributed', True):
        return False

    # Check file size
    try:
        file_size_gb = Path(file_path).stat().st_size / (1024**3)
        return file_size_gb > DISTRIBUTED_PROCESSING_THRESHOLD_GB
    except Exception:
        return False

def get_processing_recommendation(file_path: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Get processing recommendation based on file characteristics

    Args:
        file_path: Path to the file
        options: Processing options

    Returns:
        dict: Processing recommendation with method and reasoning
    """
    if options is None:
        options = {}

    try:
        file_path_obj = Path(file_path)
        file_size_gb = file_path_obj.stat().st_size / (1024**3)

        recommendation = {
            'file_size_gb': file_size_gb,
            'distributed_available': is_distributed_enabled(),
            'processing_method': 'standard',
            'reasoning': [],
            'estimated_time_minutes': 1,
            'resource_requirements': 'low'
        }

        if file_size_gb < 0.01:  # < 10MB
            recommendation.update({
                'processing_method': 'standard',
                'reasoning': ['File is very small, standard processing is optimal'],
                'estimated_time_minutes': 1,
                'resource_requirements': 'minimal'
            })
        elif file_size_gb < LARGE_FILE_THRESHOLD_GB:  # < 100MB
            recommendation.update({
                'processing_method': 'standard',
                'reasoning': ['File is small to medium, standard processing is efficient'],
                'estimated_time_minutes': file_size_gb * 2,
                'resource_requirements': 'low'
            })
        elif file_size_gb < HUGE_FILE_THRESHOLD_GB:  # < 1GB
            recommendation.update({
                'processing_method': 'streaming',
                'reasoning': ['File is large, streaming processing recommended for memory efficiency'],
                'estimated_time_minutes': file_size_gb * 5,
                'resource_requirements': 'medium'
            })
        elif file_size_gb < DISTRIBUTED_PROCESSING_THRESHOLD_GB:  # < 2GB
            if is_distributed_enabled():
                recommendation.update({
                    'processing_method': 'streaming_or_distributed',
                    'reasoning': [
                        'File is very large, consider distributed processing for better performance',
                        'Streaming processing is also viable'
                    ],
                    'estimated_time_minutes': file_size_gb * 8,
                    'resource_requirements': 'high'
                })
            else:
                recommendation.update({
                    'processing_method': 'streaming',
                    'reasoning': [
                        'File is very large, streaming processing with memory mapping recommended',
                        'Consider enabling distributed processing for better performance'
                    ],
                    'estimated_time_minutes': file_size_gb * 10,
                    'resource_requirements': 'high'
                })
        else:  # >= 2GB
            if is_distributed_enabled():
                recommendation.update({
                    'processing_method': 'distributed',
                    'reasoning': [
                        'File is extremely large, distributed processing strongly recommended',
                        'Will provide significant performance improvement and fault tolerance'
                    ],
                    'estimated_time_minutes': file_size_gb * 3,  # Faster with distributed
                    'resource_requirements': 'distributed_cluster'
                })
            else:
                recommendation.update({
                    'processing_method': 'streaming',
                    'reasoning': [
                        'File is extremely large, streaming with memory mapping required',
                        'STRONGLY RECOMMEND enabling distributed processing for files this size',
                        'Processing may be slow and resource-intensive'
                    ],
                    'estimated_time_minutes': file_size_gb * 15,
                    'resource_requirements': 'very_high'
                })

        return recommendation

    except Exception as e:
        logger.error(f"Error generating processing recommendation: {e}")
        return {
            'error': str(e),
            'processing_method': 'standard',
            'reasoning': ['Error analyzing file, defaulting to standard processing'],
            'estimated_time_minutes': 5,
            'resource_requirements': 'unknown'
        }

# Export task functions for external use
__all__ = [
    'comprehensive_ai_analysis_task',
    'distributed_ai_analysis_task',
    'data_cleaning_task',
    'MemoryMonitor',
    'StreamingDataProcessor',
    'should_use_distributed_processing',
    'get_processing_recommendation'
] 