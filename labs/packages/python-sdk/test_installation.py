#!/usr/bin/env python3
"""
Installation test for Igris-engine Python SDK

This script tests that the SDK can be imported and initialized correctly.
Run this after installing the package to verify everything is working.
"""

import sys
import traceback


def test_basic_import():
    """Test basic package import"""
    print("Testing basic import...")
    try:
        import igris
        print(f"✓ Successfully imported igris v{igris.__version__}")
        return True
    except Exception as e:
        print(f"✗ Failed to import igris: {e}")
        return False


def test_client_import():
    """Test client class import"""
    print("Testing client import...")
    try:
        from igris import IgrisClient
        print("✓ Successfully imported IgrisClient")
        return True
    except Exception as e:
        print(f"✗ Failed to import IgrisClient: {e}")
        return False


def test_sync_client_import():
    """Test synchronous client import"""
    print("Testing sync client import...")
    try:
        from igris.client.main import IgrisClientSync
        print("✓ Successfully imported IgrisClientSync")
        return True
    except Exception as e:
        print(f"✗ Failed to import IgrisClientSync: {e}")
        return False


def test_models_import():
    """Test model imports"""
    print("Testing models import...")
    try:
        from igris.models import (
            APIResponse, PaginationInfo, TokenResponse, UserInfo,
            DataProcessingRequest, MLPipelineConfig, AnalyticsQuery
        )
        print("✓ Successfully imported core models")
        return True
    except Exception as e:
        print(f"✗ Failed to import models: {e}")
        return False


def test_exceptions_import():
    """Test exception imports"""
    print("Testing exceptions import...")
    try:
        from igris.exceptions import (
            IgrisError, APIError, AuthenticationError, RateLimitError
        )
        print("✓ Successfully imported exceptions")
        return True
    except Exception as e:
        print(f"✗ Failed to import exceptions: {e}")
        return False


def test_client_initialization():
    """Test client initialization without API key"""
    print("Testing client initialization...")
    try:
        from igris import IgrisClient
        
        # Test initialization without API key (should work)
        client = IgrisClient()
        print("✓ Successfully initialized client (no API key)")
        
        # Test initialization with dummy API key
        client_with_key = IgrisClient(api_key="test-key")
        print("✓ Successfully initialized client (with API key)")
        
        # Test SDK info
        info = client.get_sdk_info()
        print(f"✓ SDK Info: {info['name']} v{info['version']}")
        
        return True
    except Exception as e:
        print(f"✗ Failed to initialize client: {e}")
        traceback.print_exc()
        return False


def test_sync_client_initialization():
    """Test sync client initialization"""
    print("Testing sync client initialization...")
    try:
        from igris.client.main import IgrisClientSync
        
        client = IgrisClientSync(api_key="test-key")
        print("✓ Successfully initialized sync client")
        return True
    except Exception as e:
        print(f"✗ Failed to initialize sync client: {e}")
        return False


def test_auth_manager():
    """Test authentication manager"""
    print("Testing authentication manager...")
    try:
        from igris.auth import AuthManager
        
        auth_manager = AuthManager(api_key="test-key")
        print("✓ Successfully created AuthManager")
        
        # Test authentication status
        is_auth = auth_manager.is_authenticated
        print(f"✓ Authentication status: {is_auth}")
        
        # Test auth headers
        headers = auth_manager.get_auth_headers()
        print(f"✓ Auth headers: {list(headers.keys())}")
        
        return True
    except Exception as e:
        print(f"✗ Failed to test AuthManager: {e}")
        return False


def test_utilities():
    """Test utility modules"""
    print("Testing utilities...")
    try:
        from igris.utils import RetryConfig, RetryStrategy
        from igris.utils.logging import setup_logging, get_logger
        
        # Test retry config
        retry_config = RetryConfig(max_retries=3)
        print(f"✓ RetryConfig: max_retries={retry_config.max_retries}")
        
        # Test logging
        logger = get_logger("test")
        print("✓ Successfully created logger")
        
        return True
    except Exception as e:
        print(f"✗ Failed to test utilities: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Igris-engine Python SDK Installation Test")
    print("=" * 60)
    print(f"Python version: {sys.version}")
    print("=" * 60)
    
    tests = [
        test_basic_import,
        test_client_import,
        test_sync_client_import,
        test_models_import,
        test_exceptions_import,
        test_client_initialization,
        test_sync_client_initialization,
        test_auth_manager,
        test_utilities
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"✗ Test {test.__name__} crashed: {e}")
            traceback.print_exc()
            print()
    
    print("=" * 60)
    print(f"Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! The SDK is ready to use.")
        print("\nNext steps:")
        print("1. Get your API key from https://app.igris-inertial.com/settings/api-keys")
        print("2. Check out the examples in the examples/ directory")
        print("3. Read the documentation at https://docs.igris-inertial.com/sdk/python")
        return 0
    else:
        print("❌ Some tests failed. Please check your installation.")
        print("\nTroubleshooting:")
        print("1. Make sure you installed the package: pip install igris-inertial")
        print("2. Check for missing dependencies: pip install httpx aiohttp pydantic")
        print("3. Try reinstalling: pip uninstall igris-inertial && pip install igris-inertial")
        return 1


if __name__ == "__main__":
    sys.exit(main())