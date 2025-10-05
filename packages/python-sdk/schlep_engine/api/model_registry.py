"""
Model Registry API client (Phase 2 integration).
"""
from typing import Dict, Any, List, Optional, BinaryIO
from .base import BaseAPI

class ModelRegistryAPI(BaseAPI):
    """Model Registry operations - upload, version, hot-reload."""

    async def list_models(
        self,
        filter: Optional[str] = None,
        framework: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        List models in registry.

        Args:
            filter: Filter models by name/tag
            framework: Filter by framework (pytorch, tensorflow, onnx, etc.)
            limit: Maximum number of models to return

        Returns:
            List of model metadata dictionaries

        Example:
            >>> models = await client.model_registry.list_models(framework='pytorch')
            >>> for model in models:
            ...     print(f"{model['name']}:{model['version']}")
        """
        params = {"limit": limit}
        if filter:
            params["filter"] = filter
        if framework:
            params["framework"] = framework

        response = await self._client.get("/api/ml/registry", params=params)
        return response.get('models', [])

    async def upload_model(
        self,
        model_file: BinaryIO,
        name: str,
        version: str,
        framework: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload model to registry.

        Args:
            model_file: Binary file object of the model
            name: Model name
            version: Model version (semver recommended)
            framework: Model framework (pytorch, tensorflow, onnx, scikit-learn)
            metadata: Optional metadata dictionary

        Returns:
            Upload result with model_id

        Example:
            >>> with open('model.pt', 'rb') as f:
            ...     result = await client.model_registry.upload_model(
            ...         f, 'fraud-detector', '1.0.0', 'pytorch',
            ...         metadata={'accuracy': 0.95}
            ...     )
            >>> print(result['model_id'])
        """
        files = {'model': model_file}
        data = {
            'name': name,
            'version': version,
            'framework': framework,
            'metadata': metadata or {}
        }

        response = await self._client.post(
            "/api/ml/registry/upload",
            files=files,
            data=data
        )
        return response

    async def get_model(self, model_id: str) -> Dict[str, Any]:
        """
        Get model metadata by ID.

        Args:
            model_id: Model identifier

        Returns:
            Model metadata

        Example:
            >>> model = await client.model_registry.get_model('model-123')
            >>> print(f"Status: {model['status']}")
        """
        response = await self._client.get(f"/api/ml/registry/{model_id}")
        return response

    async def download_model(self, model_id: str, version: Optional[str] = None) -> bytes:
        """
        Download model binary.

        Args:
            model_id: Model identifier
            version: Specific version (defaults to latest)

        Returns:
            Model binary data

        Example:
            >>> model_data = await client.model_registry.download_model('model-123')
            >>> with open('model.pt', 'wb') as f:
            ...     f.write(model_data)
        """
        params = {"version": version} if version else {}
        response = await self._client.get(
            f"/api/ml/registry/{model_id}/download",
            params=params,
            raw=True
        )
        return response

    async def hot_reload(
        self,
        model_id: str,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Hot reload model without downtime (Phase 2).

        Args:
            model_id: Model to reload
            version: Version to load (defaults to latest)

        Returns:
            Reload result with load_time_ms

        Example:
            >>> result = await client.model_registry.hot_reload('model-123', '2.0.0')
            >>> print(f"Reloaded in {result['load_time_ms']}ms")
        """
        response = await self._client.post(
            f"/api/ml/models/{model_id}/hot-reload",
            json={"version": version}
        )
        return response

    async def delete_model(self, model_id: str, version: Optional[str] = None) -> Dict[str, Any]:
        """
        Delete model or specific version.

        Args:
            model_id: Model identifier
            version: Specific version to delete (if None, deletes all versions)

        Returns:
            Deletion confirmation

        Example:
            >>> await client.model_registry.delete_model('model-123', '1.0.0')
        """
        params = {"version": version} if version else {}
        response = await self._client.delete(
            f"/api/ml/registry/{model_id}",
            params=params
        )
        return response

    async def list_versions(self, model_id: str) -> List[Dict[str, Any]]:
        """
        List all versions of a model.

        Args:
            model_id: Model identifier

        Returns:
            List of version metadata

        Example:
            >>> versions = await client.model_registry.list_versions('model-123')
            >>> for v in versions:
            ...     print(f"Version {v['version']}: {v['status']}")
        """
        response = await self._client.get(f"/api/ml/registry/{model_id}/versions")
        return response.get('versions', [])
