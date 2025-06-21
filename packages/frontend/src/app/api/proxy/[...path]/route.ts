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
    if (process.env.NODE_ENV === 'development') {
      return getMockResponse(params.path, method)
    }

    return NextResponse.json(
      { 
        status: 'error',
        message: 'Backend service unavailable',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}

// Mock responses for development
function getMockResponse(path: string[], method: string) {
  const pathStr = path.join('/')
  
  // Mock data sources
  if (pathStr.includes('data-ingestion/sources')) {
    if (method === 'GET') {
      return NextResponse.json({
        status: 'success',
        data: {
          data: [
            {
              id: '1',
              name: 'Production Database',
              type: 'database',
              status: 'connected',
              connectionConfig: { host: 'prod-db.example.com', port: 5432 },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-15T10:30:00Z',
              lastSyncAt: '2024-01-15T10:30:00Z'
            },
            {
              id: '2',
              name: 'Salesforce CRM',
              type: 'api',
              status: 'connected',
              connectionConfig: { apiKey: '***' },
              createdAt: '2024-01-02T00:00:00Z',
              updatedAt: '2024-01-15T09:00:00Z',
              lastSyncAt: '2024-01-15T09:00:00Z'
            }
          ],
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
        },
        timestamp: new Date().toISOString()
      })
    }
  }

  // Mock intelligence data
  if (pathStr.includes('data-intelligence')) {
    return NextResponse.json({
      status: 'success',
      data: {
        totalRecords: 2847392,
        totalTables: 45,
        qualityScore: 87,
        anomaliesDetected: 23,
        lastProfiledAt: '2024-01-15T10:30:00Z'
      },
      timestamp: new Date().toISOString()
    })
  }

  // Default mock response
  return NextResponse.json({
    status: 'success',
    data: { message: 'Mock response - backend not available' },
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