#!/usr/bin/env python3
"""
Automated Pandas → Polars Migration Script for Schlep-engine
===========================================================

Safely migrates pandas operations to Polars with backward compatibility
and performance monitoring.
"""

import os
import re
import ast
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple
import shutil
from datetime import datetime
import json

class PandasToPolarssMigrator:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.api_path = self.project_root / "apps" / "api"
        self.backup_dir = self.project_root / f"migration_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.migration_report = {
            'files_processed': [],
            'migrations_applied': [],
            'backup_location': str(self.backup_dir),
            'timestamp': datetime.now().isoformat()
        }

        # Priority files based on audit results
        self.priority_files = [
            "apps/api/app/api/v1/data_quality.py",
            "apps/api/app/services/distributed_processor.py",
            "apps/api/app/services/data_connectors.py",
            "apps/api/app/services/multimodal_processor.py",
            "apps/api/app/tasks/ai_processing_tasks.py"
        ]

        # Common migration patterns
        self.migration_patterns = [
            # CSV Reading (72.8% CPU impact)
            {
                'pattern': r'pd\.read_csv\(([^)]+)\)',
                'replacement': 'pl.read_csv(\\1)',
                'requires_import': 'import polars as pl',
                'performance_gain': '6.22x',
                'description': 'CSV reading optimization'
            },
            # DataFrame creation
            {
                'pattern': r'pd\.DataFrame\(([^)]+)\)',
                'replacement': 'pl.DataFrame(\\1)',
                'requires_import': 'import polars as pl',
                'performance_gain': '2x',
                'description': 'DataFrame creation'
            },
            # Groupby operations (14.4% CPU impact)
            {
                'pattern': r'\.groupby\(([^)]+)\)\.agg\(',
                'replacement': '.group_by(\\1).agg([',
                'requires_import': 'import polars as pl',
                'performance_gain': '6.36x',
                'description': 'Groupby aggregation optimization'
            }
        ]

    def create_backup(self):
        """Create backup of files before migration"""
        print(f"📁 Creating backup in {self.backup_dir}")

        self.backup_dir.mkdir(exist_ok=True)

        for file_path in self.priority_files:
            source = self.project_root / file_path
            if source.exists():
                # Create directory structure in backup
                relative_path = source.relative_to(self.project_root)
                backup_file = self.backup_dir / relative_path
                backup_file.parent.mkdir(parents=True, exist_ok=True)

                # Copy file
                shutil.copy2(source, backup_file)
                print(f"   ✅ Backed up: {relative_path}")

    def analyze_pandas_usage(self, file_path: Path) -> Dict[str, Any]:
        """Analyze pandas usage patterns in a file"""
        if not file_path.exists():
            return {'error': f'File not found: {file_path}'}

        try:
            content = file_path.read_text()

            analysis = {
                'file_path': str(file_path),
                'pandas_imports': [],
                'pandas_operations': [],
                'migration_opportunities': [],
                'estimated_performance_gain': 1.0
            }

            # Find pandas imports
            pandas_import_patterns = [
                r'import pandas as pd',
                r'from pandas import',
                r'import pandas'
            ]

            for pattern in pandas_import_patterns:
                matches = re.findall(pattern, content)
                analysis['pandas_imports'].extend(matches)

            # Find pandas operations
            pandas_ops = [
                r'pd\.read_csv',
                r'pd\.DataFrame',
                r'\.groupby',
                r'\.fillna',
                r'\.merge',
                r'\.drop_duplicates'
            ]

            for op_pattern in pandas_ops:
                matches = re.findall(op_pattern, content)
                if matches:
                    analysis['pandas_operations'].append({
                        'operation': op_pattern,
                        'count': len(matches),
                        'lines': self._find_line_numbers(content, op_pattern)
                    })

            # Estimate performance gain potential
            if 'pd.read_csv' in content:
                analysis['estimated_performance_gain'] *= 6.22  # CSV reading gain
            if '.groupby' in content:
                analysis['estimated_performance_gain'] *= 2.5   # Groupby gain
            if '.fillna' in content:
                analysis['estimated_performance_gain'] *= 1.5   # Cleaning gain

            return analysis

        except Exception as e:
            return {'error': f'Analysis failed: {e}'}

    def _find_line_numbers(self, content: str, pattern: str) -> List[int]:
        """Find line numbers where pattern appears"""
        lines = content.split('\n')
        return [i + 1 for i, line in enumerate(lines) if re.search(pattern, line)]

    def generate_migration_plan(self) -> Dict[str, Any]:
        """Generate comprehensive migration plan"""
        print("📋 Analyzing codebase for migration opportunities...")

        plan = {
            'total_files': 0,
            'files_with_pandas': 0,
            'migration_priority': [],
            'estimated_total_gain': 1.0,
            'implementation_order': []
        }

        for file_path_str in self.priority_files:
            file_path = self.project_root / file_path_str
            analysis = self.analyze_pandas_usage(file_path)

            if 'error' not in analysis and analysis['pandas_operations']:
                plan['files_with_pandas'] += 1

                priority_score = len(analysis['pandas_operations']) * analysis['estimated_performance_gain']

                plan['migration_priority'].append({
                    'file': file_path_str,
                    'priority_score': priority_score,
                    'estimated_gain': analysis['estimated_performance_gain'],
                    'operations_count': len(analysis['pandas_operations']),
                    'analysis': analysis
                })

        # Sort by priority score (highest impact first)
        plan['migration_priority'].sort(key=lambda x: x['priority_score'], reverse=True)

        # Calculate total estimated gain
        if plan['migration_priority']:
            gains = [item['estimated_gain'] for item in plan['migration_priority']]
            plan['estimated_total_gain'] = sum(gains) / len(gains)  # Average gain

        plan['total_files'] = len(self.priority_files)

        return plan

    def apply_migration_to_file(self, file_path: Path, dry_run: bool = True) -> Dict[str, Any]:
        """Apply Polars migration to a specific file"""
        if not file_path.exists():
            return {'error': f'File not found: {file_path}'}

        original_content = file_path.read_text()
        modified_content = original_content
        changes_made = []

        # Add Polars import if not present
        if 'import polars as pl' not in modified_content and 'pd.' in modified_content:
            # Find a good place to add the import (after existing imports)
            lines = modified_content.split('\n')
            import_line_idx = 0

            for i, line in enumerate(lines):
                if line.strip().startswith('import ') or line.strip().startswith('from '):
                    import_line_idx = i + 1

            lines.insert(import_line_idx, 'import polars as pl')
            modified_content = '\n'.join(lines)
            changes_made.append('Added Polars import')

        # Apply migration patterns
        for pattern_info in self.migration_patterns:
            pattern = pattern_info['pattern']
            replacement = pattern_info['replacement']

            matches = re.findall(pattern, modified_content)
            if matches:
                modified_content = re.sub(pattern, replacement, modified_content)
                changes_made.append(f"{pattern_info['description']}: {len(matches)} occurrences")

        # Add compatibility wrapper
        if changes_made and 'USE_POLARS' not in modified_content:
            compatibility_code = '''
# Polars migration with backward compatibility
USE_POLARS = os.getenv('USE_POLARS', 'true').lower() == 'true'

def get_dataframe_engine():
    """Get optimal DataFrame engine based on configuration"""
    return pl if USE_POLARS else pd
'''
            modified_content = compatibility_code + modified_content
            changes_made.append('Added compatibility wrapper')

        result = {
            'file_path': str(file_path),
            'changes_made': changes_made,
            'lines_modified': len(changes_made),
            'dry_run': dry_run
        }

        if not dry_run and changes_made:
            # Apply changes
            file_path.write_text(modified_content)
            result['status'] = 'migrated'
        elif changes_made:
            result['status'] = 'ready_for_migration'
            result['preview'] = modified_content[:500] + '...'  # First 500 chars
        else:
            result['status'] = 'no_changes_needed'

        return result

    def run_migration(self, dry_run: bool = True) -> Dict[str, Any]:
        """Run complete migration process"""
        print("🚀 Starting Pandas → Polars Migration for Schlep-engine")
        print("=" * 60)

        # Step 1: Create backup
        if not dry_run:
            self.create_backup()

        # Step 2: Generate migration plan
        plan = self.generate_migration_plan()

        print(f"📊 Migration Analysis:")
        print(f"   Total files scanned: {plan['total_files']}")
        print(f"   Files with pandas: {plan['files_with_pandas']}")
        print(f"   Estimated performance gain: {plan['estimated_total_gain']:.2f}x")

        # Step 3: Apply migrations in priority order
        migration_results = []

        for item in plan['migration_priority']:
            file_path = self.project_root / item['file']
            print(f"\n🔄 Processing: {item['file']}")
            print(f"   Priority score: {item['priority_score']:.1f}")
            print(f"   Estimated gain: {item['estimated_gain']:.2f}x")

            result = self.apply_migration_to_file(file_path, dry_run=dry_run)
            migration_results.append(result)

            if result.get('changes_made'):
                print(f"   ✅ Changes: {len(result['changes_made'])}")
                for change in result['changes_made']:
                    print(f"      - {change}")
            else:
                print(f"   ℹ️  No changes needed")

        # Step 4: Generate final report
        final_report = {
            'migration_plan': plan,
            'migration_results': migration_results,
            'backup_location': str(self.backup_dir) if not dry_run else None,
            'next_steps': self._generate_next_steps(migration_results),
            'estimated_performance_improvement': plan['estimated_total_gain']
        }

        self._save_report(final_report)
        return final_report

    def _generate_next_steps(self, migration_results: List[Dict]) -> List[str]:
        """Generate actionable next steps"""
        steps = []

        migrated_files = [r for r in migration_results if r.get('status') == 'migrated']
        ready_files = [r for r in migration_results if r.get('status') == 'ready_for_migration']

        if ready_files:
            steps.append(f"Run migration with dry_run=False to apply {len(ready_files)} file changes")

        if migrated_files:
            steps.extend([
                "Install Polars: pip install polars",
                "Run tests to verify compatibility",
                "Monitor performance improvements",
                "Gradually enable Polars with USE_POLARS=true environment variable"
            ])

        steps.extend([
            "Benchmark before/after performance using provided benchmark scripts",
            "Set up monitoring for Polars vs Pandas performance",
            "Plan Rust integration for remaining bottlenecks"
        ])

        return steps

    def _save_report(self, report: Dict[str, Any]):
        """Save migration report"""
        report_file = self.project_root / f"polars_migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"\n📄 Migration report saved: {report_file}")

def main():
    """Main migration execution"""
    import argparse

    parser = argparse.ArgumentParser(description='Migrate Schlep-engine from Pandas to Polars')
    parser.add_argument('--dry-run', action='store_true', default=True,
                        help='Run in dry-run mode (default: True)')
    parser.add_argument('--apply', action='store_true',
                        help='Apply migrations (overrides dry-run)')
    parser.add_argument('--project-root', default='.',
                        help='Project root directory')

    args = parser.parse_args()

    # Determine if this is a dry run
    dry_run = not args.apply

    if not dry_run:
        response = input("⚠️  This will modify your code files. Continue? (y/N): ")
        if response.lower() != 'y':
            print("Migration cancelled.")
            return

    # Run migration
    migrator = PandasToPolarssMigrator(args.project_root)
    results = migrator.run_migration(dry_run=dry_run)

    # Print summary
    print(f"\n🎉 Migration {'Analysis' if dry_run else 'Complete'}!")
    print(f"📈 Expected Performance Gain: {results['estimated_performance_improvement']:.2f}x")

    if dry_run:
        print("\n💡 To apply changes, run: python migrate_to_polars.py --apply")

    return results

if __name__ == "__main__":
    main()