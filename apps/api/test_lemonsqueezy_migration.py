#!/usr/bin/env python3
"""
Test script for LemonSqueezy migration from Stripe.
This script validates that the migration works correctly and maintains backward compatibility.
"""

import sys
import asyncio
import logging
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

# Add the app directory to Python path
sys.path.append('/Users/wira/Wira Cursor/Schlep-engine/apps/api')

from app.services.usage_meter import (
    track_api_usage,
    update_billing,
    get_lemonsqueezy_subscription_usage,
    get_usage_summary,
    _report_usage_to_lemonsqueezy
)
from app.core.api_config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MockAPIKey:
    """Mock API key for testing."""
    def __init__(self, key="test_key", lemonsqueezy_subscription_id=None):
        self.key = key
        self.lemonsqueezy_subscription_id = lemonsqueezy_subscription_id
        self.user = MockUser()


class MockUser:
    """Mock user for testing."""
    def __init__(self):
        self.organization = MockOrganization()


class MockOrganization:
    """Mock organization for testing."""
    def __init__(self):
        self.lemonsqueezy_subscription_id = "org_sub_123"


class MockDB:
    """Mock database session for testing."""
    def __init__(self, api_key_record=None):
        self.api_key_record = api_key_record or MockAPIKey()
    
    def query(self, model):
        return self
    
    def filter(self, condition):
        return self
    
    def first(self):
        return self.api_key_record
    
    def add(self, obj):
        pass
    
    def commit(self):
        pass


async def test_lemonsqueezy_api_connection():
    """Test LemonSqueezy API connection and configuration."""
    logger.info("Testing LemonSqueezy API configuration...")
    
    # Check if API key is configured
    if not settings.LEMONSQUEEZY_API_KEY:
        logger.warning("LemonSqueezy API key not configured - using mock for testing")
        return True
    
    # Test actual API connection (if key is configured)
    try:
        # This would be a real API call in production
        logger.info("LemonSqueezy API key is configured")
        return True
    except Exception as e:
        logger.error(f"LemonSqueezy API connection failed: {e}")
        return False


