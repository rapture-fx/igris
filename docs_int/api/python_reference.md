# Python SDK API Reference

Complete API reference for the Schlep-engine Python SDK.

## Installation

```bash
pip install schlep
```

## Module: `schlep`

### Class: `Client`

Main client class for interacting with the Schlep-engine API.

#### Constructor

```python
Client(base_url: str = "http://localhost:8081", api_key: Optional[str] = None, timeout: int = 30)
```

**Parameters:**
- `base_url` (str, optional): Base URL of the Schlep-engine API. Default: `"http://localhost:8081"`
- `api_key` (str, optional): API key for authentication. Default: `None`
- `timeout` (int, optional): Request timeout in seconds. Default: `30`

**Returns:** `Client` instance

**Example:**
```python
from schlep import Client

# Local instance
client = Client()

# Remote instance with authentication
client = Client(
    base_url="https://api.schlep.com",
    api_key="your-api-key",
    timeout=60
)
```

---

#### Method: `infer()`

Make an inference request using Schlep-engine's intelligent routing.

```python
infer(
    model: str,
    messages: List[Dict[str, str]],
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    **kwargs
) -> Dict[str, Any]
```

**Parameters:**
- `model` (str, required): Model identifier (e.g., `"gpt-4"`, `"claude-3-opus"`)
- `messages` (List[Dict], required): List of message dictionaries with `"role"` and `"content"` keys
- `max_tokens` (int, optional): Maximum number of tokens in the response
- `temperature` (float, optional): Sampling temperature between 0.0 and 2.0
- `**kwargs`: Additional provider-specific parameters

**Returns:** `Dict[str, Any]` - Response dictionary containing:
```python
{
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "created": 1234567890,
    "model": "gpt-4",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Response text here"
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30
    }
}
```

**Raises:**
- `AuthenticationError`: Authentication failed
- `APIError`: API request failed
- `NetworkError`: Network connection failed

**Example:**
```python
response = client.infer(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "Hello!"}
    ],
    max_tokens=100,
    temperature=0.7
)

print(response["choices"][0]["message"]["content"])
```

---

#### Method: `chat_completion()`

OpenAI-compatible chat completion endpoint.

```python
chat_completion(
    model: str,
    messages: List[Dict[str, str]],
    **kwargs
) -> Dict[str, Any]
```

**Parameters:**
- `model` (str, required): Model identifier
- `messages` (List[Dict], required): Conversation messages
- `**kwargs`: Additional parameters

**Returns:** `Dict[str, Any]` - Chat completion response

**Example:**
```python
response = client.chat_completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hi"}]
)
```

---

#### Method: `list_models()`

List all available models.

```python
list_models() -> Dict[str, Any]
```

**Parameters:** None

**Returns:** `Dict[str, Any]` - Models list:
```python
{
    "object": "list",
    "data": [
        {
            "id": "gpt-4",
            "object": "model",
            "created": 1234567890,
            "owned_by": "openai"
        },
        # ... more models
    ]
}
```

**Example:**
```python
models = client.list_models()
for model in models["data"]:
    print(model["id"])
```

---

#### Method: `health()`

Check API health status.

```python
health() -> Dict[str, Any]
```

**Parameters:** None

**Returns:** `Dict[str, Any]` - Health status:
```python
{
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2025-11-01T00:00:00Z"
}
```

**Example:**
```python
health = client.health()
if health["status"] == "healthy":
    print("API is operational")
```

---

#### Method: `provider_stats()`

Get provider statistics.

```python
provider_stats() -> Dict[str, Any]
```

**Parameters:** None

**Returns:** `Dict[str, Any]` - Provider statistics

**Example:**
```python
stats = client.provider_stats()
print(stats)
```

---

#### Method: `close()`

Close the HTTP session.

```python
close() -> None
```

**Parameters:** None

**Returns:** None

**Example:**
```python
client = Client()
# ... use client
client.close()
```

---

