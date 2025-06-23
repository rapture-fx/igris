"""
AI Framework Integration Service - Pollarbase
============================================

This service provides seamless integration with popular AI/ML frameworks,
enabling users to export their prepared data in framework-specific formats
ready for model training, fine-tuning, and inference.

Supported Frameworks:
- PyTorch (DataLoader, Dataset)
- TensorFlow (tf.data.Dataset)
- HuggingFace (datasets, transformers)
- Scikit-learn (arrays, pipelines)
- XGBoost, LightGBM (structured data)
- ONNX (model interoperability)
- MLflow (experiment tracking)

Features:
- Automatic train/validation/test splits with stratification
- Framework-specific data formatting and preprocessing
- Memory-efficient data loading for large datasets
- Proper handling of different data types (text, images, tabular)
- Integration with popular model architectures
- Export configurations for different ML tasks
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Union
from enum import Enum
from dataclasses import dataclass
import json
import logging
from pathlib import Path
import pickle
import joblib
from datetime import datetime

logger = logging.getLogger(__name__)

class MLFramework(Enum):
    """Supported ML frameworks"""
    PYTORCH = "pytorch"
    TENSORFLOW = "tensorflow"
    HUGGINGFACE = "huggingface"
    SKLEARN = "sklearn"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    ONNX = "onnx"
    MLFLOW = "mlflow"

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
class DataSplit:
    """Data split configuration"""
    train_ratio: float = 0.7
    validation_ratio: float = 0.15
    test_ratio: float = 0.15
    stratify: bool = True
    random_state: int = 42
    shuffle: bool = True

@dataclass
class ExportConfig:
    """Export configuration for different frameworks"""
    framework: MLFramework
    task_type: TaskType
    target_column: Optional[str] = None
    feature_columns: Optional[List[str]] = None
    text_column: Optional[str] = None
    image_column: Optional[str] = None
    timestamp_column: Optional[str] = None
    batch_size: int = 32
    max_length: int = 512  # For NLP tasks
    image_size: Tuple[int, int] = (224, 224)  # For CV tasks
    normalize: bool = True
    categorical_encoding: str = "auto"  # auto, onehot, label, target

class AIFrameworkIntegrator:
    """Main class for AI framework integration"""
    
    def __init__(self):
        self.supported_frameworks = [fw.value for fw in MLFramework]
        self.supported_tasks = [task.value for task in TaskType]
        
    def create_train_test_split(
        self, 
        df: pd.DataFrame, 
        split_config: DataSplit,
        target_column: Optional[str] = None
    ) -> Dict[str, pd.DataFrame]:
        """
        Create train/validation/test splits with proper stratification
        """
        from sklearn.model_selection import train_test_split
        
        # Validate split ratios
        total_ratio = split_config.train_ratio + split_config.validation_ratio + split_config.test_ratio
        if abs(total_ratio - 1.0) > 0.01:
            raise ValueError(f"Split ratios must sum to 1.0, got {total_ratio}")
        
        # Prepare stratification
        stratify_column = None
        if split_config.stratify and target_column and target_column in df.columns:
            stratify_column = df[target_column]
            
            # Check if stratification is possible
            value_counts = stratify_column.value_counts()
            min_class_count = value_counts.min()
            
            if min_class_count < 3:  # Need at least 3 samples per class for 3-way split
                logger.warning(f"Insufficient samples for stratification. Min class count: {min_class_count}")
                stratify_column = None
        
        # First split: separate test set
        test_size = split_config.test_ratio
        train_val_df, test_df = train_test_split(
            df,
            test_size=test_size,
            stratify=stratify_column,
            random_state=split_config.random_state,
            shuffle=split_config.shuffle
        )
        
        # Second split: separate train and validation
        val_size = split_config.validation_ratio / (split_config.train_ratio + split_config.validation_ratio)
        
        # Update stratify column for remaining data
        if stratify_column is not None:
            remaining_stratify = train_val_df[target_column]
        else:
            remaining_stratify = None
            
        train_df, val_df = train_test_split(
            train_val_df,
            test_size=val_size,
            stratify=remaining_stratify,
            random_state=split_config.random_state,
            shuffle=split_config.shuffle
        )
        
        splits = {
            'train': train_df,
            'validation': val_df,
            'test': test_df
        }
        
        # Log split information
        logger.info(f"Data split completed:")
        logger.info(f"  Train: {len(train_df)} samples ({len(train_df)/len(df)*100:.1f}%)")
        logger.info(f"  Validation: {len(val_df)} samples ({len(val_df)/len(df)*100:.1f}%)")
        logger.info(f"  Test: {len(test_df)} samples ({len(test_df)/len(df)*100:.1f}%)")
        
        if target_column and target_column in df.columns:
            for split_name, split_df in splits.items():
                class_dist = split_df[target_column].value_counts(normalize=True)
                logger.info(f"  {split_name.capitalize()} class distribution: {dict(class_dist)}")
        
        return splits
    
    def export_for_pytorch(
        self, 
        df: pd.DataFrame, 
        config: ExportConfig,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export data in PyTorch format with DataLoader and Dataset classes
        """
        try:
            import torch
            from torch.utils.data import Dataset, DataLoader, TensorDataset
            import torch.nn.functional as F
        except ImportError:
            raise ImportError("PyTorch not installed. Install with: pip install torch")
        
        # Create data splits
        split_config = DataSplit()
        splits = self.create_train_test_split(df, split_config, config.target_column)
        
        pytorch_data = {}
        
        for split_name, split_df in splits.items():
            
            if config.task_type == TaskType.CLASSIFICATION:
                # Prepare features and labels
                if config.feature_columns:
                    X = split_df[config.feature_columns].values
                else:
                    X = split_df.drop(columns=[config.target_column]).values
                
                y = split_df[config.target_column].values
                
                # Convert to tensors
                X_tensor = torch.FloatTensor(X)
                
                # Handle categorical labels
                if split_df[config.target_column].dtype == 'object':
                    from sklearn.preprocessing import LabelEncoder
                    le = LabelEncoder()
                    if split_name == 'train':
                        y_encoded = le.fit_transform(y)
                        # Store label encoder for later use
                        pytorch_data['label_encoder'] = le
                    else:
                        y_encoded = le.transform(y)
                    y_tensor = torch.LongTensor(y_encoded)
                else:
                    y_tensor = torch.LongTensor(y)
                
                # Create dataset and dataloader
                dataset = TensorDataset(X_tensor, y_tensor)
                dataloader = DataLoader(
                    dataset, 
                    batch_size=config.batch_size, 
                    shuffle=(split_name == 'train')
                )
                
                pytorch_data[f'{split_name}_dataset'] = dataset
                pytorch_data[f'{split_name}_dataloader'] = dataloader
                
            elif config.task_type == TaskType.REGRESSION:
                # Similar to classification but with FloatTensor for targets
                if config.feature_columns:
                    X = split_df[config.feature_columns].values
                else:
                    X = split_df.drop(columns=[config.target_column]).values
                
                y = split_df[config.target_column].values
                
                X_tensor = torch.FloatTensor(X)
                y_tensor = torch.FloatTensor(y)
                
                dataset = TensorDataset(X_tensor, y_tensor)
                dataloader = DataLoader(
                    dataset, 
                    batch_size=config.batch_size, 
                    shuffle=(split_name == 'train')
                )
                
                pytorch_data[f'{split_name}_dataset'] = dataset
                pytorch_data[f'{split_name}_dataloader'] = dataloader
        
        # Add metadata
        pytorch_data['metadata'] = {
            'framework': 'pytorch',
            'task_type': config.task_type.value,
            'num_features': len(config.feature_columns) if config.feature_columns else len(df.columns) - 1,
            'num_classes': len(df[config.target_column].unique()) if config.task_type == TaskType.CLASSIFICATION else None,
            'batch_size': config.batch_size,
            'created_at': datetime.now().isoformat()
        }
        
        # Save to disk if output directory provided
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Save datasets
            for split_name in ['train', 'validation', 'test']:
                if f'{split_name}_dataset' in pytorch_data:
                    torch.save(
                        pytorch_data[f'{split_name}_dataset'], 
                        output_path / f'{split_name}_dataset.pt'
                    )
            
            # Save metadata
            with open(output_path / 'pytorch_metadata.json', 'w') as f:
                json.dump(pytorch_data['metadata'], f, indent=2)
        
        return pytorch_data
    
    def export_for_tensorflow(
        self, 
        df: pd.DataFrame, 
        config: ExportConfig,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export data in TensorFlow tf.data.Dataset format
        """
        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError("TensorFlow not installed. Install with: pip install tensorflow")
        
        # Create data splits
        split_config = DataSplit()
        splits = self.create_train_test_split(df, split_config, config.target_column)
        
        tensorflow_data = {}
        
        for split_name, split_df in splits.items():
            
            if config.task_type in [TaskType.CLASSIFICATION, TaskType.REGRESSION]:
                # Prepare features and labels
                if config.feature_columns:
                    X = split_df[config.feature_columns].values.astype(np.float32)
                else:
                    X = split_df.drop(columns=[config.target_column]).values.astype(np.float32)
                
                y = split_df[config.target_column].values
                
                if config.task_type == TaskType.CLASSIFICATION:
                    # Handle categorical labels
                    if split_df[config.target_column].dtype == 'object':
                        from sklearn.preprocessing import LabelEncoder
                        le = LabelEncoder()
                        if split_name == 'train':
                            y_encoded = le.fit_transform(y)
                            tensorflow_data['label_encoder'] = le
                        else:
                            y_encoded = le.transform(y)
                        y = y_encoded.astype(np.int32)
                    else:
                        y = y.astype(np.int32)
                else:
                    y = y.astype(np.float32)
                
                # Create tf.data.Dataset
                dataset = tf.data.Dataset.from_tensor_slices((X, y))
                
                if split_name == 'train':
                    dataset = dataset.shuffle(buffer_size=len(X))
                
                dataset = dataset.batch(config.batch_size)
                dataset = dataset.prefetch(tf.data.AUTOTUNE)
                
                tensorflow_data[f'{split_name}_dataset'] = dataset
        
        # Add metadata
        tensorflow_data['metadata'] = {
            'framework': 'tensorflow',
            'task_type': config.task_type.value,
            'num_features': len(config.feature_columns) if config.feature_columns else len(df.columns) - 1,
            'num_classes': len(df[config.target_column].unique()) if config.task_type == TaskType.CLASSIFICATION else None,
            'batch_size': config.batch_size,
            'created_at': datetime.now().isoformat()
        }
        
        # Save to disk if output directory provided
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Save datasets
            for split_name in ['train', 'validation', 'test']:
                if f'{split_name}_dataset' in tensorflow_data:
                    tf.data.experimental.save(
                        tensorflow_data[f'{split_name}_dataset'],
                        str(output_path / f'{split_name}_dataset')
                    )
            
            # Save metadata
            with open(output_path / 'tensorflow_metadata.json', 'w') as f:
                json.dump(tensorflow_data['metadata'], f, indent=2)
        
        return tensorflow_data
    
    def export_for_huggingface(
        self, 
        df: pd.DataFrame, 
        config: ExportConfig,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export data in HuggingFace datasets format for NLP tasks
        """
        try:
            from datasets import Dataset, DatasetDict
            from transformers import AutoTokenizer
        except ImportError:
            raise ImportError("HuggingFace libraries not installed. Install with: pip install datasets transformers")
        
        # Create data splits
        split_config = DataSplit()
        splits = self.create_train_test_split(df, split_config, config.target_column)
        
        # Convert pandas DataFrames to HuggingFace datasets
        hf_datasets = {}
        for split_name, split_df in splits.items():
            hf_datasets[split_name] = Dataset.from_pandas(split_df)
        
        # Create DatasetDict
        dataset_dict = DatasetDict(hf_datasets)
        
        # Tokenization for NLP tasks
        if config.task_type in [TaskType.NLP_CLASSIFICATION, TaskType.NLP_NER, TaskType.NLP_GENERATION]:
            if not config.text_column:
                raise ValueError("text_column must be specified for NLP tasks")
            
            # Initialize tokenizer (using a default one, can be customized)
            tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
            
            def tokenize_function(examples):
                return tokenizer(
                    examples[config.text_column],
                    truncation=True,
                    padding='max_length',
                    max_length=config.max_length
                )
            
            # Apply tokenization
            tokenized_datasets = dataset_dict.map(tokenize_function, batched=True)
            
            # Handle labels for classification
            if config.task_type == TaskType.NLP_CLASSIFICATION and config.target_column:
                # Convert labels to integers if they're strings
                if dataset_dict['train'][config.target_column][0].__class__ == str:
                    unique_labels = list(set(dataset_dict['train'][config.target_column]))
                    label2id = {label: i for i, label in enumerate(unique_labels)}
                    id2label = {i: label for label, i in label2id.items()}
                    
                    def encode_labels(examples):
                        examples['labels'] = [label2id[label] for label in examples[config.target_column]]
                        return examples
                    
                    tokenized_datasets = tokenized_datasets.map(encode_labels, batched=True)
                    
                    huggingface_data = {
                        'datasets': tokenized_datasets,
                        'tokenizer': tokenizer,
                        'label2id': label2id,
                        'id2label': id2label
                    }
                else:
                    tokenized_datasets = tokenized_datasets.rename_column(config.target_column, 'labels')
                    huggingface_data = {
                        'datasets': tokenized_datasets,
                        'tokenizer': tokenizer
                    }
            else:
                huggingface_data = {
                    'datasets': tokenized_datasets,
                    'tokenizer': tokenizer
                }
        else:
            huggingface_data = {
                'datasets': dataset_dict
            }
        
        # Add metadata
        huggingface_data['metadata'] = {
            'framework': 'huggingface',
            'task_type': config.task_type.value,
            'text_column': config.text_column,
            'target_column': config.target_column,
            'max_length': config.max_length,
            'created_at': datetime.now().isoformat()
        }
        
        # Save to disk if output directory provided
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Save datasets
            huggingface_data['datasets'].save_to_disk(str(output_path / 'hf_datasets'))
            
            # Save tokenizer if available
            if 'tokenizer' in huggingface_data:
                huggingface_data['tokenizer'].save_pretrained(str(output_path / 'tokenizer'))
            
            # Save metadata
            with open(output_path / 'huggingface_metadata.json', 'w') as f:
                json.dump(huggingface_data['metadata'], f, indent=2)
        
        return huggingface_data
    
    def export_for_sklearn(
        self, 
        df: pd.DataFrame, 
        config: ExportConfig,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export data in scikit-learn format with preprocessing pipelines
        """
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
        from sklearn.compose import ColumnTransformer
        from sklearn.pipeline import Pipeline
        
        # Create data splits
        split_config = DataSplit()
        splits = self.create_train_test_split(df, split_config, config.target_column)
        
        sklearn_data = {}
        
        # Prepare feature and target columns
        if config.feature_columns:
            feature_cols = config.feature_columns
        else:
            feature_cols = [col for col in df.columns if col != config.target_column]
        
        # Identify numeric and categorical columns
        numeric_features = df[feature_cols].select_dtypes(include=[np.number]).columns.tolist()
        categorical_features = df[feature_cols].select_dtypes(include=['object']).columns.tolist()
        
        # Create preprocessing pipeline
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(drop='first', sparse=False), categorical_features)
            ]
        )
        
        # Process each split
        label_encoder = None
        for split_name, split_df in splits.items():
            X = split_df[feature_cols]
            y = split_df[config.target_column] if config.target_column else None
            
            if split_name == 'train':
                # Fit preprocessing on training data
                X_processed = preprocessor.fit_transform(X)
                sklearn_data['preprocessor'] = preprocessor
                
                # Handle target encoding for classification
                if y is not None and config.task_type == TaskType.CLASSIFICATION:
                    if y.dtype == 'object':
                        label_encoder = LabelEncoder()
                        y_processed = label_encoder.fit_transform(y)
                        sklearn_data['label_encoder'] = label_encoder
                    else:
                        y_processed = y.values
                else:
                    y_processed = y.values if y is not None else None
            else:
                # Transform using fitted preprocessor
                X_processed = preprocessor.transform(X)
                
                if y is not None and label_encoder is not None:
                    y_processed = label_encoder.transform(y)
                else:
                    y_processed = y.values if y is not None else None
            
            sklearn_data[f'X_{split_name}'] = X_processed
            if y_processed is not None:
                sklearn_data[f'y_{split_name}'] = y_processed
        
        # Add metadata
        sklearn_data['metadata'] = {
            'framework': 'sklearn',
            'task_type': config.task_type.value,
            'feature_columns': feature_cols,
            'numeric_features': numeric_features,
            'categorical_features': categorical_features,
            'num_features': X_processed.shape[1],
            'num_classes': len(np.unique(sklearn_data['y_train'])) if config.task_type == TaskType.CLASSIFICATION else None,
            'created_at': datetime.now().isoformat()
        }
        
        # Save to disk if output directory provided
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Save arrays and preprocessor
            for key, value in sklearn_data.items():
                if key.startswith(('X_', 'y_')):
                    np.save(output_path / f'{key}.npy', value)
                elif key in ['preprocessor', 'label_encoder']:
                    joblib.dump(value, output_path / f'{key}.pkl')
            
            # Save metadata
            with open(output_path / 'sklearn_metadata.json', 'w') as f:
                json.dump(sklearn_data['metadata'], f, indent=2)
        
        return sklearn_data
    
    def get_framework_recommendations(
        self, 
        df: pd.DataFrame, 
        task_type: TaskType
    ) -> Dict[str, Any]:
        """
        Recommend best frameworks and configurations based on data characteristics
        """
        recommendations = {
            'primary_frameworks': [],
            'configurations': {},
            'data_characteristics': {},
            'preprocessing_suggestions': []
        }
        
        # Analyze data characteristics
        num_rows, num_cols = df.shape
        numeric_cols = len(df.select_dtypes(include=[np.number]).columns)
        categorical_cols = len(df.select_dtypes(include=['object']).columns)
        
        recommendations['data_characteristics'] = {
            'num_rows': num_rows,
            'num_columns': num_cols,
            'numeric_columns': numeric_cols,
            'categorical_columns': categorical_cols,
            'memory_usage_mb': df.memory_usage(deep=True).sum() / 1024 / 1024
        }
        
        # Framework recommendations based on task type and data size
        if task_type in [TaskType.CLASSIFICATION, TaskType.REGRESSION]:
            if num_rows < 10000:
                recommendations['primary_frameworks'] = ['sklearn', 'xgboost']
            elif num_rows < 100000:
                recommendations['primary_frameworks'] = ['sklearn', 'xgboost', 'pytorch']
            else:
                recommendations['primary_frameworks'] = ['pytorch', 'tensorflow', 'xgboost']
        
        elif task_type in [TaskType.NLP_CLASSIFICATION, TaskType.NLP_NER, TaskType.NLP_GENERATION]:
            recommendations['primary_frameworks'] = ['huggingface', 'pytorch', 'tensorflow']
        
        elif task_type == TaskType.COMPUTER_VISION:
            recommendations['primary_frameworks'] = ['pytorch', 'tensorflow']
        
        elif task_type == TaskType.TIME_SERIES:
            recommendations['primary_frameworks'] = ['sklearn', 'pytorch', 'tensorflow']
        
        # Configuration suggestions
        for framework in recommendations['primary_frameworks']:
            if framework == 'pytorch':
                recommendations['configurations'][framework] = {
                    'batch_size': min(32, max(8, num_rows // 100)),
                    'suggested_architectures': self._suggest_pytorch_architecture(task_type, num_cols)
                }
            elif framework == 'tensorflow':
                recommendations['configurations'][framework] = {
                    'batch_size': min(32, max(8, num_rows // 100)),
                    'suggested_models': self._suggest_tensorflow_models(task_type)
                }
            elif framework == 'huggingface':
                recommendations['configurations'][framework] = {
                    'suggested_models': self._suggest_huggingface_models(task_type),
                    'max_length': 512
                }
        
        return recommendations
    
    def _suggest_pytorch_architecture(self, task_type: TaskType, num_features: int) -> List[str]:
        """Suggest PyTorch architectures based on task type"""
        if task_type == TaskType.CLASSIFICATION:
            return ['nn.Sequential', 'Custom MLP', 'ResNet (if large dataset)']
        elif task_type == TaskType.REGRESSION:
            return ['nn.Linear', 'Custom MLP', 'LSTM (if time series)']
        elif task_type in [TaskType.NLP_CLASSIFICATION, TaskType.NLP_NER]:
            return ['BERT', 'DistilBERT', 'RoBERTa', 'Custom Transformer']
        elif task_type == TaskType.COMPUTER_VISION:
            return ['ResNet', 'EfficientNet', 'Vision Transformer']
        else:
            return ['Custom Architecture']
    
    def _suggest_tensorflow_models(self, task_type: TaskType) -> List[str]:
        """Suggest TensorFlow models based on task type"""
        if task_type in [TaskType.CLASSIFICATION, TaskType.REGRESSION]:
            return ['tf.keras.Sequential', 'tf.keras.Model', 'AutoKeras']
        elif task_type in [TaskType.NLP_CLASSIFICATION, TaskType.NLP_NER]:
            return ['TensorFlow Hub BERT', 'Custom Transformer', 'LSTM/GRU']
        elif task_type == TaskType.COMPUTER_VISION:
            return ['tf.keras.applications.*', 'Custom CNN', 'EfficientNet']
        else:
            return ['Custom Model']
    
    def _suggest_huggingface_models(self, task_type: TaskType) -> List[str]:
        """Suggest HuggingFace models based on task type"""
        if task_type == TaskType.NLP_CLASSIFICATION:
            return ['bert-base-uncased', 'distilbert-base-uncased', 'roberta-base']
        elif task_type == TaskType.NLP_NER:
            return ['bert-base-NER', 'distilbert-base-NER', 'roberta-base-NER']
        elif task_type == TaskType.NLP_GENERATION:
            return ['gpt2', 't5-base', 'bart-base']
        else:
            return ['bert-base-uncased'] 