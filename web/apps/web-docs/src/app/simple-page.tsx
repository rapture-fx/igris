export default function SimplePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Schlep Engine Documentation
      </h1>
      <p className="text-xl text-gray-600 mb-6">
        Welcome to the Schlep Engine API documentation. This is a comprehensive guide 
        to help you get started with our AI-powered data preparation platform.
      </p>
      
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Quick Start</h2>
          <p className="text-gray-600 mb-4">
            Get up and running with Schlep Engine in minutes. Learn the basics 
            of uploading data and making your first API calls.
          </p>
          <a href="/getting-started" className="text-blue-600 hover:text-blue-700">
            Get Started →
          </a>
        </div>
        
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">API Reference</h2>
          <p className="text-gray-600 mb-4">
            Complete API documentation with examples, parameters, and response formats 
            for all endpoints.
          </p>
          <a href="/api-reference" className="text-blue-600 hover:text-blue-700">
            View API Docs →
          </a>
        </div>
      </div>
    </div>
  )
}