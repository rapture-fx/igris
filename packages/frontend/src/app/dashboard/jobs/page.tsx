'use client'

import { useState, useEffect } from 'react'
import { Activity, Play, Pause, CheckCircle2, RefreshCw, Clock, AlertTriangle } from 'lucide-react'

export default function JobsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Processing Jobs</h1>
          <p className="text-gray-600 mt-2">Monitor data preparation tasks and processing workflows</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <Activity className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Active Jobs</h3>
            <p className="text-3xl font-bold text-blue-600">2</p>
            <p className="text-sm text-gray-500 mt-2">currently processing</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-600">12</p>
            <p className="text-sm text-gray-500 mt-2">today</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Clock className="w-8 h-8 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Queued</h3>
            <p className="text-3xl font-bold text-yellow-600">3</p>
            <p className="text-sm text-gray-500 mt-2">waiting to start</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed</h3>
            <p className="text-3xl font-bold text-red-600">0</p>
            <p className="text-sm text-gray-500 mt-2">in last 24h</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Job Queue</h2>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Activity className="w-5 h-5 text-blue-500 mr-3" />
                    <div>
                      <h3 className="font-semibold">Data Type Detection</h3>
                      <p className="text-sm text-gray-600">sales_data_q4.csv</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Processing</span>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Pause className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>73%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '73%' }}></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Started:</span>
                    <span className="ml-1 font-medium">15 min ago</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ETA:</span>
                    <span className="ml-1 font-medium">8 min</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Records:</span>
                    <span className="ml-1 font-medium">8,900</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Activity className="w-5 h-5 text-purple-500 mr-3" />
                    <div>
                      <h3 className="font-semibold">Anomaly Detection</h3>
                      <p className="text-sm text-gray-600">customer_database.json</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">Processing</span>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Pause className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>45%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Started:</span>
                    <span className="ml-1 font-medium">8 min ago</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ETA:</span>
                    <span className="ml-1 font-medium">12 min</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Records:</span>
                    <span className="ml-1 font-medium">15,420</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-yellow-500 mr-3" />
                    <div>
                      <h3 className="font-semibold">Content Labeling</h3>
                      <p className="text-sm text-gray-600">product_reviews.csv</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">Queued</span>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Position:</span>
                    <span className="ml-1 font-medium">1 in queue</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. start:</span>
                    <span className="ml-1 font-medium">20 min</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Records:</span>
                    <span className="ml-1 font-medium">3,245</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-green-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-3" />
                    <div>
                      <h3 className="font-semibold">Data Transformation</h3>
                      <p className="text-sm text-gray-600">user_profiles.xlsx</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Completed</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <span className="ml-1 font-medium">12 min 34s</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Completed:</span>
                    <span className="ml-1 font-medium">23 min ago</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Records:</span>
                    <span className="ml-1 font-medium">7,892</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Job Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Processing Time by Job Type</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Data Type Detection</span>
                  <span className="text-sm font-medium">2.3s per 1K records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Anomaly Detection</span>
                  <span className="text-sm font-medium">4.1s per 1K records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Content Labeling</span>
                  <span className="text-sm font-medium">6.7s per 1K records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Data Transformation</span>
                  <span className="text-sm font-medium">1.8s per 1K records</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-3">System Resources</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU Usage</span>
                    <span>64%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '64%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Memory Usage</span>
                    <span>52%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '52%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
