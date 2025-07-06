"""
Middleware for adding security-related HTTP headers to every response.

This middleware helps to protect against common web vulnerabilities by setting
headers like:
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Content-Security-Policy (optional, can be configured)
"""

from starlette.requests import Request
from starlette.responses import Response
from typing import Dict, Optional, Callable, Awaitable

from app.core.security_config import security_manager

class SecurityHeadersMiddleware:
    """
    Adds security headers to HTTP responses.
    """
    def __init__(self, app, headers: Optional[Dict[str, str]] = None):
        self.app = app
        self.headers = headers or {
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block", # Deprecated but still good for older browsers
        }

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message['type'] == 'http.response.start':
                headers = message.get('headers', [])
                if security_manager.is_feature_enabled("security_headers"):
                    for header, value in self.headers.items():
                        headers.append((header.encode(), value.encode()))
            await send(message)

        await self.app(scope, receive, send_wrapper)


# This is the object that should be imported in __init__.py
security_headers_manager = SecurityHeadersMiddleware 