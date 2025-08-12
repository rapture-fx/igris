"""
Celery Background Tasks for ML Workloads
Advanced ML processing tasks for manufacturing, e-commerce, and financial applications
"""

from celery import Celery, Task
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Union
import logging
import traceback
from datetime import datetime, timedelta
import redis
import json
import time

# Import ML modules
from ..ml.feature_engineering import (
    SensorDataFeatureEngine, 
    ColdStartFeatureEngine, 
    RareEventFeatureEngine
)
from ..ml.models import (
    ManufacturingPredictorModel,
    EcommerceRecommendationModel, 
    FinancialRareEventModel
)
from ..ml.pipelines import (
    ManufacturingPipeline,
    EcommercePipeline,
    FinancialPipeline,
    PipelineFactory
)
from ..ml.utils import (
    MemoryEfficientProcessor,
    StreamingProcessor,
    FeatureCache,
    MLPerformanceMonitor,
    optimize_ml_pipeline
)

logger = logging.getLogger(__name__)

# Configure Celery app (assuming this is imported where Celery is configured)
# celery_app = Celery('ml_tasks')

class MLBaseTask(Task):
    """Base task class for ML operations with error handling and monitoring."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        logger.error(f"ML Task {task_id} failed: {exc}")
        logger.error(f"Traceback: {einfo}")
        
        # Store failure information for debugging
        failure_info = {
            "task_id": task_id,
            "task_name": self.name,
            "error": str(exc),
            "traceback": str(einfo),
            "args": str(args)[:1000],  # Limit size
            "kwargs": str(kwargs)[:1000],
            "timestamp": datetime.now().isoformat()
        }
        
        # Log to monitoring system
        self._log_task_failure(failure_info)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success."""
        logger.info(f"ML Task {task_id} completed successfully")
        
        # Log success metrics
        success_info = {
            "task_id": task_id,
            "task_name": self.name,
            "processing_time": getattr(retval, 'processing_time', None),
            "timestamp": datetime.now().isoformat()
        }
        
        self._log_task_success(success_info)
    
    def _log_task_failure(self, failure_info: Dict):
        """Log task failure to monitoring system."""
        try:
            # Implementation depends on your monitoring setup
            logger.error(f"Task failure logged: {failure_info['task_id']}")
        except Exception as e:
            logger.error(f"Failed to log task failure: {e}")
    
    def _log_task_success(self, success_info: Dict):
        """Log task success to monitoring system."""
        try:
            # Implementation depends on your monitoring setup
            logger.info(f"Task success logged: {success_info['task_id']}")
        except Exception as e:
            logger.error(f"Failed to log task success: {e}")


