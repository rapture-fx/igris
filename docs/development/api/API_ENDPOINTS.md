# Schlep Engine API Reference

Comprehensive API documentation for the Schlep Engine data processing platform.

## Base URLs

- **Production**: `https://api.schlep-engine.com`
- **Staging**: `https://staging-api.schlep-engine.com`
- **Development**: `http://localhost:8000`

## Interactive Documentation

- **Swagger UI**: [https://api.schlep-engine.com/docs](https://api.schlep-engine.com/docs)
- **ReDoc**: [https://api.schlep-engine.com/redoc](https://api.schlep-engine.com/redoc)
- **OpenAPI Spec**: [https://api.schlep-engine.com/openapi.json](https://api.schlep-engine.com/openapi.json)
- **Postman Collection**: Available in our [GitHub repository](https://github.com/schlep-engine/api-docs)

## API Features

- **99.9% Uptime SLA** with automatic failover
- **Global CDN** for optimal performance
- **Real-time webhooks** for event notifications
- **Comprehensive SDKs** for Python, JavaScript, and R
- **Enterprise security** with SOC2 and GDPR compliance
- **Intelligent rate limiting** with burst protection
- **Automatic retries** with exponential backoff

## Quick Start

### 1. Authentication
All API endpoints require authentication using an API key:

```bash
curl -H "X-API-Key: your_api_key_here" https://api.schlep-engine.com/api/v1/health
```

### 2. Upload Data
```bash
curl -X POST "https://api.schlep-engine.com/api/v1/data/upload" \
  -H "X-API-Key: your_api_key_here" \
  -F "file=@your_data.csv" \
  -F "name=My Dataset"
```

### 3. Process Data
```bash
curl -X POST "https://api.schlep-engine.com/api/v1/data/processing/clean" \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"investigation_id": "uuid", "auto_clean": true}'
```

## Rate Limiting

All API endpoints are rate-limited with intelligent burst protection:

| Plan | Requests/Minute | Requests/Hour | Concurrent Jobs | Burst Limit |
|------|----------------|---------------|-----------------|-------------|
| Free | 60 | 1,000 | 1 | 120 |
| Pro | 300 | 10,000 | 5 | 600 |
| Enterprise | Custom | Custom | Custom | Custom |

Rate limit headers returned:
- `X-RateLimit-Limit`: Your rate limit per minute
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time until reset (UTC timestamp)
- `X-RateLimit-Burst-Remaining`: Remaining burst requests
- `X-RateLimit-Retry-After`: Seconds to wait before retry (when rate limited)

### Rate Limit Best Practices

1. **Implement exponential backoff** when receiving 429 responses
2. **Monitor rate limit headers** to avoid hitting limits
3. **Use webhooks** instead of polling for real-time updates
4. **Batch operations** when possible to reduce API calls
5. **Cache responses** when data doesn't change frequently

## Standard Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123456789"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": { ... }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123456789"
}
```

## Authentication & Authorization

### `/api/v1/auth` - Authentication Management

#### OAuth Login
```http
POST /api/v1/auth/oauth/google
POST /api/v1/auth/oauth/github
```

**Request:**
```json
{
  "redirect_uri": "https://app.schlep-engine.com/auth/callback"
}
```

**Response:**
```json
{
  "authorization_url": "https://accounts.google.com/oauth/authorize?..."
}
```

#### API Key Management
```http
GET /api/v1/auth/api-keys
POST /api/v1/auth/api-keys
DELETE /api/v1/auth/api-keys/{key_id}
```

**Create API Key Request:**
```json
{
  "name": "Production API Key",
  "permissions": ["read", "write", "admin"],
  "rate_limit": 1000
}
```

**Response:**
```json
{
  "id": "key_123",
  "name": "Production API Key",
  "key": "sk_live_abc123...",
  "permissions": ["read", "write", "admin"],
  "rate_limit": 1000,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### User Profile
```http
GET /api/v1/auth/me
PUT /api/v1/auth/me
```

## Data Processing

### `/api/v1/data` - Core Data Operations

#### File Upload
```http
POST /api/v1/data/upload
```

**Request (multipart/form-data):**
- `file`: File to upload (CSV, JSON, Excel, Parquet)
- `name`: Dataset name
- `description`: Optional description
- `tags`: Optional comma-separated tags

**Response:**
```json
{
  "investigation_id": "inv_123456",
  "file_info": {
    "filename": "data.csv",
    "size": 1024000,
    "rows": 10000,
    "columns": 15,
    "format": "csv"
  },
  "upload_url": "https://storage.schlep-engine.com/uploads/inv_123456.csv"
}
```

#### Data Processing Pipeline
```http
POST /api/v1/data/processing/clean
```

**Request:**
```json
{
  "investigation_id": "inv_123456",
  "options": {
    "auto_clean": true,
    "remove_duplicates": true,
    "handle_missing": "auto",
    "detect_outliers": true,
    "normalize_text": false
  }
}
```

**Response:**
```json
{
  "job_id": "job_789",
  "status": "processing",
  "estimated_completion": "2024-01-15T10:35:00Z",
  "operations": [
    "duplicate_removal",
    "missing_value_imputation",
    "outlier_detection"
  ]
}
```

#### Data Profiling
```http
GET /api/v1/data/profile/{investigation_id}
```

**Response:**
```json
{
  "summary": {
    "total_rows": 10000,
    "total_columns": 15,
    "missing_values": 245,
    "duplicate_rows": 12,
    "data_quality_score": 0.92
  },
  "columns": [
    {
      "name": "email",
      "type": "string",
      "missing_count": 5,
      "unique_count": 9995,
      "quality_issues": ["format_inconsistency"]
    }
  ]
}
```

### `/api/v1/data/quality` - Data Quality Management

#### Quality Assessment
```http
POST /api/v1/data/quality/assess
```

**Request:**
```json
{
  "investigation_id": "inv_123456",
  "checks": [
    "completeness",
    "uniqueness",
    "validity",
    "consistency"
  ]
}
```

#### Quality Rules
```http
GET /api/v1/data/quality/rules
POST /api/v1/data/quality/rules
```

## Machine Learning Pipeline

### `/api/v1/ml` - ML Operations

#### Model Training
```http
POST /api/v1/ml/train
```

**Request:**
```json
{
  "investigation_id": "inv_123456",
  "model_type": "classification",
  "target_column": "outcome",
  "features": ["feature1", "feature2"],
  "parameters": {
    "algorithm": "random_forest",
    "test_size": 0.2,
    "cross_validation": 5
  }
}
```

#### Model Prediction
```http
POST /api/v1/ml/predict
```

**Request:**
```json
{
  "model_id": "model_456",
  "data": [
    {"feature1": 1.2, "feature2": "category_a"},
    {"feature1": 2.1, "feature2": "category_b"}
  ]
}
```

**Response:**
```json
{
  "predictions": [
    {"prediction": "positive", "confidence": 0.85},
    {"prediction": "negative", "confidence": 0.92}
  ],
  "model_info": {
    "accuracy": 0.94,
    "last_trained": "2024-01-15T09:00:00Z"
  }
}
```

### `/api/v1/advanced-ai` - Advanced AI Features

#### Auto-Labeling
```http
POST /api/v1/advanced-ai/auto-label
```

#### Anomaly Detection
```http
POST /api/v1/advanced-ai/detect-anomalies
```

## Storage & File Management

### `/api/v1/storage` - File Operations

#### File Download
```http
GET /api/v1/storage/download/{file_id}
```

#### File Management
```http
GET /api/v1/storage/files
DELETE /api/v1/storage/files/{file_id}
```

## Analytics & Monitoring

### `/api/v1/analytics` - Usage Analytics

#### Usage Statistics
```http
GET /api/v1/analytics/usage
```

**Response:**
```json
{
  "period": "last_30_days",
  "api_calls": 15420,
  "data_processed_gb": 245.7,
  "ml_operations": 89,
  "top_endpoints": [
    {"endpoint": "/api/v1/data/upload", "calls": 5200},
    {"endpoint": "/api/v1/ml/predict", "calls": 3800}
  ]
}
```

### `/api/v1/metrics` - System Metrics

#### Prometheus Metrics
```http
GET /api/v1/metrics
```

## Billing & Usage

### `/api/v1/billing` - LemonSqueezy Integration

#### Current Usage
```http
GET /api/v1/billing/usage
```

**Response:**
```json
{
  "current_period": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "api_calls": 5420,
    "data_processed": 85000000,
    "storage_used": 2500000000,
    "ml_operations": 245,
    "estimated_cost": 24.50,
    "currency": "USD"
  },
  "limits": {
    "api_calls": 10000,
    "data_processing": 100000000,
    "storage": 5000000000
  }
}
```

#### Subscription Management
```http
GET /api/v1/billing/subscription
PUT /api/v1/billing/subscription
```

## Webhooks

Schlep Engine supports comprehensive webhook notifications for both data processing events and billing events powered by LemonSqueezy.

### `/api/v1/webhooks` - Webhook Management

#### Configure Webhooks
```http
POST /api/v1/webhooks/configure
```

**Request:**
```json
{
  "url": "https://your-app.com/webhooks/schlep-engine",
  "events": [
    "job.completed",
    "job.failed",
    "job.progress",
    "usage.alert",
    "security.breach",
    "api.rate_limit_exceeded"
  ],
  "secret": "webhook_secret_key",
  "retry_config": {
    "max_retries": 3,
    "retry_delay": 5,
    "exponential_backoff": true
  },
  "headers": {
    "Authorization": "Bearer your_webhook_token",
    "X-Custom-Header": "custom_value"
  }
}
```

**Response:**
```json
{
  "webhook_id": "wh_123456",
  "url": "https://your-app.com/webhooks/schlep-engine",
  "events": ["job.completed", "job.failed"],
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  "last_delivery": null,
  "delivery_stats": {
    "total_deliveries": 0,
    "successful_deliveries": 0,
    "failed_deliveries": 0
  }
}
```

#### List Webhooks
```http
GET /api/v1/webhooks
```

#### Update Webhook
```http
PUT /api/v1/webhooks/{webhook_id}
```

#### Delete Webhook
```http
DELETE /api/v1/webhooks/{webhook_id}
```

#### Test Webhook
```http
POST /api/v1/webhooks/{webhook_id}/test
```

### Webhook Events

#### Data Processing Events

**job.started**
```json
{
  "event": "job.started",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "job_id": "job_123456",
    "pipeline_name": "Data Cleaning Pipeline",
    "investigation_id": "inv_789012",
    "estimated_duration": 180,
    "steps": ["validation", "cleaning", "transformation"]
  }
}
```

**job.progress**
```json
{
  "event": "job.progress",
  "timestamp": "2024-01-15T10:32:00Z",
  "data": {
    "job_id": "job_123456",
    "status": "processing",
    "progress": {
      "percentage": 45,
      "current_step": "cleaning",
      "records_processed": 4500,
      "total_records": 10000,
      "estimated_completion": "2024-01-15T10:35:00Z"
    }
  }
}
```

**job.completed**
```json
{
  "event": "job.completed",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "job_id": "job_123456",
    "status": "completed",
    "processing_time": 300,
    "records_processed": 10000,
    "output_file_id": "file_567890",
    "summary": {
      "duplicates_removed": 125,
      "missing_values_filled": 340,
      "anomalies_detected": 23,
      "data_quality_score": 0.94
    },
    "download_url": "https://storage.schlep-engine.com/results/file_567890.csv"
  }
}
```

**job.failed**
```json
{
  "event": "job.failed",
  "timestamp": "2024-01-15T10:33:00Z",
  "data": {
    "job_id": "job_123456",
    "status": "failed",
    "error": {
      "code": "PROCESSING_ERROR",
      "message": "Invalid data format in column 'date'",
      "details": {
        "column": "date",
        "row": 1234,
        "expected_format": "YYYY-MM-DD",
        "received_value": "invalid_date"
      }
    },
    "processing_time": 180,
    "records_processed": 1233
  }
}
```

#### System Events

**usage.alert**
```json
{
  "event": "usage.alert",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "alert_type": "approaching_limit",
    "metric": "api_calls",
    "current_usage": 850,
    "limit": 1000,
    "percentage": 85,
    "period": "current_month",
    "recommendation": "Consider upgrading to Pro plan to avoid service interruption"
  }
}
```

**security.breach**
```json
{
  "event": "security.breach",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "severity": "high",
    "type": "suspicious_api_usage",
    "description": "Unusual API access pattern detected",
    "source_ip": "192.168.1.100",
    "affected_resources": ["api_key_123"],
    "actions_taken": ["temporary_suspension", "admin_notification"]
  }
}
```

### LemonSqueezy Billing Webhooks

#### LemonSqueezy Webhook Endpoint
```http
POST /api/v1/webhooks/lemonsqueezy/webhook
```

**Supported Events:**
- `subscription_created`
- `subscription_updated` 
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_expired`
- `subscription_paused`
- `subscription_unpaused`
- `subscription_payment_success`
- `subscription_payment_failed`
- `subscription_payment_recovered`
- `order_created`
- `order_refunded`

**Example: Subscription Payment Success**
```json
{
  "meta": {
    "event_name": "subscription_payment_success",
    "webhook_id": "wh_lemonsqueezy_123"
  },
  "data": {
    "id": "sub_456789",
    "type": "subscriptions",
    "attributes": {
      "store_id": 12345,
      "customer_id": 67890,
      "order_id": 98765,
      "order_item_id": 54321,
      "product_id": 11111,
      "variant_id": 22222,
      "product_name": "Schlep Engine Pro",
      "variant_name": "Monthly",
      "status": "active",
      "status_formatted": "Active",
      "trial_ends_at": null,
      "billing_anchor": 15,
      "urls": {
        "update_payment_method": "https://app.lemonsqueezy.com/..."
      },
      "renews_at": "2024-02-15T10:30:00Z",
      "ends_at": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Webhook Security

#### Signature Verification

All webhook payloads are signed using HMAC-SHA256. Verify signatures to ensure authenticity:

**Python Example:**
```python
import hmac
import hashlib

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected_signature}", signature)

# In your webhook handler
def handle_webhook(request):
    payload = request.body
    signature = request.headers.get('X-Schlep-Signature')
    secret = 'your_webhook_secret'
    
    if not verify_webhook_signature(payload, signature, secret):
        return {'error': 'Invalid signature'}, 401
    
    # Process webhook...
```

**Node.js Example:**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(`sha256=${expectedSignature}`),
        Buffer.from(signature)
    );
}

// In your webhook handler
app.post('/webhooks/schlep-engine', (req, res) => {
    const payload = JSON.stringify(req.body);
    const signature = req.headers['x-schlep-signature'];
    const secret = 'your_webhook_secret';
    
    if (!verifyWebhookSignature(payload, signature, secret)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process webhook...
});
```

#### Webhook Best Practices

1. **Always verify signatures** to ensure authenticity
2. **Implement idempotency** using the `event_id` field
3. **Return 200 status** quickly to avoid retries
4. **Process webhooks asynchronously** for better performance
5. **Log webhook events** for debugging and monitoring
6. **Handle retries gracefully** - webhooks may be delivered multiple times
7. **Use exponential backoff** for webhook endpoint failures

**Example Webhook Handler (Python/Flask):**
```python
from flask import Flask, request, jsonify
import json
import logging

app = Flask(__name__)
processed_events = set()  # Simple in-memory store for demo

@app.route('/webhooks/schlep-engine', methods=['POST'])
def handle_schlep_webhook():
    try:
        # Verify signature
        payload = request.get_data(as_text=True)
        signature = request.headers.get('X-Schlep-Signature')
        
        if not verify_webhook_signature(payload, signature, 'your_secret'):
            return jsonify({'error': 'Invalid signature'}), 401
        
        # Parse event
        event = json.loads(payload)
        event_id = event.get('id') or event.get('timestamp')  # Use for idempotency
        
        # Check for duplicate events
        if event_id in processed_events:
            logging.info(f'Duplicate event {event_id}, skipping')
            return jsonify({'status': 'duplicate'}), 200
        
        # Process event based on type
        event_type = event.get('event')
        
        if event_type == 'job.completed':
            handle_job_completed(event['data'])
        elif event_type == 'job.failed':
            handle_job_failed(event['data'])
        elif event_type == 'usage.alert':
            handle_usage_alert(event['data'])
        
        # Mark as processed
        processed_events.add(event_id)
        
        return jsonify({'status': 'success'}), 200
        
    except Exception as e:
        logging.error(f'Webhook processing failed: {e}')
        return jsonify({'error': 'Internal server error'}), 500

def handle_job_completed(data):
    # Send notification to user
    # Update database
    # Trigger downstream processes
    pass

def handle_job_failed(data):
    # Log error
    # Notify administrators
    # Update job status
    pass

def handle_usage_alert(data):
    # Send usage warning email
    # Update billing dashboard
    pass
```

## Administrative Operations

### `/api/v1/admin` - Admin Functions

#### User Management
```http
GET /api/v1/admin/users
POST /api/v1/admin/users
PUT /api/v1/admin/users/{user_id}
DELETE /api/v1/admin/users/{user_id}
```

#### System Monitoring
```http
GET /api/v1/admin/system/stats
GET /api/v1/admin/system/logs
```

### `/api/v1/security-admin` - Security Operations

#### Security Events
```http
GET /api/v1/security-admin/events
```

## Health & Status

### `/api/v1/health` - Health Checks

#### Basic Health Check
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "2.0.0",
  "environment": "production"
}
```

#### Detailed Health Check
```http
GET /api/v1/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "storage": "healthy",
    "ml_service": "healthy"
  },
  "performance": {
    "avg_response_time": 120,
    "error_rate": 0.02
  }
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field_name",
      "validation_errors": [...],
      "suggestion": "How to fix this error"
    },
    "request_id": "req_123456789",
    "documentation_url": "https://docs.schlep-engine.com/errors/ERROR_CODE"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Codes

#### Authentication & Authorization (4xx)

| Code | Description | HTTP Status | Retry |
|------|-------------|-------------|-------|
| `INVALID_API_KEY` | Invalid or missing API key | 401 | No |
| `EXPIRED_API_KEY` | API key has expired | 401 | No |
| `INSUFFICIENT_PERMISSIONS` | API key lacks required permissions | 403 | No |
| `ACCOUNT_SUSPENDED` | Account has been suspended | 403 | No |

#### Rate Limiting (4xx)

| Code | Description | HTTP Status | Retry |
|------|-------------|-------------|-------|
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | 429 | Yes |
| `BURST_LIMIT_EXCEEDED` | Burst rate limit exceeded | 429 | Yes |
| `CONCURRENT_LIMIT_EXCEEDED` | Too many concurrent operations | 429 | Yes |

#### Validation & Input (4xx)

| Code | Description | HTTP Status | Retry |
|------|-------------|-------------|-------|
| `VALIDATION_ERROR` | Request validation failed | 422 | No |
| `INVALID_FILE_FORMAT` | Unsupported file format | 422 | No |
| `FILE_TOO_LARGE` | File exceeds size limit | 413 | No |
| `INVALID_PARAMETER` | Invalid parameter value | 400 | No |
| `MISSING_PARAMETER` | Required parameter missing | 400 | No |

#### Resource Management (4xx)

| Code | Description | HTTP Status | Retry |
|------|-------------|-------------|-------|
| `RESOURCE_NOT_FOUND` | Requested resource not found | 404 | No |
| `RESOURCE_CONFLICT` | Resource state conflict | 409 | No |
| `RESOURCE_LOCKED` | Resource is currently locked | 423 | Yes |

#### Billing & Usage (4xx)

| Code | Description | HTTP Status | Retry |
|------|-------------|-------------|-------|
| `INSUFFICIENT_CREDITS` | Not enough credits for operation | 402 | No |
| `PLAN_LIMIT_EXCEEDED` | Plan usage limit exceeded | 402 | No |
| `SUBSCRIPTION_REQUIRED` | Feature requires active subscription | 402 | No |
| `BILLING_ERROR` | Billing system error | 402 | Yes |

#### Processing Errors (5xx)

| Code | Description | HTTP Status | Retry |
|------|-------------|-------------|-------|
| `PROCESSING_ERROR` | Data processing failed | 500 | Yes |
| `ML_MODEL_ERROR` | ML operation failed | 500 | Yes |
| `STORAGE_ERROR` | File storage operation failed | 500 | Yes |
| `DATABASE_ERROR` | Database operation failed | 500 | Yes |
| `EXTERNAL_SERVICE_ERROR` | External service unavailable | 502 | Yes |
| `TIMEOUT_ERROR` | Operation timed out | 504 | Yes |

### Error Handling Best Practices

#### 1. Implement Exponential Backoff

```python
import time
import random
from typing import Optional

def exponential_backoff_retry(
    func, 
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True
):
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries:
                raise e
            
            # Calculate delay with exponential backoff
            delay = min(base_delay * (2 ** attempt), max_delay)
            
            # Add jitter to prevent thundering herd
            if jitter:
                delay *= (0.5 + random.random() * 0.5)
            
            time.sleep(delay)

# Usage
def api_call():
    # Your API call here
    pass

result = exponential_backoff_retry(api_call, max_retries=3)
```

#### 2. Handle Specific Error Cases

```python
from schlep_engine import SchlepEngine, SchlepEngineError

client = SchlepEngine(api_key="your_key")

try:
    result = client.upload_file("data.csv")
except SchlepEngineError as e:
    if e.code == "RATE_LIMIT_EXCEEDED":
        # Wait and retry
        time.sleep(int(e.retry_after))
        result = client.upload_file("data.csv")
    elif e.code == "FILE_TOO_LARGE":
        # Split file and process in chunks
        process_file_in_chunks("data.csv")
    elif e.code == "INSUFFICIENT_CREDITS":
        # Notify user to upgrade plan
        notify_upgrade_required()
    else:
        # Log and handle other errors
        logger.error(f"API error: {e.code} - {e.message}")
        raise
```

#### 3. Monitor Error Rates

```python
import logging
from collections import defaultdict
from datetime import datetime, timedelta

class ErrorMonitor:
    def __init__(self):
        self.error_counts = defaultdict(int)
        self.last_reset = datetime.now()
    
    def record_error(self, error_code: str):
        # Reset counters every hour
        if datetime.now() - self.last_reset > timedelta(hours=1):
            self.error_counts.clear()
            self.last_reset = datetime.now()
        
        self.error_counts[error_code] += 1
        
        # Alert if error rate is high
        if self.error_counts[error_code] > 10:
            logging.warning(f"High error rate for {error_code}: {self.error_counts[error_code]}")
    
    def get_error_summary(self):
        return dict(self.error_counts)

# Usage
error_monitor = ErrorMonitor()

try:
    # API call
    pass
except SchlepEngineError as e:
    error_monitor.record_error(e.code)
    # Handle error...
```

### Common Error Scenarios

#### Rate Limiting
```bash
# Example rate limit exceeded response
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642248600
X-RateLimit-Retry-After: 60

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. You have made 60 requests in the last minute.",
    "details": {
      "limit": 60,
      "window": "1 minute",
      "retry_after": 60,
      "suggestion": "Wait 60 seconds before making another request or upgrade your plan for higher limits"
    }
  }
}
```

#### Validation Error
```bash
# Example validation error response
HTTP/1.1 422 Unprocessable Entity

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "validation_errors": [
        {
          "field": "file",
          "message": "File is required",
          "code": "required"
        },
        {
          "field": "name",
          "message": "Name must be between 1 and 100 characters",
          "code": "length"
        }
      ],
      "suggestion": "Ensure all required fields are provided with valid values"
    }
  }
}
```

#### Processing Error
```bash
# Example processing error response
HTTP/1.1 500 Internal Server Error

{
  "success": false,
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Data processing failed due to invalid data format",
    "details": {
      "column": "date",
      "row": 1234,
      "expected_format": "YYYY-MM-DD",
      "received_value": "invalid_date",
      "suggestion": "Ensure date columns use YYYY-MM-DD format or enable auto-correction"
    },
    "retry_info": {
      "retryable": false,
      "max_retries": 0
    }
  }
}
```

## SDKs and Code Examples

### Python SDK

**Installation:**
```bash
pip install schlep-engine
```

**Basic Usage:**
```python
from schlep_engine import SchlepEngine
import asyncio

