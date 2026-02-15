"""
Test configuration management functionality.
"""

import json
import pytest
from pathlib import Path

from igris_cli.core.config import Config
from igris_cli.commands.config import config as config_cli


class TestConfig:
    """Test Configuration class."""
    
    def test_config_creation(self):
        """Test basic config creation."""
        config = Config()
        assert config.base_url == "https://api.igris-inertial.com"
        assert config.parallel_jobs == 4
        assert config.default_format == "parquet"
        assert config.timeout == 30
    
    def test_config_load_default(self, config_dir):
        """Test loading default configuration."""
        config = Config.load()
        assert isinstance(config, Config)
        assert config.base_url == "https://api.igris-inertial.com"
    
    def test_config_save_and_load(self, sample_config, config_dir):
        """Test saving and loading configuration."""
        # Save config
        sample_config.parallel_jobs = 8
        sample_config.save()
        
        # Load config
        loaded_config = Config.load()
        assert loaded_config.parallel_jobs == 8
        assert loaded_config.base_url == sample_config.base_url
    
    def test_config_auth_save_and_load(self, sample_config, config_dir):
        """Test saving and loading authentication."""
        api_key = "sk-test-key-12345"
        sample_config.save_auth(api_key)
        
        # Load config should include API key
        loaded_config = Config.load()
        assert loaded_config.api_key == api_key
        assert loaded_config.is_authenticated()
    
    def test_config_clear_auth(self, sample_config, config_dir):
        """Test clearing authentication."""
        sample_config.save_auth("sk-test-key")
        assert sample_config.is_authenticated()
        
        sample_config.clear_auth()
        assert not sample_config.is_authenticated()
        assert sample_config.api_key is None
    
    def test_config_environment_variables(self, monkeypatch):
        """Test configuration from environment variables."""
        monkeypatch.setenv('IGRIS_API_KEY', 'sk-env-key')
        monkeypatch.setenv('IGRIS_PARALLEL_JOBS', '16')
        monkeypatch.setenv('IGRIS_TIMEOUT', '60')
        monkeypatch.setenv('IGRIS_AUTO_CLEAN', 'true')
        
        config = Config.load()
        assert config.api_key == 'sk-env-key'
        assert config.parallel_jobs == 16
        assert config.timeout == 60
        assert config.auto_clean == True
    
    def test_config_get_dict(self, sample_config):
        """Test converting config to dictionary."""
        config_dict = sample_config.get_dict()
        assert isinstance(config_dict, dict)
        assert 'api_key' in config_dict
        assert 'base_url' in config_dict
        assert 'parallel_jobs' in config_dict
    
    def test_config_init_config(self, config_dir):
        """Test initializing configuration."""
        config = Config()
        config.init_config()
        
        config_file = config_dir / "config.yml"
        assert config_file.exists()
    
    @pytest.mark.parametrize("key,value,expected_type", [
        ("parallel_jobs", "8", int),
        ("timeout", "60", int), 
        ("auto_clean", "true", bool),
        ("base_url", "https://custom.api.com", str)
    ])
    def test_config_type_conversion(self, key, value, expected_type, monkeypatch):
        """Test environment variable type conversion."""
        env_key = f'IGRIS_{key.upper()}'
        monkeypatch.setenv(env_key, value)
        
        config = Config.load()
        actual_value = getattr(config, key)
        assert isinstance(actual_value, expected_type)


class TestConfigCLI:
    """Test configuration CLI commands."""
    
    def test_config_init_command(self, runner, config_dir):
        """Test config init command."""
        result = runner.invoke(config_cli, ['init'])
        assert result.exit_code == 0
        assert 'Configuration initialized' in result.output
        
        config_file = config_dir / "config.yml"
        assert config_file.exists()
    
    def test_config_list_command(self, runner, sample_config, config_dir):
        """Test config list command."""
        sample_config.save()
        
        result = runner.invoke(config_cli, ['list'])
        assert result.exit_code == 0
        assert 'Configuration Settings' in result.output
        assert 'base_url' in result.output
        assert 'parallel_jobs' in result.output
    
    def test_config_list_json(self, runner, sample_config, config_dir):
        """Test config list with JSON output."""
        sample_config.save()
        
        result = runner.invoke(config_cli, ['list', '--json'])
        assert result.exit_code == 0
        
        # Should be valid JSON
        config_data = json.loads(result.output)
        assert 'base_url' in config_data
    
    def test_config_get_command(self, runner, sample_config, config_dir):
        """Test config get command."""
        sample_config.save()
        
        result = runner.invoke(config_cli, ['get', 'base_url'])
        assert result.exit_code == 0
        assert sample_config.base_url in result.output
    
    def test_config_get_invalid_key(self, runner):
        """Test config get with invalid key."""
        result = runner.invoke(config_cli, ['get', 'invalid_key'])
        assert result.exit_code == 1
        assert 'Unknown configuration key' in result.output
    
    def test_config_set_command(self, runner, config_dir):
        """Test config set command."""
        result = runner.invoke(config_cli, ['set', 'parallel_jobs', '8'])
        assert result.exit_code == 0
        assert 'Set parallel_jobs = 8' in result.output
        
        # Verify the value was saved
        config = Config.load()
        assert config.parallel_jobs == 8
    
    def test_config_set_with_type(self, runner, config_dir):
        """Test config set with explicit type."""
        result = runner.invoke(config_cli, [
            'set', 'auto_clean', 'true', '--type', 'bool'
        ])
        assert result.exit_code == 0
        
        config = Config.load()
        assert config.auto_clean == True
    
    def test_config_set_invalid_key(self, runner):
        """Test config set with invalid key."""
        result = runner.invoke(config_cli, ['set', 'invalid_key', 'value'])
        assert result.exit_code == 1
        assert 'Unknown configuration key' in result.output
    
    def test_config_unset_command(self, runner, sample_config, config_dir):
        """Test config unset command."""
        sample_config.parallel_jobs = 16
        sample_config.save()
        
        # Use --force to skip confirmation
        result = runner.invoke(config_cli, ['unset', 'parallel_jobs'], input='y\n')
        assert result.exit_code == 0
        
        # Should be reset to default
        config = Config.load()
        assert config.parallel_jobs == 4  # default value
    
    def test_config_update_command(self, runner, config_dir):
        """Test config update command."""
        result = runner.invoke(config_cli, [
            'update', 
            'parallel_jobs=8',
            'timeout=60',
            'auto_clean=true'
        ], input='y\n')
        assert result.exit_code == 0
        assert 'Updated' in result.output
        
        config = Config.load()
        assert config.parallel_jobs == 8
        assert config.timeout == 60
        assert config.auto_clean == True
    
    def test_config_update_invalid_format(self, runner):
        """Test config update with invalid format."""
        result = runner.invoke(config_cli, ['update', 'invalid_format'])
        assert result.exit_code == 1
        assert 'key=value format' in result.output
    
    def test_config_reset_command(self, runner, sample_config, config_dir):
        """Test config reset command."""
        sample_config.parallel_jobs = 16
        sample_config.timeout = 120
        sample_config.save()
        
        result = runner.invoke(config_cli, ['reset', '--force'])
        assert result.exit_code == 0
        assert 'Configuration reset' in result.output
        
        # Should be back to defaults
        config = Config.load()
        assert config.parallel_jobs == 4
        assert config.timeout == 30
    
    def test_config_validate_command(self, runner, sample_config, config_dir):
        """Test config validate command."""
        sample_config.save()
        
        result = runner.invoke(config_cli, ['validate'])
        # Should pass validation (might show API key warning)
        assert result.exit_code in [0, 1]
    
    def test_config_validate_invalid_config(self, runner, config_dir):
        """Test config validate with invalid configuration."""
        # Create config with invalid values
        config = Config()
        config.timeout = -1  # Invalid
        config.parallel_jobs = -5  # Invalid
        config.save()
        
        result = runner.invoke(config_cli, ['validate'])
        assert result.exit_code == 1
        assert 'error' in result.output.lower()
    
    @pytest.mark.parametrize("setting,value", [
        ('parallel_jobs', '8'),
        ('timeout', '60'),
        ('auto_clean', 'true'),
        ('show_progress', 'false'),
    ])
    def test_config_set_various_settings(self, runner, config_dir, setting, value):
        """Test setting various configuration values."""
        result = runner.invoke(config_cli, ['set', setting, value])
        assert result.exit_code == 0
        
        # Verify the setting was saved
        result = runner.invoke(config_cli, ['get', setting])
        assert result.exit_code == 0


class TestConfigEdgeCases:
    """Test configuration edge cases."""
    
    def test_config_with_corrupted_auth_file(self, config_dir):
        """Test handling corrupted auth file."""
        # Create corrupted auth file
        auth_file = config_dir / "auth.json" 
        with open(auth_file, 'w') as f:
            f.write("invalid json content")
        
        # Should handle gracefully
        config = Config.load()
        assert config.api_key is None
    
    def test_config_with_missing_permissions(self, config_dir, monkeypatch):
        """Test config save with permission issues."""
        # Make directory read-only
        import os
        import stat
        
        try:
            config_dir.chmod(stat.S_IRUSR)
            config = Config()
            
            # Should handle permission error gracefully
            try:
                config.save()
            except PermissionError:
                pass  # Expected
        finally:
            # Restore permissions
            config_dir.chmod(stat.S_IRWXU)
    
    def test_config_file_path_resolution(self, temp_dir):
        """Test configuration file path resolution."""
        config = Config()
        
        # Test various path formats
        custom_config = temp_dir / "custom.yml"
        config.save(str(custom_config))
        assert custom_config.exists()
        
        # Load from custom path
        loaded_config = Config.load(str(custom_config))
        assert loaded_config.base_url == config.base_url
    
    def test_config_concurrent_access(self, sample_config, config_dir):
        """Test concurrent configuration access."""
        import threading
        import time
        
        def save_config(value):
            config = Config.load()
            config.parallel_jobs = value
            config.save()
        
        # Start multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=save_config, args=(i + 1,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # Should not crash, final value depends on timing
        final_config = Config.load()
        assert isinstance(final_config.parallel_jobs, int)
        assert 1 <= final_config.parallel_jobs <= 5


if __name__ == "__main__":
    pytest.main([__file__])