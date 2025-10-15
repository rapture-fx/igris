"""
Configuration management commands for Schlep-engine CLI.
"""

import sys
from typing import Optional, Dict, Any

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.table import Table

from ..core.config import Config
from ..core.utils import handle_exceptions, parse_key_value_pairs
from ..ui.table import create_table, display_table

console = Console()

@click.group()
def config():
    """Configuration management commands."""
    pass

@config.command()
@click.option(
    '--config-file',
    type=click.Path(),
    help='Specify config file location'
)
@click.pass_context
@handle_exceptions
def init(ctx, config_file: Optional[str]):
    """
    Initialize configuration file with defaults.
    
    Examples:
        schlep config init
        schlep config init --config-file ~/.schlep/custom-config.yml
    """
    try:
        config_obj = Config()
        
        if config_file:
            config_obj.save(config_file)
        else:
            config_obj.init_config()
            
        console.print("[green]✓ Configuration initialized successfully![/green]")
        
        # Show next steps
        next_steps = Text()
        next_steps.append("Next Steps:\n\n", style="bold cyan")
        next_steps.append("1. ", style="dim")
        next_steps.append("Set your API key: ", style="white")
        next_steps.append("schlep auth login\n", style="green")
        next_steps.append("2. ", style="dim")
        next_steps.append("Customize settings: ", style="white")
        next_steps.append("schlep config set <key> <value>\n", style="green")
        next_steps.append("3. ", style="dim")
        next_steps.append("View current config: ", style="white")
        next_steps.append("schlep config list\n", style="green")
        
        console.print(Panel(next_steps, title="Configuration Initialized", border_style="green"))
        
    except Exception as e:
        console.print(f"[red]Failed to initialize configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--config-file',
    type=click.Path(exists=True),
    help='Specify config file to read'
)
@click.pass_context
@handle_exceptions
def list(ctx, json: bool, config_file: Optional[str]):
    """
    List all configuration settings.
    
    Examples:
        schlep config list
        schlep config list --json
        schlep config list --config-file custom-config.yml
    """
    try:
        config_obj = Config.load(config_file)
        config_data = config_obj.get_dict()
        
        # Remove sensitive data from display
        display_data = config_data.copy()
        if 'api_key' in display_data:
            if display_data['api_key']:
                display_data['api_key'] = display_data['api_key'][:8] + "..." + display_data['api_key'][-4:]
            else:
                display_data['api_key'] = None
        
        if json:
            import json as json_lib
            console.print(json_lib.dumps(display_data, indent=2))
            return
        
        # Create configuration table
        config_table = create_table(title="Configuration Settings", show_lines=True)
        config_table.add_column("Setting", style="bold cyan")
        config_table.add_column("Value", style="white")
        config_table.add_column("Description", style="dim")
        
        # Define setting descriptions
        descriptions = {
            'api_key': 'API authentication key',
            'base_url': 'API endpoint URL',
            'timeout': 'Request timeout in seconds',
            'verify_ssl': 'SSL certificate verification',
            'default_format': 'Default output format for processing',
            'parallel_jobs': 'Number of parallel processing jobs',
            'auto_clean': 'Enable automatic data cleaning',
            'chunk_size': 'Processing chunk size',
            'output_dir': 'Default output directory',
            'log_level': 'Logging level',
            'show_progress': 'Display progress bars',
            'pipeline_timeout': 'Pipeline execution timeout',
            'retry_attempts': 'Number of retry attempts',
            'retry_delay': 'Delay between retries (seconds)'
        }
        
        # Group settings by category
        categories = {
            'API Settings': ['api_key', 'base_url', 'timeout', 'verify_ssl'],
            'Processing Settings': ['default_format', 'parallel_jobs', 'auto_clean', 'chunk_size'],
            'Output Settings': ['output_dir', 'log_level', 'show_progress'],
            'Pipeline Settings': ['pipeline_timeout', 'retry_attempts', 'retry_delay']
        }
        
        for category, settings in categories.items():
            # Add category header
            config_table.add_row(f"[bold magenta]{category}[/bold magenta]", "", "", style="magenta")
            
            for setting in settings:
                if setting in display_data:
                    value = display_data[setting]
                    if value is None:
                        value_str = "[dim]Not set[/dim]"
                    elif isinstance(value, bool):
                        value_str = "[green]✓[/green]" if value else "[red]✗[/red]"
                    else:
                        value_str = str(value)
                    
                    config_table.add_row(
                        f"  {setting}",
                        value_str,
                        descriptions.get(setting, "")
                    )
        
        display_table(config_table)
        
        # Show config file location
        config_file_path = config_obj.get_config_file()
        console.print(f"\n[dim]Configuration file: {config_file_path}[/dim]")
        
    except Exception as e:
        console.print(f"[red]Failed to load configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.argument('key')
@click.option(
    '--config-file',
    type=click.Path(exists=True),
    help='Specify config file to read'
)
@click.pass_context
@handle_exceptions
def get(ctx, key: str, config_file: Optional[str]):
    """
    Get a specific configuration value.
    
    Examples:
        schlep config get base_url
        schlep config get parallel_jobs
        schlep config get api_key --config-file custom-config.yml
    """
    try:
        config_obj = Config.load(config_file)
        
        if hasattr(config_obj, key):
            value = getattr(config_obj, key)
            
            # Handle sensitive data
            if key == 'api_key' and value:
                value = value[:8] + "..." + value[-4:]
            
            console.print(f"[cyan]{key}[/cyan]: [white]{value}[/white]")
        else:
            console.print(f"[red]Unknown configuration key: {key}[/red]")
            
            # Show available keys
            available_keys = [attr for attr in dir(config_obj) 
                            if not attr.startswith('_') and not callable(getattr(config_obj, attr))]
            console.print(f"\nAvailable keys: {', '.join(available_keys)}")
            sys.exit(1)
            
    except Exception as e:
        console.print(f"[red]Failed to get configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.argument('key')
@click.argument('value')
@click.option(
    '--config-file',
    type=click.Path(),
    help='Specify config file to modify'
)
@click.option(
    '--type', 'value_type',
    type=click.Choice(['string', 'int', 'float', 'bool']),
    help='Specify value type for conversion'
)
@click.pass_context
@handle_exceptions
def set(ctx, key: str, value: str, config_file: Optional[str], value_type: Optional[str]):
    """
    Set a configuration value.
    
    Examples:
        schlep config set parallel_jobs 8
        schlep config set base_url https://api.custom.com
        schlep config set auto_clean true --type bool
        schlep config set timeout 60 --type int
    """
    try:
        config_obj = Config.load(config_file)
        
        # Check if key exists
        if not hasattr(config_obj, key):
            console.print(f"[red]Unknown configuration key: {key}[/red]")
            
            # Show available keys
            available_keys = [attr for attr in dir(config_obj) 
                            if not attr.startswith('_') and not callable(getattr(config_obj, attr))]
            console.print(f"Available keys: {', '.join(available_keys)}")
            sys.exit(1)
        
        # Convert value to appropriate type
        original_value = getattr(config_obj, key)
        original_type = type(original_value)
        
        if value_type:
            # Use specified type
            if value_type == 'int':
                converted_value = int(value)
            elif value_type == 'float':
                converted_value = float(value)
            elif value_type == 'bool':
                converted_value = value.lower() in ['true', '1', 'yes', 'on']
            else:
                converted_value = str(value)
        else:
            # Try to match original type
            if original_type == int:
                converted_value = int(value)
            elif original_type == float:
                converted_value = float(value)
            elif original_type == bool:
                converted_value = value.lower() in ['true', '1', 'yes', 'on']
            else:
                converted_value = str(value)
        
        # Set the value
        setattr(config_obj, key, converted_value)
        
        # Save configuration (but don't save API key in config file)
        if key == 'api_key':
            config_obj.save_auth(converted_value)
        else:
            config_obj.save(config_file)
        
        console.print(f"[green]✓ Set {key} = {converted_value}[/green]")
        
        # Show warning for sensitive settings
        if key in ['api_key']:
            console.print("[yellow]Note: Sensitive values are stored securely[/yellow]")
        
    except ValueError as e:
        console.print(f"[red]Invalid value for {key}: {e}[/red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Failed to set configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.argument('key')
@click.option(
    '--config-file',
    type=click.Path(),
    help='Specify config file to modify'
)
@click.pass_context
@handle_exceptions
def unset(ctx, key: str, config_file: Optional[str]):
    """
    Unset (reset to default) a configuration value.
    
    Examples:
        schlep config unset parallel_jobs
        schlep config unset base_url
    """
    try:
        config_obj = Config.load(config_file)
        
        # Check if key exists
        if not hasattr(config_obj, key):
            console.print(f"[red]Unknown configuration key: {key}[/red]")
            sys.exit(1)
        
        # Get default value from a new Config instance
        default_config = Config()
        default_value = getattr(default_config, key)
        
        # Confirm reset
        current_value = getattr(config_obj, key)
        if not Confirm.ask(f"Reset {key} from '{current_value}' to default '{default_value}'?"):
            console.print("Reset cancelled")
            return
        
        # Reset to default
        setattr(config_obj, key, default_value)
        
        # Save configuration
        if key == 'api_key':
            if default_value:
                config_obj.save_auth(default_value)
            else:
                config_obj.clear_auth()
        else:
            config_obj.save(config_file)
        
        console.print(f"[green]✓ Reset {key} to default value: {default_value}[/green]")
        
    except Exception as e:
        console.print(f"[red]Failed to unset configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.argument('settings', nargs=-1)
@click.option(
    '--config-file',
    type=click.Path(),
    help='Specify config file to modify'
)
@click.pass_context
@handle_exceptions
def update(ctx, settings: tuple, config_file: Optional[str]):
    """
    Update multiple configuration values at once.
    
    Examples:
        schlep config update parallel_jobs=8 timeout=60 auto_clean=true
        schlep config update base_url=https://api.custom.com show_progress=false
    """
    if not settings:
        console.print("[red]No settings provided. Use key=value format.[/red]")
        console.print("Example: schlep config update parallel_jobs=8 timeout=60")
        sys.exit(1)
    
    try:
        # Parse key=value pairs
        updates = parse_key_value_pairs(list(settings))
        
        config_obj = Config.load(config_file)
        
        # Validate all keys first
        invalid_keys = []
        for key in updates.keys():
            if not hasattr(config_obj, key):
                invalid_keys.append(key)
        
        if invalid_keys:
            console.print(f"[red]Unknown configuration keys: {', '.join(invalid_keys)}[/red]")
            sys.exit(1)
        
        # Show what will be updated
        update_table = create_table(title="Configuration Updates", show_lines=True)
        update_table.add_column("Setting", style="bold cyan")
        update_table.add_column("Current Value", style="dim")
        update_table.add_column("New Value", style="green")
        
        for key, new_value in updates.items():
            current_value = getattr(config_obj, key)
            update_table.add_row(key, str(current_value), str(new_value))
        
        display_table(update_table)
        
        # Confirm updates
        if not Confirm.ask("Apply these configuration changes?", default=True):
            console.print("Updates cancelled")
            return
        
        # Apply updates
        updated_count = 0
        for key, value in updates.items():
            try:
                # Convert value to appropriate type
                original_value = getattr(config_obj, key)
                original_type = type(original_value)
                
                if original_type == int:
                    converted_value = int(value)
                elif original_type == float:
                    converted_value = float(value)
                elif original_type == bool:
                    converted_value = value.lower() in ['true', '1', 'yes', 'on']
                else:
                    converted_value = str(value)
                
                setattr(config_obj, key, converted_value)
                updated_count += 1
                
            except ValueError as e:
                console.print(f"[yellow]Warning: Skipped {key} - invalid value: {e}[/yellow]")
        
        # Save configuration
        has_auth_key = 'api_key' in updates
        if has_auth_key and updates['api_key']:
            config_obj.save_auth(updates['api_key'])
        
        config_obj.save(config_file)
        
        console.print(f"[green]✓ Updated {updated_count} configuration settings[/green]")
        
    except Exception as e:
        console.print(f"[red]Failed to update configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.option(
    '--config-file',
    type=click.Path(),
    help='Specify config file to reset'
)
@click.option(
    '--force', '-f',
    is_flag=True,
    help='Force reset without confirmation'
)
@click.pass_context
@handle_exceptions
def reset(ctx, config_file: Optional[str], force: bool):
    """
    Reset configuration to defaults.
    
    Examples:
        schlep config reset
        schlep config reset --force
        schlep config reset --config-file custom-config.yml
    """
    try:
        if not force:
            console.print("[yellow]Warning: This will reset all configuration to defaults[/yellow]")
            if not Confirm.ask("Are you sure?", default=False):
                console.print("Reset cancelled")
                return
        
        # Create new default config
        default_config = Config()
        
        # Save with defaults (but preserve API key)
        current_config = Config.load(config_file) if config_file else Config.load()
        api_key = current_config.api_key
        
        default_config.save(config_file)
        
        # Restore API key if it existed
        if api_key:
            default_config.save_auth(api_key)
            console.print("[cyan]Note: API key was preserved[/cyan]")
        
        console.print("[green]✓ Configuration reset to defaults[/green]")
        
    except Exception as e:
        console.print(f"[red]Failed to reset configuration: {e}[/red]")
        sys.exit(1)

@config.command()
@click.option(
    '--config-file',
    type=click.Path(exists=True),
    help='Specify config file to validate'
)
@click.pass_context
@handle_exceptions
def validate(ctx, config_file: Optional[str]):
    """
    Validate configuration settings.
    
    Examples:
        schlep config validate
        schlep config validate --config-file custom-config.yml
    """
    try:
        config_obj = Config.load(config_file)
        
        validation_results = []
        
        # Validate API settings
        if not config_obj.api_key:
            validation_results.append({
                'category': 'Authentication',
                'issue': 'No API key configured',
                'severity': 'error',
                'suggestion': 'Run: schlep auth login'
            })
        
        if config_obj.timeout <= 0:
            validation_results.append({
                'category': 'API',
                'issue': 'Invalid timeout value',
                'severity': 'error',
                'suggestion': 'Set timeout > 0'
            })
        
        # Validate processing settings
        if config_obj.parallel_jobs <= 0 or config_obj.parallel_jobs > 32:
            validation_results.append({
                'category': 'Processing',
                'issue': 'Parallel jobs should be between 1 and 32',
                'severity': 'warning',
                'suggestion': 'Adjust parallel_jobs setting'
            })
        
        if config_obj.chunk_size <= 0:
            validation_results.append({
                'category': 'Processing',
                'issue': 'Invalid chunk size',
                'severity': 'error',
                'suggestion': 'Set chunk_size > 0'
            })
        
        # Validate pipeline settings
        if config_obj.pipeline_timeout <= 0:
            validation_results.append({
                'category': 'Pipeline',
                'issue': 'Invalid pipeline timeout',
                'severity': 'error',
                'suggestion': 'Set pipeline_timeout > 0'
            })
        
        if config_obj.retry_attempts < 0:
            validation_results.append({
                'category': 'Pipeline',
                'issue': 'Retry attempts cannot be negative',
                'severity': 'error',
                'suggestion': 'Set retry_attempts >= 0'
            })
        
        # Display validation results
        if not validation_results:
            console.print("[green]✓ Configuration is valid[/green]")
        else:
            validation_table = create_table(title="Configuration Validation", show_lines=True)
            validation_table.add_column("Category", style="bold")
            validation_table.add_column("Issue", style="white")
            validation_table.add_column("Severity", justify="center")
            validation_table.add_column("Suggestion", style="dim")
            
            errors = 0
            warnings = 0
            
            for result in validation_results:
                severity = result['severity']
                if severity == 'error':
                    errors += 1
                    severity_display = "[red]Error[/red]"
                elif severity == 'warning':
                    warnings += 1
                    severity_display = "[yellow]Warning[/yellow]"
                else:
                    severity_display = "[blue]Info[/blue]"
                
                validation_table.add_row(
                    result['category'],
                    result['issue'],
                    severity_display,
                    result['suggestion']
                )
            
            display_table(validation_table)
            
            # Summary
            summary_text = Text()
            if errors > 0:
                summary_text.append(f"Found {errors} error(s)", style="red")
            if warnings > 0:
                if errors > 0:
                    summary_text.append(" and ", style="white")
                summary_text.append(f"{warnings} warning(s)", style="yellow")
            
            console.print(f"\n{summary_text}")
            
            if errors > 0:
                sys.exit(1)
        
    except Exception as e:
        console.print(f"[red]Failed to validate configuration: {e}[/red]")
        sys.exit(1)

if __name__ == "__main__":
    config()