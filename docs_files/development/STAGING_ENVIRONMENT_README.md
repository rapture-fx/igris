# Staging Environment Documentation

## Overview

The staging environment for Schlep-engine is designed to mirror production for pre-deployment testing. It provides a complete, isolated environment where features can be tested before being deployed to production.

## Architecture

### Components

1. **Backend API** - FastAPI application with multiple workers
2. **Database** - PostgreSQL with staging-specific database
3. **Cache** - Redis for session storage and caching
4. **Background Processing** - Celery workers and beat scheduler
5. **Storage** - Google Cloud Storage with staging bucket
6. **Monitoring** - Prometheus, Grafana, and AlertManager
7. **Load Balancer** - Nginx reverse proxy
8. **Container Orchestration** - Docker Compose or Kubernetes

### Environment Separation

- **Development** - Local development environment
- **Staging** - Pre-production testing environment
- **Production** - Live production environment

## Quick Start

### Docker Compose Deployment

1. **Setup Environment:**
   ```bash
   ./scripts/setup_staging.sh
   ```

2. **Deploy to Staging:**
   ```bash
   cd staging
   ./deploy.sh
   ```

3. **Monitor Staging:**
   ```bash
   ./monitor.sh
   ```

### Kubernetes Deployment

1. **Deploy to Kubernetes:**
   ```bash
   ./scripts/deploy_staging_k8s.sh
   ```

2. **Check Deployment Status:**
   ```bash
   kubectl get pods -n schlep-staging
   kubectl get services -n schlep-staging
   ```

## Configuration

### Environment Variables

The staging environment uses `.env.staging` for configuration:

```bash
# Environment
ENVIRONMENT=staging
APP_VERSION=1.0.0
DEBUG=false

# Database
STAGING_DB_HOST=staging-db
STAGING_DB_PORT=5432
STAGING_DB_NAME=schlep_engine_staging
STAGING_DB_USER=schlep_staging
STAGING_DB_PASSWORD=staging_secure_password

# Redis
STAGING_REDIS_HOST=staging-redis
STAGING_REDIS_PORT=6379
STAGING_REDIS_PASSWORD=staging_redis_password

# Storage
STAGING_STORAGE_PROVIDER=gcs
STAGING_STORAGE_BUCKET=schlep-engine-staging
STAGING_STORAGE_REGION=us-central1

# Security
STAGING_SECRET_KEY=staging_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Monitoring
STAGING_SENTRY_DSN=https://your-sentry-dsn@sentry.io/staging
LOG_LEVEL=INFO
PROMETHEUS_ENABLED=true
```

### Feature Flags

Staging environment feature flags:

```bash
ENABLE_ADVANCED_AI=true
ENABLE_ML_PIPELINE=true
ENABLE_DATA_PROCESSING=true
ENABLE_STORAGE=true
ENABLE_MONITORING=true
ENABLE_SECURITY=true
```

## Services

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 8001 | Main application API |
| Database | 5433 | PostgreSQL database |
| Redis | 6380 | Redis cache |
| Prometheus | 9091 | Metrics collection |
| Grafana | 3001 | Monitoring dashboards |
| AlertManager | 9094 | Alert management |
| Flower | 5556 | Celery monitoring |

### Service URLs

- **Backend API:** http://localhost:8001
- **API Documentation:** http://localhost:8001/docs
- **Health Check:** http://localhost:8001/api/v1/health
- **Metrics:** http://localhost:8001/api/v1/metrics
- **Prometheus:** http://localhost:9091
- **Grafana:** http://localhost:3001 (admin/admin)
- **AlertManager:** http://localhost:9094
- **Flower (Celery):** http://localhost:5556

## Monitoring

### Health Checks

The staging environment includes comprehensive health checks:

