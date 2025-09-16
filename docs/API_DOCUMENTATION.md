# 📚 Schlep-engine API Documentation

## 🚀 Overview

The Schlep-engine API is a comprehensive FastAPI-based REST API that provides enterprise-grade data processing, machine learning, and authentication capabilities. This documentation covers all available endpoints, authentication methods, and integration examples.

**Base URL:** `https://api.schlep-engine.com` (Production) | `http://localhost:8000` (Development)

**API Version:** v1

**Documentation Links:**
- 📖 [Interactive API Docs (Swagger UI)](http://localhost:8000/docs)
- 📋 [OpenAPI Specification](http://localhost:8000/openapi.json)
- 🔐 [Authentication Guide](#authentication)
- 🔧 [SDK Documentation](#sdks-and-clients)

---

## 🔐 Authentication

### Overview

Schlep-engine supports multiple authentication methods:

1. **JWT Bearer Tokens** (Recommended)
2. **OAuth 2.0** (Google, GitHub)
3. **API Keys** (For service-to-service communication)

### JWT Authentication

**Endpoint:** `POST /api/v1/auth/login`

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password",
    "remember_me": false
  }'
```

**Response:**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_here",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  }
}
```

**Using JWT Token:**
```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### OAuth 2.0 Authentication

#### Google OAuth

**Initiate OAuth Flow:**
```bash
GET /api/v1/auth/oauth/google/login
```

**Callback URL:** `/api/v1/auth/oauth/google/callback`

#### GitHub OAuth

**Initiate OAuth Flow:**
```bash
GET /api/v1/auth/oauth/github/login
```

**Callback URL:** `/api/v1/auth/oauth/github/callback`

### API Key Authentication

**Header:** `X-API-Key: your_api_key_here`

```bash
curl -X GET "http://localhost:8000/api/v1/data/process" \
  -H "X-API-Key: your_api_key_here"
```

---

## 📊 Core API Endpoints

### Health & Status

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

#### System Metrics
```http
GET /api/v1/metrics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "cpu_usage": 45.2,
  "memory_usage": 62.1,
  "active_connections": 42,
  "requests_per_minute": 150,
  "error_rate": 0.02
}
```

### Data Processing

#### Upload and Process Data
```http
POST /api/v1/data/process
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Parameters:**
- `file`: Data file (CSV, JSON, Excel)
- `processing_mode`: `standard`, `fast`, `streaming`, `ai_enhanced`
- `target_framework`: `tensorflow`, `pytorch`, `sklearn` (optional)

**Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/data/process" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@data.csv" \
  -F "processing_mode=standard" \
  -F "target_framework=tensorflow"
```

**Response:**
```json
{
  "job_id": "job_123456",
  "status": "processing",
  "estimated_completion": "2024-01-01T12:05:00Z",
  "data": {
    "rows": 10000,
    "columns": 15,
    "quality_score": 0.95
  }
}
```

#### Get Processing Results
```http
GET /api/v1/data/process/{job_id}
Authorization: Bearer <token>
```

#### Stream Processing Status
```http
GET /api/v1/data/process/{job_id}/stream
Authorization: Bearer <token>
```

**Server-Sent Events Response:**
```
data: {"progress": 25, "status": "processing", "current_step": "data_cleaning"}

data: {"progress": 50, "status": "processing", "current_step": "feature_engineering"}

data: {"progress": 100, "status": "completed", "download_url": "/api/v1/data/download/job_123"}
```

### Machine Learning

#### Start ML Pipeline
```http
POST /api/v1/ml/pipeline/start
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "pipeline_type": "classification",
  "data_source": "job_123456",
  "parameters": {
    "algorithm": "random_forest",
    "train_split": 0.8,
    "cross_validation": true
  }
}
```

#### Get Pipeline Status
```http
GET /api/v1/ml/pipeline/{pipeline_id}
Authorization: Bearer <token>
```

#### RL Optimization
```http
POST /api/v1/ml/rl-optimization/start
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "optimization_type": "hyperparameter",
  "target_metric": "accuracy",
  "max_episodes": 100,
  "environment_config": {
    "learning_rate_range": [0.001, 0.1],
    "batch_size_options": [32, 64, 128]
  }
}
```

### Industry-Specific APIs

#### Financial AI Services

**Fraud Detection:**
```http
POST /api/v1/industry/financial/fraud-detection
Authorization: Bearer <token>
```

**Request:**
```json
{
  "transaction": {
    "amount": 1500.00,
    "merchant": "Online Store",
    "location": "New York, NY",
    "time": "2024-01-01T14:30:00Z",
    "user_id": "user_123"
  }
}
```

**Response:**
```json
{
  "risk_score": 0.23,
  "risk_level": "low",
  "factors": [
    "normal_spending_pattern",
    "verified_location"
  ],
  "recommendation": "approve"
}
```

**Credit Risk Assessment:**
```http
POST /api/v1/industry/financial/credit-risk
Authorization: Bearer <token>
```

#### E-commerce AI Services

**Product Recommendations:**
```http
POST /api/v1/industry/ecommerce/recommendations
Authorization: Bearer <token>
```

**Request:**
```json
{
  "user_id": "user_123",
  "context": {
    "current_items": ["item_456", "item_789"],
    "category": "electronics",
    "budget_range": [100, 500]
  },
  "limit": 10
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "item_id": "item_999",
      "name": "Premium Headphones",
      "score": 0.92,
      "price": 299.99,
      "reasoning": "frequently_bought_together"
    }
  ],
  "click_through_rate": 0.34,
  "conversion_probability": 0.12
}
```

**Demand Forecasting:**
```http
POST /api/v1/industry/ecommerce/demand-forecast
Authorization: Bearer <token>
```

#### Manufacturing AI Services

**Predictive Maintenance:**
```http
POST /api/v1/industry/manufacturing/predictive-maintenance
Authorization: Bearer <token>
```

**Request:**
```json
{
  "equipment_id": "machine_001",
  "sensor_data": {
    "temperature": 75.2,
    "vibration": 0.45,
    "pressure": 120.5,
    "runtime_hours": 1450
  },
  "maintenance_history": [
    {
      "date": "2023-12-01",
      "type": "routine",
      "parts_replaced": ["belt", "filter"]
    }
  ]
}
```

**Response:**
```json
{
  "maintenance_required": true,
  "urgency": "medium",
  "predicted_failure_date": "2024-01-15",
  "recommended_actions": [
    "replace_bearing",
    "lubricate_joints"
  ],
  "confidence": 0.87
}
```

---

## 🔧 Advanced Features

### Real-time Data Streaming

#### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};

// Subscribe to specific data streams
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['financial_data', 'iot_sensors', 'ml_pipeline_updates']
}));
```

