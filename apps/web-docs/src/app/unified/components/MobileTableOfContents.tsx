'use client'

import { useState, useEffect } from 'react'
import { 
  ListBulletIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface TocItem {
  id: string
  text: string
  level: number
}

interface MobileTableOfContentsProps {
  content: string
}

export function MobileTableOfContents({ content }: MobileTableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Extract headings from content (simplified for demo)
    const headings: TocItem[] = [
      { id: 'overview', text: 'Overview', level: 1 },
      { id: 'installation', text: 'Installation', level: 1 },
      { id: 'python-sdk', text: 'Python SDK', level: 2 },
      { id: 'javascript-sdk', text: 'JavaScript SDK', level: 2 },
      { id: 'authentication', text: 'Authentication', level: 1 },
      { id: 'api-keys', text: 'API Keys', level: 2 },
      { id: 'error-handling', text: 'Error Handling', level: 2 },
    ]
    setTocItems(headings)
  }, [content])

  useEffect(() => {
    const handleScroll = () => {
      const headingElements = tocItems.map(item => 
        document.getElementById(item.id)
      ).filter(Boolean)

      const scrollPosition = window.scrollY + 100

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const element = headingElements[i]
        if (element && element.offsetTop <= scrollPosition) {
          setActiveId(tocItems[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [tocItems])

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Mobile TOC Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        <ListBulletIcon className="h-6 w-6" />
      </button>

      {/* Mobile TOC Modal */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setIsOpen(false)} />
            
            <div className="relative w-full max-w-md transform rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Table of Contents</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="max-h-96 overflow-y-auto p-4">
                <nav className="space-y-1">
                  {tocItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToHeading(item.id)}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                        item.level === 2 && "ml-4",
                        activeId === item.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      {item.text}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}