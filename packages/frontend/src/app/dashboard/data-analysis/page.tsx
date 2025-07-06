'use client'

import { useState, useEffect } from 'react'
import { 
  Upload, 
  Database, 
  BarChart3, 
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Hash,
  Calendar,
  Type,
  RefreshCw,
  Download,
  Eye,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  KeyRound,
  CheckCircle,
  Unlink,
  CalendarClock,
  User,
  Replace,
  Split,
  MapPin,
  PackageSearch,
  BarChartHorizontalBig,
  Binary,
  Zap,
  Settings,
  Brain,
  Shield
} from 'lucide-react'
import { FileUpload } from '@/components/upload/FileUpload'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { 
  useDataProcessing, 
  useSupportedFrameworks, 
  useMLAnalysis,
  useMLServiceStatus,
  useInvestigations,
  useInvestigation
} from '@/hooks/useAPIData'
import { DataProcessingResponse } from '@/lib/api-service'

interface ProcessedDataset {
  id: string
  name: string
  analysis: DataProcessingResponse
  uploadedAt: string
}

const ProcessingModeSelector = ({ 
  value, 
  onChange 
}: { 
  value: string, 
  onChange: (mode: string) => void 
}) => {
  const modes = [
    { id: 'fast', name: 'Fast', description: 'Quick analysis for immediate insights', icon: <Zap className="w-4 h-4" /> },
    { id: 'standard', name: 'Standard', description: 'Balanced performance and analysis', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'ai_enhanced', name: 'AI Enhanced', description: 'Deep analysis with ML insights', icon: <Brain className="w-4 h-4" /> }
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Processing Mode</h3>
      <div className="grid grid-cols-3 gap-2">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              value === mode.id 
                ? 'border-blue-500 bg-blue-50 text-blue-900' 
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="flex items-center space-x-2 mb-1">
              {mode.icon}
              <span className="font-medium text-sm">{mode.name}</span>
            </div>
            <p className="text-xs text-gray-600">{mode.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

const FrameworkSelector = ({ 
  value, 
  onChange,
  frameworks 
}: { 
  value: string, 
  onChange: (framework: string) => void,
  frameworks: Record<string, any> | null
}) => {
  if (!frameworks) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Target Framework</h3>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
      >
        {Object.entries(frameworks).map(([key, framework]) => (
          <option key={key} value={key}>
            {framework.name} - {framework.description}
          </option>
        ))}
      </select>
    </div>
  )
}

const ColumnAnalysisCard = ({ 
  columnName, 
  columnData, 
  defaultOpen = false 
}: { 
  columnName: string, 
  columnData: any, 
  defaultOpen?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'number': return <Hash className="w-4 h-4 text-blue-600" />
      case 'date': return <Calendar className="w-4 h-4 text-green-600" />
      case 'email': return <Type className="w-4 h-4 text-purple-600" />
      case 'phone': return <Type className="w-4 h-4 text-orange-600" />
      default: return <Type className="w-4 h-4 text-gray-600" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'number': return 'bg-blue-100 text-blue-800'
      case 'date': return 'bg-green-100 text-green-800'
      case 'email': return 'bg-purple-100 text-purple-800'
      case 'phone': return 'bg-orange-100 text-orange-800'
      case 'string': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSuggestionIcon = (suggestion: string) => {
    const iconProps = { className: "w-3.5 h-3.5 mr-1.5" };
    switch (suggestion) {
      case 'Use as primary key': return <KeyRound {...iconProps} />;
      case 'Validate format': return <CheckCircle {...iconProps} />;
      case 'Extract domain': return <Unlink {...iconProps} />;
      case 'Parse to datetime': return <CalendarClock {...iconProps} />;
      case 'Calculate age': return <User {...iconProps} />;
      case 'Standardize format': return <Replace {...iconProps} />;
      case 'Split into components': return <Split {...iconProps} />;
      case 'Geocode': return <MapPin {...iconProps} />;
      case 'Lookup product details': return <PackageSearch {...iconProps} />;
      case 'Handle outliers': return <BarChartHorizontalBig {...iconProps} />;
      case 'Convert to float': return <Binary {...iconProps} />;
      default: return null;
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg transition-all duration-300">
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          {getTypeIcon(columnData.type)}
          <h4 className="font-semibold text-gray-800">{columnName}</h4>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(columnData.type)}`}>
            {columnData.type}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            {columnData.confidence}% confidence
          </span>
          <ChevronDown className={cn('w-5 h-5 text-gray-400 transform transition-transform duration-300', isOpen && 'rotate-180')} />
        </div>
      </div>
      {isOpen && (
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 text-sm">
            <div>
              <p className="text-gray-500">Null Values</p>
              <p className="font-semibold text-gray-800">{columnData.null_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Unique Values</p>
              <p className="font-semibold text-gray-800">{columnData.unique_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Sample Values</p>
              <p className="font-mono text-xs text-gray-600 truncate">{columnData.sample_values.join(', ')}</p>
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Suggested Transformations:</p>
            <div className="flex flex-wrap gap-2">
              {columnData.suggested_transformations.map((suggestion: string, idx: number) => (
                <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {getSuggestionIcon(suggestion)}
                  {suggestion}
                </span>
              ))}
              {columnData.suggested_transformations.length === 0 && (
                <span className="text-sm text-gray-500">None</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const MLAnalysisSection = ({ 
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
      
      const result = await runAnalysis(data, analysisType)
      setAnalysisResults(result)
    } catch (err) {
      console.error('ML Analysis failed:', err)
    }
  }

  if (!mlStatus?.ml_available) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800 font-medium">ML Service Unavailable</span>
        </div>
        <p className="text-yellow-700 text-sm mt-1">Advanced ML analysis is currently not available.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
          <div>
          <h3 className="text-lg font-semibold text-gray-800">Advanced ML Analysis</h3>
          <p className="text-sm text-gray-500">Run AI-powered analysis on your data</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>ML Service Online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => handleRunAnalysis('anomaly_detection')}
          disabled={analyzing}
          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-800">Anomaly Detection</h4>
              <p className="text-sm text-gray-600">Identify unusual patterns in your data</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => handleRunAnalysis('sentiment_analysis')}
          disabled={analyzing}
          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Brain className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-800">Sentiment Analysis</h4>
              <p className="text-sm text-gray-600">Analyze sentiment in text data</p>
            </div>
          </div>
        </button>
      </div>

      {analyzing && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Running ML analysis...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">Analysis Failed</span>
          </div>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {analysisResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Analysis Results</h4>
          <pre className="text-xs text-blue-700 overflow-auto">
            {JSON.stringify(analysisResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function DataAnalysisPage() {
  const [processedFileAnalyses, setProcessedFileAnalyses] = useState<Record<string, ProcessedDataset>>({})
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [processingMode, setProcessingMode] = useState('standard')
  const [targetFramework, setTargetFramework] = useState('pandas')

  const { processFile, processing } = useDataProcessing()
  const { data: frameworks } = useSupportedFrameworks()
  const { data: investigations, refetch: refetchInvestigations } = useInvestigations()
  
  const { data: selectedInvestigationDetails, isLoading: isLoadingDetails } = useInvestigation(selectedInvestigationId)

  const handleFileProcessing = async (file: File) => {
    try {
      const result = await processFile(file, {
        processing_mode: processingMode,
        target_framework: targetFramework
      })

      const newDataset: ProcessedDataset = {
        id: `processed_${Date.now()}`, // Temporary ID
        name: result.original_filename,
        analysis: result,
        uploadedAt: new Date().toISOString()
      }

      // We add the full analysis result to our client-side cache
      setProcessedFileAnalyses(prev => ({ ...prev, [newDataset.id]: newDataset }))
      
      // We refetch the list of investigations to get the real ID from the backend
      await refetchInvestigations()

      // The user should see the new item in the list, and we can select it
      // A follow-up improvement would be to find the new investigation and select it.
      setShowUpload(false)
      
    } catch (error) {
      console.error('File processing failed:', error)
    }
  }

  const selectedDataset = selectedInvestigationId 
    ? (processedFileAnalyses[selectedInvestigationId] || (selectedInvestigationDetails ? {
        id: selectedInvestigationDetails.id,
        name: selectedInvestigationDetails.name,
        analysis: selectedInvestigationDetails.analysis_results, // Assuming this is the structure
        uploadedAt: selectedInvestigationDetails.created_at
      } : null))
    : null;

  useEffect(() => {
    // When investigations are loaded, if nothing is selected, select the first one.
    if (!selectedInvestigationId && investigations && investigations.length > 0) {
      setSelectedInvestigationId(investigations[0].id)
    }
  }, [investigations, selectedInvestigationId])

  if (processing || (selectedInvestigationId && isLoadingDetails)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Processing your data with {processingMode} mode...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Data Analysis"
        description="Explore datasets with AI-powered analysis and data type detection."
      >
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-sm hover:shadow-lg transition-all transform hover:scale-105"
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload & Analyze Dataset
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 space-y-4">
          {/* Processing Configuration */}
          <ProcessingModeSelector value={processingMode} onChange={setProcessingMode} />
          <FrameworkSelector value={targetFramework} onChange={setTargetFramework} frameworks={frameworks} />
          
          {/* Dataset List */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 px-2">Processed Datasets</h2>
            <div className="space-y-1">
              {investigations?.map((dataset) => (
                <div
                  key={dataset.id}
                  onClick={() => setSelectedInvestigationId(dataset.id)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-all duration-200 flex justify-between items-center border-l-4',
                    selectedInvestigationId === dataset.id 
                      ? 'bg-blue-50 border-blue-600' 
                      : 'border-transparent hover:bg-gray-100'
                  )}
                >
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{dataset.name}</h3>
                    <div className="text-xs text-gray-500 mt-1">
                      {dataset.total_records?.toLocaleString()} rows
                      {dataset.quality_score && dataset.quality_score > 80 && (
                        <span className="ml-2 inline-flex items-center">
                          <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                          AI Ready
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedInvestigationId === dataset.id && <ChevronRight className="w-5 h-5 text-blue-600" />}
                </div>
              ))}
              {(!investigations || investigations.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No datasets yet</p>
                  <p className="text-xs">Upload a file to get started</p>
                </div>
              )}
            </div>
            </div>
          </div>

        <div className="lg:col-span-3">
            {selectedDataset ? (
            <div className="space-y-8">
              {/* Dataset Overview */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
              <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedDataset.name}</h2>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedDataset.analysis.ready_for_ai 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedDataset.analysis.ready_for_ai ? 'AI Ready' : 'Needs Cleaning'}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {selectedDataset.analysis.mode.charAt(0).toUpperCase() + selectedDataset.analysis.mode.slice(1)} Mode
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                      <Eye className="w-4 h-4 mr-1.5" />
                      View Data
                    </button>
                    <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                      <Download className="w-4 h-4 mr-1.5" />
                      Export
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Rows</p>
                    <p className="text-2xl font-bold text-gray-800">{selectedDataset.analysis.basic_stats.total_rows.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Columns</p>
                    <p className="text-2xl font-bold text-gray-800">{selectedDataset.analysis.basic_stats.total_columns || Object.keys(selectedDataset.analysis.data_types).length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Anomalies</p>
                    <p className="text-2xl font-bold text-orange-600">{selectedDataset.analysis.basic_stats.anomalies_detected}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quality Score</p>
                    <p className="text-2xl font-bold text-green-600">{selectedDataset.analysis.data_quality_score}%</p>
                  </div>
                  </div>
                </div>

                {/* Column Analysis */}
              {Object.keys(selectedDataset.analysis.data_types).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">Column Analysis</h3>
                    <p className="text-sm text-gray-500 mt-1">AI-powered data type detection and quality suggestions for each column.</p>
                  </div>
                  <div className="p-4 space-y-2">
                    {Object.entries(selectedDataset.analysis.data_types).map(([columnName, columnData], index) => (
                      <ColumnAnalysisCard 
                        key={columnName} 
                        columnName={columnName} 
                        columnData={columnData} 
                        defaultOpen={index === 0} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ML Analysis Section */}
              <MLAnalysisSection dataset={selectedDataset} />
              </div>
            ) : (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Eye className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Dataset</h3>
              <p className="text-gray-600">Choose a dataset from the left panel to view its AI-powered analysis.</p>
              </div>
            )}
        </div>
      </div>
      
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Upload & Process Dataset</h2>
              <button 
                onClick={() => setShowUpload(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <ProcessingModeSelector value={processingMode} onChange={setProcessingMode} />
            <FrameworkSelector value={targetFramework} onChange={setTargetFramework} frameworks={frameworks} />
            
            <FileUpload 
              onUploadComplete={(file) => {
                if (file instanceof File) {
                  handleFileProcessing(file)
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
} 