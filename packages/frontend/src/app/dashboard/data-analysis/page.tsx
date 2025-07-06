'use client'

import { Search } from 'lucide-react'

export default function DataAnalysisPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Search className="w-8 h-8 text-gray-500" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Analysis</h1>
      <p className="text-gray-600 max-w-md">
        This section is under construction. Advanced data analysis features will be available here soon.
      </p>
    </div>
  )
} 