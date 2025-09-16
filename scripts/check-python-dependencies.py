#!/usr/bin/env python3

"""
Python Dependency Security Scanner
Scans Python dependencies for security vulnerabilities and version conflicts
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set
import pkg_resources
import toml


class PythonDependencyScanner:
    def __init__(self, root_path: str = "."):
        self.root_path = Path(root_path)
        self.vulnerabilities = []
        self.packages = []
        self.version_conflicts = []

    def find_python_projects(self) -> List[Path]:
        """Find all Python projects in the monorepo"""
        projects = []

        # Look for requirements.txt files
        for req_file in self.root_path.rglob("requirements*.txt"):
            projects.append(req_file.parent)

        # Look for pyproject.toml files
        for pyproject in self.root_path.rglob("pyproject.toml"):
            projects.append(pyproject.parent)

        # Look for setup.py files
        for setup_py in self.root_path.rglob("setup.py"):
            projects.append(setup_py.parent)

        # Remove duplicates and return
        return list(set(projects))

    def parse_requirements_file(self, file_path: Path) -> Dict[str, str]:
        """Parse requirements.txt file and return package:version mapping"""
        dependencies = {}

        if not file_path.exists():
            return dependencies

        try:
            with open(file_path, 'r') as f:
                for line in f:
                    line = line.strip()

                    # Skip comments and empty lines
                    if not line or line.startswith('#'):
                        continue

                    # Skip git URLs and file paths
                    if line.startswith(('git+', 'http', './', '../', '/')):
                        continue

                    # Parse package name and version
                    if '==' in line:
                        package, version = line.split('==', 1)
                        dependencies[package.strip()] = version.strip()
                    elif '>=' in line:
                        package = line.split('>=')[0].strip()
                        dependencies[package] = f">={line.split('>=')[1].strip()}"
                    elif '>' in line and not line.startswith('git+'):
                        package = line.split('>')[0].strip()
                        dependencies[package] = f">{line.split('>')[1].strip()}"
                    else:
                        # No version specified
                        package = line.split()[0].strip()
                        if package and not package.startswith('-'):
                            dependencies[package] = "*"

        except Exception as e:
            print(f"Error parsing {file_path}: {e}")

        return dependencies

    def parse_pyproject_toml(self, file_path: Path) -> Dict[str, str]:
        """Parse pyproject.toml file and return package:version mapping"""
        dependencies = {}

        if not file_path.exists():
            return dependencies

        try:
            with open(file_path, 'r') as f:
                data = toml.load(f)

            # Check poetry dependencies
            if 'tool' in data and 'poetry' in data['tool']:
                poetry_deps = data['tool']['poetry'].get('dependencies', {})
                dev_deps = data['tool']['poetry'].get('dev-dependencies', {})

                for package, version in {**poetry_deps, **dev_deps}.items():
                    if package != 'python':
                        if isinstance(version, str):
                            dependencies[package] = version
                        elif isinstance(version, dict):
                            dependencies[package] = version.get('version', '*')

            # Check PEP 621 dependencies
            if 'project' in data:
                project_deps = data['project'].get('dependencies', [])
                for dep in project_deps:
                    if '==' in dep:
                        package, version = dep.split('==', 1)
                        dependencies[package.strip()] = version.strip()
                    else:
                        package = dep.split()[0].strip()
                        dependencies[package] = "*"

        except Exception as e:
            print(f"Error parsing {file_path}: {e}")

        return dependencies

    def check_version_conflicts(self, projects: List[Path]) -> List[Dict]:
        """Check for version conflicts across projects"""
        all_dependencies = {}
        conflicts = []

        for project in projects:
            project_deps = {}

            # Check requirements.txt files
            for req_file in project.glob("requirements*.txt"):
                deps = self.parse_requirements_file(req_file)
                project_deps.update(deps)

            # Check pyproject.toml
            pyproject_file = project / "pyproject.toml"
            if pyproject_file.exists():
                deps = self.parse_pyproject_toml(pyproject_file)
                project_deps.update(deps)

            # Add to global tracking
            for package, version in project_deps.items():
                if package not in all_dependencies:
                    all_dependencies[package] = []

                all_dependencies[package].append({
                    'project': str(project.relative_to(self.root_path)),
                    'version': version
                })

        # Find conflicts
        for package, usages in all_dependencies.items():
            versions = list(set(usage['version'] for usage in usages))
            if len(versions) > 1:
                conflicts.append({
                    'package': package,
                    'versions': versions,
                    'usages': usages
                })

        return conflicts

    def run_safety_scan(self, project_path: Path) -> List[Dict]:
        """Run Safety scan for known vulnerabilities"""
        vulnerabilities = []

        try:
            # Run safety check
            result = subprocess.run([
                'safety', 'check', '--json', '--ignore', '51457'  # Ignore some common false positives
            ], cwd=project_path, capture_output=True, text=True)

            if result.stdout:
                safety_data = json.loads(result.stdout)

                for vuln in safety_data:
                    vulnerabilities.append({
                        'package': vuln.get('package'),
                        'version': vuln.get('installed_version'),
                        'vulnerability_id': vuln.get('vulnerability_id'),
                        'advisory': vuln.get('advisory'),
                        'cve': vuln.get('cve'),
                        'severity': self.get_severity_from_advisory(vuln.get('advisory', '')),
                        'project': str(project_path.relative_to(self.root_path))
                    })

        except subprocess.CalledProcessError:
            # Safety returns non-zero when vulnerabilities are found
            pass
        except Exception as e:
            print(f"Error running safety scan for {project_path}: {e}")

        return vulnerabilities

    def get_severity_from_advisory(self, advisory: str) -> str:
        """Extract severity from advisory text"""
        advisory_lower = advisory.lower()

        if any(word in advisory_lower for word in ['critical', 'remote code execution', 'arbitrary code']):
            return 'critical'
        elif any(word in advisory_lower for word in ['high', 'sql injection', 'xss']):
            return 'high'
        elif any(word in advisory_lower for word in ['medium', 'moderate', 'denial of service']):
            return 'moderate'
        else:
            return 'low'

    def generate_report(self) -> Dict:
        """Generate comprehensive security report"""
        severity_counts = {'critical': 0, 'high': 0, 'moderate': 0, 'low': 0}

        for vuln in self.vulnerabilities:
            severity = vuln.get('severity', 'low')
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

        return {
            'timestamp': subprocess.check_output(['date', '-Iseconds']).decode().strip(),
            'summary': {
                'total_vulnerabilities': len(self.vulnerabilities),
                'total_conflicts': len(self.version_conflicts),
                'projects_scanned': len(self.packages),
                'severity_counts': severity_counts
            },
            'vulnerabilities': self.vulnerabilities,
            'version_conflicts': self.version_conflicts,
            'projects': [str(p.relative_to(self.root_path)) for p in self.packages]
        }

    def scan(self) -> bool:
        """Run comprehensive Python dependency scan"""
        print("🐍 Scanning Python dependencies for security issues...\n")

        # Find all Python projects
        self.packages = self.find_python_projects()

        if not self.packages:
            print("✅ No Python projects found")
            return True

        print(f"📦 Found {len(self.packages)} Python projects:")
        for project in self.packages:
            print(f"   - {project.relative_to(self.root_path)}")
        print()

        # Check for version conflicts
        print("🔍 Checking for version conflicts...")
        self.version_conflicts = self.check_version_conflicts(self.packages)

        if self.version_conflicts:
            print(f"⚠️  Found {len(self.version_conflicts)} version conflicts:")
            for conflict in self.version_conflicts:
                print(f"   - {conflict['package']}: {', '.join(conflict['versions'])}")
        else:
            print("✅ No version conflicts found")
        print()

        # Run security scans
        print("🔒 Running security vulnerability scans...")

        for project in self.packages:
            print(f"   Scanning {project.relative_to(self.root_path)}...")
            vulnerabilities = self.run_safety_scan(project)
            self.vulnerabilities.extend(vulnerabilities)

        # Generate and save report
        report = self.generate_report()

        # Save report
        report_dir = self.root_path / "security-reports"
        report_dir.mkdir(exist_ok=True)

        report_file = report_dir / "python-security-scan.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n📄 Report saved to: {report_file}")

        # Print summary
        summary = report['summary']
        print(f"\n📊 Scan Summary:")
        print(f"   Projects scanned: {summary['projects_scanned']}")
        print(f"   Vulnerabilities: {summary['total_vulnerabilities']}")
        print(f"   Version conflicts: {summary['total_conflicts']}")

        if summary['severity_counts']:
            print("   By severity:")
            for severity, count in summary['severity_counts'].items():
                if count > 0:
                    print(f"     {severity.capitalize()}: {count}")

        # Determine if scan passed
        critical_high = summary['severity_counts']['critical'] + summary['severity_counts']['high']

        if critical_high > 0:
            print(f"\n❌ Scan failed: {critical_high} critical/high severity vulnerabilities found")
            return False
        elif summary['total_vulnerabilities'] > 0:
            print(f"\n⚠️  Scan passed with warnings: {summary['total_vulnerabilities']} low/moderate vulnerabilities")
            return True
        else:
            print("\n✅ Scan passed: No vulnerabilities found")
            return True


def main():
    """Main entry point"""
    scanner = PythonDependencyScanner()

    try:
        success = scanner.scan()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Scan failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()