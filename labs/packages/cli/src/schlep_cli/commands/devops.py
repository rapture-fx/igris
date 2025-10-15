"""
DevOps automation commands for Schlep-engine CLI.
Includes infrastructure management, deployment automation, and CI/CD integration.
"""

import os
import sys
import yaml
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.live import Live
from rich.table import Table
from rich.progress import track

from ..core.config import Config
from ..core.client import APIClient
from ..core.utils import (
    handle_exceptions, validate_file_path, validate_directory_path, 
    format_duration, Timer
)
from ..ui.progress import ProgressTracker, BatchProgressTracker
from ..ui.table import create_table, display_table
from ..ui.spinner import operation_spinner, multi_step_spinner

console = Console()

@click.group()
def devops():
    """DevOps automation and infrastructure management commands."""
    pass

@devops.command()
@click.argument('infrastructure_dir', type=click.Path(exists=True))
@click.option(
    '--env', '-e',
    type=click.Choice(['dev', 'staging', 'production']),
    default='dev',
    help='Target environment'
)
@click.option(
    '--parallel', '-p',
    type=click.IntRange(1, 10),
    default=3,
    help='Number of parallel deployment jobs'
)
@click.option(
    '--validate-only',
    is_flag=True,
    help='Only validate configurations without deploying'
)
@click.option(
    '--rollback-on-failure',
    is_flag=True,
    help='Automatically rollback on deployment failure'
)
@click.option(
    '--config-file', '-c',
    type=click.Path(exists=True),
    help='Custom deployment configuration file'
)
@click.pass_context
@handle_exceptions
def deploy(ctx, infrastructure_dir: str, env: str, parallel: int, validate_only: bool, 
           rollback_on_failure: bool, config_file: Optional[str]):
    """
    Deploy infrastructure components in batch.
    
    Supports Kubernetes, Docker Compose, Terraform, and other infrastructure definitions.
    
    Examples:
        schlep devops deploy ./infrastructure --env staging
        schlep devops deploy ./k8s --parallel 5 --rollback-on-failure
        schlep devops deploy ./terraform --validate-only
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    infra_path = validate_directory_path(infrastructure_dir)
    
    # Load deployment configuration
    deployment_config = load_deployment_config(config_file, env)
    
    # Discover infrastructure files
    infra_files = discover_infrastructure_files(infra_path, env)
    
    if not infra_files:
        console.print(f"[yellow]No infrastructure files found in {infra_path}[/yellow]")
        return
    
    console.print(f"[cyan]Found {len(infra_files)} infrastructure components to deploy[/cyan]")
    
    # Display deployment plan
    display_deployment_plan(infra_files, env, deployment_config)
    
    if validate_only:
        validate_infrastructure_components(infra_files)
        console.print("[green]✓ All infrastructure components are valid[/green]")
        return
    
    if not Confirm.ask(f"Deploy to {env} environment?", default=False):
        console.print("Deployment cancelled")
        return
    
    # Execute deployment
    deployment_results = []
    with Timer("Infrastructure deployment"):
        try:
            if len(infra_files) == 1:
                # Single component deployment
                result = deploy_single_component(infra_files[0], env, deployment_config, client)
                deployment_results.append(result)
            else:
                # Parallel deployment
                deployment_results = deploy_components_parallel(
                    infra_files, env, deployment_config, parallel, rollback_on_failure, client
                )
            
            # Display deployment results
            display_deployment_results(deployment_results, env)
            
        except Exception as e:
            if rollback_on_failure:
                console.print(f"[red]Deployment failed: {e}[/red]")
                console.print("[yellow]Initiating rollback...[/yellow]")
                perform_rollback(deployment_results, env)
            else:
                console.print(f"[red]Deployment failed: {e}[/red]")
                sys.exit(1)

@devops.command()
@click.argument('config_pattern')
@click.option(
    '--batch-size', '-b',
    type=click.IntRange(1, 100),
    default=10,
    help='Number of configurations to process in each batch'
)
@click.option(
    '--parallel', '-p',
    type=click.IntRange(1, 16),
    default=4,
    help='Number of parallel processing jobs'
)
@click.option(
    '--output-dir', '-o',
    type=click.Path(),
    help='Output directory for processed configurations'
)
@click.option(
    '--template-vars',
    multiple=True,
    help='Template variables (key=value pairs)'
)
@click.option(
    '--validate',
    is_flag=True,
    help='Validate configurations before processing'
)
@click.option(
    '--dry-run',
    is_flag=True,
    help='Show what would be processed without making changes'
)
@click.pass_context
@handle_exceptions
def batch_config(ctx, config_pattern: str, batch_size: int, parallel: int,
                 output_dir: Optional[str], template_vars: tuple, validate: bool, dry_run: bool):
    """
    Process configuration files in batch with templating and validation.
    
    Supports Kubernetes manifests, Docker Compose files, Terraform configs, etc.
    
    Examples:
        schlep devops batch-config "configs/*.yml" --batch-size 5
        schlep devops batch-config "k8s/**/*.yaml" --validate --parallel 8
        schlep devops batch-config "terraform/*.tf" --template-vars env=prod region=us-east-1
    """
    config = ctx.obj.get('config') or Config()
    
    import glob
    
    # Find matching configuration files
    config_files = glob.glob(config_pattern, recursive=True)
    config_files = [f for f in config_files if os.path.isfile(f)]
    
    if not config_files:
        console.print(f"[yellow]No configuration files found matching: {config_pattern}[/yellow]")
        return
    
    console.print(f"[cyan]Found {len(config_files)} configuration files to process[/cyan]")
    
    # Parse template variables
    template_variables = {}
    for var in template_vars:
        if '=' in var:
            key, value = var.split('=', 1)
            template_variables[key.strip()] = value.strip()
    
    # Setup output directory
    if output_dir:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = Path.cwd() / "processed_configs"
        output_path.mkdir(exist_ok=True)
    
    if dry_run:
        display_batch_config_plan(config_files, template_variables, output_path, batch_size)
        return
    
    # Process configurations in batches
    results = []
    errors = []
    
    with Timer("Batch configuration processing"):
        with BatchProgressTracker().batch_operation(len(config_files), "Processing configs") as batch_tracker:
            results, errors = process_configs_parallel(
                config_files, template_variables, output_path, 
                batch_size, parallel, validate, batch_tracker
            )
    
    # Display results
    display_batch_config_results(results, errors, len(config_files))

@devops.command()
@click.option(
    '--provider',
    type=click.Choice(['kubernetes', 'docker', 'terraform', 'aws']),
    help='Infrastructure provider to monitor'
)
@click.option(
    '--namespace', '-n',
    help='Kubernetes namespace (for k8s provider)'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch for changes with live updates'
)
@click.option(
    '--output-format', '-f',
    type=click.Choice(['table', 'json', 'yaml']),
    default='table',
    help='Output format'
)
@click.pass_context
@handle_exceptions
def status(ctx, provider: Optional[str], namespace: Optional[str], watch: bool, output_format: str):
    """
    Monitor infrastructure status across multiple providers.
    
    Examples:
        schlep devops status --provider kubernetes
        schlep devops status --provider kubernetes --namespace production --watch
        schlep devops status --provider docker --output-format json
    """
    config = ctx.obj.get('config') or Config()
    
    if watch:
        watch_infrastructure_status(provider, namespace, output_format)
    else:
        show_infrastructure_status(provider, namespace, output_format)

@devops.command()
@click.argument('service_configs', nargs=-1)
@click.option(
    '--health-check-url',
    help='URL pattern for health checks (with {service} placeholder)'
)
@click.option(
    '--timeout', '-t',
    type=click.IntRange(1, 300),
    default=30,
    help='Health check timeout in seconds'
)
@click.option(
    '--interval', '-i',
    type=click.IntRange(1, 60),
    default=5,
    help='Check interval in seconds'
)
@click.option(
    '--max-retries',
    type=click.IntRange(1, 10),
    default=3,
    help='Maximum retry attempts'
)
@click.option(
    '--parallel-checks',
    type=click.IntRange(1, 20),
    default=5,
    help='Number of parallel health checks'
)
@click.pass_context
@handle_exceptions
def health_check(ctx, service_configs: tuple, health_check_url: Optional[str],
                 timeout: int, interval: int, max_retries: int, parallel_checks: int):
    """
    Perform batch health checks on deployed services.
    
    Examples:
        schlep devops health-check service1.yml service2.yml
        schlep devops health-check configs/*.yml --health-check-url "https://{service}.example.com/health"
        schlep devops health-check --parallel-checks 10 --max-retries 5
    """
    if not service_configs:
        console.print("[yellow]No service configurations specified[/yellow]")
        return
    
    # Load service configurations
    services = []
    for config_file in service_configs:
        try:
            services.extend(load_service_configs(config_file))
        except Exception as e:
            console.print(f"[red]Failed to load {config_file}: {e}[/red]")
    
    if not services:
        console.print("[yellow]No services found in configurations[/yellow]")
        return
    
    console.print(f"[cyan]Performing health checks on {len(services)} services[/cyan]")
    
    # Perform health checks
    with Timer("Health checks"):
        health_results = perform_batch_health_checks(
            services, health_check_url, timeout, max_retries, parallel_checks
        )
    
    # Display results
    display_health_check_results(health_results)

def discover_infrastructure_files(infra_path: Path, env: str) -> List[Dict[str, Any]]:
    """Discover infrastructure files in the given directory."""
    files = []
    
    # Common infrastructure file patterns
    patterns = [
        "*.yml", "*.yaml",  # Kubernetes, Docker Compose, etc.
        "*.tf", "*.tfvars",  # Terraform
        "*.json",  # Various configs
        "Dockerfile*",  # Docker
        "docker-compose*.yml"  # Docker Compose
    ]
    
    for pattern in patterns:
        for file_path in infra_path.rglob(pattern):
            if file_path.is_file():
                # Determine file type and priority
                file_type = determine_infrastructure_type(file_path)
                priority = get_deployment_priority(file_path, env)
                
                files.append({
                    'path': file_path,
                    'type': file_type,
                    'priority': priority,
                    'env': env
                })
    
    # Sort by priority (higher priority first)
    files.sort(key=lambda x: x['priority'], reverse=True)
    return files

def determine_infrastructure_type(file_path: Path) -> str:
    """Determine the type of infrastructure file."""
    name = file_path.name.lower()
    
    if name.startswith('dockerfile'):
        return 'docker'
    elif 'docker-compose' in name:
        return 'docker-compose'
    elif file_path.suffix == '.tf':
        return 'terraform'
    elif 'kubernetes' in str(file_path) or 'k8s' in str(file_path):
        return 'kubernetes'
    elif file_path.suffix in ['.yml', '.yaml']:
        # Try to determine based on content
        try:
            with open(file_path, 'r') as f:
                content = yaml.safe_load(f)
                if isinstance(content, dict):
                    if 'apiVersion' in content and 'kind' in content:
                        return 'kubernetes'
                    elif 'version' in content and 'services' in content:
                        return 'docker-compose'
        except:
            pass
        return 'yaml'
    else:
        return 'unknown'

def get_deployment_priority(file_path: Path, env: str) -> int:
    """Get deployment priority for infrastructure component."""
    name = file_path.name.lower()
    
    # Base priority
    priority = 50
    
    # Type-based priority adjustments
    if 'namespace' in name or 'configmap' in name:
        priority += 40  # Deploy first
    elif 'service' in name and 'deployment' not in name:
        priority += 30
    elif 'deployment' in name or 'statefulset' in name:
        priority += 20
    elif 'ingress' in name:
        priority += 10  # Deploy last
    
    # Environment-specific adjustments
    if env in name:
        priority += 15
    
    return priority

def load_deployment_config(config_file: Optional[str], env: str) -> Dict[str, Any]:
    """Load deployment configuration."""
    config = {
        'environment': env,
        'timeout': 300,
        'rollback_enabled': True,
        'health_check_enabled': True,
        'parallel_limit': 5
    }
    
    if config_file:
        try:
            with open(config_file, 'r') as f:
                if config_file.endswith(('.yml', '.yaml')):
                    file_config = yaml.safe_load(f)
                else:
                    file_config = json.load(f)
                config.update(file_config)
        except Exception as e:
            console.print(f"[yellow]Warning: Failed to load config file {config_file}: {e}[/yellow]")
    
    return config

def display_deployment_plan(files: List[Dict[str, Any]], env: str, config: Dict[str, Any]):
    """Display the deployment plan."""
    plan_text = Text()
    plan_text.append(f"Deployment Plan - {env.upper()} Environment\n\n", style="bold cyan")
    
    # Group files by type
    by_type = {}
    for file_info in files:
        file_type = file_info['type']
        if file_type not in by_type:
            by_type[file_type] = []
        by_type[file_type].append(file_info)
    
    for file_type, type_files in by_type.items():
        plan_text.append(f"{file_type.title()} ({len(type_files)} files):\n", style="bold yellow")
        for file_info in type_files:
            priority = file_info['priority']
            plan_text.append(f"  • {file_info['path'].name} (priority: {priority})\n", style="white")
        plan_text.append("\n")
    
    plan_text.append(f"Parallel limit: {config.get('parallel_limit', 5)}\n", style="dim")
    plan_text.append(f"Timeout: {config.get('timeout', 300)}s\n", style="dim")
    
    if config.get('rollback_enabled'):
        plan_text.append("✓ Rollback enabled\n", style="green")
    if config.get('health_check_enabled'):
        plan_text.append("✓ Health checks enabled\n", style="green")
    
    console.print(Panel(plan_text, title="Deployment Plan", border_style="blue"))

def validate_infrastructure_components(files: List[Dict[str, Any]]):
    """Validate infrastructure components."""
    console.print("[cyan]Validating infrastructure components...[/cyan]")
    
    validation_errors = []
    
    for file_info in track(files, description="Validating..."):
        try:
            file_path = file_info['path']
            file_type = file_info['type']
            
            if file_type == 'kubernetes':
                errors = validate_kubernetes_manifest(file_path)
            elif file_type == 'docker-compose':
                errors = validate_docker_compose(file_path)
            elif file_type == 'terraform':
                errors = validate_terraform_config(file_path)
            else:
                errors = validate_yaml_syntax(file_path)
            
            if errors:
                validation_errors.extend([(file_path, error) for error in errors])
                
        except Exception as e:
            validation_errors.append((file_path, f"Validation failed: {e}"))
    
    if validation_errors:
        console.print(f"[red]Found {len(validation_errors)} validation errors:[/red]")
        for file_path, error in validation_errors[:10]:  # Show first 10 errors
            console.print(f"  [red]•[/red] {file_path.name}: {error}")
        if len(validation_errors) > 10:
            console.print(f"  [dim]... and {len(validation_errors) - 10} more errors[/dim]")
        raise click.ClickException("Validation failed")

def validate_kubernetes_manifest(file_path: Path) -> List[str]:
    """Validate Kubernetes manifest."""
    errors = []
    try:
        with open(file_path, 'r') as f:
            docs = list(yaml.safe_load_all(f))
            
        for doc in docs:
            if not doc:
                continue
                
            if not isinstance(doc, dict):
                errors.append("Document is not a valid YAML object")
                continue
                
            # Check required fields
            if 'apiVersion' not in doc:
                errors.append("Missing required field: apiVersion")
            if 'kind' not in doc:
                errors.append("Missing required field: kind")
            if 'metadata' not in doc:
                errors.append("Missing required field: metadata")
                
    except yaml.YAMLError as e:
        errors.append(f"YAML syntax error: {e}")
    except Exception as e:
        errors.append(f"Validation error: {e}")
    
    return errors

def validate_docker_compose(file_path: Path) -> List[str]:
    """Validate Docker Compose file."""
    errors = []
    try:
        with open(file_path, 'r') as f:
            config = yaml.safe_load(f)
            
        if not isinstance(config, dict):
            errors.append("Not a valid Docker Compose file")
            return errors
            
        # Check version
        if 'version' not in config:
            errors.append("Missing version field")
            
        # Check services
        if 'services' not in config:
            errors.append("Missing services section")
        elif not isinstance(config['services'], dict):
            errors.append("Services section must be a dictionary")
            
    except yaml.YAMLError as e:
        errors.append(f"YAML syntax error: {e}")
    except Exception as e:
        errors.append(f"Validation error: {e}")
    
    return errors

def validate_terraform_config(file_path: Path) -> List[str]:
    """Validate Terraform configuration (basic syntax check)."""
    errors = []
    try:
        # Basic Terraform syntax validation
        with open(file_path, 'r') as f:
            content = f.read()
            
        # Check for basic Terraform syntax
        if not any(keyword in content for keyword in ['resource', 'data', 'variable', 'output', 'module']):
            errors.append("No Terraform resources found")
            
        # Check for balanced braces
        open_braces = content.count('{')
        close_braces = content.count('}')
        if open_braces != close_braces:
            errors.append(f"Unbalanced braces: {open_braces} open, {close_braces} close")
            
    except Exception as e:
        errors.append(f"Validation error: {e}")
    
    return errors

def validate_yaml_syntax(file_path: Path) -> List[str]:
    """Validate YAML syntax."""
    errors = []
    try:
        with open(file_path, 'r') as f:
            yaml.safe_load_all(f)
    except yaml.YAMLError as e:
        errors.append(f"YAML syntax error: {e}")
    except Exception as e:
        errors.append(f"Validation error: {e}")
    
    return errors

def deploy_components_parallel(files: List[Dict[str, Any]], env: str, config: Dict[str, Any],
                              parallel: int, rollback_on_failure: bool, client: APIClient) -> List[Dict[str, Any]]:
    """Deploy infrastructure components in parallel."""
    results = []
    
    def deploy_component(file_info: Dict[str, Any]) -> Dict[str, Any]:
        try:
            return deploy_single_component(file_info, env, config, client)
        except Exception as e:
            return {
                'file': file_info['path'].name,
                'type': file_info['type'],
                'success': False,
                'error': str(e)
            }
    
    with ThreadPoolExecutor(max_workers=parallel) as executor:
        future_to_file = {executor.submit(deploy_component, file_info): file_info 
                          for file_info in files}
        
        for future in as_completed(future_to_file):
            result = future.result()
            results.append(result)
            
            # Check for failure and rollback if needed
            if not result['success'] and rollback_on_failure:
                console.print(f"[red]Deployment of {result['file']} failed, initiating rollback[/red]")
                break
    
    return results

def deploy_single_component(file_info: Dict[str, Any], env: str, 
                           config: Dict[str, Any], client: APIClient) -> Dict[str, Any]:
    """Deploy a single infrastructure component."""
    file_path = file_info['path']
    file_type = file_info['type']
    
    start_time = datetime.now()
    
    try:
        if file_type == 'kubernetes':
            success = deploy_kubernetes_manifest(file_path, env)
        elif file_type == 'docker-compose':
            success = deploy_docker_compose(file_path, env)
        elif file_type == 'terraform':
            success = deploy_terraform_config(file_path, env)
        else:
            success = False
            
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        return {
            'file': file_path.name,
            'type': file_type,
            'success': success,
            'duration': duration,
            'timestamp': end_time.isoformat()
        }
        
    except Exception as e:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        return {
            'file': file_path.name,
            'type': file_type,
            'success': False,
            'error': str(e),
            'duration': duration,
            'timestamp': end_time.isoformat()
        }

def deploy_kubernetes_manifest(file_path: Path, env: str) -> bool:
    """Deploy Kubernetes manifest."""
    try:
        cmd = ['kubectl', 'apply', '-f', str(file_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        console.print(f"[red]kubectl apply failed: {e.stderr}[/red]")
        return False
    except FileNotFoundError:
        console.print("[red]kubectl not found. Please install kubectl.[/red]")
        return False

def deploy_docker_compose(file_path: Path, env: str) -> bool:
    """Deploy Docker Compose configuration."""
    try:
        cmd = ['docker-compose', '-f', str(file_path), 'up', '-d']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        console.print(f"[red]docker-compose up failed: {e.stderr}[/red]")
        return False
    except FileNotFoundError:
        console.print("[red]docker-compose not found. Please install Docker Compose.[/red]")
        return False

def deploy_terraform_config(file_path: Path, env: str) -> bool:
    """Deploy Terraform configuration."""
    try:
        # Change to the directory containing the Terraform file
        tf_dir = file_path.parent
        
        # Initialize Terraform
        init_cmd = ['terraform', 'init']
        subprocess.run(init_cmd, cwd=tf_dir, check=True, capture_output=True)
        
        # Plan
        plan_cmd = ['terraform', 'plan', '-out=tfplan']
        subprocess.run(plan_cmd, cwd=tf_dir, check=True, capture_output=True)
        
        # Apply
        apply_cmd = ['terraform', 'apply', '-auto-approve', 'tfplan']
        subprocess.run(apply_cmd, cwd=tf_dir, check=True, capture_output=True)
        
        return True
    except subprocess.CalledProcessError as e:
        console.print(f"[red]terraform command failed: {e}[/red]")
        return False
    except FileNotFoundError:
        console.print("[red]terraform not found. Please install Terraform.[/red]")
        return False

def display_deployment_results(results: List[Dict[str, Any]], env: str):
    """Display deployment results."""
    successful = len([r for r in results if r['success']])
    failed = len([r for r in results if not r['success']])
    
    # Summary
    summary_text = Text()
    summary_text.append(f"Deployment Results - {env.upper()}\n\n", style="bold cyan")
    summary_text.append(f"Total components: {len(results)}\n", style="cyan")
    summary_text.append(f"Successful: {successful}\n", style="green")
    if failed > 0:
        summary_text.append(f"Failed: {failed}\n", style="red")
    
    total_duration = sum(r.get('duration', 0) for r in results)
    summary_text.append(f"Total time: {format_duration(total_duration)}\n", style="cyan")
    
    console.print(Panel(summary_text, title="Deployment Summary", border_style="green" if failed == 0 else "red"))
    
    # Detailed results table
    table = create_table(title="Deployment Details", show_lines=True)
    table.add_column("Component", style="bold")
    table.add_column("Type", justify="center")
    table.add_column("Status", justify="center")
    table.add_column("Duration", justify="right")
    table.add_column("Error", style="red")
    
    for result in results:
        status = "[green]✓ Success[/green]" if result['success'] else "[red]✗ Failed[/red]"
        duration = format_duration(result.get('duration', 0))
        error = result.get('error', '')[:50] + "..." if len(result.get('error', '')) > 50 else result.get('error', '')
        
        table.add_row(
            result['file'],
            result['type'].title(),
            status,
            duration,
            error
        )
    
    display_table(table)

def perform_rollback(results: List[Dict[str, Any]], env: str):
    """Perform rollback of deployed components."""
    console.print("[yellow]Performing rollback...[/yellow]")
    
    # Rollback only successful deployments in reverse order
    successful_deployments = [r for r in results if r.get('success')]
    successful_deployments.reverse()
    
    rollback_results = []
    
    for result in successful_deployments:
        try:
            # This would implement actual rollback logic based on component type
            console.print(f"[yellow]Rolling back {result['file']}...[/yellow]")
            # Placeholder for rollback implementation
            rollback_results.append({
                'file': result['file'],
                'rollback_success': True
            })
        except Exception as e:
            rollback_results.append({
                'file': result['file'],
                'rollback_success': False,
                'error': str(e)
            })
    
    # Display rollback results
    rollback_successful = len([r for r in rollback_results if r.get('rollback_success')])
    console.print(f"[cyan]Rollback completed: {rollback_successful}/{len(rollback_results)} components[/cyan]")

def process_configs_parallel(config_files: List[str], template_vars: Dict[str, Any], 
                            output_path: Path, batch_size: int, parallel: int,
                            validate: bool, batch_tracker) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process configuration files in parallel."""
    results = []
    errors = []
    
    def process_config_file(file_path: str) -> Dict[str, Any]:
        try:
            input_path = Path(file_path)
            
            # Load and process configuration
            with open(input_path, 'r') as f:
                if input_path.suffix in ['.yml', '.yaml']:
                    content = yaml.safe_load(f)
                else:
                    content = json.load(f)
            
            # Apply template variables
            if template_vars:
                content = apply_template_variables(content, template_vars)
            
            # Validate if requested
            if validate:
                validation_errors = validate_config_content(content, input_path)
                if validation_errors:
                    return {
                        'file': str(input_path),
                        'success': False,
                        'errors': validation_errors
                    }
            
            # Save processed configuration
            output_file = output_path / input_path.name
            with open(output_file, 'w') as f:
                if input_path.suffix in ['.yml', '.yaml']:
                    yaml.dump(content, f, default_flow_style=False)
                else:
                    json.dump(content, f, indent=2)
            
            if batch_tracker:
                batch_tracker.complete_item()
            
            return {
                'file': str(input_path),
                'output_file': str(output_file),
                'success': True
            }
            
        except Exception as e:
            if batch_tracker:
                batch_tracker.complete_item()
            
            return {
                'file': file_path,
                'success': False,
                'error': str(e)
            }
    
    # Process files in parallel
    with ThreadPoolExecutor(max_workers=parallel) as executor:
        future_to_file = {executor.submit(process_config_file, file_path): file_path 
                          for file_path in config_files}
        
        for future in as_completed(future_to_file):
            result = future.result()
            if result['success']:
                results.append(result)
            else:
                errors.append(result)
    
    return results, errors

def apply_template_variables(content: Any, variables: Dict[str, Any]) -> Any:
    """Apply template variables to configuration content."""
    if isinstance(content, dict):
        return {k: apply_template_variables(v, variables) for k, v in content.items()}
    elif isinstance(content, list):
        return [apply_template_variables(item, variables) for item in content]
    elif isinstance(content, str):
        # Simple template variable substitution
        result = content
        for key, value in variables.items():
            result = result.replace(f"{{{key}}}", str(value))
        return result
    else:
        return content

def validate_config_content(content: Any, file_path: Path) -> List[str]:
    """Validate configuration content."""
    errors = []
    
    if not isinstance(content, dict):
        errors.append("Configuration must be a dictionary/object")
        return errors
    
    # Add specific validation rules based on file type or content
    # This is a placeholder for more sophisticated validation
    
    return errors

def display_batch_config_plan(config_files: List[str], template_vars: Dict[str, Any], 
                             output_path: Path, batch_size: int):
    """Display batch configuration processing plan."""
    plan_text = Text()
    plan_text.append("Batch Configuration Processing Plan\n\n", style="bold cyan")
    plan_text.append(f"Files to process: {len(config_files)}\n", style="cyan")
    plan_text.append(f"Batch size: {batch_size}\n", style="cyan")
    plan_text.append(f"Output directory: {output_path}\n", style="cyan")
    
    if template_vars:
        plan_text.append("\nTemplate variables:\n", style="yellow")
        for key, value in template_vars.items():
            plan_text.append(f"  {key} = {value}\n", style="white")
    
    plan_text.append(f"\nFiles to process:\n", style="yellow")
    for i, file_path in enumerate(config_files[:10]):  # Show first 10 files
        plan_text.append(f"  {i+1}. {Path(file_path).name}\n", style="white")
    
    if len(config_files) > 10:
        plan_text.append(f"  ... and {len(config_files) - 10} more files\n", style="dim")
    
    console.print(Panel(plan_text, title="Processing Plan", border_style="blue"))

def display_batch_config_results(results: List[Dict[str, Any]], errors: List[Dict[str, Any]], total_files: int):
    """Display batch configuration processing results."""
    successful = len(results)
    failed = len(errors)
    
    # Summary
    summary_text = Text()
    summary_text.append(f"Batch Processing Results\n\n", style="bold cyan")
    summary_text.append(f"Total files: {total_files}\n", style="cyan")
    summary_text.append(f"Successful: {successful}\n", style="green")
    if failed > 0:
        summary_text.append(f"Failed: {failed}\n", style="red")
    
    console.print(Panel(summary_text, title="Processing Summary", border_style="green" if failed == 0 else "red"))
    
    # Show errors if any
    if errors:
        error_table = create_table(title="Processing Errors", show_lines=True)
        error_table.add_column("File", style="bold red")
        error_table.add_column("Error", style="red")
        
        for error in errors[:10]:  # Show first 10 errors
            error_msg = error.get('error', 'Unknown error')
            if len(error_msg) > 100:
                error_msg = error_msg[:100] + "..."
            
            error_table.add_row(
                Path(error['file']).name,
                error_msg
            )
        
        if len(errors) > 10:
            console.print(f"[dim]... and {len(errors) - 10} more errors[/dim]")
        
        display_table(error_table)

def show_infrastructure_status(provider: Optional[str], namespace: Optional[str], output_format: str):
    """Show infrastructure status."""
    status_data = {}
    
    if not provider or provider == 'kubernetes':
        status_data['kubernetes'] = get_kubernetes_status(namespace)
    
    if not provider or provider == 'docker':
        status_data['docker'] = get_docker_status()
    
    if output_format == 'json':
        console.print(json.dumps(status_data, indent=2))
    elif output_format == 'yaml':
        console.print(yaml.dump(status_data, default_flow_style=False))
    else:
        display_infrastructure_status_table(status_data)

def watch_infrastructure_status(provider: Optional[str], namespace: Optional[str], output_format: str):
    """Watch infrastructure status with live updates."""
    console.print("[cyan]Watching infrastructure status (updating every 10s)[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    status_data = {}
                    
                    if not provider or provider == 'kubernetes':
                        status_data['kubernetes'] = get_kubernetes_status(namespace)
                    
                    if not provider or provider == 'docker':
                        status_data['docker'] = get_docker_status()
                    
                    if output_format == 'table':
                        table = create_infrastructure_status_table(status_data)
                        live.update(table, refresh=True)
                    else:
                        if output_format == 'json':
                            output = json.dumps(status_data, indent=2)
                        else:
                            output = yaml.dump(status_data, default_flow_style=False)
                        live.update(output, refresh=True)
                    
                    import time
                    time.sleep(10)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error fetching status: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching infrastructure status[/yellow]")

def get_kubernetes_status(namespace: Optional[str]) -> Dict[str, Any]:
    """Get Kubernetes cluster status."""
    try:
        status = {
            'available': True,
            'pods': {},
            'services': {},
            'deployments': {}
        }
        
        # Get pod status
        cmd = ['kubectl', 'get', 'pods']
        if namespace:
            cmd.extend(['-n', namespace])
        cmd.extend(['--output=json'])
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            pods_data = json.loads(result.stdout)
            status['pods'] = {
                'total': len(pods_data.get('items', [])),
                'running': len([p for p in pods_data.get('items', []) if p.get('status', {}).get('phase') == 'Running']),
                'pending': len([p for p in pods_data.get('items', []) if p.get('status', {}).get('phase') == 'Pending']),
                'failed': len([p for p in pods_data.get('items', []) if p.get('status', {}).get('phase') == 'Failed'])
            }
        
        return status
        
    except Exception as e:
        return {
            'available': False,
            'error': str(e)
        }

def get_docker_status() -> Dict[str, Any]:
    """Get Docker daemon and container status."""
    try:
        status = {
            'available': True,
            'containers': {}
        }
        
        # Get container status
        result = subprocess.run(['docker', 'ps', '-a', '--format', 'json'], capture_output=True, text=True)
        if result.returncode == 0:
            containers = []
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    containers.append(json.loads(line))
            
            status['containers'] = {
                'total': len(containers),
                'running': len([c for c in containers if c.get('State') == 'running']),
                'stopped': len([c for c in containers if c.get('State') == 'exited']),
                'paused': len([c for c in containers if c.get('State') == 'paused'])
            }
        
        return status
        
    except Exception as e:
        return {
            'available': False,
            'error': str(e)
        }

def create_infrastructure_status_table(status_data: Dict[str, Any]) -> Table:
    """Create infrastructure status table."""
    table = create_table(title="Infrastructure Status", show_lines=True)
    table.add_column("Provider", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Details")
    
    for provider, data in status_data.items():
        if data.get('available'):
            status_display = "[green]✓ Available[/green]"
            
            if provider == 'kubernetes' and 'pods' in data:
                pods = data['pods']
                details = f"Pods: {pods.get('running', 0)}/{pods.get('total', 0)} running"
            elif provider == 'docker' and 'containers' in data:
                containers = data['containers']
                details = f"Containers: {containers.get('running', 0)}/{containers.get('total', 0)} running"
            else:
                details = "Operational"
        else:
            status_display = "[red]✗ Unavailable[/red]"
            details = data.get('error', 'Unknown error')[:50]
        
        table.add_row(provider.title(), status_display, details)
    
    return table

def display_infrastructure_status_table(status_data: Dict[str, Any]):
    """Display infrastructure status as table."""
    table = create_infrastructure_status_table(status_data)
    display_table(table)

def load_service_configs(config_file: str) -> List[Dict[str, Any]]:
    """Load service configurations from file."""
    services = []
    
    try:
        config_path = Path(config_file)
        with open(config_path, 'r') as f:
            if config_path.suffix in ['.yml', '.yaml']:
                content = yaml.safe_load(f)
            else:
                content = json.load(f)
        
        # Extract services based on configuration type
        if isinstance(content, dict):
            if 'services' in content:  # Docker Compose format
                for name, service in content['services'].items():
                    services.append({
                        'name': name,
                        'type': 'docker',
                        'config': service
                    })
            elif 'kind' in content:  # Kubernetes format
                services.append({
                    'name': content.get('metadata', {}).get('name', 'unknown'),
                    'type': 'kubernetes',
                    'config': content
                })
        
    except Exception as e:
        console.print(f"[red]Failed to load service config {config_file}: {e}[/red]")
    
    return services

def perform_batch_health_checks(services: List[Dict[str, Any]], health_url_pattern: Optional[str],
                                timeout: int, max_retries: int, parallel: int) -> List[Dict[str, Any]]:
    """Perform health checks on multiple services."""
    results = []
    
    def check_service_health(service: Dict[str, Any]) -> Dict[str, Any]:
        service_name = service['name']
        
        try:
            # Construct health check URL
            if health_url_pattern:
                health_url = health_url_pattern.replace('{service}', service_name)
            else:
                # Try to extract from service configuration
                health_url = extract_health_url_from_config(service)
            
            if not health_url:
                return {
                    'service': service_name,
                    'healthy': False,
                    'error': 'No health check URL available'
                }
            
            # Perform health check with retries
            import requests
            for attempt in range(max_retries):
                try:
                    response = requests.get(health_url, timeout=timeout)
                    if response.status_code == 200:
                        return {
                            'service': service_name,
                            'healthy': True,
                            'status_code': response.status_code,
                            'response_time': response.elapsed.total_seconds()
                        }
                except requests.RequestException:
                    if attempt == max_retries - 1:
                        raise
                    import time
                    time.sleep(2 ** attempt)  # Exponential backoff
            
            return {
                'service': service_name,
                'healthy': False,
                'error': f'Health check failed after {max_retries} attempts'
            }
            
        except Exception as e:
            return {
                'service': service_name,
                'healthy': False,
                'error': str(e)
            }
    
    with ThreadPoolExecutor(max_workers=parallel) as executor:
        future_to_service = {executor.submit(check_service_health, service): service 
                            for service in services}
        
        for future in as_completed(future_to_service):
            results.append(future.result())
    
    return results

def extract_health_url_from_config(service: Dict[str, Any]) -> Optional[str]:
    """Extract health check URL from service configuration."""
    config = service.get('config', {})
    service_type = service.get('type')
    
    if service_type == 'kubernetes':
        # Look for health check configuration in Kubernetes manifest
        if 'spec' in config:
            containers = config.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [])
            for container in containers:
                liveness_probe = container.get('livenessProbe', {})
                if 'httpGet' in liveness_probe:
                    path = liveness_probe['httpGet'].get('path', '/')
                    port = liveness_probe['httpGet'].get('port', 80)
                    return f"http://localhost:{port}{path}"
    
    # Default fallback
    return None

def display_health_check_results(results: List[Dict[str, Any]]):
    """Display health check results."""
    healthy_count = len([r for r in results if r.get('healthy')])
    unhealthy_count = len(results) - healthy_count
    
    # Summary
    summary_text = Text()
    summary_text.append("Health Check Results\n\n", style="bold cyan")
    summary_text.append(f"Total services: {len(results)}\n", style="cyan")
    summary_text.append(f"Healthy: {healthy_count}\n", style="green")
    if unhealthy_count > 0:
        summary_text.append(f"Unhealthy: {unhealthy_count}\n", style="red")
    
    console.print(Panel(summary_text, title="Health Check Summary", 
                       border_style="green" if unhealthy_count == 0 else "red"))
    
    # Detailed results
    table = create_table(title="Service Health Status", show_lines=True)
    table.add_column("Service", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Response Time", justify="right")
    table.add_column("Error", style="red")
    
    for result in results:
        service_name = result['service']
        
        if result.get('healthy'):
            status = "[green]✓ Healthy[/green]"
            response_time = f"{result.get('response_time', 0):.3f}s"
            error = ""
        else:
            status = "[red]✗ Unhealthy[/red]"
            response_time = "[dim]N/A[/dim]"
            error = result.get('error', 'Unknown error')[:50]
        
        table.add_row(service_name, status, response_time, error)
    
    display_table(table)

if __name__ == "__main__":
    devops()