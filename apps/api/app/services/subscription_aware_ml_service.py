"""
Subscription-Aware ML Service
============================

Extends the ML Framework Integration with subscription-based access control.
Provides framework access checking, feature gating, and parameter validation
based on user subscription tier.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime

import pandas as pd
from fastapi import HTTPException, Request

from app.middleware.billing_middleware import SubscriptionTier, BillingContext
from app.middleware.ml_framework_enforcement import (
    MLFrameworkType, MLFeatureType, ML_FRAMEWORK_ACCESS,
    check_framework_access, check_feature_access, get_tier_limits
)
from app.services.ml_framework_integration import MLFrameworkIntegration, ExportConfiguration

logger = logging.getLogger(__name__)

class SubscriptionAwareMLService:
    """
    ML Service that enforces subscription-based access to frameworks and features
    """

    def __init__(self):
        self.ml_integration = MLFrameworkIntegration()
        logger.info("Subscription-Aware ML Service initialized")

    async def export_for_framework_with_access_check(
        self,
        df: pd.DataFrame,
        config: ExportConfiguration,
        billing_context: BillingContext
    ) -> Dict[str, Any]:
        """
        Export data for ML framework with subscription access validation
        """

        try:
            # Check framework access
            await self._validate_framework_access(config, billing_context)

            # Check parameter limits
            await self._validate_parameter_limits(config, df, billing_context)

            # Check feature access
            await self._validate_feature_access(config, billing_context)

            # Proceed with export if all checks pass
            result = await self.ml_integration.export_for_framework(df, config)

            # Add subscription context to result
            result['subscription_context'] = {
                'tier': billing_context.subscription_tier.value,
                'frameworks_used': [config.framework.value],
                'access_validated': True,
                'timestamp': datetime.now().isoformat()
            }

            return result

        except Exception as e:
            logger.error(f"ML export with access check failed: {e}")
            raise

    async def _validate_framework_access(
        self,
        config: ExportConfiguration,
        billing_context: BillingContext
    ):
        """Validate user has access to requested framework"""

        if not check_framework_access(billing_context.subscription_tier, config.framework):
            upgrade_tier = self._get_upgrade_tier(billing_context.subscription_tier)

            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Framework Access Denied",
                    "message": f"Your {billing_context.subscription_tier.value} plan does not include {config.framework.value}",
                    "blocked_framework": config.framework.value,
                    "current_tier": billing_context.subscription_tier.value,
                    "upgrade_to": upgrade_tier,
                    "upgrade_benefits": self._get_framework_benefits(config.framework, upgrade_tier)
                }
            )

    async def _validate_parameter_limits(
        self,
        config: ExportConfiguration,
        df: pd.DataFrame,
        billing_context: BillingContext
    ):
        """Validate parameters don't exceed tier limits"""

        limits = get_tier_limits(billing_context.subscription_tier)
        violations = []

        # Check dataset size
        dataset_size_gb = self._estimate_dataset_size_gb(df)
        if dataset_size_gb > limits['max_dataset_size_gb']:
            violations.append({
                "parameter": "dataset_size_gb",
                "requested": round(dataset_size_gb, 2),
                "limit": limits['max_dataset_size_gb']
            })

        # Check batch size reasonableness (proxy for memory usage)
        if hasattr(config, 'batch_size') and config.batch_size > limits.get('max_batch_size', 1000):
            violations.append({
                "parameter": "batch_size",
                "requested": config.batch_size,
                "limit": limits.get('max_batch_size', 1000)
            })

        if violations:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Parameter Limits Exceeded",
                    "message": "Requested parameters exceed your plan limits",
                    "violations": violations,
                    "tier_limits": limits,
                    "current_tier": billing_context.subscription_tier.value
                }
            )

    async def _validate_feature_access(
        self,
        config: ExportConfiguration,
        billing_context: BillingContext
    ):
        """Validate user has access to advanced features"""

        required_features = self._extract_required_features(config)
        blocked_features = []

        for feature in required_features:
            if not check_feature_access(billing_context.subscription_tier, feature):
                blocked_features.append(feature.value)

        if blocked_features:
            upgrade_tier = self._get_upgrade_tier(billing_context.subscription_tier)

            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Feature Access Denied",
                    "message": f"Your {billing_context.subscription_tier.value} plan does not include: {', '.join(blocked_features)}",
                    "blocked_features": blocked_features,
                    "current_tier": billing_context.subscription_tier.value,
                    "upgrade_to": upgrade_tier,
                    "upgrade_benefits": self._get_feature_benefits(blocked_features, upgrade_tier)
                }
            )

    def _extract_required_features(self, config: ExportConfiguration) -> List[MLFeatureType]:
        """Extract required ML features from export configuration"""

        features = []

        # Check for distributed training requirements
        if hasattr(config, 'distributed') and config.distributed:
            features.append(MLFeatureType.DISTRIBUTED_TRAINING)

        # Check for ensemble requirements
        if hasattr(config, 'ensemble_methods') and config.ensemble_methods:
            features.append(MLFeatureType.ADVANCED_ENSEMBLE)

        # Check for optimization requirements
        if hasattr(config, 'optimize_model') and config.optimize_model:
            features.append(MLFeatureType.MODEL_OPTIMIZATION)

        # Check for custom kernel requirements
        if hasattr(config, 'use_custom_kernels') and config.use_custom_kernels:
            features.append(MLFeatureType.CUSTOM_KERNELS)

        # Check for automated feature engineering
        if hasattr(config, 'auto_feature_engineering') and config.auto_feature_engineering:
            features.append(MLFeatureType.AUTOMATED_FEATURE_ENGINEERING)

        return features

    def _estimate_dataset_size_gb(self, df: pd.DataFrame) -> float:
        """Estimate dataset size in GB"""
        try:
            # Get memory usage in bytes
            memory_usage = df.memory_usage(deep=True).sum()
            # Convert to GB
            return memory_usage / (1024 ** 3)
        except Exception:
            # Fallback estimation
            return len(df) * len(df.columns) * 8 / (1024 ** 3)  # Assume 8 bytes per value

    def _get_upgrade_tier(self, current_tier: SubscriptionTier) -> str:
        """Get the next tier for upgrade recommendations"""
        if current_tier == SubscriptionTier.DEVELOP:
            return SubscriptionTier.GROWTH.value
        elif current_tier == SubscriptionTier.GROWTH:
            return SubscriptionTier.SCALE.value
        return SubscriptionTier.SCALE.value

    def _get_framework_benefits(self, framework: MLFrameworkType, upgrade_tier: str) -> List[str]:
        """Get benefits of upgrading for specific framework"""
        benefits_map = {
            MLFrameworkType.PYTORCH: [
                "Access to PyTorch deep learning framework",
                "Advanced neural network architectures",
                "GPU acceleration support",
                "Lightning integration"
            ],
            MLFrameworkType.LIGHTGBM: [
                "Advanced gradient boosting algorithms",
                "Better performance on tabular data",
                "Automatic hyperparameter tuning"
            ],
            MLFrameworkType.HUGGINGFACE: [
                "Pre-trained transformer models",
                "State-of-the-art NLP capabilities",
                "Vision transformers",
                "Multi-modal models"
            ]
        }
        return benefits_map.get(framework, ["Advanced ML capabilities"])

    def _get_feature_benefits(self, blocked_features: List[str], upgrade_tier: str) -> List[str]:
        """Get benefits of upgrading for specific features"""
        benefits = []
        if "distributed_training" in blocked_features:
            benefits.extend(["Multi-GPU training", "Distributed computing", "Faster model training"])
        if "advanced_ensemble" in blocked_features:
            benefits.extend(["Ensemble methods", "Model stacking", "Better prediction accuracy"])
        if "model_optimization" in blocked_features:
            benefits.extend(["ONNX export", "Model compression", "Inference optimization"])
        if "custom_kernels" in blocked_features:
            benefits.extend(["Rust compute kernels", "CUDA acceleration", "Custom optimizations"])

        return benefits if benefits else ["Advanced ML features"]

    async def get_available_frameworks(self, billing_context: BillingContext) -> Dict[str, Any]:
        """Get frameworks available for user's subscription tier"""

        access_config = ML_FRAMEWORK_ACCESS.get(
            billing_context.subscription_tier,
            ML_FRAMEWORK_ACCESS[SubscriptionTier.DEVELOP]
        )

        available_frameworks = {
            framework.value: available
            for framework, available in access_config['frameworks'].items()
        }

        available_features = {
            feature.value: available
            for feature, available in access_config['features'].items()
        }

        return {
            "subscription_tier": billing_context.subscription_tier.value,
            "frameworks": available_frameworks,
            "features": available_features,
            "limits": access_config['limits'],
            "upgrade_tier": self._get_upgrade_tier(billing_context.subscription_tier)
        }

    async def validate_ml_operation(
        self,
        operation_type: str,
        parameters: Dict[str, Any],
        billing_context: BillingContext
    ) -> Dict[str, Any]:
        """
        Validate any ML operation against subscription limits

        Returns validation result with access info and any violations
        """

        result = {
            "allowed": True,
            "violations": [],
            "warnings": [],
            "tier": billing_context.subscription_tier.value
        }

        try:
            limits = get_tier_limits(billing_context.subscription_tier)

            # Check common parameter limits
            for param, value in parameters.items():
                limit_key = f"max_{param}"
                if limit_key in limits and value > limits[limit_key]:
                    result["violations"].append({
                        "parameter": param,
                        "requested": value,
                        "limit": limits[limit_key],
                        "severity": "error"
                    })

            # Check if operation requires specific frameworks/features
            required_frameworks = parameters.get('required_frameworks', [])
            required_features = parameters.get('required_features', [])

            for framework_str in required_frameworks:
                try:
                    framework = MLFrameworkType(framework_str)
                    if not check_framework_access(billing_context.subscription_tier, framework):
                        result["violations"].append({
                            "type": "framework",
                            "blocked": framework.value,
                            "severity": "error"
                        })
                except ValueError:
                    pass

            for feature_str in required_features:
                try:
                    feature = MLFeatureType(feature_str)
                    if not check_feature_access(billing_context.subscription_tier, feature):
                        result["violations"].append({
                            "type": "feature",
                            "blocked": feature.value,
                            "severity": "error"
                        })
                except ValueError:
                    pass

            # Add warnings for approaching limits
            usage_warnings = self._check_usage_warnings(parameters, limits)
            result["warnings"].extend(usage_warnings)

            # Set overall result
            result["allowed"] = len(result["violations"]) == 0

            return result

        except Exception as e:
            logger.error(f"Error validating ML operation: {e}")
            result["allowed"] = False
            result["violations"].append({
                "type": "system_error",
                "message": "Validation error occurred",
                "severity": "error"
            })
            return result

    def _check_usage_warnings(self, parameters: Dict[str, Any], limits: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check for usage approaching limits and generate warnings"""

        warnings = []
        warning_threshold = 0.8  # Warn at 80% of limit

        for param, value in parameters.items():
            limit_key = f"max_{param}"
            if limit_key in limits:
                limit = limits[limit_key]
                if value > limit * warning_threshold:
                    warnings.append({
                        "parameter": param,
                        "usage": value,
                        "limit": limit,
                        "usage_percent": round((value / limit) * 100, 1),
                        "message": f"Approaching {param} limit ({value}/{limit})"
                    })

        return warnings


# Convenience function for getting service instance
def get_subscription_aware_ml_service() -> SubscriptionAwareMLService:
    """Get subscription-aware ML service instance"""
    return SubscriptionAwareMLService()

# Export
__all__ = [
    'SubscriptionAwareMLService',
    'get_subscription_aware_ml_service'
]