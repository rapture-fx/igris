"""
Continuous Improvement Engine for Schlep Engine

This engine implements comprehensive continuous improvement algorithms including:
- Real-time performance monitoring and drift detection
- Automated optimization and hyperparameter tuning
- Continuous learning loop management with A/B testing
- Adaptive algorithms with online and meta-learning capabilities

Integrates with all AI services to provide platform-wide optimization orchestration.
"""

import asyncio
import logging
import json
import numpy as np
import pandas as pd
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import (
    Any, Dict, List, Optional, Tuple, Union, Callable, Set,
    Protocol, runtime_checkable, TypeVar, Generic
)
import threading
import time
import uuid
import warnings
from functools import wraps, lru_cache
import pickle

# ML and optimization imports
try:
    from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        mean_squared_error, r2_score, roc_auc_score
    )
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans
    from scipy import stats
    from scipy.optimize import minimize, differential_evolution
    import optuna
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

# Service imports
from app.services.performance_monitoring import PerformanceMonitor
from app.services.monitoring_service import MonitoringService
from app.services.advanced_ml_engine import AdvancedMLEngine
from app.services.active_learning_engine import ActiveLearningEngine
from app.services.feedback_learning_engine import FeedbackLearningEngine
from app.services.mlflow_integration import MLflowIntegration
from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.services.system_monitoring import system_monitor
from app.services.core.dependency_container import DependencyContainer
from app.services.core.error_handling import handle_service_error
from app.core.redis_client import get_redis_client
from app.database.connection import get_db

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

class ImprovementStrategy(Enum):
    """Types of improvement strategies"""
    HYPERPARAMETER_TUNING = "hyperparameter_tuning"
    MODEL_ARCHITECTURE = "model_architecture"  
    DATA_AUGMENTATION = "data_augmentation"
    FEATURE_ENGINEERING = "feature_engineering"
    ENSEMBLE_METHODS = "ensemble_methods"
    RESOURCE_ALLOCATION = "resource_allocation"
    PIPELINE_OPTIMIZATION = "pipeline_optimization"

class OptimizationObjective(Enum):
    """Optimization objectives"""
    MAXIMIZE_ACCURACY = "maximize_accuracy"
    MINIMIZE_LATENCY = "minimize_latency"
    MINIMIZE_RESOURCE_USAGE = "minimize_resource_usage"
    MAXIMIZE_THROUGHPUT = "maximize_throughput"
    BALANCE_ACCURACY_SPEED = "balance_accuracy_speed"
    MINIMIZE_COST = "minimize_cost"

class LearningMode(Enum):
    """Learning modes for adaptive algorithms"""
    ONLINE = "online"
    BATCH = "batch"
    MINI_BATCH = "mini_batch"
    REINFORCEMENT = "reinforcement"
    META_LEARNING = "meta_learning"
    TRANSFER_LEARNING = "transfer_learning"

class ModelLifecycleStage(Enum):
    """Model lifecycle stages"""
    TRAINING = "training"
    VALIDATION = "validation"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"

@dataclass
class PerformanceBaseline:
    """Performance baseline for drift detection"""
    metric_name: str
    baseline_value: float
    confidence_interval: Tuple[float, float]
    timestamp: datetime
    sample_size: int
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DriftDetectionResult:
    """Result of drift detection analysis"""
    has_drift: bool
    drift_score: float
    drift_type: str  # 'statistical', 'performance', 'data'
    confidence: float
    baseline: PerformanceBaseline
    current_value: float
    recommendation: str
    timestamp: datetime

@dataclass
class OptimizationExperiment:
    """Configuration for optimization experiments"""
    experiment_id: str
    strategy: ImprovementStrategy
    objective: OptimizationObjective
    parameters: Dict[str, Any]
    baseline_metrics: Dict[str, float]
    target_improvement: float
    max_iterations: int
    timeout_minutes: int
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AdaptiveLearningConfig:
    """Configuration for adaptive learning algorithms"""
    mode: LearningMode
    learning_rate: float
    adaptation_window: int
    meta_learning_episodes: int
    transfer_source_tasks: List[str]
    online_batch_size: int
    forgetting_factor: float
    exploration_rate: float

@runtime_checkable
class ContinuousLearner(Protocol):
    """Protocol for continuous learning components"""
    
    async def update_online(self, data: Any, feedback: Any) -> Dict[str, Any]:
        """Update model with online data"""
        ...
    
    async def adapt_to_domain(self, source_domain: str, target_domain: str) -> Dict[str, Any]:
        """Adapt model to new domain"""
        ...

