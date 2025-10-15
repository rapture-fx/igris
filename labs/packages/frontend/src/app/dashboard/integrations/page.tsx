'use client'

import { useState } from 'react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { 
  Globe, 
  Plus, 
  RefreshCw,
  Search,
  Filter,
  Settings,
  CheckCircle,
  AlertTriangle,
  Clock,
  Link2,
  ExternalLink,
  Database,
  Cloud,
  Zap,
  Shield,
  BarChart3,
  FileText,
  Mail,
  MessageSquare,
  Calendar,
  Users,
  Cpu,
  Activity,
  Target,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Integration {
  id: string
  name: string
  description: string
  category: string
  provider: string
  logo: string
  isConnected: boolean
  status: 'active' | 'inactive' | 'error' | 'pending'
  lastSync?: string
  setupComplexity: 'easy' | 'medium' | 'advanced'
  features: string[]
}

const mockIntegrations: Integration[] = [
  {
    id: '1',
    name: 'PostgreSQL',
    description: 'Connect to PostgreSQL databases for data ingestion and analysis',
    category: 'Database',
    provider: 'PostgreSQL',
    logo: '/api/placeholder/48/48',
    isConnected: true,
    status: 'active',
    lastSync: '2024-01-15T10:30:00Z',
    setupComplexity: 'easy',
    features: ['Real-time sync', 'Query optimization', 'Schema detection']
  },
  {
    id: '2',
    name: 'AWS S3',
    description: 'Store and retrieve data from Amazon S3 buckets',
    category: 'Cloud Storage',
    provider: 'Amazon Web Services',
    logo: '/api/placeholder/48/48',
    isConnected: true,
    status: 'active',
    lastSync: '2024-01-15T09:15:00Z',
    setupComplexity: 'medium',
    features: ['Bulk upload', 'Automatic backup', 'Versioning']
  },
  {
    id: '3',
    name: 'Slack',
    description: 'Send notifications and alerts to Slack channels',
    category: 'Communication',
    provider: 'Slack Technologies',
    logo: '/api/placeholder/48/48',
    isConnected: false,
    status: 'inactive',
    setupComplexity: 'easy',
    features: ['Channel notifications', 'Alert management', 'Bot integration']
  },
  {
    id: '4',
    name: 'Tableau',
    description: 'Export data and visualizations to Tableau dashboards',
    category: 'Analytics',
    provider: 'Tableau Software',
    logo: '/api/placeholder/48/48',
    isConnected: false,
    status: 'inactive',
    setupComplexity: 'advanced',
    features: ['Dashboard sync', 'Real-time updates', 'Custom connectors']
  },
  {
    id: '5',
    name: 'Snowflake',
    description: 'Connect to Snowflake data warehouse for enterprise analytics',
    category: 'Database',
    provider: 'Snowflake Inc.',
    logo: '/api/placeholder/48/48',
    isConnected: true,
    status: 'error',
    lastSync: '2024-01-14T15:45:00Z',
    setupComplexity: 'advanced',
    features: ['Data sharing', 'Secure views', 'Performance optimization']
  },
  {
    id: '6',
    name: 'Zapier',
    description: 'Automate workflows with 5000+ apps and services',
    category: 'Automation',
    provider: 'Zapier Inc.',
    logo: '/api/placeholder/48/48',
    isConnected: false,
    status: 'inactive',
    setupComplexity: 'medium',
    features: ['Workflow automation', 'Multi-step zaps', 'Error handling']
  }
]

const categories = ['All', 'Database', 'Cloud Storage', 'Communication', 'Analytics', 'Automation']

const statusColors = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200'
}

const statusIcons = {
  active: CheckCircle,
  inactive: Clock,
  error: AlertTriangle,
  pending: Clock
}

const complexityColors = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-yellow-50 text-yellow-700',
  advanced: 'bg-red-50 text-red-700'
}

const categoryIcons = {
  Database: Database,
  'Cloud Storage': Cloud,
  Communication: MessageSquare,
  Analytics: BarChart3,
  Automation: Zap
}

