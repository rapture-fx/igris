"""
Progress tracking components for Igris-engine CLI.
"""

import time
from typing import Optional, Callable, Any
from contextlib import contextmanager

from rich.console import Console
from rich.progress import (
    Progress, TaskID, BarColumn, TextColumn, 
    TimeRemainingColumn, TimeElapsedColumn, 
    FileSizeColumn, TransferSpeedColumn,
    SpinnerColumn, MofNCompleteColumn
)

console = Console()

class ProgressTracker:
    """Advanced progress tracker with multiple progress types."""
    
    def __init__(self, show_progress: bool = True):
        self.show_progress = show_progress
        self._progress: Optional[Progress] = None
        self._tasks = {}
    
    def start(self):
        """Start the progress tracker."""
        if not self.show_progress:
            return
        
        self._progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            TimeRemainingColumn(),
            console=console,
            transient=False
        )
        self._progress.start()
    
    def stop(self):
        """Stop the progress tracker."""
        if self._progress:
            self._progress.stop()
            self._progress = None
            self._tasks.clear()
    
    def add_task(self, description: str, total: Optional[int] = None) -> TaskID:
        """Add a new task to track."""
        if not self._progress:
            return None
        
        task_id = self._progress.add_task(description, total=total)
        self._tasks[description] = task_id
        return task_id
    
    def update_task(self, task_id: TaskID, advance: int = 1, description: Optional[str] = None):
        """Update task progress."""
        if self._progress and task_id is not None:
            kwargs = {"advance": advance}
            if description:
                kwargs["description"] = description
            self._progress.update(task_id, **kwargs)
    
    def complete_task(self, task_id: TaskID):
        """Mark task as complete."""
        if self._progress and task_id is not None:
            self._progress.update(task_id, completed=self._progress.tasks[task_id].total)
    
    @contextmanager
    def task(self, description: str, total: Optional[int] = None):
        """Context manager for a single task."""
        task_id = self.add_task(description, total)
        try:
            yield task_id
        finally:
            if task_id is not None:
                self.complete_task(task_id)

def create_progress_bar(description: str = "Processing", show_speed: bool = False) -> Progress:
    """Create a customized progress bar."""
    columns = [
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=40),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn()
    ]
    
    if show_speed:
        columns.extend([
            TransferSpeedColumn(),
            TimeRemainingColumn()
        ])
    else:
        columns.append(TimeRemainingColumn())
    
    return Progress(*columns, console=console)

@contextmanager
def show_spinner(message: str = "Processing..."):
    """Show a spinner for operations without known progress."""
    with console.status(f"[bold blue]{message}") as status:
        yield status

class FileProgressTracker:
    """Specialized progress tracker for file operations."""
    
    def __init__(self, show_progress: bool = True):
        self.show_progress = show_progress
        self._progress: Optional[Progress] = None
    
    def start(self):
        """Start file progress tracking."""
        if not self.show_progress:
            return
        
        self._progress = Progress(
            TextColumn("[bold blue]{task.fields[filename]}", justify="right"),
            BarColumn(bar_width=40),
            TextColumn("[progress.percentage]{task.percentage:>3.1f}%"),
            FileSizeColumn(),
            TransferSpeedColumn(),
            TimeRemainingColumn(),
            console=console
        )
        self._progress.start()
    
    def stop(self):
        """Stop file progress tracking."""
        if self._progress:
            self._progress.stop()
            self._progress = None
    
    def track_file(self, filename: str, total_size: int):
        """Track progress for a file."""
        if not self._progress:
            return None
        
        return self._progress.add_task(
            "upload", 
            filename=filename, 
            total=total_size
        )
    
    def update_file_progress(self, task_id: TaskID, bytes_transferred: int):
        """Update file transfer progress."""
        if self._progress and task_id is not None:
            self._progress.update(task_id, completed=bytes_transferred)
    
    @contextmanager
    def file_operation(self, filename: str, total_size: int):
        """Context manager for file operations."""
        self.start()
        try:
            task_id = self.track_file(filename, total_size)
            yield lambda bytes_done: self.update_file_progress(task_id, bytes_done)
        finally:
            self.stop()

class BatchProgressTracker:
    """Progress tracker for batch operations."""
    
    def __init__(self, show_progress: bool = True):
        self.show_progress = show_progress
        self._progress: Optional[Progress] = None
        self._overall_task: Optional[TaskID] = None
        self._current_task: Optional[TaskID] = None
    
    def start(self, total_items: int, batch_description: str = "Processing batch"):
        """Start batch progress tracking."""
        if not self.show_progress:
            return
        
        self._progress = Progress(
            TextColumn("[bold green]Overall Progress"),
            BarColumn(),
            MofNCompleteColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            TimeRemainingColumn(),
            TextColumn(""),
            TextColumn("[bold blue]Current Item"),
            TextColumn("{task.fields[current_item]}"),
            console=console
        )
        self._progress.start()
        
        self._overall_task = self._progress.add_task(
            batch_description, 
            total=total_items
        )
    
    def stop(self):
        """Stop batch progress tracking."""
        if self._progress:
            self._progress.stop()
            self._progress = None
            self._overall_task = None
            self._current_task = None
    
    def start_item(self, item_name: str):
        """Start processing a new item."""
        if not self._progress:
            return
        
        if self._current_task:
            # Complete previous item
            self._progress.update(self._current_task, visible=False)
        
        self._current_task = self._progress.add_task(
            "current",
            current_item=f"Processing: {item_name}",
            total=None
        )
    
    def complete_item(self):
        """Complete current item."""
        if self._progress and self._overall_task:
            self._progress.update(self._overall_task, advance=1)
            if self._current_task:
                self._progress.update(self._current_task, visible=False)
    
    @contextmanager
    def batch_operation(self, total_items: int, description: str = "Processing batch"):
        """Context manager for batch operations."""
        self.start(total_items, description)
        try:
            yield self
        finally:
            self.stop()