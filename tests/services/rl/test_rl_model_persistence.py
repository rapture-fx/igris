"""
Unit Tests for RL Model Persistence System

Tests the complete RL model persistence pipeline including:
- Local model saving and loading
- Cloud backup and recovery
- Version management and history
- Database integration
- Error handling and fallback mechanisms
"""

import pytest
import asyncio
import tempfile
import shutil
import os
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from pathlib import Path

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from apps.api.app.services.rl.storage.rl_model_manager import RLModelManager
from apps.api.app.services.rl.storage.cloud_model_storage import CloudModelStorage


class MockAgent:
    """Mock RL agent for testing"""

    def __init__(self, name="MockAgent"):
        self.name = name
        self.performance_history = [0.1, 0.2, 0.3, 0.4, 0.5]

    def save(self, path: str):
        """Mock save method"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path + ".pkl", "w") as f:
            f.write(f"Mock agent {self.name} saved")

    def load(self, path: str):
        """Mock load method"""
        if os.path.exists(path + ".pkl"):
            return self
        raise FileNotFoundError(f"No file found at {path}")


class MockSettings:
    """Mock settings for testing"""
    MODEL_STORAGE_BUCKET = "test-bucket"
    AWS_REGION = "us-east-1"
    AWS_BACKUP_REGION = "us-west-2"
    AWS_ACCESS_KEY_ID = "test_key"
    AWS_SECRET_ACCESS_KEY = "test_secret"
    RL_MODEL_CLOUD_BACKUP = True


@pytest.fixture
def mock_settings():
    """Mock settings fixture"""
    return MockSettings()


@pytest.fixture
def temp_dir():
    """Temporary directory fixture"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def mock_agent():
    """Mock RL agent fixture"""
    return MockAgent()


@pytest.fixture
async def mock_db_session():
    """Mock database session"""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()

    # Mock query results
    mock_result = Mock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    session.execute.return_value = mock_result

    return session


@pytest.fixture
def model_manager(temp_dir, mock_settings):
    """RL Model Manager fixture"""
    with patch('apps.api.app.services.rl.storage.rl_model_manager.settings', mock_settings):
        manager = RLModelManager()
        manager.local_checkpoint_dir = Path(temp_dir) / "checkpoints"
        manager.local_checkpoint_dir.mkdir(parents=True, exist_ok=True)
        return manager


@pytest.fixture
def cloud_storage_mock(mock_settings):
    """Mock cloud storage"""
    with patch('boto3.client') as mock_boto3:
        # Mock S3 clients
        mock_s3_primary = Mock()
        mock_s3_backup = Mock()

        mock_boto3.side_effect = [mock_s3_primary, mock_s3_backup]

        # Mock successful bucket access
        mock_s3_primary.head_bucket.return_value = {}

        storage = CloudModelStorage()
        storage.s3_primary = mock_s3_primary
        storage.s3_backup = mock_s3_backup

        return storage, mock_s3_primary, mock_s3_backup


