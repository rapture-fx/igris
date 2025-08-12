"""
Webhook Notification Service
===========================

Comprehensive webhook service for sending notifications about pipeline events,
processing completion, and system status updates.

Key Features:
- Pipeline completion notifications
- Quality threshold alerts
- Error notifications
- Custom webhook configurations
- Retry logic with exponential backoff
- Webhook validation and security
"""

import asyncio
import logging
import hmac
import hashlib
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
from urllib.parse import urlparse

from app.database.connection import get_db
from app.database.models import User, Workspace
from app.database.ml_preparation_models import DataPreparationPipeline, PreparationStage
from app.core.config import settings

logger = logging.getLogger(__name__)


class WebhookEventType(Enum):
    """Types of webhook events"""
    PIPELINE_CREATED = "pipeline.created"
    PIPELINE_STARTED = "pipeline.started"
    PIPELINE_COMPLETED = "pipeline.completed"
    PIPELINE_FAILED = "pipeline.failed"
    QUALITY_THRESHOLD_MET = "quality.threshold_met"
    QUALITY_THRESHOLD_FAILED = "quality.threshold_failed"
    EXPORT_COMPLETED = "export.completed"
    EXPORT_FAILED = "export.failed"
    SYSTEM_ALERT = "system.alert"


@dataclass
class WebhookConfiguration:
    """Webhook configuration"""
    webhook_id: str
    url: str
    secret: Optional[str]
    events: List[WebhookEventType]
    active: bool = True
    retry_attempts: int = 3
    timeout_seconds: int = 30
    workspace_id: Optional[str] = None
    user_id: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None


