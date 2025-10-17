"""
Unit tests for Predict RPC handler

Tests cover:
- Valid prediction requests
- Invalid inputs (missing model_id, missing features, unknown model)
- Error handling and error messages
- Response format validation
- Latency tracking
"""

import pytest
import grpc
from unittest.mock import Mock, patch
import ml_service_pb2


@pytest.mark.unit
@pytest.mark.grpc
class TestPredictRPC:
    """Test suite for Predict RPC handler"""

    def test_predict_valid_request(self, ml_servicer, valid_predict_request, mock_context):
        """Test successful prediction with valid request"""
        response = ml_servicer.Predict(valid_predict_request, mock_context)

        # Validate response structure
        assert response is not None
        assert isinstance(response, ml_service_pb2.PredictResponse)

        # Validate prediction values
        assert response.prediction > 0
        assert 0 <= response.confidence <= 1.0
        assert response.model_id == "iris-classifier"
        assert response.latency_ms >= 0
        assert response.error == ""

        # Validate probabilities
        assert len(response.probabilities) == 3
        assert "setosa" in response.probabilities
        assert "versicolor" in response.probabilities
        assert "virginica" in response.probabilities

        # Context should not have error codes set
        mock_context.set_code.assert_not_called()

    def test_predict_different_feature_values(self, ml_servicer, mock_context):
        """Test prediction with different feature values produces different results"""
        # Create two requests with different features
        request1 = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[1.0, 1.0, 1.0, 1.0]
        )
        request2 = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[7.0, 7.0, 7.0, 7.0]
        )

        response1 = ml_servicer.Predict(request1, mock_context)
        response2 = ml_servicer.Predict(request2, mock_context)

        # Different inputs should produce different predictions
        assert response1.prediction != response2.prediction

    def test_predict_missing_model_id(self, ml_servicer, invalid_predict_request_no_model, mock_context):
        """Test prediction fails when model_id is missing"""
        response = ml_servicer.Predict(invalid_predict_request_no_model, mock_context)

        # Should return error response
        assert response.error == "model_id is required"
        assert response.prediction == 0

        # Context should have error code set
        mock_context.set_code.assert_called_with(grpc.StatusCode.INVALID_ARGUMENT)
        mock_context.set_details.assert_called_with("model_id is required")

    def test_predict_missing_features(self, ml_servicer, invalid_predict_request_no_features, mock_context):
        """Test prediction fails when features are missing"""
        response = ml_servicer.Predict(invalid_predict_request_no_features, mock_context)

        # Should return error response
        assert response.error == "features are required"
        assert response.prediction == 0

        # Context should have error code set
        mock_context.set_code.assert_called_with(grpc.StatusCode.INVALID_ARGUMENT)
        mock_context.set_details.assert_called_with("features are required")

    def test_predict_unknown_model(self, ml_servicer, invalid_predict_request_unknown_model, mock_context):
        """Test prediction fails with unknown model"""
        response = ml_servicer.Predict(invalid_predict_request_unknown_model, mock_context)

        # Should return error response
        assert "not found" in response.error.lower()
        assert response.prediction == 0

        # Context should have NOT_FOUND error code
        mock_context.set_code.assert_called_with(grpc.StatusCode.NOT_FOUND)

    def test_predict_tracks_latency(self, ml_servicer, valid_predict_request, mock_context):
        """Test that latency is properly tracked"""
        response = ml_servicer.Predict(valid_predict_request, mock_context)

        # Latency should be tracked and positive
        assert response.latency_ms > 0
        assert response.latency_ms < 1000  # Should be fast for mock model

    def test_predict_with_metadata(self, ml_servicer, mock_context):
        """Test prediction with custom metadata"""
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[5.1, 3.5, 1.4, 0.2],
            metadata={
                "request_id": "test-123",
                "source": "unit-test",
                "version": "1.0"
            }
        )

        response = ml_servicer.Predict(request, mock_context)

        # Prediction should succeed regardless of metadata
        assert response.error == ""
        assert response.prediction > 0

    def test_predict_updates_model_metrics(self, ml_servicer, valid_predict_request, mock_context):
        """Test that prediction updates model metrics"""
        # Get initial prediction count
        initial_count = ml_servicer.model_manager.model_metadata["iris-classifier"]["prediction_count"]

        # Make prediction
        ml_servicer.Predict(valid_predict_request, mock_context)

        # Check metrics were updated
        new_count = ml_servicer.model_manager.model_metadata["iris-classifier"]["prediction_count"]
        assert new_count == initial_count + 1

        # Average latency should be tracked
        avg_latency = ml_servicer.model_manager.model_metadata["iris-classifier"]["avg_latency_ms"]
        assert avg_latency >= 0

    def test_predict_multiple_requests_metrics(self, ml_servicer, valid_predict_request, mock_context):
        """Test metrics accumulation over multiple requests"""
        initial_count = ml_servicer.model_manager.model_metadata["iris-classifier"]["prediction_count"]

        # Make multiple predictions
        num_requests = 5
        for _ in range(num_requests):
            response = ml_servicer.Predict(valid_predict_request, mock_context)
            assert response.error == ""

        # Check final count
        final_count = ml_servicer.model_manager.model_metadata["iris-classifier"]["prediction_count"]
        assert final_count == initial_count + num_requests

    def test_predict_with_edge_case_features(self, ml_servicer, mock_context):
        """Test prediction with edge case feature values"""
        test_cases = [
            [0.0, 0.0, 0.0, 0.0],  # All zeros
            [100.0, 100.0, 100.0, 100.0],  # Large values
            [-1.0, -1.0, -1.0, -1.0],  # Negative values
            [0.001, 0.001, 0.001, 0.001],  # Very small values
        ]

        for features in test_cases:
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=features
            )
            response = ml_servicer.Predict(request, mock_context)

            # Should handle edge cases without errors
            assert response.error == ""
            assert response.prediction is not None

    def test_predict_probabilities_sum(self, ml_servicer, valid_predict_request, mock_context):
        """Test that prediction probabilities are valid"""
        response = ml_servicer.Predict(valid_predict_request, mock_context)

        # Check probabilities
        probabilities = response.probabilities
        assert len(probabilities) > 0

        # Each probability should be between 0 and 1
        for class_name, prob in probabilities.items():
            assert 0 <= prob <= 1.0, f"Probability for {class_name} out of range: {prob}"

    def test_predict_confidence_range(self, ml_servicer, valid_predict_request, mock_context):
        """Test that confidence score is within valid range"""
        response = ml_servicer.Predict(valid_predict_request, mock_context)

        # Confidence should be between 0 and 1
        assert 0 <= response.confidence <= 1.0

    def test_predict_response_completeness(self, ml_servicer, valid_predict_request, mock_context):
        """Test that response contains all expected fields"""
        response = ml_servicer.Predict(valid_predict_request, mock_context)

        # All required fields should be present
        assert hasattr(response, 'prediction')
        assert hasattr(response, 'confidence')
        assert hasattr(response, 'model_id')
        assert hasattr(response, 'latency_ms')
        assert hasattr(response, 'probabilities')
        assert hasattr(response, 'error')

    @patch('server.logger')
    def test_predict_logging(self, mock_logger, ml_servicer, valid_predict_request, mock_context):
        """Test that predictions are properly logged"""
        ml_servicer.Predict(valid_predict_request, mock_context)

        # Check that info log was called with prediction details
        mock_logger.info.assert_called()
        call_args = str(mock_logger.info.call_args)
        assert "Prediction" in call_args or "prediction" in call_args.lower()

    def test_predict_concurrent_safety(self, ml_servicer, mock_context):
        """Test that concurrent predictions don't interfere with each other"""
        import threading

        results = []
        errors = []

        def make_prediction(features):
            try:
                request = ml_service_pb2.PredictRequest(
                    model_id="iris-classifier",
                    features=features
                )
                ctx = Mock(spec=grpc.ServicerContext)
                ctx.set_code = Mock()
                ctx.set_details = Mock()
                ctx.invocation_metadata = Mock(return_value=[])

                response = ml_servicer.Predict(request, ctx)
                results.append(response)
            except Exception as e:
                errors.append(e)

        # Create multiple threads making predictions
        threads = []
        for i in range(10):
            features = [float(i)] * 4
            thread = threading.Thread(target=make_prediction, args=(features,))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # All predictions should succeed
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 10
        for response in results:
            assert response.error == ""

    def test_predict_exception_handling(self, ml_servicer, mock_context):
        """Test prediction handles unexpected exceptions gracefully"""
        # Mock the model manager to raise an exception
        with patch.object(ml_servicer.model_manager, 'predict', side_effect=Exception("Unexpected error")):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[1.0, 2.0, 3.0, 4.0]
            )

            response = ml_servicer.Predict(request, mock_context)

            # Should return error response
            assert "Unexpected error" in response.error
            mock_context.set_code.assert_called_with(grpc.StatusCode.INTERNAL)


@pytest.mark.unit
class TestPredictEdgeCases:
    """Test edge cases and boundary conditions"""

    def test_predict_with_single_feature(self, ml_servicer, mock_context):
        """Test prediction with single feature"""
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[5.1]
        )

        response = ml_servicer.Predict(request, mock_context)

        # Should handle gracefully (may succeed or fail depending on model)
        assert response is not None

    def test_predict_with_many_features(self, ml_servicer, mock_context):
        """Test prediction with many features"""
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[float(i) for i in range(100)]
        )

        response = ml_servicer.Predict(request, mock_context)

        # Should handle gracefully
        assert response is not None

    def test_predict_with_nan_features(self, ml_servicer, mock_context):
        """Test prediction handles NaN values"""
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[float('nan'), 3.5, 1.4, 0.2]
        )

        response = ml_servicer.Predict(request, mock_context)

        # Should handle NaN gracefully (may return error or prediction)
        assert response is not None

    def test_predict_with_inf_features(self, ml_servicer, mock_context):
        """Test prediction handles infinity values"""
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[float('inf'), 3.5, 1.4, 0.2]
        )

        response = ml_servicer.Predict(request, mock_context)

        # Should handle infinity gracefully
        assert response is not None
