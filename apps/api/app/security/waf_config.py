"""
Web Application Firewall (WAF) and DDoS Protection Configuration
===============================================================

This module provides comprehensive WAF and DDoS protection configurations
for the Schlep-engine API with support for multiple deployment environments.

Features:
- OWASP Top 10 protection rules
- DDoS mitigation strategies
- Geographic blocking capabilities
- Custom security rules
- Rate limiting integration
- Real-time threat detection
- Automated response mechanisms
"""

import re
import time
import asyncio
import ipaddress
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import logging
import json

from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from app.middleware.audit_middleware import audit_logger, AuditEventType, AuditSeverity
from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

class ThreatLevel(Enum):
    """Threat severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ActionType(Enum):
    """WAF action types"""
    ALLOW = "allow"
    BLOCK = "block"
    CHALLENGE = "challenge"
    LOG = "log"
    RATE_LIMIT = "rate_limit"

class AttackType(Enum):
    """Types of attacks detected"""
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    LFI = "lfi"  # Local File Inclusion
    RFI = "rfi"  # Remote File Inclusion
    COMMAND_INJECTION = "command_injection"
    XXXI = "xxe"  # XML External Entity
    CSRF = "csrf"
    DIRECTORY_TRAVERSAL = "directory_traversal"
    DDOS = "ddos"
    BRUTE_FORCE = "brute_force"
    MALICIOUS_BOT = "malicious_bot"
    SUSPICIOUS_USER_AGENT = "suspicious_user_agent"
    GEO_BLOCKED = "geo_blocked"

@dataclass
class SecurityRule:
    """WAF security rule definition"""
    rule_id: str
    name: str
    description: str
    pattern: str
    attack_type: AttackType
    threat_level: ThreatLevel
    action: ActionType
    enabled: bool = True
    score: int = 10
    fields_to_check: List[str] = field(default_factory=lambda: ["all"])

@dataclass
class ThreatDetection:
    """Threat detection result"""
    threat_detected: bool
    attack_type: AttackType
    threat_level: ThreatLevel
    rule_triggered: str
    confidence_score: float
    details: Dict[str, Any]
    recommended_action: ActionType

@dataclass
class DDoSProtectionConfig:
    """DDoS protection configuration"""
    requests_per_second_threshold: int = 100
    requests_per_minute_threshold: int = 1000
    concurrent_connections_threshold: int = 500
    suspicious_pattern_threshold: int = 10
    geo_blocking_enabled: bool = True
    blocked_countries: Set[str] = field(default_factory=lambda: {"CN", "RU", "KP"})
    whitelist_ips: Set[str] = field(default_factory=set)
    blacklist_ips: Set[str] = field(default_factory=set)

class WAFRuleEngine:
    """WAF rule engine for threat detection"""
    
    def __init__(self):
        self.rules = self._initialize_security_rules()
        self.redis_client = None
        self._blocked_ips = set()
        self._threat_scores = {}
        
    def _initialize_security_rules(self) -> List[SecurityRule]:
        """Initialize OWASP Top 10 and custom security rules"""
        rules = [
            # SQL Injection Detection
            SecurityRule(
                rule_id="SQL001",
                name="SQL Injection - Union Based",
                description="Detects UNION-based SQL injection attempts",
                pattern=r"(?i)(union\s+select|union\s+all\s+select)",
                attack_type=AttackType.SQL_INJECTION,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=20
            ),
            SecurityRule(
                rule_id="SQL002", 
                name="SQL Injection - Boolean Based",
                description="Detects boolean-based SQL injection",
                pattern=r"(?i)(and\s+1=1|or\s+1=1|and\s+1=2|or\s+1=2)",
                attack_type=AttackType.SQL_INJECTION,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=20
            ),
            SecurityRule(
                rule_id="SQL003",
                name="SQL Injection - Error Based", 
                description="Detects error-based SQL injection",
                pattern=r"(?i)(extractvalue|updatexml|and\s+\(select|waitfor\s+delay)",
                attack_type=AttackType.SQL_INJECTION,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=20
            ),
            
            # XSS Detection
            SecurityRule(
                rule_id="XSS001",
                name="Cross-Site Scripting - Script Tags",
                description="Detects script tag injection attempts",
                pattern=r"(?i)<script[^>]*>.*?</script>",
                attack_type=AttackType.XSS,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=18
            ),
            SecurityRule(
                rule_id="XSS002",
                name="Cross-Site Scripting - Event Handlers",
                description="Detects JavaScript event handler injection",
                pattern=r"(?i)(on\w+\s*=|javascript:)",
                attack_type=AttackType.XSS,
                threat_level=ThreatLevel.MEDIUM,
                action=ActionType.BLOCK,
                score=15
            ),
            
            # Local File Inclusion
            SecurityRule(
                rule_id="LFI001",
                name="Local File Inclusion",
                description="Detects local file inclusion attempts",
                pattern=r"(?i)(\.\.\/|\.\.\\|\/etc\/passwd|\/etc\/shadow|\/proc\/version)",
                attack_type=AttackType.LFI,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=20
            ),
            
            # Remote File Inclusion
            SecurityRule(
                rule_id="RFI001",
                name="Remote File Inclusion",
                description="Detects remote file inclusion attempts",
                pattern=r"(?i)(http://|https://|ftp://|ftps://)",
                attack_type=AttackType.RFI,
                threat_level=ThreatLevel.MEDIUM,
                action=ActionType.LOG,
                score=10,
                fields_to_check=["query_params", "form_data"]
            ),
            
            # Command Injection
            SecurityRule(
                rule_id="CMD001",
                name="Command Injection",
                description="Detects command injection attempts",
                pattern=r"(?i)(;|\||\&|\$\(|\`|wget|curl|nc|netcat|bash|sh|cmd|powershell)",
                attack_type=AttackType.COMMAND_INJECTION,
                threat_level=ThreatLevel.CRITICAL,
                action=ActionType.BLOCK,
                score=25
            ),
            
            # Directory Traversal
            SecurityRule(
                rule_id="DIR001",
                name="Directory Traversal",
                description="Detects directory traversal attempts",
                pattern=r"(?i)(\.\.\/\.\.\/|\.\.\\\.\.\\|%2e%2e%2f|%2e%2e%5c)",
                attack_type=AttackType.DIRECTORY_TRAVERSAL,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=18
            ),
            
            # Malicious User Agents
            SecurityRule(
                rule_id="UA001",
                name="Malicious User Agents",
                description="Detects known malicious user agents",
                pattern=r"(?i)(sqlmap|nikto|nmap|masscan|zap|burpsuite|w3af|havij|pangolin)",
                attack_type=AttackType.SUSPICIOUS_USER_AGENT,
                threat_level=ThreatLevel.HIGH,
                action=ActionType.BLOCK,
                score=20,
                fields_to_check=["user_agent"]
            ),
            
            # Bot Detection
            SecurityRule(
                rule_id="BOT001",
                name="Malicious Bot Detection",
                description="Detects malicious bots and scrapers",
                pattern=r"(?i)(bot|spider|scraper|crawler|wget|curl)(?!.*google|bing|yahoo)",
                attack_type=AttackType.MALICIOUS_BOT,
                threat_level=ThreatLevel.MEDIUM,
                action=ActionType.CHALLENGE,
                score=12,
                fields_to_check=["user_agent"]
            )
        ]
        
        return rules
    
    async def analyze_request(self, request: Request) -> ThreatDetection:
        """
        Analyze incoming request for security threats
        """
        threat_score = 0
        detected_threats = []
        
        # Extract request data for analysis
        request_data = await self._extract_request_data(request)
        
        # Check each security rule
        for rule in self.rules:
            if not rule.enabled:
                continue
                
            if self._check_rule_against_request(rule, request_data):
                threat_score += rule.score
                detected_threats.append({
                    "rule_id": rule.rule_id,
                    "rule_name": rule.name,
                    "attack_type": rule.attack_type,
                    "threat_level": rule.threat_level,
                    "action": rule.action,
                    "score": rule.score
                })
        
        # Determine overall threat level and action
        if threat_score >= 25:
            threat_level = ThreatLevel.CRITICAL
            recommended_action = ActionType.BLOCK
        elif threat_score >= 20:
            threat_level = ThreatLevel.HIGH
            recommended_action = ActionType.BLOCK
        elif threat_score >= 10:
            threat_level = ThreatLevel.MEDIUM
            recommended_action = ActionType.CHALLENGE
        elif threat_score > 0:
            threat_level = ThreatLevel.LOW
            recommended_action = ActionType.LOG
        else:
            threat_level = ThreatLevel.LOW
            recommended_action = ActionType.ALLOW
        
        # Determine primary attack type
        attack_type = AttackType.SQL_INJECTION  # Default
        if detected_threats:
            attack_type = detected_threats[0]["attack_type"]
        
        return ThreatDetection(
            threat_detected=threat_score > 0,
            attack_type=attack_type,
            threat_level=threat_level,
            rule_triggered=detected_threats[0]["rule_id"] if detected_threats else "",
            confidence_score=min(threat_score / 25.0, 1.0),
            details={
                "total_score": threat_score,
                "triggered_rules": detected_threats,
                "request_data": request_data
            },
            recommended_action=recommended_action
        )
    
    async def _extract_request_data(self, request: Request) -> Dict[str, Any]:
        """Extract relevant data from request for analysis"""
        data = {
            "method": request.method,
            "path": request.url.path,
            "query_string": str(request.url.query),
            "user_agent": request.headers.get("user-agent", ""),
            "referer": request.headers.get("referer", ""),
            "headers": dict(request.headers),
            "ip_address": request.client.host if request.client else "unknown"
        }
        
        # Extract query parameters
        data["query_params"] = dict(request.query_params)
        
        # Extract form data if present
        try:
            if request.method in ["POST", "PUT", "PATCH"]:
                content_type = request.headers.get("content-type", "")
                if "application/x-www-form-urlencoded" in content_type:
                    form_data = await request.form()
                    data["form_data"] = dict(form_data)
                elif "application/json" in content_type:
                    json_data = await request.json()
                    data["json_data"] = json_data
        except:
            # If we can't parse the body, continue without it
            pass
        
        return data
    
    def _check_rule_against_request(self, rule: SecurityRule, request_data: Dict[str, Any]) -> bool:
        """Check if a security rule matches the request data"""
        pattern = re.compile(rule.pattern)
        fields_to_check = rule.fields_to_check
        
        if "all" in fields_to_check:
            # Check all string fields
            fields_to_check = ["path", "query_string", "user_agent", "referer"]
            # Add form/json data fields
            if "form_data" in request_data:
                fields_to_check.extend([f"form_data.{k}" for k in request_data["form_data"].keys()])
            if "json_data" in request_data:
                fields_to_check.append("json_data")
        
        for field in fields_to_check:
            # Handle nested field access
            if "." in field:
                parts = field.split(".")
                value = request_data
                for part in parts:
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        value = None
                        break
            else:
                value = request_data.get(field, "")
            
            if value and isinstance(value, str):
                if pattern.search(value):
                    return True
            elif value and isinstance(value, dict):
                # For JSON data, check all string values
                if self._check_dict_recursively(value, pattern):
                    return True
        
        return False
    
    def _check_dict_recursively(self, data: Dict[str, Any], pattern: re.Pattern) -> bool:
        """Recursively check dictionary values against pattern"""
        for key, value in data.items():
            if isinstance(value, str) and pattern.search(value):
                return True
            elif isinstance(value, dict):
                if self._check_dict_recursively(value, pattern):
                    return True
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and pattern.search(item):
                        return True
                    elif isinstance(item, dict):
                        if self._check_dict_recursively(item, pattern):
                            return True
        return False

class DDoSProtectionEngine:
    """DDoS protection and mitigation engine"""
    
    def __init__(self, config: DDoSProtectionConfig):
        self.config = config
        self.request_tracking = {}
        self.connection_tracking = {}
        self.redis_client = None
    
    async def check_ddos_protection(self, request: Request) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if request should be blocked for DDoS protection
        
        Returns:
            Tuple of (should_block, details)
        """
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Check if IP is whitelisted
        if client_ip in self.config.whitelist_ips:
            return False, {"reason": "whitelisted_ip"}
        
        # Check if IP is blacklisted
        if client_ip in self.config.blacklist_ips:
            return True, {"reason": "blacklisted_ip", "action": "permanent_block"}
        
        # Geographic blocking
        if self.config.geo_blocking_enabled:
            country_code = await self._get_country_code(client_ip)
            if country_code in self.config.blocked_countries:
                return True, {"reason": "geo_blocked", "country": country_code}
        
        # Rate limiting checks
        rate_limit_result = await self._check_rate_limits(client_ip, current_time)
        if rate_limit_result["blocked"]:
            return True, rate_limit_result
        
        # Suspicious pattern detection
        pattern_result = await self._check_suspicious_patterns(request, client_ip)
        if pattern_result["blocked"]:
            return True, pattern_result
        
        return False, {"reason": "allowed"}
    
    async def _check_rate_limits(self, client_ip: str, current_time: float) -> Dict[str, Any]:
        """Check various rate limits for DDoS protection"""
        redis_client = await get_redis_client()
        
        # Per-second rate limiting
        second_key = f"ddos:rps:{client_ip}:{int(current_time)}"
        minute_key = f"ddos:rpm:{client_ip}:{int(current_time // 60)}"
        
        try:
            if redis_client:
                # Increment counters
                rps_count = await redis_client.incr(second_key)
                await redis_client.expire(second_key, 2)
                
                rpm_count = await redis_client.incr(minute_key)
                await redis_client.expire(minute_key, 120)
                
                # Check thresholds
                if rps_count > self.config.requests_per_second_threshold:
                    return {
                        "blocked": True,
                        "reason": "rate_limit_exceeded",
                        "type": "requests_per_second",
                        "count": rps_count,
                        "threshold": self.config.requests_per_second_threshold
                    }
                
                if rpm_count > self.config.requests_per_minute_threshold:
                    return {
                        "blocked": True,
                        "reason": "rate_limit_exceeded", 
                        "type": "requests_per_minute",
                        "count": rpm_count,
                        "threshold": self.config.requests_per_minute_threshold
                    }
            
        except Exception as e:
            logger.error(f"Rate limiting check failed: {e}")
        
        return {"blocked": False}
    
    async def _check_suspicious_patterns(self, request: Request, client_ip: str) -> Dict[str, Any]:
        """Check for suspicious request patterns"""
        # Check for rapid requests to different endpoints
        # Check for requests without proper headers
        # Check for unusual request patterns
        
        user_agent = request.headers.get("user-agent", "")
        
        # Empty or suspicious user agent
        if not user_agent or len(user_agent) < 10:
            return {
                "blocked": True,
                "reason": "suspicious_user_agent",
                "details": "Empty or too short user agent"
            }
        
        # Check for bot-like behavior
        if "bot" in user_agent.lower() and "google" not in user_agent.lower():
            suspicious_count = await self._increment_suspicious_counter(client_ip)
            if suspicious_count > self.config.suspicious_pattern_threshold:
                return {
                    "blocked": True,
                    "reason": "suspicious_bot_behavior",
                    "count": suspicious_count
                }
        
        return {"blocked": False}
    
    async def _get_country_code(self, ip_address: str) -> str:
        """Get country code for IP address (mock implementation)"""
        # In production, use a GeoIP service like MaxMind
        # This is a simplified implementation
        try:
            ip = ipaddress.ip_address(ip_address)
            if ip.is_private:
                return "XX"  # Private IP
        except ValueError:
            pass
        
        # Mock country detection based on IP ranges
        # In production, use proper GeoIP database
        if ip_address.startswith("185."):
            return "RU"
        elif ip_address.startswith("14."):
            return "CN"
        
        return "US"  # Default
    
    async def _increment_suspicious_counter(self, client_ip: str) -> int:
        """Increment suspicious activity counter for IP"""
        redis_client = await get_redis_client()
        key = f"ddos:suspicious:{client_ip}"
        
        try:
            if redis_client:
                count = await redis_client.incr(key)
                await redis_client.expire(key, 3600)  # 1 hour
                return count
        except Exception as e:
            logger.error(f"Suspicious counter increment failed: {e}")
        
        return 0

