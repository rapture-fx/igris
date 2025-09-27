"""
Subscription-Aware ML Framework Endpoints
========================================

Enhanced ML endpoints with subscription-based access control.
Demonstrates how to integrate framework enforcement into existing API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
import logging

from app.database.connection import get_db
from app.database.models import User, DataInvestigation
from app.api.v1.auth_unified import get_current_user
from app.middleware.billing_middleware import BillingContext, SubscriptionTier
from app.middleware.ml_framework_enforcement import (
    MLFrameworkType, MLFeatureType, check_framework_access, check_feature_access
)
from app.services.subscription_aware_ml_service import get_subscription_aware_ml_service
from app.services.ml_framework_integration import ExportConfiguration, TaskType
from app.services.file_processor import DataProcessor as FileProcessor

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== REQUEST/RESPONSE MODELS ====================

class SubscriptionAwareFrameworkExportRequest(BaseModel):
    """Enhanced framework export request with subscription awareness"""
    framework: str = Field(..., description="Target ML framework (tensorflow, pytorch, etc.)")
    task_type: str = Field(..., description="ML task type")
    target_column: Optional[str] = Field(None, description="Target column name")
    feature_columns: Optional[List[str]] = Field(None, description="Feature column names")
    batch_size: int = Field(32, description="Batch size for data loaders")
    max_length: int = Field(512, description="Max sequence length for NLP")

    # Advanced features (tier-gated)
    enable_optimization: bool = Field(False, description="Enable model optimization")
    enable_ensemble: bool = Field(False, description="Enable ensemble methods")
    enable_distributed: bool = Field(False, description="Enable distributed training")
    use_custom_kernels: bool = Field(False, description="Use custom compute kernels")

    # Parameter limits (tier-enforced)
    estimated_model_parameters: Optional[int] = Field(None, description="Estimated model parameter count")
    estimated_training_time_minutes: Optional[int] = Field(None, description="Estimated training time")

class MLCapabilitiesResponse(BaseModel):
    """Response showing available ML capabilities for user's tier"""
    subscription_tier: str
    available_frameworks: Dict[str, bool]
    available_features: Dict[str, bool]
    tier_limits: Dict[str, Any]
    upgrade_tier: str
    upgrade_benefits: List[str]

class MLValidationResponse(BaseModel):
    """Response for ML operation validation"""
    allowed: bool
    violations: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    tier: str
    recommendations: List[str]

# ==================== HELPER FUNCTIONS ====================

def get_billing_context_from_request(request: Request) -> BillingContext:
    """Extract billing context from request state"""
    billing_context = getattr(request.state, 'billing_context', None)
    if not billing_context:
        # Create default context if middleware not available
        from app.middleware.billing_middleware import BillingContext
        billing_context = BillingContext()
        billing_context.subscription_tier = SubscriptionTier.DEVELOP
    return billing_context

# ==================== SUBSCRIPTION-AWARE ENDPOINTS ====================

