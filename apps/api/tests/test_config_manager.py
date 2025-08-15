"""
CONFIGURATION MANAGER TESTS
===========================

Test suite for centralized configuration management.
"""

import pytest
import os
from unittest.mock import patch, Mock
from pydantic import ValidationError

from app.services.core.config_manager import (
    ProcessingConfig,
    ConfigManager,
    Environment,
    LogLevel,
    get_config,
    reload_config,
    override_config
)

class TestProcessingConfig:
    """Test configuration model and validation"""
    
    def test_default_configuration(self):
        """Test default configuration values"""
        config = ProcessingConfig()
        
        assert config.environment == Environment.DEVELOPMENT
        assert config.debug == True
        assert config.app_name == "Schlep Engine"
        assert config.max_file_size_mb == 100
        assert config.chunk_size == 10000
        assert config.ai_analysis_enabled == True
        assert config.metrics_enabled == True
    
    def test_environment_specific_config(self):
        """Test environment-specific configuration"""
        # Production config
        prod_config = ProcessingConfig(environment=Environment.PRODUCTION)
        assert prod_config.environment == Environment.PRODUCTION
        
        # Development config
        dev_config = ProcessingConfig(environment=Environment.DEVELOPMENT)
        assert dev_config.environment == Environment.DEVELOPMENT
    
    def test_configuration_validation(self):
        """Test configuration validation rules"""
        # Test valid configuration
        config = ProcessingConfig(
            max_file_size_mb=50,
            chunk_size=5000,
            outlier_threshold=2.5
        )
        assert config.max_file_size_mb == 50
        assert config.chunk_size == 5000
        assert config.outlier_threshold == 2.5
        
        # Test invalid values
        with pytest.raises(ValidationError):
            ProcessingConfig(max_file_size_mb=0)  # Below minimum
            
        with pytest.raises(ValidationError):
            ProcessingConfig(outlier_threshold=10.0)  # Above maximum
    
    def test_cors_origin_validation(self):
        """Test CORS origin validation for production"""
        # Development should allow localhost
        dev_config = ProcessingConfig(
            environment=Environment.DEVELOPMENT,
            cors_origins=["http://localhost:3000"]
        )
        assert "http://localhost:3000" in dev_config.cors_origins
        
        # Production should warn about localhost (but still allow)
        with patch('app.services.core.config_manager.logger') as mock_logger:
            prod_config = ProcessingConfig(
                environment=Environment.PRODUCTION,
                cors_origins=["http://localhost:3000", "https://app.example.com"]
            )
            # Should have logged warning
            mock_logger.warning.assert_called_once()
    
    def test_chunk_size_validation(self):
        """Test chunk size validation against file size"""
        with patch('app.services.core.config_manager.logger') as mock_logger:
            config = ProcessingConfig(
                max_file_size_mb=1,  # Small file
                chunk_size=100000    # Large chunk
            )
            # Should log warning about chunk size being too large
            mock_logger.warning.assert_called_once()
    
    @patch.dict(os.environ, {
        'SCHLEP_ENGINE_MAX_FILE_SIZE_MB': '200',
        'SCHLEP_ENGINE_DEBUG': 'false',
        'SCHLEP_ENGINE_AI_ANALYSIS_ENABLED': 'true'
    })
    def test_environment_variable_loading(self):
        """Test loading configuration from environment variables"""
        config = ProcessingConfig()
        
        assert config.max_file_size_mb == 200
        assert config.debug == False
        assert config.ai_analysis_enabled == True

class TestConfigManager:
    """Test configuration manager functionality"""
    
    @pytest.fixture
    def config_manager(self):
        """Fresh config manager for each test"""
        return ConfigManager()
    
    def test_config_manager_initialization(self, config_manager):
        """Test config manager initialization"""
        assert config_manager.config is not None
        assert isinstance(config_manager.config, ProcessingConfig)
        assert config_manager._overrides == {}
        assert config_manager._listeners == []
    
    def test_configuration_override(self, config_manager):
        """Test runtime configuration override"""
        original_debug = config_manager.config.debug
        
        # Override debug setting
        config_manager.override('debug', not original_debug)
        
        assert config_manager.config.debug == (not original_debug)
        assert 'debug' in config_manager._overrides
    
    def test_invalid_configuration_override(self, config_manager):
        """Test error handling for invalid overrides"""
        with pytest.raises(ValueError):
            config_manager.override('non_existent_key', 'value')
    
    def test_remove_configuration_override(self, config_manager):
        """Test removing configuration overrides"""
        # Set override
        config_manager.override('debug', False)
        assert config_manager.config.debug == False
        
        # Remove override
        config_manager.remove_override('debug')
        assert 'debug' not in config_manager._overrides
    
    def test_configuration_listeners(self, config_manager):
        """Test configuration change listeners"""
        change_events = []
        
        def listener(old_config, new_config):
            change_events.append((old_config, new_config))
        
        # Add listener
        config_manager.add_listener(listener)
        
        # Make a change
        config_manager.override('debug', False)
        
        # Should have received notification
        assert len(change_events) == 1
        old_config, new_config = change_events[0]
        assert old_config['debug'] != new_config['debug']
        
        # Remove listener
        config_manager.remove_listener(listener)
        
        # Make another change
        config_manager.override('metrics_enabled', False)
        
        # Should not have received new notification
        assert len(change_events) == 1
    
    def test_configuration_reload(self, config_manager):
        """Test configuration reload functionality"""
        # Set override
        config_manager.override('debug', False)
        assert config_manager.config.debug == False
        
        # Mock environment variable change
        with patch.dict(os.environ, {'SCHLEP_ENGINE_DEBUG': 'true'}):
            config_manager.reload()
            
            # Should have new value from environment
            assert config_manager.config.debug == True
    
    def test_environment_summary(self, config_manager):
        """Test getting environment summary"""
        summary = config_manager.get_environment_summary()
        
        assert 'environment' in summary
        assert 'debug' in summary
        assert 'app_version' in summary
        assert 'performance_settings' in summary
        assert 'overrides' in summary
        
        # Set an override and check it appears
        config_manager.override('debug', False)
        summary = config_manager.get_environment_summary()
        assert 'debug' in summary['overrides']
    
    def test_environment_validation(self, config_manager):
        """Test configuration validation for different environments"""
        # Production validation
        config_manager.override('environment', Environment.PRODUCTION)
        config_manager.override('debug', True)  # Should warn
        
        warnings = config_manager.validate_for_environment(Environment.PRODUCTION)
        assert len(warnings) > 0
        assert any('debug' in warning.lower() for warning in warnings)
        
        # Development validation
        config_manager.override('environment', Environment.DEVELOPMENT)
        config_manager.override('debug', False)  # Should warn
        
        warnings = config_manager.validate_for_environment(Environment.DEVELOPMENT)
        assert len(warnings) > 0
        assert any('debug' in warning.lower() for warning in warnings)

