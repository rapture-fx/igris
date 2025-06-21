# Security Middleware Documentation

Comprehensive security middleware package that provides multiple layers of protection for FastAPI applications with minimal code changes to existing endpoints.

## Features

### 1. Audit Middleware (`audit_middleware.py`)
- **Comprehensive request/response logging** with structured JSON format
- **Security event detection** (failed auth, suspicious patterns, rate limit violations)
- **Sensitive data redaction** for compliance requirements
- **Performance metrics** and timing analysis
- **IP tracking and user context** for security monitoring
- **Integration with SIEM systems** through structured logging

### 2. Encryption Middleware (`encryption_middleware.py`)
- **Field-level encryption** for sensitive response data
- **Multiple algorithms** (AES-256-GCM, ChaCha20-Poly1305)
- **Key management and rotation** with PBKDF2 key derivation
- **Automatic sensitive field detection** (passwords, tokens, API keys)
- **Configurable encryption rules** per field type
- **HSM integration support** for enterprise environments

### 3. Security Headers Middleware (`security_headers_middleware.py`)
- **Content Security Policy (CSP)** with nonce generation
- **HTTP Strict Transport Security (HSTS)** for HTTPS enforcement
- **Frame Options** for clickjacking protection
- **Content Type Options** to prevent MIME sniffing
- **XSS Protection** headers and filtering
- **Permissions Policy** for feature access control
- **Cross-Origin policies** (COEP, COOP, CORP)

### 4. Enhanced Rate Limiting (`rate_limiting_middleware.py`)
- **Multiple strategies** (fixed window, sliding window, token bucket)
- **Multi-scope limiting** (IP, user, API key, endpoint, global)
- **Redis-backed distributed limiting** with fallback to in-memory
- **Burst allowances** and graceful degradation
- **IP whitelist/blacklist** support
- **Rate limit headers** (X-RateLimit-*) for client information

### 5. Security Decorators (`security_decorators.py`)
- **Input validation** with pattern detection for SQL injection, XSS
- **CSRF protection** with token generation and validation
- **Response sanitization** to remove sensitive data
- **Combined security stack** decorator for comprehensive protection
- **Flexible configuration** for different security requirements

## Quick Start

### 1. Install Dependencies

```bash
pip install cryptography redis bleach
```

### 2. Basic Usage with Decorators

```python
from app.security.middleware import (
    security_middleware_stack,
    audit_request,
    encrypt_response,
    enhanced_rate_limit
)

# Comprehensive security for an endpoint
@security_middleware_stack(
    validate_input=True,
    csrf_protection_enabled=True,
    rate_limit_per_minute=30
)
async def secure_endpoint(request: Request, data: dict):
    return {"message": "Secure endpoint", "data": data}

# Individual security features
@audit_request()
@encrypt_response(['password', 'api_key'])
@enhanced_rate_limit(requests_per_minute=60)
async def protected_endpoint(request: Request):
    return {"sensitive_data": "encrypted automatically"}
```

### 3. Application-Level Integration

```python
from fastapi import FastAPI
from app.security.middleware import apply_security_middleware_stack

app = FastAPI()

# Apply all security middleware
apply_security_middleware_stack(app)
```

## Configuration

### Environment Variables

```bash
# Encryption
ENCRYPTION_MASTER_KEY=base64_encoded_key

# Redis for rate limiting
REDIS_URL=redis://localhost:6379

# Environment
ENVIRONMENT=production  # or development, staging
```

### Security Configuration Examples

#### Development (Lenient)
```python
dev_config = {
    "audit": {
        "enabled": True,
        "log_level": "DEBUG",
        "include_request_body": True
    },
    "encryption": {
        "enabled": False  # Disabled for development
    },
    "headers": {
        "csp_report_only": True,  # Report-only mode
        "hsts_enabled": False
    },
    "rate_limiting": {
        "default_requests_per_minute": 120,
        "graceful_degradation": True
    }
}
```

#### Production (Strict)
```python
prod_config = {
    "audit": {
        "enabled": True,
        "log_level": "INFO",
        "include_request_body": False,  # Performance
        "sensitive_fields": ["password", "token", "secret"]
    },
    "encryption": {
        "enabled": True,
        "algorithm": "AES-256-GCM",
        "sensitive_fields": ["password", "token", "api_key"]
    },
    "headers": {
        "csp_enabled": True,
        "hsts_enabled": True,
        "hsts_max_age": 31536000,
        "frame_options": "DENY"
    },
    "rate_limiting": {
        "default_requests_per_minute": 60,
        "block_on_limit": True,
        "adaptive_limits": True
    }
}
```

## Decorator Reference

### @security_middleware_stack
Comprehensive security stack combining multiple protections:

```python
@security_middleware_stack(
    validate_input=True,                    # Input validation
    csrf_protection_enabled=True,           # CSRF protection
    xss_protection_enabled=True,            # XSS protection
    sql_injection_protection_enabled=True,  # SQL injection protection
    rate_limit_per_minute=30,              # Rate limiting
    require_auth=False,                     # Authentication requirement
    allowed_content_types=["application/json"],  # Content type validation
    max_request_size=10*1024*1024          # Max request size (10MB)
)
```

### @audit_request
Request and response auditing:

```python
@audit_request(
    level="INFO",                # Logging level
    include_request=True,        # Log request body
    include_response=False,      # Log response body
    sensitive_fields=["password"]  # Additional sensitive fields
)
```

### @encrypt_response
Automatic field encryption:

```python
@encrypt_response(
    sensitive_fields=['api_key', 'token'],  # Fields to encrypt
    algorithm=EncryptionAlgorithm.AES_256_GCM,  # Encryption algorithm
    exclude_fields=['public_data']          # Fields to exclude
)
```

