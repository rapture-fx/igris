"""
Enhanced Machine Learning Service with Deep Learning and Advanced Ensemble Integration

This service integrates the AdvancedMLModelingEngine with the existing Schlep-engine architecture,
providing comprehensive ML capabilities including:
- Deep learning model training and inference
- Advanced ensemble methods
- Industrial-specific model architectures
- Automated model selection and optimization
- Production-ready model serving and monitoring
- Integration with existing data pipelines and workers
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union
import logging
import os
import json
import asyncio
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import warnings
warnings.filterwarnings('ignore')

# Import the advanced modeling engine
from ..ml.advanced_modeling_engine import (
    AdvancedMLModelingEngine, 
    create_sensor_fusion_model,
    create_predictive_maintenance_pipeline,
    create_quality_control_model
)

# Import existing ML components
from ..ml.models import ManufacturingPredictorModel
from ..ml.utils import validate_data_quality, prepare_time_series_features
from ..ml.pipelines import DataPreprocessingPipeline

logger = logging.getLogger(__name__)


class ModelType(Enum):
    """Enumeration of available model types."""
    DEEP_LEARNING = "deep_learning"
    ENSEMBLE = "ensemble"
    TRADITIONAL = "traditional"
    SENSOR_FUSION = "sensor_fusion"
    PREDICTIVE_MAINTENANCE = "predictive_maintenance"
    QUALITY_CONTROL = "quality_control"
    AUTO_SELECT = "auto"


class TrainingStatus(Enum):
    """Training status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ModelTrainingRequest:
    """Model training request configuration."""
    dataset_id: str
    target_column: str
    model_type: ModelType
    task_type: str = "auto"  # auto, classification, regression
    optimization_budget: int = 50
    validation_split: float = 0.2
    feature_columns: Optional[List[str]] = None
    hyperparameters: Optional[Dict[str, Any]] = None
    callbacks: Optional[List[str]] = None
    tags: Optional[Dict[str, str]] = None


@dataclass
class ModelTrainingResult:
    """Model training result container."""
    model_id: str
    training_request: ModelTrainingRequest
    status: TrainingStatus
    model_key: str
    performance_metrics: Dict[str, Any]
    training_time: float
    model_size_mb: float
    feature_importance: Dict[str, float]
    model_architecture: str
    framework: str
    created_at: datetime
    error_message: Optional[str] = None


@dataclass
class PredictionRequest:
    """Prediction request configuration."""
    model_id: str
    input_data: pd.DataFrame
    return_uncertainty: bool = True
    return_explanations: bool = True
    batch_size: Optional[int] = None


@dataclass
class PredictionResult:
    """Prediction result container."""
    model_id: str
    predictions: List[Union[float, int, str]]
    uncertainty_scores: Optional[List[float]] = None
    feature_importance: Optional[Dict[str, float]] = None
    confidence_intervals: Optional[List[Tuple[float, float]]] = None
    model_performance: Optional[Dict[str, Any]] = None
    prediction_time: float = 0.0
    created_at: datetime = None


