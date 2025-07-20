from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from jose import JWTError, jwt
import logging

from app.core.request_context import user_id_var, ip_address_var, user_agent_var, request_id_var
from app.core.config import settings

logger = logging.getLogger(__name__)

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Set context variables from request headers
        ip_address_var.set(request.client.host if request.client else "unknown")
        user_agent_var.set(request.headers.get("user-agent", "N/A"))
        
        # Attempt to get user_id from JWT in Authorization header
        user_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
                user_id = payload.get("sub")
            except JWTError:
                # Invalid token, user_id remains None
                pass
        user_id_var.set(user_id)
        
        # You can also get request_id if you have a middleware that sets it
        # For now, let's assume it's in the headers or we generate one
        request_id_var.set(request.headers.get("X-Request-ID", "N/A"))

        response = await call_next(request)
        return response 