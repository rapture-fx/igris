# Production Deployment Security Checklist
# Igris Overture - Critical Security Validation

This document provides a comprehensive security checklist that **MUST** be completed before deploying Igris Overture to production. Each item is marked with priority levels and includes verification steps.

## 🚨 CRITICAL SECURITY REQUIREMENTS

### ✅ 1. Environment Configuration

**Required Before Deployment:**

- [ ] **ENVIRONMENT=production** ✅ CRITICAL
  - Verify: `echo $ENVIRONMENT` returns "production"
  - Impact: Enables production security features

- [ ] **DEBUG=false** ✅ CRITICAL
  - Verify: `echo $DEBUG` returns "false"
  - Impact: Prevents debug information leakage

- [ ] **BYPASS_AUTH=false** ✅ CRITICAL
  - Verify: `echo $BYPASS_AUTH` returns "false" or is unset
  - Impact: Ensures authentication is enforced

### ✅ 2. Secret Key Security

**All secrets MUST be cryptographically secure (64+ characters):**

- [ ] **SECRET_KEY** ✅ CRITICAL
  - Length: Minimum 64 characters
  - Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
  - Verify: No placeholder values like "CHANGE_ME"

- [ ] **JWT_SECRET_KEY** ✅ CRITICAL
  - Length: Minimum 64 characters
  - Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
  - Verify: Different from SECRET_KEY

- [ ] **ENCRYPTION_KEY** ✅ CRITICAL
  - Format: Valid Fernet key (44 characters base64)
  - Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
  - Verify: Used for encrypting sensitive data

### ✅ 3. OAuth Provider Configuration

**OAuth credentials MUST be from actual provider consoles:**

#### Google OAuth ✅ CRITICAL
- [ ] **GOOGLE_CLIENT_ID** set to actual value from Google Cloud Console
  - Verify: Ends with `.apps.googleusercontent.com`
  - Source: https://console.cloud.google.com/apis/credentials

- [ ] **GOOGLE_CLIENT_SECRET** set to actual value from Google Cloud Console
  - Verify: No placeholder like "REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_SECRET"
  - Length: Typically 24+ characters

#### GitHub OAuth ✅ CRITICAL
- [ ] **GITHUB_CLIENT_ID** set to actual value from GitHub OAuth App
  - Verify: No placeholder like "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_ID"
  - Length: Typically 20+ characters

- [ ] **GITHUB_CLIENT_SECRET** set to actual value from GitHub OAuth App
  - Verify: No placeholder like "REPLACE_WITH_ACTUAL_GITHUB_CLIENT_SECRET"
  - Length: Typically 40+ characters

#### OAuth Security Settings ✅ HIGH
- [ ] **OAUTH_REDIRECT_URI** set to production domain
  - Format: `https://yourdomain.com/api/v1/auth/oauth/callback`
  - Verify: Uses HTTPS, not HTTP

### ✅ 4. Database Security

**Database credentials MUST be production-ready:**

- [ ] **POSTGRES_PASSWORD** ✅ CRITICAL
  - Length: Minimum 32 characters
  - Complexity: Mix of uppercase, lowercase, numbers, symbols
  - Verify: Not a common password

- [ ] **POSTGRES_USER** ✅ HIGH
  - Verify: Not default values like "postgres", "admin", "root"
  - Recommendation: Use application-specific username

- [ ] **POSTGRES_HOST** ✅ HIGH
  - Verify: Points to production database server
  - Security: Ensure network access is restricted

- [ ] **POSTGRES_SSLMODE** ✅ HIGH
  - Value: "require" for production
  - Verify: SSL/TLS connection to database

### ✅ 5. Redis Security

**Redis MUST be secured for session storage:**

- [ ] **REDIS_PASSWORD** ✅ CRITICAL
  - Length: Minimum 32 characters
  - Complexity: Cryptographically random
  - Verify: Not a default or weak password

- [ ] **REDIS_SSL=true** ✅ HIGH
  - Verify: Encrypted connection to Redis
  - Impact: Protects session data in transit

