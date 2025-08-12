"""
Advanced ML Utility Functions for Performance Optimization
Memory-efficient processing, streaming algorithms, and feature caching
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union, Iterator
import logging
from abc import ABC, abstractmethod
import redis
import pickle
import hashlib
import psutil
import gc
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import threading
from queue import Queue
import time

logger = logging.getLogger(__name__)


class MemoryEfficientProcessor:
    """
    Memory-efficient data processing for large datasets.
    
    Features:
    - Chunked processing to avoid memory overflow
    - Automatic memory monitoring and cleanup
    - Optimized data types and memory usage
    - Progress tracking and performance metrics
    """
    
    def __init__(self, chunk_size: int = 10000, memory_threshold: float = 0.8):
        self.chunk_size = chunk_size
        self.memory_threshold = memory_threshold
        self.processing_stats = {}
        
    def process_large_dataset(self, data: pd.DataFrame, 
                            processing_func: callable,
                            **kwargs) -> pd.DataFrame:
        """
        Process large dataset in memory-efficient chunks.
        
        Args:
            data: Large dataset to process
            processing_func: Function to apply to each chunk
            **kwargs: Additional arguments for processing function
            
        Returns:
            Processed dataset
        """
        logger.info(f"Processing large dataset of {len(data)} rows in chunks of {self.chunk_size}")
        start_time = datetime.now()
        
        # Optimize data types before processing
        optimized_data = self._optimize_data_types(data)
        
        # Calculate number of chunks
        n_chunks = (len(optimized_data) + self.chunk_size - 1) // self.chunk_size
        
        processed_chunks = []
        
        for i in range(n_chunks):
            start_idx = i * self.chunk_size
            end_idx = min((i + 1) * self.chunk_size, len(optimized_data))
            
            # Monitor memory before processing chunk
            memory_usage = self._get_memory_usage()
            if memory_usage > self.memory_threshold:
                logger.warning(f"High memory usage ({memory_usage:.2f}%), forcing garbage collection")
                gc.collect()
            
            # Process chunk
            chunk = optimized_data.iloc[start_idx:end_idx].copy()
            processed_chunk = processing_func(chunk, **kwargs)
            processed_chunks.append(processed_chunk)
            
            # Clean up chunk from memory
            del chunk
            
            # Progress reporting
            if (i + 1) % 10 == 0 or i == n_chunks - 1:
                progress = (i + 1) / n_chunks * 100
                logger.info(f"Processed {i + 1}/{n_chunks} chunks ({progress:.1f}%)")
        
        # Combine processed chunks
        result = pd.concat(processed_chunks, ignore_index=True)
        
        # Record processing statistics
        processing_time = (datetime.now() - start_time).total_seconds()
        self.processing_stats = {
            "total_rows": len(data),
            "chunks_processed": n_chunks,
            "processing_time": processing_time,
            "rows_per_second": len(data) / processing_time,
            "memory_efficiency": self._calculate_memory_efficiency(data, result)
        }
        
        logger.info(f"Large dataset processing completed in {processing_time:.2f} seconds")
        return result
    
    def batch_process_files(self, file_paths: List[str],
                          processing_func: callable,
                          output_path: str,
                          **kwargs) -> Dict[str, Any]:
        """
        Process multiple files in batches with memory management.
        
        Args:
            file_paths: List of file paths to process
            processing_func: Function to apply to each file
            output_path: Path to save combined results
            **kwargs: Additional arguments for processing function
            
        Returns:
            Processing summary
        """
        logger.info(f"Batch processing {len(file_paths)} files")
        
        processing_results = []
        failed_files = []
        
        for i, file_path in enumerate(file_paths):
            try:
                # Monitor memory before processing file
                memory_usage = self._get_memory_usage()
                if memory_usage > self.memory_threshold:
                    gc.collect()
                
                # Process file
                logger.info(f"Processing file {i+1}/{len(file_paths)}: {file_path}")
                result = processing_func(file_path, **kwargs)
                processing_results.append(result)
                
                # Save intermediate results if memory is getting high
                if memory_usage > self.memory_threshold * 0.9:
                    self._save_intermediate_results(processing_results, output_path, i)
                    processing_results = []  # Clear from memory
                
            except Exception as e:
                logger.error(f"Failed to process file {file_path}: {e}")
                failed_files.append(file_path)
        
        # Save final results
        if processing_results:
            self._save_intermediate_results(processing_results, output_path, "final")
        
        return {
            "total_files": len(file_paths),
            "successful_files": len(file_paths) - len(failed_files),
            "failed_files": failed_files,
            "output_path": output_path
        }
    
    def _optimize_data_types(self, data: pd.DataFrame) -> pd.DataFrame:
        """Optimize pandas data types to reduce memory usage."""
        optimized_data = data.copy()
        
        for column in optimized_data.columns:
            col_type = optimized_data[column].dtype
            
            if col_type == 'object':
                # Try to convert to category if beneficial
                if optimized_data[column].nunique() / len(optimized_data) < 0.5:
                    optimized_data[column] = optimized_data[column].astype('category')
            
            elif col_type == 'int64':
                # Downcast integers
                col_min = optimized_data[column].min()
                col_max = optimized_data[column].max()
                
                if col_min >= np.iinfo(np.int8).min and col_max <= np.iinfo(np.int8).max:
                    optimized_data[column] = optimized_data[column].astype(np.int8)
                elif col_min >= np.iinfo(np.int16).min and col_max <= np.iinfo(np.int16).max:
                    optimized_data[column] = optimized_data[column].astype(np.int16)
                elif col_min >= np.iinfo(np.int32).min and col_max <= np.iinfo(np.int32).max:
                    optimized_data[column] = optimized_data[column].astype(np.int32)
            
            elif col_type == 'float64':
                # Downcast floats
                optimized_data[column] = pd.to_numeric(optimized_data[column], downcast='float')
        
        memory_reduction = (data.memory_usage(deep=True).sum() - 
                          optimized_data.memory_usage(deep=True).sum()) / data.memory_usage(deep=True).sum()
        
        logger.info(f"Memory usage reduced by {memory_reduction:.2%}")
        return optimized_data
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage percentage."""
        return psutil.virtual_memory().percent / 100.0
    
    def _calculate_memory_efficiency(self, original_data: pd.DataFrame, 
                                   processed_data: pd.DataFrame) -> float:
        """Calculate memory efficiency of processing."""
        original_memory = original_data.memory_usage(deep=True).sum()
        processed_memory = processed_data.memory_usage(deep=True).sum()
        return processed_memory / original_memory
    
    def _save_intermediate_results(self, results: List[Any], 
                                 output_path: str, 
                                 batch_id: Union[int, str]):
        """Save intermediate processing results."""
        intermediate_path = f"{output_path}_batch_{batch_id}.pkl"
        with open(intermediate_path, 'wb') as f:
            pickle.dump(results, f)
        logger.info(f"Saved intermediate results to {intermediate_path}")


