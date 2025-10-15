"""
Cache management commands (Phase 3 integration).
"""
import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.text import Text
import json

console = Console()

@click.group()
def cache():
    """Cache management - warm, inspect, invalidate (Phase 3)."""
    pass

@cache.command(name='stats')
@click.option('--layer', type=click.Choice(['l1', 'l2', 'all']), default='all')
@click.option('--watch', is_flag=True, help='Watch cache stats in real-time')
@click.pass_context
def cache_stats(ctx, layer, watch):
    """Show cache statistics (Phase 3)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    try:
        response = client.get(f"/api/cache/stats", params={"layer": layer})
        stats = response.json()

        table = Table(title=f"Cache Statistics - {layer.upper()}")
        table.add_column("Metric", style="cyan")
        table.add_column("L1 (Local)", style="green")
        table.add_column("L2 (Redis)", style="yellow")

        table.add_row("Hit Rate",
                     f"{stats.get('l1_hit_rate', 0):.2%}",
                     f"{stats.get('l2_hit_rate', 0):.2%}")
        table.add_row("Total Hits",
                     str(stats.get('l1_hits', 0)),
                     str(stats.get('l2_hits', 0)))
        table.add_row("Total Misses",
                     str(stats.get('l1_misses', 0)),
                     str(stats.get('l2_misses', 0)))
        table.add_row("Entries",
                     str(stats.get('l1_entries', 0)),
                     str(stats.get('l2_entries', 0)))
        table.add_row("Memory Used",
                     stats.get('l1_memory', 'N/A'),
                     stats.get('l2_memory', 'N/A'))

        console.print(table)

        if watch:
            console.print("\n[dim]Press Ctrl+C to stop watching...[/dim]")
    except Exception as e:
        console.print(f"[red]Failed to fetch cache stats: {e}[/red]")

@cache.command(name='warm')
@click.option('--model-id', help='Model ID to warm cache for')
@click.option('--dataset', type=click.Path(exists=True), help='Dataset for warming')
@click.option('--layer', type=click.Choice(['l1', 'l2', 'both']), default='both')
@click.pass_context
def cache_warm(ctx, model_id, dataset, layer):
    """Warm cache with model predictions (Phase 3)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        progress.add_task(f"Warming {layer} cache for model {model_id}...", total=None)

        try:
            data = {"model_id": model_id, "layer": layer}
            if dataset:
                with open(dataset, 'rb') as f:
                    files = {'dataset': f}
                    response = client.post("/api/cache/warm", files=files, data=data)
            else:
                response = client.post("/api/cache/warm", json=data)

            result = response.json()
            console.print(f"[green]✓[/green] Cache warmed successfully")
            console.print(f"Entries cached: {result.get('entries_cached', 0)}")
            console.print(f"Cache time: {result.get('cache_time_ms', 0)}ms")
        except Exception as e:
            console.print(f"[red]Cache warming failed: {e}[/red]")

@cache.command(name='invalidate')
@click.option('--pattern', help='Key pattern to invalidate (supports wildcards)')
@click.option('--model-id', help='Invalidate all entries for model')
@click.option('--layer', type=click.Choice(['l1', 'l2', 'all']), default='all')
@click.option('--confirm', is_flag=True, help='Skip confirmation prompt')
@click.pass_context
def cache_invalidate(ctx, pattern, model_id, layer, confirm):
    """Invalidate cache entries (Phase 3)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    if not confirm:
        click.confirm(f'Invalidate cache entries in {layer}?', abort=True)

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        progress.add_task(f"Invalidating {layer} cache...", total=None)

        try:
            response = client.post("/api/cache/invalidate", json={
                "pattern": pattern,
                "model_id": model_id,
                "layer": layer
            })

            result = response.json()
            console.print(f"[green]✓[/green] Cache invalidated")
            console.print(f"Entries removed: {result.get('entries_removed', 0)}")
        except Exception as e:
            console.print(f"[red]Cache invalidation failed: {e}[/red]")

@cache.command(name='topology')
@click.pass_context
def cache_topology(ctx):
    """Show cache topology and edge nodes (Phase 3)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    try:
        response = client.get("/api/cache/topology")
        topology = response.json()

        table = Table(title="Cache Topology")
        table.add_column("Node ID", style="cyan")
        table.add_column("Region", style="green")
        table.add_column("Type", style="yellow")
        table.add_column("Status", style="magenta")
        table.add_column("Latency", style="dim")

        for node in topology.get('nodes', []):
            table.add_row(
                node.get('id', 'N/A'),
                node.get('region', 'N/A'),
                node.get('type', 'N/A'),
                node.get('status', 'N/A'),
                f"{node.get('latency_ms', 0)}ms"
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]Failed to fetch topology: {e}[/red]")

@cache.command(name='inspect')
@click.argument('key')
@click.option('--layer', type=click.Choice(['l1', 'l2']), required=True)
@click.pass_context
def cache_inspect(ctx, key, layer):
    """Inspect specific cache entry (Phase 3)."""
    client = ctx.obj.get('client')
    if not client:
        console.print("[red]Not authenticated. Run 'schlep auth login' first.[/red]")
        return

    try:
        response = client.get(f"/api/cache/inspect/{layer}/{key}")
        entry = response.json()

        info = Text()
        info.append(f"Key: ", style="bold")
        info.append(f"{entry.get('key')}\n", style="cyan")
        info.append(f"Layer: ", style="bold")
        info.append(f"{layer.upper()}\n", style="green")
        info.append(f"Size: ", style="bold")
        info.append(f"{entry.get('size_bytes', 0)} bytes\n", style="yellow")
        info.append(f"TTL: ", style="bold")
        info.append(f"{entry.get('ttl_seconds', 0)}s\n", style="magenta")
        info.append(f"Hits: ", style="bold")
        info.append(f"{entry.get('hits', 0)}\n", style="dim")
        info.append(f"Created: ", style="bold")
        info.append(f"{entry.get('created_at', 'N/A')}\n", style="dim")

        console.print(Panel(info, title="Cache Entry", border_style="blue"))

        if entry.get('value'):
            console.print("\n[bold]Value:[/bold]")
            console.print(json.dumps(entry['value'], indent=2))
    except Exception as e:
        console.print(f"[red]Failed to inspect key: {e}[/red]")
