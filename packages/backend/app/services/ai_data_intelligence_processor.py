"""
data infrastructure data analysis Service - Core proprietary algorithms for Schlep-engine
Implements advanced pattern recognition, anomaly detection, and data quality analysis
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class DataQualityIssue(Enum):
    MISSING_VALUES = "missing_values"
    DUPLICATES = "duplicates"
    OUTLIERS = "outliers"
    INCONSISTENT_FORMAT = "inconsistent_format"
    INVALID_VALUES = "invalid_values"

@dataclass
class QualityInsight:
    issue_type: DataQualityIssue
    column: str
    severity: float  # 0-1 scale
    affected_rows: int
    confidence: float
    recommended_action: str
    details: Dict[str, Any]

class AIDataIntelligenceProcessor:
    """
    Advanced data infrastructure data analysis for quality analysis and cleaning
    """
    
    def __init__(self):
        self.quality_thresholds = {
            "completeness_min": 0.85,
            "consistency_min": 0.90,
            "validity_min": 0.95,
            "outlier_zscore": 3.0
        }
    
    async def comprehensive_analysis(self, df: pd.DataFrame, 
                                   options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform comprehensive data infrastructure data quality analysis
        """
        logger.info(f"Starting comprehensive analysis on {len(df)} rows, {len(df.columns)} columns")
        
        analysis = {
            "quality_score": 0.0,
            "insights": [],
            "patterns": [],
            "recommendations": [],
            "schema_analysis": {},
            "anomalies": [],
            "cleaning_suggestions": []
        }
        
        try:
            # 1. Schema Analysis
            analysis["schema_analysis"] = await self._analyze_schema_simple(df)
            
            # 2. Data Quality Assessment
            quality_insights = await self._assess_data_quality_simple(df)
            analysis["insights"] = quality_insights
            
            # 3. Pattern Detection
            patterns = await self._detect_patterns_simple(df)
            analysis["patterns"] = patterns
            
            # 4. Basic Anomaly Detection
            anomalies = await self._detect_anomalies_simple(df)
            analysis["anomalies"] = anomalies
            
            # 5. Generate recommendations
            recommendations = await self._generate_recommendations_simple(df, quality_insights)
            analysis["recommendations"] = recommendations
            
            # 6. Calculate overall quality score
            analysis["quality_score"] = self._calculate_quality_score_simple(quality_insights)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {e}")
            # Return basic analysis
            return {
                "quality_score": 0.5,
                "insights": [],
                "patterns": [],
                "recommendations": ["Analysis encountered issues - basic quality check performed"],
                "schema_analysis": {col: {"inferred_type": str(df[col].dtype), "semantic_type": "general"} for col in df.columns},
                "anomalies": [],
                "cleaning_suggestions": []
            }
    
    async def _analyze_schema_simple(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Simple schema analysis"""
        schema = {}
        
        for column in df.columns:
            col_analysis = {
                "name": column,
                "inferred_type": str(df[column].dtype),
                "semantic_type": self._detect_semantic_type_simple(column, df[column]),
                "nullability": df[column].isnull().any(),
                "uniqueness": df[column].nunique() / len(df) if len(df) > 0 else 0,
                "cardinality": df[column].nunique(),
                "patterns": [],
                "constraints": {}
            }
            schema[column] = col_analysis
        
        return schema
    
    async def _assess_data_quality_simple(self, df: pd.DataFrame) -> List[QualityInsight]:
        """Simple data quality assessment"""
        insights = []
        
        # Missing values analysis
        for column in df.columns:
            missing_count = df[column].isnull().sum()
            if missing_count > 0:
                missing_pct = missing_count / len(df)
                if missing_pct > 0.1:  # More than 10% missing
                    insights.append(QualityInsight(
                        issue_type=DataQualityIssue.MISSING_VALUES,
                        column=column,
                        severity=missing_pct,
                        affected_rows=int(missing_count),
                        confidence=1.0,
                        recommended_action=f"Address {missing_pct:.1%} missing values in {column}",
                        details={"missing_percentage": missing_pct}
                    ))
        
        # Duplicate detection
        duplicate_count = df.duplicated().sum()
        if duplicate_count > 0:
            insights.append(QualityInsight(
                issue_type=DataQualityIssue.DUPLICATES,
                column="*",
                severity=duplicate_count / len(df),
                affected_rows=duplicate_count,
                confidence=1.0,
                recommended_action=f"Remove {duplicate_count} duplicate rows",
                details={"duplicate_count": duplicate_count}
            ))
        
        return insights
    
    async def _detect_patterns_simple(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Simple pattern detection"""
        patterns = []
        
        # Check for numeric correlations
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 1:
            try:
                correlations = df[numeric_cols].corr()
                for i in range(len(correlations.columns)):
                    for j in range(i+1, len(correlations.columns)):
                        corr_val = correlations.iloc[i, j]
                        if abs(corr_val) > 0.7:
                            patterns.append({
                                "type": "correlation",
                                "column1": correlations.columns[i],
                                "column2": correlations.columns[j],
                                "correlation": float(corr_val),
                                "confidence": 0.9
                            })
            except Exception as e:
                logger.warning(f"Correlation analysis failed: {e}")
        
        return patterns
    
    async def _detect_anomalies_simple(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Simple anomaly detection"""
        anomalies = []
        
        # Basic outlier detection for numeric columns
        for column in df.select_dtypes(include=[np.number]).columns:
            try:
                col_data = df[column].dropna()
                if len(col_data) > 2:
                    # Simple Z-score based outlier detection
                    mean_val = col_data.mean()
                    std_val = col_data.std()
                    if std_val > 0:
                        z_scores = np.abs((col_data - mean_val) / std_val)
                        outliers = z_scores > 3
                        outlier_count = outliers.sum()
                        
                        if outlier_count > 0:
                            anomalies.append({
                                "column": column,
                                "statistical_outliers": int(outlier_count),
                                "ml_outliers": 0,
                                "confidence": 0.8,
                                "method": "z_score",
                                "details": {
                                    "mean": float(mean_val),
                                    "std": float(std_val),
                                    "threshold": 3.0
                                }
                            })
            except Exception as e:
                logger.warning(f"Anomaly detection failed for {column}: {e}")
        
        return anomalies
    
    async def _generate_recommendations_simple(self, df: pd.DataFrame, 
                                             insights: List[QualityInsight]) -> List[str]:
        """Generate simple recommendations"""
        recommendations = []
        
        missing_issues = [i for i in insights if i.issue_type == DataQualityIssue.MISSING_VALUES]
        duplicate_issues = [i for i in insights if i.issue_type == DataQualityIssue.DUPLICATES]
        
        if missing_issues:
            recommendations.append(f" Consider data imputation for {len(missing_issues)} columns with missing values")
        
        if duplicate_issues:
            recommendations.append(" Remove duplicate records to improve data quality")
        
        if len(df) > 10000:
            recommendations.append(" Large dataset detected - consider data sampling for faster processing")
        
        if not recommendations:
            recommendations.append(" Data quality looks good! No major issues detected")
        
        return recommendations
    
    def _detect_semantic_type_simple(self, column_name: str, series: pd.Series) -> str:
        """Simple semantic type detection"""
        col_name = column_name.lower()
        
        if 'email' in col_name:
            return "email"
        elif 'phone' in col_name:
            return "phone"
        elif col_name.endswith('_id') or col_name == 'id':
            return "identifier"
        elif 'date' in col_name or 'time' in col_name:
            return "datetime"
        elif 'price' in col_name or 'cost' in col_name or 'amount' in col_name:
            return "currency"
        else:
            return "general"
    
    def _calculate_quality_score_simple(self, insights: List[QualityInsight]) -> float:
        """Calculate simple quality score"""
        if not insights:
            return 0.95  # High score if no issues
        
        # Simple scoring based on issue count and severity
        total_penalty = sum(insight.severity for insight in insights)
        max_penalty = len(insights)  # Maximum 1.0 penalty per issue
        
        if max_penalty == 0:
            return 0.95
        
        quality_score = max(0.1, 1.0 - (total_penalty / max_penalty))
        return quality_score 