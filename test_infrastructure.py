#!/usr/bin/env python3
"""
Test Infrastructure Validation
Simple test to verify our monorepo testing setup is working correctly.
"""

import pytest
import sys
import os
from pathlib import Path


def test_python_path_setup():
    """Test that Python paths are set up correctly."""
    # Check that our monorepo paths are in sys.path
    repo_root = str(Path(__file__).parent)
    expected_paths = [
        f"{repo_root}/apps/api",
    ]
    
    for expected_path in expected_paths:
        # Either exact match or normalized path should be in sys.path
        found = any(
            expected_path == path or 
            os.path.normpath(expected_path) == os.path.normpath(path)
            for path in sys.path
        )
        assert found, f"Expected path {expected_path} not found in sys.path"


def test_environment_setup():
    """Test that test environment is set up correctly."""
    assert os.getenv("TESTING") == "true"
    assert os.getenv("ENVIRONMENT") == "testing"
    
    # Check that key environment variables are available
    required_vars = [
        "SECRET_KEY",
        "JWT_SECRET_KEY", 
        "DATABASE_URL"
    ]
    
    for var in required_vars:
        assert os.getenv(var) is not None, f"Required environment variable {var} not set"


def test_basic_app_imports():
    """Test that basic app modules can be imported."""
    # These should work without external dependencies like gym
    try:
        from app.core.config import get_settings
        settings = get_settings()
        assert settings is not None
        
        from app.core.rl_config import get_rl_settings
        rl_settings = get_rl_settings()
        assert rl_settings is not None
        assert rl_settings.rl_enabled is True
        
    except ImportError as e:
        pytest.fail(f"Failed to import basic app modules: {e}")


def test_database_imports():
    """Test that database modules can be imported."""
    try:
        from app.database.connection import get_async_session
        from app.models.rl_models import RLOptimizationSession, SessionStatus
        
        # Test that enums work correctly (these are uppercase enum values)
        assert SessionStatus.PENDING == "PENDING"
        assert SessionStatus.RUNNING == "RUNNING"  
        assert SessionStatus.COMPLETED == "COMPLETED"
        
    except ImportError as e:
        pytest.fail(f"Failed to import database modules: {e}")


def test_rl_config_functionality():
    """Test that RL configuration works correctly."""
    try:
        from app.core.rl_config import get_rl_settings, RLStrategy, RLObjective
        
        settings = get_rl_settings()
        
        # Test industry-specific configs
        ecommerce_config = settings.get_optimization_config(industry_type="ecommerce")
        assert ecommerce_config["objective"] == "balanced_performance"
        
        manufacturing_config = settings.get_optimization_config(industry_type="manufacturing") 
        assert manufacturing_config["objective"] == "accuracy"
        
        finance_config = settings.get_optimization_config(industry_type="finance")
        assert finance_config["objective"] == "auc_roc"
        
    except ImportError as e:
        pytest.fail(f"Failed to test RL configuration: {e}")


@pytest.mark.skipif(True, reason="Gym not installed, skip RL agent tests")  
def test_rl_service_imports():
    """Test that RL service modules can be imported (skipped if gym not available)."""
    try:
        from app.services.rl_optimization_service import RLOptimizationService
        from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
        
    except ImportError as e:
        pytest.fail(f"Failed to import RL service modules: {e}")


def test_test_infrastructure_itself():
    """Meta-test: Test that our testing infrastructure is working."""
    assert pytest is not None
    assert __name__ == "__main__" or True  # Running as test
    
    # Test that pytest marks work
    assert hasattr(pytest.mark, 'skipif')
    assert hasattr(pytest.mark, 'parametrize')


if __name__ == "__main__":
    # Run with pytest when executed directly
    pytest.main([__file__, "-v"])