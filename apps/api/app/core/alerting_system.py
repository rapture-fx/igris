"""
Comprehensive Alerting Integration System
=======================================

Provides unified alerting across multiple channels:
- Multi-channel notifications (Slack, Email, PagerDuty, Discord)
- Alert aggregation and deduplication
- Escalation policies and routing
- Alert fatigue prevention
- Integration with monitoring and logging systems
"""

import asyncio
import json
import time
import hashlib
from typing import Dict, Any, List, Optional, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import ssl
from collections import defaultdict, deque
import threading

from app.core.config import settings
from app.core.advanced_logging import log_structured, LogLevel, LogCategory


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AlertCategory(str, Enum):
    """Alert categories"""
    SYSTEM = "system"
    APPLICATION = "application"
    SECURITY = "security"
    PERFORMANCE = "performance"
    BUSINESS = "business"
    ML_MODEL = "ml_model"
    RL_TRAINING = "rl_training"
    DATABASE = "database"
    INFRASTRUCTURE = "infrastructure"


class AlertStatus(str, Enum):
    """Alert status"""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"


class NotificationChannel(str, Enum):
    """Notification channels"""
    SLACK = "slack"
    EMAIL = "email"
    PAGERDUTY = "pagerduty"
    DISCORD = "discord"
    WEBHOOK = "webhook"
    SMS = "sms"


@dataclass
class Alert:
    """Alert data structure"""
    id: str
    title: str
    description: str
    severity: AlertSeverity
    category: AlertCategory
    source: str
    timestamp: datetime
    status: AlertStatus = AlertStatus.ACTIVE
    tags: List[str] = None
    metadata: Dict[str, Any] = None
    resolution_time: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.metadata is None:
            self.metadata = {}
    
    @property
    def age_minutes(self) -> float:
        """Age of alert in minutes"""
        return (datetime.utcnow() - self.timestamp).total_seconds() / 60
    
    @property
    def is_stale(self) -> bool:
        """Check if alert is stale (older than 24 hours for non-critical)"""
        max_age_hours = 1 if self.severity == AlertSeverity.CRITICAL else 24
        return self.age_minutes > (max_age_hours * 60)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        # Convert datetime objects to ISO strings
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat() if value else None
        return data


@dataclass
class EscalationPolicy:
    """Alert escalation policy"""
    name: str
    levels: List[Dict[str, Any]]  # List of escalation levels
    repeat_interval_minutes: int = 30
    max_escalations: int = 3
    
    def get_escalation_level(self, attempt: int) -> Dict[str, Any]:
        """Get escalation level for attempt number"""
        if attempt >= len(self.levels):
            return self.levels[-1]  # Use last level for overflow
        return self.levels[attempt]


@dataclass
class NotificationTemplate:
    """Notification template"""
    channel: NotificationChannel
    title_template: str
    body_template: str
    format_type: str = "text"  # text, json, html
    
    def render(self, alert: Alert, **kwargs) -> Dict[str, str]:
        """Render template with alert data"""
        context = {
            **alert.to_dict(),
            **kwargs
        }
        
        try:
            title = self.title_template.format(**context)
            body = self.body_template.format(**context)
        except KeyError as e:
            title = f"Alert Template Error: Missing key {e}"
            body = f"Raw alert data: {json.dumps(context, indent=2)}"
        
        return {
            "title": title,
            "body": body,
            "format": self.format_type
        }


