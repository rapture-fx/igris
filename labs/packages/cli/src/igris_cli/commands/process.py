"""
Data processing commands for Igris-engine CLI.
"""

import os
import sys
import glob
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.filesize import decimal
from rich.progress import track

from ..core.config import Config
from ..core.client import APIClient
from ..core.utils import (
    handle_exceptions, validate_file_path, validate_directory_path, 
    format_bytes, format_duration, Timer
)
from ..ui.progress import ProgressTracker, BatchProgressTracker, FileProgressTracker
from ..ui.table import create_table, display_table
from ..ui.spinner import operation_spinner

console = Console()

@click.group()
def process():
    """Data processing and file operations."""
    pass

@process.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option(
    '--output', '-o',
    help='Output file path (default: auto-generated)'
)
@click.option(
    '--format', 'output_format',
    type=click.Choice(['parquet', 'csv', 'json', 'xlsx']),
    help='Output format (default: parquet)'
)
@click.option(
    '--clean',
    is_flag=True,
    help='Enable automatic data cleaning'
)
@click.option(
    '--profile',
    is_flag=True,
    help='Generate data profiling report'
)
@click.option(
    '--config', 'config_file',
    type=click.Path(exists=True),
    help='Processing configuration file'
)
@click.option(
    '--no-progress',
    is_flag=True,
    help='Disable progress display'
)
@click.pass_context
@handle_exceptions
def file(ctx, file_path: str, output: Optional[str], output_format: Optional[str], 
         clean: bool, profile: bool, config_file: Optional[str], no_progress: bool):
    """
    Process a single file.
    
    Examples:
        igris process file data.csv
        igris process file data.csv --output processed.parquet --format parquet
        igris process file data.csv --clean --profile
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'igris auth login' first.[/red]")
        sys.exit(1)
    
    # Validate input file
    input_path = validate_file_path(file_path)
    file_size = input_path.stat().st_size
    
    # Prepare processing options
    processing_options = {
        'clean_data': clean,
        'generate_profile': profile,
        'output_format': output_format or config.default_format
    }
    
    # Load config file if provided
    if config_file:
        import yaml
        with open(config_file, 'r') as f:
            file_config = yaml.safe_load(f)
            processing_options.update(file_config)
    
    # Determine output path
    if not output:
        output_dir = Path(config.output_dir)
        output_dir.mkdir(exist_ok=True)
        
        output_name = input_path.stem + f"_processed.{processing_options['output_format']}"
        output = output_dir / output_name
    
    # Display processing info
    info_text = Text()
    info_text.append(f"Input: {input_path}\n", style="cyan")
    info_text.append(f"Size: {format_bytes(file_size)}\n", style="cyan")
    info_text.append(f"Output: {output}\n", style="cyan")
    info_text.append(f"Format: {processing_options['output_format']}\n", style="cyan")
    
    if clean:
        info_text.append("✓ Data cleaning enabled\n", style="green")
    if profile:
        info_text.append("✓ Profiling enabled\n", style="green")
    
    console.print(Panel(info_text, title="Processing Configuration", border_style="blue"))
    
    # Process the file
    with Timer("File processing"):
        try:
            if not no_progress and config.show_progress:
                progress_tracker = ProgressTracker()
                progress_tracker.start()
                
                with progress_tracker.task("Processing file", total=100) as task_id:
                    # Simulate progress updates (in real implementation, this would come from the API)
                    result = client.process_file(
                        file_path=str(input_path),
                        output_path=str(output),
                        **processing_options
                    )
                    
                    # Update progress as processing proceeds
                    for i in track(range(100), description="Processing..."):
                        progress_tracker.update_task(task_id, advance=1)
                
                progress_tracker.stop()
            else:
                with operation_spinner("Processing file", "Uploading and processing...") as spinner:
                    result = client.process_file(
                        file_path=str(input_path),
                        output_path=str(output),
                        **processing_options
                    )
            
            # Display results
            display_processing_results(result, input_path, output)
            
        except Exception as e:
            console.print(f"[red]Processing failed: {e}[/red]")
            sys.exit(1)

@process.command()
@click.argument('pattern')
@click.option(
    '--output-dir', '-d',
    help='Output directory (default: ./output)'
)
@click.option(
    '--format', 'output_format',
    type=click.Choice(['parquet', 'csv', 'json', 'xlsx']),
    help='Output format (default: parquet)'
)
@click.option(
    '--parallel', '-p',
    type=click.IntRange(1, 16),
    help='Number of parallel jobs (default: 4)'
)
@click.option(
    '--clean',
    is_flag=True,
    help='Enable automatic data cleaning'
)
@click.option(
    '--profile',
    is_flag=True,
    help='Generate data profiling reports'
)
@click.option(
    '--config', 'config_file',
    type=click.Path(exists=True),
    help='Processing configuration file'
)
@click.option(
    '--no-progress',
    is_flag=True,
    help='Disable progress display'
)
@click.option(
    '--continue-on-error',
    is_flag=True,
    help='Continue processing other files if one fails'
)
@click.pass_context
@handle_exceptions
def batch(ctx, pattern: str, output_dir: Optional[str], output_format: Optional[str],
          parallel: Optional[int], clean: bool, profile: bool, config_file: Optional[str],
          no_progress: bool, continue_on_error: bool):
    """
    Process multiple files in batch.
    
    Examples:
        igris process batch "data/*.csv"
        igris process batch "data/*.csv" --parallel 8 --clean
        igris process batch "**/*.json" --output-dir processed --format parquet
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'igris auth login' first.[/red]")
        sys.exit(1)
    
    # Find matching files
    files = glob.glob(pattern, recursive=True)
    files = [f for f in files if os.path.isfile(f)]
    
    if not files:
        console.print(f"[yellow]No files found matching pattern: {pattern}[/yellow]")
        return
    
    console.print(f"[cyan]Found {len(files)} files to process[/cyan]")
    
    # Setup output directory
    output_directory = Path(output_dir or config.output_dir)
    output_directory.mkdir(parents=True, exist_ok=True)
    
    # Prepare processing options
    processing_options = {
        'clean_data': clean,
        'generate_profile': profile,
        'output_format': output_format or config.default_format
    }
    
    # Load config file if provided
    if config_file:
        import yaml
        with open(config_file, 'r') as f:
            file_config = yaml.safe_load(f)
            processing_options.update(file_config)
    
    parallel_jobs = parallel or config.parallel_jobs
    
    # Display batch info
    info_text = Text()
    info_text.append(f"Files: {len(files)}\n", style="cyan")
    info_text.append(f"Output directory: {output_directory}\n", style="cyan")
    info_text.append(f"Format: {processing_options['output_format']}\n", style="cyan")
    info_text.append(f"Parallel jobs: {parallel_jobs}\n", style="cyan")
    
    total_size = sum(os.path.getsize(f) for f in files)
    info_text.append(f"Total size: {format_bytes(total_size)}\n", style="cyan")
    
    if clean:
        info_text.append("✓ Data cleaning enabled\n", style="green")
    if profile:
        info_text.append("✓ Profiling enabled\n", style="green")
    if continue_on_error:
        info_text.append("✓ Continue on error\n", style="yellow")
    
    console.print(Panel(info_text, title="Batch Processing Configuration", border_style="blue"))
    
    # Process files
    results = []
    errors = []
    
    with Timer("Batch processing"):
        if not no_progress and config.show_progress:
            with BatchProgressTracker().batch_operation(len(files), "Processing files") as batch_tracker:
                results, errors = process_files_parallel(
                    files, client, output_directory, processing_options,
                    parallel_jobs, continue_on_error, batch_tracker
                )
        else:
            with operation_spinner("Batch processing", f"Processing {len(files)} files..."):
                results, errors = process_files_parallel(
                    files, client, output_directory, processing_options,
                    parallel_jobs, continue_on_error, None
                )
    
    # Display batch results
    display_batch_results(results, errors, len(files))

