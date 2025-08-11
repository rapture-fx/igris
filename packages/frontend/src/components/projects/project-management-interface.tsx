'use client'

import { useState, useEffect } from 'react'
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Star,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Share2,
  GitBranch,
  BarChart3,
  Target,
  Activity,
  MessageSquare,
  Settings,
  Archive,
  Download,
  Upload,
  RefreshCw,
  User,
  Crown,
  GraduationCap,
  Zap,
  Database,
  FileText,
  Tags,
  Layers,
  TrendingUp,
  Sparkles,
  Coffee,
  Lightbulb,
  Rocket,
  Shield,
  Globe,
  Cpu
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarContent, AvatarFallback } from '@/components/ui/avatar'
import { cn, formatNumber, getTimeAgo } from '@/lib/utils'

// Project types and interfaces
interface Project {
  id: string
  name: string
  description: string
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'critical'
  progress: number
  team: TeamMember[]
  owner: TeamMember
  created_at: string
  updated_at: string
  due_date?: string
  tags: string[]
  stats: {
    datasets: number
    pipelines: number
    analyses: number
    models: number
  }
  recent_activity: ActivityItem[]
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'analyst' | 'viewer'
  avatar?: string
}

interface ActivityItem {
  id: string
  type: 'created' | 'updated' | 'completed' | 'commented' | 'shared'
  description: string
  user: TeamMember
  timestamp: string
}

// Mock data
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Customer Churn Analysis',
    description: 'Predictive model to identify customers likely to churn',
    status: 'active',
    priority: 'high',
    progress: 75,
    team: [
      { id: '1', name: 'Alice Johnson', email: 'alice@company.com', role: 'owner' },
      { id: '2', name: 'Bob Smith', email: 'bob@company.com', role: 'analyst' },
      { id: '3', name: 'Carol White', email: 'carol@company.com', role: 'viewer' }
    ],
    owner: { id: '1', name: 'Alice Johnson', email: 'alice@company.com', role: 'owner' },
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-15T14:30:00Z',
    due_date: '2024-02-01T23:59:59Z',
    tags: ['ml', 'customer', 'prediction'],
    stats: {
      datasets: 3,
      pipelines: 2,
      analyses: 5,
      models: 1
    },
    recent_activity: [
      {
        id: '1',
        type: 'updated',
        description: 'Updated model parameters',
        user: { id: '2', name: 'Bob Smith', email: 'bob@company.com', role: 'analyst' },
        timestamp: '2024-01-15T14:30:00Z'
      }
    ]
  },
  {
    id: '2',
    name: 'Sales Forecasting',
    description: 'Time series analysis for sales prediction',
    status: 'planning',
    priority: 'medium',
    progress: 25,
    team: [
      { id: '4', name: 'David Brown', email: 'david@company.com', role: 'owner' },
      { id: '5', name: 'Eva Green', email: 'eva@company.com', role: 'analyst' }
    ],
    owner: { id: '4', name: 'David Brown', email: 'david@company.com', role: 'owner' },
    created_at: '2024-01-12T10:00:00Z',
    updated_at: '2024-01-14T09:15:00Z',
    due_date: '2024-03-15T23:59:59Z',
    tags: ['forecasting', 'sales', 'timeseries'],
    stats: {
      datasets: 1,
      pipelines: 0,
      analyses: 2,
      models: 0
    },
    recent_activity: [
      {
        id: '2',
        type: 'created',
        description: 'Project created',
        user: { id: '4', name: 'David Brown', email: 'david@company.com', role: 'owner' },
        timestamp: '2024-01-12T10:00:00Z'
      }
    ]
  }
]

const statusConfig = {
  planning: { 
    label: 'Planning', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: Clock 
  },
  active: { 
    label: 'Active', 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: Activity 
  },
  paused: { 
    label: 'Paused', 
    color: 'bg-gray-100 text-gray-800 border-gray-200', 
    icon: Clock 
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-green-100 text-green-800 border-green-200', 
    icon: CheckCircle2 
  },
  archived: { 
    label: 'Archived', 
    color: 'bg-gray-100 text-gray-600 border-gray-200', 
    icon: Archive 
  }
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' }
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  analyst: GraduationCap,
  viewer: User
}

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
  onShare: (project: Project) => void
}

