'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpenIcon,
  CodeBracketIcon,
  CommandLineIcon,
  CubeIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  DocumentTextIcon,
  ClockIcon,
  SparklesIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const mainSections = [
  {
    name: 'Documentation',
    href: '/introduction',
    icon: BookOpenIcon,
    isMainSection: true,
    children: [
      { name: 'Overview', href: '/introduction' },
      { name: 'Quick Start', href: '/introduction/quickstart' },
      { name: 'Getting Started', href: '/getting-started' },
      { name: 'Architecture Overview', href: '/concepts/architecture' },
      { name: 'Data Processing Pipeline', href: '/concepts/pipeline' },
      { name: 'ML Workflow', href: '/concepts/ml-workflow' },
      { name: 'Reinforcement Learning', href: '/concepts/reinforcement-learning' },
      { name: 'ML Model Optimization', href: '/concepts/ml-optimization' },
      { name: 'Manufacturing Data Processing', href: '/concepts/manufacturing-data-processing' },
      { name: 'Manufacturing Forecasting Engine', href: '/concepts/manufacturing-forecasting' },
      { name: 'Multi-Sensor Data Fusion', href: '/concepts/multi-sensor-fusion' },
      { name: 'Predictive Maintenance', href: '/concepts/predictive-maintenance' },
      { name: 'Compatibility Mode', href: '/concepts/compatibility-mode' },
      { name: 'Feature Maturity Roadmap', href: '/concepts/feature-maturity-roadmap' },
      { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
      { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
      { name: 'Financial Services AI', href: '/industries/financial-services' },
      { name: 'E-commerce AI', href: '/industries/ecommerce' },
      { name: 'Manufacturing AI', href: '/industries/manufacturing' },
      { name: 'ML Model Training', href: '/use-cases/ml-training' },
      { name: 'Hyperparameter Optimization', href: '/use-cases/hyperparameter-optimization' },
      { name: 'Data Quality Monitoring', href: '/use-cases/quality-monitoring' },
      { name: 'Real-time Processing', href: '/use-cases/real-time-processing' },
      { name: 'Fraud Detection', href: '/use-cases/fraud-detection' },
      { name: 'Dynamic Pricing with RL', href: '/use-cases/dynamic-pricing' },
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
    icon: CommandLineIcon,
    isMainSection: true,
    flatItems: [
      { name: 'API Overview', href: '/api-reference' },
      { name: 'API Keys', href: '/api-reference/api-keys' },
      { name: 'Rate Limits', href: '/api-reference/rate-limits' },
      { name: 'Error Handling', href: '/api-reference/errors' },
      { name: 'WebSocket API', href: '/api-reference/websocket' },
    ],
    groups: [
      {
        name: 'Authentication',
        href: '/api-reference/authentication',
        children: [
          { name: 'OAuth Authorization', href: '/api-reference/authentication#oauth-authorization', method: 'GET' },
          { name: 'OAuth Callback', href: '/api-reference/authentication#oauth-callback', method: 'GET' },
          { name: 'OAuth Accounts', href: '/api-reference/authentication#oauth-accounts', method: 'GET' },
          { name: 'Unlink OAuth', href: '/api-reference/authentication#unlink-oauth', method: 'DELETE' },
        ]
      },
      {
        name: 'Users',
        href: '/api-reference/users',
        children: [
          { name: 'Get Current User', href: '/api-reference/users#get-current-user', method: 'GET' },
          { name: 'Update Current User', href: '/api-reference/users#update-current-user', method: 'PUT' },
          { name: 'List Users', href: '/api-reference/users#list-users', method: 'GET' },
          { name: 'Get User', href: '/api-reference/users#get-user', method: 'GET' },
          { name: 'Delete User', href: '/api-reference/users#delete-user', method: 'DELETE' },
          { name: 'Activate User', href: '/api-reference/users#activate-user', method: 'POST' },
          { name: 'Deactivate User', href: '/api-reference/users#deactivate-user', method: 'POST' },
        ]
      },
      {
        name: 'Storage',
        href: '/api-reference/storage',
        children: [
          { name: 'Upload File', href: '/api-reference/storage#upload-file', method: 'POST' },
          { name: 'List Files', href: '/api-reference/storage#list-files', method: 'GET' },
          { name: 'Get File Metadata', href: '/api-reference/storage#get-file-metadata', method: 'GET' },
          { name: 'Download File', href: '/api-reference/storage#download-file', method: 'GET' },
          { name: 'Delete File', href: '/api-reference/storage#delete-file', method: 'DELETE' },
          { name: 'Share File', href: '/api-reference/storage#share-file', method: 'POST' },
          { name: 'Get Quota', href: '/api-reference/storage#get-quota', method: 'GET' },
          { name: 'Create Folder', href: '/api-reference/storage#create-folder', method: 'POST' },
        ]
      },
      {
        name: 'Data Processing',
        href: "/api-reference/data-processing",
        children: [
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
        ]
      },
      {
        name: 'Document Extraction',
        href: '/api-reference/document-extraction',
        children: [
          { name: 'Extract PDF Data', href: '/api-reference/document-extraction#extract-pdf-data', method: 'POST' },
          { name: 'Extract Document Data', href: '/api-reference/document-extraction#extract-document-data', method: 'POST' },
          { name: 'Extract OCR Data', href: '/api-reference/document-extraction#extract-ocr-data', method: 'POST' },
          { name: 'List Extractions', href: '/api-reference/document-extraction#list-extractions', method: 'GET' },
          { name: 'Get Extraction', href: '/api-reference/document-extraction#get-extraction', method: 'GET' },
        ]
      },
      {
        name: 'Financial Services',
        href: "/api-reference/document-extraction",
        href: "/api-reference/financial-ai",
        children: [
          { name: 'Fraud Detection', href: '/api-reference/financial-ai#fraud-detection', method: 'POST' },
          { name: 'Credit Risk Assessment', href: '/api-reference/financial-ai#credit-risk', method: 'POST' },
          { name: 'AML Compliance Check', href: '/api-reference/financial-ai#aml-check', method: 'POST' },
        ]
      },
      {
        name: 'E-commerce',
        href: "/api-reference/financial-ai",
        href: "/api-reference/ecommerce-ai",
        children: [
          { name: 'Product Recommendations', href: '/api-reference/ecommerce-ai#recommendations', method: 'POST' },
          { name: 'Demand Forecasting', href: '/api-reference/ecommerce-ai#demand-forecast', method: 'POST' },
          { name: 'Price Optimization', href: '/api-reference/ecommerce-ai#price-optimization', method: 'POST' },
        ]
      },
      {
        name: 'Manufacturing Forecasting',
        href: '/api-reference/manufacturing-forecasting',
        children: [
          { name: 'Equipment Failure Prediction', href: '/api-reference/manufacturing-forecasting#equipment-failure-prediction', method: 'POST' },
          { name: 'Equipment Health Status', href: '/api-reference/manufacturing-forecasting#equipment-health-status', method: 'GET' },
          { name: 'Production Demand Forecast', href: '/api-reference/manufacturing-forecasting#production-demand-forecast', method: 'POST' },
          { name: 'Quality Trend Prediction', href: '/api-reference/manufacturing-forecasting#quality-trend-prediction', method: 'POST' },
          { name: 'Maintenance Optimization', href: '/api-reference/manufacturing-forecasting#maintenance-optimization', method: 'POST' },
          { name: 'Energy Consumption Forecast', href: '/api-reference/manufacturing-forecasting#energy-consumption-forecast', method: 'POST' },
          { name: 'Real-time Dashboard', href: '/api-reference/manufacturing-forecasting#realtime-dashboard', method: 'GET' },
          { name: 'Batch Processing', href: '/api-reference/manufacturing-forecasting#batch-processing', method: 'POST' },
        ]
      },
      {
        name: 'Manufacturing Data Processing',
        href: '/api-reference/manufacturing',
        children: [
          { name: 'Predictive Maintenance', href: '/api-reference/manufacturing#predictive-maintenance', method: 'POST' },
          { name: 'Quality Control Analysis', href: '/api-reference/manufacturing#quality-control', method: 'POST' },
          { name: 'Supply Chain Optimization', href: '/api-reference/manufacturing#supply-chain', method: 'POST' },
          { name: 'Sensor Data Processing', href: '/api-reference/manufacturing#sensor-processing', method: 'POST' },
          { name: 'Multi-Sensor Data Fusion', href: '/api-reference/manufacturing#data-fusion', method: 'POST' },
        ]
      },
      {
        name: 'Streaming',
        href: '/api-reference/streaming',
        children: [
          { name: 'Create Connection', href: '/api-reference/streaming#create-connection', method: 'POST' },
          { name: 'WebSocket Connection', href: '/api-reference/streaming#websocket', method: 'WebSocket' },
          { name: 'List Connections', href: '/api-reference/streaming#list-connections', method: 'GET' },
        ]
      },

      {
        name: 'ML Pipeline',
        href: '/api-reference/ml-pipeline',
        children: [
          { name: 'Create Pipeline', href: '/api-reference/ml-pipeline#create-pipeline', method: 'POST' },
          { name: 'Get Pipeline Status', href: '/api-reference/ml-pipeline#get-status', method: 'GET' },
          { name: 'Deploy Model', href: '/api-reference/ml-pipeline#deploy-model', method: 'POST' },
        ]
      },
      {
        name: 'Reinforcement Learning',
        href: '/api-reference/reinforcement-learning',
        children: [
          { name: 'Create RL Agent', href: '/api-reference/reinforcement-learning#create-agent', method: 'POST' },
          { name: 'Train Agent', href: '/api-reference/reinforcement-learning#train-agent', method: 'POST' },
          { name: 'Get Agent Status', href: '/api-reference/reinforcement-learning#get-status', method: 'GET' },
          { name: 'Deploy Agent', href: '/api-reference/reinforcement-learning#deploy-agent', method: 'POST' },
        ]
      },
      {
        name: 'Analytics',
        href: '/api-reference/analytics',
        children: [
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
          { name: 'Custom Reports', href: '/api-reference/analytics#custom-reports', method: 'POST' },
          { name: 'Performance Insights', href: '/api-reference/analytics#performance-insights', method: 'GET' },
          { name: 'Usage Patterns', href: '/api-reference/analytics#usage-patterns', method: 'GET' },
        ]
      },
      {
        name: 'Billing',
        href: '/api-reference/billing',
        children: [
          { name: 'Get Usage Statistics', href: '/api-reference/billing#get-usage-statistics', method: 'GET' },
          { name: 'Get Subscription Details', href: '/api-reference/billing#get-subscription-details', method: 'GET' },
          { name: 'Create Usage Record', href: '/api-reference/billing#create-usage-record', method: 'POST' },
          { name: 'Get Invoices', href: '/api-reference/billing#get-invoices', method: 'GET' },
          { name: 'Get Invoice', href: '/api-reference/billing#get-invoice', method: 'GET' },
          { name: 'Create Checkout Session', href: '/api-reference/billing#create-checkout-session', method: 'POST' },
          { name: 'Create Customer Portal Session', href: '/api-reference/billing#create-customer-portal-session', method: 'POST' },
          { name: 'Handle Webhook', href: '/api-reference/billing#handle-webhook', method: 'POST' },
          { name: 'Enterprise Billing', href: '/api-reference/billing#enterprise-billing', method: 'GET' },
          { name: 'Volume Discounts', href: '/api-reference/billing#volume-discounts', method: 'GET' },
          { name: 'Payment Methods', href: '/api-reference/billing#payment-methods', method: 'GET' },
          { name: 'Billing Alerts', href: '/api-reference/billing#billing-alerts', method: 'POST' },
        ]
      },
      {
        name: 'Integrations',
        href: '/api-reference/integrations',
        children: [
          { name: 'Connect Database', href: '/api-reference/integrations#connect-database', method: 'POST' },
          { name: 'Execute Database Query', href: '/api-reference/integrations#execute-database-query', method: 'POST' },
          { name: 'List Database Tables', href: '/api-reference/integrations#list-database-tables', method: 'GET' },
          { name: 'Connect Cloud Storage', href: '/api-reference/integrations#connect-cloud-storage', method: 'POST' },
          { name: 'Setup Webhook', href: '/api-reference/integrations#setup-webhook', method: 'POST' },
          { name: 'List Connections', href: '/api-reference/integrations#list-connections', method: 'GET' },
          { name: 'Remove Connection', href: '/api-reference/integrations#remove-connection', method: 'DELETE' },
        ]
      },
      {
        name: 'Data Quality',
        href: '/api-reference/data-quality',
        children: [
          { name: 'Assess Data Quality', href: '/api-reference/data-quality#assess-data-quality', method: 'POST' },
          { name: 'Clean Data', href: '/api-reference/data-quality#clean-data', method: 'POST' },
          { name: 'Feature Engineering', href: '/api-reference/data-quality#feature-engineering', method: 'POST' },
          { name: 'List Assessments', href: '/api-reference/data-quality#list-assessments', method: 'GET' },
          { name: 'Download Processed Data', href: '/api-reference/data-quality#download-processed-data', method: 'GET' },
        ]
      },
      {
        name: 'Data Processing Engine',
        href: '/api-reference/advanced-ai',
        children: [
          { name: 'Messy Data to ML-Ready', href: '/api-reference/advanced-ai#data-preprocessing', method: 'POST' },
          { name: 'Intelligent Analysis', href: '/api-reference/advanced-ai#intelligent-analysis', method: 'POST' },
          { name: 'Auto Insights Generation', href: '/api-reference/advanced-ai#auto-insights', method: 'POST' },
          { name: 'Predictive Analysis', href: '/api-reference/advanced-ai#predictive-analysis', method: 'POST' },
          { name: 'Feature Engineering', href: '/api-reference/advanced-ai#feature-engineering', method: 'POST' },
          { name: 'Model Optimization', href: '/api-reference/advanced-ai#model-optimization', method: 'POST' },
          { name: 'Use Case Validation', href: '/api-reference/advanced-ai#validation', method: 'POST' },
        ]
      },
      {
        name: 'Enterprise',
        href: '/api-reference/enterprise',
        children: [
          { name: 'Enterprise Configuration', href: '/api-reference/enterprise#config', method: 'GET' },
          { name: 'Organization Limits', href: '/api-reference/enterprise#limits', method: 'POST' },
          { name: 'Team Management', href: '/api-reference/enterprise#team-management', method: 'POST' },
          { name: 'Usage Analytics', href: '/api-reference/enterprise#usage-analytics', method: 'GET' },
        ]
      },

    ]
  },
  {
    name: 'Changelog',
    href: '/changelog',
    icon: SparklesIcon,
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
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const isActive = (href: string) => {
    return pathname === href
  }

  const getActiveMainSection = () => {
    if (pathname.startsWith('/api-reference')) return 'API Reference'
    if (pathname.startsWith('/changelog')) return 'Changelog'
    return 'Documentation' // Default for all other documentation pages
  }

  const toggleGroup = (groupName: string) => {
    console.log('Toggling group:', groupName)
    const newOpenGroups = new Set(openGroups)
    if (newOpenGroups.has(groupName)) {
      newOpenGroups.delete(groupName)
      console.log('Closing group:', groupName)
    } else {
      newOpenGroups.add(groupName)
      console.log('Opening group:', groupName)
    }
    setOpenGroups(newOpenGroups)
  }

  const currentActiveSection = activeSection || getActiveMainSection()

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-[22.5rem] h-screen">
        <div className="flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out">
          {/* Combined Logo, Search, and Navigation - now scrollable */}
          <div className="flex-1 flex flex-col pb-4 overflow-y-auto scrollbar-thin">
            <div className="pt-4">
              <div className="mb-4 pl-10">
                <Link href="/" className="block">
                  <img
                    src="/Docs Schlep-engne.svg?t=1725657600000"
                    alt="Schlep Engine"
                    className="h-14 w-auto cursor-pointer"
                  />
                </Link>
              </div>
              {/* Search Trigger */}
              <div className="mb-6 px-10">
                <button
                  onClick={() => {
                    // Trigger global search
                    const event = new CustomEvent('openGlobalSearch');
                    document.dispatchEvent(event);
                  }}
                  className="w-3/4 flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-300 shadow-sm text-left"
                >
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-500">Search...</span>
                  <span className="ml-auto text-gray-600 text-xs font-semibold">⌘K</span>
                </button>
              </div>
            </div>

            <nav className="px-10 space-y-0">

              {/* Main section buttons */}
              <div className="mb-6">
                <div className="flex flex-col space-y-1">
                  {mainSections.map((section) => (
                    <button
                      key={section.name}
                      onClick={() => {
                      setActiveSection(section.name);
                      router.push(section.href);
                    }}
                      className={clsx(
                        'w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all duration-150 group border text-left',
                        currentActiveSection === section.name
                          ? 'text-schlep-active-blue border-transparent'
                          : 'text-gray-600 border-transparent'
                      )}
                    >
                      <section.icon className="h-4 w-4 flex-shrink-0 text-schlep-dark-blue" />
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
                    {/* Handle flat items first */}
                    {section.flatItems && section.flatItems.map((item) => {
                      const getMethodColor = (method: string) => {
                        switch (method?.toUpperCase()) {
                          case 'GET': return 'bg-green-200 text-green-800'
                          case 'POST': return 'bg-blue-200 text-blue-800'
                          case 'PUT': return 'bg-orange-200 text-orange-800'
                          case 'PATCH': return 'bg-amber-200 text-amber-800'
                          case 'DELETE': return 'bg-red-200 text-red-800'
                          case 'HEAD': return 'bg-teal-200 text-teal-800'
                          case 'WEBSOCKET': return 'bg-purple-200 text-purple-800'
                          default: return 'bg-gray-200 text-gray-800'
                        }
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={clsx(
                            'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border nav-link',
                            isActive(item.href)
                              ? 'text-gray-900 border-transparent font-semibold'
                              : 'text-gray-600 border-transparent'
                          )}
                        >
                          {item.method ? (
                            <div className="flex min-w-0 flex-1">
                              <div className="w-20 flex-shrink-0 flex items-center h-6 mr-2">
                                <span className={clsx(
                                  'px-1.5 py-0.5 text-[9px] font-medium rounded leading-none inline-block',
                                  getMethodColor(item.method)
                                )}>
                                  {item.method}
                                </span>
                              </div>
                              <div className="flex items-center min-h-6">
                                <span className={clsx(
                                  'text-sm',
                                  isActive(item.href) ? 'text-gray-900' : 'text-gray-600'
                                )}>{item.name}</span>
                              </div>
                            </div>
                          ) : (
                            <span className={clsx(
                              'text-sm truncate',
                              isActive(item.href) ? 'text-gray-900' : 'text-gray-600'
                            )}>{item.name}</span>
                          )}
                        </Link>
                      )
                    })}

                    {/* Handle sections with groups (API Reference) */}
                    {section.groups ? (
                      section.groups.map((group) => (
                        <div key={group.name} className="mb-4">
                          {/* Group header with dropdown toggle */}
                          <div
                            onClick={() => {
                              toggleGroup(group.name)
                              router.push(group.href || '#')
                            }}
                            className={clsx(
                              'w-full flex items-center justify-between px-3 py-1 transition-all duration-150 nav-link cursor-pointer group',
                              isActive(group.href || '#')
                                ? 'text-schlep-active-blue'
                                : 'text-gray-600'
                            )}
                          >
                            <span className="text-sm">{group.name}</span>
                            <ChevronRightIcon
                              className={clsx(
                                'h-4 w-4 transition-transform duration-200',
                                openGroups.has(group.name) ? 'rotate-90' : 'rotate-0',
                                {
                                  'invisible group-hover:visible': !openGroups.has(group.name)
                                },
                                isActive(group.href || '#') ? 'text-schlep-active-blue' : 'text-black'
                              )}
                            />
                          </div>

                          {/* Group content */}
                          {openGroups.has(group.name) && (
                            <div className="ml-5 space-y-1 border-l border-gray-200 pl-1">
                              {group.children.map((child) => {
                                const getMethodColor = (method: string) => {
                                  switch (method?.toUpperCase()) {
                                    case 'GET': return 'bg-green-200 text-green-800'
                                    case 'POST': return 'bg-blue-200 text-blue-800'
                                    case 'PUT': return 'bg-orange-200 text-orange-800'
                                    case 'PATCH': return 'bg-amber-200 text-amber-800'
                                    case 'DELETE': return 'bg-red-200 text-red-800'
                                    case 'HEAD': return 'bg-teal-200 text-teal-800'
                                    case 'WEBSOCKET': return 'bg-purple-200 text-purple-800'
                                    default: return 'bg-gray-200 text-gray-800'
                                  }
                                }

                                return (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={clsx(
                                      'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border nav-link',
                                      isActive(child.href)
                                        ? 'text-schlep-active-blue border-transparent font-semibold'
                                        : 'text-gray-600 border-transparent'
                                    )}
                                  >
                                    {child.method ? (
                                      <div className="flex min-w-0 flex-1">
                                        <div className="w-20 flex-shrink-0 flex items-center h-6 mr-2">
                                          <span className={clsx(
                                            'px-1.5 py-0.5 text-[9px] font-medium rounded leading-none inline-block',
                                            getMethodColor(child.method)
                                          )}>
                                            {child.method}
                                          </span>
                                        </div>
                                        <div className="flex items-center min-h-6">
                                          <span className={clsx(
                                            'text-sm',
                                            isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                                          )}>{child.name}</span>
                                        </div>
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
                          )}
                        </div>
                      ))
                    ) : (
                      /* Handle sections with flat children (Documentation, Changelog) */
                      section.children && section.children.map((child) => {
                      const getMethodColor = (method: string) => {
                        switch (method?.toUpperCase()) {
                          case 'GET': return 'bg-green-200 text-green-800'
                          case 'POST': return 'bg-blue-200 text-blue-800'
                          case 'PUT': return 'bg-orange-200 text-orange-800'
                          case 'PATCH': return 'bg-amber-200 text-amber-800'
                          case 'DELETE': return 'bg-red-200 text-red-800'
                          case 'HEAD': return 'bg-teal-200 text-teal-800'
                          case 'WEBSOCKET': return 'bg-purple-200 text-purple-800'
                          default: return 'bg-gray-200 text-gray-800'
                        }
                      }

                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={clsx(
                            'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border nav-link',
                            isActive(child.href)
                              ? 'text-gray-900 border-transparent font-semibold'
                              : 'text-gray-600 border-transparent'
                          )}
                        >
                          {child.method ? (
                            <div className="flex min-w-0 flex-1">
                              <div className="w-20 flex-shrink-0 flex items-center h-6 mr-2">
                                <span className={clsx(
                                  'px-1.5 py-0.5 text-[9px] font-medium rounded leading-none inline-block',
                                  getMethodColor(child.method)
                                )}>
                                  {child.method}
                                </span>
                              </div>
                              <div className="flex items-center min-h-6">
                                <span className={clsx(
                                  'text-sm',
                                  isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                                )}>{child.name}</span>
                              </div>
                            </div>
                          ) : (
                            <span className={clsx(
                              'text-sm truncate',
                              isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                            )}>{child.name}</span>
                          )}
                        </Link>
                      )
                    })
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
