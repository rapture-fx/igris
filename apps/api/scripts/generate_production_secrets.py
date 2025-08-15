#!/usr/bin/env python3
"""
PRODUCTION SECRETS GENERATOR
===========================

Generates secure secrets for production deployment.
Replaces hardcoded passwords and dummy credentials.

Usage:
    python generate_production_secrets.py
    python generate_production_secrets.py --output .env.production
    python generate_production_secrets.py --environment staging
"""

import secrets
import string
import hashlib
import base64
import argparse
import os
from datetime import datetime
from pathlib import Path

class SecretGenerator:
    """Generates cryptographically secure secrets for production use"""
    
    def __init__(self):
        self.alphabet = string.ascii_letters + string.digits
        self.special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        
    def generate_password(self, length: int = 32, include_special: bool = True) -> str:
        """Generate a secure password"""
        charset = self.alphabet
        if include_special:
            charset += self.special_chars
        
        return ''.join(secrets.choice(charset) for _ in range(length))
    
    def generate_api_key(self, prefix: str = "sk", length: int = 32) -> str:
        """Generate an API key with prefix"""
        key_part = ''.join(secrets.choice(self.alphabet) for _ in range(length))
        return f"{prefix}_{key_part}"
    
    def generate_jwt_secret(self, length: int = 64) -> str:
        """Generate a JWT secret key"""
        return secrets.token_urlsafe(length)
    
    def generate_encryption_key(self) -> str:
        """Generate a 256-bit encryption key"""
        return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8')
    
    def generate_database_password(self, length: int = 24) -> str:
        """Generate a database password (no special chars for compatibility)"""
        return ''.join(secrets.choice(self.alphabet) for _ in range(length))
    
    def generate_webhook_secret(self, length: int = 32) -> str:
        """Generate a webhook secret"""
        return secrets.token_hex(length)

def generate_production_secrets(environment: str = "production") -> dict:
    """Generate all production secrets"""
    
    generator = SecretGenerator()
    
    secrets_data = {
        # Core application secrets
        "SECRET_KEY": generator.generate_jwt_secret(64),
        "JWT_SECRET_KEY": generator.generate_jwt_secret(64),
        "JWT_ALGORITHM": "HS256",
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "30",
        "JWT_REFRESH_TOKEN_EXPIRE_DAYS": "7",
        
        # Database credentials
        "DB_PASSWORD": generator.generate_database_password(24),
        "POSTGRES_PASSWORD": generator.generate_database_password(24),
        "REDIS_PASSWORD": generator.generate_database_password(20),
        
        # API Keys
        "INTERNAL_API_KEY": generator.generate_api_key("int", 32),
        "ADMIN_API_KEY": generator.generate_api_key("adm", 32),
        "MONITORING_API_KEY": generator.generate_api_key("mon", 32),
        
        # External service API keys (placeholders - replace with real keys)
        "LEMONSQUEEZY_API_KEY": "lemon_" + generator.generate_api_key("ls", 40),
        "OPENAI_API_KEY": "sk-" + generator.generate_password(48, False),
        "ANTHROPIC_API_KEY": "ant_" + generator.generate_password(40, False),
        
        # OAuth secrets (placeholders - replace with real provider secrets)
        "GOOGLE_CLIENT_SECRET": generator.generate_password(32, False),
        "GITHUB_CLIENT_SECRET": generator.generate_password(40, False),
        "FACEBOOK_CLIENT_SECRET": generator.generate_password(32, False),
        "MICROSOFT_CLIENT_SECRET": generator.generate_password(32, False),
        
        # Encryption and security
        "ENCRYPTION_KEY": generator.generate_encryption_key(),
        "COOKIE_SECRET": generator.generate_password(32),
        "CSRF_SECRET": generator.generate_password(32),
        
        # Webhook secrets
        "LEMONSQUEEZY_WEBHOOK_SECRET": generator.generate_webhook_secret(),
        "GITHUB_WEBHOOK_SECRET": generator.generate_webhook_secret(),
        
        # CDN and storage
        "CDN_API_TOKEN": generator.generate_api_key("cdn", 32),
        "S3_SECRET_ACCESS_KEY": generator.generate_password(40, False),
        "GCP_SERVICE_ACCOUNT_KEY": "base64_encoded_key_here",
        
        # Monitoring and observability
        "SENTRY_DSN": "https://your-sentry-dsn-here",
        "PROMETHEUS_PASSWORD": generator.generate_database_password(20),
        "GRAFANA_ADMIN_PASSWORD": generator.generate_password(24),
        
        # Email service
        "SMTP_PASSWORD": generator.generate_password(24),
        "SENDGRID_API_KEY": "SG." + generator.generate_password(64, False),
        
        # Environment specific
        "ENVIRONMENT": environment,
        "DEBUG": "false",
        "TESTING": "false",
    }
    
    return secrets_data

