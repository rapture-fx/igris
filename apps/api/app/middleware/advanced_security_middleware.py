"""
Advanced Security Middleware
===========================

Comprehensive security middleware with threat detection, request validation,
and real-time security monitoring.
"""

import os
import time
import json
import logging
import re
import hashlib
from typing import Dict, List, Set, Optional, Any
from datetime import datetime, timedelta
from ipaddress import ip_address, ip_network

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.redis_client import get_redis_client
from app.core.secure_config import get_security_config

logger = logging.getLogger(__name__)

class SecurityThreat:
    """Security threat detection and classification"""
    
    SQL_INJECTION_PATTERNS = [
        r"(\bunion\b.*\bselect\b)",
        r"(\bselect\b.*\bfrom\b)",
        r"(\binsert\b.*\binto\b)",
        r"(\bdelete\b.*\bfrom\b)",
        r"(\bdrop\b.*\btable\b)",
        r"(\bupdate\b.*\bset\b)",
        r"(--|\#|\/\*|\*\/)",
        r"(\bexec\b|\bexecute\b)",
        r"(\bsp_\w+)",
        r"(\bxp_\w+)",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"vbscript:",
        r"onload\s*=",
        r"onerror\s*=",
        r"onclick\s*=",
        r"onmouseover\s*=",
        r"<iframe[^>]*>",
        r"<object[^>]*>",
        r"<embed[^>]*>",
    ]
    
    COMMAND_INJECTION_PATTERNS = [
        r"(\;|\||&|\$\(|\`)",
        r"(nc|netcat|wget|curl)(\s|$)",
        r"(chmod|chown|rm|kill)(\s|$)",
        r"(/bin/|/usr/bin/|/sbin/)",
        r"(sudo|su)(\s|$)",
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\.\/",
        r"\.\.\%2f",
        r"\.\.\%5c",
        r"%2e%2e%2f",
        r"%2e%2e%5c",
    ]

