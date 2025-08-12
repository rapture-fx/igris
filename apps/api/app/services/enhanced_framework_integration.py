"""
Enhanced Framework Integration Service
====================================

Advanced ML framework integration service with optimized exports, validation,
and format-specific optimizations for various ML frameworks.

Key Features:
- Framework-specific optimizations
- Automatic data validation
- Performance-optimized exports
- Multi-format support
- Comprehensive error handling
- Integration health monitoring
"""

import asyncio
import logging
import os
import tempfile
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum
import json
import numpy as np
import pandas as pd

# ML Framework specific imports
try:
    import tensorflow as tf
    HAS_TENSORFLOW = True
except ImportError:
    HAS_TENSORFLOW = False

try:
    import torch
    from torch.utils.data import Dataset, DataLoader
    HAS_PYTORCH = True
except ImportError:
    HAS_PYTORCH = False

try:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    import joblib
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    from datasets import Dataset as HFDataset
    HAS_HUGGINGFACE = True
except ImportError:
    HAS_HUGGINGFACE = False

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from app.database.ml_preparation_models import MLFrameworkType
from app.core.config import settings

logger = logging.getLogger(__name__)


class ExportFormat(Enum):
    """Supported export formats for different frameworks"""
    TENSORFLOW_DATASET = "tensorflow_dataset"
    TENSORFLOW_SAVEDMODEL = "tensorflow_savedmodel"
    PYTORCH_DATASET = "pytorch_dataset"
    PYTORCH_DATALOADER = "pytorch_dataloader"
    SKLEARN_ARRAYS = "sklearn_arrays"
    SKLEARN_PICKLE = "sklearn_pickle"
    HUGGINGFACE_DATASET = "huggingface_dataset"
    XGBOOST_DMATRIX = "xgboost_dmatrix"
    LIGHTGBM_DATASET = "lightgbm_dataset"
    NUMPY_ARRAYS = "numpy_arrays"
    PANDAS_DATAFRAME = "pandas_dataframe"
    CSV_FILES = "csv_files"
    JSON_FILES = "json_files"


@dataclass
class ExportConfiguration:
    """Configuration for framework export"""
    target_framework: MLFrameworkType
    export_format: ExportFormat
    train_test_split: float = 0.8
    validation_split: float = 0.1
    test_split: float = 0.1
    target_column: Optional[str] = None
    feature_columns: Optional[List[str]] = None
    batch_size: int = 32
    shuffle: bool = True
    random_state: int = 42
    normalize_features: bool = True
    encode_labels: bool = True
    create_validation_set: bool = True
    output_directory: Optional[str] = None
    compression: Optional[str] = None
    metadata_file: bool = True


@dataclass
class ExportResult:
    """Result of framework export operation"""
    framework_type: str
    export_format: str
    output_paths: Dict[str, str]
    metadata: Dict[str, Any]
    validation_results: Dict[str, Any]
    performance_metrics: Dict[str, float]
    file_sizes: Dict[str, int]
    export_time_seconds: float
    success: bool
    error_message: Optional[str] = None


