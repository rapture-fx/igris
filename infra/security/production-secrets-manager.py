#!/usr/bin/env python3
"""
Production Secrets Manager for Schlep Engine
Secure secret generation and validation tool
"""

import os
import secrets
import hashlib
import base64
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from cryptography.fernet import Fernet
from pathlib import Path


class ProductionSecretsManager:
    """Manages secure secret generation and validation for production deployment"""
    
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.secrets_file = self.output_dir / "secrets.encrypted.json"
        self.config_file = self.output_dir / ".env.production"
        
    def generate_all_secrets(self) -> Dict[str, str]:
        """Generate all required secrets for production deployment"""
        
        print("🔐 Generating secure production secrets...")
        
        secrets_data = {
            # Core Application Secrets
            "SECRET_KEY": self._generate_secret_key(64),
            "JWT_SECRET_KEY": self._generate_secret_key(64),
            "JWT_ALGORITHM": "HS256",
            
            # Database & Cache
            "POSTGRES_PASSWORD": self._generate_password(32),
            "REDIS_PASSWORD": self._generate_password(24),
            
            # Internal API Keys  
            "INTERNAL_API_KEY": f"int_{self._generate_api_key()}",
            "ADMIN_API_KEY": f"adm_{self._generate_api_key()}",
            "MONITORING_API_KEY": f"mon_{self._generate_api_key()}",
            
            # Security & Encryption
            "ENCRYPTION_KEY": self._generate_encryption_key(),
            "COOKIE_SECRET": self._generate_complex_secret(32),
            "CSRF_SECRET": self._generate_complex_secret(32),
            
            # Webhook Secrets
            "LEMONSQUEEZY_WEBHOOK_SECRET": self._generate_webhook_secret(),
            "GITHUB_WEBHOOK_SECRET": self._generate_webhook_secret(),
            
            # OAuth Placeholders (to be replaced with actual provider values)
            "GOOGLE_CLIENT_ID": "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET": "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_SECRET",
            "GITHUB_CLIENT_ID": "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_ID", 
            "GITHUB_CLIENT_SECRET": "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_SECRET",
            
            # External Service Keys (placeholders)
            "OPENAI_API_KEY": "REPLACE_WITH_ACTUAL_OPENAI_API_KEY",
            "ANTHROPIC_API_KEY": "REPLACE_WITH_ACTUAL_ANTHROPIC_API_KEY",
            "LEMONSQUEEZY_API_KEY": "REPLACE_WITH_ACTUAL_LEMONSQUEEZY_API_KEY",
            
            # Monitoring
            "SENTRY_DSN": "REPLACE_WITH_ACTUAL_SENTRY_DSN",
            "PROMETHEUS_PASSWORD": self._generate_password(20),
            "GRAFANA_ADMIN_PASSWORD": self._generate_complex_secret(20),
            
            # Communication
            "SMTP_PASSWORD": self._generate_complex_secret(20),
            "SENDGRID_API_KEY": "REPLACE_WITH_ACTUAL_SENDGRID_API_KEY",
            
            # Environment Configuration
            "ENVIRONMENT": "production",
            "DEBUG": "false",
            "TESTING": "false",
        }
        
        # Add metadata
        secrets_data["_generated_at"] = datetime.utcnow().isoformat()
        secrets_data["_expires_at"] = (datetime.utcnow() + timedelta(days=90)).isoformat()
        
        print("✅ Generated all production secrets")
        return secrets_data
    
    def _generate_secret_key(self, length: int = 64) -> str:
        """Generate cryptographically secure secret key"""
        return base64.b64encode(secrets.token_bytes(length)).decode('ascii').rstrip('=')
    
    def _generate_password(self, length: int = 32) -> str:
        """Generate secure password with mixed characters"""
        return secrets.token_urlsafe(length)[:length]
    
    def _generate_api_key(self) -> str:
        """Generate API key with specific format"""
        return secrets.token_urlsafe(32)
    
    def _generate_encryption_key(self) -> str:
        """Generate Fernet-compatible encryption key"""
        return Fernet.generate_key().decode('ascii')
    
    def _generate_complex_secret(self, length: int = 32) -> str:
        """Generate complex secret with special characters"""
        chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    def _generate_webhook_secret(self) -> str:
        """Generate webhook secret (hex format for signatures)"""
        return secrets.token_hex(32)
    
    def create_production_env_file(self, secrets_data: Dict[str, str]) -> None:
        """Create secure .env.production file"""
        
        env_content = f"""# PRODUCTION SECRETS - GENERATED {datetime.utcnow().isoformat()}
# 
# SECURITY WARNING: 
# - Never commit this file to version control
# - Store securely using secret management systems
# - Rotate secrets regularly
# - Use environment-specific secret stores in production
#
# Generated by: ProductionSecretsManager
# Environment: production
#


# Core Application
SECRET_KEY={secrets_data['SECRET_KEY']}
JWT_SECRET_KEY={secrets_data['JWT_SECRET_KEY']}
JWT_ALGORITHM={secrets_data['JWT_ALGORITHM']}
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Database Configuration
DB_PASSWORD={secrets_data['POSTGRES_PASSWORD']}
POSTGRES_PASSWORD={secrets_data['POSTGRES_PASSWORD']}
REDIS_PASSWORD={secrets_data['REDIS_PASSWORD']}

# Internal API Keys
INTERNAL_API_KEY={secrets_data['INTERNAL_API_KEY']}
ADMIN_API_KEY={secrets_data['ADMIN_API_KEY']}
MONITORING_API_KEY={secrets_data['MONITORING_API_KEY']}

# External Service APIs
LEMONSQUEEZY_API_KEY={secrets_data['LEMONSQUEEZY_API_KEY']}
OPENAI_API_KEY={secrets_data['OPENAI_API_KEY']}
ANTHROPIC_API_KEY={secrets_data['ANTHROPIC_API_KEY']}

# OAuth Provider Configuration - REPLACE WITH ACTUAL VALUES FROM PROVIDERS
GOOGLE_CLIENT_ID={secrets_data['GOOGLE_CLIENT_ID']}
GOOGLE_CLIENT_SECRET={secrets_data['GOOGLE_CLIENT_SECRET']}
GITHUB_CLIENT_ID={secrets_data['GITHUB_CLIENT_ID']}
GITHUB_CLIENT_SECRET={secrets_data['GITHUB_CLIENT_SECRET']}

# Security & Encryption
ENCRYPTION_KEY={secrets_data['ENCRYPTION_KEY']}
COOKIE_SECRET={secrets_data['COOKIE_SECRET']}
CSRF_SECRET={secrets_data['CSRF_SECRET']}

# Webhook Secrets
LEMONSQUEEZY_WEBHOOK_SECRET={secrets_data['LEMONSQUEEZY_WEBHOOK_SECRET']}
GITHUB_WEBHOOK_SECRET={secrets_data['GITHUB_WEBHOOK_SECRET']}

# Infrastructure & Storage
CDN_API_TOKEN=REPLACE_WITH_ACTUAL_CDN_TOKEN
S3_SECRET_ACCESS_KEY=REPLACE_WITH_ACTUAL_S3_SECRET
GCP_SERVICE_ACCOUNT_KEY=REPLACE_WITH_BASE64_ENCODED_KEY

# Monitoring & Observability
SENTRY_DSN={secrets_data['SENTRY_DSN']}
PROMETHEUS_PASSWORD={secrets_data['PROMETHEUS_PASSWORD']}
GRAFANA_ADMIN_PASSWORD={secrets_data['GRAFANA_ADMIN_PASSWORD']}

# Communication Services
SMTP_PASSWORD={secrets_data['SMTP_PASSWORD']}
SENDGRID_API_KEY={secrets_data['SENDGRID_API_KEY']}

# Environment Configuration
ENVIRONMENT={secrets_data['ENVIRONMENT']}
DEBUG={secrets_data['DEBUG']}
TESTING={secrets_data['TESTING']}
"""
        
        # Write file with secure permissions
        with open(self.config_file, 'w') as f:
            f.write(env_content)
        
        # Set secure file permissions (readable only by owner)
        os.chmod(self.config_file, 0o600)
        
        print(f"✅ Created secure .env.production file: {self.config_file}")
        print("⚠️  File permissions set to 600 (owner read/write only)")
    
    def save_encrypted_backup(self, secrets_data: Dict[str, str], master_key: Optional[str] = None) -> str:
        """Save encrypted backup of all secrets"""
        
        if not master_key:
            master_key = self._generate_secret_key(32)
        
        # Create encryption key from master key
        key = base64.urlsafe_b64encode(hashlib.sha256(master_key.encode()).digest())
        cipher = Fernet(key)
        
        # Encrypt secrets
        encrypted_data = cipher.encrypt(json.dumps(secrets_data).encode())
        
        backup_data = {
            "encrypted_secrets": encrypted_data.decode('ascii'),
            "created_at": datetime.utcnow().isoformat(),
            "version": "1.0"
        }
        
        with open(self.secrets_file, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        os.chmod(self.secrets_file, 0o600)
        
        print(f"✅ Created encrypted backup: {self.secrets_file}")
        print(f"🔑 Master key for decryption: {master_key}")
        print("⚠️  STORE THE MASTER KEY SECURELY - You'll need it to decrypt the backup!")
        
        return master_key
    
    def validate_secrets(self, secrets_data: Dict[str, str]) -> List[str]:
        """Validate generated secrets for security compliance"""
        
        issues = []
        
        # Check required secrets exist
        required_secrets = [
            "SECRET_KEY", "JWT_SECRET_KEY", "POSTGRES_PASSWORD", 
            "REDIS_PASSWORD", "ENCRYPTION_KEY"
        ]
        
        for secret in required_secrets:
            if not secrets_data.get(secret):
                issues.append(f"Missing required secret: {secret}")
            elif len(secrets_data[secret]) < 16:
                issues.append(f"Secret {secret} is too short (< 16 characters)")
        
        # Check for placeholder values that need replacement
        placeholder_keys = [
            "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
            "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", 
            "OPENAI_API_KEY", "ANTHROPIC_API_KEY"
        ]
        
        placeholder_count = sum(1 for key in placeholder_keys 
                               if secrets_data.get(key, "").startswith("REPLACE_WITH"))
        
        if placeholder_count > 0:
            issues.append(f"{placeholder_count} OAuth/API keys still need to be replaced with actual values")
        
        # Check JWT configuration
        if secrets_data.get("JWT_ALGORITHM") not in ["HS256", "RS256"]:
            issues.append("JWT_ALGORITHM must be HS256 or RS256")
        
        return issues
    
    def generate_deployment_report(self, secrets_data: Dict[str, str], issues: List[str]) -> str:
        """Generate deployment security report"""
        
        report = f"""
SCHLEP ENGINE PRODUCTION SECURITY DEPLOYMENT REPORT
=================================================

Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}

SECRETS GENERATION STATUS:
✅ Core application secrets: Generated
✅ Database credentials: Generated  
✅ JWT configuration: Configured
✅ API keys: Placeholders created
✅ Webhook secrets: Generated
✅ Encryption keys: Generated

SECURITY VALIDATION:
"""
        
        if not issues:
            report += "✅ All security validations passed\n"
        else:
            report += f"⚠️  {len(issues)} issues found:\n"
            for issue in issues:
                report += f"   • {issue}\n"
        
        report += f"""

CONFIGURATION SUMMARY:
• JWT Algorithm: {secrets_data.get('JWT_ALGORITHM', 'Not set')}
• Environment: {secrets_data.get('ENVIRONMENT', 'Not set')}
• Debug Mode: {secrets_data.get('DEBUG', 'Not set')}

NEXT STEPS:
1. Replace OAuth client IDs/secrets with actual provider values
2. Replace API keys with actual service credentials  
3. Deploy to production environment
4. Test all authentication flows
5. Monitor security logs

SECURITY REMINDERS:
• Never commit .env.production to version control
• Rotate secrets every 90 days
• Use infrastructure secret management in production
• Monitor for suspicious authentication attempts
• Keep encrypted backup in secure location

"""
        
        return report


def main():
    """Main execution function"""
    print("🚀 Schlep Engine Production Secrets Manager")
    print("=" * 50)
    
    # Create manager
    manager = ProductionSecretsManager()
    
    # Generate all secrets
    secrets_data = manager.generate_all_secrets()
    
    # Create production env file
    manager.create_production_env_file(secrets_data)
    
    # Create encrypted backup
    master_key = manager.save_encrypted_backup(secrets_data)
    
    # Validate configuration
    issues = manager.validate_secrets(secrets_data)
    
    # Generate report
    report = manager.generate_deployment_report(secrets_data, issues)
    
    # Save report
    report_file = Path("security-deployment-report.txt")
    with open(report_file, 'w') as f:
        f.write(report)
    
    print(report)
    print(f"📊 Full report saved to: {report_file}")
    
    if issues:
        print("\n⚠️  CRITICAL: Address the validation issues before production deployment!")
        return 1
    
    print("\n🎉 Production secrets generated successfully!")
    print("Ready for secure deployment to production environment.")
    return 0


if __name__ == "__main__":
    exit(main())