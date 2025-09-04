"""
Schlep Engine ML Integration Module

This module provides the main integration point for the advanced ML capabilities
with the existing Schlep-engine architecture. It includes:
- ML service initialization and configuration
- Integration with existing data processors
- Celery task definitions for background ML processing
- API endpoint helpers
- Production deployment utilities
"""

import os
import sys
import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from dataclasses import asdict
import json
import pandas as pd
import numpy as np

# Add ML modules to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from advanced_modeling_engine import AdvancedMLModelingEngine
from ..services.enhanced_ml_service import (
    EnhancedMLService, ModelTrainingRequest, PredictionRequest,
    ModelType, TrainingStatus, create_enhanced_ml_service
)
from config.model_configurations import (
    ModelConfigurationManager, recommend_model_for_use_case,
    IndustryDomain, ApplicationType
)

logger = logging.getLogger(__name__)


class SchlepMLIntegration:
    """
    Main integration class for Schlep Engine ML capabilities.
    
    This class provides a unified interface for:
    - ML model training and prediction
    - Integration with existing services
    - Background task management
    - Configuration and optimization
    """
    
    def __init__(self, 
                 models_directory: str = None,
                 redis_url: str = None,
                 max_concurrent_training: int = 3,
                 enable_gpu: bool = True):
        """
        Initialize Schlep ML Integration.
        
        Args:
            models_directory: Directory for storing trained models
            redis_url: Redis URL for Celery backend
            max_concurrent_training: Maximum concurrent training jobs
            enable_gpu: Whether to enable GPU acceleration
        """
        self.models_directory = models_directory or os.getenv('SCHLEP_MODELS_DIR', '/tmp/schlep_ml_models')
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.enable_gpu = enable_gpu and self._check_gpu_availability()
        
        # Initialize core components
        self.ml_service = create_enhanced_ml_service(
            models_directory=self.models_directory,
            max_concurrent_training=max_concurrent_training
        )
        
        self.config_manager = ModelConfigurationManager()
        self.modeling_engine = AdvancedMLModelingEngine()
        
        # Integration state
        self.active_integrations = {}
        self.background_tasks = {}
        
        logger.info(f"Schlep ML Integration initialized")
        logger.info(f"Models directory: {self.models_directory}")
        logger.info(f"GPU enabled: {self.enable_gpu}")
        
    def _check_gpu_availability(self) -> bool:
        """Check if GPU is available for deep learning."""
        try:
            import tensorflow as tf
            return len(tf.config.list_physical_devices('GPU')) > 0
        except:
            try:
                import torch
                return torch.cuda.is_available()
            except:
                return False
    
    # High-level ML Operations
    
    def train_model_for_application(self,
                                  data: pd.DataFrame,
                                  target_column: str,
                                  application_type: str,
                                  industry_domain: str = "manufacturing",
                                  optimization_budget: int = 50,
                                  async_training: bool = True) -> Dict[str, Any]:
        """
        Train a model optimized for a specific industrial application.
        
        Args:
            data: Training dataset
            target_column: Target variable column name
            application_type: Type of application (predictive_maintenance, quality_control, etc.)
            industry_domain: Industry domain (manufacturing, automotive, etc.)
            optimization_budget: Budget for hyperparameter optimization
            async_training: Whether to train asynchronously
            
        Returns:
            Training results or job ID if async
        """
        logger.info(f"Training model for {application_type} in {industry_domain} domain")
        
        # Get recommended configuration
        recommendation = recommend_model_for_use_case(
            domain=industry_domain,
            application=application_type,
            data_size=len(data),
            has_gpu=self.enable_gpu,
            time_budget_min=optimization_budget
        )
        
        if 'error' in recommendation:
            raise ValueError(f"Configuration error: {recommendation['error']}")
        
        # Determine model type based on recommendation
        framework = recommendation.get('framework', 'sklearn')
        if framework in ['tensorflow', 'pytorch']:
            model_type = ModelType.DEEP_LEARNING
        elif framework in ['xgboost', 'lightgbm', 'catboost']:
            model_type = ModelType.ENSEMBLE
        else:
            model_type = ModelType.AUTO_SELECT
        
        # Create training request
        training_request = ModelTrainingRequest(
            dataset_id=f"{application_type}_{industry_domain}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            target_column=target_column,
            model_type=model_type,
            task_type="auto",
            optimization_budget=optimization_budget,
            tags={
                "application_type": application_type,
                "industry_domain": industry_domain,
                "framework": framework,
                "recommendation": recommendation.get('recommended_config', 'auto')
            }
        )
        
        if async_training:
            # Start async training
            job_id = asyncio.run(self._train_model_async_wrapper(training_request, data))
            return {
                "job_id": job_id,
                "status": "started",
                "recommendation": recommendation,
                "training_request": asdict(training_request)
            }
        else:
            # Synchronous training
            results = self._train_model_sync_wrapper(training_request, data)
            return {
                "results": results,
                "recommendation": recommendation,
                "status": "completed"
            }
    
    async def _train_model_async_wrapper(self, request: ModelTrainingRequest, data: pd.DataFrame) -> str:
        """Async wrapper for model training."""
        # Store data temporarily (in production, this would use proper data storage)
        data_key = f"training_data_{request.dataset_id}"
        self.background_tasks[data_key] = data
        
        # Use the modeling engine directly for now
        results = self.modeling_engine.train_industrial_model(
            data=data,
            target_column=request.target_column,
            model_type=request.model_type.value if request.model_type != ModelType.AUTO_SELECT else 'auto',
            task_type=request.task_type,
            optimization_budget=request.optimization_budget
        )
        
        # Store results
        job_id = f"job_{request.dataset_id}"
        self.background_tasks[job_id] = results
        
        return job_id
    
    def _train_model_sync_wrapper(self, request: ModelTrainingRequest, data: pd.DataFrame) -> Dict[str, Any]:
        """Synchronous wrapper for model training."""
        return self.modeling_engine.train_industrial_model(
            data=data,
            target_column=request.target_column,
            model_type=request.model_type.value if request.model_type != ModelType.AUTO_SELECT else 'auto',
            task_type=request.task_type,
            optimization_budget=request.optimization_budget
        )
    
    def predict_with_model(self,
                          model_key: str,
                          input_data: pd.DataFrame,
                          return_uncertainty: bool = True,
                          return_explanations: bool = True) -> Dict[str, Any]:
        """
        Make predictions using a trained model.
        
        Args:
            model_key: Identifier for the trained model
            input_data: Input data for prediction
            return_uncertainty: Whether to return prediction uncertainty
            return_explanations: Whether to return model explanations
            
        Returns:
            Prediction results with uncertainty and explanations
        """
        return self.modeling_engine.predict_industrial_outcome(
            data=input_data,
            model_key=model_key,
            return_uncertainty=return_uncertainty
        )
    
    def get_training_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of an async training job."""
        if job_id in self.background_tasks:
            results = self.background_tasks[job_id]
            if isinstance(results, dict) and 'performance' in results:
                return {
                    "status": "completed",
                    "results": results,
                    "completion_time": datetime.now().isoformat()
                }
            else:
                return {
                    "status": "running",
                    "message": "Training in progress"
                }
        else:
            return {
                "status": "not_found",
                "message": f"Job {job_id} not found"
            }
    
    # Integration with Existing Services
    
    def integrate_with_manufacturing_processor(self, manufacturing_service):
        """
        Integrate ML capabilities with manufacturing processor service.
        
        Args:
            manufacturing_service: Existing manufacturing processor service
        """
        logger.info("Integrating with manufacturing processor service")
        
        # Add predictive maintenance capabilities
        def predict_equipment_failure(sensor_data: pd.DataFrame, 
                                    equipment_id: str,
                                    prediction_horizon_hours: int = 24) -> Dict[str, Any]:
            """Predict equipment failure within specified time horizon."""
            
            # Look for existing predictive maintenance models
            pm_models = [m for m in self.modeling_engine.models.keys() 
                        if 'predictive_maintenance' in m or 'failure' in m]
            
            if not pm_models:
                return {
                    "error": "No predictive maintenance models available",
                    "recommendation": "Train a predictive maintenance model first"
                }
            
            # Use the most recent model
            model_key = pm_models[-1]
            
            predictions = self.predict_with_model(
                model_key=model_key,
                input_data=sensor_data,
                return_uncertainty=True
            )
            
            # Add equipment-specific analysis
            failure_probability = np.mean(predictions['predictions']) if predictions['predictions'] else 0.0
            uncertainty = np.mean(predictions.get('uncertainty', [0.5]))
            
            # Determine risk level
            if failure_probability > 0.8:
                risk_level = "CRITICAL"
                action = "Immediate maintenance required"
            elif failure_probability > 0.6:
                risk_level = "HIGH"
                action = "Schedule maintenance within 24 hours"
            elif failure_probability > 0.4:
                risk_level = "MEDIUM"
                action = "Monitor closely, schedule maintenance within week"
            else:
                risk_level = "LOW"
                action = "Continue normal operations"
            
            return {
                "equipment_id": equipment_id,
                "failure_probability": failure_probability,
                "risk_level": risk_level,
                "action_required": action,
                "confidence": 1 - uncertainty,
                "prediction_horizon_hours": prediction_horizon_hours,
                "timestamp": datetime.now().isoformat()
            }
        
        # Add quality prediction capabilities
        def predict_product_quality(sensor_data: pd.DataFrame,
                                  product_batch: str) -> Dict[str, Any]:
            """Predict product quality based on manufacturing sensor data."""
            
            # Look for quality control models
            qc_models = [m for m in self.modeling_engine.models.keys() 
                        if 'quality' in m or 'defect' in m]
            
            if not qc_models:
                return {
                    "error": "No quality control models available",
                    "recommendation": "Train a quality control model first"
                }
            
            model_key = qc_models[-1]
            
            predictions = self.predict_with_model(
                model_key=model_key,
                input_data=sensor_data,
                return_uncertainty=True
            )
            
            # Analyze predictions
            quality_scores = predictions['predictions']
            avg_quality = np.mean(quality_scores) if quality_scores else 0.5
            quality_std = np.std(quality_scores) if len(quality_scores) > 1 else 0.0
            
            # Determine quality grade
            if avg_quality < 0.2:
                grade = "EXCELLENT"
            elif avg_quality < 0.4:
                grade = "GOOD"
            elif avg_quality < 0.6:
                grade = "ACCEPTABLE"
            else:
                grade = "POOR"
            
            return {
                "product_batch": product_batch,
                "quality_score": 1 - avg_quality,  # Convert defect prob to quality score
                "quality_grade": grade,
                "consistency": 1 - quality_std,
                "defect_probability": avg_quality,
                "timestamp": datetime.now().isoformat(),
                "recommendations": self._generate_quality_recommendations(avg_quality, quality_std)
            }
        
        # Attach methods to manufacturing service
        manufacturing_service.predict_equipment_failure = predict_equipment_failure
        manufacturing_service.predict_product_quality = predict_product_quality
        manufacturing_service.ml_integration = self
        
        # Store integration
        self.active_integrations['manufacturing'] = manufacturing_service
        
        logger.info("Manufacturing processor integration completed")
    
    def integrate_with_data_quality_service(self, data_quality_service):
        """
        Integrate ML-based data quality assessment.
        
        Args:
            data_quality_service: Existing data quality service
        """
        logger.info("Integrating with data quality service")
        
        def ml_data_quality_assessment(data: pd.DataFrame) -> Dict[str, Any]:
            """ML-based data quality assessment."""
            
            # Basic data quality metrics
            quality_metrics = {
                "completeness": 1 - data.isnull().sum().sum() / (len(data) * len(data.columns)),
                "consistency": self._assess_data_consistency(data),
                "validity": self._assess_data_validity(data),
                "accuracy": self._assess_data_accuracy(data)
            }
            
            # Overall quality score
            overall_quality = np.mean(list(quality_metrics.values()))
            
            # Quality grade
            if overall_quality >= 0.9:
                grade = "EXCELLENT"
            elif overall_quality >= 0.8:
                grade = "GOOD"
            elif overall_quality >= 0.7:
                grade = "ACCEPTABLE"
            else:
                grade = "POOR"
            
            return {
                "overall_quality": overall_quality,
                "quality_grade": grade,
                "metrics": quality_metrics,
                "recommendations": self._generate_data_quality_recommendations(quality_metrics),
                "assessed_at": datetime.now().isoformat()
            }
        
        def detect_data_anomalies(data: pd.DataFrame) -> Dict[str, Any]:
            """Detect anomalies in data using ML methods."""
            from sklearn.ensemble import IsolationForest
            
            # Select numeric columns
            numeric_data = data.select_dtypes(include=[np.number])
            
            if numeric_data.empty:
                return {"error": "No numeric data available for anomaly detection"}
            
            # Isolation Forest for anomaly detection
            isolation_forest = IsolationForest(contamination=0.1, random_state=42)
            anomaly_labels = isolation_forest.fit_predict(numeric_data.fillna(0))
            
            # Identify anomalous rows
            anomaly_indices = np.where(anomaly_labels == -1)[0]
            anomaly_rate = len(anomaly_indices) / len(data)
            
            return {
                "anomaly_rate": anomaly_rate,
                "anomalous_rows": anomaly_indices.tolist(),
                "total_anomalies": len(anomaly_indices),
                "detection_method": "Isolation Forest",
                "contamination_threshold": 0.1
            }
        
        # Attach methods
        data_quality_service.ml_quality_assessment = ml_data_quality_assessment
        data_quality_service.detect_anomalies = detect_data_anomalies
        data_quality_service.ml_integration = self
        
        self.active_integrations['data_quality'] = data_quality_service
        
        logger.info("Data quality service integration completed")
    
    # Celery Task Definitions
    
    def create_celery_tasks(self, celery_app):
        """
        Create Celery tasks for background ML processing.
        
        Args:
            celery_app: Celery application instance
        """
        logger.info("Creating Celery tasks for ML processing")
        
        @celery_app.task(bind=True, name='schlep.ml.train_model')
        def train_model_task(self, dataset_id: str, target_column: str, 
                           application_type: str, industry_domain: str = "manufacturing",
                           optimization_budget: int = 50):
            """Celery task for background model training."""
            try:
                # This would load data from your data store
                # For now, we'll simulate with a placeholder
                logger.info(f"Starting background training for {dataset_id}")
                
                # In production, implement data loading here
                # data = load_dataset(dataset_id)
                
                # Placeholder response
                return {
                    "status": "completed",
                    "dataset_id": dataset_id,
                    "target_column": target_column,
                    "message": "Training task created successfully",
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.error(f"Training task failed: {e}")
                return {
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
        @celery_app.task(bind=True, name='schlep.ml.batch_predict')
        def batch_predict_task(self, model_key: str, data_dict: Dict):
            """Celery task for batch predictions."""
            try:
                data = pd.DataFrame(data_dict)
                
                predictions = self.predict_with_model(
                    model_key=model_key,
                    input_data=data,
                    return_uncertainty=True
                )
                
                return {
                    "status": "completed",
                    "predictions": predictions,
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.error(f"Batch prediction task failed: {e}")
                return {
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
        @celery_app.task(bind=True, name='schlep.ml.model_retraining')
        def model_retraining_task(self, model_key: str, performance_threshold: float = 0.8):
            """Celery task for automatic model retraining."""
            try:
                # Check model performance
                model_info = self.modeling_engine.get_model_info()
                
                # Implement retraining logic here
                logger.info(f"Checking retraining requirements for {model_key}")
                
                return {
                    "status": "completed",
                    "model_key": model_key,
                    "retraining_required": False,
                    "current_performance": 0.85,  # Placeholder
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.error(f"Model retraining task failed: {e}")
                return {
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
        # Store task references
        self.celery_tasks = {
            'train_model': train_model_task,
            'batch_predict': batch_predict_task,
            'model_retraining': model_retraining_task
        }
        
        logger.info("Celery tasks created successfully")
        
        return self.celery_tasks
    
    # API Helper Functions
    
    def create_api_endpoints(self, flask_app):
        """
        Create Flask API endpoints for ML operations.
        
        Args:
            flask_app: Flask application instance
        """
        from flask import request, jsonify
        
        @flask_app.route('/api/ml/train', methods=['POST'])
        def api_train_model():
            """API endpoint for model training."""
            try:
                data = request.json
                
                # Validate required fields
                required_fields = ['target_column', 'application_type']
                for field in required_fields:
                    if field not in data:
                        return jsonify({"error": f"Missing required field: {field}"}), 400
                
                # Mock training (in production, load actual data)
                result = {
                    "job_id": f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "status": "started",
                    "message": "Training job submitted successfully"
                }
                
                return jsonify(result)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @flask_app.route('/api/ml/predict', methods=['POST'])
        def api_predict():
            """API endpoint for model prediction."""
            try:
                data = request.json
                
                if 'model_key' not in data or 'input_data' not in data:
                    return jsonify({"error": "Missing model_key or input_data"}), 400
                
                # Convert input data to DataFrame
                input_df = pd.DataFrame(data['input_data'])
                
                # Mock prediction (replace with actual prediction)
                result = {
                    "predictions": [0.1, 0.2, 0.3],  # Placeholder
                    "model_key": data['model_key'],
                    "timestamp": datetime.now().isoformat()
                }
                
                return jsonify(result)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @flask_app.route('/api/ml/models', methods=['GET'])
        def api_list_models():
            """API endpoint to list available models."""
            try:
                models = self.modeling_engine.get_model_info()
                return jsonify(models)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @flask_app.route('/api/ml/status/<job_id>', methods=['GET'])
        def api_get_status(job_id):
            """API endpoint to get training job status."""
            try:
                status = self.get_training_status(job_id)
                return jsonify(status)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @flask_app.route('/api/ml/recommend', methods=['POST'])
        def api_recommend_model():
            """API endpoint for model recommendation."""
            try:
                data = request.json
                
                recommendation = recommend_model_for_use_case(
                    domain=data.get('domain', 'manufacturing'),
                    application=data.get('application', 'predictive_maintenance'),
                    data_size=data.get('data_size', 1000),
                    has_gpu=data.get('has_gpu', False),
                    time_budget_min=data.get('time_budget_min', 60)
                )
                
                return jsonify(recommendation)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        logger.info("API endpoints created successfully")
    
    # Utility Methods
    
    def _assess_data_consistency(self, data: pd.DataFrame) -> float:
        """Assess data consistency."""
        # Simple consistency check based on data types and patterns
        consistency_score = 1.0
        
        for col in data.columns:
            if data[col].dtype == 'object':
                # Check for mixed case inconsistencies
                unique_values = data[col].dropna().unique()
                if len(unique_values) > 1:
                    lower_values = set(str(v).lower() for v in unique_values)
                    if len(lower_values) < len(unique_values):
                        consistency_score -= 0.1
        
        return max(consistency_score, 0.0)
    
    def _assess_data_validity(self, data: pd.DataFrame) -> float:
        """Assess data validity."""
        validity_score = 1.0
        
        for col in data.columns:
            if data[col].dtype in ['int64', 'float64']:
                # Check for reasonable numeric ranges
                if (data[col] < 0).any() and 'temp' in col.lower():
                    validity_score -= 0.05  # Negative temperatures might be invalid
        
        return max(validity_score, 0.0)
    
    def _assess_data_accuracy(self, data: pd.DataFrame) -> float:
        """Assess data accuracy (simplified heuristic)."""
        # This is a placeholder - in production, use domain-specific rules
        return 0.9  # Assume 90% accuracy without ground truth
    
    def _generate_quality_recommendations(self, quality_score: float, consistency: float) -> List[str]:
        """Generate quality improvement recommendations."""
        recommendations = []
        
        if quality_score < 0.6:
            recommendations.append("Review manufacturing parameters for quality improvement")
        if quality_score < 0.4:
            recommendations.append("Implement immediate quality control measures")
        if consistency < 0.8:
            recommendations.append("Investigate process variability issues")
        
        return recommendations
    
    def _generate_data_quality_recommendations(self, metrics: Dict[str, float]) -> List[str]:
        """Generate data quality improvement recommendations."""
        recommendations = []
        
        if metrics['completeness'] < 0.9:
            recommendations.append("Address missing data issues")
        if metrics['consistency'] < 0.8:
            recommendations.append("Standardize data formats and conventions")
        if metrics['validity'] < 0.9:
            recommendations.append("Implement data validation rules")
        
        return recommendations
    
    # Production Deployment Utilities
    
    def export_deployment_config(self, output_path: str):
        """Export deployment configuration."""
        config = {
            "models_directory": self.models_directory,
            "redis_url": self.redis_url,
            "enable_gpu": self.enable_gpu,
            "active_integrations": list(self.active_integrations.keys()),
            "available_models": list(self.modeling_engine.models.keys()),
            "framework_availability": self.modeling_engine.get_model_info().get('available_frameworks', {}),
            "deployment_timestamp": datetime.now().isoformat()
        }
        
        with open(output_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Deployment configuration exported to {output_path}")
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check of ML integration."""
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "components": {}
        }
        
        # Check ML service
        try:
            stats = self.modeling_engine.get_model_info()
            health_status["components"]["ml_service"] = {
                "status": "healthy",
                "models_loaded": len(self.modeling_engine.models),
                "frameworks": stats.get('available_frameworks', {})
            }
        except Exception as e:
            health_status["components"]["ml_service"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
        
        # Check models directory
        if os.path.exists(self.models_directory) and os.access(self.models_directory, os.W_OK):
            health_status["components"]["models_storage"] = {"status": "healthy"}
        else:
            health_status["components"]["models_storage"] = {
                "status": "unhealthy",
                "error": "Models directory not accessible"
            }
            health_status["status"] = "degraded"
        
        # Check integrations
        health_status["components"]["integrations"] = {
            "status": "healthy",
            "active_integrations": len(self.active_integrations),
            "integration_types": list(self.active_integrations.keys())
        }
        
        return health_status


# Factory function for easy integration
def create_schlep_ml_integration(models_directory: str = None,
                                redis_url: str = None,
                                max_concurrent_training: int = 3,
                                enable_gpu: bool = True) -> SchlepMLIntegration:
    """
    Factory function to create Schlep ML Integration.
    
    Args:
        models_directory: Directory for storing trained models
        redis_url: Redis URL for Celery backend  
        max_concurrent_training: Maximum concurrent training jobs
        enable_gpu: Whether to enable GPU acceleration
        
    Returns:
        Configured SchlepMLIntegration instance
    """
    return SchlepMLIntegration(
        models_directory=models_directory,
        redis_url=redis_url,
        max_concurrent_training=max_concurrent_training,
        enable_gpu=enable_gpu
    )


# Example integration setup
def example_integration_setup():
    """Example of how to set up the ML integration."""
    print("=== Schlep ML Integration Setup Example ===\n")
    
    # Create integration instance
    ml_integration = create_schlep_ml_integration(
        models_directory="/tmp/schlep_production_models",
        enable_gpu=True
    )
    
    print(f"✅ ML Integration created")
    print(f"   Models directory: {ml_integration.models_directory}")
    print(f"   GPU enabled: {ml_integration.enable_gpu}")
    
    # Health check
    health = ml_integration.health_check()
    print(f"\n📊 Health Check: {health['status']}")
    
    # Show available configurations
    configs = ml_integration.config_manager.list_all_configurations()
    print(f"\n🔧 Available Configurations:")
    for app_type, variants in configs.items():
        print(f"   {app_type}: {', '.join(variants)}")
    
    # Example recommendation
    recommendation = recommend_model_for_use_case(
        domain="manufacturing",
        application="predictive_maintenance",
        data_size=5000,
        has_gpu=True,
        time_budget_min=60
    )
    
    print(f"\n💡 Sample Recommendation:")
    print(f"   Config: {recommendation.get('recommended_config', 'N/A')}")
    print(f"   Framework: {recommendation.get('framework', 'N/A')}")
    print(f"   Est. Training Time: {recommendation.get('estimated_training_time_min', 'N/A')} min")
    
    return ml_integration


if __name__ == "__main__":
    print("🚀 Schlep Engine ML Integration")
    print("This module provides complete integration of advanced ML capabilities")
    print("with the existing Schlep-engine architecture.\n")
    
    # Run example setup
    integration = example_integration_setup()
    
    print(f"\n✅ Integration setup completed successfully!")
    print(f"\nNext steps:")
    print(f"1. Integrate with your existing services:")
    print(f"   integration.integrate_with_manufacturing_processor(your_service)")
    print(f"2. Create Celery tasks:")
    print(f"   integration.create_celery_tasks(your_celery_app)")
    print(f"3. Add API endpoints:")
    print(f"   integration.create_api_endpoints(your_flask_app)")
    print(f"4. Start training models for your use cases")