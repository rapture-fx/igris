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
        content: `POST /api/v1/storage/upload
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
        content: `POST /api/v1/ml/train/new_pipeline
features: ["age", "income", "purchase"]`,
        progress: [
          "Epoch 3/10 — Accuracy: 0.82",
          "Epoch 10/10 — Accuracy: 0.89"
        ]
      }
    },
    {
      id: 3,
      title: "Production Deploy",
      description: "Get your trained model with performance metrics and deployment-ready configuration. Streamlined Docker-based production setup.",
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
      <h3 className="text-xl font-normal text-gray-900 dark:text-white text-center mb-12 font-inter">
        How Schlep-engine Works
      </h3>

      <div className="max-w-[1200px] mx-auto relative">
        {/* Full vertical git branch line with fade effect */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600 transform -translate-x-0.5"></div>
        <div className="absolute left-1/2 bottom-0 w-px h-16 transform -translate-x-0.5" style={{ background: 'linear-gradient(to bottom, rgba(209, 213, 219, 1), rgba(209, 213, 219, 0))' }}></div>

        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            {/* Git-style blue dot */}
            <div className="absolute left-1/2 top-6 transform -translate-x-2">
              <div className="w-4 h-4 rounded-full shadow-md flex items-center justify-center" style={{ backgroundColor: '#f7f7f3' }}>
                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full opacity-90"></div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-start gap-8 pb-12">
              {/* Left Side - Step Info */}
              <div className="lg:w-1/2 pr-8">
                <div className="bg-white dark:bg-gray-800 border p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 space-y-4" style={{ borderColor: '#114dcd80' }}>
                  <div>
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Step {step.id}
                    </div>
                    <h4 className="text-xl font-normal text-gray-900 dark:text-white">
                      {step.title}
                    </h4>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Right Side - Visual */}
              <div className="lg:w-1/2 pl-8">
              <div className="bg-white dark:bg-gray-800 border p-6 shadow-lg hover:shadow-xl transition-shadow duration-300" style={{ borderColor: '#114dcd80' }}>
                {step.visual.type === "code" && (
                  <div>
                    <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      <code dangerouslySetInnerHTML={{
                        __html: step.visual.content
                          .replace(/POST/g, '<span style="color: #114dcd; font-weight: 600;">POST</span>')
                          .replace(/\/api\/v1\/[^\s\n]*/g, '<span style="color: #114dcd;">$&</span>')
                          .replace(/(file:|features:)/g, '<span style="color: #114dcd;">$1</span>')
                          .replace(/(\[.*?\])/g, '<span style="color: #114dcd;">$1</span>')
                          .replace(/"([^"]*)"(?=:)/g, '"<span style="color: #114dcd;">$1</span>"')
                      }} />
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
                    <code dangerouslySetInnerHTML={{
                      __html: step.visual.content
                        .replace(/"([^"]*)":/g, '"<span style="color: #114dcd;">$1</span>":')
                        .replace(/:\s*"([^"]*)"/g, ': "<span style="color: #16a34a;">$1</span>"')
                        .replace(/:\s*([\d.]+)/g, ': <span style="color: #dc2626;">$1</span>')
                        .replace(/\{|\}/g, '<span style="color: #6b7280;">$&</span>')
                    }} />
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