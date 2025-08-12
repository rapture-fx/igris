"""
Specialized Processing Pipelines for Target Markets
Manufacturing sensor data, e-commerce recommendation, and financial rare event pipelines
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union
from abc import ABC, abstractmethod
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, mean_squared_error, precision_recall_curve
import logging
from datetime import datetime, timedelta

from .feature_engineering import SensorDataFeatureEngine, ColdStartFeatureEngine, RareEventFeatureEngine
from .data_quality import IndustrialDataQualityEngine, MultiSourceDataFusion
from .utils import MemoryEfficientProcessor, StreamingProcessor, FeatureCache

logger = logging.getLogger(__name__)


class BasePipeline(ABC):
    """Base class for specialized processing pipelines."""
    
    def __init__(self, pipeline_name: str, industry_type: str):
        self.pipeline_name = pipeline_name
        self.industry_type = industry_type
        self.processors = {}
        self.pipeline_state = {}
        self.performance_metrics = {}
        
    @abstractmethod
    def process(self, data: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """Main processing method to be implemented by subclasses."""
        pass
    
    @abstractmethod
    def validate_input(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Validate input data format and quality."""
        pass
    
    def get_pipeline_info(self) -> Dict[str, Any]:
        """Get information about the pipeline."""
        return {
            "pipeline_name": self.pipeline_name,
            "industry_type": self.industry_type,
            "state": self.pipeline_state,
            "performance_metrics": self.performance_metrics
        }


