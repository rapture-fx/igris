"""
Auto-Scaling and Load Balancing Manager
=======================================

Advanced auto-scaling and load balancing system for model serving endpoints with:
- Predictive scaling based on traffic patterns and SLA requirements
- Multi-dimensional scaling metrics (CPU, memory, request rate, latency)
- Cost-optimized scaling decisions
- Load balancing across multiple model instances
- Health-aware traffic routing
- Integration with Kubernetes HPA and VPA
"""

import asyncio
import logging
import time
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from collections import deque
import statistics
from sqlalchemy.orm import Session

from app.models.mlops import ServingEndpoint, ServingMetrics, ModelDeployment
from app.core.config import settings


class ScalingDirection(str, Enum):
    """Scaling direction options."""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


class ScalingTrigger(str, Enum):
    """Scaling trigger types."""
    CPU_UTILIZATION = "cpu_utilization"
    MEMORY_UTILIZATION = "memory_utilization"
    REQUEST_RATE = "request_rate"
    LATENCY = "latency"
    QUEUE_SIZE = "queue_size"
    ERROR_RATE = "error_rate"
    PREDICTIVE = "predictive"
    COST_OPTIMIZATION = "cost_optimization"


@dataclass
class ScalingMetric:
    """Scaling metric configuration."""
    name: str
    current_value: float
    target_value: float
    threshold_percentage: float = 10.0  # Percentage deviation to trigger scaling
    weight: float = 1.0  # Importance weight in scaling decision


@dataclass
class ScalingDecision:
    """Scaling decision details."""
    endpoint_id: str
    direction: ScalingDirection
    current_replicas: int
    target_replicas: int
    trigger: ScalingTrigger
    confidence: float
    metrics: List[ScalingMetric]
    cost_impact: float
    timestamp: datetime


@dataclass
class LoadBalancingConfig:
    """Load balancing configuration."""
    strategy: str  # 'round_robin', 'least_connections', 'weighted', 'latency_based'
    health_check_interval: int = 30  # seconds
    unhealthy_threshold: int = 3  # consecutive failed checks
    recovery_threshold: int = 2  # consecutive successful checks
    session_affinity: bool = False
    connection_draining_timeout: int = 30  # seconds


