"""
Metrics API endpoints for Schlep-engine
Provides Prometheus metrics for monitoring and alerting
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import time

from app.database.connection import get_db
from app.core.metrics import get_metrics, get_metrics_content_type, metrics_collector
from app.core.logging_config import log_request_start, log_request_end
from app.core.error_tracking import capture_exception, ErrorSeverity, ErrorCategory

router = APIRouter()

@router.get("/metrics")
async def get_prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint
    
    Returns all application metrics in Prometheus format including:
    - HTTP request metrics
    - Authentication metrics
    - User activity metrics
    - Data processing metrics
    - ML pipeline metrics
    - Storage metrics
    - Database metrics
    - Cache metrics
    - Business metrics
    - Security metrics
    - System metrics
    
    Returns:
        Response with Prometheus-formatted metrics
    """
    start_time = time.time()
    request_id = f"metrics_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/metrics")
    
    try:
        # Get metrics in Prometheus format
        metrics_data = get_metrics()
        
        # Record metrics (meta-metrics)
        duration = time.time() - start_time
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/metrics", 200, duration)
        
        # Return metrics with proper content type
        return Response(
            content=metrics_data,
            media_type=get_metrics_content_type(),
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/metrics", 500, duration)
        
        # Capture error for tracking
        capture_exception(
            e,
            severity=ErrorSeverity.HIGH,
            category=ErrorCategory.SYSTEM,
            extra_data={"endpoint": "/metrics"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrics: {str(e)}"
        )

@router.get("/metrics/summary", response_model=Dict[str, Any])
async def get_metrics_summary() -> Dict[str, Any]:
    """
    Metrics summary endpoint
    
    Returns a summary of key metrics for dashboard display including:
    - Request rates and response times
    - Error rates
    - User activity
    - System performance
    - Business metrics
    
    Returns:
        Dict containing metrics summary
    """
    start_time = time.time()
    request_id = f"metrics_summary_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/metrics/summary")
    
    try:
        # Get metrics data
        metrics_data = get_metrics()
        
        # Parse and summarize metrics
        summary = parse_metrics_summary(metrics_data)
        
        # Record metrics
        duration = time.time() - start_time
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics/summary",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/metrics/summary", 200, duration)
        
        return summary
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics/summary",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/metrics/summary", 500, duration)
        
        # Capture error for tracking
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            extra_data={"endpoint": "/metrics/summary"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrics summary: {str(e)}"
        )

@router.get("/metrics/health", response_model=Dict[str, Any])
async def get_metrics_health() -> Dict[str, Any]:
    """
    Metrics health check endpoint
    
    Returns health status of the metrics collection system including:
    - Metrics collection status
    - Available metrics
    - Collection performance
    
    Returns:
        Dict containing metrics health information
    """
    start_time = time.time()
    request_id = f"metrics_health_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/metrics/health")
    
    try:
        # Check metrics collection health
        health_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "metrics_collected": len(metrics_collector.registry._collector_to_names),
            "custom_metrics": len(metrics_collector.custom_metrics),
            "collection_time": time.time() - start_time
        }
        
        # Record metrics
        duration = time.time() - start_time
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics/health",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/metrics/health", 200, duration)
        
        return health_data
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics/health",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/metrics/health", 500, duration)
        
        # Capture error for tracking
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            extra_data={"endpoint": "/metrics/health"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Metrics health check failed: {str(e)}"
        )

