"""
Digital Twin Engine
===================

Core engine for creating and managing digital twins of manufacturing assets and processes.
Provides physics-based simulation, real-time synchronization, and predictive analytics.

Features:
- Multi-scale digital twin modeling (component, equipment, line, factory)
- Real-time data fusion from IoT sensors and MES systems
- Physics-based simulation and predictive modeling
- Asset state synchronization and lifecycle management
- Performance optimization and anomaly detection
- Machine learning integration for predictive analytics
"""

import asyncio
import logging
import numpy as np
import pandas as pd
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
import uuid
from abc import ABC, abstractmethod

# Scientific computing and ML imports
from scipy import optimize, integrate, interpolate
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class TwinType(Enum):
    """Digital twin types based on scope."""
    COMPONENT = "component"
    EQUIPMENT = "equipment" 
    PRODUCTION_LINE = "production_line"
    FACTORY = "factory"
    SUPPLY_CHAIN = "supply_chain"


class TwinState(Enum):
    """Digital twin operational states."""
    CREATING = "creating"
    SYNCHRONIZING = "synchronizing"
    ACTIVE = "active"
    SIMULATION = "simulation"
    MAINTENANCE = "maintenance"
    ERROR = "error"
    ARCHIVED = "archived"


class SimulationType(Enum):
    """Types of simulations supported."""
    PREDICTIVE = "predictive"
    WHAT_IF = "what_if"
    OPTIMIZATION = "optimization"
    FAILURE_ANALYSIS = "failure_analysis"
    MAINTENANCE_PLANNING = "maintenance_planning"


@dataclass
class AssetState:
    """Represents the current state of a physical or digital asset."""
    asset_id: str
    timestamp: datetime
    operational_state: str
    parameters: Dict[str, float] = field(default_factory=dict)
    sensors: Dict[str, float] = field(default_factory=dict)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    health_indicators: Dict[str, float] = field(default_factory=dict)
    environmental_conditions: Dict[str, float] = field(default_factory=dict)
    quality_score: float = 1.0
    confidence: float = 1.0


@dataclass  
class SimulationScenario:
    """Defines a simulation scenario with parameters and constraints."""
    scenario_id: str
    scenario_name: str
    simulation_type: SimulationType
    time_horizon_hours: float
    parameters: Dict[str, Any] = field(default_factory=dict)
    constraints: Dict[str, Any] = field(default_factory=dict)
    objectives: List[str] = field(default_factory=list)
    monte_carlo_samples: int = 100
    confidence_level: float = 0.95


@dataclass
class PhysicsModel:
    """Physics-based model for asset behavior."""
    model_id: str
    model_name: str
    model_type: str  # thermodynamic, mechanical, electrical, etc.
    equations: List[Callable] = field(default_factory=list)
    parameters: Dict[str, float] = field(default_factory=dict)
    constraints: Dict[str, Tuple[float, float]] = field(default_factory=dict)
    valid_range: Dict[str, Tuple[float, float]] = field(default_factory=dict)


