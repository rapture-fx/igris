import { ApiLayout } from '@/components/ui/ApiLayout'

export default function MonitoringApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Get performance snapshot
curl -X GET https://api.schlep-engine.com/api/v1/monitoring/metrics/snapshot \
  -H "Authorization: Bearer sk_your_api_key"`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}

response = requests.get("https://api.schlep-engine.com/api/v1/monitoring/metrics/snapshot", headers=headers)
print(response.json())`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';

fetch('https://api.schlep-engine.com/api/v1/monitoring/metrics/snapshot', {
  headers: {
    'Authorization': 	`Bearer ${apiKey}`
  }
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Monitoring API"
      description="Monitor system performance, health, and metrics."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="get-performance-snapshot">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Performance Snapshot</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/monitoring/metrics/snapshot</code>
          </div>
          <p className="text-gray-600 mb-4">Get a complete performance snapshot of the system.</p>
        </div>
      </section>

      <section className="mb-12" id="get-metrics-history">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Metrics History</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/monitoring/metrics/history</code>
          </div>
          <p className="text-gray-600 mb-4">Get historical metrics data.</p>
        </div>
      </section>

      <section className="mb-12" id="stream-metrics">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Stream Metrics</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/monitoring/metrics/stream</code>
          </div>
          <p className="text-gray-600 mb-4">Stream real-time metrics via Server-Sent Events.</p>
        </div>
      </section>

      <section className="mb-12" id="get-detailed-health">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Detailed Health</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/monitoring/health/detailed</code>
          </div>
          <p className="text-gray-600 mb-4">Get a detailed health assessment of the system.</p>
        </div>
      </section>

      <section className="mb-12" id="export-metrics">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Export Metrics</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/monitoring/metrics/export</code>
          </div>
          <p className="text-gray-600 mb-4">Export metrics data for external analysis.</p>
        </div>
      </section>
    </ApiLayout>
  )
}