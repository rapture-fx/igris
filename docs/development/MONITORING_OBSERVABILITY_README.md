# Monitoring & Observability Documentation

## Overview

The Schlep-engine platform includes a comprehensive monitoring and observability system that provides real-time insights into application health, performance, and business metrics. This system is designed to ensure high availability, detect issues early, and provide actionable insights for optimization.

## Architecture

### Components

1. **Health Checks** - Comprehensive service health monitoring
2. **Metrics Collection** - Prometheus-based metrics gathering
3. **Logging** - Structured logging with multiple outputs
4. **Error Tracking** - Sentry integration for error monitoring
5. **Alerting** - Automated alerting system
6. **Dashboards** - Grafana dashboards for visualization

### Data Flow

```
Application → Health Checks → Metrics → Prometheus → Grafana
     ↓
  Logging → ELK Stack/Datadog
     ↓
Error Tracking → Sentry
     ↓
Alerting → Notification Systems
```

## Health Checks

### Endpoints

- `/api/v1/health` - Comprehensive health status
- `/api/v1/health/simple` - Simple health check for load balancers
- `/api/v1/ready` - Kubernetes readiness probe
- `/api/v1/health/database` - Database-specific health check
- `/api/v1/health/redis` - Redis-specific health check
- `/api/v1/health/storage` - Storage service health check
- `/api/v1/health/celery` - Celery worker health check
- `/api/v1/health/system` - System resources health check
- `/api/v1/health/external` - External API dependencies health check

### Health Status Levels

- **Healthy** - Service is functioning normally
- **Degraded** - Service is experiencing issues but still operational
- **Unhealthy** - Service is down or experiencing critical issues
- **Unknown** - Health status cannot be determined

### Example Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "total_check_time": 0.245,
  "services": {
    "database": {
      "service": "database",
      "status": "healthy",
      "message": "Database is healthy",
      "details": {
        "database_name": "schlep_engine",
        "size": "1.2 GB",
        "active_connections": 15,
        "query_performance_ms": 12.5
      },
      "response_time": 0.045,
      "last_check": "2024-01-15T10:30:00Z"
    }
  },
  "summary": {
    "total_services": 6,
    "healthy_services": 6,
    "degraded_services": 0,
    "unhealthy_services": 0
  }
}
```

## Metrics Collection

### Prometheus Metrics

The application exposes comprehensive Prometheus metrics for monitoring:

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `http_request_size_bytes` - Request size
- `http_response_size_bytes` - Response size

#### Authentication Metrics
- `auth_login_attempts_total` - Login attempts
- `auth_login_duration_seconds` - Login duration
- `auth_sessions_active` - Active sessions
- `auth_failed_attempts_total` - Failed authentication attempts

#### User Metrics
- `users_registered_total` - User registrations
- `users_active` - Active users
- `users_online` - Online users

#### Data Processing Metrics
- `data_files_uploaded_total` - Files uploaded
- `data_files_processed_total` - Files processed
- `data_processing_duration_seconds` - Processing duration
- `data_processing_errors_total` - Processing errors

#### ML Pipeline Metrics
- `ml_jobs_created_total` - ML jobs created
- `ml_jobs_completed_total` - ML jobs completed
- `ml_training_duration_seconds` - Training duration
- `ml_model_accuracy` - Model accuracy
- `ml_predictions_made_total` - Predictions made

#### Storage Metrics
- `storage_operations_total` - Storage operations
- `storage_operation_duration_seconds` - Operation duration
- `storage_usage_bytes` - Storage usage
- `storage_files_count` - File count

#### Database Metrics
- `database_queries_total` - Database queries
- `database_query_duration_seconds` - Query duration
- `database_connections_active` - Active connections
- `database_connections_total` - Total connections

#### Cache Metrics
- `cache_operations_total` - Cache operations
- `cache_hit_ratio` - Cache hit ratio
- `cache_size_bytes` - Cache size

#### Business Metrics
- `revenue_total` - Total revenue
- `subscriptions_active` - Active subscriptions
- `api_calls_total` - API calls
- `api_rate_limit_hits_total` - Rate limit hits

#### Security Metrics
- `security_events_total` - Security events
- `security_breaches_total` - Security breaches
- `security_scan_results` - Security scan results

#### System Metrics
- `system_cpu_usage_percent` - CPU usage
- `system_memory_usage_bytes` - Memory usage
- `system_disk_usage_bytes` - Disk usage
- `system_network_bytes_total` - Network bytes

### Metrics Endpoints

- `/api/v1/metrics` - Prometheus metrics
- `/api/v1/metrics/summary` - Metrics summary
- `/api/v1/metrics/health` - Metrics health check
- `/api/v1/metrics/custom` - Custom metrics management

### Custom Metrics

You can create custom metrics for business-specific monitoring:

```python
from app.core.metrics import metrics_collector

