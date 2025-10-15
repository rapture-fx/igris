'use client'

import Link from 'next/link'
import { Activity, ChevronRight } from 'lucide-react'

export const RecentActivityCard = ({ activity, getTimeAgo }) => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <p className="text-sm text-gray-600">Latest updates and alerts</p>
          </div>
        </div>
        <Link href="/dashboard/audit-logs">
          <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </Link>
      </div>
      <div className="space-y-4">
        {activity.map((item, index) => (
          <div key={index} className="flex items-start">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{item.description}</p>
              <p className="text-sm text-gray-500">{getTimeAgo(item.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ); 