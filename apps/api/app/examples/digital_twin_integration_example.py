"""
Digital Twin Framework Integration Example
==========================================

Comprehensive example demonstrating how to use the Digital Twin Framework
to create, manage, and analyze digital twins for manufacturing assets.

This example shows:
- Creating digital twins for different asset types
- Integrating with IoT Gateway and MES systems
- Running simulations and analytics
- Real-time monitoring and alerts
- Business impact analysis
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Import digital twin components
from app.ml.digital_twin_engine import DigitalTwinEngine, TwinType, SimulationScenario, SimulationType
from app.services.digital_twin_service import DigitalTwinService
from app.services.simulation_engine import SimulationEngine
from app.services.twin_analytics_service import TwinAnalyticsService, AnalyticsRequest, AnalyticsType
from app.schemas.digital_twin import (
    DigitalTwinCreate, ComponentConfiguration, EquipmentConfiguration,
    SynchronizationConfig, IoTIntegrationConfig
)


class DigitalTwinDemo:
    """Demonstration of the Digital Twin Framework capabilities."""
    
    def __init__(self):
        # Initialize services
        self.twin_engine = DigitalTwinEngine()
        self.simulation_engine = SimulationEngine()
        self.analytics_service = TwinAnalyticsService()
        
        # Demo data
        self.demo_twins = {}
        self.demo_data = self._generate_demo_data()
    
    async def run_complete_demo(self):
        """Run complete digital twin demonstration."""
        print("=== Digital Twin Framework Demonstration ===\n")
        
        try:
            # Step 1: Create digital twins
            print("1. Creating Digital Twins...")
            await self._create_demo_twins()
            
            # Step 2: Demonstrate synchronization
            print("\n2. Demonstrating Data Synchronization...")
            await self._demonstrate_synchronization()
            
            # Step 3: Run simulations
            print("\n3. Running Simulations...")
            await self._demonstrate_simulations()
            
            # Step 4: Generate analytics
            print("\n4. Generating Analytics and Insights...")
            await self._demonstrate_analytics()
            
            # Step 5: Business impact analysis
            print("\n5. Business Impact Analysis...")
            await self._demonstrate_business_impact()
            
            # Step 6: Real-time monitoring
            print("\n6. Real-time Monitoring and Alerts...")
            await self._demonstrate_real_time_monitoring()
            
            print("\n=== Demo Completed Successfully ===")
            
        except Exception as e:
            print(f"Demo failed: {e}")
            raise
    
    async def _create_demo_twins(self):
        """Create demonstration digital twins."""
        
        # Create a motor component twin
        motor_config = ComponentConfiguration(
            component_type="motor",
            specifications={
                "rated_power": 10.0,  # kW
                "rated_voltage": 380,  # V
                "rated_current": 20.0,  # A
                "rated_speed": 1800,  # RPM
                "efficiency": 0.92,
                "temperature_limit": 85,  # °C
                "vibration_limit": 2.5  # mm/s
            },
            failure_modes=[
                {
                    "mode": "bearing_failure",
                    "probability": 0.3,
                    "indicators": ["vibration", "temperature"],
                    "mtbf_hours": 8760
                },
                {
                    "mode": "winding_failure", 
                    "probability": 0.4,
                    "indicators": ["temperature", "current"],
                    "mtbf_hours": 12000
                }
            ],
            operating_limits={
                "max_temperature": 85,
                "max_vibration": 2.5,
                "max_current": 25
            }
        )
        
        motor_twin_result = await self.twin_engine.create_digital_twin(
            twin_id="motor_001",
            twin_name="Production Line Motor #1",
            twin_type=TwinType.COMPONENT,
            configuration=motor_config.dict()
        )
        
        print(f"✓ Created motor twin: {motor_twin_result['twin_id']}")
        self.demo_twins['motor'] = motor_twin_result
        
        # Create a pump equipment twin
        pump_config = EquipmentConfiguration(
            equipment_type="centrifugal_pump",
            components={
                "motor": motor_config,
                "impeller": ComponentConfiguration(
                    component_type="impeller",
                    specifications={
                        "diameter": 0.3,  # m
                        "design_flow": 100,  # L/min
                        "design_head": 50,  # m
                        "efficiency": 0.75
                    }
                )
            },
            process_parameters={
                "design_flow_rate": 100,
                "design_pressure": 5.0,
                "fluid_type": "water",
                "operating_temperature": 25
            },
            performance_targets={
                "oee": 85.0,
                "availability": 90.0,
                "energy_efficiency": 80.0
            }
        )
        
        pump_twin_result = await self.twin_engine.create_digital_twin(
            twin_id="pump_001", 
            twin_name="Cooling System Pump #1",
            twin_type=TwinType.EQUIPMENT,
            configuration=pump_config.dict()
        )
        
        print(f"✓ Created pump twin: {pump_twin_result['twin_id']}")
        self.demo_twins['pump'] = pump_twin_result
    
    async def _demonstrate_synchronization(self):
        """Demonstrate data synchronization capabilities."""
        
        for twin_name, twin_result in self.demo_twins.items():
            twin_id = twin_result['twin_id']
            
            # Simulate IoT data
            iot_data = self._generate_iot_data(twin_name)
            
            # Synchronize twin
            sync_result = await self.twin_engine.sync_twin_with_physical_asset(
                twin_id, iot_data
            )
            
            if sync_result['success']:
                print(f"✓ Synchronized {twin_name} twin with IoT data")
                print(f"  - Data sources: {sync_result['data_sources_processed']}")
                print(f"  - Sync duration: {sync_result['sync_duration_seconds']:.2f}s")
            else:
                print(f"✗ Failed to sync {twin_name} twin")
    
    async def _demonstrate_simulations(self):
        """Demonstrate simulation capabilities."""
        
        # Predictive simulation for motor
        motor_id = self.demo_twins['motor']['twin_id']
        
        predictive_scenario = SimulationScenario(
            scenario_id="motor_prediction_001",
            scenario_name="Motor Health Prediction",
            simulation_type=SimulationType.PREDICTIVE,
            time_horizon_hours=168.0,  # 1 week
            parameters={
                "load_factor": 0.8,
                "operating_hours_per_day": 16
            }
        )
        
        motor_prediction = await self.twin_engine.run_simulation(
            motor_id, predictive_scenario
        )
        
        if motor_prediction['success']:
            results = motor_prediction['simulation_results']
            print(f"✓ Motor predictive simulation completed")
            
            if 'remaining_useful_life_hours' in results:
                rul = results['remaining_useful_life_hours']
                print(f"  - Remaining useful life: {rul:.1f} hours")
            
            if 'health_curve' in results:
                final_health = results['health_curve'][-1]
                print(f"  - Predicted health after 1 week: {final_health:.2f}")
        
        # Optimization simulation for pump
        pump_id = self.demo_twins['pump']['twin_id']
        
        optimization_scenario = SimulationScenario(
            scenario_id="pump_optimization_001",
            scenario_name="Pump Energy Optimization",
            simulation_type=SimulationType.OPTIMIZATION,
            time_horizon_hours=24.0,
            parameters={
                "flow_rate": {"min": 80, "max": 120, "current": 100},
                "speed_factor": {"min": 0.8, "max": 1.2, "current": 1.0},
                "pressure_setpoint": {"min": 4.0, "max": 6.0, "current": 5.0}
            },
            objectives=["minimize_energy", "maximize_efficiency"]
        )
        
        pump_optimization = await self.twin_engine.run_simulation(
            pump_id, optimization_scenario
        )
        
        if pump_optimization['success']:
            results = pump_optimization['simulation_results']
            print(f"✓ Pump optimization simulation completed")
            
            if 'optimal_parameters' in results:
                optimal_params = results['optimal_parameters']
                print(f"  - Optimal flow rate: {optimal_params.get('flow_rate', 0):.1f} L/min")
                print(f"  - Optimal speed factor: {optimal_params.get('speed_factor', 1.0):.2f}")
            
            if 'performance_improvement' in results:
                improvement = results['performance_improvement']
                energy_savings = improvement.get('improvement_percentage', 0)
                print(f"  - Energy savings potential: {energy_savings:.1f}%")
    
    async def _demonstrate_analytics(self):
        """Demonstrate analytics capabilities."""
        
        for twin_name, twin_result in self.demo_twins.items():
            twin_id = twin_result['twin_id']
            
            # Get current twin data
            twin_state = await self.twin_engine.get_twin_state(twin_id)
            if not twin_state['success']:
                continue
            
            # Generate historical data for analytics
            historical_data = self._generate_historical_data(twin_name, days=30)
            
            # Create analytics request
            analytics_request = AnalyticsRequest(
                twin_id=twin_id,
                analytics_types=[
                    AnalyticsType.PERFORMANCE,
                    AnalyticsType.ANOMALY,
                    AnalyticsType.ENERGY,
                    AnalyticsType.PREDICTIVE
                ],
                time_range_start=datetime.utcnow() - timedelta(days=7),
                time_range_end=datetime.utcnow(),
                include_predictions=True,
                include_recommendations=True
            )
            
            # Run comprehensive analytics
            analytics_result = await self.analytics_service.run_comprehensive_analytics(
                analytics_request, 
                twin_state['current_asset_state'],
                historical_data
            )
            
            print(f"✓ Analytics completed for {twin_name} twin")
            
            # Performance analytics
            if 'performance' in analytics_result['results']:
                perf_data = analytics_result['results']['performance']
                if 'overall_performance_score' in perf_data:
                    score = perf_data['overall_performance_score']
                    grade = perf_data.get('performance_grade', 'N/A')
                    print(f"  - Performance score: {score:.1f}% (Grade: {grade})")
            
            # Anomaly detection
            if 'anomaly' in analytics_result['results']:
                anomaly_data = analytics_result['results']['anomaly']
                anomaly_count = len(anomaly_data.get('current_anomalies', []))
                print(f"  - Anomalies detected: {anomaly_count}")
            
            # Energy analysis
            if 'energy' in analytics_result['results']:
                energy_data = analytics_result['results']['energy']
                efficiency = energy_data.get('energy_efficiency_percent', 0)
                print(f"  - Energy efficiency: {efficiency:.1f}%")
            
            # Recommendations
            if 'recommendations' in analytics_result:
                rec_count = len(analytics_result['recommendations'])
                print(f"  - Optimization recommendations: {rec_count}")
                
                # Show top recommendation
                if analytics_result['recommendations']:
                    top_rec = analytics_result['recommendations'][0]
                    print(f"    → {top_rec['title']}: {top_rec.get('estimated_impact', 'TBD')}")
    
    async def _demonstrate_business_impact(self):
        """Demonstrate business impact analysis."""
        
        pump_id = self.demo_twins['pump']['twin_id']
        
        # Define potential improvements
        performance_improvements = {
            "oee_improvement_percent": 5.0,  # 5% OEE improvement
            "energy_efficiency_improvement_percent": 10.0,  # 10% energy savings
            "maintenance_cost_reduction_percent": 15.0,  # 15% maintenance savings
            "quality_improvement_percent": 2.0  # 2% quality improvement
        }
        
        # Operational context
        operational_context = {
            "production_rate_units_per_hour": 120,
            "operating_hours_per_year": 8760,
            "unit_revenue": 50,
            "energy_cost_per_kwh": 0.12,
            "maintenance_cost_per_year": 80000,
            "digital_twin_implementation_cost": 150000,
            "current_energy_consumption_kwh_per_year": 500000
        }
        
        # Calculate business impact (using analytics service)
        business_impact = self.analytics_service.business_analyzer.calculate_business_impact(
            performance_improvements, operational_context
        )
        
        print("✓ Business Impact Analysis Results:")
        
        financial_summary = business_impact['financial_summary']
        print(f"  - Annual revenue increase: ${financial_summary['total_annual_revenue_increase']:,.0f}")
        print(f"  - Annual cost savings: ${financial_summary['total_annual_cost_savings']:,.0f}")
        print(f"  - Total annual benefit: ${financial_summary['total_annual_benefit']:,.0f}")
        print(f"  - Payback period: {financial_summary['payback_period_years']:.1f} years")
        print(f"  - 5-year ROI: {financial_summary['roi_5_year_percent']:.0f}%")
        print(f"  - Business case strength: {business_impact['business_case_strength']}")
        
        # Show impact breakdown
        impact_analysis = business_impact['impact_analysis']
        for improvement_type, details in impact_analysis.items():
            if 'additional_revenue_per_year' in details:
                revenue = details['additional_revenue_per_year']
                print(f"    → {improvement_type}: ${revenue:,.0f} additional revenue")
            if 'cost_savings_per_year' in details:
                savings = details['cost_savings_per_year']
                print(f"    → {improvement_type}: ${savings:,.0f} cost savings")
    
    async def _demonstrate_real_time_monitoring(self):
        """Demonstrate real-time monitoring and alerting."""
        
        print("✓ Real-time Monitoring Simulation")
        
        for twin_name, twin_result in self.demo_twins.items():
            twin_id = twin_result['twin_id']
            
            # Simulate real-time data with anomalies
            real_time_data = self._generate_anomalous_data(twin_name)
            
            # Process real-time data
            sync_result = await self.twin_engine.sync_twin_with_physical_asset(
                twin_id, real_time_data
            )
            
            if sync_result['success']:
                # Check current state for anomalies
                twin_state = await self.twin_engine.get_twin_state(twin_id)
                current_state = twin_state.get('current_asset_state')
                
                if current_state:
                    # Simulate anomaly detection
                    if current_state['sensors'].get('temperature', 0) > 80:
                        print(f"  🚨 ALERT: High temperature detected in {twin_name}")
                        print(f"     Temperature: {current_state['sensors']['temperature']:.1f}°C")
                        print(f"     Recommended action: Check cooling system")
                    
                    if current_state['sensors'].get('vibration', 0) > 2.0:
                        print(f"  ⚠️  WARNING: Elevated vibration in {twin_name}")
                        print(f"     Vibration: {current_state['sensors']['vibration']:.1f} mm/s")
                        print(f"     Recommended action: Schedule bearing inspection")
                    
                    # Show normal operation
                    if (current_state['sensors'].get('temperature', 0) <= 80 and 
                        current_state['sensors'].get('vibration', 0) <= 2.0):
                        print(f"  ✅ {twin_name} operating normally")
                        health_score = current_state.get('health_indicators', {}).get('overall_health', 1.0)
                        print(f"     Health score: {health_score:.2f}")
        
        # Simulate predictive maintenance alert
        print("\n  🔮 PREDICTIVE ALERT: Motor bearing replacement recommended")
        print("     Predicted failure in 72 hours based on vibration trend analysis")
        print("     Confidence: 85%")
        print("     Recommended action: Schedule maintenance within 48 hours")
    
    def _generate_demo_data(self) -> Dict[str, Any]:
        """Generate demonstration data."""
        return {
            "motor": {
                "normal_temperature": 65.0,
                "normal_vibration": 1.2,
                "normal_current": 18.5,
                "normal_speed": 1780
            },
            "pump": {
                "normal_flow_rate": 98.0,
                "normal_pressure": 4.8,
                "normal_power": 8.5,
                "normal_efficiency": 0.78
            }
        }
    
    def _generate_iot_data(self, twin_type: str) -> Dict[str, Any]:
        """Generate IoT sensor data."""
        import random
        
        base_data = self.demo_data.get(twin_type, {})
        
        if twin_type == "motor":
            return {
                "sensors": {
                    "temperature": base_data["normal_temperature"] + random.uniform(-2, 3),
                    "vibration": base_data["normal_vibration"] + random.uniform(-0.1, 0.2),
                    "current": base_data["normal_current"] + random.uniform(-1, 2),
                    "speed": base_data["normal_speed"] + random.uniform(-20, 20),
                    "power": 10.2 + random.uniform(-0.5, 0.8)
                },
                "process_data": {
                    "load_factor": 0.8 + random.uniform(-0.1, 0.1),
                    "runtime_hours": 157.3,
                    "cycles_completed": 1523
                },
                "performance_metrics": {
                    "efficiency": 0.91 + random.uniform(-0.02, 0.01),
                    "availability": 0.95,
                    "oee": 0.82 + random.uniform(-0.03, 0.02)
                }
            }
        
        elif twin_type == "pump":
            return {
                "sensors": {
                    "flow_rate": base_data["normal_flow_rate"] + random.uniform(-2, 5),
                    "pressure": base_data["normal_pressure"] + random.uniform(-0.2, 0.3),
                    "power": base_data["normal_power"] + random.uniform(-0.3, 0.5),
                    "temperature": 45 + random.uniform(-5, 8),
                    "vibration": 0.8 + random.uniform(-0.1, 0.3)
                },
                "process_data": {
                    "efficiency": base_data["normal_efficiency"] + random.uniform(-0.02, 0.01),
                    "head": 48.5 + random.uniform(-1, 2),
                    "suction_pressure": 1.2 + random.uniform(-0.1, 0.1)
                },
                "performance_metrics": {
                    "hydraulic_efficiency": 0.75 + random.uniform(-0.02, 0.02),
                    "mechanical_efficiency": 0.88 + random.uniform(-0.01, 0.01),
                    "overall_efficiency": 0.66 + random.uniform(-0.02, 0.02)
                }
            }
        
        return {}
    
    def _generate_anomalous_data(self, twin_type: str) -> Dict[str, Any]:
        """Generate data with anomalies for demonstration."""
        import random
        
        normal_data = self._generate_iot_data(twin_type)
        
        # Introduce anomalies randomly
        if random.random() < 0.3:  # 30% chance of anomaly
            if twin_type == "motor":
                # Temperature spike
                normal_data["sensors"]["temperature"] += random.uniform(15, 25)
            elif twin_type == "pump":
                # Vibration increase
                normal_data["sensors"]["vibration"] += random.uniform(1.5, 2.5)
        
        return normal_data
    
    def _generate_historical_data(self, twin_type: str, days: int = 30) -> List[Dict[str, Any]]:
        """Generate historical data for analytics."""
        import random
        
        historical_data = []
        base_time = datetime.utcnow() - timedelta(days=days)
        
        for i in range(days * 24):  # Hourly data
            timestamp = base_time + timedelta(hours=i)
            
            # Generate base data with some trends
            data_point = self._generate_iot_data(twin_type)
            data_point["timestamp"] = timestamp
            
            # Add some realistic trends
            trend_factor = i / (days * 24)  # 0 to 1 over time period
            
            if twin_type == "motor":
                # Gradual degradation
                data_point["sensors"]["vibration"] += trend_factor * 0.3
                data_point["sensors"]["temperature"] += trend_factor * 5
                data_point["performance_metrics"]["oee"] -= trend_factor * 0.05
            
            elif twin_type == "pump":
                # Efficiency degradation
                data_point["performance_metrics"]["hydraulic_efficiency"] -= trend_factor * 0.03
                data_point["sensors"]["vibration"] += trend_factor * 0.2
            
            # Add some random seasonal variations
            seasonal_factor = 0.1 * random.sin(2 * 3.14159 * i / (24 * 7))  # Weekly pattern
            for sensor in data_point["sensors"]:
                if isinstance(data_point["sensors"][sensor], (int, float)):
                    data_point["sensors"][sensor] += seasonal_factor * data_point["sensors"][sensor]
            
            historical_data.append(data_point)
        
        return historical_data


async def run_digital_twin_demo():
    """Run the complete digital twin demonstration."""
    demo = DigitalTwinDemo()
    await demo.run_complete_demo()


if __name__ == "__main__":
    # Run the demonstration
    asyncio.run(run_digital_twin_demo())