'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline'

interface BreadcrumbItem {
  label: string
  href: string
}

export function Breadcrumb() {
  const pathname = usePathname()

  // Generate breadcrumb items from the current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []

    // Always start with home
    breadcrumbs.push({ label: 'Documentation', href: '/' })

    // Build breadcrumbs from path segments
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      // Create readable labels
      let label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      // Special cases for better labels
      if (segment === 'api-reference') label = 'API Reference'
      if (segment === 'getting-started') label = 'Getting Started'
      if (segment === 'use-cases') label = 'Use Cases'
      if (segment === 'aws-sagemaker') label = 'AWS SageMaker'
      if (segment === 'ml-training') label = 'ML Training'
      if (segment === 'quality-monitoring') label = 'Quality Monitoring'
      if (segment === 'quickstart') label = 'Quick Start'
      if (segment === 'first-call') label = 'First API Call'
      if (segment === 'api-keys') label = 'API Keys'
      if (segment === 'rate-limits') label = 'Rate Limits'
      if (segment === 'javascript') label = 'JavaScript'

      breadcrumbs.push({ label, href: currentPath })
    })

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  // Don't show breadcrumbs on home page
  if (pathname === '/') {
    return null
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 whitespace-nowrap">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1
        const isFirst = index === 0

        return (
          <div key={item.href} className="flex items-center space-x-2">
            {isLast ? (
              <span className="text-gray-900 font-medium">
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  href={item.href}
                  className="hover:text-gray-900 transition-colors duration-150"
                >
                  {item.label}
                </Link>
                <ChevronRightIcon className="h-3 w-3 text-gray-400" />
              </>
            )}
          </div>
        )
      })}
    </nav>
  )
}