import click
from rich.console import Console
from rich.progress import Progress

console = Console()

@click.group()
def storage():
    """File storage - upload, download, management."""
    pass

@storage.command()
@click.argument('file', type=click.Path(exists=True))
@click.option('--public/--private', default=False)
@click.pass_context
def upload(ctx, file, public):
    """Upload file to storage."""
    console.print(f"[cyan]Uploading {file}...[/cyan]")

@storage.command()
@click.argument('file_id')
@click.option('--output', type=click.Path(), required=True)
@click.pass_context
def download(ctx, file_id, output):
    """Download file from storage."""
    console.print(f"[cyan]Downloading file {file_id}...[/cyan]")

@storage.command()
@click.option('--limit', default=20)
@click.pass_context
def list(ctx, limit):
    """List stored files."""
    console.print("[cyan]Listing files...[/cyan]")

@storage.command()
@click.argument('file_id')
@click.option('--force', is_flag=True)
@click.confirmation_option(prompt='Delete this file?')
@click.pass_context
def delete(ctx, file_id, force):
    """Delete file from storage."""
    console.print(f"[cyan]Deleting file {file_id}...[/cyan]")
