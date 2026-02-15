# Igris Python SDK

Official Python SDK for Igris-engine - Intelligent AI routing and cost optimization.

## Installation

```bash
# Install from local directory
pip install -e .

# Or install from requirements
pip install -r requirements.txt
```

## Quick Start

```python
from igris import Client

# Initialize client
client = Client(base_url="http://localhost:8081")

# Make an inference request
response = client.infer(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello, world!"}],
    max_tokens=100
)

print(response)
```

## Features

- Simple, intuitive API
- Automatic retry logic with exponential backoff
- Type hints for better IDE support
- Context manager support for automatic cleanup
- OpenAI-compatible chat completion endpoint

## Usage Examples

### Basic Inference

```python
from igris import Client

client = Client(base_url="http://localhost:8081")

response = client.infer(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    max_tokens=200,
    temperature=0.7
)

print(response["choices"][0]["message"]["content"])
```

### Using Context Manager

```python
from igris import Client

with Client(base_url="http://localhost:8081") as client:
    response = client.infer(
        model="claude-3-opus",
        messages=[{"role": "user", "content": "Write a haiku about AI"}]
    )
    print(response)
```

### List Available Models

```python
from igris import Client

client = Client(base_url="http://localhost:8081")
models = client.list_models()

print("Available models:")
for model in models.get("data", []):
    print(f"  - {model['id']}")
```

### Check API Health

```python
from igris import Client

client = Client(base_url="http://localhost:8081")
health = client.health()

print(f"Status: {health['status']}")
```

### With Authentication

```python
from igris import Client

# Initialize with API key
client = Client(
    base_url="https://api.igris-inertial.com",
    api_key="your-api-key-here"
)

response = client.infer(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Error Handling

```python
from igris import Client, APIError, AuthenticationError, NetworkError

client = Client(base_url="http://localhost:8081")

try:
    response = client.infer(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}]
    )
except AuthenticationError as e:
    print(f"Authentication failed: {e}")
except APIError as e:
    print(f"API error: {e} (status: {e.status_code})")
except NetworkError as e:
    print(f"Network error: {e}")
```

## API Reference

### Client

#### `__init__(base_url, api_key, timeout)`

Initialize the Igris client.

- `base_url` (str): Base URL of the Igris-engine API (default: "http://localhost:8081")
- `api_key` (str, optional): API key for authentication
- `timeout` (int): Request timeout in seconds (default: 30)

#### `infer(model, messages, max_tokens, temperature, **kwargs)`

Make an inference request using Igris-engine's intelligent routing.

- `model` (str): The model to use (e.g., "gpt-4", "claude-3-opus")
- `messages` (list): List of message dicts with "role" and "content"
- `max_tokens` (int, optional): Maximum tokens in the response
- `temperature` (float, optional): Sampling temperature (0.0 to 2.0)
- `**kwargs`: Additional parameters to pass to the API

Returns: API response dict containing the model's response

#### `list_models()`

List available models.

Returns: Dict containing available models

#### `health()`

Check API health status.

Returns: Health status dict

#### `provider_stats()`

Get provider statistics.

Returns: Provider statistics dict

## Configuration

The SDK can be configured using environment variables:

- `SCHLEP_BASE_URL`: Default base URL for the API
- `SCHLEP_API_KEY`: Default API key

## Development

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black .

# Type checking
mypy igris
```

## License

MIT License - see LICENSE file for details.
