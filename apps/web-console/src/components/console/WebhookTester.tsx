'use client'

import React, { useState } from 'react'
import { Send, Copy, CheckCircle, Webhook, X, AlertCircle } from 'lucide-react'

interface WebhookTesterProps {
  isOpen: boolean
  onClose: () => void
}

interface WebhookTest {
  id: string
  name: string
  description: string
  event: string
  samplePayload: any
}

export default function WebhookTester({ isOpen, onClose }: WebhookTesterProps) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [selectedTest, setSelectedTest] = useState<WebhookTest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const webhookTests: WebhookTest[] = [
    {
      id: 'model-deployed',
      name: 'Model Deployed',
      description: 'Triggered when a new model is deployed to production',
      event: 'model.deployed',
      samplePayload: {
        event: 'model.deployed',
        model_id: 'fraud-detection-v3',
        model_name: 'Fraud Detection V3',
        version: '1.0.0',
        deployed_at: new Date().toISOString(),
        environment: 'production',
        deployment_config: {
          instances: 3,
          auto_scaling: true,
          max_instances: 10
        }
      }
    },
    {
      id: 'prediction-request',
      name: 'Prediction Request',
      description: 'Triggered when a prediction request is made',
      event: 'prediction.requested',
      samplePayload: {
        event: 'prediction.requested',
        request_id: 'req_' + Date.now(),
        model_id: 'fraud-detection-v3',
        timestamp: new Date().toISOString(),
        input_data: {
          amount: 250.00,
          merchant: 'Online Store',
          location: 'US'
        },
        prediction: {
          result: 'legitimate',
          confidence: 0.92,
          risk_score: 0.08
        }
      }
    },
    {
      id: 'data-drift-detected',
      name: 'Data Drift Detected',
      description: 'Triggered when data drift is detected in model inputs',
      event: 'data.drift_detected',
      samplePayload: {
        event: 'data.drift_detected',
        model_id: 'fraud-detection-v3',
        drift_score: 0.85,
        threshold: 0.7,
        detected_at: new Date().toISOString(),
        affected_features: ['amount', 'location'],
        recommendation: 'Consider retraining the model'
      }
    },
    {
      id: 'maintenance-alert',
      name: 'Maintenance Alert',
      description: 'Manufacturing equipment maintenance alert',
      event: 'equipment.maintenance_required',
      samplePayload: {
        event: 'equipment.maintenance_required',
        equipment_id: 'CNC_001',
        equipment_name: 'CNC Machine #1',
        alert_level: 'high',
        predicted_failure_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        maintenance_type: 'preventive',
        estimated_downtime: '4 hours',
        sensors: {
          vibration: 2.8,
          temperature: 78.5,
          pressure: 165.2
        }
      }
    },
    {
      id: 'quality-failure',
      name: 'Quality Control Failure',
      description: 'Product quality check failed',
      event: 'quality.check_failed',
      samplePayload: {
        event: 'quality.check_failed',
        product_id: 'PROD_12345',
        batch_id: 'BATCH_789',
        failure_type: 'dimensional_variance',
        detected_at: new Date().toISOString(),
        quality_score: 0.65,
        threshold: 0.8,
        defects: [
          {
            type: 'dimension',
            severity: 'medium',
            measurement: 100.8,
            expected: 100.0,
            tolerance: 0.5
          }
        ]
      }
    }
  ]

  const handleSendWebhook = async () => {
    if (!webhookUrl || !selectedTest) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Schlep-Engine-Webhook/1.0',
          'X-Schlep-Event': selectedTest.event,
          'X-Schlep-Delivery': 'webhook_' + Date.now(),
        },
        body: JSON.stringify(selectedTest.samplePayload)
      })

      const responseData = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.headers.get('content-type')?.includes('application/json') 
          ? await response.json()
          : await response.text()
      }

      setResult(responseData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send webhook')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
              <Webhook className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Webhook Tester
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Test webhook endpoints with sample payloads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 h-[70vh]">
          {/* Left Panel - Configuration */}
          <div className="p-6 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="space-y-6">
              {/* Webhook URL */}
              <div>
                <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-site.com/webhooks/schlep-engine"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Event Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Event Type
                </label>
                <div className="space-y-2">
                  {webhookTests.map((test) => (
                    <div
                      key={test.id}
                      onClick={() => setSelectedTest(test)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTest?.id === test.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {test.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {test.description}
                          </p>
                        </div>
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {test.event}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendWebhook}
                disabled={!webhookUrl || !selectedTest || isLoading}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Webhook
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Payload & Response */}
          <div className="p-6 overflow-y-auto">
            <div className="space-y-4">
              {/* Payload Preview */}
              {selectedTest && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Payload Preview
                    </h3>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedTest.samplePayload, null, 2))}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-gray-100">
                      {JSON.stringify(selectedTest.samplePayload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Response */}
              {result && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Response
                  </h3>
                  <div className="space-y-2">
                    <div className={`px-3 py-2 rounded-lg text-sm ${
                      result.status >= 200 && result.status < 300
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      Status: {result.status} {result.statusText}
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-100">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}