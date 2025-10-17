# 🔐 Schlep-engine Security Guide

## 🛡️ Overview

This guide provides comprehensive security information for Schlep-engine, covering authentication, authorization, data protection, and security best practices for developers and system administrators.

---

## 🔑 Authentication & Authorization

### Authentication Methods

#### 1. JWT Bearer Tokens (Recommended)

**Token Structure:**
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-id-123"
  },
  "payload": {
    "sub": "user-id-123",
    "email": "user@example.com",
    "role": "user",
    "permissions": ["read", "write"],
    "iat": 1640995200,
    "exp": 1640998800,
    "iss": "schlep-engine.com",
    "aud": "schlep-engine-api"
  }
}
```

**Security Features:**
- **RS256 Signing**: Asymmetric key signing for enhanced security
- **Short Expiration**: 30-minute access tokens
- **Refresh Tokens**: 7-day refresh tokens stored securely
- **Key Rotation**: Automatic key rotation every 90 days
- **Revocation**: Instant token revocation capability

#### 2. OAuth 2.0 (Google & GitHub)

**Security Implementation:**
- **PKCE (Proof Key for Code Exchange)**: Protection against authorization code interception
- **State Parameter**: CSRF protection during OAuth flow
- **Nonce Validation**: Replay attack prevention
- **Scope Limitation**: Minimal required permissions

**OAuth Flow Security:**
```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth Server
    participant P as Provider (Google/GitHub)

    C->>A: Start OAuth with PKCE challenge
    A->>P: Redirect with state & challenge
    P->>A: Callback with code & state
    A->>A: Verify state & PKCE
    A->>P: Exchange code for tokens
    P->>A: Return access token
    A->>C: Return JWT token
```

#### 3. API Keys

**Security Features:**
- **Scoped Permissions**: Limited to specific endpoints
- **Rate Limiting**: Per-key rate limits
- **Expiration**: Configurable expiration dates
- **IP Restrictions**: Optional IP allowlisting
- **Usage Monitoring**: Detailed usage analytics

### Authorization (RBAC)

#### Role Definitions

```python
ROLES = {
    "admin": {
        "permissions": ["*"],  # Full access
        "description": "System administrator"
    },
    "manager": {
        "permissions": [
            "read", "write", "delete",
            "manage_users", "view_analytics"
        ],
        "description": "Team manager"
    },
    "user": {
        "permissions": ["read", "write", "upload"],
        "description": "Regular user"
    },
    "viewer": {
        "permissions": ["read"],
        "description": "Read-only access"
    }
}
```

#### Permission-Based Access Control

```python
# Endpoint protection example
@app.post("/api/v1/data/process")
@require_permissions(["write", "upload"])
async def process_data(
    file: UploadFile,
    current_user: User = Depends(get_current_user)
):
    # Process data
    pass

@app.delete("/api/v1/users/{user_id}")
@require_permissions(["manage_users"])
async def delete_user(user_id: str):
    # Delete user
    pass
```

---

## 🔒 Data Protection

### Encryption

#### Encryption at Rest

**Database Encryption:**
- **AES-256 Encryption**: All sensitive data encrypted
- **Column-Level Encryption**: PII data encrypted at column level
- **Key Management**: AWS KMS / Google Cloud KMS
- **Key Rotation**: Automatic monthly key rotation

```python
# Sensitive field encryption
class User(SQLAlchemyBase):
    id = Column(UUID, primary_key=True)
    email = Column(String, nullable=False)
    # Encrypted fields
    ssn = Column(EncryptedType(String, secret_key))
    phone = Column(EncryptedType(String, secret_key))
    address = Column(EncryptedType(Text, secret_key))
```

**File Storage Encryption:**
- **Server-Side Encryption**: S3/GCS encryption at rest
- **Client-Side Encryption**: Additional encryption for sensitive files
- **Encrypted Backups**: All backups encrypted with separate keys

#### Encryption in Transit

**TLS Configuration:**
- **TLS 1.3**: Minimum version requirement
- **Perfect Forward Secrecy**: ECDHE key exchange
- **HSTS**: HTTP Strict Transport Security enabled
- **Certificate Pinning**: API clients pin certificates

```nginx
# Nginx TLS configuration
ssl_protocols TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
add_header Strict-Transport-Security "max-age=63072000" always;
```

### Data Classification

#### Sensitivity Levels

1. **Public Data**
   - Marketing content
   - Public documentation
   - System status information

2. **Internal Data**
   - Application logs (sanitized)
   - System metrics
   - Non-sensitive user preferences

3. **Confidential Data**
   - User profiles and preferences
   - Processing job metadata
   - API usage analytics

4. **Restricted Data**
   - Authentication credentials
   - Personal identifiable information (PII)
   - Payment information
   - Raw user data

#### Data Handling Policies

```python
# Data classification decorators
@classify_data("restricted")
def process_payment_data(payment_info: PaymentInfo):
    # Special handling for restricted data
    pass

