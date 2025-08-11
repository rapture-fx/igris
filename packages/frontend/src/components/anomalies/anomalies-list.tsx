'use client'

import { Anomaly } from './types'
import { AnomalyCard } from './anomaly-card'

export const AnomaliesList = ({ anomalies, onSelectAnomaly }: { anomalies: Anomaly[], onSelectAnomaly: (anomaly: Anomaly | null) => void }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {anomalies.map(anomaly => (
        <AnomalyCard key={anomaly.id} anomaly={anomaly} onSelect={() => onSelectAnomaly(anomaly)} />
      ))}
    </div>
  )
} 