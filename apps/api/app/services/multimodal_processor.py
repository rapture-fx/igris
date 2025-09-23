"""
Multi-Modal Data Processing Service
==================================

Real implementation for processing text + image data for AI companies.
Provides practical data preparation for multi-modal AI models.

Features:
- Text-Image dataset alignment and validation
- Quality assessment across modalities
- Feature extraction and preprocessing
- Export to popular ML frameworks
"""

import logging
import json
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass
import pandas as pd
import numpy as np

# Text processing
try:
    import nltk
    from nltk.tokenize import word_tokenize, sent_tokenize
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False

# Image processing
try:
    from PIL import Image, ImageStat
    import cv2
    IMAGE_PROCESSING_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSING_AVAILABLE = False

logger = logging.getLogger(__name__)

@dataclass
class MultiModalDataset:
    """Container for multi-modal dataset"""
    text_data: List[str]
    image_paths: List[str]
    labels: Optional[List[Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    aligned: bool = False

@dataclass
class QualityReport:
    """Quality assessment report for multi-modal data"""
    overall_score: float
    text_quality: Dict[str, Any]
    image_quality: Dict[str, Any]
    alignment_quality: Dict[str, Any]
    recommendations: List[str]

class MultiModalProcessor:
    """Real multi-modal data processing for AI companies"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or self._get_default_config()

        # Initialize NLTK if available
        if NLTK_AVAILABLE:
            try:
                nltk.download('punkt', quiet=True)
                nltk.download('stopwords', quiet=True)
            except Exception as e:
                logger.warning(f"NLTK setup failed: {e}")

        logger.info("Multi-modal processor initialized")

    def _get_default_config(self) -> Dict[str, Any]:
        """Default configuration for multi-modal processing"""
        return {
            'min_text_length': 10,
            'max_text_length': 10000,
            'min_image_width': 32,
            'min_image_height': 32,
            'max_image_size_mb': 50,
            'supported_image_formats': ['.jpg', '.jpeg', '.png', '.webp'],
            'quality_threshold': 0.7,
            'alignment_threshold': 0.8
        }

    def process_multimodal_dataset(
        self,
        text_data: List[str],
        image_paths: List[str],
        labels: Optional[List[Any]] = None,
        validate_alignment: bool = True
    ) -> Dict[str, Any]:
        """
        Process multi-modal dataset for AI training

        Args:
            text_data: List of text samples
            image_paths: List of image file paths
            labels: Optional labels/targets
            validate_alignment: Whether to validate text-image alignment

        Returns:
            Processing results with quality metrics and processed data
        """
        logger.info(f"Processing multi-modal dataset: {len(text_data)} texts, {len(image_paths)} images")

        try:
            # Create dataset container
            dataset = MultiModalDataset(
                text_data=text_data,
                image_paths=image_paths,
                labels=labels
            )

            # Step 1: Basic validation
            validation_results = self._validate_dataset(dataset)
            if not validation_results['valid']:
                return {
                    'status': 'error',
                    'error': validation_results['error'],
                    'validation_results': validation_results
                }

            # Step 2: Process text data
            text_results = self._process_text_data(dataset.text_data)

            # Step 3: Process image data
            image_results = self._process_image_data(dataset.image_paths)

            # Step 4: Alignment validation (if requested)
            alignment_results = {}
            if validate_alignment:
                alignment_results = self._validate_alignment(dataset)

            # Step 5: Quality assessment
            quality_report = self._assess_overall_quality(
                text_results, image_results, alignment_results
            )

            # Step 6: Generate processed dataset
            processed_dataset = self._create_processed_dataset(
                dataset, text_results, image_results
            )

            return {
                'status': 'success',
                'dataset_stats': {
                    'total_samples': len(text_data),
                    'text_samples': len(text_data),
                    'image_samples': len(image_paths),
                    'labeled_samples': len(labels) if labels else 0
                },
                'text_processing': text_results,
                'image_processing': image_results,
                'alignment_validation': alignment_results,
                'quality_report': quality_report,
                'processed_dataset': processed_dataset,
                'export_options': self._get_export_options()
            }

        except Exception as e:
            logger.error(f"Multi-modal processing failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def _validate_dataset(self, dataset: MultiModalDataset) -> Dict[str, Any]:
        """Validate multi-modal dataset structure"""

        # Check basic requirements
        if not dataset.text_data or not dataset.image_paths:
            return {
                'valid': False,
                'error': 'Both text and image data are required'
            }

        # Check length alignment
        if len(dataset.text_data) != len(dataset.image_paths):
            return {
                'valid': False,
                'error': f'Text and image counts must match: {len(dataset.text_data)} vs {len(dataset.image_paths)}'
            }

        # Check labels if provided
        if dataset.labels and len(dataset.labels) != len(dataset.text_data):
            return {
                'valid': False,
                'error': f'Label count must match data: {len(dataset.labels)} vs {len(dataset.text_data)}'
            }

        return {'valid': True}

    def _process_text_data(self, text_data: List[str]) -> Dict[str, Any]:
        """Process text component of multi-modal data"""

        results = {
            'total_texts': len(text_data),
            'valid_texts': 0,
            'average_length': 0,
            'language_distribution': {},
            'quality_issues': [],
            'processed_texts': []
        }

        valid_texts = []
        total_length = 0

        for i, text in enumerate(text_data):
            # Basic validation
            if not isinstance(text, str) or len(text.strip()) < self.config['min_text_length']:
                results['quality_issues'].append(f"Text {i}: Too short or invalid")
                continue

            if len(text) > self.config['max_text_length']:
                results['quality_issues'].append(f"Text {i}: Exceeds maximum length")
                text = text[:self.config['max_text_length']]

            # Clean and normalize
            cleaned_text = text.strip()

            # Basic statistics
            total_length += len(cleaned_text)
            valid_texts.append(cleaned_text)
            results['valid_texts'] += 1

        if valid_texts:
            results['average_length'] = total_length / len(valid_texts)
            results['processed_texts'] = valid_texts

        return results

    def _process_image_data(self, image_paths: List[str]) -> Dict[str, Any]:
        """Process image component of multi-modal data"""

        results = {
            'total_images': len(image_paths),
            'valid_images': 0,
            'average_size': [0, 0],  # [width, height]
            'format_distribution': {},
            'quality_issues': [],
            'processed_images': []
        }

        if not IMAGE_PROCESSING_AVAILABLE:
            results['quality_issues'].append("Image processing libraries not available")
            return results

        valid_images = []
        total_width = 0
        total_height = 0

        for i, img_path in enumerate(image_paths):
            try:
                # Check if file exists
                img_path_obj = Path(img_path)
                if not img_path_obj.exists():
                    results['quality_issues'].append(f"Image {i}: File not found")
                    continue

                # Check file format
                if img_path_obj.suffix.lower() not in self.config['supported_image_formats']:
                    results['quality_issues'].append(f"Image {i}: Unsupported format")
                    continue

                # Check file size
                file_size_mb = img_path_obj.stat().st_size / (1024 * 1024)
                if file_size_mb > self.config['max_image_size_mb']:
                    results['quality_issues'].append(f"Image {i}: File too large ({file_size_mb:.1f}MB)")
                    continue

                # Load and validate image
                with Image.open(img_path) as img:
                    width, height = img.size

                    # Check minimum dimensions
                    if width < self.config['min_image_width'] or height < self.config['min_image_height']:
                        results['quality_issues'].append(f"Image {i}: Too small ({width}x{height})")
                        continue

                    # Update format distribution
                    format_key = img.format or 'unknown'
                    results['format_distribution'][format_key] = results['format_distribution'].get(format_key, 0) + 1

                    # Track statistics
                    total_width += width
                    total_height += height
                    valid_images.append({
                        'path': str(img_path),
                        'width': width,
                        'height': height,
                        'format': img.format,
                        'mode': img.mode
                    })
                    results['valid_images'] += 1

            except Exception as e:
                results['quality_issues'].append(f"Image {i}: Processing error - {str(e)}")

        if valid_images:
            results['average_size'] = [
                total_width / len(valid_images),
                total_height / len(valid_images)
            ]
            results['processed_images'] = valid_images

        return results

    def _validate_alignment(self, dataset: MultiModalDataset) -> Dict[str, Any]:
        """Validate alignment between text and image data"""

        results = {
            'alignment_score': 0.0,
            'aligned_pairs': 0,
            'misaligned_pairs': [],
            'recommendations': []
        }

        # Simple heuristic: check if text mentions visual elements
        visual_keywords = [
            'image', 'picture', 'photo', 'see', 'show', 'visual', 'look',
            'color', 'red', 'blue', 'green', 'bright', 'dark'
        ]

        aligned_count = 0

        for i, (text, img_path) in enumerate(zip(dataset.text_data, dataset.image_paths)):
            # Check if text contains visual references
            text_lower = text.lower()
            has_visual_ref = any(keyword in text_lower for keyword in visual_keywords)

            # Check if image exists and is valid
            img_exists = Path(img_path).exists()

            if has_visual_ref and img_exists:
                aligned_count += 1
            elif not img_exists:
                results['misaligned_pairs'].append({
                    'index': i,
                    'issue': 'Missing image file',
                    'text_preview': text[:100] + '...' if len(text) > 100 else text
                })
            elif not has_visual_ref:
                results['misaligned_pairs'].append({
                    'index': i,
                    'issue': 'Text may not describe image',
                    'text_preview': text[:100] + '...' if len(text) > 100 else text
                })

        if len(dataset.text_data) > 0:
            results['alignment_score'] = aligned_count / len(dataset.text_data)
            results['aligned_pairs'] = aligned_count

        # Generate recommendations
        if results['alignment_score'] < self.config['alignment_threshold']:
            results['recommendations'].extend([
                'Consider reviewing text-image pairs for semantic alignment',
                'Ensure text descriptions relate to corresponding images',
                'Remove or fix misaligned pairs to improve model training'
            ])

        return results

    def _assess_overall_quality(
        self,
        text_results: Dict[str, Any],
        image_results: Dict[str, Any],
        alignment_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Assess overall quality of multi-modal dataset"""

        # Calculate component scores
        text_score = 0.0
        if text_results['total_texts'] > 0:
            text_score = text_results['valid_texts'] / text_results['total_texts']

        image_score = 0.0
        if image_results['total_images'] > 0:
            image_score = image_results['valid_images'] / image_results['total_images']

        alignment_score = alignment_results.get('alignment_score', 1.0)

        # Overall score (weighted average)
        overall_score = (text_score * 0.4 + image_score * 0.4 + alignment_score * 0.2)

        # Generate recommendations
        recommendations = []

        if text_score < 0.8:
            recommendations.append("Improve text data quality - remove short or invalid texts")

        if image_score < 0.8:
            recommendations.append("Improve image data quality - fix corrupted or invalid images")

        if alignment_score < 0.7:
            recommendations.append("Improve text-image alignment - ensure semantic consistency")

        if overall_score >= 0.8:
            recommendations.append("Dataset quality is good - ready for model training")
        elif overall_score >= 0.6:
            recommendations.append("Dataset quality is acceptable - consider improvements")
        else:
            recommendations.append("Dataset quality needs significant improvement before training")

        return {
            'overall_score': overall_score,
            'component_scores': {
                'text_quality': text_score,
                'image_quality': image_score,
                'alignment_quality': alignment_score
            },
            'recommendations': recommendations,
            'quality_level': self._get_quality_level(overall_score)
        }

    def _get_quality_level(self, score: float) -> str:
        """Get quality level description"""
        if score >= 0.9:
            return "excellent"
        elif score >= 0.8:
            return "good"
        elif score >= 0.6:
            return "acceptable"
        elif score >= 0.4:
            return "poor"
        else:
            return "very_poor"

    def _create_processed_dataset(
        self,
        original_dataset: MultiModalDataset,
        text_results: Dict[str, Any],
        image_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create processed dataset for export"""

        # Align processed text and image data
        processed_data = []

        valid_text_idx = 0
        valid_image_idx = 0

        for i in range(len(original_dataset.text_data)):
            # Check if both text and image are valid for this index
            text_valid = valid_text_idx < len(text_results.get('processed_texts', []))
            image_valid = valid_image_idx < len(image_results.get('processed_images', []))

            if text_valid and image_valid:
                sample = {
                    'index': i,
                    'text': text_results['processed_texts'][valid_text_idx],
                    'image_info': image_results['processed_images'][valid_image_idx]
                }

                if original_dataset.labels and i < len(original_dataset.labels):
                    sample['label'] = original_dataset.labels[i]

                processed_data.append(sample)
                valid_text_idx += 1
                valid_image_idx += 1

        return {
            'samples': processed_data,
            'total_valid_samples': len(processed_data),
            'schema': {
                'text': 'string',
                'image_info': 'object',
                'label': 'any' if original_dataset.labels else None
            }
        }

    def _get_export_options(self) -> List[Dict[str, Any]]:
        """Get available export options for processed dataset"""
        return [
            {
                'format': 'huggingface_datasets',
                'description': 'Export as HuggingFace Datasets format',
                'supports': ['text', 'image', 'labels']
            },
            {
                'format': 'pytorch_dataset',
                'description': 'Export as PyTorch Dataset class',
                'supports': ['text', 'image', 'labels']
            },
            {
                'format': 'tensorflow_dataset',
                'description': 'Export as TensorFlow Dataset',
                'supports': ['text', 'image', 'labels']
            },
            {
                'format': 'json_manifest',
                'description': 'Export as JSON manifest with file references',
                'supports': ['text', 'image', 'labels', 'metadata']
            }
        ]

    def export_dataset(
        self,
        processed_dataset: Dict[str, Any],
        export_format: str,
        output_path: str
    ) -> Dict[str, Any]:
        """Export processed multi-modal dataset to specified format"""

        try:
            if export_format == 'json_manifest':
                return self._export_json_manifest(processed_dataset, output_path)
            else:
                return {
                    'status': 'error',
                    'error': f'Export format {export_format} not yet implemented'
                }

        except Exception as e:
            logger.error(f"Export failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def _export_json_manifest(
        self,
        processed_dataset: Dict[str, Any],
        output_path: str
    ) -> Dict[str, Any]:
        """Export as JSON manifest file"""

        manifest = {
            'version': '1.0',
            'dataset_type': 'multimodal',
            'created_at': pd.Timestamp.now().isoformat(),
            'total_samples': processed_dataset['total_valid_samples'],
            'schema': processed_dataset['schema'],
            'samples': processed_dataset['samples']
        }

        output_file = Path(output_path)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        return {
            'status': 'success',
            'output_file': str(output_file),
            'format': 'json_manifest',
            'samples_exported': len(processed_dataset['samples'])
        }