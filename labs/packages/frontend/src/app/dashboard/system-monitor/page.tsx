'use client'

import { RealtimeProcessingStatus } from '@/components/monitoring/realtime-processing-status'

export default function SystemMonitorPage() {
  return (
    <div className="space-y-6">
      <RealtimeProcessingStatus autoRefresh={true} refreshInterval={3000} />
    </div>
  )
} 