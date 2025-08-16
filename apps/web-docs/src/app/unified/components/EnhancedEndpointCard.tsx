'use client'

import { 
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { clsx } from 'clsx'

interface EnhancedEndpointCardProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  icon: any
  onClick?: () => void
}

export function EnhancedEndpointCard({ method, path, description, icon: Icon, onClick }: EnhancedEndpointCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-800'
      case 'POST':
        return 'bg-blue-100 text-blue-800'
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <button 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={clsx(
        "w-full text-left border border-gray-200 rounded-lg p-6 transition-all duration-200",
        "hover:border-blue-300 hover:shadow-sm bg-white"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={clsx(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              getMethodColor(method)
            )}>
              {method}
            </span>
            <code className="font-mono text-gray-900">{path}</code>
          </div>
          <p className="text-gray-600">{description}</p>
        </div>
        <div className="flex-shrink-0">
          <ArrowRightIcon className={clsx(
            "h-5 w-5 transition-colors duration-200",
            isHovered ? "text-blue-600" : "text-gray-400"
          )} />
        </div>
      </div>
    </button>
  )
}