@router.get("/capabilities", response_model=MLCapabilitiesResponse)
async def get_ml_capabilities(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get ML capabilities available for user's subscription tier
    """
    try:
        billing_context = get_billing_context_from_request(request)
        ml_service = get_subscription_aware_ml_service()

        capabilities = await ml_service.get_available_frameworks(billing_context)

        # Add upgrade benefits
        upgrade_benefits = []
        if billing_context.subscription_tier == SubscriptionTier.DEVELOP:
            upgrade_benefits = [
                "Access to PyTorch deep learning framework",
                "Advanced gradient boosting (LightGBM, CatBoost)",
                "Model optimization and ONNX export",
                "Transformer models and NLP capabilities",
                "Higher parameter limits and longer training times"
            ]
        elif billing_context.subscription_tier == SubscriptionTier.GROWTH:
            upgrade_benefits = [
                "Distributed training across multiple GPUs",
                "Custom Rust compute kernels",
                "Enterprise security features",
                "Advanced ensemble methods",
                "Unlimited model parameters"
            ]

        return MLCapabilitiesResponse(
            subscription_tier=capabilities["subscription_tier"],
            available_frameworks=capabilities["frameworks"],
            available_features=capabilities["features"],
            tier_limits=capabilities["limits"],
            upgrade_tier=capabilities["upgrade_tier"],
            upgrade_benefits=upgrade_benefits
        )

    except Exception as e:
        logger.error(f"Error getting ML capabilities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve ML capabilities"
        )

@router.post("/export/tensorflow",
             summary="Export to TensorFlow (All Tiers)",
             description="Export data for TensorFlow training. Available on all subscription tiers.")
async def export_tensorflow_with_access_control(
    request_data: SubscriptionAwareFrameworkExportRequest,
    investigation_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export data in TensorFlow format with subscription-based access control
    """
    try:
        billing_context = get_billing_context_from_request(request)

        # TensorFlow is available on all tiers, so just validate parameters
        validation_result = await _validate_ml_request(
            request_data, MLFrameworkType.TENSORFLOW, billing_context
        )

        if not validation_result["allowed"]:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Request exceeds plan limits",
                    "violations": validation_result["violations"],
                    "tier": validation_result["tier"]
                }
            )

        # Get investigation data
        investigation = await _get_user_investigation(investigation_id, current_user, db)
        df = await _load_investigation_data(investigation)

        # Create export configuration
        config = _create_export_config(request_data, MLFrameworkType.TENSORFLOW)

        # Perform export with access control
        ml_service = get_subscription_aware_ml_service()
        result = await ml_service.export_for_framework_with_access_check(
            df, config, billing_context
        )

        return {
            "status": "success",
            "framework": "tensorflow",
            "tier": billing_context.subscription_tier.value,
            "export_details": result,
            "warnings": validation_result.get("warnings", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TensorFlow export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TensorFlow export failed"
        )

@router.post("/export/pytorch",
             summary="Export to PyTorch (Growth+ Tiers)",
             description="Export data for PyTorch training. Available on Growth and Scale tiers.")
async def export_pytorch_with_access_control(
    request_data: SubscriptionAwareFrameworkExportRequest,
    investigation_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export data in PyTorch format with subscription-based access control
    """
    try:
        billing_context = get_billing_context_from_request(request)

        # Check PyTorch access (blocked on Develop tier)
        if not check_framework_access(billing_context.subscription_tier, MLFrameworkType.PYTORCH):
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "PyTorch Access Denied",
                    "message": f"PyTorch is not available on the {billing_context.subscription_tier.value} plan",
                    "current_tier": billing_context.subscription_tier.value,
                    "required_tier": "growth",
                    "upgrade_benefits": [
                        "Access to PyTorch deep learning framework",
                        "Advanced neural network architectures",
                        "GPU acceleration support",
                        "PyTorch Lightning integration"
                    ]
                }
            )

        # Validate other parameters
        validation_result = await _validate_ml_request(
            request_data, MLFrameworkType.PYTORCH, billing_context
        )

        if not validation_result["allowed"]:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Request exceeds plan limits",
                    "violations": validation_result["violations"],
                    "tier": validation_result["tier"]
                }
            )

        # Get investigation data
        investigation = await _get_user_investigation(investigation_id, current_user, db)
        df = await _load_investigation_data(investigation)

        # Create export configuration
        config = _create_export_config(request_data, MLFrameworkType.PYTORCH)

        # Perform export with access control
        ml_service = get_subscription_aware_ml_service()
        result = await ml_service.export_for_framework_with_access_check(
            df, config, billing_context
        )

        return {
            "status": "success",
            "framework": "pytorch",
            "tier": billing_context.subscription_tier.value,
            "export_details": result,
            "warnings": validation_result.get("warnings", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PyTorch export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PyTorch export failed"
        )

@router.post("/validate-operation", response_model=MLValidationResponse)
async def validate_ml_operation(
    operation_params: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Validate ML operation parameters against subscription limits
    """
    try:
        billing_context = get_billing_context_from_request(request)
        ml_service = get_subscription_aware_ml_service()

        validation_result = await ml_service.validate_ml_operation(
            operation_type="general",
            parameters=operation_params,
            billing_context=billing_context
        )

        # Add recommendations based on violations
        recommendations = []
        if not validation_result["allowed"]:
            recommendations = _generate_upgrade_recommendations(
                validation_result["violations"],
                billing_context.subscription_tier
            )

        return MLValidationResponse(
            allowed=validation_result["allowed"],
            violations=validation_result["violations"],
            warnings=validation_result["warnings"],
            tier=validation_result["tier"],
            recommendations=recommendations
        )

    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Validation failed"
        )

@router.post("/advanced/ensemble",
             summary="Advanced Ensemble Methods (Growth+ Tiers)",
             description="Create advanced ensemble models. Available on Growth and Scale tiers.")
async def create_advanced_ensemble(
    ensemble_config: Dict[str, Any],
    investigation_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create advanced ensemble models with subscription-based access control
    """
    try:
        billing_context = get_billing_context_from_request(request)

        # Check ensemble feature access
        if not check_feature_access(billing_context.subscription_tier, MLFeatureType.ADVANCED_ENSEMBLE):
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Advanced Ensemble Access Denied",
                    "message": f"Advanced ensemble methods are not available on the {billing_context.subscription_tier.value} plan",
                    "current_tier": billing_context.subscription_tier.value,
                    "required_tier": "growth",
                    "upgrade_benefits": [
                        "Advanced ensemble methods (stacking, blending)",
                        "Automated model selection",
                        "Cross-validation optimization",
                        "Better prediction accuracy"
                    ]
                }
            )

        # Implementation would continue here...
        return {
            "status": "success",
            "message": "Ensemble model creation started",
            "tier": billing_context.subscription_tier.value,
            "feature": "advanced_ensemble"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ensemble creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ensemble creation failed"
        )

# ==================== HELPER FUNCTIONS ====================

async def _validate_ml_request(
    request_data: SubscriptionAwareFrameworkExportRequest,
    framework: MLFrameworkType,
    billing_context: BillingContext
) -> Dict[str, Any]:
    """Validate ML request against subscription limits"""

    ml_service = get_subscription_aware_ml_service()

    # Extract parameters for validation
    parameters = {
        "model_parameters": request_data.estimated_model_parameters or 0,
        "training_time_minutes": request_data.estimated_training_time_minutes or 0,
        "required_frameworks": [framework.value],
        "required_features": []
    }

    # Add required features based on request
    if request_data.enable_optimization:
        parameters["required_features"].append("model_optimization")
    if request_data.enable_ensemble:
        parameters["required_features"].append("advanced_ensemble")
    if request_data.enable_distributed:
        parameters["required_features"].append("distributed_training")
    if request_data.use_custom_kernels:
        parameters["required_features"].append("custom_kernels")

    return await ml_service.validate_ml_operation(
        operation_type="framework_export",
        parameters=parameters,
        billing_context=billing_context
    )

async def _get_user_investigation(investigation_id: str, user: User, db: AsyncSession):
    """Get investigation belonging to user"""
    investigation = await db.get(DataInvestigation, investigation_id)
    if not investigation or investigation.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found"
        )
    return investigation

async def _load_investigation_data(investigation):
    """Load data from investigation"""
    file_processor = FileProcessor()
    return await file_processor.load_investigation_data(investigation)

def _create_export_config(
    request_data: SubscriptionAwareFrameworkExportRequest,
    framework: MLFrameworkType
) -> ExportConfiguration:
    """Create export configuration from request"""

    return ExportConfiguration(
        framework=framework,
        task_type=TaskType(request_data.task_type) if request_data.task_type else TaskType.CLASSIFICATION,
        target_column=request_data.target_column,
        feature_columns=request_data.feature_columns,
        batch_size=request_data.batch_size,
        max_length=request_data.max_length,
        # Advanced features (will be validated by enforcement layer)
        optimize_model=request_data.enable_optimization,
        ensemble_methods=request_data.enable_ensemble,
        distributed=request_data.enable_distributed,
        use_custom_kernels=request_data.use_custom_kernels
    )

def _generate_upgrade_recommendations(
    violations: List[Dict[str, Any]],
    current_tier: SubscriptionTier
) -> List[str]:
    """Generate upgrade recommendations based on violations"""

    recommendations = []

    # Framework violations
    for violation in violations:
        if violation.get("type") == "framework":
            blocked_fw = violation.get("blocked")
            if blocked_fw == "pytorch":
                recommendations.append("Upgrade to Growth tier for PyTorch access")
            elif blocked_fw in ["lightgbm", "catboost"]:
                recommendations.append("Upgrade to Growth tier for advanced gradient boosting")

        # Feature violations
        elif violation.get("type") == "feature":
            blocked_feat = violation.get("blocked")
            if blocked_feat == "distributed_training":
                recommendations.append("Upgrade to Scale tier for distributed training")
            elif blocked_feat == "advanced_ensemble":
                recommendations.append("Upgrade to Growth tier for ensemble methods")

        # Parameter violations
        elif violation.get("parameter"):
            param = violation.get("parameter")
            if current_tier == SubscriptionTier.DEVELOP:
                recommendations.append("Upgrade to Growth tier for higher limits")
            elif current_tier == SubscriptionTier.GROWTH:
                recommendations.append("Upgrade to Scale tier for enterprise limits")

    return list(set(recommendations))  # Remove duplicates

# Export router
__all__ = ['router']