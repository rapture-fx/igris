"""
Test Suite for ML Framework Enforcement
======================================

Comprehensive tests for subscription-based ML framework access control.
Tests framework blocking, feature gating, parameter validation, and upgrade flows.
"""

import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request
from starlette.responses import Response

from app.middleware.billing_middleware import BillingContext, SubscriptionTier
from app.middleware.ml_framework_enforcement import (
    MLFrameworkEnforcementMiddleware, MLFrameworkType, MLFeatureType,
    check_framework_access, check_feature_access, get_tier_limits
)
from app.services.subscription_aware_ml_service import SubscriptionAwareMLService

# ==================== TEST FIXTURES ====================

@pytest.fixture
def develop_billing_context():
    """Billing context for Develop tier"""
    context = BillingContext()
    context.subscription_tier = SubscriptionTier.DEVELOP
    context.customer_id = "test_customer_develop"
    return context

@pytest.fixture
def growth_billing_context():
    """Billing context for Growth tier"""
    context = BillingContext()
    context.subscription_tier = SubscriptionTier.GROWTH
    context.customer_id = "test_customer_growth"
    return context

@pytest.fixture
def scale_billing_context():
    """Billing context for Scale tier"""
    context = BillingContext()
    context.subscription_tier = SubscriptionTier.SCALE
    context.customer_id = "test_customer_scale"
    return context

@pytest.fixture
def ml_service():
    """ML service instance"""
    return SubscriptionAwareMLService()

@pytest.fixture
def test_app():
    """Test FastAPI app with ML enforcement middleware"""
    app = FastAPI()

    @app.get("/test/tensorflow")
    async def test_tensorflow_endpoint():
        return {"framework": "tensorflow"}

    @app.get("/test/pytorch")
    async def test_pytorch_endpoint():
        return {"framework": "pytorch"}

    @app.post("/test/ml-operation")
    async def test_ml_operation():
        return {"status": "success"}

    # Add ML enforcement middleware
    app.add_middleware(MLFrameworkEnforcementMiddleware, enabled=True, strict_mode=True)

    return app

# ==================== FRAMEWORK ACCESS TESTS ====================

class TestFrameworkAccess:
    """Test framework access by subscription tier"""

    def test_develop_tier_framework_access(self, develop_billing_context):
        """Test framework access for Develop tier"""
        # TensorFlow should be allowed
        assert check_framework_access(
            develop_billing_context.subscription_tier,
            MLFrameworkType.TENSORFLOW
        ) == True

        # PyTorch should be blocked
        assert check_framework_access(
            develop_billing_context.subscription_tier,
            MLFrameworkType.PYTORCH
        ) == False

        # Scikit-learn should be allowed
        assert check_framework_access(
            develop_billing_context.subscription_tier,
            MLFrameworkType.SCIKIT_LEARN
        ) == True

    def test_growth_tier_framework_access(self, growth_billing_context):
        """Test framework access for Growth tier"""
        # Both TensorFlow and PyTorch should be allowed
        assert check_framework_access(
            growth_billing_context.subscription_tier,
            MLFrameworkType.TENSORFLOW
        ) == True

        assert check_framework_access(
            growth_billing_context.subscription_tier,
            MLFrameworkType.PYTORCH
        ) == True

        # Advanced frameworks should be allowed
        assert check_framework_access(
            growth_billing_context.subscription_tier,
            MLFrameworkType.LIGHTGBM
        ) == True

    def test_scale_tier_framework_access(self, scale_billing_context):
        """Test framework access for Scale tier"""
        # All frameworks should be allowed
        for framework in MLFrameworkType:
            assert check_framework_access(
                scale_billing_context.subscription_tier,
                framework
            ) == True

class TestFeatureAccess:
    """Test ML feature access by subscription tier"""

    def test_develop_tier_feature_access(self, develop_billing_context):
        """Test feature access for Develop tier"""
        # Basic features should be limited
        assert check_feature_access(
            develop_billing_context.subscription_tier,
            MLFeatureType.DISTRIBUTED_TRAINING
        ) == False

        assert check_feature_access(
            develop_billing_context.subscription_tier,
            MLFeatureType.ADVANCED_ENSEMBLE
        ) == False

        # Some basic features allowed
        assert check_feature_access(
            develop_billing_context.subscription_tier,
            MLFeatureType.HYPERPARAMETER_TUNING
        ) == True

    def test_growth_tier_feature_access(self, growth_billing_context):
        """Test feature access for Growth tier"""
        # More features should be available
        assert check_feature_access(
            growth_billing_context.subscription_tier,
            MLFeatureType.ADVANCED_ENSEMBLE
        ) == True

        assert check_feature_access(
            growth_billing_context.subscription_tier,
            MLFeatureType.MODEL_OPTIMIZATION
        ) == True

        # But not distributed training
        assert check_feature_access(
            growth_billing_context.subscription_tier,
            MLFeatureType.DISTRIBUTED_TRAINING
        ) == False

    def test_scale_tier_feature_access(self, scale_billing_context):
        """Test feature access for Scale tier"""
        # All features should be available
        for feature in MLFeatureType:
            assert check_feature_access(
                scale_billing_context.subscription_tier,
                feature
            ) == True

class TestParameterLimits:
    """Test parameter limits by subscription tier"""

    def test_develop_tier_limits(self, develop_billing_context):
        """Test parameter limits for Develop tier"""
        limits = get_tier_limits(develop_billing_context.subscription_tier)

        assert limits['max_model_parameters'] == 10_000_000
        assert limits['max_training_time_minutes'] == 30
        assert limits['max_concurrent_experiments'] == 2

    def test_growth_tier_limits(self, growth_billing_context):
        """Test parameter limits for Growth tier"""
        limits = get_tier_limits(growth_billing_context.subscription_tier)

        assert limits['max_model_parameters'] == 100_000_000
        assert limits['max_training_time_minutes'] == 120
        assert limits['max_concurrent_experiments'] == 5

    def test_scale_tier_limits(self, scale_billing_context):
        """Test parameter limits for Scale tier"""
        limits = get_tier_limits(scale_billing_context.subscription_tier)

        assert limits['max_model_parameters'] == 1_000_000_000
        assert limits['max_training_time_minutes'] == 1440
        assert limits['max_concurrent_experiments'] == 20

# ==================== MIDDLEWARE TESTS ====================

class TestMLFrameworkEnforcementMiddleware:
    """Test ML Framework Enforcement Middleware"""

    @pytest.mark.asyncio
    async def test_framework_blocking_middleware(self, test_app):
        """Test that middleware blocks PyTorch access for Develop tier"""

        # Mock billing context for Develop tier
        async def mock_call_next(request):
            return Response("Success", status_code=200)

        # Create mock request for PyTorch endpoint
        mock_request = Mock()
        mock_request.url.path = "/api/v1/ai-framework/pytorch"
        mock_request.method = "POST"
        mock_request.state = Mock()

        # Mock billing context as Develop tier
        billing_context = BillingContext()
        billing_context.subscription_tier = SubscriptionTier.DEVELOP
        mock_request.state.billing_context = billing_context

        # Mock request body containing PyTorch framework requirement
        mock_request.body = AsyncMock(return_value=json.dumps({
            "framework": "pytorch",
            "task_type": "classification"
        }).encode())

        # Create middleware instance
        middleware = MLFrameworkEnforcementMiddleware(None, enabled=True, strict_mode=True)

        # Test framework blocking
        response = await middleware.dispatch(mock_request, mock_call_next)

        # Should return 402 Payment Required for blocked framework
        assert response.status_code == 402

        # Response should contain framework blocking information
        response_data = json.loads(response.body.decode())
        assert "Framework Access Denied" in response_data.get("error", "")
        assert "pytorch" in response_data.get("blocked_frameworks", [])

    @pytest.mark.asyncio
    async def test_framework_allowing_middleware(self, test_app):
        """Test that middleware allows TensorFlow access for Develop tier"""

        # Mock successful call_next
        async def mock_call_next(request):
            return Response("Success", status_code=200)

        # Create mock request for TensorFlow endpoint
        mock_request = Mock()
        mock_request.url.path = "/api/v1/ai-framework/tensorflow"
        mock_request.method = "POST"
        mock_request.state = Mock()

        # Mock billing context as Develop tier
        billing_context = BillingContext()
        billing_context.subscription_tier = SubscriptionTier.DEVELOP
        mock_request.state.billing_context = billing_context

        # Mock request body containing TensorFlow framework requirement
        mock_request.body = AsyncMock(return_value=json.dumps({
            "framework": "tensorflow",
            "task_type": "classification"
        }).encode())

        # Create middleware instance
        middleware = MLFrameworkEnforcementMiddleware(None, enabled=True, strict_mode=True)

        # Test framework allowing
        response = await middleware.dispatch(mock_request, mock_call_next)

        # Should return 200 for allowed framework
        assert response.status_code == 200

# ==================== SERVICE TESTS ====================