#### Context Manager Support

The `Client` class supports Python's context manager protocol.

**Example:**
```python
with Client(base_url="http://localhost:8081") as client:
    response = client.infer(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response)
# Connection automatically closed
```

---

## Exceptions

### `SchlepError`

Base exception for all Schlep SDK errors.

```python
class SchlepError(Exception):
    pass
```

**Attributes:** None

---

### `APIError`

Raised when an API request fails.

```python
class APIError(SchlepError):
    def __init__(self, message: str, status_code: int = None, response: dict = None)
```

**Attributes:**
- `message` (str): Error message
- `status_code` (int): HTTP status code
- `response` (dict): Full response data

**Example:**
```python
from schlep import Client, APIError

client = Client()
try:
    response = client.infer(model="invalid", messages=[])
except APIError as e:
    print(f"Error {e.status_code}: {e}")
```

---

### `AuthenticationError`

Raised when authentication fails.

```python
class AuthenticationError(SchlepError):
    pass
```

**Example:**
```python
from schlep import Client, AuthenticationError

client = Client(api_key="invalid-key")
try:
    response = client.infer(model="gpt-4", messages=[...])
except AuthenticationError:
    print("Invalid API key")
```

---

### `NetworkError`

Raised when network connection fails.

```python
class NetworkError(SchlepError):
    pass
```

**Example:**
```python
from schlep import Client, NetworkError

client = Client(base_url="http://invalid-url")
try:
    response = client.health()
except NetworkError as e:
    print(f"Connection failed: {e}")
```

---

## Message Format

Messages must follow the OpenAI chat completion format:

```python
{
    "role": str,      # "system", "user", or "assistant"
    "content": str    # Message content
}
```

**Example:**
```python
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is AI?"},
    {"role": "assistant", "content": "AI stands for..."},
    {"role": "user", "content": "Tell me more."}
]
```

---

## Type Hints

The SDK uses type hints for better IDE support:

```python
from typing import List, Dict, Any, Optional
from schlep import Client

client: Client = Client()

messages: List[Dict[str, str]] = [
    {"role": "user", "content": "Hello"}
]

response: Dict[str, Any] = client.infer(
    model="gpt-4",
    messages=messages
)
```

---

## Environment Variables

You can configure the SDK using environment variables:

```bash
export SCHLEP_BASE_URL="http://localhost:8081"
export SCHLEP_API_KEY="your-api-key"
```

```python
import os
from schlep import Client

client = Client(
    base_url=os.getenv("SCHLEP_BASE_URL", "http://localhost:8081"),
    api_key=os.getenv("SCHLEP_API_KEY")
)
```

---

## Version Information

```python
import schlep

print(schlep.__version__)  # "0.1.0"
```

---

## Complete Example

```python
from schlep import Client, SchlepError, APIError, NetworkError
import os

def main():
    # Initialize client with environment variables
    client = Client(
        base_url=os.getenv("SCHLEP_BASE_URL", "http://localhost:8081"),
        api_key=os.getenv("SCHLEP_API_KEY"),
        timeout=60
    )

    try:
        # Check health
        health = client.health()
        print(f"API Status: {health['status']}")

        # List models
        models = client.list_models()
        print(f"Available models: {len(models['data'])}")

        # Make inference
        response = client.infer(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are helpful."},
                {"role": "user", "content": "Explain AI briefly."}
            ],
            max_tokens=100,
            temperature=0.7
        )

        # Print response
        print("\nResponse:")
        print(response["choices"][0]["message"]["content"])

        # Print usage
        if "usage" in response:
            print(f"\nTokens used: {response['usage']['total_tokens']}")

    except APIError as e:
        print(f"API Error: {e} (status: {e.status_code})")
    except NetworkError as e:
        print(f"Network Error: {e}")
    except SchlepError as e:
        print(f"Schlep Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    main()
```

---

## Support

- GitHub: https://github.com/igris-inertial/igris-inertial
- Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization
