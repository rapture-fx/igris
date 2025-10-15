'use client'

import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Folder, 
  File, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy, 
  Star, 
  Archive,
  Download,
  Upload,
  FolderPlus,
  Tag,
  Clock,
  Share,
  Play
} from 'lucide-react'

interface SavedRequest {
  id: string
  name: string
  description?: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers: Record<string, string>
  body?: string
  tags: string[]
  collectionId: string
  createdAt: string
  updatedAt: string
  favorite: boolean
  lastUsed?: string
}

interface Collection {
  id: string
  name: string
  description?: string
  color: string
  requests: SavedRequest[]
  createdAt: string
  updatedAt: string
  shared: boolean
  archived: boolean
}

interface RequestCollectionsProps {
  isOpen: boolean
  onClose: () => void
  onLoadRequest: (request: SavedRequest) => void
  onSaveRequest: (request: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>) => void
}

const RequestCollections: React.FC<RequestCollectionsProps> = ({
  isOpen,
  onClose,
  onLoadRequest,
  onSaveRequest
}) => {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false)
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)
  const [editingRequest, setEditingRequest] = useState<SavedRequest | null>(null)
  const [view, setView] = useState<'collections' | 'all' | 'favorites' | 'recent'>('collections')

  // Load collections from localStorage on mount
  useEffect(() => {
    const savedCollections = localStorage.getItem('api-console-collections')
    if (savedCollections) {
      setCollections(JSON.parse(savedCollections))
    } else {
      // Initialize with default collection
      const defaultCollection: Collection = {
        id: 'default',
        name: 'My Requests',
        description: 'Default collection for saved requests',
        color: '#6366f1',
        requests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shared: false,
        archived: false
      }
      setCollections([defaultCollection])
      setSelectedCollection('default')
    }
  }, [])

  // Save collections to localStorage when they change
  useEffect(() => {
    if (collections.length > 0) {
      localStorage.setItem('api-console-collections', JSON.stringify(collections))
    }
  }, [collections])

  const createCollection = (name: string, description: string, color: string) => {
    const newCollection: Collection = {
      id: `collection_${Date.now()}`,
      name,
      description,
      color,
      requests: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shared: false,
      archived: false
    }
    setCollections(prev => [...prev, newCollection])
    setShowNewCollectionForm(false)
  }

  const deleteCollection = (collectionId: string) => {
    if (collectionId === 'default') return // Don't allow deleting default collection
    setCollections(prev => prev.filter(c => c.id !== collectionId))
    if (selectedCollection === collectionId) {
      setSelectedCollection('default')
    }
  }

  const addRequestToCollection = (request: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRequest: SavedRequest = {
      ...request,
      id: `request_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setCollections(prev => prev.map(collection => 
      collection.id === request.collectionId
        ? { 
            ...collection, 
            requests: [...collection.requests, newRequest],
            updatedAt: new Date().toISOString()
          }
        : collection
    ))
    onSaveRequest(request)
  }

  const updateRequest = (requestId: string, updates: Partial<SavedRequest>) => {
    setCollections(prev => prev.map(collection => ({
      ...collection,
      requests: collection.requests.map(request =>
        request.id === requestId
          ? { ...request, ...updates, updatedAt: new Date().toISOString() }
          : request
      )
    })))
  }

  const deleteRequest = (requestId: string) => {
    setCollections(prev => prev.map(collection => ({
      ...collection,
      requests: collection.requests.filter(request => request.id !== requestId)
    })))
  }

  const toggleFavorite = (requestId: string) => {
    updateRequest(requestId, { favorite: !collections.find(c => 
      c.requests.find(r => r.id === requestId)
    )?.requests.find(r => r.id === requestId)?.favorite })
  }

  const duplicateRequest = (request: SavedRequest) => {
    const duplicatedRequest = {
      ...request,
      name: `${request.name} (Copy)`,
      id: `request_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setCollections(prev => prev.map(collection => 
      collection.id === request.collectionId
        ? { 
            ...collection, 
            requests: [...collection.requests, duplicatedRequest]
          }
        : collection
    ))
  }

  const runRequest = (request: SavedRequest) => {
    // Update last used timestamp
    updateRequest(request.id, { lastUsed: new Date().toISOString() })
    onLoadRequest(request)
    onClose()
  }

  const exportCollection = (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId)
    if (collection) {
      const exportData = {
        ...collection,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collection.name.replace(/\s+/g, '_')}_collection.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const importCollection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          const importedCollection: Collection = {
            ...importedData,
            id: `collection_${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            shared: false
          }
          setCollections(prev => [...prev, importedCollection])
        } catch (error) {
          console.error('Failed to import collection:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  const filteredRequests = () => {
    let allRequests: SavedRequest[] = []
    
    if (view === 'collections' && selectedCollection) {
      const collection = collections.find(c => c.id === selectedCollection)
      allRequests = collection?.requests || []
    } else if (view === 'all') {
      allRequests = collections.flatMap(c => c.requests)
    } else if (view === 'favorites') {
      allRequests = collections.flatMap(c => c.requests.filter(r => r.favorite))
    } else if (view === 'recent') {
      allRequests = collections.flatMap(c => c.requests)
        .filter(r => r.lastUsed)
        .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
        .slice(0, 20)
    }

    if (searchQuery) {
      allRequests = allRequests.filter(request =>
        request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    return allRequests
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Folder className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Request Collections
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept=".json"
              onChange={importCollection}
              className="hidden"
              id="import-collection"
            />
            <label
              htmlFor="import-collection"
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
              title="Import Collection"
            >
              <Upload className="w-5 h-5" />
            </label>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* View Tabs */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'collections', label: 'Collections', icon: Folder },
                  { key: 'all', label: 'All Requests', icon: File },
                  { key: 'favorites', label: 'Favorites', icon: Star },
                  { key: 'recent', label: 'Recent', icon: Clock }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setView(key as any)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      view === key
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Collections List */}
            {view === 'collections' && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Collections</h3>
                  <button
                    onClick={() => setShowNewCollectionForm(true)}
                    className="p-1.5 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
                    title="New Collection"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  {collections.filter(c => !c.archived).map(collection => (
                    <div
                      key={collection.id}
                      onClick={() => setSelectedCollection(collection.id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedCollection === collection.id
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: collection.color }}
                        />
                        <div>
                          <div className="font-medium">{collection.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {collection.requests.length} requests
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {collection.shared && (
                          <Share className="w-3 h-3 text-gray-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            exportCollection(collection.id)
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          title="Export Collection"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Content Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {view === 'collections' && selectedCollection 
                      ? collections.find(c => c.id === selectedCollection)?.name 
                      : view === 'favorites' ? 'Favorite Requests'
                      : view === 'recent' ? 'Recently Used'
                      : 'All Requests'
                    }
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {filteredRequests().length} requests
                  </p>
                </div>
                <button
                  onClick={() => setShowNewRequestForm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Request</span>
                </button>
              </div>
            </div>

            {/* Requests List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {filteredRequests().map(request => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors group"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          request.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                          request.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                          request.method === 'PUT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' :
                          request.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {request.method}
                        </span>
                        {request.favorite && (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {request.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {request.url}
                        </div>
                        {request.tags.length > 0 && (
                          <div className="flex items-center space-x-1 mt-2">
                            {request.tags.map(tag => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              >
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => runRequest(request)}
                        className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Run Request"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleFavorite(request.id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                        title="Toggle Favorite"
                      >
                        <Star className={`w-4 h-4 ${request.favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => duplicateRequest(request)}
                        className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingRequest(request)}
                        className="p-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteRequest(request.id)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredRequests().length === 0 && (
                  <div className="text-center py-12">
                    <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No requests found
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'Try adjusting your search criteria' : 'Create your first saved request to get started'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RequestCollections