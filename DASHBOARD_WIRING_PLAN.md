# Dashboard API Wiring Plan - Pollarbase

## 🎯 **Current State Analysis**

The dashboard currently shows **mock data** in most components. We need to wire up real backend APIs to make it fully functional.

## 🔧 **Components That Need Real API Integration**

### **1. Dashboard Stats (`/components/dashboard/stats.tsx`)**
**Current**: Mock data simulation
**Needs**: Real API endpoints

```typescript
// Current Mock Data
const mockStats = {
  dataSources: 12,
  totalRecords: 2847392,
  qualityScore: 87,
  activeWorkflows: 8,
  anomaliesDetected: 23,
  lastProfiledAt: '2024-01-15T10:30:00Z'
}

// Required API Endpoints
GET /api/v1/dashboard/stats
```

**Backend Implementation Needed**:
```python
@router.get("/stats")
async def get_dashboard_stats():
    return {
        "data_sources": await count_data_sources(),
        "total_records": await count_total_records(),
        "quality_score": await calculate_avg_quality_score(),
        "active_workflows": await count_active_jobs(),
        "anomalies_detected": await count_recent_anomalies(),
        "last_profiled_at": await get_last_analysis_time()
    }
```

### **2. Data Quality Overview (`/components/dashboard/data-quality-overview.tsx`)**
**Current**: Static chart data
**Needs**: Real quality metrics

```typescript
// Current Mock Data
const qualityData = [
  { name: 'Excellent', value: 45, color: '#10B981' },
  { name: 'Good', value: 30, color: '#3B82F6' },
  { name: 'Fair', value: 20, color: '#F59E0B' },
  { name: 'Poor', value: 5, color: '#EF4444' },
]

// Required API Endpoints
GET /api/v1/dashboard/data-quality
GET /api/v1/dashboard/quality-trends
```

### **3. Workflow Status (`/components/dashboard/workflow-status.tsx`)**
**Current**: Static workflow list
**Needs**: Real job status from backend

```typescript
// Required API Endpoints
GET /api/v1/jobs/active
GET /api/v1/jobs/{job_id}/status
POST /api/v1/jobs/{job_id}/pause
POST /api/v1/jobs/{job_id}/resume
```

### **4. Recent Activity (`/components/dashboard/recent-activity.tsx`)**
**Current**: Static activity list
**Needs**: Real system events

```typescript
// Required API Endpoints
GET /api/v1/dashboard/activity
GET /api/v1/dashboard/activity?limit=20&offset=0
```

### **5. File Upload & Processing (`/app/(dashboard)/data-sources/page.tsx`)**
**Current**: Partially working with demo data
**Needs**: Full integration

```typescript
// Current Issues
- Upload works but uses mock job status
- Need real-time job progress
- Need actual file analysis results

// Required API Endpoints
POST /api/v1/upload
GET /api/v1/jobs/{job_id}
POST /api/v1/jobs/{job_id}/clean
```

### **6. API Key Management (`/app/(dashboard)/api-keys/page.tsx`)**
**Current**: Likely mock data
**Needs**: Real API key CRUD

```typescript
// Required API Endpoints
GET /api/v1/user/api-keys
POST /api/v1/user/api-keys
DELETE /api/v1/user/api-keys/{key_id}
PUT /api/v1/user/api-keys/{key_id}
```

### **7. Usage & Billing (`/app/(dashboard)/usage/page.tsx`)**
**Current**: Mock billing data
**Needs**: Real usage tracking

```typescript
// Required API Endpoints
GET /api/v1/billing/usage
GET /api/v1/billing/usage?period=monthly
GET /api/v1/billing/invoices
```

### **8. System Admin Dashboard (`/app/admin/page.tsx`)**
**Current**: Mock user and system data
**Needs**: Real admin APIs

```typescript
// Required API Endpoints
GET /api/v1/admin/users
GET /api/v1/admin/system-stats
GET /api/v1/admin/login-attempts
POST /api/v1/admin/users/{user_id}/actions
```

### **9. Semantic Insights (`/components/insights/SemanticInsights.tsx`)**
**Current**: Mock business intelligence data
**Needs**: Real semantic layer integration

```typescript
// Required API Endpoints
POST /api/v1/insights/ask
GET /api/v1/insights/metrics
GET /api/v1/insights/schema
```

## 🚀 **Implementation Priority**

### **Phase 1: Core Dashboard (High Priority)**
1. **Dashboard Stats** - Main dashboard metrics
2. **File Upload & Processing** - Core product functionality
3. **Job Status & Progress** - Real-time updates
4. **Data Quality Overview** - Key value proposition

### **Phase 2: User Management (Medium Priority)**
5. **API Key Management** - Essential for API service
6. **Usage & Billing** - Revenue tracking
7. **User Authentication** - Already partially working

### **Phase 3: Advanced Features (Lower Priority)**
8. **Admin Dashboard** - System administration
9. **Recent Activity** - System monitoring
10. **Semantic Insights** - Business intelligence

## 🔧 **Backend API Endpoints to Implement**

### **Dashboard Statistics API**
```python
# app/api/v1/dashboard_stats.py
@router.get("/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    return {
        "data_sources": await count_uploaded_files(db),
        "total_records": await sum_processed_records(db),
        "quality_score": await calculate_avg_quality_score(db),
        "active_jobs": await count_running_jobs(db),
        "anomalies_detected": await count_recent_anomalies(db)
    }

@router.get("/dashboard/data-quality")
async def get_data_quality_distribution(db: Session = Depends(get_db)):
    return await calculate_quality_distribution(db)

@router.get("/dashboard/quality-trends")
async def get_quality_trends(
    period: str = "6months",
    db: Session = Depends(get_db)
):
    return await get_quality_trend_data(db, period)
```

