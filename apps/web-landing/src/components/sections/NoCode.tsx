'use client'

import { Upload, Download, Zap, MousePointer } from 'lucide-react'
import Link from 'next/link'

export default function NoCode() {
  return (
    // Visual Enhancement Suggestion: Consider adding a screenshot or a short demo video
    // of the no-code interface in action, showing the drag-and-drop, point-and-click configuration,
    // and the processing steps.
    <section className="py-20 bg-black">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">
            For <span className="text-[#468BE6]">No-Code Users</span>
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Clean and prepare your data without writing a single line of code. 
            Our intuitive interface makes data transformation accessible to everyone.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                <Upload className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Simple Upload
                </h3>
                <p className="text-gray-300">
                  Drag and drop your CSV, Excel, or JSON files. No technical setup required.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                <MousePointer className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Point & Click Configuration
                </h3>
                <p className="text-gray-300">
                  Select transformations, handle missing values, and configure outputs with visual tools.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  AI-Powered Processing
                </h3>
                <p className="text-gray-300">
                  Our AI automatically detects data patterns and suggests optimal transformations.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                <Download className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Ready-to-Use Output
                </h3>
                <p className="text-gray-300">
                  Download clean data in formats ready for Excel, Tableau, or any analytics tool.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl shadow-lg p-8 border">
            <div className="space-y-6">
              <div className="border-2 border-dashed border-[#468BE6]/30 rounded-lg p-8 text-center bg-[#468BE6]/5">
                <Upload className="w-12 h-12 text-[#468BE6] mx-auto mb-4" />
                <p className="text-gray-700 font-medium">Drop your data file here</p>
                <p className="text-sm text-gray-500 mt-1">CSV, Excel, JSON supported</p>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Data Quality Check</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">98%</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Missing Values</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Auto-Fill</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Output Format</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">TensorFlow</span>
                  </div>
                </div>
              </div>

              <button className="w-full bg-[#468BE6] text-white py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium">
                Process Data
              </button>
              <Link 
                href="/contact" 
                className="w-full text-center border border-[#468BE6] text-[#468BE6] px-6 py-3 rounded-lg hover:bg-[#468BE6] hover:text-white transition-colors font-medium mt-4"
              >
                Request a Demo
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#468BE6]/10 to-blue-100/50 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-semibold text-white mb-4">
            Popular No-Code Integrations
          </h3>
          <div className="flex flex-wrap justify-center gap-6">
            {['Zapier', 'Airtable', 'Google Sheets', 'Notion', 'Tableau', 'Power BI'].map((tool) => (
              <div key={tool} className="bg-gray-900 px-4 py-2 rounded-lg shadow-sm border">
                <span className="text-sm font-medium text-gray-700">{tool}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}