import os
import uuid
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import pandas as pd
import json
from pathlib import Path

from app.core.config import settings
from app.database.models import User, DataInvestigation, JobStatus, DataSourceType
from app.database.connection import get_db
from sqlalchemy.ext.asyncio import AsyncSession

class UploadService:
    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(exist_ok=True)
        self.allowed_extensions = settings.ALLOWED_FILE_TYPES.split(',')
        
    def _is_allowed_file(self, filename: str) -> bool:
        """Check if file extension is allowed"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in self.allowed_extensions
    
    def _get_file_type(self, filename: str) -> DataSourceType:
        """Determine data source type from filename"""
        ext = filename.rsplit('.', 1)[1].lower()
        if ext == 'csv':
            return DataSourceType.CSV
        elif ext == 'json':
            return DataSourceType.JSON
        elif ext in ['xlsx', 'xls']:
            return DataSourceType.EXCEL
        else:
            return DataSourceType.CSV  # Default
    
    async def save_uploaded_file(self, file_content: bytes, filename: str, user_id: str) -> Dict[str, Any]:
        """Save uploaded file and return file info"""
        if not self._is_allowed_file(filename):
            raise ValueError(f"File type not allowed. Allowed types: {', '.join(self.allowed_extensions)}")
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{file_id}.{file_extension}"
        file_path = self.upload_dir / unique_filename
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Get file info
        file_size = len(file_content)
        
        return {
            "file_id": file_id,
            "original_filename": filename,
            "stored_filename": unique_filename,
            "file_path": str(file_path),
            "file_size": file_size,
            "file_type": self._get_file_type(filename).value,
            "uploaded_at": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
    
    async def analyze_file(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """Analyze uploaded file and extract basic information"""
        try:
            if file_type == 'csv':
                df = pd.read_csv(file_path)
            elif file_type == 'json':
                with open(file_path, 'r') as f:
                    data = json.load(f)
                if isinstance(data, list):
                    df = pd.DataFrame(data)
                else:
                    df = pd.DataFrame([data])
            elif file_type in ['xlsx', 'xls']:
                df = pd.read_excel(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            # Basic analysis
            analysis = {
                "rows": len(df),
                "columns": len(df.columns),
                "column_names": df.columns.tolist(),
                "data_types": df.dtypes.astype(str).to_dict(),
                "missing_values": df.isnull().sum().to_dict(),
                "sample_data": df.head(5).to_dict('records'),
                "memory_usage": df.memory_usage(deep=True).sum(),
                "numeric_columns": df.select_dtypes(include=['number']).columns.tolist(),
                "categorical_columns": df.select_dtypes(include=['object']).columns.tolist(),
            }
            
            # Data quality score (simple calculation)
            total_cells = len(df) * len(df.columns)
            missing_cells = df.isnull().sum().sum()
            quality_score = max(0, (total_cells - missing_cells) / total_cells * 100) if total_cells > 0 else 0
            
            analysis["quality_score"] = round(quality_score, 2)
            
            return analysis
            
        except Exception as e:
            return {
                "error": str(e),
                "analysis_failed": True
            }
    
    async def create_data_investigation(self, db: AsyncSession, file_info: Dict[str, Any], 
                                      analysis: Dict[str, Any], user_id: str) -> str:
        """Create a data investigation record"""
        investigation = DataInvestigation(
            id=uuid.uuid4(),
            name=f"Analysis of {file_info['original_filename']}",
            description=f"Automated analysis of uploaded file: {file_info['original_filename']}",
            workspace_id=None,  # We'll handle workspaces later
            created_by_id=user_id,
            data_source_type=DataSourceType(file_info['file_type']),
            data_source_config={
                "file_path": file_info['file_path'],
                "original_filename": file_info['original_filename'],
                "file_size": file_info['file_size']
            },
            schema_info=analysis,
            quality_score=analysis.get('quality_score', 0),
            status=JobStatus.COMPLETED if not analysis.get('analysis_failed') else JobStatus.FAILED,
            progress_percentage=100.0,
            created_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        db.add(investigation)
        await db.commit()
        await db.refresh(investigation)
        
        return str(investigation.id)
    
    async def process_upload(self, file_content: bytes, filename: str, user_id: str) -> Dict[str, Any]:
        """Complete upload processing pipeline"""
        try:
            # Save file
            file_info = await self.save_uploaded_file(file_content, filename, user_id)
            
            # Analyze file
            analysis = await self.analyze_file(file_info['file_path'], file_info['file_type'])
            
            # Create database record
            async with get_db() as db:
                investigation_id = await self.create_data_investigation(db, file_info, analysis, user_id)
            
            return {
                "success": True,
                "file_info": file_info,
                "analysis": analysis,
                "investigation_id": investigation_id,
                "message": "File uploaded and analyzed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to process upload"
            }

# Global upload service instance
upload_service = UploadService() 