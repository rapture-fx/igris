"""
Enhanced MLflow Integration
===========================

Advanced MLflow integration that extends the enhanced experiment tracking system
with comprehensive MLflow capabilities for AI companies. Provides seamless
integration between the enhanced experiment tracker and MLflow for unified
experiment management.

Key Features:
- Automatic experiment synchronization with MLflow
- Enhanced artifact management and versioning
- Custom MLflow plugins for advanced metrics
- Distributed experiment tracking across clusters
- Advanced model registry integration
- Real-time experiment comparison through MLflow UI
- Enhanced logging capabilities for all ML frameworks
- Automated model deployment through MLflow
"""

import os
import json
import logging
import asyncio
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from contextlib import contextmanager
import tempfile
import shutil

# MLflow imports
try:
    import mlflow
    import mlflow.tracking
    import mlflow.sklearn
    import mlflow.tensorflow
    import mlflow.pytorch
    import mlflow.xgboost
    import mlflow.lightgbm
    import mlflow.catboost
    from mlflow.tracking import MlflowClient
    from mlflow.entities import ViewType
    from mlflow.store.artifact.artifact_repository_registry import get_artifact_repository
    MLFLOW_AVAILABLE = True
except ImportError as e:
    MLFLOW_AVAILABLE = False
    logging.warning(f"MLflow not available: {e}")
    MlflowClient = None

# Import enhanced experiment components
try:
    from app.ml.enhanced_experiment_tracker import (
        EnhancedExperimentTracker, ExperimentType, MetricType, 
        OptimizationObjective, ExperimentInsights
    )
    from app.services.experiment_analytics_service import ExperimentAnalyticsService
except ImportError as e:
    logging.warning(f"Could not import enhanced experiment components: {e}")
    EnhancedExperimentTracker = None
    ExperimentAnalyticsService = None

# Framework-specific imports
try:
    import numpy as np
    import pandas as pd
    from sklearn.base import BaseEstimator
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
except ImportError:
    pass

try:
    import tensorflow as tf
except ImportError:
    tf = None

try:
    import torch
    import torch.nn as nn
except ImportError:
    torch = None
    nn = None

logger = logging.getLogger(__name__)


@dataclass
class MLflowExperimentConfig:
    """Configuration for MLflow experiment synchronization."""
    experiment_name: str
    tracking_uri: str
    artifact_location: Optional[str] = None
    tags: Dict[str, str] = None
    auto_log: bool = True
    log_model: bool = True
    log_artifacts: bool = True
    sync_frequency_seconds: int = 30
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = {}


@dataclass
class MLflowRunConfig:
    """Configuration for MLflow run management."""
    run_name: Optional[str] = None
    tags: Dict[str, str] = None
    nested: bool = False
    log_system_metrics: bool = True
    log_model_signature: bool = True
    log_input_example: bool = True
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = {}


