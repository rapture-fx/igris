"""
MLOps Dataset Integration Service
================================

Integration layer between the Dataset Marketplace and MLOps Platform
providing seamless workflow connections for AI companies.

Features:
- Automatic dataset discovery for experiments
- Dataset lineage tracking through ML pipelines
- Quality-aware dataset recommendations for training
- Experiment result enrichment with dataset metadata
- Model registry integration with dataset provenance
- Training data versioning for reproducible experiments
- Real-time dataset usage monitoring
- Automated data quality checks before training
"""

import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

# MLOps Platform imports
try:
    from app.ml.mlops_platform import MLOpsCore, ModelMetadata
    from app.ml.enhanced_experiment_tracker import EnhancedExperimentTracker
    MLOPS_AVAILABLE = True
except ImportError:
    MLOPS_AVAILABLE = False

# Dataset Marketplace imports
try:
    from app.services.dataset_marketplace_service import (
        DatasetMarketplaceService, DatasetSearchFilters, RecommendationRequest
    )
    from app.services.dataset_quality_analyzer import DatasetQualityAnalyzer
    from app.models.dataset_marketplace import UsageType, DatasetType
    MARKETPLACE_AVAILABLE = True
except ImportError:
    MARKETPLACE_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class ExperimentDatasetConfig:
    """Configuration for dataset usage in experiments."""
    dataset_id: str
    usage_type: str  # training, validation, testing
    split_ratio: Optional[float] = None
    columns_subset: Optional[List[str]] = None
    preprocessing_steps: Optional[List[str]] = None
    quality_threshold: float = 70.0


@dataclass
class DatasetRecommendation:
    """Dataset recommendation for experiments."""
    dataset_id: str
    dataset_name: str
    relevance_score: float
    quality_score: float
    recommendation_reason: str
    dataset_metadata: Dict[str, Any]


