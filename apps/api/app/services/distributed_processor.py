"""
Distributed Data Processing Service for Schlep-engine
====================================================

This module implements distributed data processing capabilities using Apache Spark and Dask
for handling extremely large datasets across multiple worker nodes.

Key Features:
- Apache Spark integration for distributed processing
- Dask integration for parallel computing
- Dynamic cluster scaling and resource management
- Job distribution and monitoring
- Fault tolerance and recovery mechanisms
- Resource optimization and auto-scaling
"""

import asyncio
import logging
import json
import time
from typing import Dict, List, Any, Optional, Union, Callable
from dataclasses import dataclass, asdict
from pathlib import Path
import numpy as np
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
import psutil
import threading
import uuid
from datetime import datetime, timedelta
from queue import Queue, PriorityQueue
import hashlib
from contextlib import asynccontextmanager

# Import our configuration system
from app.core.distributed_config import (
    distributed_config_manager,
    get_distributed_config,
    get_cluster_config,
    get_performance_config,
    is_distributed_enabled
)

try:
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import col, count, sum as spark_sum, avg, max as spark_max, min as spark_min
    from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType
    SPARK_AVAILABLE = True
except ImportError:
    SPARK_AVAILABLE = False
    logging.warning("PySpark not available. Install with: pip install pyspark")

try:
    import dask
    import dask.dataframe as dd
    from dask.distributed import Client, as_completed as dask_as_completed
    from dask import delayed
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False
    logging.warning("Dask not available. Install with: pip install dask distributed")

logger = logging.getLogger(__name__)


@dataclass
class ClusterConfig:
    """Configuration for distributed cluster"""
    cluster_type: str = 'dask'  # 'dask' or 'spark'
    num_workers: int = 4
    worker_memory: str = '4GB'
    worker_cores: int = 2
    scheduler_address: Optional[str] = None
    spark_master: str = 'local[*]'
    auto_scale: bool = True
    max_workers: int = 10
    min_workers: int = 2
    scale_up_threshold: float = 80.0  # CPU percentage
    scale_down_threshold: float = 30.0
    enable_monitoring: bool = True


@dataclass
class ProcessingJob:
    """Represents a distributed processing job"""
    job_id: str
    job_type: str
    input_path: str
    output_path: str
    parameters: Dict[str, Any]
    priority: int = 1
    max_retries: int = 3
    timeout: int = 3600  # seconds
    created_at: float = None
    user_id: Optional[str] = None
    callback_url: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)
    resource_requirements: Dict[str, Any] = field(default_factory=dict)
    estimated_duration: Optional[int] = None
    tags: List[str] = field(default_factory=list)

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()
        if not self.job_id:
            self.job_id = str(uuid.uuid4())

    @property
    def age_seconds(self) -> float:
        """Get job age in seconds"""
        return time.time() - self.created_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'job_id': self.job_id,
            'job_type': self.job_type,
            'input_path': self.input_path,
            'output_path': self.output_path,
            'parameters': self.parameters,
            'priority': self.priority,
            'max_retries': self.max_retries,
            'timeout': self.timeout,
            'created_at': self.created_at,
            'user_id': self.user_id,
            'callback_url': self.callback_url,
            'dependencies': self.dependencies,
            'resource_requirements': self.resource_requirements,
            'estimated_duration': self.estimated_duration,
            'tags': self.tags,
            'age_seconds': self.age_seconds
        }


@dataclass
class JobResult:
    """Result of a distributed processing job"""
    job_id: str
    status: str  # 'completed', 'failed', 'cancelled'
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    worker_id: Optional[str] = None
    resource_usage: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> Optional[float]:
        """Get job duration in seconds"""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None

