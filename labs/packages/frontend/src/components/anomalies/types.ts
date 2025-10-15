export interface Anomaly {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: 'statistical' | 'pattern' | 'data_quality' | 'business_rule' | 'temporal' | 'schema_validation' | 'freshness' | 'data_integrity'
  status: 'open' | 'investigating' | 'resolved' | 'false_positive'
  confidence: number
  affected_records: number
  data_source: string
  field_name?: string
  detected_at: string
  resolved_at?: string
  impact_score: number
  suggested_action?: string
  details?: {
    expected_range?: string
    actual_value?: string
    threshold?: number
    pattern?: string
    [key: string]: any
  }
}

export interface AnomalyStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  resolved_today: number
  false_positives: number
  avg_detection_time: number // in minutes
  data_health_score: number // out of 100
} 