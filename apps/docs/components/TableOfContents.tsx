'use client'

import React, { useEffect, useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/24/outline'

interface TocItem {
  id: string
  title: string
  level: number
}

export function TableOfContents() {
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Extract headings from the page
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const items: TocItem[] = []

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1))
      const title = heading.textContent || ''
      let id = heading.id

      // Generate ID if none exists
      if (!id) {
        id = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        heading.id = id
      }

      items.push({ id, title, level })
    })

    setTocItems(items)

    // Set up intersection observer for active section tracking
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-20% 0% -35% 0%',
        threshold: 0
      }
    )

    headings.forEach((heading) => observer.observe(heading))

    return () => observer.disconnect()
  }, [])

  if (tocItems.length === 0) {
    return (
      <div className="hidden xl:block w-64 flex-shrink-0">
        <div className="sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="bg-gray-50/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">On this page</h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-500 italic">Loading table of contents...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="hidden xl:block w-64 flex-shrink-0">
      <div className="sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="bg-gray-50/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">On this page</h3>
          <nav className="space-y-1">
            {tocItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToHeading(item.id)}
                className={`block w-full text-left text-sm transition-colors duration-200 py-1 ${
                  item.level === 1 ? 'pl-0' :
                  item.level === 2 ? 'pl-3' :
                  item.level === 3 ? 'pl-6' :
                  'pl-9'
                } ${
                  activeId === item.id
                    ? 'text-[#1A5799] font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center">
                  {activeId === item.id && (
                    <ChevronRightIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                  )}
                  <span className="truncate">{item.title}</span>
                </div>
              </button>
            ))}
          </nav>
          
          {/* Additional helpful information */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Quick Links
            </h4>
            <div className="space-y-1">
              <a
                href="/api-reference"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                API Reference
              </a>
              <a
                href="/sdks"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                SDKs & Libraries
              </a>
              <a
                href="/getting-started"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                Getting Started
              </a>
              <a
                href="/use-cases"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                Use Cases
              </a>
            </div>
          </div>

          {/* Help section */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Need Help?
            </h4>
            <div className="space-y-1">
              <a
                href="/community"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                Community Forum
              </a>
              <a
                href="/troubleshooting"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                Troubleshooting
              </a>
              <a
                href="mailto:support@schlepengine.com"
                className="block text-sm text-gray-600 hover:text-[#1A5799] transition-colors py-1"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}