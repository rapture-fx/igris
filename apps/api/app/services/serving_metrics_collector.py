"""
Serving Metrics Collector
==========================

Comprehensive metrics collection and monitoring system for model serving with:
- Real-time performance metrics collection
- Business metrics and model quality tracking
- Cost tracking and optimization insights
- Alert management and anomaly detection
- Observability and distributed tracing
- Custom dashboard and reporting
"""

import asyncio
import logging
import time
import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from collections import deque, defaultdict
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from app.models.mlops import (
    ServingEndpoint, ServingMetrics, ModelServingAlert, 
    BatchInferenceJob, CanaryDeployment
)
from app.core.config import settings


class MetricType(str, Enum):
    """Metric types for classification."""
    PERFORMANCE = "performance"
    BUSINESS = "business"  
    INFRASTRUCTURE = "infrastructure"
    COST = "cost"
    QUALITY = "quality"
    SECURITY = "security"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class MetricPoint:
    """Individual metric data point."""
    timestamp: datetime
    endpoint_id: str
    metric_name: str
    value: float
    tags: Dict[str, str]
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class Alert:
    """Alert data structure."""
    alert_id: str
    endpoint_id: str
    metric_name: str
    severity: AlertSeverity
    message: str
    current_value: float
    threshold_value: float
    timestamp: datetime
    tags: Dict[str, str]


class MetricBuffer:
    """Buffer for metric aggregation."""
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.buffer: deque = deque(maxlen=max_size)
        self.aggregated_metrics: Dict[str, Dict] = {}
    
    def add_metric(self, metric: MetricPoint):
        """Add metric to buffer."""
        self.buffer.append(metric)
    
    def get_aggregated_metrics(self, window_minutes: int = 1) -> Dict[str, Dict]:
        """Get aggregated metrics for the specified window."""
        cutoff_time = datetime.utcnow() - timedelta(minutes=window_minutes)
        
        # Filter metrics within window
        recent_metrics = [m for m in self.buffer if m.timestamp >= cutoff_time]
        
        # Group by endpoint and metric name
        grouped = defaultdict(lambda: defaultdict(list))
        for metric in recent_metrics:
            grouped[metric.endpoint_id][metric.metric_name].append(metric.value)
        
        # Aggregate
        aggregated = {}
        for endpoint_id, metrics in grouped.items():
            aggregated[endpoint_id] = {}
            for metric_name, values in metrics.items():
                if values:
                    aggregated[endpoint_id][metric_name] = {
                        'count': len(values),
                        'avg': statistics.mean(values),
                        'min': min(values),
                        'max': max(values),
                        'sum': sum(values),
                        'std': statistics.stdev(values) if len(values) > 1 else 0,
                        'p50': statistics.median(values),
                        'p95': np.percentile(values, 95),
                        'p99': np.percentile(values, 99),
                        'last_value': values[-1],
                        'first_value': values[0]
                    }
        
        return aggregated


