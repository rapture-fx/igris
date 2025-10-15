'use client'

import { TrendingUp } from 'lucide-react';

export const StatCard = ({ icon: Icon, title, value, change, changeType, footer, color }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {footer && <p className="text-xs text-gray-400 mt-2">{footer}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.bg} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${color.icon}`} />
        </div>
      </div>
      {change && (
        <p className={`text-sm mt-4 flex items-center ${changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
          <TrendingUp className="w-4 h-4 mr-1" />
          {change}
        </p>
      )}
    </div>
  ); 