"""
ML Model Lifecycle Management Service

This service provides comprehensive model lifecycle management including
model registry, versioning, deployment management, and performance tracking.
"""

import os
import hashlib
import joblib
import json
import shutil
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from pathlib import Path
import asyncio
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import and_, or_, desc, asc, func
from sqlalchemy.exc import SQLAlchemyError

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'api'))

from app.database.connection import AsyncSessionLocal
from app.database.ml_lifecycle_models import (
    ModelRegistry, ModelVersion, ModelDeployment, ModelPerformanceMetric,
    ModelPerformanceLog, ModelLineage, ModelAlert, ModelAuditLog,
    ModelStatus, ModelType, DeploymentStrategy, PerformanceMetricType, AlertSeverity
)
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class ModelRegistryService:
    """Service for managing ML model registry operations"""

    def __init__(self, storage_base_path: str = "/tmp/ml_models"):
        self.storage_base_path = Path(storage_base_path)
        self.storage_base_path.mkdir(parents=True, exist_ok=True)

    async def create_model(
        self,
        name: str,
        description: Optional[str],
        model_type: ModelType,
        framework: Optional[str],
        algorithm: Optional[str],
        created_by: UUID,
        organization_id: Optional[UUID] = None,
        tags: Optional[Dict[str, Any]] = None,
        business_context: Optional[str] = None,
        use_case: Optional[str] = None
    ) -> ModelRegistry:
        """Create a new model in the registry"""

        async with AsyncSessionLocal() as session:
            try:
                # Check if model name already exists for this organization
                existing_model = await session.execute(
                    select(ModelRegistry).where(
                        and_(
                            ModelRegistry.name == name,
                            ModelRegistry.organization_id == organization_id,
                            ModelRegistry.is_active == True
                        )
                    )
                )
                if existing_model.scalar_one_or_none():
                    raise ValueError(f"Model with name '{name}' already exists in this organization")

                model = ModelRegistry(
                    name=name,
                    description=description,
                    model_type=model_type,
                    framework=framework,
                    algorithm=algorithm,
                    created_by=created_by,
                    organization_id=organization_id,
                    tags=tags or {},
                    business_context=business_context,
                    use_case=use_case,
                    current_status=ModelStatus.DEVELOPMENT
                )

                session.add(model)
                await session.commit()
                await session.refresh(model)

                # Create audit log entry
                await self._create_audit_log(
                    session, model.id, None, None, "model_created",
                    f"Created model '{name}'", created_by,
                    {"model_type": model_type.value, "framework": framework}
                )

                logger.info(f"Created model '{name}' with ID {model.id}")
                return model

            except Exception as e:
                await session.rollback()
                logger.error(f"Error creating model '{name}': {str(e)}")
                raise

    async def get_model(self, model_id: UUID) -> Optional[ModelRegistry]:
        """Get a model by ID with eager loading of relationships"""

        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(
                    select(ModelRegistry)
                    .options(
                        selectinload(ModelRegistry.versions),
                        selectinload(ModelRegistry.deployments),
                        selectinload(ModelRegistry.performance_metrics)
                    )
                    .where(ModelRegistry.id == model_id)
                )
                return result.scalar_one_or_none()

            except Exception as e:
                logger.error(f"Error getting model {model_id}: {str(e)}")
                raise

    async def list_models(
        self,
        organization_id: Optional[UUID] = None,
        model_type: Optional[ModelType] = None,
        status: Optional[ModelStatus] = None,
        created_by: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
        search_term: Optional[str] = None
    ) -> Tuple[List[ModelRegistry], int]:
        """List models with filtering and pagination"""

        async with AsyncSessionLocal() as session:
            try:
                # Build base query
                query = select(ModelRegistry).where(ModelRegistry.is_active == True)
                count_query = select(func.count(ModelRegistry.id)).where(ModelRegistry.is_active == True)

                # Apply filters
                filters = []
                if organization_id:
                    filters.append(ModelRegistry.organization_id == organization_id)
                if model_type:
                    filters.append(ModelRegistry.model_type == model_type)
                if status:
                    filters.append(ModelRegistry.current_status == status)
                if created_by:
                    filters.append(ModelRegistry.created_by == created_by)
                if search_term:
                    search_filter = or_(
                        ModelRegistry.name.ilike(f"%{search_term}%"),
                        ModelRegistry.description.ilike(f"%{search_term}%"),
                        ModelRegistry.algorithm.ilike(f"%{search_term}%")
                    )
                    filters.append(search_filter)

                if filters:
                    query = query.where(and_(*filters))
                    count_query = count_query.where(and_(*filters))

                # Apply pagination
                query = query.order_by(desc(ModelRegistry.updated_at)).offset(offset).limit(limit)

                # Execute queries
                result = await session.execute(query)
                count_result = await session.execute(count_query)

                models = result.scalars().all()
                total_count = count_result.scalar()

                return models, total_count

            except Exception as e:
                logger.error(f"Error listing models: {str(e)}")
                raise

    async def update_model(
        self,
        model_id: UUID,
        user_id: UUID,
        **updates
    ) -> ModelRegistry:
        """Update model metadata"""

        async with AsyncSessionLocal() as session:
            try:
                model = await session.get(ModelRegistry, model_id)
                if not model:
                    raise ValueError(f"Model {model_id} not found")

                # Track changes for audit log
                changes = {}
                for key, value in updates.items():
                    if hasattr(model, key) and getattr(model, key) != value:
                        changes[key] = {"old": getattr(model, key), "new": value}
                        setattr(model, key, value)

                model.updated_at = datetime.utcnow()
                await session.commit()

                # Create audit log entry
                if changes:
                    await self._create_audit_log(
                        session, model_id, None, None, "model_updated",
                        f"Updated model '{model.name}'", user_id, changes
                    )

                await session.refresh(model)
                logger.info(f"Updated model {model_id}")
                return model

            except Exception as e:
                await session.rollback()
                logger.error(f"Error updating model {model_id}: {str(e)}")
                raise

    async def delete_model(self, model_id: UUID, user_id: UUID) -> bool:
        """Soft delete a model (mark as inactive)"""

        async with AsyncSessionLocal() as session:
            try:
                model = await session.get(ModelRegistry, model_id)
                if not model:
                    raise ValueError(f"Model {model_id} not found")

                model.is_active = False
                model.updated_at = datetime.utcnow()
                await session.commit()

                # Create audit log entry
                await self._create_audit_log(
                    session, model_id, None, None, "model_deleted",
                    f"Deleted model '{model.name}'", user_id
                )

                logger.info(f"Deleted model {model_id}")
                return True

            except Exception as e:
                await session.rollback()
                logger.error(f"Error deleting model {model_id}: {str(e)}")
                raise

    async def _create_audit_log(
        self,
        session: AsyncSession,
        model_id: Optional[UUID],
        version_id: Optional[UUID],
        deployment_id: Optional[UUID],
        action_type: str,
        description: str,
        user_id: UUID,
        action_data: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
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
            ip_address=ip_address,
            user_agent=user_agent,
            action_result="success"
        )
        session.add(audit_log)


