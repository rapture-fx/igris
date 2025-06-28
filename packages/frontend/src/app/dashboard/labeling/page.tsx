'use client'

import { useState, useEffect } from 'react'
import { Tags, Brain, Target, RefreshCw, Sparkles } from 'lucide-react'

export default function LabelingPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Content Labeling</h1>
          <p className="text-gray-600 mt-2">Pattern-based automatic labeling and content classification</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <Tags className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Labels Applied</h3>
            <p className="text-3xl font-bold text-blue-600">2,847</p>
            <p className="text-sm text-gray-500 mt-2">automatic classifications</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Brain className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pattern Types</h3>
            <p className="text-3xl font-bold text-purple-600">8</p>
            <p className="text-sm text-gray-500 mt-2">detected patterns</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Target className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Accuracy</h3>
            <p className="text-3xl font-bold text-green-600">92%</p>
            <p className="text-sm text-gray-500 mt-2">labeling accuracy</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Active Labeling Rules</h2>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Customer Segment Classification</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Active</span>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Automatically label customers as "Premium", "Standard", or "Basic" based on purchase patterns
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Applied to:</span>
                  <span className="ml-1 font-medium">1,420 records</span>
                </div>
                <div>
                  <span className="text-gray-500">Accuracy:</span>
                  <span className="ml-1 font-medium">94%</span>
                </div>
                <div>
                  <span className="text-gray-500">Last run:</span>
                  <span className="ml-1 font-medium">2 hours ago</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Product Category Detection</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Active</span>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Extract product categories from description text using NLP pattern matching
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Applied to:</span>
                  <span className="ml-1 font-medium">892 records</span>
                </div>
                <div>
                  <span className="text-gray-500">Accuracy:</span>
                  <span className="ml-1 font-medium">89%</span>
                </div>
                <div>
                  <span className="text-gray-500">Categories found:</span>
                  <span className="ml-1 font-medium">15</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Geographic Region Labeling</h3>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Training</span>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Label records by geographic region based on address patterns and postal codes
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Training on:</span>
                  <span className="ml-1 font-medium">535 records</span>
                </div>
                <div>
                  <span className="text-gray-500">Progress:</span>
                  <span className="ml-1 font-medium">73%</span>
                </div>
                <div>
                  <span className="text-gray-500">ETA:</span>
                  <span className="ml-1 font-medium">15 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-6">Suggested Labeling Opportunities</h2>
          
          <div className="space-y-4">
            <div className="border border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center mb-3">
                <Sparkles className="w-5 h-5 text-blue-500 mr-2" />
                <h3 className="font-semibold text-blue-900">Sentiment Analysis on Reviews</h3>
              </div>
              <p className="text-blue-700 text-sm mb-3">
                Pattern detected: Text fields containing customer feedback could be labeled with sentiment scores
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600">Potential labels: Positive, Negative, Neutral • Confidence: 91%</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                  Create Rule
                </button>
              </div>
            </div>

            <div className="border border-dashed border-purple-300 rounded-lg p-4 bg-purple-50">
              <div className="flex items-center mb-3">
                <Sparkles className="w-5 h-5 text-purple-500 mr-2" />
                <h3 className="font-semibold text-purple-900">Payment Method Classification</h3>
              </div>
              <p className="text-purple-700 text-sm mb-3">
                Pattern detected: Transaction data could be labeled by payment method type
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-600">Potential labels: Credit, Debit, Digital, Cash • Confidence: 96%</span>
                <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
                  Create Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