# Initialize client
client = SchlepEngine(api_key="your_api_key")

# Upload and process data
result = client.upload_file(
    file_path="data.csv",
    name="Customer Data",
    description="Monthly customer analytics data"
)

# Start processing pipeline
pipeline = client.create_pipeline(
    name="Data Cleaning Pipeline",
    investigation_id=result.investigation_id,
    config={
        "auto_clean": True,
        "remove_duplicates": True,
        "detect_anomalies": True,
        "feature_engineering": True
    }
)

# Wait for completion with progress updates
result = client.wait_for_completion(
    job_id=pipeline.job_id,
    timeout=300,
    progress_callback=lambda status: print(f"Progress: {status.percentage}%")
)

# Download processed data
processed_data = client.download_results(result.output_file_id)
print(f"Processing completed: {result.summary}")
```

**Advanced Usage with AsyncIO:**
```python
import asyncio
from schlep_engine.async_client import AsyncSchlepEngine

async def process_multiple_datasets():
    client = AsyncSchlepEngine(api_key="your_api_key")
    
    # Process multiple files concurrently
    files = ["data1.csv", "data2.csv", "data3.csv"]
    
    tasks = []
    for file in files:
        task = client.upload_and_process(
            file_path=file,
            pipeline_config={"auto_clean": True}
        )
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    
    for i, result in enumerate(results):
        print(f"File {files[i]} processed: {result.status}")
    
    await client.close()

