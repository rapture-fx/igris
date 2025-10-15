'use client'

import React from 'react'
import {
  Book,
  Zap,
  Shield,
  AlertCircle,
  Brain,
  Settings,
  TrendingUp,
  Filter,
  Database,
  Layers,
  Upload,
  BarChart3,
  Sparkles,
  Download,
  Clock,
  List,
  Search,
  CheckCircle,
  Activity,
  HelpCircle,
  Code,
  Globe,
  Key
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<any>> = {
  Book,
  Zap,
  Shield,
  AlertCircle,
  Brain,
  Settings,
  TrendingUp,
  Filter,
  Database,
  Layers,
  Upload,
  BarChart3,
  Sparkles,
  Download,
  Clock,
  List,
  Search,
  CheckCircle,
  Activity,
  HelpCircle,
  Code,
  Globe,
  Key
}

interface DynamicIconProps {
  name: string
  className?: string
}

export function DynamicIcon({ name, className = "w-4 h-4" }: DynamicIconProps) {
  const IconComponent = iconMap[name]
  
  if (!IconComponent) {
    // Fallback to a default icon if the requested icon is not found
    return <AlertCircle className={className} />
  }
  
  return <IconComponent className={className} />
} 