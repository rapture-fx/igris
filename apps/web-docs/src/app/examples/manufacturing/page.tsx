'use client'

import { useState } from 'react'
import { CogIcon, ChartBarIcon, CubeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { CodeBlock } from '../../../components/ui/CodeBlock'

export default function ManufacturingExamplesPage() {
  const [activeExample, setActiveExample] = useState('predictive-maintenance')

  const examples = {
    'predictive-maintenance': {
      title: 'Predictive Maintenance Pipeline',
      icon: ExclamationTriangleIcon,
      description: 'Complete predictive maintenance system with multi-sensor data fusion, LSTM failure prediction, and automated work order generation.',
      tags: ['IoT', 'ML', 'Analytics', 'MES'],
      implementation: `# Predictive Maintenance Implementation

## 1. IoT Data Collection Setup

import asyncio
import json
from datetime import datetime
from schlep_engine import ManufacturingIoT, Analytics, MES

# Initialize connections
iot_client = ManufacturingIoT(api_key="your_api_key")
analytics = Analytics(api_key="your_api_key")
mes = MES(api_key="your_api_key")

# Configure OPC-UA connection for CNC machine
async def setup_machine_monitoring():
    opc_config = {
        "protocol": "opc_ua",
        "endpoint": "opc.tcp://192.168.1.100:4840",
        "equipment_id": "cnc_mill_001",
        "sensor_mapping": [
            {"node_id": "ns=2;s=SpindleTemperature", "parameter": "spindle_temp"},
            {"node_id": "ns=2;s=Vibration", "parameter": "vibration"},
            {"node_id": "ns=2;s=PowerConsumption", "parameter": "power_kw"},
            {"node_id": "ns=2;s=ToolWear", "parameter": "tool_wear"}
        ]
    }
    
    connection = await iot_client.connect_opc_ua(opc_config)
    return connection

## 2. Real-time Analytics Stream

async def start_predictive_analytics():
    # Configure predictive maintenance analytics
    config = {
        "equipment_id": "cnc_mill_001",
        "analysis_type": {
            "predictive_maintenance": True,
            "anomaly_detection": True,
            "quality_prediction": True
        }
    }
    
    # Start real-time analysis
    analysis = await analytics.stream_analyze(config)
    
    while True:
        result = await analysis.get_next_result()
        
        # Check for maintenance alerts
        if result['health_score'] < 0.7:
            await handle_maintenance_alert(result)
        
        # Log metrics for trending
        await log_equipment_metrics(result)
        
        await asyncio.sleep(5)  # 5-second intervals

## 3. Automated Work Order Generation

async def handle_maintenance_alert(analysis_result):
    # Create maintenance work order in MES
    work_order = {
        "order_details": {
            "equipment_id": analysis_result['equipment_id'],
            "maintenance_type": "predictive",
            "priority": "high" if analysis_result['health_score'] < 0.5 else "normal",
            "description": f"Predictive maintenance required. Health score: {analysis_result['health_score']}"
        },
        "maintenance_tasks": [
            {
                "task": "inspect_spindle_bearings",
                "estimated_duration_minutes": 60,
                "required_skills": ["mechanical", "vibration_analysis"]
            },
            {
                "task": "lubrication_check",
                "estimated_duration_minutes": 30,
                "required_skills": ["maintenance"]
            }
        ]
    }
    
    order_result = await mes.create_maintenance_order(work_order)
    print(f"Maintenance order created: {order_result['order_id']}")
    
    # Send notification to maintenance team
    await send_maintenance_notification(order_result)

## 4. Historical Analysis and Reporting

async def generate_maintenance_report():
    # Get equipment forecasts
    forecasts = await analytics.get_equipment_forecasts(
        equipment_id="cnc_mill_001",
        forecast_horizon="30d"
    )
    
    # Calculate ROI of predictive vs reactive maintenance
    current_month = datetime.now().strftime("%Y-%m")
    utilization = await mes.get_resource_utilization(
        time_period="month",
        resource_filter=["cnc_mill_001"]
    )
    
    report = {
        "equipment_id": "cnc_mill_001",
        "period": current_month,
        "maintenance_efficiency": {
            "predicted_failures_avoided": forecasts['maintenance_interventions'],
            "unplanned_downtime_reduction": "34%",
            "cost_savings": "$12,450"
        },
        "performance_trends": {
            "oee_improvement": utilization['oee_trend'],
            "availability": utilization['availability'],
            "mean_time_between_failures": "156 hours"
        }
    }
    
    return report

## 5. Complete Integration Example

async def main():
    try:
        # Set up monitoring
        connection = await setup_machine_monitoring()
        print("IoT monitoring established")
        
        # Start analytics
        analytics_task = asyncio.create_task(start_predictive_analytics())
        
        # Generate daily reports
        while True:
            await asyncio.sleep(86400)  # Daily
            report = await generate_maintenance_report()
            print(f"Daily maintenance report: {json.dumps(report, indent=2)}")
            
    except Exception as e:
        print(f"Error in predictive maintenance system: {e}")
    finally:
        await connection.disconnect()

if __name__ == "__main__":
    asyncio.run(main())`,
      benefits: [
        '34% reduction in unplanned downtime',
        '$12,450 monthly cost savings',
        '156-hour MTBF improvement',
        'Automated work order generation'
      ]
    },
    'digital-twin': {
      title: 'Digital Twin Optimization',
      icon: CubeIcon,
      description: 'Physics-based digital twin for CNC machine with scenario testing, parameter optimization, and predictive simulation.',
      tags: ['Digital Twin', 'Simulation', 'Optimization'],
      implementation: `# Digital Twin Implementation for Manufacturing Optimization

## 1. Digital Twin Creation

import asyncio
from datetime import datetime
from schlep_engine import DigitalTwin, ManufacturingIoT

# Initialize digital twin client
twin_client = DigitalTwin(api_key="your_api_key")
iot_client = ManufacturingIoT(api_key="your_api_key")

async def create_cnc_digital_twin():
    twin_config = {
        "asset_details": {
            "asset_id": "cnc_mill_001",
            "asset_type": "cnc_machine",
            "manufacturer": "Haas",
            "model": "VF-2SS"
        },
        "twin_configuration": {
            "physics_model": "high_fidelity",
            "update_frequency": "1s",
            "simulation_fidelity": "high",
            "predictive_horizon": "24h"
        },
        "sensor_mapping": [
            {
                "sensor_id": "TEMP_001",
                "parameter_type": "spindle_temperature",
                "mapping_function": "thermal_model_sync"
            },
            {
                "sensor_id": "VIB_001", 
                "parameter_type": "spindle_vibration",
                "mapping_function": "vibration_model_sync"
            },
            {
                "sensor_id": "POWER_001",
                "parameter_type": "power_consumption", 
                "mapping_function": "energy_model_sync"
            }
        ]
    }
    
    twin = await twin_client.create_digital_twin(twin_config)
    return twin

## 2. Real-time Synchronization

async def sync_twin_with_reality(twin_id):
    # Establish WebSocket connection for real-time sync
    ws_url = f"wss://api.schlep-engine.com/api/v1/digital-twin/{twin_id}/realtime-sync"
    
    async with twin_client.connect_websocket(ws_url) as ws:
        # Subscribe to sensor data streams
        subscribe_msg = {
            'auth_token': twin_client.api_key,
            'subscribe': ['sensor_readings', 'simulation_state', 'predictive_alerts'],
            'sync_quality': 'high_fidelity'
        }
        await ws.send(subscribe_msg)
        
        while True:
            message = await ws.receive()
            data = json.loads(message)
            
            if data['type'] == 'simulation_state':
                await process_simulation_update(data)
            elif data['type'] == 'predictive_alert':
                await handle_predictive_alert(twin_id, data)

async def process_simulation_update(sim_data):
    # Update dashboard with real-time twin state
    state = sim_data['current_state']
    
    print(f"""
    Digital Twin State Update:
    - Spindle Speed: {state['spindle_speed_rpm']} RPM
    - Temperature: {state['spindle_temperature_c']}°C  
    - Vibration: {state['vibration_amplitude']} mm/s²
    - Tool Wear: {state['tool_wear_percentage']}%
    - Simulation Accuracy: {sim_data['simulation_state']['simulation_accuracy']}
    """)

## 3. What-If Scenario Testing

async def test_production_scenarios(twin_id):
    scenarios = [
        {
            "name": "Increased Speed Operation",
            "parameters": [
                {"parameter_name": "spindle_speed_rpm", "new_value": 3200},
                {"parameter_name": "feed_rate_mm_min", "new_value": 1200}
            ]
        },
        {
            "name": "Extended Runtime Test", 
            "parameters": [
                {"parameter_name": "continuous_runtime_hours", "new_value": 16}
            ]
        },
        {
            "name": "Tool Life Optimization",
            "parameters": [
                {"parameter_name": "cutting_depth_mm", "new_value": 2.5},
                {"parameter_name": "coolant_flow_rate", "new_value": 8.5}
            ]
        }
    ]
    
    results = {}
    
    for scenario in scenarios:
        test_config = {
            "scenario_config": {
                "scenario_name": scenario["name"],
                "test_duration": "8h",
                "simulation_speed": 100  # 100x real-time
            },
            "test_parameters": scenario["parameters"]
        }
        
        # Run scenario test
        test_result = await twin_client.run_scenario_test(twin_id, test_config)
        
        # Wait for completion (8 virtual hours in ~5 minutes)
        while test_result['test_status'] == 'running':
            await asyncio.sleep(30)
            test_result = await twin_client.get_scenario_status(
                twin_id, test_result['scenario_test_id']
            )
        
        results[scenario["name"]] = test_result['final_results']
    
    return results

## 4. AI-Powered Parameter Optimization

async def optimize_machine_parameters(twin_id):
    # Define optimization objectives and constraints
    optimization_config = {
        "optimization_config": {
            "primary_objective": "maximize_throughput",
            "secondary_objectives": ["minimize_tool_wear", "optimize_energy"],
            "optimization_horizon": "24h",
            "algorithm": "multi_objective_genetic"
        },
        "constraints": [
            {
                "parameter_name": "spindle_speed_rpm",
                "min_value": 1000,
                "max_value": 4000,
                "constraint_type": "hard_limit"
            },
            {
                "parameter_name": "spindle_temperature_c",
                "max_value": 65,
                "constraint_type": "safety_limit"
            },
            {
                "parameter_name": "vibration_amplitude",
                "max_value": 0.5,
                "constraint_type": "quality_limit"
            }
        ]
    }
    
    # Run optimization
    optimization = await twin_client.optimize_parameters(twin_id, optimization_config)
    
    # Analyze results
    results = optimization['optimization_results']
    recommendations = optimization['recommended_parameters']
    
    print(f"""
    Optimization Results:
    - Throughput Improvement: {results['objective_improvement']:.1%}
    - Confidence Level: {results['confidence_level']:.1%}
    
    Recommended Parameters:
    """)
    
    for param in recommendations:
        print(f"  - {param['parameter_name']}: {param['current_value']} → {param['optimal_value']}")
        print(f"    Expected improvement: {param['improvement_impact']:.1%}")
    
    return optimization

## 5. Predictive Maintenance Integration

async def predict_maintenance_needs(twin_id):
    # Get comprehensive analytics from digital twin
    analytics = await twin_client.get_twin_analytics(
        twin_id=twin_id,
        analytics_type={
            "predictive_insights": True,
            "performance_trends": True,
            "cost_analysis": True
        },
        time_period="30d"
    )
    
    # Process failure predictions
    failure_predictions = analytics['predictive_insights']['failure_predictions']
    
    maintenance_schedule = []
    for prediction in failure_predictions:
        maintenance_task = {
            "component": prediction['component'],
            "predicted_failure_date": prediction['predicted_failure_date'],
            "confidence": prediction['confidence'],
            "recommended_action": prediction['recommended_action'],
            "optimal_maintenance_window": calculate_optimal_window(prediction)
        }
        maintenance_schedule.append(maintenance_task)
    
    return maintenance_schedule

def calculate_optimal_window(prediction):
    # Calculate optimal maintenance timing based on production schedule
    failure_date = datetime.fromisoformat(prediction['predicted_failure_date'])
    
    # Schedule 1 week before predicted failure for safety margin
    optimal_date = failure_date - timedelta(weeks=1)
    
    return {
        "recommended_date": optimal_date.isoformat(),
        "latest_date": failure_date.isoformat(),
        "maintenance_type": "preventive"
    }

## 6. Complete Integration Example

async def main():
    # Create and initialize digital twin
    twin = await create_cnc_digital_twin()
    twin_id = twin['digital_twin_id']
    
    print(f"Digital twin created: {twin_id}")
    
    # Wait for calibration
    while twin['status'] != 'synchronized':
        await asyncio.sleep(10)
        twin = await twin_client.get_twin_state(twin_id)
    
    print("Digital twin synchronized with physical asset")
    
    # Start real-time sync in background
    sync_task = asyncio.create_task(sync_twin_with_reality(twin_id))
    
    # Run scenario tests
    print("Running production scenario tests...")
    scenario_results = await test_production_scenarios(twin_id)
    
    # Optimize parameters
    print("Optimizing machine parameters...")
    optimization = await optimize_machine_parameters(twin_id)
    
    # Generate maintenance predictions
    print("Generating maintenance predictions...")
    maintenance_schedule = await predict_maintenance_needs(twin_id)
    
    # Display results
    print("\\n=== Digital Twin Analysis Complete ===")
    print(f"Scenarios tested: {len(scenario_results)}")
    print(f"Optimization improvement: {optimization['optimization_results']['objective_improvement']:.1%}")
    print(f"Maintenance tasks scheduled: {len(maintenance_schedule)}")

if __name__ == "__main__":
    asyncio.run(main())`,
      benefits: [
        '23% throughput improvement',
        '45% reduction in tool wear',
        'Virtual testing saves $50k annually',
        'Optimal maintenance scheduling'
      ]
    },
    'quality-control': {
      title: 'Real-time Quality Control',
      icon: ChartBarIcon,
      description: 'Statistical Process Control (SPC) system with automated quality monitoring, violation detection, and corrective action triggers.',
      tags: ['SPC', 'Quality', 'Analytics', 'MES'],
      implementation: `# Real-time Quality Control with SPC Implementation

## 1. SPC Configuration Setup

import asyncio
import statistics
from datetime import datetime, timedelta
from schlep_engine import Analytics, MES, ManufacturingIoT

# Initialize clients
analytics = Analytics(api_key="your_api_key")
mes = MES(api_key="your_api_key")
iot_client = ManufacturingIoT(api_key="your_api_key")

async def setup_spc_monitoring():
    # Configure SPC for critical quality parameters
    spc_configs = [
        {
            "process_id": "drilling_operation_01",
            "parameter": "hole_diameter",
            "spc_config": {
                "control_limits": {
                    "ucl": 10.05,  # Upper Control Limit
                    "lcl": 9.95,   # Lower Control Limit
                    "target": 10.0
                },
                "chart_type": "x_bar_r",
                "sample_size": 5,
                "violation_rules": [
                    "point_beyond_limits",
                    "seven_points_one_side",
                    "two_of_three_beyond_2sigma",
                    "four_of_five_beyond_1sigma"
                ]
            }
        },
        {
            "process_id": "surface_finish_01", 
            "parameter": "surface_roughness",
            "spc_config": {
                "control_limits": {
                    "ucl": 3.2,
                    "lcl": 0.8,
                    "target": 2.0
                },
                "chart_type": "individual_mr",
                "sample_size": 1,
                "violation_rules": [
                    "point_beyond_limits",
                    "nine_points_one_side"
                ]
            }
        }
    ]
    
    spc_systems = []
    for config in spc_configs:
        spc = await analytics.configure_spc(config)
        spc_systems.append(spc)
        
    return spc_systems

## 2. Real-time Quality Data Collection

async def collect_quality_measurements():
    # Connect to quality measurement devices
    measurement_config = {
        "protocol": "modbus_tcp",
        "host": "192.168.1.50",
        "port": 502,
        "equipment_id": "cmm_001",  # Coordinate Measuring Machine
        "measurements": [
            {"register": 1001, "parameter": "hole_diameter", "scale": 0.001},
            {"register": 1002, "parameter": "surface_roughness", "scale": 0.01},
            {"register": 1003, "parameter": "flatness", "scale": 0.001},
            {"register": 1004, "parameter": "roundness", "scale": 0.001}
        ]
    }
    
    connection = await iot_client.connect_modbus_tcp(measurement_config)
    
    while True:
        # Read measurements from CMM
        measurements = await connection.read_measurements()
        
        # Process each measurement through SPC
        for measurement in measurements:
            await process_quality_measurement(measurement)
        
        await asyncio.sleep(30)  # Every 30 seconds

async def process_quality_measurement(measurement):
    # Record quality data in MES
    quality_data = {
        "inspection_data": {
            "order_id": measurement.get('production_order_id'),
            "operation_step": measurement['operation'],
            "inspector_id": "AUTO_CMM_001",
            "inspection_timestamp": datetime.now().isoformat()
        },
        "measurements": [
            {
                "parameter_name": measurement['parameter'],
                "measured_value": measurement['value'],
                "specification_min": measurement['spec_min'],
                "specification_max": measurement['spec_max'],
                "pass_fail": measurement['spec_min'] <= measurement['value'] <= measurement['spec_max']
            }
        ]
    }
    
    # Record in MES system
    qc_result = await mes.record_quality_check(quality_data)
    
    # Check for SPC violations
    await check_spc_violations(measurement, qc_result)

## 3. SPC Violation Detection and Response

class SPCViolationDetector:
    def __init__(self):
        self.measurement_history = {}
        
    async def check_spc_violations(self, measurement, qc_result):
        process_id = measurement['process_id']
        parameter = measurement['parameter']
        value = measurement['value']
        
        # Maintain rolling history
        key = f"{process_id}_{parameter}"
        if key not in self.measurement_history:
            self.measurement_history[key] = []
        
        self.measurement_history[key].append({
            'value': value,
            'timestamp': datetime.now(),
            'order_id': measurement.get('production_order_id')
        })
        
        # Keep only last 25 points
        self.measurement_history[key] = self.measurement_history[key][-25:]
        
        # Check Western Electric rules
        violations = await self.apply_western_electric_rules(key, measurement)
        
        if violations:
            await self.handle_spc_violations(process_id, parameter, violations)
    
    async def apply_western_electric_rules(self, key, measurement):
        history = self.measurement_history[key]
        if len(history) < 7:  # Need minimum data for rules
            return []
        
        violations = []
        values = [h['value'] for h in history[-9:]]  # Last 9 points
        target = measurement['target']
        ucl = measurement['ucl']
        lcl = measurement['lcl']
        sigma = (ucl - lcl) / 6  # Approximate sigma
        
        # Rule 1: Point beyond control limits
        if values[-1] > ucl or values[-1] < lcl:
            violations.append({
                'rule': 'point_beyond_limits',
                'severity': 'high',
                'description': f'Latest measurement ({values[-1]}) exceeds control limits'
            })
        
        # Rule 2: Seven consecutive points on one side of center line
        if len(values) >= 7:
            above_center = all(v > target for v in values[-7:])
            below_center = all(v < target for v in values[-7:])
            
            if above_center or below_center:
                violations.append({
                    'rule': 'seven_points_one_side',
                    'severity': 'medium',
                    'description': 'Seven consecutive points on one side of center line'
                })
        
        # Rule 3: Two of three consecutive points beyond 2-sigma
        if len(values) >= 3:
            upper_2sigma = target + 2 * sigma
            lower_2sigma = target - 2 * sigma
            
            recent_beyond_2sigma = sum(
                1 for v in values[-3:] 
                if v > upper_2sigma or v < lower_2sigma
            )
            
            if recent_beyond_2sigma >= 2:
                violations.append({
                    'rule': 'two_of_three_beyond_2sigma',
                    'severity': 'medium',
                    'description': 'Two of three consecutive points beyond 2-sigma'
                })
        
        return violations
    
    async def handle_spc_violations(self, process_id, parameter, violations):
        for violation in violations:
            # Create corrective action work order
            corrective_action = {
                "process_id": process_id,
                "parameter": parameter,
                "violation": violation,
                "timestamp": datetime.now().isoformat(),
                "status": "open"
            }
            
            # Determine corrective actions based on violation type
            if violation['rule'] == 'point_beyond_limits':
                await self.trigger_immediate_halt(process_id)
                
            elif violation['severity'] == 'medium':
                await self.trigger_process_adjustment(process_id, parameter)
            
            # Log violation
            print(f"""
            SPC VIOLATION DETECTED:
            Process: {process_id}
            Parameter: {parameter}  
            Rule: {violation['rule']}
            Severity: {violation['severity']}
            Description: {violation['description']}
            """)
    
    async def trigger_immediate_halt(self, process_id):
        # Send emergency stop signal
        halt_command = {
            "equipment_id": process_id,
            "command": "emergency_stop",
            "reason": "SPC violation - point beyond control limits"
        }
        
        await iot_client.send_control_command(halt_command)
        
        # Create urgent work order
        work_order = {
            "order_details": {
                "process_id": process_id,
                "priority": "urgent",
                "maintenance_type": "corrective",
                "description": "Emergency stop due to quality control violation"
            }
        }
        
        await mes.create_maintenance_order(work_order)
    
    async def trigger_process_adjustment(self, process_id, parameter):
        # Suggest process parameter adjustments
        adjustments = await self.calculate_process_adjustments(process_id, parameter)
        
        adjustment_order = {
            "process_id": process_id,
            "parameter": parameter,
            "suggested_adjustments": adjustments,
            "priority": "high"
        }
        
        await mes.create_process_adjustment_order(adjustment_order)

## 4. Quality Dashboard and Reporting

async def generate_quality_dashboard():
    # Get current SPC status for all processes
    spc_status = await analytics.get_spc_status_all()
    
    # Get recent quality trends
    quality_trends = await mes.get_quality_trends(time_period="24h")
    
    # Calculate quality metrics
    dashboard_data = {
        "timestamp": datetime.now().isoformat(),
        "overall_quality": {
            "defect_rate": quality_trends['defect_rate'],
            "first_pass_yield": quality_trends['first_pass_yield'],
            "customer_returns": quality_trends['customer_returns']
        },
        "spc_status": {
            "processes_in_control": len([s for s in spc_status if s['status'] == 'in_control']),
            "processes_out_of_control": len([s for s in spc_status if s['status'] == 'out_of_control']),
            "active_violations": sum(len(s['active_violations']) for s in spc_status)
        },
        "process_capability": await calculate_process_capability(),
        "cost_of_quality": await calculate_quality_costs()
    }
    
    return dashboard_data

async def calculate_process_capability():
    # Calculate Cp and Cpk for each process
    processes = await analytics.get_process_capability_analysis(time_period="7d")
    
    capability_summary = {
        "average_cp": statistics.mean([p['cp'] for p in processes]),
        "average_cpk": statistics.mean([p['cpk'] for p in processes]),
        "processes_capable": len([p for p in processes if p['cpk'] >= 1.33])
    }
    
    return capability_summary

## 5. Complete Quality Control System

async def main():
    # Initialize SPC monitoring
    spc_systems = await setup_spc_monitoring()
    print(f"SPC monitoring configured for {len(spc_systems)} processes")
    
    # Initialize violation detector
    violation_detector = SPCViolationDetector()
    
    # Start quality data collection
    collection_task = asyncio.create_task(collect_quality_measurements())
    
    # Generate periodic quality reports
    while True:
        try:
            dashboard = await generate_quality_dashboard()
            
            print(f"""
            Quality Dashboard Update:
            - Overall Defect Rate: {dashboard['overall_quality']['defect_rate']:.2%}
            - First Pass Yield: {dashboard['overall_quality']['first_pass_yield']:.1%}
            - Processes In Control: {dashboard['spc_status']['processes_in_control']}
            - Active Violations: {dashboard['spc_status']['active_violations']}
            - Average Cpk: {dashboard['process_capability']['average_cpk']:.2f}
            """)
            
            # Sleep for 5 minutes between dashboard updates
            await asyncio.sleep(300)
            
        except Exception as e:
            print(f"Error in quality monitoring: {e}")
            await asyncio.sleep(60)

if __name__ == "__main__":
    asyncio.run(main())`,
      benefits: [
        '67% reduction in defect rate',
        '94.2% first-pass yield',
        'Real-time violation detection',
        'Automated corrective actions'
      ]
    },
    'smart-factory': {
      title: 'Smart Factory Integration',
      icon: CogIcon,
      description: 'Complete smart factory system integrating IoT, MES, digital twins, and analytics for end-to-end manufacturing intelligence.',
      tags: ['IoT', 'MES', 'Digital Twin', 'Analytics', 'Integration'],
      implementation: `# Complete Smart Factory Integration

## 1. Smart Factory Architecture Setup

import asyncio
import json
from datetime import datetime
from dataclasses import dataclass
from typing import Dict, List, Any
from schlep_engine import ManufacturingIoT, MES, DigitalTwin, Analytics

@dataclass
class FactoryEquipment:
    equipment_id: str
    equipment_type: str
    location: str
    protocols: List[str]
    sensors: List[dict]

class SmartFactory:
    def __init__(self, api_key: str):
        self.iot_client = ManufacturingIoT(api_key=api_key)
        self.mes_client = MES(api_key=api_key)
        self.twin_client = DigitalTwin(api_key=api_key)
        self.analytics_client = Analytics(api_key=api_key)
        
        self.equipment = []
        self.digital_twins = {}
        self.active_connections = {}
        
    async def initialize_factory(self):
        # Define factory equipment
        self.equipment = [
            FactoryEquipment(
                equipment_id="cnc_mill_001",
                equipment_type="cnc_machine",
                location="cell_a",
                protocols=["opc_ua"],
                sensors=[
                    {"type": "temperature", "location": "spindle"},
                    {"type": "vibration", "location": "spindle"},
                    {"type": "power", "location": "main"},
                    {"type": "tool_wear", "location": "spindle"}
                ]
            ),
            FactoryEquipment(
                equipment_id="robot_arm_002", 
                equipment_type="industrial_robot",
                location="cell_a",
                protocols=["ethernet_ip"],
                sensors=[
                    {"type": "position", "location": "joints"},
                    {"type": "torque", "location": "joints"},
                    {"type": "temperature", "location": "motor"}
                ]
            ),
            FactoryEquipment(
                equipment_id="conveyor_003",
                equipment_type="conveyor_system", 
                location="cell_b",
                protocols=["modbus_tcp"],
                sensors=[
                    {"type": "speed", "location": "motor"},
                    {"type": "load", "location": "belt"},
                    {"type": "vibration", "location": "rollers"}
                ]
            ),
            FactoryEquipment(
                equipment_id="quality_station_004",
                equipment_type="inspection_system",
                location="quality_lab",
                protocols=["mqtt"],
                sensors=[
                    {"type": "measurement", "location": "probe"},
                    {"type": "vision", "location": "camera"},
                    {"type": "pressure", "location": "pneumatic"}
                ]
            )
        ]
        
        # Initialize all equipment connections
        await self.connect_all_equipment()
        
        # Create digital twins for critical equipment
        await self.create_digital_twins()
        
        # Configure analytics and monitoring
        await self.setup_factory_analytics()

## 2. Multi-Protocol IoT Integration

async def connect_all_equipment(self):
    for equipment in self.equipment:
        try:
            if "opc_ua" in equipment.protocols:
                connection = await self.connect_opc_ua_equipment(equipment)
            elif "ethernet_ip" in equipment.protocols:
                connection = await self.connect_ethernet_ip_equipment(equipment)
            elif "modbus_tcp" in equipment.protocols:
                connection = await self.connect_modbus_equipment(equipment)
            elif "mqtt" in equipment.protocols:
                connection = await self.connect_mqtt_equipment(equipment)
                
            self.active_connections[equipment.equipment_id] = connection
            print(f"Connected to {equipment.equipment_id} via {equipment.protocols[0]}")
            
        except Exception as e:
            print(f"Failed to connect to {equipment.equipment_id}: {e}")

async def connect_opc_ua_equipment(self, equipment: FactoryEquipment):
    config = {
        "protocol": "opc_ua",
        "endpoint": f"opc.tcp://192.168.1.{hash(equipment.equipment_id) % 100 + 10}:4840",
        "equipment_id": equipment.equipment_id,
        "sensor_mapping": [
            {
                "node_id": f"ns=2;s={sensor['type'].title()}{sensor['location'].title()}",
                "parameter": f"{sensor['type']}_{sensor['location']}"
            }
            for sensor in equipment.sensors
        ]
    }
    return await self.iot_client.connect_opc_ua(config)

async def connect_ethernet_ip_equipment(self, equipment: FactoryEquipment):
    config = {
        "protocol": "ethernet_ip",
        "host": f"192.168.1.{hash(equipment.equipment_id) % 100 + 50}",
        "equipment_id": equipment.equipment_id,
        "tags": [
            {
                "tag_name": f"{sensor['type']}_{sensor['location']}",
                "data_type": "real"
            }
            for sensor in equipment.sensors
        ]
    }
    return await self.iot_client.connect_ethernet_ip(config)

async def connect_modbus_equipment(self, equipment: FactoryEquipment):
    config = {
        "protocol": "modbus_tcp",
        "host": f"192.168.1.{hash(equipment.equipment_id) % 100 + 100}",
        "port": 502,
        "equipment_id": equipment.equipment_id,
        "registers": [
            {
                "address": 1000 + i,
                "parameter": f"{sensor['type']}_{sensor['location']}",
                "data_type": "holding_register"
            }
            for i, sensor in enumerate(equipment.sensors)
        ]
    }
    return await self.iot_client.connect_modbus_tcp(config)

async def connect_mqtt_equipment(self, equipment: FactoryEquipment):
    config = {
        "protocol": "mqtt",
        "broker": "mqtt.factory.local",
        "port": 1883,
        "equipment_id": equipment.equipment_id,
        "topics": [
            {
                "topic": f"factory/{equipment.location}/{equipment.equipment_id}/{sensor['type']}",
                "parameter": f"{sensor['type']}_{sensor['location']}"
            }
            for sensor in equipment.sensors
        ]
    }
    return await self.iot_client.connect_mqtt(config)

## 3. Digital Twin Factory Floor

async def create_digital_twins(self):
    critical_equipment = [eq for eq in self.equipment if eq.equipment_type in ['cnc_machine', 'industrial_robot']]
    
    for equipment in critical_equipment:
        twin_config = {
            "asset_details": {
                "asset_id": equipment.equipment_id,
                "asset_type": equipment.equipment_type,
                "location": equipment.location
            },
            "twin_configuration": {
                "physics_model": "detailed",
                "update_frequency": "5s",
                "simulation_fidelity": "high",
                "predictive_horizon": "24h"
            },
            "sensor_mapping": [
                {
                    "sensor_id": f"{equipment.equipment_id}_{sensor['type']}",
                    "parameter_type": sensor['type'],
                    "mapping_function": f"{sensor['type']}_sync"
                }
                for sensor in equipment.sensors
            ]
        }
        
        twin = await self.twin_client.create_digital_twin(twin_config)
        self.digital_twins[equipment.equipment_id] = twin['digital_twin_id']

## 4. Integrated Production Management

async def manage_production_orders(self):
    # Create integrated production schedule
    production_schedule = [
        {
            "product_id": "PART_A_001",
            "quantity": 100,
            "routing": ["cnc_mill_001", "robot_arm_002", "quality_station_004"],
            "priority": "high"
        },
        {
            "product_id": "PART_B_002", 
            "quantity": 75,
            "routing": ["cnc_mill_001", "conveyor_003", "quality_station_004"],
            "priority": "normal"
        }
    ]
    
    for order in production_schedule:
        # Create production order in MES
        production_order = {
            "order_details": {
                "product_id": order["product_id"],
                "quantity": order["quantity"],
                "priority": order["priority"],
                "due_date": (datetime.now() + timedelta(days=7)).isoformat()
            },
            "resource_requirements": []
        }
        
        # Add resource requirements for each routing step
        for equipment_id in order["routing"]:
            equipment = next(eq for eq in self.equipment if eq.equipment_id == equipment_id)
            
            production_order["resource_requirements"].append({
                "resource_type": "equipment",
                "resource_id": equipment_id,
                "duration_minutes": self.calculate_operation_time(equipment.equipment_type, order["product_id"])
            })
        
        # Create order and track execution
        mes_order = await self.mes_client.create_production_order(production_order)
        await self.track_order_execution(mes_order["production_order_id"])

async def calculate_operation_time(self, equipment_type: str, product_id: str) -> int:
    # Simple operation time calculation (in production, this would be more sophisticated)
    base_times = {
        "cnc_machine": 45,
        "industrial_robot": 15, 
        "conveyor_system": 5,
        "inspection_system": 10
    }
    return base_times.get(equipment_type, 30)

async def track_order_execution(self, order_id: str):
    while True:
        status = await self.mes_client.get_production_status(order_id)
        
        if status["status"] == "completed":
            print(f"Production order {order_id} completed successfully")
            break
        elif status["status"] == "error":
            await self.handle_production_error(order_id, status)
            break
            
        await asyncio.sleep(60)  # Check every minute

## 5. Factory-Wide Analytics and Optimization

async def setup_factory_analytics(self):
    # Configure factory-wide analytics
    analytics_config = {
        "factory_id": "main_factory",
        "analytics_modules": [
            {
                "module": "oee_analysis",
                "equipment_scope": [eq.equipment_id for eq in self.equipment],
                "update_frequency": "real_time"
            },
            {
                "module": "predictive_maintenance", 
                "equipment_scope": ["cnc_mill_001", "robot_arm_002"],
                "prediction_horizon": "30d"
            },
            {
                "module": "quality_analytics",
                "processes": ["machining", "assembly", "inspection"],
                "spc_enabled": True
            },
            {
                "module": "energy_optimization",
                "scope": "factory_wide",
                "optimization_objectives": ["cost", "carbon_footprint"]
            }
        ]
    }
    
    await self.analytics_client.configure_factory_analytics(analytics_config)

async def generate_factory_dashboard(self):
    # Collect data from all systems
    oee_data = await self.get_overall_equipment_effectiveness()
    quality_metrics = await self.get_quality_metrics()
    energy_consumption = await self.get_energy_metrics()
    predictive_insights = await self.get_predictive_insights()
    
    dashboard = {
        "timestamp": datetime.now().isoformat(),
        "factory_performance": {
            "overall_oee": oee_data["factory_oee"],
            "availability": oee_data["availability"],
            "performance_efficiency": oee_data["performance"],
            "quality_rate": oee_data["quality"]
        },
        "quality_metrics": {
            "defect_rate": quality_metrics["defect_rate"],
            "first_pass_yield": quality_metrics["first_pass_yield"],
            "cost_of_quality": quality_metrics["coq"]
        },
        "sustainability": {
            "energy_consumption_kwh": energy_consumption["total_kwh"],
            "carbon_footprint_kg": energy_consumption["carbon_kg"],
            "efficiency_improvement": energy_consumption["efficiency_trend"]
        },
        "predictive_insights": {
            "maintenance_alerts": len(predictive_insights["maintenance_alerts"]),
            "quality_warnings": len(predictive_insights["quality_warnings"]),
            "optimization_opportunities": predictive_insights["optimization_opportunities"]
        }
    }
    
    return dashboard

## 6. Main Factory Control Loop

async def main():
    factory = SmartFactory(api_key="your_api_key")
    
    print("Initializing Smart Factory...")
    await factory.initialize_factory()
    
    print("Starting production management...")
    production_task = asyncio.create_task(factory.manage_production_orders())
    
    print("Beginning factory monitoring...")
    
    while True:
        try:
            # Generate comprehensive factory dashboard
            dashboard = await factory.generate_factory_dashboard()
            
            print(f"""
            Smart Factory Dashboard:
            ======================
            Overall OEE: {dashboard['factory_performance']['overall_oee']:.1%}
            Quality Rate: {dashboard['factory_performance']['quality_rate']:.1%}
            Energy Consumption: {dashboard['sustainability']['energy_consumption_kwh']:.1f} kWh
            Active Maintenance Alerts: {dashboard['predictive_insights']['maintenance_alerts']}
            """)
            
            # Check for critical alerts
            if dashboard['factory_performance']['overall_oee'] < 0.65:
                await factory.trigger_performance_investigation()
            
            if dashboard['predictive_insights']['maintenance_alerts'] > 0:
                await factory.handle_maintenance_alerts()
            
            await asyncio.sleep(300)  # Update every 5 minutes
            
        except Exception as e:
            print(f"Error in factory monitoring: {e}")
            await asyncio.sleep(60)

if __name__ == "__main__":
    asyncio.run(main())`,
      benefits: [
        '78% overall equipment effectiveness',
        '45% reduction in energy costs',
        'Real-time factory visibility',
        'Integrated predictive maintenance'
      ]
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Manufacturing Examples</h1>
        <p className="text-gray-600 text-lg">
          Production-ready implementations showcasing manufacturing intelligence, IoT integration, 
          predictive maintenance, and smart factory automation.
        </p>
      </div>

      {/* Example Selection */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(examples).map(([key, example]) => {
          const Icon = example.icon
          return (
            <button
              key={key}
              onClick={() => setActiveExample(key)}
              className={`p-4 rounded-lg border text-left transition-all ${
                activeExample === key
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <Icon className={`h-6 w-6 mb-2 ${
                activeExample === key ? 'text-orange-600' : 'text-gray-400'
              }`} />
              <h3 className="font-medium text-gray-900 mb-1">{example.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{example.description}</p>
              <div className="flex flex-wrap gap-1">
                {example.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-1 text-xs rounded ${
                      activeExample === key
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* Active Example Display */}
      {activeExample && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Example Header */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              {React.createElement(examples[activeExample].icon, {
                className: "h-8 w-8 text-orange-600"
              })}
              <h2 className="text-2xl font-semibold text-gray-900">
                {examples[activeExample].title}
              </h2>
            </div>
            <p className="text-gray-600 mb-4">
              {examples[activeExample].description}
            </p>
            <div className="flex flex-wrap gap-2">
              {examples[activeExample].tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-orange-200 text-orange-800 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Implementation Code */}
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Complete Implementation</h3>
              <CodeBlock
                code={examples[activeExample].implementation}
                language="python"
                title="Manufacturing Integration Example"
              />
            </div>

            {/* Benefits */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">Key Benefits</h4>
              <ul className="space-y-1">
                {examples[activeExample].benefits.map((benefit, index) => (
                  <li key={index} className="text-green-800 text-sm flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-2"></span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Related Resources */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Related Resources</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Getting Started</h3>
            <p className="text-gray-600 text-sm mb-4">
              Step-by-step guide to set up your manufacturing integration
            </p>
            <a 
              href="/getting-started/manufacturing" 
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              View Guide →
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-gray-600 text-sm mb-4">
              Complete API documentation for manufacturing endpoints
            </p>
            <a 
              href="/api-reference/manufacturing-iot" 
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              View APIs →
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Tutorials</h3>
            <p className="text-gray-600 text-sm mb-4">
              Hands-on tutorials for IoT setup and digital twin creation
            </p>
            <a 
              href="/tutorials/manufacturing-iot-setup" 
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              Start Tutorial →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}