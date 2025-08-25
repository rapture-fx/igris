"""
Spinner and loading animations for Schlep-engine CLI.
"""

import time
import threading
from typing import Optional, Callable, Any
from contextlib import contextmanager

from rich.console import Console
from rich.spinner import Spinner
from rich.live import Live

console = Console()

@contextmanager
def show_spinner(message: str = "Processing...", spinner: str = "dots"):
    """Show a spinner while operation is running."""
    with console.status(f"[bold blue]{message}", spinner=spinner) as status:
        yield status

class CustomSpinner:
    """Custom spinner with more control."""
    
    def __init__(self, message: str = "Processing...", spinner_type: str = "dots"):
        self.message = message
        self.spinner_type = spinner_type
        self._running = False
        self._thread = None
        self._spinner = Spinner(spinner_type, text=message)
    
    def start(self):
        """Start the spinner."""
        if self._running:
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._spin)
        self._thread.daemon = True
        self._thread.start()
    
    def stop(self):
        """Stop the spinner."""
        if not self._running:
            return
        
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        console.print()  # Clear spinner line
    
    def update_message(self, message: str):
        """Update spinner message."""
        self.message = message
        self._spinner.text = message
    
    def _spin(self):
        """Internal spinning method."""
        with Live(self._spinner, console=console, refresh_per_second=10) as live:
            while self._running:
                time.sleep(0.1)
                live.update(self._spinner)
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()

class OperationSpinner:
    """Spinner for long-running operations with status updates."""
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.current_step = ""
        self._spinner = None
        self._running = False
    
    def start(self, initial_step: str = "Initializing..."):
        """Start the operation spinner."""
        self.current_step = initial_step
        self._running = True
        self._spinner = console.status(
            f"[bold blue]{self.operation_name}[/bold blue] - {initial_step}",
            spinner="dots"
        )
        self._spinner.__enter__()
    
    def update_step(self, step: str):
        """Update the current step."""
        if not self._running:
            return
        
        self.current_step = step
        if self._spinner:
            self._spinner.update(f"[bold blue]{self.operation_name}[/bold blue] - {step}")
    
    def stop(self, final_message: Optional[str] = None):
        """Stop the spinner."""
        if not self._running:
            return
        
        if self._spinner:
            self._spinner.__exit__(None, None, None)
        
        self._running = False
        
        if final_message:
            console.print(f"[green]✓[/green] {final_message}")
        else:
            console.print(f"[green]✓[/green] {self.operation_name} completed")
    
    def fail(self, error_message: Optional[str] = None):
        """Stop spinner with error."""
        if not self._running:
            return
        
        if self._spinner:
            self._spinner.__exit__(None, None, None)
        
        self._running = False
        
        if error_message:
            console.print(f"[red]✗[/red] {error_message}")
        else:
            console.print(f"[red]✗[/red] {self.operation_name} failed")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.stop()
        else:
            self.fail(f"{self.operation_name} failed: {exc_val}")

@contextmanager
def operation_spinner(operation_name: str, initial_step: str = "Starting..."):
    """Context manager for operation spinners."""
    spinner = OperationSpinner(operation_name)
    spinner.start(initial_step)
    try:
        yield spinner
    except Exception as e:
        spinner.fail(f"{operation_name} failed: {e}")
        raise
    else:
        spinner.stop()

def spinner_task(func: Callable, message: str = "Processing...", *args, **kwargs):
    """Execute a function with a spinner."""
    with show_spinner(message):
        return func(*args, **kwargs)

class MultiStepSpinner:
    """Spinner that shows progress through multiple steps."""
    
    def __init__(self, steps: list, operation_name: str = "Operation"):
        self.steps = steps
        self.operation_name = operation_name
        self.current_step_index = 0
        self._spinner = None
        self._running = False
    
    def start(self):
        """Start the multi-step spinner."""
        if not self.steps:
            return
        
        self._running = True
        self.current_step_index = 0
        current_step = self.steps[0]
        
        self._spinner = console.status(
            self._format_message(current_step),
            spinner="dots"
        )
        self._spinner.__enter__()
    
    def next_step(self):
        """Move to the next step."""
        if not self._running or not self._spinner:
            return
        
        self.current_step_index += 1
        
        if self.current_step_index < len(self.steps):
            current_step = self.steps[self.current_step_index]
            self._spinner.update(self._format_message(current_step))
        else:
            self.stop()
    
    def stop(self):
        """Stop the spinner."""
        if not self._running:
            return
        
        if self._spinner:
            self._spinner.__exit__(None, None, None)
        
        self._running = False
        console.print(f"[green]✓[/green] {self.operation_name} completed")
    
    def fail(self, error_message: Optional[str] = None):
        """Stop with error."""
        if not self._running:
            return
        
        if self._spinner:
            self._spinner.__exit__(None, None, None)
        
        self._running = False
        
        if error_message:
            console.print(f"[red]✗[/red] {error_message}")
        else:
            console.print(f"[red]✗[/red] {self.operation_name} failed")
    
    def _format_message(self, step: str) -> str:
        """Format the spinner message."""
        progress = f"({self.current_step_index + 1}/{len(self.steps)})"
        return f"[bold blue]{self.operation_name}[/bold blue] {progress} - {step}"
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.stop()
        else:
            self.fail(f"{self.operation_name} failed: {exc_val}")

@contextmanager
def multi_step_spinner(steps: list, operation_name: str = "Operation"):
    """Context manager for multi-step spinners."""
    spinner = MultiStepSpinner(steps, operation_name)
    try:
        yield spinner
    except Exception as e:
        if hasattr(spinner, '_running') and spinner._running:
            spinner.fail()
        raise