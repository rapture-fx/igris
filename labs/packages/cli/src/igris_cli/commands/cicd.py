"""
CI/CD pipeline integration commands for Igris-engine CLI.
Supports GitHub Actions, GitLab CI, Jenkins, and other CI/CD systems.
"""

import os
import sys
import yaml
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import tempfile
import zipfile

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt, Confirm
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
def cicd():
    """CI/CD pipeline integration and automation commands."""
    pass

@cicd.command()
@click.argument('project_path', type=click.Path(exists=True))
@click.option(
    '--provider',
    type=click.Choice(['github', 'gitlab', 'jenkins', 'azure', 'circleci']),
    required=True,
    help='CI/CD provider'
)
@click.option(
    '--template',
    type=click.Choice(['data-pipeline', 'ml-training', 'api-deployment', 'batch-processing', 'custom']),
    default='data-pipeline',
    help='Pipeline template to use'
)
@click.option(
    '--environments', '-e',
    multiple=True,
    help='Target environments (dev, staging, production)'
)
@click.option(
    '--triggers',
    multiple=True,
    help='Pipeline triggers (push, pull_request, schedule)'
)
@click.option(
    '--config-file', '-c',
    type=click.Path(exists=True),
    help='Custom pipeline configuration file'
)
@click.option(
    '--dry-run',
    is_flag=True,
    help='Generate pipeline files without creating them'
)
@click.pass_context
@handle_exceptions
def setup_pipeline(ctx, project_path: str, provider: str, template: str, 
                   environments: tuple, triggers: tuple, config_file: Optional[str], dry_run: bool):
    """
    Setup CI/CD pipeline for a project with Igris-engine integration.
    
    Examples:
        igris cicd setup-pipeline ./my-project --provider github --template ml-training
        igris cicd setup-pipeline ./api --provider gitlab --environments dev staging prod
        igris cicd setup-pipeline ./data --provider jenkins --triggers push schedule
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    project_dir = validate_directory_path(project_path)
    
    # Load custom config if provided
    pipeline_config = load_pipeline_template(template, config_file)
    
    # Set environments and triggers
    if environments:
        pipeline_config['environments'] = list(environments)
    if triggers:
        pipeline_config['triggers'] = list(triggers)
    
    # Display pipeline configuration
    display_pipeline_setup_plan(project_dir, provider, pipeline_config)
    
    if dry_run:
        console.print("[green]✓ Pipeline configuration is valid[/green]")
        return
    
    if not Confirm.ask("Create CI/CD pipeline configuration?", default=True):
        console.print("Pipeline setup cancelled")
        return
    
    # Generate pipeline files
    with Timer("Pipeline setup"):
        try:
            pipeline_files = generate_pipeline_files(project_dir, provider, pipeline_config)
            
            console.print(f"[green]✓ Successfully created {len(pipeline_files)} pipeline files[/green]")
            
            # Display created files
            for file_path in pipeline_files:
                console.print(f"  [cyan]Created:[/cyan] {file_path.relative_to(project_dir)}")
            
            # Provide next steps
            show_pipeline_next_steps(provider, pipeline_files)
            
        except Exception as e:
            console.print(f"[red]Pipeline setup failed: {e}[/red]")
            sys.exit(1)

@cicd.command()
@click.argument('pipeline_config', type=click.Path(exists=True))
@click.option(
    '--environment', '-e',
    help='Target environment'
)
@click.option(
    '--branch', '-b',
    help='Git branch to trigger from'
)
@click.option(
    '--parameters', '-p',
    multiple=True,
    help='Pipeline parameters (key=value pairs)'
)
@click.option(
    '--wait',
    is_flag=True,
    help='Wait for pipeline completion'
)
@click.option(
    '--timeout',
    type=click.IntRange(1, 3600),
    default=1800,
    help='Timeout in seconds (for --wait)'
)
@click.pass_context
@handle_exceptions
def trigger(ctx, pipeline_config: str, environment: Optional[str], branch: Optional[str],
            parameters: tuple, wait: bool, timeout: int):
    """
    Trigger a CI/CD pipeline programmatically.
    
    Examples:
        igris cicd trigger .github/workflows/deploy.yml --environment production
        igris cicd trigger .gitlab-ci.yml --branch main --wait
        igris cicd trigger pipeline.yml --parameters "VERSION=1.2.3" "ENV=staging"
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    config_path = validate_file_path(pipeline_config)
    
    # Parse parameters
    pipeline_params = {}
    for param in parameters:
        if '=' in param:
            key, value = param.split('=', 1)
            pipeline_params[key.strip()] = value.strip()
    
    # Determine provider from config file
    provider = detect_pipeline_provider(config_path)
    if not provider:
        console.print("[red]Could not determine CI/CD provider from config file[/red]")
        sys.exit(1)
    
    console.print(f"[cyan]Triggering {provider} pipeline: {config_path.name}[/cyan]")
    
    if pipeline_params:
        console.print("[cyan]Parameters:[/cyan]")
        for key, value in pipeline_params.items():
            console.print(f"  {key} = {value}")
    
    # Trigger pipeline
    with operation_spinner("Triggering pipeline", "Sending trigger request...") as spinner:
        try:
            pipeline_run = trigger_pipeline_execution(
                provider, config_path, environment, branch, pipeline_params
            )
            
            run_id = pipeline_run.get('id')
            run_url = pipeline_run.get('url')
            
            spinner.stop(f"Pipeline triggered successfully!")
            console.print(f"Run ID: [cyan]{run_id}[/cyan]")
            if run_url:
                console.print(f"URL: [blue]{run_url}[/blue]")
            
            if wait:
                console.print(f"[cyan]Waiting for pipeline completion (timeout: {timeout}s)...[/cyan]")
                result = wait_for_pipeline_completion(provider, run_id, timeout)
                
                if result['completed']:
                    if result['success']:
                        console.print("[green]✓ Pipeline completed successfully[/green]")
                    else:
                        console.print(f"[red]✗ Pipeline failed: {result.get('error', 'Unknown error')}[/red]")
                        sys.exit(1)
                else:
                    console.print("[yellow]⚠ Pipeline did not complete within timeout[/yellow]")
            
        except Exception as e:
            spinner.fail(f"Failed to trigger pipeline: {e}")
            sys.exit(1)

