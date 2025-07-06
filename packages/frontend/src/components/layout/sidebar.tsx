'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Database, 
  Settings,
  BarChart3,
  Users,
  ShieldCheck,
  Key,
  Zap,
  BookOpen,
  Server,
  Network,
  Search,
  AlertTriangle,
  Tags,
  Download,
  Activity,
  Shield,
  CreditCard,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database },
  { name: 'Data Analysis', href: '/dashboard/data-analysis', icon: Search },
  { name: 'Transformations', href: '/dashboard/transformations', icon: Zap },
  { name: 'Anomaly Detection', href: '/dashboard/anomalies', icon: AlertTriangle },
  { name: 'Content Labeling', href: '/dashboard/labeling', icon: Tags },
  { name: 'Processing Jobs', href: '/dashboard/jobs', icon: Activity },
  { name: 'Export', href: '/dashboard/export', icon: Download },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Network },
]

const account = [
  { name: 'Usage', href: '/dashboard/usage', icon: BarChart3 },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const administration = [
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Security', href: '/dashboard/security', icon: Shield },
  { name: 'Audit Logs', href: '/dashboard/audit-logs', icon: ShieldCheck },
  { name: 'System Status', href: '/dashboard/system-status', icon: Server },
]

const resources = [
  { name: 'Documentation', href: '/documentation', icon: BookOpen },
]

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onSettingsClick: () => void;
  onSystemStatusClick: () => void;
}

export function Sidebar({ isCollapsed, onToggle, onSettingsClick, onSystemStatusClick }: SidebarProps) {
  const pathname = usePathname()

  const renderNav = (items: typeof navigation) => (
    <ul role="list" className="space-y-2">
      {items.map((item) => {
        const isSettings = item.name === 'Settings';
        const isSystemStatus = item.name === 'System Status';
        const isActive = !isSettings && !isSystemStatus && (pathname === item.href || pathname.startsWith(item.href + '/'));

        const commonClasses = cn(
          "group flex items-center gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold",
          isCollapsed ? "justify-center" : "",
          isActive 
            ? 'bg-gray-100 text-indigo-600'
            : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-100'
        )

        const content = (
          <>
            <item.icon
              className={cn(
                isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                'h-6 w-6 shrink-0'
              )}
              aria-hidden="true"
            />
            <span className={cn(isCollapsed ? "hidden" : "")}>{item.name}</span>
          </>
        )

        const NavLink = isSettings 
          ? ({ children }: { children: React.ReactNode }) => <button onClick={onSettingsClick} className={cn(commonClasses, "w-full")}>{children}</button>
          : isSystemStatus
          ? ({ children }: { children: React.ReactNode }) => <button onClick={onSystemStatusClick} className={cn(commonClasses, "w-full")}>{children}</button>
          : ({ children }: { children: React.ReactNode }) => <Link href={item.href} className={commonClasses}>{children}</Link>

        return (
          <li key={item.name}>
            {isCollapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink>{content}</NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <NavLink>{content}</NavLink>
            )}
          </li>
        )
      })}
    </ul>
  );

  return (
    <div className={cn(
        "relative hidden lg:sticky lg:top-20 lg:flex lg:flex-col lg:h-[calc(100vh-5rem)] transition-all duration-300 z-30 bg-white border-r border-gray-100",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}>
       <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-4 pt-8">
           <ul role="list" className="flex flex-col gap-y-6">
            <li>{renderNav(navigation)}</li>
            <li>
              <div className={cn("text-xs font-semibold leading-6 text-gray-400", isCollapsed && "hidden")}>Account</div>
              {renderNav(account)}
            </li>
            <li>
              <div className={cn("text-xs font-semibold leading-6 text-gray-400", isCollapsed && "hidden")}>Administration</div>
              {renderNav(administration)}
            </li>
             <li>
              <div className={cn("text-xs font-semibold leading-6 text-gray-400", isCollapsed && "hidden")}>Resources</div>
              {renderNav(resources)}
            </li>
            <li className="mt-auto">
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-x-3">
                  <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className={cn("flex-1", isCollapsed && "hidden")}>
                    <div className="text-sm font-semibold">Admin User</div>
                    <div className="text-xs text-gray-500 hover:underline cursor-pointer">View profile</div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </nav>
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={onToggle}
            className="w-full flex justify-center items-center p-2 rounded-lg hover:bg-gray-100"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5 text-gray-600" /> : <ChevronLeft className="h-5 w-5 text-gray-600" />}
          </button>
        </div>
    </div>
  )
} 