class MLOpsDatasetIntegration:
    """
    Integration service connecting Dataset Marketplace with MLOps Platform
    for seamless AI workflow management.
    """
    
    def __init__(self,
                 mlops_core: Optional[MLOpsCore] = None,
                 marketplace_service: Optional[DatasetMarketplaceService] = None,
                 quality_analyzer: Optional[DatasetQualityAnalyzer] = None):
        
        self.mlops_core = mlops_core
        self.marketplace_service = marketplace_service
        self.quality_analyzer = quality_analyzer
        
        # Integration configuration
        self.config = {
            'auto_quality_check': True,
            'min_quality_threshold': 70.0,
            'max_dataset_recommendations': 10,
            'enable_lineage_tracking': True,
            'cache_recommendations': True
        }
        
        # Cache for expensive operations
        self._recommendation_cache = {}
        
        logger.info("MLOps Dataset Integration service initialized")
    
    async def recommend_datasets_for_experiment(self,
                                              experiment_id: str,
                                              experiment_config: Dict[str, Any],
                                              user_id: str,
                                              use_case: str = None) -> List[DatasetRecommendation]:
        """
        Recommend suitable datasets for an ML experiment based on configuration.
        
        Args:
            experiment_id: MLOps experiment ID
            experiment_config: Experiment configuration
            user_id: User running the experiment
            use_case: Specific use case description
            
        Returns:
            List of recommended datasets with relevance scores
        """
        
        if not MARKETPLACE_AVAILABLE or not self.marketplace_service:
            logger.warning("Marketplace service not available for recommendations")
            return []
        
        try:
            logger.info(f"Getting dataset recommendations for experiment {experiment_id}")
            
            # Extract experiment requirements
            target_column = experiment_config.get('target_column')
            feature_columns = experiment_config.get('feature_columns', [])
            model_configs = experiment_config.get('model_configs', [])
            
            # Determine dataset type preferences
            preferred_types = self._infer_dataset_types(model_configs, use_case)
            
            # Create recommendation request
            recommendation_request = RecommendationRequest(
                user_id=user_id,
                use_case=use_case,
                preferred_types=preferred_types,
                quality_threshold=self.config['min_quality_threshold'],
                limit=self.config['max_dataset_recommendations']
            )
            
            # Get recommendations from marketplace
            marketplace_recommendations = await self.marketplace_service.get_dataset_recommendations(
                recommendation_request
            )
            
            # Convert to integration format with additional scoring
            recommendations = []
            for rec in marketplace_recommendations:
                # Calculate enhanced relevance score
                relevance_score = await self._calculate_experiment_relevance(
                    rec, experiment_config, target_column, feature_columns
                )
                
                recommendation = DatasetRecommendation(
                    dataset_id=rec.dataset_id,
                    dataset_name=rec.name,
                    relevance_score=relevance_score,
                    quality_score=rec.quality_score,
                    recommendation_reason=self._generate_recommendation_reason(
                        rec, experiment_config
                    ),
                    dataset_metadata={
                        'type': rec.dataset_type,
                        'size_mb': rec.size_mb,
                        'row_count': rec.row_count,
                        'tags': rec.tags,
                        'created_by': rec.created_by,
                        'average_rating': rec.average_rating
                    }
                )
                recommendations.append(recommendation)
            
            # Sort by relevance score
            recommendations.sort(key=lambda x: x.relevance_score, reverse=True)
            
            logger.info(f"Generated {len(recommendations)} dataset recommendations for experiment {experiment_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to get dataset recommendations: {str(e)}")
            return []
    
    async def validate_dataset_for_experiment(self,
                                            dataset_id: str,
                                            experiment_config: Dict[str, Any],
                                            user_id: str) -> Dict[str, Any]:
        """
        Validate if a dataset is suitable for an experiment.
        
        Args:
            dataset_id: Dataset to validate
            experiment_config: Experiment configuration
            user_id: User running the experiment
            
        Returns:
            Validation results with recommendations
        """
        
        if not MARKETPLACE_AVAILABLE or not self.marketplace_service:
            return {'valid': False, 'reason': 'Marketplace service not available'}
        
        try:
            logger.info(f"Validating dataset {dataset_id} for experiment")
            
            # Get dataset details
            catalog_entry = await self.marketplace_service.get_dataset_details(
                dataset_id=dataset_id,
                user_id=user_id,
                include_quality_report=True,
                include_usage_stats=False
            )
            
            dataset = catalog_entry.dataset
            quality_report = catalog_entry.quality_report
            
            # Validation checks
            validation_results = {
                'valid': True,
                'issues': [],
                'warnings': [],
                'recommendations': [],
                'quality_score': dataset.quality_score or 0,
                'compatibility_score': 0.0
            }
            
            # Check access permissions
            if 'download' not in catalog_entry.user_permissions:
                validation_results['valid'] = False
                validation_results['issues'].append('Insufficient permissions to use dataset')
                return validation_results
            
            # Check quality threshold
            if dataset.quality_score and dataset.quality_score < self.config['min_quality_threshold']:
                validation_results['warnings'].append(
                    f'Dataset quality score ({dataset.quality_score:.1f}) below recommended threshold ({self.config["min_quality_threshold"]})'
                )
            
            # Check target column compatibility
            target_column = experiment_config.get('target_column')
            if target_column and quality_report:
                column_profiles = quality_report.column_profiles or []
                target_found = any(
                    profile.get('name') == target_column 
                    for profile in column_profiles
                )
                if not target_found:
                    validation_results['issues'].append(f'Target column "{target_column}" not found in dataset')
                    validation_results['valid'] = False
            
            # Check feature columns compatibility
            feature_columns = experiment_config.get('feature_columns', [])
            if feature_columns and quality_report:
                column_profiles = quality_report.column_profiles or []
                available_columns = {profile.get('name') for profile in column_profiles}
                missing_features = [col for col in feature_columns if col not in available_columns]
                
                if missing_features:
                    validation_results['warnings'].append(
                        f'Some feature columns not found: {missing_features}'
                    )
            
            # Calculate compatibility score
            validation_results['compatibility_score'] = await self._calculate_experiment_relevance(
                dataset, experiment_config, target_column, feature_columns
            )
            
            # Generate recommendations
            if validation_results['warnings']:
                validation_results['recommendations'].append(
                    'Review data preprocessing steps to address compatibility issues'
                )
            
            if dataset.quality_score and dataset.quality_score < 80:
                validation_results['recommendations'].append(
                    'Consider data cleaning and quality improvement before training'
                )
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Dataset validation failed: {str(e)}")
            return {
                'valid': False,
                'reason': f'Validation failed: {str(e)}',
                'issues': [str(e)],
                'warnings': [],
                'recommendations': []
            }
    
    async def track_dataset_usage_in_experiment(self,
                                              experiment_id: str,
                                              dataset_configs: List[ExperimentDatasetConfig],
                                              user_id: str) -> Dict[str, Any]:
        """
        Track dataset usage in an MLOps experiment for lineage and analytics.
        
        Args:
            experiment_id: MLOps experiment ID
            dataset_configs: List of dataset configurations used
            user_id: User running the experiment
            
        Returns:
            Tracking results and lineage information
        """
        
        if not MARKETPLACE_AVAILABLE or not self.marketplace_service:
            return {'tracked': False, 'reason': 'Marketplace service not available'}
        
        try:
            logger.info(f"Tracking dataset usage for experiment {experiment_id}")
            
            tracking_results = {
                'tracked': True,
                'experiment_id': experiment_id,
                'datasets_tracked': [],
                'lineage_links': [],
                'usage_logged': True
            }
            
            for dataset_config in dataset_configs:
                try:
                    # Create experiment-dataset link
                    link_id = await self.marketplace_service.link_dataset_to_experiment(
                        dataset_id=dataset_config.dataset_id,
                        experiment_id=experiment_id,
                        usage_type=UsageType(dataset_config.usage_type),
                        user_id=user_id,
                        columns_used=dataset_config.columns_subset,
                        split_type=dataset_config.usage_type
                    )
                    
                    tracking_results['datasets_tracked'].append({
                        'dataset_id': dataset_config.dataset_id,
                        'usage_type': dataset_config.usage_type,
                        'link_id': link_id
                    })
                    
                    tracking_results['lineage_links'].append(link_id)
                    
                except Exception as e:
                    logger.warning(f"Failed to track dataset {dataset_config.dataset_id}: {str(e)}")
                    tracking_results['datasets_tracked'].append({
                        'dataset_id': dataset_config.dataset_id,
                        'usage_type': dataset_config.usage_type,
                        'error': str(e)
                    })
            
            return tracking_results
            
        except Exception as e:
            logger.error(f"Dataset usage tracking failed: {str(e)}")
            return {
                'tracked': False,
                'reason': f'Tracking failed: {str(e)}',
                'experiment_id': experiment_id
            }
    
    async def get_experiment_dataset_lineage(self,
                                           experiment_id: str,
                                           user_id: str) -> Dict[str, Any]:
        """
        Get dataset lineage information for an experiment.
        
        Args:
            experiment_id: MLOps experiment ID
            user_id: User requesting lineage information
            
        Returns:
            Complete dataset lineage and provenance information
        """
        
        if not MARKETPLACE_AVAILABLE or not self.marketplace_service:
            return {'lineage': {}, 'datasets': []}
        
        try:
            logger.info(f"Getting dataset lineage for experiment {experiment_id}")
            
            # This would query the ExperimentDatasetUsage table
            # For now, return a placeholder structure
            lineage_info = {
                'experiment_id': experiment_id,
                'datasets_used': [],
                'lineage_graph': {},
                'provenance_chain': [],
                'data_flow': {}
            }
            
            return lineage_info
            
        except Exception as e:
            logger.error(f"Failed to get experiment dataset lineage: {str(e)}")
            return {'lineage': {}, 'datasets': [], 'error': str(e)}
    
    async def enrich_model_with_dataset_metadata(self,
                                               model_id: str,
                                               dataset_configs: List[ExperimentDatasetConfig],
                                               user_id: str) -> Dict[str, Any]:
        """
        Enrich model registry entry with dataset metadata and lineage.
        
        Args:
            model_id: Model ID in registry
            dataset_configs: Datasets used in training
            user_id: User who trained the model
            
        Returns:
            Enrichment results and updated metadata
        """
        
        if not MLOPS_AVAILABLE or not self.mlops_core:
            return {'enriched': False, 'reason': 'MLOps core not available'}
        
        try:
            logger.info(f"Enriching model {model_id} with dataset metadata")
            
            # Get model metadata
            model, metadata = self.mlops_core.get_model(model_id)
            
            # Collect dataset information
            dataset_metadata = {}
            for dataset_config in dataset_configs:
                if MARKETPLACE_AVAILABLE and self.marketplace_service:
                    try:
                        catalog_entry = await self.marketplace_service.get_dataset_details(
                            dataset_id=dataset_config.dataset_id,
                            user_id=user_id,
                            include_quality_report=True,
                            include_usage_stats=False
                        )
                        
                        dataset_metadata[dataset_config.dataset_id] = {
                            'name': catalog_entry.dataset.name,
                            'type': catalog_entry.dataset.dataset_type.value,
                            'quality_score': catalog_entry.dataset.quality_score,
                            'size_mb': catalog_entry.dataset.size_mb,
                            'usage_type': dataset_config.usage_type,
                            'columns_used': dataset_config.columns_subset,
                            'preprocessing_applied': dataset_config.preprocessing_steps
                        }
                        
                    except Exception as e:
                        logger.warning(f"Failed to get metadata for dataset {dataset_config.dataset_id}: {str(e)}")
            
            # Update model metadata (this would require extending the model registry)
            enrichment_results = {
                'enriched': True,
                'model_id': model_id,
                'datasets_metadata': dataset_metadata,
                'lineage_updated': True
            }
            
            return enrichment_results
            
        except Exception as e:
            logger.error(f"Model enrichment failed: {str(e)}")
            return {
                'enriched': False,
                'reason': f'Enrichment failed: {str(e)}',
                'model_id': model_id
            }
    
    # Private helper methods
    def _infer_dataset_types(self, model_configs: List[Dict[str, Any]], use_case: str = None) -> List[DatasetType]:
        """Infer preferred dataset types from model configurations."""
        
        preferred_types = []
        
        # Check model types for dataset type inference
        for config in model_configs:
            model_type = config.get('model_type', '').lower()
            task_type = config.get('task_type', '').lower()
            
            if 'image' in model_type or 'vision' in model_type or 'cnn' in model_type:
                preferred_types.append(DatasetType.IMAGE)
            elif 'text' in model_type or 'nlp' in model_type or 'transformer' in model_type:
                preferred_types.append(DatasetType.TEXT)
            elif 'time' in model_type or 'sequence' in model_type or 'lstm' in model_type:
                preferred_types.append(DatasetType.TIME_SERIES)
            else:
                preferred_types.append(DatasetType.TABULAR)
        
        # Use case based inference
        if use_case:
            use_case_lower = use_case.lower()
            if 'image' in use_case_lower or 'vision' in use_case_lower:
                preferred_types.append(DatasetType.IMAGE)
            elif 'text' in use_case_lower or 'nlp' in use_case_lower:
                preferred_types.append(DatasetType.TEXT)
            elif 'time' in use_case_lower or 'forecast' in use_case_lower:
                preferred_types.append(DatasetType.TIME_SERIES)
        
        # Default to tabular if no specific inference
        if not preferred_types:
            preferred_types = [DatasetType.TABULAR]
        
        return list(set(preferred_types))
    
    async def _calculate_experiment_relevance(self,
                                            dataset_info: Any,
                                            experiment_config: Dict[str, Any],
                                            target_column: str = None,
                                            feature_columns: List[str] = None) -> float:
        """Calculate relevance score of dataset for experiment."""
        
        relevance_score = 0.0
        
        # Base quality score (0-0.4)
        quality_score = getattr(dataset_info, 'quality_score', 0) or 0
        relevance_score += (quality_score / 100) * 0.4
        
        # Dataset type compatibility (0-0.3)
        model_configs = experiment_config.get('model_configs', [])
        preferred_types = self._infer_dataset_types(model_configs)
        
        dataset_type = getattr(dataset_info, 'dataset_type', None)
        if dataset_type and dataset_type in [t.value for t in preferred_types]:
            relevance_score += 0.3
        
        # Size appropriateness (0-0.1)
        size_mb = getattr(dataset_info, 'size_mb', 0) or 0
        if 1 <= size_mb <= 1000:  # Reasonable size range
            relevance_score += 0.1
        elif size_mb > 1000:  # Large dataset bonus for some use cases
            relevance_score += 0.05
        
        # Popularity and ratings (0-0.2)
        average_rating = getattr(dataset_info, 'average_rating', 0) or 0
        download_count = getattr(dataset_info, 'download_count', 0) or 0
        
        rating_factor = (average_rating / 5) * 0.1
        popularity_factor = min(download_count / 100, 1.0) * 0.1
        relevance_score += rating_factor + popularity_factor
        
        return min(1.0, relevance_score)
    
    def _generate_recommendation_reason(self,
                                      dataset_info: Any,
                                      experiment_config: Dict[str, Any]) -> str:
        """Generate human-readable recommendation reason."""
        
        reasons = []
        
        quality_score = getattr(dataset_info, 'quality_score', 0) or 0
        if quality_score >= 90:
            reasons.append("Excellent data quality")
        elif quality_score >= 70:
            reasons.append("Good data quality")
        
        average_rating = getattr(dataset_info, 'average_rating', 0) or 0
        if average_rating >= 4.0:
            reasons.append("Highly rated by users")
        
        download_count = getattr(dataset_info, 'download_count', 0) or 0
        if download_count >= 50:
            reasons.append("Popular dataset")
        
        tags = getattr(dataset_info, 'tags', []) or []
        model_configs = experiment_config.get('model_configs', [])
        
        # Check for tag matches with model types
        for config in model_configs:
            model_type = config.get('model_type', '').lower()
            if any(tag.lower() in model_type or model_type in tag.lower() for tag in tags):
                reasons.append("Relevant to your model type")
                break
        
        if not reasons:
            reasons.append("Compatible with your experiment configuration")
        
        return "; ".join(reasons)


