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
  const isExpanded = !collapsed

  const buttonClass = isExpanded
    ? 'w-full pl-3 pr-2 py-2 flex items-center text-gray-600 hover:text-gray-900 transition-all duration-300 bg-transparent border-0'
    : 'w-full pl-4 pr-2 py-2 flex items-center text-gray-600 hover:text-gray-900 transition-all duration-300 bg-transparent border-0'

  const iconWrapperClass = 'w-5 h-5 flex-shrink-0'

  const textClass = isExpanded
    ? 'text-xs ml-2 whitespace-nowrap transition-all duration-300 opacity-100 w-auto'
    : 'text-xs ml-2 whitespace-nowrap transition-all duration-300 opacity-0 w-0 overflow-hidden'

  return (
    <>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        button[title] {
          --tooltip-delay: 0ms;
        }
        button[title]:hover::after {
          transition-delay: 0ms !important;
        }
      `}</style>
      <div
        className={`${isExpanded ? 'w-44' : 'w-14'} border-r border-gray-200 transition-all duration-300 ease-in-out absolute left-0 top-0 bottom-0 z-40 flex flex-col`}
        style={{backgroundColor: '#f2f1ee'}}
      >
      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{backgroundColor: '#f2f1ee'}}>
        <div className={isExpanded ? 'py-3 space-y-0.5 pb-0' : 'py-3 space-y-1 pb-0'} style={{backgroundColor: '#f2f1ee'}}>

          {/* API Endpoints */}
          {onOpenEndpointsModal && (
            <button onClick={onOpenEndpointsModal} className={buttonClass} title="API Endpoints">
              <List className={iconWrapperClass} />
              <span className={textClass}>API Endpoints</span>
            </button>
          )}

          {/* Request History */}
          {onOpenHistory && (
            <button onClick={onOpenHistory} className={buttonClass} title="Request History">
              <Clock className={iconWrapperClass} />
              <span className={textClass}>Request History</span>
            </button>
          )}

          {/* Settings */}
          {onOpenSettings && (
            <button onClick={onOpenSettings} className={buttonClass} title="Settings">
              <Settings className={iconWrapperClass} />
              <span className={textClass}>Settings</span>
            </button>
          )}

          {/* Webhook Tester */}
          {onOpenWebhookTester && (
            <button onClick={onOpenWebhookTester} className={buttonClass} title="Webhook Tester">
              <Zap className={iconWrapperClass} />
              <span className={textClass}>Webhook Tester</span>
            </button>
          )}

          {/* Security Console */}
          {onOpenSecurityConsole && (
            <button onClick={onOpenSecurityConsole} className={buttonClass} title="Security Console">
              <Shield className={iconWrapperClass} />
              <span className={textClass}>Security Console</span>
            </button>
          )}

          {/* Test Collection */}
          {onOpenTestCollection && (
            <button onClick={onOpenTestCollection} className={buttonClass} title="Test Collection">
              <FileText className={iconWrapperClass} />
              <span className={textClass}>Test Collection</span>
            </button>
          )}
        </div>
      </div>

      {/* Hamburger Menu at Bottom */}
      <div className="py-3" style={{backgroundColor: '#f2f1ee'}}>
        <button
          onClick={onToggleCollapse}
          className={isExpanded ? 'w-full pl-3 pr-2 py-2 flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-transparent border-0' : 'w-full pl-4 pr-2 py-2 flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-transparent border-0'}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <Menu className="w-5 h-5 flex-shrink-0" />
        </button>
      </div>
      </div>
    </>
  )
}
