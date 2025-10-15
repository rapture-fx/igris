'use client'

import { Brain, Lightbulb, Plus, RefreshCw } from "lucide-react";
import { useFrameworkTransformationSuggestions } from "@/hooks/useAPIData";

export const FrameworkSuggestions = ({ 
  datasetId, 
  framework,
  onAddSuggestion 
}: { 
  datasetId: string | null,
  framework: string,
  onAddSuggestion: (suggestion: any) => void
}) => {
  const { data: suggestions, loading } = useFrameworkTransformationSuggestions(datasetId, framework)

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm text-gray-600">Loading AI suggestions...</span>
        </div>
      </div>
    )
  }

  if (!suggestions?.suggestions || suggestions.suggestions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-2 text-gray-500">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm">No AI suggestions available</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Brain className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-medium text-gray-700">AI Suggestions</h3>
      </div>
      <div className="space-y-2">
        {suggestions.suggestions.slice(0, 3).map((suggestion: any, index: number) => (
          <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">{suggestion.description}</p>
                <p className="text-xs text-purple-700 mt-1">
                  Column: {suggestion.column} • Priority: {suggestion.priority}/10
                </p>
              </div>
              <button
                onClick={() => onAddSuggestion(suggestion)}
                className="ml-2 p-1 text-purple-600 hover:bg-purple-100 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 