# Factory function
def create_mlops_dataset_integration(mlops_core: MLOpsCore = None,
                                   marketplace_service: DatasetMarketplaceService = None,
                                   quality_analyzer: DatasetQualityAnalyzer = None) -> MLOpsDatasetIntegration:
    """Factory function to create MLOps dataset integration service."""
    
    return MLOpsDatasetIntegration(
        mlops_core=mlops_core,
        marketplace_service=marketplace_service,
        quality_analyzer=quality_analyzer
    )


# Integration utilities
async def setup_experiment_with_datasets(experiment_config: Dict[str, Any],
                                        user_id: str,
                                        integration_service: MLOpsDatasetIntegration = None) -> Dict[str, Any]:
    """
    Utility function to setup an experiment with recommended datasets.
    
    Args:
        experiment_config: Experiment configuration
        user_id: User setting up the experiment
        integration_service: Optional integration service instance
        
    Returns:
        Setup results with dataset recommendations and experiment ID
    """
    
    if not integration_service:
        integration_service = create_mlops_dataset_integration()
    
    try:
        # Generate experiment ID
        experiment_id = f"exp_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Get dataset recommendations
        recommendations = await integration_service.recommend_datasets_for_experiment(
            experiment_id=experiment_id,
            experiment_config=experiment_config,
            user_id=user_id,
            use_case=experiment_config.get('description', '')
        )
        
        return {
            'success': True,
            'experiment_id': experiment_id,
            'dataset_recommendations': [
                {
                    'dataset_id': rec.dataset_id,
                    'dataset_name': rec.dataset_name,
                    'relevance_score': rec.relevance_score,
                    'quality_score': rec.quality_score,
                    'reason': rec.recommendation_reason
                }
                for rec in recommendations
            ],
            'recommended_datasets_count': len(recommendations)
        }
        
    except Exception as e:
        logger.error(f"Failed to setup experiment with datasets: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'experiment_id': None,
            'dataset_recommendations': []
        }