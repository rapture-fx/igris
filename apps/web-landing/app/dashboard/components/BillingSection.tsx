'use client'

import { useState, useEffect } from 'react'
import { 
  CreditCard, 
  DollarSign, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Settings,
  Plus,
  Eye,
  FileText,
  RefreshCw
} from 'lucide-react'

interface BillingData {
  currentPeriod: {
    start: string
    end: string
    totalCost: number
    projectedCost: number
    budgetLimit: number
    percentUsed: number
  }
  usage: {
    apiCalls: { count: number; cost: number; limit: number }
    dataProcessed: { amount: number; cost: number; unit: string }
    mlInferences: { count: number; cost: number }
    storage: { amount: number; cost: number; unit: string }
  }
  paymentMethod: {
    type: string
    last4: string
    expiryMonth: number
    expiryYear: number
  }
  invoices: Invoice[]
  alerts: BillingAlert[]
}

interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  period: string
  downloadUrl: string
}

interface BillingAlert {
  id: string
  type: 'budget' | 'usage' | 'payment'
  severity: 'info' | 'warning' | 'error'
  message: string
  date: string
}

export default function BillingSection() {
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('current')
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    // Mock billing data
    const mockBillingData: BillingData = {
      currentPeriod: {
        start: '2024-01-01',
        end: '2024-01-31',
        totalCost: 127.43,
        projectedCost: 145.20,
        budgetLimit: 500.00,
        percentUsed: 25.5
      },
      usage: {
        apiCalls: { count: 47520, cost: 47.52, limit: 100000 },
        dataProcessed: { amount: 15.7, cost: 31.40, unit: 'GB' },
        mlInferences: { count: 8340, cost: 33.36 },
        storage: { amount: 3.2, cost: 15.15, unit: 'GB' }
      },
      paymentMethod: {
        type: 'Visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2025
      },
      invoices: [
        {
          id: 'inv_001',
          date: '2024-01-01',
          amount: 127.43,
          status: 'paid',
          period: 'January 2024',
          downloadUrl: '/invoices/inv_001.pdf'
        },
        {
          id: 'inv_002',
          date: '2023-12-01',
          amount: 89.67,
          status: 'paid',
          period: 'December 2023',
          downloadUrl: '/invoices/inv_002.pdf'
        },
        {
          id: 'inv_003',
          date: '2023-11-01',
          amount: 156.23,
          status: 'paid',
          period: 'November 2023',
          downloadUrl: '/invoices/inv_003.pdf'
        }
      ],
      alerts: [
        {
          id: '1',
          type: 'usage',
          severity: 'warning',
          message: 'API usage at 80% of monthly limit',
          date: '2024-01-25'
        },
        {
          id: '2',
          type: 'budget',
          severity: 'info',
          message: 'On track to stay within budget this month',
          date: '2024-01-20'
        }
      ]
    }

    setBillingData(mockBillingData)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-400 bg-green-900/20 border-green-700'
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      case 'overdue':
        return 'text-red-400 bg-red-900/20 border-red-700'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-700'
    }
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      default:
        return <CheckCircle className="w-4 h-4 text-blue-400" />
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-700 bg-red-900/20'
      case 'warning':
        return 'border-yellow-700 bg-yellow-900/20'
      default:
        return 'border-blue-700 bg-blue-900/20'
    }
  }

  if (!billingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#468BE6] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading billing data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Usage</h1>
          <p className="text-gray-400 mt-1">Manage your subscription and monitor usage</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Billing
          </button>
        </div>
      </div>

      {/* Billing Alerts */}
      {billingData.alerts.length > 0 && (
        <div className="space-y-4">
          {billingData.alerts.map((alert) => (
            <div key={alert.id} className={`border rounded-xl p-4 ${getAlertColor(alert.severity)}`}>
              <div className="flex items-start space-x-3">
                {getAlertIcon(alert.severity)}
                <div className="flex-1">
                  <p className="text-white text-sm">{alert.message}</p>
                  <p className="text-gray-400 text-xs mt-1">{new Date(alert.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Overview */}
      <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Current Period Overview</h2>
          <span className="text-sm text-gray-400">
            {new Date(billingData.currentPeriod.start).toLocaleDateString()} - {new Date(billingData.currentPeriod.end).toLocaleDateString()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Current Cost</span>
            </div>
            <p className="text-2xl font-bold text-white">${billingData.currentPeriod.totalCost}</p>
          </div>

          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Projected</span>
            </div>
            <p className="text-2xl font-bold text-white">${billingData.currentPeriod.projectedCost}</p>
          </div>

          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Budget Limit</span>
            </div>
            <p className="text-2xl font-bold text-white">${billingData.currentPeriod.budgetLimit}</p>
          </div>

          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Budget Used</span>
            </div>
            <p className="text-2xl font-bold text-white">{billingData.currentPeriod.percentUsed}%</p>
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Budget Usage</span>
            <span className="text-white">${billingData.currentPeriod.totalCost} of ${billingData.currentPeriod.budgetLimit}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
              style={{ width: `${billingData.currentPeriod.percentUsed}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Breakdown */}
      <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Usage Breakdown</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* API Calls */}
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">API Calls</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Usage:</span>
                <span className="text-white">{billingData.usage.apiCalls.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost:</span>
                <span className="text-white">${billingData.usage.apiCalls.cost}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(billingData.usage.apiCalls.count / billingData.usage.apiCalls.limit) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-400">
                {Math.round((billingData.usage.apiCalls.count / billingData.usage.apiCalls.limit) * 100)}% of limit
              </div>
            </div>
          </div>

          {/* Data Processed */}
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Database className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">Data Processed</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Usage:</span>
                <span className="text-white">{billingData.usage.dataProcessed.amount} {billingData.usage.dataProcessed.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost:</span>
                <span className="text-white">${billingData.usage.dataProcessed.cost}</span>
              </div>
              <div className="text-xs text-gray-400">
                $2.00 per GB processed
              </div>
            </div>
          </div>

          {/* ML Inferences */}
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">ML Inferences</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Usage:</span>
                <span className="text-white">{billingData.usage.mlInferences.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost:</span>
                <span className="text-white">${billingData.usage.mlInferences.cost}</span>
              </div>
              <div className="text-xs text-gray-400">
                $0.004 per inference
              </div>
            </div>
          </div>

          {/* Storage */}
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Database className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">Storage</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Usage:</span>
                <span className="text-white">{billingData.usage.storage.amount} {billingData.usage.storage.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost:</span>
                <span className="text-white">${billingData.usage.storage.cost}</span>
              </div>
              <div className="text-xs text-gray-400">
                $4.73 per GB/month
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Method */}
        <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Payment Method</h2>
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="text-[#468BE6] hover:text-[#3a7bd5] transition-colors text-sm"
            >
              Update
            </button>
          </div>
          
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">{billingData.paymentMethod.type} •••• {billingData.paymentMethod.last4}</p>
                <p className="text-gray-400 text-sm">
                  Expires {billingData.paymentMethod.expiryMonth.toString().padStart(2, '0')}/{billingData.paymentMethod.expiryYear}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Invoices</h2>
            <button className="text-[#468BE6] hover:text-[#3a7bd5] transition-colors text-sm">
              View All
            </button>
          </div>
          
          <div className="space-y-3">
            {billingData.invoices.slice(0, 3).map((invoice) => (
              <div key={invoice.id} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{invoice.period}</p>
                    <p className="text-gray-400 text-sm">{new Date(invoice.date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-white font-medium">${invoice.amount}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                    <button className="p-1 hover:bg-gray-700 rounded transition-colors">
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}