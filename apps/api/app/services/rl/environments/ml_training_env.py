"""
ML Training Environment for Reinforcement Learning-based Hyperparameter Optimization

This environment simulates ML model training with different hyperparameter configurations,
providing rewards based on model performance metrics.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
try:
    import gym
    from gym import spaces
except ImportError:
    import gymnasium as gym
    from gymnasium import spaces
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


from dataclasses import dataclass, field

@dataclass
class HyperparameterSpace:
    """Define hyperparameter search space for different model types."""
    
    # Random Forest parameters
    rf_n_estimators: Tuple[int, int] = (10, 200)
    rf_max_depth: Tuple[int, int] = (3, 20)
    rf_min_samples_split: Tuple[int, int] = (2, 20)
    rf_min_samples_leaf: Tuple[int, int] = (1, 10)
    
    # Neural Network parameters
    nn_hidden_layer_sizes: List[Tuple[int, ...]] = field(default_factory=lambda: [(50,), (100,), (50, 25), (100, 50)])
    nn_alpha: Tuple[float, float] = (0.0001, 0.01)
    nn_learning_rate_init: Tuple[float, float] = (0.001, 0.1)
    
    # General parameters
    validation_split: Tuple[float, float] = (0.1, 0.3)
    random_state_seed: int = 42


class MLTrainingEnvironment(gym.Env):
    """
    Gym environment for ML model training with hyperparameter optimization.
    
    The agent learns to select optimal hyperparameters by receiving rewards
    based on model performance metrics.
    """
    
    def __init__(self, 
                 pipeline_id: str,
                 training_data_path: str,
                 validation_data_path: Optional[str] = None,
                 hyperparameter_space: Optional[Dict[str, Any]] = None,
                 objective: str = "balanced_performance",
                 ml_client=None):
        super().__init__()
        
        self.pipeline_id = pipeline_id
        self.training_data_path = training_data_path
        self.validation_data_path = validation_data_path
        self.objective = objective
        self.ml_client = ml_client
        
        # Initialize hyperparameter space
        if hyperparameter_space:
            self.hyperparameter_space = hyperparameter_space
        else:
            self.hyperparameter_space = self._create_default_hyperparameter_space()
        
        # Define action and observation spaces
        self.action_space = self._create_action_space()
        self.observation_space = self._create_observation_space()
        
        # Load and prepare data
        self.X_train, self.X_val, self.y_train, self.y_val = self._load_and_prepare_data()
        
        # Environment state
        self.current_hyperparameters = {}
        self.performance_history = []
        self.best_performance = -np.inf
        self.episode_count = 0
        self.current_step = 0
        
        # Determine if this is a classification or regression task
        self.is_classification = self._determine_task_type()
        
        logger.info(f"Initialized ML Training Environment for pipeline {pipeline_id}")
        logger.info(f"Task type: {'Classification' if self.is_classification else 'Regression'}")
        logger.info(f"Training data shape: {self.X_train.shape}")
        logger.info(f"Validation data shape: {self.X_val.shape}")
    
    def reset(self) -> np.ndarray:
        """Reset the environment to initial state."""
        self.current_step = 0
        self.episode_count += 1
        
        # Initialize with random hyperparameters
        self.current_hyperparameters = self._sample_random_hyperparameters()
        
        # Create initial observation
        observation = self._create_observation()
        
        logger.debug(f"Environment reset for episode {self.episode_count}")
        return observation
    
    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """Execute one step in the environment."""
        self.current_step += 1
        
        # Convert action to hyperparameters
        hyperparameters = self._action_to_hyperparameters(action)
        self.current_hyperparameters = hyperparameters
        
        # Train model with selected hyperparameters
        try:
            performance = self._evaluate_hyperparameters(hyperparameters)
            reward = self._calculate_reward(performance)
            
            # Update performance history
            self.performance_history.append(performance)
            
            # Update best performance
            if performance > self.best_performance:
                self.best_performance = performance
                logger.debug(f"New best performance: {self.best_performance:.4f}")
            
        except Exception as e:
            logger.error(f"Error evaluating hyperparameters: {str(e)}")
            performance = 0.0
            reward = -1.0  # Penalty for invalid hyperparameters
        
        # Create observation
        observation = self._create_observation()
        
        # Check if episode is done (can be extended with more sophisticated termination)
        done = self.current_step >= 100  # Max steps per episode
        
        # Additional info
        info = {
            "performance": performance,
            "hyperparameters": hyperparameters,
            "best_performance": self.best_performance,
            "episode": self.episode_count,
            "step": self.current_step
        }
        
        return observation, reward, done, info
    
    def get_current_hyperparameters(self) -> Dict[str, Any]:
        """Get current hyperparameters being evaluated."""
        return self.current_hyperparameters.copy()
    
    def _create_default_hyperparameter_space(self) -> Dict[str, Any]:
        """Create default hyperparameter space."""
        return {
            "model_type": ["random_forest", "neural_network"],
            "rf_n_estimators": (10, 200),
            "rf_max_depth": (3, 20),
            "rf_min_samples_split": (2, 20),
            "nn_hidden_layer_size": (10, 200),
            "nn_alpha": (0.0001, 0.01),
            "validation_split": (0.1, 0.3)
        }
    
    def _create_action_space(self) -> spaces.Box:
        """Create action space for hyperparameter selection."""
        # Action space represents normalized hyperparameter values [0, 1]
        # Each dimension corresponds to a hyperparameter
        action_dim = len(self.hyperparameter_space)
        return spaces.Box(low=0.0, high=1.0, shape=(action_dim,), dtype=np.float32)
    
    def _create_observation_space(self) -> spaces.Box:
        """Create observation space for environment state."""
        # Observation includes:
        # - Current performance metrics (5 values)
        # - Performance history statistics (5 values)
        # - Data characteristics (3 values)
        # - Training progress (2 values)
        obs_dim = 15
        return spaces.Box(low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32)
    
    def _load_and_prepare_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
        """Load and prepare training and validation data."""
        # Load training data
        if self.training_data_path.endswith('.csv'):
            train_data = pd.read_csv(self.training_data_path)
        else:
            # Handle other formats or ML client loading
            if self.ml_client:
                train_data = self.ml_client.load_data(self.training_data_path)
            else:
                raise ValueError(f"Unsupported data format: {self.training_data_path}")
        
        # Assume last column is target (can be made configurable)
        X = train_data.iloc[:, :-1]
        y = train_data.iloc[:, -1]
        
        # Load validation data if provided
        if self.validation_data_path:
            if self.validation_data_path.endswith('.csv'):
                val_data = pd.read_csv(self.validation_data_path)
            else:
                if self.ml_client:
                    val_data = self.ml_client.load_data(self.validation_data_path)
                else:
                    raise ValueError(f"Unsupported validation data format: {self.validation_data_path}")
            
            X_val = val_data.iloc[:, :-1]
            y_val = val_data.iloc[:, -1]
        else:
            # Split training data
            X, X_val, y, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Prepare features
        X, X_val = self._prepare_features(X, X_val)
        
        return X, X_val, y, y_val
    
    def _prepare_features(self, X_train: pd.DataFrame, X_val: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Prepare features for training."""
        # Handle categorical variables
        categorical_columns = X_train.select_dtypes(include=['object', 'category']).columns
        
        if len(categorical_columns) > 0:
            # Simple label encoding for categorical variables
            label_encoders = {}
            for col in categorical_columns:
                le = LabelEncoder()
                X_train[col] = le.fit_transform(X_train[col].astype(str))
                
                # Handle unseen categories in validation set
                val_categories = set(X_val[col].astype(str))
                train_categories = set(le.classes_)
                unseen_categories = val_categories - train_categories
                
                if unseen_categories:
                    # Map unseen categories to most frequent class
                    most_frequent_class = X_train[col].mode().iloc[0]
                    X_val[col] = X_val[col].astype(str).apply(
                        lambda x: most_frequent_class if x in unseen_categories else x
                    )
                
                X_val[col] = le.transform(X_val[col].astype(str))
                label_encoders[col] = le
        
        # Handle missing values
        X_train = X_train.fillna(X_train.mean())
        X_val = X_val.fillna(X_train.mean())  # Use training mean for validation
        
        return X_train, X_val
    
    def _determine_task_type(self) -> bool:
        """Determine if this is a classification or regression task."""
        # Simple heuristic: if target has few unique values relative to data size, it's classification
        unique_targets = len(self.y_train.unique())
        total_samples = len(self.y_train)
        
        # If unique values are less than 10% of total samples or less than 20 unique values, classify as classification
        if unique_targets < min(total_samples * 0.1, 20):
            return True
        
        # Check if target is numeric but with integer-like values
        if self.y_train.dtype in ['int64', 'int32', 'bool']:
            return True
        
        return False
    
    def _sample_random_hyperparameters(self) -> Dict[str, Any]:
        """Sample random hyperparameters from the search space."""
        hyperparams = {}
        
        if self.is_classification:
            # Random choice between model types
            model_type = np.random.choice(["random_forest", "neural_network"])
            hyperparams["model_type"] = model_type
            
            if model_type == "random_forest":
                hyperparams.update({
                    "n_estimators": np.random.randint(10, 200),
                    "max_depth": np.random.randint(3, 20),
                    "min_samples_split": np.random.randint(2, 20),
                    "min_samples_leaf": np.random.randint(1, 10)
                })
            else:  # neural_network
                hidden_sizes = [
                    (50,), (100,), (150,), (50, 25), (100, 50), (150, 75)
                ]
                hyperparams.update({
                    "hidden_layer_sizes": np.random.choice(hidden_sizes),
                    "alpha": np.random.uniform(0.0001, 0.01),
                    "learning_rate_init": np.random.uniform(0.001, 0.1)
                })
        else:
            # Similar logic for regression
            model_type = np.random.choice(["random_forest", "neural_network"])
            hyperparams["model_type"] = model_type
            
            if model_type == "random_forest":
                hyperparams.update({
                    "n_estimators": np.random.randint(10, 200),
                    "max_depth": np.random.randint(3, 20),
                    "min_samples_split": np.random.randint(2, 20)
                })
            else:
                hidden_sizes = [(50,), (100,), (50, 25), (100, 50)]
                hyperparams.update({
                    "hidden_layer_sizes": np.random.choice(hidden_sizes),
                    "alpha": np.random.uniform(0.0001, 0.01),
                    "learning_rate_init": np.random.uniform(0.001, 0.1)
                })
        
        return hyperparams
    
    def _action_to_hyperparameters(self, action: np.ndarray) -> Dict[str, Any]:
        """Convert RL action to hyperparameter configuration."""
        hyperparams = {}
        
        # Convert normalized action values to hyperparameter values
        # Action[0]: model type selection
        model_type = "random_forest" if action[0] < 0.5 else "neural_network"
        hyperparams["model_type"] = model_type
        
        if model_type == "random_forest":
            # Map remaining action dimensions to RF hyperparameters
            hyperparams.update({
                "n_estimators": int(10 + (200 - 10) * action[1]),
                "max_depth": int(3 + (20 - 3) * action[2]),
                "min_samples_split": int(2 + (20 - 2) * action[3]),
                "min_samples_leaf": int(1 + (10 - 1) * action[4]) if len(action) > 4 else 1
            })
        else:  # neural_network
            # Map action dimensions to NN hyperparameters
            hidden_sizes = [(50,), (100,), (150,), (50, 25), (100, 50)]
            size_idx = int(len(hidden_sizes) * action[1])
            size_idx = min(size_idx, len(hidden_sizes) - 1)
            
            hyperparams.update({
                "hidden_layer_sizes": hidden_sizes[size_idx],
                "alpha": 0.0001 + (0.01 - 0.0001) * action[2],
                "learning_rate_init": 0.001 + (0.1 - 0.001) * action[3]
            })
        
        return hyperparams
    
    def _evaluate_hyperparameters(self, hyperparameters: Dict[str, Any]) -> float:
        """Evaluate hyperparameters by training a model and measuring performance."""
        try:
            # Create model with hyperparameters
            if hyperparameters["model_type"] == "random_forest":
                if self.is_classification:
                    model = RandomForestClassifier(
                        n_estimators=hyperparameters.get("n_estimators", 100),
                        max_depth=hyperparameters.get("max_depth", None),
                        min_samples_split=hyperparameters.get("min_samples_split", 2),
                        min_samples_leaf=hyperparameters.get("min_samples_leaf", 1),
                        random_state=42
                    )
                else:
                    model = RandomForestRegressor(
                        n_estimators=hyperparameters.get("n_estimators", 100),
                        max_depth=hyperparameters.get("max_depth", None),
                        min_samples_split=hyperparameters.get("min_samples_split", 2),
                        random_state=42
                    )
            else:  # neural_network
                if self.is_classification:
                    model = MLPClassifier(
                        hidden_layer_sizes=hyperparameters.get("hidden_layer_sizes", (100,)),
                        alpha=hyperparameters.get("alpha", 0.0001),
                        learning_rate_init=hyperparameters.get("learning_rate_init", 0.001),
                        random_state=42,
                        max_iter=1000
                    )
                else:
                    model = MLPRegressor(
                        hidden_layer_sizes=hyperparameters.get("hidden_layer_sizes", (100,)),
                        alpha=hyperparameters.get("alpha", 0.0001),
                        learning_rate_init=hyperparameters.get("learning_rate_init", 0.001),
                        random_state=42,
                        max_iter=1000
                    )
            
            # Train model
            model.fit(self.X_train, self.y_train)
            
            # Make predictions on validation set
            y_pred = model.predict(self.X_val)
            
            # Calculate performance metric
            if self.is_classification:
                if self.objective == "accuracy":
                    performance = accuracy_score(self.y_val, y_pred)
                elif self.objective == "f1_score":
                    performance = f1_score(self.y_val, y_pred, average='weighted')
                elif self.objective == "precision":
                    performance = precision_score(self.y_val, y_pred, average='weighted')
                elif self.objective == "recall":
                    performance = recall_score(self.y_val, y_pred, average='weighted')
                else:  # balanced_performance
                    acc = accuracy_score(self.y_val, y_pred)
                    f1 = f1_score(self.y_val, y_pred, average='weighted')
                    performance = (acc + f1) / 2
            else:  # regression
                from sklearn.metrics import mean_squared_error, r2_score
                if self.objective == "r2_score":
                    performance = r2_score(self.y_val, y_pred)
                else:  # default to negative RMSE (higher is better)
                    rmse = np.sqrt(mean_squared_error(self.y_val, y_pred))
                    performance = -rmse
            
            return float(performance)
            
        except Exception as e:
            logger.error(f"Error in hyperparameter evaluation: {str(e)}")
            return 0.0
    
    def _calculate_reward(self, performance: float) -> float:
        """Calculate reward based on model performance."""
        # Base reward is the performance itself
        reward = performance
        
        # Bonus for improvement over previous best
        if performance > self.best_performance:
            improvement = performance - self.best_performance
            reward += improvement * 2.0  # Bonus for improvement
        
        # Penalty for very poor performance
        if performance < 0.1:
            reward -= 1.0
        
        # Exploration bonus (small random component)
        exploration_bonus = np.random.normal(0, 0.01)
        reward += exploration_bonus
        
        return float(reward)
    
    def _create_observation(self) -> np.ndarray:
        """Create observation vector representing current environment state."""
        obs = np.zeros(15, dtype=np.float32)
        
        # Current performance metrics (5 values)
        if len(self.performance_history) > 0:
            obs[0] = self.performance_history[-1]  # Latest performance
            obs[1] = self.best_performance  # Best performance so far
            obs[2] = np.mean(self.performance_history[-5:]) if len(self.performance_history) >= 5 else obs[0]  # Recent avg
            obs[3] = np.std(self.performance_history) if len(self.performance_history) > 1 else 0.0  # Performance std
            obs[4] = len(self.performance_history)  # Number of evaluations
        
        # Performance history statistics (5 values)
        if len(self.performance_history) > 1:
            obs[5] = np.mean(self.performance_history)  # Overall average
            obs[6] = np.max(self.performance_history)  # Overall maximum
            obs[7] = np.min(self.performance_history)  # Overall minimum
            obs[8] = np.percentile(self.performance_history, 75)  # 75th percentile
            obs[9] = np.percentile(self.performance_history, 25)  # 25th percentile
        
        # Data characteristics (3 values)
        obs[10] = self.X_train.shape[0] / 10000.0  # Normalized training size
        obs[11] = self.X_train.shape[1] / 100.0   # Normalized feature count
        obs[12] = float(self.is_classification)   # Task type indicator
        
        # Training progress (2 values)
        obs[13] = self.current_step / 100.0  # Normalized step
        obs[14] = self.episode_count / 100.0  # Normalized episode
        
        # Ensure no NaN or infinite values
        obs = np.nan_to_num(obs, nan=0.0, posinf=1.0, neginf=-1.0)
        
        return obs