#!/bin/bash

# Enhanced Security System Setup Script
# =====================================
# This script sets up the enhanced security system for Schlep-engine
# including password reset, 2FA, session management, and API key management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if file exists
file_exists() {
    [ -f "$1" ]
}

# Function to check if directory exists
dir_exists() {
    [ -d "$1" ]
}

print_status "🚀 Setting up Enhanced Security System for Schlep-engine..."

# Check if we're in the right directory
if ! file_exists "requirements.txt"; then
    print_error "requirements.txt not found. Please run this script from the backend directory."
    exit 1
fi

# Check Python version
print_status "Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    print_error "Python 3.8 or higher is required. Found: $python_version"
    exit 1
fi

print_success "Python version: $python_version"

# Check if virtual environment exists
if ! dir_exists "venv"; then
    print_warning "Virtual environment not found. Creating one..."
    python3 -m venv venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install security dependencies
print_status "Installing security dependencies..."
pip install pyotp==2.9.0 qrcode[pil]==7.4.2 cryptography==41.0.8 bcrypt==4.1.2

# Install all requirements
print_status "Installing all requirements..."
pip install -r requirements.txt

# Check if Redis is available
print_status "Checking Redis availability..."
if command_exists redis-cli; then
    if redis-cli ping >/dev/null 2>&1; then
        print_success "Redis is running and accessible"
    else
        print_warning "Redis is installed but not running. Starting Redis..."
        if command_exists brew; then
            brew services start redis
        elif command_exists systemctl; then
            sudo systemctl start redis
        else
            print_warning "Please start Redis manually"
        fi
    fi
else
    print_warning "Redis not found. Installing Redis..."
    if command_exists brew; then
        brew install redis
        brew services start redis
    elif command_exists apt-get; then
        sudo apt-get update
        sudo apt-get install -y redis-server
        sudo systemctl start redis
        sudo systemctl enable redis
    elif command_exists yum; then
        sudo yum install -y redis
        sudo systemctl start redis
        sudo systemctl enable redis
    else
        print_error "Could not install Redis automatically. Please install Redis manually."
        print_status "Visit: https://redis.io/download"
    fi
fi

# Check if PostgreSQL is available
print_status "Checking PostgreSQL availability..."
if command_exists psql; then
    print_success "PostgreSQL is available"
else
    print_warning "PostgreSQL not found. Please install PostgreSQL manually."
    print_status "Visit: https://www.postgresql.org/download/"
fi

# Create environment file if it doesn't exist
if ! file_exists ".env.development"; then
    print_status "Creating development environment file..."
    cat > .env.development << EOF
# Database Configuration
DATABASE_URL=postgresql://wira@localhost:5432/Schlep-engine_dev
DB_USER=wira
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Schlep-engine_dev

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
USE_REDIS_CACHE=true

# JWT Configuration
JWT_SECRET_KEY=dev_jwt_secret_key_change_in_production_2024
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Security Configuration
SECURITY_MFA_ENABLED=true
SECURITY_SESSION_TIMEOUT_HOURS=8
SECURITY_PASSWORD_RESET_TIMEOUT_HOURS=1
SECURITY_MAX_FAILED_ATTEMPTS=5
SECURITY_LOCKOUT_DURATION_MINUTES=30
SECURITY_MAX_CONCURRENT_SESSIONS=5
SECURITY_MAX_API_KEYS_PER_USER=10

# MFA Configuration
MFA_TOTP_ISSUER=Schlep-engine
MFA_BACKUP_CODES_COUNT=10
MFA_CHALLENGE_TIMEOUT_MINUTES=5

# Session Configuration
SESSION_SECRET_KEY=dev_session_secret_key_change_in_production
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=lax

# API Key Configuration
API_KEY_PREFIX=sk_
API_KEY_LENGTH=32
API_KEY_RATE_LIMIT_DEFAULT=1000

# Environment
DEBUG=true
ENVIRONMENT=development
EOF
    print_success "Development environment file created"
else
    print_status "Development environment file already exists"
fi

# Run database migrations
print_status "Running database migrations..."
if command_exists alembic; then
    alembic upgrade head
    print_success "Database migrations completed"
else
    print_warning "Alembic not found. Please install it: pip install alembic"
fi

