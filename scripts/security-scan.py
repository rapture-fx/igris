#!/usr/bin/env python3
"""
Local Security Scanning Script
==============================

This script performs comprehensive security scanning locally before committing code.
It integrates multiple security tools and generates a unified report.

Usage:
    python scripts/security-scan.py [--component api|admin|docs|landing] [--severity low|medium|high|critical]
"""

import argparse
import json
import subprocess
import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import tempfile

class SecurityScanner:
    """Comprehensive security scanner for local development"""
    
    def __init__(self, component: str = "all", severity: str = "medium"):
        self.component = component
        self.severity = severity
        self.results = {
            "scan_date": datetime.utcnow().isoformat(),
            "component": component,
            "severity_threshold": severity,
            "scans": {}
        }
        self.project_root = Path(__file__).parent.parent
        
    def run_all_scans(self) -> Dict[str, Any]:
        """Run all available security scans"""
        print("🔒 Starting comprehensive security scan...")
        
        # Determine components to scan
        components = ["api", "admin", "docs", "landing"] if self.component == "all" else [self.component]
        
        for component in components:
            print(f"\n📋 Scanning component: {component}")
            
            component_path = self.project_root / "apps" / component
            if not component_path.exists():
                print(f"⚠️  Component {component} not found, skipping...")
                continue
                
            self.scan_component(component, component_path)
        
        # Run repository-wide scans
        print("\n🔍 Running repository-wide scans...")
        self.scan_secrets()
        self.scan_infrastructure()
        
        # Generate final report
        return self.generate_report()
    
    def scan_component(self, component: str, component_path: Path):
        """Scan a specific component"""
        self.results["scans"][component] = {}
        
        if component == "api":
            self.scan_python_dependencies(component, component_path)
            self.scan_python_code(component, component_path)
        else:
            self.scan_node_dependencies(component, component_path)
            self.scan_javascript_code(component, component_path)
    
    def scan_python_dependencies(self, component: str, component_path: Path):
        """Scan Python dependencies for vulnerabilities"""
        print(f"  🐍 Scanning Python dependencies for {component}...")
        
        try:
            # Run Safety check
            safety_result = subprocess.run([
                "safety", "check", "--json", "--short-report"
            ], capture_output=True, text=True, cwd=component_path)
            
            if safety_result.returncode != 0:
                try:
                    safety_data = json.loads(safety_result.stdout)
                except json.JSONDecodeError:
                    safety_data = {"error": safety_result.stderr}
            else:
                safety_data = {"vulnerabilities": []}
            
            self.results["scans"][component]["safety"] = safety_data
            
            # Run pip-audit if available
            try:
                pip_audit_result = subprocess.run([
                    "pip-audit", "--format=json"
                ], capture_output=True, text=True, cwd=component_path)
                
                if pip_audit_result.returncode == 0:
                    pip_audit_data = json.loads(pip_audit_result.stdout)
                    self.results["scans"][component]["pip_audit"] = pip_audit_data
            except FileNotFoundError:
                print("    ℹ️  pip-audit not available, skipping...")
                
        except FileNotFoundError:
            print("    ⚠️  Safety not available, install with: pip install safety")
    
    def scan_python_code(self, component: str, component_path: Path):
        """Scan Python code for security issues"""
        print(f"  🔍 Scanning Python code for {component}...")
        
        try:
            # Run Bandit security scan
            bandit_result = subprocess.run([
                "bandit", "-r", ".", "-f", "json", "-ll"
            ], capture_output=True, text=True, cwd=component_path)
            
            try:
                bandit_data = json.loads(bandit_result.stdout)
            except json.JSONDecodeError:
                bandit_data = {"error": bandit_result.stderr}
            
            self.results["scans"][component]["bandit"] = bandit_data
            
        except FileNotFoundError:
            print("    ⚠️  Bandit not available, install with: pip install bandit")
    
    def scan_node_dependencies(self, component: str, component_path: Path):
        """Scan Node.js dependencies for vulnerabilities"""
        print(f"  📦 Scanning Node.js dependencies for {component}...")
        
        try:
            # Run npm audit
            npm_audit_result = subprocess.run([
                "npm", "audit", "--json"
            ], capture_output=True, text=True, cwd=component_path)
            
            try:
                npm_audit_data = json.loads(npm_audit_result.stdout)
            except json.JSONDecodeError:
                npm_audit_data = {"error": npm_audit_result.stderr}
            
            self.results["scans"][component]["npm_audit"] = npm_audit_data
            
        except FileNotFoundError:
            print("    ⚠️  npm not available")
    
    def scan_javascript_code(self, component: str, component_path: Path):
        """Scan JavaScript/TypeScript code for security issues"""
        print(f"  📝 Scanning JavaScript/TypeScript code for {component}...")
        
        try:
            # Run ESLint with security rules if available
            eslint_result = subprocess.run([
                "npx", "eslint", ".", "--format=json", "--no-error-on-unmatched-pattern"
            ], capture_output=True, text=True, cwd=component_path)
            
            try:
                eslint_data = json.loads(eslint_result.stdout)
            except json.JSONDecodeError:
                eslint_data = {"error": eslint_result.stderr}
            
            self.results["scans"][component]["eslint"] = eslint_data
            
        except FileNotFoundError:
            print("    ℹ️  ESLint not available")
    
    def scan_secrets(self):
        """Scan for exposed secrets"""
        print("  🔐 Scanning for exposed secrets...")
        
        # Simple regex-based secret detection
        secret_patterns = {
            "aws_access_key": r"AKIA[0-9A-Z]{16}",
            "private_key": r"-----BEGIN [A-Z]+ PRIVATE KEY-----",
            "generic_api_key": r"[Aa]pi[_-]?[Kk]ey[\"'\s]*[:=][\"'\s]*[A-Za-z0-9]{16,}",
            "password": r"[Pp]assword[\"'\s]*[:=][\"'\s]*[\"'][^\"']{8,}[\"']",
            "jwt_token": r"eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*"
        }
        
        secrets_found = []
        
        # Scan common files
        for root, dirs, files in os.walk(self.project_root):
            # Skip certain directories
            if any(skip in root for skip in ['.git', 'node_modules', '__pycache__', '.env']):
                continue
                
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.tsx', '.json', '.yaml', '.yml')):
                    file_path = Path(root) / file
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        for secret_type, pattern in secret_patterns.items():
                            import re
                            matches = re.finditer(pattern, content)
                            for match in matches:
                                secrets_found.append({
                                    "type": secret_type,
                                    "file": str(file_path.relative_to(self.project_root)),
                                    "line": content[:match.start()].count('\n') + 1,
                                    "match": match.group()[:20] + "..." if len(match.group()) > 20 else match.group()
                                })
                    except (UnicodeDecodeError, FileNotFoundError):
                        continue
        
        self.results["scans"]["secrets"] = {
            "secrets_found": secrets_found,
            "total_files_scanned": len(list(self.project_root.rglob("*.py"))) + len(list(self.project_root.rglob("*.js")))
        }
    
    def scan_infrastructure(self):
        """Scan infrastructure configurations"""
        print("  🏗️  Scanning infrastructure configurations...")
        
        docker_issues = []
        k8s_issues = []
        
        # Scan Dockerfiles
        for dockerfile in self.project_root.rglob("Dockerfile*"):
            try:
                with open(dockerfile, 'r') as f:
                    content = f.read()
                
                # Check for security issues
                if "USER root" in content:
                    docker_issues.append({
                        "file": str(dockerfile.relative_to(self.project_root)),
                        "issue": "Running as root user",
                        "severity": "medium"
                    })
                
                if "--no-check-certificate" in content:
                    docker_issues.append({
                        "file": str(dockerfile.relative_to(self.project_root)),
                        "issue": "Disabled certificate checking",
                        "severity": "high"
                    })
                    
            except FileNotFoundError:
                continue
        
        # Scan Kubernetes manifests
        for k8s_file in self.project_root.rglob("*.yaml"):
            if "k8s" in str(k8s_file) or "kubernetes" in str(k8s_file):
                try:
                    with open(k8s_file, 'r') as f:
                        content = f.read()
                    
                    # Check for security issues
                    if "privileged: true" in content:
                        k8s_issues.append({
                            "file": str(k8s_file.relative_to(self.project_root)),
                            "issue": "Privileged container",
                            "severity": "high"
                        })
                        
                except FileNotFoundError:
                    continue
        
        self.results["scans"]["infrastructure"] = {
            "docker_issues": docker_issues,
            "kubernetes_issues": k8s_issues
        }
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate final security report"""
        print("\n📊 Generating security report...")
        
        # Calculate summary statistics
        total_issues = 0
        critical_issues = 0
        high_issues = 0
        medium_issues = 0
        low_issues = 0
        
        for component, scans in self.results["scans"].items():
            for scan_type, scan_data in scans.items():
                if scan_type == "safety" and "vulnerabilities" in scan_data:
                    total_issues += len(scan_data["vulnerabilities"])
                elif scan_type == "bandit" and "results" in scan_data:
                    for result in scan_data["results"]:
                        total_issues += 1
                        severity = result.get("issue_severity", "").lower()
                        if severity == "high":
                            high_issues += 1
                        elif severity == "medium":
                            medium_issues += 1
                        else:
                            low_issues += 1
                elif scan_type == "npm_audit" and "vulnerabilities" in scan_data:
                    for vuln_name, vuln_data in scan_data["vulnerabilities"].items():
                        total_issues += 1
                        severity = vuln_data.get("severity", "").lower()
                        if severity == "critical":
                            critical_issues += 1
                        elif severity == "high":
                            high_issues += 1
                        elif severity == "moderate":
                            medium_issues += 1
                        else:
                            low_issues += 1
        
        # Add secrets issues
        if "secrets" in self.results["scans"]:
            secrets_count = len(self.results["scans"]["secrets"]["secrets_found"])
            total_issues += secrets_count
            high_issues += secrets_count  # Secrets are always high severity
        
        summary = {
            "total_issues": total_issues,
            "critical_issues": critical_issues,
            "high_issues": high_issues,
            "medium_issues": medium_issues,
            "low_issues": low_issues,
            "scan_status": "PASS" if critical_issues == 0 and high_issues == 0 else "FAIL"
        }
        
        self.results["summary"] = summary
        
        # Print summary
        print(f"\n📋 Security Scan Summary:")
        print(f"  Status: {'✅ PASS' if summary['scan_status'] == 'PASS' else '❌ FAIL'}")
        print(f"  Total Issues: {total_issues}")
        print(f"  Critical: {critical_issues}")
        print(f"  High: {high_issues}")
        print(f"  Medium: {medium_issues}")
        print(f"  Low: {low_issues}")
        
        # Save report to file
        report_file = self.project_root / "security-scan-report.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print(f"\n💾 Full report saved to: {report_file}")
        
        return self.results

def main():
    parser = argparse.ArgumentParser(description="Run security scans on Schlep-engine components")
    parser.add_argument(
        "--component", 
        choices=["api", "admin", "docs", "landing", "all"], 
        default="all",
        help="Component to scan (default: all)"
    )
    parser.add_argument(
        "--severity",
        choices=["low", "medium", "high", "critical"],
        default="medium", 
        help="Minimum severity level to report (default: medium)"
    )
    parser.add_argument(
        "--output",
        default="security-scan-report.json",
        help="Output file for the report"
    )
    
    args = parser.parse_args()
    
    scanner = SecurityScanner(args.component, args.severity)
    results = scanner.run_all_scans()
    
    # Exit with error code if critical or high issues found
    if results["summary"]["critical_issues"] > 0 or results["summary"]["high_issues"] > 0:
        sys.exit(1)
    
    sys.exit(0)

if __name__ == "__main__":
    main()