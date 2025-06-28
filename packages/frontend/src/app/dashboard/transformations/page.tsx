'use client'

import { useState, useEffect } from 'react'
import { Zap, Brain, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'

export default function TransformationsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">AI Transformations</h1>
          <p className="text-gray-600 mt-2">Smart transformation suggestions powered by pattern recognition</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <Brain className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Smart Suggestions</h3>
            <p className="text-3xl font-bold text-purple-600">12</p>
            <p className="text-sm text-gray-500 mt-2">AI-generated recommendations</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Zap className="w-8 h-8 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Auto-Applied</h3>
            <p className="text-3xl font-bold text-yellow-600">8</p>
            <p className="text-sm text-gray-500 mt-2">transformations completed</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Success Rate</h3>
            <p className="text-3xl font-bold text-green-600">94%</p>
            <p className="text-sm text-gray-500 mt-2">transformation accuracy</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-6">Recommended Transformations</h2>
          
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 text-purple-500 mr-3" />
                  <div>
                    <h3 className="font-semibold text-lg">Normalize Date Formats</h3>
                    <p className="text-gray-600">Column: created_date</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">94% Confidence</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2"><strong>Current Format:</strong> Mixed (2024-01-15, 01/15/2024, Jan 15 2024)</p>
                <p className="text-sm text-gray-600"><strong>Suggested Format:</strong> ISO 8601 (YYYY-MM-DD)</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Affects 1,240 records • Saves 2.3 hours</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Apply Transformation
                </button>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 text-purple-500 mr-3" />
                  <div>
                    <h3 className="font-semibold text-lg">Clean Email Addresses</h3>
                    <p className="text-gray-600">Column: email</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">97% Confidence</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2"><strong>Issues Found:</strong> Extra whitespace, mixed case, invalid formats</p>
                <p className="text-sm text-gray-600"><strong>Actions:</strong> Trim whitespace, lowercase, validate format</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Affects 23 records • Saves 0.5 hours</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Apply Transformation
                </button>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 text-purple-500 mr-3" />
                  <div>
                    <h3 className="font-semibold text-lg">Handle Missing Values</h3>
                    <p className="text-gray-600">Column: purchase_amount</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">87% Confidence</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2"><strong>Strategy:</strong> Fill with median value based on customer segment</p>
                <p className="text-sm text-gray-600"><strong>Alternative:</strong> Use predictive model based on order history</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Affects 156 records • Saves 3.2 hours</span>
                <div className="space-x-2">
                  <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                    Review
                  </button>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