# Create a custom counter
custom_counter = metrics_collector.create_custom_metric(
    name="business_transactions_total",
    metric_type="counter",
    description="Total business transactions",
    labels=["transaction_type", "user_type"]
)

# Record a metric
custom_counter.labels(
    transaction_type="payment",
    user_type="premium"
).inc()
```

## Logging

### Logging Configuration

The application uses structured logging with multiple outputs:

- **Console** - Human-readable logs for development
- **File** - Rotating log files
- **JSON** - Structured JSON logs for log aggregation
- **Security** - Separate security log file
- **Audit** - Separate audit log file

### Log Levels

- **DEBUG** - Detailed debugging information
- **INFO** - General information
- **WARNING** - Warning messages
- **ERROR** - Error messages
- **CRITICAL** - Critical errors

### Structured Logging

Logs include structured data for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "logger": "app.api",
  "message": "Request completed",
  "request_id": "abc123",
  "user_id": "user456",
  "method": "GET",
  "endpoint": "/api/v1/users",
  "status_code": 200,
  "duration": 0.045
}
```

### Logging Functions

```python
from app.core.logging_config import (
    log_request_start,
    log_request_end,
    log_security_event,
    log_audit_event,
    log_business_event,
    log_error
)

# Log request lifecycle
log_request_start(request_id, method, url, user_id)
log_request_end(request_id, method, url, status_code, duration, user_id)

# Log security events
log_security_event("login_attempt", {"ip": "192.168.1.1"}, user_id)

# Log audit events
log_audit_event("user_created", "users", "create", {"user_id": "123"}, user_id)

# Log business events
log_business_event("payment_received", {"amount": 100.00}, user_id)

# Log errors
log_error(exception, context, user_id)
```

## Error Tracking

### Sentry Integration

The application integrates with Sentry for error tracking and monitoring:

- **Automatic Error Capture** - All unhandled exceptions are captured
- **Context Information** - Request context, user information, and custom data
- **Performance Monitoring** - Request performance and database query monitoring
- **Release Tracking** - Version and deployment tracking
- **Alerting** - Automatic alerting for critical errors

### Error Categories

- **Authentication** - Authentication and authorization errors
- **Authorization** - Permission and access control errors
- **Validation** - Input validation errors
- **Database** - Database connection and query errors
- **External API** - Third-party API errors
- **Storage** - File storage errors
- **Network** - Network connectivity errors
- **System** - System-level errors
- **Business Logic** - Application logic errors
- **Security** - Security-related errors

### Error Severity Levels

- **Low** - Minor issues that don't affect functionality
- **Medium** - Issues that may affect some functionality
- **High** - Issues that significantly affect functionality
- **Critical** - Issues that cause system failure

### Error Tracking Functions

```python
from app.core.error_tracking import (
    capture_exception,
    capture_message,
    set_user_context,
    set_request_context,
    add_breadcrumb
)

# Capture exceptions
capture_exception(
    exception,
    severity=ErrorSeverity.HIGH,
    category=ErrorCategory.DATABASE,
    context=error_context,
    tags={"service": "user-service"},
    extra_data={"user_id": "123"}
)

# Capture messages
capture_message(
    "User account locked",
    severity=ErrorSeverity.MEDIUM,
    category=ErrorCategory.SECURITY
)

# Set context
set_user_context("user123")
set_request_context("req456", "/api/v1/users", "GET")

# Add breadcrumbs
add_breadcrumb(
    "User login attempt",
    "auth",
    {"method": "password", "ip": "192.168.1.1"}
)
```

## Alerting System

### Alert Rules

The system includes configurable alert rules:

