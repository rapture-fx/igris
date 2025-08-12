export default function FirstCallPage() {
  // Extract JSON objects to avoid JSX parsing conflicts
  const healthResponse = {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2024-01-15T10:30:00Z"
  };
  
  const uploadResponse = {
    "upload_id": "upload_abc123",
    "status": "processing", 
    "name": "My First Upload",
    "rows": 3,
    "columns": 4,
    "created_at": "2024-01-15T10:35:00Z"
  };

  const pythonCode = `import schlep_engine as se

# Initialize client
client = se.Client(api_key="YOUR_API_KEY")

# Upload data
result = client.upload_file("sample-data.csv", name="My First Upload")
print(f"Upload ID: {result.upload_id}")

# Check status
status = client.get_upload_status(result.upload_id)
print(f"Status: {status.processing_status}")`;

  const javascriptCode = `import SchlepEngine from 'schlep-engine';

// Initialize client
const client = new SchlepEngine({ apiKey: 'YOUR_API_KEY' });

// Upload data
const result = await client.uploadFile('sample-data.csv', {
  name: 'My First Upload'
});

console.log(\`Upload ID: \${result.uploadId}\`);

// Check status
const status = await client.getUploadStatus(result.uploadId);
console.log(\`Status: \${status.processingStatus}\`);`;

  const healthCheckCurl = `curl -X GET "https://api.schlepengine.com/v1/health" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const uploadCurl = `curl -X POST "https://api.schlepengine.com/v1/upload" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@sample-data.csv" \\
  -F "name=My First Upload"`;

  const statusCheckCurl = `curl -X GET "https://api.schlepengine.com/v1/uploads/upload_abc123/status" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const csvSample = `name,age,email,city
John Doe,25,john@example.com,New York
Jane Smith,30,jane@example.com,Los Angeles
Bob Johnson,35,bob@example.com,Chicago`;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        Your First API Call
      </h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          Make your first successful API call to Schlep Engine in just a few minutes.
        </p>

        <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Prerequisites
          </h3>
          <ul className="text-green-700 space-y-1">
            <li>• Schlep-engine account (sign up at dashboard.schlepengine.com)</li>
            <li>• Valid API key (see <a href="/introduction/api-keys" className="underline">API Keys guide</a>)</li>
            <li>• Terminal or API testing tool</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Test Call</h2>
        
        <p>Let's start with a simple health check to verify your API key works:</p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{healthCheckCurl}</code></pre>
        </div>

        <p>Expected response:</p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{JSON.stringify(healthResponse, null, 2)}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Upload Sample Data</h2>
        
        <p>Now let's upload some sample data for processing:</p>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 1: Prepare Sample Data</h3>
        <p>Create a simple CSV file named <code>sample-data.csv</code>:</p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{csvSample}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 2: Upload the Data</h3>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{uploadCurl}</code></pre>
        </div>

        <p>Expected response:</p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{JSON.stringify(uploadResponse, null, 2)}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 3: Check Processing Status</h3>
        
        <p>Monitor the processing status using the upload ID:</p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{statusCheckCurl}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Using SDKs</h2>
        
        <p>For easier integration, use our official SDKs:</p>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Python</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{pythonCode}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">JavaScript</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{javascriptCode}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Common Issues</h2>
        
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-2">401 Unauthorized</h3>
            <p className="text-gray-600 mb-2">Your API key is missing or invalid.</p>
            <p className="text-sm text-gray-500">
              <strong>Solution:</strong> Verify your API key is correct and properly formatted in the Authorization header.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-2">413 Payload Too Large</h3>
            <p className="text-gray-600 mb-2">Your file exceeds the maximum upload size.</p>
            <p className="text-sm text-gray-500">
              <strong>Solution:</strong> Break large files into smaller chunks or contact support for enterprise limits.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-2">429 Too Many Requests</h3>
            <p className="text-gray-600 mb-2">You've exceeded your rate limits.</p>
            <p className="text-sm text-gray-500">
              <strong>Solution:</strong> Wait before retrying or upgrade your plan for higher limits.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-12">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Next Steps
          </h3>
          <ul className="text-blue-700 space-y-2">
            <li>• Explore the <a href="/api-reference" className="underline">full API reference</a></li>
            <li>• Learn about <a href="/api-reference/processing" className="underline">data processing options</a></li>
            <li>• Check out our <a href="/sdks" className="underline">SDK documentation</a></li>
            <li>• Browse <a href="/use-cases" className="underline">real-world use cases</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}