@cicd.command()
@click.option(
    '--provider',
    type=click.Choice(['github', 'gitlab', 'jenkins', 'azure', 'circleci']),
    help='Filter by CI/CD provider'
)
@click.option(
    '--status',
    type=click.Choice(['running', 'completed', 'failed', 'cancelled']),
    help='Filter by status'
)
@click.option(
    '--limit', '-l',
    type=click.IntRange(1, 100),
    default=20,
    help='Maximum number of runs to show'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch for updates with live refresh'
)
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.pass_context
@handle_exceptions
def list_runs(ctx, provider: Optional[str], status: Optional[str], limit: int, watch: bool, json: bool):
    """
    List recent CI/CD pipeline runs.
    
    Examples:
        igris cicd list-runs --provider github --status running
        igris cicd list-runs --limit 50 --watch
        igris cicd list-runs --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if watch:
        watch_pipeline_runs(provider, status, limit)
    else:
        show_pipeline_runs(provider, status, limit, json)

@cicd.command()
@click.argument('run_id')
@click.option(
    '--provider',
    type=click.Choice(['github', 'gitlab', 'jenkins', 'azure', 'circleci']),
    help='CI/CD provider (auto-detected if not specified)'
)
@click.option(
    '--logs',
    is_flag=True,
    help='Show detailed logs'
)
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.pass_context
@handle_exceptions
def status(ctx, run_id: str, provider: Optional[str], logs: bool, json: bool):
    """
    Get detailed status of a specific pipeline run.
    
    Examples:
        igris cicd status 123456789 --provider github
        igris cicd status run-abc123 --logs
        igris cicd status 987654321 --json
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    if not provider:
        provider = auto_detect_provider()
    
    with operation_spinner("Fetching pipeline status", "Loading run details..."):
        try:
            run_data = get_pipeline_run_details(provider, run_id, include_logs=logs)
        except Exception as e:
            console.print(f"[red]Failed to get pipeline status: {e}[/red]")
            sys.exit(1)
    
    if json:
        console.print(json.dumps(run_data, indent=2))
    else:
        display_pipeline_run_details(run_data, logs)

@cicd.command()
@click.argument('source_dir', type=click.Path(exists=True))
@click.option(
    '--output', '-o',
    type=click.Path(),
    help='Output package file'
)
@click.option(
    '--include-config',
    is_flag=True,
    help='Include pipeline configuration files'
)
@click.option(
    '--exclude',
    multiple=True,
    help='Exclude patterns (glob format)'
)
@click.option(
    '--compress',
    is_flag=True,
    help='Compress the deployment package'
)
@click.pass_context
@handle_exceptions
def package(ctx, source_dir: str, output: Optional[str], include_config: bool,
            exclude: tuple, compress: bool):
    """
    Create deployment package for CI/CD pipeline.
    
    Examples:
        igris cicd package ./src --output deployment.zip --compress
        igris cicd package ./app --include-config --exclude "*.log" "*.tmp"
    """
    config = ctx.obj.get('config') or Config()
    
    source_path = validate_directory_path(source_dir)
    
    if not output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = f"deployment_package_{timestamp}"
        if compress:
            output += ".zip"
        else:
            output += ".tar.gz"
    
    output_path = Path(output)
    
    console.print(f"[cyan]Creating deployment package from {source_path}[/cyan]")
    console.print(f"[cyan]Output: {output_path}[/cyan]")
    
    with Timer("Package creation"):
        try:
            package_info = create_deployment_package(
                source_path, output_path, include_config, exclude, compress
            )
            
            console.print(f"[green]✓ Package created successfully[/green]")
            console.print(f"Size: {package_info['size_mb']:.2f} MB")
            console.print(f"Files: {package_info['file_count']}")
            
            if package_info.get('excluded_files'):
                console.print(f"Excluded: {len(package_info['excluded_files'])} files")
            
        except Exception as e:
            console.print(f"[red]Package creation failed: {e}[/red]")
            sys.exit(1)

@cicd.command()
@click.argument('test_configs', nargs=-1)
@click.option(
    '--provider',
    type=click.Choice(['github', 'gitlab', 'jenkins', 'azure', 'circleci']),
    help='CI/CD provider to validate for'
)
@click.option(
    '--fix-issues',
    is_flag=True,
    help='Automatically fix common issues'
)
@click.option(
    '--output-format',
    type=click.Choice(['table', 'json']),
    default='table',
    help='Output format'
)
@click.pass_context
@handle_exceptions
def validate(ctx, test_configs: tuple, provider: Optional[str], fix_issues: bool, output_format: str):
    """
    Validate CI/CD pipeline configurations.
    
    Examples:
        igris cicd validate .github/workflows/*.yml --provider github
        igris cicd validate .gitlab-ci.yml --fix-issues
        igris cicd validate pipeline1.yml pipeline2.yml --output-format json
    """
    config = ctx.obj.get('config') or Config()
    
    if not test_configs:
        # Auto-discover pipeline configs in current directory
        test_configs = discover_pipeline_configs(Path.cwd())
    
    if not test_configs:
        console.print("[yellow]No pipeline configuration files found[/yellow]")
        return
    
    console.print(f"[cyan]Validating {len(test_configs)} pipeline configuration(s)[/cyan]")
    
    validation_results = []
    
    for config_file in track(test_configs, description="Validating..."):
        try:
            config_path = Path(config_file)
            if not config_path.exists():
                console.print(f"[yellow]Warning: {config_file} not found[/yellow]")
                continue
            
            result = validate_pipeline_config(config_path, provider, fix_issues)
            validation_results.append(result)
            
        except Exception as e:
            validation_results.append({
                'file': config_file,
                'valid': False,
                'errors': [str(e)],
                'warnings': [],
                'fixed_issues': []
            })
    
    # Display results
    if output_format == 'json':
        console.print(json.dumps(validation_results, indent=2))
    else:
        display_validation_results(validation_results, fix_issues)

def load_pipeline_template(template: str, config_file: Optional[str]) -> Dict[str, Any]:
    """Load pipeline configuration template."""
    if config_file:
        try:
            with open(config_file, 'r') as f:
                if config_file.endswith(('.yml', '.yaml')):
                    return yaml.safe_load(f)
                else:
                    return json.load(f)
        except Exception as e:
            console.print(f"[red]Failed to load config file: {e}[/red]")
            sys.exit(1)
    
    # Built-in templates
    templates = {
        'data-pipeline': {
            'name': 'Igris-engine Data Pipeline',
            'environments': ['dev', 'staging', 'production'],
            'triggers': ['push', 'pull_request'],
            'steps': [
                {'name': 'setup', 'action': 'setup-python'},
                {'name': 'install', 'action': 'install-dependencies'},
                {'name': 'validate', 'action': 'validate-data'},
                {'name': 'process', 'action': 'process-data'},
                {'name': 'test', 'action': 'run-tests'},
                {'name': 'deploy', 'action': 'deploy-pipeline'}
            ]
        },
        'ml-training': {
            'name': 'Igris-engine ML Training',
            'environments': ['dev', 'staging', 'production'],
            'triggers': ['push', 'schedule'],
            'steps': [
                {'name': 'setup', 'action': 'setup-python'},
                {'name': 'install', 'action': 'install-dependencies'},
                {'name': 'prepare-data', 'action': 'prepare-training-data'},
                {'name': 'train', 'action': 'train-model'},
                {'name': 'evaluate', 'action': 'evaluate-model'},
                {'name': 'deploy', 'action': 'deploy-model'}
            ]
        },
        'api-deployment': {
            'name': 'Igris-engine API Deployment',
            'environments': ['dev', 'staging', 'production'],
            'triggers': ['push'],
            'steps': [
                {'name': 'setup', 'action': 'setup-environment'},
                {'name': 'build', 'action': 'build-application'},
                {'name': 'test', 'action': 'run-tests'},
                {'name': 'security-scan', 'action': 'security-scan'},
                {'name': 'deploy', 'action': 'deploy-api'}
            ]
        },
        'batch-processing': {
            'name': 'Igris-engine Batch Processing',
            'environments': ['dev', 'production'],
            'triggers': ['schedule'],
            'steps': [
                {'name': 'setup', 'action': 'setup-environment'},
                {'name': 'fetch-data', 'action': 'fetch-source-data'},
                {'name': 'process', 'action': 'batch-process-data'},
                {'name': 'validate', 'action': 'validate-results'},
                {'name': 'store', 'action': 'store-results'}
            ]
        }
    }
    
    return templates.get(template, templates['data-pipeline'])

def display_pipeline_setup_plan(project_dir: Path, provider: str, config: Dict[str, Any]):
    """Display pipeline setup plan."""
    plan_text = Text()
    plan_text.append(f"CI/CD Pipeline Setup Plan\n\n", style="bold cyan")
    plan_text.append(f"Project: {project_dir.name}\n", style="white")
    plan_text.append(f"Provider: {provider}\n", style="white")
    plan_text.append(f"Template: {config.get('name', 'Unknown')}\n", style="white")
    
    if config.get('environments'):
        environments = ', '.join(config['environments'])
        plan_text.append(f"Environments: {environments}\n", style="yellow")
    
    if config.get('triggers'):
        triggers = ', '.join(config['triggers'])
        plan_text.append(f"Triggers: {triggers}\n", style="yellow")
    
    plan_text.append(f"\nPipeline Steps:\n", style="bold yellow")
    for i, step in enumerate(config.get('steps', []), 1):
        plan_text.append(f"  {i}. {step['name']} ({step['action']})\n", style="white")
    
    console.print(Panel(plan_text, title="Setup Plan", border_style="blue"))

def generate_pipeline_files(project_dir: Path, provider: str, config: Dict[str, Any]) -> List[Path]:
    """Generate CI/CD pipeline configuration files."""
    files_created = []
    
    if provider == 'github':
        files_created.extend(generate_github_actions_workflow(project_dir, config))
    elif provider == 'gitlab':
        files_created.extend(generate_gitlab_ci_config(project_dir, config))
    elif provider == 'jenkins':
        files_created.extend(generate_jenkins_pipeline(project_dir, config))
    elif provider == 'azure':
        files_created.extend(generate_azure_pipeline(project_dir, config))
    elif provider == 'circleci':
        files_created.extend(generate_circleci_config(project_dir, config))
    
    return files_created

def generate_github_actions_workflow(project_dir: Path, config: Dict[str, Any]) -> List[Path]:
    """Generate GitHub Actions workflow files."""
    workflows_dir = project_dir / '.github' / 'workflows'
    workflows_dir.mkdir(parents=True, exist_ok=True)
    
    workflow_config = {
        'name': config.get('name', 'Igris-engine Pipeline'),
        'on': {},
        'jobs': {}
    }
    
    # Configure triggers
    triggers = config.get('triggers', ['push'])
    if 'push' in triggers:
        workflow_config['on']['push'] = {'branches': ['main', 'develop']}
    if 'pull_request' in triggers:
        workflow_config['on']['pull_request'] = {'branches': ['main']}
    if 'schedule' in triggers:
        workflow_config['on']['schedule'] = [{'cron': '0 2 * * *'}]  # Daily at 2 AM
    
    # Create jobs for each environment
    for env in config.get('environments', ['dev']):
        job_steps = []
        
        # Add checkout step
        job_steps.append({
            'name': 'Checkout code',
            'uses': 'actions/checkout@v4'
        })
        
        # Add steps from config
        for step in config.get('steps', []):
            job_steps.append(convert_step_to_github_action(step, env))
        
        workflow_config['jobs'][f'deploy-{env}'] = {
            'runs-on': 'ubuntu-latest',
            'environment': env,
            'steps': job_steps
        }
    
    # Write workflow file
    workflow_file = workflows_dir / 'igris-inertial-pipeline.yml'
    with open(workflow_file, 'w') as f:
        yaml.dump(workflow_config, f, default_flow_style=False, sort_keys=False)
    
    return [workflow_file]

