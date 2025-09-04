"""
Manufacturing Time-Series Forecasting Examples
==============================================

Comprehensive examples demonstrating the manufacturing forecasting system
capabilities including equipment failure prediction, production demand forecasting,
quality trend analysis, maintenance optimization, and energy consumption forecasting.

These examples show real-world usage patterns and best practices for implementing
predictive analytics in manufacturing environments.
"""

import asyncio
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging

# Mock imports for demonstration (replace with actual imports in production)
# from app.services.manufacturing_forecasting_service import ManufacturingForecastingService
# from app.ml.manufacturing_forecasting_config import get_config_for_industry, get_config_for_application

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ManufacturingForecastingExamples:
    """
    Comprehensive examples for manufacturing time-series forecasting.
    """
    
    def __init__(self):
        """Initialize with sample manufacturing data and configurations."""
        self.sample_equipment_data = self._generate_sample_equipment_data()
        self.sample_production_data = self._generate_sample_production_data()
        self.sample_quality_data = self._generate_sample_quality_data()
        self.sample_energy_data = self._generate_sample_energy_data()
        
    def _generate_sample_equipment_data(self) -> pd.DataFrame:
        """Generate realistic equipment sensor data."""
        np.random.seed(42)
        
        # 30 days of hourly data
        timestamps = pd.date_range(start='2024-01-01', periods=720, freq='H')
        
        # Equipment degradation pattern
        base_health = 1.0 - (np.arange(720) / 720) * 0.4  # Gradual degradation
        equipment_health = base_health + np.random.normal(0, 0.05, 720)
        equipment_health = np.clip(equipment_health, 0.1, 1.0)
        
        # Temperature with daily cycles and equipment degradation
        daily_temp_cycle = 5 * np.sin(2 * np.pi * np.arange(720) / 24)
        temperature = 75 + daily_temp_cycle + (1 - equipment_health) * 10 + np.random.normal(0, 2, 720)
        
        # Vibration increases as health decreases
        vibration = 0.5 + (1 - equipment_health) * 3 + np.random.normal(0, 0.2, 720)
        vibration = np.clip(vibration, 0, 10)
        
        # Pressure with some random variations
        pressure = 14.7 + np.random.normal(0, 0.3, 720)
        
        # Current consumption related to load and efficiency
        current = 50 + (1 - equipment_health) * 20 + np.random.normal(0, 3, 720)
        current = np.clip(current, 30, 100)
        
        return pd.DataFrame({
            'timestamp': timestamps,
            'equipment_health': equipment_health,
            'temperature': temperature,
            'vibration': vibration,
            'pressure': pressure,
            'current': current
        })
    
    def _generate_sample_production_data(self) -> pd.DataFrame:
        """Generate realistic production demand data."""
        np.random.seed(123)
        
        # 90 days of daily production data
        dates = pd.date_range(start='2024-01-01', periods=90, freq='D')
        
        # Seasonal pattern (quarterly cycle)
        seasonal = 1000 + 200 * np.sin(2 * np.pi * np.arange(90) / 90)
        
        # Weekly pattern (lower on weekends)
        weekly_pattern = np.tile([1.1, 1.2, 1.2, 1.2, 1.1, 0.7, 0.5], 13)[:90]
        
        # Trend (gradual increase)
        trend = np.arange(90) * 2
        
        # Random noise
        noise = np.random.normal(0, 50, 90)
        
        production_output = (seasonal + trend) * weekly_pattern + noise
        production_output = np.clip(production_output, 100, 2000)
        
        # Related metrics
        demand = production_output * np.random.uniform(0.8, 1.2, 90)
        inventory = np.cumsum(production_output - demand) + 5000
        inventory = np.clip(inventory, 1000, 15000)
        
        return pd.DataFrame({
            'date': dates,
            'production_output': production_output,
            'demand': demand,
            'inventory_level': inventory,
            'capacity_utilization': production_output / 1500,  # Assuming 1500 max capacity
        })
    
    def _generate_sample_quality_data(self) -> pd.DataFrame:
        """Generate realistic quality measurement data."""
        np.random.seed(456)
        
        # 14 days of hourly quality data
        timestamps = pd.date_range(start='2024-01-01', periods=336, freq='H')
        
        # Base quality score with process drift
        base_quality = 0.92 - (np.arange(336) / 336) * 0.1  # Gradual quality decline
        
        # Process parameter effects
        temperature_effect = -0.05 * np.abs(np.random.normal(0, 1, 336))
        pressure_effect = -0.03 * np.abs(np.random.normal(0, 1, 336))
        
        quality_score = base_quality + temperature_effect + pressure_effect + np.random.normal(0, 0.02, 336)
        quality_score = np.clip(quality_score, 0.6, 1.0)
        
        # Process parameters
        process_temp = 150 + np.random.normal(0, 5, 336)
        process_pressure = 25 + np.random.normal(0, 2, 336)
        feed_rate = 100 + np.random.normal(0, 10, 336)
        
        # Defect rate inversely related to quality
        defect_rate = (1 - quality_score) * 0.1 + np.random.exponential(0.01, 336)
        defect_rate = np.clip(defect_rate, 0, 0.2)
        
        return pd.DataFrame({
            'timestamp': timestamps,
            'quality_score': quality_score,
            'defect_rate': defect_rate,
            'process_temperature': process_temp,
            'process_pressure': process_pressure,
            'feed_rate': feed_rate
        })
    
    def _generate_sample_energy_data(self) -> pd.DataFrame:
        """Generate realistic energy consumption data."""
        np.random.seed(789)
        
        # 7 days of 15-minute interval data
        timestamps = pd.date_range(start='2024-01-01', periods=672, freq='15T')
        
        # Daily energy pattern (higher during work hours)
        hour_of_day = timestamps.hour + timestamps.minute / 60
        daily_pattern = 100 + 150 * (
            0.3 * np.sin(2 * np.pi * (hour_of_day - 6) / 24) +
            0.7 * np.maximum(0, np.sin(2 * np.pi * (hour_of_day - 6) / 12))
        )
        
        # Weekly pattern (lower on weekends)
        day_of_week = timestamps.dayofweek
        weekly_multiplier = np.where(day_of_week < 5, 1.0, 0.6)  # Weekdays vs weekends
        
        # Production correlation
        production_factor = 0.8 + 0.4 * np.random.random(672)
        
        # Random variations
        noise = np.random.normal(0, 20, 672)
        
        energy_consumption = daily_pattern * weekly_multiplier * production_factor + noise
        energy_consumption = np.clip(energy_consumption, 50, 500)
        
        # Related metrics
        power_factor = 0.85 + np.random.normal(0, 0.05, 672)
        power_factor = np.clip(power_factor, 0.7, 0.95)
        
        ambient_temp = 22 + 8 * np.sin(2 * np.pi * hour_of_day / 24) + np.random.normal(0, 2, 672)
        
        return pd.DataFrame({
            'timestamp': timestamps,
            'energy_consumption': energy_consumption,
            'power_factor': power_factor,
            'ambient_temperature': ambient_temp,
            'production_active': (weekly_multiplier * production_factor > 0.7).astype(int)
        })


