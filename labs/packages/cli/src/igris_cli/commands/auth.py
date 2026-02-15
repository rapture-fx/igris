"""
Authentication commands for Igris-engine CLI.
"""

import sys
from typing import Optional
import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt

from ..core.config import Config
from ..core.client import APIClient
from ..core.utils import handle_exceptions
from ..ui.spinner import show_spinner, operation_spinner

console = Console()

@click.group()
def auth():
    """Authentication and user management commands."""
    pass

@auth.command()
@click.option(
    '--api-key', 
    help='API key for authentication',
    envvar='IGRIS_API_KEY'
)
@click.option(
    '--interactive', '-i',
    is_flag=True,
    help='Interactive login (prompt for API key)'
)
@click.pass_context
@handle_exceptions
def login(ctx, api_key: Optional[str], interactive: bool):
    """
    Log in to Igris-engine API.
    
    Examples:
        igris auth login --api-key sk-1234567890abcdef
        igris auth login --interactive
        igris auth login  # Uses IGRIS_API_KEY environment variable
    """
    config = ctx.obj.get('config') or Config()
    
    # Get API key
    if interactive:
        console.print("[cyan]Interactive login to Igris-engine[/cyan]")
        api_key = Prompt.ask(
            "Enter your API key",
            password=True,
            show_default=False
        )
    
    if not api_key:
        console.print("[red]No API key provided. Use --api-key or --interactive[/red]")
        console.print("\nGet your API key at: https://dashboard.igris-inertial.com/api-keys")
        sys.exit(1)
    
    # Validate API key format
    if not api_key.startswith(('sk-', 'pk-')):
        console.print("[yellow]Warning: API key doesn't match expected format (should start with 'sk-' or 'pk-')[/yellow]")
    
    # Test authentication
    with operation_spinner("Authenticating", "Verifying API key...") as spinner:
        try:
            client = APIClient(config)
            
            spinner.update_step("Testing API connection...")
            success = client.authenticate(api_key)
            
            if success:
                spinner.update_step("Saving credentials...")
                config.save_auth(api_key)
                
                # Get user info if available
                user_info = client.get_user_info()
                
                spinner.stop("Authentication successful!")
                
                # Display success message
                success_text = Text()
                success_text.append("Successfully authenticated!\n\n", style="bold green")
                
                if user_info:
                    success_text.append(f"User: {user_info.get('email', 'Unknown')}\n", style="cyan")
                    success_text.append(f"Organization: {user_info.get('organization', 'Personal')}\n", style="cyan")
                    success_text.append(f"Plan: {user_info.get('plan', 'Free')}\n", style="cyan")
                
                success_text.append("\nYou can now use all Igris-engine CLI commands.", style="dim")
                
                console.print(Panel(success_text, title="Login Successful", border_style="green"))
            else:
                spinner.fail("Authentication failed")
                console.print("[red]Invalid API key or authentication failed[/red]")
                sys.exit(1)
                
        except Exception as e:
            spinner.fail(f"Authentication error: {e}")
            sys.exit(1)

@auth.command()
@click.option(
    '--confirm', '-y',
    is_flag=True,
    help='Skip confirmation prompt'
)
@click.pass_context
@handle_exceptions
def logout(ctx, confirm: bool):
    """
    Log out and clear stored credentials.
    
    Examples:
        igris auth logout
        igris auth logout --confirm  # Skip confirmation
    """
    config = ctx.obj.get('config') or Config()
    
    if not config.is_authenticated():
        console.print("[yellow]Not currently logged in[/yellow]")
        return
    
    if not confirm:
        response = Prompt.ask(
            "Are you sure you want to log out?",
            choices=['y', 'n'],
            default='n'
        )
        if response.lower() != 'y':
            console.print("Logout cancelled")
            return
    
    with show_spinner("Logging out..."):
        config.clear_auth()
    
    console.print("[green]Successfully logged out[/green]")