class AnomalyDetector:
    """Anomaly detection for metrics."""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.historical_data: Dict[str, deque] = {}
    
    def add_data_point(self, metric_key: str, value: float, timestamp: datetime):
        """Add data point for anomaly detection."""
        if metric_key not in self.historical_data:
            self.historical_data[metric_key] = deque(maxlen=self.window_size)
        
        self.historical_data[metric_key].append({
            'value': value,
            'timestamp': timestamp
        })
    
    def detect_anomaly(self, metric_key: str, current_value: float, 
                      method: str = 'zscore', sensitivity: float = 2.0) -> Dict[str, Any]:
        """Detect if current value is anomalous."""
        if metric_key not in self.historical_data:
            return {'is_anomaly': False, 'reason': 'insufficient_data'}
        
        historical_values = [d['value'] for d in self.historical_data[metric_key]]
        
        if len(historical_values) < 10:
            return {'is_anomaly': False, 'reason': 'insufficient_data'}
        
        if method == 'zscore':
            return self._zscore_anomaly_detection(historical_values, current_value, sensitivity)
        elif method == 'iqr':
            return self._iqr_anomaly_detection(historical_values, current_value)
        elif method == 'isolation_forest':
            return self._isolation_forest_detection(historical_values, current_value)
        else:
            return {'is_anomaly': False, 'reason': 'unknown_method'}
    
    def _zscore_anomaly_detection(self, historical_values: List[float], 
                                 current_value: float, sensitivity: float) -> Dict[str, Any]:
        """Z-score based anomaly detection."""
        try:
            mean_val = statistics.mean(historical_values)
            std_val = statistics.stdev(historical_values) if len(historical_values) > 1 else 0
            
            if std_val == 0:
                return {'is_anomaly': False, 'reason': 'no_variation'}
            
            z_score = abs(current_value - mean_val) / std_val
            is_anomaly = z_score > sensitivity
            
            return {
                'is_anomaly': is_anomaly,
                'method': 'zscore',
                'z_score': z_score,
                'threshold': sensitivity,
                'mean': mean_val,
                'std': std_val,
                'confidence': min(z_score / sensitivity, 1.0) if is_anomaly else 0.0
            }
            
        except Exception as e:
            return {'is_anomaly': False, 'reason': f'calculation_error: {str(e)}'}
    
    def _iqr_anomaly_detection(self, historical_values: List[float], 
                              current_value: float) -> Dict[str, Any]:
        """IQR-based anomaly detection."""
        try:
            q1 = np.percentile(historical_values, 25)
            q3 = np.percentile(historical_values, 75)
            iqr = q3 - q1
            
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            is_anomaly = current_value < lower_bound or current_value > upper_bound
            
            return {
                'is_anomaly': is_anomaly,
                'method': 'iqr',
                'q1': q1,
                'q3': q3,
                'iqr': iqr,
                'lower_bound': lower_bound,
                'upper_bound': upper_bound,
                'confidence': 0.8 if is_anomaly else 0.0
            }
            
        except Exception as e:
            return {'is_anomaly': False, 'reason': f'calculation_error: {str(e)}'}


class MetricsAggregator:
    """Aggregates metrics across different time windows."""
    
    def __init__(self):
        self.aggregation_windows = [
            ('1m', 1),      # 1 minute
            ('5m', 5),      # 5 minutes  
            ('15m', 15),    # 15 minutes
            ('1h', 60),     # 1 hour
            ('1d', 1440)    # 1 day
        ]
    
    def aggregate_metrics(self, db: Session, endpoint_id: str, 
                         hours_back: int = 24) -> Dict[str, Any]:
        """Aggregate metrics for different time windows."""
        try:
            since_time = datetime.utcnow() - timedelta(hours=hours_back)
            
            # Get raw metrics
            metrics = db.query(ServingMetrics).filter(
                and_(
                    ServingMetrics.endpoint_id == endpoint_id,
                    ServingMetrics.timestamp >= since_time
                )
            ).order_by(ServingMetrics.timestamp).all()
            
            if not metrics:
                return {'error': 'no_data_found'}
            
            aggregated = {}
            
            for window_name, window_minutes in self.aggregation_windows:
                window_data = self._aggregate_window(metrics, window_minutes)
                aggregated[window_name] = window_data
            
            # Add overall statistics
            aggregated['overall'] = self._calculate_overall_stats(metrics)
            
            return aggregated
            
        except Exception as e:
            logging.error(f"Metrics aggregation failed: {e}")
            return {'error': str(e)}
    
    def _aggregate_window(self, metrics: List, window_minutes: int) -> Dict[str, Any]:
        """Aggregate metrics for a specific time window."""
        try:
            if not metrics:
                return {}
            
            # Group metrics by time windows
            window_groups = []
            current_window = []
            window_start = metrics[0].timestamp
            
            for metric in metrics:
                if (metric.timestamp - window_start).total_seconds() <= window_minutes * 60:
                    current_window.append(metric)
                else:
                    if current_window:
                        window_groups.append(current_window)
                    current_window = [metric]
                    window_start = metric.timestamp
            
            # Add the last window
            if current_window:
                window_groups.append(current_window)
            
            # Aggregate each window
            aggregated_windows = []
            for window in window_groups:
                if not window:
                    continue
                
                window_agg = {
                    'timestamp': window[0].timestamp,
                    'window_size_minutes': window_minutes,
                    'data_points': len(window),
                    'request_count': sum(m.request_count for m in window),
                    'successful_requests': sum(m.successful_requests for m in window),
                    'failed_requests': sum(m.failed_requests for m in window),
                    'avg_response_time': statistics.mean([m.avg_response_time for m in window]),
                    'p95_response_time': statistics.mean([m.p95_response_time for m in window]),
                    'p99_response_time': statistics.mean([m.p99_response_time for m in window]),
                    'throughput_rps': statistics.mean([m.throughput_rps for m in window]),
                    'cpu_usage_percent': statistics.mean([m.cpu_usage_percent for m in window]),
                    'memory_usage_percent': statistics.mean([m.memory_usage_percent for m in window]),
                    'error_rate_percent': statistics.mean([m.error_rate_percent for m in window]),
                    'cache_hit_rate': statistics.mean([m.cache_hit_rate for m in window]),
                    'compute_cost_usd': sum(m.compute_cost_usd for m in window)
                }
                
                aggregated_windows.append(window_agg)
            
            # Calculate summary statistics across windows
            if aggregated_windows:
                summary = {
                    'windows': aggregated_windows,
                    'window_count': len(aggregated_windows),
                    'total_requests': sum(w['request_count'] for w in aggregated_windows),
                    'avg_response_time_overall': statistics.mean([w['avg_response_time'] for w in aggregated_windows]),
                    'max_response_time': max([w['p99_response_time'] for w in aggregated_windows]),
                    'avg_throughput': statistics.mean([w['throughput_rps'] for w in aggregated_windows]),
                    'total_cost': sum(w['compute_cost_usd'] for w in aggregated_windows),
                    'avg_error_rate': statistics.mean([w['error_rate_percent'] for w in aggregated_windows])
                }
                return summary
            
            return {}
            
        except Exception as e:
            logging.error(f"Window aggregation failed: {e}")
            return {'error': str(e)}
    
    def _calculate_overall_stats(self, metrics: List) -> Dict[str, Any]:
        """Calculate overall statistics across all metrics."""
        try:
            if not metrics:
                return {}
            
            # Calculate comprehensive statistics
            response_times = [m.avg_response_time for m in metrics]
            throughputs = [m.throughput_rps for m in metrics]
            error_rates = [m.error_rate_percent for m in metrics]
            cpu_usages = [m.cpu_usage_percent for m in metrics]
            memory_usages = [m.memory_usage_percent for m in metrics]
            
            return {
                'time_range': {
                    'start': metrics[0].timestamp,
                    'end': metrics[-1].timestamp,
                    'duration_hours': (metrics[-1].timestamp - metrics[0].timestamp).total_seconds() / 3600
                },
                'data_points': len(metrics),
                'requests': {
                    'total': sum(m.request_count for m in metrics),
                    'successful': sum(m.successful_requests for m in metrics),
                    'failed': sum(m.failed_requests for m in metrics),
                    'success_rate': sum(m.successful_requests for m in metrics) / max(sum(m.request_count for m in metrics), 1) * 100
                },
                'performance': {
                    'avg_response_time': {
                        'mean': statistics.mean(response_times),
                        'median': statistics.median(response_times),
                        'min': min(response_times),
                        'max': max(response_times),
                        'std': statistics.stdev(response_times) if len(response_times) > 1 else 0
                    },
                    'throughput': {
                        'mean': statistics.mean(throughputs),
                        'median': statistics.median(throughputs),
                        'max': max(throughputs),
                        'total_rps': sum(throughputs)
                    }
                },
                'resources': {
                    'cpu_utilization': {
                        'mean': statistics.mean(cpu_usages),
                        'max': max(cpu_usages),
                        'min': min(cpu_usages)
                    },
                    'memory_utilization': {
                        'mean': statistics.mean(memory_usages),
                        'max': max(memory_usages),
                        'min': min(memory_usages)
                    }
                },
                'quality': {
                    'error_rate': {
                        'mean': statistics.mean(error_rates),
                        'max': max(error_rates),
                        'std': statistics.stdev(error_rates) if len(error_rates) > 1 else 0
                    },
                    'availability': 100 - statistics.mean(error_rates)  # Simplified availability
                },
                'cost': {
                    'total_compute_cost': sum(m.compute_cost_usd for m in metrics),
                    'total_data_transfer_cost': sum(m.data_transfer_cost_usd for m in metrics),
                    'total_storage_cost': sum(m.storage_cost_usd for m in metrics),
                    'cost_per_request': sum(m.compute_cost_usd + m.data_transfer_cost_usd for m in metrics) / max(sum(m.request_count for m in metrics), 1)
                }
            }
            
        except Exception as e:
            logging.error(f"Overall stats calculation failed: {e}")
            return {'error': str(e)}


class AlertManager:
    """Manages alerts and notifications."""
    
    def __init__(self, db: Session):
        self.db = db
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_rules: Dict[str, Dict] = {}
        
    def add_alert_rule(self, rule_id: str, rule_config: Dict):
        """Add alert rule."""
        self.alert_rules[rule_id] = rule_config
        logging.info(f"Added alert rule: {rule_id}")
    
    def evaluate_alerts(self, metrics: Dict[str, Dict]) -> List[Alert]:
        """Evaluate metrics against alert rules."""
        triggered_alerts = []
        
        for endpoint_id, endpoint_metrics in metrics.items():
            for rule_id, rule in self.alert_rules.items():
                alert = self._evaluate_rule(endpoint_id, endpoint_metrics, rule_id, rule)
                if alert:
                    triggered_alerts.append(alert)
        
        return triggered_alerts
    
    def _evaluate_rule(self, endpoint_id: str, metrics: Dict[str, Any], 
                      rule_id: str, rule: Dict) -> Optional[Alert]:
        """Evaluate single alert rule."""
        try:
            metric_name = rule.get('metric_name')
            threshold = rule.get('threshold_value')
            operator = rule.get('operator', '>')
            severity = rule.get('severity', AlertSeverity.MEDIUM)
            
            if not metric_name or threshold is None:
                return None
            
            # Get current metric value
            current_value = metrics.get(metric_name, {}).get('last_value', 0)
            
            # Evaluate condition
            triggered = False
            if operator == '>':
                triggered = current_value > threshold
            elif operator == '<':
                triggered = current_value < threshold
            elif operator == '>=':
                triggered = current_value >= threshold
            elif operator == '<=':
                triggered = current_value <= threshold
            elif operator == '==':
                triggered = current_value == threshold
            elif operator == '!=':
                triggered = current_value != threshold
            
            if triggered:
                alert_key = f"{endpoint_id}_{rule_id}"
                
                # Check if alert is already active (avoid spam)
                if alert_key in self.active_alerts:
                    # Update existing alert
                    existing_alert = self.active_alerts[alert_key]
                    if (datetime.utcnow() - existing_alert.timestamp).total_seconds() < 300:  # 5 minutes
                        return None  # Skip if recent alert exists
                
                # Create new alert
                alert = Alert(
                    alert_id=f"alert_{int(time.time())}_{rule_id}",
                    endpoint_id=endpoint_id,
                    metric_name=metric_name,
                    severity=AlertSeverity(severity) if isinstance(severity, str) else severity,
                    message=rule.get('message', f'{metric_name} threshold exceeded'),
                    current_value=current_value,
                    threshold_value=threshold,
                    timestamp=datetime.utcnow(),
                    tags=rule.get('tags', {})
                )
                
                self.active_alerts[alert_key] = alert
                return alert
            
            return None
            
        except Exception as e:
            logging.error(f"Alert rule evaluation failed: {e}")
            return None
    
    def store_alert(self, alert: Alert):
        """Store alert in database."""
        try:
            db_alert = ModelServingAlert(
                target_type='endpoint',
                target_id=alert.endpoint_id,
                alert_type='threshold',
                alert_name=f'{alert.metric_name}_alert',
                description=alert.message,
                metric_name=alert.metric_name,
                threshold_value=alert.threshold_value,
                threshold_operator='>',  # Simplified
                severity=alert.severity.value,
                is_active=True,
                last_triggered_at=alert.timestamp,
                trigger_count=1,
                created_by='system',
                tags=alert.tags
            )
            
            self.db.add(db_alert)
            self.db.commit()
            
        except Exception as e:
            logging.error(f"Failed to store alert: {e}")
            self.db.rollback()
    
    def get_active_alerts(self, endpoint_id: Optional[str] = None) -> List[Alert]:
        """Get active alerts."""
        if endpoint_id:
            return [alert for alert in self.active_alerts.values() 
                   if alert.endpoint_id == endpoint_id]
        return list(self.active_alerts.values())


