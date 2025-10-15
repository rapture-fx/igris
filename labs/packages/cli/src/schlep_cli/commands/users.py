import click
from rich.console import Console
from rich.table import Table

console = Console()

@click.group()
def users():
    """User management - profile, API keys."""
    pass

@users.command()
@click.option('--format', type=click.Choice(['json', 'table']), default='table')
@click.pass_context
def profile(ctx, format):
    """Get user profile."""
    console.print("[cyan]Fetching user profile...[/cyan]")

@users.command()
@click.option('--name')
@click.option('--email')
@click.pass_context
def update_profile(ctx, name, email):
    """Update user profile."""
    console.print("[cyan]Updating profile...[/cyan]")

@users.command()
@click.pass_context
def list_api_keys(ctx):
    """List all API keys."""
    console.print("[cyan]Listing API keys...[/cyan]")

@users.command()
@click.argument('name')
@click.pass_context
def create_api_key(ctx, name):
    """Create new API key."""
    console.print(f"[cyan]Creating API key: {name}[/cyan]")

@users.command()
@click.argument('key_id')
@click.confirmation_option(prompt='Revoke this API key?')
@click.pass_context
def revoke_api_key(ctx, key_id):
    """Revoke API key."""
    console.print(f"[cyan]Revoking API key: {key_id}[/cyan]")
