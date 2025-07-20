# Networking & Security

This document describes the networking and security features implemented for the Schlep-engine backend, including dynamic CORS origins and SSL/TLS configuration.

## Overview

The application implements comprehensive networking and security features:

- **Dynamic CORS Origins**: Environment-specific CORS configuration with security validation
- **SSL/TLS Support**: Secure communication with environment-specific security levels
- **Security Headers**: Comprehensive security headers for protection against common attacks
- **Rate Limiting**: Environment-appropriate rate limiting at the Nginx level
- **HTTPS Enforcement**: Automatic HTTP to HTTPS redirection in production/staging

## Dynamic CORS Configuration

### Features

- **Environment-Specific Origins**: Different CORS origins for development, staging, and production
- **HTTPS Enforcement**: Automatic rejection of non-HTTPS origins in production/staging
- **Security Validation**: Validation of origin format and security requirements
- **Custom Origins**: Support for additional origins via environment variables

### Configuration

CORS origins are configured in the unified configuration system:

```python
# Development
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000

# Staging
BACKEND_CORS_ORIGINS=https://staging.schlep-engine.com,https://staging-admin.schlep-engine.com

# Production
BACKEND_CORS_ORIGINS=https://schlep-engine.com,https://www.schlep-engine.com
```

### Security Features

1. **HTTPS Enforcement**: In production and staging, only HTTPS origins are allowed
2. **Origin Validation**: Invalid origin formats are automatically rejected
3. **Security Headers**: CORS responses include security headers
4. **Logging**: CORS violations are logged for monitoring

### Usage

```python
from app.middleware.cors_middleware import setup_cors_middleware

# In your FastAPI app
app = FastAPI()
setup_cors_middleware(app)
```

## SSL/TLS Configuration

### Features

- **Environment-Specific Security**: Different SSL configurations for each environment
- **Certificate Management**: Support for file-based and cloud-managed certificates
- **Security Levels**: Maximum security in production, moderate in staging, flexible in development
- **Certificate Validation**: Automatic validation of certificate and key files
- **Nginx Integration**: Generated Nginx SSL configuration

### Environment Requirements

#### Development
- SSL is optional
- Self-signed certificates supported
- More permissive cipher suites

#### Staging
- SSL is required
- Moderate security settings
- TLS 1.2+ required

#### Production
- SSL is required
- Maximum security settings
- TLS 1.2-1.3 only
- Strong cipher suites only

### Certificate Generation

Use the provided script to generate self-signed certificates:

```bash
# Generate development certificate
python scripts/generate_ssl_cert.py development

# Generate staging certificate
python scripts/generate_ssl_cert.py staging

# Generate production certificate (for testing)
python scripts/generate_ssl_cert.py production
```

### Configuration

Set SSL certificate paths in your environment file:

```bash
# Development (.env.development)
SSL_CERT_PATH=./ssl/development.crt
SSL_KEY_PATH=./ssl/development.key
SSL_CA_PATH=./ssl/development_ca.crt

# Staging/Production (via environment variables)
export SSL_CERT_PATH=/path/to/certificate.crt
export SSL_KEY_PATH=/path/to/private.key
export SSL_CA_PATH=/path/to/ca.crt
```

### Usage

```python
from app.core.ssl_config import get_ssl_context, get_uvicorn_ssl_config

# Get SSL context for custom server
ssl_context = get_ssl_context()

# Get Uvicorn SSL configuration
ssl_config = get_uvicorn_ssl_config()
```

## Security Headers

### Implemented Headers

1. **Strict-Transport-Security (HSTS)**
   - Production: `max-age=63072000; includeSubDomains; preload`
   - Staging: `max-age=31536000; includeSubDomains`

2. **X-Frame-Options**: `SAMEORIGIN`

3. **X-Content-Type-Options**: `nosniff`

4. **X-XSS-Protection**: `1; mode=block`

5. **Referrer-Policy**: `strict-origin-when-cross-origin`

6. **Content-Security-Policy**: Environment-specific policies

### Content Security Policy

#### Production/Staging
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https:;
frame-ancestors 'none';
```

#### Development
- More permissive for easier development
- CSP headers are still included but with relaxed policies

## Nginx Configuration

### SSL Configuration

The application provides an Nginx configuration with SSL support:

```nginx
# SSL Configuration
ssl_certificate /path/to/certificate.crt;
ssl_certificate_key /path/to/private.key;

