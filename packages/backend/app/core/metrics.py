"""
Custom metrics instrumentation for Schlep-engine
Provides business and performance metrics for Prometheus monitoring
"""

import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from contextlib import contextmanager
from dataclasses import dataclass
from enum import Enum
import logging

from prometheus_client import (
    Counter, Histogram, Gauge, Summary, Info,
    generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
)

logger = logging.getLogger(__name__)

class MetricType(str, Enum):
    """Metric types for classification"""
    BUSINESS = "business"
    PERFORMANCE = "performance"
    SYSTEM = "system"
    SECURITY = "security"
    USER = "user"

# Create a custom registry for application metrics
app_registry = CollectorRegistry()

# HTTP Request Metrics
HTTP_REQUESTS_TOTAL = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code', 'user_type'],
    registry=app_registry
)

HTTP_REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'status_code'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0, 100.0],
    registry=app_registry
)

HTTP_REQUEST_SIZE = Histogram(
    'http_request_size_bytes',
    'HTTP request size in bytes',
    ['method', 'endpoint'],
    buckets=[100, 1000, 10000, 100000, 1000000],
    registry=app_registry
)

HTTP_RESPONSE_SIZE = Histogram(
    'http_response_size_bytes',
    'HTTP response size in bytes',
    ['method', 'endpoint', 'status_code'],
    buckets=[100, 1000, 10000, 100000, 1000000],
    registry=app_registry
)

# Authentication Metrics
AUTH_LOGIN_ATTEMPTS = Counter(
    'auth_login_attempts_total',
    'Total login attempts',
    ['status', 'method'],
    registry=app_registry
)

AUTH_LOGIN_DURATION = Histogram(
    'auth_login_duration_seconds',
    'Login duration in seconds',
    ['method', 'status'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
    registry=app_registry
)

AUTH_SESSIONS_ACTIVE = Gauge(
    'auth_sessions_active',
    'Number of active sessions',
    ['user_type'],
    registry=app_registry
)

AUTH_FAILED_ATTEMPTS = Counter(
    'auth_failed_attempts_total',
    'Total failed authentication attempts',
    ['reason', 'ip_address'],
    registry=app_registry
)

# User Management Metrics
USERS_REGISTERED = Counter(
    'users_registered_total',
    'Total user registrations',
    ['source', 'verification_status'],
    registry=app_registry
)

USERS_ACTIVE = Gauge(
    'users_active',
    'Number of active users',
    ['user_type', 'plan'],
    registry=app_registry
)

USERS_ONLINE = Gauge(
    'users_online',
    'Number of users currently online',
    ['user_type'],
    registry=app_registry
)

# Data Processing Metrics
DATA_FILES_UPLOADED = Counter(
    'data_files_uploaded_total',
    'Total files uploaded',
    ['file_type', 'size_category', 'user_type'],
    registry=app_registry
)

DATA_FILES_PROCESSED = Counter(
    'data_files_processed_total',
    'Total files processed',
    ['file_type', 'processing_status', 'user_type'],
    registry=app_registry
)

DATA_PROCESSING_DURATION = Histogram(
    'data_processing_duration_seconds',
    'Data processing duration in seconds',
    ['file_type', 'processing_type', 'status'],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0, 1800.0],
    registry=app_registry
)

DATA_PROCESSING_ERRORS = Counter(
    'data_processing_errors_total',
    'Total data processing errors',
    ['error_type', 'file_type'],
    registry=app_registry
)

# ML Pipeline Metrics
ML_JOBS_CREATED = Counter(
    'ml_jobs_created_total',
    'Total ML jobs created',
    ['job_type', 'model_type', 'user_type'],
    registry=app_registry
)

ML_JOBS_COMPLETED = Counter(
    'ml_jobs_completed_total',
    'Total ML jobs completed',
    ['job_type', 'model_type', 'status'],
    registry=app_registry
)

ML_TRAINING_DURATION = Histogram(
    'ml_training_duration_seconds',
    'ML training duration in seconds',
    ['model_type', 'dataset_size'],
    buckets=[60.0, 300.0, 600.0, 1800.0, 3600.0, 7200.0, 18000.0],
    registry=app_registry
)

