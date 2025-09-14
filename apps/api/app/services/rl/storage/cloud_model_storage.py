"""
Cloud Model Storage for RL Agents
Production-ready model persistence with cloud backup and versioning
"""

import os
import json
import hashlib
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import logging
import tempfile
import shutil

from app.core.config import settings
from app.core.error_tracking import capture_exception, ErrorSeverity, ErrorCategory

logger = logging.getLogger(__name__)

class CloudModelStorage:
    """
    Production-ready cloud model storage with S3 backend
    Features:
    - Multi-region backup
    - Version control with metadata
    - Integrity verification
    - Disaster recovery
    - Efficient compression
    """

    def __init__(self):
        self.bucket_name = getattr(settings, 'MODEL_STORAGE_BUCKET', 'schlep-engine-models')
        self.region = getattr(settings, 'AWS_REGION', 'us-east-1')
        self.backup_region = getattr(settings, 'AWS_BACKUP_REGION', 'us-west-2')

        # Initialize S3 clients for primary and backup regions
        self.s3_primary = None
        self.s3_backup = None
        self._initialize_clients()

    def _initialize_clients(self):
        """Initialize S3 clients with proper error handling"""
        try:
            # Primary region client
            self.s3_primary = boto3.client(
                's3',
                region_name=self.region,
                aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            )

            # Backup region client
            self.s3_backup = boto3.client(
                's3',
                region_name=self.backup_region,
                aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            )

            # Test connection
            self.s3_primary.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Successfully connected to S3 bucket: {self.bucket_name}")

        except NoCredentialsError:
            logger.warning("AWS credentials not found. Cloud storage disabled.")
            self.s3_primary = None
            self.s3_backup = None

        except ClientError as e:
            logger.warning(f"Could not connect to S3: {e}. Cloud storage disabled.")
            self.s3_primary = None
            self.s3_backup = None

        except Exception as e:
            logger.error(f"Unexpected error initializing cloud storage: {e}")
            self.s3_primary = None
            self.s3_backup = None
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.INFRASTRUCTURE,
                extra_data={"component": "cloud_storage_init"}
            )

    def _generate_model_key(self, model_id: str, version: str, model_type: str = "rl") -> str:
        """Generate S3 key for model storage"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        return f"models/{model_type}/{model_id}/v{version}_{timestamp}"

    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file for integrity verification"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    async def upload_model_with_version(
        self,
        model_path: str,
        model_id: str,
        version: str,
        metadata: Dict[str, Any],
        model_type: str = "rl"
    ) -> Dict[str, Any]:
        """
        Upload model with version control and metadata

        Args:
            model_path: Local path to model file/directory
            model_id: Unique identifier for the model
            version: Version string (e.g., "1.0.0", "v1_episode_100")
            metadata: Model metadata (performance metrics, config, etc.)
            model_type: Type of model (rl, ml, etc.)

        Returns:
            Upload result with URLs and metadata
        """
        if not self.s3_primary:
            logger.warning("Cloud storage not available. Skipping upload.")
            return {"status": "skipped", "reason": "cloud_storage_unavailable"}

        try:
            # Generate S3 key
            s3_key = self._generate_model_key(model_id, version, model_type)

            upload_results = {}

            if os.path.isfile(model_path):
                # Single file upload
                upload_results = await self._upload_single_file(
                    model_path, s3_key, model_id, version, metadata
                )
            elif os.path.isdir(model_path):
                # Directory upload (for complex models)
                upload_results = await self._upload_directory(
                    model_path, s3_key, model_id, version, metadata
                )
            else:
                raise ValueError(f"Model path does not exist: {model_path}")

            logger.info(f"Successfully uploaded model {model_id} version {version}")
            return upload_results

        except Exception as e:
            logger.error(f"Failed to upload model {model_id} version {version}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.HIGH,
                category=ErrorCategory.DATA_LOSS,
                extra_data={
                    "model_id": model_id,
                    "version": version,
                    "model_path": model_path
                }
            )
            return {"status": "failed", "error": str(e)}

    async def _upload_single_file(
        self,
        file_path: str,
        s3_key: str,
        model_id: str,
        version: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Upload single model file with integrity verification"""

        # Calculate file hash for integrity
        file_hash = self._calculate_file_hash(file_path)
        file_size = os.path.getsize(file_path)

        # Enhanced metadata
        enhanced_metadata = {
            **metadata,
            "model_id": model_id,
            "version": version,
            "upload_timestamp": datetime.now(timezone.utc).isoformat(),
            "file_hash": file_hash,
            "file_size": file_size,
            "storage_format": "single_file"
        }

        # Upload to primary region
        try:
            self.s3_primary.upload_file(
                file_path,
                self.bucket_name,
                f"{s3_key}/model.pkl",
                ExtraArgs={
                    'Metadata': {k: str(v) for k, v in enhanced_metadata.items()},
                    'ServerSideEncryption': 'AES256',
                    'StorageClass': 'STANDARD_IA'  # Infrequent access for cost optimization
                }
            )

            primary_url = f"s3://{self.bucket_name}/{s3_key}/model.pkl"
            logger.info(f"Uploaded to primary region: {primary_url}")

        except ClientError as e:
            logger.error(f"Failed to upload to primary region: {e}")
            raise

        # Upload metadata separately
        metadata_key = f"{s3_key}/metadata.json"
        try:
            self.s3_primary.put_object(
                Bucket=self.bucket_name,
                Key=metadata_key,
                Body=json.dumps(enhanced_metadata, indent=2),
                ContentType='application/json',
                ServerSideEncryption='AES256',
                StorageClass='STANDARD_IA'
            )
        except ClientError as e:
            logger.error(f"Failed to upload metadata: {e}")
            # Don't fail the entire upload for metadata issues

        # Backup to secondary region (async)
        backup_url = None
        if self.s3_backup:
            try:
                # Cross-region copy for disaster recovery
                copy_source = {'Bucket': self.bucket_name, 'Key': f"{s3_key}/model.pkl"}
                backup_bucket = f"{self.bucket_name}-backup"

                self.s3_backup.copy_object(
                    CopySource=copy_source,
                    Bucket=backup_bucket,
                    Key=f"{s3_key}/model.pkl",
                    ServerSideEncryption='AES256'
                )

                backup_url = f"s3://{backup_bucket}/{s3_key}/model.pkl"
                logger.info(f"Backed up to secondary region: {backup_url}")

            except ClientError as e:
                logger.warning(f"Failed to create backup copy: {e}")
                # Don't fail upload if backup fails

        return {
            "status": "success",
            "primary_url": primary_url,
            "backup_url": backup_url,
            "metadata_url": f"s3://{self.bucket_name}/{metadata_key}",
            "file_hash": file_hash,
            "file_size": file_size,
            "upload_timestamp": enhanced_metadata["upload_timestamp"]
        }

    async def _upload_directory(
        self,
        dir_path: str,
        s3_key: str,
        model_id: str,
        version: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Upload model directory as compressed archive"""

        # Create temporary compressed archive
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = os.path.join(temp_dir, f"{model_id}_v{version}.tar.gz")

            # Create compressed archive
            shutil.make_archive(
                archive_path.replace('.tar.gz', ''),
                'gztar',
                dir_path
            )

            # Upload the archive
            return await self._upload_single_file(
                archive_path, s3_key, model_id, version,
                {**metadata, "storage_format": "compressed_directory"}
            )

    async def download_model(
        self,
        model_id: str,
        version: Optional[str] = None,
        local_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Download model from cloud storage

        Args:
            model_id: Model identifier
            version: Specific version to download (latest if None)
            local_path: Local path to save model

        Returns:
            Download result with local path and metadata
        """
        if not self.s3_primary:
            return {"status": "failed", "reason": "cloud_storage_unavailable"}

        try:
            # Find the model version
            if version is None:
                version = await self._get_latest_version(model_id)

            if not version:
                return {"status": "failed", "reason": "no_versions_found"}

            # Generate S3 key pattern
            s3_prefix = f"models/rl/{model_id}/v{version}"

            # List objects with the prefix
            objects = self.s3_primary.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=s3_prefix
            )

            if 'Contents' not in objects:
                return {"status": "failed", "reason": "model_not_found"}

            # Find model file
            model_file = None
            metadata_file = None

            for obj in objects['Contents']:
                key = obj['Key']
                if key.endswith('/model.pkl'):
                    model_file = key
                elif key.endswith('/metadata.json'):
                    metadata_file = key

            if not model_file:
                return {"status": "failed", "reason": "model_file_not_found"}

            # Create local path if not provided
            if local_path is None:
                local_path = f"./downloads/{model_id}_v{version}.pkl"

            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            # Download model file
            self.s3_primary.download_file(
                self.bucket_name,
                model_file,
                local_path
            )

            # Download metadata if available
            metadata = {}
            if metadata_file:
                try:
                    metadata_obj = self.s3_primary.get_object(
                        Bucket=self.bucket_name,
                        Key=metadata_file
                    )
                    metadata = json.loads(metadata_obj['Body'].read().decode('utf-8'))
                except Exception as e:
                    logger.warning(f"Failed to download metadata: {e}")

            # Verify integrity if hash available
            if metadata.get('file_hash'):
                downloaded_hash = self._calculate_file_hash(local_path)
                if downloaded_hash != metadata['file_hash']:
                    logger.error(f"Integrity check failed for {model_id} v{version}")
                    return {"status": "failed", "reason": "integrity_check_failed"}

            logger.info(f"Successfully downloaded model {model_id} v{version}")
            return {
                "status": "success",
                "local_path": local_path,
                "metadata": metadata,
                "version": version
            }

        except Exception as e:
            logger.error(f"Failed to download model {model_id}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.DATA_ACCESS,
                extra_data={"model_id": model_id, "version": version}
            )
            return {"status": "failed", "error": str(e)}

    async def _get_latest_version(self, model_id: str) -> Optional[str]:
        """Get the latest version of a model"""
        try:
            # List all versions for the model
            objects = self.s3_primary.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"models/rl/{model_id}/",
                Delimiter='/'
            )

            if 'CommonPrefixes' not in objects:
                return None

            # Extract version numbers from prefixes
            versions = []
            for prefix in objects['CommonPrefixes']:
                prefix_path = prefix['Prefix']
                # Extract version from path like "models/rl/model_id/v1_20231201_120000/"
                version_part = prefix_path.split('/')[-2]
                if version_part.startswith('v'):
                    versions.append(version_part)

            if not versions:
                return None

            # Sort versions by timestamp (assuming format v{version}_{timestamp})
            versions.sort(key=lambda x: x.split('_')[-1] if '_' in x else x, reverse=True)
            return versions[0][1:]  # Remove 'v' prefix

        except Exception as e:
            logger.error(f"Failed to get latest version for {model_id}: {e}")
            return None

    async def list_model_versions(self, model_id: str) -> List[Dict[str, Any]]:
        """List all versions of a model with metadata"""
        if not self.s3_primary:
            return []

        try:
            # List all versions
            objects = self.s3_primary.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"models/rl/{model_id}/"
            )

            if 'Contents' not in objects:
                return []

            versions = {}
            for obj in objects['Contents']:
                key = obj['Key']

                # Extract version from key
                path_parts = key.split('/')
                if len(path_parts) >= 4:
                    version_dir = path_parts[3]  # v{version}_{timestamp}
                    if version_dir.startswith('v'):
                        version = version_dir[1:]  # Remove 'v' prefix

                        if version not in versions:
                            versions[version] = {
                                "version": version,
                                "upload_timestamp": obj['LastModified'].isoformat(),
                                "size": 0,
                                "files": []
                            }

                        versions[version]['size'] += obj['Size']
                        versions[version]['files'].append({
                            "key": key,
                            "size": obj['Size'],
                            "last_modified": obj['LastModified'].isoformat()
                        })

            return list(versions.values())

        except Exception as e:
            logger.error(f"Failed to list versions for {model_id}: {e}")
            return []

    async def delete_model_version(
        self,
        model_id: str,
        version: str,
        confirm: bool = False
    ) -> Dict[str, Any]:
        """Delete a specific model version (requires confirmation)"""
        if not confirm:
            return {
                "status": "failed",
                "reason": "deletion_not_confirmed",
                "message": "Set confirm=True to proceed with deletion"
            }

        if not self.s3_primary:
            return {"status": "failed", "reason": "cloud_storage_unavailable"}

        try:
            # List all objects for this version
            objects = self.s3_primary.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"models/rl/{model_id}/v{version}"
            )

            if 'Contents' not in objects:
                return {"status": "failed", "reason": "version_not_found"}

            # Delete all objects for this version
            delete_objects = {'Objects': []}
            for obj in objects['Contents']:
                delete_objects['Objects'].append({'Key': obj['Key']})

            if delete_objects['Objects']:
                self.s3_primary.delete_objects(
                    Bucket=self.bucket_name,
                    Delete=delete_objects
                )

            logger.info(f"Deleted model {model_id} version {version}")
            return {
                "status": "success",
                "deleted_objects": len(delete_objects['Objects'])
            }

        except Exception as e:
            logger.error(f"Failed to delete model {model_id} version {version}: {e}")
            return {"status": "failed", "error": str(e)}

    async def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics for monitoring"""
        if not self.s3_primary:
            return {"status": "unavailable"}

        try:
            # Get bucket statistics
            objects = self.s3_primary.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix="models/"
            )

            if 'Contents' not in objects:
                return {
                    "total_objects": 0,
                    "total_size": 0,
                    "model_count": 0
                }

            total_size = sum(obj['Size'] for obj in objects['Contents'])
            total_objects = len(objects['Contents'])

            # Count unique models
            models = set()
            for obj in objects['Contents']:
                path_parts = obj['Key'].split('/')
                if len(path_parts) >= 3:
                    models.add(path_parts[2])

            return {
                "total_objects": total_objects,
                "total_size": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "model_count": len(models),
                "bucket_name": self.bucket_name,
                "region": self.region
            }

        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
            return {"status": "error", "error": str(e)}

# Global instance
cloud_storage = CloudModelStorage()