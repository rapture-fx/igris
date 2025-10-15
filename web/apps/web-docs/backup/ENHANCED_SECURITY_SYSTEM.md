# Enhanced Security & Compliance System

## Overview

The Enhanced Security & Compliance System provides comprehensive authentication and authorization features for the Schlep-engine platform. This system implements enterprise-grade security measures while maintaining user-friendly experiences.

## Features

### 🔐 Secure Password Reset Flow
- **Token-based reset**: Secure, time-limited tokens for password reset
- **Email verification**: Reset links sent to verified email addresses
- **Strong password validation**: Enforces password complexity requirements
- **Account protection**: Prevents enumeration attacks
- **Audit logging**: Complete audit trail of reset attempts

### 🔐 Two-Factor Authentication (2FA)
- **Multiple methods**: TOTP, SMS, and email verification
- **QR code generation**: Easy setup with authenticator apps
- **Backup codes**: Recovery mechanism for lost devices
- **Device remembering**: Optional device trust for convenience
- **Progressive security**: Gradual rollout based on user preferences

### 🔐 Robust Session Management
- **Multi-device support**: Concurrent sessions across devices
- **Device fingerprinting**: Unique device identification
- **Risk scoring**: Automated risk assessment for sessions
- **Session revocation**: Granular control over active sessions
- **Automatic cleanup**: Expired session management

### 🔐 API Key Management System
- **Secure generation**: Cryptographically secure key generation
- **Permission-based access**: Granular permission control
- **Rate limiting**: Per-key rate limiting capabilities
- **Usage tracking**: Comprehensive usage analytics
- **Key rotation**: Easy key replacement and revocation

## Architecture

### Core Components

```
EnhancedSecuritySystem
├── Password Reset Manager
├── MFA Manager
├── Session Manager
├── API Key Manager
└── Audit Logger
```

### Data Flow

1. **Authentication Request** → Enhanced Security System
2. **Security Validation** → Risk Assessment
3. **Multi-factor Verification** → MFA Challenge (if enabled)
4. **Session Creation** → Device Fingerprinting
5. **Access Grant** → Token Generation
6. **Audit Logging** → Security Event Recording

## API Endpoints

### Password Reset

#### Request Password Reset
```http
POST /api/v1/security/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent",
  "success": true,
  "expires_at": "2024-01-15T11:00:00Z"
}
```

#### Verify Reset Token
```http
POST /api/v1/security/password-reset/verify?token=abc123...
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "email": "user@example.com",
    "username": "username"
  },
  "expires_at": "2024-01-15T11:00:00Z"
}
```

#### Complete Password Reset
```http
POST /api/v1/security/password-reset/complete
Content-Type: application/json

{
  "token": "abc123...",
  "new_password": "SecurePassword123!"
}
```

### Two-Factor Authentication

#### Enable 2FA
```http
POST /api/v1/security/mfa/enable
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "totp",
  "phone_number": "+1234567890"  // Optional for SMS
}
```

**Response (TOTP):**
```json
{
  "message": "2FA enabled with totp",
  "setup_required": false,
  "data": {
    "method": "totp",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backup_codes": ["ABCD1234", "EFGH5678", ...],
    "setup_complete": false
  }
}
```

#### Verify 2FA Setup
```http
POST /api/v1/security/mfa/verify-setup
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "totp",
  "code": "123456"
}
```

#### Verify 2FA Login
```http
POST /api/v1/security/mfa/verify-login
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "totp",
  "code": "123456",
  "remember_device": true
}
```

#### Get MFA Status
```http
GET /api/v1/security/mfa/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "enabled": true,
  "method": "totp",
  "created_at": "2024-01-15T10:00:00Z",
  "last_used": "2024-01-15T10:30:00Z"
}
```

### Session Management

#### Get User Sessions
```http
GET /api/v1/security/sessions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "session_id": "abc123...",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-15T10:00:00Z",
      "last_accessed": "2024-01-15T10:30:00Z",
      "expires_at": "2024-01-15T18:00:00Z",
      "status": "active",
      "security_level": "medium",
      "mfa_verified": true,
      "risk_score": 0.1,
      "device_fingerprint": "abc123..."
    }
  ],
  "total_sessions": 3
}
```

#### Revoke Session
```http
DELETE /api/v1/security/sessions/{session_id}
Authorization: Bearer <token>
```

#### Revoke All Sessions
```http
DELETE /api/v1/security/sessions
Authorization: Bearer <token>
```

### API Key Management

#### Create API Key
```http
POST /api/v1/security/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Production API Key",
  "permissions": ["read:data", "write:data"],
  "expires_at": "2024-12-31T23:59:59Z",
  "rate_limit": 1000
}
```

**Response:**
```json
{
  "message": "API key created successfully",
  "api_key": {
    "id": "key_123...",
    "name": "Production API Key",
    "key": "sk_live_abc123...",  // Shown only once
    "key_preview": "sk_live_abc...xyz",
    "permissions": ["read:data", "write:data"],
    "created_at": "2024-01-15T10:00:00Z",
    "expires_at": "2024-12-31T23:59:59Z"
  },
  "warning": "Store the API key securely - it won't be shown again"
}
```

