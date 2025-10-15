"""
Unit tests for Training Orchestrator

Tests cover:
- Training job creation
- Model training lifecycle
- Hyperparameter configuration
- Metrics tracking
- Job status management
- Model retraining
- Model comparison
"""

import pytest
import os
import time
from training_orchestrator import (
    TrainingOrchestrator,
    TrainingJob,
    TrainingStatus,
    ModelType,
    get_orchestrator
)


@pytest.mark.unit
class TestTrainingOrchestrator:
    """Test suite for TrainingOrchestrator class"""

    def test_orchestrator_initialization(self, training_orchestrator):
        """Test orchestrator initializes correctly"""
        assert training_orchestrator is not None
        assert isinstance(training_orchestrator.jobs, dict)
        assert os.path.exists(training_orchestrator.models_dir)

    def test_create_training_job(self, training_orchestrator, training_data_sample):
        """Test creating a training job"""
        job = training_orchestrator.create_training_job(
            model_id="test-model",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "50", "max_depth": "10"},
            config={"validation_split": "0.2"}
        )

        assert job is not None
        assert isinstance(job, TrainingJob)
        assert job.model_id == "test-model"
        assert job.algorithm == "random_forest"
        assert job.status in [TrainingStatus.PENDING, TrainingStatus.RUNNING, TrainingStatus.COMPLETED]

    def test_training_job_completes(self, training_orchestrator, training_data_sample):
        """Test that training job completes successfully"""
        job = training_orchestrator.create_training_job(
            model_id="test-model-complete",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "10"},
            config={}
        )

        # Wait a bit for training to complete (it's synchronous in current implementation)
        time.sleep(0.5)

        # Job should be completed
        assert job.status == TrainingStatus.COMPLETED
        assert job.end_time is not None
        assert job.metrics is not None

    def test_training_job_has_metrics(self, training_orchestrator, training_data_sample):
        """Test that completed job has metrics"""
        job = training_orchestrator.create_training_job(
            model_id="test-model-metrics",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "10"},
            config={}
        )

        assert job.metrics is not None
        assert "accuracy" in job.metrics
        assert "precision" in job.metrics
        assert "recall" in job.metrics
        assert "f1_score" in job.metrics
        assert "training_time_sec" in job.metrics

    def test_training_job_progress(self, training_orchestrator, training_data_sample):
        """Test that training job tracks progress"""
        job = training_orchestrator.create_training_job(
            model_id="test-model-progress",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "10"},
            config={}
        )

        # Progress should reach 100%
        assert job.progress_pct == 100.0

    def test_get_job_status(self, training_orchestrator, training_data_sample):
        """Test getting job status"""
        job = training_orchestrator.create_training_job(
            model_id="test-model-status",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        # Get job status
        retrieved_job = training_orchestrator.get_job_status(job.job_id)

        assert retrieved_job is not None
        assert retrieved_job.job_id == job.job_id
        assert retrieved_job.model_id == job.model_id

    def test_get_job_status_nonexistent(self, training_orchestrator):
        """Test getting status for nonexistent job"""
        job = training_orchestrator.get_job_status("nonexistent-job-id")

        assert job is None

    def test_list_jobs(self, training_orchestrator, training_data_sample):
        """Test listing training jobs"""
        # Create multiple jobs
        for i in range(3):
            training_orchestrator.create_training_job(
                model_id=f"test-model-{i}",
                model_type="sklearn",
                algorithm="random_forest",
                training_data=training_data_sample,
                hyperparameters={},
                config={}
            )

        # List jobs
        jobs = training_orchestrator.list_jobs()

        assert len(jobs) >= 3

    def test_list_jobs_with_limit(self, training_orchestrator, training_data_sample):
        """Test listing jobs with limit"""
        # Create multiple jobs
        for i in range(5):
            training_orchestrator.create_training_job(
                model_id=f"test-model-limit-{i}",
                model_type="sklearn",
                algorithm="random_forest",
                training_data=training_data_sample,
                hyperparameters={},
                config={}
            )

        # List with limit
        jobs = training_orchestrator.list_jobs(limit=3)

        assert len(jobs) <= 3

    def test_cancel_training(self, training_orchestrator, training_data_sample):
        """Test canceling a training job"""
        # Note: Current implementation trains synchronously, so this test
        # may not work as expected. Testing the API contract.
        job = training_orchestrator.create_training_job(
            model_id="test-model-cancel",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        # Try to cancel (may not work if already completed)
        result = training_orchestrator.cancel_training(job.job_id)

        # Result depends on timing
        assert isinstance(result, bool)

    def test_cancel_nonexistent_job(self, training_orchestrator):
        """Test canceling nonexistent job"""
        result = training_orchestrator.cancel_training("nonexistent-job")

        assert result is False


@pytest.mark.unit
class TestModelTraining:
    """Test suite for model training functionality"""

    def test_train_random_forest(self, training_orchestrator, training_data_sample):
        """Test training random forest model"""
        job = training_orchestrator.create_training_job(
            model_id="rf-model",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "10", "max_depth": "5"},
            config={}
        )

        assert job.status == TrainingStatus.COMPLETED
        assert job.metrics["accuracy"] >= 0

    def test_train_gradient_boosting(self, training_orchestrator, training_data_sample):
        """Test training gradient boosting model"""
        job = training_orchestrator.create_training_job(
            model_id="gb-model",
            model_type="sklearn",
            algorithm="gradient_boosting",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "10", "learning_rate": "0.1"},
            config={}
        )

        assert job.status == TrainingStatus.COMPLETED

    def test_train_neural_network(self, training_orchestrator, training_data_sample):
        """Test training neural network model"""
        job = training_orchestrator.create_training_job(
            model_id="nn-model",
            model_type="sklearn",
            algorithm="neural_network",
            training_data=training_data_sample,
            hyperparameters={"hidden_layers": "(50,)", "learning_rate": "0.001"},
            config={}
        )

        assert job.status == TrainingStatus.COMPLETED

    def test_train_with_different_validation_split(self, training_orchestrator, training_data_sample):
        """Test training with custom validation split"""
        job = training_orchestrator.create_training_job(
            model_id="split-model",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={"validation_split": "0.3"}
        )

        assert job.status == TrainingStatus.COMPLETED

    def test_train_unknown_algorithm(self, training_orchestrator, training_data_sample):
        """Test training with unknown algorithm fails gracefully"""
        job = training_orchestrator.create_training_job(
            model_id="unknown-model",
            model_type="sklearn",
            algorithm="unknown_algorithm",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        # Should fail
        assert job.status == TrainingStatus.FAILED
        assert job.error_message is not None

    def test_train_unsupported_model_type(self, training_orchestrator, training_data_sample):
        """Test training with unsupported model type"""
        job = training_orchestrator.create_training_job(
            model_id="unsupported-model",
            model_type="unsupported_type",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        assert job.status == TrainingStatus.FAILED


@pytest.mark.unit
class TestModelSaving:
    """Test suite for model saving functionality"""

    def test_model_saved_to_disk(self, training_orchestrator, training_data_sample):
        """Test that trained model is saved to disk"""
        model_id = "saved-model-test"
        job = training_orchestrator.create_training_job(
            model_id=model_id,
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        # Check model file exists
        model_path = os.path.join(training_orchestrator.models_dir, f"{model_id}.pkl")
        assert os.path.exists(model_path)

    def test_saved_model_loadable(self, training_orchestrator, training_data_sample):
        """Test that saved model can be loaded"""
        import joblib

        model_id = "loadable-model-test"
        training_orchestrator.create_training_job(
            model_id=model_id,
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        # Load model
        model_path = os.path.join(training_orchestrator.models_dir, f"{model_id}.pkl")
        model = joblib.load(model_path)

        # Model should be usable
        assert hasattr(model, 'predict')


@pytest.mark.unit
class TestTrainingMetrics:
    """Test suite for training metrics"""

    def test_metrics_accuracy_range(self, training_orchestrator, training_data_sample):
        """Test that accuracy is in valid range"""
        job = training_orchestrator.create_training_job(
            model_id="accuracy-test",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        assert 0 <= job.metrics["accuracy"] <= 1.0

    def test_metrics_include_sample_counts(self, training_orchestrator, training_data_sample):
        """Test that metrics include sample counts"""
        job = training_orchestrator.create_training_job(
            model_id="counts-test",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        assert "training_samples" in job.metrics
        assert "test_samples" in job.metrics
        assert job.metrics["training_samples"] > 0
        assert job.metrics["test_samples"] > 0

    def test_metrics_include_training_time(self, training_orchestrator, training_data_sample):
        """Test that metrics include training time"""
        job = training_orchestrator.create_training_job(
            model_id="time-test",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        assert "training_time_sec" in job.metrics
        assert job.metrics["training_time_sec"] > 0


@pytest.mark.unit
class TestTrainingJobModel:
    """Test suite for TrainingJob model"""

    def test_training_job_to_dict(self):
        """Test converting training job to dict"""
        job = TrainingJob(
            job_id="test-123",
            model_id="test-model",
            model_type="sklearn",
            algorithm="random_forest",
            status=TrainingStatus.COMPLETED,
            progress_pct=100.0
        )

        job_dict = job.to_dict()

        assert job_dict["job_id"] == "test-123"
        assert job_dict["model_id"] == "test-model"
        assert job_dict["status"] == "completed"
        assert job_dict["progress_pct"] == 100.0

    def test_training_status_enum(self):
        """Test TrainingStatus enum values"""
        assert TrainingStatus.PENDING.value == "pending"
        assert TrainingStatus.RUNNING.value == "running"
        assert TrainingStatus.COMPLETED.value == "completed"
        assert TrainingStatus.FAILED.value == "failed"
        assert TrainingStatus.CANCELLED.value == "cancelled"

    def test_model_type_enum(self):
        """Test ModelType enum values"""
        assert ModelType.SKLEARN.value == "sklearn"
        assert ModelType.PYTORCH.value == "pytorch"
        assert ModelType.TENSORFLOW.value == "tensorflow"


@pytest.mark.unit
class TestHyperparameters:
    """Test suite for hyperparameter handling"""

    def test_hyperparameters_applied(self, training_orchestrator, training_data_sample):
        """Test that hyperparameters are applied to model"""
        job = training_orchestrator.create_training_job(
            model_id="hyperparam-test",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "20", "max_depth": "8"},
            config={}
        )

        # Load the model and check parameters
        import joblib
        model_path = os.path.join(training_orchestrator.models_dir, f"{job.model_id}.pkl")
        model = joblib.load(model_path)

        assert model.n_estimators == 20
        assert model.max_depth == 8

    def test_default_hyperparameters(self, training_orchestrator, training_data_sample):
        """Test training with default hyperparameters"""
        job = training_orchestrator.create_training_job(
            model_id="default-hyperparam",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},  # Empty - use defaults
            config={}
        )

        assert job.status == TrainingStatus.COMPLETED


@pytest.mark.unit
class TestOrchestratorSingleton:
    """Test suite for orchestrator singleton"""

    def test_get_orchestrator_singleton(self):
        """Test that get_orchestrator returns singleton"""
        orch1 = get_orchestrator()
        orch2 = get_orchestrator()

        # Should be same instance
        assert orch1 is orch2

    def test_orchestrator_persists_state(self, training_data_sample):
        """Test that orchestrator state persists across calls"""
        orch1 = get_orchestrator()

        # Create a job
        job = orch1.create_training_job(
            model_id="persist-test",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={},
            config={}
        )

        # Get orchestrator again
        orch2 = get_orchestrator()

        # Should have the job
        retrieved_job = orch2.get_job_status(job.job_id)
        assert retrieved_job is not None
        assert retrieved_job.job_id == job.job_id


@pytest.mark.unit
class TestModelRetraining:
    """Test suite for model retraining functionality"""

    def test_retrain_model_creates_job(self, training_orchestrator, training_data_sample, mock_model_file):
        """Test that retraining creates a new job"""
        # First train a model
        import joblib
        from sklearn.ensemble import RandomForestClassifier

        model_id = "retrain-test"
        model = RandomForestClassifier(n_estimators=10)
        X = [[1, 2], [3, 4]]
        y = [0, 1]
        model.fit(X, y)

        model_path = os.path.join(training_orchestrator.models_dir, f"{model_id}.pkl")
        joblib.dump(model, model_path)

        # Retrain
        job = training_orchestrator.retrain_model(
            model_id=model_id,
            new_data=training_data_sample,
            incremental=False,
            hyperparameters={}
        )

        assert job is not None
        assert job.model_id == f"{model_id}_retrained"

    def test_retrain_nonexistent_model_fails(self, training_orchestrator, training_data_sample):
        """Test that retraining nonexistent model fails"""
        with pytest.raises(FileNotFoundError):
            training_orchestrator.retrain_model(
                model_id="nonexistent-model",
                new_data=training_data_sample,
                incremental=False,
                hyperparameters={}
            )


@pytest.mark.unit
class TestModelComparison:
    """Test suite for model comparison functionality"""

    def test_compare_models(self, training_orchestrator, training_data_sample):
        """Test comparing two models"""
        # Train two models
        job1 = training_orchestrator.create_training_job(
            model_id="compare-model-1",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "10"},
            config={}
        )

        job2 = training_orchestrator.create_training_job(
            model_id="compare-model-2",
            model_type="sklearn",
            algorithm="random_forest",
            training_data=training_data_sample,
            hyperparameters={"n_estimators": "20"},
            config={}
        )

        # Compare models
        comparison = training_orchestrator.get_model_comparison(
            old_model_id=job1.model_id,
            new_model_id=job2.model_id,
            test_data=training_data_sample
        )

        assert "old_accuracy" in comparison
        assert "new_accuracy" in comparison
        assert "improvement_pct" in comparison
        assert "test_samples" in comparison