# Run async processing
asyncio.run(process_multiple_datasets())
```

### JavaScript/TypeScript SDK

**Installation:**
```bash
npm install @schlep-engine/sdk
# or
yarn add @schlep-engine/sdk
```

**Basic Usage:**
```javascript
import { SchlepEngine } from '@schlep-engine/sdk';

// Initialize client
const client = new SchlepEngine({ 
    apiKey: 'your_api_key',
    baseUrl: 'https://api.schlep-engine.com'
});

// Upload and process data
try {
    const uploadResult = await client.uploadFile({
        file: fileBlob, // File object or Buffer
        name: 'Customer Data',
        description: 'Monthly customer analytics data'
    });
    
    // Create processing pipeline
    const pipeline = await client.createPipeline({
        name: 'Data Cleaning Pipeline',
        investigationId: uploadResult.investigationId,
        config: {
            autoClean: true,
            removeDuplicates: true,
            detectAnomalies: true,
            featureEngineering: true
        }
    });
    
    // Monitor progress with real-time updates
    const result = await client.waitForCompletion(pipeline.jobId, {
        timeout: 300000, // 5 minutes
        onProgress: (status) => {
            console.log(`Progress: ${status.percentage}%`);
            console.log(`Current step: ${status.currentStep}`);
        }
    });
    
    // Download processed data
    const processedData = await client.downloadResults(result.outputFileId);
    console.log('Processing completed:', result.summary);
    
} catch (error) {
    console.error('Processing failed:', error.message);
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
        console.log('Retry after:', error.retryAfter);
    }
}
```

**TypeScript Usage:**
```typescript
import { SchlepEngine, UploadOptions, PipelineConfig, ProcessingResult } from '@schlep-engine/sdk';