class PredictiveScaler:
    """Predictive scaling based on historical patterns."""
    
    def __init__(self, lookback_hours: int = 24):
        self.lookback_hours = lookback_hours
        self.pattern_cache: Dict[str, List] = {}
    
    def analyze_traffic_patterns(self, endpoint_id: str, historical_metrics: List[Dict]) -> Dict[str, Any]:
        """Analyze historical traffic patterns."""
        if not historical_metrics:
            return {'prediction': 'insufficient_data'}
        
        # Extract time series data
        timestamps = [m['timestamp'] for m in historical_metrics]
        request_rates = [m.get('throughput_rps', 0) for m in historical_metrics]
        latencies = [m.get('avg_response_time', 0) for m in historical_metrics]
        
        # Detect patterns
        patterns = {
            'hourly_pattern': self._detect_hourly_pattern(timestamps, request_rates),
            'daily_pattern': self._detect_daily_pattern(timestamps, request_rates),
            'trend': self._calculate_trend(request_rates),
            'seasonality': self._detect_seasonality(timestamps, request_rates),
            'anomalies': self._detect_anomalies(request_rates)
        }
        
        return patterns
    
    def _detect_hourly_pattern(self, timestamps: List[datetime], values: List[float]) -> Dict:
        """Detect hourly traffic patterns."""
        if len(timestamps) < 24:
            return {'pattern': 'insufficient_data'}
        
        # Group by hour of day
        hourly_averages = {}
        for ts, val in zip(timestamps, values):
            hour = ts.hour
            if hour not in hourly_averages:
                hourly_averages[hour] = []
            hourly_averages[hour].append(val)
        
        # Calculate average for each hour
        hourly_pattern = {}
        for hour, vals in hourly_averages.items():
            hourly_pattern[hour] = statistics.mean(vals)
        
        # Find peak and low hours
        if hourly_pattern:
            peak_hour = max(hourly_pattern, key=hourly_pattern.get)
            low_hour = min(hourly_pattern, key=hourly_pattern.get)
            peak_ratio = hourly_pattern[peak_hour] / max(hourly_pattern[low_hour], 1)
        else:
            peak_hour = low_hour = 0
            peak_ratio = 1.0
        
        return {
            'pattern': 'detected',
            'hourly_averages': hourly_pattern,
            'peak_hour': peak_hour,
            'low_hour': low_hour,
            'peak_ratio': peak_ratio
        }
    
    def _detect_daily_pattern(self, timestamps: List[datetime], values: List[float]) -> Dict:
        """Detect daily traffic patterns."""
        if len(timestamps) < 7 * 24:  # Need at least a week of data
            return {'pattern': 'insufficient_data'}
        
        # Group by day of week
        daily_averages = {}
        for ts, val in zip(timestamps, values):
            day = ts.weekday()  # 0=Monday, 6=Sunday
            if day not in daily_averages:
                daily_averages[day] = []
            daily_averages[day].append(val)
        
        # Calculate average for each day
        daily_pattern = {}
        for day, vals in daily_averages.items():
            daily_pattern[day] = statistics.mean(vals)
        
        return {
            'pattern': 'detected',
            'daily_averages': daily_pattern,
            'weekday_avg': statistics.mean([daily_pattern.get(i, 0) for i in range(5)]),  # Mon-Fri
            'weekend_avg': statistics.mean([daily_pattern.get(i, 0) for i in [5, 6]])  # Sat-Sun
        }
    
    def _calculate_trend(self, values: List[float]) -> Dict:
        """Calculate trend direction and strength."""
        if len(values) < 10:
            return {'trend': 'insufficient_data'}
        
        # Simple linear regression
        n = len(values)
        x = np.arange(n)
        y = np.array(values)
        
        # Calculate slope
        slope = np.polyfit(x, y, 1)[0]
        
        # Calculate R-squared
        y_pred = np.polyfit(x, y, 1)[0] * x + np.polyfit(x, y, 1)[1]
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        return {
            'slope': float(slope),
            'r_squared': float(r_squared),
            'direction': 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
            'strength': abs(slope) * r_squared
        }
    
    def _detect_seasonality(self, timestamps: List[datetime], values: List[float]) -> Dict:
        """Detect seasonal patterns."""
        # This is a simplified seasonality detection
        # In production, you'd use more sophisticated methods like FFT or autocorrelation
        
        if len(values) < 168:  # Need at least a week of hourly data
            return {'seasonality': 'insufficient_data'}
        
        # Check for weekly seasonality (168 hours)
        if len(values) >= 168:
            weekly_correlation = self._calculate_autocorrelation(values, 168)
        else:
            weekly_correlation = 0
        
        # Check for daily seasonality (24 hours)
        if len(values) >= 24:
            daily_correlation = self._calculate_autocorrelation(values, 24)
        else:
            daily_correlation = 0
        
        return {
            'weekly_seasonality': weekly_correlation,
            'daily_seasonality': daily_correlation,
            'has_seasonality': max(weekly_correlation, daily_correlation) > 0.3
        }
    
    def _calculate_autocorrelation(self, values: List[float], lag: int) -> float:
        """Calculate autocorrelation at specific lag."""
        if len(values) <= lag:
            return 0
        
        n = len(values) - lag
        mean_val = statistics.mean(values)
        
        numerator = sum((values[i] - mean_val) * (values[i + lag] - mean_val) for i in range(n))
        denominator = sum((val - mean_val) ** 2 for val in values)
        
        return numerator / denominator if denominator != 0 else 0
    
    def _detect_anomalies(self, values: List[float]) -> Dict:
        """Detect anomalies in traffic patterns."""
        if len(values) < 20:
            return {'anomalies': 'insufficient_data'}
        
        # Use simple statistical outlier detection
        mean_val = statistics.mean(values)
        std_val = statistics.stdev(values) if len(values) > 1 else 0
        
        if std_val == 0:
            return {'anomalies': 'no_variation'}
        
        # Values more than 2 standard deviations away are considered anomalies
        threshold = 2 * std_val
        anomalies = []
        
        for i, val in enumerate(values):
            if abs(val - mean_val) > threshold:
                anomalies.append({
                    'index': i,
                    'value': val,
                    'deviation': abs(val - mean_val) / std_val
                })
        
        return {
            'count': len(anomalies),
            'percentage': len(anomalies) / len(values) * 100,
            'anomalies': anomalies[-10:]  # Keep only last 10 anomalies
        }
    
    def predict_future_load(self, endpoint_id: str, patterns: Dict, hours_ahead: int = 1) -> Dict:
        """Predict future load based on patterns."""
        try:
            current_time = datetime.utcnow()
            future_time = current_time + timedelta(hours=hours_ahead)
            
            # Base prediction on hourly pattern
            hourly_pattern = patterns.get('hourly_pattern', {})
            if hourly_pattern.get('pattern') == 'detected':
                hourly_avg = hourly_pattern['hourly_averages']
                base_load = hourly_avg.get(future_time.hour, 1.0)
            else:
                base_load = 1.0
            
            # Adjust for daily pattern
            daily_pattern = patterns.get('daily_pattern', {})
            if daily_pattern.get('pattern') == 'detected':
                weekday_avg = daily_pattern.get('weekday_avg', 1.0)
                weekend_avg = daily_pattern.get('weekend_avg', 1.0)
                
                if future_time.weekday() < 5:  # Weekday
                    daily_factor = weekday_avg / max(weekend_avg, 0.1)
                else:  # Weekend
                    daily_factor = weekend_avg / max(weekday_avg, 0.1)
                
                base_load *= daily_factor
            
            # Apply trend
            trend = patterns.get('trend', {})
            if trend.get('direction') == 'increasing':
                trend_factor = 1 + (trend.get('strength', 0) * hours_ahead)
            elif trend.get('direction') == 'decreasing':
                trend_factor = 1 - (trend.get('strength', 0) * hours_ahead)
            else:
                trend_factor = 1.0
            
            base_load *= trend_factor
            
            # Calculate confidence
            seasonality = patterns.get('seasonality', {})
            has_seasonality = seasonality.get('has_seasonality', False)
            trend_strength = trend.get('r_squared', 0)
            
            confidence = (trend_strength + (0.3 if has_seasonality else 0)) / 1.3
            confidence = min(max(confidence, 0.1), 0.9)
            
            return {
                'predicted_load': max(base_load, 0.1),
                'confidence': confidence,
                'factors': {
                    'base': base_load / (daily_factor * trend_factor) if 'daily_factor' in locals() and 'trend_factor' in locals() else 1.0,
                    'daily': daily_factor if 'daily_factor' in locals() else 1.0,
                    'trend': trend_factor if 'trend_factor' in locals() else 1.0
                }
            }
            
        except Exception as e:
            logging.error(f"Load prediction failed: {e}")
            return {
                'predicted_load': 1.0,
                'confidence': 0.1,
                'error': str(e)
            }


