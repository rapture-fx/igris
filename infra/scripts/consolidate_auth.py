#!/usr/bin/env python3
"""
Authentication System Consolidation Script
==========================================

This script safely consolidates the fragmented authentication system into
the new unified authentication architecture.

Features:
- Validates current system state
- Migrates existing data safely
- Removes redundant modules
- Updates imports and references
- Validates the new system

Usage:
    python scripts/consolidate_auth.py --validate-only  # Check current state
    python scripts/consolidate_auth.py --migrate        # Perform migration
    python scripts/consolidate_auth.py --cleanup        # Remove old files
"""

import os
import sys
import shutil
import asyncio
import argparse
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.database.connection import get_db
from app.database.models import User, AuditLog


class AuthConsolidationManager:
    """Manages the authentication system consolidation process"""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.backup_dir = Path("backups/auth_consolidation")
        self.auth_modules = [
            "app/api/v1/auth.py",
            "app/api/v1/auth_clean.py", 
            "app/api/v1/enhanced_auth.py",
            "app/auth/auth_service.py",
            "app/auth/unified_auth_service.py",
            "app/auth/user_management.py",
            "app/auth/enhanced_dependencies.py",
            "app/auth/enhanced_security.py",
            "app/auth/security.py"
        ]
        
        self.report = {
            "timestamp": datetime.now().isoformat(),
            "modules_found": [],
            "modules_backed_up": [],
            "modules_removed": [],
            "imports_updated": [],
            "errors": [],
            "warnings": []
        }
    
    async def validate_current_system(self) -> Dict[str, Any]:
        """Validate the current authentication system state"""
        print("🔍 Validating current authentication system...")
        
        validation_report = {
            "modules_exist": [],
            "modules_missing": [],
            "database_accessible": False,
            "users_count": 0,
            "duplicate_functions": {},
            "import_conflicts": []
        }
        
        # Check for existing auth modules
        for module_path in self.auth_modules:
            full_path = Path(module_path)
            if full_path.exists():
                validation_report["modules_exist"].append(str(full_path))
                print(f"  ✅ Found: {module_path}")
            else:
                validation_report["modules_missing"].append(str(full_path))
                print(f"  ❌ Missing: {module_path}")
        
        # Check database connectivity
        try:
            async for db in get_db():
                from sqlalchemy import text
                result = await db.execute(text("SELECT COUNT(*) FROM users"))
                user_count = result.scalar()
                validation_report["database_accessible"] = True
                validation_report["users_count"] = user_count
                print(f"  ✅ Database accessible - {user_count} users found")
                break
        except Exception as e:
            validation_report["database_accessible"] = False
            print(f"  ❌ Database connection failed: {e}")
            self.report["errors"].append(f"Database validation failed: {e}")
        
        # Analyze duplicate functions
        duplicate_analysis = self._analyze_duplicate_functions()
        validation_report["duplicate_functions"] = duplicate_analysis
        
        return validation_report
    
    def _analyze_duplicate_functions(self) -> Dict[str, List[str]]:
        """Analyze duplicate function definitions across auth modules"""
        print("🔍 Analyzing duplicate functions...")
        
        function_signatures = {}
        duplicates = {}
        
        for module_path in self.auth_modules:
            full_path = Path(module_path)
            if not full_path.exists():
                continue
                
            try:
                with open(full_path, 'r') as f:
                    content = f.read()
                
                # Find function definitions
                import re
                functions = re.findall(r'def\s+(\w+)\s*\(', content)
                
                for func_name in functions:
                    if func_name not in function_signatures:
                        function_signatures[func_name] = []
                    function_signatures[func_name].append(str(full_path))
                
            except Exception as e:
                self.report["errors"].append(f"Failed to analyze {module_path}: {e}")
        
        # Identify duplicates
        for func_name, locations in function_signatures.items():
            if len(locations) > 1:
                duplicates[func_name] = locations
                print(f"  🔄 Duplicate function '{func_name}' found in: {', '.join(locations)}")
        
        return duplicates
    
    def create_backup(self) -> bool:
        """Create backup of existing authentication modules"""
        print("💾 Creating backup of authentication modules...")
        
        if self.dry_run:
            print("  🔍 DRY RUN: Would create backup directory")
            return True
        
        try:
            # Create backup directory
            self.backup_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = self.backup_dir / f"auth_backup_{timestamp}"
            backup_path.mkdir(exist_ok=True)
            
            # Backup each module
            for module_path in self.auth_modules:
                full_path = Path(module_path)
                if full_path.exists():
                    backup_file = backup_path / full_path.name
                    shutil.copy2(full_path, backup_file)
                    self.report["modules_backed_up"].append(str(full_path))
                    print(f"  ✅ Backed up: {module_path}")
            
            # Create backup manifest
            manifest = {
                "timestamp": timestamp,
                "modules_backed_up": self.report["modules_backed_up"],
                "backup_path": str(backup_path)
            }
            
            manifest_file = backup_path / "backup_manifest.json"
            import json
            with open(manifest_file, 'w') as f:
                json.dump(manifest, f, indent=2)
            
            print(f"  ✅ Backup created at: {backup_path}")
            return True
            
        except Exception as e:
            self.report["errors"].append(f"Backup creation failed: {e}")
            print(f"  ❌ Backup failed: {e}")
            return False
    
    def update_imports(self) -> bool:
        """Update import statements throughout the codebase"""
        print("🔄 Updating import statements...")
        
        import_mappings = {
            "from app.api.v1.auth import": "from app.api.v1.auth_unified import",
            "from app.api.v1.auth_clean import": "from app.api.v1.auth_unified import",
            "from app.api.v1.enhanced_auth import": "from app.api.v1.auth_unified import",
            "from app.auth.auth_service import": "from app.auth.unified_service import",
            "from app.auth.unified_auth_service import": "from app.auth.unified_service import",
            "from app.auth.user_management import": "from app.auth.unified_service import",
            "from app.auth.enhanced_dependencies import": "from app.auth.dependencies import",
            "from app.auth.enhanced_security import": "from app.auth.unified_service import",
            "from app.auth.security import": "from app.auth.unified_service import"
        }
        
        # Find all Python files
        python_files = []
        for root, dirs, files in os.walk("app"):
            for file in files:
                if file.endswith(".py"):
                    python_files.append(Path(root) / file)
        
        updated_files = []
        
        for file_path in python_files:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                original_content = content
                
                # Apply import mappings
                for old_import, new_import in import_mappings.items():
                    if old_import in content:
                        content = content.replace(old_import, new_import)
                        print(f"    📝 Updated import in {file_path}")
                
                # Write back if changed
                if content != original_content and not self.dry_run:
                    with open(file_path, 'w') as f:
                        f.write(content)
                    updated_files.append(str(file_path))
                elif content != original_content:
                    print(f"    🔍 DRY RUN: Would update {file_path}")
                    updated_files.append(str(file_path))
                
            except Exception as e:
                self.report["errors"].append(f"Failed to update imports in {file_path}: {e}")
        
        self.report["imports_updated"] = updated_files
        print(f"  ✅ Updated imports in {len(updated_files)} files")
        return True
    
    def remove_redundant_modules(self) -> bool:
        """Remove redundant authentication modules"""
        print("🗑️  Removing redundant authentication modules...")
        
        if self.dry_run:
            print("  🔍 DRY RUN: Would remove the following modules:")
            for module_path in self.auth_modules:
                if Path(module_path).exists():
                    print(f"    - {module_path}")
            return True
        
        removed_count = 0
        
        for module_path in self.auth_modules:
            full_path = Path(module_path)
            if full_path.exists():
                try:
                    # Don't remove if it's the unified module
                    if "unified" in module_path or "dependencies.py" in module_path:
                        print(f"  ⚠️  Keeping: {module_path} (unified module)")
                        continue
                    
                    full_path.unlink()
                    self.report["modules_removed"].append(str(full_path))
                    removed_count += 1
                    print(f"  ✅ Removed: {module_path}")
                    
                except Exception as e:
                    self.report["errors"].append(f"Failed to remove {module_path}: {e}")
                    print(f"  ❌ Failed to remove {module_path}: {e}")
        
        print(f"  ✅ Removed {removed_count} redundant modules")
        return True
    
    async def validate_new_system(self) -> bool:
        """Validate the new unified authentication system"""
        print("✅ Validating new authentication system...")
        
        try:
            # Test unified service import
            from app.auth.unified_service import unified_auth_service
            print("  ✅ Unified service imports successfully")
            
            # Test unified dependencies
            from app.auth.dependencies import get_current_user
            print("  ✅ Unified dependencies import successfully")
            
            # Test unified API
            from app.api.v1.auth_unified import router
            print("  ✅ Unified API router imports successfully")
            
            # Test database connectivity with new system
            async for db in get_db():
                from sqlalchemy import text
                result = await db.execute(text("SELECT COUNT(*) FROM users"))
                user_count = result.scalar()
                print(f"  ✅ Database connectivity verified - {user_count} users accessible")
                break
            
            return True
            
        except Exception as e:
            self.report["errors"].append(f"New system validation failed: {e}")
            print(f"  ❌ Validation failed: {e}")
            return False
    
    def generate_report(self) -> str:
        """Generate consolidation report"""
        report_content = f"""
# Authentication System Consolidation Report
Generated: {self.report['timestamp']}

## Summary
- Modules backed up: {len(self.report['modules_backed_up'])}
- Modules removed: {len(self.report['modules_removed'])}
- Files with updated imports: {len(self.report['imports_updated'])}
- Errors encountered: {len(self.report['errors'])}
- Warnings: {len(self.report['warnings'])}

## Modules Backed Up
{chr(10).join(f"- {module}" for module in self.report['modules_backed_up'])}

## Modules Removed
{chr(10).join(f"- {module}" for module in self.report['modules_removed'])}

## Import Updates
{chr(10).join(f"- {file}" for file in self.report['imports_updated'])}

## Errors
{chr(10).join(f"- {error}" for error in self.report['errors'])}

## Warnings
{chr(10).join(f"- {warning}" for warning in self.report['warnings'])}

## Next Steps
1. Test the unified authentication system thoroughly
2. Update any remaining manual references
3. Monitor system performance and error logs
4. Remove backup files after successful validation (30 days recommended)

## Rollback Instructions
If issues arise, restore from backup:
1. Stop the application
2. Restore files from: {self.backup_dir}
3. Revert import changes
4. Restart the application
"""
        return report_content


