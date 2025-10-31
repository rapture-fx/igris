# Schlep CLI

Official command-line interface for Schlep-engine - Intelligent AI routing and cost optimization.

## Installation

```bash
# Install from local directory
pip install -e .

# Or install from requirements
pip install -r requirements.txt
```

After installation, the `schlep` command will be available globally.

## Quick Start

```bash
# Configure CLI with your API endpoint
schlep login --url http://localhost:8081

# Make an inference request
schlep infer --prompt "Hello, world!"

# List available models
schlep models
```

## Commands

### `schlep login`

Configure Schlep CLI with API endpoint.

```bash
# Connect to local instance
schlep login --url http://localhost:8081

# Connect to remote instance with API key
schlep login --url https://api.schlep.com --api-key sk-xxx
```

**Options:**
- `--url`: API base URL (default: http://localhost:8081)
- `--api-key`: Optional API key for authentication

### `schlep add-key`

Add a provider API key to your local vault.

```bash
# Add OpenAI API key
schlep add-key --provider openai --key sk-...

# Add Anthropic API key
schlep add-key --provider anthropic --key sk-ant-...

# Add other providers
schlep add-key --provider cohere --key <your-key>
```

**Options:**
- `--provider`: Provider name (required)
- `--key`: Provider API key (required)

Keys are stored securely in `~/.schlep/config.json` with restrictive file permissions (0600).

### `schlep infer`

Make an inference request using Schlep-engine.

```bash
# Basic inference
schlep infer --prompt "Hello, world!"

# Specify model
schlep infer --prompt "Explain quantum computing" --model claude-3-opus

# Control output
schlep infer --prompt "Write a poem" --max-tokens 100 --temperature 0.8

# Get raw JSON output
schlep infer --prompt "Test" --json-output
```

**Options:**
- `--prompt`, `-p`: Prompt text (required)
- `--model`, `-m`: Model to use (default: gpt-4)
- `--max-tokens`: Maximum tokens in response
- `--temperature`: Sampling temperature (0.0 to 2.0)
- `--json-output`: Output raw JSON response

### `schlep models`

List available models.

```bash
# List models
schlep models

# Get raw JSON output
schlep models --json-output
```

### `schlep metrics`

View usage metrics and statistics.

```bash
# View metrics
schlep metrics

# Get raw JSON output
schlep metrics --json-output
```

### `schlep config`

Show current configuration.

```bash
schlep config
```

This displays:
- Base URL
- API key (masked)
- Provider keys (masked)
- Config file location

## Configuration

The CLI stores configuration in `~/.schlep/config.json`:

```json
{
  "base_url": "http://localhost:8081",
  "api_key": null,
  "provider_keys": {
    "openai": "sk-...",
    "anthropic": "sk-ant-..."
  }
}
```

The config directory and file have restrictive permissions (700 and 600 respectively) for security.

## Examples

### Complete Workflow

```bash
# 1. Configure CLI
schlep login --url http://localhost:8081

# 2. Add provider keys (for BYOK)
schlep add-key --provider openai --key sk-...
schlep add-key --provider anthropic --key sk-ant-...

# 3. Test inference
schlep infer --prompt "Hello!"

# 4. Check available models
schlep models

# 5. View configuration
schlep config
```

### Different Models

```bash
# Use GPT-4
schlep infer -p "Explain AI" -m gpt-4

# Use Claude
schlep infer -p "Explain AI" -m claude-3-opus-20240229

# Use GPT-3.5 Turbo
schlep infer -p "Explain AI" -m gpt-3.5-turbo
```

### Advanced Inference

```bash
# Long-form content generation
schlep infer \
  --prompt "Write a detailed explanation of machine learning" \
  --model gpt-4 \
  --max-tokens 500 \
  --temperature 0.7

# Code generation with low temperature
schlep infer \
  --prompt "Write a Python function to calculate fibonacci numbers" \
  --model claude-3-opus \
  --temperature 0.2
```

### JSON Output for Scripting

```bash
# Get raw JSON for parsing
response=$(schlep infer -p "Hello" --json-output)
echo "$response" | jq '.choices[0].message.content'

# Check models programmatically
models=$(schlep models --json-output)
echo "$models" | jq '.data[].id'
```

## Environment Variables

You can also configure the CLI using environment variables:

```bash
export SCHLEP_BASE_URL="http://localhost:8081"
export SCHLEP_API_KEY="your-api-key"
```

## Troubleshooting

### Connection Issues

If you can't connect to the API:

```bash
# Verify the URL is correct
curl http://localhost:8081/v1/health

# Check if the API is running
schlep config  # Check your base_url
```

### API Key Issues

If you're getting authentication errors:

```bash
# Verify your API key is set
schlep config

# Re-login with correct credentials
schlep login --url <your-url> --api-key <your-key>
```

### Permission Issues

If you get permission errors with the config file:

```bash
# Fix permissions
chmod 700 ~/.schlep
chmod 600 ~/.schlep/config.json
```

## Development

```bash
# Install in development mode
pip install -e .

# Run CLI directly
python -m schlep_cli.main --help
```

## Security

- All credentials are stored locally in `~/.schlep/config.json`
- File permissions are automatically set to 600 (owner read/write only)
- Config directory permissions are set to 700 (owner access only)
- API keys are masked when displayed in the terminal

## License

MIT License - see LICENSE file for details.
