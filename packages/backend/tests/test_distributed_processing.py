"""
Tests for Distributed Processing Services
========================================

Comprehensive tests for the enhanced distributed processing system including:
- DistributedDataProcessor
- TrainingDataManager
- FoundationModelPrep
- RealtimeQualityMonitor
"""

import pytest
import asyncio
import uuid
import tempfile
import json
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
import pandas as pd
import numpy as np

# Import services to test
from app.services.distributed_processor import (
    DistributedDataProcessor, ProcessingFormat, ProcessingConfig
)
from app.services.training_data_manager import (
    TrainingDataManager, SplitStrategy, SplitConfig, DatasetType, DatasetMetadata
)
from app.services.foundation_model_prep import (
    FoundationModelPrep, TokenizationConfig, DeduplicationConfig, TokenizationStrategy
)
from app.services.realtime_quality_monitor import (
    RealtimeQualityMonitor, QualityConfig, QualityCheckType, ReportFormat
)

# Test fixtures
@pytest.fixture
def sample_csv_data():
    """Create a sample CSV file for testing"""
    data = {
        'id': range(1000),
        'name': [f'user_{i}' for i in range(1000)],
        'age': np.random.randint(18, 80, 1000),
        'category': np.random.choice(['A', 'B', 'C'], 1000),
        'score': np.random.normal(50, 15, 1000),
        'missing_col': [None if i % 10 == 0 else f'value_{i}' for i in range(1000)]
    }
    df = pd.DataFrame(data)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        df.to_csv(f.name, index=False)
        return f.name

@pytest.fixture
def sample_jsonl_data():
    """Create a sample JSONL file for testing"""
    data = [
        {"text": f"This is sample text document {i}. It contains various words and phrases.", "label": i % 3}
        for i in range(500)
    ]

    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        for item in data:
            f.write(json.dumps(item) + '\n')
        return f.name

@pytest.fixture
def sample_parquet_data():
    """Create a sample Parquet file for testing"""
    data = {
        'feature_1': np.random.random(2000),
        'feature_2': np.random.random(2000),
        'target': np.random.choice([0, 1], 2000, p=[0.7, 0.3])  # Imbalanced dataset
    }
    df = pd.DataFrame(data)

    with tempfile.NamedTemporaryFile(suffix='.parquet', delete=False) as f:
        df.to_parquet(f.name)
        return f.name

@pytest.fixture
def distributed_processor():
    """Create DistributedDataProcessor instance for testing"""
    config = ProcessingConfig(
        chunk_size=100,  # Small for testing
        max_memory_gb=1.0,
        max_workers=2
    )
    return DistributedDataProcessor(config)

@pytest.fixture
def training_data_manager():
    """Create TrainingDataManager instance for testing"""
    return TrainingDataManager()

@pytest.fixture
def foundation_model_prep():
    """Create FoundationModelPrep instance for testing"""
    return FoundationModelPrep()

@pytest.fixture
def quality_monitor():
    """Create RealtimeQualityMonitor instance for testing"""
    return RealtimeQualityMonitor()

