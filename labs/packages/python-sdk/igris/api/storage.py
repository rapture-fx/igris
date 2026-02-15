"""
Storage API for Igris-engine SDK
"""

from typing import Any, Dict, List, Optional, Union
from pathlib import Path
import io

from .base import BaseAPI
from ..models.common import FileUpload, APIResponse


class StorageAPI(BaseAPI):
    """
    Storage API client.
    
    Provides methods for file storage and management.
    """
    
    def __init__(self, client):
        """Initialize storage API."""
        super().__init__(client)
        self.base_path = "/storage"
    
    async def upload_file(
        self,
        file_path: Union[str, Path, io.IOBase],
        filename: Optional[str] = None,
        folder: Optional[str] = None
    ) -> FileUpload:
        """
        Upload file to storage.
        
        Args:
            file_path: Path to file or file-like object
            filename: Custom filename
            folder: Upload folder
            
        Returns:
            File upload information
        """
        data = {}
        if folder:
            data['folder'] = folder
        
        if isinstance(file_path, (str, Path)):
            path = Path(file_path)
            with open(path, 'rb') as f:
                files = {'file': (filename or path.name, f, 'application/octet-stream')}
                response = await self._post("/upload", files=files, data=data)
        else:
            files = {'file': (filename or 'file', file_path, 'application/octet-stream')}
            response = await self._post("/upload", files=files, data=data)
        
        upload_data = response.get("data", response)
        return FileUpload(**upload_data)
    
    async def list_files(
        self,
        folder: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> APIResponse[List[FileUpload]]:
        """
        List stored files.
        
        Args:
            folder: Filter by folder
            page: Page number
            page_size: Items per page
            
        Returns:
            Paginated list of files
        """
        params = self._build_query_params(
            folder=folder,
            page=page,
            page_size=page_size
        )
        
        return await self._paginated_request("/files", params, FileUpload)
    
    async def delete_file(self, file_id: str) -> Dict[str, Any]:
        """
        Delete a file.
        
        Args:
            file_id: File ID
            
        Returns:
            Deletion confirmation
        """
        return await self._delete(f"/files/{file_id}")