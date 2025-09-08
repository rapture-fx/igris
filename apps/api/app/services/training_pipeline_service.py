"""
MLOps Training Pipeline Service
===============================

Advanced training pipeline service providing automated ML model training,
hyperparameter optimization, distributed training support, and comprehensive
experiment tracking for AI companies.

Features:
- Automated training pipeline orchestration
- Advanced hyperparameter optimization (Grid, Random, Bayesian)
- Distributed training support across multiple frameworks
- Real-time training monitoring and management  
- Integration with experiment tracking and model registry
- Resource management and cost optimization
- Pipeline versioning and reproducibility
"""

import os
import json
import asyncio
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Callable, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing as mp
from pathlib import Path

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_validate, ParameterGrid, ParameterSampler
from sklearn.metrics import make_scorer
import joblib

# Import MLOps components
from app.ml.mlops_platform import (
    MLOpsExperimentTracker, ExperimentConfig, ExperimentStatus,
    ModelFramework, create_mlops_platform
)

# Import existing ML capabilities
try:
    from app.ml.advanced_modeling_engine import AdvancedMLModelingEngine
    from app.ml.feature_engineering import AdvancedFeatureEngineer
    from app.ml.data_quality import AdvancedDataQualityAnalyzer
    from app.services.model_registry import ModelRegistryService
except ImportError as e:
    logging.warning(f"Some imports not available: {e}")

# Optional imports for advanced optimization
try:
    from skopt import gp_minimize, gbrt_minimize
    from skopt.space import Real, Integer, Categorical
    from skopt.utils import use_named_args
    BAYESIAN_OPT_AVAILABLE = True
except ImportError:
    BAYESIAN_OPT_AVAILABLE = False

try:
    import ray
    RAY_AVAILABLE = True
except ImportError:
    RAY_AVAILABLE = False

logger = logging.getLogger(__name__)


class TrainingStatus(str, Enum):
    """Training pipeline status."""
    QUEUED = "queued"
    PREPARING = "preparing"
    TRAINING = "training"
    OPTIMIZING = "optimizing"
    EVALUATING = "evaluating"
    COMPLETING = "completing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OptimizationMethod(str, Enum):
    """Hyperparameter optimization methods."""
    GRID_SEARCH = "grid_search"
    RANDOM_SEARCH = "random_search"
    BAYESIAN_OPTIMIZATION = "bayesian_optimization"
    EVOLUTIONARY = "evolutionary"
    OPTUNA = "optuna"


@dataclass
class TrainingJobConfig:
    """Configuration for training jobs."""
    job_id: str
    experiment_id: str
    name: str
    description: str
    
    # Data configuration
    data_config: Dict[str, Any]
    target_column: str
    feature_columns: List[str]
    
    # Model configuration
    model_configs: List[Dict[str, Any]]
    
    # Training configuration
    train_test_split_config: Dict[str, Any]
    validation_config: Dict[str, Any]
    
    # Optimization configuration
    optimization_method: OptimizationMethod
    optimization_budget: int
    max_training_time_hours: float
    early_stopping_config: Dict[str, Any]
    
    # Resource configuration
    max_parallel_jobs: int
    memory_limit_gb: float
    gpu_enabled: bool
    distributed_training: bool
    
    # Output configuration
    save_intermediate_models: bool
    model_registry_config: Dict[str, Any]
    
    # Metadata
    created_by: str
    created_at: datetime
    priority: int = 1  # 1-10 priority scale
    
    status: TrainingStatus = TrainingStatus.QUEUED
    progress: float = 0.0
    current_step: str = ""
    error_message: Optional[str] = None


@dataclass 
class TrainingResult:
    """Training result data."""
    job_id: str
    experiment_id: str
    status: TrainingStatus
    
    # Results
    best_model_id: Optional[str] = None
    best_score: Optional[float] = None
    best_parameters: Optional[Dict[str, Any]] = None
    
    # Training metrics
    total_models_trained: int = 0
    successful_models: int = 0
    failed_models: int = 0
    
    # Performance metrics
    cross_validation_scores: Dict[str, List[float]] = None
    evaluation_metrics: Dict[str, float] = None
    
    # Resource usage
    training_time_hours: float = 0.0
    peak_memory_usage_gb: float = 0.0
    cpu_hours_used: float = 0.0
    
    # Model comparison
    model_comparison: List[Dict[str, Any]] = None
    
    # Metadata
    completed_at: Optional[datetime] = None
    error_details: Optional[Dict[str, Any]] = None


