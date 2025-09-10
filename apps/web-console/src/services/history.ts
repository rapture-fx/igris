export interface RequestHistoryItem {
  id: string
  timestamp: string
  method: string
  url: string
  path: string
  headers: Record<string, string>
  queryParams?: Record<string, string>
  pathParams?: Record<string, string>
  requestBody?: string
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    data: any
    duration: number
    size: number
  }
  error?: {
    message: string
    code?: string
    details?: any
  }
  environment: string
  endpointName: string
  endpointId: string
  starred: boolean
  tags: string[]
  notes?: string
}

export interface RequestCollection {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  requests: string[] // Array of request IDs
  shared: boolean
  owner: string
  collaborators: string[]
  tags: string[]
  folder?: string
}

export interface RequestBookmark {
  id: string
  requestId: string
  name: string
  description?: string
  createdAt: string
  folder?: string
  tags: string[]
}

export class HistoryService {
  private readonly STORAGE_KEY = 'api-console-history'
  private readonly COLLECTIONS_KEY = 'api-console-collections'
  private readonly BOOKMARKS_KEY = 'api-console-bookmarks'
  private readonly MAX_HISTORY_ITEMS = 1000

  // Request History Management
  saveRequest(request: Omit<RequestHistoryItem, 'id' | 'timestamp' | 'starred' | 'tags'>): RequestHistoryItem {
    const history = this.getHistory()
    
    const newRequest: RequestHistoryItem = {
      ...request,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      starred: false,
      tags: []
    }

    // Add to beginning of array (most recent first)
    history.unshift(newRequest)

    // Limit history size
    if (history.length > this.MAX_HISTORY_ITEMS) {
      history.splice(this.MAX_HISTORY_ITEMS)
    }

    this.saveHistory(history)
    return newRequest
  }

