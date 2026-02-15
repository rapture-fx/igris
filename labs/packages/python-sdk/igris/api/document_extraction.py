"""
Document Extraction API for Igris-engine SDK
"""

from typing import Any, Dict, List, Optional, Union
from pathlib import Path
import io

from .base import BaseAPI
from ..models.common import FileUpload, JobInfo, APIResponse


class DocumentExtractionAPI(BaseAPI):
    """
    Document Extraction API client.
    
    Provides methods for extracting text, tables, and metadata from documents.
    """
    
    def __init__(self, client):
        """Initialize document extraction API."""
        super().__init__(client)
        self.base_path = "/extract"
    
    async def extract_text(
        self,
        file_path: Union[str, Path, io.IOBase],
        extract_tables: bool = True,
        extract_images: bool = False,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract text from document.
        
        Args:
            file_path: Path to document or file-like object
            extract_tables: Whether to extract tables
            extract_images: Whether to extract images
            filename: Custom filename for file-like objects
            
        Returns:
            Extraction results
        """
        # Upload file
        if isinstance(file_path, (str, Path)):
            path = Path(file_path)
            with open(path, 'rb') as f:
                files = {'file': (path.name, f, 'application/octet-stream')}
                data = {
                    'extract_tables': extract_tables,
                    'extract_images': extract_images
                }
                response = await self._post("/text", files=files, data=data)
        else:
            files = {'file': (filename or 'document', file_path, 'application/octet-stream')}
            data = {
                'extract_tables': extract_tables,
                'extract_images': extract_images
            }
            response = await self._post("/text", files=files, data=data)
        
        return response.get("data", response)
    
    async def extract_tables(
        self,
        file_path: Union[str, Path, io.IOBase],
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract tables from document.
        
        Args:
            file_path: Path to document or file-like object
            filename: Custom filename for file-like objects
            
        Returns:
            Extracted tables
        """
        if isinstance(file_path, (str, Path)):
            path = Path(file_path)
            with open(path, 'rb') as f:
                files = {'file': (path.name, f, 'application/octet-stream')}
                response = await self._post("/tables", files=files)
        else:
            files = {'file': (filename or 'document', file_path, 'application/octet-stream')}
            response = await self._post("/tables", files=files)
        
        return response.get("data", response)