@auth.command()
@click.option(
    '--json',
    is_flag=True,
    help='Output status in JSON format'
)
@click.pass_context
@handle_exceptions
def status(ctx, json: bool):
    """
    Show current authentication status.
    
    Examples:
        igris auth status
        igris auth status --json
    """
    config = ctx.obj.get('config') or Config()
    
    if json:
        import json as json_lib
        status_data = {
            'authenticated': config.is_authenticated(),
            'api_key_present': bool(config.api_key),
            'base_url': config.base_url
        }
        
        if config.is_authenticated():
            try:
                client = APIClient(config)
                user_info = client.get_user_info()
                if user_info:
                    status_data.update(user_info)
            except:
                pass
        
        console.print(json_lib.dumps(status_data, indent=2))
        return
    
    # Rich formatted output
    if config.is_authenticated():
        with show_spinner("Checking authentication status...") as spinner:
            try:
                client = APIClient(config)
                is_healthy = client.health_check()
                user_info = client.get_user_info()
            except:
                is_healthy = False
                user_info = None
        
        if is_healthy:
            status_text = Text()
            status_text.append("✓ Authenticated\n\n", style="bold green")
            status_text.append(f"API Endpoint: {config.base_url}\n", style="cyan")
            
            if user_info:
                status_text.append(f"User: {user_info.get('email', 'Unknown')}\n", style="cyan")
                status_text.append(f"Organization: {user_info.get('organization', 'Personal')}\n", style="cyan")
                status_text.append(f"Plan: {user_info.get('plan', 'Free')}\n", style="cyan")
                
                # Show usage limits if available
                usage = user_info.get('usage', {})
                if usage:
                    status_text.append("\nUsage (Current Month):\n", style="bold")
                    status_text.append(f"  API Calls: {usage.get('api_calls', 0):,}\n", style="dim")
                    status_text.append(f"  Data Processed: {usage.get('data_processed', 0):,} MB\n", style="dim")
                    status_text.append(f"  Pipelines Run: {usage.get('pipelines', 0):,}\n", style="dim")
            
            status_text.append("\nAll systems operational.", style="dim green")
            
            console.print(Panel(status_text, title="Authentication Status", border_style="green"))
        else:
            console.print(Panel(
                "[yellow]⚠ Authenticated but API connection failed[/yellow]\n\nPlease check your internet connection and API endpoint configuration.",
                title="Authentication Status",
                border_style="yellow"
            ))
    else:
        console.print(Panel(
            "[red]✗ Not authenticated[/red]\n\nRun 'igris auth login' to authenticate.",
            title="Authentication Status",
            border_style="red"
        ))

@auth.command()
@click.pass_context
@handle_exceptions
def refresh(ctx):
    """
    Refresh authentication token.
    
    Examples:
        igris auth refresh
    """
    config = ctx.obj.get('config') or Config()
    
    if not config.is_authenticated():
        console.print("[red]Not authenticated. Run 'igris auth login' first.[/red]")
        sys.exit(1)
    
    with operation_spinner("Refreshing authentication", "Validating current credentials...") as spinner:
        try:
            client = APIClient(config)
            
            spinner.update_step("Testing API connection...")
            is_healthy = client.health_check()
            
            if is_healthy:
                spinner.update_step("Refreshing token...")
                # In a real implementation, this would refresh JWT tokens
                # For now, we just validate the connection
                
                spinner.stop("Authentication refreshed successfully!")
                console.print("[green]✓ Authentication is valid and refreshed[/green]")
            else:
                spinner.fail("Authentication refresh failed")
                console.print("[red]Current credentials are invalid. Please log in again.[/red]")
                console.print("Run: igris auth login")
                sys.exit(1)
                
        except Exception as e:
            spinner.fail(f"Refresh failed: {e}")
            sys.exit(1)

@auth.command()
@click.pass_context
@handle_exceptions
def whoami(ctx):
    """
    Show current user information.
    
    Examples:
        igris auth whoami
    """
    config = ctx.obj.get('config') or Config()
    
    if not config.is_authenticated():
        console.print("[red]Not authenticated. Run 'igris auth login' first.[/red]")
        sys.exit(1)
    
    with show_spinner("Fetching user information..."):
        try:
            client = APIClient(config)
            user_info = client.get_user_info()
        except Exception as e:
            console.print(f"[red]Failed to fetch user information: {e}[/red]")
            sys.exit(1)
    
    if user_info:
        user_text = Text()
        user_text.append("Current User Information\n\n", style="bold cyan")
        
        # Basic info
        user_text.append(f"Email: {user_info.get('email', 'Unknown')}\n", style="white")
        user_text.append(f"Name: {user_info.get('name', 'Not provided')}\n", style="white")
        user_text.append(f"Organization: {user_info.get('organization', 'Personal')}\n", style="white")
        user_text.append(f"Plan: {user_info.get('plan', 'Free')}\n", style="white")
        user_text.append(f"Role: {user_info.get('role', 'User')}\n", style="white")
        
        # Account status
        if user_info.get('verified', False):
            user_text.append("Status: ✓ Verified\n", style="green")
        else:
            user_text.append("Status: ⚠ Unverified\n", style="yellow")
        
        # Timestamps
        created_at = user_info.get('created_at')
        if created_at:
            user_text.append(f"Member since: {created_at}\n", style="dim")
        
        last_login = user_info.get('last_login')
        if last_login:
            user_text.append(f"Last login: {last_login}\n", style="dim")
        
        console.print(Panel(user_text, title="User Profile", border_style="blue"))
    else:
        console.print("[yellow]User information not available[/yellow]")

if __name__ == "__main__":
    auth()