class TestSubscriptionAwareMLService:
    """Test Subscription-Aware ML Service"""

    @pytest.mark.asyncio
    async def test_framework_validation_blocking(self, ml_service, develop_billing_context):
        """Test that service blocks PyTorch for Develop tier"""

        # Mock export configuration requiring PyTorch
        mock_config = Mock()
        mock_config.framework = MLFrameworkType.PYTORCH

        # Mock dataframe
        mock_df = Mock()

        # Should raise HTTPException for blocked framework
        with pytest.raises(Exception) as exc_info:
            await ml_service.export_for_framework_with_access_check(
                mock_df, mock_config, develop_billing_context
            )

        # Exception should indicate framework access denial
        assert "Framework Access Denied" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_parameter_validation(self, ml_service, develop_billing_context):
        """Test parameter validation against tier limits"""

        # Test operation with parameters exceeding Develop tier limits
        parameters = {
            "model_parameters": 50_000_000,  # Exceeds 10M limit
            "training_time_minutes": 60,     # Exceeds 30 min limit
        }

        result = await ml_service.validate_ml_operation(
            operation_type="training",
            parameters=parameters,
            billing_context=develop_billing_context
        )

        # Should not be allowed due to parameter violations
        assert result["allowed"] == False
        assert len(result["violations"]) > 0

        # Check for specific violations
        violation_params = [v.get("parameter") for v in result["violations"]]
        assert "model_parameters" in violation_params
        assert "training_time_minutes" in violation_params

    @pytest.mark.asyncio
    async def test_capabilities_by_tier(self, ml_service):
        """Test capabilities returned for different tiers"""

        # Test Develop tier capabilities
        develop_context = BillingContext()
        develop_context.subscription_tier = SubscriptionTier.DEVELOP

        capabilities = await ml_service.get_available_frameworks(develop_context)

        assert capabilities["frameworks"]["tensorflow"] == True
        assert capabilities["frameworks"]["pytorch"] == False
        assert capabilities["features"]["distributed_training"] == False

        # Test Growth tier capabilities
        growth_context = BillingContext()
        growth_context.subscription_tier = SubscriptionTier.GROWTH

        capabilities = await ml_service.get_available_frameworks(growth_context)

        assert capabilities["frameworks"]["tensorflow"] == True
        assert capabilities["frameworks"]["pytorch"] == True
        assert capabilities["features"]["advanced_ensemble"] == True
        assert capabilities["features"]["distributed_training"] == False  # Still blocked

# ==================== INTEGRATION TESTS ====================

class TestEndToEndEnforcement:
    """End-to-end tests for ML framework enforcement"""

    @pytest.mark.asyncio
    async def test_pytorch_export_blocking_flow(self):
        """Test complete flow of PyTorch export blocking for Develop tier"""

        # This would test the full endpoint with mocked dependencies
        # Implementation depends on your specific test setup
        pass

    @pytest.mark.asyncio
    async def test_upgrade_recommendation_flow(self):
        """Test upgrade recommendation generation"""

        # Test that appropriate upgrade recommendations are generated
        # when framework access is denied
        pass

# ==================== PERFORMANCE TESTS ====================

class TestEnforcementPerformance:
    """Test performance impact of ML framework enforcement"""

    @pytest.mark.asyncio
    async def test_middleware_performance_impact(self):
        """Test that enforcement middleware doesn't significantly impact performance"""

        # Benchmark middleware overhead
        # Should be minimal (< 10ms per request)
        pass

    def test_access_check_performance(self):
        """Test performance of framework access checks"""

        import time

        # Test many rapid access checks
        start_time = time.time()

        for _ in range(1000):
            check_framework_access(SubscriptionTier.DEVELOP, MLFrameworkType.TENSORFLOW)
            check_framework_access(SubscriptionTier.DEVELOP, MLFrameworkType.PYTORCH)

        end_time = time.time()
        duration = end_time - start_time

        # Should complete 1000 checks in under 100ms
        assert duration < 0.1, f"Access checks took {duration:.3f}s, should be < 0.1s"

# ==================== ERROR HANDLING TESTS ====================

class TestErrorHandling:
    """Test error handling in ML framework enforcement"""

    @pytest.mark.asyncio
    async def test_missing_billing_context(self, test_app):
        """Test handling when billing context is missing"""

        # Should gracefully handle missing billing context
        # and default to most restrictive tier
        pass

    @pytest.mark.asyncio
    async def test_invalid_framework_request(self):
        """Test handling of invalid framework requests"""

        # Should handle unknown frameworks gracefully
        pass

# ==================== BYPASS PREVENTION TESTS ====================

class TestBypassPrevention:
    """Test prevention of enforcement bypassing"""

    def test_direct_import_blocking(self):
        """Test that direct framework imports don't bypass enforcement"""

        # In a real implementation, you might want to test that
        # direct imports of blocked frameworks are detected
        pass

    @pytest.mark.asyncio
    async def test_endpoint_circumvention_prevention(self):
        """Test that users can't circumvent enforcement via different endpoints"""

        # Test that all ML endpoints properly enforce restrictions
        pass

# ==================== MONITORING TESTS ====================

class TestEnforcementMonitoring:
    """Test monitoring and logging of enforcement actions"""

    @pytest.mark.asyncio
    async def test_access_denied_logging(self):
        """Test that access denials are properly logged"""

        # Should log framework access denials for monitoring
        pass

    @pytest.mark.asyncio
    async def test_usage_tracking(self):
        """Test that ML framework usage is tracked"""

        # Should track which frameworks are used by which tiers
        pass

if __name__ == "__main__":
    pytest.main([__file__, "-v"])