"""
AI Company MLOps Platform Core
==============================

Production-ready MLOps infrastructure for AI companies to manage their entire ML lifecycle.
Built on top of the existing advanced modeling capabilities with comprehensive experiment tracking,
model versioning, automated deployment, and monitoring.

Features:
- Model Registry and Versioning with lineage tracking
- Automated Training Pipelines with hyperparameter optimization
- Multi-framework model serving (TensorFlow, PyTorch, scikit-learn)
- A/B testing and canary deployments with rollback capabilities
- Real-time monitoring and performance tracking
- Integration with existing ML capabilities
"""

import os
import json
import uuid
import hashlib
import pickle
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import asyncio
import aiofiles
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.metrics import classification_report, mean_squared_error, r2_score, f1_score
import joblib

# Import existing ML capabilities
try:
    from app.ml.advanced_modeling_engine import AdvancedMLModelingEngine, TensorFlowModelArchitecture, PyTorchModelArchitecture
    from app.ml.feature_engineering import AdvancedFeatureEngineer
    from app.ml.data_quality import AdvancedDataQualityAnalyzer
except ImportError as e:
    logging.warning(f"Could not import existing ML modules: {e}")
    AdvancedMLModelingEngine = None
    TensorFlowModelArchitecture = None
    PyTorchModelArchitecture = None
    AdvancedFeatureEngineer = None
    AdvancedDataQualityAnalyzer = None

logger = logging.getLogger(__name__)