class TensorFlowExporter:
    """TensorFlow-specific export functionality"""
    
    @staticmethod
    def export_dataset(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_path: str
    ) -> Dict[str, Any]:
        """Export data as TensorFlow Dataset"""
        
        if not HAS_TENSORFLOW:
            raise ImportError("TensorFlow not installed")
        
        # Prepare data
        X, y = TensorFlowExporter._prepare_data(df, config)
        
        # Split data
        splits = TensorFlowExporter._split_data(X, y, config)
        
        # Create TensorFlow datasets
        datasets = {}
        output_paths = {}
        
        for split_name, (X_split, y_split) in splits.items():
            # Create tf.data.Dataset
            if y_split is not None:
                dataset = tf.data.Dataset.from_tensor_slices((X_split, y_split))
            else:
                dataset = tf.data.Dataset.from_tensor_slices(X_split)
            
            # Apply transformations
            if config.shuffle:
                dataset = dataset.shuffle(buffer_size=len(X_split))
            
            dataset = dataset.batch(config.batch_size)
            dataset = dataset.prefetch(tf.data.AUTOTUNE)
            
            # Save dataset
            split_path = os.path.join(output_path, f"{split_name}_dataset")
            tf.data.experimental.save(dataset, split_path)
            output_paths[split_name] = split_path
            
            datasets[split_name] = dataset
        
        return {
            "output_paths": output_paths,
            "datasets": datasets,
            "metadata": {
                "total_samples": len(df),
                "num_features": X.shape[1],
                "num_classes": len(np.unique(y)) if y is not None else None,
                "batch_size": config.batch_size,
                "splits": {k: len(v[0]) for k, v in splits.items()}
            }
        }
    
    @staticmethod
    def _prepare_data(df: pd.DataFrame, config: ExportConfiguration) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """Prepare data for TensorFlow export"""
        
        # Select features
        if config.feature_columns:
            X = df[config.feature_columns].values
        else:
            feature_cols = [col for col in df.columns if col != config.target_column]
            X = df[feature_cols].values
        
        # Normalize features
        if config.normalize_features:
            scaler = StandardScaler()
            X = scaler.fit_transform(X)
        
        # Prepare target
        y = None
        if config.target_column and config.target_column in df.columns:
            y = df[config.target_column].values
            
            # Encode labels if needed
            if config.encode_labels and y.dtype == 'object':
                encoder = LabelEncoder()
                y = encoder.fit_transform(y)
        
        return X.astype(np.float32), y
    
    @staticmethod
    def _split_data(X: np.ndarray, y: Optional[np.ndarray], config: ExportConfiguration) -> Dict[str, Tuple[np.ndarray, Optional[np.ndarray]]]:
        """Split data into train/validation/test sets"""
        
        splits = {}
        
        if config.create_validation_set and config.validation_split > 0:
            # Train/validation/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=config.test_split, random_state=config.random_state
            )
            
            X_train, X_val, y_train, y_val = train_test_split(
                X_train, y_train, test_size=config.validation_split / (1 - config.test_split),
                random_state=config.random_state
            )
            
            splits = {
                "train": (X_train, y_train),
                "validation": (X_val, y_val),
                "test": (X_test, y_test)
            }
        else:
            # Simple train/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=config.test_split, random_state=config.random_state
            )
            
            splits = {
                "train": (X_train, y_train),
                "test": (X_test, y_test)
            }
        
        return splits