class HyperparameterOptimizer:
    """Advanced hyperparameter optimization engine."""
    
    def __init__(self):
        self.optimization_history: Dict[str, List[Dict[str, Any]]] = {}
    
    def optimize_parameters(self,
                          model_builder: Callable,
                          param_space: Dict[str, Any],
                          X_train: np.ndarray,
                          y_train: np.ndarray,
                          X_val: np.ndarray,
                          y_val: np.ndarray,
                          method: OptimizationMethod,
                          budget: int,
                          cv_folds: int = 5,
                          scoring: str = 'accuracy',
                          job_id: str = None) -> Dict[str, Any]:
        """Optimize hyperparameters using specified method."""
        
        logger.info(f"Starting hyperparameter optimization using {method.value}")
        
        if method == OptimizationMethod.GRID_SEARCH:
            return self._grid_search_optimization(
                model_builder, param_space, X_train, y_train, X_val, y_val, cv_folds, scoring
            )
        elif method == OptimizationMethod.RANDOM_SEARCH:
            return self._random_search_optimization(
                model_builder, param_space, X_train, y_train, X_val, y_val, budget, cv_folds, scoring
            )
        elif method == OptimizationMethod.BAYESIAN_OPTIMIZATION:
            return self._bayesian_optimization(
                model_builder, param_space, X_train, y_train, X_val, y_val, budget, cv_folds, scoring
            )
        else:
            raise ValueError(f"Optimization method {method} not implemented")
    
    def _grid_search_optimization(self, model_builder, param_space, X_train, y_train, X_val, y_val, cv_folds, scoring):
        """Grid search optimization."""
        from sklearn.model_selection import GridSearchCV
        
        param_grid = self._convert_param_space_to_grid(param_space)
        
        # Create base model
        base_model = model_builder({})
        
        # Create GridSearchCV
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=cv_folds,
            scoring=scoring,
            n_jobs=-1,
            return_train_score=True
        )
        
        # Fit grid search
        grid_search.fit(X_train, y_train)
        
        # Evaluate on validation set
        best_model = grid_search.best_estimator_
        val_score = best_model.score(X_val, y_val)
        
        return {
            'best_params': grid_search.best_params_,
            'best_cv_score': grid_search.best_score_,
            'best_val_score': val_score,
            'best_model': best_model,
            'cv_results': grid_search.cv_results_,
            'total_fits': len(grid_search.cv_results_['mean_test_score'])
        }
    
    def _random_search_optimization(self, model_builder, param_space, X_train, y_train, X_val, y_val, budget, cv_folds, scoring):
        """Random search optimization."""
        from sklearn.model_selection import RandomizedSearchCV
        
        param_distributions = self._convert_param_space_to_distributions(param_space)
        
        # Create base model
        base_model = model_builder({})
        
        # Create RandomizedSearchCV
        random_search = RandomizedSearchCV(
            base_model,
            param_distributions,
            n_iter=budget,
            cv=cv_folds,
            scoring=scoring,
            n_jobs=-1,
            return_train_score=True,
            random_state=42
        )
        
        # Fit random search
        random_search.fit(X_train, y_train)
        
        # Evaluate on validation set
        best_model = random_search.best_estimator_
        val_score = best_model.score(X_val, y_val)
        
        return {
            'best_params': random_search.best_params_,
            'best_cv_score': random_search.best_score_,
            'best_val_score': val_score,
            'best_model': best_model,
            'cv_results': random_search.cv_results_,
            'total_fits': budget
        }
    
    def _bayesian_optimization(self, model_builder, param_space, X_train, y_train, X_val, y_val, budget, cv_folds, scoring):
        """Bayesian optimization using scikit-optimize."""
        if not BAYESIAN_OPT_AVAILABLE:
            logger.warning("Bayesian optimization not available, falling back to random search")
            return self._random_search_optimization(
                model_builder, param_space, X_train, y_train, X_val, y_val, budget, cv_folds, scoring
            )
        
        # Convert parameter space to skopt format
        search_space, param_names = self._convert_param_space_to_skopt(param_space)
        
        # Create objective function
        @use_named_args(search_space)
        def objective(**params):
            try:
                # Build model with current parameters
                model = model_builder(params)
                
                # Perform cross-validation
                cv_scores = cross_validate(model, X_train, y_train, cv=cv_folds, scoring=scoring)
                
                # Return negative score for minimization
                return -np.mean(cv_scores['test_score'])
            
            except Exception as e:
                logger.warning(f"Error in objective function: {e}")
                return float('inf')
        
        # Run Bayesian optimization
        result = gp_minimize(
            func=objective,
            dimensions=search_space,
            n_calls=budget,
            random_state=42,
            acq_func='EI'
        )
        
        # Get best parameters
        best_params = dict(zip(param_names, result.x))
        
        # Train final model with best parameters
        best_model = model_builder(best_params)
        best_model.fit(X_train, y_train)
        
        # Evaluate
        val_score = best_model.score(X_val, y_val)
        
        return {
            'best_params': best_params,
            'best_cv_score': -result.fun,
            'best_val_score': val_score,
            'best_model': best_model,
            'optimization_result': result,
            'total_fits': budget
        }
    
    def _convert_param_space_to_grid(self, param_space: Dict[str, Any]) -> Dict[str, List]:
        """Convert parameter space to grid format."""
        grid = {}
        for param, config in param_space.items():
            if isinstance(config, list):
                grid[param] = config
            elif isinstance(config, dict):
                if config['type'] == 'int':
                    grid[param] = list(range(config['min'], config['max'] + 1, config.get('step', 1)))
                elif config['type'] == 'float':
                    # Create linear space for float parameters
                    num_points = config.get('num_points', 10)
                    grid[param] = np.linspace(config['min'], config['max'], num_points).tolist()
                elif config['type'] == 'categorical':
                    grid[param] = config['values']
        return grid
    
    def _convert_param_space_to_distributions(self, param_space: Dict[str, Any]) -> Dict[str, Any]:
        """Convert parameter space to distribution format for random search."""
        from scipy.stats import uniform, randint
        
        distributions = {}
        for param, config in param_space.items():
            if isinstance(config, list):
                distributions[param] = config
            elif isinstance(config, dict):
                if config['type'] == 'int':
                    distributions[param] = randint(config['min'], config['max'] + 1)
                elif config['type'] == 'float':
                    distributions[param] = uniform(config['min'], config['max'] - config['min'])
                elif config['type'] == 'categorical':
                    distributions[param] = config['values']
        return distributions
    
    def _convert_param_space_to_skopt(self, param_space: Dict[str, Any]) -> Tuple[List, List[str]]:
        """Convert parameter space to scikit-optimize format."""
        search_space = []
        param_names = []
        
        for param, config in param_space.items():
            param_names.append(param)
            
            if isinstance(config, list):
                search_space.append(Categorical(config, name=param))
            elif isinstance(config, dict):
                if config['type'] == 'int':
                    search_space.append(Integer(config['min'], config['max'], name=param))
                elif config['type'] == 'float':
                    search_space.append(Real(config['min'], config['max'], name=param))
                elif config['type'] == 'categorical':
                    search_space.append(Categorical(config['values'], name=param))
        
        return search_space, param_names


