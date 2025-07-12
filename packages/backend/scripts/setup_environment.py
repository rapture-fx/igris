#!/usr/bin/env python3
"""
Environment Setup Script for Schlep-engine

This script helps developers set up their environment configuration files
and generate secure secrets for development, staging, and production environments.

Usage:
    python scripts/setup_environment.py [development|staging|production]
"""

import os
import sys
import secrets
import shutil
from pathlib import Path
from typing import Optional

def generate_secure_secret(length: int = 32) -> str:
    """Generate a secure random secret."""
    return secrets.token_urlsafe(length)

def setup_environment(environment: str) -> None:
    """Set up environment configuration for the specified environment."""
    
    # Define paths
    backend_dir = Path(__file__).parent.parent
    template_file = backend_dir / f"env.{environment}.template"
    env_file = backend_dir / f".env.{environment}"
    
    print(f"Setting up {environment} environment...")
    
    # Check if template exists
    if not template_file.exists():
        print(f"Error: Template file {template_file} not found!")
        sys.exit(1)
    
    # Check if env file already exists
    if env_file.exists():
        response = input(f"File {env_file} already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Setup cancelled.")
            return
    
    # Copy template to env file
    shutil.copy2(template_file, env_file)
    print(f"✓ Created {env_file}")
    
    # Generate secrets if needed
    if environment == "development":
        generate_development_secrets(env_file)
    else:
        print(f"\n⚠️  IMPORTANT: For {environment} environment, you need to:")
        print(f"   1. Edit {env_file}")
        print(f"   2. Set JWT_SECRET_KEY and ENCRYPTION_KEY via environment variables")
        print(f"   3. Update database and Redis connection details")
        print(f"   4. Configure external service API keys")
    
    # Set file permissions (restrictive for production)
    if environment == "production":
        os.chmod(env_file, 0o600)
        print("✓ Set restrictive file permissions for production")
    
    print(f"\n✓ {environment} environment setup complete!")
    print(f"  Configuration file: {env_file}")

def generate_development_secrets(env_file: Path) -> None:
    """Generate secure secrets for development environment."""
    
    print("\nGenerating secure secrets for development...")
    
    # Generate secrets
    jwt_secret = generate_secure_secret(32)
    encryption_key = generate_secure_secret(32)
    
    # Read current file
    with open(env_file, 'r') as f:
        content = f.read()
    
    # Replace placeholder secrets
    content = content.replace(
        "JWT_SECRET_KEY=dev_jwt_secret_key_change_in_production_2024_development_only",
        f"JWT_SECRET_KEY={jwt_secret}"
    )
    content = content.replace(
        "ENCRYPTION_KEY=dev_encryption_key_32_chars_long_development_only",
        f"ENCRYPTION_KEY={encryption_key}"
    )
    
    # Write updated content
    with open(env_file, 'w') as f:
        f.write(content)
    
    print("✓ Generated secure JWT_SECRET_KEY")
    print("✓ Generated secure ENCRYPTION_KEY")
    print("⚠️  Remember: These are development-only secrets!")

def validate_environment(env_file: Path) -> bool:
    """Validate environment configuration file."""
    
    print(f"\nValidating {env_file}...")
    
    if not env_file.exists():
        print(f"❌ Environment file {env_file} not found!")
        return False
    
    # Read and check for required variables
    with open(env_file, 'r') as f:
        content = f.read()
    
    required_vars = [
        "JWT_SECRET_KEY",
        "ENCRYPTION_KEY",
        "DATABASE_URL",
        "REDIS_URL"
    ]
    
    missing_vars = []
    for var in required_vars:
        if f"{var}=" not in content:
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    # Check for placeholder values
    placeholders = [
        "your_staging_jwt_secret_key_here",
        "your_staging_encryption_key_here",
        "your_production_jwt_secret_key_here",
        "your_production_encryption_key_here"
    ]
    
    found_placeholders = []
    for placeholder in placeholders:
        if placeholder in content:
            found_placeholders.append(placeholder)
    
    if found_placeholders:
        print(f"⚠️  Found placeholder values: {', '.join(found_placeholders)}")
        print("   Please replace with actual values before deployment.")
        return False
    
    print("✓ Environment configuration is valid!")
    return True

def main():
    """Main function."""
    
    if len(sys.argv) != 2:
        print("Usage: python scripts/setup_environment.py [development|staging|production]")
        print("\nAvailable environments:")
        print("  development - Local development environment")
        print("  staging     - Staging environment")
        print("  production  - Production environment")
        sys.exit(1)
    
    environment = sys.argv[1].lower()
    
    if environment not in ["development", "staging", "production"]:
        print("Error: Environment must be 'development', 'staging', or 'production'")
        sys.exit(1)
    
    try:
        setup_environment(environment)
        
        # Validate the setup
        backend_dir = Path(__file__).parent.parent
        env_file = backend_dir / f".env.{environment}"
        validate_environment(env_file)
        
        print(f"\n🎉 {environment} environment setup complete!")
        print(f"\nNext steps:")
        print(f"  1. Review {env_file}")
        print(f"  2. Update database connection details if needed")
        print(f"  3. Set ENVIRONMENT={environment} when running the application")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 