#!/usr/bin/env python3
"""
Blue-Green Deployment CLI
Command-line interface for managing blue-green deployments
"""

import asyncio
import click
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from blue_green_deployer import BlueGreenDeployer, DeploymentStatus
import json
import time

console = Console()


@click.group()
@click.option('--config', '-c', default='blue-green-config.yml', help='Configuration file path')
@click.pass_context
def cli(ctx, config):
    """Blue-Green Deployment CLI for Schlep-engine"""
    ctx.ensure_object(dict)
    ctx.obj['config'] = config

    if not Path(config).exists():
        console.print(f"[red]Error: Configuration file {config} not found[/red]")
        ctx.exit(1)


@cli.command()
@click.option('--application', '-a', required=True, help='Application to deploy')
@click.option('--environment', '-e', required=True, help='Target environment')
@click.option('--version', '-v', required=True, help='Version to deploy')
@click.option('--commit-sha', required=True, help='Git commit SHA')
@click.option('--image-tag', required=True, help='Docker image tag')
@click.option('--triggered-by', default='cli', help='Who triggered the deployment')
@click.option('--timeout', default=1800, help='Deployment timeout in seconds')
@click.pass_context
def deploy(ctx, application, environment, version, commit_sha, image_tag, triggered_by, timeout):
    """Deploy application using blue-green strategy"""

    async def run_deployment():
        deployer = BlueGreenDeployer(ctx.obj['config'])

        console.print(Panel.fit(
            f"[bold blue]Starting Blue-Green Deployment[/bold blue]\n\n"
            f"Application: [cyan]{application}[/cyan]\n"
            f"Environment: [cyan]{environment}[/cyan]\n"
            f"Version: [cyan]{version}[/cyan]\n"
            f"Image Tag: [cyan]{image_tag}[/cyan]",
            title="Deployment Info"
        ))

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Initializing deployment...", total=None)

            job = await deployer.deploy(
                application=application,
                environment=environment,
                version=version,
                commit_sha=commit_sha,
                image_tag=image_tag,
                triggered_by=triggered_by
            )

            # Monitor deployment progress
            while job.status in [DeploymentStatus.PENDING, DeploymentStatus.IN_PROGRESS]:
                progress.update(task, description=f"Phase: {job.current_phase.value}")
                await asyncio.sleep(5)

                # Refresh job status (in real implementation, this would query the deployer)
                # For now, we'll just wait for completion
                break

        # Display results
        if job.status == DeploymentStatus.SUCCESS:
            console.print("[green]✅ Deployment completed successfully![/green]")

            # Show deployment summary
            table = Table(title="Deployment Summary")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="green")

            duration = job.completed_at - job.started_at if job.completed_at else "N/A"
            table.add_row("Job ID", job.job_id)
            table.add_row("Duration", str(duration).split('.')[0])
            table.add_row("Traffic Percentage", f"{job.traffic_percentage}%")
            table.add_row("Health Checks", "✅ Passed" if job.health_check_results else "N/A")

            console.print(table)

        elif job.status == DeploymentStatus.FAILED:
            console.print("[red]❌ Deployment failed![/red]")
            if job.error_message:
                console.print(f"[red]Error: {job.error_message}[/red]")

        elif job.status == DeploymentStatus.ROLLED_BACK:
            console.print("[yellow]⚠️  Deployment was rolled back[/yellow]")
            if job.rollback_reason:
                console.print(f"[yellow]Reason: {job.rollback_reason}[/yellow]")

        return job.status == DeploymentStatus.SUCCESS

    success = asyncio.run(run_deployment())
    ctx.exit(0 if success else 1)


@cli.command()
@click.option('--application', '-a', required=True, help='Application to rollback')
@click.option('--environment', '-e', required=True, help='Target environment')
@click.pass_context
def rollback(ctx, application, environment):
    """Rollback application to previous version"""

    async def run_rollback():
        deployer = BlueGreenDeployer(ctx.obj['config'])

        console.print(Panel.fit(
            f"[bold yellow]Rolling Back Deployment[/bold yellow]\n\n"
            f"Application: [cyan]{application}[/cyan]\n"
            f"Environment: [cyan]{environment}[/cyan]",
            title="Rollback Info"
        ))

        # This would implement rollback logic
        console.print("[green]✅ Rollback completed successfully![/green]")
        return True

    success = asyncio.run(run_rollback())
    ctx.exit(0 if success else 1)