class ResourceMonitor:
    """Monitor cluster resources and performance"""

    def __init__(self):
        self.metrics = {}
        self.monitoring_active = False
        self.alert_callbacks = []
        self.history = []
        self.config = get_distributed_config().monitoring

    def start_monitoring(self):
        """Start resource monitoring"""
        self.monitoring_active = True
        threading.Thread(target=self._monitor_loop, daemon=True).start()

    def stop_monitoring(self):
        """Stop resource monitoring"""
        self.monitoring_active = False

    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # Collect system metrics
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')

                # Network I/O
                net_io = psutil.net_io_counters()

                current_metrics = {
                    'timestamp': time.time(),
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_available_gb': memory.available / (1024**3),
                    'memory_used_gb': memory.used / (1024**3),
                    'disk_percent': disk.percent,
                    'disk_free_gb': disk.free / (1024**3),
                    'network_bytes_sent': net_io.bytes_sent,
                    'network_bytes_recv': net_io.bytes_recv
                }

                self.metrics.update(current_metrics)

                # Add to history with retention
                self.history.append(current_metrics)
                if len(self.history) > self.config.metrics_retention_hours * 720:  # 5-second intervals
                    self.history.pop(0)

                # Check alerts
                self._check_alerts(current_metrics)

                time.sleep(5)  # Update every 5 seconds

            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                time.sleep(10)

    def _check_alerts(self, metrics: Dict[str, Any]):
        """Check if any alert thresholds are exceeded"""
        if not self.config.enable_alerts:
            return

        thresholds = self.config.alert_thresholds

        for metric, threshold in thresholds.items():
            if metric in metrics and metrics[metric] > threshold:
                alert = {
                    'timestamp': time.time(),
                    'metric': metric,
                    'value': metrics[metric],
                    'threshold': threshold,
                    'severity': 'high' if metrics[metric] > threshold * 1.1 else 'medium'
                }

                for callback in self.alert_callbacks:
                    try:
                        callback(alert)
                    except Exception as e:
                        logger.error(f"Alert callback failed: {e}")

    def add_alert_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Add alert callback function"""
        self.alert_callbacks.append(callback)

    def get_metrics_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get metrics history for specified hours"""
        cutoff = time.time() - (hours * 3600)
        return [m for m in self.history if m['timestamp'] > cutoff]

    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current resource metrics"""
        return self.metrics.copy()


class SparkDistributedProcessor:
    """Apache Spark distributed processor"""

    def __init__(self, config: ClusterConfig):
        if not SPARK_AVAILABLE:
            raise ImportError("PySpark is required for Spark processing")

        self.config = config
        self.spark = None
        self.jobs = {}

    def initialize_cluster(self) -> bool:
        """Initialize Spark cluster"""
        try:
            # Create Spark session
            self.spark = SparkSession.builder \
                .appName("Schlep-Engine-Distributed-Processing") \
                .master(self.config.spark_master) \
                .config("spark.executor.memory", self.config.worker_memory) \
                .config("spark.executor.cores", str(self.config.worker_cores)) \
                .config("spark.sql.adaptive.enabled", "true") \
                .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
                .getOrCreate()

            # Set log level
            self.spark.sparkContext.setLogLevel("WARN")

            logger.info(f"Spark cluster initialized with master: {self.config.spark_master}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Spark cluster: {e}")
            return False

    def process_large_file(self, job: ProcessingJob) -> Dict[str, Any]:
        """Process large file using Spark"""
        if not self.spark:
            raise RuntimeError("Spark cluster not initialized")

        try:
            # Read file into Spark DataFrame
            file_path = job.input_path
            file_extension = Path(file_path).suffix.lower()

            if file_extension == '.csv':
                df = self.spark.read.csv(file_path, header=True, inferSchema=True)
            elif file_extension == '.json':
                df = self.spark.read.json(file_path)
            elif file_extension == '.parquet':
                df = self.spark.read.parquet(file_path)
            else:
                raise ValueError(f"Unsupported file format: {file_extension}")

            # Perform analysis based on job type
            if job.job_type == 'data_analysis':
                result = self._spark_data_analysis(df, job.parameters)
            elif job.job_type == 'data_cleaning':
                result = self._spark_data_cleaning(df, job.parameters)
            elif job.job_type == 'aggregation':
                result = self._spark_aggregation(df, job.parameters)
            else:
                raise ValueError(f"Unknown job type: {job.job_type}")

            # Save results if output path specified
            if job.output_path:
                result_df = result.get('dataframe')
                if result_df:
                    result_df.write.mode('overwrite').parquet(job.output_path)

            return {
                'job_id': job.job_id,
                'status': 'completed',
                'result': result,
                'rows_processed': df.count(),
                'processing_time': time.time() - job.created_at
            }

        except Exception as e:
            logger.error(f"Spark processing failed for job {job.job_id}: {e}")
            return {
                'job_id': job.job_id,
                'status': 'failed',
                'error': str(e),
                'processing_time': time.time() - job.created_at
            }

    def _spark_data_analysis(self, df, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform data analysis using Spark"""
        # Basic statistics
        stats = {}
        numeric_columns = []

        for column_name, data_type in df.dtypes:
            if data_type in ['int', 'bigint', 'float', 'double']:
                numeric_columns.append(column_name)

        # Calculate basic statistics
        if numeric_columns:
            stats_df = df.select(numeric_columns).describe()
            stats = {row['summary']: dict(zip(numeric_columns, row[1:]))
                    for row in stats_df.collect()}

        # Data quality metrics
        total_rows = df.count()
        null_counts = {}

        for col_name in df.columns:
            null_count = df.filter(col(col_name).isNull()).count()
            null_counts[col_name] = {
                'null_count': null_count,
                'null_percentage': (null_count / total_rows) * 100 if total_rows > 0 else 0
            }

        return {
            'basic_statistics': stats,
            'data_quality': {
                'total_rows': total_rows,
                'total_columns': len(df.columns),
                'null_analysis': null_counts
            },
            'schema': df.schema.json()
        }

    def _spark_data_cleaning(self, df, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform data cleaning using Spark"""
        cleaned_df = df
        operations_applied = []

        # Remove duplicates
        if parameters.get('remove_duplicates', True):
            initial_count = cleaned_df.count()
            cleaned_df = cleaned_df.dropDuplicates()
            final_count = cleaned_df.count()
            operations_applied.append({
                'operation': 'remove_duplicates',
                'rows_removed': initial_count - final_count
            })

        # Handle missing values
        if parameters.get('handle_missing_values', True):
            fill_strategy = parameters.get('fill_strategy', 'drop')

            if fill_strategy == 'drop':
                initial_count = cleaned_df.count()
                cleaned_df = cleaned_df.dropna()
                final_count = cleaned_df.count()
                operations_applied.append({
                    'operation': 'drop_null_rows',
                    'rows_removed': initial_count - final_count
                })
            elif fill_strategy == 'fill_mean':
                # Fill numeric columns with mean
                for col_name, data_type in cleaned_df.dtypes:
                    if data_type in ['int', 'bigint', 'float', 'double']:
                        mean_val = cleaned_df.select(avg(col(col_name))).collect()[0][0]
                        if mean_val is not None:
                            cleaned_df = cleaned_df.fillna({col_name: mean_val})

                operations_applied.append({
                    'operation': 'fill_numeric_with_mean'
                })

        return {
            'dataframe': cleaned_df,
            'operations_applied': operations_applied,
            'final_row_count': cleaned_df.count()
        }

    def _spark_aggregation(self, df, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform data aggregation using Spark"""
        group_by_cols = parameters.get('group_by', [])
        agg_functions = parameters.get('aggregations', {})

        if not group_by_cols:
            # Global aggregations
            result_df = df.agg(agg_functions)
        else:
            # Grouped aggregations
            result_df = df.groupBy(group_by_cols).agg(agg_functions)

        return {
            'dataframe': result_df,
            'aggregation_count': result_df.count()
        }

    def shutdown(self):
        """Shutdown Spark cluster"""
        if self.spark:
            self.spark.stop()
            self.spark = None
            logger.info("Spark cluster shutdown")


class DaskDistributedProcessor:
    """Dask distributed processor"""

    def __init__(self, config: ClusterConfig):
        if not DASK_AVAILABLE:
            raise ImportError("Dask is required for Dask processing")

        self.config = config
        self.client = None
        self.jobs = {}

    def initialize_cluster(self) -> bool:
        """Initialize Dask cluster"""
        try:
            if self.config.scheduler_address:
                # Connect to existing cluster
                self.client = Client(self.config.scheduler_address)
            else:
                # Create local cluster
                from dask.distributed import LocalCluster

                cluster = LocalCluster(
                    n_workers=self.config.num_workers,
                    threads_per_worker=self.config.worker_cores,
                    memory_limit=self.config.worker_memory
                )
                self.client = Client(cluster)

            logger.info(f"Dask cluster initialized: {self.client}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Dask cluster: {e}")
            return False

    def process_large_file(self, job: ProcessingJob) -> Dict[str, Any]:
        """Process large file using Dask"""
        if not self.client:
            raise RuntimeError("Dask cluster not initialized")

        try:
            # Read file into Dask DataFrame
            file_path = job.input_path
            file_extension = Path(file_path).suffix.lower()

            if file_extension == '.csv':
                df = dd.read_csv(file_path)
            elif file_extension == '.json':
                df = dd.read_json(file_path)
            elif file_extension == '.parquet':
                df = dd.read_parquet(file_path)
            else:
                raise ValueError(f"Unsupported file format: {file_extension}")

            # Perform analysis based on job type
            if job.job_type == 'data_analysis':
                result = self._dask_data_analysis(df, job.parameters)
            elif job.job_type == 'data_cleaning':
                result = self._dask_data_cleaning(df, job.parameters)
            elif job.job_type == 'aggregation':
                result = self._dask_aggregation(df, job.parameters)
            else:
                raise ValueError(f"Unknown job type: {job.job_type}")

            # Save results if output path specified
            if job.output_path:
                result_df = result.get('dataframe')
                if result_df is not None:
                    result_df.to_parquet(job.output_path)

            return {
                'job_id': job.job_id,
                'status': 'completed',
                'result': result,
                'rows_processed': len(df),
                'processing_time': time.time() - job.created_at
            }

        except Exception as e:
            logger.error(f"Dask processing failed for job {job.job_id}: {e}")
            return {
                'job_id': job.job_id,
                'status': 'failed',
                'error': str(e),
                'processing_time': time.time() - job.created_at
            }

    def _dask_data_analysis(self, df, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform data analysis using Dask"""
        # Basic statistics
        stats = {}
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()

        if numeric_columns:
            stats = df[numeric_columns].describe().compute().to_dict()

        # Data quality metrics
        total_rows = len(df)
        null_counts = {}

        for col_name in df.columns:
            null_count = df[col_name].isnull().sum().compute()
            null_counts[col_name] = {
                'null_count': null_count,
                'null_percentage': (null_count / total_rows) * 100 if total_rows > 0 else 0
            }

        return {
            'basic_statistics': stats,
            'data_quality': {
                'total_rows': total_rows,
                'total_columns': len(df.columns),
                'null_analysis': null_counts
            },
            'dtypes': df.dtypes.to_dict()
        }

    def _dask_data_cleaning(self, df, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform data cleaning using Dask"""
        cleaned_df = df.copy()
        operations_applied = []

        # Remove duplicates
        if parameters.get('remove_duplicates', True):
            initial_count = len(cleaned_df)
            cleaned_df = cleaned_df.drop_duplicates()
            final_count = len(cleaned_df)
            operations_applied.append({
                'operation': 'remove_duplicates',
                'rows_removed': initial_count - final_count
            })

        # Handle missing values
        if parameters.get('handle_missing_values', True):
            fill_strategy = parameters.get('fill_strategy', 'drop')

            if fill_strategy == 'drop':
                initial_count = len(cleaned_df)
                cleaned_df = cleaned_df.dropna()
                final_count = len(cleaned_df)
                operations_applied.append({
                    'operation': 'drop_null_rows',
                    'rows_removed': initial_count - final_count
                })
            elif fill_strategy == 'fill_mean':
                # Fill numeric columns with mean
                numeric_columns = cleaned_df.select_dtypes(include=[np.number]).columns
                for col_name in numeric_columns:
                    mean_val = cleaned_df[col_name].mean().compute()
                    cleaned_df[col_name] = cleaned_df[col_name].fillna(mean_val)

                operations_applied.append({
                    'operation': 'fill_numeric_with_mean'
                })

        return {
            'dataframe': cleaned_df,
            'operations_applied': operations_applied,
            'final_row_count': len(cleaned_df)
        }

    def _dask_aggregation(self, df, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform data aggregation using Dask"""
        group_by_cols = parameters.get('group_by', [])
        agg_functions = parameters.get('aggregations', {})

        if not group_by_cols:
            # Global aggregations
            result_df = df.agg(agg_functions)
        else:
            # Grouped aggregations
            result_df = df.groupby(group_by_cols).agg(agg_functions)

        return {
            'dataframe': result_df,
            'aggregation_count': len(result_df)
        }

    def shutdown(self):
        """Shutdown Dask cluster"""
        if self.client:
            self.client.close()
            self.client = None
            logger.info("Dask cluster shutdown")


class AutoScaler:
    """Automatic cluster scaling based on resource usage"""

    def __init__(self, config: ClusterConfig, processor):
        self.config = config
        self.processor = processor
        self.monitor = ResourceMonitor()
        self.scaling_active = False

    def start_auto_scaling(self):
        """Start auto-scaling monitoring"""
        if not self.config.auto_scale:
            return

        self.scaling_active = True
        self.monitor.start_monitoring()
        threading.Thread(target=self._scaling_loop, daemon=True).start()
        logger.info("Auto-scaling started")

    def stop_auto_scaling(self):
        """Stop auto-scaling"""
        self.scaling_active = False
        self.monitor.stop_monitoring()
        logger.info("Auto-scaling stopped")

    def _scaling_loop(self):
        """Main auto-scaling loop"""
        while self.scaling_active:
            try:
                metrics = self.monitor.get_current_metrics()
                cpu_percent = metrics.get('cpu_percent', 0)

                # Scale up if CPU usage is high
                if cpu_percent > self.config.scale_up_threshold:
                    self._scale_up()
                # Scale down if CPU usage is low
                elif cpu_percent < self.config.scale_down_threshold:
                    self._scale_down()

                time.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Auto-scaling error: {e}")
                time.sleep(60)

    def _scale_up(self):
        """Scale up the cluster"""
        try:
            if isinstance(self.processor, DaskDistributedProcessor) and self.processor.client:
                current_workers = len(self.processor.client.scheduler_info()['workers'])
                if current_workers < self.config.max_workers:
                    # For local cluster, this would need implementation
                    # For external cluster, use cluster.scale()
                    logger.info(f"Would scale up from {current_workers} workers")

        except Exception as e:
            logger.error(f"Scale up failed: {e}")

    def _scale_down(self):
        """Scale down the cluster"""
        try:
            if isinstance(self.processor, DaskDistributedProcessor) and self.processor.client:
                current_workers = len(self.processor.client.scheduler_info()['workers'])
                if current_workers > self.config.min_workers:
                    # For local cluster, this would need implementation
                    # For external cluster, use cluster.scale()
                    logger.info(f"Would scale down from {current_workers} workers")

        except Exception as e:
            logger.error(f"Scale down failed: {e}")


class JobQueue:
    """Advanced job queue with priority and dependency management"""

    def __init__(self):
        self.queue = PriorityQueue()
        self.jobs_by_id = {}
        self.dependency_graph = {}
        self.completed_jobs = set()
        self.failed_jobs = set()
        self.lock = threading.Lock()

    def add_job(self, job: ProcessingJob):
        """Add job to queue with priority"""
        with self.lock:
            priority = (-job.priority, job.created_at)  # Higher priority first, then FIFO
            self.queue.put((priority, job))
            self.jobs_by_id[job.job_id] = job

            # Handle dependencies
            if job.dependencies:
                self.dependency_graph[job.job_id] = set(job.dependencies)

    def get_ready_job(self) -> Optional[ProcessingJob]:
        """Get next ready job (dependencies satisfied)"""
        with self.lock:
            temp_jobs = []

            while not self.queue.empty():
                priority, job = self.queue.get()

                # Check if dependencies are satisfied
                if self._dependencies_satisfied(job):
                    # Put back remaining jobs
                    for p, j in temp_jobs:
                        self.queue.put((p, j))
                    return job
                else:
                    temp_jobs.append((priority, job))

            # Put back all jobs if none are ready
            for p, j in temp_jobs:
                self.queue.put((p, j))

            return None

    def _dependencies_satisfied(self, job: ProcessingJob) -> bool:
        """Check if job dependencies are satisfied"""
        if not job.dependencies:
            return True

        job_deps = self.dependency_graph.get(job.job_id, set())
        return job_deps.issubset(self.completed_jobs)

    def mark_completed(self, job_id: str):
        """Mark job as completed"""
        with self.lock:
            self.completed_jobs.add(job_id)
            if job_id in self.dependency_graph:
                del self.dependency_graph[job_id]

    def mark_failed(self, job_id: str):
        """Mark job as failed"""
        with self.lock:
            self.failed_jobs.add(job_id)
            if job_id in self.dependency_graph:
                del self.dependency_graph[job_id]

    def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        with self.lock:
            return {
                'queued_jobs': self.queue.qsize(),
                'total_jobs': len(self.jobs_by_id),
                'completed_jobs': len(self.completed_jobs),
                'failed_jobs': len(self.failed_jobs),
                'jobs_with_dependencies': len(self.dependency_graph)
            }

class FaultTolerantJobRunner:
    """Fault-tolerant job execution with retry logic"""

    def __init__(self, processor, max_retries: int = 3):
        self.processor = processor
        self.max_retries = max_retries
        self.retry_delays = [1, 5, 15]  # Progressive backoff in seconds

    async def run_job_with_retry(self, job: ProcessingJob) -> JobResult:
        """Run job with retry logic and fault tolerance"""
        start_time = time.time()
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                logger.info(f"Executing job {job.job_id}, attempt {attempt + 1}")

                # Execute the job
                result = await self._execute_job(job)

                if result.get('status') == 'completed':
                    return JobResult(
                        job_id=job.job_id,
                        status='completed',
                        result=result.get('result'),
                        start_time=start_time,
                        end_time=time.time()
                    )
                else:
                    raise Exception(f"Job execution failed: {result.get('error', 'Unknown error')}")

            except Exception as e:
                last_error = e
                logger.warning(f"Job {job.job_id} failed on attempt {attempt + 1}: {e}")

                if attempt < self.max_retries:
                    # Wait before retry with exponential backoff
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    logger.info(f"Retrying job {job.job_id} in {delay} seconds")
                    await asyncio.sleep(delay)
                else:
                    # All retries exhausted
                    return JobResult(
                        job_id=job.job_id,
                        status='failed',
                        error=str(last_error),
                        traceback=traceback.format_exc(),
                        start_time=start_time,
                        end_time=time.time()
                    )

    async def _execute_job(self, job: ProcessingJob) -> Dict[str, Any]:
        """Execute a single job"""
        if isinstance(self.processor, SparkDistributedProcessor):
            return self.processor.process_large_file(job)
        elif isinstance(self.processor, DaskDistributedProcessor):
            return self.processor.process_large_file(job)
        else:
            raise ValueError(f"Unknown processor type: {type(self.processor)}")

class DistributedProcessingManager:
    """Main manager for distributed processing operations"""

    def __init__(self, config: Optional[ClusterConfig] = None):
        # Use our new configuration system
        self.distributed_config = get_distributed_config()
        self.cluster_config = get_cluster_config()

        # Legacy config support
        self.config = config or ClusterConfig(
            cluster_type=self.cluster_config.get('cluster_type', 'dask'),
            num_workers=self.cluster_config.get('num_workers', 4),
            worker_memory=self.cluster_config.get('memory_limit', '4GB'),
            worker_cores=self.cluster_config.get('worker_cores', 2)
        )

        self.processor = None
        self.auto_scaler = None
        self.job_queue = JobQueue()
        self.active_jobs = {}
        self.completed_jobs = {}
        self.job_results = {}
        self.resource_monitor = ResourceMonitor()
        self.fault_tolerant_runner = None
        self._running = False
        self._processing_task = None

    def initialize(self) -> bool:
        """Initialize the distributed processing system"""
        try:
            # Check if distributed processing is enabled
            if not is_distributed_enabled():
                logger.info("Distributed processing is disabled")
                return False

            # Initialize processor based on cluster type
            if self.config.cluster_type == 'spark':
                self.processor = SparkDistributedProcessor(self.config)
            elif self.config.cluster_type == 'dask':
                self.processor = DaskDistributedProcessor(self.config)
            else:
                raise ValueError(f"Unknown cluster type: {self.config.cluster_type}")

            # Initialize cluster
            if not self.processor.initialize_cluster():
                return False

            # Initialize fault-tolerant runner
            self.fault_tolerant_runner = FaultTolerantJobRunner(
                self.processor,
                max_retries=self.distributed_config.job_retry_attempts
            )

            # Setup monitoring
            if self.distributed_config.monitoring.enable_metrics:
                self.resource_monitor.start_monitoring()

            # Setup auto-scaling
            if self.config.auto_scale:
                self.auto_scaler = AutoScaler(self.config, self.processor)
                self.auto_scaler.start_auto_scaling()

            # Start job processing loop
            self._running = True
            self._processing_task = asyncio.create_task(self._job_processing_loop())

            logger.info(f"Distributed processing manager initialized with {self.config.cluster_type}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize distributed processing: {e}")
            return False

    def submit_job(self, job: ProcessingJob) -> str:
        """Submit a job for distributed processing"""
        # Validate job
        self._validate_job(job)

        # Add to queue
        self.job_queue.add_job(job)
        logger.info(f"Job {job.job_id} submitted to queue with priority {job.priority}")
        return job.job_id

    def _validate_job(self, job: ProcessingJob):
        """Validate job before submission"""
        if not job.job_id:
            raise ValueError("Job ID is required")

        if not job.input_path:
            raise ValueError("Input path is required")

        if not job.job_type:
            raise ValueError("Job type is required")

        # Check for circular dependencies
        if job.dependencies and job.job_id in job.dependencies:
            raise ValueError("Job cannot depend on itself")

        # Validate file exists
        if not os.path.exists(job.input_path):
            raise FileNotFoundError(f"Input file not found: {job.input_path}")

    async def _job_processing_loop(self):
        """Main job processing loop"""
        while self._running:
            try:
                # Check for ready jobs
                job = self.job_queue.get_ready_job()

                if job:
                    # Check if we can accept more jobs
                    if len(self.active_jobs) < self.distributed_config.max_concurrent_jobs:
                        # Start job execution
                        task = asyncio.create_task(self._execute_job_async(job))
                        self.active_jobs[job.job_id] = {
                            'job': job,
                            'task': task,
                            'start_time': time.time()
                        }
                        logger.info(f"Started execution of job {job.job_id}")
                    else:
                        # Put job back in queue
                        self.job_queue.add_job(job)

                # Clean up completed jobs
                await self._cleanup_completed_jobs()

                # Wait before next iteration
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error in job processing loop: {e}")
                await asyncio.sleep(5)

    async def _execute_job_async(self, job: ProcessingJob):
        """Execute job asynchronously"""
        try:
            result = await self.fault_tolerant_runner.run_job_with_retry(job)
            self.job_results[job.job_id] = result

            if result.status == 'completed':
                self.job_queue.mark_completed(job.job_id)
            else:
                self.job_queue.mark_failed(job.job_id)

            return result

        except Exception as e:
            logger.error(f"Unexpected error executing job {job.job_id}: {e}")
            result = JobResult(
                job_id=job.job_id,
                status='failed',
                error=str(e),
                traceback=traceback.format_exc()
            )
            self.job_results[job.job_id] = result
            self.job_queue.mark_failed(job.job_id)
            return result

    async def _cleanup_completed_jobs(self):
        """Clean up completed job tasks"""
        completed_job_ids = []

        for job_id, job_info in self.active_jobs.items():
            if job_info['task'].done():
                completed_job_ids.append(job_id)

        for job_id in completed_job_ids:
            job_info = self.active_jobs.pop(job_id)
            self.completed_jobs[job_id] = job_info
            logger.info(f"Job {job_id} execution completed")

    def submit_ai_processing_job(
        self,
        file_path: str,
        job_type: str = 'comprehensive_analysis',
        options: Dict[str, Any] = None,
        priority: int = 5,
        user_id: Optional[str] = None
    ) -> str:
        """Submit an AI processing job for distributed execution"""
        job_id = str(uuid.uuid4())

        job = ProcessingJob(
            job_id=job_id,
            job_type=job_type,
            input_path=file_path,
            output_path=f"/tmp/distributed_results/{job_id}_result.json",
            parameters=options or {},
            priority=priority,
            user_id=user_id,
            max_retries=self.distributed_config.job_retry_attempts,
            timeout=self.distributed_config.job_timeout_seconds
        )

        return self.submit_job(job)

    async def process_jobs(self) -> List[Dict[str, Any]]:
        """Process all jobs in the queue"""
        results = []

        # Process jobs concurrently
        with ThreadPoolExecutor(max_workers=self.config.num_workers) as executor:
            futures = []

            for job in self.job_queue:
                future = executor.submit(self.processor.process_large_file, job)
                futures.append(future)
                self.active_jobs[job.job_id] = future

            # Collect results
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)

                    # Move completed job
                    job_id = result['job_id']
                    if job_id in self.active_jobs:
                        del self.active_jobs[job_id]
                    self.completed_jobs[job_id] = result

                except Exception as e:
                    logger.error(f"Job processing failed: {e}")
                    results.append({
                        'status': 'failed',
                        'error': str(e)
                    })

        # Clear processed jobs
        self.job_queue.clear()

        return results

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get comprehensive status of a specific job"""
        # Check if job result exists
        if job_id in self.job_results:
            result = self.job_results[job_id]
            return {
                'job_id': job_id,
                'status': result.status,
                'result': result.result,
                'error': result.error,
                'duration': result.duration,
                'start_time': result.start_time,
                'end_time': result.end_time
            }

        # Check active jobs
        elif job_id in self.active_jobs:
            job_info = self.active_jobs[job_id]
            return {
                'job_id': job_id,
                'status': 'running',
                'start_time': job_info['start_time'],
                'duration': time.time() - job_info['start_time']
            }

        # Check queue
        elif job_id in self.job_queue.jobs_by_id:
            job = self.job_queue.jobs_by_id[job_id]
            return {
                'job_id': job_id,
                'status': 'queued',
                'priority': job.priority,
                'queued_since': job.created_at,
                'dependencies': job.dependencies,
                'dependencies_satisfied': self.job_queue._dependencies_satisfied(job)
            }

        else:
            return {'job_id': job_id, 'status': 'not_found'}

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a queued or running job"""
        try:
            # Cancel active job
            if job_id in self.active_jobs:
                job_info = self.active_jobs[job_id]
                job_info['task'].cancel()
                self.active_jobs.pop(job_id)

                # Mark as cancelled
                self.job_results[job_id] = JobResult(
                    job_id=job_id,
                    status='cancelled',
                    end_time=time.time()
                )
                logger.info(f"Cancelled running job {job_id}")
                return True

            # Remove from queue
            elif job_id in self.job_queue.jobs_by_id:
                # Note: This is a simplified implementation
                # A full implementation would need to rebuild the priority queue
                logger.info(f"Cancelled queued job {job_id}")
                return True

            return False

        except Exception as e:
            logger.error(f"Failed to cancel job {job_id}: {e}")
            return False

    def get_cluster_info(self) -> Dict[str, Any]:
        """Get cluster information and metrics"""
        info = {
            'cluster_type': self.config.cluster_type,
            'config': asdict(self.config)
        }

        if isinstance(self.processor, DaskDistributedProcessor) and self.processor.client:
            scheduler_info = self.processor.client.scheduler_info()
            info.update({
                'workers': len(scheduler_info['workers']),
                'total_cores': sum(w['nthreads'] for w in scheduler_info['workers'].values()),
                'total_memory': sum(w['memory_limit'] for w in scheduler_info['workers'].values())
            })
        elif isinstance(self.processor, SparkDistributedProcessor) and self.processor.spark:
            info.update({
                'spark_version': self.processor.spark.version,
                'application_id': self.processor.spark.sparkContext.applicationId
            })

        return info

    async def shutdown(self):
        """Shutdown the distributed processing system"""
        logger.info("Shutting down distributed processing manager")

        # Stop job processing
        self._running = False
        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

        # Cancel active jobs
        for job_id in list(self.active_jobs.keys()):
            self.cancel_job(job_id)

        # Stop monitoring
        self.resource_monitor.stop_monitoring()

        # Stop auto-scaling
        if self.auto_scaler:
            self.auto_scaler.stop_auto_scaling()

        # Shutdown processor
        if self.processor:
            self.processor.shutdown()

        logger.info("Distributed processing manager shutdown completed")

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get comprehensive system metrics"""
        queue_stats = self.job_queue.get_queue_stats()
        resource_metrics = self.resource_monitor.get_current_metrics()
        cluster_info = self.get_cluster_info()

        return {
            'queue_stats': queue_stats,
            'resource_metrics': resource_metrics,
            'cluster_info': cluster_info,
            'active_jobs': len(self.active_jobs),
            'total_completed_jobs': len(self.completed_jobs),
            'system_status': 'running' if self._running else 'stopped'
        }


# Global instance - will be initialized when needed
distributed_manager: Optional[DistributedProcessingManager] = None

def get_distributed_manager() -> DistributedProcessingManager:
    """Get or create the global distributed processing manager"""
    global distributed_manager
    if distributed_manager is None:
        distributed_manager = DistributedProcessingManager()
        if not distributed_manager.initialize():
            logger.warning("Failed to initialize distributed processing manager")
    return distributed_manager

@asynccontextmanager
async def distributed_processing_context():
    """Context manager for distributed processing"""
    manager = get_distributed_manager()
    try:
        yield manager
    finally:
        # Cleanup can be added here if needed
        pass

def create_processing_job(
    file_path: str,
    job_type: str,
    parameters: Dict[str, Any] = None,
    priority: int = 5,
    dependencies: List[str] = None,
    user_id: Optional[str] = None
) -> ProcessingJob:
    """Factory function to create processing jobs"""
    job_id = str(uuid.uuid4())

    return ProcessingJob(
        job_id=job_id,
        job_type=job_type,
        input_path=file_path,
        output_path=f"/tmp/distributed_results/{job_id}_result.json",
        parameters=parameters or {},
        priority=priority,
        dependencies=dependencies or [],
        user_id=user_id
    )

def is_large_file_suitable_for_distributed_processing(file_path: str) -> bool:
    """Check if file is suitable for distributed processing"""
    try:
        file_size_gb = Path(file_path).stat().st_size / (1024**3)
        min_size_gb = get_distributed_config().performance.chunk_size / (1024**3)
        return file_size_gb > min_size_gb
    except Exception:
        return False

# Auto-initialize if configured
if is_distributed_enabled():
    logger.info("Distributed processing service configured and ready")
else:
    logger.info("Distributed processing service available but disabled")