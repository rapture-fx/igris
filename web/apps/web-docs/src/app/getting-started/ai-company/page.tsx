'use client'

import Link from 'next/link'
import { CheckIcon, CpuChipIcon, BeakerIcon, RocketLaunchIcon, CloudIcon, KeyIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function AICompanyGettingStarted() {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev => 
      prev.includes(stepNumber) 
        ? prev.filter(s => s !== stepNumber)
        : [...prev, stepNumber]
    )
  }

  const steps = [
    {
      id: 1,
      title: "Get Your API Key",
      icon: KeyIcon,
      description: "Create an account and obtain your Schlep Engine API key",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            First, you'll need to sign up for a Schlep Engine account and get your API key.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 mb-3"><strong>Steps to get your API key:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
              <li>Sign up at <Link href="https://dashboard.schlep-engine.com" className="underline">dashboard.schlep-engine.com</Link></li>
              <li>Navigate to API Keys section</li>
              <li>Create a new API key with MLOps permissions</li>
              <li>Copy and securely store your API key</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "Install SDK",
      icon: CpuChipIcon,
      description: "Install the Schlep Engine SDK in your preferred language",
      content: (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Python</h4>
              <code className="text-sm bg-black text-green-400 p-2 rounded block">
                pip install schlep-engine
              </code>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Node.js</h4>
              <code className="text-sm bg-black text-green-400 p-2 rounded block">
                npm install @schlep-engine/sdk
              </code>
            </div>
          </div>
          <p className="text-gray-600 text-sm">
            Our SDKs provide comprehensive support for MLOps workflows, experiment tracking, and model serving.
          </p>
        </div>
      )
    },
    {
      id: 3,
      title: "Initialize Client",
      icon: RocketLaunchIcon,
      description: "Set up authentication and create your first client instance",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Python Example</h4>
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`from schlep_engine import SchlepClient

# Initialize client with your API key
client = SchlepClient(
    api_key="your_api_key_here",
    environment="production"  # or "sandbox"
)

# Test connection
status = client.health_check()
print(f"Status: {status}")  # Should print: Status: healthy`}
            </pre>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">TypeScript Example</h4>
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`import { SchlepClient } from '@schlep-engine/sdk';

// Initialize client
const client = new SchlepClient({
  apiKey: 'your_api_key_here',
  environment: 'production' // or 'sandbox'
});

// Test connection
const status = await client.healthCheck();
console.log(\`Status: \${status}\`); // Status: healthy`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Create Your First Experiment",
      icon: BeakerIcon,
      description: "Set up experiment tracking for your ML models",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Experiment tracking is fundamental to MLOps. Let's create your first experiment and log some metrics.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`# Create a new experiment
experiment = client.experiments.create(
    name="image_classification_v1",
    description="CNN model for image classification",
    tags=["computer_vision", "classification"]
)

# Start a new run
run = experiment.start_run(
    name="cnn_baseline",
    parameters={
        "learning_rate": 0.001,
        "batch_size": 32,
        "epochs": 50,
        "architecture": "resnet50"
    }
)

# Log metrics during training
for epoch in range(50):
    # Your training code here...
    accuracy = train_epoch()
    loss = calculate_loss()
    
    run.log_metrics({
        "accuracy": accuracy,
        "loss": loss,
        "epoch": epoch
    })

# Complete the run
run.finish(status="completed")`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 5,
      title: "Deploy Your Model",
      icon: CloudIcon,
      description: "Deploy your trained model for inference",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Once your model is trained and validated, deploy it for real-time inference.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm bg-black text-green-400 p-3 rounded overflow-x-auto">
{`# Upload your model
model_version = client.models.upload(
    name="image_classifier",
    version="1.0.0",
    model_file="./model.pkl",  # or model directory
    requirements="./requirements.txt",
    framework="pytorch",
    description="ResNet50 image classifier"
)

# Deploy to production
deployment = client.deployments.create(
    model_version_id=model_version.id,
    name="image_classifier_prod",
    environment="production",
    scaling_config={
        "min_replicas": 2,
        "max_replicas": 10,
        "target_cpu_utilization": 70
    }
)

print(f"Model deployed! Endpoint: {deployment.endpoint_url}")

# Make predictions
prediction = client.predict(
    deployment_id=deployment.id,
    data={"image_url": "https://example.com/image.jpg"}
)
print(f"Prediction: {prediction}")`}
            </pre>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <CpuChipIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">AI Company Quick Start</h1>
        </div>
        <p className="text-xl text-gray-600">
          Get started with Schlep Engine's MLOps platform in under 10 minutes. 
          Set up experiment tracking, model training, and deployment workflows.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Getting Started Progress</h3>
          <span className="text-sm text-blue-600 font-medium">
            {completedSteps.length} of {steps.length} steps completed
          </span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-8">
        {steps.map((step) => {
          const Icon = step.icon
          const isCompleted = completedSteps.includes(step.id)
          
          return (
            <div key={step.id} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-lg
                    ${isCompleted ? 'bg-green-100 border-green-200' : 'bg-blue-100 border-blue-200'}
                    border cursor-pointer transition-colors
                  `} onClick={() => toggleStep(step.id)}>
                    {isCompleted ? (
                      <CheckIcon className="h-6 w-6 text-green-600" />
                    ) : (
                      <Icon className="h-6 w-6 text-blue-600" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Step {step.id}: {step.title}
                    </h3>
                    <button
                      onClick={() => toggleStep(step.id)}
                      className={`
                        px-3 py-1 rounded-full text-xs font-medium transition-colors
                        ${isCompleted 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }
                      `}
                    >
                      {isCompleted ? 'Completed' : 'Mark Complete'}
                    </button>
                  </div>
                  
                  <p className="text-gray-600">{step.description}</p>
                  
                  <div className="mt-4">
                    {step.content}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">What's Next?</h2>
        <p className="text-gray-600 mb-6">
          Now that you've completed the basic setup, explore advanced MLOps features and best practices.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/tutorials/mlops-setup" className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">MLOps Tutorial</h3>
            <p className="text-sm text-gray-600">Deep dive into advanced MLOps workflows</p>
          </Link>
          <Link href="/examples/ai-company" className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">Code Examples</h3>
            <p className="text-sm text-gray-600">Real-world implementation patterns</p>
          </Link>
          <Link href="/api-reference/mlops" className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <h3 className="font-semibold text-gray-900 mb-2">API Reference</h3>
            <p className="text-sm text-gray-600">Complete MLOps API documentation</p>
          </Link>
        </div>
      </div>

      {/* Support */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Need Help?</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Documentation</h4>
            <ul className="space-y-1 text-gray-600">
              <li><Link href="/api-reference/mlops" className="hover:text-blue-600">MLOps API Reference</Link></li>
              <li><Link href="/sdk/python" className="hover:text-blue-600">Python SDK Docs</Link></li>
              <li><Link href="/sdk/typescript" className="hover:text-blue-600">TypeScript SDK Docs</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Community</h4>
            <ul className="space-y-1 text-gray-600">
              <li><a href="mailto:support@schlep-engine.com" className="hover:text-blue-600">Email Support</a></li>
              <li><a href="https://github.com/schlep-engine/examples" className="hover:text-blue-600">GitHub Examples</a></li>
              <li><a href="https://discord.gg/schlep-engine" className="hover:text-blue-600">Discord Community</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}