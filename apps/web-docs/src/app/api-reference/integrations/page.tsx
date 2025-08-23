import { ApiLayout } from '@/components/ui/ApiLayout'

export default function IntegrationsApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Connect to a PostgreSQL database
curl -X POST https://api.schlep-engine.com/api/v1/integrations/database/connect \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{ 
    "connection_name": "my_pg_db",
    "database_type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "username": "user",
    "password": "password"
  }'`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

# Connect to a PostgreSQL database
connection_data = {
    "connection_name": "my_pg_db",
    "database_type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "username": "user",
    "password": "password"
}
response = requests.post("https://api.schlep-engine.com/api/v1/integrations/database/connect", headers=headers, json=connection_data)
print(response.json())`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';

// Connect to a PostgreSQL database
const connectionData = {
    connection_name: "my_pg_db",
    database_type: "postgresql",
    host: "localhost",
    port: 5432,
    database: "mydb",
    username: "user",
    password: "password"
};

fetch('https://api.schlep-engine.com/api/v1/integrations/database/connect', {
  method: 'POST',
  headers: {
    'Authorization': 
      `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(connectionData)
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Integrations API"
      description="Connect to various data sources and external services."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="connect-database">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connect Database</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/database/connect</code>
          </div>
          <p className="text-gray-600 mb-4">Connect to a database (PostgreSQL, MySQL, MongoDB).</p>
        </div>
      </section>

      <section className="mb-12" id="execute-database-query">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Execute Database Query</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/database/query</code>
          </div>
          <p className="text-gray-600 mb-4">Execute SQL query on connected database.</p>
        </div>
      </section>

      <section className="mb-12" id="list-database-tables">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Database Tables</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/integrations/database/{{'{connection_name}'}}/tables</code>
          </div>
          <p className="text-gray-600 mb-4">List all tables in the connected database.</p>
        </div>
      </section>

      <section className="mb-12" id="get-table-schema">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Table Schema</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/integrations/database/{{'{connection_name}'}}/tables/{{'{table_name}'}}/schema</code>
          </div>
          <p className="text-gray-600 mb-4">Get schema information for a specific table.</p>
        </div>
      </section>

      <section className="mb-12" id="connect-cloud-storage">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connect Cloud Storage</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/storage/connect</code>
          </div>
          <p className="text-gray-600 mb-4">Connect to cloud storage (AWS S3, Google Cloud Storage, Azure Blob).</p>
        </div>
      </section>

      <section className="mb-12" id="list-storage-files">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Storage Files</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/integrations/storage/{{'{connection_name}'}}/files</code>
          </div>
          <p className="text-gray-600 mb-4">List files in cloud storage.</p>
        </div>
      </section>

      <section className="mb-12" id="read-storage-file">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Read Storage File</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/storage/read-file</code>
          </div>
          <p className="text-gray-600 mb-4">Read file from cloud storage into investigation.</p>
        </div>
      </section>

      <section className="mb-12" id="connect-external-api">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connect External API</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/api/connect</code>
          </div>
          <p className="text-gray-600 mb-4">Connect to external API.</p>
        </div>
      </section>

      <section className="mb-12" id="fetch-api-data">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Fetch API Data</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/api/fetch</code>
          </div>
          <p className="text-gray-600 mb-4">Fetch data from external API.</p>
        </div>
      </section>

      <section className="mb-12" id="setup-webhook">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Setup Webhook</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/webhooks/setup</code>
          </div>
          <p className="text-gray-600 mb-4">Setup webhook for receiving data.</p>
        </div>
      </section>

      <section className="mb-12" id="connect-streaming">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connect Streaming</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/integrations/streaming/connect</code>
          </div>
          <p className="text-gray-600 mb-4">Connect to real-time data stream.</p>
        </div>
      </section>

      <section className="mb-12" id="list-connections">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Connections</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/integrations/connections</code>
          </div>
          <p className="text-gray-600 mb-4">List all active connections.</p>
        </div>
      </section>

      <section className="mb-12" id="remove-connection">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Remove Connection</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/integrations/connections/{{'{connection_name}'}}</code>
          </div>
          <p className="text-gray-600 mb-4">Remove a connection.</p>
        </div>
      </section>

      <section className="mb-12" id="integration-health-check">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Integration Health Check</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/integrations/health</code>
          </div>
          <p className="text-gray-600 mb-4">Health check for integration services.</p>
        </div>
      </section>
    </ApiLayout>
  )
}