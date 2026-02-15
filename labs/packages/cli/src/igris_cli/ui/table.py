"""
Table formatting components for Igris-engine CLI.
"""

from typing import List, Dict, Any, Optional, Union
from datetime import datetime

from rich.console import Console
from rich.table import Table
from rich.text import Text
from rich.align import Align

console = Console()

def create_table(
    title: Optional[str] = None,
    show_header: bool = True,
    show_lines: bool = False,
    expand: bool = False
) -> Table:
    """Create a formatted table."""
    return Table(
        title=title,
        show_header=show_header,
        show_lines=show_lines,
        expand=expand,
        header_style="bold cyan",
        title_style="bold magenta"
    )

def format_table_data(data: List[Dict[str, Any]], columns: List[str]) -> Table:
    """Format data into a table."""
    table = create_table(show_lines=True)
    
    # Add columns
    for column in columns:
        table.add_column(column.replace('_', ' ').title(), justify="left")
    
    # Add rows
    for item in data:
        row = []
        for column in columns:
            value = item.get(column, "")
            formatted_value = format_cell_value(value)
            row.append(formatted_value)
        table.add_row(*row)
    
    return table

def format_cell_value(value: Any) -> str:
    """Format a cell value for display."""
    if value is None:
        return "[dim]None[/dim]"
    elif isinstance(value, bool):
        return "[green]✓[/green]" if value else "[red]✗[/red]"
    elif isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    elif isinstance(value, (int, float)) and abs(value) >= 1000:
        # Format large numbers with commas
        return f"{value:,}"
    elif isinstance(value, str) and len(value) > 50:
        # Truncate long strings
        return value[:47] + "..."
    else:
        return str(value)

