'use client'

import Link from 'next/link'
import { CubeIcon, CogIcon, BeakerIcon, ChartBarIcon, RocketLaunchIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function DigitalTwinSetupTutorial() {
  const [activeTab, setActiveTab] = useState('overview')

  const codeExamples = {
    basic_twin: `from schlep_engine import SchlepClient
from datetime import datetime
import numpy as np

# Initialize client
client = SchlepClient(api_key="your_api_key_here")

# Create a basic digital twin for a centrifugal pump
async def create_pump_digital_twin():
    
    # Define the physical asset
    physical_asset = {
        "equipment_id": "motor_pump_A01",
        "name": "Primary Water Pump Motor",
        "location": "Plant Floor A", 
        "manufacturer": "HydroTech Industries",
        "model": "HT-2500",
        "serial_number": "HT2024-001234",
        "installation_date": "2024-01-15",
        "specifications": {
            "power_rating": 15000,  # watts
            "max_flow_rate": 500,   # L/min
            "max_head": 80,         # meters
            "efficiency": 0.85,     # 85%
            "impeller_diameter": 250,  # mm
            "shaft_speed": 2900     # RPM
        }
    }
    
    # Create the digital twin
    digital_twin = await client.digital_twin.create(
        name="Pump A01 Digital Twin",
        description="Physics-based model of centrifugal pump system",
        physical_asset_id=physical_asset["equipment_id"],
        model_type="physics_informed",
        
        # Define twin components
        components=[
            {
                "name": "electric_motor",
                "type": "induction_motor",
                "parameters": {
                    "rated_power": 15000,      # W
                    "rated_voltage": 400,      # V
                    "rated_frequency": 50,     # Hz
                    "efficiency": 0.92,        # 92%
                    "power_factor": 0.85,
                    "slip": 0.03,              # 3%
                    "pole_pairs": 2,
                    "moment_of_inertia": 0.5   # kg⋅m²
                }
            },
            {
                "name": "centrifugal_pump",
                "type": "pump",
                "parameters": {
                    "impeller_diameter": 0.25,   # m
                    "impeller_width": 0.03,      # m
                    "blade_count": 6,
                    "blade_angle": 25,           # degrees
                    "volute_area": 0.02,         # m²
                    "efficiency_curve": [        # Flow vs efficiency points
                        {"flow": 0, "efficiency": 0},
                        {"flow": 100, "efficiency": 0.70},
                        {"flow": 250, "efficiency": 0.85},
                        {"flow": 400, "efficiency": 0.82},
                        {"flow": 500, "efficiency": 0.75}
                    ]
                }
            },
            {
                "name": "piping_system",
                "type": "pipe_network",
                "parameters": {
                    "suction_pipe": {
                        "diameter": 0.15,        # m
                        "length": 10,            # m
                        "roughness": 0.0015,     # m
                        "elevation_change": -2   # m
                    },
                    "discharge_pipe": {
                        "diameter": 0.12,        # m  
                        "length": 50,            # m
                        "roughness": 0.0015,     # m
                        "elevation_change": 15   # m
                    },
                    "fittings": [
                        {"type": "90_degree_elbow", "count": 4, "k_factor": 0.9},
                        {"type": "gate_valve", "count": 2, "k_factor": 0.2},
                        {"type": "check_valve", "count": 1, "k_factor": 2.5}
                    ]
                }
            },
            {
                "name": "control_system",
                "type": "vfd_controller", 
                "parameters": {
                    "frequency_range": {"min": 30, "max": 60},  # Hz
                    "ramp_rate": 2.0,        # Hz/s
                    "pid_parameters": {
                        "kp": 1.0,
                        "ki": 0.1, 
                        "kd": 0.01
                    }
                }
            }
        ],
        
        # Define physics equations
        physics_model={
            "equations": [
                {
                    "name": "pump_head_curve",
                    "formula": "H = a*Q^2 + b*Q + c",
                    "coefficients": {"a": -1.2e-5, "b": 0.02, "c": 85},
                    "variables": {"H": "head", "Q": "flow_rate"}
                },
                {
                    "name": "motor_power",
                    "formula": "P = (rho * g * Q * H) / (eta_pump * eta_motor)",
                    "constants": {"rho": 1000, "g": 9.81},
                    "variables": {"P": "power", "Q": "flow_rate", "H": "head"}
                },
                {
                    "name": "system_curve", 
                    "formula": "H_sys = H_static + K * Q^2",
                    "coefficients": {"H_static": 15, "K": 8e-6},
                    "variables": {"H_sys": "system_head", "Q": "flow_rate"}
                }
            ]
        }
    )
    
    print(f"✅ Digital twin created: {digital_twin.twin_id}")
    return digital_twin

# Run the setup
digital_twin = await create_pump_digital_twin()`,

    data_sync: `# Configure real-time data synchronization
async def configure_twin_synchronization(twin_id):
    
    # Map IoT sensor data to digital twin parameters
    sync_config = await client.digital_twin.configure_sync(
        twin_id=twin_id,
        
        # Real-time data mappings
        data_mappings=[
            {
                "sensor_id": "temperature_motor",
                "twin_parameter": "electric_motor.temperature",
                "data_source": "iot_sensor",
                "update_frequency": 1.0,  # Hz
                "validation_rules": {
                    "min_value": 20,
                    "max_value": 150,
                    "rate_of_change_limit": 10  # °C/min
                }
            },
            {
                "sensor_id": "vibration_motor", 
                "twin_parameter": "electric_motor.vibration",
                "data_source": "iot_sensor",
                "update_frequency": 10.0,  # Hz
                "preprocessing": ["rms", "frequency_analysis"]
            },
            {
                "sensor_id": "pressure_suction",
                "twin_parameter": "piping_system.suction_pressure", 
                "data_source": "iot_sensor",
                "update_frequency": 2.0,  # Hz
                "unit_conversion": {"from": "psi", "to": "bar"}
            },
            {
                "sensor_id": "pressure_discharge",
                "twin_parameter": "centrifugal_pump.discharge_pressure",
                "data_source": "iot_sensor", 
                "update_frequency": 2.0,  # Hz
                "unit_conversion": {"from": "psi", "to": "bar"}
            },
            {
                "sensor_id": "flow_rate_main",
                "twin_parameter": "centrifugal_pump.flow_rate",
                "data_source": "iot_sensor",
                "update_frequency": 1.0,  # Hz
                "smoothing": {"method": "moving_average", "window": 5}
            },
            {
                "sensor_id": "power_consumption",
                "twin_parameter": "electric_motor.power_actual",
                "data_source": "iot_sensor", 
                "update_frequency": 0.5,  # Hz
            },
            {
                "sensor_id": "frequency_vfd",
                "twin_parameter": "control_system.frequency_setpoint",
                "data_source": "control_system",
                "update_frequency": 0.1   # Hz
            }
        ],
        
        # Calculated parameters (derived from sensors)
        calculated_parameters=[
            {
                "name": "pump_efficiency",
                "formula": "(flow_rate * head * density * gravity) / power_actual",
                "inputs": ["flow_rate", "head", "power_actual"],
                "constants": {"density": 1000, "gravity": 9.81},
                "update_frequency": 1.0
            },
            {
                "name": "system_efficiency", 
                "formula": "pump_efficiency * motor_efficiency",
                "inputs": ["pump_efficiency", "motor_efficiency"],
                "update_frequency": 1.0
            },
            {
                "name": "cavitation_margin",
                "formula": "suction_pressure - vapor_pressure - friction_loss",
                "inputs": ["suction_pressure"],
                "constants": {"vapor_pressure": 0.023, "friction_loss": 0.2},
                "update_frequency": 2.0
            }
        ],
        
        # State estimation (for unmeasured parameters)
        state_estimation={
            "method": "kalman_filter",
            "parameters": [
                {
                    "name": "bearing_temperature",
                    "model": "thermal_model",
                    "inputs": ["motor_temperature", "vibration", "ambient_temperature"],
                    "uncertainty": 2.0
                },
                {
                    "name": "impeller_wear",
                    "model": "wear_model", 
                    "inputs": ["flow_rate", "head", "efficiency_degradation"],
                    "uncertainty": 0.1
                }
            ]
        }
    )
    
    print(f"✅ Synchronization configured with {len(sync_config.data_mappings)} sensors")
    return sync_config`,

    simulation: `# Run digital twin simulations
async def run_twin_simulations(twin_id):
    
    # Scenario 1: Performance optimization
    optimization_scenario = await client.digital_twin.create_scenario(
        twin_id=twin_id,
        name="flow_rate_optimization",
        description="Find optimal operating point for energy efficiency",
        scenario_type="optimization",
        
        # Define optimization parameters
        optimization_config={
            "objective": "minimize_energy_consumption",
            "constraints": [
                {"parameter": "flow_rate", "min": 200, "max": 450},
                {"parameter": "discharge_pressure", "min": 4.0, "max": 7.5},
                {"parameter": "motor_temperature", "max": 80},
                {"parameter": "cavitation_margin", "min": 1.0}
            ],
            "variables": [
                {"parameter": "vfd_frequency", "min": 35, "max": 55},
                {"parameter": "valve_position", "min": 20, "max": 100}
            ]
        }
    )
    
    # Run optimization simulation
    optimization_result = await client.digital_twin.run_simulation(
        scenario_id=optimization_scenario.scenario_id,
        duration=3600,  # 1 hour simulation
        timestep=10,    # 10 second intervals
        
        # Initial conditions
        initial_conditions={
            "flow_rate": 300,           # L/min
            "vfd_frequency": 45,        # Hz
            "valve_position": 75,       # % open
            "ambient_temperature": 25   # °C
        }
    )
    
    print(f"Optimization completed:")
    print(f"  - Optimal frequency: {optimization_result.optimal_parameters['vfd_frequency']:.1f} Hz")
    print(f"  - Energy savings: {optimization_result.energy_savings:.1f}%")
    
    # Scenario 2: Failure prediction
    failure_scenario = await client.digital_twin.create_scenario(
        twin_id=twin_id,
        name="bearing_failure_prediction",
        description="Predict bearing failure based on current operating conditions",
        scenario_type="predictive",
        
        # Failure mode configuration
        failure_config={
            "failure_mode": "bearing_degradation",
            "progression_model": "weibull",
            "parameters": {
                "beta": 2.0,        # Weibull shape parameter
                "eta": 8760,        # Scale parameter (hours)
                "gamma": 0          # Location parameter
            },
            "accelerating_factors": [
                {"parameter": "temperature", "coefficient": 0.1},
                {"parameter": "vibration", "coefficient": 0.2},
                {"parameter": "load_factor", "coefficient": 0.05}
            ]
        }
    )
    
    # Run failure prediction
    prediction_result = await client.digital_twin.run_simulation(
        scenario_id=failure_scenario.scenario_id,
        prediction_horizon=720,  # 30 days
        monte_carlo_runs=1000,   # For uncertainty quantification
        
        current_conditions={
            "bearing_temperature": 65,    # °C
            "vibration_rms": 3.2,        # mm/s
            "load_factor": 0.85,         # 85% of rated load
            "operating_hours": 12500     # Current operating hours
        }
    )
    
    print(f"Failure prediction:")
    print(f"  - Probability of failure in 30 days: {prediction_result.failure_probability:.2%}")
    print(f"  - Estimated remaining useful life: {prediction_result.remaining_life:.0f} hours")
    
    # Scenario 3: What-if analysis
    whatif_scenario = await client.digital_twin.create_scenario(
        twin_id=twin_id,
        name="increased_demand_response",
        description="Impact of 25% flow rate increase on system performance",
        scenario_type="what_if"
    )
    
    # Run what-if simulation
    whatif_result = await client.digital_twin.run_simulation(
        scenario_id=whatif_scenario.scenario_id,
        duration=86400,  # 24 hours
        timestep=300,    # 5 minute intervals
        
        # Modified operating conditions
        modifications={
            "flow_rate_demand": 375,     # 25% increase from 300 L/min
            "ambient_temperature": 35,   # Higher ambient temperature
            "system_back_pressure": 6.2  # Slightly higher back pressure
        },
        
        # Monitor specific outputs
        outputs=[
            "power_consumption",
            "motor_temperature", 
            "pump_efficiency",
            "cavitation_risk",
            "system_stability"
        ]
    )
    
    print(f"What-if analysis results:")
    print(f"  - Power increase: {whatif_result.power_increase:.1f}%") 
    print(f"  - Temperature rise: {whatif_result.temperature_increase:.1f}°C")
    print(f"  - Efficiency change: {whatif_result.efficiency_change:+.1f}%")
    
    return {
        "optimization": optimization_result,
        "prediction": prediction_result, 
        "what_if": whatif_result
    }`,

    monitoring: `# Set up digital twin monitoring and alerts
async def setup_twin_monitoring(twin_id):
    
    # Configure real-time twin health monitoring
    monitoring_config = await client.digital_twin.setup_monitoring(
        twin_id=twin_id,
        
        # Model accuracy monitoring
        accuracy_monitoring={
            "enable": True,
            "validation_sensors": [
                "flow_rate", "discharge_pressure", "power_consumption"
            ],
            "accuracy_threshold": 0.95,  # 95% accuracy
            "evaluation_window": "1h",   # Hourly evaluation
            "alert_on_degradation": True
        },
        
        # Digital twin KPIs
        kpi_monitoring=[
            {
                "name": "model_prediction_error",
                "metric": "mean_absolute_percentage_error",
                "threshold": 5.0,  # 5% MAPE
                "alert_severity": "warning"
            },
            {
                "name": "simulation_performance", 
                "metric": "simulation_runtime",
                "threshold": 30.0,  # 30 seconds
                "alert_severity": "info"
            },
            {
                "name": "data_freshness",
                "metric": "last_update_age",
                "threshold": 300,  # 5 minutes
                "alert_severity": "critical"
            }
        ],
        
        # Anomaly detection in twin behavior
        anomaly_detection={
            "enable": True,
            "method": "isolation_forest",
            "features": [
                "efficiency_deviation",
                "power_prediction_error", 
                "temperature_prediction_error",
                "vibration_pattern_change"
            ],
            "sensitivity": 0.1,
            "alert_threshold": 0.8
        },
        
        # Automated twin maintenance
        maintenance_actions=[
            {
                "trigger": "accuracy_degradation",
                "action": "retrain_model",
                "parameters": {
                    "data_window": "30d",
                    "validation_split": 0.2,
                    "approval_required": False
                }
            },
            {
                "trigger": "sensor_failure", 
                "action": "switch_to_virtual_sensor",
                "parameters": {
                    "backup_sensors": ["calculated_flow", "estimated_pressure"],
                    "confidence_threshold": 0.85
                }
            },
            {
                "trigger": "simulation_timeout",
                "action": "restart_simulation_engine",
                "parameters": {
                    "max_retries": 3,
                    "backoff_strategy": "exponential"
                }
            }
        ]
    )
    
    # Set up twin-specific dashboards
    dashboard_config = await client.digital_twin.create_dashboard(
        twin_id=twin_id,
        name="Pump A01 Digital Twin Dashboard",
        
        # Dashboard panels
        panels=[
            {
                "type": "real_time_comparison",
                "title": "Actual vs Predicted Performance",
                "metrics": ["flow_rate", "power_consumption", "efficiency"],
                "time_range": "1h"
            },
            {
                "type": "3d_model_visualization",
                "title": "3D Twin Visualization", 
                "components": ["motor", "pump", "piping"],
                "color_coding": "temperature"
            },
            {
                "type": "scenario_results",
                "title": "Optimization Recommendations",
                "scenarios": ["flow_rate_optimization"],
                "refresh_interval": 300
            },
            {
                "type": "failure_prediction",
                "title": "Predictive Maintenance",
                "prediction_horizon": "30d",
                "components": ["bearings", "impeller", "seals"]
            },
            {
                "type": "model_accuracy",
                "title": "Twin Model Performance",
                "metrics": ["prediction_error", "data_freshness", "simulation_time"],
                "time_range": "24h"
            }
        ]
    )
    
    # Configure alert routing
    alert_config = await client.digital_twin.configure_alerts(
        twin_id=twin_id,
        
        alert_channels=[
            {
                "type": "email",
                "recipients": ["maintenance@company.com"],
                "severity_filter": ["warning", "critical"],
                "aggregation_window": "15m"
            },
            {
                "type": "webhook",
                "url": "https://api.company.com/maintenance/alerts",
                "headers": {"Authorization": "Bearer maintenance_api_key"},
                "severity_filter": ["critical"]
            },
            {
                "type": "dashboard_notification",
                "dashboard_id": dashboard_config.dashboard_id,
                "severity_filter": ["info", "warning", "critical"]
            }
        ],
        
        # Alert suppression rules
        suppression_rules=[
            {
                "condition": "model_retraining_in_progress",
                "suppress_alerts": ["accuracy_degradation"],
                "duration": "1h"
            },
            {
                "condition": "maintenance_mode",
                "suppress_alerts": ["all"],
                "manual_override": True
            }
        ]
    )
    
    print(f"✅ Monitoring configured:")
    print(f"  - Dashboard: {dashboard_config.dashboard_url}")
    print(f"  - KPI monitors: {len(monitoring_config.kpi_monitors)}")
    print(f"  - Alert channels: {len(alert_config.channels)}")
    
    return {
        "monitoring": monitoring_config,
        "dashboard": dashboard_config,
        "alerts": alert_config
    }`
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: CubeIcon },
    { id: 'creation', name: 'Twin Creation', icon: CogIcon },
    { id: 'synchronization', name: 'Data Sync', icon: RocketLaunchIcon },
    { id: 'simulation', name: 'Simulation', icon: BeakerIcon },
    { id: 'monitoring', name: 'Monitoring', icon: ChartBarIcon }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <CubeIcon className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Digital Twin Setup Tutorial</h1>
        </div>
        <p className="text-xl text-gray-600">
          Complete guide to creating physics-based digital twins of your manufacturing equipment. 
          Build virtual models that sync with real-time data for predictive analytics and optimization.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What is a Digital Twin?</h2>
              <p className="text-gray-700 mb-4">
                A digital twin is a virtual representation of a physical asset that uses real-time data and physics-based models 
                to mirror the behavior, performance, and characteristics of its physical counterpart.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-purple-900">Real-time Sync</h3>
                  <ul className="space-y-1 text-sm text-purple-800">
                    <li>• Live sensor data integration</li>
                    <li>• Continuous state updates</li>
                    <li>• Bidirectional communication</li>
                    <li>• Automatic calibration</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-purple-900">Physics Models</h3>
                  <ul className="space-y-1 text-sm text-purple-800">
                    <li>• Thermodynamic equations</li>
                    <li>• Fluid dynamics modeling</li>
                    <li>• Mechanical system behavior</li>
                    <li>• Electrical characteristics</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-purple-900">Predictive Capabilities</h3>
                  <ul className="space-y-1 text-sm text-purple-800">
                    <li>• Performance optimization</li>
                    <li>• Failure prediction</li>
                    <li>• What-if scenario analysis</li>
                    <li>• Process simulation</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <CubeIcon className="h-8 w-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Digital Twin Components</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Each digital twin consists of multiple interconnected components that model different aspects of the physical system.
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Physical asset representation</li>
                  <li>• Real-time data connectors</li>
                  <li>• Physics-based equations</li>
                  <li>• Machine learning models</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <BeakerIcon className="h-8 w-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Use Cases</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Digital twins enable advanced analytics and decision-making across manufacturing operations.
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Predictive maintenance scheduling</li>
                  <li>• Energy efficiency optimization</li>
                  <li>• Process parameter tuning</li>
                  <li>• Root cause analysis</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Prerequisites</h3>
              <ul className="space-y-1 text-sm text-yellow-700">
                <li>• Active IoT data collection (see <Link href="/tutorials/manufacturing-iot-setup" className="underline">IoT Setup Tutorial</Link>)</li>
                <li>• Equipment specifications and physics models</li>
                <li>• Historical operating data for calibration</li>
                <li>• Schlep Engine API key with Digital Twin permissions</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'creation' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Creating Your First Digital Twin</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Pump Digital Twin Setup</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.basic_twin}
              </pre>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Component Types</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Motors:</strong> Induction, synchronous, servo motors</li>
                  <li>• <strong>Pumps:</strong> Centrifugal, positive displacement</li>
                  <li>• <strong>Pipes:</strong> Network topology and flow characteristics</li>
                  <li>• <strong>Controls:</strong> VFDs, PLCs, valve actuators</li>
                  <li>• <strong>Sensors:</strong> Virtual sensor modeling</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Physics Models</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Fluid Dynamics:</strong> Pump curves, system curves</li>
                  <li>• <strong>Thermodynamics:</strong> Heat transfer, efficiency</li>
                  <li>• <strong>Mechanical:</strong> Torque, vibration, wear</li>
                  <li>• <strong>Electrical:</strong> Power consumption, motor models</li>
                  <li>• <strong>Control:</strong> PID loops, setpoint tracking</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'synchronization' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Real-time Data Synchronization</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configure Twin Data Sync</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.data_sync}
              </pre>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-3">Data Synchronization Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Real-time Updates</h4>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>• Configurable update frequencies</li>
                    <li>• Data validation and quality checks</li>
                    <li>• Unit conversion and preprocessing</li>
                    <li>• Smoothing and noise filtering</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">State Estimation</h4>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>• Kalman filtering for unmeasured states</li>
                    <li>• Model-based parameter estimation</li>
                    <li>• Uncertainty quantification</li>
                    <li>• Virtual sensor capabilities</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Digital Twin Simulations</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Simulation Scenarios</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.simulation}
              </pre>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Optimization</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Energy efficiency maximization</li>
                  <li>• Multi-objective optimization</li>
                  <li>• Constraint-based solving</li>
                  <li>• Pareto frontier analysis</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Prediction</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Failure mode progression</li>
                  <li>• Remaining useful life</li>
                  <li>• Reliability analysis</li>
                  <li>• Maintenance scheduling</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">What-if Analysis</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Scenario comparison</li>
                  <li>• Sensitivity analysis</li>
                  <li>• Risk assessment</li>
                  <li>• Impact quantification</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Twin Monitoring & Maintenance</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Comprehensive Monitoring Setup</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.monitoring}
              </pre>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Model Health Monitoring</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Prediction accuracy tracking</li>
                  <li>• Model drift detection</li>
                  <li>• Data quality assessment</li>
                  <li>• Performance benchmarking</li>
                  <li>• Automatic model retraining</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Operational Monitoring</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Real-time dashboard visualization</li>
                  <li>• Alert management and escalation</li>
                  <li>• Simulation performance tracking</li>
                  <li>• Resource usage optimization</li>
                  <li>• Maintenance action automation</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-8 border border-purple-100">
        <div className="flex items-center space-x-3 mb-4">
          <PlayCircleIcon className="h-6 w-6 text-purple-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Next Steps</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Your digital twin is now operational! Explore advanced features and integrate with other manufacturing systems.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/examples/manufacturing" className="bg-white p-4 rounded-lg border border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Real-world Examples</h3>
            <p className="text-sm text-gray-600">Digital twin implementation patterns</p>
          </Link>
          <Link href="/guides/manufacturing-workflows" className="bg-white p-4 rounded-lg border border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Best Practices</h3>
            <p className="text-sm text-gray-600">Digital twin optimization strategies</p>
          </Link>
          <Link href="/api-reference/digital-twin" className="bg-white p-4 rounded-lg border border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-sm text-gray-600">Complete Digital Twin API docs</p>
          </Link>
        </div>
      </div>
    </div>
  )
}