class EnhancedMLflowIntegration:
    """
    Enhanced MLflow integration that bridges the enhanced experiment tracker
    with MLflow's capabilities for comprehensive experiment management.
    """
    
    def __init__(self, 
                 enhanced_tracker: Optional[EnhancedExperimentTracker] = None,
                 analytics_service: Optional[ExperimentAnalyticsService] = None,
                 tracking_uri: str = None,
                 artifact_location: str = None):
        
        if not MLFLOW_AVAILABLE:
            raise ImportError("MLflow is required for enhanced integration")
        
        self.enhanced_tracker = enhanced_tracker
        self.analytics_service = analytics_service
        
        # MLflow configuration
        self.tracking_uri = tracking_uri or os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db")
        self.artifact_location = artifact_location or os.getenv("MLFLOW_ARTIFACT_LOCATION", "./mlflow_artifacts")
        
        # Set MLflow tracking URI
        mlflow.set_tracking_uri(self.tracking_uri)
        
        # Initialize MLflow client
        self.client = MlflowClient(tracking_uri=self.tracking_uri)
        
        # Experiment mapping: enhanced_experiment_id -> mlflow_experiment_id
        self._experiment_mapping: Dict[str, str] = {}
        self._run_mapping: Dict[str, str] = {}  # enhanced_experiment_id -> mlflow_run_id
        
        # Active runs and synchronization
        self._active_runs: Dict[str, Any] = {}
        self._sync_threads: Dict[str, threading.Thread] = {}
        self._sync_stop_events: Dict[str, threading.Event] = {}
        
        # Framework-specific handlers
        self._framework_handlers = {
            'sklearn': self._handle_sklearn_integration,
            'tensorflow': self._handle_tensorflow_integration,
            'pytorch': self._handle_pytorch_integration,
            'xgboost': self._handle_xgboost_integration,
            'lightgbm': self._handle_lightgbm_integration,
            'catboost': self._handle_catboost_integration,
        }
        
        logger.info(f"Enhanced MLflow integration initialized with tracking URI: {self.tracking_uri}")
    
    def create_mlflow_experiment(self, 
                                enhanced_experiment_id: str,
                                config: MLflowExperimentConfig) -> str:
        """Create MLflow experiment for enhanced experiment tracking."""
        
        try:
            # Check if experiment already exists
            try:
                existing_experiment = mlflow.get_experiment_by_name(config.experiment_name)
                if existing_experiment:
                    mlflow_experiment_id = existing_experiment.experiment_id
                    logger.info(f"Using existing MLflow experiment: {config.experiment_name}")
                else:
                    raise ValueError("Experiment not found")
            except:
                # Create new experiment
                mlflow_experiment_id = mlflow.create_experiment(
                    name=config.experiment_name,
                    artifact_location=config.artifact_location,
                    tags=config.tags
                )
                logger.info(f"Created new MLflow experiment: {config.experiment_name}")
            
            # Store mapping
            self._experiment_mapping[enhanced_experiment_id] = mlflow_experiment_id
            
            # Set up experiment-level tags
            experiment_tags = {
                "enhanced_experiment_id": enhanced_experiment_id,
                "integration_version": "1.0",
                "created_by": "enhanced_experiment_tracker",
                **config.tags
            }
            
            # Update experiment tags
            for tag_key, tag_value in experiment_tags.items():
                self.client.set_experiment_tag(mlflow_experiment_id, tag_key, tag_value)
            
            # Start automatic synchronization if enabled
            if config.sync_frequency_seconds > 0:
                self._start_experiment_sync(enhanced_experiment_id, config.sync_frequency_seconds)
            
            return mlflow_experiment_id
        
        except Exception as e:
            logger.error(f"Failed to create MLflow experiment for {enhanced_experiment_id}: {e}")
            raise
    
    def start_enhanced_run(self,
                          enhanced_experiment_id: str,
                          run_config: MLflowRunConfig = None,
                          framework: str = None) -> str:
        """Start an enhanced MLflow run with comprehensive logging."""
        
        if enhanced_experiment_id not in self._experiment_mapping:
            raise ValueError(f"Enhanced experiment {enhanced_experiment_id} not mapped to MLflow")
        
        mlflow_experiment_id = self._experiment_mapping[enhanced_experiment_id]
        
        if run_config is None:
            run_config = MLflowRunConfig()
        
        try:
            # Set the experiment
            mlflow.set_experiment(experiment_id=mlflow_experiment_id)
            
            # Start the run
            run = mlflow.start_run(
                run_name=run_config.run_name,
                nested=run_config.nested,
                tags=run_config.tags
            )
            
            mlflow_run_id = run.info.run_id
            self._run_mapping[enhanced_experiment_id] = mlflow_run_id
            self._active_runs[enhanced_experiment_id] = run
            
            # Set up enhanced tags
            enhanced_tags = {
                "enhanced_experiment_id": enhanced_experiment_id,
                "framework": framework or "unknown",
                "integration_type": "enhanced",
                "auto_logging": str(run_config.log_system_metrics),
                **run_config.tags
            }
            
            for tag_key, tag_value in enhanced_tags.items():
                mlflow.set_tag(tag_key, tag_value)
            
            # Enable auto-logging based on framework
            if framework and framework in self._framework_handlers:
                self._framework_handlers[framework](run_config)
            
            # Log system information
            if run_config.log_system_metrics:
                self._log_system_info()
            
            logger.info(f"Started enhanced MLflow run {mlflow_run_id} for experiment {enhanced_experiment_id}")
            return mlflow_run_id
        
        except Exception as e:
            logger.error(f"Failed to start enhanced run for {enhanced_experiment_id}: {e}")
            raise
    
    def log_enhanced_metrics(self,
                           enhanced_experiment_id: str,
                           metrics: Dict[str, Union[float, int]],
                           step: Optional[int] = None,
                           timestamp: Optional[datetime] = None) -> bool:
        """Log metrics to both enhanced tracker and MLflow."""
        
        success = True
        
        try:
            # Log to enhanced tracker
            if self.enhanced_tracker:
                for metric_name, value in metrics.items():
                    self.enhanced_tracker.log_metric(
                        experiment_id=enhanced_experiment_id,
                        metric_name=metric_name,
                        value=value,
                        step=step,
                        timestamp=timestamp
                    )
            
            # Log to MLflow if run is active
            if enhanced_experiment_id in self._active_runs:
                with self._get_mlflow_run_context(enhanced_experiment_id):
                    for metric_name, value in metrics.items():
                        mlflow.log_metric(metric_name, value, step)
            
            return success
        
        except Exception as e:
            logger.error(f"Failed to log enhanced metrics for {enhanced_experiment_id}: {e}")
            return False
    
    def log_enhanced_hyperparameters(self,
                                   enhanced_experiment_id: str,
                                   hyperparameters: Dict[str, Any]) -> bool:
        """Log hyperparameters to both enhanced tracker and MLflow."""
        
        try:
            # Log to enhanced tracker
            if self.enhanced_tracker:
                for param_name, param_value in hyperparameters.items():
                    self.enhanced_tracker.log_hyperparameter(
                        experiment_id=enhanced_experiment_id,
                        param_name=param_name,
                        value=param_value
                    )
            
            # Log to MLflow if run is active
            if enhanced_experiment_id in self._active_runs:
                with self._get_mlflow_run_context(enhanced_experiment_id):
                    # Convert complex types to strings for MLflow
                    mlflow_params = {}
                    for param_name, param_value in hyperparameters.items():
                        if isinstance(param_value, (dict, list)):
                            mlflow_params[param_name] = json.dumps(param_value)
                        else:
                            mlflow_params[param_name] = str(param_value)
                    
                    mlflow.log_params(mlflow_params)
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to log enhanced hyperparameters for {enhanced_experiment_id}: {e}")
            return False
    
    def log_model_with_enhancement(self,
                                 enhanced_experiment_id: str,
                                 model: Any,
                                 artifact_path: str,
                                 framework: str,
                                 model_signature: Any = None,
                                 input_example: Any = None,
                                 pip_requirements: List[str] = None,
                                 extra_pip_requirements: List[str] = None,
                                 metadata: Dict[str, Any] = None) -> str:
        """Log model with enhanced metadata and integration."""
        
        if enhanced_experiment_id not in self._active_runs:
            raise ValueError(f"No active run for experiment {enhanced_experiment_id}")
        
        try:
            with self._get_mlflow_run_context(enhanced_experiment_id):
                # Enhanced model metadata
                enhanced_metadata = {
                    "enhanced_experiment_id": enhanced_experiment_id,
                    "framework": framework,
                    "logged_at": datetime.utcnow().isoformat(),
                    "integration_version": "1.0",
                    **(metadata or {})
                }
                
                # Log model based on framework
                if framework.lower() == 'sklearn':
                    model_info = mlflow.sklearn.log_model(
                        sk_model=model,
                        artifact_path=artifact_path,
                        signature=model_signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_pip_requirements=extra_pip_requirements,
                        metadata=enhanced_metadata
                    )
                
                elif framework.lower() == 'tensorflow':
                    model_info = mlflow.tensorflow.log_model(
                        tf_saved_model_dir=model if isinstance(model, str) else None,
                        tf_meta_graph_tags=None,
                        tf_signature_def_key=None,
                        artifact_path=artifact_path,
                        signature=model_signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_pip_requirements=extra_pip_requirements,
                        metadata=enhanced_metadata
                    )
                
                elif framework.lower() == 'pytorch':
                    model_info = mlflow.pytorch.log_model(
                        pytorch_model=model,
                        artifact_path=artifact_path,
                        signature=model_signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_pip_requirements=extra_pip_requirements,
                        metadata=enhanced_metadata
                    )
                
                elif framework.lower() == 'xgboost':
                    model_info = mlflow.xgboost.log_model(
                        xgb_model=model,
                        artifact_path=artifact_path,
                        signature=model_signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_pip_requirements=extra_pip_requirements,
                        metadata=enhanced_metadata
                    )
                
                elif framework.lower() == 'lightgbm':
                    model_info = mlflow.lightgbm.log_model(
                        lgb_model=model,
                        artifact_path=artifact_path,
                        signature=model_signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_pip_requirements=extra_pip_requirements,
                        metadata=enhanced_metadata
                    )
                
                elif framework.lower() == 'catboost':
                    model_info = mlflow.catboost.log_model(
                        cb_model=model,
                        artifact_path=artifact_path,
                        signature=model_signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_pip_requirements=extra_pip_requirements,
                        metadata=enhanced_metadata
                    )
                
                else:
                    # Generic model logging
                    model_info = mlflow.log_artifact(
                        local_path=model if isinstance(model, str) else None,
                        artifact_path=artifact_path
                    )
                
                logger.info(f"Logged model for experiment {enhanced_experiment_id} at {artifact_path}")
                return model_info.model_uri if hasattr(model_info, 'model_uri') else artifact_path
        
        except Exception as e:
            logger.error(f"Failed to log model for experiment {enhanced_experiment_id}: {e}")
            raise
    
    def log_experiment_artifacts(self,
                               enhanced_experiment_id: str,
                               artifacts: Dict[str, Any],
                               artifact_path: str = "enhanced_artifacts") -> bool:
        """Log enhanced experiment artifacts including visualizations and reports."""
        
        if enhanced_experiment_id not in self._active_runs:
            return False
        
        try:
            with self._get_mlflow_run_context(enhanced_experiment_id):
                # Create temporary directory for artifacts
                with tempfile.TemporaryDirectory() as temp_dir:
                    # Save artifacts to temporary files
                    for artifact_name, artifact_data in artifacts.items():
                        artifact_file_path = os.path.join(temp_dir, f"{artifact_name}.json")
                        
                        if isinstance(artifact_data, (dict, list)):
                            with open(artifact_file_path, 'w') as f:
                                json.dump(artifact_data, f, indent=2, default=str)
                        elif isinstance(artifact_data, str):
                            with open(artifact_file_path, 'w') as f:
                                f.write(artifact_data)
                        elif hasattr(artifact_data, 'to_dict'):
                            with open(artifact_file_path, 'w') as f:
                                json.dump(artifact_data.to_dict(), f, indent=2, default=str)
                        
                        # Log artifact to MLflow
                        mlflow.log_artifact(artifact_file_path, artifact_path)
                    
                    # Log experiment summary
                    summary_data = {
                        "enhanced_experiment_id": enhanced_experiment_id,
                        "artifact_count": len(artifacts),
                        "logged_at": datetime.utcnow().isoformat(),
                        "artifact_names": list(artifacts.keys())
                    }
                    
                    summary_file = os.path.join(temp_dir, "experiment_summary.json")
                    with open(summary_file, 'w') as f:
                        json.dump(summary_data, f, indent=2)
                    
                    mlflow.log_artifact(summary_file, artifact_path)
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to log artifacts for experiment {enhanced_experiment_id}: {e}")
            return False
    
    def sync_with_enhanced_tracker(self, enhanced_experiment_id: str) -> bool:
        """Synchronize MLflow data with enhanced experiment tracker."""
        
        if not self.enhanced_tracker:
            return False
        
        try:
            # Get MLflow experiment data
            if enhanced_experiment_id not in self._experiment_mapping:
                return False
            
            mlflow_experiment_id = self._experiment_mapping[enhanced_experiment_id]
            mlflow_runs = self.client.search_runs(
                experiment_ids=[mlflow_experiment_id],
                order_by=["start_time DESC"]
            )
            
            if not mlflow_runs:
                return True
            
            # Get the latest run
            latest_run = mlflow_runs[0]
            
            # Sync metrics
            for metric_name, metric_data in latest_run.data.metrics.items():
                metric_history = self.client.get_metric_history(latest_run.info.run_id, metric_name)
                for metric_entry in metric_history:
                    self.enhanced_tracker.log_metric(
                        experiment_id=enhanced_experiment_id,
                        metric_name=metric_name,
                        value=metric_entry.value,
                        step=metric_entry.step,
                        timestamp=datetime.fromtimestamp(metric_entry.timestamp / 1000)
                    )
            
            # Sync hyperparameters
            for param_name, param_value in latest_run.data.params.items():
                self.enhanced_tracker.log_hyperparameter(
                    experiment_id=enhanced_experiment_id,
                    param_name=param_name,
                    value=param_value
                )
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to sync with enhanced tracker for {enhanced_experiment_id}: {e}")
            return False
    
    def compare_experiments_with_mlflow(self,
                                      experiment_ids: List[str],
                                      metric_names: List[str] = None) -> Dict[str, Any]:
        """Compare experiments using both enhanced tracker and MLflow data."""
        
        comparison_data = {
            "experiment_ids": experiment_ids,
            "enhanced_comparison": None,
            "mlflow_comparison": None,
            "combined_insights": []
        }
        
        try:
            # Enhanced tracker comparison
            if self.enhanced_tracker and self.analytics_service:
                enhanced_comparison = self.analytics_service.compare_experiment_performance(
                    experiment_ids=experiment_ids,
                    comparison_metrics=metric_names
                )
                comparison_data["enhanced_comparison"] = asdict(enhanced_comparison)
            
            # MLflow comparison
            mlflow_comparison = self._compare_mlflow_experiments(experiment_ids, metric_names)
            comparison_data["mlflow_comparison"] = mlflow_comparison
            
            # Generate combined insights
            combined_insights = self._generate_combined_insights(
                comparison_data["enhanced_comparison"],
                comparison_data["mlflow_comparison"]
            )
            comparison_data["combined_insights"] = combined_insights
            
            return comparison_data
        
        except Exception as e:
            logger.error(f"Failed to compare experiments: {e}")
            comparison_data["error"] = str(e)
            return comparison_data
    
    def generate_mlflow_dashboard_url(self, enhanced_experiment_id: str) -> Optional[str]:
        """Generate MLflow dashboard URL for an enhanced experiment."""
        
        if enhanced_experiment_id not in self._experiment_mapping:
            return None
        
        mlflow_experiment_id = self._experiment_mapping[enhanced_experiment_id]
        
        # Construct dashboard URL
        base_url = self.tracking_uri
        if base_url.startswith("http"):
            dashboard_url = f"{base_url}/#/experiments/{mlflow_experiment_id}"
        else:
            dashboard_url = f"http://localhost:5000/#/experiments/{mlflow_experiment_id}"
        
        return dashboard_url
    
    def export_to_mlflow_projects(self,
                                enhanced_experiment_id: str,
                                project_path: str,
                                entry_point: str = "main") -> str:
        """Export enhanced experiment configuration to MLflow project format."""
        
        if not self.enhanced_tracker:
            raise ValueError("Enhanced tracker not available")
        
        try:
            # Create project directory
            os.makedirs(project_path, exist_ok=True)
            
            # Get enhanced experiment data
            experiment_config = self.enhanced_tracker._active_experiments.get(enhanced_experiment_id, {})
            if not experiment_config:
                raise ValueError(f"Enhanced experiment {enhanced_experiment_id} not found")
            
            # Create MLproject file
            mlproject_content = {
                "name": experiment_config.get("name", "enhanced_experiment"),
                "conda_env": "conda.yaml",
                "entry_points": {
                    entry_point: {
                        "parameters": self._extract_parameters(experiment_config),
                        "command": f"python {entry_point}.py"
                    }
                }
            }
            
            mlproject_file = os.path.join(project_path, "MLproject")
            with open(mlproject_file, 'w') as f:
                import yaml
                yaml.dump(mlproject_content, f, default_flow_style=False)
            
            # Create conda environment file
            conda_env = {
                "name": "enhanced_experiment_env",
                "channels": ["defaults", "conda-forge"],
                "dependencies": [
                    "python=3.8",
                    "pip",
                    {
                        "pip": [
                            "mlflow",
                            "numpy",
                            "pandas",
                            "scikit-learn",
                            "tensorflow",
                            "torch",
                            "scipy",
                            "matplotlib",
                            "seaborn"
                        ]
                    }
                ]
            }
            
            conda_file = os.path.join(project_path, "conda.yaml")
            with open(conda_file, 'w') as f:
                import yaml
                yaml.dump(conda_env, f, default_flow_style=False)
            
            # Create main script
            script_content = self._generate_main_script(experiment_config)
            script_file = os.path.join(project_path, f"{entry_point}.py")
            with open(script_file, 'w') as f:
                f.write(script_content)
            
            logger.info(f"Exported enhanced experiment {enhanced_experiment_id} to MLflow project at {project_path}")
            return project_path
        
        except Exception as e:
            logger.error(f"Failed to export to MLflow project: {e}")
            raise
    
    def end_enhanced_run(self, enhanced_experiment_id: str, status: str = "FINISHED") -> bool:
        """End an enhanced MLflow run with cleanup."""
        
        try:
            # End MLflow run
            if enhanced_experiment_id in self._active_runs:
                with self._get_mlflow_run_context(enhanced_experiment_id):
                    # Log final experiment insights
                    if self.enhanced_tracker:
                        try:
                            insights = self.enhanced_tracker.get_experiment_insights(enhanced_experiment_id)
                            self.log_experiment_artifacts(
                                enhanced_experiment_id,
                                {"final_insights": asdict(insights)},
                                "insights"
                            )
                        except Exception as e:
                            logger.warning(f"Could not log final insights: {e}")
                    
                    mlflow.end_run(status)
                
                # Clean up active run tracking
                del self._active_runs[enhanced_experiment_id]
                if enhanced_experiment_id in self._run_mapping:
                    del self._run_mapping[enhanced_experiment_id]
            
            # Stop synchronization thread
            self._stop_experiment_sync(enhanced_experiment_id)
            
            # Final synchronization
            self.sync_with_enhanced_tracker(enhanced_experiment_id)
            
            logger.info(f"Ended enhanced run for experiment {enhanced_experiment_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to end enhanced run for {enhanced_experiment_id}: {e}")
            return False
    
    # Context manager and helper methods
    
    @contextmanager
    def _get_mlflow_run_context(self, enhanced_experiment_id: str):
        """Get MLflow run context for an enhanced experiment."""
        if enhanced_experiment_id in self._run_mapping:
            run_id = self._run_mapping[enhanced_experiment_id]
            with mlflow.start_run(run_id=run_id, nested=True):
                yield
        else:
            # No active run, create a temporary context
            yield
    
    def _handle_sklearn_integration(self, run_config: MLflowRunConfig):
        """Handle scikit-learn specific integration."""
        if run_config.auto_log:
            mlflow.sklearn.autolog(
                log_input_examples=run_config.log_input_example,
                log_model_signatures=run_config.log_model_signature,
                log_models=True,
                disable=False,
                exclusive=False,
                disable_for_unsupported_versions=False,
                silent=False
            )
    
    def _handle_tensorflow_integration(self, run_config: MLflowRunConfig):
        """Handle TensorFlow specific integration."""
        if run_config.auto_log and tf:
            mlflow.tensorflow.autolog(
                log_models=True,
                disable=False,
                exclusive=False,
                disable_for_unsupported_versions=False,
                silent=False
            )
    
    def _handle_pytorch_integration(self, run_config: MLflowRunConfig):
        """Handle PyTorch specific integration."""
        if run_config.auto_log and torch:
            mlflow.pytorch.autolog(
                log_models=True,
                disable=False,
                exclusive=False,
                disable_for_unsupported_versions=False,
                silent=False
            )
    
    def _handle_xgboost_integration(self, run_config: MLflowRunConfig):
        """Handle XGBoost specific integration."""
        if run_config.auto_log:
            mlflow.xgboost.autolog(
                log_input_examples=run_config.log_input_example,
                log_model_signatures=run_config.log_model_signature,
                log_models=True,
                disable=False,
                exclusive=False,
                disable_for_unsupported_versions=False,
                silent=False
            )
    
    def _handle_lightgbm_integration(self, run_config: MLflowRunConfig):
        """Handle LightGBM specific integration."""
        if run_config.auto_log:
            mlflow.lightgbm.autolog(
                log_input_examples=run_config.log_input_example,
                log_model_signatures=run_config.log_model_signature,
                log_models=True,
                disable=False,
                exclusive=False,
                disable_for_unsupported_versions=False,
                silent=False
            )
    
    def _handle_catboost_integration(self, run_config: MLflowRunConfig):
        """Handle CatBoost specific integration."""
        if run_config.auto_log:
            mlflow.catboost.autolog(
                log_input_examples=run_config.log_input_example,
                log_model_signatures=run_config.log_model_signature,
                log_models=True,
                disable=False,
                exclusive=False,
                disable_for_unsupported_versions=False,
                silent=False
            )
    
    def _log_system_info(self):
        """Log system information to MLflow."""
        import platform
        import psutil
        
        system_info = {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "processor": platform.processor(),
            "architecture": platform.architecture()[0],
            "cpu_count": psutil.cpu_count(),
            "memory_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "disk_space_gb": round(psutil.disk_usage('/').total / (1024**3), 2)
        }
        
        for key, value in system_info.items():
            mlflow.set_tag(f"system.{key}", str(value))
    
    def _start_experiment_sync(self, enhanced_experiment_id: str, sync_frequency: int):
        """Start background synchronization thread."""
        if enhanced_experiment_id in self._sync_threads:
            return  # Already running
        
        stop_event = threading.Event()
        self._sync_stop_events[enhanced_experiment_id] = stop_event
        
        sync_thread = threading.Thread(
            target=self._sync_worker,
            args=(enhanced_experiment_id, sync_frequency, stop_event),
            daemon=True
        )
        sync_thread.start()
        self._sync_threads[enhanced_experiment_id] = sync_thread
        
        logger.info(f"Started sync thread for experiment {enhanced_experiment_id}")
    
    def _stop_experiment_sync(self, enhanced_experiment_id: str):
        """Stop background synchronization thread."""
        if enhanced_experiment_id in self._sync_stop_events:
            self._sync_stop_events[enhanced_experiment_id].set()
            if enhanced_experiment_id in self._sync_threads:
                self._sync_threads[enhanced_experiment_id].join(timeout=5)
                del self._sync_threads[enhanced_experiment_id]
            del self._sync_stop_events[enhanced_experiment_id]
    
    def _sync_worker(self, enhanced_experiment_id: str, sync_frequency: int, stop_event: threading.Event):
        """Background worker for experiment synchronization."""
        while not stop_event.is_set():
            try:
                self.sync_with_enhanced_tracker(enhanced_experiment_id)
                time.sleep(sync_frequency)
            except Exception as e:
                logger.error(f"Sync error for experiment {enhanced_experiment_id}: {e}")
                time.sleep(sync_frequency)  # Continue despite errors
    
    def _compare_mlflow_experiments(self, 
                                   experiment_ids: List[str], 
                                   metric_names: List[str] = None) -> Dict[str, Any]:
        """Compare MLflow experiments."""
        
        comparison = {
            "experiments": {},
            "best_experiment": None,
            "best_metrics": {},
            "metric_comparison": {}
        }
        
        try:
            for exp_id in experiment_ids:
                if exp_id not in self._experiment_mapping:
                    continue
                
                mlflow_exp_id = self._experiment_mapping[exp_id]
                runs = self.client.search_runs(
                    experiment_ids=[mlflow_exp_id],
                    order_by=["metrics.accuracy DESC"],  # Default ordering
                    max_results=1
                )
                
                if runs:
                    best_run = runs[0]
                    experiment_data = {
                        "run_id": best_run.info.run_id,
                        "metrics": dict(best_run.data.metrics),
                        "params": dict(best_run.data.params),
                        "tags": dict(best_run.data.tags)
                    }
                    comparison["experiments"][exp_id] = experiment_data
            
            # Find best experiment based on primary metric
            if comparison["experiments"] and metric_names:
                primary_metric = metric_names[0]
                best_score = -float('inf')
                
                for exp_id, exp_data in comparison["experiments"].items():
                    if primary_metric in exp_data["metrics"]:
                        score = exp_data["metrics"][primary_metric]
                        if score > best_score:
                            best_score = score
                            comparison["best_experiment"] = exp_id
                            comparison["best_metrics"] = exp_data["metrics"]
            
            return comparison
        
        except Exception as e:
            logger.error(f"MLflow experiment comparison failed: {e}")
            return comparison
    
    def _generate_combined_insights(self, 
                                  enhanced_comparison: Dict[str, Any],
                                  mlflow_comparison: Dict[str, Any]) -> List[str]:
        """Generate combined insights from both comparisons."""
        
        insights = []
        
        try:
            # Enhanced tracker insights
            if enhanced_comparison and "insights" in enhanced_comparison:
                insights.extend(enhanced_comparison["insights"])
            
            # MLflow-specific insights
            if mlflow_comparison and "best_experiment" in mlflow_comparison:
                best_exp = mlflow_comparison["best_experiment"]
                if best_exp:
                    insights.append(f"MLflow analysis confirms {best_exp} as the best performing experiment")
            
            # Cross-validation insights
            if enhanced_comparison and mlflow_comparison:
                enhanced_winner = enhanced_comparison.get("winner")
                mlflow_winner = mlflow_comparison.get("best_experiment")
                
                if enhanced_winner and mlflow_winner:
                    if enhanced_winner == mlflow_winner:
                        insights.append("Enhanced tracker and MLflow analysis agree on the best experiment")
                    else:
                        insights.append("Enhanced tracker and MLflow analysis show different best experiments - further investigation recommended")
        
        except Exception as e:
            logger.warning(f"Could not generate combined insights: {e}")
        
        return insights
    
    def _extract_parameters(self, experiment_config: Dict[str, Any]) -> Dict[str, Any]:
        """Extract parameters for MLflow project."""
        
        parameters = {}
        
        # Extract hyperparameters
        if "hyperparameters" in experiment_config:
            for param, value in experiment_config["hyperparameters"].items():
                if isinstance(value, (int, float)):
                    param_type = "float" if isinstance(value, float) else "int"
                    parameters[param] = {
                        "type": param_type,
                        "default": value
                    }
                else:
                    parameters[param] = {
                        "type": "string",
                        "default": str(value)
                    }
        
        # Add common parameters
        parameters.update({
            "experiment_id": {"type": "string", "default": ""},
            "max_training_time": {"type": "int", "default": 60},
            "optimization_budget": {"type": "int", "default": 50}
        })
        
        return parameters
    
    def _generate_main_script(self, experiment_config: Dict[str, Any]) -> str:
        """Generate main Python script for MLflow project."""
        
        script_content = '''#!/usr/bin/env python3
"""
Generated MLflow project script from enhanced experiment tracker.
"""

import os
import sys
import mlflow
import mlflow.sklearn
import argparse
from datetime import datetime

def main():
    """Main experiment execution function."""
    parser = argparse.ArgumentParser(description="Enhanced Experiment MLflow Project")
    parser.add_argument("--experiment_id", type=str, required=True, help="Experiment ID")
    parser.add_argument("--max_training_time", type=int, default=60, help="Max training time in minutes")
    parser.add_argument("--optimization_budget", type=int, default=50, help="Optimization budget")
    
    args = parser.parse_args()
    
    # Set up MLflow
    mlflow.set_experiment("Enhanced_Experiment_Project")
    
    with mlflow.start_run():
        # Log parameters
        mlflow.log_param("experiment_id", args.experiment_id)
        mlflow.log_param("max_training_time", args.max_training_time)
        mlflow.log_param("optimization_budget", args.optimization_budget)
        mlflow.log_param("generated_at", datetime.utcnow().isoformat())
        
        # Placeholder for experiment logic
        # This would be replaced with actual experiment code
        print(f"Running enhanced experiment {args.experiment_id}")
        
        # Log sample metrics
        mlflow.log_metric("accuracy", 0.85)
        mlflow.log_metric("f1_score", 0.83)
        
        print("Experiment completed successfully")

if __name__ == "__main__":
    main()
'''
        
        return script_content
    
    def cleanup(self):
        """Clean up resources and stop all background processes."""
        
        # Stop all sync threads
        for enhanced_experiment_id in list(self._sync_stop_events.keys()):
            self._stop_experiment_sync(enhanced_experiment_id)
        
        # End all active runs
        for enhanced_experiment_id in list(self._active_runs.keys()):
            self.end_enhanced_run(enhanced_experiment_id, status="KILLED")
        
        logger.info("Enhanced MLflow integration cleanup completed")


