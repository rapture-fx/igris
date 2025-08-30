"""
RL Optimization Configuration
Centralized configuration management for RL system
"""

import os
from typing import Optional, Dict, Any
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from enum import Enum


class RLStrategy(str, Enum):
    """Available RL strategies"""
    PPO = "ppo"
    A2C = "a2c"
    SAC = "sac"
    DDPG = "ddpg"


class RLObjective(str, Enum):
    """Available optimization objectives"""
    ACCURACY = "accuracy"
    F1_SCORE = "f1_score"
    PRECISION = "precision"
    RECALL = "recall"
    AUC_ROC = "auc_roc"
    TRAINING_TIME = "training_time"
    BALANCED_PERFORMANCE = "balanced_performance"


class RLSettings(BaseSettings):
    """RL optimization settings"""
    
    # Core RL Configuration
    rl_enabled: bool = Field(default=True, env="RL_ENABLED")
    rl_max_concurrent_sessions: int = Field(default=5, env="RL_MAX_CONCURRENT_SESSIONS")
    rl_default_max_episodes: int = Field(default=50, env="RL_DEFAULT_MAX_EPISODES")
    rl_default_strategy: RLStrategy = Field(default=RLStrategy.PPO, env="RL_DEFAULT_STRATEGY")
    
    # Directory Configuration
    rl_checkpoint_directory: str = Field(default="./checkpoints/rl_optimization/", env="RL_CHECKPOINT_DIRECTORY")
    rl_logs_directory: str = Field(default="./logs/rl_optimization/", env="RL_LOGS_DIRECTORY")
    rl_tensorboard_enabled: bool = Field(default=True, env="RL_TENSORBOARD_ENABLED")
    rl_prometheus_metrics_enabled: bool = Field(default=True, env="RL_PROMETHEUS_METRICS_ENABLED")
    
    # Resource Limits
    rl_max_cpu_cores_per_session: int = Field(default=4, env="RL_MAX_CPU_CORES_PER_SESSION")
    rl_max_memory_gb_per_session: int = Field(default=16, env="RL_MAX_MEMORY_GB_PER_SESSION")
    rl_max_training_time_seconds: int = Field(default=3600, env="RL_MAX_TRAINING_TIME_SECONDS")
    rl_early_stopping_patience: int = Field(default=10, env="RL_EARLY_STOPPING_PATIENCE")
    
    # Model Configuration
    rl_learning_rate: float = Field(default=3e-4, env="RL_LEARNING_RATE")
    rl_batch_size: int = Field(default=64, env="RL_BATCH_SIZE")
    rl_n_steps: int = Field(default=2048, env="RL_N_STEPS")
    rl_gamma: float = Field(default=0.99, env="RL_GAMMA")
    rl_gae_lambda: float = Field(default=0.95, env="RL_GAE_LAMBDA")
    
    # Storage Configuration
    rl_s3_bucket: Optional[str] = Field(default=None, env="RL_S3_BUCKET")
    rl_s3_access_key: Optional[str] = Field(default=None, env="RL_S3_ACCESS_KEY")
    rl_s3_secret_key: Optional[str] = Field(default=None, env="RL_S3_SECRET_KEY")
    rl_s3_region: str = Field(default="us-east-1", env="RL_S3_REGION")
    
    # Monitoring Configuration
    rl_alert_webhook_url: Optional[str] = Field(default=None, env="RL_ALERT_WEBHOOK_URL")
    rl_monitoring_interval_seconds: int = Field(default=30, env="RL_MONITORING_INTERVAL_SECONDS")
    rl_performance_threshold_min: float = Field(default=0.01, env="RL_PERFORMANCE_THRESHOLD_MIN")
    rl_resource_alert_threshold_cpu: int = Field(default=80, env="RL_RESOURCE_ALERT_THRESHOLD_CPU")
    rl_resource_alert_threshold_memory: int = Field(default=85, env="RL_RESOURCE_ALERT_THRESHOLD_MEMORY")
    
    # Industry-specific defaults
    ecommerce_default_objective: RLObjective = Field(default=RLObjective.BALANCED_PERFORMANCE)
    manufacturing_default_objective: RLObjective = Field(default=RLObjective.ACCURACY)
    finance_default_objective: RLObjective = Field(default=RLObjective.AUC_ROC)
    
    @field_validator('rl_checkpoint_directory', 'rl_logs_directory')
    @classmethod
    def ensure_directory_exists(cls, v):
        """Ensure directories exist"""
        if v and not os.path.exists(v):
            os.makedirs(v, exist_ok=True)
        return v
    
    @field_validator('rl_learning_rate')
    @classmethod
    def validate_learning_rate(cls, v):
        """Validate learning rate is in reasonable range"""
        if not 1e-6 <= v <= 1e-1:
            raise ValueError("Learning rate must be between 1e-6 and 1e-1")
        return v
    
    @field_validator('rl_max_concurrent_sessions')
    @classmethod
    def validate_concurrent_sessions(cls, v):
        """Validate concurrent sessions limit"""
        if v < 1 or v > 100:
            raise ValueError("Max concurrent sessions must be between 1 and 100")
        return v
    
    def get_optimization_config(
        self, 
        strategy: Optional[RLStrategy] = None,
        objective: Optional[RLObjective] = None,
        industry_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get optimization configuration for specific use case"""
        
        # Set default objective based on industry
        if objective is None and industry_type:
            if industry_type.lower() == "ecommerce":
                objective = self.ecommerce_default_objective
            elif industry_type.lower() == "manufacturing":
                objective = self.manufacturing_default_objective
            elif industry_type.lower() == "finance":
                objective = self.finance_default_objective
            else:
                objective = RLObjective.BALANCED_PERFORMANCE
        
        return {
            "strategy": strategy or self.rl_default_strategy,
            "objective": objective or RLObjective.BALANCED_PERFORMANCE,
            "max_episodes": self.rl_default_max_episodes,
            "max_training_time": self.rl_max_training_time_seconds,
            "early_stopping_patience": self.rl_early_stopping_patience,
            "learning_rate": self.rl_learning_rate,
            "batch_size": self.rl_batch_size,
            "n_steps": self.rl_n_steps,
            "gamma": self.rl_gamma,
            "gae_lambda": self.rl_gae_lambda,
            "enable_tensorboard": self.rl_tensorboard_enabled,
            "save_checkpoints": True,
            "checkpoint_directory": self.rl_checkpoint_directory,
            "logs_directory": self.rl_logs_directory
        }
    
    def get_resource_limits(self) -> Dict[str, Any]:
        """Get resource allocation limits"""
        return {
            "max_cpu_cores": self.rl_max_cpu_cores_per_session,
            "max_memory_gb": self.rl_max_memory_gb_per_session,
            "max_training_time": self.rl_max_training_time_seconds
        }
    
    def get_monitoring_config(self) -> Dict[str, Any]:
        """Get monitoring configuration"""
        return {
            "enabled": self.rl_prometheus_metrics_enabled,
            "interval_seconds": self.rl_monitoring_interval_seconds,
            "alert_webhook_url": self.rl_alert_webhook_url,
            "performance_threshold": self.rl_performance_threshold_min,
            "cpu_alert_threshold": self.rl_resource_alert_threshold_cpu,
            "memory_alert_threshold": self.rl_resource_alert_threshold_memory
        }
    
    def is_s3_configured(self) -> bool:
        """Check if S3 storage is properly configured"""
        return all([
            self.rl_s3_bucket,
            self.rl_s3_access_key,
            self.rl_s3_secret_key
        ])
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"  # Ignore extra environment variables
    }


# Global RL settings instance
rl_settings = RLSettings()


def get_rl_settings() -> RLSettings:
    """Get RL settings instance"""
    return rl_settings


# Industry-specific configuration presets
INDUSTRY_PRESETS = {
    "ecommerce": {
        "objective": RLObjective.BALANCED_PERFORMANCE,
        "max_episodes": 30,
        "early_stopping_patience": 8,
        "learning_rate": 5e-4,
        "focus_metrics": ["conversion_rate", "click_through_rate", "revenue_per_visitor"]
    },
    "manufacturing": {
        "objective": RLObjective.ACCURACY,
        "max_episodes": 75,
        "early_stopping_patience": 15,
        "learning_rate": 1e-4,
        "focus_metrics": ["equipment_efficiency", "defect_rate", "downtime_reduction"]
    },
    "finance": {
        "objective": RLObjective.AUC_ROC,
        "max_episodes": 100,
        "early_stopping_patience": 20,
        "learning_rate": 1e-4,
        "focus_metrics": ["fraud_detection_rate", "false_positive_rate", "risk_score_accuracy"]
    }
}


def get_industry_preset(industry: str) -> Dict[str, Any]:
    """Get industry-specific configuration preset"""
    return INDUSTRY_PRESETS.get(industry.lower(), INDUSTRY_PRESETS["ecommerce"])