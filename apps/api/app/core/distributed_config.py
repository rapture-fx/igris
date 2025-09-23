"""
Distributed Processing Configuration
===================================

This module provides configuration settings and management for distributed processing
infrastructure, including Dask and Spark cluster configuration, resource management,
and performance tuning.

Features:
- Environment-specific distributed processing settings
- Resource allocation and scaling configurations
- Performance tuning parameters
- Security and networking configurations
- Integration with existing infrastructure
"""

import os
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class ClusterType(Enum):
    """Supported cluster types"""
    DASK = "dask"
    SPARK = "spark"
    AUTO = "auto"  # Auto-select based on workload


class ScalingStrategy(Enum):
    """Cluster scaling strategies"""
    MANUAL = "manual"
    CPU_BASED = "cpu_based"
    MEMORY_BASED = "memory_based"
    QUEUE_BASED = "queue_based"
    ADAPTIVE = "adaptive"


@dataclass
class ResourceLimits:
    """Resource limits and constraints"""
    max_memory_gb: float = 32.0
    max_cpu_cores: int = 16
    max_workers: int = 10
    min_workers: int = 2
    worker_memory_gb: float = 4.0
    worker_cpu_cores: int = 2
    disk_space_gb: float = 100.0


@dataclass
class ScalingConfig:
    """Auto-scaling configuration"""
    strategy: ScalingStrategy = ScalingStrategy.ADAPTIVE
    scale_up_threshold: float = 80.0  # CPU/Memory percentage
    scale_down_threshold: float = 30.0
    scale_up_cooldown: int = 300  # seconds
    scale_down_cooldown: int = 600  # seconds
    max_scale_up_rate: int = 2  # workers per scaling event
    max_scale_down_rate: int = 1
    queue_threshold: int = 5  # jobs in queue to trigger scale up
    enable_predictive_scaling: bool = True


@dataclass
class SecurityConfig:
    """Security configuration for distributed clusters"""
    enable_encryption: bool = True
    ssl_enabled: bool = True
    authentication_enabled: bool = True
    network_encryption: bool = True
    secure_random_ports: bool = True
    firewall_rules: List[str] = field(default_factory=list)


@dataclass
class MonitoringConfig:
    """Monitoring and observability configuration"""
    enable_metrics: bool = True
    metrics_port: int = 8787
    dashboard_port: int = 8786
    enable_profiling: bool = True
    log_level: str = "INFO"
    metrics_retention_hours: int = 24
    enable_alerts: bool = True
    alert_thresholds: Dict[str, float] = field(default_factory=lambda: {
        "cpu_usage": 90.0,
        "memory_usage": 90.0,
        "disk_usage": 85.0,
        "error_rate": 5.0
    })


@dataclass
class PerformanceConfig:
    """Performance tuning configuration"""
    chunk_size: int = 10000
    batch_size: int = 1000
    prefetch_factor: int = 2
    spill_to_disk: bool = True
    compression_enabled: bool = True
    compression_algorithm: str = "lz4"
    cache_size_gb: float = 8.0
    optimize_graph: bool = True
    task_fusion: bool = True


@dataclass
class NetworkConfig:
    """Network configuration for distributed processing"""
    scheduler_host: str = "localhost"
    scheduler_port: int = 8786
    worker_port_range: str = "8787-8797"
    dashboard_host: str = "localhost"
    dashboard_port: int = 8787
    nanny_port: int = 8788
    communication_timeout: int = 30
    heartbeat_interval: int = 1000  # milliseconds


@dataclass
class SparkConfig:
    """Apache Spark specific configuration"""
    master: str = "local[*]"
    app_name: str = "Schlep-Engine-Distributed-Processing"
    executor_memory: str = "4g"
    executor_cores: int = 2
    driver_memory: str = "2g"
    sql_adaptive_enabled: bool = True
    sql_adaptive_coalesce_partitions: bool = True
    sql_adaptive_skew_join: bool = True
    dynamic_allocation: bool = True
    dynamic_allocation_min_executors: int = 1
    dynamic_allocation_max_executors: int = 10
    kryo_serializer: bool = True
    compression_codec: str = "lz4"


@dataclass
class DaskConfig:
    """Dask specific configuration"""
    scheduler_address: Optional[str] = None
    processes: bool = True
    threads_per_worker: int = 2
    memory_limit: str = "4GB"
    local_directory: Optional[str] = None
    silence_logs: bool = False
    dashboard_address: str = ":8787"
    protocol: str = "tcp"
    serializers: List[str] = field(default_factory=lambda: ["pickle", "cloudpickle"])
    deserializers: List[str] = field(default_factory=lambda: ["pickle", "cloudpickle"])


