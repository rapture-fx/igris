"""
Business-specific metrics for Schlep Engine
Tracks data processing quality, job performance, and user engagement
"""

import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import logging

from prometheus_client import (
    Counter, Histogram, Gauge, Summary,
    generate_latest, CONTENT_TYPE_LATEST
)

from app.core.metrics import app_registry
from app.core.logging_config import get_logger

logger = get_logger("app.business_metrics")

# Data Quality Metrics
DATA_QUALITY_SCORE = Gauge(
    'data_quality_score',
    'Data quality score (0-100)',
    ['dataset_id', 'quality_dimension'],
    registry=app_registry
)

DATA_VALIDATION_ERRORS = Counter(
    'data_validation_errors_total',
    'Total data validation errors',
    ['validation_type', 'severity', 'dataset_type'],
    registry=app_registry
)

DATA_COMPLETENESS_RATIO = Gauge(
    'data_completeness_ratio',
    'Data completeness ratio (0-1)',
    ['dataset_id', 'column_name'],
    registry=app_registry
)

DATA_ACCURACY_SCORE = Gauge(
    'data_accuracy_score',
    'Data accuracy score (0-100)',
    ['dataset_id', 'accuracy_type'],
    registry=app_registry
)

DATA_CONSISTENCY_VIOLATIONS = Counter(
    'data_consistency_violations_total',
    'Total data consistency violations',
    ['violation_type', 'severity'],
    registry=app_registry
)

# Job Processing Metrics
JOB_QUEUE_SIZE = Gauge(
    'job_queue_size',
    'Number of jobs in queue',
    ['queue_name', 'priority'],
    registry=app_registry
)

JOB_PROCESSING_TIME = Histogram(
    'job_processing_time_seconds',
    'Job processing time in seconds',
    ['job_type', 'complexity', 'status'],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0, 1800.0, 3600.0],
    registry=app_registry
)

JOB_RETRY_COUNT = Counter(
    'job_retry_count_total',
    'Total job retries',
    ['job_type', 'retry_reason'],
    registry=app_registry
)

JOB_SUCCESS_RATE = Gauge(
    'job_success_rate',
    'Job success rate (0-1)',
    ['job_type', 'time_window'],
    registry=app_registry
)

JOB_RESOURCE_USAGE = Gauge(
    'job_resource_usage',
    'Job resource usage',
    ['job_id', 'resource_type'],
    registry=app_registry
)

# User Engagement Metrics
USER_SESSION_DURATION = Histogram(
    'user_session_duration_seconds',
    'User session duration in seconds',
    ['user_type', 'session_type'],
    buckets=[60.0, 300.0, 600.0, 1800.0, 3600.0, 7200.0, 21600.0],
    registry=app_registry
)

USER_FEATURE_USAGE = Counter(
    'user_feature_usage_total',
    'Total feature usage by users',
    ['feature_name', 'user_type', 'plan_type'],
    registry=app_registry
)

USER_CONVERSION_RATE = Gauge(
    'user_conversion_rate',
    'User conversion rate (0-1)',
    ['conversion_type', 'time_window'],
    registry=app_registry
)

USER_RETENTION_RATE = Gauge(
    'user_retention_rate',
    'User retention rate (0-1)',
    ['time_period', 'user_cohort'],
    registry=app_registry
)

# Data Pipeline Metrics
PIPELINE_EXECUTION_TIME = Histogram(
    'pipeline_execution_time_seconds',
    'Data pipeline execution time',
    ['pipeline_name', 'stage', 'status'],
    buckets=[10.0, 30.0, 60.0, 300.0, 600.0, 1800.0, 3600.0],
    registry=app_registry
)

PIPELINE_DATA_THROUGHPUT = Gauge(
    'pipeline_data_throughput_records_per_second',
    'Pipeline data processing throughput',
    ['pipeline_name', 'stage'],
    registry=app_registry
)

PIPELINE_ERROR_RATE = Gauge(
    'pipeline_error_rate',
    'Pipeline error rate (0-1)',
    ['pipeline_name', 'error_type'],
    registry=app_registry
)

