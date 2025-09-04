"""
Advanced Deep Learning and Ensemble Modeling Engine for Industrial Applications

This engine provides comprehensive machine learning capabilities including:
- Deep learning models (TensorFlow/Keras, PyTorch) 
- Advanced ensemble methods (XGBoost, LightGBM, CatBoost, Stacking)
- Industrial-specific architectures (sensor fusion, predictive maintenance)
- Automated training pipelines with hyperparameter optimization
- Production-ready inference and model serving
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from sklearn.base import BaseEstimator, TransformerMixin, ClassifierMixin, RegressorMixin
from sklearn.model_selection import cross_val_score, GridSearchCV, RandomizedSearchCV, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, LabelEncoder
from sklearn.metrics import (
    classification_report, confusion_matrix, mean_squared_error, r2_score,
    mean_absolute_error, precision_recall_curve, roc_auc_score, f1_score
)
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    VotingClassifier, VotingRegressor,
    BaggingClassifier, BaggingRegressor
)
import warnings
warnings.filterwarnings('ignore')
import logging
from datetime import datetime
import joblib
import os
import json
from abc import ABC, abstractmethod

# Optional deep learning imports with graceful fallbacks
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, models, callbacks
    from tensorflow.keras.utils import plot_model
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    tf = None
    keras = None

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

# Optional gradient boosting imports
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    xgb = None

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    lgb = None

try:
    import catboost as cb
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False
    cb = None

# Bayesian optimization for hyperparameter tuning
try:
    from skopt import gp_minimize
    from skopt.space import Real, Integer, Categorical
    from skopt.utils import use_named_args
    BAYESIAN_OPT_AVAILABLE = True
except ImportError:
    BAYESIAN_OPT_AVAILABLE = False

logger = logging.getLogger(__name__)


class BaseModelArchitecture(ABC):
    """Abstract base class for all model architectures."""
    
    def __init__(self, model_config: Dict[str, Any] = None):
        self.model_config = model_config or {}
        self.model = None
        self.scaler = None
        self.is_trained = False
        self.training_history = {}
        
    @abstractmethod
    def build_model(self, input_shape: Tuple, output_shape: int, **kwargs):
        """Build the model architecture."""
        pass
    
    @abstractmethod
    def train(self, X: np.ndarray, y: np.ndarray, **kwargs) -> Dict[str, Any]:
        """Train the model."""
        pass
    
    @abstractmethod
    def predict(self, X: np.ndarray, **kwargs) -> np.ndarray:
        """Make predictions."""
        pass
    
    def save_model(self, filepath: str):
        """Save the trained model."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'config': self.model_config,
            'is_trained': self.is_trained,
            'training_history': self.training_history
        }
        joblib.dump(model_data, filepath)
        
    def load_model(self, filepath: str):
        """Load a saved model."""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.model_config = model_data['config']
        self.is_trained = model_data['is_trained']
        self.training_history = model_data['training_history']


