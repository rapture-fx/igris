"""Exception classes for Igris SDK"""


class IgrisError(Exception):
    """Base exception for Igris SDK"""
    pass


class APIError(IgrisError):
    """API request failed"""

    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class AuthenticationError(IgrisError):
    """Authentication failed"""
    pass


class ConfigurationError(IgrisError):
    """Configuration error"""
    pass


class NetworkError(IgrisError):
    """Network connection error"""
    pass
