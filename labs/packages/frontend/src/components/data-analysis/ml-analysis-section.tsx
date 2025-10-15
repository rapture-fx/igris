'use client'

import { useMLAnalysis, useMLServiceStatus } from "@/hooks/useAPIData"
import { useState } from "react"
import { DataProcessingResponse } from '@/lib/api-service'
import { Brain, Shield } from "lucide-react"

interface ProcessedDataset {
    id: string
    name: string
    analysis: DataProcessingResponse
    uploadedAt: string
  }

export const MLAnalysisSection = ({ 
    dataset 
  }: { 
    dataset: ProcessedDataset 
  }) => {
    const { runAnalysis, analyzing, error } = useMLAnalysis()
    const { data: mlStatus } = useMLServiceStatus()
    const [analysisResults, setAnalysisResults] = useState<any>(null)
  
    const handleRunAnalysis = async (analysisType: 'anomaly_detection' | 'sentiment_analysis') => {
      try {
        // Convert the dataset analysis to format expected by ML service
        const data = Object.entries(dataset.analysis.data_types).map(([column, info]) => ({
          column,
          ...info
        }))
  
        const results = await runAnalysis(analysisType, data)
        setAnalysisResults(results)
      } catch (e) {
        // Error is already handled by the hook, but we can log it here if needed
        console.error(`Failed to run ${analysisType}`, e)
      }
    }
  
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
            <Brain className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-800">Machine Learning Insights</h3>
        </div>
        
        {mlStatus?.status !== 'running' ? (
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="font-semibold text-yellow-800">ML Service is not available</p>
            <p className="text-sm text-yellow-700">{mlStatus?.message}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Run advanced analysis on your processed data. This may take a few minutes.
            </p>
            <div className="flex space-x-4">
              <button 
                onClick={() => handleRunAnalysis('anomaly_detection')}
                disabled={analyzing}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300"
              >
                <Shield className="w-4 h-4 mr-2" />
                Detect Anomalies
              </button>
              <button 
                onClick={() => handleRunAnalysis('sentiment_analysis')}
                disabled={analyzing}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
              >
                <Brain className="w-4 h-4 mr-2" />
                Analyze Sentiment
              </button>
            </div>
            {analyzing && <p className="text-sm text-center text-gray-500">Analyzing...</p>}
            {error && <p className="text-sm text-center text-red-500">{error}</p>}
          </div>
        )}
        
        {analysisResults && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-2">Analysis Results:</h4>
            <pre className="text-xs bg-gray-900 text-white p-4 rounded-md overflow-x-auto">
              {JSON.stringify(analysisResults, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  } 