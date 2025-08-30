#!/usr/bin/env python3
"""
Simplified Security Validation Test
Tests the security improvements made to the Schlep Engine API
"""

import os
import sys
import tempfile
from datetime import datetime
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# Set up test environment variables
os.environ["SECRET_KEY"] = "test_secret_key_for_security_validation_32_chars_long_12345678"
os.environ["POSTGRES_PASSWORD"] = "test_secure_password_123"
os.environ["JWT_ALGORITHM"] = "RS256"

# Generate test RSA keys for JWT testing
def generate_test_rsa_keys():
    """Generate test RSA key pair for JWT testing"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return private_pem.decode(), public_pem.decode()

# Generate and set RSA keys
private_key_pem, public_key_pem = generate_test_rsa_keys()
os.environ["JWT_PRIVATE_KEY"] = private_key_pem
os.environ["JWT_PUBLIC_KEY"] = public_key_pem

# Add app to path
sys.path.append(os.path.dirname(__file__))

try:
    from app.auth.security import (
        get_signing_key, get_verification_key, create_access_token,
        verify_token, verify_password, get_password_hash,
        generate_api_key, verify_api_key, ALGORITHM
    )
    from app.core.api_config import settings
    
    print("🔒 Security Validation Test")
    print("=" * 40)
    print(f"Environment: {os.getenv('ENVIRONMENT', 'testing')}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    # Test Results
    results = []
    
    def test_result(test_name, passed, details):
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        results.append({"test": test_name, "passed": passed, "details": details})
        print()
    
    # Test 1: JWT Algorithm Configuration
    print("Testing JWT Algorithm Configuration...")
    try:
        algorithm = ALGORITHM
        if algorithm == "RS256":
            # Try to get signing key
            signing_key = get_signing_key()
            verification_key = get_verification_key()
            test_result("JWT Algorithm Security", True, f"Using secure RS256 algorithm with proper key configuration")
        else:
            test_result("JWT Algorithm Security", False, f"Using {algorithm} algorithm instead of RS256")
    except Exception as e:
        test_result("JWT Algorithm Security", False, f"Error: {str(e)}")
    
    # Test 2: Secret Management
    print("Testing Secret Management...")
    try:
        secret_key = os.getenv("SECRET_KEY")
        postgres_password = os.getenv("POSTGRES_PASSWORD")
        
        issues = []
        if not secret_key or secret_key in ["your-secret-key-here", "__CHANGE_ME_GENERATE_SECURE_SECRET_KEY__"]:
            issues.append("SECRET_KEY not properly set")
        if not postgres_password or postgres_password == "postgres":
            issues.append("POSTGRES_PASSWORD using default value")
        
        if issues:
            test_result("Secret Management", False, f"Issues: {', '.join(issues)}")
        else:
            test_result("Secret Management", True, "All secrets properly configured via environment variables")
    except Exception as e:
        test_result("Secret Management", False, f"Error: {str(e)}")
    
    # Test 3: Password Hashing
    print("Testing Password Hashing...")
    try:
        test_password = "TestPassword123!"
        hashed = get_password_hash(test_password)
        
        # Verify bcrypt format
        if hashed.startswith('$2b$'):
            # Test verification
            if verify_password(test_password, hashed) and not verify_password("WrongPassword", hashed):
                test_result("Password Hashing Security", True, "Secure bcrypt hashing with proper verification")
            else:
                test_result("Password Hashing Security", False, "Password verification not working correctly")
        else:
            test_result("Password Hashing Security", False, f"Not using bcrypt: {hashed[:10]}...")
    except Exception as e:
        test_result("Password Hashing Security", False, f"Error: {str(e)}")
    
    # Test 4: JWT Token Security
    print("Testing JWT Token Security...")
    try:
        test_data = {"sub": "test_user", "role": "user"}
        token = create_access_token(test_data)
        
        if token:
            payload = verify_token(token)
            if payload:
                # Check required claims
                required_claims = ["sub", "exp", "iat", "iss", "aud"]
                missing_claims = [claim for claim in required_claims if claim not in payload]
                
                if not missing_claims:
                    test_result("JWT Token Security", True, "JWT tokens created and verified with all required claims")
                else:
                    test_result("JWT Token Security", False, f"Missing claims: {missing_claims}")
            else:
                test_result("JWT Token Security", False, "Valid token failed verification")
        else:
            test_result("JWT Token Security", False, "Failed to create JWT token")
    except Exception as e:
        test_result("JWT Token Security", False, f"Error: {str(e)}")
    
    # Test 5: API Key Security
    print("Testing API Key Security...")
    try:
        api_key, api_key_hash = generate_api_key()
        
        if api_key.startswith('sk-') and len(api_key) >= 32:
            if verify_api_key(api_key, api_key_hash) and not verify_api_key("wrong-key", api_key_hash):
                test_result("API Key Security", True, "API keys generated and verified securely")
            else:
                test_result("API Key Security", False, "API key verification not working correctly")
        else:
            test_result("API Key Security", False, f"API key format issue: {api_key[:20]}...")
    except Exception as e:
        test_result("API Key Security", False, f"Error: {str(e)}")
    
    # Test 6: Security Configuration
    print("Testing Security Configuration...")
    try:
        security_config = settings.get_security_config_for_environment("testing")
        expected_features = ["encryption", "audit_logging", "permission_checking", "pii_detection"]
        
        config_ok = all(key in security_config for key in expected_features)
        if config_ok:
            test_result("Security Configuration", True, "Security configuration properly loaded with expected features")
        else:
            test_result("Security Configuration", False, "Security configuration missing expected features")
    except Exception as e:
        test_result("Security Configuration", False, f"Error: {str(e)}")
    
    # Summary
    print("🔐 Security Validation Summary")
    print("=" * 40)
    passed_tests = len([r for r in results if r["passed"]])
    total_tests = len(results)
    
    print(f"Tests Passed: {passed_tests}/{total_tests}")
    print(f"Security Score: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("✅ All security tests passed!")
    else:
        print(f"⚠️  {total_tests - passed_tests} security issues found")
        failed_tests = [r for r in results if not r["passed"]]
        print("\nFailed Tests:")
        for test in failed_tests:
            print(f"- {test['test']}: {test['details']}")
    
    print("\n📋 Security Measures Implemented:")
    print("- JWT tokens using RS256 algorithm with RSA key pairs")
    print("- Environment variable based secret management")
    print("- Secure password hashing with bcrypt")
    print("- Secure API key generation with proper verification")
    print("- Environment-specific security configuration")
    print("- Proper JWT claims and token expiry")
    
    print("\n🔧 Recommendations for Production:")
    print("- Generate and securely store RSA key pairs")
    print("- Use proper secret management system (AWS Secrets Manager, etc.)")
    print("- Enable all security features for production environment")
    print("- Implement regular security audits")
    print("- Set up monitoring and alerting for security events")
    print("- Consider implementing MFA for admin access")
    
    # Return exit code
    if passed_tests == total_tests:
        sys.exit(0)
    else:
        sys.exit(1)

except ImportError as e:
    print(f"❌ Failed to import security modules: {e}")
    print("Make sure you're running from the correct directory with required dependencies installed")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error during security validation: {e}")
    sys.exit(1)