'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Activity, 
  BarChart3, 
  Database, 
  Upload, 
  Download, 
  Settings, 
  User, 
  HelpCircle,
  LogOut,
  Home,
  Workflow,
  FileText,
  Zap,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Terminal,
  RefreshCw,
  Menu,
  X,
  Bell,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  Globe,
  Shield,
  Info,
  ExternalLink,
  ChevronRight,
  CreditCard,
  DollarSign,
  Search
} from 'lucide-react'

interface JobStatus {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  progress: number
  startTime: string
  duration: string
  endpoint: string
}

interface DataQualityMetric {
  name: string
  value: number
  threshold: number
  status: 'good' | 'warning' | 'critical'
  description: string
}

interface ApiEndpoint {
  method: string
  path: string
  status: number
  avgResponseTime: number
  requestCount: number
  lastCall: string
}

interface Notification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
  message: string
  time: string
  read: boolean
}

interface SystemStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  responseTime: number
}

interface RecentActivity {
  id: string
  action: string
  user: string
  time: string
  details: string
}

interface BillingUsage {
  period: string
  apiCalls: number
  dataProcessed: number
  mlInferences: number
  currentCost: number
  limit: number
  percentUsed: number
}

export default function UserDashboard() {
  const router = useRouter()
  const [activeJobs, setActiveJobs] = useState<JobStatus[]>([])
  const [dataQuality, setDataQuality] = useState<DataQualityMetric[]>([])
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setShowSearchModal(true)
      }
      if (event.key === 'Escape') {
        setShowSearchModal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    // Mock data - replace with actual API calls
    setActiveJobs([
      {
        id: '1',
        name: 'Data Preprocessing Pipeline',
        status: 'running',
        progress: 68,
        startTime: '2024-01-15T10:30:00Z',
        duration: '2m 34s',
        endpoint: '/api/v1/data/preprocess'
      },
      {
        id: '2',
        name: 'Auto-labeling Classification',
        status: 'completed',
        progress: 100,
        startTime: '2024-01-15T10:15:00Z',
        duration: '1m 45s',
        endpoint: '/api/v1/ml/auto-label'
      },
      {
        id: '3',
        name: 'Data Quality Analysis',
        status: 'queued',
        progress: 0,
        startTime: '',
        duration: '',
        endpoint: '/api/v1/data/quality'
      }
    ])

    setDataQuality([
      {
        name: 'Missing Values',
        value: 5.2,
        threshold: 10,
        status: 'good',
        description: 'Percentage of missing values across all columns'
      },
      {
        name: 'Duplicate Records',
        value: 12.8,
        threshold: 15,
        status: 'warning',
        description: 'Percentage of duplicate records detected'
      },
      {
        name: 'Data Consistency',
        value: 94.5,
        threshold: 90,
        status: 'good',
        description: 'Overall data consistency score'
      }
    ])

    setApiEndpoints([
      {
        method: 'POST',
        path: '/api/v1/data/upload',
        status: 200,
        avgResponseTime: 245,
        requestCount: 1247,
        lastCall: '2 minutes ago'
      },
      {
        method: 'GET',
        path: '/api/v1/data/status',
        status: 200,
        avgResponseTime: 45,
        requestCount: 3892,
        lastCall: '30 seconds ago'
      }
    ])

    setNotifications([
      {
        id: '1',
        type: 'success',
        title: 'Data Transformation Complete',
        message: 'customer_data.csv processed: 98.5% quality score, 3 anomalies detected',
        time: '2 min ago',
        read: false
      },
      {
        id: '2',
        type: 'warning',
        title: 'API Rate Limit Alert',
        message: 'Approaching rate limit: 850/1000 requests/hour used',
        time: '1 hour ago',
        read: false
      },
      {
        id: '3',
        type: 'info',
        title: 'New Python SDK v2.1',
        message: 'Added async support and batch processing. pip install schlep-engine --upgrade',
        time: '3 hours ago',
        read: true
      },
      {
        id: '4',
        type: 'error',
        title: 'Pipeline Validation Failed',
        message: 'Schema mismatch in step 3: expected "timestamp" column missing',
        time: '5 hours ago',
        read: true
      }
    ])

    setSystemStatus([
      {
        name: 'Data Processing API',
        status: 'operational',
        responseTime: 245
      },
      {
        name: 'ML Inference Engine',
        status: 'operational',
        responseTime: 1240
      },
      {
        name: 'Auto-labeling Service',
        status: 'operational',
        responseTime: 85
      },
      {
        name: 'Quality Analysis API',
        status: 'degraded',
        responseTime: 450
      }
    ])

    setRecentActivity([
      {
        id: '1',
        action: 'processed dataset via API',
        user: 'You',
        time: '5 min ago',
        details: 'customer_data.csv → 98.5% quality score'
      },
      {
        id: '2',
        action: 'deployed auto-labeling model',
        user: 'System',
        time: '1 hour ago',
        details: 'v2.1 with 94.2% accuracy'
      },
      {
        id: '3',
        action: 'executed batch processing job',
        user: 'Pipeline',
        time: '2 hours ago',
        details: 'Job #1247 → 150K records processed'
      },
      {
        id: '4',
        action: 'detected schema anomalies',
        user: 'Quality Checker',
        time: '3 hours ago',
        details: '3 validation errors in timestamp column'
      }
    ])

    setBillingUsage({
      period: 'January 2024',
      apiCalls: 4247,
      dataProcessed: 2.3,
      mlInferences: 1834,
      currentCost: 89.47,
      limit: 1000,
      percentUsed: 42.5
    })
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'queued':
        return <Clock className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const refreshData = async () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-400 bg-green-900/20'
      case 'degraded':
        return 'text-yellow-400 bg-yellow-900/20'
      case 'down':
        return 'text-red-400 bg-red-900/20'
      default:
        return 'text-gray-400 bg-gray-900/20'
    }
  }

  const [activeSection, setActiveSection] = useState('overview')

  const navigationSections = [
    {
      title: 'Dashboard',
      items: [
        { name: 'Overview', icon: Home, id: 'overview', active: activeSection === 'overview' }
      ]
    },
    {
      title: 'Data & Processing',
      items: [
        { name: 'Data Processing', icon: Database, id: 'data', active: activeSection === 'data' },
        { name: 'Pipeline Builder', icon: Workflow, id: 'pipelines', active: activeSection === 'pipelines' },
        { name: 'Data Explorer', icon: BarChart3, id: 'explorer', active: activeSection === 'explorer' },
        { name: 'Jobs & Monitoring', icon: Activity, id: 'jobs', active: activeSection === 'jobs' }
      ]
    },
    {
      title: 'Development',
      items: [
        { name: 'API Playground', icon: Terminal, id: 'api', active: activeSection === 'api' },
        { name: 'ML Models', icon: Zap, id: 'models', active: activeSection === 'models' },
        { name: 'SDK & CLI Tools', icon: FileText, id: 'tools', active: activeSection === 'tools' },
        { name: 'API Docs', icon: FileText, id: 'api-docs', active: activeSection === 'api-docs' }
      ]
    },
    {
      title: 'Account',
      items: [
        { name: 'Billing & Usage', icon: CreditCard, id: 'billing', active: activeSection === 'billing' }
      ]
    }
  ]

  // Dynamic imports for sections
  const DataProcessingSection = dynamic(() => import('./components/DataProcessingSection'), { ssr: false })
  const BillingSection = dynamic(() => import('./components/BillingSection'), { ssr: false })

  const renderContent = () => {
    switch (activeSection) {
      case 'data':
        return <DataProcessingSection />
      case 'billing':
        return <BillingSection />
      case 'pipelines':
        return (
          <div className="text-center py-12">
            <Workflow className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Pipeline Builder</h3>
            <p className="text-gray-400">Create and manage your data processing workflows</p>
          </div>
        )
      case 'explorer':
        return (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Data Explorer</h3>
            <p className="text-gray-400">Interactive data profiling and analysis</p>
          </div>
        )
      case 'jobs':
        return (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Jobs & Monitoring</h3>
            <p className="text-gray-400">Monitor and manage your data processing jobs</p>
          </div>
        )
      case 'api':
        return (
          <div className="text-center py-12">
            <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">API Playground</h3>
            <p className="text-gray-400">Test and explore Schlep Engine APIs interactively</p>
          </div>
        )
      case 'models':
        return (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">ML Models</h3>
            <p className="text-gray-400">Manage and deploy your machine learning models</p>
          </div>
        )
      case 'tools':
        return (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">SDK & CLI Tools</h3>
            <p className="text-gray-400">Developer tools and integrations for Schlep Engine</p>
          </div>
        )
      default:
        // Overview content (existing dashboard content)
        return (
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl p-6 hover:border-[#468BE6]/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-[#468BE6]/10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#468BE6]/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-2">Active Jobs</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                      {activeJobs.filter(job => job.status === 'running').length}
                    </p>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400">Running</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#468BE6] rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="relative bg-gradient-to-br from-[#468BE6] to-[#3a7bd5] rounded-xl p-3">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-2">API Calls (24h)</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                      5,373
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-green-400">+12.5%</span>
                      <span className="text-xs text-gray-500">vs yesterday</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="relative bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl p-6 hover:border-yellow-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-2">Avg Response</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                      245ms
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-yellow-400">Fast</span>
                      <span className="text-xs text-gray-500">{'< 500ms target'}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="relative bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-3">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-2">Data Quality</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                      92.3%
                    </p>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs text-emerald-400">Excellent</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 rounded-xl blur-lg opacity-20 transition-opacity duration-500"></div>
                    <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-3">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Active Jobs */}
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl overflow-hidden hover:border-[#468BE6]/30 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-[#468BE6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative p-6 border-b border-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Active Jobs
                      </h2>
                      <p className="text-gray-400 mt-1">Monitor your running pipelines</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#468BE6] rounded-lg blur-lg opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-[#468BE6]/20 to-[#468BE6]/10 rounded-lg p-2">
                        <Workflow className="w-5 h-5 text-[#468BE6]" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative p-6">
                  <div className="space-y-4">
                    {activeJobs.map((job) => (
                      <div key={job.id} className="group/job relative bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] border border-gray-800/50 rounded-lg p-4 hover:border-[#468BE6]/50 transition-all duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              {getStatusIcon(job.status)}
                              {job.status === 'running' && (
                                <div className="absolute inset-0 bg-blue-500 rounded-full blur-sm opacity-30 animate-pulse"></div>
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-white group-hover/job:text-[#468BE6] transition-colors">
                                {job.name}
                              </h3>
                              <p className="text-xs text-gray-400 font-mono">{job.endpoint}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-medium text-gray-300">{job.duration}</span>
                          </div>
                        </div>
                        {job.status === 'running' && (
                          <div className="relative">
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-[#468BE6] to-[#3a7bd5] h-2 rounded-full transition-all duration-500 relative overflow-hidden"
                                style={{ width: `${job.progress}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                              </div>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-gray-500">Progress</span>
                              <span className="text-xs font-medium text-[#468BE6]">{job.progress}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative p-6 border-b border-gray-800/50">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Quick Actions
                  </h2>
                  <p className="text-gray-400 mt-1">Get started with common tasks</p>
                </div>
                <div className="relative p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setActiveSection('data')}
                      className="group/action relative bg-gradient-to-br from-[#468BE6]/10 to-[#468BE6]/5 border border-[#468BE6]/20 rounded-xl p-4 hover:border-[#468BE6]/50 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-[#468BE6] rounded-lg blur-lg opacity-20 group-hover/action:opacity-40 transition-opacity duration-300"></div>
                        <div className="relative bg-gradient-to-br from-[#468BE6] to-[#3a7bd5] rounded-lg p-3 mb-3 w-fit">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">Upload Data</h3>
                      <p className="text-xs text-gray-400">Start a new project</p>
                    </button>
                    
                    <button 
                      onClick={() => setActiveSection('pipelines')}
                      className="group/action relative bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 hover:border-emerald-500/50 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 rounded-lg blur-lg opacity-20 group-hover/action:opacity-40 transition-opacity duration-300"></div>
                        <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-3 mb-3 w-fit">
                          <Workflow className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">New Pipeline</h3>
                      <p className="text-xs text-gray-400">Create workflow</p>
                    </button>

                    <button 
                      onClick={() => setActiveSection('explorer')}
                      className="group/action relative bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-purple-500 rounded-lg blur-lg opacity-20 group-hover/action:opacity-40 transition-opacity duration-300"></div>
                        <div className="relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 mb-3 w-fit">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">View Analytics</h3>
                      <p className="text-xs text-gray-400">Data insights</p>
                    </button>

                    <button 
                      onClick={() => setActiveSection('api')}
                      className="group/action relative bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 hover:border-yellow-500/50 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-yellow-500 rounded-lg blur-lg opacity-20 transition-opacity duration-300"></div>
                        <div className="relative bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-3 mb-3 w-fit">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">Documentation</h3>
                      <p className="text-xs text-gray-400">API reference</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing & Usage Section */}
            {billingUsage && (
              <div className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800/50 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative p-6 border-b border-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Billing & Usage
                      </h2>
                      <p className="text-gray-400 mt-1">Current billing period: {billingUsage.period}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500 rounded-lg blur-lg opacity-20"></div>
                      <div className="relative bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-lg p-2">
                        <DollarSign className="w-6 h-6 text-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {/* Current Cost */}
                    <div className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] border border-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-sm text-gray-400">Current Cost</span>
                      </div>
                      <p className="text-2xl font-bold text-white">${billingUsage.currentCost}</p>
                      <p className="text-xs text-gray-500 mt-1">of ${billingUsage.limit} limit</p>
                    </div>

                    {/* API Calls */}
                    <div className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] border border-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-400">API Calls</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{billingUsage.apiCalls.toLocaleString()}</p>
                      <p className="text-xs text-blue-400 mt-1">+12% vs last month</p>
                    </div>

                    {/* Data Processed */}
                    <div className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] border border-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm text-gray-400">Data Processed</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{billingUsage.dataProcessed}GB</p>
                      <p className="text-xs text-purple-400 mt-1">This month</p>
                    </div>

                    {/* ML Inferences */}
                    <div className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] border border-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm text-gray-400">ML Inferences</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{billingUsage.mlInferences.toLocaleString()}</p>
                      <p className="text-xs text-yellow-400 mt-1">Auto-labeling calls</p>
                    </div>
                  </div>

                  {/* Usage Progress Bar */}
                  <div className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] border border-gray-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">Budget Usage</span>
                      <span className="text-sm text-gray-400">{billingUsage.percentUsed}% used</span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-800 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
                          style={{ width: `${billingUsage.percentUsed}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>$0</span>
                      <span className="text-emerald-400">Current: ${billingUsage.currentCost}</span>
                      <span>${billingUsage.limit}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-4 mt-6">
                    <button 
                      onClick={() => setActiveSection('billing')}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 transform hover:scale-105"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      View Detailed Billing
                    </button>
                    <button className="inline-flex items-center px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg transition-all duration-300">
                      <Download className="w-4 h-4 mr-2" />
                      Export Usage
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] flex max-w-7xl mx-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-[#111111] border-r border-gray-800/50 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full pt-4">
          {/* Logo */}
          <div className="flex items-center justify-between h-20 px-6">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <img 
                  src="/Schlep Engine laest logo design.svg" 
                  alt="Schlep Engine" 
                  className="h-14 w-auto"
                />
              </Link>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-3">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center space-x-3 px-2 py-1 rounded-xl transition-all duration-200 group ${
                        item.active
                          ? 'bg-[#161616] border border-[#1d1d1d] text-[#fcfcf7]'
                          : 'hover:bg-[#161616] text-[#fcfcf7] hover:text-[#fcfcf7]'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${item.active ? 'text-[#fcfcf7]' : 'group-hover:text-[#fcfcf7]'}`} />
                      <span className="text-sm">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-800/50">
            <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer">
              <div className="w-8 h-8 bg-gradient-to-r from-[#468BE6] to-[#3a7bd5] rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">John Doe</p>
                <p className="text-xs text-gray-400">Developer</p>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <a href="/settings" className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white">
                <Settings className="w-4 h-4" />
                <span className="text-sm">Settings</span>
              </a>
              <a href="/help" className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white">
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm">Help</span>
              </a>
              <button className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white w-full">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="relative bg-[#111111] backdrop-blur-sm h-20">
          <div className="px-6 h-full flex items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-400" />
                </button>
                <div>
                  
                </div>
              </div>
              <div className="mr-auto ml-2">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="w-full max-w-xl px-3 py-1 rounded-lg bg-[#1a1a1a] border border-gray-800 text-[#fcfcf7] flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1d1d1d]"
                >
                  <Search className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-xs text-gray-400">⌘K</span>
                </button>
              </div>
              <div className="flex items-center space-x-4">
                
                
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 pl-12 pr-6 overflow-auto bg-[#111111]">
          {renderContent()}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex justify-center top-3 p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowSearchModal(false)}>
          <div className="relative z-51 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              className="w-full px-3 py-1 rounded-lg bg-[#1a1a1a] border border-gray-800 text-[#fcfcf7] focus:outline-none focus:ring-2 focus:ring-[#1d1d1d]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
