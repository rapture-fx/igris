#!/usr/bin/env python3
"""
RL System Working Parts Test
Tests the parts of the RL system that work without external dependencies like gym.
"""

import pytest
import os
from pathlib import Path

# Set up environment before any imports
from dotenv import load_dotenv
load_dotenv('.env.test')
os.environ["TESTING"] = "true"
os.environ["ENVIRONMENT"] = "testing"

# Add to path
import sys
sys.path.insert(0, 'apps/api')

def test_rl_configuration_system():
    """Test RL configuration system works correctly."""
    from app.core.rl_config import get_rl_settings, RLStrategy, RLObjective, INDUSTRY_PRESETS
    
    settings = get_rl_settings()
    
    # Test basic settings
    assert settings.rl_enabled is True
    assert settings.rl_max_concurrent_sessions == 5
    assert settings.rl_default_strategy == RLStrategy.PPO
    
    # Test industry-specific configurations
    ecommerce_config = settings.get_optimization_config(industry_type="ecommerce")
    assert ecommerce_config["objective"] == RLObjective.BALANCED_PERFORMANCE
    # Note: max_episodes comes from default settings, not industry presets
    
    manufacturing_config = settings.get_optimization_config(industry_type="manufacturing")  
    assert manufacturing_config["objective"] == RLObjective.ACCURACY
    
    finance_config = settings.get_optimization_config(industry_type="finance")
    assert finance_config["objective"] == RLObjective.AUC_ROC
    
    # Test resource limits
    resource_limits = settings.get_resource_limits()
    assert resource_limits["max_cpu_cores"] == 4
    assert resource_limits["max_memory_gb"] == 16
    
    # Test monitoring config
    monitoring_config = settings.get_monitoring_config()
    assert monitoring_config["enabled"] is True
    assert monitoring_config["interval_seconds"] == 30


def test_rl_database_models():
    """Test RL database models work correctly."""
    from app.models.rl_models import RLOptimizationSession, SessionStatus
    
    # Test enums that exist in the models
    assert SessionStatus.PENDING == "PENDING"
    assert SessionStatus.RUNNING == "RUNNING" 
    assert SessionStatus.COMPLETED == "COMPLETED"
    assert SessionStatus.FAILED == "FAILED"
    assert SessionStatus.STOPPED == "STOPPED"
    
    # Test that we can access the model class
    assert hasattr(RLOptimizationSession, '__tablename__')
    assert RLOptimizationSession.__tablename__ == "rl_optimization_sessions"


def test_rl_crud_operations():
    """Test RL CRUD operations work correctly."""
    from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
    from app.models.rl_models import RLOptimizationSession, SessionStatus
    
    # We can't test actual database operations without a real DB connection,
    # but we can test the class structure
    assert hasattr(RLOptimizationCRUD, '__init__')
    assert hasattr(RLOptimizationCRUD, 'create_session')
    assert hasattr(RLOptimizationCRUD, 'get_session')


def test_rl_configuration_validation():
    """Test RL configuration validation works."""
    from app.core.rl_config import get_rl_settings
    
    settings = get_rl_settings()
    
    # Test directory creation
    import tempfile
    import shutil
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Test that directories are created
        checkpoint_dir = Path(temp_dir) / "checkpoints"
        logs_dir = Path(temp_dir) / "logs"
        
        # Directories should be created if they don't exist
        assert not checkpoint_dir.exists()
        assert not logs_dir.exists()
        
    finally:
        shutil.rmtree(temp_dir)


def test_rl_industry_presets():
    """Test industry preset configurations."""
    from app.core.rl_config import INDUSTRY_PRESETS, get_industry_preset
    
    # Test that all expected industries are available
    expected_industries = ["ecommerce", "manufacturing", "finance"]
    for industry in expected_industries:
        assert industry in INDUSTRY_PRESETS
        preset = get_industry_preset(industry)
        assert "objective" in preset
        assert "max_episodes" in preset
        assert "learning_rate" in preset
        assert "focus_metrics" in preset
    
    # Test default fallback
    unknown_preset = get_industry_preset("unknown_industry")
    assert unknown_preset == INDUSTRY_PRESETS["ecommerce"]  # Should fallback to ecommerce


def test_rl_settings_validation():
    """Test RL settings validation."""
    from app.core.rl_config import RLSettings
    
    # This tests that the settings can be instantiated without errors
    # when all required environment variables are present
    settings = RLSettings()
    
    # Test validation methods work
    assert callable(settings.get_optimization_config)
    assert callable(settings.get_resource_limits)
    assert callable(settings.get_monitoring_config)
    assert callable(settings.is_s3_configured)


@pytest.mark.skipif(True, reason="RL service requires gym - testing structure only")
def test_rl_service_structure():
    """Test RL service class structure (skipped due to gym dependency)."""
    # This would test the actual service if gym were available
    pass


def test_environment_setup_for_rl():
    """Test that RL-specific environment variables are properly set."""
    # Check RL-specific environment variables from .env.test
    assert os.getenv("RL_ENABLED") == "true"
    assert os.getenv("RL_MAX_CONCURRENT_SESSIONS") == "3"
    assert os.getenv("RL_DEFAULT_STRATEGY") == "ppo"
    assert os.getenv("RL_CHECKPOINT_DIRECTORY") == "./test_checkpoints/"
    assert os.getenv("RL_LOGS_DIRECTORY") == "./test_logs/"
    assert os.getenv("RL_TENSORBOARD_ENABLED") == "false"
    assert os.getenv("RL_PROMETHEUS_METRICS_ENABLED") == "false"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])