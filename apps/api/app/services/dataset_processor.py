"""
Dataset Processor Service
========================

Advanced dataset processing service for the Dataset Marketplace.
Handles format conversion, preprocessing, and ML-ready transformations.

Features:
- Multi-format data conversion (CSV, JSON, Parquet, Excel, etc.)
- Automated preprocessing pipelines
- ML-ready format generation
- Data validation and cleaning
- Train/validation/test split generation
- Feature engineering and transformation
- Large dataset streaming and chunked processing
- Cloud storage integration
- Processing job management and monitoring
- Custom transformation pipelines
"""

import os
import json
import logging
import asyncio
import uuid
import hashlib
import shutil
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union, AsyncGenerator
from dataclasses import dataclass, asdict
from enum import Enum
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile

# Format-specific libraries
try:
    import pyarrow.parquet as pq
    import pyarrow as pa
    PARQUET_AVAILABLE = True
except ImportError:
    PARQUET_AVAILABLE = False

try:
    import h5py
    HDF5_AVAILABLE = True
except ImportError:
    HDF5_AVAILABLE = False

try:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder
    from sklearn.impute import SimpleImputer
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# Database integration
try:
    from app.models.dataset_marketplace import (
        DatasetProcessingJob, ProcessingStatus, DataFormat, Dataset
    )
    from app.services.dataset_quality_analyzer import DatasetQualityAnalyzer
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False

logger = logging.getLogger(__name__)


# Enums and Data Classes
class ProcessingType(str, Enum):
    """Types of dataset processing operations."""
    FORMAT_CONVERSION = "format_conversion"
    QUALITY_ASSESSMENT = "quality_assessment"
    PREPROCESSING = "preprocessing"
    FEATURE_ENGINEERING = "feature_engineering"
    TRAIN_TEST_SPLIT = "train_test_split"
    NORMALIZATION = "normalization"
    IMPUTATION = "imputation"
    ENCODING = "encoding"
    SAMPLING = "sampling"
    VALIDATION = "validation"


class ProcessingEngine(str, Enum):
    """Processing engines for different operations."""
    PANDAS = "pandas"
    DASK = "dask"
    SPARK = "spark"
    ARROW = "arrow"
    NUMPY = "numpy"


@dataclass
class ProcessingConfig:
    """Configuration for dataset processing operations."""
    processing_type: ProcessingType
    source_format: DataFormat
    target_format: DataFormat
    
    # Processing parameters
    chunk_size: int = 10000
    engine: ProcessingEngine = ProcessingEngine.PANDAS
    parameters: Dict[str, Any] = None
    
    # Resource configuration
    max_memory_gb: float = 4.0
    max_workers: int = 4
    timeout_minutes: int = 60
    
    # Output configuration
    output_compression: Optional[str] = None
    output_options: Dict[str, Any] = None
    
    # Validation settings
    validate_output: bool = True
    quality_check: bool = True
    
    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}
        if self.output_options is None:
            self.output_options = {}


