"""
Security Event Monitoring and Alerting System
=============================================

Real-time security event detection, analysis, and automated response system.
Integrates with SIEM solutions and provides automated threat detection.
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import re
from collections import defaultdict, deque
import redis.asyncio as redis

from app.core.config import settings
from app.middleware.audit_middleware import AuditEvent, AuditEventType, AuditSeverity

logger = logging.getLogger(__name__)

class ThreatLevel(Enum):
    """Threat severity levels"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AttackType(Enum):
    """Types of detected attacks"""
    BRUTE_FORCE = "brute_force"
    SQL_INJECTION = "sql_injection"
    XSS_ATTEMPT = "xss_attempt"
    CSRF_ATTACK = "csrf_attack"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DATA_EXFILTRATION = "data_exfiltration"
    ANOMALOUS_ACCESS = "anomalous_access"
    MALICIOUS_FILE_UPLOAD = "malicious_file_upload"
    DENIAL_OF_SERVICE = "denial_of_service"
    SUSPICIOUS_API_USAGE = "suspicious_api_usage"

@dataclass
class SecurityThreat:
    """Security threat detection result"""
    threat_id: str
    threat_type: AttackType
    threat_level: ThreatLevel
    source_ip: str
    user_id: Optional[str]
    detection_time: datetime
    description: str
    evidence: Dict[str, Any]
    confidence_score: float  # 0.0 to 1.0
    recommended_actions: List[str]
    affected_resources: List[str]

@dataclass
class SecurityMetrics:
    """Security metrics for monitoring dashboard"""
    total_threats_detected: int
    threats_by_level: Dict[str, int]
    threats_by_type: Dict[str, int]
    blocked_ips: int
    failed_authentications: int
    successful_authentications: int
    suspicious_file_uploads: int
    anomalous_api_calls: int
    time_window: str

