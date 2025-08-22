export default function ApiReferencePage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        API Reference
      </h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          The Schlep Engine API is organized around REST. Our API has predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Base URL</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>https://api.schlep-engine.com</code></pre>
        </div>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Authentication</h2>
        <p>All API requests must be authenticated using your API key in the Authorization header:</p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`curl -X POST https://api.schlep-engine.com/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "your@email.com",
    "password": "your_password"
  }'`}</code></pre>
        </div>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Core Endpoints</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Authentication:</strong> Login, register, refresh tokens, and manage user sessions</li>
          <li><strong>Data Processing:</strong> Create investigations, process data, and extract insights</li>
          <li><strong>ML Pipeline:</strong> Train models, make predictions, and manage deployments</li>
          <li><strong>Document Extraction:</strong> Extract structured data from PDFs and documents</li>
        </ul>
      </div>
    </div>
  )
}