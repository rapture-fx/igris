from fastapi.openapi.utils import get_openapi
from app.main import app

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Pollarbase API",
        version="1.0.0",
        description="""
        AI-powered data analysis platform.
        
        ## Features
        
        - Intelligent data investigation and pattern detection
        - AI-powered data quality analysis and schema detection
        - Smart data cleaning and preprocessing
        - Custom validation rules and templates
        - Flexible data transformation pipelines
        - Asynchronous job processing
        - Webhook notifications
        
        ## Authentication
        
        All API endpoints require authentication using an API key.
        Include your API key in the `X-API-Key` header with each request.
        
        ## Rate Limiting
        
        API requests are subject to rate limiting:
        - 60 requests per minute
        - 1000 requests per hour
        
        ## Usage-based Billing
        
        API usage is tracked and billed based on:
        - Number of records processed
        - Complexity of operations
        - Storage duration
        
        ## Webhooks
        
        Configure webhook URLs to receive notifications for:
        - Job completion
        - Error events
        - Usage alerts
        
        ## SDKs
        
        Official SDKs are available for:
        - Python
        - JavaScript/TypeScript
        - R
        - cURL examples
        """,
        routes=app.routes,
    )
    
    # Add security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API key for authentication"
        }
    }
    
    # Add global security requirement
    openapi_schema["security"] = [{"ApiKeyAuth": []}]
    
    # Add tags metadata
    openapi_schema["tags"] = [
        {
            "name": "public",
            "description": "Public API endpoints for data operations"
        },
        {
            "name": "dashboard",
            "description": "SaaS dashboard endpoints"
        },
        {
            "name": "auth",
            "description": "Authentication and authorization"
        },
        {
            "name": "billing",
            "description": "Usage tracking and billing"
        },
        {
            "name": "admin",
            "description": "Administrative operations"
        }
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi 