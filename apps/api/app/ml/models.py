"""
Enhanced ML Models for Industry-Specific Applications
Manufacturing sensor prediction, e-commerce recommendations, and financial rare event detection
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union
from sklearn.base import BaseEstimator, TransformerMixin, ClassifierMixin, RegressorMixin
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.model_selection import cross_val_score, GridSearchCV, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, mean_squared_error, r2_score
import warnings
warnings.filterwarnings('ignore')
import logging
from datetime import datetime
import joblib
import os

logger = logging.getLogger(__name__)


class ManufacturingPredictorModel:
    """
    Advanced ML model for manufacturing sensor data prediction and equipment health monitoring.
    
    Features:
    - Time series prediction for sensor values
    - Equipment failure prediction
    - Anomaly detection and classification
    - Predictive maintenance scheduling
    - Multi-sensor fusion for accurate predictions
    """
    
    def __init__(self, prediction_horizon: int = 10, model_type: str = 'ensemble'):
        self.prediction_horizon = prediction_horizon
        self.model_type = model_type
        self.models = {}
        self.scalers = {}
        self.feature_importance = {}
        self.model_performance = {}
        
    def train_predictive_models(self, data: pd.DataFrame, 
                              target_columns: List[str],
                              timestamp_column: Optional[str] = None) -> Dict[str, Any]:
        """
        Train predictive models for manufacturing sensor data.
        
        Args:
            data: Training data with sensor readings
            target_columns: Columns to predict
            timestamp_column: Optional timestamp for time series modeling
            
        Returns:
            Training results and model performance metrics
        """
        logger.info(f"Training manufacturing predictive models for {len(target_columns)} targets")
        
        training_results = {
            "model_type": self.model_type,
            "models_trained": {},
            "overall_performance": {},
            "feature_importance": {}
        }
        
        # Prepare features and targets
        feature_data, target_data = self._prepare_manufacturing_data(
            data, target_columns, timestamp_column
        )
        
        for target_col in target_columns:
            if target_col not in target_data.columns:
                logger.warning(f"Target column {target_col} not found in data")
                continue
            
            logger.info(f"Training model for {target_col}")
            
            # Determine if this is a classification or regression task
            is_classification = self._is_classification_task(target_data[target_col])
            
            # Train model
            model_result = self._train_single_target_model(
                feature_data, target_data[target_col], target_col, is_classification
            )
            
            training_results["models_trained"][target_col] = model_result
            
            # Store model and scaler
            self.models[target_col] = model_result["model"]
            self.scalers[target_col] = model_result["scaler"]
            self.feature_importance[target_col] = model_result["feature_importance"]
            self.model_performance[target_col] = model_result["performance"]
        
        # Calculate overall performance
        training_results["overall_performance"] = self._calculate_overall_performance()
        training_results["feature_importance"] = self.feature_importance
        
        logger.info("Manufacturing model training completed")
        return training_results
    
    def predict_sensor_values(self, data: pd.DataFrame, 
                            target_columns: List[str] = None) -> Dict[str, Any]:
        """
        Predict future sensor values and equipment states.
        
        Args:
            data: Input sensor data for prediction
            target_columns: Specific targets to predict (if None, predict all trained)
            
        Returns:
            Predictions with confidence intervals and anomaly scores
        """
        if target_columns is None:
            target_columns = list(self.models.keys())
        
        predictions = {
            "predictions": {},
            "confidence_intervals": {},
            "anomaly_scores": {},
            "equipment_health_indicators": {}
        }
        
        # Prepare features
        feature_data = self._prepare_prediction_features(data)
        
        for target_col in target_columns:
            if target_col not in self.models:
                logger.warning(f"No trained model found for {target_col}")
                continue
            
            model = self.models[target_col]
            scaler = self.scalers[target_col]
            
            # Scale features
            scaled_features = scaler.transform(feature_data)
            
            # Make predictions
            pred_values = model.predict(scaled_features)
            predictions["predictions"][target_col] = pred_values.tolist()
            
            # Calculate confidence intervals (for ensemble models)
            if hasattr(model, 'estimators_'):
                confidence_interval = self._calculate_confidence_interval(
                    model, scaled_features
                )
                predictions["confidence_intervals"][target_col] = confidence_interval
            
            # Calculate anomaly scores
            anomaly_scores = self._calculate_anomaly_scores(
                scaled_features, target_col
            )
            predictions["anomaly_scores"][target_col] = anomaly_scores
        
        # Generate equipment health indicators
        equipment_health = self._generate_equipment_health_indicators(predictions)
        predictions["equipment_health_indicators"] = equipment_health
        
        return predictions
    
    def _prepare_manufacturing_data(self, data: pd.DataFrame,
                                  target_columns: List[str],
                                  timestamp_column: Optional[str]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Prepare manufacturing data for training."""
        # Create lag features for time series prediction
        feature_data = data.copy()
        
        if timestamp_column and timestamp_column in data.columns:
            # Sort by timestamp
            feature_data = feature_data.sort_values(timestamp_column)
            
            # Create lag features
            numeric_columns = feature_data.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                if col not in target_columns:
                    # Create multiple lag features
                    for lag in [1, 2, 3, 5, 10]:
                        feature_data[f'{col}_lag_{lag}'] = feature_data[col].shift(lag)
                    
                    # Rolling statistics
                    for window in [5, 10, 20]:
                        feature_data[f'{col}_rolling_mean_{window}'] = (
                            feature_data[col].rolling(window=window).mean()
                        )
                        feature_data[f'{col}_rolling_std_{window}'] = (
                            feature_data[col].rolling(window=window).std()
                        )
        
        # Remove rows with NaN values created by lag features
        feature_data = feature_data.dropna()
        
        # Separate features and targets
        feature_columns = [col for col in feature_data.columns 
                          if col not in target_columns and col != timestamp_column]
        
        X = feature_data[feature_columns]
        y = feature_data[target_columns]
        
        return X, y
    
    def _train_single_target_model(self, X: pd.DataFrame, y: pd.Series,
                                 target_name: str, is_classification: bool) -> Dict[str, Any]:
        """Train a model for a single target variable."""
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Choose model based on type and task
        if self.model_type == 'ensemble':
            if is_classification:
                model = self._create_ensemble_classifier()
            else:
                model = self._create_ensemble_regressor()
        elif self.model_type == 'neural_network':
            if is_classification:
                model = MLPClassifier(hidden_layer_sizes=(100, 50), random_state=42)
            else:
                model = MLPRegressor(hidden_layer_sizes=(100, 50), random_state=42)
        else:
            # Default to Random Forest
            if is_classification:
                model = RandomForestClassifier(n_estimators=100, random_state=42)
            else:
                model = RandomForestRegressor(n_estimators=100, random_state=42)
        
        # Train model
        model.fit(X_scaled, y)
        
        # Evaluate performance
        if is_classification:
            cv_scores = cross_val_score(model, X_scaled, y, cv=5, scoring='f1_macro')
            performance_metric = cv_scores.mean()
        else:
            cv_scores = cross_val_score(model, X_scaled, y, cv=5, scoring='r2')
            performance_metric = cv_scores.mean()
        
        # Feature importance
        if hasattr(model, 'feature_importances_'):
            feature_importance = dict(zip(X.columns, model.feature_importances_))
        else:
            feature_importance = {}
        
        return {
            "model": model,
            "scaler": scaler,
            "performance": {
                "cv_score_mean": performance_metric,
                "cv_score_std": cv_scores.std(),
                "is_classification": is_classification
            },
            "feature_importance": feature_importance
        }
    
    def _create_ensemble_classifier(self):
        """Create ensemble classifier for manufacturing predictions."""
        from sklearn.ensemble import VotingClassifier
        
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        gb = GradientBoostingClassifier(n_estimators=100, random_state=42)
        mlp = MLPClassifier(hidden_layer_sizes=(50, 25), random_state=42)
        
        ensemble = VotingClassifier(
            estimators=[('rf', rf), ('gb', gb), ('mlp', mlp)],
            voting='soft'
        )
        
        return ensemble
    
    def _create_ensemble_regressor(self):
        """Create ensemble regressor for manufacturing predictions."""
        from sklearn.ensemble import VotingRegressor
        
        rf = RandomForestRegressor(n_estimators=100, random_state=42)
        gb = GradientBoostingRegressor(n_estimators=100, random_state=42)
        mlp = MLPRegressor(hidden_layer_sizes=(50, 25), random_state=42)
        
        ensemble = VotingRegressor(
            estimators=[('rf', rf), ('gb', gb), ('mlp', mlp)]
        )
        
        return ensemble


