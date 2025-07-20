"""
Request Validation & Sanitization Middleware

Validates and sanitizes all incoming API requests to prevent XSS, SQLi, NoSQLi, and header injection attacks.
Logs all validation failures to the audit logger.
"""

import re
import json
from typing import Any, Dict, Set, Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.middleware.audit_middleware import audit_logger, AuditEventType, AuditSeverity
import logging

logger = logging.getLogger(__name__)

# Common attack patterns
DANGEROUS_PATTERNS = [
    re.compile(r'<script.*?>', re.IGNORECASE),  # XSS
    re.compile(r'(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bALTER\b)', re.IGNORECASE),  # SQLi
    re.compile(r'\$\w+'),  # NoSQLi ($where, $gt, etc.)
    re.compile(r'\{\$.*?\}'),  # NoSQLi
    re.compile(r'\bOR\b\s+1=1', re.IGNORECASE),
    re.compile(r'\bAND\b\s+1=1', re.IGNORECASE),
    re.compile(r'\bjavascript:', re.IGNORECASE),
    re.compile(r'\bdata:text\/html', re.IGNORECASE),
    re.compile(r'\bset-cookie:', re.IGNORECASE),
    re.compile(r'\bcontent-type:', re.IGNORECASE),
]

# Sanitization rules
SANITIZE_REPLACEMENTS = [
    (re.compile(r'<script.*?>', re.IGNORECASE), ''),
    (re.compile(r'</script>', re.IGNORECASE), ''),
    (re.compile(r'javascript:', re.IGNORECASE), ''),
    (re.compile(r'\$\w+'), ''),
    (re.compile(r'\{\$.*?\}'), ''),
]

class RequestValidationSanitizationMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool = True, dangerous_patterns=None, sanitize_replacements=None):
        super().__init__(app)
        self.enabled = enabled
        self.dangerous_patterns = dangerous_patterns or DANGEROUS_PATTERNS
        self.sanitize_replacements = sanitize_replacements or SANITIZE_REPLACEMENTS

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        # Validate and sanitize query params
        for key, value in request.query_params.items():
            if self._contains_dangerous_pattern(value):
                await self._log_and_reject(request, key, value, 'query_param')
            request._query_params = request._query_params.copy()
            request._query_params[key] = self._sanitize(value)

        # Validate and sanitize headers
        for key, value in request.headers.items():
            if self._contains_dangerous_pattern(value):
                await self._log_and_reject(request, key, value, 'header')

        # Validate and sanitize body (JSON or form)
        if request.method in {"POST", "PUT", "PATCH"}:
            try:
                body = await request.body()
                if body:
                    try:
                        data = json.loads(body)
                        sanitized = self._sanitize_data(data)
                        if self._contains_dangerous_pattern_in_data(sanitized):
                            await self._log_and_reject(request, None, sanitized, 'body')
                        # Replace request._body for downstream
                        request._body = json.dumps(sanitized).encode()
                    except Exception:
                        # Not JSON, try as form
                        pass
            except Exception:
                pass

        return await call_next(request)

    def _contains_dangerous_pattern(self, value: str) -> bool:
        if not isinstance(value, str):
            return False
        for pattern in self.dangerous_patterns:
            if pattern.search(value):
                return True
        return False

    def _contains_dangerous_pattern_in_data(self, data: Any) -> bool:
        if isinstance(data, dict):
            return any(self._contains_dangerous_pattern_in_data(v) for v in data.values())
        elif isinstance(data, list):
            return any(self._contains_dangerous_pattern_in_data(v) for v in data)
        elif isinstance(data, str):
            return self._contains_dangerous_pattern(data)
        return False

    def _sanitize(self, value: str) -> str:
        if not isinstance(value, str):
            return value
        sanitized = value
        for pattern, replacement in self.sanitize_replacements:
            sanitized = pattern.sub(replacement, sanitized)
        return sanitized

    def _sanitize_data(self, data: Any) -> Any:
        if isinstance(data, dict):
            return {k: self._sanitize_data(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_data(v) for v in data]
        elif isinstance(data, str):
            return self._sanitize(data)
        return data

    async def _log_and_reject(self, request: Request, key: str, value: Any, location: str):
        # Log to audit logger
        await audit_logger.log_event({
            "event_type": AuditEventType.SECURITY_VIOLATION,
            "severity": AuditSeverity.HIGH,
            "ip_address": request.client.host if request.client else None,
            "path": request.url.path,
            "method": request.method,
            "description": f"Dangerous input detected in {location}: {key}",
            "metadata": {
                "key": key,
                "value": str(value)[:200],
                "location": location
            }
        })
        logger.warning(f"Blocked dangerous input in {location}: {key}={value}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dangerous input detected in {location}: {key}"
        ) 