class PyTorchExporter:
    """PyTorch-specific export functionality"""
    
    @staticmethod
    def export_dataset(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_path: str
    ) -> Dict[str, Any]:
        """Export data as PyTorch Dataset"""
        
        if not HAS_PYTORCH:
            raise ImportError("PyTorch not installed")
        
        # Prepare data
        X, y = PyTorchExporter._prepare_data(df, config)
        
        # Split data
        splits = PyTorchExporter._split_data(X, y, config)
        
        # Create PyTorch datasets
        datasets = {}
        output_paths = {}
        
        for split_name, (X_split, y_split) in splits.items():
            # Create custom dataset
            dataset = PyTorchDataset(X_split, y_split)
            
            # Save dataset
            split_path = os.path.join(output_path, f"{split_name}_dataset.pt")
            torch.save({
                'features': X_split,
                'targets': y_split,
                'metadata': {
                    'num_samples': len(X_split),
                    'num_features': X_split.shape[1],
                    'split': split_name
                }
            }, split_path)
            
            output_paths[split_name] = split_path
            datasets[split_name] = dataset
        
        return {
            "output_paths": output_paths,
            "datasets": datasets,
            "metadata": {
                "total_samples": len(df),
                "num_features": X.shape[1],
                "num_classes": len(np.unique(y)) if y is not None else None,
                "splits": {k: len(v[0]) for k, v in splits.items()}
            }
        }
    
    @staticmethod
    def _prepare_data(df: pd.DataFrame, config: ExportConfiguration) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        """Prepare data for PyTorch export"""
        
        # Select features
        if config.feature_columns:
            X = df[config.feature_columns].values
        else:
            feature_cols = [col for col in df.columns if col != config.target_column]
            X = df[feature_cols].values
        
        # Normalize features
        if config.normalize_features:
            scaler = StandardScaler()
            X = scaler.fit_transform(X)
        
        # Convert to tensor
        X = torch.tensor(X, dtype=torch.float32)
        
        # Prepare target
        y = None
        if config.target_column and config.target_column in df.columns:
            y = df[config.target_column].values
            
            # Encode labels if needed
            if config.encode_labels and y.dtype == 'object':
                encoder = LabelEncoder()
                y = encoder.fit_transform(y)
            
            y = torch.tensor(y, dtype=torch.long)
        
        return X, y
    
    @staticmethod
    def _split_data(X: torch.Tensor, y: Optional[torch.Tensor], config: ExportConfiguration) -> Dict[str, Tuple[torch.Tensor, Optional[torch.Tensor]]]:
        """Split data into train/validation/test sets"""
        
        # Convert to numpy for sklearn split
        X_np = X.numpy()
        y_np = y.numpy() if y is not None else None
        
        splits = {}
        
        if config.create_validation_set and config.validation_split > 0:
            # Train/validation/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X_np, y_np, test_size=config.test_split, random_state=config.random_state
            )
            
            X_train, X_val, y_train, y_val = train_test_split(
                X_train, y_train, test_size=config.validation_split / (1 - config.test_split),
                random_state=config.random_state
            )
            
            splits = {
                "train": (torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long) if y_train is not None else None),
                "validation": (torch.tensor(X_val, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long) if y_val is not None else None),
                "test": (torch.tensor(X_test, dtype=torch.float32), torch.tensor(y_test, dtype=torch.long) if y_test is not None else None)
            }
        else:
            # Simple train/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X_np, y_np, test_size=config.test_split, random_state=config.random_state
            )
            
            splits = {
                "train": (torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long) if y_train is not None else None),
                "test": (torch.tensor(X_test, dtype=torch.float32), torch.tensor(y_test, dtype=torch.long) if y_test is not None else None)
            }
        
        return splits


class PyTorchDataset(Dataset):
    """Custom PyTorch Dataset class"""
    
    def __init__(self, features: torch.Tensor, targets: Optional[torch.Tensor] = None):
        self.features = features
        self.targets = targets
    
    def __len__(self):
        return len(self.features)
    
    def __getitem__(self, idx):
        if self.targets is not None:
            return self.features[idx], self.targets[idx]
        return self.features[idx]