### **Real-Time Job Status API**
```python
# app/api/v1/jobs_realtime.py
@router.get("/jobs/active")
async def get_active_jobs(db: Session = Depends(get_db)):
    return await get_running_jobs_with_progress(db)

@router.websocket("/jobs/{job_id}/status")
async def job_status_websocket(websocket: WebSocket, job_id: str):
    # Real-time job progress updates
    await websocket.accept()
    while True:
        status = await get_job_status(job_id)
        await websocket.send_json(status)
        await asyncio.sleep(1)
```

### **Activity Timeline API**
```python
# app/api/v1/activity.py
@router.get("/dashboard/activity")
async def get_recent_activity(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    return await get_system_activity_log(db, limit, offset)
```

## 🔄 **Frontend API Service Updates**

### **Update API Service (`/lib/api.ts`)**
```typescript
class ApiService {
  // Remove mock data fallbacks for production
  private async fetchWithErrorHandling<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`,
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`)
    }

    return await response.json()
  }

  // Real API methods
  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetchWithErrorHandling('/dashboard/stats')
  }

  async getDataQuality(): Promise<DataQualityMetrics> {
    return this.fetchWithErrorHandling('/dashboard/data-quality')
  }

  async getActiveJobs(): Promise<Job[]> {
    return this.fetchWithErrorHandling('/jobs/active')
  }

  async getRecentActivity(limit = 20): Promise<Activity[]> {
    return this.fetchWithErrorHandling(`/dashboard/activity?limit=${limit}`)
  }
}
```

### **Add React Query Integration**
```typescript
// hooks/useDashboardData.ts
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiService.getDashboardStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useDataQuality() {
  return useQuery({
    queryKey: ['data-quality'],
    queryFn: () => apiService.getDataQuality(),
    refetchInterval: 60000, // Refresh every minute
  })
}

export function useActiveJobs() {
  return useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => apiService.getActiveJobs(),
    refetchInterval: 5000, // Refresh every 5 seconds for real-time feel
  })
}
```

## 🔌 **WebSocket Integration for Real-Time Updates**

### **Real-Time Job Progress**
```typescript
// hooks/useJobProgress.ts
export function useJobProgress(jobId: string) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/api/v1/jobs/${jobId}/status`)
    
    ws.onmessage = (event) => {
      const jobStatus = JSON.parse(event.data)
      setStatus(jobStatus)
    }
    
    return () => ws.close()
  }, [jobId])
  
  return status
}
```

### **Real-Time Dashboard Updates**
```typescript
// hooks/useRealtimeDashboard.ts
export function useRealtimeDashboard() {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/v1/dashboard/realtime')
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      
      // Invalidate relevant queries to trigger refetch
      queryClient.invalidateQueries(['dashboard-stats'])
      queryClient.invalidateQueries(['active-jobs'])
      queryClient.invalidateQueries(['recent-activity'])
    }
    
    return () => ws.close()
  }, [queryClient])
}
```

## 🧪 **Testing Strategy**

### **Component Testing**
```typescript
// __tests__/dashboard-stats.test.tsx
describe('DashboardStats', () => {
  it('should display real data from API', async () => {
    const mockStats = { dataSources: 5, totalRecords: 1000 }
    jest.spyOn(apiService, 'getDashboardStats').mockResolvedValue(mockStats)
    
    render(<DashboardStats />)
    
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('1,000')).toBeInTheDocument()
    })
  })
})
```

### **API Integration Testing**
```typescript
// __tests__/api-integration.test.ts
describe('API Integration', () => {
  it('should handle API errors gracefully', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
    
    const result = await apiService.getDashboardStats()
    
    // Should show error state, not crash
    expect(result).toBeNull()
  })
})
```

## 📋 **Database Schema Updates**

### **Activity Log Table**
```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Job Progress Table**
```sql
CREATE TABLE job_progress (
    job_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB
);
```

## ⚡ **Performance Optimizations**

### **Caching Strategy**
```python
# Cache dashboard stats for 5 minutes
@router.get("/dashboard/stats")
@cache(expire=300)
async def get_dashboard_stats():
    # Expensive database queries here
    pass
```

### **Database Indexing**
```sql
-- Optimize activity log queries
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);

-- Optimize job status queries
CREATE INDEX idx_job_progress_status ON job_progress(status);
CREATE INDEX idx_job_progress_created_at ON job_progress(started_at DESC);
```

## 🚀 **Implementation Steps**

### **Step 1: Backend APIs (1-2 days)**
1. Implement dashboard stats endpoint
2. Create data quality metrics endpoint
3. Add real-time job status WebSocket
4. Create activity log system

### **Step 2: Frontend Integration (1-2 days)**
1. Update API service with real endpoints
2. Remove mock data from components
3. Add proper error handling
4. Implement loading states

### **Step 3: Real-Time Features (1 day)**
1. Add WebSocket connections
2. Implement real-time job progress
3. Add dashboard auto-refresh
4. Test real-time updates

### **Step 4: Testing & Polish (1 day)**
1. Add comprehensive tests
2. Handle edge cases
3. Optimize performance
4. Add error boundaries

## 🎯 **Success Metrics**

- ✅ All dashboard components show real data
- ✅ Real-time job progress updates
- ✅ No mock data in production
- ✅ Error handling for API failures
- ✅ Performance under load
- ✅ WebSocket connections stable

This plan will transform the dashboard from a mock interface into a fully functional, real-time data platform! 