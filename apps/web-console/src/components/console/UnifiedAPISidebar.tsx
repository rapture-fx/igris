'use client'

import React, { useState } from 'react'
import {
  Menu,
  List,
  Clock,
  Settings,
  Zap,
  Shield,
  FileText
} from 'lucide-react'

export type Industry = 'ai' | 'manufacturing' | 'ecommerce' | 'fintech'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  deprecated?: boolean
  beta?: boolean
  industry: Industry
  tags: string[]
  schema?: any
  examples?: any[]
}

interface UnifiedAPISidebarProps {
  selectedIndustry: Industry | 'all'
  searchQuery: string
  onSearchChange: (query: string) => void
  onEndpointSelect: (endpoint: APIEndpoint) => void
  selectedEndpoint?: APIEndpoint
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenEndpointsModal?: () => void
  onOpenSettings?: () => void
  onOpenHistory?: () => void
  onOpenWebhookTester?: () => void
  onOpenSecurityConsole?: () => void
  onOpenTestCollection?: () => void
}

interface MenuItem {
  id: string
  name: string
  icon: React.ReactNode
  onClick?: () => void
}

export function UnifiedAPISidebar({
  collapsed = true,
  onToggleCollapse,
  onOpenEndpointsModal,
  onOpenSettings,
  onOpenHistory,
  onOpenWebhookTester,
  onOpenSecurityConsole,
  onOpenTestCollection
}: UnifiedAPISidebarProps) {
  const [activeItem, setActiveItem] = useState<string | null>('api-endpoints')

  const menuItems: MenuItem[] = [
    {
      id: 'api-endpoints',
      name: 'API Endpoints',
      icon: <List className="w-5 h-5" />,
      onClick: onOpenEndpointsModal
    },
    {
      id: 'history',
      name: 'Request History',
      icon: <Clock className="w-5 h-5" />,
      onClick: onOpenHistory
    },
    {
      id: 'webhook',
      name: 'Webhook Tester',
      icon: <Zap className="w-5 h-5" />,
      onClick: onOpenWebhookTester
    },
    {
      id: 'security',
      name: 'Security Console',
      icon: <Shield className="w-5 h-5" />,
      onClick: onOpenSecurityConsole
    },
    {
      id: 'test',
      name: 'Test Collection',
      icon: <FileText className="w-5 h-5" />,
      onClick: onOpenTestCollection
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      onClick: onOpenSettings
    }
  ]

  return (
    <div className="flex h-full absolute left-0 top-0 bottom-0 z-40">
      {/* Left Column - Icons */}
      <div className="flex flex-col w-16 border-r border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
        {/* Logo at top */}
        <div className="pt-4 pb-6 px-2">
          <a href="/" className="block">
            <img
              src="/Docs Schlep-engne.svg?t=1725657600000"
              alt="Schlep Engine"
              className="h-8 w-auto cursor-pointer mx-auto"
            />
          </a>
        </div>

        {/* Menu Icons */}
        <div className="flex-1 flex flex-col items-center space-y-2 overflow-y-auto overflow-x-hidden hide-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveItem(item.id)
                item.onClick?.()
              }}
              className={`p-3 rounded-lg transition-all duration-150 group relative ${
                activeItem === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              title={item.name}
            >
              {item.icon}
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {item.name}
              </div>
            </button>
          ))}
        </div>

        {/* Toggle button at bottom */}
        <div className="p-2">
          <button
            onClick={onToggleCollapse}
            className="p-3 rounded-lg transition-all duration-150 text-gray-600 hover:bg-gray-200 w-full flex items-center justify-center"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Right Column - Content (only shown when not collapsed) */}
      {!collapsed && (
        <div className="flex flex-col w-64 h-full bg-white border-r border-gray-300 overflow-x-hidden">
          <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden hide-scrollbar">
            <nav className="px-4 pt-6 pb-4 space-y-1">
              {/* Section title */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900 break-words">
                  {menuItems.find(item => item.id === activeItem)?.name || 'Menu'}
                </h3>
              </div>

              {/* Content placeholder */}
              <div className="text-sm text-gray-600">
                <p>Click on the icons to access different features</p>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
