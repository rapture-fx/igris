'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDashboardData } from '@/hooks/useDashboardData'
import { FileUpload } from '@/components/upload/FileUpload'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { 
  Plus, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Database, 
  TrendingUp, 
  CheckCircle2, 
  Target,
  Gauge,
  BarChart3,
  Activity,
  ArrowUpRight,
  Sparkles,
  Zap,
  Shield,
  Users,
  FileText,
  Settings,
  ChevronRight,
  Calendar,
  Eye,
  Play,
  Pause,
  MoreHorizontal,
  Layers,
  Cpu,
  Globe,
  Bell,
  Star,
  Filter,
  Search,
  Download,
  ExternalLink
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataQualityCard } from '@/components/dashboard/data-quality-card'
import { ActiveJobsCard } from '@/components/dashboard/active-jobs-card'
import { RecentActivityCard } from '@/components/dashboard/recent-activity-card'
import { formatNumber, formatCurrency, getTimeAgo, cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

// Enhanced interface for active jobs
interface ActiveJob {
  job_id: string;
  investigation_name: string;
  status: string;
  progress_percentage: number | null;
  estimated_completion: string | null;
}

// Quick action cards for the dashboard
const quickActions = [
  {
    title: 'Upload Data',
    description: 'Upload new datasets for analysis',
    icon: Upload,
    action: 'upload',
    color: 'bg-blue-50 text-blue-600 border-blue-200'
  },
  {
    title: 'Create Pipeline',
    description: 'Build data processing workflows',
    icon: Zap,
    action: 'pipeline',
    color: 'bg-purple-50 text-purple-600 border-purple-200'
  },
  {
    title: 'Run Analysis',
    description: 'Analyze your data with AI',
    icon: BarChart3,
    action: 'analysis',
    color: 'bg-green-50 text-green-600 border-green-200'
  },
  {
    title: 'View Reports',
    description: 'Access insights and reports',
    icon: FileText,
    action: 'reports',
    color: 'bg-orange-50 text-orange-600 border-orange-200'
  }
]

export default function DashboardPage() {
  const [showUpload, setShowUpload] = useState(false)
  const { 
    stats, 
    recentActivity, 
    dataQuality,
    activeJobs,
    isLoading, 
    isError, 
    refetchAll 
  } = useDashboardData()

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'upload':
        setShowUpload(true)
        break
      case 'pipeline':
        window.location.href = '/dashboard/pipelines'
        break
      case 'analysis':
        window.location.href = '/dashboard/data-analysis'
        break
      case 'reports':
        window.location.href = '/dashboard/export'
        break
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 text-white animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Loading Dashboard</h3>
            <p className="text-gray-600">Fetching your latest data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Unable to Load Dashboard</h3>
            <p className="text-gray-600">There was an error loading your dashboard data.</p>
          </div>
          <Button
            onClick={refetchAll}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Empty state for new users
  if (!stats.data || stats.data.data_sources === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Welcome to Schlep-engine"
          description="Your AI-powered data intelligence platform"
          showDivider={false}
        />
        
        <div className="flex items-center justify-center min-h-96">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Get Started with Your Data
                </h2>
                <p className="text-gray-600 text-lg">
                  Upload your first dataset to start transforming messy data into ML-ready insights
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
              <Button
                onClick={() => setShowUpload(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl h-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                Upload Dataset
              </Button>
              
              <Button
                variant="outline"
                asChild
                className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 px-6 rounded-xl h-auto"
              >
                <Link href="/dashboard/data-sources">
                  <Database className="w-5 h-5 mr-2" />
                  Browse Samples
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
              {quickActions.map((action) => (
                <div key={action.title} className="text-center space-y-2">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mx-auto border",
                    action.color
                  )}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">{action.title}</h4>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main Dashboard with data
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's your data intelligence overview."
        stats={[
          {
            label: 'Data Sources',
            value: stats.data?.data_sources || 0,
            icon: Database,
            color: 'blue'
          },
          {
            label: 'Active Jobs',
            value: activeJobs.data?.length || 0,
            icon: Activity,
            color: 'green'
          },
          {
            label: 'Quality Score',
            value: `${dataQuality.data?.quality_score || 0}%`,
            icon: Target,
            color: 'purple'
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Refresh 
              onClick={refetchAll}
              isLoading={isLoading}
              tooltip="Refresh data"
            />
            <PageHeaderActions.Primary
              onClick={() => setShowUpload(true)}
              icon={Plus}
            >
              New Investigation
            </PageHeaderActions.Primary>
          </div>
        }
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Card
            key={action.title}
            className="cursor-pointer hover:shadow-lg transition-all duration-200 border-gray-200/60 hover:border-gray-300"
            onClick={() => handleQuickAction(action.action)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center border",
                  action.color
                )}>
                  <action.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{action.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{action.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Clock}
          title="Time Saved"
          value={`${stats.data?.time_savings?.hours_saved_weekly || 0}h/week`}
          change="+12% this week"
          changeType="positive"
          footer={`${formatCurrency(stats.data?.time_savings?.cost_savings_monthly / 4 || 0)} value`}
          color={{ bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200' }}
        />
        <StatCard
          icon={Target}
          title="Data Quality"
          value={`${dataQuality.data?.quality_score || 0}%`}
          change="+5% this month"
          changeType="positive"
          footer={`${dataQuality.data?.issues_count || 0} issues detected`}
          color={{ bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-200' }}
        />
        <StatCard
          icon={Gauge}
          title="Processing Jobs"
          value={activeJobs.data?.length || 0}
          change="-2 from yesterday"
          changeType="negative"
          footer={(() => {
            const avgProgress = activeJobs.data?.length 
              ? Math.round(activeJobs.data.reduce((total: number, job: ActiveJob) => total + (job.progress_percentage || 0), 0) / activeJobs.data.length)
              : 0;
            return `${avgProgress}% avg progress`;
          })()}
          color={{ bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-200' }}
        />
        <StatCard
          icon={BarChart3}
          title="Recent Activity"
          value={recentActivity.data?.length || 0}
          change="+8 today"
          changeType="positive"
          footer={recentActivity.data?.length > 0 ? getTimeAgo(recentActivity.data[0].timestamp) : 'No recent activity'}
          color={{ bg: 'bg-pink-50', icon: 'text-pink-600', border: 'border-pink-200' }}
        />
      </div>

      {/* Main Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DataQualityCard data={dataQuality.data} />
          <ActiveJobsCard jobs={activeJobs.data} />
        </div>
        <div className="space-y-6">
          <RecentActivityCard activity={recentActivity.data} getTimeAgo={getTimeAgo} />
          
          {/* System Status Card */}
          <Card className="border-gray-200/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Status</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Processing</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  Running
                </Badge>
              </div>
              <Separator />
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-gray-600 hover:text-gray-900"
                asChild
              >
                <Link href="/dashboard/system-status">
                  View Details
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* File Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Upload Dataset</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpload(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </Button>
              </div>
              <FileUpload />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}