interface DataProcessingOptions {
    autoClean: boolean;
    removeDuplicates: boolean;
    validateSchema: boolean;
}

class DataProcessor {
    private client: SchlepEngine;
    
    constructor(apiKey: string) {
        this.client = new SchlepEngine({ apiKey });
    }
    
    async processDataset(
        file: File, 
        options: DataProcessingOptions
    ): Promise<ProcessingResult> {
        const uploadOptions: UploadOptions = {
            file,
            name: file.name,
            tags: ['analytics', 'customer-data']
        };
        
        const uploadResult = await this.client.uploadFile(uploadOptions);
        
        const pipelineConfig: PipelineConfig = {
            name: `Processing ${file.name}`,
            investigationId: uploadResult.investigationId,
            config: options
        };
        
        const pipeline = await this.client.createPipeline(pipelineConfig);
        return await this.client.waitForCompletion(pipeline.jobId);
    }
}
```

### R SDK

**Installation:**
```r
install.packages("schlepengine")
# or from GitHub
devtools::install_github("schlep-engine/r-sdk")
```

**Basic Usage:**
```r
library(schlepengine)

# Initialize client
client <- SchlepEngine$new(api_key = "your_api_key")

# Upload data
result <- client$upload_file(
  file_path = "data.csv",
  name = "Customer Data",
  description = "Monthly customer analytics"
)

