'use client'

import Link from 'next/link'
import { CheckIcon, CogIcon, WrenchScrewdriverIcon, CircuitBoardIcon, ChartBarIcon, CubeIcon, KeyIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function ManufacturingGettingStarted() {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev => 
      prev.includes(stepNumber) 
        ? prev.filter(s => s !== stepNumber)
        : [...prev, stepNumber]
    )
  }

  const steps = [
    {
      id: 1,
      title: "Get Your API Key",
      icon: KeyIcon,
      description: "Create an account and obtain your manufacturing-enabled API key",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            First, you'll need to sign up for a Schlep Engine account and get your API key with manufacturing permissions.
          </p>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-800 mb-3"><strong>Steps to get your API key:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-orange-700">
              <li>Sign up at <Link href="https://dashboard.schlep-engine.com" className="underline">dashboard.schlep-engine.com</Link></li>
              <li>Navigate to API Keys section</li>
              <li>Create a new API key with Manufacturing permissions</li>
              <li>Enable IoT, Analytics, and Digital Twin modules</li>
              <li>Copy and securely store your API key</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "Install SDK & Configure IoT",
      icon: CircuitBoardIcon,
      description: "Install SDK and configure industrial protocol connections",
      content: (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Python</h4>
              <code className="text-sm bg-black text-green-400 p-2 rounded block">
                pip install schlep-engine[manufacturing]
              </code>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Node.js</h4>
              <code className="text-sm bg-black text-green-400 p-2 rounded block">
                npm install @schlep-engine/manufacturing
              </code>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h4 className="font-medium text-orange-800 mb-2">Industrial Protocol Support</h4>
            <ul className="space-y-1 text-sm text-orange-700">
              <li>• <strong>OPC-UA:</strong> Server and client connectivity for modern industrial systems</li>
              <li>• <strong>MQTT:</strong> Lightweight messaging for IoT edge devices</li>
              <li>• <strong>Modbus TCP/RTU:</strong> Legacy equipment and PLC communication</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "Initialize Manufacturing Client",
      icon: CogIcon,
      description: "Set up authentication and connect to your first industrial system",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Python Example</h4>
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`from schlep_engine import SchlepClient

# Initialize manufacturing client
client = SchlepClient(
    api_key="your_api_key_here",
    environment="production",
    modules=["manufacturing", "iot", "analytics"]
)

# Test manufacturing connectivity
status = client.manufacturing.health_check()
print(f"Manufacturing Status: {status}")

# Configure OPC-UA connection
opc_connection = client.iot.configure_opcua(
    endpoint_url="opc.tcp://192.168.1.100:4840",
    security_policy="Basic256Sha256",
    authentication={
        "username": "operator",
        "password": "secure_password"
    }
)

print(f"OPC-UA Connected: {opc_connection.status}")`}
            </pre>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">TypeScript Example</h4>
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`import { SchlepClient } from '@schlep-engine/manufacturing';

// Initialize manufacturing client
const client = new SchlepClient({
  apiKey: 'your_api_key_here',
  environment: 'production',
  modules: ['manufacturing', 'iot', 'analytics']
});

// Test manufacturing connectivity
const status = await client.manufacturing.healthCheck();
console.log(\`Manufacturing Status: \${status}\`);

// Configure MQTT connection
const mqttConnection = await client.iot.configureMqtt({
  brokerUrl: 'mqtt://192.168.1.101:1883',
  clientId: 'schlep-engine-client',
  credentials: {
    username: 'iot_user',
    password: 'mqtt_password'
  },
  topics: ['sensors/+/temperature', 'sensors/+/pressure']
});`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Connect IoT Data Sources",
      icon: WrenchScrewdriverIcon,
      description: "Set up real-time data ingestion from industrial equipment",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Connect your industrial equipment and start collecting sensor data for analytics and predictive maintenance.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`# Define equipment and sensors
equipment = client.iot.register_equipment(
    equipment_id="motor_pump_A01",
    name="Primary Water Pump Motor",
    type="centrifugal_pump",
    location="Plant Floor A",
    specifications={
        "power_rating": "15kW",
        "max_flow_rate": "500 L/min",
        "operating_pressure": "6 bar"
    }
)

# Configure sensor mappings
sensors = client.iot.configure_sensors(
    equipment_id="motor_pump_A01",
    sensors=[
        {
            "name": "temperature",
            "tag": "ns=2;s=PumpA01.Temperature",
            "unit": "celsius",
            "sample_rate": 1000,  # 1 second
            "alarm_thresholds": {"high": 85, "critical": 95}
        },
        {
            "name": "vibration",
            "tag": "ns=2;s=PumpA01.Vibration",
            "unit": "mm/s",
            "sample_rate": 5000,  # 5 seconds
            "alarm_thresholds": {"high": 4.5, "critical": 7.0}
        },
        {
            "name": "pressure",
            "tag": "ns=2;s=PumpA01.Pressure",
            "unit": "bar",
            "sample_rate": 1000,  # 1 second
            "alarm_thresholds": {"low": 4.0, "high": 8.0}
        }
    ]
)

# Start real-time data collection
stream = client.iot.start_data_stream(
    equipment_id="motor_pump_A01",
    buffer_size=1000,
    processing_mode="real_time"
)

print(f"Data stream started: {stream.stream_id}")
print(f"Collecting data from {len(sensors)} sensors")`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 5,
      title: "Set Up Analytics & Monitoring",
      icon: ChartBarIcon,
      description: "Configure predictive maintenance and quality monitoring",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Enable predictive analytics to monitor equipment health and detect anomalies before failures occur.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`# Configure predictive maintenance
maintenance_model = client.analytics.setup_predictive_maintenance(
    equipment_id="motor_pump_A01",
    model_type="anomaly_detection",
    training_period_days=30,
    prediction_horizon_days=14,
    features=[
        "temperature_mean", "temperature_std",
        "vibration_rms", "vibration_peak",
        "pressure_mean", "pressure_variation"
    ],
    thresholds={
        "warning": 0.7,
        "critical": 0.9
    }
)

# Set up real-time monitoring
monitor = client.analytics.create_monitor(
    name="Pump A01 Health Monitor",
    equipment_id="motor_pump_A01",
    checks=[
        {
            "type": "threshold",
            "metric": "temperature",
            "condition": "> 85",
            "severity": "warning"
        },
        {
            "type": "trend",
            "metric": "vibration",
            "condition": "increasing > 0.1/hour",
            "severity": "critical"
        },
        {
            "type": "predictive",
            "model_id": maintenance_model.id,
            "condition": "failure_probability > 0.7",
            "severity": "warning"
        }
    ],
    notification_channels=["email", "webhook"]
)

# Configure Statistical Process Control
spc_chart = client.analytics.setup_spc_chart(
    equipment_id="motor_pump_A01",
    metric="pressure",
    chart_type="x_bar_r",
    subgroup_size=10,
    control_limits="3_sigma",
    update_frequency=300  # 5 minutes
)

print(f"Predictive maintenance model: {maintenance_model.id}")
print(f"Monitor configured: {monitor.id}")
print(f"SPC chart created: {spc_chart.id}")`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 6,
      title: "Create Digital Twin",
      icon: CubeIcon,
      description: "Build a digital representation of your manufacturing process",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Create a digital twin to simulate, optimize, and predict the behavior of your manufacturing processes.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`# Create digital twin
digital_twin = client.digital_twin.create(
    name="Water Pump System Digital Twin",
    description="Digital representation of primary water pump system",
    physical_asset_id="motor_pump_A01",
    model_type="physics_informed",
    components=[
        {
            "name": "motor",
            "type": "electric_motor",
            "parameters": {
                "power_rating": 15000,  # watts
                "efficiency": 0.92,
                "pole_pairs": 2
            }
        },
        {
            "name": "pump",
            "type": "centrifugal_pump",
            "parameters": {
                "impeller_diameter": 0.25,  # meters
                "max_flow_rate": 8.33,      # L/s
                "head_coefficient": 0.85
            }
        },
        {
            "name": "piping_system",
            "type": "pipe_network",
            "parameters": {
                "total_length": 50,  # meters
                "diameter": 0.1,     # meters
                "roughness": 0.0015  # meters
            }
        }
    ]
)

# Synchronize with real-time data
sync_config = client.digital_twin.configure_sync(
    twin_id=digital_twin.id,
    data_sources=[
        {
            "sensor": "temperature",
            "mapping": "motor.temperature",
            "frequency": 1  # Hz
        },
        {
            "sensor": "vibration",
            "mapping": "motor.vibration",
            "frequency": 0.2  # Hz
        },
        {
            "sensor": "pressure",
            "mapping": "pump.discharge_pressure",
            "frequency": 1  # Hz
        }
    ],
    simulation_frequency=10  # seconds
)

# Run simulation scenarios
simulation = client.digital_twin.run_simulation(
    twin_id=digital_twin.id,
    scenario="increased_load",
    parameters={
        "flow_rate_increase": 1.2,  # 20% increase
        "duration": 3600  # 1 hour
    },
    outputs=["temperature", "power_consumption", "efficiency"]
)

print(f"Digital twin created: {digital_twin.id}")
print(f"Simulation running: {simulation.simulation_id}")`}
            </pre>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <CogIcon className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Manufacturing Quick Start</h1>
        </div>
        <p className="text-xl text-gray-600">
          Get started with Schlep Engine's Manufacturing platform in under 15 minutes. 
          Set up IoT data collection, predictive analytics, and digital twin modeling.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Getting Started Progress</h3>
          <span className="text-sm text-orange-600 font-medium">
            {completedSteps.length} of {steps.length} steps completed
          </span>
        </div>
        <div className="w-full bg-orange-200 rounded-full h-2">
          <div 
            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-8">
        {steps.map((step) => {
          const Icon = step.icon
          const isCompleted = completedSteps.includes(step.id)
          
          return (
            <div key={step.id} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-lg
                    ${isCompleted ? 'bg-green-100 border-green-200' : 'bg-orange-100 border-orange-200'}
                    border cursor-pointer transition-colors
                  `} onClick={() => toggleStep(step.id)}>
                    {isCompleted ? (
                      <CheckIcon className="h-6 w-6 text-green-600" />
                    ) : (
                      <Icon className="h-6 w-6 text-orange-600" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Step {step.id}: {step.title}
                    </h3>
                    <button
                      onClick={() => toggleStep(step.id)}
                      className={`
                        px-3 py-1 rounded-full text-xs font-medium transition-colors
                        ${isCompleted 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                        }
                      `}
                    >
                      {isCompleted ? 'Completed' : 'Mark Complete'}
                    </button>
                  </div>
                  
                  <p className="text-gray-600">{step.description}</p>
                  
                  <div className="mt-4">
                    {step.content}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-8 border border-orange-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">What's Next?</h2>
        <p className="text-gray-600 mb-6">
          Now that you've completed the basic setup, explore advanced manufacturing features and integration patterns.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/tutorials/manufacturing-iot-setup" className="bg-white p-4 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">IoT Setup Tutorial</h3>
            <p className="text-sm text-gray-600">Advanced industrial protocol configuration</p>
          </Link>
          <Link href="/examples/manufacturing" className="bg-white p-4 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Code Examples</h3>
            <p className="text-sm text-gray-600">Real-world manufacturing implementations</p>
          </Link>
          <Link href="/api-reference/manufacturing-iot" className="bg-white p-4 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-sm text-gray-600">Complete Manufacturing API documentation</p>
          </Link>
        </div>
      </div>

      {/* Support */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Need Help?</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Documentation</h4>
            <ul className="space-y-1 text-gray-600">
              <li><Link href="/api-reference/manufacturing-iot" className="hover:text-orange-600">Manufacturing IoT API</Link></li>
              <li><Link href="/api-reference/digital-twin" className="hover:text-orange-600">Digital Twin API</Link></li>
              <li><Link href="/guides/manufacturing-workflows" className="hover:text-orange-600">Manufacturing Workflows</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Community</h4>
            <ul className="space-y-1 text-gray-600">
              <li><a href="mailto:manufacturing-support@schlep-engine.com" className="hover:text-orange-600">Manufacturing Support</a></li>
              <li><a href="https://github.com/schlep-engine/manufacturing-examples" className="hover:text-orange-600">GitHub Examples</a></li>
              <li><a href="https://discord.gg/schlep-engine-manufacturing" className="hover:text-orange-600">Discord Channel</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}