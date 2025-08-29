"""
Reinforcement Learning Monitoring and Observability System

This module provides comprehensive monitoring, logging, and observability
for RL optimization sessions, including real-time metrics, performance
tracking, and automated alerting.
"""

import logging
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import defaultdict, deque
import threading
import time
import os
from enum import Enum

import redis
import psutil
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest

logger = logging.getLogger(__name__)


class AlertLevel(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    ERROR = "error"


class MetricType(str, Enum):
    """Types of metrics tracked."""
    PERFORMANCE = "performance"
    RESOURCE = "resource"
    TRAINING = "training"
    BUSINESS = "business"
    SYSTEM = "system"


@dataclass
class RLAlert:
    """Represents an RL monitoring alert."""
    alert_id: str
    session_id: str
    alert_type: str
    level: AlertLevel
    message: str
    metric_value: float
    threshold: float
    timestamp: datetime
    acknowledged: bool = False
    resolved: bool = False


@dataclass
class RLMetric:
    """Represents a tracked RL metric."""
    name: str
    value: Union[float, int, str]
    metric_type: MetricType
    session_id: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    tags: Optional[Dict[str, str]] = None


class RLPerformanceMonitor:
    """
    Real-time performance monitor for RL training sessions.
    
    Tracks training metrics, resource utilization, and performance indicators
    with automated alerting and anomaly detection.
    """
    
    def __init__(self, 
                 redis_client=None,
                 enable_prometheus: bool = True,
                 alert_thresholds: Optional[Dict[str, Any]] = None):
        self.redis_client = redis_client
        self.enable_prometheus = enable_prometheus
        
        # Default alert thresholds
        self.alert_thresholds = alert_thresholds or {
            "memory_usage_percent": 85.0,
            "cpu_usage_percent": 90.0,
            "episode_duration_seconds": 1800,  # 30 minutes
            "no_improvement_episodes": 20,
            "training_error_rate": 0.1,
            "reward_variance_threshold": 0.5
        }
        
        # Monitoring state
        self.active_sessions = {}
        self.session_metrics = defaultdict(lambda: defaultdict(deque))
        self.alerts = defaultdict(list)
        self.monitoring_threads = {}
        
        # Prometheus metrics (if enabled)
        if self.enable_prometheus:
            self.registry = CollectorRegistry()
            self._setup_prometheus_metrics()
        
        # Performance tracking
        self.metric_history = defaultdict(list)
        self.alert_history = []
        
        logger.info("Initialized RL Performance Monitor")
    
    def _setup_prometheus_metrics(self):
        """Setup Prometheus metrics for RL monitoring."""
        self.prometheus_metrics = {
            'episode_reward': Histogram('rl_episode_reward', 'Episode reward distribution', 
                                      ['session_id', 'agent_type'], registry=self.registry),
            'episode_duration': Histogram('rl_episode_duration_seconds', 'Episode duration', 
                                        ['session_id', 'agent_type'], registry=self.registry),
            'training_loss': Gauge('rl_training_loss', 'Training loss', 
                                 ['session_id', 'agent_type'], registry=self.registry),
            'memory_usage': Gauge('rl_memory_usage_bytes', 'Memory usage', 
                                ['session_id'], registry=self.registry),
            'cpu_usage': Gauge('rl_cpu_usage_percent', 'CPU usage percentage', 
                             ['session_id'], registry=self.registry),
            'active_sessions': Gauge('rl_active_sessions_total', 'Number of active sessions', 
                                   registry=self.registry),
            'total_alerts': Counter('rl_alerts_total', 'Total alerts generated', 
                                  ['level', 'type'], registry=self.registry)
        }
    
    def start_session_monitoring(self, session_id: str, session_config: Dict[str, Any]):
        """Start monitoring an RL training session."""
        logger.info(f"Starting monitoring for session {session_id}")
        
        self.active_sessions[session_id] = {
            "start_time": datetime.now(),
            "config": session_config,
            "status": "running",
            "episode_count": 0,
            "last_metric_update": datetime.now(),
            "performance_summary": {}
        }
        
        # Start monitoring thread
        monitor_thread = threading.Thread(
            target=self._monitor_session_loop,
            args=(session_id,),
            daemon=True
        )
        monitor_thread.start()
        self.monitoring_threads[session_id] = monitor_thread
        
        # Update Prometheus metrics
        if self.enable_prometheus:
            self.prometheus_metrics['active_sessions'].set(len(self.active_sessions))
    
    def stop_session_monitoring(self, session_id: str):
        """Stop monitoring an RL training session."""
        if session_id in self.active_sessions:
            self.active_sessions[session_id]["status"] = "stopped"
            self.active_sessions[session_id]["end_time"] = datetime.now()
            
            # Stop monitoring thread
            if session_id in self.monitoring_threads:
                # Thread will stop on next iteration due to status change
                pass
            
            logger.info(f"Stopped monitoring for session {session_id}")
            
            # Update Prometheus metrics
            if self.enable_prometheus:
                self.prometheus_metrics['active_sessions'].set(len([
                    s for s in self.active_sessions.values() if s["status"] == "running"
                ]))
    
    def record_metric(self, session_id: str, metric: RLMetric):
        """Record a metric for monitoring."""
        # Store in memory
        self.session_metrics[session_id][metric.name].append({
            "value": metric.value,
            "timestamp": metric.timestamp,
            "metadata": metric.metadata,
            "tags": metric.tags
        })
        
        # Keep only recent metrics (last 1000 points per metric)
        if len(self.session_metrics[session_id][metric.name]) > 1000:
            self.session_metrics[session_id][metric.name].popleft()
        
        # Store in Redis if available
        if self.redis_client:
            try:
                metric_key = f"rl_metrics:{session_id}:{metric.name}"
                metric_data = {
                    "value": metric.value,
                    "timestamp": metric.timestamp.isoformat(),
                    "metric_type": metric.metric_type,
                    "metadata": json.dumps(metric.metadata or {}),
                    "tags": json.dumps(metric.tags or {})
                }
                self.redis_client.lpush(metric_key, json.dumps(metric_data))
                self.redis_client.ltrim(metric_key, 0, 999)  # Keep last 1000
            except Exception as e:
                logger.error(f"Failed to store metric in Redis: {e}")
        
        # Update Prometheus metrics
        if self.enable_prometheus:
            self._update_prometheus_metric(session_id, metric)
        
        # Check for alerts
        self._check_metric_alerts(session_id, metric)
        
        # Update session info
        if session_id in self.active_sessions:
            self.active_sessions[session_id]["last_metric_update"] = datetime.now()
    
    def _update_prometheus_metric(self, session_id: str, metric: RLMetric):
        """Update Prometheus metrics based on recorded metric."""
        try:
            session_config = self.active_sessions.get(session_id, {}).get("config", {})
            agent_type = session_config.get("agent_type", "unknown")
            
            if metric.name == "episode_reward":
                self.prometheus_metrics['episode_reward'].labels(
                    session_id=session_id, agent_type=agent_type
                ).observe(float(metric.value))
            elif metric.name == "episode_duration":
                self.prometheus_metrics['episode_duration'].labels(
                    session_id=session_id, agent_type=agent_type
                ).observe(float(metric.value))
            elif metric.name == "training_loss":
                self.prometheus_metrics['training_loss'].labels(
                    session_id=session_id, agent_type=agent_type
                ).set(float(metric.value))
            elif metric.name == "memory_usage_bytes":
                self.prometheus_metrics['memory_usage'].labels(
                    session_id=session_id
                ).set(float(metric.value))
            elif metric.name == "cpu_usage_percent":
                self.prometheus_metrics['cpu_usage'].labels(
                    session_id=session_id
                ).set(float(metric.value))
        except Exception as e:
            logger.error(f"Failed to update Prometheus metric: {e}")
    
    def _monitor_session_loop(self, session_id: str):
        """Main monitoring loop for a session."""
        logger.info(f"Starting monitoring loop for session {session_id}")
        
        while (session_id in self.active_sessions and 
               self.active_sessions[session_id]["status"] == "running"):
            
            try:
                # Collect system metrics
                self._collect_system_metrics(session_id)
                
                # Check for anomalies
                self._detect_anomalies(session_id)
                
                # Update performance summary
                self._update_performance_summary(session_id)
                
                # Sleep before next iteration
                time.sleep(10)  # Monitor every 10 seconds
                
            except Exception as e:
                logger.error(f"Error in monitoring loop for session {session_id}: {e}")
                time.sleep(30)  # Wait longer on error
        
        logger.info(f"Monitoring loop ended for session {session_id}")
    
    def _collect_system_metrics(self, session_id: str):
        """Collect system resource metrics."""
        try:
            # Memory usage
            memory_info = psutil.virtual_memory()
            memory_metric = RLMetric(
                name="memory_usage_bytes",
                value=memory_info.used,
                metric_type=MetricType.RESOURCE,
                session_id=session_id,
                timestamp=datetime.now(),
                metadata={"total": memory_info.total, "percent": memory_info.percent}
            )
            self.record_metric(session_id, memory_metric)
            
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_metric = RLMetric(
                name="cpu_usage_percent",
                value=cpu_percent,
                metric_type=MetricType.RESOURCE,
                session_id=session_id,
                timestamp=datetime.now(),
                metadata={"cpu_count": psutil.cpu_count()}
            )
            self.record_metric(session_id, cpu_metric)
            
            # Disk I/O
            disk_io = psutil.disk_io_counters()
            if disk_io:
                disk_metric = RLMetric(
                    name="disk_io_bytes",
                    value=disk_io.read_bytes + disk_io.write_bytes,
                    metric_type=MetricType.RESOURCE,
                    session_id=session_id,
                    timestamp=datetime.now(),
                    metadata={"read_bytes": disk_io.read_bytes, "write_bytes": disk_io.write_bytes}
                )
                self.record_metric(session_id, disk_metric)
            
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
    
    def _check_metric_alerts(self, session_id: str, metric: RLMetric):
        """Check if metric triggers any alerts."""
        alerts_triggered = []
        
        try:
            if metric.name == "memory_usage_bytes" and metric.metadata:
                memory_percent = metric.metadata.get("percent", 0)
                if memory_percent > self.alert_thresholds["memory_usage_percent"]:
                    alert = RLAlert(
                        alert_id=f"mem_{session_id}_{int(datetime.now().timestamp())}",
                        session_id=session_id,
                        alert_type="high_memory_usage",
                        level=AlertLevel.WARNING,
                        message=f"High memory usage: {memory_percent:.1f}%",
                        metric_value=memory_percent,
                        threshold=self.alert_thresholds["memory_usage_percent"],
                        timestamp=datetime.now()
                    )
                    alerts_triggered.append(alert)
            
            elif metric.name == "cpu_usage_percent":
                if metric.value > self.alert_thresholds["cpu_usage_percent"]:
                    alert = RLAlert(
                        alert_id=f"cpu_{session_id}_{int(datetime.now().timestamp())}",
                        session_id=session_id,
                        alert_type="high_cpu_usage",
                        level=AlertLevel.WARNING,
                        message=f"High CPU usage: {metric.value:.1f}%",
                        metric_value=metric.value,
                        threshold=self.alert_thresholds["cpu_usage_percent"],
                        timestamp=datetime.now()
                    )
                    alerts_triggered.append(alert)
            
            elif metric.name == "episode_duration":
                if metric.value > self.alert_thresholds["episode_duration_seconds"]:
                    alert = RLAlert(
                        alert_id=f"duration_{session_id}_{int(datetime.now().timestamp())}",
                        session_id=session_id,
                        alert_type="long_episode_duration",
                        level=AlertLevel.INFO,
                        message=f"Long episode duration: {metric.value:.1f} seconds",
                        metric_value=metric.value,
                        threshold=self.alert_thresholds["episode_duration_seconds"],
                        timestamp=datetime.now()
                    )
                    alerts_triggered.append(alert)
            
            # Store alerts
            for alert in alerts_triggered:
                self.alerts[session_id].append(alert)
                self.alert_history.append(alert)
                
                # Update Prometheus counter
                if self.enable_prometheus:
                    self.prometheus_metrics['total_alerts'].labels(
                        level=alert.level, type=alert.alert_type
                    ).inc()
                
                logger.warning(f"Alert triggered: {alert.message}")
        
        except Exception as e:
            logger.error(f"Error checking alerts: {e}")
    
    def _detect_anomalies(self, session_id: str):
        """Detect anomalies in training metrics."""
        try:
            # Check for no improvement in recent episodes
            if "episode_reward" in self.session_metrics[session_id]:
                recent_rewards = list(self.session_metrics[session_id]["episode_reward"])[-20:]
                if len(recent_rewards) >= 10:
                    reward_values = [r["value"] for r in recent_rewards]
                    if len(set(reward_values)) == 1:  # All rewards are identical
                        alert = RLAlert(
                            alert_id=f"stagnant_{session_id}_{int(datetime.now().timestamp())}",
                            session_id=session_id,
                            alert_type="training_stagnation",
                            level=AlertLevel.WARNING,
                            message="Training appears to have stagnated - no reward variation",
                            metric_value=reward_values[0],
                            threshold=0,
                            timestamp=datetime.now()
                        )
                        self.alerts[session_id].append(alert)
                        self.alert_history.append(alert)
            
            # Check for high reward variance (unstable training)
            if "episode_reward" in self.session_metrics[session_id]:
                recent_rewards = list(self.session_metrics[session_id]["episode_reward"])[-10:]
                if len(recent_rewards) >= 5:
                    reward_values = [r["value"] for r in recent_rewards]
                    reward_std = np.std(reward_values)
                    reward_mean = np.mean(reward_values)
                    
                    if reward_mean != 0 and abs(reward_std / reward_mean) > self.alert_thresholds["reward_variance_threshold"]:
                        alert = RLAlert(
                            alert_id=f"unstable_{session_id}_{int(datetime.now().timestamp())}",
                            session_id=session_id,
                            alert_type="training_instability",
                            level=AlertLevel.WARNING,
                            message=f"High reward variance detected: std/mean = {abs(reward_std/reward_mean):.3f}",
                            metric_value=abs(reward_std/reward_mean),
                            threshold=self.alert_thresholds["reward_variance_threshold"],
                            timestamp=datetime.now()
                        )
                        self.alerts[session_id].append(alert)
                        self.alert_history.append(alert)
        
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")
    
    def _update_performance_summary(self, session_id: str):
        """Update performance summary for the session."""
        try:
            if session_id not in self.active_sessions:
                return
            
            session_data = self.active_sessions[session_id]
            metrics = self.session_metrics[session_id]
            
            summary = {
                "runtime_minutes": (datetime.now() - session_data["start_time"]).total_seconds() / 60,
                "episodes_completed": len(metrics.get("episode_reward", [])),
                "alerts_count": len(self.alerts[session_id]),
                "last_update": datetime.now()
            }
            
            # Calculate performance metrics
            if "episode_reward" in metrics and metrics["episode_reward"]:
                rewards = [m["value"] for m in metrics["episode_reward"]]
                summary.update({
                    "average_reward": np.mean(rewards),
                    "best_reward": np.max(rewards),
                    "reward_trend": "improving" if len(rewards) > 1 and rewards[-1] > rewards[0] else "stable",
                    "recent_performance": np.mean(rewards[-5:]) if len(rewards) >= 5 else np.mean(rewards)
                })
            
            # Resource utilization summary
            if "memory_usage_bytes" in metrics and metrics["memory_usage_bytes"]:
                memory_data = [m for m in metrics["memory_usage_bytes"] if m.get("metadata")]
                if memory_data:
                    memory_percents = [m["metadata"].get("percent", 0) for m in memory_data]
                    summary["average_memory_usage_percent"] = np.mean(memory_percents)
                    summary["peak_memory_usage_percent"] = np.max(memory_percents)
            
            if "cpu_usage_percent" in metrics and metrics["cpu_usage_percent"]:
                cpu_values = [m["value"] for m in metrics["cpu_usage_percent"]]
                summary["average_cpu_usage_percent"] = np.mean(cpu_values)
                summary["peak_cpu_usage_percent"] = np.max(cpu_values)
            
            session_data["performance_summary"] = summary
        
        except Exception as e:
            logger.error(f"Error updating performance summary: {e}")
    
    def get_session_metrics(self, session_id: str, 
                          metric_names: Optional[List[str]] = None,
                          time_range_minutes: Optional[int] = None) -> Dict[str, List[Dict]]:
        """Get metrics for a specific session."""
        if session_id not in self.session_metrics:
            return {}
        
        session_metrics = self.session_metrics[session_id]
        result = {}
        
        # Filter by metric names if specified
        metrics_to_include = metric_names or session_metrics.keys()
        
        # Filter by time range if specified
        cutoff_time = None
        if time_range_minutes:
            cutoff_time = datetime.now() - timedelta(minutes=time_range_minutes)
        
        for metric_name in metrics_to_include:
            if metric_name in session_metrics:
                metrics = list(session_metrics[metric_name])
                
                # Filter by time if specified
                if cutoff_time:
                    metrics = [m for m in metrics if m["timestamp"] >= cutoff_time]
                
                result[metric_name] = metrics
        
        return result
    
    def get_session_alerts(self, session_id: str, 
                          alert_levels: Optional[List[AlertLevel]] = None,
                          unacknowledged_only: bool = False) -> List[RLAlert]:
        """Get alerts for a specific session."""
        if session_id not in self.alerts:
            return []
        
        session_alerts = self.alerts[session_id]
        
        # Filter by alert levels
        if alert_levels:
            session_alerts = [a for a in session_alerts if a.level in alert_levels]
        
        # Filter by acknowledgment status
        if unacknowledged_only:
            session_alerts = [a for a in session_alerts if not a.acknowledged]
        
        return session_alerts
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert."""
        for session_alerts in self.alerts.values():
            for alert in session_alerts:
                if alert.alert_id == alert_id:
                    alert.acknowledged = True
                    logger.info(f"Alert {alert_id} acknowledged")
                    return True
        return False
    
    def get_monitoring_dashboard_data(self, session_id: str) -> Dict[str, Any]:
        """Get comprehensive dashboard data for a session."""
        if session_id not in self.active_sessions:
            return {"error": "Session not found"}
        
        session_data = self.active_sessions[session_id]
        recent_metrics = self.get_session_metrics(session_id, time_range_minutes=60)
        recent_alerts = self.get_session_alerts(session_id, unacknowledged_only=True)
        
        # Prepare time series data for charts
        charts_data = {}
        for metric_name, metrics in recent_metrics.items():
            if metrics:
                charts_data[metric_name] = {
                    "timestamps": [m["timestamp"].isoformat() for m in metrics],
                    "values": [m["value"] for m in metrics]
                }
        
        return {
            "session_info": {
                "session_id": session_id,
                "status": session_data["status"],
                "start_time": session_data["start_time"].isoformat(),
                "config": session_data["config"],
                "runtime_minutes": (datetime.now() - session_data["start_time"]).total_seconds() / 60
            },
            "performance_summary": session_data.get("performance_summary", {}),
            "recent_alerts": [asdict(alert) for alert in recent_alerts],
            "charts_data": charts_data,
            "system_health": {
                "memory_status": "normal",  # Would be determined by recent metrics
                "cpu_status": "normal",
                "training_status": "active" if session_data["status"] == "running" else session_data["status"]
            }
        }
    
    def export_metrics(self, session_id: str, format: str = "json") -> Union[str, Dict]:
        """Export metrics for a session."""
        metrics = self.get_session_metrics(session_id)
        alerts = self.get_session_alerts(session_id)
        session_info = self.active_sessions.get(session_id, {})
        
        export_data = {
            "session_id": session_id,
            "export_timestamp": datetime.now().isoformat(),
            "session_info": session_info,
            "metrics": {},
            "alerts": [asdict(alert) for alert in alerts]
        }
        
        # Convert deque objects to lists for JSON serialization
        for metric_name, metric_data in metrics.items():
            export_data["metrics"][metric_name] = [
                {
                    "timestamp": m["timestamp"].isoformat(),
                    "value": m["value"],
                    "metadata": m.get("metadata"),
                    "tags": m.get("tags")
                }
                for m in metric_data
            ]
        
        if format == "json":
            return json.dumps(export_data, indent=2)
        elif format == "dict":
            return export_data
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def get_prometheus_metrics(self) -> str:
        """Get Prometheus-formatted metrics."""
        if not self.enable_prometheus:
            return "Prometheus metrics not enabled"
        
        return generate_latest(self.registry).decode('utf-8')
    
    def cleanup_old_data(self, retention_days: int = 7):
        """Clean up old monitoring data."""
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        # Clean up session metrics
        sessions_to_remove = []
        for session_id, session_data in self.active_sessions.items():
            if (session_data.get("end_time", datetime.now()) < cutoff_date or
                session_data.get("start_time") < cutoff_date):
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            if session_id in self.session_metrics:
                del self.session_metrics[session_id]
            if session_id in self.alerts:
                del self.alerts[session_id]
            if session_id in self.monitoring_threads:
                del self.monitoring_threads[session_id]
        
        # Clean up alert history
        self.alert_history = [
            alert for alert in self.alert_history 
            if alert.timestamp >= cutoff_date
        ]
        
        logger.info(f"Cleaned up monitoring data for {len(sessions_to_remove)} old sessions")
    
    def get_system_health_status(self) -> Dict[str, Any]:
        """Get overall system health status."""
        active_session_count = len([
            s for s in self.active_sessions.values() 
            if s["status"] == "running"
        ])
        
        total_alerts = len(self.alert_history)
        critical_alerts = len([a for a in self.alert_history if a.level == AlertLevel.CRITICAL])
        
        # System resource status
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=1)
        
        return {
            "timestamp": datetime.now().isoformat(),
            "system_status": "healthy" if critical_alerts == 0 and memory.percent < 90 and cpu_percent < 90 else "degraded",
            "active_sessions": active_session_count,
            "total_alerts": total_alerts,
            "critical_alerts": critical_alerts,
            "system_resources": {
                "memory_usage_percent": memory.percent,
                "cpu_usage_percent": cpu_percent,
                "available_memory_gb": memory.available / (1024**3)
            },
            "monitoring_health": {
                "redis_connected": self.redis_client is not None,
                "prometheus_enabled": self.enable_prometheus,
                "active_monitoring_threads": len(self.monitoring_threads)
            }
        }