class SklearnExporter:
    """Scikit-learn specific export functionality"""
    
    @staticmethod
    def export_arrays(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_path: str
    ) -> Dict[str, Any]:
        """Export data as numpy arrays for scikit-learn"""
        
        if not HAS_SKLEARN:
            raise ImportError("scikit-learn not installed")
        
        # Prepare data
        X, y = SklearnExporter._prepare_data(df, config)
        
        # Split data
        splits = SklearnExporter._split_data(X, y, config)
        
        # Save arrays
        output_paths = {}
        
        for split_name, (X_split, y_split) in splits.items():
            # Save features
            X_path = os.path.join(output_path, f"{split_name}_X.npy")
            np.save(X_path, X_split)
            output_paths[f"{split_name}_X"] = X_path
            
            # Save targets
            if y_split is not None:
                y_path = os.path.join(output_path, f"{split_name}_y.npy")
                np.save(y_path, y_split)
                output_paths[f"{split_name}_y"] = y_path
        
        return {
            "output_paths": output_paths,
            "arrays": splits,
            "metadata": {
                "total_samples": len(df),
                "num_features": X.shape[1],
                "num_classes": len(np.unique(y)) if y is not None else None,
                "splits": {k: len(v[0]) for k, v in splits.items()}
            }
        }
    
    @staticmethod
    def _prepare_data(df: pd.DataFrame, config: ExportConfiguration) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """Prepare data for scikit-learn export"""
        
        # Select features
        if config.feature_columns:
            X = df[config.feature_columns].values
        else:
            feature_cols = [col for col in df.columns if col != config.target_column]
            X = df[feature_cols].values
        
        # Normalize features
        if config.normalize_features:
            scaler = StandardScaler()
            X = scaler.fit_transform(X)
        
        # Prepare target
        y = None
        if config.target_column and config.target_column in df.columns:
            y = df[config.target_column].values
            
            # Encode labels if needed
            if config.encode_labels and y.dtype == 'object':
                encoder = LabelEncoder()
                y = encoder.fit_transform(y)
        
        return X, y
    
    @staticmethod
    def _split_data(X: np.ndarray, y: Optional[np.ndarray], config: ExportConfiguration) -> Dict[str, Tuple[np.ndarray, Optional[np.ndarray]]]:
        """Split data into train/validation/test sets"""
        
        splits = {}
        
        if config.create_validation_set and config.validation_split > 0:
            # Train/validation/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=config.test_split, random_state=config.random_state
            )
            
            X_train, X_val, y_train, y_val = train_test_split(
                X_train, y_train, test_size=config.validation_split / (1 - config.test_split),
                random_state=config.random_state
            )
            
            splits = {
                "train": (X_train, y_train),
                "validation": (X_val, y_val),
                "test": (X_test, y_test)
            }
        else:
            # Simple train/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=config.test_split, random_state=config.random_state
            )
            
            splits = {
                "train": (X_train, y_train),
                "test": (X_test, y_test)
            }
        
        return splits