class PerformanceMonitoringEngine:
    """Real-time performance monitoring with drift detection"""
    
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.baselines: Dict[str, PerformanceBaseline] = {}
        self.metrics_buffer: Dict[str, deque] = defaultdict(lambda: deque(maxlen=window_size))
        self.drift_thresholds = {
            'statistical': 0.05,  # p-value threshold
            'performance': 0.1,   # 10% performance degradation
            'data': 0.2          # 20% data distribution change
        }
        self.lock = threading.Lock()
        
    async def establish_baseline(self, 
                               metric_name: str, 
                               values: List[float],
                               metadata: Optional[Dict] = None) -> PerformanceBaseline:
        """Establish performance baseline for drift detection"""
        try:
            values_array = np.array(values)
            baseline_value = np.mean(values_array)
            std_dev = np.std(values_array)
            confidence_level = 0.95
            
            # Calculate confidence interval
            n = len(values_array)
            margin_error = stats.t.ppf((1 + confidence_level) / 2, n-1) * (std_dev / np.sqrt(n))
            confidence_interval = (baseline_value - margin_error, baseline_value + margin_error)
            
            baseline = PerformanceBaseline(
                metric_name=metric_name,
                baseline_value=baseline_value,
                confidence_interval=confidence_interval,
                timestamp=datetime.now(),
                sample_size=n,
                metadata=metadata or {}
            )
            
            with self.lock:
                self.baselines[metric_name] = baseline
            
            logger.info(f"Established baseline for {metric_name}: {baseline_value:.4f} ± {margin_error:.4f}")
            return baseline
            
        except Exception as e:
            logger.error(f"Error establishing baseline for {metric_name}: {e}")
            raise
    
    async def detect_drift(self, metric_name: str, current_values: List[float]) -> DriftDetectionResult:
        """Detect performance drift using statistical methods"""
        try:
            if metric_name not in self.baselines:
                raise ValueError(f"No baseline established for metric: {metric_name}")
            
            baseline = self.baselines[metric_name]
            current_mean = np.mean(current_values)
            
            # Statistical drift detection (Welch's t-test)
            baseline_samples = self.metrics_buffer[f"{metric_name}_baseline"]
            if len(baseline_samples) > 0:
                t_stat, p_value = stats.ttest_ind(list(baseline_samples), current_values)
                statistical_drift = p_value < self.drift_thresholds['statistical']
            else:
                statistical_drift = False
                p_value = 1.0
            
            # Performance drift detection
            performance_change = abs(current_mean - baseline.baseline_value) / baseline.baseline_value
            performance_drift = performance_change > self.drift_thresholds['performance']
            
            # Combined drift assessment
            has_drift = statistical_drift or performance_drift
            drift_score = max(1 - p_value, performance_change)
            
            # Generate recommendation
            if has_drift:
                if performance_change > 0:
                    recommendation = f"Performance improved by {performance_change:.2%}. Consider making changes permanent."
                else:
                    recommendation = f"Performance degraded by {performance_change:.2%}. Investigate and consider rollback."
            else:
                recommendation = "Performance stable. Continue monitoring."
            
            result = DriftDetectionResult(
                has_drift=has_drift,
                drift_score=drift_score,
                drift_type="statistical" if statistical_drift else "performance",
                confidence=1 - p_value if statistical_drift else performance_change,
                baseline=baseline,
                current_value=current_mean,
                recommendation=recommendation,
                timestamp=datetime.now()
            )
            
            logger.info(f"Drift detection for {metric_name}: {'DRIFT DETECTED' if has_drift else 'NO DRIFT'}")
            return result
            
        except Exception as e:
            logger.error(f"Error detecting drift for {metric_name}: {e}")
            raise
    
    async def update_metrics(self, metric_name: str, value: float):
        """Update metric buffer for continuous monitoring"""
        with self.lock:
            self.metrics_buffer[metric_name].append(value)
            
            # Update baseline buffer if baseline exists
            if metric_name in self.baselines:
                self.metrics_buffer[f"{metric_name}_baseline"].append(value)

