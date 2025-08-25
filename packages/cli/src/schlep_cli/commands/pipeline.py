"""
Pipeline management commands for Schlep-engine CLI.
"""

import sys
import time
import yaml
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.live import Live
from rich.table import Table

from ..core.config import Config
from ..core.client import APIClient
from ..core.utils import handle_exceptions, validate_file_path, format_duration
from ..ui.progress import ProgressTracker
from ..ui.table import create_pipeline_table, display_table, create_table
from ..ui.spinner import operation_spinner, multi_step_spinner

console = Console()

@click.group()
def pipeline():
    """ML pipeline management commands."""
    pass

@pipeline.command()
@click.argument('config_file', type=click.Path(exists=True))
@click.option(
    '--name', '-n',
    help='Pipeline name (default: from config file)'
)
@click.option(
    '--description', '-d',
    help='Pipeline description'
)
@click.option(
    '--tags',
    multiple=True,
    help='Pipeline tags'
)
@click.option(
    '--auto-start',
    is_flag=True,
    help='Start pipeline immediately after creation'
)
@click.option(
    '--dry-run',
    is_flag=True,
    help='Validate configuration without creating pipeline'
)
@click.pass_context
@handle_exceptions
def create(ctx, config_file: str, name: Optional[str], description: Optional[str],
           tags: tuple, auto_start: bool, dry_run: bool):
    """
    Create a new ML pipeline from configuration file.
    
    Examples:
        schlep pipeline create fraud-detection.yml
        schlep pipeline create model-config.json --name "My Pipeline" --auto-start
        schlep pipeline create config.yml --dry-run  # Validate only
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    # Load configuration file
    config_path = validate_file_path(config_file)
    
    try:
        with open(config_path, 'r') as f:
            if config_path.suffix.lower() in ['.yml', '.yaml']:
                pipeline_config = yaml.safe_load(f)
            else:
                pipeline_config = json.load(f)
    except Exception as e:
        console.print(f"[red]Failed to load config file: {e}[/red]")
        sys.exit(1)
    
    # Override config with command line options
    if name:
        pipeline_config['name'] = name
    if description:
        pipeline_config['description'] = description
    if tags:
        pipeline_config['tags'] = list(tags)
    
    # Display pipeline configuration
    display_pipeline_config(pipeline_config, config_path)
    
    if dry_run:
        console.print("[green]✓ Configuration is valid[/green]")
        return
    
    # Create pipeline
    steps = [
        "Validating configuration",
        "Creating pipeline",
        "Setting up resources",
        "Initializing components"
    ]
    
    with multi_step_spinner(steps, "Creating pipeline") as spinner:
        try:
            result = client.create_pipeline(config=pipeline_config)
            pipeline_id = result.get('pipeline_id')
            
            if auto_start and pipeline_id:
                spinner.next_step()  # Move to next step
                start_result = client.start_pipeline(pipeline_id)
                
                console.print(f"[green]✓ Pipeline created and started successfully![/green]")
                console.print(f"Pipeline ID: [cyan]{pipeline_id}[/cyan]")
                console.print(f"Status: [green]{start_result.get('status', 'running')}[/green]")
            else:
                console.print(f"[green]✓ Pipeline created successfully![/green]")
                console.print(f"Pipeline ID: [cyan]{pipeline_id}[/cyan]")
                console.print("Use 'schlep pipeline start' to begin execution")
                
        except Exception as e:
            spinner.fail(f"Pipeline creation failed: {e}")
            sys.exit(1)

@pipeline.command()
@click.option(
    '--status',
    type=click.Choice(['all', 'running', 'completed', 'failed', 'pending']),
    default='all',
    help='Filter by status'
)
@click.option(
    '--limit', '-l',
    type=click.IntRange(1, 100),
    default=10,
    help='Maximum number of pipelines to show'
)
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.pass_context
@handle_exceptions
def list(ctx, status: str, limit: int, json: bool):
    """
    List all pipelines.
    
    Examples:
        schlep pipeline list
        schlep pipeline list --status running
        schlep pipeline list --limit 20 --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    with operation_spinner("Fetching pipelines", "Loading pipeline data..."):
        try:
            pipelines = client.list_pipelines()
            
            # Filter by status
            if status != 'all':
                pipelines = [p for p in pipelines if p.get('status', '').lower() == status]
            
            # Apply limit
            pipelines = pipelines[:limit]
            
        except Exception as e:
            console.print(f"[red]Failed to fetch pipelines: {e}[/red]")
            sys.exit(1)
    
    if not pipelines:
        console.print("[yellow]No pipelines found[/yellow]")
        return
    
    if json:
        import json as json_lib
        console.print(json_lib.dumps(pipelines, indent=2))
    else:
        table = create_pipeline_table(pipelines)
        display_table(table, f"Pipelines ({len(pipelines)} found)")

