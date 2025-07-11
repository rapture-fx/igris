'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, Plus, RefreshCw, Settings, Filter, Search, Download, Upload, MoreHorizontal } from 'lucide-react'
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: Array<{
    label: string
    href?: string
  }>
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  actions?: ReactNode
  className?: string
  showDivider?: boolean
  stats?: Array<{
    label: string
    value: string | number
    icon?: React.ElementType
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  }>
}

const statColors = {
  blue: 'text-blue-600 bg-blue-50',
  green: 'text-green-600 bg-green-50',
  yellow: 'text-yellow-600 bg-yellow-50',
  red: 'text-red-600 bg-red-50',
  purple: 'text-purple-600 bg-purple-50',
  gray: 'text-gray-600 bg-gray-50'
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  className,
  showDivider = true,
  stats
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-2 text-sm text-gray-500">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center space-x-2">
              {index > 0 && <ChevronRight className="w-4 h-4" />}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-gray-700 transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Header Content */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          {/* Title and Badge */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {title}
            </h1>
            {badge && (
              <Badge variant={badge.variant || 'default'} className="font-medium">
                {badge.text}
              </Badge>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-gray-600 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}

          {/* Stats */}
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-6 pt-2">
              {stats.map((stat, index) => (
                <div key={index} className="flex items-center gap-2">
                  {stat.icon && (
                    <div className={cn(
                      "p-1.5 rounded-lg",
                      statColors[stat.color || 'gray']
                    )}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Divider */}
      {showDivider && (
        <Separator className="bg-gray-100" />
      )}
    </div>
  )
}

// Common action components for reuse
export const PageHeaderActions = {
  Primary: ({ children, onClick, icon: Icon, ...props }: {
    children: ReactNode
    onClick?: () => void
    icon?: React.ElementType
    [key: string]: any
  }) => (
    <Button
      onClick={onClick}
      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </Button>
  ),

  Secondary: ({ children, onClick, icon: Icon, ...props }: {
    children: ReactNode
    onClick?: () => void
    icon?: React.ElementType
    [key: string]: any
  }) => (
    <Button
      variant="outline"
      onClick={onClick}
      className="border-gray-300 text-gray-700 hover:bg-gray-50"
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </Button>
  ),

  Icon: ({ onClick, icon: Icon, tooltip, ...props }: {
    onClick?: () => void
    icon: React.ElementType
    tooltip?: string
    [key: string]: any
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      title={tooltip}
      {...props}
    >
      <Icon className="w-4 h-4" />
    </Button>
  ),

  Refresh: ({ onClick, isLoading, ...props }: {
    onClick?: () => void
    isLoading?: boolean
    [key: string]: any
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      disabled={isLoading}
      {...props}
    >
      <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
    </Button>
  ),

  Create: ({ onClick, ...props }: {
    onClick?: () => void
    [key: string]: any
  }) => (
    <Button
      onClick={onClick}
      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
      {...props}
    >
      <Plus className="w-4 h-4 mr-2" />
      Create New
    </Button>
  ),

  Upload: ({ onClick, ...props }: {
    onClick?: () => void
    [key: string]: any
  }) => (
    <Button
      variant="outline"
      onClick={onClick}
      className="border-gray-300 text-gray-700 hover:bg-gray-50"
      {...props}
    >
      <Upload className="w-4 h-4 mr-2" />
      Upload
    </Button>
  ),

  Export: ({ onClick, ...props }: {
    onClick?: () => void
    [key: string]: any
  }) => (
    <Button
      variant="outline"
      onClick={onClick}
      className="border-gray-300 text-gray-700 hover:bg-gray-50"
      {...props}
    >
      <Download className="w-4 h-4 mr-2" />
      Export
    </Button>
  ),

  Filter: ({ onClick, isActive, ...props }: {
    onClick?: () => void
    isActive?: boolean
    [key: string]: any
  }) => (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        isActive 
          ? "bg-blue-600 hover:bg-blue-700 text-white"
          : "border-gray-300 text-gray-700 hover:bg-gray-50"
      )}
      {...props}
    >
      <Filter className="w-4 h-4 mr-2" />
      Filter
    </Button>
  ),

  Search: ({ onClick, ...props }: {
    onClick?: () => void
    [key: string]: any
  }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="border-gray-300 text-gray-700 hover:bg-gray-50"
      {...props}
    >
      <Search className="w-4 h-4 mr-2" />
      Search
    </Button>
  ),

  More: ({ onClick, ...props }: {
    onClick?: () => void
    [key: string]: any
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      {...props}
    >
      <MoreHorizontal className="w-4 h-4" />
    </Button>
  ),
} 