class TestRLModelManager:
    """Test suite for RLModelManager"""

    @pytest.mark.asyncio
    async def test_save_model_locally_success(self, model_manager, mock_agent, temp_dir):
        """Test successful local model saving"""

        performance_metrics = {"reward": 100.0, "episode": 50}
        hyperparameters = {"learning_rate": 0.001, "gamma": 0.99}
        training_metadata = {"environment": "test_env"}

        result = await model_manager._save_model_locally(
            mock_agent,
            Path(temp_dir) / "test_checkpoint",
            "test_save_id",
            performance_metrics,
            hyperparameters,
            training_metadata,
            "test_session"
        )

        assert result["success"] is True
        assert "local_path" in result
        assert len(result["files_created"]) >= 3

        # Verify files were created
        checkpoint_dir = Path(temp_dir) / "test_checkpoint"
        assert (checkpoint_dir / "metadata.json").exists()
        assert (checkpoint_dir / "hyperparameters.json").exists()
        assert (checkpoint_dir / "save_summary.txt").exists()

        # Verify metadata content
        with open(checkpoint_dir / "metadata.json") as f:
            metadata = json.load(f)

        assert metadata["save_id"] == "test_save_id"
        assert metadata["performance_metrics"] == performance_metrics
        assert metadata["hyperparameters"] == hyperparameters
        assert metadata["session_id"] == "test_session"

    @pytest.mark.asyncio
    async def test_save_model_with_backup_success(self, model_manager, mock_agent, mock_db_session):
        """Test complete model save with backup"""

        with patch('apps.api.app.services.rl.storage.rl_model_manager.get_async_session') as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            with patch.object(model_manager, '_backup_to_cloud', return_value={"status": "success"}):

                result = await model_manager.save_model_with_backup(
                    agent=mock_agent,
                    model_id="test_model",
                    episode=100,
                    performance_metrics={"reward": 150.0},
                    hyperparameters={"lr": 0.001},
                    training_metadata={"env": "test"},
                    session_id="test_session"
                )

                assert result["success"] is True
                assert result["model_id"] == "test_model"
                assert result["episode"] == 100
                assert "save_id" in result
                assert "local_path" in result
                assert "cloud_backup" in result

    @pytest.mark.asyncio
    async def test_save_model_fallback_on_error(self, model_manager, mock_agent):
        """Test fallback mechanism when enhanced save fails"""

        # Mock the enhanced save to fail
        with patch.object(model_manager, '_save_model_locally', side_effect=Exception("Enhanced save failed")):
            with patch('os.makedirs'):
                with patch.object(mock_agent, 'save'):

                    result = await model_manager.save_model_with_backup(
                        agent=mock_agent,
                        model_id="test_model",
                        episode=50,
                        performance_metrics={"reward": 50.0},
                        hyperparameters={"lr": 0.01}
                    )

                    assert result["success"] is False
                    assert "error" in result

    @pytest.mark.asyncio
    async def test_load_model_from_local(self, model_manager, mock_agent, temp_dir):
        """Test loading model from local storage"""

        # First save a model
        checkpoint_dir = Path(temp_dir) / "test_model" / "v1"
        checkpoint_dir.mkdir(parents=True)

        # Create mock agent file
        agent_path = checkpoint_dir / "agent_model"
        mock_agent.save(str(agent_path))

        # Create metadata
        metadata = {
            "model_format": "stable_baselines3",
            "agent_type": "MockAgent"
        }
        with open(checkpoint_dir / "metadata.json", "w") as f:
            json.dump(metadata, f)

        # Mock database session for load operation
        mock_db_session = AsyncMock()
        mock_model_record = Mock()
        mock_model_record.model_id = "test_model"
        mock_version_record = Mock()
        mock_version_record.version = "v1"
        mock_version_record.episode = 100
        mock_version_record.performance_metrics = {"reward": 100}
        mock_version_record.hyperparameters = {"lr": 0.001}
        mock_version_record.local_path = str(checkpoint_dir)

        mock_result = Mock()
        mock_result.scalar_one_or_none.side_effect = [mock_model_record, mock_version_record]
        mock_db_session.execute.return_value = mock_result

        with patch('apps.api.app.services.rl.storage.rl_model_manager.get_async_session') as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            with patch('joblib.load', return_value=mock_agent):
                result = await model_manager.load_model("test_model")

                assert result["success"] is True
                assert result["model_id"] == "test_model"
                assert result["source"] == "local"
                assert result["agent"] == mock_agent

    @pytest.mark.asyncio
    async def test_list_models(self, model_manager):
        """Test listing all models"""

        mock_db_session = AsyncMock()
        mock_models = [Mock(model_id="model1", name="Test Model 1", created_at=datetime.now(timezone.utc))]
        mock_version = Mock(version="v1", episode=100, performance_metrics={"reward": 100})

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_models
        mock_result.scalar_one_or_none.return_value = mock_version
        mock_db_session.execute.return_value = mock_result

        with patch('apps.api.app.services.rl.storage.rl_model_manager.get_async_session') as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            result = await model_manager.list_models()

            assert len(result) == 1
            assert result[0]["model_id"] == "model1"
            assert result[0]["latest_version"] == "v1"

    @pytest.mark.asyncio
    async def test_cleanup_failed_save(self, model_manager, temp_dir):
        """Test cleanup of failed save directories"""

        # Create a test directory
        test_dir = Path(temp_dir) / "failed_save"
        test_dir.mkdir(parents=True)
        (test_dir / "test_file.txt").write_text("test content")

        assert test_dir.exists()

        await model_manager._cleanup_failed_save(test_dir)

        assert not test_dir.exists()

    def test_get_dependency_versions(self, model_manager):
        """Test dependency version collection"""

        versions = model_manager._get_dependency_versions()

        assert isinstance(versions, dict)
        # Should have entries for key dependencies
        assert "stable_baselines3" in versions
        assert "torch" in versions
        assert "numpy" in versions

    def test_local_storage_stats(self, model_manager, temp_dir):
        """Test local storage statistics calculation"""

        # Create some test files
        test_dir = Path(temp_dir) / "test_model"
        test_dir.mkdir(parents=True)
        (test_dir / "model.pkl").write_text("test model data")
        (test_dir / "metadata.json").write_text('{"test": "data"}')

        stats = model_manager._get_local_storage_stats()

        assert "total_size" in stats
        assert "total_files" in stats
        assert "model_count" in stats
        assert stats["total_size"] >= 0


