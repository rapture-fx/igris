'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Sparkles, Upload, BarChart3, Brain, CheckCircle, ArrowRight, Play } from 'lucide-react'

interface TourStep {
  id: string
  title: string
  description: string
  target?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  content?: React.ReactNode
  action?: {
    type: 'navigate' | 'demo' | 'sample'
    payload?: string
  }
}

interface GuidedTourProps {
  isVisible: boolean
  onClose: () => void
  onComplete: () => void
  userId?: string
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '🚀 Welcome to Schlep-engine!',
    description: 'Transform your messy data into AI-ready insights in minutes, not hours.',
    content: (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center space-x-3 mb-3">
            <Sparkles className="w-8 h-8" />
            <h3 className="text-xl font-bold">AI-Powered Data Intelligence</h3>
          </div>
          <p className="text-blue-100">
            Say goodbye to manual data cleaning. Our AI automatically detects issues, 
            suggests fixes, and provides instant insights from your datasets.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-green-50 rounded-lg">
            <Upload className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-900">Upload</p>
            <p className="text-xs text-green-700">Any format</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <Brain className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-900">AI Analysis</p>
            <p className="text-xs text-blue-700">Instant insights</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <BarChart3 className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-900">Visualize</p>
            <p className="text-xs text-purple-700">Quality metrics</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'upload',
    title: '📤 Upload Your Data',
    description: 'Start by uploading any data file - CSV, Excel, JSON, or Parquet.',
    target: '[data-tour="upload-area"]',
    position: 'bottom',
    action: { type: 'navigate', payload: '/dashboard/data-sources' },
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Simply drag and drop your files or click to browse. Our AI supports:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>CSV Files</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>Excel Files</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span>JSON Files</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            <span>Parquet Files</span>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <p className="text-sm text-blue-800 font-medium">💡 Pro Tip</p>
          <p className="text-xs text-blue-700 mt-1">
            Files up to 100MB are processed instantly. Larger files are handled in the background.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'processing',
    title: '🧠 AI Processing Magic',
    description: 'Watch as our AI analyzes your data quality and generates insights.',
    content: (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-green-400 to-blue-500 rounded-lg p-4 text-white">
          <h4 className="font-semibold mb-2">What happens during processing:</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Data structure analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Quality score calculation</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Pattern recognition</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Anomaly detection</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Recommendation generation</span>
            </div>
          </div>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-3 py-2 rounded-full text-sm">
            <Brain className="w-4 h-4 animate-pulse" />
            <span>Typical processing time: 30-60 seconds</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'insights',
    title: '📊 View Your Insights',
    description: 'Explore interactive charts, data quality metrics, and AI recommendations.',
    target: '[data-tour="insights-panel"]',
    position: 'left',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Your investigation results include:</p>
        <div className="space-y-2">
          <div className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
            <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Quality Metrics</p>
              <p className="text-xs text-gray-600">Completeness, validity, consistency scores</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
            <Brain className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">AI Insights</p>
              <p className="text-xs text-gray-600">Patterns, anomalies, and recommendations</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
            <Upload className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Data Preview</p>
              <p className="text-xs text-gray-600">Sample rows with type detection</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'sample-data',
    title: '🎯 Try Sample Data',
    description: 'Not ready to upload your own data? Try our sample datasets first!',
    action: { type: 'sample' },
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Explore Schlep-engine with pre-loaded sample datasets:
        </p>
        <div className="grid gap-3">
          <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Customer Data Sample</p>
                <p className="text-xs text-gray-600">1,000 records • Demographics & behavior</p>
              </div>
              <Play className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Sales Transactions</p>
                <p className="text-xs text-gray-600">5,000 records • E-commerce data</p>
              </div>
              <Play className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Sensor Readings</p>
                <p className="text-xs text-gray-600">2,500 records • IoT time series</p>
              </div>
              <Play className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'complete',
    title: '🎉 You\'re All Set!',
    description: 'Ready to transform your data into actionable insights?',
    content: (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Welcome aboard!</h3>
          <p className="text-gray-600 mt-1">
            You now know how to upload data, analyze quality, and get AI insights.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">Quick Start Checklist:</p>
          <div className="space-y-1 text-sm text-blue-700">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Upload your first dataset</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Review AI-generated insights</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Export cleaned data</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
]

export function GuidedTour({ isVisible, onClose, onComplete, userId }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    // Check if user has completed onboarding before
    const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${userId}`)
    if (hasCompletedOnboarding && !isVisible) {
      setIsCompleted(true)
    }
  }, [userId, isVisible])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsCompleted(true)
    if (userId) {
      localStorage.setItem(`onboarding_completed_${userId}`, 'true')
    }
    onComplete()
    onClose()
  }

  const handleSkip = () => {
    onClose()
  }

  const handleStepAction = (action?: TourStep['action']) => {
    if (!action) return

    switch (action.type) {
      case 'navigate':
        // Would integrate with router to navigate
        console.log('Navigate to:', action.payload)
        break
      case 'demo':
        // Would trigger demo functionality
        console.log('Start demo:', action.payload)
        break
      case 'sample':
        // Would load sample data
        console.log('Load sample data')
        break
    }
  }

  if (!isVisible || isCompleted) {
    return null
  }

  const currentStepData = tourSteps[currentStep]
  const isLastStep = currentStep === tourSteps.length - 1

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
      
      {/* Tour Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Schlep-engine Tour</h2>
                <p className="text-blue-100 text-sm">
                  Step {currentStep + 1} of {tourSteps.length}
                </p>
              </div>
              <button
                onClick={handleSkip}
                className="text-white hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-3 bg-white bg-opacity-20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {currentStepData.title}
              </h3>
              <p className="text-gray-600">
                {currentStepData.description}
              </p>
            </div>

            {/* Step Content */}
            {currentStepData.content && (
              <div className="mb-6">
                {currentStepData.content}
              </div>
            )}

            {/* Action Button */}
            {currentStepData.action && (
              <div className="mb-4">
                <button
                  onClick={() => handleStepAction(currentStepData.action)}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>
                    {currentStepData.action.type === 'navigate' && 'Go to Data Sources'}
                    {currentStepData.action.type === 'demo' && 'Start Demo'}
                    {currentStepData.action.type === 'sample' && 'Try Sample Data'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentStep 
                      ? 'bg-blue-600 w-8' 
                      : index < currentStep 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Get Started</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 