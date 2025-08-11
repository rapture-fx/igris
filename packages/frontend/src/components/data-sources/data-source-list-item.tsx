'use client'

import { Database, FileJson, FileSpreadsheet, FileText, MoreVertical, Table, Zap } from "lucide-react";

const getTypeIcon = (type: string) => {
    switch (type) {
      case 'csv': return <FileSpreadsheet className="w-5 h-5 text-green-600" />
      case 'json': return <FileJson className="w-5 h-5 text-blue-600" />
      case 'excel': return <Table className="w-5 h-5 text-orange-600" />
      case 'database': return <Database className="w-5 h-5 text-purple-600" />
      case 'api': return <Zap className="w-5 h-5 text-yellow-600" />
      default: return <FileText className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

export const DataSourceListItem = ({ source }) => (
    <div key={source.id} className="bg-white border-b border-gray-200/80 p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors duration-200">
        <div className="flex items-center w-1/3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
            {getTypeIcon(source.type)}
            </div>
            <div>
            <p className="font-semibold text-gray-900">{source.name}</p>
            <p className="text-sm text-gray-500">
                {formatNumber(source.records)} records • {source.size}
            </p>
            </div>
        </div>
        <div className="w-1/6 text-center">
            <p className="text-sm text-gray-500">Quality</p>
            <p className={`font-semibold ${getQualityColor(source.quality_score)}`}>
            {source.quality_score}%
            </p>
        </div>
        <div className="w-1/6 text-center">
            <p className="text-sm text-gray-500">Last Updated</p>
            <p className="font-semibold text-gray-800">{formatDate(source.last_updated)}</p>
        </div>
        <div className="w-1/6 text-center">
            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
            </div>
        </div>
        <div className="w-1/12 text-right">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">
            <MoreVertical className="w-5 h-5"/>
            </button>
        </div>
    </div>
) 