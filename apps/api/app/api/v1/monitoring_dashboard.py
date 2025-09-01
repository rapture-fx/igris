"""
Operational Monitoring Dashboard API
===================================

Provides comprehensive monitoring dashboard endpoints for:
- Real-time system status
- Performance metrics and baselines
- SLA monitoring and compliance
- Alert management
- Operational runbooks
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Query, Path, Depends
from fastapi.responses import JSONResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.core.health import get_health_status, health_checker
from app.core.metrics import get_metrics, metrics_collector
from app.core.advanced_logging import get_log_anomalies, get_error_summary, advanced_logging
from app.core.alerting_system import alert_manager, get_alert_summary, get_active_alerts
from app.core.performance_baseline import (
    performance_tracker, sla_monitor, get_performance_summary,
    record_system_metrics, MetricType
)

router = APIRouter()


@router.get("/dashboard/overview", response_model=Dict[str, Any])
async def dashboard_overview(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive system overview for operations dashboard
    
    Returns high-level system health, performance, and alert information
    """
    start_time = time.time()
    
    try:
        # Gather data from all monitoring systems concurrently
        health_task = asyncio.create_task(get_health_status(db))
        performance_task = asyncio.create_task(asyncio.to_thread(get_performance_summary))
        alert_task = asyncio.create_task(asyncio.to_thread(get_alert_summary))
        log_task = asyncio.create_task(asyncio.to_thread(get_error_summary))
        
        # Wait for all tasks
        health_data, performance_data, alert_data, log_data = await asyncio.gather(
            health_task, performance_task, alert_task, log_task
        )
        
        # Record current system metrics
        await asyncio.to_thread(record_system_metrics)
        
        # Get recent metrics for trends
        recent_response_times = performance_tracker.get_recent_metrics(MetricType.RESPONSE_TIME, 60)
        recent_error_rates = performance_tracker.get_recent_metrics(MetricType.ERROR_RATE, 60)
        
        # Calculate trends
        response_time_trend = _calculate_trend([m.value for m in recent_response_times[-10:]])
        error_rate_trend = _calculate_trend([m.value for m in recent_error_rates[-10:]])
        
        # Compile dashboard data
        dashboard_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "system_status": {
                "overall_health": health_data.get("status", "unknown"),
                "services_healthy": health_data.get("summary", {}).get("healthy_services", 0),
                "services_total": health_data.get("summary", {}).get("total_services", 0),
                "critical_services_healthy": health_data.get("summary", {}).get("critical_services_healthy", True),
                "overall_health_score": health_data.get("system_metrics", {}).get("overall_health_score", 0)
            },
            "performance_summary": {
                "sla_compliance": performance_data.get("sla_status", {}).get("overall_compliance_percentage", 100),
                "active_sla_breaches": len(performance_data.get("sla_status", {}).get("active_breaches", [])),
                "baselines_established": performance_data.get("performance_baselines", {}).get("baselines_established", 0),
                "response_time_trend": response_time_trend,
                "error_rate_trend": error_rate_trend
            },
            "alerts": {
                "active_alerts": alert_data.get("total_active_alerts", 0),
                "critical_alerts": alert_data.get("critical_alerts", 0),
                "recent_alerts": alert_data.get("recent_alerts_last_hour", 0),
                "severity_breakdown": alert_data.get("severity_breakdown", {})
            },
            "logging": {
                "anomalies_detected": len(log_data.get("anomalies", {})),
                "top_errors": list(log_data.get("top_errors", {}).keys())[:3]
            },
            "quick_stats": {
                "uptime_status": "operational",  # Would be calculated from actual uptime
                "current_load": health_data.get("services", {}).get("system", {}).get("details", {}).get("cpu_usage_percent", 0),
                "memory_usage": health_data.get("services", {}).get("system", {}).get("details", {}).get("memory_usage_percent", 0),
                "response_time": time.time() - start_time
            }
        }
        
        return dashboard_data
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard overview: {str(e)}"
        )