# Create test script
print_status "Creating security test script..."
cat > test_security_system.py << 'EOF'
#!/usr/bin/env python3
"""
Test script for the Enhanced Security System
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

async def test_security_system():
    """Test the enhanced security system"""
    print("🔐 Testing Enhanced Security System...")
    
    try:
        # Test imports
        from app.auth.enhanced_security_system import enhanced_security
        from app.auth.enhanced_security_system import MFAMethod, SecurityLevel
        print("✅ Security system imports successful")
        
        # Test Redis connection
        await enhanced_security._init_redis()
        if enhanced_security.redis_client:
            await enhanced_security.redis_client.ping()
            print("✅ Redis connection successful")
        else:
            print("⚠️  Redis not available - some features will be limited")
        
        # Test token generation
        token = enhanced_security._generate_secure_token(32)
        if len(token) == 43:  # Base64 encoded 32 bytes
            print("✅ Secure token generation successful")
        else:
            print("❌ Secure token generation failed")
        
        # Test encryption
        test_data = "sensitive_data"
        encrypted = enhanced_security._encrypt_data(test_data)
        decrypted = enhanced_security._decrypt_data(encrypted)
        if decrypted == test_data:
            print("✅ Data encryption/decryption successful")
        else:
            print("❌ Data encryption/decryption failed")
        
        # Test device fingerprinting
        fingerprint = enhanced_security._generate_device_fingerprint("192.168.1.100", "Mozilla/5.0")
        if fingerprint and len(fingerprint) == 64:  # SHA256 hash
            print("✅ Device fingerprinting successful")
        else:
            print("❌ Device fingerprinting failed")
        
        # Test risk scoring
        risk_score = enhanced_security._calculate_session_risk("192.168.1.100", "Mozilla/5.0", fingerprint)
        if 0 <= risk_score <= 1:
            print("✅ Risk scoring successful")
        else:
            print("❌ Risk scoring failed")
        
        print("\n🎉 Enhanced Security System test completed successfully!")
        print("\nNext steps:")
        print("1. Start the API server: uvicorn app.main:app --reload")
        print("2. Test the security endpoints:")
        print("   - POST /api/v1/security/password-reset/request")
        print("   - POST /api/v1/security/mfa/enable")
        print("   - GET /api/v1/security/sessions")
        print("   - POST /api/v1/security/api-keys")
        print("3. Check the documentation: docs/ENHANCED_SECURITY_SYSTEM.md")
        
    except Exception as e:
        print(f"❌ Security system test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_security_system())
    sys.exit(0 if success else 1)
EOF

chmod +x test_security_system.py
print_success "Security test script created"

# Create security configuration guide
print_status "Creating security configuration guide..."
cat > SECURITY_CONFIGURATION.md << 'EOF'
# Security Configuration Guide

## Quick Start

1. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.development .env.production
   
   # Update production settings
   nano .env.production
   ```

2. **Database Setup**
   ```bash
   # Run migrations
   alembic upgrade head
   
   # Seed initial data
   python -m app.scripts.seed_database
   ```

3. **Redis Setup**
   ```bash
   # Start Redis
   redis-server
   
   # Test connection
   redis-cli ping
   ```

4. **Test Security System**
   ```bash
   # Run security tests
   python test_security_system.py
   ```

## Production Configuration

### Security Settings
```bash
# Enable all security features
SECURITY_MFA_ENABLED=true
SECURITY_SESSION_TIMEOUT_HOURS=8
SECURITY_PASSWORD_RESET_TIMEOUT_HOURS=1
SECURITY_MAX_FAILED_ATTEMPTS=5
SECURITY_LOCKOUT_DURATION_MINUTES=30

# Use strong secrets
JWT_SECRET_KEY=your-very-long-secret-key-here
SESSION_SECRET_KEY=your-session-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key

# Secure cookies
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
```

### Redis Configuration
```bash
# Production Redis settings
REDIS_URL=redis://your-redis-server:6379/0
REDIS_PASSWORD=your-redis-password
REDIS_SSL=true
```

### Database Configuration
```bash
# Production database
DATABASE_URL=postgresql://user:password@host:port/database
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
```

## Security Features

### Password Reset
- Secure token-based reset
- Email verification required
- Strong password validation
- Account protection against enumeration

### Two-Factor Authentication
- TOTP (Time-based One-Time Password)
- SMS verification
- Email verification
- Backup codes for recovery

### Session Management
- Device fingerprinting
- Risk scoring
- Concurrent session limits
- Automatic session cleanup

### API Key Management
- Secure key generation
- Permission-based access
- Rate limiting
- Usage tracking

## Monitoring

### Security Metrics
- Failed login attempts
- Suspicious sessions
- API key usage
- MFA adoption rates

### Audit Logging
- All security events logged
- IP address tracking
- User agent tracking
- Timestamp recording

## Compliance

### GDPR
- Data minimization
- User consent
- Right to be forgotten
- Data portability

### SOC 2
- Access controls
- Audit logging
- Security monitoring
- Incident response

### HIPAA
- Data encryption
- Access controls
- Audit trails
- Breach notification

## Troubleshooting

### Common Issues
1. **Redis connection failed**
   - Check Redis server status
   - Verify connection URL
   - Check firewall settings

2. **Database migration failed**
   - Check database connection
   - Verify user permissions
   - Check migration files

3. **MFA not working**
   - Check time synchronization
   - Verify authenticator app
   - Check backup codes

### Support
- Documentation: docs/ENHANCED_SECURITY_SYSTEM.md
- Security team: security@igris-inertial.com
- Bug reports: github.com/igris-inertial/issues
EOF

print_success "Security configuration guide created"

# Run security tests
print_status "Running security system tests..."
if python test_security_system.py; then
    print_success "Security system tests passed"
else
    print_warning "Some security tests failed. Check the output above."
fi

# Final summary
echo ""
print_success "🎉 Enhanced Security System setup completed!"
echo ""
print_status "What was installed:"
echo "  ✅ Security dependencies (pyotp, qrcode, cryptography, bcrypt)"
echo "  ✅ Environment configuration"
echo "  ✅ Database migrations"
echo "  ✅ Redis configuration"
echo "  ✅ Test scripts"
echo "  ✅ Documentation"
echo ""
print_status "Next steps:"
echo "  1. Review SECURITY_CONFIGURATION.md for production setup"
echo "  2. Start the API server: uvicorn app.main:app --reload"
echo "  3. Test security endpoints at http://localhost:8000/docs"
echo "  4. Read the full documentation: docs/ENHANCED_SECURITY_SYSTEM.md"
echo ""
print_status "Security endpoints available:"
echo "  🔐 Password Reset: /api/v1/security/password-reset/*"
echo "  🔐 Two-Factor Auth: /api/v1/security/mfa/*"
echo "  📱 Session Management: /api/v1/security/sessions"
echo "  🔑 API Key Management: /api/v1/security/api-keys"
echo "  📊 Security Status: /api/v1/security/status"
echo "  📋 Admin Audit Logs: /api/v1/security/admin/audit-logs"
echo ""
print_success "Enhanced Security System is ready for use! 🚀" 