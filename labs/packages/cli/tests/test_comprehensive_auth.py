"""
Comprehensive authentication tests for Igris-engine CLI
"""

import pytest
import json
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch, mock_open
from click.testing import CliRunner

from igris_cli.main import cli
from igris_cli.core.config import Config
from igris_cli.core.client import APIClient
from igris_cli.commands.auth import login, logout, status, refresh


class TestAuthCommands:
    """Comprehensive tests for authentication commands."""

    def test_login_success(self, runner, mock_successful_response, mock_client):
        """Test successful login command."""
        mock_client.auth.login.return_value = {
            'access_token': 'test-token-123',
            'refresh_token': 'refresh-token-123',
            'expires_in': 3600,
            'user': {
                'email': 'test@example.com',
                'username': 'testuser'
            }
        }

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            result = runner.invoke(cli, [
                'auth', 'login', 
                '--email', 'test@example.com',
                '--password', 'password123'
            ])

        assert result.exit_code == 0
        assert 'Successfully logged in' in result.output
        assert 'test@example.com' in result.output

    def test_login_invalid_credentials(self, runner, mock_error_response):
        """Test login with invalid credentials."""
        mock_client = Mock()
        mock_client.auth.login.side_effect = Exception("Invalid credentials")

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            result = runner.invoke(cli, [
                'auth', 'login', 
                '--email', 'invalid@example.com',
                '--password', 'wrongpassword'
            ])

        assert result.exit_code != 0
        assert 'Invalid credentials' in result.output

    def test_login_interactive_mode(self, runner, mock_client):
        """Test interactive login mode."""
        mock_client.auth.login.return_value = {
            'access_token': 'test-token-123',
            'refresh_token': 'refresh-token-123',
            'expires_in': 3600,
            'user': {
                'email': 'interactive@example.com',
                'username': 'interactiveuser'
            }
        }

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            with patch('click.prompt') as mock_prompt:
                mock_prompt.side_effect = ['interactive@example.com', 'interactive123']
                
                result = runner.invoke(cli, ['auth', 'login'])

        assert result.exit_code == 0
        assert 'Successfully logged in' in result.output
        assert mock_prompt.call_count == 2

    def test_login_with_api_key(self, runner, mock_client):
        """Test login using API key."""
        mock_client.auth.validate_api_key.return_value = {
            'valid': True,
            'user': {
                'email': 'apikey@example.com',
                'username': 'apikeyuser'
            }
        }

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            result = runner.invoke(cli, [
                'auth', 'login', 
                '--api-key', 'sk-test-api-key-123'
            ])

        assert result.exit_code == 0
        assert 'Successfully authenticated with API key' in result.output

    def test_login_save_credentials(self, runner, mock_client, config_dir):
        """Test login saves credentials properly."""
        mock_client.auth.login.return_value = {
            'access_token': 'test-token-123',
            'refresh_token': 'refresh-token-123',
            'expires_in': 3600,
            'user': {
                'email': 'save@example.com',
                'username': 'saveuser'
            }
        }

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            with patch('igris_cli.core.config.Config.get_auth_file', return_value=config_dir / "auth.json"):
                result = runner.invoke(cli, [
                    'auth', 'login', 
                    '--email', 'save@example.com',
                    '--password', 'password123',
                    '--save'
                ])

        assert result.exit_code == 0
        # Verify credentials were saved
        auth_file = config_dir / "auth.json"
        assert auth_file.exists()

    def test_logout_success(self, runner, mock_client, auth_context):
        """Test successful logout command."""
        mock_client.auth.logout.return_value = {'message': 'Successfully logged out'}

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            with patch('igris_cli.commands.auth.get_auth_context', return_value=auth_context):
                result = runner.invoke(cli, ['auth', 'logout'])

        assert result.exit_code == 0
        assert 'Successfully logged out' in result.output

    def test_logout_not_authenticated(self, runner):
        """Test logout when not authenticated."""
        with patch('igris_cli.commands.auth.get_auth_context', return_value=None):
            result = runner.invoke(cli, ['auth', 'logout'])

        assert result.exit_code != 0
        assert 'Not currently logged in' in result.output

    def test_logout_clear_local_session(self, runner, config_dir):
        """Test logout clears local session."""
        auth_file = config_dir / "auth.json"
        auth_file.write_text(json.dumps({
            'access_token': 'test-token',
            'refresh_token': 'refresh-token',
            'user': {'email': 'test@example.com'}
        }))

        with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
            result = runner.invoke(cli, ['auth', 'logout', '--local'])

        assert result.exit_code == 0
        assert 'Local session cleared' in result.output
        assert not auth_file.exists() or auth_file.read_text().strip() == ''

    def test_status_authenticated(self, runner, auth_context, mock_client):
        """Test status command when authenticated."""
        mock_client.users.get_current.return_value = {
            'email': 'test@example.com',
            'username': 'testuser',
            'organization': 'Test Org',
            'plan': 'Pro'
        }

        with patch('igris_cli.commands.auth.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'status'])

        assert result.exit_code == 0
        assert 'Authenticated as: test@example.com' in result.output
        assert 'Organization: Test Org' in result.output
        assert 'Plan: Pro' in result.output

    def test_status_not_authenticated(self, runner):
        """Test status command when not authenticated."""
        with patch('igris_cli.commands.auth.get_auth_context', return_value=None):
            result = runner.invoke(cli, ['auth', 'status'])

        assert result.exit_code != 0
        assert 'Not currently logged in' in result.output

    def test_status_verbose(self, runner, auth_context, mock_client):
        """Test status command with verbose output."""
        mock_client.users.get_current.return_value = {
            'email': 'test@example.com',
            'username': 'testuser',
            'organization': 'Test Org',
            'plan': 'Pro',
            'api_usage': {
                'requests_this_month': 1500,
                'limit': 10000
            },
            'permissions': ['read', 'write', 'admin']
        }

        with patch('igris_cli.commands.auth.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'status', '--verbose'])

        assert result.exit_code == 0
        assert 'API Usage: 1500/10000' in result.output
        assert 'Permissions:' in result.output
        assert 'read' in result.output
        assert 'write' in result.output
        assert 'admin' in result.output

    def test_refresh_token_success(self, runner, auth_context, mock_client):
        """Test successful token refresh."""
        mock_client.auth.refresh_token.return_value = {
            'access_token': 'new-access-token-123',
            'refresh_token': 'new-refresh-token-123',
            'expires_in': 3600
        }

        with patch('igris_cli.commands.auth.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'refresh'])

        assert result.exit_code == 0
        assert 'Token refreshed successfully' in result.output

    def test_refresh_token_expired(self, runner, auth_context, mock_client):
        """Test token refresh with expired refresh token."""
        mock_client.auth.refresh_token.side_effect = Exception("Refresh token expired")

        with patch('igris_cli.commands.auth.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'refresh'])

        assert result.exit_code != 0
        assert 'Refresh token expired' in result.output
        assert 'Please log in again' in result.output

    def test_refresh_token_not_authenticated(self, runner):
        """Test token refresh when not authenticated."""
        with patch('igris_cli.commands.auth.get_auth_context', return_value=None):
            result = runner.invoke(cli, ['auth', 'refresh'])

        assert result.exit_code != 0
        assert 'Not currently logged in' in result.output


class TestAuthenticationFlow:
    """Test complete authentication flows."""

    def test_complete_login_logout_flow(self, runner, mock_client, config_dir):
        """Test complete login -> status -> logout flow."""
        # Mock login response
        mock_client.auth.login.return_value = {
            'access_token': 'flow-token-123',
            'refresh_token': 'flow-refresh-123',
            'expires_in': 3600,
            'user': {
                'email': 'flow@example.com',
                'username': 'flowuser'
            }
        }

        # Mock status response
        mock_client.users.get_current.return_value = {
            'email': 'flow@example.com',
            'username': 'flowuser',
            'organization': 'Flow Org',
            'plan': 'Enterprise'
        }

        # Mock logout response
        mock_client.auth.logout.return_value = {'message': 'Successfully logged out'}

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            # Step 1: Login
            login_result = runner.invoke(cli, [
                'auth', 'login',
                '--email', 'flow@example.com',
                '--password', 'password123',
                '--save'
            ])
            assert login_result.exit_code == 0
            assert 'Successfully logged in' in login_result.output

            # Step 2: Check status
            with patch('igris_cli.commands.auth.get_auth_context') as mock_auth:
                mock_auth.return_value = {
                    'config': Config(),
                    'client': mock_client,
                    'debug': False
                }
                
                status_result = runner.invoke(cli, ['auth', 'status'])
                assert status_result.exit_code == 0
                assert 'flow@example.com' in status_result.output

                # Step 3: Logout
                logout_result = runner.invoke(cli, ['auth', 'logout'])
                assert logout_result.exit_code == 0
                assert 'Successfully logged out' in logout_result.output

    def test_session_persistence(self, runner, mock_client, config_dir):
        """Test authentication session persistence across CLI invocations."""
        auth_data = {
            'access_token': 'persistent-token-123',
            'refresh_token': 'persistent-refresh-123',
            'expires_at': '2024-12-31T23:59:59Z',
            'user': {
                'email': 'persistent@example.com',
                'username': 'persistentuser'
            }
        }

        auth_file = config_dir / "auth.json"
        auth_file.write_text(json.dumps(auth_data))

        mock_client.users.get_current.return_value = {
            'email': 'persistent@example.com',
            'username': 'persistentuser'
        }

        with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                # First invocation - should load existing session
                result1 = runner.invoke(cli, ['auth', 'status'])
                assert result1.exit_code == 0
                assert 'persistent@example.com' in result1.output

                # Second invocation - should still be authenticated
                result2 = runner.invoke(cli, ['auth', 'status'])
                assert result2.exit_code == 0
                assert 'persistent@example.com' in result2.output

    def test_automatic_token_refresh(self, runner, mock_client, config_dir):
        """Test automatic token refresh when token expires."""
        # Set up expired token
        expired_auth_data = {
            'access_token': 'expired-token-123',
            'refresh_token': 'valid-refresh-123',
            'expires_at': '2020-01-01T00:00:00Z',  # Expired
            'user': {
                'email': 'refresh@example.com',
                'username': 'refreshuser'
            }
        }

        auth_file = config_dir / "auth.json"
        auth_file.write_text(json.dumps(expired_auth_data))

        # Mock refresh response
        mock_client.auth.refresh_token.return_value = {
            'access_token': 'new-token-123',
            'refresh_token': 'new-refresh-123',
            'expires_in': 3600
        }

        mock_client.users.get_current.return_value = {
            'email': 'refresh@example.com',
            'username': 'refreshuser'
        }

        with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'status'])

        assert result.exit_code == 0
        assert 'refresh@example.com' in result.output
        # Verify refresh was called
        mock_client.auth.refresh_token.assert_called_once()


class TestAuthenticationSecurity:
    """Test authentication security features."""

    def test_secure_credential_storage(self, runner, mock_client, config_dir):
        """Test that credentials are stored securely."""
        mock_client.auth.login.return_value = {
            'access_token': 'secure-token-123',
            'refresh_token': 'secure-refresh-123',
            'expires_in': 3600,
            'user': {
                'email': 'secure@example.com',
                'username': 'secureuser'
            }
        }

        auth_file = config_dir / "auth.json"

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
                result = runner.invoke(cli, [
                    'auth', 'login',
                    '--email', 'secure@example.com',
                    '--password', 'password123',
                    '--save'
                ])

        assert result.exit_code == 0

        # Verify file permissions (should be readable only by owner)
        if hasattr(os, 'stat'):
            file_stat = auth_file.stat()
            # Check that file is not readable by group or others
            assert oct(file_stat.st_mode)[-3:] in ['600', '700']

    def test_token_masking_in_output(self, runner, auth_context, mock_client):
        """Test that tokens are masked in CLI output."""
        mock_client.users.get_current.return_value = {
            'email': 'mask@example.com',
            'username': 'maskuser',
            'token_info': {
                'access_token': 'should-be-masked-123',
                'expires_at': '2024-12-31T23:59:59Z'
            }
        }

        with patch('igris_cli.commands.auth.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'status', '--verbose'])

        assert result.exit_code == 0
        # Token should be masked
        assert 'should-be-masked-123' not in result.output
        assert '***' in result.output or 'hidden' in result.output.lower()

    def test_secure_logout_cleanup(self, runner, config_dir):
        """Test that logout securely cleans up credentials."""
        auth_file = config_dir / "auth.json"
        sensitive_data = {
            'access_token': 'sensitive-token-123',
            'refresh_token': 'sensitive-refresh-123',
            'user': {'email': 'cleanup@example.com'}
        }
        auth_file.write_text(json.dumps(sensitive_data))

        with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
            result = runner.invoke(cli, ['auth', 'logout', '--local'])

        assert result.exit_code == 0

        # File should be removed or overwritten with empty content
        if auth_file.exists():
            content = auth_file.read_text()
            assert 'sensitive-token-123' not in content
            assert 'sensitive-refresh-123' not in content

    def test_session_timeout_handling(self, runner, mock_client, config_dir):
        """Test handling of session timeouts."""
        # Set up auth data with very short expiry
        expired_auth_data = {
            'access_token': 'timeout-token-123',
            'refresh_token': 'timeout-refresh-123',
            'expires_at': '2020-01-01T00:00:00Z',  # Already expired
            'user': {
                'email': 'timeout@example.com',
                'username': 'timeoutuser'
            }
        }

        auth_file = config_dir / "auth.json"
        auth_file.write_text(json.dumps(expired_auth_data))

        # Mock refresh failure (refresh token also expired)
        mock_client.auth.refresh_token.side_effect = Exception("Refresh token expired")

        with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
            with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['auth', 'status'])

        assert result.exit_code != 0
        assert 'session expired' in result.output.lower() or 'please log in' in result.output.lower()


class TestAuthenticationEdgeCases:
    """Test edge cases and error conditions."""

    def test_corrupted_auth_file(self, runner, config_dir):
        """Test handling of corrupted authentication file."""
        auth_file = config_dir / "auth.json"
        auth_file.write_text("invalid json content")

        with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
            result = runner.invoke(cli, ['auth', 'status'])

        assert result.exit_code != 0
        assert 'corrupted' in result.output.lower() or 'invalid' in result.output.lower()

    def test_missing_auth_file_permissions(self, runner, config_dir):
        """Test handling when auth file cannot be created due to permissions."""
        auth_file = config_dir / "readonly" / "auth.json"
        
        # Create parent directory as read-only
        readonly_dir = config_dir / "readonly"
        readonly_dir.mkdir()
        readonly_dir.chmod(0o555)  # Read-only

        mock_client = Mock()
        mock_client.auth.login.return_value = {
            'access_token': 'token-123',
            'refresh_token': 'refresh-123',
            'expires_in': 3600,
            'user': {'email': 'test@example.com', 'username': 'testuser'}
        }

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            with patch('igris_cli.core.config.Config.get_auth_file', return_value=auth_file):
                result = runner.invoke(cli, [
                    'auth', 'login',
                    '--email', 'test@example.com',
                    '--password', 'password123',
                    '--save'
                ])

        # Should still login but warn about save failure
        assert result.exit_code == 0
        assert 'Successfully logged in' in result.output
        # May warn about inability to save credentials

        # Clean up
        readonly_dir.chmod(0o755)

    def test_network_error_during_auth(self, runner):
        """Test handling of network errors during authentication."""
        mock_client = Mock()
        mock_client.auth.login.side_effect = ConnectionError("Network unreachable")

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            result = runner.invoke(cli, [
                'auth', 'login',
                '--email', 'test@example.com',
                '--password', 'password123'
            ])

        assert result.exit_code != 0
        assert 'network' in result.output.lower() or 'connection' in result.output.lower()

    def test_api_rate_limiting(self, runner):
        """Test handling of API rate limiting during authentication."""
        mock_client = Mock()
        mock_client.auth.login.side_effect = Exception("Rate limit exceeded. Try again in 60 seconds.")

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            result = runner.invoke(cli, [
                'auth', 'login',
                '--email', 'test@example.com',
                '--password', 'password123'
            ])

        assert result.exit_code != 0
        assert 'rate limit' in result.output.lower()
        assert '60 seconds' in result.output

    def test_concurrent_login_attempts(self, runner, mock_client):
        """Test handling of concurrent login attempts."""
        # This is a conceptual test - CLI is single-threaded
        # but we test the robustness of auth file handling
        mock_client.auth.login.return_value = {
            'access_token': 'concurrent-token-123',
            'refresh_token': 'concurrent-refresh-123',
            'expires_in': 3600,
            'user': {'email': 'concurrent@example.com', 'username': 'concurrentuser'}
        }

        with patch('igris_cli.commands.auth.APIClient', return_value=mock_client):
            result = runner.invoke(cli, [
                'auth', 'login',
                '--email', 'concurrent@example.com',
                '--password', 'password123',
                '--save'
            ])

        assert result.exit_code == 0
        assert 'Successfully logged in' in result.output


@pytest.mark.integration
class TestAuthenticationIntegration:
    """Integration tests for authentication (requires test API)."""

    @pytest.mark.skip(reason="Requires real API endpoint")
    def test_real_api_authentication(self):
        """Test authentication against real API endpoint."""
        # This test would be run only in integration test environments
        # with real test credentials
        pass

    @pytest.mark.skip(reason="Requires OAuth setup")
    def test_oauth_flow(self):
        """Test OAuth authentication flow."""
        # OAuth flow testing with real OAuth provider
        pass


# Additional fixtures for auth tests
@pytest.fixture
def mock_auth_response():
    """Mock authentication response."""
    return {
        'access_token': 'mock-access-token-123',
        'refresh_token': 'mock-refresh-token-123',
        'token_type': 'bearer',
        'expires_in': 3600,
        'user': {
            'user_id': 'user-123',
            'email': 'mock@example.com',
            'username': 'mockuser',
            'role': 'user',
            'is_active': True
        }
    }


@pytest.fixture
def expired_auth_context(config_dir):
    """Auth context with expired credentials."""
    return {
        'config': Config(),
        'client': Mock(),
        'debug': False,
        'auth': {
            'access_token': 'expired-token',
            'expires_at': '2020-01-01T00:00:00Z'  # Already expired
        }
    }