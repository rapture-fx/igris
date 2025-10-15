'use client'

import { cn } from "@/lib/utils";
import { Brain, BarChart3, Zap } from "lucide-react";

export const ProcessingModeSelector = ({ 
    value, 
    onChange 
  }: { 
    value: string, 
    onChange: (mode: string) => void 
  }) => {
    const modes = [
      { id: 'fast', name: 'Fast', description: 'Quick analysis for immediate insights', icon: <Zap className="w-4 h-4" /> },
      { id: 'standard', name: 'Standard', description: 'Balanced performance and analysis', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'ai_enhanced', name: 'AI Enhanced', description: 'Deep analysis with ML insights', icon: <Brain className="w-4 h-4" /> }
    ]
  
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Processing Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onChange(mode.id)}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                value === mode.id 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-center space-x-2 mb-1">
                {mode.icon}
                <span className="font-medium text-sm">{mode.name}</span>
              </div>
              <p className="text-xs text-gray-600">{mode.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  } 