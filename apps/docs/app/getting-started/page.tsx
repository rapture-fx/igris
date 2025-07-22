import { CodeBlock } from '@/components/CodeBlock'
import { RocketLaunchIcon, KeyIcon, ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function GettingStartedPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Getting Started with Schlep-engine</h1>
        <p className="text-xl text-gray-600">
          Transform your messy data into ML-ready formats with just a few API calls. 
          This guide will get you up and running in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="py-8 px-6">
          <RocketLaunchIcon className="h-8 w-8 mb-4 text-blue-600" />
          <h3 className="text-xl font-semibold mb-3 text-gray-900">5-Minute Setup</h3>
          <p className="text-gray-600">Get your API key and make your first request in under 5 minutes</p>
        </div>
        <div className="py-8 px-6">
          <ShieldCheckIcon className="h-8 w-8 mb-4 text-green-600" />
          <h3 className="text-xl font-semibold mb-3 text-gray-900">Enterprise Security</h3>
          <p className="text-gray-600">Bank-grade encryption and SOC 2 compliance built-in</p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start</h2>
          <div className="py-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Get Your API Key</h3>
            <p className="text-gray-600 mb-6">
              Sign up for a free account and get your API key from the dashboard.
            </p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
              <div className="flex items-center">
                <KeyIcon className="h-5 w-5 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Your API Key</span>
              </div>
              <code className="text-sm text-gray-700 mt-2 block font-mono">sk_test_4eC39HqLyjWDarjtT1zdp7dc</code>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Make Your First Request</h3>
            <p className="text-gray-600 mb-4">
              Let's start by uploading a CSV file and getting a data profile:
            </p>

            <CodeBlock
              code={`import requests

# Upload your data
response = requests.post('https://api.schlepengine.com/v1/upload', 
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    files={'file': open('customer_data.csv', 'rb')}
)

upload_result = response.json()
print(f"Upload ID: {upload_result['upload_id']}")

# Get data profile
profile_response = requests.get(
    f"https://api.schlepengine.com/v1/profile/{upload_result['upload_id']}",
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

profile = profile_response.json()
print(f"Data quality score: {profile['quality_score']}")
print(f"Detected columns: {len(profile['columns'])}")
print(f"Recommended transformations: {len(profile['recommendations'])}")`}
              language="python"
              title="Python"
            />

            <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">3. Process Your Data</h3>
            <p className="text-gray-600 mb-4">
              Apply AI-powered transformations to clean and prepare your data:
            </p>

            <CodeBlock
              code={`# Start data processing
process_response = requests.post(
    'https://api.schlepengine.com/v1/process',
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    json={
        'upload_id': upload_result['upload_id'],
        'target_format': 'tensorflow',
        'quality_threshold': 0.95,
        'auto_fix': True
    }
)

job = process_response.json()
print(f"Job ID: {job['job_id']}")
print(f"Status: {job['status']}")

# Check processing status
status_response = requests.get(
    f"https://api.schlepengine.com/v1/jobs/{job['job_id']}",
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

status = status_response.json()
print(f"Progress: {status['progress']}%")
print(f"ETA: {status['eta_seconds']} seconds")`}
              language="python"
              title="Python"
            />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Concepts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Uploads</h3>
              <p className="text-gray-600">
                Upload CSV, JSON, Excel, or connect directly to databases. 
                Each upload gets a unique ID for tracking.
              </p>
            </div>
            <div className="py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Jobs</h3>
              <p className="text-gray-600">
                Async processing jobs handle data transformation. 
                Track progress and get notifications when complete.
              </p>
            </div>
            <div className="py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Export Formats</h3>
              <p className="text-gray-600">
                Export to TensorFlow, PyTorch, scikit-learn, or custom formats 
                ready for your ML pipeline.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Steps</h2>
          <div className="py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  <a href="/getting-started/authentication" className="text-blue-600 hover:text-blue-800">
                    → Authentication Guide
                  </a>
                </h3>
                <p className="text-gray-600">Learn about API keys, tokens, and security best practices</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  <a href="/api-reference" className="text-blue-600 hover:text-blue-800">
                    → API Reference
                  </a>
                </h3>
                <p className="text-gray-600">Complete API documentation with examples</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  <a href="/guides/workflow" className="text-blue-600 hover:text-blue-800">
                    → Data Preparation Workflow
                  </a>
                </h3>
                <p className="text-gray-600">Best practices for data preparation workflows</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}