# Utility functions for easy integration

def create_enhanced_mlflow_integration(
    enhanced_tracker: EnhancedExperimentTracker = None,
    analytics_service: ExperimentAnalyticsService = None,
    tracking_uri: str = None,
    artifact_location: str = None
) -> EnhancedMLflowIntegration:
    """Factory function to create enhanced MLflow integration."""
    
    return EnhancedMLflowIntegration(
        enhanced_tracker=enhanced_tracker,
        analytics_service=analytics_service,
        tracking_uri=tracking_uri,
        artifact_location=artifact_location
    )


def setup_auto_mlflow_logging(framework: str, 
                             log_models: bool = True,
                             log_input_examples: bool = True,
                             log_model_signatures: bool = True) -> bool:
    """Set up automatic MLflow logging for a specific framework."""
    
    if not MLFLOW_AVAILABLE:
        logger.warning("MLflow not available for auto-logging")
        return False
    
    try:
        if framework.lower() == 'sklearn':
            mlflow.sklearn.autolog(
                log_input_examples=log_input_examples,
                log_model_signatures=log_model_signatures,
                log_models=log_models
            )
        elif framework.lower() == 'tensorflow':
            mlflow.tensorflow.autolog(log_models=log_models)
        elif framework.lower() == 'pytorch':
            mlflow.pytorch.autolog(log_models=log_models)
        elif framework.lower() == 'xgboost':
            mlflow.xgboost.autolog(
                log_input_examples=log_input_examples,
                log_model_signatures=log_model_signatures,
                log_models=log_models
            )
        elif framework.lower() == 'lightgbm':
            mlflow.lightgbm.autolog(
                log_input_examples=log_input_examples,
                log_model_signatures=log_model_signatures,
                log_models=log_models
            )
        else:
            logger.warning(f"Auto-logging not supported for framework: {framework}")
            return False
        
        logger.info(f"Auto-logging enabled for {framework}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to set up auto-logging for {framework}: {e}")
        return False