@classify_data("confidential")
def get_user_analytics(user_id: str):
    # Confidential data handling
    pass
```

---

## 🛡️ Security Controls

### Input Validation & Sanitization

#### Request Validation

```python
from pydantic import BaseModel, validator
import bleach

class DataUploadRequest(BaseModel):
    filename: str
    processing_mode: str
    target_framework: Optional[str]

    @validator('filename')
    def validate_filename(cls, v):
        # Sanitize filename
        clean_filename = bleach.clean(v)
        if len(clean_filename) > 255:
            raise ValueError('Filename too long')
        return clean_filename

    @validator('processing_mode')
    def validate_processing_mode(cls, v):
        allowed_modes = ['standard', 'fast', 'streaming', 'ai_enhanced']
        if v not in allowed_modes:
            raise ValueError('Invalid processing mode')
        return v
```

#### File Upload Security

```python
ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.parquet'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

async def validate_file_upload(file: UploadFile):
    # Check file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Invalid file type")

    # Check file size
    file_size = 0
    async for chunk in file:
        file_size += len(chunk)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large")

    # Virus scanning
    await scan_file_for_malware(file)

    # Content validation
    await validate_file_content(file, ext)
```

### Rate Limiting

#### Multi-Tier Rate Limiting

```python
RATE_LIMITS = {
    "global": {"requests": 10000, "window": 3600},     # Global limit
    "per_user": {"requests": 1000, "window": 3600},    # Per user
    "per_ip": {"requests": 100, "window": 60},         # Per IP
    "sensitive": {"requests": 10, "window": 300}       # Sensitive endpoints
}

# Rate limiting implementation
@rate_limit("per_user", "per_ip")
async def upload_data(request: Request):
    pass

@rate_limit("sensitive")
async def change_password(request: Request):
    pass
```

#### Adaptive Rate Limiting

```python
async def adaptive_rate_limit(request: Request):
    user = await get_current_user(request)

    # Adjust limits based on user tier
    if user.tier == "enterprise":
        limit = 5000
    elif user.tier == "pro":
        limit = 1000
    else:  # free tier
        limit = 100

    # Check recent error rate
    error_rate = await get_user_error_rate(user.id)
    if error_rate > 0.1:  # 10% error rate
        limit = limit // 2  # Reduce limit by half

    return await check_rate_limit(user.id, limit)
```

### CSRF Protection

```python
from fastapi_csrf_protect import CsrfProtect

# CSRF configuration
csrf = CsrfProtect()

@app.post("/api/v1/sensitive-action")
async def sensitive_action(
    request: Request,
    csrf_protect: CsrfProtect = Depends()
):
    await csrf_protect.validate_csrf(request)
    # Process sensitive action
```

---

## 🔍 Security Monitoring

### Audit Logging

#### Security Event Logging

```python
import structlog

security_logger = structlog.get_logger("security")

async def log_security_event(
    event_type: str,
    user_id: Optional[str],
    ip_address: str,
    details: dict
):
    await security_logger.info(
        "security_event",
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address,
        timestamp=datetime.utcnow().isoformat(),
        details=details
    )

# Usage examples
await log_security_event(
    "login_success",
    user_id="user-123",
    ip_address="192.168.1.1",
    details={"provider": "google"}
)

