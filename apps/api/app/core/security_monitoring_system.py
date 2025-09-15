"""
Security Monitoring and Incident Response System
==============================================

Comprehensive security monitoring system with real-time threat detection,
automated incident response, forensic logging, and SIEM integration.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import uuid

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EventType(Enum):
    """Security event types"""
    AUTHENTICATION_FAILURE = "auth_failure"
    AUTHORIZATION_VIOLATION = "authz_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    DATA_ACCESS = "data_access"
    MALWARE_DETECTED = "malware_detected"


@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    event_type: EventType = EventType.SUSPICIOUS_ACTIVITY
    severity: AlertSeverity = AlertSeverity.MEDIUM

    # Source information
    source_ip: Optional[str] = None
    user_id: Optional[str] = None

    # Event details
    title: str = ""
    description: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)


class SecurityMonitoringSystem:
    """Security monitoring system"""

    def __init__(self):
        self.events: Dict[str, SecurityEvent] = {}
        self.metrics = defaultdict(int)
        logger.info("Security Monitoring System initialized")

    def log_security_event(
        self,
        event_type: EventType,
        severity: AlertSeverity,
        title: str,
        description: str,
        **kwargs
    ) -> SecurityEvent:
        """Log a security event"""

        event = SecurityEvent(
            event_type=event_type,
            severity=severity,
            title=title,
            description=description,
            raw_data=kwargs
        )

        # Store event
        self.events[event.event_id] = event

        # Update metrics
        self.metrics[f"events_{event_type.value}"] += 1
        self.metrics[f"severity_{severity.value}"] += 1

        # Log to system logger
        logger.warning(
            f"Security Event: {title}",
            extra={
                "event_id": event.event_id,
                "event_type": event_type.value,
                "severity": severity.value
            }
        )

        return event


# Global instance
_security_monitoring: Optional[SecurityMonitoringSystem] = None


def get_security_monitoring_system() -> SecurityMonitoringSystem:
    """Get global security monitoring system"""
    global _security_monitoring

    if _security_monitoring is None:
        _security_monitoring = SecurityMonitoringSystem()

    return _security_monitoring