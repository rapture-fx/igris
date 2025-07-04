'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { 
  LayoutDashboard, 
  Database, 
  Brain, 
  Workflow, 
  FolderOpen, 
  Settings,
  BarChart3,
  Users,
  Shield,
  Key,
  Search,
  Zap,
  Tags,
  Download,
  Activity,
  AlertTriangle,
  Network,
  CreditCard,
  HeartPulse
} from 'lucide-react'

const coreFeatures = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Data Analysis', href: '/dashboard/data-analysis', icon: Search, description: 'Upload & analyze data types' },
  { name: 'Anomaly Detection', href: '/dashboard/anomalies', icon: AlertTriangle, description: 'Identify data issues' },
  { name: 'Transformations', href: '/dashboard/transformations', icon: Zap, description: 'AI-powered suggestions' },
  { name: 'Content Labeling', href: '/dashboard/labeling', icon: Tags, description: 'Pattern-based labeling' },
  { name: 'Export Ready', href: '/dashboard/export', icon: Download, description: 'AI framework outputs' },
  { name: 'Processing Jobs', href: '/dashboard/jobs', icon: Activity, description: 'Monitor data prep tasks' },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Network, description: 'Connect to services' },
]

const management = [
  { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Usage', href: '/dashboard/usage', icon: BarChart3 },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Security', href: '/dashboard/security', icon: Shield },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center space-x-3">
            <Logo width={40} height={40} alt="Schlep Engine Logo" />
          </div>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            {/* Core Features */}
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wide">
                Core Features
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {coreFeatures.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-mercury-muted text-mercury-primary border-r-2 border-mercury-accent'
                            : 'text-gray-700 hover:text-mercury-primary hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-mercury-accent' : 'text-gray-400 group-hover:text-mercury-accent',
                            'h-5 w-5 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          {item.description && (
                            <span className="text-xs text-gray-500">{item.description}</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
            
            {/* Management */}
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wide">
                Management
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {management.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-mercury-muted text-mercury-primary border-r-2 border-mercury-accent'
                            : 'text-gray-700 hover:text-mercury-primary hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-mercury-accent' : 'text-gray-400 group-hover:text-mercury-accent',
                            'h-5 w-5 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
} 