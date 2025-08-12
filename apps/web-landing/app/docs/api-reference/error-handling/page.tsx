import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'
import Link from 'next/link'

export default function ErrorHandlingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                Error Handling
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  Complete error code reference and best practices for handling errors in your schlep-engine integrations.
                </p>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Error Response Format</h2>
                
                <p>All API errors follow a consistent JSON format:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Invalid file format",
    "code": "INVALID_FILE_FORMAT",
    "details": {
      "field": "file",
      "provided": "txt",
      "allowed": ["csv", "json", "xlsx"]
    },
    "request_id": "req_123456789",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}`}</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">Error Object Fields</h3>
                
                <div className="space-y-4 mb-8">
                  <div>
                    <h4 className="font-semibold text-gray-900">type</h4>
                    <p className="text-gray-600">Category of error (validation_error, authentication_error, etc.)</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">message</h4>
                    <p className="text-gray-600">Human-readable error description</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">code</h4>
                    <p className="text-gray-600">Machine-readable error code for programmatic handling</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">details</h4>
                    <p className="text-gray-600">Additional context and debugging information (optional)</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">request_id</h4>
                    <p className="text-gray-600">Unique identifier for troubleshooting with support</p>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">HTTP Status Codes</h2>
                
                <div className="space-y-6 mb-8">
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 mr-3">
                        400
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Bad Request</h3>
                    </div>
                    <p className="text-gray-600 mb-4">The request was invalid or cannot be processed.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: INVALID_FILE_FORMAT, MISSING_PARAMETER, INVALID_JSON</code>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 mr-3">
                        401
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Unauthorized</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Authentication is required or has failed.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: INVALID_API_KEY, MISSING_AUTHORIZATION, TOKEN_EXPIRED</code>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 mr-3">
                        403
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Forbidden</h3>
                    </div>
                    <p className="text-gray-600 mb-4">The request is valid but not allowed.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: INSUFFICIENT_PERMISSIONS, PLAN_LIMIT_EXCEEDED, RESOURCE_FORBIDDEN</code>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 mr-3">
                        404
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Not Found</h3>
                    </div>
                    <p className="text-gray-600 mb-4">The requested resource does not exist.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: UPLOAD_NOT_FOUND, JOB_NOT_FOUND, ENDPOINT_NOT_FOUND</code>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 mr-3">
                        413
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Payload Too Large</h3>
                    </div>
                    <p className="text-gray-600 mb-4">The request payload exceeds size limits.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: FILE_SIZE_EXCEEDED, REQUEST_TOO_LARGE</code>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 mr-3">
                        429
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Too Many Requests</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Rate limit exceeded.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: RATE_LIMIT_EXCEEDED</code>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 mr-3">
                        500
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">Internal Server Error</h3>
                    </div>
                    <p className="text-gray-600 mb-4">An unexpected error occurred on our servers.</p>
                    <div className="bg-gray-50 rounded p-3">
                      <code className="text-sm text-gray-800">Common codes: INTERNAL_ERROR, PROCESSING_FAILED, SERVICE_UNAVAILABLE</code>
                    </div>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Common Error Codes</h2>
                
                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Complete Error Code Reference</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-sm">
                        <tr><td className="px-6 py-4 font-mono">INVALID_API_KEY</td><td className="px-6 py-4">401</td><td className="px-6 py-4">API key is missing, invalid, or expired</td></tr>
                        <tr><td className="px-6 py-4 font-mono">INVALID_FILE_FORMAT</td><td className="px-6 py-4">400</td><td className="px-6 py-4">Unsupported file format uploaded</td></tr>
                        <tr><td className="px-6 py-4 font-mono">FILE_SIZE_EXCEEDED</td><td className="px-6 py-4">413</td><td className="px-6 py-4">File size exceeds plan limits</td></tr>
                        <tr><td className="px-6 py-4 font-mono">UPLOAD_NOT_FOUND</td><td className="px-6 py-4">404</td><td className="px-6 py-4">Upload ID does not exist</td></tr>
                        <tr><td className="px-6 py-4 font-mono">JOB_NOT_FOUND</td><td className="px-6 py-4">404</td><td className="px-6 py-4">Processing job ID does not exist</td></tr>
                        <tr><td className="px-6 py-4 font-mono">RATE_LIMIT_EXCEEDED</td><td className="px-6 py-4">429</td><td className="px-6 py-4">Too many requests within time window</td></tr>
                        <tr><td className="px-6 py-4 font-mono">INSUFFICIENT_PERMISSIONS</td><td className="px-6 py-4">403</td><td className="px-6 py-4">API key lacks required permissions</td></tr>
                        <tr><td className="px-6 py-4 font-mono">PLAN_LIMIT_EXCEEDED</td><td className="px-6 py-4">403</td><td className="px-6 py-4">Usage exceeds subscription plan limits</td></tr>
                        <tr><td className="px-6 py-4 font-mono">PROCESSING_FAILED</td><td className="px-6 py-4">422</td><td className="px-6 py-4">Data processing encountered an error</td></tr>
                        <tr><td className="px-6 py-4 font-mono">VALIDATION_ERROR</td><td className="px-6 py-4">400</td><td className="px-6 py-4">Request parameters failed validation</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Error Handling Best Practices</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Python Example</h3>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import requests
import time
import logging

class SchlepEngineError(Exception):
    def __init__(self, error_data, status_code):
        self.error_data = error_data
        self.status_code = status_code
        self.error_type = error_data.get('type')
        self.error_code = error_data.get('code')
        self.message = error_data.get('message')
        self.request_id = error_data.get('request_id')
        super().__init__(self.message)

def handle_api_request(url, headers, data=None, max_retries=3):
    for attempt in range(max_retries):
        try:
            if data:
                response = requests.post(url, headers=headers, json=data)
            else:
                response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                return response.json()
            
            # Parse error response
            error_data = response.json().get('error', {})
            
            # Handle specific error types
            if response.status_code == 401:
                logging.error(f"Authentication failed: {error_data.get('message')}")
                raise SchlepEngineError(error_data, response.status_code)
            
            elif response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 60))
                logging.warning(f"Rate limited. Retrying after {retry_after} seconds...")
                time.sleep(retry_after)
                continue
            
            elif response.status_code == 500:
                if attempt < max_retries - 1:
                    backoff_time = (2 ** attempt) * 1
                    logging.warning(f"Server error. Retrying in {backoff_time} seconds...")
                    time.sleep(backoff_time)
                    continue
                else:
                    logging.error(f"Server error after {max_retries} attempts: {error_data.get('message')}")
                    raise SchlepEngineError(error_data, response.status_code)
            
            else:
                logging.error(f"API error {response.status_code}: {error_data.get('message')}")
                raise SchlepEngineError(error_data, response.status_code)
        
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                logging.warning(f"Network error. Retrying... ({e})")
                time.sleep(2 ** attempt)
                continue
            else:
                logging.error(f"Network error after {max_retries} attempts: {e}")
                raise

# Usage example
try:
    result = handle_api_request(
        url="https://api.schlep-engine.com/v1/upload",
        headers={"Authorization": "Bearer your-api-key"},
        data={"file_path": "data.csv"}
    )
    print("Success:", result)
    
except SchlepEngineError as e:
    if e.error_code == "INVALID_API_KEY":
        print("Please check your API key configuration")
    elif e.error_code == "FILE_SIZE_EXCEEDED":
        print(f"File too large. Max size: {e.error_data.get('details', {}).get('max_size')}")
    else:
        print(f"API Error [{e.error_code}]: {e.message}")
        print(f"Request ID for support: {e.request_id}")
        
except Exception as e:
    print(f"Unexpected error: {e}")`}</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">JavaScript Example</h3>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`class SchlepEngineError extends Error {
  constructor(errorData, statusCode) {
    super(errorData.message);
    this.name = 'SchlepEngineError';
    this.errorData = errorData;
    this.statusCode = statusCode;
    this.errorType = errorData.type;
    this.errorCode = errorData.code;
    this.requestId = errorData.request_id;
  }
}