class BaseDigitalTwin(ABC):
    """Base class for all digital twin implementations."""
    
    def __init__(self, twin_id: str, twin_name: str, twin_type: TwinType):
        self.twin_id = twin_id
        self.twin_name = twin_name
        self.twin_type = twin_type
        self.state = TwinState.CREATING
        self.created_at = datetime.utcnow()
        self.last_updated = datetime.utcnow()
        self.last_sync = None
        
        # Asset state management
        self.current_state = AssetState(
            asset_id=twin_id,
            timestamp=datetime.utcnow(),
            operational_state="unknown"
        )
        self.state_history: List[AssetState] = []
        self.max_history_length = 10000
        
        # Physics models
        self.physics_models: Dict[str, PhysicsModel] = {}
        
        # ML models for predictions
        self.predictive_models: Dict[str, Any] = {}
        self.anomaly_detector = None
        self.performance_predictor = None
        
        # Simulation capabilities
        self.simulation_results: Dict[str, Dict[str, Any]] = {}
        
        # Synchronization settings
        self.sync_enabled = True
        self.sync_interval_seconds = 30
        self.sync_sources: List[str] = []
        
        logger.info(f"Digital twin {twin_id} ({twin_type.value}) initialized")
    
    @abstractmethod
    async def initialize_models(self, configuration: Dict[str, Any]) -> bool:
        """Initialize physics and ML models for the twin."""
        pass
    
    @abstractmethod
    async def sync_with_physical_asset(self, data_sources: Dict[str, Any]) -> bool:
        """Synchronize with physical asset data."""
        pass
    
    @abstractmethod
    async def run_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run simulation scenario."""
        pass
    
    @abstractmethod
    def get_performance_metrics(self) -> Dict[str, float]:
        """Get current performance metrics."""
        pass


class ComponentTwin(BaseDigitalTwin):
    """Digital twin for individual components (sensors, actuators, etc.)."""
    
    def __init__(self, twin_id: str, twin_name: str, component_type: str):
        super().__init__(twin_id, twin_name, TwinType.COMPONENT)
        self.component_type = component_type
        self.specifications: Dict[str, Any] = {}
        self.wear_model: Optional[Callable] = None
        self.failure_modes: List[Dict[str, Any]] = []
        
    async def initialize_models(self, configuration: Dict[str, Any]) -> bool:
        """Initialize component-specific models."""
        try:
            self.specifications = configuration.get('specifications', {})
            
            # Initialize wear model for component degradation
            if self.component_type in ['bearing', 'motor', 'pump']:
                self.wear_model = self._create_wear_model()
            
            # Initialize anomaly detection
            self.anomaly_detector = IsolationForest(
                contamination=0.1, 
                random_state=42
            )
            
            # Define failure modes based on component type
            self._define_failure_modes()
            
            self.state = TwinState.ACTIVE
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize component twin {self.twin_id}: {e}")
            self.state = TwinState.ERROR
            return False
    
    async def sync_with_physical_asset(self, data_sources: Dict[str, Any]) -> bool:
        """Sync component with sensor data."""
        try:
            sensor_data = data_sources.get('sensors', {})
            timestamp = datetime.utcnow()
            
            # Update current state
            self.current_state = AssetState(
                asset_id=self.twin_id,
                timestamp=timestamp,
                operational_state=sensor_data.get('status', 'unknown'),
                sensors=sensor_data,
                performance_metrics=self._calculate_component_performance(sensor_data),
                health_indicators=self._calculate_health_indicators(sensor_data)
            )
            
            # Add to history
            self._add_to_history(self.current_state)
            
            # Update ML models with new data
            await self._update_models(sensor_data)
            
            self.last_sync = timestamp
            return True
            
        except Exception as e:
            logger.error(f"Sync failed for component twin {self.twin_id}: {e}")
            return False
    
    async def run_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run component simulation."""
        try:
            results = {
                'scenario_id': scenario.scenario_id,
                'twin_id': self.twin_id,
                'simulation_type': scenario.simulation_type.value,
                'started_at': datetime.utcnow(),
                'time_horizon_hours': scenario.time_horizon_hours
            }
            
            if scenario.simulation_type == SimulationType.PREDICTIVE:
                results.update(await self._run_predictive_simulation(scenario))
            elif scenario.simulation_type == SimulationType.FAILURE_ANALYSIS:
                results.update(await self._run_failure_analysis(scenario))
            elif scenario.simulation_type == SimulationType.MAINTENANCE_PLANNING:
                results.update(await self._run_maintenance_simulation(scenario))
            
            results['completed_at'] = datetime.utcnow()
            results['simulation_duration_seconds'] = (
                results['completed_at'] - results['started_at']
            ).total_seconds()
            
            self.simulation_results[scenario.scenario_id] = results
            return results
            
        except Exception as e:
            logger.error(f"Simulation failed for component {self.twin_id}: {e}")
            return {'error': str(e), 'scenario_id': scenario.scenario_id}
    
    def get_performance_metrics(self) -> Dict[str, float]:
        """Get component performance metrics."""
        if not self.current_state.performance_metrics:
            return {}
        
        return {
            'availability': self.current_state.performance_metrics.get('availability', 0.0),
            'efficiency': self.current_state.performance_metrics.get('efficiency', 0.0),
            'health_score': self.current_state.health_indicators.get('overall_health', 0.0),
            'remaining_useful_life_hours': self.current_state.performance_metrics.get('rul_hours', 0.0)
        }
    
    def _create_wear_model(self) -> Callable:
        """Create component wear model based on physics."""
        def wear_progression(time_hours: float, load_factor: float = 1.0) -> float:
            # Simple exponential wear model
            base_wear_rate = self.specifications.get('wear_rate', 0.001)
            return 1.0 - np.exp(-base_wear_rate * time_hours * load_factor)
        
        return wear_progression
    
    def _define_failure_modes(self):
        """Define failure modes based on component type."""
        failure_modes_map = {
            'bearing': [
                {'mode': 'fatigue', 'probability': 0.4, 'indicators': ['vibration', 'temperature']},
                {'mode': 'contamination', 'probability': 0.3, 'indicators': ['vibration', 'noise']},
                {'mode': 'misalignment', 'probability': 0.2, 'indicators': ['vibration', 'current']},
                {'mode': 'lubrication', 'probability': 0.1, 'indicators': ['temperature', 'friction']}
            ],
            'motor': [
                {'mode': 'winding_failure', 'probability': 0.4, 'indicators': ['temperature', 'current', 'insulation']},
                {'mode': 'bearing_wear', 'probability': 0.3, 'indicators': ['vibration', 'temperature']},
                {'mode': 'rotor_issues', 'probability': 0.2, 'indicators': ['vibration', 'current']},
                {'mode': 'cooling_failure', 'probability': 0.1, 'indicators': ['temperature']}
            ]
        }
        
        self.failure_modes = failure_modes_map.get(self.component_type, [])
    
    def _calculate_component_performance(self, sensor_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate performance metrics from sensor data."""
        performance = {}
        
        # Availability (based on operational state)
        status = sensor_data.get('status', 'unknown')
        performance['availability'] = 1.0 if status == 'running' else 0.0
        
        # Efficiency (based on power consumption vs. expected)
        power_actual = sensor_data.get('power', 0)
        power_expected = self.specifications.get('rated_power', 100)
        if power_expected > 0:
            performance['efficiency'] = min(1.0, power_actual / power_expected)
        
        # Vibration-based health score
        vibration = sensor_data.get('vibration', 0)
        vibration_limit = self.specifications.get('vibration_limit', 10)
        performance['vibration_health'] = max(0.0, 1.0 - vibration / vibration_limit)
        
        return performance
    
    def _calculate_health_indicators(self, sensor_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate health indicators from sensor data."""
        health = {}
        
        # Temperature health
        temp = sensor_data.get('temperature', 25)
        temp_limit = self.specifications.get('temperature_limit', 80)
        health['temperature_health'] = max(0.0, 1.0 - (temp - 25) / (temp_limit - 25))
        
        # Vibration health  
        vibration = sensor_data.get('vibration', 0)
        vibration_limit = self.specifications.get('vibration_limit', 10)
        health['vibration_health'] = max(0.0, 1.0 - vibration / vibration_limit)
        
        # Current health (for electrical components)
        if 'current' in sensor_data:
            current = sensor_data['current']
            current_limit = self.specifications.get('current_limit', 10)
            health['current_health'] = max(0.0, 1.0 - current / current_limit)
        
        # Overall health (weighted average)
        health_values = [v for v in health.values() if v > 0]
        health['overall_health'] = np.mean(health_values) if health_values else 0.0
        
        return health
    
    async def _update_models(self, sensor_data: Dict[str, Any]):
        """Update ML models with new sensor data."""
        try:
            # Update anomaly detector if we have enough historical data
            if len(self.state_history) >= 50:
                # Prepare training data
                features = []
                for state in self.state_history[-100:]:  # Last 100 observations
                    feature_vector = [
                        state.sensors.get('temperature', 0),
                        state.sensors.get('vibration', 0),
                        state.sensors.get('current', 0),
                        state.sensors.get('pressure', 0)
                    ]
                    features.append(feature_vector)
                
                if len(features) >= 10:
                    X = np.array(features)
                    self.anomaly_detector.fit(X)
            
        except Exception as e:
            logger.error(f"Model update failed: {e}")
    
    async def _run_predictive_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run predictive simulation for component."""
        time_points = np.linspace(0, scenario.time_horizon_hours, 100)
        
        # Predict degradation over time
        current_health = self.current_state.health_indicators.get('overall_health', 1.0)
        
        if self.wear_model:
            degradation_curve = []
            for t in time_points:
                wear = self.wear_model(t)
                health_at_t = max(0.0, current_health - wear)
                degradation_curve.append(health_at_t)
        else:
            # Simple linear degradation model
            degradation_rate = 0.01  # 1% per hour
            degradation_curve = [
                max(0.0, current_health - degradation_rate * t) 
                for t in time_points
            ]
        
        # Find predicted failure time
        failure_threshold = 0.2  # 20% health
        failure_time = None
        for i, health in enumerate(degradation_curve):
            if health <= failure_threshold:
                failure_time = time_points[i]
                break
        
        return {
            'prediction_type': 'degradation',
            'time_points': time_points.tolist(),
            'health_curve': degradation_curve,
            'predicted_failure_time_hours': failure_time,
            'remaining_useful_life_hours': failure_time if failure_time else scenario.time_horizon_hours,
            'confidence': 0.8
        }
    
    async def _run_failure_analysis(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run failure mode analysis."""
        analysis_results = {
            'failure_modes': [],
            'risk_assessment': {},
            'mitigation_strategies': []
        }
        
        current_sensors = self.current_state.sensors
        
        for failure_mode in self.failure_modes:
            # Calculate failure probability based on current indicators
            mode_probability = failure_mode['probability']
            indicator_scores = []
            
            for indicator in failure_mode['indicators']:
                if indicator in current_sensors:
                    # Normalize sensor value to risk score
                    sensor_value = current_sensors[indicator]
                    normal_value = self.specifications.get(f'{indicator}_normal', 50)
                    limit_value = self.specifications.get(f'{indicator}_limit', 100)
                    
                    if limit_value > normal_value:
                        risk_score = min(1.0, (sensor_value - normal_value) / (limit_value - normal_value))
                    else:
                        risk_score = 0.0
                    
                    indicator_scores.append(max(0.0, risk_score))
            
            # Calculate overall failure risk for this mode
            avg_indicator_score = np.mean(indicator_scores) if indicator_scores else 0.0
            overall_risk = mode_probability * avg_indicator_score
            
            analysis_results['failure_modes'].append({
                'failure_mode': failure_mode['mode'],
                'base_probability': mode_probability,
                'current_risk_score': overall_risk,
                'indicators': failure_mode['indicators'],
                'indicator_scores': dict(zip(failure_mode['indicators'], indicator_scores))
            })
        
        # Overall risk assessment
        total_risk = sum(mode['current_risk_score'] for mode in analysis_results['failure_modes'])
        analysis_results['risk_assessment'] = {
            'total_risk_score': min(1.0, total_risk),
            'risk_level': 'high' if total_risk > 0.7 else 'medium' if total_risk > 0.3 else 'low',
            'time_to_failure_estimate_hours': max(1, 1000 * (1 - total_risk))
        }
        
        return analysis_results
    
    async def _run_maintenance_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run maintenance planning simulation."""
        current_health = self.current_state.health_indicators.get('overall_health', 1.0)
        
        # Define maintenance strategies
        strategies = [
            {'name': 'reactive', 'cost_per_hour': 100, 'effectiveness': 1.0, 'trigger_health': 0.1},
            {'name': 'preventive', 'cost_per_hour': 50, 'effectiveness': 0.9, 'trigger_health': 0.5},
            {'name': 'predictive', 'cost_per_hour': 30, 'effectiveness': 0.8, 'trigger_health': 0.3}
        ]
        
        simulation_results = []
        
        for strategy in strategies:
            # Simulate maintenance strategy over time horizon
            time_points = np.linspace(0, scenario.time_horizon_hours, 100)
            health_curve = []
            total_cost = 0
            maintenance_events = []
            
            current_sim_health = current_health
            
            for t in time_points:
                # Natural degradation
                degradation = 0.01 * (t / 24)  # 1% per day
                current_sim_health = max(0.0, current_health - degradation)
                
                # Check if maintenance is needed
                if current_sim_health <= strategy['trigger_health']:
                    # Perform maintenance
                    current_sim_health = min(1.0, current_sim_health + strategy['effectiveness'])
                    total_cost += strategy['cost_per_hour']
                    maintenance_events.append({
                        'time_hours': t,
                        'health_before': current_sim_health - strategy['effectiveness'],
                        'health_after': current_sim_health,
                        'cost': strategy['cost_per_hour']
                    })
                
                health_curve.append(current_sim_health)
            
            simulation_results.append({
                'strategy': strategy['name'],
                'total_cost': total_cost,
                'final_health': health_curve[-1],
                'maintenance_events': maintenance_events,
                'health_curve': health_curve,
                'uptime_percentage': (len([h for h in health_curve if h > 0.2]) / len(health_curve)) * 100
            })
        
        # Recommend best strategy based on cost-effectiveness
        best_strategy = min(simulation_results, key=lambda x: x['total_cost'] / max(0.01, x['uptime_percentage']))
        
        return {
            'maintenance_strategies': simulation_results,
            'recommended_strategy': best_strategy['strategy'],
            'cost_benefit_analysis': best_strategy
        }
    
    def _add_to_history(self, state: AssetState):
        """Add state to history with size limit."""
        self.state_history.append(state)
        if len(self.state_history) > self.max_history_length:
            self.state_history.pop(0)


class EquipmentTwin(BaseDigitalTwin):
    """Digital twin for equipment (machines, systems)."""
    
    def __init__(self, twin_id: str, twin_name: str, equipment_type: str):
        super().__init__(twin_id, twin_name, TwinType.EQUIPMENT)
        self.equipment_type = equipment_type
        self.components: Dict[str, ComponentTwin] = {}
        self.process_parameters: Dict[str, float] = {}
        self.oee_calculator = None
        
    async def initialize_models(self, configuration: Dict[str, Any]) -> bool:
        """Initialize equipment-specific models."""
        try:
            self.process_parameters = configuration.get('process_parameters', {})
            
            # Initialize component twins
            components_config = configuration.get('components', {})
            for comp_id, comp_config in components_config.items():
                component = ComponentTwin(
                    twin_id=comp_id,
                    twin_name=comp_config.get('name', comp_id),
                    component_type=comp_config.get('type', 'generic')
                )
                await component.initialize_models(comp_config)
                self.components[comp_id] = component
            
            # Initialize equipment-level models
            self._initialize_oee_calculator()
            
            # Create equipment-specific physics models
            await self._create_physics_models(configuration)
            
            self.state = TwinState.ACTIVE
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize equipment twin {self.twin_id}: {e}")
            self.state = TwinState.ERROR
            return False
    
    async def sync_with_physical_asset(self, data_sources: Dict[str, Any]) -> bool:
        """Sync equipment with multiple data sources."""
        try:
            timestamp = datetime.utcnow()
            
            # Sync component twins first
            components_data = data_sources.get('components', {})
            for comp_id, comp_data in components_data.items():
                if comp_id in self.components:
                    await self.components[comp_id].sync_with_physical_asset({
                        'sensors': comp_data
                    })
            
            # Aggregate equipment-level data
            equipment_sensors = data_sources.get('equipment_sensors', {})
            process_data = data_sources.get('process_data', {})
            
            # Calculate equipment performance metrics
            performance_metrics = self._calculate_equipment_performance(
                equipment_sensors, process_data
            )
            
            # Update current state
            self.current_state = AssetState(
                asset_id=self.twin_id,
                timestamp=timestamp,
                operational_state=equipment_sensors.get('status', 'unknown'),
                parameters=process_data,
                sensors=equipment_sensors,
                performance_metrics=performance_metrics,
                health_indicators=self._calculate_equipment_health()
            )
            
            self._add_to_history(self.current_state)
            self.last_sync = timestamp
            return True
            
        except Exception as e:
            logger.error(f"Sync failed for equipment twin {self.twin_id}: {e}")
            return False
    
    async def run_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run equipment-level simulation."""
        try:
            results = {
                'scenario_id': scenario.scenario_id,
                'twin_id': self.twin_id,
                'simulation_type': scenario.simulation_type.value,
                'started_at': datetime.utcnow()
            }
            
            if scenario.simulation_type == SimulationType.OPTIMIZATION:
                results.update(await self._run_optimization_simulation(scenario))
            elif scenario.simulation_type == SimulationType.WHAT_IF:
                results.update(await self._run_what_if_simulation(scenario))
            elif scenario.simulation_type == SimulationType.PREDICTIVE:
                results.update(await self._run_equipment_prediction(scenario))
            
            results['completed_at'] = datetime.utcnow()
            self.simulation_results[scenario.scenario_id] = results
            return results
            
        except Exception as e:
            logger.error(f"Equipment simulation failed: {e}")
            return {'error': str(e)}
    
    def get_performance_metrics(self) -> Dict[str, float]:
        """Get equipment performance metrics."""
        return {
            'oee': self.current_state.performance_metrics.get('oee', 0.0),
            'availability': self.current_state.performance_metrics.get('availability', 0.0),
            'performance_efficiency': self.current_state.performance_metrics.get('performance', 0.0),
            'quality_rate': self.current_state.performance_metrics.get('quality', 0.0),
            'energy_efficiency': self.current_state.performance_metrics.get('energy_efficiency', 0.0),
            'throughput': self.current_state.performance_metrics.get('throughput', 0.0)
        }
    
    def _initialize_oee_calculator(self):
        """Initialize OEE calculation logic."""
        self.oee_calculator = {
            'planned_production_time': 8.0,  # hours
            'ideal_cycle_time': 60.0,  # seconds per unit
            'target_quality_rate': 0.95
        }
    
    async def _create_physics_models(self, configuration: Dict[str, Any]):
        """Create physics models for equipment."""
        equipment_type = self.equipment_type.lower()
        
        if 'motor' in equipment_type or 'drive' in equipment_type:
            # Electric motor physics model
            motor_model = PhysicsModel(
                model_id=f"{self.twin_id}_motor",
                model_name="Electric Motor Model",
                model_type="electrical",
                parameters={
                    'rated_power': configuration.get('rated_power', 10.0),  # kW
                    'efficiency': configuration.get('efficiency', 0.9),
                    'power_factor': configuration.get('power_factor', 0.85)
                }
            )
            self.physics_models['motor'] = motor_model
        
        if 'pump' in equipment_type:
            # Pump hydraulics model
            pump_model = PhysicsModel(
                model_id=f"{self.twin_id}_pump",
                model_name="Centrifugal Pump Model",
                model_type="hydraulic",
                parameters={
                    'rated_flow': configuration.get('rated_flow', 100.0),  # L/min
                    'rated_head': configuration.get('rated_head', 50.0),  # m
                    'efficiency': configuration.get('pump_efficiency', 0.75)
                }
            )
            self.physics_models['pump'] = pump_model
    
    def _calculate_equipment_performance(
        self, 
        sensors: Dict[str, Any], 
        process_data: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate equipment performance metrics."""
        performance = {}
        
        # OEE calculation
        if self.oee_calculator:
            # Availability
            planned_time = self.oee_calculator['planned_production_time']
            actual_runtime = sensors.get('runtime_hours', planned_time)
            availability = min(1.0, actual_runtime / planned_time)
            
            # Performance
            ideal_cycle_time = self.oee_calculator['ideal_cycle_time']
            actual_cycle_time = sensors.get('cycle_time', ideal_cycle_time * 1.2)
            performance_rate = ideal_cycle_time / actual_cycle_time if actual_cycle_time > 0 else 0.0
            
            # Quality
            good_parts = process_data.get('good_parts', 0)
            total_parts = process_data.get('total_parts', 1)
            quality_rate = good_parts / total_parts if total_parts > 0 else 0.0
            
            # Overall OEE
            oee = availability * performance_rate * quality_rate
            
            performance.update({
                'oee': oee,
                'availability': availability,
                'performance': performance_rate,
                'quality': quality_rate
            })
        
        # Energy efficiency
        power_consumed = sensors.get('power', 0)
        theoretical_power = self.process_parameters.get('theoretical_power', power_consumed)
        if theoretical_power > 0:
            performance['energy_efficiency'] = theoretical_power / max(0.1, power_consumed)
        
        # Throughput
        parts_per_hour = process_data.get('parts_per_hour', 0)
        performance['throughput'] = parts_per_hour
        
        return performance
    
    def _calculate_equipment_health(self) -> Dict[str, float]:
        """Calculate equipment health from components."""
        if not self.components:
            return {'overall_health': 1.0}
        
        component_healths = []
        for component in self.components.values():
            comp_health = component.current_state.health_indicators.get('overall_health', 1.0)
            component_healths.append(comp_health)
        
        overall_health = np.mean(component_healths)
        
        return {
            'overall_health': overall_health,
            'component_count': len(self.components),
            'healthy_components': len([h for h in component_healths if h > 0.8]),
            'degraded_components': len([h for h in component_healths if 0.5 < h <= 0.8]),
            'failing_components': len([h for h in component_healths if h <= 0.5])
        }
    
    async def _run_optimization_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run optimization simulation to find optimal parameters."""
        objectives = scenario.objectives
        parameters = scenario.parameters
        
        # Define optimization problem
        def objective_function(x):
            # x represents parameter values to optimize
            param_names = list(parameters.keys())
            param_dict = dict(zip(param_names, x))
            
            # Simulate equipment performance with these parameters
            simulated_oee = self._simulate_oee_with_parameters(param_dict)
            simulated_energy = self._simulate_energy_consumption(param_dict)
            
            # Multi-objective optimization (weighted sum)
            if 'maximize_oee' in objectives and 'minimize_energy' in objectives:
                return -(0.7 * simulated_oee - 0.3 * simulated_energy / 100)
            elif 'maximize_oee' in objectives:
                return -simulated_oee
            else:
                return simulated_energy
        
        # Define bounds for optimization variables
        bounds = []
        initial_guess = []
        for param_name, param_config in parameters.items():
            bounds.append((param_config.get('min', 0), param_config.get('max', 100)))
            initial_guess.append(param_config.get('current', 50))
        
        # Run optimization
        try:
            result = optimize.minimize(
                objective_function,
                initial_guess,
                bounds=bounds,
                method='L-BFGS-B'
            )
            
            optimal_params = dict(zip(parameters.keys(), result.x))
            
            # Evaluate performance at optimal point
            optimal_oee = self._simulate_oee_with_parameters(optimal_params)
            optimal_energy = self._simulate_energy_consumption(optimal_params)
            
            return {
                'optimization_success': result.success,
                'optimal_parameters': optimal_params,
                'optimization_iterations': result.nit,
                'performance_improvement': {
                    'oee': optimal_oee,
                    'energy_consumption': optimal_energy,
                    'improvement_percentage': ((optimal_oee - self.current_state.performance_metrics.get('oee', 0.7)) / max(0.01, self.current_state.performance_metrics.get('oee', 0.7))) * 100
                }
            }
        
        except Exception as e:
            return {'optimization_error': str(e)}
    
    async def _run_what_if_simulation(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run what-if scenario analysis."""
        what_if_parameters = scenario.parameters.get('what_if_changes', {})
        baseline_performance = self.get_performance_metrics()
        
        scenarios_results = []
        
        # Test each what-if scenario
        for scenario_name, changes in what_if_parameters.items():
            modified_params = self.process_parameters.copy()
            modified_params.update(changes)
            
            # Simulate performance with modified parameters
            simulated_oee = self._simulate_oee_with_parameters(modified_params)
            simulated_energy = self._simulate_energy_consumption(modified_params)
            simulated_quality = self._simulate_quality_rate(modified_params)
            
            scenarios_results.append({
                'scenario_name': scenario_name,
                'parameter_changes': changes,
                'predicted_performance': {
                    'oee': simulated_oee,
                    'energy_consumption': simulated_energy,
                    'quality_rate': simulated_quality
                },
                'performance_delta': {
                    'oee_change': simulated_oee - baseline_performance.get('oee', 0),
                    'energy_change': simulated_energy - baseline_performance.get('energy_efficiency', 1.0) * 100,
                    'quality_change': simulated_quality - baseline_performance.get('quality_rate', 0.95)
                }
            })
        
        # Rank scenarios by overall impact
        for result in scenarios_results:
            delta = result['performance_delta']
            # Weighted impact score
            impact_score = (
                0.5 * delta['oee_change'] +
                0.3 * (-delta['energy_change'] / 100) +  # Negative because lower energy is better
                0.2 * delta['quality_change']
            )
            result['impact_score'] = impact_score
        
        scenarios_results.sort(key=lambda x: x['impact_score'], reverse=True)
        
        return {
            'baseline_performance': baseline_performance,
            'scenarios': scenarios_results,
            'best_scenario': scenarios_results[0] if scenarios_results else None
        }
    
    async def _run_equipment_prediction(self, scenario: SimulationScenario) -> Dict[str, Any]:
        """Run predictive simulation for equipment performance."""
        time_horizon = scenario.time_horizon_hours
        time_points = np.linspace(0, time_horizon, int(time_horizon))
        
        # Predict key metrics over time
        current_oee = self.current_state.performance_metrics.get('oee', 0.8)
        current_health = self.current_state.health_indicators.get('overall_health', 1.0)
        
        # Simple degradation models (would be more sophisticated in practice)
        oee_predictions = []
        health_predictions = []
        energy_predictions = []
        
        for t in time_points:
            # OEE degradation due to wear and maintenance needs
            oee_degradation = 0.001 * t  # 0.1% per hour
            predicted_oee = max(0.0, current_oee - oee_degradation)
            oee_predictions.append(predicted_oee)
            
            # Health degradation
            health_degradation = 0.002 * t  # 0.2% per hour
            predicted_health = max(0.0, current_health - health_degradation)
            health_predictions.append(predicted_health)
            
            # Energy consumption increase due to degradation
            base_energy = 100  # kWh baseline
            energy_increase = 1.0 + 0.0001 * t  # Slight increase over time
            predicted_energy = base_energy * energy_increase
            energy_predictions.append(predicted_energy)
        
        # Identify critical points
        oee_critical_time = None
        health_critical_time = None
        
        for i, (oee, health) in enumerate(zip(oee_predictions, health_predictions)):
            if oee < 0.6 and oee_critical_time is None:  # 60% OEE threshold
                oee_critical_time = time_points[i]
            if health < 0.3 and health_critical_time is None:  # 30% health threshold
                health_critical_time = time_points[i]
        
        return {
            'time_points': time_points.tolist(),
            'oee_predictions': oee_predictions,
            'health_predictions': health_predictions,
            'energy_predictions': energy_predictions,
            'critical_points': {
                'oee_critical_time_hours': oee_critical_time,
                'health_critical_time_hours': health_critical_time
            },
            'maintenance_recommendations': self._generate_maintenance_recommendations(
                oee_critical_time, health_critical_time
            )
        }
    
    def _simulate_oee_with_parameters(self, parameters: Dict[str, Any]) -> float:
        """Simulate OEE with given parameters."""
        # Simple OEE model based on parameters
        base_oee = 0.8
        
        # Speed factor impact
        speed_factor = parameters.get('speed_factor', 1.0)
        speed_impact = min(0.1, (speed_factor - 1.0) * 0.05)  # Higher speed reduces OEE
        
        # Temperature impact
        temperature = parameters.get('temperature', 75)
        temp_impact = max(-0.1, (temperature - 75) / 100 * -0.1)  # Higher temp reduces OEE
        
        # Pressure impact
        pressure = parameters.get('pressure', 5.0)
        pressure_impact = min(0.05, (pressure - 5.0) / 10 * 0.05)  # Optimal pressure improves OEE
        
        simulated_oee = base_oee - speed_impact + temp_impact + pressure_impact
        return max(0.0, min(1.0, simulated_oee))
    
    def _simulate_energy_consumption(self, parameters: Dict[str, Any]) -> float:
        """Simulate energy consumption with given parameters."""
        base_consumption = 100  # kWh
        
        # Speed impact on energy
        speed_factor = parameters.get('speed_factor', 1.0)
        energy_consumption = base_consumption * (speed_factor ** 1.5)  # Non-linear relationship
        
        # Temperature impact
        temperature = parameters.get('temperature', 75)
        if temperature > 80:
            energy_consumption *= 1.1  # Cooling overhead
        
        return energy_consumption
    
    def _simulate_quality_rate(self, parameters: Dict[str, Any]) -> float:
        """Simulate quality rate with given parameters."""
        base_quality = 0.95
        
        # Temperature impact on quality
        temperature = parameters.get('temperature', 75)
        if temperature < 60 or temperature > 85:
            quality_penalty = 0.02  # 2% quality loss
        else:
            quality_penalty = 0.0
        
        # Speed impact on quality
        speed_factor = parameters.get('speed_factor', 1.0)
        if speed_factor > 1.2:
            quality_penalty += (speed_factor - 1.2) * 0.05
        
        return max(0.0, base_quality - quality_penalty)
    
    def _generate_maintenance_recommendations(
        self, 
        oee_critical_time: Optional[float], 
        health_critical_time: Optional[float]
    ) -> List[Dict[str, Any]]:
        """Generate maintenance recommendations based on predictions."""
        recommendations = []
        
        if health_critical_time and health_critical_time < 168:  # Within a week
            recommendations.append({
                'type': 'preventive_maintenance',
                'urgency': 'high',
                'recommended_time_hours': max(0, health_critical_time - 24),  # 24 hours before critical
                'description': 'Schedule preventive maintenance to avoid health degradation',
                'estimated_cost': 5000,
                'estimated_downtime_hours': 8
            })
        
        if oee_critical_time and oee_critical_time < 72:  # Within 3 days
            recommendations.append({
                'type': 'performance_optimization',
                'urgency': 'medium',
                'recommended_time_hours': max(0, oee_critical_time - 12),
                'description': 'Optimize process parameters to maintain OEE performance',
                'estimated_cost': 1000,
                'estimated_downtime_hours': 2
            })
        
        return recommendations
    
    def _add_to_history(self, state: AssetState):
        """Add state to history with size limit."""
        self.state_history.append(state)
        if len(self.state_history) > self.max_history_length:
            self.state_history.pop(0)


class DigitalTwinEngine:
    """
    Main Digital Twin Engine managing multiple digital twins and coordinating simulations.
    """
    
    def __init__(self):
        self.twins: Dict[str, BaseDigitalTwin] = {}
        self.twin_registry: Dict[TwinType, type] = {
            TwinType.COMPONENT: ComponentTwin,
            TwinType.EQUIPMENT: EquipmentTwin
        }
        
        # Simulation management
        self.active_simulations: Dict[str, asyncio.Task] = {}
        self.simulation_results_cache: Dict[str, Dict[str, Any]] = {}
        
        # Synchronization management
        self.sync_tasks: Dict[str, asyncio.Task] = {}
        
        # Performance monitoring
        self.engine_metrics = {
            'twins_created': 0,
            'simulations_run': 0,
            'sync_operations': 0,
            'last_performance_check': datetime.utcnow()
        }
        
        logger.info("Digital Twin Engine initialized")
    
    async def create_digital_twin(
        self,
        twin_id: str,
        twin_name: str,
        twin_type: TwinType,
        configuration: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a new digital twin instance.
        
        Args:
            twin_id: Unique identifier for the twin
            twin_name: Human-readable name
            twin_type: Type of digital twin
            configuration: Twin configuration and parameters
            
        Returns:
            Creation result and twin status
        """
        try:
            if twin_id in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} already exists'
                }
            
            # Create appropriate twin type
            twin_class = self.twin_registry.get(twin_type)
            if not twin_class:
                return {
                    'success': False,
                    'error': f'Unsupported twin type: {twin_type}'
                }
            
            # Create twin instance
            if twin_type == TwinType.COMPONENT:
                twin = twin_class(
                    twin_id=twin_id,
                    twin_name=twin_name,
                    component_type=configuration.get('component_type', 'generic')
                )
            elif twin_type == TwinType.EQUIPMENT:
                twin = twin_class(
                    twin_id=twin_id,
                    twin_name=twin_name,
                    equipment_type=configuration.get('equipment_type', 'generic')
                )
            else:
                twin = twin_class(twin_id, twin_name, twin_type)
            
            # Initialize the twin
            initialization_success = await twin.initialize_models(configuration)
            if not initialization_success:
                return {
                    'success': False,
                    'error': f'Failed to initialize twin {twin_id}'
                }
            
            # Add to registry
            self.twins[twin_id] = twin
            self.engine_metrics['twins_created'] += 1
            
            # Start synchronization if configured
            sync_config = configuration.get('synchronization', {})
            if sync_config.get('auto_sync_enabled', False):
                await self._start_twin_synchronization(twin_id, sync_config)
            
            logger.info(f"Digital twin {twin_id} created successfully")
            
            return {
                'success': True,
                'twin_id': twin_id,
                'twin_type': twin_type.value,
                'state': twin.state.value,
                'created_at': twin.created_at,
                'configuration_applied': True,
                'sync_enabled': sync_config.get('auto_sync_enabled', False)
            }
            
        except Exception as e:
            logger.error(f"Failed to create digital twin {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_twin_state(self, twin_id: str) -> Dict[str, Any]:
        """
        Get current state of a digital twin.
        
        Args:
            twin_id: Twin identifier
            
        Returns:
            Current twin state and metrics
        """
        try:
            if twin_id not in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not found'
                }
            
            twin = self.twins[twin_id]
            current_state = twin.current_state
            
            return {
                'success': True,
                'twin_id': twin_id,
                'twin_name': twin.twin_name,
                'twin_type': twin.twin_type.value,
                'state': twin.state.value,
                'last_updated': twin.last_updated,
                'last_sync': twin.last_sync,
                'current_asset_state': {
                    'operational_state': current_state.operational_state,
                    'timestamp': current_state.timestamp,
                    'parameters': current_state.parameters,
                    'sensors': current_state.sensors,
                    'performance_metrics': current_state.performance_metrics,
                    'health_indicators': current_state.health_indicators,
                    'quality_score': current_state.quality_score,
                    'confidence': current_state.confidence
                },
                'performance_metrics': twin.get_performance_metrics(),
                'sync_enabled': twin.sync_enabled,
                'physics_models': list(twin.physics_models.keys()),
                'state_history_length': len(twin.state_history)
            }
            
        except Exception as e:
            logger.error(f"Failed to get twin state for {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def run_simulation(
        self,
        twin_id: str,
        scenario: SimulationScenario
    ) -> Dict[str, Any]:
        """
        Run simulation scenario on digital twin.
        
        Args:
            twin_id: Twin identifier
            scenario: Simulation scenario configuration
            
        Returns:
            Simulation results
        """
        try:
            if twin_id not in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not found'
                }
            
            twin = self.twins[twin_id]
            
            # Check if twin is in suitable state for simulation
            if twin.state not in [TwinState.ACTIVE, TwinState.SIMULATION]:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not ready for simulation (state: {twin.state.value})'
                }
            
            # Set twin to simulation state
            previous_state = twin.state
            twin.state = TwinState.SIMULATION
            
            try:
                # Run the simulation
                simulation_results = await twin.run_simulation(scenario)
                self.engine_metrics['simulations_run'] += 1
                
                # Cache results
                self.simulation_results_cache[scenario.scenario_id] = simulation_results
                
                # Restore previous state
                twin.state = previous_state
                
                return {
                    'success': True,
                    'twin_id': twin_id,
                    'simulation_results': simulation_results
                }
                
            except Exception as e:
                # Restore previous state on error
                twin.state = previous_state
                raise e
            
        except Exception as e:
            logger.error(f"Simulation failed for twin {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_twin_with_physical_asset(
        self,
        twin_id: str,
        data_sources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synchronize digital twin with physical asset data.
        
        Args:
            twin_id: Twin identifier
            data_sources: Physical asset data from various sources
            
        Returns:
            Synchronization result
        """
        try:
            if twin_id not in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not found'
                }
            
            twin = self.twins[twin_id]
            sync_start_time = time.time()
            
            # Perform synchronization
            sync_result = await twin.sync_with_physical_asset(data_sources)
            
            sync_duration = time.time() - sync_start_time
            self.engine_metrics['sync_operations'] += 1
            
            if sync_result:
                return {
                    'success': True,
                    'twin_id': twin_id,
                    'sync_timestamp': twin.last_sync,
                    'sync_duration_seconds': sync_duration,
                    'data_sources_processed': list(data_sources.keys()),
                    'current_state': {
                        'operational_state': twin.current_state.operational_state,
                        'quality_score': twin.current_state.quality_score,
                        'confidence': twin.current_state.confidence
                    }
                }
            else:
                return {
                    'success': False,
                    'error': 'Synchronization failed',
                    'twin_id': twin_id
                }
            
        except Exception as e:
            logger.error(f"Synchronization failed for twin {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_insights(self, twin_id: str) -> Dict[str, Any]:
        """
        Get analytics insights for a digital twin.
        
        Args:
            twin_id: Twin identifier
            
        Returns:
            Insights and analytics results
        """
        try:
            if twin_id not in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not found'
                }
            
            twin = self.twins[twin_id]
            
            # Performance insights
            performance_metrics = twin.get_performance_metrics()
            
            # Health analysis
            current_health = twin.current_state.health_indicators
            
            # Trend analysis from state history
            trends = self._analyze_trends(twin.state_history)
            
            # Anomaly detection
            anomalies = self._detect_anomalies(twin.state_history)
            
            # Optimization recommendations
            recommendations = self._generate_optimization_recommendations(twin)
            
            return {
                'success': True,
                'twin_id': twin_id,
                'insights_timestamp': datetime.utcnow(),
                'performance_insights': {
                    'current_metrics': performance_metrics,
                    'performance_grade': self._calculate_performance_grade(performance_metrics),
                    'improvement_potential': self._calculate_improvement_potential(performance_metrics)
                },
                'health_insights': {
                    'current_health': current_health,
                    'health_trend': trends.get('health_trend', 'stable'),
                    'predicted_degradation': self._predict_health_degradation(twin.state_history)
                },
                'trend_analysis': trends,
                'anomaly_detection': anomalies,
                'optimization_recommendations': recommendations,
                'predictive_maintenance': self._generate_maintenance_insights(twin)
            }
            
        except Exception as e:
            logger.error(f"Failed to generate insights for twin {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def optimize_parameters(
        self,
        twin_id: str,
        objectives: List[str],
        constraints: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Optimize twin parameters for specified objectives.
        
        Args:
            twin_id: Twin identifier
            objectives: List of optimization objectives
            constraints: Optional constraints for optimization
            
        Returns:
            Optimization results and recommended parameters
        """
        try:
            if twin_id not in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not found'
                }
            
            twin = self.twins[twin_id]
            
            # Create optimization scenario
            scenario = SimulationScenario(
                scenario_id=f"optimization_{twin_id}_{int(time.time())}",
                scenario_name="Parameter Optimization",
                simulation_type=SimulationType.OPTIMIZATION,
                time_horizon_hours=24.0,
                parameters=constraints or {},
                objectives=objectives
            )
            
            # Run optimization simulation
            optimization_results = await twin.run_simulation(scenario)
            
            return {
                'success': True,
                'twin_id': twin_id,
                'optimization_results': optimization_results,
                'objectives': objectives,
                'constraints_applied': constraints or {},
                'timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Parameter optimization failed for twin {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_predictions(
        self,
        twin_id: str,
        time_horizon_hours: float = 168.0,  # 1 week default
        prediction_types: List[str] = None
    ) -> Dict[str, Any]:
        """
        Get predictive analytics for digital twin.
        
        Args:
            twin_id: Twin identifier
            time_horizon_hours: Prediction time horizon
            prediction_types: Types of predictions to generate
            
        Returns:
            Predictive analytics results
        """
        try:
            if twin_id not in self.twins:
                return {
                    'success': False,
                    'error': f'Twin {twin_id} not found'
                }
            
            twin = self.twins[twin_id]
            
            if not prediction_types:
                prediction_types = ['performance', 'health', 'maintenance']
            
            predictions = {}
            
            # Performance predictions
            if 'performance' in prediction_types:
                performance_scenario = SimulationScenario(
                    scenario_id=f"prediction_performance_{twin_id}_{int(time.time())}",
                    scenario_name="Performance Prediction",
                    simulation_type=SimulationType.PREDICTIVE,
                    time_horizon_hours=time_horizon_hours
                )
                performance_pred = await twin.run_simulation(performance_scenario)
                predictions['performance'] = performance_pred
            
            # Health predictions
            if 'health' in prediction_types:
                predictions['health'] = self._predict_health_degradation(
                    twin.state_history,
                    time_horizon_hours
                )
            
            # Maintenance predictions
            if 'maintenance' in prediction_types:
                maintenance_scenario = SimulationScenario(
                    scenario_id=f"prediction_maintenance_{twin_id}_{int(time.time())}",
                    scenario_name="Maintenance Prediction",
                    simulation_type=SimulationType.MAINTENANCE_PLANNING,
                    time_horizon_hours=time_horizon_hours
                )
                maintenance_pred = await twin.run_simulation(maintenance_scenario)
                predictions['maintenance'] = maintenance_pred
            
            return {
                'success': True,
                'twin_id': twin_id,
                'prediction_horizon_hours': time_horizon_hours,
                'predictions': predictions,
                'generated_at': datetime.utcnow(),
                'confidence_scores': self._calculate_prediction_confidence(predictions)
            }
            
        except Exception as e:
            logger.error(f"Prediction generation failed for twin {twin_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_engine_metrics(self) -> Dict[str, Any]:
        """Get digital twin engine performance metrics."""
        uptime = (datetime.utcnow() - self.engine_metrics['last_performance_check']).total_seconds()
        
        return {
            'total_twins': len(self.twins),
            'active_twins': len([t for t in self.twins.values() if t.state == TwinState.ACTIVE]),
            'twins_by_type': {
                twin_type.value: len([t for t in self.twins.values() if t.twin_type == twin_type])
                for twin_type in TwinType
            },
            'twins_created': self.engine_metrics['twins_created'],
            'simulations_run': self.engine_metrics['simulations_run'],
            'sync_operations': self.engine_metrics['sync_operations'],
            'active_simulations': len(self.active_simulations),
            'cached_simulation_results': len(self.simulation_results_cache),
            'engine_uptime_hours': uptime / 3600,
            'average_simulation_rate': self.engine_metrics['simulations_run'] / max(1, uptime / 3600),
            'memory_usage_estimate_mb': len(self.twins) * 10 + len(self.simulation_results_cache) * 2  # Rough estimate
        }
    
    # Helper methods
    
    async def _start_twin_synchronization(self, twin_id: str, sync_config: Dict[str, Any]):
        """Start automatic synchronization task for twin."""
        sync_interval = sync_config.get('interval_seconds', 30)
        data_sources = sync_config.get('data_sources', {})
        
        async def sync_loop():
            while twin_id in self.twins:
                try:
                    await asyncio.sleep(sync_interval)
                    await self.sync_twin_with_physical_asset(twin_id, data_sources)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Auto-sync error for twin {twin_id}: {e}")
        
        self.sync_tasks[twin_id] = asyncio.create_task(sync_loop())
    
    def _analyze_trends(self, state_history: List[AssetState]) -> Dict[str, Any]:
        """Analyze trends in asset state history."""
        if len(state_history) < 10:
            return {'error': 'Insufficient data for trend analysis'}
        
        # Extract time series data
        timestamps = [state.timestamp for state in state_history[-50:]]
        health_scores = [state.health_indicators.get('overall_health', 1.0) for state in state_history[-50:]]
        quality_scores = [state.quality_score for state in state_history[-50:]]
        
        # Calculate trends
        health_trend = 'stable'
        if len(health_scores) >= 2:
            health_slope = (health_scores[-1] - health_scores[0]) / len(health_scores)
            if health_slope < -0.01:
                health_trend = 'declining'
            elif health_slope > 0.01:
                health_trend = 'improving'
        
        quality_trend = 'stable'
        if len(quality_scores) >= 2:
            quality_slope = (quality_scores[-1] - quality_scores[0]) / len(quality_scores)
            if quality_slope < -0.01:
                quality_trend = 'declining'
            elif quality_slope > 0.01:
                quality_trend = 'improving'
        
        return {
            'health_trend': health_trend,
            'quality_trend': quality_trend,
            'data_points_analyzed': len(state_history),
            'analysis_period_hours': (timestamps[-1] - timestamps[0]).total_seconds() / 3600 if len(timestamps) > 1 else 0
        }
    
    def _detect_anomalies(self, state_history: List[AssetState]) -> Dict[str, Any]:
        """Detect anomalies in state history."""
        if len(state_history) < 20:
            return {'anomalies_detected': 0, 'error': 'Insufficient data for anomaly detection'}
        
        # Extract features for anomaly detection
        features = []
        for state in state_history[-100:]:
            feature_vector = [
                state.health_indicators.get('overall_health', 1.0),
                state.quality_score,
                state.performance_metrics.get('efficiency', 1.0) if state.performance_metrics else 1.0,
                len(state.sensors)
            ]
            features.append(feature_vector)
        
        if len(features) < 10:
            return {'anomalies_detected': 0}
        
        # Simple anomaly detection using statistical methods
        features_array = np.array(features)
        
        anomalies = []
        for i, feature_vector in enumerate(features_array):
            # Z-score based anomaly detection
            for j, value in enumerate(feature_vector):
                column_values = features_array[:, j]
                mean_val = np.mean(column_values)
                std_val = np.std(column_values)
                
                if std_val > 0:
                    z_score = abs((value - mean_val) / std_val)
                    if z_score > 3.0:  # 3-sigma rule
                        anomalies.append({
                            'timestamp': state_history[-100 + i].timestamp,
                            'feature_index': j,
                            'z_score': z_score,
                            'value': value,
                            'expected_range': [mean_val - 2 * std_val, mean_val + 2 * std_val]
                        })
        
        return {
            'anomalies_detected': len(anomalies),
            'anomalies': anomalies[-10:],  # Return last 10 anomalies
            'analysis_period': len(features)
        }
    
    def _generate_optimization_recommendations(self, twin: BaseDigitalTwin) -> List[Dict[str, Any]]:
        """Generate optimization recommendations for twin."""
        recommendations = []
        
        performance_metrics = twin.get_performance_metrics()
        
        # OEE optimization
        if 'oee' in performance_metrics and performance_metrics['oee'] < 0.8:
            recommendations.append({
                'type': 'performance_optimization',
                'priority': 'high',
                'title': 'Improve Overall Equipment Effectiveness',
                'description': f"Current OEE is {performance_metrics['oee']:.2%}. Target is 85%.",
                'actions': [
                    'Reduce unplanned downtime',
                    'Optimize cycle times',
                    'Improve quality rates'
                ],
                'estimated_impact': 'Up to 15% OEE improvement',
                'implementation_effort': 'medium'
            })
        
        # Energy efficiency optimization
        if 'energy_efficiency' in performance_metrics and performance_metrics['energy_efficiency'] < 0.9:
            recommendations.append({
                'type': 'energy_optimization',
                'priority': 'medium',
                'title': 'Improve Energy Efficiency',
                'description': f"Energy efficiency is {performance_metrics['energy_efficiency']:.2%}. Consider optimization.",
                'actions': [
                    'Optimize operating parameters',
                    'Implement variable speed drives',
                    'Improve maintenance schedules'
                ],
                'estimated_impact': 'Up to 10% energy savings',
                'implementation_effort': 'low'
            })
        
        # Health-based recommendations
        health_score = twin.current_state.health_indicators.get('overall_health', 1.0)
        if health_score < 0.7:
            recommendations.append({
                'type': 'maintenance_optimization',
                'priority': 'high',
                'title': 'Address Equipment Health Issues',
                'description': f"Equipment health is {health_score:.2%}. Preventive action needed.",
                'actions': [
                    'Schedule immediate inspection',
                    'Replace worn components',
                    'Adjust operating parameters'
                ],
                'estimated_impact': 'Prevent unplanned downtime',
                'implementation_effort': 'high'
            })
        
        return recommendations
    
    def _generate_maintenance_insights(self, twin: BaseDigitalTwin) -> Dict[str, Any]:
        """Generate maintenance insights for twin."""
        health_score = twin.current_state.health_indicators.get('overall_health', 1.0)
        
        # Estimate remaining useful life
        if len(twin.state_history) >= 10:
            recent_health = [s.health_indicators.get('overall_health', 1.0) for s in twin.state_history[-10:]]
            health_trend = np.mean(np.diff(recent_health)) if len(recent_health) > 1 else 0
            
            if health_trend < 0:
                # Estimate time to failure threshold (20% health)
                time_to_failure = (health_score - 0.2) / abs(health_trend) if health_trend != 0 else float('inf')
                time_to_failure = min(time_to_failure, 8760)  # Cap at 1 year
            else:
                time_to_failure = float('inf')
        else:
            time_to_failure = float('inf')
        
        # Maintenance strategy recommendation
        if health_score < 0.3:
            strategy = 'immediate_corrective'
        elif health_score < 0.7:
            strategy = 'scheduled_preventive'
        else:
            strategy = 'condition_based'
        
        return {
            'current_health_score': health_score,
            'estimated_remaining_life_hours': time_to_failure if time_to_failure != float('inf') else None,
            'recommended_strategy': strategy,
            'next_maintenance_window': self._calculate_next_maintenance_window(health_score),
            'estimated_maintenance_cost': self._estimate_maintenance_cost(strategy),
            'failure_risk_level': 'high' if health_score < 0.4 else 'medium' if health_score < 0.7 else 'low'
        }
    
    def _calculate_performance_grade(self, metrics: Dict[str, float]) -> str:
        """Calculate overall performance grade."""
        if not metrics:
            return 'Unknown'
        
        # Weighted average of key metrics
        weights = {
            'oee': 0.4,
            'availability': 0.2,
            'energy_efficiency': 0.2,
            'quality_rate': 0.2
        }
        
        weighted_score = 0
        total_weight = 0
        
        for metric, weight in weights.items():
            if metric in metrics:
                weighted_score += metrics[metric] * weight
                total_weight += weight
        
        if total_weight == 0:
            return 'Unknown'
        
        final_score = weighted_score / total_weight
        
        if final_score >= 0.9:
            return 'A'
        elif final_score >= 0.8:
            return 'B'
        elif final_score >= 0.7:
            return 'C'
        elif final_score >= 0.6:
            return 'D'
        else:
            return 'F'
    
    def _calculate_improvement_potential(self, metrics: Dict[str, float]) -> Dict[str, float]:
        """Calculate improvement potential for each metric."""
        potential = {}
        
        for metric, value in metrics.items():
            if metric in ['oee', 'availability', 'energy_efficiency', 'quality_rate']:
                # Theoretical maximum improvement
                max_realistic = 0.95  # 95% is realistic maximum for most metrics
                current_value = value
                potential[metric] = max(0, (max_realistic - current_value) / max_realistic)
        
        return potential
    
    def _predict_health_degradation(
        self,
        state_history: List[AssetState],
        time_horizon_hours: float = 168.0
    ) -> Dict[str, Any]:
        """Predict health degradation over time horizon."""
        if len(state_history) < 5:
            return {'error': 'Insufficient data for health prediction'}
        
        # Extract health scores over time
        recent_states = state_history[-20:] if len(state_history) >= 20 else state_history
        health_scores = [s.health_indicators.get('overall_health', 1.0) for s in recent_states]
        
        # Simple linear regression for trend
        if len(health_scores) >= 2:
            x = np.arange(len(health_scores))
            slope, intercept = np.polyfit(x, health_scores, 1)
            
            # Project into future
            current_health = health_scores[-1]
            future_steps = int(time_horizon_hours / 24)  # Assume daily data points
            future_health = current_health + slope * future_steps
            future_health = max(0, min(1.0, future_health))
            
            # Estimate failure time if degrading
            failure_time = None
            if slope < 0:
                steps_to_failure = (0.2 - current_health) / slope  # 20% failure threshold
                if steps_to_failure > 0:
                    failure_time = steps_to_failure * 24  # Convert to hours
            
            return {
                'current_health': current_health,
                'predicted_health': future_health,
                'health_trend_slope': slope,
                'time_to_failure_hours': failure_time,
                'prediction_confidence': min(0.9, len(health_scores) / 20)
            }
        
        return {'error': 'Cannot calculate health trend'}
    
    def _calculate_prediction_confidence(self, predictions: Dict[str, Any]) -> Dict[str, float]:
        """Calculate confidence scores for predictions."""
        confidence_scores = {}
        
        for pred_type, pred_data in predictions.items():
            if isinstance(pred_data, dict):
                # Base confidence on data availability and model complexity
                base_confidence = 0.7
                
                # Adjust based on prediction type
                if pred_type == 'performance':
                    confidence_scores[pred_type] = base_confidence + 0.1
                elif pred_type == 'health':
                    confidence_scores[pred_type] = base_confidence
                elif pred_type == 'maintenance':
                    confidence_scores[pred_type] = base_confidence - 0.1
                else:
                    confidence_scores[pred_type] = base_confidence
        
        return confidence_scores
    
    def _calculate_next_maintenance_window(self, health_score: float) -> Dict[str, Any]:
        """Calculate recommended maintenance window."""
        if health_score < 0.3:
            return {
                'urgency': 'immediate',
                'recommended_start': datetime.utcnow(),
                'recommended_end': datetime.utcnow() + timedelta(hours=8),
                'max_delay_hours': 0
            }
        elif health_score < 0.7:
            return {
                'urgency': 'scheduled',
                'recommended_start': datetime.utcnow() + timedelta(days=1),
                'recommended_end': datetime.utcnow() + timedelta(days=1, hours=8),
                'max_delay_hours': 72
            }
        else:
            return {
                'urgency': 'planned',
                'recommended_start': datetime.utcnow() + timedelta(days=30),
                'recommended_end': datetime.utcnow() + timedelta(days=30, hours=8),
                'max_delay_hours': 720  # 30 days
            }
    
    def _estimate_maintenance_cost(self, strategy: str) -> Dict[str, float]:
        """Estimate maintenance costs by strategy."""
        cost_estimates = {
            'immediate_corrective': {
                'labor_hours': 16,
                'labor_cost_per_hour': 75,
                'parts_cost': 5000,
                'downtime_cost_per_hour': 500,
                'downtime_hours': 12
            },
            'scheduled_preventive': {
                'labor_hours': 8,
                'labor_cost_per_hour': 65,
                'parts_cost': 2000,
                'downtime_cost_per_hour': 500,
                'downtime_hours': 4
            },
            'condition_based': {
                'labor_hours': 4,
                'labor_cost_per_hour': 65,
                'parts_cost': 500,
                'downtime_cost_per_hour': 500,
                'downtime_hours': 2
            }
        }
        
        if strategy not in cost_estimates:
            strategy = 'scheduled_preventive'
        
        costs = cost_estimates[strategy]
        
        total_cost = (
            costs['labor_hours'] * costs['labor_cost_per_hour'] +
            costs['parts_cost'] +
            costs['downtime_hours'] * costs['downtime_cost_per_hour']
        )
        
        return {
            'total_estimated_cost': total_cost,
            'breakdown': costs
        }