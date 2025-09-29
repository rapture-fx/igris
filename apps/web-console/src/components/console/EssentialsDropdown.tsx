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
        <h2 className="text-xl font-medium text-blue-600">Schlep-engine</h2>
      </div>

      {/* Vertical Layout */}
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        {essentials.map((item) => (
          <div key={item.title} className="w-full">
            {item.link ? (
              <a
                href={item.link}
                className="flex items-center justify-start p-4 group"
                onClick={() => handleSelect(item)}
              >
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors duration-200">{item.title}</span>
              </a>
            ) : (
              <button
                className="flex items-center justify-start p-4 group w-full"
                onClick={() => handleSelect(item)}
              >
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors duration-200">{item.title}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default EssentialsDropdown