class TestDistributedDataProcessor:
    """Test cases for DistributedDataProcessor"""

    @pytest.mark.asyncio
    async def test_process_csv_dataset(self, distributed_processor, sample_csv_data):
        """Test processing a CSV dataset"""
        output_path = tempfile.mktemp(suffix='.parquet')

        # Mock database operations
        with patch('app.services.distributed_processor.get_async_session'):
            job_id = await distributed_processor.process_large_dataset(
                input_path=sample_csv_data,
                output_path=output_path,
                format=ProcessingFormat.CSV
            )

        assert job_id is not None
        assert isinstance(job_id, str)

        # Wait a bit for background processing to start
        await asyncio.sleep(0.1)

        # Check if job is tracked
        assert job_id in distributed_processor.active_jobs

    @pytest.mark.asyncio
    async def test_process_jsonl_dataset(self, distributed_processor, sample_jsonl_data):
        """Test processing a JSONL dataset"""
        output_path = tempfile.mktemp(suffix='.parquet')

        with patch('app.services.distributed_processor.get_async_session'):
            job_id = await distributed_processor.process_large_dataset(
                input_path=sample_jsonl_data,
                output_path=output_path,
                format=ProcessingFormat.JSONL
            )

        assert job_id is not None
        assert job_id in distributed_processor.active_jobs

    @pytest.mark.asyncio
    async def test_process_parquet_dataset(self, distributed_processor, sample_parquet_data):
        """Test processing a Parquet dataset"""
        output_path = tempfile.mktemp(suffix='.parquet')

        with patch('app.services.distributed_processor.get_async_session'):
            job_id = await distributed_processor.process_large_dataset(
                input_path=sample_parquet_data,
                output_path=output_path,
                format=ProcessingFormat.PARQUET
            )

        assert job_id is not None

    @pytest.mark.asyncio
    async def test_get_job_status(self, distributed_processor, sample_csv_data):
        """Test getting job status"""
        with patch('app.services.distributed_processor.get_async_session'):
            job_id = await distributed_processor.process_large_dataset(
                input_path=sample_csv_data,
                output_path=tempfile.mktemp(suffix='.parquet'),
                format=ProcessingFormat.CSV
            )

            status = await distributed_processor.get_job_status(job_id)

            assert 'job_id' in status
            assert 'status' in status
            assert status['job_id'] == job_id

    @pytest.mark.asyncio
    async def test_cancel_job(self, distributed_processor, sample_csv_data):
        """Test cancelling a job"""
        with patch('app.services.distributed_processor.get_async_session'):
            job_id = await distributed_processor.process_large_dataset(
                input_path=sample_csv_data,
                output_path=tempfile.mktemp(suffix='.parquet'),
                format=ProcessingFormat.CSV
            )

            success = await distributed_processor.cancel_job(job_id)
            assert success is True
            assert job_id not in distributed_processor.active_jobs

    def test_get_system_metrics(self, distributed_processor):
        """Test getting system metrics"""
        metrics = distributed_processor.get_system_metrics()

        assert 'memory_usage_percent' in metrics
        assert 'disk_usage_percent' in metrics
        assert 'active_jobs' in metrics

    @pytest.mark.asyncio
    async def test_file_not_found_error(self, distributed_processor):
        """Test error handling for non-existent file"""
        with pytest.raises(FileNotFoundError):
            await distributed_processor.process_large_dataset(
                input_path="/non/existent/file.csv",
                output_path=tempfile.mktemp(suffix='.parquet'),
                format=ProcessingFormat.CSV
            )

