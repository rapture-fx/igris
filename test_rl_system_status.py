#!/usr/bin/env python3
"""
RL System Status Test
Comprehensive test to identify what's working and what's not in the RL system
"""

import os
import sys
from pathlib import Path

# Set up environment before any imports
from dotenv import load_dotenv
load_dotenv('.env.test')
os.environ["TESTING"] = "true"
os.environ["ENVIRONMENT"] = "testing"

# Add to path
sys.path.insert(0, 'apps/api')

def test_basic_imports():
    """Test basic imports that should work"""
    results = {}
    
    try:
        import numpy as np
        results["numpy"] = "✅ Available"
    except ImportError as e:
        results["numpy"] = f"❌ {e}"
    
    try:
        import gymnasium
        results["gymnasium"] = "✅ Available"
    except ImportError as e:
        results["gymnasium"] = f"❌ {e}"
    
    try:
        import stable_baselines3
        results["stable_baselines3"] = "✅ Available"
    except ImportError as e:
        results["stable_baselines3"] = f"❌ {e}"
    
    try:
        import gym
        results["gym"] = "✅ Available"
    except ImportError as e:
        results["gym"] = f"❌ {e}"
    
    try:
        import torch
        results["torch"] = "✅ Available"
    except ImportError as e:
        results["torch"] = f"❌ {e}"
    
    return results

def test_rl_configuration():
    """Test RL configuration system"""
    results = {}
    
    try:
        from app.core.rl_config import get_rl_settings, RLStrategy, RLObjective
        settings = get_rl_settings()
        results["rl_config_import"] = "✅ Successfully imported"
        results["rl_enabled"] = f"✅ {settings.rl_enabled}"
        results["max_sessions"] = f"✅ {settings.rl_max_concurrent_sessions}"
        results["default_strategy"] = f"✅ {settings.rl_default_strategy}"
    except Exception as e:
        results["rl_config_import"] = f"❌ {e}"
    
    return results

def test_rl_database_models():
    """Test RL database models"""
    results = {}
    
    try:
        from app.models.rl_models import RLOptimizationSession, SessionStatus
        results["rl_models_import"] = "✅ Successfully imported"
        results["session_status_enum"] = f"✅ {SessionStatus.PENDING}"
        results["table_name"] = f"✅ {RLOptimizationSession.__tablename__}"
    except Exception as e:
        results["rl_models_import"] = f"❌ {e}"
    
    return results

def test_rl_services():
    """Test RL service imports"""
    results = {}
    
    try:
        from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
        results["rl_crud_import"] = "✅ Successfully imported CRUD"
    except Exception as e:
        results["rl_crud_import"] = f"❌ {e}"
    
    # Test hyperparameter optimizer (known to fail due to gym import)
    try:
        from app.services.rl.agents.hyperparameter_optimizer import OptimizationConfig, OptimizationStrategy
        results["hyperparameter_optimizer"] = "✅ Successfully imported"
    except Exception as e:
        results["hyperparameter_optimizer"] = f"❌ {e}"
    
    return results

def test_environment_variables():
    """Test environment variable setup"""
    results = {}
    
    env_vars = [
        'RL_ENABLED',
        'RL_MAX_CONCURRENT_SESSIONS', 
        'RL_DEFAULT_STRATEGY',
        'RL_CHECKPOINT_DIRECTORY',
        'RL_LOGS_DIRECTORY',
        'DATABASE_URL',
        'JWT_SECRET_KEY',
        'ENVIRONMENT'
    ]
    
    for var in env_vars:
        value = os.getenv(var, "Not Set")
        if value != "Not Set":
            results[var] = f"✅ {value}"
        else:
            results[var] = f"❌ Not Set"
    
    return results

def main():
    """Run all tests and provide comprehensive status report"""
    print("🔍 RL System Status Test")
    print("=" * 60)
    
    print("\n📦 PACKAGE IMPORTS:")
    import_results = test_basic_imports()
    for package, status in import_results.items():
        print(f"  {package:<20} {status}")
    
    print("\n⚙️  RL CONFIGURATION:")
    config_results = test_rl_configuration()
    for test, status in config_results.items():
        print(f"  {test:<20} {status}")
    
    print("\n🗄️  DATABASE MODELS:")
    db_results = test_rl_database_models()
    for test, status in db_results.items():
        print(f"  {test:<20} {status}")
    
    print("\n🛠️  RL SERVICES:")
    service_results = test_rl_services()
    for test, status in service_results.items():
        print(f"  {test:<20} {status}")
    
    print("\n🌍 ENVIRONMENT VARIABLES:")
    env_results = test_environment_variables()
    for var, status in env_results.items():
        print(f"  {var:<25} {status}")
    
    # Summary
    all_results = {**import_results, **config_results, **db_results, **service_results}
    
    total_tests = len(all_results)
    passed_tests = sum(1 for status in all_results.values() if status.startswith("✅"))
    failed_tests = total_tests - passed_tests
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY:")
    print(f"  ✅ Passed: {passed_tests}/{total_tests}")
    print(f"  ❌ Failed: {failed_tests}/{total_tests}")
    
    if failed_tests > 0:
        print("\n🚨 ISSUES IDENTIFIED:")
        for test, status in all_results.items():
            if status.startswith("❌"):
                print(f"  • {test}: {status[2:]}")
        
        print("\n💡 RECOMMENDATIONS:")
        if "gym" in import_results and import_results["gym"].startswith("❌"):
            print("  • Install gym: pip install gym==0.26.2")
        if "torch" in import_results and import_results["torch"].startswith("❌"):
            print("  • Install PyTorch: pip install torch")
        if any("hyperparameter" in test for test in all_results.keys()):
            print("  • Update hyperparameter_optimizer.py to use gymnasium instead of gym")
            print("  • Fix import dependencies in RL services")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)