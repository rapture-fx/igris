export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        Pricing Plans
      </h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-xl text-gray-600 mb-8">
          Choose the right plan for your data processing needs. All plans include our core AI-powered data preparation features.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12 not-prose">
          {/* Free Plan */}
          <div className="border border-gray-200 rounded-lg p-6 relative">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Free</h3>
              <div className="text-3xl font-bold text-gray-900 mb-1">$0</div>
              <div className="text-gray-600 text-sm mb-6">per month</div>
            </div>
            
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Up to 1,000 rows/month</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Basic data profiling</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Standard transformations</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>API access</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Community support</span>
              </li>
            </ul>
            
            <button className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-md font-medium hover:bg-gray-200 transition-colors">
              Get Started Free
            </button>
          </div>

          {/* Pro Plan */}
          <div className="border-2 border-blue-500 rounded-lg p-6 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </span>
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Pro</h3>
              <div className="text-3xl font-bold text-gray-900 mb-1">$49</div>
              <div className="text-gray-600 text-sm mb-6">per month</div>
            </div>
            
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Up to 100,000 rows/month</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Advanced AI profiling</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Auto-labeling & classification</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Custom transformations</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Webhook notifications</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Priority support</span>
              </li>
            </ul>
            
            <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-600 transition-colors">
              Start Free Trial
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="border border-gray-200 rounded-lg p-6 relative">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise</h3>
              <div className="text-3xl font-bold text-gray-900 mb-1">Custom</div>
              <div className="text-gray-600 text-sm mb-6">pricing</div>
            </div>
            
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Unlimited rows</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Advanced security & compliance</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>On-premise deployment</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Custom integrations</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>Dedicated support</span>
              </li>
              <li className="flex items-start">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-0.5">
                  ✓
                </div>
                <span>SLA guarantee</span>
              </li>
            </ul>
            
            <button className="w-full bg-gray-900 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-800 transition-colors">
              Contact Sales
            </button>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Usage-Based Pricing</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How We Count Rows</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Each processed row counts toward your monthly limit</li>
            <li>• Failed uploads don't count against your quota</li>
            <li>• Data profiling and previews are included at no extra cost</li>
            <li>• Overage charges: $0.001 per additional row processed</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Rate Limits</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">API Calls/min</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Concurrent Jobs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">File Size Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Free</td>
                <td className="px-4 py-3 text-sm text-gray-600">60</td>
                <td className="px-4 py-3 text-sm text-gray-600">1</td>
                <td className="px-4 py-3 text-sm text-gray-600">10 MB</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Pro</td>
                <td className="px-4 py-3 text-sm text-gray-600">600</td>
                <td className="px-4 py-3 text-sm text-gray-600">5</td>
                <td className="px-4 py-3 text-sm text-gray-600">100 MB</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Enterprise</td>
                <td className="px-4 py-3 text-sm text-gray-600">Custom</td>
                <td className="px-4 py-3 text-sm text-gray-600">Custom</td>
                <td className="px-4 py-3 text-sm text-gray-600">Custom</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Frequently Asked Questions</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I change plans anytime?</h3>
            <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated.</p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">What happens if I exceed my row limit?</h3>
            <p className="text-gray-600">You'll be charged $0.001 per additional row. We'll notify you as you approach your limit.</p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Do you offer annual discounts?</h3>
            <p className="text-gray-600">Yes! Annual plans receive a 20% discount. Contact sales for Enterprise annual pricing.</p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
            <p className="text-gray-600">All paid plans include a 14-day free trial. No credit card required to start.</p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-12">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Need Help Choosing?
          </h3>
          <p className="text-blue-700 mb-4">
            Not sure which plan is right for you? Our team is here to help you find the perfect fit for your use case.
          </p>
          <a href="mailto:sales@schlepengine.com" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors">
            Contact Sales Team
          </a>
        </div>
      </div>
    </div>
  )
}