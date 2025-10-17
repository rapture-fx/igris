"""
Integration tests for ML Service

Tests cover:
- Full gRPC server lifecycle (start/stop)
- End-to-end request/response flow
- Concurrent request handling
- Server error recovery
- gRPC channel management
"""

import pytest
import grpc
import time
import threading
from concurrent import futures
import ml_service_pb2
import ml_service_pb2_grpc
from server import MLServiceServicer


@pytest.mark.integration
@pytest.mark.grpc
class TestGRPCServerLifecycle:
    """Test suite for gRPC server lifecycle management"""

    def test_server_starts_successfully(self):
        """Test that gRPC server starts successfully"""
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        ml_service_pb2_grpc.add_MLServiceServicer_to_server(
            MLServiceServicer(), server
        )

        port = server.add_insecure_port('[::]:0')
        server.start()

        # Server should start without errors
        assert port > 0

        # Cleanup
        server.stop(grace=1)

    def test_server_stops_gracefully(self):
        """Test that server stops gracefully"""
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        ml_service_pb2_grpc.add_MLServiceServicer_to_server(
            MLServiceServicer(), server
        )

        server.add_insecure_port('[::]:0')
        server.start()

        # Server should stop without errors
        server.stop(grace=1)

    def test_server_accepts_connections(self, grpc_channel, grpc_stub):
        """Test that server accepts client connections"""
        # Make a simple health check
        request = ml_service_pb2.HealthCheckRequest(detailed=False)
        response = grpc_stub.HealthCheck(request)

        assert response.status == "healthy"

    def test_server_handles_multiple_clients(self, grpc_channel):
        """Test server handles multiple concurrent clients"""
        # Create multiple stubs
        stubs = [ml_service_pb2_grpc.MLServiceStub(grpc_channel) for _ in range(5)]

        results = []

        def make_request(stub):
            request = ml_service_pb2.HealthCheckRequest(detailed=False)
            response = stub.HealthCheck(request)
            results.append(response.status)

        # Create threads for concurrent requests
        threads = []
        for stub in stubs:
            thread = threading.Thread(target=make_request, args=(stub,))
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # All requests should succeed
        assert len(results) == 5
        assert all(status == "healthy" for status in results)


@pytest.mark.integration
@pytest.mark.grpc
class TestEndToEndFlow:
    """Test suite for end-to-end request/response flow"""

    def test_predict_end_to_end(self, grpc_stub):
        """Test complete prediction flow from request to response"""
        # Create request
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[5.1, 3.5, 1.4, 0.2],
            metadata={"test": "e2e"}
        )

        # Make request
        response = grpc_stub.Predict(request)

        # Validate response
        assert response.error == ""
        assert response.prediction > 0
        assert response.model_id == "iris-classifier"
        assert response.latency_ms >= 0

    def test_batch_predict_end_to_end(self, grpc_stub):
        """Test complete batch prediction flow"""
        # Create batch request
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[5.1, 3.5, 1.4, 0.2]),
            ml_service_pb2.FeatureSet(features=[6.2, 2.9, 4.3, 1.3]),
        ]
        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        # Make request
        response = grpc_stub.BatchPredict(request)

        # Validate response
        assert len(response.predictions) == 2
        assert response.success_count == 2
        assert response.error_count == 0

    def test_health_check_end_to_end(self, grpc_stub):
        """Test complete health check flow"""
        request = ml_service_pb2.HealthCheckRequest(detailed=True)
        response = grpc_stub.HealthCheck(request)

        assert response.status == "healthy"
        assert len(response.loaded_models) > 0

    def test_model_info_end_to_end(self, grpc_stub):
        """Test complete model info flow"""
        request = ml_service_pb2.ModelInfoRequest(model_id="iris-classifier")
        response = grpc_stub.GetModelInfo(request)

        assert response.model_id == "iris-classifier"
        assert response.loaded is True

    def test_sequential_requests(self, grpc_stub):
        """Test sequential requests work correctly"""
        # Make multiple sequential requests
        for i in range(10):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[float(i)] * 4
            )
            response = grpc_stub.Predict(request)
            assert response.error == ""

    def test_mixed_request_types(self, grpc_stub):
        """Test mixing different request types"""
        # Health check
        health_response = grpc_stub.HealthCheck(
            ml_service_pb2.HealthCheckRequest(detailed=False)
        )
        assert health_response.status == "healthy"

        # Prediction
        predict_response = grpc_stub.Predict(
            ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[5.1, 3.5, 1.4, 0.2]
            )
        )
        assert predict_response.error == ""

        # Model info
        info_response = grpc_stub.GetModelInfo(
            ml_service_pb2.ModelInfoRequest(model_id="iris-classifier")
        )
        assert info_response.model_id == "iris-classifier"


