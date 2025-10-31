"""
Schlep-engine Python SDK

Official Python SDK for Schlep-engine - Intelligent AI routing and cost optimization.

Example usage:
    from schlep import Client

    # Initialize client
    client = Client(base_url="http://localhost:8081")

    # Make inference request
    response = client.infer(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
        max_tokens=100
    )

    print(response)
"""

__version__ = "0.1.0"
__author__ = "Schlep-engine"
__license__ = "MIT"

from .client import Client
from .exceptions import SchlepError, APIError, AuthenticationError

__all__ = [
    "Client",
    "SchlepError",
    "APIError",
    "AuthenticationError",
    "__version__",
]
