"""
Monitoring and analytics commands for Schlep-engine CLI.
"""

import sys
import time
from typing import Dict, Any, List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.live import Live
from rich.progress import track

from ..core.config import Config
from ..core.client import APIClient
from ..core.utils import handle_exceptions, format_bytes, format_duration
from ..ui.table import (
    create_status_table, create_metrics_table, create_job_table, 
    display_table, create_table
)
from ..ui.spinner import operation_spinner

console = Console()

@click.group()
def monitoring():
    """Monitoring and system analytics commands."""
    pass

@monitoring.command()
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--detailed', '-d',
    is_flag=True,
    help='Show detailed system information'
)
@click.pass_context
@handle_exceptions
def status(ctx, json: bool, detailed: bool):
    """
    Show system status and health.
    
    Examples:
        schlep monitoring status
        schlep monitoring status --detailed
        schlep monitoring status --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    show_status(client, json, detailed)

def show_status(client: APIClient, json_output: bool = False, detailed: bool = False):
    """Show system status."""
    with operation_spinner("Checking system status", "Gathering health information..."):
        try:
            # Get various status components
            api_health = client.health_check()
            user_info = client.get_user_info()
            
            # Get additional metrics if detailed
            metrics = {}
            if detailed:
                try:
                    metrics = client.get_system_metrics()
                except:
                    pass  # Metrics might not be available
            
            # Build status data
            status_data = {
                'api_connection': 'healthy' if api_health else 'unhealthy',
                'authentication': 'valid' if client.is_authenticated else 'invalid',
                'user': user_info.get('email', 'Unknown') if user_info else 'Unknown',
                'organization': user_info.get('organization', 'Personal') if user_info else 'Personal',
                'plan': user_info.get('plan', 'Free') if user_info else 'Free'
            }
            
            if detailed and metrics:
                status_data.update(metrics)
                
        except Exception as e:
            console.print(f"[red]Failed to get status: {e}[/red]")
            sys.exit(1)
    
    if json_output:
        import json
        console.print(json.dumps(status_data, indent=2))
        return
    
    # Create status display
    status_items = [
        {
            'name': 'API Connection',
            'status': status_data.get('api_connection', 'unknown'),
            'details': 'All endpoints accessible'
        },
        {
            'name': 'Authentication',
            'status': status_data.get('authentication', 'unknown'),
            'details': f"User: {status_data.get('user', 'Unknown')}"
        },
        {
            'name': 'Account',
            'status': 'active',
            'details': f"Plan: {status_data.get('plan', 'Unknown')} | Org: {status_data.get('organization', 'Unknown')}"
        }
    ]
    
    # Add system metrics if available
    if detailed and 'cpu_usage' in status_data:
        status_items.extend([
            {
                'name': 'System CPU',
                'status': 'healthy' if status_data.get('cpu_usage', 0) < 80 else 'warning',
                'details': f"{status_data.get('cpu_usage', 0):.1f}% usage"
            },
            {
                'name': 'System Memory',
                'status': 'healthy' if status_data.get('memory_usage', 0) < 85 else 'warning',
                'details': f"{status_data.get('memory_usage', 0):.1f}% usage"
            }
        ])
    
    table = create_status_table(status_items)
    display_table(table, "System Status")
    
    # Show usage summary if available
    if user_info and 'usage' in user_info:
        show_usage_summary(user_info['usage'])

def show_usage_summary(usage: Dict[str, Any]):
    """Show usage summary."""
    usage_text = Text()
    usage_text.append("Current Month Usage\n\n", style="bold cyan")
    
    # API calls
    api_calls = usage.get('api_calls', 0)
    api_limit = usage.get('api_calls_limit', 10000)
    api_percentage = (api_calls / api_limit) * 100 if api_limit > 0 else 0
    
    usage_text.append(f"API Calls: {api_calls:,} / {api_limit:,} ", style="white")
    if api_percentage >= 90:
        usage_text.append(f"({api_percentage:.1f}%)\n", style="red")
    elif api_percentage >= 75:
        usage_text.append(f"({api_percentage:.1f}%)\n", style="yellow")
    else:
        usage_text.append(f"({api_percentage:.1f}%)\n", style="green")
    
    # Data processed
    data_processed = usage.get('data_processed', 0)
    data_limit = usage.get('data_limit', 1000)
    data_percentage = (data_processed / data_limit) * 100 if data_limit > 0 else 0
    
    usage_text.append(f"Data Processed: {data_processed:,} MB / {data_limit:,} MB ", style="white")
    if data_percentage >= 90:
        usage_text.append(f"({data_percentage:.1f}%)\n", style="red")
    elif data_percentage >= 75:
        usage_text.append(f"({data_percentage:.1f}%)\n", style="yellow")
    else:
        usage_text.append(f"({data_percentage:.1f}%)\n", style="green")
    
    # Pipelines
    pipelines = usage.get('pipelines', 0)
    pipeline_limit = usage.get('pipeline_limit', 10)
    
    usage_text.append(f"Pipelines Run: {pipelines} / {pipeline_limit}\n", style="white")
    
    console.print(Panel(usage_text, title="Usage Summary", border_style="blue"))

@monitoring.command()
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch metrics with live updates'
)
@click.option(
    '--interval',
    type=click.IntRange(1, 300),
    default=5,
    help='Update interval in seconds (for watch mode)'
)
@click.pass_context
@handle_exceptions
def metrics(ctx, json: bool, watch: bool, interval: int):
    """
    Display system metrics and performance data.
    
    Examples:
        schlep monitoring metrics
        schlep monitoring metrics --watch
        schlep monitoring metrics --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    if watch:
        watch_metrics(client, interval)
    else:
        show_metrics(client, json)

