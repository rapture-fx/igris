"""
API client wrapper for Igris-engine CLI.
"""

import asyncio
from typing import Optional, Dict, Any, List, Union
from pathlib import Path

from rich.console import Console

try:
    from igris import IgrisClient
    from igris.exceptions import IgrisError, AuthenticationError, RateLimitError
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    IgrisClient = None
    IgrisError = Exception
    AuthenticationError = Exception
    RateLimitError = Exception

console = Console()

class APIClient:
    """Wrapper for Igris-engine SDK with CLI-specific functionality."""
    
    def __init__(self, config):
        """Initialize API client with configuration."""
        self.config = config
        self._client = None
        self._authenticated = False
        
        if not SDK_AVAILABLE:
            console.print("[yellow]Warning: Igris-engine SDK not available. Install with: pip install igris-inertial[/yellow]")
            return
        
        if config and config.api_key:
            try:
                self._client = IgrisClient(
                    api_key=config.api_key,
                    base_url=config.base_url,
                    timeout=config.timeout,
                    verify_ssl=config.verify_ssl
                )
                self._authenticated = True
            except Exception as e:
                console.print(f"[yellow]Warning: Failed to initialize API client: {e}[/yellow]")
    
    @property
    def client(self) -> Optional[IgrisClient]:
        """Get the underlying SDK client."""
        return self._client
    
    @property
    def is_authenticated(self) -> bool:
        """Check if client is authenticated."""
        return self._authenticated and self._client is not None
    
    def authenticate(self, api_key: str) -> bool:
        """Authenticate with API key."""
        if not SDK_AVAILABLE:
            console.print("[red]Igris-engine SDK not available[/red]")
            return False
        
        try:
            self._client = IgrisClient(
                api_key=api_key,
                base_url=self.config.base_url if self.config else "https://api.igris-inertial.com",
                timeout=self.config.timeout if self.config else 30,
                verify_ssl=self.config.verify_ssl if self.config else True
            )
            
            # Test authentication by making a simple API call
            self.health_check()
            
            self._authenticated = True
            return True
            
        except AuthenticationError:
            console.print("[red]Invalid API key[/red]")
            return False
        except Exception as e:
            console.print(f"[red]Authentication failed: {e}[/red]")
            return False
    
    def health_check(self) -> bool:
        """Check API health."""
        if not self.is_authenticated:
            return False
        
        try:
            # Use the SDK's health check if available
            if hasattr(self._client, 'health') and hasattr(self._client.health, 'check'):
                response = self._client.health.check()
                return response.get('status') == 'healthy'
            return True
        except Exception:
            return False
    
    def get_user_info(self) -> Optional[Dict[str, Any]]:
        """Get current user information."""
        if not self.is_authenticated:
            return None
        
        try:
            if hasattr(self._client, 'users') and hasattr(self._client.users, 'get_current'):
                return self._client.users.get_current()
        except Exception:
            pass
        
        return None
    
    def process_file(self, file_path: Union[str, Path], **kwargs) -> Dict[str, Any]:
        """Process a single file."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.data.process_data(
                data_source=str(file_path),
                **kwargs
            )
        except Exception as e:
            console.print(f"[red]Processing failed: {e}[/red]")
            raise
    
    def batch_process_files(self, file_patterns: List[str], **kwargs) -> List[Dict[str, Any]]:
        """Process multiple files in batch."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        # This would be implemented based on the actual SDK batch processing capabilities
        results = []
        for pattern in file_patterns:
            try:
                result = self._client.data.process_data(
                    data_source=pattern,
                    **kwargs
                )
                results.append(result)
            except Exception as e:
                console.print(f"[red]Failed to process {pattern}: {e}[/red]")
        
        return results
    
    def create_pipeline(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new ML pipeline."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.ml.create_pipeline(config=config)
        except Exception as e:
            console.print(f"[red]Pipeline creation failed: {e}[/red]")
            raise
    
    def list_pipelines(self) -> List[Dict[str, Any]]:
        """List all pipelines."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.ml.list_pipelines()
        except Exception as e:
            console.print(f"[red]Failed to list pipelines: {e}[/red]")
            raise
    
    def get_pipeline_status(self, pipeline_id: str) -> Dict[str, Any]:
        """Get pipeline status."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.ml.get_pipeline_status(pipeline_id)
        except Exception as e:
            console.print(f"[red]Failed to get pipeline status: {e}[/red]")
            raise
    
    def start_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """Start a pipeline."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.ml.start_pipeline(pipeline_id)
        except Exception as e:
            console.print(f"[red]Failed to start pipeline: {e}[/red]")
            raise
    
    def stop_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """Stop a pipeline."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.ml.stop_pipeline(pipeline_id)
        except Exception as e:
            console.print(f"[red]Failed to stop pipeline: {e}[/red]")
            raise
    
    def delete_pipeline(self, pipeline_id: str) -> bool:
        """Delete a pipeline."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            result = self._client.ml.delete_pipeline(pipeline_id)
            return result.get('success', False)
        except Exception as e:
            console.print(f"[red]Failed to delete pipeline: {e}[/red]")
            raise
    
    def get_pipeline_logs(self, pipeline_id: str, lines: int = 100) -> List[str]:
        """Get pipeline logs."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.ml.get_pipeline_logs(pipeline_id, lines=lines)
        except Exception as e:
            console.print(f"[red]Failed to get pipeline logs: {e}[/red]")
            raise
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get system metrics."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            if hasattr(self._client, 'monitoring') and hasattr(self._client.monitoring, 'get_metrics'):
                return self._client.monitoring.get_metrics()
        except Exception as e:
            console.print(f"[red]Failed to get metrics: {e}[/red]")
        
        return {}
    
    def list_jobs(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List processing jobs."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            if hasattr(self._client, 'jobs'):
                return self._client.jobs.list(status=status)
        except Exception as e:
            console.print(f"[red]Failed to list jobs: {e}[/red]")
        
        return []
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get job status."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            if hasattr(self._client, 'jobs'):
                return self._client.jobs.get_status(job_id)
        except Exception as e:
            console.print(f"[red]Failed to get job status: {e}[/red]")
        
        return {}
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            if hasattr(self._client, 'jobs'):
                result = self._client.jobs.cancel(job_id)
                return result.get('success', False)
        except Exception as e:
            console.print(f"[red]Failed to cancel job: {e}[/red]")
        
        return False
    
    def upload_file(self, file_path: Union[str, Path], **kwargs) -> Dict[str, Any]:
        """Upload a file to storage."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            return self._client.storage.upload(file_path=str(file_path), **kwargs)
        except Exception as e:
            console.print(f"[red]Upload failed: {e}[/red]")
            raise
    
    def download_file(self, file_id: str, output_path: Union[str, Path]) -> bool:
        """Download a file from storage."""
        if not self.is_authenticated:
            raise AuthenticationError("Not authenticated. Run 'igris auth login' first.")
        
        try:
            result = self._client.storage.download(file_id=file_id, output_path=str(output_path))
            return result.get('success', False)
        except Exception as e:
            console.print(f"[red]Download failed: {e}[/red]")
            return False