# Security Settings
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
```

### Rate Limiting

Nginx implements rate limiting at the proxy level:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# API endpoints
location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... proxy configuration
}

# Authentication endpoints
location /api/v1/auth/ {
    limit_req zone=login burst=5 nodelay;
    # ... proxy configuration
}
```

### Security Features

1. **HTTP to HTTPS Redirect**: All HTTP traffic is redirected to HTTPS
2. **Rate Limiting**: Different limits for different endpoint types
3. **Access Control**: Metrics endpoint restricted to internal networks
4. **Security Headers**: Comprehensive security headers on all responses
5. **Gzip Compression**: Optimized compression for better performance

## Deployment Checklist

### Development
- [ ] Generate SSL certificate: `python scripts/generate_ssl_cert.py development`
- [ ] Update `.env.development` with SSL paths
- [ ] Test HTTPS access
- [ ] Verify CORS origins work correctly

### Staging
- [ ] Obtain SSL certificate from trusted CA
- [ ] Set SSL certificate paths via environment variables
- [ ] Configure Nginx with SSL configuration
- [ ] Test HTTPS enforcement
- [ ] Verify security headers
- [ ] Test rate limiting

### Production
- [ ] Obtain SSL certificate from trusted CA
- [ ] Set SSL certificate paths via secrets manager
- [ ] Configure Nginx with production SSL settings
- [ ] Enable HSTS preload
- [ ] Test all security features
- [ ] Monitor SSL certificate expiration
- [ ] Configure certificate auto-renewal

## Security Best Practices

### 1. Certificate Management
- Use certificates from trusted Certificate Authorities in production
- Implement automatic certificate renewal
- Monitor certificate expiration dates
- Use strong private keys (2048-bit RSA or ECDSA)

### 2. CORS Security
- Only allow necessary origins
- Enforce HTTPS in production/staging
- Regularly review and update allowed origins
- Monitor CORS violation logs

### 3. SSL/TLS Security
- Use TLS 1.2+ in production
- Implement strong cipher suites
- Enable OCSP stapling
- Configure HSTS headers

### 4. Rate Limiting
- Implement appropriate rate limits for different endpoints
- Monitor rate limiting violations
- Adjust limits based on usage patterns
- Use different limits for authenticated vs unauthenticated requests

### 5. Security Headers
- Implement all recommended security headers
- Regularly review and update CSP policies
- Monitor security header violations
- Test security headers in different browsers

## Troubleshooting

### Common Issues

#### 1. CORS Errors
```bash
# Check CORS configuration
python -c "from app.core.unified_config import settings; print(settings.secure_cors_origins)"

# Check browser console for CORS errors
# Verify origin is in allowed list
```

#### 2. SSL Certificate Issues
```bash
# Validate certificate
python -c "from app.core.ssl_config import validate_certificate; print(validate_certificate())"

# Check certificate expiration
openssl x509 -in /path/to/cert.crt -text -noout | grep "Not After"
```

#### 3. Nginx SSL Issues
```bash
# Test Nginx configuration
nginx -t

# Check SSL configuration
nginx -T | grep ssl

# Test SSL connection
openssl s_client -connect localhost:443 -servername your-domain.com
```

#### 4. Rate Limiting Issues
```bash
# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Test rate limiting
for i in {1..20}; do curl -I https://your-domain.com/api/health; done
```

## Monitoring and Alerting

### SSL Certificate Monitoring
- Monitor certificate expiration dates
- Set up alerts for certificates expiring within 30 days
- Monitor SSL/TLS protocol usage
- Track cipher suite usage

### CORS Monitoring
- Monitor CORS violation logs
- Track blocked origins
- Monitor CORS preflight requests
- Alert on unusual CORS patterns

### Security Header Monitoring
- Monitor security header violations
- Track CSP violations
- Monitor HSTS preload status
- Alert on missing security headers

### Rate Limiting Monitoring
- Monitor rate limiting violations
- Track API usage patterns
- Monitor authentication failures
- Alert on unusual traffic patterns

## Future Enhancements

### Planned Features
1. **Certificate Auto-Renewal**: Automated certificate renewal using Let's Encrypt
2. **Advanced Rate Limiting**: User-based and IP-based rate limiting
3. **WAF Integration**: Web Application Firewall integration
4. **Security Scanning**: Automated security vulnerability scanning
5. **Zero-Downtime SSL**: Certificate rotation without service interruption 