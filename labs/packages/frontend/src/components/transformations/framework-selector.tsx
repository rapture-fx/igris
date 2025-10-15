'use client'

import { Target } from "lucide-react"

export const FrameworkSelector = ({ 
    value, 
    onChange,
    frameworks 
  }: { 
    value: string, 
    onChange: (framework: string) => void,
    frameworks: Record<string, any> | null
  }) => {
    if (!frameworks) return null
  
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center space-x-2 mb-3">
          <Target className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-medium text-gray-700">Target Framework</h3>
        </div>
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.entries(frameworks).map(([key, framework]) => (
            <option key={key} value={key}>
              {framework.name} - {framework.description}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          Framework-specific optimizations will be applied to your pipeline
        </p>
      </div>
    )
  } 