#### Stream Consumption
```http
GET /api/v1/stream/consume/{stream_name}
Authorization: Bearer <token>
```

### Batch Operations

#### Bulk Data Processing
```http
POST /api/v1/data/batch-process
Authorization: Bearer <token>
```

**Request:**
```json
{
  "files": [
    {"name": "dataset1.csv", "url": "s3://bucket/dataset1.csv"},
    {"name": "dataset2.json", "url": "s3://bucket/dataset2.json"}
  ],
  "processing_config": {
    "mode": "parallel",
    "chunk_size": 10000,
    "output_format": "parquet"
  }
}
```

### Analytics and Reporting

#### Usage Analytics
```http
GET /api/v1/analytics/usage
Authorization: Bearer <token>
```

**Query Parameters:**
- `start_date`: ISO 8601 date
- `end_date`: ISO 8601 date
- `granularity`: `hour`, `day`, `week`, `month`

#### Performance Metrics
```http
GET /api/v1/analytics/performance
Authorization: Bearer <token>
```

---

## 🚨 Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "request_id": "req_123456789"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## 📊 Rate Limiting

### Limits by User Type

| User Type | Requests/Minute | Requests/Hour | Burst Limit |
|-----------|-----------------|---------------|-------------|
| Free | 60 | 1,000 | 10 |
| Pro | 300 | 10,000 | 50 |
| Enterprise | 1,000 | 50,000 | 200 |
| API Key | 500 | 25,000 | 100 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
Retry-After: 60
```

---

## 🔧 SDKs and Clients

### JavaScript/TypeScript SDK

**Installation:**
```bash
npm install @schlep-engine/javascript-sdk
```

**Usage:**
```typescript
import { SchlepEngine } from '@schlep-engine/javascript-sdk';