def generate_gitlab_ci_config(project_dir: Path, config: Dict[str, Any]) -> List[Path]:
    """Generate GitLab CI configuration."""
    gitlab_config = {
        'stages': ['build', 'test', 'deploy'],
        'variables': {
            'IGRIS_VERSION': 'latest'
        }
    }
    
    # Add jobs for each environment
    for env in config.get('environments', ['dev']):
        for step in config.get('steps', []):
            job_name = f"{step['name']}-{env}"
            gitlab_config[job_name] = {
                'stage': get_gitlab_stage(step['action']),
                'environment': {'name': env},
                'script': [convert_step_to_gitlab_script(step, env)],
                'only': ['main'] if env == 'production' else ['develop', 'main']
            }
    
    # Write .gitlab-ci.yml file
    gitlab_file = project_dir / '.gitlab-ci.yml'
    with open(gitlab_file, 'w') as f:
        yaml.dump(gitlab_config, f, default_flow_style=False, sort_keys=False)
    
    return [gitlab_file]

def generate_jenkins_pipeline(project_dir: Path, config: Dict[str, Any]) -> List[Path]:
    """Generate Jenkins pipeline configuration."""
    jenkinsfile_content = f"""
pipeline {{
    agent any
    
    environment {{
        IGRIS_API_KEY = credentials('igris-inertial-api-key')
    }}
    
    stages {{"""
    
    for step in config.get('steps', []):
        stage_name = step['name'].replace('-', ' ').title()
        jenkinsfile_content += f"""
        stage('{stage_name}') {{
            steps {{
                {convert_step_to_jenkins_script(step)}
            }}
        }}"""
    
    jenkinsfile_content += """
    }
    
    post {
        always {
            cleanWs()
        }
        failure {
            emailext body: 'Pipeline failed', subject: 'Igris-engine Pipeline Failure', to: '$DEFAULT_RECIPIENTS'
        }
    }
}
"""
    
    # Write Jenkinsfile
    jenkins_file = project_dir / 'Jenkinsfile'
    with open(jenkins_file, 'w') as f:
        f.write(jenkinsfile_content)
    
    return [jenkins_file]

def generate_azure_pipeline(project_dir: Path, config: Dict[str, Any]) -> List[Path]:
    """Generate Azure DevOps pipeline configuration."""
    azure_config = {
        'trigger': ['main', 'develop'],
        'pool': {'vmImage': 'ubuntu-latest'},
        'variables': {
            'igrisEngineVersion': 'latest'
        },
        'stages': []
    }
    
    for env in config.get('environments', ['dev']):
        stage = {
            'stage': f'Deploy{env.title()}',
            'displayName': f'Deploy to {env.title()}',
            'jobs': [{
                'job': f'deploy_{env}',
                'displayName': f'Deploy {env}',
                'steps': []
            }]
        }
        
        for step in config.get('steps', []):
            stage['jobs'][0]['steps'].append(convert_step_to_azure_task(step, env))
        
        azure_config['stages'].append(stage)
    
    # Write azure-pipelines.yml file
    azure_file = project_dir / 'azure-pipelines.yml'
    with open(azure_file, 'w') as f:
        yaml.dump(azure_config, f, default_flow_style=False, sort_keys=False)
    
    return [azure_file]

def generate_circleci_config(project_dir: Path, config: Dict[str, Any]) -> List[Path]:
    """Generate CircleCI configuration."""
    circleci_dir = project_dir / '.circleci'
    circleci_dir.mkdir(exist_ok=True)
    
    circleci_config = {
        'version': 2.1,
        'orbs': {
            'python': 'circleci/python@2.1.1'
        },
        'workflows': {
            'igris-inertial-pipeline': {
                'jobs': []
            }
        },
        'jobs': {}
    }
    
    for env in config.get('environments', ['dev']):
        job_name = f'deploy-{env}'
        
        job_steps = []
        for step in config.get('steps', []):
            job_steps.append(convert_step_to_circleci_step(step, env))
        
        circleci_config['jobs'][job_name] = {
            'docker': [{'image': 'cimg/python:3.9'}],
            'steps': [
                'checkout'
            ] + job_steps
        }
        
        circleci_config['workflows']['igris-inertial-pipeline']['jobs'].append({
            job_name: {
                'context': f'igris-inertial-{env}',
                'filters': {
                    'branches': {
                        'only': ['main'] if env == 'production' else ['develop', 'main']
                    }
                }
            }
        })
    
    # Write config.yml file
    circleci_file = circleci_dir / 'config.yml'
    with open(circleci_file, 'w') as f:
        yaml.dump(circleci_config, f, default_flow_style=False, sort_keys=False)
    
    return [circleci_file]

def convert_step_to_github_action(step: Dict[str, Any], env: str) -> Dict[str, Any]:
    """Convert generic step to GitHub Actions step."""
    action = step['action']
    
    step_mapping = {
        'setup-python': {
            'name': 'Set up Python',
            'uses': 'actions/setup-python@v4',
            'with': {'python-version': '3.9'}
        },
        'install-dependencies': {
            'name': 'Install dependencies',
            'run': 'pip install -r requirements.txt && pip install igris-inertial-cli'
        },
        'validate-data': {
            'name': 'Validate data',
            'run': 'igris process batch "data/*.csv" --validate --dry-run'
        },
        'process-data': {
            'name': 'Process data',
            'run': f'igris process batch "data/*.csv" --parallel 4 --output-dir processed_{env}'
        },
        'train-model': {
            'name': 'Train ML model',
            'run': f'igris pipeline create config/ml-training-{env}.yml --auto-start'
        },
        'deploy-pipeline': {
            'name': 'Deploy pipeline',
            'run': f'igris devops deploy infrastructure/ --env {env}'
        }
    }
    
    return step_mapping.get(action, {
        'name': step.get('name', 'Unknown step'),
        'run': f'echo "Step {action} not implemented"'
    })

