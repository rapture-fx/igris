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
  Shield,
  Key,
  Zap,
  BookOpen,
  AlertTriangle,
  Tags,
  Download,
  Activity,
  User,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  ChevronDown,
  BrainCircuit,
  Sparkles,
  FileText,
  Target,
  Cpu,
  TrendingUp,
  Globe,
  Workflow,
  Bell,
  LogOut,
  PieChart,
  FileSearch,
  Filter,
  Crown,
  GraduationCap,
  CheckCircle2,
  MessageSquare,
  HeadphonesIcon,
  Archive,
  Gauge,
  Beaker,
  Code,
  Terminal,
  GitBranch,
  BarChart4,
  Network,
  Folder,
  FlaskConical
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

// Role-based navigation structure
const roleBasedNavigation = {
  admin: {
    core: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban, shortcut: '⌘2', badge: 'New' },
      { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database, shortcut: '⌘3' },
      { name: 'Pipelines', href: '/dashboard/pipelines', icon: Workflow, shortcut: '⌘4' },
      { name: 'Analysis', href: '/dashboard/data-analysis', icon: BarChart3, shortcut: '⌘5' },
      { name: 'System Monitor', href: '/dashboard/monitoring', icon: Activity, shortcut: '⌘6' },
    ],
    management: [
      { name: 'User Management', href: '/dashboard/users', icon: Users, count: 0 },
      { name: 'Security', href: '/dashboard/security', icon: Shield, count: 0 },
      { name: 'Audit Logs', href: '/dashboard/audit', icon: FileSearch, count: 0 },
      { name: 'System Health', href: '/dashboard/system-health', icon: Gauge, count: 0 },
    ],
    ai: [
      { name: 'AI Models', href: '/dashboard/models', icon: BrainCircuit, count: 0 },
      { name: 'Auto-labeling', href: '/dashboard/labeling', icon: Tags, count: 0 },
      { name: 'ML Preparation', href: '/dashboard/ml-preparation', icon: Beaker, count: 0 },
      { name: 'Model Registry', href: '/dashboard/model-registry', icon: Archive, count: 0 },
    ]
  },
  user: {
    core: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { name: 'My Projects', href: '/dashboard/my-projects', icon: FolderKanban, shortcut: '⌘2' },
      { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database, shortcut: '⌘3' },
      { name: 'Analysis', href: '/dashboard/data-analysis', icon: BarChart3, shortcut: '⌘4' },
      { name: 'Exports', href: '/dashboard/export', icon: Download, shortcut: '⌘5' },
    ],
    workflow: [
      { name: 'Datasets', href: '/dashboard/datasets', icon: FileText, count: 0 },
      { name: 'Transformations', href: '/dashboard/transformations', icon: Zap, count: 0 },
      { name: 'Jobs', href: '/dashboard/jobs', icon: Activity, count: 0 },
      { name: 'Anomalies', href: '/dashboard/anomalies', icon: AlertTriangle, count: 0 },
    ],
    collaboration: [
      { name: 'Shared Projects', href: '/dashboard/shared', icon: Users, count: 0 },
      { name: 'Team Insights', href: '/dashboard/team-insights', icon: TrendingUp, count: 0 },
      { name: 'Comments', href: '/dashboard/comments', icon: MessageSquare, count: 0 },
    ]
  },
  analyst: {
    core: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { name: 'Analysis Hub', href: '/dashboard/analysis-hub', icon: BarChart3, shortcut: '⌘2' },
      { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database, shortcut: '⌘3' },
      { name: 'ML Models', href: '/dashboard/ml-models', icon: BrainCircuit, shortcut: '⌘4' },
      { name: 'Experiments', href: '/dashboard/experiments', icon: FlaskConical, shortcut: '⌘5' },
    ],
    analytics: [
      { name: 'Statistical Analysis', href: '/dashboard/stats', icon: BarChart4, count: 0 },
      { name: 'Predictive Models', href: '/dashboard/predictions', icon: TrendingUp, count: 0 },
      { name: 'A/B Testing', href: '/dashboard/ab-testing', icon: GitBranch, count: 0 },
      { name: 'Reporting', href: '/dashboard/reports', icon: FileText, count: 0 },
    ],
    tools: [
      { name: 'Query Builder', href: '/dashboard/query-builder', icon: Code, count: 0 },
      { name: 'Visualization', href: '/dashboard/visualizations', icon: PieChart, count: 0 },
      { name: 'Notebooks', href: '/dashboard/notebooks', icon: BookOpen, count: 0 },
      { name: 'SQL Editor', href: '/dashboard/sql-editor', icon: Terminal, count: 0 },
    ]
  }
}

