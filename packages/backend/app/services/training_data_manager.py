"""
Training Data Manager - Dataset Versioning, Splitting, and Provenance
====================================================================

Service for managing training datasets with versioning, splitting strategies,
and comprehensive provenance tracking for ML workflows.

Key Features:
- Dataset versioning with hash-based integrity checks
- Multiple splitting strategies: random, stratified, temporal
- Provenance tracking for full data lineage
- Storage of dataset metadata in PostgreSQL
- Efficient handling of large datasets
- Integration with distributed processing pipeline
"""

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedShuffleSplit
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import selectinload
from app.database.connection import get_async_session
from app.database.models import Dataset, DatasetVersion, User, Organization, JobStatus
from app.services.distributed_processor import distributed_processor, ProcessingFormat

logger = logging.getLogger(__name__)

class SplitStrategy(str, Enum):
    """Dataset splitting strategies"""
    RANDOM = "random"
    STRATIFIED = "stratified"
    TEMPORAL = "temporal"
    CUSTOM = "custom"

class DatasetType(str, Enum):
    """Types of datasets for different ML tasks"""
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    TIME_SERIES = "time_series"
    TEXT = "text"
    IMAGE = "image"
    TABULAR = "tabular"
    MULTIMODAL = "multimodal"

@dataclass
class SplitConfig:
    """Configuration for dataset splitting"""
    strategy: SplitStrategy
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15

    # Stratified splitting
    target_column: Optional[str] = None
    stratify_by: Optional[List[str]] = None

    # Temporal splitting
    time_column: Optional[str] = None
    split_date: Optional[str] = None

    # Random seed for reproducibility
    random_seed: int = 42

    # Custom splitting
    custom_split_function: Optional[str] = None

    def __post_init__(self):
        """Validate split ratios"""
        total_ratio = self.train_ratio + self.val_ratio + self.test_ratio
        if abs(total_ratio - 1.0) > 0.001:
            raise ValueError(f"Split ratios must sum to 1.0, got {total_ratio}")

@dataclass
class DatasetMetadata:
    """Comprehensive dataset metadata"""
    name: str
    description: str
    dataset_type: DatasetType
    file_path: str

    # Data characteristics
    total_rows: int
    total_columns: int
    size_bytes: int
    schema_info: Dict[str, Any]

    # Quality metrics
    quality_score: Optional[float] = None
    completeness_score: Optional[float] = None

    # Provenance
    source_datasets: List[str] = field(default_factory=list)
    transformations: List[str] = field(default_factory=list)
    processing_history: List[Dict[str, Any]] = field(default_factory=list)

    # Tags and annotations
    tags: List[str] = field(default_factory=list)
    annotations: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DatasetSplit:
    """Information about a dataset split"""
    split_id: str
    dataset_version_id: str
    split_config: SplitConfig

    # Split file paths
    train_path: str
    val_path: str
    test_path: str

    # Split statistics
    train_rows: int
    val_rows: int
    test_rows: int

    # Quality scores for each split
    train_quality: Optional[float] = None
    val_quality: Optional[float] = None
    test_quality: Optional[float] = None

    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    provenance: Dict[str, Any] = field(default_factory=dict)

