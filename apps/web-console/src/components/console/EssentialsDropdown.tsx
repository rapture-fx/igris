'use client'

import React from 'react'
import { Terminal, Globe, Shield, TestTube, Webhook } from 'lucide-react'

interface EssentialsDropdownProps {
  essentials: { title: string; link?: string; onClick?: () => void; icon?: React.ReactNode }[]
  onSelect: (item: { title: string; link?: string; onClick?: () => void; icon?: React.ReactNode }) => void
}

const EssentialsDropdown: React.FC<EssentialsDropdownProps> = ({ essentials, onSelect }) => {
  const handleSelect = (item: { title: string; link?: string; onClick?: () => void }) => {
    onSelect(item)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-lg font-medium text-gray-700 font-mono">Quick Jump</h2>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {essentials.map((item) => (
          <div key={item.title} className="w-full">
            {item.link ? (
              <a
                href={item.link}
                className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-lg border hover:shadow-md transition-all duration-200 hover:border-blue-300 group"
                style={{ borderColor: '#e5e7eb' }}
                onClick={() => handleSelect(item)}
              >
                {item.icon && (
                  <div className="w-6 h-6 mb-3 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" style={{ color: '#1f53d0' }}>
                    {item.icon}
                  </div>
                )}
                <span className="text-sm font-mono text-gray-700 group-hover:text-blue-600 transition-colors duration-200">{item.title}</span>
              </a>
            ) : (
              <button
                className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-lg border hover:shadow-md transition-all duration-200 hover:border-blue-300 group w-full"
                style={{ borderColor: '#e5e7eb' }}
                onClick={() => handleSelect(item)}
              >
                {item.icon && (
                  <div className="w-6 h-6 mb-3 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" style={{ color: '#1f53d0' }}>
                    {item.icon}
                  </div>
                )}
                <span className="text-sm font-mono text-gray-700 group-hover:text-blue-600 transition-colors duration-200">{item.title}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default EssentialsDropdown