const systemAndIntegration = [
  { name: 'Integrations', href: '/dashboard/integrations', icon: Globe, shortcut: '⌘I' },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key, shortcut: '⌘K' },
  { name: 'Webhooks', href: '/dashboard/webhooks', icon: Network, shortcut: '⌘W' },
]

const settingsAndSupport = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, shortcut: '⌘,' },
  { name: 'Usage', href: '/dashboard/usage', icon: PieChart, shortcut: '⌘U' },
  { name: 'Documentation', href: '/documentation', icon: BookOpen, shortcut: '⌘D' },
  { name: 'Support', href: '/dashboard/support', icon: HeadphonesIcon, shortcut: '⌘H' },
]

// Role definitions
const roleDefinitions = {
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    icon: Crown,
    color: 'text-red-600 bg-red-50 border-red-200',
    badge: 'ADMIN'
  },
  user: {
    name: 'Data User',
    description: 'Standard user access',
    icon: User,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    badge: 'USER'
  },
  analyst: {
    name: 'Data Analyst',
    description: 'Advanced analytics',
    icon: GraduationCap,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    badge: 'ANALYST'
  }
}

interface DynamicSectionProps {
  title: string;
  icon: React.ElementType;
  items: Array<{
    name: string;
    href: string;
    icon: React.ElementType;
    count?: number;
    badge?: string;
  }>;
  isCollapsed: boolean;
  pathname: string;
  openCollapsible: string | null;
  setOpenCollapsible: (title: string | null) => void;
}

function DynamicSection({ 
  title, 
  icon: Icon, 
  items, 
  isCollapsed, 
  pathname, 
  openCollapsible, 
  setOpenCollapsible 
}: DynamicSectionProps) {
  const isOpen = openCollapsible === title;
  const isParentActive = items.some(item => pathname.startsWith(item.href));

  return (
    <div className="group">
      <Collapsible open={isOpen} onOpenChange={(open) => setOpenCollapsible(open ? title : null)}>
        <CollapsibleTrigger className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group-hover:bg-gray-50/80",
          isCollapsed ? "justify-center px-2" : "justify-between",
          isParentActive 
            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
            : 'text-gray-600 hover:text-gray-900'
        )}>
          <div className="flex items-center gap-3">
            <Icon className={cn(
              'w-5 h-5 transition-colors',
              isParentActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
            )} />
            {!isCollapsed && (
              <span className="font-medium">{title}</span>
            )}
          </div>
          {!isCollapsed && (
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          )}
        </CollapsibleTrigger>
        {!isCollapsed && (
          <CollapsibleContent className="mt-1 space-y-1">
            {items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 ml-6 rounded-lg text-sm transition-all duration-200 group",
                  pathname.startsWith(item.href)
                    ? 'text-blue-600 bg-blue-50 font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.name}</span>
                {item.count !== undefined && item.count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {item.count}
                  </Badge>
                )}
                {item.badge && (
                  <Badge variant="outline" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

interface RoleSwitcherProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  isCollapsed: boolean;
}

function RoleSwitcher({ currentRole, onRoleChange, isCollapsed }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentRoleData = roleDefinitions[currentRole as keyof typeof roleDefinitions];

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={cn(
              "p-2 rounded-lg border-2 transition-colors",
              currentRoleData.color
            )}>
              <currentRoleData.icon className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            <p>{currentRoleData.name}</p>
            <p className="text-xs text-gray-400">{currentRoleData.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-gray-50/80 border-2",
          currentRoleData.color
        )}
      >
        <currentRoleData.icon className="w-5 h-5" />
        <div className="flex-1 text-left">
          <div className="font-medium">{currentRoleData.name}</div>
          <div className="text-xs opacity-75">{currentRoleData.description}</div>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          {Object.entries(roleDefinitions).map(([roleKey, role]) => (
            <button
              key={roleKey}
              onClick={() => {
                onRoleChange(roleKey);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-gray-50",
                roleKey === currentRole && "bg-blue-50 text-blue-700",
                roleKey === Object.keys(roleDefinitions)[0] && "rounded-t-xl",
                roleKey === Object.keys(roleDefinitions)[Object.keys(roleDefinitions).length - 1] && "rounded-b-xl"
              )}
            >
              <role.icon className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">{role.name}</div>
                <div className="text-xs opacity-75">{role.description}</div>
              </div>
              {roleKey === currentRole && (
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function EnhancedSidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('user'); // Default to user, can be set from user context

  // Get role-based navigation
  const roleNav = roleBasedNavigation[currentRole as keyof typeof roleBasedNavigation];

  const renderNav = (items: any[]) => (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)));

        const NavLink = ({ children }: { children: React.ReactNode }) => (
          <Link 
            href={item.href} 
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
              isCollapsed ? "justify-center px-2" : "",
              isActive
                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
            )}
          >
            {children}
          </Link>
        );

        const content = (
          <>
            <item.icon className={cn(
              'w-5 h-5 transition-colors',
              isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
            )} />
            {!isCollapsed && (
              <span className="flex-1">{item.name}</span>
            )}
            {!isCollapsed && item.badge && (
              <Badge variant={item.badge === 'New' ? 'default' : 'outline'} className="text-xs">
                {item.badge}
              </Badge>
            )}
            {!isCollapsed && item.shortcut && (
              <span className="text-xs text-gray-400 font-mono">{item.shortcut}</span>
            )}
          </>
        );

        return (
          <div key={item.name}>
            {isCollapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink>{content}</NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    <p>{item.name}</p>
                    {item.shortcut && (
                      <p className="text-xs text-gray-400 font-mono">{item.shortcut}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <NavLink>{content}</NavLink>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={cn(
      "relative hidden lg:flex lg:flex-col lg:h-[calc(100vh-5rem)] transition-all duration-300 ease-in-out bg-white border-r border-gray-100/80",
      isCollapsed ? "lg:w-16" : "lg:w-80"
    )}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100/80">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Igris-engine</h2>
              <p className="text-xs text-gray-500">Data Intelligence Platform</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-lg hover:bg-gray-100 transition-colors",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? 
            <ChevronRight className="w-4 h-4 text-gray-600" /> : 
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          }
        </button>
      </div>

      {/* Role Switcher */}
      <div className="p-4 border-b border-gray-100/80">
        <RoleSwitcher
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* Core Navigation */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
              Core
            </h3>
          )}
          {renderNav(roleNav.core)}
        </div>

        {/* Role-specific sections */}
        {Object.entries(roleNav).slice(1).map(([sectionKey, sectionItems]) => (
          <div key={sectionKey} className="space-y-6">
            {!isCollapsed && (
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
                {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
              </h3>
            )}
            <DynamicSection
              title={sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
              icon={sectionKey === 'management' ? Settings : sectionKey === 'ai' ? BrainCircuit : sectionKey === 'workflow' ? Activity : sectionKey === 'collaboration' ? Users : sectionKey === 'analytics' ? BarChart3 : sectionKey === 'tools' ? Code : Folder}
              items={sectionItems as any[]}
              isCollapsed={isCollapsed}
              pathname={pathname}
              openCollapsible={openCollapsible}
              setOpenCollapsible={setOpenCollapsible}
            />
          </div>
        ))}

        {/* System & Integration */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
              System
            </h3>
          )}
          {renderNav(systemAndIntegration)}
        </div>

        {/* Settings & Support */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
              General
            </h3>
          )}
          {renderNav(settingsAndSupport)}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100/80">
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer",
          isCollapsed && "justify-center"
        )}>
          <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Admin User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || 'admin@company.com'}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 