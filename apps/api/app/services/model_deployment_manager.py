"""
Model Deployment Manager
========================

Advanced deployment orchestration system supporting:
- Blue-green deployments with zero downtime
- Canary deployments with traffic splitting and statistical analysis
- A/B testing integration with automated decision making
- Rollback capabilities and version management
- Health monitoring and automatic failover
- Traffic routing and load balancing
"""

import asyncio
import logging
import time
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session
from scipy import stats

from app.models.mlops import (
    ModelDeployment, CanaryDeployment, ServingEndpoint, 
    ServingMetrics, ModelServingAlert, DeploymentStatus, DeploymentType
)
from app.services.advanced_model_serving import get_serving_engine, PredictionRequest
from app.core.config import settings


class DeploymentStrategy(str, Enum):
    """Deployment strategy types."""
    BLUE_GREEN = "blue_green"
    CANARY = "canary"
    ROLLING = "rolling"
    IMMEDIATE = "immediate"


class TrafficSplitStrategy(str, Enum):
    """Traffic splitting strategies."""
    RANDOM = "random"
    USER_BASED = "user_based"
    GEOGRAPHIC = "geographic"
    DEVICE_TYPE = "device_type"
    WEIGHTED = "weighted"


class CanaryStatus(str, Enum):
    """Canary deployment status."""
    PENDING = "pending"
    ACTIVE = "active"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class DeploymentConfig:
    """Deployment configuration."""
    strategy: DeploymentStrategy
    model_id: str
    deployment_id: str
    endpoint_config: Dict[str, Any]
    traffic_config: Optional[Dict[str, Any]] = None
    health_checks: Optional[Dict[str, Any]] = None
    rollback_config: Optional[Dict[str, Any]] = None
    monitoring_config: Optional[Dict[str, Any]] = None


@dataclass
class TrafficRoutingRule:
    """Traffic routing rule."""
    rule_type: str  # 'percentage', 'user_id', 'region', 'custom'
    value: Any
    target_deployment: str
    priority: int = 0


class HealthChecker:
    """Health check implementation for deployments."""
    
    def __init__(self, endpoint_id: str, config: Dict[str, Any]):
        self.endpoint_id = endpoint_id
        self.config = config
        self.health_history: List[Dict] = []
        
    async def check_health(self, serving_engine) -> Dict[str, Any]:
        """Perform comprehensive health check."""
        try:
            # Get model status from serving engine
            model_status = serving_engine.get_model_status(self.endpoint_id)
            
            # Check if model is ready and responding
            is_healthy = (
                model_status.get('status') == 'ready' and
                model_status.get('circuit_breaker_state') == 'closed'
            )
            
            # Check recent error rate
            metrics = model_status.get('recent_metrics', {})
            error_rate = metrics.get('error_rate', 0)
            latency = metrics.get('avg_prediction_time_ms', 0)
            
            # Apply health check thresholds
            max_error_rate = self.config.get('max_error_rate', 5.0)
            max_latency_ms = self.config.get('max_latency_ms', 2000.0)
            
            is_healthy = (
                is_healthy and 
                error_rate <= max_error_rate and 
                latency <= max_latency_ms
            )
            
            health_result = {
                'endpoint_id': self.endpoint_id,
                'is_healthy': is_healthy,
                'error_rate': error_rate,
                'latency_ms': latency,
                'status': model_status.get('status'),
                'circuit_breaker_state': model_status.get('circuit_breaker_state'),
                'timestamp': datetime.utcnow(),
                'thresholds': {
                    'max_error_rate': max_error_rate,
                    'max_latency_ms': max_latency_ms
                }
            }
            
            # Store health history
            self.health_history.append(health_result)
            if len(self.health_history) > 100:  # Keep last 100 checks
                self.health_history = self.health_history[-100:]
            
            return health_result
            
        except Exception as e:
            logging.error(f"Health check failed for {self.endpoint_id}: {e}")
            return {
                'endpoint_id': self.endpoint_id,
                'is_healthy': False,
                'error': str(e),
                'timestamp': datetime.utcnow()
            }
    
    def get_health_trend(self, minutes: int = 10) -> Dict[str, Any]:
        """Get health trend over specified time period."""
        cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)
        recent_checks = [
            check for check in self.health_history
            if check['timestamp'] > cutoff_time
        ]
        
        if not recent_checks:
            return {'trend': 'unknown', 'health_score': 0}
        
        # Calculate health score (percentage of healthy checks)
        healthy_count = sum(1 for check in recent_checks if check.get('is_healthy', False))
        health_score = healthy_count / len(recent_checks) * 100
        
        # Determine trend
        if len(recent_checks) < 2:
            trend = 'stable'
        else:
            # Compare first half vs second half
            mid_point = len(recent_checks) // 2
            first_half_score = sum(1 for check in recent_checks[:mid_point] if check.get('is_healthy', False)) / mid_point * 100
            second_half_score = sum(1 for check in recent_checks[mid_point:] if check.get('is_healthy', False)) / (len(recent_checks) - mid_point) * 100
            
            if second_half_score > first_half_score + 10:
                trend = 'improving'
            elif second_half_score < first_half_score - 10:
                trend = 'degrading'
            else:
                trend = 'stable'
        
        return {
            'trend': trend,
            'health_score': health_score,
            'total_checks': len(recent_checks),
            'healthy_checks': healthy_count,
            'period_minutes': minutes
        }


