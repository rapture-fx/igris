'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BookOpenIcon, 
  CodeBracketIcon, 
  CommandLineIcon,
  CubeIcon,
  LightBulbIcon,
  RocketLaunchIcon
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
      { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
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

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-60">
        <div className="flex flex-col bg-gray-50" style={{backgroundColor: '#f7f7f8'}}>
          <div className="flex-1 flex flex-col pt-4 pb-4 overflow-y-auto scrollbar-thin">
            <nav className="px-5 space-y-0">
              {navigation.map((item, index) => (
                <div key={item.name} className={clsx("group", index > 0 && "border-t border-gray-100 pt-5 mt-5")}>
                  {/* Category Header - Non-clickable */}
                  <div className="flex items-center py-2 mb-3">
                    <item.icon className="mr-2.5 h-4 w-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-800 tracking-normal">
                      {item.name}
                    </span>
                  </div>
                  
                  {/* Navigation Links - Indented */}
                  {item.children && (
                    <div className="ml-7 space-y-1 mb-2">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={clsx(
                            'nav-link flex items-center py-1.5 px-2.5 text-xs rounded-md transition-all duration-200 relative',
                            isActive(child.href) 
                              ? 'bg-blue-50 text-blue-600 font-medium border-l-3 border-blue-500 -ml-0.5 shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:border-l-3 hover:border-gray-200 hover:-ml-0.5'
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