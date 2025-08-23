"""
ML Framework Integration Service - Real TensorFlow/PyTorch Export Pipelines
===========================================================================

This service provides comprehensive integration with major ML frameworks,
including real export pipelines, preprocessing, model serving preparation,
and performance optimization for production deployment.

Key Features:
- TensorFlow: tf.data.Dataset, SavedModel, TF Transform, TFX integration
- PyTorch: Custom Dataset/DataLoader, TorchScript, ONNX export, Lightning
- Scikit-learn: Pipeline export, custom transformers, model versioning
- Multi-format data export: HDF5, Parquet, TFRecord, Arrow
- Production serving preparation with Docker containerization
- GPU/TPU optimization and distributed training support
"""

import os
import sys
import json
import pickle
import tempfile
import asyncio
import logging
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, LabelEncoder, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.metrics import classification_report, mean_squared_error
import joblib

# Optional ML framework imports with fallbacks
try:
    import tensorflow as tf
    import tensorflow_transform as tft
    from tensorflow_metadata.proto.v0 import schema_pb2
    from tensorflow_metadata.proto.v0 import statistics_pb2
    HAS_TENSORFLOW = True
except ImportError:
    HAS_TENSORFLOW = False

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler, Subset
    from torch.utils.data.distributed import DistributedSampler
    import torchvision.transforms as transforms
    HAS_PYTORCH = True
except ImportError:
    HAS_PYTORCH = False

try:
    import pytorch_lightning as pl
    from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping
    HAS_LIGHTNING = True
except ImportError:
    HAS_LIGHTNING = False

try:
    import onnx
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
    HAS_ARROW = True
except ImportError:
    HAS_ARROW = False

try:
    import h5py
    HAS_HDF5 = True
except ImportError:
    HAS_HDF5 = False

logger = logging.getLogger(__name__)

class MLFrameworkType(Enum):
    """Supported ML frameworks"""
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch" 
    SCIKIT_LEARN = "scikit_learn"
    HUGGINGFACE = "huggingface"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    ONNX = "onnx"

class DataFormat(Enum):
    """Supported data export formats"""
    TFRECORD = "tfrecord"
    HDF5 = "hdf5"
    PARQUET = "parquet"
    ARROW = "arrow"
    PICKLE = "pickle"
    NUMPY = "numpy"
    CSV = "csv"
    JSON = "json"

class TaskType(Enum):
    """ML task types"""
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    NLP_CLASSIFICATION = "nlp_classification"
    NLP_NER = "nlp_ner"
    NLP_GENERATION = "nlp_generation"
    COMPUTER_VISION = "computer_vision"
    TIME_SERIES = "time_series"
    CLUSTERING = "clustering"
    ANOMALY_DETECTION = "anomaly_detection"

@dataclass
class ModelServingConfig:
    """Configuration for model serving preparation"""
    model_name: str
    model_version: str = "1"
    serving_framework: str = "tensorflow_serving"  # tensorflow_serving, torchserve, triton
    input_signature: Optional[Dict[str, Any]] = None
    output_signature: Optional[Dict[str, Any]] = None
    preprocessing_pipeline: Optional[str] = None
    batch_size: int = 32
    max_latency_ms: int = 100
    enable_gpu: bool = False
    docker_config: Optional[Dict[str, str]] = None

@dataclass
class ExportConfiguration:
    """Comprehensive export configuration"""
    framework: MLFrameworkType
    task_type: TaskType
    data_format: DataFormat = DataFormat.NUMPY
    target_column: Optional[str] = None
    feature_columns: Optional[List[str]] = None
    text_columns: Optional[List[str]] = None
    categorical_columns: Optional[List[str]] = None
    numerical_columns: Optional[List[str]] = None
    timestamp_column: Optional[str] = None
    
    # Data splitting
    train_ratio: float = 0.7
    validation_ratio: float = 0.15
    test_ratio: float = 0.15
    stratify: bool = True
    cross_validation_folds: int = 0
    time_series_split: bool = False
    
    # Preprocessing
    normalize_features: bool = True
    handle_missing_values: bool = True
    encode_categorical: str = "onehot"  # onehot, label, target, embedding
    feature_selection: bool = False
    feature_engineering: bool = False
    
    # Framework-specific
    batch_size: int = 32
    sequence_length: int = 512  # For NLP
    image_size: Tuple[int, int] = (224, 224)  # For CV
    num_workers: int = 4
    pin_memory: bool = True
    
    # Optimization
    enable_caching: bool = True
    enable_prefetch: bool = True
    memory_efficient: bool = True
    distributed_training: bool = False
    mixed_precision: bool = False
    
    # Output
    output_directory: Optional[str] = None
    compression: Optional[str] = "gzip"
    save_metadata: bool = True
    create_serving_config: bool = False
    serving_config: Optional[ModelServingConfig] = None


class CustomDataset:
    """Custom PyTorch Dataset with advanced features"""
    
    def __init__(
        self,
        features: Union[np.ndarray],
        targets: Optional[Union[np.ndarray]] = None,
        transforms: Optional[Callable] = None,
        task_type: TaskType = TaskType.CLASSIFICATION
    ):
        if HAS_PYTORCH:
            if isinstance(features, np.ndarray):
                self.features = torch.from_numpy(features).float()
            else:
                self.features = features.float() if hasattr(features, 'float') else features
                
            if targets is not None:
                if isinstance(targets, np.ndarray):
                    if task_type == TaskType.CLASSIFICATION:
                        self.targets = torch.from_numpy(targets).long()
                    else:
                        self.targets = torch.from_numpy(targets).float()
                else:
                    self.targets = targets
            else:
                self.targets = None
        else:
            self.features = features
            self.targets = targets
            
        self.transforms = transforms
        self.task_type = task_type
    
    def __len__(self) -> int:
        return len(self.features)
    
    def __getitem__(self, idx: int) -> Union[Any, Tuple[Any, Any]]:
        feature = self.features[idx]
        
        if self.transforms:
            feature = self.transforms(feature)
            
        if self.targets is not None:
            return feature, self.targets[idx]
        return feature

    def get_class_weights(self) -> Optional[np.ndarray]:
        """Calculate class weights for imbalanced datasets"""
        if self.targets is None or self.task_type != TaskType.CLASSIFICATION:
            return None
        
        if HAS_PYTORCH and hasattr(self.targets, 'unique'):
            unique_classes, counts = torch.unique(self.targets, return_counts=True)
            total_samples = len(self.targets)
            weights = total_samples / (len(unique_classes) * counts.float())
            return weights
        else:
            # Fallback to numpy
            unique_classes, counts = np.unique(self.targets, return_counts=True)
            total_samples = len(self.targets)
            weights = total_samples / (len(unique_classes) * counts)
            return weights


