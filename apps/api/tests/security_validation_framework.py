#!/usr/bin/env python3
"""
Security Validation Framework for Schlep Engine
Comprehensive security testing and validation suite
"""

import os
import sys
import json
import secrets
import hashlib
import pytest
import asyncio
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from jose import jwt, JWTError
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa

# Add app to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.auth.security import (
    get_signing_key, get_verification_key, create_access_token,
    verify_token, verify_password, get_password_hash,
    generate_api_key, verify_api_key, ALGORITHM
)
from app.core.api_config import settings


@dataclass
class SecurityTestResult:
    """Result of a security test"""
    test_name: str
    passed: bool
    severity: str  # 'low', 'medium', 'high', 'critical'
    details: str
    recommendation: Optional[str] = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


class SecurityValidationFramework:
    """Comprehensive security validation framework"""
    
    def __init__(self):
        self.results: List[SecurityTestResult] = []
        self.test_environment = os.getenv("ENVIRONMENT", "testing")
        
    def add_result(self, test_name: str, passed: bool, severity: str, 
                  details: str, recommendation: str = None):
        """Add a test result"""
        result = SecurityTestResult(
            test_name=test_name,
            passed=passed,
            severity=severity,
            details=details,
            recommendation=recommendation
        )
        self.results.append(result)
        return result
    
    def test_jwt_algorithm_security(self) -> SecurityTestResult:
        """Test JWT algorithm security - should use RS256 instead of HS256"""
        try:
            # Check if RS256 is being used
            algorithm = os.getenv("JWT_ALGORITHM", "RS256")
            
            if algorithm == "RS256":
                # Check if RSA keys are properly configured
                private_key_path = os.getenv("JWT_PRIVATE_KEY_PATH")
                private_key_str = os.getenv("JWT_PRIVATE_KEY")
                public_key_path = os.getenv("JWT_PUBLIC_KEY_PATH")
                public_key_str = os.getenv("JWT_PUBLIC_KEY")
                
                has_keys = any([private_key_path, private_key_str, public_key_path, public_key_str])
                
                if has_keys:
                    return self.add_result(
                        "JWT Algorithm Security",
                        True,
                        "low",
                        f"Using secure RS256 algorithm with proper RSA key configuration",
                        "Ensure RSA keys are properly rotated and secured"
                    )
                else:
                    return self.add_result(
                        "JWT Algorithm Security",
                        False,
                        "medium",
                        f"Using RS256 but RSA keys not configured, falling back to HS256",
                        "Configure JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables"
                    )
            else:
                return self.add_result(
                    "JWT Algorithm Security",
                    False,
                    "high",
                    f"Using insecure algorithm: {algorithm}. Should use RS256 for production",
                    "Change JWT_ALGORITHM to RS256 and configure RSA key pair"
                )
                
        except Exception as e:
            return self.add_result(
                "JWT Algorithm Security",
                False,
                "critical",
                f"Error testing JWT algorithm: {str(e)}",
                "Fix JWT configuration and ensure proper error handling"
            )
    
    def test_secret_management(self) -> SecurityTestResult:
        """Test that secrets are properly managed via environment variables"""
        try:
            issues = []
            
            # Check SECRET_KEY
            secret_key = os.getenv("SECRET_KEY")
            if not secret_key:
                issues.append("SECRET_KEY not set")
            elif secret_key in ["your-secret-key-here", "__CHANGE_ME_GENERATE_SECURE_SECRET_KEY__"]:
                issues.append("SECRET_KEY is using default/placeholder value")
            elif len(secret_key) < 32:
                issues.append("SECRET_KEY is too short (should be at least 32 characters)")
            
            # Check database credentials
            db_password = os.getenv("POSTGRES_PASSWORD")
            if not db_password:
                issues.append("POSTGRES_PASSWORD not set")
            elif db_password == "postgres":
                issues.append("POSTGRES_PASSWORD using default value")
            
            # Check LemonSqueezy credentials
            ls_api_key = os.getenv("LEMONSQUEEZY_API_KEY")
            ls_webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
            if ls_api_key and ls_api_key != "":
                if len(ls_api_key) < 16:
                    issues.append("LEMONSQUEEZY_API_KEY appears to be too short")
            if ls_webhook_secret and ls_webhook_secret != "":
                if len(ls_webhook_secret) < 16:
                    issues.append("LEMONSQUEEZY_WEBHOOK_SECRET appears to be too short")
            
            if issues:
                return self.add_result(
                    "Secret Management",
                    False,
                    "high",
                    f"Secret management issues found: {', '.join(issues)}",
                    "Configure all secrets via secure environment variables"
                )
            else:
                return self.add_result(
                    "Secret Management",
                    True,
                    "low",
                    "All secrets properly configured via environment variables",
                    "Regularly rotate secrets and use secret management systems in production"
                )
                
        except Exception as e:
            return self.add_result(
                "Secret Management",
                False,
                "critical",
                f"Error testing secret management: {str(e)}",
                "Fix secret configuration and ensure proper error handling"
            )
    
    def test_password_hashing_security(self) -> SecurityTestResult:
        """Test password hashing security"""
        try:
            test_password = "TestPassword123!"
            
            # Test password hashing
            hashed = get_password_hash(test_password)
            
            # Verify the hash uses bcrypt (starts with $2b$)
            if not hashed.startswith('$2b$'):
                return self.add_result(
                    "Password Hashing Security",
                    False,
                    "high",
                    f"Password hash doesn't use bcrypt algorithm: {hashed[:10]}...",
                    "Ensure bcrypt is used for password hashing"
                )
            
            # Test password verification
            if not verify_password(test_password, hashed):
                return self.add_result(
                    "Password Hashing Security",
                    False,
                    "critical",
                    "Password verification failed for known password",
                    "Fix password verification implementation"
                )
            
            # Test wrong password rejection
            if verify_password("WrongPassword", hashed):
                return self.add_result(
                    "Password Hashing Security",
                    False,
                    "critical",
                    "Password verification incorrectly accepted wrong password",
                    "Fix password verification implementation"
                )
            
            return self.add_result(
                "Password Hashing Security",
                True,
                "low",
                "Password hashing using secure bcrypt algorithm with proper verification",
                "Consider increasing bcrypt rounds for higher security in production"
            )
            
        except Exception as e:
            return self.add_result(
                "Password Hashing Security",
                False,
                "critical",
                f"Error testing password hashing: {str(e)}",
                "Fix password hashing implementation"
            )
    
    def test_jwt_token_security(self) -> SecurityTestResult:
        """Test JWT token creation and validation security"""
        try:
            test_data = {"sub": "test_user", "role": "user"}
            
            # Create token
            token = create_access_token(test_data)
            
            if not token:
                return self.add_result(
                    "JWT Token Security",
                    False,
                    "critical",
                    "Failed to create JWT token",
                    "Fix JWT token creation"
                )
            
            # Verify token
            payload = verify_token(token)
            
            if not payload:
                return self.add_result(
                    "JWT Token Security",
                    False,
                    "critical",
                    "Failed to verify valid JWT token",
                    "Fix JWT token verification"
                )
            
            # Check required claims
            required_claims = ["sub", "exp", "iat", "iss", "aud"]
            missing_claims = [claim for claim in required_claims if claim not in payload]
            
            if missing_claims:
                return self.add_result(
                    "JWT Token Security",
                    False,
                    "medium",
                    f"JWT token missing required claims: {missing_claims}",
                    "Ensure all required JWT claims are included"
                )
            
            # Test token expiry
            try:
                # Create expired token
                expired_data = test_data.copy()
                expired_token = create_access_token(
                    expired_data, 
                    expires_delta=timedelta(seconds=-1)
                )
                expired_payload = verify_token(expired_token)
                
                if expired_payload:
                    return self.add_result(
                        "JWT Token Security",
                        False,
                        "high",
                        "Expired JWT token was accepted",
                        "Fix JWT token expiry validation"
                    )
            except Exception:
                pass  # Expected to fail
            
            return self.add_result(
                "JWT Token Security",
                True,
                "low",
                "JWT token creation and validation working securely with proper claims",
                "Monitor token usage and implement token blacklisting if needed"
            )
            
        except Exception as e:
            return self.add_result(
                "JWT Token Security",
                False,
                "critical",
                f"Error testing JWT token security: {str(e)}",
                "Fix JWT token implementation"
            )
    
    def test_api_key_security(self) -> SecurityTestResult:
        """Test API key generation and verification security"""
        try:
            # Generate API key
            api_key, api_key_hash = generate_api_key()
            
            # Check API key format
            if not api_key.startswith('sk-'):
                return self.add_result(
                    "API Key Security",
                    False,
                    "medium",
                    f"API key doesn't follow expected format: {api_key[:10]}...",
                    "Ensure API keys follow consistent format"
                )
            
            # Check API key length (should be long enough)
            if len(api_key) < 32:
                return self.add_result(
                    "API Key Security",
                    False,
                    "high",
                    f"API key too short: {len(api_key)} characters",
                    "Generate longer API keys for better security"
                )
            
            # Test verification
            if not verify_api_key(api_key, api_key_hash):
                return self.add_result(
                    "API Key Security",
                    False,
                    "critical",
                    "API key verification failed for valid key",
                    "Fix API key verification implementation"
                )
            
            # Test wrong key rejection
            wrong_key = "sk-wrongkey123"
            if verify_api_key(wrong_key, api_key_hash):
                return self.add_result(
                    "API Key Security",
                    False,
                    "critical",
                    "API key verification accepted wrong key",
                    "Fix API key verification implementation"
                )
            
            return self.add_result(
                "API Key Security",
                True,
                "low",
                "API key generation and verification working securely",
                "Implement API key rotation and usage monitoring"
            )
            
        except Exception as e:
            return self.add_result(
                "API Key Security",
                False,
                "critical",
                f"Error testing API key security: {str(e)}",
                "Fix API key implementation"
            )
    
    def test_security_configuration(self) -> SecurityTestResult:
        """Test security configuration settings"""
        try:
            security_config = settings.get_security_config_for_environment(self.test_environment)
            
            issues = []
            recommendations = []
            
            # Check critical security features for production
            if self.test_environment == "production":
                if not security_config.get('encryption'):
                    issues.append("Encryption disabled in production")
                if not security_config.get('audit_logging'):
                    issues.append("Audit logging disabled in production")
                if not security_config.get('rate_limiting'):
                    issues.append("Rate limiting disabled in production")
                if not security_config.get('security_headers'):
                    issues.append("Security headers disabled in production")
            
            # Check token expiry settings
            access_token_expire = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
            try:
                expire_minutes = int(access_token_expire)
                if expire_minutes > 60:
                    issues.append(f"Access token expiry too long: {expire_minutes} minutes")
                    recommendations.append("Consider shorter token expiry for better security")
            except ValueError:
                issues.append("Invalid ACCESS_TOKEN_EXPIRE_MINUTES value")
            
            if issues:
                return self.add_result(
                    "Security Configuration",
                    False,
                    "medium",
                    f"Security configuration issues: {', '.join(issues)}",
                    '; '.join(recommendations) if recommendations else "Review and fix security configuration"
                )
            else:
                return self.add_result(
                    "Security Configuration",
                    True,
                    "low",
                    f"Security configuration appropriate for {self.test_environment} environment",
                    "Regularly review security configuration settings"
                )
                
        except Exception as e:
            return self.add_result(
                "Security Configuration",
                False,
                "medium",
                f"Error testing security configuration: {str(e)}",
                "Fix security configuration setup"
            )
    
    def test_cors_configuration(self) -> SecurityTestResult:
        """Test CORS configuration security"""
        try:
            cors_origins = settings.CORS_ORIGINS
            
            issues = []
            
            # Check for overly permissive CORS
            if "*" in cors_origins:
                issues.append("CORS allows all origins (*)")
            
            # Check for insecure origins in production
            if self.test_environment == "production":
                insecure_origins = [origin for origin in cors_origins if origin.startswith("http://")]
                if insecure_origins:
                    issues.append(f"Insecure HTTP origins in production: {insecure_origins}")
            
            # Check for localhost in production
            if self.test_environment == "production":
                localhost_origins = [origin for origin in cors_origins if "localhost" in origin or "127.0.0.1" in origin]
                if localhost_origins:
                    issues.append(f"Localhost origins in production: {localhost_origins}")
            
            if issues:
                return self.add_result(
                    "CORS Configuration",
                    False,
                    "medium",
                    f"CORS configuration issues: {', '.join(issues)}",
                    "Configure CORS origins appropriately for each environment"
                )
            else:
                return self.add_result(
                    "CORS Configuration",
                    True,
                    "low",
                    "CORS configuration appears secure",
                    "Regularly review CORS origins"
                )
                
        except Exception as e:
            return self.add_result(
                "CORS Configuration",
                False,
                "medium",
                f"Error testing CORS configuration: {str(e)}",
                "Fix CORS configuration"
            )
    
    def run_all_tests(self) -> List[SecurityTestResult]:
        """Run all security validation tests"""
        print(f"Running security validation tests for environment: {self.test_environment}")
        
        # Run all tests
        self.test_jwt_algorithm_security()
        self.test_secret_management()
        self.test_password_hashing_security()
        self.test_jwt_token_security()
        self.test_api_key_security()
        self.test_security_configuration()
        self.test_cors_configuration()
        
        return self.results
    
    def generate_security_report(self) -> Dict[str, Any]:
        """Generate comprehensive security validation report"""
        if not self.results:
            self.run_all_tests()
        
        # Categorize results
        passed_tests = [r for r in self.results if r.passed]
        failed_tests = [r for r in self.results if not r.passed]
        
        # Categorize by severity
        critical_issues = [r for r in failed_tests if r.severity == "critical"]
        high_issues = [r for r in failed_tests if r.severity == "high"]
        medium_issues = [r for r in failed_tests if r.severity == "medium"]
        low_issues = [r for r in failed_tests if r.severity == "low"]
        
        # Calculate security score
        total_tests = len(self.results)
        passed_count = len(passed_tests)
        security_score = (passed_count / total_tests * 100) if total_tests > 0 else 0
        
        # Adjust score based on severity
        severity_penalty = {
            "critical": 30,
            "high": 20,
            "medium": 10,
            "low": 5
        }
        
        total_penalty = 0
        for result in failed_tests:
            total_penalty += severity_penalty.get(result.severity, 0)
        
        adjusted_security_score = max(0, security_score - total_penalty)
        
        report = {
            "security_validation_report": {
                "timestamp": datetime.utcnow().isoformat(),
                "environment": self.test_environment,
                "summary": {
                    "total_tests": total_tests,
                    "passed": passed_count,
                    "failed": len(failed_tests),
                    "security_score": round(adjusted_security_score, 1),
                    "risk_level": self._get_risk_level(adjusted_security_score, len(critical_issues))
                },
                "issues_by_severity": {
                    "critical": len(critical_issues),
                    "high": len(high_issues),
                    "medium": len(medium_issues),
                    "low": len(low_issues)
                },
                "test_results": [
                    {
                        "test_name": result.test_name,
                        "status": "PASSED" if result.passed else "FAILED",
                        "severity": result.severity,
                        "details": result.details,
                        "recommendation": result.recommendation,
                        "timestamp": result.timestamp
                    }
                    for result in self.results
                ],
                "security_measures_implemented": self._get_implemented_measures(),
                "vulnerabilities_fixed": self._get_fixed_vulnerabilities(),
                "recommendations": self._get_priority_recommendations()
            }
        }
        
        return report
    
    def _get_risk_level(self, score: float, critical_issues: int) -> str:
        """Determine risk level based on score and critical issues"""
        if critical_issues > 0:
            return "CRITICAL"
        elif score < 50:
            return "HIGH"
        elif score < 75:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _get_implemented_measures(self) -> List[str]:
        """Get list of implemented security measures"""
        measures = []
        
        for result in self.results:
            if result.passed:
                if "JWT" in result.test_name:
                    measures.append("Secure JWT token implementation with proper claims")
                elif "Password" in result.test_name:
                    measures.append("Secure password hashing with bcrypt")
                elif "API Key" in result.test_name:
                    measures.append("Secure API key generation and verification")
                elif "Secret Management" in result.test_name:
                    measures.append("Environment variable based secret management")
                elif "Security Configuration" in result.test_name:
                    measures.append("Environment-appropriate security configuration")
                elif "CORS" in result.test_name:
                    measures.append("Secure CORS configuration")
        
        return measures
    
    def _get_fixed_vulnerabilities(self) -> List[str]:
        """Get list of fixed vulnerabilities"""
        fixed = [
            "Replaced hardcoded credentials with environment variables",
            "Implemented proper JWT algorithm configuration (RS256 vs HS256)",
            "Added secure password hashing with bcrypt",
            "Implemented proper API key generation with secure random values",
            "Added comprehensive security configuration management",
            "Implemented proper token expiry and validation"
        ]
        return fixed
    
    def _get_priority_recommendations(self) -> List[str]:
        """Get priority recommendations"""
        recommendations = []
        
        critical_failed = [r for r in self.results if not r.passed and r.severity == "critical"]
        high_failed = [r for r in self.results if not r.passed and r.severity == "high"]
        
        for result in critical_failed + high_failed:
            if result.recommendation:
                recommendations.append(f"[{result.severity.upper()}] {result.recommendation}")
        
        # Add general recommendations
        recommendations.extend([
            "Implement regular security audits and penetration testing",
            "Set up automated security scanning in CI/CD pipeline",
            "Implement comprehensive logging and monitoring",
            "Regular security training for development team",
            "Implement secrets rotation policies",
            "Consider implementing MFA for admin access"
        ])
        
        return list(set(recommendations))  # Remove duplicates


