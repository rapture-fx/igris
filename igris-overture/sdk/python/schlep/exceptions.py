"""Exception classes for Schlep SDK"""


class SchlepError(Exception):
    """Base exception for Schlep SDK"""
    pass


class APIError(SchlepError):
    """API request failed"""

    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class AuthenticationError(SchlepError):
    """Authentication failed"""
    pass


class ConfigurationError(SchlepError):
    """Configuration error"""
    pass


class NetworkError(SchlepError):
    """Network connection error"""
    pass
