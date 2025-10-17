"""
Pytest configuration and shared fixtures for ML Service tests
"""

import os
import sys
import time
import pytest
import grpc
from typing import Generator, Dict, Any, List
from concurrent import futures
from unittest.mock import Mock, MagicMock

# Add project paths to Python path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'service'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'proto'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'orchestration'))

# Import after path setup
import ml_service_pb2
import ml_service_pb2_grpc
from server import ModelManager, MLServiceServicer
from auth_interceptor import AuthInterceptor, APIKeyInterceptor, create_auth_interceptor
from training_orchestrator import TrainingOrchestrator, TrainingJob, TrainingStatus


# ============================================================================
# Environment Setup
# ============================================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment variables"""
    os.environ['AUTH_MODE'] = 'none'
    os.environ['ML_SERVICE_PORT'] = '50052'  # Different from production
    os.environ['MAX_WORKERS'] = '5'
    yield
    # Cleanup
    for key in ['AUTH_MODE', 'ML_SERVICE_PORT', 'MAX_WORKERS']:
        os.environ.pop(key, None)


# ============================================================================
# Proto Message Fixtures
# ============================================================================

@pytest.fixture
def valid_predict_request() -> ml_service_pb2.PredictRequest:
    """Create a valid PredictRequest"""
    return ml_service_pb2.PredictRequest(
        model_id="iris-classifier",
        features=[5.1, 3.5, 1.4, 0.2],
        metadata={"source": "test"},
        timeout_ms=1000
    )


@pytest.fixture
def invalid_predict_request_no_model() -> ml_service_pb2.PredictRequest:
    """Create a PredictRequest without model_id"""
    return ml_service_pb2.PredictRequest(
        model_id="",
        features=[5.1, 3.5, 1.4, 0.2]
    )


@pytest.fixture
def invalid_predict_request_no_features() -> ml_service_pb2.PredictRequest:
    """Create a PredictRequest without features"""
    return ml_service_pb2.PredictRequest(
        model_id="iris-classifier",
        features=[]
    )


@pytest.fixture
def invalid_predict_request_unknown_model() -> ml_service_pb2.PredictRequest:
    """Create a PredictRequest with unknown model"""
    return ml_service_pb2.PredictRequest(
        model_id="unknown-model",
        features=[1.0, 2.0, 3.0]
    )


@pytest.fixture
def valid_batch_predict_request() -> ml_service_pb2.BatchPredictRequest:
    """Create a valid BatchPredictRequest"""
    feature_sets = [
        ml_service_pb2.FeatureSet(features=[5.1, 3.5, 1.4, 0.2], identifier="sample1"),
        ml_service_pb2.FeatureSet(features=[6.2, 2.9, 4.3, 1.3], identifier="sample2"),
        ml_service_pb2.FeatureSet(features=[7.3, 2.8, 6.3, 1.8], identifier="sample3"),
    ]
    return ml_service_pb2.BatchPredictRequest(
        model_id="iris-classifier",
        feature_sets=feature_sets,
        metadata={"batch": "test"},
        timeout_ms=5000
    )


@pytest.fixture
def empty_batch_predict_request() -> ml_service_pb2.BatchPredictRequest:
    """Create a BatchPredictRequest with no feature sets"""
    return ml_service_pb2.BatchPredictRequest(
        model_id="iris-classifier",
        feature_sets=[],
        metadata={"batch": "empty"}
    )


@pytest.fixture
def health_check_request_basic() -> ml_service_pb2.HealthCheckRequest:
    """Create a basic HealthCheckRequest"""
    return ml_service_pb2.HealthCheckRequest(detailed=False)


@pytest.fixture
def health_check_request_detailed() -> ml_service_pb2.HealthCheckRequest:
    """Create a detailed HealthCheckRequest"""
    return ml_service_pb2.HealthCheckRequest(detailed=True)


