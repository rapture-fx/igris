import { ApiLayout } from '@/components/ui/ApiLayout'

export default function MonitoringApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Get equipment health assessment
curl -X POST https://api.schlep-engine.com/api/v1/monitoring/equipment-health \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "pump_001",
    "sensor_data": {
      "temperature": [22.5, 23.1, 22.8, 24.2],
      "vibration": [0.1, 0.15, 0.12, 0.18],
      "pressure": [101.3, 101.5, 101.2, 101.8]
    },
    "time_window": "1h"
  }'`
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
    'Authorization': 'Bearer ' + apiKey
  }
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Equipment Monitoring API"
      description="Real-time equipment health monitoring and industrial sensor tracking."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="get-performance-snapshot">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Equipment Health Assessment</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/monitoring/equipment-health</code>
          </div>
          <p className="text-gray-600 mb-4">Real-time equipment health assessment with cross-sensor correlation analysis.</p>
        </div>
      </section>

      <section className="mb-12" id="get-metrics-history">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sensor Health History</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/monitoring/sensor-health-history/{'{equipment_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Get historical sensor health data and degradation patterns for specific equipment.</p>
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