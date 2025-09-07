export default function ManufacturingDataProcessingPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Manufacturing Data Processing</h1>
        <p className="text-xl text-gray-600">
          Transform messy manufacturing data into ML-ready datasets through intelligent preprocessing and feature engineering.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="prose prose-gray max-w-none">
            <p>
              The Manufacturing Data Processing engine is designed to handle the complexity of industrial data streams.
              From raw sensor readings to processed ML features, our system automates the entire data preparation pipeline
              for manufacturing environments.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Core Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Multi-Sensor Data Fusion</h3>
              <p className="text-gray-600 mb-4">
                Combine data from temperature sensors, vibration monitors, pressure gauges, and more using advanced Kalman filtering.
              </p>
              <div className="text-sm text-gray-500">
                <strong>Input:</strong> Raw sensor streams<br/>
                <strong>Output:</strong> Unified sensor state estimation
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Real-time Data Streaming</h3>
              <p className="text-gray-600 mb-4">
                Process manufacturing data streams in real-time with sub-second latency for immediate insights.
              </p>
              <div className="text-sm text-gray-500">
                <strong>Latency:</strong> &lt;100ms processing time<br/>
                <strong>Throughput:</strong> 1M+ data points/second
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quality Control Analysis</h3>
              <p className="text-gray-600 mb-4">
                Automated defect detection and quality assessment using computer vision and statistical process control.
              </p>
              <div className="text-sm text-gray-500">
                <strong>Accuracy:</strong> 99.2% defect detection<br/>
                <strong>Speed:</strong> Real-time inspection
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Predictive Maintenance</h3>
              <p className="text-gray-600 mb-4">
                Early equipment failure detection using vibration analysis, thermal monitoring, and machine learning.
              </p>
              <div className="text-sm text-gray-500">
                <strong>Prediction Window:</strong> 1-30 days ahead<br/>
                <strong>Accuracy:</strong> 95%+ failure prediction
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Processing Pipeline</h2>
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">1</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Data Ingestion</h4>
                  <p className="text-gray-600">Collect raw sensor data from multiple sources (MQTT, OPC-UA, REST APIs)</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">2</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Data Validation & Cleaning</h4>
                  <p className="text-gray-600">Remove outliers, handle missing values, validate sensor ranges</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">3</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Feature Engineering</h4>
                  <p className="text-gray-600">Extract time-domain and frequency-domain features for ML models</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">4</div>
                <div>
                  <h4 className="font-semibold text-gray-900">ML-Ready Output</h4>
                  <p className="text-gray-600">Deliver processed data in formats ready for machine learning workflows</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Integration Points</h2>
          <div className="prose prose-gray max-w-none">
            <ul>
              <li><strong>SCADA Systems:</strong> Direct integration with industrial control systems</li>
              <li><strong>ERP Integration:</strong> Connect with SAP, Oracle, and other enterprise systems</li>
              <li><strong>Cloud Platforms:</strong> Deploy on AWS, Azure, or Google Cloud</li>
              <li><strong>Edge Computing:</strong> On-premises deployment for low-latency requirements</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Getting Started</h2>
          <div className="bg-blue-50 p-6 rounded-lg">
            <p className="text-blue-800 mb-4">
              Ready to transform your manufacturing data into actionable insights?
            </p>
            <div className="space-y-2">
              <div className="text-blue-700">
                1. Check out our <a href="/api-reference/manufacturing" className="underline">Manufacturing API Reference</a>
              </div>
              <div className="text-blue-700">
                2. View the <a href="/api-reference/manufacturing-forecasting" className="underline">Manufacturing Forecasting Engine</a>
              </div>
              <div className="text-blue-700">
                3. Follow our <a href="/getting-started" className="underline">Quick Start Guide</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
