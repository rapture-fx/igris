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
      { name: 'Overview', href: '/introduction' },
      { name: 'Quick Start', href: '/introduction/quickstart' },
      { name: 'Getting Started', href: '/getting-started' },
      { name: 'Architecture Overview', href: '/concepts/architecture' },
      { name: 'Data Processing Pipeline', href: '/concepts/pipeline' },
      { name: 'ML Workflow', href: '/concepts/ml-workflow' },
      { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
      { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
      { name: 'Financial Services', href: '/industries/financial-services' },
      { name: 'E-commerce & Retail', href: '/industries/ecommerce' },
      { name: 'Manufacturing & IoT', href: '/industries/manufacturing' },
      { name: 'ML Model Training', href: '/use-cases/ml-training' },
      { name: 'Data Quality Monitoring', href: '/use-cases/quality-monitoring' },
      { name: 'Real-time Processing', href: '/use-cases/real-time-processing' },
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
      { name: 'API Keys', href: '/api-reference/api-keys' },
      { name: 'Rate Limits', href: '/api-reference/rate-limits' },
      { name: 'Error Handling', href: '/api-reference/errors' },
      { name: 'Authentication', href: '/api-reference/authentication' },
      { name: 'Users', href: '/api-reference/users' },
      { name: 'Get Current User', href: '/api-reference/users#get-current-user', method: 'GET' },
      { name: 'Update Current User', href: '/api-reference/users#update-current-user', method: 'PUT' },
      { name: 'List Users', href: '/api-reference/users#list-users', method: 'GET' },
      { name: 'Get User', href: '/api-reference/users#get-user', method: 'GET' },
      { name: 'Delete User', href: '/api-reference/users#delete-user', method: 'DELETE' },
      { name: 'Activate User', href: '/api-reference/users#activate-user', method: 'POST' },
      { name: 'Deactivate User', href: '/api-reference/users#deactivate-user', method: 'POST' },
      { name: 'OAuth Authorization', href: '/api-reference/authentication#oauth-authorization', method: 'GET' },
      { name: 'OAuth Callback', href: '/api-reference/authentication#oauth-callback', method: 'GET' },
      { name: 'OAuth Accounts', href: '/api-reference/authentication#oauth-accounts', method: 'GET' },
      { name: 'Unlink OAuth', href: '/api-reference/authentication#unlink-oauth', method: 'DELETE' },
      { name: 'Storage', href: '/api-reference/storage' },
      { name: 'Upload File', href: '/api-reference/storage#upload-file', method: 'POST' },
      { name: 'List Files', href: '/api-reference/storage#list-files', method: 'GET' },
      { name: 'Get File Metadata', href: '/api-reference/storage#get-file-metadata', method: 'GET' },
      { name: 'Download File', href: '/api-reference/storage#download-file', method: 'GET' },
      { name: 'Delete File', href: '/api-reference/storage#delete-file', method: 'DELETE' },
      { name: 'Share File', href: '/api-reference/storage#share-file', method: 'POST' },
      { name: 'Get Quota', href: '/api-reference/storage#get-quota', method: 'GET' },
      { name: 'Create Folder', href: '/api-reference/storage#create-folder', method: 'POST' },
      { name: 'Data Processing', href: '/api-reference/data-processing' },
      { name: 'Create Investigation', href: '/api-reference/data-processing#create-investigation', method: 'POST' },
      { name: 'List Investigations', href: '/api-reference/data-processing#list-investigations', method: 'GET' },
      { name: 'Get Investigation', href: '/api-reference/data-processing#get-investigation', method: 'GET' },
      { name: 'Update Investigation', href: '/api-reference/data-processing#update-investigation', method: 'PUT' },
      { name: 'Delete Investigation', href: '/api-reference/data-processing#delete-investigation', method: 'DELETE' },
      { name: 'Create Job', href: '/api-reference/data-processing#create-job', method: 'POST' },
      { name: 'List Jobs', href: '/api-reference/data-processing#list-jobs', method: 'GET' },
      { name: 'Get Job', href: '/api-reference/data-processing#get-job', method: 'GET' },
      { name: 'Update Job', href: '/api-reference/data-processing#update-job', method: 'PUT' },
      { name: 'Delete Job', href: '/api-reference/data-processing#delete-job', method: 'DELETE' },
      { name: 'Document Extraction', href: '/api-reference/document-extraction' },
      { name: 'Extract PDF Data', href: '/api-reference/document-extraction#extract-pdf-data', method: 'POST' },
      { name: 'Extract Document Data', href: '/api-reference/document-extraction#extract-document-data', method: 'POST' },
      { name: 'Extract OCR Data', href: '/api-reference/document-extraction#extract-ocr-data', method: 'POST' },
      { name: 'List Extractions', href: '/api-reference/document-extraction#list-extractions', method: 'GET' },
      { name: 'Get Extraction', href: '/api-reference/document-extraction#get-extraction', method: 'GET' },
      { name: 'ML Pipeline', href: '/api-reference/ml-pipeline' },
      { name: 'Create ML Pipeline', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'Train Pipeline', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'Get Pipeline Status', href: '/api-reference/ml-pipeline', method: 'GET' },
      { name: 'Make Predictions', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'List Models', href: '/api-reference/ml-pipeline', method: 'GET' },
      { name: 'Deploy Model', href: '/api-reference/ml-pipeline', method: 'POST' },
      { name: 'List Pipelines', href: '/api-reference/ml-pipeline', method: 'GET' },
      { name: 'Delete Pipeline', href: '/api-reference/ml-pipeline', method: 'DELETE' },
      { name: 'Analytics', href: '/api-reference/analytics' },
      { name: 'Get Time Savings', href: '/api-reference/analytics#get-time-savings', method: 'GET' },
      { name: 'Get Team Productivity', href: '/api-reference/analytics#get-team-productivity', method: 'GET' },
      { name: 'Get Dashboard Summary', href: '/api-reference/analytics#get-dashboard-summary', method: 'GET' },
      { name: 'Get System Status', href: '/api-reference/analytics#get-system-status', method: 'GET' },
      { name: 'Health Check', href: '/api-reference/analytics#health-check', method: 'GET' },
      { name: 'Trigger Alert Check', href: '/api-reference/analytics#trigger-alert-check', method: 'POST' },
      { name: 'Create Webhook', href: '/api-reference/analytics#create-webhook', method: 'POST' },
      { name: 'List Webhooks', href: '/api-reference/analytics#list-webhooks', method: 'GET' },
      { name: 'Delete Webhook', href: '/api-reference/analytics#delete-webhook', method: 'DELETE' },
      { name: 'Test Webhook', href: '/api-reference/analytics#test-webhook', method: 'POST' },
      { name: 'List Webhook Events', href: '/api-reference/analytics#list-webhook-events', method: 'GET' },
      { name: 'Billing', href: '/api-reference/billing' },
      { name: 'Get Usage Statistics', href: '/api-reference/billing#get-usage-statistics', method: 'GET' },
      { name: 'Get Subscription Details', href: '/api-reference/billing#get-subscription-details', method: 'GET' },
      { name: 'Create Usage Record', href: '/api-reference/billing#create-usage-record', method: 'POST' },
      { name: 'Get Invoices', href: '/api-reference/billing#get-invoices', method: 'GET' },
      { name: 'Get Invoice', href: '/api-reference/billing#get-invoice', method: 'GET' },
      { name: 'Create Checkout Session', href: '/api-reference/billing#create-checkout-session', method: 'POST' },
      { name: 'Create Customer Portal Session', href: '/api-reference/billing#create-customer-portal-session', method: 'POST' },
      { name: 'Handle Webhook', href: '/api-reference/billing#handle-webhook', method: 'POST' },
      { name: 'Integrations', href: '/api-reference/integrations' },
      { name: 'Connect Database', href: '/api-reference/integrations#connect-database', method: 'POST' },
      { name: 'Execute Database Query', href: '/api-reference/integrations#execute-database-query', method: 'POST' },
      { name: 'List Database Tables', href: '/api-reference/integrations#list-database-tables', method: 'GET' },
      { name: 'Get Table Schema', href: '/api-reference/integrations#get-table-schema', method: 'GET' },
      { name: 'Connect Cloud Storage', href: '/api-reference/integrations#connect-cloud-storage', method: 'POST' },
      { name: 'List Storage Files', href: '/api-reference/integrations#list-storage-files', method: 'GET' },
      { name: 'Read Storage File', href: '/api-reference/integrations#read-storage-file', method: 'POST' },
      { name: 'Connect External API', href: '/api-reference/integrations#connect-external-api', method: 'POST' },
      { name: 'Fetch API Data', href: '/api-reference/integrations#fetch-api-data', method: 'POST' },
      { name: 'Setup Webhook', href: '/api-reference/integrations#setup-webhook', method: 'POST' },
      { name: 'Connect Streaming', href: '/api-reference/integrations#connect-streaming', method: 'POST' },
      { name: 'List Connections', href: '/api-reference/integrations#list-connections', method: 'GET' },
      { name: 'Remove Connection', href: '/api-reference/integrations#remove-connection', method: 'DELETE' },
      { name: 'Integration Health Check', href: '/api-reference/integrations#integration-health-check', method: 'GET' },
      { name: 'WebSocket API', href: '/api-reference/websocket' },
      { name: 'Data Quality', href: '/api-reference/data-quality' },
      { name: 'Assess Data Quality', href: '/api-reference/data-quality#assess-data-quality', method: 'POST' },
      { name: 'Auto Clean Data', href: '/api-reference/data-quality#auto-clean-data', method: 'POST' },
      { name: 'AI Feature Engineering', href: '/api-reference/data-quality#ai-feature-engineering', method: 'POST' },
      { name: 'List Assessments', href: '/api-reference/data-quality#list-assessments', method: 'GET' },
      { name: 'Download Processed Data', href: '/api-reference/data-quality#download-processed-data', method: 'GET' },
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
      <div className="flex flex-col w-72 h-screen">
        <div className="flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out">
          {/* Fixed Logo */}
          <div className="flex-shrink-0 px-5 pt-4">
            <div className="mb-4 pl-3">
              <Link href="/" className="block">
                <img 
                  src="/new light logo Schlep-engine.svg" 
                  alt="Schlep Engine" 
                  className="h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity duration-200"
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