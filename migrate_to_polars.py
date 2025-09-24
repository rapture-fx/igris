#!/usr/bin/env python3
"""
Automated Pandas → Polars Migration Script for Schlep-engine
===========================================================

Safely migrates pandas operations to Polars with backward compatibility
and performance monitoring. Based on audit results showing 5.45x potential speedup.
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

        # Priority files based on audit results (CPU bottlenecks)
        self.priority_files = [
            "apps/api/app/api/v1/data_quality.py",
            "apps/api/app/services/distributed_processor.py",
            "apps/api/app/services/data_connectors.py",
            "apps/api/app/services/multimodal_processor.py",
            "apps/api/app/tasks/ai_processing_tasks.py"
        ]

        # Migration patterns based on audit results
        self.migration_patterns = [
            # CSV Reading (72.8% CPU impact - highest priority)
            {
                'pattern': r'pd\.read_csv\(([^)]+)\)',
                'polars_replacement': 'pl.read_csv(\\1)',
                'hybrid_replacement': '''(pl.read_csv(\\1) if USE_POLARS else pd.read_csv(\\1))''',
                'performance_gain': '6.22x',
                'description': 'CSV reading optimization',
                'priority': 1
            },
            # DataFrame creation
            {
                'pattern': r'pd\.DataFrame\(([^)]+)\)',
                'polars_replacement': 'pl.DataFrame(\\1)',
                'hybrid_replacement': '''(pl.DataFrame(\\1) if USE_POLARS else pd.DataFrame(\\1))''',
                'performance_gain': '2.0x',
                'description': 'DataFrame creation',
                'priority': 3
            },
            # Groupby operations (14.4% CPU impact)
            {
                'pattern': r'\.groupby\(([^)]+)\)\.agg\(\{([^}]+)\}\)',
                'polars_replacement': '.group_by(\\1).agg([\\2_POLARS_FORMAT])',
                'performance_gain': '6.36x',
                'description': 'Groupby aggregation optimization',
                'priority': 2,
                'needs_manual_review': True
            },
            # fillna operations
            {
                'pattern': r'\.fillna\(([^)]+)\)',
                'polars_replacement': '.fill_null(\\1)',
                'performance_gain': '2.6x',
                'description': 'Fill null values optimization',
                'priority': 4
            },
            # drop_duplicates
            {
                'pattern': r'\.drop_duplicates\(\)',
                'polars_replacement': '.unique()',
                'performance_gain': '1.8x',
                'description': 'Drop duplicates optimization',
                'priority': 5
            }
        ]

    def create_backup(self):
        """Create backup of files before migration"""
        print(f"📁 Creating backup in {self.backup_dir}")
        self.backup_dir.mkdir(exist_ok=True)

        for file_path in self.priority_files:
            source = self.project_root / file_path
            if source.exists():
                relative_path = source.relative_to(self.project_root)
                backup_file = self.backup_dir / relative_path
                backup_file.parent.mkdir(parents=True, exist_ok=True)
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
                'estimated_performance_gain': 1.0,
                'complexity_score': 0
            }

            # Find pandas imports
            pandas_patterns = [
                r'import pandas as pd',
                r'from pandas import',
                r'import pandas'
            ]

            for pattern in pandas_patterns:
                if re.search(pattern, content):
                    analysis['pandas_imports'].append(pattern)

            # Find operations and calculate impact
            impact_operations = {
                r'pd\.read_csv': {'gain': 6.22, 'weight': 10, 'description': 'CSV reading'},
                r'\.groupby': {'gain': 6.36, 'weight': 8, 'description': 'Groupby operations'},
                r'\.fillna': {'gain': 2.6, 'weight': 3, 'description': 'Fill nulls'},
                r'pd\.DataFrame': {'gain': 2.0, 'weight': 2, 'description': 'DataFrame creation'},
                r'\.merge': {'gain': 1.8, 'weight': 4, 'description': 'Merge operations'},
                r'\.drop_duplicates': {'gain': 1.8, 'weight': 2, 'description': 'Drop duplicates'}
            }

            total_impact = 0
            for op_pattern, info in impact_operations.items():
                matches = len(re.findall(op_pattern, content))
                if matches > 0:
                    impact = matches * info['weight']
                    total_impact += impact
                    analysis['pandas_operations'].append({
                        'operation': op_pattern,
                        'count': matches,
                        'impact_score': impact,
                        'expected_gain': info['gain'],
                        'description': info['description'],
                        'lines': self._find_line_numbers(content, op_pattern)
                    })

            # Calculate overall performance gain estimate
            if analysis['pandas_operations']:
                weighted_gains = [(op['expected_gain'] * op['impact_score'])
                                for op in analysis['pandas_operations']]
                total_weights = sum(op['impact_score'] for op in analysis['pandas_operations'])
                analysis['estimated_performance_gain'] = sum(weighted_gains) / total_weights if total_weights > 0 else 1.0

            analysis['complexity_score'] = total_impact
            return analysis

        except Exception as e:
            return {'error': f'Analysis failed: {e}'}

    def _find_line_numbers(self, content: str, pattern: str) -> List[int]:
        """Find line numbers where pattern appears"""
        lines = content.split('\n')
        return [i + 1 for i, line in enumerate(lines) if re.search(pattern, line)]

    def generate_hybrid_compatibility_code(self) -> str:
        """Generate hybrid compatibility wrapper code"""
        return '''
# Hybrid Pandas/Polars compatibility layer
import os
from typing import Union

# Configuration
USE_POLARS = os.getenv('USE_POLARS', 'true').lower() == 'true'

try:
    import polars as pl
    POLARS_AVAILABLE = True
except ImportError:
    POLARS_AVAILABLE = False
    USE_POLARS = False

import pandas as pd

def get_optimal_engine():
    """Get the optimal DataFrame engine based on availability and configuration"""
    return pl if (USE_POLARS and POLARS_AVAILABLE) else pd

def safe_read_csv(file_path: str, **kwargs):
    """Safe CSV reader that falls back gracefully"""
    if USE_POLARS and POLARS_AVAILABLE:
        try:
            return pl.read_csv(file_path, **kwargs)
        except Exception as e:
            print(f"Polars failed, falling back to pandas: {e}")
            return pd.read_csv(file_path, **kwargs)
    else:
        return pd.read_csv(file_path, **kwargs)

def safe_create_dataframe(data, **kwargs):
    """Safe DataFrame creation with fallback"""
    if USE_POLARS and POLARS_AVAILABLE:
        try:
            return pl.DataFrame(data, **kwargs)
        except Exception:
            return pd.DataFrame(data, **kwargs)
    else:
        return pd.DataFrame(data, **kwargs)
'''

    def create_migration_preview(self, file_path: Path) -> Dict[str, Any]:
        """Create a preview of what the migration would look like"""
        if not file_path.exists():
            return {'error': 'File not found'}

        original_content = file_path.read_text()
        preview_content = original_content
        changes = []

        # Sort patterns by priority
        sorted_patterns = sorted(self.migration_patterns, key=lambda x: x['priority'])

        for pattern_info in sorted_patterns:
            pattern = pattern_info['pattern']
            matches = re.findall(pattern, preview_content)

            if matches:
                if pattern_info.get('needs_manual_review'):
                    changes.append(f"⚠️  {pattern_info['description']}: {len(matches)} occurrences need manual review")
                else:
                    polars_replacement = pattern_info.get('polars_replacement', 'MANUAL_MIGRATION_NEEDED')
                    preview_content = re.sub(pattern, polars_replacement, preview_content)
                    changes.append(f"✅ {pattern_info['description']}: {len(matches)} occurrences (Expected gain: {pattern_info['performance_gain']})")

        return {
            'file_path': str(file_path),
            'changes': changes,
            'preview_snippet': preview_content[:1000] + '...' if len(preview_content) > 1000 else preview_content,
            'needs_manual_review': any('needs_manual_review' in p for p in sorted_patterns if re.search(p['pattern'], original_content))
        }

    def apply_safe_migration(self, file_path: Path, dry_run: bool = True) -> Dict[str, Any]:
        """Apply migration with safety checks and fallback compatibility"""
        original_content = file_path.read_text()
        modified_content = original_content
        changes_applied = []

        # Add hybrid compatibility imports at the top
        if 'import pandas as pd' in modified_content and 'USE_POLARS' not in modified_content:
            # Find where to insert the compatibility code
            lines = modified_content.split('\n')
            insert_idx = 0

            # Find the last import line
            for i, line in enumerate(lines):
                if line.strip().startswith(('import ', 'from ')):
                    insert_idx = i + 1

            compatibility_code = self.generate_hybrid_compatibility_code()
            lines.insert(insert_idx, compatibility_code)
            modified_content = '\n'.join(lines)
            changes_applied.append('Added hybrid Pandas/Polars compatibility layer')

        # Apply safe migrations (excluding ones that need manual review)
        safe_patterns = [p for p in self.migration_patterns if not p.get('needs_manual_review')]

        for pattern_info in sorted(safe_patterns, key=lambda x: x['priority']):
            pattern = pattern_info['pattern']
            replacement = pattern_info.get('polars_replacement')

            if replacement:
                matches = re.findall(pattern, modified_content)
                if matches:
                    # Use hybrid replacement if available, otherwise pure Polars
                    actual_replacement = pattern_info.get('hybrid_replacement', replacement)
                    modified_content = re.sub(pattern, actual_replacement, modified_content)
                    changes_applied.append(f"{pattern_info['description']}: {len(matches)} occurrences (gain: {pattern_info['performance_gain']})")

        result = {
            'file_path': str(file_path),
            'changes_applied': changes_applied,
            'success': len(changes_applied) > 0,
            'dry_run': dry_run,
            'backup_created': not dry_run
        }

        if not dry_run and changes_applied:
            # Create individual file backup
            backup_file = file_path.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.py')
            shutil.copy2(file_path, backup_file)

            # Write migrated content
            file_path.write_text(modified_content)
            result['status'] = 'migrated'
            result['backup_file'] = str(backup_file)
        elif changes_applied:
            result['status'] = 'ready_for_migration'
            result['preview'] = modified_content[:800] + '...'

        return result

    def run_comprehensive_migration(self, dry_run: bool = True) -> Dict[str, Any]:
        """Run the complete migration process with comprehensive reporting"""
        print("🚀 Schlep-engine Pandas → Polars Migration")
        print("Based on audit results: 5.45x average speedup potential")
        print("=" * 65)

        # Step 1: Analyze all files
        print("📊 Analyzing codebase...")
        analysis_results = []

        for file_path_str in self.priority_files:
            file_path = self.project_root / file_path_str
            if file_path.exists():
                analysis = self.analyze_pandas_usage(file_path)
                if 'error' not in analysis and analysis['pandas_operations']:
                    analysis_results.append(analysis)

        # Sort by performance impact
        analysis_results.sort(key=lambda x: x['complexity_score'], reverse=True)

        print(f"   Found {len(analysis_results)} files with pandas usage")
        if analysis_results:
            total_estimated_gain = sum(a['estimated_performance_gain'] for a in analysis_results) / len(analysis_results)
            print(f"   Estimated average performance gain: {total_estimated_gain:.2f}x")

        # Step 2: Show migration plan
        print(f"\n📋 Migration Plan (Priority Order):")
        for i, analysis in enumerate(analysis_results[:5], 1):  # Top 5
            print(f"   {i}. {analysis['file_path']}")
            print(f"      Impact score: {analysis['complexity_score']}")
            print(f"      Estimated gain: {analysis['estimated_performance_gain']:.2f}x")
            print(f"      Operations: {len(analysis['pandas_operations'])}")

        # Step 3: Apply migrations
        migration_results = []
        print(f"\n🔄 {'Previewing' if dry_run else 'Applying'} migrations...")

        if not dry_run:
            self.create_backup()

        for analysis in analysis_results:
            file_path = Path(analysis['file_path'])
            print(f"\n   Processing: {file_path.name}")

            result = self.apply_safe_migration(file_path, dry_run)
            migration_results.append(result)

            if result['changes_applied']:
                print(f"      ✅ {len(result['changes_applied'])} changes")
                for change in result['changes_applied'][:3]:  # Show first 3
                    print(f"         - {change}")
                if len(result['changes_applied']) > 3:
                    print(f"         ... and {len(result['changes_applied']) - 3} more")
            else:
                print(f"      ℹ️  No applicable changes")

        # Step 4: Generate comprehensive report
        report = {
            'migration_summary': {
                'total_files_analyzed': len(analysis_results),
                'files_with_changes': len([r for r in migration_results if r['changes_applied']]),
                'estimated_performance_gain': total_estimated_gain if analysis_results else 1.0,
                'dry_run': dry_run
            },
            'file_analyses': analysis_results,
            'migration_results': migration_results,
            'next_steps': self._generate_actionable_steps(migration_results, dry_run),
            'performance_testing_plan': self._generate_testing_plan()
        }

        # Save report
        report_file = self.project_root / f"polars_migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"\n📄 Detailed report saved: {report_file}")

        # Final summary
        print(f"\n🎉 Migration {'Analysis' if dry_run else 'Execution'} Complete!")
        if report['migration_summary']['files_with_changes'] > 0:
            print(f"📈 Expected Performance Improvement: {total_estimated_gain:.2f}x")
        print(f"📁 Backup location: {self.backup_dir}")

        return report

    def _generate_actionable_steps(self, migration_results: List[Dict], dry_run: bool) -> List[str]:
        """Generate specific actionable next steps"""
        steps = []

        if dry_run:
            files_ready = len([r for r in migration_results if r['changes_applied']])
            if files_ready > 0:
                steps.append(f"🔄 Run with --apply to migrate {files_ready} files")

        steps.extend([
            "📦 Install Polars: pip install polars",
            "🧪 Run existing tests to verify compatibility",
            "🎛️  Set USE_POLARS=true environment variable to enable Polars",
            "📊 Use benchmark scripts to measure actual performance gains",
            "🔍 Monitor application performance after migration",
        ])

        if any(r.get('needs_manual_review') for r in migration_results):
            steps.append("⚠️  Review files marked for manual migration")

        return steps

    def _generate_testing_plan(self) -> Dict[str, Any]:
        """Generate performance testing plan"""
        return {
            'immediate_tests': [
                'Run existing unit tests',
                'Test CSV reading with large files',
                'Verify groupby operations work correctly',
                'Check data quality pipeline functionality'
            ],
            'performance_benchmarks': [
                'Compare CSV reading times (pandas vs polars)',
                'Measure aggregation performance',
                'Test memory usage with large datasets',
                'End-to-end pipeline performance'
            ],
            'monitoring_setup': [
                'Add performance metrics collection',
                'Set up alerts for performance regressions',
                'Track memory usage patterns',
                'Monitor error rates during transition'
            ]
        }

def main():
    """Main execution function"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Migrate Schlep-engine from Pandas to Polars',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python migrate_to_polars.py                    # Dry run analysis
  python migrate_to_polars.py --apply           # Apply migrations
  python migrate_to_polars.py --project-root /path/to/project
        '''
    )

    parser.add_argument('--dry-run', action='store_true', default=True,
                        help='Run in analysis mode only (default)')
    parser.add_argument('--apply', action='store_true',
                        help='Apply migrations to files')
    parser.add_argument('--project-root', default='.',
                        help='Project root directory (default: current directory)')

    args = parser.parse_args()

    # Determine execution mode
    dry_run = not args.apply

    if not dry_run:
        print("⚠️  This will modify your Python files.")
        response = input("   Create backups and apply migrations? (y/N): ")
        if response.lower() != 'y':
            print("Migration cancelled.")
            return

    # Execute migration
    migrator = PandasToPolarssMigrator(args.project_root)
    results = migrator.run_comprehensive_migration(dry_run=dry_run)

    # Show next steps
    print(f"\n🎯 Next Steps:")
    for i, step in enumerate(results['next_steps'][:5], 1):
        print(f"   {i}. {step}")

    if dry_run:
        print(f"\n💡 To apply changes: python migrate_to_polars.py --apply")

    return results['migration_summary']['estimated_performance_gain']

if __name__ == "__main__":
    main()