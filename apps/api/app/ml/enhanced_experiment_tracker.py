"""
Enhanced Experiment Tracking Engine
====================================

Advanced experiment tracking system for AI companies that builds on the existing MLOps Platform Core.
Provides comprehensive experiment management with real-time metrics, collaborative features,
experiment genealogy, and advanced analytics.

Key Features:
- Advanced experiment comparison and analysis
- Real-time metrics streaming during training
- Multi-objective optimization tracking
- Experiment genealogy and lineage tracking
- Collaborative experiment sharing
- Custom metric definitions and tracking
- Distributed training metrics aggregation
- Resource utilization monitoring
- Statistical experiment comparison
- Performance trend analysis
- Automated experiment reporting
"""

import os
import json
import uuid
import time
import asyncio
import threading
import statistics
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple, Callable, Set
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, deque
import numpy as np
import pandas as pd

# MLflow integration
try:
    import mlflow
    import mlflow.sklearn
    import mlflow.tensorflow
    import mlflow.pytorch
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False

# Statistical analysis
from scipy import stats
from sklearn.base import BaseEstimator
from sklearn.metrics import classification_report, mean_squared_error, r2_score

# Import existing MLOps capabilities
try:
    from app.ml.mlops_platform import (
        MLOpsCore, ModelFramework, ExperimentStatus, 
        ExperimentConfig, ModelMetadata
    )
    from app.ml.advanced_modeling_engine import AdvancedMLModelingEngine
    from app.ml.feature_engineering import AdvancedFeatureEngineer
    from app.ml.data_quality import AdvancedDataQualityAnalyzer
except ImportError as e:
    logging.warning(f"Could not import existing ML modules: {e}")
    MLOpsCore = None
    ModelFramework = None
    ExperimentStatus = None

logger = logging.getLogger(__name__)


# Enhanced Enums and Data Classes
class MetricType(str, Enum):
    """Types of metrics that can be tracked."""
    ACCURACY = "accuracy"
    PRECISION = "precision" 
    RECALL = "recall"
    F1_SCORE = "f1_score"
    AUC_ROC = "auc_roc"
    AUC_PR = "auc_pr"
    MSE = "mse"
    MAE = "mae"
    RMSE = "rmse"
    R2 = "r2"
    LOSS = "loss"
    VAL_LOSS = "val_loss"
    CUSTOM = "custom"


class OptimizationObjective(str, Enum):
    """Multi-objective optimization objectives."""
    MAXIMIZE = "maximize"
    MINIMIZE = "minimize"
    TARGET = "target"


class ExperimentType(str, Enum):
    """Types of experiments."""
    SINGLE_MODEL = "single_model"
    MODEL_COMPARISON = "model_comparison"
    HYPERPARAMETER_OPTIMIZATION = "hyperparameter_optimization"
    FEATURE_SELECTION = "feature_selection"
    ARCHITECTURE_SEARCH = "architecture_search"
    ENSEMBLE_OPTIMIZATION = "ensemble_optimization"
    MULTI_OBJECTIVE = "multi_objective"


class SharePermission(str, Enum):
    """Experiment sharing permissions."""
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"


@dataclass
class MetricDefinition:
    """Custom metric definition."""
    name: str
    description: str
    metric_type: MetricType
    objective: OptimizationObjective
    weight: float = 1.0
    threshold: Optional[float] = None
    aggregation_method: str = "mean"  # mean, median, max, min, last
    is_primary: bool = False
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class ExperimentLineage:
    """Experiment genealogy and lineage information."""
    experiment_id: str
    parent_experiment_ids: List[str]
    child_experiment_ids: List[str]
    related_experiment_ids: List[str]  # Similar experiments
    fork_reason: Optional[str] = None
    merge_source_ids: List[str] = None
    lineage_depth: int = 0
    
    def __post_init__(self):
        if self.merge_source_ids is None:
            self.merge_source_ids = []


@dataclass
class CollaborationInfo:
    """Experiment collaboration information."""
    shared_with: Dict[str, SharePermission]  # user_id -> permission
    shared_teams: Dict[str, SharePermission]  # team_id -> permission
    public: bool = False
    comments: List[Dict[str, Any]] = None
    discussion_thread_id: Optional[str] = None
    
    def __post_init__(self):
        if self.comments is None:
            self.comments = []


@dataclass
class ResourceUsage:
    """Resource utilization tracking."""
    cpu_usage_percent: List[float]
    memory_usage_gb: List[float]
    gpu_usage_percent: List[float]
    gpu_memory_usage_gb: List[float]
    disk_io_mb_s: List[float]
    network_io_mb_s: List[float]
    training_time_seconds: float
    total_compute_cost: Optional[float] = None
    carbon_emissions_kg: Optional[float] = None
    
    @property
    def avg_cpu_usage(self) -> float:
        return statistics.mean(self.cpu_usage_percent) if self.cpu_usage_percent else 0.0
    
    @property
    def peak_memory_usage(self) -> float:
        return max(self.memory_usage_gb) if self.memory_usage_gb else 0.0
    
    @property
    def avg_gpu_usage(self) -> float:
        return statistics.mean(self.gpu_usage_percent) if self.gpu_usage_percent else 0.0


@dataclass
class ExperimentInsights:
    """Automated experiment insights and recommendations."""
    performance_summary: Dict[str, float]
    best_hyperparameters: Dict[str, Any]
    feature_importance_ranking: List[Tuple[str, float]]
    convergence_analysis: Dict[str, Any]
    stability_metrics: Dict[str, float]
    efficiency_score: float
    recommendations: List[str]
    anomalies: List[Dict[str, Any]]
    comparison_insights: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.comparison_insights is None:
            self.comparison_insights = {}


