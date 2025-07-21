export default function JavaScriptSDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        JavaScript SDK
      </h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          The official JavaScript SDK for Schlep Engine - perfect for Node.js applications and browser-based data processing.
        </p>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# npm
npm install schlep-engine

# yarn
yarn add schlep-engine

# pnpm
pnpm add schlep-engine`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Example</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`import SchlepEngine from 'schlep-engine';

// Initialize client
const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY
});

// Upload and process file
const upload = await client.uploadFile('./data.csv');
const result = await client.processUpload(upload.id, {
  operations: ['clean', 'profile', 'autoLabel']
});

// Get cleaned data
const cleanData = await result.downloadAsJson();
console.log(\`Processed \${cleanData.length} rows\`);`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Core Methods</h2>
        
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">uploadFile()</h3>
            <div className="bg-gray-50 rounded p-3 mb-3">
              <code className="text-sm">await client.uploadFile(file, options)</code>
            </div>
            <p className="text-gray-600 text-sm">Upload a file for processing. Supports CSV, JSON, Excel formats.</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">processData()</h3>
            <div className="bg-gray-50 rounded p-3 mb-3">
              <code className="text-sm">await client.processData(data, operations)</code>
            </div>
            <p className="text-gray-600 text-sm">Process JSON data directly without file upload.</p>
          </div>
        </div>
      </div>
    </div>
  )
}