"""
Unit tests for HealthCheck RPC handler

Tests cover:
- Basic health check
- Detailed health check with model information
- Health check response format
- System metrics
- Uptime tracking
"""

import pytest
import time
import ml_service_pb2


@pytest.mark.unit
@pytest.mark.grpc
class TestHealthCheckRPC:
    """Test suite for HealthCheck RPC handler"""

    def test_health_check_basic(self, ml_servicer, health_check_request_basic, mock_context):
        """Test basic health check without details"""
        response = ml_servicer.HealthCheck(health_check_request_basic, mock_context)

        # Validate response
        assert response is not None
        assert isinstance(response, ml_service_pb2.HealthCheckResponse)
        assert response.status == "healthy"
        assert response.uptime_seconds >= 0
        assert response.loaded_models_count > 0

        # System metrics should be present
        assert "uptime_seconds" in response.system_metrics
        assert "loaded_models_count" in response.system_metrics

    def test_health_check_detailed(self, ml_servicer, health_check_request_detailed, mock_context):
        """Test detailed health check with model list"""
        response = ml_servicer.HealthCheck(health_check_request_detailed, mock_context)

        # Validate response
        assert response.status == "healthy"
        assert response.uptime_seconds >= 0
        assert response.loaded_models_count > 0

        # Should include list of loaded models
        assert len(response.loaded_models) > 0
        assert "iris-classifier" in response.loaded_models

        # System metrics should be present
        assert len(response.system_metrics) > 0

    def test_health_check_uptime_increases(self, ml_servicer, health_check_request_basic, mock_context):
        """Test that uptime increases over time"""
        # First check
        response1 = ml_servicer.HealthCheck(health_check_request_basic, mock_context)
        uptime1 = response1.uptime_seconds

        # Wait a bit
        time.sleep(0.1)

        # Second check
        response2 = ml_servicer.HealthCheck(health_check_request_basic, mock_context)
        uptime2 = response2.uptime_seconds

        # Uptime should be same or slightly higher (depends on timing)
        assert uptime2 >= uptime1

    def test_health_check_loaded_models_count(self, ml_servicer, health_check_request_basic, mock_context):
        """Test that loaded models count is accurate"""
        response = ml_servicer.HealthCheck(health_check_request_basic, mock_context)

        # Should match actual number of loaded models
        actual_count = len(ml_servicer.model_manager.get_loaded_models())
        assert response.loaded_models_count == actual_count

    def test_health_check_system_metrics_format(self, ml_servicer, health_check_request_basic, mock_context):
        """Test that system metrics are properly formatted"""
        response = ml_servicer.HealthCheck(health_check_request_basic, mock_context)

        # Metrics should be strings (as per proto definition)
        for key, value in response.system_metrics.items():
            assert isinstance(key, str)
            assert isinstance(value, str)

        # Specific metrics should exist
        assert "uptime_seconds" in response.system_metrics
        assert "loaded_models_count" in response.system_metrics

    def test_health_check_always_succeeds(self, ml_servicer, mock_context):
        """Test that health check always returns a response"""
        # Call multiple times
        for _ in range(10):
            request = ml_service_pb2.HealthCheckRequest(detailed=False)
            response = ml_servicer.HealthCheck(request, mock_context)

            assert response is not None
            assert response.status in ["healthy", "unhealthy"]

    def test_health_check_error_handling(self, ml_servicer, health_check_request_basic, mock_context):
        """Test health check handles internal errors gracefully"""
        from unittest.mock import patch

        # Mock model manager to raise exception
        with patch.object(ml_servicer.model_manager, 'get_uptime', side_effect=Exception("Test error")):
            response = ml_servicer.HealthCheck(health_check_request_basic, mock_context)

            # Should return unhealthy status instead of crashing
            assert response is not None
            assert response.status == "unhealthy"
            assert "error" in response.system_metrics

    def test_health_check_no_context_errors(self, ml_servicer, health_check_request_basic, mock_context):
        """Test that health check doesn't set error codes on context"""
        ml_servicer.HealthCheck(health_check_request_basic, mock_context)

        # Context should not have errors set
        mock_context.set_code.assert_not_called()
        mock_context.set_details.assert_not_called()

    def test_health_check_performance(self, ml_servicer, health_check_request_basic, mock_context, benchmark):
        """Test health check performance"""
        def health_check():
            return ml_servicer.HealthCheck(health_check_request_basic, mock_context)

        # Health check should be very fast
        result = benchmark(health_check)
        assert result.status == "healthy"

    def test_health_check_detailed_vs_basic(self, ml_servicer, mock_context):
        """Test difference between detailed and basic health checks"""
        basic_request = ml_service_pb2.HealthCheckRequest(detailed=False)
        detailed_request = ml_service_pb2.HealthCheckRequest(detailed=True)

        basic_response = ml_servicer.HealthCheck(basic_request, mock_context)
        detailed_response = ml_servicer.HealthCheck(detailed_request, mock_context)

        # Basic response should not have model list
        assert len(basic_response.loaded_models) == 0

        # Detailed response should have model list
        assert len(detailed_response.loaded_models) > 0

        # Both should have same basic info
        assert basic_response.status == detailed_response.status
        assert basic_response.loaded_models_count == detailed_response.loaded_models_count


