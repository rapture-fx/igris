import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'
import Link from 'next/link'

export default function JavaScriptSDKPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                JavaScript SDK
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  The official JavaScript SDK for schlep-engine - perfect for Node.js applications and browser-based data processing.
                </p>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`# npm
npm install @schlep-engine/js-sdk

# yarn
yarn add @schlep-engine/js-sdk

# pnpm
pnpm add @schlep-engine/js-sdk`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Example</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import SchlepEngine from '@schlep-engine/js-sdk';

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
                    <p className="text-gray-600 text-sm mb-4">Upload a file for processing. Supports CSV, JSON, Excel formats.</p>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-900"><code>{`// Node.js - File from filesystem
import fs from 'fs';
const fileBuffer = fs.readFileSync('./data.csv');
const upload = await client.uploadFile(fileBuffer, {
  filename: 'data.csv',
  contentType: 'text/csv'
});

// Browser - File from input
const fileInput = document.getElementById('file-input');
const upload = await client.uploadFile(fileInput.files[0]);

console.log('Upload ID:', upload.id);`}</code></pre>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">processData()</h3>
                    <div className="bg-gray-50 rounded p-3 mb-3">
                      <code className="text-sm">await client.processData(data, operations)</code>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Process JSON data directly without file upload.</p>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-900"><code>{`const data = [
  { name: 'John', age: 30, city: 'New York' },
  { name: 'Jane', age: 25, city: 'San Francisco' },
  { name: 'Bob', age: 35, city: 'Chicago' }
];

const result = await client.processData(data, {
  operations: ['clean', 'validate', 'normalize'],
  outputFormat: 'json'
});

console.log('Processed data:', result.data);`}</code></pre>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">getJobStatus()</h3>
                    <div className="bg-gray-50 rounded p-3 mb-3">
                      <code className="text-sm">await client.getJobStatus(jobId)</code>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Monitor the status of a processing job.</p>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-900"><code>{`// Poll job status
const jobId = 'job_123abc';
let status = await client.getJobStatus(jobId);

while (status.status === 'processing') {
  console.log(\`Progress: \${status.progress}%\`);
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
  status = await client.getJobStatus(jobId);
}

if (status.status === 'completed') {
  const result = await client.downloadResult(jobId);
  console.log('Job completed!', result);
}`}</code></pre>
                    </div>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Browser Usage</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`<!DOCTYPE html>
<html>
<head>
  <title>Schlep Engine Demo</title>
</head>
<body>
  <input type="file" id="fileInput" accept=".csv,.json,.xlsx" />
  <button onclick="processFile()">Process File</button>
  <div id="results"></div>

  <script type="module">
    import SchlepEngine from 'https://cdn.jsdelivr.net/npm/schlep-engine@latest/dist/browser.js';
    
    const client = new SchlepEngine({
      apiKey: 'your-api-key-here'
    });
    
    window.processFile = async function() {
      const fileInput = document.getElementById('fileInput');
      const file = fileInput.files[0];
      
      if (!file) {
        alert('Please select a file');
        return;
      }
      
      try {
        // Upload file
        const upload = await client.uploadFile(file);
        console.log('File uploaded:', upload.id);
        
        // Process file
        const result = await client.processUpload(upload.id, {
          operations: ['clean', 'profile']
        });
        
        // Display results
        document.getElementById('results').innerHTML = 
          \`<h3>Processing Complete!</h3>
           <p>Quality Score: \${result.qualityScore}%</p>
           <p>Rows Processed: \${result.rowCount}</p>\`;
        
      } catch (error) {
        console.error('Processing failed:', error);
        alert('Processing failed: ' + error.message);
      }
    };
  </script>
</body>
</html>`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Node.js Server Integration</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`// Express.js example
import express from 'express';
import multer from 'multer';
import SchlepEngine from 'schlep-engine';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const schlepClient = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY
});

app.post('/process-data', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Upload to Schlep Engine
    const uploadResult = await schlepClient.uploadFile(req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    // Process the file
    const processResult = await schlepClient.processUpload(uploadResult.id, {
      operations: ['clean', 'validate', 'profile'],
      outputFormat: 'json'
    });
    
    res.json({
      success: true,
      uploadId: uploadResult.id,
      qualityScore: processResult.qualityScore,
      rowCount: processResult.rowCount,
      downloadUrl: processResult.downloadUrl
    });
    
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ 
      error: 'Processing failed',
      message: error.message 
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Error Handling</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import SchlepEngine, { 
  SchlepError, 
  ValidationError, 
  RateLimitError,
  AuthenticationError 
} from 'schlep-engine';

const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY,
  retryAttempts: 3,
  timeout: 30000
});

try {
  const result = await client.processData(data);
  console.log('Success:', result);
  
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    // Handle auth error - redirect to login, refresh token, etc.
    
  } else if (error instanceof ValidationError) {
    console.error('Data validation failed:', error.details);
    // Handle validation errors - show user what's wrong with their data
    
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
    // Handle rate limiting - implement backoff strategy
    
  } else if (error instanceof SchlepError) {
    console.error('API Error:', error.statusCode, error.message);
    // Handle other API errors
    
  } else {
    console.error('Unexpected error:', error);
    // Handle network errors, etc.
  }
}`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">TypeScript Support</h2>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import SchlepEngine, { 
  ProcessingOptions, 
  UploadResult, 
  ProcessingResult 
} from 'schlep-engine';

const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY!
});

// Type-safe processing options
const options: ProcessingOptions = {
  operations: ['clean', 'profile'],
  outputFormat: 'json',
  qualityThreshold: 0.85
};

// Upload with proper typing
const uploadFile = async (file: File): Promise<UploadResult> => {
  return await client.uploadFile(file);
};

// Process with type safety
const processData = async (uploadId: string): Promise<ProcessingResult> => {
  return await client.processUpload(uploadId, options);
};`}</code></pre>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-8">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    Next Steps
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Explore more advanced features and integrations.
                  </p>
                  <div className="space-y-2">
                    <Link href="/docs/api-reference" className="block text-blue-600 hover:underline">→ Complete API Reference</Link>
                    <Link href="/docs/sdks/python" className="block text-blue-600 hover:underline">→ Python SDK Documentation</Link>
                    <Link href="/playground" className="block text-blue-600 hover:underline">→ Try the API Playground</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}