class CostOptimizer:
    """Cost optimization for scaling decisions."""
    
    def __init__(self):
        # Mock cost data - in production, this would come from cloud provider APIs
        self.instance_costs = {
            'cpu-optimized': {'hourly': 0.05, 'startup': 0.01},
            'memory-optimized': {'hourly': 0.08, 'startup': 0.01},
            'gpu-enabled': {'hourly': 0.50, 'startup': 0.05},
            'balanced': {'hourly': 0.06, 'startup': 0.01}
        }
    
    def calculate_scaling_cost(self, endpoint_id: str, current_replicas: int, 
                              target_replicas: int, instance_type: str, 
                              duration_hours: float = 1.0) -> Dict[str, float]:
        """Calculate cost impact of scaling decision."""
        try:
            costs = self.instance_costs.get(instance_type, self.instance_costs['balanced'])
            
            # Current cost
            current_cost = current_replicas * costs['hourly'] * duration_hours
            
            # Target cost
            target_cost = target_replicas * costs['hourly'] * duration_hours
            
            # Startup costs for new instances
            if target_replicas > current_replicas:
                startup_cost = (target_replicas - current_replicas) * costs['startup']
            else:
                startup_cost = 0
            
            # Total cost impact
            cost_delta = (target_cost - current_cost) + startup_cost
            
            return {
                'current_cost_per_hour': current_cost / duration_hours,
                'target_cost_per_hour': target_cost / duration_hours,
                'cost_delta': cost_delta,
                'startup_cost': startup_cost,
                'savings_per_hour': (current_cost - target_cost) / duration_hours,
                'roi_hours': abs(startup_cost / ((target_cost - current_cost) / duration_hours)) if target_cost != current_cost else 0
            }
            
        except Exception as e:
            logging.error(f"Cost calculation failed: {e}")
            return {
                'current_cost_per_hour': 0,
                'target_cost_per_hour': 0,
                'cost_delta': 0,
                'startup_cost': 0,
                'savings_per_hour': 0,
                'roi_hours': 0
            }
    
    def should_scale_for_cost(self, cost_analysis: Dict, threshold_savings: float = 0.10) -> bool:
        """Determine if scaling should be done for cost optimization."""
        roi_hours = cost_analysis.get('roi_hours', float('inf'))
        savings_per_hour = cost_analysis.get('savings_per_hour', 0)
        
        # Scale if ROI is achieved within 4 hours and savings > threshold
        return roi_hours <= 4.0 and savings_per_hour > threshold_savings