class EquipmentFailurePredictionExample:
    """Example: Equipment failure prediction for critical manufacturing equipment."""
    
    def __init__(self, examples: ManufacturingForecastingExamples):
        self.examples = examples
    
    async def run_basic_failure_prediction(self) -> Dict[str, Any]:
        """Basic equipment failure prediction example."""
        logger.info("Running basic equipment failure prediction example...")
        
        # Get sample equipment data
        equipment_data = self.examples.sample_equipment_data
        
        # Mock service call (replace with actual service in production)
        result = await self._mock_failure_prediction(
            equipment_id="PUMP_001",
            sensor_data=equipment_data,
            forecast_horizon_days=7
        )
        
        # Analyze results
        analysis = self._analyze_failure_prediction_results(result)
        
        return {
            'example_type': 'basic_failure_prediction',
            'equipment_id': 'PUMP_001',
            'prediction_result': result,
            'business_analysis': analysis
        }
    
    async def run_multi_equipment_analysis(self) -> Dict[str, Any]:
        """Multi-equipment failure prediction with prioritization."""
        logger.info("Running multi-equipment failure prediction example...")
        
        equipment_list = [
            {'equipment_id': f'PUMP_{i:03d}', 'criticality': 'high' if i <= 3 else 'medium'}
            for i in range(1, 11)
        ]
        
        # Mock batch prediction
        batch_results = {}
        for equipment in equipment_list:
            result = await self._mock_failure_prediction(
                equipment_id=equipment['equipment_id'],
                sensor_data=self.examples.sample_equipment_data,
                forecast_horizon_days=14
            )
            result['criticality'] = equipment['criticality']
            batch_results[equipment['equipment_id']] = result
        
        # Prioritize maintenance actions
        maintenance_priority = self._prioritize_maintenance_actions(batch_results)
        
        return {
            'example_type': 'multi_equipment_analysis',
            'total_equipment': len(equipment_list),
            'batch_results': batch_results,
            'maintenance_priority': maintenance_priority
        }
    
    async def _mock_failure_prediction(
        self, 
        equipment_id: str, 
        sensor_data: pd.DataFrame, 
        forecast_horizon_days: int
    ) -> Dict[str, Any]:
        """Mock failure prediction service call."""
        
        # Simulate prediction logic
        current_health = sensor_data['equipment_health'].iloc[-1]
        health_trend = (sensor_data['equipment_health'].iloc[-7:].mean() - 
                       sensor_data['equipment_health'].iloc[-14:-7].mean())
        
        # Generate failure probabilities
        failure_probs = []
        for day in range(forecast_horizon_days):
            prob = max(0, min(1, (1 - current_health) + (day * 0.02) - (health_trend * 0.5)))
            failure_probs.append(prob)
        
        max_prob = max(failure_probs)
        
        # Determine urgency
        if max_prob > 0.8:
            urgency = 'critical'
        elif max_prob > 0.6:
            urgency = 'high'
        elif max_prob > 0.4:
            urgency = 'medium'
        else:
            urgency = 'low'
        
        return {
            'equipment_id': equipment_id,
            'predictions': failure_probs,
            'failure_probabilities': failure_probs,
            'maintenance_urgency': urgency,
            'days_to_failure': next((i+1 for i, p in enumerate(failure_probs) if p > 0.7), None),
            'cost_analysis': {
                'preventive_cost': 3000 + (max_prob * 2000),
                'estimated_cost_savings': 8000 * max_prob,
                'roi': (8000 * max_prob) / (3000 + max_prob * 2000)
            },
            'recommended_actions': self._get_recommended_actions(urgency)
        }
    
    def _get_recommended_actions(self, urgency: str) -> List[str]:
        """Get recommended actions based on urgency level."""
        actions = {
            'critical': [
                'Schedule immediate inspection',
                'Order replacement parts',
                'Consider equipment shutdown',
                'Notify maintenance supervisor',
                'Prepare backup equipment'
            ],
            'high': [
                'Schedule maintenance within 48 hours',
                'Increase monitoring frequency',
                'Prepare maintenance materials',
                'Check spare parts inventory'
            ],
            'medium': [
                'Plan maintenance within next week',
                'Continue routine monitoring',
                'Review maintenance history'
            ],
            'low': [
                'Continue routine monitoring',
                'Schedule next maintenance per normal cycle'
            ]
        }
        return actions.get(urgency, [])
    
    def _analyze_failure_prediction_results(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze failure prediction results for business insights."""
        max_prob = max(result['failure_probabilities'])
        avg_prob = sum(result['failure_probabilities']) / len(result['failure_probabilities'])
        
        cost_analysis = result['cost_analysis']
        
        return {
            'risk_assessment': {
                'maximum_failure_probability': max_prob,
                'average_failure_probability': avg_prob,
                'risk_trend': 'increasing' if result['failure_probabilities'][-1] > result['failure_probabilities'][0] else 'stable'
            },
            'financial_impact': {
                'preventive_maintenance_cost': cost_analysis['preventive_cost'],
                'potential_cost_savings': cost_analysis['estimated_cost_savings'],
                'return_on_investment': cost_analysis['roi']
            },
            'operational_impact': {
                'maintenance_urgency': result['maintenance_urgency'],
                'recommended_timeline': result['days_to_failure'],
                'business_continuity_risk': 'high' if max_prob > 0.7 else 'medium' if max_prob > 0.5 else 'low'
            }
        }
    
    def _prioritize_maintenance_actions(self, batch_results: Dict[str, Any]) -> Dict[str, Any]:
        """Prioritize maintenance actions across multiple equipment."""
        
        # Sort equipment by risk and criticality
        equipment_priority = []
        
        for equipment_id, result in batch_results.items():
            max_prob = max(result['failure_probabilities'])
            criticality_weight = 2.0 if result['criticality'] == 'high' else 1.0
            priority_score = max_prob * criticality_weight
            
            equipment_priority.append({
                'equipment_id': equipment_id,
                'priority_score': priority_score,
                'max_failure_probability': max_prob,
                'maintenance_urgency': result['maintenance_urgency'],
                'criticality': result['criticality'],
                'estimated_cost': result['cost_analysis']['preventive_cost']
            })
        
        # Sort by priority score
        equipment_priority.sort(key=lambda x: x['priority_score'], reverse=True)
        
        # Calculate resource requirements
        total_cost = sum(eq['estimated_cost'] for eq in equipment_priority[:5])  # Top 5 priority
        
        return {
            'priority_ranking': equipment_priority,
            'immediate_attention_required': [
                eq for eq in equipment_priority if eq['maintenance_urgency'] in ['critical', 'high']
            ],
            'resource_planning': {
                'high_priority_equipment_count': len([eq for eq in equipment_priority[:5]]),
                'estimated_total_cost': total_cost,
                'recommended_maintenance_window_days': 14
            }
        }


class ProductionDemandForecastingExample:
    """Example: Production demand forecasting with capacity planning."""
    
    def __init__(self, examples: ManufacturingForecastingExamples):
        self.examples = examples
    
    async def run_demand_forecasting_with_seasonality(self) -> Dict[str, Any]:
        """Production demand forecasting with seasonal analysis."""
        logger.info("Running production demand forecasting example...")
        
        production_data = self.examples.sample_production_data
        
        # Mock external factors
        external_factors = {
            'market_growth_rate': 0.15,
            'seasonal_index': 1.2,
            'economic_indicator': 0.95,
            'promotional_campaigns': [
                {'start_date': '2024-02-15', 'end_date': '2024-02-29', 'impact_factor': 1.3},
                {'start_date': '2024-03-15', 'end_date': '2024-03-31', 'impact_factor': 1.4}
            ]
        }
        
        # Mock forecast service call
        forecast_result = await self._mock_demand_forecast(
            production_line_id="LINE_001",
            historical_data=production_data,
            external_factors=external_factors,
            forecast_horizon_days=30
        )
        
        # Capacity planning analysis
        capacity_analysis = self._analyze_capacity_requirements(forecast_result)
        
        return {
            'example_type': 'demand_forecasting_with_seasonality',
            'production_line_id': 'LINE_001',
            'forecast_result': forecast_result,
            'capacity_analysis': capacity_analysis,
            'external_factors': external_factors
        }
    
    async def _mock_demand_forecast(
        self, 
        production_line_id: str,
        historical_data: pd.DataFrame,
        external_factors: Dict[str, Any],
        forecast_horizon_days: int
    ) -> Dict[str, Any]:
        """Mock production demand forecast."""
        
        # Simple trend and seasonality
        recent_avg = historical_data['production_output'].tail(7).mean()
        growth_rate = external_factors.get('market_growth_rate', 0.1) / 365  # Daily rate
        seasonal_factor = external_factors.get('seasonal_index', 1.0)
        
        predictions = []
        for day in range(forecast_horizon_days):
            # Base prediction with growth
            base_pred = recent_avg * (1 + growth_rate * day)
            
            # Apply seasonality and external factors
            seasonal_pred = base_pred * seasonal_factor
            
            # Add some variation
            final_pred = seasonal_pred * (0.9 + 0.2 * np.random.random())
            predictions.append(final_pred)
        
        total_demand = sum(predictions)
        peak_demand = max(predictions)
        
        return {
            'production_line_id': production_line_id,
            'predictions': predictions,
            'timestamps': [(datetime.now() + timedelta(days=i)).isoformat() for i in range(forecast_horizon_days)],
            'production_metrics': {
                'total_forecast_demand': total_demand,
                'peak_demand': peak_demand,
                'average_demand': total_demand / forecast_horizon_days,
                'demand_variability': np.std(predictions)
            },
            'resource_planning': {
                'labor_hours_required': total_demand * 0.1,
                'material_requirements': total_demand * 2.5,
                'estimated_production_cost': total_demand * 45
            }
        }
    
    def _analyze_capacity_requirements(self, forecast_result: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze capacity requirements based on demand forecast."""
        
        predictions = forecast_result['predictions']
        max_capacity = 1500  # Assumed maximum daily capacity
        
        # Capacity utilization analysis
        utilization_rates = [pred / max_capacity for pred in predictions]
        max_utilization = max(utilization_rates)
        avg_utilization = sum(utilization_rates) / len(utilization_rates)
        
        # Identify bottleneck periods
        bottleneck_days = [i for i, util in enumerate(utilization_rates) if util > 0.9]
        
        # Resource gap analysis
        resource_gap = sum(max(0, pred - max_capacity) for pred in predictions)
        
        return {
            'capacity_utilization': {
                'maximum_utilization': max_utilization,
                'average_utilization': avg_utilization,
                'bottleneck_periods': bottleneck_days,
                'utilization_by_day': utilization_rates
            },
            'capacity_constraints': {
                'constraint_days': len(bottleneck_days),
                'total_excess_demand': resource_gap,
                'requires_capacity_expansion': resource_gap > 0
            },
            'recommendations': self._get_capacity_recommendations(max_utilization, resource_gap)
        }
    
    def _get_capacity_recommendations(self, max_utilization: float, resource_gap: float) -> List[str]:
        """Get capacity management recommendations."""
        recommendations = []
        
        if max_utilization > 0.95:
            recommendations.extend([
                'Consider capacity expansion',
                'Implement overtime scheduling',
                'Evaluate equipment upgrades'
            ])
        elif max_utilization > 0.85:
            recommendations.extend([
                'Monitor capacity utilization closely',
                'Plan for flexible staffing',
                'Consider outsourcing options for peak periods'
            ])
        
        if resource_gap > 0:
            recommendations.extend([
                'Implement demand smoothing strategies',
                'Consider inventory build-up before peak periods',
                'Evaluate alternative production scheduling'
            ])
        
        return recommendations


class QualityTrendPredictionExample:
    """Example: Quality trend prediction with process optimization."""
    
    def __init__(self, examples: ManufacturingForecastingExamples):
        self.examples = examples
    
    async def run_quality_trend_analysis(self) -> Dict[str, Any]:
        """Quality trend prediction with process parameter analysis."""
        logger.info("Running quality trend prediction example...")
        
        quality_data = self.examples.sample_quality_data
        
        # Extract process parameters
        process_params = quality_data[['process_temperature', 'process_pressure', 'feed_rate']]
        
        # Mock quality prediction
        quality_result = await self._mock_quality_prediction(
            batch_id="BATCH_2024_001",
            quality_data=quality_data[['quality_score', 'defect_rate']],
            process_parameters=process_params,
            forecast_horizon_hours=24
        )
        
        # Process optimization analysis
        optimization_analysis = self._analyze_process_optimization(quality_result, process_params)
        
        return {
            'example_type': 'quality_trend_analysis',
            'batch_id': 'BATCH_2024_001',
            'quality_prediction': quality_result,
            'process_optimization': optimization_analysis
        }
    
    async def _mock_quality_prediction(
        self,
        batch_id: str,
        quality_data: pd.DataFrame,
        process_parameters: pd.DataFrame,
        forecast_horizon_hours: int
    ) -> Dict[str, Any]:
        """Mock quality trend prediction."""
        
        # Analyze current trends
        recent_quality = quality_data['quality_score'].tail(24).mean()
        quality_trend = (quality_data['quality_score'].tail(12).mean() - 
                        quality_data['quality_score'].head(12).mean())
        
        # Generate predictions
        predictions = []
        for hour in range(forecast_horizon_hours):
            # Apply trend and some random variation
            pred = recent_quality + (quality_trend * hour / 24) + np.random.normal(0, 0.01)
            pred = max(0.6, min(1.0, pred))  # Clip to realistic range
            predictions.append(pred)
        
        # Quality analysis
        avg_quality = sum(predictions) / len(predictions)
        min_quality = min(predictions)
        
        # Defect rate estimation
        defect_rates = [(1 - q) * 0.1 for q in predictions]
        
        return {
            'batch_id': batch_id,
            'predictions': predictions,
            'defect_rate_predictions': defect_rates,
            'quality_analysis': {
                'average_predicted_quality': avg_quality,
                'minimum_predicted_quality': min_quality,
                'quality_trend': 'improving' if quality_trend > 0 else 'declining',
                'trend_magnitude': abs(quality_trend)
            },
            'compliance_forecast': {
                'percentage_above_acceptable': sum(1 for q in predictions if q >= 0.85) / len(predictions) * 100,
                'expected_defect_rate': sum(defect_rates) / len(defect_rates),
                'quality_risk_level': 'high' if min_quality < 0.8 else 'medium' if avg_quality < 0.9 else 'low'
            }
        }
    
    def _analyze_process_optimization(
        self, 
        quality_result: Dict[str, Any], 
        process_parameters: pd.DataFrame
    ) -> Dict[str, Any]:
        """Analyze process optimization opportunities."""
        
        quality_risk = quality_result['compliance_forecast']['quality_risk_level']
        avg_quality = quality_result['quality_analysis']['average_predicted_quality']
        
        # Process parameter analysis (simplified)
        temp_std = process_parameters['process_temperature'].std()
        pressure_std = process_parameters['process_pressure'].std()
        feed_std = process_parameters['feed_rate'].std()
        
        recommendations = []
        
        if temp_std > 5:
            recommendations.append('Improve temperature control - high variability detected')
        if pressure_std > 2:
            recommendations.append('Stabilize pressure control system')
        if feed_std > 10:
            recommendations.append('Optimize feed rate consistency')
        
        if avg_quality < 0.85:
            recommendations.extend([
                'Review process setpoints',
                'Implement statistical process control',
                'Consider equipment calibration'
            ])
        
        return {
            'process_stability': {
                'temperature_variability': temp_std,
                'pressure_variability': pressure_std,
                'feed_rate_variability': feed_std,
                'overall_stability_score': 1 / (1 + temp_std/10 + pressure_std/5 + feed_std/20)
            },
            'optimization_opportunities': {
                'quality_improvement_potential': max(0, 0.95 - avg_quality),
                'defect_reduction_potential': quality_result['compliance_forecast']['expected_defect_rate'] * 0.5,
                'cost_savings_potential': quality_result['compliance_forecast']['expected_defect_rate'] * 1000 * 50
            },
            'recommendations': recommendations
        }


class EnergyOptimizationExample:
    """Example: Energy consumption forecasting with optimization."""
    
    def __init__(self, examples: ManufacturingForecastingExamples):
        self.examples = examples
    
    async def run_energy_optimization(self) -> Dict[str, Any]:
        """Energy consumption forecasting with cost optimization."""
        logger.info("Running energy optimization example...")
        
        energy_data = self.examples.sample_energy_data
        
        # Mock energy pricing structure
        energy_pricing = {
            'energy_rate_per_kwh': 0.12,
            'peak_demand_rate': 18.0,
            'time_of_use_rates': {
                'peak': {'hours': [16, 17, 18, 19, 20], 'rate': 0.18},
                'off_peak': {'hours': [22, 23, 0, 1, 2, 3, 4, 5], 'rate': 0.08},
                'standard': {'rate': 0.12}
            }
        }
        
        # Mock production schedule
        production_schedule = self._generate_mock_production_schedule()
        
        # Energy forecast
        energy_result = await self._mock_energy_forecast(
            facility_id="FAC_001",
            energy_data=energy_data,
            production_schedule=production_schedule,
            energy_pricing=energy_pricing,
            forecast_horizon_hours=48
        )
        
        # Optimization analysis
        optimization_result = self._analyze_energy_optimization(energy_result, energy_pricing)
        
        return {
            'example_type': 'energy_optimization',
            'facility_id': 'FAC_001',
            'energy_forecast': energy_result,
            'optimization_analysis': optimization_result,
            'pricing_structure': energy_pricing
        }
    
    def _generate_mock_production_schedule(self) -> List[Dict[str, Any]]:
        """Generate mock production schedule."""
        schedule = []
        base_time = datetime.now()
        
        for hour in range(48):
            timestamp = base_time + timedelta(hours=hour)
            
            # Higher production during business hours
            if 8 <= timestamp.hour <= 18 and timestamp.weekday() < 5:
                production_level = 0.8 + 0.2 * np.random.random()
            elif 6 <= timestamp.hour <= 22 and timestamp.weekday() < 5:
                production_level = 0.6 + 0.3 * np.random.random()
            else:
                production_level = 0.2 + 0.3 * np.random.random()
            
            schedule.append({
                'timestamp': timestamp.isoformat(),
                'production_level': production_level,
                'planned_units': int(production_level * 100)
            })
        
        return schedule
    
    async def _mock_energy_forecast(
        self,
        facility_id: str,
        energy_data: pd.DataFrame,
        production_schedule: List[Dict[str, Any]],
        energy_pricing: Dict[str, Any],
        forecast_horizon_hours: int
    ) -> Dict[str, Any]:
        """Mock energy consumption forecast."""
        
        # Base energy consumption pattern
        recent_avg = energy_data['energy_consumption'].tail(96).mean()  # Last 24 hours
        
        predictions = []
        cost_predictions = []
        
        for hour in range(forecast_horizon_hours):
            # Get production level for this hour
            prod_level = production_schedule[hour]['production_level']
            
            # Calculate energy consumption based on production
            base_consumption = recent_avg * (0.3 + 0.7 * prod_level)  # 30% base + 70% variable
            
            # Add some random variation
            consumption = base_consumption * (0.9 + 0.2 * np.random.random())
            predictions.append(consumption)
            
            # Calculate cost based on time-of-use rates
            hour_of_day = (datetime.now() + timedelta(hours=hour)).hour
            if hour_of_day in energy_pricing['time_of_use_rates']['peak']['hours']:
                rate = energy_pricing['time_of_use_rates']['peak']['rate']
            elif hour_of_day in energy_pricing['time_of_use_rates']['off_peak']['hours']:
                rate = energy_pricing['time_of_use_rates']['off_peak']['rate']
            else:
                rate = energy_pricing['time_of_use_rates']['standard']['rate']
            
            cost = consumption * rate
            cost_predictions.append(cost)
        
        total_consumption = sum(predictions)
        total_cost = sum(cost_predictions)
        peak_demand = max(predictions)
        
        return {
            'facility_id': facility_id,
            'predictions': predictions,
            'cost_predictions': cost_predictions,
            'energy_analysis': {
                'total_forecast_consumption_kwh': total_consumption,
                'peak_consumption_kw': peak_demand,
                'average_consumption_kw': total_consumption / forecast_horizon_hours,
                'load_factor': (total_consumption / forecast_horizon_hours) / peak_demand
            },
            'cost_forecast': {
                'total_energy_cost': total_cost,
                'peak_demand_cost': peak_demand * energy_pricing['peak_demand_rate'],
                'average_cost_per_hour': total_cost / forecast_horizon_hours
            }
        }
    
    def _analyze_energy_optimization(
        self, 
        energy_result: Dict[str, Any], 
        pricing: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze energy optimization opportunities."""
        
        predictions = energy_result['predictions']
        load_factor = energy_result['energy_analysis']['load_factor']
        
        # Identify peak hours
        peak_threshold = np.percentile(predictions, 80)
        peak_hours = [i for i, p in enumerate(predictions) if p > peak_threshold]
        
        # Calculate potential savings from load shifting
        peak_reduction_potential = sum(predictions[i] - peak_threshold for i in peak_hours) * 0.3
        load_shifting_savings = peak_reduction_potential * (pricing['time_of_use_rates']['peak']['rate'] - 
                                                           pricing['time_of_use_rates']['off_peak']['rate'])
        
        # Energy efficiency analysis
        efficiency_score = min(1.0, load_factor * 1.2)
        
        recommendations = []
        if load_factor < 0.6:
            recommendations.extend([
                'Implement load balancing strategies',
                'Consider energy storage systems',
                'Optimize production scheduling'
            ])
        
        if len(peak_hours) > 8:
            recommendations.extend([
                'Implement demand response programs',
                'Schedule non-critical operations during off-peak hours',
                'Consider peak shaving technologies'
            ])
        
        if efficiency_score < 0.7:
            recommendations.extend([
                'Conduct energy audit',
                'Upgrade to more efficient equipment',
                'Implement energy management system'
            ])
        
        return {
            'load_analysis': {
                'load_factor': load_factor,
                'peak_hours_count': len(peak_hours),
                'peak_hours': peak_hours,
                'efficiency_score': efficiency_score
            },
            'optimization_opportunities': {
                'peak_reduction_potential_kw': peak_reduction_potential,
                'load_shifting_savings_potential': load_shifting_savings,
                'efficiency_improvement_potential': max(0, 0.9 - efficiency_score)
            },
            'cost_savings': {
                'annual_savings_estimate': load_shifting_savings * 365 / 2,  # Extrapolate
                'payback_period_months': 18 if load_shifting_savings > 50 else 36,
                'roi_percentage': (load_shifting_savings * 365 / 2) / 50000 * 100  # Assuming $50k investment
            },
            'recommendations': recommendations
        }


def run_all_examples():
    """Run all manufacturing forecasting examples."""
    
    async def main():
        print("Manufacturing Time-Series Forecasting Examples")
        print("=" * 60)
        
        # Initialize examples
        examples = ManufacturingForecastingExamples()
        
        # Equipment failure prediction
        print("\n1. Equipment Failure Prediction Example")
        print("-" * 40)
        failure_example = EquipmentFailurePredictionExample(examples)
        
        basic_result = await failure_example.run_basic_failure_prediction()
        print(f"Basic failure prediction for {basic_result['equipment_id']}:")
        print(f"  - Maintenance urgency: {basic_result['prediction_result']['maintenance_urgency']}")
        print(f"  - Max failure probability: {max(basic_result['prediction_result']['failure_probabilities']):.3f}")
        print(f"  - ROI for preventive maintenance: {basic_result['prediction_result']['cost_analysis']['roi']:.2f}")
        
        multi_result = await failure_example.run_multi_equipment_analysis()
        print(f"\nMulti-equipment analysis ({multi_result['total_equipment']} units):")
        priority = multi_result['maintenance_priority']
        print(f"  - High priority equipment: {len(priority['immediate_attention_required'])}")
        print(f"  - Total estimated cost: ${priority['resource_planning']['estimated_total_cost']:,.0f}")
        
        # Production demand forecasting
        print("\n\n2. Production Demand Forecasting Example")
        print("-" * 45)
        demand_example = ProductionDemandForecastingExample(examples)
        
        demand_result = await demand_example.run_demand_forecasting_with_seasonality()
        forecast = demand_result['forecast_result']
        capacity = demand_result['capacity_analysis']
        print(f"Production forecast for {forecast['production_line_id']}:")
        print(f"  - Total 30-day demand: {forecast['production_metrics']['total_forecast_demand']:,.0f} units")
        print(f"  - Peak daily demand: {forecast['production_metrics']['peak_demand']:,.0f} units")
        print(f"  - Maximum capacity utilization: {capacity['capacity_utilization']['maximum_utilization']:.1%}")
        print(f"  - Bottleneck days: {capacity['capacity_constraints']['constraint_days']}")
        
        # Quality trend prediction
        print("\n\n3. Quality Trend Prediction Example")
        print("-" * 38)
        quality_example = QualityTrendPredictionExample(examples)
        
        quality_result = await quality_example.run_quality_trend_analysis()
        quality_pred = quality_result['quality_prediction']
        optimization = quality_result['process_optimization']
        print(f"Quality prediction for {quality_pred['batch_id']}:")
        print(f"  - Average predicted quality: {quality_pred['quality_analysis']['average_predicted_quality']:.3f}")
        print(f"  - Quality risk level: {quality_pred['compliance_forecast']['quality_risk_level']}")
        print(f"  - Expected defect rate: {quality_pred['compliance_forecast']['expected_defect_rate']:.2%}")
        print(f"  - Process stability score: {optimization['process_stability']['overall_stability_score']:.3f}")
        
        # Energy optimization
        print("\n\n4. Energy Optimization Example")
        print("-" * 33)
        energy_example = EnergyOptimizationExample(examples)
        
        energy_result = await energy_example.run_energy_optimization()
        energy_forecast = energy_result['energy_forecast']
        optimization_analysis = energy_result['optimization_analysis']
        print(f"Energy forecast for {energy_forecast['facility_id']}:")
        print(f"  - Total 48-hour consumption: {energy_forecast['energy_analysis']['total_forecast_consumption_kwh']:,.0f} kWh")
        print(f"  - Total cost: ${energy_forecast['cost_forecast']['total_energy_cost']:,.0f}")
        print(f"  - Load factor: {energy_forecast['energy_analysis']['load_factor']:.2f}")
        print(f"  - Potential annual savings: ${optimization_analysis['cost_savings']['annual_savings_estimate']:,.0f}")
        
        print("\n" + "=" * 60)
        print("All examples completed successfully!")
        
        return {
            'equipment_failure': basic_result,
            'multi_equipment': multi_result,
            'production_demand': demand_result,
            'quality_trends': quality_result,
            'energy_optimization': energy_result
        }
    
    return asyncio.run(main())


if __name__ == "__main__":
    # Run all examples
    results = run_all_examples()
    
    # Save results to JSON file for further analysis
    with open('manufacturing_forecasting_examples_results.json', 'w') as f:
        # Convert numpy types to Python types for JSON serialization
        def convert_numpy(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            return obj
        
        # Recursively convert numpy types
        def recursive_convert(data):
            if isinstance(data, dict):
                return {k: recursive_convert(v) for k, v in data.items()}
            elif isinstance(data, list):
                return [recursive_convert(item) for item in data]
            else:
                return convert_numpy(data)
        
        json.dump(recursive_convert(results), f, indent=2, default=str)