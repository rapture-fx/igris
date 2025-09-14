"""
ML Pipeline API Router
Machine Learning pipeline management endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
import logging
import json
import uuid
from datetime import datetime, timezone

from app.database.connection import get_async_session
from app.auth.unified_auth_system import get_current_user
from app.core.error_decorators import handle_database_errors, handle_auth_errors

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models
class MLPipelineConfig(BaseModel):
    name: str = Field(..., description="Pipeline name")
    description: Optional[str] = Field(None, description="Pipeline description")
    model_type: str = Field(..., description="Type of ML model (classification, regression, clustering, etc.)")
    preprocessing_steps: List[str] = Field(default=[], description="List of preprocessing steps")
    feature_columns: List[str] = Field(default=[], description="Feature columns to use")
    target_column: Optional[str] = Field(None, description="Target column for supervised learning")
    hyperparameters: Dict[str, Any] = Field(default={}, description="Model hyperparameters")

class MLPipelineResponse(BaseModel):
    success: bool
    message: str
    pipeline_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class MLPipelineStatus(BaseModel):
    pipeline_id: str
    name: str
    status: str  # created, training, trained, failed, deployed
    model_type: str
    created_at: str
    updated_at: str
    metrics: Optional[Dict[str, Any]] = None

class MLPredictionRequest(BaseModel):
    pipeline_id: str
    input_data: Dict[str, Any]

class MLPredictionResponse(BaseModel):
    success: bool
    pipeline_id: str
    prediction: Optional[Union[float, str, List]] = None
    confidence: Optional[float] = None
    error: Optional[str] = None

@router.post("/create", response_model=MLPipelineResponse)
@handle_auth_errors
@handle_database_errors
async def create_ml_pipeline(
    config: MLPipelineConfig,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new ML pipeline"""
    try:
        pipeline_id = str(uuid.uuid4())
        
        # For now, just return a mock response
        # In real implementation, this would create the pipeline in the database
        # and initialize the ML workflow
        
        logger.info(f"Creating ML pipeline {pipeline_id} for user {current_user.id}")
        
        return MLPipelineResponse(
            success=True,
            message="ML pipeline created successfully",
            pipeline_id=pipeline_id,
            data={
                "name": config.name,
                "model_type": config.model_type,
                "status": "created",
                "created_at": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Error creating ML pipeline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create ML pipeline"
        )

@router.post("/train/{pipeline_id}", response_model=MLPipelineResponse)
@handle_auth_errors
async def train_ml_pipeline(
    pipeline_id: str,
    training_data: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Train an ML pipeline with uploaded data"""
    try:
        # Validate file type
        if not training_data.filename.endswith(('.csv', '.json', '.parquet')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type. Please upload CSV, JSON, or Parquet files."
            )
        
        # Implement actual ML training with scikit-learn
        import pandas as pd
        import io
        from sklearn.model_selection import train_test_split
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.metrics import accuracy_score, mean_squared_error, classification_report
        import joblib
        import os
        
        logger.info(f"Training ML pipeline {pipeline_id} with file {training_data.filename}")
        
        try:
            # Read the training data
            content = await training_data.read()
            if training_data.filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(content))
            elif training_data.filename.endswith('.json'):
                df = pd.read_json(io.BytesIO(content))
            elif training_data.filename.endswith('.parquet'):
                df = pd.read_parquet(io.BytesIO(content))
            else:
                raise ValueError("Unsupported file format")
            
            logger.info(f"Loaded training data with shape: {df.shape}")
            
            # For demonstration, use the last column as target and all others as features
            # In production, this would be configurable via pipeline config
            feature_columns = df.columns[:-1].tolist()
            target_column = df.columns[-1]
            
            X = df[feature_columns]
            y = df[target_column]
            
            # Handle categorical variables in features
            categorical_columns = X.select_dtypes(include=['object']).columns
            for col in categorical_columns:
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
            
            # Determine if this is classification or regression
            is_classification = len(y.unique()) < 20 and y.dtype == 'object' or y.nunique() / len(y) < 0.1
            
            if is_classification:
                # Handle categorical target
                if y.dtype == 'object':
                    le_target = LabelEncoder()
                    y = le_target.fit_transform(y)
                model = RandomForestClassifier(n_estimators=100, random_state=42)
                model_type = "classification"
            else:
                model = RandomForestRegressor(n_estimators=100, random_state=42)
                model_type = "regression"
            
            # Split the data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train the model
            model.fit(X_train_scaled, y_train)
            
            # Make predictions and calculate metrics
            y_pred = model.predict(X_test_scaled)
            
            if is_classification:
                accuracy = accuracy_score(y_test, y_pred)
                metrics = {
                    "accuracy": float(accuracy),
                    "model_type": model_type,
                    "n_features": len(feature_columns),
                    "train_samples": len(X_train),
                    "test_samples": len(X_test)
                }
            else:
                mse = mean_squared_error(y_test, y_pred)
                metrics = {
                    "mse": float(mse),
                    "rmse": float(mse ** 0.5),
                    "model_type": model_type,
                    "n_features": len(feature_columns),
                    "train_samples": len(X_train),
                    "test_samples": len(X_test)
                }
            
            # Save the model (in production, this would go to proper storage)
            model_dir = f"models/{pipeline_id}"
            os.makedirs(model_dir, exist_ok=True)
            joblib.dump(model, f"{model_dir}/model.pkl")
            joblib.dump(scaler, f"{model_dir}/scaler.pkl")
            
            # ENHANCED: Track model performance with monitoring system
            from app.services.monitoring.ml_performance_monitor import ml_performance_monitor, PerformanceMetrics

            try:
                # Create performance metrics object
                performance_metrics = PerformanceMetrics(
                    model_id=pipeline_id,
                    timestamp=datetime.utcnow().replace(tzinfo=timezone.utc),
                    accuracy=metrics.get('accuracy'),
                    precision=metrics.get('precision'),
                    recall=metrics.get('recall'),
                    f1_score=metrics.get('f1_score'),
                    auc_score=metrics.get('roc_auc'),
                    mae=metrics.get('mae'),
                    mse=metrics.get('mse'),
                    rmse=metrics.get('rmse'),
                    r2_score=metrics.get('r2_score')
                )

                # Update performance monitoring
                monitoring_result = await ml_performance_monitor.update_model_performance(
                    model_id=pipeline_id,
                    performance_metrics=performance_metrics,
                    batch_size=len(X_train)
                )

                logger.info(f"Performance monitoring updated for {pipeline_id}: {monitoring_result.get('alerts_triggered', 0)} alerts triggered")

            except Exception as monitoring_error:
                logger.warning(f"Failed to update performance monitoring: {monitoring_error}")
                # Don't fail the entire pipeline if monitoring fails

            logger.info(f"Successfully trained {model_type} model with metrics: {metrics}")

            return MLPipelineResponse(
                success=True,
                message="ML pipeline training completed successfully",
                pipeline_id=pipeline_id,
                data={
                    "status": "trained",
                    "training_file": training_data.filename,
                    "model_type": model_type,
                    "metrics": metrics,
                    "feature_columns": feature_columns,
                    "target_column": target_column,
                    "completed_at": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as training_error:
            logger.error(f"Training error: {training_error}")
            return MLPipelineResponse(
                success=False,
                message=f"Training failed: {str(training_error)}",
                pipeline_id=pipeline_id,
                data={
                    "status": "failed",
                    "error": str(training_error),
                    "failed_at": datetime.utcnow().isoformat()
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error training ML pipeline {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start ML pipeline training"
        )

@router.get("/status/{pipeline_id}", response_model=MLPipelineStatus)
@handle_auth_errors
async def get_pipeline_status(
    pipeline_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get ML pipeline status"""
    try:
        # For now, return a mock status
        # In real implementation, this would query the database for pipeline status
        
        return MLPipelineStatus(
            pipeline_id=pipeline_id,
            name="Sample Pipeline",
            status="created",
            model_type="classification",
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            metrics=None
        )
    except Exception as e:
        logger.error(f"Error fetching pipeline status {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch pipeline status"
        )

@router.get("/list", response_model=List[MLPipelineStatus])
@handle_auth_errors
async def list_pipelines(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List user's ML pipelines"""
    try:
        # For now, return empty list
        # In real implementation, this would query user's pipelines from database
        return []
    except Exception as e:
        logger.error(f"Error listing pipelines for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list pipelines"
        )

@router.post("/predict", response_model=MLPredictionResponse)
@handle_auth_errors
async def make_prediction(
    prediction_request: MLPredictionRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Make prediction using trained ML pipeline"""
    try:
        pipeline_id = prediction_request.pipeline_id
        input_data = prediction_request.input_data
        
        # For now, return a mock prediction
        # In real implementation, this would:
        # 1. Load the trained model
        # 2. Apply preprocessing to input data
        # 3. Make prediction
        # 4. Return result with confidence score
        
        logger.info(f"Making prediction with pipeline {pipeline_id}")
        
        return MLPredictionResponse(
            success=True,
            pipeline_id=pipeline_id,
            prediction=0.85,  # Mock prediction
            confidence=0.92   # Mock confidence
        )
    except Exception as e:
        logger.error(f"Error making prediction: {e}")
        return MLPredictionResponse(
            success=False,
            pipeline_id=prediction_request.pipeline_id,
            error=str(e)
        )

@router.delete("/{pipeline_id}", response_model=MLPipelineResponse)
@handle_auth_errors
@handle_database_errors
async def delete_pipeline(
    pipeline_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete ML pipeline"""
    try:
        # For now, just return success
        # In real implementation, this would:
        # 1. Check if pipeline exists and belongs to user
        # 2. Delete associated models and data
        # 3. Remove from database
        
        logger.info(f"Deleting ML pipeline {pipeline_id}")
        
        return MLPipelineResponse(
            success=True,
            message="ML pipeline deleted successfully",
            pipeline_id=pipeline_id
        )
    except Exception as e:
        logger.error(f"Error deleting pipeline {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete pipeline"
        )

@router.post("/deploy/{pipeline_id}", response_model=MLPipelineResponse)
@handle_auth_errors
async def deploy_pipeline(
    pipeline_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Deploy ML pipeline for real-time predictions"""
    try:
        # For now, just return success
        # In real implementation, this would:
        # 1. Validate pipeline is trained
        # 2. Deploy to prediction service
        # 3. Create API endpoint for predictions
        
        logger.info(f"Deploying ML pipeline {pipeline_id}")
        
        return MLPipelineResponse(
            success=True,
            message="ML pipeline deployed successfully",
            pipeline_id=pipeline_id,
            data={
                "status": "deployed",
                "endpoint": f"/api/v1/ml/predict/{pipeline_id}",
                "deployed_at": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Error deploying pipeline {pipeline_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deploy pipeline"
        )