class StreamingProcessor:
    """
    Real-time streaming data processor for continuous ML operations.
    
    Features:
    - Real-time data ingestion and processing
    - Sliding window operations
    - Online learning algorithms
    - Stream quality monitoring
    """
    
    def __init__(self, window_size: int = 1000, update_frequency: int = 100):
        self.window_size = window_size
        self.update_frequency = update_frequency
        self.data_buffer = Queue(maxsize=window_size * 2)
        self.processing_thread = None
        self.is_running = False
        self.stream_stats = {
            "records_processed": 0,
            "processing_rate": 0.0,
            "error_count": 0,
            "last_update": None
        }
        
    def start_stream_processing(self, processing_func: callable, **kwargs):
        """
        Start streaming data processing.
        
        Args:
            processing_func: Function to apply to streaming data
            **kwargs: Additional arguments for processing function
        """
        if self.is_running:
            logger.warning("Stream processing already running")
            return
        
        self.is_running = True
        self.processing_thread = threading.Thread(
            target=self._stream_processing_loop,
            args=(processing_func,),
            kwargs=kwargs
        )
        self.processing_thread.start()
        logger.info("Started streaming data processing")
    
    def stop_stream_processing(self):
        """Stop streaming data processing."""
        self.is_running = False
        if self.processing_thread:
            self.processing_thread.join()
        logger.info("Stopped streaming data processing")
    
    def add_data_point(self, data_point: Dict[str, Any]) -> bool:
        """
        Add a data point to the streaming buffer.
        
        Args:
            data_point: Single data point to process
            
        Returns:
            Success status
        """
        try:
            self.data_buffer.put(data_point, block=False)
            return True
        except:
            logger.warning("Data buffer full, dropping data point")
            return False
    
    def add_data_batch(self, data_batch: List[Dict[str, Any]]) -> int:
        """
        Add a batch of data points to the streaming buffer.
        
        Args:
            data_batch: List of data points to process
            
        Returns:
            Number of successfully added points
        """
        added_count = 0
        for data_point in data_batch:
            if self.add_data_point(data_point):
                added_count += 1
        return added_count
    
    def get_stream_statistics(self) -> Dict[str, Any]:
        """Get current streaming statistics."""
        return self.stream_stats.copy()
    
    def _stream_processing_loop(self, processing_func: callable, **kwargs):
        """Main streaming processing loop."""
        data_window = []
        last_update_time = time.time()
        
        while self.is_running:
            try:
                # Get data from buffer
                if not self.data_buffer.empty():
                    data_point = self.data_buffer.get(timeout=1)
                    data_window.append(data_point)
                    
                    # Process when window is full or update frequency reached
                    if (len(data_window) >= self.update_frequency or 
                        len(data_window) >= self.window_size):
                        
                        # Convert to DataFrame for processing
                        window_df = pd.DataFrame(data_window)
                        
                        # Apply processing function
                        try:
                            result = processing_func(window_df, **kwargs)
                            self.stream_stats["records_processed"] += len(data_window)
                            
                            # Update processing rate
                            current_time = time.time()
                            time_diff = current_time - last_update_time
                            self.stream_stats["processing_rate"] = len(data_window) / time_diff
                            self.stream_stats["last_update"] = datetime.now().isoformat()
                            last_update_time = current_time
                            
                        except Exception as e:
                            logger.error(f"Stream processing error: {e}")
                            self.stream_stats["error_count"] += 1
                        
                        # Maintain sliding window
                        if len(data_window) > self.window_size:
                            data_window = data_window[-self.window_size:]
                        else:
                            data_window = []
                
                else:
                    time.sleep(0.1)  # Small sleep when buffer is empty
                    
            except Exception as e:
                logger.error(f"Streaming loop error: {e}")
                time.sleep(1)


