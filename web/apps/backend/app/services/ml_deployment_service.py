"""
ML Model Deployment Management Service

This service handles model deployment, rollback, and deployment strategy management
including blue-green, canary, and A/B testing deployments.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from uuid import UUID, uuid4
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import and_, or_, desc, asc, func, update
from sqlalchemy.exc import SQLAlchemyError

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'api'))

from app.database.connection import AsyncSessionLocal
from app.database.ml_lifecycle_models import (
    ModelRegistry, ModelVersion, ModelDeployment, ModelPerformanceMetric,
    ModelPerformanceLog, ModelAlert, ModelAuditLog,
    ModelStatus, DeploymentStrategy, AlertSeverity
)
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class ModelDeploymentService:
    """Service for managing ML model deployments"""

    def __init__(self):
        self.active_deployments = {}  # In-memory cache of active deployments

    async def deploy_model(
        self,
        model_id: UUID,
        version_id: UUID,
        deployment_name: str,
        environment: str,
        deployed_by: UUID,
        strategy: DeploymentStrategy = DeploymentStrategy.ROLLING,
        strategy_config: Optional[Dict[str, Any]] = None,
        traffic_percentage: float = 100.0,
        target_instances: int = 1,
        endpoint_url: Optional[str] = None,
        health_check_url: Optional[str] = None,
        performance_thresholds: Optional[Dict[str, Any]] = None,
        auto_rollback_enabled: bool = True
    ) -> ModelDeployment:
        """Deploy a model version to specified environment"""

        async with AsyncSessionLocal() as session:
            try:
                # Verify model and version exist
                version = await session.execute(
                    select(ModelVersion)
                    .options(joinedload(ModelVersion.model))
                    .where(ModelVersion.id == version_id)
                )
                version = version.scalar_one_or_none()
                if not version:
                    raise ValueError(f"Version {version_id} not found")

                if version.model_id != model_id:
                    raise ValueError(f"Version {version_id} does not belong to model {model_id}")

                # Check for existing active deployment with same name in same environment
                existing_deployment = await session.execute(
                    select(ModelDeployment).where(
                        and_(
                            ModelDeployment.deployment_name == deployment_name,
                            ModelDeployment.environment == environment,
                            ModelDeployment.is_active == True
                        )
                    )
                )
                if existing_deployment.scalar_one_or_none():
                    raise ValueError(f"Active deployment '{deployment_name}' already exists in {environment}")

                # Create deployment record
                deployment = ModelDeployment(
                    model_id=model_id,
                    version_id=version_id,
                    deployment_name=deployment_name,
                    environment=environment,
                    endpoint_url=endpoint_url,
                    strategy=strategy,
                    strategy_config=strategy_config or {},
                    traffic_percentage=traffic_percentage,
                    target_instances=target_instances,
                    current_instances=0,
                    is_active=True,
                    health_check_url=health_check_url,
                    performance_thresholds=performance_thresholds or self._get_default_thresholds(),
                    auto_rollback_enabled=auto_rollback_enabled,
                    deployed_by=deployed_by,
                    deployment_config={
                        "deployment_strategy": strategy.value,
                        "environment": environment,
                        "auto_rollback": auto_rollback_enabled,
                        "created_at": datetime.utcnow().isoformat()
                    }
                )

                session.add(deployment)
                await session.commit()
                await session.refresh(deployment)

                # Execute deployment strategy
                await self._execute_deployment_strategy(deployment, session)

                # Create audit log entry
                await self._create_audit_log(
                    session, model_id, version_id, deployment.id, "model_deployed",
                    f"Deployed model to {environment} with {strategy.value} strategy",
                    deployed_by, {
                        "deployment_name": deployment_name,
                        "environment": environment,
                        "strategy": strategy.value,
                        "traffic_percentage": traffic_percentage
                    }
                )

                # Cache active deployment
                self.active_deployments[deployment.id] = deployment

                logger.info(f"Deployed model {model_id} version {version_id} to {environment}")
                return deployment

            except Exception as e:
                await session.rollback()
                logger.error(f"Error deploying model {model_id}: {str(e)}")
                raise

    async def rollback_deployment(
        self,
        deployment_id: UUID,
        user_id: UUID,
        rollback_version_id: Optional[UUID] = None,
        reason: Optional[str] = None
    ) -> ModelDeployment:
        """Rollback a deployment to previous version or specified version"""

        async with AsyncSessionLocal() as session:
            try:
                deployment = await session.get(ModelDeployment, deployment_id)
                if not deployment or not deployment.is_active:
                    raise ValueError(f"Active deployment {deployment_id} not found")

                # Determine rollback version
                if rollback_version_id:
                    rollback_version = await session.get(ModelVersion, rollback_version_id)
                    if not rollback_version:
                        raise ValueError(f"Rollback version {rollback_version_id} not found")
                else:
                    # Find previous version
                    rollback_version = await self._get_previous_version(
                        session, deployment.model_id, deployment.version_id
                    )
                    if not rollback_version:
                        raise ValueError("No previous version found for rollback")

                # Store current version as rollback reference
                original_version_id = deployment.version_id
                deployment.rollback_version_id = original_version_id

                # Update deployment to new version
                deployment.version_id = rollback_version.id
                deployment.last_updated = datetime.utcnow()

                # Execute rollback strategy
                await self._execute_rollback_strategy(deployment, session)

                await session.commit()

                # Create audit log entry
                await self._create_audit_log(
                    session, deployment.model_id, rollback_version.id, deployment_id,
                    "deployment_rollback",
                    f"Rolled back deployment from version {original_version_id} to {rollback_version.id}",
                    user_id, {
                        "original_version": str(original_version_id),
                        "rollback_version": str(rollback_version.id),
                        "reason": reason or "Manual rollback"
                    }
                )

                # Update cached deployment
                self.active_deployments[deployment.id] = deployment

                logger.info(f"Rolled back deployment {deployment_id} to version {rollback_version.id}")
                return deployment

            except Exception as e:
                await session.rollback()
                logger.error(f"Error rolling back deployment {deployment_id}: {str(e)}")
                raise

    async def update_traffic_split(
        self,
        deployment_id: UUID,
        new_traffic_percentage: float,
        user_id: UUID
    ) -> ModelDeployment:
        """Update traffic percentage for canary or A/B test deployments"""

        async with AsyncSessionLocal() as session:
            try:
                deployment = await session.get(ModelDeployment, deployment_id)
                if not deployment or not deployment.is_active:
                    raise ValueError(f"Active deployment {deployment_id} not found")

                if not (0 <= new_traffic_percentage <= 100):
                    raise ValueError("Traffic percentage must be between 0 and 100")

                old_percentage = deployment.traffic_percentage
                deployment.traffic_percentage = new_traffic_percentage
                deployment.last_updated = datetime.utcnow()

                await session.commit()

                # Create audit log entry
                await self._create_audit_log(
                    session, deployment.model_id, deployment.version_id, deployment_id,
                    "traffic_updated",
                    f"Updated traffic percentage from {old_percentage}% to {new_traffic_percentage}%",
                    user_id, {
                        "old_percentage": old_percentage,
                        "new_percentage": new_traffic_percentage
                    }
                )

                # Update cached deployment
                self.active_deployments[deployment.id] = deployment

                logger.info(f"Updated traffic for deployment {deployment_id} to {new_traffic_percentage}%")
                return deployment

            except Exception as e:
                await session.rollback()
                logger.error(f"Error updating traffic for deployment {deployment_id}: {str(e)}")
                raise

    async def stop_deployment(
        self,
        deployment_id: UUID,
        user_id: UUID,
        reason: Optional[str] = None
    ) -> bool:
        """Stop an active deployment"""

        async with AsyncSessionLocal() as session:
            try:
                deployment = await session.get(ModelDeployment, deployment_id)
                if not deployment:
                    raise ValueError(f"Deployment {deployment_id} not found")

                deployment.is_active = False
                deployment.stopped_at = datetime.utcnow()
                deployment.current_instances = 0

                await session.commit()

                # Create audit log entry
                await self._create_audit_log(
                    session, deployment.model_id, deployment.version_id, deployment_id,
                    "deployment_stopped",
                    f"Stopped deployment: {reason or 'Manual stop'}",
                    user_id, {"reason": reason or "Manual stop"}
                )

                # Remove from cache
                self.active_deployments.pop(deployment_id, None)

                logger.info(f"Stopped deployment {deployment_id}")
                return True

            except Exception as e:
                await session.rollback()
                logger.error(f"Error stopping deployment {deployment_id}: {str(e)}")
                raise

    async def get_deployment(self, deployment_id: UUID) -> Optional[ModelDeployment]:
        """Get deployment by ID with relationships"""

        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(
                    select(ModelDeployment)
                    .options(
                        joinedload(ModelDeployment.model),
                        joinedload(ModelDeployment.version),
                        selectinload(ModelDeployment.performance_logs)
                    )
                    .where(ModelDeployment.id == deployment_id)
                )
                return result.scalar_one_or_none()

            except Exception as e:
                logger.error(f"Error getting deployment {deployment_id}: {str(e)}")
                raise

    async def list_deployments(
        self,
        model_id: Optional[UUID] = None,
        environment: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[ModelDeployment], int]:
        """List deployments with filtering"""

        async with AsyncSessionLocal() as session:
            try:
                query = select(ModelDeployment)
                count_query = select(func.count(ModelDeployment.id))

                # Apply filters
                filters = []
                if model_id:
                    filters.append(ModelDeployment.model_id == model_id)
                if environment:
                    filters.append(ModelDeployment.environment == environment)
                if is_active is not None:
                    filters.append(ModelDeployment.is_active == is_active)

                if filters:
                    query = query.where(and_(*filters))
                    count_query = count_query.where(and_(*filters))

                # Apply pagination
                query = query.order_by(desc(ModelDeployment.deployed_at)).offset(offset).limit(limit)

                # Execute queries
                result = await session.execute(query)
                count_result = await session.execute(count_query)

                deployments = result.scalars().all()
                total_count = count_result.scalar()

                return deployments, total_count

            except Exception as e:
                logger.error(f"Error listing deployments: {str(e)}")
                raise

    async def health_check_deployment(self, deployment_id: UUID) -> Dict[str, Any]:
        """Perform health check on deployment"""

        try:
            deployment = await self.get_deployment(deployment_id)
            if not deployment:
                return {"status": "error", "message": "Deployment not found"}

            # Update health check timestamp
            async with AsyncSessionLocal() as session:
                deployment.last_health_check = datetime.utcnow()
                session.add(deployment)
                await session.commit()

            # Perform actual health check (simplified)
            health_status = await self._perform_health_check(deployment)

            # Update health status
            async with AsyncSessionLocal() as session:
                dep = await session.get(ModelDeployment, deployment_id)
                dep.health_status = health_status["status"]
                await session.commit()

            return health_status

        except Exception as e:
            logger.error(f"Error performing health check for deployment {deployment_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    async def check_performance_thresholds(self, deployment_id: UUID) -> Optional[ModelAlert]:
        """Check if deployment performance is within acceptable thresholds"""

        try:
            deployment = await self.get_deployment(deployment_id)
            if not deployment or not deployment.performance_thresholds:
                return None

            # Get recent performance metrics
            async with AsyncSessionLocal() as session:
                recent_logs = await session.execute(
                    select(ModelPerformanceLog)
                    .where(
                        and_(
                            ModelPerformanceLog.deployment_id == deployment_id,
                            ModelPerformanceLog.measured_at >= datetime.utcnow() - timedelta(hours=1)
                        )
                    )
                    .order_by(desc(ModelPerformanceLog.measured_at))
                    .limit(10)
                )
                performance_logs = recent_logs.scalars().all()

                if not performance_logs:
                    return None

                # Check thresholds
                alert = await self._check_thresholds(deployment, performance_logs, session)
                return alert

        except Exception as e:
            logger.error(f"Error checking performance thresholds for deployment {deployment_id}: {str(e)}")
            return None

    async def _execute_deployment_strategy(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute the specified deployment strategy"""

        try:
            if deployment.strategy == DeploymentStrategy.BLUE_GREEN:
                await self._execute_blue_green_deployment(deployment, session)
            elif deployment.strategy == DeploymentStrategy.CANARY:
                await self._execute_canary_deployment(deployment, session)
            elif deployment.strategy == DeploymentStrategy.ROLLING:
                await self._execute_rolling_deployment(deployment, session)
            elif deployment.strategy == DeploymentStrategy.SHADOW:
                await self._execute_shadow_deployment(deployment, session)
            elif deployment.strategy == DeploymentStrategy.A_B_TEST:
                await self._execute_ab_test_deployment(deployment, session)

            # Update instance count
            deployment.current_instances = deployment.target_instances

        except Exception as e:
            logger.error(f"Error executing deployment strategy {deployment.strategy}: {str(e)}")
            raise

    async def _execute_blue_green_deployment(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute blue-green deployment strategy"""

        logger.info(f"Executing blue-green deployment for {deployment.id}")

        # In a real implementation, this would:
        # 1. Create green environment
        # 2. Deploy new version to green
        # 3. Test green environment
        # 4. Switch traffic from blue to green
        # 5. Keep blue as backup for quick rollback

        # Simulate deployment steps
        steps = [
            "Creating green environment",
            "Deploying to green environment",
            "Running health checks",
            "Switching traffic to green",
            "Blue environment standby"
        ]

        for i, step in enumerate(steps):
            logger.info(f"Blue-green deployment step {i+1}/5: {step}")
            await asyncio.sleep(0.1)  # Simulate deployment time

    async def _execute_canary_deployment(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute canary deployment strategy"""

        logger.info(f"Executing canary deployment for {deployment.id}")

        # Canary deployment starts with small traffic percentage
        if deployment.traffic_percentage > 10:
            deployment.traffic_percentage = 10

        # In a real implementation, this would:
        # 1. Deploy to small subset of instances
        # 2. Route small percentage of traffic
        # 3. Monitor performance metrics
        # 4. Gradually increase traffic if metrics are good
        # 5. Full deployment if successful

    async def _execute_rolling_deployment(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute rolling deployment strategy"""

        logger.info(f"Executing rolling deployment for {deployment.id}")

        # Rolling deployment updates instances one by one
        # Simulate updating instances
        for i in range(deployment.target_instances):
            logger.info(f"Updating instance {i+1}/{deployment.target_instances}")
            await asyncio.sleep(0.1)

    async def _execute_shadow_deployment(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute shadow deployment strategy"""

        logger.info(f"Executing shadow deployment for {deployment.id}")

        # Shadow deployment mirrors traffic without affecting responses
        deployment.traffic_percentage = 0  # No actual traffic impact

    async def _execute_ab_test_deployment(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute A/B test deployment strategy"""

        logger.info(f"Executing A/B test deployment for {deployment.id}")

        # A/B test splits traffic between versions
        if deployment.traffic_percentage > 50:
            deployment.traffic_percentage = 50

    async def _execute_rollback_strategy(
        self,
        deployment: ModelDeployment,
        session: AsyncSession
    ):
        """Execute rollback strategy based on deployment type"""

        try:
            if deployment.strategy == DeploymentStrategy.BLUE_GREEN:
                # Switch back to blue environment
                logger.info("Rolling back blue-green deployment - switching to blue")
            elif deployment.strategy == DeploymentStrategy.CANARY:
                # Stop canary and route all traffic to stable version
                deployment.traffic_percentage = 0
                logger.info("Rolling back canary deployment - routing traffic to stable")
            else:
                # Standard rollback for other strategies
                logger.info(f"Rolling back {deployment.strategy.value} deployment")

        except Exception as e:
            logger.error(f"Error executing rollback strategy: {str(e)}")
            raise

    async def _get_previous_version(
        self,
        session: AsyncSession,
        model_id: UUID,
        current_version_id: UUID
    ) -> Optional[ModelVersion]:
        """Get the previous version for rollback"""

        try:
            result = await session.execute(
                select(ModelVersion)
                .where(
                    and_(
                        ModelVersion.model_id == model_id,
                        ModelVersion.id != current_version_id,
                        ModelVersion.status.in_([ModelStatus.PRODUCTION, ModelStatus.STAGING])
                    )
                )
                .order_by(desc(ModelVersion.created_at))
                .limit(1)
            )
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"Error getting previous version: {str(e)}")
            return None

    async def _perform_health_check(self, deployment: ModelDeployment) -> Dict[str, Any]:
        """Perform health check on deployment endpoints"""

        try:
            # In a real implementation, this would make HTTP requests to health check URLs
            # For now, simulate health check

            if deployment.health_check_url:
                # Simulate HTTP health check
                await asyncio.sleep(0.1)
                return {
                    "status": "healthy",
                    "endpoint": deployment.health_check_url,
                    "response_time_ms": 50,
                    "instances_healthy": deployment.current_instances,
                    "instances_total": deployment.target_instances
                }
            else:
                return {
                    "status": "unknown",
                    "message": "No health check URL configured"
                }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    def _get_default_thresholds(self) -> Dict[str, Any]:
        """Get default performance thresholds"""

        return {
            "accuracy_threshold": 0.8,
            "response_time_ms": 1000,
            "error_rate_percent": 5.0,
            "memory_usage_mb": 1000,
            "cpu_usage_percent": 80.0
        }

    async def _check_thresholds(
        self,
        deployment: ModelDeployment,
        performance_logs: List[ModelPerformanceLog],
        session: AsyncSession
    ) -> Optional[ModelAlert]:
        """Check performance thresholds and create alerts if needed"""

        try:
            thresholds = deployment.performance_thresholds
            if not thresholds:
                return None

            # Calculate recent metrics
            avg_metric_value = sum(log.metric_value for log in performance_logs) / len(performance_logs)

            # Example threshold check (simplified)
            if "accuracy_threshold" in thresholds:
                if avg_metric_value < thresholds["accuracy_threshold"]:
                    # Create alert
                    alert = ModelAlert(
                        model_id=deployment.model_id,
                        deployment_id=deployment.id,
                        alert_type="performance_degradation",
                        severity=AlertSeverity.HIGH,
                        title="Model Performance Below Threshold",
                        description=f"Average accuracy {avg_metric_value:.3f} is below threshold {thresholds['accuracy_threshold']}",
                        trigger_value=avg_metric_value,
                        threshold_value=thresholds["accuracy_threshold"],
                        alert_data={
                            "metric_type": "accuracy",
                            "sample_size": len(performance_logs),
                            "time_window": "1 hour"
                        }
                    )

                    session.add(alert)
                    await session.commit()

                    # Trigger auto-rollback if enabled
                    if deployment.auto_rollback_enabled:
                        logger.warning(f"Auto-rollback triggered for deployment {deployment.id}")
                        # In a real implementation, this would trigger rollback process

                    return alert

            return None

        except Exception as e:
            logger.error(f"Error checking thresholds: {str(e)}")
            return None

    async def _create_audit_log(
        self,
        session: AsyncSession,
        model_id: Optional[UUID],
        version_id: Optional[UUID],
        deployment_id: Optional[UUID],
        action_type: str,
        description: str,
        user_id: UUID,
        action_data: Optional[Dict[str, Any]] = None
    ):
        """Create an audit log entry"""

        audit_log = ModelAuditLog(
            model_id=model_id,
            version_id=version_id,
            deployment_id=deployment_id,
            action_type=action_type,
            action_description=description,
            action_data=action_data,
            performed_by=user_id,
            action_result="success"
        )
        session.add(audit_log)