def process_files_parallel(files: List[str], client: APIClient, output_dir: Path,
                          options: Dict[str, Any], max_workers: int, continue_on_error: bool,
                          progress_tracker: Optional[BatchProgressTracker] = None):
    """Process files in parallel."""
    results = []
    errors = []
    
    def process_single_file(file_path: str) -> Dict[str, Any]:
        try:
            input_path = Path(file_path)
            output_name = input_path.stem + f"_processed.{options['output_format']}"
            output_path = output_dir / output_name
            
            if progress_tracker:
                progress_tracker.start_item(input_path.name)
            
            result = client.process_file(
                file_path=str(input_path),
                output_path=str(output_path),
                **options
            )
            
            result['input_file'] = str(input_path)
            result['output_file'] = str(output_path)
            result['success'] = True
            
            if progress_tracker:
                progress_tracker.complete_item()
            
            return result
            
        except Exception as e:
            error_result = {
                'input_file': file_path,
                'error': str(e),
                'success': False
            }
            
            if progress_tracker:
                progress_tracker.complete_item()
            
            if not continue_on_error:
                raise
            
            return error_result
    
    # Process files in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {executor.submit(process_single_file, file_path): file_path 
                          for file_path in files}
        
        for future in as_completed(future_to_file):
            try:
                result = future.result()
                if result['success']:
                    results.append(result)
                else:
                    errors.append(result)
            except Exception as e:
                file_path = future_to_file[future]
                errors.append({
                    'input_file': file_path,
                    'error': str(e),
                    'success': False
                })
    
    return results, errors