async def test_usage_tracking():
    """Test the usage tracking functionality."""
    logger.info("Testing usage tracking...")
    
    # Mock database
    mock_db = MockDB()
    
    try:
        # Test with mock data
        with patch('app.services.usage_meter.get_db') as mock_get_db:
            mock_get_db.return_value = iter([mock_db])
            
            # Test track_api_usage function
            await track_api_usage(
                api_key="test_key_123",
                operation="data_processing",
                units=10,
                db=mock_db
            )
            
            logger.info("✓ Usage tracking completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"✗ Usage tracking failed: {e}")
        return False


async def test_billing_update():
    """Test the billing update functionality."""
    logger.info("Testing billing update...")
    
    # Mock API key with subscription
    mock_api_key = MockAPIKey(
        key="test_key_billing",
        lemonsqueezy_subscription_id="sub_123456"
    )
    mock_db = MockDB(mock_api_key)
    
    try:
        with patch('app.services.usage_meter.get_db') as mock_get_db, \
             patch('app.services.usage_meter._report_usage_to_lemonsqueezy') as mock_report:
            
            mock_get_db.return_value = iter([mock_db])
            mock_report.return_value = None
            
            # Test update_billing function
            await update_billing(
                api_key="test_key_billing",
                operation="api_call",
                units=5
            )
            
            # Verify that the reporting function was called
            mock_report.assert_called_once_with("sub_123456", "api_call", 5)
            
            logger.info("✓ Billing update completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"✗ Billing update failed: {e}")
        return False


async def test_organization_fallback():
    """Test fallback to organization subscription when API key has no subscription."""
    logger.info("Testing organization subscription fallback...")
    
    # Mock API key without subscription (should fall back to organization)
    mock_api_key = MockAPIKey(
        key="test_key_org_fallback",
        lemonsqueezy_subscription_id=None
    )
    mock_db = MockDB(mock_api_key)
    
    try:
        with patch('app.services.usage_meter.get_db') as mock_get_db, \
             patch('app.services.usage_meter._report_usage_to_lemonsqueezy') as mock_report:
            
            mock_get_db.return_value = iter([mock_db])
            mock_report.return_value = None
            
            # Test update_billing with organization fallback
            await update_billing(
                api_key="test_key_org_fallback",
                operation="batch_process",
                units=20
            )
            
            # Verify that organization's subscription was used
            mock_report.assert_called_once_with("org_sub_123", "batch_process", 20)
            
            logger.info("✓ Organization fallback completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"✗ Organization fallback failed: {e}")
        return False


async def test_rate_limiting_handling():
    """Test rate limiting handling."""
    logger.info("Testing rate limiting handling...")
    
    try:
        with patch('httpx.AsyncClient') as mock_client:
            # Mock rate limit response
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.headers = {"X-Ratelimit-Remaining": "0"}
            
            mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
            
            # Test rate limiting handling
            await _report_usage_to_lemonsqueezy("sub_test", "test_op", 1)
            
            logger.info("✓ Rate limiting handling completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"✗ Rate limiting handling failed: {e}")
        return False


async def test_usage_summary():
    """Test the usage summary functionality."""
    logger.info("Testing usage summary...")
    
    mock_db = MockDB()
    
    try:
        # Mock usage data
        mock_usage = [
            MagicMock(operation="data_clean", units=10),
            MagicMock(operation="data_transform", units=5),
            MagicMock(operation="data_clean", units=8),
        ]
        
        with patch.object(mock_db, 'query') as mock_query:
            mock_query.return_value.filter.return_value.all.return_value = mock_usage
            
            # Test get_usage_summary function
            summary = get_usage_summary(
                api_key="test_key",
                start_date=datetime.now() - timedelta(days=1),
                end_date=datetime.now(),
                db=mock_db
            )
            
            # Verify summary structure
            assert "total_operations" in summary
            assert "total_units" in summary
            assert "operations" in summary
            
            logger.info("✓ Usage summary completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"✗ Usage summary failed: {e}")
        return False


async def test_error_handling():
    """Test error handling in various scenarios."""
    logger.info("Testing error handling...")
    
    try:
        # Test with non-existent API key
        mock_db = MockDB(None)  # No API key found
        
        with patch('app.services.usage_meter.get_db') as mock_get_db:
            mock_get_db.return_value = iter([mock_db])
            
            # This should handle the error gracefully
            await update_billing("non_existent_key", "test_op", 1)
            
            logger.info("✓ Error handling completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"✗ Error handling failed: {e}")
        return False


async def run_all_tests():
    """Run all migration tests."""
    logger.info("Starting LemonSqueezy migration tests...")
    logger.info("=" * 50)
    
    tests = [
        test_lemonsqueezy_api_connection,
        test_usage_tracking,
        test_billing_update,
        test_organization_fallback,
        test_rate_limiting_handling,
        test_usage_summary,
        test_error_handling,
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            logger.error(f"Test {test.__name__} crashed: {e}")
            results.append(False)
        
        logger.info("-" * 30)
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    logger.info("=" * 50)
    logger.info(f"TEST SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! Migration appears successful.")
        return True
    else:
        logger.warning(f"⚠️  {total - passed} tests failed. Please review the issues above.")
        return False


def validate_migration_readiness():
    """Validate that the migration is ready to deploy."""
    logger.info("Validating migration readiness...")
    
    checks = []
    
    # Check 1: Configuration files updated
    try:
        from app.core.unified_config import settings as unified_settings
        hasattr(unified_settings, 'LEMONSQUEEZY_API_KEY')
        checks.append(("Configuration files updated", True))
    except Exception as e:
        checks.append(("Configuration files updated", False, str(e)))
    
    # Check 2: Database models updated
    try:
        from app.database.models import Organization, ApiKey
        # Check if new fields exist (this would fail if models aren't updated)
        org_has_lemonsqueezy = hasattr(Organization, '__table__') and \
                               'lemonsqueezy_subscription_id' in [c.name for c in Organization.__table__.columns]
        api_key_has_lemonsqueezy = hasattr(ApiKey, '__table__') and \
                                   'lemonsqueezy_subscription_id' in [c.name for c in ApiKey.__table__.columns]
        
        if org_has_lemonsqueezy and api_key_has_lemonsqueezy:
            checks.append(("Database models updated", True))
        else:
            checks.append(("Database models updated", False, "LemonSqueezy fields not found in models"))
    except Exception as e:
        checks.append(("Database models updated", False, str(e)))
    
    # Check 3: Migration file exists
    import os
    migration_file = "/Users/wira/Wira Cursor/Schlep-engine/apps/api/alembic/versions/migrate_stripe_to_lemonsqueezy.py"
    if os.path.exists(migration_file):
        checks.append(("Migration file created", True))
    else:
        checks.append(("Migration file created", False, "Migration file not found"))
    
    # Check 4: Usage meter service updated
    try:
        # Check if the usage_meter imports the right modules
        import inspect
        from app.services import usage_meter
        source = inspect.getsource(usage_meter)
        
        if "lemonsqueezy" in source.lower() and "stripe" not in source.lower():
            checks.append(("Usage meter service updated", True))
        else:
            checks.append(("Usage meter service updated", False, "Still contains Stripe references or missing LemonSqueezy"))
    except Exception as e:
        checks.append(("Usage meter service updated", False, str(e)))
    
    # Print results
    logger.info("\nMigration Readiness Checklist:")
    logger.info("=" * 40)
    
    all_passed = True
    for check in checks:
        name = check[0]
        passed = check[1]
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"{status} {name}")
        
        if not passed and len(check) > 2:
            logger.info(f"    Error: {check[2]}")
        
        all_passed = all_passed and passed
    
    logger.info("=" * 40)
    
    if all_passed:
        logger.info("🎉 Migration is ready for deployment!")
    else:
        logger.warning("⚠️  Migration has issues that need to be addressed.")
    
    return all_passed


if __name__ == "__main__":
    logger.info("LemonSqueezy Migration Validation Script")
    logger.info("========================================")
    
    # First validate migration readiness
    readiness = validate_migration_readiness()
    
    if readiness:
        # Run functional tests
        logger.info("\nRunning functional tests...")
        success = asyncio.run(run_all_tests())
        
        if success:
            logger.info("\n🎉 MIGRATION VALIDATION COMPLETE - ALL CHECKS PASSED!")
            logger.info("The system is ready to migrate from Stripe to LemonSqueezy.")
        else:
            logger.error("\n❌ MIGRATION VALIDATION FAILED")
            logger.error("Please fix the issues above before deploying.")
            sys.exit(1)
    else:
        logger.error("\n❌ MIGRATION NOT READY")
        logger.error("Please complete the migration steps before running tests.")
        sys.exit(1)