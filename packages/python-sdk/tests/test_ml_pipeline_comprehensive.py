"""
Comprehensive ML pipeline tests for Schlep-engine Python SDK

This test suite covers machine learning pipeline operations, model training,
inference, monitoring, and advanced ML workflows.
"""

import pytest
import asyncio
import numpy as np
import pandas as pd
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import pickle

from schlep_engine.api.ml_pipeline import MLPipelineAPI
from schlep_engine.models.ml import (
    MLJob,
    MLJobStatus,
    ModelConfig,
    TrainingConfig,
    InferenceConfig,
    ModelMetrics,
    HyperParameters,
    DatasetInfo,
    ModelArtifact,
    ExperimentResult,
    AutoMLConfig,
    FeatureImportance
)
from schlep_engine.models.common import APIResponse, PaginationParams
from schlep_engine.exceptions.base import (
    APIError,
    MLError,
    ModelError,
    ValidationError,
    TrainingError,
    InferenceError
)


class TestMLPipelineAPI:
    """Comprehensive tests for ML Pipeline API."""

    @pytest.fixture
    def api_client(self):
        """Create a mock ML Pipeline API client."""
        from schlep_engine.utils.http_client import HTTPClient
        http_client = AsyncMock(spec=HTTPClient)
        return MLPipelineAPI(http_client)

    @pytest.fixture
    def sample_training_config(self):
        """Sample training configuration."""
        return TrainingConfig(
            algorithm="random_forest",
            hyperparameters=HyperParameters(
                n_estimators=100,
                max_depth=10,
                min_samples_split=2,
                random_state=42
            ),
            cross_validation_folds=5,
            test_size=0.2,
            validation_metric="accuracy",
            early_stopping=True,
            max_training_time=3600  # 1 hour
        )

    @pytest.fixture
    def sample_ml_job(self, sample_training_config):
        """Sample ML job for testing."""
        return MLJob(
            job_id="ml_job_123",
            status=MLJobStatus.TRAINING,
            job_type="supervised_learning",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            training_config=sample_training_config,
            dataset_info=DatasetInfo(
                dataset_id="dataset_456",
                features=["feature1", "feature2", "feature3"],
                target="target_variable",
                rows=10000,
                columns=4
            ),
            progress=45.0,
            estimated_completion=datetime.now() + timedelta(minutes=30)
        )

    @pytest.fixture
    def sample_model_metrics(self):
        """Sample model metrics."""
        return ModelMetrics(
            accuracy=0.892,
            precision=0.884,
            recall=0.901,
            f1_score=0.892,
            roc_auc=0.945,
            confusion_matrix=[[850, 50], [40, 860]],
            classification_report={
                "0": {"precision": 0.955, "recall": 0.944, "f1-score": 0.950},
                "1": {"precision": 0.945, "recall": 0.956, "f1-score": 0.950}
            },
            feature_importance=[
                FeatureImportance(feature="feature1", importance=0.45),
                FeatureImportance(feature="feature2", importance=0.32),
                FeatureImportance(feature="feature3", importance=0.23)
            ]
        )

    @pytest.mark.asyncio
    async def test_create_training_job_success(self, api_client, sample_ml_job):
        """Test successful training job creation."""
        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=sample_ml_job.dict(),
            message="Training job created successfully"
        )

        config = sample_ml_job.training_config
        dataset_id = sample_ml_job.dataset_info.dataset_id

        result = await api_client.create_training_job(
            dataset_id=dataset_id,
            target_column="target_variable",
            config=config
        )

        assert isinstance(result, MLJob)
        assert result.job_id == "ml_job_123"
        assert result.status == MLJobStatus.TRAINING
        api_client.http_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_training_job_invalid_config(self, api_client):
        """Test training job creation with invalid configuration."""
        api_client.http_client.post.side_effect = APIError(
            "Invalid hyperparameters",
            status_code=400,
            error_code="INVALID_CONFIG"
        )

        invalid_config = TrainingConfig(
            algorithm="unknown_algorithm",
            hyperparameters=HyperParameters(invalid_param="invalid_value")
        )

        with pytest.raises(ValidationError):
            await api_client.create_training_job(
                dataset_id="dataset_123",
                target_column="target",
                config=invalid_config
            )

    @pytest.mark.asyncio
    async def test_get_training_job_status(self, api_client, sample_ml_job):
        """Test getting training job status."""
        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=sample_ml_job.dict()
        )

        result = await api_client.get_training_job_status("ml_job_123")

        assert isinstance(result, MLJob)
        assert result.progress == 45.0
        assert result.status == MLJobStatus.TRAINING
        api_client.http_client.get.assert_called_once_with("/ml/jobs/ml_job_123")

    @pytest.mark.asyncio
    async def test_wait_for_training_completion(self, api_client):
        """Test waiting for training job completion with polling."""
        # Mock progressive training states
        training_states = [
            MLJob(
                job_id="ml_job_123",
                status=MLJobStatus.TRAINING,
                progress=25.0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            MLJob(
                job_id="ml_job_123",
                status=MLJobStatus.TRAINING,
                progress=75.0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            MLJob(
                job_id="ml_job_123",
                status=MLJobStatus.COMPLETED,
                progress=100.0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]

        api_client.http_client.get.side_effect = [
            APIResponse(success=True, data=state.dict()) for state in training_states
        ]

        final_job = await api_client.wait_for_training_completion(
            "ml_job_123",
            poll_interval=0.1,
            timeout=10
        )

        assert final_job.status == MLJobStatus.COMPLETED
        assert final_job.progress == 100.0
        assert api_client.http_client.get.call_count == 3

    @pytest.mark.asyncio
    async def test_training_timeout(self, api_client):
        """Test training job timeout handling."""
        long_running_job = MLJob(
            job_id="ml_job_timeout",
            status=MLJobStatus.TRAINING,
            progress=10.0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=long_running_job.dict()
        )

        with pytest.raises(TrainingError) as exc_info:
            await api_client.wait_for_training_completion(
                "ml_job_timeout",
                poll_interval=0.1,
                timeout=0.5
            )

        assert "timeout" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_model_metrics(self, api_client, sample_model_metrics):
        """Test retrieving model performance metrics."""
        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=sample_model_metrics.dict()
        )

        result = await api_client.get_model_metrics("model_789")

        assert isinstance(result, ModelMetrics)
        assert result.accuracy == 0.892
        assert result.roc_auc == 0.945
        assert len(result.feature_importance) == 3
        api_client.http_client.get.assert_called_once_with("/ml/models/model_789/metrics")

    @pytest.mark.asyncio
    async def test_model_inference_batch(self, api_client):
        """Test batch inference with model."""
        # Sample input data
        input_data = [
            {"feature1": 1.0, "feature2": 2.0, "feature3": 3.0},
            {"feature1": 1.5, "feature2": 2.5, "feature3": 3.5},
            {"feature1": 2.0, "feature2": 3.0, "feature3": 4.0}
        ]

        predictions = [
            {"prediction": 1, "probability": 0.85, "confidence": "high"},
            {"prediction": 0, "probability": 0.92, "confidence": "high"},
            {"prediction": 1, "probability": 0.78, "confidence": "medium"}
        ]

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data={"predictions": predictions}
        )

        result = await api_client.predict_batch(
            model_id="model_789",
            input_data=input_data
        )

        assert len(result["predictions"]) == 3
        assert result["predictions"][0]["prediction"] == 1
        assert result["predictions"][0]["probability"] == 0.85

    @pytest.mark.asyncio
    async def test_model_inference_single(self, api_client):
        """Test single instance inference."""
        input_instance = {"feature1": 1.5, "feature2": 2.5, "feature3": 3.5}
        prediction = {"prediction": 0, "probability": 0.92, "confidence": "high"}

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=prediction
        )

        result = await api_client.predict_single(
            model_id="model_789",
            input_data=input_instance
        )

        assert result["prediction"] == 0
        assert result["probability"] == 0.92
        assert result["confidence"] == "high"

    @pytest.mark.asyncio
    async def test_model_inference_validation_error(self, api_client):
        """Test inference with invalid input data."""
        api_client.http_client.post.side_effect = APIError(
            "Invalid input schema",
            status_code=400,
            error_code="INVALID_INPUT"
        )

        invalid_input = {"wrong_feature": "invalid_value"}

        with pytest.raises(ValidationError):
            await api_client.predict_single(
                model_id="model_789",
                input_data=invalid_input
            )

    @pytest.mark.asyncio
    async def test_model_deployment(self, api_client):
        """Test model deployment to production."""
        deployment_config = {
            "environment": "production",
            "instance_type": "ml.m5.large",
            "min_instances": 1,
            "max_instances": 10,
            "auto_scaling": True
        }

        deployment_result = {
            "deployment_id": "deploy_456",
            "endpoint_url": "https://api.example.com/ml/models/model_789/predict",
            "status": "deploying"
        }

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=deployment_result
        )

        result = await api_client.deploy_model(
            model_id="model_789",
            deployment_config=deployment_config
        )

        assert result["deployment_id"] == "deploy_456"
        assert "endpoint_url" in result
        assert result["status"] == "deploying"

    @pytest.mark.asyncio
    async def test_automl_job_creation(self, api_client):
        """Test AutoML job creation and configuration."""
        automl_config = AutoMLConfig(
            problem_type="classification",
            metric="accuracy",
            time_budget=7200,  # 2 hours
            algorithms=["random_forest", "gradient_boosting", "neural_network"],
            cross_validation=True,
            feature_selection=True,
            hyperparameter_tuning=True
        )

        automl_job = MLJob(
            job_id="automl_job_999",
            status=MLJobStatus.RUNNING,
            job_type="automl",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            automl_config=automl_config
        )

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=automl_job.dict()
        )

        result = await api_client.create_automl_job(
            dataset_id="dataset_123",
            target_column="target",
            config=automl_config
        )

        assert isinstance(result, MLJob)
        assert result.job_type == "automl"
        assert result.automl_config.time_budget == 7200

    @pytest.mark.asyncio
    async def test_experiment_tracking(self, api_client):
        """Test ML experiment tracking and comparison."""
        experiments = [
            ExperimentResult(
                experiment_id="exp_001",
                algorithm="random_forest",
                hyperparameters={"n_estimators": 100, "max_depth": 10},
                metrics={"accuracy": 0.85, "f1_score": 0.84},
                training_time=300,
                model_size=1024000
            ),
            ExperimentResult(
                experiment_id="exp_002",
                algorithm="gradient_boosting",
                hyperparameters={"n_estimators": 200, "learning_rate": 0.1},
                metrics={"accuracy": 0.88, "f1_score": 0.87},
                training_time=450,
                model_size=1536000
            )
        ]

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data={"experiments": [exp.dict() for exp in experiments]}
        )

        result = await api_client.list_experiments("project_123")

        assert len(result["experiments"]) == 2
        assert result["experiments"][0]["algorithm"] == "random_forest"
        assert result["experiments"][1]["metrics"]["accuracy"] > result["experiments"][0]["metrics"]["accuracy"]

    @pytest.mark.asyncio
    async def test_model_versioning(self, api_client):
        """Test model versioning and artifact management."""
        model_versions = [
            {
                "version": "1.0.0",
                "created_at": datetime.now().isoformat(),
                "metrics": {"accuracy": 0.85},
                "status": "archived"
            },
            {
                "version": "1.1.0", 
                "created_at": datetime.now().isoformat(),
                "metrics": {"accuracy": 0.88},
                "status": "production"
            },
            {
                "version": "1.2.0",
                "created_at": datetime.now().isoformat(),
                "metrics": {"accuracy": 0.91},
                "status": "staging"
            }
        ]

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data={"versions": model_versions}
        )

        result = await api_client.list_model_versions("model_789")

        assert len(result["versions"]) == 3
        production_version = next(v for v in result["versions"] if v["status"] == "production")
        assert production_version["version"] == "1.1.0"

    @pytest.mark.asyncio
    async def test_model_rollback(self, api_client):
        """Test model rollback to previous version."""
        rollback_result = {
            "model_id": "model_789",
            "previous_version": "1.2.0",
            "rolled_back_to": "1.1.0",
            "status": "success"
        }

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=rollback_result
        )

        result = await api_client.rollback_model(
            model_id="model_789",
            target_version="1.1.0"
        )

        assert result["rolled_back_to"] == "1.1.0"
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_model_monitoring(self, api_client):
        """Test model performance monitoring in production."""
        monitoring_data = {
            "model_id": "model_789",
            "period": "last_24h",
            "prediction_count": 15000,
            "average_response_time": 45.2,
            "error_rate": 0.002,
            "accuracy_drift": -0.01,
            "feature_drift": {
                "feature1": 0.05,
                "feature2": 0.02,
                "feature3": 0.08
            },
            "alerts": [
                {
                    "type": "feature_drift",
                    "feature": "feature3",
                    "severity": "warning",
                    "threshold": 0.05,
                    "actual": 0.08
                }
            ]
        }

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=monitoring_data
        )

        result = await api_client.get_model_monitoring("model_789", period="last_24h")

        assert result["prediction_count"] == 15000
        assert result["error_rate"] < 0.01
        assert len(result["alerts"]) == 1
        assert result["alerts"][0]["type"] == "feature_drift"

    @pytest.mark.asyncio
    async def test_data_preprocessing_pipeline(self, api_client):
        """Test data preprocessing pipeline creation."""
        preprocessing_config = {
            "steps": [
                {"type": "missing_value_imputation", "strategy": "mean"},
                {"type": "scaling", "method": "standard_scaler"},
                {"type": "encoding", "categorical_features": ["category1", "category2"]},
                {"type": "feature_selection", "method": "recursive_elimination", "n_features": 10}
            ],
            "validation_split": 0.2
        }

        pipeline_result = {
            "pipeline_id": "pipeline_456",
            "status": "created",
            "steps_count": 4,
            "estimated_processing_time": 300
        }

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=pipeline_result
        )

        result = await api_client.create_preprocessing_pipeline(
            dataset_id="dataset_123",
            config=preprocessing_config
        )

        assert result["pipeline_id"] == "pipeline_456"
        assert result["steps_count"] == 4

    @pytest.mark.asyncio
    async def test_feature_engineering(self, api_client):
        """Test automated feature engineering."""
        feature_engineering_config = {
            "generate_polynomial_features": True,
            "polynomial_degree": 2,
            "create_interaction_features": True,
            "time_series_features": ["lag_1", "lag_7", "rolling_mean_7"],
            "text_features": ["tfidf", "sentiment"],
            "max_features": 100
        }

        engineered_features = {
            "original_features": 15,
            "generated_features": 85,
            "total_features": 100,
            "feature_names": [f"feature_{i}" for i in range(100)],
            "feature_importance_scores": {f"feature_{i}": 0.1 for i in range(10)}
        }

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=engineered_features
        )

        result = await api_client.generate_features(
            dataset_id="dataset_123",
            config=feature_engineering_config
        )

        assert result["total_features"] == 100
        assert result["generated_features"] == 85
        assert len(result["feature_names"]) == 100

    @pytest.mark.asyncio
    async def test_model_explanation(self, api_client):
        """Test model explainability and interpretation."""
        explanation_data = {
            "model_id": "model_789",
            "explanation_type": "shap",
            "global_importance": [
                {"feature": "feature1", "importance": 0.45},
                {"feature": "feature2", "importance": 0.32},
                {"feature": "feature3", "importance": 0.23}
            ],
            "local_explanations": [
                {
                    "instance_id": 0,
                    "prediction": 1,
                    "feature_contributions": {
                        "feature1": 0.2,
                        "feature2": -0.1,
                        "feature3": 0.3
                    }
                }
            ],
            "visualization_url": "https://api.example.com/ml/models/model_789/explanations/viz"
        }

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=explanation_data
        )

        result = await api_client.explain_model("model_789", method="shap")

        assert len(result["global_importance"]) == 3
        assert len(result["local_explanations"]) == 1
        assert "visualization_url" in result

    @pytest.mark.asyncio
    async def test_hyperparameter_optimization(self, api_client):
        """Test hyperparameter optimization job."""
        hpo_config = {
            "optimization_metric": "accuracy",
            "search_space": {
                "n_estimators": {"type": "int", "low": 50, "high": 200},
                "max_depth": {"type": "int", "low": 5, "high": 20},
                "learning_rate": {"type": "float", "low": 0.01, "high": 0.3}
            },
            "n_trials": 100,
            "timeout": 3600,
            "pruning": True
        }

        hpo_result = {
            "study_id": "hpo_study_123",
            "best_params": {
                "n_estimators": 150,
                "max_depth": 12,
                "learning_rate": 0.1
            },
            "best_score": 0.923,
            "n_completed_trials": 100,
            "optimization_time": 2400
        }

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=hpo_result
        )

        result = await api_client.optimize_hyperparameters(
            dataset_id="dataset_123",
            algorithm="gradient_boosting",
            config=hpo_config
        )

        assert result["best_score"] == 0.923
        assert result["n_completed_trials"] == 100
        assert "best_params" in result


