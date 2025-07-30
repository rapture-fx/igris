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
    name: 'Getting Started',
    href: '/getting-started',
    icon: RocketLaunchIcon,
    children: [
      { name: 'Overview', href: '/getting-started' },
      { name: 'Authentication', href: '/getting-started/authentication' },
      { name: 'Rate Limits', href: '/getting-started/rate-limits' },
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
    ],
  },
  {
    name: 'SDKs & Libraries',
    href: '/sdks',
    icon: CubeIcon,
    children: [
      { name: 'Overview', href: '/sdks' },
      { name: 'Python SDK', href: '/sdks/python' },
      { name: 'JavaScript SDK', href: '/sdks/javascript' },
    ],
  },
  {
    name: 'Integration Guides',
    href: '/integrations',
    icon: BookOpenIcon,
    children: [
      { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
      { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
    ],
  },
  {
    name: 'Use Cases & Examples',
    href: '/use-cases',
    icon: LightBulbIcon,
    children: [
      { name: 'ML Model Training', href: '/use-cases/ml-training' },
      { name: 'Data Quality Monitoring', href: '/use-cases/quality-monitoring' },
      { name: 'E-commerce Analytics', href: '/use-cases/ecommerce' },
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
        <div className="flex flex-col bg-gray-50 dark:bg-slate-900 transition-colors duration-300" style={{backgroundColor: '#f7f7f8'}}>
          <div className="flex-1 flex flex-col pt-4 pb-4 overflow-y-auto scrollbar-thin">
            <nav className="px-5 space-y-0">
              {navigation.map((item, index) => (
                <div key={item.name} className={clsx("group", index > 0 && "border-t border-gray-100 dark:border-slate-700 pt-5 mt-5 transition-colors duration-300")}>
                  {/* Category Header - Non-clickable */}
                  <div className="flex items-center py-2 mb-3">
                    <item.icon className="mr-2.5 h-4 w-4 text-gray-500 dark:text-slate-400 transition-colors duration-300" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 tracking-normal transition-colors duration-300">
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
                              ? 'bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 font-medium border-l-3 border-blue-500 dark:border-blue-400 -ml-0.5 shadow-sm transition-colors duration-300' 
                              : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-l-3 hover:border-gray-200 dark:hover:border-slate-600 hover:-ml-0.5 transition-colors duration-300'
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