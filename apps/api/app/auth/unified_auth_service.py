# This file is now a lightweight compatibility shim.
# -------------------------------------------------
# All core authentication logic lives in `app.auth.unified_service`.
# We keep this module only so that older imports continue to work
# without modification while we finish the code-cleanup effort.

from app.auth.unified_service import (
    UnifiedAuthService as _UnifiedAuthService,
    unified_auth_service as _unified_auth_service,
)
from app.auth.unified_interface import AuthResult, AuthCredentials, UserData, SecurityLevel, AuthenticationMethod, AuthError  # re-export

# Backwards-compat alias: existing code expects `unified_auth` AND `unified_auth_service`

unified_auth_service = _unified_auth_service  # noqa: N816  (keep original camelCase)
unified_auth = _unified_auth_service  # extra alias used by some modules

# Expose class so `from .. import UnifiedAuthService` still works
UnifiedAuthService = _UnifiedAuthService

__all__ = [
    "UnifiedAuthService",
    "unified_auth_service",
    "unified_auth",
    "AuthResult",
    "AuthCredentials",
    "UserData",
    "SecurityLevel",
    "AuthenticationMethod",
    "AuthError",
] 