def create_status_table(items: List[Dict[str, Any]]) -> Table:
    """Create a table for status information."""
    table = create_table(title="Status Overview", show_lines=True)
    
    table.add_column("Component", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Details", justify="left")
    
    for item in items:
        status = item.get('status', 'unknown').lower()
        if status == 'healthy' or status == 'active' or status == 'running':
            status_display = "[green]✓ " + status.title() + "[/green]"
        elif status == 'warning' or status == 'pending':
            status_display = "[yellow]⚠ " + status.title() + "[/yellow]"
        elif status == 'error' or status == 'failed' or status == 'stopped':
            status_display = "[red]✗ " + status.title() + "[/red]"
        else:
            status_display = "[dim]" + status.title() + "[/dim]"
        
        table.add_row(
            item.get('name', ''),
            status_display,
            item.get('details', '')
        )
    
    return table

def create_pipeline_table(pipelines: List[Dict[str, Any]]) -> Table:
    """Create a table for pipeline information."""
    table = create_table(title="Pipelines", show_lines=True)
    
    table.add_column("ID", style="bold cyan")
    table.add_column("Name", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Created", justify="center")
    table.add_column("Duration", justify="right")
    table.add_column("Progress", justify="center")
    
    for pipeline in pipelines:
        # Format status
        status = pipeline.get('status', 'unknown').lower()
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
        
        # Format progress
        progress = pipeline.get('progress', 0)
        if isinstance(progress, (int, float)):
            if progress >= 100:
                progress_display = "[green]100%[/green]"
            elif progress >= 75:
                progress_display = f"[green]{progress:.1f}%[/green]"
            elif progress >= 50:
                progress_display = f"[yellow]{progress:.1f}%[/yellow]"
            elif progress > 0:
                progress_display = f"[cyan]{progress:.1f}%[/cyan]"
            else:
                progress_display = "[dim]0%[/dim]"
        else:
            progress_display = str(progress)
        
        # Format duration
        duration = pipeline.get('duration', 0)
        if isinstance(duration, (int, float)) and duration > 0:
            if duration < 60:
                duration_display = f"{duration:.1f}s"
            elif duration < 3600:
                duration_display = f"{duration/60:.1f}m"
            else:
                duration_display = f"{duration/3600:.1f}h"
        else:
            duration_display = "[dim]N/A[/dim]"
        
        table.add_row(
            pipeline.get('id', '')[:8],  # Truncate ID
            pipeline.get('name', ''),
            status_display,
            format_cell_value(pipeline.get('created_at')),
            duration_display,
            progress_display
        )
    
    return table

def create_metrics_table(metrics: Dict[str, Any]) -> Table:
    """Create a table for system metrics."""
    table = create_table(title="System Metrics", show_lines=True)
    
    table.add_column("Metric", style="bold")
    table.add_column("Value", justify="right")
    table.add_column("Unit", justify="left")
    table.add_column("Status", justify="center")
    
    # Common metrics to display
    metric_configs = {
        'cpu_usage': {'name': 'CPU Usage', 'unit': '%', 'threshold': 80},
        'memory_usage': {'name': 'Memory Usage', 'unit': '%', 'threshold': 85},
        'disk_usage': {'name': 'Disk Usage', 'unit': '%', 'threshold': 90},
        'active_connections': {'name': 'Active Connections', 'unit': '', 'threshold': 1000},
        'requests_per_minute': {'name': 'Requests/Minute', 'unit': 'req/min', 'threshold': 10000},
        'error_rate': {'name': 'Error Rate', 'unit': '%', 'threshold': 5},
        'response_time': {'name': 'Avg Response Time', 'unit': 'ms', 'threshold': 1000}
    }
    
    for key, config in metric_configs.items():
        if key in metrics:
            value = metrics[key]
            
            # Determine status based on threshold
            if isinstance(value, (int, float)):
                if value <= config['threshold'] * 0.5:
                    status_display = "[green]Good[/green]"
                elif value <= config['threshold']:
                    status_display = "[yellow]Fair[/yellow]"
                else:
                    status_display = "[red]High[/red]"
                
                # Format value
                if isinstance(value, float):
                    value_display = f"{value:.1f}"
                else:
                    value_display = f"{value:,}"
            else:
                value_display = str(value)
                status_display = "[dim]N/A[/dim]"
            
            table.add_row(
                config['name'],
                value_display,
                config['unit'],
                status_display
            )
    
    return table

def create_job_table(jobs: List[Dict[str, Any]]) -> Table:
    """Create a table for job information."""
    table = create_table(title="Jobs", show_lines=True)
    
    table.add_column("Job ID", style="bold cyan")
    table.add_column("Type", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Progress", justify="center")
    table.add_column("Created", justify="center")
    table.add_column("Duration", justify="right")
    
    for job in jobs:
        # Format status
        status = job.get('status', 'unknown').lower()
        status_icons = {
            'running': "[green]🏃 Running[/green]",
            'completed': "[blue]✅ Completed[/blue]",
            'failed': "[red]❌ Failed[/red]",
            'pending': "[yellow]⏳ Pending[/yellow]",
            'cancelled': "[orange1]🚫 Cancelled[/orange1]"
        }
        status_display = status_icons.get(status, f"[dim]{status.title()}[/dim]")
        
        # Format progress
        progress = job.get('progress', {})
        if isinstance(progress, dict):
            current = progress.get('current', 0)
            total = progress.get('total', 0)
            if total > 0:
                percentage = (current / total) * 100
                progress_display = f"{percentage:.1f}% ({current}/{total})"
            else:
                progress_display = f"{current} items"
        else:
            progress_display = str(progress)
        
        # Format duration
        created_at = job.get('created_at')
        if created_at and isinstance(created_at, datetime):
            duration = datetime.now() - created_at
            duration_seconds = duration.total_seconds()
            if duration_seconds < 60:
                duration_display = f"{duration_seconds:.0f}s"
            elif duration_seconds < 3600:
                duration_display = f"{duration_seconds/60:.1f}m"
            else:
                duration_display = f"{duration_seconds/3600:.1f}h"
        else:
            duration_display = "[dim]N/A[/dim]"
        
        table.add_row(
            job.get('id', '')[:12],  # Truncate ID
            job.get('type', 'Unknown'),
            status_display,
            progress_display,
            format_cell_value(job.get('created_at')),
            duration_display
        )
    
    return table

def display_table(table: Table, title: Optional[str] = None):
    """Display a table to the console."""
    if title:
        console.print(f"\n[bold magenta]{title}[/bold magenta]")
    console.print(table)
    console.print()  # Add spacing