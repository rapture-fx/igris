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
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

const navigation = [
  {
    name: 'Introduction',
    href: '/introduction',
    icon: RocketLaunchIcon,
    children: [
      { name: 'Overview', href: '/introduction' },
      { name: 'Quick Start', href: '/introduction/quickstart' },
      { name: 'API Keys', href: '/introduction/api-keys' },
      { name: 'First API Call', href: '/introduction/first-call' },
      { name: 'Pricing', href: '/introduction/pricing' },
    ],
  },
  {
    name: 'API Reference',
    href: '/api-reference',
    icon: CodeBracketIcon,
    children: [
      { name: 'Overview', href: '/api-reference' },
      { name: 'Authentication', href: '/api-reference/authentication' },
      { name: 'Data Upload', href: '/api-reference/upload' },
      { name: 'Smart Profiling', href: '/api-reference/profiling' },
      { name: 'Data Processing', href: '/api-reference/processing' },
      { name: 'Auto-Labeling', href: '/api-reference/labeling' },
      { name: 'Data Export', href: '/api-reference/export' },
      { name: 'Jobs & Status', href: '/api-reference/jobs' },
      { name: 'Webhooks', href: '/api-reference/webhooks' },
      { name: 'Rate Limits', href: '/api-reference/rate-limits' },
      { name: 'Error Handling', href: '/api-reference/errors' },
    ],
  },
  {
    name: 'SDKs & Libraries',
    href: '/sdks',
    icon: CubeIcon,
    children: [
      { name: 'Python SDK', href: '/sdks/python' },
      { name: 'JavaScript SDK', href: '/sdks/javascript' },
      { name: 'R Package', href: '/sdks/r' },
      { name: 'CLI Tool', href: '/sdks/cli' },
      { name: 'REST API', href: '/sdks/rest' },
    ],
  },
  {
    name: 'Integration Guides',
    href: '/integrations',
    icon: BookOpenIcon,
    children: [
      { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
      { name: 'Google Colab', href: '/integrations/colab' },
      { name: 'AWS SageMaker', href: '/integrations/sagemaker' },
      { name: 'Snowflake', href: '/integrations/snowflake' },
      { name: 'BigQuery', href: '/integrations/bigquery' },
      { name: 'Apache Airflow', href: '/integrations/airflow' },
      { name: 'dbt', href: '/integrations/dbt' },
      { name: 'CI/CD Pipelines', href: '/integrations/cicd' },
    ],
  },
  {
    name: 'Use Cases & Examples',
    href: '/use-cases',
    icon: LightBulbIcon,
    children: [
      { name: 'ML Model Training', href: '/use-cases/ml-training' },
      { name: 'Data Quality Monitoring', href: '/use-cases/quality-monitoring' },
      { name: 'Pipeline Preprocessing', href: '/use-cases/pipeline-preprocessing' },
      { name: 'Multi-source Harmonization', href: '/use-cases/harmonization' },
      { name: 'Real-time Processing', href: '/use-cases/realtime' },
      { name: 'E-commerce Analytics', href: '/use-cases/ecommerce' },
      { name: 'Healthcare Data', href: '/use-cases/healthcare' },
      { name: 'Financial Services', href: '/use-cases/fintech' },
    ],
  },
  {
    name: 'Advanced Features',
    href: '/advanced',
    icon: CommandLineIcon,
    children: [
      { name: 'Custom Transformations', href: '/advanced/custom-transformations' },
      { name: 'Business Logic Rules', href: '/advanced/business-rules' },
      { name: 'Batch Processing', href: '/advanced/batch-processing' },
      { name: 'Scheduling', href: '/advanced/scheduling' },
      { name: 'Data Lineage', href: '/advanced/lineage' },
      { name: 'Audit Trails', href: '/advanced/audit' },
      { name: 'Custom Models', href: '/advanced/custom-models' },
      { name: 'Performance Tuning', href: '/advanced/performance' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    )
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isExpanded = (name: string) => {
    return expandedItems.includes(name) || navigation.some(item => 
      item.name === name && item.children?.some(child => isActive(child.href))
    )
  }

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-80">
        <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-schlep-blue to-schlep-purple rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div className="ml-3">
                  <h1 className="text-lg font-semibold text-gray-900">Schlep Engine</h1>
                  <p className="text-sm text-gray-500">API Documentation</p>
                </div>
              </div>
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <div key={item.name}>
                  <div 
                    className={clsx(
                      'sidebar-link cursor-pointer',
                      isActive(item.href) && 'active'
                    )}
                    onClick={() => toggleExpanded(item.name)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    <span className="flex-1">{item.name}</span>
                    {item.children && (
                      isExpanded(item.name) ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )
                    )}
                  </div>
                  {item.children && isExpanded(item.name) && (
                    <div className="mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={clsx(
                            'sidebar-link ml-8',
                            isActive(child.href) && 'active'
                          )}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}