@pytest.mark.integration
@pytest.mark.grpc
class TestConcurrentRequests:
    """Test suite for concurrent request handling"""

    def test_concurrent_predictions(self, grpc_stub):
        """Test concurrent prediction requests"""
        results = []
        errors = []

        def make_prediction(features):
            try:
                request = ml_service_pb2.PredictRequest(
                    model_id="iris-classifier",
                    features=features
                )
                response = grpc_stub.Predict(request)
                results.append(response)
            except Exception as e:
                errors.append(e)

        # Create threads
        threads = []
        for i in range(20):
            features = [float(i % 10)] * 4
            thread = threading.Thread(target=make_prediction, args=(features,))
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        # All requests should succeed
        assert len(errors) == 0
        assert len(results) == 20
        assert all(r.error == "" for r in results)

    def test_concurrent_batch_predictions(self, grpc_stub):
        """Test concurrent batch prediction requests"""
        results = []
        errors = []

        def make_batch_prediction():
            try:
                feature_sets = [
                    ml_service_pb2.FeatureSet(features=[float(i)] * 4)
                    for i in range(5)
                ]
                request = ml_service_pb2.BatchPredictRequest(
                    model_id="iris-classifier",
                    feature_sets=feature_sets
                )
                response = grpc_stub.BatchPredict(request)
                results.append(response)
            except Exception as e:
                errors.append(e)

        # Create threads
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_batch_prediction)
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        # All requests should succeed
        assert len(errors) == 0
        assert len(results) == 10
        assert all(r.success_count == 5 for r in results)

    def test_concurrent_mixed_requests(self, grpc_stub):
        """Test concurrent requests of different types"""
        results = []

        def make_health_check():
            request = ml_service_pb2.HealthCheckRequest(detailed=False)
            response = grpc_stub.HealthCheck(request)
            results.append(("health", response.status))

        def make_prediction():
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[5.1, 3.5, 1.4, 0.2]
            )
            response = grpc_stub.Predict(request)
            results.append(("predict", response.error))

        def make_model_info():
            request = ml_service_pb2.ModelInfoRequest(model_id="iris-classifier")
            response = grpc_stub.GetModelInfo(request)
            results.append(("info", response.model_id))

        # Create mixed threads
        threads = []
        for _ in range(3):
            threads.append(threading.Thread(target=make_health_check))
            threads.append(threading.Thread(target=make_prediction))
            threads.append(threading.Thread(target=make_model_info))

        # Start all threads
        for thread in threads:
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        # All requests should succeed
        assert len(results) == 9
        health_results = [r[1] for r in results if r[0] == "health"]
        predict_results = [r[1] for r in results if r[0] == "predict"]
        info_results = [r[1] for r in results if r[0] == "info"]

        assert all(s == "healthy" for s in health_results)
        assert all(e == "" for e in predict_results)
        assert all(m == "iris-classifier" for m in info_results)

    @pytest.mark.slow
    def test_sustained_load(self, grpc_stub):
        """Test server handles sustained load"""
        duration_seconds = 5
        request_count = [0]
        error_count = [0]
        stop_flag = [False]

        def make_requests():
            while not stop_flag[0]:
                try:
                    request = ml_service_pb2.PredictRequest(
                        model_id="iris-classifier",
                        features=[5.1, 3.5, 1.4, 0.2]
                    )
                    grpc_stub.Predict(request)
                    request_count[0] += 1
                except Exception:
                    error_count[0] += 1

        # Start threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_requests)
            threads.append(thread)
            thread.start()

        # Run for duration
        time.sleep(duration_seconds)
        stop_flag[0] = True

        # Wait for threads to finish
        for thread in threads:
            thread.join()

        # Should have handled many requests with minimal errors
        assert request_count[0] > 100  # At least 100 requests
        error_rate = error_count[0] / max(request_count[0], 1)
        assert error_rate < 0.01  # Less than 1% error rate


@pytest.mark.integration
class TestErrorRecovery:
    """Test suite for error recovery"""

    def test_server_recovers_from_bad_request(self, grpc_stub):
        """Test server recovers from bad requests"""
        # Make a bad request
        bad_request = ml_service_pb2.PredictRequest(
            model_id="",  # Missing model_id
            features=[1.0, 2.0]
        )

        try:
            grpc_stub.Predict(bad_request)
        except grpc.RpcError:
            pass  # Expected to fail

        # Server should still work for good requests
        good_request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[5.1, 3.5, 1.4, 0.2]
        )
        response = grpc_stub.Predict(good_request)
        assert response.error == ""

    def test_server_handles_invalid_model_gracefully(self, grpc_stub):
        """Test server handles invalid model requests gracefully"""
        request = ml_service_pb2.PredictRequest(
            model_id="non-existent-model",
            features=[1.0, 2.0, 3.0, 4.0]
        )

        response = grpc_stub.Predict(request)

        # Should return error but not crash
        assert "not found" in response.error.lower()

        # Server should still work
        health_response = grpc_stub.HealthCheck(
            ml_service_pb2.HealthCheckRequest(detailed=False)
        )
        assert health_response.status == "healthy"


@pytest.mark.integration
class TestChannelManagement:
    """Test suite for gRPC channel management"""

    def test_channel_closes_cleanly(self, grpc_channel):
        """Test that gRPC channel closes cleanly"""
        # Use the channel
        stub = ml_service_pb2_grpc.MLServiceStub(grpc_channel)
        request = ml_service_pb2.HealthCheckRequest(detailed=False)
        stub.HealthCheck(request)

        # Channel should close without errors (handled by fixture)
        # This test validates the fixture cleanup works

    def test_multiple_channels_same_server(self):
        """Test multiple channels to same server"""
        from concurrent import futures
        import grpc

        # Create server
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        ml_service_pb2_grpc.add_MLServiceServicer_to_server(
            MLServiceServicer(), server
        )
        port = 50053  # Use different port
        server.add_insecure_port(f'[::]:{port}')
        server.start()

        try:
            # Create multiple channels
            channels = [grpc.insecure_channel(f'localhost:{port}') for _ in range(3)]
            stubs = [ml_service_pb2_grpc.MLServiceStub(ch) for ch in channels]

            # All channels should work
            for stub in stubs:
                request = ml_service_pb2.HealthCheckRequest(detailed=False)
                response = stub.HealthCheck(request)
                assert response.status == "healthy"

            # Close channels
            for channel in channels:
                channel.close()

        finally:
            server.stop(grace=1)

    def test_channel_reusability(self, grpc_stub):
        """Test that channel can be reused for multiple requests"""
        # Make multiple requests on same stub
        for _ in range(10):
            request = ml_service_pb2.HealthCheckRequest(detailed=False)
            response = grpc_stub.HealthCheck(request)
            assert response.status == "healthy"