await log_security_event(
    "login_failure",
    user_id=None,
    ip_address="192.168.1.1",
    details={"reason": "invalid_credentials", "email": "user@example.com"}
)
```

#### Monitored Events

1. **Authentication Events**
   - Successful/failed logins
   - Password changes
   - OAuth authorizations
   - Token refresh/revocation

2. **Authorization Events**
   - Permission denials
   - Role changes
   - Admin actions

3. **Data Access Events**
   - File uploads/downloads
   - Sensitive data access
   - Data exports

4. **System Events**
   - Configuration changes
   - Security policy updates
   - System errors

### Threat Detection

#### Anomaly Detection

```python
async def detect_login_anomalies(user_id: str, login_data: dict):
    recent_logins = await get_recent_logins(user_id, hours=24)

    # Detect unusual login patterns
    anomalies = []

    # Geographic anomaly
    if is_unusual_location(login_data['ip_address'], recent_logins):
        anomalies.append("unusual_location")

    # Time-based anomaly
    if is_unusual_time(login_data['timestamp'], recent_logins):
        anomalies.append("unusual_time")

    # Device anomaly
    if is_unusual_device(login_data['user_agent'], recent_logins):
        anomalies.append("unusual_device")

    if anomalies:
        await trigger_security_alert(user_id, anomalies, login_data)
```

#### Brute Force Protection

```python
async def check_brute_force(ip_address: str, email: str):
    # Check failed attempts by IP
    ip_attempts = await redis.get(f"login_attempts:ip:{ip_address}")
    if ip_attempts and int(ip_attempts) > 10:
        raise HTTPException(429, "Too many failed attempts from this IP")

    # Check failed attempts by email
    email_attempts = await redis.get(f"login_attempts:email:{email}")
    if email_attempts and int(email_attempts) > 5:
        raise HTTPException(429, "Too many failed attempts for this account")

async def record_failed_login(ip_address: str, email: str):
    # Increment IP attempts (1 hour expiry)
    await redis.incr(f"login_attempts:ip:{ip_address}")
    await redis.expire(f"login_attempts:ip:{ip_address}", 3600)

    # Increment email attempts (24 hour expiry)
    await redis.incr(f"login_attempts:email:{email}")
    await redis.expire(f"login_attempts:email:{email}", 86400)
```

---

## 🚨 Incident Response

### Security Incident Types

#### Level 1: Low Impact
- Single user account compromise
- Minor data exposure
- Failed security scans

**Response Time**: 24 hours
**Actions**:
- Reset affected user credentials
- Investigate and document incident
- Implement preventive measures

#### Level 2: Medium Impact
- Multiple account compromise
- Service disruption
- Data breach affecting <1000 users

**Response Time**: 4 hours
**Actions**:
- Isolate affected systems
- Notify affected users
- Coordinate with security team
- Legal and compliance review

#### Level 3: High Impact
- System-wide compromise
- Large-scale data breach
- Critical infrastructure attack

**Response Time**: 1 hour
**Actions**:
- Activate incident response team
- Isolate and contain breach
- Notify authorities and customers
- Engage external security experts

### Incident Response Playbook

#### 1. Detection & Analysis
```python
async def security_incident_detected(
    incident_type: str,
    severity: str,
    details: dict
):
    # Create incident record
    incident = await create_incident_record(
        type=incident_type,
        severity=severity,
        details=details,
        status="detected"
    )

    # Notify security team
    await notify_security_team(incident)

    # Start automated containment if needed
    if severity == "high":
        await initiate_automated_containment(incident)
```

#### 2. Containment
```python
async def contain_security_incident(incident_id: str):
    incident = await get_incident(incident_id)

    if incident.type == "data_breach":
        # Revoke all user sessions
        await revoke_all_sessions()
        # Disable API access
        await disable_api_access()

    elif incident.type == "account_compromise":
        # Lock affected accounts
        await lock_compromised_accounts(incident.affected_users)
        # Invalidate tokens
        await invalidate_user_tokens(incident.affected_users)

    # Update incident status
    await update_incident_status(incident_id, "contained")
```

#### 3. Recovery & Lessons Learned
```python
async def recover_from_incident(incident_id: str):
    incident = await get_incident(incident_id)

    # Restore services
    await restore_system_services()

    # Strengthen security controls
    await implement_additional_controls(incident.recommendations)

    # Update documentation
    await update_security_procedures(incident.lessons_learned)

    # Schedule post-incident review
    await schedule_post_incident_review(incident_id)
```

---

## 🛠️ Security Configuration

### Environment Security

#### Production Environment Variables

```bash
# Authentication & Encryption
JWT_SECRET_KEY=<256-bit-secret>
ENCRYPTION_KEY=<32-character-key>
JWT_ALGORITHM=RS256

# Database Security
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
DB_ENCRYPTION_ENABLED=true

# API Security
CORS_ORIGINS=["https://app.schlep-engine.com"]
ALLOWED_HOSTS=["api.schlep-engine.com"]
SECURE_COOKIES=true
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORAGE=redis

