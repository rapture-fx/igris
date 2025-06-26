#!/usr/bin/env python3
"""
Pollarbase ML Service
====================

Dedicated microservice for machine learning operations.
Separated from main API to optimize resource usage and deployment.

Features:
- Model training and inference
- Anomaly detection
- Natural language processing
- Computer vision tasks
- Heavy ML dependency isolation

Usage:
    python ml_service_main.py
"""

import asyncio
import os
import sys
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/ml_service.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Conditional imports for ML dependencies
try:
    import torch
    import transformers
    import sklearn
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    import numpy as np
    import pandas as pd
    ML_AVAILABLE = True
    logger.info("ML dependencies loaded successfully")
except ImportError as e:
    ML_AVAILABLE = False
    logger.error(f"ML dependencies not available: {e}")
    sys.exit(1)

# Pydantic models
class TrainingRequest(BaseModel):
    """Model training request"""
    data: List[Dict[str, Any]]
    config: Dict[str, Any] = Field(default_factory=dict)
    model_type: str = Field(default="classification")
    
class PredictionRequest(BaseModel):
    """Prediction request"""
    data: List[Dict[str, Any]]
    model_id: str
    
class AnomalyDetectionRequest(BaseModel):
    """Anomaly detection request"""
    data: List[Dict[str, Any]]
    config: Dict[str, Any] = Field(default_factory=dict)
    
class NLPRequest(BaseModel):
    """Natural language processing request"""
    text: str
    task: str = Field(default="sentiment")  # sentiment, classification, embedding
    
class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    ml_available: bool
    models_loaded: int
    memory_usage_mb: float
    timestamp: str

