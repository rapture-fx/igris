export default function FraudDetectionPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Fraud Detection</h1>
        <p className="text-xl text-gray-600">
          Build real-time fraud detection systems using machine learning to identify suspicious transactions and protect your business.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h2>
        <p className="text-gray-600 mb-6">
          Fraud detection is a critical use case for machine learning, requiring real-time processing of transaction data 
          to identify potentially fraudulent activity. Schlep Engine makes it easy to build, deploy, and maintain 
          fraud detection models that adapt to new fraud patterns.
        </p>

        <div className="bg-red-50 border-l-4 border-red-400 p-6">
          <h3 className="font-semibold mb-3">Key Benefits</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• <strong>Real-time Detection:</strong> Identify fraud as it happens with sub-second response times</li>
            <li>• <strong>Adaptive Models:</strong> Automatically retrain models as new fraud patterns emerge</li>
            <li>• <strong>Low False Positives:</strong> AI-optimized models reduce customer friction</li>
            <li>• <strong>Scalable Processing:</strong> Handle millions of transactions per day</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Implementation Steps</h2>
        <div className="space-y-6">
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Data Collection & Preparation</h3>
              <p className="text-gray-600 text-sm mb-2">Gather transaction data, user profiles, and historical fraud labels</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Transaction amounts, timestamps, merchants</li>
                <li>• User behavior patterns and device fingerprints</li>
                <li>• Historical fraud labels for supervised learning</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Feature Engineering</h3>
              <p className="text-gray-600 text-sm mb-2">Create predictive features from raw transaction data</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Velocity features (transactions per hour/day)</li>
                <li>• Aggregated spending patterns by merchant/category</li>
                <li>• Device and location anomaly scores</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Model Training & Deployment</h3>
              <p className="text-gray-600 text-sm mb-2">Train and deploy real-time fraud detection models</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• AutoML model selection and training</li>
                <li>• Real-time API deployment with auto-scaling</li>
                <li>• A/B testing and gradual rollout</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Model Performance</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Typical Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">95.8%</p>
              <p className="text-sm text-gray-600">Precision</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">92.3%</p>
              <p className="text-sm text-gray-600">Recall</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">94.0%</p>
              <p className="text-sm text-gray-600">F1-Score</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">45ms</p>
              <p className="text-sm text-gray-600">Response Time</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}