#!/usr/bin/env python3
"""
Schlep-engine Dependency Manager
================================

Manages optimized dependency installation based on deployment type and features needed.
Helps reduce dependency bloat and installation time.

Usage:
    python scripts/dependency_manager.py --profile production
    python scripts/dependency_manager.py --profile development  
    python scripts/dependency_manager.py --profile ml-service
    python scripts/dependency_manager.py --analyze
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Set
import time

class DependencyManager:
    """Manages Schlep-engine dependencies with optimization"""
    
    def __init__(self):
        self.backend_dir = Path(__file__).parent.parent
        self.dependency_profiles = {
            "production": {
                "files": ["requirements.txt"],
                "description": "Optimized for production API server (minimal dependencies)",
                "size_estimate": "~200MB"
            },
            "development": {
                "files": ["requirements.txt", "requirements-dev-optimized.txt"],
                "description": "Production + development tools (testing, linting, debugging)",
                "size_estimate": "~400MB"
            },
            "ml-service": {
                "files": ["requirements-ml-optimized.txt"],
                "description": "ML/AI service dependencies (separate microservice)",
                "size_estimate": "~800MB"
            },
            "full": {
                "files": ["requirements.txt", "requirements-dev-optimized.txt", "requirements-ml-optimized.txt"],
                "description": "All dependencies (monolithic deployment)",
                "size_estimate": "~1.2GB"
            },
            "minimal": {
                "files": ["requirements-core-optimized.txt"],
                "description": "Absolute minimal core dependencies",
                "size_estimate": "~150MB"
            }
        }
    
    def analyze_current_dependencies(self):
        """Analyze current dependency situation"""
        print("🔍 Analyzing Schlep-engine dependency situation...")
        print()
        
        # Check existing files
        existing_files = []
        for file_name in ["requirements.txt", "requirements-core.txt", "requirements-ml.txt", "requirements-dev.txt"]:
            file_path = self.backend_dir / file_name
            if file_path.exists():
                with open(file_path) as f:
                    lines = [line.strip() for line in f if line.strip() and not line.startswith('#')]
                    package_count = len([line for line in lines if '==' in line])
                    existing_files.append({
                        "file": file_name,
                        "packages": package_count,
                        "size_kb": file_path.stat().st_size / 1024
                    })
        
        print("📊 Current Dependency Files:")
        for file_info in existing_files:
            print(f"   {file_info['file']}: {file_info['packages']} packages ({file_info['size_kb']:.1f}KB)")
        
        total_packages = sum(f['packages'] for f in existing_files)
        print(f"\n📈 Total packages across all files: {total_packages}")
        
        if total_packages > 60:
            print("⚠️  HIGH: Consider using optimized profiles to reduce dependency bloat")
        elif total_packages > 40:
            print("🟡 MODERATE: Good separation, but can be optimized further")
        else:
            print("✅ OPTIMIZED: Good dependency management")
        
        print()
        print("💡 Recommendations:")
        if total_packages > 50:
            print("   - Use 'production' profile for API server deployment")
            print("   - Use separate ML service with 'ml-service' profile")
            print("   - Use 'development' profile only for local development")
        
        return existing_files
    
    def install_profile(self, profile_name: str, upgrade: bool = False):
        """Install dependencies for a specific profile"""
        if profile_name not in self.dependency_profiles:
            print(f"❌ Unknown profile: {profile_name}")
            print(f"Available profiles: {', '.join(self.dependency_profiles.keys())}")
            return False
        
        profile = self.dependency_profiles[profile_name]
        
        print(f"🚀 Installing dependencies for '{profile_name}' profile")
        print(f"📝 Description: {profile['description']}")
        print(f"💾 Estimated size: {profile['size_estimate']}")
        print()
        
        # Check which files exist
        existing_files = []
        missing_files = []
        
        for req_file in profile['files']:
            file_path = self.backend_dir / req_file
            if file_path.exists():
                existing_files.append(req_file)
            else:
                missing_files.append(req_file)
        
        if missing_files:
            print(f"⚠️  Missing dependency files: {', '.join(missing_files)}")
            print("   Run with --analyze to see current situation")
            return False
        
        # Install dependencies
        success = True
        total_start_time = time.time()
        
        for req_file in existing_files:
            file_path = self.backend_dir / req_file
            print(f"📦 Installing from {req_file}...")
            
            cmd = [sys.executable, "-m", "pip", "install", "-r", str(file_path)]
            if upgrade:
                cmd.append("--upgrade")
            
            start_time = time.time()
            result = subprocess.run(cmd, capture_output=True, text=True)
            duration = time.time() - start_time
            
            if result.returncode == 0:
                print(f"   ✅ Installed successfully ({duration:.1f}s)")
            else:
                print(f"   ❌ Installation failed ({duration:.1f}s)")
                print(f"   Error: {result.stderr}")
                success = False
        
        total_duration = time.time() - total_start_time
        
        if success:
            print(f"\n🎉 Profile '{profile_name}' installed successfully!")
            print(f"⏱️  Total installation time: {total_duration:.1f}s")
            self._post_install_recommendations(profile_name)
        else:
            print(f"\n❌ Installation failed for profile '{profile_name}'")
        
        return success
    
    def _post_install_recommendations(self, profile_name: str):
        """Show post-installation recommendations"""
        print("\n💡 Post-installation recommendations:")
        
        if profile_name == "production":
            print("   - Verify minimal dependencies with: pip list | wc -l")
            print("   - Test API startup time: time uvicorn app.main:app")
            print("   - Consider Docker multi-stage build for smaller image")
        
        elif profile_name == "development":
            print("   - Set up pre-commit hooks: pre-commit install")
            print("   - Run tests: pytest")
            print("   - Check code quality: black . && isort . && flake8")
        
        elif profile_name == "ml-service":
            print("   - Test ML imports: python -c 'import sklearn, pandas, numpy'")
            print("   - Consider separate container for ML service")
            print("   - Monitor memory usage with heavy ML workloads")
        
        print("   - Update your IDE/editor settings for the new packages")
        print("   - Consider creating a virtual environment lock file")
    
    def create_lockfile(self):
        """Create a dependency lock file for reproducible builds"""
        print("🔒 Creating dependency lock file...")
        
        lockfile_path = self.backend_dir / "requirements.lock"
        
        # Generate lock file with exact versions
        cmd = [sys.executable, "-m", "pip", "freeze"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            with open(lockfile_path, 'w') as f:
                f.write("# Schlep-engine Dependency Lock File\n")
                f.write("# Generated automatically - do not edit manually\n")
                f.write(f"# Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write(result.stdout)
            
            print(f"✅ Lock file created: {lockfile_path}")
            print("   Use this for reproducible production deployments")
        else:
            print(f"❌ Failed to create lock file: {result.stderr}")
    
    def compare_profiles(self):
        """Compare different dependency profiles"""
        print("📊 Dependency Profile Comparison:")
        print()
        
        for name, profile in self.dependency_profiles.items():
            print(f"🔹 {name.upper()}")
            print(f"   Description: {profile['description']}")
            print(f"   Size: {profile['size_estimate']}")
            print(f"   Files: {', '.join(profile['files'])}")
            print()

def main():
    parser = argparse.ArgumentParser(description="Schlep-engine Dependency Manager")
    parser.add_argument("--profile", choices=["production", "development", "ml-service", "full", "minimal"],
                       help="Install dependencies for specific profile")
    parser.add_argument("--upgrade", action="store_true", help="Upgrade packages to latest versions")
    parser.add_argument("--analyze", action="store_true", help="Analyze current dependency situation")
    parser.add_argument("--compare", action="store_true", help="Compare dependency profiles")
    parser.add_argument("--lockfile", action="store_true", help="Create dependency lock file")
    
    args = parser.parse_args()
    
    manager = DependencyManager()
    
    if args.analyze:
        manager.analyze_current_dependencies()
    elif args.compare:
        manager.compare_profiles()
    elif args.lockfile:
        manager.create_lockfile()
    elif args.profile:
        manager.install_profile(args.profile, args.upgrade)
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 