'use client'

import { Lightbulb, Sparkles, Zap } from "lucide-react"
import { useState } from "react"
import { LabelingProject, QueueItem } from "./types"


export const LabelingInterface = ({ 
    project, 
    queueData,
    onLabelSubmit,
    onAutoLabelRequest 
  }: {
    project: LabelingProject
    queueData: any
    onLabelSubmit: (itemId: string, label: string) => void
    onAutoLabelRequest: (itemIds: string[]) => void
  }) => {
    const [currentItemIndex, setCurrentItemIndex] = useState(0)
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  
    const currentItem: QueueItem | undefined = queueData?.queue[currentItemIndex]
  
    const handleSubmit = () => {
      if (currentItem && selectedLabel) {
        onLabelSubmit(currentItem.id, selectedLabel)
        setSelectedLabel(null)
        if (currentItemIndex < queueData.queue.length - 1) {
          setCurrentItemIndex(prev => prev + 1)
        }
      }
    }
  
    const handleAutoLabel = () => {
      // Example: auto-label current and next 4 items
      const itemsToLabel = queueData.queue
        .slice(currentItemIndex, currentItemIndex + 5)
        .map((item: QueueItem) => item.id)
      
      onAutoLabelRequest(itemsToLabel)
    }
  
    if (!project || !queueData || queueData.queue.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">No items to label</p>
            <p className="text-sm text-gray-500">Select another project or upload new data.</p>
          </div>
        </div>
      )
    }
  
    return (
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">{project.name}</h3>
            <p className="text-sm text-gray-500">
              Item {currentItemIndex + 1} of {queueData.queue.length}
            </p>
          </div>
          <button 
            onClick={handleAutoLabel}
            className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 font-semibold rounded-lg hover:bg-purple-200 text-sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Auto-Label Batch
          </button>
        </div>
  
        {/* Main Content */}
        <div className="flex-1 flex p-4 space-x-4 overflow-y-auto">
          {/* Item Display */}
          <div className="w-2/3 bg-gray-100 rounded-lg flex items-center justify-center p-4">
            {currentItem.type === 'image' ? (
              <img src={currentItem.data} alt="Item to label" className="max-w-full max-h-full object-contain rounded-md" />
            ) : (
              <p className="text-lg leading-relaxed">{currentItem.data}</p>
            )}
          </div>
  
          {/* Labeling Panel */}
          <div className="w-1/3 flex flex-col space-y-4">
            <h4 className="font-semibold text-gray-800">Choose a label:</h4>
            {project.labels.map((label: string) => (
              <button
                key={label}
                onClick={() => setSelectedLabel(label)}
                className={`w-full p-3 rounded-lg border text-left font-medium transition-all ${
                  selectedLabel === label 
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
            
            {currentItem.auto_label_suggestion && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  <h5 className="font-semibold text-yellow-800">AI Suggestion</h5>
                </div>
                <p className="mt-2 text-sm text-yellow-700">
                  Label as <span className="font-bold">{currentItem.auto_label_suggestion.label}</span> with {Math.round(currentItem.auto_label_suggestion.confidence * 100)}% confidence.
                </p>
                <button
                  onClick={() => setSelectedLabel(currentItem.auto_label_suggestion.label)}
                  className="mt-2 text-sm font-semibold text-yellow-800 hover:underline"
                >
                  Accept Suggestion
                </button>
              </div>
            )}
          </div>
        </div>
  
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <div>
            <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Skip</button>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setCurrentItemIndex(prev => Math.max(0, prev - 1))}
              disabled={currentItemIndex === 0}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <button 
              onClick={handleSubmit}
              disabled={!selectedLabel}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    )
  } 