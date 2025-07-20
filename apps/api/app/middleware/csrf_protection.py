"""
CSRF Protection Middleware

Implements double-submit cookie CSRF protection for API and frontend.
- Issues secure CSRF token as a cookie
- Requires token in X-CSRF-Token header for state-changing requests
- Logs all CSRF violations to the audit logger
"""

import secrets
from typing import Optional, Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from starlette.datastructures import MutableHeaders
from app.middleware.audit_middleware import audit_logger, AuditEventType, AuditSeverity
import logging

logger = logging.getLogger(__name__)

CSRF_COOKIE_NAME = "csrftoken"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_TOKEN_LENGTH = 32
CSRF_COOKIE_PATH = "/"
CSRF_COOKIE_SAMESITE = "strict"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False

class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        enabled: bool = True,
        api_only: bool = False,
        web_only: bool = False,
        exempt_paths: Optional[set] = None,
        token_length: int = CSRF_TOKEN_LENGTH,
        cookie_name: str = CSRF_COOKIE_NAME,
        header_name: str = CSRF_HEADER_NAME,
        cookie_path: str = CSRF_COOKIE_PATH,
        cookie_samesite: str = CSRF_COOKIE_SAMESITE,
        cookie_secure: bool = CSRF_COOKIE_SECURE,
        cookie_httponly: bool = CSRF_COOKIE_HTTPONLY,
    ):
        super().__init__(app)
        self.enabled = enabled
        self.api_only = api_only
        self.web_only = web_only
        self.exempt_paths = exempt_paths or set(["/health", "/metrics", "/docs", "/openapi.json"])
        self.token_length = token_length
        self.cookie_name = cookie_name
        self.header_name = header_name
        self.cookie_path = cookie_path
        self.cookie_samesite = cookie_samesite
        self.cookie_secure = cookie_secure
        self.cookie_httponly = cookie_httponly

    async def dispatch(self, request: Request, call_next: Callable):
        if not self.enabled or request.url.path in self.exempt_paths:
            return await call_next(request)

        # Only protect state-changing methods
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            # Get CSRF token from cookie and header
            cookie_token = request.cookies.get(self.cookie_name)
            header_token = request.headers.get(self.header_name)

            if not cookie_token or not header_token or cookie_token != header_token:
                await self._log_and_reject(request, reason="CSRF token missing or mismatch")

        # If no CSRF cookie, set one for GET/HEAD/OPTIONS
        response = await call_next(request)
        if request.method in {"GET", "HEAD", "OPTIONS"} and self.cookie_name not in request.cookies:
            token = self._generate_csrf_token()
            response.set_cookie(
                key=self.cookie_name,
                value=token,
                path=self.cookie_path,
                secure=self.cookie_secure,
                httponly=self.cookie_httponly,
                samesite=self.cookie_samesite
            )
            # Also expose token in response header for JS apps
            response.headers[self.header_name] = token
        return response

    def _generate_csrf_token(self) -> str:
        return secrets.token_urlsafe(self.token_length)

    async def _log_and_reject(self, request: Request, reason: str):
        await audit_logger.log_event({
            "event_type": AuditEventType.SECURITY_VIOLATION,
            "severity": AuditSeverity.CRITICAL,
            "ip_address": request.client.host if request.client else None,
            "path": request.url.path,
            "method": request.method,
            "description": f"CSRF protection triggered: {reason}",
            "metadata": {
                "reason": reason,
                "headers": dict(request.headers),
                "cookies": dict(request.cookies)
            }
        })
        logger.warning(f"CSRF protection triggered: {reason} on {request.url.path}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF protection: request rejected"
        )

# Utility to generate/refresh CSRF token (for endpoints)
def generate_csrf_token() -> str:
    return secrets.token_urlsafe(CSRF_TOKEN_LENGTH) 