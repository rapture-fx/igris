import { CodeBlock } from '@/components/ui/CodeBlock'
import { RocketLaunchIcon, KeyIcon, ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function GettingStartedPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Getting Started with Schlep-engine
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Transform your messy data into ML-ready formats with just a few API calls. 
          This guide will get you up and running in minutes.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 hover:shadow-md transition-shadow">
          <RocketLaunchIcon className="h-10 w-10 mb-6 text-blue-600" />
          <h3 className="text-2xl font-semibold mb-4 text-gray-900">5-Minute Setup</h3>
          <p className="text-gray-600 leading-relaxed">Get your API key and make your first request in under 5 minutes</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 hover:shadow-md transition-shadow">
          <ShieldCheckIcon className="h-10 w-10 mb-6 text-green-600" />
          <h3 className="text-2xl font-semibold mb-4 text-gray-900">Enterprise Security</h3>
          <p className="text-gray-600 leading-relaxed">Bank-grade encryption and SOC 2 compliance built-in</p>
        </div>
      </div>

      <div className="space-y-16">
        {/* Quick Start Section */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Quick Start</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Follow these simple steps to integrate Schlep-engine into your workflow
            </p>
          </div>
          
          <div className="space-y-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-4">1</span>
                Get Your API Key
              </h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Sign up for a free account and get your API key from the dashboard.
              </p>
            
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center mb-3">
                  <KeyIcon className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm font-semibold text-blue-900">Your API Key</span>
                </div>
                <code className="text-sm text-blue-800 font-mono bg-white px-3 py-2 rounded border">sk_test_4eC39HqLyjWDarjtT1zdp7dc</code>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-4">2</span>
                Make Your First Request
              </h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Let's start by uploading a CSV file and getting a data profile:
              </p>

            <CodeBlock
              code={`import requests

# Upload your data
response = requests.post('https://api.schlep-engine.com/v1/upload', 
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'},
    files={'file': open('customer_data.csv', 'rb')}
)

upload_result = response.json()
print(f"Upload ID: {upload_result['upload_id']}")

# Get data profile
profile_response = requests.get(
    f"https://api.schlep-engine.com/v1/profile/{upload_result['upload_id']}",
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

profile = profile_response.json()
print(f"Data quality score: {profile['quality_score']}")
print(f"Detected columns: {len(profile['columns'])}")
print(f"Recommended transformations: {len(profile['recommendations'])}")`}
              language="python"
              title="Python"
            />

            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-4">3</span>
                Process Your Data
              </h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Apply statistical transformations to clean and prepare your data:
              </p>

            <CodeBlock
              code={`# Start data processing
process_response = requests.post(
    'https://api.schlep-engine.com/v1/process',
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
    f"https://api.schlep-engine.com/v1/jobs/{job['job_id']}",
    headers={'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'}
)

status = status_response.json()
print(f"Progress: {status['progress']}%")
print(f"ETA: {status['eta_seconds']} seconds")`}
              language="python"
              title="Python"
            />
            </div>
          </div>
        </section>

        {/* Key Concepts Section */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Key Concepts</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Understanding these core concepts will help you make the most of Schlep-engine
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center hover:shadow-md transition-shadow">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Uploads</h3>
              <p className="text-gray-600 leading-relaxed">
                Upload CSV, JSON, Excel, or connect directly to databases. 
                Each upload gets a unique ID for tracking.
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center hover:shadow-md transition-shadow">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Processing Jobs</h3>
              <p className="text-gray-600 leading-relaxed">
                Async processing jobs handle data transformation. 
                Track progress and get notifications when complete.
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center hover:shadow-md transition-shadow">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Export Formats</h3>
              <p className="text-gray-600 leading-relaxed">
                Export to TensorFlow, PyTorch, scikit-learn, or custom formats 
                ready for your ML pipeline.
              </p>
            </div>
          </div>
        </section>

        {/* Next Steps Section */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What's Next?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ready to dive deeper? Explore these resources to master Schlep-engine
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <a href="/getting-started/authentication" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-8 hover:shadow-lg transition-all hover:border-blue-200">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-2 rounded-lg mr-4 group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4.1M9 7h6m-3 3v8m-3-4h6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Authentication Guide
                </h3>
              </div>
              <p className="text-gray-600 leading-relaxed">Learn about API keys, tokens, and security best practices</p>
            </a>
            
            <a href="/api-reference" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-8 hover:shadow-lg transition-all hover:border-blue-200">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-2 rounded-lg mr-4 group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  API Reference
                </h3>
              </div>
              <p className="text-gray-600 leading-relaxed">Complete API documentation with examples</p>
            </a>
            
            <a href="/guides/workflow" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-8 hover:shadow-lg transition-all hover:border-blue-200">
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-2 rounded-lg mr-4 group-hover:bg-purple-200 transition-colors">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                  Workflow Guide
                </h3>
              </div>
              <p className="text-gray-600 leading-relaxed">Best practices for data preparation workflows</p>
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}