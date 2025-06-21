export default function UsagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage & Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor your API usage and manage billing
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">This Month</h3>
          <p className="text-3xl font-bold text-blue-600">$0.00</p>
          <p className="text-sm text-gray-500">0 GB processed</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">API Calls</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
          <p className="text-sm text-gray-500">This month</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Free Tier</h3>
          <p className="text-3xl font-bold text-purple-600">100MB</p>
          <p className="text-sm text-gray-500">Remaining</p>
        </div>
      </div>
    </div>
  )
} 