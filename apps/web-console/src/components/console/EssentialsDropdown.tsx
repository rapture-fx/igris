'use client'

import React, { useState } from 'react'
import { ChevronDown, Terminal, Globe, Shield, TestTube, Webhook } from 'lucide-react'

interface EssentialsDropdownProps {
  essentials: { title: string; link?: string; onClick?: () => void; icon?: React.ReactNode }[]
  onSelect: (item: { title: string; link?: string; onClick?: () => void; icon?: React.ReactNode }) => void
}

const EssentialsDropdown: React.FC<EssentialsDropdownProps> = ({ essentials, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('Quick Jump')

  const handleSelect = (item: { title: string; link?: string; onClick?: () => void }) => {
    setSelectedTitle(item.title)
    onSelect(item)
    setIsOpen(false)
  }

  return (
    <div className="relative inline-block text-left w-full max-w-md mx-auto">
      <div>
        <button
          type="button"
          className="inline-flex justify-between w-full px-4 py-2 text-2xl font-medium text-gray-700 hover:text-blue-600 focus:outline-none font-mono"
          id="essentials-menu-button"
          aria-expanded="true"
          aria-haspopup="true"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selectedTitle}
          <ChevronDown className="-mr-1 ml-0 h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div
          className="mt-2 w-full rounded-md focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="essentials-menu-button"
          tabIndex={-1}
        >
          <div className="py-1" role="none">
            {essentials.map((item, index) => (
              <div key={item.title} className="relative flex items-center px-4 py-2 text-sm">
                {item.link ? (
                  <a
                    href={item.link}
                    className="text-gray-900 flex items-center space-x-2 px-4 py-2 w-full hover:text-blue-600 font-mono"
                    role="menuitem"
                    tabIndex={-1}
                    id={`essentials-menu-item-${item.title}`}
                    onClick={() => handleSelect(item)}
                  >
                    {item.icon && (
                      <div className="w-4 h-4 flex-shrink-0" style={{ color: '#1f53d0' }}>
                        {item.icon}
                      </div>
                    )}
                    <span>{item.title}</span>
                  </a>
                ) : (
                  <button
                    className="text-gray-900 flex items-center space-x-2 px-4 py-2 w-full hover:text-blue-600 text-left font-mono"
                    role="menuitem"
                    tabIndex={-1}
                    id={`essentials-menu-item-${item.title}`}
                    onClick={() => handleSelect(item)}
                  >
                    {item.icon && (
                      <div className="w-4 h-4 flex-shrink-0" style={{ color: '#1f53d0' }}>
                        {item.icon}
                      </div>
                    )}
                    <span>{item.title}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default EssentialsDropdown