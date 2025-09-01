"""
Document Processing Service with OCR and Text Extraction
=======================================================

Comprehensive document processing service for extracting text, metadata,
and structured information from various document formats including:
- PDF documents (text extraction and OCR)
- Images (OCR processing)
- Office documents (Word, Excel, PowerPoint)
- Plain text files
- HTML/XML documents

Features:
- Multi-format document support
- OCR with confidence scoring
- Metadata extraction
- Structured data extraction
- Table and form processing
- Language detection
- Text preprocessing and cleaning
"""

import os
import io
import logging
import mimetypes
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple, BinaryIO
from datetime import datetime
from dataclasses import dataclass, field
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Document processing libraries
import pandas as pd
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

# Text extraction libraries
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logging.warning("Tesseract OCR not available")

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logging.warning("PDF processing not available")

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    logging.warning("DOCX processing not available")

try:
    import openpyxl
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False
    logging.warning("Excel processing not available")

try:
    from pptx import Presentation
    PPTX_AVAILABLE = True
except ImportError:
    PPTX_AVAILABLE = False
    logging.warning("PowerPoint processing not available")

# Language detection
try:
    from langdetect import detect, detect_langs
    LANG_DETECT_AVAILABLE = True
except ImportError:
    LANG_DETECT_AVAILABLE = False

# Text preprocessing
import re
from collections import Counter

logger = logging.getLogger(__name__)


@dataclass
class ProcessingOptions:
    """Options for document processing"""
    ocr_enabled: bool = True
    language: str = "eng"  # Tesseract language code
    confidence_threshold: float = 60.0  # Minimum OCR confidence
    extract_metadata: bool = True
    extract_tables: bool = True
    extract_images: bool = False
    preprocess_images: bool = True
    detect_language: bool = True
    clean_text: bool = True
    preserve_formatting: bool = False


@dataclass
class OCRResult:
    """Results from OCR processing"""
    text: str
    confidence: float
    word_confidences: List[Dict[str, Any]] = field(default_factory=list)
    bounding_boxes: List[Dict[str, Any]] = field(default_factory=list)
    detected_blocks: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class DocumentMetadata:
    """Document metadata information"""
    filename: str
    file_size: int
    mime_type: str
    page_count: Optional[int] = None
    creation_date: Optional[datetime] = None
    modification_date: Optional[datetime] = None
    author: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    language: Optional[str] = None
    character_count: int = 0
    word_count: int = 0
    line_count: int = 0


