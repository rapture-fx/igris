export default function CustomerAnalyticsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Customer Analytics</h1>
        <p className="text-xl text-gray-600">
          Build comprehensive customer analytics systems to understand behavior, predict churn, and personalize experiences using machine learning.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h2>
        <p className="text-gray-600 mb-6">
          Customer analytics enables businesses to make data-driven decisions by analyzing customer behavior patterns, 
          preferences, and journey touchpoints. Schlep Engine simplifies the process of transforming raw customer data 
          into actionable insights through advanced ML models.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
          <h3 className="font-semibold mb-3">Key Benefits</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• <strong>360° Customer View:</strong> Unified customer profiles from all touchpoints</li>
            <li>• <strong>Predictive Insights:</strong> Anticipate customer needs and behaviors</li>
            <li>• <strong>Personalization:</strong> Deliver tailored experiences at scale</li>
            <li>• <strong>Churn Prevention:</strong> Identify at-risk customers before they leave</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">📊 Behavioral Analytics</h3>
            <p className="text-sm text-gray-600 mb-4">Analyze customer actions, preferences, and engagement patterns</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Website and app interaction tracking</li>
              <li>• Purchase behavior analysis</li>
              <li>• Content consumption patterns</li>
              <li>• Channel preference identification</li>
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🎯 Segmentation</h3>
            <p className="text-sm text-gray-600 mb-4">Automatically group customers based on behavior and characteristics</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• RFM analysis (Recency, Frequency, Monetary)</li>
              <li>• Demographic segmentation</li>
              <li>• Behavioral clustering</li>
              <li>• Lifecycle stage identification</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">⚠️ Churn Prediction</h3>
            <p className="text-sm text-gray-600 mb-4">Identify customers likely to churn and implement retention strategies</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Early warning indicators</li>
              <li>• Risk scoring algorithms</li>
              <li>• Retention campaign targeting</li>
              <li>• Lifecycle value optimization</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">💡 Recommendation Systems</h3>
            <p className="text-sm text-gray-600 mb-4">Deliver personalized product and content recommendations</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Collaborative filtering</li>
              <li>• Content-based recommendations</li>
              <li>• Hybrid recommendation engines</li>
              <li>• Real-time personalization</li>
            </ul>
          </div>
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
              <h3 className="font-semibold mb-2">Data Collection & Integration</h3>
              <p className="text-gray-600 text-sm mb-2">Gather customer data from all touchpoints and systems</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• CRM system integration</li>
                <li>• Web and mobile analytics</li>
                <li>• Transaction and purchase data</li>
                <li>• Support and interaction logs</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Customer Profile Creation</h3>
              <p className="text-gray-600 text-sm mb-2">Build unified customer profiles with 360-degree view</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Identity resolution and matching</li>
                <li>• Data deduplication and cleansing</li>
                <li>• Attribute standardization</li>
                <li>• Historical behavior aggregation</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">ML Model Development</h3>
              <p className="text-gray-600 text-sm mb-2">Train and deploy customer analytics models</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Segmentation clustering algorithms</li>
                <li>• Churn prediction models</li>
                <li>• Lifetime value calculation</li>
                <li>• Recommendation engine training</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">4</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Insights & Activation</h3>
              <p className="text-gray-600 text-sm mb-2">Generate actionable insights and activate customer programs</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Automated reporting and dashboards</li>
                <li>• Campaign targeting and optimization</li>
                <li>• Real-time personalization</li>
                <li>• Performance monitoring and alerts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Business Impact</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Typical Customer Analytics Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">28%</p>
              <p className="text-sm text-gray-600">Revenue Increase</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">42%</p>
              <p className="text-sm text-gray-600">Retention Improvement</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">65%</p>
              <p className="text-sm text-gray-600">Campaign Effectiveness</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">3.2x</p>
              <p className="text-sm text-gray-600">Customer Lifetime Value</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Real-time Capabilities</h2>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
          <h3 className="font-semibold mb-3">Live Customer Intelligence</h3>
          <p className="text-gray-700 mb-4">
            Schlep Engine provides real-time customer analytics capabilities, enabling immediate response to customer 
            behavior changes and dynamic personalization across all customer touchpoints.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Real-time Scoring</p>
              <p className="text-xs text-gray-600">Live propensity models</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Dynamic Segmentation</p>
              <p className="text-xs text-gray-600">Instant segment updates</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Live Recommendations</p>
              <p className="text-xs text-gray-600">Context-aware suggestions</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}