"""
Manufacturing Time-Series Forecasting Configuration
==================================================

Configuration templates and settings for the manufacturing forecasting system.
Provides default configurations for different manufacturing scenarios and
deployment environments.
"""

from typing import Dict, Any
from datetime import timedelta

# Default Model Configurations

LSTM_CONFIG_TEMPLATES = {
    'equipment_failure_prediction': {
        'lookback_window': 48,  # 48 hours for equipment failure
        'lstm_units': [128, 64, 32],
        'dropout_rate': 0.2,
        'learning_rate': 0.001,
        'batch_size': 32,
        'epochs': 100,
        'early_stopping_patience': 15,
        'validation_split': 0.2
    },
    'production_demand': {
        'lookback_window': 168,  # 1 week for production demand
        'lstm_units': [256, 128, 64],
        'dropout_rate': 0.3,
        'learning_rate': 0.0005,
        'batch_size': 64,
        'epochs': 150,
        'early_stopping_patience': 20,
        'validation_split': 0.2
    },
    'quality_trends': {
        'lookback_window': 24,  # 24 hours for quality
        'lstm_units': [64, 32],
        'dropout_rate': 0.15,
        'learning_rate': 0.002,
        'batch_size': 16,
        'epochs': 80,
        'early_stopping_patience': 10,
        'validation_split': 0.15
    },
    'energy_consumption': {
        'lookback_window': 72,  # 3 days for energy patterns
        'lstm_units': [128, 64],
        'dropout_rate': 0.25,
        'learning_rate': 0.001,
        'batch_size': 32,
        'epochs': 120,
        'early_stopping_patience': 15,
        'validation_split': 0.2
    }
}

PROPHET_CONFIG_TEMPLATES = {
    'production_demand': {
        'seasonality_mode': 'multiplicative',
        'yearly_seasonality': True,
        'weekly_seasonality': True,
        'daily_seasonality': False,
        'growth': 'linear',
        'changepoint_prior_scale': 0.05,
        'seasonality_prior_scale': 10.0,
        'holidays_prior_scale': 10.0,
        'mcmc_samples': 0,
        'interval_width': 0.8,
        'uncertainty_samples': 1000
    },
    'energy_consumption': {
        'seasonality_mode': 'additive',
        'yearly_seasonality': True,
        'weekly_seasonality': True,
        'daily_seasonality': True,
        'growth': 'linear',
        'changepoint_prior_scale': 0.1,
        'seasonality_prior_scale': 15.0,
        'holidays_prior_scale': 15.0,
        'mcmc_samples': 0,
        'interval_width': 0.85,
        'uncertainty_samples': 1000
    },
    'maintenance_cycles': {
        'seasonality_mode': 'multiplicative',
        'yearly_seasonality': False,
        'weekly_seasonality': True,
        'daily_seasonality': False,
        'growth': 'linear',
        'changepoint_prior_scale': 0.03,
        'seasonality_prior_scale': 5.0,
        'holidays_prior_scale': 5.0,
        'mcmc_samples': 0,
        'interval_width': 0.9,
        'uncertainty_samples': 1000
    }
}

ARIMA_CONFIG_TEMPLATES = {
    'equipment_failure': {
        'auto_arima': True,
        'order': (2, 1, 2),
        'seasonal_order': (1, 1, 1, 24),
        'max_p': 3,
        'max_q': 3,
        'max_P': 2,
        'max_Q': 2,
        'max_d': 2,
        'max_D': 1,
        'seasonal_period': 24,
        'stepwise': True,
        'suppress_warnings': True
    },
    'quality_metrics': {
        'auto_arima': True,
        'order': (1, 1, 1),
        'seasonal_order': (1, 1, 1, 8),  # 8-hour shift patterns
        'max_p': 2,
        'max_q': 2,
        'max_P': 1,
        'max_Q': 1,
        'max_d': 1,
        'max_D': 1,
        'seasonal_period': 8,
        'stepwise': True,
        'suppress_warnings': True
    }
}

