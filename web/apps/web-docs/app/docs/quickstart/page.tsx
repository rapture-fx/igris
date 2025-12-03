import { DocsLayout } from '@/components/layout/DocsLayout';

export default function QuickStartPage() {
  return (
    <DocsLayout>
      <div className="prose max-w-none">
        <h1>Quick Start Guide</h1>
        <p className="text-lg text-gray-600">
          Get up and running with Schlep-engine in less than 5 minutes.
        </p>

        <h2>Prerequisites</h2>
        <ul>
          <li>API keys from at least one AI provider (OpenAI, Anthropic, etc.)</li>
          <li>Basic understanding of REST APIs</li>
          <li>A Schlep-engine account</li>
        </ul>

        <h2>Step 1: Create Your Account</h2>
        <p>
          Sign up for a Schlep-engine account at{' '}
          <a href="https://schlep-engine.com">schlep-engine.com</a>. You'll get instant access to the
          developer tier with generous free usage limits.
        </p>

        <h2>Step 2: Add Your API Keys</h2>
        <p>
          Navigate to <strong>Providers & Keys</strong> in the dashboard and add your AI provider API keys.
          Schlep-engine securely stores your keys using industry-standard encryption.
        </p>

        <pre><code>{`# Example: Adding OpenAI API key
API_PROVIDER=openai
API_KEY=sk-...your-key...`}</code></pre>

        <h2>Step 3: Create a Routing Policy</h2>
        <p>
          Go to <strong>Routing Policies</strong> and create your first policy. A routing policy defines
          how Schlep-engine should route your AI requests.
        </p>

        <h2>Step 4: Make Your First Request</h2>
        <p>
          Use the Schlep-engine API to make your first AI inference request:
        </p>

        <pre><code>{`curl -X POST https://api.schlep-engine.com/v1/infer \\
  -H "Authorization: Bearer YOUR_SCHLEP_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'`}</code></pre>

        <h2>Next Steps</h2>
        <ul>
          <li>Explore the <a href="/docs/api">API Reference</a> for detailed endpoint documentation</li>
          <li>Learn about <a href="/docs/guides">routing strategies</a> and optimization techniques</li>
          <li>Set up <a href="/docs/configuration">custom configurations</a> for your use case</li>
        </ul>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-green-900 font-medium m-0">
            ✅ <strong>Success!</strong> You're now ready to build with Schlep-engine.
          </p>
        </div>
      </div>
    </DocsLayout>
  );
}