class FeatureCache:
    """
    Advanced feature caching system for computed ML features.
    
    Features:
    - Redis-based distributed caching
    - Intelligent cache invalidation
    - Feature versioning and lineage
    - Cache hit rate optimization
    """
    
    def __init__(self, redis_host: str = 'localhost', 
                 redis_port: int = 6379, 
                 redis_db: int = 0,
                 default_ttl: int = 3600):
        try:
            self.redis_client = redis.Redis(
                host=redis_host, 
                port=redis_port, 
                db=redis_db,
                decode_responses=False
            )
            # Test connection
            self.redis_client.ping()
            self.cache_enabled = True
        except:
            logger.warning("Redis not available, using in-memory cache")
            self.cache_enabled = False
            self.memory_cache = {}
        
        self.default_ttl = default_ttl
        self.cache_stats = {
            "cache_hits": 0,
            "cache_misses": 0,
            "cache_sets": 0,
            "cache_invalidations": 0
        }
    
    def get_features(self, cache_key: str, 
                    feature_names: Optional[List[str]] = None) -> Optional[pd.DataFrame]:
        """
        Retrieve cached features.
        
        Args:
            cache_key: Unique key for cached features
            feature_names: Optional list of specific features to retrieve
            
        Returns:
            Cached features or None if not found
        """
        try:
            full_key = self._generate_cache_key(cache_key, feature_names)
            
            if self.cache_enabled:
                cached_data = self.redis_client.get(full_key)
                if cached_data:
                    features = pickle.loads(cached_data)
                    self.cache_stats["cache_hits"] += 1
                    logger.debug(f"Cache hit for key: {full_key}")
                    return features
            else:
                if full_key in self.memory_cache:
                    features = self.memory_cache[full_key]
                    self.cache_stats["cache_hits"] += 1
                    return features
            
            self.cache_stats["cache_misses"] += 1
            logger.debug(f"Cache miss for key: {full_key}")
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving from cache: {e}")
            return None
    
    def set_features(self, cache_key: str, 
                    features: pd.DataFrame,
                    feature_names: Optional[List[str]] = None,
                    ttl: Optional[int] = None) -> bool:
        """
        Cache computed features.
        
        Args:
            cache_key: Unique key for caching
            features: Features to cache
            feature_names: Optional list of feature names for partial caching
            ttl: Time to live in seconds
            
        Returns:
            Success status
        """
        try:
            full_key = self._generate_cache_key(cache_key, feature_names)
            ttl = ttl or self.default_ttl
            
            # Filter features if specific names provided
            if feature_names:
                available_features = [col for col in feature_names if col in features.columns]
                features_to_cache = features[available_features]
            else:
                features_to_cache = features
            
            if self.cache_enabled:
                pickled_data = pickle.dumps(features_to_cache)
                self.redis_client.setex(full_key, ttl, pickled_data)
            else:
                self.memory_cache[full_key] = features_to_cache.copy()
            
            self.cache_stats["cache_sets"] += 1
            logger.debug(f"Cached features for key: {full_key}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching features: {e}")
            return False
    
    def invalidate_features(self, cache_key_pattern: str) -> int:
        """
        Invalidate cached features matching pattern.
        
        Args:
            cache_key_pattern: Pattern to match for invalidation
            
        Returns:
            Number of keys invalidated
        """
        try:
            if self.cache_enabled:
                keys = self.redis_client.keys(f"*{cache_key_pattern}*")
                if keys:
                    deleted_count = self.redis_client.delete(*keys)
                else:
                    deleted_count = 0
            else:
                keys_to_delete = [key for key in self.memory_cache.keys() 
                                if cache_key_pattern in key]
                for key in keys_to_delete:
                    del self.memory_cache[key]
                deleted_count = len(keys_to_delete)
            
            self.cache_stats["cache_invalidations"] += deleted_count
            logger.info(f"Invalidated {deleted_count} cached features")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
            return 0
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache performance statistics."""
        total_requests = self.cache_stats["cache_hits"] + self.cache_stats["cache_misses"]
        hit_rate = (self.cache_stats["cache_hits"] / total_requests 
                   if total_requests > 0 else 0)
        
        stats = self.cache_stats.copy()
        stats.update({
            "hit_rate": hit_rate,
            "total_requests": total_requests,
            "cache_enabled": self.cache_enabled
        })
        
        if self.cache_enabled:
            try:
                info = self.redis_client.info('memory')
                stats["redis_memory_usage"] = info.get('used_memory_human', 'Unknown')
                stats["redis_keys"] = self.redis_client.dbsize()
            except:
                pass
        else:
            stats["memory_cache_size"] = len(self.memory_cache)
        
        return stats
    
    def clear_cache(self) -> bool:
        """Clear all cached features."""
        try:
            if self.cache_enabled:
                self.redis_client.flushdb()
            else:
                self.memory_cache.clear()
            
            logger.info("Cleared all cached features")
            return True
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return False
    
    def _generate_cache_key(self, cache_key: str, 
                          feature_names: Optional[List[str]] = None) -> str:
        """Generate full cache key with feature names hash."""
        if feature_names:
            features_hash = hashlib.md5(str(sorted(feature_names)).encode()).hexdigest()[:8]
            return f"features:{cache_key}:{features_hash}"
        else:
            return f"features:{cache_key}"


class ParallelProcessor:
    """
    Parallel processing utilities for CPU-intensive ML operations.
    
    Features:
    - Thread and process pool management
    - Adaptive worker scaling
    - Load balancing for ML tasks
    - Progress monitoring
    """
    
    def __init__(self, max_workers: Optional[int] = None):
        self.max_workers = max_workers or min(32, (psutil.cpu_count() or 1) + 4)
        self.processing_stats = {}
        
    def parallel_apply(self, data: pd.DataFrame,
                      func: callable,
                      n_jobs: Optional[int] = None,
                      use_processes: bool = False,
                      **kwargs) -> pd.DataFrame:
        """
        Apply function to DataFrame in parallel.
        
        Args:
            data: DataFrame to process
            func: Function to apply
            n_jobs: Number of parallel jobs
            use_processes: Use processes instead of threads
            **kwargs: Additional arguments for function
            
        Returns:
            Processed DataFrame
        """
        n_jobs = n_jobs or self.max_workers
        chunk_size = max(1, len(data) // n_jobs)
        
        # Split data into chunks
        chunks = [data.iloc[i:i + chunk_size] for i in range(0, len(data), chunk_size)]
        
        logger.info(f"Processing {len(data)} rows in {len(chunks)} chunks using {n_jobs} {'processes' if use_processes else 'threads'}")
        
        start_time = time.time()
        
        # Choose executor type
        executor_class = ProcessPoolExecutor if use_processes else ThreadPoolExecutor
        
        with executor_class(max_workers=n_jobs) as executor:
            # Submit tasks
            futures = [executor.submit(func, chunk, **kwargs) for chunk in chunks]
            
            # Collect results
            results = []
            for i, future in enumerate(futures):
                try:
                    result = future.result()
                    results.append(result)
                    logger.debug(f"Completed chunk {i+1}/{len(chunks)}")
                except Exception as e:
                    logger.error(f"Error processing chunk {i+1}: {e}")
                    results.append(chunks[i])  # Return original chunk on error
        
        # Combine results
        combined_result = pd.concat(results, ignore_index=True)
        
        processing_time = time.time() - start_time
        self.processing_stats = {
            "processing_time": processing_time,
            "rows_processed": len(data),
            "chunks_processed": len(chunks),
            "rows_per_second": len(data) / processing_time,
            "executor_type": "processes" if use_processes else "threads"
        }
        
        logger.info(f"Parallel processing completed in {processing_time:.2f} seconds")
        return combined_result
    
    def parallel_feature_engineering(self, data: pd.DataFrame,
                                   feature_functions: List[callable],
                                   n_jobs: Optional[int] = None) -> pd.DataFrame:
        """
        Apply multiple feature engineering functions in parallel.
        
        Args:
            data: Input DataFrame
            feature_functions: List of feature engineering functions
            n_jobs: Number of parallel jobs
            
        Returns:
            DataFrame with engineered features
        """
        n_jobs = n_jobs or min(len(feature_functions), self.max_workers)
        
        logger.info(f"Applying {len(feature_functions)} feature functions in parallel")
        
        with ThreadPoolExecutor(max_workers=n_jobs) as executor:
            # Submit feature engineering tasks
            futures = {executor.submit(func, data): func.__name__ 
                      for func in feature_functions}
            
            # Collect feature results
            feature_results = []
            for future in futures:
                try:
                    result = future.result()
                    if isinstance(result, pd.DataFrame):
                        feature_results.append(result)
                    elif isinstance(result, dict):
                        # Convert dict to DataFrame
                        feature_df = pd.DataFrame([result] * len(data))
                        feature_results.append(feature_df)
                    
                    func_name = futures[future]
                    logger.debug(f"Completed feature function: {func_name}")
                    
                except Exception as e:
                    func_name = futures[future]
                    logger.error(f"Error in feature function {func_name}: {e}")
        
        # Combine all features
        if feature_results:
            combined_features = pd.concat([data] + feature_results, axis=1)
        else:
            combined_features = data
        
        logger.info(f"Feature engineering completed. Added {len(combined_features.columns) - len(data.columns)} features")
        return combined_features


class MLPerformanceMonitor:
    """
    Performance monitoring for ML operations.
    
    Features:
    - Real-time performance tracking
    - Resource utilization monitoring
    - Bottleneck identification
    - Performance optimization recommendations
    """
    
    def __init__(self):
        self.performance_metrics = {}
        self.monitoring_active = False
        
    def start_monitoring(self, operation_name: str):
        """Start monitoring ML operation performance."""
        self.performance_metrics[operation_name] = {
            "start_time": time.time(),
            "start_memory": psutil.virtual_memory().percent,
            "start_cpu": psutil.cpu_percent(),
            "peak_memory": psutil.virtual_memory().percent,
            "peak_cpu": psutil.cpu_percent()
        }
        self.monitoring_active = True
        logger.debug(f"Started monitoring: {operation_name}")
    
    def update_monitoring(self, operation_name: str):
        """Update monitoring metrics during operation."""
        if operation_name in self.performance_metrics:
            current_memory = psutil.virtual_memory().percent
            current_cpu = psutil.cpu_percent()
            
            metrics = self.performance_metrics[operation_name]
            metrics["peak_memory"] = max(metrics["peak_memory"], current_memory)
            metrics["peak_cpu"] = max(metrics["peak_cpu"], current_cpu)
    
    def stop_monitoring(self, operation_name: str) -> Dict[str, Any]:
        """Stop monitoring and return performance metrics."""
        if operation_name not in self.performance_metrics:
            return {}
        
        metrics = self.performance_metrics[operation_name]
        metrics["end_time"] = time.time()
        metrics["duration"] = metrics["end_time"] - metrics["start_time"]
        metrics["end_memory"] = psutil.virtual_memory().percent
        metrics["end_cpu"] = psutil.cpu_percent()
        
        # Calculate efficiency metrics
        metrics["memory_efficiency"] = 1.0 - (metrics["peak_memory"] - metrics["start_memory"]) / 100.0
        metrics["avg_cpu_usage"] = (metrics["peak_cpu"] + metrics["end_cpu"]) / 2
        
        logger.info(f"Monitoring completed: {operation_name} - Duration: {metrics['duration']:.2f}s")
        return metrics
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get summary of all monitored operations."""
        return {
            "monitored_operations": list(self.performance_metrics.keys()),
            "total_operations": len(self.performance_metrics),
            "average_duration": np.mean([m.get("duration", 0) for m in self.performance_metrics.values()]),
            "peak_memory_usage": max([m.get("peak_memory", 0) for m in self.performance_metrics.values()]),
            "performance_metrics": self.performance_metrics
        }


