#!/usr/bin/env python3
"""
OAuth Security Validation Tool for Schlep Engine
Validates OAuth provider configurations and security settings
"""

import asyncio
import aiohttp
import os
import sys
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import json
from dataclasses import dataclass


@dataclass
class OAuthValidationResult:
    provider: str
    is_valid: bool
    issues: List[str]
    recommendations: List[str]


class OAuthSecurityValidator:
    """Validates OAuth configuration for security compliance"""
    
    def __init__(self):
        self.timeout = aiohttp.ClientTimeout(total=10)
    
    async def validate_all_providers(self) -> List[OAuthValidationResult]:
        """Validate all OAuth providers"""
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
        
        return results
    
    async def _validate_google_oauth(self, client_id: Optional[str], client_secret: Optional[str]) -> OAuthValidationResult:
        """Validate Google OAuth configuration"""
        issues = []
        recommendations = []
        
        # Check if credentials are provided
        if not client_id or client_id == "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_ID":
            issues.append("Google Client ID is missing or still placeholder")
            recommendations.append("Get Google Client ID from Google Cloud Console OAuth section")
        
        if not client_secret or client_secret == "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_SECRET":
            issues.append("Google Client Secret is missing or still placeholder")
            recommendations.append("Get Google Client Secret from Google Cloud Console OAuth section")
        
        # Validate client ID format
        if client_id and not client_id.startswith("REPLACE_WITH"):
            if not client_id.endswith(".apps.googleusercontent.com"):
                issues.append("Google Client ID format is invalid (should end with .apps.googleusercontent.com)")
            
            if len(client_id.split(".")[0]) < 10:
                issues.append("Google Client ID appears to be too short")
        
        # Validate client secret format
        if client_secret and not client_secret.startswith("REPLACE_WITH"):
            if len(client_secret) < 20:
                issues.append("Google Client Secret appears to be too short")
        
        # Test Google OAuth endpoints (if credentials look valid)
        if client_id and not client_id.startswith("REPLACE_WITH"):
            endpoint_valid = await self._test_google_endpoints()
            if not endpoint_valid:
                issues.append("Google OAuth endpoints are not accessible")
                recommendations.append("Check network connectivity to Google OAuth services")
        
        # Security recommendations
        if not issues:
            recommendations.extend([
                "Ensure Google OAuth app is configured for production use",
                "Verify redirect URIs are properly configured in Google Console",
                "Enable only necessary OAuth scopes (openid, email, profile)",
                "Consider enabling OAuth brand verification for production"
            ])
        
        return OAuthValidationResult(
            provider="Google",
            is_valid=len(issues) == 0,
            issues=issues,
            recommendations=recommendations
        )
    
    async def _validate_github_oauth(self, client_id: Optional[str], client_secret: Optional[str]) -> OAuthValidationResult:
        """Validate GitHub OAuth configuration"""
        issues = []
        recommendations = []
        
        # Check if credentials are provided
        if not client_id or client_id == "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_ID":
            issues.append("GitHub Client ID is missing or still placeholder")
            recommendations.append("Create GitHub OAuth App in Developer Settings and get Client ID")
        
        if not client_secret or client_secret == "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_SECRET":
            issues.append("GitHub Client Secret is missing or still placeholder") 
            recommendations.append("Get GitHub Client Secret from OAuth App settings")
        
        # Validate client ID format (GitHub uses random strings)
        if client_id and not client_id.startswith("REPLACE_WITH"):
            if len(client_id) < 15:
                issues.append("GitHub Client ID appears to be too short")
        
        # Validate client secret format
        if client_secret and not client_secret.startswith("REPLACE_WITH"):
            if len(client_secret) < 30:
                issues.append("GitHub Client Secret appears to be too short")
        
        # Test GitHub OAuth endpoints
        endpoint_valid = await self._test_github_endpoints()
        if not endpoint_valid:
            issues.append("GitHub OAuth endpoints are not accessible")
            recommendations.append("Check network connectivity to GitHub OAuth services")
        
        # Security recommendations
        if not issues:
            recommendations.extend([
                "Ensure GitHub OAuth app callback URL matches your production domain",
                "Use minimal scope (user:email) for security",
                "Consider enabling OAuth app restrictions in organization settings",
                "Regularly rotate OAuth app client secret"
            ])
        
        return OAuthValidationResult(
            provider="GitHub", 
            is_valid=len(issues) == 0,
            issues=issues,
            recommendations=recommendations
        )
    
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
    
    def validate_oauth_security_config(self) -> List[str]:
        """Validate OAuth security configuration"""
        issues = []
        
        # Check redirect URI configuration
        redirect_uri = os.getenv("OAUTH_REDIRECT_URI", "")
        if not redirect_uri:
            issues.append("OAUTH_REDIRECT_URI not configured")
        elif redirect_uri.startswith("http://") and "localhost" not in redirect_uri:
            issues.append("OAUTH_REDIRECT_URI uses HTTP instead of HTTPS for production")
        
        # Check OAuth state configuration
        # This should be handled by the application, but we can check for basic setup
        
        # Check for bypass authentication flag
        bypass_auth = os.getenv("BYPASS_AUTH", "false").lower()
        if bypass_auth == "true":
            issues.append("CRITICAL: BYPASS_AUTH is enabled - this should be disabled in production")
        
        return issues
    
    def generate_oauth_setup_guide(self) -> str:
        """Generate OAuth provider setup guide"""
        guide = """
# OAuth Provider Setup Guide for Schlep Engine

## Google OAuth Setup

1. Go to Google Cloud Console (https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Configure consent screen with your app details
6. Add your production domain to authorized origins
7. Add callback URLs: https://yourdomain.com/api/v1/auth/oauth/callback
8. Copy Client ID and Client Secret to your .env.production

Required Scopes: openid, email, profile

## GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in application details:
   - Application name: Schlep Engine
   - Homepage URL: https://yourdomain.com
   - Authorization callback URL: https://yourdomain.com/api/v1/auth/oauth/callback
4. Click "Register application"
5. Copy Client ID and generate Client Secret
6. Add to your .env.production

Required Scopes: user:email

## Security Checklist

- [ ] Use HTTPS for all OAuth redirect URIs
- [ ] Validate state parameter in OAuth callback
- [ ] Use minimal necessary scopes
- [ ] Implement proper CSRF protection
- [ ] Store OAuth tokens securely
- [ ] Implement token refresh mechanism
- [ ] Log OAuth authentication events
- [ ] Monitor for suspicious OAuth activity

## Testing OAuth Integration

1. Test authorization flow in staging environment
2. Verify user profile information is retrieved correctly
3. Test account linking for existing users
4. Verify OAuth token storage and refresh
5. Test logout and token revocation
6. Validate error handling for OAuth failures

"""
        return guide
    
    async def run_full_validation(self) -> None:
        """Run complete OAuth security validation"""
        print("🔐 OAuth Security Validation for Schlep Engine")
        print("=" * 50)
        print()
        
        # Validate OAuth providers
        print("📋 Validating OAuth Provider Configurations...")
        results = await self.validate_all_providers()
        
        all_valid = True
        for result in results:
            print(f"\n🔍 {result.provider} OAuth:")
            
            if result.is_valid:
                print(f"  ✅ Configuration is valid")
            else:
                print(f"  ❌ Configuration has issues")
                all_valid = False
            
            if result.issues:
                print("  Issues found:")
                for issue in result.issues:
                    print(f"    • {issue}")
            
            if result.recommendations:
                print("  Recommendations:")
                for rec in result.recommendations[:3]:  # Show top 3 recommendations
                    print(f"    → {rec}")
        
        # Validate security configuration
        print(f"\n🛡️  Validating OAuth Security Configuration...")
        security_issues = self.validate_oauth_security_config()
        
        if security_issues:
            print("  ❌ Security issues found:")
            for issue in security_issues:
                print(f"    • {issue}")
            all_valid = False
        else:
            print("  ✅ Security configuration looks good")
        
        print(f"\n📊 Validation Summary:")
        print(f"  • Providers checked: {len(results)}")
        print(f"  • Issues found: {sum(len(r.issues) for r in results) + len(security_issues)}")
        print(f"  • Overall status: {'✅ PASS' if all_valid else '❌ NEEDS ATTENTION'}")
        
        if not all_valid:
            print(f"\n⚠️  Action Required:")
            print("  1. Fix the issues identified above")
            print("  2. Replace placeholder OAuth credentials with actual values") 
            print("  3. Test OAuth flows in staging environment")
            print("  4. Re-run this validation before production deployment")
            
            print(f"\n📖 Setup Guide:")
            guide_file = "oauth-setup-guide.md"
            with open(guide_file, 'w') as f:
                f.write(self.generate_oauth_setup_guide())
            print(f"  Complete setup guide saved to: {guide_file}")
        else:
            print(f"\n🎉 OAuth configuration is ready for production!")
        
        print()


async def main():
    """Main validation function"""
    validator = OAuthSecurityValidator()
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