class TestTrainingDataManager:
    """Test cases for TrainingDataManager"""

    @pytest.mark.asyncio
    async def test_create_dataset(self, training_data_manager, sample_csv_data):
        """Test creating a new dataset"""
        metadata = DatasetMetadata(
            name="test_dataset",
            description="A test dataset",
            dataset_type=DatasetType.TABULAR,
            file_path=sample_csv_data,
            total_rows=1000,
            total_columns=6,
            size_bytes=50000,
            schema_info={"columns": ["id", "name", "age", "category", "score", "missing_col"]},
            tags=["test", "sample"]
        )

        with patch('app.services.training_data_manager.get_async_session'):
            dataset_id = await training_data_manager.create_dataset(
                metadata=metadata,
                user_id=uuid.uuid4(),
                auto_version=True
            )

        assert dataset_id is not None
        assert isinstance(dataset_id, str)

    @pytest.mark.asyncio
    async def test_create_dataset_split_random(self, training_data_manager, sample_csv_data):
        """Test creating random dataset splits"""
        # Load test data
        df = pd.read_csv(sample_csv_data)

        split_config = SplitConfig(
            strategy=SplitStrategy.RANDOM,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42
        )

        with patch('app.services.training_data_manager.get_async_session'):
            # Mock the dataset loading
            with patch.object(training_data_manager, '_load_dataset', return_value=df):
                with patch.object(training_data_manager, '_store_split_metadata'):
                    dataset_split = await training_data_manager.create_dataset_split(
                        dataset_version_id=uuid.uuid4(),
                        split_config=split_config,
                        output_dir=tempfile.mkdtemp()
                    )

        assert dataset_split.split_id is not None
        assert dataset_split.train_rows + dataset_split.val_rows + dataset_split.test_rows == len(df)
        assert abs(dataset_split.train_rows / len(df) - 0.7) < 0.05  # Within 5% of target

    @pytest.mark.asyncio
    async def test_create_dataset_split_stratified(self, training_data_manager, sample_csv_data):
        """Test creating stratified dataset splits"""
        df = pd.read_csv(sample_csv_data)

        split_config = SplitConfig(
            strategy=SplitStrategy.STRATIFIED,
            target_column='category',
            train_ratio=0.8,
            val_ratio=0.1,
            test_ratio=0.1,
            random_seed=42
        )

        with patch('app.services.training_data_manager.get_async_session'):
            with patch.object(training_data_manager, '_load_dataset', return_value=df):
                with patch.object(training_data_manager, '_store_split_metadata'):
                    dataset_split = await training_data_manager.create_dataset_split(
                        dataset_version_id=uuid.uuid4(),
                        split_config=split_config,
                        output_dir=tempfile.mkdtemp()
                    )

        assert dataset_split.split_id is not None
        assert dataset_split.train_rows > 0
        assert dataset_split.val_rows > 0
        assert dataset_split.test_rows > 0

    @pytest.mark.asyncio
    async def test_analyze_dataset(self, training_data_manager, sample_csv_data):
        """Test dataset analysis functionality"""
        metadata = await training_data_manager._analyze_dataset(sample_csv_data)

        assert metadata.name is not None
        assert metadata.total_rows > 0
        assert metadata.total_columns > 0
        assert metadata.quality_score is not None
        assert metadata.schema_info is not None

    @pytest.mark.asyncio
    async def test_calculate_file_hash(self, training_data_manager, sample_csv_data):
        """Test file hash calculation"""
        hash1 = await training_data_manager._calculate_file_hash(sample_csv_data)
        hash2 = await training_data_manager._calculate_file_hash(sample_csv_data)

        assert hash1 == hash2  # Same file should produce same hash
        assert len(hash1) == 64  # SHA256 hash length

class TestFoundationModelPrep:
    """Test cases for FoundationModelPrep"""

    @pytest.mark.asyncio
    async def test_prepare_dataset_for_pretraining(self, foundation_model_prep, sample_jsonl_data):
        """Test foundation model dataset preparation"""
        if not foundation_model_prep.__class__.__module__.split('.')[-1] == 'foundation_model_prep':
            pytest.skip("HuggingFace libraries not available")

        tokenization_config = TokenizationConfig(
            model_name_or_path="gpt2",
            max_sequence_length=512,
            batch_size=10
        )

        output_path = tempfile.mkdtemp()

        with patch('app.services.foundation_model_prep.get_async_session'):
            job_id = await foundation_model_prep.prepare_dataset_for_pretraining(
                input_path=sample_jsonl_data,
                output_path=output_path,
                tokenization_config=tokenization_config,
                text_column="text"
            )

        assert job_id is not None

    @pytest.mark.asyncio
    async def test_load_text_dataset_jsonl(self, foundation_model_prep, sample_jsonl_data):
        """Test loading JSONL text dataset"""
        texts = await foundation_model_prep._load_text_dataset(sample_jsonl_data, "text")

        assert len(texts) > 0
        assert all(isinstance(text, str) for text in texts)

    @pytest.mark.asyncio
    async def test_preprocess_texts(self, foundation_model_prep):
        """Test text preprocessing"""
        from app.services.foundation_model_prep import TokenizationConfig

        config = TokenizationConfig(
            min_text_length=10,
            remove_extra_whitespace=True,
            lowercase=False
        )

        texts = [
            "This is   a test   text.",
            "   Another    test   ",
            "Short",  # Should be filtered out
            "This is a longer text that should be kept."
        ]

        processed = await foundation_model_prep._preprocess_texts(texts, config)

        assert len(processed) == 3  # One should be filtered out
        assert "This is a test text." in processed  # Extra whitespace removed
        assert "Another test" in processed

    @pytest.mark.asyncio
    async def test_deduplicate_texts(self, foundation_model_prep):
        """Test text deduplication"""
        from app.services.foundation_model_prep import DeduplicationConfig

        config = DeduplicationConfig(
            exact_dedup=True,
            near_dedup=False
        )

        texts = [
            "This is a unique text.",
            "This is another unique text.",
            "This is a unique text.",  # Exact duplicate
            "This is a third unique text."
        ]

        deduplicated, removed_count = await foundation_model_prep._deduplicate_texts(texts, config)

        assert len(deduplicated) == 3
        assert removed_count == 1

