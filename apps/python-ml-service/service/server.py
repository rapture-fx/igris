#!/usr/bin/env python3
"""
Schlep-Engine ML Service - gRPC Server
Isolated Python ML service for machine learning operations only.
Target: P99 latency <20ms for inference.
"""

import os
import sys
import time
import logging
from concurrent import futures
from typing import Dict, Any, List
import grpc
from grpc_reflection.v1alpha import reflection

# Add proto directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'proto'))

import ml_service_pb2
import ml_service_pb2_grpc

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ModelManager:
    """Manages ML model lifecycle (loading, unloading, caching)"""

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict[str, Any]] = {}
        self.start_time = time.time()

        # Pre-load default models
        self._load_default_models()

    def _load_default_models(self):
        """Load default ML models on startup"""
        logger.info("Loading default ML models...")

        # Example: Iris classifier (scikit-learn)
        self.models['iris-classifier'] = {
            'type': 'sklearn',
            'version': '1.0.0',
            'input_features': ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
            'output_classes': ['setosa', 'versicolor', 'virginica'],
            'predict_fn': self._mock_iris_predict
        }

        self.model_metadata['iris-classifier'] = {
            'loaded_at': time.time(),
            'prediction_count': 0,
            'avg_latency_ms': 0.0
        }

        logger.info(f"Loaded {len(self.models)} default models")

    def _mock_iris_predict(self, features: List[float]) -> Dict[str, Any]:
        """Mock prediction function for iris classifier"""
        # Simple mock: return sum of features as prediction
        prediction = sum(features) / len(features) if features else 0.0
        confidence = min(0.95, prediction / 10.0)

        return {
            'prediction': prediction,
            'confidence': confidence,
            'probabilities': {
                'setosa': 0.7 if prediction < 5 else 0.1,
                'versicolor': 0.2 if prediction < 5 else 0.6,
                'virginica': 0.1 if prediction < 5 else 0.3,
            }
        }

    def predict(self, model_id: str, features: List[float]) -> Dict[str, Any]:
        """Run prediction on specified model"""
        if model_id not in self.models:
            raise ValueError(f"Model '{model_id}' not found")

        start = time.time()

        model = self.models[model_id]
        result = model['predict_fn'](features)

        latency_ms = int((time.time() - start) * 1000)

        # Update metrics
        meta = self.model_metadata[model_id]
        meta['prediction_count'] += 1
        meta['avg_latency_ms'] = (
            (meta['avg_latency_ms'] * (meta['prediction_count'] - 1) + latency_ms)
            / meta['prediction_count']
        )

        result['latency_ms'] = latency_ms
        result['model_id'] = model_id

        return result

    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get metadata for a model"""
        if model_id not in self.models:
            raise ValueError(f"Model '{model_id}' not found")

        model = self.models[model_id]
        meta = self.model_metadata[model_id]

        return {
            'model_id': model_id,
            'type': model['type'],
            'version': model['version'],
            'input_features': model['input_features'],
            'output_classes': model['output_classes'],
            'loaded': True,
            'metadata': {
                'prediction_count': str(meta['prediction_count']),
                'avg_latency_ms': f"{meta['avg_latency_ms']:.2f}",
                'loaded_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(meta['loaded_at']))
            }
        }

    def get_uptime(self) -> int:
        """Get service uptime in seconds"""
        return int(time.time() - self.start_time)

    def get_loaded_models(self) -> List[str]:
        """Get list of currently loaded models"""
        return list(self.models.keys())


class MLServiceServicer(ml_service_pb2_grpc.MLServiceServicer):
    """gRPC service implementation for ML operations"""

    def __init__(self):
        self.model_manager = ModelManager()
        logger.info("ML Service initialized")

    def Predict(self, request, context):
        """Handle single prediction request"""
        try:
            start = time.time()

            # Validate request
            if not request.model_id:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("model_id is required")
                return ml_service_pb2.PredictResponse(error="model_id is required")

            if not request.features:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("features are required")
                return ml_service_pb2.PredictResponse(error="features are required")

            # Run prediction
            result = self.model_manager.predict(
                model_id=request.model_id,
                features=list(request.features)
            )

            latency_ms = int((time.time() - start) * 1000)

            logger.info(
                f"Prediction: model={request.model_id}, "
                f"latency={latency_ms}ms, "
                f"result={result['prediction']:.2f}"
            )

            return ml_service_pb2.PredictResponse(
                prediction=result['prediction'],
                confidence=result['confidence'],
                model_id=result['model_id'],
                latency_ms=latency_ms,
                probabilities=result.get('probabilities', {})
            )

        except ValueError as e:
            logger.error(f"Prediction error: {str(e)}")
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(str(e))
            return ml_service_pb2.PredictResponse(error=str(e))

        except Exception as e:
            logger.error(f"Prediction error: {str(e)}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ml_service_pb2.PredictResponse(error=str(e))

    def BatchPredict(self, request, context):
        """Handle batch prediction request"""
        try:
            start = time.time()

            if not request.model_id:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("model_id is required")
                return ml_service_pb2.BatchPredictResponse()

            predictions = []
            success_count = 0
            error_count = 0

            for feature_set in request.feature_sets:
                try:
                    result = self.model_manager.predict(
                        model_id=request.model_id,
                        features=list(feature_set.features)
                    )

                    predictions.append(ml_service_pb2.PredictResponse(
                        prediction=result['prediction'],
                        confidence=result['confidence'],
                        model_id=result['model_id'],
                        latency_ms=result['latency_ms'],
                        probabilities=result.get('probabilities', {})
                    ))
                    success_count += 1

                except Exception as e:
                    predictions.append(ml_service_pb2.PredictResponse(
                        error=str(e)
                    ))
                    error_count += 1

            total_latency_ms = int((time.time() - start) * 1000)

            logger.info(
                f"Batch prediction: model={request.model_id}, "
                f"count={len(request.feature_sets)}, "
                f"success={success_count}, "
                f"errors={error_count}, "
                f"latency={total_latency_ms}ms"
            )

            return ml_service_pb2.BatchPredictResponse(
                predictions=predictions,
                total_latency_ms=total_latency_ms,
                success_count=success_count,
                error_count=error_count
            )

        except Exception as e:
            logger.error(f"Batch prediction error: {str(e)}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ml_service_pb2.BatchPredictResponse()

    def HealthCheck(self, request, context):
        """Handle health check request"""
        try:
            uptime = self.model_manager.get_uptime()
            loaded_models = self.model_manager.get_loaded_models()

            system_metrics = {
                'uptime_seconds': str(uptime),
                'loaded_models_count': str(len(loaded_models)),
            }

            response = ml_service_pb2.HealthCheckResponse(
                status='healthy',
                uptime_seconds=uptime,
                loaded_models_count=len(loaded_models),
                system_metrics=system_metrics
            )

            if request.detailed:
                response.loaded_models.extend(loaded_models)

            return response

        except Exception as e:
            logger.error(f"Health check error: {str(e)}", exc_info=True)
            return ml_service_pb2.HealthCheckResponse(
                status='unhealthy',
                system_metrics={'error': str(e)}
            )

    def GetModelInfo(self, request, context):
        """Handle model info request"""
        try:
            if not request.model_id:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("model_id is required")
                return ml_service_pb2.ModelInfoResponse()

            info = self.model_manager.get_model_info(request.model_id)

            return ml_service_pb2.ModelInfoResponse(
                model_id=info['model_id'],
                model_type=info['type'],
                version=info['version'],
                input_features=info['input_features'],
                output_classes=info['output_classes'],
                loaded=info['loaded'],
                metadata=info['metadata']
            )

        except ValueError as e:
            logger.error(f"Model info error: {str(e)}")
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(str(e))
            return ml_service_pb2.ModelInfoResponse()

        except Exception as e:
            logger.error(f"Model info error: {str(e)}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ml_service_pb2.ModelInfoResponse()

    def LoadModel(self, request, context):
        """Handle model loading request"""
        # Not implemented in this prototype
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("LoadModel not implemented")
        return ml_service_pb2.LoadModelResponse(
            success=False,
            message="Not implemented"
        )

    def UnloadModel(self, request, context):
        """Handle model unloading request"""
        # Not implemented in this prototype
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("UnloadModel not implemented")
        return ml_service_pb2.UnloadModelResponse(
            success=False,
            message="Not implemented"
        )


def serve():
    """Start the gRPC server"""
    port = os.getenv('ML_SERVICE_PORT', '50051')
    max_workers = int(os.getenv('MAX_WORKERS', '10'))

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=max_workers),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.keepalive_time_ms', 30000),
            ('grpc.keepalive_timeout_ms', 10000),
            ('grpc.keepalive_permit_without_calls', True),
            ('grpc.http2.max_pings_without_data', 0),
        ]
    )

    ml_service_pb2_grpc.add_MLServiceServicer_to_server(
        MLServiceServicer(), server
    )

    # Enable server reflection for debugging
    SERVICE_NAMES = (
        ml_service_pb2.DESCRIPTOR.services_by_name['MLService'].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(SERVICE_NAMES, server)

    server.add_insecure_port(f'[::]:{port}')

    logger.info(f"Starting ML Service on port {port} with {max_workers} workers")
    server.start()
    logger.info(f"ML Service listening on port {port}")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down ML Service...")
        server.stop(grace=5)
        logger.info("ML Service stopped")


if __name__ == '__main__':
    serve()
