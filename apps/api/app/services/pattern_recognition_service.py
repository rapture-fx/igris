"""
Advanced Pattern Recognition Service

This service provides comprehensive pattern recognition capabilities including:
- Text pattern recognition and NLP-based analysis
- Numerical pattern detection and time series analysis
- Structural pattern recognition in data
- ML-based pattern learning and clustering
- Business logic pattern detection
- High-performance streaming pattern detection

Built with scikit-learn, numpy, pandas, and other ML libraries for production use.
"""

import re
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Union, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
import logging
import pickle
from pathlib import Path
import hashlib
from collections import defaultdict, Counter
import time

# ML and statistical libraries
from sklearn.cluster import DBSCAN, KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.metrics.pairwise import cosine_similarity
from scipy import stats
from scipy.signal import find_peaks
from scipy.fft import fft, fftfreq
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

# Configure logging
logger = logging.getLogger(__name__)


class PatternType(Enum):
    """Enumeration of pattern types"""
    TEXT = "text"
    NUMERICAL = "numerical"
    STRUCTURAL = "structural"
    TEMPORAL = "temporal"
    BUSINESS_LOGIC = "business_logic"
    ANOMALY = "anomaly"
    SEQUENCE = "sequence"
    RELATIONSHIP = "relationship"


@dataclass
class Pattern:
    """Data class representing a detected pattern"""
    pattern_id: str
    pattern_type: PatternType
    description: str
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    examples: List[Any] = field(default_factory=list)
    frequency: int = 1
    last_seen: datetime = field(default_factory=datetime.now)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert pattern to dictionary"""
        return {
            'pattern_id': self.pattern_id,
            'pattern_type': self.pattern_type.value,
            'description': self.description,
            'confidence': self.confidence,
            'metadata': self.metadata,
            'examples': self.examples,
            'frequency': self.frequency,
            'last_seen': self.last_seen.isoformat(),
            'created_at': self.created_at.isoformat()
        }


@dataclass
class PatternCluster:
    """Data class representing a cluster of similar patterns"""
    cluster_id: str
    patterns: List[Pattern]
    centroid: Optional[np.ndarray] = None
    similarity_threshold: float = 0.8
    
    def add_pattern(self, pattern: Pattern):
        """Add a pattern to the cluster"""
        self.patterns.append(pattern)
        
    def get_representative_pattern(self) -> Pattern:
        """Get the most representative pattern in the cluster"""
        if not self.patterns:
            raise ValueError("Empty cluster")
        return max(self.patterns, key=lambda p: p.confidence)


class TextPatternRecognizer:
    """Advanced text pattern recognition using NLP and regex"""
    
    def __init__(self):
        self.stemmer = PorterStemmer()
        self.stop_words = set(stopwords.words('english'))
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 3)
        )
        
        # Pre-compiled regex patterns for common structures
        self.regex_patterns = {
            'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
            'phone': re.compile(r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b'),
            'url': re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'),
            'date': re.compile(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b'),
            'currency': re.compile(r'[$£€¥]\s*\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)\b'),
            'ssn': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
            'credit_card': re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'),
            'ip_address': re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
            'hashtag': re.compile(r'#\w+'),
            'mention': re.compile(r'@\w+')
        }
    
    def extract_regex_patterns(self, text: str) -> Dict[str, List[str]]:
        """Extract structured patterns using regex"""
        results = {}
        for pattern_name, regex in self.regex_patterns.items():
            matches = regex.findall(text)
            if matches:
                results[pattern_name] = matches
        return results
    
    def detect_document_structure(self, text: str) -> Dict[str, Any]:
        """Detect document structure patterns"""
        lines = text.split('\n')
        
        structure_info = {
            'total_lines': len(lines),
            'non_empty_lines': len([line for line in lines if line.strip()]),
            'avg_line_length': np.mean([len(line) for line in lines]),
            'headers': [],
            'lists': [],
            'paragraphs': 0,
            'indentation_pattern': []
        }
        
        # Detect headers (lines with fewer than 100 chars and followed by empty line)
        for i, line in enumerate(lines[:-1]):
            if len(line.strip()) < 100 and not lines[i + 1].strip():
                structure_info['headers'].append(line.strip())
        
        # Detect lists (lines starting with bullets, numbers, etc.)
        list_markers = re.compile(r'^\s*[-*•]\s|^\s*\d+\.\s|^\s*[a-zA-Z]\.\s')
        for line in lines:
            if list_markers.match(line):
                structure_info['lists'].append(line.strip())
        
        # Count paragraphs (groups of non-empty lines)
        in_paragraph = False
        for line in lines:
            if line.strip():
                if not in_paragraph:
                    structure_info['paragraphs'] += 1
                    in_paragraph = True
            else:
                in_paragraph = False
        
        # Analyze indentation patterns
        indentations = [len(line) - len(line.lstrip()) for line in lines if line.strip()]
        if indentations:
            structure_info['indentation_pattern'] = {
                'levels': len(set(indentations)),
                'most_common': max(set(indentations), key=indentations.count),
                'pattern': indentations[:20]  # First 20 lines
            }
        
        return structure_info
    
    def classify_content_type(self, text: str) -> Dict[str, float]:
        """Classify content type with confidence scores"""
        classifications = {}
        
        # Technical content indicators
        technical_keywords = ['function', 'class', 'import', 'def', 'var', 'const', 'return', 'if', 'else']
        tech_score = sum(1 for word in technical_keywords if word in text.lower()) / len(technical_keywords)
        classifications['technical'] = min(tech_score, 1.0)
        
        # Business content indicators
        business_keywords = ['revenue', 'profit', 'customer', 'market', 'sales', 'strategy', 'business', 'growth']
        business_score = sum(1 for word in business_keywords if word in text.lower()) / len(business_keywords)
        classifications['business'] = min(business_score, 1.0)
        
        # Academic content indicators
        academic_keywords = ['research', 'study', 'analysis', 'hypothesis', 'methodology', 'conclusion', 'abstract']
        academic_score = sum(1 for word in academic_keywords if word in text.lower()) / len(academic_keywords)
        classifications['academic'] = min(academic_score, 1.0)
        
        # Legal content indicators
        legal_keywords = ['contract', 'agreement', 'terms', 'conditions', 'liability', 'whereas', 'hereby']
        legal_score = sum(1 for word in legal_keywords if word in text.lower()) / len(legal_keywords)
        classifications['legal'] = min(legal_score, 1.0)
        
        # Normalize scores
        total_score = sum(classifications.values())
        if total_score > 0:
            classifications = {k: v / total_score for k, v in classifications.items()}
        
        return classifications
    
    def extract_semantic_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """Extract semantic patterns using TF-IDF and clustering"""
        if not texts or len(texts) < 2:
            return {}
        
        try:
            # Vectorize texts
            tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
            
            # Perform clustering
            n_clusters = min(5, len(texts) // 2 + 1)
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            cluster_labels = kmeans.fit_predict(tfidf_matrix)
            
            # Get feature names
            feature_names = self.tfidf_vectorizer.get_feature_names_out()
            
            # Analyze clusters
            clusters = {}
            for cluster_id in range(n_clusters):
                cluster_texts = [texts[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
                if cluster_texts:
                    # Get top terms for this cluster
                    cluster_center = kmeans.cluster_centers_[cluster_id]
                    top_indices = cluster_center.argsort()[-10:][::-1]
                    top_terms = [feature_names[i] for i in top_indices]
                    
                    clusters[f'cluster_{cluster_id}'] = {
                        'size': len(cluster_texts),
                        'top_terms': top_terms,
                        'examples': cluster_texts[:3]
                    }
            
            return {
                'clusters': clusters,
                'silhouette_score': silhouette_score(tfidf_matrix.toarray(), cluster_labels) if len(set(cluster_labels)) > 1 else 0
            }
            
        except Exception as e:
            logger.error(f"Error in semantic pattern extraction: {e}")
            return {}


class NumericalPatternRecognizer:
    """Advanced numerical pattern recognition and time series analysis"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        
    def detect_time_series_patterns(self, data: Union[List[float], np.ndarray], 
                                 timestamps: Optional[List[datetime]] = None) -> Dict[str, Any]:
        """Detect patterns in time series data"""
        data = np.array(data)
        
        if len(data) < 3:
            return {'error': 'Insufficient data for time series analysis'}
        
        patterns = {}
        
        # Trend detection
        x = np.arange(len(data))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, data)
        patterns['trend'] = {
            'slope': slope,
            'strength': abs(r_value),
            'direction': 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
            'significance': p_value < 0.05
        }
        
        # Seasonality detection using FFT
        if len(data) >= 10:
            fft_values = fft(data)
            frequencies = fftfreq(len(data))
            
            # Find dominant frequencies
            magnitudes = np.abs(fft_values)
            dominant_freq_idx = np.argmax(magnitudes[1:len(magnitudes)//2]) + 1
            dominant_freq = frequencies[dominant_freq_idx]
            
            if dominant_freq > 0:
                period = 1 / dominant_freq
                patterns['seasonality'] = {
                    'dominant_period': period,
                    'strength': magnitudes[dominant_freq_idx] / np.sum(magnitudes),
                    'frequency': dominant_freq
                }
        
        # Detect peaks and valleys
        peaks, peak_properties = find_peaks(data, height=np.percentile(data, 75))
        valleys, valley_properties = find_peaks(-data, height=-np.percentile(data, 25))
        
        patterns['extrema'] = {
            'peaks': {
                'count': len(peaks),
                'positions': peaks.tolist(),
                'values': data[peaks].tolist() if len(peaks) > 0 else []
            },
            'valleys': {
                'count': len(valleys),
                'positions': valleys.tolist(),
                'values': data[valleys].tolist() if len(valleys) > 0 else []
            }
        }
        
        # Statistical measures
        patterns['statistics'] = {
            'mean': np.mean(data),
            'std': np.std(data),
            'skewness': stats.skew(data),
            'kurtosis': stats.kurtosis(data),
            'autocorrelation': np.corrcoef(data[:-1], data[1:])[0, 1] if len(data) > 1 else 0
        }
        
        # Change point detection
        patterns['change_points'] = self._detect_change_points(data)
        
        return patterns
    
    def _detect_change_points(self, data: np.ndarray, threshold: float = 2.0) -> List[int]:
        """Detect change points in time series using variance analysis"""
        if len(data) < 4:
            return []
        
        change_points = []
        window_size = max(3, len(data) // 10)
        
        for i in range(window_size, len(data) - window_size):
            left_segment = data[i - window_size:i]
            right_segment = data[i:i + window_size]
            
            # Calculate variance difference
            left_var = np.var(left_segment)
            right_var = np.var(right_segment)
            
            if left_var > 0 and right_var > 0:
                var_ratio = max(left_var, right_var) / min(left_var, right_var)
                if var_ratio > threshold:
                    change_points.append(i)
        
        return change_points
    
    def detect_sequence_patterns(self, sequence: List[Any]) -> Dict[str, Any]:
        """Detect patterns in sequences"""
        if len(sequence) < 2:
            return {'error': 'Sequence too short for pattern detection'}
        
        patterns = {}
        
        # N-gram analysis
        patterns['ngrams'] = {}
        for n in range(2, min(6, len(sequence) + 1)):
            ngrams = [tuple(sequence[i:i + n]) for i in range(len(sequence) - n + 1)]
            ngram_counts = Counter(ngrams)
            patterns['ngrams'][f'{n}-grams'] = {
                'most_common': ngram_counts.most_common(5),
                'total_unique': len(ngram_counts)
            }
        
        # Repetition patterns
        patterns['repetitions'] = self._find_repetitions(sequence)
        
        # Arithmetic/geometric progressions (for numerical sequences)
        if all(isinstance(x, (int, float)) for x in sequence):
            patterns['progressions'] = self._detect_progressions(sequence)
        
        return patterns
    
    def _find_repetitions(self, sequence: List[Any]) -> Dict[str, Any]:
        """Find repetitive patterns in sequences"""
        repetitions = {}
        
        # Find exact repetitions
        for length in range(1, len(sequence) // 2 + 1):
            for start in range(len(sequence) - length * 2 + 1):
                pattern = sequence[start:start + length]
                matches = []
                
                for i in range(start + length, len(sequence) - length + 1):
                    if sequence[i:i + length] == pattern:
                        matches.append(i)
                
                if len(matches) >= 1:
                    repetitions[f'pattern_{start}_{length}'] = {
                        'pattern': pattern,
                        'occurrences': len(matches) + 1,
                        'positions': [start] + matches
                    }
        
        return repetitions
    
    def _detect_progressions(self, sequence: List[float]) -> Dict[str, Any]:
        """Detect arithmetic and geometric progressions"""
        if len(sequence) < 3:
            return {}
        
        progressions = {}
        
        # Arithmetic progression
        diffs = [sequence[i + 1] - sequence[i] for i in range(len(sequence) - 1)]
        if len(set(diffs)) == 1:  # All differences are the same
            progressions['arithmetic'] = {
                'common_difference': diffs[0],
                'confidence': 1.0
            }
        else:
            # Check if approximately arithmetic
            mean_diff = np.mean(diffs)
            std_diff = np.std(diffs)
            if std_diff / abs(mean_diff) < 0.1 if mean_diff != 0 else std_diff < 0.1:
                progressions['arithmetic'] = {
                    'common_difference': mean_diff,
                    'confidence': 1.0 - (std_diff / abs(mean_diff) if mean_diff != 0 else std_diff)
                }
        
        # Geometric progression
        if all(x != 0 for x in sequence[:-1]):
            ratios = [sequence[i + 1] / sequence[i] for i in range(len(sequence) - 1)]
            if len(set(ratios)) == 1:  # All ratios are the same
                progressions['geometric'] = {
                    'common_ratio': ratios[0],
                    'confidence': 1.0
                }
            else:
                # Check if approximately geometric
                mean_ratio = np.mean(ratios)
                std_ratio = np.std(ratios)
                if std_ratio / abs(mean_ratio) < 0.1 if mean_ratio != 0 else std_ratio < 0.1:
                    progressions['geometric'] = {
                        'common_ratio': mean_ratio,
                        'confidence': 1.0 - (std_ratio / abs(mean_ratio) if mean_ratio != 0 else std_ratio)
                    }
        
        return progressions
    
    def detect_anomalies(self, data: np.ndarray, contamination: float = 0.1) -> Dict[str, Any]:
        """Detect anomalies using Isolation Forest"""
        if len(data.shape) == 1:
            data = data.reshape(-1, 1)
        
        if len(data) < 3:
            return {'error': 'Insufficient data for anomaly detection'}
        
        iso_forest = IsolationForest(contamination=contamination, random_state=42)
        anomaly_labels = iso_forest.fit_predict(data)
        anomaly_scores = iso_forest.decision_function(data)
        
        anomaly_indices = np.where(anomaly_labels == -1)[0]
        
        return {
            'anomaly_count': len(anomaly_indices),
            'anomaly_indices': anomaly_indices.tolist(),
            'anomaly_scores': anomaly_scores.tolist(),
            'contamination_rate': len(anomaly_indices) / len(data)
        }


class StructuralPatternRecognizer:
    """Recognize patterns in data structure and schema"""
    
    def detect_schema_patterns(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect patterns in data schema"""
        if not data:
            return {'error': 'No data provided'}
        
        schema_info = {
            'total_records': len(data),
            'fields': {},
            'consistency': {},
            'relationships': {}
        }
        
        # Analyze each field
        all_fields = set()
        for record in data:
            all_fields.update(record.keys())
        
        for field in all_fields:
            field_info = {
                'presence_rate': 0,
                'data_types': Counter(),
                'null_rate': 0,
                'unique_values': set(),
                'patterns': []
            }
            
            present_count = 0
            null_count = 0
            
            for record in data:
                if field in record:
                    present_count += 1
                    value = record[field]
                    
                    if value is None or value == '':
                        null_count += 1
                    else:
                        field_info['data_types'][type(value).__name__] += 1
                        field_info['unique_values'].add(str(value)[:100])  # Limit string length
            
            field_info['presence_rate'] = present_count / len(data)
            field_info['null_rate'] = null_count / len(data) if present_count > 0 else 1.0
            field_info['unique_count'] = len(field_info['unique_values'])
            field_info['unique_values'] = list(field_info['unique_values'])[:20]  # Limit output
            
            schema_info['fields'][field] = field_info
        
        # Detect hierarchical patterns
        schema_info['hierarchy'] = self._detect_hierarchy_patterns(data)
        
        # Detect field relationships
        schema_info['relationships'] = self._detect_field_relationships(data)
        
        return schema_info
    
    def _detect_hierarchy_patterns(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect hierarchical patterns in nested data"""
        hierarchy_patterns = {
            'nested_objects': 0,
            'nested_arrays': 0,
            'max_depth': 0,
            'common_structures': Counter()
        }
        
        def analyze_structure(obj, depth=0):
            hierarchy_patterns['max_depth'] = max(hierarchy_patterns['max_depth'], depth)
            
            if isinstance(obj, dict):
                if depth > 0:
                    hierarchy_patterns['nested_objects'] += 1
                
                structure = tuple(sorted(obj.keys()))
                hierarchy_patterns['common_structures'][structure] += 1
                
                for value in obj.values():
                    analyze_structure(value, depth + 1)
                    
            elif isinstance(obj, list):
                if depth > 0:
                    hierarchy_patterns['nested_arrays'] += 1
                
                for item in obj[:5]:  # Analyze first 5 items
                    analyze_structure(item, depth + 1)
        
        for record in data[:100]:  # Analyze first 100 records
            analyze_structure(record)
        
        hierarchy_patterns['common_structures'] = dict(hierarchy_patterns['common_structures'].most_common(10))
        return hierarchy_patterns
    
    def _detect_field_relationships(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect relationships between fields"""
        relationships = {
            'correlations': {},
            'dependencies': {},
            'mutual_presence': {}
        }
        
        # Get all field pairs
        all_fields = set()
        for record in data:
            all_fields.update(record.keys())
        
        field_list = list(all_fields)
        
        # Analyze field co-occurrence
        for i, field1 in enumerate(field_list):
            for field2 in field_list[i + 1:]:
                both_present = 0
                field1_present = 0
                field2_present = 0
                
                for record in data:
                    f1_exists = field1 in record and record[field1] is not None
                    f2_exists = field2 in record and record[field2] is not None
                    
                    if f1_exists:
                        field1_present += 1
                    if f2_exists:
                        field2_present += 1
                    if f1_exists and f2_exists:
                        both_present += 1
                
                if field1_present > 0 and field2_present > 0:
                    mutual_info = both_present / max(field1_present, field2_present)
                    if mutual_info > 0.5:  # Strong relationship
                        relationships['mutual_presence'][f"{field1}_{field2}"] = mutual_info
        
        return relationships


class MLBasedPatternLearner:
    """Machine learning based pattern learning and clustering"""
    
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir) if cache_dir else Path("pattern_cache")
        self.cache_dir.mkdir(exist_ok=True)
        
        self.pattern_embeddings = {}
        self.pattern_clusters = {}
        self.similarity_threshold = 0.8
    
    def learn_patterns(self, data: List[Any], pattern_type: PatternType) -> List[Pattern]:
        """Learn patterns from data using ML algorithms"""
        if not data:
            return []
        
        patterns = []
        
        if pattern_type == PatternType.TEXT:
            patterns = self._learn_text_patterns(data)
        elif pattern_type == PatternType.NUMERICAL:
            patterns = self._learn_numerical_patterns(data)
        elif pattern_type == PatternType.SEQUENCE:
            patterns = self._learn_sequence_patterns(data)
        
        # Cluster similar patterns
        if len(patterns) > 1:
            clustered_patterns = self._cluster_patterns(patterns)
            return clustered_patterns
        
        return patterns
    
    def _learn_text_patterns(self, texts: List[str]) -> List[Pattern]:
        """Learn text patterns using TF-IDF and clustering"""
        patterns = []
        
        if len(texts) < 2:
            return patterns
        
        try:
            # Vectorize texts
            vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
            tfidf_matrix = vectorizer.fit_transform(texts)
            
            # Perform DBSCAN clustering
            dbscan = DBSCAN(eps=0.5, min_samples=2, metric='cosine')
            cluster_labels = dbscan.fit_predict(tfidf_matrix)
            
            # Extract patterns from clusters
            unique_labels = set(cluster_labels)
            for label in unique_labels:
                if label == -1:  # Skip noise points
                    continue
                
                cluster_indices = np.where(cluster_labels == label)[0]
                cluster_texts = [texts[i] for i in cluster_indices]
                
                # Get representative terms
                cluster_vectors = tfidf_matrix[cluster_indices]
                mean_vector = np.mean(cluster_vectors, axis=0)
                feature_names = vectorizer.get_feature_names_out()
                
                top_features_idx = np.argsort(mean_vector.A1)[-10:][::-1]
                top_features = [feature_names[i] for i in top_features_idx]
                
                pattern = Pattern(
                    pattern_id=self._generate_pattern_id(f"text_cluster_{label}"),
                    pattern_type=PatternType.TEXT,
                    description=f"Text pattern with keywords: {', '.join(top_features[:5])}",
                    confidence=len(cluster_texts) / len(texts),
                    metadata={
                        'cluster_size': len(cluster_texts),
                        'top_keywords': top_features,
                        'cluster_label': int(label)
                    },
                    examples=cluster_texts[:3]
                )
                patterns.append(pattern)
        
        except Exception as e:
            logger.error(f"Error learning text patterns: {e}")
        
        return patterns
    
    def _learn_numerical_patterns(self, numbers: List[float]) -> List[Pattern]:
        """Learn numerical patterns using statistical analysis"""
        patterns = []
        data = np.array(numbers)
        
        if len(data) < 3:
            return patterns
        
        # Distribution analysis
        try:
            # Test for normal distribution
            _, p_value_normal = stats.normaltest(data)
            if p_value_normal > 0.05:
                pattern = Pattern(
                    pattern_id=self._generate_pattern_id("normal_distribution"),
                    pattern_type=PatternType.NUMERICAL,
                    description="Data follows normal distribution",
                    confidence=1 - p_value_normal,
                    metadata={
                        'mean': np.mean(data),
                        'std': np.std(data),
                        'p_value': p_value_normal
                    },
                    examples=numbers[:5]
                )
                patterns.append(pattern)
            
            # Test for exponential distribution
            if np.all(data > 0):
                shape, loc, scale = stats.expon.fit(data)
                ks_stat, p_value_exp = stats.kstest(data, lambda x: stats.expon.cdf(x, loc, scale))
                if p_value_exp > 0.05:
                    pattern = Pattern(
                        pattern_id=self._generate_pattern_id("exponential_distribution"),
                        pattern_type=PatternType.NUMERICAL,
                        description="Data follows exponential distribution",
                        confidence=1 - p_value_exp,
                        metadata={
                            'scale': scale,
                            'p_value': p_value_exp
                        },
                        examples=numbers[:5]
                    )
                    patterns.append(pattern)
            
            # Detect outliers using IQR
            q1, q3 = np.percentile(data, [25, 75])
            iqr = q3 - q1
            outlier_mask = (data < q1 - 1.5 * iqr) | (data > q3 + 1.5 * iqr)
            
            if np.any(outlier_mask):
                outliers = data[outlier_mask]
                pattern = Pattern(
                    pattern_id=self._generate_pattern_id("outlier_pattern"),
                    pattern_type=PatternType.ANOMALY,
                    description=f"Detected {len(outliers)} outliers using IQR method",
                    confidence=min(len(outliers) / len(data) * 10, 1.0),
                    metadata={
                        'outlier_count': len(outliers),
                        'outlier_rate': len(outliers) / len(data),
                        'q1': q1,
                        'q3': q3,
                        'iqr': iqr
                    },
                    examples=outliers.tolist()[:5]
                )
                patterns.append(pattern)
        
        except Exception as e:
            logger.error(f"Error learning numerical patterns: {e}")
        
        return patterns
    
    def _learn_sequence_patterns(self, sequences: List[List[Any]]) -> List[Pattern]:
        """Learn patterns from sequences"""
        patterns = []
        
        if not sequences:
            return patterns
        
        # Find common subsequences
        all_ngrams = defaultdict(list)
        
        for seq_idx, sequence in enumerate(sequences):
            for n in range(2, min(6, len(sequence) + 1)):
                for i in range(len(sequence) - n + 1):
                    ngram = tuple(sequence[i:i + n])
                    all_ngrams[ngram].append((seq_idx, i))
        
        # Create patterns for frequent n-grams
        min_frequency = max(2, len(sequences) // 10)
        
        for ngram, occurrences in all_ngrams.items():
            if len(occurrences) >= min_frequency:
                pattern = Pattern(
                    pattern_id=self._generate_pattern_id(f"sequence_{hash(ngram)}"),
                    pattern_type=PatternType.SEQUENCE,
                    description=f"Common sequence: {ngram}",
                    confidence=len(occurrences) / len(sequences),
                    metadata={
                        'ngram_length': len(ngram),
                        'frequency': len(occurrences),
                        'sequences_with_pattern': len(set(occ[0] for occ in occurrences))
                    },
                    examples=list(ngram)
                )
                patterns.append(pattern)
        
        return patterns
    
    def _cluster_patterns(self, patterns: List[Pattern]) -> List[Pattern]:
        """Cluster similar patterns together"""
        if len(patterns) <= 1:
            return patterns
        
        # Create feature vectors from patterns
        features = []
        for pattern in patterns:
            feature_vector = [
                pattern.confidence,
                len(pattern.examples),
                pattern.frequency,
                hash(pattern.description) % 1000 / 1000.0  # Normalized hash
            ]
            features.append(feature_vector)
        
        features = np.array(features)
        
        # Standardize features
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # Perform K-means clustering
        n_clusters = min(5, len(patterns) // 2 + 1)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(features_scaled)
        
        # Group patterns by cluster
        clustered_patterns = []
        for cluster_id in range(n_clusters):
            cluster_patterns = [patterns[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
            
            if cluster_patterns:
                # Create a representative pattern for the cluster
                representative = max(cluster_patterns, key=lambda p: p.confidence)
                representative.metadata['cluster_size'] = len(cluster_patterns)
                representative.metadata['cluster_patterns'] = [p.pattern_id for p in cluster_patterns]
                clustered_patterns.append(representative)
        
        return clustered_patterns
    
    def _generate_pattern_id(self, base: str) -> str:
        """Generate unique pattern ID"""
        timestamp = str(int(time.time() * 1000))
        hash_value = hashlib.md5(f"{base}_{timestamp}".encode()).hexdigest()[:8]
        return f"{base}_{hash_value}"


class BusinessLogicPatternDetector:
    """Detect business logic patterns from data and processes"""
    
    def detect_workflow_patterns(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect workflow patterns from event sequences"""
        if not events:
            return {'error': 'No events provided'}
        
        patterns = {
            'common_sequences': {},
            'decision_points': {},
            'bottlenecks': {},
            'parallel_processes': {}
        }
        
        # Sort events by timestamp if available
        if all('timestamp' in event for event in events):
            events = sorted(events, key=lambda x: x['timestamp'])
        
        # Extract sequences
        sequences = []
        current_sequence = []
        
        for event in events:
            event_type = event.get('type', 'unknown')
            current_sequence.append(event_type)
            
            # Break sequence on certain conditions
            if event_type in ['end', 'complete', 'finish'] or len(current_sequence) > 20:
                if len(current_sequence) > 1:
                    sequences.append(current_sequence)
                current_sequence = []
        
        if current_sequence:
            sequences.append(current_sequence)
        
        # Find common subsequences
        all_subsequences = defaultdict(int)
        for sequence in sequences:
            for length in range(2, min(6, len(sequence) + 1)):
                for i in range(len(sequence) - length + 1):
                    subseq = tuple(sequence[i:i + length])
                    all_subsequences[subseq] += 1
        
        # Filter frequent patterns
        min_frequency = max(2, len(sequences) // 5)
        patterns['common_sequences'] = {
            str(seq): count for seq, count in all_subsequences.items()
            if count >= min_frequency
        }
        
        # Detect decision points (events that lead to different outcomes)
        event_transitions = defaultdict(lambda: defaultdict(int))
        for sequence in sequences:
            for i in range(len(sequence) - 1):
                current_event = sequence[i]
                next_event = sequence[i + 1]
                event_transitions[current_event][next_event] += 1
        
        # Find events with multiple outcomes
        for event, transitions in event_transitions.items():
            if len(transitions) > 1:
                total_transitions = sum(transitions.values())
                patterns['decision_points'][event] = {
                    'outcomes': dict(transitions),
                    'entropy': -sum((count / total_transitions) * np.log2(count / total_transitions)
                                  for count in transitions.values())
                }
        
        return patterns
    
    def detect_business_rules(self, data: List[Dict[str, Any]]) -> List[Pattern]:
        """Extract business rules from data patterns"""
        patterns = []
        
        if not data:
            return patterns
        
        # Get all fields
        all_fields = set()
        for record in data:
            all_fields.update(record.keys())
        
        all_fields = list(all_fields)
        
        # Detect conditional patterns
        for field in all_fields:
            field_values = [record.get(field) for record in data if field in record]
            
            if not field_values:
                continue
            
            # Detect value dependencies
            for other_field in all_fields:
                if field == other_field:
                    continue
                
                dependencies = defaultdict(lambda: defaultdict(int))
                
                for record in data:
                    if field in record and other_field in record:
                        field_val = record[field]
                        other_val = record[other_field]
                        dependencies[field_val][other_val] += 1
                
                # Check for strong dependencies
                for field_val, other_vals in dependencies.items():
                    if len(other_vals) == 1:  # One-to-one relationship
                        other_val = list(other_vals.keys())[0]
                        pattern = Pattern(
                            pattern_id=f"rule_{field}_{other_field}_{hash(str(field_val) + str(other_val)) % 10000}",
                            pattern_type=PatternType.BUSINESS_LOGIC,
                            description=f"Rule: When {field} = {field_val}, then {other_field} = {other_val}",
                            confidence=other_vals[other_val] / sum(other_vals.values()),
                            metadata={
                                'condition_field': field,
                                'condition_value': field_val,
                                'result_field': other_field,
                                'result_value': other_val,
                                'support': other_vals[other_val]
                            }
                        )
                        patterns.append(pattern)
        
        return patterns


class PatternRecognitionService:
    """Main service class for comprehensive pattern recognition"""
    
    def __init__(self, cache_dir: Optional[str] = None, max_workers: int = 4):
        self.text_recognizer = TextPatternRecognizer()
        self.numerical_recognizer = NumericalPatternRecognizer()
        self.structural_recognizer = StructuralPatternRecognizer()
        self.ml_learner = MLBasedPatternLearner(cache_dir)
        self.business_detector = BusinessLogicPatternDetector()
        
        self.max_workers = max_workers
        self.pattern_cache = {}
        self.pattern_index = {}
        
        # Initialize executor for parallel processing
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        logger.info("Pattern Recognition Service initialized")
    
    def recognize_patterns(self, data: Any, pattern_types: Optional[List[PatternType]] = None,
                         streaming: bool = False) -> Dict[str, Any]:
        """
        Main method to recognize patterns in data
        
        Args:
            data: Input data (text, numbers, structured data, etc.)
            pattern_types: List of pattern types to detect (default: all)
            streaming: Whether to process in streaming mode for large datasets
            
        Returns:
            Dictionary containing detected patterns
        """
        if pattern_types is None:
            pattern_types = list(PatternType)
        
        start_time = time.time()
        results = {
            'patterns': [],
            'metadata': {
                'processing_time': 0,
                'data_type': type(data).__name__,
                'data_size': self._get_data_size(data),
                'pattern_types_requested': [pt.value for pt in pattern_types]
            }
        }
        
        try:
            if streaming and self._is_large_dataset(data):
                results = self._process_streaming(data, pattern_types)
            else:
                results['patterns'] = self._process_batch(data, pattern_types)
            
            # Post-processing
            results['patterns'] = self._deduplicate_patterns(results['patterns'])
            results['patterns'] = self._rank_patterns(results['patterns'])
            
            results['metadata']['processing_time'] = time.time() - start_time
            results['metadata']['patterns_found'] = len(results['patterns'])
            
            logger.info(f"Pattern recognition completed: {len(results['patterns'])} patterns found in {results['metadata']['processing_time']:.2f}s")
            
        except Exception as e:
            logger.error(f"Error in pattern recognition: {e}")
            results['error'] = str(e)
        
        return results
    
    def _process_batch(self, data: Any, pattern_types: List[PatternType]) -> List[Pattern]:
        """Process data in batch mode"""
        patterns = []
        
        # Submit parallel tasks for different pattern types
        future_to_pattern_type = {}
        
        for pattern_type in pattern_types:
            future = self.executor.submit(self._detect_patterns_by_type, data, pattern_type)
            future_to_pattern_type[future] = pattern_type
        
        # Collect results
        for future in as_completed(future_to_pattern_type):
            pattern_type = future_to_pattern_type[future]
            try:
                pattern_results = future.result(timeout=30)  # 30 second timeout
                patterns.extend(pattern_results)
            except Exception as e:
                logger.error(f"Error processing {pattern_type.value} patterns: {e}")
        
        return patterns
    
    def _process_streaming(self, data: Any, pattern_types: List[PatternType]) -> Dict[str, Any]:
        """Process data in streaming mode for large datasets"""
        # For streaming, we process data in chunks
        chunk_size = self._calculate_chunk_size(data)
        results = {'patterns': [], 'chunks_processed': 0}
        
        if isinstance(data, list):
            for i in range(0, len(data), chunk_size):
                chunk = data[i:i + chunk_size]
                chunk_patterns = self._process_batch(chunk, pattern_types)
                results['patterns'].extend(chunk_patterns)
                results['chunks_processed'] += 1
                
                # Update pattern cache incrementally
                self._update_pattern_cache(chunk_patterns)
        
        return results
    
    def _detect_patterns_by_type(self, data: Any, pattern_type: PatternType) -> List[Pattern]:
        """Detect patterns for a specific pattern type"""
        patterns = []
        
        try:
            if pattern_type == PatternType.TEXT and isinstance(data, (str, list)):
                if isinstance(data, str):
                    text_data = [data]
                else:
                    text_data = [str(item) for item in data if isinstance(item, str)]
                
                if text_data:
                    patterns.extend(self._detect_text_patterns(text_data))
            
            elif pattern_type == PatternType.NUMERICAL and self._is_numerical_data(data):
                numerical_data = self._extract_numerical_data(data)
                if numerical_data:
                    patterns.extend(self._detect_numerical_patterns(numerical_data))
            
            elif pattern_type == PatternType.STRUCTURAL and isinstance(data, list):
                if all(isinstance(item, dict) for item in data):
                    patterns.extend(self._detect_structural_patterns(data))
            
            elif pattern_type == PatternType.TEMPORAL and self._is_temporal_data(data):
                patterns.extend(self._detect_temporal_patterns(data))
            
            elif pattern_type == PatternType.BUSINESS_LOGIC and isinstance(data, list):
                patterns.extend(self._detect_business_patterns(data))
            
            elif pattern_type == PatternType.SEQUENCE and isinstance(data, list):
                patterns.extend(self._detect_sequence_patterns(data))
        
        except Exception as e:
            logger.error(f"Error detecting {pattern_type.value} patterns: {e}")
        
        return patterns
    
    def _detect_text_patterns(self, texts: List[str]) -> List[Pattern]:
        """Detect text-based patterns"""
        patterns = []
        
        # Regex patterns
        for text in texts[:10]:  # Sample for performance
            regex_results = self.text_recognizer.extract_regex_patterns(text)
            for pattern_name, matches in regex_results.items():
                pattern = Pattern(
                    pattern_id=f"regex_{pattern_name}_{hash(text) % 10000}",
                    pattern_type=PatternType.TEXT,
                    description=f"Detected {pattern_name} pattern",
                    confidence=min(len(matches) / 10, 1.0),
                    metadata={'pattern_name': pattern_name, 'matches': len(matches)},
                    examples=matches[:5]
                )
                patterns.append(pattern)
        
        # Document structure
        if len(texts) == 1:  # Single document
            structure = self.text_recognizer.detect_document_structure(texts[0])
            if structure.get('headers') or structure.get('lists'):
                pattern = Pattern(
                    pattern_id=f"document_structure_{hash(texts[0]) % 10000}",
                    pattern_type=PatternType.STRUCTURAL,
                    description="Document has structured format",
                    confidence=0.8,
                    metadata=structure
                )
                patterns.append(pattern)
        
        # Content classification
        for text in texts[:5]:
            classifications = self.text_recognizer.classify_content_type(text)
            for content_type, confidence in classifications.items():
                if confidence > 0.3:
                    pattern = Pattern(
                        pattern_id=f"content_{content_type}_{hash(text) % 10000}",
                        pattern_type=PatternType.TEXT,
                        description=f"Content classified as {content_type}",
                        confidence=confidence,
                        metadata={'content_type': content_type}
                    )
                    patterns.append(pattern)
        
        # Semantic patterns
        if len(texts) > 1:
            semantic_results = self.text_recognizer.extract_semantic_patterns(texts)
            if 'clusters' in semantic_results:
                for cluster_id, cluster_info in semantic_results['clusters'].items():
                    pattern = Pattern(
                        pattern_id=f"semantic_{cluster_id}",
                        pattern_type=PatternType.TEXT,
                        description=f"Semantic cluster with terms: {', '.join(cluster_info['top_terms'][:3])}",
                        confidence=cluster_info['size'] / len(texts),
                        metadata=cluster_info,
                        examples=cluster_info['examples']
                    )
                    patterns.append(pattern)
        
        # ML-based learning
        ml_patterns = self.ml_learner.learn_patterns(texts, PatternType.TEXT)
        patterns.extend(ml_patterns)
        
        return patterns
    
    def _detect_numerical_patterns(self, numbers: List[float]) -> List[Pattern]:
        """Detect numerical patterns"""
        patterns = []
        
        # Time series analysis if data is sequential
        ts_results = self.numerical_recognizer.detect_time_series_patterns(numbers)
        
        if 'trend' in ts_results and ts_results['trend']['significance']:
            pattern = Pattern(
                pattern_id=f"trend_{hash(str(numbers)) % 10000}",
                pattern_type=PatternType.TEMPORAL,
                description=f"Data shows {ts_results['trend']['direction']} trend",
                confidence=ts_results['trend']['strength'],
                metadata=ts_results['trend']
            )
            patterns.append(pattern)
        
        if 'seasonality' in ts_results:
            pattern = Pattern(
                pattern_id=f"seasonality_{hash(str(numbers)) % 10000}",
                pattern_type=PatternType.TEMPORAL,
                description=f"Data shows seasonal pattern with period {ts_results['seasonality']['dominant_period']:.2f}",
                confidence=ts_results['seasonality']['strength'],
                metadata=ts_results['seasonality']
            )
            patterns.append(pattern)
        
        # Anomaly detection
        anomaly_results = self.numerical_recognizer.detect_anomalies(np.array(numbers))
        if 'anomaly_count' in anomaly_results and anomaly_results['anomaly_count'] > 0:
            pattern = Pattern(
                pattern_id=f"anomalies_{hash(str(numbers)) % 10000}",
                pattern_type=PatternType.ANOMALY,
                description=f"Detected {anomaly_results['anomaly_count']} anomalies",
                confidence=min(anomaly_results['contamination_rate'] * 5, 1.0),
                metadata=anomaly_results
            )
            patterns.append(pattern)
        
        # Sequence patterns
        sequence_results = self.numerical_recognizer.detect_sequence_patterns(numbers)
        if 'progressions' in sequence_results:
            for prog_type, prog_info in sequence_results['progressions'].items():
                pattern = Pattern(
                    pattern_id=f"{prog_type}_progression_{hash(str(numbers)) % 10000}",
                    pattern_type=PatternType.SEQUENCE,
                    description=f"Data follows {prog_type} progression",
                    confidence=prog_info['confidence'],
                    metadata=prog_info
                )
                patterns.append(pattern)
        
        # ML-based learning
        ml_patterns = self.ml_learner.learn_patterns(numbers, PatternType.NUMERICAL)
        patterns.extend(ml_patterns)
        
        return patterns
    
    def _detect_structural_patterns(self, data: List[Dict[str, Any]]) -> List[Pattern]:
        """Detect structural patterns in data"""
        patterns = []
        
        schema_results = self.structural_recognizer.detect_schema_patterns(data)
        
        # Field consistency patterns
        for field, field_info in schema_results.get('fields', {}).items():
            if field_info['presence_rate'] > 0.9:
                pattern = Pattern(
                    pattern_id=f"consistent_field_{field}",
                    pattern_type=PatternType.STRUCTURAL,
                    description=f"Field '{field}' is consistently present",
                    confidence=field_info['presence_rate'],
                    metadata=field_info
                )
                patterns.append(pattern)
            
            if field_info['unique_count'] == 1 and field_info['presence_rate'] > 0.5:
                pattern = Pattern(
                    pattern_id=f"constant_field_{field}",
                    pattern_type=PatternType.STRUCTURAL,
                    description=f"Field '{field}' has constant value",
                    confidence=field_info['presence_rate'],
                    metadata=field_info
                )
                patterns.append(pattern)
        
        # Hierarchical patterns
        hierarchy = schema_results.get('hierarchy', {})
        if hierarchy.get('nested_objects', 0) > 0 or hierarchy.get('nested_arrays', 0) > 0:
            pattern = Pattern(
                pattern_id=f"hierarchical_structure_{hash(str(hierarchy)) % 10000}",
                pattern_type=PatternType.STRUCTURAL,
                description=f"Data has hierarchical structure (depth: {hierarchy.get('max_depth', 0)})",
                confidence=0.8,
                metadata=hierarchy
            )
            patterns.append(pattern)
        
        # Relationship patterns
        relationships = schema_results.get('relationships', {})
        for rel_name, rel_strength in relationships.get('mutual_presence', {}).items():
            if rel_strength > 0.7:
                pattern = Pattern(
                    pattern_id=f"field_relationship_{rel_name}",
                    pattern_type=PatternType.RELATIONSHIP,
                    description=f"Strong relationship between fields: {rel_name.replace('_', ' and ')}",
                    confidence=rel_strength,
                    metadata={'relationship_strength': rel_strength}
                )
                patterns.append(pattern)
        
        return patterns
    
    def _detect_temporal_patterns(self, data: Any) -> List[Pattern]:
        """Detect temporal patterns in data"""
        patterns = []
        
        # Extract timestamps if available
        timestamps = self._extract_timestamps(data)
        if timestamps and len(timestamps) > 2:
            # Analyze time intervals
            intervals = [(timestamps[i+1] - timestamps[i]).total_seconds() for i in range(len(timestamps)-1)]
            
            # Check for regular intervals
            if len(set(intervals)) == 1:  # All intervals are the same
                pattern = Pattern(
                    pattern_id=f"regular_interval_{hash(str(intervals)) % 10000}",
                    pattern_type=PatternType.TEMPORAL,
                    description=f"Regular time interval of {intervals[0]} seconds",
                    confidence=1.0,
                    metadata={'interval_seconds': intervals[0]}
                )
                patterns.append(pattern)
            
            # Check for patterns in intervals
            interval_stats = self.numerical_recognizer.detect_time_series_patterns(intervals)
            if 'trend' in interval_stats and interval_stats['trend']['significance']:
                pattern = Pattern(
                    pattern_id=f"interval_trend_{hash(str(intervals)) % 10000}",
                    pattern_type=PatternType.TEMPORAL,
                    description=f"Time intervals show {interval_stats['trend']['direction']} trend",
                    confidence=interval_stats['trend']['strength'],
                    metadata=interval_stats['trend']
                )
                patterns.append(pattern)
        
        return patterns
    
    def _detect_business_patterns(self, data: List[Dict[str, Any]]) -> List[Pattern]:
        """Detect business logic patterns"""
        patterns = []
        
        # Business rules
        rule_patterns = self.business_detector.detect_business_rules(data)
        patterns.extend(rule_patterns)
        
        # Workflow patterns if event data is available
        if all(isinstance(item, dict) and ('type' in item or 'event' in item) for item in data[:10]):
            workflow_results = self.business_detector.detect_workflow_patterns(data)
            
            for seq, count in workflow_results.get('common_sequences', {}).items():
                pattern = Pattern(
                    pattern_id=f"workflow_sequence_{hash(seq) % 10000}",
                    pattern_type=PatternType.BUSINESS_LOGIC,
                    description=f"Common workflow sequence: {seq}",
                    confidence=min(count / len(data), 1.0),
                    metadata={'sequence': seq, 'frequency': count}
                )
                patterns.append(pattern)
            
            for event, decision_info in workflow_results.get('decision_points', {}).items():
                pattern = Pattern(
                    pattern_id=f"decision_point_{event}",
                    pattern_type=PatternType.BUSINESS_LOGIC,
                    description=f"Decision point at event: {event}",
                    confidence=decision_info['entropy'] / 2.0,  # Normalize entropy
                    metadata=decision_info
                )
                patterns.append(pattern)
        
        return patterns
    
    def _detect_sequence_patterns(self, data: List[Any]) -> List[Pattern]:
        """Detect sequence patterns"""
        patterns = []
        
        if isinstance(data, list) and len(data) > 1:
            # If data is a list of sequences
            if all(isinstance(item, list) for item in data):
                sequence_patterns = self.ml_learner.learn_patterns(data, PatternType.SEQUENCE)
                patterns.extend(sequence_patterns)
            else:
                # Treat the entire list as a single sequence
                sequence_results = self.numerical_recognizer.detect_sequence_patterns(data)
                
                # N-gram patterns
                for ngram_type, ngram_info in sequence_results.get('ngrams', {}).items():
                    for ngram, count in ngram_info['most_common'][:5]:
                        pattern = Pattern(
                            pattern_id=f"ngram_{ngram_type}_{hash(str(ngram)) % 10000}",
                            pattern_type=PatternType.SEQUENCE,
                            description=f"Common {ngram_type}: {ngram}",
                            confidence=count / len(data),
                            metadata={'ngram': ngram, 'frequency': count}
                        )
                        patterns.append(pattern)
                
                # Repetition patterns
                for rep_id, rep_info in sequence_results.get('repetitions', {}).items():
                    if rep_info['occurrences'] >= 2:
                        pattern = Pattern(
                            pattern_id=f"repetition_{rep_id}",
                            pattern_type=PatternType.SEQUENCE,
                            description=f"Repeated pattern: {rep_info['pattern']}",
                            confidence=rep_info['occurrences'] / len(data),
                            metadata=rep_info
                        )
                        patterns.append(pattern)
        
        return patterns
    
    def _is_numerical_data(self, data: Any) -> bool:
        """Check if data contains numerical values"""
        if isinstance(data, (list, tuple)):
            return all(isinstance(item, (int, float)) for item in data[:10])
        return isinstance(data, (int, float))
    
    def _extract_numerical_data(self, data: Any) -> List[float]:
        """Extract numerical values from data"""
        if isinstance(data, (int, float)):
            return [float(data)]
        elif isinstance(data, (list, tuple)):
            return [float(item) for item in data if isinstance(item, (int, float))]
        return []
    
    def _is_temporal_data(self, data: Any) -> bool:
        """Check if data contains temporal information"""
        if isinstance(data, list):
            return any(self._has_timestamps(item) for item in data[:10])
        return self._has_timestamps(data)
    
    def _has_timestamps(self, item: Any) -> bool:
        """Check if an item has timestamp information"""
        if isinstance(item, dict):
            time_fields = ['timestamp', 'time', 'created_at', 'updated_at', 'date']
            return any(field in item for field in time_fields)
        return isinstance(item, datetime)
    
    def _extract_timestamps(self, data: Any) -> List[datetime]:
        """Extract timestamps from data"""
        timestamps = []
        
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    time_fields = ['timestamp', 'time', 'created_at', 'updated_at', 'date']
                    for field in time_fields:
                        if field in item:
                            try:
                                if isinstance(item[field], str):
                                    timestamp = datetime.fromisoformat(item[field].replace('Z', '+00:00'))
                                elif isinstance(item[field], datetime):
                                    timestamp = item[field]
                                else:
                                    continue
                                timestamps.append(timestamp)
                                break
                            except ValueError:
                                continue
                elif isinstance(item, datetime):
                    timestamps.append(item)
        
        return timestamps
    
    def _get_data_size(self, data: Any) -> int:
        """Get the size of data"""
        if isinstance(data, (list, tuple)):
            return len(data)
        elif isinstance(data, dict):
            return len(data)
        elif isinstance(data, str):
            return len(data)
        return 1
    
    def _is_large_dataset(self, data: Any) -> bool:
        """Check if dataset is large and should use streaming"""
        size = self._get_data_size(data)
        return size > 10000  # Threshold for streaming
    
    def _calculate_chunk_size(self, data: Any) -> int:
        """Calculate appropriate chunk size for streaming"""
        size = self._get_data_size(data)
        return max(100, min(1000, size // 10))
    
    def _update_pattern_cache(self, patterns: List[Pattern]):
        """Update pattern cache with new patterns"""
        for pattern in patterns:
            self.pattern_cache[pattern.pattern_id] = pattern
    
    def _deduplicate_patterns(self, patterns: List[Pattern]) -> List[Pattern]:
        """Remove duplicate patterns"""
        seen_descriptions = set()
        unique_patterns = []
        
        for pattern in patterns:
            if pattern.description not in seen_descriptions:
                seen_descriptions.add(pattern.description)
                unique_patterns.append(pattern)
            else:
                # Update frequency of existing pattern
                for existing in unique_patterns:
                    if existing.description == pattern.description:
                        existing.frequency += 1
                        existing.confidence = max(existing.confidence, pattern.confidence)
                        break
        
        return unique_patterns
    
    def _rank_patterns(self, patterns: List[Pattern]) -> List[Pattern]:
        """Rank patterns by importance/confidence"""
        def pattern_score(pattern: Pattern) -> float:
            base_score = pattern.confidence
            frequency_bonus = min(pattern.frequency / 10, 0.3)
            type_bonus = {
                PatternType.ANOMALY: 0.2,
                PatternType.BUSINESS_LOGIC: 0.15,
                PatternType.TEMPORAL: 0.1,
                PatternType.STRUCTURAL: 0.05
            }.get(pattern.pattern_type, 0)
            
            return base_score + frequency_bonus + type_bonus
        
        return sorted(patterns, key=pattern_score, reverse=True)
    
    def get_pattern_summary(self, patterns: List[Pattern]) -> Dict[str, Any]:
        """Generate a summary of detected patterns"""
        if not patterns:
            return {'message': 'No patterns detected'}
        
        summary = {
            'total_patterns': len(patterns),
            'by_type': defaultdict(int),
            'confidence_stats': {},
            'top_patterns': []
        }
        
        confidences = [p.confidence for p in patterns]
        
        for pattern in patterns:
            summary['by_type'][pattern.pattern_type.value] += 1
        
        summary['confidence_stats'] = {
            'mean': np.mean(confidences),
            'median': np.median(confidences),
            'std': np.std(confidences),
            'min': np.min(confidences),
            'max': np.max(confidences)
        }
        
        summary['top_patterns'] = [
            {
                'type': pattern.pattern_type.value,
                'description': pattern.description,
                'confidence': pattern.confidence
            }
            for pattern in patterns[:5]
        ]
        
        return dict(summary)
    
    def export_patterns(self, patterns: List[Pattern], format: str = 'json') -> str:
        """Export patterns in specified format"""
        pattern_data = [pattern.to_dict() for pattern in patterns]
        
        if format.lower() == 'json':
            return json.dumps(pattern_data, indent=2, default=str)
        elif format.lower() == 'csv':
            if not pattern_data:
                return "No patterns to export"
            
            import csv
            from io import StringIO
            
            output = StringIO()
            if pattern_data:
                writer = csv.DictWriter(output, fieldnames=pattern_data[0].keys())
                writer.writeheader()
                for pattern in pattern_data:
                    # Convert complex fields to strings
                    row = {k: json.dumps(v) if isinstance(v, (dict, list)) else v 
                          for k, v in pattern.items()}
                    writer.writerow(row)
            
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def cleanup(self):
        """Clean up resources"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=True)
        logger.info("Pattern Recognition Service cleaned up")


# Example usage and testing
if __name__ == "__main__":
    # Initialize service
    service = PatternRecognitionService()
    
    # Example 1: Text pattern recognition
    text_data = [
        "Contact us at support@example.com or call (555) 123-4567",
        "Email: sales@company.com, Phone: (555) 987-6543",
        "Visit our website at https://example.com for more info"
    ]
    
    text_results = service.recognize_patterns(text_data, [PatternType.TEXT])
    print("Text Patterns:", json.dumps(text_results, indent=2, default=str))
    
    # Example 2: Numerical pattern recognition
    numerical_data = [1, 4, 7, 10, 13, 16, 19, 22, 25]  # Arithmetic progression
    
    numerical_results = service.recognize_patterns(numerical_data, [PatternType.NUMERICAL, PatternType.SEQUENCE])
    print("\nNumerical Patterns:", json.dumps(numerical_results, indent=2, default=str))
    
    # Example 3: Structural pattern recognition
    structured_data = [
        {'name': 'Alice', 'age': 30, 'city': 'New York', 'salary': 70000},
        {'name': 'Bob', 'age': 25, 'city': 'San Francisco', 'salary': 80000},
        {'name': 'Charlie', 'age': 35, 'city': 'Chicago', 'salary': 75000}
    ]
    
    structural_results = service.recognize_patterns(structured_data, [PatternType.STRUCTURAL])
    print("\nStructural Patterns:", json.dumps(structural_results, indent=2, default=str))
    
    # Cleanup
    service.cleanup()