"""
ML Framework Enforcement Middleware
==================================

Enforces subscription-based access to ML frameworks and advanced features.
Integrates with the existing billing middleware to provide fine-grained control
over ML capabilities based on subscription tier.
"""

import logging
from typing import Dict, Any, Optional, Set, List
from enum import Enum
from datetime import datetime

from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.middleware.billing_middleware import SubscriptionTier, BillingContext
from app.core.config import settings

logger = logging.getLogger(__name__)

class MLFrameworkType(str, Enum):
    """ML Framework types for access control"""
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    CATBOOST = "catboost"
    ONNX = "onnx"
    HUGGINGFACE = "huggingface"
    SCIKIT_LEARN = "scikit_learn"

class MLFeatureType(str, Enum):
    """Advanced ML features for access control"""
    DISTRIBUTED_TRAINING = "distributed_training"
    ADVANCED_ENSEMBLE = "advanced_ensemble"
    MODEL_OPTIMIZATION = "model_optimization"
    CUSTOM_KERNELS = "custom_kernels"
    ENTERPRISE_FEATURES = "enterprise_features"
    HYPERPARAMETER_TUNING = "hyperparameter_tuning"
    AUTOMATED_FEATURE_ENGINEERING = "automated_feature_engineering"

# Framework access configuration by subscription tier
ML_FRAMEWORK_ACCESS = {
    SubscriptionTier.DEVELOP: {
        "frameworks": {
            MLFrameworkType.TENSORFLOW: True,
            MLFrameworkType.PYTORCH: False,  # PyTorch blocked on develop
            MLFrameworkType.XGBOOST: True,
            MLFrameworkType.LIGHTGBM: False,
            MLFrameworkType.CATBOOST: False,
            MLFrameworkType.ONNX: False,
            MLFrameworkType.HUGGINGFACE: False,
            MLFrameworkType.SCIKIT_LEARN: True,
        },
        "features": {
            MLFeatureType.DISTRIBUTED_TRAINING: False,
            MLFeatureType.ADVANCED_ENSEMBLE: False,
            MLFeatureType.MODEL_OPTIMIZATION: False,
            MLFeatureType.CUSTOM_KERNELS: False,
            MLFeatureType.ENTERPRISE_FEATURES: False,
            MLFeatureType.HYPERPARAMETER_TUNING: True,  # Basic tuning only
            MLFeatureType.AUTOMATED_FEATURE_ENGINEERING: False,
        },
        "limits": {
            "max_model_parameters": 10_000_000,  # 10M parameters
            "max_training_time_minutes": 30,
            "max_concurrent_experiments": 2,
            "max_model_size_mb": 100,
            "max_dataset_size_gb": 1,
        }
    },
    SubscriptionTier.GROWTH: {
        "frameworks": {
            MLFrameworkType.TENSORFLOW: True,
            MLFrameworkType.PYTORCH: True,   # PyTorch unlocked
            MLFrameworkType.XGBOOST: True,
            MLFrameworkType.LIGHTGBM: True,  # Advanced boosting unlocked
            MLFrameworkType.CATBOOST: True,
            MLFrameworkType.ONNX: True,      # Model optimization unlocked
            MLFrameworkType.HUGGINGFACE: True,  # Transformer access
            MLFrameworkType.SCIKIT_LEARN: True,
        },
        "features": {
            MLFeatureType.DISTRIBUTED_TRAINING: False,  # Still no distributed
            MLFeatureType.ADVANCED_ENSEMBLE: True,      # Ensemble methods
            MLFeatureType.MODEL_OPTIMIZATION: True,     # Standard optimization
            MLFeatureType.CUSTOM_KERNELS: False,
            MLFeatureType.ENTERPRISE_FEATURES: False,
            MLFeatureType.HYPERPARAMETER_TUNING: True,
            MLFeatureType.AUTOMATED_FEATURE_ENGINEERING: True,
        },
        "limits": {
            "max_model_parameters": 100_000_000,  # 100M parameters
            "max_training_time_minutes": 120,
            "max_concurrent_experiments": 5,
            "max_model_size_mb": 1000,
            "max_dataset_size_gb": 10,
        }
    },
    SubscriptionTier.SCALE: {
        "frameworks": {
            MLFrameworkType.TENSORFLOW: True,
            MLFrameworkType.PYTORCH: True,
            MLFrameworkType.XGBOOST: True,
            MLFrameworkType.LIGHTGBM: True,
            MLFrameworkType.CATBOOST: True,
            MLFrameworkType.ONNX: True,
            MLFrameworkType.HUGGINGFACE: True,
            MLFrameworkType.SCIKIT_LEARN: True,
        },
        "features": {
            MLFeatureType.DISTRIBUTED_TRAINING: True,    # Full distributed access
            MLFeatureType.ADVANCED_ENSEMBLE: True,
            MLFeatureType.MODEL_OPTIMIZATION: True,
            MLFeatureType.CUSTOM_KERNELS: True,          # Rust/CUDA kernels
            MLFeatureType.ENTERPRISE_FEATURES: True,     # Full enterprise suite
            MLFeatureType.HYPERPARAMETER_TUNING: True,
            MLFeatureType.AUTOMATED_FEATURE_ENGINEERING: True,
        },
        "limits": {
            "max_model_parameters": 1_000_000_000,  # 1B parameters
            "max_training_time_minutes": 1440,      # 24 hours
            "max_concurrent_experiments": 20,
            "max_model_size_mb": 10000,             # 10GB
            "max_dataset_size_gb": 100,
        }
    }
}

class MLFrameworkEnforcementMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce ML framework access based on subscription tier
    """

    def __init__(
        self,
        app,
        enabled: bool = True,
        strict_mode: bool = True
    ):
        super().__init__(app)
        self.enabled = enabled
        self.strict_mode = strict_mode

        # ML-specific endpoints that require framework checking
        self.ml_endpoints = {
            "/api/v1/ai-framework",
            "/api/v1/advanced-ai",
            "/api/v1/ml-pipeline",
            "/api/v1/model-serving",
            "/api/v1/advanced-ml",
            "/api/v1/mlops",
        }

        logger.info(f"ML Framework Enforcement Middleware initialized (enabled={enabled}, strict={strict_mode})")

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        # Only check ML-related endpoints
        if not any(request.url.path.startswith(endpoint) for endpoint in self.ml_endpoints):
            return await call_next(request)

        try:
            # Get billing context from the billing middleware
            billing_context = getattr(request.state, 'billing_context', None)
            if not billing_context:
                # Create default context if billing middleware not available
                billing_context = self._create_default_billing_context()

            # Check framework access before processing request
            framework_check = await self._check_framework_access(request, billing_context)
            if framework_check:
                return framework_check

            # Add ML access info to request state
            request.state.ml_access = self._get_ml_access_info(billing_context.subscription_tier)

            # Process the request
            response = await call_next(request)

            # Add ML capability headers
            await self._add_ml_headers(response, billing_context.subscription_tier)

            return response

        except Exception as e:
            logger.error(f"ML Framework Enforcement error: {e}")
            if self.strict_mode:
                raise HTTPException(
                    status_code=500,
                    detail="ML framework enforcement error"
                )
            return await call_next(request)

    async def _check_framework_access(
        self,
        request: Request,
        billing_context: BillingContext
    ) -> Optional[Response]:
        """Check if user has access to requested ML frameworks/features"""

        try:
            # Extract framework requirements from request
            framework_requirements = await self._extract_framework_requirements(request)

            if not framework_requirements:
                return None  # No framework requirements, allow through

            # Get user's access configuration
            user_access = ML_FRAMEWORK_ACCESS.get(
                billing_context.subscription_tier,
                ML_FRAMEWORK_ACCESS[SubscriptionTier.DEVELOP]
            )

            # Check framework access
            blocked_frameworks = []
            for framework in framework_requirements.get('frameworks', []):
                if not user_access['frameworks'].get(framework, False):
                    blocked_frameworks.append(framework.value)

            if blocked_frameworks:
                return self._create_framework_blocked_response(
                    blocked_frameworks,
                    billing_context.subscription_tier
                )

            # Check feature access
            blocked_features = []
            for feature in framework_requirements.get('features', []):
                if not user_access['features'].get(feature, False):
                    blocked_features.append(feature.value)

            if blocked_features:
                return self._create_feature_blocked_response(
                    blocked_features,
                    billing_context.subscription_tier
                )

            # Check parameter limits
            limits_check = self._check_parameter_limits(
                framework_requirements.get('parameters', {}),
                user_access['limits']
            )

            if limits_check:
                return limits_check

            return None  # All checks passed

        except Exception as e:
            logger.error(f"Error checking framework access: {e}")
            if self.strict_mode:
                return Response(
                    content="Framework access verification failed",
                    status_code=500
                )
            return None

    async def _extract_framework_requirements(self, request: Request) -> Dict[str, Any]:
        """Extract ML framework requirements from the request"""

        requirements = {
            'frameworks': [],
            'features': [],
            'parameters': {}
        }

        try:
            # Check URL path for framework indicators
            path = request.url.path.lower()

            # Framework detection from path
            if 'tensorflow' in path or 'tf' in path:
                requirements['frameworks'].append(MLFrameworkType.TENSORFLOW)
            if 'pytorch' in path or 'torch' in path:
                requirements['frameworks'].append(MLFrameworkType.PYTORCH)
            if 'xgboost' in path:
                requirements['frameworks'].append(MLFrameworkType.XGBOOST)
            if 'lightgbm' in path:
                requirements['frameworks'].append(MLFrameworkType.LIGHTGBM)
            if 'catboost' in path:
                requirements['frameworks'].append(MLFrameworkType.CATBOOST)
            if 'huggingface' in path or 'transformers' in path:
                requirements['frameworks'].append(MLFrameworkType.HUGGINGFACE)

            # Feature detection from path
            if 'distributed' in path:
                requirements['features'].append(MLFeatureType.DISTRIBUTED_TRAINING)
            if 'ensemble' in path:
                requirements['features'].append(MLFeatureType.ADVANCED_ENSEMBLE)
            if 'optimization' in path or 'optimize' in path:
                requirements['features'].append(MLFeatureType.MODEL_OPTIMIZATION)

            # Check request body for framework/feature specifications
            if request.method in ["POST", "PUT", "PATCH"]:
                try:
                    body = await request.body()
                    if body:
                        import json
                        data = json.loads(body.decode())

                        # Look for explicit framework specification
                        framework = data.get('framework', '').lower()
                        if framework:
                            try:
                                requirements['frameworks'].append(MLFrameworkType(framework))
                            except ValueError:
                                pass

                        # Extract parameter requirements
                        requirements['parameters'] = {
                            'model_parameters': data.get('model_parameters', 0),
                            'training_time_minutes': data.get('training_time_minutes', 0),
                            'dataset_size_gb': data.get('dataset_size_gb', 0),
                            'model_size_mb': data.get('model_size_mb', 0),
                        }

                        # Reset request body for downstream processing
                        request._body = body
                except Exception as e:
                    logger.debug(f"Could not parse request body for framework detection: {e}")

        except Exception as e:
            logger.error(f"Error extracting framework requirements: {e}")

        return requirements

    def _create_framework_blocked_response(
        self,
        blocked_frameworks: List[str],
        tier: SubscriptionTier
    ) -> Response:
        """Create response for blocked framework access"""

        upgrade_tier = self._get_upgrade_tier(tier)

        message = {
            "error": "Framework Access Denied",
            "message": f"Your {tier.value} plan does not include access to: {', '.join(blocked_frameworks)}",
            "blocked_frameworks": blocked_frameworks,
            "current_tier": tier.value,
            "upgrade_to": upgrade_tier,
            "upgrade_benefits": self._get_framework_upgrade_benefits(blocked_frameworks, upgrade_tier),
            "docs_url": f"{settings.FRONTEND_URL}/docs/frameworks"
        }

        return Response(
            content=json.dumps(message),
            status_code=402,  # Payment Required
            headers={
                "Content-Type": "application/json",
                "X-Upgrade-Required": upgrade_tier,
                "X-Blocked-Frameworks": ",".join(blocked_frameworks)
            }
        )

    def _create_feature_blocked_response(
        self,
        blocked_features: List[str],
        tier: SubscriptionTier
    ) -> Response:
        """Create response for blocked feature access"""

        upgrade_tier = self._get_upgrade_tier(tier)

        message = {
            "error": "Feature Access Denied",
            "message": f"Your {tier.value} plan does not include: {', '.join(blocked_features)}",
            "blocked_features": blocked_features,
            "current_tier": tier.value,
            "upgrade_to": upgrade_tier,
            "upgrade_benefits": self._get_feature_upgrade_benefits(blocked_features, upgrade_tier),
        }

        return Response(
            content=json.dumps(message),
            status_code=402,
            headers={
                "Content-Type": "application/json",
                "X-Upgrade-Required": upgrade_tier,
                "X-Blocked-Features": ",".join(blocked_features)
            }
        )

    def _check_parameter_limits(
        self,
        requested_params: Dict[str, Any],
        tier_limits: Dict[str, Any]
    ) -> Optional[Response]:
        """Check if requested parameters exceed tier limits"""

        violations = []

        for param, value in requested_params.items():
            if param in tier_limits and value > tier_limits[param]:
                violations.append({
                    "parameter": param,
                    "requested": value,
                    "limit": tier_limits[param]
                })

        if violations:
            message = {
                "error": "Parameter Limits Exceeded",
                "message": "Requested parameters exceed your plan limits",
                "violations": violations,
                "limits": tier_limits
            }

            return Response(
                content=json.dumps(message),
                status_code=402,
                headers={"Content-Type": "application/json"}
            )

        return None

    def _get_ml_access_info(self, tier: SubscriptionTier) -> Dict[str, Any]:
        """Get ML access information for the tier"""
        return ML_FRAMEWORK_ACCESS.get(tier, ML_FRAMEWORK_ACCESS[SubscriptionTier.DEVELOP])

    async def _add_ml_headers(self, response: Response, tier: SubscriptionTier):
        """Add ML capability headers to response"""
        try:
            access_info = self._get_ml_access_info(tier)

            # Add framework availability headers
            available_frameworks = [
                fw.value for fw, available in access_info['frameworks'].items()
                if available
            ]
            response.headers["X-ML-Frameworks"] = ",".join(available_frameworks)

            # Add feature availability headers
            available_features = [
                feat.value for feat, available in access_info['features'].items()
                if available
            ]
            response.headers["X-ML-Features"] = ",".join(available_features)

            # Add tier-specific limits
            limits = access_info['limits']
            response.headers["X-ML-Max-Parameters"] = str(limits['max_model_parameters'])
            response.headers["X-ML-Max-Training-Time"] = str(limits['max_training_time_minutes'])

        except Exception as e:
            logger.error(f"Error adding ML headers: {e}")

    def _get_upgrade_tier(self, current_tier: SubscriptionTier) -> str:
        """Get the next tier for upgrade recommendations"""
        if current_tier == SubscriptionTier.DEVELOP:
            return SubscriptionTier.GROWTH.value
        elif current_tier == SubscriptionTier.GROWTH:
            return SubscriptionTier.SCALE.value
        return SubscriptionTier.SCALE.value

    def _get_framework_upgrade_benefits(self, blocked_frameworks: List[str], upgrade_tier: str) -> List[str]:
        """Get upgrade benefits for blocked frameworks"""
        benefits = []
        if "pytorch" in blocked_frameworks:
            benefits.append("Access to PyTorch deep learning framework")
        if "lightgbm" in blocked_frameworks or "catboost" in blocked_frameworks:
            benefits.append("Advanced gradient boosting algorithms")
        if "huggingface" in blocked_frameworks:
            benefits.append("Transformer models and NLP capabilities")
        return benefits

    def _get_feature_upgrade_benefits(self, blocked_features: List[str], upgrade_tier: str) -> List[str]:
        """Get upgrade benefits for blocked features"""
        benefits = []
        if "distributed_training" in blocked_features:
            benefits.append("Multi-GPU and distributed training")
        if "advanced_ensemble" in blocked_features:
            benefits.append("Advanced ensemble methods and stacking")
        if "model_optimization" in blocked_features:
            benefits.append("ONNX export and model optimization")
        return benefits

    def _create_default_billing_context(self) -> BillingContext:
        """Create default billing context if billing middleware unavailable"""
        from app.middleware.billing_middleware import BillingContext
        context = BillingContext()
        context.subscription_tier = SubscriptionTier.DEVELOP  # Default to lowest tier
        return context


# Framework detection utility functions
def check_framework_access(subscription_tier: SubscriptionTier, framework: MLFrameworkType) -> bool:
    """Check if user has access to specific framework"""
    access_config = ML_FRAMEWORK_ACCESS.get(subscription_tier, ML_FRAMEWORK_ACCESS[SubscriptionTier.DEVELOP])
    return access_config['frameworks'].get(framework, False)

def check_feature_access(subscription_tier: SubscriptionTier, feature: MLFeatureType) -> bool:
    """Check if user has access to specific ML feature"""
    access_config = ML_FRAMEWORK_ACCESS.get(subscription_tier, ML_FRAMEWORK_ACCESS[SubscriptionTier.DEVELOP])
    return access_config['features'].get(feature, False)

def get_tier_limits(subscription_tier: SubscriptionTier) -> Dict[str, Any]:
    """Get parameter limits for subscription tier"""
    access_config = ML_FRAMEWORK_ACCESS.get(subscription_tier, ML_FRAMEWORK_ACCESS[SubscriptionTier.DEVELOP])
    return access_config['limits']

# Export
__all__ = [
    'MLFrameworkEnforcementMiddleware',
    'MLFrameworkType',
    'MLFeatureType',
    'ML_FRAMEWORK_ACCESS',
    'check_framework_access',
    'check_feature_access',
    'get_tier_limits'
]