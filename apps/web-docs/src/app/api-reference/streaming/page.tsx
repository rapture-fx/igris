import { ApiLayout } from '@/components/ui/ApiLayout'
import { SignalIcon, BoltIcon, EyeIcon } from '@heroicons/react/24/outline'

export default function StreamingApiPage() {

  return (
    <ApiLayout 
      title="Real-time Streaming"
      description="Stream and process data in real-time with WebSocket connections, Kafka integration, and live monitoring."
    >
      {/* Streaming Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Real-time Streaming Overview</h2>
        <p className="text-gray-600 mb-6">
          Our Real-time Streaming API enables you to process and monitor data streams in real-time. 
          Connect to various data sources like Kafka, WebSockets, or HTTP streams, apply processing rules, 
          and receive live updates through WebSocket connections.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <SignalIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Live Data Ingestion</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Connect to Kafka, WebSocket endpoints, or HTTP streams for continuous data ingestion.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BoltIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Real-time Processing</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Apply validation, transformation, and enrichment rules to streaming data in real-time.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <EyeIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Live Monitoring</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Monitor data quality, throughput, and errors through WebSocket connections and dashboards.
            </p>
          </div>
        </div>
      </section>

      {/* WebSocket Connection */}
      <section className="mb-12" id="websocket-connection">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">WebSocket Connection</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-200 text-purple-800">WebSocket</span>
            <code className="text-sm">wss://api.schlep-engine.com/ws</code>
          </div>
          <p className="text-gray-600 mb-4">
            Connect to our WebSocket endpoint to receive real-time updates for streaming data, quality alerts, and processing status.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Connection Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">token</code> (query, required) - Your API key for authentication</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">connection_id</code> (query, optional) - Specific streaming connection to monitor</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">investigation_id</code> (query, optional) - Investigation to monitor for updates</li>
            </ul>
          </div>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Message Types:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>data_update</strong> - New data received and processed</li>
              <li><strong>quality_alert</strong> - Data quality threshold breached</li>
              <li><strong>processing_status</strong> - Pipeline processing status changes</li>
              <li><strong>error</strong> - Processing errors or connection issues</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Create Streaming Connection */}
      <section className="mb-12" id="create-streaming-connection">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Streaming Connection</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/data-streaming/connections/</code>
          </div>
          <p className="text-gray-600 mb-4">
            Create a new real-time data streaming connection with processing rules and monitoring configuration.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">name</code> (string, required) - Connection name</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">source_type</code> (string, required) - kafka, webhook, websocket</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">config</code> (object, required) - Source-specific configuration</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">processing_rules</code> (array, optional) - Data processing rules</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">quality_thresholds</code> (object, optional) - Data quality monitoring thresholds</li>
            </ul>
          </div>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "connection": {
    "id": "conn_abc123",
    "name": "Customer Events Stream",
    "source_type": "kafka",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "metrics": {
      "records_processed": 0,
      "records_per_second": 0,
      "last_processed": null
    }
  },
  "websocket_url": "wss://api.schlep-engine.com/ws?token=sk_***&connection_id=conn_abc123"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* List Streaming Connections */}
      <section className="mb-12" id="list-streaming-connections">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Streaming Connections</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/data-streaming/connections/</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get a list of all streaming connections with their current status and metrics.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Query Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">status</code> (string, optional) - Filter by status: active, paused, error</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">source_type</code> (string, optional) - Filter by source type</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">limit</code> (int, optional) - Maximum connections to return</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">offset</code> (int, optional) - Number of connections to skip</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Get Connection Status */}
      <section className="mb-12" id="get-connection-status">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Connection Status</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/data-streaming/connections/{'{connection_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get detailed status and metrics for a specific streaming connection.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "id": "conn_abc123",
  "name": "Customer Events Stream",
  "source_type": "kafka",
  "status": "active",
  "config": {
    "bootstrap_servers": "kafka.company.com:9092",
    "topic": "customer_events",
    "group_id": "schlep_consumer"
  },
  "metrics": {
    "records_processed": 15847,
    "records_per_second": 23.4,
    "last_processed": "2024-01-15T11:30:45Z",
    "error_count": 2,
    "quality_score": 0.97
  },
  "last_quality_check": {
    "timestamp": "2024-01-15T11:30:00Z",
    "score": 0.97,
    "issues": []
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Pause/Resume Connection */}
      <section className="mb-12" id="control-connection">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Control Connection</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">POST</span>
              <code className="text-sm">/api/v1/data-streaming/connections/{'{connection_id}'}/pause</code>
            </div>
            <p className="text-gray-600 text-sm">Pause a streaming connection temporarily.</p>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">POST</span>
              <code className="text-sm">/api/v1/data-streaming/connections/{'{connection_id}'}/resume</code>
            </div>
            <p className="text-gray-600 text-sm">Resume a paused streaming connection.</p>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
              <code className="text-sm">/api/v1/data-streaming/connections/{'{connection_id}'}</code>
            </div>
            <p className="text-gray-600 text-sm">Stop and delete a streaming connection permanently.</p>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}