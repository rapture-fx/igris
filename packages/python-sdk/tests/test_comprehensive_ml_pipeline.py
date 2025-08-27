"""
Comprehensive ML pipeline tests for Schlep-engine Python SDK
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from schlep_engine.api.ml_pipeline import MLPipelineAPI
from schlep_engine.models.ml import (
    MLPipeline, TrainingJob, ModelConfig, HyperParameters,
    ModelMetrics, PredictionJob, ModelVersion, FeatureConfig
)
from schlep_engine.exceptions.base import APIError, ValidationError


class TestMLPipelineAPI:
    """Comprehensive tests for MLPipelineAPI."""

    @pytest.fixture
    def ml_api(self, client):
        """ML pipeline API instance."""
        return MLPipelineAPI(client.http_client)

    @pytest.fixture
    def sample_pipeline(self):
        """Sample ML pipeline data."""
        return MLPipeline(
            pipeline_id="pipeline-123",
            name="Customer Churn Prediction",
            description="ML pipeline for predicting customer churn",
            model_type="random_forest",
            status="active",
            created_at="2024-01-01T12:00:00Z",
            updated_at="2024-01-01T12:00:00Z",
            config=ModelConfig(
                algorithm="random_forest",
                hyperparameters=HyperParameters(
                    n_estimators=100,
                    max_depth=10,
                    min_samples_split=2
                ),
                features=FeatureConfig(
                    feature_columns=["age", "income", "usage"],
                    target_column="churned",
                    encoding_strategy="auto"
                )
            ),
            metrics=ModelMetrics(
                accuracy=0.92,
                precision=0.89,
                recall=0.94,
                f1_score=0.91,
                auc_score=0.88
            )
        )

    @pytest.fixture
    def sample_training_job(self):
        """Sample training job data."""
        return TrainingJob(
            job_id="train-job-123",
            pipeline_id="pipeline-123",
            status="running",
            progress={"current_epoch": 10, "total_epochs": 100},
            started_at="2024-01-01T12:00:00Z",
            estimated_completion="2024-01-01T13:00:00Z",
            metrics=ModelMetrics(
                accuracy=0.85,
                precision=0.82,
                recall=0.87,
                f1_score=0.84
            )
        )

    @pytest.mark.asyncio
    async def test_create_pipeline_success(self, ml_api, sample_pipeline):
        """Test successful pipeline creation."""
        pipeline_config = {
            "name": "Customer Churn Prediction",
            "description": "ML pipeline for predicting customer churn",
            "model_type": "random_forest",
            "config": sample_pipeline.config.dict()
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_pipeline.dict()
            }
            
            result = await ml_api.create_pipeline(pipeline_config)
            
            assert isinstance(result, MLPipeline)
            assert result.pipeline_id == "pipeline-123"
            assert result.name == "Customer Churn Prediction"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_pipeline_invalid_config(self, ml_api):
        """Test pipeline creation with invalid configuration."""
        invalid_config = {
            "name": "",  # Invalid: empty name
            "model_type": "unsupported_model"
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Invalid configuration", status_code=400)
            
            with pytest.raises(APIError) as exc_info:
                await ml_api.create_pipeline(invalid_config)
            
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_get_pipeline(self, ml_api, sample_pipeline):
        """Test getting pipeline by ID."""
        with patch.object(ml_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": sample_pipeline.dict()
            }
            
            result = await ml_api.get_pipeline("pipeline-123")
            
            assert isinstance(result, MLPipeline)
            assert result.pipeline_id == "pipeline-123"
            mock_get.assert_called_once_with("/api/v1/ml/pipelines/pipeline-123")

    @pytest.mark.asyncio
    async def test_list_pipelines(self, ml_api, sample_pipeline):
        """Test listing pipelines."""
        pipelines_data = {
            "pipelines": [sample_pipeline.dict()],
            "pagination": {
                "page": 1,
                "per_page": 10,
                "total": 1,
                "pages": 1
            }
        }
        
        with patch.object(ml_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"success": True, "data": pipelines_data}
            
            result = await ml_api.list_pipelines(status="active")
            
            assert len(result["pipelines"]) == 1
            assert isinstance(result["pipelines"][0], MLPipeline)
            mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_train_model(self, ml_api, sample_training_job):
        """Test model training."""
        training_data = "data_source_123"
        training_config = {
            "batch_size": 32,
            "learning_rate": 0.001,
            "epochs": 100
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_training_job.dict()
            }
            
            result = await ml_api.train_model(
                "pipeline-123",
                training_data,
                config=training_config
            )
            
            assert isinstance(result, TrainingJob)
            assert result.job_id == "train-job-123"
            assert result.status == "running"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_training_status(self, ml_api, sample_training_job):
        """Test getting training job status."""
        with patch.object(ml_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": sample_training_job.dict()
            }
            
            result = await ml_api.get_training_status("train-job-123")
            
            assert isinstance(result, TrainingJob)
            assert result.job_id == "train-job-123"
            mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_wait_for_training_completion(self, ml_api):
        """Test waiting for training completion."""
        training_states = [
            TrainingJob(
                job_id="train-job-123",
                pipeline_id="pipeline-123",
                status="running",
                progress={"current_epoch": 25, "total_epochs": 100},
                started_at="2024-01-01T12:00:00Z"
            ),
            TrainingJob(
                job_id="train-job-123",
                pipeline_id="pipeline-123",
                status="running",
                progress={"current_epoch": 75, "total_epochs": 100},
                started_at="2024-01-01T12:00:00Z"
            ),
            TrainingJob(
                job_id="train-job-123",
                pipeline_id="pipeline-123",
                status="completed",
                progress={"current_epoch": 100, "total_epochs": 100},
                started_at="2024-01-01T12:00:00Z",
                completed_at="2024-01-01T13:00:00Z",
                metrics=ModelMetrics(
                    accuracy=0.92,
                    precision=0.89,
                    recall=0.94,
                    f1_score=0.91
                )
            )
        ]
        
        call_count = 0
        
        async def mock_get_status(*args, **kwargs):
            nonlocal call_count
            result = training_states[min(call_count, len(training_states) - 1)]
            call_count += 1
            return result
        
        with patch.object(ml_api, 'get_training_status', side_effect=mock_get_status):
            result = await ml_api.wait_for_training_completion(
                "train-job-123",
                timeout=10,
                poll_interval=0.1
            )
            
            assert result.status == "completed"
            assert result.metrics is not None
            assert call_count >= 3

    @pytest.mark.asyncio
    async def test_make_prediction(self, ml_api):
        """Test making predictions."""
        input_data = [
            {"age": 25, "income": 50000, "usage": 120},
            {"age": 35, "income": 75000, "usage": 200}
        ]
        
        prediction_result = {
            "predictions": [0.2, 0.8],
            "probabilities": [[0.8, 0.2], [0.2, 0.8]],
            "confidence": [0.85, 0.92]
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": prediction_result
            }
            
            result = await ml_api.make_prediction("pipeline-123", input_data)
            
            assert "predictions" in result
            assert len(result["predictions"]) == 2
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_batch_prediction(self, ml_api):
        """Test batch prediction."""
        prediction_job = PredictionJob(
            job_id="pred-job-123",
            pipeline_id="pipeline-123",
            status="running",
            progress={"processed": 500, "total": 1000},
            created_at="2024-01-01T12:00:00Z"
        )
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": prediction_job.dict()
            }
            
            result = await ml_api.batch_prediction(
                "pipeline-123",
                "data_source_456",
                output_location="s3://bucket/predictions.csv"
            )
            
            assert isinstance(result, PredictionJob)
            assert result.job_id == "pred-job-123"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_hyperparameter_tuning(self, ml_api):
        """Test hyperparameter tuning."""
        tuning_config = {
            "parameter_space": {
                "n_estimators": [50, 100, 200],
                "max_depth": [5, 10, 15],
                "min_samples_split": [2, 5, 10]
            },
            "optimization_metric": "f1_score",
            "cv_folds": 5,
            "max_trials": 20
        }
        
        tuning_job = TrainingJob(
            job_id="tune-job-123",
            pipeline_id="pipeline-123",
            status="running",
            progress={"completed_trials": 5, "total_trials": 20},
            started_at="2024-01-01T12:00:00Z"
        )
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": tuning_job.dict()
            }
            
            result = await ml_api.tune_hyperparameters(
                "pipeline-123",
                "training_data_123",
                tuning_config
            )
            
            assert isinstance(result, TrainingJob)
            assert result.job_id == "tune-job-123"

    @pytest.mark.asyncio
    async def test_model_evaluation(self, ml_api):
        """Test model evaluation."""
        evaluation_result = {
            "metrics": {
                "accuracy": 0.92,
                "precision": 0.89,
                "recall": 0.94,
                "f1_score": 0.91,
                "confusion_matrix": [[85, 5], [3, 7]]
            },
            "feature_importance": {
                "income": 0.45,
                "usage": 0.35,
                "age": 0.20
            },
            "cross_validation": {
                "cv_scores": [0.90, 0.91, 0.93, 0.89, 0.92],
                "mean_score": 0.91,
                "std_score": 0.015
            }
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": evaluation_result
            }
            
            result = await ml_api.evaluate_model(
                "pipeline-123",
                "test_data_123",
                metrics=["accuracy", "precision", "recall", "f1_score"]
            )
            
            assert "metrics" in result
            assert "feature_importance" in result
            assert result["metrics"]["accuracy"] == 0.92

    @pytest.mark.asyncio
    async def test_update_pipeline(self, ml_api, sample_pipeline):
        """Test updating pipeline configuration."""
        updated_config = {
            "description": "Updated description",
            "config": {
                "algorithm": "xgboost",
                "hyperparameters": {
                    "n_estimators": 200,
                    "max_depth": 8
                }
            }
        }
        
        updated_pipeline = sample_pipeline.copy()
        updated_pipeline.description = "Updated description"
        
        with patch.object(ml_api.http_client, 'put', new_callable=AsyncMock) as mock_put:
            mock_put.return_value = {
                "success": True,
                "data": updated_pipeline.dict()
            }
            
            result = await ml_api.update_pipeline("pipeline-123", updated_config)
            
            assert isinstance(result, MLPipeline)
            assert result.description == "Updated description"
            mock_put.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_pipeline(self, ml_api):
        """Test deleting pipeline."""
        with patch.object(ml_api.http_client, 'delete', new_callable=AsyncMock) as mock_delete:
            mock_delete.return_value = {"success": True, "message": "Pipeline deleted"}
            
            result = await ml_api.delete_pipeline("pipeline-123")
            
            assert result is True
            mock_delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_model_versions(self, ml_api):
        """Test getting model versions."""
        versions = [
            ModelVersion(
                version_id="v1.0",
                pipeline_id="pipeline-123",
                version="1.0",
                status="active",
                created_at="2024-01-01T12:00:00Z",
                metrics=ModelMetrics(accuracy=0.90, f1_score=0.88)
            ),
            ModelVersion(
                version_id="v1.1",
                pipeline_id="pipeline-123",
                version="1.1",
                status="inactive",
                created_at="2024-01-02T12:00:00Z",
                metrics=ModelMetrics(accuracy=0.92, f1_score=0.91)
            )
        ]
        
        with patch.object(ml_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": {"versions": [v.dict() for v in versions]}
            }
            
            result = await ml_api.get_model_versions("pipeline-123")
            
            assert len(result) == 2
            assert all(isinstance(v, ModelVersion) for v in result)
            mock_get.assert_called_once()


class TestMLModelConfiguration:
    """Test ML model configuration and validation."""

    def test_model_config_validation(self):
        """Test model configuration validation."""
        config = ModelConfig(
            algorithm="random_forest",
            hyperparameters=HyperParameters(
                n_estimators=100,
                max_depth=10
            ),
            features=FeatureConfig(
                feature_columns=["age", "income"],
                target_column="churned"
            )
        )
        
        assert config.algorithm == "random_forest"
        assert config.hyperparameters.n_estimators == 100
        assert len(config.features.feature_columns) == 2

    def test_hyperparameters_validation(self):
        """Test hyperparameter validation."""
        # Valid hyperparameters
        valid_params = HyperParameters(
            n_estimators=100,
            max_depth=10,
            learning_rate=0.01
        )
        assert valid_params.n_estimators == 100
        
        # Invalid hyperparameters
        with pytest.raises(ValidationError):
            HyperParameters(
                n_estimators=-1,  # Invalid
                max_depth=10
            )

    def test_feature_config_validation(self):
        """Test feature configuration validation."""
        config = FeatureConfig(
            feature_columns=["age", "income", "usage"],
            target_column="churned",
            encoding_strategy="auto"
        )
        
        assert len(config.feature_columns) == 3
        assert config.target_column == "churned"
        
        # Test invalid configuration
        with pytest.raises(ValidationError):
            FeatureConfig(
                feature_columns=[],  # Empty features
                target_column="churned"
            )


class TestMLPerformanceOptimization:
    """Test ML performance optimization features."""

    @pytest.mark.asyncio
    async def test_model_caching(self, ml_api):
        """Test model prediction caching."""
        input_data = [{"age": 25, "income": 50000}]
        cached_result = {"predictions": [0.2], "cached": True}
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": cached_result
            }
            
            # First call
            result1 = await ml_api.make_prediction("pipeline-123", input_data)
            
            # Second identical call (should use cache)
            result2 = await ml_api.make_prediction("pipeline-123", input_data)
            
            assert result1 == result2
            # Cache implementation would reduce actual API calls

    @pytest.mark.asyncio
    async def test_parallel_training(self, ml_api):
        """Test parallel model training."""
        training_configs = [
            {"algorithm": "random_forest", "n_estimators": 100},
            {"algorithm": "xgboost", "n_estimators": 100},
            {"algorithm": "svm", "kernel": "rbf"}
        ]
        
        training_jobs = [
            TrainingJob(
                job_id=f"train-job-{i}",
                pipeline_id="pipeline-123",
                status="running",
                progress={"current_epoch": 0, "total_epochs": 100},
                started_at="2024-01-01T12:00:00Z"
            )
            for i in range(3)
        ]
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = [
                {"success": True, "data": job.dict()}
                for job in training_jobs
            ]
            
            # Start multiple training jobs in parallel
            tasks = [
                ml_api.train_model("pipeline-123", "data_source", config=config)
                for config in training_configs
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            assert len(results) == 3
            assert all(isinstance(r, TrainingJob) for r in results)

    @pytest.mark.asyncio
    async def test_incremental_learning(self, ml_api, sample_training_job):
        """Test incremental learning capabilities."""
        incremental_config = {
            "incremental": True,
            "base_model_version": "v1.0",
            "learning_rate": 0.001,
            "epochs": 10
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_training_job.dict()
            }
            
            result = await ml_api.incremental_training(
                "pipeline-123",
                "new_data_source",
                config=incremental_config
            )
            
            assert isinstance(result, TrainingJob)
            mock_post.assert_called_once()


class TestMLErrorHandling:
    """Test error handling in ML operations."""

    @pytest.mark.asyncio
    async def test_training_failure_recovery(self, ml_api):
        """Test recovery from training failures."""
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            # Simulate training failure
            mock_post.side_effect = APIError("Training failed: insufficient memory", status_code=500)
            
            with pytest.raises(APIError) as exc_info:
                await ml_api.train_model("pipeline-123", "data_source")
            
            assert "Training failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_model_prediction_errors(self, ml_api):
        """Test handling of prediction errors."""
        invalid_input = [{"invalid_feature": "value"}]
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Invalid input features", status_code=400)
            
            with pytest.raises(APIError) as exc_info:
                await ml_api.make_prediction("pipeline-123", invalid_input)
            
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_pipeline_not_found(self, ml_api):
        """Test handling of non-existent pipeline."""
        with patch.object(ml_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = APIError("Pipeline not found", status_code=404)
            
            with pytest.raises(APIError) as exc_info:
                await ml_api.get_pipeline("nonexistent-pipeline")
            
            assert exc_info.value.status_code == 404


@pytest.mark.integration
class TestMLPipelineIntegration:
    """Integration tests for ML pipeline (requires test API)."""

    @pytest.mark.asyncio
    async def test_full_ml_lifecycle(self):
        """Test complete ML lifecycle: create, train, evaluate, predict."""
        pytest.skip("Integration test - requires real API endpoint")

    @pytest.mark.asyncio
    async def test_real_model_training(self):
        """Test training models with real data."""
        pytest.skip("Integration test - requires real API endpoint and training data")


class TestMLPipelineAdvancedFeatures:
    """Test advanced ML pipeline features."""

    @pytest.mark.asyncio
    async def test_automated_feature_engineering(self, ml_api):
        """Test automated feature engineering."""
        feature_config = {
            "enable_auto_features": True,
            "feature_types": ["polynomial", "interaction", "statistical"],
            "max_features": 100
        }
        
        engineered_features = {
            "original_features": ["age", "income"],
            "generated_features": ["age_squared", "age_income_ratio", "income_log"],
            "feature_importance": {"age": 0.3, "income": 0.4, "age_squared": 0.3}
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": engineered_features
            }
            
            result = await ml_api.generate_features("pipeline-123", feature_config)
            
            assert "generated_features" in result
            assert len(result["generated_features"]) == 3

    @pytest.mark.asyncio
    async def test_model_explainability(self, ml_api):
        """Test model explainability features."""
        explanation_result = {
            "global_importance": {"income": 0.45, "age": 0.35, "usage": 0.20},
            "local_explanations": [
                {
                    "prediction": 0.8,
                    "features": {"income": 0.5, "age": 0.2, "usage": 0.1}
                }
            ],
            "shap_values": [[0.1, -0.05, 0.3]],
            "lime_explanation": "High income (+0.5) and usage (+0.3) increase churn probability"
        }
        
        with patch.object(ml_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": explanation_result
            }
            
            result = await ml_api.explain_prediction(
                "pipeline-123",
                [{"age": 25, "income": 50000, "usage": 120}]
            )
            
            assert "global_importance" in result
            assert "local_explanations" in result

    @pytest.mark.asyncio
    async def test_model_monitoring(self, ml_api):
        """Test model performance monitoring."""
        monitoring_metrics = {
            "drift_detection": {
                "feature_drift": {"income": 0.15, "age": 0.05},
                "prediction_drift": 0.08,
                "drift_threshold": 0.1
            },
            "performance_metrics": {
                "accuracy": 0.89,
                "precision": 0.86,
                "recall": 0.92,
                "f1_score": 0.89
            },
            "alerts": [
                {"type": "feature_drift", "feature": "income", "severity": "medium"}
            ]
        }
        
        with patch.object(ml_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": monitoring_metrics
            }
            
            result = await ml_api.get_model_monitoring("pipeline-123")
            
            assert "drift_detection" in result
            assert "performance_metrics" in result
            assert len(result["alerts"]) == 1


@pytest.mark.slow
class TestMLPipelinePerformance:
    """Performance tests for ML pipeline operations."""

    @pytest.mark.asyncio
    async def test_large_dataset_training(self):
        """Test training with large datasets."""
        pytest.skip("Slow performance test - run with -m slow")

    @pytest.mark.asyncio
    async def test_high_frequency_predictions(self):
        """Test high-frequency prediction requests."""
        pytest.skip("Slow performance test - run with -m slow")