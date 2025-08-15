"""
Security monitoring system for Schlep Engine
Tracks authentication failures, rate limiting, and security events
"""

import time
import logging
from typing import Dict, Any, Optional, List, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import ipaddress
from collections import defaultdict, deque
import asyncio

from app.core.logging_config import get_logger, log_security_event
from app.core.metrics import record_security_event
from app.core.sentry_integration import capture_exception, add_breadcrumb
from app.core.config import settings

logger = get_logger("app.security_monitoring")

class SecurityEventType(str, Enum):
    """Types of security events"""
    AUTH_FAILURE = "authentication_failure"
    BRUTE_FORCE = "brute_force_attack"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    SQL_INJECTION = "sql_injection_attempt"
    XSS_ATTEMPT = "xss_attempt"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DATA_EXFILTRATION = "data_exfiltration"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    ACCOUNT_TAKEOVER = "account_takeover"
    API_ABUSE = "api_abuse"
    MALICIOUS_PAYLOAD = "malicious_payload"

class SecurityEventSeverity(str, Enum):
    """Severity levels for security events"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_type: SecurityEventType
    severity: SecurityEventSeverity
    timestamp: datetime
    source_ip: str
    user_agent: Optional[str] = None
    user_id: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None
    session_id: Optional[str] = None

@dataclass
class ThreatIntelligence:
    """Threat intelligence data"""
    known_malicious_ips: Set[str] = field(default_factory=set)
    suspicious_user_agents: Set[str] = field(default_factory=set)
    blacklisted_countries: Set[str] = field(default_factory=set)
    known_attack_patterns: List[str] = field(default_factory=list)
    tor_exit_nodes: Set[str] = field(default_factory=set)

class SecurityMetrics:
    """Security metrics tracker"""
    
    def __init__(self):
        self.auth_failures = defaultdict(int)
        self.rate_limit_hits = defaultdict(int)
        self.blocked_ips = set()
        self.suspicious_activities = defaultdict(list)
        self.attack_attempts = defaultdict(int)
        self.last_reset = time.time()
    
    def reset_metrics(self):
        """Reset metrics (called periodically)"""
        current_time = time.time()
        if current_time - self.last_reset > 3600:  # Reset every hour
            self.auth_failures.clear()
            self.rate_limit_hits.clear()
            self.attack_attempts.clear()
            # Keep blocked IPs and suspicious activities for longer
            self.last_reset = current_time

class SecurityMonitor:
    """Comprehensive security monitoring system"""
    
    def __init__(self):
        self.threat_intel = ThreatIntelligence()
        self.metrics = SecurityMetrics()
        self.event_history = deque(maxlen=10000)  # Keep last 10k events
        self.blocked_ips = set()
        self.rate_limiters = defaultdict(lambda: deque(maxlen=100))
        
        # Configuration
        self.max_auth_failures = getattr(settings, 'MAX_LOGIN_ATTEMPTS', 5)
        self.lockout_duration = getattr(settings, 'LOCKOUT_DURATION_MINUTES', 15) * 60
        self.rate_limit_window = 300  # 5 minutes
        self.rate_limit_threshold = 100  # requests per window
        
        # Initialize threat intelligence
        self._initialize_threat_intelligence()
        
        # Start background tasks
        asyncio.create_task(self._periodic_cleanup())
    
    def _initialize_threat_intelligence(self):
        """Initialize threat intelligence data"""
        # Known malicious IPs (example data)
        self.threat_intel.known_malicious_ips.update([
            "192.168.1.100",  # Example malicious IP
            "10.0.0.50"       # Another example
        ])
        
        # Suspicious user agents
        self.threat_intel.suspicious_user_agents.update([
            "sqlmap", "nikto", "nmap", "masscan", "zap", "burp",
            "python-requests", "curl", "wget"  # Often used in automated attacks
        ])
        
        # Known attack patterns
        self.threat_intel.known_attack_patterns.extend([
            "union select", "drop table", "insert into", "delete from",
            "<script", "javascript:", "onload=", "onerror=",
            "../", "..\\", "/etc/passwd", "/etc/shadow",
            "cmd.exe", "powershell", "bash", "/bin/sh"
        ])
    
    async def record_security_event(
        self,
        event_type: SecurityEventType,
        severity: SecurityEventSeverity,
        source_ip: str,
        details: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        user_agent: Optional[str] = None,
        correlation_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> SecurityEvent:
        """Record a security event"""
        
        event = SecurityEvent(
            event_type=event_type,
            severity=severity,
            timestamp=datetime.utcnow(),
            source_ip=source_ip,
            user_agent=user_agent,
            user_id=user_id,
            endpoint=endpoint,
            method=method,
            details=details or {},
            correlation_id=correlation_id,
            session_id=session_id
        )
        
        # Add to event history
        self.event_history.append(event)
        
        # Log the event
        log_security_event(
            event_type=event_type.value,
            details={
                "severity": severity.value,
                "source_ip": source_ip,
                "endpoint": endpoint,
                "method": method,
                "user_agent": user_agent,
                "details": details or {}
            },
            user_id=user_id,
            ip_address=source_ip
        )
        
        # Record metrics
        record_security_event(
            event_type=event_type.value,
            severity=severity.value,
            source=source_ip
        )
        
        # Add Sentry breadcrumb
        add_breadcrumb(
            message=f"Security event: {event_type.value}",
            category="security",
            data={
                "event_type": event_type.value,
                "severity": severity.value,
                "source_ip": source_ip,
                "endpoint": endpoint,
                "user_id": user_id
            }
        )
        
        # Analyze and respond to the event
        await self._analyze_and_respond(event)
        
        return event
    
    async def _analyze_and_respond(self, event: SecurityEvent):
        """Analyze security event and take appropriate action"""
        
        # Check for brute force attacks
        if event.event_type == SecurityEventType.AUTH_FAILURE:
            await self._check_brute_force(event)
        
        # Check for rate limiting violations
        await self._check_rate_limiting(event)
        
        # Check against threat intelligence
        await self._check_threat_intelligence(event)
        
        # Check for suspicious patterns
        await self._check_suspicious_patterns(event)
        
        # Auto-block if necessary
        await self._auto_block_if_necessary(event)
    
    async def _check_brute_force(self, event: SecurityEvent):
        """Check for brute force authentication attacks"""
        ip = event.source_ip
        self.metrics.auth_failures[ip] += 1
        
        if self.metrics.auth_failures[ip] >= self.max_auth_failures:
            # Potential brute force attack
            await self.record_security_event(
                event_type=SecurityEventType.BRUTE_FORCE,
                severity=SecurityEventSeverity.HIGH,
                source_ip=ip,
                details={
                    "failure_count": self.metrics.auth_failures[ip],
                    "threshold": self.max_auth_failures,
                    "action": "ip_blocked"
                },
                user_id=event.user_id,
                correlation_id=event.correlation_id
            )
            
            # Block the IP
            self.blocked_ips.add(ip)
            
            # Capture as high-severity security incident
            capture_exception(
                Exception(f"Brute force attack detected from {ip}"),
                level="error",
                tags={"security_event": "brute_force", "source_ip": ip}
            )
    
    async def _check_rate_limiting(self, event: SecurityEvent):
        """Check for rate limiting violations"""
        ip = event.source_ip
        current_time = time.time()
        
        # Add current request to rate limiter
        self.rate_limiters[ip].append(current_time)
        
        # Count requests in the last window
        window_start = current_time - self.rate_limit_window
        recent_requests = sum(1 for req_time in self.rate_limiters[ip] if req_time > window_start)
        
        if recent_requests > self.rate_limit_threshold:
            await self.record_security_event(
                event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
                severity=SecurityEventSeverity.MEDIUM,
                source_ip=ip,
                details={
                    "request_count": recent_requests,
                    "threshold": self.rate_limit_threshold,
                    "window_seconds": self.rate_limit_window
                },
                endpoint=event.endpoint,
                correlation_id=event.correlation_id
            )
    
    async def _check_threat_intelligence(self, event: SecurityEvent):
        """Check event against threat intelligence"""
        ip = event.source_ip
        user_agent = event.user_agent or ""
        
        # Check if IP is known to be malicious
        if ip in self.threat_intel.known_malicious_ips:
            await self.record_security_event(
                event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity=SecurityEventSeverity.CRITICAL,
                source_ip=ip,
                details={
                    "reason": "known_malicious_ip",
                    "threat_intel_match": True
                },
                user_agent=user_agent,
                correlation_id=event.correlation_id
            )
        
        # Check user agent
        if any(pattern in user_agent.lower() for pattern in self.threat_intel.suspicious_user_agents):
            await self.record_security_event(
                event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity=SecurityEventSeverity.HIGH,
                source_ip=ip,
                details={
                    "reason": "suspicious_user_agent",
                    "user_agent": user_agent
                },
                correlation_id=event.correlation_id
            )
    
    async def _check_suspicious_patterns(self, event: SecurityEvent):
        """Check for suspicious patterns in request data"""
        details = event.details
        endpoint = event.endpoint or ""
        
        # Check for SQL injection patterns
        for pattern in self.threat_intel.known_attack_patterns:
            if pattern in endpoint.lower() or any(pattern in str(v).lower() for v in details.values()):
                if "union select" in pattern or "drop table" in pattern:
                    event_type = SecurityEventType.SQL_INJECTION
                elif "<script" in pattern or "javascript:" in pattern:
                    event_type = SecurityEventType.XSS_ATTEMPT
                else:
                    event_type = SecurityEventType.MALICIOUS_PAYLOAD
                
                await self.record_security_event(
                    event_type=event_type,
                    severity=SecurityEventSeverity.HIGH,
                    source_ip=event.source_ip,
                    details={
                        "pattern_matched": pattern,
                        "original_event": event.event_type.value
                    },
                    endpoint=endpoint,
                    correlation_id=event.correlation_id
                )
                break
    
    async def _auto_block_if_necessary(self, event: SecurityEvent):
        """Automatically block IPs based on security events"""
        ip = event.source_ip
        
        # Auto-block for critical events
        if event.severity == SecurityEventSeverity.CRITICAL:
            self.blocked_ips.add(ip)
            logger.warning(f"Auto-blocked IP {ip} due to critical security event: {event.event_type.value}")
        
        # Auto-block for multiple high-severity events
        high_severity_events = sum(
            1 for e in self.event_history 
            if e.source_ip == ip and e.severity in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
            and (datetime.utcnow() - e.timestamp).total_seconds() < 3600  # Last hour
        )
        
        if high_severity_events >= 3:
            self.blocked_ips.add(ip)
            logger.warning(f"Auto-blocked IP {ip} due to multiple high-severity events: {high_severity_events}")
    
    def is_ip_blocked(self, ip: str) -> bool:
        """Check if an IP is blocked"""
        return ip in self.blocked_ips
    
    def unblock_ip(self, ip: str) -> bool:
        """Unblock an IP address"""
        if ip in self.blocked_ips:
            self.blocked_ips.remove(ip)
            logger.info(f"Unblocked IP: {ip}")
            return True
        return False
    
    def get_security_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get security summary for the last N hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        recent_events = [e for e in self.event_history if e.timestamp > cutoff_time]
        
        # Count events by type and severity
        event_counts = defaultdict(int)
        severity_counts = defaultdict(int)
        top_ips = defaultdict(int)
        
        for event in recent_events:
            event_counts[event.event_type.value] += 1
            severity_counts[event.severity.value] += 1
            top_ips[event.source_ip] += 1
        
        return {
            "time_period_hours": hours,
            "total_events": len(recent_events),
            "events_by_type": dict(event_counts),
            "events_by_severity": dict(severity_counts),
            "top_source_ips": dict(sorted(top_ips.items(), key=lambda x: x[1], reverse=True)[:10]),
            "blocked_ips_count": len(self.blocked_ips),
            "blocked_ips": list(self.blocked_ips),
            "auth_failures_by_ip": dict(self.metrics.auth_failures),
            "rate_limit_violations": dict(self.metrics.rate_limit_hits)
        }
    
    async def _periodic_cleanup(self):
        """Periodic cleanup of old data and blocked IPs"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                
                # Reset metrics
                self.metrics.reset_metrics()
                
                # Clean up old blocked IPs (unblock after lockout duration)
                current_time = time.time()
                ips_to_unblock = []
                
                for ip in self.blocked_ips:
                    # In a real implementation, you'd track when each IP was blocked
                    # For now, we'll periodically unblock IPs
                    if len(self.blocked_ips) > 100:  # Keep list manageable
                        ips_to_unblock.append(ip)
                
                for ip in ips_to_unblock[:10]:  # Unblock oldest 10
                    self.unblock_ip(ip)
                
                # Clean up rate limiter data
                window_start = current_time - self.rate_limit_window
                for ip in list(self.rate_limiters.keys()):
                    self.rate_limiters[ip] = deque(
                        [t for t in self.rate_limiters[ip] if t > window_start],
                        maxlen=100
                    )
                    if not self.rate_limiters[ip]:
                        del self.rate_limiters[ip]
                
                logger.info("Security monitoring periodic cleanup completed")
                
            except Exception as e:
                logger.error(f"Error in security monitoring cleanup: {str(e)}")
                capture_exception(e, level="error")

