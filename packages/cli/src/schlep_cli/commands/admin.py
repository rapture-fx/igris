import click
from rich.console import Console
from rich.table import Table

console = Console()

@click.group()
def admin():
    """Administrative operations (requires admin privileges)."""
    pass

@admin.command()
@click.option('--status', type=click.Choice(['active', 'inactive', 'suspended']))
@click.option('--limit', default=50)
@click.pass_context
def list_users(ctx, status, limit):
    """List all users."""
    console.print("[cyan]Listing users...[/cyan]")

@admin.command()
@click.option('--format', type=click.Choice(['json', 'table']), default='table')
@click.pass_context
def system_stats(ctx, format):
    """Get system statistics."""
    console.print("[cyan]Fetching system statistics...[/cyan]")

@admin.command()
@click.argument('user_id')
@click.pass_context
def get_user(ctx, user_id):
    """Get user details."""
    console.print(f"[cyan]Fetching user: {user_id}[/cyan]")
