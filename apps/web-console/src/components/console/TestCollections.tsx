'use client'

import React, { useState, useEffect } from 'react'
import { 
  TestTube,
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Plus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Search,
  Filter,
  RotateCcw,
  Zap,
  Target,
  BarChart3,
  FileText,
  Code,
  AlertTriangle,
  Info,
  Timer,
  Activity,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface TestCase {
  id: string
  name: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers: Record<string, string>
  body?: string
  expectedStatus: number
  expectedResponseTime: number
  assertions: Assertion[]
  setup?: string
  teardown?: string
  tags: string[]
  enabled: boolean
}

interface Assertion {
  id: string
  type: 'status' | 'response_time' | 'header' | 'body' | 'schema' | 'custom'
  field?: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists'
  expected: any
  actual?: any
  passed?: boolean
  message?: string
}

interface TestCollection {
  id: string
  name: string
  description: string
  tests: TestCase[]
  environment: string
  baseUrl: string
  globalHeaders: Record<string, string>
  variables: Record<string, any>
  createdAt: string
  updatedAt: string
  lastRun?: string
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
}

interface TestRun {
  id: string
  collectionId: string
  startTime: string
  endTime?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  results: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    duration: number
  }
}

interface TestResult {
  testId: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  startTime: string
  endTime: string
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  }
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    time: number
  }
  assertions: Assertion[]
  error?: string
}

