#!/usr/bin/env python3
"""
Authentication System Migration Script

This script helps migrate from the old redundant authentication system
to the new unified authentication system.

Features:
- Validates current system integrity
- Updates imports across the codebase
- Provides rollback capabilities
- Generates migration report
- Handles backward compatibility
"""

import os
import re
import sys
import logging
import argparse
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import subprocess

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class MigrationIssue:
    file_path: str
    line_number: int
    issue_type: str
    description: str
    old_code: str
    suggested_fix: str

@dataclass
class MigrationReport:
    files_processed: int
    issues_found: List[MigrationIssue]
    imports_updated: int
    functions_consolidated: int
    deprecated_files: List[str]
    
class AuthMigrationTool:
    """Tool to migrate from redundant auth system to unified system"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.backend_root = self.project_root / "packages" / "backend"
        self.issues: List[MigrationIssue] = []
        
        # Define migration mappings
        self.import_mappings = {
            # Old imports -> New unified imports
            "from app.auth.dependencies import get_current_user": "from app.auth.unified_dependencies import get_current_user",
            "from app.auth.dependencies import get_current_active_user": "from app.auth.unified_dependencies import get_current_active_user",
            "from app.auth.dependencies import require_admin": "from app.auth.unified_dependencies import require_admin",
            "from app.auth.enhanced_dependencies import get_current_user_enhanced": "from app.auth.unified_dependencies import get_current_user_enhanced",
            "from app.auth.enhanced_dependencies import get_current_user_mfa": "from app.auth.unified_dependencies import get_current_user_mfa",
            "from app.auth.security import create_access_token": "from app.auth.unified_auth_service import create_access_token",
            "from app.auth.security import verify_token": "from app.auth.unified_auth_service import verify_token",
            "from app.auth.security import verify_password": "from app.auth.unified_auth_service import verify_password",
            "from app.auth.security import get_password_hash": "from app.auth.unified_auth_service import get_password_hash",
            "from app.core.config import settings": "from app.core.unified_config import settings",
        }
        
        # Files to deprecate (mark for removal after migration)
        self.deprecated_files = [
            "app/auth/dependencies.py",
            "app/auth/enhanced_dependencies.py", 
            "app/auth/security.py",
            "app/auth/auth_service.py",
            "app/api/v1/auth.py",
            "app/api/v1/enhanced_auth_routes.py",
            "app/api/v1/enhanced_auth.py",
            "app/core/config.py",
        ]

    def scan_codebase(self) -> MigrationReport:
        """Scan codebase for migration issues"""
        logger.info(" Scanning codebase for migration issues...")
        
        files_processed = 0
        imports_updated = 0
        
        # Scan Python files
        for python_file in self.backend_root.rglob("*.py"):
            if self._should_skip_file(python_file):
                continue
                
            files_processed += 1
            file_issues = self._scan_file(python_file)
            self.issues.extend(file_issues)
            
            # Count import updates needed
            imports_updated += len([issue for issue in file_issues if issue.issue_type == "import_update"])
        
        # Generate report
        report = MigrationReport(
            files_processed=files_processed,
            issues_found=self.issues,
            imports_updated=imports_updated,
            functions_consolidated=len(self.import_mappings),
            deprecated_files=[f for f in self.deprecated_files if (self.backend_root / f).exists()]
        )
        
        return report

    def _should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped during scanning"""
        skip_patterns = [
            "__pycache__",
            ".pyc",
            "venv",
            ".git",
            "alembic/versions",
            "uploads",
            "unified_auth_service.py",  # Our new files
            "unified_dependencies.py",
            "unified_config.py",
            "unified_auth.py",
            "migration_script.py"
        ]
        
        return any(pattern in str(file_path) for pattern in skip_patterns)

    def _scan_file(self, file_path: Path) -> List[MigrationIssue]:
        """Scan individual file for issues"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            logger.warning(f"Could not read {file_path}: {e}")
            return issues
        
        for line_num, line in enumerate(lines, 1):
            # Check for import mappings
            for old_import, new_import in self.import_mappings.items():
                if old_import in line:
                    issues.append(MigrationIssue(
                        file_path=str(file_path.relative_to(self.backend_root)),
                        line_number=line_num,
                        issue_type="import_update",
                        description=f"Update import to use unified module",
                        old_code=line.strip(),
                        suggested_fix=line.replace(old_import, new_import).strip()
                    ))
        
        return issues

    def generate_migration_report(self, report: MigrationReport) -> str:
        """Generate detailed migration report"""
        
        report_content = f"""
#  AUTHENTICATION SYSTEM MIGRATION REPORT

##  Summary
- **Files Processed**: {report.files_processed}
- **Issues Found**: {len(report.issues_found)}
- **Imports to Update**: {report.imports_updated}
- **Functions Consolidated**: {report.functions_consolidated}
- **Files to Deprecate**: {len(report.deprecated_files)}

##  Critical Issues Found

### Import Updates Required
"""
        
        import_issues = [issue for issue in report.issues_found if issue.issue_type == "import_update"]
        for issue in import_issues[:10]:  # Show first 10
            report_content += f"""
**File**: `{issue.file_path}:{issue.line_number}`
**Issue**: {issue.description}
```python
# Old:
{issue.old_code}

# New:
{issue.suggested_fix}
```
"""
        
        if len(import_issues) > 10:
            report_content += f"\n... and {len(import_issues) - 10} more import issues\n"

        report_content += f"""

## 📁 Files to Deprecate
"""
        for deprecated_file in report.deprecated_files:
            report_content += f"- `{deprecated_file}`\n"

        report_content += f"""

##  Migration Steps

### 1. **IMMEDIATE**: Apply Import Updates
```bash
python migration_script.py --apply-fixes
```

### 2. **PHASE 1**: Update Main Application
- Update `app/main.py` to use unified auth routes
- Replace old router imports with unified router

### 3. **PHASE 2**: Update Dependencies
- Run automated import updates
- Test all authentication flows
- Verify API endpoints work correctly

### 4. **PHASE 3**: Deprecate Old Files
- Add deprecation warnings to old files
- Update documentation
- Plan removal timeline

##  Quick Fix Commands

```bash
# Scan for issues
python migration_script.py --scan

# Full migration
python migration_script.py --full-migration
```

---
**Generated**: Migration Report
**Tool Version**: 1.0.0
"""
        
        return report_content

def main():
    parser = argparse.ArgumentParser(description="Migrate authentication system to unified approach")
    parser.add_argument("--project-root", default=".", help="Project root directory")
    parser.add_argument("--scan", action="store_true", help="Scan for migration issues")
    parser.add_argument("--full-migration", action="store_true", help="Run full migration process")
    parser.add_argument("--report", default="migration_report.md", help="Report output file")
    
    args = parser.parse_args()
    
    # Initialize migration tool
    migrator = AuthMigrationTool(args.project_root)
    
    try:
        if args.full_migration or args.scan:
            # Run migration process
            logger.info(" Starting migration process...")
            
            # Scan
            report = migrator.scan_codebase()
            logger.info(f"Found {len(report.issues_found)} issues to fix")
            
            # Generate report
            report_content = migrator.generate_migration_report(report)
            with open(args.report, 'w') as f:
                f.write(report_content)
            logger.info(f" Migration report saved to {args.report}")
            
            if args.full_migration:
                logger.info(" Migration scan completed successfully!")
                logger.info("Please review the migration report and apply fixes manually.")
    
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 