import { CodeBlock } from '@/components/ui/CodeBlock'
import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function RateLimitsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Rate Limits</h1>
        <p className="text-xl text-gray-600">
          Understand API rate limits and how to handle them in your applications.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limit Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-3">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <h3 className="text-lg font-semibold text-gray-900">Free Tier</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 100 requests/hour</li>
                <li>• 1,000 requests/month</li>
                <li>• 10 MB max file size</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <h3 className="text-lg font-semibold text-gray-900">Pro Tier</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 1,000 requests/hour</li>
                <li>• 50,000 requests/month</li>
                <li>• 100 MB max file size</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Custom limits</li>
                <li>• Unlimited requests</li>
                <li>• 1 GB max file size</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limit Headers</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 mb-4">
              Every API response includes headers with rate limit information:
            </p>
            
            <CodeBlock
              code={`HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 3600
Content-Type: application/json

{
  "upload_id": "upload_123",
  "status": "completed"
}`}
              language="http"
              title="Response Headers"
            />
            
            <div className="mt-6 space-y-4">
              <div className="flex items-start">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded mr-3 mt-0.5">X-RateLimit-Limit</code>
                <div>
                  <p className="text-sm font-medium text-gray-900">Rate limit ceiling for this endpoint</p>
                  <p className="text-xs text-gray-500">Maximum requests allowed per window</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded mr-3 mt-0.5">X-RateLimit-Remaining</code>
                <div>
                  <p className="text-sm font-medium text-gray-900">Requests remaining in current window</p>
                  <p className="text-xs text-gray-500">Number of requests left before hitting the limit</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded mr-3 mt-0.5">X-RateLimit-Reset</code>
                <div>
                  <p className="text-sm font-medium text-gray-900">Time when the rate limit resets</p>
                  <p className="text-xs text-gray-500">Unix timestamp of when the window resets</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded mr-3 mt-0.5">X-RateLimit-Window</code>
                <div>
                  <p className="text-sm font-medium text-gray-900">Rate limit window in seconds</p>
                  <p className="text-xs text-gray-500">Duration of the rate limit window</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Handling Rate Limits</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
                <span className="text-sm font-medium text-yellow-900">429 Too Many Requests</span>
              </div>
              <p className="text-sm text-yellow-800">
                When you exceed rate limits, you'll receive a 429 status code with retry information.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limit Response</h3>
            <CodeBlock
              code={`HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
Retry-After: 60
Content-Type: application/json

{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "code": "rate_limit_exceeded"
  }
}`}
              language="http"
              title="429 Response"
            />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Best Practices</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Implement Exponential Backoff</h3>
                <p className="text-gray-600 mb-4">
                  When you hit rate limits, implement exponential backoff to avoid overwhelming the API:
                </p>
                <CodeBlock
                  code={`import time
import random
import requests

def make_request_with_backoff(url, headers, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return response
        elif response.status_code == 429:
            # Get retry delay from header or calculate backoff
            retry_after = response.headers.get('Retry-After', 60)
            backoff_delay = (2 ** attempt) + random.uniform(0, 1)
            delay = max(int(retry_after), backoff_delay)
            
            print(f"Rate limited. Retrying in {delay} seconds...")
            time.sleep(delay)
        else:
            response.raise_for_status()
    
    raise Exception("Max retries exceeded")

# Usage
response = make_request_with_backoff(
    "https://api.schlepengine.com/v1/profile/upload_123",
    {"Authorization": "Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"}
)`}
                  language="python"
                  title="Exponential Backoff Example"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Monitor Rate Limit Headers</h3>
                <p className="text-gray-600 mb-4">
                  Check rate limit headers to proactively slow down requests:
                </p>
                <CodeBlock
                  code={`import requests
import time

def make_smart_request(url, headers):
    response = requests.get(url, headers=headers)
    
    # Check rate limit headers
    remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
    reset_time = int(response.headers.get('X-RateLimit-Reset', 0))
    window = int(response.headers.get('X-RateLimit-Window', 3600))
    
    # If we're running low on requests, slow down
    if remaining < 10:
        current_time = time.time()
        time_until_reset = reset_time - current_time
        
        if time_until_reset > 0:
            # Sleep to spread remaining requests over time
            sleep_time = time_until_reset / remaining if remaining > 0 else 60
            time.sleep(min(sleep_time, 60))  # Cap at 60 seconds
    
    return response`}
                  language="python"
                  title="Smart Rate Limiting"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Batch Operations</h3>
                <p className="text-gray-600 mb-4">
                  Use batch endpoints when available to reduce API calls:
                </p>
                <CodeBlock
                  code={`# Instead of multiple individual requests
for upload_id in upload_ids:
    response = requests.get(f"/v1/profile/{upload_id}")

# Use batch endpoint
response = requests.post("/v1/profiles/batch", json={
    "upload_ids": upload_ids
})
profiles = response.json()["profiles"]`}
                  language="python"
                  title="Batch Operations"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">JavaScript Rate Limiting</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 mb-4">
              Example implementation for JavaScript/Node.js applications:
            </p>
            <CodeBlock
              code={`class RateLimitedClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.requestQueue = [];
        this.processing = false;
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, options, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) return;
        
        this.processing = true;
        
        while (this.requestQueue.length > 0) {
            const { url, options, resolve, reject } = this.requestQueue.shift();
            
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Authorization': \`Bearer \${this.apiKey}\`,
                        ...options.headers
                    }
                });

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || 60;
                    console.log(\`Rate limited. Waiting \${retryAfter} seconds...\`);
                    await this.sleep(retryAfter * 1000);
                    
                    // Put request back in queue
                    this.requestQueue.unshift({ url, options, resolve, reject });
                    continue;
                }

                resolve(response);
            } catch (error) {
                reject(error);
            }
        }
        
        this.processing = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage
const client = new RateLimitedClient('sk_test_4eC39HqLyjWDarjtT1zdp7dc');
const response = await client.makeRequest('https://api.schlepengine.com/v1/profile/upload_123');`}
              language="javascript"
              title="JavaScript Rate Limiting Client"
            />
          </div>
        </section>
      </div>
    </div>
  )
}