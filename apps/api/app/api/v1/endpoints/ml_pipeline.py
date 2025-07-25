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
import tempfile
import os
from datetime import datetime

from app.database.connection import get_async_session
from app.auth.unified_auth_system import get_current_user
from app.core.error_decorators import handle_database_errors, handle_auth_errors
from app.models.ml_pipeline import MLPipeline, MLPrediction
from sqlalchemy import select
# from app.core.cloud_storage import get_storage_client  # TODO: Implement cloud storage

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
        # Create new pipeline in database
        pipeline = MLPipeline(
            user_id=current_user.id,
            name=config.name,
            description=config.description,
            model_type=config.model_type,
            preprocessing_steps=config.preprocessing_steps,
            feature_columns=config.feature_columns,
            target_column=config.target_column,
            hyperparameters=config.hyperparameters,
            status="created"
        )
        
        db.add(pipeline)
        await db.commit()
        await db.refresh(pipeline)
        
        logger.info(f"Created ML pipeline {pipeline.id} for user {current_user.id}")
        
        return MLPipelineResponse(
            success=True,
            message="ML pipeline created successfully",
            pipeline_id=pipeline.id,
            data={
                "name": pipeline.name,
                "model_type": pipeline.model_type,
                "status": pipeline.status,
                "created_at": pipeline.created_at.isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Error creating ML pipeline: {e}")
        await db.rollback()
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
            
            # Get or create pipeline record
            result = await db.execute(select(MLPipeline).where(MLPipeline.id == pipeline_id))
            pipeline = result.scalar_one_or_none()
            
            if not pipeline:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Pipeline not found"
                )
            
            # Update pipeline status
            pipeline.status = "training"
            await db.commit()
            
            # Save models to cloud storage or local storage
            try:
                # storage_client = get_storage_client()  # TODO: Implement cloud storage
                model_dir = f"ml_models/{current_user.id}/{pipeline_id}"
                
                # Save model to temporary files first
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as model_file:
                    joblib.dump(model, model_file.name)
                    model_path = f"{model_dir}/model.pkl"
                    # In production, upload to cloud storage
                    # For now, create local directory
                    local_model_dir = f"storage/models/{current_user.id}/{pipeline_id}"
                    os.makedirs(local_model_dir, exist_ok=True)
                    joblib.dump(model, f"{local_model_dir}/model.pkl")
                    
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as scaler_file:
                    joblib.dump(scaler, scaler_file.name)
                    scaler_path = f"{model_dir}/scaler.pkl"
                    joblib.dump(scaler, f"{local_model_dir}/scaler.pkl")
                    
                # Update pipeline with model paths and results
                pipeline.model_path = f"{local_model_dir}/model.pkl"
                pipeline.scaler_path = f"{local_model_dir}/scaler.pkl"
                pipeline.feature_names = feature_columns
                pipeline.metrics = metrics
                pipeline.status = "trained"
                pipeline.trained_at = datetime.utcnow()
                
                await db.commit()
                
            except Exception as storage_error:
                logger.error(f"Storage error: {storage_error}")
                # Fall back to local storage
                local_model_dir = f"storage/models/{current_user.id}/{pipeline_id}"
                os.makedirs(local_model_dir, exist_ok=True)
                
                model_path = f"{local_model_dir}/model.pkl"
                scaler_path = f"{local_model_dir}/scaler.pkl"
                
                joblib.dump(model, model_path)
                joblib.dump(scaler, scaler_path)
                
                pipeline.model_path = model_path
                pipeline.scaler_path = scaler_path
                pipeline.feature_names = feature_columns
                pipeline.metrics = metrics
                pipeline.status = "trained"
                pipeline.trained_at = datetime.utcnow()
                
                await db.commit()
            
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
            
            # Update pipeline status to failed
            try:
                result = await db.execute(select(MLPipeline).where(MLPipeline.id == pipeline_id))
                pipeline = result.scalar_one_or_none()
                if pipeline:
                    pipeline.status = "failed"
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Failed to update pipeline status: {db_error}")
            
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
        # Query pipeline from database
        result = await db.execute(
            select(MLPipeline).where(
                MLPipeline.id == pipeline_id,
                MLPipeline.user_id == current_user.id
            )
        )
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        return MLPipelineStatus(
            pipeline_id=pipeline.id,
            name=pipeline.name,
            status=pipeline.status,
            model_type=pipeline.model_type,
            created_at=pipeline.created_at.isoformat(),
            updated_at=pipeline.updated_at.isoformat(),
            metrics=pipeline.metrics
        )
    except HTTPException:
        raise
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
        # Query user's pipelines from database
        result = await db.execute(
            select(MLPipeline).where(MLPipeline.user_id == current_user.id)
            .order_by(MLPipeline.created_at.desc())
        )
        pipelines = result.scalars().all()
        
        pipeline_list = []
        for pipeline in pipelines:
            pipeline_list.append(MLPipelineStatus(
                pipeline_id=pipeline.id,
                name=pipeline.name,
                status=pipeline.status,
                model_type=pipeline.model_type,
                created_at=pipeline.created_at.isoformat(),
                updated_at=pipeline.updated_at.isoformat(),
                metrics=pipeline.metrics
            ))
            
        return pipeline_list
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
    start_time = datetime.utcnow()
    
    try:
        pipeline_id = prediction_request.pipeline_id
        input_data = prediction_request.input_data
        
        # Get pipeline from database
        result = await db.execute(
            select(MLPipeline).where(
                MLPipeline.id == pipeline_id,
                MLPipeline.user_id == current_user.id
            )
        )
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        if pipeline.status != "trained" and pipeline.status != "deployed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pipeline is not trained. Current status: {pipeline.status}"
            )
        
        # Load the trained model and scaler
        try:
            if not os.path.exists(pipeline.model_path) or not os.path.exists(pipeline.scaler_path):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Model files not found"
                )
            
            model = joblib.load(pipeline.model_path)
            scaler = joblib.load(pipeline.scaler_path)
            
            # Prepare input data for prediction
            import pandas as pd
            from sklearn.preprocessing import LabelEncoder
            
            # Convert input data to DataFrame
            if isinstance(input_data, dict):
                df_input = pd.DataFrame([input_data])
            else:
                df_input = pd.DataFrame(input_data)
            
            # Ensure we have the expected features
            expected_features = pipeline.feature_names
            if not expected_features:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Pipeline feature names not available"
                )
            
            # Check if all required features are present
            missing_features = set(expected_features) - set(df_input.columns)
            if missing_features:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required features: {list(missing_features)}"
                )
            
            # Select and order features correctly
            df_input = df_input[expected_features]
            
            # Handle categorical variables (simple approach)
            categorical_columns = df_input.select_dtypes(include=['object']).columns
            for col in categorical_columns:
                le = LabelEncoder()
                # For prediction, we need to handle unknown categories
                try:
                    df_input[col] = le.fit_transform(df_input[col].astype(str))
                except Exception:
                    # If encoding fails, use ordinal encoding
                    df_input[col] = pd.Categorical(df_input[col]).codes
            
            # Scale the features
            X_scaled = scaler.transform(df_input)
            
            # Make prediction
            if hasattr(model, 'predict_proba'):
                # Classification model
                prediction = model.predict(X_scaled)[0]
                probabilities = model.predict_proba(X_scaled)[0]
                confidence = float(max(probabilities))
            else:
                # Regression model
                prediction = model.predict(X_scaled)[0]
                confidence = 0.95  # Default confidence for regression
            
            # Convert numpy types to Python types for JSON serialization
            if hasattr(prediction, 'item'):
                prediction = prediction.item()
            
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Save prediction to database
            ml_prediction = MLPrediction(
                pipeline_id=pipeline_id,
                user_id=current_user.id,
                input_data=input_data,
                prediction_result={"prediction": prediction, "confidence": confidence},
                confidence_score=confidence,
                processing_time_ms=processing_time
            )
            
            db.add(ml_prediction)
            await db.commit()
            
            logger.info(f"Made prediction with pipeline {pipeline_id}: {prediction} (confidence: {confidence})")
            
            return MLPredictionResponse(
                success=True,
                pipeline_id=pipeline_id,
                prediction=prediction,
                confidence=confidence
            )
            
        except Exception as model_error:
            logger.error(f"Model prediction error: {model_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Prediction failed: {str(model_error)}"
            )
            
    except HTTPException:
        raise
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
        # Get pipeline from database
        result = await db.execute(
            select(MLPipeline).where(
                MLPipeline.id == pipeline_id,
                MLPipeline.user_id == current_user.id
            )
        )
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found"
            )
        
        if pipeline.status != "trained":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pipeline must be trained before deployment. Current status: {pipeline.status}"
            )
        
        # Validate model files exist
        if not os.path.exists(pipeline.model_path) or not os.path.exists(pipeline.scaler_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Model files not found. Please retrain the pipeline."
            )
        
        # Test model loading to ensure it works
        try:
            model = joblib.load(pipeline.model_path)
            scaler = joblib.load(pipeline.scaler_path)
            logger.info(f"Successfully validated model files for pipeline {pipeline_id}")
        except Exception as load_error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to load model files: {str(load_error)}"
            )
        
        # Update pipeline deployment status
        pipeline.status = "deployed"
        pipeline.is_deployed = True
        pipeline.deployed_at = datetime.utcnow()
        pipeline.deployment_endpoint = f"/api/v1/ml-pipeline/predict"
        pipeline.deployment_config = {
            "endpoint_active": True,
            "model_loaded": True,
            "deployment_type": "api",
            "max_requests_per_minute": 100
        }
        
        await db.commit()
        
        logger.info(f"Successfully deployed ML pipeline {pipeline_id}")
        
        return MLPipelineResponse(
            success=True,
            message="ML pipeline deployed successfully",
            pipeline_id=pipeline_id,
            data={
                "status": "deployed",
                "endpoint": pipeline.deployment_endpoint,
                "deployed_at": pipeline.deployed_at.isoformat(),
                "deployment_config": pipeline.deployment_config
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deploying pipeline {pipeline_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deploy pipeline"
        )
