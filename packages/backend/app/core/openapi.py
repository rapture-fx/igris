from fastapi.openapi.utils import get_openapi
from app.main import app
import os

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    # Get environment-specific configuration
    environment = os.getenv("ENVIRONMENT", "development")
    base_url = os.getenv("API_BASE_URL", "https://api.schlep-engine.com")
    
    openapi_schema = get_openapi(
        title="Schlep-engine API",
        version="2.0.0",
        description=f"""
# Schlep-engine API - Data Processing as a Service

**Production-ready API for intelligent data processing, analysis, and ML pipeline automation.**

## What We Do

Transform raw data into actionable insights with our comprehensive API suite:
- **Intelligent Data Processing**: data infrastructure cleaning, validation, and transformation
- **ML Pipeline Automation**: End-to-end machine learning workflow orchestration  
- **Real-time Analytics**: Live data analysis and anomaly detection
- **Enterprise Security**: SOC2, GDPR, and enterprise-grade compliance
- **Developer-First**: SDKs, webhooks, and comprehensive documentation

## Quick Start

### 1. Get Your API Key
```bash
# Sign up at https://app.schlep-engine.com
# Navigate to Settings > API Keys
# Create a new API key with appropriate permissions
```

### 2. Make Your First Request
```bash
curl -X POST "https://api.schlep-engine.com/api/v1/data/upload" \\
  -H "X-API-Key: your_api_key_here" \\
  -F "file=@your_data.csv" \\
  -F "name=My Dataset"
```

### 3. Process Your Data
```bash
curl -X POST "https://api.schlep-engine.com/api/v1/pipelines/create" \\
  -H "X-API-Key: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Pipeline",
    "source_type": "file",
    "processing": {
      "cleaning": true,
      "validation": true,
      "ml_preparation": true
    }
  }'
```

## Authentication

All API endpoints require authentication using an API key.

**Header**: `X-API-Key: your_api_key_here`

**Security Levels**:
- **Public**: Basic data operations (rate limited)
- **Standard**: Full feature access with usage tracking  
- **Enterprise**: Advanced features, priority support, custom limits

## Rate Limiting

| Plan | Requests/Minute | Requests/Hour | Concurrent Jobs |
|------|----------------|---------------|-----------------|
| Free | 60 | 1,000 | 1 |
| Pro | 300 | 10,000 | 5 |
| Enterprise | Custom | Custom | Custom |

**Headers returned**:
- `X-RateLimit-Limit`: Your rate limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time until reset (UTC timestamp)

## Usage & Billing

**Usage-based pricing**:
- **Data Processing**: $0.01 per 1,000 records
- **ML Operations**: $0.10 per ML job
- **Storage**: $0.05 per GB/month
- **API Calls**: Included in plan limits

**Real-time usage tracking**:
```json
{
  "usage": {
    "records_processed": 15000,
    "ml_jobs": 5,
    "storage_gb": 2.5,
    "api_calls": 1250
  }
}
```

## Webhooks

Configure webhooks to receive real-time notifications:

**Events**:
- `job.completed` - Data processing job finished
- `job.failed` - Job failed with error details
- `usage.alert` - Approaching usage limits
- `security.breach` - Security event detected

**Example webhook payload**:
```json
{
  "event": "job.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "job_id": "job_123",
    "status": "completed",
    "records_processed": 5000,
    "processing_time": 45.2
  }
}
```

## SDKs & Libraries

### Python SDK
```bash
pip install schlep-engine
```

```python
from schlep_engine import SchlepEngine

client = SchlepEngine(api_key="your_key")
result = client.upload_file("data.csv")
pipeline = client.create_pipeline("My Pipeline", result.investigation_id)
```

### JavaScript/TypeScript SDK
```bash
npm install @schlep-engine/sdk
```

```typescript
import { SchlepEngine } from '@schlep-engine/sdk';

const client = new SchlepEngine({ apiKey: 'your_key' });
const result = await client.uploadFile('data.csv');
const pipeline = await client.createPipeline('My Pipeline', result.investigationId);
```

### R SDK
```r
install.packages("schlepengine")

library(schlepengine)
client <- SchlepEngine$new(api_key = "your_key")
result <- client$upload_file("data.csv")
```

## Development Tools

### Interactive API Explorer
- **Swagger UI**: `/docs` - Interactive API documentation
- **ReDoc**: `/redoc` - Alternative documentation view
- **OpenAPI Spec**: `/openapi.json` - Raw OpenAPI specification

### Testing & Debugging
- **Postman Collection**: Available in our GitHub repository
- **cURL Examples**: Every endpoint includes cURL examples
- **Error Simulator**: `/api/v1/debug/simulate-errors` for testing error handling

## Performance & Reliability

**99.9% Uptime SLA** with automatic failover and global CDN.

**Response Times**:
- Simple operations: < 100ms
- Data processing: < 5 seconds
- ML operations: < 30 seconds (async)

**Features**:
- Automatic retries with exponential backoff
- Circuit breakers for external dependencies
- Request deduplication
- Intelligent caching
- Graceful degradation

## Environment-Specific Endpoints

**Production**: `https://api.schlep-engine.com`
**Staging**: `https://staging-api.schlep-engine.com`  
**Development**: `http://localhost:8000`

## Support

- **Documentation**: https://docs.schlep-engine.com
- **API Status**: https://status.schlep-engine.com
- **Community**: https://community.schlep-engine.com
- **Support**: support@schlep-engine.com
- **Enterprise**: enterprise@schlep-engine.com

---

*Built for developers who want to focus on insights, not infrastructure.*
        """,
        routes=app.routes,
    )
    
    # Add comprehensive security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "Your API key for authentication. Get it from your dashboard at https://app.schlep-engine.com/settings/api-keys"
        },
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token for user authentication (for web app)"
        }
    }
    
    # Add server configurations
    openapi_schema["servers"] = [
        {
            "url": "https://api.schlep-engine.com",
            "description": "Production server"
        },
        {
            "url": "https://staging-api.schlep-engine.com",
            "description": "Staging server (for testing)"
        },
        {
            "url": "http://localhost:8000",
            "description": "Local development server"
        }
    ]
    
    # Add global security requirement
    openapi_schema["security"] = [{"ApiKeyAuth": []}]
    
    # Add comprehensive tags metadata for better organization
    openapi_schema["tags"] = [
        {
            "name": "Quick Start",
            "description": "Essential endpoints to get started quickly"
        },
        {
            "name": "Data Processing",
            "description": "Upload, process, and analyze your data"
        },
        {
            "name": "ML Pipeline",
            "description": "Machine learning pipeline automation"
        },
        {
            "name": "Analytics",
            "description": "Real-time analytics and insights"
        },
        {
            "name": "Integrations",
            "description": "Connect to databases, cloud storage, and APIs"
        },
        {
            "name": "Authentication",
            "description": "API key management and authentication"
        },
        {
            "name": "Webhooks",
            "description": "Real-time notifications and event handling"
        },
        {
            "name": "Usage & Billing",
            "description": "Usage tracking and billing information"
        },
        {
            "name": "Enterprise",
            "description": "Enterprise features and compliance"
        },
        {
            "name": "Admin",
            "description": "Administrative and system operations"
        },
        {
            "name": "Health & Monitoring",
            "description": "System health and performance monitoring"
        }
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi 