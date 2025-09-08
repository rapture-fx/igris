"""
Twin Analytics Service
======================

Advanced analytics service for digital twins providing:
- Real-time performance analytics and KPI calculations
- Predictive analytics using machine learning models
- Anomaly detection and root cause analysis
- Energy efficiency and sustainability metrics
- Business impact analysis and ROI calculations
- Comparative benchmarking and optimization recommendations
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json

# Machine learning and statistics
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score
from scipy import stats
from scipy.signal import find_peaks
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class AnalyticsType(Enum):
    """Types of analytics available."""
    PERFORMANCE = "performance"
    PREDICTIVE = "predictive"
    ANOMALY = "anomaly"
    ENERGY = "energy"
    QUALITY = "quality"
    MAINTENANCE = "maintenance"
    BUSINESS_IMPACT = "business_impact"
    BENCHMARKING = "benchmarking"


class TimeGranularity(Enum):
    """Time granularity for analytics."""
    REAL_TIME = "real_time"
    MINUTE = "minute"
    HOUR = "hour"
    SHIFT = "shift"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


@dataclass
class AnalyticsRequest:
    """Request configuration for analytics."""
    twin_id: str
    analytics_types: List[AnalyticsType]
    time_range_start: datetime
    time_range_end: datetime
    granularity: TimeGranularity = TimeGranularity.HOUR
    include_predictions: bool = True
    include_recommendations: bool = True
    benchmark_comparison: bool = False


@dataclass
class KPI:
    """Key Performance Indicator definition."""
    name: str
    description: str
    value: float
    unit: str
    target: Optional[float] = None
    threshold_high: Optional[float] = None
    threshold_low: Optional[float] = None
    trend: Optional[str] = None  # 'improving', 'declining', 'stable'
    importance_weight: float = 1.0


@dataclass
class Anomaly:
    """Anomaly detection result."""
    timestamp: datetime
    variable_name: str
    anomaly_score: float
    severity: str  # 'low', 'medium', 'high', 'critical'
    description: str
    root_cause_analysis: Optional[Dict[str, Any]] = None
    recommended_actions: List[str] = field(default_factory=list)


class PerformanceAnalyzer:
    """Analyzes performance metrics and KPIs for digital twins."""
    
    def __init__(self):
        self.kpi_definitions = {}
        self.benchmark_data = {}
        self._initialize_standard_kpis()
    
    def _initialize_standard_kpis(self):
        """Initialize standard manufacturing KPIs."""
        self.kpi_definitions = {
            'oee': KPI(
                name='Overall Equipment Effectiveness',
                description='Product of Availability, Performance, and Quality rates',
                value=0.0,
                unit='%',
                target=85.0,
                threshold_low=70.0,
                importance_weight=1.0
            ),
            'availability': KPI(
                name='Equipment Availability',
                description='Percentage of time equipment is available for production',
                value=0.0,
                unit='%',
                target=90.0,
                threshold_low=85.0,
                importance_weight=0.8
            ),
            'performance_efficiency': KPI(
                name='Performance Efficiency',
                description='Ratio of actual to ideal cycle time',
                value=0.0,
                unit='%',
                target=95.0,
                threshold_low=90.0,
                importance_weight=0.7
            ),
            'quality_rate': KPI(
                name='Quality Rate',
                description='Percentage of good parts produced',
                value=0.0,
                unit='%',
                target=98.0,
                threshold_low=95.0,
                importance_weight=0.9
            ),
            'energy_efficiency': KPI(
                name='Energy Efficiency',
                description='Ratio of theoretical to actual energy consumption',
                value=0.0,
                unit='%',
                target=90.0,
                threshold_low=80.0,
                importance_weight=0.6
            ),
            'throughput': KPI(
                name='Production Throughput',
                description='Units produced per hour',
                value=0.0,
                unit='units/hr',
                target=120.0,
                threshold_low=100.0,
                importance_weight=0.8
            ),
            'cycle_time': KPI(
                name='Average Cycle Time',
                description='Average time per production cycle',
                value=0.0,
                unit='seconds',
                target=60.0,
                threshold_high=70.0,
                importance_weight=0.7
            ),
            'downtime_frequency': KPI(
                name='Unplanned Downtime Frequency',
                description='Number of unplanned stops per shift',
                value=0.0,
                unit='count',
                target=0.0,
                threshold_high=2.0,
                importance_weight=0.9
            )
        }
    
    def calculate_kpis(self, twin_data: Dict[str, Any]) -> Dict[str, KPI]:
        """Calculate KPIs from twin data."""
        try:
            kpis = {}
            
            # Extract data
            sensors = twin_data.get('sensors', {})
            process_data = twin_data.get('process_data', {})
            performance_metrics = twin_data.get('performance_metrics', {})
            
            # OEE calculation
            availability = performance_metrics.get('availability', 0.0)
            performance = performance_metrics.get('performance', 0.0)
            quality = performance_metrics.get('quality', 0.0)
            oee = availability * performance * quality
            
            # Update KPI values
            kpis['oee'] = self._update_kpi('oee', oee * 100)
            kpis['availability'] = self._update_kpi('availability', availability * 100)
            kpis['performance_efficiency'] = self._update_kpi('performance_efficiency', performance * 100)
            kpis['quality_rate'] = self._update_kpi('quality_rate', quality * 100)
            
            # Energy efficiency
            actual_power = sensors.get('power', 100)
            theoretical_power = process_data.get('theoretical_power', actual_power * 0.9)
            energy_efficiency = theoretical_power / actual_power if actual_power > 0 else 0
            kpis['energy_efficiency'] = self._update_kpi('energy_efficiency', energy_efficiency * 100)
            
            # Throughput
            throughput = process_data.get('parts_per_hour', 0)
            kpis['throughput'] = self._update_kpi('throughput', throughput)
            
            # Cycle time
            cycle_time = sensors.get('cycle_time', 60)
            kpis['cycle_time'] = self._update_kpi('cycle_time', cycle_time)
            
            # Downtime frequency (simplified)
            downtime_events = process_data.get('downtime_events_per_shift', 0)
            kpis['downtime_frequency'] = self._update_kpi('downtime_frequency', downtime_events)
            
            return kpis
            
        except Exception as e:
            logger.error(f"KPI calculation failed: {e}")
            return {}
    
    def _update_kpi(self, kpi_name: str, value: float) -> KPI:
        """Update KPI value and calculate trend."""
        if kpi_name in self.kpi_definitions:
            kpi = self.kpi_definitions[kpi_name]
            kpi.value = value
            
            # Determine trend (simplified - would use historical data)
            if kpi.target:
                if abs(value - kpi.target) < 2.0:
                    kpi.trend = 'stable'
                elif value > kpi.target:
                    kpi.trend = 'improving'
                else:
                    kpi.trend = 'declining'
            
            return kpi
        else:
            return KPI(name=kpi_name, description=f"Custom KPI: {kpi_name}", value=value, unit='')
    
    def analyze_performance_trends(self, historical_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance trends from historical data."""
        try:
            if len(historical_data) < 10:
                return {'error': 'Insufficient historical data for trend analysis'}
            
            # Convert to DataFrame for easier analysis
            df = pd.DataFrame(historical_data)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp')
            
            trends = {}
            
            # Analyze key metrics
            metrics_to_analyze = ['oee', 'availability', 'performance', 'quality', 'energy_efficiency']
            
            for metric in metrics_to_analyze:
                if metric in df.columns:
                    values = df[metric].values
                    
                    # Linear regression for trend
                    x = np.arange(len(values))
                    slope, intercept, r_value, p_value, std_err = stats.linregress(x, values)
                    
                    # Classify trend
                    if abs(slope) < 0.001:
                        trend_direction = 'stable'
                    elif slope > 0:
                        trend_direction = 'improving'
                    else:
                        trend_direction = 'declining'
                    
                    # Seasonal analysis (simplified)
                    if len(values) >= 24:  # At least 24 data points
                        seasonal_pattern = self._detect_seasonal_patterns(values)
                    else:
                        seasonal_pattern = 'insufficient_data'
                    
                    trends[metric] = {
                        'trend_direction': trend_direction,
                        'slope': slope,
                        'r_squared': r_value ** 2,
                        'p_value': p_value,
                        'seasonal_pattern': seasonal_pattern,
                        'volatility': np.std(values),
                        'mean_value': np.mean(values),
                        'recent_average': np.mean(values[-5:]) if len(values) >= 5 else np.mean(values)
                    }
            
            return {
                'trends': trends,
                'analysis_period_hours': (df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 3600,
                'data_points_analyzed': len(df),
                'data_quality_score': self._assess_data_quality(df)
            }
            
        except Exception as e:
            logger.error(f"Performance trend analysis failed: {e}")
            return {'error': str(e)}
    
    def _detect_seasonal_patterns(self, values: np.ndarray) -> str:
        """Detect seasonal patterns in time series data."""
        try:
            # Simple autocorrelation analysis
            autocorr = np.correlate(values, values, mode='full')
            autocorr = autocorr[autocorr.size // 2:]
            
            # Look for peaks in autocorrelation
            peaks, _ = find_peaks(autocorr[1:], height=0.3 * np.max(autocorr))
            
            if len(peaks) > 0:
                primary_period = peaks[0] + 1
                if primary_period >= 8 and primary_period <= 12:
                    return 'shift_based'
                elif primary_period >= 20 and primary_period <= 28:
                    return 'daily'
                elif primary_period >= 140 and primary_period <= 180:
                    return 'weekly'
                else:
                    return 'other'
            else:
                return 'none'
        except:
            return 'unknown'
    
    def _assess_data_quality(self, df: pd.DataFrame) -> float:
        """Assess quality of historical data."""
        try:
            # Calculate completeness
            completeness = 1.0 - df.isnull().sum().sum() / (df.shape[0] * df.shape[1])
            
            # Check for duplicates
            uniqueness = 1.0 - df.duplicated().sum() / len(df)
            
            # Check for reasonable value ranges (simplified)
            validity = 0.95  # Would implement proper range checks
            
            # Overall quality score
            quality_score = (completeness * 0.4 + uniqueness * 0.3 + validity * 0.3)
            
            return min(1.0, max(0.0, quality_score))
            
        except:
            return 0.5  # Default quality score


class AnomalyDetector:
    """Detects anomalies in digital twin data using multiple techniques."""
    
    def __init__(self):
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        self.anomaly_history = []
    
    def train_anomaly_detector(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train anomaly detection models."""
        try:
            if len(training_data) < 50:
                return {'success': False, 'error': 'Insufficient training data (minimum 50 samples)'}
            
            # Convert to DataFrame and prepare features
            df = pd.DataFrame(training_data)
            
            # Select numeric features
            numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
            if 'timestamp' in numeric_columns:
                numeric_columns.remove('timestamp')
            
            if len(numeric_columns) < 2:
                return {'success': False, 'error': 'Insufficient numeric features for anomaly detection'}
            
            X = df[numeric_columns]
            self.feature_names = numeric_columns
            
            # Handle missing values
            X = X.fillna(X.mean())
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Train isolation forest
            self.isolation_forest.fit(X_scaled)
            self.is_trained = True
            
            # Calculate baseline statistics
            baseline_stats = {
                feature: {
                    'mean': float(X[feature].mean()),
                    'std': float(X[feature].std()),
                    'min': float(X[feature].min()),
                    'max': float(X[feature].max()),
                    'percentile_95': float(X[feature].quantile(0.95)),
                    'percentile_5': float(X[feature].quantile(0.05))
                }
                for feature in self.feature_names
            }
            
            return {
                'success': True,
                'training_samples': len(X),
                'features_used': self.feature_names,
                'baseline_statistics': baseline_stats
            }
            
        except Exception as e:
            logger.error(f"Anomaly detector training failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def detect_anomalies(self, current_data: Dict[str, Any]) -> List[Anomaly]:
        """Detect anomalies in current data."""
        if not self.is_trained:
            return []
        
        try:
            anomalies = []
            
            # Prepare data
            feature_values = {}
            for feature in self.feature_names:
                if feature in current_data:
                    feature_values[feature] = current_data[feature]
                else:
                    feature_values[feature] = 0.0  # Default value
            
            # Create feature vector
            X = np.array([list(feature_values.values())]).reshape(1, -1)
            X_scaled = self.scaler.transform(X)
            
            # Isolation Forest anomaly detection
            anomaly_score = self.isolation_forest.decision_function(X_scaled)[0]
            is_anomaly = self.isolation_forest.predict(X_scaled)[0] == -1
            
            if is_anomaly:
                # Determine severity based on anomaly score
                if anomaly_score < -0.3:
                    severity = 'critical'
                elif anomaly_score < -0.2:
                    severity = 'high'
                elif anomaly_score < -0.1:
                    severity = 'medium'
                else:
                    severity = 'low'
                
                # Root cause analysis
                root_cause = self._analyze_root_cause(feature_values, X_scaled[0])
                
                anomaly = Anomaly(
                    timestamp=datetime.utcnow(),
                    variable_name='multivariate',
                    anomaly_score=float(-anomaly_score),  # Convert to positive
                    severity=severity,
                    description=f'Multivariate anomaly detected with score {-anomaly_score:.3f}',
                    root_cause_analysis=root_cause,
                    recommended_actions=self._generate_anomaly_actions(root_cause, severity)
                )
                
                anomalies.append(anomaly)
            
            # Statistical anomaly detection for individual features
            for feature, value in feature_values.items():
                stat_anomaly = self._detect_statistical_anomaly(feature, value)
                if stat_anomaly:
                    anomalies.append(stat_anomaly)
            
            # Update anomaly history
            self.anomaly_history.extend(anomalies)
            # Keep only last 1000 anomalies
            if len(self.anomaly_history) > 1000:
                self.anomaly_history = self.anomaly_history[-1000:]
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Anomaly detection failed: {e}")
            return []
    
    def _detect_statistical_anomaly(self, feature_name: str, value: float) -> Optional[Anomaly]:
        """Detect statistical anomalies using z-score and IQR methods."""
        try:
            # This would use historical statistics in a real implementation
            # For now, using simplified thresholds
            
            # Define normal ranges for common features (simplified)
            normal_ranges = {
                'temperature': (60, 90),
                'pressure': (10, 20),
                'vibration': (0, 5),
                'power': (50, 150),
                'flow_rate': (80, 120),
                'speed': (1700, 1900)
            }
            
            for pattern, (min_val, max_val) in normal_ranges.items():
                if pattern in feature_name.lower():
                    if value < min_val or value > max_val:
                        severity = 'high' if (value < min_val * 0.8 or value > max_val * 1.2) else 'medium'
                        
                        return Anomaly(
                            timestamp=datetime.utcnow(),
                            variable_name=feature_name,
                            anomaly_score=abs(value - (min_val + max_val) / 2) / ((max_val - min_val) / 2),
                            severity=severity,
                            description=f'{feature_name} value {value} outside normal range [{min_val}, {max_val}]',
                            recommended_actions=[f'Check {feature_name} sensor calibration', f'Inspect {feature_name.split("_")[0]} component']
                        )
            
            return None
            
        except Exception as e:
            logger.error(f"Statistical anomaly detection failed for {feature_name}: {e}")
            return None
    
    def _analyze_root_cause(self, feature_values: Dict[str, float], scaled_features: np.ndarray) -> Dict[str, Any]:
        """Perform root cause analysis for detected anomaly."""
        try:
            # Calculate feature contributions to anomaly
            feature_contributions = {}
            
            for i, (feature, value) in enumerate(feature_values.items()):
                # Contribution based on deviation from mean (simplified)
                scaled_value = scaled_features[i]
                contribution_score = abs(scaled_value)
                feature_contributions[feature] = {
                    'value': value,
                    'scaled_value': float(scaled_value),
                    'contribution_score': float(contribution_score),
                    'deviation_magnitude': 'high' if abs(scaled_value) > 2 else 'medium' if abs(scaled_value) > 1 else 'low'
                }
            
            # Sort by contribution
            sorted_contributions = dict(sorted(
                feature_contributions.items(),
                key=lambda x: x[1]['contribution_score'],
                reverse=True
            ))
            
            # Identify primary contributors
            primary_contributors = list(sorted_contributions.keys())[:3]
            
            return {
                'feature_contributions': sorted_contributions,
                'primary_contributors': primary_contributors,
                'analysis_confidence': 0.7  # Would be more sophisticated in real implementation
            }
            
        except Exception as e:
            logger.error(f"Root cause analysis failed: {e}")
            return {'error': str(e)}
    
    def _generate_anomaly_actions(self, root_cause: Dict[str, Any], severity: str) -> List[str]:
        """Generate recommended actions based on anomaly analysis."""
        actions = []
        
        if severity in ['critical', 'high']:
            actions.append('Immediate inspection required')
            actions.append('Consider stopping operation if safety is at risk')
        
        primary_contributors = root_cause.get('primary_contributors', [])
        
        for contributor in primary_contributors[:2]:  # Top 2 contributors
            if 'temperature' in contributor.lower():
                actions.append(f'Check cooling system and thermal management for {contributor}')
            elif 'vibration' in contributor.lower():
                actions.append(f'Inspect mechanical components for {contributor}')
            elif 'pressure' in contributor.lower():
                actions.append(f'Verify hydraulic/pneumatic systems for {contributor}')
            elif 'power' in contributor.lower():
                actions.append(f'Check electrical systems and motor health for {contributor}')
            else:
                actions.append(f'Investigate {contributor} sensor and associated systems')
        
        actions.append('Update maintenance schedule based on findings')
        actions.append('Monitor closely for trend development')
        
        return actions[:5]  # Limit to top 5 actions
    
    def get_anomaly_statistics(self) -> Dict[str, Any]:
        """Get statistics about detected anomalies."""
        if not self.anomaly_history:
            return {'total_anomalies': 0}
        
        # Count by severity
        severity_counts = {}
        for anomaly in self.anomaly_history:
            severity = anomaly.severity
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Recent anomaly rate
        recent_anomalies = [
            a for a in self.anomaly_history
            if (datetime.utcnow() - a.timestamp).total_seconds() < 86400  # Last 24 hours
        ]
        
        return {
            'total_anomalies': len(self.anomaly_history),
            'severity_distribution': severity_counts,
            'recent_24h_count': len(recent_anomalies),
            'anomaly_rate_per_hour': len(recent_anomalies) / 24,
            'most_common_variables': self._get_most_common_anomaly_variables(),
            'average_severity_score': np.mean([a.anomaly_score for a in self.anomaly_history])
        }
    
    def _get_most_common_anomaly_variables(self) -> List[Tuple[str, int]]:
        """Get most common variables that trigger anomalies."""
        variable_counts = {}
        for anomaly in self.anomaly_history:
            var = anomaly.variable_name
            variable_counts[var] = variable_counts.get(var, 0) + 1
        
        return sorted(variable_counts.items(), key=lambda x: x[1], reverse=True)[:5]


class EnergyAnalyzer:
    """Analyzes energy consumption and efficiency metrics."""
    
    def __init__(self):
        self.baseline_consumption = {}
        self.efficiency_targets = {}
    
    def analyze_energy_performance(self, twin_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze energy performance and efficiency."""
        try:
            sensors = twin_data.get('sensors', {})
            process_data = twin_data.get('process_data', {})
            
            # Current energy metrics
            current_power = sensors.get('power', 0)  # kW
            voltage = sensors.get('voltage', 380)  # V
            current = sensors.get('current', 0)  # A
            power_factor = sensors.get('power_factor', 0.85)
            
            # Production metrics
            throughput = process_data.get('parts_per_hour', 0)
            cycle_time = sensors.get('cycle_time', 60)  # seconds
            
            # Energy efficiency calculations
            specific_energy = current_power / max(1, throughput)  # kWh per unit
            
            # Theoretical minimum energy
            theoretical_energy = self._calculate_theoretical_energy(process_data)
            energy_efficiency = theoretical_energy / current_power if current_power > 0 else 0
            
            # Peak demand analysis
            peak_demand_ratio = current_power / sensors.get('peak_power_capacity', current_power * 1.2)
            
            # Energy quality metrics
            power_quality_score = self._assess_power_quality(voltage, current, power_factor)
            
            # Cost analysis
            energy_cost_per_hour = current_power * process_data.get('electricity_rate', 0.12)  # $/kWh
            
            # Sustainability metrics
            carbon_intensity = current_power * process_data.get('carbon_factor', 0.5)  # kg CO2/kWh
            
            return {
                'current_power_kw': current_power,
                'specific_energy_kwh_per_unit': specific_energy,
                'energy_efficiency_percent': energy_efficiency * 100,
                'peak_demand_utilization_percent': peak_demand_ratio * 100,
                'power_quality_score': power_quality_score,
                'energy_cost_per_hour': energy_cost_per_hour,
                'carbon_intensity_kg_co2_per_hour': carbon_intensity,
                'efficiency_opportunities': self._identify_efficiency_opportunities(
                    current_power, theoretical_energy, throughput
                ),
                'energy_grade': self._calculate_energy_grade(energy_efficiency)
            }
            
        except Exception as e:
            logger.error(f"Energy analysis failed: {e}")
            return {'error': str(e)}
    
    def _calculate_theoretical_energy(self, process_data: Dict[str, Any]) -> float:
        """Calculate theoretical minimum energy consumption."""
        # Simplified calculation - would be more sophisticated in practice
        base_energy = process_data.get('process_energy_requirement', 50)  # kW
        efficiency_factor = process_data.get('theoretical_efficiency', 0.9)
        
        return base_energy * efficiency_factor
    
    def _assess_power_quality(self, voltage: float, current: float, power_factor: float) -> float:
        """Assess electrical power quality."""
        # Voltage quality (assuming 380V nominal)
        voltage_quality = 1.0 - abs(voltage - 380) / 380 * 2  # Penalize deviations
        voltage_quality = max(0.0, min(1.0, voltage_quality))
        
        # Power factor quality
        pf_quality = power_factor
        
        # Overall power quality
        power_quality = (voltage_quality * 0.4 + pf_quality * 0.6)
        
        return max(0.0, min(1.0, power_quality))
    
    def _identify_efficiency_opportunities(
        self,
        current_power: float,
        theoretical_power: float,
        throughput: float
    ) -> List[Dict[str, Any]]:
        """Identify energy efficiency improvement opportunities."""
        opportunities = []
        
        # Power efficiency opportunity
        efficiency = theoretical_power / current_power if current_power > 0 else 1.0
        
        if efficiency < 0.8:
            potential_savings = (current_power - theoretical_power) * 0.7  # 70% achievable
            opportunities.append({
                'opportunity': 'Power System Optimization',
                'potential_savings_kw': potential_savings,
                'potential_savings_percent': (potential_savings / current_power) * 100,
                'implementation_difficulty': 'medium',
                'payback_period_months': 8,
                'description': 'Optimize motor drives and control systems'
            })
        
        # Load balancing opportunity
        if throughput > 0:
            specific_energy = current_power / throughput
            if specific_energy > 0.5:  # Threshold for high specific energy
                opportunities.append({
                    'opportunity': 'Production Load Balancing',
                    'potential_savings_kw': current_power * 0.1,
                    'potential_savings_percent': 10.0,
                    'implementation_difficulty': 'low',
                    'payback_period_months': 4,
                    'description': 'Balance production load to optimize energy usage'
                })
        
        return opportunities
    
    def _calculate_energy_grade(self, efficiency: float) -> str:
        """Calculate energy efficiency grade."""
        if efficiency >= 0.95:
            return 'A+'
        elif efficiency >= 0.90:
            return 'A'
        elif efficiency >= 0.85:
            return 'B'
        elif efficiency >= 0.80:
            return 'C'
        elif efficiency >= 0.70:
            return 'D'
        else:
            return 'F'


class BusinessImpactAnalyzer:
    """Analyzes business impact and ROI of digital twin insights."""
    
    def __init__(self):
        self.cost_models = {}
        self.financial_parameters = {}
    
    def calculate_business_impact(
        self,
        performance_improvements: Dict[str, float],
        operational_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate business impact of performance improvements."""
        try:
            # Extract operational context
            production_rate = operational_context.get('production_rate_units_per_hour', 100)
            operating_hours_per_year = operational_context.get('operating_hours_per_year', 8760)
            unit_revenue = operational_context.get('unit_revenue', 50)
            labor_cost_per_hour = operational_context.get('labor_cost_per_hour', 65)
            energy_cost_per_kwh = operational_context.get('energy_cost_per_kwh', 0.12)
            maintenance_cost_per_year = operational_context.get('maintenance_cost_per_year', 100000)
            
            # Calculate impact for each improvement
            impact_analysis = {}
            
            # OEE improvement impact
            oee_improvement = performance_improvements.get('oee_improvement_percent', 0) / 100
            if oee_improvement > 0:
                additional_production = production_rate * operating_hours_per_year * oee_improvement
                additional_revenue = additional_production * unit_revenue
                
                impact_analysis['oee_improvement'] = {
                    'additional_units_per_year': additional_production,
                    'additional_revenue_per_year': additional_revenue,
                    'impact_category': 'revenue_increase'
                }
            
            # Energy efficiency improvement impact
            energy_improvement = performance_improvements.get('energy_efficiency_improvement_percent', 0) / 100
            if energy_improvement > 0:
                current_energy_consumption = operational_context.get('current_energy_consumption_kwh_per_year', 500000)
                energy_savings = current_energy_consumption * energy_improvement
                cost_savings = energy_savings * energy_cost_per_kwh
                carbon_reduction = energy_savings * operational_context.get('carbon_factor_kg_per_kwh', 0.5)
                
                impact_analysis['energy_efficiency'] = {
                    'energy_savings_kwh_per_year': energy_savings,
                    'cost_savings_per_year': cost_savings,
                    'carbon_reduction_kg_per_year': carbon_reduction,
                    'impact_category': 'cost_reduction'
                }
            
            # Maintenance cost reduction impact
            maintenance_improvement = performance_improvements.get('maintenance_cost_reduction_percent', 0) / 100
            if maintenance_improvement > 0:
                maintenance_savings = maintenance_cost_per_year * maintenance_improvement
                
                impact_analysis['maintenance_optimization'] = {
                    'cost_savings_per_year': maintenance_savings,
                    'reduced_downtime_hours': operational_context.get('downtime_reduction_hours', 0),
                    'impact_category': 'cost_reduction'
                }
            
            # Quality improvement impact
            quality_improvement = performance_improvements.get('quality_improvement_percent', 0) / 100
            if quality_improvement > 0:
                current_quality_rate = operational_context.get('current_quality_rate', 0.95)
                total_production = production_rate * operating_hours_per_year
                additional_good_parts = total_production * quality_improvement
                quality_revenue_impact = additional_good_parts * unit_revenue
                
                impact_analysis['quality_improvement'] = {
                    'additional_good_parts_per_year': additional_good_parts,
                    'revenue_impact_per_year': quality_revenue_impact,
                    'rework_cost_savings': additional_good_parts * operational_context.get('rework_cost_per_unit', 10),
                    'impact_category': 'revenue_increase'
                }
            
            # Calculate totals
            total_revenue_increase = sum(
                analysis.get('additional_revenue_per_year', 0) + analysis.get('revenue_impact_per_year', 0)
                for analysis in impact_analysis.values()
            )
            
            total_cost_savings = sum(
                analysis.get('cost_savings_per_year', 0) + analysis.get('rework_cost_savings', 0)
                for analysis in impact_analysis.values()
            )
            
            total_annual_benefit = total_revenue_increase + total_cost_savings
            
            # Calculate ROI metrics
            implementation_cost = operational_context.get('digital_twin_implementation_cost', 150000)
            annual_operating_cost = operational_context.get('digital_twin_annual_cost', 25000)
            
            net_annual_benefit = total_annual_benefit - annual_operating_cost
            payback_period_years = implementation_cost / net_annual_benefit if net_annual_benefit > 0 else float('inf')
            
            # 5-year NPV calculation
            discount_rate = operational_context.get('discount_rate', 0.08)
            npv_5_year = self._calculate_npv(
                implementation_cost, net_annual_benefit, discount_rate, 5
            )
            
            roi_5_year = (npv_5_year / implementation_cost) * 100 if implementation_cost > 0 else 0
            
            return {
                'impact_analysis': impact_analysis,
                'financial_summary': {
                    'total_annual_revenue_increase': total_revenue_increase,
                    'total_annual_cost_savings': total_cost_savings,
                    'total_annual_benefit': total_annual_benefit,
                    'net_annual_benefit': net_annual_benefit,
                    'implementation_cost': implementation_cost,
                    'annual_operating_cost': annual_operating_cost,
                    'payback_period_years': payback_period_years,
                    'npv_5_year': npv_5_year,
                    'roi_5_year_percent': roi_5_year
                },
                'business_case_strength': self._assess_business_case_strength(roi_5_year, payback_period_years)
            }
            
        except Exception as e:
            logger.error(f"Business impact calculation failed: {e}")
            return {'error': str(e)}
    
    def _calculate_npv(self, initial_cost: float, annual_benefit: float, discount_rate: float, years: int) -> float:
        """Calculate Net Present Value."""
        npv = -initial_cost
        for year in range(1, years + 1):
            npv += annual_benefit / ((1 + discount_rate) ** year)
        return npv
    
    def _assess_business_case_strength(self, roi_percent: float, payback_years: float) -> str:
        """Assess the strength of the business case."""
        if roi_percent >= 200 and payback_years <= 1.5:
            return 'Very Strong'
        elif roi_percent >= 100 and payback_years <= 2.5:
            return 'Strong'
        elif roi_percent >= 50 and payback_years <= 4.0:
            return 'Moderate'
        elif roi_percent >= 20 and payback_years <= 6.0:
            return 'Weak'
        else:
            return 'Poor'


class TwinAnalyticsService:
    """Main analytics service coordinating all analytics components."""
    
    def __init__(self):
        self.performance_analyzer = PerformanceAnalyzer()
        self.anomaly_detector = AnomalyDetector()
        self.energy_analyzer = EnergyAnalyzer()
        self.business_analyzer = BusinessImpactAnalyzer()
        
        # Analytics cache
        self.analytics_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl_seconds = 300  # 5 minutes
        
        # Service metrics
        self.service_metrics = {
            'analytics_requests': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'anomalies_detected': 0,
            'service_started': datetime.utcnow()
        }
        
        logger.info("Twin Analytics Service initialized")
    
    async def run_comprehensive_analytics(
        self,
        request: AnalyticsRequest,
        twin_data: Dict[str, Any],
        historical_data: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Run comprehensive analytics based on request configuration."""
        try:
            self.service_metrics['analytics_requests'] += 1
            
            # Check cache first
            cache_key = self._generate_cache_key(request)
            cached_result = self._get_cached_result(cache_key)
            if cached_result:
                self.service_metrics['cache_hits'] += 1
                return cached_result
            
            self.service_metrics['cache_misses'] += 1
            
            analytics_results = {
                'twin_id': request.twin_id,
                'analysis_timestamp': datetime.utcnow(),
                'time_range': {
                    'start': request.time_range_start,
                    'end': request.time_range_end,
                    'granularity': request.granularity.value
                },
                'analytics_types': [t.value for t in request.analytics_types],
                'results': {}
            }
            
            # Performance Analytics
            if AnalyticsType.PERFORMANCE in request.analytics_types:
                performance_results = await self._run_performance_analytics(
                    twin_data, historical_data
                )
                analytics_results['results']['performance'] = performance_results
            
            # Anomaly Detection
            if AnalyticsType.ANOMALY in request.analytics_types:
                anomaly_results = await self._run_anomaly_analytics(
                    twin_data, historical_data
                )
                analytics_results['results']['anomaly'] = anomaly_results
            
            # Energy Analytics
            if AnalyticsType.ENERGY in request.analytics_types:
                energy_results = await self._run_energy_analytics(twin_data)
                analytics_results['results']['energy'] = energy_results
            
            # Business Impact Analytics
            if AnalyticsType.BUSINESS_IMPACT in request.analytics_types:
                business_results = await self._run_business_impact_analytics(
                    analytics_results['results'], twin_data
                )
                analytics_results['results']['business_impact'] = business_results
            
            # Predictive Analytics
            if request.include_predictions and AnalyticsType.PREDICTIVE in request.analytics_types:
                predictive_results = await self._run_predictive_analytics(
                    twin_data, historical_data
                )
                analytics_results['results']['predictive'] = predictive_results
            
            # Generate Recommendations
            if request.include_recommendations:
                recommendations = await self._generate_comprehensive_recommendations(
                    analytics_results['results']
                )
                analytics_results['recommendations'] = recommendations
            
            # Benchmarking
            if request.benchmark_comparison:
                benchmark_results = await self._run_benchmark_comparison(
                    analytics_results['results']
                )
                analytics_results['benchmarking'] = benchmark_results
            
            # Cache results
            self._cache_result(cache_key, analytics_results)
            
            return analytics_results
            
        except Exception as e:
            logger.error(f"Comprehensive analytics failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'twin_id': request.twin_id
            }
    
    async def _run_performance_analytics(
        self,
        twin_data: Dict[str, Any],
        historical_data: Optional[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Run performance analytics."""
        try:
            # Current KPIs
            current_kpis = self.performance_analyzer.calculate_kpis(twin_data)
            
            # Trend analysis if historical data available
            trend_analysis = {}
            if historical_data and len(historical_data) >= 10:
                trend_analysis = self.performance_analyzer.analyze_performance_trends(historical_data)
            
            # Performance scoring
            performance_score = self._calculate_overall_performance_score(current_kpis)
            
            return {
                'current_kpis': {name: {
                    'value': kpi.value,
                    'unit': kpi.unit,
                    'target': kpi.target,
                    'trend': kpi.trend,
                    'status': self._get_kpi_status(kpi)
                } for name, kpi in current_kpis.items()},
                'trend_analysis': trend_analysis,
                'overall_performance_score': performance_score,
                'performance_grade': self._get_performance_grade(performance_score)
            }
            
        except Exception as e:
            logger.error(f"Performance analytics failed: {e}")
            return {'error': str(e)}
    
    async def _run_anomaly_analytics(
        self,
        twin_data: Dict[str, Any],
        historical_data: Optional[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Run anomaly detection analytics."""
        try:
            # Train detector if historical data is available and not yet trained
            if not self.anomaly_detector.is_trained and historical_data:
                training_result = self.anomaly_detector.train_anomaly_detector(historical_data)
                if not training_result.get('success'):
                    return {'error': 'Failed to train anomaly detector', 'details': training_result}
            
            # Detect anomalies in current data
            anomalies = self.anomaly_detector.detect_anomalies(twin_data)
            self.service_metrics['anomalies_detected'] += len(anomalies)
            
            # Get anomaly statistics
            anomaly_stats = self.anomaly_detector.get_anomaly_statistics()
            
            return {
                'current_anomalies': [
                    {
                        'timestamp': a.timestamp,
                        'variable': a.variable_name,
                        'severity': a.severity,
                        'score': a.anomaly_score,
                        'description': a.description,
                        'recommended_actions': a.recommended_actions
                    }
                    for a in anomalies
                ],
                'anomaly_statistics': anomaly_stats,
                'detector_status': {
                    'is_trained': self.anomaly_detector.is_trained,
                    'features_monitored': len(self.anomaly_detector.feature_names)
                }
            }
            
        except Exception as e:
            logger.error(f"Anomaly analytics failed: {e}")
            return {'error': str(e)}
    
    async def _run_energy_analytics(self, twin_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run energy efficiency analytics."""
        try:
            energy_analysis = self.energy_analyzer.analyze_energy_performance(twin_data)
            return energy_analysis
            
        except Exception as e:
            logger.error(f"Energy analytics failed: {e}")
            return {'error': str(e)}
    
    async def _run_business_impact_analytics(
        self,
        analytics_results: Dict[str, Any],
        twin_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run business impact analytics."""
        try:
            # Extract performance improvements from other analytics
            performance_improvements = {}
            
            if 'performance' in analytics_results:
                perf_data = analytics_results['performance']
                current_kpis = perf_data.get('current_kpis', {})
                
                # Calculate improvement potential
                oee = current_kpis.get('oee', {}).get('value', 0)
                oee_target = current_kpis.get('oee', {}).get('target', 85)
                if oee < oee_target:
                    performance_improvements['oee_improvement_percent'] = oee_target - oee
            
            if 'energy' in analytics_results:
                energy_data = analytics_results['energy']
                current_efficiency = energy_data.get('energy_efficiency_percent', 0)
                if current_efficiency < 90:
                    performance_improvements['energy_efficiency_improvement_percent'] = 90 - current_efficiency
            
            # Operational context (would come from configuration in real implementation)
            operational_context = twin_data.get('operational_context', {
                'production_rate_units_per_hour': 120,
                'operating_hours_per_year': 8760,
                'unit_revenue': 45,
                'energy_cost_per_kwh': 0.12,
                'maintenance_cost_per_year': 80000,
                'digital_twin_implementation_cost': 150000
            })
            
            business_impact = self.business_analyzer.calculate_business_impact(
                performance_improvements, operational_context
            )
            
            return business_impact
            
        except Exception as e:
            logger.error(f"Business impact analytics failed: {e}")
            return {'error': str(e)}
    
    async def _run_predictive_analytics(
        self,
        twin_data: Dict[str, Any],
        historical_data: Optional[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Run predictive analytics."""
        try:
            if not historical_data or len(historical_data) < 20:
                return {'error': 'Insufficient historical data for predictions'}
            
            # Convert to DataFrame
            df = pd.DataFrame(historical_data)
            
            # Simple trend-based predictions (would be more sophisticated in practice)
            predictions = {}
            
            # OEE prediction
            if 'oee' in df.columns:
                oee_values = df['oee'].values[-10:]  # Last 10 values
                oee_trend = np.polyfit(range(len(oee_values)), oee_values, 1)[0]
                oee_prediction_24h = oee_values[-1] + oee_trend * 24
                
                predictions['oee_24h'] = {
                    'predicted_value': float(max(0, min(100, oee_prediction_24h))),
                    'trend_direction': 'increasing' if oee_trend > 0 else 'decreasing',
                    'confidence': 0.7
                }
            
            # Energy consumption prediction
            if 'power' in df.columns:
                power_values = df['power'].values[-10:]
                power_trend = np.polyfit(range(len(power_values)), power_values, 1)[0]
                power_prediction_24h = power_values[-1] + power_trend * 24
                
                predictions['power_consumption_24h'] = {
                    'predicted_value': float(max(0, power_prediction_24h)),
                    'trend_direction': 'increasing' if power_trend > 0 else 'decreasing',
                    'confidence': 0.6
                }
            
            # Maintenance prediction (simplified)
            current_health = twin_data.get('health_indicators', {}).get('overall_health', 1.0)
            if current_health < 0.8:
                maintenance_urgency = 'high' if current_health < 0.5 else 'medium'
                estimated_time_to_maintenance = max(1, (current_health - 0.3) * 168)  # hours
            else:
                maintenance_urgency = 'low'
                estimated_time_to_maintenance = 168  # 1 week
            
            predictions['maintenance'] = {
                'urgency': maintenance_urgency,
                'estimated_time_to_maintenance_hours': estimated_time_to_maintenance,
                'confidence': 0.8
            }
            
            return {
                'predictions': predictions,
                'prediction_horizon_hours': 24,
                'model_confidence': 0.7
            }
            
        except Exception as e:
            logger.error(f"Predictive analytics failed: {e}")
            return {'error': str(e)}
    
    async def _generate_comprehensive_recommendations(
        self,
        analytics_results: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate comprehensive recommendations based on all analytics."""
        recommendations = []
        
        try:
            # Performance-based recommendations
            if 'performance' in analytics_results:
                perf_data = analytics_results['performance']
                current_kpis = perf_data.get('current_kpis', {})
                
                for kpi_name, kpi_data in current_kpis.items():
                    if kpi_data.get('status') == 'below_target':
                        recommendations.append({
                            'category': 'performance',
                            'priority': 'high',
                            'title': f'Improve {kpi_name.replace("_", " ").title()}',
                            'description': f'Current {kpi_name} is {kpi_data["value"]:.1f}{kpi_data["unit"]}, target is {kpi_data.get("target", "not set")}',
                            'estimated_impact': 'Medium to High',
                            'implementation_effort': 'Medium'
                        })
            
            # Energy-based recommendations
            if 'energy' in analytics_results:
                energy_data = analytics_results['energy']
                efficiency_opportunities = energy_data.get('efficiency_opportunities', [])
                
                for opportunity in efficiency_opportunities:
                    recommendations.append({
                        'category': 'energy',
                        'priority': 'medium',
                        'title': opportunity['opportunity'],
                        'description': opportunity['description'],
                        'estimated_impact': f"{opportunity['potential_savings_percent']:.1f}% energy savings",
                        'implementation_effort': opportunity['implementation_difficulty'].title(),
                        'payback_period_months': opportunity['payback_period_months']
                    })
            
            # Anomaly-based recommendations
            if 'anomaly' in analytics_results:
                anomaly_data = analytics_results['anomaly']
                current_anomalies = anomaly_data.get('current_anomalies', [])
                
                for anomaly in current_anomalies:
                    if anomaly['severity'] in ['high', 'critical']:
                        recommendations.append({
                            'category': 'maintenance',
                            'priority': 'critical' if anomaly['severity'] == 'critical' else 'high',
                            'title': f'Address {anomaly["variable"]} Anomaly',
                            'description': anomaly['description'],
                            'estimated_impact': 'Prevent potential downtime',
                            'implementation_effort': 'Low',
                            'recommended_actions': anomaly['recommended_actions']
                        })
            
            # Sort by priority
            priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
            recommendations.sort(key=lambda x: priority_order.get(x['priority'], 3))
            
            return recommendations[:10]  # Limit to top 10 recommendations
            
        except Exception as e:
            logger.error(f"Recommendation generation failed: {e}")
            return []
    
    async def _run_benchmark_comparison(self, analytics_results: Dict[str, Any]) -> Dict[str, Any]:
        """Run benchmark comparison against industry standards."""
        try:
            # Industry benchmarks (would come from database in real implementation)
            industry_benchmarks = {
                'oee': {'excellent': 85, 'good': 75, 'fair': 65},
                'availability': {'excellent': 95, 'good': 90, 'fair': 85},
                'energy_efficiency': {'excellent': 90, 'good': 80, 'fair': 70}
            }
            
            benchmark_results = {}
            
            if 'performance' in analytics_results:
                current_kpis = analytics_results['performance'].get('current_kpis', {})
                
                for kpi_name, kpi_data in current_kpis.items():
                    if kpi_name in industry_benchmarks:
                        benchmarks = industry_benchmarks[kpi_name]
                        current_value = kpi_data['value']
                        
                        if current_value >= benchmarks['excellent']:
                            performance_tier = 'excellent'
                        elif current_value >= benchmarks['good']:
                            performance_tier = 'good'
                        elif current_value >= benchmarks['fair']:
                            performance_tier = 'fair'
                        else:
                            performance_tier = 'needs_improvement'
                        
                        benchmark_results[kpi_name] = {
                            'current_value': current_value,
                            'performance_tier': performance_tier,
                            'percentile_estimate': self._estimate_percentile(current_value, benchmarks),
                            'gap_to_excellent': max(0, benchmarks['excellent'] - current_value)
                        }
            
            return {
                'benchmark_comparison': benchmark_results,
                'overall_ranking': self._calculate_overall_ranking(benchmark_results)
            }
            
        except Exception as e:
            logger.error(f"Benchmark comparison failed: {e}")
            return {'error': str(e)}
    
    def _estimate_percentile(self, value: float, benchmarks: Dict[str, float]) -> int:
        """Estimate percentile ranking based on benchmarks."""
        if value >= benchmarks['excellent']:
            return 90 + int((value - benchmarks['excellent']) / benchmarks['excellent'] * 10)
        elif value >= benchmarks['good']:
            return 70 + int((value - benchmarks['good']) / (benchmarks['excellent'] - benchmarks['good']) * 20)
        elif value >= benchmarks['fair']:
            return 40 + int((value - benchmarks['fair']) / (benchmarks['good'] - benchmarks['fair']) * 30)
        else:
            return int(value / benchmarks['fair'] * 40)
    
    def _calculate_overall_ranking(self, benchmark_results: Dict[str, Any]) -> str:
        """Calculate overall performance ranking."""
        if not benchmark_results:
            return 'insufficient_data'
        
        tier_scores = {'excellent': 4, 'good': 3, 'fair': 2, 'needs_improvement': 1}
        total_score = sum(tier_scores.get(result['performance_tier'], 0) for result in benchmark_results.values())
        average_score = total_score / len(benchmark_results)
        
        if average_score >= 3.5:
            return 'top_performer'
        elif average_score >= 2.5:
            return 'above_average'
        elif average_score >= 1.5:
            return 'average'
        else:
            return 'below_average'
    
    def _generate_cache_key(self, request: AnalyticsRequest) -> str:
        """Generate cache key for analytics request."""
        key_parts = [
            request.twin_id,
            '_'.join([t.value for t in request.analytics_types]),
            request.granularity.value,
            str(int(request.time_range_start.timestamp())),
            str(int(request.time_range_end.timestamp()))
        ]
        return '_'.join(key_parts)
    
    def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached analytics result if valid."""
        if cache_key in self.analytics_cache:
            cached_data = self.analytics_cache[cache_key]
            cache_time = cached_data['cached_at']
            
            if (datetime.utcnow() - cache_time).total_seconds() < self.cache_ttl_seconds:
                return cached_data['result']
            else:
                # Remove expired cache entry
                del self.analytics_cache[cache_key]
        
        return None
    
    def _cache_result(self, cache_key: str, result: Dict[str, Any]):
        """Cache analytics result."""
        self.analytics_cache[cache_key] = {
            'result': result,
            'cached_at': datetime.utcnow()
        }
        
        # Limit cache size
        if len(self.analytics_cache) > 100:
            # Remove oldest entries
            oldest_keys = sorted(
                self.analytics_cache.keys(),
                key=lambda k: self.analytics_cache[k]['cached_at']
            )[:20]
            
            for key in oldest_keys:
                del self.analytics_cache[key]
    
    def _calculate_overall_performance_score(self, kpis: Dict[str, KPI]) -> float:
        """Calculate weighted overall performance score."""
        if not kpis:
            return 0.0
        
        weighted_sum = 0.0
        total_weight = 0.0
        
        for kpi in kpis.values():
            if kpi.target:
                # Normalize to 0-1 scale
                score = min(1.0, kpi.value / kpi.target)
                weighted_sum += score * kpi.importance_weight
                total_weight += kpi.importance_weight
        
        return (weighted_sum / total_weight * 100) if total_weight > 0 else 0.0
    
    def _get_performance_grade(self, score: float) -> str:
        """Get performance grade based on score."""
        if score >= 95:
            return 'A+'
        elif score >= 90:
            return 'A'
        elif score >= 85:
            return 'B+'
        elif score >= 80:
            return 'B'
        elif score >= 75:
            return 'C+'
        elif score >= 70:
            return 'C'
        elif score >= 65:
            return 'D'
        else:
            return 'F'
    
    def _get_kpi_status(self, kpi: KPI) -> str:
        """Get KPI status based on value and targets."""
        if kpi.target:
            if kpi.value >= kpi.target:
                return 'meets_target'
            elif kpi.threshold_low and kpi.value >= kpi.threshold_low:
                return 'acceptable'
            else:
                return 'below_target'
        else:
            return 'no_target_set'
    
    def get_service_metrics(self) -> Dict[str, Any]:
        """Get analytics service performance metrics."""
        uptime = (datetime.utcnow() - self.service_metrics['service_started']).total_seconds()
        
        cache_hit_rate = (
            self.service_metrics['cache_hits'] / 
            max(1, self.service_metrics['cache_hits'] + self.service_metrics['cache_misses'])
        ) * 100
        
        return {
            'service_uptime_hours': uptime / 3600,
            'total_analytics_requests': self.service_metrics['analytics_requests'],
            'cache_hit_rate_percent': cache_hit_rate,
            'total_anomalies_detected': self.service_metrics['anomalies_detected'],
            'cached_results_count': len(self.analytics_cache),
            'anomaly_detector_trained': self.anomaly_detector.is_trained,
            'average_request_rate_per_hour': self.service_metrics['analytics_requests'] / max(1, uptime / 3600)
        }