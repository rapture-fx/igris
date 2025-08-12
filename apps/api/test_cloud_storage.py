#!/usr/bin/env python3
"""
Test script for cloud storage and CDN configuration
"""

import os
import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

def test_imports():
    """Test if all required modules can be imported"""
    try:
        from app.core.cloud_storage import GoogleCloudStorage
        from app.core.cdn_config import CDNConfig
        from app.services.file_management_service import FileManagementService
        print("✓ All modules imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_configuration():
    """Test configuration loading"""
    try:
        from app.core.unified_config import get_settings
        settings = get_settings()
        
        print(f"✓ Cloud storage enabled: {settings.cloud_storage_enabled}")
        print(f"✓ CDN enabled: {settings.cdn_enabled}")
        print(f"✓ GCS bucket: {settings.gcs_bucket_name}")
        
        return True
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        return False

def test_gcs_connection():
    """Test GCS connection"""
    try:
        from app.core.cloud_storage import GoogleCloudStorage
        storage = GoogleCloudStorage()
        result = storage.test_connection()
        print(f"✓ GCS connection test: {result}")
        return result
    except Exception as e:
        print(f"✗ GCS connection error: {e}")
        return False

def test_cdn_configuration():
    """Test CDN configuration"""
    try:
        from app.core.cdn_config import CDNConfig
        cdn = CDNConfig()
        result = cdn.test_configuration()
        print(f"✓ CDN configuration test: {result}")
        return result
    except Exception as e:
        print(f"✗ CDN configuration error: {e}")
        return False

def main():
    """Run all tests"""
    print("Testing cloud storage and CDN configuration...\n")
    
    tests = [
        ("Module Imports", test_imports),
        ("Configuration Loading", test_configuration),
        ("GCS Connection", test_gcs_connection),
        ("CDN Configuration", test_cdn_configuration),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"Running {test_name}...")
        result = test_func()
        results.append((test_name, result))
        print()
    
    # Summary
    print("Test Summary:")
    print("=" * 50)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Cloud storage and CDN are ready to use.")
    else:
        print("⚠️  Some tests failed. Please check the configuration.")

if __name__ == "__main__":
    main()
