"""
Schlep-Engine Python ML Service - Prototype
Minimal gRPC service demonstrating ML integration with Go gateway
"""

import grpc
from concurrent import futures
import time
import logging
import sys
import os

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


class MLServiceServicer(ml_pb2_grpc.MLServiceServicer):
    """
    ML Service implementation
    In production, this would load actual ML models (PyTorch, sklearn, etc.)
    For prototype, returns mock predictions
    """

    def __init__(self):
        logger.info("Initializing ML Service...")
        # In production: Load models here
        # self.model = torch.load('model.pth')
        self.version = "0.1.0-prototype"
        logger.info("ML Service initialized successfully")

    def Predict(self, request, context):
        """
        Make a prediction based on input features

        In production, this would:
        1. Load the specified model
        2. Preprocess features
        3. Run inference
        4. Postprocess results

        For prototype:
        - Returns sum of features as prediction
        - Returns 0.95 as confidence
        """
        logger.info(f"Predict called: model_id={request.model_id}, features={list(request.features)}")

        # Mock prediction logic
        # In production: prediction = model.predict(features)
        prediction = sum(request.features)  # Simple sum for testing
        confidence = 0.95  # Mock confidence

        response = ml_pb2.PredictResponse(
            prediction=prediction,
            confidence=confidence,
            model_id=request.model_id or "default-model"
        )

        logger.info(f"Prediction result: {prediction:.2f} (confidence: {confidence:.2f})")
        return response

    def HealthCheck(self, request, context):
        """Health check endpoint"""
        logger.debug("Health check called")
        return ml_pb2.HealthCheckResponse(
            status="healthy",
            version=self.version
        )


def serve(port=50051):
    """Start the gRPC server"""
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
        ]
    )

    ml_pb2_grpc.add_MLServiceServicer_to_server(
        MLServiceServicer(),
        server
    )

    server.add_insecure_port(f'[::]:{port}')

    logger.info(f"🐍 Python ML Service starting on port {port}")
    logger.info("📊 gRPC endpoints:")
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
    serve()
