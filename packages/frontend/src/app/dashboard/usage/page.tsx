'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, DollarSign, Clock, Zap, Database, Download, RefreshCw, Calendar, AlertTriangle } from 'lucide-react'

interface UsageStats {
  currentPeriod: {
    dataProcessed: number
    apiCalls: number
    transformations: number
    exports: number
    currentBill: number
    daysLeft: number
  }
  quotas: {
    dataProcessingGB: { used: number; limit: number }
    apiCalls: { used: number; limit: number }
    transformations: { used: number; limit: number }
    exports: { used: number; limit: number }
  }
  billing: {
    currentCycle: string
    nextBilling: string
    status: 'active' | 'past_due' | 'suspended'
    paymentMethod: string
  }
}

interface BillingHistory {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
  description: string
  downloadUrl?: string
}

interface DailyUsage {
  date: string
  dataGB: number
  apiCalls: number
  cost: number
}

export default function UsagePage() {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([])
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('7d')

  useEffect(() => {
    // Load mock usage data
    setUsageStats({
      currentPeriod: {
        dataProcessed: 127.3,
        apiCalls: 15420,
        transformations: 1847,
        exports: 342,
        currentBill: 89.47,
        daysLeft: 12
      },
      quotas: {
        dataProcessingGB: { used: 127.3, limit: 500 },
        apiCalls: { used: 15420, limit: 50000 },
        transformations: { used: 1847, limit: 5000 },
        exports: { used: 342, limit: 1000 }
      },
      billing: {
        currentCycle: 'June 2024',
        nextBilling: '2024-07-01',
        status: 'active',
        paymentMethod: '**** **** **** 4242'
      }
    })

    setBillingHistory([
      {
        id: 'inv_001',
        date: '2024-06-01',
        amount: 142.89,
        status: 'paid',
        description: 'May 2024 Usage',
        downloadUrl: '/invoices/inv_001.pdf'
      },
      {
        id: 'inv_002',
        date: '2024-05-01',
        amount: 98.32,
        status: 'paid',
        description: 'April 2024 Usage',
        downloadUrl: '/invoices/inv_002.pdf'
      },
      {
        id: 'inv_003',
        date: '2024-04-01',
        amount: 156.77,
        status: 'paid',
        description: 'March 2024 Usage',
        downloadUrl: '/invoices/inv_003.pdf'
      }
    ])

    // Generate mock daily usage for the last 30 days
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return {
        date: date.toISOString().split('T')[0],
        dataGB: Math.random() * 10 + 2,
        apiCalls: Math.floor(Math.random() * 1000 + 200),
        cost: Math.random() * 8 + 1
      }
    })
    setDailyUsage(days)

    setLoading(false)
  }, [])

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100'
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading || !usageStats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Usage & Billing</h1>
            <p className="text-gray-600 mt-2">Monitor your usage, costs, and manage billing settings</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Current Usage Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <Database className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Data Processed</h3>
            <p className="text-3xl font-bold text-blue-600">{usageStats.currentPeriod.dataProcessed} GB</p>
            <p className="text-sm text-gray-500 mt-2">this billing cycle</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Zap className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">API Calls</h3>
            <p className="text-3xl font-bold text-green-600">{usageStats.currentPeriod.apiCalls.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2">this billing cycle</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <DollarSign className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Current Bill</h3>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(usageStats.currentPeriod.currentBill)}</p>
            <p className="text-sm text-gray-500 mt-2">{usageStats.currentPeriod.daysLeft} days left</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <TrendingUp className="w-8 h-8 text-orange-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Avg Daily Cost</h3>
            <p className="text-3xl font-bold text-orange-600">
              {formatCurrency(usageStats.currentPeriod.currentBill / (30 - usageStats.currentPeriod.daysLeft))}
            </p>
            <p className="text-sm text-gray-500 mt-2">based on current usage</p>
          </div>
        </div>

        {/* Billing Status Alert */}
        {usageStats.billing.status !== 'active' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <h3 className="font-semibold text-red-800">Billing Issue</h3>
                <p className="text-red-700 text-sm">
                  Your account has a billing issue. Please update your payment method to continue service.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Quotas */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Usage Quotas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(usageStats.quotas).map(([key, quota]) => {
              const percentage = getUsagePercentage(quota.used, quota.limit)
              const colorClass = getUsageColor(percentage)
              
              return (
                <div key={key} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        percentage >= 90 ? 'bg-red-500' :
                        percentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      {typeof quota.used === 'number' && quota.used < 1000 
                        ? quota.used.toLocaleString() 
                        : `${(quota.used / 1000).toFixed(1)}K`} used
                    </span>
                    <span>
                      {typeof quota.limit === 'number' && quota.limit < 1000 
                        ? quota.limit.toLocaleString() 
                        : `${(quota.limit / 1000).toFixed(1)}K`} limit
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Usage Chart */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Daily Usage Trend</h2>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                Last 30 days
              </div>
            </div>
            <div className="space-y-4">
              {dailyUsage.slice(-7).map((day, index) => (
                <div key={day.date} className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">{formatDate(day.date)}</div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="text-blue-600">{day.dataGB.toFixed(1)} GB</span>
                      <span className="text-gray-400 mx-2">•</span>
                      <span className="text-green-600">{day.apiCalls} calls</span>
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrency(day.cost)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Information */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-6">Billing Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Cycle</span>
                <span className="font-medium">{usageStats.billing.currentCycle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Next Billing Date</span>
                <span className="font-medium">{formatDate(usageStats.billing.nextBilling)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium">{usageStats.billing.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  usageStats.billing.status === 'active' ? 'bg-green-100 text-green-800' :
                  usageStats.billing.status === 'past_due' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {usageStats.billing.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
            <button className="w-full mt-6 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
              Update Payment Method
            </button>
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white rounded-lg border mt-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Billing History</h2>
            <p className="text-gray-600 text-sm mt-1">View and download your past invoices</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {billingHistory.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-4">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium">{invoice.description}</div>
                      <div className="text-sm text-gray-500">{formatDate(invoice.date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getBillingStatusColor(invoice.status)}`}>
                      {invoice.status.toUpperCase()}
                    </span>
                    <div className="font-semibold">{formatCurrency(invoice.amount)}</div>
                    {invoice.downloadUrl && (
                      <button className="text-blue-600 hover:text-blue-700">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 