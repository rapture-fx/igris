'use client'

import { AlertTriangle, Brain } from "lucide-react";

export const AutoLabelingStatus = ({ 
    capabilities 
  }: { 
    capabilities: any 
  }) => {
    if (!capabilities) return null
  
    const isOnline = capabilities.service_status === 'online'
  
    return (
      <div className={`p-4 rounded-lg border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <>
                <Brain className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">AI Auto-Labeling Online</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">AI Auto-Labeling Offline</span>
              </>
            )}
          </div>
          <span className="text-sm text-gray-600">
            {capabilities.models?.length || 0} models available
          </span>
        </div>
        {isOnline && (
          <div className="mt-2 text-sm text-green-700">
            <p>Available models: {capabilities.models?.map((m: any) => m.name).join(', ')}</p>
          </div>
        )}
      </div>
    )
  } 