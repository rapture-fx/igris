import { ApiLayout } from '@/components/ui/ApiLayout'

export default function AnalyticsApiPage() {

  return (
    <ApiLayout 
      title="Analytics API"
      description="Get analytics, monitoring, and webhook information."
      
    >
      <section className="mb-12" id="get-time-savings">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Time Savings</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/time-savings</code>
          </div>
          <p className="text-gray-600 mb-4">Get time savings analytics.</p>
        </div>
      </section>

      <section className="mb-12" id="get-team-productivity">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Team Productivity</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/team-productivity</code>
          </div>
          <p className="text-gray-600 mb-4">Get team productivity metrics.</p>
        </div>
      </section>

      <section className="mb-12" id="get-dashboard-summary">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Dashboard Summary</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/dashboard-summary</code>
          </div>
          <p className="text-gray-600 mb-4">Get comprehensive dashboard summary.</p>
        </div>
      </section>

      <section className="mb-12" id="get-system-status">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get System Status</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/system-status</code>
          </div>
          <p className="text-gray-600 mb-4">Comprehensive system health monitoring.</p>
        </div>
      </section>

      <section className="mb-12" id="health-check">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Health Check</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/health</code>
          </div>
          <p className="text-gray-600 mb-4">Basic health check.</p>
        </div>
      </section>

      <section className="mb-12" id="trigger-alert-check">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Trigger Alert Check</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/analytics/alerts/check</code>
          </div>
          <p className="text-gray-600 mb-4">Manually trigger system alert checks.</p>
        </div>
      </section>

      <section className="mb-12" id="create-webhook">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Webhook</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/analytics/webhooks</code>
          </div>
          <p className="text-gray-600 mb-4">Create a webhook.</p>
        </div>
      </section>

      <section className="mb-12" id="list-webhooks">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Webhooks</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/webhooks</code>
          </div>
          <p className="text-gray-600 mb-4">Get all configured webhooks.</p>
        </div>
      </section>

      <section className="mb-12" id="delete-webhook">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete Webhook</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/analytics/webhooks/{'{webhook_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Remove webhook configuration.</p>
        </div>
      </section>

      <section className="mb-12" id="test-webhook">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Test Webhook</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/analytics/webhooks/{'{webhook_id}'}/test</code>
          </div>
          <p className="text-gray-600 mb-4">Send a test notification to verify webhook configuration.</p>
        </div>
      </section>

      <section className="mb-12" id="list-webhook-events">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Webhook Events</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/analytics/webhook-events</code>
          </div>
          <p className="text-gray-600 mb-4">Get all available webhook event types.</p>
        </div>
      </section>
    </ApiLayout>
  )
}