@pipeline.command()
@click.argument('pipeline_name_or_id')
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch for status changes'
)
@click.pass_context
@handle_exceptions
def status(ctx, pipeline_name_or_id: str, json: bool, watch: bool):
    """
    Get pipeline status and details.
    
    Examples:
        schlep pipeline status my-pipeline
        schlep pipeline status pl-123456 --json
        schlep pipeline status my-pipeline --watch  # Live updates
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    if watch:
        watch_pipeline_status(client, pipeline_name_or_id)
    else:
        show_pipeline_status(client, pipeline_name_or_id, json)

def show_pipeline_status(client: APIClient, pipeline_id: str, json_output: bool = False):
    """Show pipeline status once."""
    with operation_spinner("Fetching pipeline status", "Loading details..."):
        try:
            pipeline_data = client.get_pipeline_status(pipeline_id)
        except Exception as e:
            console.print(f"[red]Failed to get pipeline status: {e}[/red]")
            sys.exit(1)
    
    if json_output:
        import json
        console.print(json.dumps(pipeline_data, indent=2))
        return
    
    # Display detailed status
    display_pipeline_details(pipeline_data)

def watch_pipeline_status(client: APIClient, pipeline_id: str):
    """Watch pipeline status with live updates."""
    console.print(f"[cyan]Watching pipeline: {pipeline_id}[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    pipeline_data = client.get_pipeline_status(pipeline_id)
                    table = create_pipeline_status_table(pipeline_data)
                    live.update(table, refresh=True)
                    
                    # Exit if pipeline is completed or failed
                    status = pipeline_data.get('status', '').lower()
                    if status in ['completed', 'failed', 'cancelled']:
                        break
                    
                    time.sleep(5)  # Update every 5 seconds
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error fetching status: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching pipeline[/yellow]")

def create_pipeline_status_table(pipeline_data: Dict[str, Any]) -> Table:
    """Create a table for pipeline status display."""
    table = create_table(title=f"Pipeline: {pipeline_data.get('name', 'Unknown')}", show_lines=True)
    table.add_column("Attribute", style="bold")
    table.add_column("Value", style="white")
    
    # Basic information
    table.add_row("ID", pipeline_data.get('id', 'N/A'))
    table.add_row("Name", pipeline_data.get('name', 'N/A'))
    
    # Status with color coding
    status = pipeline_data.get('status', 'unknown').lower()
    if status == 'running':
        status_display = "[green]🟢 Running[/green]"
    elif status == 'completed':
        status_display = "[blue]🔵 Completed[/blue]"
    elif status == 'failed':
        status_display = "[red]🔴 Failed[/red]"
    elif status == 'pending':
        status_display = "[yellow]🟡 Pending[/yellow]"
    else:
        status_display = f"[dim]{status.title()}[/dim]"
    
    table.add_row("Status", status_display)
    
    # Progress
    progress = pipeline_data.get('progress', 0)
    if isinstance(progress, (int, float)):
        progress_bar = "█" * int(progress / 10) + "░" * (10 - int(progress / 10))
        table.add_row("Progress", f"{progress:.1f}% [{progress_bar}]")
    
    # Timing information
    if 'created_at' in pipeline_data:
        table.add_row("Created", pipeline_data['created_at'])
    
    if 'started_at' in pipeline_data:
        table.add_row("Started", pipeline_data['started_at'])
    
    if 'duration' in pipeline_data:
        table.add_row("Duration", format_duration(pipeline_data['duration']))
    
    # Current step
    if 'current_step' in pipeline_data:
        table.add_row("Current Step", pipeline_data['current_step'])
    
    # Resource usage
    resources = pipeline_data.get('resources', {})
    if resources:
        table.add_row("CPU Usage", f"{resources.get('cpu_percent', 0):.1f}%")
        table.add_row("Memory Usage", f"{resources.get('memory_mb', 0):.1f} MB")
    
    return table

@pipeline.command()
@click.argument('pipeline_name_or_id')
@click.option(
    '--force', '-f',
    is_flag=True,
    help='Force start even if pipeline is already running'
)
@click.pass_context
@handle_exceptions
def start(ctx, pipeline_name_or_id: str, force: bool):
    """
    Start a pipeline.
    
    Examples:
        schlep pipeline start my-pipeline
        schlep pipeline start pl-123456 --force
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    with operation_spinner("Starting pipeline", "Initializing execution...") as spinner:
        try:
            result = client.start_pipeline(pipeline_name_or_id)
            
            pipeline_id = result.get('pipeline_id', pipeline_name_or_id)
            status = result.get('status', 'running')
            
            spinner.stop(f"Pipeline started successfully!")
            console.print(f"Pipeline ID: [cyan]{pipeline_id}[/cyan]")
            console.print(f"Status: [green]{status}[/green]")
            
            # Offer to watch the pipeline
            if Confirm.ask("Watch pipeline progress?", default=False):
                watch_pipeline_status(client, pipeline_id)
                
        except Exception as e:
            spinner.fail(f"Failed to start pipeline: {e}")
            sys.exit(1)