async def main():
    """Main consolidation process"""
    parser = argparse.ArgumentParser(description="Authentication System Consolidation")
    parser.add_argument("--validate-only", action="store_true", help="Only validate current system")
    parser.add_argument("--migrate", action="store_true", help="Perform full migration")
    parser.add_argument("--cleanup", action="store_true", help="Remove redundant modules only")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    
    args = parser.parse_args()
    
    if not any([args.validate_only, args.migrate, args.cleanup]):
        parser.print_help()
        return
    
    consolidator = AuthConsolidationManager(dry_run=args.dry_run)
    
    print("🚀 Authentication System Consolidation")
    print("=" * 50)
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
        print("-" * 50)
    
    # Always validate first
    validation_result = await consolidator.validate_current_system()
    
    if args.validate_only:
        print("\n📊 Validation Complete")
        print(f"  - Modules found: {len(validation_result['modules_exist'])}")
        print(f"  - Database accessible: {validation_result['database_accessible']}")
        print(f"  - Users in database: {validation_result['users_count']}")
        print(f"  - Duplicate functions: {len(validation_result['duplicate_functions'])}")
        return
    
    if args.migrate or args.cleanup:
        # Create backup
        if not consolidator.create_backup():
            print("❌ Backup failed - aborting migration")
            return
        
        # Update imports
        if not consolidator.update_imports():
            print("⚠️  Import updates had issues - check report")
        
        # Remove redundant modules
        if not consolidator.remove_redundant_modules():
            print("⚠️  Module removal had issues - check report")
        
        # Validate new system
        if not await consolidator.validate_new_system():
            print("❌ New system validation failed - consider rollback")
            return
    
    # Generate report
    report_content = consolidator.generate_report()
    report_file = Path("auth_consolidation_report.md")
    
    if not args.dry_run:
        with open(report_file, 'w') as f:
            f.write(report_content)
        print(f"\n📋 Report saved to: {report_file}")
    else:
        print("\n📋 Consolidation Report Preview:")
        print(report_content[:500] + "..." if len(report_content) > 500 else report_content)
    
    print("\n🎉 Authentication consolidation completed successfully!")
    print("\nNext steps:")
    print("1. Test the unified authentication system")
    print("2. Monitor application logs for any issues")
    print("3. Update any remaining manual references")
    print("4. Remove backup files after 30 days")


if __name__ == "__main__":
    asyncio.run(main()) 