# Create processing pipeline
pipeline <- client$create_pipeline(
  name = "Data Cleaning Pipeline",
  investigation_id = result$investigation_id,
  config = list(
    auto_clean = TRUE,
    remove_duplicates = TRUE,
    detect_anomalies = TRUE
  )
)

# Wait for completion
processed_result <- client$wait_for_completion(
  job_id = pipeline$job_id,
  timeout = 300,
  progress_callback = function(status) {
    cat(sprintf("Progress: %d%%\n", status$percentage))
  }
)

# Get processed data as data.frame
processed_data <- client$get_processed_data(processed_result$output_file_id)
print(summary(processed_data))
```

### cURL Examples

**Complete Data Processing Workflow:**
```bash
#!/bin/bash

# Set your API key
API_KEY="your_api_key_here"
BASE_URL="https://api.schlep-engine.com"

# 1. Upload data file
echo "Uploading data file..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/data/upload" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@data.csv" \
  -F "name=Customer Analytics Data" \
  -F "description=Monthly customer data for analysis")

INVESTIGATION_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.investigation_id')
echo "Investigation ID: $INVESTIGATION_ID"

# 2. Create processing pipeline
echo "Creating processing pipeline..."
PIPELINE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/data/pipelines/create" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Automated Data Processing",
    "investigation_id": "'$INVESTIGATION_ID'",
    "config": {
      "auto_clean": true,
      "remove_duplicates": true,
      "detect_anomalies": true,
      "feature_engineering": true
    }
  }')

