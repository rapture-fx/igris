#!/usr/bin/env python3
"""
Enhanced OAuth Security Validation Tool for Schlep Engine
Comprehensive validation of OAuth provider configurations and security settings
"""

import asyncio
import aiohttp
import os
import sys
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import json
from dataclasses import dataclass
from datetime import datetime


@dataclass
class OAuthValidationResult:
    provider: str
    is_valid: bool
    issues: List[str]
    recommendations: List[str]
    security_score: int = 0  # 0-100 security score


@dataclass
class SecurityTestResult:
    test_name: str
    passed: bool
    details: str
    severity: str  # 'critical', 'high', 'medium', 'low'


class EnhancedOAuthSecurityValidator:
    """Enhanced OAuth configuration validator with comprehensive security checks"""
    
    def __init__(self):
        self.timeout = aiohttp.ClientTimeout(total=10)
        self.security_tests = []
    
    async def validate_all_providers(self) -> List[OAuthValidationResult]:
        """Validate all OAuth providers with enhanced security checks"""
        results = []
        
        # Check environment variables
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        github_client_id = os.getenv("GITHUB_CLIENT_ID") 
        github_client_secret = os.getenv("GITHUB_CLIENT_SECRET")
        
        # Validate Google OAuth
        google_result = await self._validate_google_oauth(google_client_id, google_client_secret)
        results.append(google_result)
        
        # Validate GitHub OAuth
        github_result = await self._validate_github_oauth(github_client_id, github_client_secret)
        results.append(github_result)
        
        # Validate Discord OAuth (if configured)
        discord_client_id = os.getenv("DISCORD_CLIENT_ID")
        discord_client_secret = os.getenv("DISCORD_CLIENT_SECRET")
        if discord_client_id or discord_client_secret:
            discord_result = await self._validate_discord_oauth(discord_client_id, discord_client_secret)
            results.append(discord_result)
        
        # Validate PKCE support
        pkce_result = await self._validate_pkce_support()
        results.append(pkce_result)
        
        return results
    
    async def _validate_google_oauth(self, client_id: Optional[str], client_secret: Optional[str]) -> OAuthValidationResult:
        """Validate Google OAuth configuration with enhanced security checks"""
        issues = []
        recommendations = []
        security_score = 100

        # Check if credentials are provided (only flag placeholders in development)
        environment = os.getenv("ENVIRONMENT", "development").lower()

        if not client_id:
            issues.append("Google Client ID is missing")
            recommendations.append("Set GOOGLE_CLIENT_ID environment variable with value from Google Cloud Console")
            security_score -= 50
        elif client_id == "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_ID":
            if environment == "production":
                issues.append("CRITICAL: Google Client ID is still placeholder in production")
                recommendations.append("URGENT: Replace GOOGLE_CLIENT_ID with actual value from Google Cloud Console")
                security_score -= 50
            else:
                recommendations.append("Replace GOOGLE_CLIENT_ID placeholder with actual value for testing")

        if not client_secret:
            issues.append("Google Client Secret is missing")
            recommendations.append("Set GOOGLE_CLIENT_SECRET environment variable with value from Google Cloud Console")
            security_score -= 50
        elif client_secret == "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_SECRET":
            if environment == "production":
                issues.append("CRITICAL: Google Client Secret is still placeholder in production")
                recommendations.append("URGENT: Replace GOOGLE_CLIENT_SECRET with actual value from Google Cloud Console")
                security_score -= 50
            else:
                recommendations.append("Replace GOOGLE_CLIENT_SECRET placeholder with actual value for testing")
        
        # Validate client ID format
        if client_id and not client_id.startswith("REPLACE_WITH"):
            if not client_id.endswith(".apps.googleusercontent.com"):
                issues.append("Google Client ID format is invalid (should end with .apps.googleusercontent.com)")
                security_score -= 20
            
            if len(client_id.split(".")[0]) < 10:
                issues.append("Google Client ID appears to be too short")
                security_score -= 10
        
        # Validate client secret format and strength
        if client_secret and not client_secret.startswith("REPLACE_WITH"):
            if len(client_secret) < 20:
                issues.append("Google Client Secret appears to be too short")
                security_score -= 15
            
            # Check for weak patterns
            if client_secret.lower() in ['test', 'dev', 'demo', 'sample']:
                issues.append("Google Client Secret appears to be a test/demo value")
                security_score -= 30
        
        # Test Google OAuth endpoints
        if client_id and not client_id.startswith("REPLACE_WITH"):
            endpoint_valid = await self._test_google_endpoints()
            if not endpoint_valid:
                issues.append("Google OAuth endpoints are not accessible")
                recommendations.append("Check network connectivity to Google OAuth services")
                security_score -= 10
        
        # Enhanced security recommendations
        if not issues:
            recommendations.extend([
                "Ensure Google OAuth app is configured for production use",
                "Verify redirect URIs are properly configured in Google Console",
                "Enable only necessary OAuth scopes (openid, email, profile)",
                "Configure OAuth consent screen for external users",
                "Enable brand verification for production applications",
                "Set up proper domain verification",
                "Configure rate limiting and quota management"
            ])
        
        result = OAuthValidationResult(
            provider="Google",
            is_valid=len(issues) == 0,
            issues=issues,
            recommendations=recommendations,
            security_score=max(0, security_score)
        )
        
        return result
    
    async def _validate_github_oauth(self, client_id: Optional[str], client_secret: Optional[str]) -> OAuthValidationResult:
        """Validate GitHub OAuth configuration with enhanced security checks"""
        issues = []
        recommendations = []
        security_score = 100

        # Check if credentials are provided (only flag placeholders in development)
        environment = os.getenv("ENVIRONMENT", "development").lower()

        if not client_id:
            issues.append("GitHub Client ID is missing")
            recommendations.append("Set GITHUB_CLIENT_ID environment variable with value from GitHub OAuth App")
            security_score -= 50
        elif client_id == "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_ID":
            if environment == "production":
                issues.append("CRITICAL: GitHub Client ID is still placeholder in production")
                recommendations.append("URGENT: Replace GITHUB_CLIENT_ID with actual value from GitHub OAuth App")
                security_score -= 50
            else:
                recommendations.append("Replace GITHUB_CLIENT_ID placeholder with actual value for testing")

        if not client_secret:
            issues.append("GitHub Client Secret is missing")
            recommendations.append("Set GITHUB_CLIENT_SECRET environment variable with value from GitHub OAuth App")
            security_score -= 50
        elif client_secret == "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_SECRET":
            if environment == "production":
                issues.append("CRITICAL: GitHub Client Secret is still placeholder in production")
                recommendations.append("URGENT: Replace GITHUB_CLIENT_SECRET with actual value from GitHub OAuth App")
                security_score -= 50
            else:
                recommendations.append("Replace GITHUB_CLIENT_SECRET placeholder with actual value for testing")
        
        # Validate client ID format (GitHub uses random strings)
        if client_id and not client_id.startswith("REPLACE_WITH"):
            if len(client_id) < 15:
                issues.append("GitHub Client ID appears to be too short")
                security_score -= 15
            
            # Check for obvious test patterns
            if any(test_word in client_id.lower() for test_word in ['test', 'dev', 'demo', 'sample']):
                issues.append("GitHub Client ID appears to contain test/demo patterns")
                security_score -= 20
        
        # Validate client secret format
        if client_secret and not client_secret.startswith("REPLACE_WITH"):
            if len(client_secret) < 30:
                issues.append("GitHub Client Secret appears to be too short")
                security_score -= 15
        
        # Test GitHub OAuth endpoints
        endpoint_valid = await self._test_github_endpoints()
        if not endpoint_valid:
            issues.append("GitHub OAuth endpoints are not accessible")
            recommendations.append("Check network connectivity to GitHub OAuth services")
            security_score -= 10
        
        # Enhanced security recommendations
        if not issues:
            recommendations.extend([
                "Ensure GitHub OAuth app callback URL matches your production domain",
                "Use minimal scope (user:email) for security",
                "Configure OAuth app for organization restrictions if needed",
                "Enable two-factor authentication requirement",
                "Regularly rotate OAuth app client secret",
                "Monitor OAuth app usage and access logs",
                "Set up webhook secret validation"
            ])
        
        return OAuthValidationResult(
            provider="GitHub", 
            is_valid=len(issues) == 0,
            issues=issues,
            recommendations=recommendations,
            security_score=max(0, security_score)
        )
    
    async def _validate_discord_oauth(self, client_id: Optional[str], client_secret: Optional[str]) -> OAuthValidationResult:
        """Validate Discord OAuth configuration"""
        issues = []
        recommendations = []
        security_score = 100
        
        # Check if credentials are provided
        if not client_id or client_id == "REPLACE_WITH_ACTUAL_DISCORD_CLIENT_ID":
            issues.append("Discord Client ID is missing or still placeholder")
            recommendations.append("Create Discord application at https://discord.com/developers/applications")
            security_score -= 50
        
        if not client_secret or client_secret == "REPLACE_WITH_ACTUAL_DISCORD_CLIENT_SECRET":
            issues.append("Discord Client Secret is missing or still placeholder") 
            recommendations.append("Get Discord Client Secret from application settings")
            security_score -= 50
        
        # Validate client ID format (Discord uses snowflakes - numeric IDs)
        if client_id and not client_id.startswith("REPLACE_WITH"):
            try:
                int(client_id)
                if len(client_id) < 15:
                    issues.append("Discord Client ID appears to be too short")
                    security_score -= 15
            except ValueError:
                issues.append("Discord Client ID should be numeric (snowflake format)")
                security_score -= 20
        
        # Validate client secret format
        if client_secret and not client_secret.startswith("REPLACE_WITH"):
            if len(client_secret) < 25:
                issues.append("Discord Client Secret appears to be too short")
                security_score -= 15
        
        # Test Discord API endpoints
        endpoint_valid = await self._test_discord_endpoints()
        if not endpoint_valid:
            issues.append("Discord API endpoints are not accessible")
            recommendations.append("Check network connectivity to Discord API")
            security_score -= 10
        
        # Security recommendations
        if not issues:
            recommendations.extend([
                "Ensure Discord application redirect URI matches your production domain",
                "Use minimal scopes (identify, email) for security",
                "Configure bot permissions carefully if using bot features",
                "Enable OAuth2 code grant flow only",
                "Set up proper rate limiting handling",
                "Monitor Discord API usage"
            ])
        
        return OAuthValidationResult(
            provider="Discord",
            is_valid=len(issues) == 0,
            issues=issues,
            recommendations=recommendations,
            security_score=max(0, security_score)
        )
    
    async def _validate_pkce_support(self) -> OAuthValidationResult:
        """Validate PKCE (Proof Key for Code Exchange) support"""
        issues = []
        recommendations = []
        security_score = 100
        
        # Check if browser crypto API would be available (simulated check)
        recommendations.extend([
            "Ensure PKCE is implemented in frontend OAuth flow",
            "Validate code_challenge and code_verifier in backend",
            "Use S256 method for code_challenge_method",
            "Generate cryptographically secure code_verifier (43-128 characters)",
            "Implement proper PKCE validation in all OAuth flows"
        ])
        
        # Check backend PKCE validation capability
        pkce_validation_code_exists = self._check_pkce_backend_support()
        if not pkce_validation_code_exists:
            issues.append("Backend PKCE validation code not found")
            recommendations.append("Implement PKCE validation in OAuth callback handler")
            security_score -= 30
        
        # Check frontend PKCE implementation
        frontend_pkce_exists = self._check_frontend_pkce_support()
        if not frontend_pkce_exists:
            issues.append("Frontend PKCE implementation not found")
            recommendations.append("Implement PKCE code generation in frontend OAuth components")
            security_score -= 30
        
        return OAuthValidationResult(
            provider="PKCE Security",
            is_valid=len(issues) == 0,
            issues=issues,
            recommendations=recommendations,
            security_score=max(0, security_score)
        )
    
    def _check_pkce_backend_support(self) -> bool:
        """Check if backend supports PKCE validation"""
        oauth_service_paths = [
            "apps/api/app/auth/oauth_service.py",
            "packages/backend/app/auth/oauth_service.py"
        ]
        
        for oauth_service_path in oauth_service_paths:
            try:
                if os.path.exists(oauth_service_path):
                    with open(oauth_service_path, 'r') as f:
                        content = f.read()
                        # Look for PKCE-related code
                        pkce_indicators = [
                            "code_challenge",
                            "code_verifier",
                            "code_challenge_method",
                            "pkce"
                        ]
                        return any(indicator in content.lower() for indicator in pkce_indicators)
            except Exception:
                continue
        return False
    
    def _check_frontend_pkce_support(self) -> bool:
        """Check if frontend implements PKCE"""
        frontend_oauth_paths = [
            "packages/ui/src/auth/OAuthHandler.tsx",
            "apps/web-*/src/components/auth/*.tsx"
        ]
        
        for path_pattern in frontend_oauth_paths:
            # Simple check - in practice you'd use glob
            try:
                if "OAuthHandler.tsx" in path_pattern:
                    oauth_handler_path = "packages/ui/src/auth/OAuthHandler.tsx"
                    if os.path.exists(oauth_handler_path):
                        with open(oauth_handler_path, 'r') as f:
                            content = f.read()
                            pkce_indicators = [
                                "generatePKCE",
                                "code_challenge",
                                "code_verifier"
                            ]
                            return any(indicator in content for indicator in pkce_indicators)
            except Exception:
                continue
        return False
    
    async def _test_google_endpoints(self) -> bool:
        """Test Google OAuth endpoint accessibility"""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                # Test well-known configuration endpoint
                async with session.get("https://accounts.google.com/.well-known/openid_configuration") as response:
                    if response.status == 200:
                        config = await response.json()
                        return "authorization_endpoint" in config and "token_endpoint" in config
        except Exception:
            pass
        return False
    
    async def _test_github_endpoints(self) -> bool:
        """Test GitHub OAuth endpoint accessibility"""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                # Test GitHub API root to verify connectivity
                async with session.get("https://api.github.com") as response:
                    return response.status == 200
        except Exception:
            pass
        return False
    
    async def _test_discord_endpoints(self) -> bool:
        """Test Discord API endpoint accessibility"""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                # Test Discord API root to verify connectivity
                async with session.get("https://discord.com/api/v10") as response:
                    return response.status == 200
        except Exception:
            pass
        return False
    
    def validate_oauth_security_config(self) -> List[str]:
        """Validate OAuth security configuration"""
        issues = []
        
        # Check redirect URI configuration
        redirect_uri = os.getenv("OAUTH_REDIRECT_URI", "")
        if not redirect_uri:
            issues.append("OAUTH_REDIRECT_URI not configured")
        elif redirect_uri.startswith("http://") and "localhost" not in redirect_uri:
            issues.append("OAUTH_REDIRECT_URI uses HTTP instead of HTTPS for production")
        
        # Check for bypass authentication flag
        bypass_auth = os.getenv("BYPASS_AUTH", "false").lower()
        if bypass_auth == "true":
            issues.append("CRITICAL: BYPASS_AUTH is enabled - this should be disabled in production")
        
        # Check environment configuration
        environment = os.getenv("ENVIRONMENT", "development").lower()
        if environment == "production":
            # Additional production checks
            debug = os.getenv("DEBUG", "false").lower()
            if debug == "true":
                issues.append("CRITICAL: DEBUG is enabled in production environment")
        
        return issues
    
    def validate_csrf_protection(self) -> List[str]:
        """Validate CSRF protection in OAuth flow"""
        issues = []
        
        # Check for secure state parameter generation
        state_length = 32  # Should be at least 32 characters
        issues.append(f"Verify state parameter is at least {state_length} characters long")
        
        # Check state storage and validation
        issues.append("Ensure state parameter is stored securely (Redis) with expiration")
        issues.append("Verify state parameter is validated and consumed only once")
        
        # Check for additional CSRF headers
        csrf_token = os.getenv("CSRF_SECRET", "")
        if not csrf_token or len(csrf_token) < 32:
            issues.append("CSRF_SECRET is missing or too short (should be 32+ characters)")
        
        return issues
    
    def validate_token_security(self) -> List[str]:
        """Validate OAuth token security practices"""
        issues = []
        
        # Check token storage security
        encryption_key = os.getenv("ENCRYPTION_KEY", "")
        if not encryption_key:
            issues.append("ENCRYPTION_KEY is missing - OAuth tokens should be encrypted at rest")
        elif len(encryption_key) < 32:
            issues.append("ENCRYPTION_KEY is too short - should be at least 32 characters")
        
        # Check for secure secret key
        secret_key = os.getenv("SECRET_KEY", "")
        if not secret_key:
            issues.append("SECRET_KEY is missing")
        elif len(secret_key) < 64:
            issues.append("SECRET_KEY is too short - should be at least 64 characters for production")
        
        # Check JWT configuration
        jwt_secret = os.getenv("JWT_SECRET_KEY", "")
        if not jwt_secret:
            issues.append("JWT_SECRET_KEY is missing")
        elif len(jwt_secret) < 64:
            issues.append("JWT_SECRET_KEY is too short - should be at least 64 characters")
        
        return issues
    
    def run_security_tests(self) -> List[SecurityTestResult]:
        """Run comprehensive security tests"""
        tests = []
        
        # Test 1: Environment security
        environment = os.getenv("ENVIRONMENT", "development").lower()
        debug_enabled = os.getenv("DEBUG", "false").lower() == "true"
        
        tests.append(SecurityTestResult(
            test_name="Production Environment Check",
            passed=environment == "production" and not debug_enabled,
            details=f"Environment: {environment}, Debug: {debug_enabled}",
            severity="critical"
        ))
        
        # Test 2: Secret key strength
        secret_key = os.getenv("SECRET_KEY", "")
        tests.append(SecurityTestResult(
            test_name="Secret Key Strength",
            passed=len(secret_key) >= 64,
            details=f"Secret key length: {len(secret_key)} characters",
            severity="critical"
        ))
        
        # Test 3: OAuth credentials
        google_id = os.getenv("GOOGLE_CLIENT_ID", "")
        github_id = os.getenv("GITHUB_CLIENT_ID", "")
        
        oauth_configured = (
            not google_id.startswith("REPLACE_WITH") or 
            not github_id.startswith("REPLACE_WITH")
        )
        
        tests.append(SecurityTestResult(
            test_name="OAuth Provider Configuration",
            passed=oauth_configured,
            details="At least one OAuth provider properly configured",
            severity="high"
        ))
        
        # Test 4: HTTPS enforcement
        redirect_uri = os.getenv("OAUTH_REDIRECT_URI", "")
        https_enforced = redirect_uri.startswith("https://") or "localhost" in redirect_uri
        
        tests.append(SecurityTestResult(
            test_name="HTTPS Enforcement",
            passed=https_enforced,
            details=f"Redirect URI: {redirect_uri}",
            severity="high"
        ))
        
        return tests
    
    def generate_security_report(self, validation_results: List[OAuthValidationResult], security_issues: List[str]) -> dict:
        """Generate comprehensive security report"""
        security_tests = self.run_security_tests()
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "environment": os.getenv("ENVIRONMENT", "unknown"),
            "validation_results": [
                {
                    "provider": result.provider,
                    "is_valid": result.is_valid,
                    "security_score": result.security_score,
                    "issues": result.issues,
                    "recommendations": result.recommendations
                }
                for result in validation_results
            ],
            "security_tests": [
                {
                    "test_name": test.test_name,
                    "passed": test.passed,
                    "details": test.details,
                    "severity": test.severity
                }
                for test in security_tests
            ],
            "security_issues": security_issues,
            "overall_security_score": self._calculate_overall_score(validation_results, security_tests),
            "overall_status": self._determine_overall_status(validation_results, security_tests, security_issues),
            "next_steps": self._generate_next_steps(validation_results, security_issues, security_tests)
        }
        
        return report
    
    def _calculate_overall_score(self, validation_results: List[OAuthValidationResult], security_tests: List[SecurityTestResult]) -> int:
        """Calculate overall security score"""
        if not validation_results:
            return 0
        
        # Average provider scores
        provider_score = sum(r.security_score for r in validation_results) / len(validation_results)
        
        # Security test score
        passed_tests = sum(1 for t in security_tests if t.passed)
        test_score = (passed_tests / len(security_tests)) * 100 if security_tests else 100
        
        # Weight: 60% provider config, 40% security tests
        overall_score = int(provider_score * 0.6 + test_score * 0.4)
        
        return max(0, min(100, overall_score))
    
    def _determine_overall_status(self, validation_results: List[OAuthValidationResult], security_tests: List[SecurityTestResult], security_issues: List[str]) -> str:
        """Determine overall security status"""
        # Check for critical failures
        critical_failures = [t for t in security_tests if not t.passed and t.severity == "critical"]
        if critical_failures or any("CRITICAL" in issue for issue in security_issues):
            return "CRITICAL_ISSUES"
        
        # Check if all providers are valid
        all_providers_valid = all(r.is_valid for r in validation_results)
        no_security_issues = not security_issues
        all_tests_passed = all(t.passed for t in security_tests)
        
        if all_providers_valid and no_security_issues and all_tests_passed:
            return "PRODUCTION_READY"
        elif all_providers_valid:
            return "NEEDS_ATTENTION"
        else:
            return "CONFIGURATION_INCOMPLETE"
    
    def _generate_next_steps(self, validation_results: List[OAuthValidationResult], security_issues: List[str], security_tests: List[SecurityTestResult]) -> List[str]:
        """Generate actionable next steps based on validation results"""
        steps = []
        
        # Critical security issues first
        critical_tests = [t for t in security_tests if not t.passed and t.severity == "critical"]
        if critical_tests:
            steps.append("🚨 CRITICAL: Fix critical security issues before proceeding to production")
            for test in critical_tests:
                steps.append(f"   • {test.test_name}: {test.details}")
        
        # Check for placeholder credentials
        for result in validation_results:
            if any("placeholder" in issue.lower() for issue in result.issues):
                steps.append(f"🔑 Replace placeholder credentials for {result.provider} with actual values from provider console")
        
        # Security-specific steps
        if security_issues:
            steps.append("🛡️ Security Configuration:")
            steps.extend([
                "   • Review and fix security configuration issues listed above",
                "   • Implement proper CSRF protection with secure state parameters",
                "   • Ensure OAuth tokens are encrypted at rest",
                "   • Set up proper token expiration and refresh mechanisms"
            ])
        
        # General production readiness
        if not all(r.is_valid for r in validation_results):
            steps.append("🚀 Production Readiness:")
            steps.extend([
                "   • Test OAuth flows in staging environment before production",
                "   • Set up monitoring for OAuth authentication failures",
                "   • Configure proper logging for OAuth security events",
                "   • Review and update OAuth redirect URI whitelist",
                "   • Implement rate limiting for OAuth endpoints",
                "   • Set up OAuth token refresh mechanisms"
            ])
        
        return steps
    
    async def run_full_validation(self) -> None:
        """Run complete OAuth security validation with enhanced reporting"""
        print("🔐 Enhanced OAuth Security Validation for Schlep Engine")
        print("=" * 60)
        print()
        
        # Validate OAuth providers
        print("📋 Validating OAuth Provider Configurations...")
        results = await self.validate_all_providers()
        
        all_valid = True
        for result in results:
            print(f"\n🔍 {result.provider} OAuth:")
            
            if result.is_valid:
                print(f"  ✅ Configuration is valid (Score: {result.security_score}/100)")
            else:
                print(f"  ❌ Configuration has issues (Score: {result.security_score}/100)")
                all_valid = False
            
            if result.issues:
                print("  Issues found:")
                for issue in result.issues:
                    print(f"    • {issue}")
            
            if result.recommendations:
                print("  Recommendations:")
                for rec in result.recommendations[:3]:  # Show top 3 recommendations
                    print(f"    → {rec}")
        
        # Run security tests
        print(f"\n🧪 Running Security Tests...")
        security_tests = self.run_security_tests()
        
        for test in security_tests:
            status = "✅ PASS" if test.passed else "❌ FAIL"
            severity_icon = {"critical": "🚨", "high": "⚠️", "medium": "📋", "low": "ℹ️"}
            print(f"  {status} {severity_icon.get(test.severity, '📋')} {test.test_name}")
            if not test.passed:
                print(f"    Details: {test.details}")
        
        # Validate security configuration
        print(f"\n🛡️ Validating OAuth Security Configuration...")
        security_issues = self.validate_oauth_security_config()
        csrf_issues = self.validate_csrf_protection()
        token_issues = self.validate_token_security()
        
        all_security_issues = security_issues + csrf_issues + token_issues
        
        if all_security_issues:
            print("  ❌ Security issues found:")
            if security_issues:
                print("    Configuration Issues:")
                for issue in security_issues:
                    print(f"      • {issue}")
            if csrf_issues:
                print("    CSRF Protection Issues:")
                for issue in csrf_issues:
                    print(f"      • {issue}")
            if token_issues:
                print("    Token Security Issues:")
                for issue in token_issues:
                    print(f"      • {issue}")
            all_valid = False
        else:
            print("  ✅ Security configuration looks good")
        
        # Generate security report
        security_report = self.generate_security_report(results, all_security_issues)
        
        print(f"\n📊 Validation Summary:")
        print(f"  • Providers checked: {len(results)}")
        print(f"  • Security tests run: {len(security_tests)}")
        print(f"  • Overall security score: {security_report['overall_security_score']}/100")
        print(f"  • Issues found: {sum(len(r.issues) for r in results) + len(all_security_issues)}")
        print(f"  • Overall status: {self._get_status_emoji(security_report['overall_status'])} {security_report['overall_status'].replace('_', ' ')}")
        
        # Save detailed report
        report_file = f"oauth_security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(security_report, f, indent=2, default=str)
        print(f"  • Detailed report saved: {report_file}")
        
        # Show next steps
        if security_report['next_steps']:
            print(f"\n📝 Next Steps:")
            for step in security_report['next_steps']:
                print(f"  {step}")
            
            print(f"\n📖 Setup Guide:")
            guide_file = "oauth-setup-guide-enhanced.md"
            with open(guide_file, 'w') as f:
                f.write(self.generate_enhanced_setup_guide())
            print(f"  Complete setup guide saved to: {guide_file}")
        else:
            print(f"\n🎉 OAuth configuration is production-ready!")
        
        print()
    
    def _get_status_emoji(self, status: str) -> str:
        """Get emoji for status"""
        emoji_map = {
            "PRODUCTION_READY": "🎉",
            "NEEDS_ATTENTION": "⚠️",
            "CONFIGURATION_INCOMPLETE": "🔧",
            "CRITICAL_ISSUES": "🚨"
        }
        return emoji_map.get(status, "❓")
    
    def generate_enhanced_setup_guide(self) -> str:
        """Generate enhanced OAuth provider setup guide"""
        guide = """# Enhanced OAuth Provider Setup Guide for Schlep Engine

## 🚀 Quick Start Checklist

### Pre-Production Security Checklist
- [ ] All OAuth credentials replaced with production values
- [ ] HTTPS enforced for all redirect URIs
- [ ] DEBUG disabled in production environment
- [ ] Strong secret keys generated (64+ characters)
- [ ] OAuth token encryption enabled
- [ ] CSRF protection implemented
- [ ] Rate limiting configured
- [ ] Monitoring and logging set up

## 🔑 OAuth Provider Setup

### Google OAuth Setup

1. **Create OAuth Application**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing project
   - Enable Google+ API and People API
   - Go to Credentials → Create OAuth 2.0 Client ID

2. **Configure OAuth Consent Screen**
   - Set up consent screen with your app details
   - Add authorized domains for your application
   - Configure scopes: `openid`, `email`, `profile`
   - Submit for verification for external users

3. **Configure Redirect URIs**
   ```
   Development: http://localhost:8000/api/v1/auth/oauth/google/callback
   Staging: https://staging.yourdomain.com/api/v1/auth/oauth/google/callback
   Production: https://yourdomain.com/api/v1/auth/oauth/google/callback
   ```

4. **Security Configuration**
   - Enable domain verification
   - Set up OAuth quotas and rate limits
   - Configure brand verification for production

### GitHub OAuth Setup

1. **Create OAuth Application**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Fill in application details:
     - Application name: Schlep Engine
     - Homepage URL: https://yourdomain.com
     - Authorization callback URL: https://yourdomain.com/api/v1/auth/oauth/github/callback

2. **Security Configuration**
   - Enable two-factor authentication requirement
   - Set up organization restrictions if needed
   - Configure webhook secrets for additional security
   - Regularly rotate client secrets

### Discord OAuth Setup (Optional)

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to OAuth2 section

2. **Configure OAuth Settings**
   - Add redirect URIs for your environments
   - Set appropriate scopes: `identify`, `email`
   - Configure bot permissions if needed

## 🛡️ Security Implementation

### PKCE (Proof Key for Code Exchange)

```typescript
// Frontend PKCE Implementation
async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64URLEncode(array);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64URLEncode(new Uint8Array(digest));
  
  return { codeVerifier, codeChallenge };
}
```

### CSRF Protection

```python
# Backend CSRF Implementation
import secrets

def generate_oauth_state():
    return secrets.token_urlsafe(32)

def validate_oauth_state(state, stored_state):
    if not state or not stored_state:
        return False
    return secrets.compare_digest(state, stored_state)
```

### Token Security

```python
# Token Encryption
from cryptography.fernet import Fernet

def encrypt_oauth_token(token, key):
    f = Fernet(key)
    return f.encrypt(token.encode())

def decrypt_oauth_token(encrypted_token, key):
    f = Fernet(key)
    return f.decrypt(encrypted_token).decode()
```

## 📊 Monitoring and Logging

### OAuth Security Events to Monitor

1. **Failed Authentication Attempts**
   - Invalid state parameters
   - Expired authorization codes
   - Suspicious token patterns

2. **Rate Limit Violations**
   - Excessive OAuth requests
   - Repeated failures from same IP

3. **Configuration Issues**
   - Invalid redirect URIs
   - Missing or expired credentials

### Logging Configuration

```python
OAUTH_SECURITY_EVENTS = [
    "oauth.auth.started",
    "oauth.auth.completed", 
    "oauth.auth.failed",
    "oauth.token.refreshed",
    "oauth.account.linked",
    "oauth.account.unlinked"
]
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Production OAuth Configuration
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_secret
GITHUB_CLIENT_ID=your_production_github_client_id  
GITHUB_CLIENT_SECRET=your_production_github_secret

# Security Configuration
SECRET_KEY=your_512_bit_production_secret_key
JWT_SECRET_KEY=your_512_bit_jwt_secret_key
ENCRYPTION_KEY=your_fernet_encryption_key
CSRF_SECRET=your_csrf_protection_key

# OAuth Security Settings
OAUTH_REDIRECT_URI=https://yourdomain.com/api/v1/auth/oauth/callback
OAUTH_STATE_EXPIRE_MINUTES=10
OAUTH_TOKEN_REFRESH_THRESHOLD=300
```

### Testing OAuth Integration

1. **Unit Tests**
   - PKCE generation and validation
   - State parameter security
   - Token encryption/decryption

2. **Integration Tests**
   - Complete OAuth flows for each provider
   - Error handling and edge cases
   - Rate limiting functionality

3. **Security Tests**
   - CSRF attack prevention
   - Token replay prevention
   - Redirect URI validation

### Production Monitoring Setup

```python
# OAuth Metrics to Track
OAUTH_METRICS = {
    "oauth_auth_attempts_total": "Counter of OAuth authentication attempts",
    "oauth_auth_success_total": "Counter of successful OAuth authentications", 
    "oauth_auth_failures_total": "Counter of failed OAuth authentications",
    "oauth_token_refresh_total": "Counter of OAuth token refreshes",
    "oauth_response_time": "Histogram of OAuth response times"
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Invalid Redirect URI**
   - Ensure exact match including protocol and path
   - Check for trailing slashes
   - Verify domain verification in provider console

2. **State Parameter Mismatch**
   - Check Redis configuration and connectivity
   - Verify state generation and storage logic
   - Check for URL encoding issues

3. **Token Validation Failures**
   - Verify provider endpoint accessibility
   - Check token format and expiration
   - Validate encryption/decryption keys

### Debug Mode

```bash
# Enable OAuth debug logging
LOG_LEVEL=DEBUG
OAUTH_DEBUG=true
```

## 📈 Performance Optimization

1. **Token Caching**
   - Implement Redis-based token caching
   - Set appropriate TTLs for tokens
   - Use connection pooling for Redis

2. **Rate Limiting**
   - Implement per-provider rate limits
   - Use sliding window rate limiting
   - Monitor and adjust limits based on usage

3. **Connection Optimization**
   - Use connection pooling for HTTP clients
   - Implement proper timeout handling
   - Cache provider discovery endpoints

---

## 🆘 Support

For additional help:
- Check OAuth provider documentation
- Review Schlep Engine OAuth implementation
- Monitor OAuth security logs
- Test thoroughly in staging environment

Remember: Security is not a one-time setup. Regularly review and update your OAuth configuration, rotate secrets, and monitor for security events.
"""
        return guide


async def main():
    """Main validation function"""
    validator = EnhancedOAuthSecurityValidator()
    await validator.run_full_validation()


if __name__ == "__main__":
    # Check if running in production environment
    env_file = ".env.production"
    if os.path.exists(env_file):
        # Load environment variables from production file
        with open(env_file, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    
    asyncio.run(main())