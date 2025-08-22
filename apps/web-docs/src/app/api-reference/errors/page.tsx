import { ApiLayout } from '@/components/ui/ApiLayout'
import { InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

export default function ErrorHandlingPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Example: Trigger a validation error
curl -X POST "https://api.schlep-engine.com/api/v1/data-processing" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{}'

# Response (400 Bad Request):
{
  "error_id": "err_1642694400_1234",
  "error_code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "category": "validation",
  "severity": "medium",
  "user_message": "Please check your request data and try again",
  "suggested_action": "Verify required fields are present and properly formatted",
  "documentation_url": "https://docs.schlep-engine.com/api-reference/data-processing",
  "details": ["Field 'file_id' is required", "Field 'operation' must be one of: clean, analyze, transform"],
  "timestamp": "2024-01-20T10:30:00Z"
}`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests
import time
from requests.exceptions import HTTPError, ConnectionError, Timeout

class ApiErrorHandler:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.schlep-engine.com"
    
    def handle_error(self, response):
        """Comprehensive error handling for API responses"""
        try:
            error_data = response.json()
            error_id = error_data.get('error_id')
            error_code = error_data.get('error_code')
            message = error_data.get('user_message', error_data.get('message'))
            
            print(f"❌ API Error [{error_code}]: {message}")
            print(f"🔍 Error ID: {error_id}")
            
            # Handle specific error types
            if error_code == "RATE_LIMIT_EXCEEDED":
                retry_after = error_data.get('retry_after', 60)
                print(f"⏱️  Rate limited. Waiting {retry_after} seconds...")
                return {'action': 'retry', 'wait': retry_after}
                
            elif error_code == "AUTHENTICATION_FAILED":
                print("🔑 Authentication failed. Check your API key.")
                return {'action': 'abort'}
                
            elif error_code == "VALIDATION_ERROR":
                print("📝 Request validation failed:")
                for detail in error_data.get('details', []):
                    print(f"   • {detail}")
                return {'action': 'fix_request'}
                
            elif error_code == "INSUFFICIENT_PERMISSIONS":
                print("🚫 Insufficient permissions for this operation.")
                return {'action': 'upgrade_plan'}
                
            else:
                print(f"🔧 Suggested action: {error_data.get('suggested_action', 'Contact support')}")
                return {'action': 'manual_review'}
                
        except ValueError:
            print(f"💥 HTTP {response.status_code}: Unable to parse error response")
            print(f"Raw response: {response.text[:200]}...")
            return {'action': 'manual_review'}
    
    def safe_request(self, method, endpoint, **kwargs):
        """Make API request with comprehensive error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.get('headers', {})
        headers['Authorization'] = f"Bearer {self.api_key}"
        kwargs['headers'] = headers
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.request(method, url, **kwargs)
                
                if response.status_code < 400:
                    return response.json()
                
                # Handle error
                error_info = self.handle_error(response)
                
                if error_info['action'] == 'retry' and attempt < max_retries - 1:
                    time.sleep(error_info.get('wait', 60))
                    continue
                else:
                    raise HTTPError(f"API request failed: {response.status_code}")
                    
            except (ConnectionError, Timeout) as e:
                print(f"🌐 Network error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                raise
        
        raise HTTPError("Max retries exceeded")

# Usage example
handler = ApiErrorHandler("sk_your_api_key")

try:
    result = handler.safe_request('POST', '/api/v1/data-processing', 
                                json={'file_id': 'file_123', 'operation': 'clean'})
    print("✅ Success:", result)
except Exception as e:
    print(f"💥 Final error: {e}")`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `class ApiErrorHandler {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.schlep-engine.com';
  }
  
  async handleError(response) {
    try {
      const errorData = await response.json();
      const { error_id, error_code, user_message, message, details, suggested_action } = errorData;
      
      console.error(\`❌ API Error [\${error_code}]: \${user_message || message}\`);
      console.error(\`🔍 Error ID: \${error_id}\`);
      
      // Handle specific error types
      switch (error_code) {
        case 'RATE_LIMIT_EXCEEDED':
          const retryAfter = errorData.retry_after || 60;
          console.log(\`⏱️  Rate limited. Waiting \${retryAfter} seconds...\`);
          return { action: 'retry', wait: retryAfter };
          
        case 'AUTHENTICATION_FAILED':
          console.error('🔑 Authentication failed. Check your API key.');
          return { action: 'abort' };
          
        case 'VALIDATION_ERROR':
          console.error('📝 Request validation failed:');
          details?.forEach(detail => console.error(\`   • \${detail}\`));
          return { action: 'fix_request' };
          
        case 'INSUFFICIENT_PERMISSIONS':
          console.error('🚫 Insufficient permissions for this operation.');
          return { action: 'upgrade_plan' };
          
        default:
          console.error(\`🔧 Suggested action: \${suggested_action || 'Contact support'}\`);
          return { action: 'manual_review' };
      }
    } catch (parseError) {
      console.error(\`💥 HTTP \${response.status}: Unable to parse error response\`);
      const text = await response.text().catch(() => 'Unable to read response');
      console.error(\`Raw response: \${text.substring(0, 200)}...\`);
      return { action: 'manual_review' };
    }
  }
  
  async safeRequest(method, endpoint, options = {}) {
    const url = \`\${this.baseUrl}\${endpoint}\`;
    const headers = {
      'Authorization': \`Bearer \${this.apiKey}\`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          ...options
        });
        
        if (response.ok) {
          return await response.json();
        }
        
        // Handle error
        const errorInfo = await this.handleError(response);
        
        if (errorInfo.action === 'retry' && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, errorInfo.wait * 1000));
          continue;
        } else {
          throw new Error(\`API request failed: \${response.status}\`);
        }
        
      } catch (networkError) {
        console.error(\`🌐 Network error (attempt \${attempt + 1}): \${networkError.message}\`);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        throw networkError;
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}

// Usage example
const handler = new ApiErrorHandler('sk_your_api_key');

async function processData() {
  try {
    const result = await handler.safeRequest('POST', '/api/v1/data-processing', {
      body: JSON.stringify({
        file_id: 'file_123',
        operation: 'clean'
      })
    });
    
    console.log('✅ Success:', result);
    return result;
  } catch (error) {
    console.error('💥 Final error:', error.message);
    throw error;
  }
}

processData();`
    }
  ]

  return (
    <ApiLayout 
      title="Error Handling"
      description="Comprehensive guide to understanding and handling errors when using the Schlep Engine API, including error codes, response formats, and retry strategies."
      codeExamples={codeExamples}
    >
      {/* Error Response Format */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Response Format</h2>
        <p className="text-gray-600 mb-6">
          All API errors follow a consistent JSON response format to help you handle them programmatically:
        </p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Standard Error Response</h3>
          <pre className="bg-white p-4 rounded text-sm overflow-x-auto border">
{`{
  "error_id": "err_1642694400_1234",
  "error_code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "category": "validation",
  "severity": "medium",
  "user_message": "Please check your request data and try again",
  "suggested_action": "Verify required fields are present and properly formatted",
  "documentation_url": "https://docs.schlep-engine.com/api-reference/errors",
  "details": ["Field 'name' is required", "Field 'email' must be valid"],
  "retry_after": null,
  "timestamp": "2024-01-20T10:30:00Z"
}`}
          </pre>
        </div>
      </section>

      {/* HTTP Status Codes */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">HTTP Status Codes</h2>
        <p className="text-gray-600 mb-6">
          Schlep Engine uses standard HTTP status codes to indicate the success or failure of requests:
        </p>
        
        <div className="space-y-6">
          {/* 2xx Success */}
          <div>
            <h3 className="text-lg font-semibold text-green-900 mb-3">2xx Success</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-3">
                <div>
                  <span className="font-semibold text-green-900">200 OK</span>
                  <p className="text-green-800 text-sm">Request successful, response body contains requested data</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-3">
                <div>
                  <span className="font-semibold text-green-900">201 Created</span>
                  <p className="text-green-800 text-sm">Resource created successfully</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-3">
                <div>
                  <span className="font-semibold text-green-900">204 No Content</span>
                  <p className="text-green-800 text-sm">Request successful, no response body</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4xx Client Errors */}
          <div>
            <h3 className="text-lg font-semibold text-orange-900 mb-3">4xx Client Errors</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3">
                <div>
                  <span className="font-semibold text-orange-900">400 Bad Request</span>
                  <p className="text-orange-800 text-sm">Invalid request format or missing required parameters</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3">
                <div>
                  <span className="font-semibold text-orange-900">401 Unauthorized</span>
                  <p className="text-orange-800 text-sm">Authentication required or API key invalid</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3">
                <div>
                  <span className="font-semibold text-orange-900">403 Forbidden</span>
                  <p className="text-orange-800 text-sm">Insufficient permissions for the requested resource</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3">
                <div>
                  <span className="font-semibold text-orange-900">404 Not Found</span>
                  <p className="text-orange-800 text-sm">Requested resource does not exist</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3">
                <div>
                  <span className="font-semibold text-orange-900">422 Unprocessable Entity</span>
                  <p className="text-orange-800 text-sm">Request format is correct but contains invalid data</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3">
                <div>
                  <span className="font-semibold text-orange-900">429 Too Many Requests</span>
                  <p className="text-orange-800 text-sm">Rate limit exceeded, see Retry-After header</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5xx Server Errors */}
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-3">5xx Server Errors</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-3">
                <div>
                  <span className="font-semibold text-red-900">500 Internal Server Error</span>
                  <p className="text-red-800 text-sm">Unexpected server error, please retry or contact support</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-3">
                <div>
                  <span className="font-semibold text-red-900">502 Bad Gateway</span>
                  <p className="text-red-800 text-sm">Temporary service unavailability</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-3">
                <div>
                  <span className="font-semibold text-red-900">503 Service Unavailable</span>
                  <p className="text-red-800 text-sm">Service temporarily unavailable due to maintenance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error Codes */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Codes</h2>
        <p className="text-gray-600 mb-6">
          Detailed error codes to help you identify and handle specific error conditions:
        </p>
        
        <div className="space-y-6">
          {/* Authentication Errors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Authentication Errors</h3>
            <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">AUTHENTICATION_FAILED</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Invalid or missing API key</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Check your API key and authorization header</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">API_KEY_EXPIRED</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">API key has expired</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Generate a new API key from your dashboard</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">API_KEY_REVOKED</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">API key has been revoked</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Contact support or create a new API key</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">INSUFFICIENT_PERMISSIONS</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">API key lacks required permissions</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Use a key with appropriate scopes or upgrade your plan</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Errors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Validation Errors</h3>
            <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">VALIDATION_ERROR</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Request data failed validation</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Check the details array for specific field errors</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">MISSING_REQUIRED_FIELD</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Required field is missing</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Include all required fields in your request</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">INVALID_FILE_FORMAT</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Uploaded file format not supported</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Use supported formats: CSV, JSON, Excel, Parquet</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">FILE_TOO_LARGE</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">File exceeds maximum size limit</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Reduce file size or contact support for larger limits</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rate Limiting Errors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Rate Limiting Errors</h3>
            <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">RATE_LIMIT_EXCEEDED</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Too many requests in time window</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Wait for retry_after seconds before trying again</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">QUOTA_EXCEEDED</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Monthly usage quota exceeded</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Upgrade your plan or wait for quota reset</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Error Handling Best Practices */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Handling Best Practices</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <InformationCircleIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-green-900">Best Practices</h3>
            </div>
            <ul className="text-green-800 text-sm space-y-2">
              <li>• Always check the HTTP status code first</li>
              <li>• Parse the error response JSON for detailed information</li>
              <li>• Log error_id values for support requests</li>
              <li>• Implement exponential backoff for retries</li>
              <li>• Handle rate limits gracefully with retry_after</li>
              <li>• Show user-friendly messages from user_message field</li>
              <li>• Follow suggested_action recommendations</li>
            </ul>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircleIcon className="h-6 w-6 text-red-600" />
              <h3 className="font-semibold text-red-900">Common Mistakes</h3>
            </div>
            <ul className="text-red-800 text-sm space-y-2">
              <li>• Ignoring error response details</li>
              <li>• Immediate retries without backoff</li>
              <li>• Not handling authentication errors properly</li>
              <li>• Displaying technical error messages to users</li>
              <li>• Not implementing timeout handling</li>
              <li>• Retrying non-retryable errors (4xx)</li>
              <li>• Not logging error context for debugging</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Support and Troubleshooting */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Need Help?</h2>
        <p className="text-blue-800 text-sm mb-4">
          When contacting support about API errors, please include:
        </p>
        <ul className="text-blue-800 text-sm space-y-1 mb-4">
          <li>• The error_id from the error response</li>
          <li>• Your API key (first 8 characters only)</li>
          <li>• The exact request you made</li>
          <li>• Timestamp when the error occurred</li>
          <li>• Steps to reproduce the issue</li>
        </ul>
        <p className="text-blue-800 text-sm">
          <strong>Contact:</strong> support@schlep-engine.com or use our in-dashboard support chat.
        </p>
      </section>
    </ApiLayout>
  )
}