PIPELINE_DATA_VOLUME = Counter(
    'pipeline_data_volume_bytes_total',
    'Total data volume processed by pipeline',
    ['pipeline_name', 'data_type'],
    registry=app_registry
)

# ML Model Performance Metrics
MODEL_INFERENCE_TIME = Histogram(
    'model_inference_time_seconds',
    'ML model inference time',
    ['model_name', 'model_version', 'input_size'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0],
    registry=app_registry
)

MODEL_PREDICTION_ACCURACY = Gauge(
    'model_prediction_accuracy',
    'Model prediction accuracy (0-1)',
    ['model_name', 'model_version', 'dataset'],
    registry=app_registry
)

MODEL_DRIFT_SCORE = Gauge(
    'model_drift_score',
    'Model drift score (0-100)',
    ['model_name', 'drift_type'],
    registry=app_registry
)

MODEL_FEATURE_IMPORTANCE = Gauge(
    'model_feature_importance',
    'Feature importance score (0-1)',
    ['model_name', 'feature_name'],
    registry=app_registry
)

# Cost and Resource Metrics
COMPUTE_COST_PER_JOB = Gauge(
    'compute_cost_per_job_usd',
    'Compute cost per job in USD',
    ['job_type', 'resource_tier'],
    registry=app_registry
)

STORAGE_COST_PER_GB = Gauge(
    'storage_cost_per_gb_usd',
    'Storage cost per GB in USD',
    ['storage_type', 'region'],
    registry=app_registry
)

RESOURCE_UTILIZATION = Gauge(
    'resource_utilization_percent',
    'Resource utilization percentage',
    ['resource_type', 'cluster', 'node'],
    registry=app_registry
)

API_QUOTA_USAGE = Gauge(
    'api_quota_usage_percent',
    'API quota usage percentage',
    ['api_service', 'user_type', 'plan_type'],
    registry=app_registry
)

class DataQualityDimension(str, Enum):
    COMPLETENESS = "completeness"
    ACCURACY = "accuracy"
    CONSISTENCY = "consistency"
    VALIDITY = "validity"
    UNIQUENESS = "uniqueness"
    TIMELINESS = "timeliness"