class EnhancedExperimentTracker:
    """
    Enhanced experiment tracking system with advanced capabilities.
    
    Provides comprehensive experiment management, real-time metrics tracking,
    collaboration features, and advanced analytics for AI companies.
    """
    
    def __init__(self, storage_path: str = "./enhanced_experiments", 
                 mlflow_tracking_uri: Optional[str] = None):
        self.storage_path = storage_path
        self.experiments_path = os.path.join(storage_path, "experiments")
        self.metrics_path = os.path.join(storage_path, "metrics")
        self.lineage_path = os.path.join(storage_path, "lineage")
        self.insights_path = os.path.join(storage_path, "insights")
        
        # Create directories
        for path in [self.experiments_path, self.metrics_path, self.lineage_path, self.insights_path]:
            os.makedirs(path, exist_ok=True)
        
        # Initialize MLflow if available
        self.mlflow_enabled = MLFLOW_AVAILABLE
        if self.mlflow_enabled and mlflow_tracking_uri:
            mlflow.set_tracking_uri(mlflow_tracking_uri)
        
        # In-memory storage for active experiments
        self._active_experiments: Dict[str, Dict[str, Any]] = {}
        self._real_time_metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=10000))
        self._metric_definitions: Dict[str, MetricDefinition] = {}
        self._experiment_lineage: Dict[str, ExperimentLineage] = {}
        self._collaboration_info: Dict[str, CollaborationInfo] = {}
        self._resource_monitors: Dict[str, threading.Thread] = {}
        
        # Performance tracking
        self._metric_update_counts = defaultdict(int)
        self._last_metric_updates = {}
        
        # Load existing data
        self._load_existing_data()
        
        logger.info(f"Enhanced Experiment Tracker initialized at {storage_path}")
    
    def _load_existing_data(self):
        """Load existing experiment data from storage."""
        try:
            # Load metric definitions
            metric_defs_file = os.path.join(self.storage_path, "metric_definitions.json")
            if os.path.exists(metric_defs_file):
                with open(metric_defs_file, 'r') as f:
                    metric_defs = json.load(f)
                    for name, data in metric_defs.items():
                        self._metric_definitions[name] = MetricDefinition(**data)
            
            # Load experiment lineage
            lineage_files = [f for f in os.listdir(self.lineage_path) if f.endswith('.json')]
            for lineage_file in lineage_files:
                exp_id = lineage_file.replace('.json', '')
                with open(os.path.join(self.lineage_path, lineage_file), 'r') as f:
                    lineage_data = json.load(f)
                    self._experiment_lineage[exp_id] = ExperimentLineage(**lineage_data)
            
            # Load collaboration info
            for exp_id in self._experiment_lineage.keys():
                collab_file = os.path.join(self.storage_path, f"collaboration_{exp_id}.json")
                if os.path.exists(collab_file):
                    with open(collab_file, 'r') as f:
                        collab_data = json.load(f)
                        self._collaboration_info[exp_id] = CollaborationInfo(**collab_data)
            
            logger.info(f"Loaded {len(self._metric_definitions)} metric definitions, "
                       f"{len(self._experiment_lineage)} experiment lineages")
        
        except Exception as e:
            logger.warning(f"Could not load existing experiment data: {e}")
    
    def define_custom_metric(self, metric_def: MetricDefinition) -> bool:
        """Define a custom metric for tracking."""
        try:
            self._metric_definitions[metric_def.name] = metric_def
            
            # Save to disk
            metric_defs_file = os.path.join(self.storage_path, "metric_definitions.json")
            metric_defs_data = {name: asdict(metric_def) 
                              for name, metric_def in self._metric_definitions.items()}
            
            with open(metric_defs_file, 'w') as f:
                json.dump(metric_defs_data, f, indent=2, default=str)
            
            logger.info(f"Defined custom metric: {metric_def.name}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to define custom metric {metric_def.name}: {e}")
            return False
    
    def create_enhanced_experiment(self,
                                 name: str,
                                 description: str,
                                 experiment_type: ExperimentType,
                                 dataset_config: Dict[str, Any],
                                 model_configs: List[Dict[str, Any]],
                                 optimization_objectives: List[MetricDefinition],
                                 created_by: str = "system",
                                 parent_experiment_ids: List[str] = None,
                                 tags: List[str] = None,
                                 collaboration_settings: CollaborationInfo = None,
                                 **kwargs) -> str:
        """Create an enhanced experiment with advanced tracking capabilities."""
        
        experiment_id = str(uuid.uuid4())
        
        # Create experiment configuration
        experiment_config = {
            'experiment_id': experiment_id,
            'name': name,
            'description': description,
            'experiment_type': experiment_type,
            'created_by': created_by,
            'created_at': datetime.utcnow().isoformat(),
            'dataset_config': dataset_config,
            'model_configs': model_configs,
            'optimization_objectives': [asdict(obj) for obj in optimization_objectives],
            'tags': tags or [],
            'status': ExperimentStatus.QUEUED.value if ExperimentStatus else 'queued',
            'metadata': kwargs
        }
        
        # Initialize lineage
        lineage = ExperimentLineage(
            experiment_id=experiment_id,
            parent_experiment_ids=parent_experiment_ids or [],
            child_experiment_ids=[],
            related_experiment_ids=[],
            lineage_depth=self._calculate_lineage_depth(parent_experiment_ids or [])
        )
        
        # Initialize collaboration
        if collaboration_settings is None:
            collaboration_settings = CollaborationInfo(
                shared_with={created_by: SharePermission.ADMIN},
                shared_teams={},
                public=False
            )
        
        # Store experiment
        self._active_experiments[experiment_id] = experiment_config
        self._experiment_lineage[experiment_id] = lineage
        self._collaboration_info[experiment_id] = collaboration_settings
        
        # Initialize real-time metrics
        self._real_time_metrics[experiment_id] = deque(maxlen=10000)
        
        # Update parent lineage
        for parent_id in parent_experiment_ids or []:
            if parent_id in self._experiment_lineage:
                self._experiment_lineage[parent_id].child_experiment_ids.append(experiment_id)
        
        # Save to disk
        self._save_experiment_config(experiment_id, experiment_config)
        self._save_experiment_lineage(experiment_id, lineage)
        self._save_collaboration_info(experiment_id, collaboration_settings)
        
        # Initialize MLflow experiment if enabled
        if self.mlflow_enabled:
            try:
                mlflow_exp = mlflow.create_experiment(
                    name=f"{name}_{experiment_id[:8]}",
                    tags={
                        'experiment_type': experiment_type,
                        'created_by': created_by,
                        'enhanced_tracking': 'true'
                    }
                )
                experiment_config['mlflow_experiment_id'] = mlflow_exp
            except Exception as e:
                logger.warning(f"Could not create MLflow experiment: {e}")
        
        logger.info(f"Created enhanced experiment {name} with ID {experiment_id}")
        return experiment_id
    
    def start_experiment_monitoring(self, experiment_id: str) -> bool:
        """Start real-time monitoring for an experiment."""
        if experiment_id not in self._active_experiments:
            logger.error(f"Experiment {experiment_id} not found")
            return False
        
        try:
            # Start resource monitoring thread
            if experiment_id not in self._resource_monitors:
                monitor_thread = threading.Thread(
                    target=self._monitor_resources,
                    args=(experiment_id,),
                    daemon=True
                )
                monitor_thread.start()
                self._resource_monitors[experiment_id] = monitor_thread
            
            # Update experiment status
            self._active_experiments[experiment_id]['status'] = ExperimentStatus.RUNNING.value if ExperimentStatus else 'running'
            self._active_experiments[experiment_id]['started_at'] = datetime.utcnow().isoformat()
            
            logger.info(f"Started monitoring for experiment {experiment_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to start monitoring for experiment {experiment_id}: {e}")
            return False
    
    def log_metric(self, 
                   experiment_id: str,
                   metric_name: str,
                   value: Union[float, int],
                   step: Optional[int] = None,
                   timestamp: Optional[datetime] = None,
                   metadata: Dict[str, Any] = None) -> bool:
        """Log a metric value for an experiment with real-time tracking."""
        
        if experiment_id not in self._active_experiments:
            logger.warning(f"Experiment {experiment_id} not found")
            return False
        
        try:
            current_time = timestamp or datetime.utcnow()
            current_step = step or self._metric_update_counts[f"{experiment_id}_{metric_name}"]
            
            metric_entry = {
                'experiment_id': experiment_id,
                'metric_name': metric_name,
                'value': float(value),
                'step': current_step,
                'timestamp': current_time.isoformat(),
                'metadata': metadata or {}
            }
            
            # Store in real-time buffer
            self._real_time_metrics[experiment_id].append(metric_entry)
            
            # Update counters
            self._metric_update_counts[f"{experiment_id}_{metric_name}"] += 1
            self._last_metric_updates[experiment_id] = current_time
            
            # Save to disk periodically (every 100 updates)
            if self._metric_update_counts[f"{experiment_id}_{metric_name}"] % 100 == 0:
                self._flush_metrics_to_disk(experiment_id)
            
            # Log to MLflow if enabled
            if self.mlflow_enabled:
                try:
                    mlflow_exp_id = self._active_experiments[experiment_id].get('mlflow_experiment_id')
                    if mlflow_exp_id:
                        with mlflow.start_run(experiment_id=mlflow_exp_id):
                            mlflow.log_metric(metric_name, value, step)
                except Exception as e:
                    logger.warning(f"Failed to log to MLflow: {e}")
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to log metric {metric_name} for experiment {experiment_id}: {e}")
            return False
    
    def log_hyperparameter(self,
                          experiment_id: str,
                          param_name: str,
                          value: Any) -> bool:
        """Log a hyperparameter for an experiment."""
        
        if experiment_id not in self._active_experiments:
            logger.warning(f"Experiment {experiment_id} not found")
            return False
        
        try:
            if 'hyperparameters' not in self._active_experiments[experiment_id]:
                self._active_experiments[experiment_id]['hyperparameters'] = {}
            
            self._active_experiments[experiment_id]['hyperparameters'][param_name] = value
            
            # Log to MLflow if enabled
            if self.mlflow_enabled:
                try:
                    mlflow_exp_id = self._active_experiments[experiment_id].get('mlflow_experiment_id')
                    if mlflow_exp_id:
                        with mlflow.start_run(experiment_id=mlflow_exp_id):
                            mlflow.log_param(param_name, value)
                except Exception as e:
                    logger.warning(f"Failed to log param to MLflow: {e}")
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to log hyperparameter {param_name}: {e}")
            return False
    
    def get_real_time_metrics(self, 
                             experiment_id: str,
                             metric_names: List[str] = None,
                             last_n_points: int = 1000) -> Dict[str, List[Dict[str, Any]]]:
        """Get real-time metrics for an experiment."""
        
        if experiment_id not in self._real_time_metrics:
            return {}
        
        metrics_data = defaultdict(list)
        
        # Get recent metrics from buffer
        recent_metrics = list(self._real_time_metrics[experiment_id])[-last_n_points:]
        
        for entry in recent_metrics:
            if metric_names is None or entry['metric_name'] in metric_names:
                metrics_data[entry['metric_name']].append(entry)
        
        return dict(metrics_data)
    
    def compare_experiments(self, 
                           experiment_ids: List[str],
                           comparison_metrics: List[str] = None,
                           statistical_tests: bool = True) -> Dict[str, Any]:
        """Compare multiple experiments with statistical analysis."""
        
        if len(experiment_ids) < 2:
            raise ValueError("At least 2 experiments required for comparison")
        
        comparison_results = {
            'experiment_ids': experiment_ids,
            'comparison_timestamp': datetime.utcnow().isoformat(),
            'metrics_comparison': {},
            'statistical_tests': {},
            'performance_ranking': [],
            'insights': []
        }
        
        # Collect metrics for all experiments
        experiment_metrics = {}
        for exp_id in experiment_ids:
            if exp_id in self._active_experiments:
                metrics = self.get_experiment_metrics(exp_id)
                experiment_metrics[exp_id] = metrics
        
        # Compare metrics
        if comparison_metrics is None:
            # Use all common metrics
            all_metrics = set()
            for metrics in experiment_metrics.values():
                all_metrics.update(metrics.keys())
            comparison_metrics = list(all_metrics)
        
        for metric_name in comparison_metrics:
            metric_comparison = {
                'metric_name': metric_name,
                'values': {},
                'statistics': {},
                'best_experiment': None,
                'best_value': None
            }
            
            metric_values = []
            valid_experiments = []
            
            for exp_id in experiment_ids:
                if exp_id in experiment_metrics and metric_name in experiment_metrics[exp_id]:
                    values = experiment_metrics[exp_id][metric_name]
                    if values:
                        final_value = values[-1]['value'] if isinstance(values, list) else values
                        metric_comparison['values'][exp_id] = final_value
                        metric_values.append(final_value)
                        valid_experiments.append(exp_id)
            
            if len(metric_values) > 1:
                # Calculate statistics
                metric_comparison['statistics'] = {
                    'mean': statistics.mean(metric_values),
                    'std': statistics.stdev(metric_values) if len(metric_values) > 1 else 0,
                    'min': min(metric_values),
                    'max': max(metric_values),
                    'range': max(metric_values) - min(metric_values)
                }
                
                # Determine best experiment (assuming higher is better for most metrics)
                best_idx = metric_values.index(max(metric_values))
                metric_comparison['best_experiment'] = valid_experiments[best_idx]
                metric_comparison['best_value'] = metric_values[best_idx]
                
                # Statistical tests
                if statistical_tests and len(metric_values) > 2:
                    try:
                        # ANOVA test for multiple groups
                        f_stat, p_value = stats.f_oneway(*[metric_values[i:i+1] for i in range(len(metric_values))])
                        comparison_results['statistical_tests'][metric_name] = {
                            'test': 'ANOVA',
                            'f_statistic': f_stat,
                            'p_value': p_value,
                            'significant': p_value < 0.05
                        }
                    except Exception as e:
                        logger.warning(f"Statistical test failed for {metric_name}: {e}")
            
            comparison_results['metrics_comparison'][metric_name] = metric_comparison
        
        # Generate performance ranking
        if comparison_metrics:
            experiment_scores = defaultdict(list)
            for metric_name, metric_data in comparison_results['metrics_comparison'].items():
                if metric_data['values']:
                    # Rank experiments for this metric
                    sorted_experiments = sorted(metric_data['values'].items(), 
                                              key=lambda x: x[1], reverse=True)
                    for rank, (exp_id, value) in enumerate(sorted_experiments):
                        experiment_scores[exp_id].append(rank + 1)
            
            # Calculate average ranking
            for exp_id in experiment_scores:
                avg_rank = statistics.mean(experiment_scores[exp_id])
                comparison_results['performance_ranking'].append({
                    'experiment_id': exp_id,
                    'average_rank': avg_rank,
                    'experiment_name': self._active_experiments.get(exp_id, {}).get('name', 'Unknown')
                })
            
            # Sort by average rank
            comparison_results['performance_ranking'].sort(key=lambda x: x['average_rank'])
        
        # Generate insights
        insights = []
        if comparison_results['performance_ranking']:
            best_exp = comparison_results['performance_ranking'][0]
            insights.append(f"Experiment '{best_exp['experiment_name']}' ranked best overall")
        
        for metric_name, test_result in comparison_results['statistical_tests'].items():
            if test_result.get('significant'):
                insights.append(f"Statistically significant difference found in {metric_name} (p={test_result['p_value']:.4f})")
        
        comparison_results['insights'] = insights
        
        return comparison_results
    
    def get_experiment_insights(self, experiment_id: str) -> ExperimentInsights:
        """Generate automated insights for an experiment."""
        
        if experiment_id not in self._active_experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        experiment = self._active_experiments[experiment_id]
        metrics = self.get_experiment_metrics(experiment_id)
        
        # Performance summary
        performance_summary = {}
        for metric_name, metric_data in metrics.items():
            if isinstance(metric_data, list) and metric_data:
                latest_value = metric_data[-1]['value']
                performance_summary[metric_name] = latest_value
        
        # Best hyperparameters (from experiment config)
        best_hyperparameters = experiment.get('hyperparameters', {})
        
        # Feature importance ranking (placeholder - would need model-specific logic)
        feature_importance_ranking = []
        
        # Convergence analysis
        convergence_analysis = {}
        for metric_name, metric_data in metrics.items():
            if isinstance(metric_data, list) and len(metric_data) > 10:
                values = [entry['value'] for entry in metric_data[-50:]]  # Last 50 points
                convergence_analysis[metric_name] = {
                    'is_converged': self._check_convergence(values),
                    'trend': self._calculate_trend(values),
                    'stability': statistics.stdev(values[-10:]) if len(values) >= 10 else float('inf')
                }
        
        # Stability metrics
        stability_metrics = {}
        for metric_name, analysis in convergence_analysis.items():
            stability_metrics[f"{metric_name}_stability"] = analysis.get('stability', float('inf'))
        
        # Efficiency score (based on resource usage and performance)
        resource_data = self._get_resource_usage(experiment_id)
        efficiency_score = self._calculate_efficiency_score(performance_summary, resource_data)
        
        # Recommendations
        recommendations = self._generate_recommendations(
            experiment, performance_summary, convergence_analysis, resource_data
        )
        
        # Anomalies detection
        anomalies = self._detect_anomalies(metrics)
        
        return ExperimentInsights(
            performance_summary=performance_summary,
            best_hyperparameters=best_hyperparameters,
            feature_importance_ranking=feature_importance_ranking,
            convergence_analysis=convergence_analysis,
            stability_metrics=stability_metrics,
            efficiency_score=efficiency_score,
            recommendations=recommendations,
            anomalies=anomalies
        )
    
    def share_experiment(self, 
                        experiment_id: str,
                        user_id: str,
                        permission: SharePermission,
                        shared_by: str) -> bool:
        """Share an experiment with another user."""
        
        if experiment_id not in self._collaboration_info:
            logger.error(f"Experiment {experiment_id} not found")
            return False
        
        try:
            collaboration = self._collaboration_info[experiment_id]
            collaboration.shared_with[user_id] = permission
            
            # Add comment about sharing
            share_comment = {
                'id': str(uuid.uuid4()),
                'author': shared_by,
                'timestamp': datetime.utcnow().isoformat(),
                'content': f"Shared experiment with {user_id} ({permission.value} permission)",
                'type': 'system'
            }
            collaboration.comments.append(share_comment)
            
            # Save collaboration info
            self._save_collaboration_info(experiment_id, collaboration)
            
            logger.info(f"Shared experiment {experiment_id} with {user_id} ({permission.value})")
            return True
        
        except Exception as e:
            logger.error(f"Failed to share experiment {experiment_id}: {e}")
            return False
    
    def get_experiment_genealogy(self, experiment_id: str) -> Dict[str, Any]:
        """Get complete experiment genealogy and lineage."""
        
        if experiment_id not in self._experiment_lineage:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        lineage = self._experiment_lineage[experiment_id]
        
        genealogy = {
            'experiment_id': experiment_id,
            'lineage_depth': lineage.lineage_depth,
            'ancestors': [],
            'descendants': [],
            'siblings': [],
            'related': lineage.related_experiment_ids.copy()
        }
        
        # Get ancestors
        for parent_id in lineage.parent_experiment_ids:
            if parent_id in self._active_experiments:
                parent_info = {
                    'experiment_id': parent_id,
                    'name': self._active_experiments[parent_id].get('name', 'Unknown'),
                    'created_at': self._active_experiments[parent_id].get('created_at'),
                    'status': self._active_experiments[parent_id].get('status')
                }
                genealogy['ancestors'].append(parent_info)
        
        # Get descendants
        for child_id in lineage.child_experiment_ids:
            if child_id in self._active_experiments:
                child_info = {
                    'experiment_id': child_id,
                    'name': self._active_experiments[child_id].get('name', 'Unknown'),
                    'created_at': self._active_experiments[child_id].get('created_at'),
                    'status': self._active_experiments[child_id].get('status')
                }
                genealogy['descendants'].append(child_info)
        
        # Get siblings (experiments with same parents)
        siblings = set()
        for parent_id in lineage.parent_experiment_ids:
            if parent_id in self._experiment_lineage:
                parent_lineage = self._experiment_lineage[parent_id]
                siblings.update(parent_lineage.child_experiment_ids)
        
        siblings.discard(experiment_id)  # Remove self
        
        for sibling_id in siblings:
            if sibling_id in self._active_experiments:
                sibling_info = {
                    'experiment_id': sibling_id,
                    'name': self._active_experiments[sibling_id].get('name', 'Unknown'),
                    'created_at': self._active_experiments[sibling_id].get('created_at'),
                    'status': self._active_experiments[sibling_id].get('status')
                }
                genealogy['siblings'].append(sibling_info)
        
        return genealogy
    
    def get_experiment_metrics(self, experiment_id: str) -> Dict[str, Any]:
        """Get all metrics for an experiment."""
        
        # Check real-time metrics first
        real_time_data = self.get_real_time_metrics(experiment_id)
        
        # Load persisted metrics
        metrics_file = os.path.join(self.metrics_path, f"{experiment_id}.json")
        persisted_metrics = {}
        
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, 'r') as f:
                    persisted_metrics = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load persisted metrics for {experiment_id}: {e}")
        
        # Merge real-time and persisted metrics
        combined_metrics = {}
        
        # Add persisted metrics
        for metric_name, data in persisted_metrics.items():
            combined_metrics[metric_name] = data
        
        # Add/update with real-time metrics
        for metric_name, data in real_time_data.items():
            if metric_name in combined_metrics:
                # Merge with existing data
                existing_data = combined_metrics[metric_name]
                if isinstance(existing_data, list):
                    # Remove duplicates and sort by timestamp
                    all_data = existing_data + data
                    seen_steps = set()
                    unique_data = []
                    for entry in sorted(all_data, key=lambda x: x['timestamp']):
                        step_key = f"{entry['step']}_{entry['timestamp']}"
                        if step_key not in seen_steps:
                            unique_data.append(entry)
                            seen_steps.add(step_key)
                    combined_metrics[metric_name] = unique_data
                else:
                    combined_metrics[metric_name] = data
            else:
                combined_metrics[metric_name] = data
        
        return combined_metrics
    
    def _monitor_resources(self, experiment_id: str):
        """Monitor resource usage for an experiment in a separate thread."""
        import psutil
        import GPUtil
        
        resource_data = {
            'cpu_usage': [],
            'memory_usage': [],
            'gpu_usage': [],
            'gpu_memory_usage': [],
            'disk_io': [],
            'network_io': []
        }
        
        start_time = time.time()
        last_disk_io = psutil.disk_io_counters()
        last_network_io = psutil.net_io_counters()
        
        while (experiment_id in self._active_experiments and 
               self._active_experiments[experiment_id].get('status') == 'running'):
            
            try:
                # CPU and Memory
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                
                resource_data['cpu_usage'].append(cpu_percent)
                resource_data['memory_usage'].append(memory.used / (1024**3))  # GB
                
                # GPU metrics
                try:
                    gpus = GPUtil.getGPUs()
                    if gpus:
                        gpu_usage = sum(gpu.load * 100 for gpu in gpus) / len(gpus)
                        gpu_memory = sum(gpu.memoryUsed for gpu in gpus) / 1024  # GB
                        resource_data['gpu_usage'].append(gpu_usage)
                        resource_data['gpu_memory_usage'].append(gpu_memory)
                except:
                    resource_data['gpu_usage'].append(0)
                    resource_data['gpu_memory_usage'].append(0)
                
                # Disk and Network I/O
                current_disk_io = psutil.disk_io_counters()
                current_network_io = psutil.net_io_counters()
                
                if last_disk_io:
                    disk_read_mb_s = (current_disk_io.read_bytes - last_disk_io.read_bytes) / (1024*1024)
                    disk_write_mb_s = (current_disk_io.write_bytes - last_disk_io.write_bytes) / (1024*1024)
                    resource_data['disk_io'].append(disk_read_mb_s + disk_write_mb_s)
                
                if last_network_io:
                    net_recv_mb_s = (current_network_io.bytes_recv - last_network_io.bytes_recv) / (1024*1024)
                    net_sent_mb_s = (current_network_io.bytes_sent - last_network_io.bytes_sent) / (1024*1024)
                    resource_data['network_io'].append(net_recv_mb_s + net_sent_mb_s)
                
                last_disk_io = current_disk_io
                last_network_io = current_network_io
                
                # Sleep for monitoring interval
                time.sleep(5)  # Monitor every 5 seconds
                
            except Exception as e:
                logger.warning(f"Resource monitoring error for experiment {experiment_id}: {e}")
                break
        
        # Save final resource data
        total_time = time.time() - start_time
        resource_usage = ResourceUsage(
            cpu_usage_percent=resource_data['cpu_usage'],
            memory_usage_gb=resource_data['memory_usage'],
            gpu_usage_percent=resource_data['gpu_usage'],
            gpu_memory_usage_gb=resource_data['gpu_memory_usage'],
            disk_io_mb_s=resource_data['disk_io'],
            network_io_mb_s=resource_data['network_io'],
            training_time_seconds=total_time
        )
        
        # Store resource usage
        self._active_experiments[experiment_id]['resource_usage'] = asdict(resource_usage)
        
        logger.info(f"Resource monitoring completed for experiment {experiment_id}")
    
    def _calculate_lineage_depth(self, parent_ids: List[str]) -> int:
        """Calculate the lineage depth of an experiment."""
        if not parent_ids:
            return 0
        
        max_depth = 0
        for parent_id in parent_ids:
            if parent_id in self._experiment_lineage:
                parent_depth = self._experiment_lineage[parent_id].lineage_depth
                max_depth = max(max_depth, parent_depth + 1)
        
        return max_depth
    
    def _check_convergence(self, values: List[float], window_size: int = 10, tolerance: float = 0.01) -> bool:
        """Check if metric values have converged."""
        if len(values) < window_size * 2:
            return False
        
        recent_values = values[-window_size:]
        previous_values = values[-window_size*2:-window_size]
        
        recent_mean = statistics.mean(recent_values)
        previous_mean = statistics.mean(previous_values)
        
        if previous_mean == 0:
            return abs(recent_mean) < tolerance
        
        relative_change = abs(recent_mean - previous_mean) / abs(previous_mean)
        return relative_change < tolerance
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate the trend of metric values."""
        if len(values) < 2:
            return "insufficient_data"
        
        # Simple linear regression slope
        n = len(values)
        x = list(range(n))
        
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(x[i] ** 2 for i in range(n))
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
        
        if abs(slope) < 0.001:
            return "stable"
        elif slope > 0:
            return "improving"
        else:
            return "declining"
    
    def _get_resource_usage(self, experiment_id: str) -> ResourceUsage:
        """Get resource usage data for an experiment."""
        experiment = self._active_experiments.get(experiment_id, {})
        resource_data = experiment.get('resource_usage', {})
        
        if resource_data:
            return ResourceUsage(**resource_data)
        
        # Return empty resource usage
        return ResourceUsage(
            cpu_usage_percent=[],
            memory_usage_gb=[],
            gpu_usage_percent=[],
            gpu_memory_usage_gb=[],
            disk_io_mb_s=[],
            network_io_mb_s=[],
            training_time_seconds=0.0
        )
    
    def _calculate_efficiency_score(self, 
                                   performance_summary: Dict[str, float],
                                   resource_usage: ResourceUsage) -> float:
        """Calculate efficiency score based on performance and resource usage."""
        
        if not performance_summary or resource_usage.training_time_seconds == 0:
            return 0.0
        
        # Normalize performance (assuming higher is better)
        performance_score = statistics.mean(performance_summary.values()) if performance_summary else 0.5
        
        # Normalize resource efficiency (lower usage is better)
        avg_cpu = resource_usage.avg_cpu_usage / 100.0 if resource_usage.avg_cpu_usage else 0.5
        peak_memory = min(resource_usage.peak_memory_usage / 8.0, 1.0) if resource_usage.peak_memory_usage else 0.5
        time_factor = min(resource_usage.training_time_seconds / 3600.0, 1.0) if resource_usage.training_time_seconds else 0.5
        
        resource_efficiency = 1.0 - statistics.mean([avg_cpu, peak_memory, time_factor])
        
        # Combine performance and efficiency (weighted average)
        efficiency_score = (performance_score * 0.7) + (resource_efficiency * 0.3)
        
        return max(0.0, min(1.0, efficiency_score))
    
    def _generate_recommendations(self,
                                experiment_config: Dict[str, Any],
                                performance_summary: Dict[str, float],
                                convergence_analysis: Dict[str, Any],
                                resource_usage: ResourceUsage) -> List[str]:
        """Generate automated recommendations for experiment improvement."""
        
        recommendations = []
        
        # Performance-based recommendations
        if performance_summary:
            avg_performance = statistics.mean(performance_summary.values())
            if avg_performance < 0.7:  # Assuming scores are normalized 0-1
                recommendations.append("Consider tuning hyperparameters to improve model performance")
                recommendations.append("Experiment with different model architectures")
        
        # Convergence-based recommendations
        for metric_name, analysis in convergence_analysis.items():
            if not analysis.get('is_converged'):
                recommendations.append(f"Increase training epochs for {metric_name} convergence")
            
            if analysis.get('trend') == 'declining':
                recommendations.append(f"Consider early stopping or learning rate adjustment for {metric_name}")
        
        # Resource efficiency recommendations
        if resource_usage.avg_cpu_usage < 50:
            recommendations.append("CPU utilization is low - consider increasing batch size or parallel workers")
        
        if resource_usage.peak_memory_usage < 2.0:  # Less than 2GB
            recommendations.append("Memory usage is low - consider larger model or batch size")
        
        if resource_usage.avg_gpu_usage < 50 and resource_usage.avg_gpu_usage > 0:
            recommendations.append("GPU utilization is low - optimize data loading or model complexity")
        
        if not recommendations:
            recommendations.append("Experiment appears well-optimized - consider exploring different approaches")
        
        return recommendations
    
    def _detect_anomalies(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect anomalies in experiment metrics."""
        
        anomalies = []
        
        for metric_name, metric_data in metrics.items():
            if not isinstance(metric_data, list) or len(metric_data) < 10:
                continue
            
            values = [entry['value'] for entry in metric_data]
            
            # Statistical outlier detection using Z-score
            mean_val = statistics.mean(values)
            std_val = statistics.stdev(values) if len(values) > 1 else 0
            
            if std_val > 0:
                for i, entry in enumerate(metric_data):
                    z_score = abs((entry['value'] - mean_val) / std_val)
                    if z_score > 3:  # 3-sigma rule
                        anomalies.append({
                            'type': 'statistical_outlier',
                            'metric_name': metric_name,
                            'step': entry['step'],
                            'timestamp': entry['timestamp'],
                            'value': entry['value'],
                            'z_score': z_score,
                            'description': f"Unusual {metric_name} value detected (Z-score: {z_score:.2f})"
                        })
        
        return anomalies
    
    def _flush_metrics_to_disk(self, experiment_id: str):
        """Flush real-time metrics to disk."""
        
        try:
            metrics_file = os.path.join(self.metrics_path, f"{experiment_id}.json")
            
            # Get current persisted metrics
            persisted_metrics = {}
            if os.path.exists(metrics_file):
                with open(metrics_file, 'r') as f:
                    persisted_metrics = json.load(f)
            
            # Add real-time metrics
            real_time_data = self.get_real_time_metrics(experiment_id)
            
            for metric_name, data in real_time_data.items():
                if metric_name in persisted_metrics:
                    if isinstance(persisted_metrics[metric_name], list):
                        persisted_metrics[metric_name].extend(data)
                    else:
                        persisted_metrics[metric_name] = data
                else:
                    persisted_metrics[metric_name] = data
            
            # Save updated metrics
            with open(metrics_file, 'w') as f:
                json.dump(persisted_metrics, f, indent=2, default=str)
            
            # Clear real-time buffer
            self._real_time_metrics[experiment_id].clear()
            
        except Exception as e:
            logger.error(f"Failed to flush metrics for experiment {experiment_id}: {e}")
    
    def _save_experiment_config(self, experiment_id: str, config: Dict[str, Any]):
        """Save experiment configuration to disk."""
        config_file = os.path.join(self.experiments_path, f"{experiment_id}_config.json")
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2, default=str)
    
    def _save_experiment_lineage(self, experiment_id: str, lineage: ExperimentLineage):
        """Save experiment lineage to disk."""
        lineage_file = os.path.join(self.lineage_path, f"{experiment_id}.json")
        with open(lineage_file, 'w') as f:
            json.dump(asdict(lineage), f, indent=2, default=str)
    
    def _save_collaboration_info(self, experiment_id: str, collaboration: CollaborationInfo):
        """Save collaboration information to disk."""
        collab_file = os.path.join(self.storage_path, f"collaboration_{experiment_id}.json")
        with open(collab_file, 'w') as f:
            json.dump(asdict(collaboration), f, indent=2, default=str)
    
    def complete_experiment(self, experiment_id: str, final_results: Dict[str, Any] = None) -> bool:
        """Complete an experiment and perform final analysis."""
        
        if experiment_id not in self._active_experiments:
            logger.error(f"Experiment {experiment_id} not found")
            return False
        
        try:
            # Update experiment status
            self._active_experiments[experiment_id]['status'] = ExperimentStatus.COMPLETED.value if ExperimentStatus else 'completed'
            self._active_experiments[experiment_id]['completed_at'] = datetime.utcnow().isoformat()
            
            # Add final results
            if final_results:
                self._active_experiments[experiment_id]['final_results'] = final_results
            
            # Stop resource monitoring
            if experiment_id in self._resource_monitors:
                # Monitor thread will stop automatically when status changes
                pass
            
            # Flush remaining metrics
            self._flush_metrics_to_disk(experiment_id)
            
            # Generate final insights
            insights = self.get_experiment_insights(experiment_id)
            insights_file = os.path.join(self.insights_path, f"{experiment_id}.json")
            with open(insights_file, 'w') as f:
                json.dump(asdict(insights), f, indent=2, default=str)
            
            # Save final experiment config
            self._save_experiment_config(experiment_id, self._active_experiments[experiment_id])
            
            logger.info(f"Completed experiment {experiment_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to complete experiment {experiment_id}: {e}")
            return False
    
    def get_platform_analytics(self) -> Dict[str, Any]:
        """Get comprehensive platform analytics."""
        
        total_experiments = len(self._active_experiments)
        active_experiments = len([exp for exp in self._active_experiments.values() 
                                 if exp.get('status') == 'running'])
        
        # Experiment type distribution
        experiment_types = defaultdict(int)
        for exp in self._active_experiments.values():
            exp_type = exp.get('experiment_type', 'unknown')
            experiment_types[exp_type] += 1
        
        # Framework usage
        framework_usage = defaultdict(int)
        for exp in self._active_experiments.values():
            model_configs = exp.get('model_configs', [])
            for config in model_configs:
                framework = config.get('framework', 'unknown')
                framework_usage[framework] += 1
        
        # Performance trends (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_experiments = []
        
        for exp in self._active_experiments.values():
            created_at = datetime.fromisoformat(exp.get('created_at', '1970-01-01'))
            if created_at >= thirty_days_ago:
                recent_experiments.append(exp)
        
        # Resource utilization statistics
        total_cpu_hours = 0
        total_memory_gb_hours = 0
        total_training_time = 0
        
        for exp in self._active_experiments.values():
            resource_usage = exp.get('resource_usage', {})
            if resource_usage:
                training_time_hours = resource_usage.get('training_time_seconds', 0) / 3600
                avg_cpu = statistics.mean(resource_usage.get('cpu_usage_percent', [0]))
                avg_memory = statistics.mean(resource_usage.get('memory_usage_gb', [0]))
                
                total_cpu_hours += (avg_cpu / 100) * training_time_hours
                total_memory_gb_hours += avg_memory * training_time_hours
                total_training_time += training_time_hours
        
        analytics = {
            'platform_summary': {
                'total_experiments': total_experiments,
                'active_experiments': active_experiments,
                'completed_experiments': total_experiments - active_experiments,
                'total_metrics_logged': sum(self._metric_update_counts.values()),
                'custom_metrics_defined': len(self._metric_definitions)
            },
            'experiment_distribution': {
                'by_type': dict(experiment_types),
                'by_framework': dict(framework_usage),
                'recent_experiments_30d': len(recent_experiments)
            },
            'resource_utilization': {
                'total_cpu_hours': round(total_cpu_hours, 2),
                'total_memory_gb_hours': round(total_memory_gb_hours, 2),
                'total_training_time_hours': round(total_training_time, 2),
                'avg_experiment_duration_hours': round(total_training_time / max(total_experiments, 1), 2)
            },
            'collaboration_stats': {
                'shared_experiments': len([c for c in self._collaboration_info.values() 
                                         if len(c.shared_with) > 1]),
                'public_experiments': len([c for c in self._collaboration_info.values() if c.public]),
                'total_comments': sum(len(c.comments) for c in self._collaboration_info.values())
            },
            'lineage_stats': {
                'experiments_with_parents': len([l for l in self._experiment_lineage.values() 
                                               if l.parent_experiment_ids]),
                'max_lineage_depth': max([l.lineage_depth for l in self._experiment_lineage.values()], default=0),
                'total_lineage_connections': sum(len(l.child_experiment_ids) + len(l.parent_experiment_ids) 
                                               for l in self._experiment_lineage.values())
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return analytics