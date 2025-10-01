import click
from rich.console import Console
from pathlib import Path

console = Console()

@click.group()
def document():
    """Document extraction - text, tables, images, OCR."""
    pass

@document.command()
@click.argument('file', type=click.Path(exists=True))
@click.option('--output', type=click.Path())
@click.option('--format', type=click.Choice(['pdf', 'docx', 'txt']), required=True)
@click.pass_context
def extract_text(ctx, file, output, format):
    """Extract text from document."""
    console.print(f"[cyan]Extracting text from {file}...[/cyan]")

@document.command()
@click.argument('file', type=click.Path(exists=True))
@click.option('--output', type=click.Path())
@click.pass_context
def extract_tables(ctx, file, output):
    """Extract tables from document."""
    console.print(f"[cyan]Extracting tables from {file}...[/cyan]")

@document.command()
@click.argument('file', type=click.Path(exists=True))
@click.option('--output-dir', type=click.Path())
@click.pass_context
def extract_images(ctx, file, output_dir):
    """Extract images from document."""
    console.print(f"[cyan]Extracting images from {file}...[/cyan]")

@document.command()
@click.argument('file', type=click.Path(exists=True))
@click.option('--language', default='eng')
@click.option('--output', type=click.Path())
@click.pass_context
def ocr(ctx, file, language, output):
    """Perform OCR on document."""
    console.print(f"[cyan]Performing OCR on {file}...[/cyan]")
