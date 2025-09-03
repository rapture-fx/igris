import { ApiLayout } from '@/components/ui/ApiLayout'
import { InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

export default function ErrorHandlingPage() {
  return (
    <ApiLayout 
      title="Error Handling"
      description="Comprehensive guide to understanding and handling errors when using the Schlep Engine API, including error codes, response formats, and retry strategies."
    >
      {/* Error Response Format */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Response Format</h2>
        <p className="text-gray-600 mb-6">
          All API errors follow a consistent JSON response format to help you handle them programmatically:
        </p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <pre className="text-sm"><code>{`{
  "error_id": "err_1642694400_1234",
  "error_code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "category": "validation",
  "severity": "medium",
  "user_message": "Please check your request data and try again",
  "suggested_action": "Verify required fields are present and properly formatted",
  "documentation_url": "https://docs.schlep-engine.com/api-reference/errors",
  "details": ["Field 'file_id' is required"],
  "timestamp": "2024-01-20T10:30:00Z"
}`}</code></pre>
        </div>
        
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Response Fields</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>error_id:</strong> Unique identifier for troubleshooting</li>
              <li><strong>error_code:</strong> Machine-readable error code</li>
              <li><strong>message:</strong> Technical error description</li>
              <li><strong>user_message:</strong> User-friendly error description</li>
              <li><strong>suggested_action:</strong> Recommended next steps</li>
              <li><strong>details:</strong> Specific validation errors or additional context</li>
            </ul>
          </div>
        </div>
      </section>

      {/* HTTP Status Codes */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">HTTP Status Codes</h2>
        
        <div className="grid gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">4xx Client Errors</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-mono font-bold text-red-700">400</span> - Bad Request: Invalid request format or missing required fields</div>
              <div><span className="font-mono font-bold text-red-700">401</span> - Unauthorized: Invalid or missing API key</div>
              <div><span className="font-mono font-bold text-red-700">403</span> - Forbidden: Insufficient permissions for the requested operation</div>
              <div><span className="font-mono font-bold text-red-700">404</span> - Not Found: Requested resource doesn't exist</div>
              <div><span className="font-mono font-bold text-red-700">429</span> - Too Many Requests: Rate limit exceeded</div>
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="font-semibold text-orange-900 mb-2">5xx Server Errors</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-mono font-bold text-orange-700">500</span> - Internal Server Error: Unexpected server error</div>
              <div><span className="font-mono font-bold text-orange-700">502</span> - Bad Gateway: Upstream service error</div>
              <div><span className="font-mono font-bold text-orange-700">503</span> - Service Unavailable: Service temporarily unavailable</div>
              <div><span className="font-mono font-bold text-orange-700">504</span> - Gateway Timeout: Request timeout</div>
            </div>
          </div>
        </div>
      </section>

      {/* Common Error Codes */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Common Error Codes</h2>
        
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircleIcon className="h-5 w-5 text-red-500" />
              <code className="font-mono text-sm font-semibold">AUTHENTICATION_FAILED</code>
            </div>
            <p className="text-sm text-gray-600 mb-2">Your API key is invalid, expired, or missing.</p>
            <p className="text-xs text-gray-500"><strong>Action:</strong> Verify your API key and ensure it's properly formatted.</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircleIcon className="h-5 w-5 text-orange-500" />
              <code className="font-mono text-sm font-semibold">VALIDATION_ERROR</code>
            </div>
            <p className="text-sm text-gray-600 mb-2">Request data failed validation checks.</p>
            <p className="text-xs text-gray-500"><strong>Action:</strong> Review the 'details' field for specific validation errors.</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircleIcon className="h-5 w-5 text-yellow-500" />
              <code className="font-mono text-sm font-semibold">RATE_LIMIT_EXCEEDED</code>
            </div>
            <p className="text-sm text-gray-600 mb-2">You've exceeded the rate limit for your API key type.</p>
            <p className="text-xs text-gray-500"><strong>Action:</strong> Wait and retry after the time specified in the Retry-After header.</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircleIcon className="h-5 w-5 text-purple-500" />
              <code className="font-mono text-sm font-semibold">INSUFFICIENT_PERMISSIONS</code>
            </div>
            <p className="text-sm text-gray-600 mb-2">Your API key doesn't have permission for this operation.</p>
            <p className="text-xs text-gray-500"><strong>Action:</strong> Check your key permissions or upgrade your plan.</p>
          </div>
        </div>
      </section>

      {/* Retry Strategies */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Retry Strategies</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4">Recommended Retry Logic</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Exponential Backoff</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Start with 1 second delay</li>
                <li>• Double the delay after each retry</li>
                <li>• Maximum delay of 60 seconds</li>
                <li>• Maximum 3-5 retry attempts</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Error-Specific Handling</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>429:</strong> Respect Retry-After header</li>
                <li>• <strong>5xx:</strong> Retry with backoff</li>
                <li>• <strong>4xx:</strong> Don't retry (except 429)</li>
                <li>• <strong>Network errors:</strong> Retry with backoff</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Support Information */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Getting Help</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Need Support?</h3>
              <p className="text-gray-600 mb-4">
                If you encounter persistent errors or need help interpreting error responses, we're here to help.
              </p>
              
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Include in your support request:</strong></p>
                <ul className="ml-4 space-y-1">
                  <li>• The <code>error_id</code> from the error response</li>
                  <li>• Timestamp when the error occurred</li>
                  <li>• The API endpoint you were calling</li>
                  <li>• Your API key prefix (first 8 characters only)</li>
                </ul>
              </div>
              
              <div className="mt-4">
                <a href="mailto:support@schlep-engine.com" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}