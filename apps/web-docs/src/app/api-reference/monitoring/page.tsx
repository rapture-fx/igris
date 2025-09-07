import { ApiLayout } from '@/components/ui/ApiLayout'

export default function MonitoringApiPage() {

  return (
    <ApiLayout 
      title="System Monitoring & Health API"
      description="Real-time system health monitoring, equipment tracking, and industrial sensor monitoring."
      
    >
      <section className="mb-12" id="industry-health-check">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Industry AI Services Health Check</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/industry/health</code>
          </div>
          <p className="text-gray-600 mb-4">Check the operational status of all industry-specific AI services including financial, e-commerce, and manufacturing processors. Returns detailed health information for each service and their underlying ML models.</p>
          
          <div className="mt-4">
            <h4 className="font-medium text-gray-900 mb-2">Response includes:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Overall system status</li>
              <li>• Individual service health (financial, e-commerce, manufacturing)</li>
              <li>• Model operational status for each processor</li>
              <li>• Response time metrics</li>
              <li>• System uptime and version information</li>
            </ul>
          </div>
        </div>
      </section>

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