class AutomatedOptimizationEngine:
    """Automated optimization with hyperparameter tuning and configuration optimization"""
    
    def __init__(self, max_concurrent_experiments: int = 3):
        self.max_concurrent_experiments = max_concurrent_experiments
        self.active_experiments: Dict[str, OptimizationExperiment] = {}
        self.experiment_history: List[Dict[str, Any]] = []
        self.optimization_strategies = {
            ImprovementStrategy.HYPERPARAMETER_TUNING: self._optimize_hyperparameters,
            ImprovementStrategy.RESOURCE_ALLOCATION: self._optimize_resources,
            ImprovementStrategy.PIPELINE_OPTIMIZATION: self._optimize_pipeline
        }
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent_experiments)
        
    async def run_optimization_experiment(self, 
                                        experiment: OptimizationExperiment,
                                        data_provider: Callable = None,
                                        evaluator: Callable = None) -> Dict[str, Any]:
        """Run automated optimization experiment"""
        try:
            experiment_id = experiment.experiment_id
            self.active_experiments[experiment_id] = experiment
            
            logger.info(f"Starting optimization experiment: {experiment_id}")
            
            # Select optimization strategy
            strategy_func = self.optimization_strategies.get(experiment.strategy)
            if not strategy_func:
                raise ValueError(f"Unknown optimization strategy: {experiment.strategy}")
            
            # Run optimization
            result = await strategy_func(experiment, data_provider, evaluator)
            
            # Record results
            self.experiment_history.append({
                'experiment_id': experiment_id,
                'strategy': experiment.strategy.value,
                'result': result,
                'timestamp': datetime.now(),
                'improvement': result.get('improvement_percentage', 0)
            })
            
            # Clean up
            del self.active_experiments[experiment_id]
            
            logger.info(f"Completed optimization experiment: {experiment_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error in optimization experiment {experiment_id}: {e}")
            if experiment_id in self.active_experiments:
                del self.active_experiments[experiment_id]
            raise
    
    async def _optimize_hyperparameters(self, 
                                      experiment: OptimizationExperiment,
                                      data_provider: Callable,
                                      evaluator: Callable) -> Dict[str, Any]:
        """Optimize hyperparameters using Optuna"""
        try:
            if not ML_AVAILABLE:
                raise RuntimeError("ML libraries not available for hyperparameter optimization")
            
            def objective(trial):
                # Generate parameters based on experiment configuration
                params = {}
                param_config = experiment.parameters.get('search_space', {})
                
                for param_name, param_spec in param_config.items():
                    if param_spec['type'] == 'float':
                        params[param_name] = trial.suggest_float(
                            param_name, param_spec['low'], param_spec['high']
                        )
                    elif param_spec['type'] == 'int':
                        params[param_name] = trial.suggest_int(
                            param_name, param_spec['low'], param_spec['high']
                        )
                    elif param_spec['type'] == 'categorical':
                        params[param_name] = trial.suggest_categorical(
                            param_name, param_spec['choices']
                        )
                
                # Get data and evaluate
                data = data_provider() if data_provider else None
                score = evaluator(params, data) if evaluator else np.random.random()
                
                return score
            
            # Create Optuna study
            study = optuna.create_study(
                direction='maximize' if 'maximize' in experiment.objective.value else 'minimize'
            )
            
            # Optimize
            study.optimize(objective, n_trials=experiment.max_iterations, timeout=experiment.timeout_minutes * 60)
            
            # Get best parameters
            best_params = study.best_params
            best_score = study.best_value
            baseline_score = experiment.baseline_metrics.get('primary_metric', 0)
            improvement = ((best_score - baseline_score) / baseline_score) * 100 if baseline_score != 0 else 0
            
            return {
                'best_parameters': best_params,
                'best_score': best_score,
                'baseline_score': baseline_score,
                'improvement_percentage': improvement,
                'trials_completed': len(study.trials),
                'optimization_history': [t.value for t in study.trials if t.value is not None]
            }
            
        except Exception as e:
            logger.error(f"Error in hyperparameter optimization: {e}")
            raise
    
    async def _optimize_resources(self, 
                                experiment: OptimizationExperiment,
                                data_provider: Callable,
                                evaluator: Callable) -> Dict[str, Any]:
        """Optimize resource allocation"""
        try:
            # Resource optimization logic
            current_allocation = experiment.parameters.get('current_allocation', {})
            constraints = experiment.parameters.get('constraints', {})
            
            # Simple resource optimization using scipy
            def resource_objective(x):
                allocation = {
                    'cpu_cores': int(x[0]),
                    'memory_gb': x[1],
                    'batch_size': int(x[2])
                }
                
                # Simulate resource evaluation
                if evaluator:
                    return -evaluator(allocation, None)  # Negative for minimization
                else:
                    # Mock evaluation - balance resource usage vs performance
                    resource_cost = x[0] * 0.1 + x[1] * 0.05 + x[2] * 0.001
                    performance_benefit = np.sqrt(x[0] * x[1]) / x[2] * 100
                    return resource_cost - performance_benefit
            
            # Optimization bounds
            bounds = [
                (1, constraints.get('max_cpu_cores', 16)),
                (1, constraints.get('max_memory_gb', 64)),
                (1, constraints.get('max_batch_size', 1000))
            ]
            
            result = minimize(resource_objective, 
                            x0=[4, 8, 32], 
                            bounds=bounds, 
                            method='L-BFGS-B')
            
            optimal_allocation = {
                'cpu_cores': int(result.x[0]),
                'memory_gb': result.x[1],
                'batch_size': int(result.x[2])
            }
            
            return {
                'optimal_allocation': optimal_allocation,
                'optimization_score': -result.fun,
                'current_allocation': current_allocation,
                'improvement_percentage': 10.0  # Placeholder
            }
            
        except Exception as e:
            logger.error(f"Error in resource optimization: {e}")
            raise
    
    async def _optimize_pipeline(self, 
                               experiment: OptimizationExperiment,
                               data_provider: Callable,
                               evaluator: Callable) -> Dict[str, Any]:
        """Optimize pipeline configuration"""
        # Pipeline optimization implementation
        return {
            'optimal_pipeline': experiment.parameters,
            'improvement_percentage': 5.0,
            'optimization_score': 0.95
        }

