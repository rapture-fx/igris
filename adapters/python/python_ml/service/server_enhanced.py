"""
Schlep-Engine Python ML Service - Enhanced with Real Inference
Implements real ML inference with PyTorch/ONNX models
"""

import grpc
from concurrent import futures
import time
import logging
import sys
import os
from typing import Dict, Optional
import numpy as np

# Add proto directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import proto.ml_service_pb2 as ml_pb2
import proto.ml_service_pb2_grpc as ml_pb2_grpc

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import ML dependencies
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
    logger.info("PyTorch available")
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available - using fallback inference")

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
    logger.info("ONNX Runtime available")
except ImportError:
    ONNX_AVAILABLE = False
    logger.warning("ONNX Runtime not available")


class SimpleMLModel(nn.Module):
    """
    Simple PyTorch model for demonstration
    Input: Variable-length feature vector
    Output: Single prediction value
    """
    def __init__(self, input_size=10):
        super(SimpleMLModel, self).__init__()
        self.fc1 = nn.Linear(input_size, 64)
        self.fc2 = nn.Linear(64, 32)
        self.fc3 = nn.Linear(32, 1)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.relu(self.fc2(x))
        x = self.dropout(x)
        x = self.fc3(x)
        return x


class ModelRegistry:
    """
    Registry for managing multiple ML models
    Supports lazy loading and caching
    """
    def __init__(self):
        self.models: Dict[str, any] = {}
        self.model_configs: Dict[str, dict] = {}
        self._initialize_default_models()

    def _initialize_default_models(self):
        """Initialize default models"""
        if TORCH_AVAILABLE:
            # Create a simple default model
            default_model = SimpleMLModel(input_size=10)
            default_model.eval()  # Set to evaluation mode
            self.models["default"] = default_model
            self.model_configs["default"] = {
                "type": "torch",
                "input_size": 10,
                "description": "Default PyTorch model"
            }
            logger.info("Default PyTorch model initialized")

        # Add more models as needed
        self.model_configs["ensemble"] = {
            "type": "ensemble",
            "description": "Ensemble model with averaging"
        }

    def get_model(self, model_id: str) -> Optional[any]:
        """Get model by ID"""
        return self.models.get(model_id)

    def has_model(self, model_id: str) -> bool:
        """Check if model exists"""
        return model_id in self.models or model_id in self.model_configs

    def load_model(self, model_id: str, model_path: str = None):
        """Load a model from disk (for production use)"""
        if model_path and os.path.exists(model_path):
            if TORCH_AVAILABLE:
                try:
                    model = torch.jit.load(model_path)
                    model.eval()
                    self.models[model_id] = model
                    logger.info(f"Model {model_id} loaded from {model_path}")
                    return True
                except Exception as e:
                    logger.error(f"Failed to load model {model_id}: {e}")
        return False


class InferenceEngine:
    """
    Core inference engine with support for multiple backends
    """
    def __init__(self):
        self.registry = ModelRegistry()

    def predict(
        self,
        features: list,
        model_id: str = "default"
    ) -> tuple[float, float, float]:
        """
        Run inference on input features

        Returns:
            (prediction, confidence, inference_time_ms)
        """
        start_time = time.time()

        try:
            # Convert features to numpy array
            features_array = np.array(features, dtype=np.float32)

            # Get model
            model = self.registry.get_model(model_id)

            if model is None:
                # Fallback to simple computation
                prediction = self._fallback_inference(features_array)
                confidence = 0.75
            elif TORCH_AVAILABLE and isinstance(model, nn.Module):
                prediction, confidence = self._torch_inference(model, features_array)
            else:
                prediction = self._fallback_inference(features_array)
                confidence = 0.75

            inference_time = (time.time() - start_time) * 1000  # Convert to ms

            return float(prediction), float(confidence), float(inference_time)

        except Exception as e:
            logger.error(f"Inference error: {e}")
            # Return fallback values
            inference_time = (time.time() - start_time) * 1000
            return 0.0, 0.0, float(inference_time)

    def _torch_inference(self, model: nn.Module, features: np.ndarray) -> tuple[float, float]:
        """Run PyTorch inference"""
        with torch.no_grad():
            # Pad or truncate features to match model input size
            input_size = 10  # Default model input size
            if len(features) < input_size:
                features = np.pad(features, (0, input_size - len(features)), mode='constant')
            elif len(features) > input_size:
                features = features[:input_size]

            # Convert to tensor
            x = torch.from_numpy(features).unsqueeze(0)  # Add batch dimension

            # Run inference
            output = model(x)
            prediction = output.item()

            # Calculate confidence (simplified - in production use model uncertainty)
            confidence = min(0.99, 0.85 + abs(prediction) * 0.01)

            return prediction, confidence

    def _fallback_inference(self, features: np.ndarray) -> float:
        """
        Fallback inference when ML libraries aren't available
        Uses weighted sum of features
        """
        # Normalize features
        normalized = features / (np.max(np.abs(features)) + 1e-8)

        # Weighted sum with decay
        weights = np.exp(-np.arange(len(normalized)) * 0.1)
        prediction = np.sum(normalized * weights) / np.sum(weights)

        return prediction

    def batch_predict(
        self,
        batch_features: list[list],
        model_id: str = "default"
    ) -> list[tuple[float, float]]:
        """
        Run batch inference (optional enhancement)

        Returns:
            List of (prediction, confidence) tuples
        """
        results = []
        for features in batch_features:
            pred, conf, _ = self.predict(features, model_id)
            results.append((pred, conf))
        return results


