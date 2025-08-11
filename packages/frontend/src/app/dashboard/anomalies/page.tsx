'use client'

import { useState } from 'react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { AnomaliesStats } from '@/components/anomalies/anomalies-stats'
import { AnomaliesToolbar } from '@/components/anomalies/anomalies-toolbar'
import { AnomaliesList } from '@/components/anomalies/anomalies-list'
import { AnomalyDetailsPanel } from '@/components/anomalies/anomaly-details-panel'
import { 
  AlertTriangle, 
  Shield, 
  RefreshCw,
  Settings,
  Filter,
  Search,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Activity,
  Bell,
  Target
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Mock data for anomalies
const mockAnomalies = [
  {
    id: '1',
    title: 'Unusual Data Pattern Detected',
    description: 'Sudden spike in null values detected in customer_email field',
    severity: 'high' as const,
    type: 'data_quality' as const,
    status: 'open' as const,
    timestamp: '2024-01-15T10:30:00Z',
    dataset: 'customer_data',
    confidence: 0.95,
    affected_rows: 1250,
    affected_records: 1250,
    data_source: 'customer_database',
    detected_at: '2024-01-15T10:30:00Z',
    impact_score: 85,
    false_positive: false,
    resolution_time: null
  },
  {
    id: '2',
    title: 'Schema Validation Failed',
    description: 'Required field product_category missing in 15% of records',
    severity: 'medium' as const,
    type: 'schema_validation' as const,
    status: 'investigating' as const,
    timestamp: '2024-01-15T09:15:00Z',
    dataset: 'product_catalog',
    confidence: 0.88,
    affected_rows: 324,
    affected_records: 324,
    data_source: 'product_database',
    detected_at: '2024-01-15T09:15:00Z',
    impact_score: 65,
    false_positive: false,
    resolution_time: null
  },
  {
    id: '3',
    title: 'Data Freshness Alert',
    description: 'Dataset has not been updated in 24+ hours',
    severity: 'low' as const,
    type: 'freshness' as const,
    status: 'resolved' as const,
    timestamp: '2024-01-14T16:45:00Z',
    dataset: 'order_history',
    confidence: 1.0,
    affected_rows: 0,
    affected_records: 0,
    data_source: 'order_system',
    detected_at: '2024-01-14T16:45:00Z',
    impact_score: 25,
    false_positive: false,
    resolution_time: 120
  },
  {
    id: '4',
    title: 'Duplicate Records Found',
    description: 'High number of duplicate entries in user_profiles table',
    severity: 'critical' as const,
    type: 'data_integrity' as const,
    status: 'open' as const,
    timestamp: '2024-01-15T11:20:00Z',
    dataset: 'user_profiles',
    confidence: 0.92,
    affected_rows: 2890,
    affected_records: 2890,
    data_source: 'user_database',
    detected_at: '2024-01-15T11:20:00Z',
    impact_score: 95,
    false_positive: false,
    resolution_time: null
  }
]

export default function AnomaliesPage() {
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const filteredAndSortedAnomalies = mockAnomalies.filter(anomaly => {
    const matchesSearch = anomaly.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         anomaly.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || anomaly.severity === severityFilter
    const matchesType = typeFilter === 'all' || anomaly.type === typeFilter
    const matchesStatus = statusFilter === 'all' || anomaly.status === statusFilter
    
    return matchesSearch && matchesSeverity && matchesType && matchesStatus
  })

  const stats = {
    total: mockAnomalies.length,
    critical: mockAnomalies.filter(a => a.severity === 'critical').length,
    high: mockAnomalies.filter(a => a.severity === 'high').length,
    medium: mockAnomalies.filter(a => a.severity === 'medium').length,
    low: mockAnomalies.filter(a => a.severity === 'low').length,
    resolved_today: mockAnomalies.filter(a => a.status === 'resolved' && new Date(a.timestamp).toDateString() === new Date().toDateString()).length,
    false_positives: 0,
    avg_detection_time: 15,
    data_health_score: 85
  }

  const EmptyState = () => (
    <Card className="border-gray-200/60">
      <CardContent className="p-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">No Anomalies Detected</h3>
            <p className="text-gray-600 mt-2">
              Your data is looking healthy! No anomalies match your current filters.
            </p>
          </div>
          <Button
            onClick={() => {
              setSearchTerm('')
              setSeverityFilter('all')
              setTypeFilter('all')
              setStatusFilter('all')
            }}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomaly Detection"
        description="Monitor, investigate, and resolve data anomalies detected across your pipelines and datasets."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Anomalies' }
        ]}
        stats={[
          {
            label: 'Total Anomalies',
            value: stats.total,
            icon: AlertTriangle,
            color: 'red'
          },
          {
            label: 'High Priority',
            value: stats.high,
            icon: Target,
            color: 'red'
          },
          {
            label: 'Critical Issues',
            value: stats.critical,
            icon: Clock,
            color: 'yellow'
          },
          {
            label: 'Resolved Today',
            value: stats.resolved_today,
            icon: CheckCircle,
            color: 'green'
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Refresh 
              onClick={handleRefresh}
              isLoading={isRefreshing}
              tooltip="Refresh anomalies"
            />
            <PageHeaderActions.Secondary
              icon={Settings}
              onClick={() => {}}
            >
              Detection Settings
            </PageHeaderActions.Secondary>
            <PageHeaderActions.Primary
              icon={Bell}
              onClick={() => {}}
            >
              Setup Alerts
            </PageHeaderActions.Primary>
          </div>
        }
      />

      <div className="space-y-6">
        <AnomaliesStats stats={stats} />
        
        <AnomaliesToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          severityFilter={severityFilter}
          onSeverityFilterChange={setSeverityFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRefresh={handleRefresh}
          onExport={() => {}}
        />
        
        {filteredAndSortedAnomalies.length > 0 ? (
          <AnomaliesList 
            anomalies={filteredAndSortedAnomalies} 
            onSelectAnomaly={setSelectedAnomaly} 
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <AnomalyDetailsPanel 
        anomaly={selectedAnomaly} 
        onClose={() => setSelectedAnomaly(null)} 
      />
    </div>
  )
}
