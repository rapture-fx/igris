"""
Comprehensive Security Hardening Framework
=========================================

This module implements enterprise-grade security hardening measures
across all environments for the Schlep Engine platform.

Features:
- Multi-layered security validation
- Environment-aware security policies
- Comprehensive threat protection
- Security monitoring and incident response
- Compliance framework integration
"""

import os
import re
import ipaddress
import hashlib
import hmac
import secrets
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field, validator
import jwt
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import json

logger = logging.getLogger(__name__)


class SecurityLevel(Enum):
    """Security levels for different operations"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ThreatLevel(Enum):
    """Threat severity levels"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SecurityViolationType(Enum):
    """Types of security violations"""
    AUTHENTICATION_FAILURE = "auth_failure"
    AUTHORIZATION_VIOLATION = "authz_violation"
    INPUT_VALIDATION_FAILURE = "input_validation"
    RATE_LIMIT_EXCEEDED = "rate_limit"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    DATA_BREACH_ATTEMPT = "data_breach"
    INJECTION_ATTACK = "injection_attack"
    XSS_ATTEMPT = "xss_attempt"
    CSRF_VIOLATION = "csrf_violation"
    MALFORMED_REQUEST = "malformed_request"


@dataclass
class SecurityIncident:
    """Security incident tracking"""
    incident_id: str = field(default_factory=lambda: secrets.token_hex(16))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    threat_level: ThreatLevel = ThreatLevel.MEDIUM
    violation_type: SecurityViolationType = SecurityViolationType.SUSPICIOUS_ACTIVITY
    source_ip: Optional[str] = None
    user_id: Optional[str] = None
    endpoint: Optional[str] = None
    user_agent: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    response_actions: List[str] = field(default_factory=list)


@dataclass
class SecurityPolicy:
    """Security policy configuration"""
    name: str
    security_level: SecurityLevel
    enabled: bool = True
    rules: Dict[str, Any] = field(default_factory=dict)
    exceptions: List[str] = field(default_factory=list)
    monitoring_enabled: bool = True


class SecurityHardeningConfig(BaseModel):
    """Configuration for security hardening"""

    # Environment configuration
    environment: str = Field(default="development")
    debug_mode: bool = Field(default=False)

    # Authentication & Authorization
    mfa_required_roles: List[str] = Field(default=["admin", "analyst"])
    session_timeout_minutes: int = Field(default=30, ge=5, le=480)
    max_login_attempts: int = Field(default=5, ge=3, le=10)
    lockout_duration_minutes: int = Field(default=15, ge=5, le=60)
    password_min_length: int = Field(default=12, ge=8, le=128)
    password_complexity_required: bool = Field(default=True)

    # Input Validation
    max_request_size_mb: int = Field(default=10, ge=1, le=100)
    max_json_depth: int = Field(default=10, ge=5, le=50)
    max_array_length: int = Field(default=1000, ge=100, le=10000)
    allowed_file_types: Set[str] = Field(default={".pdf", ".txt", ".csv", ".json", ".xml"})
    max_file_size_mb: int = Field(default=50, ge=1, le=500)

    # Rate Limiting
    default_rate_limit_per_minute: int = Field(default=60, ge=10, le=1000)
    auth_endpoint_rate_limit: int = Field(default=10, ge=5, le=30)
    admin_endpoint_rate_limit: int = Field(default=30, ge=10, le=100)

    # Network Security
    allowed_origins: Set[str] = Field(default=set())
    blocked_ips: Set[str] = Field(default=set())
    allowed_ips: Set[str] = Field(default=set())
    enable_ip_geolocation_check: bool = Field(default=False)
    blocked_countries: Set[str] = Field(default=set())

    # Data Protection
    encryption_key_rotation_days: int = Field(default=90, ge=30, le=365)
    data_retention_days: int = Field(default=365, ge=30, le=2555)  # Max 7 years
    pii_encryption_required: bool = Field(default=True)
    audit_log_retention_days: int = Field(default=2555, ge=90, le=3650)  # Max 10 years

    # Monitoring & Alerting
    security_monitoring_enabled: bool = Field(default=True)
    real_time_alerts_enabled: bool = Field(default=True)
    incident_escalation_threshold: int = Field(default=3, ge=1, le=10)
    anomaly_detection_enabled: bool = Field(default=True)

    # Compliance
    gdpr_compliance_enabled: bool = Field(default=True)
    hipaa_compliance_enabled: bool = Field(default=False)
    sox_compliance_enabled: bool = Field(default=False)

    @validator('environment')
    def validate_environment(cls, v):
        if v not in ['development', 'staging', 'production']:
            raise ValueError('Environment must be development, staging, or production')
        return v

    class Config:
        use_enum_values = True


