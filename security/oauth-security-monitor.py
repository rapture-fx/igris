#!/usr/bin/env python3
"""
OAuth Security Monitoring System for Schlep Engine
Real-time monitoring and alerting for OAuth security events
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict
from enum import Enum
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aioredis
import aiohttp
from collections import defaultdict, deque

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SecurityEventType(Enum):
    """OAuth security event types"""
    FAILED_AUTHENTICATION = "oauth.auth.failed"
    SUSPICIOUS_STATE = "oauth.state.suspicious"
    INVALID_PKCE = "oauth.pkce.invalid"
    RATE_LIMIT_EXCEEDED = "oauth.rate_limit.exceeded"
    INVALID_REDIRECT_URI = "oauth.redirect.invalid"
    TOKEN_VALIDATION_FAILED = "oauth.token.validation_failed"
    REPEATED_FAILURES = "oauth.repeated_failures"
    UNUSUAL_ACTIVITY = "oauth.unusual_activity"
    CSRF_ATTACK_DETECTED = "oauth.csrf.attack_detected"
    BRUTE_FORCE_DETECTED = "oauth.brute_force.detected"


class SecuritySeverity(Enum):
    """Security event severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecurityEvent:
    """OAuth security event data structure"""
    event_type: SecurityEventType
    severity: SecuritySeverity
    timestamp: datetime
    provider: str
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Dict[str, Any] = None
    metadata: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['event_type'] = self.event_type.value
        data['severity'] = self.severity.value
        data['timestamp'] = self.timestamp.isoformat()
        return data


@dataclass
class SecurityAlert:
    """Security alert configuration"""
    alert_id: str
    name: str
    description: str
    event_types: List[SecurityEventType]
    severity_threshold: SecuritySeverity
    time_window_minutes: int
    event_threshold: int
    enabled: bool = True