ML_MODEL_ACCURACY = Gauge(
    'ml_model_accuracy',
    'ML model accuracy',
    ['model_type', 'dataset'],
    registry=app_registry
)

ML_PREDICTIONS_MADE = Counter(
    'ml_predictions_made_total',
    'Total ML predictions made',
    ['model_type', 'prediction_type'],
    registry=app_registry
)

# Storage Metrics
STORAGE_OPERATIONS = Counter(
    'storage_operations_total',
    'Total storage operations',
    ['operation_type', 'storage_provider', 'status'],
    registry=app_registry
)

STORAGE_OPERATION_DURATION = Histogram(
    'storage_operation_duration_seconds',
    'Storage operation duration in seconds',
    ['operation_type', 'storage_provider'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=app_registry
)

STORAGE_USAGE_BYTES = Gauge(
    'storage_usage_bytes',
    'Storage usage in bytes',
    ['storage_provider', 'user_type'],
    registry=app_registry
)

STORAGE_FILES_COUNT = Gauge(
    'storage_files_count',
    'Number of files in storage',
    ['storage_provider', 'file_type'],
    registry=app_registry
)

# Database Metrics
DATABASE_QUERIES = Counter(
    'database_queries_total',
    'Total database queries',
    ['operation', 'table', 'status'],
    registry=app_registry
)

DATABASE_QUERY_DURATION = Histogram(
    'database_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'table'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
    registry=app_registry
)

DATABASE_CONNECTIONS_ACTIVE = Gauge(
    'database_connections_active',
    'Number of active database connections',
    ['database'],
    registry=app_registry
)

DATABASE_CONNECTIONS_TOTAL = Counter(
    'database_connections_total',
    'Total database connections',
    ['database', 'status'],
    registry=app_registry
)

# Cache Metrics
CACHE_OPERATIONS = Counter(
    'cache_operations_total',
    'Total cache operations',
    ['operation', 'cache_type', 'status'],
    registry=app_registry
)

CACHE_HIT_RATIO = Gauge(
    'cache_hit_ratio',
    'Cache hit ratio',
    ['cache_type'],
    registry=app_registry
)

CACHE_SIZE_BYTES = Gauge(
    'cache_size_bytes',
    'Cache size in bytes',
    ['cache_type'],
    registry=app_registry
)

# Business Metrics
REVENUE_TOTAL = Counter(
    'revenue_total',
    'Total revenue',
    ['currency', 'plan_type'],
    registry=app_registry
)

SUBSCRIPTIONS_ACTIVE = Gauge(
    'subscriptions_active',
    'Number of active subscriptions',
    ['plan_type', 'status'],
    registry=app_registry
)

API_CALLS_TOTAL = Counter(
    'api_calls_total',
    'Total API calls',
    ['endpoint', 'user_type', 'plan_type'],
    registry=app_registry
)

API_RATE_LIMIT_HITS = Counter(
    'api_rate_limit_hits_total',
    'Total API rate limit hits',
    ['endpoint', 'user_type'],
    registry=app_registry
)

# Security Metrics
SECURITY_EVENTS = Counter(
    'security_events_total',
    'Total security events',
    ['event_type', 'severity', 'source'],
    registry=app_registry
)

SECURITY_BREACHES = Counter(
    'security_breaches_total',
    'Total security breaches',
    ['breach_type', 'severity'],
    registry=app_registry
)

SECURITY_SCAN_RESULTS = Gauge(
    'security_scan_results',
    'Security scan results',
    ['scan_type', 'severity'],
    registry=app_registry
)

# System Metrics
SYSTEM_CPU_USAGE = Gauge(
    'system_cpu_usage_percent',
    'CPU usage percentage',
    ['core'],
    registry=app_registry
)

SYSTEM_MEMORY_USAGE = Gauge(
    'system_memory_usage_bytes',
    'Memory usage in bytes',
    ['type'],
    registry=app_registry
)

SYSTEM_DISK_USAGE = Gauge(
    'system_disk_usage_bytes',
    'Disk usage in bytes',
    ['mount_point'],
    registry=app_registry
)

SYSTEM_NETWORK_BYTES = Counter(
    'system_network_bytes_total',
    'Network bytes transferred',
    ['direction', 'interface'],
    registry=app_registry
)

# Application Info
APP_INFO = Info(
    'app',
    'Application information',
    registry=app_registry
)

# Initialize app info
APP_INFO.info({
    'name': 'schlep-engine',
    'version': getattr(settings, 'APP_VERSION', '1.0.0'),
    'environment': getattr(settings, 'ENVIRONMENT', 'development'),
    'language': 'python',
    'framework': 'fastapi'
})

class MetricsCollector:
    """Centralized metrics collection and management"""
    
    def __init__(self):
        self.registry = app_registry
        self.custom_metrics: Dict[str, Any] = {}
    
    def record_http_request(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration: float,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
        user_type: str = "anonymous"
    ) -> None:
        """Record HTTP request metrics"""
        # Record request count
        HTTP_REQUESTS_TOTAL.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code),
            user_type=user_type
        ).inc()
        
        # Record request duration
        HTTP_REQUEST_DURATION.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code)
        ).observe(duration)
        
        # Record request size if available
        if request_size:
            HTTP_REQUEST_SIZE.labels(
                method=method,
                endpoint=endpoint
            ).observe(request_size)
        
        # Record response size if available
        if response_size:
            HTTP_RESPONSE_SIZE.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code)
            ).observe(response_size)
    
    def record_auth_event(
        self,
        event_type: str,
        status: str,
        duration: Optional[float] = None,
        method: str = "password"
    ) -> None:
        """Record authentication event metrics"""
        if event_type == "login":
            AUTH_LOGIN_ATTEMPTS.labels(status=status, method=method).inc()
            if duration:
                AUTH_LOGIN_DURATION.labels(method=method, status=status).observe(duration)
        elif event_type == "failed_attempt":
            AUTH_FAILED_ATTEMPTS.labels(reason=status, ip_address="unknown").inc()
    
    def record_user_activity(
        self,
        user_type: str,
        plan: str = "free",
        action: str = "active"
    ) -> None:
        """Record user activity metrics"""
        if action == "register":
            USERS_REGISTERED.labels(source="web", verification_status="pending").inc()
        elif action == "active":
            USERS_ACTIVE.labels(user_type=user_type, plan=plan).set(1)
        elif action == "online":
            USERS_ONLINE.labels(user_type=user_type).set(1)
    
    def record_data_processing(
        self,
        file_type: str,
        processing_type: str,
        status: str,
        duration: float,
        user_type: str = "user",
        size_category: str = "medium"
    ) -> None:
        """Record data processing metrics"""
        if status == "uploaded":
            DATA_FILES_UPLOADED.labels(
                file_type=file_type,
                size_category=size_category,
                user_type=user_type
            ).inc()
        elif status in ["completed", "failed", "processing"]:
            DATA_FILES_PROCESSED.labels(
                file_type=file_type,
                processing_status=status,
                user_type=user_type
            ).inc()
        
        DATA_PROCESSING_DURATION.labels(
            file_type=file_type,
            processing_type=processing_type,
            status=status
        ).observe(duration)
    
    def record_ml_job(
        self,
        job_type: str,
        model_type: str,
        status: str,
        duration: Optional[float] = None,
        user_type: str = "user"
    ) -> None:
        """Record ML job metrics"""
        if status == "created":
            ML_JOBS_CREATED.labels(
                job_type=job_type,
                model_type=model_type,
                user_type=user_type
            ).inc()
        elif status in ["completed", "failed", "running"]:
            ML_JOBS_COMPLETED.labels(
                job_type=job_type,
                model_type=model_type,
                status=status
            ).inc()
        
        if duration and status == "completed":
            ML_TRAINING_DURATION.labels(
                model_type=model_type,
                dataset_size="medium"
            ).observe(duration)
    
    def record_storage_operation(
        self,
        operation_type: str,
        storage_provider: str,
        status: str,
        duration: float,
        size_bytes: Optional[int] = None
    ) -> None:
        """Record storage operation metrics"""
        STORAGE_OPERATIONS.labels(
            operation_type=operation_type,
            storage_provider=storage_provider,
            status=status
        ).inc()
        
        STORAGE_OPERATION_DURATION.labels(
            operation_type=operation_type,
            storage_provider=storage_provider
        ).observe(duration)
        
        if size_bytes:
            STORAGE_USAGE_BYTES.labels(
                storage_provider=storage_provider,
                user_type="user"
            ).set(size_bytes)
    
    def record_database_operation(
        self,
        operation: str,
        table: str,
        status: str,
        duration: float
    ) -> None:
        """Record database operation metrics"""
        DATABASE_QUERIES.labels(
            operation=operation,
            table=table,
            status=status
        ).inc()
        
        DATABASE_QUERY_DURATION.labels(
            operation=operation,
            table=table
        ).observe(duration)
    
    def record_cache_operation(
        self,
        operation: str,
        cache_type: str,
        status: str,
        hit_ratio: Optional[float] = None
    ) -> None:
        """Record cache operation metrics"""
        CACHE_OPERATIONS.labels(
            operation=operation,
            cache_type=cache_type,
            status=status
        ).inc()
        
        if hit_ratio is not None:
            CACHE_HIT_RATIO.labels(cache_type=cache_type).set(hit_ratio)
    
    def record_business_event(
        self,
        event_type: str,
        amount: Optional[float] = None,
        currency: str = "USD",
        plan_type: str = "free",
        user_type: str = "user"
    ) -> None:
        """Record business event metrics"""
        if event_type == "revenue":
            REVENUE_TOTAL.labels(currency=currency, plan_type=plan_type).inc(amount or 0)
        elif event_type == "subscription":
            SUBSCRIPTIONS_ACTIVE.labels(plan_type=plan_type, status="active").set(1)
        elif event_type == "api_call":
            API_CALLS_TOTAL.labels(
                endpoint="general",
                user_type=user_type,
                plan_type=plan_type
            ).inc()
    
    def record_security_event(
        self,
        event_type: str,
        severity: str,
        source: str
    ) -> None:
        """Record security event metrics"""
        SECURITY_EVENTS.labels(
            event_type=event_type,
            severity=severity,
            source=source
        ).inc()
    
    def record_system_metrics(
        self,
        cpu_usage: float,
        memory_usage: int,
        disk_usage: int,
        network_bytes_sent: int,
        network_bytes_recv: int
    ) -> None:
        """Record system metrics"""
        SYSTEM_CPU_USAGE.labels(core="total").set(cpu_usage)
        SYSTEM_MEMORY_USAGE.labels(type="used").set(memory_usage)
        SYSTEM_DISK_USAGE.labels(mount_point="/").set(disk_usage)
        SYSTEM_NETWORK_BYTES.labels(direction="sent", interface="eth0").inc(network_bytes_sent)
        SYSTEM_NETWORK_BYTES.labels(direction="received", interface="eth0").inc(network_bytes_recv)
    
    def create_custom_metric(
        self,
        name: str,
        metric_type: str,
        description: str,
        labels: List[str]
    ) -> Any:
        """Create a custom metric"""
        if metric_type == "counter":
            metric = Counter(name, description, labels, registry=self.registry)
        elif metric_type == "gauge":
            metric = Gauge(name, description, labels, registry=self.registry)
        elif metric_type == "histogram":
            metric = Histogram(name, description, labels, registry=self.registry)
        elif metric_type == "summary":
            metric = Summary(name, description, labels, registry=self.registry)
        else:
            raise ValueError(f"Unsupported metric type: {metric_type}")
        
        self.custom_metrics[name] = metric
        return metric
    
    def get_metrics(self) -> str:
        """Get all metrics in Prometheus format"""
        return generate_latest(self.registry)
    
    def get_metrics_content_type(self) -> str:
        """Get content type for metrics response"""
        return CONTENT_TYPE_LATEST

