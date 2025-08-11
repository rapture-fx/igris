'use client'

import Link from 'next/link'
import { AlertTriangle, ChevronRight, Target } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

export const DataQualityCard = ({ data }) => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Data Quality Insights</h2>
            <p className="text-sm text-gray-600">Real-time quality monitoring</p>
          </div>
        </div>
        <Link href="/dashboard/data-analysis">
          <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            View Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </Link>
      </div>
      <div className="space-y-5">
        {data.key_issues.map((issue, index) => (
          <div key={index} className="flex items-center">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
              <AlertTriangle className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{issue.description}</p>
              <p className="text-sm text-gray-500">{issue.affected_columns.join(', ')}</p>
            </div>
            <p className="text-sm font-semibold text-gray-800">{formatNumber(issue.occurrences)}</p>
          </div>
        ))}
      </div>
    </div>
  ); 