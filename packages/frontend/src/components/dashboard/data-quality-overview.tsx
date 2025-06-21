'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const qualityData = [
  { name: 'Excellent', value: 45, color: '#10B981' },
  { name: 'Good', value: 30, color: '#3B82F6' },
  { name: 'Fair', value: 20, color: '#F59E0B' },
  { name: 'Poor', value: 5, color: '#EF4444' },
]

const trendData = [
  { month: 'Jan', score: 82 },
  { month: 'Feb', score: 85 },
  { month: 'Mar', score: 83 },
  { month: 'Apr', score: 87 },
  { month: 'May', score: 89 },
  { month: 'Jun', score: 87 },
]

export function DataQualityOverview() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Data Quality Overview</h3>
        <span className="text-sm text-gray-500">Last updated: 2 hours ago</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Distribution */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-4">Quality Distribution</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={qualityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {qualityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {qualityData.map((item) => (
              <div key={item.name} className="flex items-center text-sm">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600">{item.name}: {item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Trend */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-4">Quality Trend (6 months)</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[70, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, 'Quality Score']} />
                <Bar dataKey="score" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">87%</div>
            <div className="text-sm text-gray-500">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">23</div>
            <div className="text-sm text-gray-500">Issues Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">5</div>
            <div className="text-sm text-gray-500">Critical Issues</div>
          </div>
        </div>
      </div>
    </div>
  )
} 