class ResourceManager:
    """Manage training resources and constraints."""
    
    def __init__(self):
        self.cpu_count = mp.cpu_count()
        self.available_memory_gb = self._get_available_memory()
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
    
    def _get_available_memory(self) -> float:
        """Get available system memory in GB."""
        try:
            import psutil
            return psutil.virtual_memory().available / (1024**3)
        except ImportError:
            logger.warning("psutil not available, estimating memory")
            return 8.0  # Default estimate
    
    def can_allocate_resources(self, memory_gb: float, cpu_cores: int) -> bool:
        """Check if resources can be allocated."""
        # Calculate current resource usage
        total_memory_used = sum(job['memory_gb'] for job in self.active_jobs.values())
        total_cpu_used = sum(job['cpu_cores'] for job in self.active_jobs.values())
        
        # Check availability
        memory_available = self.available_memory_gb - total_memory_used
        cpu_available = self.cpu_count - total_cpu_used
        
        return memory_gb <= memory_available and cpu_cores <= cpu_available
    
    def allocate_resources(self, job_id: str, memory_gb: float, cpu_cores: int):
        """Allocate resources for a job."""
        if not self.can_allocate_resources(memory_gb, cpu_cores):
            raise ValueError(f"Cannot allocate {memory_gb}GB memory and {cpu_cores} CPU cores")
        
        self.active_jobs[job_id] = {
            'memory_gb': memory_gb,
            'cpu_cores': cpu_cores,
            'allocated_at': datetime.utcnow()
        }
        
        logger.info(f"Allocated {memory_gb}GB memory and {cpu_cores} CPU cores for job {job_id}")
    
    def release_resources(self, job_id: str):
        """Release resources for a job."""
        if job_id in self.active_jobs:
            job_resources = self.active_jobs[job_id]
            logger.info(f"Released {job_resources['memory_gb']}GB memory and {job_resources['cpu_cores']} CPU cores for job {job_id}")
            del self.active_jobs[job_id]
    
    def get_resource_utilization(self) -> Dict[str, Any]:
        """Get current resource utilization."""
        total_memory_used = sum(job['memory_gb'] for job in self.active_jobs.values())
        total_cpu_used = sum(job['cpu_cores'] for job in self.active_jobs.values())
        
        return {
            'memory': {
                'total_gb': self.available_memory_gb,
                'used_gb': total_memory_used,
                'available_gb': self.available_memory_gb - total_memory_used,
                'utilization_pct': (total_memory_used / self.available_memory_gb) * 100
            },
            'cpu': {
                'total_cores': self.cpu_count,
                'used_cores': total_cpu_used,
                'available_cores': self.cpu_count - total_cpu_used,
                'utilization_pct': (total_cpu_used / self.cpu_count) * 100
            },
            'active_jobs': len(self.active_jobs)
        }