class EnhancedFrameworkIntegration:
    """
    Enhanced framework integration service with optimized exports
    """
    
    def __init__(self):
        self.exporters = {
            MLFrameworkType.TENSORFLOW: TensorFlowExporter(),
            MLFrameworkType.PYTORCH: PyTorchExporter(),
            MLFrameworkType.SCIKIT_LEARN: SklearnExporter()
        }
        
        self.supported_frameworks = self._get_supported_frameworks()
    
    def _get_supported_frameworks(self) -> Dict[MLFrameworkType, bool]:
        """Get list of supported frameworks based on installed packages"""
        return {
            MLFrameworkType.TENSORFLOW: HAS_TENSORFLOW,
            MLFrameworkType.PYTORCH: HAS_PYTORCH,
            MLFrameworkType.SCIKIT_LEARN: HAS_SKLEARN,
            MLFrameworkType.HUGGINGFACE: HAS_HUGGINGFACE,
            MLFrameworkType.XGBOOST: HAS_XGBOOST,
            MLFrameworkType.LIGHTGBM: HAS_LIGHTGBM
        }
    
    async def export_for_framework(
        self,
        df: pd.DataFrame,
        framework_type: MLFrameworkType,
        config: ExportConfiguration,
        output_directory: Optional[str] = None
    ) -> ExportResult:
        """
        Export data for specific ML framework with optimization
        """
        
        start_time = datetime.utcnow()
        
        try:
            # Check if framework is supported
            if not self.supported_frameworks.get(framework_type, False):
                return ExportResult(
                    framework_type=framework_type.value,
                    export_format=config.export_format.value,
                    output_paths={},
                    metadata={},
                    validation_results={},
                    performance_metrics={},
                    file_sizes={},
                    export_time_seconds=0,
                    success=False,
                    error_message=f"Framework {framework_type.value} not supported or not installed"
                )
            
            # Create output directory
            if not output_directory:
                output_directory = tempfile.mkdtemp(prefix=f"{framework_type.value}_export_")
            
            os.makedirs(output_directory, exist_ok=True)
            
            # Export data
            export_result = await self._export_data(df, framework_type, config, output_directory)
            
            # Validate export
            validation_results = await self._validate_export(export_result, framework_type, config)
            
            # Calculate performance metrics
            performance_metrics = await self._calculate_performance_metrics(export_result, df, config)
            
            # Calculate file sizes
            file_sizes = self._calculate_file_sizes(export_result["output_paths"])
            
            # Calculate export time
            export_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ExportResult(
                framework_type=framework_type.value,
                export_format=config.export_format.value,
                output_paths=export_result["output_paths"],
                metadata=export_result["metadata"],
                validation_results=validation_results,
                performance_metrics=performance_metrics,
                file_sizes=file_sizes,
                export_time_seconds=export_time,
                success=True
            )
            
        except Exception as e:
            logger.error(f"Export failed for {framework_type.value}: {str(e)}")
            
            return ExportResult(
                framework_type=framework_type.value,
                export_format=config.export_format.value,
                output_paths={},
                metadata={},
                validation_results={},
                performance_metrics={},
                file_sizes={},
                export_time_seconds=(datetime.utcnow() - start_time).total_seconds(),
                success=False,
                error_message=str(e)
            )
    
    async def _export_data(
        self,
        df: pd.DataFrame,
        framework_type: MLFrameworkType,
        config: ExportConfiguration,
        output_directory: str
    ) -> Dict[str, Any]:
        """Export data using framework-specific exporter"""
        
        if framework_type == MLFrameworkType.TENSORFLOW:
            return TensorFlowExporter.export_dataset(df, config, output_directory)
        elif framework_type == MLFrameworkType.PYTORCH:
            return PyTorchExporter.export_dataset(df, config, output_directory)
        elif framework_type == MLFrameworkType.SCIKIT_LEARN:
            return SklearnExporter.export_arrays(df, config, output_directory)
        else:
            raise ValueError(f"Unsupported framework: {framework_type}")
    
    async def _validate_export(
        self,
        export_result: Dict[str, Any],
        framework_type: MLFrameworkType,
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Validate exported data"""
        
        validation_results = {
            "files_exist": True,
            "data_integrity": True,
            "format_compliance": True,
            "split_ratios": True,
            "issues": []
        }
        
        try:
            # Check if all expected files exist
            for path in export_result["output_paths"].values():
                if not os.path.exists(path):
                    validation_results["files_exist"] = False
                    validation_results["issues"].append(f"File not found: {path}")
            
            # Validate split ratios
            metadata = export_result.get("metadata", {})
            splits = metadata.get("splits", {})
            
            if "train" in splits and "test" in splits:
                total_samples = sum(splits.values())
                train_ratio = splits["train"] / total_samples
                test_ratio = splits["test"] / total_samples
                
                expected_train = config.train_test_split
                expected_test = config.test_split
                
                if abs(train_ratio - expected_train) > 0.05:  # 5% tolerance
                    validation_results["split_ratios"] = False
                    validation_results["issues"].append(f"Train split ratio mismatch: expected {expected_train}, got {train_ratio}")
                
                if abs(test_ratio - expected_test) > 0.05:  # 5% tolerance
                    validation_results["split_ratios"] = False
                    validation_results["issues"].append(f"Test split ratio mismatch: expected {expected_test}, got {test_ratio}")
            
            # Framework-specific validation
            if framework_type == MLFrameworkType.TENSORFLOW and HAS_TENSORFLOW:
                # Try to load a dataset
                try:
                    for split_name, path in export_result["output_paths"].items():
                        dataset = tf.data.experimental.load(path)
                        # Check if dataset is iterable
                        next(iter(dataset))
                except Exception as e:
                    validation_results["format_compliance"] = False
                    validation_results["issues"].append(f"TensorFlow dataset loading failed: {str(e)}")
            
            elif framework_type == MLFrameworkType.PYTORCH and HAS_PYTORCH:
                # Try to load saved tensors
                try:
                    for split_name, path in export_result["output_paths"].items():
                        if path.endswith('.pt'):
                            data = torch.load(path)
                            # Check if data structure is correct
                            if 'features' not in data:
                                validation_results["format_compliance"] = False
                                validation_results["issues"].append(f"PyTorch data structure invalid: {path}")
                except Exception as e:
                    validation_results["format_compliance"] = False
                    validation_results["issues"].append(f"PyTorch data loading failed: {str(e)}")
            
            elif framework_type == MLFrameworkType.SCIKIT_LEARN:
                # Try to load numpy arrays
                try:
                    for split_name, path in export_result["output_paths"].items():
                        if path.endswith('.npy'):
                            array = np.load(path)
                            # Check if array is valid
                            if array.size == 0:
                                validation_results["format_compliance"] = False
                                validation_results["issues"].append(f"Empty numpy array: {path}")
                except Exception as e:
                    validation_results["format_compliance"] = False
                    validation_results["issues"].append(f"Numpy array loading failed: {str(e)}")
            
        except Exception as e:
            validation_results["data_integrity"] = False
            validation_results["issues"].append(f"Validation error: {str(e)}")
        
        return validation_results
    
    async def _calculate_performance_metrics(
        self,
        export_result: Dict[str, Any],
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, float]:
        """Calculate performance metrics for export"""
        
        metadata = export_result.get("metadata", {})
        
        return {
            "compression_ratio": 1.0,  # TODO: Calculate actual compression
            "memory_efficiency": 1.0,  # TODO: Calculate memory usage
            "export_speed_mb_per_second": 0.0,  # TODO: Calculate based on data size and time
            "data_reduction_ratio": 1.0,  # TODO: Calculate if any data filtering occurred
            "validation_accuracy": 1.0 if len(export_result.get("validation_results", {}).get("issues", [])) == 0 else 0.0
        }
    
    def _calculate_file_sizes(self, file_paths: Dict[str, str]) -> Dict[str, int]:
        """Calculate file sizes for exported files"""
        
        file_sizes = {}
        
        for name, path in file_paths.items():
            try:
                if os.path.exists(path):
                    if os.path.isdir(path):
                        # Calculate directory size
                        total_size = 0
                        for dirpath, dirnames, filenames in os.walk(path):
                            for filename in filenames:
                                file_path = os.path.join(dirpath, filename)
                                total_size += os.path.getsize(file_path)
                        file_sizes[name] = total_size
                    else:
                        file_sizes[name] = os.path.getsize(path)
                else:
                    file_sizes[name] = 0
            except Exception as e:
                logger.warning(f"Could not calculate size for {path}: {str(e)}")
                file_sizes[name] = 0
        
        return file_sizes
    
    def get_framework_capabilities(self, framework_type: MLFrameworkType) -> Dict[str, Any]:
        """Get capabilities and requirements for specific framework"""
        
        capabilities = {
            MLFrameworkType.TENSORFLOW: {
                "installed": HAS_TENSORFLOW,
                "supports_streaming": True,
                "supports_batching": True,
                "supports_prefetching": True,
                "optimal_formats": [ExportFormat.TENSORFLOW_DATASET],
                "batch_size_recommendations": [16, 32, 64, 128],
                "memory_efficient": True,
                "gpu_optimized": True
            },
            MLFrameworkType.PYTORCH: {
                "installed": HAS_PYTORCH,
                "supports_streaming": True,
                "supports_batching": True,
                "supports_prefetching": True,
                "optimal_formats": [ExportFormat.PYTORCH_DATASET, ExportFormat.PYTORCH_DATALOADER],
                "batch_size_recommendations": [16, 32, 64, 128],
                "memory_efficient": True,
                "gpu_optimized": True
            },
            MLFrameworkType.SCIKIT_LEARN: {
                "installed": HAS_SKLEARN,
                "supports_streaming": False,
                "supports_batching": False,
                "supports_prefetching": False,
                "optimal_formats": [ExportFormat.SKLEARN_ARRAYS, ExportFormat.NUMPY_ARRAYS],
                "batch_size_recommendations": [],
                "memory_efficient": True,
                "gpu_optimized": False
            }
        }
        
        return capabilities.get(framework_type, {})


# Global instance
enhanced_framework_integration = EnhancedFrameworkIntegration() 