class TensorFlowModelArchitecture(BaseModelArchitecture):
    """TensorFlow/Keras model architectures for deep learning."""
    
    def __init__(self, model_config: Dict[str, Any] = None):
        super().__init__(model_config)
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow not available. Install with: pip install tensorflow")
        
    def build_autoencoder(self, input_shape: Tuple, encoding_dim: int = 64, 
                         architecture: str = 'standard') -> keras.Model:
        """Build autoencoder architecture for anomaly detection."""
        input_layer = keras.Input(shape=input_shape)
        
        if architecture == 'standard':
            # Standard autoencoder
            encoded = layers.Dense(128, activation='relu')(input_layer)
            encoded = layers.Dropout(0.2)(encoded)
            encoded = layers.Dense(encoding_dim, activation='relu')(encoded)
            
            decoded = layers.Dense(128, activation='relu')(encoded)
            decoded = layers.Dropout(0.2)(decoded)
            decoded = layers.Dense(input_shape[0], activation='linear')(decoded)
            
        elif architecture == 'variational':
            # Variational autoencoder
            encoded = layers.Dense(256, activation='relu')(input_layer)
            encoded = layers.Dense(128, activation='relu')(encoded)
            
            z_mean = layers.Dense(encoding_dim)(encoded)
            z_log_var = layers.Dense(encoding_dim)(encoded)
            
            # Sampling function
            def sampling(args):
                z_mean, z_log_var = args
                batch = tf.shape(z_mean)[0]
                dim = tf.shape(z_mean)[1]
                epsilon = tf.keras.backend.random_normal(shape=(batch, dim))
                return z_mean + tf.exp(0.5 * z_log_var) * epsilon
            
            z = layers.Lambda(sampling)([z_mean, z_log_var])
            
            decoded = layers.Dense(128, activation='relu')(z)
            decoded = layers.Dense(256, activation='relu')(decoded)
            decoded = layers.Dense(input_shape[0], activation='linear')(decoded)
            
        else:
            # Convolutional autoencoder (for 2D data)
            if len(input_shape) == 2:
                encoded = layers.Conv1D(64, 3, activation='relu', padding='same')(input_layer)
                encoded = layers.MaxPooling1D(2, padding='same')(encoded)
                encoded = layers.Conv1D(32, 3, activation='relu', padding='same')(encoded)
                encoded = layers.MaxPooling1D(2, padding='same')(encoded)
                encoded = layers.Conv1D(16, 3, activation='relu', padding='same')(encoded)
                encoded = layers.MaxPooling1D(2, padding='same')(encoded)
                
                decoded = layers.Conv1D(16, 3, activation='relu', padding='same')(encoded)
                decoded = layers.UpSampling1D(2)(decoded)
                decoded = layers.Conv1D(32, 3, activation='relu', padding='same')(decoded)
                decoded = layers.UpSampling1D(2)(decoded)
                decoded = layers.Conv1D(64, 3, activation='relu', padding='same')(decoded)
                decoded = layers.UpSampling1D(2)(decoded)
                decoded = layers.Conv1D(input_shape[-1], 3, activation='linear', padding='same')(decoded)
        
        autoencoder = keras.Model(input_layer, decoded)
        encoder = keras.Model(input_layer, encoded)
        
        return autoencoder, encoder
    
    def build_lstm_model(self, input_shape: Tuple, output_shape: int, 
                        task_type: str = 'regression') -> keras.Model:
        """Build LSTM model for time-series prediction."""
        model = keras.Sequential([
            layers.LSTM(128, return_sequences=True, input_shape=input_shape),
            layers.Dropout(0.2),
            layers.LSTM(64, return_sequences=True),
            layers.Dropout(0.2),
            layers.LSTM(32, return_sequences=False),
            layers.Dropout(0.2),
            layers.Dense(64, activation='relu'),
            layers.Dense(32, activation='relu')
        ])
        
        if task_type == 'classification':
            if output_shape == 2:
                model.add(layers.Dense(1, activation='sigmoid'))
            else:
                model.add(layers.Dense(output_shape, activation='softmax'))
        else:
            model.add(layers.Dense(output_shape, activation='linear'))
        
        return model
    
    def build_cnn_model(self, input_shape: Tuple, output_shape: int, 
                       task_type: str = 'regression') -> keras.Model:
        """Build CNN model for pattern recognition in sensor data."""
        model = keras.Sequential([
            layers.Conv1D(64, 3, activation='relu', input_shape=input_shape),
            layers.BatchNormalization(),
            layers.Conv1D(64, 3, activation='relu'),
            layers.MaxPooling1D(2),
            layers.Dropout(0.25),
            
            layers.Conv1D(128, 3, activation='relu'),
            layers.BatchNormalization(),
            layers.Conv1D(128, 3, activation='relu'),
            layers.MaxPooling1D(2),
            layers.Dropout(0.25),
            
            layers.Conv1D(256, 3, activation='relu'),
            layers.BatchNormalization(),
            layers.GlobalAveragePooling1D(),
            layers.Dropout(0.5),
            
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.3)
        ])
        
        if task_type == 'classification':
            if output_shape == 2:
                model.add(layers.Dense(1, activation='sigmoid'))
            else:
                model.add(layers.Dense(output_shape, activation='softmax'))
        else:
            model.add(layers.Dense(output_shape, activation='linear'))
        
        return model
    
    def build_transformer_model(self, input_shape: Tuple, output_shape: int,
                               head_size: int = 256, num_heads: int = 4, 
                               ff_dim: int = 4, num_transformer_blocks: int = 4,
                               task_type: str = 'regression') -> keras.Model:
        """Build Transformer model for sequence modeling."""
        inputs = keras.Input(shape=input_shape)
        
        x = inputs
        for _ in range(num_transformer_blocks):
            x = self._transformer_encoder(x, head_size, num_heads, ff_dim)
        
        x = layers.GlobalAveragePooling1D(data_format="channels_first")(x)
        x = layers.Dropout(0.1)(x)
        x = layers.Dense(128, activation="relu")(x)
        x = layers.Dropout(0.1)(x)
        
        if task_type == 'classification':
            if output_shape == 2:
                outputs = layers.Dense(1, activation='sigmoid')(x)
            else:
                outputs = layers.Dense(output_shape, activation='softmax')(x)
        else:
            outputs = layers.Dense(output_shape, activation='linear')(x)
        
        return keras.Model(inputs, outputs)
    
    def _transformer_encoder(self, inputs, head_size: int, num_heads: int, ff_dim: int):
        """Transformer encoder block."""
        # Multi-head attention
        attention = layers.MultiHeadAttention(
            key_dim=head_size, num_heads=num_heads, dropout=0.1
        )(inputs, inputs)
        attention = layers.Dropout(0.1)(attention)
        attention = layers.LayerNormalization(epsilon=1e-6)(inputs + attention)
        
        # Feed-forward network
        ffn_output = layers.Conv1D(ff_dim, 1, activation="relu")(attention)
        ffn_output = layers.Dropout(0.1)(ffn_output)
        ffn_output = layers.Conv1D(inputs.shape[-1], 1)(ffn_output)
        
        return layers.LayerNormalization(epsilon=1e-6)(attention + ffn_output)
    
    def build_sensor_fusion_model(self, sensor_shapes: Dict[str, Tuple], 
                                 output_shape: int, task_type: str = 'regression') -> keras.Model:
        """Build multi-sensor fusion model for industrial applications."""
        sensor_inputs = {}
        sensor_features = {}
        
        # Process each sensor type separately
        for sensor_name, shape in sensor_shapes.items():
            sensor_input = keras.Input(shape=shape, name=f"{sensor_name}_input")
            sensor_inputs[sensor_name] = sensor_input
            
            # Sensor-specific feature extraction
            if len(shape) == 1:  # 1D sensor data
                x = layers.Dense(64, activation='relu')(sensor_input)
                x = layers.Dropout(0.2)(x)
                x = layers.Dense(32, activation='relu')(x)
            else:  # Multi-dimensional sensor data (time series)
                x = layers.Conv1D(32, 3, activation='relu', padding='same')(sensor_input)
                x = layers.BatchNormalization()(x)
                x = layers.Conv1D(64, 3, activation='relu', padding='same')(x)
                x = layers.GlobalAveragePooling1D()(x)
            
            sensor_features[sensor_name] = x
        
        # Fusion layer
        if len(sensor_features) > 1:
            fused_features = layers.Concatenate()(list(sensor_features.values()))
        else:
            fused_features = list(sensor_features.values())[0]
        
        # Final prediction layers
        x = layers.Dense(128, activation='relu')(fused_features)
        x = layers.Dropout(0.3)(x)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.Dropout(0.2)(x)
        
        if task_type == 'classification':
            if output_shape == 2:
                outputs = layers.Dense(1, activation='sigmoid')(x)
            else:
                outputs = layers.Dense(output_shape, activation='softmax')(x)
        else:
            outputs = layers.Dense(output_shape, activation='linear')(x)
        
        return keras.Model(list(sensor_inputs.values()), outputs)
    
    def build_model(self, input_shape: Tuple, output_shape: int, 
                   model_type: str = 'lstm', **kwargs):
        """Build model based on specified type."""
        if model_type == 'autoencoder':
            return self.build_autoencoder(input_shape, **kwargs)
        elif model_type == 'lstm':
            return self.build_lstm_model(input_shape, output_shape, **kwargs)
        elif model_type == 'cnn':
            return self.build_cnn_model(input_shape, output_shape, **kwargs)
        elif model_type == 'transformer':
            return self.build_transformer_model(input_shape, output_shape, **kwargs)
        elif model_type == 'sensor_fusion':
            return self.build_sensor_fusion_model(input_shape, output_shape, **kwargs)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
    
    def train(self, X: np.ndarray, y: np.ndarray, 
              validation_split: float = 0.2, epochs: int = 100,
              batch_size: int = 32, **kwargs) -> Dict[str, Any]:
        """Train the TensorFlow model."""
        if self.model is None:
            raise ValueError("Model not built. Call build_model() first.")
        
        # Scale the data
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X.reshape(X.shape[0], -1))
        X_scaled = X_scaled.reshape(X.shape)
        
        # Compile model
        task_type = kwargs.get('task_type', 'regression')
        if task_type == 'classification':
            if y.max() <= 1:  # Binary classification
                loss = 'binary_crossentropy'
                metrics = ['accuracy', 'precision', 'recall']
            else:  # Multi-class classification
                loss = 'sparse_categorical_crossentropy'
                metrics = ['accuracy']
        else:
            loss = 'mse'
            metrics = ['mae']
        
        optimizer = kwargs.get('optimizer', 'adam')
        learning_rate = kwargs.get('learning_rate', 0.001)
        
        if optimizer == 'adam':
            opt = keras.optimizers.Adam(learning_rate=learning_rate)
        elif optimizer == 'sgd':
            opt = keras.optimizers.SGD(learning_rate=learning_rate)
        else:
            opt = optimizer
        
        self.model.compile(optimizer=opt, loss=loss, metrics=metrics)
        
        # Callbacks
        callback_list = [
            callbacks.EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True),
            callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-7)
        ]
        
        # Train the model
        history = self.model.fit(
            X_scaled, y,
            validation_split=validation_split,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callback_list,
            verbose=0
        )
        
        self.is_trained = True
        self.training_history = history.history
        
        return {
            'history': history.history,
            'final_loss': history.history['loss'][-1],
            'final_val_loss': history.history['val_loss'][-1] if 'val_loss' in history.history else None,
            'epochs_trained': len(history.history['loss'])
        }
    
    def predict(self, X: np.ndarray, **kwargs) -> np.ndarray:
        """Make predictions with the trained model."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        
        X_scaled = self.scaler.transform(X.reshape(X.shape[0], -1))
        X_scaled = X_scaled.reshape(X.shape)
        
        predictions = self.model.predict(X_scaled, verbose=0)
        return predictions


class PyTorchModelArchitecture(BaseModelArchitecture):
    """PyTorch model architectures for research and advanced models."""
    
    def __init__(self, model_config: Dict[str, Any] = None):
        super().__init__(model_config)
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch not available. Install with: pip install torch")
        
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    def build_model(self, input_shape: Tuple, output_shape: int, 
                   model_type: str = 'mlp', **kwargs):
        """Build PyTorch model based on specified type."""
        if model_type == 'mlp':
            return self._build_mlp(input_shape, output_shape, **kwargs)
        elif model_type == 'lstm':
            return self._build_lstm(input_shape, output_shape, **kwargs)
        elif model_type == 'cnn':
            return self._build_cnn(input_shape, output_shape, **kwargs)
        elif model_type == 'attention':
            return self._build_attention_model(input_shape, output_shape, **kwargs)
        else:
            raise ValueError(f"Unknown PyTorch model type: {model_type}")
    
    def _build_mlp(self, input_shape: Tuple, output_shape: int, 
                   hidden_dims: List[int] = None, **kwargs) -> nn.Module:
        """Build Multi-Layer Perceptron."""
        if hidden_dims is None:
            hidden_dims = [256, 128, 64]
        
        layers_list = []
        input_dim = np.prod(input_shape)
        
        prev_dim = input_dim
        for dim in hidden_dims:
            layers_list.extend([
                nn.Linear(prev_dim, dim),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.BatchNorm1d(dim)
            ])
            prev_dim = dim
        
        layers_list.append(nn.Linear(prev_dim, output_shape))
        
        return nn.Sequential(*layers_list)
    
    def _build_lstm(self, input_shape: Tuple, output_shape: int,
                   hidden_size: int = 128, num_layers: int = 2, **kwargs) -> nn.Module:
        """Build LSTM model."""
        
        class LSTMModel(nn.Module):
            def __init__(self, input_size, hidden_size, num_layers, output_size):
                super(LSTMModel, self).__init__()
                self.hidden_size = hidden_size
                self.num_layers = num_layers
                
                self.lstm = nn.LSTM(input_size, hidden_size, num_layers, 
                                  batch_first=True, dropout=0.2)
                self.fc1 = nn.Linear(hidden_size, hidden_size // 2)
                self.fc2 = nn.Linear(hidden_size // 2, output_size)
                self.dropout = nn.Dropout(0.2)
                self.relu = nn.ReLU()
                
            def forward(self, x):
                h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
                c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
                
                out, _ = self.lstm(x, (h0, c0))
                out = self.dropout(out[:, -1, :])  # Take the last output
                out = self.relu(self.fc1(out))
                out = self.dropout(out)
                out = self.fc2(out)
                return out
        
        return LSTMModel(input_shape[-1], hidden_size, num_layers, output_shape)
    
    def _build_cnn(self, input_shape: Tuple, output_shape: int, **kwargs) -> nn.Module:
        """Build 1D CNN model for sensor data."""
        
        class CNN1D(nn.Module):
            def __init__(self, input_channels, sequence_length, output_size):
                super(CNN1D, self).__init__()
                
                self.conv1 = nn.Conv1d(input_channels, 64, 3, padding=1)
                self.conv2 = nn.Conv1d(64, 128, 3, padding=1)
                self.conv3 = nn.Conv1d(128, 256, 3, padding=1)
                
                self.bn1 = nn.BatchNorm1d(64)
                self.bn2 = nn.BatchNorm1d(128)
                self.bn3 = nn.BatchNorm1d(256)
                
                self.pool = nn.MaxPool1d(2)
                self.dropout = nn.Dropout(0.3)
                self.relu = nn.ReLU()
                
                # Calculate the flattened size after conv layers
                conv_output_size = 256 * (sequence_length // 8)  # Assuming 3 pooling operations
                
                self.fc1 = nn.Linear(conv_output_size, 128)
                self.fc2 = nn.Linear(128, 64)
                self.fc3 = nn.Linear(64, output_size)
                
            def forward(self, x):
                x = self.pool(self.relu(self.bn1(self.conv1(x))))
                x = self.pool(self.relu(self.bn2(self.conv2(x))))
                x = self.pool(self.relu(self.bn3(self.conv3(x))))
                
                x = x.view(x.size(0), -1)  # Flatten
                x = self.dropout(self.relu(self.fc1(x)))
                x = self.dropout(self.relu(self.fc2(x)))
                x = self.fc3(x)
                return x
        
        return CNN1D(input_shape[1] if len(input_shape) > 1 else 1, 
                    input_shape[0], output_shape)
    
    def train(self, X: np.ndarray, y: np.ndarray, 
              validation_split: float = 0.2, epochs: int = 100,
              batch_size: int = 32, learning_rate: float = 0.001,
              **kwargs) -> Dict[str, Any]:
        """Train the PyTorch model."""
        if self.model is None:
            raise ValueError("Model not built. Call build_model() first.")
        
        # Scale the data
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X.reshape(X.shape[0], -1))
        X_scaled = X_scaled.reshape(X.shape)
        
        # Convert to PyTorch tensors
        X_tensor = torch.FloatTensor(X_scaled).to(self.device)
        y_tensor = torch.FloatTensor(y).to(self.device)
        
        # Split data
        n_train = int(len(X_tensor) * (1 - validation_split))
        X_train, X_val = X_tensor[:n_train], X_tensor[n_train:]
        y_train, y_val = y_tensor[:n_train], y_tensor[n_train:]
        
        # Create data loaders
        train_dataset = torch.utils.data.TensorDataset(X_train, y_train)
        val_dataset = torch.utils.data.TensorDataset(X_val, y_val)
        
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
        
        # Move model to device
        self.model = self.model.to(self.device)
        
        # Set up optimizer and loss
        optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        task_type = kwargs.get('task_type', 'regression')
        
        if task_type == 'classification':
            criterion = nn.CrossEntropyLoss() if y.max() > 1 else nn.BCEWithLogitsLoss()
        else:
            criterion = nn.MSELoss()
        
        # Training loop
        train_losses, val_losses = [], []
        best_val_loss = float('inf')
        patience_counter = 0
        patience = 10
        
        for epoch in range(epochs):
            # Training phase
            self.model.train()
            train_loss = 0.0
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                outputs = self.model(batch_X)
                loss = criterion(outputs.squeeze(), batch_y)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()
            
            train_loss /= len(train_loader)
            train_losses.append(train_loss)
            
            # Validation phase
            self.model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for batch_X, batch_y in val_loader:
                    outputs = self.model(batch_X)
                    loss = criterion(outputs.squeeze(), batch_y)
                    val_loss += loss.item()
            
            val_loss /= len(val_loader)
            val_losses.append(val_loss)
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        self.is_trained = True
        self.training_history = {
            'train_loss': train_losses,
            'val_loss': val_losses
        }
        
        return {
            'history': self.training_history,
            'final_loss': train_losses[-1],
            'final_val_loss': val_losses[-1],
            'epochs_trained': len(train_losses)
        }
    
    def predict(self, X: np.ndarray, **kwargs) -> np.ndarray:
        """Make predictions with the trained PyTorch model."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        
        X_scaled = self.scaler.transform(X.reshape(X.shape[0], -1))
        X_scaled = X_scaled.reshape(X.shape)
        X_tensor = torch.FloatTensor(X_scaled).to(self.device)
        
        self.model.eval()
        with torch.no_grad():
            predictions = self.model(X_tensor)
            predictions = predictions.cpu().numpy()
        
        return predictions