class OAuthSecurityMonitor:
    """Real-time OAuth security monitoring system"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379", 
                 alert_email: str = None,
                 smtp_config: Dict[str, Any] = None):
        self.redis_url = redis_url
        self.redis = None
        self.alert_email = alert_email
        self.smtp_config = smtp_config or {}
        
        # Event storage
        self.recent_events = deque(maxlen=10000)  # Keep last 10k events in memory
        self.event_counts = defaultdict(lambda: defaultdict(int))
        self.blocked_ips = set()
        self.suspicious_users = set()
        
        # Alert configuration
        self.security_alerts = self._initialize_security_alerts()
        self.active_incidents = {}
        
        # Monitoring statistics
        self.stats = {
            'total_events': 0,
            'events_by_type': defaultdict(int),
            'events_by_severity': defaultdict(int),
            'alerts_sent': 0,
            'incidents_created': 0
        }
    
    async def initialize(self):
        """Initialize the monitoring system"""
        try:
            self.redis = await aioredis.from_url(self.redis_url)
            logger.info("OAuth security monitor initialized")
            
            # Load historical data
            await self._load_historical_data()
            
        except Exception as e:
            logger.error(f"Failed to initialize OAuth security monitor: {e}")
            raise
    
    async def close(self):
        """Close connections and cleanup"""
        if self.redis:
            await self.redis.close()
    
    def _initialize_security_alerts(self) -> Dict[str, SecurityAlert]:
        """Initialize security alert configurations"""
        alerts = {
            "repeated_failures": SecurityAlert(
                alert_id="repeated_failures",
                name="Repeated OAuth Failures",
                description="Multiple OAuth authentication failures from same IP/user",
                event_types=[SecurityEventType.FAILED_AUTHENTICATION],
                severity_threshold=SecuritySeverity.MEDIUM,
                time_window_minutes=15,
                event_threshold=5
            ),
            "csrf_attacks": SecurityAlert(
                alert_id="csrf_attacks",
                name="CSRF Attack Detection",
                description="Potential CSRF attacks on OAuth endpoints",
                event_types=[SecurityEventType.CSRF_ATTACK_DETECTED, SecurityEventType.SUSPICIOUS_STATE],
                severity_threshold=SecuritySeverity.HIGH,
                time_window_minutes=5,
                event_threshold=3
            ),
            "brute_force": SecurityAlert(
                alert_id="brute_force",
                name="OAuth Brute Force Attack",
                description="Brute force attack detected on OAuth endpoints",
                event_types=[SecurityEventType.BRUTE_FORCE_DETECTED, SecurityEventType.RATE_LIMIT_EXCEEDED],
                severity_threshold=SecuritySeverity.CRITICAL,
                time_window_minutes=10,
                event_threshold=10
            ),
            "token_security": SecurityAlert(
                alert_id="token_security",
                name="OAuth Token Security Issues",
                description="Issues with OAuth token validation or PKCE",
                event_types=[SecurityEventType.TOKEN_VALIDATION_FAILED, SecurityEventType.INVALID_PKCE],
                severity_threshold=SecuritySeverity.HIGH,
                time_window_minutes=5,
                event_threshold=3
            ),
            "unusual_activity": SecurityAlert(
                alert_id="unusual_activity",
                name="Unusual OAuth Activity",
                description="Unusual patterns in OAuth authentication",
                event_types=[SecurityEventType.UNUSUAL_ACTIVITY, SecurityEventType.INVALID_REDIRECT_URI],
                severity_threshold=SecuritySeverity.MEDIUM,
                time_window_minutes=30,
                event_threshold=5
            )
        }
        return alerts
    
    async def record_security_event(self, event: SecurityEvent):
        """Record a security event for monitoring"""
        try:
            # Add to recent events
            self.recent_events.append(event)
            
            # Update statistics
            self.stats['total_events'] += 1
            self.stats['events_by_type'][event.event_type.value] += 1
            self.stats['events_by_severity'][event.severity.value] += 1
            
            # Store in Redis for persistence
            await self._store_event_in_redis(event)
            
            # Check for security alerts
            await self._check_security_alerts(event)
            
            # Update threat intelligence
            await self._update_threat_intelligence(event)
            
            logger.info(f"Security event recorded: {event.event_type.value} ({event.severity.value})")
            
        except Exception as e:
            logger.error(f"Failed to record security event: {e}")
    
    async def _store_event_in_redis(self, event: SecurityEvent):
        """Store security event in Redis"""
        try:
            if self.redis:
                # Store individual event
                event_key = f"oauth:security:event:{int(time.time() * 1000)}"
                await self.redis.setex(
                    event_key,
                    timedelta(days=30).total_seconds(),  # Keep for 30 days
                    json.dumps(event.to_dict())
                )
                
                # Update counters
                counter_key = f"oauth:security:counter:{event.event_type.value}:{datetime.now().strftime('%Y-%m-%d-%H')}"
                await self.redis.incr(counter_key)
                await self.redis.expire(counter_key, timedelta(days=7).total_seconds())
                
        except Exception as e:
            logger.error(f"Failed to store event in Redis: {e}")
    
    async def _check_security_alerts(self, event: SecurityEvent):
        """Check if event triggers any security alerts"""
        current_time = datetime.now()
        
        for alert_id, alert in self.security_alerts.items():
            if not alert.enabled:
                continue
            
            # Check if event type matches alert
            if event.event_type not in alert.event_types:
                continue
            
            # Check severity threshold
            severity_levels = {
                SecuritySeverity.LOW: 1,
                SecuritySeverity.MEDIUM: 2,
                SecuritySeverity.HIGH: 3,
                SecuritySeverity.CRITICAL: 4
            }
            
            if severity_levels[event.severity] < severity_levels[alert.severity_threshold]:
                continue
            
            # Count events in time window
            time_window_start = current_time - timedelta(minutes=alert.time_window_minutes)
            matching_events = [
                e for e in self.recent_events
                if (e.event_type in alert.event_types and 
                    e.timestamp >= time_window_start and
                    self._events_match_context(e, event))
            ]
            
            if len(matching_events) >= alert.event_threshold:
                await self._trigger_security_alert(alert, matching_events)
    
    def _events_match_context(self, event1: SecurityEvent, event2: SecurityEvent) -> bool:
        """Check if two events match in context (same IP, user, etc.)"""
        # Same IP address
        if event1.ip_address and event2.ip_address and event1.ip_address == event2.ip_address:
            return True
        
        # Same user
        if event1.user_id and event2.user_id and event1.user_id == event2.user_id:
            return True
        
        # Same provider
        if event1.provider == event2.provider:
            return True
        
        return False
    
    async def _trigger_security_alert(self, alert: SecurityAlert, events: List[SecurityEvent]):
        """Trigger a security alert"""
        try:
            incident_id = f"{alert.alert_id}_{int(time.time())}"
            
            # Check if similar incident is already active
            if self._is_similar_incident_active(alert, events):
                return
            
            incident = {
                'incident_id': incident_id,
                'alert': alert,
                'events': events,
                'triggered_at': datetime.now(),
                'status': 'active'
            }
            
            self.active_incidents[incident_id] = incident
            self.stats['incidents_created'] += 1
            
            logger.warning(f"Security alert triggered: {alert.name} (Incident: {incident_id})")
            
            # Send notifications
            await self._send_security_alert(incident)
            
            # Take automated actions
            await self._take_automated_actions(incident)
            
        except Exception as e:
            logger.error(f"Failed to trigger security alert: {e}")
    
    def _is_similar_incident_active(self, alert: SecurityAlert, events: List[SecurityEvent]) -> bool:
        """Check if a similar incident is already active"""
        for incident in self.active_incidents.values():
            if (incident['alert'].alert_id == alert.alert_id and 
                incident['status'] == 'active'):
                
                # Check if incidents involve same context
                incident_ips = {e.ip_address for e in incident['events'] if e.ip_address}
                current_ips = {e.ip_address for e in events if e.ip_address}
                
                if incident_ips & current_ips:  # Common IPs
                    return True
        
        return False
    
    async def _send_security_alert(self, incident: Dict[str, Any]):
        """Send security alert notifications"""
        try:
            alert = incident['alert']
            events = incident['events']
            
            # Prepare alert message
            message = self._format_security_alert_message(incident)
            
            # Send email alert
            if self.alert_email and self.smtp_config:
                await self._send_email_alert(alert.name, message)
                self.stats['alerts_sent'] += 1
            
            # Send webhook alert (if configured)
            await self._send_webhook_alert(incident)
            
            logger.info(f"Security alert sent for incident: {incident['incident_id']}")
            
        except Exception as e:
            logger.error(f"Failed to send security alert: {e}")
    
    def _format_security_alert_message(self, incident: Dict[str, Any]) -> str:
        """Format security alert message"""
        alert = incident['alert']
        events = incident['events']
        
        message = f"""