class TrainingDataManager:
    """
    Comprehensive training data management service.

    Handles dataset versioning, splitting strategies, and provenance tracking
    for ML training workflows.
    """

    def __init__(self):
        self.supported_formats = [".csv", ".parquet", ".jsonl", ".tsv"]
        self.default_storage_path = Path("data/training_datasets")
        self.default_storage_path.mkdir(parents=True, exist_ok=True)

    async def create_dataset(
        self,
        metadata: DatasetMetadata,
        user_id: uuid.UUID,
        organization_id: Optional[uuid.UUID] = None,
        auto_version: bool = True
    ) -> str:
        """
        Create a new dataset with versioning.

        Args:
            metadata: Dataset metadata including file path and characteristics
            user_id: ID of user creating the dataset
            organization_id: Optional organization ID
            auto_version: Whether to automatically create first version

        Returns:
            Dataset ID
        """
        try:
            # Validate file exists and get file hash
            file_path = Path(metadata.file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"Dataset file not found: {metadata.file_path}")

            file_hash = await self._calculate_file_hash(metadata.file_path)

            # Check if dataset with same hash already exists
            existing_dataset = await self._find_dataset_by_hash(file_hash)
            if existing_dataset:
                logger.info(f"Dataset with hash {file_hash} already exists: {existing_dataset}")
                return str(existing_dataset)

            async with get_async_session() as session:
                # Create dataset record
                dataset = Dataset(
                    name=metadata.name,
                    title=metadata.name,
                    description=metadata.description,
                    category=self._map_dataset_type_to_category(metadata.dataset_type),
                    format=self._detect_format_from_path(metadata.file_path),
                    size_bytes=metadata.size_bytes,
                    row_count=metadata.total_rows,
                    column_count=metadata.total_columns,
                    schema_info=metadata.schema_info,
                    quality_score=metadata.quality_score,
                    tags=metadata.tags,
                    file_path=metadata.file_path,
                    created_by_id=user_id,
                    organization_id=organization_id
                )

                session.add(dataset)
                await session.flush()  # Get the ID

                dataset_id = dataset.id

                # Create first version if requested
                if auto_version:
                    version_id = await self.create_dataset_version(
                        dataset_id=dataset_id,
                        file_path=metadata.file_path,
                        version="1.0.0",
                        description="Initial version",
                        user_id=user_id,
                        metadata=metadata,
                        session=session
                    )
                    logger.info(f"Created dataset version {version_id}")

                await session.commit()

                logger.info(f"Created dataset {dataset_id} with file hash {file_hash}")
                return str(dataset_id)

        except Exception as e:
            logger.error(f"Failed to create dataset: {e}")
            raise

    async def create_dataset_version(
        self,
        dataset_id: uuid.UUID,
        file_path: str,
        version: str,
        description: str,
        user_id: uuid.UUID,
        metadata: Optional[DatasetMetadata] = None,
        session: Optional[AsyncSession] = None
    ) -> str:
        """
        Create a new version of an existing dataset.

        Args:
            dataset_id: ID of the parent dataset
            file_path: Path to the new version file
            version: Version string (e.g., "1.1.0")
            description: Description of changes in this version
            user_id: ID of user creating the version
            metadata: Optional metadata for this version
            session: Optional database session

        Returns:
            Version ID
        """
        try:
            file_hash = await self._calculate_file_hash(file_path)
            file_path_obj = Path(file_path)

            # Get file statistics
            file_stats = file_path_obj.stat()

            # Analyze dataset if metadata not provided
            if metadata is None:
                metadata = await self._analyze_dataset(file_path)

            use_external_session = session is not None
            if not use_external_session:
                session = get_async_session().__aenter__()
                await session.__aenter__()

            try:
                # Create version record
                dataset_version = DatasetVersion(
                    dataset_id=dataset_id,
                    version=version,
                    description=description,
                    size_bytes=file_stats.st_size,
                    row_count=metadata.total_rows if metadata else None,
                    column_count=metadata.total_columns if metadata else None,
                    schema_info=metadata.schema_info if metadata else {},
                    file_path=file_path,
                    quality_score=metadata.quality_score if metadata else None,
                    created_by_id=user_id
                )

                session.add(dataset_version)
                await session.flush()

                version_id = dataset_version.id

                if not use_external_session:
                    await session.commit()

                logger.info(f"Created dataset version {version_id} for dataset {dataset_id}")
                return str(version_id)

            finally:
                if not use_external_session:
                    await session.__aexit__(None, None, None)

        except Exception as e:
            logger.error(f"Failed to create dataset version: {e}")
            raise

    async def create_dataset_split(
        self,
        dataset_version_id: uuid.UUID,
        split_config: SplitConfig,
        output_dir: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None
    ) -> DatasetSplit:
        """
        Create train/validation/test splits for a dataset version.

        Args:
            dataset_version_id: ID of the dataset version to split
            split_config: Configuration for splitting strategy
            output_dir: Directory to store split files
            user_id: Optional user ID for tracking

        Returns:
            DatasetSplit object with paths and metadata
        """
        try:
            # Get dataset version information
            async with get_async_session() as session:
                stmt = (
                    select(DatasetVersion)
                    .options(selectinload(DatasetVersion.dataset))
                    .where(DatasetVersion.id == dataset_version_id)
                )
                result = await session.execute(stmt)
                dataset_version = result.scalar_one_or_none()

                if not dataset_version:
                    raise ValueError(f"Dataset version {dataset_version_id} not found")

            # Load dataset
            df = await self._load_dataset(dataset_version.file_path)

            # Create output directory
            if output_dir is None:
                output_dir = self.default_storage_path / "splits" / str(dataset_version_id)
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

            # Perform splitting based on strategy
            splits = await self._split_dataset(df, split_config)

            # Save splits to files
            split_id = str(uuid.uuid4())
            train_path = output_dir / f"{split_id}_train.parquet"
            val_path = output_dir / f"{split_id}_val.parquet"
            test_path = output_dir / f"{split_id}_test.parquet"

            # Save using efficient format
            splits['train'].to_parquet(train_path, compression='snappy')
            splits['val'].to_parquet(val_path, compression='snappy')
            splits['test'].to_parquet(test_path, compression='snappy')

            # Calculate quality scores for each split
            train_quality = await self._calculate_split_quality(splits['train'])
            val_quality = await self._calculate_split_quality(splits['val'])
            test_quality = await self._calculate_split_quality(splits['test'])

            # Create DatasetSplit object
            dataset_split = DatasetSplit(
                split_id=split_id,
                dataset_version_id=str(dataset_version_id),
                split_config=split_config,
                train_path=str(train_path),
                val_path=str(val_path),
                test_path=str(test_path),
                train_rows=len(splits['train']),
                val_rows=len(splits['val']),
                test_rows=len(splits['test']),
                train_quality=train_quality,
                val_quality=val_quality,
                test_quality=test_quality,
                provenance={
                    "dataset_version_id": str(dataset_version_id),
                    "split_strategy": split_config.strategy.value,
                    "created_by": str(user_id) if user_id else None,
                    "split_config": split_config.__dict__
                }
            )

            # Store split metadata in database (extend ProcessingJob for now)
            await self._store_split_metadata(dataset_split)

            logger.info(f"Created dataset split {split_id} for version {dataset_version_id}")
            return dataset_split

        except Exception as e:
            logger.error(f"Failed to create dataset split: {e}")
            raise

    async def get_dataset_versions(
        self,
        dataset_id: uuid.UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get all versions of a dataset.

        Args:
            dataset_id: ID of the dataset
            limit: Maximum number of versions to return

        Returns:
            List of dataset version information
        """
        try:
            async with get_async_session() as session:
                stmt = (
                    select(DatasetVersion)
                    .where(DatasetVersion.dataset_id == dataset_id)
                    .order_by(DatasetVersion.created_at.desc())
                    .limit(limit)
                )
                result = await session.execute(stmt)
                versions = result.scalars().all()

                return [
                    {
                        "version_id": str(version.id),
                        "version": version.version,
                        "description": version.description,
                        "size_bytes": version.size_bytes,
                        "row_count": version.row_count,
                        "column_count": version.column_count,
                        "quality_score": version.quality_score,
                        "file_path": version.file_path,
                        "created_at": version.created_at.isoformat() if version.created_at else None,
                        "created_by_id": str(version.created_by_id)
                    }
                    for version in versions
                ]

        except Exception as e:
            logger.error(f"Failed to get dataset versions: {e}")
            raise

    async def get_dataset_provenance(
        self,
        dataset_id: uuid.UUID,
        include_transformations: bool = True
    ) -> Dict[str, Any]:
        """
        Get comprehensive provenance information for a dataset.

        Args:
            dataset_id: ID of the dataset
            include_transformations: Whether to include transformation history

        Returns:
            Provenance information including lineage and transformations
        """
        try:
            async with get_async_session() as session:
                # Get dataset with versions
                stmt = (
                    select(Dataset)
                    .options(selectinload(Dataset.versions))
                    .where(Dataset.id == dataset_id)
                )
                result = await session.execute(stmt)
                dataset = result.scalar_one_or_none()

                if not dataset:
                    raise ValueError(f"Dataset {dataset_id} not found")

                # Build provenance tree
                provenance = {
                    "dataset_id": str(dataset.id),
                    "name": dataset.name,
                    "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
                    "created_by": str(dataset.created_by_id),
                    "versions": [
                        {
                            "version_id": str(version.id),
                            "version": version.version,
                            "created_at": version.created_at.isoformat() if version.created_at else None,
                            "size_bytes": version.size_bytes,
                            "quality_score": version.quality_score
                        }
                        for version in dataset.versions
                    ],
                    "lineage": await self._build_dataset_lineage(dataset_id),
                }

                if include_transformations:
                    provenance["transformations"] = await self._get_transformation_history(dataset_id)

                return provenance

        except Exception as e:
            logger.error(f"Failed to get dataset provenance: {e}")
            raise

    async def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of file for integrity checking"""
        hash_sha256 = hashlib.sha256()

        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)

        return hash_sha256.hexdigest()

    async def _find_dataset_by_hash(self, file_hash: str) -> Optional[uuid.UUID]:
        """Find existing dataset by file hash"""
        # For now, we'll store hash in dataset metadata
        # In a production system, you'd have a dedicated hash table
        try:
            async with get_async_session() as session:
                stmt = select(Dataset).where(Dataset.schema_info.contains({"file_hash": file_hash}))
                result = await session.execute(stmt)
                dataset = result.scalar_one_or_none()
                return dataset.id if dataset else None
        except:
            return None

    async def _analyze_dataset(self, file_path: str) -> DatasetMetadata:
        """Analyze dataset to extract metadata"""
        try:
            file_path_obj = Path(file_path)

            # Load sample for analysis
            df = await self._load_dataset(file_path, sample_size=10000)

            # Basic statistics
            total_rows = len(df)
            total_columns = len(df.columns)
            size_bytes = file_path_obj.stat().st_size

            # Schema information
            schema_info = {
                "columns": [
                    {
                        "name": col,
                        "dtype": str(df[col].dtype),
                        "null_count": int(df[col].isnull().sum()),
                        "unique_count": int(df[col].nunique())
                    }
                    for col in df.columns
                ],
                "file_hash": await self._calculate_file_hash(file_path)
            }

            # Quality score
            null_percentage = (df.isnull().sum().sum() / (total_rows * total_columns)) * 100
            quality_score = max(0, 100 - null_percentage)

            return DatasetMetadata(
                name=file_path_obj.stem,
                description=f"Auto-analyzed dataset from {file_path_obj.name}",
                dataset_type=DatasetType.TABULAR,  # Default assumption
                file_path=file_path,
                total_rows=total_rows,
                total_columns=total_columns,
                size_bytes=size_bytes,
                schema_info=schema_info,
                quality_score=quality_score,
                completeness_score=100 - null_percentage
            )

        except Exception as e:
            logger.error(f"Failed to analyze dataset: {e}")
            raise

    async def _load_dataset(self, file_path: str, sample_size: Optional[int] = None) -> pd.DataFrame:
        """Load dataset from file path"""
        file_path_obj = Path(file_path)
        file_format = file_path_obj.suffix.lower()

        try:
            if file_format == '.csv':
                df = pd.read_csv(file_path, nrows=sample_size)
            elif file_format == '.parquet':
                df = pd.read_parquet(file_path)
                if sample_size:
                    df = df.head(sample_size)
            elif file_format == '.jsonl':
                lines = []
                with open(file_path, 'r') as f:
                    for i, line in enumerate(f):
                        if sample_size and i >= sample_size:
                            break
                        lines.append(json.loads(line.strip()))
                df = pd.DataFrame(lines)
            else:
                raise ValueError(f"Unsupported file format: {file_format}")

            return df

        except Exception as e:
            logger.error(f"Failed to load dataset from {file_path}: {e}")
            raise

    async def _split_dataset(
        self,
        df: pd.DataFrame,
        split_config: SplitConfig
    ) -> Dict[str, pd.DataFrame]:
        """Split dataset according to configuration"""
        try:
            if split_config.strategy == SplitStrategy.RANDOM:
                return await self._random_split(df, split_config)
            elif split_config.strategy == SplitStrategy.STRATIFIED:
                return await self._stratified_split(df, split_config)
            elif split_config.strategy == SplitStrategy.TEMPORAL:
                return await self._temporal_split(df, split_config)
            else:
                raise ValueError(f"Unsupported split strategy: {split_config.strategy}")

        except Exception as e:
            logger.error(f"Failed to split dataset: {e}")
            raise

    async def _random_split(
        self,
        df: pd.DataFrame,
        split_config: SplitConfig
    ) -> Dict[str, pd.DataFrame]:
        """Perform random splitting"""
        # First split: train vs (val + test)
        train_df, temp_df = train_test_split(
            df,
            test_size=(split_config.val_ratio + split_config.test_ratio),
            random_state=split_config.random_seed
        )

        # Second split: val vs test
        val_size = split_config.val_ratio / (split_config.val_ratio + split_config.test_ratio)
        val_df, test_df = train_test_split(
            temp_df,
            test_size=(1 - val_size),
            random_state=split_config.random_seed
        )

        return {
            'train': train_df,
            'val': val_df,
            'test': test_df
        }

    async def _stratified_split(
        self,
        df: pd.DataFrame,
        split_config: SplitConfig
    ) -> Dict[str, pd.DataFrame]:
        """Perform stratified splitting"""
        if not split_config.target_column:
            raise ValueError("target_column required for stratified splitting")

        if split_config.target_column not in df.columns:
            raise ValueError(f"Target column {split_config.target_column} not found in dataset")

        y = df[split_config.target_column]

        # Use StratifiedShuffleSplit for more control
        splitter = StratifiedShuffleSplit(
            n_splits=1,
            test_size=(split_config.val_ratio + split_config.test_ratio),
            random_state=split_config.random_seed
        )

        train_idx, temp_idx = next(splitter.split(df, y))
        train_df = df.iloc[train_idx]
        temp_df = df.iloc[temp_idx]
        temp_y = y.iloc[temp_idx]

        # Split temp into val and test
        val_size = split_config.val_ratio / (split_config.val_ratio + split_config.test_ratio)
        val_df, test_df = train_test_split(
            temp_df,
            test_size=(1 - val_size),
            stratify=temp_y,
            random_state=split_config.random_seed
        )

        return {
            'train': train_df,
            'val': val_df,
            'test': test_df
        }

    async def _temporal_split(
        self,
        df: pd.DataFrame,
        split_config: SplitConfig
    ) -> Dict[str, pd.DataFrame]:
        """Perform temporal splitting"""
        if not split_config.time_column:
            raise ValueError("time_column required for temporal splitting")

        if split_config.time_column not in df.columns:
            raise ValueError(f"Time column {split_config.time_column} not found in dataset")

        # Convert time column to datetime if needed
        df = df.copy()
        df[split_config.time_column] = pd.to_datetime(df[split_config.time_column])

        # Sort by time
        df = df.sort_values(split_config.time_column)

        # Calculate split indices based on time
        total_rows = len(df)
        train_end = int(total_rows * split_config.train_ratio)
        val_end = int(total_rows * (split_config.train_ratio + split_config.val_ratio))

        train_df = df.iloc[:train_end]
        val_df = df.iloc[train_end:val_end]
        test_df = df.iloc[val_end:]

        return {
            'train': train_df,
            'val': val_df,
            'test': test_df
        }

    async def _calculate_split_quality(self, df: pd.DataFrame) -> float:
        """Calculate quality score for a dataset split"""
        try:
            if len(df) == 0:
                return 0.0

            # Basic quality metrics
            total_cells = len(df) * len(df.columns)
            null_cells = df.isnull().sum().sum()
            null_percentage = (null_cells / total_cells) * 100

            # Quality score based on completeness
            quality_score = max(0, 100 - null_percentage)

            return quality_score

        except Exception as e:
            logger.warning(f"Failed to calculate split quality: {e}")
            return None

    async def _store_split_metadata(self, dataset_split: DatasetSplit):
        """Store split metadata in database"""
        try:
            async with get_async_session() as session:
                # For now, store in ProcessingJob table with job_type "dataset_split"
                # In production, you'd create a dedicated DatasetSplit table
                from app.database.models import ProcessingJob

                job = ProcessingJob(
                    id=uuid.UUID(dataset_split.split_id),
                    job_type="dataset_split",
                    config={
                        "dataset_version_id": dataset_split.dataset_version_id,
                        "split_config": dataset_split.split_config.__dict__,
                        "train_path": dataset_split.train_path,
                        "val_path": dataset_split.val_path,
                        "test_path": dataset_split.test_path,
                        "train_rows": dataset_split.train_rows,
                        "val_rows": dataset_split.val_rows,
                        "test_rows": dataset_split.test_rows,
                        "train_quality": dataset_split.train_quality,
                        "val_quality": dataset_split.val_quality,
                        "test_quality": dataset_split.test_quality,
                        "provenance": dataset_split.provenance
                    },
                    status=JobStatus.COMPLETED
                )

                session.add(job)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to store split metadata: {e}")

    async def _build_dataset_lineage(self, dataset_id: uuid.UUID) -> Dict[str, Any]:
        """Build dataset lineage graph"""
        # Simplified lineage - in production you'd have a more sophisticated graph
        return {
            "parent_datasets": [],
            "derived_datasets": [],
            "transformation_chain": []
        }

    async def _get_transformation_history(self, dataset_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Get transformation history for dataset"""
        # Placeholder for transformation tracking
        return []

    def _map_dataset_type_to_category(self, dataset_type: DatasetType):
        """Map DatasetType to database category enum"""
        from app.database.models import DatasetCategory

        mapping = {
            DatasetType.CLASSIFICATION: DatasetCategory.TABULAR,
            DatasetType.REGRESSION: DatasetCategory.TABULAR,
            DatasetType.TIME_SERIES: DatasetCategory.TIMESERIES,
            DatasetType.TEXT: DatasetCategory.TEXT,
            DatasetType.IMAGE: DatasetCategory.IMAGE,
            DatasetType.TABULAR: DatasetCategory.TABULAR,
            DatasetType.MULTIMODAL: DatasetCategory.MULTIMODAL
        }

        return mapping.get(dataset_type, DatasetCategory.TABULAR)

    def _detect_format_from_path(self, file_path: str):
        """Detect file format from path"""
        from app.database.models import DatasetFormat

        suffix = Path(file_path).suffix.lower()

        mapping = {
            '.csv': DatasetFormat.CSV,
            '.parquet': DatasetFormat.PARQUET,
            '.jsonl': DatasetFormat.JSONL,
            '.json': DatasetFormat.JSON,
            '.tsv': DatasetFormat.CSV  # Treat TSV as CSV variant
        }

        return mapping.get(suffix, DatasetFormat.CSV)

# Global instance
training_data_manager = TrainingDataManager()