class EnhancedMLService:
    """
    Enhanced ML Service providing comprehensive machine learning capabilities.
    
    Features:
    - Advanced model training with multiple frameworks
    - Automated model selection and hyperparameter optimization
    - Industrial-specific model architectures
    - Real-time prediction serving
    - Model performance monitoring
    - Integration with existing data processing pipelines
    """
    
    def __init__(self, models_directory: str = None, max_concurrent_training: int = 3):
        self.models_directory = models_directory or "/tmp/schlep_models"
        self.max_concurrent_training = max_concurrent_training
        
        # Initialize core components
        self.modeling_engine = AdvancedMLModelingEngine()
        self.preprocessing_pipeline = DataPreprocessingPipeline()
        
        # Model registry and tracking
        self.model_registry: Dict[str, ModelTrainingResult] = {}
        self.active_training_jobs: Dict[str, asyncio.Task] = {}
        self.model_cache: Dict[str, Any] = {}
        
        # Performance monitoring
        self.performance_history: Dict[str, List[Dict[str, Any]]] = {}
        self.prediction_logs: List[Dict[str, Any]] = []
        
        # Ensure models directory exists
        os.makedirs(self.models_directory, exist_ok=True)
        
        # Load existing models
        self._load_model_registry()
        
        logger.info(f"Enhanced ML Service initialized with models directory: {self.models_directory}")
    
    async def train_model_async(self, request: ModelTrainingRequest) -> str:
        """
        Asynchronously train a model based on the provided request.
        
        Args:
            request: Model training configuration
            
        Returns:
            Model ID for tracking training progress
        """
        model_id = self._generate_model_id(request)
        
        # Check if already training
        if model_id in self.active_training_jobs:
            raise ValueError(f"Model {model_id} is already being trained")
        
        # Check concurrent training limit
        if len(self.active_training_jobs) >= self.max_concurrent_training:
            raise RuntimeError(f"Maximum concurrent training jobs ({self.max_concurrent_training}) reached")
        
        # Create training result placeholder
        training_result = ModelTrainingResult(
            model_id=model_id,
            training_request=request,
            status=TrainingStatus.PENDING,
            model_key="",
            performance_metrics={},
            training_time=0.0,
            model_size_mb=0.0,
            feature_importance={},
            model_architecture="",
            framework="",
            created_at=datetime.now()
        )
        
        self.model_registry[model_id] = training_result
        
        # Start async training
        training_task = asyncio.create_task(self._train_model_internal(model_id, request))
        self.active_training_jobs[model_id] = training_task
        
        logger.info(f"Started async training for model {model_id}")
        return model_id
    
    def train_model_sync(self, request: ModelTrainingRequest) -> ModelTrainingResult:
        """
        Synchronously train a model and return results.
        
        Args:
            request: Model training configuration
            
        Returns:
            Complete training results
        """
        model_id = self._generate_model_id(request)
        
        # Run training synchronously
        result = asyncio.run(self._train_model_internal(model_id, request))
        return result
    
    async def _train_model_internal(self, model_id: str, request: ModelTrainingRequest) -> ModelTrainingResult:
        """Internal async model training implementation."""
        start_time = datetime.now()
        
        try:
            # Update status to running
            self.model_registry[model_id].status = TrainingStatus.RUNNING
            
            # Load and validate data
            logger.info(f"Loading data for model {model_id}")
            data = await self._load_training_data(request.dataset_id)
            
            if data is None or data.empty:
                raise ValueError(f"No data found for dataset {request.dataset_id}")
            
            # Validate data quality
            data_quality_report = validate_data_quality(data)
            if not data_quality_report.get('is_valid', True):
                logger.warning(f"Data quality issues detected: {data_quality_report.get('issues', [])}")
            
            # Preprocess data
            logger.info(f"Preprocessing data for model {model_id}")
            processed_data = self._preprocess_training_data(data, request)
            
            # Train model based on type
            training_results = await self._execute_training(model_id, processed_data, request)
            
            # Calculate training metrics
            training_time = (datetime.now() - start_time).total_seconds()
            model_size_mb = self._calculate_model_size(training_results.get('best_model'))
            
            # Update training result
            self.model_registry[model_id].status = TrainingStatus.COMPLETED
            self.model_registry[model_id].model_key = training_results.get('model_key', '')
            self.model_registry[model_id].performance_metrics = training_results.get('performance', {})
            self.model_registry[model_id].training_time = training_time
            self.model_registry[model_id].model_size_mb = model_size_mb
            self.model_registry[model_id].feature_importance = training_results.get('feature_importance', {})
            self.model_registry[model_id].model_architecture = training_results.get('model_type', 'unknown')
            self.model_registry[model_id].framework = training_results.get('framework', 'sklearn')
            
            # Save model
            await self._save_model(model_id, training_results)
            
            # Save registry
            self._save_model_registry()
            
            logger.info(f"Model {model_id} training completed successfully in {training_time:.2f}s")
            
        except Exception as e:
            # Handle training failure
            logger.error(f"Model {model_id} training failed: {str(e)}")
            
            self.model_registry[model_id].status = TrainingStatus.FAILED
            self.model_registry[model_id].error_message = str(e)
            self.model_registry[model_id].training_time = (datetime.now() - start_time).total_seconds()
            
            self._save_model_registry()
            raise e
        
        finally:
            # Clean up active job
            if model_id in self.active_training_jobs:
                del self.active_training_jobs[model_id]
        
        return self.model_registry[model_id]
    
    async def _execute_training(self, model_id: str, data: pd.DataFrame, 
                               request: ModelTrainingRequest) -> Dict[str, Any]:
        """Execute the actual model training based on model type."""
        
        if request.model_type == ModelType.SENSOR_FUSION:
            return await self._train_sensor_fusion_model(data, request)
        
        elif request.model_type == ModelType.PREDICTIVE_MAINTENANCE:
            return await self._train_predictive_maintenance_model(data, request)
        
        elif request.model_type == ModelType.QUALITY_CONTROL:
            return await self._train_quality_control_model(data, request)
        
        elif request.model_type in [ModelType.DEEP_LEARNING, ModelType.ENSEMBLE, 
                                  ModelType.TRADITIONAL, ModelType.AUTO_SELECT]:
            return await self._train_general_model(data, request)
        
        else:
            raise ValueError(f"Unknown model type: {request.model_type}")
    
    async def _train_general_model(self, data: pd.DataFrame, 
                                  request: ModelTrainingRequest) -> Dict[str, Any]:
        """Train general-purpose model using the advanced modeling engine."""
        model_type = request.model_type.value if request.model_type != ModelType.AUTO_SELECT else 'auto'
        
        # Use the advanced modeling engine
        training_results = self.modeling_engine.train_industrial_model(
            data=data,
            target_column=request.target_column,
            model_type=model_type,
            task_type=request.task_type,
            optimization_budget=request.optimization_budget
        )
        
        return training_results
    
    async def _train_sensor_fusion_model(self, data: pd.DataFrame,
                                        request: ModelTrainingRequest) -> Dict[str, Any]:
        """Train sensor fusion model for multi-sensor data."""
        
        # Identify sensor columns (assuming they're prefixed or categorized)
        sensor_columns = [col for col in data.columns 
                         if col != request.target_column and 
                         ('sensor' in col.lower() or 'temp' in col.lower() or 
                          'pressure' in col.lower() or 'vibration' in col.lower())]
        
        if len(sensor_columns) < 2:
            raise ValueError("Sensor fusion requires at least 2 sensor columns")
        
        # Group sensors by type
        sensor_configs = {}
        for col in sensor_columns:
            sensor_type = col.split('_')[0] if '_' in col else col
            if sensor_type not in sensor_configs:
                sensor_configs[sensor_type] = {'shape': (1,), 'columns': []}
            sensor_configs[sensor_type]['columns'].append(col)
        
        # Configure output shape
        target_values = data[request.target_column].nunique()
        is_classification = request.task_type == 'classification' or target_values < 20
        sensor_configs['output_shape'] = target_values if is_classification else 1
        sensor_configs['task_type'] = 'classification' if is_classification else 'regression'
        
        # Create and train sensor fusion model
        sensor_fusion_arch = create_sensor_fusion_model(sensor_configs)
        
        # Prepare data for sensor fusion
        X_sensors = {}
        for sensor_type, config in sensor_configs.items():
            if 'columns' in config:
                X_sensors[sensor_type] = data[config['columns']].values
        
        y = data[request.target_column].values
        
        # Train the model
        if X_sensors:
            X_combined = np.concatenate(list(X_sensors.values()), axis=1)
            training_history = sensor_fusion_arch.train(
                X_combined, y, 
                task_type=sensor_configs['task_type'],
                epochs=100,
                validation_split=request.validation_split
            )
        
        return {
            'best_model': sensor_fusion_arch,
            'model_key': f"sensor_fusion_{request.target_column}",
            'performance': training_history,
            'model_type': 'sensor_fusion',
            'framework': 'tensorflow',
            'sensor_configs': sensor_configs
        }
    
    async def _train_predictive_maintenance_model(self, data: pd.DataFrame,
                                                 request: ModelTrainingRequest) -> Dict[str, Any]:
        """Train predictive maintenance model."""
        
        # Detect time column
        time_columns = [col for col in data.columns 
                       if 'time' in col.lower() or 'date' in col.lower() or 'timestamp' in col.lower()]
        time_column = time_columns[0] if time_columns else None
        
        # Use factory function for predictive maintenance
        pm_pipeline = create_predictive_maintenance_pipeline(
            data=data,
            failure_column=request.target_column,
            time_column=time_column
        )
        
        return pm_pipeline['training_results']
    
    async def _train_quality_control_model(self, data: pd.DataFrame,
                                          request: ModelTrainingRequest) -> Dict[str, Any]:
        """Train quality control model."""
        
        # Identify sensor/measurement columns for quality control
        sensor_columns = request.feature_columns or [
            col for col in data.columns 
            if col != request.target_column and 
            any(keyword in col.lower() for keyword in 
                ['sensor', 'measure', 'temp', 'pressure', 'dimension', 'thickness'])
        ]
        
        if not sensor_columns:
            # Use all numeric columns except target
            sensor_columns = [col for col in data.select_dtypes(include=[np.number]).columns 
                            if col != request.target_column]
        
        # Use factory function for quality control
        qc_model = create_quality_control_model(
            data=data,
            defect_column=request.target_column,
            sensor_columns=sensor_columns
        )
        
        return qc_model['training_results']
    
    async def predict_async(self, request: PredictionRequest) -> PredictionResult:
        """
        Make async predictions using a trained model.
        
        Args:
            request: Prediction request configuration
            
        Returns:
            Prediction results with uncertainty and explanations
        """
        start_time = datetime.now()
        
        # Validate model exists
        if request.model_id not in self.model_registry:
            raise ValueError(f"Model {request.model_id} not found")
        
        model_info = self.model_registry[request.model_id]
        
        if model_info.status != TrainingStatus.COMPLETED:
            raise ValueError(f"Model {request.model_id} is not ready for prediction. Status: {model_info.status}")
        
        # Load model if not cached
        if request.model_id not in self.model_cache:
            await self._load_model_to_cache(request.model_id)
        
        # Make predictions
        try:
            predictions_result = self.modeling_engine.predict_industrial_outcome(
                data=request.input_data,
                model_key=model_info.model_key,
                return_uncertainty=request.return_uncertainty
            )
            
            # Create result object
            prediction_time = (datetime.now() - start_time).total_seconds()
            
            result = PredictionResult(
                model_id=request.model_id,
                predictions=predictions_result['predictions'],
                uncertainty_scores=predictions_result.get('uncertainty'),
                feature_importance=predictions_result.get('feature_importance'),
                model_performance=predictions_result.get('model_performance'),
                prediction_time=prediction_time,
                created_at=datetime.now()
            )
            
            # Log prediction for monitoring
            self._log_prediction(request, result)
            
            logger.info(f"Prediction completed for model {request.model_id} in {prediction_time:.3f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Prediction failed for model {request.model_id}: {str(e)}")
            raise e
    
    def predict_sync(self, request: PredictionRequest) -> PredictionResult:
        """
        Synchronously make predictions using a trained model.
        
        Args:
            request: Prediction request configuration
            
        Returns:
            Prediction results
        """
        return asyncio.run(self.predict_async(request))
    
    def get_model_status(self, model_id: str) -> Dict[str, Any]:
        """Get detailed status of a model."""
        if model_id not in self.model_registry:
            raise ValueError(f"Model {model_id} not found")
        
        model_info = self.model_registry[model_id]
        
        status_info = asdict(model_info)
        status_info['is_training'] = model_id in self.active_training_jobs
        status_info['is_cached'] = model_id in self.model_cache
        
        # Add performance history if available
        if model_id in self.performance_history:
            status_info['performance_history'] = self.performance_history[model_id][-10:]  # Last 10 entries
        
        return status_info
    
    def list_models(self, status_filter: Optional[TrainingStatus] = None,
                   model_type_filter: Optional[ModelType] = None) -> List[Dict[str, Any]]:
        """List all models with optional filtering."""
        models = []
        
        for model_id, model_info in self.model_registry.items():
            # Apply filters
            if status_filter and model_info.status != status_filter:
                continue
            
            if model_type_filter and model_info.training_request.model_type != model_type_filter:
                continue
            
            model_summary = {
                'model_id': model_id,
                'status': model_info.status.value,
                'model_type': model_info.training_request.model_type.value,
                'target_column': model_info.training_request.target_column,
                'performance_score': model_info.performance_metrics.get('best_score', 0.0),
                'training_time': model_info.training_time,
                'created_at': model_info.created_at.isoformat(),
                'is_cached': model_id in self.model_cache
            }
            
            models.append(model_summary)
        
        # Sort by creation time (newest first)
        models.sort(key=lambda x: x['created_at'], reverse=True)
        
        return models
    
    def delete_model(self, model_id: str, remove_files: bool = True) -> bool:
        """Delete a model from registry and optionally remove files."""
        if model_id not in self.model_registry:
            raise ValueError(f"Model {model_id} not found")
        
        # Stop training if in progress
        if model_id in self.active_training_jobs:
            self.active_training_jobs[model_id].cancel()
            del self.active_training_jobs[model_id]
        
        # Remove from cache
        if model_id in self.model_cache:
            del self.model_cache[model_id]
        
        # Remove from performance history
        if model_id in self.performance_history:
            del self.performance_history[model_id]
        
        # Remove files if requested
        if remove_files:
            model_path = os.path.join(self.models_directory, f"{model_id}.joblib")
            if os.path.exists(model_path):
                os.remove(model_path)
        
        # Remove from registry
        del self.model_registry[model_id]
        
        # Save updated registry
        self._save_model_registry()
        
        logger.info(f"Model {model_id} deleted successfully")
        return True
    
    def get_service_statistics(self) -> Dict[str, Any]:
        """Get comprehensive service statistics."""
        total_models = len(self.model_registry)
        completed_models = len([m for m in self.model_registry.values() 
                               if m.status == TrainingStatus.COMPLETED])
        failed_models = len([m for m in self.model_registry.values() 
                            if m.status == TrainingStatus.FAILED])
        active_training = len(self.active_training_jobs)
        
        # Calculate average performance
        completed_model_scores = [
            m.performance_metrics.get('best_score', 0.0) 
            for m in self.model_registry.values() 
            if m.status == TrainingStatus.COMPLETED and m.performance_metrics.get('best_score')
        ]
        
        avg_performance = np.mean(completed_model_scores) if completed_model_scores else 0.0
        
        # Framework usage statistics
        framework_counts = {}
        model_type_counts = {}
        
        for model_info in self.model_registry.values():
            framework = model_info.framework or 'unknown'
            framework_counts[framework] = framework_counts.get(framework, 0) + 1
            
            model_type = model_info.training_request.model_type.value
            model_type_counts[model_type] = model_type_counts.get(model_type, 0) + 1
        
        return {
            'total_models': total_models,
            'completed_models': completed_models,
            'failed_models': failed_models,
            'active_training_jobs': active_training,
            'success_rate': completed_models / total_models if total_models > 0 else 0.0,
            'average_performance': avg_performance,
            'cached_models': len(self.model_cache),
            'framework_distribution': framework_counts,
            'model_type_distribution': model_type_counts,
            'total_predictions': len(self.prediction_logs),
            'models_directory': self.models_directory,
            'max_concurrent_training': self.max_concurrent_training
        }
    
    def optimize_ensemble_for_dataset(self, dataset_id: str, target_column: str,
                                    ensemble_methods: List[str] = None,
                                    optimization_budget: int = 100) -> Dict[str, Any]:
        """
        Optimize ensemble model for a specific dataset.
        
        Args:
            dataset_id: Dataset identifier
            target_column: Target variable column
            ensemble_methods: List of ensemble methods to try
            optimization_budget: Budget for optimization
            
        Returns:
            Ensemble optimization results
        """
        logger.info(f"Starting ensemble optimization for dataset {dataset_id}")
        
        # Load data
        data = asyncio.run(self._load_training_data(dataset_id))
        if data is None or data.empty:
            raise ValueError(f"No data found for dataset {dataset_id}")
        
        # Run ensemble optimization
        ensemble_results = self.modeling_engine.optimize_model_ensemble(
            data=data,
            target_column=target_column,
            ensemble_methods=ensemble_methods,
            optimization_budget=optimization_budget
        )
        
        # Create model entry for best ensemble
        if ensemble_results.get('best_ensemble'):
            request = ModelTrainingRequest(
                dataset_id=dataset_id,
                target_column=target_column,
                model_type=ModelType.ENSEMBLE,
                optimization_budget=optimization_budget
            )
            
            model_id = self._generate_model_id(request)
            
            training_result = ModelTrainingResult(
                model_id=model_id,
                training_request=request,
                status=TrainingStatus.COMPLETED,
                model_key=f"{target_column}_ensemble_{ensemble_results['best_ensemble']}",
                performance_metrics={'best_score': ensemble_results['best_ensemble_score']},
                training_time=0.0,  # Optimization time not tracked separately
                model_size_mb=0.0,
                feature_importance={},
                model_architecture=f"ensemble_{ensemble_results['best_ensemble']}",
                framework="sklearn",
                created_at=datetime.now()
            )
            
            self.model_registry[model_id] = training_result
            self._save_model_registry()
            
            ensemble_results['model_id'] = model_id
        
        logger.info(f"Ensemble optimization completed. Best ensemble: {ensemble_results.get('best_ensemble')}")
        
        return ensemble_results
    
    # Private helper methods
    
    def _generate_model_id(self, request: ModelTrainingRequest) -> str:
        """Generate unique model ID based on request parameters."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_type = request.model_type.value
        target_hash = abs(hash(request.target_column)) % 1000
        return f"{model_type}_{request.dataset_id}_{target_hash}_{timestamp}"
    
    async def _load_training_data(self, dataset_id: str) -> Optional[pd.DataFrame]:
        """Load training data for a given dataset ID."""
        # This would typically interface with your data storage system
        # For now, return None to indicate data should be provided externally
        logger.warning(f"Data loading not implemented for dataset {dataset_id}. Please provide data directly.")
        return None
    
    def _preprocess_training_data(self, data: pd.DataFrame, 
                                 request: ModelTrainingRequest) -> pd.DataFrame:
        """Preprocess training data based on request configuration."""
        processed_data = data.copy()
        
        # Apply basic preprocessing
        processed_data = self.preprocessing_pipeline.clean_data(processed_data)
        
        # Feature selection if specified
        if request.feature_columns:
            available_features = [col for col in request.feature_columns if col in processed_data.columns]
            if request.target_column not in available_features:
                available_features.append(request.target_column)
            processed_data = processed_data[available_features]
        
        return processed_data
    
    def _calculate_model_size(self, model) -> float:
        """Calculate approximate model size in MB."""
        try:
            import sys
            return sys.getsizeof(model) / (1024 * 1024)
        except:
            return 0.0
    
    async def _save_model(self, model_id: str, training_results: Dict[str, Any]):
        """Save trained model to disk."""
        model_path = os.path.join(self.models_directory, f"{model_id}.joblib")
        
        # Store in modeling engine
        if 'best_model' in training_results and 'model_key' in training_results:
            # Model is already stored in the modeling engine
            pass
        
        # Save additional metadata
        metadata_path = os.path.join(self.models_directory, f"{model_id}_metadata.json")
        metadata = {
            'model_id': model_id,
            'training_results': {k: v for k, v in training_results.items() 
                               if k not in ['best_model']},  # Exclude model object
            'saved_at': datetime.now().isoformat()
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
    
    async def _load_model_to_cache(self, model_id: str):
        """Load model to cache for faster predictions."""
        if model_id not in self.model_registry:
            raise ValueError(f"Model {model_id} not found in registry")
        
        # The model is already loaded in the modeling engine
        # Just mark as cached
        self.model_cache[model_id] = True
    
    def _log_prediction(self, request: PredictionRequest, result: PredictionResult):
        """Log prediction for monitoring and analytics."""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'model_id': request.model_id,
            'num_predictions': len(result.predictions),
            'prediction_time': result.prediction_time,
            'has_uncertainty': result.uncertainty_scores is not None,
            'has_explanations': result.feature_importance is not None
        }
        
        self.prediction_logs.append(log_entry)
        
        # Keep only last 1000 prediction logs
        if len(self.prediction_logs) > 1000:
            self.prediction_logs = self.prediction_logs[-1000:]
    
    def _save_model_registry(self):
        """Save model registry to disk."""
        registry_path = os.path.join(self.models_directory, "model_registry.json")
        
        # Convert registry to serializable format
        registry_data = {}
        for model_id, model_info in self.model_registry.items():
            registry_data[model_id] = asdict(model_info)
            # Convert datetime objects to strings
            registry_data[model_id]['created_at'] = model_info.created_at.isoformat()
            # Convert enums to strings
            registry_data[model_id]['status'] = model_info.status.value
            registry_data[model_id]['training_request']['model_type'] = model_info.training_request.model_type.value
        
        with open(registry_path, 'w') as f:
            json.dump(registry_data, f, indent=2, default=str)
    
    def _load_model_registry(self):
        """Load model registry from disk."""
        registry_path = os.path.join(self.models_directory, "model_registry.json")
        
        if not os.path.exists(registry_path):
            logger.info("No existing model registry found. Starting with empty registry.")
            return
        
        try:
            with open(registry_path, 'r') as f:
                registry_data = json.load(f)
            
            for model_id, model_data in registry_data.items():
                # Convert back to proper types
                model_data['created_at'] = datetime.fromisoformat(model_data['created_at'])
                model_data['status'] = TrainingStatus(model_data['status'])
                model_data['training_request']['model_type'] = ModelType(model_data['training_request']['model_type'])
                
                # Create training request object
                training_request = ModelTrainingRequest(**model_data['training_request'])
                
                # Create model training result
                model_info = ModelTrainingResult(
                    model_id=model_id,
                    training_request=training_request,
                    status=model_data['status'],
                    model_key=model_data['model_key'],
                    performance_metrics=model_data['performance_metrics'],
                    training_time=model_data['training_time'],
                    model_size_mb=model_data['model_size_mb'],
                    feature_importance=model_data['feature_importance'],
                    model_architecture=model_data['model_architecture'],
                    framework=model_data['framework'],
                    created_at=model_data['created_at'],
                    error_message=model_data.get('error_message')
                )
                
                self.model_registry[model_id] = model_info
            
            logger.info(f"Loaded {len(self.model_registry)} models from registry")
            
        except Exception as e:
            logger.error(f"Failed to load model registry: {e}")
            self.model_registry = {}


# Factory functions for common use cases

def create_enhanced_ml_service(models_directory: str = None,
                              max_concurrent_training: int = 3) -> EnhancedMLService:
    """Factory function to create Enhanced ML Service."""
    return EnhancedMLService(
        models_directory=models_directory,
        max_concurrent_training=max_concurrent_training
    )


def create_predictive_maintenance_service(models_directory: str = None) -> EnhancedMLService:
    """Factory function to create service optimized for predictive maintenance."""
    service = EnhancedMLService(models_directory=models_directory)
    
    # Pre-configure for predictive maintenance use cases
    service.default_model_type = ModelType.PREDICTIVE_MAINTENANCE
    
    return service


def create_quality_control_service(models_directory: str = None) -> EnhancedMLService:
    """Factory function to create service optimized for quality control."""
    service = EnhancedMLService(models_directory=models_directory)
    
    # Pre-configure for quality control use cases
    service.default_model_type = ModelType.QUALITY_CONTROL
    
    return service


# Integration helpers for existing services

class MLServiceIntegration:
    """Helper class for integrating Enhanced ML Service with existing services."""
    
    def __init__(self, enhanced_ml_service: EnhancedMLService):
        self.ml_service = enhanced_ml_service
    
    def integrate_with_manufacturing_processor(self, manufacturing_processor):
        """Integrate with existing manufacturing processor service."""
        # Add ML capabilities to manufacturing processor
        manufacturing_processor.ml_service = self.ml_service
        
        # Add method to predict equipment failures
        def predict_equipment_failure(sensor_data: pd.DataFrame, equipment_id: str):
            request = PredictionRequest(
                model_id=f"predictive_maintenance_{equipment_id}",
                input_data=sensor_data,
                return_uncertainty=True
            )
            return self.ml_service.predict_sync(request)
        
        manufacturing_processor.predict_equipment_failure = predict_equipment_failure
    
    def integrate_with_data_quality_service(self, data_quality_service):
        """Integrate with existing data quality service."""
        # Add ML-based data quality scoring
        def ml_quality_score(data: pd.DataFrame):
            # Use trained model to assess data quality
            quality_scores = {}
            
            # Check if quality control model exists
            quality_models = [m for m in self.ml_service.list_models() 
                            if 'quality' in m['model_id'].lower()]
            
            if quality_models:
                request = PredictionRequest(
                    model_id=quality_models[0]['model_id'],
                    input_data=data,
                    return_uncertainty=True
                )
                result = self.ml_service.predict_sync(request)
                quality_scores['ml_quality_score'] = np.mean(result.predictions)
                quality_scores['uncertainty'] = np.mean(result.uncertainty_scores or [0.5])
            
            return quality_scores
        
        data_quality_service.ml_quality_score = ml_quality_score
    
    def create_celery_tasks(self):
        """Create Celery tasks for background ML processing."""
        from celery import Celery
        
        # This would be integrated with your existing Celery setup
        tasks = {}
        
        def train_model_task(request_dict: Dict):
            """Celery task for background model training."""
            request = ModelTrainingRequest(**request_dict)
            return self.ml_service.train_model_sync(request)
        
        def predict_batch_task(model_id: str, data_dict: Dict):
            """Celery task for batch predictions."""
            data = pd.DataFrame(data_dict)
            request = PredictionRequest(model_id=model_id, input_data=data)
            return self.ml_service.predict_sync(request)
        
        tasks['train_model'] = train_model_task
        tasks['predict_batch'] = predict_batch_task
        
        return tasks