class HealthChecker:
    """Health checking for load balancing."""
    
    def __init__(self):
        self.health_history: Dict[str, deque] = {}
    
    async def check_endpoint_health(self, endpoint_id: str, serving_engine) -> Dict[str, Any]:
        """Check endpoint health."""
        try:
            # Get model status from serving engine
            status = serving_engine.get_model_status(endpoint_id)
            
            # Determine health based on multiple factors
            is_healthy = (
                status.get('status') == 'ready' and
                status.get('circuit_breaker_state') == 'closed' and
                status.get('recent_metrics', {}).get('error_rate', 100) < 5.0 and
                status.get('recent_metrics', {}).get('avg_prediction_time_ms', 10000) < 2000
            )
            
            health_score = self._calculate_health_score(status)
            
            # Update health history
            if endpoint_id not in self.health_history:
                self.health_history[endpoint_id] = deque(maxlen=10)
            
            self.health_history[endpoint_id].append({
                'timestamp': datetime.utcnow(),
                'healthy': is_healthy,
                'score': health_score,
                'error_rate': status.get('recent_metrics', {}).get('error_rate', 0),
                'latency': status.get('recent_metrics', {}).get('avg_prediction_time_ms', 0)
            })
            
            return {
                'endpoint_id': endpoint_id,
                'healthy': is_healthy,
                'score': health_score,
                'consecutive_failures': self._get_consecutive_failures(endpoint_id),
                'consecutive_successes': self._get_consecutive_successes(endpoint_id),
                'last_check': datetime.utcnow()
            }
            
        except Exception as e:
            logging.error(f"Health check failed for {endpoint_id}: {e}")
            return {
                'endpoint_id': endpoint_id,
                'healthy': False,
                'score': 0.0,
                'error': str(e),
                'last_check': datetime.utcnow()
            }
    
    def _calculate_health_score(self, status: Dict) -> float:
        """Calculate health score (0-1)."""
        try:
            metrics = status.get('recent_metrics', {})
            
            # Error rate score (lower is better)
            error_rate = metrics.get('error_rate', 0)
            error_score = max(0, 1 - error_rate / 10.0)  # 0% error = 1.0, 10% error = 0.0
            
            # Latency score (lower is better)  
            latency = metrics.get('avg_prediction_time_ms', 0)
            latency_score = max(0, 1 - latency / 5000.0)  # 0ms = 1.0, 5000ms = 0.0
            
            # Circuit breaker score
            cb_score = 1.0 if status.get('circuit_breaker_state') == 'closed' else 0.0
            
            # Model status score
            model_score = 1.0 if status.get('status') == 'ready' else 0.0
            
            # Weighted average
            health_score = (
                error_score * 0.3 +
                latency_score * 0.3 +
                cb_score * 0.2 +
                model_score * 0.2
            )
            
            return max(0.0, min(1.0, health_score))
            
        except Exception as e:
            logging.error(f"Health score calculation failed: {e}")
            return 0.0
    
    def _get_consecutive_failures(self, endpoint_id: str) -> int:
        """Get number of consecutive failures."""
        history = self.health_history.get(endpoint_id, [])
        consecutive = 0
        
        for check in reversed(history):
            if not check['healthy']:
                consecutive += 1
            else:
                break
        
        return consecutive
    
    def _get_consecutive_successes(self, endpoint_id: str) -> int:
        """Get number of consecutive successes."""
        history = self.health_history.get(endpoint_id, [])
        consecutive = 0
        
        for check in reversed(history):
            if check['healthy']:
                consecutive += 1
            else:
                break
        
        return consecutive


