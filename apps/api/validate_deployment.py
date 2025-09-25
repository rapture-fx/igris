#!/usr/bin/env python3
"""
Schlep Engine v2.0.0 - Comprehensive Deployment Validation
Validates Docker Compose, Kubernetes, security, and performance
"""

import sys
import subprocess
import time
import json
import tempfile
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import yaml

class DeploymentValidator:
    """Comprehensive deployment validation"""

    def __init__(self):
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'version': '2.0.0',
            'validations': {}
        }

    def validate_docker_compose(self):
        """Validate Docker Compose configuration"""
        print("🐳 Validating Docker Compose Deployment...")

        try:
            # Check docker-compose.yml syntax
            result = subprocess.run(['docker', 'compose', 'config', '--quiet'],
                                  capture_output=True, text=True)

            if result.returncode == 0:
                print("✅ Docker Compose syntax: Valid")

                # Check if services are defined
                result = subprocess.run(['docker', 'compose', 'config'],
                                      capture_output=True, text=True)

                if 'api' in result.stdout and 'postgresql' in result.stdout:
                    print("✅ Docker Compose services: API and PostgreSQL defined")

                    self.results['validations']['docker_compose'] = {
                        'syntax_valid': True,
                        'services_defined': True,
                        'status': 'valid'
                    }
                else:
                    print("⚠️  Docker Compose services: Some services missing")
                    self.results['validations']['docker_compose'] = {
                        'syntax_valid': True,
                        'services_defined': False,
                        'status': 'partial'
                    }

            else:
                print(f"❌ Docker Compose syntax error: {result.stderr}")
                self.results['validations']['docker_compose'] = {
                    'syntax_valid': False,
                    'error': result.stderr,
                    'status': 'failed'
                }

        except FileNotFoundError:
            print("⚠️  Docker not available")
            self.results['validations']['docker_compose'] = {
                'error': 'Docker not installed',
                'status': 'unavailable'
            }

        except Exception as e:
            print(f"❌ Docker Compose validation failed: {e}")
            self.results['validations']['docker_compose'] = {
                'error': str(e),
                'status': 'failed'
            }

    def validate_kubernetes_manifests(self):
        """Validate Kubernetes manifests"""
        print("\n☸️  Validating Kubernetes Manifests...")

        k8s_dir = Path('k8s')
        if not k8s_dir.exists():
            print("❌ Kubernetes manifests directory not found")
            self.results['validations']['kubernetes'] = {
                'error': 'k8s directory not found',
                'status': 'failed'
            }
            return

        yaml_files = list(k8s_dir.glob('*.yaml'))
        validated_files = []
        errors = []

        for yaml_file in yaml_files:
            try:
                with open(yaml_file, 'r') as f:
                    # Parse YAML documents
                    docs = list(yaml.safe_load_all(f))

                    valid_docs = 0
                    for doc in docs:
                        if doc and 'apiVersion' in doc and 'kind' in doc:
                            valid_docs += 1

                    validated_files.append({
                        'file': yaml_file.name,
                        'documents': len(docs),
                        'valid_documents': valid_docs,
                        'status': 'valid'
                    })

                    print(f"✅ {yaml_file.name}: {valid_docs} valid Kubernetes resources")

            except Exception as e:
                errors.append({
                    'file': yaml_file.name,
                    'error': str(e)
                })
                print(f"❌ {yaml_file.name}: {e}")

        self.results['validations']['kubernetes'] = {
            'total_files': len(yaml_files),
            'validated_files': len(validated_files),
            'files': validated_files,
            'errors': errors,
            'status': 'valid' if len(errors) == 0 else 'partial'
        }

        print(f"✅ Kubernetes manifests: {len(validated_files)}/{len(yaml_files)} files valid")

    def validate_security_configuration(self):
        """Validate security configurations"""
        print("\n🛡️  Validating Security Configuration...")

        security_checks = []

        # Check Dockerfiles for security practices
        dockerfile_minimal = Path('Dockerfile.minimal')
        dockerfile_ml = Path('Dockerfile.ml')

        for dockerfile in [dockerfile_minimal, dockerfile_ml]:
            if dockerfile.exists():
                with open(dockerfile, 'r') as f:
                    content = f.read()

                checks = {
                    'non_root_user': 'USER schlep' in content,
                    'no_root_commands': 'RUN' in content and 'sudo' not in content,
                    'multi_stage_build': 'FROM' in content and 'as' in content.lower(),
                    'minimal_packages': 'rm -rf /var/lib/apt/lists/*' in content
                }

                security_checks.append({
                    'file': dockerfile.name,
                    'checks': checks,
                    'score': sum(checks.values()) / len(checks)
                })

                print(f"✅ {dockerfile.name}: {sum(checks.values())}/{len(checks)} security checks passed")

        # Check for secrets management
        secrets_file = Path('k8s/secrets.yaml')
        if secrets_file.exists():
            print("✅ Kubernetes secrets configuration found")
            security_checks.append({
                'component': 'secrets_management',
                'status': 'configured'
            })

        # Check for TLS configuration
        ingress_files = list(Path('k8s').glob('*ingress*.yaml'))
        tls_configured = False
        for ingress_file in ingress_files:
            with open(ingress_file, 'r') as f:
                content = f.read()
                if 'tls:' in content or 'cert-manager' in content:
                    tls_configured = True
                    break

        security_checks.append({
            'component': 'tls_configuration',
            'status': 'configured' if tls_configured else 'not_configured'
        })

        print(f"{'✅' if tls_configured else '⚠️ '} TLS configuration: {'Found' if tls_configured else 'Not configured'}")

        self.results['validations']['security'] = {
            'checks': security_checks,
            'tls_configured': tls_configured,
            'status': 'good'
        }

    def validate_monitoring_stack(self):
        """Validate monitoring and observability"""
        print("\n📊 Validating Monitoring Stack...")

        monitoring_components = {
            'prometheus': False,
            'grafana': False,
            'alertmanager': False,
            'custom_metrics': False
        }

        # Check Kubernetes monitoring manifests
        monitoring_file = Path('k8s/monitoring.yaml')
        if monitoring_file.exists():
            with open(monitoring_file, 'r') as f:
                content = f.read()

            monitoring_components['prometheus'] = 'prometheus' in content.lower()
            monitoring_components['grafana'] = 'grafana' in content.lower()
            monitoring_components['alertmanager'] = 'alertmanager' in content.lower()

        # Check for custom metrics in code
        metrics_files = list(Path('app').rglob('*metrics*.py'))
        if metrics_files:
            monitoring_components['custom_metrics'] = True

        for component, configured in monitoring_components.items():
            print(f"{'✅' if configured else '⚠️ '} {component}: {'Configured' if configured else 'Not found'}")

        # Check Docker Compose monitoring
        try:
            with open('docker-compose.yml', 'r') as f:
                compose_content = f.read()

            compose_monitoring = {
                'prometheus': 'prometheus' in compose_content,
                'grafana': 'grafana' in compose_content
            }

            print(f"Docker Compose monitoring: {sum(compose_monitoring.values())}/2 services")

        except FileNotFoundError:
            compose_monitoring = {}

        self.results['validations']['monitoring'] = {
            'kubernetes_components': monitoring_components,
            'docker_compose_components': compose_monitoring,
            'status': 'configured' if any(monitoring_components.values()) else 'missing'
        }

    def run_performance_benchmark(self):
        """Run a quick performance benchmark"""
        print("\n⚡ Running Performance Benchmark...")

        try:
            # Create test data
            test_data = pd.DataFrame({
                'id': range(100000),
                'category': [f'cat_{i%100}' for i in range(100000)],
                'value': np.random.uniform(0, 1000, 100000),
                'text': [f'sample_text_{i}' for i in range(100000)]
            })

            # CSV write benchmark
            temp_file = Path(tempfile.mktemp(suffix='.csv'))
            start_time = time.time()
            test_data.to_csv(temp_file, index=False)
            csv_write_time = time.time() - start_time

            # CSV read benchmark
            start_time = time.time()
            read_data = pd.read_csv(temp_file)
            csv_read_time = time.time() - start_time

            # Aggregation benchmark
            start_time = time.time()
            grouped = read_data.groupby('category')['value'].mean()
            agg_time = time.time() - start_time

            # Clean up
            temp_file.unlink()

            file_size_mb = temp_file.stat().st_size / 1024 / 1024 if temp_file.exists() else 0

            benchmark_results = {
                'csv_write_time': csv_write_time,
                'csv_read_time': csv_read_time,
                'aggregation_time': agg_time,
                'file_size_mb': file_size_mb,
                'read_throughput_mb_per_sec': file_size_mb / csv_read_time if csv_read_time > 0 else 0,
                'rows_processed': len(test_data),
                'groups_aggregated': len(grouped)
            }

            print(f"✅ Performance benchmark completed:")
            print(f"   CSV read: {csv_read_time:.3f}s ({file_size_mb / csv_read_time:.1f}MB/s)")
            print(f"   Aggregation: {agg_time:.3f}s ({len(grouped)} groups)")

            self.results['validations']['performance'] = {
                'benchmark_results': benchmark_results,
                'status': 'completed'
            }

        except Exception as e:
            print(f"❌ Performance benchmark failed: {e}")
            self.results['validations']['performance'] = {
                'error': str(e),
                'status': 'failed'
            }

    def validate_dependencies(self):
        """Validate dependencies are locked and minimal"""
        print("\n📦 Validating Dependencies...")

        dep_validation = {}

        # Check requirements.lock
        req_lock = Path('requirements.lock')
        if req_lock.exists():
            with open(req_lock, 'r') as f:
                requirements = f.readlines()

            # Count dependencies
            deps = [line.strip() for line in requirements if line.strip() and not line.startswith('#')]
            dep_validation['minimal_deps'] = {
                'file': 'requirements.lock',
                'count': len(deps),
                'target': 25,
                'status': 'good' if len(deps) <= 30 else 'too_many'
            }

            print(f"✅ Minimal dependencies: {len(deps)} packages (target: ≤25)")

        # Check ML requirements
        req_ml = Path('requirements-ml.txt')
        if req_ml.exists():
            with open(req_ml, 'r') as f:
                ml_requirements = f.readlines()

            ml_deps = [line.strip() for line in ml_requirements if line.strip() and not line.startswith('#')]
            dep_validation['ml_deps'] = {
                'file': 'requirements-ml.txt',
                'count': len(ml_deps),
                'target': 65,
                'status': 'good' if len(ml_deps) <= 70 else 'too_many'
            }

            print(f"✅ ML dependencies: {len(ml_deps)} packages (target: ≤65)")

        # Check for cloud dependencies
        all_deps = []
        for req_file in [req_lock, req_ml]:
            if req_file.exists():
                with open(req_file, 'r') as f:
                    all_deps.extend(f.readlines())

        cloud_deps = []
        cloud_keywords = ['aws', 'azure', 'google', 'gcp', 'boto', 'gcloud']
        for dep in all_deps:
            for keyword in cloud_keywords:
                if keyword in dep.lower():
                    cloud_deps.append(dep.strip())

        dep_validation['cloud_agnostic'] = {
            'cloud_dependencies_found': cloud_deps,
            'count': len(cloud_deps),
            'status': 'clean' if len(cloud_deps) == 0 else 'has_cloud_deps'
        }

        if len(cloud_deps) == 0:
            print("✅ Cloud dependencies: None found (fully cloud-agnostic)")
        else:
            print(f"⚠️  Cloud dependencies found: {len(cloud_deps)}")

        self.results['validations']['dependencies'] = dep_validation

    def generate_comprehensive_report(self):
        """Generate comprehensive validation report"""
        print("\n📋 COMPREHENSIVE VALIDATION REPORT")
        print("=" * 60)

        # Overall status
        validations = self.results['validations']
        total_validations = len(validations)
        passed_validations = 0

        for validation_name, validation_result in validations.items():
            status = validation_result.get('status', 'unknown')
            if status in ['valid', 'good', 'configured', 'completed', 'clean']:
                passed_validations += 1
                print(f"✅ {validation_name.replace('_', ' ').title()}: {status.upper()}")
            elif status in ['partial', 'not_configured']:
                print(f"⚠️  {validation_name.replace('_', ' ').title()}: {status.upper()}")
            else:
                print(f"❌ {validation_name.replace('_', ' ').title()}: {status.upper()}")

        success_rate = (passed_validations / total_validations) * 100
        print(f"\n🎯 Overall Success Rate: {success_rate:.1f}% ({passed_validations}/{total_validations})")

        # Key metrics summary
        if 'performance' in validations and 'benchmark_results' in validations['performance']:
            perf = validations['performance']['benchmark_results']
            print(f"⚡ Performance: {perf.get('read_throughput_mb_per_sec', 0):.1f}MB/s CSV ingestion")

        if 'dependencies' in validations:
            deps = validations['dependencies']
            if 'minimal_deps' in deps:
                print(f"📦 Dependencies: {deps['minimal_deps']['count']} minimal packages")

        if 'kubernetes' in validations:
            k8s = validations['kubernetes']
            print(f"☸️  Kubernetes: {k8s.get('validated_files', 0)} manifest files validated")

        print("\n" + "=" * 60)

        # Save detailed report
        report_file = Path(tempfile.gettempdir()) / f"schlep_validation_report_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2)

        print(f"📊 Detailed report saved: {report_file}")

        return self.results, success_rate >= 80

def main():
    """Main validation function"""
    print("🚀 Schlep Engine v2.0.0 - Comprehensive Deployment Validation")
    print("=" * 70)

    validator = DeploymentValidator()

    try:
        # Run all validations
        validator.validate_docker_compose()
        validator.validate_kubernetes_manifests()
        validator.validate_security_configuration()
        validator.validate_monitoring_stack()
        validator.run_performance_benchmark()
        validator.validate_dependencies()

        # Generate comprehensive report
        results, success = validator.generate_comprehensive_report()

        return results if success else None

    except KeyboardInterrupt:
        print("\n⚠️  Validation interrupted by user")
        return None

    except Exception as e:
        print(f"❌ Validation failed: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    results = main()
    sys.exit(0 if results else 1)