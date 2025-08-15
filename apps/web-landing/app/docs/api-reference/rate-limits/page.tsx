import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import Link from 'next/link'

export default function RateLimitsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                Rate Limits
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  Understanding API quotas, rate limiting, and how to handle throttling in your applications.
                </p>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Rate Limit Overview</h2>
                
                <p>The schlep-engine API uses rate limiting to ensure fair usage and maintain service quality for all users. Rate limits are applied per API key and are based on your subscription plan.</p>

                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Current Rate Limits</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests/Minute</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests/Hour</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Size Limit</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Free</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10 MB</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Pro</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1,000</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100 MB</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Enterprise</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1,000</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10,000</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1 GB</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Rate Limit Headers</h2>
                
                <p>Every API response includes headers that provide information about your current rate limit status:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60`}</code></pre>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <h4 className="font-semibold text-gray-900">X-RateLimit-Limit</h4>
                    <p className="text-gray-600">The maximum number of requests allowed in the current window</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">X-RateLimit-Remaining</h4>
                    <p className="text-gray-600">The number of requests remaining in the current window</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">X-RateLimit-Reset</h4>
                    <p className="text-gray-600">Unix timestamp when the rate limit window resets</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">X-RateLimit-Window</h4>
                    <p className="text-gray-600">The rate limit window duration in seconds</p>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Handling Rate Limits</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">429 Too Many Requests</h3>
                <p>When you exceed your rate limit, the API returns a 429 status code:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995260
Retry-After: 60

{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 60 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "retry_after": 60
  }
}`}</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">Best Practices</h3>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
                  <h4 className="text-lg font-semibold text-blue-800 mb-4">Recommended Strategies</h4>
                  <ul className="text-blue-700 space-y-2">
                    <li><strong>Monitor Headers:</strong> Always check rate limit headers in responses</li>
                    <li><strong>Exponential Backoff:</strong> Implement exponential backoff for retries</li>
                    <li><strong>Request Queuing:</strong> Queue requests to stay within limits</li>
                    <li><strong>Batch Operations:</strong> Use batch endpoints when available</li>
                    <li><strong>Caching:</strong> Cache responses to reduce API calls</li>
                  </ul>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">Implementation Examples</h3>
                
                <h4 className="text-xl font-semibold mt-6 mb-3">Python</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import requests
import time
from typing import Optional

class RateLimitHandler:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def make_request(self, method: str, url: str, **kwargs) -> requests.Response:
        max_retries = 3
        backoff_factor = 2
        
        for attempt in range(max_retries):
            response = self.session.request(method, url, **kwargs)
            
            if response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 60))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                continue
            
            return response
        
        raise Exception("Max retries exceeded")
    
    def check_rate_limit(self, response: requests.Response) -> None:
        remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
        if remaining < 10:
            reset_time = int(response.headers.get('X-RateLimit-Reset', 0))
            wait_time = reset_time - int(time.time())
            if wait_time > 0:
                print(f"Approaching rate limit. Waiting {wait_time} seconds...")
                time.sleep(wait_time)`}</code></pre>
                </div>

                <h4 className="text-xl font-semibold mt-6 mb-3">JavaScript</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`class SchlepEngineClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.schlep-engine.com';
  }
  
  async makeRequest(method, endpoint, data = null, retries = 3) {
    const url = \`\${this.baseURL}\${endpoint}\`;
    const options = {
      method,
      headers: {
        'Authorization': \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          console.log(\`Rate limited. Waiting \${retryAfter} seconds...\`);
          await this.sleep(retryAfter * 1000);
          continue;
        }
        
        // Check remaining rate limit
        const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
        if (remaining < 10) {
          const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
          const waitTime = resetTime - Math.floor(Date.now() / 1000);
          if (waitTime > 0) {
            console.log(\`Approaching rate limit. Waiting \${waitTime} seconds...\`);
            await this.sleep(waitTime * 1000);
          }
        }
        
        return response;
      } catch (error) {
        if (attempt === retries - 1) throw error;
        await this.sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Increasing Rate Limits</h2>
                
                <p>If you need higher rate limits for your application:</p>
                
                <div className="space-y-4 mb-8">
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Upgrade Your Plan</h4>
                    <p className="text-gray-600 mb-4">
                      Pro and Enterprise plans come with significantly higher rate limits.
                    </p>
                    <Link 
                      href="/pricing" 
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                    >
                      View Pricing Plans →
                    </Link>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Contact Support</h4>
                    <p className="text-gray-600 mb-4">
                      For custom rate limits or enterprise requirements, contact our support team.
                    </p>
                    <Link 
                      href="/contact" 
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                    >
                      Contact Support →
                    </Link>
                  </div>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mt-8">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    Important Notes
                  </h3>
                  <ul className="text-yellow-700 space-y-1">
                    <li>Rate limits are enforced per API key, not per user account</li>
                    <li>Limits reset at the beginning of each time window</li>
                    <li>File upload endpoints have separate limits based on file size</li>
                    <li>WebSocket connections have different rate limiting rules</li>
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