#### Get API Keys
```http
GET /api/v1/security/api-keys
Authorization: Bearer <token>
```

**Response:**
```json
{
  "api_keys": [
    {
      "id": "key_123...",
      "name": "Production API Key",
      "key_preview": "sk_live_abc...xyz",
      "permissions": ["read:data", "write:data"],
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z",
      "last_used": "2024-01-15T10:30:00Z",
      "expires_at": "2024-12-31T23:59:59Z"
    }
  ],
  "total_keys": 2
}
```

#### Update API Key
```http
PUT /api/v1/security/api-keys/{key_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated API Key Name",
  "permissions": ["read:data"],
  "is_active": true
}
```

#### Revoke API Key
```http
DELETE /api/v1/security/api-keys/{key_id}
Authorization: Bearer <token>
```

### Security Status

#### Get Security Status
```http
GET /api/v1/security/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user_id": "user_123...",
  "email": "user@example.com",
  "security_features": {
    "mfa_enabled": true,
    "mfa_method": "totp",
    "active_sessions": 3,
    "api_keys_count": 2,
    "last_login": "2024-01-15T10:30:00Z"
  },
  "security_recommendations": [
    "Review active sessions regularly",
    "Rotate API keys periodically"
  ]
}
```

### Admin Endpoints

#### Get Audit Logs
```http
GET /api/v1/security/admin/audit-logs?skip=0&limit=100&user_id=user_123&action=login
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "audit_logs": [
    {
      "id": "log_123...",
      "user_id": "user_123...",
      "action": "login",
      "resource_type": "authentication",
      "resource_id": null,
      "details": {
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "mfa_verified": true
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

## Security Features

### Password Policy
- **Minimum length**: 8 characters
- **Complexity requirements**: 
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character
- **History**: Prevents reuse of recent passwords
- **Expiration**: Configurable password expiration

### Account Protection
- **Brute force protection**: Account lockout after failed attempts
- **Rate limiting**: Request rate limiting per user/IP
- **Suspicious activity detection**: Automated risk assessment
- **Account recovery**: Secure account recovery process

### Session Security
- **Secure token generation**: Cryptographically secure tokens
- **Token expiration**: Configurable token lifetimes
- **Device fingerprinting**: Unique device identification
- **Geolocation tracking**: IP-based location tracking
- **Concurrent session limits**: Maximum active sessions per user

### MFA Security
- **TOTP standard**: RFC 6238 compliant time-based tokens
- **Secure secret generation**: Cryptographically secure secrets
- **Backup code system**: Secure recovery mechanism
- **Device trust**: Optional device remembering
- **Progressive rollout**: Gradual MFA adoption

### API Key Security
- **Secure generation**: Cryptographically secure keys
- **Permission-based access**: Granular permission control
- **Rate limiting**: Per-key rate limiting
- **Usage tracking**: Comprehensive usage analytics
- **Key rotation**: Easy key replacement

## Database Schema

### Enhanced User Model
```sql
-- Enhanced security fields added to users table
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfa_method mfamethod;
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR;
ALTER TABLE users ADD COLUMN mfa_backup_codes JSON;
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN account_locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN last_password_reset_request TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN security_questions JSON;
```

### New Security Tables
```sql
-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    ip_address VARCHAR,
    user_agent TEXT,
    device_fingerprint VARCHAR,
    status sessionstatus DEFAULT 'active',
    security_level VARCHAR DEFAULT 'medium',
    mfa_verified BOOLEAN DEFAULT FALSE,
    risk_score FLOAT DEFAULT 0.0,
    metadata JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    email VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    ip_address VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced audit logs
ALTER TABLE audit_logs ADD COLUMN severity VARCHAR DEFAULT 'info';
ALTER TABLE audit_logs ADD COLUMN category VARCHAR;
```

## Configuration

### Environment Variables
```bash
# Security settings
SECURITY_MFA_ENABLED=true
SECURITY_SESSION_TIMEOUT_HOURS=8
SECURITY_PASSWORD_RESET_TIMEOUT_HOURS=1
SECURITY_MAX_FAILED_ATTEMPTS=5
SECURITY_LOCKOUT_DURATION_MINUTES=30
SECURITY_MAX_CONCURRENT_SESSIONS=5
SECURITY_MAX_API_KEYS_PER_USER=10

# MFA settings
MFA_TOTP_ISSUER=Schlep-engine
MFA_BACKUP_CODES_COUNT=10
MFA_CHALLENGE_TIMEOUT_MINUTES=5

# Session settings
SESSION_SECRET_KEY=your-secret-key-here
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict

# API Key settings
API_KEY_PREFIX=sk_
API_KEY_LENGTH=32
API_KEY_RATE_LIMIT_DEFAULT=1000
```

### Security Levels
- **LOW**: Basic security for internal tools
- **MEDIUM**: Standard security for regular users
- **HIGH**: Enhanced security for sensitive operations
- **CRITICAL**: Maximum security for admin operations

## Implementation Guide

### 1. Database Migration
```bash
# Run the enhanced security migration
alembic upgrade head
```

### 2. Install Dependencies
```bash
# Install security dependencies
pip install pyotp qrcode[pil] cryptography
```

### 3. Configure Environment
```bash
# Set security environment variables
export SECURITY_MFA_ENABLED=true
export SECURITY_SESSION_TIMEOUT_HOURS=8
export SECURITY_MAX_FAILED_ATTEMPTS=5
```

### 4. Initialize Security System
```python
from app.auth.enhanced_security_system import enhanced_security

# Initialize the security system
await enhanced_security._init_redis()
```

### 5. Enable Security Features
```python
# Enable MFA for a user
result = await enhanced_security.enable_mfa(
    db, user_id, MFAMethod.TOTP
)

# Create API key
api_key = await enhanced_security.create_api_key(
    db, user_id, "Production Key", ["read:data", "write:data"]
)
```

## Security Best Practices

### For Users
1. **Enable 2FA**: Use two-factor authentication for all accounts
2. **Strong passwords**: Use unique, complex passwords
3. **Regular updates**: Update passwords and API keys regularly
4. **Device security**: Keep devices secure and updated
5. **Session management**: Review and revoke unused sessions

### For Administrators
1. **Monitor audit logs**: Regularly review security audit logs
2. **Security policies**: Implement and enforce security policies
3. **Regular updates**: Keep security systems updated
4. **Incident response**: Have incident response procedures
5. **User training**: Provide security awareness training

### For Developers
1. **Secure coding**: Follow secure coding practices
2. **Input validation**: Validate all user inputs
3. **Error handling**: Implement secure error handling
4. **Logging**: Implement comprehensive security logging
5. **Testing**: Regular security testing and audits

## Compliance

### GDPR Compliance
- **Data minimization**: Only collect necessary data
- **User consent**: Clear consent mechanisms
- **Data portability**: User data export capabilities
- **Right to be forgotten**: Account deletion capabilities
- **Audit trails**: Complete audit logging

### SOC 2 Compliance
- **Access controls**: Comprehensive access management
- **Audit logging**: Complete audit trails
- **Security monitoring**: Continuous security monitoring
- **Incident response**: Incident response procedures
- **Change management**: Secure change management

### HIPAA Compliance
- **Data encryption**: Encrypted data at rest and in transit
- **Access controls**: Role-based access controls
- **Audit trails**: Complete audit logging
- **Data backup**: Secure data backup procedures
- **Incident response**: Breach notification procedures

## Monitoring and Alerting

### Security Metrics
- **Failed login attempts**: Monitor for brute force attacks
- **Suspicious sessions**: Detect unusual session patterns
- **API key usage**: Monitor API key usage patterns
- **MFA adoption**: Track 2FA adoption rates
- **Security events**: Monitor security-related events

### Alerting Rules
- **Multiple failed logins**: Alert on repeated failed attempts
- **Suspicious IP addresses**: Alert on unusual IP patterns
- **High-risk sessions**: Alert on high-risk session activities
- **API key abuse**: Alert on unusual API key usage
- **Security policy violations**: Alert on policy violations

## Troubleshooting

### Common Issues

#### MFA Setup Issues
- **QR code not scanning**: Ensure authenticator app supports TOTP
- **Time sync issues**: Check device time synchronization
- **Backup codes not working**: Verify code format and usage

#### Session Issues
- **Session expiration**: Check session timeout settings
- **Device fingerprinting**: Verify device fingerprint generation
- **Concurrent session limits**: Check maximum session limits

#### API Key Issues
- **Key not working**: Verify key format and permissions
- **Rate limiting**: Check rate limit settings
- **Key expiration**: Verify key expiration dates

### Debug Mode
```python
# Enable debug logging
import logging
logging.getLogger('app.auth.enhanced_security_system').setLevel(logging.DEBUG)
```

## Support

For security-related issues or questions:

1. **Documentation**: Check this documentation first
2. **Security team**: Contact the security team for urgent issues
3. **Bug reports**: Report security bugs through proper channels
4. **Feature requests**: Submit feature requests for security improvements

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial implementation of enhanced security system
- Password reset flow with secure tokens
- Two-factor authentication (TOTP, SMS, email)
- Session management with device fingerprinting
- API key management system
- Comprehensive audit logging
- Security compliance features

## Roadmap

### Upcoming Features
- **Biometric authentication**: Fingerprint and face recognition
- **Hardware security keys**: FIDO2/U2F support
- **Advanced threat detection**: AI-powered threat detection
- **Zero-trust architecture**: Continuous verification
- **Compliance automation**: Automated compliance reporting

### Planned Improvements
- **Performance optimization**: Enhanced performance for high-traffic scenarios
- **Mobile optimization**: Improved mobile security experience
- **Integration capabilities**: Enhanced third-party integrations
- **Analytics dashboard**: Security analytics and reporting
- **Automated response**: Automated security incident response 