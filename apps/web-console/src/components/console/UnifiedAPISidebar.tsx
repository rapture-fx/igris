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
  const [isHovered, setIsHovered] = useState(false)
  const isExpanded = !collapsed || isHovered

  return (
    <div
      className={`${isExpanded ? 'w-48' : 'w-14'} border-r border-gray-200 transition-all duration-300 ease-in-out absolute left-0 top-0 bottom-0 z-40 flex flex-col`}
      style={{backgroundColor: '#f2f1ed'}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => collapsed && setIsHovered(false)}
    >
      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto" style={{backgroundColor: '#f2f1ed'}}>
        <div className={isExpanded ? 'px-2 py-3 space-y-0.5' : 'py-3 space-y-1'}>

          {/* API Endpoints */}
          {onOpenEndpointsModal && (
            <button
              onClick={onOpenEndpointsModal}
              className={
                isExpanded
                  ? 'w-full px-2 py-2 flex items-center gap-2 rounded text-gray-600 hover:text-gray-900 transition-colors'
                  : 'w-10 h-10 mx-auto flex items-center justify-center rounded text-gray-600 hover:text-gray-900 transition-colors'
              }
              title="API Endpoints"
              style={{backgroundColor: '#f2f1ed'}}
            >
              <List className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-xs">API Endpoints</span>
              )}
            </button>
          )}

          {/* Request History */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className={
                isExpanded
                  ? 'w-full px-2 py-2 flex items-center gap-2 rounded text-gray-600 hover:text-gray-900 transition-colors'
                  : 'w-10 h-10 mx-auto flex items-center justify-center rounded text-gray-600 hover:text-gray-900 transition-colors'
              }
              title="Request History"
              style={{backgroundColor: '#f2f1ed'}}
            >
              <Clock className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-xs">Request History</span>
              )}
            </button>
          )}

          {/* Settings */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className={
                isExpanded
                  ? 'w-full px-2 py-2 flex items-center gap-2 rounded text-gray-600 hover:text-gray-900 transition-colors'
                  : 'w-10 h-10 mx-auto flex items-center justify-center rounded text-gray-600 hover:text-gray-900 transition-colors'
              }
              title="Settings"
              style={{backgroundColor: '#f2f1ed'}}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-xs">Settings</span>
              )}
            </button>
          )}

          {/* Webhook Tester */}
          {onOpenWebhookTester && (
            <button
              onClick={onOpenWebhookTester}
              className={
                isExpanded
                  ? 'w-full px-2 py-2 flex items-center gap-2 rounded text-gray-600 hover:text-gray-900 transition-colors'
                  : 'w-10 h-10 mx-auto flex items-center justify-center rounded text-gray-600 hover:text-gray-900 transition-colors'
              }
              title="Webhook Tester"
              style={{backgroundColor: '#f2f1ed'}}
            >
              <Zap className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-xs">Webhook Tester</span>
              )}
            </button>
          )}

          {/* Security Console */}
          {onOpenSecurityConsole && (
            <button
              onClick={onOpenSecurityConsole}
              className={
                isExpanded
                  ? 'w-full px-2 py-2 flex items-center gap-2 rounded text-gray-600 hover:text-gray-900 transition-colors'
                  : 'w-10 h-10 mx-auto flex items-center justify-center rounded text-gray-600 hover:text-gray-900 transition-colors'
              }
              title="Security Console"
              style={{backgroundColor: '#f2f1ed'}}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-xs">Security Console</span>
              )}
            </button>
          )}

          {/* Test Collection */}
          {onOpenTestCollection && (
            <button
              onClick={onOpenTestCollection}
              className={
                isExpanded
                  ? 'w-full px-2 py-2 flex items-center gap-2 rounded text-gray-600 hover:text-gray-900 transition-colors'
                  : 'w-10 h-10 mx-auto flex items-center justify-center rounded text-gray-600 hover:text-gray-900 transition-colors'
              }
              title="Test Collection"
              style={{backgroundColor: '#f2f1ed'}}
            >
              <FileText className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-xs">Test Collection</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Hamburger Menu at Bottom */}
      <div className="py-3 flex items-center justify-center" style={{backgroundColor: '#f2f1ed'}}>
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
          style={{backgroundColor: '#f2f1ed'}}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