# Global metrics collector instance
metrics_collector = MetricsCollector()

# Convenience functions
def record_http_request(
    method: str,
    endpoint: str,
    status_code: int,
    duration: float,
    request_size: Optional[int] = None,
    response_size: Optional[int] = None,
    user_type: str = "anonymous"
) -> None:
    """Record HTTP request metrics"""
    metrics_collector.record_http_request(
        method, endpoint, status_code, duration,
        request_size, response_size, user_type
    )

def record_auth_event(
    event_type: str,
    status: str,
    duration: Optional[float] = None,
    method: str = "password"
) -> None:
    """Record authentication event metrics"""
    metrics_collector.record_auth_event(event_type, status, duration, method)

def record_user_activity(
    user_type: str,
    plan: str = "free",
    action: str = "active"
) -> None:
    """Record user activity metrics"""
    metrics_collector.record_user_activity(user_type, plan, action)

def record_data_processing(
    file_type: str,
    processing_type: str,
    status: str,
    duration: float,
    user_type: str = "user",
    size_category: str = "medium"
) -> None:
    """Record data processing metrics"""
    metrics_collector.record_data_processing(
        file_type, processing_type, status, duration, user_type, size_category
    )

def record_ml_job(
    job_type: str,
    model_type: str,
    status: str,
    duration: Optional[float] = None,
    user_type: str = "user"
) -> None:
    """Record ML job metrics"""
    metrics_collector.record_ml_job(job_type, model_type, status, duration, user_type)