class TrafficSplitter:
    """Traffic splitting and routing manager."""
    
    def __init__(self):
        self.routing_rules: Dict[str, List[TrafficRoutingRule]] = {}
        
    def add_routing_rule(self, canary_id: str, rule: TrafficRoutingRule):
        """Add a traffic routing rule."""
        if canary_id not in self.routing_rules:
            self.routing_rules[canary_id] = []
        
        self.routing_rules[canary_id].append(rule)
        # Sort by priority
        self.routing_rules[canary_id].sort(key=lambda r: r.priority, reverse=True)
    
    def route_request(self, canary_id: str, request_metadata: Dict[str, Any]) -> str:
        """Determine which deployment to route request to."""
        rules = self.routing_rules.get(canary_id, [])
        
        for rule in rules:
            if self._matches_rule(rule, request_metadata):
                return rule.target_deployment
        
        # Default to baseline if no rules match
        return "baseline"
    
    def _matches_rule(self, rule: TrafficRoutingRule, metadata: Dict[str, Any]) -> bool:
        """Check if request matches routing rule."""
        if rule.rule_type == 'percentage':
            # Simple percentage-based routing
            import random
            return random.random() < rule.value / 100
        elif rule.rule_type == 'user_id':
            user_id = metadata.get('user_id')
            return user_id and hash(user_id) % 100 < rule.value
        elif rule.rule_type == 'region':
            return metadata.get('region') in rule.value
        elif rule.rule_type == 'custom':
            # Custom rule evaluation (could be expanded)
            return eval(rule.value, {'metadata': metadata})
        
        return False


