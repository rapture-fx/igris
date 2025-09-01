#!/usr/bin/env python3
"""
Dependency Validation Script for Schlep-engine
==============================================

Validates all requirement files for dependency conflicts and compatibility.
Tests critical module imports and basic functionality.

Usage:
    python validate_dependencies.py [--fix-conflicts] [--verbose]
"""

import os
import sys
import subprocess
import importlib
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import argparse
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Results of dependency validation"""
    file_path: str
    success: bool
    errors: List[str]
    warnings: List[str]
    install_time: float = 0.0

class DependencyValidator:
    """Validates Python dependencies across multiple requirement files"""
    
    def __init__(self, base_path: str = None):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent
        self.results: List[ValidationResult] = []
        
    def find_requirement_files(self) -> List[Path]:
        """Find all requirements*.txt files"""
        req_files = []
        for pattern in ['requirements*.txt']:
            req_files.extend(self.base_path.glob(pattern))
        
        # Sort by priority - main requirements first
        priority_order = ['requirements.txt', 'requirements-rl.txt', 'requirements-ml.txt']
        sorted_files = []
        
        for priority_file in priority_order:
            for file_path in req_files:
                if file_path.name == priority_file:
                    sorted_files.append(file_path)
                    break
        
        # Add remaining files
        for file_path in req_files:
            if file_path not in sorted_files:
                sorted_files.append(file_path)
                
        return sorted_files
    
    def validate_requirement_file(self, req_file: Path) -> ValidationResult:
        """Validate a single requirement file using pip install --dry-run"""
        logger.info(f"Validating {req_file.name}...")
        
        result = ValidationResult(
            file_path=str(req_file),
            success=False,
            errors=[],
            warnings=[]
        )
        
        try:
            # Run pip install --dry-run to check for conflicts
            cmd = [
                sys.executable, "-m", "pip", "install",
                "--dry-run", "--quiet", "--disable-pip-version-check",
                "-r", str(req_file)
            ]
            
            import time
            start_time = time.time()
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            result.install_time = time.time() - start_time
            
            if process.returncode == 0:
                result.success = True
                logger.info(f"✅ {req_file.name} validation passed")
            else:
                result.success = False
                error_output = process.stderr.strip()
                if error_output:
                    result.errors.append(error_output)
                else:
                    result.errors.append("Unknown pip error")
                logger.error(f"❌ {req_file.name} validation failed")
                
        except subprocess.TimeoutExpired:
            result.errors.append("Validation timed out after 5 minutes")
            logger.error(f"⏰ {req_file.name} validation timed out")
        except Exception as e:
            result.errors.append(f"Validation error: {str(e)}")
            logger.error(f"💥 {req_file.name} validation error: {e}")
            
        return result
    
    def test_critical_imports(self) -> ValidationResult:
        """Test importing critical modules"""
        logger.info("Testing critical module imports...")
        
        result = ValidationResult(
            file_path="critical_imports",
            success=True,
            errors=[],
            warnings=[]
        )
        
        # Core modules that must be importable
        critical_modules = {
            'fastapi': 'FastAPI web framework',
            'pydantic': 'Data validation',
            'sqlalchemy': 'Database ORM',
            'redis': 'Redis client',
            'celery': 'Background tasks',
            'transformers': 'ML transformers',
            'numpy': 'Numerical computing',
            'pandas': 'Data manipulation',
            'requests': 'HTTP client',
            'cryptography': 'Cryptographic functions',
        }
        
        # RL-specific modules (may not be installed)
        rl_modules = {
            'torch': 'PyTorch deep learning',
            'stable_baselines3': 'RL algorithms',
            'gymnasium': 'RL environments',
        }
        
        # ML-specific modules (may not be installed)  
        ml_modules = {
            'tensorflow': 'TensorFlow ML framework',
            'sklearn': 'Scikit-learn ML',
            'matplotlib': 'Plotting library',
        }
        
        def test_module_group(modules: Dict[str, str], group_name: str, required: bool = True):
            """Test a group of modules"""
            for module_name, description in modules.items():
                try:
                    importlib.import_module(module_name)
                    logger.info(f"✅ {module_name} ({description}) - OK")
                except ImportError as e:
                    message = f"{module_name} ({description}) - {str(e)}"
                    if required:
                        result.errors.append(message)
                        result.success = False
                        logger.error(f"❌ {message}")
                    else:
                        result.warnings.append(message)
                        logger.warning(f"⚠️  {message}")
        
        # Test critical modules
        test_module_group(critical_modules, "Critical", required=True)
        
        # Test optional modules
        test_module_group(rl_modules, "RL", required=False)
        test_module_group(ml_modules, "ML", required=False)
        
        return result
    
    def test_rl_functionality(self) -> ValidationResult:
        """Test basic RL system functionality"""
        logger.info("Testing RL system functionality...")
        
        result = ValidationResult(
            file_path="rl_functionality",
            success=True,
            errors=[],
            warnings=[]
        )
        
        try:
            # Test PyTorch
            import torch
            if torch.cuda.is_available():
                logger.info(f"✅ CUDA available: {torch.cuda.get_device_name(0)}")
            else:
                result.warnings.append("CUDA not available - using CPU")
                logger.warning("⚠️  CUDA not available - using CPU")
            
            # Test Stable Baselines3
            from stable_baselines3 import PPO
            from stable_baselines3.common.env_checker import check_env
            import gymnasium as gym
            
            # Create a simple test environment
            env = gym.make('CartPole-v1')
            check_env(env)
            
            # Test basic PPO creation (don't train)
            model = PPO('MlpPolicy', env, verbose=0)
            logger.info("✅ RL system basic functionality test passed")
            
        except ImportError as e:
            result.warnings.append(f"RL modules not available: {e}")
            logger.warning(f"⚠️  RL system not fully available: {e}")
        except Exception as e:
            result.errors.append(f"RL functionality test failed: {e}")
            result.success = False
            logger.error(f"❌ RL functionality test failed: {e}")
            
        return result
    
    def generate_report(self) -> str:
        """Generate a comprehensive validation report"""
        report_lines = [
            "=" * 80,
            "SCHLEP-ENGINE DEPENDENCY VALIDATION REPORT",
            "=" * 80,
            ""
        ]
        
        # Summary
        total_files = len([r for r in self.results if r.file_path.endswith('.txt')])
        successful_files = len([r for r in self.results if r.file_path.endswith('.txt') and r.success])
        
        report_lines.extend([
            f"Total requirement files: {total_files}",
            f"Successful validations: {successful_files}",
            f"Failed validations: {total_files - successful_files}",
            ""
        ])
        
        # Detailed results
        for result in self.results:
            report_lines.append(f"File: {result.file_path}")
            report_lines.append(f"Status: {'✅ PASS' if result.success else '❌ FAIL'}")
            
            if hasattr(result, 'install_time') and result.install_time > 0:
                report_lines.append(f"Validation time: {result.install_time:.2f}s")
            
            if result.errors:
                report_lines.append("Errors:")
                for error in result.errors:
                    report_lines.append(f"  - {error}")
                    
            if result.warnings:
                report_lines.append("Warnings:")
                for warning in result.warnings:
                    report_lines.append(f"  - {warning}")
                    
            report_lines.append("-" * 40)
            
        return "\n".join(report_lines)
    
    def run_validation(self, test_imports: bool = True, test_rl: bool = True) -> bool:
        """Run complete validation suite"""
        logger.info("Starting dependency validation...")
        
        # Find and validate requirement files
        req_files = self.find_requirement_files()
        logger.info(f"Found {len(req_files)} requirement files")
        
        for req_file in req_files:
            result = self.validate_requirement_file(req_file)
            self.results.append(result)
            
        # Test imports if requested
        if test_imports:
            import_result = self.test_critical_imports()
            self.results.append(import_result)
            
        # Test RL functionality if requested
        if test_rl:
            rl_result = self.test_rl_functionality()
            self.results.append(rl_result)
            
        # Check overall success
        all_success = all(result.success for result in self.results)
        
        logger.info("Validation complete!")
        return all_success

def main():
    """Main validation function"""
    parser = argparse.ArgumentParser(description="Validate Schlep-engine dependencies")
    parser.add_argument("--skip-imports", action="store_true", help="Skip import tests")
    parser.add_argument("--skip-rl", action="store_true", help="Skip RL functionality tests")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--report-file", help="Save report to file")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        
    validator = DependencyValidator()
    success = validator.run_validation(
        test_imports=not args.skip_imports,
        test_rl=not args.skip_rl
    )
    
    # Generate and display report
    report = validator.generate_report()
    print(report)
    
    # Save report if requested
    if args.report_file:
        with open(args.report_file, 'w') as f:
            f.write(report)
        logger.info(f"Report saved to {args.report_file}")
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()