class ModelVersionService:
    """Service for managing ML model versions"""

    def __init__(self, storage_base_path: str = "/tmp/ml_models"):
        self.storage_base_path = Path(storage_base_path)
        self.storage_base_path.mkdir(parents=True, exist_ok=True)

    async def create_version(
        self,
        model_id: UUID,
        version_number: str,
        model_artifact: Any,  # The trained model object
        training_config: Optional[Dict[str, Any]] = None,
        training_metrics: Optional[Dict[str, Any]] = None,
        feature_schema: Optional[Dict[str, Any]] = None,
        dependencies: Optional[Dict[str, Any]] = None,
        changelog: Optional[str] = None,
        documentation: Optional[str] = None,
        parent_version_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None
    ) -> ModelVersion:
        """Create a new model version with artifact storage"""

        async with AsyncSessionLocal() as session:
            try:
                # Verify model exists
                model = await session.get(ModelRegistry, model_id)
                if not model:
                    raise ValueError(f"Model {model_id} not found")

                # Check if version already exists
                existing_version = await session.execute(
                    select(ModelVersion).where(
                        and_(
                            ModelVersion.model_id == model_id,
                            ModelVersion.version_number == version_number
                        )
                    )
                )
                if existing_version.scalar_one_or_none():
                    raise ValueError(f"Version {version_number} already exists for model {model_id}")

                # Save model artifact and generate metadata
                artifact_path, artifact_size, artifact_checksum = await self._save_model_artifact(
                    model_id, version_number, model_artifact
                )

                # Generate version hash
                version_hash = self._generate_version_hash(
                    model_id, version_number, artifact_checksum, training_config
                )

                # Create version record
                version = ModelVersion(
                    model_id=model_id,
                    version_number=version_number,
                    version_hash=version_hash,
                    artifact_path=str(artifact_path),
                    artifact_size_bytes=artifact_size,
                    artifact_checksum=artifact_checksum,
                    training_config=training_config or {},
                    training_metrics=training_metrics or {},
                    feature_schema=feature_schema or {},
                    dependencies=dependencies or {},
                    changelog=changelog,
                    documentation=documentation,
                    parent_version_id=parent_version_id,
                    status=ModelStatus.DEVELOPMENT
                )

                # Calculate model size
                if hasattr(model_artifact, '__sizeof__'):
                    version.model_size_mb = model_artifact.__sizeof__() / (1024 * 1024)

                session.add(version)

                # Update "latest" flags
                await self._update_latest_version_flags(session, model_id, version.id)

                await session.commit()
                await session.refresh(version)

                # Create audit log entry
                if user_id:
                    await self._create_audit_log(
                        session, model_id, version.id, None, "version_created",
                        f"Created version {version_number}", user_id,
                        {"version_number": version_number, "artifact_size": artifact_size}
                    )

                logger.info(f"Created version {version_number} for model {model_id}")
                return version

            except Exception as e:
                await session.rollback()
                logger.error(f"Error creating version {version_number} for model {model_id}: {str(e)}")
                raise

    async def get_version(self, version_id: UUID) -> Optional[ModelVersion]:
        """Get a model version by ID"""

        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(
                    select(ModelVersion)
                    .options(joinedload(ModelVersion.model))
                    .where(ModelVersion.id == version_id)
                )
                return result.scalar_one_or_none()

            except Exception as e:
                logger.error(f"Error getting version {version_id}: {str(e)}")
                raise

    async def get_latest_version(self, model_id: UUID) -> Optional[ModelVersion]:
        """Get the latest version of a model"""

        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(
                    select(ModelVersion).where(
                        and_(
                            ModelVersion.model_id == model_id,
                            ModelVersion.is_latest == True
                        )
                    )
                )
                return result.scalar_one_or_none()

            except Exception as e:
                logger.error(f"Error getting latest version for model {model_id}: {str(e)}")
                raise

    async def list_versions(
        self,
        model_id: UUID,
        status: Optional[ModelStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[ModelVersion], int]:
        """List versions for a model"""

        async with AsyncSessionLocal() as session:
            try:
                query = select(ModelVersion).where(ModelVersion.model_id == model_id)
                count_query = select(func.count(ModelVersion.id)).where(ModelVersion.model_id == model_id)

                if status:
                    query = query.where(ModelVersion.status == status)
                    count_query = count_query.where(ModelVersion.status == status)

                query = query.order_by(desc(ModelVersion.created_at)).offset(offset).limit(limit)

                result = await session.execute(query)
                count_result = await session.execute(count_query)

                versions = result.scalars().all()
                total_count = count_result.scalar()

                return versions, total_count

            except Exception as e:
                logger.error(f"Error listing versions for model {model_id}: {str(e)}")
                raise

    async def load_model_artifact(self, version_id: UUID) -> Any:
        """Load a model artifact from storage"""

        async with AsyncSessionLocal() as session:
            try:
                version = await session.get(ModelVersion, version_id)
                if not version or not version.artifact_path:
                    raise ValueError(f"Version {version_id} not found or has no artifact")

                artifact_path = Path(version.artifact_path)
                if not artifact_path.exists():
                    raise FileNotFoundError(f"Artifact file not found: {artifact_path}")

                # Verify checksum
                current_checksum = await self._calculate_file_checksum(artifact_path)
                if current_checksum != version.artifact_checksum:
                    raise ValueError("Artifact checksum mismatch - file may be corrupted")

                # Load the model using joblib
                model = joblib.load(artifact_path)
                logger.info(f"Loaded model artifact for version {version_id}")
                return model

            except Exception as e:
                logger.error(f"Error loading model artifact for version {version_id}: {str(e)}")
                raise

    async def promote_version(
        self,
        version_id: UUID,
        target_status: ModelStatus,
        user_id: UUID,
        approved_by: Optional[UUID] = None
    ) -> ModelVersion:
        """Promote a version to a higher status (e.g., staging to production)"""

        async with AsyncSessionLocal() as session:
            try:
                version = await session.get(ModelVersion, version_id)
                if not version:
                    raise ValueError(f"Version {version_id} not found")

                old_status = version.status
                version.status = target_status

                if target_status in [ModelStatus.PRODUCTION, ModelStatus.STAGING]:
                    version.is_approved = True
                    version.approved_by = approved_by or user_id
                    version.approved_at = datetime.utcnow()

                version.updated_at = datetime.utcnow()
                await session.commit()

                # Create audit log entry
                await self._create_audit_log(
                    session, version.model_id, version_id, None, "version_promoted",
                    f"Promoted version from {old_status.value} to {target_status.value}",
                    user_id, {"old_status": old_status.value, "new_status": target_status.value}
                )

                await session.refresh(version)
                logger.info(f"Promoted version {version_id} to {target_status.value}")
                return version

            except Exception as e:
                await session.rollback()
                logger.error(f"Error promoting version {version_id}: {str(e)}")
                raise

    async def _save_model_artifact(
        self,
        model_id: UUID,
        version_number: str,
        model_artifact: Any
    ) -> Tuple[Path, int, str]:
        """Save model artifact to filesystem"""

        try:
            # Create model directory
            model_dir = self.storage_base_path / str(model_id)
            model_dir.mkdir(parents=True, exist_ok=True)

            # Save artifact
            artifact_path = model_dir / f"model_v{version_number}.joblib"
            joblib.dump(model_artifact, artifact_path)

            # Calculate file size and checksum
            artifact_size = artifact_path.stat().st_size
            artifact_checksum = await self._calculate_file_checksum(artifact_path)

            return artifact_path, artifact_size, artifact_checksum

        except Exception as e:
            logger.error(f"Error saving model artifact: {str(e)}")
            raise

    async def _calculate_file_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file"""

        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()

    def _generate_version_hash(
        self,
        model_id: UUID,
        version_number: str,
        artifact_checksum: str,
        training_config: Optional[Dict[str, Any]]
    ) -> str:
        """Generate a unique hash for the version"""

        hash_input = f"{model_id}:{version_number}:{artifact_checksum}:{json.dumps(training_config, sort_keys=True)}"
        return hashlib.sha256(hash_input.encode()).hexdigest()

    async def _update_latest_version_flags(
        self,
        session: AsyncSession,
        model_id: UUID,
        new_version_id: UUID
    ):
        """Update is_latest flags for model versions"""

        # Clear all existing latest flags for this model
        await session.execute(
            select(ModelVersion)
            .where(ModelVersion.model_id == model_id)
            .update({"is_latest": False})
        )

        # Set the new version as latest
        new_version = await session.get(ModelVersion, new_version_id)
        new_version.is_latest = True

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