class AdvancedEnsembleModels:
    """Advanced ensemble methods including XGBoost, LightGBM, CatBoost, and Stacking."""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        
    def build_xgboost_model(self, task_type: str = 'regression', **kwargs):
        """Build XGBoost model."""
        if not XGBOOST_AVAILABLE:
            raise ImportError("XGBoost not available. Install with: pip install xgboost")
        
        if task_type == 'classification':
            return xgb.XGBClassifier(
                n_estimators=kwargs.get('n_estimators', 100),
                max_depth=kwargs.get('max_depth', 6),
                learning_rate=kwargs.get('learning_rate', 0.1),
                subsample=kwargs.get('subsample', 0.8),
                colsample_bytree=kwargs.get('colsample_bytree', 0.8),
                random_state=42
            )
        else:
            return xgb.XGBRegressor(
                n_estimators=kwargs.get('n_estimators', 100),
                max_depth=kwargs.get('max_depth', 6),
                learning_rate=kwargs.get('learning_rate', 0.1),
                subsample=kwargs.get('subsample', 0.8),
                colsample_bytree=kwargs.get('colsample_bytree', 0.8),
                random_state=42
            )
    
    def build_lightgbm_model(self, task_type: str = 'regression', **kwargs):
        """Build LightGBM model."""
        if not LIGHTGBM_AVAILABLE:
            raise ImportError("LightGBM not available. Install with: pip install lightgbm")
        
        if task_type == 'classification':
            return lgb.LGBMClassifier(
                n_estimators=kwargs.get('n_estimators', 100),
                max_depth=kwargs.get('max_depth', -1),
                learning_rate=kwargs.get('learning_rate', 0.1),
                subsample=kwargs.get('subsample', 0.8),
                colsample_bytree=kwargs.get('colsample_bytree', 0.8),
                random_state=42,
                verbose=-1
            )
        else:
            return lgb.LGBMRegressor(
                n_estimators=kwargs.get('n_estimators', 100),
                max_depth=kwargs.get('max_depth', -1),
                learning_rate=kwargs.get('learning_rate', 0.1),
                subsample=kwargs.get('subsample', 0.8),
                colsample_bytree=kwargs.get('colsample_bytree', 0.8),
                random_state=42,
                verbose=-1
            )
    
    def build_catboost_model(self, task_type: str = 'regression', **kwargs):
        """Build CatBoost model."""
        if not CATBOOST_AVAILABLE:
            raise ImportError("CatBoost not available. Install with: pip install catboost")
        
        if task_type == 'classification':
            return cb.CatBoostClassifier(
                iterations=kwargs.get('n_estimators', 100),
                depth=kwargs.get('max_depth', 6),
                learning_rate=kwargs.get('learning_rate', 0.1),
                random_seed=42,
                verbose=False
            )
        else:
            return cb.CatBoostRegressor(
                iterations=kwargs.get('n_estimators', 100),
                depth=kwargs.get('max_depth', 6),
                learning_rate=kwargs.get('learning_rate', 0.1),
                random_seed=42,
                verbose=False
            )
    
    def build_stacking_ensemble(self, base_models: List, meta_model=None, 
                               task_type: str = 'regression', cv_folds: int = 5):
        """Build stacking ensemble."""
        from sklearn.ensemble import StackingClassifier, StackingRegressor
        
        if meta_model is None:
            if task_type == 'classification':
                meta_model = RandomForestClassifier(n_estimators=50, random_state=42)
            else:
                meta_model = RandomForestRegressor(n_estimators=50, random_state=42)
        
        base_estimators = [(f'model_{i}', model) for i, model in enumerate(base_models)]
        
        if task_type == 'classification':
            return StackingClassifier(
                estimators=base_estimators,
                final_estimator=meta_model,
                cv=cv_folds,
                n_jobs=-1
            )
        else:
            return StackingRegressor(
                estimators=base_estimators,
                final_estimator=meta_model,
                cv=cv_folds,
                n_jobs=-1
            )
    
    def build_voting_ensemble(self, base_models: List, task_type: str = 'regression',
                             voting: str = 'soft'):
        """Build voting ensemble."""
        base_estimators = [(f'model_{i}', model) for i, model in enumerate(base_models)]
        
        if task_type == 'classification':
            return VotingClassifier(
                estimators=base_estimators,
                voting=voting
            )
        else:
            return VotingRegressor(estimators=base_estimators)


