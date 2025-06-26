"""
Advanced ML API endpoints for custom model training and predictive analytics
Provides enterprise-grade machine learning capabilities through REST API
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
import pandas as pd
import json
import asyncio
from datetime import datetime
import logging
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.services.advanced_ml_engine import advanced_ml_engine
from app.database.models import User, Investigation
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ml", tags=["Advanced ML"])

# Pydantic models for request/response
class ModelTrainingRequest(BaseModel):
    investigation_id: int
    model_name: str
    model_type: str = Field(..., description="'anomaly_detection', 'classification', 'regression', or 'auto'")
    target_column: Optional[str] = None
    features: Optional[List[str]] = None
    parameters: Optional[Dict[str, Any]] = {}

class PredictionRequest(BaseModel):
    model_name: str
    data: List[Dict[str, Any]]
    return_probabilities: bool = False

class AnomalyDetectionRequest(BaseModel):
    model_name: str
    investigation_id: int

class ModelResponse(BaseModel):
    model_name: str
    model_type: str
    status: str
    metadata: Dict[str, Any]
    created_at: str

class PredictionResponse(BaseModel):
    predictions: List[Any]
    model_used: str
    prediction_date: str
    confidence_scores: Optional[List[float]] = None

class InsightsResponse(BaseModel):
    model_name: str
    insights: List[str]
    generated_date: str
    recommendations: List[str]

@router.post("/train-model", response_model=ModelResponse)
async def train_ml_model(
    background_tasks: BackgroundTasks,
    request: ModelTrainingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Train a custom ML model on user data
    
    Supports:
    - Anomaly detection models
    - Classification models  
    - Regression models
    - Auto-detection of model type
    """
    try:
        # Verify investigation exists and belongs to user
        investigation = db.query(Investigation).filter(
            Investigation.id == request.investigation_id,
            Investigation.user_id == current_user.id
        ).first()
        
        if not investigation:
            raise HTTPException(status_code=404, detail="Investigation not found")
        
        if not investigation.results or 'processed_data' not in investigation.results:
            raise HTTPException(
                status_code=400, 
                detail="Investigation must have processed data before training models"
            )
        
        # Load processed data
        processed_data = pd.DataFrame(investigation.results['processed_data'])
        
        if len(processed_data) == 0:
            raise HTTPException(status_code=400, detail="No data available for training")
        
        # Start training in background
        background_tasks.add_task(
            train_model_background,
            processed_data,
            request,
            current_user.id,
            db
        )
        
        return ModelResponse(
            model_name=request.model_name,
            model_type=request.model_type,
            status="training_started",
            metadata={
                "investigation_id": request.investigation_id,
                "data_shape": processed_data.shape,
                "training_started": datetime.utcnow().isoformat()
            },
            created_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error starting model training: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

async def train_model_background(
    data: pd.DataFrame,
    request: ModelTrainingRequest,
    user_id: int,
    db: Session
):
    """
    Background task for model training
    """
    try:
        if request.model_type == "anomaly_detection":
            metadata = advanced_ml_engine.train_anomaly_detection_model(
                data=data,
                model_name=request.model_name,
                contamination=request.parameters.get('contamination', 0.1),
                features=request.features
            )
        else:
            if not request.target_column:
                raise ValueError("Target column required for predictive models")
                
            metadata = advanced_ml_engine.train_predictive_model(
                data=data,
                model_name=request.model_name,
                target_column=request.target_column,
                model_type=request.model_type,
                features=request.features,
                test_size=request.parameters.get('test_size', 0.2)
            )
        
        # Update investigation with model info
        investigation = db.query(Investigation).filter(
            Investigation.id == request.investigation_id
        ).first()
        
        if investigation:
            if not investigation.results:
                investigation.results = {}
            if 'trained_models' not in investigation.results:
                investigation.results['trained_models'] = []
                
            investigation.results['trained_models'].append({
                'model_name': request.model_name,
                'model_type': request.model_type,
                'training_completed': datetime.utcnow().isoformat(),
                'metadata': metadata
            })
            
            db.commit()
        
        logger.info(f"Model training completed: {request.model_name}")
        
    except Exception as e:
        logger.error(f"Background model training failed: {str(e)}")

@router.get("/models", response_model=Dict[str, Any])
async def list_trained_models(
    current_user: User = Depends(get_current_user)
):
    """
    List all trained models for the current user
    """
    try:
        models_summary = advanced_ml_engine.get_model_summary()
        
        # Filter models by user (in a real implementation, you'd associate models with users)
        # For now, return all models but this should be enhanced with user association
        
        return {
            "models": models_summary,
            "user_id": current_user.id,
            "total_models": models_summary['total_models']
        }
        
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")

@router.post("/predict", response_model=PredictionResponse)
async def make_predictions(
    request: PredictionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Make predictions using a trained model
    """
    try:
        # Convert request data to DataFrame
        prediction_data = pd.DataFrame(request.data)
        
        if len(prediction_data) == 0:
            raise HTTPException(status_code=400, detail="No data provided for prediction")
        
        # Make predictions
        results = advanced_ml_engine.make_predictions(
            data=prediction_data,
            model_name=request.model_name,
            return_probabilities=request.return_probabilities
        )
        
        return PredictionResponse(
            predictions=results['predictions'],
            model_used=results['model_used'],
            prediction_date=results['prediction_date'],
            confidence_scores=results.get('probabilities')
        )
        
    except Exception as e:
        logger.error(f"Error making predictions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@router.post("/detect-anomalies")
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Detect anomalies in investigation data using a trained model
    """
    try:
        # Verify investigation exists and belongs to user
        investigation = db.query(Investigation).filter(
            Investigation.id == request.investigation_id,
            Investigation.user_id == current_user.id
        ).first()
        
        if not investigation:
            raise HTTPException(status_code=404, detail="Investigation not found")
        
        if not investigation.results or 'processed_data' not in investigation.results:
            raise HTTPException(status_code=400, detail="No processed data available")
        
        # Load data
        data = pd.DataFrame(investigation.results['processed_data'])
        
        # Detect anomalies
        results = advanced_ml_engine.detect_anomalies(
            data=data,
            model_name=request.model_name
        )
        
        # Update investigation with anomaly results
        if 'anomaly_detection' not in investigation.results:
            investigation.results['anomaly_detection'] = []
            
        investigation.results['anomaly_detection'].append({
            'model_used': request.model_name,
            'detection_date': results['detection_date'],
            'anomalies_found': results['anomalies_detected'],
            'anomaly_rate': results['anomaly_rate'],
            'anomaly_records': results['anomaly_records'][:10]  # Store first 10 for preview
        })
        
        db.commit()
        
        return results
        
    except Exception as e:
        logger.error(f"Error detecting anomalies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@router.get("/insights/{model_name}", response_model=InsightsResponse)
async def get_model_insights(
    model_name: str,
    investigation_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate AI-powered insights and recommendations from a trained model
    """
    try:
        data = None
        if investigation_id:
            investigation = db.query(Investigation).filter(
                Investigation.id == investigation_id,
                Investigation.user_id == current_user.id
            ).first()
            
            if investigation and investigation.results and 'processed_data' in investigation.results:
                data = pd.DataFrame(investigation.results['processed_data'])
        
        # Generate insights
        insights_result = advanced_ml_engine.generate_insights(
            data=data if data is not None else pd.DataFrame(),
            model_name=model_name
        )
        
        # Generate recommendations based on model type and performance
        recommendations = generate_recommendations(model_name, insights_result)
        
        return InsightsResponse(
            model_name=insights_result['model_name'],
            insights=insights_result['insights'],
            generated_date=insights_result['generated_date'],
            recommendations=recommendations
        )
        
    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Insights generation failed: {str(e)}")

def generate_recommendations(model_name: str, insights_result: Dict[str, Any]) -> List[str]:
    """
    Generate actionable recommendations based on model insights
    """
    recommendations = []
    
    try:
        if model_name not in advanced_ml_engine.model_metadata:
            return ["Model metadata not available for recommendations"]
        
        metadata = advanced_ml_engine.model_metadata[model_name]
        model_type = metadata['model_type']
        
        if model_type == 'anomaly_detection':
            anomaly_rate = metadata.get('anomaly_rate', 0)
            
            if anomaly_rate > 0.15:
                recommendations.extend([
                    "High anomaly rate detected - investigate data collection process",
                    "Consider adjusting contamination parameter to reduce false positives",
                    "Review anomalous records for patterns that indicate data quality issues"
                ])
            elif anomaly_rate < 0.01:
                recommendations.extend([
                    "Very low anomaly rate - model may be too conservative",
                    "Consider lowering contamination parameter to catch more subtle anomalies",
                    "Data appears to be of high quality with minimal outliers"
                ])
            else:
                recommendations.extend([
                    "Anomaly rate within normal range - monitor for changes over time",
                    "Set up automated alerts for anomaly rate increases",
                    "Regularly retrain model with new data to maintain accuracy"
                ])
                
        elif model_type in ['classification', 'regression']:
            performance = metadata.get('performance_metrics', {})
            
            if model_type == 'classification':
                f1_score = performance.get('f1_score', 0)
                accuracy = performance.get('accuracy', 0)
                
                if f1_score < 0.7:
                    recommendations.extend([
                        "Model performance below optimal - consider feature engineering",
                        "Try different algorithms or ensemble methods",
                        "Collect more training data if possible",
                        "Check for class imbalance and apply balancing techniques"
                    ])
                elif f1_score > 0.9:
                    recommendations.extend([
                        "Excellent model performance - deploy to production",
                        "Monitor for model drift over time",
                        "Consider model interpretability for business insights"
                    ])
                else:
                    recommendations.extend([
                        "Good model performance - fine-tune hyperparameters",
                        "Validate on additional test sets",
                        "Consider feature selection to improve interpretability"
                    ])
                    
            else:  # regression
                r2_score = performance.get('r2_score', 0)
                
                if r2_score < 0.5:
                    recommendations.extend([
                        "Weak predictive relationship - explore additional features",
                        "Consider non-linear models or feature transformations",
                        "Check for temporal patterns or seasonality in data"
                    ])
                elif r2_score > 0.8:
                    recommendations.extend([
                        "Strong predictive model - suitable for forecasting",
                        "Monitor prediction intervals and uncertainty",
                        "Consider ensemble methods for improved robustness"
                    ])
                else:
                    recommendations.extend([
                        "Moderate predictive power - room for improvement",
                        "Experiment with polynomial features or interactions",
                        "Validate assumptions about data distribution"
                    ])
        
        # General recommendations
        recommendations.extend([
            "Regularly retrain models with fresh data",
            "Implement model monitoring and alerting",
            "Document model assumptions and limitations",
            "Consider A/B testing for model deployment"
        ])
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        recommendations = ["Unable to generate specific recommendations - check model status"]
    
    return recommendations

@router.delete("/models/{model_name}")
async def delete_model(
    model_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a trained model
    """
    try:
        if model_name not in advanced_ml_engine.models:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Remove model and associated data
        if model_name in advanced_ml_engine.models:
            del advanced_ml_engine.models[model_name]
        if model_name in advanced_ml_engine.scalers:
            del advanced_ml_engine.scalers[model_name]
        if model_name in advanced_ml_engine.encoders:
            del advanced_ml_engine.encoders[model_name]
        if model_name in advanced_ml_engine.model_metadata:
            del advanced_ml_engine.model_metadata[model_name]
        
        # Also remove anomaly detection variants
        for key in list(advanced_ml_engine.models.keys()):
            if key.startswith(f"{model_name}_"):
                del advanced_ml_engine.models[key]
        
        return {
            "message": f"Model '{model_name}' deleted successfully",
            "deleted_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error deleting model: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model deletion failed: {str(e)}")

@router.get("/model-status/{model_name}")
async def get_model_status(
    model_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed status and metadata for a specific model
    """
    try:
        if model_name not in advanced_ml_engine.model_metadata:
            raise HTTPException(status_code=404, detail="Model not found")
        
        metadata = advanced_ml_engine.model_metadata[model_name]
        
        # Check if model is loaded in memory
        is_loaded = model_name in advanced_ml_engine.models
        
        # Get model size estimation
        model_size = "Unknown"
        if is_loaded:
            try:
                import sys
                model_obj = advanced_ml_engine.models[model_name]
                model_size = f"{sys.getsizeof(model_obj) / 1024 / 1024:.2f} MB"
            except:
                pass
        
        return {
            "model_name": model_name,
            "is_loaded": is_loaded,
            "model_size": model_size,
            "metadata": metadata,
            "status": "ready" if is_loaded else "not_loaded",
            "last_accessed": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting model status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}") 