### @enhanced_rate_limit
Advanced rate limiting:

```python
@enhanced_rate_limit(
    requests_per_minute=60,                 # Per-minute limit
    requests_per_hour=1000,                # Per-hour limit
    strategy=RateLimitingStrategy.SLIDING_WINDOW,  # Algorithm
    scope=RateLimitScope.USER,             # Limiting scope
    burst_allowance=10                     # Burst capacity
)
```

### @security_headers
Custom security headers:

```python
@security_headers(
    csp_override={
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"]
    },
    additional_headers={
        "X-API-Version": "v1.0"
    }
)
```

### Individual Protection Decorators

```python
@validate_input(max_string_length=1000, allow_html=False)
@csrf_protection(require_token=True)
@xss_protection(strict_mode=True)
@sql_injection_protection(strict_mode=True)
@sanitize_response(remove_sensitive_fields=True)
```

## Security Features in Detail

### Input Validation
- **Pattern detection** for common attack vectors
- **Length validation** to prevent DoS attacks
- **Type validation** with automatic sanitization
- **HTML sanitization** using bleach library
- **Email and URL validation** with scheme checking

### Encryption
- **Authenticated encryption** (AEAD) for data integrity
- **Key derivation** using PBKDF2 with configurable iterations
- **Field-level encryption** preserving data structure
- **Automatic key rotation** support
- **Performance optimization** with async operations

### Rate Limiting
- **Fixed window**: Simple, memory efficient
- **Sliding window**: More accurate, prevents burst at window boundaries
- **Token bucket**: Allows controlled bursts
- **Hierarchical limits**: Global, user, endpoint specific
- **Distributed limiting**: Redis-backed for multi-instance deployments

### Audit Logging
- **Structured JSON logging** for easy parsing
- **Security event classification** with severity levels
- **Request fingerprinting** for pattern analysis
- **Performance metrics** for optimization
- **GDPR compliance** with sensitive data redaction

## Integration with Existing Code

### Minimal Changes Required

Before (existing endpoint):
```python
async def my_endpoint(request: Request, data: dict):
    return {"result": process_data(data)}
```

After (secured endpoint):
```python
@security_middleware_stack()  # One line addition
async def my_endpoint(request: Request, data: dict):
    return {"result": process_data(data)}
```

### Gradual Security Enhancement

1. **Start with basic protection**:
   ```python
   @validate_input()
   @enhanced_rate_limit(requests_per_minute=60)
   ```

2. **Add audit logging**:
   ```python
   @audit_request()
   @validate_input()
   @enhanced_rate_limit(requests_per_minute=60)
   ```

3. **Full security stack**:
   ```python
   @security_middleware_stack()
   ```

## Monitoring and Alerts

### Log Analysis
Security logs are structured JSON for easy analysis:

```json
{
  "event_type": "security_event",
  "security_event_type": "auth_failure",
  "severity": "WARNING",
  "ip_address": "192.168.1.100",
  "endpoint": "/api/login",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Metrics to Monitor
- **Authentication failures** per IP/user
- **Rate limit violations** and patterns
- **Input validation failures** and attack attempts
- **Response times** and performance impact
- **Encryption operations** and key usage

### SIEM Integration
Security events can be forwarded to SIEM systems:
- **Splunk**: Use HTTP Event Collector
- **ELK Stack**: Direct log shipping
- **AWS CloudWatch**: Via AWS logging agent
- **Custom**: REST API webhook integration

## Performance Considerations

### Optimization Strategies
1. **Async operations** for encryption and Redis
2. **Connection pooling** for Redis client
3. **Compiled regex patterns** for validation
4. **Memory cleanup** for rate limiting data
5. **Configurable body size limits** to prevent DoS

### Performance Impact
- **Audit logging**: ~1-2ms per request
- **Input validation**: ~0.5ms per request
- **Encryption**: ~2-5ms per sensitive field
- **Rate limiting**: ~0.5ms (Redis) / ~0.1ms (memory)
- **Security headers**: ~0.1ms per request

### Scaling Recommendations
- Use **Redis cluster** for distributed rate limiting
- Enable **audit log rotation** to manage disk space
- Configure **appropriate rate limits** based on capacity
- Monitor **memory usage** for in-memory components

## Security Best Practices

### Deployment
1. **Use environment variables** for sensitive configuration
2. **Enable TLS/SSL** for all communications
3. **Rotate encryption keys** regularly
4. **Monitor security logs** continuously
5. **Update dependencies** for security patches

### Configuration
1. **Start with strict defaults** and relax as needed
2. **Use report-only mode** for CSP during development
3. **Configure appropriate rate limits** for your use case
4. **Enable audit logging** in production
5. **Test security features** in staging environment

### Incident Response
1. **Set up alerts** for security violations
2. **Have runbooks** for common security events
3. **Practice incident response** procedures
4. **Maintain security documentation** up to date
5. **Regular security reviews** and updates

## Troubleshooting

### Common Issues

#### Rate Limiting Not Working
- Check Redis connection
- Verify middleware order
- Check excluded paths configuration

#### Encryption Failures
- Verify master key configuration
- Check cryptography library installation
- Monitor key rotation timing

#### Security Headers Missing
- Check middleware application order
- Verify environment configuration
- Check CSP policy syntax

#### High Memory Usage
- Enable periodic cleanup
- Adjust rate limiting window sizes
- Monitor audit log retention

### Debug Mode
Enable debug logging for troubleshooting:

```python
import logging
logging.getLogger("app.security").setLevel(logging.DEBUG)
```

## License and Support

This security middleware is part of the Sherringfords AI-Powered Data Intelligence project and follows the same licensing terms. For support and contributions, please refer to the main project documentation. 