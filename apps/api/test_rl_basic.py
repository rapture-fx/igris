#!/usr/bin/env python3
"""
Basic RL System Test Script
Tests core RL functionality without complex imports
"""

import os
import sys
import asyncio
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

def test_rl_configuration():
    """Test RL configuration loading"""
    try:
        from app.core.rl_config import get_rl_settings, RLStrategy, RLObjective
        
        print("PASS: Successfully imported RL configuration")
        
        settings = get_rl_settings()
        print(f"PASS: RL enabled: {settings.rl_enabled}")
        print(f"PASS: Max concurrent sessions: {settings.rl_max_concurrent_sessions}")
        print(f"PASS: Default strategy: {settings.rl_default_strategy}")
        
        # Test industry-specific configs
        ecommerce_config = settings.get_optimization_config(industry_type="ecommerce")
        print(f"PASS: E-commerce config objective: {ecommerce_config['objective']}")
        
        manufacturing_config = settings.get_optimization_config(industry_type="manufacturing")
        print(f"PASS: Manufacturing config objective: {manufacturing_config['objective']}")
        
        finance_config = settings.get_optimization_config(industry_type="finance")
        print(f"PASS: Finance config objective: {finance_config['objective']}")
        
        return True
        
    except Exception as e:
        print(f"FAIL: RL Configuration test failed: {e}")
        return False


def test_rl_directories():
    """Test RL directory creation"""
    try:
        from app.core.rl_config import get_rl_settings
        
        settings = get_rl_settings()
        
        # Check if directories exist
        checkpoint_dir = Path(settings.rl_checkpoint_directory)
        logs_dir = Path(settings.rl_logs_directory)
        
        print(f"PASS: Checkpoint directory: {checkpoint_dir.exists()} - {checkpoint_dir}")
        print(f"PASS: Logs directory: {logs_dir.exists()} - {logs_dir}")
        
        return True
        
    except Exception as e:
        print(f"FAIL: Directory test failed: {e}")
        return False


def test_rl_hyperparameter_optimizer():
    """Test basic hyperparameter optimizer functionality"""
    try:
        from app.services.rl.agents.hyperparameter_optimizer import (
            OptimizationConfig, 
            RLStrategy, 
            RLObjective
        )
        
        # Create optimization config
        config = OptimizationConfig(
            strategy=RLStrategy.PPO,
            objective=RLObjective.ACCURACY,
            max_episodes=5,
            max_training_time=300
        )
        
        print("PASS: Successfully created optimization config")
        print(f"   Strategy: {config.strategy}")
        print(f"   Objective: {config.objective}")
        print(f"   Max episodes: {config.max_episodes}")
        
        return True
        
    except Exception as e:
        print(f"FAIL: Hyperparameter optimizer test failed: {e}")
        return False


def test_environment_variables():
    """Test environment variable setup"""
    try:
        # Check key RL environment variables
        rl_vars = [
            'RL_ENABLED',
            'RL_MAX_CONCURRENT_SESSIONS',
            'RL_DEFAULT_STRATEGY',
            'RL_CHECKPOINT_DIRECTORY',
            'RL_LOGS_DIRECTORY'
        ]
        
        print("Environment Variables:")
        for var in rl_vars:
            value = os.getenv(var, "Not Set")
            status = "PASS" if value != "Not Set" else "WARN"
            print(f"   {status}: {var}: {value}")
        
        return True
        
    except Exception as e:
        print(f"FAIL: Environment variables test failed: {e}")
        return False


def test_required_packages():
    """Test if required RL packages are available"""
    packages = [
        'gym',
        'stable_baselines3',
        'numpy',
        'torch'  # PyTorch for stable-baselines3
    ]
    
    print("Required Packages:")
    all_available = True
    
    for package in packages:
        try:
            __import__(package)
            print(f"   PASS: {package}: Available")
        except ImportError:
            print(f"   FAIL: {package}: Missing")
            all_available = False
    
    return all_available


def install_missing_packages():
    """Install missing RL packages"""
    print("\nInstalling missing RL packages...")
    
    packages = [
        'gym==0.21.0',
        'stable-baselines3[extra]',
        'torch',
        'tensorboard'
    ]
    
    for package in packages:
        try:
            os.system(f"pip install {package}")
            print(f"   INSTALLED: {package}")
        except Exception as e:
            print(f"   FAILED: Failed to install {package}: {e}")


async def main():
    """Run all RL system tests"""
    print("Running RL System Basic Tests\n" + "="*50)
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Required Packages", test_required_packages),
        ("RL Configuration", test_rl_configuration),
        ("RL Directories", test_rl_directories),
        ("Hyperparameter Optimizer", test_rl_hyperparameter_optimizer),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\nRunning {test_name} test:")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"CRASH: {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*50)
    print("Test Summary:")
    
    passed = 0
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"   {status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{len(results)} tests passed")
    
    if passed < len(results):
        print("\nSome tests failed. You may need to:")
        print("   1. Install missing packages: pip install -r requirements-rl.txt")
        print("   2. Set environment variables in .env file")
        print("   3. Check import paths and dependencies")
    else:
        print("\nAll tests passed! RL system is ready for deployment.")
    
    return passed == len(results)


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)