#!/usr/bin/env python3
"""
Schlep Engine Monorepo Test Runner
Handles Python path setup and environment configuration for testing.
"""

import sys
import os
import subprocess
from pathlib import Path

def setup_monorepo_environment():
    """Setup environment for monorepo testing."""
    
    # Get repository root
    repo_root = Path(__file__).parent
    
    # Add all sub-project paths to PYTHONPATH
    python_paths = [
        str(repo_root / "apps" / "api"),
        str(repo_root / "packages" / "cli" / "src"),
        str(repo_root / "packages" / "python-sdk" / "src"),
        str(repo_root)
    ]
    
    # Set PYTHONPATH environment variable
    current_python_path = os.environ.get("PYTHONPATH", "")
    if current_python_path:
        python_paths.append(current_python_path)
    
    os.environ["PYTHONPATH"] = ":".join(python_paths)
    
    # Set testing environment
    os.environ["TESTING"] = "true"
    os.environ["ENVIRONMENT"] = "testing"
    
    # Load test environment file if it exists
    env_test_file = repo_root / ".env.test"
    if env_test_file.exists():
        print(f"Loading test environment from {env_test_file}")
        try:
            from dotenv import load_dotenv
            load_dotenv(env_test_file)
        except ImportError:
            print("Warning: python-dotenv not installed, skipping .env.test loading")
    
    print(f"PYTHONPATH: {os.environ['PYTHONPATH']}")
    print(f"Testing environment: {os.environ.get('TESTING')}")

def run_tests(args=None):
    """Run pytest with proper monorepo setup."""
    
    setup_monorepo_environment()
    
    # Default pytest arguments
    default_args = [
        "python3", "-m", "pytest",
        "-v",
        "--tb=short", 
        "--strict-config",
        "--strict-markers"
    ]
    
    # Add user-provided arguments
    if args:
        default_args.extend(args)
    
    print(f"Running: {' '.join(default_args)}")
    print("-" * 60)
    
    # Run pytest
    try:
        result = subprocess.run(default_args, cwd=Path(__file__).parent)
        return result.returncode
    except KeyboardInterrupt:
        print("\nTest run interrupted by user")
        return 1
    except Exception as e:
        print(f"Error running tests: {e}")
        return 1

if __name__ == "__main__":
    # Pass through command line arguments to pytest
    test_args = sys.argv[1:]
    exit_code = run_tests(test_args)
    sys.exit(exit_code)