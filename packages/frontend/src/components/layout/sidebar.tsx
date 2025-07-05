'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
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
  User
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
  onSettingsClick: () => void;
  onSystemStatusClick: () => void;
}

export function Sidebar({ isCollapsed, onSettingsClick, onSystemStatusClick }: SidebarProps) {
  const pathname = usePathname()

  const renderNav = (items: typeof navigation) => (
    <ul role="list" className="space-y-1">
      {items.map((item) => {
        const isSettings = item.name === 'Settings';
        const isSystemStatus = item.name === 'System Status';
        const isActive = !isSettings && !isSystemStatus && (pathname === item.href || pathname.startsWith(item.href + '/'));

        const commonClasses = cn(
          "group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold",
          isCollapsed ? "justify-center" : "",
          isActive 
            ? 'bg-gray-50 text-indigo-600'
            : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
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
            <span className={cn(isCollapsed ? "sr-only" : "")}>{item.name}</span>
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
        "hidden lg:sticky lg:top-0 lg:flex lg:flex-col lg:h-screen transition-all duration-300",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}>
      <div className="flex grow flex-col overflow-y-auto border-r border-gray-200 bg-white">
        <div className={cn(
            "flex h-16 shrink-0 items-center px-6",
            isCollapsed && "justify-center"
          )}>
          <Link href="/dashboard" className="flex items-center gap-x-3">
            <Logo className="h-8 w-auto" />
            <div className={cn("font-dm-sans text-lg text-gray-800", isCollapsed && "sr-only")}>
              <span className="font-bold">Schlep</span>
              <span>-engine</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex flex-1 flex-col border-t border-gray-200 mt-2 pt-4">
          <ul role="list" className="flex flex-1 flex-col gap-y-7 px-6">
            <li>
                {renderNav(navigation)}
            </li>
            <li>
              <div className={cn("text-xs font-semibold leading-6 text-gray-400", isCollapsed && "text-center")}>
                {isCollapsed ? "ACCT" : "Account"}
              </div>
              {renderNav(account)}
            </li>
            <li>
              <div className={cn("text-xs font-semibold leading-6 text-gray-400", isCollapsed && "text-center")}>
                {isCollapsed ? "ADMIN" : "Administration"}
              </div>
              {renderNav(administration)}
            </li>
             <li>
              <div className={cn("text-xs font-semibold leading-6 text-gray-400", isCollapsed && "text-center")}>
                {isCollapsed ? "DOCS" : "Resources"}
              </div>
              {renderNav(resources)}
            </li>
            <li className={cn("-mx-6 mt-auto", isCollapsed && "mx-0")}>
              <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900 hover:bg-gray-50 border-t border-gray-200">
                <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <span aria-hidden="true" className={cn(isCollapsed && "sr-only")}>Admin</span>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
} 