def convert_step_to_gitlab_script(step: Dict[str, Any], env: str) -> str:
    """Convert generic step to GitLab CI script."""
    action = step['action']
    
    script_mapping = {
        'setup-python': 'pip install --upgrade pip',
        'install-dependencies': 'pip install -r requirements.txt && pip install igris-inertial-cli',
        'validate-data': 'igris process batch "data/*.csv" --validate --dry-run',
        'process-data': f'igris process batch "data/*.csv" --parallel 4 --output-dir processed_{env}',
        'train-model': f'igris pipeline create config/ml-training-{env}.yml --auto-start',
        'deploy-pipeline': f'igris devops deploy infrastructure/ --env {env}'
    }
    
    return script_mapping.get(action, f'echo "Step {action} not implemented"')

def get_gitlab_stage(action: str) -> str:
    """Get GitLab CI stage for action."""
    stage_mapping = {
        'setup-python': 'build',
        'install-dependencies': 'build',
        'validate-data': 'test',
        'process-data': 'test',
        'train-model': 'deploy',
        'deploy-pipeline': 'deploy'
    }
    return stage_mapping.get(action, 'build')

def convert_step_to_jenkins_script(step: Dict[str, Any]) -> str:
    """Convert generic step to Jenkins pipeline script."""
    action = step['action']
    
    script_mapping = {
        'setup-python': 'sh "python --version"',
        'install-dependencies': 'sh "pip install -r requirements.txt && pip install igris-inertial-cli"',
        'validate-data': 'sh "igris process batch \\"data/*.csv\\" --validate --dry-run"',
        'process-data': 'sh "igris process batch \\"data/*.csv\\" --parallel 4"',
        'train-model': 'sh "igris pipeline create config/ml-training.yml --auto-start"',
        'deploy-pipeline': 'sh "igris devops deploy infrastructure/ --env ${env}"'
    }
    
    return script_mapping.get(action, f'sh "echo Step {action} not implemented"')

def convert_step_to_azure_task(step: Dict[str, Any], env: str) -> Dict[str, Any]:
    """Convert generic step to Azure DevOps task."""
    action = step['action']
    
    task_mapping = {
        'setup-python': {
            'task': 'UsePythonVersion@0',
            'inputs': {'versionSpec': '3.9'}
        },
        'install-dependencies': {
            'script': 'pip install -r requirements.txt && pip install igris-inertial-cli',
            'displayName': 'Install dependencies'
        },
        'validate-data': {
            'script': 'igris process batch "data/*.csv" --validate --dry-run',
            'displayName': 'Validate data'
        },
        'process-data': {
            'script': f'igris process batch "data/*.csv" --parallel 4 --output-dir processed_{env}',
            'displayName': 'Process data'
        }
    }
    
    return task_mapping.get(action, {
        'script': f'echo "Step {action} not implemented"',
        'displayName': step.get('name', 'Unknown step')
    })

def convert_step_to_circleci_step(step: Dict[str, Any], env: str) -> Dict[str, Any]:
    """Convert generic step to CircleCI step."""
    action = step['action']
    
    step_mapping = {
        'setup-python': {'python/install-packages': {'pkg-manager': 'pip'}},
        'install-dependencies': {
            'run': {
                'name': 'Install dependencies',
                'command': 'pip install -r requirements.txt && pip install igris-inertial-cli'
            }
        },
        'validate-data': {
            'run': {
                'name': 'Validate data',
                'command': 'igris process batch "data/*.csv" --validate --dry-run'
            }
        },
        'process-data': {
            'run': {
                'name': 'Process data',
                'command': f'igris process batch "data/*.csv" --parallel 4 --output-dir processed_{env}'
            }
        }
    }
    
    return step_mapping.get(action, {
        'run': {
            'name': step.get('name', 'Unknown step'),
            'command': f'echo "Step {action} not implemented"'
        }
    })

def show_pipeline_next_steps(provider: str, files: List[Path]):
    """Show next steps after pipeline creation."""
    next_steps_text = Text()
    next_steps_text.append("Next Steps\n\n", style="bold green")
    
    if provider == 'github':
        next_steps_text.append("1. Commit and push the workflow files to your GitHub repository\n", style="white")
        next_steps_text.append("2. Add IGRIS_API_KEY to your repository secrets\n", style="white")
        next_steps_text.append("3. Push to main/develop branch to trigger the workflow\n", style="white")
        next_steps_text.append("4. Monitor workflow runs at: https://github.com/[user]/[repo]/actions\n", style="blue")
    
    elif provider == 'gitlab':
        next_steps_text.append("1. Commit and push the .gitlab-ci.yml file to your GitLab repository\n", style="white")
        next_steps_text.append("2. Add IGRIS_API_KEY as a CI/CD variable\n", style="white")
        next_steps_text.append("3. Push to main/develop branch to trigger the pipeline\n", style="white")
        next_steps_text.append("4. Monitor pipeline runs in GitLab CI/CD section\n", style="blue")
    
    elif provider == 'jenkins':
        next_steps_text.append("1. Commit the Jenkinsfile to your repository\n", style="white")
        next_steps_text.append("2. Create 'igris-inertial-api-key' credential in Jenkins\n", style="white")
        next_steps_text.append("3. Create a new Pipeline job pointing to your repository\n", style="white")
        next_steps_text.append("4. Configure webhook or polling for automatic builds\n", style="white")
    
    console.print(Panel(next_steps_text, title="Setup Complete!", border_style="green"))

