"""
ML Framework Gating Middleware
Restricts ML framework access and features based on subscription tiers.
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Callable
from dataclasses import dataclass
from enum import Enum
import functools
import inspect
from fastapi import HTTPException, status
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Float, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis

logger = logging.getLogger(__name__)

Base = declarative_base()

class MLPlan(str, Enum):
    """ML subscription plans"""
    DEVELOPER = "developer"
    GROWTH = "growth"
    SCALE = "scale"

class MLFramework(str, Enum):
    """Supported ML frameworks"""
    SKLEARN = "sklearn"
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    ONNX = "onnx"
    HUGGINGFACE = "huggingface"
    MLFLOW = "mlflow"

class MLOperation(str, Enum):
    """ML operations that can be restricted"""
    TRAINING = "training"
    INFERENCE = "inference"
    EXPORT = "export"
    HYPERPARAMETER_TUNING = "hyperparameter_tuning"
    DISTRIBUTED_TRAINING = "distributed_training"
    MODEL_SERVING = "model_serving"
    PIPELINE_AUTOMATION = "pipeline_automation"
    CUSTOM_PREPROCESSING = "custom_preprocessing"

class MLUsageRecord(Base):
    """Track ML framework usage per customer"""
    __tablename__ = "ml_usage_records"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    framework = Column(String, nullable=False)
    operation = Column(String, nullable=False)
    plan_tier = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    model_size_mb = Column(Float, default=0.0)
    training_time_seconds = Column(Float, default=0.0)
    compute_units_used = Column(Float, default=0.0)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    metadata = Column(JSON)

class MLQuotaUsage(Base):
    """Track daily ML quotas per customer"""
    __tablename__ = "ml_quota_usage"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    plan_tier = Column(String, nullable=False)
    total_training_jobs = Column(Integer, default=0)
    total_inference_requests = Column(Integer, default=0)
    total_compute_minutes = Column(Float, default=0.0)
    total_model_exports = Column(Integer, default=0)
    frameworks_used = Column(JSON, default=list)

@dataclass
class MLFrameworkLimits:
    """ML framework limits per plan"""
    allowed_frameworks: Set[str]
    allowed_operations: Set[str]
    max_training_jobs_per_day: int
    max_inference_requests_per_hour: int
    max_model_size_mb: float
    max_training_time_minutes: int
    max_compute_minutes_per_day: int
    max_concurrent_jobs: int
    supports_distributed_training: bool
    supports_hyperparameter_tuning: bool
    supports_custom_preprocessing: bool
    supports_model_serving: bool

class MLFrameworkEnforcement:
    """
    ML Framework Gating and Enforcement System

    Features:
    - Framework access control per plan
    - Operation restrictions (training, inference, export)
    - Resource quotas and limits
    - Usage tracking and analytics
    - Performance monitoring
    """

    def __init__(self, database_url: str, redis_url: str):
        self.db_engine = create_engine(database_url)
        Base.metadata.create_all(self.db_engine)
        self.SessionLocal = sessionmaker(bind=self.db_engine)

        # Redis for rate limiting and caching
        self.redis = redis.from_url(redis_url)

        # Plan-based ML framework limits
        self.plan_limits = {
            MLPlan.DEVELOPER: MLFrameworkLimits(
                allowed_frameworks={MLFramework.SKLEARN.value},
                allowed_operations={
                    MLOperation.TRAINING.value,
                    MLOperation.INFERENCE.value,
                    MLOperation.EXPORT.value
                },
                max_training_jobs_per_day=5,
                max_inference_requests_per_hour=100,
                max_model_size_mb=50.0,
                max_training_time_minutes=30,
                max_compute_minutes_per_day=60,
                max_concurrent_jobs=1,
                supports_distributed_training=False,
                supports_hyperparameter_tuning=False,
                supports_custom_preprocessing=True,
                supports_model_serving=False
            ),
            MLPlan.GROWTH: MLFrameworkLimits(
                allowed_frameworks={
                    MLFramework.SKLEARN.value,
                    MLFramework.TENSORFLOW.value,
                    MLFramework.PYTORCH.value,
                    MLFramework.XGBOOST.value
                },
                allowed_operations={
                    MLOperation.TRAINING.value,
                    MLOperation.INFERENCE.value,
                    MLOperation.EXPORT.value,
                    MLOperation.HYPERPARAMETER_TUNING.value,
                    MLOperation.CUSTOM_PREPROCESSING.value
                },
                max_training_jobs_per_day=50,
                max_inference_requests_per_hour=1000,
                max_model_size_mb=500.0,
                max_training_time_minutes=180,
                max_compute_minutes_per_day=720,
                max_concurrent_jobs=3,
                supports_distributed_training=False,
                supports_hyperparameter_tuning=True,
                supports_custom_preprocessing=True,
                supports_model_serving=True
            ),
            MLPlan.SCALE: MLFrameworkLimits(
                allowed_frameworks={
                    MLFramework.SKLEARN.value,
                    MLFramework.TENSORFLOW.value,
                    MLFramework.PYTORCH.value,
                    MLFramework.XGBOOST.value,
                    MLFramework.LIGHTGBM.value,
                    MLFramework.ONNX.value,
                    MLFramework.HUGGINGFACE.value,
                    MLFramework.MLFLOW.value
                },
                allowed_operations={
                    operation.value for operation in MLOperation
                },
                max_training_jobs_per_day=500,
                max_inference_requests_per_hour=10000,
                max_model_size_mb=5000.0,
                max_training_time_minutes=720,  # 12 hours
                max_compute_minutes_per_day=2880,  # 48 hours
                max_concurrent_jobs=10,
                supports_distributed_training=True,
                supports_hyperparameter_tuning=True,
                supports_custom_preprocessing=True,
                supports_model_serving=True
            )
        }

        # Framework import wrappers
        self.framework_wrappers = {}
        self._setup_framework_wrappers()

    def _setup_framework_wrappers(self):
        """Setup framework import wrappers for enforcement"""
        # This will be populated dynamically
        pass

    async def check_framework_access(
        self,
        customer_id: str,
        plan_tier: str,
        framework: str
    ) -> bool:
        """Check if customer can access a specific ML framework"""
        plan = MLPlan(plan_tier)
        limits = self.plan_limits[plan]

        if framework not in limits.allowed_frameworks:
            logger.warning(f"Framework {framework} not allowed for plan {plan_tier}")
            return False

        return True

    async def check_operation_access(
        self,
        customer_id: str,
        plan_tier: str,
        operation: str
    ) -> bool:
        """Check if customer can perform a specific ML operation"""
        plan = MLPlan(plan_tier)
        limits = self.plan_limits[plan]

        if operation not in limits.allowed_operations:
            logger.warning(f"Operation {operation} not allowed for plan {plan_tier}")
            return False

        return True

    async def check_resource_quota(
        self,
        customer_id: str,
        plan_tier: str,
        operation: str,
        **kwargs
    ) -> bool:
        """Check if operation is within resource quotas"""
        plan = MLPlan(plan_tier)
        limits = self.plan_limits[plan]

        # Get today's usage
        today = datetime.utcnow().date()
        with self.SessionLocal() as session:
            usage = session.query(MLQuotaUsage).filter(
                MLQuotaUsage.customer_id == customer_id,
                MLQuotaUsage.date >= today,
                MLQuotaUsage.date < today + timedelta(days=1)
            ).first()

            if not usage:
                return True  # No usage yet today

            # Check specific quotas based on operation
            if operation == MLOperation.TRAINING.value:
                if usage.total_training_jobs >= limits.max_training_jobs_per_day:
                    logger.warning(f"Training quota exceeded for customer {customer_id}")
                    return False

            elif operation == MLOperation.INFERENCE.value:
                # Check hourly inference limit
                hourly_key = f"inference_hourly:{customer_id}:{datetime.utcnow().strftime('%Y-%m-%d:%H')}"
                hourly_count = await self.redis.get(hourly_key)
                hourly_count = int(hourly_count) if hourly_count else 0

                if hourly_count >= limits.max_inference_requests_per_hour:
                    logger.warning(f"Inference rate limit exceeded for customer {customer_id}")
                    return False

            # Check compute minutes
            if usage.total_compute_minutes >= limits.max_compute_minutes_per_day:
                logger.warning(f"Compute quota exceeded for customer {customer_id}")
                return False

            # Check concurrent jobs
            active_jobs = await self._get_active_jobs_count(customer_id)
            if active_jobs >= limits.max_concurrent_jobs:
                logger.warning(f"Concurrent jobs limit exceeded for customer {customer_id}")
                return False

            # Check model size limit
            model_size_mb = kwargs.get('model_size_mb', 0)
            if model_size_mb > limits.max_model_size_mb:
                logger.warning(f"Model size limit exceeded for customer {customer_id}")
                return False

        return True

    async def record_ml_usage(
        self,
        customer_id: str,
        plan_tier: str,
        framework: str,
        operation: str,
        success: bool = True,
        **kwargs
    ):
        """Record ML framework usage"""
        usage_id = f"{customer_id}_{int(datetime.utcnow().timestamp() * 1000)}"

        # Record detailed usage
        usage_record = MLUsageRecord(
            id=usage_id,
            customer_id=customer_id,
            framework=framework,
            operation=operation,
            plan_tier=plan_tier,
            model_size_mb=kwargs.get('model_size_mb', 0.0),
            training_time_seconds=kwargs.get('training_time_seconds', 0.0),
            compute_units_used=kwargs.get('compute_units_used', 0.0),
            success=success,
            error_message=kwargs.get('error_message'),
            metadata=kwargs.get('metadata', {})
        )

        with self.SessionLocal() as session:
            session.add(usage_record)
            session.commit()

        # Update daily quotas
        await self._update_daily_quotas(customer_id, plan_tier, operation, **kwargs)

        # Update rate limits for inference
        if operation == MLOperation.INFERENCE.value:
            hourly_key = f"inference_hourly:{customer_id}:{datetime.utcnow().strftime('%Y-%m-%d:%H')}"
            await self.redis.incr(hourly_key)
            await self.redis.expire(hourly_key, 3600)

    async def _update_daily_quotas(
        self,
        customer_id: str,
        plan_tier: str,
        operation: str,
        **kwargs
    ):
        """Update daily quota usage"""
        today = datetime.utcnow().date()

        with self.SessionLocal() as session:
            usage = session.query(MLQuotaUsage).filter(
                MLQuotaUsage.customer_id == customer_id,
                MLQuotaUsage.date >= today,
                MLQuotaUsage.date < today + timedelta(days=1)
            ).first()

            if not usage:
                usage = MLQuotaUsage(
                    id=f"{customer_id}_{today.isoformat()}",
                    customer_id=customer_id,
                    date=datetime.combine(today, datetime.min.time()),
                    plan_tier=plan_tier,
                    frameworks_used=[]
                )
                session.add(usage)

            # Update operation counts
            if operation == MLOperation.TRAINING.value:
                usage.total_training_jobs += 1
            elif operation == MLOperation.INFERENCE.value:
                usage.total_inference_requests += 1

            # Update compute minutes
            compute_minutes = kwargs.get('training_time_seconds', 0) / 60.0
            usage.total_compute_minutes += compute_minutes

            # Update model exports
            if operation == MLOperation.EXPORT.value:
                usage.total_model_exports += 1

            # Track frameworks used
            framework = kwargs.get('framework')
            if framework and framework not in usage.frameworks_used:
                usage.frameworks_used = usage.frameworks_used + [framework]

            session.commit()

    async def _get_active_jobs_count(self, customer_id: str) -> int:
        """Get count of currently active ML jobs"""
        # Check Redis for active job tracking
        active_jobs_key = f"active_ml_jobs:{customer_id}"
        active_count = await self.redis.scard(active_jobs_key)
        return active_count

    async def start_ml_job(self, customer_id: str, job_id: str):
        """Track start of ML job"""
        active_jobs_key = f"active_ml_jobs:{customer_id}"
        await self.redis.sadd(active_jobs_key, job_id)
        await self.redis.expire(active_jobs_key, 86400)  # 24 hours

    async def finish_ml_job(self, customer_id: str, job_id: str):
        """Track completion of ML job"""
        active_jobs_key = f"active_ml_jobs:{customer_id}"
        await self.redis.srem(active_jobs_key, job_id)

    def enforce_framework_access(self, customer_id: str, plan_tier: str):
        """Decorator to enforce framework access for ML operations"""
        def decorator(func: Callable):
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract framework from function metadata or kwargs
                framework = kwargs.get('framework')
                if not framework:
                    # Try to infer from function name or module
                    if 'tensorflow' in func.__module__ or 'tf' in func.__name__.lower():
                        framework = MLFramework.TENSORFLOW.value
                    elif 'torch' in func.__module__ or 'pytorch' in func.__name__.lower():
                        framework = MLFramework.PYTORCH.value
                    elif 'sklearn' in func.__module__:
                        framework = MLFramework.SKLEARN.value
                    else:
                        framework = MLFramework.SKLEARN.value  # Default

                # Check framework access
                if not await self.check_framework_access(customer_id, plan_tier, framework):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Framework {framework} not available in {plan_tier} plan"
                    )

                # Extract operation type
                operation = kwargs.get('operation', MLOperation.TRAINING.value)

                # Check operation access
                if not await self.check_operation_access(customer_id, plan_tier, operation):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Operation {operation} not available in {plan_tier} plan"
                    )

                # Check resource quotas
                if not await self.check_resource_quota(customer_id, plan_tier, operation, **kwargs):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Resource quota exceeded for this operation"
                    )

                # Generate job ID for tracking
                job_id = f"{customer_id}_{int(datetime.utcnow().timestamp() * 1000)}"
                await self.start_ml_job(customer_id, job_id)

                try:
                    # Execute the function
                    start_time = datetime.utcnow()
                    result = await func(*args, **kwargs) if inspect.iscoroutinefunction(func) else func(*args, **kwargs)
                    end_time = datetime.utcnow()

                    # Record successful usage
                    await self.record_ml_usage(
                        customer_id=customer_id,
                        plan_tier=plan_tier,
                        framework=framework,
                        operation=operation,
                        success=True,
                        training_time_seconds=(end_time - start_time).total_seconds(),
                        **kwargs
                    )

                    return result

                except Exception as e:
                    # Record failed usage
                    await self.record_ml_usage(
                        customer_id=customer_id,
                        plan_tier=plan_tier,
                        framework=framework,
                        operation=operation,
                        success=False,
                        error_message=str(e),
                        **kwargs
                    )
                    raise

                finally:
                    # Clean up job tracking
                    await self.finish_ml_job(customer_id, job_id)

            return wrapper
        return decorator

    async def get_customer_ml_status(self, customer_id: str, plan_tier: str) -> Dict[str, Any]:
        """Get comprehensive ML status for a customer"""
        plan = MLPlan(plan_tier)
        limits = self.plan_limits[plan]

        # Get today's usage
        today = datetime.utcnow().date()
        with self.SessionLocal() as session:
            usage = session.query(MLQuotaUsage).filter(
                MLQuotaUsage.customer_id == customer_id,
                MLQuotaUsage.date >= today
            ).first()

            # Get recent usage records
            recent_usage = session.query(MLUsageRecord).filter(
                MLUsageRecord.customer_id == customer_id,
                MLUsageRecord.timestamp >= datetime.utcnow() - timedelta(days=7)
            ).order_by(MLUsageRecord.timestamp.desc()).limit(100).all()

        # Get active jobs count
        active_jobs = await self._get_active_jobs_count(customer_id)

        # Get hourly inference count
        hourly_key = f"inference_hourly:{customer_id}:{datetime.utcnow().strftime('%Y-%m-%d:%H')}"
        hourly_inference = await self.redis.get(hourly_key)
        hourly_inference = int(hourly_inference) if hourly_inference else 0

        return {
            'customer_id': customer_id,
            'plan_tier': plan_tier,
            'active_jobs': active_jobs,
            'allowed_frameworks': list(limits.allowed_frameworks),
            'allowed_operations': list(limits.allowed_operations),
            'daily_usage': {
                'training_jobs': usage.total_training_jobs if usage else 0,
                'inference_requests': usage.total_inference_requests if usage else 0,
                'compute_minutes': usage.total_compute_minutes if usage else 0.0,
                'model_exports': usage.total_model_exports if usage else 0,
                'frameworks_used': usage.frameworks_used if usage else []
            } if usage else None,
            'current_limits': {
                'max_training_jobs_per_day': limits.max_training_jobs_per_day,
                'max_inference_requests_per_hour': limits.max_inference_requests_per_hour,
                'max_model_size_mb': limits.max_model_size_mb,
                'max_training_time_minutes': limits.max_training_time_minutes,
                'max_compute_minutes_per_day': limits.max_compute_minutes_per_day,
                'max_concurrent_jobs': limits.max_concurrent_jobs,
                'current_hourly_inference': hourly_inference
            },
            'feature_access': {
                'distributed_training': limits.supports_distributed_training,
                'hyperparameter_tuning': limits.supports_hyperparameter_tuning,
                'custom_preprocessing': limits.supports_custom_preprocessing,
                'model_serving': limits.supports_model_serving
            },
            'recent_activity': [
                {
                    'timestamp': record.timestamp.isoformat(),
                    'framework': record.framework,
                    'operation': record.operation,
                    'success': record.success,
                    'training_time_seconds': record.training_time_seconds,
                    'model_size_mb': record.model_size_mb
                }
                for record in recent_usage[:10]  # Last 10 activities
            ]
        }