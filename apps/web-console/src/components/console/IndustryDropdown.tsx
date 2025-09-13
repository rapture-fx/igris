'use client'

import React, { useState } from 'react'
import { ChevronDown, Cpu, Factory, ShoppingCart, Building2 } from 'lucide-react'

interface IndustryDropdownProps {
  industries: { title: string; link: string; icon?: React.ReactNode }[]
  onSelect: (link: string) => void
}

const IndustryDropdown: React.FC<IndustryDropdownProps> = ({ industries, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('Industries')

  const handleSelect = (industry: { title: string; link: string }) => {
    setSelectedTitle(industry.title)
    onSelect(industry.link)
    setIsOpen(false)
  }

  return (
    <div className="relative inline-block text-left w-full max-w-md mx-auto">
      <div>
        <button
          type="button"
          className="inline-flex justify-between w-full px-4 py-2 text-2xl font-medium text-gray-700 hover:text-blue-600 focus:outline-none font-mono"
          id="menu-button"
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
          aria-labelledby="menu-button"
          tabIndex={-1}
        >
          <div className="py-1" role="none">
            {industries.map((industry, index) => (
              <div key={industry.title} className="relative flex items-center px-4 py-2 text-sm">
                <a
                  href={industry.link}
                  className="text-gray-900 flex items-center space-x-2 px-4 py-2 w-full hover:text-blue-600 font-mono"
                  role="menuitem"
                  tabIndex={-1}
                  id={`menu-item-${industry.title}`}
                  onClick={() => handleSelect(industry)}
                >
                  {industry.icon && (
                    <div className="w-4 h-4 flex-shrink-0" style={{ color: '#1f53d0' }}>
                      {industry.icon}
                    </div>
                  )}
                  <span>{industry.title}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default IndustryDropdown