@dataclass
class ProcessingResult:
    """Result of dataset processing operation."""
    job_id: str
    success: bool
    
    # Output information
    output_path: str
    output_format: DataFormat
    output_size_bytes: int
    
    # Processing metrics
    processing_time_seconds: float
    rows_processed: int
    rows_output: int
    memory_usage_peak_gb: float
    
    # Quality metrics
    quality_score: Optional[float] = None
    quality_issues: List[str] = None
    
    # Error information
    error_message: Optional[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.quality_issues is None:
            self.quality_issues = []
        if self.warnings is None:
            self.warnings = []


class DatasetProcessor:
    """
    Advanced dataset processor handling format conversion, preprocessing,
    and ML-ready transformations with support for large datasets.
    """
    
    def __init__(self, 
                 storage_backend: str = "local",
                 storage_config: Dict[str, Any] = None,
                 temp_dir: str = None):
        
        self.storage_backend = storage_backend
        self.storage_config = storage_config or {}
        self.temp_dir = temp_dir or tempfile.gettempdir()
        
        # Processing capabilities
        self.format_readers = self._initialize_format_readers()
        self.format_writers = self._initialize_format_writers()
        
        # Processing engines
        self.engines = {
            ProcessingEngine.PANDAS: self._process_with_pandas,
            ProcessingEngine.NUMPY: self._process_with_numpy,
        }
        
        # Add advanced engines if available
        try:
            import dask.dataframe as dd
            self.engines[ProcessingEngine.DASK] = self._process_with_dask
        except ImportError:
            pass
        
        # Quality analyzer
        self.quality_analyzer = DatasetQualityAnalyzer() if MODELS_AVAILABLE else None
        
        logger.info(f"Dataset processor initialized with {len(self.format_readers)} readers and {len(self.format_writers)} writers")
    
    def _initialize_format_readers(self) -> Dict[DataFormat, callable]:
        """Initialize format-specific readers."""
        readers = {
            DataFormat.CSV: self._read_csv,
            DataFormat.JSON: self._read_json,
            DataFormat.JSONL: self._read_jsonl,
            DataFormat.XLSX: self._read_excel,
            DataFormat.TXT: self._read_text,
        }
        
        if PARQUET_AVAILABLE:
            readers[DataFormat.PARQUET] = self._read_parquet
        
        if HDF5_AVAILABLE:
            readers[DataFormat.HDF5] = self._read_hdf5
        
        return readers
    
    def _initialize_format_writers(self) -> Dict[DataFormat, callable]:
        """Initialize format-specific writers."""
        writers = {
            DataFormat.CSV: self._write_csv,
            DataFormat.JSON: self._write_json,
            DataFormat.JSONL: self._write_jsonl,
            DataFormat.XLSX: self._write_excel,
        }
        
        if PARQUET_AVAILABLE:
            writers[DataFormat.PARQUET] = self._write_parquet
        
        if HDF5_AVAILABLE:
            writers[DataFormat.HDF5] = self._write_hdf5
        
        return writers
    
    async def process_dataset(self,
                            input_path: str,
                            output_path: str,
                            config: ProcessingConfig,
                            dataset_id: str = None) -> ProcessingResult:
        """
        Process a dataset according to configuration.
        
        Args:
            input_path: Path to input dataset
            output_path: Path for output dataset
            config: Processing configuration
            dataset_id: Optional dataset ID for tracking
            
        Returns:
            Processing result with metrics and output info
        """
        job_id = str(uuid.uuid4())
        start_time = datetime.utcnow()
        
        logger.info(f"Starting dataset processing job {job_id}")
        logger.info(f"Processing type: {config.processing_type}")
        logger.info(f"Input: {input_path} ({config.source_format})")
        logger.info(f"Output: {output_path} ({config.target_format})")
        
        try:
            # Validate input
            if not os.path.exists(input_path):
                raise FileNotFoundError(f"Input file not found: {input_path}")
            
            # Create output directory if needed
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Load data
            logger.info("Loading input dataset...")
            data = await self._load_dataset(input_path, config.source_format, config)
            original_rows = len(data)
            
            logger.info(f"Loaded dataset: {len(data)} rows, {len(data.columns)} columns")
            
            # Apply processing based on type
            processed_data = await self._apply_processing(data, config)
            processed_rows = len(processed_data)
            
            logger.info(f"Processing complete: {processed_rows} rows output")
            
            # Save processed data
            logger.info(f"Saving to {config.target_format} format...")
            await self._save_dataset(processed_data, output_path, config.target_format, config)
            
            # Calculate metrics
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            output_size = os.path.getsize(output_path)
            
            # Quality assessment if enabled
            quality_score = None
            quality_issues = []
            
            if config.quality_check and self.quality_analyzer:
                try:
                    quality_results = await self.quality_analyzer.analyze_dataset_quality(
                        processed_data, save_to_db=False
                    )
                    quality_score = quality_results.get('overall_quality_score')
                    quality_issues = quality_results.get('recommendations', [])
                except Exception as e:
                    logger.warning(f"Quality assessment failed: {str(e)}")
            
            # Create result
            result = ProcessingResult(
                job_id=job_id,
                success=True,
                output_path=output_path,
                output_format=config.target_format,
                output_size_bytes=output_size,
                processing_time_seconds=processing_time,
                rows_processed=original_rows,
                rows_output=processed_rows,
                memory_usage_peak_gb=0.0,  # Would need memory monitoring
                quality_score=quality_score,
                quality_issues=quality_issues
            )
            
            logger.info(f"Processing job {job_id} completed successfully in {processing_time:.2f} seconds")
            return result
            
        except Exception as e:
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            error_msg = f"Processing failed: {str(e)}"
            logger.error(error_msg)
            
            return ProcessingResult(
                job_id=job_id,
                success=False,
                output_path="",
                output_format=config.target_format,
                output_size_bytes=0,
                processing_time_seconds=processing_time,
                rows_processed=0,
                rows_output=0,
                memory_usage_peak_gb=0.0,
                error_message=error_msg
            )
    
    async def convert_format(self,
                           input_path: str,
                           output_path: str,
                           source_format: DataFormat,
                           target_format: DataFormat,
                           conversion_options: Dict[str, Any] = None) -> ProcessingResult:
        """Convert dataset from one format to another."""
        
        config = ProcessingConfig(
            processing_type=ProcessingType.FORMAT_CONVERSION,
            source_format=source_format,
            target_format=target_format,
            parameters=conversion_options or {}
        )
        
        return await self.process_dataset(input_path, output_path, config)
    
    async def create_ml_ready_dataset(self,
                                    input_path: str,
                                    output_path: str,
                                    source_format: DataFormat,
                                    target_column: str = None,
                                    test_size: float = 0.2,
                                    validation_size: float = 0.1,
                                    preprocessing_steps: List[str] = None) -> Dict[str, ProcessingResult]:
        """Create ML-ready dataset with train/validation/test splits."""
        
        logger.info("Creating ML-ready dataset with splits")
        
        # Load original dataset
        data = await self._load_dataset(input_path, source_format, ProcessingConfig(
            processing_type=ProcessingType.PREPROCESSING,
            source_format=source_format,
            target_format=DataFormat.CSV
        ))
        
        # Apply preprocessing
        if preprocessing_steps:
            config = ProcessingConfig(
                processing_type=ProcessingType.PREPROCESSING,
                source_format=source_format,
                target_format=DataFormat.CSV,
                parameters={'steps': preprocessing_steps}
            )
            data = await self._apply_processing(data, config)
        
        # Create splits
        results = {}
        
        if target_column and target_column in data.columns:
            # Supervised learning splits
            X = data.drop(columns=[target_column])
            y = data[target_column]
            
            # First split: train+val vs test
            X_temp, X_test, y_temp, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=y if y.dtype == 'object' else None
            )
            
            # Second split: train vs validation
            val_size_adjusted = validation_size / (1 - test_size)
            X_train, X_val, y_train, y_val = train_test_split(
                X_temp, y_temp, test_size=val_size_adjusted, random_state=42,
                stratify=y_temp if y_temp.dtype == 'object' else None
            )
            
            # Combine X and y for each split
            train_data = pd.concat([X_train, y_train], axis=1)
            val_data = pd.concat([X_val, y_val], axis=1)
            test_data = pd.concat([X_test, y_test], axis=1)
            
        else:
            # Unsupervised learning splits (random)
            train_temp, test_data = train_test_split(data, test_size=test_size, random_state=42)
            val_size_adjusted = validation_size / (1 - test_size)
            train_data, val_data = train_test_split(train_temp, test_size=val_size_adjusted, random_state=42)
        
        # Save each split
        splits = {
            'train': train_data,
            'validation': val_data,
            'test': test_data
        }
        
        for split_name, split_data in splits.items():
            split_output_path = output_path.replace('.', f'_{split_name}.')
            
            config = ProcessingConfig(
                processing_type=ProcessingType.TRAIN_TEST_SPLIT,
                source_format=source_format,
                target_format=DataFormat.CSV,
                parameters={'split': split_name}
            )
            
            await self._save_dataset(split_data, split_output_path, DataFormat.CSV, config)
            
            results[split_name] = ProcessingResult(
                job_id=str(uuid.uuid4()),
                success=True,
                output_path=split_output_path,
                output_format=DataFormat.CSV,
                output_size_bytes=os.path.getsize(split_output_path),
                processing_time_seconds=0,
                rows_processed=len(data),
                rows_output=len(split_data),
                memory_usage_peak_gb=0.0
            )
        
        logger.info(f"Created ML-ready dataset with splits: train({len(train_data)}), val({len(val_data)}), test({len(test_data)})")
        return results
    
    async def _load_dataset(self, 
                          file_path: str, 
                          file_format: DataFormat, 
                          config: ProcessingConfig) -> pd.DataFrame:
        """Load dataset from file in specified format."""
        
        if file_format not in self.format_readers:
            raise ValueError(f"Unsupported input format: {file_format}")
        
        reader_func = self.format_readers[file_format]
        return await reader_func(file_path, config)
    
    async def _save_dataset(self,
                          data: pd.DataFrame,
                          file_path: str,
                          file_format: DataFormat,
                          config: ProcessingConfig):
        """Save dataset to file in specified format."""
        
        if file_format not in self.format_writers:
            raise ValueError(f"Unsupported output format: {file_format}")
        
        writer_func = self.format_writers[file_format]
        await writer_func(data, file_path, config)
    
    async def _apply_processing(self,
                              data: pd.DataFrame,
                              config: ProcessingConfig) -> pd.DataFrame:
        """Apply processing operations based on configuration."""
        
        if config.processing_type == ProcessingType.FORMAT_CONVERSION:
            return data  # No processing needed for pure format conversion
        
        elif config.processing_type == ProcessingType.PREPROCESSING:
            return await self._apply_preprocessing(data, config)
        
        elif config.processing_type == ProcessingType.NORMALIZATION:
            return await self._apply_normalization(data, config)
        
        elif config.processing_type == ProcessingType.IMPUTATION:
            return await self._apply_imputation(data, config)
        
        elif config.processing_type == ProcessingType.ENCODING:
            return await self._apply_encoding(data, config)
        
        elif config.processing_type == ProcessingType.SAMPLING:
            return await self._apply_sampling(data, config)
        
        else:
            logger.warning(f"Unknown processing type: {config.processing_type}")
            return data
    
    async def _apply_preprocessing(self,
                                 data: pd.DataFrame,
                                 config: ProcessingConfig) -> pd.DataFrame:
        """Apply preprocessing pipeline."""
        
        steps = config.parameters.get('steps', [])
        processed_data = data.copy()
        
        for step in steps:
            if step == 'remove_duplicates':
                processed_data = processed_data.drop_duplicates()
            
            elif step == 'handle_missing_values':
                # Simple imputation strategy
                for col in processed_data.columns:
                    if processed_data[col].dtype in ['int64', 'float64']:
                        processed_data[col].fillna(processed_data[col].median(), inplace=True)
                    else:
                        processed_data[col].fillna(processed_data[col].mode().iloc[0] if not processed_data[col].mode().empty else 'Unknown', inplace=True)
            
            elif step == 'remove_outliers':
                # Remove outliers using IQR method for numeric columns
                for col in processed_data.select_dtypes(include=[np.number]).columns:
                    Q1 = processed_data[col].quantile(0.25)
                    Q3 = processed_data[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    processed_data = processed_data[(processed_data[col] >= lower_bound) & (processed_data[col] <= upper_bound)]
            
            elif step == 'standardize_columns':
                # Standardize column names
                processed_data.columns = [col.lower().replace(' ', '_').replace('-', '_') for col in processed_data.columns]
            
            elif step == 'remove_empty_columns':
                # Remove columns that are entirely empty
                processed_data = processed_data.dropna(axis=1, how='all')
            
        return processed_data
    
    async def _apply_normalization(self,
                                 data: pd.DataFrame,
                                 config: ProcessingConfig) -> pd.DataFrame:
        """Apply normalization to numeric columns."""
        
        if not SKLEARN_AVAILABLE:
            logger.warning("Scikit-learn not available, skipping normalization")
            return data
        
        method = config.parameters.get('method', 'standard')
        columns = config.parameters.get('columns', None)
        
        normalized_data = data.copy()
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        if columns:
            numeric_columns = [col for col in columns if col in numeric_columns]
        
        if method == 'standard':
            scaler = StandardScaler()
        elif method == 'minmax':
            scaler = MinMaxScaler()
        else:
            logger.warning(f"Unknown normalization method: {method}")
            return data
        
        if len(numeric_columns) > 0:
            normalized_data[numeric_columns] = scaler.fit_transform(data[numeric_columns])
        
        return normalized_data
    
    async def _apply_imputation(self,
                              data: pd.DataFrame,
                              config: ProcessingConfig) -> pd.DataFrame:
        """Apply missing value imputation."""
        
        if not SKLEARN_AVAILABLE:
            logger.warning("Scikit-learn not available, using simple imputation")
            return await self._simple_imputation(data, config)
        
        strategy = config.parameters.get('strategy', 'mean')
        
        imputed_data = data.copy()
        
        # Numeric columns
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) > 0:
            imputer = SimpleImputer(strategy=strategy if strategy in ['mean', 'median'] else 'mean')
            imputed_data[numeric_columns] = imputer.fit_transform(data[numeric_columns])
        
        # Categorical columns
        categorical_columns = data.select_dtypes(include=['object']).columns
        if len(categorical_columns) > 0:
            imputer = SimpleImputer(strategy='most_frequent')
            imputed_data[categorical_columns] = imputer.fit_transform(data[categorical_columns])
        
        return imputed_data
    
    async def _simple_imputation(self,
                               data: pd.DataFrame,
                               config: ProcessingConfig) -> pd.DataFrame:
        """Simple imputation without scikit-learn."""
        
        imputed_data = data.copy()
        
        for col in data.columns:
            if data[col].dtype in ['int64', 'float64']:
                imputed_data[col].fillna(data[col].median(), inplace=True)
            else:
                mode_val = data[col].mode()
                fill_val = mode_val.iloc[0] if not mode_val.empty else 'Unknown'
                imputed_data[col].fillna(fill_val, inplace=True)
        
        return imputed_data
    
    async def _apply_encoding(self,
                            data: pd.DataFrame,
                            config: ProcessingConfig) -> pd.DataFrame:
        """Apply encoding to categorical columns."""
        
        method = config.parameters.get('method', 'label')
        columns = config.parameters.get('columns', None)
        
        encoded_data = data.copy()
        categorical_columns = data.select_dtypes(include=['object']).columns
        
        if columns:
            categorical_columns = [col for col in columns if col in categorical_columns]
        
        if method == 'label' and SKLEARN_AVAILABLE:
            for col in categorical_columns:
                le = LabelEncoder()
                encoded_data[col] = le.fit_transform(data[col].astype(str))
        
        elif method == 'onehot':
            encoded_data = pd.get_dummies(data, columns=categorical_columns, prefix=categorical_columns)
        
        return encoded_data
    
    async def _apply_sampling(self,
                            data: pd.DataFrame,
                            config: ProcessingConfig) -> pd.DataFrame:
        """Apply data sampling."""
        
        method = config.parameters.get('method', 'random')
        sample_size = config.parameters.get('sample_size', 1000)
        
        if method == 'random':
            if sample_size < len(data):
                return data.sample(n=sample_size, random_state=42)
            else:
                return data
        
        elif method == 'head':
            return data.head(sample_size)
        
        elif method == 'stratified':
            target_column = config.parameters.get('target_column')
            if target_column and target_column in data.columns:
                # Stratified sampling maintaining class distribution
                return data.groupby(target_column, group_keys=False).apply(
                    lambda x: x.sample(min(len(x), sample_size // data[target_column].nunique()))
                )
            else:
                return data.sample(n=min(sample_size, len(data)), random_state=42)
        
        return data
    
    # Format-specific readers
    async def _read_csv(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read CSV file."""
        kwargs = config.parameters.get('read_options', {})
        return pd.read_csv(file_path, **kwargs)
    
    async def _read_json(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read JSON file."""
        kwargs = config.parameters.get('read_options', {})
        return pd.read_json(file_path, **kwargs)
    
    async def _read_jsonl(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read JSONL (newline-delimited JSON) file."""
        return pd.read_json(file_path, lines=True)
    
    async def _read_excel(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read Excel file."""
        kwargs = config.parameters.get('read_options', {})
        return pd.read_excel(file_path, **kwargs)
    
    async def _read_text(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read text file as single column."""
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        return pd.DataFrame({'text': [line.strip() for line in lines]})
    
    async def _read_parquet(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read Parquet file."""
        return pd.read_parquet(file_path)
    
    async def _read_hdf5(self, file_path: str, config: ProcessingConfig) -> pd.DataFrame:
        """Read HDF5 file."""
        key = config.parameters.get('key', 'data')
        return pd.read_hdf(file_path, key=key)
    
    # Format-specific writers
    async def _write_csv(self, data: pd.DataFrame, file_path: str, config: ProcessingConfig):
        """Write CSV file."""
        kwargs = config.output_options.copy()
        kwargs.setdefault('index', False)
        data.to_csv(file_path, **kwargs)
    
    async def _write_json(self, data: pd.DataFrame, file_path: str, config: ProcessingConfig):
        """Write JSON file."""
        kwargs = config.output_options.copy()
        orient = kwargs.pop('orient', 'records')
        data.to_json(file_path, orient=orient, **kwargs)
    
    async def _write_jsonl(self, data: pd.DataFrame, file_path: str, config: ProcessingConfig):
        """Write JSONL file."""
        data.to_json(file_path, orient='records', lines=True)
    
    async def _write_excel(self, data: pd.DataFrame, file_path: str, config: ProcessingConfig):
        """Write Excel file."""
        kwargs = config.output_options.copy()
        kwargs.setdefault('index', False)
        data.to_excel(file_path, **kwargs)
    
    async def _write_parquet(self, data: pd.DataFrame, file_path: str, config: ProcessingConfig):
        """Write Parquet file."""
        kwargs = config.output_options.copy()
        compression = config.output_compression or 'snappy'
        data.to_parquet(file_path, compression=compression, **kwargs)
    
    async def _write_hdf5(self, data: pd.DataFrame, file_path: str, config: ProcessingConfig):
        """Write HDF5 file."""
        key = config.output_options.get('key', 'data')
        data.to_hdf(file_path, key=key, mode='w')
    
    # Processing engine implementations
    async def _process_with_pandas(self, data: pd.DataFrame, config: ProcessingConfig) -> pd.DataFrame:
        """Process data using pandas."""
        return await self._apply_processing(data, config)
    
    async def _process_with_numpy(self, data: pd.DataFrame, config: ProcessingConfig) -> pd.DataFrame:
        """Process data using numpy operations."""
        # Convert to numpy, process, and convert back
        # This is a placeholder - would implement specific numpy operations
        return data
    
    async def _process_with_dask(self, data: pd.DataFrame, config: ProcessingConfig) -> pd.DataFrame:
        """Process data using Dask for large datasets."""
        try:
            import dask.dataframe as dd
            
            # Convert to Dask DataFrame
            dask_df = dd.from_pandas(data, npartitions=config.max_workers)
            
            # Apply processing (would need Dask-specific implementations)
            # For now, compute back to pandas
            return dask_df.compute()
        
        except ImportError:
            logger.warning("Dask not available, falling back to pandas")
            return await self._process_with_pandas(data, config)
    
    async def stream_process_large_dataset(self,
                                         input_path: str,
                                         output_path: str,
                                         config: ProcessingConfig,
                                         chunk_size: int = 10000) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream process large datasets in chunks.
        
        Yields progress information for each chunk processed.
        """
        
        job_id = str(uuid.uuid4())
        start_time = datetime.utcnow()
        total_rows_processed = 0
        chunk_count = 0
        
        logger.info(f"Starting streaming processing job {job_id}")
        
        try:
            # Initialize chunked reader
            if config.source_format == DataFormat.CSV:
                chunk_reader = pd.read_csv(input_path, chunksize=chunk_size)
            else:
                raise ValueError(f"Streaming not supported for format: {config.source_format}")
            
            # Process first chunk to get headers for output file
            first_chunk = True
            
            for chunk_data in chunk_reader:
                chunk_count += 1
                
                # Process chunk
                processed_chunk = await self._apply_processing(chunk_data, config)
                
                # Write chunk to output
                write_mode = 'w' if first_chunk else 'a'
                write_header = first_chunk
                
                if config.target_format == DataFormat.CSV:
                    processed_chunk.to_csv(
                        output_path, 
                        mode=write_mode, 
                        header=write_header, 
                        index=False
                    )
                else:
                    # For other formats, collect all chunks and write at the end
                    pass
                
                total_rows_processed += len(processed_chunk)
                first_chunk = False
                
                # Yield progress
                elapsed_time = (datetime.utcnow() - start_time).total_seconds()
                
                progress = {
                    'job_id': job_id,
                    'chunk_number': chunk_count,
                    'rows_in_chunk': len(chunk_data),
                    'rows_output_chunk': len(processed_chunk),
                    'total_rows_processed': total_rows_processed,
                    'elapsed_time_seconds': elapsed_time,
                    'processing_rate_rows_per_second': total_rows_processed / elapsed_time if elapsed_time > 0 else 0
                }
                
                yield progress
            
            # Final progress update
            total_time = (datetime.utcnow() - start_time).total_seconds()
            
            yield {
                'job_id': job_id,
                'status': 'completed',
                'total_chunks': chunk_count,
                'total_rows_processed': total_rows_processed,
                'total_time_seconds': total_time,
                'average_processing_rate': total_rows_processed / total_time if total_time > 0 else 0,
                'output_path': output_path
            }
            
        except Exception as e:
            error_time = (datetime.utcnow() - start_time).total_seconds()
            
            yield {
                'job_id': job_id,
                'status': 'failed',
                'error': str(e),
                'chunks_completed': chunk_count,
                'rows_processed_before_error': total_rows_processed,
                'elapsed_time_seconds': error_time
            }
    
    def get_supported_formats(self) -> Dict[str, List[DataFormat]]:
        """Get lists of supported input and output formats."""
        
        return {
            'input_formats': list(self.format_readers.keys()),
            'output_formats': list(self.format_writers.keys())
        }
    
    def validate_processing_config(self, config: ProcessingConfig) -> List[str]:
        """Validate processing configuration and return any errors."""
        
        errors = []
        
        # Check format support
        if config.source_format not in self.format_readers:
            errors.append(f"Unsupported source format: {config.source_format}")
        
        if config.target_format not in self.format_writers:
            errors.append(f"Unsupported target format: {config.target_format}")
        
        # Check processing type
        valid_types = [t.value for t in ProcessingType]
        if config.processing_type not in valid_types:
            errors.append(f"Invalid processing type: {config.processing_type}")
        
        # Check engine availability
        if config.engine not in self.engines:
            errors.append(f"Processing engine not available: {config.engine}")
        
        # Validate parameters based on processing type
        if config.processing_type == ProcessingType.NORMALIZATION:
            method = config.parameters.get('method', 'standard')
            if method not in ['standard', 'minmax']:
                errors.append(f"Invalid normalization method: {method}")
        
        return errors


# Utility functions
async def convert_dataset_format(input_path: str,
                               output_path: str,
                               source_format: str,
                               target_format: str,
                               options: Dict[str, Any] = None) -> ProcessingResult:
    """Utility function for simple format conversion."""
    
    processor = DatasetProcessor()
    
    return await processor.convert_format(
        input_path=input_path,
        output_path=output_path,
        source_format=DataFormat(source_format),
        target_format=DataFormat(target_format),
        conversion_options=options
    )


async def create_ml_splits(input_path: str,
                         output_base_path: str,
                         source_format: str,
                         target_column: str = None,
                         test_size: float = 0.2,
                         val_size: float = 0.1) -> Dict[str, ProcessingResult]:
    """Utility function to create ML train/val/test splits."""
    
    processor = DatasetProcessor()
    
    return await processor.create_ml_ready_dataset(
        input_path=input_path,
        output_path=output_base_path,
        source_format=DataFormat(source_format),
        target_column=target_column,
        test_size=test_size,
        validation_size=val_size
    )


def create_dataset_processor(storage_backend: str = "local",
                           storage_config: Dict[str, Any] = None) -> DatasetProcessor:
    """Factory function to create a dataset processor."""
    
    return DatasetProcessor(
        storage_backend=storage_backend,
        storage_config=storage_config
    )