def record_storage_operation(
    operation_type: str,
    storage_provider: str,
    status: str,
    duration: float,
    size_bytes: Optional[int] = None
) -> None:
    """Record storage operation metrics"""
    metrics_collector.record_storage_operation(
        operation_type, storage_provider, status, duration, size_bytes
    )

def record_database_operation(
    operation: str,
    table: str,
    status: str,
    duration: float
) -> None:
    """Record database operation metrics"""
    metrics_collector.record_database_operation(operation, table, status, duration)

def record_cache_operation(
    operation: str,
    cache_type: str,
    status: str,
    hit_ratio: Optional[float] = None
) -> None:
    """Record cache operation metrics"""
    metrics_collector.record_cache_operation(operation, cache_type, status, hit_ratio)

def record_business_event(
    event_type: str,
    amount: Optional[float] = None,
    currency: str = "USD",
    plan_type: str = "free",
    user_type: str = "user"
) -> None:
    """Record business event metrics"""
    metrics_collector.record_business_event(event_type, amount, currency, plan_type, user_type)

def record_security_event(
    event_type: str,
    severity: str,
    source: str
) -> None:
    """Record security event metrics"""
    metrics_collector.record_security_event(event_type, severity, source)

def record_system_metrics(
    cpu_usage: float,
    memory_usage: int,
    disk_usage: int,
    network_bytes_sent: int,
    network_bytes_recv: int
) -> None:
    """Record system metrics"""
    metrics_collector.record_system_metrics(
        cpu_usage, memory_usage, disk_usage, network_bytes_sent, network_bytes_recv
    )

@contextmanager
def measure_time(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """Context manager to measure execution time"""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        # Record the duration in a histogram
        if labels:
            # Create a custom histogram for this metric
            metric = metrics_collector.create_custom_metric(
                f"{metric_name}_duration_seconds",
                "histogram",
                f"Duration of {metric_name}",
                list(labels.keys())
            )
            metric.labels(**labels).observe(duration)
        else:
            # Use a simple histogram
            metric = metrics_collector.create_custom_metric(
                f"{metric_name}_duration_seconds",
                "histogram",
                f"Duration of {metric_name}",
                []
            )
            metric.observe(duration)

def get_metrics() -> str:
    """Get all metrics in Prometheus format"""
    return metrics_collector.get_metrics()

def get_metrics_content_type() -> str:
    """Get content type for metrics response"""
    return metrics_collector.get_metrics_content_type() 