@pipeline.command()
@click.argument('pipeline_name_or_id')
@click.option(
    '--force', '-f',
    is_flag=True,
    help='Force stop without graceful shutdown'
)
@click.pass_context
@handle_exceptions
def stop(ctx, pipeline_name_or_id: str, force: bool):
    """
    Stop a running pipeline.
    
    Examples:
        schlep pipeline stop my-pipeline
        schlep pipeline stop pl-123456 --force
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    # Confirm stop action
    if not force and not Confirm.ask(f"Stop pipeline '{pipeline_name_or_id}'?", default=False):
        console.print("Operation cancelled")
        return
    
    with operation_spinner("Stopping pipeline", "Sending stop signal...") as spinner:
        try:
            result = client.stop_pipeline(pipeline_name_or_id)
            
            spinner.stop("Pipeline stopped successfully!")
            console.print(f"Status: [yellow]{result.get('status', 'stopped')}[/yellow]")
            
        except Exception as e:
            spinner.fail(f"Failed to stop pipeline: {e}")
            sys.exit(1)

@pipeline.command()
@click.argument('pipeline_name_or_id')
@click.option(
    '--lines', '-n',
    type=click.IntRange(1, 10000),
    default=100,
    help='Number of log lines to show'
)
@click.option(
    '--follow', '-f',
    is_flag=True,
    help='Follow log output (like tail -f)'
)
@click.option(
    '--level',
    type=click.Choice(['DEBUG', 'INFO', 'WARNING', 'ERROR']),
    help='Filter by log level'
)
@click.pass_context
@handle_exceptions
def logs(ctx, pipeline_name_or_id: str, lines: int, follow: bool, level: Optional[str]):
    """
    View pipeline logs.
    
    Examples:
        schlep pipeline logs my-pipeline
        schlep pipeline logs pl-123456 --lines 500 --follow
        schlep pipeline logs my-pipeline --level ERROR
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    if follow:
        follow_pipeline_logs(client, pipeline_name_or_id, lines, level)
    else:
        show_pipeline_logs(client, pipeline_name_or_id, lines, level)

def show_pipeline_logs(client: APIClient, pipeline_id: str, lines: int, level: Optional[str]):
    """Show pipeline logs once."""
    with operation_spinner("Fetching logs", "Loading log entries..."):
        try:
            logs = client.get_pipeline_logs(pipeline_id, lines=lines)
        except Exception as e:
            console.print(f"[red]Failed to fetch logs: {e}[/red]")
            sys.exit(1)
    
    if not logs:
        console.print("[yellow]No logs found[/yellow]")
        return
    
    # Filter by level if specified
    if level:
        logs = [log for log in logs if level.upper() in log.upper()]
    
    console.print(f"[cyan]Showing last {len(logs)} log entries for {pipeline_id}[/cyan]\n")
    
    for log_line in logs:
        # Color code log levels
        if 'ERROR' in log_line:
            console.print(f"[red]{log_line}[/red]")
        elif 'WARNING' in log_line or 'WARN' in log_line:
            console.print(f"[yellow]{log_line}[/yellow]")
        elif 'INFO' in log_line:
            console.print(f"[cyan]{log_line}[/cyan]")
        elif 'DEBUG' in log_line:
            console.print(f"[dim]{log_line}[/dim]")
        else:
            console.print(log_line)

def follow_pipeline_logs(client: APIClient, pipeline_id: str, initial_lines: int, level: Optional[str]):
    """Follow pipeline logs with live updates."""
    console.print(f"[cyan]Following logs for pipeline: {pipeline_id}[/cyan]")
    console.print("[dim]Press Ctrl+C to stop following[/dim]\n")
    
    # Show initial logs
    show_pipeline_logs(client, pipeline_id, initial_lines, level)
    
    try:
        last_timestamp = time.time()
        
        while True:
            try:
                # Get new logs since last check
                logs = client.get_pipeline_logs(pipeline_id, lines=50)  # Get recent logs
                
                # In a real implementation, you'd filter by timestamp
                # For now, we'll just show all recent logs
                for log_line in logs:
                    if level and level.upper() not in log_line.upper():
                        continue
                    
                    # Color code log levels
                    if 'ERROR' in log_line:
                        console.print(f"[red]{log_line}[/red]")
                    elif 'WARNING' in log_line or 'WARN' in log_line:
                        console.print(f"[yellow]{log_line}[/yellow]")
                    elif 'INFO' in log_line:
                        console.print(f"[cyan]{log_line}[/cyan]")
                    elif 'DEBUG' in log_line:
                        console.print(f"[dim]{log_line}[/dim]")
                    else:
                        console.print(log_line)
                
                time.sleep(2)  # Check for new logs every 2 seconds
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                console.print(f"[red]Error following logs: {e}[/red]")
                break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped following logs[/yellow]")