class TrainingPipelineService:
    """Advanced training pipeline service with comprehensive ML lifecycle management."""
    
    def __init__(self, 
                 storage_path: str = "./mlops_storage",
                 model_registry_service: ModelRegistryService = None):
        self.storage_path = storage_path
        self.jobs_path = os.path.join(storage_path, "training_jobs")
        os.makedirs(self.jobs_path, exist_ok=True)
        
        # Initialize components
        self.experiment_tracker = MLOpsExperimentTracker(storage_path)
        self.model_registry = model_registry_service or ModelRegistryService(storage_path)
        self.optimizer = HyperparameterOptimizer()
        self.resource_manager = ResourceManager()
        
        # Initialize ML engines
        self.ml_engine = None
        self.feature_engineer = None
        self.data_quality_analyzer = None
        
        if AdvancedMLModelingEngine:
            self.ml_engine = AdvancedMLModelingEngine()
        if AdvancedFeatureEngineer:
            self.feature_engineer = AdvancedFeatureEngineer()
        if AdvancedDataQualityAnalyzer:
            self.data_quality_analyzer = AdvancedDataQualityAnalyzer()
        
        # Job management
        self._active_jobs: Dict[str, TrainingJobConfig] = {}
        self._job_results: Dict[str, TrainingResult] = {}
        self._job_tasks: Dict[str, asyncio.Task] = {}
        
        # Job queue management
        self._job_queue: List[str] = []
        self._queue_processor_task: Optional[asyncio.Task] = None
        
        # Load existing jobs
        self._load_existing_jobs()
        
        logger.info(f"Training Pipeline Service initialized with storage at {storage_path}")
    
    def _load_existing_jobs(self):
        """Load existing jobs from storage."""
        try:
            for job_file in os.listdir(self.jobs_path):
                if job_file.endswith('_config.json'):
                    job_id = job_file.replace('_config.json', '')
                    
                    # Load job config
                    with open(os.path.join(self.jobs_path, job_file), 'r') as f:
                        job_dict = json.load(f)
                        job_dict['created_at'] = datetime.fromisoformat(job_dict['created_at'])
                        job_config = TrainingJobConfig(**job_dict)
                        self._active_jobs[job_id] = job_config
                    
                    # Load job results if available
                    result_file = os.path.join(self.jobs_path, f"{job_id}_result.json")
                    if os.path.exists(result_file):
                        with open(result_file, 'r') as f:
                            result_dict = json.load(f)
                            if result_dict.get('completed_at'):
                                result_dict['completed_at'] = datetime.fromisoformat(result_dict['completed_at'])
                            result = TrainingResult(**result_dict)
                            self._job_results[job_id] = result
            
            logger.info(f"Loaded {len(self._active_jobs)} training jobs")
        except Exception as e:
            logger.warning(f"Could not load existing jobs: {e}")
    
    async def create_training_job(self,
                                 name: str,
                                 description: str,
                                 data_config: Dict[str, Any],
                                 target_column: str,
                                 model_configs: List[Dict[str, Any]],
                                 created_by: str = "system",
                                 feature_columns: List[str] = None,
                                 optimization_method: OptimizationMethod = OptimizationMethod.RANDOM_SEARCH,
                                 optimization_budget: int = 50,
                                 max_training_time_hours: float = 2.0,
                                 max_parallel_jobs: int = None,
                                 memory_limit_gb: float = 4.0,
                                 gpu_enabled: bool = False,
                                 distributed_training: bool = False,
                                 priority: int = 1,
                                 **kwargs) -> str:
        """Create new training job."""
        
        job_id = str(uuid.uuid4())
        
        # Set default parallel jobs
        if max_parallel_jobs is None:
            max_parallel_jobs = min(4, len(model_configs))
        
        # Create job configuration
        job_config = TrainingJobConfig(
            job_id=job_id,
            experiment_id=kwargs.get('experiment_id', str(uuid.uuid4())),
            name=name,
            description=description,
            data_config=data_config,
            target_column=target_column,
            feature_columns=feature_columns or [],
            model_configs=model_configs,
            train_test_split_config=kwargs.get('train_test_split_config', {'test_size': 0.2, 'random_state': 42}),
            validation_config=kwargs.get('validation_config', {'cv': 5}),
            optimization_method=optimization_method,
            optimization_budget=optimization_budget,
            max_training_time_hours=max_training_time_hours,
            early_stopping_config=kwargs.get('early_stopping_config', {'patience': 10}),
            max_parallel_jobs=max_parallel_jobs,
            memory_limit_gb=memory_limit_gb,
            gpu_enabled=gpu_enabled,
            distributed_training=distributed_training,
            save_intermediate_models=kwargs.get('save_intermediate_models', True),
            model_registry_config=kwargs.get('model_registry_config', {}),
            created_by=created_by,
            created_at=datetime.utcnow(),
            priority=priority
        )
        
        # Save job configuration
        self._save_job_config(job_config)
        self._active_jobs[job_id] = job_config
        
        # Add to queue
        self._job_queue.append(job_id)
        self._job_queue.sort(key=lambda jid: self._active_jobs[jid].priority, reverse=True)
        
        # Start queue processor if not running
        if self._queue_processor_task is None or self._queue_processor_task.done():
            self._queue_processor_task = asyncio.create_task(self._process_job_queue())
        
        logger.info(f"Created training job {name} with ID {job_id}")
        return job_id
    
    async def _process_job_queue(self):
        """Process job queue with resource management."""
        logger.info("Started job queue processor")
        
        try:
            while True:
                if not self._job_queue:
                    await asyncio.sleep(5)  # Wait for new jobs
                    continue
                
                # Get next job
                job_id = self._job_queue[0]
                job_config = self._active_jobs[job_id]
                
                # Check if resources are available
                required_memory = job_config.memory_limit_gb
                required_cpu = min(job_config.max_parallel_jobs, self.resource_manager.cpu_count)
                
                if self.resource_manager.can_allocate_resources(required_memory, required_cpu):
                    # Remove from queue and start job
                    self._job_queue.pop(0)
                    
                    # Start job execution
                    task = asyncio.create_task(self._execute_training_job(job_id))
                    self._job_tasks[job_id] = task
                    
                    logger.info(f"Started execution of job {job_id}")
                else:
                    # Wait for resources to become available
                    logger.info(f"Job {job_id} waiting for resources (need {required_memory}GB, {required_cpu} cores)")
                    await asyncio.sleep(10)
        
        except asyncio.CancelledError:
            logger.info("Job queue processor cancelled")
        except Exception as e:
            logger.error(f"Error in job queue processor: {e}")
    
    async def _execute_training_job(self, job_id: str) -> TrainingResult:
        """Execute training job."""
        job_config = self._active_jobs[job_id]
        
        # Initialize result
        result = TrainingResult(
            job_id=job_id,
            experiment_id=job_config.experiment_id,
            status=TrainingStatus.PREPARING
        )
        
        start_time = datetime.utcnow()
        
        try:
            # Allocate resources
            required_memory = job_config.memory_limit_gb
            required_cpu = min(job_config.max_parallel_jobs, self.resource_manager.cpu_count)
            self.resource_manager.allocate_resources(job_id, required_memory, required_cpu)
            
            # Update job status
            job_config.status = TrainingStatus.PREPARING
            job_config.current_step = "Loading data"
            job_config.progress = 5.0
            
            # Load and prepare data
            logger.info(f"Loading data for job {job_id}")
            data = await self._load_training_data(job_config.data_config)
            
            # Data quality analysis
            if self.data_quality_analyzer:
                logger.info(f"Analyzing data quality for job {job_id}")
                quality_report = self.data_quality_analyzer.analyze_data(data)
                logger.info(f"Data quality score: {quality_report.get('overall_score', 'N/A')}")
            
            # Feature engineering
            if self.feature_engineer and job_config.feature_columns:
                logger.info(f"Engineering features for job {job_id}")
                engineered_result = self.feature_engineer.engineer_features(
                    data,
                    target_column=job_config.target_column,
                    feature_selection_methods=['correlation', 'mutual_info']
                )
                data = engineered_result['data']
                job_config.feature_columns = engineered_result.get('selected_features', job_config.feature_columns)
            
            # Prepare training data
            X = data.drop(columns=[job_config.target_column])
            y = data[job_config.target_column]
            
            # Train-test split
            split_config = job_config.train_test_split_config
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, 
                test_size=split_config.get('test_size', 0.2),
                random_state=split_config.get('random_state', 42),
                stratify=y if len(np.unique(y)) < 10 else None
            )
            
            # Additional validation split for hyperparameter optimization
            X_train, X_val, y_train, y_val = train_test_split(
                X_train, y_train,
                test_size=0.2,
                random_state=42,
                stratify=y_train if len(np.unique(y_train)) < 10 else None
            )
            
            job_config.status = TrainingStatus.TRAINING
            job_config.current_step = "Training models"
            job_config.progress = 20.0
            
            # Train models
            model_results = await self._train_models_parallel(
                job_config, X_train, y_train, X_val, y_val, X_test, y_test
            )
            
            # Update results
            result.total_models_trained = len(model_results)
            result.successful_models = len([r for r in model_results if r.get('status') == 'success'])
            result.failed_models = result.total_models_trained - result.successful_models
            result.model_comparison = model_results
            
            # Find best model
            if result.successful_models > 0:
                successful_models = [r for r in model_results if r.get('status') == 'success']
                best_result = max(successful_models, key=lambda x: x.get('val_score', -float('inf')))
                
                result.best_model_id = best_result.get('model_id')
                result.best_score = best_result.get('val_score')
                result.best_parameters = best_result.get('best_params', {})
                result.evaluation_metrics = best_result.get('test_metrics', {})
            
            # Complete job
            job_config.status = TrainingStatus.COMPLETED
            job_config.progress = 100.0
            job_config.current_step = "Completed"
            result.status = TrainingStatus.COMPLETED
            result.completed_at = datetime.utcnow()
            
            # Calculate training time and resource usage
            result.training_time_hours = (datetime.utcnow() - start_time).total_seconds() / 3600
            result.cpu_hours_used = result.training_time_hours * required_cpu
            
            logger.info(f"Training job {job_id} completed successfully")
        
        except Exception as e:
            logger.error(f"Training job {job_id} failed: {e}")
            
            job_config.status = TrainingStatus.FAILED
            job_config.error_message = str(e)
            result.status = TrainingStatus.FAILED
            result.error_details = {'message': str(e), 'type': type(e).__name__}
        
        finally:
            # Release resources
            self.resource_manager.release_resources(job_id)
            
            # Save results
            self._job_results[job_id] = result
            self._save_job_result(result)
        
        return result
    
    async def _train_models_parallel(self, 
                                   job_config: TrainingJobConfig,
                                   X_train: np.ndarray, 
                                   y_train: np.ndarray,
                                   X_val: np.ndarray, 
                                   y_val: np.ndarray,
                                   X_test: np.ndarray, 
                                   y_test: np.ndarray) -> List[Dict[str, Any]]:
        """Train multiple models in parallel."""
        
        model_results = []
        total_models = len(job_config.model_configs)
        
        # Create executor for parallel training
        max_workers = min(job_config.max_parallel_jobs, total_models)
        executor = ThreadPoolExecutor(max_workers=max_workers)
        
        try:
            # Submit training tasks
            future_to_config = {}
            for i, model_config in enumerate(job_config.model_configs):
                future = executor.submit(
                    self._train_single_model_sync,
                    model_config,
                    X_train, y_train, X_val, y_val, X_test, y_test,
                    job_config,
                    i
                )
                future_to_config[future] = (i, model_config)
            
            # Process completed tasks
            completed_models = 0
            for future in as_completed(future_to_config):
                model_index, model_config = future_to_config[future]
                
                try:
                    model_result = future.result()
                    model_results.append(model_result)
                except Exception as e:
                    logger.error(f"Model {model_index} training failed: {e}")
                    model_results.append({
                        'model_index': model_index,
                        'model_config': model_config,
                        'status': 'failed',
                        'error': str(e)
                    })
                
                completed_models += 1
                
                # Update progress
                progress = 20.0 + (completed_models / total_models) * 70.0
                job_config.progress = progress
                job_config.current_step = f"Trained {completed_models}/{total_models} models"
        
        finally:
            executor.shutdown(wait=True)
        
        return model_results
    
    def _train_single_model_sync(self,
                               model_config: Dict[str, Any],
                               X_train: np.ndarray, 
                               y_train: np.ndarray,
                               X_val: np.ndarray, 
                               y_val: np.ndarray,
                               X_test: np.ndarray, 
                               y_test: np.ndarray,
                               job_config: TrainingJobConfig,
                               model_index: int) -> Dict[str, Any]:
        """Train a single model (synchronous)."""
        
        try:
            logger.info(f"Training model {model_index}: {model_config.get('name', 'unnamed')}")
            
            # Create model builder function
            def model_builder(params):
                # This would need to be implemented based on your specific model types
                # For now, using the existing ML engine
                if not self.ml_engine:
                    raise ValueError("ML engine not available")
                
                # Use the advanced modeling engine
                # This is a simplified version - you'd need to adapt based on model config
                return self.ml_engine
            
            # Get parameter space for optimization
            param_space = model_config.get('hyperparameter_space', {})
            
            if param_space and job_config.optimization_method != OptimizationMethod.GRID_SEARCH:
                # Hyperparameter optimization
                optimization_result = self.optimizer.optimize_parameters(
                    model_builder=model_builder,
                    param_space=param_space,
                    X_train=X_train,
                    y_train=y_train,
                    X_val=X_val,
                    y_val=y_val,
                    method=job_config.optimization_method,
                    budget=job_config.optimization_budget // len(job_config.model_configs),
                    cv_folds=job_config.validation_config.get('cv', 5),
                    scoring='accuracy',  # This should be determined by task type
                    job_id=job_config.job_id
                )
                
                best_model = optimization_result['best_model']
                best_params = optimization_result['best_params']
                val_score = optimization_result['best_val_score']
            
            else:
                # Train single model without optimization
                if self.ml_engine:
                    # Create DataFrame for the ML engine
                    train_df = pd.DataFrame(X_train, columns=job_config.feature_columns or [f'feature_{i}' for i in range(X_train.shape[1])])
                    train_df[job_config.target_column] = y_train
                    
                    training_result = self.ml_engine.train_industrial_model(
                        data=train_df,
                        target_column=job_config.target_column,
                        model_type=model_config.get('model_type', 'auto'),
                        task_type=model_config.get('task_type', 'auto'),
                        optimization_budget=10  # Small budget for single model
                    )
                    
                    best_model = training_result['best_model']
                    best_params = training_result.get('best_params', {})
                    
                    # Evaluate on validation set
                    val_predictions = best_model.predict(X_val)
                    if training_result['task_type'] == 'classification':
                        from sklearn.metrics import accuracy_score
                        val_score = accuracy_score(y_val, val_predictions)
                    else:
                        from sklearn.metrics import r2_score
                        val_score = r2_score(y_val, val_predictions)
                else:
                    raise ValueError("No ML engine available for training")
            
            # Evaluate on test set
            test_predictions = best_model.predict(X_test)
            
            # Calculate test metrics
            if len(np.unique(y_test)) < 10:  # Classification
                from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
                test_metrics = {
                    'accuracy': accuracy_score(y_test, test_predictions),
                    'precision': precision_score(y_test, test_predictions, average='macro', zero_division=0),
                    'recall': recall_score(y_test, test_predictions, average='macro', zero_division=0),
                    'f1_score': f1_score(y_test, test_predictions, average='macro', zero_division=0)
                }
            else:  # Regression
                from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
                test_metrics = {
                    'mse': mean_squared_error(y_test, test_predictions),
                    'mae': mean_absolute_error(y_test, test_predictions),
                    'r2_score': r2_score(y_test, test_predictions)
                }
            
            # Register model in registry if enabled
            model_id = None
            if job_config.save_intermediate_models:
                try:
                    model_id = self.model_registry.registry.register_model(
                        name=f"{job_config.name}_{model_config.get('name', f'model_{model_index}')}",
                        model=best_model,
                        framework=ModelFramework(model_config.get('framework', 'sklearn')),
                        model_type=model_config.get('task_type', 'regression'),
                        description=f"Model from training job {job_config.name}",
                        author=job_config.created_by,
                        hyperparameters=best_params,
                        training_metrics={'val_score': val_score},
                        validation_metrics=test_metrics,
                        experiment_id=job_config.experiment_id,
                        feature_names=job_config.feature_columns
                    )
                except Exception as e:
                    logger.warning(f"Could not register model: {e}")
            
            return {
                'model_index': model_index,
                'model_config': model_config,
                'model_id': model_id,
                'status': 'success',
                'best_params': best_params,
                'val_score': val_score,
                'test_metrics': test_metrics,
                'model': best_model  # Include model for comparison
            }
        
        except Exception as e:
            logger.error(f"Error training model {model_index}: {e}")
            return {
                'model_index': model_index,
                'model_config': model_config,
                'status': 'failed',
                'error': str(e)
            }
    
    async def _load_training_data(self, data_config: Dict[str, Any]) -> pd.DataFrame:
        """Load training data based on configuration."""
        # This is similar to the implementation in mlops_platform.py
        # but made async for the pipeline service
        
        if 'file_path' in data_config:
            file_path = data_config['file_path']
            if file_path.endswith('.csv'):
                return pd.read_csv(file_path)
            elif file_path.endswith('.json'):
                return pd.read_json(file_path)
            elif file_path.endswith('.parquet'):
                return pd.read_parquet(file_path)
        
        # Add support for other data sources as needed
        raise ValueError("Unsupported data configuration")
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get training job status."""
        if job_id not in self._active_jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job_config = self._active_jobs[job_id]
        
        status = {
            'job_id': job_id,
            'name': job_config.name,
            'status': job_config.status.value,
            'progress': job_config.progress,
            'current_step': job_config.current_step,
            'created_at': job_config.created_at.isoformat(),
            'created_by': job_config.created_by
        }
        
        if job_config.error_message:
            status['error_message'] = job_config.error_message
        
        # Add results if available
        if job_id in self._job_results:
            result = self._job_results[job_id]
            status['result'] = {
                'status': result.status.value,
                'total_models_trained': result.total_models_trained,
                'successful_models': result.successful_models,
                'failed_models': result.failed_models,
                'best_model_id': result.best_model_id,
                'best_score': result.best_score,
                'training_time_hours': result.training_time_hours
            }
            
            if result.completed_at:
                status['result']['completed_at'] = result.completed_at.isoformat()
        
        return status
    
    def list_jobs(self, 
                 status_filter: TrainingStatus = None,
                 created_by_filter: str = None) -> List[Dict[str, Any]]:
        """List training jobs with optional filters."""
        jobs = []
        
        for job_id, job_config in self._active_jobs.items():
            if status_filter and job_config.status != status_filter:
                continue
            
            if created_by_filter and job_config.created_by != created_by_filter:
                continue
            
            job_info = {
                'job_id': job_id,
                'name': job_config.name,
                'status': job_config.status.value,
                'progress': job_config.progress,
                'created_at': job_config.created_at.isoformat(),
                'created_by': job_config.created_by,
                'priority': job_config.priority
            }
            
            # Add result summary if available
            if job_id in self._job_results:
                result = self._job_results[job_id]
                job_info['result_summary'] = {
                    'total_models': result.total_models_trained,
                    'successful_models': result.successful_models,
                    'best_score': result.best_score,
                    'training_time_hours': result.training_time_hours
                }
            
            jobs.append(job_info)
        
        return sorted(jobs, key=lambda x: x['created_at'], reverse=True)
    
    async def cancel_job(self, job_id: str):
        """Cancel a training job."""
        if job_id not in self._active_jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job_config = self._active_jobs[job_id]
        
        # Cancel if running
        if job_id in self._job_tasks:
            task = self._job_tasks[job_id]
            task.cancel()
            
            try:
                await task
            except asyncio.CancelledError:
                pass
            
            del self._job_tasks[job_id]
        
        # Remove from queue if queued
        if job_id in self._job_queue:
            self._job_queue.remove(job_id)
        
        # Update status
        job_config.status = TrainingStatus.CANCELLED
        job_config.current_step = "Cancelled"
        
        # Release resources
        self.resource_manager.release_resources(job_id)
        
        logger.info(f"Cancelled training job {job_id}")
    
    def get_service_statistics(self) -> Dict[str, Any]:
        """Get service statistics."""
        jobs = list(self._active_jobs.values())
        
        stats = {
            'total_jobs': len(jobs),
            'jobs_by_status': {},
            'queue_length': len(self._job_queue),
            'active_tasks': len(self._job_tasks),
            'resource_utilization': self.resource_manager.get_resource_utilization()
        }
        
        # Calculate status distribution
        for job in jobs:
            status = job.status.value
            stats['jobs_by_status'][status] = stats['jobs_by_status'].get(status, 0) + 1
        
        return stats
    
    def _save_job_config(self, job_config: TrainingJobConfig):
        """Save job configuration to storage."""
        job_dict = asdict(job_config)
        job_dict['created_at'] = job_config.created_at.isoformat()
        
        config_file = os.path.join(self.jobs_path, f"{job_config.job_id}_config.json")
        with open(config_file, 'w') as f:
            json.dump(job_dict, f, indent=2)
    
    def _save_job_result(self, result: TrainingResult):
        """Save job result to storage."""
        result_dict = asdict(result)
        if result.completed_at:
            result_dict['completed_at'] = result.completed_at.isoformat()
        
        result_file = os.path.join(self.jobs_path, f"{result.job_id}_result.json")
        with open(result_file, 'w') as f:
            json.dump(result_dict, f, indent=2, default=str)


# Factory function
def create_training_pipeline_service(storage_path: str = "./mlops_storage") -> TrainingPipelineService:
    """Factory function to create training pipeline service."""
    return TrainingPipelineService(storage_path)