JOB_ID=$(echo $PIPELINE_RESPONSE | jq -r '.data.job_id')
echo "Job ID: $JOB_ID"

# 3. Monitor processing status
echo "Monitoring processing status..."
while true; do
  STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/data/jobs/$JOB_ID/status" \
    -H "X-API-Key: $API_KEY")
  
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.status')
  PERCENTAGE=$(echo $STATUS_RESPONSE | jq -r '.data.progress.percentage')
  
  echo "Status: $STATUS ($PERCENTAGE%)"
  
  if [ "$STATUS" = "completed" ]; then
    echo "Processing completed successfully!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Processing failed:"
    echo $STATUS_RESPONSE | jq '.data.error'
    exit 1
  fi
  
  sleep 5
done

# 4. Download processed results
echo "Downloading processed results..."
OUTPUT_FILE_ID=$(echo $STATUS_RESPONSE | jq -r '.data.output_file_id')
curl -X GET "$BASE_URL/api/v1/storage/download/$OUTPUT_FILE_ID" \
  -H "X-API-Key: $API_KEY" \
  -o "processed_data.csv"

echo "Processed data saved to processed_data.csv"

# 5. Get processing summary
echo "Getting processing summary..."
curl -s -X GET "$BASE_URL/api/v1/data/jobs/$JOB_ID/summary" \
  -H "X-API-Key: $API_KEY" | jq '.data'
