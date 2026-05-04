import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function UseCasesTeaser() {
  const useCases = [
    {
      title: 'Enterprise AI Operations',
      description: 'Multi-tenant cost control, governed execution, and path-selection visibility for teams managing AI at scale.',
    },
    {
      title: 'Hybrid Cloud–Edge Reliability',
      description: 'Keep one execution model across hosted and local environments while making failure paths and review surfaces visible.',
    },
    {
      title: 'Edge-First AI Systems',
      description: 'Run governed execution closer to devices, with local execution paths where teams need them.',
    },
    {
      title: 'Air-Gapped & Restricted Environments',
      description: 'Isolated operation with encrypted storage and no external telemetry, designed for secure facilities.',
    },
    {
      title: 'AI Reliability Engineering',
      description: 'Inspect execution events, signed records, and replayable run context for production AI systems.',
    },
  ]

  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12 border border-gray-300 dark:border-[#f6f6f4]/5" style={{
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
        }}>
          <div className="w-full px-0">
            <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block border border-gray-300 dark:border-[#f6f6f4]/5" style={{
              transform: 'translateX(-66.67%)'
            }}></div>

            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Use Cases
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                How teams use Igris across hosted, local, and hybrid execution surfaces.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mobile-auto-height" style={{ minHeight: '750px' }}>
              {/* Left Column - Empty */}
              <div className="hidden lg:flex text-left lg:col-span-2 pl-0 md:pl-4 lg:pl-8 flex-col justify-center mobile-auto-height" style={{ minHeight: '750px' }}>
              </div>

              {/* Right Column - All Content */}
              <div className="text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex flex-col justify-center mobile-auto-height" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Use Cases
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter mb-12">
                  How teams use Igris across hosted, local, and hybrid execution surfaces.
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