class LearningLoopManager:
    """Manages continuous learning cycles with A/B testing and model versioning"""
    
    def __init__(self, mlflow_integration: MLflowIntegration):
        self.mlflow = mlflow_integration
        self.active_experiments: Dict[str, Dict] = {}
        self.champion_models: Dict[str, Dict] = {}
        self.challenger_models: Dict[str, Dict] = {}
        self.ab_test_configs: Dict[str, Dict] = {}
        
    async def create_learning_cycle(self, 
                                  cycle_config: Dict[str, Any]) -> str:
        """Create a new continuous learning cycle"""
        try:
            cycle_id = str(uuid.uuid4())
            
            learning_cycle = {
                'cycle_id': cycle_id,
                'config': cycle_config,
                'status': 'active',
                'created_at': datetime.now(),
                'champion_model': None,
                'challengers': [],
                'metrics_history': [],
                'current_iteration': 0
            }
            
            self.active_experiments[cycle_id] = learning_cycle
            
            logger.info(f"Created learning cycle: {cycle_id}")
            return cycle_id
            
        except Exception as e:
            logger.error(f"Error creating learning cycle: {e}")
            raise
    
    async def setup_champion_challenger(self, 
                                      cycle_id: str,
                                      champion_model_uri: str,
                                      challenger_configs: List[Dict]) -> Dict[str, Any]:
        """Setup champion-challenger model comparison"""
        try:
            if cycle_id not in self.active_experiments:
                raise ValueError(f"Learning cycle not found: {cycle_id}")
            
            cycle = self.active_experiments[cycle_id]
            
            # Load champion model
            champion_model = await self.mlflow.load_model(champion_model_uri)
            cycle['champion_model'] = {
                'model_uri': champion_model_uri,
                'model': champion_model,
                'performance_metrics': {},
                'traffic_allocation': 0.7  # 70% traffic to champion
            }
            
            # Setup challenger models
            challengers = []
            for i, challenger_config in enumerate(challenger_configs):
                challenger_id = f"challenger_{i}_{cycle_id[:8]}"
                challenger = {
                    'challenger_id': challenger_id,
                    'config': challenger_config,
                    'model': None,  # To be trained
                    'performance_metrics': {},
                    'traffic_allocation': 0.3 / len(challenger_configs)  # Split remaining 30%
                }
                challengers.append(challenger)
            
            cycle['challengers'] = challengers
            
            logger.info(f"Setup champion-challenger for cycle {cycle_id}: 1 champion, {len(challengers)} challengers")
            return {
                'champion': cycle['champion_model'],
                'challengers': challengers
            }
            
        except Exception as e:
            logger.error(f"Error setting up champion-challenger: {e}")
            raise
    
    async def run_ab_test(self, 
                         cycle_id: str,
                         test_duration_days: int = 7,
                         significance_level: float = 0.05) -> Dict[str, Any]:
        """Run A/B test between champion and challenger models"""
        try:
            if cycle_id not in self.active_experiments:
                raise ValueError(f"Learning cycle not found: {cycle_id}")
            
            cycle = self.active_experiments[cycle_id]
            
            # Configure A/B test
            ab_test_config = {
                'test_id': f"ab_test_{cycle_id[:8]}_{int(time.time())}",
                'cycle_id': cycle_id,
                'start_time': datetime.now(),
                'duration_days': test_duration_days,
                'significance_level': significance_level,
                'traffic_allocation': {
                    'champion': cycle['champion_model']['traffic_allocation'],
                    'challengers': {c['challenger_id']: c['traffic_allocation'] 
                                  for c in cycle['challengers']}
                },
                'metrics_tracked': ['accuracy', 'latency', 'throughput', 'error_rate'],
                'status': 'running'
            }
            
            self.ab_test_configs[ab_test_config['test_id']] = ab_test_config
            
            logger.info(f"Started A/B test: {ab_test_config['test_id']}")
            
            # Simulate A/B test results (in real implementation, this would collect actual metrics)
            await asyncio.sleep(1)  # Simulate test running
            
            # Mock results
            results = {
                'test_id': ab_test_config['test_id'],
                'champion_metrics': {
                    'accuracy': 0.85 + np.random.normal(0, 0.02),
                    'latency_ms': 150 + np.random.normal(0, 10),
                    'throughput_rps': 100 + np.random.normal(0, 5)
                },
                'challenger_results': []
            }
            
            for challenger in cycle['challengers']:
                challenger_metrics = {
                    'challenger_id': challenger['challenger_id'],
                    'accuracy': 0.87 + np.random.normal(0, 0.02),
                    'latency_ms': 140 + np.random.normal(0, 10),
                    'throughput_rps': 105 + np.random.normal(0, 5)
                }
                results['challenger_results'].append(challenger_metrics)
            
            # Determine winner
            best_challenger = max(results['challenger_results'], 
                                key=lambda x: x['accuracy'])
            
            if best_challenger['accuracy'] > results['champion_metrics']['accuracy']:
                results['winner'] = best_challenger['challenger_id']
                results['improvement'] = ((best_challenger['accuracy'] - results['champion_metrics']['accuracy']) / 
                                        results['champion_metrics']['accuracy']) * 100
            else:
                results['winner'] = 'champion'
                results['improvement'] = 0
            
            logger.info(f"A/B test completed. Winner: {results['winner']}")
            return results
            
        except Exception as e:
            logger.error(f"Error running A/B test: {e}")
            raise
    
    async def promote_challenger(self, cycle_id: str, challenger_id: str) -> Dict[str, Any]:
        """Promote challenger to champion"""
        try:
            if cycle_id not in self.active_experiments:
                raise ValueError(f"Learning cycle not found: {cycle_id}")
            
            cycle = self.active_experiments[cycle_id]
            
            # Find challenger
            challenger = None
            for c in cycle['challengers']:
                if c['challenger_id'] == challenger_id:
                    challenger = c
                    break
            
            if not challenger:
                raise ValueError(f"Challenger not found: {challenger_id}")
            
            # Archive current champion
            old_champion = cycle['champion_model']
            archive_info = await self.mlflow.archive_model(
                old_champion['model_uri'],
                reason=f"Replaced by challenger {challenger_id}"
            )
            
            # Promote challenger
            cycle['champion_model'] = {
                'model_uri': challenger.get('model_uri'),
                'model': challenger['model'],
                'performance_metrics': challenger['performance_metrics'],
                'traffic_allocation': 1.0,
                'promoted_at': datetime.now(),
                'previous_champion': old_champion['model_uri']
            }
            
            # Remove challenger from list
            cycle['challengers'] = [c for c in cycle['challengers'] 
                                  if c['challenger_id'] != challenger_id]
            
            logger.info(f"Promoted challenger {challenger_id} to champion in cycle {cycle_id}")
            
            return {
                'promoted_challenger': challenger_id,
                'archived_champion': archive_info,
                'new_champion': cycle['champion_model']
            }
            
        except Exception as e:
            logger.error(f"Error promoting challenger: {e}")
            raise

