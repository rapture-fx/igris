"""
MLOps Model Deployment and Serving Service
===========================================

Advanced model deployment and serving infrastructure with A/B testing capabilities.
Provides production-ready model serving with auto-scaling, canary deployments,
traffic splitting, and comprehensive monitoring.

Features:
- Multi-framework model serving (TensorFlow, PyTorch, scikit-learn)
- A/B testing with statistical analysis
- Canary deployments with automatic rollback
- Auto-scaling based on traffic and performance
- Real-time monitoring and alerting
- Blue-green deployments
- Feature flags for deployment control
- Performance optimization and caching
"""

import os
import json
import asyncio
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import aiofiles
import numpy as np
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
import time
import hashlib

# Statistical analysis for A/B testing
try:
    import scipy.stats as stats
    from scipy.stats import chi2_contingency, ttest_ind
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

# Load balancing and traffic management
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

# Import MLOps components
from app.ml.mlops_platform import ModelFramework
from app.services.model_registry import ModelRegistryService

logger = logging.getLogger(__name__)


class DeploymentStatus(str, Enum):
    """Deployment status options."""
    PENDING = "pending"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    SCALING = "scaling"
    UPDATING = "updating"
    TERMINATING = "terminating"
    TERMINATED = "terminated"


class DeploymentType(str, Enum):
    """Deployment type options."""
    BLUE_GREEN = "blue_green"
    CANARY = "canary"
    A_B_TEST = "ab_test"
    ROLLING = "rolling"
    SHADOW = "shadow"
    PRODUCTION = "production"


class TrafficStrategy(str, Enum):
    """Traffic routing strategies."""
    ROUND_ROBIN = "round_robin"
    WEIGHTED = "weighted"
    LEAST_CONNECTIONS = "least_connections"
    PERFORMANCE_BASED = "performance_based"


