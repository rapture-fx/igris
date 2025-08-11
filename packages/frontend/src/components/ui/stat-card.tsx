'use client'

export const StatCard = ({ icon: Icon, title, value, footer, color }) => (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {footer && <p className="text-xs text-gray-500 mt-1">{footer}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.bg} bg-opacity-20`}>
          <Icon className={`w-6 h-6 ${color.icon}`} />
        </div>
      </div>
    </div>
  ); 