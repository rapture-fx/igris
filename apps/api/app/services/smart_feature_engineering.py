"""
Advanced Smart Feature Engineering Service

Intelligent automated feature engineering with domain-specific optimizations,
statistical intelligence, and production-ready pipeline generation.

Features:
- Automated feature generation with intelligent selection
- Domain-specific feature engineering
- Statistical and model-based feature selection
- Performance optimization with parallel processing
- Production-ready pipeline export
"""

import numpy as np
import pandas as pd
import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
import warnings

# Core ML libraries
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.preprocessing import (
    StandardScaler, RobustScaler, MinMaxScaler, QuantileTransformer,
    LabelEncoder, OneHotEncoder, TargetEncoder, OrdinalEncoder
)
from sklearn.feature_selection import (
    SelectKBest, SelectPercentile, RFE, SelectFromModel,
    chi2, f_classif, f_regression, mutual_info_classif, mutual_info_regression
)
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LassoCV, RidgeCV
from sklearn.decomposition import PCA, FastICA, TruncatedSVD
from sklearn.cluster import KMeans
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, r2_score

# Statistical libraries
from scipy import stats
from scipy.stats import boxcox, normaltest, pearsonr, spearmanr
from scipy.signal import find_peaks, welch
from scipy.spatial.distance import pdist, squareform

# Text processing libraries
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer, HashingVectorizer
try:
    import textstat
    TEXTSTAT_AVAILABLE = True
except ImportError:
    TEXTSTAT_AVAILABLE = False

try:
    from textblob import TextBlob
    TEXTBLOB_AVAILABLE = True
except ImportError:
    TEXTBLOB_AVAILABLE = False

# Time series libraries
try:
    from statsmodels.tsa.seasonal import seasonal_decompose
    from statsmodels.tsa.stattools import acf, pacf
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False

# Geographic libraries
try:
    from geopy.distance import geodesic
    GEOPY_AVAILABLE = True
except ImportError:
    GEOPY_AVAILABLE = False

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)


class FeatureType(Enum):
    """Feature type enumeration"""
    NUMERICAL = "numerical"
    CATEGORICAL = "categorical"
    TEXT = "text"
    DATETIME = "datetime"
    GEOGRAPHIC = "geographic"
    TIME_SERIES = "time_series"


@dataclass
class FeatureMetadata:
    """Metadata for a feature"""
    name: str
    feature_type: FeatureType
    importance_score: float = 0.0
    stability_score: float = 0.0
    redundancy_score: float = 0.0
    generation_method: str = ""
    domain: str = ""
    description: str = ""
    creation_time: float = field(default_factory=lambda: pd.Timestamp.now().timestamp())


@dataclass
class FeatureEngineeringConfig:
    """Configuration for feature engineering"""
    # Feature generation settings
    polynomial_degree: int = 2
    interaction_max_features: int = 50
    enable_polynomial: bool = True
    enable_interactions: bool = True
    enable_transformations: bool = True
    enable_temporal: bool = True
    enable_text: bool = True
    enable_geographic: bool = True
    
    # Feature selection settings
    selection_methods: List[str] = field(default_factory=lambda: [
        'statistical', 'model_based', 'correlation', 'stability'
    ])
    max_features_ratio: float = 0.8
    correlation_threshold: float = 0.95
    stability_threshold: float = 0.1
    
    # Performance settings
    n_jobs: int = -1
    chunk_size: int = 10000
    memory_limit_gb: float = 8.0
    enable_gpu: bool = False
    
    # Cross-validation settings
    cv_folds: int = 5
    stability_iterations: int = 10
    
    # Domain-specific settings
    domain_hints: Dict[str, Any] = field(default_factory=dict)


