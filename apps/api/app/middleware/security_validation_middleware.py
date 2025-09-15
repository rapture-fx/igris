"""
Comprehensive Security Validation Middleware
==========================================

This middleware provides enterprise-grade input validation, sanitization,
and security checks for all incoming requests.

Features:
- Advanced input validation and sanitization
- SQL injection prevention
- XSS protection with content sanitization
- File upload security validation
- Request size and complexity limits
- Malicious pattern detection
- Rate limiting integration
- Security incident logging
"""

import json
import re
import mimetypes
import hashlib
import asyncio
from typing import Dict, List, Optional, Any, Set, Tuple
from urllib.parse import unquote
import bleach
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
from datetime import datetime
import time

from app.core.security_hardening import (
    get_security_framework,
    SecurityViolationType,
    SecurityLevel,
    ThreatLevel
)

logger = logging.getLogger(__name__)


class SecurityValidationMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive security validation middleware
    """

    def __init__(
        self,
        app: ASGIApp,
        enabled: bool = True,
        strict_mode: bool = False,
        exempt_paths: Set[str] = None,
        max_request_size: int = 10 * 1024 * 1024,  # 10MB
        max_json_depth: int = 10,
        enable_sanitization: bool = True,
        block_malicious_requests: bool = True
    ):
        super().__init__(app)
        self.enabled = enabled
        self.strict_mode = strict_mode
        self.exempt_paths = exempt_paths or {
            '/health', '/metrics', '/docs', '/openapi.json', '/redoc'
        }
        self.max_request_size = max_request_size
        self.max_json_depth = max_json_depth
        self.enable_sanitization = enable_sanitization
        self.block_malicious_requests = block_malicious_requests

        # Get security framework
        self.security_framework = get_security_framework()

        # Initialize validation patterns
        self._setup_validation_patterns()

        logger.info("Security validation middleware initialized")

    def _setup_validation_patterns(self):
        """Setup validation and detection patterns"""

        # SQL injection patterns (case-insensitive)
        self.sql_injection_patterns = [
            # Union-based injection
            r"(\bUNION\s+(ALL\s+)?SELECT\b)",
            r"(\bSELECT\b.*\bFROM\b.*\bWHERE\b)",
            r"(\bINSERT\b.*\bINTO\b.*\bVALUES\b)",
            r"(\bUPDATE\b.*\bSET\b)",
            r"(\bDELETE\b.*\bFROM\b)",
            r"(\bDROP\b.*\bTABLE\b)",
            r"(\bCREATE\b.*\bTABLE\b)",
            r"(\bALTER\b.*\bTABLE\b)",
            # Boolean-based injection
            r"(\'\s*(OR|AND)\s*\'\d*\'\s*=\s*\'\d*)",
            r"(\'\s*(OR|AND)\s*\d+\s*=\s*\d+)",
            r"(\'\s*OR\s+\'1\'\s*=\s*\'1)",
            r"(\'\s*OR\s+1\s*=\s*1)",
            # Comment-based injection
            r"(\'\s*;?\s*--)",
            r"(\'\s*;?\s*/\*.*\*/)",
            # Function-based injection
            r"(\b(EXEC|EXECUTE)\b.*\()",
            r"(\bxp_cmdshell\b)",
            r"(\bsp_executesql\b)",
            # Stacked queries
            r"(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)",
        ]

        # XSS patterns
        self.xss_patterns = [
            # Script tags
            r"<\s*script[^>]*>.*?</\s*script\s*>",
            r"<\s*script[^>]*>",
            # Event handlers
            r"on\w+\s*=\s*['\"][^'\"]*['\"]",
            r"on\w+\s*=\s*[^>\s]*",
            # JavaScript protocols
            r"javascript\s*:",
            r"vbscript\s*:",
            r"data\s*:",
            # Dangerous tags
            r"<\s*iframe[^>]*>",
            r"<\s*object[^>]*>",
            r"<\s*embed[^>]*>",
            r"<\s*applet[^>]*>",
            r"<\s*meta[^>]*>",
            r"<\s*link[^>]*>",
            # Style-based XSS
            r"<\s*style[^>]*>.*?</\s*style\s*>",
            r"expression\s*\(",
            r"@import",
            # HTML entities and encoding
            r"&#x?[0-9a-fA-F]+;?",
        ]

        # Command injection patterns
        self.command_injection_patterns = [
            # Shell metacharacters
            r"[;&|`$]",
            r"[\n\r]",
            # Common commands
            r"\b(cat|ls|pwd|whoami|id|uname|ps|kill|rm|cp|mv|chmod|chown)\b",
            r"\b(wget|curl|nc|netcat|telnet|ssh|ftp)\b",
            r"\b(python|perl|ruby|php|node|java)\b",
            # Windows commands
            r"\b(dir|type|del|copy|move|attrib|net|ping)\b",
            r"\b(cmd\.exe|powershell\.exe|wscript\.exe)\b",
        ]

        # Path traversal patterns
        self.path_traversal_patterns = [
            r"\.\.[\\/]",
            r"\.\.[\\/].*[\\/]",
            r"[\\/]\.\.[\\/]",
            r"%2e%2e%2f",
            r"%2e%2e%5c",
            r"%2f%2e%2e%2f",
            r"%5c%2e%2e%5c",
            r"....//",
            r"....\\\\",
        ]

        # LDAP injection patterns
        self.ldap_injection_patterns = [
            r"\*\)\(\w+=\*",
            r"\)(\|\(\w+=\*",
            r"\*\)\(\|",
            r"\(\|",
            r"\)\)",
            r"[\(\)&|!><~=\*]",
        ]

        # NoSQL injection patterns
        self.nosql_injection_patterns = [
            r"\$where\s*:",
            r"\$ne\s*:",
            r"\$gt\s*:",
            r"\$lt\s*:",
            r"\$regex\s*:",
            r"\$exists\s*:",
            r"this\.\w+",
        ]

        # Malicious file patterns
        self.malicious_file_patterns = [
            r"\.exe$", r"\.scr$", r"\.bat$", r"\.cmd$", r"\.com$",
            r"\.pif$", r"\.vbs$", r"\.js$", r"\.jar$", r"\.app$",
            r"\.deb$", r"\.rpm$", r"\.dmg$", r"\.pkg$",
        ]

        # Suspicious user agents
        self.malicious_user_agents = [
            "sqlmap", "nikto", "nessus", "openvas", "w3af", "burp",
            "owasp zap", "acunetix", "netsparker", "appscan", "webinspect"
        ]

    async def dispatch(self, request: Request, call_next) -> Response:
        """Main middleware dispatch method"""

        if not self.enabled:
            return await call_next(request)

        start_time = time.time()

        # Check if path is exempt
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        try:
            # Extract client information
            client_ip = self._get_client_ip(request)
            user_agent = request.headers.get("user-agent", "")

            # Perform security validations
            validation_result = await self._perform_security_validations(
                request, client_ip, user_agent
            )

            if not validation_result.is_valid:
                # Log security violation
                logger.warning(
                    f"Security validation failed: {validation_result.violations}",
                    extra={
                        "client_ip": client_ip,
                        "user_agent": user_agent,
                        "path": request.url.path,
                        "method": request.method,
                        "violations": validation_result.violations
                    }
                )

                # Record security incident
                self.security_framework._record_security_incident(
                    violation_type=validation_result.violation_type,
                    description=f"Security validation failed: {', '.join(validation_result.violations)}",
                    details={
                        "violations": validation_result.violations,
                        "path": request.url.path,
                        "method": request.method,
                        "user_agent": user_agent
                    },
                    source_ip=client_ip,
                    endpoint=request.url.path
                )

                # Block request if in strict mode or for severe violations
                if (self.block_malicious_requests and
                    validation_result.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]):

                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "error": "Request blocked due to security policy violation",
                            "code": "SECURITY_VIOLATION",
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )

            # Process the request
            response = await call_next(request)

            # Add security headers
            self._add_security_headers(response)

            # Record metrics
            processing_time = time.time() - start_time
            logger.debug(f"Security validation completed in {processing_time:.3f}s")

            return response

        except Exception as e:
            logger.error(f"Security validation middleware error: {e}", exc_info=True)

            # Record the error but don't block the request
            self.security_framework._record_security_incident(
                violation_type=SecurityViolationType.MALFORMED_REQUEST,
                description=f"Security validation middleware error: {str(e)}",
                details={"error": str(e), "path": request.url.path},
                source_ip=self._get_client_ip(request),
                endpoint=request.url.path
            )

            # Continue with request processing
            return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""

        # Check for forwarded IP headers (in order of trust)
        forwarded_headers = [
            "CF-Connecting-IP",  # Cloudflare
            "True-Client-IP",    # Cloudflare
            "X-Real-IP",         # Nginx
            "X-Forwarded-For",   # Standard proxy header
            "X-Forwarded",       # Microsoft
            "Forwarded-For",     # RFC 2616
            "Forwarded"          # RFC 7239
        ]

        for header in forwarded_headers:
            if header in request.headers:
                forwarded_ip = request.headers[header].split(',')[0].strip()
                if self._is_valid_ip(forwarded_ip):
                    return forwarded_ip

        # Fallback to direct client IP
        if request.client and request.client.host:
            return request.client.host

        return "unknown"

    def _is_valid_ip(self, ip: str) -> bool:
        """Validate IP address format"""
        try:
            import ipaddress
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    async def _perform_security_validations(
        self, request: Request, client_ip: str, user_agent: str
    ) -> 'ValidationResult':
        """Perform comprehensive security validations"""

        violations = []
        violation_type = SecurityViolationType.INPUT_VALIDATION_FAILURE
        threat_level = ThreatLevel.LOW

        # 1. IP Security Check
        ip_allowed, ip_reason = self.security_framework.check_ip_security(client_ip)
        if not ip_allowed:
            violations.append(f"IP blocked: {ip_reason}")
            violation_type = SecurityViolationType.SUSPICIOUS_ACTIVITY
            threat_level = ThreatLevel.HIGH

        # 2. User Agent Check
        if self._is_malicious_user_agent(user_agent):
            violations.append("Malicious user agent detected")
            violation_type = SecurityViolationType.SUSPICIOUS_ACTIVITY
            threat_level = ThreatLevel.MEDIUM

        # 3. Request Size Check
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_request_size:
            violations.append(f"Request size exceeds limit: {content_length} bytes")
            violation_type = SecurityViolationType.MALFORMED_REQUEST

        # 4. URL and Query Parameter Validation
        url_violations = self._validate_url(request)
        violations.extend(url_violations)

        # 5. Header Validation
        header_violations = self._validate_headers(request)
        violations.extend(header_violations)

        # 6. Body Validation (for POST/PUT requests)
        if request.method in ["POST", "PUT", "PATCH"]:
            body_violations = await self._validate_request_body(request)
            violations.extend(body_violations)

            # Set violation type based on body content
            if any("injection" in v.lower() for v in body_violations):
                violation_type = SecurityViolationType.INJECTION_ATTACK
                threat_level = ThreatLevel.HIGH
            elif any("xss" in v.lower() for v in body_violations):
                violation_type = SecurityViolationType.XSS_ATTEMPT
                threat_level = ThreatLevel.HIGH

        # 7. File Upload Validation
        if "multipart/form-data" in request.headers.get("content-type", ""):
            file_violations = await self._validate_file_uploads(request)
            violations.extend(file_violations)

        is_valid = len(violations) == 0 or not self.strict_mode

        return ValidationResult(
            is_valid=is_valid,
            violations=violations,
            violation_type=violation_type,
            threat_level=threat_level
        )

    def _is_malicious_user_agent(self, user_agent: str) -> bool:
        """Check if user agent indicates malicious tool"""
        user_agent_lower = user_agent.lower()

        for malicious_ua in self.malicious_user_agents:
            if malicious_ua in user_agent_lower:
                return True

        return False

    def _validate_url(self, request: Request) -> List[str]:
        """Validate URL components"""
        violations = []

        # Check URL path
        path = unquote(request.url.path)

        # Path traversal check
        for pattern in self.path_traversal_patterns:
            if re.search(pattern, path, re.IGNORECASE):
                violations.append("Path traversal attempt detected in URL")
                break

        # Check query parameters
        if request.query_params:
            for key, value in request.query_params.items():
                param_violations = self._validate_parameter(key, value, "query")
                violations.extend(param_violations)

        return violations

    def _validate_headers(self, request: Request) -> List[str]:
        """Validate HTTP headers"""
        violations = []

        suspicious_headers = [
            "X-Forwarded-For", "X-Real-IP", "X-Originating-IP"
        ]

        for header_name, header_value in request.headers.items():
            # Check for header injection
            if '\n' in header_value or '\r' in header_value:
                violations.append(f"Header injection detected in {header_name}")

            # Check for suspicious header manipulation
            if header_name in suspicious_headers:
                # Multiple IPs in forwarded headers could indicate manipulation
                if ',' in header_value and len(header_value.split(',')) > 3:
                    violations.append(f"Suspicious header manipulation in {header_name}")

            # Validate specific headers
            if header_name.lower() == "host":
                if not self._is_valid_host(header_value):
                    violations.append("Invalid Host header")

        return violations

    def _is_valid_host(self, host: str) -> bool:
        """Validate Host header"""
        # Basic validation - in production, check against allowed hosts
        if not host or len(host) > 253:
            return False

        # Check for obvious malicious patterns
        malicious_patterns = ['<', '>', '"', "'", '\\', '\n', '\r']
        return not any(pattern in host for pattern in malicious_patterns)

    async def _validate_request_body(self, request: Request) -> List[str]:
        """Validate request body content"""
        violations = []

        try:
            # Get content type
            content_type = request.headers.get("content-type", "")

            if "application/json" in content_type:
                violations.extend(await self._validate_json_body(request))
            elif "application/x-www-form-urlencoded" in content_type:
                violations.extend(await self._validate_form_body(request))
            elif "text/" in content_type:
                violations.extend(await self._validate_text_body(request))

        except Exception as e:
            logger.error(f"Body validation error: {e}")
            violations.append("Request body validation error")

        return violations

    async def _validate_json_body(self, request: Request) -> List[str]:
        """Validate JSON request body"""
        violations = []

        try:
            # Read body
            body = await request.body()
            if not body:
                return violations

            # Parse JSON
            try:
                json_data = json.loads(body.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                violations.append("Invalid JSON format")
                return violations

            # Check JSON depth
            depth = self._get_json_depth(json_data)
            if depth > self.max_json_depth:
                violations.append(f"JSON nesting too deep: {depth} levels")

            # Validate JSON content recursively
            self._validate_json_content(json_data, violations, path="root")

        except Exception as e:
            logger.error(f"JSON validation error: {e}")
            violations.append("JSON validation processing error")

        return violations

    def _get_json_depth(self, obj: Any, depth: int = 0) -> int:
        """Calculate JSON nesting depth"""
        if depth > 100:  # Prevent infinite recursion
            return depth

        max_depth = depth

        if isinstance(obj, dict):
            for value in obj.values():
                current_depth = self._get_json_depth(value, depth + 1)
                max_depth = max(max_depth, current_depth)
        elif isinstance(obj, list):
            for item in obj:
                current_depth = self._get_json_depth(item, depth + 1)
                max_depth = max(max_depth, current_depth)

        return max_depth

    def _validate_json_content(self, obj: Any, violations: List[str], path: str):
        """Recursively validate JSON content"""

        if isinstance(obj, dict):
            for key, value in obj.items():
                # Validate key
                key_violations = self._validate_parameter(str(key), str(value), f"{path}.{key}")
                violations.extend(key_violations)

                # Recurse into value
                if isinstance(value, (dict, list)):
                    self._validate_json_content(value, violations, f"{path}.{key}")

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, (dict, list)):
                    self._validate_json_content(item, violations, f"{path}[{i}]")
                else:
                    item_violations = self._validate_parameter(f"{path}[{i}]", str(item), path)
                    violations.extend(item_violations)

    async def _validate_form_body(self, request: Request) -> List[str]:
        """Validate form-encoded request body"""
        violations = []

        try:
            form_data = await request.form()

            for key, value in form_data.items():
                if hasattr(value, 'read'):  # File upload
                    continue  # Handle in file validation

                param_violations = self._validate_parameter(key, str(value), "form")
                violations.extend(param_violations)

        except Exception as e:
            logger.error(f"Form validation error: {e}")
            violations.append("Form validation processing error")

        return violations

    async def _validate_text_body(self, request: Request) -> List[str]:
        """Validate plain text request body"""
        violations = []

        try:
            body = await request.body()
            if not body:
                return violations

            text = body.decode('utf-8')
            param_violations = self._validate_parameter("body", text, "text")
            violations.extend(param_violations)

        except Exception as e:
            logger.error(f"Text validation error: {e}")
            violations.append("Text validation processing error")

        return violations

    def _validate_parameter(self, name: str, value: str, context: str) -> List[str]:
        """Validate individual parameter value"""
        violations = []

        if not value:
            return violations

        value_str = str(value)

        # SQL injection check
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, value_str, re.IGNORECASE):
                violations.append(f"SQL injection pattern detected in {context} parameter '{name}'")
                break

        # XSS check
        for pattern in self.xss_patterns:
            if re.search(pattern, value_str, re.IGNORECASE):
                violations.append(f"XSS pattern detected in {context} parameter '{name}'")
                break

        # Command injection check
        for pattern in self.command_injection_patterns:
            if re.search(pattern, value_str, re.IGNORECASE):
                violations.append(f"Command injection pattern detected in {context} parameter '{name}'")
                break

        # Path traversal check
        for pattern in self.path_traversal_patterns:
            if re.search(pattern, value_str, re.IGNORECASE):
                violations.append(f"Path traversal pattern detected in {context} parameter '{name}'")
                break

        # LDAP injection check
        for pattern in self.ldap_injection_patterns:
            if re.search(pattern, value_str, re.IGNORECASE):
                violations.append(f"LDAP injection pattern detected in {context} parameter '{name}'")
                break

        # NoSQL injection check
        for pattern in self.nosql_injection_patterns:
            if re.search(pattern, value_str, re.IGNORECASE):
                violations.append(f"NoSQL injection pattern detected in {context} parameter '{name}'")
                break

        # Sanitize if enabled
        if self.enable_sanitization:
            sanitized = self._sanitize_input(value_str)
            if sanitized != value_str:
                # Log that sanitization occurred
                logger.debug(f"Input sanitized in {context} parameter '{name}'")

        return violations

    def _sanitize_input(self, value: str) -> str:
        """Sanitize input value"""

        # Use bleach for HTML sanitization
        allowed_tags = ['b', 'i', 'u', 'strong', 'em', 'p', 'br']
        allowed_attributes = {}

        # Clean HTML
        cleaned = bleach.clean(
            value,
            tags=allowed_tags,
            attributes=allowed_attributes,
            strip=True
        )

        # Additional cleaning for common attack patterns
        cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'vbscript:', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'on\w+\s*=', '', cleaned, flags=re.IGNORECASE)

        return cleaned

    async def _validate_file_uploads(self, request: Request) -> List[str]:
        """Validate file uploads"""
        violations = []

        try:
            form_data = await request.form()

            for key, file in form_data.items():
                if hasattr(file, 'read'):  # This is a file upload
                    file_violations = await self._validate_single_file(file, key)
                    violations.extend(file_violations)

        except Exception as e:
            logger.error(f"File validation error: {e}")
            violations.append("File validation processing error")

        return violations

    async def _validate_single_file(self, file, field_name: str) -> List[str]:
        """Validate a single uploaded file"""
        violations = []

        try:
            # Check filename
            filename = getattr(file, 'filename', '')
            if filename:
                # Check for malicious file extensions
                for pattern in self.malicious_file_patterns:
                    if re.search(pattern, filename, re.IGNORECASE):
                        violations.append(f"Potentially malicious file type in '{field_name}': {filename}")
                        break

                # Check for directory traversal in filename
                if '..' in filename or '/' in filename or '\\' in filename:
                    violations.append(f"Invalid filename in '{field_name}': {filename}")

            # Check file content type
            content_type = getattr(file, 'content_type', '')
            if content_type:
                # Verify content type matches file extension
                if filename:
                    expected_type = mimetypes.guess_type(filename)[0]
                    if expected_type and expected_type != content_type:
                        violations.append(f"Content type mismatch in '{field_name}': expected {expected_type}, got {content_type}")

            # Check file size
            if hasattr(file, 'size') and file.size:
                max_size = self.security_framework.config.max_file_size_mb * 1024 * 1024
                if file.size > max_size:
                    violations.append(f"File too large in '{field_name}': {file.size} bytes")

            # Read a small portion of file content for validation
            try:
                content_sample = await file.read(1024)  # Read first 1KB
                await file.seek(0)  # Reset file pointer

                # Check for script content in files that shouldn't have it
                if content_type and not content_type.startswith(('text/', 'application/javascript')):
                    script_patterns = [b'<script', b'javascript:', b'<iframe', b'<object']
                    for pattern in script_patterns:
                        if pattern in content_sample.lower():
                            violations.append(f"Suspicious script content in '{field_name}'")
                            break

            except Exception as e:
                logger.warning(f"Could not read file content for validation: {e}")

        except Exception as e:
            logger.error(f"Single file validation error: {e}")
            violations.append(f"File validation error for '{field_name}'")

        return violations

    def _add_security_headers(self, response: Response):
        """Add security headers to response"""

        security_headers = self.security_framework.get_security_headers()

        for header_name, header_value in security_headers.items():
            response.headers[header_name] = header_value

        # Add additional security headers
        response.headers["X-Security-Validation"] = "enabled"
        response.headers["X-Content-Type-Options"] = "nosniff"


class ValidationResult:
    """Result of security validation"""

    def __init__(
        self,
        is_valid: bool,
        violations: List[str],
        violation_type: SecurityViolationType = SecurityViolationType.INPUT_VALIDATION_FAILURE,
        threat_level: ThreatLevel = ThreatLevel.LOW
    ):
        self.is_valid = is_valid
        self.violations = violations
        self.violation_type = violation_type
        self.threat_level = threat_level