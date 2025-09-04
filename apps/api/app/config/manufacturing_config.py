"""
Production-Ready Manufacturing Configuration Management
=====================================================

Comprehensive configuration management system for manufacturing forecasting
with environment-specific settings, validation, and dynamic updates.
"""

import os
import json
import yaml
import logging
from typing import Dict, Any, Optional, List, Union
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum
import datetime
from pydantic import BaseModel, validator, Field

logger = logging.getLogger(__name__)


class Environment(str, Enum):
    """Environment types."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class ModelType(str, Enum):
    """Available model types."""
    LSTM = "lstm"
    PROPHET = "prophet"
    ARIMA = "arima"
    ENSEMBLE = "ensemble"


@dataclass
class ModelConfig:
    """Configuration for forecasting models."""
    
    # LSTM Configuration
    lstm: Dict[str, Any] = None
    
    # Prophet Configuration
    prophet: Dict[str, Any] = None
    
    # ARIMA Configuration
    arima: Dict[str, Any] = None
    
    # Ensemble Configuration
    ensemble: Dict[str, Any] = None
    
    def __post_init__(self):
        """Initialize default model configurations."""
        if self.lstm is None:
            self.lstm = {
                "lookback_window": 48,  # 48 hours
                "lstm_units": [128, 64, 32],
                "dropout_rate": 0.2,
                "learning_rate": 0.001,
                "batch_size": 32,
                "epochs": 50,
                "early_stopping_patience": 10,
                "validation_split": 0.2
            }
        
        if self.prophet is None:
            self.prophet = {
                "seasonality_mode": "multiplicative",
                "yearly_seasonality": True,
                "weekly_seasonality": True,
                "daily_seasonality": False,
                "changepoint_prior_scale": 0.05,
                "seasonality_prior_scale": 10.0,
                "holidays_prior_scale": 10.0,
                "mcmc_samples": 0,
                "interval_width": 0.8,
                "uncertainty_samples": 1000
            }
        
        if self.arima is None:
            self.arima = {
                "auto_arima": True,
                "order": [2, 1, 2],
                "seasonal_order": [1, 1, 1, 24],
                "max_p": 5,
                "max_q": 5,
                "max_P": 2,
                "max_Q": 2,
                "seasonal": True,
                "stepwise": True,
                "suppress_warnings": True
            }
        
        if self.ensemble is None:
            self.ensemble = {
                "method": "weighted_average",
                "base_models": ["lstm", "prophet", "arima"],
                "weights": "auto",  # or specify [0.4, 0.4, 0.2]
                "meta_model": None,  # optional meta-learner
                "cv_folds": 5
            }


@dataclass
class QualityThresholds:
    """Quality assessment thresholds."""
    
    # Equipment failure thresholds
    equipment_failure: Dict[str, float] = None
    
    # Quality score thresholds
    quality_score: Dict[str, float] = None
    
    # Energy efficiency thresholds
    energy_efficiency: Dict[str, float] = None
    
    # Data quality thresholds
    data_quality: Dict[str, float] = None
    
    def __post_init__(self):
        """Initialize default thresholds."""
        if self.equipment_failure is None:
            self.equipment_failure = {
                "critical_threshold": 0.8,
                "high_threshold": 0.6,
                "medium_threshold": 0.4,
                "low_threshold": 0.2
            }
        
        if self.quality_score is None:
            self.quality_score = {
                "excellent_threshold": 0.95,
                "good_threshold": 0.85,
                "acceptable_threshold": 0.75,
                "poor_threshold": 0.60
            }
        
        if self.energy_efficiency is None:
            self.energy_efficiency = {
                "excellent_threshold": 0.9,
                "good_threshold": 0.7,
                "poor_threshold": 0.5
            }
        
        if self.data_quality is None:
            self.data_quality = {
                "missing_data_threshold": 0.1,  # 10% missing allowed
                "anomaly_threshold": 0.05,  # 5% anomalies allowed
                "drift_threshold": 0.3,  # 30% distribution change
                "noise_threshold": 0.2  # 20% noise level
            }


@dataclass
class CostParameters:
    """Cost parameters for maintenance and optimization."""
    
    # Maintenance costs
    preventive_maintenance_base: float = 3000.0
    reactive_maintenance_multiplier: float = 3.0
    emergency_maintenance_multiplier: float = 5.0
    
    # Energy costs
    energy_rate_per_kwh: float = 0.12
    peak_demand_rate: float = 15.0
    off_peak_multiplier: float = 0.7
    
    # Quality costs
    quality_rework_cost_per_unit: float = 50.0
    scrap_cost_per_unit: float = 100.0
    customer_complaint_cost: float = 500.0
    
    # Equipment costs
    equipment_downtime_cost_per_hour: float = 1000.0
    replacement_cost_multiplier: float = 10.0


@dataclass
class PerformanceConfig:
    """Performance and optimization configuration."""
    
    # Caching
    cache_expiry_minutes: int = 10
    max_cache_size_mb: int = 100
    
    # Forecasting limits
    max_forecast_horizon_days: int = 30
    min_training_samples: int = 100
    max_training_samples: int = 10000
    
    # Processing limits
    max_concurrent_predictions: int = 5
    timeout_seconds: int = 300
    retry_attempts: int = 3
    
    # Batch processing
    batch_size: int = 1000
    max_batch_wait_seconds: int = 60


@dataclass
class DatabaseConfig:
    """Database configuration settings."""
    
    # Connection settings
    host: str = "localhost"
    port: int = 5432
    database: str = "manufacturing"
    username: str = "postgres"
    password: str = ""
    
    # Connection pool
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 3600
    
    # Query settings
    query_timeout: int = 30
    connection_timeout: int = 10


@dataclass
class StreamingConfig:
    """Real-time streaming configuration."""
    
    # Redis settings
    redis_url: str = "redis://localhost:6379"
    redis_db: int = 0
    redis_password: Optional[str] = None
    
    # Stream settings
    stream_retention_hours: int = 24
    max_stream_length: int = 10000
    consumer_group: str = "manufacturing_processors"
    
    # WebSocket settings
    websocket_heartbeat_interval: int = 30
    max_websocket_connections: int = 100
    
    # Processing settings
    processing_batch_size: int = 100
    processing_interval_seconds: int = 5


class ManufacturingConfig(BaseModel):
    """Main manufacturing configuration class with validation."""
    
    # Environment
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = True
    log_level: str = "INFO"
    
    # Core configurations
    models: ModelConfig = Field(default_factory=ModelConfig)
    thresholds: QualityThresholds = Field(default_factory=QualityThresholds)
    cost_parameters: CostParameters = Field(default_factory=CostParameters)
    performance: PerformanceConfig = Field(default_factory=PerformanceConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    streaming: StreamingConfig = Field(default_factory=StreamingConfig)
    
    # Feature flags
    enable_shap_analysis: bool = True
    enable_drift_detection: bool = True
    enable_real_time_streaming: bool = True
    enable_advanced_quality_checks: bool = True
    
    # Security settings
    api_rate_limit_per_minute: int = 100
    max_upload_size_mb: int = 100
    allowed_file_types: List[str] = ["csv", "json", "parquet"]
    
    # Monitoring and alerting
    enable_prometheus_metrics: bool = True
    alert_webhook_url: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    email_alerts: bool = False
    
    class Config:
        """Pydantic config."""
        use_enum_values = True
        validate_assignment = True
    
    @validator('log_level')
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of {valid_levels}")
        return v.upper()
    
    @validator('performance')
    def validate_performance_config(cls, v):
        """Validate performance configuration."""
        if v.max_forecast_horizon_days > 365:
            raise ValueError("Max forecast horizon cannot exceed 365 days")
        
        if v.min_training_samples < 10:
            raise ValueError("Minimum training samples must be at least 10")
        
        return v
    
    @validator('database')
    def validate_database_config(cls, v):
        """Validate database configuration."""
        if v.pool_size < 1:
            raise ValueError("Database pool size must be at least 1")
        
        if v.port < 1 or v.port > 65535:
            raise ValueError("Database port must be between 1 and 65535")
        
        return v


class ConfigManager:
    """Configuration manager for manufacturing systems."""
    
    def __init__(
        self,
        config_dir: Optional[str] = None,
        environment: Optional[str] = None
    ):
        self.config_dir = Path(config_dir or "config/manufacturing")
        self.environment = Environment(environment or os.getenv("ENVIRONMENT", "development"))
        self.config: Optional[ManufacturingConfig] = None
        self.config_file_path: Optional[Path] = None
        
        # Create config directory if it doesn't exist
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Configuration manager initialized for environment: {self.environment}")
    
    def load_config(self) -> ManufacturingConfig:
        """Load configuration based on environment."""
        try:
            # Try to load environment-specific config first
            env_config_file = self.config_dir / f"manufacturing_{self.environment.value}.yaml"
            
            if env_config_file.exists():
                self.config_file_path = env_config_file
                logger.info(f"Loading environment-specific config: {env_config_file}")
            else:
                # Fall back to default config
                default_config_file = self.config_dir / "manufacturing_default.yaml"
                
                if not default_config_file.exists():
                    # Create default config file
                    self._create_default_config_file(default_config_file)
                
                self.config_file_path = default_config_file
                logger.info(f"Loading default config: {default_config_file}")
            
            # Load configuration from file
            with open(self.config_file_path, 'r') as f:
                config_data = yaml.safe_load(f) or {}
            
            # Override with environment variables
            config_data = self._apply_environment_overrides(config_data)
            
            # Create validated configuration
            self.config = ManufacturingConfig(**config_data)
            
            logger.info("Configuration loaded and validated successfully")
            return self.config
            
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            # Return default configuration as fallback
            self.config = ManufacturingConfig()
            return self.config
    
    def _create_default_config_file(self, config_file: Path):
        """Create default configuration file."""
        try:
            default_config = ManufacturingConfig()
            
            # Convert to dict for YAML serialization
            config_dict = {
                "environment": default_config.environment.value,
                "debug": default_config.debug,
                "log_level": default_config.log_level,
                "models": asdict(default_config.models),
                "thresholds": asdict(default_config.thresholds),
                "cost_parameters": asdict(default_config.cost_parameters),
                "performance": asdict(default_config.performance),
                "database": asdict(default_config.database),
                "streaming": asdict(default_config.streaming),
                "enable_shap_analysis": default_config.enable_shap_analysis,
                "enable_drift_detection": default_config.enable_drift_detection,
                "enable_real_time_streaming": default_config.enable_real_time_streaming,
                "enable_advanced_quality_checks": default_config.enable_advanced_quality_checks,
                "api_rate_limit_per_minute": default_config.api_rate_limit_per_minute,
                "max_upload_size_mb": default_config.max_upload_size_mb,
                "allowed_file_types": default_config.allowed_file_types,
                "enable_prometheus_metrics": default_config.enable_prometheus_metrics
            }
            
            with open(config_file, 'w') as f:
                yaml.dump(config_dict, f, default_flow_style=False, indent=2)
            
            logger.info(f"Created default configuration file: {config_file}")
            
        except Exception as e:
            logger.error(f"Error creating default config file: {e}")
            raise
    
    def _apply_environment_overrides(self, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply environment variable overrides to configuration."""
        try:
            # Database overrides
            if os.getenv("DB_HOST"):
                config_data.setdefault("database", {})["host"] = os.getenv("DB_HOST")
            
            if os.getenv("DB_PORT"):
                config_data.setdefault("database", {})["port"] = int(os.getenv("DB_PORT"))
            
            if os.getenv("DB_NAME"):
                config_data.setdefault("database", {})["database"] = os.getenv("DB_NAME")
            
            if os.getenv("DB_USER"):
                config_data.setdefault("database", {})["username"] = os.getenv("DB_USER")
            
            if os.getenv("DB_PASSWORD"):
                config_data.setdefault("database", {})["password"] = os.getenv("DB_PASSWORD")
            
            # Redis overrides
            if os.getenv("REDIS_URL"):
                config_data.setdefault("streaming", {})["redis_url"] = os.getenv("REDIS_URL")
            
            # Performance overrides
            if os.getenv("MAX_FORECAST_HORIZON"):
                config_data.setdefault("performance", {})["max_forecast_horizon_days"] = int(os.getenv("MAX_FORECAST_HORIZON"))
            
            # Feature flag overrides
            if os.getenv("ENABLE_SHAP_ANALYSIS"):
                config_data["enable_shap_analysis"] = os.getenv("ENABLE_SHAP_ANALYSIS").lower() == "true"
            
            if os.getenv("ENABLE_DRIFT_DETECTION"):
                config_data["enable_drift_detection"] = os.getenv("ENABLE_DRIFT_DETECTION").lower() == "true"
            
            # Environment-specific overrides
            if self.environment == Environment.PRODUCTION:
                config_data["debug"] = False
                config_data["log_level"] = "WARNING"
                config_data.setdefault("performance", {})["cache_expiry_minutes"] = 30
            elif self.environment == Environment.STAGING:
                config_data["debug"] = False
                config_data["log_level"] = "INFO"
            elif self.environment == Environment.DEVELOPMENT:
                config_data["debug"] = True
                config_data["log_level"] = "DEBUG"
            
            return config_data
            
        except Exception as e:
            logger.error(f"Error applying environment overrides: {e}")
            return config_data
    
    def get_config(self) -> ManufacturingConfig:
        """Get current configuration, loading if necessary."""
        if self.config is None:
            return self.load_config()
        return self.config
    
    def update_config(
        self,
        updates: Dict[str, Any],
        persist: bool = True
    ) -> ManufacturingConfig:
        """
        Update configuration with new values.
        
        Args:
            updates: Dictionary of configuration updates
            persist: Whether to save changes to file
            
        Returns:
            Updated configuration
        """
        try:
            if self.config is None:
                self.load_config()
            
            # Apply updates
            current_dict = self.config.dict()
            self._deep_update(current_dict, updates)
            
            # Validate updated configuration
            updated_config = ManufacturingConfig(**current_dict)
            
            # Persist to file if requested
            if persist and self.config_file_path:
                self._save_config_to_file(current_dict)
            
            self.config = updated_config
            logger.info("Configuration updated successfully")
            
            return self.config
            
        except Exception as e:
            logger.error(f"Error updating configuration: {e}")
            raise
    
    def _deep_update(self, base_dict: Dict[str, Any], update_dict: Dict[str, Any]):
        """Deep update dictionary with nested values."""
        for key, value in update_dict.items():
            if key in base_dict and isinstance(base_dict[key], dict) and isinstance(value, dict):
                self._deep_update(base_dict[key], value)
            else:
                base_dict[key] = value
    
    def _save_config_to_file(self, config_dict: Dict[str, Any]):
        """Save configuration to file."""
        try:
            # Add metadata
            config_dict["_metadata"] = {
                "updated_at": datetime.datetime.now().isoformat(),
                "version": "1.0",
                "environment": self.environment.value
            }
            
            with open(self.config_file_path, 'w') as f:
                yaml.dump(config_dict, f, default_flow_style=False, indent=2)
            
            logger.info(f"Configuration saved to {self.config_file_path}")
            
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
            raise
    
    def validate_config(self, config_dict: Dict[str, Any]) -> List[str]:
        """
        Validate configuration dictionary.
        
        Args:
            config_dict: Configuration to validate
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        try:
            ManufacturingConfig(**config_dict)
        except Exception as e:
            errors.append(str(e))
        
        return errors
    
    def get_environment_configs(self) -> List[str]:
        """Get list of available environment configurations."""
        configs = []
        
        for config_file in self.config_dir.glob("manufacturing_*.yaml"):
            env_name = config_file.stem.replace("manufacturing_", "")
            configs.append(env_name)
        
        return configs
    
    def export_config(self, format: str = "yaml") -> str:
        """
        Export current configuration to string.
        
        Args:
            format: Export format ("yaml" or "json")
            
        Returns:
            Configuration as string
        """
        if self.config is None:
            self.load_config()
        
        config_dict = self.config.dict()
        
        if format.lower() == "yaml":
            return yaml.dump(config_dict, default_flow_style=False, indent=2)
        elif format.lower() == "json":
            return json.dumps(config_dict, indent=2, default=str)
        else:
            raise ValueError("Format must be 'yaml' or 'json'")
    
    def reload_config(self) -> ManufacturingConfig:
        """Reload configuration from file."""
        self.config = None
        return self.load_config()


# Global configuration manager instance
config_manager = ConfigManager()


def get_config() -> ManufacturingConfig:
    """Get current manufacturing configuration."""
    return config_manager.get_config()


def update_config(updates: Dict[str, Any], persist: bool = True) -> ManufacturingConfig:
    """Update manufacturing configuration."""
    return config_manager.update_config(updates, persist)


def reload_config() -> ManufacturingConfig:
    """Reload configuration from file."""
    return config_manager.reload_config()


# Environment-specific configuration presets
ENVIRONMENT_PRESETS = {
    Environment.DEVELOPMENT: {
        "debug": True,
        "log_level": "DEBUG",
        "performance": {
            "cache_expiry_minutes": 1,  # Short cache for development
            "max_forecast_horizon_days": 7,  # Shorter forecasts for testing
        },
        "database": {
            "pool_size": 5,  # Smaller pool for development
        },
        "enable_shap_analysis": False,  # Disable expensive operations
    },
    
    Environment.STAGING: {
        "debug": False,
        "log_level": "INFO",
        "performance": {
            "cache_expiry_minutes": 10,
            "max_forecast_horizon_days": 14,
        },
        "database": {
            "pool_size": 8,
        },
    },
    
    Environment.PRODUCTION: {
        "debug": False,
        "log_level": "WARNING",
        "performance": {
            "cache_expiry_minutes": 30,  # Longer cache for production
            "max_forecast_horizon_days": 30,
            "max_concurrent_predictions": 10,
        },
        "database": {
            "pool_size": 20,  # Larger pool for production
            "max_overflow": 30,
        },
        "streaming": {
            "max_websocket_connections": 1000,
        },
        "api_rate_limit_per_minute": 1000,  # Higher limits for production
    }
}