ENSEMBLE_CONFIG_TEMPLATES = {
    'critical_equipment': {
        'ensemble_method': 'weighted_average',
        'base_models': ['lstm', 'prophet', 'arima'],
        'weight_calculation': 'validation_performance',
        'min_models': 2,
        'max_models': 4,
        'performance_threshold': 0.8,
        'retraining_frequency_days': 30
    },
    'production_planning': {
        'ensemble_method': 'stacked_generalization',
        'base_models': ['prophet', 'lstm'],
        'weight_calculation': 'equal',
        'min_models': 2,
        'max_models': 3,
        'performance_threshold': 0.75,
        'retraining_frequency_days': 14
    }
}

# Manufacturing Application Thresholds

MANUFACTURING_THRESHOLDS = {
    'equipment_failure': {
        'critical_probability': 0.8,
        'high_risk_probability': 0.6,
        'medium_risk_probability': 0.4,
        'low_risk_probability': 0.2,
        'maintenance_window_days': 7,
        'emergency_threshold': 0.9
    },
    'quality_control': {
        'excellent_score': 0.95,
        'acceptable_score': 0.85,
        'poor_score': 0.70,
        'critical_score': 0.60,
        'defect_rate_threshold': 0.05,
        'process_capability_min': 1.33
    },
    'energy_efficiency': {
        'excellent_efficiency': 0.90,
        'good_efficiency': 0.75,
        'average_efficiency': 0.60,
        'poor_efficiency': 0.45,
        'peak_demand_threshold': 0.85,
        'load_factor_target': 0.75
    },
    'production_capacity': {
        'optimal_utilization': 0.85,
        'high_utilization': 0.90,
        'critical_utilization': 0.95,
        'bottleneck_threshold': 0.92,
        'efficiency_target': 0.80
    }
}

# Cost Parameters for Different Industries

COST_PARAMETERS = {
    'automotive_manufacturing': {
        'preventive_maintenance_base': 5000,
        'reactive_maintenance_multiplier': 4.0,
        'downtime_cost_per_hour': 10000,
        'energy_rate_per_kwh': 0.08,
        'peak_demand_rate': 12.0,
        'quality_rework_cost_per_unit': 150,
        'inventory_holding_cost_rate': 0.25,
        'labor_cost_per_hour': 65
    },
    'electronics_manufacturing': {
        'preventive_maintenance_base': 3000,
        'reactive_maintenance_multiplier': 3.5,
        'downtime_cost_per_hour': 15000,
        'energy_rate_per_kwh': 0.10,
        'peak_demand_rate': 18.0,
        'quality_rework_cost_per_unit': 75,
        'inventory_holding_cost_rate': 0.30,
        'labor_cost_per_hour': 55
    },
    'pharmaceutical_manufacturing': {
        'preventive_maintenance_base': 8000,
        'reactive_maintenance_multiplier': 5.0,
        'downtime_cost_per_hour': 25000,
        'energy_rate_per_kwh': 0.12,
        'peak_demand_rate': 20.0,
        'quality_rework_cost_per_unit': 500,
        'inventory_holding_cost_rate': 0.20,
        'labor_cost_per_hour': 85
    },
    'food_processing': {
        'preventive_maintenance_base': 2500,
        'reactive_maintenance_multiplier': 3.0,
        'downtime_cost_per_hour': 5000,
        'energy_rate_per_kwh': 0.09,
        'peak_demand_rate': 15.0,
        'quality_rework_cost_per_unit': 25,
        'inventory_holding_cost_rate': 0.15,
        'labor_cost_per_hour': 35
    },
    'chemical_processing': {
        'preventive_maintenance_base': 12000,
        'reactive_maintenance_multiplier': 4.5,
        'downtime_cost_per_hour': 20000,
        'energy_rate_per_kwh': 0.07,
        'peak_demand_rate': 22.0,
        'quality_rework_cost_per_unit': 200,
        'inventory_holding_cost_rate': 0.18,
        'labor_cost_per_hour': 75
    }
}

# Seasonal Patterns for Different Manufacturing Types

