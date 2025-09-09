'use client'

import Link from 'next/link'
import { CircuitBoardIcon, CogIcon, WrenchScrewdriverIcon, ChartBarIcon, ServerIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function ManufacturingIoTSetupTutorial() {
  const [activeTab, setActiveTab] = useState('overview')

  const codeExamples = {
    opcua_setup: `from schlep_engine import SchlepClient
from opcua import Client
import asyncio
import logging

# Initialize Schlep Engine client
client = SchlepClient(
    api_key="your_api_key_here",
    modules=["manufacturing", "iot"]
)

# Configure OPC-UA connection
async def setup_opcua_connection():
    # OPC-UA server configuration
    opcua_config = {
        "endpoint_url": "opc.tcp://192.168.1.100:4840",
        "security_policy": "Basic256Sha256",
        "security_mode": "SignAndEncrypt",
        "authentication": {
            "username": "operator",
            "password": "secure_password"
        },
        "session_timeout": 60000,
        "secure_channel_timeout": 60000
    }
    
    # Create OPC-UA connection in Schlep Engine
    connection = await client.iot.create_opcua_connection(
        name="main_plc_connection",
        config=opcua_config,
        auto_reconnect=True,
        heartbeat_interval=30
    )
    
    print(f"OPC-UA connection established: {connection.connection_id}")
    return connection

# Define node mappings for equipment
equipment_nodes = {
    "motor_pump_A01": {
        "temperature": "ns=2;s=PumpA01.Temperature",
        "vibration": "ns=2;s=PumpA01.Vibration", 
        "pressure": "ns=2;s=PumpA01.Pressure",
        "flow_rate": "ns=2;s=PumpA01.FlowRate",
        "power_consumption": "ns=2;s=PumpA01.Power",
        "operating_status": "ns=2;s=PumpA01.Status"
    },
    "conveyor_belt_B02": {
        "speed": "ns=2;s=ConveyorB02.Speed",
        "motor_current": "ns=2;s=ConveyorB02.Current",
        "belt_tension": "ns=2;s=ConveyorB02.Tension",
        "encoder_position": "ns=2;s=ConveyorB02.Position"
    }
}

# Register equipment and sensors
async def register_equipment():
    for equipment_id, nodes in equipment_nodes.items():
        # Register equipment
        equipment = await client.iot.register_equipment(
            equipment_id=equipment_id,
            name=equipment_id.replace('_', ' ').title(),
            equipment_type="industrial_machinery",
            location="Plant Floor A",
            manufacturer="Industrial Corp",
            model="IC-2024"
        )
        
        # Configure sensors for this equipment
        sensors = []
        for sensor_name, node_id in nodes.items():
            sensor = {
                "name": sensor_name,
                "node_id": node_id,
                "data_type": "float" if sensor_name != "operating_status" else "boolean",
                "unit": get_sensor_unit(sensor_name),
                "sample_rate": 1000,  # milliseconds
                "alarm_config": get_alarm_config(sensor_name)
            }
            sensors.append(sensor)
        
        await client.iot.configure_sensors(
            equipment_id=equipment_id,
            sensors=sensors
        )
        
        print(f"Configured {len(sensors)} sensors for {equipment_id}")

def get_sensor_unit(sensor_name):
    units = {
        "temperature": "celsius",
        "vibration": "mm/s",
        "pressure": "bar",
        "flow_rate": "L/min",
        "power_consumption": "kW",
        "speed": "rpm",
        "motor_current": "A",
        "belt_tension": "N",
        "encoder_position": "pulses"
    }
    return units.get(sensor_name, "")

def get_alarm_config(sensor_name):
    alarms = {
        "temperature": {"low": 10, "high": 80, "critical": 95},
        "vibration": {"high": 4.5, "critical": 7.0},
        "pressure": {"low": 3.0, "high": 8.0, "critical": 10.0},
        "flow_rate": {"low": 100, "high": 600},
        "power_consumption": {"high": 18.0, "critical": 22.0}
    }
    return alarms.get(sensor_name, {})

# Run the setup
if __name__ == "__main__":
    asyncio.run(setup_opcua_connection())
    asyncio.run(register_equipment())`,

    mqtt_setup: `import paho.mqtt.client as mqtt
import json
from datetime import datetime
from schlep_engine import SchlepClient

# Initialize Schlep Engine client
client = SchlepClient(api_key="your_api_key_here")

# MQTT Configuration
MQTT_BROKER = "192.168.1.101"
MQTT_PORT = 1883
MQTT_USERNAME = "iot_user"
MQTT_PASSWORD = "mqtt_password"

# Topic structure: sensors/{equipment_id}/{sensor_type}
MQTT_TOPICS = [
    "sensors/+/temperature",
    "sensors/+/vibration",
    "sensors/+/pressure",
    "sensors/+/flow_rate",
    "sensors/+/power"
]

class MQTTIoTHandler:
    def __init__(self):
        self.mqtt_client = mqtt.Client(client_id="schlep_engine_collector")
        self.mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.mqtt_client.on_connect = self.on_connect
        self.mqtt_client.on_message = self.on_message
        self.mqtt_client.on_disconnect = self.on_disconnect
        
        # Create MQTT connection in Schlep Engine
        self.schlep_connection = client.iot.create_mqtt_connection(
            name="factory_mqtt_broker",
            broker_url=f"mqtt://{MQTT_BROKER}:{MQTT_PORT}",
            client_id="schlep_engine_collector",
            topics=MQTT_TOPICS,
            qos=1,
            retain=False
        )
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT broker: {MQTT_BROKER}")
            # Subscribe to all sensor topics
            for topic in MQTT_TOPICS:
                client.subscribe(topic, qos=1)
                print(f"Subscribed to: {topic}")
        else:
            print(f"Failed to connect to MQTT broker, return code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        print(f"Disconnected from MQTT broker, return code {rc}")
        
    def on_message(self, client, userdata, msg):
        try:
            # Parse topic: sensors/{equipment_id}/{sensor_type}
            topic_parts = msg.topic.split('/')
            if len(topic_parts) != 3:
                print(f"Invalid topic format: {msg.topic}")
                return
                
            equipment_id = topic_parts[1]
            sensor_type = topic_parts[2]
            
            # Parse message payload
            payload = json.loads(msg.payload.decode())
            
            # Expected payload format:
            # {
            #   "value": 75.2,
            #   "timestamp": "2024-01-15T10:30:00Z",
            #   "quality": "good",
            #   "unit": "celsius"
            # }
            
            sensor_data = {
                "equipment_id": equipment_id,
                "sensor_type": sensor_type,
                "value": payload.get("value"),
                "timestamp": payload.get("timestamp", datetime.utcnow().isoformat()),
                "quality": payload.get("quality", "good"),
                "unit": payload.get("unit", ""),
                "source": "mqtt"
            }
            
            # Send data to Schlep Engine for processing
            self.process_sensor_data(sensor_data)
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON from {msg.topic}: {e}")
        except Exception as e:
            print(f"Error processing message from {msg.topic}: {e}")
    
    def process_sensor_data(self, sensor_data):
        try:
            # Send real-time data to Schlep Engine
            result = client.iot.ingest_sensor_data(
                equipment_id=sensor_data["equipment_id"],
                sensor_type=sensor_data["sensor_type"],
                value=sensor_data["value"],
                timestamp=sensor_data["timestamp"],
                quality=sensor_data["quality"],
                metadata={
                    "unit": sensor_data["unit"],
                    "source": sensor_data["source"]
                }
            )
            
            # Check for alarms or anomalies
            if result.get("alarm_triggered"):
                print(f"🚨 ALARM: {sensor_data['equipment_id']} - {sensor_data['sensor_type']}: {sensor_data['value']}")
            
            # Log data ingestion
            if result.get("status") == "success":
                print(f"✅ Data ingested: {sensor_data['equipment_id']}.{sensor_data['sensor_type']} = {sensor_data['value']}")
            
        except Exception as e:
            print(f"Failed to ingest sensor data: {e}")
    
    def start(self):
        print("Starting MQTT IoT data collection...")
        self.mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        self.mqtt_client.loop_forever()
    
    def stop(self):
        self.mqtt_client.disconnect()
        print("MQTT IoT handler stopped")

# Usage
if __name__ == "__main__":
    handler = MQTTIoTHandler()
    try:
        handler.start()
    except KeyboardInterrupt:
        print("\\nShutting down MQTT handler...")
        handler.stop()`,

    modbus_setup: `from pymodbus.client.sync import ModbusTcpClient
from pymodbus.exceptions import ConnectionException, ModbusException
import time
import threading
from schlep_engine import SchlepClient

# Initialize Schlep Engine client
client = SchlepClient(api_key="your_api_key_here")

class ModbusIoTCollector:
    def __init__(self):
        # Modbus device configurations
        self.devices = {
            "plc_station_1": {
                "host": "192.168.1.102",
                "port": 502,
                "unit_id": 1,
                "equipment_id": "packaging_line_A",
                "registers": {
                    "temperature_1": {"address": 40001, "type": "holding", "scale": 0.1, "unit": "celsius"},
                    "temperature_2": {"address": 40002, "type": "holding", "scale": 0.1, "unit": "celsius"},
                    "pressure_main": {"address": 40003, "type": "holding", "scale": 0.01, "unit": "bar"},
                    "flow_rate": {"address": 40004, "type": "holding", "scale": 1.0, "unit": "L/min"},
                    "production_count": {"address": 40010, "type": "holding", "scale": 1.0, "unit": "pieces"},
                    "line_status": {"address": 10001, "type": "coil", "scale": 1.0, "unit": "boolean"}
                }
            },
            "drive_controller": {
                "host": "192.168.1.103", 
                "port": 502,
                "unit_id": 2,
                "equipment_id": "conveyor_system_B",
                "registers": {
                    "motor_speed": {"address": 40001, "type": "holding", "scale": 1.0, "unit": "rpm"},
                    "motor_current": {"address": 40002, "type": "holding", "scale": 0.01, "unit": "A"},
                    "motor_torque": {"address": 40003, "type": "holding", "scale": 0.1, "unit": "Nm"},
                    "encoder_position": {"address": 40010, "type": "holding", "scale": 1.0, "unit": "pulses"},
                    "drive_fault": {"address": 10001, "type": "coil", "scale": 1.0, "unit": "boolean"}
                }
            }
        }
        
        self.clients = {}
        self.running = False
        self.poll_interval = 1.0  # seconds
        
    def connect_devices(self):
        """Establish Modbus connections to all devices"""
        for device_name, config in self.devices.items():
            try:
                modbus_client = ModbusTcpClient(
                    host=config["host"],
                    port=config["port"],
                    timeout=3
                )
                
                if modbus_client.connect():
                    self.clients[device_name] = {
                        "client": modbus_client,
                        "config": config
                    }
                    print(f"✅ Connected to {device_name} at {config['host']}:{config['port']}")
                    
                    # Register device in Schlep Engine
                    client.iot.register_modbus_device(
                        device_id=device_name,
                        equipment_id=config["equipment_id"],
                        host=config["host"],
                        port=config["port"],
                        unit_id=config["unit_id"]
                    )
                else:
                    print(f"❌ Failed to connect to {device_name}")
                    
            except Exception as e:
                print(f"Error connecting to {device_name}: {e}")
    
    def read_device_data(self, device_name):
        """Read all configured registers from a Modbus device"""
        if device_name not in self.clients:
            return {}
            
        device_client = self.clients[device_name]["client"]
        device_config = self.clients[device_name]["config"]
        equipment_id = device_config["equipment_id"]
        
        sensor_data = {}
        
        try:
            for sensor_name, reg_config in device_config["registers"].items():
                address = reg_config["address"]
                reg_type = reg_config["type"]
                scale = reg_config["scale"]
                unit = reg_config["unit"]
                
                # Read based on register type
                if reg_type == "holding":
                    # Convert to 0-based addressing (Modbus addressing can vary)
                    modbus_address = address - 40001 if address >= 40001 else address
                    result = device_client.read_holding_registers(
                        address=modbus_address,
                        count=1,
                        unit=device_config["unit_id"]
                    )
                elif reg_type == "input":
                    modbus_address = address - 30001 if address >= 30001 else address
                    result = device_client.read_input_registers(
                        address=modbus_address,
                        count=1,
                        unit=device_config["unit_id"]
                    )
                elif reg_type == "coil":
                    modbus_address = address - 10001 if address >= 10001 else address
                    result = device_client.read_coils(
                        address=modbus_address,
                        count=1,
                        unit=device_config["unit_id"]
                    )
                else:
                    continue
                
                if not result.isError():
                    if reg_type == "coil":
                        raw_value = result.bits[0]
                    else:
                        raw_value = result.registers[0]
                    
                    # Apply scaling
                    scaled_value = raw_value * scale
                    
                    sensor_data[sensor_name] = {
                        "value": scaled_value,
                        "unit": unit,
                        "quality": "good",
                        "timestamp": time.time()
                    }
                    
                else:
                    print(f"Error reading {sensor_name} from {device_name}: {result}")
                    
        except ModbusException as e:
            print(f"Modbus error reading from {device_name}: {e}")
        except Exception as e:
            print(f"Unexpected error reading from {device_name}: {e}")
            
        return sensor_data
    
    def send_data_to_schlep(self, equipment_id, sensor_data):
        """Send collected sensor data to Schlep Engine"""
        try:
            for sensor_name, data in sensor_data.items():
                client.iot.ingest_sensor_data(
                    equipment_id=equipment_id,
                    sensor_type=sensor_name,
                    value=data["value"],
                    timestamp=data["timestamp"],
                    quality=data["quality"],
                    metadata={
                        "unit": data["unit"],
                        "source": "modbus"
                    }
                )
            
            if sensor_data:
                print(f"📊 Sent {len(sensor_data)} sensor readings from {equipment_id}")
                
        except Exception as e:
            print(f"Error sending data to Schlep Engine: {e}")
    
    def poll_devices(self):
        """Continuously poll all connected Modbus devices"""
        print(f"Starting Modbus polling every {self.poll_interval} seconds...")
        
        while self.running:
            for device_name in self.clients.keys():
                try:
                    # Read sensor data from device
                    sensor_data = self.read_device_data(device_name)
                    equipment_id = self.clients[device_name]["config"]["equipment_id"]
                    
                    # Send to Schlep Engine
                    if sensor_data:
                        self.send_data_to_schlep(equipment_id, sensor_data)
                        
                except Exception as e:
                    print(f"Error polling {device_name}: {e}")
            
            time.sleep(self.poll_interval)
    
    def start(self):
        """Start the Modbus data collection"""
        self.connect_devices()
        
        if self.clients:
            self.running = True
            poll_thread = threading.Thread(target=self.poll_devices)
            poll_thread.daemon = True
            poll_thread.start()
            print("Modbus IoT collector started successfully")
            return poll_thread
        else:
            print("No Modbus devices connected, cannot start collector")
            return None
    
    def stop(self):
        """Stop data collection and close connections"""
        self.running = False
        for device_name, device_info in self.clients.items():
            try:
                device_info["client"].close()
                print(f"Disconnected from {device_name}")
            except:
                pass
        
        self.clients.clear()
        print("Modbus IoT collector stopped")

# Usage example
if __name__ == "__main__":
    collector = ModbusIoTCollector()
    
    try:
        poll_thread = collector.start()
        if poll_thread:
            poll_thread.join()  # Keep running until interrupted
    except KeyboardInterrupt:
        print("\\nShutting down Modbus collector...")
        collector.stop()`,

    data_processing: `from schlep_engine import SchlepClient
import numpy as np
from datetime import datetime, timedelta
import asyncio

client = SchlepClient(api_key="your_api_key_here")

# Configure real-time data processing pipelines
async def setup_data_processing():
    
    # 1. Data Validation Pipeline
    validation_pipeline = await client.iot.create_processing_pipeline(
        name="sensor_data_validation",
        description="Validate incoming sensor data quality and range",
        pipeline_type="validation",
        config={
            "rules": [
                {
                    "sensor_type": "temperature",
                    "min_value": -50,
                    "max_value": 150,
                    "required_quality": ["good", "uncertain"]
                },
                {
                    "sensor_type": "pressure",
                    "min_value": 0,
                    "max_value": 15,
                    "rate_limit": 1000  # max changes per hour
                },
                {
                    "sensor_type": "vibration",
                    "min_value": 0,
                    "max_value": 20,
                    "spike_detection": True
                }
            ],
            "actions": {
                "invalid_data": "quarantine",
                "missing_data": "interpolate",
                "spike_detected": "alert"
            }
        }
    )
    
    # 2. Real-time Analytics Pipeline
    analytics_pipeline = await client.iot.create_processing_pipeline(
        name="real_time_analytics",
        description="Calculate real-time statistics and derived metrics",
        pipeline_type="analytics",
        config={
            "window_size": "5m",  # 5-minute sliding window
            "calculations": [
                {
                    "metric": "temperature_moving_avg",
                    "function": "mean",
                    "sensor_type": "temperature",
                    "window": "10m"
                },
                {
                    "metric": "vibration_rms",
                    "function": "rms",
                    "sensor_type": "vibration",
                    "window": "1m"
                },
                {
                    "metric": "pressure_std",
                    "function": "std",
                    "sensor_type": "pressure",
                    "window": "5m"
                },
                {
                    "metric": "overall_equipment_effectiveness",
                    "function": "custom",
                    "formula": "(availability * performance * quality)",
                    "inputs": ["line_status", "production_rate", "defect_rate"]
                }
            ]
        }
    )
    
    # 3. Anomaly Detection Pipeline
    anomaly_pipeline = await client.iot.create_processing_pipeline(
        name="anomaly_detection",
        description="Detect equipment anomalies and predict failures",
        pipeline_type="ml_inference",
        config={
            "model_type": "isolation_forest",
            "features": [
                "temperature_moving_avg",
                "vibration_rms", 
                "pressure_std",
                "power_consumption"
            ],
            "detection_threshold": 0.1,
            "prediction_horizon": "24h",
            "retrain_frequency": "weekly"
        }
    )
    
    # 4. Alert and Notification Pipeline
    alert_pipeline = await client.iot.create_processing_pipeline(
        name="smart_alerting",
        description="Intelligent alert management with escalation",
        pipeline_type="alerting",
        config={
            "alert_rules": [
                {
                    "condition": "temperature > 85",
                    "severity": "warning",
                    "cooldown": "10m",
                    "escalation_delay": "30m"
                },
                {
                    "condition": "anomaly_score > 0.8",
                    "severity": "critical",
                    "immediate_escalation": True
                },
                {
                    "condition": "equipment_efficiency < 0.7",
                    "severity": "info",
                    "aggregation_window": "1h"
                }
            ],
            "notification_channels": [
                {
                    "type": "email",
                    "recipients": ["operators@company.com", "maintenance@company.com"],
                    "severity_filter": ["warning", "critical"]
                },
                {
                    "type": "sms",
                    "recipients": ["+1234567890"],
                    "severity_filter": ["critical"]
                },
                {
                    "type": "webhook",
                    "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
                    "format": "slack"
                }
            ]
        }
    )
    
    print("✅ Data processing pipelines configured:")
    print(f"  - Validation: {validation_pipeline.pipeline_id}")
    print(f"  - Analytics: {analytics_pipeline.pipeline_id}")
    print(f"  - Anomaly Detection: {anomaly_pipeline.pipeline_id}")
    print(f"  - Alerting: {alert_pipeline.pipeline_id}")
    
    return {
        "validation": validation_pipeline,
        "analytics": analytics_pipeline,
        "anomaly": anomaly_pipeline,
        "alerts": alert_pipeline
    }

# Configure data archiving and retention
async def setup_data_management():
    
    # Configure time-series data storage
    storage_config = await client.iot.configure_data_storage(
        retention_policies=[
            {
                "data_type": "raw_sensor_data",
                "retention_period": "90d",
                "compression": "gzip",
                "aggregation_after": "7d"
            },
            {
                "data_type": "processed_analytics",
                "retention_period": "2y", 
                "compression": "lz4"
            },
            {
                "data_type": "alerts_and_events",
                "retention_period": "5y",
                "compression": None
            }
        ],
        backup_config={
            "frequency": "daily",
            "location": "s3://your-backup-bucket/iot-data",
            "encryption": True
        }
    )
    
    # Set up data export capabilities
    export_config = await client.iot.configure_data_export(
        export_formats=["parquet", "csv", "json"],
        scheduled_exports=[
            {
                "name": "daily_summary_export",
                "schedule": "0 1 * * *",  # Daily at 1 AM
                "data_filter": {
                    "aggregation": "daily",
                    "metrics": ["temperature_avg", "pressure_max", "vibration_rms"]
                },
                "destination": "s3://your-data-lake/daily-summaries/"
            }
        ]
    )
    
    print("✅ Data management configured:")
    print(f"  - Storage policies: {len(storage_config.policies)} policies")
    print(f"  - Export schedules: {len(export_config.schedules)} schedules")

# Run the complete setup
async def main():
    print("🔧 Setting up Manufacturing IoT data processing...")
    
    pipelines = await setup_data_processing()
    await setup_data_management()
    
    print("\\n🚀 Manufacturing IoT platform ready!")
    print("\\nNext steps:")
    print("  1. Start your OPC-UA, MQTT, or Modbus data collectors")
    print("  2. Monitor the real-time dashboard")
    print("  3. Configure additional alert rules as needed")
    print("  4. Set up predictive maintenance models")

if __name__ == "__main__":
    asyncio.run(main())`
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: CogIcon },
    { id: 'opcua', name: 'OPC-UA Setup', icon: ServerIcon },
    { id: 'mqtt', name: 'MQTT Setup', icon: CircuitBoardIcon },
    { id: 'modbus', name: 'Modbus Setup', icon: WrenchScrewdriverIcon },
    { id: 'processing', name: 'Data Processing', icon: ChartBarIcon }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <CircuitBoardIcon className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Manufacturing IoT Setup Tutorial</h1>
        </div>
        <p className="text-xl text-gray-600">
          Complete guide to setting up industrial IoT data collection with OPC-UA, MQTT, and Modbus protocols. 
          Connect your manufacturing equipment and start collecting real-time sensor data.
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
                    ? 'border-orange-500 text-orange-600'
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
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Industrial Protocol Support</h2>
              <p className="text-gray-700 mb-4">
                Schlep Engine supports the most common industrial communication protocols for seamless integration with existing manufacturing equipment.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-orange-900">OPC-UA</h3>
                  <ul className="space-y-1 text-sm text-orange-800">
                    <li>• Modern industrial standard</li>
                    <li>• Secure client/server architecture</li>
                    <li>• Rich data modeling capabilities</li>
                    <li>• Built-in security and encryption</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-orange-900">MQTT</h3>
                  <ul className="space-y-1 text-sm text-orange-800">
                    <li>• Lightweight pub/sub messaging</li>
                    <li>• Perfect for IoT edge devices</li>
                    <li>• Low bandwidth requirements</li>
                    <li>• Broker-based architecture</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-orange-900">Modbus</h3>
                  <ul className="space-y-1 text-sm text-orange-800">
                    <li>• Industry-proven protocol</li>
                    <li>• TCP and RTU variants</li>
                    <li>• Wide equipment compatibility</li>
                    <li>• Simple request/response model</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <ServerIcon className="h-8 w-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Real-time Data Collection</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Collect sensor data with microsecond precision and automatic quality validation.
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• High-frequency sampling (up to 1000Hz)</li>
                  <li>• Automatic reconnection and buffering</li>
                  <li>• Data quality monitoring</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <ChartBarIcon className="h-8 w-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Stream Processing</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Process and analyze data streams in real-time with configurable pipelines.
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Real-time analytics and aggregations</li>
                  <li>• Anomaly detection and alerting</li>
                  <li>• Predictive maintenance models</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Prerequisites</h3>
              <ul className="space-y-1 text-sm text-yellow-700">
                <li>• Python 3.8+ with manufacturing module installed</li>
                <li>• Network access to your industrial equipment</li>
                <li>• Equipment credentials and protocol documentation</li>
                <li>• Schlep Engine API key with Manufacturing permissions</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'opcua' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">OPC-UA Integration</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete OPC-UA Setup</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.opcua_setup}
              </pre>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">OPC-UA Features</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Secure authentication and encryption</li>
                  <li>• Automatic server discovery</li>
                  <li>• Subscription-based data collection</li>
                  <li>• Rich data type support</li>
                  <li>• Hierarchical address space browsing</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Best Practices</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Use subscription instead of polling when possible</li>
                  <li>• Configure appropriate sampling intervals</li>
                  <li>• Enable automatic reconnection</li>
                  <li>• Monitor connection health regularly</li>
                  <li>• Use secure channels in production</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mqtt' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">MQTT Integration</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">MQTT Data Collection Handler</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.mqtt_setup}
              </pre>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-3">MQTT Topic Structure</h3>
              <p className="text-sm text-blue-700 mb-3">Recommended topic hierarchy for manufacturing data:</p>
              <div className="bg-white p-3 rounded border text-sm font-mono">
                <div>sensors/{'{equipment_id}'}/{'{sensor_type}'}</div>
                <div>alarms/{'{equipment_id}'}/{'{alarm_type}'}</div>
                <div>production/{'{line_id}'}/{'{metric}'}</div>
                <div>status/{'{equipment_id}'}/heartbeat</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'modbus' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Modbus Integration</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Modbus TCP Data Collector</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.modbus_setup}
              </pre>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Modbus Register Types</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Coils (0x):</strong> Read/write boolean values</li>
                  <li>• <strong>Discrete Inputs (1x):</strong> Read-only boolean</li>
                  <li>• <strong>Input Registers (3x):</strong> Read-only 16-bit</li>
                  <li>• <strong>Holding Registers (4x):</strong> Read/write 16-bit</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Troubleshooting</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Verify network connectivity and firewall rules</li>
                  <li>• Check Modbus device addressing scheme</li>
                  <li>• Confirm register addresses and data types</li>
                  <li>• Monitor for timeout and connection errors</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'processing' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Data Processing & Analytics</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Processing Pipeline</h3>
              <pre className="bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{codeExamples.data_processing}
              </pre>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Data Validation</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Range and quality checking</li>
                  <li>• Spike detection and filtering</li>
                  <li>• Missing data interpolation</li>
                  <li>• Automatic data quarantine</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Real-time Analytics</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Moving averages and statistics</li>
                  <li>• OEE calculations</li>
                  <li>• Custom derived metrics</li>
                  <li>• Time-window aggregations</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Smart Alerts</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Multi-level alert escalation</li>
                  <li>• Alert suppression and cooldown</li>
                  <li>• Multiple notification channels</li>
                  <li>• Contextual alert information</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-8 border border-orange-100">
        <div className="flex items-center space-x-3 mb-4">
          <PlayCircleIcon className="h-6 w-6 text-orange-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Next Steps</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Your IoT data collection is now set up! Explore advanced manufacturing analytics and digital twin capabilities.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/tutorials/digital-twin-setup" className="bg-white p-4 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Digital Twin Setup</h3>
            <p className="text-sm text-gray-600">Create digital models of your equipment</p>
          </Link>
          <Link href="/examples/manufacturing" className="bg-white p-4 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Manufacturing Examples</h3>
            <p className="text-sm text-gray-600">Real-world IoT implementation patterns</p>
          </Link>
          <Link href="/guides/manufacturing-workflows" className="bg-white p-4 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Best Practices</h3>
            <p className="text-sm text-gray-600">Manufacturing workflow optimization</p>
          </Link>
        </div>
      </div>
    </div>
  )
}