# Global security monitor instance
security_monitor = SecurityMonitor()

# Convenience functions
async def record_auth_failure(
    source_ip: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    **kwargs
) -> SecurityEvent:
    """Record authentication failure"""
    return await security_monitor.record_security_event(
        event_type=SecurityEventType.AUTH_FAILURE,
        severity=SecurityEventSeverity.MEDIUM,
        source_ip=source_ip,
        user_id=user_id,
        details=details,
        **kwargs
    )

async def record_rate_limit_exceeded(
    source_ip: str,
    endpoint: str,
    details: Optional[Dict[str, Any]] = None,
    **kwargs
) -> SecurityEvent:
    """Record rate limit exceeded"""
    return await security_monitor.record_security_event(
        event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity=SecurityEventSeverity.MEDIUM,
        source_ip=source_ip,
        endpoint=endpoint,
        details=details,
        **kwargs
    )

async def record_suspicious_activity(
    source_ip: str,
    severity: SecurityEventSeverity,
    details: Dict[str, Any],
    **kwargs
) -> SecurityEvent:
    """Record suspicious activity"""
    return await security_monitor.record_security_event(
        event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity=severity,
        source_ip=source_ip,
        details=details,
        **kwargs
    )

def is_ip_blocked(ip: str) -> bool:
    """Check if IP is blocked"""
    return security_monitor.is_ip_blocked(ip)

def get_security_summary(hours: int = 24) -> Dict[str, Any]:
    """Get security summary"""
    return security_monitor.get_security_summary(hours)