import React from 'react'
import { Upload, Zap, Download } from 'lucide-react'

const VerticalWorkflow = () => {
  const steps = [
    {
      id: 1,
      title: "Upload Your Data",
      description: "Send raw files (CSV, JSON, PDF, or text) with a single API call. Schlep-engine automatically ingests and prepares your data.",
      icon: Upload,
      visual: {
        type: "code",
        content: `POST /api/v1/data/upload
file: training_data.csv`
      }
    },
    {
      id: 2,
      title: "Train Your Model",
      description: "Kick off training with one request. Schlep-engine handles preprocessing, feature extraction, and model training in the background.",
      icon: Zap,
      visual: {
        type: "code",
        content: `POST /api/v1/train/new_pipeline
features: ["age", "income", "purchase"]`,
        progress: [
          "Epoch 3/10 — Accuracy: 0.82",
          "Epoch 10/10 — Accuracy: 0.89"
        ]
      }
    },
    {
      id: 3,
      title: "Deploy Instantly",
      description: "Turn your trained model into a production-ready API endpoint in seconds. Monitor metrics and start making predictions immediately.",
      icon: Download,
      visual: {
        type: "json",
        content: `{
  "status": "completed",
  "model_id": "ml_abc123",
  "accuracy": 0.89,
  "metrics": {
    "precision": 0.91,
    "recall": 0.87
  }
}`
      }
    }
  ]

  return (
    <div className="mt-16 mb-16">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-12 font-inter">
        How Schlep-engine Works
      </h3>

      <div className="max-w-5xl mx-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            {/* Vertical connector line */}
            {index < steps.length - 1 && (
              <div className="absolute left-6 top-12 w-0.5 h-20 bg-gradient-to-b from-blue-400 to-blue-300 dark:from-blue-500 dark:to-blue-400"></div>
            )}

            <div className="flex flex-col lg:flex-row items-start gap-8 pb-12">
              {/* Left Side - Step Info */}
              <div className="lg:w-1/2 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700">
                    <step.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Step {step.id}
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {step.title}
                    </h4>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 leading-relaxed pl-16">
                  {step.description}
                </p>
              </div>

              {/* Right Side - Visual */}
              <div className="lg:w-1/2">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                {step.visual.type === "code" && (
                  <div>
                    <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {step.visual.content}
                    </pre>
                    {step.visual.progress && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          Training Progress
                        </div>
                        {step.visual.progress.map((progress, idx) => (
                          <div key={idx} className="text-sm font-mono text-green-600 dark:text-green-400">
                            {progress}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step.visual.type === "json" && (
                  <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {step.visual.content}
                  </pre>
                )}
              </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VerticalWorkflow