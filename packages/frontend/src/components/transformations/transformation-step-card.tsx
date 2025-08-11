'use client'

import { useState } from 'react'
import {
  Zap,
  ChevronRight,
  Plus,
  ArrowRight,
  GripVertical,
  Trash2,
  Copy,
  Check,
  Replace,
  Split,
  Binary,
  CalendarClock,
  KeyRound,
  Eye,
  Play,
  Save,
  Wand2,
  X,
  Pencil,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lightbulb,
  Settings,
  Brain,
  Target
} from 'lucide-react'
import { TransformationStep } from './types'
import { useTransformationPreview } from '@/hooks/useAPIData'

export const TransformationStepCard = ({ 
  step, 
  onUpdate, 
  onDelete, 
  isEditing, 
  onSetEditing,
  datasetId 
}: {
  step: TransformationStep, 
  onUpdate: (step: TransformationStep) => void, 
  onDelete: (id: string) => void,
  isEditing: boolean, 
  onSetEditing: (id: string | null) => void,
  datasetId: string | null
}) => {
  const [editedStep, setEditedStep] = useState(step)
  const { data: preview, loading: previewLoading, error: previewError, runPreview } = useTransformationPreview(datasetId, editedStep)

  const handleSave = () => {
    onUpdate(editedStep)
    onSetEditing(null)
  }

  const handlePreview = async () => {
    await runPreview()
  }

  const getTransformationIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'replace': Replace,
      'split': Split,
      'format-date': CalendarClock,
      'convert-type': Binary,
      'remove-duplicates': Copy,
      'normalize': Wand2,
      'aggregate': Target,
      'filter': Eye,
      'encrypt': KeyRound
    }
    const IconComponent = iconMap[type] || Zap;
    return <IconComponent className="w-5 h-5 text-gray-500" />
  }

  const renderParams = () => {
    if (!isEditing) {
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
          {Object.entries(step.params).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="font-semibold text-gray-500 capitalize">{key.replace(/_/g, ' ')}: </span>
              <span className="text-gray-700 bg-gray-100 px-2 py-1 rounded">{value}</span>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        {Object.keys(step.params).map(key => (
          <div key={key}>
            <label className="text-xs font-medium text-gray-600 capitalize">{key.replace(/_/g, ' ')}</label>
            <input
              type="text"
              value={editedStep.params[key]}
              onChange={(e) => setEditedStep({ ...editedStep, params: { ...editedStep.params, [key]: e.target.value } })}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 transition-shadow hover:shadow-md">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
            {getTransformationIcon(step.type)}
            <h3 className="text-md font-semibold text-gray-800">{step.description}</h3>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">{step.type}</span>
          </div>
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <button onClick={handleSave} className="p-2 text-gray-600 hover:bg-green-100 hover:text-green-700 rounded-full">
                  <Save className="w-4 h-4" />
                </button>
                <button onClick={() => onSetEditing(null)} className="p-2 text-gray-600 hover:bg-red-100 hover:text-red-700 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => onSetEditing(step.id)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(step.id)} className="p-2 text-gray-600 hover:bg-red-100 hover:text-red-700 rounded-full">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="pl-8 mt-2">
          {renderParams()}
        </div>
      </div>
      {isEditing && (
        <div className="px-4 pb-4 pl-12">
          <button onClick={handlePreview} disabled={previewLoading} className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">
            {previewLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Preview Changes
          </button>
          {previewError && <p className="text-xs text-red-500 mt-2">Error: {previewError.message}</p>}
          {preview && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <h4 className="text-xs font-bold text-gray-600 mb-2">Preview Result</h4>
              <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                {JSON.stringify(preview.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 