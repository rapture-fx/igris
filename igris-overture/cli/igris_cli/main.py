"""Main CLI entry point for Igris-engine"""

import sys
import json
import click
from typing import Optional

from .config import Config


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """
    Igris CLI - Command-line interface for Igris-engine

    Igris-engine provides intelligent AI routing and cost optimization
    for large language models.

    Examples:
        igris login --url http://localhost:8081
        igris add-key --provider openai --key sk-...
        igris infer --prompt "Hello, world!"
        igris models
    """
    pass


@cli.command()
@click.option("--url", default="http://localhost:8081", help="API base URL")
@click.option("--api-key", help="Optional API key for authentication")
def login(url: str, api_key: Optional[str]):
    """
    Configure Igris CLI with API endpoint.

    Example:
        igris login --url http://localhost:8081
        igris login --url https://api.igris-inertial.com --api-key sk-xxx
    """
    Config.set("base_url", url)

    if api_key:
        Config.set_api_key(api_key)

    click.echo(f"✓ Configured Igris CLI")
    click.echo(f"  Base URL: {url}")
    if api_key:
        click.echo(f"  API Key: {api_key[:8]}...{api_key[-4:]}")

    # Test connection
    try:
        import requests
        response = requests.get(f"{url}/v1/health", timeout=5)
        if response.status_code == 200:
            click.echo(f"✓ Successfully connected to Igris-engine")
        else:
            click.echo(f"⚠ Warning: Health check returned status {response.status_code}", err=True)
    except Exception as e:
        click.echo(f"⚠ Warning: Could not connect to API: {e}", err=True)


@cli.command()
@click.option("--provider", required=True, help="Provider name (e.g., openai, anthropic)")
@click.option("--key", required=True, help="Provider API key")
def add_key(provider: str, key: str):
    """
    Add a provider API key to your local vault.

    This stores the key locally in ~/.igris/config.json for use with
    the Igris-engine BYOK (Bring Your Own Key) feature.

    Example:
        igris add-key --provider openai --key sk-...
        igris add-key --provider anthropic --key sk-ant-...
    """
    Config.add_provider_key(provider, key)
    click.echo(f"✓ Added {provider} API key")
    click.echo(f"  Key: {key[:8]}...{key[-4:]}")


@cli.command()
@click.option("--prompt", "-p", required=True, help="Prompt text")
@click.option("--model", "-m", default="gpt-4", help="Model to use (default: gpt-4)")
@click.option("--max-tokens", type=int, help="Maximum tokens in response")
@click.option("--temperature", type=float, help="Sampling temperature (0.0 to 2.0)")
@click.option("--json-output", is_flag=True, help="Output raw JSON response")
def infer(prompt: str, model: str, max_tokens: Optional[int], temperature: Optional[float], json_output: bool):
    """
    Make an inference request using Igris-engine.

    Example:
        igris infer --prompt "Hello, world!"
        igris infer -p "Explain quantum computing" -m claude-3-opus
        igris infer -p "Write a poem" --max-tokens 100 --json-output
    """
    import requests

    base_url = Config.get_base_url()
    api_key = Config.get_api_key()

    # Build request payload
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    if max_tokens:
        payload["max_tokens"] = max_tokens

    if temperature is not None:
        payload["temperature"] = temperature

    # Build headers
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        # Make request
        with click.progressbar(length=1, label="Sending request") as bar:
            response = requests.post(
                f"{base_url}/v1/infer",
                json=payload,
                headers=headers,
                timeout=60
            )
            bar.update(1)

        # Handle response
        if response.status_code != 200:
            click.echo(f"Error: HTTP {response.status_code}", err=True)
            click.echo(response.text, err=True)
            sys.exit(1)

        result = response.json()

        if json_output:
            click.echo(json.dumps(result, indent=2))
        else:
            # Extract and display the response text
            if "choices" in result and len(result["choices"]) > 0:
                content = result["choices"][0].get("message", {}).get("content", "")
                click.echo("\n" + content + "\n")

                # Show usage stats if available
                if "usage" in result:
                    usage = result["usage"]
                    click.echo(f"Tokens: {usage.get('total_tokens', 'N/A')} "
                             f"(prompt: {usage.get('prompt_tokens', 'N/A')}, "
                             f"completion: {usage.get('completion_tokens', 'N/A')})")
            else:
                click.echo(json.dumps(result, indent=2))

    except requests.exceptions.RequestException as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--json-output", is_flag=True, help="Output raw JSON response")
def models(json_output: bool):
    """
    List available models.

    Example:
        igris models
        igris models --json-output
    """
    import requests

    base_url = Config.get_base_url()
    api_key = Config.get_api_key()

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = requests.get(
            f"{base_url}/v1/models",
            headers=headers,
            timeout=10
        )

        if response.status_code != 200:
            click.echo(f"Error: HTTP {response.status_code}", err=True)
            click.echo(response.text, err=True)
            sys.exit(1)

        result = response.json()

        if json_output:
            click.echo(json.dumps(result, indent=2))
        else:
            click.echo("\nAvailable Models:")
            click.echo("-" * 50)

            if "data" in result:
                for model in result["data"]:
                    model_id = model.get("id", "unknown")
                    click.echo(f"  • {model_id}")
            else:
                click.echo(json.dumps(result, indent=2))

    except requests.exceptions.RequestException as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--json-output", is_flag=True, help="Output raw JSON response")
def metrics(json_output: bool):
    """
    View usage metrics and statistics.

    Example:
        igris metrics
        igris metrics --json-output
    """
    import requests

    base_url = Config.get_base_url()
    api_key = Config.get_api_key()

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        # Try to get provider stats
        response = requests.get(
            f"{base_url}/v1/providers/stats",
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            if json_output:
                click.echo(json.dumps(result, indent=2))
            else:
                click.echo("\nProvider Statistics:")
                click.echo("-" * 50)
                click.echo(json.dumps(result, indent=2))
        else:
            click.echo(f"Error: HTTP {response.status_code}", err=True)
            click.echo(response.text, err=True)

    except requests.exceptions.RequestException as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
def config():
    """
    Show current configuration.

    Example:
        igris config
    """
    current_config = Config.load()

    click.echo("\nCurrent Configuration:")
    click.echo("-" * 50)
    click.echo(f"Base URL: {current_config.get('base_url', 'Not set')}")

    api_key = current_config.get('api_key')
    if api_key:
        click.echo(f"API Key: {api_key[:8]}...{api_key[-4:]}")
    else:
        click.echo("API Key: Not set")

    provider_keys = current_config.get('provider_keys', {})
    if provider_keys:
        click.echo("\nProvider Keys:")
        for provider, key in provider_keys.items():
            click.echo(f"  • {provider}: {key[:8]}...{key[-4:]}")
    else:
        click.echo("\nProvider Keys: None")

    click.echo(f"\nConfig file: {Config.CONFIG_FILE}")


if __name__ == "__main__":
    cli()
