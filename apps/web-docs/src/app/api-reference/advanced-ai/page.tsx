import { ApiLayout } from '@/components/ui/ApiLayout'
import { CpuChipIcon, LightBulbIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function AdvancedAIApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Intelligent Analysis
curl -X POST "https://api.schlep-engine.com/api/v1/advanced-ai/intelligent-analysis" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "investigation_id": "inv_abc123",
    "analysis_type": "comprehensive",
    "include_recommendations": true,
    "ai_depth": "deep"
  }'`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}

# Run intelligent analysis
analysis_request = {
    "investigation_id": "inv_abc123",
    "analysis_type": "comprehensive",
    "include_recommendations": True,
    "ai_depth": "deep"
}

response = requests.post(
    "https://api.schlep-engine.com/api/v1/advanced-ai/intelligent-analysis",
    headers=headers,
    json=analysis_request
)

if response.status_code == 200:
    insights = response.json()
    print(f"✅ Analysis complete. Confidence: {insights['confidence_score']:.1%}")
    
    for insight in insights['insights']:
        print(f"📊 {insight['category']}: {insight['title']}")
        
else:
    print(f"❌ Analysis failed: {response.text}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';

// Run intelligent analysis
async function runIntelligentAnalysis(investigationId) {
  try {
    const response = await fetch('https://api.schlep-engine.com/api/v1/advanced-ai/intelligent-analysis', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        investigation_id: investigationId,
        analysis_type: 'comprehensive',
        include_recommendations: true,
        ai_depth: 'deep'
      })
    });
    
    if (response.ok) {
      const insights = await response.json();
      console.log(\`✅ Analysis complete. Confidence: \${(insights.confidence_score * 100).toFixed(1)}%\`);
      
      insights.insights.forEach(insight => {
        console.log(\`📊 \${insight.category}: \${insight.title}\`);
      });
      
      return insights;
    } else {
      console.error('❌ Analysis failed:', await response.text());
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

runIntelligentAnalysis('inv_abc123');`
    }
  ]

  return (
    <ApiLayout 
      title="Advanced AI"
      description="Leverage advanced AI capabilities for intelligent data analysis, automated insights generation, and predictive analytics."
      codeExamples={codeExamples}
    >
      {/* Advanced AI Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Advanced AI Overview</h2>
        <p className="text-gray-600 mb-6">
          Our Advanced AI API provides sophisticated machine learning capabilities that go beyond traditional data processing. 
          It offers intelligent analysis, automated insights generation, predictive analytics, and real-time monitoring 
          powered by state-of-the-art AI models.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Intelligent Analysis</h3>
            </div>
            <p className="text-gray-600 text-sm">
              AI-powered comprehensive analysis including data quality assessment, anomaly detection, and trend analysis.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <LightBulbIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Auto Insights</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Automatically generate actionable insights from your data using NLP and statistical analysis.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Predictive Analytics</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Time series forecasting and predictive modeling with confidence intervals and trend analysis.
            </p>
          </div>
        </div>
      </section>

      {/* Intelligent Analysis */}
      <section className="mb-12" id="intelligent-analysis">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intelligent Analysis</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/advanced-ai/intelligent-analysis</code>
          </div>
          <p className="text-gray-600 mb-4">
            Perform comprehensive intelligent analysis on investigation data using multiple AI techniques.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">investigation_id</code> (string, required) - Investigation ID to analyze</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">analysis_type</code> (string, optional) - comprehensive, quality, anomaly, predictive (default: comprehensive)</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">include_recommendations</code> (boolean, optional) - Include actionable recommendations (default: true)</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">ai_depth</code> (string, optional) - basic, standard, deep (default: standard)</li>
            </ul>
          </div>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "investigation_id": "inv_abc123",
  "analysis_type": "comprehensive",
  "timestamp": "2024-01-15T10:30:00Z",
  "insights": [
    {
      "category": "Data Quality",
      "title": "Overall Quality Score: 92.0%",
      "description": "Comprehensive data quality assessment across 5 dimensions",
      "priority": "medium",
      "details": {
        "completeness": 0.95,
        "validity": 0.92,
        "consistency": 0.88,
        "accuracy": 0.91,
        "uniqueness": 0.94
      }
    }
  ],
  "confidence_score": 0.89,
  "recommendations": [
    {
      "title": "Improve Data Consistency",
      "description": "Implement standardization rules for categorical fields",
      "action_items": ["Add validation constraints", "Standardize formats"],
      "estimated_impact": "medium",
      "effort_level": "low"
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Auto Insights */}
      <section className="mb-12" id="auto-insights">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Auto Insights</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/advanced-ai/auto-insights</code>
          </div>
          <p className="text-gray-600 mb-4">
            Generate automated insights from data using AI/ML analysis and NLP processing.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "data": [
    {"revenue": 10000, "customers": 150, "region": "north"},
    {"revenue": 15000, "customers": 200, "region": "south"}
  ],
  "context": "business",
  "focus_areas": ["patterns", "trends", "correlations"]
}`}
            </pre>
          </div>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "statistical_summary": {
    "record_count": 2,
    "field_count": 3,
    "data_distribution": "normal",
    "outlier_percentage": 2.3
  },
  "patterns": {
    "correlations": [
      {"fields": ["revenue", "customers"], "correlation": 0.87}
    ]
  },
  "meta": {
    "generated_at": "2024-01-15T10:30:00Z",
    "data_points": 2,
    "analysis_context": "business"
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Predictive Analysis */}
      <section className="mb-12" id="predictive-analysis">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Predictive Analysis</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/advanced-ai/predictive-analysis</code>
          </div>
          <p className="text-gray-600 mb-4">
            Perform predictive analysis with time series forecasting and trend prediction.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">investigation_id</code> (string, required) - Investigation ID containing historical data</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">target_column</code> (string, required) - Column to predict</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">prediction_horizon</code> (int, optional) - Days to forecast (default: 30)</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">confidence_level</code> (float, optional) - Confidence level (default: 0.95)</li>
            </ul>
          </div>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "investigation_id": "inv_abc123",
  "target_column": "revenue",
  "prediction_horizon": 30,
  "model_id": "model_xyz789",
  "predictions": {
    "forecast": [12000, 12500, 13000],
    "dates": ["2024-02-01", "2024-02-02", "2024-02-03"]
  },
  "confidence_intervals": {
    "lower_bound": [11000, 11200, 11800],
    "upper_bound": [13000, 13800, 14200],
    "confidence_level": 0.95
  },
  "trend_analysis": {
    "direction": "upward",
    "strength": "moderate",
    "seasonality": false
  },
  "generated_at": "2024-01-15T11:00:00Z"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Real-time Monitoring Setup */}
      <section className="mb-12" id="monitoring-setup">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Real-time Monitoring Setup</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/advanced-ai/monitoring/setup</code>
          </div>
          <p className="text-gray-600 mb-4">
            Setup real-time data quality monitoring with automated alerts and notifications.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "investigation_id": "inv_abc123",
  "monitoring_rules": {
    "data_quality_threshold": 0.85,
    "anomaly_sensitivity": "medium",
    "check_frequency": "hourly"
  },
  "alert_thresholds": {
    "quality_score": 0.80,
    "anomaly_count": 5,
    "missing_data_percentage": 0.10
  },
  "notification_settings": {
    "email": "admin@company.com",
    "webhook_url": "https://hooks.company.com/alerts",
    "slack_channel": "#data-alerts"
  }
}`}
            </pre>
          </div>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "monitoring_id": "monitor_def456",
  "status": "active",
  "configuration": {
    "investigation_id": "inv_abc123",
    "rules": {...},
    "created_at": "2024-01-15T12:00:00Z"
  },
  "estimated_checks_per_hour": 12,
  "next_check": "2024-01-15T12:05:00Z"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Get Monitoring Status */}
      <section className="mb-12" id="monitoring-status">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Monitoring Status</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/advanced-ai/monitoring/{'{monitoring_id}'}/status</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get the current status and recent activity of a real-time monitoring setup.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "monitoring_id": "monitor_def456",
  "status": "active",
  "last_check": "2024-01-15T12:00:00Z",
  "alerts_triggered": 0,
  "health_score": 95.2,
  "recent_activity": [
    {
      "timestamp": "2024-01-15T11:55:00Z",
      "type": "quality_check",
      "result": "passed",
      "score": 0.92
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}