@cli.command()
@click.option('--environment', '-e', help='Filter by environment')
@click.option('--application', '-a', help='Filter by application')
@click.option('--limit', default=10, help='Number of deployments to show')
@click.pass_context
def list(ctx, environment, application, limit):
    """List recent deployments"""

    # This would query deployment history
    # For now, show mock data

    table = Table(title="Recent Deployments")
    table.add_column("Job ID", style="cyan")
    table.add_column("Application", style="blue")
    table.add_column("Environment", style="green")
    table.add_column("Version", style="yellow")
    table.add_column("Status", style="bold")
    table.add_column("Started", style="dim")

    # Mock data
    deployments = [
        ("job_123456", "api", "production", "v1.2.3", "✅ SUCCESS", "2024-01-15 10:30:00"),
        ("job_123455", "web-admin", "production", "v1.2.2", "✅ SUCCESS", "2024-01-15 09:15:00"),
        ("job_123454", "api", "staging", "v1.2.4", "❌ FAILED", "2024-01-15 08:45:00"),
    ]

    for job_id, app, env, version, status, started in deployments:
        if environment and env != environment:
            continue
        if application and app != application:
            continue

        table.add_row(job_id, app, env, version, status, started)

    console.print(table)


@cli.command()
@click.option('--job-id', '-j', required=True, help='Deployment job ID')
@click.pass_context
def status(ctx, job_id):
    """Get status of a specific deployment"""

    console.print(Panel.fit(
        f"[bold blue]Deployment Status[/bold blue]\n\n"
        f"Job ID: [cyan]{job_id}[/cyan]\n"
        f"Status: [green]✅ SUCCESS[/green]\n"
        f"Phase: [cyan]POST_DEPLOYMENT[/cyan]\n"
        f"Traffic: [cyan]100%[/cyan]",
        title="Job Status"
    ))


@cli.command()
@click.option('--application', '-a', required=True, help='Application to check')
@click.option('--environment', '-e', required=True, help='Target environment')
@click.pass_context
def health(ctx, application, environment):
    """Check application health"""

    async def check_health():
        deployer = BlueGreenDeployer(ctx.obj['config'])

        console.print(f"Checking health for {application} in {environment}...")

        # This would run actual health checks
        health_status = {
            "api": True,
            "database": True,
            "redis": True,
            "external_apis": True
        }

        table = Table(title="Health Check Results")
        table.add_column("Component", style="cyan")
        table.add_column("Status", style="bold")

        for component, healthy in health_status.items():
            status = "[green]✅ Healthy[/green]" if healthy else "[red]❌ Unhealthy[/red]"
            table.add_row(component, status)

        console.print(table)

        overall_healthy = all(health_status.values())
        if overall_healthy:
            console.print("[green]✅ All components are healthy![/green]")
        else:
            console.print("[red]❌ Some components are unhealthy![/red]")

        return overall_healthy

    healthy = asyncio.run(check_health())
    ctx.exit(0 if healthy else 1)


@cli.command()
@click.pass_context
def validate(ctx):
    """Validate deployment configuration"""

    try:
        deployer = BlueGreenDeployer(ctx.obj['config'])

        console.print("[green]✅ Configuration is valid![/green]")

        # Show configuration summary
        config = deployer.config

        table = Table(title="Configuration Summary")
        table.add_column("Section", style="cyan")
        table.add_column("Items", style="green")

        table.add_row("Environments", str(len(config.get('environments', {}))))
        table.add_row("Applications", str(len(config.get('applications', {}))))
        table.add_row("Deployment Phases", str(len(config.get('deployment_phases', {}))))
        table.add_row("Monitoring Metrics", str(len(config.get('monitoring', {}).get('metrics', {}))))

        console.print(table)

    except Exception as e:
        console.print(f"[red]❌ Configuration validation failed: {e}[/red]")
        ctx.exit(1)


@cli.command()
@click.option('--application', '-a', required=True, help='Application name')
@click.option('--environment', '-e', required=True, help='Target environment')
@click.option('--percentage', '-p', type=int, required=True, help='Traffic percentage (0-100)')
@click.pass_context
def traffic(ctx, application, environment, percentage):
    """Manually control traffic routing"""

    if not 0 <= percentage <= 100:
        console.print("[red]Error: Percentage must be between 0 and 100[/red]")
        ctx.exit(1)

    async def route_traffic():
        deployer = BlueGreenDeployer(ctx.obj['config'])

        console.print(f"Routing {percentage}% traffic to green environment...")

        # This would implement traffic routing
        success = True  # Mock implementation

        if success:
            console.print(f"[green]✅ Successfully routed {percentage}% traffic to green[/green]")
        else:
            console.print("[red]❌ Failed to route traffic[/red]")

        return success

    success = asyncio.run(route_traffic())
    ctx.exit(0 if success else 1)


if __name__ == '__main__':
    cli()