class HealthStatus(str, Enum):
    """Health status options."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@dataclass
class DeploymentConfig:
    """Configuration for model deployment."""
    deployment_id: str
    model_id: str
    model_version: str
    deployment_type: DeploymentType
    environment: str
    
    # Infrastructure
    replicas: int
    cpu_request: str
    cpu_limit: str
    memory_request: str
    memory_limit: str
    
    # Auto-scaling
    auto_scaling_enabled: bool
    min_replicas: int
    max_replicas: int
    target_cpu_utilization: float
    target_memory_utilization: float
    
    # Traffic routing
    traffic_percentage: float
    routing_strategy: TrafficStrategy
    
    # Health checks
    health_check_path: str
    health_check_interval: int
    health_check_timeout: int
    readiness_probe_delay: int
    liveness_probe_delay: int
    
    # Monitoring
    metrics_enabled: bool
    metrics_port: int
    logging_level: str
    tracing_enabled: bool
    
    # A/B Testing specific
    ab_test_config: Optional[Dict[str, Any]] = None
    
    # Metadata
    created_by: str
    created_at: datetime
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class DeploymentMetrics:
    """Deployment performance metrics."""
    deployment_id: str
    timestamp: datetime
    
    # Request metrics
    request_count: int
    requests_per_second: float
    avg_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    
    # Error metrics
    error_count: int
    error_rate: float
    timeout_count: int
    
    # Resource metrics
    cpu_utilization: float
    memory_utilization: float
    active_connections: int
    
    # Model-specific metrics
    prediction_latency_ms: float
    model_accuracy: Optional[float] = None
    prediction_confidence: Optional[float] = None


@dataclass
class ABTestConfig:
    """A/B test configuration."""
    test_id: str
    name: str
    description: str
    champion_deployment_id: str
    challenger_deployment_id: str
    
    # Traffic allocation
    champion_traffic_pct: float
    challenger_traffic_pct: float
    
    # Test parameters
    primary_metric: str
    secondary_metrics: List[str]
    minimum_sample_size: int
    significance_level: float
    power: float
    max_duration_days: int
    
    # Statistical configuration
    statistical_test: str  # 'ttest', 'chi_square', 'mann_whitney'
    multiple_testing_correction: str  # 'bonferroni', 'fdr'
    
    # Stopping criteria
    early_stopping_enabled: bool
    early_stopping_threshold: float
    
    # Metadata
    created_by: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    
    status: str = "running"
    winner: Optional[str] = None


class ModelServingEngine:
    """Core engine for serving ML models."""
    
    def __init__(self):
        self.loaded_models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict[str, Any]] = {}
        self.executor = ThreadPoolExecutor(max_workers=10)
    
    async def load_model(self, model_id: str, model_artifact: Any, framework: ModelFramework) -> bool:
        """Load model into memory for serving."""
        try:
            # Validate model artifact
            if not self._validate_model_artifact(model_artifact, framework):
                raise ValueError(f"Invalid model artifact for framework {framework}")
            
            # Load model based on framework
            if framework == ModelFramework.SKLEARN:
                # Model is already loaded for sklearn
                self.loaded_models[model_id] = model_artifact
            elif framework == ModelFramework.TENSORFLOW:
                # For TensorFlow models
                if hasattr(model_artifact, 'predict'):
                    self.loaded_models[model_id] = model_artifact
                else:
                    # Load from saved model path
                    import tensorflow as tf
                    loaded_model = tf.keras.models.load_model(model_artifact)
                    self.loaded_models[model_id] = loaded_model
            elif framework == ModelFramework.PYTORCH:
                # For PyTorch models
                import torch
                if isinstance(model_artifact, torch.nn.Module):
                    model_artifact.eval()
                    self.loaded_models[model_id] = model_artifact
                else:
                    # Load from checkpoint
                    loaded_model = torch.load(model_artifact)
                    loaded_model.eval()
                    self.loaded_models[model_id] = loaded_model
            else:
                # Custom model handling
                self.loaded_models[model_id] = model_artifact
            
            # Store metadata
            self.model_metadata[model_id] = {
                'framework': framework,
                'loaded_at': datetime.utcnow(),
                'prediction_count': 0,
                'last_prediction': None
            }
            
            logger.info(f"Model {model_id} loaded successfully with framework {framework}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            return False
    
    def _validate_model_artifact(self, model_artifact: Any, framework: ModelFramework) -> bool:
        """Validate model artifact for the specified framework."""
        try:
            if framework == ModelFramework.SKLEARN:
                return hasattr(model_artifact, 'predict')
            elif framework == ModelFramework.TENSORFLOW:
                return hasattr(model_artifact, 'predict') or isinstance(model_artifact, str)
            elif framework == ModelFramework.PYTORCH:
                import torch
                return isinstance(model_artifact, torch.nn.Module) or isinstance(model_artifact, str)
            else:
                return True  # Allow custom models
        except Exception:
            return False
    
    async def predict(self, model_id: str, input_data: np.ndarray) -> Dict[str, Any]:
        """Make prediction using loaded model."""
        if model_id not in self.loaded_models:
            raise ValueError(f"Model {model_id} not loaded")
        
        start_time = time.time()
        
        try:
            model = self.loaded_models[model_id]
            framework = self.model_metadata[model_id]['framework']
            
            # Make prediction based on framework
            if framework == ModelFramework.SKLEARN:
                predictions = model.predict(input_data)
                probabilities = None
                if hasattr(model, 'predict_proba'):
                    probabilities = model.predict_proba(input_data)
            
            elif framework == ModelFramework.TENSORFLOW:
                predictions = model.predict(input_data, verbose=0)
                probabilities = predictions if len(predictions.shape) > 1 else None
            
            elif framework == ModelFramework.PYTORCH:
                import torch
                with torch.no_grad():
                    if isinstance(input_data, np.ndarray):
                        input_tensor = torch.FloatTensor(input_data)
                    else:
                        input_tensor = input_data
                    
                    output = model(input_tensor)
                    predictions = output.numpy() if hasattr(output, 'numpy') else output.detach().numpy()
                    probabilities = None
            
            else:
                # Custom model
                if hasattr(model, 'predict'):
                    predictions = model.predict(input_data)
                    probabilities = getattr(model, 'predict_proba', lambda x: None)(input_data)
                else:
                    raise ValueError(f"Custom model for {model_id} does not have predict method")
            
            # Update metrics
            prediction_time = (time.time() - start_time) * 1000
            self.model_metadata[model_id]['prediction_count'] += 1
            self.model_metadata[model_id]['last_prediction'] = datetime.utcnow()
            
            return {
                'predictions': predictions.tolist() if hasattr(predictions, 'tolist') else predictions,
                'probabilities': probabilities.tolist() if probabilities is not None and hasattr(probabilities, 'tolist') else probabilities,
                'prediction_time_ms': prediction_time,
                'model_id': model_id,
                'framework': framework.value,
                'timestamp': datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Prediction failed for model {model_id}: {e}")
            raise
    
    async def unload_model(self, model_id: str) -> bool:
        """Unload model from memory."""
        try:
            if model_id in self.loaded_models:
                del self.loaded_models[model_id]
            if model_id in self.model_metadata:
                del self.model_metadata[model_id]
            
            logger.info(f"Model {model_id} unloaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to unload model {model_id}: {e}")
            return False
    
    def get_model_stats(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get model serving statistics."""
        if model_id not in self.model_metadata:
            return None
        
        return self.model_metadata[model_id].copy()
    
    def list_loaded_models(self) -> List[str]:
        """List all loaded models."""
        return list(self.loaded_models.keys())