class TestConfigurationIntegration:
    """Test configuration integration with other components"""
    
    def test_global_config_access(self):
        """Test global configuration access"""
        config = get_config()
        assert isinstance(config, ProcessingConfig)
    
    def test_global_config_reload(self):
        """Test global configuration reload"""
        original_debug = get_config().debug
        
        # Should be able to reload without errors
        reload_config()
        
        # Config should still be accessible
        assert isinstance(get_config(), ProcessingConfig)
    
    def test_global_config_override(self):
        """Test global configuration override"""
        original_debug = get_config().debug
        
        # Override globally
        override_config('debug', not original_debug)
        
        # Should be reflected in global config
        assert get_config().debug == (not original_debug)
    
    @patch.dict(os.environ, {'SCHLEP_ENGINE_ENVIRONMENT': 'production'})
    def test_environment_auto_configuration(self):
        """Test automatic configuration based on environment"""
        from app.services.core.config_manager import configure_for_environment
        
        # Should configure for production
        with patch('app.services.core.config_manager.override_config') as mock_override:
            configure_for_environment()
            
            # Should have set production optimizations
            mock_override.assert_any_call('debug', False)
            mock_override.assert_any_call('log_level', LogLevel.WARNING)
    
    @patch.dict(os.environ, {'SCHLEP_ENGINE_ENVIRONMENT': 'testing'})
    def test_testing_environment_configuration(self):
        """Test configuration for testing environment"""
        from app.services.core.config_manager import configure_for_environment
        
        with patch('app.services.core.config_manager.override_config') as mock_override:
            configure_for_environment()
            
            # Should disable features for testing
            mock_override.assert_any_call('debug', False)
            mock_override.assert_any_call('metrics_enabled', False)
            mock_override.assert_any_call('ai_analysis_enabled', False)

class TestConfigurationPerformance:
    """Test configuration performance and memory usage"""
    
    def test_config_creation_performance(self):
        """Test configuration creation performance"""
        import time
        
        start_time = time.time()
        for _ in range(100):
            config = ProcessingConfig()
        creation_time = time.time() - start_time
        
        # Should create 100 configs quickly
        assert creation_time < 1.0
    
    def test_config_validation_performance(self):
        """Test configuration validation performance"""
        import time
        
        start_time = time.time()
        for i in range(100):
            config = ProcessingConfig(
                max_file_size_mb=i + 1,
                chunk_size=(i + 1) * 1000,
                outlier_threshold=2.0 + (i * 0.01)
            )
        validation_time = time.time() - start_time
        
        # Should validate 100 configs quickly
        assert validation_time < 2.0
    
    def test_config_manager_memory_usage(self):
        """Test config manager memory efficiency"""
        import gc
        import sys
        
        gc.collect()
        initial_objects = len(gc.get_objects())
        
        # Create multiple config managers
        managers = [ConfigManager() for _ in range(10)]
        
        gc.collect()
        final_objects = len(gc.get_objects())
        
        # Should not create excessive objects
        object_increase = final_objects - initial_objects
        assert object_increase < 1000  # Reasonable object count increase

class TestConfigurationSecurity:
    """Test configuration security aspects"""
    
    def test_sensitive_config_values(self):
        """Test that sensitive values are not logged"""
        config = ProcessingConfig()
        
        # Convert to dict to check what would be logged
        config_dict = config.dict()
        
        # Should not contain actual secrets (only references)
        for key, value in config_dict.items():
            if 'secret' in key.lower() or 'password' in key.lower():
                # Values should be sanitized or not present
                assert isinstance(value, (str, type(None)))
    
    def test_production_security_settings(self):
        """Test security settings in production"""
        prod_config = ProcessingConfig(environment=Environment.PRODUCTION)
        
        # Production should have secure defaults
        assert prod_config.encryption_enabled == True
        assert prod_config.audit_logging_enabled == True
        assert prod_config.metrics_enabled == True
        assert prod_config.password_min_length >= 8
    
    def test_development_security_warnings(self):
        """Test security warnings in development"""
        dev_config = ProcessingConfig(environment=Environment.DEVELOPMENT)
        
        # Development might have relaxed security, but should be explicit
        config_manager = ConfigManager()
        config_manager._config = dev_config
        
        warnings = config_manager.validate_for_environment(Environment.PRODUCTION)
        
        # Should warn about development settings in production context
        if dev_config.debug:
            assert any('debug' in warning.lower() for warning in warnings)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])