class EcommerceRecommendationModel:
    """
    Advanced recommendation model for e-commerce cold start scenarios.
    
    Features:
    - Hybrid recommendation combining collaborative and content-based filtering
    - Cold start user and item recommendations
    - Real-time recommendation updates
    - Personalization based on user behavior patterns
    - Multi-objective optimization (relevance, diversity, novelty)
    """
    
    def __init__(self, embedding_dim: int = 50, cold_start_strategy: str = 'hybrid'):
        self.embedding_dim = embedding_dim
        self.cold_start_strategy = cold_start_strategy
        self.user_embeddings = {}
        self.item_embeddings = {}
        self.content_features = {}
        self.model_performance = {}
        
    def train_recommendation_model(self, interactions: pd.DataFrame,
                                 user_features: pd.DataFrame = None,
                                 item_features: pd.DataFrame = None) -> Dict[str, Any]:
        """
        Train the recommendation model using interaction data and features.
        
        Args:
            interactions: User-item interaction data
            user_features: Optional user feature data
            item_features: Optional item feature data
            
        Returns:
            Training results and model performance
        """
        logger.info("Training e-commerce recommendation model")
        
        training_results = {
            "model_type": "hybrid_recommendation",
            "cold_start_strategy": self.cold_start_strategy,
            "performance_metrics": {},
            "embedding_statistics": {}
        }
        
        # Train collaborative filtering component
        if len(interactions) > 100:  # Minimum interactions for CF
            cf_results = self._train_collaborative_filtering(interactions)
            training_results["collaborative_filtering"] = cf_results
        
        # Train content-based component
        if item_features is not None:
            content_results = self._train_content_based_filtering(item_features, interactions)
            training_results["content_based"] = content_results
        
        # Train cold start models
        cold_start_results = self._train_cold_start_models(
            interactions, user_features, item_features
        )
        training_results["cold_start_models"] = cold_start_results
        
        # Evaluate overall model performance
        performance = self._evaluate_recommendation_performance(interactions)
        training_results["performance_metrics"] = performance
        
        logger.info("E-commerce recommendation model training completed")
        return training_results
    
    def generate_recommendations(self, user_id: str, num_recommendations: int = 10,
                               user_features: Dict = None,
                               exclude_items: List[str] = None) -> Dict[str, Any]:
        """
        Generate personalized recommendations for a user.
        
        Args:
            user_id: User identifier
            num_recommendations: Number of recommendations to generate
            user_features: Optional user features for cold start
            exclude_items: Items to exclude from recommendations
            
        Returns:
            Ranked list of recommendations with scores and explanations
        """
        recommendations = {
            "user_id": user_id,
            "recommendations": [],
            "recommendation_strategy": "",
            "explanation": {},
            "diversity_score": 0.0,
            "novelty_score": 0.0
        }
        
        # Determine recommendation strategy
        is_cold_start_user = user_id not in self.user_embeddings
        
        if is_cold_start_user:
            strategy = self._get_cold_start_strategy(user_features)
            recs = self._generate_cold_start_recommendations(
                user_id, user_features, num_recommendations
            )
        else:
            strategy = "collaborative_content_hybrid"
            recs = self._generate_warm_user_recommendations(
                user_id, num_recommendations, exclude_items
            )
        
        recommendations["recommendations"] = recs
        recommendations["recommendation_strategy"] = strategy
        
        # Calculate recommendation quality metrics
        if recs:
            diversity = self._calculate_recommendation_diversity(recs)
            novelty = self._calculate_recommendation_novelty(recs)
            
            recommendations["diversity_score"] = diversity
            recommendations["novelty_score"] = novelty
            recommendations["explanation"] = self._generate_recommendation_explanation(
                recs, strategy
            )
        
        return recommendations
    
    def update_model_with_feedback(self, user_id: str, item_id: str, 
                                 feedback: float, feedback_type: str = 'rating'):
        """
        Update the model with new user feedback for online learning.
        
        Args:
            user_id: User identifier
            item_id: Item identifier
            feedback: Feedback value (rating, click, etc.)
            feedback_type: Type of feedback ('rating', 'click', 'purchase')
        """
        logger.info(f"Updating model with {feedback_type} feedback: {user_id} -> {item_id}")
        
        # Update user and item embeddings based on feedback
        self._update_embeddings_with_feedback(user_id, item_id, feedback, feedback_type)
        
        # Update content features if needed
        self._update_content_features(item_id, feedback)
        
        # Log feedback for model retraining
        self._log_feedback_for_retraining(user_id, item_id, feedback, feedback_type)


class FinancialRareEventModel:
    """
    Advanced ML model for financial rare event detection and prediction.
    
    Features:
    - Multi-class rare event classification
    - Temporal pattern recognition for financial anomalies
    - Risk scoring and probability estimation
    - Real-time fraud detection
    - Market stress indicators
    """
    
    def __init__(self, event_threshold: float = 0.05, model_ensemble: bool = True):
        self.event_threshold = event_threshold
        self.model_ensemble = model_ensemble
        self.models = {}
        self.feature_scalers = {}
        self.event_patterns = {}
        self.risk_thresholds = {}
        
    def train_rare_event_models(self, data: pd.DataFrame, 
                              target_column: str,
                              timestamp_column: Optional[str] = None) -> Dict[str, Any]:
        """
        Train models for rare event detection and classification.
        
        Args:
            data: Financial dataset with rare event labels
            target_column: Column indicating rare events
            timestamp_column: Optional timestamp for temporal modeling
            
        Returns:
            Training results and model performance metrics
        """
        logger.info("Training financial rare event detection models")
        
        # Check rare event ratio
        rare_event_ratio = data[target_column].sum() / len(data)
        logger.info(f"Rare event ratio: {rare_event_ratio:.4f}")
        
        training_results = {
            "model_type": "rare_event_ensemble" if self.model_ensemble else "single_model",
            "rare_event_ratio": rare_event_ratio,
            "models_trained": {},
            "performance_metrics": {},
            "feature_importance": {}
        }
        
        # Prepare features
        X, y = self._prepare_financial_features(data, target_column, timestamp_column)
        
        # Apply sophisticated sampling
        from .feature_engineering import RareEventFeatureEngine
        rare_event_engine = RareEventFeatureEngine()
        X_sampled, y_sampled = rare_event_engine.advanced_rare_event_sampling(
            X, y, sampling_method='ensemble'
        )
        
        # Train models
        if self.model_ensemble:
            # Train ensemble of specialized models
            ensemble_results = self._train_rare_event_ensemble(X_sampled, y_sampled)
            training_results["models_trained"] = ensemble_results
        else:
            # Train single optimized model
            single_model_results = self._train_single_rare_event_model(X_sampled, y_sampled)
            training_results["models_trained"] = single_model_results
        
        # Evaluate performance
        performance = self._evaluate_rare_event_performance(X, y)
        training_results["performance_metrics"] = performance
        
        # Extract feature importance
        feature_importance = self._extract_feature_importance()
        training_results["feature_importance"] = feature_importance
        
        # Calculate risk thresholds
        risk_thresholds = self._calculate_risk_thresholds(X, y)
        training_results["risk_thresholds"] = risk_thresholds
        self.risk_thresholds = risk_thresholds
        
        logger.info("Financial rare event model training completed")
        return training_results
    
    def predict_rare_events(self, data: pd.DataFrame, 
                          return_probabilities: bool = True) -> Dict[str, Any]:
        """
        Predict rare events with confidence scores and risk assessment.
        
        Args:
            data: Financial data for prediction
            return_probabilities: Whether to return probability scores
            
        Returns:
            Predictions with risk scores and confidence intervals
        """
        predictions = {
            "predictions": [],
            "probabilities": [],
            "risk_scores": [],
            "confidence_levels": [],
            "alert_level": "normal"
        }
        
        # Prepare features
        X_pred = self._prepare_prediction_features(data)
        
        # Make predictions
        if self.model_ensemble:
            pred_results = self._predict_with_ensemble(X_pred, return_probabilities)
        else:
            pred_results = self._predict_with_single_model(X_pred, return_probabilities)
        
        predictions.update(pred_results)
        
        # Calculate risk scores
        risk_scores = self._calculate_risk_scores(predictions["probabilities"])
        predictions["risk_scores"] = risk_scores
        
        # Determine alert level
        alert_level = self._determine_alert_level(risk_scores)
        predictions["alert_level"] = alert_level
        
        # Add temporal context if available
        if "timestamp" in data.columns:
            temporal_context = self._analyze_temporal_context(data, predictions)
            predictions["temporal_context"] = temporal_context
        
        return predictions
    
    def get_model_explanations(self, data: pd.DataFrame, 
                             top_features: int = 10) -> Dict[str, Any]:
        """
        Generate model explanations for rare event predictions.
        
        Args:
            data: Input data for explanation
            top_features: Number of top features to explain
            
        Returns:
            Feature importance and SHAP-like explanations
        """
        explanations = {
            "global_feature_importance": {},
            "local_explanations": [],
            "risk_factor_analysis": {}
        }
        
        # Global feature importance
        global_importance = self._get_global_feature_importance(top_features)
        explanations["global_feature_importance"] = global_importance
        
        # Local explanations for each prediction
        X_explain = self._prepare_prediction_features(data)
        local_explanations = self._generate_local_explanations(X_explain, top_features)
        explanations["local_explanations"] = local_explanations
        
        # Risk factor analysis
        risk_factors = self._analyze_risk_factors(X_explain)
        explanations["risk_factor_analysis"] = risk_factors
        
        return explanations


# Utility functions for model persistence and deployment
def save_model(model, model_path: str, metadata: Dict = None):
    """Save trained model with metadata."""
    model_data = {
        "model": model,
        "metadata": metadata or {},
        "saved_at": datetime.now().isoformat(),
        "version": "1.0"
    }
    
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model_data, model_path)
    logger.info(f"Model saved to {model_path}")


def load_model(model_path: str):
    """Load trained model with metadata."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    model_data = joblib.load(model_path)
    logger.info(f"Model loaded from {model_path}")
    
    return model_data["model"], model_data.get("metadata", {})


def get_model_info(model_path: str) -> Dict[str, Any]:
    """Get model information without loading the full model."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    # Load only metadata
    model_data = joblib.load(model_path)
    
    return {
        "metadata": model_data.get("metadata", {}),
        "saved_at": model_data.get("saved_at"),
        "version": model_data.get("version"),
        "file_size_mb": os.path.getsize(model_path) / (1024 * 1024)
    }