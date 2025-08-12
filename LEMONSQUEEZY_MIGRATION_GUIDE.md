# LemonSqueezy Migration Guide

This document outlines the complete migration from Stripe to LemonSqueezy payment processor for the Schlep-engine project.

## Migration Overview

The migration includes:
- ✅ Updated dependencies (removed `stripe==7.7.0`, added `lemonsqueezy==1.0.0`)
- ✅ Updated environment configuration templates
- ✅ Updated configuration files (`unified_config.py`, `api_config.py`)
- ✅ Rewritten `usage_meter.py` service for LemonSqueezy API
- ✅ Updated database models to support LemonSqueezy subscription tracking
- ✅ Created database migration script
- ✅ Comprehensive test suite for validation

## Changes Made

### 1. Dependencies (`requirements-core.txt`)
```diff
- stripe==7.7.0
+ lemonsqueezy==1.0.0
```

### 2. Environment Variables
Updated all environment template files:
- `env.development.template`
- `env.staging.template`
- `env.production.template`

```diff
- STRIPE_API_KEY=
- STRIPE_WEBHOOK_SECRET=
+ LEMONSQUEEZY_API_KEY=
+ LEMONSQUEEZY_WEBHOOK_SECRET=
```

### 3. Configuration Files

#### `app/core/unified_config.py`
```diff
- STRIPE_API_KEY: str = Field(default="", description="Stripe API key")
- STRIPE_WEBHOOK_SECRET: str = Field(default="", description="Stripe webhook secret")
+ LEMONSQUEEZY_API_KEY: str = Field(default="", description="LemonSqueezy API key")
+ LEMONSQUEEZY_WEBHOOK_SECRET: str = Field(default="", description="LemonSqueezy webhook secret")
```

#### `app/core/api_config.py`
```diff
- STRIPE_API_KEY: str = os.getenv("STRIPE_API_KEY", "")
- STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
+ LEMONSQUEEZY_API_KEY: str = os.getenv("LEMONSQUEEZY_API_KEY", "")
+ LEMONSQUEEZY_WEBHOOK_SECRET: str = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")
```

### 4. Database Models

Added LemonSqueezy fields to support subscription tracking:

#### Organization Model
```python
lemonsqueezy_subscription_id = Column(String)  # LemonSqueezy subscription ID
lemonsqueezy_customer_id = Column(String)  # LemonSqueezy customer ID
```

#### ApiKey Model
```python
lemonsqueezy_subscription_id = Column(String)  # Associated LemonSqueezy subscription
```

### 5. Usage Meter Service (`app/services/usage_meter.py`)

Complete rewrite with:
- ✅ LemonSqueezy API integration using httpx
- ✅ Rate limiting protection (300 calls/minute)
- ✅ Proper error handling and logging
- ✅ Fallback to organization subscription
- ✅ JSON:API compliant requests
- ✅ Async/await pattern maintained

## LemonSqueezy API Integration Details

### Rate Limiting
- **Main API**: 300 calls per minute
- **License API**: 60 calls per minute
- Implementation includes rate limit detection and logging

### Authentication
```python
headers = {
    "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
    "Accept": "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json"
}
```

### Usage Reporting
```python
usage_data = {
    "data": {
        "type": "usage-records",
        "attributes": {
            "quantity": units,
            "action": "increment",
            "created_at": datetime.utcnow().isoformat()
        },
        "relationships": {
            "subscription": {
                "data": {
                    "type": "subscriptions",
                    "id": subscription_id
                }
            }
        }
    }
}
```

## Database Migration

### Migration File
`alembic/versions/migrate_stripe_to_lemonsqueezy.py`

### Migration Commands
```bash
# Run the migration
cd /apps/api
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### Schema Changes
```sql
-- Add LemonSqueezy fields
ALTER TABLE organizations ADD COLUMN lemonsqueezy_subscription_id VARCHAR;
ALTER TABLE organizations ADD COLUMN lemonsqueezy_customer_id VARCHAR;
ALTER TABLE api_keys ADD COLUMN lemonsqueezy_subscription_id VARCHAR;

-- Create indexes for performance
CREATE INDEX ix_organizations_lemonsqueezy_subscription_id ON organizations(lemonsqueezy_subscription_id);
CREATE INDEX ix_organizations_lemonsqueezy_customer_id ON organizations(lemonsqueezy_customer_id);
CREATE INDEX ix_api_keys_lemonsqueezy_subscription_id ON api_keys(lemonsqueezy_subscription_id);
```

## Deployment Steps

### 1. Pre-deployment
1. **Backup Database**
   ```bash
   pg_dump your_database > backup_before_lemonsqueezy_migration.sql
   ```

2. **Set Environment Variables**
   ```bash
   export LEMONSQUEEZY_API_KEY="your_lemonsqueezy_api_key"
   export LEMONSQUEEZY_WEBHOOK_SECRET="your_webhook_secret"
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements-core.txt
   ```

### 2. Database Migration
```bash
cd apps/api
alembic upgrade head
```

### 3. Validation
```bash
python test_lemonsqueezy_migration.py
```

### 4. Production Deployment
1. Deploy updated application
2. Monitor logs for any issues
3. Verify usage tracking works correctly

## Testing

### Test Coverage
The migration includes comprehensive tests:
- ✅ API connection validation
- ✅ Usage tracking functionality
- ✅ Billing update process
- ✅ Organization subscription fallback
- ✅ Rate limiting handling
- ✅ Usage summary generation
- ✅ Error handling scenarios

### Running Tests
```bash
cd apps/api
python test_lemonsqueezy_migration.py
```

### Expected Output
```
LemonSqueezy Migration Validation Script
========================================