function ProjectCard({ project, onEdit, onDelete, onShare }: ProjectCardProps) {
  const statusInfo = statusConfig[project.status]
  const priorityInfo = priorityConfig[project.priority]

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-1">
                {project.name}
              </CardTitle>
              <Badge variant="outline" className={cn("text-xs", priorityInfo.color)}>
                {priorityInfo.label}
              </Badge>
            </div>
            <CardDescription className="text-gray-600 line-clamp-2">
              {project.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onShare(project)}
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status and Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <statusInfo.icon className="w-4 h-4" />
              <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
            </div>
            <span className="text-sm font-medium text-gray-600">
              {project.progress}%
            </span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {project.stats.datasets}
            </div>
            <div className="text-xs text-gray-500">Datasets</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {project.stats.pipelines}
            </div>
            <div className="text-xs text-gray-500">Pipelines</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {project.stats.analyses}
            </div>
            <div className="text-xs text-gray-500">Analyses</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {project.stats.models}
            </div>
            <div className="text-xs text-gray-500">Models</div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {project.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{project.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* Team and Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex -space-x-2">
            {project.team.slice(0, 3).map((member, index) => {
              const RoleIcon = roleIcons[member.role]
              return (
                <div key={member.id} className="relative">
                  <Avatar className="w-8 h-8 border-2 border-white">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <RoleIcon className="absolute -bottom-1 -right-1 w-3 h-3 text-gray-600 bg-white rounded-full p-0.5" />
                </div>
              )
            })}
            {project.team.length > 3 && (
              <div className="w-8 h-8 bg-gray-100 border-2 border-white rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  +{project.team.length - 3}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onEdit(project)}>
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
          </div>
        </div>

        {/* Last Activity */}
        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
          Updated {getTimeAgo(project.updated_at)}
        </div>
      </CardContent>
    </Card>
  )
}

interface ProjectFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  statusFilter: string
  setStatusFilter: (status: string) => void
  priorityFilter: string
  setPriorityFilter: (priority: string) => void
  sortBy: string
  setSortBy: (sort: string) => void
}

function ProjectFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  sortBy,
  setSortBy
}: ProjectFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently Updated</SelectItem>
            <SelectItem value="created">Recently Created</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
            <SelectItem value="due_date">Due Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function ProjectManagementInterface() {
  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(mockProjects)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTab, setActiveTab] = useState('all')

  // Filter and sort projects
  useEffect(() => {
    let filtered = projects

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(project => project.priority === priorityFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        case 'progress':
          return b.progress - a.progress
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        default:
          return 0
      }
    })

    setFilteredProjects(filtered)
  }, [projects, searchTerm, statusFilter, priorityFilter, sortBy])

  const handleEditProject = (project: Project) => {
    console.log('Edit project:', project)
  }

  const handleDeleteProject = (projectId: string) => {
    setProjects(projects.filter(p => p.id !== projectId))
  }

  const handleShareProject = (project: Project) => {
    console.log('Share project:', project)
  }

  const handleCreateProject = () => {
    console.log('Create new project')
  }

  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    avgProgress: Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
          <p className="text-gray-600 mt-1">
            Manage and track your data science projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateProject}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderKanban className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{projectStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{projectStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{projectStats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold text-gray-900">{projectStats.avgProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="my">My Projects</TabsTrigger>
          <TabsTrigger value="shared">Shared with Me</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {/* Filters */}
          <ProjectFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />

          {/* Projects Grid */}
          {filteredProjects.length > 0 ? (
            <div className={cn(
              "grid gap-6",
              viewMode === 'grid' 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                : "grid-cols-1"
            )}>
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  onShare={handleShareProject}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FolderKanban className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters to see more projects.'
                  : 'Get started by creating your first project.'}
              </p>
              <Button onClick={handleCreateProject}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 