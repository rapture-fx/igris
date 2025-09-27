"""
Real-time Metrics Dashboard API
Provides customer-facing real-time metrics and SLA visibility.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import asyncio
import json
import logging
from dataclasses import asdict

from app.monitoring.sla_monitoring import SLAMonitor
from app.middleware.streaming_enforcement import StreamingEnforcement
from app.middleware.ml_framework_enforcement import MLFrameworkEnforcement
from app.middleware.billing_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])

# WebSocket connections for real-time updates
active_connections: Dict[str, List[WebSocket]] = {}

@router.get("/dashboard/{customer_id}")
async def get_customer_dashboard(
    customer_id: str,
    time_range: str = Query("1h", description="Time range: 1h, 6h, 24h, 7d"),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive dashboard data for a customer"""

    # Verify customer access
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Initialize monitoring services (would normally be dependency injected)
    sla_monitor = SLAMonitor(
        database_url="sqlite:///./sla_monitoring.db",
        redis_url="redis://localhost:6379"
    )

    streaming_enforcement = StreamingEnforcement(
        database_url="sqlite:///./streaming_enforcement.db",
        redis_url="redis://localhost:6379"
    )

    ml_enforcement = MLFrameworkEnforcement(
        database_url="sqlite:///./ml_enforcement.db",
        redis_url="redis://localhost:6379"
    )

    await sla_monitor.start()

    try:
        # Get SLA dashboard data
        sla_data = await sla_monitor.get_sla_dashboard_data(customer_id)

        # Get streaming status
        streaming_status = await streaming_enforcement.get_customer_streaming_status(customer_id)

        # Get ML status
        plan_tier = current_user.get("plan_tier", "developer")
        ml_status = await ml_enforcement.get_customer_ml_status(customer_id, plan_tier)

        # Calculate time range
        time_ranges = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7)
        }

        end_time = datetime.utcnow()
        start_time = end_time - time_ranges.get(time_range, timedelta(hours=1))

        dashboard_data = {
            "customer_id": customer_id,
            "plan_tier": plan_tier,
            "time_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
                "duration": time_range
            },
            "overall_health": sla_data.get("overall_health", "healthy"),
            "sla": {
                "services": sla_data.get("services", {}),
                "active_alerts": sla_data.get("active_alerts", []),
                "recent_metrics": sla_data.get("recent_metrics", [])
            },
            "streaming": {
                "active_connections": streaming_status.get("active_connections", 0),
                "max_connections": streaming_status.get("max_connections", 0),
                "connections": streaming_status.get("connections", []),
                "daily_usage": streaming_status.get("daily_usage", {}),
                "limits": streaming_status.get("limits", {})
            },
            "ml": {
                "active_jobs": ml_status.get("active_jobs", 0),
                "allowed_frameworks": ml_status.get("allowed_frameworks", []),
                "daily_usage": ml_status.get("daily_usage", {}),
                "current_limits": ml_status.get("current_limits", {}),
                "feature_access": ml_status.get("feature_access", {}),
                "recent_activity": ml_status.get("recent_activity", [])
            },
            "performance_summary": await _get_performance_summary(customer_id, start_time, end_time),
            "usage_trends": await _get_usage_trends(customer_id, start_time, end_time),
            "quota_utilization": await _get_quota_utilization(customer_id, plan_tier)
        }

        return JSONResponse(content=dashboard_data)

    finally:
        await sla_monitor.stop()

