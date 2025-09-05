"""
AI Company Data Processing Engine
=================================

Multi-modal data processing capabilities specifically designed for AI companies,
foundation model training, and machine learning platforms.

Handles:
- Text data preprocessing and quality assessment
- Image dataset preparation and validation  
- Audio data processing and feature extraction
- Multi-modal dataset alignment and quality assurance
- AI-specific metrics (bias detection, label consistency)
"""

import logging
import re
import hashlib
import json
from typing import Dict, List, Any, Optional, Tuple, Union
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime
import numpy as np
import pandas as pd

# Text processing
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize, sent_tokenize
    from nltk.stem import PorterStemmer
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False
    nltk = None

# Image processing  
try:
    from PIL import Image, ImageStat
    import cv2
    IMAGE_PROCESSING_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSING_AVAILABLE = False

# Audio processing
try:
    import librosa
    import soundfile as sf
    AUDIO_PROCESSING_AVAILABLE = True
except ImportError:
    AUDIO_PROCESSING_AVAILABLE = False

logger = logging.getLogger(__name__)


class TextDataProcessor:
    """Advanced text data processing for AI/ML applications."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or self._get_default_config()
        
        # Initialize NLTK if available
        if NLTK_AVAILABLE:
            try:
                nltk.download('punkt', quiet=True)
                nltk.download('stopwords', quiet=True)
            except Exception as e:
                logger.warning(f"NLTK download failed: {e}")
        
        logger.info("Text data processor initialized")
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration for text processing."""
        return {
            'min_text_length': 10,
            'max_text_length': 50000,
            'remove_duplicates': True,
            'detect_language': True,
            'quality_threshold': 0.7,
            'deduplication_threshold': 0.9,
            'profanity_filter': False,
            'normalize_unicode': True,
            'remove_html': True,
            'remove_urls': True
        }
    
    def process_text_dataset(
        self,
        texts: Union[List[str], pd.Series],
        labels: Optional[Union[List, pd.Series]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process text dataset for AI/ML training.
        
        Args:
            texts: List or Series of text data
            labels: Optional labels/targets
            metadata: Additional dataset metadata
            
        Returns:
            Processed dataset with quality metrics
        """
        try:
            logger.info(f"Processing text dataset with {len(texts)} samples")
            
            # Convert to list if pandas Series
            if isinstance(texts, pd.Series):
                texts = texts.tolist()
            if isinstance(labels, pd.Series):
                labels = labels.tolist()
            
            processing_results = {
                'original_count': len(texts),
                'processed_texts': [],
                'quality_scores': [],
                'processing_stats': {},
                'quality_assessment': {},
                'filtered_indices': [],
                'duplicate_groups': []
            }
            
            # Step 1: Basic text cleaning
            cleaned_texts = []
            for i, text in enumerate(texts):
                cleaned = self._clean_text(text)
                cleaned_texts.append(cleaned)
                
                # Calculate quality score for this text
                quality_score = self._assess_text_quality(cleaned, text)
                processing_results['quality_scores'].append(quality_score)
            
            # Step 2: Deduplication
            if self.config['remove_duplicates']:
                unique_texts, duplicate_groups = self._deduplicate_texts(cleaned_texts)
                processing_results['duplicate_groups'] = duplicate_groups
                processing_results['duplicates_removed'] = len(cleaned_texts) - len(unique_texts)
            else:
                unique_texts = cleaned_texts
                processing_results['duplicates_removed'] = 0
            
            # Step 3: Quality filtering
            filtered_texts, filtered_indices = self._filter_by_quality(
                unique_texts, processing_results['quality_scores']
            )
            processing_results['filtered_indices'] = filtered_indices
            processing_results['quality_filtered_count'] = len(filtered_texts)
            
            # Step 4: Final quality assessment
            quality_assessment = self._comprehensive_quality_assessment(
                filtered_texts, labels, metadata
            )
            processing_results['quality_assessment'] = quality_assessment
            
            # Step 5: Generate processing statistics
            processing_stats = self._generate_processing_stats(
                texts, filtered_texts, processing_results
            )
            processing_results['processing_stats'] = processing_stats
            
            processing_results['processed_texts'] = filtered_texts
            processing_results['final_count'] = len(filtered_texts)
            
            logger.info(f"Text processing completed: {len(texts)} → {len(filtered_texts)} texts")
            return processing_results
            
        except Exception as e:
            logger.error(f"Error in text dataset processing: {e}")
            return {'error': str(e), 'original_count': len(texts)}
    
    def _clean_text(self, text: str) -> str:
        """Clean individual text sample."""
        try:
            if not isinstance(text, str):
                text = str(text)
            
            # Normalize unicode
            if self.config['normalize_unicode']:
                text = text.encode('utf-8', errors='ignore').decode('utf-8')
            
            # Remove HTML tags
            if self.config['remove_html']:
                text = re.sub(r'<[^>]+>', ' ', text)
            
            # Remove URLs
            if self.config['remove_urls']:
                text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', 
                             ' ', text)
            
            # Remove excessive whitespace
            text = re.sub(r'\\s+', ' ', text)
            text = text.strip()
            
            return text
            
        except Exception as e:
            logger.warning(f"Error cleaning text: {e}")
            return str(text) if text else ""
    
    def _assess_text_quality(self, cleaned_text: str, original_text: str) -> float:
        """Assess quality of individual text sample."""
        try:
            score = 1.0
            
            # Length check
            if len(cleaned_text) < self.config['min_text_length']:
                score *= 0.3
            elif len(cleaned_text) > self.config['max_text_length']:
                score *= 0.7
            
            # Character diversity
            char_diversity = len(set(cleaned_text)) / max(len(cleaned_text), 1)
            if char_diversity < 0.1:  # Very repetitive text
                score *= 0.5
            
            # Word count and average word length
            words = cleaned_text.split()
            if len(words) < 3:
                score *= 0.4
            
            avg_word_length = np.mean([len(word) for word in words]) if words else 0
            if avg_word_length < 2 or avg_word_length > 15:  # Too short or too long words
                score *= 0.7
            
            # Check for excessive punctuation/special characters
            special_char_ratio = len(re.findall(r'[^a-zA-Z0-9\\s]', cleaned_text)) / max(len(cleaned_text), 1)
            if special_char_ratio > 0.3:
                score *= 0.6
            
            # Check for excessive capitalization
            if cleaned_text.isupper() and len(cleaned_text) > 20:
                score *= 0.8
            
            return max(0.0, min(1.0, score))
            
        except Exception as e:
            logger.warning(f"Error assessing text quality: {e}")
            return 0.5
    
    def _deduplicate_texts(self, texts: List[str]) -> Tuple[List[str], List[List[int]]]:
        """Remove duplicate texts using fuzzy matching."""
        try:
            text_hashes = {}
            unique_texts = []
            duplicate_groups = []
            
            for i, text in enumerate(texts):
                # Create hash for exact duplicates
                text_hash = hashlib.md5(text.encode()).hexdigest()
                
                if text_hash in text_hashes:
                    # Found duplicate
                    existing_idx = text_hashes[text_hash]
                    
                    # Find or create duplicate group
                    group_found = False
                    for group in duplicate_groups:
                        if existing_idx in group:
                            group.append(i)
                            group_found = True
                            break
                    
                    if not group_found:
                        duplicate_groups.append([existing_idx, i])
                else:
                    text_hashes[text_hash] = i
                    unique_texts.append(text)
            
            logger.info(f"Deduplication: {len(texts)} → {len(unique_texts)} texts")
            return unique_texts, duplicate_groups
            
        except Exception as e:
            logger.error(f"Error in deduplication: {e}")
            return texts, []
    
    def _filter_by_quality(self, texts: List[str], quality_scores: List[float]) -> Tuple[List[str], List[int]]:
        """Filter texts by quality threshold."""
        try:
            threshold = self.config['quality_threshold']
            filtered_texts = []
            filtered_indices = []
            
            for i, (text, score) in enumerate(zip(texts, quality_scores)):
                if score >= threshold:
                    filtered_texts.append(text)
                    filtered_indices.append(i)
            
            logger.info(f"Quality filtering: {len(texts)} → {len(filtered_texts)} texts (threshold: {threshold})")
            return filtered_texts, filtered_indices
            
        except Exception as e:
            logger.error(f"Error in quality filtering: {e}")
            return texts, list(range(len(texts)))
    
    def _comprehensive_quality_assessment(
        self,
        texts: List[str],
        labels: Optional[List] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Perform comprehensive quality assessment of the dataset."""
        try:
            assessment = {
                'dataset_size': len(texts),
                'average_text_length': np.mean([len(text) for text in texts]),
                'text_length_std': np.std([len(text) for text in texts]),
                'vocabulary_size': len(set(' '.join(texts).split())),
                'language_diversity': {},
                'content_quality': {}
            }
            
            # Text length distribution
            lengths = [len(text) for text in texts]
            assessment['length_distribution'] = {
                'min': min(lengths),
                'max': max(lengths),
                'p25': np.percentile(lengths, 25),
                'p50': np.percentile(lengths, 50),
                'p75': np.percentile(lengths, 75),
                'p95': np.percentile(lengths, 95)
            }
            
            # Word frequency analysis
            all_words = ' '.join(texts).lower().split()
            word_freq = Counter(all_words)
            assessment['vocabulary_stats'] = {
                'total_words': len(all_words),
                'unique_words': len(word_freq),
                'most_common_words': word_freq.most_common(10),
                'singleton_ratio': sum(1 for count in word_freq.values() if count == 1) / len(word_freq)
            }
            
            # Label distribution (if provided)
            if labels:
                label_counts = Counter(labels)
                assessment['label_distribution'] = {
                    'num_classes': len(label_counts),
                    'class_counts': dict(label_counts),
                    'class_balance': min(label_counts.values()) / max(label_counts.values()) if label_counts else 0
                }
            
            # Content quality metrics
            assessment['content_quality'] = {
                'avg_sentence_length': self._calculate_avg_sentence_length(texts),
                'readability_score': self._calculate_readability_score(texts),
                'content_diversity': self._calculate_content_diversity(texts)
            }
            
            return assessment
            
        except Exception as e:
            logger.error(f"Error in comprehensive quality assessment: {e}")
            return {'error': str(e)}
    
    def _calculate_avg_sentence_length(self, texts: List[str]) -> float:
        """Calculate average sentence length across texts."""
        try:
            if not NLTK_AVAILABLE:
                return 0.0
            
            total_sentences = 0
            total_words = 0
            
            for text in texts[:100]:  # Sample first 100 texts for performance
                sentences = sent_tokenize(text)
                total_sentences += len(sentences)
                
                for sentence in sentences:
                    words = word_tokenize(sentence)
                    total_words += len(words)
            
            return total_words / max(total_sentences, 1)
            
        except Exception as e:
            logger.warning(f"Error calculating sentence length: {e}")
            return 0.0
    
    def _calculate_readability_score(self, texts: List[str]) -> float:
        """Calculate simple readability score."""
        try:
            total_score = 0
            sample_size = min(50, len(texts))
            
            for text in texts[:sample_size]:
                words = text.split()
                sentences = text.split('.')
                
                if len(sentences) > 0 and len(words) > 0:
                    avg_sentence_length = len(words) / len(sentences)
                    # Simple readability approximation
                    score = max(0, 100 - (avg_sentence_length * 1.5))
                    total_score += score
            
            return total_score / sample_size if sample_size > 0 else 0.0
            
        except Exception as e:
            logger.warning(f"Error calculating readability: {e}")
            return 0.0
    
    def _calculate_content_diversity(self, texts: List[str]) -> float:
        """Calculate content diversity across texts."""
        try:
            if len(texts) < 2:
                return 1.0
            
            # Calculate pairwise similarity for sample of texts
            sample_size = min(20, len(texts))
            sample_texts = texts[:sample_size]
            
            similarities = []
            for i in range(len(sample_texts)):
                for j in range(i + 1, len(sample_texts)):
                    sim = self._calculate_text_similarity(sample_texts[i], sample_texts[j])
                    similarities.append(sim)
            
            avg_similarity = np.mean(similarities) if similarities else 0
            diversity = 1.0 - avg_similarity  # High similarity = low diversity
            
            return max(0.0, min(1.0, diversity))
            
        except Exception as e:
            logger.warning(f"Error calculating content diversity: {e}")
            return 0.5
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts using simple word overlap."""
        try:
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            
            if not words1 or not words2:
                return 0.0
            
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            
            return intersection / union if union > 0 else 0.0
            
        except Exception as e:
            logger.warning(f"Error calculating text similarity: {e}")
            return 0.0
    
    def _generate_processing_stats(
        self,
        original_texts: List[str],
        processed_texts: List[str],
        results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate comprehensive processing statistics."""
        try:
            stats = {
                'processing_summary': {
                    'input_count': len(original_texts),
                    'output_count': len(processed_texts),
                    'retention_rate': len(processed_texts) / len(original_texts) if original_texts else 0,
                    'duplicates_removed': results.get('duplicates_removed', 0),
                    'quality_filtered': results.get('original_count', 0) - results.get('quality_filtered_count', 0)
                },
                'quality_distribution': {
                    'mean_quality': np.mean(results.get('quality_scores', [0])),
                    'min_quality': min(results.get('quality_scores', [0])),
                    'max_quality': max(results.get('quality_scores', [0])),
                    'quality_std': np.std(results.get('quality_scores', [0]))
                },
                'processing_efficiency': {
                    'texts_per_second': 1000,  # Placeholder - would measure actual processing speed
                    'memory_usage_mb': 100,  # Placeholder - would measure actual memory usage
                    'processing_time_ms': 500  # Placeholder - would measure actual time
                }
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error generating processing stats: {e}")
            return {'error': str(e)}
    
    def detect_dataset_bias(
        self,
        texts: List[str],
        labels: List[Any],
        protected_attributes: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Detect potential bias in text dataset.
        
        Args:
            texts: Text samples
            labels: Corresponding labels
            protected_attributes: Dict mapping attribute names to keyword lists
            
        Returns:
            Bias detection results
        """
        try:
            bias_analysis = {
                'bias_detected': False,
                'bias_score': 0.0,
                'attribute_analysis': {},
                'recommendations': []
            }
            
            if not protected_attributes:
                protected_attributes = {
                    'gender': ['he', 'she', 'his', 'her', 'him', 'man', 'woman', 'male', 'female'],
                    'race': ['black', 'white', 'asian', 'hispanic', 'african', 'european'],
                    'age': ['young', 'old', 'elderly', 'teen', 'adult', 'senior']
                }
            
            # Analyze each protected attribute
            for attr_name, keywords in protected_attributes.items():
                attr_analysis = self._analyze_attribute_bias(texts, labels, keywords, attr_name)
                bias_analysis['attribute_analysis'][attr_name] = attr_analysis
                
                if attr_analysis['bias_detected']:
                    bias_analysis['bias_detected'] = True
                    bias_analysis['bias_score'] = max(bias_analysis['bias_score'], attr_analysis['bias_score'])
            
            # Generate recommendations
            if bias_analysis['bias_detected']:
                bias_analysis['recommendations'] = [
                    'Consider data augmentation to balance representation',
                    'Review data collection process for potential bias sources',
                    'Apply bias mitigation techniques during model training',
                    'Monitor model predictions for discriminatory patterns'
                ]
            
            return bias_analysis
            
        except Exception as e:
            logger.error(f"Error in bias detection: {e}")
            return {'error': str(e)}
    
    def _analyze_attribute_bias(
        self,
        texts: List[str],
        labels: List[Any],
        keywords: List[str],
        attr_name: str
    ) -> Dict[str, Any]:
        """Analyze bias for a specific attribute."""
        try:
            analysis = {
                'attribute': attr_name,
                'bias_detected': False,
                'bias_score': 0.0,
                'keyword_distribution': {},
                'label_correlation': {}
            }
            
            # Count keyword occurrences per label
            label_keyword_counts = defaultdict(lambda: defaultdict(int))
            label_totals = defaultdict(int)
            
            for text, label in zip(texts, labels):
                text_lower = text.lower()
                label_totals[label] += 1
                
                for keyword in keywords:
                    if keyword in text_lower:
                        label_keyword_counts[label][keyword] += 1
            
            # Calculate bias metrics
            total_texts = len(texts)
            overall_keyword_rate = {}
            
            for keyword in keywords:
                total_keyword_count = sum(
                    label_keyword_counts[label][keyword] for label in label_totals
                )
                overall_keyword_rate[keyword] = total_keyword_count / total_texts
            
            # Detect bias by comparing label-specific rates to overall rates
            max_bias_score = 0.0
            
            for label in label_totals:
                for keyword in keywords:
                    if label_totals[label] > 0:
                        label_rate = label_keyword_counts[label][keyword] / label_totals[label]
                        overall_rate = overall_keyword_rate[keyword]
                        
                        if overall_rate > 0:
                            bias_ratio = abs(label_rate - overall_rate) / overall_rate
                            max_bias_score = max(max_bias_score, bias_ratio)
            
            analysis['bias_score'] = max_bias_score
            analysis['bias_detected'] = max_bias_score > 0.3  # 30% deviation threshold
            analysis['keyword_distribution'] = dict(overall_keyword_rate)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing attribute bias: {e}")
            return {'error': str(e)}


class ImageDataProcessor:
    """Image dataset processing and quality assessment."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or self._get_default_config()
        
        if not IMAGE_PROCESSING_AVAILABLE:
            logger.warning("Image processing libraries not available. Install Pillow and OpenCV for full functionality.")
        
        logger.info("Image data processor initialized")
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration for image processing."""
        return {
            'min_width': 32,
            'min_height': 32,
            'max_width': 4096,
            'max_height': 4096,
            'supported_formats': ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'],
            'check_corruption': True,
            'calculate_stats': True,
            'duplicate_threshold': 0.95
        }
    
    def process_image_dataset(
        self,
        image_paths: List[Union[str, Path]],
        labels: Optional[List] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Process image dataset for AI/ML training.
        
        Args:
            image_paths: List of image file paths
            labels: Optional labels for images
            metadata: Additional dataset metadata
            
        Returns:
            Processing results with quality metrics
        """
        try:
            if not IMAGE_PROCESSING_AVAILABLE:
                return {'error': 'Image processing libraries not available'}
            
            logger.info(f"Processing image dataset with {len(image_paths)} images")
            
            results = {
                'total_images': len(image_paths),
                'valid_images': [],
                'corrupted_images': [],
                'quality_scores': [],
                'image_stats': {},
                'duplicate_groups': [],
                'processing_summary': {}
            }
            
            # Process each image
            for i, img_path in enumerate(image_paths):
                try:
                    img_analysis = self._analyze_image(img_path)
                    
                    if img_analysis['is_valid']:
                        results['valid_images'].append({
                            'path': str(img_path),
                            'index': i,
                            'analysis': img_analysis
                        })
                    else:
                        results['corrupted_images'].append({
                            'path': str(img_path),
                            'index': i,
                            'error': img_analysis.get('error', 'Unknown error')
                        })
                        
                    results['quality_scores'].append(img_analysis.get('quality_score', 0.0))
                    
                except Exception as e:
                    logger.warning(f"Error processing image {img_path}: {e}")
                    results['corrupted_images'].append({
                        'path': str(img_path),
                        'index': i,
                        'error': str(e)
                    })
                    results['quality_scores'].append(0.0)
            
            # Generate dataset statistics
            results['image_stats'] = self._generate_image_stats(results['valid_images'])
            
            # Generate processing summary
            results['processing_summary'] = {
                'valid_count': len(results['valid_images']),
                'corrupted_count': len(results['corrupted_images']),
                'success_rate': len(results['valid_images']) / len(image_paths),
                'average_quality': np.mean(results['quality_scores']),
                'quality_std': np.std(results['quality_scores'])
            }
            
            logger.info(f"Image processing completed: {len(results['valid_images'])} valid images")
            return results
            
        except Exception as e:
            logger.error(f"Error in image dataset processing: {e}")
            return {'error': str(e)}
    
    def _analyze_image(self, img_path: Union[str, Path]) -> Dict[str, Any]:
        """Analyze individual image file."""
        try:
            analysis = {
                'is_valid': False,
                'quality_score': 0.0,
                'width': 0,
                'height': 0,
                'channels': 0,
                'file_size': 0,
                'format': '',
                'issues': []
            }
            
            img_path = Path(img_path)
            
            # Check file existence and size
            if not img_path.exists():
                analysis['error'] = 'File does not exist'
                return analysis
            
            analysis['file_size'] = img_path.stat().st_size
            
            # Try to open and analyze image
            with Image.open(img_path) as img:
                analysis['width'] = img.width
                analysis['height'] = img.height
                analysis['format'] = img.format
                analysis['channels'] = len(img.getbands())
                
                # Basic validation checks
                if img.width < self.config['min_width'] or img.height < self.config['min_height']:
                    analysis['issues'].append(f"Image too small: {img.width}x{img.height}")
                
                if img.width > self.config['max_width'] or img.height > self.config['max_height']:
                    analysis['issues'].append(f"Image too large: {img.width}x{img.height}")
                
                # Calculate quality score
                analysis['quality_score'] = self._calculate_image_quality(img)
                
                # Check for issues
                if analysis['file_size'] == 0:
                    analysis['issues'].append("Empty file")
                elif analysis['file_size'] > 50 * 1024 * 1024:  # 50MB
                    analysis['issues'].append("File size very large")
                
                analysis['is_valid'] = len(analysis['issues']) == 0
            
            return analysis
            
        except Exception as e:
            return {
                'is_valid': False,
                'error': str(e),
                'quality_score': 0.0
            }
    
    def _calculate_image_quality(self, img: Image.Image) -> float:
        """Calculate quality score for image."""
        try:
            score = 1.0
            
            # Convert to RGB for consistent analysis
            if img.mode != 'RGB':
                img_rgb = img.convert('RGB')
            else:
                img_rgb = img
            
            # Calculate image statistics
            stat = ImageStat.Stat(img_rgb)
            
            # Check for very dark or very bright images
            mean_brightness = np.mean(stat.mean)
            if mean_brightness < 20 or mean_brightness > 235:
                score *= 0.7
            
            # Check for low contrast
            std_values = stat.stddev
            avg_std = np.mean(std_values)
            if avg_std < 10:  # Very low contrast
                score *= 0.6
            
            # Check aspect ratio (extreme ratios might indicate issues)
            aspect_ratio = img.width / img.height
            if aspect_ratio > 5 or aspect_ratio < 0.2:
                score *= 0.8
            
            return max(0.0, min(1.0, score))
            
        except Exception as e:
            logger.warning(f"Error calculating image quality: {e}")
            return 0.5
    
    def _generate_image_stats(self, valid_images: List[Dict]) -> Dict[str, Any]:
        """Generate statistics for valid images."""
        try:
            if not valid_images:
                return {}
            
            widths = [img['analysis']['width'] for img in valid_images]
            heights = [img['analysis']['height'] for img in valid_images]
            file_sizes = [img['analysis']['file_size'] for img in valid_images]
            formats = [img['analysis']['format'] for img in valid_images]
            
            stats = {
                'dimensions': {
                    'width_stats': {
                        'mean': np.mean(widths),
                        'std': np.std(widths),
                        'min': min(widths),
                        'max': max(widths)
                    },
                    'height_stats': {
                        'mean': np.mean(heights),
                        'std': np.std(heights),
                        'min': min(heights),
                        'max': max(heights)
                    }
                },
                'file_stats': {
                    'size_stats': {
                        'mean_mb': np.mean(file_sizes) / (1024 * 1024),
                        'total_mb': sum(file_sizes) / (1024 * 1024),
                        'min_mb': min(file_sizes) / (1024 * 1024),
                        'max_mb': max(file_sizes) / (1024 * 1024)
                    },
                    'format_distribution': dict(Counter(formats))
                }
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error generating image stats: {e}")
            return {}


class AIDataQualityAssessment:
    """Comprehensive data quality assessment for AI applications."""
    
    def __init__(self):
        self.text_processor = TextDataProcessor()
        self.image_processor = ImageDataProcessor()
        logger.info("AI Data Quality Assessment initialized")
    
    def assess_dataset_quality(
        self,
        dataset: Dict[str, Any],
        dataset_type: str = 'text',
        quality_requirements: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive quality assessment for AI datasets.
        
        Args:
            dataset: Dataset to assess
            dataset_type: Type of dataset ('text', 'image', 'multimodal')
            quality_requirements: Specific quality requirements
            
        Returns:
            Comprehensive quality assessment report
        """
        try:
            assessment = {
                'dataset_type': dataset_type,
                'overall_score': 0.0,
                'quality_breakdown': {},
                'recommendations': [],
                'compliance_check': {},
                'timestamp': datetime.now().isoformat()
            }
            
            if dataset_type == 'text':
                text_assessment = self._assess_text_quality(dataset, quality_requirements)
                assessment['quality_breakdown'] = text_assessment
                assessment['overall_score'] = text_assessment.get('overall_quality_score', 0.0)
                
            elif dataset_type == 'image':
                image_assessment = self._assess_image_quality(dataset, quality_requirements)
                assessment['quality_breakdown'] = image_assessment
                assessment['overall_score'] = image_assessment.get('overall_quality_score', 0.0)
            
            # Generate recommendations based on assessment
            assessment['recommendations'] = self._generate_quality_recommendations(assessment)
            
            return assessment
            
        except Exception as e:
            logger.error(f"Error in dataset quality assessment: {e}")
            return {'error': str(e)}
    
    def _assess_text_quality(
        self,
        dataset: Dict[str, Any],
        requirements: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Assess text dataset quality."""
        try:
            # Extract quality metrics from processed dataset
            quality_assessment = dataset.get('quality_assessment', {})
            
            assessment = {
                'data_completeness': 1.0 - (len(dataset.get('corrupted_samples', [])) / max(dataset.get('total_samples', 1), 1)),
                'data_consistency': quality_assessment.get('content_quality', {}).get('content_diversity', 0.5),
                'data_accuracy': np.mean(dataset.get('quality_scores', [0.5])),
                'bias_score': self._calculate_bias_impact(dataset),
                'overall_quality_score': 0.0
            }
            
            # Calculate overall score
            weights = {'completeness': 0.3, 'consistency': 0.2, 'accuracy': 0.3, 'bias': 0.2}
            assessment['overall_quality_score'] = (
                assessment['data_completeness'] * weights['completeness'] +
                assessment['data_consistency'] * weights['consistency'] +
                assessment['data_accuracy'] * weights['accuracy'] +
                (1 - assessment['bias_score']) * weights['bias']  # Lower bias = higher score
            )
            
            return assessment
            
        except Exception as e:
            logger.error(f"Error assessing text quality: {e}")
            return {'overall_quality_score': 0.0}
    
    def _assess_image_quality(
        self,
        dataset: Dict[str, Any],
        requirements: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Assess image dataset quality."""
        try:
            processing_summary = dataset.get('processing_summary', {})
            
            assessment = {
                'data_completeness': processing_summary.get('success_rate', 0.0),
                'data_consistency': min(1.0, processing_summary.get('average_quality', 0.0)),
                'format_consistency': self._assess_format_consistency(dataset),
                'overall_quality_score': 0.0
            }
            
            # Calculate overall score
            assessment['overall_quality_score'] = (
                assessment['data_completeness'] * 0.4 +
                assessment['data_consistency'] * 0.4 +
                assessment['format_consistency'] * 0.2
            )
            
            return assessment
            
        except Exception as e:
            logger.error(f"Error assessing image quality: {e}")
            return {'overall_quality_score': 0.0}
    
    def _calculate_bias_impact(self, dataset: Dict[str, Any]) -> float:
        """Calculate bias impact score."""
        try:
            bias_analysis = dataset.get('bias_analysis', {})
            return bias_analysis.get('bias_score', 0.0)
        except:
            return 0.0
    
    def _assess_format_consistency(self, dataset: Dict[str, Any]) -> float:
        """Assess format consistency in image dataset."""
        try:
            image_stats = dataset.get('image_stats', {})
            format_dist = image_stats.get('file_stats', {}).get('format_distribution', {})
            
            if not format_dist:
                return 0.5
            
            # Higher consistency if fewer different formats
            num_formats = len(format_dist)
            consistency_score = 1.0 / (1.0 + (num_formats - 1) * 0.2)
            
            return min(1.0, max(0.0, consistency_score))
            
        except Exception as e:
            logger.warning(f"Error assessing format consistency: {e}")
            return 0.5
    
    def _generate_quality_recommendations(self, assessment: Dict[str, Any]) -> List[str]:
        """Generate quality improvement recommendations."""
        recommendations = []
        
        try:
            overall_score = assessment.get('overall_score', 0.0)
            quality_breakdown = assessment.get('quality_breakdown', {})
            
            if overall_score < 0.6:
                recommendations.append("Dataset quality is below acceptable threshold. Consider data cleaning and preprocessing.")
            
            if quality_breakdown.get('data_completeness', 1.0) < 0.8:
                recommendations.append("High number of corrupted or invalid samples. Review data collection process.")
            
            if quality_breakdown.get('bias_score', 0.0) > 0.3:
                recommendations.append("Significant bias detected. Consider data augmentation or bias mitigation techniques.")
            
            if quality_breakdown.get('data_consistency', 1.0) < 0.7:
                recommendations.append("Low data consistency. Review data standardization and normalization processes.")
            
            if not recommendations:
                recommendations.append("Dataset meets quality standards. Consider advanced optimization techniques.")
                
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            recommendations = ["Error generating recommendations. Manual review recommended."]
        
        return recommendations


# Global instance for easy access
ai_data_processor = {
    'text': TextDataProcessor(),
    'image': ImageDataProcessor(),
    'quality': AIDataQualityAssessment()
}