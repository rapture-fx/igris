export default function EcommercePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">E-commerce</h1>
        <p className="text-xl text-gray-600">
          Transform customer data, transaction history, and product catalogs into ML-ready datasets for personalization, recommendation engines, and inventory optimization.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Industry Challenges</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Data Fragmentation</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Customer data across multiple touchpoints</li>
              <li>• Product information in various formats</li>
              <li>• Seasonal data spikes and variations</li>
              <li>• Cross-platform transaction tracking</li>
            </ul>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Schlep Engine Solutions</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Unified customer data platform</li>
              <li>• Real-time inventory tracking</li>
              <li>• Automated product catalog cleaning</li>
              <li>• Multi-channel analytics integration</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🛍️ Product Recommendations</h3>
            <p className="text-sm text-gray-600 mb-4">Personalized product suggestions based on customer behavior and preferences</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Purchase history, browsing patterns, product attributes</p>
              <p><strong>ML Models:</strong> Collaborative Filtering, Deep Learning</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">📊 Demand Forecasting</h3>
            <p className="text-sm text-gray-600 mb-4">Predict future demand to optimize inventory and reduce stockouts</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Sales history, seasonal trends, market data</p>
              <p><strong>ML Models:</strong> Time Series, ARIMA, Prophet</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">💰 Dynamic Pricing</h3>
            <p className="text-sm text-gray-600 mb-4">Optimize pricing strategies based on demand, competition, and customer segments</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Competitor prices, demand elasticity, customer segments</p>
              <p><strong>ML Models:</strong> Reinforcement Learning, Price Optimization</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Customer Analytics</h2>
        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h3 className="font-semibold mb-3">360° Customer View</h3>
          <p className="text-gray-700 mb-4">
            Schlep Engine unifies customer data from all touchpoints to create comprehensive customer profiles 
            for better targeting, retention, and lifetime value optimization.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Purchase History</p>
              <p className="text-xs text-gray-600">Transaction patterns</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Browsing Behavior</p>
              <p className="text-xs text-gray-600">Product interactions</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Support Interactions</p>
              <p className="text-xs text-gray-600">Service touchpoints</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Marketing Response</p>
              <p className="text-xs text-gray-600">Campaign effectiveness</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Performance Metrics</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Typical E-commerce Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">23%</p>
              <p className="text-sm text-gray-600">Revenue Increase</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">35%</p>
              <p className="text-sm text-gray-600">Better Conversion</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">18%</p>
              <p className="text-sm text-gray-600">Inventory Reduction</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">42%</p>
              <p className="text-sm text-gray-600">Customer Retention</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}