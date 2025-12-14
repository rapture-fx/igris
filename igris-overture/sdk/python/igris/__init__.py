"""
Igris Overture Python SDK

Official Python SDK for Igris Overture - Intelligent AI routing and cost optimization.

Example usage:
    from igris import Client

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

__version__ = "1.0.0-rc1"
__author__ = "Igris Overture"
__license__ = "MIT"

from .client import Client
from .exceptions import IgrisError, APIError, AuthenticationError

__all__ = [
    "Client",
    "IgrisError",
    "APIError",
    "AuthenticationError",
    "__version__",
]