class HyperparameterOptimizer:
    """Advanced hyperparameter optimization using multiple strategies."""
    
    def __init__(self, optimization_method: str = 'random_search'):
        self.optimization_method = optimization_method
        self.best_params = {}
        self.best_score = None
        
    def optimize_sklearn_model(self, model, param_grid: Dict, X: np.ndarray, y: np.ndarray,
                              cv_folds: int = 5, scoring: str = None,
                              n_iter: int = 50) -> Dict[str, Any]:
        """Optimize sklearn model hyperparameters."""
        if scoring is None:
            scoring = 'f1_macro' if len(np.unique(y)) > 2 else 'accuracy' if len(np.unique(y)) == 2 else 'r2'
        
        if self.optimization_method == 'grid_search':
            optimizer = GridSearchCV(
                model, param_grid, cv=cv_folds, scoring=scoring, n_jobs=-1
            )
        elif self.optimization_method == 'random_search':
            optimizer = RandomizedSearchCV(
                model, param_grid, n_iter=n_iter, cv=cv_folds, 
                scoring=scoring, n_jobs=-1, random_state=42
            )
        else:
            raise ValueError(f"Unknown optimization method: {self.optimization_method}")
        
        optimizer.fit(X, y)
        
        self.best_params = optimizer.best_params_
        self.best_score = optimizer.best_score_
        
        return {
            'best_params': self.best_params,
            'best_score': self.best_score,
            'best_model': optimizer.best_estimator_,
            'cv_results': optimizer.cv_results_
        }
    
    def optimize_with_bayesian(self, objective_function: Callable, search_space: List,
                              n_calls: int = 50) -> Dict[str, Any]:
        """Optimize using Bayesian optimization."""
        if not BAYESIAN_OPT_AVAILABLE:
            raise ImportError("scikit-optimize not available. Install with: pip install scikit-optimize")
        
        result = gp_minimize(
            func=objective_function,
            dimensions=search_space,
            n_calls=n_calls,
            random_state=42
        )
        
        return {
            'best_params': result.x,
            'best_score': -result.fun,  # Minimize negative score
            'optimization_result': result
        }