Migration Readiness Checklist:
========================================
✓ PASS Configuration files updated
✓ PASS Database models updated
✓ PASS Migration file created
✓ PASS Usage meter service updated
========================================
🎉 Migration is ready for deployment!

Starting LemonSqueezy migration tests...
==================================================
Testing LemonSqueezy API configuration...
✓ Usage tracking completed successfully
✓ Billing update completed successfully
✓ Organization fallback completed successfully
✓ Rate limiting handling completed successfully
✓ Usage summary completed successfully
✓ Error handling completed successfully
==================================================
TEST SUMMARY: 7/7 tests passed
🎉 All tests passed! Migration appears successful.

🎉 MIGRATION VALIDATION COMPLETE - ALL CHECKS PASSED!
The system is ready to migrate from Stripe to LemonSqueezy.
```

## Backward Compatibility

### Maintained Interfaces
- ✅ `track_api_usage()` function signature unchanged
- ✅ `get_usage_summary()` function signature unchanged
- ✅ Database fields `subscription_plan` and `subscription_status` preserved
- ✅ Existing API endpoints continue to work

### Breaking Changes
- Environment variables changed from `STRIPE_*` to `LEMONSQUEEZY_*`
- Internal Stripe-specific fields no longer populated

## Monitoring and Observability

### Logging
The migration includes comprehensive logging:
- API usage reporting success/failure
- Rate limiting warnings
- Subscription lookup issues
- API errors with status codes

### Metrics to Monitor
1. **Usage Reporting Success Rate**
   - Monitor for failures in `_report_usage_to_lemonsqueezy()`
   
2. **Rate Limiting**
   - Watch for 429 responses from LemonSqueezy API
   
3. **Subscription Resolution**
   - Monitor warnings about missing subscription IDs

### Log Examples
```
INFO: Successfully reported usage to LemonSqueezy: 10 units for operation data_processing
WARNING: LemonSqueezy rate limit exceeded. Headers: {'X-Ratelimit-Remaining': '0'}
ERROR: No LemonSqueezy subscription ID found for API key: key_abc123
```

## Rollback Plan

### If Issues Occur
1. **Immediate Rollback**
   ```bash
   # Rollback database migration
   alembic downgrade -1
   
   # Revert to previous deployment
   git checkout previous_stable_commit
   
   # Restore Stripe environment variables
   export STRIPE_API_KEY="your_stripe_key"
   export STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret"
   ```

2. **Restore Dependencies**
   ```bash
   # Revert requirements file
   sed -i 's/lemonsqueezy==1.0.0/stripe==7.7.0/' requirements-core.txt
   pip install -r requirements-core.txt
   ```

## Post-Migration Tasks

### 1. Data Migration (if needed)
- Map existing Stripe subscription IDs to LemonSqueezy
- Update customer records
- Verify billing continuity

### 2. Webhook Configuration
- Update webhook endpoints in LemonSqueezy dashboard
- Test webhook delivery
- Verify signature validation

### 3. Integration Testing
- End-to-end usage tracking
- Billing accuracy verification
- Customer notification testing

## Support and Troubleshooting

### Common Issues

#### 1. Rate Limiting
**Symptom**: HTTP 429 responses
**Solution**: Implement exponential backoff or reduce API call frequency

#### 2. Missing Subscription ID
**Symptom**: Warnings about missing LemonSqueezy subscription ID
**Solution**: Ensure subscription data is properly migrated and linked

#### 3. API Authentication
**Symptom**: HTTP 401/403 responses
**Solution**: Verify API key is correctly configured and has proper permissions

### Getting Help
- Check LemonSqueezy API documentation: https://docs.lemonsqueezy.com/api
- Review application logs for specific error messages
- Use the test script to validate configuration

## Conclusion

This migration successfully replaces Stripe with LemonSqueezy while maintaining:
- ✅ Full backward compatibility for existing interfaces
- ✅ Comprehensive error handling and logging
- ✅ Rate limiting protection
- ✅ Flexible subscription resolution (API key or organization level)
- ✅ Easy rollback capability
- ✅ Thorough test coverage

The migration is ready for production deployment with confidence in its reliability and maintainability.