import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
import requests
import json

console = Console()

@click.group()
def ml():
    """ML operations - pipelines, training, predictions, model registry."""
    pass

@ml.command()
@click.argument('name')
@click.option('--config', type=click.Path(exists=True), required=True)
@click.option('--auto-start', is_flag=True)
@click.pass_context
def create_pipeline(ctx, name, config, auto_start):
    """Create ML pipeline."""
    console.print(f"[cyan]Creating ML pipeline: {name}[/cyan]")

@ml.command()
@click.argument('pipeline_id')
@click.option('--config', type=click.Path(exists=True))
@click.option('--watch', is_flag=True)
@click.pass_context
def train(ctx, pipeline_id, config, watch):
    """Train ML model."""
    console.print(f"[cyan]Training pipeline: {pipeline_id}[/cyan]")

@ml.command()
@click.argument('model_id')
@click.option('--environment', type=click.Choice(['dev', 'staging', 'production']), default='production')
@click.option('--replicas', type=int, default=3, help='Number of replicas to deploy')
@click.option('--strategy', type=click.Choice(['rolling', 'canary', 'blue-green']), default='rolling')
@click.pass_context
def deploy(ctx, model_id, environment, replicas, strategy):
    """Deploy ML model (Phase 2 integration)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        progress.add_task(f"Deploying model {model_id} to {environment} with {strategy} strategy...", total=None)

        try:
            response = client.post(f"/api/ml/models/{model_id}/deploy", json={
                "environment": environment,
                "replicas": replicas,
                "strategy": strategy
            })
            console.print(f"[green]✓[/green] Model deployed to {environment} with {replicas} replicas")
        except Exception as e:
            console.print(f"[red]Deployment failed: {e}[/red]")

@ml.command()
@click.argument('endpoint')
@click.argument('data_file', type=click.Path(exists=True))
@click.option('--output', type=click.Path())
@click.pass_context
def predict(ctx, endpoint, data_file, output):
    """Make predictions using deployed model."""
    console.print(f"[cyan]Making predictions...[/cyan]")

@ml.command()
@click.pass_context
def list_pipelines(ctx):
    """List ML pipelines."""
    console.print("[cyan]Listing ML pipelines...[/cyan]")

# Phase 2: Model Registry Commands
@ml.command(name='registry-list')
@click.option('--filter', type=str, help='Filter models by name/tag')
@click.option('--limit', type=int, default=20, help='Max models to display')
@click.pass_context
def registry_list(ctx, filter, limit):
    """List models in registry (Phase 2)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    try:
        response = client.get(f"/api/ml/registry", params={"filter": filter, "limit": limit})
        models = response.json().get('models', [])

        table = Table(title=f"Model Registry ({len(models)} models)")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Version", style="yellow")
        table.add_column("Status", style="magenta")
        table.add_column("Updated", style="dim")

        for model in models:
            table.add_row(
                model.get('id', 'N/A'),
                model.get('name', 'N/A'),
                model.get('version', 'N/A'),
                model.get('status', 'N/A'),
                model.get('updated_at', 'N/A')
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]Failed to fetch registry: {e}[/red]")

@ml.command(name='registry-upload')
@click.argument('model_path', type=click.Path(exists=True))
@click.option('--name', required=True, help='Model name')
@click.option('--version', required=True, help='Model version')
@click.option('--framework', type=click.Choice(['pytorch', 'tensorflow', 'onnx', 'scikit-learn']), required=True)
@click.option('--metadata', type=str, help='JSON metadata')
@click.pass_context
def registry_upload(ctx, model_path, name, version, framework, metadata):
    """Upload model to registry (Phase 2)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        progress.add_task(f"Uploading {name}:{version}...", total=None)

        try:
            with open(model_path, 'rb') as f:
                files = {'model': f}
                data = {
                    'name': name,
                    'version': version,
                    'framework': framework,
                    'metadata': metadata or '{}'
                }
                response = client.post("/api/ml/registry/upload", files=files, data=data)

            console.print(f"[green]✓[/green] Model {name}:{version} uploaded successfully")
            console.print(f"Model ID: {response.json().get('model_id')}")
        except Exception as e:
            console.print(f"[red]Upload failed: {e}[/red]")

@ml.command(name='hot-reload')
@click.argument('model_id')
@click.option('--version', help='New version to load')
@click.pass_context
def hot_reload(ctx, model_id, version):
    """Hot reload model without downtime (Phase 2)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        progress.add_task(f"Hot reloading model {model_id}...", total=None)

        try:
            response = client.post(f"/api/ml/models/{model_id}/hot-reload", json={"version": version})
            console.print(f"[green]✓[/green] Model {model_id} hot reloaded")
            console.print(f"Active version: {response.json().get('active_version')}")
            console.print(f"Load time: {response.json().get('load_time_ms')}ms")
        except Exception as e:
            console.print(f"[red]Hot reload failed: {e}[/red]")