@pytest.fixture
def model_info_request() -> ml_service_pb2.ModelInfoRequest:
    """Create a valid ModelInfoRequest"""
    return ml_service_pb2.ModelInfoRequest(model_id="iris-classifier")


@pytest.fixture
def model_info_request_invalid() -> ml_service_pb2.ModelInfoRequest:
    """Create an invalid ModelInfoRequest"""
    return ml_service_pb2.ModelInfoRequest(model_id="")


# ============================================================================
# Service Component Fixtures
# ============================================================================

@pytest.fixture
def model_manager() -> ModelManager:
    """Create a fresh ModelManager instance"""
    return ModelManager()


@pytest.fixture
def ml_servicer() -> MLServiceServicer:
    """Create a fresh MLServiceServicer instance"""
    return MLServiceServicer()


@pytest.fixture
def mock_context() -> Mock:
    """Create a mock gRPC context"""
    context = Mock(spec=grpc.ServicerContext)
    context.set_code = Mock()
    context.set_details = Mock()
    context.invocation_metadata = Mock(return_value=[])
    return context


@pytest.fixture
def training_orchestrator() -> TrainingOrchestrator:
    """Create a fresh TrainingOrchestrator instance"""
    orchestrator = TrainingOrchestrator()
    # Override models_dir to use temp directory
    import tempfile
    orchestrator.models_dir = tempfile.mkdtemp()
    yield orchestrator
    # Cleanup
    import shutil
    if os.path.exists(orchestrator.models_dir):
        shutil.rmtree(orchestrator.models_dir)


# ============================================================================
# gRPC Server Fixtures
# ============================================================================

@pytest.fixture
def grpc_server() -> Generator[grpc.Server, None, None]:
    """Create a test gRPC server"""
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=5),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
        ]
    )

    ml_service_pb2_grpc.add_MLServiceServicer_to_server(
        MLServiceServicer(), server
    )

    port = server.add_insecure_port('[::]:0')  # Let OS assign port
    server.start()

    yield server

    server.stop(grace=1)


@pytest.fixture
def grpc_channel(grpc_server) -> Generator[grpc.Channel, None, None]:
    """Create a test gRPC channel"""
    # Get the port from the server
    port = 50052  # Use test port
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=5),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
        ]
    )

    ml_service_pb2_grpc.add_MLServiceServicer_to_server(
        MLServiceServicer(), server
    )

    server.add_insecure_port(f'[::]:{port}')
    server.start()

    channel = grpc.insecure_channel(f'localhost:{port}')

    yield channel

    channel.close()
    server.stop(grace=1)


@pytest.fixture
def grpc_stub(grpc_channel) -> ml_service_pb2_grpc.MLServiceStub:
    """Create a test gRPC stub"""
    return ml_service_pb2_grpc.MLServiceStub(grpc_channel)


# ============================================================================
# Test Data Generators
# ============================================================================

@pytest.fixture
def sample_features() -> List[float]:
    """Generate sample feature vectors"""
    return [5.1, 3.5, 1.4, 0.2]


@pytest.fixture
def sample_features_batch() -> List[List[float]]:
    """Generate batch of feature vectors"""
    return [
        [5.1, 3.5, 1.4, 0.2],
        [6.2, 2.9, 4.3, 1.3],
        [7.3, 2.8, 6.3, 1.8],
        [4.9, 3.0, 1.4, 0.2],
        [5.8, 2.7, 5.1, 1.9],
    ]


