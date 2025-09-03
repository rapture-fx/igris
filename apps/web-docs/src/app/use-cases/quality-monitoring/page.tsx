export default function QualityMonitoringPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        Manufacturing Quality Control
      </h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          Monitor production line quality with multi-sensor correlation analysis and automated anomaly detection for manufacturing equipment.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Production Quality Monitoring
          </h3>
          <ul className="text-blue-700 space-y-1">
            <li>• Multi-sensor correlation analysis</li>
            <li>• Statistical process control</li>
            <li>• Sensor drift and calibration monitoring</li>
            <li>• Equipment health scoring</li>
            <li>• Real-time anomaly alerts</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Equipment Health Monitoring</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`from schlep_engine import SchlepEngineClient
import asyncio

async def monitor_equipment():
    async with SchlepEngineClient(api_key="your_key") as client:
        # Real-time equipment health assessment
        health_report = await client.monitoring.equipment_health(
            equipment_id="pump_001",
            sensor_data={
                "temperature": [22.5, 23.1, 22.8, 24.2],
                "vibration": [0.1, 0.15, 0.12, 0.18],
                "pressure": [101.3, 101.5, 101.2, 101.8]
            },
            time_window="1h",
            alert_thresholds={
                "temperature": {"max": 80, "critical": 90},
                "vibration": {"max": 0.5, "critical": 1.0}
            }
        )
        
        print(f"Health Score: {health_report.health_score}")
        print(f"Anomalies: {health_report.anomalies}")
        
        # Multi-modal anomaly detection results
        anomaly_results = health_report.anomaly_detection
        print(f"Detection methods: {anomaly_results['methods']}")  # IsolationForest, DBSCAN, etc.`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Anomaly Detection Methods</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">IsolationForest</h3>
            <p className="text-gray-600 text-sm mb-3">Isolates anomalies by randomly selecting features and split values</p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-xs">Best for: Temperature and pressure outliers</code>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">DBSCAN</h3>
            <p className="text-gray-600 text-sm mb-3">Density-based clustering for detecting equipment behavior patterns</p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-xs">Best for: Vibration pattern analysis</code>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">OneClassSVM</h3>
            <p className="text-gray-600 text-sm mb-3">Support vector machine for normal operation boundary detection</p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-xs">Best for: Multi-sensor correlation</code>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Statistical Control</h3>
            <p className="text-gray-600 text-sm mb-3">Traditional control charts with 3-sigma limits</p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-xs">Best for: Process control monitoring</code>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Real-time Quality Assessment</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Real-time sensor validation
validation_result = await client.data_processing.validate_sensors(
    sensor_data={
        "temperature_sensor_1": [22.5, 23.1, 95.2, 24.2],  # 95.2 is anomalous
        "pressure_sensor_1": [101.3, 101.5, 180.8, 101.8],   # 180.8 is anomalous  
        "vibration_sensor_1": [0.1, 0.15, 0.12, 0.18]
    },
    sensor_metadata={
        "temperature_sensor_1": {"min_value": -40, "max_value": 150, "sensor_type": "thermocouple"},
        "pressure_sensor_1": {"min_value": 0, "max_value": 100, "sensor_type": "pressure_transducer"}
    },
    quality_thresholds={
        "anomaly_score_threshold": 0.8,
        "correlation_threshold": 0.7,
        "drift_threshold": 0.1
    }
)

print(f"Sensor health: {validation_result.sensor_health}")
print(f"Calibration status: {validation_result.calibration_status}")
print(f"Cross-correlation: {validation_result.cross_sensor_correlation}")`}</code></pre>
        </div>
        
        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            What Works Today
          </h3>
          <ul className="text-green-700 space-y-1">
            <li>✓ Multi-modal anomaly detection with 4 different algorithms</li>
            <li>✓ Cross-sensor correlation analysis</li>
            <li>✓ Statistical process control monitoring</li>
            <li>✓ Real-time sensor drift detection</li>
            <li>✓ Equipment health scoring</li>
          </ul>
        </div>
      </div>
    </div>
  )
}