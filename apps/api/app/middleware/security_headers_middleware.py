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
from typing import Dict, Optional, Callable, Awaitable, Set
from functools import wraps
import logging

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
                # Make headers mutable
                headers = [list(h) for h in message.get('headers', [])]
                
                if security_manager.is_feature_enabled("security_headers"):
                    # Add our security headers
                    for header, value in self.headers.items():
                        headers.append([header.encode(), value.encode()])

                message['headers'] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


# This is the object that should be imported in __init__.py
security_headers_manager = SecurityHeadersMiddleware

# --- Add the missing exports that __init__.py requires ---

logger = logging.getLogger(__name__)

class CSPDirective:
    DEFAULT_SRC = "default-src"
    SCRIPT_SRC = "script-src"
    STYLE_SRC = "style-src"
    IMG_SRC = "img-src"
    CONNECT_SRC = "connect-src"
    FONT_SRC = "font-src"
    OBJECT_SRC = "object-src"
    MEDIA_SRC = "media-src"
    FRAME_SRC = "frame-src"

class SecurityLevel:
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    PARANOID = "paranoid"

class SecurityHeadersConfig:
    def __init__(self, level: str = SecurityLevel.HIGH, custom_csp: Optional[Dict[str, Set[str]]] = None):
        self.level = level
        self.custom_csp = custom_csp or {}

DEFAULT_CSP = {
    CSPDirective.DEFAULT_SRC: {"'self'"},
    CSPDirective.SCRIPT_SRC: {"'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"},
    CSPDirective.STYLE_SRC: {"'self'", "'unsafe-inline'", "https://fonts.googleapis.com"},
    CSPDirective.IMG_SRC: {"'self'", "data:"},
    CSPDirective.FONT_SRC: {"'self'", "https://fonts.gstatic.com"},
    CSPDirective.CONNECT_SRC: {"'self'"},
}

def _generate_csp_string(csp: Dict[str, Set[str]]) -> str:
    return "; ".join([f"{directive} {' '.join(sorted(list(sources)))}" for directive, sources in csp.items()])

def security_headers(
    level: str = SecurityLevel.MEDIUM, 
    custom_headers: Optional[Dict[str, str]] = None, 
    csp_config: Optional[Dict[str, Set[str]]] = None
):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            response = await func(*args, **kwargs)
            
            headers = {}
            if level in [SecurityLevel.MEDIUM, SecurityLevel.HIGH, SecurityLevel.PARANOID]:
                headers.update({
                    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                })

            final_csp = DEFAULT_CSP.copy()
            if csp_config:
                for directive, sources in csp_config.items():
                    if directive in final_csp:
                        final_csp[directive].update(sources)
                    else:
                        final_csp[directive] = sources
            
            headers["Content-Security-Policy"] = _generate_csp_string(final_csp)

            if custom_headers:
                headers.update(custom_headers)
            
            if hasattr(response, "headers"):
                 for key, value in headers.items():
                    response.headers[key] = value
            
            return response
        return wrapper
    return decorator

# Re-exporting for __init__.py
SecureCORSConfig = dict
strict_security_headers = security_headers
admin_security_headers = security_headers
api_security_headers = security_headers
public_security_headers = security_headers 