```bash
# Overall health
curl http://localhost:8001/api/v1/health

# Simple health check
curl http://localhost:8001/api/v1/health/simple

# Database health
curl http://localhost:8001/api/v1/health/database

# Redis health
curl http://localhost:8001/api/v1/health/redis

# Storage health
curl http://localhost:8001/api/v1/health/storage

# Celery health
curl http://localhost:8001/api/v1/health/celery
```

### Metrics

Prometheus metrics are available at `/api/v1/metrics`:

- **Business Metrics:** User registrations, data processing jobs, API usage
- **Performance Metrics:** Response times, throughput, error rates
- **System Metrics:** CPU, memory, disk usage
- **Security Metrics:** Authentication attempts, security events
- **Custom Metrics:** Application-specific metrics

### Logging

Structured logging with multiple log files:

- **Application Logs:** `/var/log/schlep-engine/app.log`
- **Security Logs:** `/var/log/schlep-engine/security.log`
- **Audit Logs:** `/var/log/schlep-engine/audit.log`
- **Performance Logs:** `/var/log/schlep-engine/performance.log`

### Alerts

AlertManager configuration for staging alerts:

- **Critical Alerts:** Immediate notification to on-call team
- **Warning Alerts:** Notification to staging team
- **Info Alerts:** General information notifications

## Database

### Staging Database

- **Database Name:** `schlep_engine_staging`
- **User:** `schlep_staging`
- **Schema:** Mirrors production schema
- **Data:** Test data, not production data

### Migrations

Database migrations are automatically applied during deployment:

```bash
# Manual migration
docker-compose -f docker-compose.staging.yml exec staging-backend alembic upgrade head

# Check migration status
docker-compose -f docker-compose.staging.yml exec staging-backend alembic current
```

## Storage

### Google Cloud Storage

- **Bucket:** `schlep-engine-staging`
- **Region:** `us-central1`
- **Access:** Service account with staging permissions
- **CDN:** Optional CDN for static assets

### File Management

- **Upload Limits:** 100MB per file
- **Allowed Types:** CSV, JSON, XLSX, Parquet
- **Retention:** Configurable retention policies
- **Cleanup:** Automatic cleanup of old files

## Security

### Authentication

- **JWT Tokens:** Access and refresh tokens
- **Token Expiry:** 30 minutes (access), 7 days (refresh)
- **Password Policy:** Minimum 8 characters
- **Login Attempts:** 5 attempts before lockout

### Authorization

- **Role-Based Access:** User, admin, system roles
- **API Keys:** For external integrations
- **Session Management:** Secure session handling

### Data Protection

- **Field Encryption:** Sensitive data encryption
- **Audit Logging:** Comprehensive audit trails
- **Rate Limiting:** API rate limiting
- **CORS:** Cross-origin resource sharing

## Background Processing

### Celery Configuration

- **Broker:** Redis
- **Result Backend:** Redis
- **Workers:** 4 concurrent workers
- **Tasks:** Data processing, ML jobs, notifications

### Task Monitoring

- **Flower:** Web-based monitoring interface
- **Task History:** Task execution history
- **Performance Metrics:** Task performance monitoring
- **Error Tracking:** Failed task analysis

## Backup and Recovery

### Backup Strategy

```bash
# Create backup
./backup.sh

# Restore from backup
./restore.sh staging/backups/staging_backup_YYYYMMDD_HHMMSS.tar.gz
```

### Backup Components

- **Database:** PostgreSQL dump
- **Redis:** Redis data dump
- **Logs:** Application logs
- **Uploads:** User uploaded files

### Recovery Procedures

1. **Full Recovery:** Restore from complete backup
2. **Database Recovery:** Restore database only
3. **File Recovery:** Restore specific files
4. **Configuration Recovery:** Restore configuration

## Troubleshooting

### Common Issues

#### Port Conflicts

```bash
# Check port usage
netstat -tulpn | grep :8001
lsof -i :8001

# Change ports in docker-compose.staging.yml
```

#### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.staging.yml logs staging-db

