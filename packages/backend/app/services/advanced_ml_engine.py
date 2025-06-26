"""

# Conditional ML imports

# Conditional ML imports
try:
    import torch
    import transformers
    import sklearn
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    # Use ML service client for remote processing
    from app.services.ml_service_client import ml_service


try:
    import torch
    import transformers
    import sklearn
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    # Use ML service client for remote processing
    from app.services.ml_service_client import ml_service


Advanced ML Engine for Custom Model Training and Predictive Analytics
Provides enterprise-grade machine learning capabilities for Pollarbase
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
import joblib
import json
from datetime import datetime, timedelta
from pathlib import Path
import logging
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, mean_squared_error, r2_score
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.svm import SVC, SVR
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class AdvancedMLEngine:
    """
    Enterprise-grade ML engine for custom model training and advanced analytics
    """
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.encoders = {}
        self.model_metadata = {}
        
    def train_anomaly_detection_model(
        self, 
        data: pd.DataFrame, 
        model_name: str,
        contamination: float = 0.1,
        features: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Train an advanced anomaly detection model
        
        Args:
            data: Training dataset
            model_name: Unique name for the model
            contamination: Expected proportion of outliers
            features: Specific features to use (if None, use all numeric features)
            
        Returns:
            Training results and model metadata
        """
        logger.info(f"Training anomaly detection model: {model_name}")
        
        try:
            # Prepare data
            if features is None:
                numeric_features = data.select_dtypes(include=[np.number]).columns.tolist()
            else:
                numeric_features = features
                
            if len(numeric_features) == 0:
                raise ValueError("No numeric features found for anomaly detection")
                
            X = data[numeric_features].dropna()
            
            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # Train Isolation Forest
            isolation_forest = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100
            )
            isolation_forest.fit(X_scaled)
            
            # Train DBSCAN for clustering-based anomaly detection
            dbscan = DBSCAN(eps=0.5, min_samples=5)
            cluster_labels = dbscan.fit_predict(X_scaled)
            
            # Store models and metadata
            self.models[f"{model_name}_isolation"] = isolation_forest
            self.models[f"{model_name}_dbscan"] = dbscan
            self.scalers[model_name] = scaler
            
            # Calculate performance metrics
            anomaly_scores = isolation_forest.decision_function(X_scaled)
            predictions = isolation_forest.predict(X_scaled)
            
            # Count anomalies
            num_anomalies = np.sum(predictions == -1)
            anomaly_rate = num_anomalies / len(predictions)
            
            # Cluster analysis
            unique_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
            noise_points = np.sum(cluster_labels == -1)
            
            metadata = {
                'model_name': model_name,
                'model_type': 'anomaly_detection',
                'training_date': datetime.utcnow().isoformat(),
                'features_used': numeric_features,
                'data_shape': X.shape,
                'contamination_rate': contamination,
                'detected_anomalies': int(num_anomalies),
                'anomaly_rate': float(anomaly_rate),
                'clusters_found': int(unique_clusters),
                'noise_points': int(noise_points),
                'performance_metrics': {
                    'mean_anomaly_score': float(np.mean(anomaly_scores)),
                    'std_anomaly_score': float(np.std(anomaly_scores)),
                    'min_score': float(np.min(anomaly_scores)),
                    'max_score': float(np.max(anomaly_scores))
                }
            }
            
            self.model_metadata[model_name] = metadata
            
            logger.info(f"Anomaly detection model trained successfully: {num_anomalies} anomalies detected")
            return metadata
            
        except Exception as e:
            logger.error(f"Error training anomaly detection model: {str(e)}")
            raise

    def train_predictive_model(
        self,
        data: pd.DataFrame,
        model_name: str,
        target_column: str,
        model_type: str = 'auto',
        features: Optional[List[str]] = None,
        test_size: float = 0.2
    ) -> Dict[str, Any]:
        """
        Train a predictive model for forecasting or classification
        
        Args:
            data: Training dataset
            model_name: Unique name for the model
            target_column: Column to predict
            model_type: 'classification', 'regression', or 'auto'
            features: Feature columns to use
            test_size: Proportion of data for testing
            
        Returns:
            Training results and model metadata
        """
        logger.info(f"Training predictive model: {model_name}")
        
        try:
            # Prepare features and target
            if target_column not in data.columns:
                raise ValueError(f"Target column '{target_column}' not found in data")
                
            if features is None:
                features = [col for col in data.columns if col != target_column]
                
            # Remove non-numeric features and handle categorical
            X = data[features].copy()
            y = data[target_column].copy()
            
            # Handle categorical features
            categorical_features = X.select_dtypes(include=['object']).columns
            encoders = {}
            
            for col in categorical_features:
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
                encoders[col] = le
                
            # Store encoders
            self.encoders[model_name] = encoders
            
            # Determine model type if auto
            if model_type == 'auto':
                if pd.api.types.is_numeric_dtype(y):
                    if len(y.unique()) < 20:  # Likely classification
                        model_type = 'classification'
                    else:  # Likely regression
                        model_type = 'regression'
                else:
                    model_type = 'classification'
                    
            # Encode target if classification
            target_encoder = None
            if model_type == 'classification' and not pd.api.types.is_numeric_dtype(y):
                target_encoder = LabelEncoder()
                y = target_encoder.fit_transform(y.astype(str))
                self.encoders[f"{model_name}_target"] = target_encoder
                
            # Remove missing values
            mask = ~(X.isnull().any(axis=1) | y.isnull())
            X = X[mask]
            y = y[mask]
            
            if len(X) == 0:
                raise ValueError("No valid data remaining after removing missing values")
                
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=y if model_type == 'classification' else None
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train multiple models and select best
            models_to_try = {}
            
            if model_type == 'classification':
                models_to_try = {
                    'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
                    'logistic_regression': LogisticRegression(random_state=42, max_iter=1000),
                    'svm': SVC(random_state=42, probability=True)
                }
            else:  # regression
                models_to_try = {
                    'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
                    'linear_regression': LinearRegression(),
                    'svr': SVR()
                }
                
            # Train and evaluate models
            model_results = {}
            best_model = None
            best_score = -np.inf if model_type == 'classification' else np.inf
            
            for name, model in models_to_try.items():
                try:
                    # Train model
                    if name in ['logistic_regression', 'svm', 'linear_regression', 'svr']:
                        model.fit(X_train_scaled, y_train)
                        predictions = model.predict(X_test_scaled)
                    else:
                        model.fit(X_train, y_train)
                        predictions = model.predict(X_test)
                    
                    # Calculate metrics
                    if model_type == 'classification':
                        accuracy = accuracy_score(y_test, predictions)
                        precision = precision_score(y_test, predictions, average='weighted')
                        recall = recall_score(y_test, predictions, average='weighted')
                        f1 = f1_score(y_test, predictions, average='weighted')
                        
                        score = f1  # Use F1 score for model selection
                        metrics = {
                            'accuracy': float(accuracy),
                            'precision': float(precision),
                            'recall': float(recall),
                            'f1_score': float(f1)
                        }
                        
                        if score > best_score:
                            best_score = score
                            best_model = (name, model)
                            
                    else:  # regression
                        mse = mean_squared_error(y_test, predictions)
                        rmse = np.sqrt(mse)
                        r2 = r2_score(y_test, predictions)
                        
                        score = -rmse  # Use negative RMSE for model selection (higher is better)
                        metrics = {
                            'mse': float(mse),
                            'rmse': float(rmse),
                            'r2_score': float(r2)
                        }
                        
                        if score > best_score:
                            best_score = score
                            best_model = (name, model)
                    
                    model_results[name] = metrics
                    
                except Exception as model_error:
                    logger.warning(f"Error training {name}: {str(model_error)}")
                    continue
            
            if best_model is None:
                raise ValueError("No models could be trained successfully")
                
            # Store best model and scaler
            best_name, best_model_obj = best_model
            self.models[model_name] = best_model_obj
            self.scalers[model_name] = scaler
            
            # Feature importance (if available)
            feature_importance = {}
            if hasattr(best_model_obj, 'feature_importances_'):
                feature_importance = {
                    feature: float(importance) 
                    for feature, importance in zip(features, best_model_obj.feature_importances_)
                }
                
            # Create metadata
            metadata = {
                'model_name': model_name,
                'model_type': model_type,
                'algorithm_used': best_name,
                'training_date': datetime.utcnow().isoformat(),
                'target_column': target_column,
                'features_used': features,
                'data_shape': X.shape,
                'test_size': test_size,
                'performance_metrics': model_results[best_name],
                'all_model_results': model_results,
                'feature_importance': feature_importance,
                'best_score': float(best_score)
            }
            
            self.model_metadata[model_name] = metadata
            
            logger.info(f"Predictive model trained successfully: {best_name} with score {best_score:.4f}")
            return metadata
            
        except Exception as e:
            logger.error(f"Error training predictive model: {str(e)}")
            raise

    def detect_anomalies(self, data: pd.DataFrame, model_name: str) -> Dict[str, Any]:
        """
        Detect anomalies using a trained anomaly detection model
        """
        try:
            if f"{model_name}_isolation" not in self.models:
                raise ValueError(f"Anomaly detection model '{model_name}' not found")
                
            isolation_model = self.models[f"{model_name}_isolation"]
            scaler = self.scalers[model_name]
            metadata = self.model_metadata[model_name]
            
            # Prepare data
            features = metadata['features_used']
            X = data[features].dropna()
            X_scaled = scaler.transform(X)
            
            # Predict anomalies
            anomaly_scores = isolation_model.decision_function(X_scaled)
            predictions = isolation_model.predict(X_scaled)
            
            # Create results
            anomaly_indices = np.where(predictions == -1)[0]
            anomaly_data = X.iloc[anomaly_indices]
            
            results = {
                'total_records': len(X),
                'anomalies_detected': len(anomaly_indices),
                'anomaly_rate': len(anomaly_indices) / len(X),
                'anomaly_scores': anomaly_scores.tolist(),
                'anomaly_indices': anomaly_indices.tolist(),
                'anomaly_records': anomaly_data.to_dict('records') if len(anomaly_data) > 0 else [],
                'detection_date': datetime.utcnow().isoformat()
            }
            
            return results
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {str(e)}")
            raise

    def make_predictions(
        self, 
        data: pd.DataFrame, 
        model_name: str, 
        return_probabilities: bool = False
    ) -> Dict[str, Any]:
        """
        Make predictions using a trained predictive model
        """
        try:
            if model_name not in self.models:
                raise ValueError(f"Predictive model '{model_name}' not found")
                
            model = self.models[model_name]
            scaler = self.scalers[model_name]
            metadata = self.model_metadata[model_name]
            
            # Prepare data
            features = metadata['features_used']
            X = data[features].copy()
            
            # Handle categorical features
            if model_name in self.encoders:
                encoders = self.encoders[model_name]
                for col, encoder in encoders.items():
                    if col in X.columns:
                        X[col] = encoder.transform(X[col].astype(str))
            
            # Handle missing values (simple imputation)
            X = X.fillna(X.mean())
            
            # Scale features if needed
            algorithm = metadata['algorithm_used']
            if algorithm in ['logistic_regression', 'svm', 'linear_regression', 'svr']:
                X_processed = scaler.transform(X)
            else:
                X_processed = X
            
            # Make predictions
            predictions = model.predict(X_processed)
            
            # Handle target encoding if classification
            if f"{model_name}_target" in self.encoders:
                target_encoder = self.encoders[f"{model_name}_target"]
                predictions = target_encoder.inverse_transform(predictions)
            
            results = {
                'predictions': predictions.tolist(),
                'prediction_date': datetime.utcnow().isoformat(),
                'model_used': model_name,
                'features_used': features
            }
            
            # Add probabilities for classification
            if return_probabilities and hasattr(model, 'predict_proba'):
                probabilities = model.predict_proba(X_processed)
                results['probabilities'] = probabilities.tolist()
                if hasattr(model, 'classes_'):
                    results['classes'] = model.classes_.tolist()
            
            return results
            
        except Exception as e:
            logger.error(f"Error making predictions: {str(e)}")
            raise

    def generate_insights(self, data: pd.DataFrame, model_name: str) -> Dict[str, Any]:
        """
        Generate natural language insights from model results
        """
        try:
            if model_name not in self.model_metadata:
                raise ValueError(f"Model '{model_name}' not found")
                
            metadata = self.model_metadata[model_name]
            model_type = metadata['model_type']
            
            insights = {
                'model_name': model_name,
                'model_type': model_type,
                'generated_date': datetime.utcnow().isoformat(),
                'insights': []
            }
            
            if model_type == 'anomaly_detection':
                anomaly_rate = metadata['anomaly_rate']
                num_anomalies = metadata['detected_anomalies']
                
                insights['insights'].extend([
                    f"Detected {num_anomalies} anomalous records ({anomaly_rate:.2%} of total data)",
                    f"Model found {metadata['clusters_found']} distinct clusters in the data",
                    f"Anomaly detection threshold optimized for {metadata['contamination_rate']:.1%} contamination rate"
                ])
                
                if anomaly_rate > 0.1:
                    insights['insights'].append("⚠️ High anomaly rate detected - consider investigating data quality")
                elif anomaly_rate < 0.01:
                    insights['insights'].append("✅ Low anomaly rate indicates high data quality")
                    
            elif model_type in ['classification', 'regression']:
                performance = metadata['performance_metrics']
                algorithm = metadata['algorithm_used']
                
                if model_type == 'classification':
                    f1_score = performance['f1_score']
                    accuracy = performance['accuracy']
                    
                    insights['insights'].extend([
                        f"Model achieved {accuracy:.2%} accuracy using {algorithm.replace('_', ' ').title()}",
                        f"F1 score of {f1_score:.3f} indicates {'excellent' if f1_score > 0.9 else 'good' if f1_score > 0.8 else 'moderate'} performance",
                        f"Model analyzed {len(metadata['features_used'])} features for prediction"
                    ])
                    
                else:  # regression
                    r2_score = performance['r2_score']
                    rmse = performance['rmse']
                    
                    insights['insights'].extend([
                        f"Model explains {r2_score:.2%} of variance in {metadata['target_column']}",
                        f"Average prediction error (RMSE): {rmse:.3f}",
                        f"{'Strong' if r2_score > 0.8 else 'Moderate' if r2_score > 0.5 else 'Weak'} predictive relationship found"
                    ])
                
                # Feature importance insights
                if metadata.get('feature_importance'):
                    top_features = sorted(
                        metadata['feature_importance'].items(), 
                        key=lambda x: x[1], 
                        reverse=True
                    )[:3]
                    
                    insights['insights'].append(
                        f"Most important features: {', '.join([f[0] for f in top_features])}"
                    )
            
            return insights
            
        except Exception as e:
            logger.error(f"Error generating insights: {str(e)}")
            raise

    def get_model_summary(self) -> Dict[str, Any]:
        """
        Get summary of all trained models
        """
        return {
            'total_models': len(self.models),
            'model_metadata': self.model_metadata,
            'last_updated': datetime.utcnow().isoformat()
        }

    def save_model(self, model_name: str, file_path: str) -> bool:
        """
        Save a trained model to disk
        """
        try:
            if model_name not in self.models:
                raise ValueError(f"Model '{model_name}' not found")
                
            model_data = {
                'model': self.models[model_name],
                'scaler': self.scalers.get(model_name),
                'encoders': self.encoders.get(model_name),
                'metadata': self.model_metadata.get(model_name)
            }
            
            joblib.dump(model_data, file_path)
            logger.info(f"Model '{model_name}' saved to {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving model: {str(e)}")
            return False

    def load_model(self, model_name: str, file_path: str) -> bool:
        """
        Load a trained model from disk
        """
        try:
            model_data = joblib.load(file_path)
            
            self.models[model_name] = model_data['model']
            if model_data['scaler']:
                self.scalers[model_name] = model_data['scaler']
            if model_data['encoders']:
                self.encoders[model_name] = model_data['encoders']
            if model_data['metadata']:
                self.model_metadata[model_name] = model_data['metadata']
                
            logger.info(f"Model '{model_name}' loaded from {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            return False


# Global ML engine instance
advanced_ml_engine = AdvancedMLEngine() 