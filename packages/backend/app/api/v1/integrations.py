from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter()

# Pydantic models
class PlatformIntegration(BaseModel):
    id: str
    name: str
    description: str
    type: str  # 'connector' | 'webhook' | 'template'
    provider: str
    status: str  # 'active' | 'beta' | 'deprecated'
    configuration: Dict[str, Any]
    documentation_url: str

class ConfigurationUpdate(BaseModel):
    configuration: Dict[str, Any]

# Mock data for demonstration
mock_platform_integrations = [
    {
        "id": "1",
        "name": "PostgreSQL Connector",
        "description": "Direct connection to PostgreSQL databases",
        "type": "connector",
        "provider": "PostgreSQL Foundation",
        "status": "active",
        "configuration": {
            "host": "localhost",
            "port": 5432,
            "database": "mydb",
            "username": "user",
            "password": "****"
        },
        "documentation_url": "https://docs.postgresql.org/connector"
    },
    {
        "id": "2",
        "name": "Slack Webhook",
        "description": "Send notifications to Slack channels",
        "type": "webhook",
        "provider": "Slack Technologies",
        "status": "active",
        "configuration": {
            "webhook_url": "https://hooks.slack.com/services/...",
            "channel": "#data-alerts",
            "username": "DataBot"
        },
        "documentation_url": "https://api.slack.com/messaging/webhooks"
    },
    {
        "id": "3",
        "name": "CSV Import Template",
        "description": "Pre-configured template for CSV data imports",
        "type": "template",
        "provider": "Pollarbase",
        "status": "active",
        "configuration": {
            "delimiter": ",",
            "encoding": "utf-8",
            "skip_rows": 1,
            "auto_detect_types": True
        },
        "documentation_url": "https://docs.dataclean.ai/templates/csv"
    },
    {
        "id": "4",
        "name": "MongoDB Connector (Beta)",
        "description": "Connect to MongoDB databases",
        "type": "connector",
        "provider": "MongoDB Inc",
        "status": "beta",
        "configuration": {
            "connection_string": "mongodb://localhost:27017",
            "database": "mydb",
            "collection": "data"
        },
        "documentation_url": "https://docs.mongodb.com/connector"
    }
]

@router.get("", response_model=List[PlatformIntegration])
async def get_integrations():
    """Get all platform integrations"""
    return mock_platform_integrations

@router.post("/{integration_id}/config")
async def save_integration_config(integration_id: str, config_update: ConfigurationUpdate):
    """Save configuration for a specific integration"""
    integration = next((i for i in mock_platform_integrations if i["id"] == integration_id), None)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Update the configuration
    integration["configuration"].update(config_update.configuration)
    
    return {
        "message": "Configuration saved successfully",
        "integration_id": integration_id,
        "updated_config": integration["configuration"]
    } 