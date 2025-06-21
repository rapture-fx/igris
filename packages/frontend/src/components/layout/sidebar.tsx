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
  Shield
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Data Sources', href: '/data-sources', icon: Database },
  { name: 'Intelligence', href: '/intelligence', icon: Brain },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center space-x-3">
            <Logo width={40} height={40} alt="Pollarbase Logo" />
            <span className="text-xl font-bold text-gray-900">Pollarbase</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700',
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