'use client'

import { BarChart3, Database, Cpu, Clock } from 'lucide-react'

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
  <div className="bg-white p-6 rounded-lg border border-gray-200">
    <div className="flex items-center">
      <div className="mr-4">
        <Icon className="w-8 h-8 text-blue-500" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

export const UsageTab = () => {
  const usageStats = {
    datasetsProcessed: 42,
    dataProcessed: '15.2 GB',
    apiCalls: '1,245,678',
    computeHours: '73.5 hours'
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Usage Overview</h3>
          <p className="mt-1 text-sm text-gray-600">Monitor your resource consumption for the current billing cycle.</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Datasets Processed" value={String(usageStats.datasetsProcessed)} icon={Database} />
            <StatCard title="Data Processed" value={usageStats.dataProcessed} icon={BarChart3} />
            <StatCard title="API Calls" value={usageStats.apiCalls} icon={Cpu} />
            <StatCard title="Compute Hours" value={usageStats.computeHours} icon={Clock} />
          </div>
        </div>
      </div>
      {/* We can add more detailed charts here in the future */}
    </div>
  )
} 