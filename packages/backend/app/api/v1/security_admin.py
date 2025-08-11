"""
Security Administration API

Provides admin endpoints for managing security features at runtime.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
from pydantic import BaseModel

from app.database.connection import get_db
from app.auth.enhanced_dependencies import get_current_active_user
from app.database.models import User
from app.core.security_config import (
    security_manager, 
    get_security_status,
    enable_security_feature,
    disable_security_feature,
    SecurityEnvironment
)
from app.middleware import require_permission, Permission, audit_log_endpoint

router = APIRouter()


class SecurityFeatureToggle(BaseModel):
    """Request model for toggling security features"""
    feature: str
    enabled: bool
    reason: str = "Admin action"


class SecurityEnvironmentConfig(BaseModel):
    """Request model for applying environment configuration"""
    environment: SecurityEnvironment
    force: bool = False


@router.get("/status")
@audit_log_endpoint(operation_type="security_admin_status", sensitivity="high")
@require_permission(Permission.SECURITY_ADMIN)
async def get_security_features_status(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get current status of all security features.
    
    Returns detailed information about:
    - Which features are enabled/disabled
    - Configuration source (environment, runtime override, etc.)
    - Environment-specific recommendations
    """
    return get_security_status()


@router.post("/toggle-feature")
@audit_log_endpoint(
    operation_type="security_feature_toggle", 
    sensitivity="critical",
    log_request_body=True
)
@require_permission(Permission.SECURITY_ADMIN)
async def toggle_security_feature(
    toggle_request: SecurityFeatureToggle,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Enable or disable a security feature at runtime.
    
    This creates a runtime override that takes precedence over
    environment and default configurations.
    """
    valid_features = [
        'encryption', 'audit_logging', 'mfa', 'advanced_monitoring',
        'permission_checking', 'rate_limiting', 'security_headers',
        'pii_detection', 'compliance_tracking', 'data_classification'
    ]
    
    if toggle_request.feature not in valid_features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid feature. Valid features: {valid_features}"
        )
    
    # Apply the change
    if toggle_request.enabled:
        enable_security_feature(toggle_request.feature)
    else:
        disable_security_feature(toggle_request.feature)
    
    # Get updated status
    updated_status = get_security_status()
    
    return {
        "message": f"Security feature '{toggle_request.feature}' {'enabled' if toggle_request.enabled else 'disabled'}",
        "feature": toggle_request.feature,
        "enabled": toggle_request.enabled,
        "reason": toggle_request.reason,
        "updated_by": str(user.id),
        "current_status": updated_status['features'][toggle_request.feature]
    }


@router.post("/apply-environment-config")
@audit_log_endpoint(
    operation_type="security_environment_config",
    sensitivity="critical",
    log_request_body=True
)
@require_permission(Permission.SECURITY_ADMIN)
async def apply_environment_configuration(
    config_request: SecurityEnvironmentConfig,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Apply environment-specific security configuration.
    
    This will override current settings with environment defaults.
    Use force=true to apply even in production.
    """
    current_env = security_manager._environment
    
    # Safety check for production
    if current_env == "production" and not config_request.force:
        if config_request.environment != SecurityEnvironment.PRODUCTION:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot apply non-production config in production environment. Use force=true to override."
            )
    
    # Apply the configuration
    security_manager.apply_environment_config(config_request.environment)
    
    # Get updated status
    updated_status = get_security_status()
    
    return {
        "message": f"Applied {config_request.environment.value} security configuration",
        "environment": config_request.environment.value,
        "current_environment": current_env,
        "applied_by": str(user.id),
        "force_applied": config_request.force,
        "updated_features": updated_status['features']
    }


@router.post("/reset-feature/{feature}")
@audit_log_endpoint(
    operation_type="security_feature_reset",
    sensitivity="high"
)
@require_permission(Permission.SECURITY_ADMIN)
async def reset_security_feature(
    feature: str,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Reset a security feature to its default configuration.
    
    This removes any runtime overrides and returns the feature
    to its environment/default configuration.
    """
    valid_features = [
        'encryption', 'audit_logging', 'mfa', 'advanced_monitoring',
        'permission_checking', 'rate_limiting', 'security_headers',
        'pii_detection', 'compliance_tracking', 'data_classification'
    ]
    
    if feature not in valid_features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid feature. Valid features: {valid_features}"
        )
    
    # Reset the feature
    security_manager.reset_feature(feature)
    
    # Get updated status
    updated_status = get_security_status()
    
    return {
        "message": f"Security feature '{feature}' reset to default configuration",
        "feature": feature,
        "reset_by": str(user.id),
        "current_status": updated_status['features'][feature]
    }


@router.get("/recommendations")
@audit_log_endpoint(operation_type="security_recommendations")
@require_permission(Permission.SECURITY_ADMIN)
async def get_security_recommendations(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get security configuration recommendations for current environment.
    """
    recommendations = security_manager.get_feature_recommendations()
    
    return {
        "environment": security_manager._environment,
        "recommendations": recommendations,
        "recommendation_count": len(recommendations)
    }


@router.get("/feature/{feature}/status")
@audit_log_endpoint(operation_type="security_feature_status")
@require_permission(Permission.SECURITY_ADMIN)
async def get_feature_status(
    feature: str,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get detailed status of a specific security feature.
    """
    all_status = get_security_status()
    
    if feature not in all_status['features']:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security feature '{feature}' not found"
        )
    
    return {
        "feature": feature,
        "status": all_status['features'][feature],
        "environment": all_status['environment']
    }


# Add to main router
def include_security_admin_routes(main_router: APIRouter):
    """Include security admin routes in main API router"""
    main_router.include_router(
        router,
        prefix="/security-admin",
        tags=["Security Administration"]
    ) 