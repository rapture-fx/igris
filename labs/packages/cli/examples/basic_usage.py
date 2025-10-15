#!/usr/bin/env python3
"""
Basic usage examples for Schlep-engine CLI.
This script demonstrates common CLI operations programmatically.
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command):
    """Run a CLI command and return the result."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            check=True
        )
        print(f"✓ {command}")
        if result.stdout:
            print(f"  Output: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {command}")
        print(f"  Error: {e.stderr.strip()}")
        return False

def main():
    """Demonstrate basic CLI usage."""
    print("Schlep-engine CLI - Basic Usage Examples")
    print("=" * 50)
    
    # Check if CLI is installed
    if not run_command("schlep --version"):
        print("Please install the CLI first: pip install schlep-engine-cli")
        sys.exit(1)
    
    print("\n1. Configuration Management")
    print("-" * 30)
    
    # Initialize configuration
    run_command("schlep config init")
    
    # Show current configuration
    run_command("schlep config list")
    
    # Set some configuration values
    run_command("schlep config set parallel_jobs 8")
    run_command("schlep config set show_progress true")
    
    print("\n2. Authentication (Interactive)")
    print("-" * 30)
    print("Note: Authentication requires an API key")
    print("Get your API key at: https://dashboard.schlep-engine.com/api-keys")
    
    # Check current auth status
    run_command("schlep auth status")
    
    # Note: Actual login would require user input
    print("To login: schlep auth login --api-key YOUR_API_KEY")
    
    print("\n3. Data Processing (Examples)")
    print("-" * 30)
    
    # Create sample data file
    sample_data_file = Path("sample_data.csv")
    if not sample_data_file.exists():
        with open(sample_data_file, 'w') as f:
            f.write("id,name,value,category\n")
            f.write("1,Item A,100,electronics\n")
            f.write("2,Item B,200,books\n")
            f.write("3,Item C,150,electronics\n")
            f.write("4,Item D,300,books\n")
        print(f"Created sample data file: {sample_data_file}")
    
    # Example processing commands (these would require authentication)
    print("Example commands (require authentication):")
    print("  schlep process file sample_data.csv --clean --profile")
    print("  schlep process batch '*.csv' --parallel 4")
    print("  schlep process upload sample_data.csv")
    
    print("\n4. Pipeline Management (Examples)")
    print("-" * 30)
    
    # Create sample pipeline configuration
    pipeline_config = Path("sample_pipeline.yml")
    if not pipeline_config.exists():
        with open(pipeline_config, 'w') as f:
            f.write("""
name: sample-fraud-detection
description: Sample fraud detection pipeline
model_type: random_forest
features:
  - amount
  - merchant_category
  - time_of_day
  - location
target: is_fraud
parameters:
  n_estimators: 100
  max_depth: 10
  random_state: 42
""")
        print(f"Created sample pipeline config: {pipeline_config}")
    
    print("Example pipeline commands (require authentication):")
    print("  schlep pipeline create sample_pipeline.yml")
    print("  schlep pipeline list")
    print("  schlep pipeline status my-pipeline")
    print("  schlep pipeline start my-pipeline")
    
    print("\n5. Monitoring (Examples)")
    print("-" * 30)
    
    print("Example monitoring commands (require authentication):")
    print("  schlep monitoring status")
    print("  schlep monitoring metrics")
    print("  schlep monitoring jobs --status running")
    
    print("\n6. Help and Documentation")
    print("-" * 30)
    
    # Show help
    run_command("schlep --help")
    
    # Show help for specific commands
    print("\nGet help for specific commands:")
    print("  schlep auth --help")
    print("  schlep process --help")
    print("  schlep pipeline --help")
    print("  schlep config --help")
    print("  schlep monitoring --help")
    
    print("\n7. Advanced Usage Patterns")
    print("-" * 30)
    
    print("Watch mode examples:")
    print("  schlep pipeline status my-pipeline --watch")
    print("  schlep monitoring metrics --watch")
    
    print("\nBatch processing examples:")
    print("  schlep process batch 'data/*.csv' --config pipeline.yml")
    print("  schlep process batch '**/*.json' --parallel 8 --continue-on-error")
    
    print("\nJSON output for scripting:")
    print("  schlep auth status --json")
    print("  schlep pipeline list --json")
    print("  schlep monitoring metrics --json")
    
    print("\nConfiguration management:")
    print("  schlep config update parallel_jobs=8 timeout=60")
    print("  schlep config validate")
    print("  schlep config reset")
    
    print("\n" + "=" * 50)
    print("For more examples, see: https://docs.schlep-engine.com/cli")

if __name__ == "__main__":
    main()