```python
# Example alert rule
{
    "rule_name": "high_error_rate",
    "rule_type": "threshold",
    "metric_name": "http_requests_total",
    "threshold": 10,
    "operator": ">",
    "severity": "high",
    "message_template": "Error rate is {value} errors per minute",
    "is_active": True
}
```

### Alert Types

- **Threshold Alerts** - Metric value exceeds threshold
- **Anomaly Alerts** - Unusual patterns detected
- **Health Alerts** - Service health issues
- **Security Alerts** - Security incidents
- **Business Alerts** - Business metric issues

### Alert Channels

- **Email** - Email notifications
- **Slack** - Slack channel notifications
- **PagerDuty** - Incident management
- **Webhook** - Custom webhook notifications

## Monitoring Service

### Background Monitoring

The application includes a background monitoring service that:

- Runs health checks periodically
- Collects system metrics
- Analyzes error patterns
- Manages alerting
- Cleans up old data

### Service Configuration

```python
# Monitoring service configuration
monitoring_service = MonitoringService()

# Start monitoring
await monitoring_service.start()

# Stop monitoring
await monitoring_service.stop()

# Get service status
status = monitoring_service.get_service_status()
```

### Monitoring Tasks

- **Health Checks** - Every 30 seconds
- **Metrics Collection** - Every 60 seconds
- **System Monitoring** - Every 30 seconds
- **Error Analysis** - Every 5 minutes
- **Alerting** - Every 60 seconds
- **Cleanup** - Every hour

## Setup and Configuration

### Installation

1. **Install Dependencies**

```bash
# Install monitoring packages
pip install prometheus-client sentry-sdk psutil httpx structlog python-json-logger

# Run setup script
./scripts/setup_monitoring.sh
```

2. **Configure Environment Variables**

```bash
# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log

# Sentry
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Monitoring
MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=30
METRICS_COLLECTION_INTERVAL=60
```

3. **Database Migration**

```bash
# Run monitoring migrations
alembic upgrade head
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'schlep-engine'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/v1/metrics'
    scrape_interval: 15s

  - job_name: 'schlep-engine-health'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/v1/health'
    scrape_interval: 30s
```

### Grafana Configuration

1. **Add Prometheus Data Source**
   - URL: `http://localhost:9090`
   - Access: Server (default)

2. **Import Dashboards**
   - Use the provided dashboard JSON files
   - Customize dashboards for your needs

3. **Configure Alerts**
   - Set up alert rules in Grafana
   - Configure notification channels

### Docker Setup

```bash
# Start monitoring services with Docker
docker-compose -f docker-compose.monitoring.yml up -d

# Access services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
# AlertManager: http://localhost:9093
```

## Dashboards

### Available Dashboards

1. **System Overview**
   - CPU, memory, disk usage
   - Network I/O
   - System load

2. **Application Performance**
   - Request rates and response times
   - Error rates
   - Database performance
   - Cache performance

3. **Business Metrics**
   - User activity
   - Revenue metrics
   - API usage
   - Feature adoption

4. **Security Dashboard**
   - Security events
   - Authentication attempts
   - Failed logins
   - Suspicious activity

5. **ML Pipeline Dashboard**
   - Model training metrics
   - Prediction rates
   - Model accuracy
   - Pipeline performance

### Custom Dashboards

Create custom dashboards for specific needs:

```json
{
  "dashboard": {
    "title": "Custom Business Dashboard",
    "panels": [
      {
        "title": "Revenue by Plan",
        "type": "graph",
        "targets": [
          {
            "expr": "revenue_total",
            "legendFormat": "{{plan_type}}"
          }
        ]
      }
    ]
  }
}
```

## Best Practices

### Monitoring Best Practices

1. **Set Appropriate Thresholds**
   - Use historical data to set realistic thresholds
   - Avoid too many false positives
   - Review and adjust thresholds regularly

2. **Use Meaningful Metrics**
   - Focus on business-impacting metrics
   - Avoid vanity metrics
   - Include both leading and lagging indicators

3. **Implement Proper Alerting**
   - Use different severity levels
   - Include context in alerts
   - Avoid alert fatigue

4. **Regular Maintenance**
   - Clean up old data regularly
   - Review and update dashboards
   - Monitor monitoring system health

### Logging Best Practices

