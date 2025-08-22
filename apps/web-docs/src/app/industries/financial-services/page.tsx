export default function FinancialServicesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Financial Services</h1>
        <p className="text-xl text-gray-600">
          Transform financial data into ML-ready datasets for fraud detection, risk assessment, and algorithmic trading.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Industry Challenges</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">Data Complexity</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Multiple data sources and formats</li>
              <li>• Real-time transaction streams</li>
              <li>• Legacy system integrations</li>
              <li>• Regulatory compliance requirements</li>
            </ul>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Schlep Engine Solutions</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Automated financial data cleaning</li>
              <li>• Real-time fraud detection pipelines</li>
              <li>• Regulatory compliance automation</li>
              <li>• PII detection and protection</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">🛡️ Fraud Detection</h3>
            <p className="text-sm text-gray-600 mb-4">Real-time transaction monitoring and anomaly detection</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Transaction logs, user behavior, device fingerprints</p>
              <p><strong>ML Models:</strong> Isolation Forest, Neural Networks</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">📊 Risk Assessment</h3>
            <p className="text-sm text-gray-600 mb-4">Credit scoring and portfolio risk analysis</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Credit history, financial statements, market data</p>
              <p><strong>ML Models:</strong> Gradient Boosting, Logistic Regression</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">💹 Algorithmic Trading</h3>
            <p className="text-sm text-gray-600 mb-4">Automated trading strategy development</p>
            <div className="text-xs text-gray-500">
              <p><strong>Data Types:</strong> Market data, news sentiment, economic indicators</p>
              <p><strong>ML Models:</strong> LSTM, Reinforcement Learning</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Compliance & Security</h2>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
          <h3 className="font-semibold mb-3">Financial Regulations</h3>
          <p className="text-gray-700 mb-4">
            Schlep Engine automatically handles financial industry compliance requirements including data governance, 
            audit trails, and regulatory reporting.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">PCI DSS</p>
              <p className="text-xs text-gray-600">Payment security</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">SOX</p>
              <p className="text-xs text-gray-600">Financial reporting</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">GDPR</p>
              <p className="text-xs text-gray-600">Data privacy</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="font-medium text-sm">Basel III</p>
              <p className="text-xs text-gray-600">Risk management</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}