@router.get("/health/{customer_id}")
async def get_service_health(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current service health status"""

    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    sla_monitor = SLAMonitor(
        database_url="sqlite:///./sla_monitoring.db",
        redis_url="redis://localhost:6379"
    )

    await sla_monitor.start()

    try:
        sla_data = await sla_monitor.get_sla_dashboard_data(customer_id)

        health_status = {
            "customer_id": customer_id,
            "overall_health": sla_data.get("overall_health", "healthy"),
            "services": sla_data.get("services", {}),
            "active_alerts": len(sla_data.get("active_alerts", [])),
            "timestamp": datetime.utcnow().isoformat()
        }

        return JSONResponse(content=health_status)

    finally:
        await sla_monitor.stop()

@router.get("/usage/{customer_id}")
async def get_usage_metrics(
    customer_id: str,
    metric_type: str = Query(..., description="Type: api, streaming, ml, storage"),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed usage metrics by type"""

    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    plan_tier = current_user.get("plan_tier", "developer")

    usage_data = {}

    if metric_type == "api":
        usage_data = await _get_api_usage_metrics(customer_id)
    elif metric_type == "streaming":
        streaming_enforcement = StreamingEnforcement(
            database_url="sqlite:///./streaming_enforcement.db",
            redis_url="redis://localhost:6379"
        )
        usage_data = await streaming_enforcement.get_customer_streaming_status(customer_id)
    elif metric_type == "ml":
        ml_enforcement = MLFrameworkEnforcement(
            database_url="sqlite:///./ml_enforcement.db",
            redis_url="redis://localhost:6379"
        )
        usage_data = await ml_enforcement.get_customer_ml_status(customer_id, plan_tier)
    elif metric_type == "storage":
        usage_data = await _get_storage_usage_metrics(customer_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid metric type")

    return JSONResponse(content={
        "customer_id": customer_id,
        "metric_type": metric_type,
        "data": usage_data,
        "timestamp": datetime.utcnow().isoformat()
    })

@router.get("/alerts/{customer_id}")
async def get_customer_alerts(
    customer_id: str,
    status: Optional[str] = Query(None, description="Filter by status: active, resolved"),
    severity: Optional[str] = Query(None, description="Filter by severity: info, warning, critical, emergency"),
    limit: int = Query(50, description="Number of alerts to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get customer alerts with optional filtering"""

    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    sla_monitor = SLAMonitor(
        database_url="sqlite:///./sla_monitoring.db",
        redis_url="redis://localhost:6379"
    )

    await sla_monitor.start()

    try:
        # Query alerts from database with filters
        with sla_monitor.SessionLocal() as session:
            from app.monitoring.sla_monitoring import SLAAlert

            query = session.query(SLAAlert).filter(
                SLAAlert.customer_id == customer_id
            )

            if status == "active":
                query = query.filter(SLAAlert.is_resolved == False)
            elif status == "resolved":
                query = query.filter(SLAAlert.is_resolved == True)

            if severity:
                query = query.filter(SLAAlert.severity == severity)

            alerts = query.order_by(
                SLAAlert.triggered_at.desc()
            ).limit(limit).all()

            alerts_data = [
                {
                    "id": alert.id,
                    "service_name": alert.service_name,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "title": alert.title,
                    "description": alert.description,
                    "triggered_at": alert.triggered_at.isoformat(),
                    "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                    "is_resolved": alert.is_resolved,
                    "metadata": alert.metadata
                }
                for alert in alerts
            ]

        return JSONResponse(content={
            "customer_id": customer_id,
            "alerts": alerts_data,
            "total": len(alerts_data),
            "filters": {
                "status": status,
                "severity": severity,
                "limit": limit
            }
        })

    finally:
        await sla_monitor.stop()

@router.websocket("/live/{customer_id}")
async def websocket_live_metrics(websocket: WebSocket, customer_id: str):
    """WebSocket endpoint for real-time metrics updates"""

    await websocket.accept()

    # Add to active connections
    if customer_id not in active_connections:
        active_connections[customer_id] = []
    active_connections[customer_id].append(websocket)

    try:
        while True:
            # Send live metrics every 5 seconds
            metrics_data = await _get_live_metrics(customer_id)
            await websocket.send_text(json.dumps(metrics_data))
            await asyncio.sleep(5)

    except WebSocketDisconnect:
        # Remove from active connections
        if customer_id in active_connections:
            active_connections[customer_id].remove(websocket)
            if not active_connections[customer_id]:
                del active_connections[customer_id]

@router.get("/export/{customer_id}")
async def export_metrics(
    customer_id: str,
    format: str = Query("json", description="Export format: json, csv"),
    time_range: str = Query("24h", description="Time range: 1h, 6h, 24h, 7d"),
    current_user: dict = Depends(get_current_user)
):
    """Export metrics data in various formats"""

    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Calculate time range
    time_ranges = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7)
    }

    end_time = datetime.utcnow()
    start_time = end_time - time_ranges.get(time_range, timedelta(hours=24))

    # Get comprehensive metrics data
    export_data = await _get_export_data(customer_id, start_time, end_time)

    if format == "csv":
        # Convert to CSV format
        csv_data = _convert_to_csv(export_data)
        return JSONResponse(
            content={"csv_data": csv_data},
            headers={"Content-Type": "text/csv"}
        )
    else:
        return JSONResponse(content=export_data)

# Helper functions

async def _get_performance_summary(customer_id: str, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
    """Get performance summary for the time range"""
    return {
        "avg_response_time": 0.5,  # Mock data
        "p95_response_time": 1.2,
        "p99_response_time": 2.1,
        "total_requests": 10000,
        "error_rate": 0.5,
        "uptime_percentage": 99.9
    }

async def _get_usage_trends(customer_id: str, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
    """Get usage trends over time"""
    return {
        "api_calls": {
            "trend": "increasing",
            "percentage_change": 15.2,
            "daily_average": 1250
        },
        "data_processed": {
            "trend": "stable",
            "percentage_change": 2.1,
            "daily_average_gb": 12.5
        },
        "ml_jobs": {
            "trend": "increasing",
            "percentage_change": 45.3,
            "daily_average": 8
        }
    }

async def _get_quota_utilization(customer_id: str, plan_tier: str) -> Dict[str, Any]:
    """Get current quota utilization"""
    return {
        "api_requests": {
            "used": 8500,
            "limit": 10000,
            "percentage": 85.0,
            "reset_date": (datetime.utcnow() + timedelta(days=5)).isoformat()
        },
        "data_processing": {
            "used_gb": 45.2,
            "limit_gb": 50.0,
            "percentage": 90.4,
            "reset_date": (datetime.utcnow() + timedelta(days=5)).isoformat()
        },
        "ml_training_jobs": {
            "used": 12,
            "limit": 50,
            "percentage": 24.0,
            "reset_date": (datetime.utcnow() + timedelta(days=1)).isoformat()
        }
    }

async def _get_api_usage_metrics(customer_id: str) -> Dict[str, Any]:
    """Get API usage metrics"""
    return {
        "total_requests": 10000,
        "requests_by_endpoint": {
            "/api/v1/data": 4500,
            "/api/v1/ml": 3200,
            "/api/v1/stream": 2300
        },
        "status_codes": {
            "2xx": 9500,
            "4xx": 400,
            "5xx": 100
        },
        "avg_response_time": 0.5,
        "p95_response_time": 1.2
    }

async def _get_storage_usage_metrics(customer_id: str) -> Dict[str, Any]:
    """Get storage usage metrics"""
    return {
        "total_storage_gb": 125.4,
        "storage_by_type": {
            "raw_data": 80.2,
            "processed_data": 35.1,
            "models": 10.1
        },
        "monthly_transfer_gb": 450.2,
        "backup_size_gb": 95.3
    }

async def _get_live_metrics(customer_id: str) -> Dict[str, Any]:
    """Get current live metrics for WebSocket"""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "customer_id": customer_id,
        "current_api_rate": 125.4,  # requests per minute
        "active_connections": 3,
        "cpu_usage": 45.2,
        "memory_usage": 67.8,
        "recent_errors": 0,
        "health_status": "healthy"
    }

async def _get_export_data(customer_id: str, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
    """Get comprehensive data for export"""
    return {
        "customer_id": customer_id,
        "export_range": {
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "api_metrics": await _get_api_usage_metrics(customer_id),
        "performance_summary": await _get_performance_summary(customer_id, start_time, end_time),
        "usage_trends": await _get_usage_trends(customer_id, start_time, end_time),
        "quota_utilization": await _get_quota_utilization(customer_id, "growth")
    }

def _convert_to_csv(data: Dict[str, Any]) -> str:
    """Convert metrics data to CSV format"""
    import csv
    import io

    output = io.StringIO()
    writer = csv.writer(output)

    # Write headers
    writer.writerow(["Metric", "Value", "Category"])

    # Flatten the data structure for CSV
    def flatten_dict(d, prefix=""):
        for key, value in d.items():
            if isinstance(value, dict):
                yield from flatten_dict(value, f"{prefix}{key}.")
            else:
                yield f"{prefix}{key}", value

    for metric, value in flatten_dict(data):
        category = metric.split('.')[0] if '.' in metric else "general"
        writer.writerow([metric, value, category])

    return output.getvalue()

# Background task to send real-time updates
async def broadcast_metrics_update(customer_id: str, metrics_data: Dict[str, Any]):
    """Broadcast metrics update to all connected WebSocket clients for a customer"""
    if customer_id in active_connections:
        disconnected = []
        for websocket in active_connections[customer_id]:
            try:
                await websocket.send_text(json.dumps(metrics_data))
            except:
                disconnected.append(websocket)

        # Remove disconnected clients
        for ws in disconnected:
            active_connections[customer_id].remove(ws)