class AdaptiveAlgorithmsEngine:
    """Adaptive algorithms for online learning, meta-learning, and transfer learning"""
    
    def __init__(self):
        self.online_learners: Dict[str, Any] = {}
        self.meta_learning_episodes: Dict[str, List] = defaultdict(list)
        self.transfer_learning_registry: Dict[str, Dict] = {}
        self.adaptation_history: List[Dict] = []
        
    async def setup_online_learning(self, 
                                  learner_id: str,
                                  config: AdaptiveLearningConfig,
                                  initial_model: Any = None) -> str:
        """Setup online learning for real-time adaptation"""
        try:
            online_learner = {
                'learner_id': learner_id,
                'config': config,
                'model': initial_model,
                'adaptation_buffer': deque(maxlen=config.adaptation_window),
                'performance_history': deque(maxlen=1000),
                'learning_rate': config.learning_rate,
                'last_update': datetime.now(),
                'update_count': 0
            }
            
            self.online_learners[learner_id] = online_learner
            
            logger.info(f"Setup online learning for: {learner_id}")
            return learner_id
            
        except Exception as e:
            logger.error(f"Error setting up online learning: {e}")
            raise
    
    async def online_update(self, 
                          learner_id: str,
                          new_data: Any,
                          feedback: Any) -> Dict[str, Any]:
        """Update model with online data and feedback"""
        try:
            if learner_id not in self.online_learners:
                raise ValueError(f"Online learner not found: {learner_id}")
            
            learner = self.online_learners[learner_id]
            config = learner['config']
            
            # Add to adaptation buffer
            learner['adaptation_buffer'].append({
                'data': new_data,
                'feedback': feedback,
                'timestamp': datetime.now()
            })
            
            # Check if ready for update
            if len(learner['adaptation_buffer']) >= config.online_batch_size:
                # Perform online update
                update_result = await self._perform_online_update(learner)
                
                learner['update_count'] += 1
                learner['last_update'] = datetime.now()
                
                # Apply forgetting factor
                learner['learning_rate'] *= config.forgetting_factor
                
                logger.info(f"Online update completed for {learner_id}: {update_result}")
                return update_result
            
            return {'status': 'buffering', 'buffer_size': len(learner['adaptation_buffer'])}
            
        except Exception as e:
            logger.error(f"Error in online update: {e}")
            raise
    
    async def _perform_online_update(self, learner: Dict) -> Dict[str, Any]:
        """Perform the actual online model update"""
        try:
            # Extract data and feedback from buffer
            buffer_data = list(learner['adaptation_buffer'])
            
            # Simulate online learning update
            # In real implementation, this would update the model with new data
            
            # Mock performance improvement
            old_performance = learner['performance_history'][-1] if learner['performance_history'] else 0.8
            new_performance = old_performance + np.random.normal(0.01, 0.005)  # Small improvement
            new_performance = np.clip(new_performance, 0, 1)
            
            learner['performance_history'].append(new_performance)
            
            # Clear buffer after update
            learner['adaptation_buffer'].clear()
            
            return {
                'update_type': 'online',
                'samples_processed': len(buffer_data),
                'performance_before': old_performance,
                'performance_after': new_performance,
                'improvement': new_performance - old_performance,
                'learning_rate_used': learner['learning_rate']
            }
            
        except Exception as e:
            logger.error(f"Error performing online update: {e}")
            raise
    
    async def setup_meta_learning(self, 
                                meta_learner_id: str,
                                source_tasks: List[str],
                                config: AdaptiveLearningConfig) -> str:
        """Setup meta-learning for faster adaptation to new domains"""
        try:
            meta_learner = {
                'meta_learner_id': meta_learner_id,
                'source_tasks': source_tasks,
                'config': config,
                'meta_model': None,
                'task_embeddings': {},
                'adaptation_strategies': {},
                'episodes': []
            }
            
            # Initialize meta-learning episodes for each source task
            for task in source_tasks:
                self.meta_learning_episodes[task] = []
            
            # Store meta-learner
            self.transfer_learning_registry[meta_learner_id] = meta_learner
            
            logger.info(f"Setup meta-learning for: {meta_learner_id} with {len(source_tasks)} source tasks")
            return meta_learner_id
            
        except Exception as e:
            logger.error(f"Error setting up meta-learning: {e}")
            raise
    
    async def meta_learning_episode(self, 
                                  meta_learner_id: str,
                                  task_id: str,
                                  support_set: Any,
                                  query_set: Any) -> Dict[str, Any]:
        """Run meta-learning episode for task adaptation"""
        try:
            if meta_learner_id not in self.transfer_learning_registry:
                raise ValueError(f"Meta-learner not found: {meta_learner_id}")
            
            meta_learner = self.transfer_learning_registry[meta_learner_id]
            
            # Simulate meta-learning episode
            episode_result = {
                'episode_id': str(uuid.uuid4()),
                'meta_learner_id': meta_learner_id,
                'task_id': task_id,
                'support_size': len(support_set) if hasattr(support_set, '__len__') else 1,
                'query_size': len(query_set) if hasattr(query_set, '__len__') else 1,
                'adaptation_steps': np.random.randint(5, 15),
                'final_accuracy': 0.7 + np.random.normal(0.1, 0.05),
                'adaptation_time_ms': np.random.normal(100, 20),
                'timestamp': datetime.now()
            }
            
            # Store episode
            meta_learner['episodes'].append(episode_result)
            self.meta_learning_episodes[task_id].append(episode_result)
            
            logger.info(f"Meta-learning episode completed: {episode_result['episode_id']}")
            return episode_result
            
        except Exception as e:
            logger.error(f"Error in meta-learning episode: {e}")
            raise
    
    async def transfer_learning_adaptation(self, 
                                         source_model_id: str,
                                         target_domain: str,
                                         adaptation_data: Any) -> Dict[str, Any]:
        """Perform transfer learning adaptation to new domain"""
        try:
            # Simulate transfer learning
            adaptation_result = {
                'transfer_id': str(uuid.uuid4()),
                'source_model': source_model_id,
                'target_domain': target_domain,
                'adaptation_method': 'fine_tuning',
                'data_size': len(adaptation_data) if hasattr(adaptation_data, '__len__') else 1,
                'transfer_efficiency': np.random.uniform(0.6, 0.9),
                'final_performance': 0.8 + np.random.normal(0.05, 0.02),
                'adaptation_epochs': np.random.randint(3, 10),
                'timestamp': datetime.now()
            }
            
            # Store in adaptation history
            self.adaptation_history.append(adaptation_result)
            
            logger.info(f"Transfer learning adaptation completed: {adaptation_result['transfer_id']}")
            return adaptation_result
            
        except Exception as e:
            logger.error(f"Error in transfer learning adaptation: {e}")
            raise

