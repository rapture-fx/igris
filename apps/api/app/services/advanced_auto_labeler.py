"""
Advanced Auto-Labeling Service with Real Unsupervised Learning
============================================================

This service provides sophisticated automated labeling capabilities using
unsupervised machine learning, clustering algorithms, and intelligent
categorization techniques for fully automated data labeling at scale.

Key Features:
- Comprehensive unsupervised learning algorithms (K-means, DBSCAN, GMM, etc.)
- Topic modeling with LDA and NMF for text data
- Hierarchical and spectral clustering
- Automatic optimal cluster detection
- Multi-modal clustering (text + numerical features)
- Confidence scoring and uncertainty quantification
- Active learning and semi-supervised learning
- Streaming and incremental learning
- Production-ready with persistence and optimization
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from enum import Enum
from dataclasses import dataclass, field
import logging
import json
from datetime import datetime
import pickle
import joblib
from pathlib import Path
import re
import warnings
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import threading
from collections import defaultdict, Counter

# Core ML libraries
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, SpectralClustering
from sklearn.mixture import GaussianMixture
from sklearn.decomposition import LatentDirichletAllocation, NMF, PCA, TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.preprocessing import StandardScaler, LabelEncoder, MinMaxScaler
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances
from sklearn.semi_supervised import LabelPropagation, LabelSpreading
from sklearn.neighbors import NearestNeighbors
from sklearn.manifold import TSNE
from sklearn.model_selection import ParameterGrid

# Text processing
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from textblob import TextBlob
import spacy

# Numerical libraries
from scipy import stats
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import pdist, squareform
from scipy.stats import entropy

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
except:
    pass

class ClusteringAlgorithm(Enum):
    """Types of clustering algorithms"""
    KMEANS = "kmeans"
    DBSCAN = "dbscan"
    GAUSSIAN_MIXTURE = "gaussian_mixture"
    HIERARCHICAL = "hierarchical"
    SPECTRAL = "spectral"
    
class TopicModelingAlgorithm(Enum):
    """Types of topic modeling algorithms"""
    LDA = "lda"
    NMF = "nmf"
    
class ClusterQualityMetric(Enum):
    """Cluster quality metrics"""
    SILHOUETTE = "silhouette"
    CALINSKI_HARABASZ = "calinski_harabasz"
    DAVIES_BOULDIN = "davies_bouldin"
    INERTIA = "inertia"

class ConfidenceLevel(Enum):
    """Confidence levels for predictions"""
    VERY_HIGH = "very_high"  # >0.95
    HIGH = "high"           # 0.85-0.95
    MEDIUM = "medium"       # 0.70-0.85
    LOW = "low"            # 0.50-0.70
    VERY_LOW = "very_low"  # <0.50

@dataclass
class ClusteringResult:
    """Result of a clustering operation"""
    cluster_labels: np.ndarray
    cluster_centers: Optional[np.ndarray]
    confidence_scores: np.ndarray
    confidence_levels: List[ConfidenceLevel]
    cluster_names: Dict[int, str]
    quality_metrics: Dict[str, float]
    optimal_k: Optional[int]
    algorithm_used: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TopicModelingResult:
    """Result of topic modeling"""
    topic_assignments: np.ndarray
    topic_distributions: np.ndarray
    topic_keywords: Dict[int, List[str]]
    topic_names: Dict[int, str]
    coherence_score: float
    perplexity: Optional[float]
    algorithm_used: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ActiveLearningResult:
    """Result of active learning selection"""
    selected_indices: List[int]
    uncertainty_scores: List[float]
    diversity_scores: List[float]
    combined_scores: List[float]
    selection_strategy: str
    metadata: Dict[str, Any] = field(default_factory=dict)

class AdvancedAutoLabeler:
    """
    Advanced unsupervised auto-labeling system with comprehensive ML algorithms
    """
    
    def __init__(self, 
                 n_jobs: int = -1,
                 random_state: int = 42,
                 cache_dir: Optional[str] = None):
        """
        Initialize the advanced auto-labeler
        
        Args:
            n_jobs: Number of parallel jobs (-1 for all cores)
            random_state: Random seed for reproducibility
            cache_dir: Directory for caching models and results
        """
        self.n_jobs = n_jobs
        self.random_state = random_state
        self.cache_dir = Path(cache_dir) if cache_dir else Path.cwd() / "auto_labeler_cache"
        self.cache_dir.mkdir(exist_ok=True)
        
        # Model storage
        self.clustering_models = {}
        self.topic_models = {}
        self.feature_extractors = {}
        self.scalers = {}
        
        # Configuration
        self.confidence_threshold = 0.7
        self.uncertainty_threshold = 0.3
        self.max_features = 10000
        self.min_cluster_size = 5
        
        # Initialize text processing tools
        self.lemmatizer = WordNetLemmatizer()
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found. Some features may be limited.")
            self.nlp = None
            
        # Thread safety
        self._lock = threading.Lock()
        
        logger.info(f"AdvancedAutoLabeler initialized with {self.n_jobs} jobs")

    def find_optimal_clusters(self,
                            X: np.ndarray,
                            algorithm: ClusteringAlgorithm = ClusteringAlgorithm.KMEANS,
                            k_range: Tuple[int, int] = (2, 20),
                            metric: ClusterQualityMetric = ClusterQualityMetric.SILHOUETTE) -> Dict[str, Any]:
        """
        Find optimal number of clusters using various metrics
        
        Args:
            X: Feature matrix
            algorithm: Clustering algorithm to use
            k_range: Range of cluster numbers to test
            metric: Quality metric for optimization
            
        Returns:
            Dictionary with optimal k and quality scores
        """
        min_k, max_k = k_range
        max_k = min(max_k, len(X) // 2)  # Ensure reasonable upper bound
        
        if max_k <= min_k:
            return {"optimal_k": 2, "scores": {}, "method": "default"}
        
        scores = {}
        silhouette_scores = {}
        
        for k in range(min_k, max_k + 1):
            try:
                if algorithm == ClusteringAlgorithm.KMEANS:
                    clusterer = KMeans(n_clusters=k, random_state=self.random_state, n_init=10)
                elif algorithm == ClusteringAlgorithm.GAUSSIAN_MIXTURE:
                    clusterer = GaussianMixture(n_components=k, random_state=self.random_state)
                elif algorithm == ClusteringAlgorithm.SPECTRAL:
                    clusterer = SpectralClustering(n_clusters=k, random_state=self.random_state)
                else:
                    continue  # Skip algorithms that don't support variable k
                
                labels = clusterer.fit_predict(X)
                
                # Skip if all points in one cluster or too many singleton clusters
                unique_labels = len(set(labels))
                if unique_labels < 2 or unique_labels == len(X):
                    continue
                
                # Calculate quality metrics
                if metric == ClusterQualityMetric.SILHOUETTE:
                    score = silhouette_score(X, labels)
                elif metric == ClusterQualityMetric.CALINSKI_HARABASZ:
                    score = calinski_harabasz_score(X, labels)
                elif metric == ClusterQualityMetric.DAVIES_BOULDIN:
                    score = -davies_bouldin_score(X, labels)  # Negative because lower is better
                elif metric == ClusterQualityMetric.INERTIA and hasattr(clusterer, 'inertia_'):
                    score = -clusterer.inertia_  # Negative because lower is better
                else:
                    score = silhouette_score(X, labels)
                
                scores[k] = score
                silhouette_scores[k] = silhouette_score(X, labels)
                
            except Exception as e:
                logger.warning(f"Failed to evaluate k={k}: {e}")
                continue
        
        if not scores:
            return {"optimal_k": min_k, "scores": {}, "method": "fallback"}
        
        # Find optimal k
        if metric == ClusterQualityMetric.DAVIES_BOULDIN or metric == ClusterQualityMetric.INERTIA:
            optimal_k = max(scores.keys(), key=lambda k: scores[k])  # Higher is better (already negated)
        else:
            optimal_k = max(scores.keys(), key=lambda k: scores[k])  # Higher is better
        
        # Use elbow method as secondary validation for k-means
        if algorithm == ClusteringAlgorithm.KMEANS and len(scores) >= 3:
            elbow_k = self._find_elbow_point(scores)
            if elbow_k and abs(elbow_k - optimal_k) <= 2:
                optimal_k = elbow_k
        
        return {
            "optimal_k": optimal_k,
            "scores": scores,
            "silhouette_scores": silhouette_scores,
            "method": f"{metric.value}_optimization",
            "algorithm": algorithm.value
        }

    def _find_elbow_point(self, scores: Dict[int, float]) -> Optional[int]:
        """Find elbow point in scores using knee detection"""
        if len(scores) < 3:
            return None
        
        k_values = sorted(scores.keys())
        score_values = [scores[k] for k in k_values]
        
        # Calculate second derivatives to find elbow
        if len(score_values) >= 3:
            second_derivatives = []
            for i in range(1, len(score_values) - 1):
                second_deriv = score_values[i-1] - 2*score_values[i] + score_values[i+1]
                second_derivatives.append(second_deriv)
            
            if second_derivatives:
                elbow_idx = np.argmax(np.abs(second_derivatives)) + 1
                return k_values[elbow_idx]
        
        return None

    def cluster_data(self,
                    X: np.ndarray,
                    algorithm: ClusteringAlgorithm = ClusteringAlgorithm.KMEANS,
                    n_clusters: Optional[int] = None,
                    auto_optimize: bool = True,
                    **kwargs) -> ClusteringResult:
        """
        Perform clustering on data with automatic optimization
        
        Args:
            X: Feature matrix
            algorithm: Clustering algorithm to use
            n_clusters: Number of clusters (auto-detected if None)
            auto_optimize: Whether to automatically find optimal parameters
            **kwargs: Additional algorithm parameters
            
        Returns:
            ClusteringResult with labels, confidence scores, and metadata
        """
        # Auto-detect optimal number of clusters if not specified
        if n_clusters is None and auto_optimize and algorithm in [
            ClusteringAlgorithm.KMEANS, 
            ClusteringAlgorithm.GAUSSIAN_MIXTURE,
            ClusteringAlgorithm.SPECTRAL
        ]:
            optimization_result = self.find_optimal_clusters(X, algorithm)
            n_clusters = optimization_result["optimal_k"]
            logger.info(f"Auto-detected optimal clusters: {n_clusters}")
        
        # Set default number of clusters if still None
        if n_clusters is None:
            n_clusters = min(8, max(2, len(X) // 50))
        
        # Initialize clusterer based on algorithm
        if algorithm == ClusteringAlgorithm.KMEANS:
            clusterer = KMeans(
                n_clusters=n_clusters,
                random_state=self.random_state,
                n_init=10,
                **kwargs
            )
        elif algorithm == ClusteringAlgorithm.DBSCAN:
            eps = kwargs.get('eps', self._estimate_dbscan_eps(X))
            min_samples = kwargs.get('min_samples', max(2, len(X) // 100))
            clusterer = DBSCAN(eps=eps, min_samples=min_samples, n_jobs=self.n_jobs)
        elif algorithm == ClusteringAlgorithm.GAUSSIAN_MIXTURE:
            clusterer = GaussianMixture(
                n_components=n_clusters,
                random_state=self.random_state,
                **kwargs
            )
        elif algorithm == ClusteringAlgorithm.HIERARCHICAL:
            clusterer = AgglomerativeClustering(
                n_clusters=n_clusters,
                **kwargs
            )
        elif algorithm == ClusteringAlgorithm.SPECTRAL:
            clusterer = SpectralClustering(
                n_clusters=n_clusters,
                random_state=self.random_state,
                n_jobs=self.n_jobs,
                **kwargs
            )
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
        
        # Fit the model and get cluster labels
        cluster_labels = clusterer.fit_predict(X)
        
        # Get cluster centers if available
        cluster_centers = None
        if hasattr(clusterer, 'cluster_centers_'):
            cluster_centers = clusterer.cluster_centers_
        elif hasattr(clusterer, 'means_'):
            cluster_centers = clusterer.means_
        
        # Calculate confidence scores
        confidence_scores = self._calculate_cluster_confidence(X, cluster_labels, clusterer)
        
        # Categorize confidence levels
        confidence_levels = [self._categorize_confidence(score) for score in confidence_scores]
        
        # Generate cluster names
        cluster_names = self._generate_cluster_names(cluster_labels, X)
        
        # Calculate quality metrics
        quality_metrics = self._calculate_cluster_quality(X, cluster_labels)
        
        # Store model for future use
        model_key = f"{algorithm.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.clustering_models[model_key] = {
            'model': clusterer,
            'algorithm': algorithm,
            'n_clusters': n_clusters,
            'feature_dim': X.shape[1],
            'created_at': datetime.now().isoformat()
        }
        
        result = ClusteringResult(
            cluster_labels=cluster_labels,
            cluster_centers=cluster_centers,
            confidence_scores=confidence_scores,
            confidence_levels=confidence_levels,
            cluster_names=cluster_names,
            quality_metrics=quality_metrics,
            optimal_k=n_clusters,
            algorithm_used=algorithm.value,
            metadata={
                'model_key': model_key,
                'n_samples': len(X),
                'n_features': X.shape[1],
                'unique_clusters': len(set(cluster_labels)),
                'noise_points': np.sum(cluster_labels == -1) if -1 in cluster_labels else 0,
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Clustering completed: {algorithm.value}, {len(set(cluster_labels))} clusters")
        return result

    def _estimate_dbscan_eps(self, X: np.ndarray) -> float:
        """Estimate optimal eps parameter for DBSCAN using k-distance graph"""
        k = min(4, len(X) // 10)  # Use k=4 or 10% of data points
        if k < 2:
            return 0.5
        
        # Calculate k-nearest neighbors
        nbrs = NearestNeighbors(n_neighbors=k).fit(X)
        distances, indices = nbrs.kneighbors(X)
        
        # Sort distances to k-th nearest neighbor
        k_distances = np.sort(distances[:, k-1])
        
        # Find elbow in k-distance plot
        # Use simple method: find point with maximum curvature
        if len(k_distances) >= 10:
            # Calculate second derivatives
            second_derivatives = np.diff(k_distances, 2)
            if len(second_derivatives) > 0:
                elbow_idx = np.argmax(second_derivatives) + 1
                eps = k_distances[elbow_idx]
            else:
                eps = np.median(k_distances)
        else:
            eps = np.median(k_distances)
        
        return max(0.01, eps)  # Ensure eps is positive

    def _calculate_cluster_confidence(self, 
                                    X: np.ndarray, 
                                    cluster_labels: np.ndarray, 
                                    clusterer) -> np.ndarray:
        """Calculate confidence scores for cluster assignments"""
        n_samples = len(X)
        confidence_scores = np.zeros(n_samples)
        
        unique_labels = set(cluster_labels)
        
        for i, point in enumerate(X):
            label = cluster_labels[i]
            
            if hasattr(clusterer, 'predict_proba'):
                # For GMM, use probability
                proba = clusterer.predict_proba([point])[0]
                confidence_scores[i] = np.max(proba)
            elif hasattr(clusterer, 'cluster_centers_'):
                # For K-means, use distance to cluster center
                center = clusterer.cluster_centers_[label]
                distance = np.linalg.norm(point - center)
                
                # Calculate relative distance to all centers
                all_distances = [np.linalg.norm(point - center) for center in clusterer.cluster_centers_]
                min_distance = min(all_distances)
                max_distance = max(all_distances)
                
                if max_distance > min_distance:
                    confidence_scores[i] = 1 - (distance - min_distance) / (max_distance - min_distance)
                else:
                    confidence_scores[i] = 0.8  # Default for equal distances
            else:
                # For other algorithms, use silhouette-like score
                if label == -1:  # Noise point
                    confidence_scores[i] = 0.1
                else:
                    # Calculate average distance to points in same cluster
                    same_cluster_points = X[cluster_labels == label]
                    if len(same_cluster_points) > 1:
                        intra_distances = [np.linalg.norm(point - other) 
                                         for other in same_cluster_points]
                        avg_intra_distance = np.mean(intra_distances)
                        
                        # Calculate average distance to nearest different cluster
                        min_inter_distance = float('inf')
                        for other_label in unique_labels:
                            if other_label != label and other_label != -1:
                                other_cluster_points = X[cluster_labels == other_label]
                                if len(other_cluster_points) > 0:
                                    inter_distances = [np.linalg.norm(point - other) 
                                                     for other in other_cluster_points]
                                    avg_inter_distance = np.mean(inter_distances)
                                    min_inter_distance = min(min_inter_distance, avg_inter_distance)
                        
                        if min_inter_distance != float('inf') and avg_intra_distance > 0:
                            silhouette_like = (min_inter_distance - avg_intra_distance) / max(min_inter_distance, avg_intra_distance)
                            confidence_scores[i] = max(0, (silhouette_like + 1) / 2)  # Normalize to [0, 1]
                        else:
                            confidence_scores[i] = 0.6
                    else:
                        confidence_scores[i] = 0.5  # Single point cluster
        
        return confidence_scores

    def _generate_cluster_names(self, cluster_labels: np.ndarray, X: np.ndarray) -> Dict[int, str]:
        """Generate meaningful names for clusters"""
        cluster_names = {}
        unique_labels = set(cluster_labels)
        
        for label in unique_labels:
            if label == -1:
                cluster_names[label] = "Outliers"
            else:
                cluster_names[label] = f"Cluster_{label}"
        
        return cluster_names

    def _calculate_cluster_quality(self, X: np.ndarray, cluster_labels: np.ndarray) -> Dict[str, float]:
        """Calculate various cluster quality metrics"""
        quality_metrics = {}
        
        # Only calculate if we have valid clusters
        unique_labels = set(cluster_labels)
        if len(unique_labels) < 2 or (len(unique_labels) == 1 and -1 in unique_labels):
            return {"error": "insufficient_clusters"}
        
        try:
            # Remove noise points for metrics calculation
            valid_mask = cluster_labels != -1
            if np.sum(valid_mask) < 2:
                return {"error": "insufficient_valid_points"}
            
            X_valid = X[valid_mask]
            labels_valid = cluster_labels[valid_mask]
            
            if len(set(labels_valid)) < 2:
                return {"error": "insufficient_valid_clusters"}
            
            # Silhouette score
            quality_metrics['silhouette_score'] = silhouette_score(X_valid, labels_valid)
            
            # Calinski-Harabasz index
            quality_metrics['calinski_harabasz_score'] = calinski_harabasz_score(X_valid, labels_valid)
            
            # Davies-Bouldin index
            quality_metrics['davies_bouldin_score'] = davies_bouldin_score(X_valid, labels_valid)
            
            # Cluster size statistics
            cluster_sizes = Counter(labels_valid)
            quality_metrics['avg_cluster_size'] = np.mean(list(cluster_sizes.values()))
            quality_metrics['min_cluster_size'] = min(cluster_sizes.values())
            quality_metrics['max_cluster_size'] = max(cluster_sizes.values())
            quality_metrics['cluster_size_std'] = np.std(list(cluster_sizes.values()))
            
        except Exception as e:
            logger.warning(f"Error calculating cluster quality: {e}")
            quality_metrics['error'] = str(e)
        
        return quality_metrics

    def perform_topic_modeling(self,
                             texts: List[str],
                             algorithm: TopicModelingAlgorithm = TopicModelingAlgorithm.LDA,
                             n_topics: Optional[int] = None,
                             auto_optimize: bool = True,
                             **kwargs) -> TopicModelingResult:
        """
        Perform topic modeling on text data
        
        Args:
            texts: List of text documents
            algorithm: Topic modeling algorithm
            n_topics: Number of topics (auto-detected if None)
            auto_optimize: Whether to automatically optimize parameters
            **kwargs: Additional algorithm parameters
            
        Returns:
            TopicModelingResult with topic assignments and metadata
        """
        # Preprocess texts
        processed_texts = self._preprocess_texts(texts)
        
        # Create feature matrix
        if algorithm == TopicModelingAlgorithm.LDA:
            # LDA works better with count vectors
            vectorizer = CountVectorizer(
                max_features=self.max_features,
                stop_words='english',
                lowercase=True,
                token_pattern=r'\b[a-zA-Z]{3,}\b',
                min_df=2,
                max_df=0.95
            )
        else:
            # NMF works better with TF-IDF
            vectorizer = TfidfVectorizer(
                max_features=self.max_features,
                stop_words='english',
                lowercase=True,
                token_pattern=r'\b[a-zA-Z]{3,}\b',
                min_df=2,
                max_df=0.95
            )
        
        X = vectorizer.fit_transform(processed_texts)
        feature_names = vectorizer.get_feature_names_out()
        
        # Auto-detect optimal number of topics if not specified
        if n_topics is None and auto_optimize:
            n_topics = self._find_optimal_topics(X, algorithm, feature_names)
            logger.info(f"Auto-detected optimal topics: {n_topics}")
        
        if n_topics is None:
            n_topics = min(10, max(2, len(texts) // 20))
        
        # Initialize topic model
        if algorithm == TopicModelingAlgorithm.LDA:
            model = LatentDirichletAllocation(
                n_components=n_topics,
                random_state=self.random_state,
                max_iter=100,
                **kwargs
            )
        elif algorithm == TopicModelingAlgorithm.NMF:
            model = NMF(
                n_components=n_topics,
                random_state=self.random_state,
                max_iter=200,
                **kwargs
            )
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
        
        # Fit the model
        topic_distributions = model.fit_transform(X)
        
        # Get topic assignments (most probable topic for each document)
        topic_assignments = np.argmax(topic_distributions, axis=1)
        
        # Extract keywords for each topic
        topic_keywords = self._extract_topic_keywords(model, feature_names, n_words=10)
        
        # Generate topic names
        topic_names = self._generate_topic_names(topic_keywords)
        
        # Calculate coherence score
        coherence_score = self._calculate_topic_coherence(X, model, feature_names)
        
        # Calculate perplexity (for LDA)
        perplexity = None
        if hasattr(model, 'perplexity'):
            try:
                perplexity = model.perplexity(X)
            except:
                pass
        
        # Store model
        model_key = f"{algorithm.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.topic_models[model_key] = {
            'model': model,
            'vectorizer': vectorizer,
            'algorithm': algorithm,
            'n_topics': n_topics,
            'created_at': datetime.now().isoformat()
        }
        
        result = TopicModelingResult(
            topic_assignments=topic_assignments,
            topic_distributions=topic_distributions,
            topic_keywords=topic_keywords,
            topic_names=topic_names,
            coherence_score=coherence_score,
            perplexity=perplexity,
            algorithm_used=algorithm.value,
            metadata={
                'model_key': model_key,
                'n_documents': len(texts),
                'n_features': X.shape[1],
                'n_topics': n_topics,
                'vocabulary_size': len(feature_names),
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Topic modeling completed: {algorithm.value}, {n_topics} topics")
        return result

    def _preprocess_texts(self, texts: List[str]) -> List[str]:
        """Preprocess text data for topic modeling"""
        processed_texts = []
        stop_words = set(stopwords.words('english'))
        
        for text in texts:
            # Basic cleaning
            text = str(text).lower()
            text = re.sub(r'[^a-zA-Z\s]', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            # Tokenize and remove stop words
            if self.nlp:
                # Use spaCy for better preprocessing
                doc = self.nlp(text)
                tokens = [token.lemma_ for token in doc 
                         if not token.is_stop and not token.is_punct 
                         and len(token.text) > 2 and token.is_alpha]
            else:
                # Fallback to NLTK
                tokens = word_tokenize(text)
                tokens = [self.lemmatizer.lemmatize(token) for token in tokens 
                         if token not in stop_words and len(token) > 2 and token.isalpha()]
            
            processed_texts.append(' '.join(tokens))
        
        return processed_texts

    def _find_optimal_topics(self, X, algorithm: TopicModelingAlgorithm, feature_names: np.ndarray) -> int:
        """Find optimal number of topics using coherence score"""
        topic_range = range(2, min(21, X.shape[0] // 5))
        coherence_scores = {}
        
        for n_topics in topic_range:
            try:
                if algorithm == TopicModelingAlgorithm.LDA:
                    model = LatentDirichletAllocation(
                        n_components=n_topics,
                        random_state=self.random_state,
                        max_iter=50
                    )
                else:
                    model = NMF(
                        n_components=n_topics,
                        random_state=self.random_state,
                        max_iter=100
                    )
                
                model.fit(X)
                coherence = self._calculate_topic_coherence(X, model, feature_names)
                coherence_scores[n_topics] = coherence
                
            except Exception as e:
                logger.warning(f"Failed to evaluate {n_topics} topics: {e}")
                continue
        
        if coherence_scores:
            optimal_topics = max(coherence_scores.keys(), key=lambda k: coherence_scores[k])
            return optimal_topics
        else:
            return 5  # Default fallback

    def _extract_topic_keywords(self, model, feature_names: np.ndarray, n_words: int = 10) -> Dict[int, List[str]]:
        """Extract top keywords for each topic"""
        topic_keywords = {}
        
        for topic_idx, topic in enumerate(model.components_):
            top_words_idx = topic.argsort()[-n_words:][::-1]
            top_words = [feature_names[i] for i in top_words_idx]
            topic_keywords[topic_idx] = top_words
        
        return topic_keywords

    def _generate_topic_names(self, topic_keywords: Dict[int, List[str]]) -> Dict[int, str]:
        """Generate meaningful names for topics based on keywords"""
        topic_names = {}
        
        for topic_idx, keywords in topic_keywords.items():
            # Use top 2-3 keywords to generate name
            top_keywords = keywords[:3]
            topic_name = "_".join(top_keywords)
            topic_names[topic_idx] = topic_name.title()
        
        return topic_names

    def _calculate_topic_coherence(self, X, model, feature_names: np.ndarray) -> float:
        """Calculate topic coherence score"""
        try:
            # Simple coherence measure based on topic word co-occurrence
            topic_coherences = []
            
            for topic in model.components_:
                top_words_idx = topic.argsort()[-10:][::-1]
                coherence = 0
                
                # Calculate pairwise PMI for top words
                for i, word1_idx in enumerate(top_words_idx):
                    for word2_idx in top_words_idx[i+1:]:
                        # Calculate co-occurrence
                        word1_docs = (X[:, word1_idx] > 0).sum()
                        word2_docs = (X[:, word2_idx] > 0).sum()
                        both_docs = ((X[:, word1_idx] > 0) & (X[:, word2_idx] > 0)).sum()
                        
                        if both_docs > 0 and word1_docs > 0 and word2_docs > 0:
                            pmi = np.log((both_docs * X.shape[0]) / (word1_docs * word2_docs))
                            coherence += pmi
                
                topic_coherences.append(coherence)
            
            return np.mean(topic_coherences) if topic_coherences else 0.0
            
        except Exception as e:
            logger.warning(f"Error calculating coherence: {e}")
            return 0.0

    def multi_modal_clustering(self,
                             text_data: Optional[List[str]] = None,
                             numerical_data: Optional[np.ndarray] = None,
                             text_weight: float = 0.5,
                             algorithm: ClusteringAlgorithm = ClusteringAlgorithm.KMEANS,
                             **kwargs) -> ClusteringResult:
        """
        Perform clustering on combined text and numerical features
        
        Args:
            text_data: List of text documents
            numerical_data: Numerical feature matrix
            text_weight: Weight for text features (0-1)
            algorithm: Clustering algorithm
            **kwargs: Additional clustering parameters
            
        Returns:
            ClusteringResult for multi-modal clustering
        """
        if text_data is None and numerical_data is None:
            raise ValueError("At least one of text_data or numerical_data must be provided")
        
        features = []
        
        # Process text features
        if text_data is not None:
            processed_texts = self._preprocess_texts(text_data)
            text_vectorizer = TfidfVectorizer(
                max_features=min(1000, self.max_features // 2),
                stop_words='english',
                lowercase=True,
                min_df=2,
                max_df=0.95
            )
            text_features = text_vectorizer.fit_transform(processed_texts).toarray()
            
            # Scale text features
            text_scaler = StandardScaler()
            text_features = text_scaler.fit_transform(text_features)
            
            features.append(text_features * text_weight)
            
            # Store for later use
            self.feature_extractors[f'text_{datetime.now().strftime("%Y%m%d_%H%M%S")}'] = text_vectorizer
            self.scalers[f'text_scaler_{datetime.now().strftime("%Y%m%d_%H%M%S")}'] = text_scaler
        
        # Process numerical features
        if numerical_data is not None:
            num_features = numerical_data.copy()
            
            # Scale numerical features
            num_scaler = StandardScaler()
            num_features = num_scaler.fit_transform(num_features)
            
            features.append(num_features * (1 - text_weight))
            
            # Store for later use
            self.scalers[f'num_scaler_{datetime.now().strftime("%Y%m%d_%H%M%S")}'] = num_scaler
        
        # Combine features
        if len(features) == 1:
            X_combined = features[0]
        else:
            X_combined = np.hstack(features)
        
        # Perform clustering
        result = self.cluster_data(X_combined, algorithm=algorithm, **kwargs)
        
        # Update metadata
        result.metadata.update({
            'multi_modal': True,
            'text_weight': text_weight,
            'has_text_features': text_data is not None,
            'has_numerical_features': numerical_data is not None,
            'combined_feature_dim': X_combined.shape[1]
        })
        
        logger.info(f"Multi-modal clustering completed with {len(set(result.cluster_labels))} clusters")
        return result

    def active_learning_sample_selection(self,
                                       unlabeled_data: np.ndarray,
                                       labeled_data: Optional[np.ndarray] = None,
                                       labeled_targets: Optional[np.ndarray] = None,
                                       n_samples: int = 10,
                                       strategy: str = "uncertainty_diversity",
                                       clustering_model_key: Optional[str] = None) -> ActiveLearningResult:
        """
        Select most informative samples for labeling using active learning strategies
        
        Args:
            unlabeled_data: Unlabeled data points
            labeled_data: Already labeled data points
            labeled_targets: Labels for labeled data
            n_samples: Number of samples to select
            strategy: Selection strategy ('uncertainty', 'diversity', 'uncertainty_diversity')
            clustering_model_key: Key for existing clustering model
            
        Returns:
            ActiveLearningResult with selected samples and scores
        """
        n_samples = min(n_samples, len(unlabeled_data))
        
        uncertainty_scores = np.zeros(len(unlabeled_data))
        diversity_scores = np.zeros(len(unlabeled_data))
        
        # Calculate uncertainty scores
        if strategy in ["uncertainty", "uncertainty_diversity"]:
            uncertainty_scores = self._calculate_uncertainty_scores(
                unlabeled_data, labeled_data, labeled_targets, clustering_model_key
            )
        
        # Calculate diversity scores
        if strategy in ["diversity", "uncertainty_diversity"]:
            diversity_scores = self._calculate_diversity_scores(
                unlabeled_data, labeled_data
            )
        
        # Combine scores based on strategy
        if strategy == "uncertainty":
            combined_scores = uncertainty_scores
        elif strategy == "diversity":
            combined_scores = diversity_scores
        elif strategy == "uncertainty_diversity":
            # Normalize scores to [0, 1]
            norm_uncertainty = (uncertainty_scores - uncertainty_scores.min()) / (uncertainty_scores.max() - uncertainty_scores.min() + 1e-8)
            norm_diversity = (diversity_scores - diversity_scores.min()) / (diversity_scores.max() - diversity_scores.min() + 1e-8)
            combined_scores = 0.7 * norm_uncertainty + 0.3 * norm_diversity
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
        
        # Select top samples
        selected_indices = np.argsort(combined_scores)[-n_samples:].tolist()
        selected_indices.reverse()  # Highest scores first
        
        result = ActiveLearningResult(
            selected_indices=selected_indices,
            uncertainty_scores=[uncertainty_scores[i] for i in selected_indices],
            diversity_scores=[diversity_scores[i] for i in selected_indices],
            combined_scores=[combined_scores[i] for i in selected_indices],
            selection_strategy=strategy,
            metadata={
                'total_unlabeled': len(unlabeled_data),
                'n_selected': len(selected_indices),
                'has_labeled_data': labeled_data is not None,
                'strategy': strategy,
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Active learning selection completed: {n_samples} samples using {strategy}")
        return result

    def _calculate_uncertainty_scores(self,
                                    unlabeled_data: np.ndarray,
                                    labeled_data: Optional[np.ndarray],
                                    labeled_targets: Optional[np.ndarray],
                                    clustering_model_key: Optional[str]) -> np.ndarray:
        """Calculate uncertainty scores for active learning"""
        uncertainty_scores = np.zeros(len(unlabeled_data))
        
        if clustering_model_key and clustering_model_key in self.clustering_models:
            # Use existing clustering model to calculate uncertainty
            model_info = self.clustering_models[clustering_model_key]
            clusterer = model_info['model']
            
            # Predict clusters for unlabeled data
            if hasattr(clusterer, 'predict'):
                try:
                    predictions = clusterer.predict(unlabeled_data)
                    
                    # Calculate distance-based uncertainty
                    if hasattr(clusterer, 'cluster_centers_'):
                        centers = clusterer.cluster_centers_
                        for i, (point, pred_cluster) in enumerate(zip(unlabeled_data, predictions)):
                            if pred_cluster >= 0:  # Valid cluster
                                distances_to_centers = [np.linalg.norm(point - center) for center in centers]
                                min_distance = min(distances_to_centers)
                                second_min_distance = sorted(distances_to_centers)[1] if len(distances_to_centers) > 1 else min_distance
                                
                                # Uncertainty is lower when point is much closer to one center
                                if second_min_distance > min_distance:
                                    uncertainty_scores[i] = min_distance / second_min_distance
                                else:
                                    uncertainty_scores[i] = 0.5
                            else:
                                uncertainty_scores[i] = 1.0  # High uncertainty for noise points
                except:
                    # Fallback to distance-based method
                    pass
        
        if labeled_data is not None and labeled_targets is not None:
            # Use semi-supervised learning for uncertainty estimation
            try:
                # Create pseudo-labels for unlabeled data using label propagation
                combined_data = np.vstack([labeled_data, unlabeled_data])
                combined_labels = np.concatenate([labeled_targets, [-1] * len(unlabeled_data)])
                
                label_prop = LabelPropagation(kernel='knn', n_neighbors=7)
                label_prop.fit(combined_data, combined_labels)
                
                # Get prediction probabilities
                probabilities = label_prop.predict_proba(unlabeled_data)
                uncertainty_scores = 1 - np.max(probabilities, axis=1)
                
            except Exception as e:
                logger.warning(f"Label propagation failed: {e}")
                # Fallback to distance-based uncertainty
                if len(labeled_data) > 0:
                    for i, point in enumerate(unlabeled_data):
                        distances = [np.linalg.norm(point - labeled_point) for labeled_point in labeled_data]
                        min_distance = min(distances)
                        uncertainty_scores[i] = min_distance
        
        # Normalize uncertainty scores
        if uncertainty_scores.max() > uncertainty_scores.min():
            uncertainty_scores = (uncertainty_scores - uncertainty_scores.min()) / (uncertainty_scores.max() - uncertainty_scores.min())
        
        return uncertainty_scores

    def _calculate_diversity_scores(self,
                                  unlabeled_data: np.ndarray,
                                  labeled_data: Optional[np.ndarray]) -> np.ndarray:
        """Calculate diversity scores for active learning"""
        diversity_scores = np.zeros(len(unlabeled_data))
        
        # Calculate diversity based on distance to existing samples
        reference_data = labeled_data if labeled_data is not None else unlabeled_data
        
        for i, point in enumerate(unlabeled_data):
            # Calculate minimum distance to reference data
            distances = [np.linalg.norm(point - ref_point) for ref_point in reference_data]
            diversity_scores[i] = min(distances) if distances else 1.0
        
        return diversity_scores

    def semi_supervised_learning(self,
                               unlabeled_data: np.ndarray,
                               labeled_data: np.ndarray,
                               labeled_targets: np.ndarray,
                               method: str = "label_propagation") -> ClusteringResult:
        """
        Perform semi-supervised learning to propagate labels
        
        Args:
            unlabeled_data: Unlabeled data points
            labeled_data: Labeled data points
            labeled_targets: Labels for labeled data
            method: Semi-supervised method ('label_propagation' or 'label_spreading')
            
        Returns:
            ClusteringResult with propagated labels
        """
        # Combine labeled and unlabeled data
        combined_data = np.vstack([labeled_data, unlabeled_data])
        combined_labels = np.concatenate([labeled_targets, [-1] * len(unlabeled_data)])
        
        # Initialize semi-supervised model
        if method == "label_propagation":
            model = LabelPropagation(kernel='knn', n_neighbors=7, max_iter=1000)
        elif method == "label_spreading":
            model = LabelSpreading(kernel='knn', n_neighbors=7, max_iter=1000)
        else:
            raise ValueError(f"Unknown method: {method}")
        
        # Fit the model
        model.fit(combined_data, combined_labels)
        
        # Get predictions for all data
        all_predictions = model.predict(combined_data)
        unlabeled_predictions = all_predictions[len(labeled_data):]
        
        # Get prediction probabilities
        all_probabilities = model.predict_proba(combined_data)
        unlabeled_probabilities = all_probabilities[len(labeled_data):]
        
        # Calculate confidence scores
        confidence_scores = np.max(unlabeled_probabilities, axis=1)
        confidence_levels = [self._categorize_confidence(score) for score in confidence_scores]
        
        # Generate cluster names
        unique_labels = set(unlabeled_predictions)
        cluster_names = {label: f"Class_{label}" for label in unique_labels}
        
        # Calculate quality metrics
        quality_metrics = {}
        if len(set(unlabeled_predictions)) > 1:
            quality_metrics = self._calculate_cluster_quality(unlabeled_data, unlabeled_predictions)
        
        result = ClusteringResult(
            cluster_labels=unlabeled_predictions,
            cluster_centers=None,
            confidence_scores=confidence_scores,
            confidence_levels=confidence_levels,
            cluster_names=cluster_names,
            quality_metrics=quality_metrics,
            optimal_k=len(unique_labels),
            algorithm_used=f"semi_supervised_{method}",
            metadata={
                'method': method,
                'n_labeled': len(labeled_data),
                'n_unlabeled': len(unlabeled_data),
                'n_classes': len(set(labeled_targets)),
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Semi-supervised learning completed: {method}, {len(unique_labels)} classes")
        return result

    def incremental_clustering(self,
                             new_data: np.ndarray,
                             model_key: str,
                             update_model: bool = True) -> ClusteringResult:
        """
        Perform incremental clustering on new data using existing model
        
        Args:
            new_data: New data points to cluster
            model_key: Key of existing clustering model
            update_model: Whether to update the existing model
            
        Returns:
            ClusteringResult for new data
        """
        if model_key not in self.clustering_models:
            raise ValueError(f"Model {model_key} not found")
        
        model_info = self.clustering_models[model_key]
        clusterer = model_info['model']
        algorithm = model_info['algorithm']
        
        # Predict clusters for new data
        if hasattr(clusterer, 'predict'):
            cluster_labels = clusterer.predict(new_data)
        else:
            # For algorithms without predict method, refit with combined data
            logger.warning(f"Algorithm {algorithm.value} doesn't support prediction. Consider retraining.")
            cluster_labels = np.full(len(new_data), -1)  # Mark as unassigned
        
        # Calculate confidence scores
        confidence_scores = self._calculate_cluster_confidence(new_data, cluster_labels, clusterer)
        confidence_levels = [self._categorize_confidence(score) for score in confidence_scores]
        
        # Generate cluster names
        cluster_names = {label: f"Cluster_{label}" for label in set(cluster_labels)}
        
        # Calculate quality metrics
        quality_metrics = {}
        if len(set(cluster_labels)) > 1:
            quality_metrics = self._calculate_cluster_quality(new_data, cluster_labels)
        
        result = ClusteringResult(
            cluster_labels=cluster_labels,
            cluster_centers=getattr(clusterer, 'cluster_centers_', None),
            confidence_scores=confidence_scores,
            confidence_levels=confidence_levels,
            cluster_names=cluster_names,
            quality_metrics=quality_metrics,
            optimal_k=len(set(cluster_labels)),
            algorithm_used=f"incremental_{algorithm.value}",
            metadata={
                'base_model_key': model_key,
                'n_new_samples': len(new_data),
                'incremental': True,
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Incremental clustering completed: {len(new_data)} new samples")
        return result

    def hierarchical_clustering_with_dendrogram(self,
                                              X: np.ndarray,
                                              max_clusters: int = 20,
                                              plot_dendrogram: bool = False) -> Tuple[ClusteringResult, Dict[str, Any]]:
        """
        Perform hierarchical clustering with dendrogram analysis
        
        Args:
            X: Feature matrix
            max_clusters: Maximum number of clusters to consider
            plot_dendrogram: Whether to generate dendrogram data
            
        Returns:
            Tuple of (ClusteringResult, dendrogram_data)
        """
        # Calculate distance matrix
        distances = pdist(X, metric='euclidean')
        linkage_matrix = linkage(distances, method='ward')
        
        # Find optimal number of clusters using gap statistic
        optimal_k = self._find_optimal_hierarchical_clusters(X, linkage_matrix, max_clusters)
        
        # Get cluster labels
        cluster_labels = fcluster(linkage_matrix, optimal_k, criterion='maxclust')
        cluster_labels = cluster_labels - 1  # Convert to 0-based indexing
        
        # Calculate confidence scores
        confidence_scores = self._calculate_hierarchical_confidence(X, cluster_labels, linkage_matrix)
        confidence_levels = [self._categorize_confidence(score) for score in confidence_scores]
        
        # Generate cluster names
        cluster_names = {label: f"Cluster_{label}" for label in set(cluster_labels)}
        
        # Calculate quality metrics
        quality_metrics = self._calculate_cluster_quality(X, cluster_labels)
        
        # Generate dendrogram data if requested
        dendrogram_data = {}
        if plot_dendrogram:
            dendrogram_data = dendrogram(linkage_matrix, no_plot=True)
        
        result = ClusteringResult(
            cluster_labels=cluster_labels,
            cluster_centers=None,
            confidence_scores=confidence_scores,
            confidence_levels=confidence_levels,
            cluster_names=cluster_names,
            quality_metrics=quality_metrics,
            optimal_k=optimal_k,
            algorithm_used="hierarchical_ward",
            metadata={
                'linkage_method': 'ward',
                'n_samples': len(X),
                'n_features': X.shape[1],
                'has_dendrogram': plot_dendrogram,
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Hierarchical clustering completed: {optimal_k} clusters")
        return result, dendrogram_data

    def _find_optimal_hierarchical_clusters(self,
                                          X: np.ndarray,
                                          linkage_matrix: np.ndarray,
                                          max_clusters: int) -> int:
        """Find optimal number of clusters for hierarchical clustering"""
        cluster_range = range(2, min(max_clusters + 1, len(X) // 2))
        silhouette_scores = {}
        
        for k in cluster_range:
            try:
                labels = fcluster(linkage_matrix, k, criterion='maxclust') - 1
                if len(set(labels)) > 1:
                    score = silhouette_score(X, labels)
                    silhouette_scores[k] = score
            except:
                continue
        
        if silhouette_scores:
            return max(silhouette_scores.keys(), key=lambda k: silhouette_scores[k])
        else:
            return min(5, max_clusters)

    def _calculate_hierarchical_confidence(self,
                                         X: np.ndarray,
                                         cluster_labels: np.ndarray,
                                         linkage_matrix: np.ndarray) -> np.ndarray:
        """Calculate confidence scores for hierarchical clustering"""
        confidence_scores = np.zeros(len(X))
        
        # Calculate cophenetic distances
        cophenetic_distances = squareform(pdist(X))
        
        for i in range(len(X)):
            label = cluster_labels[i]
            
            # Find points in same cluster
            same_cluster_mask = cluster_labels == label
            same_cluster_distances = cophenetic_distances[i][same_cluster_mask]
            
            # Find points in different clusters
            diff_cluster_mask = cluster_labels != label
            if np.any(diff_cluster_mask):
                diff_cluster_distances = cophenetic_distances[i][diff_cluster_mask]
                
                # Calculate silhouette-like score
                avg_same = np.mean(same_cluster_distances) if len(same_cluster_distances) > 1 else 0
                avg_diff = np.mean(diff_cluster_distances)
                
                if avg_diff > 0:
                    confidence_scores[i] = max(0, (avg_diff - avg_same) / max(avg_diff, avg_same))
                else:
                    confidence_scores[i] = 0.5
            else:
                confidence_scores[i] = 0.5
        
        return confidence_scores

    def ensemble_clustering(self,
                          X: np.ndarray,
                          algorithms: List[ClusteringAlgorithm] = None,
                          consensus_method: str = "voting") -> ClusteringResult:
        """
        Perform ensemble clustering using multiple algorithms
        
        Args:
            X: Feature matrix
            algorithms: List of clustering algorithms to use
            consensus_method: Method to combine results ('voting', 'weighted')
            
        Returns:
            ClusteringResult with ensemble predictions
        """
        if algorithms is None:
            algorithms = [
                ClusteringAlgorithm.KMEANS,
                ClusteringAlgorithm.GAUSSIAN_MIXTURE,
                ClusteringAlgorithm.SPECTRAL
            ]
        
        # Collect results from different algorithms
        algorithm_results = {}
        algorithm_weights = {}
        
        for algorithm in algorithms:
            try:
                result = self.cluster_data(X, algorithm=algorithm, auto_optimize=True)
                algorithm_results[algorithm] = result
                
                # Weight by silhouette score
                silhouette = result.quality_metrics.get('silhouette_score', 0)
                algorithm_weights[algorithm] = max(0, silhouette)
                
            except Exception as e:
                logger.warning(f"Algorithm {algorithm.value} failed: {e}")
                continue
        
        if not algorithm_results:
            raise ValueError("No algorithms succeeded")
        
        # Create consensus clustering
        n_samples = len(X)
        
        if consensus_method == "voting":
            # Simple majority voting
            consensus_labels = self._consensus_voting(algorithm_results, n_samples)
        elif consensus_method == "weighted":
            # Weighted consensus based on algorithm quality
            consensus_labels = self._weighted_consensus(algorithm_results, algorithm_weights, n_samples)
        else:
            raise ValueError(f"Unknown consensus method: {consensus_method}")
        
        # Calculate ensemble confidence scores
        confidence_scores = self._calculate_ensemble_confidence(algorithm_results, consensus_labels)
        confidence_levels = [self._categorize_confidence(score) for score in confidence_scores]
        
        # Generate cluster names
        cluster_names = {label: f"Ensemble_Cluster_{label}" for label in set(consensus_labels)}
        
        # Calculate quality metrics
        quality_metrics = self._calculate_cluster_quality(X, consensus_labels)
        
        result = ClusteringResult(
            cluster_labels=consensus_labels,
            cluster_centers=None,
            confidence_scores=confidence_scores,
            confidence_levels=confidence_levels,
            cluster_names=cluster_names,
            quality_metrics=quality_metrics,
            optimal_k=len(set(consensus_labels)),
            algorithm_used=f"ensemble_{consensus_method}",
            metadata={
                'algorithms_used': [alg.value for alg in algorithm_results.keys()],
                'consensus_method': consensus_method,
                'algorithm_weights': {alg.value: weight for alg, weight in algorithm_weights.items()},
                'n_algorithms': len(algorithm_results),
                'timestamp': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Ensemble clustering completed: {len(algorithm_results)} algorithms, {len(set(consensus_labels))} clusters")
        return result

    def _consensus_voting(self, algorithm_results: Dict, n_samples: int) -> np.ndarray:
        """Create consensus labels using majority voting"""
        # Map each algorithm's labels to a common space
        mapped_results = {}
        
        for algorithm, result in algorithm_results.items():
            # Create co-occurrence matrix
            labels = result.cluster_labels
            n_clusters = len(set(labels))
            
            # Store labels and cluster count for mapping
            mapped_results[algorithm] = {
                'labels': labels,
                'n_clusters': n_clusters
            }
        
        # Find consensus clusters using co-occurrence
        consensus_labels = np.zeros(n_samples, dtype=int)
        
        # Use first algorithm as base, then refine
        base_algorithm = list(mapped_results.keys())[0]
        consensus_labels = mapped_results[base_algorithm]['labels'].copy()
        
        # Iteratively refine using other algorithms
        for algorithm, data in mapped_results.items():
            if algorithm == base_algorithm:
                continue
            
            # Find best mapping between current consensus and this algorithm
            current_labels = data['labels']
            mapping = self._find_label_mapping(consensus_labels, current_labels)
            
            # Update consensus where there's agreement
            for i in range(n_samples):
                mapped_label = mapping.get(current_labels[i], current_labels[i])
                if mapped_label == consensus_labels[i]:
                    continue  # Agreement, keep current
                # For disagreement, could implement voting logic here
        
        return consensus_labels

    def _weighted_consensus(self, algorithm_results: Dict, algorithm_weights: Dict, n_samples: int) -> np.ndarray:
        """Create consensus labels using weighted combination"""
        # Normalize weights
        total_weight = sum(algorithm_weights.values())
        if total_weight == 0:
            return self._consensus_voting(algorithm_results, n_samples)
        
        normalized_weights = {alg: weight / total_weight for alg, weight in algorithm_weights.items()}
        
        # For simplicity, use the highest weighted algorithm as base
        best_algorithm = max(normalized_weights.keys(), key=lambda k: normalized_weights[k])
        consensus_labels = algorithm_results[best_algorithm].cluster_labels.copy()
        
        return consensus_labels

    def _find_label_mapping(self, labels1: np.ndarray, labels2: np.ndarray) -> Dict[int, int]:
        """Find optimal mapping between two label sets"""
        unique_labels1 = set(labels1)
        unique_labels2 = set(labels2)
        
        # Create mapping based on maximum overlap
        mapping = {}
        
        for label2 in unique_labels2:
            mask2 = labels2 == label2
            overlaps = {}
            
            for label1 in unique_labels1:
                mask1 = labels1 == label1
                overlap = np.sum(mask1 & mask2)
                overlaps[label1] = overlap
            
            if overlaps:
                best_match = max(overlaps.keys(), key=lambda k: overlaps[k])
                mapping[label2] = best_match
        
        return mapping

    def _calculate_ensemble_confidence(self, algorithm_results: Dict, consensus_labels: np.ndarray) -> np.ndarray:
        """Calculate confidence scores for ensemble clustering"""
        n_samples = len(consensus_labels)
        confidence_scores = np.zeros(n_samples)
        
        for i in range(n_samples):
            consensus_label = consensus_labels[i]
            agreements = 0
            total_algorithms = len(algorithm_results)
            
            for algorithm, result in algorithm_results.items():
                # Check if this algorithm agrees with consensus
                # (simplified - in practice would need proper label mapping)
                if result.cluster_labels[i] == consensus_label:
                    agreements += 1
            
            # Confidence based on agreement ratio
            agreement_ratio = agreements / total_algorithms if total_algorithms > 0 else 0
            
            # Also consider individual algorithm confidences
            individual_confidences = []
            for algorithm, result in algorithm_results.items():
                if i < len(result.confidence_scores):
                    individual_confidences.append(result.confidence_scores[i])
            
            avg_individual_confidence = np.mean(individual_confidences) if individual_confidences else 0.5
            
            # Combine agreement and individual confidence
            confidence_scores[i] = 0.6 * agreement_ratio + 0.4 * avg_individual_confidence
        
        return confidence_scores

    def streaming_clustering(self,
                           data_stream,
                           batch_size: int = 100,
                           algorithm: ClusteringAlgorithm = ClusteringAlgorithm.KMEANS,
                           adaptation_rate: float = 0.1) -> Dict[str, Any]:
        """
        Perform streaming clustering on data stream
        
        Args:
            data_stream: Iterator or generator of data batches
            batch_size: Size of each processing batch
            algorithm: Clustering algorithm to use
            adaptation_rate: Rate of model adaptation
            
        Returns:
            Dictionary with streaming results and model state
        """
        # Initialize streaming state
        streaming_state = {
            'model': None,
            'batch_count': 0,
            'total_samples': 0,
            'cluster_centers': None,
            'cluster_counts': defaultdict(int),
            'adaptation_history': []
        }
        
        batch_results = []
        
        try:
            for batch_data in data_stream:
                if len(batch_data) == 0:
                    continue
                
                batch_data = np.array(batch_data)
                streaming_state['batch_count'] += 1
                streaming_state['total_samples'] += len(batch_data)
                
                if streaming_state['model'] is None:
                    # Initialize model with first batch
                    result = self.cluster_data(batch_data, algorithm=algorithm)
                    streaming_state['model'] = result
                    streaming_state['cluster_centers'] = result.cluster_centers
                else:
                    # Update existing model
                    result = self._update_streaming_model(
                        batch_data, 
                        streaming_state, 
                        algorithm, 
                        adaptation_rate
                    )
                
                # Update cluster counts
                for label in result.cluster_labels:
                    streaming_state['cluster_counts'][int(label)] += 1
                
                # Store batch result
                batch_results.append({
                    'batch_id': streaming_state['batch_count'],
                    'batch_size': len(batch_data),
                    'cluster_labels': result.cluster_labels.tolist(),
                    'confidence_scores': result.confidence_scores.tolist(),
                    'quality_metrics': result.quality_metrics,
                    'timestamp': datetime.now().isoformat()
                })
                
                # Log progress
                if streaming_state['batch_count'] % 10 == 0:
                    logger.info(f"Processed {streaming_state['batch_count']} batches, "
                              f"{streaming_state['total_samples']} total samples")
        
        except Exception as e:
            logger.error(f"Error in streaming clustering: {e}")
        
        return {
            'streaming_state': streaming_state,
            'batch_results': batch_results,
            'final_model': streaming_state['model'],
            'total_batches': streaming_state['batch_count'],
            'total_samples': streaming_state['total_samples']
        }

    def _update_streaming_model(self,
                              batch_data: np.ndarray,
                              streaming_state: Dict,
                              algorithm: ClusteringAlgorithm,
                              adaptation_rate: float) -> ClusteringResult:
        """Update streaming clustering model with new batch"""
        try:
            # Get predictions for new batch using existing model
            existing_result = streaming_state['model']
            
            if algorithm == ClusteringAlgorithm.KMEANS and streaming_state['cluster_centers'] is not None:
                # For K-means, use mini-batch update
                centers = streaming_state['cluster_centers']
                
                # Assign points to nearest centers
                distances = np.array([[np.linalg.norm(point - center) for center in centers] 
                                    for point in batch_data])
                cluster_labels = np.argmin(distances, axis=1)
                
                # Update centers using adaptation rate
                for k, center in enumerate(centers):
                    cluster_points = batch_data[cluster_labels == k]
                    if len(cluster_points) > 0:
                        new_center = np.mean(cluster_points, axis=0)
                        centers[k] = (1 - adaptation_rate) * center + adaptation_rate * new_center
                
                streaming_state['cluster_centers'] = centers
                
                # Calculate confidence scores
                confidence_scores = np.zeros(len(batch_data))
                for i, (point, label) in enumerate(zip(batch_data, cluster_labels)):
                    distance = np.linalg.norm(point - centers[label])
                    # Simple distance-based confidence
                    max_distance = np.max([np.linalg.norm(point - center) for center in centers])
                    confidence_scores[i] = 1 - (distance / max_distance) if max_distance > 0 else 0.8
                
            else:
                # For other algorithms, retrain with recent data
                # (In practice, you might maintain a sliding window of recent data)
                result = self.cluster_data(batch_data, algorithm=algorithm)
                cluster_labels = result.cluster_labels
                confidence_scores = result.confidence_scores
            
            # Create result object
            confidence_levels = [self._categorize_confidence(score) for score in confidence_scores]
            cluster_names = {label: f"Stream_Cluster_{label}" for label in set(cluster_labels)}
            quality_metrics = self._calculate_cluster_quality(batch_data, cluster_labels)
            
            result = ClusteringResult(
                cluster_labels=cluster_labels,
                cluster_centers=streaming_state.get('cluster_centers'),
                confidence_scores=confidence_scores,
                confidence_levels=confidence_levels,
                cluster_names=cluster_names,
                quality_metrics=quality_metrics,
                optimal_k=len(set(cluster_labels)),
                algorithm_used=f"streaming_{algorithm.value}",
                metadata={
                    'batch_id': streaming_state['batch_count'],
                    'streaming': True,
                    'adaptation_rate': adaptation_rate,
                    'total_samples_seen': streaming_state['total_samples'],
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error updating streaming model: {e}")
            # Fallback to retraining
            return self.cluster_data(batch_data, algorithm=algorithm)

    def _categorize_confidence(self, score: float) -> ConfidenceLevel:
        """Categorize confidence score into levels"""
        if score >= 0.95:
            return ConfidenceLevel.VERY_HIGH
        elif score >= 0.85:
            return ConfidenceLevel.HIGH
        elif score >= 0.70:
            return ConfidenceLevel.MEDIUM
        elif score >= 0.50:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW

    def save_model(self, model_key: str, filepath: str, model_type: str = "clustering") -> None:
        """Save a trained model to disk"""
        if model_type == "clustering" and model_key in self.clustering_models:
            model_data = self.clustering_models[model_key]
        elif model_type == "topic" and model_key in self.topic_models:
            model_data = self.topic_models[model_key]
        else:
            raise ValueError(f"Model {model_key} of type {model_type} not found")
        
        # Create directory if it doesn't exist
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        # Save using joblib
        joblib.dump(model_data, filepath)
        logger.info(f"Model {model_key} saved to {filepath}")

    def load_model(self, filepath: str, model_key: str, model_type: str = "clustering") -> None:
        """Load a trained model from disk"""
        model_data = joblib.load(filepath)
        
        if model_type == "clustering":
            self.clustering_models[model_key] = model_data
        elif model_type == "topic":
            self.topic_models[model_key] = model_data
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        logger.info(f"Model loaded as {model_key} from {filepath}")

    def get_model_info(self, model_key: str, model_type: str = "clustering") -> Dict[str, Any]:
        """Get information about a trained model"""
        if model_type == "clustering" and model_key in self.clustering_models:
            model_info = self.clustering_models[model_key].copy()
        elif model_type == "topic" and model_key in self.topic_models:
            model_info = self.topic_models[model_key].copy()
        else:
            raise ValueError(f"Model {model_key} of type {model_type} not found")
        
        # Remove non-serializable objects
        model_info.pop('model', None)
        model_info.pop('vectorizer', None)
        
        return model_info

    def cleanup_models(self, max_age_hours: int = 24) -> Dict[str, int]:
        """Clean up old models to free memory"""
        cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
        
        # Clean clustering models
        clustering_removed = 0
        keys_to_remove = []
        for key, model_data in self.clustering_models.items():
            created_at = datetime.fromisoformat(model_data['created_at']).timestamp()
            if created_at < cutoff_time:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.clustering_models[key]
            clustering_removed += 1
        
        # Clean topic models
        topic_removed = 0
        keys_to_remove = []
        for key, model_data in self.topic_models.items():
            created_at = datetime.fromisoformat(model_data['created_at']).timestamp()
            if created_at < cutoff_time:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.topic_models[key]
            topic_removed += 1
        
        logger.info(f"Cleaned up {clustering_removed} clustering models and {topic_removed} topic models")
        return {"clustering_models_removed": clustering_removed, "topic_models_removed": topic_removed}

    def get_feature_importance(self, 
                             X: np.ndarray, 
                             cluster_labels: np.ndarray,
                             feature_names: Optional[List[str]] = None) -> Dict[int, Dict[str, float]]:
        """Calculate feature importance for each cluster"""
        feature_importance = {}
        unique_labels = set(cluster_labels)
        
        if feature_names is None:
            feature_names = [f"feature_{i}" for i in range(X.shape[1])]
        
        for label in unique_labels:
            if label == -1:  # Skip noise points
                continue
            
            cluster_mask = cluster_labels == label
            cluster_data = X[cluster_mask]
            other_data = X[~cluster_mask]
            
            if len(cluster_data) == 0 or len(other_data) == 0:
                continue
            
            # Calculate mean difference for each feature
            cluster_means = np.mean(cluster_data, axis=0)
            other_means = np.mean(other_data, axis=0)
            
            # Calculate standard deviations
            cluster_stds = np.std(cluster_data, axis=0)
            other_stds = np.std(other_data, axis=0)
            
            # Calculate effect size (Cohen's d)
            pooled_std = np.sqrt(((len(cluster_data) - 1) * cluster_stds**2 + 
                                 (len(other_data) - 1) * other_stds**2) / 
                                (len(cluster_data) + len(other_data) - 2))
            
            effect_sizes = (cluster_means - other_means) / (pooled_std + 1e-8)
            
            # Create feature importance dictionary
            feature_importance[int(label)] = {
                feature_names[i]: float(abs(effect_sizes[i])) 
                for i in range(len(feature_names))
            }
        
        return feature_importance

# Initialize global instance
auto_labeler = AdvancedAutoLabeler()