class SecurityEventDetector:
    """Real-time security event detection engine"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.detection_rules = self._load_detection_rules()
        self.threat_patterns = self._load_threat_patterns()
        self.baseline_metrics = {}
        self.blocked_ips = set()
        self.rate_limiters = defaultdict(lambda: deque(maxlen=100))
        
    def _load_detection_rules(self) -> Dict[str, Dict[str, Any]]:
        """Load security detection rules"""
        return {
            "brute_force": {
                "failed_attempts_threshold": 5,
                "time_window_minutes": 15,
                "lockout_duration_minutes": 30,
                "confidence_threshold": 0.8
            },
            "sql_injection": {
                "pattern_matches_threshold": 1,
                "suspicious_keywords": [
                    "union select", "drop table", "insert into", "delete from",
                    "update set", "exec(", "xp_cmdshell", "sp_executesql"
                ],
                "confidence_threshold": 0.9
            },
            "xss_attempt": {
                "pattern_matches_threshold": 1,
                "suspicious_patterns": [
                    r"<script[^>]*>.*?</script>",
                    r"javascript:",
                    r"on\w+\s*=",
                    r"eval\s*\(",
                    r"document\.cookie"
                ],
                "confidence_threshold": 0.85
            },
            "anomalous_access": {
                "unusual_time_threshold": 0.1,  # Probability threshold
                "unusual_location_threshold": 0.05,
                "access_pattern_deviation": 2.0,  # Standard deviations
                "confidence_threshold": 0.7
            },
            "data_exfiltration": {
                "large_response_threshold": 10 * 1024 * 1024,  # 10MB
                "bulk_requests_threshold": 50,
                "time_window_minutes": 10,
                "confidence_threshold": 0.75
            }
        }
    
    def _load_threat_patterns(self) -> Dict[str, List[str]]:
        """Load threat detection patterns"""
        return {
            "malicious_user_agents": [
                r"sqlmap", r"nikto", r"burpsuite", r"nmap", r"masscan",
                r"dirb", r"gobuster", r"wfuzz", r"hydra", r"medusa"
            ],
            "suspicious_file_extensions": [
                ".php", ".asp", ".jsp", ".exe", ".bat", ".cmd", ".sh",
                ".ps1", ".vbs", ".scr", ".com", ".pif"
            ],
            "sql_injection_patterns": [
                r"(\b(union|select|insert|update|delete|drop|create|alter|exec)\b)",
                r"([\'\"][^\'\"]*[\'\"])",
                r"(\-\-|\#|\/\*)",
                r"(\bor\b|\band\b).*[\=\<\>]"
            ],
            "xss_patterns": [
                r"<script[^>]*>.*?</script>",
                r"javascript:",
                r"vbscript:",
                r"on\w+\s*=",
                r"alert\s*\(",
                r"document\.(cookie|domain|referrer)"
            ]
        }
    
    async def analyze_audit_event(self, audit_event: AuditEvent) -> Optional[SecurityThreat]:
        """Analyze audit event for security threats"""
        threats = []
        
        # Check for brute force attacks
        brute_force_threat = await self._detect_brute_force(audit_event)
        if brute_force_threat:
            threats.append(brute_force_threat)
        
        # Check for injection attacks
        injection_threat = await self._detect_injection_attacks(audit_event)
        if injection_threat:
            threats.append(injection_threat)
        
        # Check for XSS attempts
        xss_threat = await self._detect_xss_attempts(audit_event)
        if xss_threat:
            threats.append(xss_threat)
        
        # Check for anomalous access patterns
        anomaly_threat = await self._detect_access_anomalies(audit_event)
        if anomaly_threat:
            threats.append(anomaly_threat)
        
        # Check for data exfiltration
        exfiltration_threat = await self._detect_data_exfiltration(audit_event)
        if exfiltration_threat:
            threats.append(exfiltration_threat)
        
        # Check for malicious file uploads
        file_threat = await self._detect_malicious_files(audit_event)
        if file_threat:
            threats.append(file_threat)
        
        # Return highest priority threat
        if threats:
            return max(threats, key=lambda t: (t.threat_level.value, t.confidence_score))
        
        return None
    
    async def _detect_brute_force(self, event: AuditEvent) -> Optional[SecurityThreat]:
        """Detect brute force authentication attacks"""
        if not (event.path and "auth" in event.path.lower() and event.status_code >= 400):
            return None
        
        rule = self.detection_rules["brute_force"]
        key = f"auth_failures:{event.ip_address}"
        
        # Track failed attempts
        current_time = datetime.utcnow()
        window_start = current_time - timedelta(minutes=rule["time_window_minutes"])
        
        # Get recent failures
        failures = await self.redis.zrangebyscore(
            key, 
            window_start.timestamp(), 
            current_time.timestamp()
        )
        
        # Add current failure
        await self.redis.zadd(key, {str(current_time.timestamp()): current_time.timestamp()})
        await self.redis.expire(key, rule["time_window_minutes"] * 60)
        
        failure_count = len(failures) + 1
        
        if failure_count >= rule["failed_attempts_threshold"]:
            confidence = min(1.0, failure_count / (rule["failed_attempts_threshold"] * 2))
            
            return SecurityThreat(
                threat_id=f"bf_{hashlib.md5(f'{event.ip_address}_{current_time}'.encode()).hexdigest()[:8]}",
                threat_type=AttackType.BRUTE_FORCE,
                threat_level=ThreatLevel.HIGH if failure_count > 10 else ThreatLevel.MEDIUM,
                source_ip=event.ip_address,
                user_id=event.user_id,
                detection_time=current_time,
                description=f"Brute force attack detected: {failure_count} failed attempts from {event.ip_address}",
                evidence={
                    "failed_attempts": failure_count,
                    "time_window": rule["time_window_minutes"],
                    "target_endpoint": event.path,
                    "user_agent": event.request_headers.get("user-agent") if event.request_headers else None
                },
                confidence_score=confidence,
                recommended_actions=[
                    f"Block IP {event.ip_address} for {rule['lockout_duration_minutes']} minutes",
                    "Review authentication logs",
                    "Consider implementing CAPTCHA",
                    "Alert security team"
                ],
                affected_resources=[event.path or "authentication_system"]
            )
        
        return None
    
    async def _detect_injection_attacks(self, event: AuditEvent) -> Optional[SecurityThreat]:
        """Detect SQL injection and other injection attacks"""
        if not event.request_body_hash:
            return None
        
        # Get request data (would need to be stored separately for analysis)
        # For now, check URL parameters and common injection patterns
        
        suspicious_content = []
        if event.path:
            suspicious_content.append(event.path)
        
        if event.request_headers:
            for header_value in event.request_headers.values():
                suspicious_content.append(str(header_value))
        
        rule = self.detection_rules["sql_injection"]
        matches = 0
        matched_patterns = []
        
        for content in suspicious_content:
            for keyword in rule["suspicious_keywords"]:
                if keyword.lower() in content.lower():
                    matches += 1
                    matched_patterns.append(keyword)
            
            for pattern in self.threat_patterns["sql_injection_patterns"]:
                if re.search(pattern, content, re.IGNORECASE):
                    matches += 1
                    matched_patterns.append(pattern)
        
        if matches >= rule["pattern_matches_threshold"]:
            confidence = min(1.0, matches / len(rule["suspicious_keywords"]))
            
            return SecurityThreat(
                threat_id=f"sqli_{hashlib.md5(f'{event.ip_address}_{event.event_id}'.encode()).hexdigest()[:8]}",
                threat_type=AttackType.SQL_INJECTION,
                threat_level=ThreatLevel.CRITICAL,
                source_ip=event.ip_address,
                user_id=event.user_id,
                detection_time=event.timestamp,
                description=f"SQL injection attempt detected from {event.ip_address}",
                evidence={
                    "matched_patterns": matched_patterns,
                    "pattern_count": matches,
                    "target_endpoint": event.path,
                    "request_method": event.method
                },
                confidence_score=confidence,
                recommended_actions=[
                    f"Immediately block IP {event.ip_address}",
                    "Review and sanitize input validation",
                    "Check database logs for successful injections",
                    "Alert security team immediately",
                    "Consider WAF rules update"
                ],
                affected_resources=[event.path or "database_system"]
            )
        
        return None
    
    async def _detect_xss_attempts(self, event: AuditEvent) -> Optional[SecurityThreat]:
        """Detect Cross-Site Scripting (XSS) attempts"""
        if not event.request_body_hash:
            return None
        
        suspicious_content = []
        if event.path:
            suspicious_content.append(event.path)
        
        if event.request_headers:
            for header_value in event.request_headers.values():
                suspicious_content.append(str(header_value))
        
        rule = self.detection_rules["xss_attempt"]
        matches = 0
        matched_patterns = []
        
        for content in suspicious_content:
            for pattern in self.threat_patterns["xss_patterns"]:
                if re.search(pattern, content, re.IGNORECASE):
                    matches += 1
                    matched_patterns.append(pattern)
        
        if matches >= rule["pattern_matches_threshold"]:
            confidence = min(1.0, matches / len(self.threat_patterns["xss_patterns"]))
            
            return SecurityThreat(
                threat_id=f"xss_{hashlib.md5(f'{event.ip_address}_{event.event_id}'.encode()).hexdigest()[:8]}",
                threat_type=AttackType.XSS_ATTEMPT,
                threat_level=ThreatLevel.HIGH,
                source_ip=event.ip_address,
                user_id=event.user_id,
                detection_time=event.timestamp,
                description=f"XSS attempt detected from {event.ip_address}",
                evidence={
                    "matched_patterns": matched_patterns,
                    "pattern_count": matches,
                    "target_endpoint": event.path,
                    "request_method": event.method
                },
                confidence_score=confidence,
                recommended_actions=[
                    f"Block IP {event.ip_address}",
                    "Review input sanitization",
                    "Check for stored XSS vulnerabilities",
                    "Update Content Security Policy",
                    "Alert development team"
                ],
                affected_resources=[event.path or "web_application"]
            )
        
        return None
    
    async def _detect_access_anomalies(self, event: AuditEvent) -> Optional[SecurityThreat]:
        """Detect anomalous access patterns using behavioral analysis"""
        if not event.user_id:
            return None
        
        # Get user's historical access patterns
        user_key = f"user_patterns:{event.user_id}"
        patterns = await self.redis.hgetall(user_key)
        
        anomaly_score = 0.0
        anomalies = []
        
        # Check access time anomaly
        current_hour = event.timestamp.hour
        hour_key = f"hour_{current_hour}"
        historical_hour_access = int(patterns.get(hour_key, 0))
        total_access = sum(int(patterns.get(f"hour_{h}", 0)) for h in range(24))
        
        if total_access > 10:  # Only analyze if we have enough data
            hour_probability = historical_hour_access / total_access
            if hour_probability < 0.1:  # Less than 10% of usual access
                anomaly_score += 0.3
                anomalies.append(f"Unusual access time: {current_hour}:00")
        
        # Check endpoint access pattern
        if event.path:
            endpoint_key = f"endpoint_{hashlib.md5(event.path.encode()).hexdigest()[:8]}"
            endpoint_access = int(patterns.get(endpoint_key, 0))
            if total_access > 0:
                endpoint_probability = endpoint_access / total_access
                if endpoint_probability < 0.05:  # Less than 5% of usual access
                    anomaly_score += 0.4
                    anomalies.append(f"Unusual endpoint access: {event.path}")
        
        # Check IP address anomaly
        if event.ip_address:
            ip_key = f"ip_{hashlib.md5(event.ip_address.encode()).hexdigest()[:8]}"
            ip_access = int(patterns.get(ip_key, 0))
            if total_access > 0:
                ip_probability = ip_access / total_access
                if ip_probability < 0.1:  # Less than 10% of usual access
                    anomaly_score += 0.3
                    anomalies.append(f"Unusual IP address: {event.ip_address}")
        
        # Update patterns
        await self.redis.hincrby(user_key, hour_key, 1)
        if event.path:
            await self.redis.hincrby(user_key, endpoint_key, 1)
        if event.ip_address:
            await self.redis.hincrby(user_key, ip_key, 1)
        await self.redis.expire(user_key, 7 * 24 * 3600)  # Keep for 7 days
        
        rule = self.detection_rules["anomalous_access"]
        if anomaly_score > rule["confidence_threshold"]:
            threat_level = ThreatLevel.HIGH if anomaly_score > 0.8 else ThreatLevel.MEDIUM
            
            return SecurityThreat(
                threat_id=f"anom_{hashlib.md5(f'{event.user_id}_{event.timestamp}'.encode()).hexdigest()[:8]}",
                threat_type=AttackType.ANOMALOUS_ACCESS,
                threat_level=threat_level,
                source_ip=event.ip_address,
                user_id=event.user_id,
                detection_time=event.timestamp,
                description=f"Anomalous access pattern detected for user {event.user_id}",
                evidence={
                    "anomaly_score": anomaly_score,
                    "detected_anomalies": anomalies,
                    "access_context": {
                        "hour": current_hour,
                        "endpoint": event.path,
                        "ip_address": event.ip_address
                    }
                },
                confidence_score=anomaly_score,
                recommended_actions=[
                    "Require additional authentication",
                    "Monitor user activity closely",
                    "Review user permissions",
                    "Consider temporary account restriction"
                ],
                affected_resources=[f"user_account:{event.user_id}"]
            )
        
        return None
    
    async def _detect_data_exfiltration(self, event: AuditEvent) -> Optional[SecurityThreat]:
        """Detect potential data exfiltration attempts"""
        if not event.response_size:
            return None
        
        rule = self.detection_rules["data_exfiltration"]
        user_key = f"data_access:{event.user_id or event.ip_address}"
        current_time = datetime.utcnow()
        
        # Track large responses
        if event.response_size > rule["large_response_threshold"]:
            large_response_key = f"{user_key}:large_responses"
            await self.redis.zadd(
                large_response_key, 
                {str(current_time.timestamp()): current_time.timestamp()}
            )
            await self.redis.expire(large_response_key, rule["time_window_minutes"] * 60)
        
        # Track bulk requests
        bulk_request_key = f"{user_key}:requests"
        await self.redis.zadd(
            bulk_request_key, 
            {str(current_time.timestamp()): current_time.timestamp()}
        )
        await self.redis.expire(bulk_request_key, rule["time_window_minutes"] * 60)
        
        # Check for bulk access pattern
        window_start = current_time - timedelta(minutes=rule["time_window_minutes"])
        recent_requests = await self.redis.zrangebyscore(
            bulk_request_key,
            window_start.timestamp(),
            current_time.timestamp()
        )
        
        request_count = len(recent_requests)
        
        if request_count >= rule["bulk_requests_threshold"]:
            # Calculate total data accessed
            total_data = event.response_size  # This would need to be summed from all recent requests
            
            confidence = min(1.0, request_count / (rule["bulk_requests_threshold"] * 2))
            
            return SecurityThreat(
                threat_id=f"exfil_{hashlib.md5(f'{event.user_id}_{current_time}'.encode()).hexdigest()[:8]}",
                threat_type=AttackType.DATA_EXFILTRATION,
                threat_level=ThreatLevel.CRITICAL,
                source_ip=event.ip_address,
                user_id=event.user_id,
                detection_time=current_time,
                description=f"Potential data exfiltration detected: {request_count} requests in {rule['time_window_minutes']} minutes",
                evidence={
                    "request_count": request_count,
                    "time_window_minutes": rule["time_window_minutes"],
                    "large_response_size": event.response_size,
                    "endpoints_accessed": [event.path]
                },
                confidence_score=confidence,
                recommended_actions=[
                    f"Immediately suspend user {event.user_id}",
                    f"Block IP {event.ip_address}",
                    "Review all recent data access",
                    "Check for data integrity",
                    "Alert security team immediately",
                    "Consider forensic analysis"
                ],
                affected_resources=["sensitive_data", "user_data", "database"]
            )
        
        return None
    
    async def _detect_malicious_files(self, event: AuditEvent) -> Optional[SecurityThreat]:
        """Detect malicious file upload attempts"""
        if not (event.path and "upload" in event.path.lower()):
            return None
        
        # Check for suspicious file extensions or content
        # This would require access to actual file content/names
        
        # Check user agent for known attack tools
        if event.request_headers and "user-agent" in event.request_headers:
            user_agent = event.request_headers["user-agent"].lower()
            
            for pattern in self.threat_patterns["malicious_user_agents"]:
                if re.search(pattern, user_agent, re.IGNORECASE):
                    return SecurityThreat(
                        threat_id=f"mal_file_{hashlib.md5(f'{event.ip_address}_{event.event_id}'.encode()).hexdigest()[:8]}",
                        threat_type=AttackType.MALICIOUS_FILE_UPLOAD,
                        threat_level=ThreatLevel.HIGH,
                        source_ip=event.ip_address,
                        user_id=event.user_id,
                        detection_time=event.timestamp,
                        description=f"Malicious file upload attempt detected from {event.ip_address}",
                        evidence={
                            "malicious_user_agent": user_agent,
                            "upload_endpoint": event.path,
                            "request_size": event.request_size
                        },
                        confidence_score=0.9,
                        recommended_actions=[
                            f"Block IP {event.ip_address}",
                            "Quarantine uploaded files",
                            "Scan system for malware",
                            "Review file upload validation",
                            "Alert security team"
                        ],
                        affected_resources=[event.path, "file_storage_system"]
                    )
        
        return None
    
    async def get_security_metrics(self, time_window_hours: int = 24) -> SecurityMetrics:
        """Get security metrics for monitoring dashboard"""
        current_time = datetime.utcnow()
        window_start = current_time - timedelta(hours=time_window_hours)
        
        # Get threats from the time window
        threat_key = "security_threats"
        threats = await self.redis.zrangebyscore(
            threat_key,
            window_start.timestamp(),
            current_time.timestamp()
        )
        
        # Parse and analyze threats
        threats_by_level = defaultdict(int)
        threats_by_type = defaultdict(int)
        
        for threat_data in threats:
            threat = json.loads(threat_data.decode())
            threats_by_level[threat["threat_level"]] += 1
            threats_by_type[threat["threat_type"]] += 1
        
        # Get additional metrics
        blocked_ips_count = await self.redis.scard("blocked_ips")
        failed_auth_count = await self.redis.get("failed_auth_count") or 0
        successful_auth_count = await self.redis.get("successful_auth_count") or 0
        
        return SecurityMetrics(
            total_threats_detected=len(threats),
            threats_by_level=dict(threats_by_level),
            threats_by_type=dict(threats_by_type),
            blocked_ips=int(blocked_ips_count),
            failed_authentications=int(failed_auth_count),
            successful_authentications=int(successful_auth_count),
            suspicious_file_uploads=threats_by_type.get("malicious_file_upload", 0),
            anomalous_api_calls=threats_by_type.get("anomalous_access", 0),
            time_window=f"{time_window_hours} hours"
        )

class SecurityActionExecutor:
    """Execute automated security actions based on threat detection"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.action_handlers = {
            AttackType.BRUTE_FORCE: self._handle_brute_force,
            AttackType.SQL_INJECTION: self._handle_injection_attack,
            AttackType.XSS_ATTEMPT: self._handle_xss_attack,
            AttackType.DATA_EXFILTRATION: self._handle_data_exfiltration,
            AttackType.ANOMALOUS_ACCESS: self._handle_anomalous_access,
            AttackType.MALICIOUS_FILE_UPLOAD: self._handle_malicious_file,
        }
    
    async def execute_security_action(self, threat: SecurityThreat) -> Dict[str, Any]:
        """Execute appropriate security action for detected threat"""
        handler = self.action_handlers.get(threat.threat_type)
        if handler:
            return await handler(threat)
        else:
            return await self._default_security_action(threat)
    
    async def _handle_brute_force(self, threat: SecurityThreat) -> Dict[str, Any]:
        """Handle brute force attack detection"""
        # Block IP address
        await self.redis.sadd("blocked_ips", threat.source_ip)
        await self.redis.expire("blocked_ips", 3600)  # Block for 1 hour
        
        # Alert security team
        await self._send_security_alert(threat)
        
        # Log security action
        await self._log_security_action(threat, "ip_blocked")
        
        return {
            "action": "ip_blocked",
            "ip_address": threat.source_ip,
            "duration": "1 hour",
            "alert_sent": True
        }
    
    async def _handle_injection_attack(self, threat: SecurityThreat) -> Dict[str, Any]:
        """Handle SQL injection or other injection attacks"""
        # Immediately block IP
        await self.redis.sadd("blocked_ips", threat.source_ip)
        await self.redis.expire("blocked_ips", 24 * 3600)  # Block for 24 hours
        
        # Suspend user account if identified
        if threat.user_id:
            await self.redis.sadd("suspended_users", threat.user_id)
        
        # Send critical alert
        await self._send_critical_alert(threat)
        
        # Log security action
        await self._log_security_action(threat, "critical_block")
        
        return {
            "action": "critical_block",
            "ip_address": threat.source_ip,
            "user_suspended": bool(threat.user_id),
            "duration": "24 hours",
            "critical_alert_sent": True
        }
    
    async def _handle_data_exfiltration(self, threat: SecurityThreat) -> Dict[str, Any]:
        """Handle data exfiltration attempts"""
        # Immediately suspend user and block IP
        if threat.user_id:
            await self.redis.sadd("suspended_users", threat.user_id)
        
        await self.redis.sadd("blocked_ips", threat.source_ip)
        
        # Trigger incident response
        await self._trigger_incident_response(threat)
        
        # Log security action
        await self._log_security_action(threat, "incident_response")
        
        return {
            "action": "incident_response",
            "user_suspended": bool(threat.user_id),
            "ip_blocked": True,
            "incident_created": True,
            "forensic_analysis_triggered": True
        }
    
    async def _handle_anomalous_access(self, threat: SecurityThreat) -> Dict[str, Any]:
        """Handle anomalous access patterns"""
        # Require additional authentication
        if threat.user_id:
            await self.redis.sadd("require_mfa", threat.user_id)
            await self.redis.expire("require_mfa", 24 * 3600)
        
        # Enhanced monitoring
        await self.redis.sadd("enhanced_monitoring", threat.source_ip)
        await self.redis.expire("enhanced_monitoring", 7 * 24 * 3600)
        
        # Send alert
        await self._send_security_alert(threat)
        
        return {
            "action": "enhanced_monitoring",
            "mfa_required": bool(threat.user_id),
            "monitoring_duration": "7 days",
            "alert_sent": True
        }
    
    async def _send_security_alert(self, threat: SecurityThreat) -> None:
        """Send security alert to monitoring systems"""
        alert_data = {
            "threat_id": threat.threat_id,
            "threat_type": threat.threat_type.value,
            "threat_level": threat.threat_level.value,
            "source_ip": threat.source_ip,
            "description": threat.description,
            "timestamp": threat.detection_time.isoformat(),
            "confidence": threat.confidence_score
        }
        
        # Store alert for monitoring dashboard
        await self.redis.lpush("security_alerts", json.dumps(alert_data))
        await self.redis.ltrim("security_alerts", 0, 999)  # Keep last 1000 alerts
        
        logger.warning(f"Security alert: {threat.description}", extra={"security_threat": alert_data})
    
    async def _send_critical_alert(self, threat: SecurityThreat) -> None:
        """Send critical security alert"""
        await self._send_security_alert(threat)
        # Additional critical alert mechanisms would go here
        logger.critical(f"CRITICAL SECURITY THREAT: {threat.description}")
    
    async def _log_security_action(self, threat: SecurityThreat, action: str) -> None:
        """Log security action taken"""
        action_log = {
            "threat_id": threat.threat_id,
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
            "automated": True
        }
        
        await self.redis.lpush("security_actions", json.dumps(action_log))
        await self.redis.ltrim("security_actions", 0, 999)

# Global security monitoring instances
security_detector = None
security_executor = None

async def initialize_security_monitoring(redis_client: redis.Redis):
    """Initialize security monitoring system"""
    global security_detector, security_executor
    
    security_detector = SecurityEventDetector(redis_client)
    security_executor = SecurityActionExecutor(redis_client)
    
    logger.info("Security monitoring system initialized")

async def analyze_security_event(audit_event: AuditEvent) -> Optional[Dict[str, Any]]:
    """Analyze audit event for security threats and take action"""
    if not security_detector or not security_executor:
        return None
    
    # Detect threats
    threat = await security_detector.analyze_audit_event(audit_event)
    
    if threat:
        # Execute security action
        action_result = await security_executor.execute_security_action(threat)
        
        return {
            "threat_detected": asdict(threat),
            "action_taken": action_result
        }
    
    return None