def display_processing_results(result: Dict[str, Any], input_path: Path, output_path: Path):
    """Display processing results."""
    # Create results table
    table = create_table(title="Processing Results", show_lines=True)
    table.add_column("Metric", style="bold")
    table.add_column("Value", justify="right")
    
    # Basic stats
    table.add_row("Input file", str(input_path))
    table.add_row("Output file", str(output_path))
    
    if 'processing_time' in result:
        table.add_row("Processing time", format_duration(result['processing_time']))
    
    if 'input_rows' in result:
        table.add_row("Input rows", f"{result['input_rows']:,}")
    
    if 'output_rows' in result:
        table.add_row("Output rows", f"{result['output_rows']:,}")
        if 'input_rows' in result:
            filtered = result['input_rows'] - result['output_rows']
            if filtered > 0:
                percentage = (filtered / result['input_rows']) * 100
                table.add_row("Filtered rows", f"{filtered:,} ({percentage:.1f}%)")
    
    if 'input_size' in result:
        table.add_row("Input size", format_bytes(result['input_size']))
    
    if 'output_size' in result:
        table.add_row("Output size", format_bytes(result['output_size']))
        if 'input_size' in result:
            compression = (1 - result['output_size'] / result['input_size']) * 100
            if compression > 0:
                table.add_row("Compression", f"{compression:.1f}%")
    
    if 'data_quality_score' in result:
        score = result['data_quality_score']
        if score >= 0.9:
            quality_style = "green"
        elif score >= 0.7:
            quality_style = "yellow"
        else:
            quality_style = "red"
        table.add_row("Data quality", f"[{quality_style}]{score:.1%}[/{quality_style}]")
    
    display_table(table)
    
    # Show data profile if available
    if 'profile' in result:
        display_data_profile(result['profile'])

def display_batch_results(results: List[Dict[str, Any]], errors: List[Dict[str, Any]], total_files: int):
    """Display batch processing results."""
    successful = len(results)
    failed = len(errors)
    
    # Summary
    summary_text = Text()
    summary_text.append(f"Total files: {total_files}\n", style="cyan")
    summary_text.append(f"Successful: {successful}\n", style="green")
    if failed > 0:
        summary_text.append(f"Failed: {failed}\n", style="red")
    
    # Calculate totals
    if results:
        total_input_rows = sum(r.get('input_rows', 0) for r in results)
        total_output_rows = sum(r.get('output_rows', 0) for r in results)
        total_processing_time = sum(r.get('processing_time', 0) for r in results)
        
        summary_text.append(f"\nTotal input rows: {total_input_rows:,}\n", style="cyan")
        summary_text.append(f"Total output rows: {total_output_rows:,}\n", style="cyan")
        summary_text.append(f"Total processing time: {format_duration(total_processing_time)}\n", style="cyan")
    
    console.print(Panel(summary_text, title="Batch Results Summary", border_style="green"))
    
    # Show errors if any
    if errors:
        error_table = create_table(title="Failed Files", show_lines=True)
        error_table.add_column("File", style="bold red")
        error_table.add_column("Error", style="red")
        
        for error in errors:
            error_table.add_row(
                error['input_file'],
                error['error'][:100] + "..." if len(error['error']) > 100 else error['error']
            )
        
        display_table(error_table)