class TestMLPipelineEdgeCases:
    """Test edge cases and error scenarios in ML pipeline."""

    @pytest.fixture
    def api_client(self):
        """Create mock ML Pipeline API client."""
        from schlep_engine.utils.http_client import HTTPClient
        http_client = AsyncMock(spec=HTTPClient)
        return MLPipelineAPI(http_client)

    @pytest.mark.asyncio
    async def test_insufficient_training_data(self, api_client):
        """Test handling of insufficient training data."""
        api_client.http_client.post.side_effect = APIError(
            "Insufficient training data - minimum 100 samples required",
            status_code=400,
            error_code="INSUFFICIENT_DATA"
        )

        with pytest.raises(ValidationError) as exc_info:
            await api_client.create_training_job(
                dataset_id="small_dataset",
                target_column="target"
            )

        assert "insufficient" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_memory_exceeded_during_training(self, api_client):
        """Test handling of memory exceeded errors."""
        api_client.http_client.post.side_effect = APIError(
            "Training job exceeded memory limits",
            status_code=507,
            error_code="MEMORY_EXCEEDED"
        )

        with pytest.raises(TrainingError):
            await api_client.create_training_job(
                dataset_id="large_dataset",
                target_column="target"
            )

    @pytest.mark.asyncio
    async def test_model_inference_timeout(self, api_client):
        """Test model inference timeout handling."""
        api_client.http_client.post.side_effect = asyncio.TimeoutError("Request timed out")

        with pytest.raises(InferenceError):
            await api_client.predict_single(
                model_id="slow_model",
                input_data={"feature1": 1.0}
            )

    @pytest.mark.asyncio
    async def test_corrupted_model_artifact(self, api_client):
        """Test handling of corrupted model artifacts."""
        api_client.http_client.post.side_effect = APIError(
            "Model artifact is corrupted",
            status_code=422,
            error_code="CORRUPTED_MODEL"
        )

        with pytest.raises(ModelError):
            await api_client.predict_single(
                model_id="corrupted_model",
                input_data={"feature1": 1.0}
            )

    @pytest.mark.asyncio
    async def test_feature_mismatch_inference(self, api_client):
        """Test feature schema mismatch during inference."""
        api_client.http_client.post.side_effect = APIError(
            "Feature schema mismatch - expected features: [feature1, feature2], got: [feature1, feature3]",
            status_code=400,
            error_code="FEATURE_MISMATCH"
        )

        mismatched_input = {"feature1": 1.0, "feature3": 3.0}  # Wrong feature

        with pytest.raises(ValidationError):
            await api_client.predict_single(
                model_id="model_789",
                input_data=mismatched_input
            )

    @pytest.mark.asyncio
    async def test_training_divergence(self, api_client):
        """Test handling of training divergence/instability."""
        diverged_job = MLJob(
            job_id="diverged_job",
            status=MLJobStatus.FAILED,
            error_message="Training diverged - loss became NaN",
            error_code="TRAINING_DIVERGED",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=diverged_job.dict()
        )

        result = await api_client.get_training_job_status("diverged_job")

        assert result.status == MLJobStatus.FAILED
        assert "diverged" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_concurrent_training_jobs_limit(self, api_client):
        """Test concurrent training jobs limit."""
        api_client.http_client.post.side_effect = APIError(
            "Maximum concurrent training jobs exceeded (limit: 5)",
            status_code=429,
            error_code="CONCURRENT_JOBS_LIMIT"
        )

        with pytest.raises(MLError):
            await api_client.create_training_job(
                dataset_id="dataset_123",
                target_column="target"
            )

    @pytest.mark.asyncio
    async def test_invalid_target_column(self, api_client):
        """Test training with invalid target column."""
        api_client.http_client.post.side_effect = APIError(
            "Target column 'nonexistent_column' not found in dataset",
            status_code=400,
            error_code="INVALID_TARGET_COLUMN"
        )

        with pytest.raises(ValidationError):
            await api_client.create_training_job(
                dataset_id="dataset_123",
                target_column="nonexistent_column"
            )

    @pytest.mark.asyncio
    async def test_model_serving_overload(self, api_client):
        """Test model serving under high load."""
        api_client.http_client.post.side_effect = APIError(
            "Model serving endpoint overloaded - please retry",
            status_code=503,
            error_code="SERVICE_UNAVAILABLE"
        )

        with pytest.raises(InferenceError):
            await api_client.predict_batch(
                model_id="overloaded_model",
                input_data=[{"feature1": i} for i in range(1000)]
            )