@router.post("/metrics/custom")
async def record_custom_metric(metric_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Record custom metric endpoint
    
    Allows recording of custom metrics for business-specific monitoring.
    
    Expected payload:
    {
        "name": "metric_name",
        "type": "counter|gauge|histogram|summary",
        "value": 123.45,
        "labels": {"label1": "value1", "label2": "value2"},
        "description": "Metric description"
    }
    
    Returns:
        Dict containing operation status
    """
    start_time = time.time()
    request_id = f"metrics_custom_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "POST", "/metrics/custom")
    
    try:
        # Validate metric data
        required_fields = ["name", "type", "value"]
        for field in required_fields:
            if field not in metric_data:
                raise ValueError(f"Missing required field: {field}")
        
        metric_name = metric_data["name"]
        metric_type = metric_data["type"]
        metric_value = metric_data["value"]
        labels = metric_data.get("labels", {})
        description = metric_data.get("description", f"Custom metric: {metric_name}")
        
        # Create or update custom metric
        if metric_name not in metrics_collector.custom_metrics:
            # Create new metric
            metric = metrics_collector.create_custom_metric(
                name=metric_name,
                metric_type=metric_type,
                description=description,
                labels=list(labels.keys())
            )
        else:
            metric = metrics_collector.custom_metrics[metric_name]
        
        # Record the metric value
        if metric_type == "counter":
            if labels:
                metric.labels(**labels).inc(metric_value)
            else:
                metric.inc(metric_value)
        elif metric_type == "gauge":
            if labels:
                metric.labels(**labels).set(metric_value)
            else:
                metric.set(metric_value)
        elif metric_type == "histogram":
            if labels:
                metric.labels(**labels).observe(metric_value)
            else:
                metric.observe(metric_value)
        elif metric_type == "summary":
            if labels:
                metric.labels(**labels).observe(metric_value)
            else:
                metric.observe(metric_value)
        
        # Record metrics
        duration = time.time() - start_time
        metrics_collector.record_http_request(
            method="POST",
            endpoint="/metrics/custom",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "POST", "/metrics/custom", 200, duration)
        
        return {"status": "success", "message": f"Custom metric '{metric_name}' recorded successfully"}
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics_collector.record_http_request(
            method="POST",
            endpoint="/metrics/custom",
            status_code=400,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "POST", "/metrics/custom", 400, duration)
        
        # Capture error for tracking
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.VALIDATION,
            extra_data={"endpoint": "/metrics/custom", "metric_data": metric_data}
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to record custom metric: {str(e)}"
        )

@router.get("/metrics/custom", response_model=List[Dict[str, Any]])
async def list_custom_metrics() -> List[Dict[str, Any]]:
    """
    List custom metrics endpoint
    
    Returns information about all custom metrics that have been created.
    
    Returns:
        List of custom metric information
    """
    start_time = time.time()
    request_id = f"metrics_custom_list_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/metrics/custom")
    
    try:
        # Get custom metrics information
        custom_metrics_info = []
        for name, metric in metrics_collector.custom_metrics.items():
            metric_info = {
                "name": name,
                "type": type(metric).__name__.lower(),
                "description": getattr(metric, '_documentation', f"Custom metric: {name}"),
                "labels": getattr(metric, '_labelnames', [])
            }
            custom_metrics_info.append(metric_info)
        
        # Record metrics
        duration = time.time() - start_time
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics/custom",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/metrics/custom", 200, duration)
        
        return custom_metrics_info
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics_collector.record_http_request(
            method="GET",
            endpoint="/metrics/custom",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/metrics/custom", 500, duration)
        
        # Capture error for tracking
        capture_exception(
            e,
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            extra_data={"endpoint": "/metrics/custom"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list custom metrics: {str(e)}"
        )

def parse_metrics_summary(metrics_data: str) -> Dict[str, Any]:
    """
    Parse Prometheus metrics and create a summary
    
    Args:
        metrics_data: Raw Prometheus metrics data
        
    Returns:
        Dict containing metrics summary
    """
    summary = {
        "timestamp": time.time(),
        "http_requests": {
            "total": 0,
            "success_rate": 0.0,
            "avg_response_time": 0.0
        },
        "users": {
            "active": 0,
            "online": 0,
            "registered": 0
        },
        "data_processing": {
            "files_uploaded": 0,
            "files_processed": 0,
            "processing_errors": 0
        },
        "ml_pipeline": {
            "jobs_created": 0,
            "jobs_completed": 0,
            "predictions_made": 0
        },
        "system": {
            "cpu_usage": 0.0,
            "memory_usage": 0,
            "disk_usage": 0
        },
        "business": {
            "revenue": 0.0,
            "subscriptions": 0,
            "api_calls": 0
        }
    }
    
    try:
        # Parse metrics data (simplified parsing)
        lines = metrics_data.split('\n')
        
        for line in lines:
            if line.startswith('#') or not line.strip():
                continue
            
            # Parse metric line
            parts = line.split(' ')
            if len(parts) >= 2:
                metric_name = parts[0]
                metric_value = float(parts[1])
                
                # Categorize and summarize metrics
                if 'http_requests_total' in metric_name:
                    summary["http_requests"]["total"] += int(metric_value)
                elif 'users_active' in metric_name:
                    summary["users"]["active"] = max(summary["users"]["active"], int(metric_value))
                elif 'users_online' in metric_name:
                    summary["users"]["online"] = max(summary["users"]["online"], int(metric_value))
                elif 'data_files_uploaded_total' in metric_name:
                    summary["data_processing"]["files_uploaded"] += int(metric_value)
                elif 'data_files_processed_total' in metric_name:
                    summary["data_processing"]["files_processed"] += int(metric_value)
                elif 'ml_jobs_created_total' in metric_name:
                    summary["ml_pipeline"]["jobs_created"] += int(metric_value)
                elif 'ml_jobs_completed_total' in metric_name:
                    summary["ml_pipeline"]["jobs_completed"] += int(metric_value)
                elif 'system_cpu_usage_percent' in metric_name:
                    summary["system"]["cpu_usage"] = max(summary["system"]["cpu_usage"], metric_value)
                elif 'revenue_total' in metric_name:
                    summary["business"]["revenue"] += metric_value
                elif 'api_calls_total' in metric_name:
                    summary["business"]["api_calls"] += int(metric_value)
        
        # Calculate derived metrics
        if summary["http_requests"]["total"] > 0:
            # This is a simplified calculation - in practice, you'd need more sophisticated logic
            summary["http_requests"]["success_rate"] = 95.0  # Placeholder
            summary["http_requests"]["avg_response_time"] = 0.5  # Placeholder
        
    except Exception as e:
        # If parsing fails, return basic summary
        summary["error"] = f"Failed to parse metrics: {str(e)}"
    
    return summary 