class TestRealtimeQualityMonitor:
    """Test cases for RealtimeQualityMonitor"""

    @pytest.mark.asyncio
    async def test_monitor_training_data_quality(self, quality_monitor, sample_csv_data):
        """Test training data quality monitoring"""
        config = QualityConfig(
            checks_to_run=[QualityCheckType.MISSING_VALUES, QualityCheckType.COMPLETENESS],
            target_column="category",
            report_format=ReportFormat.JSON
        )

        with patch('app.services.realtime_quality_monitor.get_async_session'):
            job_id = await quality_monitor.monitor_training_data_quality(
                dataset_path=sample_csv_data,
                config=config
            )

        assert job_id is not None

    @pytest.mark.asyncio
    async def test_analyze_missing_values(self, quality_monitor, sample_csv_data):
        """Test missing values analysis"""
        from app.services.realtime_quality_monitor import QualityMetrics, QualityConfig

        df = pd.read_csv(sample_csv_data)
        metrics = QualityMetrics(missing_values_ratio=0.0, missing_values_by_column={})
        config = QualityConfig()

        await quality_monitor._analyze_missing_values(df, metrics, config)

        assert metrics.missing_values_ratio >= 0
        assert 'missing_col' in metrics.missing_values_by_column
        assert metrics.missing_values_by_column['missing_col'] > 0  # This column has missing values

    @pytest.mark.asyncio
    async def test_analyze_class_imbalance(self, quality_monitor, sample_parquet_data):
        """Test class imbalance analysis"""
        from app.services.realtime_quality_monitor import QualityMetrics, QualityConfig

        df = pd.read_parquet(sample_parquet_data)
        metrics = QualityMetrics(missing_values_ratio=0.0, missing_values_by_column={})
        config = QualityConfig(target_column='target')

        await quality_monitor._analyze_class_imbalance(df, metrics, config)

        assert metrics.class_distribution is not None
        assert metrics.class_imbalance_ratio is not None
        assert metrics.imbalance_severity is not None

    @pytest.mark.asyncio
    async def test_profile_columns(self, quality_monitor, sample_csv_data):
        """Test column profiling"""
        df = pd.read_csv(sample_csv_data)

        profiles = await quality_monitor._profile_columns(df)

        assert len(profiles) == len(df.columns)

        # Check numerical column profile
        age_profile = profiles['age']
        assert 'mean' in age_profile
        assert 'median' in age_profile
        assert 'std' in age_profile

        # Check categorical column profile
        category_profile = profiles['category']
        assert 'most_frequent' in category_profile
        assert 'top_values' in category_profile

    @pytest.mark.asyncio
    async def test_analyze_outliers(self, quality_monitor, sample_csv_data):
        """Test outlier analysis"""
        df = pd.read_csv(sample_csv_data)

        outlier_analysis = await quality_monitor._analyze_outliers(df)

        # Should have analysis for numerical columns
        assert 'age' in outlier_analysis
        assert 'score' in outlier_analysis

        # Check structure of outlier analysis
        age_analysis = outlier_analysis['age']
        assert 'outlier_count' in age_analysis
        assert 'outlier_percentage' in age_analysis
        assert 'lower_bound' in age_analysis
        assert 'upper_bound' in age_analysis

    @pytest.mark.asyncio
    async def test_analyze_duplicates(self, quality_monitor, sample_csv_data):
        """Test duplicate analysis"""
        df = pd.read_csv(sample_csv_data)

        duplicate_analysis = await quality_monitor._analyze_duplicates(df)

        assert 'duplicate_rows' in duplicate_analysis
        assert 'duplicate_percentage' in duplicate_analysis
        assert 'unique_rows' in duplicate_analysis

    @pytest.mark.asyncio
    async def test_calculate_overall_quality_score(self, quality_monitor):
        """Test overall quality score calculation"""
        from app.services.realtime_quality_monitor import QualityMetrics

        # Good quality metrics
        good_metrics = QualityMetrics(
            missing_values_ratio=5.0,  # Low missing values
            missing_values_by_column={'col1': 5.0},
            missing_values_severity="good",
            class_imbalance_ratio=0.3,  # Acceptable imbalance
            imbalance_severity="good",
            drift_detected=False
        )

        score = await quality_monitor._calculate_overall_quality_score(good_metrics)
        assert score >= 80  # Should be high quality

        # Poor quality metrics
        poor_metrics = QualityMetrics(
            missing_values_ratio=40.0,  # High missing values
            missing_values_by_column={'col1': 40.0},
            missing_values_severity="critical",
            class_imbalance_ratio=0.05,  # Severe imbalance
            imbalance_severity="critical",
            drift_detected=True,
            drift_columns=['col1', 'col2']
        )

        score = await quality_monitor._calculate_overall_quality_score(poor_metrics)
        assert score <= 50  # Should be low quality

    @pytest.mark.asyncio
    async def test_generate_recommendations(self, quality_monitor):
        """Test recommendation generation"""
        from app.services.realtime_quality_monitor import QualityMetrics, QualityConfig

        metrics = QualityMetrics(
            missing_values_ratio=35.0,
            missing_values_by_column={'col1': 35.0},
            missing_values_severity="critical",
            class_imbalance_ratio=0.05,
            imbalance_severity="critical",
            drift_detected=True,
            drift_columns=['col1'],
            overall_quality_score=40.0
        )

        config = QualityConfig()
        recommendations = await quality_monitor._generate_recommendations(metrics, config)

        assert len(recommendations) > 0
        assert any("missing data" in rec.lower() for rec in recommendations)
        assert any("class imbalance" in rec.lower() for rec in recommendations)
        assert any("drift" in rec.lower() for rec in recommendations)

