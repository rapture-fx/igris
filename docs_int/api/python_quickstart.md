# Python SDK Quickstart

Get started with the Igris Inertial Python SDK in minutes.

## Installation

Install the Igris Python SDK using pip:

```bash
pip install igris
```

Or install from source:

```bash
cd internal/sdk/python
pip install -e .
```

## Quick Start

### Basic Usage

```python
from igris import Client

# Initialize the client
client = Client(base_url="http://localhost:8081")

# Make an inference request
response = client.infer(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello, world!"}
    ],
    max_tokens=100
)

# Print the response
print(response["choices"][0]["message"]["content"])
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
    messages=[{"role": "user", "content": "Explain AI"}]
)
```

## BYOK (Bring Your Own Key) Configuration

Igris Inertial supports BYOK, allowing you to use your own provider API keys:

### Using the CLI

```bash
# Configure Igris CLI
igris login --url http://localhost:8081

# Add provider keys
igris add-key --provider openai --key sk-...
igris add-key --provider anthropic --key sk-ant-...

# Test inference
igris infer --prompt "Hello!"
```

### Using the SDK

```python
from igris import Client

# The SDK uses the API to route to the best provider
# Keys are managed server-side via the vault
client = Client(base_url="http://localhost:8081")

# Igris Inertial automatically routes to the best available provider
response = client.infer(
    model="gpt-4",  # Requested model
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Common Examples

### Chat Conversation

```python
from igris import Client

client = Client(base_url="http://localhost:8081")

# Multi-turn conversation
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is machine learning?"},
]

response = client.infer(
    model="gpt-4",
    messages=messages,
    max_tokens=200,
    temperature=0.7
)

# Add assistant response to conversation
messages.append({
    "role": "assistant",
    "content": response["choices"][0]["message"]["content"]
})

# Continue conversation
messages.append({
    "role": "user",
    "content": "Can you give me an example?"
})

response = client.infer(model="gpt-4", messages=messages)
print(response["choices"][0]["message"]["content"])
```

### List Available Models

```python
from igris import Client

client = Client(base_url="http://localhost:8081")

# Get all available models
models = client.list_models()

print("Available models:")
for model in models.get("data", []):
    print(f"  - {model['id']}")
```

### Health Check

```python
from igris import Client

client = Client(base_url="http://localhost:8081")

# Check API health
health = client.health()

print(f"Status: {health['status']}")
if health['status'] == 'healthy':
    print("API is operational")
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
    print(response)

except AuthenticationError as e:
    print(f"Authentication failed: {e}")

except APIError as e:
    print(f"API error: {e} (status code: {e.status_code})")

except NetworkError as e:
    print(f"Network error: {e}")

except Exception as e:
    print(f"Unexpected error: {e}")
```

### Using Context Manager

```python
from igris import Client

# Automatically close connection when done
with Client(base_url="http://localhost:8081") as client:
    response = client.infer(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response)
```

## Configuration Options

### Client Configuration

```python
from igris import Client

client = Client(
    base_url="http://localhost:8081",  # API endpoint
    api_key="your-api-key",            # Optional authentication
    timeout=60                          # Request timeout in seconds
)
```

### Inference Parameters

```python
response = client.infer(
    model="gpt-4",                     # Model name
    messages=[...],                    # Conversation messages
    max_tokens=500,                    # Maximum response length
    temperature=0.7,                   # Randomness (0.0 - 2.0)
    top_p=0.9,                        # Nucleus sampling
    # Additional provider-specific parameters
)
```

## Example: Real-time Chat Application

```python
from igris import Client

def chat_loop():
    client = Client(base_url="http://localhost:8081")
    messages = [
        {"role": "system", "content": "You are a helpful AI assistant."}
    ]

    print("Chat started. Type 'quit' to exit.")

    while True:
        user_input = input("\nYou: ")
        if user_input.lower() == 'quit':
            break

        messages.append({"role": "user", "content": user_input})

        try:
            response = client.infer(
                model="gpt-4",
                messages=messages,
                max_tokens=300
            )

            assistant_message = response["choices"][0]["message"]["content"]
            messages.append({"role": "assistant", "content": assistant_message})

            print(f"\nAssistant: {assistant_message}")

        except Exception as e:
            print(f"\nError: {e}")

if __name__ == "__main__":
    chat_loop()
```

## Next Steps

- Read the [Python SDK Reference](/docs/api/python_reference.md) for detailed API documentation
- Explore the [CLI Documentation](/internal/cli/README.md)
- Learn about [BYOK configuration](/docs/byok.md)
- See [Advanced Examples](/docs/examples/python/)

## Support

- GitHub Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com
- Documentation: https://github.com/igris-inertial/igris-inertial

---

**Igris Inertial** - Intelligent AI Routing and Cost Optimization