🚨 OAuth Security Alert: {alert.name}

Incident ID: {incident['incident_id']}
Triggered: {incident['triggered_at'].strftime('%Y-%m-%d %H:%M:%S UTC')}
Description: {alert.description}

Event Summary:
- Event Count: {len(events)}
- Time Window: {alert.time_window_minutes} minutes
- Severity Threshold: {alert.severity_threshold.value}

Affected Resources:
"""
        
        # Group events by context
        ip_addresses = set()
        providers = set()
        users = set()
        
        for event in events:
            if event.ip_address:
                ip_addresses.add(event.ip_address)
            if event.provider:
                providers.add(event.provider)
            if event.user_id:
                users.add(event.user_id)
        
        if ip_addresses:
            message += f"- IP Addresses: {', '.join(ip_addresses)}\n"
        if providers:
            message += f"- OAuth Providers: {', '.join(providers)}\n"
        if users:
            message += f"- Affected Users: {len(users)} users\n"
        
        message += f"\nRecent Events:\n"
        for i, event in enumerate(events[-5:], 1):  # Show last 5 events
            message += f"{i}. {event.timestamp.strftime('%H:%M:%S')} - {event.event_type.value} ({event.severity.value})\n"
            if event.details:
                details_str = ', '.join([f"{k}: {v}" for k, v in event.details.items()][:3])
                message += f"   Details: {details_str}\n"
        
        message += f"\nRecommended Actions:\n"
        message += self._get_recommended_actions(alert, events)
        
        return message
    
    def _get_recommended_actions(self, alert: SecurityAlert, events: List[SecurityEvent]) -> str:
        """Get recommended actions based on alert type"""
        if alert.alert_id == "repeated_failures":
            return """- Review failed authentication logs
- Check for credential stuffing attacks
- Consider temporary IP blocking
- Verify OAuth provider configurations"""
        
        elif alert.alert_id == "csrf_attacks":
            return """- URGENT: Review CSRF protection implementation
- Check state parameter validation
- Verify OAuth redirect URIs
- Monitor for additional suspicious activity"""
        
        elif alert.alert_id == "brute_force":
            return """- CRITICAL: Implement immediate IP blocking
- Review rate limiting configuration
- Contact OAuth providers about suspicious activity
- Consider temporarily disabling OAuth for affected providers"""
        
        elif alert.alert_id == "token_security":
            return """- Review OAuth token validation logic
- Check PKCE implementation
- Verify token encryption and storage
- Audit OAuth service security"""
        
        elif alert.alert_id == "unusual_activity":
            return """- Investigate unusual patterns
- Review OAuth configuration changes
- Check for compromised credentials
- Monitor for escalation"""
        
        return "- Investigate the security incident\n- Review logs and take appropriate action"
    
    async def _send_email_alert(self, subject: str, message: str):
        """Send email security alert"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.smtp_config.get('from_email', 'security@yourdomain.com')
            msg['To'] = self.alert_email
            msg['Subject'] = f"[SECURITY ALERT] {subject}"
            
            msg.attach(MIMEText(message, 'plain'))
            
            # Send email
            server = smtplib.SMTP(self.smtp_config['host'], self.smtp_config['port'])
            if self.smtp_config.get('tls'):
                server.starttls()
            if self.smtp_config.get('username') and self.smtp_config.get('password'):
                server.login(self.smtp_config['username'], self.smtp_config['password'])
            
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Security alert email sent to {self.alert_email}")
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
    
    async def _send_webhook_alert(self, incident: Dict[str, Any]):
        """Send webhook security alert"""
        webhook_url = self.smtp_config.get('webhook_url')
        if not webhook_url:
            return
        
        try:
            payload = {
                'incident_id': incident['incident_id'],
                'alert_name': incident['alert'].name,
                'severity': incident['alert'].severity_threshold.value,
                'triggered_at': incident['triggered_at'].isoformat(),
                'event_count': len(incident['events']),
                'message': self._format_security_alert_message(incident)
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as response:
                    if response.status == 200:
                        logger.info("Security alert webhook sent successfully")
                    else:
                        logger.error(f"Webhook alert failed with status: {response.status}")
                        
        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
    
    async def _take_automated_actions(self, incident: Dict[str, Any]):
        """Take automated security actions"""
        try:
            alert = incident['alert']
            events = incident['events']
            
            if alert.alert_id == "brute_force":
                # Temporarily block suspicious IPs
                for event in events:
                    if event.ip_address:
                        await self._block_ip_temporarily(event.ip_address, minutes=60)
            
            elif alert.alert_id == "csrf_attacks":
                # Increase monitoring sensitivity
                await self._increase_monitoring_sensitivity(provider=events[0].provider)
            
            elif alert.alert_id == "repeated_failures":
                # Add to suspicious users list
                for event in events:
                    if event.user_id:
                        self.suspicious_users.add(event.user_id)
            
        except Exception as e:
            logger.error(f"Failed to take automated actions: {e}")
    
    async def _block_ip_temporarily(self, ip_address: str, minutes: int = 60):
        """Temporarily block an IP address"""
        try:
            if self.redis:
                block_key = f"oauth:blocked_ip:{ip_address}"
                await self.redis.setex(block_key, minutes * 60, "blocked")
                self.blocked_ips.add(ip_address)
                logger.warning(f"IP {ip_address} temporarily blocked for {minutes} minutes")
                
        except Exception as e:
            logger.error(f"Failed to block IP {ip_address}: {e}")
    
    async def _increase_monitoring_sensitivity(self, provider: str):
        """Increase monitoring sensitivity for a provider"""
        try:
            if self.redis:
                sensitivity_key = f"oauth:high_sensitivity:{provider}"
                await self.redis.setex(sensitivity_key, 3600, "enabled")  # 1 hour
                logger.info(f"Increased monitoring sensitivity for {provider}")
                
        except Exception as e:
            logger.error(f"Failed to increase monitoring sensitivity: {e}")
    
    async def _update_threat_intelligence(self, event: SecurityEvent):
        """Update threat intelligence based on security events"""
        try:
            # Track suspicious patterns
            if event.ip_address:
                key = f"oauth:ip_events:{event.ip_address}"
                await self.redis.lpush(key, json.dumps(event.to_dict()))
                await self.redis.ltrim(key, 0, 99)  # Keep last 100 events
                await self.redis.expire(key, timedelta(days=7).total_seconds())
            
            # Update provider-specific intelligence
            if event.provider:
                provider_key = f"oauth:provider_events:{event.provider}"
                await self.redis.incr(provider_key)
                await self.redis.expire(provider_key, timedelta(days=1).total_seconds())
                
        except Exception as e:
            logger.error(f"Failed to update threat intelligence: {e}")
    
    async def _load_historical_data(self):
        """Load historical security data from Redis"""
        try:
            if not self.redis:
                return
            
            # Load recent blocked IPs
            blocked_ip_keys = await self.redis.keys("oauth:blocked_ip:*")
            for key in blocked_ip_keys:
                ip = key.decode().split(":")[-1]
                self.blocked_ips.add(ip)
            
            logger.info(f"Loaded {len(self.blocked_ips)} blocked IPs from historical data")
            
        except Exception as e:
            logger.error(f"Failed to load historical data: {e}")
    
    async def get_security_dashboard_data(self) -> Dict[str, Any]:
        """Get security dashboard data"""
        current_time = datetime.now()
        
        # Recent events summary (last 24 hours)
        day_ago = current_time - timedelta(days=1)
        recent_events = [e for e in self.recent_events if e.timestamp >= day_ago]
        
        # Event distribution
        event_distribution = defaultdict(int)
        severity_distribution = defaultdict(int)
        
        for event in recent_events:
            event_distribution[event.event_type.value] += 1
            severity_distribution[event.severity.value] += 1
        
        # Active incidents
        active_incidents = [
            {
                'incident_id': inc['incident_id'],
                'alert_name': inc['alert'].name,
                'triggered_at': inc['triggered_at'].isoformat(),
                'event_count': len(inc['events']),
                'status': inc['status']
            }
            for inc in self.active_incidents.values()
            if inc['status'] == 'active'
        ]
        
        return {
            'timestamp': current_time.isoformat(),
            'stats': {
                'total_events_24h': len(recent_events),
                'active_incidents': len(active_incidents),
                'blocked_ips': len(self.blocked_ips),
                'suspicious_users': len(self.suspicious_users),
                'alerts_sent': self.stats['alerts_sent']
            },
            'event_distribution': dict(event_distribution),
            'severity_distribution': dict(severity_distribution),
            'active_incidents': active_incidents,
            'recent_events': [
                {
                    'timestamp': event.timestamp.isoformat(),
                    'type': event.event_type.value,
                    'severity': event.severity.value,
                    'provider': event.provider,
                    'ip_address': event.ip_address
                }
                for event in list(self.recent_events)[-20:]  # Last 20 events
            ]
        }
    
    async def create_security_event_from_log(self, log_entry: Dict[str, Any]) -> Optional[SecurityEvent]:
        """Create security event from log entry"""
        try:
            # Extract event information from log
            event_type_mapping = {
                'oauth.auth.failed': SecurityEventType.FAILED_AUTHENTICATION,
                'oauth.state.invalid': SecurityEventType.SUSPICIOUS_STATE,
                'oauth.pkce.validation_failed': SecurityEventType.INVALID_PKCE,
                'oauth.rate_limit.exceeded': SecurityEventType.RATE_LIMIT_EXCEEDED,
                'oauth.redirect.invalid': SecurityEventType.INVALID_REDIRECT_URI,
                'oauth.token.invalid': SecurityEventType.TOKEN_VALIDATION_FAILED
            }
            
            event_type_str = log_entry.get('event_type', '')
            event_type = event_type_mapping.get(event_type_str)
            
            if not event_type:
                return None
            
            # Determine severity based on event type and context
            severity = self._determine_event_severity(event_type, log_entry)
            
            event = SecurityEvent(
                event_type=event_type,
                severity=severity,
                timestamp=datetime.fromisoformat(log_entry.get('timestamp', datetime.now().isoformat())),
                provider=log_entry.get('provider', 'unknown'),
                user_id=log_entry.get('user_id'),
                ip_address=log_entry.get('ip_address'),
                user_agent=log_entry.get('user_agent'),
                details=log_entry.get('details', {}),
                metadata=log_entry.get('metadata', {})
            )
            
            return event
            
        except Exception as e:
            logger.error(f"Failed to create security event from log: {e}")
            return None
    
    def _determine_event_severity(self, event_type: SecurityEventType, log_entry: Dict[str, Any]) -> SecuritySeverity:
        """Determine event severity based on type and context"""
        
        # High severity events
        if event_type in [SecurityEventType.CSRF_ATTACK_DETECTED, 
                         SecurityEventType.BRUTE_FORCE_DETECTED]:
            return SecuritySeverity.CRITICAL
        
        if event_type in [SecurityEventType.TOKEN_VALIDATION_FAILED,
                         SecurityEventType.INVALID_PKCE]:
            return SecuritySeverity.HIGH
        
        # Check for repeated failures from same source
        ip_address = log_entry.get('ip_address')
        if ip_address and ip_address in self.blocked_ips:
            return SecuritySeverity.HIGH
        
        # Medium severity by default for security events
        if event_type in [SecurityEventType.FAILED_AUTHENTICATION,
                         SecurityEventType.SUSPICIOUS_STATE]:
            return SecuritySeverity.MEDIUM
        
        return SecuritySeverity.LOW


# Usage example and testing
async def main():
    """Example usage of OAuth Security Monitor"""
    
    # Initialize monitor
    monitor = OAuthSecurityMonitor(
        redis_url="redis://localhost:6379",
        alert_email="security@yourdomain.com",
        smtp_config={
            'host': 'smtp.gmail.com',
            'port': 587,
            'tls': True,
            'username': 'your-email@gmail.com',
            'password': 'your-app-password',
            'from_email': 'security@yourdomain.com'
        }
    )
    
    await monitor.initialize()
    
    try:
        # Simulate some security events
        events = [
            SecurityEvent(
                event_type=SecurityEventType.FAILED_AUTHENTICATION,
                severity=SecuritySeverity.MEDIUM,
                timestamp=datetime.now(),
                provider="google",
                ip_address="192.168.1.100",
                user_agent="Mozilla/5.0...",
                details={"reason": "invalid_state", "attempts": 1}
            ),
            SecurityEvent(
                event_type=SecurityEventType.FAILED_AUTHENTICATION,
                severity=SecuritySeverity.MEDIUM,
                timestamp=datetime.now(),
                provider="google",
                ip_address="192.168.1.100",
                user_agent="Mozilla/5.0...",
                details={"reason": "invalid_code", "attempts": 2}
            )
        ]
        
        # Record events
        for event in events:
            await monitor.record_security_event(event)
        
        # Get dashboard data
        dashboard_data = await monitor.get_security_dashboard_data()
        print("Security Dashboard Data:")
        print(json.dumps(dashboard_data, indent=2))
        
        # Keep monitoring for a short time
        await asyncio.sleep(2)
        
    finally:
        await monitor.close()


if __name__ == "__main__":
    asyncio.run(main())