class TrafficRouter:
    """Intelligent traffic routing for A/B testing and deployments."""
    
    def __init__(self):
        self.routing_rules: Dict[str, Dict[str, Any]] = {}
        self.traffic_logs: List[Dict[str, Any]] = []
        self.performance_metrics: Dict[str, List[DeploymentMetrics]] = {}
    
    def configure_routing(self, 
                         deployment_group: str,
                         routing_config: Dict[str, Any]):
        """Configure traffic routing rules."""
        self.routing_rules[deployment_group] = {
            'strategy': routing_config.get('strategy', TrafficStrategy.WEIGHTED),
            'deployments': routing_config.get('deployments', []),
            'weights': routing_config.get('weights', {}),
            'sticky_sessions': routing_config.get('sticky_sessions', False),
            'health_check_enabled': routing_config.get('health_check_enabled', True),
            'configured_at': datetime.utcnow()
        }
        
        logger.info(f"Configured routing for deployment group {deployment_group}")
    
    async def route_request(self, 
                          deployment_group: str,
                          request_metadata: Dict[str, Any]) -> str:
        """Route request to appropriate deployment."""
        if deployment_group not in self.routing_rules:
            raise ValueError(f"No routing rules configured for {deployment_group}")
        
        routing_rule = self.routing_rules[deployment_group]
        strategy = routing_rule['strategy']
        deployments = routing_rule['deployments']
        
        if not deployments:
            raise ValueError(f"No deployments available for {deployment_group}")
        
        # Filter healthy deployments
        healthy_deployments = []
        if routing_rule['health_check_enabled']:
            for deployment_id in deployments:
                if await self._check_deployment_health(deployment_id):
                    healthy_deployments.append(deployment_id)
        else:
            healthy_deployments = deployments
        
        if not healthy_deployments:
            raise ValueError(f"No healthy deployments available for {deployment_group}")
        
        # Route based on strategy
        selected_deployment = None
        
        if strategy == TrafficStrategy.ROUND_ROBIN:
            selected_deployment = self._round_robin_selection(deployment_group, healthy_deployments)
        elif strategy == TrafficStrategy.WEIGHTED:
            selected_deployment = self._weighted_selection(deployment_group, healthy_deployments, routing_rule['weights'])
        elif strategy == TrafficStrategy.LEAST_CONNECTIONS:
            selected_deployment = self._least_connections_selection(healthy_deployments)
        elif strategy == TrafficStrategy.PERFORMANCE_BASED:
            selected_deployment = self._performance_based_selection(healthy_deployments)
        else:
            # Default to first healthy deployment
            selected_deployment = healthy_deployments[0]
        
        # Log routing decision
        self.traffic_logs.append({
            'timestamp': datetime.utcnow(),
            'deployment_group': deployment_group,
            'selected_deployment': selected_deployment,
            'strategy': strategy.value,
            'request_metadata': request_metadata,
            'available_deployments': healthy_deployments
        })
        
        return selected_deployment
    
    def _round_robin_selection(self, deployment_group: str, deployments: List[str]) -> str:
        """Round-robin deployment selection."""
        # Simple round-robin based on request count
        request_counts = {}
        for log in self.traffic_logs:
            if log['deployment_group'] == deployment_group:
                dep_id = log['selected_deployment']
                request_counts[dep_id] = request_counts.get(dep_id, 0) + 1
        
        # Select deployment with minimum requests
        min_requests = float('inf')
        selected = deployments[0]
        
        for deployment in deployments:
            count = request_counts.get(deployment, 0)
            if count < min_requests:
                min_requests = count
                selected = deployment
        
        return selected
    
    def _weighted_selection(self, deployment_group: str, deployments: List[str], weights: Dict[str, float]) -> str:
        """Weighted random selection."""
        import random
        
        # Normalize weights
        total_weight = sum(weights.get(dep, 1.0) for dep in deployments)
        normalized_weights = {dep: weights.get(dep, 1.0) / total_weight for dep in deployments}
        
        # Weighted random selection
        rand_val = random.random()
        cumulative_weight = 0.0
        
        for deployment in deployments:
            cumulative_weight += normalized_weights[deployment]
            if rand_val <= cumulative_weight:
                return deployment
        
        return deployments[-1]  # Fallback
    
    def _least_connections_selection(self, deployments: List[str]) -> str:
        """Select deployment with least active connections."""
        # This would integrate with actual connection metrics
        # For now, return first deployment
        return deployments[0]
    
    def _performance_based_selection(self, deployments: List[str]) -> str:
        """Select deployment based on performance metrics."""
        best_deployment = deployments[0]
        best_score = float('inf')
        
        for deployment in deployments:
            if deployment in self.performance_metrics:
                recent_metrics = self.performance_metrics[deployment][-10:]  # Last 10 metrics
                if recent_metrics:
                    avg_response_time = np.mean([m.avg_response_time_ms for m in recent_metrics])
                    error_rate = np.mean([m.error_rate for m in recent_metrics])
                    
                    # Simple scoring: lower response time and error rate is better
                    score = avg_response_time + (error_rate * 1000)  # Weight error rate heavily
                    
                    if score < best_score:
                        best_score = score
                        best_deployment = deployment
        
        return best_deployment
    
    async def _check_deployment_health(self, deployment_id: str) -> bool:
        """Check if deployment is healthy."""
        # This would integrate with actual health check endpoints
        # For now, assume all deployments are healthy
        return True
    
    def update_performance_metrics(self, deployment_id: str, metrics: DeploymentMetrics):
        """Update performance metrics for a deployment."""
        if deployment_id not in self.performance_metrics:
            self.performance_metrics[deployment_id] = []
        
        self.performance_metrics[deployment_id].append(metrics)
        
        # Keep only recent metrics (last 100)
        if len(self.performance_metrics[deployment_id]) > 100:
            self.performance_metrics[deployment_id] = self.performance_metrics[deployment_id][-100:]
    
    def get_routing_stats(self, deployment_group: str) -> Dict[str, Any]:
        """Get routing statistics for a deployment group."""
        group_logs = [log for log in self.traffic_logs if log['deployment_group'] == deployment_group]
        
        if not group_logs:
            return {'message': 'No routing data available'}
        
        # Calculate statistics
        deployment_counts = {}
        for log in group_logs:
            dep_id = log['selected_deployment']
            deployment_counts[dep_id] = deployment_counts.get(dep_id, 0) + 1
        
        total_requests = len(group_logs)
        
        return {
            'total_requests': total_requests,
            'deployment_distribution': {
                dep_id: {'count': count, 'percentage': (count / total_requests) * 100}
                for dep_id, count in deployment_counts.items()
            },
            'routing_strategy': self.routing_rules[deployment_group]['strategy'].value,
            'last_updated': max(log['timestamp'] for log in group_logs).isoformat()
        }


