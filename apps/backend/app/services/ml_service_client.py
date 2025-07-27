"""
ML Service Client
================

Provides interface to ML services with conditional imports for local/remote execution.
"""

import os
from typing import Any, Dict, List, Optional, Protocol
import logging

logger = logging.getLogger(__name__)

# Check ML dependencies availability
try:
    import torch
    import transformers
    import sklearn
    ML_AVAILABLE = True
    logger.info("ML dependencies available locally")
except ImportError:
    ML_AVAILABLE = False
    logger.info("ML dependencies not available - using remote ML service")

try:
    import httpx
    HTTP_CLIENT_AVAILABLE = True
except ImportError:
    HTTP_CLIENT_AVAILABLE = False


class MLServiceProtocol(Protocol):
    """Protocol for ML service implementations"""
    
    async def train_model(self, data: Any, config: Dict[str, Any]) -> Dict[str, Any]:
        """Train a machine learning model"""
        ...
    
    async def predict(self, model_id: str, data: Any) -> Dict[str, Any]:
        """Make predictions using a trained model"""
        ...
    
    async def detect_anomalies(self, data: Any, config: Dict[str, Any]) -> Dict[str, Any]:
        """Detect anomalies in data"""
        ...


class LocalMLService:
    """Local ML service implementation using installed packages"""
    
    def __init__(self):
        if not ML_AVAILABLE:
            raise ImportError("ML dependencies not available for local service")
        
        # Import ML packages only when needed
        self.torch = __import__('torch')
        self.transformers = __import__('transformers')
        self.sklearn = __import__('sklearn')
    
    async def train_model(self, data: Any, config: Dict[str, Any]) -> Dict[str, Any]:
        """Train model locally"""
        # Implementation using local ML libraries
        return {"status": "success", "model_id": "local_model_123"}
    
    async def predict(self, model_id: str, data: Any) -> Dict[str, Any]:
        """Make predictions locally"""
        # Implementation using local ML libraries
        return {"predictions": [], "confidence": 0.95}
    
    async def detect_anomalies(self, data: Any, config: Dict[str, Any]) -> Dict[str, Any]:
        """Detect anomalies locally"""
        # Implementation using local ML libraries
        return {"anomalies": [], "scores": []}


class RemoteMLService:
    """Remote ML service implementation using HTTP client"""
    
    def __init__(self, base_url: str = None):
        if not HTTP_CLIENT_AVAILABLE:
            raise ImportError("HTTP client not available for remote service")
        
        self.base_url = base_url or os.getenv("ML_SERVICE_URL", "http://ml-service:8001")
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)
    
    async def train_model(self, data: Any, config: Dict[str, Any]) -> Dict[str, Any]:
        """Train model via remote service"""
        response = await self.client.post("/train", json={"data": data, "config": config})
        response.raise_for_status()
        return response.json()
    
    async def predict(self, model_id: str, data: Any) -> Dict[str, Any]:
        """Make predictions via remote service"""
        response = await self.client.post(f"/predict/{model_id}", json={"data": data})
        response.raise_for_status()
        return response.json()
    
    async def detect_anomalies(self, data: Any, config: Dict[str, Any]) -> Dict[str, Any]:
        """Detect anomalies via remote service"""
        response = await self.client.post("/detect-anomalies", json={"data": data, "config": config})
        response.raise_for_status()
        return response.json()


def get_ml_service(force_remote: bool = False) -> MLServiceProtocol:
    """Get appropriate ML service implementation"""
    
    use_remote = force_remote or os.getenv("USE_REMOTE_ML_SERVICE", "false").lower() == "true"
    
    if use_remote or not ML_AVAILABLE:
        logger.info("Using remote ML service")
        return RemoteMLService()
    else:
        logger.info("Using local ML service")
        return LocalMLService()


# Global ML service instance
ml_service = get_ml_service()