@pytest.mark.integration
class TestMLPipelineIntegration:
    """Integration tests for ML pipeline (requires real ML service)."""

    @pytest.mark.asyncio
    async def test_end_to_end_ml_workflow(self):
        """Test complete end-to-end ML workflow."""
        pytest.skip("Integration test - requires real ML service")

    @pytest.mark.asyncio
    async def test_real_model_training(self):
        """Test training with real dataset."""
        pytest.skip("Integration test - requires real ML service")

    @pytest.mark.asyncio
    async def test_production_model_deployment(self):
        """Test deploying model to production environment."""
        pytest.skip("Integration test - requires real ML service")


@pytest.mark.performance
class TestMLPipelinePerformance:
    """Performance tests for ML pipeline operations."""

    @pytest.fixture
    def api_client(self):
        """Create mock ML Pipeline API client."""
        from schlep_engine.utils.http_client import HTTPClient
        http_client = AsyncMock(spec=HTTPClient)
        return MLPipelineAPI(http_client)

    @pytest.mark.asyncio
    async def test_batch_inference_performance(self, api_client):
        """Test performance of batch inference."""
        # Generate large batch of test data
        large_batch = [
            {f"feature_{j}": np.random.random() for j in range(50)}
            for i in range(10000)
        ]

        predictions = [
            {"prediction": np.random.randint(0, 2), "probability": np.random.random()}
            for _ in range(10000)
        ]

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data={"predictions": predictions}
        )

        start_time = datetime.now()
        result = await api_client.predict_batch(
            model_id="performance_model",
            input_data=large_batch
        )
        end_time = datetime.now()

        processing_time = (end_time - start_time).total_seconds()

        assert len(result["predictions"]) == 10000
        assert processing_time < 10  # Should process 10k predictions in under 10 seconds

    @pytest.mark.asyncio
    async def test_concurrent_inference_requests(self, api_client):
        """Test concurrent inference request handling."""
        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data={"prediction": 1, "probability": 0.85}
        )

        # Make 100 concurrent inference requests
        tasks = [
            api_client.predict_single(
                model_id="concurrent_model",
                input_data={"feature1": i}
            )
            for i in range(100)
        ]

        start_time = datetime.now()
        results = await asyncio.gather(*tasks)
        end_time = datetime.now()

        processing_time = (end_time - start_time).total_seconds()

        assert len(results) == 100
        assert all("prediction" in result for result in results)
        assert processing_time < 5  # Should handle 100 concurrent requests in under 5 seconds

    @pytest.mark.asyncio
    async def test_large_model_artifact_handling(self, api_client):
        """Test handling of large model artifacts."""
        # Simulate large model download
        large_model_info = {
            "model_id": "large_model",
            "size_mb": 2048,  # 2GB model
            "download_url": "https://storage.example.com/models/large_model.pkl",
            "checksum": "sha256:abcdef123456"
        }

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=large_model_info
        )

        result = await api_client.get_model_artifact("large_model")

        assert result["size_mb"] == 2048
        assert "download_url" in result
        assert "checksum" in result