# Monitoring
SECURITY_MONITORING_ENABLED=true
AUDIT_LOGGING_ENABLED=true
SENTRY_DSN=<sentry-dsn>

# OAuth Security
OAUTH_STATE_SECRET=<oauth-state-secret>
OAUTH_PKCE_ENABLED=true
```

#### Security Headers

```python
# FastAPI security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response
```

### API Security Configuration

#### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.schlep-engine.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    expose_headers=["X-RateLimit-Remaining", "X-RateLimit-Reset"]
)
```

#### Request Size Limits

```python
# Request size limitations
MAX_REQUEST_SIZE = 100 * 1024 * 1024  # 100MB
MAX_JSON_SIZE = 10 * 1024 * 1024      # 10MB

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_SIZE:
        return JSONResponse(
            status_code=413,
            content={"error": "Request too large"}
        )
    return await call_next(request)
```

---

## 🔐 Compliance & Standards

### Data Protection Compliance

#### GDPR Compliance

**Data Subject Rights:**
- **Right to Access**: API endpoint for data export
- **Right to Rectification**: User profile update functionality
- **Right to Erasure**: Account deletion with data purging
- **Right to Portability**: Data export in machine-readable format

```python
# GDPR data export
@app.get("/api/v1/gdpr/export")
async def export_user_data(
    current_user: User = Depends(get_current_user)
):
    user_data = await collect_all_user_data(current_user.id)
    return {
        "user_profile": user_data.profile,
        "processing_history": user_data.jobs,
        "api_usage": user_data.api_calls,
        "export_date": datetime.utcnow().isoformat()
    }

# GDPR data deletion
@app.delete("/api/v1/gdpr/delete-account")
async def delete_user_account(
    current_user: User = Depends(get_current_user)
):
    await anonymize_user_data(current_user.id)
    await schedule_data_deletion(current_user.id)
    await revoke_all_user_sessions(current_user.id)
```

#### SOC 2 Compliance

**Security Controls:**
- Access control policies
- Encryption requirements
- Monitoring and logging
- Incident response procedures
- Vendor management

**Availability Controls:**
- System monitoring
- Backup procedures
- Disaster recovery
- Performance monitoring

### Security Standards

#### OWASP Top 10 Mitigation

1. **Injection**: Parameterized queries, input validation
2. **Broken Authentication**: Strong session management, MFA
3. **Sensitive Data Exposure**: Encryption, secure transmission
4. **XML External Entities**: Input validation, disable XML parsing
5. **Broken Access Control**: RBAC implementation, authorization checks
6. **Security Misconfiguration**: Secure defaults, configuration management
7. **Cross-Site Scripting**: Content Security Policy, output encoding
8. **Insecure Deserialization**: Input validation, integrity checks
9. **Components with Known Vulnerabilities**: Dependency scanning, updates
10. **Insufficient Logging**: Comprehensive audit logging, monitoring

---

## 📋 Security Checklist

### Development Security Checklist

- [ ] Input validation on all endpoints
- [ ] Output encoding for user-generated content
- [ ] Parameterized database queries
- [ ] Strong authentication mechanisms
- [ ] Proper authorization checks
- [ ] Secure session management
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Dependency vulnerability scanning
- [ ] Code security review completed

### Deployment Security Checklist

- [ ] TLS 1.3 configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] Database encryption enabled
- [ ] Backup encryption enabled
- [ ] Monitoring and alerting setup
- [ ] Incident response plan ready
- [ ] Security documentation updated

### Operational Security Checklist

- [ ] Regular security updates applied
- [ ] Access reviews conducted monthly
- [ ] Security logs monitored daily
- [ ] Vulnerability scans run weekly
- [ ] Penetration testing annually
- [ ] Security training completed
- [ ] Incident response drills quarterly
- [ ] Compliance audits scheduled

---

## 📞 Security Contacts

### Internal Security Team
- **Security Officer**: security@schlep-engine.com
- **Incident Response**: incident@schlep-engine.com
- **Compliance**: compliance@schlep-engine.com

### External Resources
- **Vulnerability Disclosure**: security-disclosure@schlep-engine.com
- **Bug Bounty Program**: https://bugcrowd.com/schlep-engine
- **Security Advisory**: https://security.schlep-engine.com

---

*Last Updated: January 2024*
*Security Guide Version: 1.0.0*
*Security Classification: Internal*