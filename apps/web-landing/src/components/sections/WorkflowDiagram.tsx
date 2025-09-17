import React from 'react'
import { ArrowRight, Upload, Zap, Download } from 'lucide-react'

const WorkflowDiagram = () => {
  const steps = [
    {
      id: 1,
      title: "Upload",
      description: "Send your data file",
      endpoint: "/api/v1/data/upload",
      icon: Upload,
      detail: "POST with file upload"
    },
    {
      id: 2,
      title: "Train",
      description: "Create ML pipeline",
      endpoint: "/api/v1/ml/train/new_pipeline",
      icon: Zap,
      detail: "POST with config & features"
    },
    {
      id: 3,
      title: "Deploy",
      description: "Get trained model",
      endpoint: "/api/v1/pipelines/{id}/status",
      icon: Download,
      detail: "GET model & metrics"
    }
  ]

  return (
    <div className="mt-12 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-8 font-inter">
        How it works
      </h3>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex-1 max-w-xs">
              <div className="text-center">
                {/* Step Icon */}
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <step.icon className="w-8 h-8 text-blue-600" />
                </div>

                {/* Step Number */}
                <div className="text-sm font-semibold text-blue-600 mb-2">
                  Step {step.id}
                </div>

                {/* Step Title */}
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {step.title}
                </h4>

                {/* Step Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {step.description}
                </p>

                {/* API Endpoint */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-left">
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-1">
                    {step.detail}
                  </div>
                  <div className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                    {step.endpoint}
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow between steps */}
            {index < steps.length - 1 && (
              <div className="flex-shrink-0 hidden lg:block">
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>
            )}

            {/* Vertical arrow for mobile */}
            {index < steps.length - 1 && (
              <div className="flex-shrink-0 lg:hidden rotate-90">
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* API Response Example */}
      <div className="mt-8 max-w-2xl mx-auto">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
            Final Response
          </div>
          <div className="font-mono text-xs text-green-700 dark:text-green-300">
            {`{
  "status": "completed",
  "model_id": "rf_abc123",
  "accuracy": 0.89,
  "metrics": { "precision": 0.91, "recall": 0.87 }
}`}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkflowDiagram