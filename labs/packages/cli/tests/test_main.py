"""
Test main CLI interface.
"""

import pytest
from click.testing import CliRunner

from igris_cli.main import cli
from igris_cli import __version__


class TestMainCLI:
    """Test main CLI functionality."""
    
    def test_cli_help(self, runner):
        """Test CLI help command."""
        result = runner.invoke(cli, ['--help'])
        assert result.exit_code == 0
        assert 'Igris-engine CLI' in result.output
        assert 'Advanced data processing' in result.output
        assert 'auth' in result.output
        assert 'process' in result.output
        assert 'pipeline' in result.output
    
    def test_cli_version(self, runner):
        """Test CLI version command."""
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
        assert __version__ in result.output
    
    def test_version_command(self, runner):
        """Test version subcommand."""
        result = runner.invoke(cli, ['version'])
        assert result.exit_code == 0
        assert __version__ in result.output
    
    def test_cli_no_args_shows_welcome(self, runner):
        """Test CLI without arguments shows welcome message."""
        result = runner.invoke(cli, [])
        assert result.exit_code == 0
        assert 'Welcome to Igris-engine CLI' in result.output
        assert 'igris auth login' in result.output
    
    def test_cli_with_debug_flag(self, runner):
        """Test CLI with debug flag."""
        result = runner.invoke(cli, ['--debug', '--version'])
        assert result.exit_code == 0
    
    def test_cli_with_config_file(self, runner, sample_config, temp_dir):
        """Test CLI with custom config file."""
        config_file = temp_dir / "custom_config.yml"
        sample_config.save(str(config_file))
        
        result = runner.invoke(cli, ['--config-file', str(config_file), '--version'])
        assert result.exit_code == 0
    
    def test_health_command_without_auth(self, runner):
        """Test health command without authentication."""
        result = runner.invoke(cli, ['health'])
        assert result.exit_code == 1
        assert 'No API client configured' in result.output
    
    def test_health_command_with_auth(self, runner, auth_context, monkeypatch):
        """Test health command with authentication."""
        # Mock the context object
        def mock_cli_with_context(*args, **kwargs):
            kwargs['obj'] = auth_context
            return cli.main(*args, **kwargs)
        
        with monkeypatch.context() as m:
            m.setattr('igris_cli.main.cli.main', mock_cli_with_context)
            result = runner.invoke(cli, ['health'])
            # Note: This might still fail due to the complex mocking needed
            # In a real test environment, we'd use more sophisticated mocking
    
    def test_status_command_without_auth(self, runner):
        """Test status command without authentication."""
        result = runner.invoke(cli, ['status'])
        # Should handle gracefully
        assert result.exit_code in [0, 1]  # Depending on implementation
    
    @pytest.mark.parametrize("command", [
        "auth",
        "process", 
        "pipeline",
        "config",
        "monitoring"
    ])
    def test_command_groups_exist(self, runner, command):
        """Test that all main command groups exist."""
        result = runner.invoke(cli, [command, '--help'])
        assert result.exit_code == 0
        assert command in result.output.lower()
    
    def test_invalid_command(self, runner):
        """Test invalid command handling."""
        result = runner.invoke(cli, ['invalid-command'])
        assert result.exit_code == 2  # Click returns 2 for usage errors
        assert 'No such command' in result.output


class TestCLIConfiguration:
    """Test CLI configuration handling."""
    
    def test_cli_loads_config(self, runner, sample_config, config_dir):
        """Test that CLI loads configuration."""
        # Save config to expected location
        sample_config.save()
        
        # The CLI should load the config without errors
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
    
    def test_cli_handles_invalid_config(self, runner, config_dir):
        """Test CLI handles invalid configuration gracefully."""
        # Create invalid config file
        config_file = config_dir / "config.yml"
        with open(config_file, 'w') as f:
            f.write("invalid: yaml: content: [")
        
        # CLI should still work with warning
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
    
    def test_cli_with_missing_config(self, runner, config_dir):
        """Test CLI with missing configuration."""
        # Ensure no config file exists
        config_file = config_dir / "config.yml"
        if config_file.exists():
            config_file.unlink()
        
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0


class TestCLIErrorHandling:
    """Test CLI error handling."""
    
    def test_keyboard_interrupt_handling(self, runner, monkeypatch):
        """Test keyboard interrupt handling."""
        def mock_command(*args, **kwargs):
            raise KeyboardInterrupt()
        
        # This is tricky to test with Click's test runner
        # In practice, the @handle_exceptions decorator handles this
        pass
    
    def test_general_exception_handling(self, runner, monkeypatch):
        """Test general exception handling."""
        # Similar to keyboard interrupt, this is handled by the decorator
        # Would need more sophisticated mocking to test properly
        pass
    
    def test_sdk_not_available_warning(self, runner, mock_sdk_unavailable):
        """Test warning when SDK is not available."""
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
        # The warning should be handled gracefully
    
    def test_authentication_error_handling(self, runner):
        """Test authentication error handling."""
        # Test that authentication errors are handled gracefully
        result = runner.invoke(cli, ['auth', 'status'])
        # Should not crash, even without authentication
        assert result.exit_code in [0, 1]


class TestCLIIntegration:
    """Integration tests for CLI."""
    
    @pytest.mark.integration
    def test_full_command_chain(self, runner, temp_dir, sample_data_file):
        """Test a full chain of CLI commands."""
        # This would test: config init -> auth -> process -> etc.
        # Skip for now as it requires complex mocking
        pass
    
    @pytest.mark.integration
    def test_cli_with_environment_variables(self, runner, env_with_api_key):
        """Test CLI with environment variables."""
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
    
    @pytest.mark.slow
    def test_cli_performance(self, runner):
        """Test CLI startup performance."""
        import time
        
        start_time = time.time()
        result = runner.invoke(cli, ['--version'])
        end_time = time.time()
        
        assert result.exit_code == 0
        assert end_time - start_time < 2.0  # Should start within 2 seconds


if __name__ == "__main__":
    pytest.main([__file__])