```

### cURL Examples

**Upload Data:**
```bash
curl -X POST "https://api.schlep-engine.com/api/v1/data/upload" \
  -H "X-API-Key: your_api_key" \
  -F "file=@data.csv" \
  -F "name=My Dataset"
```

**Get Health Status:**
```bash
curl -H "X-API-Key: your_api_key" \
  "https://api.schlep-engine.com/api/v1/health"
```

## Performance & Monitoring

### Response Time Targets

| Operation Type | Target Response Time | SLA |
|----------------|---------------------|-----|
| Authentication | < 50ms | 99.9% |
| File Upload | < 2s | 99.5% |
| Simple Queries | < 100ms | 99.9% |
| Data Processing | < 30s | 99.0% |
| ML Operations | < 60s | 98.0% |

### Health Monitoring

#### System Health Check
```http
GET /api/v1/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "2.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "response_time": 12,
      "connection_pool": {
        "active": 5,
        "idle": 15,
        "max": 20
      }
    },
    "redis": {
      "status": "healthy",
      "response_time": 3,
      "memory_usage": "45%"
    },
    "storage": {
      "status": "healthy",
      "response_time": 45,
      "available_space": "2.5TB"
    },
    "ml_service": {
      "status": "healthy",
      "response_time": 89,
      "queue_length": 3
    }
  },
  "performance": {
    "avg_response_time": 120,
    "error_rate": 0.02,
    "requests_per_second": 45.7,
    "cpu_usage": 65,
    "memory_usage": 72
  }
}
```

#### Metrics Endpoint
```http
GET /api/v1/metrics
Content-Type: text/plain
```

**Prometheus Metrics Format:**
```
# HELP schlep_api_requests_total Total number of API requests
# TYPE schlep_api_requests_total counter
schlep_api_requests_total{method="POST",endpoint="/api/v1/data/upload",status="200"} 1543

# HELP schlep_api_request_duration_seconds Request duration in seconds
# TYPE schlep_api_request_duration_seconds histogram
schlep_api_request_duration_seconds_bucket{endpoint="/api/v1/data/upload",le="0.1"} 234
schlep_api_request_duration_seconds_bucket{endpoint="/api/v1/data/upload",le="0.5"} 567

# HELP schlep_jobs_total Total number of processing jobs
# TYPE schlep_jobs_total counter
schlep_jobs_total{status="completed"} 1245
schlep_jobs_total{status="failed"} 23

# HELP schlep_active_connections Current active connections
# TYPE schlep_active_connections gauge
schlep_active_connections 42
```

## Security

### API Security Features

- **TLS 1.3 Encryption** for all communications
- **API Key Authentication** with rotation support
- **Rate Limiting** with burst protection
- **Request Validation** and sanitization
- **Audit Logging** for all operations
- **IP Whitelisting** for enterprise accounts
- **CSRF Protection** for web applications
- **SQL Injection Prevention** with parameterized queries
- **XSS Protection** for all user inputs

### Compliance

- **SOC 2 Type II** certified
- **GDPR** compliant with data processing agreements
- **HIPAA** ready for healthcare data
- **ISO 27001** information security standards
- **PCI DSS** for payment data (when applicable)

### Data Protection

- **Encryption at Rest** using AES-256
- **Encryption in Transit** using TLS 1.3
- **Data Residency** options available
- **Automatic Data Deletion** after retention period
- **Data Export** capabilities for portability
- **Anonymization** tools for sensitive data

## Support & Resources

### Documentation
- **Interactive API Docs**: [https://api.schlep-engine.com/docs](https://api.schlep-engine.com/docs)
- **Developer Guide**: [https://docs.schlep-engine.com](https://docs.schlep-engine.com)
- **Integration Examples**: [https://github.com/schlep-engine/examples](https://github.com/schlep-engine/examples)
- **SDK Documentation**: [https://docs.schlep-engine.com/sdks](https://docs.schlep-engine.com/sdks)

### Status & Monitoring
- **API Status Page**: [https://status.schlep-engine.com](https://status.schlep-engine.com)
- **Service Health**: [https://api.schlep-engine.com/health](https://api.schlep-engine.com/health)
- **Metrics Dashboard**: [https://metrics.schlep-engine.com](https://metrics.schlep-engine.com)

### Community & Support
- **Community Forum**: [https://community.schlep-engine.com](https://community.schlep-engine.com)
- **Discord Server**: [https://discord.gg/schlep-engine](https://discord.gg/schlep-engine)
- **GitHub Issues**: [https://github.com/schlep-engine/api/issues](https://github.com/schlep-engine/api/issues)
- **Stack Overflow**: Tag `schlep-engine`

### Direct Support
- **General Support**: [support@schlep-engine.com](mailto:support@schlep-engine.com)
- **Enterprise Support**: [enterprise@schlep-engine.com](mailto:enterprise@schlep-engine.com)
- **Security Issues**: [security@schlep-engine.com](mailto:security@schlep-engine.com)
- **Billing Support**: [billing@schlep-engine.com](mailto:billing@schlep-engine.com)

### Response Times
| Support Tier | Response Time | Availability |
|--------------|---------------|-------------|
| Community | Best effort | Business hours |
| Standard | < 24 hours | Business hours |
| Pro | < 8 hours | Business hours |
| Enterprise | < 2 hours | 24/7 |

---

*Last updated: January 15, 2024*  
*API Version: 2.0.0*  
*Documentation Version: 1.3.0*
