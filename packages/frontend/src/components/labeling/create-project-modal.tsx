'use client'

import { useLabelingProject } from "@/hooks/useAPIData";
import { X } from "lucide-react";
import { useState } from "react";

export const CreateProjectModal = ({ 
    isOpen, 
    onClose,
    datasets,
    capabilities 
  }: {
    isOpen: boolean
    onClose: () => void
    datasets: any[]
    capabilities: any
  }) => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      type: 'image_classification' as const,
      dataset_id: '',
      labels: [''],
      auto_label_enabled: true,
      confidence_threshold: 0.8
    })
    
    const { createProject, creating } = useLabelingProject()
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await createProject({
          ...formData,
          labels: formData.labels.filter(label => label.trim() !== '')
        })
        onClose()
      } catch (error) {
        console.error('Failed to create project:', error)
      }
    }
  
    const addLabel = () => {
      setFormData(prev => ({ ...prev, labels: [...prev.labels, ''] }))
    }
  
    const updateLabel = (index: number, value: string) => {
      setFormData(prev => ({
        ...prev,
        labels: prev.labels.map((label, i) => i === index ? value : label)
      }))
    }
  
    const removeLabel = (index: number) => {
      setFormData(prev => ({
        ...prev,
        labels: prev.labels.filter((_, i) => i !== index)
      }))
    }
  
    if (!isOpen) return null
  
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Create Labeling Project</h2>
            <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
  
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="image_classification">Image Classification</option>
                <option value="text_categorization">Text Categorization</option>
                <option value="object_detection">Object Detection</option>
              </select>
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dataset</label>
              <select
                value={formData.dataset_id}
                onChange={(e) => setFormData(prev => ({ ...prev, dataset_id: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a dataset</option>
                {datasets.map(dataset => (
                  <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
                ))}
              </select>
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Labels</label>
              {formData.labels.map((label, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Label ${index + 1}`}
                  />
                  {formData.labels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLabel(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLabel}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Label
              </button>
            </div>
            
            <div className="border-t pt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Auto-Labeling</h4>
                <div className="flex items-center justify-between">
                    <label htmlFor="auto-label-toggle" className="flex flex-col cursor-pointer">
                        <span className="font-medium text-gray-700">Enable AI Assistance</span>
                        <span className="text-sm text-gray-500">Let AI suggest labels for you.</span>
                    </label>
                    <input
                        type="checkbox"
                        id="auto-label-toggle"
                        checked={formData.auto_label_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, auto_label_enabled: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                </div>
                {formData.auto_label_enabled && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Threshold</label>
                        <div className="flex items-center space-x-3">
                            <input
                                type="range"
                                min="0.5"
                                max="0.95"
                                step="0.05"
                                value={formData.confidence_threshold}
                                onChange={(e) => setFormData(prev => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))}
                                className="w-full"
                            />
                            <span className="font-semibold text-gray-700">{Math.round(formData.confidence_threshold * 100)}%</span>
                        </div>
                    </div>
                )}
            </div>
  
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-blue-300"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  } 