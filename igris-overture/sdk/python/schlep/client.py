"""Schlep-engine Python SDK Client"""

import json
from typing import Dict, List, Optional, Any
import requests

from .exceptions import APIError, AuthenticationError, NetworkError


class Client:
    """
    Schlep-engine client for intelligent AI routing and cost optimization.

    Args:
        base_url: Base URL of the Schlep-engine API (default: http://localhost:8081)
        api_key: Optional API key for authentication
        timeout: Request timeout in seconds (default: 30)

    Example:
        >>> from schlep import Client
        >>> client = Client(base_url="http://localhost:8081")
        >>> response = client.infer(
        ...     model="gpt-4",
        ...     messages=[{"role": "user", "content": "Hello!"}]
        ... )
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8081",
        api_key: Optional[str] = None,
        timeout: int = 30
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._session = requests.Session()

        # Set default headers
        self._session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "schlep-python-sdk/0.1.0",
        })

        # Add authentication header if API key provided
        if self.api_key:
            self._session.headers.update({
                "Authorization": f"Bearer {self.api_key}"
            })

    def _make_request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to the API"""
        url = f"{self.base_url}{endpoint}"

        try:
            response = self._session.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                timeout=self.timeout
            )

            # Check for HTTP errors
            if response.status_code == 401:
                raise AuthenticationError("Authentication failed. Check your API key.")

            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", f"HTTP {response.status_code}")
                except:
                    error_msg = f"HTTP {response.status_code}: {response.text}"

                raise APIError(
                    error_msg,
                    status_code=response.status_code,
                    response=error_data if 'error_data' in locals() else None
                )

            # Parse response
            if response.content:
                return response.json()
            return {}

        except requests.exceptions.ConnectionError as e:
            raise NetworkError(f"Failed to connect to {url}: {e}")
        except requests.exceptions.Timeout as e:
            raise NetworkError(f"Request timeout: {e}")
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Request failed: {e}")

    def infer(
        self,
        model: str,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make an inference request using Schlep-engine's intelligent routing.

        Args:
            model: The model to use (e.g., "gpt-4", "claude-3-opus")
            messages: List of message dicts with "role" and "content"
            max_tokens: Maximum tokens in the response
            temperature: Sampling temperature (0.0 to 2.0)
            **kwargs: Additional parameters to pass to the API

        Returns:
            API response dict containing the model's response

        Example:
            >>> response = client.infer(
            ...     model="gpt-4",
            ...     messages=[{"role": "user", "content": "Hello!"}],
            ...     max_tokens=100
            ... )
        """
        payload = {
            "model": model,
            "messages": messages,
            **kwargs
        }

        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        if temperature is not None:
            payload["temperature"] = temperature

        return self._make_request("POST", "/v1/infer", json_data=payload)

    def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """
        OpenAI-compatible chat completion endpoint.

        Args:
            model: The model to use
            messages: List of message dicts
            **kwargs: Additional parameters

        Returns:
            Chat completion response
        """
        payload = {
            "model": model,
            "messages": messages,
            **kwargs
        }

        return self._make_request("POST", "/v1/chat/completions", json_data=payload)

    def list_models(self) -> Dict[str, Any]:
        """
        List available models.

        Returns:
            Dict containing available models

        Example:
            >>> models = client.list_models()
            >>> print(models)
        """
        return self._make_request("GET", "/v1/models")

    def health(self) -> Dict[str, Any]:
        """
        Check API health status.

        Returns:
            Health status dict

        Example:
            >>> status = client.health()
            >>> print(status["status"])
        """
        return self._make_request("GET", "/v1/health")

    def provider_stats(self) -> Dict[str, Any]:
        """
        Get provider statistics.

        Returns:
            Provider statistics dict
        """
        return self._make_request("GET", "/v1/providers/stats")

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self._session.close()

    def close(self):
        """Close the HTTP session"""
        self._session.close()