SEASONAL_PATTERNS = {
    'consumer_goods': {
        'quarterly_factors': [1.2, 0.8, 0.9, 1.3],  # Q1, Q2, Q3, Q4
        'monthly_factors': {
            1: 1.1, 2: 1.0, 3: 1.3, 4: 0.9, 5: 0.8, 6: 0.7,
            7: 0.8, 8: 0.9, 9: 1.0, 10: 1.2, 11: 1.4, 12: 1.3
        },
        'weekly_factors': [1.0, 1.1, 1.1, 1.1, 1.1, 0.8, 0.6],  # Mon-Sun
        'daily_factors': {  # Hourly factors for 24-hour day
            'shift_1': [0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.0],  # 00-07
            'shift_2': [1.2, 1.3, 1.2, 1.1, 1.0, 1.1, 1.2, 1.1],  # 08-15
            'shift_3': [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]   # 16-23
        }
    },
    'industrial_equipment': {
        'quarterly_factors': [1.0, 1.1, 0.9, 1.0],
        'monthly_factors': {
            1: 1.0, 2: 1.0, 3: 1.1, 4: 1.1, 5: 1.2, 6: 1.1,
            7: 0.9, 8: 0.8, 9: 1.0, 10: 1.1, 11: 1.0, 12: 0.9
        },
        'weekly_factors': [1.1, 1.2, 1.2, 1.2, 1.1, 0.7, 0.5],
        'daily_factors': {
            'shift_1': [0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.7, 1.0],
            'shift_2': [1.3, 1.4, 1.3, 1.2, 1.1, 1.2, 1.3, 1.2],
            'shift_3': [1.1, 1.0, 0.9, 0.8, 0.7, 0.5, 0.3, 0.2]
        }
    },
    'continuous_process': {
        'quarterly_factors': [1.0, 1.0, 1.0, 1.0],  # More stable
        'monthly_factors': {
            1: 1.0, 2: 0.98, 3: 1.02, 4: 1.01, 5: 1.03, 6: 1.02,
            7: 0.99, 8: 0.97, 9: 1.01, 10: 1.02, 11: 1.01, 12: 0.98
        },
        'weekly_factors': [1.02, 1.03, 1.02, 1.01, 1.00, 0.98, 0.94],
        'daily_factors': {
            'continuous': [1.0] * 24  # Constant production
        }
    }
}

# Data Quality Requirements

DATA_QUALITY_REQUIREMENTS = {
    'equipment_failure_prediction': {
        'min_data_points': 100,
        'max_missing_percentage': 0.05,
        'required_sensors': ['temperature', 'vibration'],
        'optional_sensors': ['pressure', 'current', 'voltage'],
        'sampling_frequency_minutes': 15,
        'data_freshness_hours': 2
    },
    'production_demand_forecasting': {
        'min_data_points': 50,
        'max_missing_percentage': 0.10,
        'required_metrics': ['production_output'],
        'optional_metrics': ['demand', 'inventory_level', 'order_backlog'],
        'sampling_frequency_hours': 1,
        'data_freshness_hours': 24
    },
    'quality_trend_prediction': {
        'min_data_points': 30,
        'max_missing_percentage': 0.02,
        'required_metrics': ['quality_score'],
        'optional_metrics': ['defect_rate', 'rework_rate', 'process_parameters'],
        'sampling_frequency_minutes': 30,
        'data_freshness_hours': 4
    },
    'energy_consumption_forecasting': {
        'min_data_points': 48,
        'max_missing_percentage': 0.05,
        'required_metrics': ['energy_consumption'],
        'optional_metrics': ['power_factor', 'demand', 'temperature'],
        'sampling_frequency_minutes': 15,
        'data_freshness_hours': 1
    }
}

# Performance Benchmarks

PERFORMANCE_BENCHMARKS = {
    'accuracy_targets': {
        'equipment_failure_prediction': {
            'excellent': 0.95,
            'good': 0.90,
            'acceptable': 0.85,
            'poor': 0.80
        },
        'production_demand_forecasting': {
            'excellent': 0.92,
            'good': 0.88,
            'acceptable': 0.82,
            'poor': 0.75
        },
        'quality_trend_prediction': {
            'excellent': 0.94,
            'good': 0.89,
            'acceptable': 0.84,
            'poor': 0.78
        },
        'energy_consumption_forecasting': {
            'excellent': 0.93,
            'good': 0.87,
            'acceptable': 0.81,
            'poor': 0.75
        }
    },
    'latency_targets': {
        'real_time_prediction_ms': 500,
        'batch_prediction_minutes': 15,
        'model_training_hours': 4,
        'api_response_ms': 200
    },
    'throughput_targets': {
        'predictions_per_second': 100,
        'concurrent_users': 50,
        'data_ingestion_points_per_second': 1000,
        'model_updates_per_day': 4
    }
}