class WAFMiddleware(BaseHTTPMiddleware):
    """
    Web Application Firewall middleware for comprehensive protection
    """
    
    def __init__(
        self, 
        app,
        enabled: bool = True,
        ddos_config: Optional[DDoSProtectionConfig] = None,
        custom_rules: Optional[List[SecurityRule]] = None
    ):
        super().__init__(app)
        self.enabled = enabled
        self.rule_engine = WAFRuleEngine()
        self.ddos_protection = DDoSProtectionEngine(ddos_config or DDoSProtectionConfig())
        
        # Add custom rules if provided
        if custom_rules:
            self.rule_engine.rules.extend(custom_rules)
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        
        try:
            # DDoS Protection Check
            ddos_blocked, ddos_details = await self.ddos_protection.check_ddos_protection(request)
            
            if ddos_blocked:
                await self._log_security_event(
                    request, "ddos_protection", ddos_details, ThreatLevel.HIGH
                )
                return self._create_block_response("DDoS Protection: Request blocked", 429)
            
            # WAF Threat Analysis
            threat_detection = await self.rule_engine.analyze_request(request)
            
            if threat_detection.threat_detected:
                await self._log_security_event(
                    request, "waf_threat_detected", threat_detection.details, threat_detection.threat_level
                )
                
                # Take action based on threat level and recommended action
                if threat_detection.recommended_action == ActionType.BLOCK:
                    return self._create_block_response(
                        f"Security violation detected: {threat_detection.attack_type.value}", 
                        403
                    )
                elif threat_detection.recommended_action == ActionType.CHALLENGE:
                    # In production, implement CAPTCHA or other challenge
                    response = self._create_challenge_response()
                    return response
                # For LOG action, continue processing but log the event
            
            # Process request normally
            response = await call_next(request)
            
            # Add security headers to response
            self._add_security_headers(response)
            
            return response
            
        except Exception as e:
            logger.error(f"WAF middleware error: {e}")
            # Continue processing if WAF fails to avoid blocking legitimate requests
            return await call_next(request)
    
    async def _log_security_event(
        self, 
        request: Request, 
        event_type: str, 
        details: Dict[str, Any], 
        threat_level: ThreatLevel
    ):
        """Log security event to audit system"""
        await audit_logger.log_event({
            "event_type": AuditEventType.SECURITY_VIOLATION,
            "severity": self._map_threat_to_audit_severity(threat_level),
            "ip_address": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
            "path": request.url.path,
            "method": request.method,
            "description": f"WAF {event_type}",
            "metadata": {
                "waf_event_type": event_type,
                "threat_level": threat_level.value,
                "details": details
            }
        })
    
    def _map_threat_to_audit_severity(self, threat_level: ThreatLevel) -> AuditSeverity:
        """Map threat level to audit severity"""
        mapping = {
            ThreatLevel.LOW: AuditSeverity.LOW,
            ThreatLevel.MEDIUM: AuditSeverity.MEDIUM,
            ThreatLevel.HIGH: AuditSeverity.HIGH,
            ThreatLevel.CRITICAL: AuditSeverity.CRITICAL
        }
        return mapping.get(threat_level, AuditSeverity.MEDIUM)
    
    def _create_block_response(self, message: str, status_code: int) -> StarletteResponse:
        """Create blocked response"""
        return StarletteResponse(
            content=json.dumps({
                "error": "Request blocked by security policy",
                "message": message,
                "timestamp": datetime.utcnow().isoformat(),
                "reference_id": f"WAF-{int(time.time())}"
            }),
            status_code=status_code,
            headers={
                "Content-Type": "application/json",
                "X-WAF-Block": "true"
            }
        )
    
    def _create_challenge_response(self) -> StarletteResponse:
        """Create challenge response (placeholder for CAPTCHA)"""
        return StarletteResponse(
            content=json.dumps({
                "challenge_required": True,
                "message": "Please complete security verification",
                "challenge_type": "captcha"
            }),
            status_code=429,
            headers={
                "Content-Type": "application/json",
                "X-WAF-Challenge": "true"
            }
        )
    
    def _add_security_headers(self, response: StarletteResponse):
        """Add security headers to response"""
        if hasattr(response, 'headers'):
            response.headers.update({
                "X-WAF-Protection": "enabled",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            })

# Export WAF components
__all__ = [
    'WAFMiddleware',
    'WAFRuleEngine', 
    'DDoSProtectionEngine',
    'DDoSProtectionConfig',
    'SecurityRule',
    'ThreatDetection',
    'ThreatLevel',
    'ActionType',
    'AttackType'
]