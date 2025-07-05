'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { X, Server, Database, Cpu, MemoryStick, AlertTriangle, Shield, CheckCircle, Activity, TrendingUp, FileText, CheckSquare } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
// import { Toaster } from 'sonner'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical'
  [key: string]: any;
}

// A placeholder for the actual settings modal content
const SettingsModal = ({ setIsOpen }: { setIsOpen: (isOpen: boolean) => void }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="mt-6">
          <p>Settings content will go here.</p>
          <p>This includes user profile settings, notification preferences, and application theme.</p>
        </div>
      </div>
    </div>
  )
}

const statusColors = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  critical: 'bg-red-500',
}

const HealthCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

const SystemStatusSheet = ({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void }) => {
    const { data: healthData, isLoading, error } = useQuery<HealthStatus>({
    queryKey: ['system-health'],
    queryFn: () => apiService.getDetailedHealth(),
    refetchInterval: 10000, // Refetch every 10 seconds
    enabled: isOpen, // Only fetch when the sheet is open
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
        <div className="py-6 space-y-6">
          {isLoading && <p>Loading system status...</p>}
          {error && <p className="text-red-500">Error fetching system status: {(error as Error).message}</p>}
          {healthData && (
             <>
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">System Status</h1>
                    <div className="flex items-center gap-x-2">
                    <div className={`h-3 w-3 rounded-full ${statusColors[healthData.status]}`} />
                    <span className="text-lg font-semibold capitalize">{healthData.status}</span>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                    <CardTitle>Overall Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                    <div className="flex items-center gap-x-4">
                        <span className="text-4xl font-bold">{healthData?.overall_score.toFixed(1)}%</span>
                        <Progress value={healthData?.overall_score} className="w-full" />
                    </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <HealthCard title="System" icon={<Server className="h-5 w-5 text-gray-400" />}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                        <span className="flex items-center gap-x-2"><Cpu className="h-4 w-4" /> CPU</span>
                        <Badge variant={system?.cpu.status === 'ok' ? 'default' : 'destructive'}>{system?.cpu.value}%</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                        <span className="flex items-center gap-x-2"><MemoryStick className="h-4 w-4" /> Memory</span>
                        <Badge variant={system?.memory.status === 'ok' ? 'default' : 'destructive'}>{system?.memory.value}%</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                        <span className="flex items-center gap-x-2"><Database className="h-4 w-4" /> Disk</span>
                        <Badge variant={system?.disk.status === 'ok' ? 'default' : 'destructive'}>{system?.disk.value}%</Badge>
                        </div>
                    </div>
                    </HealthCard>

                    <HealthCard title="Database" icon={<Database className="h-5 w-5 text-gray-400" />}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                        <span>Connections</span>
                        <Badge variant={database?.connections.status === 'ok' ? 'default' : 'destructive'}>{database?.connections.value}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                        <span>Avg. Query Time</span>
                        <Badge variant={database?.performance.status === 'ok' ? 'default' : 'destructive'}>{database?.performance.avg_query_time}ms</Badge>
                        </div>
                    </div>
                    </HealthCard>

                    <HealthCard title="Application" icon={<Shield className="h-5 w-5 text-gray-400" />}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                        <span>P95 Response Time</span>
                        <Badge variant={application?.response_time.status === 'ok' ? 'default' : 'destructive'}>{application?.response_time.value}ms</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                        <span>Error Rate</span>
                        <Badge variant={application?.error_rate.status === 'ok' ? 'default' : 'destructive'}>{application?.error_rate.value}%</Badge>
                        </div>
                    </div>
                    </HealthCard>
                </div>
              </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface AuditLog {
  id: string;
  summary: string;
  timestamp: string;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total_pages: number;
  current_page: number;
}

const RightPanel = ({ className }: { className?: string }) => {
  const { data: stats, isLoading, error } = useQuery<any>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiService.getDashboardStats(),
  })

  const metrics = [
    { name: 'Records Processed', value: stats?.records_processed_today, icon: TrendingUp },
    { name: 'Active Data Sources', value: stats?.active_sources, icon: Database },
    { name: 'Total Records', value: stats?.total_records, icon: FileText },
    { name: 'Jobs Completed', value: stats?.jobs_today, icon: CheckSquare },
  ]

  return (
    <aside className={cn("hidden xl:block w-80 shrink-0 bg-gray-50 p-6 h-screen sticky top-0", className)}>
       <div className="pt-16"> {/* Offset for header */}
        <h3 className="text-lg font-semibold mb-6">Key Metrics</h3>
        {isLoading && <p>Loading metrics...</p>}
        {error && <p className="text-sm text-red-500">Could not load metrics.</p>}
        <div className="space-y-4">
         {metrics.map(item => (
           <div key={item.name} className="flex items-start gap-x-4">
             <div className="h-10 w-10 flex items-center justify-center shrink-0">
               <item.icon className="h-6 w-6 text-gray-600" />
             </div>
             <div>
               <p className="text-sm font-semibold text-gray-800">{item.value?.toLocaleString() || '...'}</p>
               <p className="text-xs text-gray-600">{item.name}</p>
             </div>
           </div>
         ))}
        </div>
       </div>
    </aside>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const [showTour, setShowTour] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSystemStatusOpen, setIsSystemStatusOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)

  useEffect(() => {
    if (user?.id) {
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`)
      if (!hasCompletedOnboarding) {
        setShowTour(true)
      }
    }
  }, [user])

  const handleTourComplete = () => {
    console.log('Tour completed!')
    if (user?.id) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true')
      setShowTour(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {/* You can replace this with a proper skeleton loader */}
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto lg:flex">
         <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onSettingsClick={() => setIsSettingsOpen(true)} 
          onSystemStatusClick={() => setIsSystemStatusOpen(true)}
        />
        <div className="flex-1 min-w-0">
            <Header onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)} />
            <main className="py-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
            </main>
        </div>
        <RightPanel className={cn(!isRightPanelOpen && "hidden")} />
      </div>
      
      {/* Guided Tour */}
      <GuidedTour
        isVisible={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
        userId={user?.id || ''}
      />

      {isSettingsOpen && <SettingsModal setIsOpen={setIsSettingsOpen} />}
      <SystemStatusSheet isOpen={isSystemStatusOpen} onOpenChange={setIsSystemStatusOpen} />
      
      {/* <Toaster position="top-right" richColors /> */}
    </div>
  )
} 