class AlertDeduplicator:
    """Alert deduplication to prevent spam"""
    
    def __init__(self, window_minutes: int = 5):
        self.window_minutes = window_minutes
        self.alert_hashes: Dict[str, List[float]] = defaultdict(list)
        self.lock = threading.Lock()
    
    def generate_alert_hash(self, alert: Alert) -> str:
        """Generate hash for alert deduplication"""
        # Create hash based on title, category, and key metadata
        hash_data = f"{alert.title}:{alert.category}:{alert.source}"
        
        # Include specific metadata fields for more precise deduplication
        if alert.metadata:
            key_fields = ["endpoint", "service", "error_type", "metric_name"]
            for field in key_fields:
                if field in alert.metadata:
                    hash_data += f":{field}={alert.metadata[field]}"
        
        return hashlib.sha256(hash_data.encode()).hexdigest()[:16]
    
    def should_suppress(self, alert: Alert) -> bool:
        """Check if alert should be suppressed due to deduplication"""
        alert_hash = self.generate_alert_hash(alert)
        current_time = time.time()
        
        with self.lock:
            # Get recent alerts for this hash
            recent_alerts = self.alert_hashes[alert_hash]
            
            # Remove old entries outside the window
            window_seconds = self.window_minutes * 60
            cutoff_time = current_time - window_seconds
            recent_alerts[:] = [t for t in recent_alerts if t > cutoff_time]
            
            # Check if we should suppress
            if len(recent_alerts) > 0:
                return True  # Suppress duplicate
            
            # Add current alert
            recent_alerts.append(current_time)
            return False  # Don't suppress


