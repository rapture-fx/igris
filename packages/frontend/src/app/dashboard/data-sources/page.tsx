'use client'

import { useState, useMemo } from 'react'
import { 
  Database, 
  Plus, 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  MoreHorizontal,
  Eye,
  Download,
  Settings,
  Trash2,
  RefreshCw,
  Calendar,
  FileText,
  Globe,
  Server,
  Layers,
  Target,
  Activity,
  Zap,
  Shield,
  Star,
  Tag,
  ExternalLink,
  ArrowUpRight,
  ChevronDown,
  SortAsc,
  SortDesc
} from 'lucide-react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn, formatNumber, getTimeAgo } from '@/lib/utils'
import { StatCard } from '@/components/dashboard/stat-card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Mock data for data sources
const mockDataSources = [
  {
    id: 'ds_1',
    name: 'Customer Database',
    type: 'PostgreSQL',
    status: 'active',
    records: 125000,
    quality_score: 92,
    last_sync: '2024-01-15T10:30:00Z',
    size: '2.4 GB',
    tables: 8,
    connection_health: 'excellent',
    tags: ['production', 'customers', 'crm'],
    description: 'Primary customer database with user profiles and transaction history'
  },
  {
    id: 'ds_2',
    name: 'Sales Analytics',
    type: 'BigQuery',
    status: 'active',
    records: 890000,
    quality_score: 88,
    last_sync: '2024-01-15T09:15:00Z',
    size: '5.2 GB',
    tables: 12,
    connection_health: 'good',
    tags: ['analytics', 'sales', 'revenue'],
    description: 'Sales performance data and revenue analytics'
  },
  {
    id: 'ds_3',
    name: 'Product Catalog',
    type: 'MongoDB',
    status: 'syncing',
    records: 45000,
    quality_score: 95,
    last_sync: '2024-01-15T08:45:00Z',
    size: '1.8 GB',
    tables: 5,
    connection_health: 'excellent',
    tags: ['products', 'inventory', 'catalog'],
    description: 'Product information and inventory management'
  },
  {
    id: 'ds_4',
    name: 'Legacy System',
    type: 'MySQL',
    status: 'warning',
    records: 230000,
    quality_score: 67,
    last_sync: '2024-01-14T16:20:00Z',
    size: '3.1 GB',
    tables: 15,
    connection_health: 'poor',
    tags: ['legacy', 'migration', 'archive'],
    description: 'Legacy system data pending migration'
  },
  {
    id: 'ds_5',
    name: 'Marketing Data',
    type: 'Snowflake',
    status: 'active',
    records: 567000,
    quality_score: 91,
    last_sync: '2024-01-15T11:00:00Z',
    size: '4.7 GB',
    tables: 9,
    connection_health: 'excellent',
    tags: ['marketing', 'campaigns', 'leads'],
    description: 'Marketing campaigns and lead generation data'
  },
  {
    id: 'ds_6',
    name: 'API Logs',
    type: 'Elasticsearch',
    status: 'inactive',
    records: 1250000,
    quality_score: 78,
    last_sync: '2024-01-13T14:30:00Z',
    size: '8.9 GB',
    tables: 3,
    connection_health: 'disconnected',
    tags: ['logs', 'api', 'monitoring'],
    description: 'API request logs and monitoring data'
  }
]

const statusConfig = {
  active: { 
    label: 'Active', 
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle2
  },
  syncing: { 
    label: 'Syncing', 
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: RefreshCw
  },
  warning: { 
    label: 'Warning', 
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: AlertTriangle
  },
  inactive: { 
    label: 'Inactive', 
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: Clock
  }
}

const healthConfig = {
  excellent: { label: 'Excellent', color: 'text-green-600', score: 95 },
  good: { label: 'Good', color: 'text-blue-600', score: 80 },
  poor: { label: 'Poor', color: 'text-yellow-600', score: 60 },
  disconnected: { label: 'Disconnected', color: 'text-red-600', score: 0 }
}

const typeIcons = {
  PostgreSQL: Database,
  BigQuery: BarChart3,
  MongoDB: Layers,
  MySQL: Server,
  Snowflake: Globe,
  Elasticsearch: Search
}

export default function DataSourcesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredAndSortedSources = useMemo(() => {
    let filtered = mockDataSources.filter(source => {
      const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           source.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           source.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = filterType === 'all' || source.type === filterType
      const matchesStatus = filterStatus === 'all' || source.status === filterStatus
      
      return matchesSearch && matchesType && matchesStatus
    })

    return filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof typeof a]
      let bValue: any = b[sortBy as keyof typeof b]
      
      if (sortBy === 'last_sync') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [searchTerm, filterType, filterStatus, sortBy, sortOrder])

  const stats = useMemo(() => ({
    total: mockDataSources.length,
    active: mockDataSources.filter(s => s.status === 'active').length,
    avgQuality: Math.round(mockDataSources.reduce((acc, s) => acc + s.quality_score, 0) / mockDataSources.length),
    totalRecords: mockDataSources.reduce((acc, s) => acc + s.records, 0)
  }), [])

  const DataSourceCard = ({ source }: { source: typeof mockDataSources[0] }) => {
    const StatusIcon = statusConfig[source.status as keyof typeof statusConfig]?.icon || CheckCircle2
    const TypeIcon = typeIcons[source.type as keyof typeof typeIcons] || Database

    return (
      <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200/60 hover:border-gray-300">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <TypeIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {source.name}
                </CardTitle>
                <CardDescription className="text-sm text-gray-500">
                  {source.type}
                </CardDescription>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-2">{source.description}</p>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("text-xs", statusConfig[source.status as keyof typeof statusConfig]?.color)}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig[source.status as keyof typeof statusConfig]?.label}
            </Badge>
            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
              {formatNumber(source.records)} records
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1">
            {source.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                {tag}
              </Badge>
            ))}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Quality Score</p>
              <p className="font-semibold text-gray-900">{source.quality_score}%</p>
            </div>
            <div>
              <p className="text-gray-500">Last Sync</p>
              <p className="font-semibold text-gray-900">{getTimeAgo(source.last_sync)}</p>
            </div>
            <div>
              <p className="text-gray-500">Size</p>
              <p className="font-semibold text-gray-900">{source.size}</p>
            </div>
            <div>
              <p className="text-gray-500">Health</p>
              <p className={cn("font-semibold", healthConfig[source.connection_health as keyof typeof healthConfig]?.color)}>
                {healthConfig[source.connection_health as keyof typeof healthConfig]?.label}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const DataSourceListItem = ({ source }: { source: typeof mockDataSources[0] }) => {
    const StatusIcon = statusConfig[source.status as keyof typeof statusConfig]?.icon || CheckCircle2
    const TypeIcon = typeIcons[source.type as keyof typeof typeIcons] || Database

    return (
      <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
            <TypeIcon className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{source.name}</h3>
              <Badge 
                variant="outline" 
                className={cn("text-xs", statusConfig[source.status as keyof typeof statusConfig]?.color)}
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig[source.status as keyof typeof statusConfig]?.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 truncate">{source.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Records</p>
            <p className="font-semibold text-gray-900">{formatNumber(source.records)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Quality</p>
            <p className="font-semibold text-gray-900">{source.quality_score}%</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Last Sync</p>
            <p className="font-semibold text-gray-900">{getTimeAgo(source.last_sync)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="w-4 h-4 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Data Sources"
        description="Manage and monitor your connected data sources"
        stats={[
          {
            label: 'Total Sources',
            value: stats.total,
            icon: Database,
            color: 'blue'
          },
          {
            label: 'Active',
            value: stats.active,
            icon: CheckCircle2,
            color: 'green'
          },
          {
            label: 'Avg Quality',
            value: `${stats.avgQuality}%`,
            icon: Target,
            color: 'purple'
          },
          {
            label: 'Total Records',
            value: formatNumber(stats.totalRecords),
            icon: BarChart3,
            color: 'yellow'
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Secondary
              icon={Upload}
            >
              Import
            </PageHeaderActions.Secondary>
            <PageHeaderActions.Primary
              icon={Plus}
            >
              Add Source
            </PageHeaderActions.Primary>
          </div>
        }
      />

      {/* Filters and Search */}
      <Card className="border-gray-200/60">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search data sources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
                  <SelectItem value="BigQuery">BigQuery</SelectItem>
                  <SelectItem value="MongoDB">MongoDB</SelectItem>
                  <SelectItem value="MySQL">MySQL</SelectItem>
                  <SelectItem value="Snowflake">Snowflake</SelectItem>
                  <SelectItem value="Elasticsearch">Elasticsearch</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="syncing">Syncing</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="quality_score">Quality</SelectItem>
                  <SelectItem value="records">Records</SelectItem>
                  <SelectItem value="last_sync">Last Sync</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center border border-gray-200 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 w-8 p-0"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card className="border-gray-200/60">
        <CardContent className="p-6">
          {filteredAndSortedSources.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Sources Found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Data Source
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedSources.map((source) => (
                <DataSourceCard key={source.id} source={source} />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredAndSortedSources.map((source) => (
                <DataSourceListItem key={source.id} source={source} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 