# Test database connection
docker-compose -f docker-compose.staging.yml exec staging-backend python -c "
from app.database.connection import get_database_url
print(get_database_url())
"
```

#### Redis Connection Issues

```bash
# Check Redis status
docker-compose -f docker-compose.staging.yml logs staging-redis

# Test Redis connection
docker-compose -f docker-compose.staging.yml exec staging-redis redis-cli ping
```

#### Storage Issues

```bash
# Check storage credentials
docker-compose -f docker-compose.staging.yml exec staging-backend python -c "
from app.core.config import get_settings
print(get_settings().get_storage_config())
"
```

### Log Analysis

```bash
# View backend logs
docker-compose -f docker-compose.staging.yml logs staging-backend

# View specific service logs
docker-compose -f docker-compose.staging.yml logs -f staging-backend

# Search logs for errors
docker-compose -f docker-compose.staging.yml logs staging-backend | grep ERROR
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Monitor application performance
curl http://localhost:8001/api/v1/metrics

# Check Celery worker status
curl http://localhost:5556/api/workers
```

## Maintenance

### Regular Tasks

#### Daily

- [ ] Check health endpoints
- [ ] Review error logs
- [ ] Monitor resource usage
- [ ] Verify backup completion

#### Weekly

- [ ] Update dependencies
- [ ] Review performance metrics
- [ ] Clean up old logs
- [ ] Test backup restoration

#### Monthly

- [ ] Security updates
- [ ] Performance optimization
- [ ] Capacity planning
- [ ] Documentation updates

### Updates and Upgrades

```bash
# Update application
git pull origin main
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml up -d

# Update dependencies
docker-compose -f docker-compose.staging.yml exec staging-backend pip install -r requirements.txt

# Database migrations
docker-compose -f docker-compose.staging.yml exec staging-backend alembic upgrade head
```

## Integration

### CI/CD Pipeline

The staging environment integrates with CI/CD pipelines:

1. **Code Push:** Triggers staging deployment
2. **Testing:** Automated tests in staging
3. **Validation:** Manual testing and validation
4. **Promotion:** Promote to production

### External Services

- **Sentry:** Error tracking and monitoring
- **Slack:** Alert notifications
- **Email:** Notification delivery
- **ML Services:** External ML processing

## Best Practices

### Development Workflow

1. **Feature Development:** Develop in local environment
2. **Staging Testing:** Deploy to staging for testing
3. **Validation:** Validate functionality in staging
4. **Production Deployment:** Deploy to production

### Testing Strategy

- **Unit Tests:** Run in CI/CD pipeline
- **Integration Tests:** Test in staging environment
- **End-to-End Tests:** Full workflow testing
- **Performance Tests:** Load testing in staging

### Security Practices

- **Regular Updates:** Keep dependencies updated
- **Access Control:** Limit access to staging
- **Data Protection:** Don't use production data
- **Monitoring:** Monitor security events

### Performance Optimization

- **Resource Monitoring:** Monitor CPU, memory, disk
- **Database Optimization:** Regular database maintenance
- **Caching Strategy:** Optimize Redis usage
- **Load Balancing:** Distribute load across workers

## Support

### Getting Help

1. **Documentation:** Check this documentation
2. **Logs:** Review application logs
3. **Monitoring:** Check monitoring dashboards
4. **Team:** Contact development team

### Contact Information

- **DevOps Team:** devops@schlep-engine.com
- **Development Team:** dev@schlep-engine.com
- **Emergency:** oncall@schlep-engine.com

### Escalation Procedures

1. **Level 1:** Check documentation and logs
2. **Level 2:** Contact development team
3. **Level 3:** Contact DevOps team
4. **Level 4:** Emergency on-call

## Conclusion

The staging environment provides a robust, secure, and scalable platform for testing Schlep-engine features before production deployment. With comprehensive monitoring, backup strategies, and maintenance procedures, it ensures reliable pre-production testing while maintaining security and performance standards.

For additional information or support, please refer to the main project documentation or contact the development team. 