@dataclass
class WebhookPayload:
    """Webhook payload structure"""
    event_type: WebhookEventType
    event_id: str
    timestamp: str
    workspace_id: str
    user_id: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class WebhookService:
    """
    Service for managing and delivering webhook notifications
    """
    
    def __init__(self):
        self.webhooks: Dict[str, WebhookConfiguration] = {}
        self.retry_delays = [1, 5, 15]  # Retry delays in seconds
    
    def register_webhook(self, config: WebhookConfiguration) -> str:
        """
        Register a new webhook configuration
        """
        
        # Validate URL
        try:
            parsed_url = urlparse(config.url)
            if not parsed_url.scheme or not parsed_url.netloc:
                raise ValueError("Invalid webhook URL")
        except Exception as e:
            raise ValueError(f"Invalid webhook URL: {str(e)}")
        
        # Store configuration
        self.webhooks[config.webhook_id] = config
        
        logger.info(f"Registered webhook {config.webhook_id} for events: {[e.value for e in config.events]}")
        
        return config.webhook_id
    
    def unregister_webhook(self, webhook_id: str) -> bool:
        """
        Unregister a webhook configuration
        """
        
        if webhook_id in self.webhooks:
            del self.webhooks[webhook_id]
            logger.info(f"Unregistered webhook {webhook_id}")
            return True
        
        return False
    
    async def send_pipeline_created_event(
        self,
        pipeline: DataPreparationPipeline,
        user_id: str
    ):
        """
        Send webhook notification for pipeline creation
        """
        
        payload = WebhookPayload(
            event_type=WebhookEventType.PIPELINE_CREATED,
            event_id=f"pipeline_created_{pipeline.id}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=pipeline.workspace_id,
            user_id=user_id,
            data={
                "pipeline_id": str(pipeline.id),
                "pipeline_name": pipeline.name,
                "description": pipeline.description,
                "target_frameworks": pipeline.target_frameworks,
                "created_at": pipeline.created_at.isoformat(),
                "source_data_path": pipeline.source_data_path
            }
        )
        
        await self._send_webhooks(payload)
    
    async def send_pipeline_completed_event(
        self,
        pipeline: DataPreparationPipeline,
        result: Dict[str, Any]
    ):
        """
        Send webhook notification for pipeline completion
        """
        
        payload = WebhookPayload(
            event_type=WebhookEventType.PIPELINE_COMPLETED,
            event_id=f"pipeline_completed_{pipeline.id}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=pipeline.workspace_id,
            user_id=pipeline.created_by_id,
            data={
                "pipeline_id": str(pipeline.id),
                "pipeline_name": pipeline.name,
                "quality_score": pipeline.quality_score,
                "quality_level": pipeline.quality_level.value if pipeline.quality_level else None,
                "is_ml_ready": pipeline.is_ml_ready,
                "processing_time_seconds": pipeline.processing_time_seconds,
                "total_records": pipeline.total_records,
                "total_columns": pipeline.total_columns,
                "frameworks_exported": result.get("frameworks_exported", []),
                "output_paths": result.get("output_paths", {}),
                "completed_at": pipeline.completed_at.isoformat() if pipeline.completed_at else None
            },
            metadata={
                "issues_resolved": result.get("issues_resolved", []),
                "recommendations": result.get("recommendations", [])
            }
        )
        
        await self._send_webhooks(payload)
    
    async def send_pipeline_failed_event(
        self,
        pipeline: DataPreparationPipeline,
        error_message: str,
        error_stage: PreparationStage
    ):
        """
        Send webhook notification for pipeline failure
        """
        
        payload = WebhookPayload(
            event_type=WebhookEventType.PIPELINE_FAILED,
            event_id=f"pipeline_failed_{pipeline.id}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=pipeline.workspace_id,
            user_id=pipeline.created_by_id,
            data={
                "pipeline_id": str(pipeline.id),
                "pipeline_name": pipeline.name,
                "error_message": error_message,
                "error_stage": error_stage.value,
                "progress_percentage": pipeline.progress_percentage,
                "failed_at": datetime.utcnow().isoformat()
            }
        )
        
        await self._send_webhooks(payload)
    
    async def send_quality_threshold_event(
        self,
        pipeline: DataPreparationPipeline,
        threshold_met: bool,
        quality_score: float,
        threshold: float
    ):
        """
        Send webhook notification for quality threshold events
        """
        
        event_type = WebhookEventType.QUALITY_THRESHOLD_MET if threshold_met else WebhookEventType.QUALITY_THRESHOLD_FAILED
        
        payload = WebhookPayload(
            event_type=event_type,
            event_id=f"quality_{event_type.value}_{pipeline.id}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=pipeline.workspace_id,
            user_id=pipeline.created_by_id,
            data={
                "pipeline_id": str(pipeline.id),
                "pipeline_name": pipeline.name,
                "quality_score": quality_score,
                "quality_threshold": threshold,
                "threshold_met": threshold_met,
                "quality_level": pipeline.quality_level.value if pipeline.quality_level else None
            }
        )
        
        await self._send_webhooks(payload)
    
    async def send_export_completed_event(
        self,
        pipeline: DataPreparationPipeline,
        framework: str,
        export_result: Dict[str, Any]
    ):
        """
        Send webhook notification for framework export completion
        """
        
        payload = WebhookPayload(
            event_type=WebhookEventType.EXPORT_COMPLETED,
            event_id=f"export_completed_{pipeline.id}_{framework}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=pipeline.workspace_id,
            user_id=pipeline.created_by_id,
            data={
                "pipeline_id": str(pipeline.id),
                "pipeline_name": pipeline.name,
                "framework": framework,
                "output_path": export_result.get("output_path"),
                "export_size_mb": export_result.get("size_mb"),
                "validation_passed": export_result.get("validation_passed"),
                "export_time_seconds": export_result.get("export_time_seconds")
            }
        )
        
        await self._send_webhooks(payload)
    
    async def send_system_alert_event(
        self,
        alert_type: str,
        message: str,
        severity: str = "info",
        workspace_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """
        Send webhook notification for system alerts
        """
        
        payload = WebhookPayload(
            event_type=WebhookEventType.SYSTEM_ALERT,
            event_id=f"system_alert_{alert_type}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=workspace_id or "system",
            user_id="system",
            data={
                "alert_type": alert_type,
                "message": message,
                "severity": severity,
                **(additional_data or {})
            }
        )
        
        await self._send_webhooks(payload)
    
    async def _send_webhooks(self, payload: WebhookPayload):
        """
        Send webhook payload to all registered webhooks
        """
        
        # Filter webhooks for this event type and workspace
        relevant_webhooks = [
            webhook for webhook in self.webhooks.values()
            if (
                webhook.active and
                payload.event_type in webhook.events and
                (not webhook.workspace_id or webhook.workspace_id == payload.workspace_id) and
                (not webhook.user_id or webhook.user_id == payload.user_id)
            )
        ]
        
        if not relevant_webhooks:
            logger.debug(f"No webhooks registered for event {payload.event_type.value}")
            return
        
        # Send webhooks concurrently
        tasks = [
            self._send_webhook(webhook, payload)
            for webhook in relevant_webhooks
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_webhook(self, webhook: WebhookConfiguration, payload: WebhookPayload):
        """
        Send webhook payload to a specific webhook URL with retry logic
        """
        
        # Prepare payload
        payload_dict = asdict(payload)
        payload_dict["event_type"] = payload.event_type.value
        payload_json = json.dumps(payload_dict, default=str)
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"Schlep-Engine-Webhook/1.0",
            "X-Webhook-Event": payload.event_type.value,
            "X-Webhook-ID": payload.event_id,
            "X-Webhook-Timestamp": payload.timestamp
        }
        
        # Add custom headers
        if webhook.custom_headers:
            headers.update(webhook.custom_headers)
        
        # Add signature if secret is provided
        if webhook.secret:
            signature = hmac.new(
                webhook.secret.encode(),
                payload_json.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        # Attempt delivery with retries
        for attempt in range(webhook.retry_attempts):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        webhook.url,
                        data=payload_json,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=webhook.timeout_seconds)
                    ) as response:
                        
                        if response.status < 400:
                            logger.info(f"Webhook {webhook.webhook_id} delivered successfully (attempt {attempt + 1})")
                            return
                        else:
                            logger.warning(f"Webhook {webhook.webhook_id} failed with status {response.status} (attempt {attempt + 1})")
                            response_text = await response.text()
                            logger.debug(f"Response: {response_text}")
                            
            except asyncio.TimeoutError:
                logger.warning(f"Webhook {webhook.webhook_id} timed out (attempt {attempt + 1})")
            except Exception as e:
                logger.warning(f"Webhook {webhook.webhook_id} failed with error: {str(e)} (attempt {attempt + 1})")
            
            # Wait before retry (except on last attempt)
            if attempt < webhook.retry_attempts - 1:
                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                await asyncio.sleep(delay)
        
        logger.error(f"Webhook {webhook.webhook_id} failed after {webhook.retry_attempts} attempts")
    
    def get_webhook_configurations(self, workspace_id: Optional[str] = None) -> List[WebhookConfiguration]:
        """
        Get webhook configurations for a workspace
        """
        
        if workspace_id:
            return [
                webhook for webhook in self.webhooks.values()
                if not webhook.workspace_id or webhook.workspace_id == workspace_id
            ]
        
        return list(self.webhooks.values())
    
    async def test_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """
        Test webhook delivery with a test payload
        """
        
        if webhook_id not in self.webhooks:
            return {"success": False, "error": "Webhook not found"}
        
        webhook = self.webhooks[webhook_id]
        
        # Create test payload
        test_payload = WebhookPayload(
            event_type=WebhookEventType.SYSTEM_ALERT,
            event_id=f"test_{webhook_id}_{int(datetime.utcnow().timestamp())}",
            timestamp=datetime.utcnow().isoformat(),
            workspace_id=webhook.workspace_id or "test",
            user_id=webhook.user_id or "test",
            data={
                "message": "This is a test webhook",
                "webhook_id": webhook_id
            }
        )
        
        try:
            await self._send_webhook(webhook, test_payload)
            return {"success": True, "message": "Test webhook sent successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Global instance
webhook_service = WebhookService()


# Predefined webhook configurations for common integrations
COMMON_WEBHOOK_CONFIGS = {
    "slack": {
        "name": "Slack Integration",
        "description": "Send notifications to Slack channels",
        "required_headers": {"Content-Type": "application/json"},
        "payload_format": "slack"
    },
    "discord": {
        "name": "Discord Integration", 
        "description": "Send notifications to Discord channels",
        "required_headers": {"Content-Type": "application/json"},
        "payload_format": "discord"
    },
    "teams": {
        "name": "Microsoft Teams Integration",
        "description": "Send notifications to Teams channels",
        "required_headers": {"Content-Type": "application/json"},
        "payload_format": "teams"
    },
    "generic": {
        "name": "Generic Webhook",
        "description": "Standard JSON payload",
        "required_headers": {"Content-Type": "application/json"},
        "payload_format": "json"
    }
} 