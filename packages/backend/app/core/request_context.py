from contextvars import ContextVar
from typing import Optional, Dict, Any

# Context variables for holding request-specific data
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id_var", default=None)
ip_address_var: ContextVar[Optional[str]] = ContextVar("ip_address_var", default=None)
user_agent_var: ContextVar[Optional[str]] = ContextVar("user_agent_var", default=None)
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id_var", default=None)

def get_request_context() -> Dict[str, Any]:
    """Returns the current request context as a dictionary."""
    return {
        "user_id": user_id_var.get(),
        "ip_address": ip_address_var.get(),
        "user_agent": user_agent_var.get(),
        "request_id": request_id_var.get(),
    } 