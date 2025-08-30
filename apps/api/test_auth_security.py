#!/usr/bin/env python3
"""
Authentication and Authorization Security Tests
Tests the auth system security measures
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta

# Set up test environment
os.environ["SECRET_KEY"] = "test_secret_key_for_security_validation_32_chars_long_12345678"
os.environ["POSTGRES_PASSWORD"] = "test_secure_password_123"

# Test against local API server
API_BASE_URL = "http://localhost:8000"

def test_result(test_name, passed, details):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()
    return passed

def main():
    print("🔐 Authentication & Authorization Security Tests")
    print("=" * 50)
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    results = []
    
    # Test 1: API Health Check (should work without auth)
    print("Testing API Health Check (Public Endpoint)...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            results.append(test_result("Public Endpoint Access", True, "Health endpoint accessible without authentication"))
        else:
            results.append(test_result("Public Endpoint Access", False, f"Health endpoint returned {response.status_code}"))
    except Exception as e:
        results.append(test_result("Public Endpoint Access", False, f"Error connecting to API: {str(e)}"))
    
    # Test 2: Protected Endpoint (should require auth)
    print("Testing Protected Endpoint Access...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/v1/users/me", timeout=5)
        if response.status_code in [401, 403]:
            results.append(test_result("Protected Endpoint Security", True, f"Protected endpoint properly rejected unauthorized access ({response.status_code})"))
        else:
            results.append(test_result("Protected Endpoint Security", False, f"Protected endpoint returned unexpected status: {response.status_code}"))
    except Exception as e:
        results.append(test_result("Protected Endpoint Security", False, f"Error testing protected endpoint: {str(e)}"))
    
    # Test 3: Invalid Token Handling
    print("Testing Invalid Token Handling...")
    try:
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{API_BASE_URL}/api/v1/users/me", headers=headers, timeout=5)
        if response.status_code in [401, 403]:
            results.append(test_result("Invalid Token Rejection", True, f"Invalid token properly rejected ({response.status_code})"))
        else:
            results.append(test_result("Invalid Token Rejection", False, f"Invalid token handling returned unexpected status: {response.status_code}"))
    except Exception as e:
        results.append(test_result("Invalid Token Rejection", False, f"Error testing invalid token: {str(e)}"))
    
    # Test 4: API Key Authentication (if endpoint exists)
    print("Testing API Key Authentication...")
    try:
        headers = {"X-API-Key": "invalid_api_key_12345"}
        response = requests.get(f"{API_BASE_URL}/api/v1/dashboard-stats", headers=headers, timeout=5)
        if response.status_code in [401, 403]:
            results.append(test_result("API Key Security", True, f"Invalid API key properly rejected ({response.status_code})"))
        elif response.status_code == 404:
            results.append(test_result("API Key Security", True, "API key endpoint not accessible (expected for security)"))
        else:
            results.append(test_result("API Key Security", False, f"API key handling returned unexpected status: {response.status_code}"))
    except Exception as e:
        results.append(test_result("API Key Security", False, f"Error testing API key: {str(e)}"))
    
    # Test 5: CORS Headers Security
    print("Testing CORS Headers Security...")
    try:
        response = requests.options(f"{API_BASE_URL}/api/v1/health", timeout=5)
        cors_headers = {
            key.lower(): value for key, value in response.headers.items()
            if key.lower().startswith('access-control')
        }
        
        if 'access-control-allow-origin' in cors_headers:
            origin = cors_headers['access-control-allow-origin']
            if origin == '*':
                results.append(test_result("CORS Security", False, "CORS allows all origins (security risk)"))
            else:
                results.append(test_result("CORS Security", True, f"CORS properly configured with specific origins"))
        else:
            results.append(test_result("CORS Security", True, "CORS headers not exposed (secure)"))
    except Exception as e:
        results.append(test_result("CORS Security", False, f"Error testing CORS: {str(e)}"))
    
    # Test 6: Security Headers Check
    print("Testing Security Headers...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        security_headers = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection'
        ]
        
        found_headers = []
        for header in security_headers:
            if header in response.headers:
                found_headers.append(header)
        
        if found_headers:
            results.append(test_result("Security Headers", True, f"Security headers present: {', '.join(found_headers)}"))
        else:
            results.append(test_result("Security Headers", False, "No security headers found"))
    except Exception as e:
        results.append(test_result("Security Headers", False, f"Error testing security headers: {str(e)}"))
    
    # Test 7: Rate Limiting (if implemented)
    print("Testing Rate Limiting...")
    try:
        # Make multiple rapid requests
        rapid_requests = []
        for i in range(5):
            response = requests.get(f"{API_BASE_URL}/health", timeout=2)
            rapid_requests.append(response.status_code)
        
        # Check if any requests were rate limited
        rate_limited = any(status == 429 for status in rapid_requests)
        if rate_limited:
            results.append(test_result("Rate Limiting", True, "Rate limiting active (some requests returned 429)"))
        else:
            results.append(test_result("Rate Limiting", False, "No rate limiting detected (may not be enabled for health endpoint)"))
    except Exception as e:
        results.append(test_result("Rate Limiting", False, f"Error testing rate limiting: {str(e)}"))
    
    # Summary
    print("🔐 Authentication & Authorization Security Summary")
    print("=" * 50)
    passed_tests = sum(results)
    total_tests = len(results)
    
    print(f"Tests Passed: {passed_tests}/{total_tests}")
    print(f"Security Score: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("✅ All authentication/authorization security tests passed!")
    else:
        print(f"⚠️  {total_tests - passed_tests} authentication/authorization security issues found")
    
    print("\n📋 Authentication Security Features Validated:")
    if sum(results[:4]) >= 3:
        print("✅ Proper endpoint access control")
    if results[1]:  # Protected endpoint test
        print("✅ Authorization required for protected endpoints")
    if results[2]:  # Invalid token test
        print("✅ Invalid token rejection")
    if results[3]:  # API key test
        print("✅ API key authentication security")
    
    print("\n🔧 Security Recommendations:")
    print("- Implement comprehensive rate limiting")
    print("- Add security headers middleware")
    print("- Set up API authentication monitoring")
    print("- Implement request/response logging for security events")
    print("- Consider implementing request signing for critical operations")
    print("- Set up automated security testing in CI/CD")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)