@dataclass
class ProcessingResult:
    """Complete document processing result"""
    success: bool
    text_content: str
    metadata: DocumentMetadata
    ocr_results: Optional[OCRResult] = None
    tables: List[pd.DataFrame] = field(default_factory=list)
    images: List[Dict[str, Any]] = field(default_factory=list)
    structured_data: Dict[str, Any] = field(default_factory=dict)
    processing_time: float = 0.0
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class DocumentProcessor:
    """
    Comprehensive document processing service with OCR and text extraction
    """
    
    def __init__(self, 
                 temp_dir: Optional[str] = None,
                 max_file_size: int = 50 * 1024 * 1024,  # 50MB
                 max_pages: int = 100):
        """
        Initialize document processor
        
        Args:
            temp_dir: Directory for temporary files
            max_file_size: Maximum file size in bytes
            max_pages: Maximum number of pages to process
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.max_file_size = max_file_size
        self.max_pages = max_pages
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Supported file types
        self.supported_types = {
            'application/pdf': self._process_pdf,
            'image/jpeg': self._process_image,
            'image/png': self._process_image,
            'image/tiff': self._process_image,
            'image/bmp': self._process_image,
            'text/plain': self._process_text,
            'text/html': self._process_html,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': self._process_docx,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': self._process_excel,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': self._process_pptx,
        }
    
    async def process_document(self,
                             file_content: Union[bytes, BinaryIO],
                             filename: str,
                             options: Optional[ProcessingOptions] = None) -> ProcessingResult:
        """
        Process a document and extract text, metadata, and structured information
        
        Args:
            file_content: Document content as bytes or file-like object
            filename: Original filename for type detection
            options: Processing options
            
        Returns:
            ProcessingResult with extracted information
        """
        start_time = asyncio.get_event_loop().time()
        options = options or ProcessingOptions()
        
        try:
            # Read file content if needed
            if hasattr(file_content, 'read'):
                content_bytes = file_content.read()
            else:
                content_bytes = file_content
            
            # Validate file size
            if len(content_bytes) > self.max_file_size:
                raise ValueError(f"File size {len(content_bytes)} exceeds maximum {self.max_file_size}")
            
            # Detect MIME type
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                # Try to detect from content
                mime_type = self._detect_mime_type(content_bytes)
            
            logger.info(f"Processing document: {filename} ({mime_type})")
            
            # Check if file type is supported
            if mime_type not in self.supported_types:
                raise ValueError(f"Unsupported file type: {mime_type}")
            
            # Create initial metadata
            metadata = DocumentMetadata(
                filename=filename,
                file_size=len(content_bytes),
                mime_type=mime_type
            )
            
            # Process document based on type
            processor = self.supported_types[mime_type]
            result = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                processor,
                content_bytes,
                metadata,
                options
            )
            
            # Post-process text if requested
            if options.clean_text and result.text_content:
                result.text_content = self._clean_text(result.text_content)
            
            # Detect language if requested
            if options.detect_language and result.text_content:
                detected_lang = self._detect_language(result.text_content)
                result.metadata.language = detected_lang
            
            # Calculate text statistics
            result.metadata.character_count = len(result.text_content)
            result.metadata.word_count = len(result.text_content.split())
            result.metadata.line_count = len(result.text_content.splitlines())
            
            # Calculate processing time
            result.processing_time = asyncio.get_event_loop().time() - start_time
            result.success = True
            
            logger.info(f"Document processing completed: {filename} ({result.processing_time:.2f}s)")
            return result
            
        except Exception as e:
            logger.error(f"Error processing document {filename}: {str(e)}")
            processing_time = asyncio.get_event_loop().time() - start_time
            
            return ProcessingResult(
                success=False,
                text_content="",
                metadata=DocumentMetadata(
                    filename=filename,
                    file_size=len(content_bytes) if 'content_bytes' in locals() else 0,
                    mime_type=mime_type if 'mime_type' in locals() else "unknown"
                ),
                processing_time=processing_time,
                errors=[str(e)]
            )
    
    async def process_multiple_documents(self,
                                       documents: List[Tuple[Union[bytes, BinaryIO], str]],
                                       options: Optional[ProcessingOptions] = None) -> List[ProcessingResult]:
        """
        Process multiple documents concurrently
        
        Args:
            documents: List of (content, filename) tuples
            options: Processing options
            
        Returns:
            List of processing results
        """
        tasks = []
        for content, filename in documents:
            task = self.process_document(content, filename, options)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(ProcessingResult(
                    success=False,
                    text_content="",
                    metadata=DocumentMetadata(
                        filename=documents[i][1],
                        file_size=0,
                        mime_type="unknown"
                    ),
                    errors=[str(result)]
                ))
            else:
                processed_results.append(result)
        
        return processed_results
    
    def _process_pdf(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process PDF document"""
        if not PDF_AVAILABLE:
            raise ImportError("PDF processing requires pdfplumber: pip install pdfplumber")
        
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            with io.BytesIO(content) as pdf_buffer:
                with pdfplumber.open(pdf_buffer) as pdf:
                    # Update metadata
                    metadata.page_count = len(pdf.pages)
                    if pdf.metadata:
                        metadata.title = pdf.metadata.get('Title')
                        metadata.author = pdf.metadata.get('Author')
                        metadata.subject = pdf.metadata.get('Subject')
                        if pdf.metadata.get('CreationDate'):
                            metadata.creation_date = pdf.metadata['CreationDate']
                    
                    # Limit pages if necessary
                    pages_to_process = min(len(pdf.pages), self.max_pages)
                    if pages_to_process < len(pdf.pages):
                        result.warnings.append(f"Processing limited to {pages_to_process} pages out of {len(pdf.pages)}")
                    
                    # Extract text from each page
                    text_parts = []
                    tables = []
                    
                    for i in range(pages_to_process):
                        page = pdf.pages[i]
                        
                        # Extract text
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
                        
                        # Extract tables if requested
                        if options.extract_tables:
                            try:
                                page_tables = page.extract_tables()
                                for table_data in page_tables:
                                    if table_data:
                                        # Convert to DataFrame
                                        df = pd.DataFrame(table_data[1:], columns=table_data[0])
                                        tables.append(df)
                            except Exception as e:
                                result.warnings.append(f"Table extraction failed on page {i+1}: {str(e)}")
                    
                    result.text_content = '\n\n'.join(text_parts)
                    result.tables = tables
                    
                    # If no text was extracted and OCR is enabled, try OCR
                    if not result.text_content.strip() and options.ocr_enabled:
                        result.warnings.append("No text found in PDF, attempting OCR...")
                        try:
                            ocr_result = self._ocr_pdf_pages(pdf, options, pages_to_process)
                            result.text_content = ocr_result.text
                            result.ocr_results = ocr_result
                        except Exception as e:
                            result.errors.append(f"OCR failed: {str(e)}")
            
        except Exception as e:
            result.errors.append(f"PDF processing failed: {str(e)}")
            return result
        
        return result
    
    def _process_image(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process image file with OCR"""
        if not TESSERACT_AVAILABLE:
            raise ImportError("OCR requires pytesseract: pip install pytesseract")
        
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            # Load image
            image = Image.open(io.BytesIO(content))
            
            # Update metadata
            metadata.page_count = 1
            
            # Preprocess image if requested
            if options.preprocess_images:
                image = self._preprocess_image(image)
            
            # Perform OCR
            ocr_result = self._perform_ocr(image, options)
            result.text_content = ocr_result.text
            result.ocr_results = ocr_result
            
            # Filter by confidence if specified
            if ocr_result.confidence < options.confidence_threshold:
                result.warnings.append(f"OCR confidence {ocr_result.confidence:.1f}% below threshold {options.confidence_threshold}%")
            
        except Exception as e:
            result.errors.append(f"Image processing failed: {str(e)}")
            return result
        
        return result
    
    def _process_docx(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process Word document"""
        if not DOCX_AVAILABLE:
            raise ImportError("DOCX processing requires python-docx: pip install python-docx")
        
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            doc = DocxDocument(io.BytesIO(content))
            
            # Extract metadata
            core_props = doc.core_properties
            if core_props.title:
                metadata.title = core_props.title
            if core_props.author:
                metadata.author = core_props.author
            if core_props.subject:
                metadata.subject = core_props.subject
            if core_props.created:
                metadata.creation_date = core_props.created
            if core_props.modified:
                metadata.modification_date = core_props.modified
            
            # Extract text from paragraphs
            text_parts = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)
            
            # Extract text from tables if requested
            tables = []
            if options.extract_tables:
                for table in doc.tables:
                    table_data = []
                    for row in table.rows:
                        row_data = []
                        for cell in row.cells:
                            row_data.append(cell.text.strip())
                        table_data.append(row_data)
                    
                    if table_data:
                        # Convert to DataFrame
                        try:
                            df = pd.DataFrame(table_data[1:], columns=table_data[0])
                            tables.append(df)
                        except Exception:
                            # If can't create proper DataFrame, store as raw data
                            df = pd.DataFrame(table_data)
                            tables.append(df)
            
            result.text_content = '\n\n'.join(text_parts)
            result.tables = tables
            
        except Exception as e:
            result.errors.append(f"DOCX processing failed: {str(e)}")
            return result
        
        return result
    
    def _process_excel(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process Excel spreadsheet"""
        if not EXCEL_AVAILABLE:
            raise ImportError("Excel processing requires openpyxl: pip install openpyxl")
        
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            workbook = openpyxl.load_workbook(io.BytesIO(content))
            
            # Extract metadata
            props = workbook.properties
            if props.title:
                metadata.title = props.title
            if props.creator:
                metadata.author = props.creator
            if props.subject:
                metadata.subject = props.subject
            if props.created:
                metadata.creation_date = props.created
            if props.modified:
                metadata.modification_date = props.modified
            
            # Process all worksheets
            text_parts = []
            tables = []
            
            for sheet_name in workbook.sheetnames:
                sheet = workbook[sheet_name]
                
                # Extract data as DataFrame
                data = []
                for row in sheet.iter_rows(values_only=True):
                    if any(cell is not None for cell in row):  # Skip empty rows
                        data.append([str(cell) if cell is not None else "" for cell in row])
                
                if data:
                    df = pd.DataFrame(data)
                    tables.append(df)
                    
                    # Convert to text
                    sheet_text = f"=== Sheet: {sheet_name} ===\n"
                    sheet_text += df.to_string(index=False, header=False)
                    text_parts.append(sheet_text)
            
            result.text_content = '\n\n'.join(text_parts)
            result.tables = tables
            
        except Exception as e:
            result.errors.append(f"Excel processing failed: {str(e)}")
            return result
        
        return result
    
    def _process_pptx(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process PowerPoint presentation"""
        if not PPTX_AVAILABLE:
            raise ImportError("PPTX processing requires python-pptx: pip install python-pptx")
        
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            prs = Presentation(io.BytesIO(content))
            
            # Extract metadata
            core_props = prs.core_properties
            if core_props.title:
                metadata.title = core_props.title
            if core_props.author:
                metadata.author = core_props.author
            if core_props.subject:
                metadata.subject = core_props.subject
            if core_props.created:
                metadata.creation_date = core_props.created
            if core_props.modified:
                metadata.modification_date = core_props.modified
            
            metadata.page_count = len(prs.slides)
            
            # Extract text from slides
            text_parts = []
            for i, slide in enumerate(prs.slides):
                slide_text = f"=== Slide {i+1} ===\n"
                
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text:
                        slide_text += shape.text + "\n"
                
                text_parts.append(slide_text)
            
            result.text_content = '\n\n'.join(text_parts)
            
        except Exception as e:
            result.errors.append(f"PPTX processing failed: {str(e)}")
            return result
        
        return result
    
    def _process_text(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process plain text file"""
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            # Try different encodings
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            text = None
            
            for encoding in encodings:
                try:
                    text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            
            if text is None:
                # Fall back to error handling
                text = content.decode('utf-8', errors='replace')
                result.warnings.append("Text encoding issues detected, some characters may be incorrect")
            
            result.text_content = text
            
        except Exception as e:
            result.errors.append(f"Text processing failed: {str(e)}")
            return result
        
        return result
    
    def _process_html(self, content: bytes, metadata: DocumentMetadata, options: ProcessingOptions) -> ProcessingResult:
        """Process HTML file"""
        result = ProcessingResult(success=False, text_content="", metadata=metadata)
        
        try:
            # Decode HTML
            html_text = content.decode('utf-8', errors='replace')
            
            # Basic HTML tag removal (simple approach)
            import re
            text = re.sub(r'<[^>]+>', '', html_text)
            text = re.sub(r'&[^;]+;', ' ', text)  # Remove HTML entities
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            
            result.text_content = text.strip()
            
        except Exception as e:
            result.errors.append(f"HTML processing failed: {str(e)}")
            return result
        
        return result
    
    def _perform_ocr(self, image: Image.Image, options: ProcessingOptions) -> OCRResult:
        """Perform OCR on an image"""
        if not TESSERACT_AVAILABLE:
            raise ImportError("OCR requires pytesseract")
        
        try:
            # Configure Tesseract
            config = f'--oem 3 --psm 6 -l {options.language}'
            
            # Extract text
            text = pytesseract.image_to_string(image, config=config)
            
            # Get detailed data with confidences
            data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
            
            # Calculate overall confidence
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            # Extract word-level information
            word_confidences = []
            bounding_boxes = []
            
            for i in range(len(data['text'])):
                if int(data['conf'][i]) > 0:
                    word_info = {
                        'text': data['text'][i],
                        'confidence': int(data['conf'][i]),
                        'x': int(data['left'][i]),
                        'y': int(data['top'][i]),
                        'width': int(data['width'][i]),
                        'height': int(data['height'][i])
                    }
                    word_confidences.append(word_info)
                    bounding_boxes.append(word_info)
            
            return OCRResult(
                text=text,
                confidence=avg_confidence,
                word_confidences=word_confidences,
                bounding_boxes=bounding_boxes
            )
            
        except Exception as e:
            raise Exception(f"OCR processing failed: {str(e)}")
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Preprocess image for better OCR results"""
        try:
            # Convert to grayscale
            if image.mode != 'L':
                image = image.convert('L')
            
            # Enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.5)
            
            # Sharpen image
            image = image.filter(ImageFilter.SHARPEN)
            
            # Scale up if image is too small
            width, height = image.size
            if width < 300 or height < 300:
                scale_factor = max(300 / width, 300 / height)
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                image = image.resize((new_width, new_height), Image.LANCZOS)
            
            return image
            
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {str(e)}")
            return image
    
    def _ocr_pdf_pages(self, pdf, options: ProcessingOptions, max_pages: int) -> OCRResult:
        """Perform OCR on PDF pages that don't have extractable text"""
        if not TESSERACT_AVAILABLE:
            raise ImportError("OCR requires pytesseract")
        
        text_parts = []
        all_confidences = []
        
        for i in range(min(len(pdf.pages), max_pages)):
            try:
                page = pdf.pages[i]
                
                # Convert page to image
                page_image = page.to_image(resolution=150).original
                
                # Preprocess if requested
                if options.preprocess_images:
                    page_image = self._preprocess_image(page_image)
                
                # Perform OCR
                ocr_result = self._perform_ocr(page_image, options)
                
                if ocr_result.text.strip():
                    text_parts.append(f"=== Page {i+1} ===\n{ocr_result.text}")
                    all_confidences.extend([w['confidence'] for w in ocr_result.word_confidences])
                
            except Exception as e:
                logger.warning(f"OCR failed for page {i+1}: {str(e)}")
        
        # Calculate overall confidence
        avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        
        return OCRResult(
            text='\n\n'.join(text_parts),
            confidence=avg_confidence
        )
    
    def _detect_mime_type(self, content: bytes) -> str:
        """Detect MIME type from content"""
        # Simple magic number detection
        if content.startswith(b'%PDF'):
            return 'application/pdf'
        elif content.startswith(b'\xff\xd8\xff'):
            return 'image/jpeg'
        elif content.startswith(b'\x89PNG'):
            return 'image/png'
        elif content.startswith(b'PK\x03\x04'):
            # Could be various Office formats
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        else:
            return 'application/octet-stream'
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize extracted text"""
        if not text:
            return text
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove control characters
        text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
        
        # Normalize line breaks
        text = re.sub(r'\r\n|\r', '\n', text)
        
        # Remove excessive line breaks
        text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
        
        return text.strip()
    
    def _detect_language(self, text: str) -> Optional[str]:
        """Detect language of the text"""
        if not LANG_DETECT_AVAILABLE or not text.strip():
            return None
        
        try:
            # Use only first 1000 characters for efficiency
            sample_text = text[:1000]
            detected_lang = detect(sample_text)
            return detected_lang
        except Exception as e:
            logger.warning(f"Language detection failed: {str(e)}")
            return None
    
    async def extract_structured_data(self, 
                                    processing_result: ProcessingResult,
                                    extraction_patterns: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Extract structured data from processed text using patterns
        
        Args:
            processing_result: Result from document processing
            extraction_patterns: Dictionary of pattern names to regex patterns
            
        Returns:
            Dictionary of extracted structured data
        """
        if not processing_result.text_content:
            return {}
        
        structured_data = {}
        text = processing_result.text_content
        
        # Default extraction patterns
        default_patterns = {
            'emails': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'phone_numbers': r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b',
            'dates': r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b',
            'urls': r'https?://(?:[-\w.])+(?:\:[0-9]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?',
            'currencies': r'\$\s*\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD)',
            'social_security': r'\b\d{3}-\d{2}-\d{4}\b',
            'credit_cards': r'\b(?:\d{4}[-\s]?){3}\d{4}\b'
        }
        
        # Use provided patterns or defaults
        patterns = extraction_patterns or default_patterns
        
        # Extract data using patterns
        for pattern_name, pattern in patterns.items():
            try:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    structured_data[pattern_name] = list(set(matches))  # Remove duplicates
            except Exception as e:
                logger.warning(f"Pattern matching failed for {pattern_name}: {str(e)}")
        
        # Extract key-value pairs (simple heuristic)
        kv_patterns = [
            r'([A-Za-z\s]+):\s*([^\n\r]+)',  # Key: Value
            r'([A-Za-z\s]+)=\s*([^\n\r]+)',  # Key=Value
        ]
        
        key_values = {}
        for pattern in kv_patterns:
            matches = re.findall(pattern, text)
            for key, value in matches:
                key = key.strip()
                value = value.strip()
                if len(key) < 50 and len(value) < 200:  # Reasonable limits
                    key_values[key] = value
        
        if key_values:
            structured_data['key_value_pairs'] = key_values
        
        return structured_data
    
    def get_processing_statistics(self) -> Dict[str, Any]:
        """Get processing statistics and supported formats"""
        return {
            'supported_formats': list(self.supported_types.keys()),
            'features': {
                'ocr': TESSERACT_AVAILABLE,
                'pdf': PDF_AVAILABLE,
                'docx': DOCX_AVAILABLE,
                'excel': EXCEL_AVAILABLE,
                'powerpoint': PPTX_AVAILABLE,
                'language_detection': LANG_DETECT_AVAILABLE
            },
            'limits': {
                'max_file_size': self.max_file_size,
                'max_pages': self.max_pages
            }
        }


# Global document processor instance
document_processor = DocumentProcessor()


# Utility functions for common document processing tasks
async def process_uploaded_file(file_content: bytes, 
                              filename: str,
                              enable_ocr: bool = True,
                              extract_tables: bool = True) -> ProcessingResult:
    """
    Utility function to process an uploaded file with common options
    """
    options = ProcessingOptions(
        ocr_enabled=enable_ocr,
        extract_tables=extract_tables,
        extract_metadata=True,
        clean_text=True,
        detect_language=True
    )
    
    return await document_processor.process_document(file_content, filename, options)


async def extract_text_only(file_content: bytes, filename: str) -> str:
    """
    Utility function to extract only text content from a document
    """
    result = await process_uploaded_file(file_content, filename, enable_ocr=True, extract_tables=False)
    return result.text_content if result.success else ""


async def batch_process_documents(file_list: List[Tuple[bytes, str]],
                                enable_ocr: bool = True) -> List[ProcessingResult]:
    """
    Utility function to process multiple documents in batch
    """
    options = ProcessingOptions(
        ocr_enabled=enable_ocr,
        extract_tables=True,
        extract_metadata=True,
        clean_text=True
    )
    
    return await document_processor.process_multiple_documents(file_list, options)