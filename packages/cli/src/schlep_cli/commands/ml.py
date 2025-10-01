import click
from rich.console import Console

console = Console()

@click.group()
def ml():
    """ML operations - pipelines, training, predictions."""
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
@click.pass_context
def deploy(ctx, model_id, environment):
    """Deploy ML model."""
    console.print(f"[cyan]Deploying model {model_id} to {environment}[/cyan]")

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
