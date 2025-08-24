"""
Real-Time Notification System with Stream Coordination
======================================================

Comprehensive notification system that coordinates with stream processing:
- Multi-channel notifications (WebSocket, email, SMS, webhooks)
- Intelligent notification routing and filtering
- Stream-based event correlation and aggregation
- User preference management
- Notification delivery tracking and reliability
- Rate limiting and throttling

Features:
- Real-time WebSocket notifications
- Email and SMS delivery integration
- Webhook notifications for external systems
- Notification templates and personalization
- Delivery confirmation and retry logic
- Notification analytics and metrics
"""

import asyncio
import json
import logging
import smtplib
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Any, Optional, Set, Callable, Union
from enum import Enum
from jinja2 import Template

from app.core.redis_streams import get_streams_client, StreamMessage, EventType
from app.core.event_sourcing import DomainEvent, get_event_bus
from app.api.v1.websocket_manager import websocket_manager
from app.core.unified_config import settings

logger = logging.getLogger(__name__)

# ==================== NOTIFICATION TYPES AND CHANNELS ====================

class NotificationChannel(Enum):
    """Notification delivery channels"""
    WEBSOCKET = "websocket"
    EMAIL = "email"
    SMS = "sms"
    WEBHOOK = "webhook"
    PUSH = "push"
    IN_APP = "in_app"

class NotificationPriority(Enum):
    """Notification priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    URGENT = "urgent"

class NotificationType(Enum):
    """Types of notifications"""
    SYSTEM_ALERT = "system_alert"
    IOT_ALERT = "iot_alert"
    FRAUD_ALERT = "fraud_alert"
    PIPELINE_STATUS = "pipeline_status"
    DATA_QUALITY = "data_quality"
    PERFORMANCE = "performance"
    SECURITY = "security"
    USER_ACTION = "user_action"

@dataclass
class NotificationRecipient:
    """Notification recipient information"""
    user_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    preferred_channels: List[NotificationChannel] = field(default_factory=list)
    timezone: str = "UTC"
    language: str = "en"

@dataclass
class NotificationTemplate:
    """Notification template definition"""
    template_id: str
    notification_type: NotificationType
    channels: List[NotificationChannel]
    subject_template: str
    body_template: str
    priority: NotificationPriority
    variables: Dict[str, Any] = field(default_factory=dict)

@dataclass
class NotificationMessage:
    """Individual notification message"""
    message_id: str
    notification_type: NotificationType
    channel: "BaseNotificationChannel"
    recipient: NotificationRecipient
    subject: str
    body: str
    priority: NotificationPriority
    created_at: datetime
    scheduled_at: Optional[datetime] = None
    data: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

@dataclass
class DeliveryResult:
    """Notification delivery result"""
    message_id: str
    channel: "BaseNotificationChannel"
    success: bool
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    delivery_id: Optional[str] = None  # External delivery ID

# ==================== NOTIFICATION CHANNELS ====================

class BaseNotificationChannel(ABC):
    """Abstract base class for notification channels"""
    
    @abstractmethod
    async def send(self, message: NotificationMessage) -> DeliveryResult:
        """Send notification message"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if channel is available"""
        pass

class WebSocketNotificationChannel(BaseNotificationChannel):
    """WebSocket notification channel"""
    
    async def send(self, message: NotificationMessage) -> DeliveryResult:
        """Send WebSocket notification"""
        try:
            notification_data = {
                "message_id": message.message_id,
                "type": message.notification_type.value,
                "priority": message.priority.value,
                "subject": message.subject,
                "body": message.body,
                "data": message.data,
                "created_at": message.created_at.isoformat(),
                "correlation_id": message.correlation_id
            }
            
            # Send to specific user
            await websocket_manager.send_to_user(
                message.recipient.user_id,
                websocket_manager.EventType.SYSTEM_ALERT,
                {
                    "notification": notification_data,
                    "channel": "websocket"
                }
            )
            
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.WEBSOCKET,
                success=True,
                delivered_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to send WebSocket notification {message.message_id}: {e}")
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.WEBSOCKET,
                success=False,
                error_message=str(e)
            )
    
    def is_available(self) -> bool:
        """WebSocket is always available if the manager is running"""
        return True