class ManufacturingPipeline(BasePipeline):
    """
    Specialized pipeline for manufacturing sensor data processing.
    
    Features:
    - Industrial sensor data cleaning and validation
    - Equipment health monitoring
    - Predictive maintenance indicators
    - Real-time anomaly detection
    - Production quality optimization
    """
    
    def __init__(self):
        super().__init__("Manufacturing Sensor Pipeline", "manufacturing")
        
        # Initialize specialized processors
        self.feature_engine = SensorDataFeatureEngine()
        self.quality_engine = IndustrialDataQualityEngine(industry_type="manufacturing")
        self.data_fusion = MultiSourceDataFusion()
        self.memory_processor = MemoryEfficientProcessor()
        self.streaming_processor = StreamingProcessor()
        
        # Pipeline configuration
        self.config = {
            "sample_rate": 1000.0,
            "window_size": 1024,
            "quality_threshold": 0.8,
            "anomaly_contamination": 0.05,
            "maintenance_alert_threshold": 0.7
        }
        
    def process(self, data: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """
        Process manufacturing sensor data through the complete pipeline.
        
        Args:
            data: Raw sensor data
            **kwargs: Additional processing parameters
            
        Returns:
            Comprehensive processing results
        """
        logger.info(f"Starting manufacturing pipeline processing for {len(data)} records")
        start_time = datetime.now()
        
        # Step 1: Input validation
        validation_result = self.validate_input(data)
        if not validation_result["is_valid"]:
            return {
                "success": False,
                "error": "Input validation failed",
                "validation_result": validation_result
            }
        
        # Step 2: Data quality assessment
        quality_report = self.quality_engine.comprehensive_quality_assessment(
            data, 
            sensor_metadata=kwargs.get("sensor_metadata")
        )
        
        # Step 3: Data cleaning and preprocessing
        cleaned_data, cleaning_report = self.quality_engine.clean_industrial_data(
            data,
            cleaning_strategy=kwargs.get("cleaning_strategy", "conservative"),
            sensor_metadata=kwargs.get("sensor_metadata")
        )
        
        # Step 4: Feature engineering
        features_result = self._extract_manufacturing_features(
            cleaned_data, 
            kwargs.get("sensor_columns", []),
            kwargs.get("timestamp_column")
        )
        
        # Step 5: Equipment health assessment
        health_assessment = self._assess_equipment_health(
            features_result["feature_data"],
            kwargs.get("equipment_metadata")
        )
        
        # Step 6: Anomaly detection
        anomaly_result = self._detect_manufacturing_anomalies(
            features_result["feature_data"]
        )
        
        # Step 7: Predictive maintenance analysis
        maintenance_analysis = self._analyze_predictive_maintenance(
            features_result["feature_data"],
            health_assessment,
            kwargs.get("historical_maintenance_data")
        )
        
        # Step 8: Production optimization insights
        optimization_insights = self._generate_production_insights(
            features_result["feature_data"],
            anomaly_result,
            health_assessment
        )
        
        # Step 9: Real-time monitoring setup
        monitoring_config = self._setup_realtime_monitoring(
            features_result["feature_data"],
            kwargs.get("monitoring_requirements", {})
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Compile comprehensive results
        results = {
            "success": True,
            "processing_time": processing_time,
            "pipeline_name": self.pipeline_name,
            "data_summary": {
                "original_shape": data.shape,
                "cleaned_shape": cleaned_data.shape,
                "feature_shape": features_result["feature_data"].shape,
                "data_reduction_ratio": 1 - (len(cleaned_data) / len(data))
            },
            "quality_assessment": quality_report,
            "cleaning_report": cleaning_report,
            "feature_engineering": features_result,
            "equipment_health": health_assessment,
            "anomaly_detection": anomaly_result,
            "predictive_maintenance": maintenance_analysis,
            "optimization_insights": optimization_insights,
            "monitoring_configuration": monitoring_config,
            "recommendations": self._generate_manufacturing_recommendations(
                quality_report, health_assessment, anomaly_result, maintenance_analysis
            )
        }
        
        # Update pipeline state
        self._update_pipeline_state(results)
        
        logger.info(f"Manufacturing pipeline processing completed in {processing_time:.2f} seconds")
        return results
    
    def validate_input(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Validate manufacturing sensor data input."""
        validation_result = {
            "is_valid": True,
            "issues": [],
            "warnings": [],
            "data_characteristics": {}
        }
        
        # Basic validation
        if data.empty:
            validation_result["is_valid"] = False
            validation_result["issues"].append("Dataset is empty")
            return validation_result
        
        # Check for numeric columns (sensors)
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        validation_result["data_characteristics"]["numeric_columns"] = len(numeric_columns)
        
        if len(numeric_columns) == 0:
            validation_result["is_valid"] = False
            validation_result["issues"].append("No numeric sensor columns found")
        
        # Check for timestamp column
        timestamp_columns = []
        for col in data.columns:
            if 'time' in col.lower() or 'date' in col.lower():
                try:
                    pd.to_datetime(data[col])
                    timestamp_columns.append(col)
                except:
                    continue
        
        validation_result["data_characteristics"]["timestamp_columns"] = timestamp_columns
        
        if not timestamp_columns:
            validation_result["warnings"].append("No timestamp column detected - temporal analysis will be limited")
        
        # Check data size
        if len(data) < 100:
            validation_result["warnings"].append("Small dataset - statistical analysis may be limited")
        
        # Check for excessive missing values
        missing_percentage = data.isnull().sum().sum() / (len(data) * len(data.columns))
        validation_result["data_characteristics"]["missing_percentage"] = missing_percentage
        
        if missing_percentage > 0.5:
            validation_result["is_valid"] = False
            validation_result["issues"].append("Excessive missing values (>50%)")
        elif missing_percentage > 0.2:
            validation_result["warnings"].append("High missing values (>20%)")
        
        return validation_result
    
    def _extract_manufacturing_features(self, data: pd.DataFrame, 
                                      sensor_columns: List[str],
                                      timestamp_column: Optional[str]) -> Dict[str, Any]:
        """Extract manufacturing-specific features."""
        logger.info("Extracting manufacturing features")
        
        # Auto-detect sensor columns if not provided
        if not sensor_columns:
            sensor_columns = data.select_dtypes(include=[np.number]).columns.tolist()
        
        # Clean sensor data
        cleaned_sensor_data = self.feature_engine.clean_sensor_data(data, sensor_columns)
        
        # Extract time series features
        time_series_features = pd.DataFrame()
        if timestamp_column and timestamp_column in data.columns:
            time_series_features = self.feature_engine.extract_time_series_features(
                cleaned_sensor_data, timestamp_column, sensor_columns
            )
        
        # Extract multi-sensor correlations
        correlation_features = self.feature_engine.extract_multi_sensor_correlations(
            cleaned_sensor_data, sensor_columns
        )
        
        # Combine all features
        feature_data = cleaned_sensor_data.copy()
        
        # Add correlation features as new columns
        for feature_name, feature_value in correlation_features.items():
            feature_data[feature_name] = feature_value
        
        # Add time series features if available
        if not time_series_features.empty and len(time_series_features) == len(feature_data):
            feature_data = pd.concat([feature_data, time_series_features], axis=1)
        
        return {
            "feature_data": feature_data,
            "sensor_columns": sensor_columns,
            "correlation_features": correlation_features,
            "time_series_features": time_series_features,
            "feature_count": len(feature_data.columns) - len(data.columns)
        }
    
    def _assess_equipment_health(self, feature_data: pd.DataFrame,
                               equipment_metadata: Optional[Dict]) -> Dict[str, Any]:
        """Assess equipment health from sensor features."""
        logger.info("Assessing equipment health")
        
        health_assessment = self.quality_engine._equipment_health_assessment(
            feature_data, equipment_metadata
        )
        
        # Add manufacturing-specific health indicators
        manufacturing_health = {
            "vibration_health": self._assess_vibration_health(feature_data),
            "temperature_health": self._assess_temperature_health(feature_data),
            "pressure_health": self._assess_pressure_health(feature_data),
            "production_efficiency": self._calculate_production_efficiency(feature_data),
            "wear_indicators": self._calculate_wear_indicators(feature_data)
        }
        
        health_assessment["manufacturing_specific"] = manufacturing_health
        
        return health_assessment
    
    def _detect_manufacturing_anomalies(self, feature_data: pd.DataFrame) -> Dict[str, Any]:
        """Detect anomalies specific to manufacturing processes."""
        logger.info("Detecting manufacturing anomalies")
        
        # Basic anomaly detection
        from sklearn.ensemble import IsolationForest
        from sklearn.cluster import DBSCAN
        
        numeric_data = feature_data.select_dtypes(include=[np.number]).fillna(0)
        
        if len(numeric_data.columns) == 0:
            return {"anomalies_detected": 0, "anomaly_details": []}
        
        # Isolation Forest for general anomalies
        iso_forest = IsolationForest(
            contamination=self.config["anomaly_contamination"],
            random_state=42
        )
        anomaly_scores = iso_forest.fit_predict(numeric_data)
        
        # DBSCAN for clustering-based anomalies
        dbscan = DBSCAN(eps=0.5, min_samples=5)
        cluster_labels = dbscan.fit_predict(numeric_data)
        
        # Equipment-specific anomaly detection
        equipment_anomalies = {
            "vibration_anomalies": self._detect_vibration_anomalies(feature_data),
            "temperature_anomalies": self._detect_temperature_anomalies(feature_data),
            "process_anomalies": self._detect_process_anomalies(feature_data)
        }
        
        anomaly_indices = np.where(anomaly_scores == -1)[0]
        
        return {
            "total_anomalies": len(anomaly_indices),
            "anomaly_rate": len(anomaly_indices) / len(feature_data),
            "anomaly_indices": anomaly_indices.tolist(),
            "isolation_forest_scores": anomaly_scores.tolist(),
            "cluster_labels": cluster_labels.tolist(),
            "equipment_specific_anomalies": equipment_anomalies,
            "anomaly_severity": self._classify_anomaly_severity(anomaly_indices, feature_data)
        }
    
    def _analyze_predictive_maintenance(self, feature_data: pd.DataFrame,
                                      health_assessment: Dict,
                                      historical_data: Optional[pd.DataFrame]) -> Dict[str, Any]:
        """Analyze predictive maintenance requirements."""
        logger.info("Analyzing predictive maintenance")
        
        maintenance_analysis = {
            "maintenance_score": 0.0,
            "recommended_actions": [],
            "urgency_level": "low",
            "time_to_maintenance": None,
            "component_analysis": {}
        }
        
        # Calculate overall maintenance score
        overall_health = health_assessment.get("overall_health_score", 0.8)
        maintenance_score = 1.0 - overall_health
        maintenance_analysis["maintenance_score"] = maintenance_score
        
        # Determine urgency level
        if maintenance_score > 0.7:
            maintenance_analysis["urgency_level"] = "critical"
            maintenance_analysis["recommended_actions"].append("Schedule immediate maintenance")
        elif maintenance_score > 0.5:
            maintenance_analysis["urgency_level"] = "high"
            maintenance_analysis["recommended_actions"].append("Schedule maintenance within 1 week")
        elif maintenance_score > 0.3:
            maintenance_analysis["urgency_level"] = "medium"
            maintenance_analysis["recommended_actions"].append("Schedule maintenance within 1 month")
        else:
            maintenance_analysis["urgency_level"] = "low"
            maintenance_analysis["recommended_actions"].append("Continue monitoring")
        
        # Component-specific analysis
        sensor_health = health_assessment.get("sensor_health_scores", {})
        for sensor, health_score in sensor_health.items():
            component_maintenance_score = 1.0 - health_score
            
            maintenance_analysis["component_analysis"][sensor] = {
                "maintenance_score": component_maintenance_score,
                "recommended_action": self._get_component_maintenance_action(component_maintenance_score),
                "priority": "high" if component_maintenance_score > 0.6 else "medium" if component_maintenance_score > 0.3 else "low"
            }
        
        # Estimate time to maintenance if historical data is available
        if historical_data is not None:
            maintenance_analysis["time_to_maintenance"] = self._estimate_maintenance_time(
                feature_data, historical_data, maintenance_score
            )
        
        return maintenance_analysis
    
    def _generate_production_insights(self, feature_data: pd.DataFrame,
                                    anomaly_result: Dict,
                                    health_assessment: Dict) -> Dict[str, Any]:
        """Generate production optimization insights."""
        logger.info("Generating production insights")
        
        insights = {
            "efficiency_score": 0.0,
            "bottlenecks": [],
            "optimization_opportunities": [],
            "quality_indicators": {},
            "performance_trends": {}
        }
        
        # Calculate efficiency score
        anomaly_rate = anomaly_result.get("anomaly_rate", 0)
        overall_health = health_assessment.get("overall_health_score", 0.8)
        efficiency_score = overall_health * (1 - anomaly_rate)
        insights["efficiency_score"] = efficiency_score
        
        # Identify bottlenecks
        if anomaly_rate > 0.1:
            insights["bottlenecks"].append("High anomaly rate affecting production")
        
        if overall_health < 0.7:
            insights["bottlenecks"].append("Equipment health issues impacting efficiency")
        
        # Optimization opportunities
        if efficiency_score < 0.8:
            insights["optimization_opportunities"].extend([
                "Implement predictive maintenance schedule",
                "Optimize sensor calibration procedures",
                "Review production parameters for anomaly sources"
            ])
        
        # Quality indicators
        insights["quality_indicators"] = {
            "consistency_score": 1.0 - anomaly_rate,
            "reliability_score": overall_health,
            "stability_score": self._calculate_stability_score(feature_data)
        }
        
        return insights
    
    # Helper methods for manufacturing pipeline
    def _assess_vibration_health(self, data: pd.DataFrame) -> Dict[str, float]:
        """Assess vibration-related equipment health."""
        vibration_cols = [col for col in data.columns if 'vibr' in col.lower()]
        if not vibration_cols:
            return {"vibration_health_score": 1.0, "vibration_issues": []}
        
        # Calculate vibration health metrics
        vibration_data = data[vibration_cols]
        vibration_health = 1.0 - (vibration_data.std().mean() / vibration_data.mean().mean())
        
        return {
            "vibration_health_score": max(0.0, min(1.0, vibration_health)),
            "high_vibration_sensors": [col for col in vibration_cols 
                                     if data[col].std() > data[col].mean() * 0.2]
        }
    
    def _assess_temperature_health(self, data: pd.DataFrame) -> Dict[str, float]:
        """Assess temperature-related equipment health."""
        temp_cols = [col for col in data.columns if 'temp' in col.lower()]
        if not temp_cols:
            return {"temperature_health_score": 1.0}
        
        # Simple temperature health assessment
        temp_data = data[temp_cols]
        temp_stability = 1.0 - (temp_data.std().mean() / temp_data.mean().mean())
        
        return {"temperature_health_score": max(0.0, min(1.0, temp_stability))}
    
    def _assess_pressure_health(self, data: pd.DataFrame) -> Dict[str, float]:
        """Assess pressure-related equipment health."""
        pressure_cols = [col for col in data.columns if 'press' in col.lower()]
        if not pressure_cols:
            return {"pressure_health_score": 1.0}
        
        # Simple pressure health assessment
        pressure_data = data[pressure_cols]
        pressure_stability = 1.0 - (pressure_data.std().mean() / pressure_data.mean().mean())
        
        return {"pressure_health_score": max(0.0, min(1.0, pressure_stability))}
    
    def _calculate_production_efficiency(self, data: pd.DataFrame) -> float:
        """Calculate overall production efficiency."""
        # Simplified efficiency calculation based on data quality and consistency
        numeric_data = data.select_dtypes(include=[np.number])
        if numeric_data.empty:
            return 0.5
        
        # Calculate coefficient of variation as efficiency indicator
        cv_mean = (numeric_data.std() / numeric_data.mean()).mean()
        efficiency = 1.0 / (1.0 + cv_mean)
        
        return max(0.0, min(1.0, efficiency))
    
    def _calculate_wear_indicators(self, data: pd.DataFrame) -> Dict[str, float]:
        """Calculate equipment wear indicators."""
        return {
            "overall_wear_score": 0.1,  # Placeholder
            "critical_components": []   # Placeholder
        }
    
    def _detect_vibration_anomalies(self, data: pd.DataFrame) -> Dict:
        """Detect vibration-specific anomalies."""
        return {"vibration_anomalies": 0}  # Placeholder
    
    def _detect_temperature_anomalies(self, data: pd.DataFrame) -> Dict:
        """Detect temperature-specific anomalies."""
        return {"temperature_anomalies": 0}  # Placeholder
    
    def _detect_process_anomalies(self, data: pd.DataFrame) -> Dict:
        """Detect process-specific anomalies."""
        return {"process_anomalies": 0}  # Placeholder
    
    def _classify_anomaly_severity(self, anomaly_indices: np.ndarray, data: pd.DataFrame) -> Dict:
        """Classify anomaly severity levels."""
        return {"severity_distribution": {"low": 0, "medium": 0, "high": 0}}  # Placeholder
    
    def _get_component_maintenance_action(self, maintenance_score: float) -> str:
        """Get recommended maintenance action for component."""
        if maintenance_score > 0.7:
            return "Immediate inspection required"
        elif maintenance_score > 0.5:
            return "Schedule maintenance"
        elif maintenance_score > 0.3:
            return "Monitor closely"
        else:
            return "Continue normal operation"
    
    def _estimate_maintenance_time(self, current_data: pd.DataFrame, 
                                 historical_data: pd.DataFrame, 
                                 maintenance_score: float) -> str:
        """Estimate time until maintenance needed."""
        # Simplified estimation
        if maintenance_score > 0.7:
            return "1-3 days"
        elif maintenance_score > 0.5:
            return "1-2 weeks"
        elif maintenance_score > 0.3:
            return "1-2 months"
        else:
            return "3+ months"
    
    def _calculate_stability_score(self, data: pd.DataFrame) -> float:
        """Calculate overall data stability score."""
        numeric_data = data.select_dtypes(include=[np.number])
        if numeric_data.empty:
            return 0.5
        
        # Calculate stability based on coefficient of variation
        cv_scores = numeric_data.std() / (numeric_data.mean() + 1e-8)
        stability = 1.0 / (1.0 + cv_scores.mean())
        
        return max(0.0, min(1.0, stability))
    
    def _setup_realtime_monitoring(self, data: pd.DataFrame, requirements: Dict) -> Dict:
        """Setup real-time monitoring configuration."""
        return {
            "monitoring_enabled": True,
            "alert_thresholds": self.config,
            "monitoring_frequency": requirements.get("frequency", "1 minute")
        }
    
    def _generate_manufacturing_recommendations(self, quality_report: Dict,
                                              health_assessment: Dict,
                                              anomaly_result: Dict,
                                              maintenance_analysis: Dict) -> List[str]:
        """Generate actionable recommendations for manufacturing operations."""
        recommendations = []
        
        # Quality-based recommendations
        overall_quality = quality_report.get("overall_quality_grade", "C")
        if overall_quality[0] in ['D', 'F']:
            recommendations.append("Implement comprehensive data quality monitoring")
            recommendations.append("Review sensor calibration procedures")
        
        # Health-based recommendations
        overall_health = health_assessment.get("overall_health_score", 0.8)
        if overall_health < 0.7:
            recommendations.append("Schedule equipment health assessment")
            recommendations.append("Consider predictive maintenance implementation")
        
        # Anomaly-based recommendations
        anomaly_rate = anomaly_result.get("anomaly_rate", 0)
        if anomaly_rate > 0.1:
            recommendations.append("Investigate high anomaly rate causes")
            recommendations.append("Implement real-time anomaly alerting")
        
        # Maintenance-based recommendations
        urgency = maintenance_analysis.get("urgency_level", "low")
        if urgency in ["critical", "high"]:
            recommendations.extend(maintenance_analysis.get("recommended_actions", []))
        
        return recommendations
    
    def _update_pipeline_state(self, results: Dict):
        """Update pipeline state with processing results."""
        self.pipeline_state.update({
            "last_processed": datetime.now().isoformat(),
            "last_data_shape": results["data_summary"]["original_shape"],
            "last_quality_grade": results["quality_assessment"].get("overall_quality_grade", "Unknown"),
            "last_processing_time": results["processing_time"]
        })


class EcommercePipeline(BasePipeline):
    """
    Specialized pipeline for e-commerce cold start problems.
    
    Features:
    - New user and item feature engineering
    - Content-based recommendation features
    - Collaborative filtering for sparse data
    - Demographic-based recommendations
    - Real-time recommendation serving
    """
    
    def __init__(self):
        super().__init__("E-commerce Cold Start Pipeline", "ecommerce")
        
        self.feature_engine = ColdStartFeatureEngine()
        self.memory_processor = MemoryEfficientProcessor()
        
        self.config = {
            "min_interactions_threshold": 5,
            "recommendation_count": 10,
            "content_weight": 0.4,
            "demographic_weight": 0.3,
            "popularity_weight": 0.3
        }
    
    def process(self, data: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """
        Process e-commerce data for cold start recommendations.
        
        Args:
            data: E-commerce interaction data
            **kwargs: Additional data like user_data, item_data, popular_items
            
        Returns:
            Cold start recommendation results
        """
        logger.info(f"Starting e-commerce pipeline processing for {len(data)} interactions")
        start_time = datetime.now()
        
        # Input validation
        validation_result = self.validate_input(data)
        if not validation_result["is_valid"]:
            return {
                "success": False,
                "error": "Input validation failed", 
                "validation_result": validation_result
            }
        
        # Extract required data
        user_data = kwargs.get("user_data", pd.DataFrame())
        item_data = kwargs.get("item_data", pd.DataFrame())
        popular_items = kwargs.get("popular_items", [])
        
        # Identify cold start users and items
        cold_start_analysis = self._identify_cold_start_entities(data, user_data, item_data)
        
        # Extract cold start features
        feature_result = self._extract_cold_start_features(
            data, user_data, item_data, cold_start_analysis
        )
        
        # Generate recommendations
        recommendations = self._generate_cold_start_recommendations(
            feature_result, popular_items
        )
        
        # Calculate recommendation quality metrics
        quality_metrics = self._calculate_recommendation_quality(
            recommendations, data, cold_start_analysis
        )
        
        # Generate insights
        insights = self._generate_ecommerce_insights(
            cold_start_analysis, feature_result, recommendations
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        results = {
            "success": True,
            "processing_time": processing_time,
            "pipeline_name": self.pipeline_name,
            "cold_start_analysis": cold_start_analysis,
            "feature_engineering": feature_result,
            "recommendations": recommendations,
            "quality_metrics": quality_metrics,
            "insights": insights,
            "recommendations_served": len(recommendations.get("user_recommendations", {}))
        }
        
        self._update_pipeline_state(results)
        
        logger.info(f"E-commerce pipeline completed in {processing_time:.2f} seconds")
        return results
    
    def validate_input(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Validate e-commerce interaction data."""
        validation_result = {
            "is_valid": True,
            "issues": [],
            "warnings": []
        }
        
        # Check required columns
        required_columns = ["user_id", "item_id"]
        missing_columns = [col for col in required_columns if col not in data.columns]
        
        if missing_columns:
            validation_result["is_valid"] = False
            validation_result["issues"].append(f"Missing required columns: {missing_columns}")
        
        # Check data size
        if len(data) < 100:
            validation_result["warnings"].append("Small interaction dataset - recommendations may be limited")
        
        return validation_result
    
    def _identify_cold_start_entities(self, interaction_data: pd.DataFrame,
                                    user_data: pd.DataFrame,
                                    item_data: pd.DataFrame) -> Dict[str, Any]:
        """Identify cold start users and items."""
        # Count interactions per user and item
        user_interaction_counts = interaction_data.groupby("user_id").size()
        item_interaction_counts = interaction_data.groupby("item_id").size()
        
        # Identify cold start entities
        cold_start_users = user_interaction_counts[
            user_interaction_counts <= self.config["min_interactions_threshold"]
        ].index.tolist()
        
        cold_start_items = item_interaction_counts[
            item_interaction_counts <= self.config["min_interactions_threshold"]
        ].index.tolist()
        
        return {
            "total_users": len(user_interaction_counts),
            "total_items": len(item_interaction_counts),
            "cold_start_users": cold_start_users,
            "cold_start_items": cold_start_items,
            "cold_start_user_ratio": len(cold_start_users) / len(user_interaction_counts),
            "cold_start_item_ratio": len(cold_start_items) / len(item_interaction_counts),
            "user_interaction_stats": {
                "mean": user_interaction_counts.mean(),
                "median": user_interaction_counts.median(),
                "std": user_interaction_counts.std()
            },
            "item_interaction_stats": {
                "mean": item_interaction_counts.mean(),
                "median": item_interaction_counts.median(),
                "std": item_interaction_counts.std()
            }
        }
    
    def _extract_cold_start_features(self, interaction_data: pd.DataFrame,
                                   user_data: pd.DataFrame,
                                   item_data: pd.DataFrame,
                                   cold_start_analysis: Dict) -> Dict[str, Any]:
        """Extract features for cold start recommendation."""
        # Extract user features
        user_features = pd.DataFrame()
        if not user_data.empty:
            user_features = self.feature_engine.extract_cold_start_user_features(
                user_data, interaction_data
            )
        
        # Extract item features
        item_features = pd.DataFrame()
        if not item_data.empty:
            item_features = self.feature_engine.extract_cold_start_item_features(
                item_data, interaction_data
            )
        
        return {
            "user_features": user_features,
            "item_features": item_features,
            "feature_extraction_success": not user_features.empty or not item_features.empty
        }
    
    def _generate_cold_start_recommendations(self, feature_result: Dict,
                                           popular_items: List[str]) -> Dict[str, Any]:
        """Generate recommendations for cold start scenarios."""
        user_features = feature_result.get("user_features", pd.DataFrame())
        item_features = feature_result.get("item_features", pd.DataFrame())
        
        if user_features.empty:
            return {
                "user_recommendations": {},
                "recommendation_strategy": "popularity_based",
                "total_recommendations": 0
            }
        
        # Generate recommendations using the feature engine
        recommendations = self.feature_engine.generate_cold_start_recommendations(
            user_features, item_features, popular_items
        )
        
        return {
            "user_recommendations": recommendations,
            "recommendation_strategy": "hybrid_cold_start",
            "total_recommendations": len(recommendations),
            "average_recommendations_per_user": np.mean([len(recs) for recs in recommendations.values()]) if recommendations else 0
        }
    
    def _calculate_recommendation_quality(self, recommendations: Dict,
                                        interaction_data: pd.DataFrame,
                                        cold_start_analysis: Dict) -> Dict[str, Any]:
        """Calculate quality metrics for recommendations."""
        return {
            "coverage": len(recommendations.get("user_recommendations", {})) / max(1, cold_start_analysis["total_users"]),
            "diversity_score": 0.8,  # Placeholder
            "novelty_score": 0.7,   # Placeholder
            "recommendation_confidence": 0.75  # Placeholder
        }
    
    def _generate_ecommerce_insights(self, cold_start_analysis: Dict,
                                   feature_result: Dict,
                                   recommendations: Dict) -> Dict[str, Any]:
        """Generate e-commerce specific insights."""
        return {
            "cold_start_severity": "high" if cold_start_analysis["cold_start_user_ratio"] > 0.3 else "moderate",
            "feature_availability": "good" if feature_result["feature_extraction_success"] else "limited",
            "recommendation_coverage": recommendations.get("total_recommendations", 0) / max(1, cold_start_analysis["total_users"]),
            "optimization_opportunities": [
                "Implement user onboarding questionnaire",
                "Enhance item content features",
                "Deploy real-time recommendation updates"
            ]
        }


class FinancialPipeline(BasePipeline):
    """
    Specialized pipeline for financial rare event detection.
    
    Features:
    - Advanced sampling for imbalanced datasets
    - Financial anomaly detection
    - Risk indicators and market stress features
    - Regulatory compliance features
    - Real-time fraud detection
    """
    
    def __init__(self):
        super().__init__("Financial Rare Event Pipeline", "financial")
        
        self.feature_engine = RareEventFeatureEngine()
        self.memory_processor = MemoryEfficientProcessor()
        
        self.config = {
            "rare_event_threshold": 0.05,
            "sampling_strategy": "adaptive",
            "risk_threshold": 0.8,
            "fraud_confidence_threshold": 0.9
        }
    
    def process(self, data: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """
        Process financial data for rare event detection.
        
        Args:
            data: Financial transaction or market data
            **kwargs: Additional parameters like target_column, timestamp_column
            
        Returns:
            Rare event detection and sampling results
        """
        logger.info(f"Starting financial pipeline processing for {len(data)} records")
        start_time = datetime.now()
        
        # Input validation
        validation_result = self.validate_input(data)
        if not validation_result["is_valid"]:
            return {
                "success": False,
                "error": "Input validation failed",
                "validation_result": validation_result
            }
        
        target_column = kwargs.get("target_column")
        timestamp_column = kwargs.get("timestamp_column")
        
        # Feature engineering for rare events
        feature_result = self._extract_rare_event_features(data, target_column, timestamp_column)
        
        # Rare event sampling
        sampling_result = self._apply_rare_event_sampling(
            feature_result["enhanced_data"], target_column
        )
        
        # Risk assessment
        risk_assessment = self._assess_financial_risk(feature_result["enhanced_data"])
        
        # Fraud detection
        fraud_detection = self._detect_potential_fraud(feature_result["enhanced_data"])
        
        # Regulatory compliance analysis
        compliance_analysis = self._analyze_regulatory_compliance(feature_result["enhanced_data"])
        
        # Generate insights
        insights = self._generate_financial_insights(
            feature_result, sampling_result, risk_assessment, fraud_detection
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        results = {
            "success": True,
            "processing_time": processing_time,
            "pipeline_name": self.pipeline_name,
            "feature_engineering": feature_result,
            "sampling_results": sampling_result,
            "risk_assessment": risk_assessment,
            "fraud_detection": fraud_detection,
            "compliance_analysis": compliance_analysis,
            "insights": insights
        }
        
        self._update_pipeline_state(results)
        
        logger.info(f"Financial pipeline completed in {processing_time:.2f} seconds")
        return results
    
    def validate_input(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Validate financial data input."""
        validation_result = {
            "is_valid": True,
            "issues": [],
            "warnings": []
        }
        
        # Check for numeric columns
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) == 0:
            validation_result["is_valid"] = False
            validation_result["issues"].append("No numeric columns found")
        
        # Check data size
        if len(data) < 1000:
            validation_result["warnings"].append("Small dataset - rare event detection may be limited")
        
        return validation_result
    
    def _extract_rare_event_features(self, data: pd.DataFrame,
                                   target_column: Optional[str],
                                   timestamp_column: Optional[str]) -> Dict[str, Any]:
        """Extract features for rare event detection."""
        if target_column and target_column in data.columns:
            enhanced_data = self.feature_engine.extract_rare_event_features(
                data, target_column, timestamp_column
            )
        else:
            enhanced_data = data.copy()
        
        return {
            "enhanced_data": enhanced_data,
            "original_features": len(data.columns),
            "total_features": len(enhanced_data.columns),
            "features_added": len(enhanced_data.columns) - len(data.columns)
        }
    
    def _apply_rare_event_sampling(self, data: pd.DataFrame,
                                 target_column: Optional[str]) -> Dict[str, Any]:
        """Apply rare event sampling techniques."""
        if not target_column or target_column not in data.columns:
            return {
                "sampling_applied": False,
                "reason": "No target column specified"
            }
        
        X = data.drop(columns=[target_column])
        y = data[target_column]
        
        # Check if rare events exist
        rare_event_ratio = y.sum() / len(y) if y.dtype in [bool, int] else 0
        
        if rare_event_ratio > self.config["rare_event_threshold"]:
            return {
                "sampling_applied": False,
                "reason": f"Rare event ratio ({rare_event_ratio:.3f}) above threshold",
                "original_ratio": rare_event_ratio
            }
        
        # Apply sampling
        X_sampled, y_sampled = self.feature_engine.advanced_rare_event_sampling(
            X, y, self.config["sampling_strategy"]
        )
        
        return {
            "sampling_applied": True,
            "original_shape": data.shape,
            "sampled_shape": (len(X_sampled), len(X_sampled.columns) + 1),
            "original_rare_ratio": rare_event_ratio,
            "sampled_rare_ratio": y_sampled.sum() / len(y_sampled),
            "sampling_strategy": self.config["sampling_strategy"]
        }
    
    def _assess_financial_risk(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Assess financial risk indicators."""
        return {
            "overall_risk_score": 0.3,  # Placeholder
            "risk_factors": ["market_volatility", "concentration_risk"],
            "risk_level": "moderate"
        }
    
    def _detect_potential_fraud(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Detect potential fraudulent activities."""
        return {
            "fraud_alerts": 0,  # Placeholder
            "suspicious_patterns": [],
            "confidence_scores": []
        }
    
    def _analyze_regulatory_compliance(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze regulatory compliance requirements."""
        return {
            "compliance_score": 0.9,  # Placeholder
            "compliance_issues": [],
            "regulatory_flags": []
        }
    
    def _generate_financial_insights(self, feature_result: Dict,
                                   sampling_result: Dict,
                                   risk_assessment: Dict,
                                   fraud_detection: Dict) -> Dict[str, Any]:
        """Generate financial domain insights."""
        return {
            "data_quality": "good" if feature_result["features_added"] > 0 else "basic",
            "sampling_effectiveness": "effective" if sampling_result.get("sampling_applied", False) else "not_needed",
            "risk_level": risk_assessment.get("risk_level", "unknown"),
            "fraud_risk": "low" if fraud_detection.get("fraud_alerts", 0) == 0 else "elevated",
            "recommendations": [
                "Implement real-time monitoring",
                "Enhance feature engineering",
                "Deploy automated alerting"
            ]
        }
    
    def _update_pipeline_state(self, results: Dict):
        """Update pipeline state with processing results."""
        self.pipeline_state.update({
            "last_processed": datetime.now().isoformat(),
            "last_processing_time": results["processing_time"],
            "features_engineered": results["feature_engineering"]["features_added"]
        })


# Pipeline factory for automatic pipeline selection
class PipelineFactory:
    """Factory for creating appropriate pipelines based on data characteristics."""
    
    @staticmethod
    def create_pipeline(data_type: str, **kwargs) -> BasePipeline:
        """Create appropriate pipeline based on data type."""
        if data_type.lower() in ["manufacturing", "industrial", "sensor"]:
            return ManufacturingPipeline()
        elif data_type.lower() in ["ecommerce", "recommendation", "coldstart"]:
            return EcommercePipeline()
        elif data_type.lower() in ["financial", "fraud", "risk"]:
            return FinancialPipeline()
        else:
            raise ValueError(f"Unknown data type: {data_type}")
    
    @staticmethod
    def auto_detect_pipeline(data: pd.DataFrame) -> BasePipeline:
        """Automatically detect appropriate pipeline based on data characteristics."""
        # Simple heuristics for pipeline detection
        column_names = [col.lower() for col in data.columns]
        
        # Check for manufacturing/sensor indicators
        sensor_keywords = ["temperature", "pressure", "vibration", "speed", "flow", "sensor"]
        if any(keyword in " ".join(column_names) for keyword in sensor_keywords):
            return ManufacturingPipeline()
        
        # Check for e-commerce indicators
        ecommerce_keywords = ["user_id", "item_id", "product", "rating", "purchase"]
        if any(keyword in " ".join(column_names) for keyword in ecommerce_keywords):
            return EcommercePipeline()
        
        # Check for financial indicators
        financial_keywords = ["amount", "transaction", "account", "balance", "risk"]
        if any(keyword in " ".join(column_names) for keyword in financial_keywords):
            return FinancialPipeline()
        
        # Default to manufacturing pipeline
        return ManufacturingPipeline()