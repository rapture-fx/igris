'use client'

import { useState, useEffect } from 'react'
import { Download, Cpu, Database, RefreshCw, CheckCircle2, Code } from 'lucide-react'

export default function ExportPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Export Ready</h1>
          <p className="text-gray-600 mt-2">Export your processed data for popular AI frameworks and platforms</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <Download className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to Export</h3>
            <p className="text-3xl font-bold text-blue-600">5</p>
            <p className="text-sm text-gray-500 mt-2">processed datasets</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Cpu className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Frameworks</h3>
            <p className="text-3xl font-bold text-green-600">8</p>
            <p className="text-sm text-gray-500 mt-2">supported formats</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <CheckCircle2 className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Success Rate</h3>
            <p className="text-3xl font-bold text-purple-600">98%</p>
            <p className="text-sm text-gray-500 mt-2">export success rate</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-6">AI Framework Exports</h2>
            
            <div className="space-y-4">
              <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                      <Code className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">TensorFlow</h3>
                      <p className="text-sm text-gray-600">TFRecord format</p>
                    </div>
                  </div>
                  <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm">
                    Export
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Optimized for TensorFlow training pipelines • Includes feature engineering
                </div>
              </div>

              <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                      <Code className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">PyTorch</h3>
                      <p className="text-sm text-gray-600">Tensor dataset</p>
                    </div>
                  </div>
                  <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                    Export
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Ready-to-use DataLoader format • Includes train/val/test splits
                </div>
              </div>

              <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <Code className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Scikit-learn</h3>
                      <p className="text-sm text-gray-600">NumPy arrays</p>
                    </div>
                  </div>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                    Export
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Feature matrix + target vectors • Preprocessed and normalized
                </div>
              </div>

              <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <Code className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Hugging Face</h3>
                      <p className="text-sm text-gray-600">Datasets format</p>
                    </div>
                  </div>
                  <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                    Export
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Arrow format • Compatible with transformers library
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-6">Standard Format Exports</h2>
            
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Database className="w-6 h-6 text-gray-600 mr-3" />
                    <div>
                      <h3 className="font-semibold">CSV Export</h3>
                      <p className="text-sm text-gray-600">Clean, processed data</p>
                    </div>
                  </div>
                  <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">
                    Download
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  15,420 rows • 8 columns • All transformations applied
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Database className="w-6 h-6 text-gray-600 mr-3" />
                    <div>
                      <h3 className="font-semibold">JSON Export</h3>
                      <p className="text-sm text-gray-600">Structured format</p>
                    </div>
                  </div>
                  <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">
                    Download
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Hierarchical structure • Includes metadata and schemas
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Database className="w-6 h-6 text-gray-600 mr-3" />
                    <div>
                      <h3 className="font-semibold">Parquet Export</h3>
                      <p className="text-sm text-gray-600">Columnar storage</p>
                    </div>
                  </div>
                  <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">
                    Download
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Compressed format • Optimized for analytics workloads
                </div>
              </div>

              <div className="border border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                <h3 className="font-semibold text-blue-900 mb-2">Custom Export Configuration</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Need a specific format? Configure custom export settings for your workflow.
                </p>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                  Configure Export
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Export History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Dataset</th>
                  <th className="text-left py-3 px-4 font-semibold">Format</th>
                  <th className="text-left py-3 px-4 font-semibold">Size</th>
                  <th className="text-left py-3 px-4 font-semibold">Exported</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4">Customer Database</td>
                  <td className="py-3 px-4">TensorFlow</td>
                  <td className="py-3 px-4">2.4 MB</td>
                  <td className="py-3 px-4">2 hours ago</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Complete</span>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">Sales Transactions</td>
                  <td className="py-3 px-4">PyTorch</td>
                  <td className="py-3 px-4">1.8 MB</td>
                  <td className="py-3 px-4">1 day ago</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Complete</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Product Catalog</td>
                  <td className="py-3 px-4">CSV</td>
                  <td className="py-3 px-4">890 KB</td>
                  <td className="py-3 px-4">3 days ago</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Complete</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
