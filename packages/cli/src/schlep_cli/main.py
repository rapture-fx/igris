"""
Main CLI entry point for Schlep-engine CLI tool.
"""

import sys
import os
from typing import Optional

import click
from rich.console import Console
from rich.text import Text
from rich.panel import Panel

from .core.config import Config
from .core.client import APIClient
from .core.utils import handle_exceptions, check_api_connection
from .commands import auth, process, pipeline, config as config_cmd, monitoring

# Initialize console for rich output
console = Console()

# ASCII Art Logo
LOGO = """
 ███████╗ ██████╗██╗  ██╗██╗     ███████╗██████╗ 
 ██╔════╝██╔════╝██║  ██║██║     ██╔════╝██╔══██╗
 ███████╗██║     ███████║██║     █████╗  ██████╔╝
 ╚════██║██║     ██╔══██║██║     ██╔══╝  ██╔═══╝ 
 ███████║╚██████╗██║  ██║███████╗███████╗██║     
 ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     
                                                 
   ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
   ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝
   █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗  
   ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝  
   ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗
   ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
"""

@click.group(invoke_without_command=True)
@click.option('--version', is_flag=True, help='Show version information')
@click.option('--debug', is_flag=True, help='Enable debug mode')
@click.option('--config-file', type=click.Path(), help='Path to configuration file')
@click.pass_context
def cli(ctx, version: bool, debug: bool, config_file: Optional[str]):
    """
    Schlep-engine CLI - Advanced data processing and ML automation
    
    A comprehensive command-line tool for DevOps automation, CI/CD pipelines,
    and batch processing workflows.
    
    Examples:
        schlep auth login --api-key $SCHLEP_API_KEY
        schlep process data.csv --output processed.parquet
        schlep pipeline create fraud-detection.yml
        schlep batch process ./input/*.csv --parallel 4
    """
    # Ensure context object exists
    ctx.ensure_object(dict)
    
    # Store global options
    ctx.obj['debug'] = debug
    ctx.obj['config_file'] = config_file
    
    # Load configuration
    try:
        config = Config.load(config_file)
        ctx.obj['config'] = config
        ctx.obj['client'] = APIClient(config)
    except Exception as e:
        if debug:
            console.print(f"[red]Failed to load configuration: {e}[/red]")
            sys.exit(1)
        # Continue without configuration for some commands
        ctx.obj['config'] = None
        ctx.obj['client'] = None
    
    if version:
        show_version()
        return
    
    # If no command provided, show welcome message
    if ctx.invoked_subcommand is None:
        show_welcome()

def show_version():
    """Display version information."""
    from . import __version__, __description__
    
    version_info = Text()
    version_info.append("Schlep-engine CLI ", style="bold cyan")
    version_info.append(f"v{__version__}", style="bold green")
    version_info.append(f"\n{__description__}", style="dim")
    
    console.print(Panel(version_info, title="Version Info", border_style="blue"))

def show_welcome():
    """Display welcome message with logo."""
    # Create welcome panel
    welcome_text = Text()
    welcome_text.append("Welcome to Schlep-engine CLI!\n\n", style="bold cyan")
    welcome_text.append("Advanced data processing and ML automation platform\n\n", style="dim")
    welcome_text.append("Get started:\n", style="bold")
    welcome_text.append("  1. ", style="dim")
    welcome_text.append("schlep auth login --api-key YOUR_API_KEY\n", style="green")
    welcome_text.append("  2. ", style="dim")
    welcome_text.append("schlep process data.csv\n", style="green")
    welcome_text.append("  3. ", style="dim")
    welcome_text.append("schlep pipeline create config.yml\n", style="green")
    welcome_text.append("\nUse ", style="dim")
    welcome_text.append("schlep --help", style="bold")
    welcome_text.append(" to see all available commands.", style="dim")
    
    # Print logo and welcome
    console.print(Text(LOGO, style="bold blue"))
    console.print(Panel(welcome_text, title="Welcome", border_style="cyan"))

# Add command groups
cli.add_command(auth.auth)
cli.add_command(process.process)
cli.add_command(pipeline.pipeline)
cli.add_command(config_cmd.config)
cli.add_command(monitoring.monitoring)

# Add top-level commands for convenience
@cli.command()
@click.pass_context
def status(ctx):
    """Quick system status check."""
    from .commands.monitoring import show_status
    show_status(ctx.obj.get('client'))

@cli.command()
@click.pass_context
def version(ctx):
    """Show version information."""
    show_version()

@cli.command()
@click.pass_context
def health(ctx):
    """Check API health and connectivity."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]No API client configured. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    with console.status("Checking API health..."):
        healthy = check_api_connection(client)
    
    if healthy:
        console.print("[green]✓[/green] API is healthy and reachable")
    else:
        console.print("[red]✗[/red] API is not reachable")
        sys.exit(1)

# Error handling wrapper
cli = handle_exceptions(cli)

if __name__ == '__main__':
    cli()