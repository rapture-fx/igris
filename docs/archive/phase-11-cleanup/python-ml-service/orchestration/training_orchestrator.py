#!/usr/bin/env python3
"""
ML Training Orchestrator - Phase 2
Handles model training, retraining, and management workflows
"""

import os
import time
import uuid
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np

# ML libraries
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

logger = logging.getLogger(__name__)


class TrainingStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ModelType(Enum):
    SKLEARN = "sklearn"
    PYTORCH = "pytorch"
    TENSORFLOW = "tensorflow"


@dataclass
class TrainingJob:
    job_id: str
    model_id: str
    model_type: str
    algorithm: str
    status: TrainingStatus
    progress_pct: float = 0.0
    start_time: float = 0.0
    end_time: Optional[float] = None
    error_message: Optional[str] = None
    metrics: Dict[str, Any] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['status'] = self.status.value
        return data


class TrainingOrchestrator:
    """Orchestrates ML model training workflows"""

    def __init__(self):
        self.jobs: Dict[str, TrainingJob] = {}
        self.models_dir = "models/"
        os.makedirs(self.models_dir, exist_ok=True)

        logger.info("Training Orchestrator initialized")

    def create_training_job(
        self,
        model_id: str,
        model_type: str,
        algorithm: str,
        training_data: List[Dict[str, Any]],
        hyperparameters: Dict[str, str],
        config: Dict[str, Any]
    ) -> TrainingJob:
        """Create a new training job"""

        job_id = str(uuid.uuid4())[:8]

        job = TrainingJob(
            job_id=job_id,
            model_id=model_id,
            model_type=model_type,
            algorithm=algorithm,
            status=TrainingStatus.PENDING,
            start_time=time.time()
        )

        self.jobs[job_id] = job

        logger.info(f"Created training job: {job_id} for model: {model_id}")

        # Start training in background (in production, use Celery/RQ)
        self._train_model_sync(
            job,
            training_data,
            hyperparameters,
            config
        )

        return job

    def _train_model_sync(
        self,
        job: TrainingJob,
        training_data: List[Dict[str, Any]],
        hyperparameters: Dict[str, str],
        config: Dict[str, Any]
    ):
        """Train model (synchronous for prototype, async in production)"""

        try:
            job.status = TrainingStatus.RUNNING
            job.progress_pct = 0.0

            logger.info(f"Starting training for job: {job.job_id}")

            # Extract features and labels
            X = np.array([sample['features'] for sample in training_data])
            y = np.array([
                sample.get('numeric_label') or sample.get('categorical_label')
                for sample in training_data
            ])

            logger.info(f"Training data shape: X={X.shape}, y={y.shape}")

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y,
                test_size=float(config.get('validation_split', 0.2)),
                random_state=42
            )

            job.progress_pct = 20.0

            # Create model based on algorithm
            model = self._create_model(
                job.model_type,
                job.algorithm,
                hyperparameters
            )

            job.progress_pct = 40.0

            # Train model
            logger.info(f"Training {job.algorithm} model...")
            model.fit(X_train, y_train)

            job.progress_pct = 70.0

            # Evaluate model
            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            precision, recall, f1, support = precision_recall_fscore_support(
                y_test, y_pred, average='weighted'
            )

            job.progress_pct = 90.0

            # Save model
            model_path = os.path.join(self.models_dir, f"{job.model_id}.pkl")
            import joblib
            joblib.dump(model, model_path)

            job.progress_pct = 100.0
            job.status = TrainingStatus.COMPLETED
            job.end_time = time.time()
            job.metrics = {
                'accuracy': float(accuracy),
                'precision': float(precision),
                'recall': float(recall),
                'f1_score': float(f1),
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'training_time_sec': job.end_time - job.start_time
            }

            logger.info(
                f"Training completed for job: {job.job_id}, "
                f"accuracy: {accuracy:.4f}"
            )

        except Exception as e:
            job.status = TrainingStatus.FAILED
            job.error_message = str(e)
            job.end_time = time.time()
            logger.error(f"Training failed for job: {job.job_id}: {e}")

    def _create_model(
        self,
        model_type: str,
        algorithm: str,
        hyperparameters: Dict[str, str]
    ):
        """Create sklearn model based on algorithm"""

        if model_type.lower() == "sklearn":
            if algorithm == "random_forest":
                return RandomForestClassifier(
                    n_estimators=int(hyperparameters.get('n_estimators', 100)),
                    max_depth=int(hyperparameters.get('max_depth', 10)),
                    random_state=42
                )
            elif algorithm == "gradient_boosting":
                return GradientBoostingClassifier(
                    n_estimators=int(hyperparameters.get('n_estimators', 100)),
                    learning_rate=float(hyperparameters.get('learning_rate', 0.1)),
                    max_depth=int(hyperparameters.get('max_depth', 3)),
                    random_state=42
                )
            elif algorithm == "neural_network":
                hidden_layers = eval(hyperparameters.get('hidden_layers', '(100,)'))
                return MLPClassifier(
                    hidden_layer_sizes=hidden_layers,
                    learning_rate_init=float(hyperparameters.get('learning_rate', 0.001)),
                    max_iter=int(hyperparameters.get('max_iter', 200)),
                    random_state=42
                )
            else:
                raise ValueError(f"Unknown algorithm: {algorithm}")
        else:
            raise ValueError(f"Model type {model_type} not supported yet")

    def get_job_status(self, job_id: str) -> Optional[TrainingJob]:
        """Get status of a training job"""
        return self.jobs.get(job_id)

    def cancel_training(self, job_id: str) -> bool:
        """Cancel a training job"""
        job = self.jobs.get(job_id)
        if job and job.status in [TrainingStatus.PENDING, TrainingStatus.RUNNING]:
            job.status = TrainingStatus.CANCELLED
            job.end_time = time.time()
            logger.info(f"Cancelled training job: {job_id}")
            return True
        return False

    def retrain_model(
        self,
        model_id: str,
        new_data: List[Dict[str, Any]],
        incremental: bool,
        hyperparameters: Dict[str, str]
    ) -> TrainingJob:
        """Retrain existing model with new data"""

        # Load existing model
        model_path = os.path.join(self.models_dir, f"{model_id}.pkl")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model {model_id} not found")

        import joblib
        old_model = joblib.load(model_path)

        # Create new training job
        job_id = str(uuid.uuid4())[:8]
        job = TrainingJob(
            job_id=job_id,
            model_id=f"{model_id}_retrained",
            model_type="sklearn",
            algorithm=type(old_model).__name__,
            status=TrainingStatus.PENDING,
            start_time=time.time()
        )

        self.jobs[job_id] = job

        # If incremental, use warm_start or similar
        # For now, just retrain from scratch with new + old data
        # In production, implement proper incremental learning

        logger.info(f"Created retraining job: {job_id} for model: {model_id}")

        return job

    def list_jobs(self, limit: int = 100) -> List[TrainingJob]:
        """List recent training jobs"""
        jobs = sorted(
            self.jobs.values(),
            key=lambda j: j.start_time,
            reverse=True
        )
        return jobs[:limit]

    def get_model_comparison(
        self,
        old_model_id: str,
        new_model_id: str,
        test_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compare performance of two models"""

        import joblib

        # Load models
        old_model = joblib.load(
            os.path.join(self.models_dir, f"{old_model_id}.pkl")
        )
        new_model = joblib.load(
            os.path.join(self.models_dir, f"{new_model_id}.pkl")
        )

        # Extract test data
        X_test = np.array([sample['features'] for sample in test_data])
        y_test = np.array([
            sample.get('numeric_label') or sample.get('categorical_label')
            for sample in test_data
        ])

        # Evaluate both models
        old_pred = old_model.predict(X_test)
        new_pred = new_model.predict(X_test)

        old_accuracy = accuracy_score(y_test, old_pred)
        new_accuracy = accuracy_score(y_test, new_pred)

        improvement = ((new_accuracy - old_accuracy) / old_accuracy) * 100

        return {
            'old_accuracy': float(old_accuracy),
            'new_accuracy': float(new_accuracy),
            'improvement_pct': float(improvement),
            'old_model_id': old_model_id,
            'new_model_id': new_model_id,
            'test_samples': len(X_test)
        }


# Singleton instance
_orchestrator = None


def get_orchestrator() -> TrainingOrchestrator:
    """Get training orchestrator singleton"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = TrainingOrchestrator()
    return _orchestrator
