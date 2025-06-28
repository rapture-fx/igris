'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, CheckCircle2, RefreshCw } from 'lucide-react'

export default function AnomaliesPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Anomaly Detection</h1>
          <p className="text-gray-600 mt-2">Automatically identify data quality issues and anomalies</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Issues Found</h3>
            <p className="text-3xl font-bold text-red-600">3</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <TrendingUp className="w-8 h-8 text-orange-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">High Priority</h3>
            <p className="text-3xl font-bold text-orange-600">1</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Data Health</h3>
            <p className="text-3xl font-bold text-green-600">87%</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-6">Detected Anomalies</h2>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">Purchase Amount Outliers</h3>
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">HIGH</span>
              </div>
              <p className="text-gray-600 text-sm mb-3">12 values significantly higher than normal distribution</p>
              <div className="bg-blue-50 p-3 rounded">
                <strong>Suggested Action:</strong> Review transactions over $10,000 for validation
              </div>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">Missing Phone Numbers</h3>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">MEDIUM</span>
              </div>
              <p className="text-gray-600 text-sm mb-3">156 missing values clustered in specific time periods</p>
              <div className="bg-blue-50 p-3 rounded">
                <strong>Suggested Action:</strong> Check data collection issues during these periods
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