class AdvancedSecurityMiddleware(BaseHTTPMiddleware):
    """Advanced security middleware with comprehensive threat detection"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.redis_client = get_redis_client()
        self.security_config = get_security_config()
        
        # Security configuration
        self.max_request_size = 100 * 1024 * 1024  # 100MB
        self.max_header_size = 8192  # 8KB
        self.max_url_length = 2048
        
        # Rate limiting configuration
        self.rate_limits = {
            'default': {'requests': 100, 'window': 60},  # 100 req/min
            'auth': {'requests': 10, 'window': 60},      # 10 auth attempts/min
            'upload': {'requests': 20, 'window': 60},    # 20 uploads/min
        }
        
        # Blocked IPs and patterns
        self.blocked_ips: Set[str] = set()
        self.blocked_networks: List[ip_network] = []
        self.suspicious_user_agents = [
            'sqlmap',
            'nikto',
            'nmap',
            'w3af',
            'burp',
            'owasp zap',
            'acunetix',
        ]
        
        # Initialize security lists
        self._load_security_lists()
    
    async def dispatch(self, request: Request, call_next):
        """Main security middleware dispatch"""
        start_time = time.time()
        
        try:
            # Pre-request security checks
            security_check = await self._perform_security_checks(request)
            if security_check['blocked']:
                return self._create_security_response(security_check)
            
            # Rate limiting
            rate_limit_check = await self._check_rate_limits(request)
            if rate_limit_check['blocked']:
                return self._create_rate_limit_response(rate_limit_check)
            
            # Request validation
            validation_result = await self._validate_request(request)
            if validation_result['blocked']:
                return self._create_validation_response(validation_result)
            
            # Process request
            response = await call_next(request)
            
            # Post-request processing
            await self._log_security_event(request, response, time.time() - start_time)
            
            # Add security headers
            self._add_security_headers(response)
            
            return response
            
        except Exception as e:
            logger.error(f"Security middleware error: {e}")
            await self._log_security_error(request, str(e))
            
            # Return generic error to avoid information disclosure
            return JSONResponse(
                status_code=500,
                content={"error": "Internal security error"}
            )
    
    async def _perform_security_checks(self, request: Request) -> Dict[str, Any]:
        """Perform comprehensive security checks"""
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get('user-agent', '').lower()
        
        # Check blocked IPs
        if client_ip in self.blocked_ips:
            await self._log_security_incident(request, "blocked_ip", {"ip": client_ip})
            return {"blocked": True, "reason": "IP blocked", "code": 403}
        
        # Check blocked networks
        try:
            ip_obj = ip_address(client_ip)
            for network in self.blocked_networks:
                if ip_obj in network:
                    await self._log_security_incident(request, "blocked_network", {"ip": client_ip})
                    return {"blocked": True, "reason": "Network blocked", "code": 403}
        except ValueError:
            logger.warning(f"Invalid IP address: {client_ip}")
        
        # Check suspicious user agents
        for suspicious_ua in self.suspicious_user_agents:
            if suspicious_ua in user_agent:
                await self._log_security_incident(request, "suspicious_user_agent", {
                    "ip": client_ip, "user_agent": user_agent
                })
                return {"blocked": True, "reason": "Suspicious user agent", "code": 403}
        
        # Check for automated tools
        if self._is_automated_tool(user_agent):
            await self._log_security_incident(request, "automated_tool", {
                "ip": client_ip, "user_agent": user_agent
            })
            return {"blocked": True, "reason": "Automated tool detected", "code": 403}
        
        return {"blocked": False}
    
    async def _check_rate_limits(self, request: Request) -> Dict[str, Any]:
        """Check rate limits based on endpoint and IP"""
        client_ip = self._get_client_ip(request)
        endpoint_type = self._classify_endpoint(request.url.path)
        
        # Get rate limit configuration
        rate_config = self.rate_limits.get(endpoint_type, self.rate_limits['default'])
        
        # Redis key for rate limiting
        rate_key = f"rate_limit:{client_ip}:{endpoint_type}"
        current_time = int(time.time())
        window_key = f"{rate_key}:{current_time // rate_config['window']}"
        
        try:
            # Get current request count
            current_count = await self.redis_client.get(window_key)
            current_count = int(current_count) if current_count else 0
            
            if current_count >= rate_config['requests']:
                await self._log_security_incident(request, "rate_limit_exceeded", {
                    "ip": client_ip,
                    "endpoint_type": endpoint_type,
                    "count": current_count,
                    "limit": rate_config['requests']
                })
                return {
                    "blocked": True,
                    "reason": "Rate limit exceeded",
                    "code": 429,
                    "retry_after": rate_config['window']
                }
            
            # Increment counter
            await self.redis_client.incr(window_key)
            await self.redis_client.expire(window_key, rate_config['window'])
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
        
        return {"blocked": False}
    
    async def _validate_request(self, request: Request) -> Dict[str, Any]:
        """Validate request for security threats"""
        # URL validation
        if len(str(request.url)) > self.max_url_length:
            return {"blocked": True, "reason": "URL too long", "code": 414}
        
        # Header validation
        total_header_size = sum(len(k) + len(v) for k, v in request.headers.items())
        if total_header_size > self.max_header_size:
            return {"blocked": True, "reason": "Headers too large", "code": 431}
        
        # Content-Length validation
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > self.max_request_size:
            return {"blocked": True, "reason": "Request too large", "code": 413}
        
        # Query parameter validation
        query_params = str(request.query_params)
        threat_check = self._check_for_threats(query_params)
        if threat_check['threat_detected']:
            await self._log_security_incident(request, "query_threat", threat_check)
            return {"blocked": True, "reason": f"Threat detected: {threat_check['threat_type']}", "code": 400}
        
        # URL path validation
        path_threat_check = self._check_for_threats(request.url.path)
        if path_threat_check['threat_detected']:
            await self._log_security_incident(request, "path_threat", path_threat_check)
            return {"blocked": True, "reason": f"Path threat detected: {path_threat_check['threat_type']}", "code": 400}
        
        # Header validation for threats
        for header_name, header_value in request.headers.items():
            header_threat_check = self._check_for_threats(header_value)
            if header_threat_check['threat_detected']:
                await self._log_security_incident(request, "header_threat", {
                    **header_threat_check,
                    "header_name": header_name
                })
                return {"blocked": True, "reason": f"Header threat detected: {header_threat_check['threat_type']}", "code": 400}
        
        return {"blocked": False}
    
    def _check_for_threats(self, content: str) -> Dict[str, Any]:
        """Check content for security threats"""
        content_lower = content.lower()
        
        # SQL Injection detection
        for pattern in SecurityThreat.SQL_INJECTION_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                return {
                    "threat_detected": True,
                    "threat_type": "sql_injection",
                    "pattern": pattern,
                    "content": content[:200]  # First 200 chars for logging
                }
        
        # XSS detection
        for pattern in SecurityThreat.XSS_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                return {
                    "threat_detected": True,
                    "threat_type": "xss",
                    "pattern": pattern,
                    "content": content[:200]
                }
        
        # Command injection detection
        for pattern in SecurityThreat.COMMAND_INJECTION_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                return {
                    "threat_detected": True,
                    "threat_type": "command_injection",
                    "pattern": pattern,
                    "content": content[:200]
                }
        
        # Path traversal detection
        for pattern in SecurityThreat.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                return {
                    "threat_detected": True,
                    "threat_type": "path_traversal",
                    "pattern": pattern,
                    "content": content[:200]
                }
        
        return {"threat_detected": False}
    
    def _classify_endpoint(self, path: str) -> str:
        """Classify endpoint for rate limiting"""
        if any(auth_path in path for auth_path in ['/auth/', '/login', '/register']):
            return 'auth'
        elif any(upload_path in path for upload_path in ['/upload', '/file']):
            return 'upload'
        else:
            return 'default'
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address considering proxies"""
        # Check for forwarded headers
        forwarded_for = request.headers.get('x-forwarded-for')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('x-real-ip')
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _is_automated_tool(self, user_agent: str) -> bool:
        """Detect automated tools and bots"""
        automated_patterns = [
            r'bot|crawler|spider|scraper',
            r'curl|wget|python-requests',
            r'postman|insomnia',
            r'scan|test|probe',
        ]
        
        for pattern in automated_patterns:
            if re.search(pattern, user_agent, re.IGNORECASE):
                return True
        
        return False
    
    def _add_security_headers(self, response: Response):
        """Add security headers to response"""
        security_headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        }
        
        for header, value in security_headers.items():
            response.headers[header] = value
    
    async def _log_security_incident(self, request: Request, incident_type: str, details: Dict[str, Any]):
        """Log security incidents"""
        incident = {
            'timestamp': datetime.utcnow().isoformat(),
            'incident_type': incident_type,
            'ip': self._get_client_ip(request),
            'method': request.method,
            'path': request.url.path,
            'user_agent': request.headers.get('user-agent', ''),
            'details': details
        }
        
        logger.warning(f"Security incident: {json.dumps(incident)}")
        
        # Store in Redis for analysis
        try:
            incident_key = f"security_incident:{int(time.time())}"
            await self.redis_client.setex(incident_key, 86400, json.dumps(incident))  # Store for 24h
        except Exception as e:
            logger.error(f"Failed to store security incident: {e}")
    
    async def _log_security_event(self, request: Request, response: Response, duration: float):
        """Log security events for monitoring"""
        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'ip': self._get_client_ip(request),
            'method': request.method,
            'path': request.url.path,
            'status_code': response.status_code,
            'duration': duration,
            'user_agent': request.headers.get('user-agent', ''),
        }
        
        # Log suspicious events
        if response.status_code >= 400 or duration > 10.0:
            logger.info(f"Security event: {json.dumps(event)}")
    
    async def _log_security_error(self, request: Request, error: str):
        """Log security middleware errors"""
        error_event = {
            'timestamp': datetime.utcnow().isoformat(),
            'error': error,
            'ip': self._get_client_ip(request),
            'path': request.url.path,
        }
        
        logger.error(f"Security middleware error: {json.dumps(error_event)}")
    
    def _load_security_lists(self):
        """Load security blacklists and configurations"""
        # Load from environment or configuration
        blocked_ips_env = os.getenv('BLOCKED_IPS', '')
        if blocked_ips_env:
            self.blocked_ips.update(blocked_ips_env.split(','))
        
        # Load blocked networks
        blocked_networks_env = os.getenv('BLOCKED_NETWORKS', '')
        if blocked_networks_env:
            for network_str in blocked_networks_env.split(','):
                try:
                    self.blocked_networks.append(ip_network(network_str.strip()))
                except ValueError as e:
                    logger.warning(f"Invalid network format: {network_str}, error: {e}")
    
    def _create_security_response(self, security_check: Dict[str, Any]) -> JSONResponse:
        """Create security block response"""
        return JSONResponse(
            status_code=security_check['code'],
            content={
                "error": "Access denied",
                "reason": security_check['reason'],
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    def _create_rate_limit_response(self, rate_check: Dict[str, Any]) -> JSONResponse:
        """Create rate limit response"""
        response = JSONResponse(
            status_code=rate_check['code'],
            content={
                "error": "Rate limit exceeded",
                "reason": rate_check['reason'],
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        if 'retry_after' in rate_check:
            response.headers['Retry-After'] = str(rate_check['retry_after'])
        
        return response
    
    def _create_validation_response(self, validation_result: Dict[str, Any]) -> JSONResponse:
        """Create validation error response"""
        return JSONResponse(
            status_code=validation_result['code'],
            content={
                "error": "Request validation failed",
                "reason": validation_result['reason'],
                "timestamp": datetime.utcnow().isoformat()
            }
        )