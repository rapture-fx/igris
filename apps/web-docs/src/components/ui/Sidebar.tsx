'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BookOpenIcon, 
  CodeBracketIcon, 
  CommandLineIcon,
  CubeIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  DocumentTextIcon,
  ClockIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const mainSections = [
  {
    name: 'Documentation',
    href: '/documentation',
    icon: DocumentTextIcon,
    isMainSection: true,
    children: [
      { name: 'Introduction', href: '/introduction' },
      { name: 'Quick Start', href: '/introduction/quickstart' },
      { name: 'Getting Started', href: '/getting-started' },
      { name: 'Concepts & Architecture', href: '/concepts/architecture' },
      { name: 'Data Processing Pipeline', href: '/concepts/pipeline' },
      { name: 'Machine Learning Workflow', href: '/concepts/ml-workflow' },
      { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
      { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
      { name: 'Google Colab', href: '/integrations/google-colab' },
      { name: 'Databricks', href: '/integrations/databricks' },
      { name: 'Snowflake', href: '/integrations/snowflake' },
      { name: 'Financial Services', href: '/industries/financial-services' },
      { name: 'E-commerce & Retail', href: '/industries/ecommerce' },
      { name: 'Healthcare & Life Sciences', href: '/industries/healthcare' },
      { name: 'Manufacturing & IoT', href: '/industries/manufacturing' },
      { name: 'Media & Entertainment', href: '/industries/media' },
      { name: 'ML Model Training', href: '/use-cases/ml-training' },
      { name: 'Data Quality Monitoring', href: '/use-cases/quality-monitoring' },
      { name: 'Real-time Processing', href: '/use-cases/realtime-processing' },
      { name: 'Fraud Detection', href: '/use-cases/fraud-detection' },
      { name: 'Customer Analytics', href: '/use-cases/customer-analytics' },
      { name: 'Security & Compliance', href: '/security/overview' },
      { name: 'Best Practices', href: '/guides/best-practices' },
      { name: 'Troubleshooting', href: '/guides/troubleshooting' },
      { name: 'Pricing & Plans', href: '/introduction/pricing' },
    ],
  },
  {
    name: 'API Reference',
    href: '/api-reference',
    icon: CodeBracketIcon,
    isMainSection: true,
    children: [
      { name: 'API Overview', href: '/api-reference' },
      { name: 'Authentication', href: '/api-reference/authentication' },
      { name: 'API Keys', href: '/api-reference/api-keys' },
      { name: 'Rate Limits', href: '/api-reference/rate-limits' },
      { name: 'Error Handling', href: '/api-reference/errors' },
      { name: 'Upload Files', href: '/api-reference/upload', method: 'POST' },
      { name: 'List Uploads', href: '/api-reference/upload', method: 'GET' },
      { name: 'Get Upload Details', href: '/api-reference/upload', method: 'GET' },
      { name: 'Delete Upload', href: '/api-reference/upload', method: 'DELETE' },
      { name: 'Create Investigation', href: '/api-reference/data-processing', method: 'POST' },
      { name: 'Create Processing Job', href: '/api-reference/data-processing', method: 'POST' },
      { name: 'List Processing Jobs', href: '/api-reference/data-processing', method: 'GET' },
      { name: 'Get Job Details', href: '/api-reference/data-processing', method: 'GET' },
      { name: 'Extract PDF Data', href: '/api-reference/data-processing', method: 'POST' },
      { name: 'Create ML Pipeline', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'Get Pipeline Status', href: '/api-reference/ml-pipeline', method: 'GET' },
      { name: 'Make Predictions', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'List Models', href: '/api-reference/ml-pipeline', method: 'GET' },
      { name: 'Deploy Model', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'Time Savings Analytics', href: '/api-reference/analytics', method: 'GET' },
      { name: 'Team Productivity', href: '/api-reference/analytics', method: 'GET' },
      { name: 'System Status', href: '/api-reference/analytics', method: 'GET' },
      { name: 'Create Webhook', href: '/api-reference/analytics', method: 'POST' },
      { name: 'Usage Statistics', href: '/api-reference/billing', method: 'GET' },
      { name: 'Subscription Details', href: '/api-reference/billing', method: 'GET' },
      { name: 'Create Usage Record', href: '/api-reference/billing', method: 'POST' },
      { name: 'Billing Overview', href: '/api-reference/billing', method: 'GET' },
      { name: 'Interactive Explorer', href: '/api-reference/interactive' },
    ],
  },
  {
    name: 'Changelog',
    href: '/changelog',
    icon: ClockIcon,
    isMainSection: true,
    children: [
      { name: 'Latest Updates', href: '/changelog' },
      { name: 'Version 2.3.0', href: '/changelog/v2-3-0' },
      { name: 'Version 2.2.0', href: '/changelog/v2-2-0' },
      { name: 'Version 2.1.0', href: '/changelog/v2-1-0' },
      { name: 'Version 2.0.0', href: '/changelog/v2-0-0' },
      { name: 'Version 1.9.0', href: '/changelog/v1-9-0' },
      { name: 'Migration Guides', href: '/changelog/migration-guides' },
      { name: 'Breaking Changes', href: '/changelog/breaking-changes' },
      { name: 'Deprecation Notices', href: '/changelog/deprecations' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['REST API Endpoints']))

  const isActive = (href: string) => {
    return pathname === href
  }

  const getActiveMainSection = () => {
    if (pathname.startsWith('/api-reference')) return 'API Reference'
    if (pathname.startsWith('/changelog')) return 'Changelog'
    return 'Documentation' // Default for all other documentation pages
  }

  const toggleGroup = (groupName: string) => {
    const newOpenGroups = new Set(openGroups)
    if (newOpenGroups.has(groupName)) {
      newOpenGroups.delete(groupName)
    } else {
      newOpenGroups.add(groupName)
    }
    setOpenGroups(newOpenGroups)
  }

  const currentActiveSection = activeSection || getActiveMainSection()

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 h-screen">
        <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200 transition-all duration-300 ease-in-out">
          {/* Fixed Logo */}
          <div className="flex-shrink-0 px-5 pt-4">
            <div className="mb-4 pl-3">
              <Link href="/" className="block">
                <img 
                  src="/Schlep Engine lightmode.svg" 
                  alt="Schlep Engine" 
                  className="h-16 w-auto cursor-pointer hover:opacity-80 transition-opacity duration-200"
                />
              </Link>
            </div>
            {/* Search Trigger */}
            <div className="mb-6 px-3">
              <button 
                onClick={() => {
                  // Trigger global search
                  const event = new CustomEvent('openGlobalSearch');
                  document.dispatchEvent(event);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-300 shadow-sm text-left"
              >
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-500">Search...</span>
                <span className="ml-auto text-gray-600 text-xs font-semibold">⌘K</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col pb-4 overflow-y-auto scrollbar-thin">
            <nav className="px-5 space-y-0">

              {/* Main section buttons */}
              <div className="mb-6">
                <div className="flex flex-col space-y-1">
                  {mainSections.map((section) => (
                    <button
                      key={section.name}
                      onClick={() => setActiveSection(section.name)}
                      className={clsx(
                        'w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all duration-150 group border text-left',
                        currentActiveSection === section.name
                          ? 'text-gray-900 border-transparent'
                          : 'text-gray-600 border-transparent'
                      )}
                    >
                      <section.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-semibold">{section.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal divider */}
              <div className="border-b border-gray-200 my-8"></div>

              {/* Show content for active section */}
              {mainSections
                .filter(section => section.name === currentActiveSection)
                .map(section => (
                  <div key={section.name} className="space-y-1">
                    {section.children && section.children.map((child) => {
                      const getMethodColor = (method: string) => {
                        switch (method?.toUpperCase()) {
                          case 'GET': return 'bg-green-200 text-green-800'
                          case 'POST': return 'bg-blue-200 text-blue-800'
                          case 'PUT': return 'bg-orange-200 text-orange-800'
                          case 'PATCH': return 'bg-amber-200 text-amber-800'
                          case 'DELETE': return 'bg-red-200 text-red-800'
                          case 'HEAD': return 'bg-teal-200 text-teal-800'
                          default: return 'bg-gray-200 text-gray-800'
                        }
                      }

                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={clsx(
                            'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border',
                            isActive(child.href) 
                              ? 'text-gray-900 border-transparent' 
                              : 'text-gray-600 border-transparent'
                          )}
                        >
                          {child.method ? (
                            <div className="flex items-start min-w-0 flex-1">
                              <div className="w-16 flex-shrink-0 pt-0.5">
                                <span className={clsx(
                                  'px-0.5 py-0.5 text-[8px] font-normal rounded-sm leading-none inline-block',
                                  getMethodColor(child.method)
                                )}>
                                  {child.method}
                                </span>
                              </div>
                              <span className={clsx(
                                'text-sm leading-relaxed',
                                isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                              )}>{child.name}</span>
                            </div>
                          ) : (
                            <span className={clsx(
                              'text-sm truncate',
                              isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                            )}>{child.name}</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}