class CustomTransformer(BaseEstimator, TransformerMixin):
    """Custom sklearn transformer for domain-specific operations"""
    
    def __init__(
        self,
        feature_engineering: bool = True,
        handle_outliers: bool = True,
        create_interactions: bool = False
    ):
        self.feature_engineering = feature_engineering
        self.handle_outliers = handle_outliers
        self.create_interactions = create_interactions
        self.feature_names_out = None
        
    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None):
        """Fit the transformer"""
        n_features = X.shape[1]
        self.feature_names_out = [f"feature_{i}" for i in range(n_features)]
        
        if self.create_interactions:
            # Add interaction feature names
            for i in range(n_features):
                for j in range(i + 1, n_features):
                    self.feature_names_out.append(f"interaction_{i}_{j}")
                    
        return self
    
    def transform(self, X: np.ndarray) -> np.ndarray:
        """Transform the data"""
        X_transformed = X.copy()
        
        if self.feature_engineering:
            # Add polynomial features for numerical columns
            X_transformed = np.column_stack([X_transformed, X_transformed ** 2])
        
        if self.handle_outliers:
            # Clip outliers using IQR method
            Q1 = np.percentile(X_transformed, 25, axis=0)
            Q3 = np.percentile(X_transformed, 75, axis=0)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            X_transformed = np.clip(X_transformed, lower_bound, upper_bound)
        
        if self.create_interactions:
            # Create interaction features
            n_features = X.shape[1]
            interactions = []
            for i in range(n_features):
                for j in range(i + 1, n_features):
                    interactions.append(X_transformed[:, i] * X_transformed[:, j])
            
            if interactions:
                X_transformed = np.column_stack([X_transformed, np.array(interactions).T])
                
        return X_transformed
    
    def get_feature_names_out(self, input_features: Optional[List[str]] = None) -> List[str]:
        """Get output feature names"""
        return self.feature_names_out if self.feature_names_out else []