class SmartFeatureEngineer:
    """
    Intelligent automated feature engineering system with domain-specific optimizations.
    
    This service provides comprehensive feature engineering capabilities including:
    - Automated feature generation with intelligent degree selection
    - Statistical and model-based feature selection
    - Domain-specific feature engineering
    - Performance optimization and parallel processing
    - Production-ready pipeline generation
    """
    
    def __init__(self, config: Optional[FeatureEngineeringConfig] = None):
        self.config = config or FeatureEngineeringConfig()
        self.feature_metadata: Dict[str, FeatureMetadata] = {}
        self.original_features: List[str] = []
        self.generated_features: List[str] = []
        self.selected_features: List[str] = []
        self.pipeline: Optional[Pipeline] = None
        self.feature_importance_: Optional[pd.Series] = None
        self.selection_scores_: Dict[str, float] = {}
        
        # Initialize processors
        self.executor = ThreadPoolExecutor(max_workers=self.config.n_jobs if self.config.n_jobs > 0 else None)
        
        logger.info("Smart Feature Engineering service initialized")
    
    async def engineer_features(
        self,
        X: pd.DataFrame,
        y: Optional[Union[pd.Series, np.ndarray]] = None,
        task_type: str = "auto",
        domain: str = "general"
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Main feature engineering pipeline.
        
        Args:
            X: Input features dataframe
            y: Target variable (optional)
            task_type: Type of ML task ('classification', 'regression', 'auto')
            domain: Domain hint for specialized feature engineering
            
        Returns:
            Tuple of (engineered_features, engineering_report)
        """
        logger.info(f"Starting feature engineering for {X.shape[0]} samples, {X.shape[1]} features")
        
        # Store original features
        self.original_features = list(X.columns)
        
        # Auto-detect task type if not specified
        if task_type == "auto":
            task_type = self._detect_task_type(y) if y is not None else "unsupervised"
        
        # Phase 1: Feature Generation
        logger.info("Phase 1: Automated feature generation")
        X_generated = await self._generate_features(X, domain=domain)
        
        # Phase 2: Feature Selection
        logger.info("Phase 2: Intelligent feature selection")
        if y is not None:
            X_selected, selection_report = await self._select_features(X_generated, y, task_type)
        else:
            X_selected = X_generated
            selection_report = {"method": "unsupervised", "features_selected": len(X_generated.columns)}
        
        # Phase 3: Feature Evaluation and Ranking
        logger.info("Phase 3: Feature evaluation and ranking")
        evaluation_report = await self._evaluate_features(X_selected, y, task_type)
        
        # Phase 4: Pipeline Generation
        logger.info("Phase 4: Pipeline generation")
        pipeline_info = self._create_production_pipeline(X, X_selected)
        
        # Compile engineering report
        engineering_report = {
            "original_features": len(self.original_features),
            "generated_features": len(X_generated.columns) - len(self.original_features),
            "selected_features": len(X_selected.columns),
            "feature_reduction_ratio": len(X_selected.columns) / len(X_generated.columns),
            "selection_report": selection_report,
            "evaluation_report": evaluation_report,
            "pipeline_info": pipeline_info,
            "domain": domain,
            "task_type": task_type,
            "feature_metadata": {name: vars(meta) for name, meta in self.feature_metadata.items()}
        }
        
        logger.info(f"Feature engineering completed: {len(X_selected.columns)} final features")
        return X_selected, engineering_report
    
    async def _generate_features(self, X: pd.DataFrame, domain: str = "general") -> pd.DataFrame:
        """Generate new features using multiple strategies"""
        X_new = X.copy()
        
        # Detect feature types
        feature_types = self._detect_feature_types(X)
        
        # Generate features in parallel
        generation_tasks = []
        
        if self.config.enable_polynomial:
            generation_tasks.append(
                self._run_in_executor(self._generate_polynomial_features, X_new, feature_types)
            )
        
        if self.config.enable_interactions:
            generation_tasks.append(
                self._run_in_executor(self._generate_interaction_features, X_new, feature_types)
            )
        
        if self.config.enable_transformations:
            generation_tasks.append(
                self._run_in_executor(self._generate_transformation_features, X_new, feature_types)
            )
        
        if self.config.enable_temporal and self._has_datetime_features(X):
            generation_tasks.append(
                self._run_in_executor(self._generate_temporal_features, X_new, feature_types)
            )
        
        if self.config.enable_text and self._has_text_features(X):
            generation_tasks.append(
                self._run_in_executor(self._generate_text_features, X_new, feature_types)
            )
        
        if self.config.enable_geographic and self._has_geographic_features(X):
            generation_tasks.append(
                self._run_in_executor(self._generate_geographic_features, X_new, feature_types)
            )
        
        # Domain-specific features
        if domain != "general":
            generation_tasks.append(
                self._run_in_executor(self._generate_domain_features, X_new, domain, feature_types)
            )
        
        # Wait for all generation tasks
        generated_features_list = await asyncio.gather(*generation_tasks, return_exceptions=True)
        
        # Combine generated features
        for features in generated_features_list:
            if isinstance(features, pd.DataFrame) and not features.empty:
                # Avoid duplicate columns
                new_cols = [col for col in features.columns if col not in X_new.columns]
                if new_cols:
                    X_new = pd.concat([X_new, features[new_cols]], axis=1)
        
        logger.info(f"Generated {len(X_new.columns) - len(X.columns)} new features")
        return X_new
    
    async def _select_features(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray],
        task_type: str
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Intelligent feature selection using multiple methods"""
        selection_scores = {}
        selected_features_sets = {}
        
        # Statistical selection
        if 'statistical' in self.config.selection_methods:
            stat_features, stat_scores = await self._run_in_executor(
                self._statistical_feature_selection, X, y, task_type
            )
            selected_features_sets['statistical'] = stat_features
            selection_scores['statistical'] = stat_scores
        
        # Model-based selection
        if 'model_based' in self.config.selection_methods:
            model_features, model_scores = await self._run_in_executor(
                self._model_based_feature_selection, X, y, task_type
            )
            selected_features_sets['model_based'] = model_features
            selection_scores['model_based'] = model_scores
        
        # Correlation-based selection
        if 'correlation' in self.config.selection_methods:
            corr_features, corr_scores = await self._run_in_executor(
                self._correlation_based_selection, X, y
            )
            selected_features_sets['correlation'] = corr_features
            selection_scores['correlation'] = corr_scores
        
        # Stability selection
        if 'stability' in self.config.selection_methods:
            stable_features, stability_scores = await self._run_in_executor(
                self._stability_selection, X, y, task_type
            )
            selected_features_sets['stability'] = stable_features
            selection_scores['stability'] = stability_scores
        
        # Ensemble feature selection
        final_features = self._ensemble_feature_selection(selected_features_sets, selection_scores)
        
        # Limit features based on configuration
        max_features = int(len(X.columns) * self.config.max_features_ratio)
        if len(final_features) > max_features:
            # Rank features by combined scores
            feature_rankings = self._rank_features(final_features, selection_scores)
            final_features = feature_rankings[:max_features]
        
        self.selected_features = final_features
        X_selected = X[final_features]
        
        selection_report = {
            "methods_used": list(selected_features_sets.keys()),
            "features_per_method": {k: len(v) for k, v in selected_features_sets.items()},
            "final_features_count": len(final_features),
            "selection_scores": selection_scores
        }
        
        return X_selected, selection_report
    
    async def _evaluate_features(
        self,
        X: pd.DataFrame,
        y: Optional[Union[pd.Series, np.ndarray]],
        task_type: str
    ) -> Dict[str, Any]:
        """Evaluate feature quality and generate importance scores"""
        evaluation_report = {
            "feature_count": len(X.columns),
            "data_quality": {},
            "statistical_properties": {},
            "predictive_power": {}
        }
        
        # Data quality assessment
        evaluation_report["data_quality"] = {
            "missing_values": X.isnull().sum().to_dict(),
            "zero_variance": (X.var() == 0).sum(),
            "high_cardinality": (X.nunique() / len(X) > 0.95).sum(),
            "outlier_ratio": self._calculate_outlier_ratios(X)
        }
        
        # Statistical properties
        numerical_cols = X.select_dtypes(include=[np.number]).columns
        if len(numerical_cols) > 0:
            evaluation_report["statistical_properties"] = {
                "skewness": X[numerical_cols].skew().to_dict(),
                "kurtosis": X[numerical_cols].kurtosis().to_dict(),
                "correlation_with_target": self._calculate_target_correlations(X, y) if y is not None else {}
            }
        
        # Predictive power assessment
        if y is not None:
            predictive_scores = await self._run_in_executor(
                self._assess_predictive_power, X, y, task_type
            )
            evaluation_report["predictive_power"] = predictive_scores
            
            # Update feature metadata with importance scores
            for feature, score in predictive_scores.items():
                if feature in self.feature_metadata:
                    self.feature_metadata[feature].importance_score = score
                else:
                    self.feature_metadata[feature] = FeatureMetadata(
                        name=feature,
                        feature_type=self._detect_single_feature_type(X[feature]),
                        importance_score=score
                    )
        
        return evaluation_report
    
    def _generate_polynomial_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate polynomial features for numerical columns"""
        numerical_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.NUMERICAL]
        
        if not numerical_cols:
            return pd.DataFrame()
        
        poly_features = pd.DataFrame(index=X.index)
        
        for col in numerical_cols[:min(10, len(numerical_cols))]:  # Limit to prevent explosion
            if X[col].dtype in [np.float64, np.int64, np.float32, np.int32]:
                try:
                    # Square and cube features
                    poly_features[f"{col}_squared"] = X[col] ** 2
                    if self.config.polynomial_degree >= 3:
                        poly_features[f"{col}_cubed"] = X[col] ** 3
                    
                    # Square root and log features (with safety checks)
                    if (X[col] >= 0).all():
                        poly_features[f"{col}_sqrt"] = np.sqrt(X[col])
                    
                    if (X[col] > 0).all():
                        poly_features[f"{col}_log"] = np.log1p(X[col])
                    
                    # Update metadata
                    for new_col in poly_features.columns:
                        if new_col not in self.feature_metadata:
                            self.feature_metadata[new_col] = FeatureMetadata(
                                name=new_col,
                                feature_type=FeatureType.NUMERICAL,
                                generation_method="polynomial",
                                description=f"Polynomial transformation of {col}"
                            )
                
                except Exception as e:
                    logger.warning(f"Error generating polynomial features for {col}: {e}")
                    continue
        
        return poly_features
    
    def _generate_interaction_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate interaction features between numerical columns"""
        numerical_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.NUMERICAL]
        
        if len(numerical_cols) < 2:
            return pd.DataFrame()
        
        interaction_features = pd.DataFrame(index=X.index)
        feature_count = 0
        
        for i, col1 in enumerate(numerical_cols):
            for col2 in numerical_cols[i+1:]:
                if feature_count >= self.config.interaction_max_features:
                    break
                
                try:
                    # Multiplicative interaction
                    interaction_features[f"{col1}_x_{col2}"] = X[col1] * X[col2]
                    
                    # Ratio interaction (with safety check)
                    if (X[col2] != 0).all():
                        interaction_features[f"{col1}_div_{col2}"] = X[col1] / X[col2]
                    
                    # Difference interaction
                    interaction_features[f"{col1}_diff_{col2}"] = X[col1] - X[col2]
                    
                    feature_count += 3
                    
                    # Update metadata
                    for new_col in [f"{col1}_x_{col2}", f"{col1}_div_{col2}", f"{col1}_diff_{col2}"]:
                        if new_col in interaction_features.columns and new_col not in self.feature_metadata:
                            self.feature_metadata[new_col] = FeatureMetadata(
                                name=new_col,
                                feature_type=FeatureType.NUMERICAL,
                                generation_method="interaction",
                                description=f"Interaction between {col1} and {col2}"
                            )
                
                except Exception as e:
                    logger.warning(f"Error generating interaction features for {col1} and {col2}: {e}")
                    continue
            
            if feature_count >= self.config.interaction_max_features:
                break
        
        return interaction_features
    
    def _generate_transformation_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate mathematical transformation features"""
        numerical_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.NUMERICAL]
        
        if not numerical_cols:
            return pd.DataFrame()
        
        transform_features = pd.DataFrame(index=X.index)
        
        for col in numerical_cols:
            try:
                # Normalize features
                if X[col].std() > 0:
                    transform_features[f"{col}_normalized"] = (X[col] - X[col].mean()) / X[col].std()
                
                # Rank features
                transform_features[f"{col}_rank"] = X[col].rank()
                
                # Quantile features
                transform_features[f"{col}_quantile"] = X[col].rank(pct=True)
                
                # Binning
                try:
                    transform_features[f"{col}_binned"] = pd.cut(X[col], bins=5, labels=False)
                except:
                    pass
                
                # Box-Cox transformation (if applicable)
                if (X[col] > 0).all():
                    try:
                        transformed, lambda_val = boxcox(X[col])
                        if not np.isnan(transformed).any():
                            transform_features[f"{col}_boxcox"] = transformed
                    except:
                        pass
                
                # Update metadata
                for new_col in transform_features.columns:
                    if new_col.startswith(col) and new_col not in self.feature_metadata:
                        self.feature_metadata[new_col] = FeatureMetadata(
                            name=new_col,
                            feature_type=FeatureType.NUMERICAL,
                            generation_method="transformation",
                            description=f"Mathematical transformation of {col}"
                        )
            
            except Exception as e:
                logger.warning(f"Error generating transformation features for {col}: {e}")
                continue
        
        return transform_features
    
    def _generate_temporal_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate temporal features from datetime columns"""
        datetime_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.DATETIME]
        
        if not datetime_cols:
            return pd.DataFrame()
        
        temporal_features = pd.DataFrame(index=X.index)
        
        for col in datetime_cols:
            try:
                dt_series = pd.to_datetime(X[col])
                
                # Basic temporal features
                temporal_features[f"{col}_year"] = dt_series.dt.year
                temporal_features[f"{col}_month"] = dt_series.dt.month
                temporal_features[f"{col}_day"] = dt_series.dt.day
                temporal_features[f"{col}_weekday"] = dt_series.dt.weekday
                temporal_features[f"{col}_hour"] = dt_series.dt.hour
                temporal_features[f"{col}_minute"] = dt_series.dt.minute
                
                # Cyclical features
                temporal_features[f"{col}_month_sin"] = np.sin(2 * np.pi * dt_series.dt.month / 12)
                temporal_features[f"{col}_month_cos"] = np.cos(2 * np.pi * dt_series.dt.month / 12)
                temporal_features[f"{col}_day_sin"] = np.sin(2 * np.pi * dt_series.dt.day / 31)
                temporal_features[f"{col}_day_cos"] = np.cos(2 * np.pi * dt_series.dt.day / 31)
                
                # Derived features
                temporal_features[f"{col}_is_weekend"] = (dt_series.dt.weekday >= 5).astype(int)
                temporal_features[f"{col}_quarter"] = dt_series.dt.quarter
                
                # Time since epoch
                temporal_features[f"{col}_timestamp"] = dt_series.astype(np.int64) // 10**9
                
                # Update metadata
                for new_col in temporal_features.columns:
                    if new_col.startswith(col) and new_col not in self.feature_metadata:
                        self.feature_metadata[new_col] = FeatureMetadata(
                            name=new_col,
                            feature_type=FeatureType.NUMERICAL,
                            generation_method="temporal",
                            description=f"Temporal feature derived from {col}"
                        )
            
            except Exception as e:
                logger.warning(f"Error generating temporal features for {col}: {e}")
                continue
        
        return temporal_features
    
    def _generate_text_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate text features from text columns"""
        text_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.TEXT]
        
        if not text_cols:
            return pd.DataFrame()
        
        text_features = pd.DataFrame(index=X.index)
        
        for col in text_cols:
            try:
                text_series = X[col].fillna('').astype(str)
                
                # Basic text features
                text_features[f"{col}_length"] = text_series.str.len()
                text_features[f"{col}_word_count"] = text_series.str.split().str.len()
                text_features[f"{col}_char_count"] = text_series.str.len()
                text_features[f"{col}_sentence_count"] = text_series.str.split('.').str.len()
                
                # Advanced text features
                text_features[f"{col}_uppercase_ratio"] = text_series.str.count(r'[A-Z]') / text_series.str.len().clip(lower=1)
                text_features[f"{col}_digit_ratio"] = text_series.str.count(r'\d') / text_series.str.len().clip(lower=1)
                text_features[f"{col}_punctuation_ratio"] = text_series.str.count(r'[^\w\s]') / text_series.str.len().clip(lower=1)
                
                # Readability features (if textstat available)
                if TEXTSTAT_AVAILABLE:
                    text_features[f"{col}_flesch_reading_ease"] = text_series.apply(
                        lambda x: textstat.flesch_reading_ease(x) if x else 0
                    )
                    text_features[f"{col}_flesch_kincaid_grade"] = text_series.apply(
                        lambda x: textstat.flesch_kincaid_grade(x) if x else 0
                    )
                
                # Sentiment features (if TextBlob available)
                if TEXTBLOB_AVAILABLE:
                    sentiments = text_series.apply(lambda x: TextBlob(x).sentiment if x else (0, 0))
                    text_features[f"{col}_sentiment_polarity"] = [s[0] for s in sentiments]
                    text_features[f"{col}_sentiment_subjectivity"] = [s[1] for s in sentiments]
                
                # Update metadata
                for new_col in text_features.columns:
                    if new_col.startswith(col) and new_col not in self.feature_metadata:
                        self.feature_metadata[new_col] = FeatureMetadata(
                            name=new_col,
                            feature_type=FeatureType.NUMERICAL,
                            generation_method="text",
                            description=f"Text feature derived from {col}"
                        )
            
            except Exception as e:
                logger.warning(f"Error generating text features for {col}: {e}")
                continue
        
        return text_features
    
    def _generate_geographic_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate geographic features"""
        if not GEOPY_AVAILABLE:
            return pd.DataFrame()
        
        geographic_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.GEOGRAPHIC]
        
        if not geographic_cols:
            return pd.DataFrame()
        
        geo_features = pd.DataFrame(index=X.index)
        
        # Look for latitude/longitude pairs
        lat_cols = [col for col in X.columns if any(word in col.lower() for word in ['lat', 'latitude'])]
        lon_cols = [col for col in X.columns if any(word in col.lower() for word in ['lon', 'lng', 'longitude'])]
        
        if lat_cols and lon_cols:
            try:
                lat_col, lon_col = lat_cols[0], lon_cols[0]
                
                # Distance from major cities (example: NYC, LA, Chicago)
                major_cities = {
                    'nyc': (40.7128, -74.0060),
                    'la': (34.0522, -118.2437),
                    'chicago': (41.8781, -87.6298)
                }
                
                for city, (city_lat, city_lon) in major_cities.items():
                    distances = []
                    for idx in X.index:
                        try:
                            point_lat, point_lon = X.loc[idx, lat_col], X.loc[idx, lon_col]
                            if pd.notna(point_lat) and pd.notna(point_lon):
                                distance = geodesic((point_lat, point_lon), (city_lat, city_lon)).kilometers
                                distances.append(distance)
                            else:
                                distances.append(np.nan)
                        except:
                            distances.append(np.nan)
                    
                    geo_features[f"distance_to_{city}"] = distances
                
                # Geographic clustering features
                if len(X) > 10:
                    valid_coords = X[[lat_col, lon_col]].dropna()
                    if len(valid_coords) > 10:
                        try:
                            kmeans = KMeans(n_clusters=min(5, len(valid_coords) // 10), random_state=42)
                            clusters = kmeans.fit_predict(valid_coords)
                            cluster_map = dict(zip(valid_coords.index, clusters))
                            geo_features['geo_cluster'] = X.index.map(lambda x: cluster_map.get(x, -1))
                        except:
                            pass
            
            except Exception as e:
                logger.warning(f"Error generating geographic features: {e}")
        
        return geo_features
    
    def _generate_domain_features(
        self,
        X: pd.DataFrame,
        domain: str,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate domain-specific features"""
        domain_features = pd.DataFrame(index=X.index)
        
        if domain == "financial":
            domain_features = self._generate_financial_features(X, feature_types)
        elif domain == "ecommerce":
            domain_features = self._generate_ecommerce_features(X, feature_types)
        elif domain == "manufacturing":
            domain_features = self._generate_manufacturing_features(X, feature_types)
        elif domain == "healthcare":
            domain_features = self._generate_healthcare_features(X, feature_types)
        
        return domain_features
    
    def _generate_financial_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate financial domain-specific features"""
        financial_features = pd.DataFrame(index=X.index)
        numerical_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.NUMERICAL]
        
        # Look for price/amount columns
        price_cols = [col for col in numerical_cols if any(word in col.lower() for word in ['price', 'amount', 'value', 'cost'])]
        
        for col in price_cols:
            try:
                # Returns
                if len(X) > 1:
                    financial_features[f"{col}_returns"] = X[col].pct_change()
                    financial_features[f"{col}_log_returns"] = np.log(X[col] / X[col].shift(1))
                
                # Moving averages
                if len(X) >= 5:
                    financial_features[f"{col}_ma5"] = X[col].rolling(5).mean()
                if len(X) >= 20:
                    financial_features[f"{col}_ma20"] = X[col].rolling(20).mean()
                
                # Volatility
                if len(X) >= 20:
                    financial_features[f"{col}_volatility"] = X[col].rolling(20).std()
                
                # RSI-like features
                if len(X) > 14:
                    delta = X[col].diff()
                    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                    rs = gain / loss.clip(lower=0.001)
                    financial_features[f"{col}_rsi"] = 100 - (100 / (1 + rs))
            
            except Exception as e:
                logger.warning(f"Error generating financial features for {col}: {e}")
        
        return financial_features
    
    def _generate_ecommerce_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate ecommerce domain-specific features"""
        ecommerce_features = pd.DataFrame(index=X.index)
        
        # Look for common ecommerce columns
        quantity_cols = [col for col in X.columns if 'quantity' in col.lower()]
        price_cols = [col for col in X.columns if any(word in col.lower() for word in ['price', 'cost', 'amount'])]
        
        if quantity_cols and price_cols:
            try:
                for q_col in quantity_cols:
                    for p_col in price_cols:
                        # Total value
                        ecommerce_features[f"{q_col}_x_{p_col}_total"] = X[q_col] * X[p_col]
                        
                        # Price per unit efficiency
                        ecommerce_features[f"{p_col}_per_{q_col}"] = X[p_col] / X[q_col].clip(lower=1)
            except Exception as e:
                logger.warning(f"Error generating ecommerce features: {e}")
        
        # Category features
        category_cols = [col for col in X.columns if 'category' in col.lower()]
        for col in category_cols:
            try:
                # Category frequency encoding
                category_counts = X[col].value_counts()
                ecommerce_features[f"{col}_frequency"] = X[col].map(category_counts)
                
                # Category rarity
                ecommerce_features[f"{col}_rarity"] = 1 / ecommerce_features[f"{col}_frequency"]
            except Exception as e:
                logger.warning(f"Error generating category features for {col}: {e}")
        
        return ecommerce_features
    
    def _generate_manufacturing_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate manufacturing domain-specific features"""
        manufacturing_features = pd.DataFrame(index=X.index)
        numerical_cols = [col for col, ftype in feature_types.items() if ftype == FeatureType.NUMERICAL]
        
        # Look for sensor/measurement columns
        sensor_cols = [col for col in numerical_cols if any(word in col.lower() 
                      for word in ['temperature', 'pressure', 'vibration', 'speed', 'flow', 'voltage', 'current'])]
        
        for col in sensor_cols:
            try:
                # Control limits (statistical process control)
                mean_val = X[col].mean()
                std_val = X[col].std()
                manufacturing_features[f"{col}_ucl"] = mean_val + 3 * std_val
                manufacturing_features[f"{col}_lcl"] = mean_val - 3 * std_val
                manufacturing_features[f"{col}_out_of_control"] = ((X[col] > mean_val + 3 * std_val) | 
                                                                 (X[col] < mean_val - 3 * std_val)).astype(int)
                
                # Process capability indices
                if std_val > 0:
                    # Assuming specification limits (example)
                    usl = X[col].quantile(0.99)
                    lsl = X[col].quantile(0.01)
                    manufacturing_features[f"{col}_cp"] = (usl - lsl) / (6 * std_val)
                    manufacturing_features[f"{col}_cpk"] = min((usl - mean_val), (mean_val - lsl)) / (3 * std_val)
                
                # Rolling statistics for trend detection
                if len(X) >= 10:
                    manufacturing_features[f"{col}_rolling_mean"] = X[col].rolling(10).mean()
                    manufacturing_features[f"{col}_rolling_std"] = X[col].rolling(10).std()
                    manufacturing_features[f"{col}_trend"] = X[col] - manufacturing_features[f"{col}_rolling_mean"]
            
            except Exception as e:
                logger.warning(f"Error generating manufacturing features for {col}: {e}")
        
        return manufacturing_features
    
    def _generate_healthcare_features(
        self,
        X: pd.DataFrame,
        feature_types: Dict[str, FeatureType]
    ) -> pd.DataFrame:
        """Generate healthcare domain-specific features"""
        healthcare_features = pd.DataFrame(index=X.index)
        
        # Look for common healthcare measurements
        vital_cols = [col for col in X.columns if any(word in col.lower() 
                     for word in ['blood', 'pressure', 'heart', 'temperature', 'weight', 'height', 'glucose'])]
        
        # BMI calculation
        height_cols = [col for col in X.columns if 'height' in col.lower()]
        weight_cols = [col for col in X.columns if 'weight' in col.lower()]
        
        if height_cols and weight_cols:
            try:
                height_col, weight_col = height_cols[0], weight_cols[0]
                # Assuming height in meters, weight in kg
                healthcare_features['bmi'] = X[weight_col] / (X[height_col] ** 2)
                healthcare_features['bmi_category'] = pd.cut(
                    healthcare_features['bmi'], 
                    bins=[0, 18.5, 25, 30, float('inf')], 
                    labels=[0, 1, 2, 3]
                ).astype(int)
            except Exception as e:
                logger.warning(f"Error calculating BMI: {e}")
        
        # Vital sign ratios and combinations
        for col in vital_cols:
            try:
                # Deviation from normal ranges (example values)
                if 'systolic' in col.lower():
                    healthcare_features[f"{col}_normal_range"] = ((X[col] >= 90) & (X[col] <= 140)).astype(int)
                elif 'diastolic' in col.lower():
                    healthcare_features[f"{col}_normal_range"] = ((X[col] >= 60) & (X[col] <= 90)).astype(int)
                elif 'heart' in col.lower() and 'rate' in col.lower():
                    healthcare_features[f"{col}_normal_range"] = ((X[col] >= 60) & (X[col] <= 100)).astype(int)
                
                # Z-score normalization for outlier detection
                if X[col].std() > 0:
                    healthcare_features[f"{col}_zscore"] = (X[col] - X[col].mean()) / X[col].std()
                    healthcare_features[f"{col}_outlier"] = (np.abs(healthcare_features[f"{col}_zscore"]) > 2).astype(int)
            
            except Exception as e:
                logger.warning(f"Error generating healthcare features for {col}: {e}")
        
        return healthcare_features
    
    def _statistical_feature_selection(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray],
        task_type: str
    ) -> Tuple[List[str], Dict[str, float]]:
        """Statistical feature selection using various tests"""
        scores = {}
        
        # Choose appropriate statistical test
        if task_type == "classification":
            # Chi-square for categorical, f_classif for numerical
            categorical_cols = X.select_dtypes(include=['object', 'category']).columns
            numerical_cols = X.select_dtypes(include=[np.number]).columns
            
            selected_features = []
            
            if len(categorical_cols) > 0:
                try:
                    # Encode categorical variables
                    le = LabelEncoder()
                    X_cat_encoded = X[categorical_cols].apply(le.fit_transform)
                    selector = SelectKBest(chi2, k='all')
                    selector.fit(X_cat_encoded, y)
                    
                    chi2_scores = dict(zip(categorical_cols, selector.scores_))
                    scores.update(chi2_scores)
                    
                    # Select top features
                    k = min(len(categorical_cols), int(len(categorical_cols) * 0.8))
                    top_categorical = SelectKBest(chi2, k=k).fit(X_cat_encoded, y).get_support(indices=True)
                    selected_features.extend([categorical_cols[i] for i in top_categorical])
                except Exception as e:
                    logger.warning(f"Error in chi-square selection: {e}")
            
            if len(numerical_cols) > 0:
                try:
                    selector = SelectKBest(f_classif, k='all')
                    selector.fit(X[numerical_cols], y)
                    
                    f_scores = dict(zip(numerical_cols, selector.scores_))
                    scores.update(f_scores)
                    
                    # Select top features
                    k = min(len(numerical_cols), int(len(numerical_cols) * 0.8))
                    top_numerical = SelectKBest(f_classif, k=k).fit(X[numerical_cols], y).get_support(indices=True)
                    selected_features.extend([numerical_cols[i] for i in top_numerical])
                except Exception as e:
                    logger.warning(f"Error in f_classif selection: {e}")
        
        else:  # regression
            try:
                numerical_cols = X.select_dtypes(include=[np.number]).columns
                if len(numerical_cols) > 0:
                    selector = SelectKBest(f_regression, k='all')
                    selector.fit(X[numerical_cols], y)
                    
                    f_scores = dict(zip(numerical_cols, selector.scores_))
                    scores.update(f_scores)
                    
                    # Select top features
                    k = min(len(numerical_cols), int(len(numerical_cols) * 0.8))
                    selected_indices = SelectKBest(f_regression, k=k).fit(X[numerical_cols], y).get_support(indices=True)
                    selected_features = [numerical_cols[i] for i in selected_indices]
                else:
                    selected_features = []
            except Exception as e:
                logger.warning(f"Error in f_regression selection: {e}")
                selected_features = []
        
        return selected_features, scores
    
    def _model_based_feature_selection(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray],
        task_type: str
    ) -> Tuple[List[str], Dict[str, float]]:
        """Model-based feature selection using tree models and L1 regularization"""
        scores = {}
        selected_features = []
        
        # Encode categorical variables
        X_encoded = self._encode_features_for_model(X)
        
        try:
            if task_type == "classification":
                # Random Forest feature importance
                rf = RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=1)
                rf.fit(X_encoded, y)
                
                rf_scores = dict(zip(X_encoded.columns, rf.feature_importances_))
                scores.update({f"{k}_rf": v for k, v in rf_scores.items()})
                
                # Select top features from RF
                rf_selector = SelectFromModel(rf, prefit=True, threshold='median')
                rf_selected = rf_selector.get_support(indices=True)
                selected_features.extend([X_encoded.columns[i] for i in rf_selected])
                
                # LASSO feature selection
                try:
                    lasso = LassoCV(cv=3, random_state=42, max_iter=1000)
                    lasso.fit(X_encoded, y)
                    
                    lasso_scores = dict(zip(X_encoded.columns, np.abs(lasso.coef_)))
                    scores.update({f"{k}_lasso": v for k, v in lasso_scores.items()})
                    
                    # Select non-zero coefficients
                    lasso_selected = X_encoded.columns[lasso.coef_ != 0].tolist()
                    selected_features.extend(lasso_selected)
                except:
                    pass
            
            else:  # regression
                # Random Forest feature importance
                rf = RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=1)
                rf.fit(X_encoded, y)
                
                rf_scores = dict(zip(X_encoded.columns, rf.feature_importances_))
                scores.update({f"{k}_rf": v for k, v in rf_scores.items()})
                
                # Select top features from RF
                rf_selector = SelectFromModel(rf, prefit=True, threshold='median')
                rf_selected = rf_selector.get_support(indices=True)
                selected_features.extend([X_encoded.columns[i] for i in rf_selected])
                
                # Ridge feature selection (coefficients magnitude)
                try:
                    ridge = RidgeCV(cv=3)
                    ridge.fit(X_encoded, y)
                    
                    ridge_scores = dict(zip(X_encoded.columns, np.abs(ridge.coef_)))
                    scores.update({f"{k}_ridge": v for k, v in ridge_scores.items()})
                except:
                    pass
        
        except Exception as e:
            logger.warning(f"Error in model-based selection: {e}")
        
        # Remove duplicates
        selected_features = list(set(selected_features))
        
        return selected_features, scores
    
    def _correlation_based_selection(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray]
    ) -> Tuple[List[str], Dict[str, float]]:
        """Correlation-based feature selection"""
        numerical_cols = X.select_dtypes(include=[np.number]).columns
        
        if len(numerical_cols) == 0:
            return [], {}
        
        X_num = X[numerical_cols]
        correlation_scores = {}
        
        # Calculate correlation with target
        for col in numerical_cols:
            try:
                if pd.api.types.is_numeric_dtype(y):
                    corr, _ = pearsonr(X_num[col].fillna(0), y)
                    correlation_scores[col] = abs(corr)
                else:
                    # For categorical targets, use point-biserial correlation
                    le = LabelEncoder()
                    y_encoded = le.fit_transform(y)
                    corr, _ = pearsonr(X_num[col].fillna(0), y_encoded)
                    correlation_scores[col] = abs(corr)
            except:
                correlation_scores[col] = 0.0
        
        # Remove highly correlated features among themselves
        correlation_matrix = X_num.corr().abs()
        upper_triangle = correlation_matrix.where(
            np.triu(np.ones(correlation_matrix.shape), k=1).astype(bool)
        )
        
        # Find features with high correlation
        high_corr_pairs = []
        for col in upper_triangle.columns:
            high_corr_features = upper_triangle.index[upper_triangle[col] > self.config.correlation_threshold].tolist()
            for feature in high_corr_features:
                high_corr_pairs.append((feature, col, upper_triangle.loc[feature, col]))
        
        # Keep feature with higher target correlation
        features_to_remove = set()
        for feat1, feat2, corr_val in high_corr_pairs:
            if correlation_scores.get(feat1, 0) > correlation_scores.get(feat2, 0):
                features_to_remove.add(feat2)
            else:
                features_to_remove.add(feat1)
        
        selected_features = [col for col in numerical_cols if col not in features_to_remove]
        
        return selected_features, correlation_scores
    
    def _stability_selection(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray],
        task_type: str
    ) -> Tuple[List[str], Dict[str, float]]:
        """Stability selection using bootstrap sampling"""
        stability_scores = {}
        feature_selection_counts = {col: 0 for col in X.columns}
        
        # Encode features
        X_encoded = self._encode_features_for_model(X)
        
        for i in range(self.config.stability_iterations):
            try:
                # Bootstrap sampling
                sample_indices = np.random.choice(len(X_encoded), size=int(0.8 * len(X_encoded)), replace=True)
                X_sample = X_encoded.iloc[sample_indices]
                y_sample = y[sample_indices] if isinstance(y, np.ndarray) else y.iloc[sample_indices]
                
                # Feature selection on sample
                if task_type == "classification":
                    model = RandomForestClassifier(n_estimators=50, random_state=i, n_jobs=1)
                else:
                    model = RandomForestRegressor(n_estimators=50, random_state=i, n_jobs=1)
                
                model.fit(X_sample, y_sample)
                
                # Select top 50% features
                feature_importances = model.feature_importances_
                threshold = np.median(feature_importances)
                selected_indices = np.where(feature_importances > threshold)[0]
                
                # Count selections
                for idx in selected_indices:
                    feature_name = X_encoded.columns[idx]
                    feature_selection_counts[feature_name] += 1
            
            except Exception as e:
                logger.warning(f"Error in stability iteration {i}: {e}")
                continue
        
        # Calculate stability scores
        for feature, count in feature_selection_counts.items():
            stability_scores[feature] = count / self.config.stability_iterations
        
        # Select features with stability above threshold
        selected_features = [
            feature for feature, score in stability_scores.items() 
            if score > self.config.stability_threshold
        ]
        
        return selected_features, stability_scores
    
    def _ensemble_feature_selection(
        self,
        selected_features_sets: Dict[str, List[str]],
        selection_scores: Dict[str, Dict[str, float]]
    ) -> List[str]:
        """Ensemble multiple feature selection methods"""
        # Count how many methods selected each feature
        feature_votes = {}
        for method, features in selected_features_sets.items():
            for feature in features:
                feature_votes[feature] = feature_votes.get(feature, 0) + 1
        
        # Weight by number of methods
        min_votes = max(1, len(selected_features_sets) // 2)  # Majority vote
        ensemble_features = [
            feature for feature, votes in feature_votes.items() 
            if votes >= min_votes
        ]
        
        return ensemble_features
    
    def _rank_features(
        self,
        features: List[str],
        selection_scores: Dict[str, Dict[str, float]]
    ) -> List[str]:
        """Rank features by combined scores"""
        feature_rankings = {}
        
        for feature in features:
            combined_score = 0
            score_count = 0
            
            for method, scores in selection_scores.items():
                if feature in scores:
                    combined_score += scores[feature]
                    score_count += 1
            
            if score_count > 0:
                feature_rankings[feature] = combined_score / score_count
            else:
                feature_rankings[feature] = 0
        
        # Sort by score (descending)
        ranked_features = sorted(
            feature_rankings.keys(), 
            key=lambda x: feature_rankings[x], 
            reverse=True
        )
        
        return ranked_features
    
    def _assess_predictive_power(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray],
        task_type: str
    ) -> Dict[str, float]:
        """Assess predictive power of individual features"""
        predictive_scores = {}
        X_encoded = self._encode_features_for_model(X)
        
        for col in X_encoded.columns:
            try:
                if task_type == "classification":
                    model = RandomForestClassifier(n_estimators=10, random_state=42, n_jobs=1)
                    scores = cross_val_score(
                        model, X_encoded[[col]], y, cv=3, scoring='accuracy'
                    )
                else:
                    model = RandomForestRegressor(n_estimators=10, random_state=42, n_jobs=1)
                    scores = cross_val_score(
                        model, X_encoded[[col]], y, cv=3, scoring='r2'
                    )
                
                predictive_scores[col] = np.mean(scores)
            
            except Exception as e:
                logger.warning(f"Error assessing predictive power for {col}: {e}")
                predictive_scores[col] = 0.0
        
        return predictive_scores
    
    def _create_production_pipeline(
        self,
        X_original: pd.DataFrame,
        X_final: pd.DataFrame
    ) -> Dict[str, Any]:
        """Create production-ready sklearn pipeline"""
        # Determine preprocessing steps needed
        preprocessing_steps = []
        
        # Feature generation steps (simplified)
        feature_generation_info = {
            "polynomial_features": self.config.enable_polynomial,
            "interaction_features": self.config.enable_interactions,
            "transformation_features": self.config.enable_transformations,
            "temporal_features": self.config.enable_temporal,
            "text_features": self.config.enable_text,
            "geographic_features": self.config.enable_geographic
        }
        
        # Feature selection info
        feature_selection_info = {
            "original_features": len(self.original_features),
            "final_features": len(self.selected_features),
            "selected_features": self.selected_features,
            "selection_ratio": len(self.selected_features) / len(X_final.columns) if len(X_final.columns) > 0 else 0
        }
        
        # Pipeline components info
        pipeline_info = {
            "feature_generation": feature_generation_info,
            "feature_selection": feature_selection_info,
            "preprocessing_steps": len(preprocessing_steps),
            "exportable": True,
            "memory_usage_mb": X_final.memory_usage(deep=True).sum() / 1024 / 1024
        }
        
        return pipeline_info
    
    def export_pipeline(self, format: str = "sklearn") -> Union[Pipeline, Dict[str, Any]]:
        """
        Export the feature engineering pipeline in specified format.
        
        Args:
            format: Export format ('sklearn', 'json', 'yaml')
            
        Returns:
            Pipeline object or serializable dict
        """
        if format == "sklearn":
            # Create a simplified sklearn pipeline
            steps = [
                ('scaler', StandardScaler()),
                # Add more steps based on actual transformations used
            ]
            
            if self.selected_features:
                # Add feature selection step
                feature_selector = SelectKBest(k=len(self.selected_features))
                steps.append(('feature_selection', feature_selector))
            
            pipeline = Pipeline(steps)
            return pipeline
        
        elif format in ["json", "yaml"]:
            # Return serializable configuration
            export_data = {
                "config": vars(self.config),
                "selected_features": self.selected_features,
                "feature_metadata": {name: vars(meta) for name, meta in self.feature_metadata.items()},
                "feature_importance": self.feature_importance_.to_dict() if self.feature_importance_ is not None else None
            }
            return export_data
        
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    # Utility methods
    def _detect_task_type(self, y: Union[pd.Series, np.ndarray]) -> str:
        """Auto-detect task type from target variable"""
        if pd.api.types.is_numeric_dtype(y):
            unique_values = len(np.unique(y))
            if unique_values <= 10:
                return "classification"
            else:
                return "regression"
        else:
            return "classification"
    
    def _detect_feature_types(self, X: pd.DataFrame) -> Dict[str, FeatureType]:
        """Detect feature types for each column"""
        feature_types = {}
        
        for col in X.columns:
            feature_types[col] = self._detect_single_feature_type(X[col])
        
        return feature_types
    
    def _detect_single_feature_type(self, series: pd.Series) -> FeatureType:
        """Detect feature type for a single series"""
        # Check for datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return FeatureType.DATETIME
        
        # Check for numeric
        if pd.api.types.is_numeric_dtype(series):
            return FeatureType.NUMERICAL
        
        # Check for text (long strings)
        if pd.api.types.is_string_dtype(series):
            avg_length = series.str.len().mean()
            if avg_length > 50:  # Threshold for text vs categorical
                return FeatureType.TEXT
            else:
                return FeatureType.CATEGORICAL
        
        # Check for geographic (latitude/longitude patterns)
        if pd.api.types.is_numeric_dtype(series):
            if any(word in series.name.lower() for word in ['lat', 'lon', 'latitude', 'longitude']):
                return FeatureType.GEOGRAPHIC
        
        # Default to categorical
        return FeatureType.CATEGORICAL
    
    def _has_datetime_features(self, X: pd.DataFrame) -> bool:
        """Check if dataframe has datetime features"""
        return any(pd.api.types.is_datetime64_any_dtype(X[col]) for col in X.columns)
    
    def _has_text_features(self, X: pd.DataFrame) -> bool:
        """Check if dataframe has text features"""
        for col in X.columns:
            if pd.api.types.is_string_dtype(X[col]):
                avg_length = X[col].str.len().mean()
                if avg_length > 50:
                    return True
        return False
    
    def _has_geographic_features(self, X: pd.DataFrame) -> bool:
        """Check if dataframe has geographic features"""
        geo_keywords = ['lat', 'lon', 'latitude', 'longitude', 'coord']
        return any(
            any(keyword in col.lower() for keyword in geo_keywords)
            for col in X.columns
        )
    
    def _encode_features_for_model(self, X: pd.DataFrame) -> pd.DataFrame:
        """Encode features for model training"""
        X_encoded = X.copy()
        
        # Encode categorical features
        categorical_cols = X.select_dtypes(include=['object', 'category']).columns
        
        for col in categorical_cols:
            try:
                le = LabelEncoder()
                X_encoded[col] = le.fit_transform(X[col].astype(str))
            except:
                X_encoded[col] = 0
        
        # Fill missing values
        X_encoded = X_encoded.fillna(0)
        
        return X_encoded
    
    def _calculate_outlier_ratios(self, X: pd.DataFrame) -> Dict[str, float]:
        """Calculate outlier ratios for numerical columns"""
        outlier_ratios = {}
        numerical_cols = X.select_dtypes(include=[np.number]).columns
        
        for col in numerical_cols:
            Q1 = X[col].quantile(0.25)
            Q3 = X[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = ((X[col] < lower_bound) | (X[col] > upper_bound)).sum()
            outlier_ratios[col] = outliers / len(X)
        
        return outlier_ratios
    
    def _calculate_target_correlations(
        self,
        X: pd.DataFrame,
        y: Union[pd.Series, np.ndarray]
    ) -> Dict[str, float]:
        """Calculate correlations with target variable"""
        correlations = {}
        numerical_cols = X.select_dtypes(include=[np.number]).columns
        
        for col in numerical_cols:
            try:
                if pd.api.types.is_numeric_dtype(y):
                    corr, _ = pearsonr(X[col].fillna(0), y)
                    correlations[col] = abs(corr) if not np.isnan(corr) else 0
                else:
                    # Encode categorical target
                    le = LabelEncoder()
                    y_encoded = le.fit_transform(y)
                    corr, _ = pearsonr(X[col].fillna(0), y_encoded)
                    correlations[col] = abs(corr) if not np.isnan(corr) else 0
            except:
                correlations[col] = 0.0
        
        return correlations
    
    async def _run_in_executor(self, func: Callable, *args) -> Any:
        """Run function in thread executor"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, func, *args)
    
    def __del__(self):
        """Cleanup executor on deletion"""
        try:
            self.executor.shutdown(wait=False)
        except:
            pass


# Factory function for easy instantiation
def create_smart_feature_engineer(
    domain: str = "general",
    task_type: str = "auto",
    max_features_ratio: float = 0.8,
    n_jobs: int = -1
) -> SmartFeatureEngineer:
    """
    Factory function to create a SmartFeatureEngineer with common configurations.
    
    Args:
        domain: Domain hint for specialized features
        task_type: ML task type
        max_features_ratio: Maximum ratio of features to keep
        n_jobs: Number of parallel jobs
        
    Returns:
        Configured SmartFeatureEngineer instance
    """
    config = FeatureEngineeringConfig(
        max_features_ratio=max_features_ratio,
        n_jobs=n_jobs
    )
    
    # Domain-specific configurations
    if domain == "financial":
        config.enable_temporal = True
        config.polynomial_degree = 3
    elif domain == "ecommerce":
        config.enable_interactions = True
        config.enable_text = True
    elif domain == "manufacturing":
        config.enable_temporal = True
        config.stability_iterations = 15
    elif domain == "healthcare":
        config.correlation_threshold = 0.90
        config.enable_interactions = True
    
    return SmartFeatureEngineer(config)


# Example usage and testing
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Create sample data
        np.random.seed(42)
        n_samples = 1000
        
        data = {
            'feature1': np.random.normal(0, 1, n_samples),
            'feature2': np.random.exponential(2, n_samples),
            'category1': np.random.choice(['A', 'B', 'C'], n_samples),
            'text_feature': [f"sample text {i}" for i in range(n_samples)],
            'date_feature': pd.date_range('2023-01-01', periods=n_samples, freq='D')
        }
        
        X = pd.DataFrame(data)
        y = (X['feature1'] + X['feature2'] * 2 + np.random.normal(0, 0.1, n_samples) > 1).astype(int)
        
        # Create feature engineer
        engineer = create_smart_feature_engineer(domain="general", task_type="classification")
        
        # Run feature engineering
        X_engineered, report = await engineer.engineer_features(X, y)
        
        print(f"Original features: {len(X.columns)}")
        print(f"Engineered features: {len(X_engineered.columns)}")
        print(f"Feature reduction ratio: {report['feature_reduction_ratio']:.2f}")
        print(f"Selected features: {len(report['selected_features'])}")
    
    # Run example
    # asyncio.run(main())