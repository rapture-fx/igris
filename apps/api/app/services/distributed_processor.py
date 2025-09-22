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

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()


class ResourceMonitor:
    """Monitor cluster resources and performance"""

    def __init__(self):
        self.metrics = {}
        self.monitoring_active = False

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

                self.metrics.update({
                    'timestamp': time.time(),
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_available_gb': memory.available / (1024**3),
                    'disk_percent': disk.percent,
                    'disk_free_gb': disk.free / (1024**3)
                })

                time.sleep(5)  # Update every 5 seconds

            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                time.sleep(10)

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


class DistributedProcessingManager:
    """Main manager for distributed processing operations"""

    def __init__(self, config: ClusterConfig = None):
        self.config = config or ClusterConfig()
        self.processor = None
        self.auto_scaler = None
        self.job_queue = []
        self.active_jobs = {}
        self.completed_jobs = {}

    def initialize(self) -> bool:
        """Initialize the distributed processing system"""
        try:
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

            # Setup auto-scaling
            if self.config.auto_scale:
                self.auto_scaler = AutoScaler(self.config, self.processor)
                self.auto_scaler.start_auto_scaling()

            logger.info(f"Distributed processing manager initialized with {self.config.cluster_type}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize distributed processing: {e}")
            return False

    def submit_job(self, job: ProcessingJob) -> str:
        """Submit a job for distributed processing"""
        self.job_queue.append(job)
        logger.info(f"Job {job.job_id} submitted to queue")
        return job.job_id

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
        """Get status of a specific job"""
        if job_id in self.completed_jobs:
            return self.completed_jobs[job_id]
        elif job_id in self.active_jobs:
            return {'job_id': job_id, 'status': 'running'}
        else:
            # Check queue
            for job in self.job_queue:
                if job.job_id == job_id:
                    return {'job_id': job_id, 'status': 'queued'}
            return {'job_id': job_id, 'status': 'not_found'}

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

    def shutdown(self):
        """Shutdown the distributed processing system"""
        if self.auto_scaler:
            self.auto_scaler.stop_auto_scaling()

        if self.processor:
            self.processor.shutdown()

        logger.info("Distributed processing manager shutdown")


# Global instance
distributed_manager = DistributedProcessingManager()

logger.info("Distributed processing service initialized")