class TestCloudModelStorage:
    """Test suite for CloudModelStorage"""

    def test_initialize_clients_success(self, cloud_storage_mock):
        """Test successful S3 client initialization"""

        storage, mock_s3_primary, mock_s3_backup = cloud_storage_mock

        assert storage.s3_primary is not None
        assert storage.s3_backup is not None
        mock_s3_primary.head_bucket.assert_called_once()

    def test_initialize_clients_no_credentials(self, mock_settings):
        """Test handling of missing AWS credentials"""

        with patch('boto3.client', side_effect=Exception("No credentials")):
            storage = CloudModelStorage()

            assert storage.s3_primary is None
            assert storage.s3_backup is None

    def test_generate_model_key(self, mock_settings):
        """Test S3 key generation"""

        with patch('apps.api.app.services.rl.storage.cloud_model_storage.settings', mock_settings):
            storage = CloudModelStorage()

            key = storage._generate_model_key("test_model", "v1.0", "rl")

            assert key.startswith("models/rl/test_model/v1.0_")
            assert len(key.split('_')[-1]) == 15  # timestamp format

    def test_calculate_file_hash(self, cloud_storage_mock, temp_dir):
        """Test file hash calculation"""

        storage, _, _ = cloud_storage_mock

        # Create test file
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("test content for hashing")

        file_hash = storage._calculate_file_hash(str(test_file))

        assert len(file_hash) == 64  # SHA-256 hash length
        assert file_hash == storage._calculate_file_hash(str(test_file))  # Consistent

    @pytest.mark.asyncio
    async def test_upload_single_file(self, cloud_storage_mock, temp_dir):
        """Test single file upload with metadata"""

        storage, mock_s3_primary, mock_s3_backup = cloud_storage_mock

        # Create test file
        test_file = Path(temp_dir) / "model.pkl"
        test_file.write_text("test model data")

        result = await storage._upload_single_file(
            str(test_file),
            "test_model/v1",
            "test_model",
            "v1",
            {"test": "metadata"}
        )

        assert result["status"] == "success"
        assert "primary_url" in result
        assert "file_hash" in result
        assert "file_size" in result

        # Verify S3 calls
        mock_s3_primary.upload_file.assert_called_once()
        mock_s3_primary.put_object.assert_called_once()  # For metadata

    @pytest.mark.asyncio
    async def test_upload_directory_as_archive(self, cloud_storage_mock, temp_dir):
        """Test directory upload as compressed archive"""

        storage, mock_s3_primary, _ = cloud_storage_mock

        # Create test directory with files
        test_dir = Path(temp_dir) / "test_model"
        test_dir.mkdir()
        (test_dir / "model.pkl").write_text("model data")
        (test_dir / "config.json").write_text('{"config": "data"}')

        result = await storage._upload_directory(
            str(test_dir),
            "test_model/v1",
            "test_model",
            "v1",
            {"test": "metadata"}
        )

        assert result["status"] == "success"
        assert "compressed_directory" in result.get("metadata", {}).get("storage_format", "")

    @pytest.mark.asyncio
    async def test_download_model_success(self, cloud_storage_mock, temp_dir):
        """Test successful model download"""

        storage, mock_s3_primary, _ = cloud_storage_mock

        # Mock S3 responses
        mock_s3_primary.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'models/rl/test_model/v1_20231201_120000/model.pkl', 'Size': 1024},
                {'Key': 'models/rl/test_model/v1_20231201_120000/metadata.json', 'Size': 256}
            ]
        }

        # Mock metadata download
        mock_metadata_obj = Mock()
        mock_metadata_obj['Body'].read.return_value.decode.return_value = json.dumps({
            "file_hash": "test_hash",
            "model_id": "test_model"
        })
        mock_s3_primary.get_object.return_value = mock_metadata_obj

        # Mock file download
        mock_s3_primary.download_file.return_value = None

        # Create mock downloaded file
        download_path = Path(temp_dir) / "downloaded_model.pkl"
        download_path.write_text("downloaded model data")

        with patch.object(storage, '_calculate_file_hash', return_value="test_hash"):
            result = await storage.download_model(
                "test_model",
                "v1_20231201_120000",
                str(download_path)
            )

            assert result["status"] == "success"
            assert result["local_path"] == str(download_path)
            assert "metadata" in result

    @pytest.mark.asyncio
    async def test_get_storage_stats(self, cloud_storage_mock):
        """Test storage statistics retrieval"""

        storage, mock_s3_primary, _ = cloud_storage_mock

        # Mock S3 response
        mock_s3_primary.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'models/rl/model1/v1/model.pkl', 'Size': 1024},
                {'Key': 'models/rl/model2/v1/model.pkl', 'Size': 2048}
            ]
        }

        result = await storage.get_storage_stats()

        assert result["total_objects"] == 2
        assert result["total_size"] == 3072
        assert result["model_count"] == 2
        assert result["bucket_name"] == "test-bucket"


