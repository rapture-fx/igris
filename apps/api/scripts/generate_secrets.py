#!/usr/bin/env python3
"""
Secure Secret Generation Script for Schlep-engine
Generates cryptographically secure secrets for production deployment
"""

import secrets
import string
import base64
import os
from cryptography.fernet import Fernet

def generate_secret_key(length: int = 32) -> str:
    """Generate a secure secret key for JWT/session encryption"""
    return secrets.token_hex(length)

def generate_api_key() -> str:
    """Generate a secure API key"""
    return f"sk-{secrets.token_urlsafe(32)}"

def generate_webhook_secret(length: int = 32) -> str:
    """Generate a secure webhook secret"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_fernet_key() -> str:
    """Generate a Fernet encryption key"""
    return Fernet.generate_key().decode()

def generate_database_password(length: int = 24) -> str:
    """Generate a secure database password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def main():
    print("🔐 Schlep-engine Security Setup")
    print("="*50)
    print()
    
    print("🔑 Generated Secure Secrets:")
    print("-" * 30)
    
    # Generate all required secrets
    secrets_dict = {
        "SECRET_KEY": generate_secret_key(),
        "JWT_SECRET_KEY": generate_secret_key(),
        "ENCRYPTION_KEY": generate_fernet_key(),
        "DATABASE_PASSWORD": generate_database_password(),
        "REDIS_PASSWORD": generate_database_password(16),
        "WEBHOOK_SECRET": generate_webhook_secret(),
        "API_KEY_SALT": generate_secret_key(16),
    }
    
    # Display secrets
    for key, value in secrets_dict.items():
        print(f"{key}={value}")
    
    print()
    print("⚠️  SECURITY WARNINGS:")
    print("-" * 30)
    print("1. Store these secrets in your environment variables")
    print("2. NEVER commit these to version control")
    print("3. Use different secrets for development/staging/production")
    print("4. Rotate secrets regularly")
    print("5. Use a secrets management service (AWS Secrets Manager, etc.)")
    
    print()
    print("📝 Next Steps:")
    print("-" * 30)
    print("1. Copy these values to your .env.local file")
    print("2. Update your deployment environment variables")
    print("3. Revoke any old API keys (LemonSqueezy, etc.)")
    print("4. Test the application with new secrets")
    
    # Create .env.local template
    env_local_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    
    response = input(f"\n📄 Create .env.local file at {env_local_path}? (y/N): ")
    if response.lower() == 'y':
        with open(env_local_path, 'w') as f:
            f.write("# Schlep-engine Local Environment Configuration\n")
            f.write("# Generated secrets - DO NOT COMMIT TO VERSION CONTROL\n\n")
            
            # Basic config
            f.write("# Application Configuration\n")
            f.write("ENVIRONMENT=development\n")
            f.write("DEBUG=true\n")
            f.write("APP_VERSION=1.0.0\n\n")
            
            # Generated secrets
            f.write("# Generated Secrets\n")
            for key, value in secrets_dict.items():
                f.write(f"{key}={value}\n")
            
            f.write("\n# Database Configuration\n")
            f.write("DATABASE_URL=postgresql+asyncpg://postgres:${DATABASE_PASSWORD}@localhost:5432/schlep_engine_dev\n")
            f.write("POSTGRES_SERVER=localhost\n")
            f.write("POSTGRES_PORT=5432\n")
            f.write("POSTGRES_DB=schlep_engine_dev\n")
            f.write("POSTGRES_USER=postgres\n")
            f.write(f"POSTGRES_PASSWORD={secrets_dict['DATABASE_PASSWORD']}\n")
            
            f.write("\n# Redis Configuration\n")
            f.write(f"REDIS_URL=redis://:{secrets_dict['REDIS_PASSWORD']}@localhost:6379/0\n")
            f.write(f"REDIS_PASSWORD={secrets_dict['REDIS_PASSWORD']}\n")
            
            f.write("\n# Frontend URLs\n")
            f.write("FRONTEND_URL=http://localhost:3000\n")
            f.write("ADMIN_URL=http://localhost:3002\n")
            
            f.write("\n# CORS and Security\n")
            f.write('ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:3002"]\n')
            f.write('ALLOWED_HOSTS=["*"]\n')
            
            f.write("\n# JWT Configuration\n")
            f.write("JWT_ALGORITHM=HS256\n")
            f.write("ACCESS_TOKEN_EXPIRE_MINUTES=15\n")
            f.write("REFRESH_TOKEN_EXPIRE_DAYS=7\n")
            
            f.write("\n# Placeholder for external services (replace with actual values)\n")
            f.write("GOOGLE_CLIENT_ID=your_google_client_id\n")
            f.write("GOOGLE_CLIENT_SECRET=your_google_client_secret\n")
            f.write("GITHUB_CLIENT_ID=your_github_client_id\n")
            f.write("GITHUB_CLIENT_SECRET=your_github_client_secret\n")
            f.write("LEMONSQUEEZY_API_KEY=your_new_lemonsqueezy_api_key\n")
            f.write(f"LEMONSQUEEZY_WEBHOOK_SECRET={secrets_dict['WEBHOOK_SECRET']}\n")
            f.write("LEMONSQUEEZY_STORE_ID=your_store_id\n")
        
        print(f"✅ Created .env.local file with secure secrets")
        print(f"📁 Location: {env_local_path}")
        print(f"⚠️  Remember to add .env.local to .gitignore")

if __name__ == "__main__":
    main()