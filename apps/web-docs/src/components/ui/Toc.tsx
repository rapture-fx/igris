'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

export function Toc({ sections }) {
  const [activeSection, setActiveSection] = useState(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { threshold: 0.5 }
    )

    const elements = sections.map((section) => document.getElementById(section.id)).filter(Boolean)
    for (const element of elements) {
      observer.observe(element)
    }

    return () => {
      for (const element of elements) {
        observer.unobserve(element)
      }
    }
  }, [sections])

  return (
    <div className="fixed top-24 w-64">
      <h4 className="text-lg font-semibold mb-4">On this page</h4>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={clsx(
                'text-sm',
                activeSection === section.id
                  ? 'font-semibold text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