def detect_pipeline_provider(config_path: Path) -> Optional[str]:
    """Detect CI/CD provider from configuration file."""
    name = config_path.name.lower()
    parent_dirs = [p.name.lower() for p in config_path.parents]
    
    if '.github' in parent_dirs and 'workflows' in parent_dirs:
        return 'github'
    elif name == '.gitlab-ci.yml':
        return 'gitlab'
    elif name == 'jenkinsfile':
        return 'jenkins'
    elif name == 'azure-pipelines.yml':
        return 'azure'
    elif '.circleci' in parent_dirs:
        return 'circleci'
    
    return None

def auto_detect_provider() -> Optional[str]:
    """Auto-detect CI/CD provider from current directory."""
    current_dir = Path.cwd()
    
    # Check for common CI/CD configuration files
    if (current_dir / '.github' / 'workflows').exists():
        return 'github'
    elif (current_dir / '.gitlab-ci.yml').exists():
        return 'gitlab'
    elif (current_dir / 'Jenkinsfile').exists():
        return 'jenkins'
    elif (current_dir / 'azure-pipelines.yml').exists():
        return 'azure'
    elif (current_dir / '.circleci' / 'config.yml').exists():
        return 'circleci'
    
    return None

def trigger_pipeline_execution(provider: str, config_path: Path, environment: Optional[str],
                              branch: Optional[str], parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Trigger pipeline execution (placeholder implementation)."""
    # This would integrate with actual CI/CD APIs
    # For now, return mock data
    import uuid
    
    return {
        'id': str(uuid.uuid4()),
        'url': f'https://example.com/pipeline/run/{uuid.uuid4()}',
        'status': 'running',
        'provider': provider,
        'triggered_at': datetime.now().isoformat()
    }

def wait_for_pipeline_completion(provider: str, run_id: str, timeout: int) -> Dict[str, Any]:
    """Wait for pipeline completion."""
    # Placeholder implementation
    import time
    import random
    
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        # Simulate checking pipeline status
        time.sleep(5)
        
        # Randomly complete for demo
        if random.random() < 0.1:  # 10% chance per check
            return {
                'completed': True,
                'success': random.random() > 0.2,  # 80% success rate
                'duration': time.time() - start_time
            }
    
    return {
        'completed': False,
        'timeout': True
    }

def show_pipeline_runs(provider: Optional[str], status: Optional[str], limit: int, json_output: bool):
    """Show pipeline runs."""
    # Placeholder implementation - would integrate with actual CI/CD APIs
    runs = []
    
    for i in range(min(limit, 10)):
        runs.append({
            'id': f'run-{i+1}',
            'status': status or random.choice(['running', 'completed', 'failed']),
            'branch': 'main',
            'commit': f'abc123{i}',
            'started_at': '2024-01-01T12:00:00Z',
            'duration': 300 + i * 60
        })
    
    if json_output:
        console.print(json.dumps(runs, indent=2))
    else:
        display_pipeline_runs_table(runs)

def watch_pipeline_runs(provider: Optional[str], status: Optional[str], limit: int):
    """Watch pipeline runs with live updates."""
    console.print("[cyan]Watching pipeline runs (updating every 10s)[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        from rich.live import Live
        import time
        
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    # Get current runs (placeholder)
                    runs = []  # Would fetch from actual CI/CD API
                    
                    table = create_pipeline_runs_table(runs)
                    live.update(table, refresh=True)
                    
                    time.sleep(10)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error fetching runs: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching pipeline runs[/yellow]")

def get_pipeline_run_details(provider: str, run_id: str, include_logs: bool = False) -> Dict[str, Any]:
    """Get detailed pipeline run information."""
    # Placeholder implementation
    return {
        'id': run_id,
        'status': 'completed',
        'provider': provider,
        'branch': 'main',
        'commit': 'abc12345',
        'started_at': '2024-01-01T12:00:00Z',
        'completed_at': '2024-01-01T12:05:00Z',
        'duration': 300,
        'jobs': [
            {
                'name': 'build',
                'status': 'completed',
                'duration': 120
            },
            {
                'name': 'test',
                'status': 'completed',
                'duration': 90
            },
            {
                'name': 'deploy',
                'status': 'completed',
                'duration': 90
            }
        ],
        'logs': [
            'Starting pipeline...',
            'Building application...',
            'Running tests...',
            'Deploying to production...',
            'Pipeline completed successfully!'
        ] if include_logs else None
    }

def display_pipeline_run_details(run_data: Dict[str, Any], include_logs: bool):
    """Display detailed pipeline run information."""
    # Basic info
    info_text = Text()
    info_text.append(f"Pipeline Run: {run_data['id']}\n\n", style="bold cyan")
    info_text.append(f"Status: {run_data['status']}\n", style="white")
    info_text.append(f"Provider: {run_data['provider']}\n", style="white")
    info_text.append(f"Branch: {run_data['branch']}\n", style="white")
    info_text.append(f"Commit: {run_data['commit']}\n", style="white")
    
    console.print(Panel(info_text, title="Run Details", border_style="blue"))
    
    # Jobs table
    if 'jobs' in run_data:
        jobs_table = create_table(title="Jobs", show_lines=True)
        jobs_table.add_column("Job", style="bold")
        jobs_table.add_column("Status", justify="center")
        jobs_table.add_column("Duration", justify="right")
        
        for job in run_data['jobs']:
            status = job['status']
            if status == 'completed':
                status_display = "[green]✓ Completed[/green]"
            elif status == 'running':
                status_display = "[blue]▶ Running[/blue]"
            elif status == 'failed':
                status_display = "[red]✗ Failed[/red]"
            else:
                status_display = f"[dim]{status}[/dim]"
            
            jobs_table.add_row(
                job['name'],
                status_display,
                format_duration(job['duration'])
            )
        
        display_table(jobs_table)
    
    # Show logs if requested
    if include_logs and run_data.get('logs'):
        console.print("\n[cyan]Pipeline Logs:[/cyan]")
        for log_line in run_data['logs']:
            console.print(f"[dim]{log_line}[/dim]")

def create_deployment_package(source_path: Path, output_path: Path, include_config: bool,
                             exclude_patterns: tuple, compress: bool) -> Dict[str, Any]:
    """Create deployment package."""
    import shutil
    import tarfile
    
    package_info = {
        'file_count': 0,
        'excluded_files': [],
        'size_mb': 0
    }
    
    if compress and output_path.suffix == '.zip':
        # Create ZIP package
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in source_path.rglob('*'):
                if file_path.is_file():
                    # Check exclusion patterns
                    if should_exclude_file(file_path, exclude_patterns):
                        package_info['excluded_files'].append(str(file_path))
                        continue
                    
                    # Skip CI/CD configs unless specifically included
                    if not include_config and is_cicd_config_file(file_path):
                        package_info['excluded_files'].append(str(file_path))
                        continue
                    
                    relative_path = file_path.relative_to(source_path)
                    zipf.write(file_path, relative_path)
                    package_info['file_count'] += 1
    
    else:
        # Create TAR.GZ package
        with tarfile.open(output_path, 'w:gz' if compress else 'w') as tarf:
            for file_path in source_path.rglob('*'):
                if file_path.is_file():
                    # Check exclusion patterns
                    if should_exclude_file(file_path, exclude_patterns):
                        package_info['excluded_files'].append(str(file_path))
                        continue
                    
                    # Skip CI/CD configs unless specifically included
                    if not include_config and is_cicd_config_file(file_path):
                        package_info['excluded_files'].append(str(file_path))
                        continue
                    
                    relative_path = file_path.relative_to(source_path)
                    tarf.add(file_path, relative_path)
                    package_info['file_count'] += 1
    
    # Get package size
    package_info['size_mb'] = output_path.stat().st_size / (1024 * 1024)
    
    return package_info

def should_exclude_file(file_path: Path, exclude_patterns: tuple) -> bool:
    """Check if file should be excluded based on patterns."""
    import fnmatch
    
    for pattern in exclude_patterns:
        if fnmatch.fnmatch(file_path.name, pattern) or fnmatch.fnmatch(str(file_path), pattern):
            return True
    
    return False

def is_cicd_config_file(file_path: Path) -> bool:
    """Check if file is a CI/CD configuration file."""
    cicd_patterns = [
        '.github/**',
        '.gitlab-ci.yml',
        'Jenkinsfile',
        'azure-pipelines.yml',
        '.circleci/**',
        'Dockerfile*',
        'docker-compose*.yml'
    ]
    
    return should_exclude_file(file_path, cicd_patterns)

def discover_pipeline_configs(directory: Path) -> List[str]:
    """Discover CI/CD pipeline configuration files in directory."""
    configs = []
    
    # GitHub Actions
    github_workflows = directory / '.github' / 'workflows'
    if github_workflows.exists():
        configs.extend(str(f) for f in github_workflows.glob('*.yml'))
        configs.extend(str(f) for f in github_workflows.glob('*.yaml'))
    
    # GitLab CI
    gitlab_ci = directory / '.gitlab-ci.yml'
    if gitlab_ci.exists():
        configs.append(str(gitlab_ci))
    
    # Jenkins
    jenkinsfile = directory / 'Jenkinsfile'
    if jenkinsfile.exists():
        configs.append(str(jenkinsfile))
    
    # Azure DevOps
    azure_pipelines = directory / 'azure-pipelines.yml'
    if azure_pipelines.exists():
        configs.append(str(azure_pipelines))
    
    # CircleCI
    circleci_config = directory / '.circleci' / 'config.yml'
    if circleci_config.exists():
        configs.append(str(circleci_config))
    
    return configs

def validate_pipeline_config(config_path: Path, provider: Optional[str], fix_issues: bool) -> Dict[str, Any]:
    """Validate pipeline configuration file."""
    result = {
        'file': str(config_path),
        'valid': True,
        'errors': [],
        'warnings': [],
        'fixed_issues': []
    }
    
    try:
        # Detect provider if not specified
        if not provider:
            provider = detect_pipeline_provider(config_path)
        
        # Load and parse configuration
        with open(config_path, 'r') as f:
            if config_path.suffix in ['.yml', '.yaml']:
                config = yaml.safe_load(f)
            else:
                config = json.load(f)
        
        # Provider-specific validation
        if provider == 'github':
            result.update(validate_github_workflow(config, config_path, fix_issues))
        elif provider == 'gitlab':
            result.update(validate_gitlab_ci(config, config_path, fix_issues))
        elif provider == 'jenkins':
            result.update(validate_jenkinsfile(config_path, fix_issues))
        
        # General validation
        if not result['errors']:
            result['warnings'].extend(check_general_pipeline_issues(config))
        
    except yaml.YAMLError as e:
        result['valid'] = False
        result['errors'].append(f"YAML syntax error: {e}")
    except json.JSONDecodeError as e:
        result['valid'] = False
        result['errors'].append(f"JSON syntax error: {e}")
    except Exception as e:
        result['valid'] = False
        result['errors'].append(f"Validation error: {e}")
    
    if result['errors']:
        result['valid'] = False
    
    return result

def validate_github_workflow(config: Dict[str, Any], config_path: Path, fix_issues: bool) -> Dict[str, str]:
    """Validate GitHub Actions workflow."""
    errors = []
    warnings = []
    fixed = []
    
    # Check required fields
    if 'name' not in config:
        errors.append("Missing 'name' field")
    
    if 'on' not in config:
        errors.append("Missing 'on' (triggers) field")
    
    if 'jobs' not in config:
        errors.append("Missing 'jobs' field")
    elif not config['jobs']:
        errors.append("No jobs defined")
    
    # Check for common issues
    for job_name, job in config.get('jobs', {}).items():
        if 'runs-on' not in job:
            errors.append(f"Job '{job_name}' missing 'runs-on'")
        
        if 'steps' not in job:
            warnings.append(f"Job '{job_name}' has no steps defined")
        
        # Check for security issues
        steps = job.get('steps', [])
        for i, step in enumerate(steps):
            if isinstance(step.get('run'), str) and 'curl' in step['run']:
                warnings.append(f"Job '{job_name}' step {i+1}: Consider using actions instead of curl")
    
    return {
        'errors': errors,
        'warnings': warnings,
        'fixed_issues': fixed
    }

def validate_gitlab_ci(config: Dict[str, Any], config_path: Path, fix_issues: bool) -> Dict[str, str]:
    """Validate GitLab CI configuration."""
    errors = []
    warnings = []
    fixed = []
    
    # Check stages
    if 'stages' not in config:
        warnings.append("No stages defined - using default stages")
    
    # Check jobs
    job_count = 0
    for key, value in config.items():
        if isinstance(value, dict) and 'script' in value:
            job_count += 1
            
            # Check for stage assignment
            if 'stage' not in value:
                warnings.append(f"Job '{key}' has no stage assigned")
    
    if job_count == 0:
        errors.append("No jobs found in configuration")
    
    return {
        'errors': errors,
        'warnings': warnings,
        'fixed_issues': fixed
    }

def validate_jenkinsfile(config_path: Path, fix_issues: bool) -> Dict[str, str]:
    """Validate Jenkinsfile."""
    errors = []
    warnings = []
    fixed = []
    
    try:
        with open(config_path, 'r') as f:
            content = f.read()
        
        # Basic syntax checks
        if 'pipeline {' not in content:
            errors.append("No pipeline block found")
        
        if 'agent' not in content:
            errors.append("No agent specified")
        
        if 'stages {' not in content:
            errors.append("No stages block found")
        
        # Check for balanced braces
        open_braces = content.count('{')
        close_braces = content.count('}')
        if open_braces != close_braces:
            errors.append(f"Unbalanced braces: {open_braces} open, {close_braces} close")
    
    except Exception as e:
        errors.append(f"Failed to read Jenkinsfile: {e}")
    
    return {
        'errors': errors,
        'warnings': warnings,
        'fixed_issues': fixed
    }

def check_general_pipeline_issues(config: Dict[str, Any]) -> List[str]:
    """Check for general pipeline configuration issues."""
    warnings = []
    
    # Check for hardcoded secrets
    config_str = json.dumps(config).lower()
    sensitive_patterns = ['password', 'secret', 'key', 'token']
    
    for pattern in sensitive_patterns:
        if pattern in config_str and 'env' not in config_str:
            warnings.append(f"Possible hardcoded {pattern} found - use environment variables instead")
    
    return warnings

def display_validation_results(results: List[Dict[str, Any]], fix_issues: bool):
    """Display validation results."""
    total_files = len(results)
    valid_files = len([r for r in results if r['valid']])
    invalid_files = total_files - valid_files
    
    # Summary
    summary_text = Text()
    summary_text.append("Pipeline Validation Results\n\n", style="bold cyan")
    summary_text.append(f"Total files: {total_files}\n", style="cyan")
    summary_text.append(f"Valid: {valid_files}\n", style="green")
    if invalid_files > 0:
        summary_text.append(f"Invalid: {invalid_files}\n", style="red")
    
    console.print(Panel(summary_text, title="Validation Summary", 
                       border_style="green" if invalid_files == 0 else "red"))
    
    # Detailed results
    for result in results:
        if not result['valid'] or result['warnings']:
            file_name = Path(result['file']).name
            
            if not result['valid']:
                console.print(f"\n[red]✗ {file_name}[/red]")
                for error in result['errors']:
                    console.print(f"  [red]Error:[/red] {error}")
            else:
                console.print(f"\n[yellow]⚠ {file_name}[/yellow]")
            
            for warning in result['warnings']:
                console.print(f"  [yellow]Warning:[/yellow] {warning}")
            
            if fix_issues and result['fixed_issues']:
                for fix in result['fixed_issues']:
                    console.print(f"  [green]Fixed:[/green] {fix}")

def display_pipeline_runs_table(runs: List[Dict[str, Any]]):
    """Display pipeline runs in table format."""
    table = create_table(title="Pipeline Runs", show_lines=True)
    table.add_column("Run ID", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Branch")
    table.add_column("Commit")
    table.add_column("Duration", justify="right")
    
    for run in runs:
        status = run['status']
        if status == 'completed':
            status_display = "[green]✓ Completed[/green]"
        elif status == 'running':
            status_display = "[blue]▶ Running[/blue]"
        elif status == 'failed':
            status_display = "[red]✗ Failed[/red]"
        else:
            status_display = f"[dim]{status}[/dim]"
        
        duration = format_duration(run.get('duration', 0)) if run.get('duration') else "[dim]N/A[/dim]"
        
        table.add_row(
            run['id'],
            status_display,
            run['branch'],
            run['commit'][:8],
            duration
        )
    
    display_table(table)

def create_pipeline_runs_table(runs: List[Dict[str, Any]]) -> Table:
    """Create pipeline runs table for live display."""
    table = create_table(title="Pipeline Runs (Live)", show_lines=True)
    table.add_column("Run ID", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Branch")
    table.add_column("Started", justify="right")
    
    for run in runs:
        status = run['status']
        if status == 'completed':
            status_display = "[green]✓ Completed[/green]"
        elif status == 'running':
            status_display = "[blue]▶ Running[/blue]"
        elif status == 'failed':
            status_display = "[red]✗ Failed[/red]"
        else:
            status_display = f"[dim]{status}[/dim]"
        
        table.add_row(
            run['id'],
            status_display,
            run['branch'],
            run.get('started_at', 'N/A')
        )
    
    return table

if __name__ == "__main__":
    cicd()