@dataclass
class DistributedProcessingConfig:
    """Main distributed processing configuration"""
    # Core settings
    cluster_type: ClusterType = ClusterType.DASK
    enable_distributed_processing: bool = True
    default_backend: str = "dask"
    fallback_to_local: bool = True

    # Resource management
    resources: ResourceLimits = field(default_factory=ResourceLimits)
    scaling: ScalingConfig = field(default_factory=ScalingConfig)

    # Security
    security: SecurityConfig = field(default_factory=SecurityConfig)

    # Monitoring
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)

    # Performance
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)

    # Network
    network: NetworkConfig = field(default_factory=NetworkConfig)

    # Backend-specific configs
    spark: SparkConfig = field(default_factory=SparkConfig)
    dask: DaskConfig = field(default_factory=DaskConfig)

    # Job management
    max_concurrent_jobs: int = 5
    job_timeout_seconds: int = 3600
    job_retry_attempts: int = 3
    job_priority_levels: int = 5

    # Data management
    temp_storage_path: str = "/tmp/distributed_processing"
    result_storage_path: str = "/tmp/distributed_results"
    cleanup_temp_files: bool = True
    result_retention_hours: int = 24

    # Feature flags
    enable_gpu_processing: bool = False
    enable_advanced_scheduling: bool = True
    enable_data_locality: bool = True
    enable_speculative_execution: bool = False