class SlackNotifier:
    """Slack notification handler"""
    
    def __init__(self, webhook_url: Optional[str] = None, token: Optional[str] = None):
        self.webhook_url = webhook_url or getattr(settings, 'SLACK_WEBHOOK_URL', None)
        self.token = token or getattr(settings, 'SLACK_TOKEN', None)
    
    async def send_notification(self, alert: Alert, template: NotificationTemplate) -> bool:
        """Send Slack notification"""
        if not self.webhook_url:
            log_structured(
                LogLevel.WARNING,
                "Slack webhook URL not configured",
                category=LogCategory.SYSTEM
            )
            return False
        
        try:
            rendered = template.render(alert)
            
            # Color based on severity
            color_map = {
                AlertSeverity.CRITICAL: "#FF0000",  # Red
                AlertSeverity.HIGH: "#FF8800",      # Orange
                AlertSeverity.MEDIUM: "#FFDD00",    # Yellow
                AlertSeverity.LOW: "#00DD00",       # Green
                AlertSeverity.INFO: "#0088DD"       # Blue
            }
            
            payload = {
                "attachments": [
                    {
                        "color": color_map.get(alert.severity, "#888888"),
                        "title": rendered["title"],
                        "text": rendered["body"],
                        "fields": [
                            {
                                "title": "Severity",
                                "value": alert.severity.upper(),
                                "short": True
                            },
                            {
                                "title": "Category",
                                "value": alert.category.upper(),
                                "short": True
                            },
                            {
                                "title": "Source",
                                "value": alert.source,
                                "short": True
                            },
                            {
                                "title": "Time",
                                "value": alert.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
                                "short": True
                            }
                        ],
                        "ts": int(alert.timestamp.timestamp())
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    timeout=10.0
                )
                response.raise_for_status()
                return True
        
        except Exception as e:
            log_structured(
                LogLevel.ERROR,
                f"Failed to send Slack notification: {str(e)}",
                category=LogCategory.SYSTEM,
                error_type="slack_notification_failed"
            )
            return False


class EmailNotifier:
    """Email notification handler"""
    
    def __init__(
        self,
        smtp_server: str = None,
        smtp_port: int = None,
        username: str = None,
        password: str = None,
        use_tls: bool = True
    ):
        self.smtp_server = smtp_server or getattr(settings, 'SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = smtp_port or getattr(settings, 'SMTP_PORT', 587)
        self.username = username or getattr(settings, 'SMTP_USERNAME', '')
        self.password = password or getattr(settings, 'SMTP_PASSWORD', '')
        self.use_tls = use_tls
        self.from_email = getattr(settings, 'ALERT_FROM_EMAIL', self.username)
    
    async def send_notification(self, alert: Alert, template: NotificationTemplate, to_emails: List[str]) -> bool:
        """Send email notification"""
        if not self.username or not self.password:
            log_structured(
                LogLevel.WARNING,
                "SMTP credentials not configured",
                category=LogCategory.SYSTEM
            )
            return False
        
        try:
            rendered = template.render(alert)
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = ', '.join(to_emails)
            msg['Subject'] = rendered["title"]
            
            # Add body
            if template.format_type == "html":
                msg.attach(MIMEText(rendered["body"], 'html'))
            else:
                msg.attach(MIMEText(rendered["body"], 'plain'))
            
            # Send email
            def send_sync():
                try:
                    server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                    if self.use_tls:
                        server.starttls()
                    server.login(self.username, self.password)
                    server.send_message(msg)
                    server.quit()
                    return True
                except Exception as e:
                    log_structured(
                        LogLevel.ERROR,
                        f"Failed to send email: {str(e)}",
                        category=LogCategory.SYSTEM,
                        error_type="email_send_failed"
                    )
                    return False
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, send_sync)
        
        except Exception as e:
            log_structured(
                LogLevel.ERROR,
                f"Failed to prepare email notification: {str(e)}",
                category=LogCategory.SYSTEM,
                error_type="email_preparation_failed"
            )
            return False


class WebhookNotifier:
    """Generic webhook notification handler"""
    
    async def send_notification(self, alert: Alert, webhook_url: str, template: NotificationTemplate) -> bool:
        """Send webhook notification"""
        try:
            rendered = template.render(alert)
            
            payload = {
                "alert": alert.to_dict(),
                "title": rendered["title"],
                "body": rendered["body"],
                "timestamp": datetime.utcnow().isoformat(),
                "source": "schlep-engine-alerting"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    timeout=10.0,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                return True
        
        except Exception as e:
            log_structured(
                LogLevel.ERROR,
                f"Failed to send webhook notification: {str(e)}",
                category=LogCategory.SYSTEM,
                error_type="webhook_notification_failed",
                extra={"webhook_url": webhook_url}
            )
            return False


class AlertManager:
    """Central alert management system"""
    
    def __init__(self):
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: deque = deque(maxlen=10000)
        self.deduplicator = AlertDeduplicator()
        self.escalation_policies: Dict[str, EscalationPolicy] = {}
        self.notification_templates: Dict[str, NotificationTemplate] = {}
        self.notifiers: Dict[NotificationChannel, Any] = {}
        self.alert_routes: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
        
        # Initialize notifiers
        self._setup_notifiers()
        self._setup_default_templates()
        self._setup_default_escalation_policies()
        self._setup_default_routes()
    
    def _setup_notifiers(self):
        """Setup notification handlers"""
        self.notifiers[NotificationChannel.SLACK] = SlackNotifier()
        self.notifiers[NotificationChannel.EMAIL] = EmailNotifier()
        self.notifiers[NotificationChannel.WEBHOOK] = WebhookNotifier()
    
    def _setup_default_templates(self):
        """Setup default notification templates"""
        
        # Slack template
        self.notification_templates["slack_default"] = NotificationTemplate(
            channel=NotificationChannel.SLACK,
            title_template="🚨 {severity.upper()} Alert: {title}",
            body_template="{description}\n\nSource: {source}\nCategory: {category}\nTime: {timestamp}"
        )
        
        # Email template
        self.notification_templates["email_default"] = NotificationTemplate(
            channel=NotificationChannel.EMAIL,
            title_template="[ALERT - {severity.upper()}] {title}",
            body_template="""
Alert Details:
==============

Title: {title}
Description: {description}
Severity: {severity}
Category: {category}
Source: {source}
Time: {timestamp}

Tags: {tags}

This is an automated alert from Schlep Engine monitoring system.
            """.strip()
        )
        
        # Webhook template
        self.notification_templates["webhook_default"] = NotificationTemplate(
            channel=NotificationChannel.WEBHOOK,
            title_template="{title}",
            body_template="{description}",
            format_type="json"
        )
    
    def _setup_default_escalation_policies(self):
        """Setup default escalation policies"""
        
        # Critical alerts escalation
        self.escalation_policies["critical"] = EscalationPolicy(
            name="Critical Alerts",
            levels=[
                {
                    "channels": [NotificationChannel.SLACK, NotificationChannel.EMAIL],
                    "recipients": {
                        "slack": ["#alerts-critical"],
                        "email": ["admin@schlep-engine.com"]
                    },
                    "delay_minutes": 0
                },
                {
                    "channels": [NotificationChannel.SLACK],
                    "recipients": {
                        "slack": ["@oncall-engineer"]
                    },
                    "delay_minutes": 5
                }
            ],
            repeat_interval_minutes=15,
            max_escalations=5
        )
        
        # Standard alerts escalation
        self.escalation_policies["standard"] = EscalationPolicy(
            name="Standard Alerts",
            levels=[
                {
                    "channels": [NotificationChannel.SLACK],
                    "recipients": {
                        "slack": ["#alerts"]
                    },
                    "delay_minutes": 0
                }
            ],
            repeat_interval_minutes=60,
            max_escalations=2
        )
    
    def _setup_default_routes(self):
        """Setup default alert routing"""
        
        self.alert_routes = {
            AlertCategory.SECURITY: {
                "escalation_policy": "critical",
                "channels": [NotificationChannel.SLACK, NotificationChannel.EMAIL],
                "recipients": {
                    "slack": ["#security-alerts"],
                    "email": ["security@schlep-engine.com"]
                }
            },
            AlertCategory.SYSTEM: {
                "escalation_policy": "critical" if AlertSeverity.CRITICAL else "standard",
                "channels": [NotificationChannel.SLACK],
                "recipients": {
                    "slack": ["#system-alerts"]
                }
            },
            AlertCategory.APPLICATION: {
                "escalation_policy": "standard",
                "channels": [NotificationChannel.SLACK],
                "recipients": {
                    "slack": ["#app-alerts"]
                }
            },
            AlertCategory.ML_MODEL: {
                "escalation_policy": "standard",
                "channels": [NotificationChannel.SLACK],
                "recipients": {
                    "slack": ["#ml-alerts"]
                }
            },
            AlertCategory.RL_TRAINING: {
                "escalation_policy": "standard",
                "channels": [NotificationChannel.SLACK],
                "recipients": {
                    "slack": ["#rl-alerts"]
                }
            }
        }
    
    async def create_alert(
        self,
        title: str,
        description: str,
        severity: AlertSeverity,
        category: AlertCategory,
        source: str,
        tags: List[str] = None,
        metadata: Dict[str, Any] = None,
        suppress_duplicates: bool = True
    ) -> Alert:
        """Create and process new alert"""
        
        alert = Alert(
            id=self._generate_alert_id(title, source),
            title=title,
            description=description,
            severity=severity,
            category=category,
            source=source,
            timestamp=datetime.utcnow(),
            tags=tags or [],
            metadata=metadata or {}
        )
        
        # Check for deduplication
        if suppress_duplicates and self.deduplicator.should_suppress(alert):
            log_structured(
                LogLevel.DEBUG,
                f"Alert suppressed due to deduplication: {alert.title}",
                category=LogCategory.SYSTEM,
                alert_id=alert.id
            )
            return alert
        
        # Store alert
        with self.lock:
            self.active_alerts[alert.id] = alert
            self.alert_history.append(alert.to_dict())
        
        # Log alert creation
        log_structured(
            LogLevel.INFO,
            f"Alert created: {alert.title}",
            category=LogCategory.SYSTEM,
            alert_id=alert.id,
            severity=alert.severity,
            alert_category=alert.category
        )
        
        # Process alert notifications
        await self._process_alert_notifications(alert)
        
        return alert
    
    def _generate_alert_id(self, title: str, source: str) -> str:
        """Generate unique alert ID"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        hash_input = f"{title}:{source}:{timestamp}"
        hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8]
        return f"alert_{timestamp}_{hash_value}"
    
    async def _process_alert_notifications(self, alert: Alert):
        """Process alert notifications based on routing rules"""
        
        # Get routing configuration
        route_config = self.alert_routes.get(alert.category, self.alert_routes[AlertCategory.APPLICATION])
        
        # Get escalation policy
        escalation_policy_name = route_config.get("escalation_policy", "standard")
        escalation_policy = self.escalation_policies.get(escalation_policy_name)
        
        if not escalation_policy:
            log_structured(
                LogLevel.ERROR,
                f"Escalation policy not found: {escalation_policy_name}",
                category=LogCategory.SYSTEM,
                alert_id=alert.id
            )
            return
        
        # Send initial notifications
        await self._send_notifications(alert, escalation_policy.levels[0])
        
        # Schedule escalations for critical alerts
        if alert.severity == AlertSeverity.CRITICAL and len(escalation_policy.levels) > 1:
            asyncio.create_task(self._handle_escalation(alert, escalation_policy))
    
    async def _send_notifications(self, alert: Alert, escalation_level: Dict[str, Any]):
        """Send notifications for specific escalation level"""
        
        channels = escalation_level.get("channels", [])
        recipients = escalation_level.get("recipients", {})
        
        for channel in channels:
            try:
                notifier = self.notifiers.get(channel)
                template_key = f"{channel.value}_default"
                template = self.notification_templates.get(template_key)
                
                if not notifier or not template:
                    continue
                
                channel_recipients = recipients.get(channel.value, [])
                
                if channel == NotificationChannel.SLACK:
                    success = await notifier.send_notification(alert, template)
                elif channel == NotificationChannel.EMAIL:
                    success = await notifier.send_notification(alert, template, channel_recipients)
                elif channel == NotificationChannel.WEBHOOK:
                    webhook_url = getattr(settings, 'ALERT_WEBHOOK_URL', None)
                    if webhook_url:
                        success = await notifier.send_notification(alert, webhook_url, template)
                    else:
                        success = False
                else:
                    success = False
                
                if success:
                    log_structured(
                        LogLevel.INFO,
                        f"Alert notification sent via {channel.value}",
                        category=LogCategory.SYSTEM,
                        alert_id=alert.id,
                        channel=channel.value
                    )
                
            except Exception as e:
                log_structured(
                    LogLevel.ERROR,
                    f"Failed to send notification via {channel.value}: {str(e)}",
                    category=LogCategory.SYSTEM,
                    alert_id=alert.id,
                    channel=channel.value,
                    error_type="notification_send_failed"
                )
    
    async def _handle_escalation(self, alert: Alert, escalation_policy: EscalationPolicy):
        """Handle alert escalation"""
        
        escalation_attempt = 1
        
        while (
            escalation_attempt < len(escalation_policy.levels) and
            escalation_attempt < escalation_policy.max_escalations and
            alert.id in self.active_alerts and
            self.active_alerts[alert.id].status == AlertStatus.ACTIVE
        ):
            # Wait for delay
            delay_minutes = escalation_policy.levels[escalation_attempt].get("delay_minutes", 5)
            await asyncio.sleep(delay_minutes * 60)
            
            # Check if alert is still active
            if (alert.id not in self.active_alerts or 
                self.active_alerts[alert.id].status != AlertStatus.ACTIVE):
                break
            
            # Send escalation notifications
            await self._send_notifications(alert, escalation_policy.levels[escalation_attempt])
            
            log_structured(
                LogLevel.WARNING,
                f"Alert escalated to level {escalation_attempt + 1}",
                category=LogCategory.SYSTEM,
                alert_id=alert.id,
                escalation_level=escalation_attempt + 1
            )
            
            escalation_attempt += 1
    
    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert"""
        with self.lock:
            if alert_id not in self.active_alerts:
                return False
            
            alert = self.active_alerts[alert_id]
            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_by = acknowledged_by
            alert.acknowledged_at = datetime.utcnow()
            
            log_structured(
                LogLevel.INFO,
                f"Alert acknowledged by {acknowledged_by}",
                category=LogCategory.SYSTEM,
                alert_id=alert_id,
                acknowledged_by=acknowledged_by
            )
            
            return True
    
    async def resolve_alert(self, alert_id: str, resolved_by: str = "system") -> bool:
        """Resolve an alert"""
        with self.lock:
            if alert_id not in self.active_alerts:
                return False
            
            alert = self.active_alerts[alert_id]
            alert.status = AlertStatus.RESOLVED
            alert.resolution_time = datetime.utcnow()
            
            # Move from active to history
            del self.active_alerts[alert_id]
            
            log_structured(
                LogLevel.INFO,
                f"Alert resolved by {resolved_by}",
                category=LogCategory.SYSTEM,
                alert_id=alert_id,
                resolved_by=resolved_by,
                duration_minutes=alert.age_minutes
            )
            
            return True
    
    def get_active_alerts(self, category: AlertCategory = None, severity: AlertSeverity = None) -> List[Alert]:
        """Get active alerts with optional filtering"""
        with self.lock:
            alerts = list(self.active_alerts.values())
        
        if category:
            alerts = [a for a in alerts if a.category == category]
        
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        
        return sorted(alerts, key=lambda x: x.timestamp, reverse=True)
    
    def get_alert_summary(self) -> Dict[str, Any]:
        """Get alert summary for monitoring dashboard"""
        with self.lock:
            active_alerts = list(self.active_alerts.values())
        
        # Count by severity
        severity_counts = defaultdict(int)
        for alert in active_alerts:
            severity_counts[alert.severity] += 1
        
        # Count by category
        category_counts = defaultdict(int)
        for alert in active_alerts:
            category_counts[alert.category] += 1
        
        # Recent activity
        recent_alerts = [
            alert for alert in active_alerts
            if alert.age_minutes <= 60
        ]
        
        return {
            "total_active_alerts": len(active_alerts),
            "severity_breakdown": dict(severity_counts),
            "category_breakdown": dict(category_counts),
            "recent_alerts_last_hour": len(recent_alerts),
            "oldest_alert_age_minutes": max([a.age_minutes for a in active_alerts]) if active_alerts else 0,
            "critical_alerts": len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]),
            "acknowledged_alerts": len([a for a in active_alerts if a.status == AlertStatus.ACKNOWLEDGED])
        }


# Global alert manager instance
alert_manager = AlertManager()

# Convenience functions
async def create_alert(
    title: str,
    description: str,
    severity: AlertSeverity,
    category: AlertCategory,
    source: str,
    **kwargs
) -> Alert:
    """Create new alert"""
    return await alert_manager.create_alert(title, description, severity, category, source, **kwargs)

async def create_system_alert(title: str, description: str, severity: AlertSeverity = AlertSeverity.MEDIUM, **kwargs):
    """Create system alert"""
    return await create_alert(title, description, severity, AlertCategory.SYSTEM, "system", **kwargs)

async def create_security_alert(title: str, description: str, severity: AlertSeverity = AlertSeverity.HIGH, **kwargs):
    """Create security alert"""
    return await create_alert(title, description, severity, AlertCategory.SECURITY, "security", **kwargs)

async def create_performance_alert(title: str, description: str, severity: AlertSeverity = AlertSeverity.MEDIUM, **kwargs):
    """Create performance alert"""
    return await create_alert(title, description, severity, AlertCategory.PERFORMANCE, "performance", **kwargs)

async def create_ml_alert(title: str, description: str, severity: AlertSeverity = AlertSeverity.MEDIUM, **kwargs):
    """Create ML model alert"""
    return await create_alert(title, description, severity, AlertCategory.ML_MODEL, "ml_service", **kwargs)

async def create_rl_alert(title: str, description: str, severity: AlertSeverity = AlertSeverity.MEDIUM, **kwargs):
    """Create RL training alert"""
    return await create_alert(title, description, severity, AlertCategory.RL_TRAINING, "rl_service", **kwargs)

def get_active_alerts(**kwargs) -> List[Alert]:
    """Get active alerts"""
    return alert_manager.get_active_alerts(**kwargs)

def get_alert_summary() -> Dict[str, Any]:
    """Get alert summary"""
    return alert_manager.get_alert_summary()

async def acknowledge_alert(alert_id: str, acknowledged_by: str) -> bool:
    """Acknowledge alert"""
    return await alert_manager.acknowledge_alert(alert_id, acknowledged_by)

async def resolve_alert(alert_id: str, resolved_by: str = "system") -> bool:
    """Resolve alert"""
    return await alert_manager.resolve_alert(alert_id, resolved_by)