class AutoScalingManager:
    """Advanced auto-scaling and load balancing manager."""
    
    def __init__(self, db: Session):
        self.db = db
        self.predictive_scaler = PredictiveScaler()
        self.cost_optimizer = CostOptimizer()
        self.health_checker = HealthChecker()
        self.scaling_history: Dict[str, List[ScalingDecision]] = {}
        self.cooldown_period = 300  # 5 minutes cooldown between scaling actions
        
    async def evaluate_scaling_needs(self, endpoint_id: str, serving_engine) -> Optional[ScalingDecision]:
        """Evaluate if endpoint needs scaling."""
        try:
            # Get endpoint info
            endpoint = self.db.query(ServingEndpoint).filter(
                ServingEndpoint.endpoint_id == endpoint_id
            ).first()
            
            if not endpoint or endpoint.status != "active":
                return None
            
            # Check cooldown period
            if self._is_in_cooldown(endpoint_id):
                logging.debug(f"Endpoint {endpoint_id} is in cooldown period")
                return None
            
            # Get current metrics
            current_metrics = await self._get_current_metrics(endpoint_id, serving_engine)
            if not current_metrics:
                return None
            
            # Calculate scaling metrics
            scaling_metrics = self._calculate_scaling_metrics(endpoint, current_metrics)
            
            # Determine scaling direction and magnitude
            scaling_decision = self._make_scaling_decision(endpoint, scaling_metrics, current_metrics)
            
            if scaling_decision and scaling_decision.direction != ScalingDirection.STABLE:
                # Validate scaling decision with cost analysis
                scaling_decision = await self._validate_scaling_decision(scaling_decision, endpoint)
                
                if scaling_decision:
                    # Record scaling decision
                    self._record_scaling_decision(endpoint_id, scaling_decision)
            
            return scaling_decision
            
        except Exception as e:
            logging.error(f"Scaling evaluation failed for {endpoint_id}: {e}")
            return None
    
    def _is_in_cooldown(self, endpoint_id: str) -> bool:
        """Check if endpoint is in cooldown period."""
        history = self.scaling_history.get(endpoint_id, [])
        if not history:
            return False
        
        last_scaling = history[-1]
        elapsed = (datetime.utcnow() - last_scaling.timestamp).total_seconds()
        return elapsed < self.cooldown_period
    
    async def _get_current_metrics(self, endpoint_id: str, serving_engine) -> Optional[Dict]:
        """Get current endpoint metrics."""
        try:
            # Get metrics from serving engine
            model_status = serving_engine.get_model_status(endpoint_id)
            
            # Get recent database metrics
            recent_metrics = self.db.query(ServingMetrics).filter(
                ServingMetrics.endpoint_id == endpoint_id,
                ServingMetrics.timestamp > datetime.utcnow() - timedelta(minutes=5)
            ).order_by(ServingMetrics.timestamp.desc()).limit(5).all()
            
            # Combine metrics
            if recent_metrics:
                avg_cpu = sum(m.cpu_usage_percent for m in recent_metrics) / len(recent_metrics)
                avg_memory = sum(m.memory_usage_percent for m in recent_metrics) / len(recent_metrics)
                avg_latency = sum(m.avg_response_time for m in recent_metrics) / len(recent_metrics)
                avg_throughput = sum(m.throughput_rps for m in recent_metrics) / len(recent_metrics)
                avg_error_rate = sum(m.error_rate_percent for m in recent_metrics) / len(recent_metrics)
                avg_queue_size = sum(m.queue_size for m in recent_metrics) / len(recent_metrics)
            else:
                # Fallback to serving engine metrics
                engine_metrics = model_status.get('recent_metrics', {})
                avg_cpu = engine_metrics.get('cpu_usage', 0)
                avg_memory = engine_metrics.get('memory_usage', 0)
                avg_latency = engine_metrics.get('avg_prediction_time_ms', 0)
                avg_throughput = engine_metrics.get('throughput_rps', 0)
                avg_error_rate = engine_metrics.get('error_rate', 0)
                avg_queue_size = 0
            
            return {
                'cpu_utilization': avg_cpu,
                'memory_utilization': avg_memory,
                'avg_latency_ms': avg_latency,
                'throughput_rps': avg_throughput,
                'error_rate': avg_error_rate,
                'queue_size': avg_queue_size,
                'active_replicas': 1  # Mock value - would come from Kubernetes
            }
            
        except Exception as e:
            logging.error(f"Failed to get metrics for {endpoint_id}: {e}")
            return None
    
    def _calculate_scaling_metrics(self, endpoint: ServingEndpoint, current_metrics: Dict) -> List[ScalingMetric]:
        """Calculate scaling metrics."""
        metrics = []
        
        # CPU utilization metric
        metrics.append(ScalingMetric(
            name="cpu_utilization",
            current_value=current_metrics['cpu_utilization'],
            target_value=endpoint.target_cpu_utilization,
            threshold_percentage=10.0,
            weight=0.3
        ))
        
        # Memory utilization metric
        metrics.append(ScalingMetric(
            name="memory_utilization",
            current_value=current_metrics['memory_utilization'],
            target_value=endpoint.target_memory_utilization,
            threshold_percentage=10.0,
            weight=0.3
        ))
        
        # Latency metric (scale up if latency too high)
        target_latency = endpoint.request_timeout_ms * 0.5  # Target 50% of timeout
        metrics.append(ScalingMetric(
            name="latency",
            current_value=current_metrics['avg_latency_ms'],
            target_value=target_latency,
            threshold_percentage=20.0,
            weight=0.2
        ))
        
        # Queue size metric
        metrics.append(ScalingMetric(
            name="queue_size",
            current_value=current_metrics['queue_size'],
            target_value=10.0,  # Target queue size
            threshold_percentage=50.0,
            weight=0.1
        ))
        
        # Error rate metric
        metrics.append(ScalingMetric(
            name="error_rate",
            current_value=current_metrics['error_rate'],
            target_value=1.0,  # Target 1% error rate
            threshold_percentage=100.0,
            weight=0.1
        ))
        
        return metrics
    
    def _make_scaling_decision(self, endpoint: ServingEndpoint, 
                              scaling_metrics: List[ScalingMetric], 
                              current_metrics: Dict) -> Optional[ScalingDecision]:
        """Make scaling decision based on metrics."""
        try:
            current_replicas = current_metrics['active_replicas']
            
            # Calculate weighted scaling score
            scale_up_score = 0
            scale_down_score = 0
            total_weight = sum(m.weight for m in scaling_metrics)
            
            for metric in scaling_metrics:
                if metric.current_value == 0 and metric.target_value == 0:
                    continue
                
                # Calculate deviation percentage
                if metric.target_value > 0:
                    deviation_pct = (metric.current_value - metric.target_value) / metric.target_value * 100
                else:
                    deviation_pct = metric.current_value * 100
                
                # Check if deviation exceeds threshold
                if abs(deviation_pct) > metric.threshold_percentage:
                    if deviation_pct > 0:  # Current > Target
                        if metric.name in ['cpu_utilization', 'memory_utilization', 'latency', 'queue_size', 'error_rate']:
                            # These metrics indicate need to scale up
                            scale_up_score += metric.weight * abs(deviation_pct)
                    else:  # Current < Target
                        if metric.name in ['cpu_utilization', 'memory_utilization']:
                            # Low utilization indicates opportunity to scale down
                            scale_down_score += metric.weight * abs(deviation_pct)
            
            # Normalize scores
            if total_weight > 0:
                scale_up_score /= total_weight
                scale_down_score /= total_weight
            
            # Make decision
            confidence_threshold = 10.0  # Minimum confidence score to trigger scaling
            
            if scale_up_score > confidence_threshold and scale_up_score > scale_down_score:
                # Scale up
                scaling_factor = min(scale_up_score / 50.0, 2.0)  # Max 2x scaling
                target_replicas = min(
                    int(current_replicas * (1 + scaling_factor)),
                    endpoint.max_replicas
                )
                
                if target_replicas > current_replicas:
                    return ScalingDecision(
                        endpoint_id=endpoint.endpoint_id,
                        direction=ScalingDirection.UP,
                        current_replicas=current_replicas,
                        target_replicas=target_replicas,
                        trigger=self._determine_primary_trigger(scaling_metrics, scale_up=True),
                        confidence=min(scale_up_score / 100.0, 1.0),
                        metrics=scaling_metrics,
                        cost_impact=0.0,  # Will be calculated later
                        timestamp=datetime.utcnow()
                    )
            
            elif scale_down_score > confidence_threshold and scale_down_score > scale_up_score:
                # Scale down
                scaling_factor = min(scale_down_score / 100.0, 0.5)  # Max 50% reduction
                target_replicas = max(
                    int(current_replicas * (1 - scaling_factor)),
                    endpoint.min_replicas
                )
                
                if target_replicas < current_replicas:
                    return ScalingDecision(
                        endpoint_id=endpoint.endpoint_id,
                        direction=ScalingDirection.DOWN,
                        current_replicas=current_replicas,
                        target_replicas=target_replicas,
                        trigger=self._determine_primary_trigger(scaling_metrics, scale_up=False),
                        confidence=min(scale_down_score / 100.0, 1.0),
                        metrics=scaling_metrics,
                        cost_impact=0.0,  # Will be calculated later
                        timestamp=datetime.utcnow()
                    )
            
            # No scaling needed
            return ScalingDecision(
                endpoint_id=endpoint.endpoint_id,
                direction=ScalingDirection.STABLE,
                current_replicas=current_replicas,
                target_replicas=current_replicas,
                trigger=ScalingTrigger.CPU_UTILIZATION,
                confidence=0.0,
                metrics=scaling_metrics,
                cost_impact=0.0,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logging.error(f"Scaling decision failed: {e}")
            return None
    
    def _determine_primary_trigger(self, metrics: List[ScalingMetric], scale_up: bool) -> ScalingTrigger:
        """Determine primary trigger for scaling decision."""
        trigger_map = {
            'cpu_utilization': ScalingTrigger.CPU_UTILIZATION,
            'memory_utilization': ScalingTrigger.MEMORY_UTILIZATION,
            'latency': ScalingTrigger.LATENCY,
            'queue_size': ScalingTrigger.QUEUE_SIZE,
            'error_rate': ScalingTrigger.ERROR_RATE
        }
        
        # Find metric with highest deviation
        max_deviation = 0
        primary_trigger = ScalingTrigger.CPU_UTILIZATION
        
        for metric in metrics:
            if metric.target_value > 0:
                deviation = abs(metric.current_value - metric.target_value) / metric.target_value
                if deviation > max_deviation:
                    max_deviation = deviation
                    primary_trigger = trigger_map.get(metric.name, ScalingTrigger.CPU_UTILIZATION)
        
        return primary_trigger
    
    async def _validate_scaling_decision(self, decision: ScalingDecision, 
                                       endpoint: ServingEndpoint) -> Optional[ScalingDecision]:
        """Validate scaling decision with cost analysis and constraints."""
        try:
            # Calculate cost impact
            cost_analysis = self.cost_optimizer.calculate_scaling_cost(
                endpoint_id=decision.endpoint_id,
                current_replicas=decision.current_replicas,
                target_replicas=decision.target_replicas,
                instance_type=endpoint.instance_type or 'balanced',
                duration_hours=1.0
            )
            
            decision.cost_impact = cost_analysis['cost_delta']
            
            # Validate constraints
            if decision.target_replicas < endpoint.min_replicas:
                decision.target_replicas = endpoint.min_replicas
            elif decision.target_replicas > endpoint.max_replicas:
                decision.target_replicas = endpoint.max_replicas
            
            # Check if scaling is justified by cost
            if decision.direction == ScalingDirection.DOWN:
                if not self.cost_optimizer.should_scale_for_cost(cost_analysis):
                    logging.info(f"Scaling down not cost-effective for {decision.endpoint_id}")
                    return None
            
            # Check if change is significant enough
            if decision.current_replicas == decision.target_replicas:
                return None
            
            return decision
            
        except Exception as e:
            logging.error(f"Scaling validation failed: {e}")
            return None
    
    def _record_scaling_decision(self, endpoint_id: str, decision: ScalingDecision):
        """Record scaling decision in history."""
        if endpoint_id not in self.scaling_history:
            self.scaling_history[endpoint_id] = []
        
        self.scaling_history[endpoint_id].append(decision)
        
        # Keep only recent decisions (last 100)
        if len(self.scaling_history[endpoint_id]) > 100:
            self.scaling_history[endpoint_id] = self.scaling_history[endpoint_id][-100:]
    
    async def execute_scaling_decision(self, decision: ScalingDecision) -> bool:
        """Execute scaling decision."""
        try:
            # Update endpoint replicas in database
            endpoint = self.db.query(ServingEndpoint).filter(
                ServingEndpoint.endpoint_id == decision.endpoint_id
            ).first()
            
            if not endpoint:
                return False
            
            # Update deployment configuration
            deployment = self.db.query(ModelDeployment).filter(
                ModelDeployment.deployment_id == endpoint.deployment_id
            ).first()
            
            if deployment:
                deployment.replicas = decision.target_replicas
                auto_scaling = deployment.auto_scaling or {}
                auto_scaling['last_scaled_at'] = datetime.utcnow().isoformat()
                auto_scaling['scaling_decision'] = asdict(decision)
                deployment.auto_scaling = auto_scaling
            
            # Update endpoint status
            endpoint.status = "scaling"
            self.db.commit()
            
            # In production, this would trigger actual scaling in Kubernetes
            # For now, simulate the scaling
            await asyncio.sleep(1)
            
            # Mark scaling as complete
            endpoint.status = "active"
            self.db.commit()
            
            logging.info(f"Scaled {decision.endpoint_id} from {decision.current_replicas} to {decision.target_replicas} replicas")
            return True
            
        except Exception as e:
            logging.error(f"Failed to execute scaling for {decision.endpoint_id}: {e}")
            self.db.rollback()
            return False
    
    async def run_auto_scaling_loop(self, serving_engine, check_interval: int = 60):
        """Run continuous auto-scaling monitoring loop."""
        logging.info("Starting auto-scaling monitoring loop")
        
        while True:
            try:
                # Get all active endpoints
                endpoints = self.db.query(ServingEndpoint).filter(
                    ServingEndpoint.status == "active"
                ).all()
                
                # Evaluate scaling needs for each endpoint
                for endpoint in endpoints:
                    try:
                        decision = await self.evaluate_scaling_needs(
                            endpoint.endpoint_id, 
                            serving_engine
                        )
                        
                        if decision and decision.direction != ScalingDirection.STABLE:
                            # Execute scaling decision
                            success = await self.execute_scaling_decision(decision)
                            if success:
                                logging.info(f"Auto-scaling successful: {decision.endpoint_id} -> {decision.target_replicas} replicas")
                            else:
                                logging.error(f"Auto-scaling failed: {decision.endpoint_id}")
                    
                    except Exception as e:
                        logging.error(f"Auto-scaling evaluation failed for {endpoint.endpoint_id}: {e}")
                
                # Wait before next check
                await asyncio.sleep(check_interval)
                
            except Exception as e:
                logging.error(f"Auto-scaling loop error: {e}")
                await asyncio.sleep(check_interval)
    
    def get_scaling_history(self, endpoint_id: str, limit: int = 50) -> List[Dict]:
        """Get scaling history for endpoint."""
        history = self.scaling_history.get(endpoint_id, [])
        return [asdict(decision) for decision in history[-limit:]]
    
    def get_scaling_recommendations(self, endpoint_id: str) -> Dict[str, Any]:
        """Get scaling recommendations for endpoint."""
        try:
            history = self.scaling_history.get(endpoint_id, [])
            if not history:
                return {'recommendations': 'insufficient_data'}
            
            recent_decisions = [d for d in history if 
                              (datetime.utcnow() - d.timestamp).total_seconds() < 86400]  # Last 24 hours
            
            if not recent_decisions:
                return {'recommendations': 'no_recent_activity'}
            
            # Analyze patterns
            scale_up_count = len([d for d in recent_decisions if d.direction == ScalingDirection.UP])
            scale_down_count = len([d for d in recent_decisions if d.direction == ScalingDirection.DOWN])
            
            # Common triggers
            triggers = [d.trigger.value for d in recent_decisions]
            trigger_counts = {t: triggers.count(t) for t in set(triggers)}
            most_common_trigger = max(trigger_counts, key=trigger_counts.get) if trigger_counts else None
            
            # Cost analysis
            total_cost_impact = sum(d.cost_impact for d in recent_decisions)
            
            recommendations = {
                'scaling_frequency': len(recent_decisions),
                'scale_up_frequency': scale_up_count,
                'scale_down_frequency': scale_down_count,
                'most_common_trigger': most_common_trigger,
                'total_cost_impact_24h': total_cost_impact,
                'pattern_analysis': {
                    'stable': scale_up_count == scale_down_count == 0,
                    'growing': scale_up_count > scale_down_count,
                    'shrinking': scale_down_count > scale_up_count,
                    'oscillating': abs(scale_up_count - scale_down_count) <= 1 and (scale_up_count + scale_down_count) > 4
                }
            }
            
            # Generate recommendations
            if recommendations['pattern_analysis']['oscillating']:
                recommendations['advice'] = 'Consider adjusting scaling thresholds to reduce oscillation'
            elif recommendations['pattern_analysis']['growing']:
                recommendations['advice'] = 'Consider increasing min_replicas to handle baseline load'
            elif recommendations['pattern_analysis']['stable']:
                recommendations['advice'] = 'Scaling configuration appears optimal'
            
            return recommendations
            
        except Exception as e:
            logging.error(f"Failed to get scaling recommendations: {e}")
            return {'error': str(e)}


# Global auto-scaling manager instance
_auto_scaling_manager = None


def get_auto_scaling_manager(db: Session) -> AutoScalingManager:
    """Get auto-scaling manager instance."""
    global _auto_scaling_manager
    if _auto_scaling_manager is None:
        _auto_scaling_manager = AutoScalingManager(db)
    return _auto_scaling_manager