class ServingMetricsCollector:
    """Comprehensive serving metrics collector."""
    
    def __init__(self, db: Session):
        self.db = db
        self.metric_buffer = MetricBuffer()
        self.anomaly_detector = AnomalyDetector()
        self.metrics_aggregator = MetricsAggregator()
        self.alert_manager = AlertManager(db)
        self.collection_interval = 60  # seconds
        self.is_running = False
        
        # Initialize default alert rules
        self._setup_default_alert_rules()
    
    def _setup_default_alert_rules(self):
        """Setup default alert rules."""
        default_rules = [
            {
                'rule_id': 'high_error_rate',
                'metric_name': 'error_rate_percent',
                'threshold_value': 5.0,
                'operator': '>',
                'severity': AlertSeverity.HIGH,
                'message': 'Error rate exceeded 5%'
            },
            {
                'rule_id': 'high_latency',
                'metric_name': 'avg_response_time',
                'threshold_value': 2000.0,
                'operator': '>',
                'severity': AlertSeverity.MEDIUM,
                'message': 'Average response time exceeded 2 seconds'
            },
            {
                'rule_id': 'high_cpu_usage',
                'metric_name': 'cpu_usage_percent',
                'threshold_value': 90.0,
                'operator': '>',
                'severity': AlertSeverity.MEDIUM,
                'message': 'CPU usage exceeded 90%'
            },
            {
                'rule_id': 'high_memory_usage',
                'metric_name': 'memory_usage_percent',
                'threshold_value': 90.0,
                'operator': '>',
                'severity': AlertSeverity.MEDIUM,
                'message': 'Memory usage exceeded 90%'
            },
            {
                'rule_id': 'low_throughput',
                'metric_name': 'throughput_rps',
                'threshold_value': 0.1,
                'operator': '<',
                'severity': AlertSeverity.LOW,
                'message': 'Throughput is very low'
            }
        ]
        
        for rule in default_rules:
            rule_id = rule.pop('rule_id')
            self.alert_manager.add_alert_rule(rule_id, rule)
    
    async def collect_endpoint_metrics(self, endpoint_id: str, serving_engine) -> Optional[ServingMetrics]:
        """Collect metrics for a specific endpoint."""
        try:
            # Get current timestamp
            timestamp = datetime.utcnow()
            
            # Get endpoint info
            endpoint = self.db.query(ServingEndpoint).filter(
                ServingEndpoint.endpoint_id == endpoint_id
            ).first()
            
            if not endpoint or endpoint.status != "active":
                return None
            
            # Get model status from serving engine
            model_status = serving_engine.get_model_status(endpoint_id)
            if not model_status:
                return None
            
            # Extract metrics from model status
            recent_metrics = model_status.get('recent_metrics', {})
            
            # Mock additional infrastructure metrics (in production, these would come from Kubernetes/monitoring systems)
            infrastructure_metrics = await self._collect_infrastructure_metrics(endpoint_id)
            business_metrics = await self._collect_business_metrics(endpoint_id)
            cost_metrics = await self._calculate_cost_metrics(endpoint, recent_metrics)
            
            # Create serving metrics record
            serving_metrics = ServingMetrics(
                endpoint_id=endpoint_id,
                model_id=endpoint.model_id,
                timestamp=timestamp,
                
                # Request metrics
                request_count=recent_metrics.get('total_requests', 0),
                successful_requests=recent_metrics.get('successful_requests', 0),
                failed_requests=recent_metrics.get('failed_requests', 0),
                timeout_requests=0,  # Mock value
                
                # Latency metrics
                avg_response_time=recent_metrics.get('avg_prediction_time_ms', 0),
                min_response_time=0,  # Mock value
                max_response_time=recent_metrics.get('avg_prediction_time_ms', 0) * 2,
                p50_response_time=recent_metrics.get('avg_prediction_time_ms', 0),
                p95_response_time=recent_metrics.get('avg_prediction_time_ms', 0) * 1.5,
                p99_response_time=recent_metrics.get('avg_prediction_time_ms', 0) * 2,
                
                # Throughput metrics
                throughput_rps=recent_metrics.get('throughput_rps', 0),
                concurrent_requests=10,  # Mock value
                queue_size=0,  # Mock value
                
                # Resource utilization
                cpu_usage_percent=infrastructure_metrics.get('cpu_usage', 0),
                memory_usage_percent=infrastructure_metrics.get('memory_usage', 0),
                gpu_usage_percent=infrastructure_metrics.get('gpu_usage', 0),
                disk_usage_percent=infrastructure_metrics.get('disk_usage', 0),
                
                # Infrastructure metrics  
                active_replicas=1,  # Mock value
                scaling_events=0,  # Mock value
                container_restarts=0,  # Mock value
                
                # Business metrics
                data_drift_score=business_metrics.get('data_drift_score', 0),
                model_accuracy=business_metrics.get('model_accuracy', 0),
                prediction_confidence=business_metrics.get('prediction_confidence', 0),
                
                # Cache metrics
                cache_hit_rate=60.0,  # Mock value
                cache_size_mb=endpoint.cache_size_mb,
                cache_evictions=0,  # Mock value
                
                # Error details
                error_types={'timeout': 1, 'validation': 2},  # Mock values
                error_rate_percent=recent_metrics.get('error_rate', 0),
                
                # Cost tracking
                compute_cost_usd=cost_metrics.get('compute_cost', 0),
                data_transfer_cost_usd=cost_metrics.get('data_transfer_cost', 0),
                storage_cost_usd=cost_metrics.get('storage_cost', 0)
            )
            
            # Store in database
            self.db.add(serving_metrics)
            self.db.commit()
            
            # Add to metric buffer for real-time processing
            metric_points = [
                MetricPoint(timestamp, endpoint_id, 'avg_response_time', serving_metrics.avg_response_time, {}),
                MetricPoint(timestamp, endpoint_id, 'throughput_rps', serving_metrics.throughput_rps, {}),
                MetricPoint(timestamp, endpoint_id, 'error_rate_percent', serving_metrics.error_rate_percent, {}),
                MetricPoint(timestamp, endpoint_id, 'cpu_usage_percent', serving_metrics.cpu_usage_percent, {}),
                MetricPoint(timestamp, endpoint_id, 'memory_usage_percent', serving_metrics.memory_usage_percent, {}),
            ]
            
            for metric_point in metric_points:
                self.metric_buffer.add_metric(metric_point)
                
                # Anomaly detection
                metric_key = f"{endpoint_id}_{metric_point.metric_name}"
                self.anomaly_detector.add_data_point(metric_key, metric_point.value, timestamp)
                anomaly_result = self.anomaly_detector.detect_anomaly(metric_key, metric_point.value)
                
                if anomaly_result.get('is_anomaly'):
                    logging.warning(f"Anomaly detected for {metric_key}: {anomaly_result}")
            
            return serving_metrics
            
        except Exception as e:
            logging.error(f"Failed to collect metrics for {endpoint_id}: {e}")
            self.db.rollback()
            return None
    
    async def _collect_infrastructure_metrics(self, endpoint_id: str) -> Dict[str, float]:
        """Collect infrastructure metrics (mock implementation)."""
        # In production, this would integrate with Kubernetes metrics, Prometheus, etc.
        import random
        return {
            'cpu_usage': random.uniform(20, 80),
            'memory_usage': random.uniform(30, 85),
            'gpu_usage': random.uniform(0, 60),
            'disk_usage': random.uniform(10, 50),
            'network_io_mbps': random.uniform(1, 100),
            'disk_io_ops': random.uniform(10, 1000)
        }
    
    async def _collect_business_metrics(self, endpoint_id: str) -> Dict[str, float]:
        """Collect business and model quality metrics."""
        # Mock implementation - in production, this would calculate real model quality metrics
        import random
        return {
            'data_drift_score': random.uniform(0, 0.3),
            'model_accuracy': random.uniform(0.85, 0.98),
            'prediction_confidence': random.uniform(0.7, 0.95),
            'model_bias_score': random.uniform(0, 0.1),
            'feature_importance_stability': random.uniform(0.8, 1.0)
        }
    
    async def _calculate_cost_metrics(self, endpoint: ServingEndpoint, metrics: Dict) -> Dict[str, float]:
        """Calculate cost metrics."""
        # Mock cost calculation - in production, this would use actual cloud provider pricing
        
        # Base compute cost
        instance_cost_per_hour = {
            'cpu-optimized': 0.05,
            'memory-optimized': 0.08,
            'gpu-enabled': 0.50,
            'balanced': 0.06
        }.get(endpoint.instance_type, 0.06)
        
        # Calculate costs for the collection interval
        hours_fraction = self.collection_interval / 3600
        compute_cost = instance_cost_per_hour * hours_fraction
        
        # Data transfer cost (based on request volume)
        request_count = metrics.get('total_requests', 0)
        data_transfer_cost = request_count * 0.0001  # $0.0001 per request
        
        # Storage cost (minimal for short-term metrics)
        storage_cost = 0.001  # $0.001 per collection interval
        
        return {
            'compute_cost': compute_cost,
            'data_transfer_cost': data_transfer_cost,
            'storage_cost': storage_cost
        }
    
    async def run_metrics_collection_loop(self, serving_engine):
        """Run continuous metrics collection loop."""
        logging.info("Starting metrics collection loop")
        self.is_running = True
        
        while self.is_running:
            try:
                # Get all active endpoints
                endpoints = self.db.query(ServingEndpoint).filter(
                    ServingEndpoint.status == "active"
                ).all()
                
                # Collect metrics for each endpoint
                for endpoint in endpoints:
                    try:
                        await self.collect_endpoint_metrics(endpoint.endpoint_id, serving_engine)
                    except Exception as e:
                        logging.error(f"Failed to collect metrics for {endpoint.endpoint_id}: {e}")
                
                # Process alerts
                await self._process_alerts()
                
                # Wait for next collection
                await asyncio.sleep(self.collection_interval)
                
            except Exception as e:
                logging.error(f"Metrics collection loop error: {e}")
                await asyncio.sleep(self.collection_interval)
    
    async def _process_alerts(self):
        """Process alerts based on collected metrics."""
        try:
            # Get aggregated metrics from buffer
            aggregated_metrics = self.metric_buffer.get_aggregated_metrics(window_minutes=5)
            
            # Evaluate alerts
            triggered_alerts = self.alert_manager.evaluate_alerts(aggregated_metrics)
            
            # Store triggered alerts
            for alert in triggered_alerts:
                self.alert_manager.store_alert(alert)
                logging.warning(f"Alert triggered: {alert.message} for {alert.endpoint_id}")
                
                # In production, this would send notifications (email, Slack, webhook, etc.)
                
        except Exception as e:
            logging.error(f"Alert processing failed: {e}")
    
    def stop_collection(self):
        """Stop metrics collection loop."""
        self.is_running = False
        logging.info("Metrics collection stopped")
    
    def get_metrics_summary(self, endpoint_id: str, hours_back: int = 24) -> Dict[str, Any]:
        """Get comprehensive metrics summary."""
        try:
            return self.metrics_aggregator.aggregate_metrics(self.db, endpoint_id, hours_back)
        except Exception as e:
            logging.error(f"Failed to get metrics summary: {e}")
            return {'error': str(e)}
    
    def get_real_time_metrics(self, endpoint_id: str) -> Dict[str, Any]:
        """Get real-time metrics from buffer."""
        try:
            aggregated = self.metric_buffer.get_aggregated_metrics(window_minutes=1)
            return aggregated.get(endpoint_id, {})
        except Exception as e:
            logging.error(f"Failed to get real-time metrics: {e}")
            return {'error': str(e)}
    
    def create_custom_dashboard(self, endpoints: List[str], 
                               metrics: List[str], 
                               time_range: str = '1h') -> Dict[str, Any]:
        """Create custom dashboard configuration."""
        try:
            dashboard_config = {
                'id': f"dashboard_{int(time.time())}",
                'name': f"Custom Dashboard - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                'endpoints': endpoints,
                'metrics': metrics,
                'time_range': time_range,
                'panels': []
            }
            
            # Generate panel configurations
            for metric in metrics:
                panel = {
                    'id': f"panel_{metric}",
                    'title': metric.replace('_', ' ').title(),
                    'type': 'time_series',
                    'metric': metric,
                    'targets': [{'endpoint': ep, 'metric': metric} for ep in endpoints],
                    'display_options': {
                        'show_legend': True,
                        'show_grid': True,
                        'line_width': 2
                    }
                }
                dashboard_config['panels'].append(panel)
            
            return dashboard_config
            
        except Exception as e:
            logging.error(f"Failed to create dashboard: {e}")
            return {'error': str(e)}
    
    def export_metrics(self, endpoint_id: str, start_time: datetime, 
                      end_time: datetime, format: str = 'json') -> Dict[str, Any]:
        """Export metrics data."""
        try:
            metrics = self.db.query(ServingMetrics).filter(
                and_(
                    ServingMetrics.endpoint_id == endpoint_id,
                    ServingMetrics.timestamp >= start_time,
                    ServingMetrics.timestamp <= end_time
                )
            ).order_by(ServingMetrics.timestamp).all()
            
            if format == 'json':
                return {
                    'endpoint_id': endpoint_id,
                    'time_range': {
                        'start': start_time.isoformat(),
                        'end': end_time.isoformat()
                    },
                    'data_points': len(metrics),
                    'metrics': [
                        {
                            'timestamp': m.timestamp.isoformat(),
                            'request_count': m.request_count,
                            'avg_response_time': m.avg_response_time,
                            'throughput_rps': m.throughput_rps,
                            'error_rate_percent': m.error_rate_percent,
                            'cpu_usage_percent': m.cpu_usage_percent,
                            'memory_usage_percent': m.memory_usage_percent,
                            'compute_cost_usd': m.compute_cost_usd
                        }
                        for m in metrics
                    ]
                }
            else:
                return {'error': 'unsupported_format'}
                
        except Exception as e:
            logging.error(f"Failed to export metrics: {e}")
            return {'error': str(e)}


# Global metrics collector instance
_metrics_collector = None


def get_metrics_collector(db: Session) -> ServingMetricsCollector:
    """Get metrics collector instance."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = ServingMetricsCollector(db)
    return _metrics_collector