class SecurityHardeningFramework:
    """Main security hardening framework"""

    def __init__(self, config: Optional[SecurityHardeningConfig] = None):
        self.config = config or SecurityHardeningConfig()
        self.incidents: List[SecurityIncident] = []
        self.policies: Dict[str, SecurityPolicy] = {}
        self.threat_intelligence: Dict[str, Any] = {}
        self.blocked_ips: Set[str] = set()
        self.suspicious_ips: Dict[str, Dict[str, Any]] = {}
        self.encryption_keys: Dict[str, bytes] = {}

        self._initialize_security_policies()
        self._initialize_threat_intelligence()
        self._setup_encryption_keys()

        logger.info("Security Hardening Framework initialized")

    def _initialize_security_policies(self):
        """Initialize default security policies"""

        # Authentication Policy
        self.policies["authentication"] = SecurityPolicy(
            name="Authentication Policy",
            security_level=SecurityLevel.HIGH,
            rules={
                "mfa_required": self.config.mfa_required_roles,
                "session_timeout": self.config.session_timeout_minutes,
                "max_attempts": self.config.max_login_attempts,
                "lockout_duration": self.config.lockout_duration_minutes,
                "password_policy": {
                    "min_length": self.config.password_min_length,
                    "complexity_required": self.config.password_complexity_required,
                    "history_check": 5,
                    "expiry_days": 90
                }
            }
        )

        # Input Validation Policy
        self.policies["input_validation"] = SecurityPolicy(
            name="Input Validation Policy",
            security_level=SecurityLevel.HIGH,
            rules={
                "max_request_size": self.config.max_request_size_mb * 1024 * 1024,
                "max_json_depth": self.config.max_json_depth,
                "max_array_length": self.config.max_array_length,
                "sql_injection_patterns": [
                    r"(\bUNION\b.*\bSELECT\b)",
                    r"(\bSELECT\b.*\bFROM\b.*\bWHERE\b)",
                    r"(\bINSERT\b.*\bINTO\b)",
                    r"(\bUPDATE\b.*\bSET\b)",
                    r"(\bDELETE\b.*\bFROM\b)",
                    r"(\bDROP\b.*\bTABLE\b)",
                    r"('.*'.*=.*'.*')"
                ],
                "xss_patterns": [
                    r"<script.*?>.*?</script>",
                    r"javascript:",
                    r"on\w+\s*=",
                    r"<iframe.*?>",
                    r"<object.*?>",
                    r"<embed.*?>"
                ],
                "command_injection_patterns": [
                    r"[;&|`$]",
                    r"\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat)\b"
                ]
            }
        )

        # Network Security Policy
        self.policies["network_security"] = SecurityPolicy(
            name="Network Security Policy",
            security_level=SecurityLevel.HIGH,
            rules={
                "allowed_origins": list(self.config.allowed_origins),
                "blocked_ips": list(self.config.blocked_ips),
                "allowed_ips": list(self.config.allowed_ips),
                "rate_limits": {
                    "default": self.config.default_rate_limit_per_minute,
                    "auth": self.config.auth_endpoint_rate_limit,
                    "admin": self.config.admin_endpoint_rate_limit
                },
                "security_headers": {
                    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "X-XSS-Protection": "1; mode=block",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
                }
            }
        )

        # Data Protection Policy
        self.policies["data_protection"] = SecurityPolicy(
            name="Data Protection Policy",
            security_level=SecurityLevel.CRITICAL,
            rules={
                "encryption_required": ["pii", "payment", "credentials", "tokens"],
                "key_rotation_days": self.config.encryption_key_rotation_days,
                "data_retention_days": self.config.data_retention_days,
                "backup_encryption": True,
                "secure_deletion": True,
                "access_logging": True
            }
        )

    def _initialize_threat_intelligence(self):
        """Initialize threat intelligence data"""
        self.threat_intelligence = {
            "known_attack_patterns": {
                "sql_injection": [
                    "' OR '1'='1",
                    "' UNION SELECT",
                    "'; DROP TABLE",
                    "' OR 1=1--"
                ],
                "xss_payloads": [
                    "<script>alert('xss')</script>",
                    "javascript:alert('xss')",
                    "<img src=x onerror=alert('xss')>"
                ],
                "path_traversal": [
                    "../",
                    "..\\",
                    "%2e%2e%2f",
                    "%2e%2e\\",
                    "....//",
                    "....\\/"
                ]
            },
            "malicious_user_agents": [
                "sqlmap",
                "nikto",
                "nessus",
                "openvas",
                "w3af",
                "burp",
                "owasp zap"
            ],
            "suspicious_headers": [
                "X-Forwarded-For",
                "X-Real-IP",
                "X-Originating-IP"
            ]
        }

    def _setup_encryption_keys(self):
        """Setup encryption keys for data protection"""
        try:
            # Generate or load master key
            master_key = os.getenv("MASTER_ENCRYPTION_KEY")
            if not master_key:
                master_key = base64.b64encode(secrets.token_bytes(32)).decode()
                logger.warning("Generated new master encryption key - store this securely!")

            self.encryption_keys["master"] = base64.b64decode(master_key.encode())

            # Derive additional keys for different purposes
            self._derive_encryption_keys()

        except Exception as e:
            logger.error(f"Failed to setup encryption keys: {e}")
            raise

    def _derive_encryption_keys(self):
        """Derive encryption keys for different purposes"""
        master_key = self.encryption_keys["master"]

        # Derive keys for different data types
        purposes = ["pii", "payment", "session", "backup"]

        for purpose in purposes:
            # Use PBKDF2 to derive purpose-specific keys
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=purpose.encode(),
                iterations=100000,
                backend=default_backend()
            )
            self.encryption_keys[purpose] = kdf.derive(master_key)

    def validate_input(self, data: Any, field_name: str = "input",
                      security_level: SecurityLevel = SecurityLevel.MEDIUM) -> Tuple[bool, List[str]]:
        """
        Comprehensive input validation

        Args:
            data: Input data to validate
            field_name: Name of the field being validated
            security_level: Security level for validation

        Returns:
            Tuple of (is_valid, list_of_violations)
        """
        violations = []

        try:
            # Convert data to string for pattern matching
            if isinstance(data, (dict, list)):
                data_str = json.dumps(data)
            else:
                data_str = str(data)

            # Check for SQL injection patterns
            policy = self.policies.get("input_validation")
            if policy and policy.enabled:
                sql_patterns = policy.rules.get("sql_injection_patterns", [])
                for pattern in sql_patterns:
                    if re.search(pattern, data_str, re.IGNORECASE):
                        violations.append(f"SQL injection pattern detected in {field_name}")
                        self._record_security_incident(
                            SecurityViolationType.INJECTION_ATTACK,
                            f"SQL injection attempt in {field_name}",
                            {"pattern": pattern, "data": data_str[:100]}
                        )
                        break

                # Check for XSS patterns
                xss_patterns = policy.rules.get("xss_patterns", [])
                for pattern in xss_patterns:
                    if re.search(pattern, data_str, re.IGNORECASE):
                        violations.append(f"XSS pattern detected in {field_name}")
                        self._record_security_incident(
                            SecurityViolationType.XSS_ATTEMPT,
                            f"XSS attempt in {field_name}",
                            {"pattern": pattern, "data": data_str[:100]}
                        )
                        break

                # Check for command injection patterns
                cmd_patterns = policy.rules.get("command_injection_patterns", [])
                for pattern in cmd_patterns:
                    if re.search(pattern, data_str, re.IGNORECASE):
                        violations.append(f"Command injection pattern detected in {field_name}")
                        self._record_security_incident(
                            SecurityViolationType.INJECTION_ATTACK,
                            f"Command injection attempt in {field_name}",
                            {"pattern": pattern, "data": data_str[:100]}
                        )
                        break

            # Check data size limits
            if isinstance(data, str) and len(data.encode()) > policy.rules.get("max_request_size", 10485760):
                violations.append(f"Data size exceeds limit for {field_name}")

            # Check JSON structure limits
            if isinstance(data, dict):
                if self._check_json_depth(data) > policy.rules.get("max_json_depth", 10):
                    violations.append(f"JSON nesting too deep in {field_name}")

            if isinstance(data, list) and len(data) > policy.rules.get("max_array_length", 1000):
                violations.append(f"Array too large in {field_name}")

        except Exception as e:
            logger.error(f"Input validation error: {e}")
            violations.append("Input validation processing error")

        return len(violations) == 0, violations

    def _check_json_depth(self, obj: Any, depth: int = 0) -> int:
        """Check JSON nesting depth"""
        if depth > 50:  # Prevent infinite recursion
            return depth

        max_depth = depth

        if isinstance(obj, dict):
            for value in obj.values():
                current_depth = self._check_json_depth(value, depth + 1)
                max_depth = max(max_depth, current_depth)
        elif isinstance(obj, list):
            for item in obj:
                current_depth = self._check_json_depth(item, depth + 1)
                max_depth = max(max_depth, current_depth)

        return max_depth

    def check_ip_security(self, ip_address: str) -> Tuple[bool, str]:
        """
        Check if IP address is allowed/blocked

        Args:
            ip_address: IP address to check

        Returns:
            Tuple of (is_allowed, reason)
        """
        try:
            # Parse IP address
            ip = ipaddress.ip_address(ip_address)

            # Check if IP is in blocked list
            if ip_address in self.blocked_ips:
                return False, "IP address is blocked"

            # Check against policy blocked IPs
            policy = self.policies.get("network_security")
            if policy and policy.enabled:
                blocked_ips = policy.rules.get("blocked_ips", [])
                for blocked_ip in blocked_ips:
                    try:
                        if ip in ipaddress.ip_network(blocked_ip, strict=False):
                            return False, f"IP address matches blocked network {blocked_ip}"
                    except ValueError:
                        if ip_address == blocked_ip:
                            return False, f"IP address {blocked_ip} is explicitly blocked"

                # Check allowed IPs if configured
                allowed_ips = policy.rules.get("allowed_ips", [])
                if allowed_ips:
                    allowed = False
                    for allowed_ip in allowed_ips:
                        try:
                            if ip in ipaddress.ip_network(allowed_ip, strict=False):
                                allowed = True
                                break
                        except ValueError:
                            if ip_address == allowed_ip:
                                allowed = True
                                break

                    if not allowed:
                        return False, "IP address not in allowed list"

            # Check if IP is suspicious
            if ip_address in self.suspicious_ips:
                suspicious_data = self.suspicious_ips[ip_address]
                if suspicious_data.get("threat_level", 0) > 3:
                    return False, "IP address has suspicious activity"

            return True, "IP address is allowed"

        except ValueError as e:
            logger.error(f"Invalid IP address format: {ip_address} - {e}")
            return False, "Invalid IP address format"
        except Exception as e:
            logger.error(f"IP security check error: {e}")
            return False, "IP security check failed"

    def encrypt_sensitive_data(self, data: str, purpose: str = "pii") -> str:
        """
        Encrypt sensitive data

        Args:
            data: Data to encrypt
            purpose: Purpose/type of data (pii, payment, session, etc.)

        Returns:
            Base64 encoded encrypted data
        """
        try:
            if purpose not in self.encryption_keys:
                raise ValueError(f"No encryption key available for purpose: {purpose}")

            key = self.encryption_keys[purpose]

            # Generate random IV
            iv = secrets.token_bytes(16)

            # Create cipher
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(iv),
                backend=default_backend()
            )
            encryptor = cipher.encryptor()

            # Pad data to block size
            padded_data = self._pad_data(data.encode())

            # Encrypt data
            encrypted_data = encryptor.update(padded_data) + encryptor.finalize()

            # Combine IV and encrypted data
            combined = iv + encrypted_data

            return base64.b64encode(combined).decode()

        except Exception as e:
            logger.error(f"Data encryption failed: {e}")
            raise

    def decrypt_sensitive_data(self, encrypted_data: str, purpose: str = "pii") -> str:
        """
        Decrypt sensitive data

        Args:
            encrypted_data: Base64 encoded encrypted data
            purpose: Purpose/type of data (pii, payment, session, etc.)

        Returns:
            Decrypted data
        """
        try:
            if purpose not in self.encryption_keys:
                raise ValueError(f"No encryption key available for purpose: {purpose}")

            key = self.encryption_keys[purpose]

            # Decode base64
            combined = base64.b64decode(encrypted_data.encode())

            # Extract IV and encrypted data
            iv = combined[:16]
            encrypted_bytes = combined[16:]

            # Create cipher
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(iv),
                backend=default_backend()
            )
            decryptor = cipher.decryptor()

            # Decrypt data
            padded_data = decryptor.update(encrypted_bytes) + decryptor.finalize()

            # Remove padding
            data = self._unpad_data(padded_data)

            return data.decode()

        except Exception as e:
            logger.error(f"Data decryption failed: {e}")
            raise

    def _pad_data(self, data: bytes) -> bytes:
        """PKCS7 padding for AES"""
        pad_len = 16 - len(data) % 16
        return data + bytes([pad_len] * pad_len)

    def _unpad_data(self, padded_data: bytes) -> bytes:
        """Remove PKCS7 padding"""
        pad_len = padded_data[-1]
        return padded_data[:-pad_len]

    def _record_security_incident(self, violation_type: SecurityViolationType,
                                 description: str, details: Dict[str, Any],
                                 source_ip: Optional[str] = None,
                                 user_id: Optional[str] = None,
                                 endpoint: Optional[str] = None):
        """Record a security incident"""

        # Determine threat level based on violation type
        threat_level_mapping = {
            SecurityViolationType.AUTHENTICATION_FAILURE: ThreatLevel.MEDIUM,
            SecurityViolationType.AUTHORIZATION_VIOLATION: ThreatLevel.HIGH,
            SecurityViolationType.INPUT_VALIDATION_FAILURE: ThreatLevel.MEDIUM,
            SecurityViolationType.RATE_LIMIT_EXCEEDED: ThreatLevel.LOW,
            SecurityViolationType.SUSPICIOUS_ACTIVITY: ThreatLevel.MEDIUM,
            SecurityViolationType.DATA_BREACH_ATTEMPT: ThreatLevel.CRITICAL,
            SecurityViolationType.INJECTION_ATTACK: ThreatLevel.HIGH,
            SecurityViolationType.XSS_ATTEMPT: ThreatLevel.HIGH,
            SecurityViolationType.CSRF_VIOLATION: ThreatLevel.HIGH,
            SecurityViolationType.MALFORMED_REQUEST: ThreatLevel.LOW
        }

        incident = SecurityIncident(
            threat_level=threat_level_mapping.get(violation_type, ThreatLevel.MEDIUM),
            violation_type=violation_type,
            source_ip=source_ip,
            user_id=user_id,
            endpoint=endpoint,
            details=details
        )

        self.incidents.append(incident)

        # Update suspicious IP tracking
        if source_ip:
            self._update_suspicious_ip_tracking(source_ip, violation_type, incident.threat_level)

        # Log the incident
        logger.warning(
            f"Security incident recorded: {violation_type.value} - {description}",
            extra={
                "incident_id": incident.incident_id,
                "threat_level": incident.threat_level.value,
                "source_ip": source_ip,
                "user_id": user_id,
                "endpoint": endpoint,
                "details": details
            }
        )

        # Trigger automated response if necessary
        self._trigger_automated_response(incident)

        return incident

    def _update_suspicious_ip_tracking(self, ip_address: str,
                                     violation_type: SecurityViolationType,
                                     threat_level: ThreatLevel):
        """Update suspicious IP tracking"""

        if ip_address not in self.suspicious_ips:
            self.suspicious_ips[ip_address] = {
                "first_seen": datetime.utcnow(),
                "last_seen": datetime.utcnow(),
                "violation_count": 0,
                "threat_level": 0,
                "violation_types": set()
            }

        ip_data = self.suspicious_ips[ip_address]
        ip_data["last_seen"] = datetime.utcnow()
        ip_data["violation_count"] += 1
        ip_data["violation_types"].add(violation_type.value)

        # Increase threat level based on violation severity
        threat_score_mapping = {
            ThreatLevel.INFO: 0,
            ThreatLevel.LOW: 1,
            ThreatLevel.MEDIUM: 2,
            ThreatLevel.HIGH: 4,
            ThreatLevel.CRITICAL: 8
        }

        ip_data["threat_level"] += threat_score_mapping.get(threat_level, 1)

        # Auto-block IP if threat level is too high
        if ip_data["threat_level"] >= 10:
            self.blocked_ips.add(ip_address)
            logger.critical(f"IP {ip_address} auto-blocked due to high threat level")

    def _trigger_automated_response(self, incident: SecurityIncident):
        """Trigger automated security responses"""

        response_actions = []

        # High and critical threats trigger immediate actions
        if incident.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:

            # Block source IP for injection attacks
            if incident.violation_type in [
                SecurityViolationType.INJECTION_ATTACK,
                SecurityViolationType.DATA_BREACH_ATTEMPT
            ] and incident.source_ip:
                self.blocked_ips.add(incident.source_ip)
                response_actions.append(f"Blocked IP {incident.source_ip}")

            # Lock user account for authorization violations
            if (incident.violation_type == SecurityViolationType.AUTHORIZATION_VIOLATION
                and incident.user_id):
                response_actions.append(f"User {incident.user_id} flagged for review")

            # Alert security team for critical incidents
            if incident.threat_level == ThreatLevel.CRITICAL:
                response_actions.append("Security team alerted")
                # In a real implementation, this would send actual alerts

        incident.response_actions = response_actions

        if response_actions:
            logger.warning(
                f"Automated security response triggered for incident {incident.incident_id}: "
                f"{', '.join(response_actions)}"
            )

    def get_security_headers(self) -> Dict[str, str]:
        """Get security headers for HTTP responses"""

        policy = self.policies.get("network_security")
        if policy and policy.enabled:
            base_headers = policy.rules.get("security_headers", {})

            # Environment-specific adjustments
            headers = base_headers.copy()

            if self.config.environment == "development":
                # Relax CSP for development
                headers["Content-Security-Policy"] = (
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "style-src 'self' 'unsafe-inline';"
                )
            elif self.config.environment == "production":
                # Stricter headers for production
                headers.update({
                    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "X-XSS-Protection": "1; mode=block",
                    "Referrer-Policy": "strict-origin-when-cross-origin"
                })

            return headers

        return {}

    def get_security_metrics(self) -> Dict[str, Any]:
        """Get security metrics and statistics"""

        now = datetime.utcnow()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)

        recent_incidents = [i for i in self.incidents if i.timestamp >= last_24h]
        weekly_incidents = [i for i in self.incidents if i.timestamp >= last_7d]

        return {
            "incidents": {
                "total": len(self.incidents),
                "last_24h": len(recent_incidents),
                "last_7d": len(weekly_incidents),
                "by_type": {
                    vtype.value: len([i for i in weekly_incidents if i.violation_type == vtype])
                    for vtype in SecurityViolationType
                },
                "by_threat_level": {
                    level.value: len([i for i in weekly_incidents if i.threat_level == level])
                    for level in ThreatLevel
                }
            },
            "blocked_ips": {
                "count": len(self.blocked_ips),
                "ips": list(self.blocked_ips) if len(self.blocked_ips) <= 100 else []
            },
            "suspicious_ips": {
                "count": len(self.suspicious_ips),
                "high_threat": len([ip for ip, data in self.suspicious_ips.items()
                                 if data.get("threat_level", 0) >= 5])
            },
            "policies": {
                "active": len([p for p in self.policies.values() if p.enabled]),
                "total": len(self.policies)
            },
            "last_updated": now.isoformat()
        }

    def export_security_report(self) -> Dict[str, Any]:
        """Export comprehensive security report"""

        metrics = self.get_security_metrics()

        return {
            "report_generated": datetime.utcnow().isoformat(),
            "environment": self.config.environment,
            "configuration": {
                "mfa_enabled": bool(self.config.mfa_required_roles),
                "encryption_enabled": self.config.pii_encryption_required,
                "monitoring_enabled": self.config.security_monitoring_enabled,
                "compliance": {
                    "gdpr": self.config.gdpr_compliance_enabled,
                    "hipaa": self.config.hipaa_compliance_enabled,
                    "sox": self.config.sox_compliance_enabled
                }
            },
            "metrics": metrics,
            "recent_incidents": [
                {
                    "id": incident.incident_id,
                    "timestamp": incident.timestamp.isoformat(),
                    "type": incident.violation_type.value,
                    "threat_level": incident.threat_level.value,
                    "resolved": incident.resolved,
                    "response_actions": incident.response_actions
                }
                for incident in sorted(self.incidents[-50:],
                                     key=lambda x: x.timestamp, reverse=True)
            ],
            "security_status": self._get_overall_security_status()
        }

    def _get_overall_security_status(self) -> str:
        """Get overall security status assessment"""

        recent_critical = len([
            i for i in self.incidents
            if i.timestamp >= datetime.utcnow() - timedelta(hours=24)
            and i.threat_level == ThreatLevel.CRITICAL
        ])

        if recent_critical > 0:
            return "CRITICAL"

        recent_high = len([
            i for i in self.incidents
            if i.timestamp >= datetime.utcnow() - timedelta(hours=24)
            and i.threat_level == ThreatLevel.HIGH
        ])

        if recent_high > 5:
            return "HIGH_RISK"
        elif recent_high > 0:
            return "ELEVATED"

        active_policies = len([p for p in self.policies.values() if p.enabled])
        total_policies = len(self.policies)

        if active_policies / total_policies < 0.8:
            return "DEGRADED"

        return "HEALTHY"


# Global security framework instance
_security_framework: Optional[SecurityHardeningFramework] = None


def get_security_framework() -> SecurityHardeningFramework:
    """Get global security framework instance"""
    global _security_framework

    if _security_framework is None:
        # Load configuration from environment
        config = SecurityHardeningConfig(
            environment=os.getenv("ENVIRONMENT", "development"),
            debug_mode=os.getenv("DEBUG", "false").lower() == "true",
            security_monitoring_enabled=os.getenv("SECURITY_MONITORING_ENABLED", "true").lower() == "true",
            real_time_alerts_enabled=os.getenv("REAL_TIME_ALERTS_ENABLED", "true").lower() == "true",
            gdpr_compliance_enabled=os.getenv("GDPR_COMPLIANCE_ENABLED", "true").lower() == "true"
        )

        _security_framework = SecurityHardeningFramework(config)

    return _security_framework


def reset_security_framework():
    """Reset security framework (mainly for testing)"""
    global _security_framework
    _security_framework = None