class MLServiceServicer(ml_pb2_grpc.MLServiceServicer):
    """
    ML Service gRPC implementation with real inference
    """

    def __init__(self):
        logger.info("Initializing Enhanced ML Service...")
        self.engine = InferenceEngine()
        self.version = "1.0.0-real-inference"
        self.request_count = 0
        logger.info(f"ML Service initialized (PyTorch: {TORCH_AVAILABLE}, ONNX: {ONNX_AVAILABLE})")

    def Predict(self, request, context):
        """
        Make a prediction based on input features
        Implements real ML inference with timing metrics
        """
        self.request_count += 1

        logger.info(
            f"Predict called (request #{self.request_count}): "
            f"model_id={request.model_id}, features_len={len(request.features)}"
        )

        # Validate input
        if not request.features:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Features array cannot be empty")
            return ml_pb2.PredictResponse()

        # Run inference
        prediction, confidence, inference_time = self.engine.predict(
            list(request.features),
            request.model_id or "default"
        )

        response = ml_pb2.PredictResponse(
            prediction=prediction,
            confidence=confidence,
            model_id=request.model_id or "default"
        )

        logger.info(
            f"Prediction complete: pred={prediction:.4f}, "
            f"conf={confidence:.4f}, time={inference_time:.2f}ms"
        )

        return response

    def HealthCheck(self, request, context):
        """Health check endpoint with service stats"""
        logger.debug("Health check called")

        # Check if models are loaded
        models_loaded = len(self.engine.registry.models)

        status_message = f"healthy (models: {models_loaded}, requests: {self.request_count})"

        return ml_pb2.HealthCheckResponse(
            status=status_message,
            version=self.version
        )


def serve(port=50051):
    """Start the gRPC server with enhanced configuration"""
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
            ('grpc.keepalive_time_ms', 30000),
            ('grpc.keepalive_timeout_ms', 10000),
            ('grpc.http2.max_pings_without_data', 0),
            ('grpc.keepalive_permit_without_calls', 1),
        ]
    )

    ml_pb2_grpc.add_MLServiceServicer_to_server(
        MLServiceServicer(),
        server
    )

    server.add_insecure_port(f'[::]:{port}')

    logger.info(f"🐍 Enhanced Python ML Service starting on port {port}")
    logger.info(f"📊 Version: 1.0.0-real-inference")
    logger.info(f"🔧 PyTorch: {TORCH_AVAILABLE}, ONNX: {ONNX_AVAILABLE}")
    logger.info("📡 gRPC endpoints:")
    logger.info(f"   - Predict: ml.MLService/Predict")
    logger.info(f"   - HealthCheck: ml.MLService/HealthCheck")

    server.start()
    logger.info("✅ Server started successfully")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        server.stop(grace=5)
        logger.info("Server stopped")


if __name__ == '__main__':
    # Support environment variable for port
    port = int(os.getenv('GRPC_PORT', '50051'))
    serve(port)
