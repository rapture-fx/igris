"""
Unit tests for ModelManager class

Tests cover:
- Model loading and initialization
- Prediction functionality
- Model metadata tracking
- Uptime calculation
- Model information retrieval
- Error handling for missing models
"""

import pytest
import time
from unittest.mock import Mock, patch


@pytest.mark.unit
class TestModelManager:
    """Test suite for ModelManager class"""

    def test_model_manager_initialization(self, model_manager):
        """Test ModelManager initializes correctly"""
        assert model_manager is not None
        assert isinstance(model_manager.models, dict)
        assert isinstance(model_manager.model_metadata, dict)
        assert model_manager.start_time > 0

    def test_model_manager_loads_default_models(self, model_manager):
        """Test that default models are loaded on init"""
        # Should have at least one default model
        assert len(model_manager.models) > 0
        assert "iris-classifier" in model_manager.models

    def test_model_manager_default_model_structure(self, model_manager):
        """Test default model has correct structure"""
        model = model_manager.models["iris-classifier"]

        # Check required fields
        assert "type" in model
        assert "version" in model
        assert "input_features" in model
        assert "output_classes" in model
        assert "predict_fn" in model

        # Check field values
        assert model["type"] == "sklearn"
        assert model["version"] == "1.0.0"
        assert callable(model["predict_fn"])

    def test_model_manager_metadata_structure(self, model_manager):
        """Test model metadata has correct structure"""
        metadata = model_manager.model_metadata["iris-classifier"]

        # Check required fields
        assert "loaded_at" in metadata
        assert "prediction_count" in metadata
        assert "avg_latency_ms" in metadata

        # Check initial values
        assert metadata["loaded_at"] > 0
        assert metadata["prediction_count"] >= 0
        assert metadata["avg_latency_ms"] >= 0

    def test_predict_valid_model(self, model_manager, sample_features):
        """Test prediction with valid model and features"""
        result = model_manager.predict("iris-classifier", sample_features)

        # Check result structure
        assert "prediction" in result
        assert "confidence" in result
        assert "probabilities" in result
        assert "latency_ms" in result
        assert "model_id" in result

        # Check values
        assert result["model_id"] == "iris-classifier"
        assert result["prediction"] >= 0
        assert 0 <= result["confidence"] <= 1.0
        assert result["latency_ms"] >= 0

    def test_predict_invalid_model(self, model_manager, sample_features):
        """Test prediction fails with invalid model"""
        with pytest.raises(ValueError) as exc_info:
            model_manager.predict("non-existent-model", sample_features)

        assert "not found" in str(exc_info.value).lower()

    def test_predict_updates_metrics(self, model_manager, sample_features):
        """Test that predictions update model metrics"""
        # Get initial metrics
        initial_count = model_manager.model_metadata["iris-classifier"]["prediction_count"]

        # Make prediction
        model_manager.predict("iris-classifier", sample_features)

        # Check metrics updated
        new_count = model_manager.model_metadata["iris-classifier"]["prediction_count"]
        assert new_count == initial_count + 1

        # Average latency should be updated
        avg_latency = model_manager.model_metadata["iris-classifier"]["avg_latency_ms"]
        assert avg_latency > 0

    def test_predict_multiple_updates_avg_latency(self, model_manager, sample_features):
        """Test that average latency is calculated correctly"""
        # Make multiple predictions
        latencies = []
        for _ in range(5):
            result = model_manager.predict("iris-classifier", sample_features)
            latencies.append(result["latency_ms"])

        # Check average latency
        avg_latency = model_manager.model_metadata["iris-classifier"]["avg_latency_ms"]
        assert avg_latency > 0

        # Average should be reasonable (not exactly equal due to timing)
        assert avg_latency <= max(latencies) * 2  # Sanity check

    def test_predict_different_features(self, model_manager):
        """Test predictions with different feature values"""
        features1 = [1.0, 1.0, 1.0, 1.0]
        features2 = [5.0, 5.0, 5.0, 5.0]

        result1 = model_manager.predict("iris-classifier", features1)
        result2 = model_manager.predict("iris-classifier", features2)

        # Different features should give different predictions
        assert result1["prediction"] != result2["prediction"]

    def test_mock_iris_predict_function(self, model_manager):
        """Test the mock iris prediction function"""
        # Test with known values
        features = [4.0, 4.0, 4.0, 4.0]  # Average = 4.0
        result = model_manager._mock_iris_predict(features)

        assert "prediction" in result
        assert "confidence" in result
        assert "probabilities" in result

        # Check prediction is average of features
        assert result["prediction"] == 4.0

    def test_mock_iris_predict_empty_features(self, model_manager):
        """Test mock prediction with empty features"""
        result = model_manager._mock_iris_predict([])

        # Should handle empty features
        assert result["prediction"] == 0.0

    def test_get_model_info_valid(self, model_manager):
        """Test getting info for valid model"""
        info = model_manager.get_model_info("iris-classifier")

        # Check all required fields
        assert info["model_id"] == "iris-classifier"
        assert info["type"] == "sklearn"
        assert info["version"] == "1.0.0"
        assert len(info["input_features"]) == 4
        assert len(info["output_classes"]) == 3
        assert info["loaded"] is True
        assert "metadata" in info

    def test_get_model_info_invalid(self, model_manager):
        """Test getting info for invalid model"""
        with pytest.raises(ValueError) as exc_info:
            model_manager.get_model_info("non-existent-model")

        assert "not found" in str(exc_info.value).lower()

    def test_get_model_info_metadata(self, model_manager):
        """Test that model info includes metadata"""
        info = model_manager.get_model_info("iris-classifier")

        metadata = info["metadata"]
        assert "prediction_count" in metadata
        assert "avg_latency_ms" in metadata
        assert "loaded_at" in metadata

        # Metadata values should be strings
        assert isinstance(metadata["prediction_count"], str)
        assert isinstance(metadata["avg_latency_ms"], str)
        assert isinstance(metadata["loaded_at"], str)

    def test_get_uptime(self, model_manager):
        """Test uptime calculation"""
        uptime = model_manager.get_uptime()

        # Uptime should be positive
        assert uptime >= 0

        # Wait a bit and check it increases
        time.sleep(0.1)
        new_uptime = model_manager.get_uptime()
        assert new_uptime >= uptime

    def test_get_uptime_increases(self, model_manager):
        """Test that uptime increases over time"""
        uptime1 = model_manager.get_uptime()
        time.sleep(0.1)
        uptime2 = model_manager.get_uptime()

        assert uptime2 >= uptime1

    def test_get_loaded_models(self, model_manager):
        """Test getting list of loaded models"""
        models = model_manager.get_loaded_models()

        # Should return list of model IDs
        assert isinstance(models, list)
        assert len(models) > 0
        assert "iris-classifier" in models

    def test_predict_latency_tracking(self, model_manager, sample_features):
        """Test that latency is properly tracked"""
        result = model_manager.predict("iris-classifier", sample_features)

        # Latency should be tracked
        assert "latency_ms" in result
        assert result["latency_ms"] >= 0
        assert result["latency_ms"] < 1000  # Should be fast

    def test_predict_probabilities_format(self, model_manager, sample_features):
        """Test that probabilities are properly formatted"""
        result = model_manager.predict("iris-classifier", sample_features)

        probabilities = result["probabilities"]
        assert isinstance(probabilities, dict)
        assert len(probabilities) == 3

        # Check class names
        assert "setosa" in probabilities
        assert "versicolor" in probabilities
        assert "virginica" in probabilities

        # Check probability values
        for prob in probabilities.values():
            assert 0 <= prob <= 1.0

    def test_predict_confidence_calculation(self, model_manager):
        """Test confidence calculation for different inputs"""
        # Low values should give lower confidence
        result_low = model_manager._mock_iris_predict([1.0, 1.0, 1.0, 1.0])
        # High values should give higher confidence
        result_high = model_manager._mock_iris_predict([9.0, 9.0, 9.0, 9.0])

        # Confidence should increase with prediction value
        # (based on mock implementation)
        assert result_low["confidence"] <= result_high["confidence"]

    def test_concurrent_predictions(self, model_manager, sample_features):
        """Test that concurrent predictions are thread-safe"""
        import threading

        results = []
        errors = []

        def make_prediction():
            try:
                result = model_manager.predict("iris-classifier", sample_features)
                results.append(result)
            except Exception as e:
                errors.append(e)

        # Create multiple threads
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_prediction)
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        # All predictions should succeed
        assert len(errors) == 0
        assert len(results) == 10

    @patch('server.logger')
    def test_model_loading_logs(self, mock_logger):
        """Test that model loading is logged"""
        from server import ModelManager
        ModelManager()

        # Should have logged loading information
        mock_logger.info.assert_called()

    def test_model_features_list(self, model_manager):
        """Test that model has correct feature list"""
        model = model_manager.models["iris-classifier"]
        features = model["input_features"]

        expected = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width']
        assert features == expected

    def test_model_output_classes_list(self, model_manager):
        """Test that model has correct output classes"""
        model = model_manager.models["iris-classifier"]
        classes = model["output_classes"]

        expected = ['setosa', 'versicolor', 'virginica']
        assert classes == expected

    def test_prediction_count_increments(self, model_manager, sample_features):
        """Test that prediction count increments correctly"""
        # Get initial count
        initial = model_manager.model_metadata["iris-classifier"]["prediction_count"]

        # Make 5 predictions
        for _ in range(5):
            model_manager.predict("iris-classifier", sample_features)

        # Check count increased by 5
        final = model_manager.model_metadata["iris-classifier"]["prediction_count"]
        assert final == initial + 5

    @pytest.mark.parametrize("features,expected_range", [
        ([1.0, 1.0, 1.0, 1.0], (0, 5)),
        ([5.0, 5.0, 5.0, 5.0], (3, 7)),
        ([10.0, 10.0, 10.0, 10.0], (8, 12)),
    ])
    def test_predictions_range(self, model_manager, features, expected_range):
        """Test that predictions fall within expected ranges"""
        result = model_manager.predict("iris-classifier", features)
        prediction = result["prediction"]

        min_val, max_val = expected_range
        assert min_val <= prediction <= max_val

    def test_model_manager_state_consistency(self, model_manager):
        """Test that model manager maintains consistent state"""
        # Models and metadata should have same keys
        assert set(model_manager.models.keys()) == set(model_manager.model_metadata.keys())

        # All models should have metadata
        for model_id in model_manager.models:
            assert model_id in model_manager.model_metadata