1. **Use Structured Logging**
   - Include relevant context
   - Use consistent field names
   - Avoid sensitive data in logs

2. **Set Appropriate Log Levels**
   - DEBUG for detailed debugging
   - INFO for general information
   - WARNING for potential issues
   - ERROR for actual errors

3. **Include Correlation IDs**
   - Use request IDs for tracing
   - Include user context when available
   - Link related log entries

### Error Tracking Best Practices

1. **Capture Relevant Context**
   - Include user information
   - Add request context
   - Include custom tags and data

2. **Use Appropriate Severity Levels**
   - CRITICAL for system failures
   - HIGH for significant issues
   - MEDIUM for minor issues
   - LOW for informational errors

3. **Implement Error Recovery**
   - Add retry logic where appropriate
   - Implement circuit breakers
   - Provide fallback mechanisms

## Troubleshooting

### Common Issues

1. **Metrics Not Appearing**
   - Check if metrics endpoint is accessible
   - Verify Prometheus configuration
   - Check application logs for errors

2. **High Memory Usage**
   - Monitor memory usage patterns
   - Check for memory leaks
   - Optimize data structures

3. **Slow Response Times**
   - Check database query performance
   - Monitor external API calls
   - Review application bottlenecks

4. **Missing Logs**
   - Check log file permissions
   - Verify logging configuration
   - Check disk space

### Debug Commands

```bash
# Check service health
curl http://localhost:8000/api/v1/health

# Check metrics
curl http://localhost:8000/api/v1/metrics

# Check system resources
curl http://localhost:8000/api/v1/system/info

# Run health check script
./health_check.sh

# Check monitoring service status
curl http://localhost:8000/api/v1/metrics/health
```

### Performance Optimization

1. **Metrics Collection**
   - Use appropriate scrape intervals
   - Implement metric caching
   - Optimize metric cardinality

2. **Logging Performance**
   - Use async logging where possible
   - Implement log buffering
   - Use appropriate log levels

3. **Health Checks**
   - Optimize health check queries
   - Use caching for expensive checks
   - Implement timeouts

## Security Considerations

### Data Protection

1. **Sensitive Data**
   - Never log sensitive information
   - Use data masking for logs
   - Implement proper access controls

2. **Access Control**
   - Restrict access to monitoring endpoints
   - Use authentication for dashboards
   - Implement role-based access

3. **Network Security**
   - Use HTTPS for monitoring endpoints
   - Implement network segmentation
   - Monitor access patterns

### Compliance

1. **Data Retention**
   - Implement appropriate retention policies
   - Comply with data protection regulations
   - Regular data cleanup

2. **Audit Trails**
   - Maintain audit logs
   - Monitor access to monitoring systems
   - Regular security reviews

## Integration Examples

### Custom Health Check

```python
from app.core.health import HealthCheckResult, HealthStatus

async def custom_health_check():
    try:
        # Perform custom health check
        result = await external_service_check()
        
        return HealthCheckResult(
            service="custom_service",
            status=HealthStatus.HEALTHY if result else HealthStatus.UNHEALTHY,
            message="Custom service health check",
            details={"custom_metric": result}
        )
    except Exception as e:
        return HealthCheckResult(
            service="custom_service",
            status=HealthStatus.UNHEALTHY,
            message=f"Custom service check failed: {str(e)}"
        )
```

### Custom Metric

```python
from app.core.metrics import record_business_event

# Record business event
record_business_event(
    event_type="user_registration",
    amount=0.0,
    user_type="new",
    plan_type="free"
)

# Record performance metric
from app.core.metrics import measure_time

@measure_time("custom_operation")
async def custom_operation():
    # Your operation here
    pass
```

### Custom Alert Handler

```python
from app.services.monitoring_service import add_alert_handler

async def custom_alert_handler(alert_type, message, severity, context):
    # Send alert to custom system
    await send_to_custom_system(alert_type, message, severity, context)

# Register handler
add_alert_handler(custom_alert_handler)
```

## Conclusion

The monitoring and observability system provides comprehensive visibility into the Schlep-engine platform. By following the setup instructions and best practices outlined in this documentation, you can ensure reliable monitoring, effective alerting, and actionable insights for your application.

For additional support or questions, please refer to the project documentation or contact the development team. 