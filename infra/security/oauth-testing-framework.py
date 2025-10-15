#!/usr/bin/env python3
"""
OAuth Testing Framework for Schlep Engine
Comprehensive testing suite for OAuth security and functionality
"""

import asyncio
import aiohttp
import pytest
import json
import secrets
import hashlib
import base64
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class OAuthTestResult:
    test_name: str
    passed: bool
    details: str
    duration_ms: int
    error_message: Optional[str] = None


@dataclass
class PKCETestData:
    code_verifier: str
    code_challenge: str
    code_challenge_method: str = "S256"


class OAuthTestingFramework:
    """Comprehensive OAuth testing framework"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def generate_pkce_pair(self) -> PKCETestData:
        """Generate PKCE code verifier and challenge"""
        # Generate code verifier (43-128 characters)
        code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        
        # Generate code challenge using S256 method
        digest = hashlib.sha256(code_verifier.encode('utf-8')).digest()
        code_challenge = base64.urlsafe_b64encode(digest).decode('utf-8').rstrip('=')
        
        return PKCETestData(
            code_verifier=code_verifier,
            code_challenge=code_challenge,
            code_challenge_method="S256"
        )
    
    def generate_state_parameter(self) -> str:
        """Generate secure state parameter"""
        return secrets.token_urlsafe(32)
    
    async def test_oauth_authorization_endpoint(self, provider: str) -> OAuthTestResult:
        """Test OAuth authorization endpoint"""
        start_time = time.time()
        
        try:
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/authorize"
            
            async with self.session.get(url) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    required_fields = ['authorization_url', 'state', 'provider']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        return OAuthTestResult(
                            test_name=f"OAuth Authorization - {provider}",
                            passed=False,
                            details=f"Missing fields: {missing_fields}",
                            duration_ms=duration_ms,
                            error_message="Invalid response structure"
                        )
                    
                    # Validate authorization URL
                    auth_url = data['authorization_url']
                    if provider == 'google' and 'accounts.google.com' not in auth_url:
                        return OAuthTestResult(
                            test_name=f"OAuth Authorization - {provider}",
                            passed=False,
                            details="Invalid Google authorization URL",
                            duration_ms=duration_ms,
                            error_message="Authorization URL validation failed"
                        )
                    
                    # Validate state parameter
                    state = data['state']
                    if len(state) < 32:
                        return OAuthTestResult(
                            test_name=f"OAuth Authorization - {provider}",
                            passed=False,
                            details=f"State parameter too short: {len(state)} characters",
                            duration_ms=duration_ms,
                            error_message="Weak state parameter"
                        )
                    
                    return OAuthTestResult(
                        test_name=f"OAuth Authorization - {provider}",
                        passed=True,
                        details=f"Authorization URL generated successfully, state length: {len(state)}",
                        duration_ms=duration_ms
                    )
                else:
                    error_text = await response.text()
                    return OAuthTestResult(
                        test_name=f"OAuth Authorization - {provider}",
                        passed=False,
                        details=f"HTTP {response.status}: {error_text}",
                        duration_ms=duration_ms,
                        error_message=f"HTTP error {response.status}"
                    )
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"OAuth Authorization - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_oauth_callback_security(self, provider: str) -> OAuthTestResult:
        """Test OAuth callback security measures"""
        start_time = time.time()
        
        try:
            # Test invalid state parameter
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/callback"
            params = {
                'code': 'test_code',
                'state': 'invalid_state'
            }
            
            async with self.session.get(url, params=params) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Should return error for invalid state
                if response.status in [400, 401, 403]:
                    return OAuthTestResult(
                        test_name=f"OAuth Callback Security - {provider}",
                        passed=True,
                        details=f"Properly rejected invalid state (HTTP {response.status})",
                        duration_ms=duration_ms
                    )
                else:
                    return OAuthTestResult(
                        test_name=f"OAuth Callback Security - {provider}",
                        passed=False,
                        details=f"Did not reject invalid state (HTTP {response.status})",
                        duration_ms=duration_ms,
                        error_message="Security vulnerability: invalid state accepted"
                    )
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"OAuth Callback Security - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_pkce_validation(self, provider: str) -> OAuthTestResult:
        """Test PKCE validation"""
        start_time = time.time()
        
        try:
            # Generate PKCE data
            pkce_data = self.generate_pkce_pair()
            
            # Test callback with mismatched code verifier
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/callback"
            params = {
                'code': 'test_code',
                'state': self.generate_state_parameter(),
                'code_verifier': 'invalid_verifier'
            }
            
            async with self.session.get(url, params=params) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Should return error for invalid code verifier
                if response.status in [400, 401]:
                    return OAuthTestResult(
                        test_name=f"PKCE Validation - {provider}",
                        passed=True,
                        details=f"Properly rejected invalid code verifier (HTTP {response.status})",
                        duration_ms=duration_ms
                    )
                else:
                    return OAuthTestResult(
                        test_name=f"PKCE Validation - {provider}",
                        passed=False,
                        details=f"Did not reject invalid code verifier (HTTP {response.status})",
                        duration_ms=duration_ms,
                        error_message="PKCE validation not implemented or failing"
                    )
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"PKCE Validation - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_rate_limiting(self, provider: str) -> OAuthTestResult:
        """Test OAuth rate limiting"""
        start_time = time.time()
        
        try:
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/authorize"
            
            # Make multiple rapid requests
            tasks = []
            for _ in range(15):  # Attempt to exceed rate limit (usually 10/minute)
                task = self.session.get(url)
                tasks.append(task)
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check for rate limiting
            rate_limited = False
            for response in responses:
                if hasattr(response, 'status') and response.status == 429:
                    rate_limited = True
                    await response.release()
                elif hasattr(response, 'status'):
                    await response.release()
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            if rate_limited:
                return OAuthTestResult(
                    test_name=f"OAuth Rate Limiting - {provider}",
                    passed=True,
                    details="Rate limiting is properly implemented",
                    duration_ms=duration_ms
                )
            else:
                return OAuthTestResult(
                    test_name=f"OAuth Rate Limiting - {provider}",
                    passed=False,
                    details="Rate limiting not detected",
                    duration_ms=duration_ms,
                    error_message="Rate limiting may not be implemented"
                )
                
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"OAuth Rate Limiting - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_csrf_protection(self, provider: str) -> OAuthTestResult:
        """Test CSRF protection mechanisms"""
        start_time = time.time()
        
        try:
            # Test 1: Missing state parameter
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/callback"
            params = {
                'code': 'test_code'
                # Missing state parameter
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status not in [400, 401, 403]:
                    duration_ms = int((time.time() - start_time) * 1000)
                    return OAuthTestResult(
                        test_name=f"CSRF Protection - {provider}",
                        passed=False,
                        details=f"Missing state parameter accepted (HTTP {response.status})",
                        duration_ms=duration_ms,
                        error_message="CSRF vulnerability: missing state parameter accepted"
                    )
            
            # Test 2: Reused state parameter (should fail on second use)
            state = self.generate_state_parameter()
            
            # First request with state
            params = {'code': 'test_code1', 'state': state}
            async with self.session.get(url, params=params) as response:
                pass  # Don't care about the result, just consume the state
            
            # Second request with same state (should fail)
            params = {'code': 'test_code2', 'state': state}
            async with self.session.get(url, params=params) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status in [400, 401, 403]:
                    return OAuthTestResult(
                        test_name=f"CSRF Protection - {provider}",
                        passed=True,
                        details="State parameter reuse properly rejected",
                        duration_ms=duration_ms
                    )
                else:
                    return OAuthTestResult(
                        test_name=f"CSRF Protection - {provider}",
                        passed=False,
                        details=f"State parameter reuse accepted (HTTP {response.status})",
                        duration_ms=duration_ms,
                        error_message="CSRF vulnerability: state parameter reuse allowed"
                    )
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"CSRF Protection - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_redirect_uri_validation(self, provider: str) -> OAuthTestResult:
        """Test redirect URI validation"""
        start_time = time.time()
        
        try:
            # Test with malicious redirect URI
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/authorize"
            malicious_redirect = "https://malicious-site.com/steal-tokens"
            
            params = {
                'redirect_uri': malicious_redirect
            }
            
            async with self.session.get(url, params=params) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                if response.status in [400, 403]:
                    return OAuthTestResult(
                        test_name=f"Redirect URI Validation - {provider}",
                        passed=True,
                        details="Malicious redirect URI properly rejected",
                        duration_ms=duration_ms
                    )
                else:
                    return OAuthTestResult(
                        test_name=f"Redirect URI Validation - {provider}",
                        passed=False,
                        details=f"Malicious redirect URI accepted (HTTP {response.status})",
                        duration_ms=duration_ms,
                        error_message="Security vulnerability: redirect URI validation insufficient"
                    )
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"Redirect URI Validation - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_token_security(self, provider: str) -> OAuthTestResult:
        """Test token security practices"""
        start_time = time.time()
        
        try:
            # This is a mock test - in real implementation you'd need valid tokens
            # Testing token format validation and security
            
            url = f"{self.base_url}/api/v1/auth/oauth/{provider}/callback"
            
            # Test with suspicious token patterns
            suspicious_tokens = [
                'test_token',
                'fake_token', 
                'demo_token',
                'x' * 10,  # Too short
                ''  # Empty
            ]
            
            security_issues = 0
            
            for token in suspicious_tokens:
                params = {
                    'code': token,
                    'state': self.generate_state_parameter()
                }
                
                async with self.session.get(url, params=params) as response:
                    # If suspicious tokens are not properly rejected, it's a security issue
                    if response.status not in [400, 401, 403]:
                        security_issues += 1
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            if security_issues == 0:
                return OAuthTestResult(
                    test_name=f"Token Security - {provider}",
                    passed=True,
                    details="Suspicious token patterns properly rejected",
                    duration_ms=duration_ms
                )
            else:
                return OAuthTestResult(
                    test_name=f"Token Security - {provider}",
                    passed=False,
                    details=f"{security_issues} suspicious tokens accepted",
                    duration_ms=duration_ms,
                    error_message="Token validation insufficient"
                )
                
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name=f"Token Security - {provider}",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def test_oauth_account_operations(self) -> OAuthTestResult:
        """Test OAuth account operations"""
        start_time = time.time()
        
        try:
            # Test getting OAuth accounts (requires authentication)
            url = f"{self.base_url}/api/v1/auth/oauth/accounts"
            
            async with self.session.get(url) as response:
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Should require authentication
                if response.status in [401, 403]:
                    return OAuthTestResult(
                        test_name="OAuth Account Operations",
                        passed=True,
                        details="OAuth account operations properly protected",
                        duration_ms=duration_ms
                    )
                else:
                    return OAuthTestResult(
                        test_name="OAuth Account Operations",
                        passed=False,
                        details=f"OAuth accounts accessible without auth (HTTP {response.status})",
                        duration_ms=duration_ms,
                        error_message="Authentication bypass vulnerability"
                    )
                    
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return OAuthTestResult(
                test_name="OAuth Account Operations",
                passed=False,
                details=f"Exception: {str(e)}",
                duration_ms=duration_ms,
                error_message=str(e)
            )
    
    async def run_comprehensive_tests(self, providers: List[str] = None) -> Dict[str, Any]:
        """Run comprehensive OAuth security tests"""
        if providers is None:
            providers = ['google', 'github']
        
        logger.info(f"Starting comprehensive OAuth tests for providers: {providers}")
        
        test_results = []
        
        # Run tests for each provider
        for provider in providers:
            logger.info(f"Testing {provider} OAuth...")
            
            # Test authorization endpoint
            result = await self.test_oauth_authorization_endpoint(provider)
            test_results.append(result)
            
            # Test callback security
            result = await self.test_oauth_callback_security(provider)
            test_results.append(result)
            
            # Test PKCE validation
            result = await self.test_pkce_validation(provider)
            test_results.append(result)
            
            # Test rate limiting
            result = await self.test_rate_limiting(provider)
            test_results.append(result)
            
            # Test CSRF protection
            result = await self.test_csrf_protection(provider)
            test_results.append(result)
            
            # Test redirect URI validation
            result = await self.test_redirect_uri_validation(provider)
            test_results.append(result)
            
            # Test token security
            result = await self.test_token_security(provider)
            test_results.append(result)
        
        # Test account operations
        result = await self.test_oauth_account_operations()
        test_results.append(result)
        
        # Generate test report
        passed_tests = sum(1 for r in test_results if r.passed)
        total_tests = len(test_results)
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        # Categorize results by severity
        critical_failures = [r for r in test_results if not r.passed and 
                           ('CSRF' in r.test_name or 'Security' in r.test_name)]
        
        report = {
            "test_summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": total_tests - passed_tests,
                "success_rate": round(success_rate, 2),
                "critical_failures": len(critical_failures)
            },
            "test_results": [
                {
                    "test_name": r.test_name,
                    "passed": r.passed,
                    "details": r.details,
                    "duration_ms": r.duration_ms,
                    "error_message": r.error_message
                }
                for r in test_results
            ],
            "security_assessment": self._assess_security_posture(test_results),
            "recommendations": self._generate_test_recommendations(test_results),
            "generated_at": datetime.now().isoformat()
        }
        
        return report
    
    def _assess_security_posture(self, test_results: List[OAuthTestResult]) -> Dict[str, Any]:
        """Assess overall security posture based on test results"""
        critical_tests = [
            'CSRF Protection',
            'Token Security', 
            'Redirect URI Validation',
            'OAuth Callback Security'
        ]
        
        critical_failures = [
            r for r in test_results 
            if not r.passed and any(ct in r.test_name for ct in critical_tests)
        ]
        
        high_priority_tests = [
            'PKCE Validation',
            'OAuth Rate Limiting'
        ]
        
        high_priority_failures = [
            r for r in test_results
            if not r.passed and any(hp in r.test_name for hp in high_priority_tests)
        ]
        
        if critical_failures:
            security_level = "CRITICAL_ISSUES"
            risk_level = "HIGH"
        elif high_priority_failures:
            security_level = "MEDIUM_RISK"
            risk_level = "MEDIUM"
        elif any(not r.passed for r in test_results):
            security_level = "LOW_RISK"
            risk_level = "LOW"
        else:
            security_level = "SECURE"
            risk_level = "MINIMAL"
        
        return {
            "security_level": security_level,
            "risk_level": risk_level,
            "critical_failures": len(critical_failures),
            "high_priority_failures": len(high_priority_failures),
            "recommendations_count": len(critical_failures) + len(high_priority_failures),
            "production_ready": len(critical_failures) == 0 and len(high_priority_failures) <= 1
        }
    
    def _generate_test_recommendations(self, test_results: List[OAuthTestResult]) -> List[str]:
        """Generate recommendations based on test failures"""
        recommendations = []
        
        failed_tests = [r for r in test_results if not r.passed]
        
        for result in failed_tests:
            if 'CSRF' in result.test_name:
                recommendations.append("🚨 CRITICAL: Implement proper CSRF protection with secure state parameters")
                recommendations.append("   • Generate cryptographically secure state parameters (32+ characters)")
                recommendations.append("   • Store state parameters in Redis with expiration")
                recommendations.append("   • Validate and consume state parameters only once")
            
            elif 'Token Security' in result.test_name:
                recommendations.append("🔐 HIGH: Implement robust token validation")
                recommendations.append("   • Validate token formats and lengths")
                recommendations.append("   • Reject suspicious token patterns")
                recommendations.append("   • Implement token encryption at rest")
            
            elif 'Redirect URI' in result.test_name:
                recommendations.append("🌐 HIGH: Strengthen redirect URI validation")
                recommendations.append("   • Implement strict whitelist of allowed redirect URIs")
                recommendations.append("   • Validate redirect URIs against registered values")
                recommendations.append("   • Reject wildcards and dynamic redirect URIs")
            
            elif 'PKCE' in result.test_name:
                recommendations.append("🔧 MEDIUM: Implement PKCE validation")
                recommendations.append("   • Add PKCE support to OAuth flows")
                recommendations.append("   • Validate code_challenge and code_verifier")
                recommendations.append("   • Use S256 method for code challenge")
            
            elif 'Rate Limiting' in result.test_name:
                recommendations.append("⚡ MEDIUM: Implement OAuth rate limiting")
                recommendations.append("   • Set appropriate rate limits per provider")
                recommendations.append("   • Use sliding window rate limiting")
                recommendations.append("   • Monitor and adjust limits based on usage")
        
        if not recommendations:
            recommendations = [
                "✅ All OAuth security tests passed!",
                "🚀 Your OAuth implementation appears secure for production use",
                "📊 Continue monitoring OAuth flows and security events",
                "🔄 Regularly rotate OAuth credentials and secrets"
            ]
        
        return recommendations
    
    def save_test_report(self, report: Dict[str, Any], filename: Optional[str] = None) -> str:
        """Save test report to file"""
        if filename is None:
            filename = f"oauth_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        return filename
    
    def print_test_report(self, report: Dict[str, Any]):
        """Print formatted test report"""
        print("\n" + "=" * 60)
        print("🧪 OAuth Security Testing Report")
        print("=" * 60)
        
        summary = report['test_summary']
        print(f"\n📊 Test Summary:")
        print(f"   • Total Tests: {summary['total_tests']}")
        print(f"   • Passed: {summary['passed_tests']} ✅")
        print(f"   • Failed: {summary['failed_tests']} ❌")
        print(f"   • Success Rate: {summary['success_rate']}%")
        print(f"   • Critical Failures: {summary['critical_failures']} 🚨")
        
        assessment = report['security_assessment']
        print(f"\n🛡️ Security Assessment:")
        print(f"   • Security Level: {assessment['security_level']}")
        print(f"   • Risk Level: {assessment['risk_level']}")
        print(f"   • Production Ready: {'YES ✅' if assessment['production_ready'] else 'NO ❌'}")
        
        # Show failed tests
        failed_results = [r for r in report['test_results'] if not r['passed']]
        if failed_results:
            print(f"\n❌ Failed Tests:")
            for result in failed_results:
                print(f"   • {result['test_name']}: {result['details']}")
                if result['error_message']:
                    print(f"     Error: {result['error_message']}")
        
        # Show recommendations
        recommendations = report['recommendations']
        if recommendations:
            print(f"\n💡 Recommendations:")
            for rec in recommendations:
                print(f"   {rec}")
        
        print(f"\n📅 Generated: {report['generated_at']}")
        print("=" * 60)


async def main():
    """Run OAuth testing framework"""
    import argparse
    
    parser = argparse.ArgumentParser(description="OAuth Security Testing Framework")
    parser.add_argument("--base-url", default="http://localhost:8000", 
                       help="Base URL for API testing")
    parser.add_argument("--providers", nargs='+', default=['google', 'github'],
                       help="OAuth providers to test")
    parser.add_argument("--output", help="Output file for test report")
    
    args = parser.parse_args()
    
    async with OAuthTestingFramework(args.base_url) as tester:
        print(f"🚀 Starting OAuth security tests...")
        print(f"   Base URL: {args.base_url}")
        print(f"   Providers: {args.providers}")
        
        report = await tester.run_comprehensive_tests(args.providers)
        
        # Print report
        tester.print_test_report(report)
        
        # Save report
        filename = tester.save_test_report(report, args.output)
        print(f"\n📁 Test report saved: {filename}")


if __name__ == "__main__":
    asyncio.run(main())