# Integration tests
class TestIntegration:
    """Integration tests for the complete workflow"""

    @pytest.mark.asyncio
    async def test_end_to_end_workflow(self, sample_csv_data):
        """Test complete workflow from data processing to quality monitoring"""
        # Initialize services
        distributed_processor = DistributedDataProcessor()
        training_data_manager = TrainingDataManager()
        quality_monitor = RealtimeQualityMonitor()

        # Step 1: Process large dataset
        with patch('app.services.distributed_processor.get_async_session'):
            processing_job_id = await distributed_processor.process_large_dataset(
                input_path=sample_csv_data,
                output_path=tempfile.mktemp(suffix='.parquet'),
                format=ProcessingFormat.CSV
            )

        assert processing_job_id is not None

        # Step 2: Create dataset in training data manager
        metadata = DatasetMetadata(
            name="integration_test_dataset",
            description="Integration test dataset",
            dataset_type=DatasetType.TABULAR,
            file_path=sample_csv_data,
            total_rows=1000,
            total_columns=6,
            size_bytes=50000,
            schema_info={}
        )

        with patch('app.services.training_data_manager.get_async_session'):
            dataset_id = await training_data_manager.create_dataset(
                metadata=metadata,
                user_id=uuid.uuid4()
            )

        assert dataset_id is not None

        # Step 3: Monitor data quality
        quality_config = QualityConfig(
            checks_to_run=[QualityCheckType.MISSING_VALUES, QualityCheckType.COMPLETENESS],
            report_format=ReportFormat.JSON
        )

        with patch('app.services.realtime_quality_monitor.get_async_session'):
            quality_job_id = await quality_monitor.monitor_training_data_quality(
                dataset_path=sample_csv_data,
                config=quality_config,
                dataset_id=uuid.UUID(dataset_id)
            )

        assert quality_job_id is not None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])