class JobComplexity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class BusinessMetricsCollector:
    """Collector for business-specific metrics"""
    
    def __init__(self):
        self.registry = app_registry
    
    def record_data_quality_metrics(
        self,
        dataset_id: str,
        quality_scores: Dict[DataQualityDimension, float],
        completeness_ratios: Optional[Dict[str, float]] = None,
        validation_errors: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """Record data quality metrics"""
        
        # Record quality scores for each dimension
        for dimension, score in quality_scores.items():
            DATA_QUALITY_SCORE.labels(
                dataset_id=dataset_id,
                quality_dimension=dimension.value
            ).set(score)
        
        # Record completeness ratios for columns
        if completeness_ratios:
            for column, ratio in completeness_ratios.items():
                DATA_COMPLETENESS_RATIO.labels(
                    dataset_id=dataset_id,
                    column_name=column
                ).set(ratio)
        
        # Record validation errors
        if validation_errors:
            for error in validation_errors:
                DATA_VALIDATION_ERRORS.labels(
                    validation_type=error.get("type", "unknown"),
                    severity=error.get("severity", "medium"),
                    dataset_type=error.get("dataset_type", "unknown")
                ).inc()
        
        logger.info(
            "Data quality metrics recorded",
            extra={
                "extra_fields": {
                    "dataset_id": dataset_id,
                    "quality_scores": {d.value: s for d, s in quality_scores.items()},
                    "completeness_ratios": completeness_ratios,
                    "validation_error_count": len(validation_errors) if validation_errors else 0
                }
            }
        )
    
    def record_job_metrics(
        self,
        job_id: str,
        job_type: str,
        complexity: JobComplexity,
        status: str,
        processing_time: float,
        resource_usage: Optional[Dict[str, float]] = None,
        retry_count: int = 0,
        retry_reason: Optional[str] = None
    ) -> None:
        """Record job processing metrics"""
        
        # Record processing time
        JOB_PROCESSING_TIME.labels(
            job_type=job_type,
            complexity=complexity.value,
            status=status
        ).observe(processing_time)
        
        # Record resource usage
        if resource_usage:
            for resource_type, usage in resource_usage.items():
                JOB_RESOURCE_USAGE.labels(
                    job_id=job_id,
                    resource_type=resource_type
                ).set(usage)
        
        # Record retries
        if retry_count > 0:
            JOB_RETRY_COUNT.labels(
                job_type=job_type,
                retry_reason=retry_reason or "unknown"
            ).inc(retry_count)
        
        logger.info(
            "Job metrics recorded",
            extra={
                "extra_fields": {
                    "job_id": job_id,
                    "job_type": job_type,
                    "complexity": complexity.value,
                    "status": status,
                    "processing_time": processing_time,
                    "resource_usage": resource_usage,
                    "retry_count": retry_count
                }
            }
        )
    
    def record_pipeline_metrics(
        self,
        pipeline_name: str,
        stage: str,
        execution_time: float,
        status: str,
        data_volume_bytes: int,
        throughput_rps: float,
        error_rate: float = 0.0
    ) -> None:
        """Record data pipeline metrics"""
        
        PIPELINE_EXECUTION_TIME.labels(
            pipeline_name=pipeline_name,
            stage=stage,
            status=status
        ).observe(execution_time)
        
        PIPELINE_DATA_THROUGHPUT.labels(
            pipeline_name=pipeline_name,
            stage=stage
        ).set(throughput_rps)
        
        PIPELINE_DATA_VOLUME.labels(
            pipeline_name=pipeline_name,
            data_type="processed"
        ).inc(data_volume_bytes)
        
        PIPELINE_ERROR_RATE.labels(
            pipeline_name=pipeline_name,
            error_type="processing"
        ).set(error_rate)
        
        logger.info(
            "Pipeline metrics recorded",
            extra={
                "extra_fields": {
                    "pipeline_name": pipeline_name,
                    "stage": stage,
                    "execution_time": execution_time,
                    "status": status,
                    "data_volume_bytes": data_volume_bytes,
                    "throughput_rps": throughput_rps,
                    "error_rate": error_rate
                }
            }
        )
    
    def record_model_performance(
        self,
        model_name: str,
        model_version: str,
        inference_time: float,
        accuracy: float,
        input_size: str = "medium",
        feature_importance: Optional[Dict[str, float]] = None,
        drift_scores: Optional[Dict[str, float]] = None
    ) -> None:
        """Record ML model performance metrics"""
        
        MODEL_INFERENCE_TIME.labels(
            model_name=model_name,
            model_version=model_version,
            input_size=input_size
        ).observe(inference_time)
        
        MODEL_PREDICTION_ACCURACY.labels(
            model_name=model_name,
            model_version=model_version,
            dataset="validation"
        ).set(accuracy)
        
        if feature_importance:
            for feature, importance in feature_importance.items():
                MODEL_FEATURE_IMPORTANCE.labels(
                    model_name=model_name,
                    feature_name=feature
                ).set(importance)
        
        if drift_scores:
            for drift_type, score in drift_scores.items():
                MODEL_DRIFT_SCORE.labels(
                    model_name=model_name,
                    drift_type=drift_type
                ).set(score)
        
        logger.info(
            "Model performance metrics recorded",
            extra={
                "extra_fields": {
                    "model_name": model_name,
                    "model_version": model_version,
                    "inference_time": inference_time,
                    "accuracy": accuracy,
                    "feature_importance": feature_importance,
                    "drift_scores": drift_scores
                }
            }
        )
    
    def record_user_engagement(
        self,
        user_id: str,
        user_type: str,
        plan_type: str,
        session_duration: float,
        features_used: List[str],
        session_type: str = "regular"
    ) -> None:
        """Record user engagement metrics"""
        
        USER_SESSION_DURATION.labels(
            user_type=user_type,
            session_type=session_type
        ).observe(session_duration)
        
        for feature in features_used:
            USER_FEATURE_USAGE.labels(
                feature_name=feature,
                user_type=user_type,
                plan_type=plan_type
            ).inc()
        
        logger.info(
            "User engagement metrics recorded",
            extra={
                "extra_fields": {
                    "user_id": user_id,
                    "user_type": user_type,
                    "plan_type": plan_type,
                    "session_duration": session_duration,
                    "features_used": features_used,
                    "session_type": session_type
                }
            }
        )
    
    def record_cost_metrics(
        self,
        job_type: str,
        resource_tier: str,
        compute_cost: float,
        storage_type: str,
        storage_cost_per_gb: float,
        resource_utilization: Dict[str, float]
    ) -> None:
        """Record cost and resource utilization metrics"""
        
        COMPUTE_COST_PER_JOB.labels(
            job_type=job_type,
            resource_tier=resource_tier
        ).set(compute_cost)
        
        STORAGE_COST_PER_GB.labels(
            storage_type=storage_type,
            region="us-central1"
        ).set(storage_cost_per_gb)
        
        for resource_type, utilization in resource_utilization.items():
            RESOURCE_UTILIZATION.labels(
                resource_type=resource_type,
                cluster="main",
                node="default"
            ).set(utilization)
        
        logger.info(
            "Cost metrics recorded",
            extra={
                "extra_fields": {
                    "job_type": job_type,
                    "resource_tier": resource_tier,
                    "compute_cost": compute_cost,
                    "storage_type": storage_type,
                    "storage_cost_per_gb": storage_cost_per_gb,
                    "resource_utilization": resource_utilization
                }
            }
        )
    
    def update_queue_metrics(self, queue_metrics: Dict[str, Dict[str, int]]) -> None:
        """Update job queue metrics"""
        for queue_name, priorities in queue_metrics.items():
            for priority, count in priorities.items():
                JOB_QUEUE_SIZE.labels(
                    queue_name=queue_name,
                    priority=priority
                ).set(count)
    
    def calculate_success_rates(self, time_window: str = "1h") -> None:
        """Calculate and update success rates"""
        # This would typically query historical data
        # For now, we'll use placeholder values
        
        job_types = ["data_processing", "ml_training", "data_validation"]
        for job_type in job_types:
            # Calculate success rate from historical data
            success_rate = 0.95  # Placeholder
            
            JOB_SUCCESS_RATE.labels(
                job_type=job_type,
                time_window=time_window
            ).set(success_rate)

# Global business metrics collector instance
business_metrics = BusinessMetricsCollector()

# Convenience functions
def record_data_quality(
    dataset_id: str,
    quality_scores: Dict[DataQualityDimension, float],
    **kwargs
) -> None:
    """Record data quality metrics"""
    business_metrics.record_data_quality_metrics(dataset_id, quality_scores, **kwargs)

def record_job_performance(
    job_id: str,
    job_type: str,
    complexity: JobComplexity,
    processing_time: float,
    status: str = "completed",
    **kwargs
) -> None:
    """Record job performance metrics"""
    business_metrics.record_job_metrics(
        job_id, job_type, complexity, status, processing_time, **kwargs
    )

def record_pipeline_performance(
    pipeline_name: str,
    stage: str,
    execution_time: float,
    data_volume_bytes: int,
    throughput_rps: float,
    status: str = "completed",
    **kwargs
) -> None:
    """Record pipeline performance metrics"""
    business_metrics.record_pipeline_metrics(
        pipeline_name, stage, execution_time, status,
        data_volume_bytes, throughput_rps, **kwargs
    )

def record_model_metrics(
    model_name: str,
    model_version: str,
    inference_time: float,
    accuracy: float,
    **kwargs
) -> None:
    """Record model performance metrics"""
    business_metrics.record_model_performance(
        model_name, model_version, inference_time, accuracy, **kwargs
    )

def record_user_metrics(
    user_id: str,
    user_type: str,
    plan_type: str,
    session_duration: float,
    features_used: List[str],
    **kwargs
) -> None:
    """Record user engagement metrics"""
    business_metrics.record_user_engagement(
        user_id, user_type, plan_type, session_duration, features_used, **kwargs
    )