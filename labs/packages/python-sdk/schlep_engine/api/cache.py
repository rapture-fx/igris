"""
Cache Management API client (Phase 3 integration).
"""
from typing import Dict, Any, List, Optional, BinaryIO
from .base import BaseAPI

class CacheAPI(BaseAPI):
    """Cache operations - L1/L2 management, warming, topology."""

    async def get_stats(
        self,
        layer: str = 'all'  # 'l1', 'l2', or 'all'
    ) -> Dict[str, Any]:
        """
        Get cache statistics.

        Args:
            layer: Cache layer to query ('l1', 'l2', 'all')

        Returns:
            Cache statistics including hit rate, entries, memory

        Example:
            >>> stats = await client.cache.get_stats()
            >>> print(f"L1 Hit Rate: {stats['l1_hit_rate']:.2%}")
            >>> print(f"L2 Hit Rate: {stats['l2_hit_rate']:.2%}")
        """
        response = await self._client.get("/api/cache/stats", params={"layer": layer})
        return response

    async def warm_cache(
        self,
        model_id: str,
        dataset: Optional[BinaryIO] = None,
        layer: str = 'both'  # 'l1', 'l2', or 'both'
    ) -> Dict[str, Any]:
        """
        Warm cache with model predictions.

        Args:
            model_id: Model to warm cache for
            dataset: Optional dataset file for prediction inputs
            layer: Cache layer to warm

        Returns:
            Warming result with entries_cached and cache_time_ms

        Example:
            >>> result = await client.cache.warm_cache('model-123', layer='both')
            >>> print(f"Cached {result['entries_cached']} entries")
        """
        data = {"model_id": model_id, "layer": layer}

        if dataset:
            files = {'dataset': dataset}
            response = await self._client.post("/api/cache/warm", files=files, data=data)
        else:
            response = await self._client.post("/api/cache/warm", json=data)

        return response

    async def invalidate(
        self,
        pattern: Optional[str] = None,
        model_id: Optional[str] = None,
        layer: str = 'all'
    ) -> Dict[str, Any]:
        """
        Invalidate cache entries.

        Args:
            pattern: Key pattern to invalidate (supports wildcards)
            model_id: Invalidate all entries for model
            layer: Cache layer ('l1', 'l2', 'all')

        Returns:
            Invalidation result with entries_removed

        Example:
            >>> result = await client.cache.invalidate(model_id='model-123')
            >>> print(f"Removed {result['entries_removed']} entries")
        """
        response = await self._client.post("/api/cache/invalidate", json={
            "pattern": pattern,
            "model_id": model_id,
            "layer": layer
        })
        return response

    async def get_topology(self) -> Dict[str, Any]:
        """
        Get cache topology and edge nodes (Phase 3).

        Returns:
            Topology information with node list and regions

        Example:
            >>> topology = await client.cache.get_topology()
            >>> for node in topology['nodes']:
            ...     print(f"{node['id']} ({node['region']}): {node['latency_ms']}ms")
        """
        response = await self._client.get("/api/cache/topology")
        return response

    async def inspect_entry(
        self,
        key: str,
        layer: str  # 'l1' or 'l2'
    ) -> Dict[str, Any]:
        """
        Inspect specific cache entry.

        Args:
            key: Cache key to inspect
            layer: Cache layer

        Returns:
            Entry metadata including value, size, TTL, hits

        Example:
            >>> entry = await client.cache.inspect_entry('inference:model-123:input-hash', 'l1')
            >>> print(f"Hits: {entry['hits']}, TTL: {entry['ttl_seconds']}s")
        """
        response = await self._client.get(f"/api/cache/inspect/{layer}/{key}")
        return response

    async def set_ttl(
        self,
        key: str,
        ttl_seconds: int,
        layer: str = 'both'
    ) -> Dict[str, Any]:
        """
        Update TTL for cache entry.

        Args:
            key: Cache key
            ttl_seconds: New TTL in seconds
            layer: Cache layer

        Returns:
            Update confirmation

        Example:
            >>> await client.cache.set_ttl('my-key', 3600, layer='l2')
        """
        response = await self._client.put(f"/api/cache/ttl", json={
            "key": key,
            "ttl_seconds": ttl_seconds,
            "layer": layer
        })
        return response

    async def flush(
        self,
        layer: str = 'all',
        confirm: bool = False
    ) -> Dict[str, Any]:
        """
        Flush all cache entries.

        Args:
            layer: Cache layer to flush
            confirm: Confirmation flag (required to prevent accidents)

        Returns:
            Flush result

        Example:
            >>> await client.cache.flush(layer='l1', confirm=True)
        """
        if not confirm:
            raise ValueError("Must set confirm=True to flush cache")

        response = await self._client.post("/api/cache/flush", json={
            "layer": layer,
            "confirm": confirm
        })
        return response
