"""
Configuration management for Schlep-engine CLI.
"""

import os
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from rich.console import Console

console = Console()

@dataclass
class Config:
    """Configuration class for Schlep-engine CLI."""
    
    # API Configuration
    api_key: Optional[str] = None
    base_url: str = "https://api.schlep-engine.com"
    timeout: int = 30
    verify_ssl: bool = True
    
    # Processing Configuration
    default_format: str = "parquet"
    parallel_jobs: int = 4
    auto_clean: bool = True
    chunk_size: int = 1000
    
    # Output Configuration
    output_dir: str = "output"
    log_level: str = "INFO"
    show_progress: bool = True
    
    # Pipeline Configuration
    pipeline_timeout: int = 3600  # 1 hour
    retry_attempts: int = 3
    retry_delay: int = 5
    
    @classmethod
    def get_config_dir(cls) -> Path:
        """Get the configuration directory."""
        config_dir = Path.home() / ".schlep"
        config_dir.mkdir(exist_ok=True)
        return config_dir
    
    @classmethod
    def get_config_file(cls) -> Path:
        """Get the default configuration file path."""
        return cls.get_config_dir() / "config.yml"
    
    @classmethod
    def get_auth_file(cls) -> Path:
        """Get the authentication file path."""
        return cls.get_config_dir() / "auth.json"
    
    @classmethod
    def load(cls, config_file: Optional[str] = None) -> 'Config':
        """Load configuration from file or environment."""
        config = cls()
        
        # Load from file if exists
        if config_file:
            config_path = Path(config_file)
        else:
            config_path = cls.get_config_file()
        
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    if config_path.suffix.lower() in ['.yml', '.yaml']:
                        data = yaml.safe_load(f)
                    else:
                        data = json.load(f)
                
                if data:
                    for key, value in data.items():
                        if hasattr(config, key):
                            setattr(config, key, value)
            except Exception as e:
                console.print(f"[yellow]Warning: Failed to load config file {config_path}: {e}[/yellow]")
        
        # Override with environment variables
        config._load_from_env()
        
        # Load authentication
        config._load_auth()
        
        return config
    
    def _load_from_env(self):
        """Load configuration from environment variables."""
        env_mappings = {
            'SCHLEP_API_KEY': 'api_key',
            'SCHLEP_BASE_URL': 'base_url',
            'SCHLEP_TIMEOUT': 'timeout',
            'SCHLEP_VERIFY_SSL': 'verify_ssl',
            'SCHLEP_DEFAULT_FORMAT': 'default_format',
            'SCHLEP_PARALLEL_JOBS': 'parallel_jobs',
            'SCHLEP_AUTO_CLEAN': 'auto_clean',
            'SCHLEP_CHUNK_SIZE': 'chunk_size',
            'SCHLEP_OUTPUT_DIR': 'output_dir',
            'SCHLEP_LOG_LEVEL': 'log_level',
            'SCHLEP_SHOW_PROGRESS': 'show_progress',
            'SCHLEP_PIPELINE_TIMEOUT': 'pipeline_timeout',
            'SCHLEP_RETRY_ATTEMPTS': 'retry_attempts',
            'SCHLEP_RETRY_DELAY': 'retry_delay',
        }
        
        for env_key, attr_name in env_mappings.items():
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Convert string values to appropriate types
                attr_type = type(getattr(self, attr_name))
                if attr_type == bool:
                    setattr(self, attr_name, env_value.lower() in ['true', '1', 'yes', 'on'])
                elif attr_type == int:
                    try:
                        setattr(self, attr_name, int(env_value))
                    except ValueError:
                        pass
                else:
                    setattr(self, attr_name, env_value)
    
    def _load_auth(self):
        """Load authentication from auth file."""
        auth_file = self.get_auth_file()
        if auth_file.exists():
            try:
                with open(auth_file, 'r') as f:
                    auth_data = json.load(f)
                    if 'api_key' in auth_data:
                        self.api_key = auth_data['api_key']
            except Exception:
                pass  # Ignore auth file errors
    
    def save(self, config_file: Optional[str] = None) -> None:
        """Save configuration to file."""
        if config_file:
            config_path = Path(config_file)
        else:
            config_path = self.get_config_file()
        
        # Ensure directory exists
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert to dict and remove sensitive data
        data = asdict(self)
        data.pop('api_key', None)  # Don't save API key in config file
        
        try:
            with open(config_path, 'w') as f:
                yaml.dump(data, f, default_flow_style=False, indent=2)
            console.print(f"[green]Configuration saved to {config_path}[/green]")
        except Exception as e:
            console.print(f"[red]Failed to save configuration: {e}[/red]")
    
    def save_auth(self, api_key: str) -> None:
        """Save authentication to secure file."""
        auth_file = self.get_auth_file()
        auth_data = {'api_key': api_key}
        
        try:
            # Ensure directory exists
            auth_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(auth_file, 'w') as f:
                json.dump(auth_data, f, indent=2)
            
            # Set secure permissions (readable only by owner)
            os.chmod(auth_file, 0o600)
            
            self.api_key = api_key
        except Exception as e:
            console.print(f"[red]Failed to save authentication: {e}[/red]")
            raise
    
    def clear_auth(self) -> None:
        """Clear stored authentication."""
        auth_file = self.get_auth_file()
        if auth_file.exists():
            try:
                auth_file.unlink()
                self.api_key = None
                console.print("[green]Authentication cleared[/green]")
            except Exception as e:
                console.print(f"[red]Failed to clear authentication: {e}[/red]")
    
    def get_dict(self) -> Dict[str, Any]:
        """Get configuration as dictionary."""
        return asdict(self)
    
    def is_authenticated(self) -> bool:
        """Check if user is authenticated."""
        return bool(self.api_key)
    
    def init_config(self) -> None:
        """Initialize configuration with defaults."""
        config_dir = self.get_config_dir()
        config_file = self.get_config_file()
        
        # Create example config file if it doesn't exist
        if not config_file.exists():
            example_config = {
                'api': {
                    'base_url': self.base_url,
                    'timeout': self.timeout,
                    'verify_ssl': self.verify_ssl
                },
                'processing': {
                    'default_format': self.default_format,
                    'parallel_jobs': self.parallel_jobs,
                    'auto_clean': self.auto_clean,
                    'chunk_size': self.chunk_size
                },
                'output': {
                    'output_dir': self.output_dir,
                    'log_level': self.log_level,
                    'show_progress': self.show_progress
                },
                'pipelines': {
                    'timeout': self.pipeline_timeout,
                    'retry_attempts': self.retry_attempts,
                    'retry_delay': self.retry_delay
                }
            }
            
            try:
                with open(config_file, 'w') as f:
                    yaml.dump(example_config, f, default_flow_style=False, indent=2)
                console.print(f"[green]Configuration initialized at {config_file}[/green]")
            except Exception as e:
                console.print(f"[red]Failed to initialize configuration: {e}[/red]")