import { ApiLayout } from '@/components/ui/ApiLayout'
import { SignalIcon, BoltIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

export default function WebSocketApiPage() {
  return (
    <ApiLayout 
      title="WebSocket API"
      description="Real-time communication with Schlep Engine using WebSocket connections for live updates on ML pipelines, data processing, and system events."
    >
      {/* Connection Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connection Overview</h2>
        <p className="text-gray-600 mb-6">
          The WebSocket API provides real-time, bidirectional communication for monitoring ML pipelines, 
          data processing jobs, and receiving system notifications.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <GlobeAltIcon className="h-5 w-5 text-blue-600" />
            <code className="font-mono text-sm font-semibold text-blue-900">wss://api.schlep-engine.com/api/v1/websocket/connect</code>
          </div>
          <p className="text-sm text-blue-800">
            Secure WebSocket endpoint for establishing real-time connections
          </p>
        </div>
      </section>

      {/* Authentication */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication</h2>
        
        <div className="space-y-4">
          <p className="text-gray-600">
            WebSocket connections require authentication using your API key. Include your key in the connection headers:
          </p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Connection Headers</h3>
            <code className="text-sm font-mono">Authorization: Bearer sk_your_api_key</code>
          </div>
        </div>
      </section>

      {/* Subscription Channels */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Subscription Channels</h2>
        <p className="text-gray-600 mb-6">
          Subscribe to different channels to receive specific types of real-time updates:
        </p>
        
        <div className="grid gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <BoltIcon className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold text-gray-900">ml-pipeline</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">Receive updates on ML pipeline status, progress, and results</p>
            <div className="text-xs text-gray-500">
              <strong>Events:</strong> pipeline_started, pipeline_progress, pipeline_completed, pipeline_failed
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <SignalIcon className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">data-processing</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">Monitor data processing jobs and transformations</p>
            <div className="text-xs text-gray-500">
              <strong>Events:</strong> processing_started, batch_completed, processing_finished, error_occurred
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <GlobeAltIcon className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">system-notifications</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">System-wide notifications and maintenance updates</p>
            <div className="text-xs text-gray-500">
              <strong>Events:</strong> maintenance_scheduled, rate_limit_warning, quota_exceeded
            </div>
          </div>
        </div>
      </section>

      {/* Message Format */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Message Format</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Subscription Message</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <pre className="text-sm"><code>{`{
  "type": "subscribe",
  "channel": "ml-pipeline",
  "resource_id": "pipeline_abc123",
  "filters": {
    "status": ["running", "completed"]
  }
}`}</code></pre>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Event Message</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <pre className="text-sm"><code>{`{
  "type": "event",
  "channel": "ml-pipeline",
  "event": "pipeline_progress",
  "resource_id": "pipeline_abc123",
  "data": {
    "progress": 0.75,
    "stage": "feature_engineering",
    "estimated_completion": "2024-01-20T10:45:00Z"
  },
  "timestamp": "2024-01-20T10:30:00Z"
}`}</code></pre>
            </div>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limits</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">WebSocket Limits</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Maximum 10 concurrent connections per API key</li>
            <li>• Maximum 100 messages per minute per connection</li>
            <li>• Maximum 50 channel subscriptions per connection</li>
            <li>• Connection timeout after 30 minutes of inactivity</li>
          </ul>
        </div>
      </section>

      {/* Error Handling */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Handling</h2>
        
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Common Error Messages</h3>
            <div className="space-y-3 text-sm">
              <div>
                <code className="font-mono bg-red-50 text-red-700 px-2 py-1 rounded">AUTHENTICATION_FAILED</code>
                <p className="text-gray-600 mt-1">Invalid or missing API key in connection headers</p>
              </div>
              <div>
                <code className="font-mono bg-orange-50 text-orange-700 px-2 py-1 rounded">SUBSCRIPTION_LIMIT_EXCEEDED</code>
                <p className="text-gray-600 mt-1">Too many channel subscriptions for this connection</p>
              </div>
              <div>
                <code className="font-mono bg-yellow-50 text-yellow-700 px-2 py-1 rounded">RATE_LIMIT_EXCEEDED</code>
                <p className="text-gray-600 mt-1">Message rate limit exceeded, connection will be throttled</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Best Practices</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">✅ Recommended</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Implement connection retry with exponential backoff</li>
              <li>• Send periodic ping messages to keep connections alive</li>
              <li>• Subscribe only to channels you actively monitor</li>
              <li>• Handle reconnection gracefully</li>
              <li>• Validate message format before processing</li>
            </ul>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">❌ Avoid</h3>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• Opening multiple connections unnecessarily</li>
              <li>• Subscribing to channels without filtering</li>
              <li>• Ignoring error messages from the server</li>
              <li>• Sending messages without rate limiting</li>
              <li>• Keeping idle connections open indefinitely</li>
            </ul>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}