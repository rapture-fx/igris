"""
File Upload and Processing System for Schlep-engine
Handles file uploads, cloud storage, and data processing pipeline
"""

import pandas as pd
import numpy as np
import io
import os
import tempfile
import json
import asyncio
from typing import Dict, List, Any, Optional, Union, BinaryIO, AsyncIterator
from pathlib import Path
import logging
from datetime import datetime
import hashlib
import mimetypes
from fastapi import UploadFile, HTTPException
import aiofiles

# Cloud storage imports (will be conditional)
try:
    import boto3
    from botocore.exceptions import NoCredentialsError, ClientError
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

logger = logging.getLogger(__name__)

class FileUploadService:
    """Handles file upload, validation, and cloud storage integration"""
    
    def __init__(self, storage_type: str = "local", **storage_config):
        self.storage_type = storage_type
        self.storage_config = storage_config
        self.max_file_size = storage_config.get('max_file_size', 100 * 1024 * 1024)  # 100MB default
        self.allowed_extensions = {'.csv', '.json', '.xlsx', '.xls', '.parquet', '.tsv', '.txt'}
        
        # Initialize storage client based on type
        if storage_type == "s3" and AWS_AVAILABLE:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=storage_config.get('aws_access_key_id'),
                aws_secret_access_key=storage_config.get('aws_secret_access_key'),
                region_name=storage_config.get('region', 'us-east-1')
            )
            self.bucket_name = storage_config.get('bucket_name')
        else:
            self.s3_client = None
            # Use local storage directory
            self.local_storage_dir = Path(storage_config.get('local_dir', './uploads'))
            self.local_storage_dir.mkdir(exist_ok=True)
    
    async def upload_file(self, file: UploadFile, user_id: str) -> Dict[str, Any]:
        """Upload file with validation and metadata extraction"""
        try:
            # Validate file
            validation_result = await self._validate_file(file)
            if not validation_result['valid']:
                raise HTTPException(status_code=400, detail=validation_result['error'])
            
            # Generate unique file identifier
            file_id = self._generate_file_id(file.filename, user_id)
            
            # Read file content
            content = await file.read()
            file_size = len(content)
            
            # Upload to storage
            if self.storage_type == "s3" and self.s3_client:
                storage_path = await self._upload_to_s3(content, file_id, file.filename)
            else:
                storage_path = await self._upload_to_local(content, file_id, file.filename)
            
            # Extract metadata
            metadata = await self._extract_metadata(content, file.filename, file_size)
            
            # Reset file position for further processing
            await file.seek(0)
            
            return {
                'file_id': file_id,
                'original_filename': file.filename,
                'storage_path': storage_path,
                'file_size': file_size,
                'content_type': file.content_type,
                'metadata': metadata,
                'upload_timestamp': datetime.utcnow().isoformat(),
                'user_id': user_id,
                'status': 'uploaded'
            }
            
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    async def _validate_file(self, file: UploadFile) -> Dict[str, Any]:
        """Validate uploaded file"""
        # Check file extension
        if file.filename:
            file_extension = Path(file.filename).suffix.lower()
            if file_extension not in self.allowed_extensions:
                return {
                    'valid': False,
                    'error': f"File type {file_extension} not supported. Allowed types: {', '.join(self.allowed_extensions)}"
                }
        
        # Check file size (read first to get size, then reset)
        content = await file.read()
        file_size = len(content)
        await file.seek(0)  # Reset file position
        
        if file_size > self.max_file_size:
            return {
                'valid': False,
                'error': f"File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size ({self.max_file_size / (1024*1024):.1f}MB)"
            }
        
        if file_size == 0:
            return {
                'valid': False,
                'error': "File is empty"
            }
        
        return {'valid': True}
    
    async def _upload_to_s3(self, content: bytes, file_id: str, filename: str) -> str:
        """Upload file to AWS S3"""
        try:
            key = f"uploads/{file_id}/{filename}"
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=content,
                ContentType=mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            )
            
            return f"s3://{self.bucket_name}/{key}"
            
        except (NoCredentialsError, ClientError) as e:
            logger.error(f"S3 upload failed: {e}")
            raise HTTPException(status_code=500, detail="Cloud storage upload failed")
    
    async def _upload_to_local(self, content: bytes, file_id: str, filename: str) -> str:
        """Upload file to local storage"""
        try:
            # Create subdirectory for this file
            file_dir = self.local_storage_dir / file_id
            file_dir.mkdir(exist_ok=True)
            
            file_path = file_dir / filename
            
            # Write file asynchronously
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            return str(file_path)
            
        except Exception as e:
            logger.error(f"Local upload failed: {e}")
            raise HTTPException(status_code=500, detail="Local storage upload failed")
    
    async def _extract_metadata(self, content: bytes, filename: str, file_size: int) -> Dict[str, Any]:
        """Extract metadata from uploaded file"""
        metadata = {
            'original_filename': filename,
            'file_size_bytes': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2),
            'file_hash': hashlib.md5(content).hexdigest(),
            'content_type': mimetypes.guess_type(filename)[0],
            'file_extension': Path(filename).suffix.lower()
        }
        
        # Try to get additional metadata based on file type
        try:
            if filename.endswith(('.csv', '.tsv')):
                # For CSV files, try to determine delimiter and get basic info
                sample = content[:1024].decode('utf-8', errors='ignore')
                metadata.update(self._analyze_csv_metadata(sample))
            
            elif filename.endswith('.json'):
                # For JSON files, try to parse and get structure info
                try:
                    json_data = json.loads(content.decode('utf-8'))
                    metadata['json_structure'] = self._analyze_json_structure(json_data)
                except:
                    metadata['json_parse_error'] = True
            
        except Exception as e:
            logger.warning(f"Could not extract detailed metadata: {e}")
            metadata['metadata_extraction_error'] = str(e)
        
        return metadata
    
    def _analyze_csv_metadata(self, sample: str) -> Dict[str, Any]:
        """Analyze CSV sample to determine format"""
        import csv
        
        # Try to detect delimiter
        sniffer = csv.Sniffer()
        try:
            delimiter = sniffer.sniff(sample).delimiter
        except:
            delimiter = ','
        
        # Count columns in first row
        lines = sample.split('\n')
        if lines:
            first_line = lines[0]
            estimated_columns = len(first_line.split(delimiter))
        else:
            estimated_columns = 0
        
        return {
            'detected_delimiter': delimiter,
            'estimated_columns': estimated_columns,
            'sample_preview': sample[:200]
        }
    
    def _analyze_json_structure(self, json_data: Any, max_depth: int = 3) -> Dict[str, Any]:
        """Analyze JSON structure"""
        def get_structure(obj, depth=0):
            if depth > max_depth:
                return "..."
            
            if isinstance(obj, dict):
                if not obj:
                    return {}
                # Sample a few keys for structure
                sample_keys = list(obj.keys())[:5]
                return {key: get_structure(obj[key], depth + 1) for key in sample_keys}
            elif isinstance(obj, list):
                if not obj:
                    return []
                return [get_structure(obj[0], depth + 1)] if obj else []
            else:
                return type(obj).__name__
        
        return {
            'structure': get_structure(json_data),
            'is_array': isinstance(json_data, list),
            'estimated_records': len(json_data) if isinstance(json_data, list) else 1
        }
    
    def _generate_file_id(self, filename: str, user_id: str) -> str:
        """Generate unique file identifier"""
        timestamp = datetime.utcnow().isoformat()
        content = f"{user_id}_{filename}_{timestamp}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]


class DataProcessor:
    """Process uploaded files into pandas DataFrames"""
    
    def __init__(self):
        self.chunk_size = 10000  # Default chunk size for streaming
    
    async def parse_file(self, file_path: str, file_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Parse file based on its type and return DataFrame info"""
        try:
            file_extension = file_metadata.get('file_extension', '').lower()
            
            if file_extension in ['.csv', '.tsv']:
                return await self._parse_csv(file_path, file_metadata)
            elif file_extension == '.json':
                return await self._parse_json(file_path)
            elif file_extension in ['.xlsx', '.xls']:
                return await self._parse_excel(file_path)
            elif file_extension == '.parquet':
                return await self._parse_parquet(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_extension}")
                
        except Exception as e:
            logger.error(f"Error parsing file {file_path}: {e}")
            return {
                'status': 'error',
                'error_message': str(e),
                'file_path': file_path
            }
    
    async def _parse_csv(self, file_path: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Parse CSV file with intelligent parameter detection"""
        try:
            # Use detected delimiter from metadata if available
            delimiter = metadata.get('detected_delimiter', ',')
            
            # Try to read the file
            df = pd.read_csv(file_path, delimiter=delimiter, nrows=1000)  # Sample first 1000 rows
            
            # If successful, get full info
            full_df = pd.read_csv(file_path, delimiter=delimiter)
            
            return {
                'status': 'success',
                'dataframe_info': self._get_dataframe_info(full_df),
                'sample_data': full_df.head(10).to_dict(orient='records'),
                'parsing_params': {
                    'delimiter': delimiter,
                    'encoding': 'utf-8'
                }
            }
            
        except Exception as e:
            # Try alternative approaches
            logger.warning(f"Standard CSV parsing failed, trying alternatives: {e}")
            
            # Try different delimiters
            for alt_delimiter in [';', '\t', '|']:
                try:
                    df = pd.read_csv(file_path, delimiter=alt_delimiter)
                    return {
                        'status': 'success',
                        'dataframe_info': self._get_dataframe_info(df),
                        'sample_data': df.head(10).to_dict(orient='records'),
                        'parsing_params': {
                            'delimiter': alt_delimiter,
                            'encoding': 'utf-8'
                        }
                    }
                except:
                    continue
            
            # Try different encodings
            for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    df = pd.read_csv(file_path, encoding=encoding)
                    return {
                        'status': 'success',
                        'dataframe_info': self._get_dataframe_info(df),
                        'sample_data': df.head(10).to_dict(orient='records'),
                        'parsing_params': {
                            'delimiter': ',',
                            'encoding': encoding
                        }
                    }
                except:
                    continue
            
            raise ValueError("Could not parse CSV with any standard parameters")
    
    async def _parse_json(self, file_path: str) -> Dict[str, Any]:
        """Parse JSON file"""
        try:
            # Try to read as JSON
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Convert to DataFrame
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                # Try to find the main data array
                if len(data) == 1:
                    key = list(data.keys())[0]
                    if isinstance(data[key], list):
                        df = pd.DataFrame(data[key])
                    else:
                        df = pd.DataFrame([data])
                else:
                    df = pd.DataFrame([data])
            else:
                raise ValueError("JSON structure not suitable for tabular data")
            
            return {
                'status': 'success',
                'dataframe_info': self._get_dataframe_info(df),
                'sample_data': df.head(10).to_dict(orient='records'),
                'parsing_params': {
                    'format': 'json',
                    'structure': 'array' if isinstance(data, list) else 'object'
                }
            }
            
        except Exception as e:
            # Try JSON Lines format
            try:
                lines = []
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            lines.append(json.loads(line))
                
                df = pd.DataFrame(lines)
                
                return {
                    'status': 'success',
                    'dataframe_info': self._get_dataframe_info(df),
                    'sample_data': df.head(10).to_dict(orient='records'),
                    'parsing_params': {
                        'format': 'jsonlines'
                    }
                }
                
            except:
                raise ValueError(f"Could not parse JSON file: {e}")
    
    async def _parse_excel(self, file_path: str) -> Dict[str, Any]:
        """Parse Excel file"""
        try:
            # Read first sheet
            df = pd.read_excel(file_path, sheet_name=0)
            
            # Get sheet names for additional info
            xl_file = pd.ExcelFile(file_path)
            sheet_names = xl_file.sheet_names
            
            return {
                'status': 'success',
                'dataframe_info': self._get_dataframe_info(df),
                'sample_data': df.head(10).to_dict(orient='records'),
                'parsing_params': {
                    'sheet_name': sheet_names[0],
                    'available_sheets': sheet_names
                }
            }
            
        except Exception as e:
            raise ValueError(f"Could not parse Excel file: {e}")
    
    async def _parse_parquet(self, file_path: str) -> Dict[str, Any]:
        """Parse Parquet file"""
        try:
            df = pd.read_parquet(file_path)
            
            return {
                'status': 'success',
                'dataframe_info': self._get_dataframe_info(df),
                'sample_data': df.head(10).to_dict(orient='records'),
                'parsing_params': {
                    'format': 'parquet'
                }
            }
            
        except Exception as e:
            raise ValueError(f"Could not parse Parquet file: {e}")
    
    def _get_dataframe_info(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Get comprehensive information about a DataFrame"""
        return {
            'shape': {
                'rows': int(len(df)),
                'columns': int(len(df.columns))
            },
            'columns': {
                col: {
                    'dtype': str(df[col].dtype),
                    'non_null_count': int(df[col].count()),
                    'null_count': int(df[col].isnull().sum()),
                    'unique_count': int(df[col].nunique())
                }
                for col in df.columns
            },
            'memory_usage': {
                'total_mb': round(float(df.memory_usage(deep=True).sum()) / (1024 * 1024), 2),
                'per_column': {
                    col: round(float(df[col].memory_usage(deep=True)) / (1024 * 1024), 2)
                    for col in df.columns
                }
            },
            'data_types_summary': {str(k): int(v) for k, v in df.dtypes.value_counts().to_dict().items()}
        }
    
    async def stream_large_file(self, file_path: str, chunk_size: int = None) -> AsyncIterator[pd.DataFrame]:
        """Stream large files in chunks"""
        if chunk_size is None:
            chunk_size = self.chunk_size
        
        file_extension = Path(file_path).suffix.lower()
        
        try:
            if file_extension == '.csv':
                # Stream CSV in chunks
                for chunk in pd.read_csv(file_path, chunksize=chunk_size):
                    yield chunk
            
            elif file_extension == '.json':
                # For JSON, we need to read the whole file first (JSON doesn't stream well)
                df = pd.read_json(file_path)
                for i in range(0, len(df), chunk_size):
                    yield df.iloc[i:i+chunk_size]
            
            elif file_extension in ['.xlsx', '.xls']:
                # Excel streaming is limited, read in full then chunk
                df = pd.read_excel(file_path)
                for i in range(0, len(df), chunk_size):
                    yield df.iloc[i:i+chunk_size]
            
            else:
                raise ValueError(f"Streaming not supported for {file_extension}")
                
        except Exception as e:
            logger.error(f"Error streaming file {file_path}: {e}")
            raise


class ProcessingJobManager:
    """Manage data processing jobs and track progress"""
    
    def __init__(self):
        self.active_jobs = {}
    
    def create_job(self, file_metadata: Dict[str, Any], processing_options: Dict[str, Any]) -> str:
        """Create a new processing job"""
        job_id = self._generate_job_id()
        
        self.active_jobs[job_id] = {
            'job_id': job_id,
            'file_metadata': file_metadata,
            'processing_options': processing_options,
            'status': 'created',
            'progress': 0,
            'created_at': datetime.utcnow().isoformat(),
            'started_at': None,
            'completed_at': None,
            'error_message': None,
            'result': None
        }
        
        return job_id
    
    async def process_file_async(self, job_id: str):
        """Process file asynchronously"""
        if job_id not in self.active_jobs:
            raise ValueError(f"Job {job_id} not found")
        
        job = self.active_jobs[job_id]
        
        try:
            # Update job status
            job['status'] = 'processing'
            job['started_at'] = datetime.utcnow().isoformat()
            job['progress'] = 10
            
            # Initialize processors
            data_processor = DataProcessor()
            
            # Parse the file
            job['progress'] = 30
            parse_result = await data_processor.parse_file(
                job['file_metadata']['storage_path'],
                job['file_metadata']['metadata']
            )
            
            if parse_result['status'] == 'error':
                raise ValueError(parse_result['error_message'])
            
            job['progress'] = 60
            
            # Run AI analysis if requested
            if job['processing_options'].get('run_ai_analysis', True):
                from .ai_engine import DataQualityAnalyzer
                
                # Load full dataframe for analysis
                file_path = job['file_metadata']['storage_path']
                df = await self._load_full_dataframe(file_path, parse_result['parsing_params'])
                
                # Run AI analysis
                analyzer = DataQualityAnalyzer()
                
                job['progress'] = 70
                schema_analysis = analyzer.analyze_schema(df)
                
                job['progress'] = 80
                quality_score = analyzer.calculate_quality_score(df)
                
                job['progress'] = 90
                anomalies = analyzer.detect_anomalies(df)
                suggestions = analyzer.suggest_improvements(df)
                
                ai_analysis = {
                    'schema_analysis': schema_analysis,
                    'quality_score': quality_score,
                    'anomalies': anomalies,
                    'suggestions': suggestions
                }
            else:
                ai_analysis = None
            
            # Complete job
            job['status'] = 'completed'
            job['progress'] = 100
            job['completed_at'] = datetime.utcnow().isoformat()
            job['result'] = {
                'parse_result': parse_result,
                'ai_analysis': ai_analysis
            }
            
        except Exception as e:
            job['status'] = 'failed'
            job['error_message'] = str(e)
            job['completed_at'] = datetime.utcnow().isoformat()
            logger.error(f"Job {job_id} failed: {e}")
    
    async def _load_full_dataframe(self, file_path: str, parsing_params: Dict[str, Any]) -> pd.DataFrame:
        """Load full dataframe based on parsing parameters"""
        file_extension = Path(file_path).suffix.lower()
        
        if file_extension == '.csv':
            return pd.read_csv(
                file_path,
                delimiter=parsing_params.get('delimiter', ','),
                encoding=parsing_params.get('encoding', 'utf-8')
            )
        elif file_extension == '.json':
            return pd.read_json(file_path)
        elif file_extension in ['.xlsx', '.xls']:
            return pd.read_excel(file_path, sheet_name=parsing_params.get('sheet_name', 0))
        elif file_extension == '.parquet':
            return pd.read_parquet(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get current job status"""
        if job_id not in self.active_jobs:
            raise ValueError(f"Job {job_id} not found")
        
        return self.active_jobs[job_id].copy()
    
    def list_jobs(self, user_id: str = None) -> List[Dict[str, Any]]:
        """List all jobs (optionally filtered by user)"""
        jobs = list(self.active_jobs.values())
        
        if user_id:
            jobs = [job for job in jobs if job['file_metadata'].get('user_id') == user_id]
        
        # Sort by created_at descending
        jobs.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jobs
    
    def _generate_job_id(self) -> str:
        """Generate unique job identifier"""
        timestamp = datetime.utcnow().isoformat()
        content = f"job_{timestamp}_{len(self.active_jobs)}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]


# Global instances
file_upload_service = FileUploadService(storage_type="local", local_dir="./uploads")
job_manager = ProcessingJobManager() 