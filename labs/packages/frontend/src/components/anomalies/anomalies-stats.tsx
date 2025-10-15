'use client'

import { AnomalyStats } from './types'
import { BarChart3, CheckCircle2, Shield, TrendingUp, AlertTriangle, Clock } from 'lucide-react'

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: React.ElementType, color: string }) => (
  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
    <div className="flex items-center">
      <div className={`mr-4 p-3 rounded-full bg-${color}-100`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);


export const AnomaliesStats = ({ stats }: { stats: AnomalyStats | null }) => {
  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard title="Total Active Anomalies" value={stats.total} icon={AlertTriangle} color="red" />
      <StatCard title="Data Health Score" value={`${stats.data_health_score}%`} icon={Shield} color="green" />
      <StatCard title="Resolved Today" value={stats.resolved_today} icon={CheckCircle2} color="blue" />
      <StatCard title="Avg. Detection Time" value={`${stats.avg_detection_time} min`} icon={Clock} color="purple" />
    </div>
  )
} 