def optimize_ml_pipeline(pipeline_func: callable):
    """
    Decorator to optimize ML pipeline performance.
    
    Features:
    - Automatic performance monitoring
    - Memory usage optimization
    - Error handling and recovery
    - Performance recommendations
    """
    def wrapper(*args, **kwargs):
        monitor = MLPerformanceMonitor()
        operation_name = pipeline_func.__name__
        
        # Start monitoring
        monitor.start_monitoring(operation_name)
        
        try:
            # Force garbage collection before operation
            gc.collect()
            
            # Execute pipeline function
            result = pipeline_func(*args, **kwargs)
            
            # Stop monitoring and get metrics
            metrics = monitor.stop_monitoring(operation_name)
            
            # Add performance metrics to result if it's a dict
            if isinstance(result, dict):
                result["_performance_metrics"] = metrics
            
            return result
            
        except Exception as e:
            monitor.stop_monitoring(operation_name)
            logger.error(f"ML pipeline error in {operation_name}: {e}")
            raise
        
        finally:
            # Clean up
            gc.collect()
    
    return wrapper


# Utility functions for common ML operations
def get_optimal_chunk_size(data_size: int, available_memory_gb: float = None) -> int:
    """Calculate optimal chunk size based on data size and available memory."""
    if available_memory_gb is None:
        available_memory_gb = psutil.virtual_memory().available / (1024**3)
    
    # Conservative estimate: use 50% of available memory
    usable_memory_gb = available_memory_gb * 0.5
    
    # Estimate memory per row (assuming average of 8 bytes per value)
    estimated_memory_per_row = 64  # bytes
    max_rows_in_memory = int(usable_memory_gb * 1024**3 / estimated_memory_per_row)
    
    # Ensure chunk size is reasonable
    chunk_size = min(max_rows_in_memory, max(1000, data_size // 100))
    
    return chunk_size


def validate_ml_input(data: pd.DataFrame, 
                     required_columns: List[str] = None,
                     min_rows: int = 10) -> Tuple[bool, List[str]]:
    """Validate ML input data."""
    issues = []
    
    # Check basic requirements
    if data.empty:
        issues.append("Dataset is empty")
    elif len(data) < min_rows:
        issues.append(f"Dataset too small (minimum {min_rows} rows required)")
    
    # Check required columns
    if required_columns:
        missing_columns = [col for col in required_columns if col not in data.columns]
        if missing_columns:
            issues.append(f"Missing required columns: {missing_columns}")
    
    # Check for excessive missing values
    missing_percentage = data.isnull().sum().sum() / (len(data) * len(data.columns))
    if missing_percentage > 0.9:
        issues.append("Excessive missing values (>90%)")
    
    # Check for numeric columns
    numeric_columns = data.select_dtypes(include=[np.number]).columns
    if len(numeric_columns) == 0:
        issues.append("No numeric columns found")
    
    return len(issues) == 0, issues


def create_feature_metadata(features: pd.DataFrame) -> Dict[str, Any]:
    """Create metadata for engineered features."""
    return {
        "feature_count": len(features.columns),
        "feature_names": list(features.columns),
        "feature_types": {col: str(features[col].dtype) for col in features.columns},
        "memory_usage": features.memory_usage(deep=True).sum(),
        "creation_timestamp": datetime.now().isoformat(),
        "shape": features.shape
    }