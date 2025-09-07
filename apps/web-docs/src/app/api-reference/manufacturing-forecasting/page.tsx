'use client'

import { ApiLayout } from '@/components/ui/ApiLayout'
import { CogIcon, ChartBarIcon, BoltIcon } from '@heroicons/react/24/outline'

export default function ManufacturingForecastingApiPage() {

  const endpoints = [
    {
      method: 'POST',
      path: '/api/v1/industry/manufacturing/predictive-maintenance',
      description: 'Predict equipment failure using LSTM/GRU networks and multi-sensor data fusion. Supports 1-30 day prediction horizons with confidence intervals and cost-benefit analysis.'
    },
    {
      method: 'GET',
      path: '/api/v1/industry/manufacturing/predictive-maintenance',
      description: 'Get real-time equipment health status with anomaly detection and performance metrics.'
    },
    {
      method: 'POST',
      path: '/api/v1/industry/ecommerce/demand-forecast',
      description: 'Forecast production demand using Facebook Prophet with seasonal pattern recognition and capacity planning.'
    },
    {
      method: 'POST',
      path: '/api/v1/industry/manufacturing/quality-control',
      description: 'Predict quality trends with defect analysis and compliance tracking using ensemble methods.'
    },
    {
      method: 'POST',
      path: '/api/v1/industry/manufacturing/supply-chain',
      description: 'Optimize maintenance scheduling with cost-benefit analysis and resource allocation.'
    },
    {
      method: 'POST',
      path: '/api/v1/industry/manufacturing/supply-chain',
      description: 'Forecast energy consumption with cost optimization and industrial calendar integration.'
    },
    {
      method: 'GET',
      path: '/api/v1/industry/manufacturing/iot-dashboard',
      description: 'Get real-time manufacturing dashboard with live KPIs, alerts, and performance metrics.'
    },
    {
      method: 'POST',
      path: '/api/v1/industry/manufacturing/supply-chain',
      description: 'Process batch CSV sensor data uploads for multiple equipment analysis.'
    }
  ];

  return (
    <ApiLayout
      title="Manufacturing Forecasting Engine"
      description="Advanced time-series ML forecasting for manufacturing operations. Transform messy sensor data into actionable predictions with LSTM/GRU networks, Facebook Prophet, ARIMA/SARIMA, and ensemble methods."
      icon={CogIcon}
      endpoints={endpoints}
    >
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manufacturing Forecasting Engine Overview</h2>
          <div className="prose prose-sm max-w-none">
            <p>
              Our Manufacturing Forecasting Engine transforms <strong>messy sensor data into ML-ready predictions</strong>
              using advanced time-series models. Built for Industry 4.0 applications with enterprise-grade accuracy
              and real-time processing capabilities.
            </p>

            <h3>Advanced ML Models</h3>
            <ul>
              <li><strong>LSTM/GRU Networks:</strong> Deep learning for complex equipment failure patterns</li>
              <li><strong>Facebook Prophet:</strong> Robust forecasting with seasonal pattern recognition</li>
              <li><strong>ARIMA/SARIMA:</strong> Statistical methods for stable process parameters</li>
              <li><strong>Ensemble Methods:</strong> Combined models for critical business decisions</li>
              <li><strong>Transformer Models:</strong> Advanced sequence modeling for long-term patterns</li>
            </ul>

            <h3>Key Features</h3>
            <ul>
              <li><strong>Multi-sensor data fusion</strong> from different equipment types</li>
              <li><strong>1-30 day prediction horizons</strong> with confidence intervals</li>
              <li><strong>Real-time anomaly detection</strong> and alerting</li>
              <li><strong>Cost-benefit analysis</strong> for maintenance decisions</li>
              <li><strong>Manufacturing context integration</strong> (shifts, holidays, maintenance schedules)</li>
              <li><strong>Batch processing</strong> for CSV sensor data uploads</li>
            </ul>

            <h3>Business Intelligence</h3>
            <ul>
              <li><strong>ROI analysis</strong> for preventive vs reactive maintenance</li>
              <li><strong>Resource allocation optimization</strong></li>
              <li><strong>Compliance tracking</strong> for quality standards</li>
              <li><strong>Energy cost optimization</strong> with pricing schedules</li>
              <li><strong>Real-time dashboards</strong> with KPIs and performance metrics</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <CogIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Equipment Health</h3>
            <p className="text-sm text-gray-600">
              Predict equipment failures 1-30 days in advance with multi-sensor data fusion and LSTM networks.
            </p>
          </div>

          <div className="bg-green-50 p-6 rounded-lg">
            <ChartBarIcon className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Production Forecasting</h3>
            <p className="text-sm text-gray-600">
              Forecast production demand with seasonal patterns using Facebook Prophet and capacity planning.
            </p>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg">
            <BoltIcon className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Real-time Processing</h3>
            <p className="text-sm text-gray-600">
              Process streaming sensor data with real-time dashboards, alerts, and anomaly detection.
            </p>
          </div>
        </div>
      </div>
    </ApiLayout>
  )
}