const client = new SchlepEngine({
  apiKey: 'your_api_key',
  baseURL: 'https://api.schlep-engine.com'
});

// Process data
const result = await client.data.process({
  file: fileBlob,
  mode: 'standard'
});

// Get real-time updates
client.streams.subscribe('ml_pipeline', (data) => {
  console.log('Pipeline update:', data);
});
```

### Python SDK

**Installation:**
```bash
pip install schlep-engine-python
```

**Usage:**
```python
from schlep_engine import SchlepEngine

client = SchlepEngine(
    api_key='your_api_key',
    base_url='https://api.schlep-engine.com'
)

# Process data
result = client.data.process(
    file_path='data.csv',
    mode='standard'
)

# Start ML pipeline
pipeline = client.ml.start_pipeline(
    pipeline_type='classification',
    data_source=result.job_id
)
```

### REST Client Examples

#### cURL
```bash
# Set base URL and token
export API_BASE="http://localhost:8000"
export TOKEN="your_access_token"

# Process data
curl -X POST "$API_BASE/api/v1/data/process" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data.csv" \
  -F "processing_mode=standard"
```

#### Postman Collection

Import our Postman collection: [Download Collection](./postman/schlep-engine-api.json)

---

## 🔍 Testing and Development

### Local Development Setup

1. **Clone Repository:**
```bash
git clone https://github.com/wiramahendra/Schlep-engine.git
cd Schlep-engine
```

2. **Install Dependencies:**
```bash
pnpm install
cd apps/api && pip install -r requirements.txt
```

3. **Start Development Servers:**
```bash
pnpm dev
```

4. **API Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### API Testing

**Run API Tests:**
```bash
# Unit tests
pytest apps/api/tests/

# Integration tests
pytest apps/api/tests/integration/

# OAuth E2E tests
pnpm test:oauth

# Performance tests
pytest apps/api/tests/performance/
```

### Mock Server

For frontend development without backend:

```bash
# Start mock server
pnpm mock-server

# Mock server runs on http://localhost:3001
```

---

## 🚀 Production Deployment

### Environment Variables

Required environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port/db

# Authentication
JWT_SECRET_KEY=your-512-bit-secret
ENCRYPTION_KEY=your-encryption-key

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Storage
CLOUD_STORAGE_BUCKET_NAME=your-bucket
GCS_CREDENTIALS_PATH=/path/to/credentials.json

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=true
```

### Health Checks

**Kubernetes Health Checks:**
- **Liveness:** `GET /health`
- **Readiness:** `GET /health/ready`
- **Startup:** `GET /health/startup`

### Performance Tuning

**Recommended Settings:**
```yaml
# Kubernetes resources
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1500m"

# Connection pooling
database:
  pool_size: 15
  max_overflow: 25
  pool_timeout: 45

# Redis
redis:
  max_connections: 50
  connection_timeout: 5
```

---

## 📞 Support and Resources

### Documentation Links
- 📖 [User Guide](./USER_GUIDE.md)
- 🔧 [Setup Guide](./SETUP_GUIDE.md)
- 🏗️ [Architecture Guide](./ARCHITECTURE.md)
- 🔐 [Security Guide](./SECURITY.md)

### Community
- 💬 [Discord Community](https://discord.gg/schlep-engine)
- 🐛 [GitHub Issues](https://github.com/wiramahendra/Schlep-engine/issues)
- 📧 [Email Support](mailto:support@schlep-engine.com)

### Status Page
- 🟢 [System Status](https://status.schlep-engine.com)

---

## 📄 Changelog

### v1.0.0 (Latest)
- ✅ Complete API documentation
- ✅ OAuth 2.0 integration
- ✅ Industry-specific AI services
- ✅ Real-time streaming
- ✅ Comprehensive error handling

### v0.9.0
- ✅ ML pipeline automation
- ✅ Advanced data processing
- ✅ Performance optimizations

### v0.8.0
- ✅ Initial API release
- ✅ Basic authentication
- ✅ Core data processing

---

*Last Updated: January 2024*
*Version: 1.0.0*