export default function RealTimeProcessingPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Real-time Industrial Monitoring</h1>
        <p className="text-xl text-gray-600">
          Monitor manufacturing equipment in real-time with sliding window quality assessment and industrial-specific alerts.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h2>
        <p className="text-gray-600 mb-6">
          Real-time industrial monitoring enables manufacturers to detect equipment issues as they occur, preventing 
          costly downtime and quality issues. Schlep Engine's sensor processing handles continuous data streams with 
          statistical analysis and pattern detection for manufacturing environments.
        </p>

        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h3 className="font-semibold mb-3">Key Capabilities</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• <strong>Sensor Data Processing:</strong> Handle continuous sensor streams from manufacturing equipment</li>
            <li>• <strong>Anomaly Detection:</strong> Apply IsolationForest, DBSCAN, and OneClassSVM in real-time</li>
            <li>• <strong>Quality Assessment:</strong> Sliding window statistical analysis for production lines</li>
            <li>• <strong>Industrial Alerts:</strong> Equipment-specific alerts for maintenance and quality issues</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Use Cases</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🔧 Predictive Maintenance</h3>
            <p className="text-sm text-gray-600 mb-4">Monitor equipment health to prevent failures</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Vibration and temperature monitoring</li>
              <li>• Equipment degradation pattern detection</li>
              <li>• Real-time health scoring</li>
              <li>• Automated maintenance alerts</li>
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">⚙️ Quality Control</h3>
            <p className="text-sm text-gray-600 mb-4">Real-time production line quality monitoring</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Statistical process control</li>
              <li>• Cross-sensor correlation analysis</li>
              <li>• Product quality scoring</li>
              <li>• Automated quality alerts</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🔍 Sensor Validation</h3>
            <p className="text-sm text-gray-600 mb-4">Continuous sensor calibration and drift detection</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Real-time sensor drift detection</li>
              <li>• Calibration status monitoring</li>
              <li>• Multi-sensor validation</li>
              <li>• Data quality scoring</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🏭 Production Optimization</h3>
            <p className="text-sm text-gray-600 mb-4">Optimize production processes with real-time data</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Production line efficiency monitoring</li>
              <li>• Resource utilization tracking</li>
              <li>• Throughput optimization</li>
              <li>• Bottleneck identification</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Real-time Industrial Monitoring Example</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-lg mb-4">Equipment Health Monitoring</h3>
          <pre className="text-sm text-gray-900 overflow-x-auto"><code>{`from schlep_engine import SchlepEngineClient
import asyncio
import time

async def monitor_production_line():
    async with SchlepEngineClient(api_key="your_key") as client:
        while True:
            # Simulate real sensor readings
            sensor_data = {
                "pump_001_temperature": [22.5, 23.1, 22.8, 24.2, 23.7],
                "pump_001_vibration": [0.1, 0.15, 0.12, 0.18, 0.14],
                "pump_001_pressure": [101.3, 101.5, 101.2, 101.8, 101.6]
            }
            
            # Real-time equipment health assessment
            health_report = await client.monitoring.equipment_health(
                equipment_id="pump_001",
                sensor_data=sensor_data,
                time_window="5m",  # 5-minute sliding window
                anomaly_methods=["IsolationForest", "DBSCAN", "OneClassSVM"]
            )
            
            # Check for anomalies and quality issues
            if health_report.health_score < 0.8:
                print(f"⚠️  Equipment health degraded: {health_report.health_score}")
                print(f"Anomalies detected: {health_report.anomaly_count}")
                
                # Send real-time alert
                await client.monitoring.send_alert(
                    equipment_id="pump_001",
                    alert_type="health_degradation",
                    severity="warning",
                    message=f"Pump 001 health score: {health_report.health_score}"
                )
            
            # Multi-sensor correlation analysis
            correlation_report = health_report.cross_sensor_correlation
            if correlation_report["temperature_pressure_correlation"] < 0.7:
                print("🔧 Possible sensor calibration issue detected")
            
            await asyncio.sleep(10)  # Check every 10 seconds

# Run continuous monitoring
asyncio.run(monitor_production_line())`}</code></pre>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Industrial Processing Components</h2>
        <div className="space-y-6">
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Sensor Data Ingestion</h3>
              <p className="text-gray-600 text-sm mb-2">Industrial sensor data collection from manufacturing equipment</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Temperature sensors (thermocouples, RTDs)</li>
                <li>• Pressure transducers and transmitters</li>
                <li>• Vibration sensors and accelerometers</li>
                <li>• Flow meters and level sensors</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Quality Assessment Engine</h3>
              <p className="text-gray-600 text-sm mb-2">Real-time statistical analysis and anomaly detection</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Sliding window statistical control</li>
                <li>• Cross-sensor correlation analysis</li>
                <li>• Multi-modal anomaly detection</li>
                <li>• Sensor drift detection</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Anomaly Detection Layer</h3>
              <p className="text-gray-600 text-sm mb-2">Industrial-grade anomaly detection algorithms</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• IsolationForest for temperature/pressure outliers</li>
                <li>• DBSCAN for vibration pattern analysis</li>
                <li>• OneClassSVM for multi-sensor correlation</li>
                <li>• Statistical control charts (3-sigma limits)</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">4</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Manufacturing Alerts & Actions</h3>
              <p className="text-gray-600 text-sm mb-2">Industrial-specific alerts and maintenance actions</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Equipment health degradation alerts</li>
                <li>• Maintenance scheduling automation</li>
                <li>• Quality control notifications</li>
                <li>• Production line status updates</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Current Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-800 mb-4">✓ What Works Today</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-green-700">Anomaly Detection Methods</span>
                <span className="text-sm font-semibold text-green-800">4 Algorithms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-700">Sensor Processing</span>
                <span className="text-sm font-semibold text-green-800">Real-time</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-700">Quality Assessment</span>
                <span className="text-sm font-semibold text-green-800">Cross-sensor</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-700">Alert System</span>
                <span className="text-sm font-semibold text-green-800">Industrial</span>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-800 mb-4">⚠️ Honest Limitations</h3>
            <ul className="text-sm text-yellow-700 space-y-2">
              <li>• Processing latency: ~1-5 seconds (not sub-100ms)</li>
              <li>• Throughput: Thousands of sensors (not millions)</li>
              <li>• Advanced ML: Limited to statistical methods</li>
              <li>• Deep learning: Not currently integrated</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Implementation Guide</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Getting Started with Real-time Processing</h3>
          
          <div className="space-y-4">
            <div className="bg-white border-l-4 border-blue-500 p-4">
              <h4 className="font-medium mb-2">1. Define Data Sources</h4>
              <p className="text-sm text-gray-600">
                Identify and configure your streaming data sources such as APIs, databases, IoT devices, or message queues.
              </p>
            </div>
            
            <div className="bg-white border-l-4 border-green-500 p-4">
              <h4 className="font-medium mb-2">2. Design Processing Logic</h4>
              <p className="text-sm text-gray-600">
                Create event processing rules, filters, and transformation logic to extract meaningful insights from raw data.
              </p>
            </div>
            
            <div className="bg-white border-l-4 border-purple-500 p-4">
              <h4 className="font-medium mb-2">3. Deploy ML Models</h4>
              <p className="text-sm text-gray-600">
                Deploy trained machine learning models for real-time inference on streaming data.
              </p>
            </div>
            
            <div className="bg-white border-l-4 border-orange-500 p-4">
              <h4 className="font-medium mb-2">4. Configure Actions</h4>
              <p className="text-sm text-gray-600">
                Set up automated actions, alerts, and integrations to respond to processed insights in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Monitoring & Observability</h2>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
          <h3 className="font-semibold mb-3">Real-time System Monitoring</h3>
          <p className="text-gray-700 mb-4">
            Comprehensive monitoring and observability features ensure your real-time processing pipelines 
            operate reliably with full visibility into performance, errors, and data flow.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Performance Metrics</p>
              <p className="text-xs text-gray-600">Latency and throughput</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Error Tracking</p>
              <p className="text-xs text-gray-600">Failure detection</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Data Lineage</p>
              <p className="text-xs text-gray-600">End-to-end tracing</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}