### ✅ 6. CORS and Network Security

**Network access MUST be restricted:**

- [ ] **ALLOWED_ORIGINS** ✅ CRITICAL
  - Format: Comma-separated list of allowed domains
  - Example: `https://yourdomain.com,https://app.yourdomain.com`
  - Verify: No wildcard "*" in production
  - Verify: No localhost or development domains

- [ ] **ALLOWED_HOSTS** ✅ CRITICAL
  - Format: Comma-separated list of allowed hostnames
  - Example: `yourdomain.com,app.yourdomain.com,api.yourdomain.com`
  - Verify: No wildcard "*" in production

### ✅ 7. SSL/TLS Configuration

**HTTPS MUST be enforced:**

- [ ] **FORCE_HTTPS=true** ✅ CRITICAL
  - Verify: All traffic redirected to HTTPS
  - Impact: Prevents man-in-the-middle attacks

- [ ] **SSL_EMAIL** set for certificate management ✅ HIGH
  - Format: Valid email address for Let's Encrypt
  - Example: `admin@yourdomain.com`

### ✅ 8. Security Middleware

**All security middleware MUST be enabled:**

- [ ] **CSRF_PROTECTION_ENABLED=true** ✅ CRITICAL
  - Verify: CSRF attacks are prevented
  - Impact: Protects against cross-site request forgery

- [ ] **RATE_LIMITING_ENABLED=true** ✅ CRITICAL
  - Verify: API rate limiting is active
  - Impact: Prevents abuse and DoS attacks

- [ ] **CSRF_SECRET** ✅ HIGH
  - Length: Minimum 32 characters
  - Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

## 🔧 SECURITY VALIDATION TOOLS

### Automated Security Validation

Run the production security validator before deployment:

```bash
# Validate production configuration
python security/production-security-validator.py --env-file .env.production

# Run OAuth security validation
python security/oauth-security-validator-enhanced.py

# Check for security issues
python security/validate-oauth-security.py
```

### Expected Validation Results

**Security validator MUST show:**
- ✅ 0 Critical issues
- ✅ 0 High priority issues
- ⚠️ Acceptable medium/low issues

**OAuth validator MUST show:**
- ✅ All providers configured
- ✅ No placeholder credentials
- ✅ Valid OAuth token flows

## 📋 PRE-DEPLOYMENT VERIFICATION

### Manual Security Checks

**Before deploying, verify each of these manually:**

1. **Environment Variables Check**
   ```bash
   # Verify critical environment variables are set
   echo "Environment: $ENVIRONMENT"
   echo "Debug: $DEBUG"
   echo "Bypass Auth: $BYPASS_AUTH"
   echo "CSRF Enabled: $CSRF_PROTECTION_ENABLED"
   echo "Rate Limiting: $RATE_LIMITING_ENABLED"
   ```

2. **Secret Validation**
   ```bash
   # Check secret lengths (should be 64+ chars)
   echo ${#SECRET_KEY}
   echo ${#JWT_SECRET_KEY}
   echo ${#POSTGRES_PASSWORD}
   echo ${#REDIS_PASSWORD}
   ```

3. **OAuth Configuration Check**
   ```bash
   # Verify OAuth providers are not placeholders
   echo $GOOGLE_CLIENT_ID | grep -v "REPLACE_WITH"
   echo $GITHUB_CLIENT_ID | grep -v "REPLACE_WITH"
   ```

4. **Network Security Check**
   ```bash
   # Verify CORS restrictions
   echo "Allowed Origins: $ALLOWED_ORIGINS"
   echo "Allowed Hosts: $ALLOWED_HOSTS"
   echo "Force HTTPS: $FORCE_HTTPS"
   ```

### OAuth Provider Verification

**Google OAuth Setup:**
1. [ ] Google Cloud Console project created
2. [ ] OAuth consent screen configured
3. [ ] Authorized redirect URIs include production domain
4. [ ] API credentials generated and configured
5. [ ] Scopes limited to: `openid email profile`

