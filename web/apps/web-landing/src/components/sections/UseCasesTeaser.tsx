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
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
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
              <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Use Cases
              </h3>
              <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                How teams use Igris for AI workloads across cloud and edge.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="w-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {useCases.map((useCase) => (
                      <Link href="/use-cases" key={useCase.title} className="group">
                        <div className="rounded-3xl p-4 md:p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[200px] flex flex-col group-hover:border-gray-400/80" style={{ backgroundColor: '#f6f6f4' }}>
                          <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                            {useCase.title}
                          </h5>
                          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 font-inter flex-grow">
                            {useCase.description}
                          </p>
                          <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs group-hover:translate-x-1 transition-transform">
                            Learn more
                            <ChevronRight className="ml-1 h-3 w-3" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="text-center">
                    <Link href="/use-cases" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm hover:translate-x-1 transition-transform">
                      View all use cases
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Use Cases
                </h3>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                  How teams use Igris for AI workloads across cloud and edge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
