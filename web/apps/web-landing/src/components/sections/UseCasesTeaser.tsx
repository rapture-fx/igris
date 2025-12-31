import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function UseCasesTeaser() {
  const useCases = [
    {
      title: 'Enterprise AI Operations',
      description: 'Multi-tenant cost control, quality monitoring, and intelligent routing for teams managing AI at scale.',
      product: 'Overture'
    },
    {
      title: 'Autonomous Systems',
      description: 'Offline-capable AI for robotics, drones, and vehicles that need to keep working without connectivity.',
      product: 'Runtime'
    },
    {
      title: 'Hybrid Deployments',
      description: 'Cloud routing with automatic local fallback. Keep your applications online when cloud providers fail.',
      product: 'Both'
    },
    {
      title: 'Regulated Environments',
      description: 'Completely offline operation after setup. Encrypted storage, no telemetry, ideal for secure facilities.',
      product: 'Runtime'
    },
  ]

  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1350px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
        }}>
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          <div className="w-full px-0">
            <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-66.67%)'
            }}></div>

            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                Use Cases
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                How teams use Igris for AI workloads across cloud and edge.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              {/* Left Column - Empty */}
              <div className="hidden lg:flex text-left lg:col-span-2 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
              </div>

              {/* Right Column - All Content */}
              <div className="text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                  Use Cases
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter mb-12">
                  How teams use Igris for AI workloads across cloud and edge.
                </p>

                {/* Use Cases List - without cards */}
                <div className="flex flex-col gap-8">
                  {useCases.map((useCase, index) => (
                    <div key={useCase.title} className="text-left">
                      <h3 className="text-base font-normal text-gray-900 dark:text-white mb-3 font-inter">
                        {useCase.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-2">
                        {useCase.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* View All Link */}
                <div className="mt-8">
                  <Link href="/use-cases" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm hover:translate-x-1 transition-transform">
                    View all use cases
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
