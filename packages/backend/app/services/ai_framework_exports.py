"""
AI Framework Export Utilities - Pollarbase
==========================================

Export prepared data to popular ML frameworks with proper formatting,
train/test splits, and framework-specific optimizations.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class DataSplit:
    """Data split configuration"""
    train_ratio: float = 0.7
    validation_ratio: float = 0.15
    test_ratio: float = 0.15
    stratify: bool = True
    random_state: int = 42

class MLFrameworkExporter:
    """Export data to different ML frameworks"""
    
    def __init__(self):
        self.supported_frameworks = ['pytorch', 'tensorflow', 'huggingface', 'sklearn']
    
    def create_train_test_split(
        self, 
        df: pd.DataFrame, 
        target_column: str,
        split_config: DataSplit = None
    ) -> Dict[str, pd.DataFrame]:
        """Create stratified train/validation/test splits"""
        from sklearn.model_selection import train_test_split
        
        if split_config is None:
            split_config = DataSplit()
        
        # Validate ratios
        total = split_config.train_ratio + split_config.validation_ratio + split_config.test_ratio
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Split ratios must sum to 1.0, got {total}")
        
        # Prepare stratification
        stratify_data = None
        if split_config.stratify and target_column in df.columns:
            stratify_data = df[target_column]
            # Check if we have enough samples per class
            min_class_count = stratify_data.value_counts().min()
            if min_class_count < 3:
                logger.warning("Not enough samples per class for stratification")
                stratify_data = None
        
        # First split: train+val vs test
        train_val, test = train_test_split(
            df,
            test_size=split_config.test_ratio,
            stratify=stratify_data,
            random_state=split_config.random_state
        )
        
        # Second split: train vs val
        val_ratio = split_config.validation_ratio / (split_config.train_ratio + split_config.validation_ratio)
        
        if split_config.stratify and stratify_data is not None:
            train_val_stratify = train_val[target_column]
        else:
            train_val_stratify = None
            
        train, validation = train_test_split(
            train_val,
            test_size=val_ratio,
            stratify=train_val_stratify,
            random_state=split_config.random_state
        )
        
        logger.info(f"Data split: Train={len(train)}, Val={len(validation)}, Test={len(test)}")
        
        return {
            'train': train,
            'validation': validation,
            'test': test
        }
    
    def export_pytorch(
        self,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: List[str] = None,
        output_dir: str = None
    ) -> Dict[str, Any]:
        """Export data for PyTorch"""
        try:
            import torch
            from torch.utils.data import Dataset, DataLoader, TensorDataset
        except ImportError:
            raise ImportError("PyTorch not installed. Run: pip install torch")
        
        # Create splits
        splits = self.create_train_test_split(df, target_column)
        
        # Prepare features
        if feature_columns is None:
            feature_columns = [col for col in df.columns if col != target_column]
        
        pytorch_data = {}
        label_encoder = None
        
        for split_name, split_df in splits.items():
            X = split_df[feature_columns].values.astype(np.float32)
            y = split_df[target_column].values
            
            # Handle categorical targets
            if split_df[target_column].dtype == 'object':
                from sklearn.preprocessing import LabelEncoder
                if label_encoder is None:
                    label_encoder = LabelEncoder()
                    label_encoder.fit(df[target_column])
                y = label_encoder.transform(y)
            
            # Convert to tensors
            X_tensor = torch.FloatTensor(X)
            y_tensor = torch.LongTensor(y)
            
            # Create dataset and dataloader
            dataset = TensorDataset(X_tensor, y_tensor)
            dataloader = DataLoader(dataset, batch_size=32, shuffle=(split_name == 'train'))
            
            pytorch_data[f'{split_name}_dataset'] = dataset
            pytorch_data[f'{split_name}_dataloader'] = dataloader
        
        if label_encoder:
            pytorch_data['label_encoder'] = label_encoder
        
        pytorch_data['metadata'] = {
            'num_features': len(feature_columns),
            'num_classes': len(df[target_column].unique()),
            'feature_columns': feature_columns
        }
        
        # Save if output directory provided
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            for split_name in ['train', 'validation', 'test']:
                torch.save(
                    pytorch_data[f'{split_name}_dataset'],
                    f"{output_dir}/{split_name}_dataset.pt"
                )
        
        return pytorch_data
    
    def export_tensorflow(
        self,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: List[str] = None,
        output_dir: str = None
    ) -> Dict[str, Any]:
        """Export data for TensorFlow"""
        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError("TensorFlow not installed. Run: pip install tensorflow")
        
        # Create splits
        splits = self.create_train_test_split(df, target_column)
        
        # Prepare features
        if feature_columns is None:
            feature_columns = [col for col in df.columns if col != target_column]
        
        tf_data = {}
        label_encoder = None
        
        for split_name, split_df in splits.items():
            X = split_df[feature_columns].values.astype(np.float32)
            y = split_df[target_column].values
            
            # Handle categorical targets
            if split_df[target_column].dtype == 'object':
                from sklearn.preprocessing import LabelEncoder
                if label_encoder is None:
                    label_encoder = LabelEncoder()
                    label_encoder.fit(df[target_column])
                y = label_encoder.transform(y)
            
            # Create tf.data.Dataset
            dataset = tf.data.Dataset.from_tensor_slices((X, y))
            dataset = dataset.batch(32)
            
            if split_name == 'train':
                dataset = dataset.shuffle(1000)
            
            dataset = dataset.prefetch(tf.data.AUTOTUNE)
            tf_data[f'{split_name}_dataset'] = dataset
        
        if label_encoder:
            tf_data['label_encoder'] = label_encoder
        
        tf_data['metadata'] = {
            'num_features': len(feature_columns),
            'num_classes': len(df[target_column].unique()),
            'feature_columns': feature_columns
        }
        
        # Save if output directory provided
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            for split_name in ['train', 'validation', 'test']:
                tf.data.experimental.save(
                    tf_data[f'{split_name}_dataset'],
                    f"{output_dir}/{split_name}_dataset"
                )
        
        return tf_data
    
    def export_huggingface(
        self,
        df: pd.DataFrame,
        text_column: str,
        target_column: str,
        output_dir: str = None
    ) -> Dict[str, Any]:
        """Export data for HuggingFace transformers"""
        try:
            from datasets import Dataset, DatasetDict
            from transformers import AutoTokenizer
        except ImportError:
            raise ImportError("HuggingFace not installed. Run: pip install datasets transformers")
        
        # Create splits
        splits = self.create_train_test_split(df, target_column)
        
        # Convert to HuggingFace datasets
        hf_datasets = {}
        for split_name, split_df in splits.items():
            hf_datasets[split_name] = Dataset.from_pandas(split_df)
        
        dataset_dict = DatasetDict(hf_datasets)
        
        # Initialize tokenizer
        tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
        
        def tokenize_function(examples):
            return tokenizer(
                examples[text_column],
                truncation=True,
                padding='max_length',
                max_length=512
            )
        
        # Tokenize datasets
        tokenized_datasets = dataset_dict.map(tokenize_function, batched=True)
        
        # Handle labels
        if df[target_column].dtype == 'object':
            unique_labels = list(df[target_column].unique())
            label2id = {label: i for i, label in enumerate(unique_labels)}
            
            def encode_labels(examples):
                examples['labels'] = [label2id[label] for label in examples[target_column]]
                return examples
            
            tokenized_datasets = tokenized_datasets.map(encode_labels, batched=True)
            
            hf_data = {
                'datasets': tokenized_datasets,
                'tokenizer': tokenizer,
                'label2id': label2id,
                'id2label': {i: label for label, i in label2id.items()}
            }
        else:
            tokenized_datasets = tokenized_datasets.rename_column(target_column, 'labels')
            hf_data = {
                'datasets': tokenized_datasets,
                'tokenizer': tokenizer
            }
        
        hf_data['metadata'] = {
            'text_column': text_column,
            'target_column': target_column,
            'num_classes': len(df[target_column].unique())
        }
        
        # Save if output directory provided
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            hf_data['datasets'].save_to_disk(f"{output_dir}/datasets")
            hf_data['tokenizer'].save_pretrained(f"{output_dir}/tokenizer")
        
        return hf_data
    
    def export_sklearn(
        self,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: List[str] = None,
        output_dir: str = None
    ) -> Dict[str, Any]:
        """Export data for scikit-learn"""
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        
        # Create splits
        splits = self.create_train_test_split(df, target_column)
        
        # Prepare features
        if feature_columns is None:
            feature_columns = [col for col in df.columns if col != target_column]
        
        sklearn_data = {}
        scaler = StandardScaler()
        label_encoder = None
        
        # Handle categorical target
        if df[target_column].dtype == 'object':
            label_encoder = LabelEncoder()
            label_encoder.fit(df[target_column])
        
        for split_name, split_df in splits.items():
            X = split_df[feature_columns].values
            y = split_df[target_column].values
            
            # Scale features (fit on train, transform on all)
            if split_name == 'train':
                X_scaled = scaler.fit_transform(X)
            else:
                X_scaled = scaler.transform(X)
            
            # Encode labels
            if label_encoder:
                y_encoded = label_encoder.transform(y)
            else:
                y_encoded = y
            
            sklearn_data[f'X_{split_name}'] = X_scaled
            sklearn_data[f'y_{split_name}'] = y_encoded
        
        sklearn_data['scaler'] = scaler
        if label_encoder:
            sklearn_data['label_encoder'] = label_encoder
        
        sklearn_data['metadata'] = {
            'num_features': len(feature_columns),
            'num_classes': len(df[target_column].unique()),
            'feature_columns': feature_columns
        }
        
        # Save if output directory provided
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            import joblib
            
            for key, value in sklearn_data.items():
                if key.startswith(('X_', 'y_')):
                    np.save(f"{output_dir}/{key}.npy", value)
                elif key in ['scaler', 'label_encoder']:
                    joblib.dump(value, f"{output_dir}/{key}.pkl")
        
        return sklearn_data 