class StatisticalAnalyzer:
    """Statistical analysis for canary deployments."""
    
    @staticmethod
    def chi_squared_test(baseline_data: List[float], canary_data: List[float], 
                        alpha: float = 0.05) -> Dict[str, Any]:
        """Perform chi-squared test for categorical data."""
        try:
            # Convert continuous data to categorical (success/failure)
            baseline_success = sum(1 for x in baseline_data if x > 0.5)
            baseline_total = len(baseline_data)
            canary_success = sum(1 for x in canary_data if x > 0.5)
            canary_total = len(canary_data)
            
            # Observed frequencies
            observed = np.array([
                [baseline_success, baseline_total - baseline_success],
                [canary_success, canary_total - canary_success]
            ])
            
            # Perform chi-squared test
            chi2, p_value, dof, expected = stats.chi2_contingency(observed)
            
            return {
                'test_type': 'chi_squared',
                'statistic': float(chi2),
                'p_value': float(p_value),
                'degrees_of_freedom': dof,
                'significant': p_value < alpha,
                'alpha': alpha,
                'baseline_success_rate': baseline_success / baseline_total if baseline_total > 0 else 0,
                'canary_success_rate': canary_success / canary_total if canary_total > 0 else 0
            }
            
        except Exception as e:
            logging.error(f"Chi-squared test failed: {e}")
            return {'test_type': 'chi_squared', 'error': str(e)}
    
    @staticmethod
    def t_test(baseline_data: List[float], canary_data: List[float], 
               alpha: float = 0.05) -> Dict[str, Any]:
        """Perform independent t-test."""
        try:
            if len(baseline_data) < 2 or len(canary_data) < 2:
                return {
                    'test_type': 't_test',
                    'error': 'Insufficient data for t-test'
                }
            
            # Perform independent t-test
            statistic, p_value = stats.ttest_ind(canary_data, baseline_data)
            
            # Calculate confidence interval for difference in means
            baseline_mean = np.mean(baseline_data)
            canary_mean = np.mean(canary_data)
            pooled_std = np.sqrt(
                ((len(baseline_data) - 1) * np.var(baseline_data, ddof=1) + 
                 (len(canary_data) - 1) * np.var(canary_data, ddof=1)) /
                (len(baseline_data) + len(canary_data) - 2)
            )
            
            standard_error = pooled_std * np.sqrt(1/len(baseline_data) + 1/len(canary_data))
            degrees_freedom = len(baseline_data) + len(canary_data) - 2
            t_critical = stats.t.ppf(1 - alpha/2, degrees_freedom)
            
            diff_mean = canary_mean - baseline_mean
            margin_error = t_critical * standard_error
            
            return {
                'test_type': 't_test',
                'statistic': float(statistic),
                'p_value': float(p_value),
                'significant': p_value < alpha,
                'alpha': alpha,
                'baseline_mean': float(baseline_mean),
                'canary_mean': float(canary_mean),
                'difference_mean': float(diff_mean),
                'confidence_interval': [
                    float(diff_mean - margin_error),
                    float(diff_mean + margin_error)
                ],
                'improvement_percent': float((diff_mean / baseline_mean) * 100) if baseline_mean != 0 else 0
            }
            
        except Exception as e:
            logging.error(f"T-test failed: {e}")
            return {'test_type': 't_test', 'error': str(e)}
    
    @staticmethod
    def mann_whitney_u_test(baseline_data: List[float], canary_data: List[float], 
                           alpha: float = 0.05) -> Dict[str, Any]:
        """Perform Mann-Whitney U test (non-parametric)."""
        try:
            if len(baseline_data) < 5 or len(canary_data) < 5:
                return {
                    'test_type': 'mann_whitney_u',
                    'error': 'Insufficient data for Mann-Whitney U test'
                }
            
            # Perform Mann-Whitney U test
            statistic, p_value = stats.mannwhitneyu(
                canary_data, baseline_data, alternative='two-sided'
            )
            
            return {
                'test_type': 'mann_whitney_u',
                'statistic': float(statistic),
                'p_value': float(p_value),
                'significant': p_value < alpha,
                'alpha': alpha,
                'baseline_median': float(np.median(baseline_data)),
                'canary_median': float(np.median(canary_data))
            }
            
        except Exception as e:
            logging.error(f"Mann-Whitney U test failed: {e}")
            return {'test_type': 'mann_whitney_u', 'error': str(e)}


class ModelDeploymentManager:
    """Advanced model deployment manager."""
    
    def __init__(self, db: Session):
        self.db = db
        self.health_checkers: Dict[str, HealthChecker] = {}
        self.traffic_splitter = TrafficSplitter()
        self.statistical_analyzer = StatisticalAnalyzer()
        self.active_canaries: Dict[str, Dict] = {}
        
    async def deploy_model(self, config: DeploymentConfig) -> Dict[str, Any]:
        """Deploy model with specified strategy."""
        try:
            if config.strategy == DeploymentStrategy.BLUE_GREEN:
                return await self._deploy_blue_green(config)
            elif config.strategy == DeploymentStrategy.CANARY:
                return await self._deploy_canary(config)
            elif config.strategy == DeploymentStrategy.ROLLING:
                return await self._deploy_rolling(config)
            elif config.strategy == DeploymentStrategy.IMMEDIATE:
                return await self._deploy_immediate(config)
            else:
                raise ValueError(f"Unsupported deployment strategy: {config.strategy}")
                
        except Exception as e:
            logging.error(f"Deployment failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'deployment_id': config.deployment_id
            }
    
    async def _deploy_blue_green(self, config: DeploymentConfig) -> Dict[str, Any]:
        """Perform blue-green deployment."""
        try:
            # Create new green deployment
            green_deployment = ModelDeployment(
                model_id=config.model_id,
                name=f"{config.deployment_id}-green",
                deployment_type=DeploymentType.PRODUCTION,
                environment="green",
                status=DeploymentStatus.DEPLOYING,
                deployed_by="system",
                traffic_percentage=0.0  # Initially no traffic
            )
            
            self.db.add(green_deployment)
            self.db.commit()
            
            # Load model in serving engine
            serving_engine = get_serving_engine()
            model_loaded = await serving_engine.load_model(
                model_id=green_deployment.deployment_id,
                model_path=config.endpoint_config['model_path'],
                framework=config.endpoint_config['framework'],
                model_config=config.endpoint_config.get('model_config', {})
            )
            
            if not model_loaded:
                green_deployment.status = DeploymentStatus.FAILED
                self.db.commit()
                return {
                    'success': False,
                    'error': 'Failed to load model',
                    'deployment_id': green_deployment.deployment_id
                }
            
            # Setup health checker
            health_config = config.health_checks or {}
            self.health_checkers[green_deployment.deployment_id] = HealthChecker(
                green_deployment.deployment_id, health_config
            )
            
            # Wait for health checks to pass
            healthy = await self._wait_for_health(green_deployment.deployment_id, timeout=300)
            
            if not healthy:
                green_deployment.status = DeploymentStatus.FAILED
                self.db.commit()
                return {
                    'success': False,
                    'error': 'Health checks failed',
                    'deployment_id': green_deployment.deployment_id
                }
            
            # Switch traffic to green (this would typically involve load balancer reconfiguration)
            green_deployment.traffic_percentage = 100.0
            green_deployment.status = DeploymentStatus.DEPLOYED
            green_deployment.deployed_at = datetime.utcnow()
            
            # Find and decommission old blue deployment
            old_blue = self.db.query(ModelDeployment).filter(
                ModelDeployment.model_id == config.model_id,
                ModelDeployment.environment == "blue",
                ModelDeployment.status == DeploymentStatus.DEPLOYED
            ).first()
            
            if old_blue:
                old_blue.traffic_percentage = 0.0
                old_blue.status = DeploymentStatus.TERMINATED
                old_blue.terminated_at = datetime.utcnow()
                
                # Unload old model
                serving_engine.unload_model(old_blue.deployment_id)
            
            # Rename green to blue for next deployment cycle
            green_deployment.environment = "blue"
            
            self.db.commit()
            
            return {
                'success': True,
                'deployment_id': green_deployment.deployment_id,
                'strategy': 'blue_green',
                'status': green_deployment.status.value,
                'traffic_percentage': green_deployment.traffic_percentage
            }
            
        except Exception as e:
            logging.error(f"Blue-green deployment failed: {e}")
            self.db.rollback()
            return {
                'success': False,
                'error': str(e),
                'deployment_id': config.deployment_id
            }
    
    async def _deploy_canary(self, config: DeploymentConfig) -> Dict[str, Any]:
        """Perform canary deployment."""
        try:
            # Get baseline deployment
            baseline_deployment = self.db.query(ModelDeployment).filter(
                ModelDeployment.model_id == config.model_id,
                ModelDeployment.status == DeploymentStatus.DEPLOYED
            ).first()
            
            if not baseline_deployment:
                return {
                    'success': False,
                    'error': 'No baseline deployment found',
                    'deployment_id': config.deployment_id
                }
            
            # Create canary deployment
            canary_deployment = ModelDeployment(
                model_id=config.model_id,
                name=f"{config.deployment_id}-canary",
                deployment_type=DeploymentType.CANARY,
                environment="canary",
                status=DeploymentStatus.DEPLOYING,
                deployed_by="system",
                traffic_percentage=config.traffic_config.get('initial_percentage', 5.0)
            )
            
            self.db.add(canary_deployment)
            self.db.commit()
            
            # Load canary model
            serving_engine = get_serving_engine()
            model_loaded = await serving_engine.load_model(
                model_id=canary_deployment.deployment_id,
                model_path=config.endpoint_config['model_path'],
                framework=config.endpoint_config['framework'],
                model_config=config.endpoint_config.get('model_config', {})
            )
            
            if not model_loaded:
                canary_deployment.status = DeploymentStatus.FAILED
                self.db.commit()
                return {
                    'success': False,
                    'error': 'Failed to load canary model',
                    'deployment_id': canary_deployment.deployment_id
                }
            
            # Create canary deployment record
            canary_record = CanaryDeployment(
                name=config.deployment_id,
                baseline_deployment_id=baseline_deployment.deployment_id,
                canary_deployment_id=canary_deployment.deployment_id,
                traffic_split_percent=canary_deployment.traffic_percentage,
                traffic_split_strategy=config.traffic_config.get('strategy', 'random'),
                success_criteria=config.traffic_config.get('success_criteria', {}),
                min_sample_size=config.traffic_config.get('min_sample_size', 100),
                evaluation_period_minutes=config.traffic_config.get('evaluation_period', 60),
                auto_rollback_enabled=config.rollback_config.get('auto_rollback', True),
                rollback_threshold_error_rate=config.rollback_config.get('error_rate_threshold', 5.0),
                rollback_threshold_latency_ms=config.rollback_config.get('latency_threshold', 2000.0),
                statistical_test=config.traffic_config.get('statistical_test', 'chi_squared'),
                significance_level=config.traffic_config.get('significance_level', 0.05),
                created_by="system",
                status="active"
            )
            
            self.db.add(canary_record)
            self.db.commit()
            
            # Setup traffic splitting
            traffic_rule = TrafficRoutingRule(
                rule_type='percentage',
                value=canary_deployment.traffic_percentage,
                target_deployment=canary_deployment.deployment_id
            )
            self.traffic_splitter.add_routing_rule(canary_record.canary_id, traffic_rule)
            
            # Setup health checkers
            health_config = config.health_checks or {}
            self.health_checkers[canary_deployment.deployment_id] = HealthChecker(
                canary_deployment.deployment_id, health_config
            )
            
            # Start canary monitoring
            self.active_canaries[canary_record.canary_id] = {
                'canary_record': canary_record,
                'baseline_deployment': baseline_deployment,
                'canary_deployment': canary_deployment,
                'start_time': datetime.utcnow(),
                'metrics_collected': []
            }
            
            canary_deployment.status = DeploymentStatus.DEPLOYED
            canary_deployment.deployed_at = datetime.utcnow()
            canary_record.started_at = datetime.utcnow()
            
            self.db.commit()
            
            # Start background canary monitoring
            asyncio.create_task(self._monitor_canary(canary_record.canary_id))
            
            return {
                'success': True,
                'deployment_id': canary_deployment.deployment_id,
                'canary_id': canary_record.canary_id,
                'strategy': 'canary',
                'status': canary_deployment.status.value,
                'traffic_percentage': canary_deployment.traffic_percentage,
                'baseline_deployment_id': baseline_deployment.deployment_id
            }
            
        except Exception as e:
            logging.error(f"Canary deployment failed: {e}")
            self.db.rollback()
            return {
                'success': False,
                'error': str(e),
                'deployment_id': config.deployment_id
            }
    
    async def _wait_for_health(self, deployment_id: str, timeout: int = 300) -> bool:
        """Wait for deployment to become healthy."""
        start_time = time.time()
        health_checker = self.health_checkers.get(deployment_id)
        
        if not health_checker:
            logging.warning(f"No health checker found for {deployment_id}")
            return False
        
        serving_engine = get_serving_engine()
        
        while time.time() - start_time < timeout:
            try:
                health_result = await health_checker.check_health(serving_engine)
                if health_result.get('is_healthy', False):
                    logging.info(f"Deployment {deployment_id} is healthy")
                    return True
                
                await asyncio.sleep(10)  # Wait 10 seconds between checks
                
            except Exception as e:
                logging.error(f"Health check error for {deployment_id}: {e}")
                await asyncio.sleep(10)
        
        logging.warning(f"Deployment {deployment_id} failed to become healthy within {timeout}s")
        return False
    
    async def _monitor_canary(self, canary_id: str):
        """Monitor canary deployment and make decisions."""
        try:
            canary_info = self.active_canaries.get(canary_id)
            if not canary_info:
                logging.warning(f"Canary {canary_id} not found in active canaries")
                return
            
            canary_record = canary_info['canary_record']
            serving_engine = get_serving_engine()
            
            while True:
                # Check if canary is still active
                self.db.refresh(canary_record)
                if canary_record.status not in ['active', 'pending']:
                    break
                
                # Collect metrics from both deployments
                baseline_metrics = serving_engine.get_model_status(
                    canary_info['baseline_deployment'].deployment_id
                )
                canary_metrics = serving_engine.get_model_status(
                    canary_info['canary_deployment'].deployment_id
                )
                
                # Store metrics
                canary_info['metrics_collected'].append({
                    'timestamp': datetime.utcnow(),
                    'baseline': baseline_metrics.get('recent_metrics', {}),
                    'canary': canary_metrics.get('recent_metrics', {})
                })
                
                # Check if we have enough data for analysis
                evaluation_start = canary_record.started_at + timedelta(
                    minutes=canary_record.evaluation_period_minutes
                )
                
                if datetime.utcnow() >= evaluation_start:
                    # Perform statistical analysis
                    await self._evaluate_canary(canary_id)
                    break
                
                # Check for immediate rollback conditions
                if canary_record.auto_rollback_enabled:
                    should_rollback = self._check_rollback_conditions(canary_id)
                    if should_rollback:
                        await self._rollback_canary(canary_id, "Auto-rollback triggered")
                        break
                
                # Wait before next check
                await asyncio.sleep(60)  # Check every minute
                
        except Exception as e:
            logging.error(f"Error monitoring canary {canary_id}: {e}")
            # Attempt rollback on error
            try:
                await self._rollback_canary(canary_id, f"Monitoring error: {str(e)}")
            except:
                pass
    
    def _check_rollback_conditions(self, canary_id: str) -> bool:
        """Check if canary should be rolled back immediately."""
        canary_info = self.active_canaries.get(canary_id)
        if not canary_info:
            return False
        
        canary_record = canary_info['canary_record']
        recent_metrics = canary_info['metrics_collected'][-10:]  # Last 10 metrics
        
        if not recent_metrics:
            return False
        
        # Check error rate
        avg_error_rate = np.mean([
            m['canary'].get('error_rate', 0) for m in recent_metrics
        ])
        
        if avg_error_rate > canary_record.rollback_threshold_error_rate:
            logging.warning(f"Canary {canary_id} error rate {avg_error_rate}% exceeds threshold")
            return True
        
        # Check latency
        avg_latency = np.mean([
            m['canary'].get('avg_prediction_time_ms', 0) for m in recent_metrics
        ])
        
        if avg_latency > canary_record.rollback_threshold_latency_ms:
            logging.warning(f"Canary {canary_id} latency {avg_latency}ms exceeds threshold")
            return True
        
        return False
    
    async def _evaluate_canary(self, canary_id: str):
        """Evaluate canary deployment using statistical analysis."""
        try:
            canary_info = self.active_canaries.get(canary_id)
            if not canary_info:
                return
            
            canary_record = canary_info['canary_record']
            metrics_data = canary_info['metrics_collected']
            
            # Extract performance data
            baseline_error_rates = [m['baseline'].get('error_rate', 0) for m in metrics_data]
            canary_error_rates = [m['canary'].get('error_rate', 0) for m in metrics_data]
            
            baseline_latencies = [m['baseline'].get('avg_prediction_time_ms', 0) for m in metrics_data]
            canary_latencies = [m['canary'].get('avg_prediction_time_ms', 0) for m in metrics_data]
            
            # Perform statistical test
            test_results = {}
            if canary_record.statistical_test == 'chi_squared':
                # Convert error rates to success rates for chi-squared test
                baseline_success_rates = [max(0, 100 - er) / 100 for er in baseline_error_rates]
                canary_success_rates = [max(0, 100 - er) / 100 for er in canary_error_rates]
                test_results = self.statistical_analyzer.chi_squared_test(
                    baseline_success_rates, canary_success_rates, canary_record.significance_level
                )
            elif canary_record.statistical_test == 't_test':
                test_results = self.statistical_analyzer.t_test(
                    baseline_latencies, canary_latencies, canary_record.significance_level
                )
            elif canary_record.statistical_test == 'mann_whitney':
                test_results = self.statistical_analyzer.mann_whitney_u_test(
                    baseline_latencies, canary_latencies, canary_record.significance_level
                )
            
            # Update canary record with results
            canary_record.evaluation_results = test_results
            canary_record.p_value = test_results.get('p_value')
            canary_record.baseline_metrics = {
                'avg_error_rate': np.mean(baseline_error_rates),
                'avg_latency_ms': np.mean(baseline_latencies)
            }
            canary_record.canary_metrics = {
                'avg_error_rate': np.mean(canary_error_rates),
                'avg_latency_ms': np.mean(canary_latencies)
            }
            
            # Make decision
            is_significant = test_results.get('significant', False)
            canary_better = self._is_canary_better(test_results, canary_record)
            
            if is_significant and canary_better:
                # Promote canary
                await self._promote_canary(canary_id)
                canary_record.status = "successful"
                canary_record.completed_at = datetime.utcnow()
                logging.info(f"Canary {canary_id} promoted to production")
            else:
                # Roll back canary
                reason = "Statistical analysis indicates canary is not better" if is_significant else "No significant difference found"
                await self._rollback_canary(canary_id, reason)
                canary_record.status = "failed"
                canary_record.completed_at = datetime.utcnow()
                logging.info(f"Canary {canary_id} rolled back: {reason}")
            
            self.db.commit()
            
            # Clean up
            if canary_id in self.active_canaries:
                del self.active_canaries[canary_id]
                
        except Exception as e:
            logging.error(f"Error evaluating canary {canary_id}: {e}")
            await self._rollback_canary(canary_id, f"Evaluation error: {str(e)}")
    
    def _is_canary_better(self, test_results: Dict, canary_record: CanaryDeployment) -> bool:
        """Determine if canary is better than baseline."""
        test_type = test_results.get('test_type')
        
        if test_type == 'chi_squared':
            # For chi-squared, check if canary has better success rate
            canary_success_rate = test_results.get('canary_success_rate', 0)
            baseline_success_rate = test_results.get('baseline_success_rate', 0)
            return canary_success_rate > baseline_success_rate
        
        elif test_type == 't_test':
            # For t-test on latency, canary is better if it has lower latency (negative difference)
            improvement = test_results.get('improvement_percent', 0)
            return improvement < -5  # At least 5% improvement
        
        elif test_type == 'mann_whitney_u':
            # For Mann-Whitney U, check median comparison
            canary_median = test_results.get('canary_median', 0)
            baseline_median = test_results.get('baseline_median', 0)
            return canary_median < baseline_median  # Lower is better for latency
        
        return False
    
    async def _promote_canary(self, canary_id: str):
        """Promote canary to production."""
        canary_info = self.active_canaries.get(canary_id)
        if not canary_info:
            return
        
        baseline_deployment = canary_info['baseline_deployment']
        canary_deployment = canary_info['canary_deployment']
        serving_engine = get_serving_engine()
        
        # Switch traffic to canary
        canary_deployment.traffic_percentage = 100.0
        baseline_deployment.traffic_percentage = 0.0
        
        # Terminate baseline deployment
        baseline_deployment.status = DeploymentStatus.TERMINATED
        baseline_deployment.terminated_at = datetime.utcnow()
        
        # Promote canary to production
        canary_deployment.deployment_type = DeploymentType.PRODUCTION
        canary_deployment.environment = "production"
        
        # Unload baseline model
        serving_engine.unload_model(baseline_deployment.deployment_id)
        
        self.db.commit()
    
    async def _rollback_canary(self, canary_id: str, reason: str):
        """Roll back canary deployment."""
        canary_info = self.active_canaries.get(canary_id)
        if not canary_info:
            return
        
        canary_deployment = canary_info['canary_deployment']
        serving_engine = get_serving_engine()
        
        # Stop traffic to canary
        canary_deployment.traffic_percentage = 0.0
        canary_deployment.status = DeploymentStatus.TERMINATED
        canary_deployment.terminated_at = datetime.utcnow()
        
        # Update canary record
        canary_record = canary_info['canary_record']
        canary_record.status = "rolled_back"
        canary_record.rollback_reason = reason
        canary_record.rolled_back_at = datetime.utcnow()
        
        # Unload canary model
        serving_engine.unload_model(canary_deployment.deployment_id)
        
        self.db.commit()
        
        logging.info(f"Canary {canary_id} rolled back: {reason}")
    
    async def get_deployment_status(self, deployment_id: str) -> Dict[str, Any]:
        """Get comprehensive deployment status."""
        deployment = self.db.query(ModelDeployment).filter(
            ModelDeployment.deployment_id == deployment_id
        ).first()
        
        if not deployment:
            return {'error': 'Deployment not found'}
        
        # Get serving engine status
        serving_engine = get_serving_engine()
        model_status = serving_engine.get_model_status(deployment_id)
        
        # Get health status if available
        health_status = None
        if deployment_id in self.health_checkers:
            health_checker = self.health_checkers[deployment_id]
            health_status = health_checker.get_health_trend()
        
        return {
            'deployment_id': deployment.deployment_id,
            'model_id': deployment.model_id,
            'status': deployment.status.value,
            'deployment_type': deployment.deployment_type.value,
            'environment': deployment.environment,
            'traffic_percentage': deployment.traffic_percentage,
            'deployed_at': deployment.deployed_at,
            'model_status': model_status,
            'health_status': health_status,
            'uptime_hours': deployment.uptime_hours
        }
    
    async def list_active_canaries(self) -> List[Dict[str, Any]]:
        """List all active canary deployments."""
        active_canaries = []
        
        for canary_id, canary_info in self.active_canaries.items():
            canary_record = canary_info['canary_record']
            self.db.refresh(canary_record)
            
            active_canaries.append({
                'canary_id': canary_id,
                'name': canary_record.name,
                'status': canary_record.status,
                'traffic_split_percent': canary_record.current_traffic_percent,
                'started_at': canary_record.started_at,
                'duration_minutes': canary_record.duration_minutes,
                'baseline_deployment_id': canary_record.baseline_deployment_id,
                'canary_deployment_id': canary_record.canary_deployment_id
            })
        
        return active_canaries
    
    async def manual_rollback(self, deployment_id: str, reason: str) -> Dict[str, Any]:
        """Manually rollback a deployment."""
        try:
            deployment = self.db.query(ModelDeployment).filter(
                ModelDeployment.deployment_id == deployment_id
            ).first()
            
            if not deployment:
                return {'success': False, 'error': 'Deployment not found'}
            
            # Check if this is part of a canary
            canary = self.db.query(CanaryDeployment).filter(
                (CanaryDeployment.canary_deployment_id == deployment_id) |
                (CanaryDeployment.baseline_deployment_id == deployment_id)
            ).first()
            
            if canary and canary.status == 'active':
                await self._rollback_canary(canary.canary_id, f"Manual rollback: {reason}")
                return {
                    'success': True,
                    'message': 'Canary deployment rolled back',
                    'canary_id': canary.canary_id
                }
            else:
                # Regular deployment rollback
                serving_engine = get_serving_engine()
                serving_engine.unload_model(deployment_id)
                
                deployment.status = DeploymentStatus.TERMINATED
                deployment.terminated_at = datetime.utcnow()
                deployment.traffic_percentage = 0.0
                
                self.db.commit()
                
                return {
                    'success': True,
                    'message': 'Deployment rolled back',
                    'deployment_id': deployment_id
                }
                
        except Exception as e:
            logging.error(f"Manual rollback failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'deployment_id': deployment_id
            }


# Global deployment manager instance
_deployment_manager = None


def get_deployment_manager(db: Session) -> ModelDeploymentManager:
    """Get deployment manager instance."""
    global _deployment_manager
    if _deployment_manager is None:
        _deployment_manager = ModelDeploymentManager(db)
    return _deployment_manager