@pytest.fixture
def training_data_sample() -> List[Dict[str, Any]]:
    """Generate sample training data"""
    return [
        {"features": [5.1, 3.5, 1.4, 0.2], "numeric_label": 0},
        {"features": [6.2, 2.9, 4.3, 1.3], "numeric_label": 1},
        {"features": [7.3, 2.8, 6.3, 1.8], "numeric_label": 2},
        {"features": [4.9, 3.0, 1.4, 0.2], "numeric_label": 0},
        {"features": [5.8, 2.7, 5.1, 1.9], "numeric_label": 2},
        {"features": [6.7, 3.1, 4.4, 1.4], "numeric_label": 1},
        {"features": [5.4, 3.9, 1.7, 0.4], "numeric_label": 0},
        {"features": [6.3, 2.5, 5.0, 1.9], "numeric_label": 2},
        {"features": [5.6, 2.9, 3.6, 1.3], "numeric_label": 1},
        {"features": [7.7, 3.0, 6.1, 2.3], "numeric_label": 2},
    ]


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest.fixture
def jwt_secret() -> str:
    """JWT secret for testing"""
    return "test-secret-key-for-jwt-tokens"


@pytest.fixture
def valid_jwt_token(jwt_secret) -> str:
    """Generate a valid JWT token for testing"""
    import jwt
    payload = {
        "user_id": "test-user-123",
        "exp": time.time() + 3600  # 1 hour from now
    }
    return jwt.encode(payload, jwt_secret, algorithm="HS256")


@pytest.fixture
def expired_jwt_token(jwt_secret) -> str:
    """Generate an expired JWT token for testing"""
    import jwt
    payload = {
        "user_id": "test-user-123",
        "exp": time.time() - 3600  # 1 hour ago
    }
    return jwt.encode(payload, jwt_secret, algorithm="HS256")


@pytest.fixture
def invalid_jwt_token() -> str:
    """Invalid JWT token for testing"""
    return "invalid.jwt.token"


@pytest.fixture
def valid_api_keys() -> set:
    """Valid API keys for testing"""
    return {"test-api-key-1", "test-api-key-2", "test-api-key-3"}


@pytest.fixture
def auth_interceptor_jwt(jwt_secret) -> AuthInterceptor:
    """Create JWT auth interceptor for testing"""
    return AuthInterceptor(jwt_secret, public_methods=['HealthCheck'])


@pytest.fixture
def auth_interceptor_api_key(valid_api_keys) -> APIKeyInterceptor:
    """Create API key auth interceptor for testing"""
    return APIKeyInterceptor(valid_api_keys, public_methods=['HealthCheck'])


# ============================================================================
# Performance Testing Fixtures
# ============================================================================

@pytest.fixture
def performance_feature_batch() -> List[List[float]]:
    """Generate large batch for performance testing"""
    return [[float(i) for i in range(4)] for _ in range(1000)]


@pytest.fixture
def benchmark_context():
    """Context for benchmark tests"""
    return {
        "iterations": 100,
        "warmup_iterations": 10,
        "max_latency_ms": 20,  # Target P99 < 20ms
    }


# ============================================================================
# Mock Model Fixtures
# ============================================================================

@pytest.fixture
def mock_model():
    """Create a mock ML model"""
    model = MagicMock()
    model.predict = Mock(return_value=[0, 1, 2])
    model.predict_proba = Mock(return_value=[[0.9, 0.05, 0.05]])
    return model


@pytest.fixture
def mock_model_file(tmp_path):
    """Create a mock model file"""
    import joblib
    from sklearn.ensemble import RandomForestClassifier

    # Create a simple trained model
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    X = [[1, 2], [3, 4], [5, 6], [7, 8]]
    y = [0, 1, 0, 1]
    model.fit(X, y)

    # Save to temp file
    model_path = tmp_path / "test_model.pkl"
    joblib.dump(model, model_path)

    return str(model_path)


# ============================================================================
# Utility Fixtures
# ============================================================================

@pytest.fixture
def capture_logs(caplog):
    """Fixture to capture and analyze logs"""
    import logging
    caplog.set_level(logging.INFO)
    return caplog


@pytest.fixture
def temp_models_dir(tmp_path):
    """Create temporary directory for model storage"""
    models_dir = tmp_path / "models"
    models_dir.mkdir()
    return str(models_dir)


@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset singleton instances between tests"""
    import training_orchestrator
    training_orchestrator._orchestrator = None
    yield
    training_orchestrator._orchestrator = None
