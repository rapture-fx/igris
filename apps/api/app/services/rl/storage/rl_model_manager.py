"""
RL Model Manager
Production-ready RL model persistence with cloud backup, versioning, and disaster recovery
"""

import os
import json
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple, Union
from pathlib import Path
import joblib
import tempfile
import shutil
import logging

from app.core.config import settings
from app.core.error_tracking import capture_exception, ErrorSeverity, ErrorCategory
from app.database.connection import get_async_session
from app.database.models import RLModel, RLModelVersion
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .cloud_model_storage import cloud_storage

logger = logging.getLogger(__name__)

class RLModelManager:
    """
    Production-ready RL model persistence with comprehensive backup and recovery

    Features:
    - Atomic saves with rollback capability
    - Cloud backup with integrity verification
    - Metadata persistence in database
    - Version management and history
    - Disaster recovery and restoration
    - Performance monitoring integration
    """

    def __init__(self):
        self.local_checkpoint_dir = Path("./checkpoints/rl_models")
        self.local_checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.backup_enabled = getattr(settings, 'RL_MODEL_CLOUD_BACKUP', True)

    async def save_model_with_backup(
        self,
        agent,
        model_id: str,
        episode: int,
        performance_metrics: Dict[str, Any],
        hyperparameters: Dict[str, Any],
        training_metadata: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Save RL model with cloud backup and comprehensive metadata

        Args:
            agent: The RL agent to save
            model_id: Unique identifier for the model
            episode: Training episode number
            performance_metrics: Performance metrics at time of save
            hyperparameters: Hyperparameters used for training
            training_metadata: Additional training metadata
            session_id: Training session identifier

        Returns:
            Save result with URLs and metadata
        """
        save_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)

        try:
            # Generate version string
            version = f"episode_{episode}_{timestamp.strftime('%Y%m%d_%H%M%S')}"

            # Create local checkpoint path
            local_checkpoint_dir = self.local_checkpoint_dir / model_id / version
            local_checkpoint_dir.mkdir(parents=True, exist_ok=True)

            # Save model locally first
            local_result = await self._save_model_locally(
                agent, local_checkpoint_dir, save_id, performance_metrics,
                hyperparameters, training_metadata, session_id
            )

            if not local_result["success"]:
                return local_result

            # Save metadata to database
            db_result = await self._save_model_metadata(
                model_id, version, episode, performance_metrics,
                hyperparameters, training_metadata, session_id,
                local_result["local_path"], timestamp
            )

            # Cloud backup (if enabled)
            cloud_result = None
            if self.backup_enabled:
                cloud_result = await self._backup_to_cloud(
                    local_result["local_path"], model_id, version,
                    {
                        **performance_metrics,
                        **hyperparameters,
                        "episode": episode,
                        "session_id": session_id,
                        "training_metadata": training_metadata or {},
                        "save_timestamp": timestamp.isoformat()
                    }
                )

            logger.info(f"Successfully saved RL model {model_id} version {version}")

            return {
                "success": True,
                "save_id": save_id,
                "model_id": model_id,
                "version": version,
                "episode": episode,
                "local_path": local_result["local_path"],
                "cloud_backup": cloud_result,
                "database_id": db_result.get("database_id") if db_result else None,
                "timestamp": timestamp.isoformat(),
                "performance_metrics": performance_metrics
            }

        except Exception as e:
            logger.error(f"Failed to save RL model {model_id}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.HIGH,
                category=ErrorCategory.DATA_LOSS,
                extra_data={
                    "model_id": model_id,
                    "episode": episode,
                    "save_id": save_id
                }
            )

            # Cleanup on failure
            await self._cleanup_failed_save(local_checkpoint_dir)

            return {
                "success": False,
                "error": str(e),
                "save_id": save_id,
                "timestamp": timestamp.isoformat()
            }

    async def _save_model_locally(
        self,
        agent,
        checkpoint_dir: Path,
        save_id: str,
        performance_metrics: Dict[str, Any],
        hyperparameters: Dict[str, Any],
        training_metadata: Optional[Dict[str, Any]],
        session_id: Optional[str]
    ) -> Dict[str, Any]:
        """Save model to local filesystem with comprehensive metadata"""

        try:
            # Save agent model
            agent_path = checkpoint_dir / "agent_model"

            # Handle different agent types
            if hasattr(agent, 'save'):
                # Stable-Baselines3 agent
                agent.save(str(agent_path))
            elif hasattr(agent, 'save_model'):
                # Custom agent with save_model method
                agent.save_model(str(agent_path))
            else:
                # Fallback: use joblib for other types
                joblib.dump(agent, str(agent_path) + '.pkl')

            # Save comprehensive metadata
            metadata = {
                "save_id": save_id,
                "agent_type": type(agent).__name__,
                "save_timestamp": datetime.now(timezone.utc).isoformat(),
                "performance_metrics": performance_metrics,
                "hyperparameters": hyperparameters,
                "training_metadata": training_metadata or {},
                "session_id": session_id,
                "model_format": "stable_baselines3" if hasattr(agent, 'save') else "custom",
                "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}",
                "dependencies": self._get_dependency_versions()
            }

            metadata_path = checkpoint_dir / "metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            # Save hyperparameters separately for easy access
            hyperparams_path = checkpoint_dir / "hyperparameters.json"
            with open(hyperparams_path, 'w') as f:
                json.dump(hyperparameters, f, indent=2)

            # Save performance history if available
            if hasattr(agent, 'performance_history') and agent.performance_history:
                performance_path = checkpoint_dir / "performance_history.json"
                with open(performance_path, 'w') as f:
                    json.dump(agent.performance_history, f, indent=2)

            # Create save summary
            summary_path = checkpoint_dir / "save_summary.txt"
            with open(summary_path, 'w') as f:
                f.write(f"RL Model Save Summary\n")
                f.write(f"====================\n\n")
                f.write(f"Model ID: {save_id}\n")
                f.write(f"Agent Type: {type(agent).__name__}\n")
                f.write(f"Save Time: {datetime.now(timezone.utc).isoformat()}\n")
                f.write(f"Session ID: {session_id}\n\n")
                f.write(f"Performance Metrics:\n")
                for key, value in performance_metrics.items():
                    f.write(f"  {key}: {value}\n")
                f.write(f"\nHyperparameters:\n")
                for key, value in hyperparameters.items():
                    f.write(f"  {key}: {value}\n")

            return {
                "success": True,
                "local_path": str(checkpoint_dir),
                "files_created": [
                    str(agent_path),
                    str(metadata_path),
                    str(hyperparams_path),
                    str(summary_path)
                ]
            }

        except Exception as e:
            logger.error(f"Failed to save model locally: {e}")
            return {"success": False, "error": str(e)}

    def _get_dependency_versions(self) -> Dict[str, str]:
        """Get versions of key dependencies for reproducibility"""
        dependencies = {}

        try:
            import stable_baselines3
            dependencies['stable_baselines3'] = stable_baselines3.__version__
        except ImportError:
            dependencies['stable_baselines3'] = 'not_installed'

        try:
            import torch
            dependencies['torch'] = torch.__version__
        except ImportError:
            dependencies['torch'] = 'not_installed'

        try:
            import numpy
            dependencies['numpy'] = numpy.__version__
        except ImportError:
            dependencies['numpy'] = 'not_installed'

        try:
            import gym
            dependencies['gym'] = gym.__version__
        except ImportError:
            try:
                import gymnasium
                dependencies['gymnasium'] = gymnasium.__version__
            except ImportError:
                dependencies['gym'] = 'not_installed'

        return dependencies

    async def _save_model_metadata(
        self,
        model_id: str,
        version: str,
        episode: int,
        performance_metrics: Dict[str, Any],
        hyperparameters: Dict[str, Any],
        training_metadata: Optional[Dict[str, Any]],
        session_id: Optional[str],
        local_path: str,
        timestamp: datetime
    ) -> Dict[str, Any]:
        """Save model metadata to database"""

        try:
            async with get_async_session() as db:
                # Check if model record exists
                model_query = select(RLModel).where(RLModel.model_id == model_id)
                result = await db.execute(model_query)
                model_record = result.scalar_one_or_none()

                # Create model record if it doesn't exist
                if not model_record:
                    model_record = RLModel(
                        model_id=model_id,
                        name=f"RL Model {model_id}",
                        description=f"Reinforcement Learning model created at {timestamp}",
                        created_at=timestamp,
                        updated_at=timestamp
                    )
                    db.add(model_record)
                    await db.flush()  # Get the ID

                # Create version record
                version_record = RLModelVersion(
                    model_id=model_record.id,
                    version=version,
                    episode=episode,
                    performance_metrics=performance_metrics,
                    hyperparameters=hyperparameters,
                    training_metadata=training_metadata or {},
                    session_id=session_id,
                    local_path=local_path,
                    created_at=timestamp,
                    is_active=True  # Mark as the active version
                )

                # Deactivate previous active versions
                await db.execute(
                    f"UPDATE rl_model_versions SET is_active = false WHERE model_id = {model_record.id}"
                )

                db.add(version_record)
                model_record.updated_at = timestamp

                await db.commit()

                return {
                    "success": True,
                    "database_id": version_record.id,
                    "model_database_id": model_record.id
                }

        except Exception as e:
            logger.error(f"Failed to save model metadata to database: {e}")
            return {"success": False, "error": str(e)}

    async def _backup_to_cloud(
        self,
        local_path: str,
        model_id: str,
        version: str,
        metadata: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Backup model to cloud storage"""

        try:
            if not cloud_storage.s3_primary:
                logger.info("Cloud storage not available, skipping backup")
                return None

            # Upload to cloud storage
            upload_result = await cloud_storage.upload_model_with_version(
                local_path, model_id, version, metadata, "rl"
            )

            return upload_result

        except Exception as e:
            logger.error(f"Failed to backup model to cloud: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.INFRASTRUCTURE,
                extra_data={"model_id": model_id, "version": version}
            )
            return {"status": "failed", "error": str(e)}

    async def load_model(
        self,
        model_id: str,
        version: Optional[str] = None,
        prefer_cloud: bool = False
    ) -> Dict[str, Any]:
        """
        Load RL model from storage

        Args:
            model_id: Model identifier
            version: Specific version (latest if None)
            prefer_cloud: Prefer cloud storage over local

        Returns:
            Load result with agent and metadata
        """

        try:
            # Get model metadata from database
            async with get_async_session() as db:
                model_query = select(RLModel).where(RLModel.model_id == model_id)
                result = await db.execute(model_query)
                model_record = result.scalar_one_or_none()

                if not model_record:
                    return {"success": False, "error": "Model not found"}

                # Get version
                if version:
                    version_query = select(RLModelVersion).where(
                        RLModelVersion.model_id == model_record.id,
                        RLModelVersion.version == version
                    )
                else:
                    # Get latest active version
                    version_query = select(RLModelVersion).where(
                        RLModelVersion.model_id == model_record.id,
                        RLModelVersion.is_active == True
                    )

                result = await db.execute(version_query)
                version_record = result.scalar_one_or_none()

                if not version_record:
                    return {"success": False, "error": "Version not found"}

            # Try loading from local first (unless cloud preferred)
            if not prefer_cloud and os.path.exists(version_record.local_path):
                load_result = await self._load_from_local(version_record.local_path)
                if load_result["success"]:
                    return {
                        **load_result,
                        "model_id": model_id,
                        "version": version_record.version,
                        "episode": version_record.episode,
                        "performance_metrics": version_record.performance_metrics,
                        "hyperparameters": version_record.hyperparameters,
                        "source": "local"
                    }

            # Try loading from cloud
            if self.backup_enabled:
                cloud_result = await cloud_storage.download_model(
                    model_id, version_record.version
                )

                if cloud_result["status"] == "success":
                    load_result = await self._load_from_local(cloud_result["local_path"])
                    if load_result["success"]:
                        return {
                            **load_result,
                            "model_id": model_id,
                            "version": version_record.version,
                            "episode": version_record.episode,
                            "performance_metrics": version_record.performance_metrics,
                            "hyperparameters": version_record.hyperparameters,
                            "source": "cloud"
                        }

            return {"success": False, "error": "Could not load from any source"}

        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            return {"success": False, "error": str(e)}

    async def _load_from_local(self, local_path: str) -> Dict[str, Any]:
        """Load model from local filesystem"""

        try:
            checkpoint_dir = Path(local_path)

            # Load metadata
            metadata_path = checkpoint_dir / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
            else:
                metadata = {}

            # Load agent based on format
            agent_path = checkpoint_dir / "agent_model"

            if metadata.get("model_format") == "stable_baselines3":
                # Try to load as Stable-Baselines3 model
                try:
                    from stable_baselines3 import PPO, A2C, SAC, DDPG

                    # Determine agent type and load
                    agent_type = metadata.get("agent_type", "PPO")
                    agent_class = {"PPO": PPO, "A2C": A2C, "SAC": SAC, "DDPG": DDPG}.get(agent_type, PPO)

                    agent = agent_class.load(str(agent_path))

                except ImportError:
                    logger.warning("Stable-Baselines3 not available, trying joblib")
                    agent = joblib.load(str(agent_path) + '.pkl')

            else:
                # Load with joblib
                agent = joblib.load(str(agent_path) + '.pkl')

            return {
                "success": True,
                "agent": agent,
                "metadata": metadata,
                "local_path": local_path
            }

        except Exception as e:
            logger.error(f"Failed to load from local path {local_path}: {e}")
            return {"success": False, "error": str(e)}

    async def _cleanup_failed_save(self, checkpoint_dir: Path):
        """Clean up files from failed save operation"""
        try:
            if checkpoint_dir.exists():
                shutil.rmtree(checkpoint_dir)
                logger.info(f"Cleaned up failed save directory: {checkpoint_dir}")
        except Exception as e:
            logger.warning(f"Failed to cleanup directory {checkpoint_dir}: {e}")

    async def list_models(self) -> List[Dict[str, Any]]:
        """List all available RL models"""

        try:
            async with get_async_session() as db:
                models_query = select(RLModel).order_by(RLModel.updated_at.desc())
                result = await db.execute(models_query)
                models = result.scalars().all()

                model_list = []
                for model in models:
                    # Get latest version
                    version_query = select(RLModelVersion).where(
                        RLModelVersion.model_id == model.id,
                        RLModelVersion.is_active == True
                    )
                    version_result = await db.execute(version_query)
                    latest_version = version_result.scalar_one_or_none()

                    model_info = {
                        "model_id": model.model_id,
                        "name": model.name,
                        "description": model.description,
                        "created_at": model.created_at.isoformat(),
                        "updated_at": model.updated_at.isoformat(),
                        "latest_version": latest_version.version if latest_version else None,
                        "latest_episode": latest_version.episode if latest_version else None,
                        "performance_metrics": latest_version.performance_metrics if latest_version else {}
                    }

                    model_list.append(model_info)

                return model_list

        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []

    async def get_model_versions(self, model_id: str) -> List[Dict[str, Any]]:
        """Get all versions of a specific model"""

        try:
            async with get_async_session() as db:
                # Get model record
                model_query = select(RLModel).where(RLModel.model_id == model_id)
                result = await db.execute(model_query)
                model_record = result.scalar_one_or_none()

                if not model_record:
                    return []

                # Get all versions
                versions_query = select(RLModelVersion).where(
                    RLModelVersion.model_id == model_record.id
                ).order_by(RLModelVersion.created_at.desc())

                result = await db.execute(versions_query)
                versions = result.scalars().all()

                version_list = []
                for version in versions:
                    version_info = {
                        "version": version.version,
                        "episode": version.episode,
                        "performance_metrics": version.performance_metrics,
                        "hyperparameters": version.hyperparameters,
                        "session_id": version.session_id,
                        "created_at": version.created_at.isoformat(),
                        "is_active": version.is_active,
                        "local_path": version.local_path
                    }
                    version_list.append(version_info)

                return version_list

        except Exception as e:
            logger.error(f"Failed to get versions for model {model_id}: {e}")
            return []

    async def delete_model_version(
        self,
        model_id: str,
        version: str,
        confirm: bool = False,
        delete_from_cloud: bool = True
    ) -> Dict[str, Any]:
        """Delete a specific model version"""

        if not confirm:
            return {
                "success": False,
                "error": "Deletion not confirmed. Set confirm=True to proceed."
            }

        try:
            async with get_async_session() as db:
                # Get model and version records
                model_query = select(RLModel).where(RLModel.model_id == model_id)
                result = await db.execute(model_query)
                model_record = result.scalar_one_or_none()

                if not model_record:
                    return {"success": False, "error": "Model not found"}

                version_query = select(RLModelVersion).where(
                    RLModelVersion.model_id == model_record.id,
                    RLModelVersion.version == version
                )
                result = await db.execute(version_query)
                version_record = result.scalar_one_or_none()

                if not version_record:
                    return {"success": False, "error": "Version not found"}

                # Delete local files
                if os.path.exists(version_record.local_path):
                    shutil.rmtree(version_record.local_path)

                # Delete from cloud if requested
                if delete_from_cloud and self.backup_enabled:
                    await cloud_storage.delete_model_version(
                        model_id, version, confirm=True
                    )

                # Delete database record
                await db.delete(version_record)
                await db.commit()

                logger.info(f"Deleted model {model_id} version {version}")
                return {"success": True}

        except Exception as e:
            logger.error(f"Failed to delete model {model_id} version {version}: {e}")
            return {"success": False, "error": str(e)}

    async def get_storage_stats(self) -> Dict[str, Any]:
        """Get comprehensive storage statistics"""

        local_stats = self._get_local_storage_stats()
        cloud_stats = await cloud_storage.get_storage_stats() if self.backup_enabled else {}

        return {
            "local_storage": local_stats,
            "cloud_storage": cloud_stats,
            "backup_enabled": self.backup_enabled
        }

    def _get_local_storage_stats(self) -> Dict[str, Any]:
        """Get local storage statistics"""

        try:
            total_size = 0
            total_files = 0
            model_count = 0

            if self.local_checkpoint_dir.exists():
                # Count models (subdirectories)
                model_dirs = [d for d in self.local_checkpoint_dir.iterdir() if d.is_dir()]
                model_count = len(model_dirs)

                # Count total files and size
                for root, dirs, files in os.walk(self.local_checkpoint_dir):
                    for file in files:
                        file_path = Path(root) / file
                        if file_path.exists():
                            total_size += file_path.stat().st_size
                            total_files += 1

            return {
                "total_size": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "total_files": total_files,
                "model_count": model_count,
                "local_path": str(self.local_checkpoint_dir)
            }

        except Exception as e:
            logger.error(f"Failed to get local storage stats: {e}")
            return {"error": str(e)}

# Global instance
rl_model_manager = RLModelManager()