async function handleApiRequest(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      const errorData = await response.json().then(data => data.error).catch(() => ({}));
      
      // Handle specific status codes
      switch (response.status) {
        case 401:
          console.error('Authentication failed:', errorData.message);
          throw new SchlepEngineError(errorData, response.status);
        
        case 429:
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          console.warn(\`Rate limited. Retrying after \${retryAfter} seconds...\`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        
        case 500:
          if (attempt < maxRetries - 1) {
            const backoffTime = Math.pow(2, attempt) * 1000;
            console.warn(\`Server error. Retrying in \${backoffTime/1000} seconds...\`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          } else {
            console.error(\`Server error after \${maxRetries} attempts:, errorData.message\`);
            throw new SchlepEngineError(errorData, response.status);
          }
        
        default:
          console.error(\`API error \${response.status}: \${errorData.message}\`);
          throw new SchlepEngineError(errorData, response.status);
      }
      
    } catch (error) {
      if (error instanceof SchlepEngineError) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        console.warn('Network error. Retrying...', error.message);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      } else {
        console.error(\`Network error after \${maxRetries} attempts:\`, error);
        throw error;
      }
    }
  }
}

// Usage example
try {
  const result = await handleApiRequest('https://api.schlep-engine.com/v1/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({ file_path: 'data.csv' })
  });
  
  console.log('Success:', result);
  
} catch (error) {
  if (error instanceof SchlepEngineError) {
    switch (error.errorCode) {
      case 'INVALID_API_KEY':
        console.log('Please check your API key configuration');
        break;
      case 'FILE_SIZE_EXCEEDED':
        const maxSize = error.errorData.details?.max_size;
        console.log(\`File too large. Max size: \${maxSize}\`);
        break;
      default:
        console.log(\`API Error [\${error.errorCode}]: \${error.message}\`);
        console.log(\`Request ID for support: \${error.requestId}\`);
    }
  } else {
    console.log('Unexpected error:', error.message);
  }
}`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Getting Help</h2>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    When Contacting Support
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Always include the following information when reporting API errors:
                  </p>
                  <ul className="text-blue-700 space-y-1">
                    <li>Request ID from the error response</li>
                    <li>Timestamp of the error</li>
                    <li>HTTP status code and error code</li>
                    <li>Complete error response (sanitized of sensitive data)</li>
                    <li>Steps to reproduce the issue</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg mt-8">
                  <h3 className="text-lg font-semibold mb-4">Related Documentation</h3>
                  <ul className="space-y-2">
                    <li><Link href="/docs/api-reference/rate-limits" className="text-blue-600 hover:underline">→ Rate Limits</Link></li>
                    <li><Link href="/docs/api-reference/authentication" className="text-blue-600 hover:underline">→ Authentication</Link></li>
                    <li><Link href="/docs/api-reference" className="text-blue-600 hover:underline">→ API Reference</Link></li>
                  </ul>
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