def display_data_profile(profile: Dict[str, Any]):
    """Display data profiling results."""
    if not profile:
        return
    
    profile_table = create_table(title="Data Profile", show_lines=True)
    profile_table.add_column("Column", style="bold")
    profile_table.add_column("Type", justify="center")
    profile_table.add_column("Non-null", justify="right")
    profile_table.add_column("Unique", justify="right")
    profile_table.add_column("Top Value", justify="left")
    
    columns = profile.get('columns', {})
    for col_name, col_info in columns.items():
        profile_table.add_row(
            col_name,
            col_info.get('type', 'unknown'),
            f"{col_info.get('non_null_percentage', 0):.1f}%",
            str(col_info.get('unique_count', 0)),
            str(col_info.get('top_value', ''))[:30]
        )
    
    display_table(profile_table)

@process.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option(
    '--bucket',
    help='Storage bucket name'
)
@click.option(
    '--key',
    help='Storage key/path'
)
@click.option(
    '--public',
    is_flag=True,
    help='Make uploaded file public'
)
@click.option(
    '--metadata',
    multiple=True,
    help='Metadata key=value pairs'
)
@click.pass_context
@handle_exceptions
def upload(ctx, file_path: str, bucket: Optional[str], key: Optional[str], 
           public: bool, metadata: tuple):
    """
    Upload a file to storage.
    
    Examples:
        igris process upload data.csv
        igris process upload data.csv --bucket my-bucket --key data/input.csv
        igris process upload data.csv --public --metadata project=demo
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'igris auth login' first.[/red]")
        sys.exit(1)
    
    input_path = validate_file_path(file_path)
    file_size = input_path.stat().st_size
    
    # Parse metadata
    metadata_dict = {}
    for item in metadata:
        if '=' in item:
            k, v = item.split('=', 1)
            metadata_dict[k.strip()] = v.strip()
    
    # Prepare upload options
    upload_options = {
        'bucket': bucket,
        'key': key,
        'public': public,
        'metadata': metadata_dict
    }
    
    console.print(f"[cyan]Uploading {input_path} ({format_bytes(file_size)})[/cyan]")
    
    with FileProgressTracker().file_operation(input_path.name, file_size) as update_progress:
        try:
            result = client.upload_file(
                file_path=str(input_path),
                **upload_options
            )
            
            console.print(f"[green]✓ Upload successful[/green]")
            console.print(f"File ID: {result.get('file_id', 'N/A')}")
            console.print(f"URL: {result.get('url', 'N/A')}")
            
        except Exception as e:
            console.print(f"[red]Upload failed: {e}[/red]")
            sys.exit(1)

@process.command()
@click.argument('file_id')
@click.option(
    '--output', '-o',
    type=click.Path(),
    help='Output file path'
)
@click.pass_context
@handle_exceptions
def download(ctx, file_id: str, output: Optional[str]):
    """
    Download a file from storage.
    
    Examples:
        igris process download file-12345
        igris process download file-12345 --output downloaded_data.csv
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not client or not client.is_authenticated:
        console.print("[red]Not authenticated. Run 'igris auth login' first.[/red]")
        sys.exit(1)
    
    if not output:
        output = f"downloaded_{file_id}"
    
    console.print(f"[cyan]Downloading {file_id} to {output}[/cyan]")
    
    with operation_spinner("Downloading file", "Fetching from storage..."):
        try:
            success = client.download_file(
                file_id=file_id,
                output_path=output
            )
            
            if success:
                output_path = Path(output)
                if output_path.exists():
                    file_size = output_path.stat().st_size
                    console.print(f"[green]✓ Download successful ({format_bytes(file_size)})[/green]")
                    console.print(f"Saved to: {output_path}")
                else:
                    console.print(f"[yellow]Download completed but file not found at {output}[/yellow]")
            else:
                console.print("[red]Download failed[/red]")
                sys.exit(1)
                
        except Exception as e:
            console.print(f"[red]Download failed: {e}[/red]")
            sys.exit(1)

if __name__ == "__main__":
    process()