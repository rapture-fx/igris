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
  Layers,
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
  ChevronDown,
  ChevronLeft,
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
  const [chartView, setChartView] = useState('api_calls')
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false)
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const [timePeriod, setTimePeriod] = useState('7d')
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null)
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [isSelectingRange, setIsSelectingRange] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom')
  const [mockData, setMockData] = useState<any[]>([])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setShowSearchModal(true)
      }
      if (event.key === 'Escape') {
        setShowSearchModal(false)
        setShowViewDropdown(false)
        setShowTimeDropdown(false)
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.dropdown-container')) {
        setShowViewDropdown(false)
        setShowTimeDropdown(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('click', handleClickOutside)
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
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  }

  const refreshData = async () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  // Calendar helper functions
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const getDaysInMonth = (date: Date | null) => {
    if (!date) return []
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days;
  }

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate || !selectedEndDate) return false;
    return date >= selectedStartDate && date <= selectedEndDate;
  }

  const isDateSelected = (date: Date) => {
    if (!selectedStartDate && !selectedEndDate) return false;
    if (selectedStartDate && date.getTime() === selectedStartDate.getTime()) return true;
    if (selectedEndDate && date.getTime() === selectedEndDate.getTime()) return true;
    return false;
  }

  const handleDateClick = (date: Date) => {
    if (!isSelectingRange) {
      // First click - set start date
      setSelectedStartDate(date)
      setSelectedEndDate(null)
      setIsSelectingRange(true)
    } else {
      // Second click - set end date
      if (selectedStartDate && date < selectedStartDate) {
        // If end date is before start date, swap them
        setSelectedEndDate(selectedStartDate)
        setSelectedStartDate(date)
      } else {
        setSelectedEndDate(date)
      }
      setIsSelectingRange(false)
      setTimePeriod('custom')
    }
  }

  const applyPresetPeriod = (preset: string) => {
    const now = new Date()
    let startDate: Date
    let endDate = now

    switch (preset) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
    setTimePeriod(preset);
    setIsSelectingRange(false);
  }

  const handleTimeDropdownToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!showTimeDropdown) {
      const button = event.currentTarget
      const rect = button.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownHeight = 400 // Approximate height of the calendar dropdown
      
      // Check if there's enough space below the button
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      
      // Position dropdown above if there's not enough space below
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition('top')
      } else {
        setDropdownPosition('bottom')
      }
    }
    
    setShowTimeDropdown(!showTimeDropdown)
  }

  // Mock data generation with deterministic seed
  const generateMockData = () => {
    // Use a simple seeded random for consistent results
    let seed = 42
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280;
    }

    const now = new Date()
    const data = []
    
    // Generate 24 hours of data points (every hour)
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hour = timestamp.getHours()
      
      // Create realistic patterns
      const baseApiCalls = 150 + Math.sin(hour * Math.PI / 12) * 50 // Peak around noon
      const baseResponseTime = 200 + Math.sin(hour * Math.PI / 8) * 100 // Higher at peak hours
      const baseQuality = 95 + Math.sin(hour * Math.PI / 16) * 3 // Slight variation
      
      data.push({
        timestamp,
        successfulCalls: Math.floor(baseApiCalls + seededRandom() * 20),
        failedCalls: Math.floor(5 + seededRandom() * 10),
        responseTime: Math.floor(baseResponseTime + seededRandom() * 50),
        dataQuality: Math.floor(baseQuality + seededRandom() * 2),
        // Previous period data (slightly different)
        prevSuccessfulCalls: Math.floor(baseApiCalls * 0.9 + seededRandom() * 15),
        prevFailedCalls: Math.floor(3 + seededRandom() * 8),
        prevResponseTime: Math.floor(baseResponseTime * 1.1 + seededRandom() * 40),
        prevDataQuality: Math.floor(baseQuality - 1 + seededRandom() * 2)
      })
    }
    
    return data;
  }

  // Initialize mock data and current month in useEffect to prevent hydration errors
  useEffect(() => {
    setMockData(generateMockData());
    setCurrentMonth(new Date());
  }, [chartView, timePeriod]); // Regenerate when view or time period changes

  // Chart rendering helper
  const renderChart = () => {
    // Don't render if no data available (prevents hydration errors)
    if (!mockData || mockData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="animate-pulse">Loading chart...</div>
        </div>
      );
    }

    const width = 100; // Will be converted to viewBox percentage
    const height = 60; // px - adjusted for better proportions
    const padding = 5; // Reduced padding for edge-to-edge lines
    
    const getChartData = () => {
      switch (chartView) {
        case 'api_calls':
          return {
            primary: mockData.map(d => d.successfulCalls),
            secondary: mockData.map(d => d.failedCalls),
            prevPrimary: showPreviousPeriod ? mockData.map(d => d.prevSuccessfulCalls) : null,
            prevSecondary: showPreviousPeriod ? mockData.map(d => d.prevFailedCalls) : null,
            maxValue: Math.max(...mockData.map(d => Math.max(d.successfulCalls, d.failedCalls)))
          };
        case 'response_time':
          return {
            primary: mockData.map(d => d.responseTime),
            secondary: null,
            prevPrimary: showPreviousPeriod ? mockData.map(d => d.prevResponseTime) : null,
            prevSecondary: null,
            maxValue: Math.max(...mockData.map(d => d.responseTime))
          };
        case 'data_quality':
          return {
            primary: mockData.map(d => d.dataQuality),
            secondary: null,
            prevPrimary: showPreviousPeriod ? mockData.map(d => d.prevDataQuality) : null,
            prevSecondary: null,
            maxValue: 100
          };
        case 'all_metrics':
          return {
            primary: mockData.map(d => d.successfulCalls),
            secondary: mockData.map(d => d.failedCalls),
            tertiary: mockData.map(d => d.responseTime / 10), // Scale down for visibility
            quaternary: mockData.map(d => d.dataQuality),
            maxValue: Math.max(...mockData.map(d => Math.max(d.successfulCalls, d.failedCalls)))
          };
        default:
          return { primary: [], secondary: null, maxValue: 1 };
      }
    };

    const chartData = getChartData();
    const { primary, secondary, prevPrimary, prevSecondary, tertiary, quaternary, maxValue } = chartData;

    const createPath = (data: number[], max: number, color: string, isDashed = false) => {
      if (!data || data.length === 0) return null;
      
      const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width; // Edge to edge
        const y = height - (value / max) * (height - padding * 2) - padding;
        return `${x},${y}`;
      }).join(' ');
      
      return (
        <polyline
          key={`${color}-${isDashed}`}
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          points={points}
          className="transition-all duration-300"
        />
      );
    };

    return (
      <div className="relative w-full h-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <line
              key={ratio}
              x1={0}
              y1={height - ratio * (height - padding * 2) - padding}
              x2={width}
              y2={height - ratio * (height - padding * 2) - padding}
              stroke="#374151"
              strokeWidth="0.5"
              opacity={0.3}
            />
          ))}
          
          {/* Threshold lines */}
          {chartView === 'response_time' && maxValue > 2000 && (
            <line
              x1={0}
              y1={height - (2000 / maxValue) * (height - padding * 2) - padding}
              x2={width}
              y2={height - (2000 / maxValue) * (height - padding * 2) - padding}
              stroke="#fbbf24"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity={0.8}
            />
          )}
          
          {chartView === 'data_quality' && (
            <line
              x1={0}
              y1={height - (95 / maxValue) * (height - padding * 2) - padding}
              x2={width}
              y2={height - (95 / maxValue) * (height - padding * 2) - padding}
              stroke="#10b981"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity={0.8}
            />
          )}

          {/* Data lines */}
          {createPath(primary, maxValue, '#5f598d')}
          {secondary && createPath(secondary, maxValue, '#3d0404')}
          {tertiary && createPath(tertiary, maxValue, '#f59e0b')}
          {quaternary && createPath(quaternary, 100, '#10b981')}
          
          {/* Previous period lines (solid) */}
          {prevPrimary && createPath(prevPrimary, maxValue, '#6b7280')}
          {prevSecondary && createPath(prevSecondary, maxValue, '#6b7280')}
          
        </svg>

        {/* Y-axis labels */}
        <div className="absolute -left-10 top-0 h-full flex flex-col justify-between text-xs text-gray-500 py-2">
          <span className="text-right bg-[#0f0f0f] px-1 rounded text-xs">{Math.round(maxValue)}</span>
          <span className="text-right bg-[#0f0f0f] px-1 rounded text-xs">{Math.round(maxValue * 0.75)}</span>
          <span className="text-right bg-[#0f0f0f] px-1 rounded text-xs">{Math.round(maxValue * 0.5)}</span>
          <span className="text-right bg-[#0f0f0f] px-1 rounded text-xs">{Math.round(maxValue * 0.25)}</span>
          <span className="text-right bg-[#0f0f0f] px-1 rounded text-xs">0</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute -bottom-6 left-0 w-full flex justify-between text-xs text-gray-500 px-0">
          <span className="bg-[#1a1a1a] px-1 py-0.5 rounded text-xs">24h ago</span>
          <span className="bg-[#1a1a1a] px-1 py-0.5 rounded text-xs">18h ago</span>
          <span className="bg-[#1a1a1a] px-1 py-0.5 rounded text-xs">12h ago</span>
          <span className="bg-[#1a1a1a] px-1 py-0.5 rounded text-xs">6h ago</span>
          <span className="bg-[#1a1a1a] px-1 py-0.5 rounded text-xs">Now</span>
        </div>
      </div>
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  }

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-400 bg-green-900/20';
      case 'degraded':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'down':
        return 'text-red-400 bg-red-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  }

  const [activeSection, setActiveSection] = useState('overview')

  const navigationSections = [
    {
      title: 'Dashboard',
      items: [
        { name: 'Overview', icon: Home, id: 'overview', active: activeSection === 'overview' },
        { name: 'Project', icon: Layers, id: 'project', active: activeSection === 'project' }
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
        { name: 'Billing & Usage', icon: CreditCard, id: 'billing', active: activeSection === 'billing' },
        { name: 'Settings', icon: Settings, id: 'settings', active: activeSection === 'settings' }
      ]
    }
  ]

  // Dynamic imports for sections
  const DataProcessingSection = dynamic(() => import('./components/DataProcessingSection'), { ssr: false })
  const BillingSection = dynamic(() => import('./components/BillingSection'), { ssr: false })

  const renderContent = () => {
    switch (activeSection) {
      case 'data':
        return <DataProcessingSection />;
      case 'billing':
        return <BillingSection />;
      case 'pipelines':
        return (
          <div className="text-center py-12">
            <Workflow className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Pipeline Builder</h3>
            <p className="text-gray-400">Create and manage your data processing workflows</p>
          </div>
        );
      case 'explorer':
        return (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Data Explorer</h3>
            <p className="text-gray-400">Interactive data profiling and analysis</p>
          </div>
        );
      case 'jobs':
        return (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Jobs & Monitoring</h3>
            <p className="text-gray-400">Monitor and manage your data processing jobs</p>
          </div>
        );
      case 'api':
        return (
          <div className="text-center py-12">
            <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">API Playground</h3>
            <p className="text-gray-400">Test and explore Schlep Engine APIs interactively</p>
          </div>
        );
      case 'models':
        return (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">ML Models</h3>
            <p className="text-gray-400">Manage and deploy your machine learning models</p>
          </div>
        );
      case 'tools':
        return (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">SDK & CLI Tools</h3>
            <p className="text-gray-400">Developer tools and integrations for Schlep Engine</p>
          </div>
        );
      case 'project':
        return (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Project Overview</h3>
            <p className="text-gray-400">Manage your project settings and details</p>
          </div>
        );
      case 'settings':
        return (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Settings</h3>
            <p className="text-gray-400">Manage your account settings</p>
          </div>
        );
      default:
        return (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-white mb-2">Dashboard Overview</h3>
            <p className="text-gray-400">Welcome to your dashboard</p>
          </div>
        );
    }
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = []
    const section = navigationSections.find(s => s.items.some(i => i.id === activeSection))
    if (section) {
      breadcrumbs.push({ name: section.title, href: '#' })
      const item = section.items.find(i => i.id === activeSection)
      if (item) {
        breadcrumbs.push({ name: item.name, href: '#' })
      }
    }
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="h-screen bg-[#111111] flex max-w-7xl mx-auto overflow-hidden">
      <style jsx>{`
        main::-webkit-scrollbar {
          display: none;
        }
        .sidebar-button:focus, .sidebar-button:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-[#111111] border-r border-[#111111] backdrop-blur-xl transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:flex-col`}>
        <div className="flex flex-col h-full pt-4">
          {/* User Profile */}
          <div className="p-4">
            <div className="flex items-center space-x-3 p-3 rounded-xl text-[#fcfcf7]">
              <div className="w-12 h-12 bg-[#222222] rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">John Doe</p>
                <p className="text-xs text-gray-400">Developer</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-2">
                {section.title === 'Dashboard' || section.title === 'Data & Processing' || section.title === 'Development' || section.title === 'Account' ? (
                  <div className="py-2">
                    <hr className="border-t-2 border-[#161616]" />
                  </div>
                ) : (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-3">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => {
                        setActiveSection(item.id)
                      }}
                      className={`sidebar-button w-full flex items-center space-x-3 px-4 py-2 rounded-xl transition-all duration-200 group ${
                        item.active
                          ? 'bg-[#222222] border border-[#1d1d1d] text-[#fcfcf7] shadow-inner'
                          : 'text-gray-400 hover:bg-[#161616] hover:shadow-lg hover:-translate-y-0.5 hover:text-[#fcfcf7]'
                      }`}>
                      <item.icon className={`w-5 h-5 ${item.active ? 'text-[#fcfcf7]' : 'text-gray-400 group-hover:text-[#fcfcf7]'}`} />
                      <span className="text-sm">{item.name}</span>
                    </button>
                  ))}
                  {section.title === 'Dashboard' && (
                    <button
                      onClick={() => setShowSearchModal(true)}
                      className="sidebar-button w-full flex items-center space-x-3 px-4 py-2 rounded-xl transition-all duration-200 group text-gray-400 hover:bg-[#161616] hover:shadow-lg hover:-translate-y-0.5 hover:text-[#fcfcf7]"
                    >
                      <Search className="w-5 h-5 text-gray-400 group-hover:text-[#fcfcf7]" />
                      <span className="text-sm">Search</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </nav>

          {/* User Section Bottom Links */}
          <div className="p-4">
            <div className="mt-2 space-y-1">
              <a href="/help" className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-[#161616] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-gray-400 hover:text-[#fcfcf7]">
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm">Help</span>
              </a>
              <button className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-[#161616] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-gray-400 hover:text-[#fcfcf7] w-full">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Header */}
        <header className="flex-shrink-0 bg-[#111111] h-20">
          <div className="px-6 h-full flex items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-4">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-400" />
                </button>

                {/* Breadcrumbs */}
                <nav className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.name} className="flex items-center space-x-2">
                      {index > 0 && <ChevronRight className="w-4 h-4" />}
                      <a href={crumb.href} className="hover:text-white transition-colors">
                        {crumb.name}
                      </a>
                    </div>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main 
          className="flex-1 pl-6 pr-6 bg-[#161616] overflow-y-auto rounded-t-2xl"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div className="py-6">
            {renderContent()}
          </div>
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
              className="w-full px-3 py-1 rounded-lg bg-[#1a1a1a] border border-[#1d1d1d] text-[#fcfcf7] focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </div>
      )}
    </div>
  )
}