class AdvancedMLModelingEngine:
    """
    Comprehensive advanced ML modeling engine with deep learning and ensemble capabilities.
    
    Features:
    - Deep learning models (TensorFlow/Keras, PyTorch)
    - Advanced ensemble methods (XGBoost, LightGBM, CatBoost, Stacking)
    - Industrial-specific architectures (sensor fusion, predictive maintenance)
    - Automated training pipelines with hyperparameter optimization
    - Production-ready inference and model serving
    """
    
    def __init__(self, model_config: Dict[str, Any] = None):
        self.model_config = model_config or {}
        self.models = {}
        self.model_performance = {}
        self.hyperparameter_optimizer = HyperparameterOptimizer()
        self.ensemble_models = AdvancedEnsembleModels()
        
        # Available model architectures
        self.model_architectures = {
            'deep_learning': {
                'tensorflow': TensorFlowModelArchitecture,
                'pytorch': PyTorchModelArchitecture
            },
            'ensemble': {
                'xgboost': self.ensemble_models.build_xgboost_model,
                'lightgbm': self.ensemble_models.build_lightgbm_model,
                'catboost': self.ensemble_models.build_catboost_model,
                'stacking': self.ensemble_models.build_stacking_ensemble,
                'voting': self.ensemble_models.build_voting_ensemble
            }
        }
        
    def train_industrial_model(self, data: pd.DataFrame, target_column: str,
                              model_type: str = 'auto', task_type: str = 'auto',
                              optimization_budget: int = 50) -> Dict[str, Any]:
        """
        Train industrial ML model with automatic architecture selection.
        
        Args:
            data: Training data
            target_column: Target variable column name
            model_type: Type of model ('auto', 'deep_learning', 'ensemble', 'traditional')
            task_type: 'classification', 'regression', or 'auto'
            optimization_budget: Budget for hyperparameter optimization
            
        Returns:
            Training results with model performance and metadata
        """
        logger.info(f"Training industrial model for target: {target_column}")
        
        # Prepare data
        X, y, feature_names = self._prepare_industrial_data(data, target_column)
        
        # Determine task type
        if task_type == 'auto':
            task_type = self._determine_task_type(y)
        
        # Select model architecture
        if model_type == 'auto':
            model_type = self._select_optimal_architecture(X, y, task_type)
        
        # Train model
        training_results = self._train_model_pipeline(
            X, y, feature_names, model_type, task_type, optimization_budget
        )
        
        # Store results
        model_key = f"{target_column}_{model_type}_{task_type}"
        self.models[model_key] = training_results['best_model']
        self.model_performance[model_key] = training_results['performance']
        
        training_results.update({
            'model_key': model_key,
            'target_column': target_column,
            'model_type': model_type,
            'task_type': task_type,
            'feature_names': feature_names
        })
        
        logger.info(f"Model training completed. Best score: {training_results['performance']['best_score']:.4f}")
        
        return training_results
    
    def predict_industrial_outcome(self, data: pd.DataFrame, model_key: str,
                                  return_uncertainty: bool = True) -> Dict[str, Any]:
        """
        Make predictions using trained industrial model.
        
        Args:
            data: Input data for prediction
            model_key: Key identifying the trained model
            return_uncertainty: Whether to return prediction uncertainty
            
        Returns:
            Predictions with confidence intervals and explanations
        """
        if model_key not in self.models:
            raise ValueError(f"Model {model_key} not found. Available models: {list(self.models.keys())}")
        
        model = self.models[model_key]
        
        # Prepare prediction data
        X_pred = self._prepare_prediction_data(data, model_key)
        
        # Make predictions
        predictions = model.predict(X_pred)
        
        results = {
            'predictions': predictions.tolist() if hasattr(predictions, 'tolist') else predictions,
            'model_key': model_key,
            'model_performance': self.model_performance[model_key]
        }
        
        # Add uncertainty estimation if requested
        if return_uncertainty:
            uncertainty = self._estimate_prediction_uncertainty(model, X_pred)
            results['uncertainty'] = uncertainty
        
        # Add feature importance if available
        if hasattr(model, 'feature_importances_'):
            feature_importance = self._get_feature_importance(model, model_key)
            results['feature_importance'] = feature_importance
        
        return results
    
    def optimize_model_ensemble(self, data: pd.DataFrame, target_column: str,
                               ensemble_methods: List[str] = None,
                               optimization_budget: int = 100) -> Dict[str, Any]:
        """
        Create and optimize ensemble of multiple model types.
        
        Args:
            data: Training data
            target_column: Target variable column name
            ensemble_methods: List of ensemble methods to try
            optimization_budget: Budget for optimization per model
            
        Returns:
            Ensemble training results and performance comparison
        """
        if ensemble_methods is None:
            ensemble_methods = ['xgboost', 'lightgbm', 'catboost', 'tensorflow', 'voting']
        
        logger.info(f"Building ensemble with methods: {ensemble_methods}")
        
        # Prepare data
        X, y, feature_names = self._prepare_industrial_data(data, target_column)
        task_type = self._determine_task_type(y)
        
        # Train individual models
        base_models = {}
        model_scores = {}
        
        for method in ensemble_methods:
            if method == 'voting':
                continue  # Handle voting ensemble separately
                
            logger.info(f"Training {method} model...")
            
            try:
                model_results = self._train_single_model(
                    X, y, method, task_type, optimization_budget // len(ensemble_methods)
                )
                base_models[method] = model_results['best_model']
                model_scores[method] = model_results['performance']['best_score']
            except Exception as e:
                logger.warning(f"Failed to train {method}: {e}")
                continue
        
        # Create ensemble models
        ensemble_results = {}
        
        # Voting ensemble
        if len(base_models) >= 2:
            voting_models = list(base_models.values())
            voting_ensemble = self.ensemble_models.build_voting_ensemble(
                voting_models, task_type
            )
            
            # Train and evaluate voting ensemble
            voting_scores = cross_val_score(voting_ensemble, X, y, cv=5)
            ensemble_results['voting'] = {
                'model': voting_ensemble,
                'score': voting_scores.mean(),
                'std': voting_scores.std()
            }
        
        # Stacking ensemble
        if len(base_models) >= 2:
            stacking_models = list(base_models.values())
            stacking_ensemble = self.ensemble_models.build_stacking_ensemble(
                stacking_models, task_type=task_type
            )
            
            # Train and evaluate stacking ensemble
            stacking_scores = cross_val_score(stacking_ensemble, X, y, cv=5)
            ensemble_results['stacking'] = {
                'model': stacking_ensemble,
                'score': stacking_scores.mean(),
                'std': stacking_scores.std()
            }
        
        # Select best ensemble
        if ensemble_results:
            best_ensemble_name = max(ensemble_results.keys(), 
                                   key=lambda k: ensemble_results[k]['score'])
            best_ensemble = ensemble_results[best_ensemble_name]
            
            # Store best ensemble
            ensemble_key = f"{target_column}_ensemble_{best_ensemble_name}"
            self.models[ensemble_key] = best_ensemble['model']
            self.model_performance[ensemble_key] = {
                'best_score': best_ensemble['score'],
                'score_std': best_ensemble['std'],
                'model_type': f"ensemble_{best_ensemble_name}"
            }
        
        return {
            'base_models': base_models,
            'base_model_scores': model_scores,
            'ensemble_results': ensemble_results,
            'best_ensemble': best_ensemble_name if ensemble_results else None,
            'best_ensemble_score': best_ensemble['score'] if ensemble_results else None
        }
    
    def _prepare_industrial_data(self, data: pd.DataFrame, target_column: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare industrial data for training."""
        # Separate features and target
        feature_columns = [col for col in data.columns if col != target_column]
        X = data[feature_columns].copy()
        y = data[target_column].copy()
        
        # Handle missing values
        numeric_columns = X.select_dtypes(include=[np.number]).columns
        categorical_columns = X.select_dtypes(include=['object', 'category']).columns
        
        # Fill missing numeric values with median
        for col in numeric_columns:
            X[col] = X[col].fillna(X[col].median())
        
        # Fill missing categorical values with mode
        for col in categorical_columns:
            X[col] = X[col].fillna(X[col].mode()[0] if not X[col].mode().empty else 'unknown')
        
        # Encode categorical variables
        label_encoders = {}
        for col in categorical_columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col])
            label_encoders[col] = le
        
        # Handle target variable
        y = y.fillna(y.median() if y.dtype in ['int64', 'float64'] else y.mode()[0])
        
        return X.values, y.values, feature_columns
    
    def _determine_task_type(self, y: np.ndarray) -> str:
        """Determine if task is classification or regression."""
        unique_values = len(np.unique(y))
        total_values = len(y)
        
        # Classification if few unique values relative to total
        if unique_values < 20 and unique_values / total_values < 0.1:
            return 'classification'
        
        # Check if target is integer type for classification
        if np.issubdtype(y.dtype, np.integer) and unique_values < total_values * 0.1:
            return 'classification'
        
        return 'regression'
    
    def _select_optimal_architecture(self, X: np.ndarray, y: np.ndarray, task_type: str) -> str:
        """Select optimal model architecture based on data characteristics."""
        n_samples, n_features = X.shape
        
        # For small datasets, use traditional models
        if n_samples < 1000:
            return 'ensemble'
        
        # For medium datasets, use ensemble methods
        if n_samples < 10000:
            return 'ensemble'
        
        # For large datasets with many features, use deep learning
        if n_samples >= 10000 and n_features >= 50:
            return 'deep_learning'
        
        # Default to ensemble methods
        return 'ensemble'
    
    def _train_model_pipeline(self, X: np.ndarray, y: np.ndarray, feature_names: List[str],
                             model_type: str, task_type: str, optimization_budget: int) -> Dict[str, Any]:
        """Execute complete model training pipeline."""
        
        if model_type == 'deep_learning':
            return self._train_deep_learning_model(X, y, task_type, optimization_budget)
        elif model_type == 'ensemble':
            return self._train_ensemble_model(X, y, task_type, optimization_budget)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
    
    def _train_deep_learning_model(self, X: np.ndarray, y: np.ndarray, 
                                  task_type: str, optimization_budget: int) -> Dict[str, Any]:
        """Train deep learning model."""
        
        # Try TensorFlow first, then PyTorch
        frameworks = ['tensorflow'] if TF_AVAILABLE else []
        if TORCH_AVAILABLE:
            frameworks.append('pytorch')
            
        if not frameworks:
            raise ImportError("No deep learning frameworks available. Install TensorFlow or PyTorch.")
        
        best_results = None
        best_score = -np.inf
        
        for framework in frameworks:
            try:
                if framework == 'tensorflow':
                    arch = TensorFlowModelArchitecture()
                    input_shape = (X.shape[1],)
                    output_shape = len(np.unique(y)) if task_type == 'classification' else 1
                    
                    # Try different architectures
                    architectures = ['mlp', 'cnn'] if X.shape[1] > 10 else ['mlp']
                    
                    for arch_type in architectures:
                        model = arch.build_model(input_shape, output_shape, 
                                               model_type=arch_type, task_type=task_type)
                        arch.model = model
                        
                        # Train with cross-validation
                        scores = []
                        for fold in range(3):  # 3-fold CV for speed
                            indices = np.arange(len(X))
                            np.random.shuffle(indices)
                            split = len(X) // 3
                            
                            train_idx = np.concatenate([indices[:fold*split], indices[(fold+1)*split:]])
                            val_idx = indices[fold*split:(fold+1)*split]
                            
                            X_train, X_val = X[train_idx], X[val_idx]
                            y_train, y_val = y[train_idx], y[val_idx]
                            
                            arch.train(X_train, y_train, validation_split=0.2, 
                                     epochs=50, task_type=task_type)
                            
                            val_pred = arch.predict(X_val)
                            
                            if task_type == 'classification':
                                val_pred_class = (val_pred > 0.5).astype(int) if len(np.unique(y)) == 2 else np.argmax(val_pred, axis=1)
                                score = f1_score(y_val, val_pred_class, average='macro')
                            else:
                                score = r2_score(y_val, val_pred)
                            
                            scores.append(score)
                        
                        avg_score = np.mean(scores)
                        if avg_score > best_score:
                            best_score = avg_score
                            best_results = {
                                'best_model': arch,
                                'performance': {
                                    'best_score': avg_score,
                                    'score_std': np.std(scores),
                                    'framework': framework,
                                    'architecture': arch_type
                                }
                            }
                
            except Exception as e:
                logger.warning(f"Failed to train {framework} model: {e}")
                continue
        
        if best_results is None:
            raise ValueError("Failed to train any deep learning model")
        
        return best_results
    
    def _train_ensemble_model(self, X: np.ndarray, y: np.ndarray, 
                             task_type: str, optimization_budget: int) -> Dict[str, Any]:
        """Train ensemble model."""
        
        # Available ensemble methods
        available_methods = []
        if XGBOOST_AVAILABLE:
            available_methods.append('xgboost')
        if LIGHTGBM_AVAILABLE:
            available_methods.append('lightgbm')
        if CATBOOST_AVAILABLE:
            available_methods.append('catboost')
        
        # Always available sklearn methods
        available_methods.extend(['random_forest', 'gradient_boosting'])
        
        best_results = None
        best_score = -np.inf
        
        for method in available_methods:
            try:
                model_results = self._train_single_model(X, y, method, task_type, 
                                                       optimization_budget // len(available_methods))
                
                if model_results['performance']['best_score'] > best_score:
                    best_score = model_results['performance']['best_score']
                    best_results = model_results
                    
            except Exception as e:
                logger.warning(f"Failed to train {method}: {e}")
                continue
        
        if best_results is None:
            raise ValueError("Failed to train any ensemble model")
        
        return best_results
    
    def _train_single_model(self, X: np.ndarray, y: np.ndarray, method: str, 
                           task_type: str, optimization_budget: int) -> Dict[str, Any]:
        """Train a single model with hyperparameter optimization."""
        
        if method == 'xgboost':
            model = self.ensemble_models.build_xgboost_model(task_type)
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [3, 6, 9],
                'learning_rate': [0.01, 0.1, 0.2],
                'subsample': [0.8, 0.9, 1.0]
            }
        elif method == 'lightgbm':
            model = self.ensemble_models.build_lightgbm_model(task_type)
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [-1, 6, 9],
                'learning_rate': [0.01, 0.1, 0.2],
                'subsample': [0.8, 0.9, 1.0]
            }
        elif method == 'catboost':
            model = self.ensemble_models.build_catboost_model(task_type)
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [3, 6, 9],
                'learning_rate': [0.01, 0.1, 0.2]
            }
        elif method == 'random_forest':
            from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
            if task_type == 'classification':
                model = RandomForestClassifier(random_state=42)
            else:
                model = RandomForestRegressor(random_state=42)
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [None, 6, 9, 12],
                'min_samples_split': [2, 5, 10],
                'min_samples_leaf': [1, 2, 4]
            }
        elif method == 'gradient_boosting':
            from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
            if task_type == 'classification':
                model = GradientBoostingClassifier(random_state=42)
            else:
                model = GradientBoostingRegressor(random_state=42)
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [3, 6, 9],
                'learning_rate': [0.01, 0.1, 0.2],
                'subsample': [0.8, 0.9, 1.0]
            }
        else:
            raise ValueError(f"Unknown method: {method}")
        
        # Optimize hyperparameters
        optimization_results = self.hyperparameter_optimizer.optimize_sklearn_model(
            model, param_grid, X, y, n_iter=min(optimization_budget, 50)
        )
        
        return optimization_results
    
    def _prepare_prediction_data(self, data: pd.DataFrame, model_key: str) -> np.ndarray:
        """Prepare data for prediction (simplified version)."""
        # This is a simplified version - in production, should match training preprocessing
        X = data.copy()
        
        # Handle missing values
        numeric_columns = X.select_dtypes(include=[np.number]).columns
        categorical_columns = X.select_dtypes(include=['object', 'category']).columns
        
        for col in numeric_columns:
            X[col] = X[col].fillna(X[col].median())
        
        for col in categorical_columns:
            X[col] = X[col].fillna('unknown')
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col])
        
        return X.values
    
    def _estimate_prediction_uncertainty(self, model, X: np.ndarray) -> List[float]:
        """Estimate prediction uncertainty."""
        if hasattr(model, 'predict_proba'):
            # For classification models, use entropy of probabilities
            probabilities = model.predict_proba(X)
            entropy = -np.sum(probabilities * np.log(probabilities + 1e-10), axis=1)
            return entropy.tolist()
        elif hasattr(model, 'estimators_'):
            # For ensemble models, use prediction variance across estimators
            predictions = np.array([estimator.predict(X) for estimator in model.estimators_])
            uncertainty = np.std(predictions, axis=0)
            return uncertainty.tolist()
        else:
            # Default uncertainty estimation
            return [0.1] * len(X)
    
    def _get_feature_importance(self, model, model_key: str) -> Dict[str, float]:
        """Get feature importance from trained model."""
        if hasattr(model, 'feature_importances_'):
            # Get feature names from stored model info (simplified)
            feature_names = [f'feature_{i}' for i in range(len(model.feature_importances_))]
            return dict(zip(feature_names, model.feature_importances_.tolist()))
        else:
            return {}
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about all trained models."""
        return {
            'total_models': len(self.models),
            'model_keys': list(self.models.keys()),
            'model_performance': self.model_performance,
            'available_frameworks': {
                'tensorflow': TF_AVAILABLE,
                'pytorch': TORCH_AVAILABLE,
                'xgboost': XGBOOST_AVAILABLE,
                'lightgbm': LIGHTGBM_AVAILABLE,
                'catboost': CATBOOST_AVAILABLE
            }
        }
    
    def save_models(self, directory_path: str):
        """Save all trained models."""
        os.makedirs(directory_path, exist_ok=True)
        
        for model_key, model in self.models.items():
            model_path = os.path.join(directory_path, f"{model_key}.joblib")
            model_data = {
                'model': model,
                'performance': self.model_performance.get(model_key, {}),
                'saved_at': datetime.now().isoformat(),
                'model_key': model_key
            }
            joblib.dump(model_data, model_path)
        
        # Save engine metadata
        metadata_path = os.path.join(directory_path, "engine_metadata.json")
        metadata = {
            'model_keys': list(self.models.keys()),
            'model_performance': self.model_performance,
            'saved_at': datetime.now().isoformat(),
            'framework_availability': {
                'tensorflow': TF_AVAILABLE,
                'pytorch': TORCH_AVAILABLE,
                'xgboost': XGBOOST_AVAILABLE,
                'lightgbm': LIGHTGBM_AVAILABLE,
                'catboost': CATBOOST_AVAILABLE
            }
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved {len(self.models)} models to {directory_path}")
    
    def load_models(self, directory_path: str):
        """Load all models from directory."""
        if not os.path.exists(directory_path):
            raise FileNotFoundError(f"Directory not found: {directory_path}")
        
        # Load metadata
        metadata_path = os.path.join(directory_path, "engine_metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            model_keys = metadata['model_keys']
        else:
            # Discover model files
            model_files = [f for f in os.listdir(directory_path) if f.endswith('.joblib')]
            model_keys = [f.replace('.joblib', '') for f in model_files]
        
        # Load models
        for model_key in model_keys:
            model_path = os.path.join(directory_path, f"{model_key}.joblib")
            if os.path.exists(model_path):
                model_data = joblib.load(model_path)
                self.models[model_key] = model_data['model']
                self.model_performance[model_key] = model_data.get('performance', {})
        
        logger.info(f"Loaded {len(self.models)} models from {directory_path}")


# Example usage and factory functions
def create_sensor_fusion_model(sensor_configs: Dict[str, Dict]) -> TensorFlowModelArchitecture:
    """Factory function to create sensor fusion model."""
    if not TF_AVAILABLE:
        raise ImportError("TensorFlow required for sensor fusion models")
    
    arch = TensorFlowModelArchitecture()
    
    # Extract sensor shapes from configs
    sensor_shapes = {name: tuple(config['shape']) for name, config in sensor_configs.items()}
    
    # Build model
    model = arch.build_sensor_fusion_model(
        sensor_shapes=sensor_shapes,
        output_shape=sensor_configs.get('output_shape', 1),
        task_type=sensor_configs.get('task_type', 'regression')
    )
    
    arch.model = model
    return arch


def create_predictive_maintenance_pipeline(data: pd.DataFrame, failure_column: str,
                                         time_column: str = None) -> Dict[str, Any]:
    """Factory function to create predictive maintenance model pipeline."""
    engine = AdvancedMLModelingEngine()
    
    # Configure for predictive maintenance
    model_config = {
        'optimize_for': 'recall',  # Prioritize catching failures
        'class_weights': 'balanced',  # Handle imbalanced failure data
        'time_series_features': True if time_column else False
    }
    
    # Train model
    results = engine.train_industrial_model(
        data=data,
        target_column=failure_column,
        model_type='ensemble',  # Start with ensemble for reliability
        task_type='classification'
    )
    
    return {
        'model_engine': engine,
        'training_results': results,
        'model_key': results['model_key']
    }


def create_quality_control_model(data: pd.DataFrame, defect_column: str,
                                sensor_columns: List[str]) -> Dict[str, Any]:
    """Factory function to create quality control model."""
    engine = AdvancedMLModelingEngine()
    
    # Focus on sensor data for quality prediction
    quality_data = data[sensor_columns + [defect_column]].copy()
    
    # Train model optimized for quality control
    results = engine.train_industrial_model(
        data=quality_data,
        target_column=defect_column,
        model_type='deep_learning',  # Use DL for pattern recognition
        task_type='classification'
    )
    
    return {
        'model_engine': engine,
        'training_results': results,
        'model_key': results['model_key'],
        'sensor_columns': sensor_columns
    }