class EmailNotificationChannel(BaseNotificationChannel):
    """Email notification channel"""
    
    def __init__(self):
        self.smtp_server = getattr(settings, 'SMTP_SERVER', 'localhost')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_username = getattr(settings, 'SMTP_USERNAME', '')
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
        self.from_email = getattr(settings, 'FROM_EMAIL', 'notifications@schlep-engine.com')
    
    async def send(self, message: NotificationMessage) -> DeliveryResult:
        """Send email notification"""
        if not message.recipient.email:
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.EMAIL,
                success=False,
                error_message="No email address provided"
            )
        
        try:
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = message.recipient.email
            msg['Subject'] = message.subject
            
            # Add body
            msg.attach(MIMEText(message.body, 'html'))
            
            # Send email (in production, use async email library)
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.smtp_username:
                    server.starttls()
                    server.login(self.smtp_username, self.smtp_password)
                
                server.send_message(msg)
            
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.EMAIL,
                success=True,
                delivered_at=datetime.utcnow(),
                delivery_id=f"email_{message.message_id}"
            )
            
        except Exception as e:
            logger.error(f"Failed to send email notification {message.message_id}: {e}")
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.EMAIL,
                success=False,
                error_message=str(e)
            )
    
    def is_available(self) -> bool:
        """Check if email service is configured"""
        return bool(self.smtp_server and self.from_email)

