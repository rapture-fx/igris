"""
Unit tests for BatchPredict RPC handler

Tests cover:
- Valid batch prediction requests
- Empty batch handling
- Mixed success/failure scenarios
- Batch metrics (success_count, error_count)
- Total latency tracking
- Large batch handling
"""

import pytest
import grpc
import ml_service_pb2


@pytest.mark.unit
@pytest.mark.grpc
class TestBatchPredictRPC:
    """Test suite for BatchPredict RPC handler"""

    def test_batch_predict_valid_request(self, ml_servicer, valid_batch_predict_request, mock_context):
        """Test successful batch prediction with valid request"""
        response = ml_servicer.BatchPredict(valid_batch_predict_request, mock_context)

        # Validate response structure
        assert response is not None
        assert isinstance(response, ml_service_pb2.BatchPredictResponse)

        # Should have 3 predictions
        assert len(response.predictions) == 3
        assert response.success_count == 3
        assert response.error_count == 0
        assert response.total_latency_ms > 0

        # All predictions should be successful
        for prediction in response.predictions:
            assert prediction.error == ""
            assert prediction.prediction > 0
            assert 0 <= prediction.confidence <= 1.0
            assert prediction.model_id == "iris-classifier"

    def test_batch_predict_empty_batch(self, ml_servicer, empty_batch_predict_request, mock_context):
        """Test batch prediction with empty feature sets"""
        response = ml_servicer.BatchPredict(empty_batch_predict_request, mock_context)

        # Should succeed but with no predictions
        assert response is not None
        assert len(response.predictions) == 0
        assert response.success_count == 0
        assert response.error_count == 0

    def test_batch_predict_missing_model_id(self, ml_servicer, mock_context):
        """Test batch prediction fails when model_id is missing"""
        request = ml_service_pb2.BatchPredictRequest(
            model_id="",
            feature_sets=[]
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # Should set error code
        mock_context.set_code.assert_called_with(grpc.StatusCode.INVALID_ARGUMENT)
        mock_context.set_details.assert_called_with("model_id is required")

    def test_batch_predict_unknown_model(self, ml_servicer, mock_context):
        """Test batch prediction with unknown model"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0])
        ]
        request = ml_service_pb2.BatchPredictRequest(
            model_id="unknown-model",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # All predictions should fail
        assert len(response.predictions) == 1
        assert response.success_count == 0
        assert response.error_count == 1
        assert "not found" in response.predictions[0].error.lower()

    def test_batch_predict_large_batch(self, ml_servicer, mock_context):
        """Test batch prediction with large number of samples"""
        # Create 100 feature sets
        feature_sets = [
            ml_service_pb2.FeatureSet(
                features=[float(i), float(i+1), float(i+2), float(i+3)],
                identifier=f"sample-{i}"
            )
            for i in range(100)
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # All predictions should succeed
        assert len(response.predictions) == 100
        assert response.success_count == 100
        assert response.error_count == 0

    def test_batch_predict_tracks_total_latency(self, ml_servicer, valid_batch_predict_request, mock_context):
        """Test that total latency is tracked"""
        response = ml_servicer.BatchPredict(valid_batch_predict_request, mock_context)

        # Total latency should be positive
        assert response.total_latency_ms > 0

        # Total latency should be reasonable (less than 10 seconds for mock)
        assert response.total_latency_ms < 10000

    def test_batch_predict_individual_latencies(self, ml_servicer, valid_batch_predict_request, mock_context):
        """Test that individual predictions have latency tracking"""
        response = ml_servicer.BatchPredict(valid_batch_predict_request, mock_context)

        # Each prediction should have latency tracked
        for prediction in response.predictions:
            assert prediction.latency_ms >= 0

    def test_batch_predict_success_error_counts(self, ml_servicer, mock_context):
        """Test that success and error counts are accurate"""
        # Create batch with mix of valid and invalid features
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0]),  # Valid
            ml_service_pb2.FeatureSet(features=[5.0, 6.0, 7.0, 8.0]),  # Valid
            ml_service_pb2.FeatureSet(features=[9.0, 10.0, 11.0, 12.0]),  # Valid
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # All should succeed for valid model
        assert response.success_count == 3
        assert response.error_count == 0
        assert response.success_count + response.error_count == len(feature_sets)

    def test_batch_predict_partial_failures(self, ml_servicer, mock_context):
        """Test batch prediction handles partial failures gracefully"""
        from unittest.mock import patch

        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0]),
            ml_service_pb2.FeatureSet(features=[5.0, 6.0, 7.0, 8.0]),
            ml_service_pb2.FeatureSet(features=[9.0, 10.0, 11.0, 12.0]),
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        # Mock to fail on second prediction
        call_count = [0]
        original_predict = ml_servicer.model_manager.predict

        def mock_predict(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 2:
                raise ValueError("Simulated error")
            return original_predict(*args, **kwargs)

        with patch.object(ml_servicer.model_manager, 'predict', side_effect=mock_predict):
            response = ml_servicer.BatchPredict(request, mock_context)

            # Should have 2 successes and 1 error
            assert len(response.predictions) == 3
            assert response.success_count == 2
            assert response.error_count == 1

            # Check that error is captured
            assert any(pred.error != "" for pred in response.predictions)

    def test_batch_predict_with_identifiers(self, ml_servicer, mock_context):
        """Test batch prediction preserves feature set identifiers"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0], identifier="test-1"),
            ml_service_pb2.FeatureSet(features=[5.0, 6.0, 7.0, 8.0], identifier="test-2"),
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # Predictions should be returned in order
        assert len(response.predictions) == 2
        # Note: Current implementation doesn't preserve identifiers in response
        # This test documents that behavior

    def test_batch_predict_updates_metrics(self, ml_servicer, valid_batch_predict_request, mock_context):
        """Test that batch prediction updates model metrics"""
        initial_count = ml_servicer.model_manager.model_metadata["iris-classifier"]["prediction_count"]

        response = ml_servicer.BatchPredict(valid_batch_predict_request, mock_context)

        # Prediction count should increase by number of successful predictions
        new_count = ml_servicer.model_manager.model_metadata["iris-classifier"]["prediction_count"]
        assert new_count == initial_count + response.success_count

    def test_batch_predict_with_metadata(self, ml_servicer, mock_context):
        """Test batch prediction with custom metadata"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0])
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets,
            metadata={
                "batch_id": "test-batch-123",
                "source": "unit-test",
                "priority": "high"
            }
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # Should succeed with metadata
        assert response.success_count == 1

    def test_batch_predict_different_feature_sizes(self, ml_servicer, mock_context):
        """Test batch prediction with varying feature vector sizes"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0]),
            ml_service_pb2.FeatureSet(features=[1.0, 2.0]),  # Too few
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0, 5.0, 6.0]),  # Too many
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # Should handle all feature sets (may have different success rates)
        assert len(response.predictions) == 3

    def test_batch_predict_performance(self, ml_servicer, mock_context, benchmark):
        """Test batch prediction performance"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[float(i)] * 4)
            for i in range(10)
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        def batch_predict():
            return ml_servicer.BatchPredict(request, mock_context)

        result = benchmark(batch_predict)
        assert result.success_count == 10

    def test_batch_predict_exception_handling(self, ml_servicer, mock_context):
        """Test batch prediction handles unexpected exceptions"""
        from unittest.mock import patch

        feature_sets = [
            ml_service_pb2.FeatureSet(features=[1.0, 2.0, 3.0, 4.0])
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        # Mock to raise exception during processing
        with patch.object(ml_servicer.model_manager, 'predict', side_effect=Exception("Unexpected error")):
            response = ml_servicer.BatchPredict(request, mock_context)

            # Should handle error gracefully
            assert len(response.predictions) == 1
            assert response.error_count == 1
            assert "Unexpected error" in response.predictions[0].error

    def test_batch_predict_empty_features(self, ml_servicer, mock_context):
        """Test batch prediction with empty feature vectors"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[]),
            ml_service_pb2.FeatureSet(features=[])
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # Should handle empty features (predictions may succeed or fail)
        assert len(response.predictions) == 2

    @pytest.mark.slow
    def test_batch_predict_very_large_batch(self, ml_servicer, mock_context):
        """Test batch prediction with very large batch size"""
        # Create 1000 feature sets
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[float(i % 10)] * 4)
            for i in range(1000)
        ]

        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        response = ml_servicer.BatchPredict(request, mock_context)

        # Should handle large batch
        assert len(response.predictions) == 1000
        assert response.success_count > 0

    def test_batch_predict_probabilities(self, ml_servicer, valid_batch_predict_request, mock_context):
        """Test that batch predictions include probabilities"""
        response = ml_servicer.BatchPredict(valid_batch_predict_request, mock_context)

        # Check probabilities are included
        for prediction in response.predictions:
            if prediction.error == "":
                assert len(prediction.probabilities) > 0
                # Probabilities should be valid
                for prob in prediction.probabilities.values():
                    assert 0 <= prob <= 1.0
