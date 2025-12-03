import { DocsLayout } from '@/components/layout/DocsLayout';

export default function ApiPage() {
  return (
    <DocsLayout>
      <div className="prose max-w-none">
        <h1>API Reference</h1>
        <p className="text-lg text-gray-600">
          Complete reference for the Schlep-engine API.
        </p>

        <h2>Base URL</h2>
        <pre><code>https://api.schlep-engine.com/v1</code></pre>

        <h2>Authentication</h2>
        <p>
          All API requests require authentication using a Bearer token in the Authorization header:
        </p>
        <pre><code>Authorization: Bearer YOUR_API_TOKEN</code></pre>

        <h2>Endpoints</h2>

        <h3>POST /v1/infer</h3>
        <p>
          Make an AI inference request through Schlep-engine's intelligent routing.
        </p>

        <h4>Request Body</h4>
        <pre><code>{`{
  "model": "string",
  "messages": [
    {
      "role": "user | assistant | system",
      "content": "string"
    }
  ],
  "max_tokens": number,
  "temperature": number (optional)
}`}</code></pre>

        <h4>Response</h4>
        <pre><code>{`{
  "id": "string",
  "model": "string",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "string"
      }
    }
  ],
  "usage": {
    "prompt_tokens": number,
    "completion_tokens": number,
    "total_tokens": number
  }
}`}</code></pre>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-yellow-900 font-medium m-0">
            📚 More API endpoints coming soon...
          </p>
        </div>
      </div>
    </DocsLayout>
  );
}