@pytest.mark.unit
@pytest.mark.grpc
class TestGetModelInfoRPC:
    """Test suite for GetModelInfo RPC handler"""

    def test_get_model_info_valid(self, ml_servicer, model_info_request, mock_context):
        """Test getting info for valid model"""
        response = ml_servicer.GetModelInfo(model_info_request, mock_context)

        # Validate response
        assert response is not None
        assert isinstance(response, ml_service_pb2.ModelInfoResponse)
        assert response.model_id == "iris-classifier"
        assert response.model_type == "sklearn"
        assert response.version == "1.0.0"
        assert response.loaded is True

        # Check input features
        assert len(response.input_features) > 0
        expected_features = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width']
        assert list(response.input_features) == expected_features

        # Check output classes
        assert len(response.output_classes) > 0
        expected_classes = ['setosa', 'versicolor', 'virginica']
        assert list(response.output_classes) == expected_classes

    def test_get_model_info_metadata(self, ml_servicer, model_info_request, mock_context):
        """Test that model metadata is included"""
        response = ml_servicer.GetModelInfo(model_info_request, mock_context)

        # Should have metadata
        assert len(response.metadata) > 0
        assert "prediction_count" in response.metadata
        assert "avg_latency_ms" in response.metadata
        assert "loaded_at" in response.metadata

    def test_get_model_info_invalid_model_id(self, ml_servicer, model_info_request_invalid, mock_context):
        """Test getting info for invalid model ID"""
        response = ml_servicer.GetModelInfo(model_info_request_invalid, mock_context)

        # Should return empty response with error code
        assert response.model_id == ""
        mock_context.set_code.assert_called_with(grpc.StatusCode.INVALID_ARGUMENT)
        mock_context.set_details.assert_called_with("model_id is required")

    def test_get_model_info_unknown_model(self, ml_servicer, mock_context):
        """Test getting info for unknown model"""
        request = ml_service_pb2.ModelInfoRequest(model_id="unknown-model")
        response = ml_servicer.GetModelInfo(request, mock_context)

        # Should return empty response with NOT_FOUND error
        assert response.model_id == ""
        mock_context.set_code.assert_called_with(grpc.StatusCode.NOT_FOUND)

    def test_get_model_info_after_predictions(self, ml_servicer, model_info_request, mock_context):
        """Test that model info reflects prediction count"""
        # Get initial info
        response1 = ml_servicer.GetModelInfo(model_info_request, mock_context)
        initial_count = int(response1.metadata["prediction_count"])

        # Make a prediction
        predict_request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[5.1, 3.5, 1.4, 0.2]
        )
        ml_servicer.Predict(predict_request, mock_context)

        # Get updated info
        response2 = ml_servicer.GetModelInfo(model_info_request, mock_context)
        updated_count = int(response2.metadata["prediction_count"])

        # Count should have increased
        assert updated_count == initial_count + 1

    def test_get_model_info_complete_response(self, ml_servicer, model_info_request, mock_context):
        """Test that response contains all expected fields"""
        response = ml_servicer.GetModelInfo(model_info_request, mock_context)

        # All fields should be present
        assert hasattr(response, 'model_id')
        assert hasattr(response, 'model_type')
        assert hasattr(response, 'version')
        assert hasattr(response, 'input_features')
        assert hasattr(response, 'output_classes')
        assert hasattr(response, 'loaded')
        assert hasattr(response, 'metadata')

    def test_get_model_info_version_format(self, ml_servicer, model_info_request, mock_context):
        """Test that version string is properly formatted"""
        response = ml_servicer.GetModelInfo(model_info_request, mock_context)

        # Version should follow semantic versioning
        version_parts = response.version.split('.')
        assert len(version_parts) == 3
        assert all(part.isdigit() for part in version_parts)

    @pytest.mark.parametrize("model_id", [
        "iris-classifier",
        # Add more models here if they exist
    ])
    def test_get_model_info_all_models(self, ml_servicer, mock_context, model_id):
        """Test getting info for all available models"""
        request = ml_service_pb2.ModelInfoRequest(model_id=model_id)
        response = ml_servicer.GetModelInfo(request, mock_context)

        # Should succeed for all loaded models
        assert response.model_id == model_id
        assert response.loaded is True