export function TestCollections() {
  const [activeTab, setActiveTab] = useState<'collections' | 'runner' | 'results' | 'monitor'>('collections')
  const [collections, setCollections] = useState<TestCollection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<TestCollection | null>(null)
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null)
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [activeRun, setActiveRun] = useState<TestRun | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [darkMode, setDarkMode] = useState(false)
  const [showTestEditor, setShowTestEditor] = useState(false)
  const [editingTest, setEditingTest] = useState<TestCase | null>(null)

  // Mock data initialization
  useEffect(() => {
    const sampleCollection: TestCollection = {
      id: 'collection_1',
      name: 'Digital Twin API Tests',
      description: 'Comprehensive test suite for Digital Twin creation and management APIs',
      environment: 'development',
      baseUrl: 'https://api.schlep-engine.com/v1',
      globalHeaders: {
        'Authorization': 'Bearer ${API_TOKEN}',
        'Content-Type': 'application/json',
        'X-API-Version': '1.0'
      },
      variables: {
        API_TOKEN: 'test_token_123',
        TWIN_ID: 'twin_12345',
        USER_ID: 'user_789'
      },
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T14:30:00Z',
      lastRun: '2024-01-15T14:30:00Z',
      tests: [
        {
          id: 'test_1',
          name: 'Create Digital Twin',
          description: 'Test creation of a new digital twin with valid parameters',
          method: 'POST',
          url: '/manufacturing/digital-twin/create',
          headers: {},
          body: JSON.stringify({
            name: 'Test Twin ${timestamp}',
            type: 'machine_learning',
            configuration: {
              model_type: 'xgboost',
              features: ['temperature', 'pressure', 'vibration']
            }
          }, null, 2),
          expectedStatus: 201,
          expectedResponseTime: 1000,
          assertions: [
            {
              id: 'assertion_1',
              type: 'status',
              operator: 'equals',
              expected: 201,
              passed: true
            },
            {
              id: 'assertion_2',
              type: 'response_time',
              operator: 'less_than',
              expected: 1000,
              passed: true
            },
            {
              id: 'assertion_3',
              type: 'body',
              field: 'data.id',
              operator: 'exists',
              expected: true,
              passed: true
            },
            {
              id: 'assertion_4',
              type: 'body',
              field: 'data.name',
              operator: 'contains',
              expected: 'Test Twin',
              passed: true
            }
          ],
          tags: ['creation', 'digital-twin', 'critical'],
          enabled: true
        },
        {
          id: 'test_2',
          name: 'Get Digital Twin Details',
          description: 'Retrieve details of a created digital twin',
          method: 'GET',
          url: '/manufacturing/digital-twin/${TWIN_ID}',
          headers: {},
          expectedStatus: 200,
          expectedResponseTime: 500,
          assertions: [
            {
              id: 'assertion_5',
              type: 'status',
              operator: 'equals',
              expected: 200,
              passed: true
            },
            {
              id: 'assertion_6',
              type: 'header',
              field: 'Content-Type',
              operator: 'contains',
              expected: 'application/json',
              passed: true
            }
          ],
          tags: ['retrieval', 'digital-twin'],
          enabled: true
        },
        {
          id: 'test_3',
          name: 'Update Digital Twin Configuration',
          description: 'Test updating digital twin configuration',
          method: 'PUT',
          url: '/manufacturing/digital-twin/${TWIN_ID}',
          headers: {},
          body: JSON.stringify({
            configuration: {
              model_type: 'random_forest',
              features: ['temperature', 'pressure', 'vibration', 'humidity']
            }
          }, null, 2),
          expectedStatus: 200,
          expectedResponseTime: 800,
          assertions: [
            {
              id: 'assertion_7',
              type: 'status',
              operator: 'equals',
              expected: 200,
              passed: false,
              actual: 400,
              message: 'Expected status 200 but got 400'
            },
            {
              id: 'assertion_8',
              type: 'body',
              field: 'data.configuration.model_type',
              operator: 'equals',
              expected: 'random_forest',
              passed: false
            }
          ],
          tags: ['update', 'digital-twin'],
          enabled: true
        },
        {
          id: 'test_4',
          name: 'Delete Digital Twin',
          description: 'Test deletion of a digital twin',
          method: 'DELETE',
          url: '/manufacturing/digital-twin/${TWIN_ID}',
          headers: {},
          expectedStatus: 204,
          expectedResponseTime: 300,
          assertions: [
            {
              id: 'assertion_9',
              type: 'status',
              operator: 'equals',
              expected: 204,
              passed: true
            }
          ],
          tags: ['deletion', 'digital-twin', 'cleanup'],
          enabled: true
        }
      ],
      stats: {
        total: 4,
        passed: 3,
        failed: 1,
        skipped: 0
      }
    }

    const sampleRun: TestRun = {
      id: 'run_1',
      collectionId: 'collection_1',
      startTime: '2024-01-15T14:30:00Z',
      endTime: '2024-01-15T14:32:15Z',
      status: 'completed',
      results: sampleCollection.tests.map(test => ({
        testId: test.id,
        status: test.assertions.every(a => a.passed) ? 'passed' : 'failed',
        duration: Math.random() * 1000 + 200,
        startTime: '2024-01-15T14:30:00Z',
        endTime: '2024-01-15T14:30:01Z',
        request: {
          method: test.method,
          url: `${sampleCollection.baseUrl}${test.url}`,
          headers: { ...sampleCollection.globalHeaders, ...test.headers },
          body: test.body
        },
        response: {
          status: test.assertions.find(a => a.type === 'status')?.actual || test.expectedStatus,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: '{"success": true, "data": {"id": "twin_12345"}}',
          time: Math.random() * 1000 + 200
        },
        assertions: test.assertions
      })),
      summary: {
        total: 4,
        passed: 3,
        failed: 1,
        skipped: 0,
        duration: 135000
      }
    }

    setCollections([sampleCollection])
    setSelectedCollection(sampleCollection)
    setTestRuns([sampleRun])
  }, [])

  const runCollection = async (collection: TestCollection) => {
    setIsRunning(true)
    
    const newRun: TestRun = {
      id: `run_${Date.now()}`,
      collectionId: collection.id,
      startTime: new Date().toISOString(),
      status: 'running',
      results: [],
      summary: {
        total: collection.tests.length,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    }

    setTestRuns(prev => [newRun, ...prev])
    setActiveRun(newRun)

    // Simulate test execution
    for (let i = 0; i < collection.tests.length; i++) {
      const test = collection.tests[i]
      await new Promise(resolve => setTimeout(resolve, 1000))

      const result: TestResult = {
        testId: test.id,
        status: Math.random() > 0.2 ? 'passed' : 'failed',
        duration: Math.random() * 1000 + 200,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        request: {
          method: test.method,
          url: `${collection.baseUrl}${test.url}`,
          headers: { ...collection.globalHeaders, ...test.headers },
          body: test.body
        },
        response: {
          status: test.expectedStatus,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: '{"success": true}',
          time: Math.random() * 1000 + 200
        },
        assertions: test.assertions.map(assertion => ({
          ...assertion,
          passed: Math.random() > 0.2
        }))
      }

      newRun.results.push(result)
      newRun.summary.passed += result.status === 'passed' ? 1 : 0
      newRun.summary.failed += result.status === 'failed' ? 1 : 0

      setTestRuns(prev => prev.map(run => 
        run.id === newRun.id ? { ...newRun } : run
      ))
    }

    newRun.status = 'completed'
    newRun.endTime = new Date().toISOString()
    newRun.summary.duration = Date.now() - new Date(newRun.startTime).getTime()

    setTestRuns(prev => prev.map(run => 
      run.id === newRun.id ? newRun : run
    ))
    setIsRunning(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      case 'running': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      case 'skipped': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const filteredTests = selectedCollection?.tests.filter(test => {
    const matchesSearch = searchQuery === '' || 
      test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'passed' && test.assertions.every(a => a.passed)) ||
      (statusFilter === 'failed' && test.assertions.some(a => !a.passed))
    
    return matchesSearch && matchesStatus
  }) || []

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TestTube className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Test Collections
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automated API testing, collection management, and continuous monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {selectedCollection && (
              <>
                <button
                  onClick={() => runCollection(selectedCollection)}
                  disabled={isRunning}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Square className="w-4 h-4" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run Collection</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {}}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Collection Status */}
        {selectedCollection && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { 
                label: 'Total Tests', 
                value: selectedCollection.stats.total,
                color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
              },
              { 
                label: 'Passed', 
                value: selectedCollection.stats.passed,
                color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
              },
              { 
                label: 'Failed', 
                value: selectedCollection.stats.failed,
                color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
              },
              { 
                label: 'Success Rate', 
                value: `${Math.round((selectedCollection.stats.passed / selectedCollection.stats.total) * 100)}%`,
                color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
              }
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`px-3 py-2 rounded-lg ${color}`}>
                  <div className="font-semibold">{value}</div>
                  <div className="text-xs opacity-75">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { key: 'collections', label: 'Collections', icon: Layers },
            { key: 'runner', label: 'Test Runner', icon: Play },
            { key: 'results', label: 'Results', icon: BarChart3 },
            { key: 'monitor', label: 'Monitoring', icon: Activity }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'collections' && (
          <>
            {/* Collections List */}
            <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">Test Collections</h3>
                  <button className="p-1 text-blue-600 hover:text-blue-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => setSelectedCollection(collection)}
                    className={`w-full text-left p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedCollection?.id === collection.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">{collection.name}</h4>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {collection.tests.length} tests
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{collection.description}</p>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">{collection.environment}</span>
                      {collection.lastRun && (
                        <span className="text-gray-500 dark:text-gray-400">
                          Last run: {new Date(collection.lastRun).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tests List */}
            <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {selectedCollection ? (
                <>
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">Tests</h3>
                      <button 
                        onClick={() => setShowTestEditor(true)}
                        className="p-1 text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Search and Filter */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search tests..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Tests</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {filteredTests.map((test) => (
                      <button
                        key={test.id}
                        onClick={() => setSelectedTest(test)}
                        className={`w-full text-left p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedTest?.id === test.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              test.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              test.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              test.method === 'PUT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              test.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {test.method}
                            </span>
                            {test.assertions.every(a => a.passed) ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : test.assertions.some(a => !a.passed) ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          {!test.enabled && (
                            <span className="text-xs text-gray-400">Disabled</span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">{test.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{test.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {test.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select a collection
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Choose a test collection to view its tests
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Test Details */}
            <div className="flex-1 bg-white dark:bg-gray-800 flex flex-col">
              {selectedTest ? (
                <>
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${
                          selectedTest.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          selectedTest.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          selectedTest.method === 'PUT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          selectedTest.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {selectedTest.method}
                        </span>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedTest.name}
                        </h2>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedTest.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">URL:</span>
                        <div className="font-mono text-gray-600 dark:text-gray-400">{selectedTest.url}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">Expected Status:</span>
                        <div className="text-gray-600 dark:text-gray-400">{selectedTest.expectedStatus}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Request Body */}
                    {selectedTest.body && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Request Body</h3>
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <SyntaxHighlighter
                            language="json"
                            style={darkMode ? oneDark : oneLight}
                            customStyle={{ margin: 0, fontSize: '14px' }}
                          >
                            {selectedTest.body}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}

                    {/* Assertions */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Assertions</h3>
                      <div className="space-y-3">
                        {selectedTest.assertions.map((assertion) => (
                          <div key={assertion.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <div className="flex items-center space-x-3">
                              {assertion.passed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {assertion.type} {assertion.field && `(${assertion.field})`} {assertion.operator} {assertion.expected}
                                </div>
                                {assertion.message && (
                                  <div className="text-sm text-red-600 dark:text-red-400">{assertion.message}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTest.tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select a test to view details
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Click on any test to see its configuration and assertions
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'runner' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Test Runner
              </h2>
              
              {activeRun ? (
                <div className="space-y-6">
                  {/* Run Header */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Test Run Results
                      </h3>
                      <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(activeRun.status)}`}>
                        {activeRun.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Total', value: activeRun.summary.total, color: 'text-blue-600' },
                        { label: 'Passed', value: activeRun.summary.passed, color: 'text-green-600' },
                        { label: 'Failed', value: activeRun.summary.failed, color: 'text-red-600' },
                        { label: 'Duration', value: `${Math.round(activeRun.summary.duration / 1000)}s`, color: 'text-purple-600' }
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                          <div className={`text-2xl font-bold ${color}`}>{value}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Test Results */}
                  <div className="space-y-4">
                    {activeRun.results.map((result) => {
                      const test = selectedCollection?.tests.find(t => t.id === result.testId)
                      return (
                        <div key={result.testId} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              {result.status === 'passed' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {test?.name || result.testId}
                              </h4>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(result.status)}`}>
                                {result.status}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {result.duration.toFixed(0)}ms
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white mb-1">Request</div>
                              <div className="text-gray-600 dark:text-gray-400">
                                {result.request.method} {result.request.url}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white mb-1">Response</div>
                              <div className="text-gray-600 dark:text-gray-400">
                                Status: {result.response.status} • Time: {result.response.time.toFixed(0)}ms
                              </div>
                            </div>
                          </div>

                          {result.error && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <div className="text-red-800 dark:text-red-300 font-medium">Error:</div>
                              <div className="text-red-700 dark:text-red-400 text-sm">{result.error}</div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Play className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                    No active test run
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Select a collection and click "Run Collection" to start testing
                  </p>
                  {selectedCollection && (
                    <button
                      onClick={() => runCollection(selectedCollection)}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                    >
                      <Play className="w-5 h-5" />
                      <span>Run {selectedCollection.name}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Test Results History
              </h2>
              
              <div className="space-y-4">
                {testRuns.map((run) => (
                  <div key={run.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Test Run #{run.id.split('_')[1]}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Started: {new Date(run.startTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(run.status)}`}>
                          {run.status}
                        </span>
                        {run.endTime && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Duration: {Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 1000)}s
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Total Tests', value: run.summary.total, color: 'text-blue-600' },
                        { label: 'Passed', value: run.summary.passed, color: 'text-green-600' },
                        { label: 'Failed', value: run.summary.failed, color: 'text-red-600' },
                        { label: 'Success Rate', value: `${Math.round((run.summary.passed / run.summary.total) * 100)}%`, color: 'text-purple-600' }
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <div className={`text-xl font-bold ${color}`}>{value}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Continuous Monitoring
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Scheduled Runs
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Digital Twin API Tests</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Every 6 hours</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Alert Thresholds
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Failure Rate Threshold</span>
                      <span className="font-medium text-gray-900 dark:text-white">20%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Response Time Threshold</span>
                      <span className="font-medium text-gray-900 dark:text-white">2000ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}