# Manufacturing ML Tasks
# @celery_app.task(base=MLBaseTask, bind=True)
def process_manufacturing_data(self, data_path: str, 
                             sensor_columns: List[str],
                             processing_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process manufacturing sensor data through the complete ML pipeline.
    
    Args:
        data_path: Path to the manufacturing data file
        sensor_columns: List of sensor column names
        processing_options: Additional processing configuration
        
    Returns:
        Processing results including predictions and health assessment
    """
    try:
        logger.info(f"Starting manufacturing data processing task: {self.request.id}")
        
        # Load data
        data = pd.read_csv(data_path) if data_path.endswith('.csv') else pd.read_parquet(data_path)
        
        # Initialize pipeline
        pipeline = ManufacturingPipeline()
        
        # Process data
        processing_kwargs = {
            "sensor_columns": sensor_columns,
            "sensor_metadata": processing_options.get("sensor_metadata"),
            "timestamp_column": processing_options.get("timestamp_column"),
            "equipment_metadata": processing_options.get("equipment_metadata")
        }
        
        results = pipeline.process(data, **processing_kwargs)
        
        # Generate predictions if model is available
        if processing_options.get("generate_predictions", False):
            prediction_results = generate_manufacturing_predictions.delay(
                data_path, sensor_columns, processing_options
            )
            results["prediction_task_id"] = prediction_results.id
        
        logger.info(f"Manufacturing data processing completed: {self.request.id}")
        return results
        
    except Exception as e:
        logger.error(f"Manufacturing processing failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def generate_manufacturing_predictions(self, data_path: str,
                                     sensor_columns: List[str],
                                     prediction_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Generate predictions for manufacturing sensor data.
    
    Args:
        data_path: Path to the sensor data
        sensor_columns: List of sensor columns
        prediction_options: Prediction configuration
        
    Returns:
        Prediction results with confidence intervals
    """
    try:
        logger.info(f"Starting manufacturing predictions task: {self.request.id}")
        
        # Load data
        data = pd.read_csv(data_path) if data_path.endswith('.csv') else pd.read_parquet(data_path)
        
        # Initialize model
        model = ManufacturingPredictorModel(
            prediction_horizon=prediction_options.get("prediction_horizon", 10),
            model_type=prediction_options.get("model_type", "ensemble")
        )
        
        # Load or train model
        model_path = prediction_options.get("model_path")
        if model_path:
            # Load existing model
            from ..ml.models import load_model
            loaded_model, metadata = load_model(model_path)
            model = loaded_model
        else:
            # Train new model
            target_columns = prediction_options.get("target_columns", sensor_columns[:3])
            training_results = model.train_predictive_models(
                data, target_columns, prediction_options.get("timestamp_column")
            )
        
        # Generate predictions
        predictions = model.predict_sensor_values(data, sensor_columns)
        
        logger.info(f"Manufacturing predictions completed: {self.request.id}")
        return predictions
        
    except Exception as e:
        logger.error(f"Manufacturing predictions failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def train_manufacturing_model(self, training_data_path: str,
                            target_columns: List[str],
                            training_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Train manufacturing prediction model in background.
    
    Args:
        training_data_path: Path to training data
        target_columns: Columns to predict
        training_options: Training configuration
        
    Returns:
        Training results and model performance
    """
    try:
        logger.info(f"Starting manufacturing model training: {self.request.id}")
        
        # Load training data
        data = pd.read_csv(training_data_path) if training_data_path.endswith('.csv') else pd.read_parquet(training_data_path)
        
        # Initialize model with options
        model = ManufacturingPredictorModel(
            prediction_horizon=training_options.get("prediction_horizon", 10),
            model_type=training_options.get("model_type", "ensemble")
        )
        
        # Train model
        training_results = model.train_predictive_models(
            data, 
            target_columns,
            training_options.get("timestamp_column")
        )
        
        # Save model if path provided
        model_save_path = training_options.get("model_save_path")
        if model_save_path:
            from ..ml.models import save_model
            save_model(model, model_save_path, training_results)
        
        logger.info(f"Manufacturing model training completed: {self.request.id}")
        return training_results
        
    except Exception as e:
        logger.error(f"Manufacturing model training failed: {e}")
        raise


# E-commerce ML Tasks
# @celery_app.task(base=MLBaseTask, bind=True)
def process_ecommerce_data(self, interaction_data_path: str,
                         user_data_path: Optional[str] = None,
                         item_data_path: Optional[str] = None,
                         processing_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process e-commerce data for cold start recommendations.
    
    Args:
        interaction_data_path: Path to interaction data
        user_data_path: Optional path to user data
        item_data_path: Optional path to item data
        processing_options: Processing configuration
        
    Returns:
        Processing results including feature engineering and recommendations
    """
    try:
        logger.info(f"Starting e-commerce data processing: {self.request.id}")
        
        # Load data
        interaction_data = pd.read_csv(interaction_data_path)
        user_data = pd.read_csv(user_data_path) if user_data_path else pd.DataFrame()
        item_data = pd.read_csv(item_data_path) if item_data_path else pd.DataFrame()
        
        # Initialize pipeline
        pipeline = EcommercePipeline()
        
        # Process data
        processing_kwargs = {
            "user_data": user_data if not user_data.empty else None,
            "item_data": item_data if not item_data.empty else None,
            "popular_items": processing_options.get("popular_items", [])
        }
        
        results = pipeline.process(interaction_data, **processing_kwargs)
        
        # Generate automated features if requested
        if processing_options.get("generate_automated_features", False):
            feature_generation_task = generate_automated_cold_start_features.delay(
                interaction_data_path, user_data_path, item_data_path
            )
            results["feature_generation_task_id"] = feature_generation_task.id
        
        logger.info(f"E-commerce data processing completed: {self.request.id}")
        return results
        
    except Exception as e:
        logger.error(f"E-commerce processing failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def generate_automated_cold_start_features(self, interaction_data_path: str,
                                         user_data_path: Optional[str] = None,
                                         item_data_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate automated features for cold start scenarios.
    
    Args:
        interaction_data_path: Path to interaction data
        user_data_path: Optional path to user data
        item_data_path: Optional path to item data
        
    Returns:
        Generated feature sets for cold start scenarios
    """
    try:
        logger.info(f"Starting automated feature generation: {self.request.id}")
        
        # Load data
        interaction_data = pd.read_csv(interaction_data_path)
        user_data = pd.read_csv(user_data_path) if user_data_path else None
        item_data = pd.read_csv(item_data_path) if item_data_path else None
        
        # Initialize feature engine
        feature_engine = ColdStartFeatureEngine()
        
        # Generate automated features
        generated_features = feature_engine.generate_automated_features(
            interaction_data, user_data, item_data
        )
        
        logger.info(f"Automated feature generation completed: {self.request.id}")
        return {
            "generated_features": generated_features,
            "feature_sets": list(generated_features.keys()),
            "total_features": sum(len(df.columns) for df in generated_features.values())
        }
        
    except Exception as e:
        logger.error(f"Automated feature generation failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def train_recommendation_model(self, interaction_data_path: str,
                             user_data_path: Optional[str] = None,
                             item_data_path: Optional[str] = None,
                             training_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Train recommendation model for e-commerce.
    
    Args:
        interaction_data_path: Path to interaction data
        user_data_path: Optional path to user data  
        item_data_path: Optional path to item data
        training_options: Training configuration
        
    Returns:
        Training results and model performance
    """
    try:
        logger.info(f"Starting recommendation model training: {self.request.id}")
        
        # Load data
        interactions = pd.read_csv(interaction_data_path)
        user_features = pd.read_csv(user_data_path) if user_data_path else None
        item_features = pd.read_csv(item_data_path) if item_data_path else None
        
        # Initialize model
        model = EcommerceRecommendationModel(
            embedding_dim=training_options.get("embedding_dim", 50),
            cold_start_strategy=training_options.get("cold_start_strategy", "hybrid")
        )
        
        # Train model
        training_results = model.train_recommendation_model(
            interactions, user_features, item_features
        )
        
        # Save model if path provided
        model_save_path = training_options.get("model_save_path")
        if model_save_path:
            from ..ml.models import save_model
            save_model(model, model_save_path, training_results)
        
        logger.info(f"Recommendation model training completed: {self.request.id}")
        return training_results
        
    except Exception as e:
        logger.error(f"Recommendation model training failed: {e}")
        raise


# Financial ML Tasks
# @celery_app.task(base=MLBaseTask, bind=True)
def process_financial_data(self, data_path: str,
                         target_column: str,
                         processing_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process financial data for rare event detection.
    
    Args:
        data_path: Path to financial data
        target_column: Column indicating rare events
        processing_options: Processing configuration
        
    Returns:
        Processing results including feature engineering and sampling
    """
    try:
        logger.info(f"Starting financial data processing: {self.request.id}")
        
        # Load data
        data = pd.read_csv(data_path) if data_path.endswith('.csv') else pd.read_parquet(data_path)
        
        # Initialize pipeline
        pipeline = FinancialPipeline()
        
        # Process data
        processing_kwargs = {
            "target_column": target_column,
            "timestamp_column": processing_options.get("timestamp_column")
        }
        
        results = pipeline.process(data, **processing_kwargs)
        
        # Generate synthetic rare events if requested
        if processing_options.get("generate_synthetic_events", False):
            synthetic_task = generate_synthetic_rare_events.delay(
                data_path, target_column, processing_options
            )
            results["synthetic_generation_task_id"] = synthetic_task.id
        
        logger.info(f"Financial data processing completed: {self.request.id}")
        return results
        
    except Exception as e:
        logger.error(f"Financial processing failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def generate_synthetic_rare_events(self, data_path: str,
                                  target_column: str,
                                  generation_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Generate synthetic rare events for training data augmentation.
    
    Args:
        data_path: Path to original data
        target_column: Target column for rare events
        generation_options: Synthesis configuration
        
    Returns:
        Augmented dataset with synthetic rare events
    """
    try:
        logger.info(f"Starting synthetic rare event generation: {self.request.id}")
        
        # Load data
        data = pd.read_csv(data_path) if data_path.endswith('.csv') else pd.read_parquet(data_path)
        
        # Separate features and target
        X = data.drop(columns=[target_column])
        y = data[target_column]
        
        # Initialize rare event engine
        rare_event_engine = RareEventFeatureEngine()
        
        # Generate synthetic events
        synthesis_method = generation_options.get("method", "ensemble")
        n_synthetic = generation_options.get("n_synthetic")
        
        X_augmented, y_augmented = rare_event_engine.generate_synthetic_rare_events(
            X, y, n_synthetic, synthesis_method
        )
        
        # Save augmented data if path provided
        output_path = generation_options.get("output_path")
        if output_path:
            augmented_data = pd.concat([X_augmented, y_augmented], axis=1)
            augmented_data.to_csv(output_path, index=False)
        
        logger.info(f"Synthetic rare event generation completed: {self.request.id}")
        return {
            "original_samples": len(data),
            "augmented_samples": len(X_augmented),
            "synthetic_samples_generated": len(X_augmented) - len(X),
            "original_rare_ratio": y.sum() / len(y),
            "augmented_rare_ratio": y_augmented.sum() / len(y_augmented),
            "synthesis_method": synthesis_method
        }
        
    except Exception as e:
        logger.error(f"Synthetic rare event generation failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def train_rare_event_model(self, training_data_path: str,
                          target_column: str,
                          training_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Train rare event detection model.
    
    Args:
        training_data_path: Path to training data
        target_column: Target column for rare events
        training_options: Training configuration
        
    Returns:
        Training results and model performance
    """
    try:
        logger.info(f"Starting rare event model training: {self.request.id}")
        
        # Load training data
        data = pd.read_csv(training_data_path) if training_data_path.endswith('.csv') else pd.read_parquet(training_data_path)
        
        # Initialize model
        model = FinancialRareEventModel(
            event_threshold=training_options.get("event_threshold", 0.05),
            model_ensemble=training_options.get("model_ensemble", True)
        )
        
        # Train model
        training_results = model.train_rare_event_models(
            data,
            target_column,
            training_options.get("timestamp_column")
        )
        
        # Save model if path provided
        model_save_path = training_options.get("model_save_path")
        if model_save_path:
            from ..ml.models import save_model
            save_model(model, model_save_path, training_results)
        
        logger.info(f"Rare event model training completed: {self.request.id}")
        return training_results
        
    except Exception as e:
        logger.error(f"Rare event model training failed: {e}")
        raise


# Utility and Monitoring Tasks
# @celery_app.task(base=MLBaseTask, bind=True)
def batch_process_files(self, file_paths: List[str],
                       processing_type: str,
                       processing_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process multiple files in batch with memory management.
    
    Args:
        file_paths: List of file paths to process
        processing_type: Type of processing ('manufacturing', 'ecommerce', 'financial')
        processing_options: Processing configuration
        
    Returns:
        Batch processing results
    """
    try:
        logger.info(f"Starting batch processing of {len(file_paths)} files: {self.request.id}")
        
        # Initialize memory-efficient processor
        memory_processor = MemoryEfficientProcessor()
        
        # Create processing function based on type
        if processing_type == "manufacturing":
            def process_func(file_path):
                return process_manufacturing_data.delay(file_path, **processing_options)
        elif processing_type == "ecommerce":
            def process_func(file_path):
                return process_ecommerce_data.delay(file_path, **processing_options)
        elif processing_type == "financial":
            def process_func(file_path):
                return process_financial_data.delay(file_path, **processing_options)
        else:
            raise ValueError(f"Unknown processing type: {processing_type}")
        
        # Batch process files
        batch_results = memory_processor.batch_process_files(
            file_paths, process_func, processing_options.get("output_path", "/tmp/batch_results")
        )
        
        logger.info(f"Batch processing completed: {self.request.id}")
        return batch_results
        
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def optimize_model_performance(self, model_path: str,
                             validation_data_path: str,
                             optimization_options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Optimize trained model performance with validation data.
    
    Args:
        model_path: Path to trained model
        validation_data_path: Path to validation data
        optimization_options: Optimization configuration
        
    Returns:
        Optimization results and improved model performance
    """
    try:
        logger.info(f"Starting model performance optimization: {self.request.id}")
        
        # Load model and validation data
        from ..ml.models import load_model
        model, metadata = load_model(model_path)
        validation_data = pd.read_csv(validation_data_path)
        
        # Initialize performance monitor
        performance_monitor = MLPerformanceMonitor()
        
        # Start monitoring
        performance_monitor.start_monitoring("model_optimization")
        
        # Apply optimization techniques based on model type
        model_type = metadata.get("model_type", "unknown")
        
        if "manufacturing" in model_type.lower():
            optimization_results = self._optimize_manufacturing_model(
                model, validation_data, optimization_options
            )
        elif "ecommerce" in model_type.lower():
            optimization_results = self._optimize_recommendation_model(
                model, validation_data, optimization_options
            )
        elif "financial" in model_type.lower():
            optimization_results = self._optimize_rare_event_model(
                model, validation_data, optimization_options
            )
        else:
            optimization_results = {"error": f"Unknown model type: {model_type}"}
        
        # Stop monitoring and get performance metrics
        perf_metrics = performance_monitor.stop_monitoring("model_optimization")
        optimization_results["performance_metrics"] = perf_metrics
        
        logger.info(f"Model optimization completed: {self.request.id}")
        return optimization_results
        
    except Exception as e:
        logger.error(f"Model optimization failed: {e}")
        raise


# @celery_app.task(base=MLBaseTask, bind=True)
def cleanup_ml_cache(self, cache_age_hours: int = 24) -> Dict[str, Any]:
    """
    Clean up old ML cache entries and temporary files.
    
    Args:
        cache_age_hours: Age in hours for cache cleanup
        
    Returns:
        Cleanup results
    """
    try:
        logger.info(f"Starting ML cache cleanup: {self.request.id}")
        
        cleanup_results = {
            "cache_entries_cleaned": 0,
            "temp_files_cleaned": 0,
            "space_freed_mb": 0,
            "cleanup_time": None
        }
        
        start_time = time.time()
        
        # Initialize feature cache
        feature_cache = FeatureCache()
        
        # Get cache statistics before cleanup
        cache_stats_before = feature_cache.get_cache_statistics()
        
        # Clean up old cache entries (implementation depends on cache backend)
        # This is a placeholder - actual implementation would depend on Redis setup
        cleanup_results["cache_entries_cleaned"] = 0
        
        # Clean up temporary files
        import os
        import glob
        temp_pattern = "/tmp/ml_*"
        temp_files = glob.glob(temp_pattern)
        
        space_freed = 0
        files_cleaned = 0
        
        cutoff_time = datetime.now() - timedelta(hours=cache_age_hours)
        
        for temp_file in temp_files:
            try:
                file_mod_time = datetime.fromtimestamp(os.path.getmtime(temp_file))
                if file_mod_time < cutoff_time:
                    file_size = os.path.getsize(temp_file)
                    os.remove(temp_file)
                    space_freed += file_size
                    files_cleaned += 1
            except Exception as e:
                logger.warning(f"Failed to clean up file {temp_file}: {e}")
        
        cleanup_results["temp_files_cleaned"] = files_cleaned
        cleanup_results["space_freed_mb"] = space_freed / (1024 * 1024)
        cleanup_results["cleanup_time"] = time.time() - start_time
        
        logger.info(f"ML cache cleanup completed: {self.request.id}")
        return cleanup_results
        
    except Exception as e:
        logger.error(f"ML cache cleanup failed: {e}")
        raise


# Task monitoring and management
def get_ml_task_status(task_id: str) -> Dict[str, Any]:
    """Get status of ML task."""
    try:
        # This would use your Celery result backend
        # result = celery_app.AsyncResult(task_id)
        
        # Placeholder implementation
        return {
            "task_id": task_id,
            "status": "PENDING",  # Would be result.status
            "result": None,
            "traceback": None
        }
    except Exception as e:
        logger.error(f"Failed to get task status for {task_id}: {e}")
        return {"error": str(e)}


def cancel_ml_task(task_id: str) -> Dict[str, Any]:
    """Cancel running ML task."""
    try:
        # This would use your Celery app to revoke the task
        # celery_app.control.revoke(task_id, terminate=True)
        
        logger.info(f"ML task {task_id} cancellation requested")
        return {"task_id": task_id, "status": "cancellation_requested"}
    except Exception as e:
        logger.error(f"Failed to cancel task {task_id}: {e}")
        return {"error": str(e)}


def get_ml_task_queue_status() -> Dict[str, Any]:
    """Get ML task queue status and statistics."""
    try:
        # This would inspect your Celery queues
        # inspect = celery_app.control.inspect()
        
        # Placeholder implementation
        return {
            "active_tasks": 0,
            "pending_tasks": 0,
            "worker_status": "healthy",
            "queue_length": 0
        }
    except Exception as e:
        logger.error(f"Failed to get queue status: {e}")
        return {"error": str(e)}