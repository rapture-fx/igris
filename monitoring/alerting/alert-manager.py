#!/usr/bin/env python3
"""
Schlep-engine Tiered Alert Manager
Intelligent alerting system with business impact analysis
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml

import aiohttp
import aioredis
from pydantic import BaseModel, Field
from prometheus_client.parser import text_string_to_metric_families


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AlertStatus(str, Enum):
    FIRING = "firing"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"
    ACKNOWLEDGED = "acknowledged"


@dataclass
class BusinessImpact:
    revenue_impact: float  # 0-1 scale
    customer_impact: float  # 0-1 scale
    sla_impact: float  # 0-1 scale
    reputation_impact: float  # 0-1 scale

    @property
    def overall_impact(self) -> float:
        """Calculate weighted overall business impact"""
        weights = {
            'revenue': 0.4,
            'customer': 0.3,
            'sla': 0.2,
            'reputation': 0.1
        }
        return (
            self.revenue_impact * weights['revenue'] +
            self.customer_impact * weights['customer'] +
            self.sla_impact * weights['sla'] +
            self.reputation_impact * weights['reputation']
        )


@dataclass
class Alert:
    id: str
    name: str
    severity: AlertSeverity
    status: AlertStatus
    service: str
    description: str
    labels: Dict[str, str]
    annotations: Dict[str, str]
    business_impact: BusinessImpact
    fired_at: datetime
    resolved_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    escalated_at: Optional[datetime] = None
    escalation_level: int = 0
    suppressed: bool = False
    notification_count: int = 0
    runbook_url: Optional[str] = None


class BusinessImpactCalculator:
    """Calculate business impact of alerts based on metrics and context"""

    def __init__(self):
        self.impact_rules = self._load_impact_rules()

    def _load_impact_rules(self) -> Dict[str, Any]:
        """Load business impact calculation rules"""
        return {
            "revenue_multipliers": {
                "api_down": 1.0,
                "payment_down": 1.0,
                "auth_down": 0.9,
                "ml_pipeline_down": 0.7,
                "performance_degraded": 0.3,
                "non_critical_feature": 0.1
            },
            "customer_impact_factors": {
                "complete_outage": 1.0,
                "login_issues": 0.8,
                "slow_performance": 0.4,
                "minor_issues": 0.2,
                "cosmetic_issues": 0.1
            },
            "sla_thresholds": {
                "99.9": {"breach_multiplier": 1.0},
                "99.5": {"breach_multiplier": 0.8},
                "99.0": {"breach_multiplier": 0.6}
            }
        }

    async def calculate_impact(
        self,
        alert: Dict[str, Any],
        metrics: Dict[str, float]
    ) -> BusinessImpact:
        """Calculate business impact for an alert"""

        # Revenue impact calculation
        revenue_impact = await self._calculate_revenue_impact(alert, metrics)

        # Customer impact calculation
        customer_impact = await self._calculate_customer_impact(alert, metrics)

        # SLA impact calculation
        sla_impact = await self._calculate_sla_impact(alert, metrics)

        # Reputation impact calculation
        reputation_impact = await self._calculate_reputation_impact(alert, metrics)

        return BusinessImpact(
            revenue_impact=revenue_impact,
            customer_impact=customer_impact,
            sla_impact=sla_impact,
            reputation_impact=reputation_impact
        )

    async def _calculate_revenue_impact(
        self,
        alert: Dict[str, Any],
        metrics: Dict[str, float]
    ) -> float:
        """Calculate revenue impact based on service criticality and metrics"""

        service = alert.get('labels', {}).get('service', 'unknown')
        alert_name = alert.get('alertname', '')

        # Base impact from service type
        service_impacts = {
            'api': 0.9,
            'payments': 1.0,
            'auth': 0.8,
            'ml-pipeline': 0.6,
            'frontend': 0.4,
            'docs': 0.1
        }

        base_impact = service_impacts.get(service, 0.3)

        # Adjust based on metrics
        error_rate = metrics.get('api_error_rate', 0)
        if error_rate > 0.5:  # 50% error rate
            base_impact *= 1.0
        elif error_rate > 0.2:  # 20% error rate
            base_impact *= 0.7
        elif error_rate > 0.05:  # 5% error rate
            base_impact *= 0.3

        # Time-based adjustments (business hours have higher impact)
        current_hour = datetime.utcnow().hour
        if 9 <= current_hour <= 17:  # Business hours UTC
            base_impact *= 1.2

        return min(base_impact, 1.0)

    async def _calculate_customer_impact(
        self,
        alert: Dict[str, Any],
        metrics: Dict[str, float]
    ) -> float:
        """Calculate customer impact based on user-facing services"""

        # Check if it's a user-facing service
        service = alert.get('labels', {}).get('service', 'unknown')
        user_facing_services = ['api', 'frontend', 'auth', 'payments']

        if service not in user_facing_services:
            return 0.2  # Low impact for internal services

        # Calculate based on active users affected
        active_users = metrics.get('active_users_count', 1000)
        total_users = metrics.get('total_users_count', 10000)

        # Estimate percentage of users affected
        error_rate = metrics.get('api_error_rate', 0)
        affected_percentage = min(error_rate * 2, 1.0)  # Rough estimation

        affected_users = active_users * affected_percentage
        impact_ratio = affected_users / total_users

        return min(impact_ratio * 2, 1.0)  # Scale up the impact

    async def _calculate_sla_impact(
        self,
        alert: Dict[str, Any],
        metrics: Dict[str, float]
    ) -> float:
        """Calculate SLA impact based on uptime requirements"""

        # Current month uptime
        current_uptime = metrics.get('monthly_uptime_percentage', 99.9)

        # SLA targets
        sla_target = 99.9  # 99.9% uptime SLA

        if current_uptime >= sla_target:
            return 0.1  # No SLA breach

        # Calculate severity of SLA breach
        breach_severity = (sla_target - current_uptime) / sla_target

        return min(breach_severity * 3, 1.0)  # Scale breach severity

    async def _calculate_reputation_impact(
        self,
        alert: Dict[str, Any],
        metrics: Dict[str, float]
    ) -> float:
        """Calculate reputation impact based on public visibility"""

        service = alert.get('labels', {}).get('service', 'unknown')
        alert_name = alert.get('alertname', '')

        # High reputation impact for security and data issues
        if 'security' in alert_name.lower():
            return 0.9

        if 'data_loss' in alert_name.lower():
            return 1.0

        # Medium impact for customer-facing services
        if service in ['api', 'frontend', 'auth']:
            return 0.6

        # Low impact for internal services
        return 0.2


class AlertManager:
    """Main alert management system with business impact analysis"""

    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.redis: Optional[aioredis.Redis] = None
        self.active_alerts: Dict[str, Alert] = {}
        self.suppressed_alerts: Set[str] = set()
        self.business_calculator = BusinessImpactCalculator()
        self.logger = self._setup_logging()

        # Notification handlers
        self.notification_handlers = {
            'slack': self._send_slack_notification,
            'email': self._send_email_notification,
            'pagerduty': self._send_pagerduty_notification,
            'sms': self._send_sms_notification
        }

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load alerting configuration from YAML file"""
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)

    def _setup_logging(self) -> logging.Logger:
        """Setup structured logging for alert manager"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger('alert_manager')

    async def initialize(self):
        """Initialize Redis connection and other resources"""
        self.redis = await aioredis.from_url("redis://localhost:6379")
        await self._load_existing_alerts()

    async def _load_existing_alerts(self):
        """Load existing alerts from Redis"""
        try:
            alert_keys = await self.redis.keys("alert:*")
            for key in alert_keys:
                alert_data = await self.redis.get(key)
                if alert_data:
                    alert_dict = json.loads(alert_data)
                    alert = self._dict_to_alert(alert_dict)
                    self.active_alerts[alert.id] = alert

            self.logger.info(f"Loaded {len(self.active_alerts)} existing alerts")
        except Exception as e:
            self.logger.error(f"Failed to load existing alerts: {e}")

    async def process_prometheus_alerts(self, alerts_data: List[Dict[str, Any]]):
        """Process incoming alerts from Prometheus"""
        for alert_data in alerts_data:
            try:
                await self._process_single_alert(alert_data)
            except Exception as e:
                self.logger.error(f"Failed to process alert: {e}")

    async def _process_single_alert(self, alert_data: Dict[str, Any]):
        """Process a single alert with business impact analysis"""

        alert_id = self._generate_alert_id(alert_data)

        # Check if alert is suppressed
        if await self._is_alert_suppressed(alert_data):
            self.logger.info(f"Alert {alert_id} is suppressed")
            return

        # Get current metrics for business impact calculation
        metrics = await self._get_current_metrics()

        # Calculate business impact
        business_impact = await self.business_calculator.calculate_impact(
            alert_data, metrics
        )

        # Determine if this is a new alert or status change
        existing_alert = self.active_alerts.get(alert_id)

        if alert_data['status'] == 'firing':
            if existing_alert:
                # Update existing alert
                await self._update_existing_alert(existing_alert, alert_data, business_impact)
            else:
                # Create new alert
                await self._create_new_alert(alert_data, business_impact, metrics)

        elif alert_data['status'] == 'resolved':
            if existing_alert:
                await self._resolve_alert(existing_alert)

    async def _create_new_alert(
        self,
        alert_data: Dict[str, Any],
        business_impact: BusinessImpact,
        metrics: Dict[str, float]
    ):
        """Create a new alert with business impact analysis"""

        alert_id = self._generate_alert_id(alert_data)

        # Determine severity based on business impact
        calculated_severity = self._calculate_severity_from_impact(business_impact)
        original_severity = AlertSeverity(alert_data.get('labels', {}).get('severity', 'medium'))

        # Use the higher of calculated vs original severity
        final_severity = max(calculated_severity, original_severity, key=lambda x: self._severity_weight(x))

        alert = Alert(
            id=alert_id,
            name=alert_data.get('alertname', 'Unknown Alert'),
            severity=final_severity,
            status=AlertStatus.FIRING,
            service=alert_data.get('labels', {}).get('service', 'unknown'),
            description=alert_data.get('annotations', {}).get('description', ''),
            labels=alert_data.get('labels', {}),
            annotations=alert_data.get('annotations', {}),
            business_impact=business_impact,
            fired_at=datetime.utcnow(),
            runbook_url=alert_data.get('annotations', {}).get('runbook')
        )

        self.active_alerts[alert_id] = alert

        # Save to Redis
        await self._save_alert_to_redis(alert)

        # Send notifications
        await self._send_alert_notifications(alert)

        # Start escalation timer if needed
        await self._schedule_escalation(alert)

        self.logger.info(
            f"Created new alert: {alert.name} "
            f"(severity={alert.severity}, business_impact={business_impact.overall_impact:.2f})"
        )

    def _calculate_severity_from_impact(self, business_impact: BusinessImpact) -> AlertSeverity:
        """Calculate alert severity based on business impact"""
        overall_impact = business_impact.overall_impact

        if overall_impact >= 0.8:
            return AlertSeverity.CRITICAL
        elif overall_impact >= 0.6:
            return AlertSeverity.HIGH
        elif overall_impact >= 0.3:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW

    def _severity_weight(self, severity: AlertSeverity) -> int:
        """Get numeric weight for severity comparison"""
        weights = {
            AlertSeverity.LOW: 1,
            AlertSeverity.MEDIUM: 2,
            AlertSeverity.HIGH: 3,
            AlertSeverity.CRITICAL: 4
        }
        return weights[severity]

    async def _send_alert_notifications(self, alert: Alert):
        """Send notifications based on alert severity and business impact"""

        severity_config = self.config['severity_levels'][alert.severity.value]
        channels = severity_config['notification_channels']

        # Check business hours for non-critical alerts
        if not severity_config.get('business_hours_only', False) or self._is_business_hours():

            for channel in channels:
                try:
                    channel_config = self.config['notification_channels'][channel]
                    handler = self.notification_handlers.get(channel_config['type'])

                    if handler:
                        await handler(alert, channel_config)
                        alert.notification_count += 1

                except Exception as e:
                    self.logger.error(f"Failed to send notification via {channel}: {e}")

    async def _send_slack_notification(self, alert: Alert, config: Dict[str, Any]):
        """Send Slack notification"""
        webhook_url = config['webhook_url']

        # Create rich Slack message
        color_map = {
            AlertSeverity.CRITICAL: "#FF0000",
            AlertSeverity.HIGH: "#FFA500",
            AlertSeverity.MEDIUM: "#FFFF00",
            AlertSeverity.LOW: "#00FF00"
        }

        business_impact = alert.business_impact

        message = {
            "text": f"🚨 {alert.severity.value.upper()} Alert: {alert.name}",
            "attachments": [
                {
                    "color": color_map[alert.severity],
                    "fields": [
                        {
                            "title": "Service",
                            "value": alert.service,
                            "short": True
                        },
                        {
                            "title": "Business Impact",
                            "value": f"{business_impact.overall_impact:.1%}",
                            "short": True
                        },
                        {
                            "title": "Description",
                            "value": alert.description,
                            "short": False
                        },
                        {
                            "title": "Impact Breakdown",
                            "value": (
                                f"💰 Revenue: {business_impact.revenue_impact:.1%}\n"
                                f"👥 Customer: {business_impact.customer_impact:.1%}\n"
                                f"📊 SLA: {business_impact.sla_impact:.1%}\n"
                                f"🏢 Reputation: {business_impact.reputation_impact:.1%}"
                            ),
                            "short": True
                        }
                    ],
                    "actions": [
                        {
                            "type": "button",
                            "text": "View Runbook",
                            "url": alert.runbook_url
                        } if alert.runbook_url else None,
                        {
                            "type": "button",
                            "text": "Acknowledge",
                            "url": f"https://alerts.schlep-engine.com/ack/{alert.id}"
                        }
                    ],
                    "footer": "Schlep-engine Alert Manager",
                    "ts": int(alert.fired_at.timestamp())
                }
            ]
        }

        # Add mentions for critical alerts
        if alert.severity == AlertSeverity.CRITICAL:
            mentions = config.get('mention_users', [])
            if mentions:
                message['text'] = f"{' '.join(mentions)} {message['text']}"

        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=message) as response:
                if response.status != 200:
                    raise Exception(f"Slack webhook failed: {response.status}")

    async def _send_email_notification(self, alert: Alert, config: Dict[str, Any]):
        """Send email notification"""
        # Email implementation would go here
        # This is a placeholder for the email sending logic
        self.logger.info(f"Would send email notification for alert {alert.id}")

    async def _send_pagerduty_notification(self, alert: Alert, config: Dict[str, Any]):
        """Send PagerDuty notification"""
        # PagerDuty implementation would go here
        self.logger.info(f"Would send PagerDuty notification for alert {alert.id}")

    async def _send_sms_notification(self, alert: Alert, config: Dict[str, Any]):
        """Send SMS notification"""
        # SMS implementation would go here
        self.logger.info(f"Would send SMS notification for alert {alert.id}")

    async def _schedule_escalation(self, alert: Alert):
        """Schedule alert escalation if configured"""
        severity_config = self.config['severity_levels'][alert.severity.value]

        if severity_config.get('auto_escalate', False):
            escalation_time = self._parse_time_duration(severity_config['escalation_time'])

            # Schedule escalation task
            asyncio.create_task(self._escalate_alert_after_delay(alert, escalation_time))

    async def _escalate_alert_after_delay(self, alert: Alert, delay_seconds: int):
        """Escalate alert after specified delay"""
        await asyncio.sleep(delay_seconds)

        # Check if alert is still active and not acknowledged
        current_alert = self.active_alerts.get(alert.id)
        if current_alert and current_alert.status == AlertStatus.FIRING and not current_alert.acknowledged_at:
            await self._escalate_alert(current_alert)

    async def _escalate_alert(self, alert: Alert):
        """Escalate alert to next level"""
        alert.escalation_level += 1
        alert.escalated_at = datetime.utcnow()

        # Find escalation policy
        escalation_policy = None
        for policy_name, policy in self.config['escalation_policies'].items():
            if alert.severity.value in policy['applies_to']:
                escalation_policy = policy
                break

        if escalation_policy and alert.escalation_level < len(escalation_policy['levels']):
            level_config = escalation_policy['levels'][alert.escalation_level - 1]

            # Send escalated notifications
            await self._send_escalated_notifications(alert, level_config)

            # Schedule next escalation
            if alert.escalation_level < len(escalation_policy['levels']):
                next_timeout = self._parse_time_duration(level_config['timeout'])
                asyncio.create_task(self._escalate_alert_after_delay(alert, next_timeout))

        await self._save_alert_to_redis(alert)

        self.logger.warning(
            f"Escalated alert {alert.name} to level {alert.escalation_level}"
        )

    async def _send_escalated_notifications(self, alert: Alert, level_config: Dict[str, Any]):
        """Send escalated notifications to specified contacts"""
        contact_groups = level_config['notify']

        for group_name in contact_groups:
            group_config = self.config['contact_groups'][group_name]

            for member in group_config['members']:
                # Send notification to each member
                # Implementation would depend on member type
                self.logger.info(f"Escalating to {member['type']}: {group_name}")

    def _parse_time_duration(self, duration_str: str) -> int:
        """Parse time duration string to seconds"""
        if duration_str.endswith('m'):
            return int(duration_str[:-1]) * 60
        elif duration_str.endswith('h'):
            return int(duration_str[:-1]) * 3600
        elif duration_str.endswith('s'):
            return int(duration_str[:-1])
        else:
            return int(duration_str)  # Assume seconds

    def _is_business_hours(self) -> bool:
        """Check if current time is within business hours"""
        now = datetime.utcnow()
        business_hours = self.config['business_hours']

        # Check if it's a weekday
        weekday_name = now.strftime('%A').lower()
        if weekday_name not in business_hours['weekdays']:
            return False

        # Check if it's a holiday
        date_str = now.strftime('%Y-%m-%d')
        if date_str in business_hours.get('holidays', []):
            return False

        # Check time range
        day_config = business_hours['weekdays'][weekday_name]
        start_time = datetime.strptime(day_config['start'], '%H:%M').time()
        end_time = datetime.strptime(day_config['end'], '%H:%M').time()

        return start_time <= now.time() <= end_time

    async def _get_current_metrics(self) -> Dict[str, float]:
        """Get current system metrics for business impact calculation"""
        metrics = {}

        try:
            # This would integrate with your metrics system (Prometheus, etc.)
            # For now, return dummy values
            metrics = {
                'api_error_rate': 0.02,  # 2% error rate
                'api_response_time_p95': 500,  # 500ms
                'active_users_count': 1000,
                'total_users_count': 10000,
                'monthly_uptime_percentage': 99.95
            }
        except Exception as e:
            self.logger.error(f"Failed to get metrics: {e}")

        return metrics

    async def _is_alert_suppressed(self, alert_data: Dict[str, Any]) -> bool:
        """Check if alert should be suppressed based on rules"""

        # Check maintenance windows
        suppression_rules = self.config.get('suppression_rules', {})

        # Check maintenance window suppression
        maintenance = suppression_rules.get('maintenance_window', {})
        if maintenance.get('suppress_all', False):
            # Check if we're in a maintenance window
            # Implementation would check against scheduled maintenance
            pass

        # Check critical incident suppression
        critical_suppression = suppression_rules.get('critical_incident_suppression', {})
        if len([a for a in self.active_alerts.values() if a.severity == AlertSeverity.CRITICAL]) > 0:
            severity = alert_data.get('labels', {}).get('severity', 'medium')
            if severity in critical_suppression.get('suppress_severities', []):
                return True

        return False

    def _generate_alert_id(self, alert_data: Dict[str, Any]) -> str:
        """Generate unique alert ID"""
        alertname = alert_data.get('alertname', 'unknown')
        labels = alert_data.get('labels', {})

        # Create ID from alert name and key labels
        key_labels = ['service', 'instance', 'job']
        label_parts = []

        for label in key_labels:
            if label in labels:
                label_parts.append(f"{label}={labels[label]}")

        if label_parts:
            return f"{alertname}_{':'.join(label_parts)}"
        else:
            return alertname

    def _dict_to_alert(self, alert_dict: Dict[str, Any]) -> Alert:
        """Convert dictionary to Alert object"""
        # This would properly deserialize the alert
        # Placeholder implementation
        pass

    async def _save_alert_to_redis(self, alert: Alert):
        """Save alert to Redis for persistence"""
        alert_dict = asdict(alert)
        # Convert datetime objects to ISO format
        for key, value in alert_dict.items():
            if isinstance(value, datetime):
                alert_dict[key] = value.isoformat() if value else None

        await self.redis.set(
            f"alert:{alert.id}",
            json.dumps(alert_dict, default=str),
            ex=86400 * 7  # Expire after 7 days
        )

    async def _resolve_alert(self, alert: Alert):
        """Resolve an existing alert"""
        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = datetime.utcnow()

        # Remove from active alerts
        if alert.id in self.active_alerts:
            del self.active_alerts[alert.id]

        # Update in Redis
        await self._save_alert_to_redis(alert)

        # Send resolution notification
        await self._send_resolution_notification(alert)

        self.logger.info(f"Resolved alert: {alert.name}")

    async def _send_resolution_notification(self, alert: Alert):
        """Send notification that alert has been resolved"""
        # Implementation for resolution notifications
        pass

    async def acknowledge_alert(self, alert_id: str, acknowledger: str):
        """Acknowledge an alert"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_at = datetime.utcnow()

            await self._save_alert_to_redis(alert)

            self.logger.info(f"Alert {alert.name} acknowledged by {acknowledger}")


async def main():
    """Main function to run the alert manager"""

    # Load configuration
    config_path = Path(__file__).parent / "alert-config.yml"

    # Initialize alert manager
    alert_manager = AlertManager(str(config_path))
    await alert_manager.initialize()

    # Example: Process some alerts
    sample_alerts = [
        {
            "alertname": "APIHighErrorRate",
            "status": "firing",
            "labels": {
                "service": "api",
                "severity": "high",
                "instance": "api-server-1"
            },
            "annotations": {
                "description": "API error rate is above 20%",
                "runbook": "https://docs.schlep-engine.com/runbooks/api-errors"
            }
        }
    ]

    await alert_manager.process_prometheus_alerts(sample_alerts)

    # Keep running
    while True:
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())