@pipeline.command()
@click.argument('pipeline_name_or_id')
@click.option(
    '--force', '-f',
    is_flag=True,
    help='Force deletion without confirmation'
)
@click.pass_context
@handle_exceptions
def delete(ctx, pipeline_name_or_id: str, force: bool):
    """
    Delete a pipeline.
    
    Examples:
        schlep pipeline delete my-pipeline
        schlep pipeline delete pl-123456 --force
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    # Confirm deletion
    if not force:
        console.print(f"[yellow]Warning: This will permanently delete pipeline '{pipeline_name_or_id}'[/yellow]")
        if not Confirm.ask("Are you sure?", default=False):
            console.print("Deletion cancelled")
            return
    
    with operation_spinner("Deleting pipeline", "Removing pipeline and resources...") as spinner:
        try:
            success = client.delete_pipeline(pipeline_name_or_id)
            
            if success:
                spinner.stop("Pipeline deleted successfully!")
            else:
                spinner.fail("Failed to delete pipeline")
                sys.exit(1)
                
        except Exception as e:
            spinner.fail(f"Deletion failed: {e}")
            sys.exit(1)

def display_pipeline_config(config: Dict[str, Any], config_path: Path):
    """Display pipeline configuration for review."""
    config_text = Text()
    config_text.append("Pipeline Configuration\n\n", style="bold cyan")
    
    config_text.append(f"Config file: {config_path}\n", style="dim")
    config_text.append(f"Name: {config.get('name', 'Unnamed')}\n", style="white")
    config_text.append(f"Description: {config.get('description', 'No description')}\n", style="white")
    
    if 'tags' in config:
        tags = ', '.join(config['tags'])
        config_text.append(f"Tags: {tags}\n", style="cyan")
    
    if 'model_type' in config:
        config_text.append(f"Model type: {config['model_type']}\n", style="green")
    
    if 'features' in config:
        features = ', '.join(config['features'][:5])  # Show first 5 features
        if len(config['features']) > 5:
            features += f" ... (+{len(config['features']) - 5} more)"
        config_text.append(f"Features: {features}\n", style="yellow")
    
    if 'target' in config:
        config_text.append(f"Target: {config['target']}\n", style="magenta")
    
    console.print(Panel(config_text, title="Configuration Review", border_style="blue"))

def display_pipeline_details(pipeline_data: Dict[str, Any]):
    """Display detailed pipeline information."""
    # Basic information panel
    info_text = Text()
    info_text.append(f"Pipeline: {pipeline_data.get('name', 'Unknown')}\n", style="bold cyan")
    info_text.append(f"ID: {pipeline_data.get('id', 'N/A')}\n", style="dim")
    info_text.append(f"Description: {pipeline_data.get('description', 'No description')}\n", style="white")
    
    console.print(Panel(info_text, title="Pipeline Information", border_style="cyan"))
    
    # Status table
    status_table = create_pipeline_status_table(pipeline_data)
    display_table(status_table)
    
    # Steps/stages if available
    steps = pipeline_data.get('steps', [])
    if steps:
        steps_table = create_table(title="Pipeline Steps", show_lines=True)
        steps_table.add_column("Step", style="bold")
        steps_table.add_column("Status", justify="center")
        steps_table.add_column("Duration", justify="right")
        steps_table.add_column("Details")
        
        for i, step in enumerate(steps):
            status = step.get('status', 'pending').lower()
            if status == 'completed':
                status_display = "[green]✓ Completed[/green]"
            elif status == 'running':
                status_display = "[blue]▶ Running[/blue]"
            elif status == 'failed':
                status_display = "[red]✗ Failed[/red]"
            else:
                status_display = "[dim]⏸ Pending[/dim]"
            
            duration = step.get('duration', 0)
            duration_display = format_duration(duration) if duration > 0 else "[dim]N/A[/dim]"
            
            steps_table.add_row(
                f"{i+1}. {step.get('name', 'Unknown')}",
                status_display,
                duration_display,
                step.get('details', '')[:50] + "..." if len(step.get('details', '')) > 50 else step.get('details', '')
            )
        
        display_table(steps_table)

if __name__ == "__main__":
    pipeline()