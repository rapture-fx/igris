import { DocsLayout } from '@/components/layout/DocsLayout';

export default function DocsPage() {
  return (
    <DocsLayout>
      <div className="prose max-w-none">
        <h1>Welcome to Schlep-engine Documentation</h1>
        <p className="text-lg text-gray-600">
          We handle the schlep so you don't have to.
        </p>

        <h2>What is Schlep-engine?</h2>
        <p>
          Schlep-engine is a powerful AI inference infrastructure platform that helps you manage
          and optimize your LLM deployments. Our platform provides intelligent routing, cost
          optimization, and comprehensive observability for your AI workloads.
        </p>

        <h2>Key Features</h2>
        <ul>
          <li><strong>Intelligent Routing</strong>: Automatically route requests to the best provider based on latency, cost, and availability</li>
          <li><strong>Cost Optimization</strong>: Reduce your AI infrastructure costs by up to 40% with smart provider selection</li>
          <li><strong>Comprehensive Observability</strong>: Monitor usage, latency, and costs in real-time</li>
          <li><strong>Multi-Provider Support</strong>: Integrate with OpenAI, Anthropic, and other leading AI providers</li>
        </ul>

        <h2>Getting Started</h2>
        <p>
          Ready to get started? Check out our <a href="/docs/quickstart">Quick Start Guide</a> to
          set up your first AI routing policy in minutes.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-900 font-medium m-0">
            💡 <strong>Tip:</strong> Use the sidebar to navigate through different sections of the documentation.
          </p>
        </div>
      </div>
    </DocsLayout>
  );
}