# Alert and Notification Configuration

ALERT_CONFIGURATIONS = {
    'equipment_failure': {
        'critical': {
            'threshold': 0.9,
            'notification_channels': ['email', 'sms', 'dashboard'],
            'escalation_minutes': 15,
            'auto_actions': ['create_work_order', 'notify_supervisor']
        },
        'high': {
            'threshold': 0.7,
            'notification_channels': ['email', 'dashboard'],
            'escalation_minutes': 60,
            'auto_actions': ['create_work_order']
        },
        'medium': {
            'threshold': 0.5,
            'notification_channels': ['dashboard'],
            'escalation_minutes': 240,
            'auto_actions': ['log_alert']
        }
    },
    'quality_deviation': {
        'critical': {
            'threshold': 0.6,
            'notification_channels': ['email', 'sms', 'dashboard'],
            'escalation_minutes': 5,
            'auto_actions': ['stop_production', 'notify_quality_manager']
        },
        'high': {
            'threshold': 0.75,
            'notification_channels': ['email', 'dashboard'],
            'escalation_minutes': 30,
            'auto_actions': ['increase_inspection_rate']
        }
    },
    'energy_anomaly': {
        'high': {
            'threshold': 1.3,  # 30% above normal
            'notification_channels': ['email', 'dashboard'],
            'escalation_minutes': 45,
            'auto_actions': ['log_energy_event', 'analyze_consumption_pattern']
        }
    }
}

# Default Service Configuration

DEFAULT_SERVICE_CONFIG = {
    'forecasting_engine': {
        'lstm': LSTM_CONFIG_TEMPLATES['equipment_failure_prediction'],
        'prophet': PROPHET_CONFIG_TEMPLATES['production_demand'],
        'arima': ARIMA_CONFIG_TEMPLATES['equipment_failure'],
        'ensemble': ENSEMBLE_CONFIG_TEMPLATES['critical_equipment']
    },
    'thresholds': MANUFACTURING_THRESHOLDS,
    'cost_parameters': COST_PARAMETERS['automotive_manufacturing'],
    'seasonal_patterns': SEASONAL_PATTERNS['consumer_goods'],
    'data_quality': DATA_QUALITY_REQUIREMENTS,
    'performance_targets': PERFORMANCE_BENCHMARKS,
    'alerts': ALERT_CONFIGURATIONS,
    'cache_expiry_minutes': 10,
    'max_forecast_horizon_days': 90,
    'model_retraining_days': 30,
    'enable_real_time_processing': True,
    'enable_batch_processing': True,
    'log_level': 'INFO'
}


