"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Brain, 
  Zap, 
  Target, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  Stop,
  Settings,
  Download,
  Upload,
  Trash2,
  Copy,
  Eye,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Database,
  FileText,
  Users,
  Shield,
  Cpu,
  MemoryStick,
  HardDrive,
  Globe,
  Layers,
  GitBranch,
  Calendar,
  Filter,
  Search,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react'

interface MLModel {
  id: string
  name: string
  type: 'anomaly_detection' | 'classification' | 'regression' | 'clustering'
  status: 'training' | 'completed' | 'failed' | 'deployed' | 'paused'
  accuracy?: number
  precision?: number
  recall?: number
  f1Score?: number
  trainingData: string
  features: string[]
  targetColumn?: string
  algorithm: string
  createdAt: string
  lastTrained: string
  deployedAt?: string
  predictions: number
  modelSize: string
  version: string
  environment: 'development' | 'staging' | 'production'
  owner: string
  description: string
}

interface TrainingJob {
  id: string
  modelId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  startTime: string
  endTime?: string
  metrics?: Record<string, number>
  logs: string[]
  duration?: string
  resources: {
    cpu: string
    memory: string
    gpu?: string
  }
}

interface ModelPrediction {
  id: string
  modelId: string
  inputData: Record<string, any>
  prediction: any
  confidence?: number
  timestamp: string
  executionTime: number
}

const SAMPLE_MODELS: MLModel[] = [
  {
    id: 'model-1',
    name: 'Customer Churn Predictor',
    type: 'classification',
    status: 'deployed',
    accuracy: 0.89,
    precision: 0.87,
    recall: 0.91,
    f1Score: 0.89,
    trainingData: 'customer_data_v3.csv',
    features: ['age', 'tenure', 'monthly_charges', 'total_charges', 'contract_type'],
    targetColumn: 'churn',
    algorithm: 'Random Forest',
    createdAt: '2024-01-15T10:30:00Z',
    lastTrained: '2024-01-20T14:22:00Z',
    deployedAt: '2024-01-21T09:15:00Z',
    predictions: 15847,
    modelSize: '24.5 MB',
    version: 'v1.3',
    environment: 'production',
    owner: 'data-team@company.com',
    description: 'Predicts customer churn probability based on usage patterns and demographics'
  },
  {
    id: 'model-2',
    name: 'Quality Anomaly Detector',
    type: 'anomaly_detection',
    status: 'training',
    trainingData: 'manufacturing_data.parquet',
    features: ['temperature', 'pressure', 'humidity', 'speed', 'vibration'],
    algorithm: 'Isolation Forest',
    createdAt: '2024-01-22T08:45:00Z',
    lastTrained: '2024-01-22T08:45:00Z',
    predictions: 0,
    modelSize: 'Estimating...',
    version: 'v1.0',
    environment: 'development',
    owner: 'ml-engineers@company.com',
    description: 'Detects anomalies in manufacturing sensor data for quality control'
  },
  {
    id: 'model-3',
    name: 'Revenue Forecaster',
    type: 'regression',
    status: 'completed',
    accuracy: 0.94,
    trainingData: 'sales_history.json',
    features: ['month', 'marketing_spend', 'seasonality', 'economic_index'],
    targetColumn: 'revenue',
    algorithm: 'XGBoost',
    createdAt: '2024-01-18T16:20:00Z',
    lastTrained: '2024-01-20T11:30:00Z',
    predictions: 156,
    modelSize: '18.2 MB',
    version: 'v2.1',
    environment: 'staging',
    owner: 'analytics@company.com',
    description: 'Forecasts monthly revenue based on historical data and market indicators'
  }
]

const SAMPLE_TRAINING_JOBS: TrainingJob[] = [
  {
    id: 'job-1',
    modelId: 'model-2',
    status: 'running',
    progress: 65,
    startTime: '2024-01-22T09:15:00Z',
    logs: [
      '09:15:00 - Starting training job...',
      '09:15:02 - Loading dataset: manufacturing_data.parquet',
      '09:15:05 - Dataset loaded: 125,430 records',
      '09:15:06 - Preprocessing data...',
      '09:16:12 - Feature engineering complete',
      '09:16:15 - Training Isolation Forest model...',
      '09:18:30 - Epoch 1/10 complete - Anomaly rate: 2.3%',
      '09:20:45 - Epoch 2/10 complete - Anomaly rate: 2.1%',
      '09:23:15 - Epoch 3/10 complete - Anomaly rate: 2.0%'
    ],
    resources: {
      cpu: '4 cores',
      memory: '16 GB',
      gpu: 'NVIDIA V100'
    }
  }
]

const MLModelManager: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>(SAMPLE_MODELS)
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>(SAMPLE_TRAINING_JOBS)
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null)
  const [showModelDialog, setShowModelDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Filter models based on search and filters
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || model.status === statusFilter
    const matchesType = typeFilter === 'all' || model.type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'training': return <Clock className="h-4 w-4 text-blue-500" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'deployed': return <Globe className="h-4 w-4 text-purple-500" />
      case 'paused': return <Pause className="h-4 w-4 text-yellow-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'training': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'deployed': return 'bg-purple-100 text-purple-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'anomaly_detection': return <AlertTriangle className="h-4 w-4" />
      case 'classification': return <Target className="h-4 w-4" />
      case 'regression': return <TrendingUp className="h-4 w-4" />
      case 'clustering': return <Layers className="h-4 w-4" />
      default: return <Brain className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const ModelDetailsDialog = ({ model }: { model: MLModel }) => (
    <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTypeIcon(model.type)}
            {model.name}
            <Badge className={getStatusColor(model.status)}>
              {model.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>{model.description}</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Model Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Type:</span>
                    <span className="text-sm font-medium">{model.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Algorithm:</span>
                    <span className="text-sm font-medium">{model.algorithm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Version:</span>
                    <span className="text-sm font-medium">{model.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Size:</span>
                    <span className="text-sm font-medium">{model.modelSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Environment:</span>
                    <Badge variant="outline">{model.environment}</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Training Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dataset:</span>
                    <span className="text-sm font-medium">{model.trainingData}</span>
                  </div>
                  {model.targetColumn && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Target:</span>
                      <span className="text-sm font-medium">{model.targetColumn}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-600">Features ({model.features.length}):</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {model.features.slice(0, 6).map(feature => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {model.features.length > 6 && (
                        <Badge variant="secondary" className="text-xs">
                          +{model.features.length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-gray-500">{formatDate(model.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Brain className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Last Trained</p>
                    <p className="text-xs text-gray-500">{formatDate(model.lastTrained)}</p>
                  </div>
                </div>
                {model.deployedAt && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">Deployed</p>
                      <p className="text-xs text-gray-500">{formatDate(model.deployedAt)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance" className="space-y-4">
            {model.accuracy && (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Model Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Accuracy</span>
                        <span className="text-sm font-medium">{(model.accuracy * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={model.accuracy * 100} className="h-2" />
                    </div>
                    {model.precision && (
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Precision</span>
                          <span className="text-sm font-medium">{(model.precision * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={model.precision * 100} className="h-2" />
                      </div>
                    )}
                    {model.recall && (
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Recall</span>
                          <span className="text-sm font-medium">{(model.recall * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={model.recall * 100} className="h-2" />
                      </div>
                    )}
                    {model.f1Score && (
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">F1 Score</span>
                          <span className="text-sm font-medium">{(model.f1Score * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={model.f1Score * 100} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Usage Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Predictions:</span>
                      <span className="text-sm font-medium">{model.predictions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Response Time:</span>
                      <span className="text-sm font-medium">245ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Success Rate:</span>
                      <span className="text-sm font-medium">99.7%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Daily Requests:</span>
                      <span className="text-sm font-medium">1,247</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="predictions" className="space-y-4">
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h4 className="font-medium text-gray-900 mb-2">Prediction History</h4>
              <p className="text-gray-500 mb-4">
                View recent predictions and their confidence scores
              </p>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View Predictions
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="training" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Training History</h4>
                <Button size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Retrain Model
                </Button>
              </div>
              
              {trainingJobs.filter(job => job.modelId === model.id).map(job => (
                <Card key={job.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Started: {formatDate(job.startTime)}
                        </span>
                      </div>
                      {job.status === 'running' && (
                        <Button variant="outline" size="sm">
                          <Stop className="h-4 w-4 mr-2" />
                          Stop
                        </Button>
                      )}
                    </div>
                    
                    {job.status === 'running' && (
                      <div className="mb-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Progress</span>
                          <span className="text-sm font-medium">{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="h-2" />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">CPU:</span>
                        <span className="ml-2 font-medium">{job.resources.cpu}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Memory:</span>
                        <span className="ml-2 font-medium">{job.resources.memory}</span>
                      </div>
                      {job.resources.gpu && (
                        <div>
                          <span className="text-gray-600">GPU:</span>
                          <span className="ml-2 font-medium">{job.resources.gpu}</span>
                        </div>
                      )}
                    </div>
                    
                    <details className="mt-4">
                      <summary className="text-sm font-medium cursor-pointer text-blue-600">
                        View Training Logs
                      </summary>
                      <ScrollArea className="h-32 mt-2 p-3 bg-gray-50 rounded text-xs font-mono">
                        {job.logs.map((log, index) => (
                          <div key={index} className="text-gray-700">
                            {log}
                          </div>
                        ))}
                      </ScrollArea>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="deployment" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Deployment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(model.status)}
                      <span className="font-medium capitalize">{model.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Environment:</span>
                      <Badge variant="outline">{model.environment}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Endpoint:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        /api/v1/ml/predict/{model.id}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" size="sm">
                    <Globe className="h-4 w-4 mr-2" />
                    Deploy to Production
                  </Button>
                  <Button variant="outline" className="w-full" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Model
                  </Button>
                  <Button variant="outline" className="w-full" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Clone Model
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ML Model Manager</h2>
          <p className="text-gray-600">Train, deploy, and manage custom machine learning models</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Model
          </Button>
          <Button>
            <Brain className="h-4 w-4 mr-2" />
            Train New Model
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{models.length}</p>
                <p className="text-gray-600 text-sm">Total Models</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {models.filter(m => m.status === 'deployed').length}
                </p>
                <p className="text-gray-600 text-sm">Deployed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {models.filter(m => m.status === 'training').length}
                </p>
                <p className="text-gray-600 text-sm">Training</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {models.reduce((sum, m) => sum + m.predictions, 0).toLocaleString()}
                </p>
                <p className="text-gray-600 text-sm">Total Predictions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="deployed">Deployed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="anomaly_detection">Anomaly Detection</SelectItem>
                <SelectItem value="classification">Classification</SelectItem>
                <SelectItem value="regression">Regression</SelectItem>
                <SelectItem value="clustering">Clustering</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredModels.map(model => (
          <Card key={model.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(model.type)}
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Badge className={getStatusColor(model.status)}>
                    {model.status}
                  </Badge>
                </div>
              </div>
              <CardDescription className="line-clamp-2">
                {model.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Algorithm:</span>
                  <p className="font-medium">{model.algorithm}</p>
                </div>
                <div>
                  <span className="text-gray-600">Version:</span>
                  <p className="font-medium">{model.version}</p>
                </div>
                <div>
                  <span className="text-gray-600">Environment:</span>
                  <Badge variant="outline" className="text-xs">
                    {model.environment}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-600">Predictions:</span>
                  <p className="font-medium">{model.predictions.toLocaleString()}</p>
                </div>
              </div>
              
              {model.accuracy && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Accuracy</span>
                    <span className="text-sm font-medium">{(model.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={model.accuracy * 100} className="h-2" />
                </div>
              )}
              
              <div className="flex items-center gap-2 pt-2">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedModel(model)
                    setShowModelDialog(true)
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Training Jobs */}
      {trainingJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Training Jobs
            </CardTitle>
            <CardDescription>
              Monitor real-time training progress and resource usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trainingJobs.map(job => {
                const model = models.find(m => m.id === job.modelId)
                return (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{model?.name}</h4>
                        <p className="text-sm text-gray-600">Started {formatDate(job.startTime)}</p>
                      </div>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                    
                    {job.status === 'running' && (
                      <div className="mb-3">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Progress</span>
                          <span className="text-sm font-medium">{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="h-2" />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-4 w-4" />
                        {job.resources.cpu}
                      </span>
                      <span className="flex items-center gap-1">
                        <MemoryStick className="h-4 w-4" />
                        {job.resources.memory}
                      </span>
                      {job.resources.gpu && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-4 w-4" />
                          {job.resources.gpu}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model Details Dialog */}
      {selectedModel && <ModelDetailsDialog model={selectedModel} />}
    </div>
  )
}

export default MLModelManager 