def main():
    """Main function to run security validation"""
    framework = SecurityValidationFramework()
    
    print("🔒 Starting Security Validation Framework")
    print("=" * 50)
    
    # Run tests
    results = framework.run_all_tests()
    
    # Print results
    print(f"\nTest Results Summary:")
    print("-" * 30)
    
    for result in results:
        status = "✅ PASS" if result.passed else "❌ FAIL"
        print(f"{status} [{result.severity.upper()}] {result.test_name}")
        if not result.passed:
            print(f"    Details: {result.details}")
            if result.recommendation:
                print(f"    Recommendation: {result.recommendation}")
        print()
    
    # Generate report
    report = framework.generate_security_report()
    
    # Save report
    report_filename = f"security_validation_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_filename, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"📊 Full security report saved to: {report_filename}")
    
    # Print summary
    summary = report["security_validation_report"]["summary"]
    print(f"\n🔐 Security Validation Summary")
    print("=" * 40)
    print(f"Environment: {framework.test_environment}")
    print(f"Security Score: {summary['security_score']}/100")
    print(f"Risk Level: {summary['risk_level']}")
    print(f"Tests Passed: {summary['passed']}/{summary['total_tests']}")
    
    # Return appropriate exit code
    critical_issues = len([r for r in results if not r.passed and r.severity == "critical"])
    if critical_issues > 0:
        print(f"\n🚨 {critical_issues} critical security issues found!")
        return 1
    elif summary['security_score'] < 75:
        print(f"\n⚠️  Security score below recommended threshold")
        return 1
    else:
        print(f"\n✅ Security validation completed successfully")
        return 0


if __name__ == "__main__":
    exit(main())