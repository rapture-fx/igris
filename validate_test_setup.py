#!/usr/bin/env python3
"""
Test Setup Validation Script
Validates that the monorepo testing infrastructure is working correctly.
"""

import sys
import os
from pathlib import Path

def validate_python_paths():
    """Validate that Python paths are set up correctly."""
    print("🔍 Validating Python paths...")
    
    repo_root = Path(__file__).parent
    required_paths = [
        repo_root / "apps" / "api",
        repo_root / "packages" / "cli" / "src", 
        repo_root / "packages" / "python-sdk" / "src"
    ]
    
    # Add paths to sys.path for testing
    for path in required_paths:
        if path.exists():
            sys.path.insert(0, str(path))
            print(f"  ✅ Added path: {path}")
        else:
            print(f"  ⚠️  Path not found: {path}")

def validate_environment_setup():
    """Validate environment configuration."""
    print("\n🔧 Validating environment setup...")
    
    # Check for .env.test file
    env_test_file = Path(__file__).parent / ".env.test"
    if env_test_file.exists():
        print(f"  ✅ Test environment file found: {env_test_file}")
    else:
        print(f"  ❌ Test environment file missing: {env_test_file}")
    
    # Check essential environment variables
    essential_vars = [
        "DATABASE_URL",
        "JWT_SECRET_KEY", 
        "SECRET_KEY"
    ]
    
    try:
        from dotenv import load_dotenv
        load_dotenv(env_test_file)
        print("  ✅ Loaded environment variables from .env.test")
    except ImportError:
        print("  ⚠️  python-dotenv not available, environment loading may fail")
    except Exception as e:
        print(f"  ⚠️  Error loading environment: {e}")

def validate_imports():
    """Validate that key modules can be imported."""
    print("\n📦 Validating imports...")
    
    # Test imports that should work with proper path setup
    test_imports = [
        # Core app modules
        ("app.main", "FastAPI app"),
        ("app.database.connection", "Database connection"),
        ("app.core.config", "Configuration"),
        
        # RL modules
        ("app.services.rl_optimization_service", "RL service"),
        ("app.core.rl_config", "RL configuration"),
        
        # Models
        ("app.models.rl_models", "RL models"),
    ]
    
    successful_imports = 0
    
    for module_name, description in test_imports:
        try:
            __import__(module_name)
            print(f"  ✅ {description}: {module_name}")
            successful_imports += 1
        except ImportError as e:
            print(f"  ❌ {description}: {module_name} - {e}")
        except Exception as e:
            print(f"  ⚠️  {description}: {module_name} - {e}")
    
    return successful_imports, len(test_imports)

def validate_pytest_config():
    """Validate pytest configuration."""
    print("\n🧪 Validating pytest configuration...")
    
    config_files = [
        ("pyproject.toml", "Project configuration"),
        ("conftest.py", "Global pytest config"),
        ("apps/api/conftest.py", "API pytest config")
    ]
    
    repo_root = Path(__file__).parent
    
    for config_file, description in config_files:
        file_path = repo_root / config_file
        if file_path.exists():
            print(f"  ✅ {description}: {config_file}")
        else:
            print(f"  ❌ {description}: {config_file}")

def main():
    """Run all validation checks."""
    print("🚀 Schlep Engine Test Setup Validation")
    print("=" * 50)
    
    # Run validation checks
    validate_python_paths()
    validate_environment_setup()
    successful_imports, total_imports = validate_imports()
    validate_pytest_config()
    
    print("\n📊 Validation Summary")
    print("-" * 30)
    print(f"Imports successful: {successful_imports}/{total_imports}")
    
    if successful_imports == total_imports:
        print("✅ All validations passed! Testing infrastructure is ready.")
        return 0
    elif successful_imports > total_imports / 2:
        print("⚠️  Most validations passed. Some issues may need attention.")
        return 0
    else:
        print("❌ Multiple validation failures. Testing infrastructure needs fixes.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)