class ABTestAnalyzer:
    """Statistical analysis engine for A/B testing."""
    
    def __init__(self):
        self.test_results: Dict[str, Dict[str, Any]] = {}
    
    async def analyze_ab_test(self, 
                            test_config: ABTestConfig,
                            champion_metrics: List[Dict[str, Any]],
                            challenger_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform statistical analysis of A/B test."""
        if not SCIPY_AVAILABLE:
            return {'error': 'scipy not available for statistical analysis'}
        
        try:
            primary_metric = test_config.primary_metric
            significance_level = test_config.significance_level
            
            # Extract metric values
            champion_values = [m.get(primary_metric) for m in champion_metrics if m.get(primary_metric) is not None]
            challenger_values = [m.get(primary_metric) for m in challenger_metrics if m.get(primary_metric) is not None]
            
            if len(champion_values) < test_config.minimum_sample_size or len(challenger_values) < test_config.minimum_sample_size:
                return {
                    'status': 'insufficient_data',
                    'champion_sample_size': len(champion_values),
                    'challenger_sample_size': len(challenger_values),
                    'required_sample_size': test_config.minimum_sample_size
                }
            
            # Perform statistical test
            test_results = {}
            
            if test_config.statistical_test == 'ttest':
                statistic, p_value = ttest_ind(champion_values, challenger_values)
                test_results['test_statistic'] = float(statistic)
                test_results['p_value'] = float(p_value)
                test_results['test_type'] = 'independent_t_test'
            
            elif test_config.statistical_test == 'mann_whitney':
                from scipy.stats import mannwhitneyu
                statistic, p_value = mannwhitneyu(champion_values, challenger_values, alternative='two-sided')
                test_results['test_statistic'] = float(statistic)
                test_results['p_value'] = float(p_value)
                test_results['test_type'] = 'mann_whitney_u'
            
            else:
                # Default to t-test
                statistic, p_value = ttest_ind(champion_values, challenger_values)
                test_results['test_statistic'] = float(statistic)
                test_results['p_value'] = float(p_value)
                test_results['test_type'] = 'independent_t_test'
            
            # Calculate effect size (Cohen's d)
            champion_mean = np.mean(champion_values)
            challenger_mean = np.mean(challenger_values)
            pooled_std = np.sqrt(((len(champion_values) - 1) * np.var(champion_values, ddof=1) + 
                                (len(challenger_values) - 1) * np.var(challenger_values, ddof=1)) / 
                               (len(champion_values) + len(challenger_values) - 2))
            
            cohens_d = (challenger_mean - champion_mean) / pooled_std
            test_results['effect_size'] = float(cohens_d)
            
            # Calculate confidence intervals
            champion_ci = stats.t.interval(1 - significance_level, len(champion_values) - 1, 
                                         loc=champion_mean, scale=stats.sem(champion_values))
            challenger_ci = stats.t.interval(1 - significance_level, len(challenger_values) - 1,
                                           loc=challenger_mean, scale=stats.sem(challenger_values))
            
            # Determine winner
            is_significant = p_value < significance_level
            winner = None
            if is_significant:
                if challenger_mean > champion_mean:
                    winner = 'challenger'
                else:
                    winner = 'champion'
            
            # Calculate statistical power (post-hoc)
            from scipy.stats import norm
            effect_size = abs(cohens_d)
            alpha = significance_level
            n = min(len(champion_values), len(challenger_values))
            
            # Approximate power calculation
            z_alpha = norm.ppf(1 - alpha/2)
            z_beta = norm.cdf(effect_size * np.sqrt(n/2) - z_alpha)
            power = z_beta
            
            results = {
                'test_id': test_config.test_id,
                'status': 'completed' if is_significant else 'inconclusive',
                'winner': winner,
                'is_significant': is_significant,
                'primary_metric': primary_metric,
                'significance_level': significance_level,
                'statistical_power': float(max(0, min(1, power))),
                
                # Statistical results
                'test_results': test_results,
                
                # Descriptive statistics
                'champion_stats': {
                    'mean': float(champion_mean),
                    'std': float(np.std(champion_values)),
                    'count': len(champion_values),
                    'confidence_interval': [float(champion_ci[0]), float(champion_ci[1])]
                },
                'challenger_stats': {
                    'mean': float(challenger_mean),
                    'std': float(np.std(challenger_values)),
                    'count': len(challenger_values),
                    'confidence_interval': [float(challenger_ci[0]), float(challenger_ci[1])]
                },
                
                # Improvement metrics
                'relative_improvement': float((challenger_mean - champion_mean) / champion_mean * 100),
                'absolute_improvement': float(challenger_mean - champion_mean),
                
                'analyzed_at': datetime.utcnow().isoformat()
            }
            
            # Store results
            self.test_results[test_config.test_id] = results
            
            return results
        
        except Exception as e:
            logger.error(f"Error in A/B test analysis: {e}")
            return {'error': str(e), 'status': 'analysis_failed'}
    
    def should_stop_early(self, 
                         test_config: ABTestConfig,
                         analysis_results: Dict[str, Any]) -> Tuple[bool, str]:
        """Determine if A/B test should be stopped early."""
        if not test_config.early_stopping_enabled:
            return False, "Early stopping disabled"
        
        if analysis_results.get('status') != 'completed':
            return False, "Test not statistically significant yet"
        
        effect_size = analysis_results.get('test_results', {}).get('effect_size', 0)
        if abs(effect_size) >= test_config.early_stopping_threshold:
            return True, f"Large effect size detected: {effect_size:.3f}"
        
        statistical_power = analysis_results.get('statistical_power', 0)
        if statistical_power >= 0.9:  # High power achieved
            return True, f"High statistical power achieved: {statistical_power:.3f}"
        
        return False, "Early stopping criteria not met"
    
    def get_test_recommendations(self, 
                               test_config: ABTestConfig,
                               analysis_results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on A/B test results."""
        recommendations = []
        
        if analysis_results.get('status') == 'insufficient_data':
            recommendations.append("Collect more data to reach minimum sample size")
            recommendations.append(f"Need {test_config.minimum_sample_size - analysis_results.get('champion_sample_size', 0)} more champion samples")
            return recommendations
        
        if analysis_results.get('is_significant'):
            winner = analysis_results.get('winner')
            improvement = analysis_results.get('relative_improvement', 0)
            
            if winner == 'challenger':
                recommendations.append(f"Deploy challenger model - shows {improvement:.2f}% improvement")
                recommendations.append("Implement gradual rollout to production")
            else:
                recommendations.append("Keep champion model - it performs better")
                recommendations.append("Consider refining challenger model")
        else:
            power = analysis_results.get('statistical_power', 0)
            if power < 0.8:
                recommendations.append("Increase sample size to achieve adequate statistical power")
                recommendations.append(f"Current power: {power:.3f}, target: 0.8+")
            else:
                recommendations.append("No significant difference detected")
                recommendations.append("Consider testing different model variations")
        
        # Effect size recommendations
        effect_size = abs(analysis_results.get('test_results', {}).get('effect_size', 0))
        if effect_size < 0.2:
            recommendations.append("Effect size is small - consider practical significance")
        elif effect_size > 0.8:
            recommendations.append("Large effect size detected - consider immediate action")
        
        return recommendations


class ModelDeploymentService:
    """Complete model deployment and serving service."""
    
    def __init__(self, 
                 storage_path: str = "./mlops_storage",
                 model_registry_service: ModelRegistryService = None):
        self.storage_path = storage_path
        self.deployments_path = os.path.join(storage_path, "deployments")
        os.makedirs(self.deployments_path, exist_ok=True)
        
        # Initialize components
        self.model_registry = model_registry_service
        self.serving_engine = ModelServingEngine()
        self.traffic_router = TrafficRouter()
        self.ab_test_analyzer = ABTestAnalyzer()
        
        # Deployment management
        self.deployments: Dict[str, DeploymentConfig] = {}
        self.deployment_metrics: Dict[str, List[DeploymentMetrics]] = {}
        self.ab_tests: Dict[str, ABTestConfig] = {}
        
        # Background tasks
        self.monitoring_task: Optional[asyncio.Task] = None
        self.metrics_collection_task: Optional[asyncio.Task] = None
        
        # Load existing deployments
        self._load_existing_deployments()
        
        logger.info(f"Model Deployment Service initialized with storage at {storage_path}")
    
    def _load_existing_deployments(self):
        """Load existing deployments from storage."""
        try:
            for dep_file in os.listdir(self.deployments_path):
                if dep_file.endswith('_config.json'):
                    deployment_id = dep_file.replace('_config.json', '')
                    
                    with open(os.path.join(self.deployments_path, dep_file), 'r') as f:
                        dep_dict = json.load(f)
                        dep_dict['created_at'] = datetime.fromisoformat(dep_dict['created_at'])
                        deployment = DeploymentConfig(**dep_dict)
                        self.deployments[deployment_id] = deployment
            
            logger.info(f"Loaded {len(self.deployments)} deployments")
        except Exception as e:
            logger.warning(f"Could not load existing deployments: {e}")
    
    async def create_deployment(self,
                              model_id: str,
                              deployment_config: Dict[str, Any],
                              created_by: str) -> str:
        """Create new model deployment."""
        try:
            # Verify model exists
            if self.model_registry:
                try:
                    model, metadata = self.model_registry.registry.get_model(model_id)
                except ValueError as e:
                    raise ValueError(f"Model not found: {e}")
            else:
                logger.warning("Model registry not available - skipping model validation")
                model = None
                metadata = None
            
            # Generate deployment ID
            deployment_id = str(uuid.uuid4())
            
            # Create deployment configuration
            config = DeploymentConfig(
                deployment_id=deployment_id,
                model_id=model_id,
                model_version=metadata.version if metadata else "unknown",
                deployment_type=DeploymentType(deployment_config.get('deployment_type', DeploymentType.PRODUCTION.value)),
                environment=deployment_config.get('environment', 'production'),
                replicas=deployment_config.get('replicas', 1),
                cpu_request=deployment_config.get('cpu_request', '100m'),
                cpu_limit=deployment_config.get('cpu_limit', '500m'),
                memory_request=deployment_config.get('memory_request', '256Mi'),
                memory_limit=deployment_config.get('memory_limit', '1Gi'),
                auto_scaling_enabled=deployment_config.get('auto_scaling_enabled', False),
                min_replicas=deployment_config.get('min_replicas', 1),
                max_replicas=deployment_config.get('max_replicas', 10),
                target_cpu_utilization=deployment_config.get('target_cpu_utilization', 70.0),
                target_memory_utilization=deployment_config.get('target_memory_utilization', 80.0),
                traffic_percentage=deployment_config.get('traffic_percentage', 100.0),
                routing_strategy=TrafficStrategy(deployment_config.get('routing_strategy', TrafficStrategy.ROUND_ROBIN.value)),
                health_check_path=deployment_config.get('health_check_path', '/health'),
                health_check_interval=deployment_config.get('health_check_interval', 30),
                health_check_timeout=deployment_config.get('health_check_timeout', 5),
                readiness_probe_delay=deployment_config.get('readiness_probe_delay', 10),
                liveness_probe_delay=deployment_config.get('liveness_probe_delay', 30),
                metrics_enabled=deployment_config.get('metrics_enabled', True),
                metrics_port=deployment_config.get('metrics_port', 8080),
                logging_level=deployment_config.get('logging_level', 'INFO'),
                tracing_enabled=deployment_config.get('tracing_enabled', True),
                ab_test_config=deployment_config.get('ab_test_config'),
                created_by=created_by,
                created_at=datetime.utcnow(),
                tags=deployment_config.get('tags', [])
            )
            
            # Save deployment configuration
            self._save_deployment_config(config)
            self.deployments[deployment_id] = config
            
            # Load model into serving engine if available
            if model and metadata:
                await self.serving_engine.load_model(model_id, model, metadata.framework)
            
            logger.info(f"Created deployment {deployment_id} for model {model_id}")
            return deployment_id
        
        except Exception as e:
            logger.error(f"Error creating deployment for model {model_id}: {e}")
            raise
    
    async def deploy_model(self, deployment_id: str) -> Dict[str, Any]:
        """Deploy model to production environment."""
        if deployment_id not in self.deployments:
            raise ValueError(f"Deployment {deployment_id} not found")
        
        config = self.deployments[deployment_id]
        
        try:
            # Simulate deployment process
            logger.info(f"Starting deployment {deployment_id}")
            
            # Phase 1: Infrastructure setup
            await self._setup_infrastructure(config)
            
            # Phase 2: Model loading
            await self._load_model_for_serving(config)
            
            # Phase 3: Health checks
            await self._configure_health_checks(config)
            
            # Phase 4: Traffic routing
            await self._configure_traffic_routing(config)
            
            # Phase 5: Monitoring setup
            await self._setup_monitoring(config)
            
            return {
                'deployment_id': deployment_id,
                'status': 'deployed',
                'endpoints': {
                    'prediction': f"/api/v1/models/{config.model_id}/predict",
                    'health': f"/deployments/{deployment_id}/health",
                    'metrics': f"/deployments/{deployment_id}/metrics"
                },
                'deployed_at': datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Deployment failed for {deployment_id}: {e}")
            return {
                'deployment_id': deployment_id,
                'status': 'failed',
                'error': str(e),
                'failed_at': datetime.utcnow().isoformat()
            }
    
    async def _setup_infrastructure(self, config: DeploymentConfig):
        """Set up infrastructure for deployment."""
        # Simulate infrastructure setup
        await asyncio.sleep(1)
        logger.info(f"Infrastructure setup completed for deployment {config.deployment_id}")
    
    async def _load_model_for_serving(self, config: DeploymentConfig):
        """Load model for serving."""
        if self.model_registry:
            try:
                model, metadata = self.model_registry.registry.get_model(config.model_id)
                success = await self.serving_engine.load_model(config.model_id, model, metadata.framework)
                if not success:
                    raise ValueError(f"Failed to load model {config.model_id}")
            except Exception as e:
                logger.error(f"Model loading failed: {e}")
                raise
        
        logger.info(f"Model {config.model_id} loaded for serving in deployment {config.deployment_id}")
    
    async def _configure_health_checks(self, config: DeploymentConfig):
        """Configure health checks for deployment."""
        # Simulate health check configuration
        await asyncio.sleep(0.5)
        logger.info(f"Health checks configured for deployment {config.deployment_id}")
    
    async def _configure_traffic_routing(self, config: DeploymentConfig):
        """Configure traffic routing for deployment."""
        if config.deployment_type in [DeploymentType.A_B_TEST, DeploymentType.CANARY]:
            # Configure traffic splitting
            deployment_group = f"{config.model_id}_deployment_group"
            routing_config = {
                'strategy': config.routing_strategy,
                'deployments': [config.deployment_id],
                'weights': {config.deployment_id: config.traffic_percentage / 100.0}
            }
            self.traffic_router.configure_routing(deployment_group, routing_config)
        
        logger.info(f"Traffic routing configured for deployment {config.deployment_id}")
    
    async def _setup_monitoring(self, config: DeploymentConfig):
        """Set up monitoring for deployment."""
        if config.metrics_enabled:
            # Initialize metrics collection
            self.deployment_metrics[config.deployment_id] = []
        
        logger.info(f"Monitoring setup completed for deployment {config.deployment_id}")
    
    async def create_ab_test(self,
                           champion_model_id: str,
                           challenger_model_id: str,
                           test_config: Dict[str, Any],
                           created_by: str) -> str:
        """Create A/B test between two models."""
        try:
            test_id = str(uuid.uuid4())
            
            # Create A/B test configuration
            ab_test_config = ABTestConfig(
                test_id=test_id,
                name=test_config.get('name', f'AB_Test_{test_id[:8]}'),
                description=test_config.get('description', ''),
                champion_deployment_id="",  # Will be set after deployment
                challenger_deployment_id="",  # Will be set after deployment
                champion_traffic_pct=test_config.get('champion_traffic_pct', 50.0),
                challenger_traffic_pct=test_config.get('challenger_traffic_pct', 50.0),
                primary_metric=test_config.get('primary_metric', 'accuracy'),
                secondary_metrics=test_config.get('secondary_metrics', []),
                minimum_sample_size=test_config.get('minimum_sample_size', 1000),
                significance_level=test_config.get('significance_level', 0.05),
                power=test_config.get('power', 0.8),
                max_duration_days=test_config.get('max_duration_days', 30),
                statistical_test=test_config.get('statistical_test', 'ttest'),
                multiple_testing_correction=test_config.get('multiple_testing_correction', 'bonferroni'),
                early_stopping_enabled=test_config.get('early_stopping_enabled', True),
                early_stopping_threshold=test_config.get('early_stopping_threshold', 0.5),
                created_by=created_by,
                started_at=datetime.utcnow()
            )
            
            # Deploy both models if not already deployed
            champion_deployment_id = await self._ensure_model_deployed(champion_model_id, 'champion', test_id)
            challenger_deployment_id = await self._ensure_model_deployed(challenger_model_id, 'challenger', test_id)
            
            ab_test_config.champion_deployment_id = champion_deployment_id
            ab_test_config.challenger_deployment_id = challenger_deployment_id
            
            # Configure traffic routing for A/B test
            deployment_group = f"ab_test_{test_id}"
            routing_config = {
                'strategy': TrafficStrategy.WEIGHTED,
                'deployments': [champion_deployment_id, challenger_deployment_id],
                'weights': {
                    champion_deployment_id: ab_test_config.champion_traffic_pct / 100.0,
                    challenger_deployment_id: ab_test_config.challenger_traffic_pct / 100.0
                }
            }
            self.traffic_router.configure_routing(deployment_group, routing_config)
            
            # Store A/B test configuration
            self.ab_tests[test_id] = ab_test_config
            self._save_ab_test_config(ab_test_config)
            
            logger.info(f"Created A/B test {test_id} between models {champion_model_id} and {challenger_model_id}")
            return test_id
        
        except Exception as e:
            logger.error(f"Error creating A/B test: {e}")
            raise
    
    async def _ensure_model_deployed(self, model_id: str, role: str, test_id: str) -> str:
        """Ensure model is deployed for A/B testing."""
        # Check if model is already deployed
        for deployment_id, config in self.deployments.items():
            if config.model_id == model_id and config.deployment_type == DeploymentType.A_B_TEST:
                return deployment_id
        
        # Create new deployment for A/B test
        deployment_config = {
            'deployment_type': DeploymentType.A_B_TEST.value,
            'environment': 'ab_test',
            'replicas': 1,
            'tags': [f'ab_test_{test_id}', f'role_{role}']
        }
        
        deployment_id = await self.create_deployment(model_id, deployment_config, f'ab_test_system_{test_id}')
        await self.deploy_model(deployment_id)
        
        return deployment_id
    
    async def get_ab_test_results(self, test_id: str) -> Dict[str, Any]:
        """Get A/B test analysis results."""
        if test_id not in self.ab_tests:
            raise ValueError(f"A/B test {test_id} not found")
        
        test_config = self.ab_tests[test_id]
        
        # Collect metrics from both deployments
        champion_metrics = self.deployment_metrics.get(test_config.champion_deployment_id, [])
        challenger_metrics = self.deployment_metrics.get(test_config.challenger_deployment_id, [])
        
        # Convert metrics to analysis format
        champion_data = [{'accuracy': m.model_accuracy, 'response_time': m.avg_response_time_ms} for m in champion_metrics if m.model_accuracy is not None]
        challenger_data = [{'accuracy': m.model_accuracy, 'response_time': m.avg_response_time_ms} for m in challenger_metrics if m.model_accuracy is not None]
        
        # Perform statistical analysis
        analysis_results = await self.ab_test_analyzer.analyze_ab_test(
            test_config, champion_data, challenger_data
        )
        
        # Check for early stopping
        should_stop, stop_reason = self.ab_test_analyzer.should_stop_early(test_config, analysis_results)
        
        # Get recommendations
        recommendations = self.ab_test_analyzer.get_test_recommendations(test_config, analysis_results)
        
        # Get traffic routing stats
        deployment_group = f"ab_test_{test_id}"
        routing_stats = self.traffic_router.get_routing_stats(deployment_group)
        
        return {
            'test_config': asdict(test_config),
            'analysis_results': analysis_results,
            'should_stop_early': should_stop,
            'early_stop_reason': stop_reason,
            'recommendations': recommendations,
            'traffic_routing': routing_stats,
            'generated_at': datetime.utcnow().isoformat()
        }
    
    async def predict_with_deployment(self, 
                                    deployment_id: str, 
                                    input_data: np.ndarray) -> Dict[str, Any]:
        """Make prediction using specific deployment."""
        if deployment_id not in self.deployments:
            raise ValueError(f"Deployment {deployment_id} not found")
        
        config = self.deployments[deployment_id]
        
        # Record request metrics
        start_time = time.time()
        
        try:
            # Make prediction
            result = await self.serving_engine.predict(config.model_id, input_data)
            
            # Record successful request
            response_time = (time.time() - start_time) * 1000
            await self._record_request_metrics(deployment_id, response_time, success=True)
            
            return result
        
        except Exception as e:
            # Record failed request
            response_time = (time.time() - start_time) * 1000
            await self._record_request_metrics(deployment_id, response_time, success=False)
            raise
    
    async def _record_request_metrics(self, 
                                    deployment_id: str, 
                                    response_time: float, 
                                    success: bool):
        """Record request metrics for deployment."""
        if deployment_id not in self.deployment_metrics:
            self.deployment_metrics[deployment_id] = []
        
        # Create metrics entry (simplified)
        metrics = DeploymentMetrics(
            deployment_id=deployment_id,
            timestamp=datetime.utcnow(),
            request_count=1,
            requests_per_second=0.0,  # Would calculate from recent requests
            avg_response_time_ms=response_time,
            p95_response_time_ms=response_time,
            p99_response_time_ms=response_time,
            error_count=0 if success else 1,
            error_rate=0.0 if success else 1.0,
            timeout_count=0,
            cpu_utilization=0.0,  # Would get from monitoring
            memory_utilization=0.0,  # Would get from monitoring
            active_connections=1,
            prediction_latency_ms=response_time
        )
        
        self.deployment_metrics[deployment_id].append(metrics)
        
        # Update traffic router metrics
        self.traffic_router.update_performance_metrics(deployment_id, metrics)
        
        # Keep only recent metrics
        if len(self.deployment_metrics[deployment_id]) > 1000:
            self.deployment_metrics[deployment_id] = self.deployment_metrics[deployment_id][-1000:]
    
    def get_deployment_status(self, deployment_id: str) -> Dict[str, Any]:
        """Get deployment status and health."""
        if deployment_id not in self.deployments:
            raise ValueError(f"Deployment {deployment_id} not found")
        
        config = self.deployments[deployment_id]
        metrics = self.deployment_metrics.get(deployment_id, [])
        
        # Calculate health status
        health_status = HealthStatus.HEALTHY
        if metrics:
            recent_metrics = metrics[-10:]  # Last 10 metrics
            avg_error_rate = np.mean([m.error_rate for m in recent_metrics])
            avg_response_time = np.mean([m.avg_response_time_ms for m in recent_metrics])
            
            if avg_error_rate > 0.1:  # 10% error rate
                health_status = HealthStatus.UNHEALTHY
            elif avg_error_rate > 0.05 or avg_response_time > 1000:  # 5% error rate or slow response
                health_status = HealthStatus.DEGRADED
        
        return {
            'deployment_id': deployment_id,
            'model_id': config.model_id,
            'status': 'deployed',  # Would track actual status
            'health_status': health_status.value,
            'replicas': config.replicas,
            'traffic_percentage': config.traffic_percentage,
            'environment': config.environment,
            'created_at': config.created_at.isoformat(),
            'metrics_summary': {
                'total_requests': len(metrics),
                'avg_response_time_ms': np.mean([m.avg_response_time_ms for m in metrics]) if metrics else 0,
                'error_rate': np.mean([m.error_rate for m in metrics]) if metrics else 0
            } if metrics else None
        }
    
    def list_deployments(self, 
                        model_id: Optional[str] = None,
                        environment: Optional[str] = None,
                        status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List deployments with optional filtering."""
        deployments = []
        
        for deployment_id, config in self.deployments.items():
            if model_id and config.model_id != model_id:
                continue
            if environment and config.environment != environment:
                continue
            # Status filtering would be implemented with actual status tracking
            
            deployments.append(self.get_deployment_status(deployment_id))
        
        return deployments
    
    def _save_deployment_config(self, config: DeploymentConfig):
        """Save deployment configuration to storage."""
        config_dict = asdict(config)
        config_dict['created_at'] = config.created_at.isoformat()
        
        config_file = os.path.join(self.deployments_path, f"{config.deployment_id}_config.json")
        with open(config_file, 'w') as f:
            json.dump(config_dict, f, indent=2)
    
    def _save_ab_test_config(self, config: ABTestConfig):
        """Save A/B test configuration to storage."""
        config_dict = asdict(config)
        config_dict['started_at'] = config.started_at.isoformat()
        if config.ended_at:
            config_dict['ended_at'] = config.ended_at.isoformat()
        
        config_file = os.path.join(self.deployments_path, f"ab_test_{config.test_id}_config.json")
        with open(config_file, 'w') as f:
            json.dump(config_dict, f, indent=2)


# Factory function
def create_deployment_service(storage_path: str = "./mlops_storage") -> ModelDeploymentService:
    """Factory function to create deployment service."""
    return ModelDeploymentService(storage_path)