# Enums and Data Classes
class ExperimentStatus(str, Enum):
    """Experiment execution status."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ModelStatus(str, Enum):
    """Model registry status."""
    REGISTERED = "registered"
    TRAINING = "training"
    TRAINED = "trained"
    VALIDATING = "validating"
    VALIDATED = "validated"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class DeploymentType(str, Enum):
    """Model deployment types."""
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"
    A_B_TEST = "ab_test"
    CANARY = "canary"
    SHADOW = "shadow"


class ModelFramework(str, Enum):
    """Supported ML frameworks."""
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    SKLEARN = "sklearn"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    CATBOOST = "catboost"
    CUSTOM = "custom"


@dataclass
class ModelMetadata:
    """Model metadata for registry."""
    model_id: str
    name: str
    version: str
    framework: ModelFramework
    model_type: str  # 'classification', 'regression', 'clustering', etc.
    description: str
    tags: List[str]
    author: str
    created_at: datetime
    updated_at: datetime
    status: ModelStatus
    
    # Model specifications
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    feature_names: List[str]
    target_names: List[str]
    
    # Training information
    training_dataset_id: Optional[str] = None
    hyperparameters: Optional[Dict[str, Any]] = None
    training_metrics: Optional[Dict[str, float]] = None
    validation_metrics: Optional[Dict[str, float]] = None
    
    # Deployment information
    deployment_config: Optional[Dict[str, Any]] = None
    resource_requirements: Optional[Dict[str, Any]] = None
    
    # Lineage and dependencies
    parent_model_id: Optional[str] = None
    experiment_id: Optional[str] = None
    dependencies: List[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []


@dataclass
class ExperimentConfig:
    """Experiment configuration."""
    experiment_id: str
    name: str
    description: str
    created_by: str
    created_at: datetime
    
    # Data configuration
    dataset_config: Dict[str, Any]
    target_column: str
    feature_columns: List[str]
    
    # Model configuration
    model_configs: List[Dict[str, Any]]  # Multiple model configs for comparison
    
    # Training configuration
    train_test_split: Dict[str, Any]
    cross_validation: Dict[str, Any]
    
    # Optimization configuration
    hyperparameter_search: Dict[str, Any]
    optimization_budget: int
    max_training_time_minutes: int
    
    # Evaluation configuration
    evaluation_metrics: List[str]
    early_stopping: Dict[str, Any]
    
    status: ExperimentStatus = ExperimentStatus.QUEUED
    results: Optional[Dict[str, Any]] = None


@dataclass
class DeploymentConfig:
    """Model deployment configuration."""
    deployment_id: str
    model_id: str
    model_version: str
    deployment_type: DeploymentType
    environment: str  # 'production', 'staging', 'development'
    
    # Deployment settings
    replicas: int
    resource_limits: Dict[str, Any]
    auto_scaling: Dict[str, Any]
    
    # Traffic routing
    traffic_percentage: float  # For A/B testing and canary deployments
    routing_rules: Dict[str, Any]
    
    # Monitoring configuration
    monitoring_config: Dict[str, Any]
    alert_rules: List[Dict[str, Any]]
    
    created_at: datetime
    deployed_at: Optional[datetime] = None
    status: str = "pending"


class MLOpsModelRegistry:
    """Advanced model registry with versioning and lineage tracking."""
    
    def __init__(self, storage_path: str = "./mlops_storage"):
        self.storage_path = storage_path
        self.models_path = os.path.join(storage_path, "models")
        self.metadata_path = os.path.join(storage_path, "metadata")
        self.artifacts_path = os.path.join(storage_path, "artifacts")
        
        # Create directories
        for path in [self.models_path, self.metadata_path, self.artifacts_path]:
            os.makedirs(path, exist_ok=True)
        
        self._models: Dict[str, ModelMetadata] = {}
        self._load_existing_models()
        
    def _load_existing_models(self):
        """Load existing model metadata from storage."""
        try:
            metadata_files = [f for f in os.listdir(self.metadata_path) if f.endswith('.json')]
            for metadata_file in metadata_files:
                with open(os.path.join(self.metadata_path, metadata_file), 'r') as f:
                    metadata_dict = json.load(f)
                    # Convert datetime strings back to datetime objects
                    metadata_dict['created_at'] = datetime.fromisoformat(metadata_dict['created_at'])
                    metadata_dict['updated_at'] = datetime.fromisoformat(metadata_dict['updated_at'])
                    metadata = ModelMetadata(**metadata_dict)
                    self._models[metadata.model_id] = metadata
            logger.info(f"Loaded {len(self._models)} models from registry")
        except Exception as e:
            logger.warning(f"Could not load existing models: {e}")
    
    def register_model(self, 
                      name: str,
                      model: Any,
                      framework: ModelFramework,
                      model_type: str,
                      description: str = "",
                      tags: List[str] = None,
                      author: str = "system",
                      version: str = None,
                      input_schema: Dict[str, Any] = None,
                      output_schema: Dict[str, Any] = None,
                      feature_names: List[str] = None,
                      target_names: List[str] = None,
                      hyperparameters: Dict[str, Any] = None,
                      training_metrics: Dict[str, float] = None,
                      parent_model_id: str = None,
                      experiment_id: str = None) -> str:
        """Register a new model in the registry."""
        
        # Generate model ID and version
        model_id = str(uuid.uuid4())
        if version is None:
            version = self._generate_version(name)
        
        # Create model metadata
        metadata = ModelMetadata(
            model_id=model_id,
            name=name,
            version=version,
            framework=framework,
            model_type=model_type,
            description=description,
            tags=tags or [],
            author=author,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            status=ModelStatus.REGISTERED,
            input_schema=input_schema or {},
            output_schema=output_schema or {},
            feature_names=feature_names or [],
            target_names=target_names or [],
            hyperparameters=hyperparameters,
            training_metrics=training_metrics,
            parent_model_id=parent_model_id,
            experiment_id=experiment_id
        )
        
        # Save model artifact
        self._save_model_artifact(model_id, model)
        
        # Save metadata
        self._save_model_metadata(metadata)
        
        # Store in memory
        self._models[model_id] = metadata
        
        logger.info(f"Registered model {name} with ID {model_id}")
        return model_id
    
    def get_model(self, model_id: str) -> Tuple[Any, ModelMetadata]:
        """Retrieve model and metadata by ID."""
        if model_id not in self._models:
            raise ValueError(f"Model {model_id} not found in registry")
        
        metadata = self._models[model_id]
        model = self._load_model_artifact(model_id)
        
        return model, metadata
    
    def list_models(self, 
                   name_filter: str = None,
                   framework_filter: ModelFramework = None,
                   status_filter: ModelStatus = None,
                   tag_filter: str = None) -> List[ModelMetadata]:
        """List models with optional filters."""
        models = list(self._models.values())
        
        if name_filter:
            models = [m for m in models if name_filter.lower() in m.name.lower()]
        
        if framework_filter:
            models = [m for m in models if m.framework == framework_filter]
        
        if status_filter:
            models = [m for m in models if m.status == status_filter]
        
        if tag_filter:
            models = [m for m in models if tag_filter in m.tags]
        
        return sorted(models, key=lambda x: x.created_at, reverse=True)
    
    def update_model_status(self, model_id: str, status: ModelStatus):
        """Update model status."""
        if model_id not in self._models:
            raise ValueError(f"Model {model_id} not found")
        
        self._models[model_id].status = status
        self._models[model_id].updated_at = datetime.utcnow()
        self._save_model_metadata(self._models[model_id])
    
    def get_model_lineage(self, model_id: str) -> Dict[str, Any]:
        """Get model lineage and dependencies."""
        if model_id not in self._models:
            raise ValueError(f"Model {model_id} not found")
        
        metadata = self._models[model_id]
        
        # Build lineage tree
        lineage = {
            "model": metadata,
            "children": [],
            "ancestors": []
        }
        
        # Find child models
        for mid, model in self._models.items():
            if model.parent_model_id == model_id:
                lineage["children"].append(model)
        
        # Find ancestors
        current_model = metadata
        while current_model.parent_model_id:
            parent = self._models.get(current_model.parent_model_id)
            if parent:
                lineage["ancestors"].append(parent)
                current_model = parent
            else:
                break
        
        return lineage
    
    def delete_model(self, model_id: str, force: bool = False):
        """Delete model from registry."""
        if model_id not in self._models:
            raise ValueError(f"Model {model_id} not found")
        
        metadata = self._models[model_id]
        
        # Check for dependencies unless force delete
        if not force:
            children = [m for m in self._models.values() if m.parent_model_id == model_id]
            if children:
                raise ValueError(f"Model has {len(children)} dependent models. Use force=True to delete anyway.")
        
        # Remove files
        try:
            model_file = os.path.join(self.models_path, f"{model_id}.pkl")
            if os.path.exists(model_file):
                os.remove(model_file)
            
            metadata_file = os.path.join(self.metadata_path, f"{model_id}.json")
            if os.path.exists(metadata_file):
                os.remove(metadata_file)
        except Exception as e:
            logger.warning(f"Could not remove files for model {model_id}: {e}")
        
        # Remove from memory
        del self._models[model_id]
        
        logger.info(f"Deleted model {model_id}")
    
    def _generate_version(self, model_name: str) -> str:
        """Generate next version number for a model."""
        existing_versions = []
        for model in self._models.values():
            if model.name == model_name:
                try:
                    # Extract version number (assume format like "1.0", "1.1", etc.)
                    version_parts = model.version.split('.')
                    if len(version_parts) >= 2:
                        existing_versions.append((int(version_parts[0]), int(version_parts[1])))
                except (ValueError, IndexError):
                    continue
        
        if not existing_versions:
            return "1.0"
        
        # Find max version and increment
        max_major, max_minor = max(existing_versions)
        return f"{max_major}.{max_minor + 1}"
    
    def _save_model_artifact(self, model_id: str, model: Any):
        """Save model artifact to storage."""
        model_file = os.path.join(self.models_path, f"{model_id}.pkl")
        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
    
    def _load_model_artifact(self, model_id: str) -> Any:
        """Load model artifact from storage."""
        model_file = os.path.join(self.models_path, f"{model_id}.pkl")
        if not os.path.exists(model_file):
            raise FileNotFoundError(f"Model artifact not found: {model_file}")
        
        with open(model_file, 'rb') as f:
            return pickle.load(f)
    
    def _save_model_metadata(self, metadata: ModelMetadata):
        """Save model metadata to storage."""
        metadata_dict = asdict(metadata)
        # Convert datetime to ISO format for JSON serialization
        metadata_dict['created_at'] = metadata.created_at.isoformat()
        metadata_dict['updated_at'] = metadata.updated_at.isoformat()
        
        metadata_file = os.path.join(self.metadata_path, f"{metadata.model_id}.json")
        with open(metadata_file, 'w') as f:
            json.dump(metadata_dict, f, indent=2)


class MLOpsExperimentTracker:
    """Advanced experiment tracking and management."""
    
    def __init__(self, storage_path: str = "./mlops_storage"):
        self.storage_path = storage_path
        self.experiments_path = os.path.join(storage_path, "experiments")
        os.makedirs(self.experiments_path, exist_ok=True)
        
        self._experiments: Dict[str, ExperimentConfig] = {}
        self._experiment_results: Dict[str, Dict[str, Any]] = {}
        self._load_existing_experiments()
    
    def _load_existing_experiments(self):
        """Load existing experiments from storage."""
        try:
            for exp_file in os.listdir(self.experiments_path):
                if exp_file.endswith('_config.json'):
                    exp_id = exp_file.replace('_config.json', '')
                    with open(os.path.join(self.experiments_path, exp_file), 'r') as f:
                        exp_dict = json.load(f)
                        exp_dict['created_at'] = datetime.fromisoformat(exp_dict['created_at'])
                        experiment = ExperimentConfig(**exp_dict)
                        self._experiments[exp_id] = experiment
                    
                    # Load results if available
                    results_file = os.path.join(self.experiments_path, f"{exp_id}_results.json")
                    if os.path.exists(results_file):
                        with open(results_file, 'r') as f:
                            self._experiment_results[exp_id] = json.load(f)
            
            logger.info(f"Loaded {len(self._experiments)} experiments")
        except Exception as e:
            logger.warning(f"Could not load existing experiments: {e}")
    
    def create_experiment(self,
                         name: str,
                         description: str,
                         dataset_config: Dict[str, Any],
                         target_column: str,
                         model_configs: List[Dict[str, Any]],
                         created_by: str = "system",
                         feature_columns: List[str] = None,
                         optimization_budget: int = 50,
                         max_training_time_minutes: int = 60) -> str:
        """Create new experiment configuration."""
        
        experiment_id = str(uuid.uuid4())
        
        experiment = ExperimentConfig(
            experiment_id=experiment_id,
            name=name,
            description=description,
            created_by=created_by,
            created_at=datetime.utcnow(),
            dataset_config=dataset_config,
            target_column=target_column,
            feature_columns=feature_columns or [],
            model_configs=model_configs,
            train_test_split={"test_size": 0.2, "random_state": 42},
            cross_validation={"cv": 5, "scoring": "auto"},
            hyperparameter_search={"method": "random_search", "n_iter": optimization_budget},
            optimization_budget=optimization_budget,
            max_training_time_minutes=max_training_time_minutes,
            evaluation_metrics=["accuracy", "precision", "recall", "f1"] if self._is_classification_task(model_configs) else ["mse", "mae", "r2"],
            early_stopping={"patience": 10, "monitor": "val_loss"},
            status=ExperimentStatus.QUEUED
        )
        
        # Save experiment
        self._save_experiment(experiment)
        self._experiments[experiment_id] = experiment
        
        logger.info(f"Created experiment {name} with ID {experiment_id}")
        return experiment_id
    
    def get_experiment(self, experiment_id: str) -> ExperimentConfig:
        """Get experiment configuration."""
        if experiment_id not in self._experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        return self._experiments[experiment_id]
    
    def get_experiment_results(self, experiment_id: str) -> Dict[str, Any]:
        """Get experiment results."""
        if experiment_id not in self._experiment_results:
            raise ValueError(f"No results found for experiment {experiment_id}")
        return self._experiment_results[experiment_id]
    
    def update_experiment_status(self, experiment_id: str, status: ExperimentStatus):
        """Update experiment status."""
        if experiment_id not in self._experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        self._experiments[experiment_id].status = status
        self._save_experiment(self._experiments[experiment_id])
    
    def save_experiment_results(self, experiment_id: str, results: Dict[str, Any]):
        """Save experiment results."""
        self._experiment_results[experiment_id] = results
        
        # Save to file
        results_file = os.path.join(self.experiments_path, f"{experiment_id}_results.json")
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
    
    def list_experiments(self, 
                        status_filter: ExperimentStatus = None,
                        created_by_filter: str = None) -> List[ExperimentConfig]:
        """List experiments with optional filters."""
        experiments = list(self._experiments.values())
        
        if status_filter:
            experiments = [e for e in experiments if e.status == status_filter]
        
        if created_by_filter:
            experiments = [e for e in experiments if e.created_by == created_by_filter]
        
        return sorted(experiments, key=lambda x: x.created_at, reverse=True)
    
    def _is_classification_task(self, model_configs: List[Dict[str, Any]]) -> bool:
        """Determine if this is a classification task based on model configs."""
        for config in model_configs:
            if config.get('task_type') == 'classification':
                return True
            if config.get('model_type') in ['classifier', 'classification']:
                return True
        return False
    
    def _save_experiment(self, experiment: ExperimentConfig):
        """Save experiment configuration to storage."""
        exp_dict = asdict(experiment)
        exp_dict['created_at'] = experiment.created_at.isoformat()
        
        config_file = os.path.join(self.experiments_path, f"{experiment.experiment_id}_config.json")
        with open(config_file, 'w') as f:
            json.dump(exp_dict, f, indent=2)


class MLOpsTrainingPipeline:
    """Automated training pipeline with hyperparameter optimization."""
    
    def __init__(self, 
                 model_registry: MLOpsModelRegistry,
                 experiment_tracker: MLOpsExperimentTracker,
                 storage_path: str = "./mlops_storage"):
        self.model_registry = model_registry
        self.experiment_tracker = experiment_tracker
        self.storage_path = storage_path
        self.executor = ThreadPoolExecutor(max_workers=4)
        
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
    
    async def execute_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """Execute experiment asynchronously."""
        experiment = self.experiment_tracker.get_experiment(experiment_id)
        
        # Update status
        self.experiment_tracker.update_experiment_status(experiment_id, ExperimentStatus.RUNNING)
        
        try:
            # Load and prepare data
            data = await self._load_experiment_data(experiment.dataset_config)
            
            # Data quality analysis
            if self.data_quality_analyzer:
                quality_report = self.data_quality_analyzer.analyze_data(data)
                logger.info(f"Data quality score: {quality_report.get('overall_score', 'N/A')}")
            
            # Feature engineering
            if self.feature_engineer:
                engineered_data = self.feature_engineer.engineer_features(
                    data, 
                    target_column=experiment.target_column,
                    feature_selection_methods=['correlation', 'mutual_info']
                )
                data = engineered_data['data']
            
            # Execute training for each model configuration
            results = {
                'experiment_id': experiment_id,
                'models': [],
                'best_model_id': None,
                'best_score': -float('inf'),
                'execution_time_minutes': 0,
                'data_shape': data.shape,
                'feature_importance': {},
                'cross_validation_scores': {}
            }
            
            start_time = datetime.utcnow()
            
            for i, model_config in enumerate(experiment.model_configs):
                logger.info(f"Training model {i+1}/{len(experiment.model_configs)}: {model_config.get('name', 'unnamed')}")
                
                try:
                    model_result = await self._train_single_model(
                        data, 
                        experiment.target_column, 
                        model_config,
                        experiment.optimization_budget // len(experiment.model_configs)
                    )
                    
                    # Register model in registry
                    model_id = self.model_registry.register_model(
                        name=f"{experiment.name}_{model_config.get('name', f'model_{i}')}",
                        model=model_result['model'],
                        framework=ModelFramework(model_config.get('framework', 'sklearn')),
                        model_type=model_config.get('task_type', 'regression'),
                        description=f"Model from experiment {experiment.name}",
                        author=experiment.created_by,
                        hyperparameters=model_result.get('best_params', {}),
                        training_metrics=model_result.get('training_metrics', {}),
                        experiment_id=experiment_id,
                        feature_names=experiment.feature_columns or list(data.columns)
                    )
                    
                    model_result['model_id'] = model_id
                    results['models'].append(model_result)
                    
                    # Track best model
                    current_score = model_result.get('score', -float('inf'))
                    if current_score > results['best_score']:
                        results['best_score'] = current_score
                        results['best_model_id'] = model_id
                    
                except Exception as e:
                    logger.error(f"Failed to train model {i}: {e}")
                    results['models'].append({
                        'model_config': model_config,
                        'error': str(e),
                        'status': 'failed'
                    })
            
            # Calculate execution time
            end_time = datetime.utcnow()
            results['execution_time_minutes'] = (end_time - start_time).total_seconds() / 60
            
            # Save results
            self.experiment_tracker.save_experiment_results(experiment_id, results)
            
            # Update experiment status
            if results['best_model_id']:
                self.experiment_tracker.update_experiment_status(experiment_id, ExperimentStatus.COMPLETED)
            else:
                self.experiment_tracker.update_experiment_status(experiment_id, ExperimentStatus.FAILED)
            
            logger.info(f"Experiment {experiment_id} completed with best score: {results['best_score']}")
            return results
            
        except Exception as e:
            logger.error(f"Experiment {experiment_id} failed: {e}")
            self.experiment_tracker.update_experiment_status(experiment_id, ExperimentStatus.FAILED)
            raise
    
    async def _load_experiment_data(self, dataset_config: Dict[str, Any]) -> pd.DataFrame:
        """Load experiment data based on configuration."""
        # This is a simplified implementation - in production, you'd support various data sources
        if 'file_path' in dataset_config:
            file_path = dataset_config['file_path']
            if file_path.endswith('.csv'):
                return pd.read_csv(file_path)
            elif file_path.endswith('.json'):
                return pd.read_json(file_path)
            elif file_path.endswith('.parquet'):
                return pd.read_parquet(file_path)
        
        if 'sql_query' in dataset_config:
            # Handle SQL data source
            pass
        
        if 'api_endpoint' in dataset_config:
            # Handle API data source
            pass
        
        raise ValueError("Unsupported dataset configuration")
    
    async def _train_single_model(self, 
                                 data: pd.DataFrame, 
                                 target_column: str, 
                                 model_config: Dict[str, Any],
                                 optimization_budget: int) -> Dict[str, Any]:
        """Train a single model configuration."""
        
        if not self.ml_engine:
            raise ValueError("ML engine not available")
        
        # Determine task type
        task_type = model_config.get('task_type', 'auto')
        model_type = model_config.get('model_type', 'auto')
        
        # Train model using existing engine
        training_result = self.ml_engine.train_industrial_model(
            data=data,
            target_column=target_column,
            model_type=model_type,
            task_type=task_type,
            optimization_budget=optimization_budget
        )
        
        return {
            'model_config': model_config,
            'model': training_result['best_model'],
            'score': training_result['performance']['best_score'],
            'best_params': training_result.get('best_params', {}),
            'training_metrics': training_result['performance'],
            'model_type': training_result['model_type'],
            'task_type': training_result['task_type'],
            'feature_names': training_result['feature_names'],
            'status': 'completed'
        }


class MLOpsCore:
    """
    Core MLOps Platform orchestrating all components.
    
    This is the main entry point for AI companies to manage their ML lifecycle.
    Provides high-level APIs for model training, deployment, and monitoring.
    """
    
    def __init__(self, storage_path: str = "./mlops_storage"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        
        # Initialize components
        self.model_registry = MLOpsModelRegistry(storage_path)
        self.experiment_tracker = MLOpsExperimentTracker(storage_path)
        self.training_pipeline = MLOpsTrainingPipeline(
            self.model_registry, 
            self.experiment_tracker, 
            storage_path
        )
        
        # Active experiments
        self._active_experiments: Dict[str, asyncio.Task] = {}
        
        logger.info(f"MLOps Core initialized with storage at {storage_path}")
    
    async def create_and_run_experiment(self,
                                       name: str,
                                       description: str,
                                       dataset_config: Dict[str, Any],
                                       target_column: str,
                                       model_configs: List[Dict[str, Any]],
                                       created_by: str = "system",
                                       wait_for_completion: bool = False,
                                       **kwargs) -> Dict[str, Any]:
        """Create and optionally run an experiment."""
        
        # Create experiment
        experiment_id = self.experiment_tracker.create_experiment(
            name=name,
            description=description,
            dataset_config=dataset_config,
            target_column=target_column,
            model_configs=model_configs,
            created_by=created_by,
            **kwargs
        )
        
        # Start execution
        task = asyncio.create_task(self.training_pipeline.execute_experiment(experiment_id))
        self._active_experiments[experiment_id] = task
        
        if wait_for_completion:
            results = await task
            del self._active_experiments[experiment_id]
            return {
                'experiment_id': experiment_id,
                'status': 'completed',
                'results': results
            }
        else:
            return {
                'experiment_id': experiment_id,
                'status': 'running',
                'message': 'Experiment started successfully'
            }
    
    async def get_experiment_status(self, experiment_id: str) -> Dict[str, Any]:
        """Get current experiment status."""
        experiment = self.experiment_tracker.get_experiment(experiment_id)
        
        response = {
            'experiment_id': experiment_id,
            'name': experiment.name,
            'status': experiment.status.value,
            'created_at': experiment.created_at.isoformat(),
            'created_by': experiment.created_by
        }
        
        # Add results if available
        if experiment.status == ExperimentStatus.COMPLETED:
            try:
                results = self.experiment_tracker.get_experiment_results(experiment_id)
                response['results'] = results
            except ValueError:
                pass
        
        # Add progress if running
        if experiment_id in self._active_experiments:
            task = self._active_experiments[experiment_id]
            response['is_running'] = not task.done()
            if task.done() and not task.exception():
                response['results'] = task.result()
                del self._active_experiments[experiment_id]
        
        return response
    
    def register_model(self, **kwargs) -> str:
        """Register a model in the registry."""
        return self.model_registry.register_model(**kwargs)
    
    def get_model(self, model_id: str) -> Tuple[Any, ModelMetadata]:
        """Get model by ID."""
        return self.model_registry.get_model(model_id)
    
    def list_models(self, **kwargs) -> List[ModelMetadata]:
        """List models with optional filters."""
        return self.model_registry.list_models(**kwargs)
    
    def get_model_performance(self, model_id: str) -> Dict[str, Any]:
        """Get model performance metrics."""
        _, metadata = self.model_registry.get_model(model_id)
        
        return {
            'model_id': model_id,
            'name': metadata.name,
            'version': metadata.version,
            'framework': metadata.framework.value,
            'training_metrics': metadata.training_metrics,
            'validation_metrics': metadata.validation_metrics,
            'created_at': metadata.created_at.isoformat(),
            'status': metadata.status.value
        }
    
    def get_model_lineage(self, model_id: str) -> Dict[str, Any]:
        """Get model lineage and dependencies."""
        return self.model_registry.get_model_lineage(model_id)
    
    async def predict(self, 
                     model_id: str, 
                     input_data: Union[Dict, pd.DataFrame, np.ndarray],
                     return_probabilities: bool = False) -> Dict[str, Any]:
        """Make predictions using a registered model."""
        
        model, metadata = self.model_registry.get_model(model_id)
        
        # Prepare input data
        if isinstance(input_data, dict):
            # Convert dict to DataFrame for prediction
            input_df = pd.DataFrame([input_data])
        elif isinstance(input_data, np.ndarray):
            # Use array as-is or convert to DataFrame
            if len(metadata.feature_names) > 0:
                input_df = pd.DataFrame(input_data, columns=metadata.feature_names)
            else:
                input_df = input_data
        else:
            input_df = input_data
        
        # Make prediction
        if hasattr(model, 'predict'):
            predictions = model.predict(input_df)
        else:
            # Handle custom models or different interfaces
            raise ValueError(f"Model {model_id} does not have a predict method")
        
        result = {
            'model_id': model_id,
            'model_name': metadata.name,
            'model_version': metadata.version,
            'predictions': predictions.tolist() if hasattr(predictions, 'tolist') else predictions,
            'prediction_timestamp': datetime.utcnow().isoformat()
        }
        
        # Add probabilities if requested and available
        if return_probabilities and hasattr(model, 'predict_proba'):
            probabilities = model.predict_proba(input_df)
            result['probabilities'] = probabilities.tolist() if hasattr(probabilities, 'tolist') else probabilities
        
        return result
    
    def get_platform_stats(self) -> Dict[str, Any]:
        """Get platform statistics."""
        models = self.model_registry.list_models()
        experiments = self.experiment_tracker.list_experiments()
        
        # Model statistics
        model_stats = {
            'total_models': len(models),
            'by_framework': {},
            'by_status': {},
            'by_type': {}
        }
        
        for model in models:
            # Framework stats
            framework = model.framework.value
            model_stats['by_framework'][framework] = model_stats['by_framework'].get(framework, 0) + 1
            
            # Status stats
            status = model.status.value
            model_stats['by_status'][status] = model_stats['by_status'].get(status, 0) + 1
            
            # Type stats
            model_type = model.model_type
            model_stats['by_type'][model_type] = model_stats['by_type'].get(model_type, 0) + 1
        
        # Experiment statistics
        experiment_stats = {
            'total_experiments': len(experiments),
            'by_status': {},
            'active_experiments': len(self._active_experiments)
        }
        
        for experiment in experiments:
            status = experiment.status.value
            experiment_stats['by_status'][status] = experiment_stats['by_status'].get(status, 0) + 1
        
        return {
            'models': model_stats,
            'experiments': experiment_stats,
            'storage_path': self.storage_path,
            'platform_version': "1.0.0",
            'uptime_hours': 0  # Could track actual uptime
        }


# Utility functions for MLOps operations
def create_model_config(model_type: str, 
                       framework: str = "sklearn",
                       task_type: str = "auto",
                       hyperparameters: Dict[str, Any] = None) -> Dict[str, Any]:
    """Helper function to create model configuration."""
    return {
        'name': f"{framework}_{model_type}",
        'model_type': model_type,
        'framework': framework,
        'task_type': task_type,
        'hyperparameters': hyperparameters or {}
    }


def create_dataset_config(file_path: str = None,
                         sql_query: str = None,
                         api_endpoint: str = None,
                         **kwargs) -> Dict[str, Any]:
    """Helper function to create dataset configuration."""
    config = kwargs.copy()
    
    if file_path:
        config['file_path'] = file_path
    elif sql_query:
        config['sql_query'] = sql_query
    elif api_endpoint:
        config['api_endpoint'] = api_endpoint
    
    return config


# Factory function for quick setup
def create_mlops_platform(storage_path: str = "./mlops_storage") -> MLOpsCore:
    """Factory function to create MLOps platform."""
    return MLOpsCore(storage_path=storage_path)