class TestIntegration:
    """Integration tests for the complete RL persistence system"""

    @pytest.mark.asyncio
    async def test_end_to_end_model_persistence(self, temp_dir):
        """Test complete end-to-end model persistence workflow"""

        # Setup
        mock_agent = MockAgent("TestAgent")

        with patch('apps.api.app.services.rl.storage.rl_model_manager.settings', MockSettings()):
            model_manager = RLModelManager()
            model_manager.local_checkpoint_dir = Path(temp_dir) / "checkpoints"
            model_manager.backup_enabled = False  # Disable cloud for this test

            # Mock database operations
            with patch('apps.api.app.services.rl.storage.rl_model_manager.get_async_session') as mock_get_session:
                mock_db_session = AsyncMock()
                mock_get_session.return_value.__aenter__.return_value = mock_db_session

                # Mock database records
                mock_model_record = Mock()
                mock_model_record.id = "db_model_id"
                mock_model_record.model_id = "test_model"

                mock_version_record = Mock()
                mock_version_record.id = "db_version_id"

                mock_result = Mock()
                mock_result.scalar_one_or_none.side_effect = [None, mock_version_record]  # No existing model, then version
                mock_db_session.execute.return_value = mock_result
                mock_db_session.flush = AsyncMock()
                mock_db_session.commit = AsyncMock()

                # Test save
                save_result = await model_manager.save_model_with_backup(
                    agent=mock_agent,
                    model_id="test_model",
                    episode=100,
                    performance_metrics={"reward": 150.0, "episode": 100},
                    hyperparameters={"learning_rate": 0.001, "gamma": 0.99},
                    training_metadata={"environment": "test_env"},
                    session_id="test_session"
                )

                assert save_result["success"] is True
                assert save_result["model_id"] == "test_model"
                assert save_result["episode"] == 100

                # Verify local files were created
                local_path = Path(save_result["local_path"])
                assert local_path.exists()
                assert (local_path / "metadata.json").exists()
                assert (local_path / "hyperparameters.json").exists()

                # Test metadata content
                with open(local_path / "metadata.json") as f:
                    metadata = json.load(f)

                assert metadata["performance_metrics"]["reward"] == 150.0
                assert metadata["hyperparameters"]["learning_rate"] == 0.001
                assert metadata["session_id"] == "test_session"

    @pytest.mark.asyncio
    async def test_disaster_recovery_workflow(self, temp_dir):
        """Test disaster recovery: load from cloud when local is unavailable"""

        mock_agent = MockAgent("RecoveryAgent")

        with patch('apps.api.app.services.rl.storage.rl_model_manager.settings', MockSettings()):
            model_manager = RLModelManager()
            model_manager.local_checkpoint_dir = Path(temp_dir) / "checkpoints"

            # Mock database session
            mock_db_session = AsyncMock()
            mock_model_record = Mock(id="model_id", model_id="disaster_test")
            mock_version_record = Mock(
                version="v1",
                episode=100,
                performance_metrics={"reward": 200},
                hyperparameters={"lr": 0.002},
                local_path="/nonexistent/path"  # Simulate missing local file
            )

            mock_result = Mock()
            mock_result.scalar_one_or_none.side_effect = [mock_model_record, mock_version_record]
            mock_db_session.execute.return_value = mock_result

            # Mock cloud storage download
            with patch.object(model_manager, 'backup_enabled', True):
                with patch('apps.api.app.services.rl.storage.rl_model_manager.cloud_storage') as mock_cloud:

                    # Create temporary file for "downloaded" model
                    temp_model_file = Path(temp_dir) / "downloaded_model.pkl"
                    mock_agent.save(str(temp_model_file).replace('.pkl', ''))

                    mock_cloud.download_model.return_value = {
                        "status": "success",
                        "local_path": str(temp_model_file)
                    }

                    with patch('apps.api.app.services.rl.storage.rl_model_manager.get_async_session') as mock_get_session:
                        mock_get_session.return_value.__aenter__.return_value = mock_db_session

                        with patch('joblib.load', return_value=mock_agent):
                            result = await model_manager.load_model("disaster_test")

                            assert result["success"] is True
                            assert result["source"] == "cloud"
                            assert result["agent"] == mock_agent


if __name__ == "__main__":
    pytest.main([__file__, "-v"])