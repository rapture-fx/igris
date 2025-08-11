"""
Security Configuration Utilities

This module provides utilities for managing security feature flags and configurations
at runtime, including environment-specific configurations and dynamic feature toggling.
"""

import os
import logging
from typing import Dict, Any, Optional
from enum import Enum

from app.core.api_config import settings

logger = logging.getLogger(__name__)


class SecurityEnvironment(str, Enum):
    """Security environment types"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class SecurityFeatureManager:
    """
    Manages security feature flags and provides utilities for runtime configuration.
    """
    
    def __init__(self):
        self._custom_overrides: Dict[str, bool] = {}
        self._environment = os.getenv("ENVIRONMENT", "development").lower()
    
    def is_feature_enabled(self, feature: str) -> bool:
        """
        Check if a security feature is enabled.
        
        Checks in order:
        1. Custom runtime overrides
        2. Environment-specific configuration
        3. Default configuration from settings
        
        Args:
            feature: Security feature name
            
        Returns:
            bool: True if feature is enabled
        """
        # Check custom overrides first
        if feature in self._custom_overrides:
            return self._custom_overrides[feature]
        
        # Check environment-specific config
        env_config = self.get_environment_config()
        if feature in env_config:
            return env_config[feature]
        
        # Fall back to default configuration
        return settings.SECURITY_FEATURES.get(feature, False)
    
    def enable_feature(self, feature: str) -> None:
        """Enable a security feature at runtime"""
        self._custom_overrides[feature] = True
        logger.info(f"Security feature '{feature}' enabled at runtime")
    
    def disable_feature(self, feature: str) -> None:
        """Disable a security feature at runtime"""
        self._custom_overrides[feature] = False
        logger.info(f"Security feature '{feature}' disabled at runtime")
    
    def reset_feature(self, feature: str) -> None:
        """Reset a security feature to its default configuration"""
        if feature in self._custom_overrides:
            del self._custom_overrides[feature]
            logger.info(f"Security feature '{feature}' reset to default configuration")
    
    def get_environment_config(self, environment: Optional[str] = None) -> Dict[str, bool]:
        """Get security configuration for specific environment"""
        if environment is None:
            environment = self._environment
        
        return settings.get_security_config_for_environment(environment)
    
    def get_all_features_status(self) -> Dict[str, Any]:
        """Get status of all security features"""
        all_features = set(settings.SECURITY_FEATURES.keys())
        all_features.update(self._custom_overrides.keys())
        
        return {
            feature: {
                'enabled': self.is_feature_enabled(feature),
                'source': self._get_feature_source(feature),
                'environment': self._environment
            }
            for feature in all_features
        }
    
    def _get_feature_source(self, feature: str) -> str:
        """Get the source of a feature's configuration"""
        if feature in self._custom_overrides:
            return "runtime_override"
        
        env_config = self.get_environment_config()
        if feature in env_config:
            return f"environment_{self._environment}"
        
        return "default_config"
    
    def apply_environment_config(self, environment: SecurityEnvironment) -> None:
        """Apply environment-specific security configuration"""
        env_config = self.get_environment_config(environment.value)
        
        logger.info(f"Applying security configuration for environment: {environment.value}")
        
        for feature, enabled in env_config.items():
            if enabled:
                self.enable_feature(feature)
            else:
                self.disable_feature(feature)
    
    def get_feature_recommendations(self) -> Dict[str, str]:
        """Get recommendations for security feature configuration"""
        recommendations = {}
        
        if self._environment == "production":
            if not self.is_feature_enabled('encryption'):
                recommendations['encryption'] = "  Consider enabling encryption in production"
            if not self.is_feature_enabled('audit_logging'):
                recommendations['audit_logging'] = "  Audit logging should be enabled in production"
            if not self.is_feature_enabled('compliance_tracking'):
                recommendations['compliance_tracking'] = "  Compliance tracking recommended for production"
        
        elif self._environment == "development":
            if self.is_feature_enabled('encryption'):
                recommendations['encryption'] = " Consider disabling encryption in development for easier debugging"
            if self.is_feature_enabled('rate_limiting'):
                recommendations['rate_limiting'] = " Consider disabling rate limiting in development"
        
        elif self._environment == "testing":
            if self.is_feature_enabled('audit_logging'):
                recommendations['audit_logging'] = " Consider disabling audit logging in tests to reduce noise"
            if self.is_feature_enabled('encryption'):
                recommendations['encryption'] = " Consider disabling encryption in tests for easier assertions"
        
        return recommendations


# Global security feature manager instance
security_manager = SecurityFeatureManager()


# Convenience functions for backward compatibility
def is_security_feature_enabled(feature: str) -> bool:
    """Check if a security feature is enabled"""
    return security_manager.is_feature_enabled(feature)


def enable_security_feature(feature: str) -> None:
    """Enable a security feature at runtime"""
    security_manager.enable_feature(feature)


def disable_security_feature(feature: str) -> None:
    """Disable a security feature at runtime"""
    security_manager.disable_feature(feature)


def get_security_status() -> Dict[str, Any]:
    """Get comprehensive security features status"""
    return {
        'features': security_manager.get_all_features_status(),
        'environment': security_manager._environment,
        'recommendations': security_manager.get_feature_recommendations()
    }


# Environment-specific configurations
DEVELOPMENT_CONFIG = {
    'encryption': False,
    'audit_logging': True,
    'mfa': False,
    'advanced_monitoring': False,
    'permission_checking': True,
    'rate_limiting': False,
    'security_headers': True,
    'pii_detection': True,
    'compliance_tracking': False,
    'data_classification': False
}

PRODUCTION_CONFIG = {
    'encryption': True,
    'audit_logging': True,
    'mfa': False,  # Enable when ready
    'advanced_monitoring': True,
    'permission_checking': True,
    'rate_limiting': True,
    'security_headers': True,
    'pii_detection': True,
    'compliance_tracking': True,
    'data_classification': True
}

TESTING_CONFIG = {
    'encryption': False,
    'audit_logging': False,
    'mfa': False,
    'advanced_monitoring': False,
    'permission_checking': True,
    'rate_limiting': False,
    'security_headers': False,
    'pii_detection': True,
    'compliance_tracking': False,
    'data_classification': False
} 