def create_env_file(secrets: dict, output_path: str):
    """Create environment file with generated secrets"""
    
    header = f"""# PRODUCTION SECRETS - GENERATED {datetime.now().isoformat()}
# 
# SECURITY WARNING: 
# - Never commit this file to version control
# - Store securely using secret management systems
# - Rotate secrets regularly
# - Use environment-specific secret stores in production
#
# Generated by: {os.path.basename(__file__)}
# Environment: {secrets.get('ENVIRONMENT', 'production')}
#

"""
    
    with open(output_path, 'w') as f:
        f.write(header)
        
        # Group secrets by category
        categories = {
            "# Core Application": [
                "SECRET_KEY", "JWT_SECRET_KEY", "JWT_ALGORITHM", 
                "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "JWT_REFRESH_TOKEN_EXPIRE_DAYS"
            ],
            "# Database Configuration": [
                "DB_PASSWORD", "POSTGRES_PASSWORD", "REDIS_PASSWORD"
            ],
            "# Internal API Keys": [
                "INTERNAL_API_KEY", "ADMIN_API_KEY", "MONITORING_API_KEY"
            ],
            "# External Service APIs": [
                "LEMONSQUEEZY_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"
            ],
            "# OAuth Provider Secrets": [
                "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_SECRET", 
                "FACEBOOK_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET"
            ],
            "# Security & Encryption": [
                "ENCRYPTION_KEY", "COOKIE_SECRET", "CSRF_SECRET"
            ],
            "# Webhook Secrets": [
                "LEMONSQUEEZY_WEBHOOK_SECRET", "GITHUB_WEBHOOK_SECRET"
            ],
            "# Infrastructure & Storage": [
                "CDN_API_TOKEN", "S3_SECRET_ACCESS_KEY", "GCP_SERVICE_ACCOUNT_KEY"
            ],
            "# Monitoring & Observability": [
                "SENTRY_DSN", "PROMETHEUS_PASSWORD", "GRAFANA_ADMIN_PASSWORD"
            ],
            "# Communication Services": [
                "SMTP_PASSWORD", "SENDGRID_API_KEY"
            ],
            "# Environment Configuration": [
                "ENVIRONMENT", "DEBUG", "TESTING"
            ]
        }
        
        for category, keys in categories.items():
            f.write(f"\n{category}\n")
            for key in keys:
                if key in secrets:
                    f.write(f"{key}={secrets[key]}\n")
        
        # Add any remaining secrets
        written_keys = set()
        for keys in categories.values():
            written_keys.update(keys)
        
        remaining = set(secrets.keys()) - written_keys
        if remaining:
            f.write("\n# Additional Secrets\n")
            for key in sorted(remaining):
                f.write(f"{key}={secrets[key]}\n")
    
    print(f"✅ Production secrets written to: {output_path}")

def create_kubernetes_secrets(secrets: dict, output_dir: str):
    """Create Kubernetes secret manifests"""
    
    # Encode secrets for Kubernetes
    import base64
    
    k8s_secrets = {}
    for key, value in secrets.items():
        k8s_secrets[key.lower().replace('_', '-')] = base64.b64encode(value.encode()).decode()
    
    manifest = f"""apiVersion: v1
kind: Secret
metadata:
  name: schlep-engine-secrets
  namespace: default
type: Opaque
data:
"""
    
    for key, encoded_value in k8s_secrets.items():
        manifest += f"  {key}: {encoded_value}\n"
    
    k8s_path = Path(output_dir) / "kubernetes-secrets.yaml"
    with open(k8s_path, 'w') as f:
        f.write(manifest)
    
    print(f"✅ Kubernetes secrets written to: {k8s_path}")

def create_docker_env_file(secrets: dict, output_dir: str):
    """Create Docker environment file"""
    
    docker_env = ""
    for key, value in secrets.items():
        # Escape special characters for Docker
        escaped_value = value.replace('$', '$$').replace('"', '\\"')
        docker_env += f"{key}=\"{escaped_value}\"\n"
    
    docker_path = Path(output_dir) / "docker.env"
    with open(docker_path, 'w') as f:
        f.write(docker_env)
    
    print(f"✅ Docker environment file written to: {docker_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate production secrets")
    parser.add_argument(
        '--output', 
        default='.env.production', 
        help='Output file path (default: .env.production)'
    )
    parser.add_argument(
        '--environment',
        choices=['development', 'staging', 'production'],
        default='production',
        help='Environment type (default: production)'
    )
    parser.add_argument(
        '--format',
        choices=['env', 'kubernetes', 'docker', 'all'],
        default='env',
        help='Output format (default: env)'
    )
    parser.add_argument(
        '--output-dir',
        default='.',
        help='Output directory for multiple files (default: current directory)'
    )
    
    args = parser.parse_args()
    
    print(f"🔐 Generating {args.environment} secrets...")
    
    # Generate secrets
    secrets = generate_production_secrets(args.environment)
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Generate in requested format(s)
    if args.format in ['env', 'all']:
        create_env_file(secrets, args.output)
    
    if args.format in ['kubernetes', 'all']:
        create_kubernetes_secrets(secrets, args.output_dir)
    
    if args.format in ['docker', 'all']:
        create_docker_env_file(secrets, args.output_dir)
    
    print(f"\n🎯 Secret generation complete!")
    print(f"📝 {len(secrets)} secrets generated")
    print(f"🔒 Environment: {args.environment}")
    
    print("\n⚠️  SECURITY REMINDERS:")
    print("   • Never commit these secrets to version control")
    print("   • Store in secure secret management systems")
    print("   • Use environment variables in production")
    print("   • Rotate secrets regularly")
    print("   • Monitor access to secret files")

if __name__ == "__main__":
    main()