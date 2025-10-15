'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { EnhancedSidebar } from '@/components/layout/enhanced-sidebar'
import { Header } from '@/components/layout/header'
import { ProjectManagementInterface } from '@/components/projects/project-management-interface'
import { RealtimeProcessingStatus } from '@/components/monitoring/realtime-processing-status'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { cn } from '@/lib/utils'
import { Toaster } from 'sonner'
import { 
  X, 
  Server, 
  Database, 
  Cpu, 
  MemoryStick, 
  AlertTriangle, 
  Shield, 
  CheckCircle, 
  Activity, 
  TrendingUp, 
  FileText, 
  CheckSquare, 
  ChevronLeft, 
  ChevronRight, 
  Menu,
  LayoutDashboard,
  FolderKanban,
  Monitor,
  Settings,
  Bell,
  Users,
  BarChart3,
  Zap
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical'
  [key: string]: any;
}

interface DashboardView {
  id: string
  name: string
  description: string
  component: React.ComponentType<any>
  icon: React.ComponentType<any>
  badge?: string
}

// Available dashboard views based on role
const dashboardViews: Record<string, DashboardView[]> = {
  admin: [
    {
      id: 'overview',
      name: 'System Overview',
      description: 'Comprehensive system monitoring and analytics',
      component: SystemOverviewDashboard,
      icon: LayoutDashboard
    },
    {
      id: 'projects',
      name: 'Project Management',
      description: 'Manage and track all data science projects',
      component: ProjectManagementInterface,
      icon: FolderKanban,
      badge: 'New'
    },
    {
      id: 'processing',
      name: 'Processing Status',
      description: 'Real-time monitoring of data processing jobs',
      component: RealtimeProcessingStatus,
      icon: Monitor
    },
    {
      id: 'users',
      name: 'User Management',
      description: 'Manage users, roles, and permissions',
      component: UserManagementDashboard,
      icon: Users
    },
    {
      id: 'analytics',
      name: 'System Analytics',
      description: 'Advanced analytics and insights',
      component: SystemAnalyticsDashboard,
      icon: BarChart3
    }
  ],
  user: [
    {
      id: 'overview',
      name: 'My Dashboard',
      description: 'Personal workspace and project overview',
      component: UserOverviewDashboard,
      icon: LayoutDashboard
    },
    {
      id: 'projects',
      name: 'My Projects',
      description: 'View and manage your projects',
      component: ProjectManagementInterface,
      icon: FolderKanban
    },
    {
      id: 'processing',
      name: 'My Jobs',
      description: 'Track your data processing jobs',
      component: RealtimeProcessingStatus,
      icon: Monitor
    },
    {
      id: 'analytics',
      name: 'Data Analysis',
      description: 'Analyze your datasets and results',
      component: DataAnalysisDashboard,
      icon: BarChart3
    }
  ],
  analyst: [
    {
      id: 'overview',
      name: 'Analysis Hub',
      description: 'Advanced analytics workspace',
      component: AnalystOverviewDashboard,
      icon: LayoutDashboard
    },
    {
      id: 'experiments',
      name: 'Experiments',
      description: 'ML experiments and model tracking',
      component: ExperimentsDashboard,
      icon: Zap
    },
    {
      id: 'processing',
      name: 'Processing Jobs',
      description: 'Monitor analysis and training jobs',
      component: RealtimeProcessingStatus,
      icon: Monitor
    },
    {
      id: 'insights',
      name: 'Data Insights',
      description: 'Discover patterns and insights',
      component: DataInsightsDashboard,
      icon: BarChart3
    }
  ]
}

// Placeholder components for different dashboard views
function SystemOverviewDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">System Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold text-green-600">Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Database className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Data Sources</p>
                <p className="text-2xl font-bold text-gray-900">89</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function UserOverviewDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">My Dashboard</h2>
      <p className="text-gray-600">Welcome to your personal workspace</p>
    </div>
  )
}

function AnalystOverviewDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Analysis Hub</h2>
      <p className="text-gray-600">Advanced analytics and insights workspace</p>
    </div>
  )
}

function UserManagementDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
      <p className="text-gray-600">Manage users, roles, and permissions</p>
    </div>
  )
}

function SystemAnalyticsDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">System Analytics</h2>
      <p className="text-gray-600">Advanced system analytics and insights</p>
    </div>
  )
}

function ExperimentsDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Experiments</h2>
      <p className="text-gray-600">ML experiments and model tracking</p>
    </div>
  )
}

function DataAnalysisDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Data Analysis</h2>
      <p className="text-gray-600">Analyze your datasets and results</p>
    </div>
  )
}

function DataInsightsDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Data Insights</h2>
      <p className="text-gray-600">Discover patterns and insights in your data</p>
    </div>
  )
}

const SystemStatusSheet = ({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void }) => {
  const { data: healthData, isLoading, error } = useQuery<HealthStatus>({
    queryKey: ['system-health'],
    queryFn: () => apiService.getDetailedHealth(),
    refetchInterval: 10000,
    enabled: isOpen,
  })

  const system = healthData?.components.system
  const database = healthData?.components.database
  const application = healthData?.components.application

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">System Status</SheetTitle>
          <SheetDescription>
            Real-time health monitoring of all system components.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {/* System status content */}
          <p className="text-gray-600">System status details will be shown here...</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function EnhancedDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const [showTour, setShowTour] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSystemStatusOpen, setIsSystemStatusOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [currentRole, setCurrentRole] = useState<string>('user') // This would come from user context
  const [activeView, setActiveView] = useState<string>('overview')

  // Get available views for current role
  const availableViews = dashboardViews[currentRole] || dashboardViews.user
  const currentView = availableViews.find(view => view.id === activeView) || availableViews[0]

  useEffect(() => {
    if (user?.id) {
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`)
      if (!hasCompletedOnboarding) {
        setShowTour(true)
      }
    }
  }, [user])

  useEffect(() => {
    // Auto-collapse sidebar on mobile
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true)
        setIsMobileSidebarOpen(false)
      } else {
        setIsMobileSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleTourComplete = () => {
    console.log('Tour completed!')
    if (user?.id) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true')
    }
    setShowTour(false)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto animate-pulse">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Loading Dashboard</h3>
            <p className="text-gray-600">Preparing your workspace...</p>
          </div>
        </div>
      </div>
    )
  }

  const CurrentViewComponent = currentView.component

  return (
    <div className="min-h-screen bg-gray-50/30">
      <Header />
      
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-24 left-4 z-40">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="bg-white/90 backdrop-blur-sm border-gray-200 shadow-sm"
        >
          <Menu className="w-4 h-4" />
        </Button>
      </div>

      <div className="max-w-[1600px] mx-auto lg:flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <EnhancedSidebar 
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-72">
            <div className="h-full">
              <EnhancedSidebar 
                isCollapsed={false}
                onToggle={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Dashboard View Tabs */}
          <div className="border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="w-full justify-start border-0 bg-transparent h-auto p-0">
                {availableViews.map((view) => (
                  <TabsTrigger
                    key={view.id}
                    value={view.id}
                    className="relative px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none bg-transparent data-[state=active]:bg-transparent border-0 data-[state=active]:shadow-none"
                  >
                    <view.icon className="w-4 h-4 mr-2" />
                    {view.name}
                    {view.badge && (
                      <Badge variant="default" className="ml-2 text-xs">
                        {view.badge}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Main Content Area */}
          <main className={cn(
            "py-6 px-4 sm:px-6 lg:px-8",
            "lg:py-8 lg:px-12",
            // Add left margin for mobile menu button
            "lg:ml-0 ml-0 pt-16 lg:pt-6"
          )}>
            <div className="max-w-7xl mx-auto">
              {/* Render current view or children */}
              {children ? children : <CurrentViewComponent />}
            </div>
          </main>
        </div>
      </div>
      
      {/* Guided Tour */}
      <GuidedTour
        isVisible={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
        userId={user?.id || ''}
      />
      
      <SystemStatusSheet isOpen={isSystemStatusOpen} onOpenChange={setIsSystemStatusOpen} />
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
} 