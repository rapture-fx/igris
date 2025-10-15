'use client'

import React from 'react'

interface ApiLayoutProps {
  title: string
  description?: string
  method?: string
  endpoint?: string
  children: React.ReactNode
}

export function ApiLayout({ 
  title, 
  description, 
  method, 
  endpoint, 
  children 
}: ApiLayoutProps) {

  const getMethodColor = (method?: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-green-100 text-green-800 border-green-200'
      case 'POST': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'PUT': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'PATCH': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          {method && (
            <span className={`px-2 py-1 text-xs font-semibold rounded border ${getMethodColor(method)}`}>
              {method.toUpperCase()}
            </span>
          )}
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </div>
        
        {endpoint && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <code className="text-sm font-mono text-gray-900">{endpoint}</code>
          </div>
        )}
        
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-gray max-w-none">
        {children}
      </div>
    </div>
  )
}