def get_config_for_industry(industry: str) -> Dict[str, Any]:
    """Get optimized configuration for specific industry."""
    industry_configs = {
        'automotive': {
            'cost_parameters': COST_PARAMETERS['automotive_manufacturing'],
            'seasonal_patterns': SEASONAL_PATTERNS['consumer_goods'],
            'performance_targets': {
                'equipment_failure_accuracy': 0.92,
                'production_forecast_accuracy': 0.88,
                'energy_forecast_accuracy': 0.85
            }
        },
        'electronics': {
            'cost_parameters': COST_PARAMETERS['electronics_manufacturing'],
            'seasonal_patterns': SEASONAL_PATTERNS['consumer_goods'],
            'performance_targets': {
                'equipment_failure_accuracy': 0.94,
                'production_forecast_accuracy': 0.90,
                'quality_prediction_accuracy': 0.92
            }
        },
        'pharmaceutical': {
            'cost_parameters': COST_PARAMETERS['pharmaceutical_manufacturing'],
            'seasonal_patterns': SEASONAL_PATTERNS['industrial_equipment'],
            'performance_targets': {
                'quality_prediction_accuracy': 0.96,
                'equipment_failure_accuracy': 0.93,
                'compliance_accuracy': 0.98
            }
        },
        'food_processing': {
            'cost_parameters': COST_PARAMETERS['food_processing'],
            'seasonal_patterns': SEASONAL_PATTERNS['consumer_goods'],
            'performance_targets': {
                'quality_prediction_accuracy': 0.90,
                'production_forecast_accuracy': 0.87,
                'energy_forecast_accuracy': 0.83
            }
        },
        'chemical': {
            'cost_parameters': COST_PARAMETERS['chemical_processing'],
            'seasonal_patterns': SEASONAL_PATTERNS['continuous_process'],
            'performance_targets': {
                'equipment_failure_accuracy': 0.95,
                'process_optimization_accuracy': 0.91,
                'safety_prediction_accuracy': 0.97
            }
        }
    }
    
    base_config = DEFAULT_SERVICE_CONFIG.copy()
    industry_specific = industry_configs.get(industry, {})
    
    # Update base config with industry-specific settings
    for key, value in industry_specific.items():
        if key in base_config:
            base_config[key].update(value)
        else:
            base_config[key] = value
    
    return base_config


def get_config_for_application(application: str) -> Dict[str, Any]:
    """Get optimized configuration for specific manufacturing application."""
    application_configs = {
        'equipment_failure_prediction': {
            'primary_model': 'ensemble',
            'lstm_config': LSTM_CONFIG_TEMPLATES['equipment_failure_prediction'],
            'data_requirements': DATA_QUALITY_REQUIREMENTS['equipment_failure_prediction'],
            'thresholds': MANUFACTURING_THRESHOLDS['equipment_failure']
        },
        'production_demand_forecasting': {
            'primary_model': 'prophet',
            'prophet_config': PROPHET_CONFIG_TEMPLATES['production_demand'],
            'data_requirements': DATA_QUALITY_REQUIREMENTS['production_demand_forecasting'],
            'thresholds': MANUFACTURING_THRESHOLDS['production_capacity']
        },
        'quality_trend_prediction': {
            'primary_model': 'lstm',
            'lstm_config': LSTM_CONFIG_TEMPLATES['quality_trends'],
            'data_requirements': DATA_QUALITY_REQUIREMENTS['quality_trend_prediction'],
            'thresholds': MANUFACTURING_THRESHOLDS['quality_control']
        },
        'energy_consumption_forecasting': {
            'primary_model': 'prophet',
            'prophet_config': PROPHET_CONFIG_TEMPLATES['energy_consumption'],
            'data_requirements': DATA_QUALITY_REQUIREMENTS['energy_consumption_forecasting'],
            'thresholds': MANUFACTURING_THRESHOLDS['energy_efficiency']
        }
    }
    
    return application_configs.get(application, DEFAULT_SERVICE_CONFIG)


def validate_config(config: Dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate configuration settings."""
    errors = []
    
    # Check required sections
    required_sections = ['forecasting_engine', 'thresholds', 'cost_parameters']
    for section in required_sections:
        if section not in config:
            errors.append(f"Missing required configuration section: {section}")
    
    # Validate thresholds
    if 'thresholds' in config:
        for app, thresholds in config['thresholds'].items():
            for threshold_name, value in thresholds.items():
                if not isinstance(value, (int, float)):
                    errors.append(f"Invalid threshold value for {app}.{threshold_name}: must be numeric")
                elif value < 0 or value > 1:
                    if 'probability' in threshold_name or 'score' in threshold_name or 'efficiency' in threshold_name:
                        errors.append(f"Threshold {app}.{threshold_name} should be between 0 and 1")
    
    # Validate cost parameters
    if 'cost_parameters' in config:
        cost_params = config['cost_parameters']
        required_cost_params = ['preventive_maintenance_base', 'reactive_maintenance_multiplier']
        for param in required_cost_params:
            if param not in cost_params:
                errors.append(f"Missing required cost parameter: {param}")
            elif not isinstance(cost_params[param], (int, float)) or cost_params[param] <= 0:
                errors.append(f"Cost parameter {param} must be a positive number")
    
    return len(errors) == 0, errors