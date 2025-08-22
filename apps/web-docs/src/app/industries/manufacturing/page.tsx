export default function ManufacturingPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Manufacturing</h1>
        <p className="text-xl text-gray-600">
          Transform IoT sensor data, production metrics, and quality control records into ML-ready datasets for predictive maintenance, quality optimization, and supply chain analytics.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Industry Challenges</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Industrial Data Complexity</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• High-frequency sensor data streams</li>
              <li>• Legacy system integrations</li>
              <li>• Multi-location data synchronization</li>
              <li>• Equipment downtime data gaps</li>
            </ul>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Schlep Engine Solutions</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Real-time IoT data processing</li>
              <li>• Automated anomaly detection</li>
              <li>• Production line optimization</li>
              <li>• Predictive maintenance scheduling</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🔧 Predictive Maintenance</h3>
            <p className="text-sm text-gray-600 mb-4">Prevent equipment failures by predicting maintenance needs before breakdowns occur</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Sensor readings, maintenance logs, equipment specifications</p>
              <p><strong>ML Models:</strong> Time Series Analysis, Anomaly Detection</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">📊 Quality Control</h3>
            <p className="text-sm text-gray-600 mb-4">Automated defect detection and quality assurance using computer vision</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Visual inspection data, measurement readings, product specifications</p>
              <p><strong>ML Models:</strong> Computer Vision, Classification</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">⚙️ Process Optimization</h3>
            <p className="text-sm text-gray-600 mb-4">Optimize production parameters for maximum efficiency and minimal waste</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Production metrics, resource consumption, output quality</p>
              <p><strong>ML Models:</strong> Optimization Algorithms, Regression</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">IoT Integration</h2>
        <div className="bg-purple-50 border-l-4 border-purple-400 p-6">
          <h3 className="font-semibold mb-3">Industrial IoT Data Processing</h3>
          <p className="text-gray-700 mb-4">
            Schlep Engine seamlessly integrates with industrial IoT systems to process high-volume sensor data, 
            enabling real-time monitoring and predictive analytics across your manufacturing operations.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Temperature</p>
              <p className="text-xs text-gray-600">Thermal monitoring</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Vibration</p>
              <p className="text-xs text-gray-600">Mechanical health</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Pressure</p>
              <p className="text-xs text-gray-600">System performance</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Flow Rate</p>
              <p className="text-xs text-gray-600">Process control</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Manufacturing Metrics</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Typical Manufacturing Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">31%</p>
              <p className="text-sm text-gray-600">Downtime Reduction</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">24%</p>
              <p className="text-sm text-gray-600">Quality Improvement</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">18%</p>
              <p className="text-sm text-gray-600">Cost Savings</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">15%</p>
              <p className="text-sm text-gray-600">Energy Efficiency</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Implementation Approach</h2>
        <div className="space-y-6">
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Data Infrastructure Setup</h3>
              <p className="text-gray-600 text-sm mb-2">Establish secure connections to manufacturing systems and IoT devices</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Industrial protocol support (OPC-UA, Modbus, MQTT)</li>
                <li>• Edge computing deployment for real-time processing</li>
                <li>• Secure data transmission and storage</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Model Development & Training</h3>
              <p className="text-gray-600 text-sm mb-2">Build and train ML models specific to manufacturing processes</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Historical data analysis and pattern recognition</li>
                <li>• Custom model training for specific equipment</li>
                <li>• Continuous learning and model improvement</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Production Deployment</h3>
              <p className="text-gray-600 text-sm mb-2">Deploy models into production environment with monitoring</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Real-time alerting and notification systems</li>
                <li>• Dashboard integration for operations teams</li>
                <li>• Automated maintenance scheduling</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}