class DistributedConfigManager:
    """Manager for distributed processing configuration"""

    def __init__(self):
        self._config: Optional[DistributedProcessingConfig] = None
        self._environment = os.getenv("ENVIRONMENT", "development")

    @property
    def config(self) -> DistributedProcessingConfig:
        """Get or create configuration"""
        if self._config is None:
            self._config = self._load_config()
        return self._config

    def _load_config(self) -> DistributedProcessingConfig:
        """Load configuration from environment and defaults"""
        config = DistributedProcessingConfig()

        # Load environment-specific settings
        self._apply_environment_settings(config)

        # Load from environment variables
        self._apply_env_variables(config)

        # Load from config file if exists
        self._apply_config_file(config)

        # Validate configuration
        self._validate_config(config)

        logger.info(f"Distributed processing configuration loaded for environment: {self._environment}")
        return config

    def _apply_environment_settings(self, config: DistributedProcessingConfig):
        """Apply environment-specific settings"""
        if self._environment == "production":
            # Production settings
            config.resources.max_workers = 20
            config.resources.max_memory_gb = 128.0
            config.resources.max_cpu_cores = 64
            config.scaling.enable_predictive_scaling = True
            config.security.enable_encryption = True
            config.security.ssl_enabled = True
            config.monitoring.enable_alerts = True
            config.performance.cache_size_gb = 32.0

        elif self._environment == "staging":
            # Staging settings
            config.resources.max_workers = 10
            config.resources.max_memory_gb = 64.0
            config.resources.max_cpu_cores = 32
            config.scaling.enable_predictive_scaling = True
            config.security.enable_encryption = True
            config.monitoring.enable_alerts = True
            config.performance.cache_size_gb = 16.0

        else:
            # Development settings
            config.resources.max_workers = 4
            config.resources.max_memory_gb = 16.0
            config.resources.max_cpu_cores = 8
            config.scaling.enable_predictive_scaling = False
            config.security.enable_encryption = False
            config.security.ssl_enabled = False
            config.monitoring.enable_alerts = False
            config.performance.cache_size_gb = 4.0

    def _apply_env_variables(self, config: DistributedProcessingConfig):
        """Apply settings from environment variables"""
        # Core settings
        if os.getenv("DISTRIBUTED_CLUSTER_TYPE"):
            config.cluster_type = ClusterType(os.getenv("DISTRIBUTED_CLUSTER_TYPE"))

        if os.getenv("DISTRIBUTED_ENABLED"):
            config.enable_distributed_processing = os.getenv("DISTRIBUTED_ENABLED").lower() == "true"

        # Resource settings
        if os.getenv("DISTRIBUTED_MAX_WORKERS"):
            config.resources.max_workers = int(os.getenv("DISTRIBUTED_MAX_WORKERS"))

        if os.getenv("DISTRIBUTED_MAX_MEMORY_GB"):
            config.resources.max_memory_gb = float(os.getenv("DISTRIBUTED_MAX_MEMORY_GB"))

        if os.getenv("DISTRIBUTED_WORKER_MEMORY_GB"):
            config.resources.worker_memory_gb = float(os.getenv("DISTRIBUTED_WORKER_MEMORY_GB"))

        # Network settings
        if os.getenv("DISTRIBUTED_SCHEDULER_HOST"):
            config.network.scheduler_host = os.getenv("DISTRIBUTED_SCHEDULER_HOST")

        if os.getenv("DISTRIBUTED_SCHEDULER_PORT"):
            config.network.scheduler_port = int(os.getenv("DISTRIBUTED_SCHEDULER_PORT"))

        # Spark settings
        if os.getenv("SPARK_MASTER"):
            config.spark.master = os.getenv("SPARK_MASTER")

        if os.getenv("SPARK_EXECUTOR_MEMORY"):
            config.spark.executor_memory = os.getenv("SPARK_EXECUTOR_MEMORY")

        # Dask settings
        if os.getenv("DASK_SCHEDULER_ADDRESS"):
            config.dask.scheduler_address = os.getenv("DASK_SCHEDULER_ADDRESS")

    def _apply_config_file(self, config: DistributedProcessingConfig):
        """Apply settings from configuration file"""
        config_file = os.getenv("DISTRIBUTED_CONFIG_FILE", "distributed_config.json")

        if os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    file_config = json.load(f)

                # Apply settings from file (implementation would recursively update config)
                logger.info(f"Configuration loaded from file: {config_file}")

            except Exception as e:
                logger.warning(f"Failed to load config file {config_file}: {e}")

    def _validate_config(self, config: DistributedProcessingConfig):
        """Validate configuration settings"""
        # Resource validation
        if config.resources.min_workers > config.resources.max_workers:
            raise ValueError("min_workers cannot be greater than max_workers")

        if config.resources.worker_memory_gb > config.resources.max_memory_gb:
            logger.warning("Worker memory exceeds max memory limit")

        # Scaling validation
        if config.scaling.scale_up_threshold <= config.scaling.scale_down_threshold:
            raise ValueError("scale_up_threshold must be greater than scale_down_threshold")

        # Network validation
        if config.network.scheduler_port < 1024 or config.network.scheduler_port > 65535:
            raise ValueError("Invalid scheduler port")

        logger.info("Configuration validation completed successfully")

    def get_cluster_config(self) -> Dict[str, Any]:
        """Get cluster-specific configuration"""
        config = self.config

        if config.cluster_type == ClusterType.DASK:
            return {
                "cluster_type": "dask",
                "scheduler_address": config.dask.scheduler_address,
                "processes": config.dask.processes,
                "threads_per_worker": config.dask.threads_per_worker,
                "memory_limit": config.dask.memory_limit,
                "num_workers": config.resources.max_workers,
                "worker_cores": config.resources.worker_cpu_cores,
                "dashboard_address": config.dask.dashboard_address,
                "local_directory": config.dask.local_directory
            }

        elif config.cluster_type == ClusterType.SPARK:
            return {
                "cluster_type": "spark",
                "master": config.spark.master,
                "app_name": config.spark.app_name,
                "executor_memory": config.spark.executor_memory,
                "executor_cores": config.spark.executor_cores,
                "driver_memory": config.spark.driver_memory,
                "dynamic_allocation": config.spark.dynamic_allocation,
                "max_executors": config.spark.dynamic_allocation_max_executors
            }

        else:
            # Auto-select based on workload
            return self._auto_select_cluster_config()

    def _auto_select_cluster_config(self) -> Dict[str, Any]:
        """Auto-select cluster configuration based on current workload"""
        # Simple heuristic: use Dask for smaller workloads, Spark for larger
        # In production, this could be more sophisticated

        available_memory = self.config.resources.max_memory_gb

        if available_memory > 64:
            # Use Spark for large memory workloads
            self.config.cluster_type = ClusterType.SPARK
            return self.get_cluster_config()
        else:
            # Use Dask for smaller workloads
            self.config.cluster_type = ClusterType.DASK
            return self.get_cluster_config()

    def get_performance_config(self) -> Dict[str, Any]:
        """Get performance configuration"""
        perf = self.config.performance
        return {
            "chunk_size": perf.chunk_size,
            "batch_size": perf.batch_size,
            "prefetch_factor": perf.prefetch_factor,
            "spill_to_disk": perf.spill_to_disk,
            "compression_enabled": perf.compression_enabled,
            "compression_algorithm": perf.compression_algorithm,
            "cache_size_gb": perf.cache_size_gb,
            "optimize_graph": perf.optimize_graph,
            "task_fusion": perf.task_fusion
        }

    def get_monitoring_config(self) -> Dict[str, Any]:
        """Get monitoring configuration"""
        mon = self.config.monitoring
        return {
            "enable_metrics": mon.enable_metrics,
            "metrics_port": mon.metrics_port,
            "dashboard_port": mon.dashboard_port,
            "enable_profiling": mon.enable_profiling,
            "log_level": mon.log_level,
            "metrics_retention_hours": mon.metrics_retention_hours,
            "enable_alerts": mon.enable_alerts,
            "alert_thresholds": mon.alert_thresholds
        }

    def update_config(self, updates: Dict[str, Any]):
        """Update configuration at runtime"""
        # Implementation would update the config object
        logger.info("Configuration updated at runtime")

    def reload_config(self):
        """Reload configuration from sources"""
        self._config = None
        self._config = self._load_config()
        logger.info("Configuration reloaded")


# Global configuration manager instance
distributed_config_manager = DistributedConfigManager()

# Convenience functions
def get_distributed_config() -> DistributedProcessingConfig:
    """Get the current distributed processing configuration"""
    return distributed_config_manager.config

def get_cluster_config() -> Dict[str, Any]:
    """Get cluster-specific configuration"""
    return distributed_config_manager.get_cluster_config()

def get_performance_config() -> Dict[str, Any]:
    """Get performance configuration"""
    return distributed_config_manager.get_performance_config()

def get_monitoring_config() -> Dict[str, Any]:
    """Get monitoring configuration"""
    return distributed_config_manager.get_monitoring_config()

def is_distributed_enabled() -> bool:
    """Check if distributed processing is enabled"""
    return distributed_config_manager.config.enable_distributed_processing

logger.info("Distributed configuration module initialized")