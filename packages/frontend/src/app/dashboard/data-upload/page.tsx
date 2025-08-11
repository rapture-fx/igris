"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnhancedDataUpload } from '@/components/upload/EnhancedDataUpload'
import { AlertCircle, CheckCircle, Clock, Database, Globe, Upload, Zap, Brain, BarChart3, TrendingUp } from 'lucide-react'

export default function DataUploadPage() {
  const [uploadedPipelines, setUploadedPipelines] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadComplete = (pipelineId: string) => {
    setUploadedPipelines(prev => [...prev, pipelineId])
    setIsUploading(false)
  }

  const handleUploadStart = () => {
    setIsUploading(true)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Enhanced Data Upload
          </h1>
          <p className="text-lg text-gray-600">
            Upload files, connect to databases, or import from APIs with AI-powered data preparation
          </p>
        </div>

        {/* Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5 text-blue-500" />
                File Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Drag and drop files with support for multiple formats
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">CSV</Badge>
                <Badge variant="secondary">JSON</Badge>
                <Badge variant="secondary">Excel</Badge>
                <Badge variant="secondary">Parquet</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-green-500" />
                Database Import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Connect to various databases with connection testing
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">PostgreSQL</Badge>
                <Badge variant="secondary">MySQL</Badge>
                <Badge variant="secondary">MongoDB</Badge>
                <Badge variant="secondary">Snowflake</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-purple-500" />
                API Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Import data from REST APIs with authentication
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Basic Auth</Badge>
                <Badge variant="secondary">Bearer Token</Badge>
                <Badge variant="secondary">API Key</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ML Preparation Features */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-500" />
              AI-Powered Data Preparation
            </CardTitle>
            <CardDescription>
              Automatically prepare your data for machine learning with advanced preprocessing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Automated Processing
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Data quality assessment
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Missing value handling
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Outlier detection
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Feature engineering
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  ML Framework Support
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    TensorFlow & PyTorch
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    scikit-learn ready
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    XGBoost & LightGBM
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Hugging Face compatible
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Component */}
        <EnhancedDataUpload
          onUploadComplete={handleUploadComplete}
          onUploadStart={handleUploadStart}
          workspaceId="demo-workspace"
          className="mb-8"
        />

        {/* Upload Status */}
        {isUploading && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 animate-spin" />
                Processing Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Your data is being uploaded and processed. This may take a few minutes depending on file size and complexity.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recent Uploads */}
        {uploadedPipelines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Recent ML Preparation Pipelines
              </CardTitle>
              <CardDescription>
                Your uploaded data has been processed and is ready for ML workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedPipelines.map((pipelineId, index) => (
                  <div key={pipelineId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Pipeline #{index + 1}
                        </p>
                        <p className="text-sm text-gray-500">
                          ID: {pipelineId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Ready</Badge>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Getting Started */}
        {uploadedPipelines.length === 0 && !isUploading && (
          <Card className="border-dashed border-2 border-gray-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  Upload your first dataset to get started with AI-powered data preparation
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="outline">✅ 1-click upload</Badge>
                  <Badge variant="outline">🔍 Automatic quality checks</Badge>
                  <Badge variant="outline">🤖 AI-powered cleaning</Badge>
                  <Badge variant="outline">📊 ML-ready output</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 