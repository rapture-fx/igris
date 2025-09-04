"""
Model Configurations and Templates for Advanced ML Engine

This module provides pre-configured model architectures and hyperparameter templates
for common industrial machine learning applications.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class IndustryDomain(Enum):
    """Industry domain classifications."""
    MANUFACTURING = "manufacturing"
    AUTOMOTIVE = "automotive"
    AEROSPACE = "aerospace"
    ENERGY = "energy"
    CHEMICAL = "chemical"
    PHARMACEUTICAL = "pharmaceutical"
    FOOD_BEVERAGE = "food_beverage"
    GENERAL = "general"


class ApplicationType(Enum):
    """ML application type classifications."""
    PREDICTIVE_MAINTENANCE = "predictive_maintenance"
    QUALITY_CONTROL = "quality_control"
    ANOMALY_DETECTION = "anomaly_detection"
    PROCESS_OPTIMIZATION = "process_optimization"
    SENSOR_FUSION = "sensor_fusion"
    TIME_SERIES_FORECASTING = "time_series_forecasting"
    CLASSIFICATION = "classification"
    REGRESSION = "regression"


@dataclass
class ModelConfiguration:
    """Model configuration template."""
    name: str
    description: str
    model_type: str
    framework: str
    hyperparameters: Dict[str, Any]
    preprocessing: Dict[str, Any]
    optimization: Dict[str, Any]
    performance_targets: Dict[str, float]
    resource_requirements: Dict[str, Any]
    industry_domains: List[IndustryDomain]
    application_types: List[ApplicationType]


# Predictive Maintenance Configurations
PREDICTIVE_MAINTENANCE_XGBOOST = ModelConfiguration(
    name="predictive_maintenance_xgboost",
    description="XGBoost model optimized for equipment failure prediction with imbalanced data",
    model_type="xgboost",
    framework="xgboost",
    hyperparameters={
        "n_estimators": 200,
        "max_depth": 6,
        "learning_rate": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "scale_pos_weight": 10,  # Handle class imbalance
        "gamma": 0.1,
        "min_child_weight": 1,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0
    },
    preprocessing={
        "scaling": "robust",
        "handle_missing": "median_mode",
        "feature_selection": True,
        "time_features": True,
        "lag_features": [1, 2, 3, 6, 12, 24]
    },
    optimization={
        "method": "bayesian",
        "n_trials": 100,
        "scoring": "f1",
        "cv_folds": 5,
        "early_stopping": True
    },
    performance_targets={
        "recall": 0.85,  # Critical: catch failures
        "precision": 0.70,
        "f1_score": 0.75,
        "auc": 0.80
    },
    resource_requirements={
        "memory_mb": 2048,
        "training_time_min": 30,
        "inference_time_ms": 50
    },
    industry_domains=[IndustryDomain.MANUFACTURING, IndustryDomain.ENERGY, IndustryDomain.AUTOMOTIVE],
    application_types=[ApplicationType.PREDICTIVE_MAINTENANCE]
)

PREDICTIVE_MAINTENANCE_LSTM = ModelConfiguration(
    name="predictive_maintenance_lstm",
    description="LSTM neural network for time-series based equipment failure prediction",
    model_type="lstm",
    framework="tensorflow",
    hyperparameters={
        "sequence_length": 48,  # Hours of historical data
        "lstm_units": [128, 64, 32],
        "dropout_rate": 0.3,
        "dense_units": [64, 32],
        "activation": "relu",
        "optimizer": "adam",
        "learning_rate": 0.001,
        "batch_size": 64,
        "epochs": 100
    },
    preprocessing={
        "scaling": "minmax",
        "sequence_creation": True,
        "handle_missing": "interpolation",
        "outlier_detection": True,
        "feature_engineering": ["rolling_mean", "rolling_std", "trend"]
    },
    optimization={
        "method": "random_search",
        "n_trials": 50,
        "scoring": "f1",
        "validation_split": 0.2,
        "early_stopping": {"patience": 10, "monitor": "val_f1"}
    },
    performance_targets={
        "recall": 0.90,
        "precision": 0.75,
        "f1_score": 0.80,
        "auc": 0.85
    },
    resource_requirements={
        "memory_mb": 4096,
        "training_time_min": 60,
        "inference_time_ms": 100,
        "gpu_preferred": True
    },
    industry_domains=[IndustryDomain.MANUFACTURING, IndustryDomain.AEROSPACE, IndustryDomain.ENERGY],
    application_types=[ApplicationType.PREDICTIVE_MAINTENANCE, ApplicationType.TIME_SERIES_FORECASTING]
)

# Quality Control Configurations
QUALITY_CONTROL_CNN = ModelConfiguration(
    name="quality_control_cnn",
    description="1D CNN for pattern recognition in manufacturing sensor data",
    model_type="cnn",
    framework="tensorflow",
    hyperparameters={
        "conv_layers": [
            {"filters": 64, "kernel_size": 3, "activation": "relu"},
            {"filters": 128, "kernel_size": 3, "activation": "relu"},
            {"filters": 256, "kernel_size": 3, "activation": "relu"}
        ],
        "pool_size": 2,
        "dropout_rate": 0.3,
        "dense_units": [128, 64],
        "output_activation": "sigmoid",
        "optimizer": "adam",
        "learning_rate": 0.0005,
        "batch_size": 32,
        "epochs": 150
    },
    preprocessing={
        "scaling": "standard",
        "window_size": 100,  # Sensor reading window
        "overlap": 0.5,
        "filtering": "low_pass",
        "normalization": "per_channel"
    },
    optimization={
        "method": "hyperband",
        "n_trials": 30,
        "scoring": "accuracy",
        "validation_split": 0.2,
        "early_stopping": {"patience": 15, "monitor": "val_accuracy"}
    },
    performance_targets={
        "accuracy": 0.95,
        "precision": 0.92,
        "recall": 0.88,
        "f1_score": 0.90
    },
    resource_requirements={
        "memory_mb": 3072,
        "training_time_min": 45,
        "inference_time_ms": 20,
        "gpu_preferred": True
    },
    industry_domains=[IndustryDomain.MANUFACTURING, IndustryDomain.AUTOMOTIVE, IndustryDomain.PHARMACEUTICAL],
    application_types=[ApplicationType.QUALITY_CONTROL, ApplicationType.ANOMALY_DETECTION]
)

QUALITY_CONTROL_ENSEMBLE = ModelConfiguration(
    name="quality_control_ensemble",
    description="Ensemble of multiple models for robust quality prediction",
    model_type="stacking",
    framework="sklearn",
    hyperparameters={
        "base_models": [
            {"type": "random_forest", "n_estimators": 100, "max_depth": 10},
            {"type": "xgboost", "n_estimators": 100, "max_depth": 6},
            {"type": "lightgbm", "n_estimators": 100, "max_depth": 6}
        ],
        "meta_model": {"type": "logistic_regression", "C": 1.0},
        "cv_folds": 5,
        "use_probabilities": True
    },
    preprocessing={
        "scaling": "robust",
        "feature_selection": {"method": "recursive", "n_features": 50},
        "polynomial_features": {"degree": 2, "interaction_only": True},
        "handle_missing": "iterative"
    },
    optimization={
        "method": "grid_search",
        "n_trials": 50,
        "scoring": "f1_macro",
        "cv_folds": 5,
        "parallel": True
    },
    performance_targets={
        "accuracy": 0.93,
        "precision": 0.90,
        "recall": 0.90,
        "f1_score": 0.90
    },
    resource_requirements={
        "memory_mb": 2048,
        "training_time_min": 40,
        "inference_time_ms": 30
    },
    industry_domains=[IndustryDomain.MANUFACTURING, IndustryDomain.CHEMICAL, IndustryDomain.FOOD_BEVERAGE],
    application_types=[ApplicationType.QUALITY_CONTROL, ApplicationType.CLASSIFICATION]
)

# Sensor Fusion Configurations
SENSOR_FUSION_MULTIMODAL = ModelConfiguration(
    name="sensor_fusion_multimodal",
    description="Multi-modal deep learning for sensor fusion",
    model_type="sensor_fusion",
    framework="tensorflow",
    hyperparameters={
        "sensor_encoders": {
            "temperature": {"type": "dense", "units": [64, 32]},
            "pressure": {"type": "dense", "units": [64, 32]},
            "vibration": {"type": "conv1d", "filters": [32, 64], "kernel_size": 3},
            "acoustic": {"type": "lstm", "units": 64}
        },
        "fusion_method": "concatenate",
        "fusion_layers": [128, 64, 32],
        "dropout_rate": 0.4,
        "batch_normalization": True,
        "optimizer": "adam",
        "learning_rate": 0.0005,
        "batch_size": 64,
        "epochs": 200
    },
    preprocessing={
        "sensor_specific_scaling": True,
        "synchronization": "interpolation",
        "alignment": "timestamp",
        "feature_extraction": {
            "temperature": ["mean", "std", "trend"],
            "pressure": ["mean", "std", "peaks"],
            "vibration": ["fft", "spectral", "envelope"],
            "acoustic": ["mfcc", "spectral_centroid", "zero_crossing_rate"]
        }
    },
    optimization={
        "method": "random_search",
        "n_trials": 40,
        "scoring": "mse",
        "validation_split": 0.2,
        "early_stopping": {"patience": 20, "monitor": "val_loss"}
    },
    performance_targets={
        "r2_score": 0.85,
        "mae": 5.0,
        "rmse": 8.0
    },
    resource_requirements={
        "memory_mb": 6144,
        "training_time_min": 90,
        "inference_time_ms": 150,
        "gpu_required": True
    },
    industry_domains=[IndustryDomain.AEROSPACE, IndustryDomain.AUTOMOTIVE, IndustryDomain.ENERGY],
    application_types=[ApplicationType.SENSOR_FUSION, ApplicationType.ANOMALY_DETECTION]
)

# Anomaly Detection Configurations
ANOMALY_DETECTION_AUTOENCODER = ModelConfiguration(
    name="anomaly_detection_autoencoder",
    description="Variational autoencoder for unsupervised anomaly detection",
    model_type="autoencoder",
    framework="tensorflow",
    hyperparameters={
        "encoder_layers": [256, 128, 64],
        "latent_dim": 32,
        "decoder_layers": [64, 128, 256],
        "activation": "relu",
        "output_activation": "linear",
        "kl_weight": 0.001,
        "reconstruction_weight": 1.0,
        "optimizer": "adam",
        "learning_rate": 0.001,
        "batch_size": 128,
        "epochs": 300
    },
    preprocessing={
        "scaling": "minmax",
        "noise_reduction": True,
        "outlier_removal": {"method": "isolation_forest", "contamination": 0.1},
        "dimensionality_reduction": {"method": "pca", "n_components": 100}
    },
    optimization={
        "method": "bayesian",
        "n_trials": 30,
        "scoring": "reconstruction_error",
        "validation_split": 0.2,
        "early_stopping": {"patience": 25, "monitor": "val_loss"}
    },
    performance_targets={
        "reconstruction_error": 0.05,
        "anomaly_detection_f1": 0.80,
        "false_positive_rate": 0.05
    },
    resource_requirements={
        "memory_mb": 4096,
        "training_time_min": 120,
        "inference_time_ms": 50,
        "gpu_preferred": True
    },
    industry_domains=[IndustryDomain.MANUFACTURING, IndustryDomain.ENERGY, IndustryDomain.CHEMICAL],
    application_types=[ApplicationType.ANOMALY_DETECTION, ApplicationType.PREDICTIVE_MAINTENANCE]
)

# Process Optimization Configurations
PROCESS_OPTIMIZATION_REINFORCEMENT = ModelConfiguration(
    name="process_optimization_rl",
    description="Deep Q-Network for manufacturing process optimization",
    model_type="dqn",
    framework="tensorflow",
    hyperparameters={
        "network_architecture": [512, 256, 128],
        "learning_rate": 0.0001,
        "discount_factor": 0.95,
        "epsilon_start": 1.0,
        "epsilon_end": 0.01,
        "epsilon_decay": 0.995,
        "replay_buffer_size": 100000,
        "batch_size": 64,
        "target_update_frequency": 1000,
        "training_episodes": 5000
    },
    preprocessing={
        "state_normalization": True,
        "reward_shaping": True,
        "action_space_discretization": {"type": "uniform", "bins": 10}
    },
    optimization={
        "method": "hyperband",
        "n_trials": 20,
        "scoring": "cumulative_reward",
        "evaluation_episodes": 100
    },
    performance_targets={
        "average_reward": 100,
        "success_rate": 0.85,
        "convergence_episodes": 3000
    },
    resource_requirements={
        "memory_mb": 8192,
        "training_time_min": 300,
        "inference_time_ms": 10,
        "gpu_required": True,
        "simulation_environment": True
    },
    industry_domains=[IndustryDomain.MANUFACTURING, IndustryDomain.CHEMICAL, IndustryDomain.ENERGY],
    application_types=[ApplicationType.PROCESS_OPTIMIZATION]
)

# Configuration Registry
MODEL_CONFIGURATIONS = {
    "predictive_maintenance": {
        "xgboost": PREDICTIVE_MAINTENANCE_XGBOOST,
        "lstm": PREDICTIVE_MAINTENANCE_LSTM
    },
    "quality_control": {
        "cnn": QUALITY_CONTROL_CNN,
        "ensemble": QUALITY_CONTROL_ENSEMBLE
    },
    "sensor_fusion": {
        "multimodal": SENSOR_FUSION_MULTIMODAL
    },
    "anomaly_detection": {
        "autoencoder": ANOMALY_DETECTION_AUTOENCODER
    },
    "process_optimization": {
        "reinforcement_learning": PROCESS_OPTIMIZATION_REINFORCEMENT
    }
}


class ModelConfigurationManager:
    """Manager for model configurations and templates."""
    
    def __init__(self):
        self.configurations = MODEL_CONFIGURATIONS
    
    def get_configuration(self, application_type: str, model_variant: str = None) -> Optional[ModelConfiguration]:
        """Get model configuration by application type and variant."""
        if application_type not in self.configurations:
            return None
        
        app_configs = self.configurations[application_type]
        
        if model_variant is None:
            # Return the first available configuration
            return next(iter(app_configs.values()))
        
        return app_configs.get(model_variant)
    
    def get_configurations_by_domain(self, domain: IndustryDomain) -> List[ModelConfiguration]:
        """Get all configurations suitable for a specific industry domain."""
        matching_configs = []
        
        for app_type, variants in self.configurations.items():
            for variant_name, config in variants.items():
                if domain in config.industry_domains:
                    matching_configs.append(config)
        
        return matching_configs
    
    def get_configurations_by_framework(self, framework: str) -> List[ModelConfiguration]:
        """Get all configurations for a specific framework."""
        matching_configs = []
        
        for app_type, variants in self.configurations.items():
            for variant_name, config in variants.items():
                if config.framework.lower() == framework.lower():
                    matching_configs.append(config)
        
        return matching_configs
    
    def search_configurations(self, 
                             domain: Optional[IndustryDomain] = None,
                             application: Optional[ApplicationType] = None,
                             framework: Optional[str] = None,
                             max_training_time: Optional[int] = None,
                             max_memory_mb: Optional[int] = None) -> List[ModelConfiguration]:
        """Search configurations based on multiple criteria."""
        matching_configs = []
        
        for app_type, variants in self.configurations.items():
            for variant_name, config in variants.items():
                # Check domain filter
                if domain and domain not in config.industry_domains:
                    continue
                
                # Check application filter
                if application and application not in config.application_types:
                    continue
                
                # Check framework filter
                if framework and config.framework.lower() != framework.lower():
                    continue
                
                # Check resource constraints
                if max_training_time and config.resource_requirements.get('training_time_min', 0) > max_training_time:
                    continue
                
                if max_memory_mb and config.resource_requirements.get('memory_mb', 0) > max_memory_mb:
                    continue
                
                matching_configs.append(config)
        
        return matching_configs
    
    def recommend_configuration(self,
                               domain: IndustryDomain,
                               application: ApplicationType,
                               data_size: int,
                               has_gpu: bool = False,
                               training_time_budget_min: int = 60) -> Optional[ModelConfiguration]:
        """Recommend the best configuration based on requirements."""
        
        # Get matching configurations
        matching_configs = self.search_configurations(
            domain=domain,
            application=application,
            max_training_time=training_time_budget_min
        )
        
        if not matching_configs:
            return None
        
        # Filter by GPU requirements
        if not has_gpu:
            matching_configs = [c for c in matching_configs 
                              if not c.resource_requirements.get('gpu_required', False)]
        
        # Rank configurations by suitability
        scored_configs = []
        for config in matching_configs:
            score = 0
            
            # Prefer configurations that match data size
            if data_size < 1000:
                if config.framework in ['sklearn', 'xgboost']:
                    score += 10
            elif data_size < 10000:
                if config.framework in ['sklearn', 'xgboost', 'lightgbm']:
                    score += 10
            else:
                if config.framework in ['tensorflow', 'pytorch']:
                    score += 10
            
            # Prefer GPU-optimized models if GPU available
            if has_gpu and config.resource_requirements.get('gpu_preferred', False):
                score += 5
            
            # Prefer shorter training times within budget
            training_time = config.resource_requirements.get('training_time_min', 30)
            if training_time <= training_time_budget_min * 0.5:
                score += 3
            
            scored_configs.append((score, config))
        
        # Return highest scoring configuration
        if scored_configs:
            scored_configs.sort(key=lambda x: x[0], reverse=True)
            return scored_configs[0][1]
        
        return None
    
    def list_all_configurations(self) -> Dict[str, List[str]]:
        """List all available configurations."""
        config_list = {}
        
        for app_type, variants in self.configurations.items():
            config_list[app_type] = list(variants.keys())
        
        return config_list
    
    def export_configuration(self, config: ModelConfiguration, format: str = "json") -> str:
        """Export configuration in specified format."""
        config_dict = asdict(config)
        
        # Convert enums to strings
        config_dict['industry_domains'] = [d.value for d in config.industry_domains]
        config_dict['application_types'] = [a.value for a in config.application_types]
        
        if format.lower() == "json":
            import json
            return json.dumps(config_dict, indent=2)
        elif format.lower() == "yaml":
            import yaml
            return yaml.dump(config_dict, default_flow_style=False)
        else:
            raise ValueError(f"Unsupported format: {format}")


# Global configuration manager instance
config_manager = ModelConfigurationManager()


def get_config_manager() -> ModelConfigurationManager:
    """Get the global configuration manager instance."""
    return config_manager


def recommend_model_for_use_case(domain: str, 
                                application: str,
                                data_size: int = 1000,
                                has_gpu: bool = False,
                                time_budget_min: int = 60) -> Optional[Dict[str, Any]]:
    """
    High-level function to recommend model configuration for a use case.
    
    Args:
        domain: Industry domain (e.g., 'manufacturing', 'automotive')
        application: Application type (e.g., 'predictive_maintenance', 'quality_control')
        data_size: Approximate number of training samples
        has_gpu: Whether GPU is available
        time_budget_min: Training time budget in minutes
        
    Returns:
        Recommended configuration as dictionary
    """
    try:
        domain_enum = IndustryDomain(domain.lower())
        app_enum = ApplicationType(application.lower())
    except ValueError as e:
        return {"error": f"Invalid domain or application type: {e}"}
    
    config = config_manager.recommend_configuration(
        domain=domain_enum,
        application=app_enum,
        data_size=data_size,
        has_gpu=has_gpu,
        training_time_budget_min=time_budget_min
    )
    
    if config:
        return {
            "recommended_config": config.name,
            "description": config.description,
            "framework": config.framework,
            "estimated_training_time_min": config.resource_requirements.get('training_time_min'),
            "estimated_memory_mb": config.resource_requirements.get('memory_mb'),
            "performance_targets": config.performance_targets,
            "hyperparameters": config.hyperparameters
        }
    else:
        return {"error": "No suitable configuration found for the specified requirements"}


# Example usage and testing functions
def example_configuration_usage():
    """Demonstrate configuration manager usage."""
    print("=== Model Configuration Manager Examples ===\n")
    
    # Example 1: Get specific configuration
    print("1. Getting predictive maintenance XGBoost configuration:")
    config = config_manager.get_configuration("predictive_maintenance", "xgboost")
    print(f"   Name: {config.name}")
    print(f"   Framework: {config.framework}")
    print(f"   Target Recall: {config.performance_targets['recall']}")
    
    # Example 2: Search by domain
    print("\n2. Configurations for Manufacturing domain:")
    manufacturing_configs = config_manager.get_configurations_by_domain(IndustryDomain.MANUFACTURING)
    for config in manufacturing_configs:
        print(f"   - {config.name} ({config.framework})")
    
    # Example 3: Get recommendation
    print("\n3. Recommendation for automotive quality control:")
    recommendation = recommend_model_for_use_case(
        domain="automotive",
        application="quality_control", 
        data_size=5000,
        has_gpu=True,
        time_budget_min=45
    )
    print(f"   Recommended: {recommendation.get('recommended_config', 'None')}")
    print(f"   Framework: {recommendation.get('framework', 'N/A')}")
    
    # Example 4: List all configurations
    print("\n4. All available configurations:")
    all_configs = config_manager.list_all_configurations()
    for app_type, variants in all_configs.items():
        print(f"   {app_type}: {', '.join(variants)}")


if __name__ == "__main__":
    example_configuration_usage()