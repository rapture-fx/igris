import { ApiLayout } from '@/components/ui/ApiLayout'
import { SignalIcon, BoltIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

export default function WebSocketApiPage() {
  const codeExamples = [
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `// Connect to WebSocket for real-time updates
const ws = new WebSocket('wss://api.schlep-engine.com/api/v1/websocket/connect');

ws.onopen = function(event) {
  console.log('✅ WebSocket connected');
  
  // Subscribe to pipeline updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'ml-pipeline',
    pipeline_id: 'pipeline_abc123'
  }));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'pipeline_status':
      console.log(\`Pipeline \${data.pipeline_id} status: \${data.status}\`);
      updateUI(data);
      break;
      
    case 'training_progress':
      console.log(\`Training progress: \${data.progress}%\`);
      updateProgressBar(data.progress);
      break;
      
    case 'error':
      console.error('WebSocket error:', data.message);
      break;
  }
};

ws.onerror = function(error) {
  console.error('WebSocket error:', error);
};

ws.onclose = function(event) {
  console.log('WebSocket connection closed');
  // Implement reconnection logic here
};`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import websocket
import json
import threading

class SchlepEngineWebSocket:
    def __init__(self, api_key):
        self.api_key = api_key
        self.ws = None
        
    def on_message(self, ws, message):
        data = json.loads(message)
        
        if data['type'] == 'pipeline_status':
            print(f"Pipeline {data['pipeline_id']} status: {data['status']}")
            
        elif data['type'] == 'training_progress':
            print(f"Training progress: {data['progress']}%")
            
        elif data['type'] == 'error':
            print(f"Error: {data['message']}")
    
    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket connection closed")
    
    def on_open(self, ws):
        print("✅ WebSocket connected")
        
        # Subscribe to updates
        subscribe_message = {
            "type": "subscribe",
            "channel": "ml-pipeline",
            "pipeline_id": "pipeline_abc123"
        }
        ws.send(json.dumps(subscribe_message))
    
    def connect(self):
        websocket.enableTrace(True)
        self.ws = websocket.WebSocketApp(
            "wss://api.schlep-engine.com/api/v1/websocket/connect",
            header=[f"Authorization: Bearer {self.api_key}"],
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.ws.run_forever()

# Usage
api_key = "sk_your_api_key"
ws_client = SchlepEngineWebSocket(api_key)
ws_client.connect()`
    },
    {
      language: 'curl',
      label: 'cURL',
      code: `# Get WebSocket connection stats
curl -X GET "https://api.schlep-engine.com/api/v1/websocket/stats" \\
  -H "Authorization: Bearer sk_your_api_key"

# Response
{
  "success": true,
  "data": {
    "active_connections": 45,
    "total_messages_sent": 12847,
    "total_messages_received": 8392,
    "channels": {
      "ml-pipeline": 23,
      "data-processing": 15,
      "system-alerts": 7
    },
    "uptime_seconds": 86400
  }
}

# Health check
curl -X GET "https://api.schlep-engine.com/api/v1/websocket/health" \\
  -H "Authorization: Bearer sk_your_api_key"`
    }
  ]

  return (
    <ApiLayout 
      title="WebSocket API"
      description="Real-time updates and notifications via WebSocket connections for ML pipeline status, data processing, and system events."
      codeExamples={codeExamples}
    >
      {/* WebSocket Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Real-time Updates</h2>
        <p className="text-gray-600 mb-6">
          Connect to our WebSocket API to receive real-time updates about your ML pipelines, 
          data processing jobs, and system notifications. Perfect for building responsive 
          dashboards and monitoring applications.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <SignalIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Live Pipeline Updates</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Get instant notifications when training starts, progresses, or completes.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BoltIcon className="h-6 w-6 text-yellow-600" />
              <h3 className="font-semibold text-gray-900">System Alerts</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Receive real-time alerts about system status, errors, and maintenance.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <GlobeAltIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Multi-channel Support</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Subscribe to specific channels for targeted notifications and updates.
            </p>
          </div>
        </div>
      </section>

      {/* Connection */}
      <section className="mb-12" id="websocket-connect">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">WebSocket Connection</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">WSS</span>
            <code className="text-sm">wss://api.schlep-engine.com/api/v1/websocket/connect</code>
          </div>
          <p className="text-gray-600 mb-4">Establish a WebSocket connection for real-time updates.</p>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">Authentication</h4>
            <p className="text-sm text-gray-600 mb-3">Include your API key in the Authorization header during connection.</p>
            <h4 className="font-semibold mb-2">Available Channels</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <code>ml-pipeline</code> - ML training and deployment updates</li>
              <li>• <code>data-processing</code> - Data upload and processing status</li>
              <li>• <code>system-alerts</code> - System-wide notifications</li>
              <li>• <code>user-activity</code> - Account and usage notifications</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Message Types */}
      <section className="mb-12" id="message-types">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Message Types</h2>
        
        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Subscribe to Channel</h3>
            <div className="bg-white p-4 rounded border">
              <pre className="text-sm text-gray-600">
{`{
  "type": "subscribe",
  "channel": "ml-pipeline",
  "pipeline_id": "pipeline_abc123" // optional filter
}`}
              </pre>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Pipeline Status Update</h3>
            <div className="bg-white p-4 rounded border">
              <pre className="text-sm text-gray-600">
{`{
  "type": "pipeline_status",
  "pipeline_id": "pipeline_abc123",
  "status": "training",
  "progress": 65,
  "estimated_completion": "2024-01-20T11:45:00Z",
  "message": "Feature engineering complete, starting model training"
}`}
              </pre>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">System Alert</h3>
            <div className="bg-white p-4 rounded border">
              <pre className="text-sm text-gray-600">
{`{
  "type": "system_alert",
  "severity": "info",
  "title": "Scheduled Maintenance",
  "message": "System maintenance scheduled for tonight at 2 AM UTC",
  "timestamp": "2024-01-20T10:30:00Z"
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* WebSocket Stats */}
      <section className="mb-12" id="websocket-stats">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connection Statistics</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/websocket/stats</code>
          </div>
          <p className="text-gray-600 mb-4">Get statistics about WebSocket connections and message throughput.</p>
        </div>
      </section>

      {/* Health Check */}
      <section className="mb-12" id="websocket-health">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">WebSocket Health Check</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/websocket/health</code>
          </div>
          <p className="text-gray-600 mb-4">Check the health status of the WebSocket service.</p>
        </div>
      </section>

      {/* Best Practices */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">WebSocket Best Practices</h2>
        <ul className="text-blue-800 text-sm space-y-2">
          <li>• <strong>Reconnection Logic:</strong> Implement automatic reconnection with exponential backoff</li>
          <li>• <strong>Heartbeat/Ping:</strong> Send periodic ping messages to keep the connection alive</li>
          <li>• <strong>Message Acknowledgment:</strong> Implement message acknowledgment for critical updates</li>
          <li>• <strong>Rate Limiting:</strong> Respect rate limits to avoid connection termination</li>
          <li>• <strong>Error Handling:</strong> Handle connection errors gracefully and inform users</li>
        </ul>
      </section>
    </ApiLayout>
  )
}