def show_metrics(client: APIClient, json_output: bool = False):
    """Show system metrics once."""
    with operation_spinner("Fetching metrics", "Loading system metrics..."):
        try:
            metrics = client.get_system_metrics()
        except Exception as e:
            console.print(f"[red]Failed to fetch metrics: {e}[/red]")
            sys.exit(1)
    
    if not metrics:
        console.print("[yellow]No metrics available[/yellow]")
        return
    
    if json_output:
        import json
        console.print(json.dumps(metrics, indent=2))
        return
    
    # Display metrics table
    table = create_metrics_table(metrics)
    display_table(table, "System Metrics")

def watch_metrics(client: APIClient, interval: int):
    """Watch metrics with live updates."""
    console.print(f"[cyan]Watching system metrics (updating every {interval}s)[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    metrics = client.get_system_metrics()
                    if metrics:
                        table = create_metrics_table(metrics)
                        live.update(table, refresh=True)
                    
                    time.sleep(interval)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error fetching metrics: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching metrics[/yellow]")

@monitoring.command()
@click.option(
    '--status',
    type=click.Choice(['all', 'running', 'completed', 'failed', 'pending', 'cancelled']),
    default='all',
    help='Filter by job status'
)
@click.option(
    '--limit', '-l',
    type=click.IntRange(1, 100),
    default=20,
    help='Maximum number of jobs to show'
)
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.pass_context
@handle_exceptions
def jobs(ctx, status: str, limit: int, json: bool):
    """
    List and monitor processing jobs.
    
    Examples:
        schlep monitoring jobs
        schlep monitoring jobs --status running
        schlep monitoring jobs --limit 50 --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    with operation_spinner("Fetching jobs", "Loading job information..."):
        try:
            jobs = client.list_jobs(status=status if status != 'all' else None)
            jobs = jobs[:limit]  # Apply limit
        except Exception as e:
            console.print(f"[red]Failed to fetch jobs: {e}[/red]")
            sys.exit(1)
    
    if not jobs:
        status_text = f" with status '{status}'" if status != 'all' else ""
        console.print(f"[yellow]No jobs found{status_text}[/yellow]")
        return
    
    if json:
        import json as json_lib
        console.print(json_lib.dumps(jobs, indent=2))
    else:
        table = create_job_table(jobs)
        display_table(table, f"Jobs ({len(jobs)} found)")

@monitoring.command()
@click.argument('job_id')
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch job status with live updates'
)
@click.pass_context
@handle_exceptions
def job(ctx, job_id: str, json: bool, watch: bool):
    """
    Get detailed information about a specific job.
    
    Examples:
        schlep monitoring job job-123456
        schlep monitoring job job-123456 --watch
        schlep monitoring job job-123456 --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    if watch:
        watch_job_status(client, job_id)
    else:
        show_job_status(client, job_id, json)

def show_job_status(client: APIClient, job_id: str, json_output: bool = False):
    """Show job status once."""
    with operation_spinner("Fetching job details", "Loading job information..."):
        try:
            job_data = client.get_job_status(job_id)
        except Exception as e:
            console.print(f"[red]Failed to get job status: {e}[/red]")
            sys.exit(1)
    
    if not job_data:
        console.print(f"[yellow]Job {job_id} not found[/yellow]")
        return
    
    if json_output:
        import json
        console.print(json.dumps(job_data, indent=2))
        return
    
    # Display job details
    display_job_details(job_data)

def watch_job_status(client: APIClient, job_id: str):
    """Watch job status with live updates."""
    console.print(f"[cyan]Watching job: {job_id}[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    job_data = client.get_job_status(job_id)
                    if job_data:
                        table = create_job_details_table(job_data)
                        live.update(table, refresh=True)
                        
                        # Exit if job is completed
                        status = job_data.get('status', '').lower()
                        if status in ['completed', 'failed', 'cancelled']:
                            break
                    
                    time.sleep(3)  # Update every 3 seconds
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error fetching job status: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching job[/yellow]")

def create_job_details_table(job_data: Dict[str, Any]) -> create_table:
    """Create a detailed table for job information."""
    table = create_table(title=f"Job: {job_data.get('id', 'Unknown')}", show_lines=True)
    table.add_column("Attribute", style="bold")
    table.add_column("Value")
    
    # Basic info
    table.add_row("Job ID", job_data.get('id', 'N/A'))
    table.add_row("Type", job_data.get('type', 'Unknown'))
    
    # Status with color coding
    status = job_data.get('status', 'unknown').lower()
    status_icons = {
        'running': "[green]🏃 Running[/green]",
        'completed': "[blue]✅ Completed[/blue]",
        'failed': "[red]❌ Failed[/red]",
        'pending': "[yellow]⏳ Pending[/yellow]",
        'cancelled': "[orange1]🚫 Cancelled[/orange1]"
    }
    status_display = status_icons.get(status, f"[dim]{status.title()}[/dim]")
    table.add_row("Status", status_display)
    
    # Progress
    progress = job_data.get('progress', {})
    if isinstance(progress, dict):
        current = progress.get('current', 0)
        total = progress.get('total', 0)
        if total > 0:
            percentage = (current / total) * 100
            progress_bar = "█" * int(percentage / 10) + "░" * (10 - int(percentage / 10))
            table.add_row("Progress", f"{percentage:.1f}% [{progress_bar}] ({current}/{total})")
        else:
            table.add_row("Progress", f"{current} items processed")
    
    # Timing
    if 'created_at' in job_data:
        table.add_row("Created", job_data['created_at'])
    
    if 'started_at' in job_data:
        table.add_row("Started", job_data['started_at'])
    
    if 'duration' in job_data:
        table.add_row("Duration", format_duration(job_data['duration']))
    
    # Resource usage
    if 'resources' in job_data:
        resources = job_data['resources']
        table.add_row("CPU Usage", f"{resources.get('cpu_percent', 0):.1f}%")
        table.add_row("Memory Usage", f"{resources.get('memory_mb', 0):.1f} MB")
    
    # Error information
    if 'error' in job_data and job_data['error']:
        error_msg = job_data['error'][:100] + "..." if len(job_data['error']) > 100 else job_data['error']
        table.add_row("Error", f"[red]{error_msg}[/red]")
    
    return table

def display_job_details(job_data: Dict[str, Any]):
    """Display detailed job information."""
    table = create_job_details_table(job_data)
    display_table(table)
    
    # Show job logs if available
    if 'logs' in job_data and job_data['logs']:
        console.print("\n[cyan]Recent Logs:[/cyan]")
        for log_line in job_data['logs'][-10:]:  # Show last 10 log lines
            if 'ERROR' in log_line:
                console.print(f"[red]{log_line}[/red]")
            elif 'WARNING' in log_line:
                console.print(f"[yellow]{log_line}[/yellow]")
            else:
                console.print(f"[dim]{log_line}[/dim]")

@monitoring.command()
@click.argument('job_id')
@click.option(
    '--force', '-f',
    is_flag=True,
    help='Force cancel without confirmation'
)
@click.pass_context
@handle_exceptions
def cancel_job(ctx, job_id: str, force: bool):
    """
    Cancel a running job.
    
    Examples:
        schlep monitoring cancel-job job-123456
        schlep monitoring cancel-job job-123456 --force
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        sys.exit(1)
    
    # Confirm cancellation
    if not force:
        from rich.prompt import Confirm
        if not Confirm.ask(f"Cancel job '{job_id}'?", default=False):
            console.print("Cancellation cancelled")
            return
    
    with operation_spinner("Cancelling job", "Sending cancellation signal...") as spinner:
        try:
            success = client.cancel_job(job_id)
            
            if success:
                spinner.stop("Job cancelled successfully!")
            else:
                spinner.fail("Failed to cancel job")
                sys.exit(1)
                
        except Exception as e:
            spinner.fail(f"Cancellation failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    monitoring()