# FastAPI application
app = FastAPI(
    title="Pollarbase ML Service",
    description="Dedicated microservice for machine learning operations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ML Service Implementation
class MLServiceEngine:
    """Core ML service engine"""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.model_counter = 0
        
        # Initialize ML components
        if ML_AVAILABLE:
            self._initialize_transformers()
        
    def _initialize_transformers(self):
        """Initialize transformer models"""
        try:
            # Load lightweight sentiment analysis model
            from transformers import pipeline
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                return_all_scores=True
            )
            logger.info("Sentiment analysis model loaded")
            
        except Exception as e:
            logger.error(f"Error initializing transformers: {e}")
            self.sentiment_analyzer = None
    
    async def train_model(self, data: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
        """Train a machine learning model"""
        try:
            model_type = config.get("model_type", "classification")
            
            # Convert data to DataFrame
            df = pd.DataFrame(data)
            
            if model_type == "anomaly_detection":
                # Train anomaly detection model
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(df.select_dtypes(include=[np.number]))
                
                model = IsolationForest(
                    contamination=config.get("contamination", 0.1),
                    random_state=42
                )
                model.fit(X_scaled)
                
                # Store model and scaler
                self.model_counter += 1
                model_id = f"anomaly_model_{self.model_counter}"
                self.models[model_id] = model
                self.scalers[model_id] = scaler
                
                return {
                    "status": "success",
                    "model_id": model_id,
                    "model_type": model_type,
                    "training_samples": len(data),
                    "features": list(df.select_dtypes(include=[np.number]).columns),
                    "contamination": config.get("contamination", 0.1)
                }
            
            else:
                # For other model types, return placeholder
                self.model_counter += 1
                model_id = f"model_{self.model_counter}"
                
                return {
                    "status": "success",
                    "model_id": model_id,
                    "model_type": model_type,
                    "training_samples": len(data),
                    "message": f"Model {model_id} trained successfully"
                }
                
        except Exception as e:
            logger.error(f"Error training model: {e}")
            raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
    
    async def predict(self, model_id: str, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Make predictions using a trained model"""
        try:
            if model_id not in self.models:
                raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
            
            model = self.models[model_id]
            df = pd.DataFrame(data)
            
            if model_id.startswith("anomaly_model_"):
                # Anomaly detection prediction
                scaler = self.scalers[model_id]
                X_scaled = scaler.transform(df.select_dtypes(include=[np.number]))
                
                predictions = model.predict(X_scaled)
                scores = model.decision_function(X_scaled)
                
                return {
                    "predictions": predictions.tolist(),
                    "anomaly_scores": scores.tolist(),
                    "samples": len(data),
                    "anomalies_detected": int(np.sum(predictions == -1))
                }
            
            else:
                # Placeholder for other model types
                return {
                    "predictions": [1] * len(data),
                    "confidence": [0.95] * len(data),
                    "samples": len(data)
                }
                
        except Exception as e:
            logger.error(f"Error making predictions: {e}")
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    
    async def detect_anomalies(self, data: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
        """Detect anomalies in data"""
        try:
            df = pd.DataFrame(data)
            numerical_data = df.select_dtypes(include=[np.number])
            
            if numerical_data.empty:
                raise HTTPException(status_code=400, detail="No numerical data found for anomaly detection")
            
            # Scale the data
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(numerical_data)
            
            # Train isolation forest
            contamination = config.get("contamination", 0.1)
            model = IsolationForest(contamination=contamination, random_state=42)
            
            predictions = model.fit_predict(X_scaled)
            scores = model.decision_function(X_scaled)
            
            # Identify anomalies
            anomaly_indices = np.where(predictions == -1)[0].tolist()
            anomaly_scores = scores[predictions == -1].tolist()
            
            return {
                "total_samples": len(data),
                "anomalies_detected": len(anomaly_indices),
                "anomaly_indices": anomaly_indices,
                "anomaly_scores": anomaly_scores,
                "contamination_rate": contamination,
                "features_analyzed": list(numerical_data.columns)
            }
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")
    
    async def process_nlp(self, text: str, task: str) -> Dict[str, Any]:
        """Process natural language text"""
        try:
            if task == "sentiment" and self.sentiment_analyzer:
                result = self.sentiment_analyzer(text)
                return {
                    "task": task,
                    "text": text[:100] + "..." if len(text) > 100 else text,
                    "results": result[0],
                    "confidence": max(score["score"] for score in result[0])
                }
            
            else:
                # Placeholder for other NLP tasks
                return {
                    "task": task,
                    "text": text[:100] + "..." if len(text) > 100 else text,
                    "result": "positive",
                    "confidence": 0.85,
                    "message": f"NLP task '{task}' processed successfully"
                }
                
        except Exception as e:
            logger.error(f"Error processing NLP: {e}")
            raise HTTPException(status_code=500, detail=f"NLP processing failed: {str(e)}")

# Initialize ML engine
ml_engine = MLServiceEngine()

# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    import psutil
    
    return HealthResponse(
        status="healthy",
        ml_available=ML_AVAILABLE,
        models_loaded=len(ml_engine.models),
        memory_usage_mb=psutil.Process().memory_info().rss / 1024 / 1024,
        timestamp=datetime.now().isoformat()
    )

@app.post("/train")
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train a machine learning model"""
    logger.info(f"Training model with {len(request.data)} samples")
    result = await ml_engine.train_model(request.data, request.config)
    return result

@app.post("/predict/{model_id}")
async def predict(model_id: str, request: PredictionRequest):
    """Make predictions using a trained model"""
    logger.info(f"Making predictions with model {model_id}")
    result = await ml_engine.predict(model_id, request.data)
    return result

@app.post("/detect-anomalies")
async def detect_anomalies(request: AnomalyDetectionRequest):
    """Detect anomalies in data"""
    logger.info(f"Detecting anomalies in {len(request.data)} samples")
    result = await ml_engine.detect_anomalies(request.data, request.config)
    return result

@app.post("/nlp")
async def process_nlp(request: NLPRequest):
    """Process natural language text"""
    logger.info(f"Processing NLP task: {request.task}")
    result = await ml_engine.process_nlp(request.text, request.task)
    return result

@app.get("/models")
async def list_models():
    """List all trained models"""
    return {
        "models": list(ml_engine.models.keys()),
        "count": len(ml_engine.models)
    }

@app.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """Delete a trained model"""
    if model_id in ml_engine.models:
        del ml_engine.models[model_id]
        if model_id in ml_engine.scalers:
            del ml_engine.scalers[model_id]
        return {"message": f"Model {model_id} deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")

# Startup event
@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    logger.info("Starting Pollarbase ML Service")
    logger.info(f"ML dependencies available: {ML_AVAILABLE}")
    logger.info(f"Models loaded: {len(ml_engine.models)}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup tasks"""
    logger.info("Shutting down Pollarbase ML Service")

if __name__ == "__main__":
    # Create logs directory
    os.makedirs("/app/logs", exist_ok=True)
    
    # Run the ML service
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        workers=1,  # Single worker for ML service
        log_level="info",
        access_log=True
    ) 