class TensorFlowIntegration:
    """TensorFlow-specific integration with advanced features"""
    
    @staticmethod
    def create_tf_data_pipeline(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_dir: str
    ) -> Dict[str, Any]:
        """Create optimized tf.data.Dataset pipeline"""
        if not HAS_TENSORFLOW:
            raise ImportError("TensorFlow not installed")
        
        # Prepare data splits
        splits = TensorFlowIntegration._prepare_data_splits(df, config)
        
        datasets = {}
        output_paths = {}
        
        for split_name, (X, y) in splits.items():
            # Create tf.data.Dataset
            if y is not None:
                dataset = tf.data.Dataset.from_tensor_slices((X, y))
            else:
                dataset = tf.data.Dataset.from_tensor_slices(X)
            
            # Apply optimizations
            if config.enable_caching:
                dataset = dataset.cache()
            
            if split_name == "train" and config.stratify:
                dataset = dataset.shuffle(buffer_size=len(X), reshuffle_each_iteration=True)
            
            dataset = dataset.batch(config.batch_size, drop_remainder=False)
            
            if config.enable_prefetch:
                dataset = dataset.prefetch(tf.data.AUTOTUNE)
            
            # Save as TFRecord for better performance
            if config.data_format == DataFormat.TFRECORD:
                tfrecord_path = os.path.join(output_dir, f"{split_name}.tfrecord")
                TensorFlowIntegration._save_as_tfrecord(dataset, tfrecord_path)
                output_paths[split_name] = tfrecord_path
            else:
                # Save as directory
                dataset_path = os.path.join(output_dir, f"{split_name}_dataset")
                tf.data.experimental.save(dataset, dataset_path)
                output_paths[split_name] = dataset_path
            
            datasets[split_name] = dataset
        
        return {
            "datasets": datasets,
            "output_paths": output_paths,
            "metadata": TensorFlowIntegration._create_metadata(splits, config)
        }
    
    @staticmethod
    def create_savedmodel_export(
        model: Any,
        preprocessing_pipeline: Pipeline,
        config: ExportConfiguration,
        output_dir: str
    ) -> str:
        """Create SavedModel with preprocessing pipeline"""
        
        # Create preprocessing layer
        preprocessing_layer = TensorFlowIntegration._create_preprocessing_layer(
            preprocessing_pipeline, config
        )
        
        # Create serving model with preprocessing
        @tf.function
        def serve_fn(inputs):
            preprocessed = preprocessing_layer(inputs)
            return model(preprocessed)
        
        # Create serving signatures
        signatures = {
            'serving_default': serve_fn.get_concrete_function(
                tf.TensorSpec(shape=[None, len(config.feature_columns)], dtype=tf.float32)
            )
        }
        
        # Save model
        savedmodel_path = os.path.join(output_dir, "saved_model")
        tf.saved_model.save(model, savedmodel_path, signatures=signatures)
        
        return savedmodel_path
    
    @staticmethod
    def create_tf_transform_pipeline(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_dir: str
    ) -> Dict[str, Any]:
        """Create TensorFlow Transform preprocessing pipeline"""
        
        def preprocessing_fn(inputs):
            """TFT preprocessing function"""
            outputs = {}
            
            # Normalize numerical features
            for col in config.numerical_columns or []:
                if col in inputs:
                    outputs[f"{col}_normalized"] = tft.scale_to_z_score(inputs[col])
            
            # Encode categorical features
            for col in config.categorical_columns or []:
                if col in inputs:
                    outputs[f"{col}_encoded"] = tft.compute_and_apply_vocabulary(
                        inputs[col], default_value=-1
                    )
            
            # Handle target variable
            if config.target_column and config.target_column in inputs:
                if config.task_type == TaskType.CLASSIFICATION:
                    outputs["target"] = tft.compute_and_apply_vocabulary(
                        inputs[config.target_column], default_value=-1
                    )
                else:
                    outputs["target"] = inputs[config.target_column]
            
            return outputs
        
        # Convert DataFrame to TensorFlow format
        feature_spec = {}
        for col in df.columns:
            if df[col].dtype in ['int64', 'float64']:
                feature_spec[col] = tf.io.FixedLenFeature([], tf.float32)
            else:
                feature_spec[col] = tf.io.FixedLenFeature([], tf.string)
        
        # Create transform metadata
        transform_output_dir = os.path.join(output_dir, "transform")
        os.makedirs(transform_output_dir, exist_ok=True)
        
        return {
            "preprocessing_fn": preprocessing_fn,
            "feature_spec": feature_spec,
            "transform_output_dir": transform_output_dir
        }
    
    @staticmethod
    def _prepare_data_splits(
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Tuple[np.ndarray, Optional[np.ndarray]]]:
        """Prepare train/validation/test splits"""
        
        # Select features
        if config.feature_columns:
            X = df[config.feature_columns].values.astype(np.float32)
        else:
            feature_cols = [col for col in df.columns if col != config.target_column]
            X = df[feature_cols].values.astype(np.float32)
        
        # Prepare target
        y = None
        if config.target_column and config.target_column in df.columns:
            y_data = df[config.target_column].values
            if config.task_type == TaskType.CLASSIFICATION and y_data.dtype == 'object':
                le = LabelEncoder()
                y = le.fit_transform(y_data).astype(np.int32)
            else:
                y = y_data.astype(np.float32 if config.task_type == TaskType.REGRESSION else np.int32)
        
        # Create splits
        if config.time_series_split:
            # Time series split
            n_samples = len(X)
            train_end = int(n_samples * config.train_ratio)
            val_end = int(n_samples * (config.train_ratio + config.validation_ratio))
            
            splits = {
                "train": (X[:train_end], y[:train_end] if y is not None else None),
                "validation": (X[train_end:val_end], y[train_end:val_end] if y is not None else None),
                "test": (X[val_end:], y[val_end:] if y is not None else None)
            }
        else:
            # Standard split with stratification
            stratify_data = y if config.stratify and y is not None else None
            
            # First split: train vs (val + test)
            X_train, X_temp, y_train, y_temp = train_test_split(
                X, y,
                test_size=(config.validation_ratio + config.test_ratio),
                random_state=42,
                stratify=stratify_data
            )
            
            # Second split: validation vs test
            if config.validation_ratio > 0:
                val_size = config.validation_ratio / (config.validation_ratio + config.test_ratio)
                stratify_temp = y_temp if config.stratify and y_temp is not None else None
                
                X_val, X_test, y_val, y_test = train_test_split(
                    X_temp, y_temp,
                    test_size=(1 - val_size),
                    random_state=42,
                    stratify=stratify_temp
                )
                
                splits = {
                    "train": (X_train, y_train),
                    "validation": (X_val, y_val),
                    "test": (X_test, y_test)
                }
            else:
                splits = {
                    "train": (X_train, y_train),
                    "test": (X_temp, y_temp)
                }
        
        return splits
    
    @staticmethod
    def _save_as_tfrecord(dataset: Any, output_path: str):
        """Save dataset as TFRecord"""
        writer = tf.data.experimental.TFRecordWriter(output_path)
        writer.write(dataset.map(tf.py_function(
            lambda *args: tf.py_function(
                lambda x: tf.train.Example(features=tf.train.Features(
                    feature={'data': tf.train.Feature(bytes_list=tf.train.BytesList(
                        value=[tf.io.serialize_tensor(x).numpy()]
                    ))}
                )).SerializeToString(),
                [args],
                tf.string
            ),
            [tf.float32, tf.int32] if len(args) == 2 else [tf.float32],
            tf.string
        )))
    
    @staticmethod
    def _create_preprocessing_layer(
        preprocessing_pipeline: Pipeline,
        config: ExportConfiguration
    ) -> Any:
        """Create TensorFlow preprocessing layer from sklearn pipeline"""
        
        class PreprocessingLayer(tf.keras.layers.Layer):
            def __init__(self, pipeline):
                super().__init__()
                self.pipeline = pipeline
            
            def call(self, inputs):
                # Convert to numpy, apply sklearn pipeline, convert back
                def preprocess_fn(x):
                    return self.pipeline.transform(x.numpy())
                
                return tf.py_function(
                    preprocess_fn,
                    [inputs],
                    tf.float32
                )
        
        return PreprocessingLayer(preprocessing_pipeline)
    
    @staticmethod
    def _create_metadata(
        splits: Dict[str, Tuple[np.ndarray, Optional[np.ndarray]]],
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Create metadata for TensorFlow export"""
        
        return {
            "framework": "tensorflow",
            "task_type": config.task_type.value,
            "splits": {name: len(X) for name, (X, _) in splits.items()},
            "num_features": splits["train"][0].shape[1],
            "num_classes": len(np.unique(splits["train"][1])) if splits["train"][1] is not None else None,
            "batch_size": config.batch_size,
            "data_format": config.data_format.value,
            "created_at": datetime.now().isoformat()
        }


class PyTorchIntegration:
    """PyTorch-specific integration with Lightning and ONNX support"""
    
    @staticmethod
    def create_pytorch_datasets(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_dir: str
    ) -> Dict[str, Any]:
        """Create PyTorch datasets with advanced features"""
        
        if not HAS_PYTORCH:
            raise ImportError("PyTorch not installed")
        
        # Prepare data splits
        splits = PyTorchIntegration._prepare_data_splits(df, config)
        
        datasets = {}
        dataloaders = {}
        output_paths = {}
        
        for split_name, (X, y) in splits.items():
            # Create custom dataset
            dataset = CustomDataset(
                features=X,
                targets=y,
                task_type=config.task_type
            )
            
            # Create dataloader with optimizations
            shuffle = (split_name == "train")
            sampler = None
            
            # Handle imbalanced datasets
            if split_name == "train" and config.task_type == TaskType.CLASSIFICATION and y is not None:
                class_weights = dataset.get_class_weights()
                if class_weights is not None:
                    sample_weights = class_weights[y]
                    sampler = WeightedRandomSampler(
                        weights=sample_weights,
                        num_samples=len(sample_weights),
                        replacement=True
                    )
                    shuffle = False
            
            # Distributed training support
            if config.distributed_training:
                sampler = DistributedSampler(dataset, shuffle=shuffle)
                shuffle = False
            
            dataloader = DataLoader(
                dataset,
                batch_size=config.batch_size,
                shuffle=shuffle,
                sampler=sampler,
                num_workers=config.num_workers,
                pin_memory=config.pin_memory,
                drop_last=(split_name == "train"),
                persistent_workers=(config.num_workers > 0)
            )
            
            # Save dataset
            dataset_path = os.path.join(output_dir, f"{split_name}_dataset.pt")
            torch.save({
                "features": X,
                "targets": y,
                "dataset_config": {
                    "task_type": config.task_type.value,
                    "num_samples": len(X),
                    "num_features": X.shape[1] if len(X.shape) > 1 else 1
                }
            }, dataset_path)
            
            datasets[split_name] = dataset
            dataloaders[split_name] = dataloader
            output_paths[split_name] = dataset_path
        
        return {
            "datasets": datasets,
            "dataloaders": dataloaders,
            "output_paths": output_paths,
            "metadata": PyTorchIntegration._create_metadata(splits, config)
        }
    
    @staticmethod
    def create_torchscript_model(
        model: Any,
        example_input: Any,
        output_path: str,
        config: ExportConfiguration
    ) -> str:
        """Export model to TorchScript for production"""
        
        model.eval()
        
        try:
            # Try tracing first (usually more efficient)
            traced_model = torch.jit.trace(model, example_input)
            script_path = os.path.join(output_path, "model_traced.pt")
            torch.jit.save(traced_model, script_path)
            logger.info(f"Model traced and saved to {script_path}")
            return script_path
            
        except Exception as e:
            logger.warning(f"Tracing failed: {e}. Trying scripting...")
            
            try:
                # Fall back to scripting
                scripted_model = torch.jit.script(model)
                script_path = os.path.join(output_path, "model_scripted.pt")
                torch.jit.save(scripted_model, script_path)
                logger.info(f"Model scripted and saved to {script_path}")
                return script_path
                
            except Exception as e:
                logger.error(f"Both tracing and scripting failed: {e}")
                raise
    
    @staticmethod
    def export_to_onnx(
        model: Any,
        example_input: Any,
        output_path: str,
        config: ExportConfiguration
    ) -> str:
        """Export PyTorch model to ONNX format"""
        
        if not HAS_ONNX:
            raise ImportError("ONNX not installed")
        
        model.eval()
        onnx_path = os.path.join(output_path, "model.onnx")
        
        # Dynamic axes for flexible batch size
        dynamic_axes = {"input": {0: "batch_size"}, "output": {0: "batch_size"}}
        
        torch.onnx.export(
            model,
            example_input,
            onnx_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes=dynamic_axes
        )
        
        # Verify ONNX model
        onnx_model = onnx.load(onnx_path)
        onnx.checker.check_model(onnx_model)
        
        logger.info(f"Model exported to ONNX: {onnx_path}")
        return onnx_path
    
    @staticmethod
    def create_lightning_module(
        model_class: type,
        config: ExportConfiguration
    ) -> 'pl.LightningModule':
        """Create PyTorch Lightning module wrapper"""
        
        if not HAS_LIGHTNING:
            raise ImportError("PyTorch Lightning not installed")
        
        class LightningWrapper(pl.LightningModule):
            def __init__(self, model_class, config):
                super().__init__()
                self.model = model_class()
                self.config = config
                self.save_hyperparameters()
            
            def forward(self, x):
                return self.model(x)
            
            def training_step(self, batch, batch_idx):
                x, y = batch
                y_hat = self(x)
                
                if self.config.task_type == TaskType.CLASSIFICATION:
                    loss = F.cross_entropy(y_hat, y)
                else:
                    loss = F.mse_loss(y_hat.squeeze(), y.float())
                
                self.log("train_loss", loss, prog_bar=True)
                return loss
            
            def validation_step(self, batch, batch_idx):
                x, y = batch
                y_hat = self(x)
                
                if self.config.task_type == TaskType.CLASSIFICATION:
                    loss = F.cross_entropy(y_hat, y)
                    preds = torch.argmax(y_hat, dim=1)
                    acc = torch.sum(preds == y).item() / len(y)
                    self.log("val_acc", acc, prog_bar=True)
                else:
                    loss = F.mse_loss(y_hat.squeeze(), y.float())
                
                self.log("val_loss", loss, prog_bar=True)
                return loss
            
            def configure_optimizers(self):
                optimizer = torch.optim.Adam(self.parameters(), lr=0.001)
                scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
                    optimizer, mode='min', patience=5, factor=0.5
                )
                return {
                    "optimizer": optimizer,
                    "lr_scheduler": scheduler,
                    "monitor": "val_loss"
                }
        
        return LightningWrapper(model_class, config)
    
    @staticmethod
    def _prepare_data_splits(
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Tuple[Any, Optional[Any]]]:
        """Prepare PyTorch tensor splits"""
        
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
        
        X_tensor = torch.from_numpy(X).float()
        
        # Prepare target
        y_tensor = None
        if config.target_column and config.target_column in df.columns:
            y_data = df[config.target_column].values
            
            if config.task_type == TaskType.CLASSIFICATION and y_data.dtype == 'object':
                le = LabelEncoder()
                y_data = le.fit_transform(y_data)
            
            if config.task_type == TaskType.CLASSIFICATION:
                y_tensor = torch.from_numpy(y_data).long()
            else:
                y_tensor = torch.from_numpy(y_data).float()
        
        # Create splits (similar to TensorFlow but with torch tensors)
        if config.time_series_split:
            n_samples = len(X_tensor)
            train_end = int(n_samples * config.train_ratio)
            val_end = int(n_samples * (config.train_ratio + config.validation_ratio))
            
            splits = {
                "train": (X_tensor[:train_end], y_tensor[:train_end] if y_tensor is not None else None),
                "validation": (X_tensor[train_end:val_end], y_tensor[train_end:val_end] if y_tensor is not None else None),
                "test": (X_tensor[val_end:], y_tensor[val_end:] if y_tensor is not None else None)
            }
        else:
            # Convert to numpy for sklearn split, then back to torch
            X_np = X_tensor.numpy()
            y_np = y_tensor.numpy() if y_tensor is not None else None
            
            stratify_data = y_np if config.stratify and y_np is not None else None
            
            X_train, X_temp, y_train, y_temp = train_test_split(
                X_np, y_np,
                test_size=(config.validation_ratio + config.test_ratio),
                random_state=42,
                stratify=stratify_data
            )
            
            if config.validation_ratio > 0:
                val_size = config.validation_ratio / (config.validation_ratio + config.test_ratio)
                stratify_temp = y_temp if config.stratify and y_temp is not None else None
                
                X_val, X_test, y_val, y_test = train_test_split(
                    X_temp, y_temp,
                    test_size=(1 - val_size),
                    random_state=42,
                    stratify=stratify_temp
                )
                
                splits = {
                    "train": (
                        torch.from_numpy(X_train).float(),
                        torch.from_numpy(y_train).long() if y_train is not None and config.task_type == TaskType.CLASSIFICATION else torch.from_numpy(y_train).float() if y_train is not None else None
                    ),
                    "validation": (
                        torch.from_numpy(X_val).float(),
                        torch.from_numpy(y_val).long() if y_val is not None and config.task_type == TaskType.CLASSIFICATION else torch.from_numpy(y_val).float() if y_val is not None else None
                    ),
                    "test": (
                        torch.from_numpy(X_test).float(),
                        torch.from_numpy(y_test).long() if y_test is not None and config.task_type == TaskType.CLASSIFICATION else torch.from_numpy(y_test).float() if y_test is not None else None
                    )
                }
            else:
                splits = {
                    "train": (
                        torch.from_numpy(X_train).float(),
                        torch.from_numpy(y_train).long() if y_train is not None and config.task_type == TaskType.CLASSIFICATION else torch.from_numpy(y_train).float() if y_train is not None else None
                    ),
                    "test": (
                        torch.from_numpy(X_temp).float(),
                        torch.from_numpy(y_temp).long() if y_temp is not None and config.task_type == TaskType.CLASSIFICATION else torch.from_numpy(y_temp).float() if y_temp is not None else None
                    )
                }
        
        return splits
    
    @staticmethod
    def _create_metadata(
        splits: Dict[str, Tuple[Any, Optional[Any]]],
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Create metadata for PyTorch export"""
        
        return {
            "framework": "pytorch",
            "task_type": config.task_type.value,
            "splits": {name: len(X) for name, (X, _) in splits.items()},
            "num_features": splits["train"][0].shape[1] if len(splits["train"][0].shape) > 1 else 1,
            "num_classes": len(torch.unique(splits["train"][1])) if splits["train"][1] is not None else None,
            "batch_size": config.batch_size,
            "data_format": config.data_format.value,
            "created_at": datetime.now().isoformat()
        }


class ScikitLearnIntegration:
    """Enhanced Scikit-learn integration with custom transformers and versioning"""
    
    @staticmethod
    def create_enhanced_pipeline(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_dir: str
    ) -> Dict[str, Any]:
        """Create enhanced sklearn pipeline with custom transformers"""
        
        # Identify column types
        if config.numerical_columns is None:
            numerical_columns = df.select_dtypes(include=[np.number]).columns.tolist()
            if config.target_column in numerical_columns:
                numerical_columns.remove(config.target_column)
        else:
            numerical_columns = config.numerical_columns
        
        if config.categorical_columns is None:
            categorical_columns = df.select_dtypes(include=['object']).columns.tolist()
            if config.target_column in categorical_columns:
                categorical_columns.remove(config.target_column)
        else:
            categorical_columns = config.categorical_columns
        
        # Create preprocessing pipeline
        numerical_transformer = Pipeline(steps=[
            ('scaler', StandardScaler()),
            ('custom', CustomTransformer(
                feature_engineering=config.feature_engineering,
                handle_outliers=True,
                create_interactions=False
            ))
        ])
        
        categorical_transformer = Pipeline(steps=[
            ('encoder', OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore'))
        ])
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numerical_transformer, numerical_columns),
                ('cat', categorical_transformer, categorical_columns)
            ],
            remainder='passthrough'
        )
        
        # Create full pipeline
        pipeline = Pipeline([
            ('preprocessor', preprocessor)
        ])
        
        # Prepare data splits
        splits = ScikitLearnIntegration._prepare_data_splits(df, config)
        
        # Fit pipeline on training data
        X_train, y_train = splits["train"]
        pipeline.fit(X_train)
        
        # Transform all splits
        transformed_splits = {}
        for split_name, (X, y) in splits.items():
            X_transformed = pipeline.transform(X)
            transformed_splits[split_name] = (X_transformed, y)
        
        # Save pipeline and data
        output_paths = ScikitLearnIntegration._save_pipeline_and_data(
            pipeline, transformed_splits, output_dir, config
        )
        
        # Create cross-validation folds if requested
        cv_folds = None
        if config.cross_validation_folds > 0:
            cv_folds = ScikitLearnIntegration._create_cv_folds(
                X_train, y_train, config
            )
        
        return {
            "pipeline": pipeline,
            "splits": transformed_splits,
            "cv_folds": cv_folds,
            "output_paths": output_paths,
            "feature_names": ScikitLearnIntegration._get_feature_names(pipeline),
            "metadata": ScikitLearnIntegration._create_metadata(transformed_splits, config)
        }
    
    @staticmethod
    def create_model_versioning(
        pipeline: Pipeline,
        model_name: str,
        version: str,
        output_dir: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """Create versioned model export with metadata"""
        
        version_dir = os.path.join(output_dir, "models", model_name, version)
        os.makedirs(version_dir, exist_ok=True)
        
        # Save pipeline
        pipeline_path = os.path.join(version_dir, "pipeline.pkl")
        joblib.dump(pipeline, pipeline_path)
        
        # Save metadata
        model_metadata = {
            "model_name": model_name,
            "version": version,
            "created_at": datetime.now().isoformat(),
            "sklearn_version": "1.3.0",  # Update as needed
            "pipeline_steps": [step[0] for step in pipeline.steps]
        }
        
        if metadata:
            model_metadata.update(metadata)
        
        metadata_path = os.path.join(version_dir, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(model_metadata, f, indent=2)
        
        # Create model registry entry
        registry_path = os.path.join(output_dir, "models", "registry.json")
        registry = {}
        
        if os.path.exists(registry_path):
            with open(registry_path, 'r') as f:
                registry = json.load(f)
        
        if model_name not in registry:
            registry[model_name] = {}
        
        registry[model_name][version] = {
            "path": version_dir,
            "created_at": model_metadata["created_at"],
            "status": "active"
        }
        
        with open(registry_path, 'w') as f:
            json.dump(registry, f, indent=2)
        
        return {
            "model_path": pipeline_path,
            "metadata_path": metadata_path,
            "registry_path": registry_path,
            "version_dir": version_dir
        }
    
    @staticmethod
    def _prepare_data_splits(
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Tuple[pd.DataFrame, Optional[pd.Series]]]:
        """Prepare data splits for sklearn"""
        
        # Select features
        if config.feature_columns:
            X = df[config.feature_columns]
        else:
            feature_cols = [col for col in df.columns if col != config.target_column]
            X = df[feature_cols]
        
        # Prepare target
        y = None
        if config.target_column and config.target_column in df.columns:
            y = df[config.target_column]
        
        # Create splits
        if config.time_series_split:
            n_samples = len(X)
            train_end = int(n_samples * config.train_ratio)
            val_end = int(n_samples * (config.train_ratio + config.validation_ratio))
            
            splits = {
                "train": (X.iloc[:train_end], y.iloc[:train_end] if y is not None else None),
                "validation": (X.iloc[train_end:val_end], y.iloc[train_end:val_end] if y is not None else None),
                "test": (X.iloc[val_end:], y.iloc[val_end:] if y is not None else None)
            }
        else:
            stratify_data = y if config.stratify and y is not None else None
            
            X_train, X_temp, y_train, y_temp = train_test_split(
                X, y,
                test_size=(config.validation_ratio + config.test_ratio),
                random_state=42,
                stratify=stratify_data
            )
            
            if config.validation_ratio > 0:
                val_size = config.validation_ratio / (config.validation_ratio + config.test_ratio)
                stratify_temp = y_temp if config.stratify and y_temp is not None else None
                
                X_val, X_test, y_val, y_test = train_test_split(
                    X_temp, y_temp,
                    test_size=(1 - val_size),
                    random_state=42,
                    stratify=stratify_temp
                )
                
                splits = {
                    "train": (X_train, y_train),
                    "validation": (X_val, y_val),
                    "test": (X_test, y_test)
                }
            else:
                splits = {
                    "train": (X_train, y_train),
                    "test": (X_temp, y_temp)
                }
        
        return splits
    
    @staticmethod
    def _create_cv_folds(
        X: pd.DataFrame,
        y: Optional[pd.Series],
        config: ExportConfiguration
    ) -> List[Tuple[np.ndarray, np.ndarray]]:
        """Create cross-validation folds"""
        
        if config.time_series_split:
            cv = TimeSeriesSplit(n_splits=config.cross_validation_folds)
        else:
            if y is not None and config.task_type == TaskType.CLASSIFICATION:
                cv = StratifiedKFold(n_splits=config.cross_validation_folds, shuffle=True, random_state=42)
            else:
                from sklearn.model_selection import KFold
                cv = KFold(n_splits=config.cross_validation_folds, shuffle=True, random_state=42)
        
        return list(cv.split(X, y))
    
    @staticmethod
    def _save_pipeline_and_data(
        pipeline: Pipeline,
        splits: Dict[str, Tuple[np.ndarray, Optional[np.ndarray]]],
        output_dir: str,
        config: ExportConfiguration
    ) -> Dict[str, str]:
        """Save pipeline and transformed data"""
        
        output_paths = {}
        
        # Save pipeline
        pipeline_path = os.path.join(output_dir, "pipeline.pkl")
        joblib.dump(pipeline, pipeline_path)
        output_paths["pipeline"] = pipeline_path
        
        # Save splits in different formats
        for split_name, (X, y) in splits.items():
            if config.data_format == DataFormat.NUMPY:
                X_path = os.path.join(output_dir, f"{split_name}_X.npy")
                np.save(X_path, X)
                output_paths[f"{split_name}_X"] = X_path
                
                if y is not None:
                    y_path = os.path.join(output_dir, f"{split_name}_y.npy")
                    np.save(y_path, y)
                    output_paths[f"{split_name}_y"] = y_path
            
            elif config.data_format == DataFormat.PICKLE:
                split_path = os.path.join(output_dir, f"{split_name}_data.pkl")
                with open(split_path, 'wb') as f:
                    pickle.dump((X, y), f)
                output_paths[f"{split_name}_data"] = split_path
            
            elif config.data_format == DataFormat.HDF5 and HAS_HDF5:
                hdf5_path = os.path.join(output_dir, f"{split_name}_data.h5")
                with h5py.File(hdf5_path, 'w') as f:
                    f.create_dataset('X', data=X)
                    if y is not None:
                        f.create_dataset('y', data=y)
                output_paths[f"{split_name}_data"] = hdf5_path
        
        return output_paths
    
    @staticmethod
    def _get_feature_names(pipeline: Pipeline) -> List[str]:
        """Get feature names from fitted pipeline"""
        
        try:
            if hasattr(pipeline, 'get_feature_names_out'):
                return pipeline.get_feature_names_out().tolist()
            elif hasattr(pipeline.named_steps['preprocessor'], 'get_feature_names_out'):
                return pipeline.named_steps['preprocessor'].get_feature_names_out().tolist()
            else:
                return []
        except Exception:
            return []
    
    @staticmethod
    def _create_metadata(
        splits: Dict[str, Tuple[np.ndarray, Optional[np.ndarray]]],
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Create metadata for sklearn export"""
        
        return {
            "framework": "scikit_learn",
            "task_type": config.task_type.value,
            "splits": {name: len(X) for name, (X, _) in splits.items()},
            "num_features": splits["train"][0].shape[1],
            "num_classes": len(np.unique(splits["train"][1])) if splits["train"][1] is not None else None,
            "data_format": config.data_format.value,
            "created_at": datetime.now().isoformat()
        }


class MultiFormatExporter:
    """Multi-format data export functionality"""
    
    @staticmethod
    def export_to_multiple_formats(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_dir: str,
        formats: List[DataFormat]
    ) -> Dict[str, Dict[str, str]]:
        """Export data to multiple formats simultaneously"""
        
        export_results = {}
        
        # Prepare splits once
        splits = MultiFormatExporter._prepare_splits(df, config)
        
        for data_format in formats:
            format_dir = os.path.join(output_dir, data_format.value)
            os.makedirs(format_dir, exist_ok=True)
            
            export_results[data_format.value] = MultiFormatExporter._export_format(
                splits, data_format, format_dir, config
            )
        
        return export_results
    
    @staticmethod
    def create_balanced_splits(
        df: pd.DataFrame,
        config: ExportConfiguration,
        output_dir: str
    ) -> Dict[str, Any]:
        """Create balanced splits for imbalanced datasets"""
        
        if config.target_column not in df.columns:
            raise ValueError("Target column required for balanced splitting")
        
        y = df[config.target_column]
        
        # Calculate class distribution
        class_counts = y.value_counts()
        min_class_count = class_counts.min()
        
        # Undersample majority classes
        balanced_dfs = []
        for class_label in class_counts.index:
            class_df = df[df[config.target_column] == class_label]
            sampled_df = class_df.sample(n=min_class_count, random_state=42)
            balanced_dfs.append(sampled_df)
        
        balanced_df = pd.concat(balanced_dfs, ignore_index=True)
        balanced_df = balanced_df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        # Create splits from balanced data
        splits = MultiFormatExporter._prepare_splits(balanced_df, config)
        
        # Save balanced splits
        output_paths = {}
        for split_name, split_df in splits.items():
            split_path = os.path.join(output_dir, f"{split_name}_balanced.csv")
            split_df.to_csv(split_path, index=False)
            output_paths[split_name] = split_path
        
        return {
            "balanced_splits": splits,
            "output_paths": output_paths,
            "balance_info": {
                "original_distribution": class_counts.to_dict(),
                "balanced_count_per_class": min_class_count,
                "total_balanced_samples": len(balanced_df)
            }
        }
    
    @staticmethod
    def _prepare_splits(
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, pd.DataFrame]:
        """Prepare DataFrame splits"""
        
        if config.time_series_split:
            n_samples = len(df)
            train_end = int(n_samples * config.train_ratio)
            val_end = int(n_samples * (config.train_ratio + config.validation_ratio))
            
            splits = {
                "train": df.iloc[:train_end].copy(),
                "validation": df.iloc[train_end:val_end].copy(),
                "test": df.iloc[val_end:].copy()
            }
        else:
            stratify_col = config.target_column if config.stratify and config.target_column in df.columns else None
            
            train_df, temp_df = train_test_split(
                df,
                test_size=(config.validation_ratio + config.test_ratio),
                random_state=42,
                stratify=df[stratify_col] if stratify_col else None
            )
            
            if config.validation_ratio > 0:
                val_size = config.validation_ratio / (config.validation_ratio + config.test_ratio)
                val_df, test_df = train_test_split(
                    temp_df,
                    test_size=(1 - val_size),
                    random_state=42,
                    stratify=temp_df[stratify_col] if stratify_col else None
                )
                
                splits = {
                    "train": train_df,
                    "validation": val_df,
                    "test": test_df
                }
            else:
                splits = {
                    "train": train_df,
                    "test": temp_df
                }
        
        return splits
    
    @staticmethod
    def _export_format(
        splits: Dict[str, pd.DataFrame],
        data_format: DataFormat,
        output_dir: str,
        config: ExportConfiguration
    ) -> Dict[str, str]:
        """Export splits to specific format"""
        
        output_paths = {}
        
        for split_name, split_df in splits.items():
            if data_format == DataFormat.CSV:
                file_path = os.path.join(output_dir, f"{split_name}.csv")
                split_df.to_csv(file_path, index=False)
                
            elif data_format == DataFormat.PARQUET and HAS_ARROW:
                file_path = os.path.join(output_dir, f"{split_name}.parquet")
                split_df.to_parquet(file_path, compression=config.compression)
                
            elif data_format == DataFormat.JSON:
                file_path = os.path.join(output_dir, f"{split_name}.json")
                split_df.to_json(file_path, orient='records', indent=2)
                
            elif data_format == DataFormat.PICKLE:
                file_path = os.path.join(output_dir, f"{split_name}.pkl")
                split_df.to_pickle(file_path)
                
            elif data_format == DataFormat.HDF5 and HAS_HDF5:
                file_path = os.path.join(output_dir, f"{split_name}.h5")
                split_df.to_hdf(file_path, key='data', mode='w', complevel=9)
                
            else:
                # Default to CSV
                file_path = os.path.join(output_dir, f"{split_name}.csv")
                split_df.to_csv(file_path, index=False)
            
            output_paths[split_name] = file_path
        
        return output_paths


class ModelServingPreparation:
    """Model serving preparation and containerization"""
    
    @staticmethod
    def create_serving_package(
        model_path: str,
        preprocessing_pipeline_path: str,
        config: ModelServingConfig,
        output_dir: str
    ) -> Dict[str, str]:
        """Create complete serving package"""
        
        serving_dir = os.path.join(output_dir, f"{config.model_name}_{config.model_version}")
        os.makedirs(serving_dir, exist_ok=True)
        
        # Copy model and pipeline
        model_serving_path = os.path.join(serving_dir, "model")
        if os.path.isdir(model_path):
            import shutil
            shutil.copytree(model_path, model_serving_path)
        else:
            import shutil
            shutil.copy2(model_path, model_serving_path)
        
        pipeline_serving_path = os.path.join(serving_dir, "preprocessing_pipeline.pkl")
        import shutil
        shutil.copy2(preprocessing_pipeline_path, pipeline_serving_path)
        
        # Create serving configuration
        serving_config = {
            "model_name": config.model_name,
            "model_version": config.model_version,
            "framework": config.serving_framework,
            "batch_size": config.batch_size,
            "max_latency_ms": config.max_latency_ms,
            "enable_gpu": config.enable_gpu,
            "input_signature": config.input_signature,
            "output_signature": config.output_signature,
            "model_path": "model",
            "preprocessing_pipeline_path": "preprocessing_pipeline.pkl"
        }
        
        config_path = os.path.join(serving_dir, "serving_config.json")
        with open(config_path, 'w') as f:
            json.dump(serving_config, f, indent=2)
        
        # Create serving script
        serving_script = ModelServingPreparation._create_serving_script(config)
        script_path = os.path.join(serving_dir, "serve.py")
        with open(script_path, 'w') as f:
            f.write(serving_script)
        
        # Create requirements.txt
        requirements = ModelServingPreparation._create_requirements(config)
        requirements_path = os.path.join(serving_dir, "requirements.txt")
        with open(requirements_path, 'w') as f:
            f.write(requirements)
        
        # Create Dockerfile if requested
        dockerfile_path = None
        if config.docker_config:
            dockerfile_path = ModelServingPreparation._create_dockerfile(
                config, serving_dir
            )
        
        return {
            "serving_directory": serving_dir,
            "model_path": model_serving_path,
            "pipeline_path": pipeline_serving_path,
            "config_path": config_path,
            "script_path": script_path,
            "requirements_path": requirements_path,
            "dockerfile_path": dockerfile_path
        }
    
    @staticmethod
    def _create_serving_script(config: ModelServingConfig) -> str:
        """Create serving script based on framework"""
        
        if config.serving_framework == "tensorflow_serving":
            return '''#!/usr/bin/env python3
"""
TensorFlow Serving script for model deployment
"""
import json
import joblib
import tensorflow as tf
from flask import Flask, request, jsonify
import numpy as np

app = Flask(__name__)

# Load model and preprocessing pipeline
model = tf.saved_model.load("model")
preprocessing_pipeline = joblib.load("preprocessing_pipeline.pkl")

with open("serving_config.json", "r") as f:
    config = json.load(f)

@app.route("/predict", methods=["POST"])
def predict():
    try:
        # Get input data
        data = request.get_json()
        
        # Preprocess input
        input_data = np.array(data["instances"])
        preprocessed_data = preprocessing_pipeline.transform(input_data)
        
        # Make prediction
        predictions = model(preprocessed_data).numpy()
        
        return jsonify({
            "predictions": predictions.tolist()
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8501)
'''
        
        elif config.serving_framework == "torchserve":
            return '''#!/usr/bin/env python3
"""
TorchServe handler for model deployment
"""
import json
import joblib
import torch
import numpy as np
from ts.torch_handler.base_handler import BaseHandler

class CustomModelHandler(BaseHandler):
    def __init__(self):
        super().__init__()
        self.preprocessing_pipeline = None
    
    def initialize(self, context):
        """Initialize model and preprocessing pipeline"""
        super().initialize(context)
        
        # Load preprocessing pipeline
        self.preprocessing_pipeline = joblib.load("preprocessing_pipeline.pkl")
    
    def preprocess(self, data):
        """Preprocess input data"""
        # Extract input data
        input_data = []
        for item in data:
            input_data.append(json.loads(item["body"])["data"])
        
        # Convert to numpy and preprocess
        input_array = np.array(input_data)
        preprocessed_data = self.preprocessing_pipeline.transform(input_array)
        
        # Convert to tensor
        return torch.from_numpy(preprocessed_data).float()
    
    def inference(self, data):
        """Run inference"""
        with torch.no_grad():
            predictions = self.model(data)
        return predictions
    
    def postprocess(self, data):
        """Postprocess predictions"""
        return [prediction.tolist() for prediction in data]

_handler = CustomModelHandler()

def handle(data, context):
    if not _handler.initialized:
        _handler.initialize(context)
    
    if data is None:
        return None
    
    preprocessed_data = _handler.preprocess(data)
    predictions = _handler.inference(preprocessed_data)
    return _handler.postprocess(predictions)
'''
        
        else:  # Generic serving script
            return '''#!/usr/bin/env python3
"""
Generic model serving script
"""
import json
import joblib
import pickle
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load components
try:
    # Try different model formats
    model = joblib.load("model") if "model.pkl" in os.listdir(".") else pickle.load(open("model.pkl", "rb"))
except:
    model = None

preprocessing_pipeline = joblib.load("preprocessing_pipeline.pkl")

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        input_data = np.array(data["instances"])
        
        # Preprocess
        preprocessed_data = preprocessing_pipeline.transform(input_data)
        
        # Predict
        predictions = model.predict(preprocessed_data)
        
        return jsonify({"predictions": predictions.tolist()})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
'''
    
    @staticmethod
    def _create_requirements(config: ModelServingConfig) -> str:
        """Create requirements.txt based on framework"""
        
        base_requirements = [
            "numpy>=1.21.0",
            "pandas>=1.3.0",
            "scikit-learn>=1.0.0",
            "flask>=2.0.0",
            "joblib>=1.1.0"
        ]
        
        if config.serving_framework == "tensorflow_serving":
            base_requirements.extend([
                "tensorflow>=2.8.0",
                "tensorflow-serving-api>=2.8.0"
            ])
        elif config.serving_framework == "torchserve":
            base_requirements.extend([
                "torch>=1.11.0",
                "torchserve>=0.6.0",
                "torch-model-archiver>=0.6.0"
            ])
        
        return "\n".join(base_requirements)
    
    @staticmethod
    def _create_dockerfile(config: ModelServingConfig, serving_dir: str) -> str:
        """Create Dockerfile for containerized deployment"""
        
        dockerfile_content = f'''FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model artifacts
COPY . .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run serving script
CMD ["python", "serve.py"]
'''
        
        dockerfile_path = os.path.join(serving_dir, "Dockerfile")
        with open(dockerfile_path, 'w') as f:
            f.write(dockerfile_content)
        
        return dockerfile_path


class MLFrameworkIntegration:
    """Main ML Framework Integration Service"""
    
    def __init__(self):
        self.supported_frameworks = {
            MLFrameworkType.TENSORFLOW: HAS_TENSORFLOW,
            MLFrameworkType.PYTORCH: HAS_PYTORCH,
            MLFrameworkType.SCIKIT_LEARN: True,  # Always available
            MLFrameworkType.ONNX: HAS_ONNX
        }
        
        self.executor = ThreadPoolExecutor(max_workers=4)
        logger.info("ML Framework Integration initialized")
    
    async def export_for_framework(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Main export function for any framework"""
        
        start_time = datetime.now()
        
        try:
            # Validate configuration
            self._validate_config(config)
            
            # Create output directory
            if not config.output_directory:
                config.output_directory = tempfile.mkdtemp(
                    prefix=f"{config.framework.value}_export_"
                )
            
            os.makedirs(config.output_directory, exist_ok=True)
            
            # Export based on framework
            if config.framework == MLFrameworkType.TENSORFLOW:
                result = await self._export_tensorflow(df, config)
            elif config.framework == MLFrameworkType.PYTORCH:
                result = await self._export_pytorch(df, config)
            elif config.framework == MLFrameworkType.SCIKIT_LEARN:
                result = await self._export_sklearn(df, config)
            else:
                raise ValueError(f"Framework {config.framework.value} not supported")
            
            # Create serving package if requested
            if config.create_serving_config and config.serving_config:
                serving_result = ModelServingPreparation.create_serving_package(
                    model_path=result.get("model_path", ""),
                    preprocessing_pipeline_path=result.get("pipeline_path", ""),
                    config=config.serving_config,
                    output_dir=config.output_directory
                )
                result["serving_package"] = serving_result
            
            # Calculate export time
            export_time = (datetime.now() - start_time).total_seconds()
            result["export_time_seconds"] = export_time
            result["success"] = True
            
            logger.info(f"Export completed successfully in {export_time:.2f} seconds")
            return result
            
        except Exception as e:
            logger.error(f"Export failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "export_time_seconds": (datetime.now() - start_time).total_seconds()
            }
    
    async def _export_tensorflow(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Export for TensorFlow"""
        
        if not self.supported_frameworks[MLFrameworkType.TENSORFLOW]:
            raise ImportError("TensorFlow not available")
        
        result = await asyncio.get_event_loop().run_in_executor(
            self.executor,
            TensorFlowIntegration.create_tf_data_pipeline,
            df, config, config.output_directory
        )
        
        # Add TF Transform pipeline if requested
        if config.feature_engineering:
            tf_transform_result = TensorFlowIntegration.create_tf_transform_pipeline(
                df, config, config.output_directory
            )
            result["tf_transform"] = tf_transform_result
        
        return result
    
    async def _export_pytorch(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Export for PyTorch"""
        
        if not self.supported_frameworks[MLFrameworkType.PYTORCH]:
            raise ImportError("PyTorch not available")
        
        result = await asyncio.get_event_loop().run_in_executor(
            self.executor,
            PyTorchIntegration.create_pytorch_datasets,
            df, config, config.output_directory
        )
        
        # Create Lightning module if requested
        if HAS_LIGHTNING and config.distributed_training:
            # This would need a model class, which would be provided separately
            logger.info("PyTorch Lightning support available for distributed training")
        
        return result
    
    async def _export_sklearn(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Export for Scikit-learn"""
        
        result = await asyncio.get_event_loop().run_in_executor(
            self.executor,
            ScikitLearnIntegration.create_enhanced_pipeline,
            df, config, config.output_directory
        )
        
        # Create model versioning if requested
        if config.serving_config:
            versioning_result = ScikitLearnIntegration.create_model_versioning(
                pipeline=result["pipeline"],
                model_name=config.serving_config.model_name,
                version=config.serving_config.model_version,
                output_dir=config.output_directory,
                metadata=result["metadata"]
            )
            result["versioning"] = versioning_result
        
        return result
    
    def export_multiple_formats(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration,
        formats: List[DataFormat]
    ) -> Dict[str, Any]:
        """Export data to multiple formats"""
        
        if not config.output_directory:
            config.output_directory = tempfile.mkdtemp(prefix="multi_format_export_")
        
        return MultiFormatExporter.export_to_multiple_formats(
            df, config, config.output_directory, formats
        )
    
    def create_balanced_dataset(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration
    ) -> Dict[str, Any]:
        """Create balanced dataset for imbalanced data"""
        
        if not config.output_directory:
            config.output_directory = tempfile.mkdtemp(prefix="balanced_export_")
        
        return MultiFormatExporter.create_balanced_splits(
            df, config, config.output_directory
        )
    
    def get_framework_capabilities(self) -> Dict[str, Any]:
        """Get capabilities of available frameworks"""
        
        capabilities = {}
        
        for framework, available in self.supported_frameworks.items():
            capabilities[framework.value] = {
                "available": available,
                "features": self._get_framework_features(framework),
                "optimal_use_cases": self._get_optimal_use_cases(framework)
            }
        
        return capabilities
    
    def _validate_config(self, config: ExportConfiguration):
        """Validate export configuration"""
        
        if not self.supported_frameworks.get(config.framework, False):
            raise ValueError(f"Framework {config.framework.value} not available")
        
        if config.train_ratio + config.validation_ratio + config.test_ratio != 1.0:
            raise ValueError("Train, validation, and test ratios must sum to 1.0")
        
        if config.batch_size <= 0:
            raise ValueError("Batch size must be positive")
    
    def _get_framework_features(self, framework: MLFrameworkType) -> List[str]:
        """Get features supported by framework"""
        
        features_map = {
            MLFrameworkType.TENSORFLOW: [
                "tf.data.Dataset", "SavedModel", "TF Transform", "TFX",
                "GPU acceleration", "TPU support", "TensorFlow Serving"
            ],
            MLFrameworkType.PYTORCH: [
                "Custom Dataset", "DataLoader", "TorchScript", "ONNX export",
                "PyTorch Lightning", "Distributed training", "Mixed precision"
            ],
            MLFrameworkType.SCIKIT_LEARN: [
                "Pipeline export", "Custom transformers", "Model versioning",
                "Cross-validation", "Feature selection", "Grid search"
            ]
        }
        
        return features_map.get(framework, [])
    
    def _get_optimal_use_cases(self, framework: MLFrameworkType) -> List[str]:
        """Get optimal use cases for framework"""
        
        use_cases_map = {
            MLFrameworkType.TENSORFLOW: [
                "Large scale deep learning", "Production deployment",
                "Computer vision", "NLP", "Time series", "Structured data"
            ],
            MLFrameworkType.PYTORCH: [
                "Research", "Computer vision", "NLP", "Reinforcement learning",
                "Dynamic networks", "Custom architectures"
            ],
            MLFrameworkType.SCIKIT_LEARN: [
                "Classical ML", "Small to medium datasets", "Tabular data",
                "Preprocessing pipelines", "Model comparison", "Feature engineering"
            ]
        }
        
        return use_cases_map.get(framework, [])
    
    def __del__(self):
        """Cleanup resources"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=True)


# Global instance
ml_framework_integration = MLFrameworkIntegration()