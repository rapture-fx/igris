'use client'

import { useState, useEffect } from 'react'
import { 
  RocketLaunchIcon,
  CodeBracketIcon,
  CubeIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  CloudArrowUpIcon,
  LightBulbIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface DocumentationSidebarProps {
  isOpen: boolean
  activeSection: string
  onSectionChange: (section: string) => void
  onClose: () => void
}

const navigationStructure = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: RocketLaunchIcon,
    children: [
      { id: 'overview', name: 'Overview & Quick Start', href: 'getting-started/overview' },
      { id: 'installation', name: 'Installation & Setup', href: 'getting-started/installation' },
      { id: 'first-call', name: 'First API Call', href: 'getting-started/first-call' },
      { id: 'authentication', name: 'Authentication', href: 'getting-started/authentication' },
    ],
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    icon: CodeBracketIcon,
    children: [
      { id: 'core-endpoints', name: 'Core Endpoints', href: 'api-reference/core-endpoints' },
      { id: 'data-upload', name: 'Data Upload', href: 'api-reference/data-upload' },
      { id: 'processing-pipeline', name: 'Processing Pipeline', href: 'api-reference/processing-pipeline' },
      { id: 'export-download', name: 'Export & Download', href: 'api-reference/export-download' },
      { id: 'rate-limits-errors', name: 'Rate Limits & Errors', href: 'api-reference/rate-limits-errors' },
    ],
  },
  {
    id: 'integration-guides',
    name: 'Integration Guides',
    icon: CubeIcon,
    children: [
      { id: 'python-sdk', name: 'Python SDK', href: 'integration-guides/python-sdk' },
      { id: 'javascript-sdk', name: 'JavaScript SDK', href: 'integration-guides/javascript-sdk' },
      { id: 'jupyter-notebooks', name: 'Jupyter Notebooks', href: 'integration-guides/jupyter-notebooks' },
      { id: 'aws-sagemaker', name: 'AWS SageMaker', href: 'integration-guides/aws-sagemaker' },
      { id: 'custom-integrations', name: 'Custom Integrations', href: 'integration-guides/custom-integrations' },
    ],
  },
  {
    id: 'development',
    name: 'Development',
    icon: Cog6ToothIcon,
    children: [
      { id: 'local-setup', name: 'Local Development Setup', href: 'development/local-setup' },
      { id: 'architecture', name: 'Architecture Overview', href: 'development/architecture' },
      { id: 'security', name: 'Security Implementation', href: 'development/security' },
      { id: 'performance', name: 'Performance Optimization', href: 'development/performance' },
      { id: 'testing', name: 'Testing & Validation', href: 'development/testing' },
    ],
  },
  {
    id: 'deployment',
    name: 'Deployment',
    icon: CloudArrowUpIcon,
    children: [
      { id: 'production', name: 'Production Deployment', href: 'deployment/production' },
      { id: 'infrastructure', name: 'Infrastructure Setup', href: 'deployment/infrastructure' },
      { id: 'monitoring', name: 'Monitoring & Observability', href: 'deployment/monitoring' },
      { id: 'security-config', name: 'Security Configuration', href: 'deployment/security-config' },
      { id: 'troubleshooting', name: 'Troubleshooting', href: 'deployment/troubleshooting' },
    ],
  },
  {
    id: 'use-cases',
    name: 'Use Cases',
    icon: LightBulbIcon,
    children: [
      { id: 'ml-training', name: 'ML Model Training', href: 'use-cases/ml-training' },
      { id: 'ecommerce-analytics', name: 'E-commerce Analytics', href: 'use-cases/ecommerce-analytics' },
      { id: 'data-quality', name: 'Data Quality Monitoring', href: 'use-cases/data-quality' },
      { id: 'industry-examples', name: 'Industry Examples', href: 'use-cases/industry-examples' },
    ],
  },
  {
    id: 'resources',
    name: 'Resources',
    icon: InformationCircleIcon,
    children: [
      { id: 'faq', name: 'FAQ', href: 'resources/faq' },
      { id: 'glossary', name: 'Glossary', href: 'resources/glossary' },
      { id: 'contributing', name: 'Contributing', href: 'resources/contributing' },
      { id: 'support', name: 'Support', href: 'resources/support' },
    ],
  },
]

export function DocumentationSidebar({ isOpen, activeSection, onSectionChange, onClose }: DocumentationSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Initialize expanded sections after mount to avoid hydration mismatch
  useEffect(() => {
    setExpandedSections(new Set(['getting-started', 'api-reference']))
  }, [])

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const isActiveSection = (href: string) => {
    return activeSection === href || activeSection.startsWith(href + '/')
  }

  const getActiveParentSection = () => {
    for (const section of navigationStructure) {
      if (section.children?.some(child => isActiveSection(child.href))) {
        return section.id
      }
    }
    return null
  }

  const activeParent = getActiveParentSection()

  return (
    <>
      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-50 w-80 bg-[#111111] border-r border-gray-800 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800">
          <span className="text-lg font-semibold text-white">Documentation</span>
          <button
            type="button"
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
            onClick={onClose}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="space-y-2">
            {navigationStructure.map((section) => {
              const isExpanded = expandedSections.has(section.id)
              const isActive = activeParent === section.id

              return (
                <div key={section.id}>
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={clsx(
                      "w-full flex items-center justify-between py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200",
                      isActive 
                        ? "bg-blue-900 text-blue-300 shadow-sm" 
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <section.icon className={clsx(
                        "h-5 w-5",
                        isActive ? "text-blue-400" : "text-gray-400"
                      )} />
                      <span>{section.name}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Section Children */}
                  {isExpanded && section.children && (
                    <div className="ml-6 mt-2 space-y-1">
                      {section.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => onSectionChange(child.href)}
                          className={clsx(
                            "w-full text-left py-2 px-3 text-sm rounded-md transition-all duration-200",
                            isActiveSection(child.href)
                              ? "bg-blue-600 text-white font-medium shadow-sm"
                              : "text-gray-400 hover:text-white hover:bg-gray-800"
                          )}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Quick Links */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Quick Links
            </h3>
            <div className="space-y-2">
              <a
                href="/api-reference/interactive"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                <CodeBracketIcon className="h-4 w-4" />
                Interactive API Explorer
              </a>
              <a
                href="/playground"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                <LightBulbIcon className="h-4 w-4" />
                API Playground
              </a>
              <a
                href="/introduction/pricing"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                <InformationCircleIcon className="h-4 w-4" />
                Pricing & Limits
              </a>
            </div>
          </div>

          {/* Contact Support */}
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">
              Need Help?
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              Get support from our team or join our community
            </p>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                Contact Support
              </button>
              <button className="flex-1 px-3 py-2 text-xs font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors">
                Community
              </button>
            </div>
          </div>
        </nav>
      </div>
    </>
  )
}