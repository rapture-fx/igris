export default function QualityMonitoringPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        Data Quality Monitoring
      </h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          Implement automated data quality monitoring to ensure your data pipelines maintain high standards over time.
        </p>

        <div className="bg-orange-50 border-l-4 border-orange-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">
            Continuous Data Quality
          </h3>
          <ul className="text-orange-700 space-y-1">
            <li>• Real-time quality scoring and alerts</li>
            <li>• Automated anomaly detection</li>
            <li>• Data drift monitoring</li>
            <li>• Quality trend analysis</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Setting Up Monitoring</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import schlep_engine as se

# Initialize monitoring client
client = se.Client(api_key="your-api-key")

# Create quality monitor
monitor = client.create_quality_monitor(
    name="production-data-quality",
    dataset_pattern="daily_sales_*",
    quality_rules=[
        se.rules.CompletinessRule(min_threshold=0.95),
        se.rules.UniquenessRule(columns=["customer_id"]),
        se.rules.RangeRule(column="price", min_value=0),
        se.rules.FormatRule(column="email", pattern="email")
    ],
    alert_channels=["email", "slack"]
)`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quality Rules</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Completeness</h3>
            <p className="text-gray-600 text-sm mb-3">Monitor missing values and null rates</p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-xs">CompletinessRule(min_threshold=0.95)</code>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Uniqueness</h3>
            <p className="text-gray-600 text-sm mb-3">Detect duplicate records</p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-xs">UniquenessRule(columns=["id"])</code>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Automated Alerts</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Configure alert thresholds
monitor.configure_alerts(
    quality_score_threshold=0.85,
    anomaly_sensitivity="medium",
    alert_frequency="immediate",
    escalation_rules=[
        {"condition": "critical", "delay": "5m", "channel": "pagerduty"},
        {"condition": "warning", "delay": "1h", "channel": "slack"}
    ]
)`}</code></pre>
        </div>
      </div>
    </div>
  )
}