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
        <div className="flex flex-col bg-[#161616] border-r border-gray-800 transition-all duration-300 ease-in-out">
          <div className="flex-1 flex flex-col pt-4 pb-4 overflow-y-auto scrollbar-thin">
            <nav className="px-5 space-y-0">

              {navigation.map((item, index) => (
                <div key={item.name} className={clsx("group", index > 0 && "pt-5 mt-5")}>
                  {/* Category Header - Non-clickable */}
                  <div className="flex items-center py-2 mb-3 px-3">
                    <span className="text-sm font-semibold text-gray-300 tracking-normal">
                      {item.name}
                    </span>
                  </div>
                  
                  {/* Navigation Links */}
                  {item.children && (
                    <div className="space-y-1 mb-2">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={clsx(
                            'w-full flex items-center space-x-3 px-3 py-1.5 rounded-xl transition-all duration-150 group border',
                            isActive(child.href) 
                              ? 'bg-[#222222] border-[#1d1d1d] text-[#fcfcf7] shadow-inner' 
                              : 'text-gray-400 hover:bg-[#161616] hover:text-[#fcfcf7] active:bg-[#1a1a1a] border-transparent'
                          )}
                        >
                          <span className="text-sm">{child.name}</span>
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