**GitHub OAuth Setup:**
1. [ ] GitHub OAuth App created
2. [ ] Authorization callback URL set to production domain
3. [ ] Client ID and secret generated
4. [ ] Application permissions reviewed

### Database Security Verification

1. [ ] Database server accessible only from application servers
2. [ ] Database user has minimal required permissions
3. [ ] SSL/TLS connection verified
4. [ ] Database backups encrypted and secured
5. [ ] Connection pooling configured appropriately

### Redis Security Verification

1. [ ] Redis server password protected
2. [ ] Redis accessible only from application servers
3. [ ] SSL/TLS connection verified
4. [ ] Redis configuration reviewed for security
5. [ ] Persistence settings appropriate for use case

## 🚨 SECURITY INCIDENT RESPONSE

### If Security Issues Are Found

**CRITICAL Issues (Must Fix Before Deployment):**
- Environment variables missing or misconfigured
- Placeholder secrets in production
- OAuth providers not properly configured
- Database/Redis credentials weak or missing
- HTTPS not enforced

**HIGH Priority Issues (Fix ASAP):**
- CORS not properly restricted
- SSL/TLS not fully configured
- Rate limiting disabled
- Weak password policies

**Action Steps:**
1. **Stop deployment immediately**
2. **Fix security issues**
3. **Re-run security validation**
4. **Verify fixes in staging environment**
5. **Document changes in security log**

### Security Monitoring Setup

After deployment, ensure these are configured:

1. [ ] **Error Tracking** (Sentry DSN configured)
2. [ ] **Security Event Logging** (Audit logs enabled)
3. [ ] **Rate Limiting Alerts** (Monitor abuse attempts)
4. [ ] **Authentication Failure Alerts** (Monitor auth attacks)
5. [ ] **SSL Certificate Monitoring** (Expiration alerts)

## ✅ FINAL DEPLOYMENT CHECKLIST

### Pre-Deployment Final Check

- [ ] All CRITICAL items completed above
- [ ] Security validation tools pass with 0 critical/high issues
- [ ] Staging environment tested with production-like security
- [ ] OAuth flows tested end-to-end
- [ ] Database migrations completed successfully
- [ ] SSL certificates valid and properly configured
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery tested
- [ ] Team notified of deployment

### Post-Deployment Verification

**Immediately after deployment:**

1. [ ] **Application starts successfully**
   - Check logs for security middleware loading
   - Verify no critical errors in startup

2. [ ] **OAuth authentication works**
   - Test Google OAuth flow
   - Test GitHub OAuth flow
   - Verify user creation and login

3. [ ] **Security headers present**
   - Check HTTPS redirection
   - Verify CSRF protection active
   - Confirm rate limiting working

4. [ ] **Database connectivity**
   - Verify SSL connection to PostgreSQL
   - Test Redis connection with SSL

5. [ ] **Monitoring active**
   - Confirm error tracking receiving events
   - Verify security event logging
   - Check metric collection

### Security Documentation

- [ ] **Document all OAuth app configurations**
- [ ] **Record all external service integrations**
- [ ] **Update incident response procedures**
- [ ] **Schedule regular security reviews**
- [ ] **Plan secret rotation schedule**

## 🔄 ONGOING SECURITY MAINTENANCE

### Regular Security Tasks

**Weekly:**
- [ ] Review security logs and alerts
- [ ] Check for failed authentication attempts
- [ ] Monitor rate limiting triggers

**Monthly:**
- [ ] Review and rotate API keys
- [ ] Update OAuth app configurations
- [ ] Audit user access and permissions
- [ ] Check SSL certificate expiration

**Quarterly:**
- [ ] Rotate all production secrets
- [ ] Review and update security policies
- [ ] Penetration testing or security audit
- [ ] Update incident response procedures

---

## ⚠️ CRITICAL REMINDER

**DO NOT DEPLOY TO PRODUCTION** until ALL critical security requirements are met.

A single misconfigured security setting can compromise the entire application and user data.

**When in doubt, consult the security team and run additional validation tests.**

---

**Document Version:** 1.0
**Last Updated:** $(date)
**Review Required:** Before every production deployment