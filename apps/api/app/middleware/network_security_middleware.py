"""
Network Security Middleware
===========================

Comprehensive network security middleware that implements enterprise-grade
network security measures including security headers, DDoS protection,
IP filtering, and network-level threat detection.

Features:
- Security Headers (HSTS, CSP, etc.)
- DDoS Protection and Rate Limiting
- IP Allowlisting/Blocklisting
- Geolocation-based Access Control
- Network-level Threat Detection
- SSL/TLS Security Validation
- Request Origin Validation
- Network Anomaly Detection
"""

import os
import re
import json
import time
import hashlib
import ipaddress
from typing import Dict, List, Optional, Set, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
import geoip2.database
import geoip2.errors
from urllib.parse import urlparse
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
import asyncio

from app.core.security_hardening import (
    get_security_framework,
    SecurityViolationType,
    ThreatLevel,
    SecurityLevel
)

logger = logging.getLogger(__name__)


class SecurityHeaderType(Enum):
    """Security header types"""
    STRICT_TRANSPORT_SECURITY = "Strict-Transport-Security"
    CONTENT_SECURITY_POLICY = "Content-Security-Policy"
    X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options"
    X_FRAME_OPTIONS = "X-Frame-Options"
    X_XSS_PROTECTION = "X-XSS-Protection"
    REFERRER_POLICY = "Referrer-Policy"
    PERMISSIONS_POLICY = "Permissions-Policy"
    X_PERMITTED_CROSS_DOMAIN_POLICIES = "X-Permitted-Cross-Domain-Policies"
    CROSS_ORIGIN_EMBEDDER_POLICY = "Cross-Origin-Embedder-Policy"
    CROSS_ORIGIN_OPENER_POLICY = "Cross-Origin-Opener-Policy"
    CROSS_ORIGIN_RESOURCE_POLICY = "Cross-Origin-Resource-Policy"


class NetworkThreatType(Enum):
    """Network threat types"""
    DDOS_ATTACK = "ddos_attack"
    BRUTE_FORCE = "brute_force"
    SCANNING = "scanning"
    SUSPICIOUS_ORIGIN = "suspicious_origin"
    BLOCKED_COUNTRY = "blocked_country"
    TOR_EXIT_NODE = "tor_exit_node"
    PROXY_DETECTED = "proxy_detected"
    INVALID_SSL = "invalid_ssl"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"


@dataclass
class NetworkMetrics:
    """Network traffic metrics"""
    requests_per_second: float = 0.0
    bytes_per_second: float = 0.0
    unique_ips: int = 0
    suspicious_requests: int = 0
    blocked_requests: int = 0
    error_rate: float = 0.0
    average_response_time: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class IPTrafficPattern:
    """IP traffic pattern analysis"""
    ip_address: str
    request_count: int = 0
    request_times: deque = field(default_factory=lambda: deque(maxlen=1000))
    endpoints_accessed: Set[str] = field(default_factory=set)
    user_agents: Set[str] = field(default_factory=set)
    status_codes: Dict[int, int] = field(default_factory=lambda: defaultdict(int))
    bytes_transferred: int = 0
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    threat_score: int = 0
    is_blocked: bool = False
    country_code: Optional[str] = None
    is_proxy: bool = False
    is_tor: bool = False


class NetworkSecurityMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive network security middleware
    """

    def __init__(
        self,
        app: ASGIApp,
        enabled: bool = True,
        strict_mode: bool = False,
        environment: str = "development",
        # Security Headers Configuration
        enable_hsts: bool = True,
        enable_csp: bool = True,
        enable_frame_options: bool = True,
        # IP Filtering Configuration
        allowed_ips: Set[str] = None,
        blocked_ips: Set[str] = None,
        blocked_countries: Set[str] = None,
        # DDoS Protection
        enable_ddos_protection: bool = True,
        requests_per_minute_limit: int = 300,
        bytes_per_minute_limit: int = 10 * 1024 * 1024,  # 10MB
        # Network Analysis
        enable_threat_detection: bool = True,
        anomaly_detection_threshold: float = 2.0,
        # Geolocation
        geoip_database_path: Optional[str] = None,
        # SSL/TLS
        require_https: bool = None,
        # Monitoring
        enable_metrics_collection: bool = True,
        metrics_retention_minutes: int = 60
    ):
        super().__init__(app)
        self.enabled = enabled
        self.strict_mode = strict_mode
        self.environment = environment

        # Security headers configuration
        self.enable_hsts = enable_hsts and (require_https or environment == "production")
        self.enable_csp = enable_csp
        self.enable_frame_options = enable_frame_options

        # IP filtering
        self.allowed_ips = allowed_ips or set()
        self.blocked_ips = blocked_ips or set()
        self.blocked_countries = blocked_countries or set()

        # DDoS protection
        self.enable_ddos_protection = enable_ddos_protection
        self.requests_per_minute_limit = requests_per_minute_limit
        self.bytes_per_minute_limit = bytes_per_minute_limit

        # Network analysis
        self.enable_threat_detection = enable_threat_detection
        self.anomaly_detection_threshold = anomaly_detection_threshold

        # SSL/TLS requirement
        self.require_https = require_https if require_https is not None else (environment == "production")

        # Metrics and monitoring
        self.enable_metrics_collection = enable_metrics_collection
        self.metrics_retention_minutes = metrics_retention_minutes

        # Initialize components
        self.security_framework = get_security_framework()
        self.ip_patterns: Dict[str, IPTrafficPattern] = {}
        self.network_metrics = NetworkMetrics()
        self.geoip_reader = None

        # Load GeoIP database if available
        if geoip_database_path and os.path.exists(geoip_database_path):
            try:
                self.geoip_reader = geoip2.database.Reader(geoip_database_path)
                logger.info("GeoIP database loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load GeoIP database: {e}")

        # Security headers configuration
        self._setup_security_headers()

        # Start background tasks
        if self.enable_metrics_collection:
            asyncio.create_task(self._metrics_cleanup_task())

        logger.info("Network Security Middleware initialized")

    def _setup_security_headers(self):
        """Setup security headers based on environment and configuration"""

        self.security_headers = {}

        # Strict-Transport-Security (HSTS)
        if self.enable_hsts:
            if self.environment == "production":
                self.security_headers[SecurityHeaderType.STRICT_TRANSPORT_SECURITY.value] = (
                    "max-age=31536000; includeSubDomains; preload"
                )
            else:
                self.security_headers[SecurityHeaderType.STRICT_TRANSPORT_SECURITY.value] = (
                    "max-age=3600; includeSubDomains"
                )

        # Content Security Policy (CSP)
        if self.enable_csp:
            if self.environment == "production":
                csp_policy = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
                    "img-src 'self' data: https:; "
                    "font-src 'self' https://fonts.gstatic.com data:; "
                    "connect-src 'self' https:; "
                    "frame-ancestors 'none'; "
                    "base-uri 'self'; "
                    "form-action 'self'; "
                    "upgrade-insecure-requests"
                )
            else:
                # More permissive for development
                csp_policy = (
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com; "
                    "img-src 'self' data: http: https:; "
                    "font-src 'self' data: http: https:; "
                    "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https:; "
                    "frame-ancestors 'self'"
                )

            self.security_headers[SecurityHeaderType.CONTENT_SECURITY_POLICY.value] = csp_policy

        # X-Frame-Options
        if self.enable_frame_options:
            self.security_headers[SecurityHeaderType.X_FRAME_OPTIONS.value] = "DENY"

        # Other security headers
        self.security_headers.update({
            SecurityHeaderType.X_CONTENT_TYPE_OPTIONS.value: "nosniff",
            SecurityHeaderType.X_XSS_PROTECTION.value: "1; mode=block",
            SecurityHeaderType.REFERRER_POLICY.value: "strict-origin-when-cross-origin",
            SecurityHeaderType.X_PERMITTED_CROSS_DOMAIN_POLICIES.value: "none",
            SecurityHeaderType.CROSS_ORIGIN_EMBEDDER_POLICY.value: "require-corp",
            SecurityHeaderType.CROSS_ORIGIN_OPENER_POLICY.value: "same-origin",
            SecurityHeaderType.CROSS_ORIGIN_RESOURCE_POLICY.value: "same-origin"
        })

        # Permissions Policy (Feature Policy successor)
        permissions_policy = (
            "accelerometer=(), "
            "ambient-light-sensor=(), "
            "autoplay=(), "
            "battery=(), "
            "camera=(), "
            "cross-origin-isolated=(), "
            "display-capture=(), "
            "document-domain=(), "
            "encrypted-media=(), "
            "execution-while-not-rendered=(), "
            "execution-while-out-of-viewport=(), "
            "fullscreen=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "midi=(), "
            "navigation-override=(), "
            "payment=(), "
            "picture-in-picture=(), "
            "publickey-credentials-get=(), "
            "screen-wake-lock=(), "
            "sync-xhr=(), "
            "usb=(), "
            "web-share=(), "
            "xr-spatial-tracking=()"
        )
        self.security_headers[SecurityHeaderType.PERMISSIONS_POLICY.value] = permissions_policy

    async def dispatch(self, request: Request, call_next) -> Response:
        """Main middleware dispatch method"""

        if not self.enabled:
            return await call_next(request)

        start_time = time.time()
        client_ip = self._get_client_ip(request)

        try:
            # 1. HTTPS enforcement
            if self.require_https and not self._is_https_request(request):
                return await self._redirect_to_https(request)

            # 2. IP filtering and geolocation checks
            ip_check_result = await self._check_ip_security(client_ip, request)
            if not ip_check_result.allowed:
                return self._create_blocked_response(ip_check_result.reason)

            # 3. DDoS protection and rate limiting
            if self.enable_ddos_protection:
                ddos_check = await self._check_ddos_protection(client_ip, request)
                if not ddos_check.allowed:
                    return self._create_rate_limit_response(ddos_check.reason)

            # 4. Network threat detection
            if self.enable_threat_detection:
                threat_detected = await self._detect_network_threats(client_ip, request)
                if threat_detected.is_threat:
                    self._handle_threat_detection(client_ip, threat_detected, request)
                    if threat_detected.should_block:
                        return self._create_threat_response(threat_detected.threat_type)

            # 5. Update traffic patterns
            if self.enable_metrics_collection:
                await self._update_traffic_patterns(client_ip, request)

            # Process the request
            response = await call_next(request)

            # 6. Add security headers
            self._add_security_headers(response, request)

            # 7. Update metrics
            if self.enable_metrics_collection:
                await self._update_response_metrics(client_ip, response, time.time() - start_time)

            return response

        except Exception as e:
            logger.error(f"Network security middleware error: {e}", exc_info=True)

            # Record the error as a security event
            self.security_framework._record_security_incident(
                violation_type=SecurityViolationType.MALFORMED_REQUEST,
                description=f"Network security middleware error: {str(e)}",
                details={"error": str(e), "path": request.url.path},
                source_ip=client_ip,
                endpoint=request.url.path
            )

            # Continue with request processing
            response = await call_next(request)
            self._add_security_headers(response, request)
            return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP address from request"""

        # Check for trusted proxy headers in order of preference
        trusted_headers = [
            "CF-Connecting-IP",  # Cloudflare
            "True-Client-IP",    # Cloudflare Enterprise
            "X-Real-IP",         # Nginx
            "X-Forwarded-For",   # Standard proxy header
        ]

        for header in trusted_headers:
            if header in request.headers:
                ip_list = request.headers[header].split(',')
                client_ip = ip_list[0].strip()

                # Validate IP format
                if self._is_valid_ip(client_ip):
                    return client_ip

        # Fallback to direct client IP
        if request.client and request.client.host:
            return request.client.host

        return "unknown"

    def _is_valid_ip(self, ip: str) -> bool:
        """Validate IP address format"""
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    def _is_https_request(self, request: Request) -> bool:
        """Check if request is using HTTPS"""
        return (
            request.url.scheme == "https" or
            request.headers.get("x-forwarded-proto") == "https" or
            request.headers.get("x-forwarded-ssl") == "on"
        )

    async def _redirect_to_https(self, request: Request) -> Response:
        """Redirect HTTP request to HTTPS"""
        https_url = str(request.url).replace("http://", "https://", 1)

        return Response(
            status_code=status.HTTP_301_MOVED_PERMANENTLY,
            headers={"Location": https_url}
        )

    async def _check_ip_security(self, client_ip: str, request: Request) -> 'IPCheckResult':
        """Check IP security including allowlists, blocklists, and geolocation"""

        try:
            # Check if IP is in explicit blocklist
            if client_ip in self.blocked_ips:
                return IPCheckResult(False, "IP explicitly blocked")

            # Check against security framework blocked IPs
            if client_ip in self.security_framework.blocked_ips:
                return IPCheckResult(False, "IP blocked by security framework")

            # Check allowlist if configured
            if self.allowed_ips and client_ip not in self.allowed_ips:
                return IPCheckResult(False, "IP not in allowlist")

            # Geolocation check
            if self.geoip_reader and self.blocked_countries:
                try:
                    response = self.geoip_reader.country(client_ip)
                    country_code = response.country.iso_code

                    if country_code in self.blocked_countries:
                        return IPCheckResult(False, f"Country {country_code} is blocked")

                except (geoip2.errors.AddressNotFoundError, geoip2.errors.GeoIP2Error):
                    # IP not found in database - proceed with caution
                    if self.strict_mode:
                        return IPCheckResult(False, "IP geolocation unknown in strict mode")

            # Check for known proxy/VPN/Tor
            if await self._is_proxy_or_vpn(client_ip):
                if self.strict_mode:
                    return IPCheckResult(False, "Proxy/VPN detected in strict mode")
                else:
                    logger.warning(f"Proxy/VPN detected for IP {client_ip}")

            return IPCheckResult(True, "IP allowed")

        except Exception as e:
            logger.error(f"IP security check error: {e}")
            return IPCheckResult(self.strict_mode is False, "IP check error")

    async def _is_proxy_or_vpn(self, ip_address: str) -> bool:
        """Check if IP is a known proxy, VPN, or Tor exit node"""

        # This would typically query external threat intelligence APIs
        # For now, implement basic checks

        try:
            ip = ipaddress.ip_address(ip_address)

            # Check for common VPN/proxy ranges
            vpn_ranges = [
                # Add known VPN/proxy IP ranges here
                # Example: ipaddress.ip_network("192.168.0.0/16")
            ]

            for network in vpn_ranges:
                if ip in network:
                    return True

            return False

        except ValueError:
            return False

    async def _check_ddos_protection(self, client_ip: str, request: Request) -> 'DDosCheckResult':
        """Check for DDoS attacks and rate limiting"""

        now = datetime.utcnow()
        minute_ago = now - timedelta(minutes=1)

        # Get or create IP pattern
        if client_ip not in self.ip_patterns:
            self.ip_patterns[client_ip] = IPTrafficPattern(ip_address=client_ip)

        pattern = self.ip_patterns[client_ip]

        # Clean old request times
        while pattern.request_times and pattern.request_times[0] < minute_ago:
            pattern.request_times.popleft()

        # Check requests per minute
        if len(pattern.request_times) >= self.requests_per_minute_limit:
            self._log_rate_limit_violation(client_ip, "requests_per_minute", len(pattern.request_times))
            return DDosCheckResult(False, f"Rate limit exceeded: {len(pattern.request_times)} requests per minute")

        # Add current request time
        pattern.request_times.append(now)
        pattern.request_count += 1
        pattern.last_seen = now

        # Check for burst patterns (many requests in short time)
        recent_requests = [t for t in pattern.request_times if t > now - timedelta(seconds=10)]
        if len(recent_requests) > 50:  # More than 50 requests in 10 seconds
            self._log_rate_limit_violation(client_ip, "burst_detection", len(recent_requests))
            return DDosCheckResult(False, "Burst pattern detected")

        return DDosCheckResult(True, "Request allowed")

    async def _detect_network_threats(self, client_ip: str, request: Request) -> 'ThreatDetectionResult':
        """Detect network-level threats"""

        threats = []
        threat_score = 0

        # Get IP pattern
        pattern = self.ip_patterns.get(client_ip)
        if not pattern:
            return ThreatDetectionResult(False, [], 0)

        # 1. Scanning detection
        if len(pattern.endpoints_accessed) > 50 and pattern.request_count > 100:
            threats.append(NetworkThreatType.SCANNING)
            threat_score += 30

        # 2. Multiple user agents (possible bot)
        if len(pattern.user_agents) > 10:
            threats.append(NetworkThreatType.SUSPICIOUS_ORIGIN)
            threat_score += 20

        # 3. High error rate
        total_requests = sum(pattern.status_codes.values())
        if total_requests > 10:
            error_requests = sum(count for status, count in pattern.status_codes.items()
                               if status >= 400)
            error_rate = error_requests / total_requests
            if error_rate > 0.5:  # More than 50% errors
                threats.append(NetworkThreatType.BRUTE_FORCE)
                threat_score += 25

        # 4. Suspicious endpoints access pattern
        suspicious_endpoints = [
            '/admin', '/login', '/api/admin', '/.env', '/config',
            '/wp-admin', '/phpMyAdmin', '/.git', '/backup'
        ]
        suspicious_access = sum(1 for endpoint in pattern.endpoints_accessed
                              if any(sus in endpoint for sus in suspicious_endpoints))
        if suspicious_access > 5:
            threats.append(NetworkThreatType.SCANNING)
            threat_score += 40

        # 5. Time-based anomaly detection
        if self._detect_temporal_anomaly(pattern):
            threats.append(NetworkThreatType.SUSPICIOUS_ORIGIN)
            threat_score += 15

        # Update pattern threat score
        pattern.threat_score = max(pattern.threat_score, threat_score)

        is_threat = threat_score > 30
        should_block = threat_score > 60 or self.strict_mode and is_threat

        return ThreatDetectionResult(
            is_threat=is_threat,
            threats=threats,
            threat_score=threat_score,
            should_block=should_block
        )

    def _detect_temporal_anomaly(self, pattern: IPTrafficPattern) -> bool:
        """Detect temporal anomalies in request patterns"""

        if len(pattern.request_times) < 10:
            return False

        # Convert to list of timestamps
        times = [t.timestamp() for t in list(pattern.request_times)[-20:]]

        # Check for perfectly regular intervals (bot-like behavior)
        if len(times) >= 5:
            intervals = [times[i+1] - times[i] for i in range(len(times)-1)]
            avg_interval = sum(intervals) / len(intervals)

            # Check if intervals are too regular (variance is very low)
            variance = sum((interval - avg_interval) ** 2 for interval in intervals) / len(intervals)
            if variance < 0.1:  # Very regular pattern
                return True

        return False

    def _handle_threat_detection(self, client_ip: str, threat_result: 'ThreatDetectionResult', request: Request):
        """Handle detected threats"""

        # Log the threat
        threat_types = [t.value for t in threat_result.threats]

        self.security_framework._record_security_incident(
            violation_type=SecurityViolationType.SUSPICIOUS_ACTIVITY,
            description=f"Network threats detected: {', '.join(threat_types)}",
            details={
                "threats": threat_types,
                "threat_score": threat_result.threat_score,
                "should_block": threat_result.should_block,
                "path": request.url.path,
                "method": request.method
            },
            source_ip=client_ip,
            endpoint=request.url.path
        )

        # Update IP pattern
        if client_ip in self.ip_patterns:
            pattern = self.ip_patterns[client_ip]
            if threat_result.should_block:
                pattern.is_blocked = True
                self.blocked_ips.add(client_ip)

    def _log_rate_limit_violation(self, client_ip: str, violation_type: str, count: int):
        """Log rate limit violations"""

        self.security_framework._record_security_incident(
            violation_type=SecurityViolationType.RATE_LIMIT_EXCEEDED,
            description=f"Rate limit violation: {violation_type}",
            details={
                "violation_type": violation_type,
                "count": count,
                "limit": self.requests_per_minute_limit
            },
            source_ip=client_ip
        )

    async def _update_traffic_patterns(self, client_ip: str, request: Request):
        """Update traffic patterns for analysis"""

        if client_ip not in self.ip_patterns:
            self.ip_patterns[client_ip] = IPTrafficPattern(ip_address=client_ip)

        pattern = self.ip_patterns[client_ip]
        pattern.endpoints_accessed.add(request.url.path)

        user_agent = request.headers.get("user-agent", "unknown")
        pattern.user_agents.add(user_agent)

        # Geolocation lookup if available
        if self.geoip_reader and not pattern.country_code:
            try:
                response = self.geoip_reader.country(client_ip)
                pattern.country_code = response.country.iso_code
            except Exception:
                pass

    async def _update_response_metrics(self, client_ip: str, response: Response, processing_time: float):
        """Update response metrics"""

        if client_ip in self.ip_patterns:
            pattern = self.ip_patterns[client_ip]
            pattern.status_codes[response.status_code] += 1

            # Estimate response size
            content_length = response.headers.get("content-length")
            if content_length:
                pattern.bytes_transferred += int(content_length)

        # Update global metrics
        self.network_metrics.average_response_time = (
            (self.network_metrics.average_response_time * 0.9) + (processing_time * 0.1)
        )
        self.network_metrics.last_updated = datetime.utcnow()

    def _add_security_headers(self, response: Response, request: Request):
        """Add security headers to response"""

        for header_name, header_value in self.security_headers.items():
            response.headers[header_name] = header_value

        # Add custom security headers
        response.headers["X-Network-Security"] = "enabled"
        response.headers["X-Request-ID"] = getattr(request.state, "request_id", "unknown")

    def _create_blocked_response(self, reason: str) -> JSONResponse:
        """Create response for blocked requests"""

        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": "Access denied",
                "reason": reason,
                "code": "NETWORK_SECURITY_VIOLATION",
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    def _create_rate_limit_response(self, reason: str) -> JSONResponse:
        """Create response for rate-limited requests"""

        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "reason": reason,
                "code": "RATE_LIMIT_EXCEEDED",
                "timestamp": datetime.utcnow().isoformat(),
                "retry_after": 60
            },
            headers={"Retry-After": "60"}
        )

    def _create_threat_response(self, threat_type: NetworkThreatType) -> JSONResponse:
        """Create response for detected threats"""

        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": "Security threat detected",
                "threat_type": threat_type.value,
                "code": "SECURITY_THREAT_DETECTED",
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    async def _metrics_cleanup_task(self):
        """Background task to clean up old metrics"""

        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes

                cutoff_time = datetime.utcnow() - timedelta(minutes=self.metrics_retention_minutes)

                # Clean up old IP patterns
                ips_to_remove = []
                for ip, pattern in self.ip_patterns.items():
                    if pattern.last_seen < cutoff_time and not pattern.is_blocked:
                        ips_to_remove.append(ip)

                for ip in ips_to_remove:
                    del self.ip_patterns[ip]

                logger.debug(f"Cleaned up {len(ips_to_remove)} old IP patterns")

            except Exception as e:
                logger.error(f"Metrics cleanup task error: {e}")

    def get_network_metrics(self) -> Dict[str, Any]:
        """Get current network metrics"""

        active_ips = len(self.ip_patterns)
        blocked_ips = len([p for p in self.ip_patterns.values() if p.is_blocked])
        suspicious_ips = len([p for p in self.ip_patterns.values() if p.threat_score > 20])

        return {
            "active_ips": active_ips,
            "blocked_ips": blocked_ips,
            "suspicious_ips": suspicious_ips,
            "requests_per_second": self.network_metrics.requests_per_second,
            "average_response_time": self.network_metrics.average_response_time,
            "last_updated": self.network_metrics.last_updated.isoformat(),
            "security_headers_enabled": len(self.security_headers),
            "ddos_protection_enabled": self.enable_ddos_protection,
            "threat_detection_enabled": self.enable_threat_detection
        }


@dataclass
class IPCheckResult:
    """Result of IP security check"""
    allowed: bool
    reason: str


@dataclass
class DDosCheckResult:
    """Result of DDoS protection check"""
    allowed: bool
    reason: str


@dataclass
class ThreatDetectionResult:
    """Result of threat detection"""
    is_threat: bool
    threats: List[NetworkThreatType]
    threat_score: int
    should_block: bool = False