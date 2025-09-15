#!/usr/bin/env python3
"""
Production Security Configuration Validator for Schlep Engine
============================================================

This script validates that all required security configurations are properly set
for production deployment and identifies potential security issues.

Usage:
    python production-security-validator.py [--env-file .env.production]

Features:
- Validates all required environment variables
- Checks secret strength and format
- Validates OAuth provider configurations
- Checks database and Redis security
- Validates SSL/TLS settings
- Generates security report with actionable recommendations
"""

import os
import sys
import re
import argparse
import json
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import secrets
import base64
from urllib.parse import urlparse


@dataclass
class SecurityValidationResult:
    """Result of a security validation check"""
    category: str
    check_name: str
    status: str  # 'PASS', 'FAIL', 'WARN'
    severity: str  # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    message: str
    recommendation: str = ""
    current_value: str = "[REDACTED]"


@dataclass
class SecurityReport:
    """Complete security validation report"""
    timestamp: str
    environment: str
    overall_status: str
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    results: List[SecurityValidationResult]
    next_steps: List[str]


class ProductionSecurityValidator:
    """Validates production security configuration"""

    def __init__(self, env_file: Optional[str] = None):
        self.env_file = env_file
        self.results: List[SecurityValidationResult] = []
        self.env_vars: Dict[str, str] = {}

        # Load environment variables
        self._load_environment()

        # Required configurations for production
        self.required_secrets = {
            'SECRET_KEY': {'min_length': 64, 'type': 'secret'},
            'JWT_SECRET_KEY': {'min_length': 64, 'type': 'secret'},
            'POSTGRES_PASSWORD': {'min_length': 32, 'type': 'password'},
            'REDIS_PASSWORD': {'min_length': 32, 'type': 'password'},
            'ENCRYPTION_KEY': {'min_length': 32, 'type': 'fernet_key'},
            'CSRF_SECRET': {'min_length': 32, 'type': 'secret'},
            'COOKIE_SECRET': {'min_length': 32, 'type': 'secret'},
        }

        self.oauth_providers = {
            'google': {
                'client_id': 'GOOGLE_CLIENT_ID',
                'client_secret': 'GOOGLE_CLIENT_SECRET',
                'required': True
            },
            'github': {
                'client_id': 'GITHUB_CLIENT_ID',
                'client_secret': 'GITHUB_CLIENT_SECRET',
                'required': True
            }
        }

        self.security_settings = {
            'ENVIRONMENT': {'required': True, 'expected': 'production'},
            'DEBUG': {'required': True, 'expected': 'false'},
            'BYPASS_AUTH': {'required': True, 'expected': 'false'},
            'CSRF_PROTECTION_ENABLED': {'required': True, 'expected': 'true'},
            'RATE_LIMITING_ENABLED': {'required': True, 'expected': 'true'},
        }

    def _load_environment(self):
        """Load environment variables from file or system"""
        if self.env_file and os.path.exists(self.env_file):
            with open(self.env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        self.env_vars[key.strip()] = value.strip()
        else:
            # Use system environment variables
            self.env_vars = dict(os.environ)

    def validate_all(self) -> SecurityReport:
        """Run all security validations"""
        print("🔐 Running Production Security Validation...")
        print("=" * 60)

        # Clear previous results
        self.results = []

        # Run all validation checks
        self._validate_environment_settings()
        self._validate_secret_keys()
        self._validate_oauth_configuration()
        self._validate_database_security()
        self._validate_redis_security()
        self._validate_encryption_settings()
        self._validate_cors_settings()
        self._validate_ssl_settings()
        self._validate_api_keys()
        self._validate_monitoring_settings()

        # Generate report
        return self._generate_report()

    def _validate_environment_settings(self):
        """Validate basic environment settings"""
        category = "Environment"

        for setting, config in self.security_settings.items():
            value = self.env_vars.get(setting)

            if config['required'] and not value:
                self._add_result(category, f"{setting} Missing", "FAIL", "CRITICAL",
                              f"Required environment variable {setting} is not set",
                              f"Set {setting}={config['expected']}")
            elif value and value.lower() != config['expected'].lower():
                self._add_result(category, f"{setting} Invalid", "FAIL", "HIGH",
                              f"{setting} is set to '{value}' but should be '{config['expected']}'",
                              f"Change {setting} to '{config['expected']}'")
            else:
                self._add_result(category, f"{setting} Valid", "PASS", "LOW",
                              f"{setting} is correctly configured")

    def _validate_secret_keys(self):
        """Validate secret key strength and format"""
        category = "Secret Keys"

        for secret_name, config in self.required_secrets.items():
            value = self.env_vars.get(secret_name)

            if not value:
                self._add_result(category, f"{secret_name} Missing", "FAIL", "CRITICAL",
                              f"Required secret {secret_name} is not set",
                              f"Generate and set {secret_name} using cryptographically secure method")
                continue

            # Check for placeholder values
            if any(placeholder in value for placeholder in [
                'REPLACE_WITH', 'CHANGE_ME', 'PLACEHOLDER', 'TODO', 'FIXME'
            ]):
                self._add_result(category, f"{secret_name} Placeholder", "FAIL", "CRITICAL",
                              f"{secret_name} contains placeholder value",
                              f"Replace {secret_name} with actual cryptographically secure value")
                continue

            # Check length
            if len(value) < config['min_length']:
                self._add_result(category, f"{secret_name} Too Short", "FAIL", "HIGH",
                              f"{secret_name} is {len(value)} characters but should be at least {config['min_length']}",
                              f"Generate longer {secret_name} with at least {config['min_length']} characters")
                continue

            # Check format based on type
            if config['type'] == 'fernet_key':
                if not self._is_valid_fernet_key(value):
                    self._add_result(category, f"{secret_name} Invalid Format", "FAIL", "HIGH",
                                  f"{secret_name} is not a valid Fernet key format",
                                  f"Generate {secret_name} using Fernet.generate_key()")
                    continue

            # Check entropy (basic)
            if not self._has_sufficient_entropy(value):
                self._add_result(category, f"{secret_name} Low Entropy", "WARN", "MEDIUM",
                              f"{secret_name} may have low entropy",
                              f"Regenerate {secret_name} using cryptographically secure random generator")
                continue

            self._add_result(category, f"{secret_name} Valid", "PASS", "LOW",
                          f"{secret_name} is properly configured")

    def _validate_oauth_configuration(self):
        """Validate OAuth provider configurations"""
        category = "OAuth Configuration"

        for provider, config in self.oauth_providers.items():
            client_id = self.env_vars.get(config['client_id'])
            client_secret = self.env_vars.get(config['client_secret'])

            # Check if required
            if config.get('required', False):
                if not client_id:
                    self._add_result(category, f"{provider.title()} Client ID Missing", "FAIL", "CRITICAL",
                                  f"{config['client_id']} is required for {provider} OAuth",
                                  f"Set {config['client_id']} from {provider} OAuth app")
                    continue

                if not client_secret:
                    self._add_result(category, f"{provider.title()} Client Secret Missing", "FAIL", "CRITICAL",
                                  f"{config['client_secret']} is required for {provider} OAuth",
                                  f"Set {config['client_secret']} from {provider} OAuth app")
                    continue

            # Check for placeholder values
            if client_id and any(placeholder in client_id for placeholder in [
                'REPLACE_WITH', 'PLACEHOLDER', 'YOUR_CLIENT_ID'
            ]):
                self._add_result(category, f"{provider.title()} Client ID Placeholder", "FAIL", "CRITICAL",
                              f"{config['client_id']} contains placeholder value",
                              f"Replace with actual client ID from {provider} OAuth app")
                continue

            if client_secret and any(placeholder in client_secret for placeholder in [
                'REPLACE_WITH', 'PLACEHOLDER', 'YOUR_CLIENT_SECRET'
            ]):
                self._add_result(category, f"{provider.title()} Client Secret Placeholder", "FAIL", "CRITICAL",
                              f"{config['client_secret']} contains placeholder value",
                              f"Replace with actual client secret from {provider} OAuth app")
                continue

            # Validate format
            if provider == 'google' and client_id:
                if not client_id.endswith('.apps.googleusercontent.com'):
                    self._add_result(category, f"Google Client ID Format", "FAIL", "HIGH",
                                  "Google Client ID should end with .apps.googleusercontent.com",
                                  "Verify Google Client ID from Google Cloud Console")
                    continue

            if provider == 'github' and client_id:
                if len(client_id) < 15:
                    self._add_result(category, f"GitHub Client ID Length", "WARN", "MEDIUM",
                                  "GitHub Client ID appears shorter than expected",
                                  "Verify GitHub Client ID from GitHub OAuth app")
                    continue

            if client_id and client_secret:
                self._add_result(category, f"{provider.title()} OAuth Valid", "PASS", "LOW",
                              f"{provider.title()} OAuth is properly configured")

    def _validate_database_security(self):
        """Validate database security configuration"""
        category = "Database Security"

        # Check PostgreSQL configuration
        postgres_password = self.env_vars.get('POSTGRES_PASSWORD')
        postgres_user = self.env_vars.get('POSTGRES_USER')
        postgres_host = self.env_vars.get('POSTGRES_HOST')

        if not postgres_password:
            self._add_result(category, "PostgreSQL Password Missing", "FAIL", "CRITICAL",
                          "POSTGRES_PASSWORD is not set",
                          "Set strong PostgreSQL password")
        elif len(postgres_password) < 32:
            self._add_result(category, "PostgreSQL Password Weak", "FAIL", "HIGH",
                          f"PostgreSQL password is {len(postgres_password)} characters, should be 32+",
                          "Use stronger PostgreSQL password (32+ characters)")
        else:
            self._add_result(category, "PostgreSQL Password Strong", "PASS", "LOW",
                          "PostgreSQL password meets strength requirements")

        # Check for default/weak usernames
        if postgres_user in ['postgres', 'admin', 'root', 'user']:
            self._add_result(category, "PostgreSQL Username Weak", "WARN", "MEDIUM",
                          f"PostgreSQL username '{postgres_user}' is common/default",
                          "Use non-default PostgreSQL username for better security")

        # Check SSL requirement
        postgres_sslmode = self.env_vars.get('POSTGRES_SSLMODE', 'prefer')
        if postgres_sslmode not in ['require', 'verify-ca', 'verify-full']:
            self._add_result(category, "PostgreSQL SSL Not Required", "WARN", "MEDIUM",
                          f"PostgreSQL SSL mode is '{postgres_sslmode}'",
                          "Set POSTGRES_SSLMODE=require for production")

    def _validate_redis_security(self):
        """Validate Redis security configuration"""
        category = "Redis Security"

        redis_password = self.env_vars.get('REDIS_PASSWORD')
        redis_ssl = self.env_vars.get('REDIS_SSL', 'false').lower()

        if not redis_password:
            self._add_result(category, "Redis Password Missing", "FAIL", "CRITICAL",
                          "REDIS_PASSWORD is not set",
                          "Set strong Redis password")
        elif len(redis_password) < 32:
            self._add_result(category, "Redis Password Weak", "FAIL", "HIGH",
                          f"Redis password is {len(redis_password)} characters, should be 32+",
                          "Use stronger Redis password (32+ characters)")
        else:
            self._add_result(category, "Redis Password Strong", "PASS", "LOW",
                          "Redis password meets strength requirements")

        if redis_ssl != 'true':
            self._add_result(category, "Redis SSL Disabled", "WARN", "MEDIUM",
                          "Redis SSL is not enabled",
                          "Enable Redis SSL/TLS for production (REDIS_SSL=true)")

    def _validate_encryption_settings(self):
        """Validate encryption configuration"""
        category = "Encryption"

        encryption_key = self.env_vars.get('ENCRYPTION_KEY')

        if not encryption_key:
            self._add_result(category, "Encryption Key Missing", "FAIL", "CRITICAL",
                          "ENCRYPTION_KEY is not set",
                          "Generate and set Fernet encryption key")
        elif not self._is_valid_fernet_key(encryption_key):
            self._add_result(category, "Encryption Key Invalid", "FAIL", "HIGH",
                          "ENCRYPTION_KEY is not a valid Fernet key",
                          "Generate valid Fernet key using Fernet.generate_key()")
        else:
            self._add_result(category, "Encryption Key Valid", "PASS", "LOW",
                          "Encryption key is properly configured")

    def _validate_cors_settings(self):
        """Validate CORS configuration"""
        category = "CORS Security"

        allowed_origins = self.env_vars.get('ALLOWED_ORIGINS', '')
        allowed_hosts = self.env_vars.get('ALLOWED_HOSTS', '')

        if not allowed_origins or allowed_origins == '*':
            self._add_result(category, "CORS Origins Not Restricted", "FAIL", "HIGH",
                          "ALLOWED_ORIGINS is not properly configured",
                          "Set specific domains in ALLOWED_ORIGINS, avoid wildcard '*'")
        elif 'localhost' in allowed_origins:
            self._add_result(category, "CORS Includes Localhost", "WARN", "MEDIUM",
                          "ALLOWED_ORIGINS includes localhost",
                          "Remove localhost from ALLOWED_ORIGINS in production")
        else:
            self._add_result(category, "CORS Origins Restricted", "PASS", "LOW",
                          "CORS origins are properly restricted")

        if not allowed_hosts or allowed_hosts == '*':
            self._add_result(category, "Allowed Hosts Not Restricted", "FAIL", "HIGH",
                          "ALLOWED_HOSTS is not properly configured",
                          "Set specific domains in ALLOWED_HOSTS, avoid wildcard '*'")

    def _validate_ssl_settings(self):
        """Validate SSL/TLS configuration"""
        category = "SSL/TLS"

        force_https = self.env_vars.get('FORCE_HTTPS', 'false').lower()
        ssl_email = self.env_vars.get('SSL_EMAIL')

        if force_https != 'true':
            self._add_result(category, "HTTPS Not Enforced", "FAIL", "HIGH",
                          "FORCE_HTTPS is not enabled",
                          "Enable HTTPS enforcement (FORCE_HTTPS=true)")

        if not ssl_email:
            self._add_result(category, "SSL Email Missing", "WARN", "MEDIUM",
                          "SSL_EMAIL is not set",
                          "Set SSL_EMAIL for certificate management")
        elif not re.match(r'^[^@]+@[^@]+\.[^@]+$', ssl_email):
            self._add_result(category, "SSL Email Invalid", "WARN", "MEDIUM",
                          "SSL_EMAIL format is invalid",
                          "Set valid email address for SSL_EMAIL")

    def _validate_api_keys(self):
        """Validate external API key configuration"""
        category = "API Keys"

        api_keys = {
            'OPENAI_API_KEY': {'required': False, 'prefix': 'sk-'},
            'ANTHROPIC_API_KEY': {'required': False, 'prefix': 'ant_'},
            'SENTRY_DSN': {'required': False, 'prefix': 'https://'},
            'LEMONSQUEEZY_API_KEY': {'required': False, 'prefix': 'lemon_'},
        }

        for key_name, config in api_keys.items():
            value = self.env_vars.get(key_name)

            if not value:
                if config['required']:
                    self._add_result(category, f"{key_name} Missing", "FAIL", "HIGH",
                                  f"Required API key {key_name} is not set",
                                  f"Set {key_name} from the respective service")
                continue

            # Check for placeholder
            if any(placeholder in value for placeholder in [
                'REPLACE_WITH', 'YOUR_API_KEY', 'PLACEHOLDER'
            ]):
                self._add_result(category, f"{key_name} Placeholder", "FAIL", "HIGH",
                              f"{key_name} contains placeholder value",
                              f"Replace with actual API key from service")
                continue

            # Check prefix if specified
            if config.get('prefix') and not value.startswith(config['prefix']):
                self._add_result(category, f"{key_name} Format Invalid", "WARN", "MEDIUM",
                              f"{key_name} doesn't start with expected prefix '{config['prefix']}'",
                              f"Verify {key_name} format")
                continue

            self._add_result(category, f"{key_name} Valid", "PASS", "LOW",
                          f"{key_name} is properly configured")

    def _validate_monitoring_settings(self):
        """Validate monitoring and logging configuration"""
        category = "Monitoring"

        log_level = self.env_vars.get('LOG_LEVEL', 'INFO')
        sentry_dsn = self.env_vars.get('SENTRY_DSN')

        if log_level not in ['ERROR', 'WARN', 'INFO']:
            self._add_result(category, "Log Level Invalid", "WARN", "MEDIUM",
                          f"LOG_LEVEL is '{log_level}', should be ERROR, WARN, or INFO for production",
                          "Set appropriate LOG_LEVEL for production")

        if not sentry_dsn:
            self._add_result(category, "Error Tracking Missing", "WARN", "MEDIUM",
                          "SENTRY_DSN is not configured",
                          "Configure Sentry for error tracking")

    def _is_valid_fernet_key(self, key: str) -> bool:
        """Check if string is a valid Fernet key"""
        try:
            if len(key) != 44:  # Fernet keys are 44 characters when base64 encoded
                return False
            base64.urlsafe_b64decode(key + '===')  # Add padding
            return True
        except Exception:
            return False

    def _has_sufficient_entropy(self, value: str) -> bool:
        """Basic entropy check for secrets"""
        if len(value) < 32:
            return False

        # Check character diversity
        char_types = 0
        if any(c.islower() for c in value):
            char_types += 1
        if any(c.isupper() for c in value):
            char_types += 1
        if any(c.isdigit() for c in value):
            char_types += 1
        if any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in value):
            char_types += 1

        # Require at least 3 character types for good entropy
        return char_types >= 3

    def _add_result(self, category: str, check_name: str, status: str,
                   severity: str, message: str, recommendation: str = ""):
        """Add validation result"""
        self.results.append(SecurityValidationResult(
            category=category,
            check_name=check_name,
            status=status,
            severity=severity,
            message=message,
            recommendation=recommendation
        ))

    def _generate_report(self) -> SecurityReport:
        """Generate comprehensive security report"""
        # Count issues by severity
        critical_issues = len([r for r in self.results if r.severity == 'CRITICAL' and r.status == 'FAIL'])
        high_issues = len([r for r in self.results if r.severity == 'HIGH' and r.status == 'FAIL'])
        medium_issues = len([r for r in self.results if r.severity == 'MEDIUM' and r.status in ['FAIL', 'WARN']])
        low_issues = len([r for r in self.results if r.severity == 'LOW' and r.status in ['FAIL', 'WARN']])

        # Determine overall status
        if critical_issues > 0:
            overall_status = "CRITICAL_ISSUES"
        elif high_issues > 0:
            overall_status = "HIGH_ISSUES"
        elif medium_issues > 0:
            overall_status = "MEDIUM_ISSUES"
        else:
            overall_status = "READY"

        # Generate next steps
        next_steps = self._generate_next_steps()

        return SecurityReport(
            timestamp=datetime.now().isoformat(),
            environment=self.env_vars.get('ENVIRONMENT', 'unknown'),
            overall_status=overall_status,
            critical_issues=critical_issues,
            high_issues=high_issues,
            medium_issues=medium_issues,
            low_issues=low_issues,
            results=self.results,
            next_steps=next_steps
        )

    def _generate_next_steps(self) -> List[str]:
        """Generate actionable next steps"""
        steps = []

        # Critical issues first
        critical_results = [r for r in self.results if r.severity == 'CRITICAL' and r.status == 'FAIL']
        if critical_results:
            steps.append("🚨 CRITICAL: Fix these issues before deploying to production:")
            for result in critical_results:
                steps.append(f"   • {result.check_name}: {result.recommendation}")

        # High severity issues
        high_results = [r for r in self.results if r.severity == 'HIGH' and r.status == 'FAIL']
        if high_results:
            steps.append("⚠️ HIGH PRIORITY: Address these security concerns:")
            for result in high_results:
                steps.append(f"   • {result.check_name}: {result.recommendation}")

        # Medium severity issues
        medium_results = [r for r in self.results if r.severity == 'MEDIUM' and r.status in ['FAIL', 'WARN']]
        if medium_results:
            steps.append("📋 MEDIUM PRIORITY: Improve these security configurations:")
            for result in medium_results:
                steps.append(f"   • {result.check_name}: {result.recommendation}")

        if not critical_results and not high_results:
            steps.append("✅ Production security validation complete!")
            steps.append("📋 Additional recommendations:")
            steps.append("   • Test OAuth flows in staging environment")
            steps.append("   • Set up monitoring for security events")
            steps.append("   • Establish secret rotation schedule")
            steps.append("   • Review and update security policies")

        return steps

    def print_report(self, report: SecurityReport):
        """Print security report to console"""
        print(f"\n📊 Security Validation Report")
        print(f"Generated: {report.timestamp}")
        print(f"Environment: {report.environment}")
        print(f"Overall Status: {self._get_status_emoji(report.overall_status)} {report.overall_status}")
        print(f"Issues: {report.critical_issues} Critical, {report.high_issues} High, {report.medium_issues} Medium, {report.low_issues} Low")
        print("=" * 80)

        # Group results by category
        categories = {}
        for result in report.results:
            if result.category not in categories:
                categories[result.category] = []
            categories[result.category].append(result)

        # Print results by category
        for category, results in categories.items():
            print(f"\n🔍 {category}")
            print("-" * 40)

            for result in results:
                status_emoji = "✅" if result.status == "PASS" else "❌" if result.status == "FAIL" else "⚠️"
                severity_emoji = self._get_severity_emoji(result.severity)

                print(f"  {status_emoji} {severity_emoji} {result.check_name}")
                print(f"     {result.message}")
                if result.recommendation:
                    print(f"     → {result.recommendation}")

        # Print next steps
        if report.next_steps:
            print(f"\n📝 Next Steps:")
            for step in report.next_steps:
                print(f"  {step}")

        print()

    def _get_status_emoji(self, status: str) -> str:
        """Get emoji for overall status"""
        return {
            'READY': '🎉',
            'MEDIUM_ISSUES': '⚠️',
            'HIGH_ISSUES': '🚨',
            'CRITICAL_ISSUES': '💥'
        }.get(status, '❓')

    def _get_severity_emoji(self, severity: str) -> str:
        """Get emoji for severity level"""
        return {
            'CRITICAL': '💥',
            'HIGH': '🚨',
            'MEDIUM': '⚠️',
            'LOW': 'ℹ️'
        }.get(severity, '❓')

    def save_report(self, report: SecurityReport, filename: str):
        """Save security report to JSON file"""
        report_dict = asdict(report)
        with open(filename, 'w') as f:
            json.dump(report_dict, f, indent=2, default=str)
        print(f"📄 Detailed report saved to: {filename}")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Validate production security configuration')
    parser.add_argument('--env-file', help='Path to environment file to validate')
    parser.add_argument('--output', help='Output file for JSON report')
    args = parser.parse_args()

    # Create validator
    validator = ProductionSecurityValidator(args.env_file)

    # Run validation
    report = validator.validate_all()

    # Print report
    validator.print_report(report)

    # Save report if requested
    if args.output:
        validator.save_report(report, args.output)
    else:
        # Default filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        default_filename = f"security_validation_report_{timestamp}.json"
        validator.save_report(report, default_filename)

    # Exit with appropriate code
    if report.critical_issues > 0:
        print("❌ CRITICAL security issues found. Do not deploy to production!")
        sys.exit(1)
    elif report.high_issues > 0:
        print("⚠️ HIGH priority security issues found. Review before deploying.")
        sys.exit(1)
    else:
        print("✅ Security validation passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()