export default function IntegrationsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const filteredIntegrations = mockIntegrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || integration.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'connected' && integration.isConnected) ||
                         (statusFilter === 'disconnected' && !integration.isConnected) ||
                         integration.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const stats = {
    total: mockIntegrations.length,
    connected: mockIntegrations.filter(i => i.isConnected).length,
    active: mockIntegrations.filter(i => i.status === 'active').length,
    errors: mockIntegrations.filter(i => i.status === 'error').length
  }

  const IntegrationCard = ({ integration }: { integration: Integration }) => {
    const StatusIcon = statusIcons[integration.status]
    const CategoryIcon = categoryIcons[integration.category as keyof typeof categoryIcons] || Link2
    
    return (
      <Card className="border-gray-200/60 hover:shadow-lg transition-all duration-200 cursor-pointer"
            onClick={() => setSelectedIntegration(integration)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <CategoryIcon className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">{integration.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span>{integration.provider}</span>
                  <span>•</span>
                  <Badge className={cn('text-xs', complexityColors[integration.setupComplexity])}>
                    {integration.setupComplexity}
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <Badge className={cn('border', statusColors[integration.status])}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {integration.isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-2">{integration.description}</p>
          
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {integration.category}
            </Badge>
            {integration.lastSync && (
              <span className="text-xs text-gray-500">
                Last sync: {new Date(integration.lastSync).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {integration.features.slice(0, 2).map((feature, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
            {integration.features.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{integration.features.length - 2}
              </Badge>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className={cn(
                "flex-1",
                integration.isConnected 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
              onClick={(e) => {
                e.stopPropagation()
                // Handle connect/disconnect
              }}
            >
              {integration.isConnected ? 'Disconnect' : 'Connect'}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                // Handle settings
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your favorite tools and services to streamline your data workflows and enhance productivity."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Integrations' }
        ]}
        stats={[
          {
            label: 'Total Integrations',
            value: stats.total,
            icon: Globe,
            color: 'blue'
          },
          {
            label: 'Connected',
            value: stats.connected,
            icon: CheckCircle,
            color: 'green'
          },
          {
            label: 'Active',
            value: stats.active,
            icon: Activity,
            color: 'green'
          },
          {
            label: 'Errors',
            value: stats.errors,
            icon: AlertTriangle,
            color: 'red'
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Refresh 
              onClick={handleRefresh}
              isLoading={isRefreshing}
              tooltip="Refresh integrations"
            />
            <PageHeaderActions.Secondary
              icon={Settings}
              onClick={() => {}}
            >
              Settings
            </PageHeaderActions.Secondary>
            <PageHeaderActions.Primary
              icon={Plus}
              onClick={() => {}}
            >
              Add Integration
            </PageHeaderActions.Primary>
          </div>
        }
      />

      {/* Filters */}
      <Card className="border-gray-200/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="connected">Connected</option>
              <option value="disconnected">Disconnected</option>
              <option value="active">Active</option>
              <option value="error">Error</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Grid */}
      {filteredIntegrations.length === 0 ? (
        <Card className="border-gray-200/60">
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No Integrations Found</h3>
                <p className="text-gray-600 mt-2">
                  {searchTerm || categoryFilter !== 'All' || statusFilter !== 'all'
                    ? 'No integrations match your current filters.'
                    : 'Get started by connecting your first integration.'
                  }
                </p>
              </div>
              <div className="flex justify-center gap-3">
                {(searchTerm || categoryFilter !== 'All' || statusFilter !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setCategoryFilter('All')
                      setStatusFilter('all')
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Clear Filters
                  </Button>
                )}
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Browse Integrations
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      )}

      {/* Integration Details Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Globe className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedIntegration.name}</h2>
                    <p className="text-gray-600">{selectedIntegration.provider}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">About</h3>
                  <p className="text-gray-600">{selectedIntegration.description}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Features</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedIntegration.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    className={cn(
                      "flex-1",
                      selectedIntegration.isConnected 
                        ? "bg-red-600 hover:bg-red-700 text-white" 
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                  >
                    {selectedIntegration.isConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                  <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 