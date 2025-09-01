#!/usr/bin/env python3
"""
Quick Dependency Validation Script
==================================

Fast validation of critical dependencies and imports.
"""

import sys
import importlib
from typing import List, Dict, Tuple

def test_core_imports() -> Tuple[List[str], List[str]]:
    """Test importing core modules"""
    success = []
    failures = []
    
    core_modules = {
        'fastapi': 'FastAPI web framework',
        'pydantic': 'Data validation', 
        'sqlalchemy': 'Database ORM',
        'redis': 'Redis client',
        'celery': 'Background tasks',
        'numpy': 'Numerical computing',
        'pandas': 'Data manipulation',
        'requests': 'HTTP client',
        'cryptography': 'Cryptographic functions',
        'transformers': 'ML transformers',
    }
    
    for module_name, description in core_modules.items():
        try:
            importlib.import_module(module_name)
            success.append(f"✅ {module_name} ({description}) - OK")
        except ImportError as e:
            failures.append(f"❌ {module_name} ({description}) - {str(e)}")
    
    return success, failures

def test_version_conflicts() -> List[str]:
    """Test for known version conflicts"""
    issues = []
    
    try:
        import requests
        import urllib3
        import certifi
        
        # Check versions
        requests_version = requests.__version__
        urllib3_version = urllib3.__version__
        certifi_version = certifi.__version__
        
        print(f"✅ requests: {requests_version}")
        print(f"✅ urllib3: {urllib3_version}") 
        print(f"✅ certifi: {certifi_version}")
        
        # Basic compatibility test
        response = requests.get('https://httpbin.org/get', timeout=5)
        if response.status_code == 200:
            print("✅ HTTP requests working")
        else:
            issues.append(f"HTTP request failed: {response.status_code}")
            
    except Exception as e:
        issues.append(f"Network/HTTP issue: {e}")
    
    return issues

def test_security_modules() -> List[str]:
    """Test security-related modules"""
    issues = []
    
    try:
        from cryptography.fernet import Fernet
        from passlib.context import CryptContext
        import hashlib
        
        # Test basic cryptographic operations
        key = Fernet.generate_key()
        fernet = Fernet(key)
        test_data = b"test encryption"
        encrypted = fernet.encrypt(test_data)
        decrypted = fernet.decrypt(encrypted)
        
        if decrypted == test_data:
            print("✅ Cryptography working")
        else:
            issues.append("Cryptography encryption/decryption failed")
            
        # Test password hashing
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        test_password = "test123"
        hashed = pwd_context.hash(test_password)
        
        if pwd_context.verify(test_password, hashed):
            print("✅ Password hashing working")
        else:
            issues.append("Password hashing verification failed")
            
    except Exception as e:
        issues.append(f"Security module issue: {e}")
    
    return issues

def main():
    """Run quick validation"""
    print("🚀 Schlep-engine Quick Dependency Validation")
    print("=" * 50)
    
    # Test core imports
    print("\n📦 Testing Core Module Imports:")
    success, failures = test_core_imports()
    
    for msg in success:
        print(msg)
    for msg in failures:
        print(msg)
    
    # Test version conflicts
    print("\n🔍 Testing Network Dependencies:")
    network_issues = test_version_conflicts()
    for issue in network_issues:
        print(f"❌ {issue}")
    
    # Test security modules
    print("\n🔐 Testing Security Dependencies:")
    security_issues = test_security_modules()
    for issue in security_issues:
        print(f"❌ {issue}")
    
    # Summary
    total_issues = len(failures) + len(network_issues) + len(security_issues)
    
    print("\n" + "=" * 50)
    print(f"📊 VALIDATION SUMMARY:")
    print(f"✅ Successful imports: {len(success)}")
    print(f"❌ Total issues: {total_issues}")
    
    if total_issues == 0:
        print("🎉 All critical dependencies are working!")
        return True
    else:
        print("⚠️  Some issues detected - check output above")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)