import { NextRequest, NextResponse } from 'next/server'

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'PUT')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'PATCH')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'DELETE')
}

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  // For development, always return mock data
  if (process.env.NODE_ENV === 'development') {
    return getMockResponse(params.path, method, request)
  }

  try {
    const path = params.path.join('/')
    const url = `${BACKEND_API_URL}/${path}`
    
    // Get search params from the original request
    const searchParams = request.nextUrl.searchParams
    const fullUrl = searchParams.toString() ? `${url}?${searchParams}` : url

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Forward authorization header if present
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    // Forward tenant ID header if present
    const tenantHeader = request.headers.get('X-Tenant-ID')
    if (tenantHeader) {
      headers['X-Tenant-ID'] = tenantHeader
    }

    // Prepare request body for non-GET requests
    let body: string | undefined
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        body = await request.text()
      } catch (error) {
        // Body might be empty, which is fine
      }
    }

    // Make the request to the backend
    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
    })

    // Get response data
    const responseData = await response.text()
    
    // Create response with same status and headers
    const nextResponse = new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
    })

    // Forward relevant headers
    const headersToForward = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
    ]

    headersToForward.forEach(headerName => {
      const headerValue = response.headers.get(headerName)
      if (headerValue) {
        nextResponse.headers.set(headerName, headerValue)
      }
    })

    // Add CORS headers for development
    nextResponse.headers.set('Access-Control-Allow-Origin', '*')
    nextResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    nextResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID')

    return nextResponse

  } catch (error) {
    console.error('API Proxy Error:', error)
    
    // Return mock data for development when backend is not available
    return getMockResponse(params.path, method, request)
  }
}

// Enhanced mock responses for development
function getMockResponse(path: string[], method: string, request?: NextRequest) {
  const pathStr = path.join('/')
  
  // Simulate network delay
  const delay = Math.random() * 300 + 100
  
  // Dashboard stats
  if (pathStr.includes('dashboard/stats') || pathStr.includes('dashboard') && method === 'GET') {
    return NextResponse.json({
      status: 'success',
      data: {
        data_sources: 12,
        total_records: 2847392,
        quality_score: 94,
        active_jobs: 5,
        processing_jobs: 2,
        completed_jobs: 156,
        failed_jobs: 3
      },
      timestamp: new Date().toISOString()
    })
  }

  // Dashboard activity
  if (pathStr.includes('dashboard/activity') || pathStr.includes('activity')) {
    return NextResponse.json({
      status: 'success',
      data: [
        {
          id: '1',
          type: 'file_upload',
          title: 'Customer Dataset Uploaded',
          description: 'customer_data_2024.csv processed successfully (15,420 records)',
          status: 'completed',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          user: 'John Doe'
        },
        {
          id: '2',
          type: 'ai_processing',
          title: 'AI Model Training Started',
          description: 'Customer segmentation model training in progress',
          status: 'processing',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          user: 'Sarah Wilson'
        },
        {
          id: '3',
          type: 'data_quality',
          title: 'Quality Check Completed',
          description: 'Data quality score improved to 94% (+2%)',
          status: 'completed',
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          user: 'System'
        },
        {
          id: '4',
          type: 'integration',
          title: 'Salesforce Sync',
          description: 'Successfully synced 2,340 customer records',
          status: 'completed',
          timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          user: 'API Connector'
        },
        {
          id: '5',
          type: 'alert',
          title: 'Anomaly Detected',
          description: 'Unusual pattern detected in transaction data',
          status: 'warning',
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          user: 'AI Monitor'
        }
      ],
      pagination: { page: 1, limit: 20, total: 5, totalPages: 1 },
      timestamp: new Date().toISOString()
    })
  }

  // Dashboard jobs
  if (pathStr.includes('dashboard/jobs') || pathStr.includes('jobs')) {
    return NextResponse.json({
      status: 'success',
      data: [
        {
          id: 'job_001',
          name: 'Customer Segmentation Model',
          type: 'ml_training',
          status: 'running',
          progress: 67,
          startedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          estimatedCompletion: new Date(Date.now() + 1000 * 60 * 15).toISOString()
        },
        {
          id: 'job_002',
          name: 'Sales Data ETL',
          type: 'data_processing',
          status: 'running',
          progress: 23,
          startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          estimatedCompletion: new Date(Date.now() + 1000 * 60 * 35).toISOString()
        }
      ],
      timestamp: new Date().toISOString()
    })
  }

  // Data sources
  if (pathStr.includes('data-ingestion/sources') || pathStr.includes('data/sources')) {
    if (method === 'GET') {
      return NextResponse.json({
        status: 'success',
        data: {
          data: [
            {
              id: '1',
              name: 'Production Database',
              type: 'postgresql',
              status: 'connected',
              connectionConfig: { host: 'prod-db.example.com', port: 5432 },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-15T10:30:00Z',
              lastSyncAt: '2024-01-15T10:30:00Z',
              recordCount: 1250000,
              qualityScore: 96
            },
            {
              id: '2',
              name: 'Salesforce CRM',
              type: 'api',
              status: 'connected',
              connectionConfig: { apiKey: '***' },
              createdAt: '2024-01-02T00:00:00Z',
              updatedAt: '2024-01-15T09:00:00Z',
              lastSyncAt: '2024-01-15T09:00:00Z',
              recordCount: 45000,
              qualityScore: 91
            },
            {
              id: '3',
              name: 'Customer Files Upload',
              type: 'file',
              status: 'active',
              createdAt: '2024-01-10T00:00:00Z',
              updatedAt: '2024-01-15T14:20:00Z',
              lastSyncAt: '2024-01-15T14:20:00Z',
              recordCount: 156000,
              qualityScore: 88
            }
          ],
          pagination: { page: 1, limit: 10, total: 3, totalPages: 1 }
        },
        timestamp: new Date().toISOString()
      })
    }
  }

  // Data intelligence/investigations
  if (pathStr.includes('data/investigations')) {
    return NextResponse.json({
      status: 'success',
      data: [
        {
          id: 'inv_001',
          name: 'Customer Behavior Analysis',
          status: 'completed',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
          insights: 5,
          score: 94
        },
        {
          id: 'inv_002',
          name: 'Sales Trend Investigation',
          status: 'processing',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          progress: 73,
          insights: 3,
          score: 0
        }
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      timestamp: new Date().toISOString()
    })
  }

  // Quality metrics
  if (pathStr.includes('quality') || pathStr.includes('dashboard/quality')) {
    return NextResponse.json({
      status: 'success',
      data: {
        overall_score: 94,
        completeness: 96,
        accuracy: 92,
        consistency: 95,
        validity: 93,
        trends: {
          completeness: [88, 90, 92, 94, 96],
          accuracy: [85, 87, 89, 90, 92],
          consistency: [90, 91, 93, 94, 95],
          validity: [87, 89, 91, 92, 93]
        },
        issues: [
          { type: 'missing_values', count: 145, severity: 'medium' },
          { type: 'duplicates', count: 23, severity: 'low' },
          { type: 'outliers', count: 67, severity: 'high' }
        ]
      },
      timestamp: new Date().toISOString()
    })
  }

  // Default mock response
  return NextResponse.json({
    status: 'success',
    data: { 
      message: 'Mock response - backend not available',
      path: pathStr,
      method: method 
    },
    timestamp: new Date().toISOString()
  })
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
    },
  })
} 