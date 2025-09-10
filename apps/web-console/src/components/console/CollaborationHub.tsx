'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users,
  Plus,
  Share2,
  MessageSquare,
  Star,
  FolderPlus,
  Settings,
  Eye,
  Lock,
  Globe,
  Download,
  Upload,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Edit,
  Trash2,
  Copy,
  Tag,
  Archive,
  Activity,
  BarChart3,
  FileText,
  CheckCircle2,
  AlertCircle,
  Send
} from 'lucide-react'
import { historyService, RequestCollection, RequestHistoryItem } from '../../services/history'

interface TeamMember {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  lastActive: string
  requestsCount: number
}

interface WorkspaceStats {
  totalRequests: number
  activeUsers: number
  sharedCollections: number
  avgResponseTime: number
  topEndpoints: Array<{ name: string; count: number }>
}

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  timestamp: string
  requestId?: string
  collectionId?: string
  mentions?: string[]
  edited?: boolean
}

export function CollaborationHub() {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'collections' | 'activity' | 'analytics'>('collections')
  const [collections, setCollections] = useState<RequestCollection[]>([])
  const [teamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'Sarah Chen',
      email: 'sarah@company.com',
      role: 'owner',
      lastActive: '2 minutes ago',
      requestsCount: 147
    },
    {
      id: '2',
      name: 'Mike Johnson',
      email: 'mike@company.com',
      role: 'admin',
      lastActive: '1 hour ago',
      requestsCount: 89
    },
    {
      id: '3',
      name: 'Alex Rivera',
      email: 'alex@company.com',
      role: 'member',
      lastActive: '3 hours ago',
      requestsCount: 65
    }
  ])
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<RequestCollection | null>(null)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterOwner, setFilterOwner] = useState('all')
  const [workspaceStats] = useState<WorkspaceStats>({
    totalRequests: 1234,
    activeUsers: 8,
    sharedCollections: 15,
    avgResponseTime: 245,
    topEndpoints: [
      { name: 'Create Digital Twin', count: 89 },
      { name: 'Search Datasets', count: 67 },
      { name: 'ML Experiment', count: 45 }
    ]
  })

  useEffect(() => {
    // Load collections from history service
    const loadedCollections = historyService.getCollections()
    setCollections(loadedCollections)

    // Mock comments
    setComments([
      {
        id: '1',
        userId: '1',
        userName: 'Sarah Chen',
        content: 'The digital twin endpoints are working great! Performance is much better than v1.',
        timestamp: '2024-01-15T10:30:00Z',
        requestId: 'req_123'
      },
      {
        id: '2',
        userId: '2',
        userName: 'Mike Johnson',
        content: 'Should we add error handling tests for the dataset quality endpoint?',
        timestamp: '2024-01-15T09:15:00Z',
        collectionId: 'col_456'
      }
    ])
  }, [])

  const createNewCollection = (name: string, description: string) => {
    const newCollection = historyService.createCollection({
      name,
      description,
      requests: [],
      shared: true,
      owner: 'current-user',
      collaborators: [],
      tags: []
    })
    setCollections(prev => [...prev, newCollection])
    setShowNewCollectionModal(false)
  }

  const shareCollection = (collectionId: string, collaboratorEmails: string[]) => {
    const updated = historyService.updateCollection(collectionId, {
      shared: true,
      collaborators: collaboratorEmails
    })
    if (updated) {
      setCollections(prev => prev.map(c => c.id === collectionId ? updated : c))
    }
    setShowShareModal(false)
  }

  const addComment = (content: string, targetId?: string, targetType?: 'request' | 'collection') => {
    const comment: Comment = {
      id: `comment_${Date.now()}`,
      userId: 'current-user',
      userName: 'You',
      content,
      timestamp: new Date().toISOString(),
      ...(targetType === 'request' && { requestId: targetId }),
      ...(targetType === 'collection' && { collectionId: targetId })
    }
    setComments(prev => [...prev, comment])
    setNewComment('')
  }

  const exportCollection = (collection: RequestCollection) => {
    const requests = collection.requests.map(id => historyService.getRequestById(id)).filter(Boolean)
    const exportData = {
      collection,
      requests,
      exportedAt: new Date().toISOString(),
      exportedBy: 'current-user'
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collection.name.replace(/[^a-zA-Z0-9]/g, '_')}_collection.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredCollections = collections.filter(collection => {
    const matchesSearch = searchQuery === '' || 
      collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesOwner = filterOwner === 'all' || 
      (filterOwner === 'me' && collection.owner === 'current-user') ||
      (filterOwner === 'shared' && collection.shared)
    
    return matchesSearch && matchesOwner
  })

  const getRoleColor = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'admin': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'member': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'viewer': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Collaboration Hub
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Team workspaces, shared collections, and collaborative API development
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Team Members */}
            <div className="flex -space-x-2">
              {teamMembers.slice(0, 4).map((member, index) => (
                <div
                  key={member.id}
                  className="relative group"
                  title={`${member.name} (${member.role})`}
                >
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-sm font-medium text-purple-600 dark:text-purple-400 border-2 border-white dark:border-gray-800">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                    index < 2 ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
              ))}
              {teamMembers.length > 4 && (
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400 border-2 border-white dark:border-gray-800">
                  +{teamMembers.length - 4}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowNewCollectionModal(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Collection</span>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Total Requests', value: workspaceStats.totalRequests.toLocaleString(), icon: Activity },
            { label: 'Active Users', value: workspaceStats.activeUsers.toString(), icon: Users },
            { label: 'Shared Collections', value: workspaceStats.sharedCollections.toString(), icon: Share2 },
            { label: 'Avg Response Time', value: `${workspaceStats.avgResponseTime}ms`, icon: Clock }
          ].map(({ label, value, icon: Icon }, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { key: 'collections', label: 'Collections', icon: FolderPlus },
            { key: 'workspaces', label: 'Workspaces', icon: Users },
            { key: 'activity', label: 'Activity Feed', icon: Activity },
            { key: 'analytics', label: 'Team Analytics', icon: BarChart3 }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === key
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'collections' && (
          <div className="h-full flex flex-col">
            {/* Collections Header */}
            <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Shared Collections
                </h2>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search collections..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <select
                    value={filterOwner}
                    onChange={(e) => setFilterOwner(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Collections</option>
                    <option value="me">My Collections</option>
                    <option value="shared">Shared with Me</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Collections Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCollections.map((collection) => (
                  <div
                    key={collection.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                    onClick={() => setSelectedCollection(collection)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <FolderPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {collection.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {collection.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {collection.shared && <Globe className="w-4 h-4 text-green-500" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCollection(collection)
                            setShowShareModal(true)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Collaborators */}
                      {collection.collaborators.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <div className="flex -space-x-1">
                            {collection.collaborators.slice(0, 3).map((email, index) => {
                              const member = teamMembers.find(m => m.email === email)
                              return (
                                <div
                                  key={email}
                                  className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 border border-white dark:border-gray-800"
                                  title={member?.name || email}
                                >
                                  {member?.name.split(' ').map(n => n[0]).join('') || email[0].toUpperCase()}
                                </div>
                              )
                            })}
                            {collection.collaborators.length > 3 && (
                              <div className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 border border-white dark:border-gray-800">
                                +{collection.collaborators.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {collection.collaborators.length} collaborator{collection.collaborators.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-600 dark:text-gray-400">
                            {collection.requests.length} request{collection.requests.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            Updated {new Date(collection.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Tags */}
                      {collection.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {collection.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {collection.tags.length > 3 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                              +{collection.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            exportCollection(collection)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Export collection"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          collection.shared ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {collection.shared ? 'Shared' : 'Private'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredCollections.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <FolderPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No collections found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Create your first collection to organize and share API requests with your team.
                    </p>
                    <button
                      onClick={() => setShowNewCollectionModal(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Collection</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="h-full flex flex-col">
            {/* Activity Feed */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Comment Form */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-sm font-medium text-purple-600 dark:text-purple-400">
                      Y
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Share an update with your team..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <MessageSquare className="w-4 h-4" />
                          <span>Supports @mentions and #hashtags</span>
                        </div>
                        <button
                          onClick={() => addComment(newComment)}
                          disabled={!newComment.trim()}
                          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          <span>Post</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Items */}
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-sm font-medium text-purple-600 dark:text-purple-400">
                        {comment.userName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {comment.userName}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(comment.timestamp).toLocaleString()}
                          </span>
                          {comment.edited && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                          {comment.content}
                        </p>
                        {(comment.requestId || comment.collectionId) && (
                          <div className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                            {comment.requestId ? <FileText className="w-3 h-3" /> : <FolderPlus className="w-3 h-3" />}
                            <span>
                              {comment.requestId ? 'On API Request' : 'On Collection'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Performance */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Team Performance
                  </h3>
                  <div className="space-y-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-sm font-medium text-purple-600 dark:text-purple-400">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {member.name}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {member.email}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {member.requestsCount} requests
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${getRoleColor(member.role)}`}>
                            {member.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Endpoints */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Most Used Endpoints
                  </h3>
                  <div className="space-y-3">
                    {workspaceStats.topEndpoints.map((endpoint, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400">
                            {index + 1}
                          </div>
                          <span className="text-gray-900 dark:text-white">{endpoint.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div 
                              className="h-full bg-purple-500 rounded-full" 
                              style={{ width: `${(endpoint.count / workspaceStats.topEndpoints[0].count) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">
                            {endpoint.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Collection
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                createNewCollection(
                  formData.get('name') as string,
                  formData.get('description') as string
                )
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Collection Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Digital Twin APIs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe what this collection contains..."
                />
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowNewCollectionModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}