class WebhookNotificationChannel(BaseNotificationChannel):
    """Webhook notification channel"""
    
    def __init__(self):
        self.webhook_endpoints = {}  # webhook_id -> endpoint_url
        self.timeout = 30  # seconds
    
    def register_webhook(self, webhook_id: str, endpoint_url: str):
        """Register a webhook endpoint"""
        self.webhook_endpoints[webhook_id] = endpoint_url
        logger.info(f"Registered webhook {webhook_id}: {endpoint_url}")
    
    async def send(self, message: NotificationMessage) -> DeliveryResult:
        """Send webhook notification"""
        
        webhook_id = message.data.get("webhook_id")
        if not webhook_id or webhook_id not in self.webhook_endpoints:
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error_message="No webhook endpoint configured"
            )
        
        try:
            import aiohttp
            
            webhook_url = self.webhook_endpoints[webhook_id]
            payload = {
                "message_id": message.message_id,
                "notification_type": message.notification_type.value,
                "priority": message.priority.value,
                "subject": message.subject,
                "body": message.body,
                "data": message.data,
                "timestamp": message.created_at.isoformat(),
                "correlation_id": message.correlation_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    response.raise_for_status()
                    
                    return DeliveryResult(
                        message_id=message.message_id,
                        channel=NotificationChannel.WEBHOOK,
                        success=True,
                        delivered_at=datetime.utcnow(),
                        delivery_id=f"webhook_{webhook_id}_{message.message_id}"
                    )
            
        except Exception as e:
            logger.error(f"Failed to send webhook notification {message.message_id}: {e}")
            return DeliveryResult(
                message_id=message.message_id,
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error_message=str(e)
            )
    
    def is_available(self) -> bool:
        """Check if webhook endpoints are configured"""
        return len(self.webhook_endpoints) > 0

# ==================== NOTIFICATION TEMPLATES ====================

class NotificationTemplateManager:
    """Manages notification templates"""
    
    def __init__(self):
        self.templates = {}
        self._initialize_default_templates()
    
    def _initialize_default_templates(self):
        """Initialize default notification templates"""
        
        # IoT Alert Templates
        self.templates["iot_critical_alert"] = NotificationTemplate(
            template_id="iot_critical_alert",
            notification_type=NotificationType.IOT_ALERT,
            channels=[NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
            subject_template="CRITICAL: IoT Device Alert - {{ device_id }}",
            body_template="""
            <h2>Critical IoT Device Alert</h2>
            <p><strong>Device ID:</strong> {{ device_id }}</p>
            <p><strong>Alert Type:</strong> {{ alert_type }}</p>
            <p><strong>Value:</strong> {{ value }} {{ unit }}</p>
            <p><strong>Threshold:</strong> {{ threshold }} {{ unit }}</p>
            <p><strong>Location:</strong> {{ location }}</p>
            <p><strong>Time:</strong> {{ timestamp }}</p>
            
            <h3>Recommended Actions:</h3>
            <ul>
            {% for action in recommended_actions %}
                <li>{{ action }}</li>
            {% endfor %}
            </ul>
            
            <p><em>This is an automated alert from Schlep Engine IoT Monitoring System.</em></p>
            """,
            priority=NotificationPriority.CRITICAL
        )
        
        # Financial Fraud Alert
        self.templates["fraud_detection"] = NotificationTemplate(
            template_id="fraud_detection",
            notification_type=NotificationType.FRAUD_ALERT,
            channels=[NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.WEBHOOK],
            subject_template="FRAUD ALERT: Suspicious Transaction Detected - {{ transaction_id }}",
            body_template="""
            <h2>Fraud Detection Alert</h2>
            <p><strong>Transaction ID:</strong> {{ transaction_id }}</p>
            <p><strong>Customer ID:</strong> {{ customer_id }}</p>
            <p><strong>Amount:</strong> ${{ amount }}</p>
            <p><strong>Fraud Score:</strong> {{ fraud_score }}</p>
            <p><strong>Risk Level:</strong> {{ risk_level }}</p>
            
            <h3>Risk Factors:</h3>
            <ul>
            {% for factor in risk_factors %}
                <li>{{ factor }}</li>
            {% endfor %}
            </ul>
            
            <h3>Recommended Action:</h3>
            <p><strong>{{ recommendation }}</strong></p>
            
            <p><em>Immediate review required. Contact fraud department if necessary.</em></p>
            """,
            priority=NotificationPriority.CRITICAL
        )
        
        # Pipeline Status
        self.templates["pipeline_failed"] = NotificationTemplate(
            template_id="pipeline_failed",
            notification_type=NotificationType.PIPELINE_STATUS,
            channels=[NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
            subject_template="Pipeline Failure: {{ pipeline_name }}",
            body_template="""
            <h2>Data Pipeline Failure</h2>
            <p><strong>Pipeline:</strong> {{ pipeline_name }}</p>
            <p><strong>Execution ID:</strong> {{ execution_id }}</p>
            <p><strong>Failed At:</strong> {{ failed_at }}</p>
            <p><strong>Error:</strong> {{ error_message }}</p>
            
            <p>Please check the pipeline logs and take appropriate action to resolve the issue.</p>
            
            <p><em>Automated notification from Schlep Engine Pipeline Monitor.</em></p>
            """,
            priority=NotificationPriority.HIGH
        )
        
        # System Performance
        self.templates["performance_degradation"] = NotificationTemplate(
            template_id="performance_degradation",
            notification_type=NotificationType.PERFORMANCE,
            channels=[NotificationChannel.WEBSOCKET],
            subject_template="Performance Alert: {{ component }} Degradation",
            body_template="""
            <h3>Performance Degradation Detected</h3>
            <p><strong>Component:</strong> {{ component }}</p>
            <p><strong>Metric:</strong> {{ metric_name }}</p>
            <p><strong>Current Value:</strong> {{ current_value }}</p>
            <p><strong>Threshold:</strong> {{ threshold }}</p>
            <p><strong>Duration:</strong> {{ duration }} minutes</p>
            """,
            priority=NotificationPriority.MEDIUM
        )
    
    def get_template(self, template_id: str) -> Optional[NotificationTemplate]:
        """Get notification template by ID"""
        return self.templates.get(template_id)
    
    def add_template(self, template: NotificationTemplate):
        """Add or update a notification template"""
        self.templates[template.template_id] = template
        logger.info(f"Added notification template: {template.template_id}")
    
    def render_template(self, template_id: str, variables: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Render notification template with variables"""
        
        template = self.get_template(template_id)
        if not template:
            logger.error(f"Template not found: {template_id}")
            return None
        
        try:
            subject_tmpl = Template(template.subject_template)
            body_tmpl = Template(template.body_template)
            
            rendered_subject = subject_tmpl.render(**variables)
            rendered_body = body_tmpl.render(**variables)
            
            return {
                "subject": rendered_subject,
                "body": rendered_body
            }
            
        except Exception as e:
            logger.error(f"Error rendering template {template_id}: {e}")
            return None

# ==================== NOTIFICATION ROUTING ====================

class NotificationRouter:
    """Routes notifications based on user preferences and rules"""
    
    def __init__(self):
        self.user_preferences = {}  # user_id -> preferences
        self.routing_rules = []  # List of routing rule functions
        
    def set_user_preferences(self, user_id: str, preferences: Dict[str, Any]):
        """Set notification preferences for a user"""
        self.user_preferences[user_id] = preferences
        logger.info(f"Updated notification preferences for user {user_id}")
    
    def add_routing_rule(self, rule_func: Callable):
        """Add a notification routing rule"""
        self.routing_rules.append(rule_func)
    
    def route_notification(
        self, 
        notification_type: NotificationType,
        priority: NotificationPriority,
        recipients: List[NotificationRecipient],
        data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Route notification to appropriate channels for each recipient"""
        
        routing_decisions = []
        
        for recipient in recipients:
            # Get user preferences
            preferences = self.user_preferences.get(recipient.user_id, {})
            
            # Determine channels based on preferences and priority
            channels = self._determine_channels(
                notification_type, 
                priority, 
                recipient, 
                preferences
            )
            
            # Apply routing rules
            for rule in self.routing_rules:
                try:
                    channels = rule(notification_type, priority, recipient, channels, data)
                except Exception as e:
                    logger.error(f"Error applying routing rule: {e}")
            
            routing_decisions.append({
                "recipient": recipient,
                "channels": channels,
                "preferences_applied": preferences
            })
        
        return routing_decisions
    
    def _determine_channels(
        self,
        notification_type: NotificationType,
        priority: NotificationPriority,
        recipient: NotificationRecipient,
        preferences: Dict[str, Any]
    ) -> List[NotificationChannel]:
        """Determine notification channels for a recipient"""
        
        # Default channels based on priority
        if priority == NotificationPriority.CRITICAL or priority == NotificationPriority.URGENT:
            # Critical notifications go to all available channels
            channels = [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL]
            if recipient.phone:
                channels.append(NotificationChannel.SMS)
        elif priority == NotificationPriority.HIGH:
            channels = [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL]
        else:
            channels = [NotificationChannel.WEBSOCKET]
        
        # Apply user preferences
        disabled_channels = preferences.get("disabled_channels", [])
        channels = [ch for ch in channels if ch.value not in disabled_channels]
        
        # Apply type-specific preferences
        type_preferences = preferences.get("notification_types", {})
        type_config = type_preferences.get(notification_type.value, {})
        
        if type_config.get("enabled", True):
            preferred_channels = type_config.get("channels", [])
            if preferred_channels:
                # Use preferred channels if specified
                channels = [NotificationChannel(ch) for ch in preferred_channels if ch in [c.value for c in channels]]
        else:
            # Notification type is disabled
            channels = []
        
        return channels

# ==================== NOTIFICATION MANAGER ====================

class NotificationManager:
    """Main notification management system"""
    
    def __init__(self):
        self.template_manager = NotificationTemplateManager()
        self.router = NotificationRouter()
        self.channels = {
            NotificationChannel.WEBSOCKET: WebSocketNotificationChannel(),
            NotificationChannel.EMAIL: EmailNotificationChannel(),
            NotificationChannel.WEBHOOK: WebhookNotificationChannel()
        }
        
        # Notification queues and processing
        self.notification_queue = asyncio.Queue()
        self.delivery_results = deque(maxlen=10000)  # Store recent results
        self.metrics = defaultdict(int)
        
        # Rate limiting
        self.rate_limits = defaultdict(lambda: deque(maxlen=100))  # Per user rate limiting
        self.max_notifications_per_hour = 50
        
        # Background processing
        self.processing_task = None
        self.running = False
    
    async def start(self):
        """Start the notification manager"""
        if self.running:
            return
        
        self.running = True
        self.processing_task = asyncio.create_task(self._process_notifications())
        
        # Initialize routing rules
        self._initialize_routing_rules()
        
        logger.info("Notification manager started")
    
    async def stop(self):
        """Stop the notification manager"""
        self.running = False
        
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Notification manager stopped")
    
    def _initialize_routing_rules(self):
        """Initialize notification routing rules"""
        
        # Rule: Don't send low priority notifications during night hours
        def night_time_rule(notification_type, priority, recipient, channels, data):
            current_hour = datetime.utcnow().hour
            if (priority == NotificationPriority.LOW and 
                (current_hour >= 22 or current_hour <= 6)):  # 10 PM to 6 AM
                # Remove email and SMS for low priority notifications at night
                channels = [ch for ch in channels if ch not in [NotificationChannel.EMAIL, NotificationChannel.SMS]]
            return channels
        
        # Rule: Aggregate similar notifications
        def aggregation_rule(notification_type, priority, recipient, channels, data):
            # In a real system, you would check for recent similar notifications
            # and potentially aggregate them
            return channels
        
        self.router.add_routing_rule(night_time_rule)
        self.router.add_routing_rule(aggregation_rule)
    
    async def send_notification(
        self,
        notification_type: NotificationType,
        recipients: List[NotificationRecipient],
        template_id: str,
        variables: Dict[str, Any],
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        correlation_id: Optional[str] = None,
        scheduled_at: Optional[datetime] = None
    ) -> List[str]:
        """Send notification to recipients"""
        
        # Render template
        rendered = self.template_manager.render_template(template_id, variables)
        if not rendered:
            logger.error(f"Failed to render template {template_id}")
            return []
        
        # Route notifications
        routing_decisions = self.router.route_notification(
            notification_type, 
            priority, 
            recipients, 
            variables
        )
        
        message_ids = []
        
        for decision in routing_decisions:
            recipient = decision["recipient"]
            channels = decision["channels"]
            
            # Check rate limits
            if not self._check_rate_limit(recipient.user_id):
                logger.warning(f"Rate limit exceeded for user {recipient.user_id}")
                continue
            
            # Create notification messages for each channel
            for channel in channels:
                if channel not in self.channels or not self.channels[channel].is_available():
                    continue
                
                message = NotificationMessage(
                    message_id=f"notif_{int(datetime.utcnow().timestamp())}_{recipient.user_id}_{channel.value}",
                    notification_type=notification_type,
                    channel=channel,
                    recipient=recipient,
                    subject=rendered["subject"],
                    body=rendered["body"],
                    priority=priority,
                    created_at=datetime.utcnow(),
                    scheduled_at=scheduled_at,
                    data=variables,
                    correlation_id=correlation_id
                )
                
                # Add to processing queue
                await self.notification_queue.put(message)
                message_ids.append(message.message_id)
                
                self.metrics["notifications_queued"] += 1
        
        logger.info(f"Queued {len(message_ids)} notifications for {len(recipients)} recipients")
        return message_ids
    
    async def _process_notifications(self):
        """Background task to process notification queue"""
        
        while self.running:
            try:
                # Get notification message from queue
                try:
                    message = await asyncio.wait_for(
                        self.notification_queue.get(), 
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Check if scheduled for later
                if message.scheduled_at and message.scheduled_at > datetime.utcnow():
                    # Put back in queue for later
                    await self.notification_queue.put(message)
                    await asyncio.sleep(1)
                    continue
                
                # Send notification
                await self._send_single_notification(message)
                
            except Exception as e:
                logger.error(f"Error in notification processing: {e}")
                await asyncio.sleep(1)
    
    async def _send_single_notification(self, message: NotificationMessage):
        """Send a single notification message"""
        
        channel_handler = self.channels.get(message.channel)
        if not channel_handler:
            logger.error(f"No handler for channel {message.channel}")
            return
        
        try:
            # Send notification
            result = await channel_handler.send(message)
            
            # Store result
            self.delivery_results.append(result)
            
            # Update metrics
            if result.success:
                self.metrics[f"notifications_sent_{message.channel.value}"] += 1
                self.metrics["notifications_successful"] += 1
                logger.debug(f"Notification {message.message_id} sent successfully via {message.channel.value}")
            else:
                self.metrics[f"notifications_failed_{message.channel.value}"] += 1
                self.metrics["notifications_failed"] += 1
                
                # Retry if configured
                if message.retry_count < message.max_retries:
                    message.retry_count += 1
                    # Re-queue with delay
                    await asyncio.sleep(2 ** message.retry_count)  # Exponential backoff
                    await self.notification_queue.put(message)
                    self.metrics["notifications_retried"] += 1
                    logger.info(f"Retrying notification {message.message_id} (attempt {message.retry_count})")
                else:
                    logger.error(f"Notification {message.message_id} failed after {message.max_retries} retries")
            
        except Exception as e:
            logger.error(f"Error sending notification {message.message_id}: {e}")
            self.metrics["notifications_error"] += 1
    
    def _check_rate_limit(self, user_id: str) -> bool:
        """Check if user is within rate limits"""
        
        now = datetime.utcnow()
        user_notifications = self.rate_limits[user_id]
        
        # Remove old notifications (older than 1 hour)
        cutoff_time = now - timedelta(hours=1)
        while user_notifications and user_notifications[0] < cutoff_time:
            user_notifications.popleft()
        
        # Check if under limit
        if len(user_notifications) >= self.max_notifications_per_hour:
            return False
        
        # Add current notification
        user_notifications.append(now)
        return True
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get notification system metrics"""
        
        success_rate = 0.0
        total_sent = self.metrics.get("notifications_successful", 0) + self.metrics.get("notifications_failed", 0)
        if total_sent > 0:
            success_rate = self.metrics.get("notifications_successful", 0) / total_sent
        
        return {
            "running": self.running,
            "queue_size": self.notification_queue.qsize(),
            "total_sent": total_sent,
            "success_rate": success_rate,
            "recent_deliveries": len(self.delivery_results),
            "channels_available": {
                channel.value: handler.is_available() 
                for channel, handler in self.channels.items()
            },
            "detailed_metrics": dict(self.metrics)
        }

# ==================== STREAM EVENT HANDLERS ====================

class StreamNotificationHandler:
    """Handles stream events and generates notifications"""
    
    def __init__(self, notification_manager: NotificationManager):
        self.notification_manager = notification_manager
        self.user_subscriptions = defaultdict(set)  # user_id -> set of notification types
    
    async def handle_stream_event(self, message: StreamMessage):
        """Handle stream event and generate notifications"""
        
        try:
            # Determine notification type based on stream event
            notification_type = self._map_stream_event_to_notification(message.event_type, message.data)
            
            if not notification_type:
                return
            
            # Determine priority based on event data
            priority = self._determine_priority(message.data)
            
            # Get recipients based on event type and data
            recipients = await self._get_recipients(notification_type, message.data)
            
            if not recipients:
                return
            
            # Generate notification
            await self._generate_notification(
                notification_type=notification_type,
                priority=priority,
                recipients=recipients,
                event_data=message.data,
                correlation_id=message.correlation_id
            )
            
        except Exception as e:
            logger.error(f"Error handling stream event for notification: {e}")
    
    def _map_stream_event_to_notification(
        self, 
        event_type: EventType, 
        data: Dict[str, Any]
    ) -> Optional[NotificationType]:
        """Map stream event type to notification type"""
        
        if event_type == EventType.SENSOR_READING:
            # Check if it's an alert-worthy sensor reading
            if data.get("alert_level") in ["critical", "warning"]:
                return NotificationType.IOT_ALERT
        elif event_type == EventType.FRAUD_DETECTED:
            return NotificationType.FRAUD_ALERT
        elif event_type == EventType.ALERT:
            alert_type = data.get("alert_type", "")
            if "iot" in alert_type or "sensor" in alert_type:
                return NotificationType.IOT_ALERT
            elif "fraud" in alert_type:
                return NotificationType.FRAUD_ALERT
            else:
                return NotificationType.SYSTEM_ALERT
        
        return None
    
    def _determine_priority(self, data: Dict[str, Any]) -> NotificationPriority:
        """Determine notification priority from event data"""
        
        # Check for explicit priority
        if "priority" in data:
            try:
                return NotificationPriority(data["priority"])
            except ValueError:
                pass
        
        # Check for severity indicators
        if "severity" in data:
            severity = data["severity"].lower()
            if severity in ["critical", "emergency"]:
                return NotificationPriority.CRITICAL
            elif severity in ["high", "urgent"]:
                return NotificationPriority.HIGH
            elif severity in ["medium", "warning"]:
                return NotificationPriority.MEDIUM
            else:
                return NotificationPriority.LOW
        
        # Check for alert level
        if "alert_level" in data:
            alert_level = data["alert_level"].lower()
            if alert_level == "critical":
                return NotificationPriority.CRITICAL
            elif alert_level == "warning":
                return NotificationPriority.HIGH
            else:
                return NotificationPriority.MEDIUM
        
        return NotificationPriority.MEDIUM
    
    async def _get_recipients(
        self, 
        notification_type: NotificationType, 
        data: Dict[str, Any]
    ) -> List[NotificationRecipient]:
        """Get notification recipients based on type and data"""
        
        recipients = []
        
        # For now, we'll create mock recipients
        # In a real system, this would query user databases and subscription preferences
        
        if notification_type in [NotificationType.IOT_ALERT, NotificationType.SYSTEM_ALERT]:
            # Notify system administrators
            recipients.append(NotificationRecipient(
                user_id="admin_001",
                email="admin@schlep-engine.com",
                preferred_channels=[NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL]
            ))
        
        if notification_type == NotificationType.FRAUD_ALERT:
            # Notify fraud detection team
            recipients.append(NotificationRecipient(
                user_id="fraud_team",
                email="fraud@schlep-engine.com",
                preferred_channels=[NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.WEBHOOK]
            ))
        
        return recipients
    
    async def _generate_notification(
        self,
        notification_type: NotificationType,
        priority: NotificationPriority,
        recipients: List[NotificationRecipient],
        event_data: Dict[str, Any],
        correlation_id: Optional[str] = None
    ):
        """Generate and send notification"""
        
        # Determine template based on notification type and data
        template_id = self._get_template_id(notification_type, event_data)
        
        if not template_id:
            logger.warning(f"No template found for notification type {notification_type}")
            return
        
        # Send notification
        message_ids = await self.notification_manager.send_notification(
            notification_type=notification_type,
            recipients=recipients,
            template_id=template_id,
            variables=event_data,
            priority=priority,
            correlation_id=correlation_id
        )
        
        logger.info(f"Generated {len(message_ids)} notifications for {notification_type.value}")
    
    def _get_template_id(self, notification_type: NotificationType, data: Dict[str, Any]) -> Optional[str]:
        """Get template ID based on notification type and data"""
        
        if notification_type == NotificationType.IOT_ALERT:
            if data.get("alert_level") == "critical":
                return "iot_critical_alert"
        elif notification_type == NotificationType.FRAUD_ALERT:
            return "fraud_detection"
        elif notification_type == NotificationType.PIPELINE_STATUS:
            if "failed" in data.get("status", "").lower():
                return "pipeline_failed"
        
        return None

# ==================== GLOBAL NOTIFICATION SYSTEM ====================

# Global notification manager
notification_manager: Optional[NotificationManager] = None
stream_notification_handler: Optional[StreamNotificationHandler] = None

async def get_notification_manager() -> NotificationManager:
    """Get or create the global notification manager"""
    global notification_manager
    
    if notification_manager is None:
        notification_manager = NotificationManager()
        await notification_manager.start()
    
    return notification_manager

async def get_stream_notification_handler() -> StreamNotificationHandler:
    """Get or create the stream notification handler"""
    global stream_notification_handler
    
    if stream_notification_handler is None:
        manager = await get_notification_manager()
        stream_notification_handler = StreamNotificationHandler(manager)
    
    return stream_notification_handler

async def initialize_notification_system():
    """Initialize the notification system"""
    
    # Get notification manager (creates if needed)
    manager = await get_notification_manager()
    
    # Get stream handler (creates if needed) 
    handler = await get_stream_notification_handler()
    
    # Register webhook endpoints (example)
    webhook_channel = manager.channels.get(NotificationChannel.WEBHOOK)
    if webhook_channel:
        webhook_channel.register_webhook("fraud_system", "http://localhost:8080/webhooks/fraud")
        webhook_channel.register_webhook("monitoring_system", "http://localhost:8080/webhooks/monitoring")
    
    logger.info("Notification system initialized successfully")

async def shutdown_notification_system():
    """Shutdown the notification system"""
    global notification_manager
    
    if notification_manager:
        await notification_manager.stop()
        notification_manager = None
    
    logger.info("Notification system shutdown")