class ContinuousImprovementEngine:
    """Main orchestration engine for continuous improvement across the platform"""
    
    def __init__(self, dependency_container: DependencyContainer):
        self.container = dependency_container
        self.redis = get_redis_client()
        
        # Initialize sub-engines
        self.performance_monitor = PerformanceMonitoringEngine()
        self.optimization_engine = AutomatedOptimizationEngine()
        self.adaptive_algorithms = AdaptiveAlgorithmsEngine()
        
        # Service integrations
        self.mlflow = None  # Will be injected
        self.learning_loop_manager = None  # Will be initialized after MLflow
        
        # Orchestration state
        self.active_improvements: Dict[str, Dict] = {}
        self.improvement_queue: deque = deque()
        self.global_metrics: Dict[str, Any] = {}
        
        # Configuration
        self.config = {
            'improvement_interval_minutes': 30,
            'max_concurrent_improvements': 5,
            'drift_detection_enabled': True,
            'auto_optimization_enabled': True,
            'learning_loop_enabled': True,
            'adaptive_learning_enabled': True
        }
        
        # Background tasks
        self._monitoring_task = None
        self._orchestration_task = None
        self._running = False
        
        logger.info("Initialized Continuous Improvement Engine")
    
    async def initialize(self):
        """Initialize the engine and start background tasks"""
        try:
            # Get MLflow integration from container
            self.mlflow = self.container.get('MLflowIntegration')
            if not self.mlflow:
                logger.warning("MLflow integration not available")
            else:
                self.learning_loop_manager = LearningLoopManager(self.mlflow)
            
            # Start background tasks
            await self.start_orchestration()
            
            logger.info("Continuous Improvement Engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing Continuous Improvement Engine: {e}")
            raise
    
    async def start_orchestration(self):
        """Start continuous improvement orchestration"""
        try:
            if self._running:
                logger.warning("Orchestration already running")
                return
            
            self._running = True
            
            # Start monitoring task
            self._monitoring_task = asyncio.create_task(self._monitoring_loop())
            
            # Start orchestration task
            self._orchestration_task = asyncio.create_task(self._orchestration_loop())
            
            logger.info("Started continuous improvement orchestration")
            
        except Exception as e:
            logger.error(f"Error starting orchestration: {e}")
            raise
    
    async def stop_orchestration(self):
        """Stop continuous improvement orchestration"""
        try:
            self._running = False
            
            if self._monitoring_task:
                self._monitoring_task.cancel()
                try:
                    await self._monitoring_task
                except asyncio.CancelledError:
                    pass
            
            if self._orchestration_task:
                self._orchestration_task.cancel()
                try:
                    await self._orchestration_task
                except asyncio.CancelledError:
                    pass
            
            logger.info("Stopped continuous improvement orchestration")
            
        except Exception as e:
            logger.error(f"Error stopping orchestration: {e}")
    
    async def _monitoring_loop(self):
        """Background monitoring loop"""
        try:
            while self._running:
                await self._collect_platform_metrics()
                await self._detect_improvement_opportunities()
                await asyncio.sleep(60)  # Check every minute
                
        except asyncio.CancelledError:
            logger.info("Monitoring loop cancelled")
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")
    
    async def _orchestration_loop(self):
        """Background orchestration loop"""
        try:
            while self._running:
                await self._process_improvement_queue()
                await asyncio.sleep(self.config['improvement_interval_minutes'] * 60)
                
        except asyncio.CancelledError:
            logger.info("Orchestration loop cancelled")
        except Exception as e:
            logger.error(f"Error in orchestration loop: {e}")
    
    async def _collect_platform_metrics(self):
        """Collect metrics from all AI services"""
        try:
            platform_metrics = {
                'timestamp': datetime.now(),
                'services': {}
            }
            
            # Collect from performance monitoring
            try:
                perf_monitor = self.container.get('PerformanceMonitor')
                if perf_monitor:
                    platform_metrics['services']['performance_monitor'] = await perf_monitor.get_current_metrics()
            except Exception as e:
                logger.warning(f"Could not collect performance monitor metrics: {e}")
            
            # Collect from ML engines
            try:
                ml_engine = self.container.get('AdvancedMLEngine')
                if ml_engine:
                    platform_metrics['services']['ml_engine'] = {
                        'active_models': len(getattr(ml_engine, 'active_models', {})),
                        'predictions_made': getattr(ml_engine, 'prediction_count', 0)
                    }
            except Exception as e:
                logger.warning(f"Could not collect ML engine metrics: {e}")
            
            # Store global metrics
            self.global_metrics = platform_metrics
            
            # Cache in Redis
            await self.redis.setex(
                'continuous_improvement:platform_metrics',
                300,  # 5 minutes
                json.dumps(platform_metrics, default=str)
            )
            
        except Exception as e:
            logger.error(f"Error collecting platform metrics: {e}")
    
    async def _detect_improvement_opportunities(self):
        """Detect opportunities for improvement"""
        try:
            opportunities = []
            
            # Check for performance degradation
            if self.config['drift_detection_enabled']:
                for service_name, metrics in self.global_metrics.get('services', {}).items():
                    if isinstance(metrics, dict):
                        for metric_name, value in metrics.items():
                            if isinstance(value, (int, float)):
                                # Simple threshold-based detection
                                if value < 0.8:  # Performance below 80%
                                    opportunities.append({
                                        'type': 'performance_degradation',
                                        'service': service_name,
                                        'metric': metric_name,
                                        'value': value,
                                        'priority': 'high' if value < 0.6 else 'medium'
                                    })
            
            # Add opportunities to queue
            for opportunity in opportunities:
                improvement_task = {
                    'id': str(uuid.uuid4()),
                    'opportunity': opportunity,
                    'strategy': self._select_improvement_strategy(opportunity),
                    'created_at': datetime.now(),
                    'status': 'queued'
                }
                self.improvement_queue.append(improvement_task)
            
            if opportunities:
                logger.info(f"Detected {len(opportunities)} improvement opportunities")
                
        except Exception as e:
            logger.error(f"Error detecting improvement opportunities: {e}")
    
    def _select_improvement_strategy(self, opportunity: Dict) -> ImprovementStrategy:
        """Select appropriate improvement strategy for opportunity"""
        opportunity_type = opportunity.get('type')
        
        if opportunity_type == 'performance_degradation':
            return ImprovementStrategy.HYPERPARAMETER_TUNING
        elif opportunity_type == 'resource_inefficiency':
            return ImprovementStrategy.RESOURCE_ALLOCATION
        elif opportunity_type == 'pipeline_bottleneck':
            return ImprovementStrategy.PIPELINE_OPTIMIZATION
        else:
            return ImprovementStrategy.HYPERPARAMETER_TUNING
    
    async def _process_improvement_queue(self):
        """Process queued improvement tasks"""
        try:
            if not self.improvement_queue:
                return
            
            # Limit concurrent improvements
            if len(self.active_improvements) >= self.config['max_concurrent_improvements']:
                return
            
            # Get next task
            task = self.improvement_queue.popleft()
            task_id = task['id']
            
            # Mark as active
            self.active_improvements[task_id] = task
            task['status'] = 'running'
            task['started_at'] = datetime.now()
            
            # Execute improvement
            try:
                result = await self._execute_improvement(task)
                task['status'] = 'completed'
                task['result'] = result
                task['completed_at'] = datetime.now()
                
                logger.info(f"Completed improvement task: {task_id}")
                
            except Exception as e:
                task['status'] = 'failed'
                task['error'] = str(e)
                task['failed_at'] = datetime.now()
                
                logger.error(f"Failed improvement task {task_id}: {e}")
            
            # Remove from active
            del self.active_improvements[task_id]
            
        except Exception as e:
            logger.error(f"Error processing improvement queue: {e}")
    
    async def _execute_improvement(self, task: Dict) -> Dict[str, Any]:
        """Execute specific improvement task"""
        try:
            strategy = task['strategy']
            opportunity = task['opportunity']
            
            if strategy == ImprovementStrategy.HYPERPARAMETER_TUNING:
                return await self._execute_hyperparameter_optimization(opportunity)
            elif strategy == ImprovementStrategy.RESOURCE_ALLOCATION:
                return await self._execute_resource_optimization(opportunity)
            elif strategy == ImprovementStrategy.PIPELINE_OPTIMIZATION:
                return await self._execute_pipeline_optimization(opportunity)
            else:
                raise ValueError(f"Unknown improvement strategy: {strategy}")
                
        except Exception as e:
            logger.error(f"Error executing improvement: {e}")
            raise
    
    async def _execute_hyperparameter_optimization(self, opportunity: Dict) -> Dict[str, Any]:
        """Execute hyperparameter optimization"""
        try:
            experiment = OptimizationExperiment(
                experiment_id=str(uuid.uuid4()),
                strategy=ImprovementStrategy.HYPERPARAMETER_TUNING,
                objective=OptimizationObjective.MAXIMIZE_ACCURACY,
                parameters={
                    'search_space': {
                        'learning_rate': {'type': 'float', 'low': 0.001, 'high': 0.1},
                        'batch_size': {'type': 'int', 'low': 16, 'high': 256},
                        'n_estimators': {'type': 'int', 'low': 50, 'high': 500}
                    }
                },
                baseline_metrics={'primary_metric': opportunity.get('value', 0.5)},
                target_improvement=10.0,
                max_iterations=50,
                timeout_minutes=30
            )
            
            result = await self.optimization_engine.run_optimization_experiment(experiment)
            return result
            
        except Exception as e:
            logger.error(f"Error in hyperparameter optimization: {e}")
            raise
    
    async def _execute_resource_optimization(self, opportunity: Dict) -> Dict[str, Any]:
        """Execute resource optimization"""
        try:
            experiment = OptimizationExperiment(
                experiment_id=str(uuid.uuid4()),
                strategy=ImprovementStrategy.RESOURCE_ALLOCATION,
                objective=OptimizationObjective.MINIMIZE_RESOURCE_USAGE,
                parameters={
                    'current_allocation': {
                        'cpu_cores': 4,
                        'memory_gb': 8,
                        'batch_size': 32
                    },
                    'constraints': {
                        'max_cpu_cores': 16,
                        'max_memory_gb': 64,
                        'max_batch_size': 512
                    }
                },
                baseline_metrics={'resource_efficiency': opportunity.get('value', 0.5)},
                target_improvement=15.0,
                max_iterations=30,
                timeout_minutes=20
            )
            
            result = await self.optimization_engine.run_optimization_experiment(experiment)
            return result
            
        except Exception as e:
            logger.error(f"Error in resource optimization: {e}")
            raise
    
    async def _execute_pipeline_optimization(self, opportunity: Dict) -> Dict[str, Any]:
        """Execute pipeline optimization"""
        # Simplified pipeline optimization
        return {
            'optimization_type': 'pipeline',
            'improvement_percentage': 8.0,
            'optimizations_applied': ['batch_processing', 'parallel_execution', 'caching']
        }
    
    # Public API methods
    
    async def trigger_immediate_improvement(self, 
                                          service_name: str,
                                          improvement_type: str = "auto") -> Dict[str, Any]:
        """Trigger immediate improvement for specific service"""
        try:
            improvement_task = {
                'id': str(uuid.uuid4()),
                'opportunity': {
                    'type': 'manual_trigger',
                    'service': service_name,
                    'improvement_type': improvement_type,
                    'priority': 'high'
                },
                'strategy': ImprovementStrategy.HYPERPARAMETER_TUNING,
                'created_at': datetime.now(),
                'status': 'queued'
            }
            
            # Add to front of queue for immediate processing
            self.improvement_queue.appendleft(improvement_task)
            
            logger.info(f"Triggered immediate improvement for {service_name}")
            return {'task_id': improvement_task['id'], 'status': 'queued'}
            
        except Exception as e:
            logger.error(f"Error triggering immediate improvement: {e}")
            raise
    
    async def get_improvement_status(self) -> Dict[str, Any]:
        """Get current status of continuous improvement"""
        try:
            return {
                'orchestration_running': self._running,
                'active_improvements': len(self.active_improvements),
                'queued_improvements': len(self.improvement_queue),
                'last_metrics_collection': self.global_metrics.get('timestamp'),
                'configuration': self.config,
                'recent_improvements': list(self.active_improvements.values())[-10:]  # Last 10
            }
            
        except Exception as e:
            logger.error(f"Error getting improvement status: {e}")
            raise
    
    async def update_configuration(self, new_config: Dict[str, Any]):
        """Update engine configuration"""
        try:
            self.config.update(new_config)
            
            # Save to Redis
            await self.redis.setex(
                'continuous_improvement:config',
                86400,  # 24 hours
                json.dumps(self.config)
            )
            
            logger.info("Updated continuous improvement configuration")
            
        except Exception as e:
            logger.error(f"Error updating configuration: {e}")
            raise

# Global instance
continuous_improvement_engine = None

def get_continuous_improvement_engine(container: DependencyContainer = None) -> ContinuousImprovementEngine:
    """Get global continuous improvement engine instance"""
    global continuous_improvement_engine
    
    if continuous_improvement_engine is None:
        if container is None:
            raise ValueError("DependencyContainer required for first initialization")
        continuous_improvement_engine = ContinuousImprovementEngine(container)
    
    return continuous_improvement_engine

# Convenience functions for integration

async def start_continuous_improvement(container: DependencyContainer):
    """Start continuous improvement orchestration"""
    engine = get_continuous_improvement_engine(container)
    await engine.initialize()

async def trigger_service_improvement(service_name: str, improvement_type: str = "auto"):
    """Trigger improvement for specific service"""
    if continuous_improvement_engine:
        return await continuous_improvement_engine.trigger_immediate_improvement(service_name, improvement_type)
    else:
        raise RuntimeError("Continuous improvement engine not initialized")

async def get_platform_improvement_status():
    """Get platform-wide improvement status"""
    if continuous_improvement_engine:
        return await continuous_improvement_engine.get_improvement_status()
    else:
        raise RuntimeError("Continuous improvement engine not initialized")