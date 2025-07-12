# Configuration & Secrets Management

This document describes the unified configuration system for the Schlep-engine backend, including environment-specific settings and secure secrets management.

## Overview

The application uses a unified configuration system that:
- Loads all settings from environment variables
- Supports environment-specific configuration files
- Validates required secrets and settings
- Provides secure defaults for different environments
- Supports integration with cloud secrets managers

## Configuration Structure

### Primary Configuration File
- **`app/core/unified_config.py`** - Single source of truth for all configuration
- Uses Pydantic Settings for validation and type safety
- Loads environment-specific `.env` files automatically

### Environment-Specific Templates
- **`env.development.template`** - Development environment settings
- **`env.staging.template`** - Staging environment settings  
- **`env.production.template`** - Production environment settings

## Environment Setup

### 1. Development Environment

```bash
# Copy the development template
cp env.development.template .env.development

# Generate secure secrets for development
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"

# Edit .env.development with your local settings
nano .env.development
```

### 2. Staging Environment

```bash
# Copy the staging template
cp env.staging.template .env.staging

# Set environment variable to use staging config
export ENVIRONMENT=staging

# Set secrets via environment variables or secrets manager
export JWT_SECRET_KEY="your_staging_jwt_secret"
export ENCRYPTION_KEY="your_staging_encryption_key"
```

### 3. Production Environment

```bash
# Copy the production template
cp env.production.template .env.production

# Set environment variable to use production config
export ENVIRONMENT=production

# Set secrets via environment variables or secrets manager
export JWT_SECRET_KEY="your_production_jwt_secret"
export ENCRYPTION_KEY="your_production_encryption_key"
```

## Required Environment Variables

### Critical Secrets (Must be set)
- `JWT_SECRET_KEY` - JWT signing key (min 32 chars)
- `ENCRYPTION_KEY` - Data encryption key (min 32 chars)

### Database Configuration
- `DATABASE_URL` - Full PostgreSQL connection string
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Individual DB components
- `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` - Connection pooling settings

### Redis Configuration
- `REDIS_URL` - Full Redis connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB` - Individual Redis components

### Security Settings
- `RATE_LIMIT_PER_MINUTE` - API rate limiting
- `RATE_LIMIT_PER_HOUR` - Hourly rate limiting
- `ENHANCED_AUTH_ENABLED` - Enable enhanced authentication

### External Services
- `STRIPE_API_KEY` - Stripe API key for payments
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification secret

## Environment-Specific Features

### Development
- Debug mode enabled
- Relaxed rate limiting (1000 req/min)
- Local database and Redis
- Security features disabled for easier development
- Detailed logging

### Staging
- Debug mode disabled
- Moderate rate limiting (200 req/min)
- Production-like security settings
- Staging database and Redis
- Full monitoring enabled

### Production
- Debug mode disabled
- Strict rate limiting (60 req/min)
- Maximum security settings
- Production database and Redis
- Full monitoring and compliance

## Secrets Management

### Local Development
Use `.env.development` file with development secrets:
```bash
# Generate development secrets
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Staging/Production
Use environment variables or integrate with a secrets manager:

#### Option 1: Environment Variables
```bash
export JWT_SECRET_KEY="your_secure_jwt_secret"
export ENCRYPTION_KEY="your_secure_encryption_key"
```

#### Option 2: AWS Secrets Manager (Recommended for Production)
```python
# Example integration (to be implemented)
import boto3
from botocore.exceptions import ClientError

def get_secret(secret_name):
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name='us-east-1'
    )
    
    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        raise e
    else:
        if 'SecretString' in get_secret_value_response:
            return json.loads(get_secret_value_response['SecretString'])
```

#### Option 3: HashiCorp Vault
```python
# Example integration (to be implemented)
import hvac

def get_vault_secret(secret_path):
    client = hvac.Client(
        url='https://vault.example.com:8200',
        token='your-vault-token'
    )
    
    secret = client.secrets.kv.v2.read_secret_version(
        path=secret_path,
        mount_point='secret'
    )
    return secret['data']['data']
```

## Configuration Validation

The unified config includes validation for:
- Required secrets (JWT_SECRET_KEY, ENCRYPTION_KEY)
- Minimum secret lengths (32 characters)
- Environment-specific settings
- Database connection parameters

### Validation Errors
If validation fails, the application will not start and will display specific error messages:
```
ValueError: JWT_SECRET_KEY must be set via environment variable
ValueError: JWT_SECRET_KEY must be at least 32 characters long
```

## Migration from Old Config

### Old Config Files (Deprecated)
- `app/core/config.py` - Legacy config (will be removed)
- `app/core/api_config.py` - Legacy API config (will be removed)

### Migration Steps
1. Update imports to use `app.core.unified_config`
2. Replace `settings.SQLALCHEMY_DATABASE_URI` with `settings.DATABASE_URL`
3. Use `settings.JWT_SECRET_KEY` instead of `settings.SECRET_KEY`
4. Update any hardcoded values to use environment variables

### Example Migration
```python
# Old
from app.core.config import settings
database_url = settings.SQLALCHEMY_DATABASE_URI

# New
from app.core.unified_config import settings
database_url = settings.DATABASE_URL
```

## Security Best Practices

### 1. Never Commit Secrets
- `.env.*` files are in `.gitignore`
- Use templates for documentation
- Set secrets via environment variables in deployment

### 2. Use Strong Secrets
- Generate secrets using `secrets.token_urlsafe(32)`
- Rotate secrets regularly
- Use different secrets for each environment

### 3. Environment Isolation
- Use separate databases for each environment
- Use different Redis instances
- Use environment-specific API keys

### 4. Secrets Rotation
- Implement automated secrets rotation
- Use secrets manager for production
- Monitor secret expiration

## Troubleshooting

### Common Issues

#### 1. Configuration Not Loading
```bash
# Check environment variable
echo $ENVIRONMENT

# Check if .env file exists
ls -la .env.*

# Check file permissions
chmod 600 .env.production
```

#### 2. Validation Errors
```bash
# Check secret lengths
echo $JWT_SECRET_KEY | wc -c
echo $ENCRYPTION_KEY | wc -c

# Generate new secrets if needed
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### 3. Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection parameters
echo $DATABASE_URL
```

## Deployment Checklist

### Development
- [ ] Copy `env.development.template` to `.env.development`
- [ ] Generate development secrets
- [ ] Update database connection details
- [ ] Test configuration validation

### Staging
- [ ] Copy `env.staging.template` to `.env.staging`
- [ ] Set `ENVIRONMENT=staging`
- [ ] Configure staging secrets via environment variables
- [ ] Update staging database and Redis URLs
- [ ] Test all security features

### Production
- [ ] Copy `env.production.template` to `.env.production`
- [ ] Set `ENVIRONMENT=production`
- [ ] Configure production secrets via secrets manager
- [ ] Update production database and Redis URLs
- [ ] Enable all security features
- [ ] Test rate limiting and monitoring
- [ ] Verify CORS settings

## Future Enhancements

### Planned Features
1. **Cloud Secrets Manager Integration**
   - AWS Secrets Manager
   - Google Secret Manager
   - Azure Key Vault
   - HashiCorp Vault

2. **Configuration Hot Reloading**
   - Runtime configuration updates
   - Feature flag management
   - Dynamic rate limiting

3. **Configuration Validation UI**
   - Web interface for configuration validation
   - Environment comparison tools
   - Configuration drift detection

4. **Secrets Rotation**
   - Automated secrets rotation
   - Zero-downtime rotation
   - Rotation monitoring and alerting 