  getHistory(filters?: {
    method?: string
    environment?: string
    endpointId?: string
    starred?: boolean
    tags?: string[]
    search?: string
    dateFrom?: string
    dateTo?: string
  }): RequestHistoryItem[] {
    let history = this.loadHistory()

    if (filters) {
      history = history.filter(item => {
        if (filters.method && item.method !== filters.method) return false
        if (filters.environment && item.environment !== filters.environment) return false
        if (filters.endpointId && item.endpointId !== filters.endpointId) return false
        if (filters.starred !== undefined && item.starred !== filters.starred) return false
        
        if (filters.tags && filters.tags.length > 0) {
          const hasAllTags = filters.tags.every(tag => item.tags.includes(tag))
          if (!hasAllTags) return false
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          const matchesSearch = 
            item.endpointName.toLowerCase().includes(searchLower) ||
            item.url.toLowerCase().includes(searchLower) ||
            item.notes?.toLowerCase().includes(searchLower) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchLower))
          if (!matchesSearch) return false
        }

        if (filters.dateFrom) {
          if (new Date(item.timestamp) < new Date(filters.dateFrom)) return false
        }

        if (filters.dateTo) {
          if (new Date(item.timestamp) > new Date(filters.dateTo)) return false
        }

        return true
      })
    }

    return history
  }

  getRequestById(id: string): RequestHistoryItem | null {
    const history = this.loadHistory()
    return history.find(item => item.id === id) || null
  }

  updateRequest(id: string, updates: Partial<RequestHistoryItem>): RequestHistoryItem | null {
    const history = this.loadHistory()
    const index = history.findIndex(item => item.id === id)
    
    if (index === -1) return null

    history[index] = { ...history[index], ...updates }
    this.saveHistory(history)
    return history[index]
  }

  deleteRequest(id: string): boolean {
    const history = this.loadHistory()
    const index = history.findIndex(item => item.id === id)
    
    if (index === -1) return false

    history.splice(index, 1)
    this.saveHistory(history)
    return true
  }

  starRequest(id: string): RequestHistoryItem | null {
    return this.updateRequest(id, { starred: true })
  }

  unstarRequest(id: string): RequestHistoryItem | null {
    return this.updateRequest(id, { starred: false })
  }

  addTagToRequest(id: string, tag: string): RequestHistoryItem | null {
    const request = this.getRequestById(id)
    if (!request) return null

    if (!request.tags.includes(tag)) {
      request.tags.push(tag)
      return this.updateRequest(id, { tags: request.tags })
    }

    return request
  }

  removeTagFromRequest(id: string, tag: string): RequestHistoryItem | null {
    const request = this.getRequestById(id)
    if (!request) return null

    const tagIndex = request.tags.indexOf(tag)
    if (tagIndex > -1) {
      request.tags.splice(tagIndex, 1)
      return this.updateRequest(id, { tags: request.tags })
    }

    return request
  }

  // Collection Management
  createCollection(collection: Omit<RequestCollection, 'id' | 'createdAt' | 'updatedAt'>): RequestCollection {
    const collections = this.getCollections()
    
    const newCollection: RequestCollection = {
      ...collection,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    collections.push(newCollection)
    this.saveCollections(collections)
    return newCollection
  }

  getCollections(filters?: {
    owner?: string
    shared?: boolean
    tags?: string[]
    search?: string
  }): RequestCollection[] {
    let collections = this.loadCollections()

    if (filters) {
      collections = collections.filter(collection => {
        if (filters.owner && collection.owner !== filters.owner) return false
        if (filters.shared !== undefined && collection.shared !== filters.shared) return false
        
        if (filters.tags && filters.tags.length > 0) {
          const hasAllTags = filters.tags.every(tag => collection.tags.includes(tag))
          if (!hasAllTags) return false
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          const matchesSearch = 
            collection.name.toLowerCase().includes(searchLower) ||
            collection.description?.toLowerCase().includes(searchLower) ||
            collection.tags.some(tag => tag.toLowerCase().includes(searchLower))
          if (!matchesSearch) return false
        }

        return true
      })
    }

    return collections
  }

  getCollectionById(id: string): RequestCollection | null {
    const collections = this.loadCollections()
    return collections.find(collection => collection.id === id) || null
  }

  updateCollection(id: string, updates: Partial<RequestCollection>): RequestCollection | null {
    const collections = this.loadCollections()
    const index = collections.findIndex(collection => collection.id === id)
    
    if (index === -1) return null

    collections[index] = {
      ...collections[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    this.saveCollections(collections)
    return collections[index]
  }

  deleteCollection(id: string): boolean {
    const collections = this.loadCollections()
    const index = collections.findIndex(collection => collection.id === id)
    
    if (index === -1) return false

    collections.splice(index, 1)
    this.saveCollections(collections)
    return true
  }

  addRequestToCollection(collectionId: string, requestId: string): RequestCollection | null {
    const collection = this.getCollectionById(collectionId)
    if (!collection) return null

    if (!collection.requests.includes(requestId)) {
      collection.requests.push(requestId)
      return this.updateCollection(collectionId, { requests: collection.requests })
    }

    return collection
  }

  removeRequestFromCollection(collectionId: string, requestId: string): RequestCollection | null {
    const collection = this.getCollectionById(collectionId)
    if (!collection) return null

    const requestIndex = collection.requests.indexOf(requestId)
    if (requestIndex > -1) {
      collection.requests.splice(requestIndex, 1)
      return this.updateCollection(collectionId, { requests: collection.requests })
    }

    return collection
  }

  // Bookmark Management
  createBookmark(bookmark: Omit<RequestBookmark, 'id' | 'createdAt'>): RequestBookmark {
    const bookmarks = this.getBookmarks()
    
    const newBookmark: RequestBookmark = {
      ...bookmark,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    }

    bookmarks.push(newBookmark)
    this.saveBookmarks(bookmarks)
    return newBookmark
  }

  getBookmarks(filters?: {
    folder?: string
    tags?: string[]
    search?: string
  }): RequestBookmark[] {
    let bookmarks = this.loadBookmarks()

    if (filters) {
      bookmarks = bookmarks.filter(bookmark => {
        if (filters.folder && bookmark.folder !== filters.folder) return false
        
        if (filters.tags && filters.tags.length > 0) {
          const hasAllTags = filters.tags.every(tag => bookmark.tags.includes(tag))
          if (!hasAllTags) return false
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          const matchesSearch = 
            bookmark.name.toLowerCase().includes(searchLower) ||
            bookmark.description?.toLowerCase().includes(searchLower) ||
            bookmark.tags.some(tag => tag.toLowerCase().includes(searchLower))
          if (!matchesSearch) return false
        }

        return true
      })
    }

    return bookmarks
  }

  deleteBookmark(id: string): boolean {
    const bookmarks = this.loadBookmarks()
    const index = bookmarks.findIndex(bookmark => bookmark.id === id)
    
    if (index === -1) return false

    bookmarks.splice(index, 1)
    this.saveBookmarks(bookmarks)
    return true
  }

  // Analytics and Statistics
  getUsageStats(dateRange?: { from: string; to: string }): {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageResponseTime: number
    mostUsedEndpoints: Array<{ endpointId: string; name: string; count: number }>
    requestsByMethod: Record<string, number>
    requestsByEnvironment: Record<string, number>
    requestsByDay: Array<{ date: string; count: number }>
  } {
    const history = this.getHistory(dateRange ? { dateFrom: dateRange.from, dateTo: dateRange.to } : undefined)
    
    const stats = {
      totalRequests: history.length,
      successfulRequests: history.filter(item => item.response && item.response.status >= 200 && item.response.status < 400).length,
      failedRequests: history.filter(item => item.error || (item.response && item.response.status >= 400)).length,
      averageResponseTime: 0,
      mostUsedEndpoints: [] as Array<{ endpointId: string; name: string; count: number }>,
      requestsByMethod: {} as Record<string, number>,
      requestsByEnvironment: {} as Record<string, number>,
      requestsByDay: [] as Array<{ date: string; count: number }>
    }

    // Calculate average response time
    const responseTimes = history
      .filter(item => item.response?.duration)
      .map(item => item.response!.duration)
    
    if (responseTimes.length > 0) {
      stats.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    }

    // Count endpoint usage
    const endpointCounts: Record<string, { name: string; count: number }> = {}
    history.forEach(item => {
      if (!endpointCounts[item.endpointId]) {
        endpointCounts[item.endpointId] = { name: item.endpointName, count: 0 }
      }
      endpointCounts[item.endpointId].count++
    })

    stats.mostUsedEndpoints = Object.entries(endpointCounts)
      .map(([endpointId, data]) => ({ endpointId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Count by method
    history.forEach(item => {
      stats.requestsByMethod[item.method] = (stats.requestsByMethod[item.method] || 0) + 1
    })

    // Count by environment
    history.forEach(item => {
      stats.requestsByEnvironment[item.environment] = (stats.requestsByEnvironment[item.environment] || 0) + 1
    })

    // Count by day
    const dayGroups: Record<string, number> = {}
    history.forEach(item => {
      const date = new Date(item.timestamp).toISOString().split('T')[0]
      dayGroups[date] = (dayGroups[date] || 0) + 1
    })

    stats.requestsByDay = Object.entries(dayGroups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return stats
  }

  // Data import/export
  exportData(): {
    history: RequestHistoryItem[]
    collections: RequestCollection[]
    bookmarks: RequestBookmark[]
  } {
    return {
      history: this.loadHistory(),
      collections: this.loadCollections(),
      bookmarks: this.loadBookmarks()
    }
  }

  importData(data: {
    history?: RequestHistoryItem[]
    collections?: RequestCollection[]
    bookmarks?: RequestBookmark[]
  }): void {
    if (data.history) {
      this.saveHistory(data.history)
    }
    if (data.collections) {
      this.saveCollections(data.collections)
    }
    if (data.bookmarks) {
      this.saveBookmarks(data.bookmarks)
    }
  }

  clearAllData(): void {
    localStorage.removeItem(this.STORAGE_KEY)
    localStorage.removeItem(this.COLLECTIONS_KEY)
    localStorage.removeItem(this.BOOKMARKS_KEY)
  }

  // Private helper methods
  private loadHistory(): RequestHistoryItem[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  private saveHistory(history: RequestHistoryItem[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history))
  }

  private loadCollections(): RequestCollection[] {
    try {
      const data = localStorage.getItem(this.COLLECTIONS_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  private saveCollections(collections: RequestCollection[]): void {
    localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
  }

  private loadBookmarks(): RequestBookmark[] {
    try {
      const data = localStorage.getItem(this.BOOKMARKS_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  private saveBookmarks(bookmarks: RequestBookmark[]): void {
    localStorage.setItem(this.BOOKMARKS_KEY, JSON.stringify(bookmarks))
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

export const historyService = new HistoryService()