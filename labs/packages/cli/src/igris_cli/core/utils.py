"""
Utility functions for Igris-engine CLI.
"""

import sys
import functools
import time
import signal
from typing import Callable, Any, Optional
from pathlib import Path
from rich.console import Console
from rich.traceback import install

# Install rich traceback handler
install(show_locals=True)

console = Console()

def handle_exceptions(func: Callable) -> Callable:
    """Decorator to handle exceptions gracefully."""
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except KeyboardInterrupt:
            console.print("\n[yellow]Operation cancelled by user[/yellow]")
            sys.exit(1)
        except Exception as e:
            if hasattr(e, '__module__') and 'igris' in e.__module__:
                # Handle SDK-specific exceptions
                console.print(f"[red]API Error: {e}[/red]")
            else:
                # Handle general exceptions
                console.print(f"[red]Error: {e}[/red]")
            
            # Show traceback in debug mode
            import os
            if os.getenv('IGRIS_DEBUG') == '1':
                console.print_exception()
            
            sys.exit(1)
    
    return wrapper

def check_api_connection(client) -> bool:
    """Check if API connection is healthy."""
    if not client or not client.is_authenticated:
        return False
    
    try:
        return client.health_check()
    except Exception:
        return False

def format_bytes(bytes_count: int) -> str:
    """Format bytes as human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} PB"

def format_duration(seconds: float) -> str:
    """Format duration in seconds as human readable string."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"

def validate_file_path(path: str) -> Path:
    """Validate and return Path object for file."""
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if not file_path.is_file():
        raise ValueError(f"Path is not a file: {path}")
    return file_path

def validate_directory_path(path: str, create: bool = False) -> Path:
    """Validate and return Path object for directory."""
    dir_path = Path(path)
    if not dir_path.exists():
        if create:
            dir_path.mkdir(parents=True)
        else:
            raise FileNotFoundError(f"Directory not found: {path}")
    elif not dir_path.is_dir():
        raise ValueError(f"Path is not a directory: {path}")
    return dir_path

def setup_signal_handlers():
    """Set up signal handlers for graceful shutdown."""
    def signal_handler(signum, frame):
        console.print("\n[yellow]Received interrupt signal, shutting down gracefully...[/yellow]")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

def retry_on_failure(max_attempts: int = 3, delay: float = 1.0, backoff_factor: float = 2.0):
    """Decorator to retry function on failure."""
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt == max_attempts - 1:
                        break
                    
                    wait_time = delay * (backoff_factor ** attempt)
                    console.print(f"[yellow]Attempt {attempt + 1} failed, retrying in {wait_time:.1f}s...[/yellow]")
                    time.sleep(wait_time)
            
            # If we get here, all attempts failed
            raise last_exception
        
        return wrapper
    return decorator

def confirm_action(message: str, default: bool = False) -> bool:
    """Ask user to confirm an action."""
    suffix = " [y/N]" if not default else " [Y/n]"
    
    try:
        response = input(f"{message}{suffix}: ").lower().strip()
        
        if not response:
            return default
        
        return response in ['y', 'yes', 'true', '1']
    
    except (KeyboardInterrupt, EOFError):
        console.print("\n[yellow]Operation cancelled[/yellow]")
        return False

def truncate_string(text: str, max_length: int = 50) -> str:
    """Truncate string to max length with ellipsis."""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."

def parse_key_value_pairs(pairs: list) -> dict:
    """Parse list of key=value strings into dictionary."""
    result = {}
    for pair in pairs:
        if '=' not in pair:
            raise ValueError(f"Invalid key=value pair: {pair}")
        key, value = pair.split('=', 1)
        result[key.strip()] = value.strip()
    return result

class Timer:
    """Context manager for timing operations."""
    
    def __init__(self, description: str = "Operation"):
        self.description = description
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        duration = self.end_time - self.start_time
        console.print(f"[dim]{self.description} completed in {format_duration(duration)}[/dim]")
    
    @property
    def duration(self) -> Optional[float]:
        """Get the duration if timing is complete."""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None