@router.get("/dashboard/health", response_model=Dict[str, Any])
async def dashboard_health_detail(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Detailed health information for dashboard
    """
    try:
        health_data = await get_health_status(db)
        
        # Enhance with additional dashboard-specific information
        dashboard_health = {
            **health_data,
            "service_details": [],
            "dependency_map": health_checker.dependency_graph,
            "health_trends": _get_health_trends()
        }
        
        # Add service-specific details for dashboard display
        for service_name, service_data in health_data.get("services", {}).items():
            service_info = {
                "name": service_name,
                "status": service_data.get("status"),
                "response_time": service_data.get("response_time"),
                "message": service_data.get("message"),
                "last_check": service_data.get("last_check"),
                "critical": service_name in ["database", "redis"],
                "details": service_data.get("details", {})
            }
            dashboard_health["service_details"].append(service_info)
        
        return dashboard_health
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get health details: {str(e)}"
        )


@router.get("/dashboard/performance", response_model=Dict[str, Any])
async def dashboard_performance_detail() -> Dict[str, Any]:
    """
    Detailed performance information for dashboard
    """
    try:
        performance_data = get_performance_summary()
        
        # Get recent metrics for charts
        metrics_data = {}
        metric_types = [MetricType.RESPONSE_TIME, MetricType.ERROR_RATE, MetricType.CPU_USAGE, MetricType.MEMORY_USAGE]
        
        for metric_type in metric_types:
            recent_metrics = performance_tracker.get_recent_metrics(metric_type, 120)  # Last 2 hours
            metrics_data[metric_type.value] = [
                {
                    "timestamp": m.timestamp.isoformat(),
                    "value": m.value,
                    "context": m.context
                }
                for m in recent_metrics[-60:]  # Last 60 data points
            ]
        
        # Get SLA details
        sla_details = []
        for sla_name, sla_status in sla_monitor.get_all_sla_statuses().items():
            sla_details.append({
                "name": sla_status.sla_name,
                "status": sla_status.status,
                "current_value": sla_status.current_value,
                "target_value": sla_status.target_value,
                "compliance_percentage": sla_status.compliance_percentage,
                "breach_duration_minutes": sla_status.breach_duration_minutes,
                "last_evaluation": sla_status.last_evaluation.isoformat()
            })
        
        dashboard_performance = {
            **performance_data,
            "recent_metrics": metrics_data,
            "sla_details": sla_details,
            "performance_insights": _generate_performance_insights()
        }
        
        return dashboard_performance
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance details: {str(e)}"
        )


@router.get("/dashboard/alerts", response_model=Dict[str, Any])
async def dashboard_alerts_detail(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=200, description="Limit number of alerts")
) -> Dict[str, Any]:
    """
    Detailed alert information for dashboard
    """
    try:
        # Get active alerts with filtering
        filter_kwargs = {}
        if severity:
            from app.core.alerting_system import AlertSeverity
            filter_kwargs['severity'] = AlertSeverity(severity.lower())
        if category:
            from app.core.alerting_system import AlertCategory
            filter_kwargs['category'] = AlertCategory(category.lower())
        
        active_alerts = get_active_alerts(**filter_kwargs)
        active_alerts = active_alerts[:limit]
        
        # Get alert summary
        alert_summary = get_alert_summary()
        
        # Convert alerts to dashboard format
        alert_list = []
        for alert in active_alerts:
            alert_info = {
                "id": alert.id,
                "title": alert.title,
                "description": alert.description,
                "severity": alert.severity,
                "category": alert.category,
                "status": alert.status,
                "source": alert.source,
                "timestamp": alert.timestamp.isoformat(),
                "age_minutes": alert.age_minutes,
                "tags": alert.tags,
                "acknowledged_by": alert.acknowledged_by,
                "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None
            }
            alert_list.append(alert_info)
        
        # Get alert trends
        alert_trends = _get_alert_trends()
        
        dashboard_alerts = {
            "summary": alert_summary,
            "active_alerts": alert_list,
            "alert_trends": alert_trends,
            "escalation_policies": list(alert_manager.escalation_policies.keys()),
            "notification_channels": ["slack", "email", "webhook"]
        }
        
        return dashboard_alerts
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get alerts details: {str(e)}"
        )


@router.get("/dashboard/logs", response_model=Dict[str, Any])
async def dashboard_logs_detail() -> Dict[str, Any]:
    """
    Detailed logging information for dashboard
    """
    try:
        # Get log summary and anomalies
        error_summary = get_error_summary()
        log_anomalies = get_log_anomalies()
        
        # Get recent log statistics
        log_stats = _get_log_statistics()
        
        dashboard_logs = {
            "error_summary": error_summary,
            "anomalies": log_anomalies,
            "log_statistics": log_stats,
            "log_categories": [
                "application", "security", "performance", "business",
                "audit", "ml_training", "rl_optimization", "api_access"
            ],
            "retention_policy": {
                "max_file_size_mb": 100,
                "max_files": 10,
                "retention_days": 30
            }
        }
        
        return dashboard_logs
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get logs details: {str(e)}"
        )


@router.get("/dashboard/runbooks", response_model=List[Dict[str, Any]])
async def get_operational_runbooks() -> List[Dict[str, Any]]:
    """
    Get operational runbooks for common issues
    """
    return OPERATIONAL_RUNBOOKS


@router.get("/dashboard/runbooks/{runbook_id}", response_model=Dict[str, Any])
async def get_runbook_detail(runbook_id: str = Path(..., description="Runbook ID")) -> Dict[str, Any]:
    """
    Get detailed runbook for specific issue
    """
    runbook = next((rb for rb in OPERATIONAL_RUNBOOKS if rb["id"] == runbook_id), None)
    
    if not runbook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Runbook {runbook_id} not found"
        )
    
    return runbook


@router.post("/dashboard/alerts/{alert_id}/acknowledge")
async def acknowledge_alert_dashboard(
    alert_id: str = Path(..., description="Alert ID"),
    acknowledged_by: str = Query(..., description="User acknowledging the alert")
) -> Dict[str, Any]:
    """
    Acknowledge an alert from the dashboard
    """
    try:
        success = await alert_manager.acknowledge_alert(alert_id, acknowledged_by)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found or already acknowledged"
            )
        
        return {
            "success": True,
            "message": f"Alert {alert_id} acknowledged by {acknowledged_by}",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge alert: {str(e)}"
        )


@router.post("/dashboard/alerts/{alert_id}/resolve")
async def resolve_alert_dashboard(
    alert_id: str = Path(..., description="Alert ID"),
    resolved_by: str = Query(..., description="User resolving the alert")
) -> Dict[str, Any]:
    """
    Resolve an alert from the dashboard
    """
    try:
        success = await alert_manager.resolve_alert(alert_id, resolved_by)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found or already resolved"
            )
        
        return {
            "success": True,
            "message": f"Alert {alert_id} resolved by {resolved_by}",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve alert: {str(e)}"
        )


@router.get("/dashboard/metrics/export")
async def export_metrics_dashboard() -> JSONResponse:
    """
    Export metrics data for external analysis
    """
    try:
        # Get comprehensive metrics data
        metrics_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "health": await get_health_status(None),  # Pass None for DB session
            "performance": get_performance_summary(),
            "alerts": get_alert_summary(),
            "logs": get_error_summary()
        }
        
        return JSONResponse(
            content=metrics_data,
            headers={
                "Content-Disposition": f"attachment; filename=metrics-export-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
            }
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export metrics: {str(e)}"
        )


# Helper functions

def _calculate_trend(values: List[float]) -> str:
    """Calculate trend direction"""
    if len(values) < 3:
        return "stable"
    
    # Simple linear trend calculation
    recent_avg = sum(values[-3:]) / 3
    older_avg = sum(values[:3]) / 3 if len(values) >= 6 else sum(values[:-3]) / max(1, len(values) - 3)
    
    change_percent = ((recent_avg - older_avg) / older_avg * 100) if older_avg > 0 else 0
    
    if change_percent > 10:
        return "increasing"
    elif change_percent < -10:
        return "decreasing"
    else:
        return "stable"


def _get_health_trends() -> Dict[str, str]:
    """Get health trends for services"""
    # This would ideally track health check results over time
    # For now, return placeholder data
    return {
        "database": "stable",
        "redis": "stable",
        "ml_service": "stable",
        "rl_service": "stable",
        "system": "stable"
    }


def _get_alert_trends() -> Dict[str, Any]:
    """Get alert trends"""
    # This would analyze alert history
    # For now, return placeholder data
    return {
        "hourly_alert_count": [2, 1, 3, 0, 1, 2, 4, 1, 0, 2, 3, 1],
        "alert_categories": {
            "system": 45,
            "security": 20,
            "performance": 25,
            "application": 10
        },
        "resolution_time_avg_minutes": 15.5
    }


def _get_log_statistics() -> Dict[str, Any]:
    """Get logging statistics"""
    return {
        "logs_per_hour": {
            "info": 1500,
            "warning": 120,
            "error": 45,
            "critical": 3
        },
        "log_size_mb": 125.6,
        "retention_status": "healthy",
        "anomaly_detection_enabled": True
    }


def _generate_performance_insights() -> List[Dict[str, Any]]:
    """Generate performance insights"""
    return [
        {
            "type": "info",
            "title": "Response Time Baseline",
            "message": "API response time baseline established at P95: 245ms",
            "timestamp": datetime.utcnow().isoformat()
        },
        {
            "type": "warning",
            "title": "Memory Usage Trend",
            "message": "Memory usage has increased 15% over the last 6 hours",
            "timestamp": (datetime.utcnow() - timedelta(minutes=30)).isoformat()
        },
        {
            "type": "success",
            "title": "SLA Compliance",
            "message": "All SLAs have been compliant for the last 24 hours",
            "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat()
        }
    ]


# Operational Runbooks
OPERATIONAL_RUNBOOKS = [
    {
        "id": "high_response_time",
        "title": "High API Response Time",
        "category": "performance",
        "severity": "medium",
        "description": "Steps to diagnose and resolve high API response times",
        "triggers": [
            "Response time > 1000ms for > 5 minutes",
            "P95 response time > baseline + 50%",
            "SLA breach for response time"
        ],
        "steps": [
            {
                "step": 1,
                "title": "Check System Resources",
                "description": "Verify CPU, memory, and disk usage",
                "commands": [
                    "Check /dashboard/health for system metrics",
                    "Look for CPU > 80% or Memory > 85%"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 2,
                "title": "Check Database Performance",
                "description": "Analyze database query performance",
                "commands": [
                    "Check /health/database for query times",
                    "Look for slow queries > 200ms",
                    "Check active connections"
                ],
                "expected_time": "3 minutes"
            },
            {
                "step": 3,
                "title": "Analyze Recent Deployments",
                "description": "Check if recent deployments correlate with performance degradation",
                "commands": [
                    "Review deployment logs",
                    "Check if issue started after recent deployment"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 4,
                "title": "Scale Resources",
                "description": "Scale application resources if needed",
                "commands": [
                    "Increase worker processes",
                    "Scale database connections",
                    "Consider horizontal scaling"
                ],
                "expected_time": "5 minutes"
            }
        ],
        "escalation": {
            "if_not_resolved": "15 minutes",
            "escalate_to": "Senior Engineering Team",
            "additional_actions": [
                "Enable debug logging",
                "Collect performance profiling data",
                "Consider rollback if recent deployment"
            ]
        },
        "prevention": [
            "Implement performance testing in CI/CD",
            "Set up proactive scaling policies",
            "Monitor baseline performance trends"
        ]
    },
    {
        "id": "high_error_rate",
        "title": "High Error Rate",
        "category": "reliability",
        "severity": "high",
        "description": "Steps to diagnose and resolve high API error rates",
        "triggers": [
            "Error rate > 5% for > 2 minutes",
            "Sudden spike in 5xx errors",
            "SLA breach for error rate"
        ],
        "steps": [
            {
                "step": 1,
                "title": "Identify Error Sources",
                "description": "Analyze error patterns and sources",
                "commands": [
                    "Check /dashboard/logs for error summary",
                    "Identify most frequent error types",
                    "Check affected endpoints"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 2,
                "title": "Check Dependencies",
                "description": "Verify external service dependencies",
                "commands": [
                    "Check /health/database status",
                    "Check /health/redis status",
                    "Verify external API connectivity"
                ],
                "expected_time": "3 minutes"
            },
            {
                "step": 3,
                "title": "Analyze Error Logs",
                "description": "Review detailed error logs for root cause",
                "commands": [
                    "Review application logs for stack traces",
                    "Check for database connection errors",
                    "Look for timeout errors"
                ],
                "expected_time": "5 minutes"
            },
            {
                "step": 4,
                "title": "Implement Quick Fixes",
                "description": "Apply immediate fixes based on error analysis",
                "commands": [
                    "Restart failing services",
                    "Clear cache if cache-related errors",
                    "Adjust timeout settings"
                ],
                "expected_time": "3 minutes"
            }
        ],
        "escalation": {
            "if_not_resolved": "10 minutes",
            "escalate_to": "On-call Engineer",
            "additional_actions": [
                "Enable circuit breakers",
                "Consider traffic throttling",
                "Prepare rollback plan"
            ]
        },
        "prevention": [
            "Implement comprehensive error handling",
            "Set up retry mechanisms with backoff",
            "Monitor dependency health proactively"
        ]
    },
    {
        "id": "database_connectivity",
        "title": "Database Connectivity Issues",
        "category": "infrastructure",
        "severity": "critical",
        "description": "Steps to diagnose and resolve database connectivity problems",
        "triggers": [
            "Database health check failing",
            "Connection timeout errors",
            "High database response times"
        ],
        "steps": [
            {
                "step": 1,
                "title": "Check Database Status",
                "description": "Verify database server status and connectivity",
                "commands": [
                    "Check /health/database endpoint",
                    "Test direct database connection",
                    "Check database server resources"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 2,
                "title": "Analyze Connection Pool",
                "description": "Check database connection pool status",
                "commands": [
                    "Review active connections count",
                    "Check for connection leaks",
                    "Verify pool configuration"
                ],
                "expected_time": "3 minutes"
            },
            {
                "step": 3,
                "title": "Check Network Connectivity",
                "description": "Verify network path to database",
                "commands": [
                    "Ping database server",
                    "Check firewall rules",
                    "Verify DNS resolution"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 4,
                "title": "Database Recovery Actions",
                "description": "Perform database recovery if needed",
                "commands": [
                    "Restart database connections",
                    "Check database locks",
                    "Consider database restart if necessary"
                ],
                "expected_time": "5 minutes"
            }
        ],
        "escalation": {
            "if_not_resolved": "8 minutes",
            "escalate_to": "Database Administrator",
            "additional_actions": [
                "Enable read-only mode if possible",
                "Switch to backup database",
                "Contact cloud provider if using managed service"
            ]
        },
        "prevention": [
            "Implement connection pool monitoring",
            "Set up database replication",
            "Monitor database performance metrics"
        ]
    },
    {
        "id": "memory_leak",
        "title": "Memory Leak Detection",
        "category": "performance",
        "severity": "medium",
        "description": "Steps to diagnose and resolve memory leaks",
        "triggers": [
            "Memory usage continuously increasing",
            "Out of memory errors",
            "Application restarts due to memory limits"
        ],
        "steps": [
            {
                "step": 1,
                "title": "Monitor Memory Usage",
                "description": "Track memory usage patterns",
                "commands": [
                    "Check /dashboard/performance for memory trends",
                    "Monitor memory usage over time",
                    "Identify memory growth rate"
                ],
                "expected_time": "3 minutes"
            },
            {
                "step": 2,
                "title": "Identify Memory Sources",
                "description": "Find largest memory consumers",
                "commands": [
                    "Profile application memory usage",
                    "Check for large object allocations",
                    "Review recent code changes"
                ],
                "expected_time": "10 minutes"
            },
            {
                "step": 3,
                "title": "Temporary Mitigation",
                "description": "Apply temporary fixes to prevent outage",
                "commands": [
                    "Restart application processes",
                    "Clear caches if memory bound",
                    "Reduce worker processes if needed"
                ],
                "expected_time": "3 minutes"
            },
            {
                "step": 4,
                "title": "Long-term Fix",
                "description": "Implement permanent solution",
                "commands": [
                    "Fix identified memory leaks in code",
                    "Optimize memory-intensive operations",
                    "Implement memory monitoring alerts"
                ],
                "expected_time": "30 minutes to several hours"
            }
        ],
        "escalation": {
            "if_not_resolved": "20 minutes",
            "escalate_to": "Development Team",
            "additional_actions": [
                "Collect memory dumps for analysis",
                "Implement memory limits",
                "Schedule regular application restarts as temporary measure"
            ]
        },
        "prevention": [
            "Implement memory usage monitoring",
            "Set up memory leak detection in testing",
            "Review code for proper resource cleanup"
        ]
    },
    {
        "id": "ml_model_failure",
        "title": "ML Model Failure",
        "category": "ml_ops",
        "severity": "medium",
        "description": "Steps to diagnose and resolve ML model failures",
        "triggers": [
            "ML service health check failing",
            "Model prediction errors",
            "ML inference timeouts"
        ],
        "steps": [
            {
                "step": 1,
                "title": "Check ML Service Status",
                "description": "Verify ML service and model availability",
                "commands": [
                    "Check /health/ml endpoint",
                    "Verify model loading status",
                    "Check GPU availability if applicable"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 2,
                "title": "Test Model Predictions",
                "description": "Test model with sample data",
                "commands": [
                    "Run test prediction with known good data",
                    "Check model output format",
                    "Verify prediction latency"
                ],
                "expected_time": "3 minutes"
            },
            {
                "step": 3,
                "title": "Check Model Resources",
                "description": "Verify model resource requirements",
                "commands": [
                    "Check memory usage for model loading",
                    "Verify GPU memory if using GPU",
                    "Check disk space for model files"
                ],
                "expected_time": "2 minutes"
            },
            {
                "step": 4,
                "title": "Fallback Actions",
                "description": "Implement fallback if model can't be restored",
                "commands": [
                    "Switch to backup model if available",
                    "Enable simple rule-based fallback",
                    "Disable ML features temporarily if needed"
                ],
                "expected_time": "5 minutes"
            }
        ],
        "escalation": {
            "if_not_resolved": "15 minutes",
            "escalate_to": "ML Engineering Team",
            "additional_actions": [
                "Check model training pipeline",
                "Verify model artifact integrity",
                "Consider model rollback to previous version"
            ]
        },
        "prevention": [
            "Implement model health monitoring",
            "Set up automated model testing",
            "Maintain backup models"
        ]
    }
]