import React from 'react'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const features = [
  {
    name: 'API-First Architecture',
    description: 'REST APIs for data and ML workflows. Upload CSVs, train models, and get predictions with simple HTTP calls. Built on FastAPI for speed and reliability.',
  },
  {
    name: 'Developer Experience',
    description: 'APIs that hide the heavy lifting. Focus on your data and logic, not infrastructure setup or maintenance.',
  },
  {
    name: 'Data to Model Pipeline',
    description: 'From messy CSVs to trained models. Automate processing and training through API calls, no complex pipeline setup required.',
  },
]

export default function BuiltForEngineers() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1450px]">
          <div className="relative p-8" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f2f1ed',
            minHeight: '750px'
          }}>

            {/* Content Container with Original Width */}
            <div className="max-w-[1100px] mx-auto">
              <div className="text-center mb-12">
                <div className="inline-block border border-gray-300 rounded-lg px-3 py-1.5">
                  <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter text-center">Built for engineers shipping ML at speed.</h2>
                </div>
                <p className="mt-2 text-lg font-medium tracking-tight text-gray-900 dark:text-white md:text-2xl text-center font-inter">
                  <span style={{ color: '#114dcd' }}>No infra. No setup. Just results.</span>
                </p>
                <p className="mt-6 text-base leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
                  Most ML projects stall on infrastructure.<br /> Igris Inertial removes that bottleneck with simple APIs <br /> that take you from messy data to working models fast.
                </p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                  {/* Left side - 2 rows */}
                  <div className="border-r border-gray-200 dark:border-gray-700">
                    <div className="p-16 text-left border-b border-gray-200 dark:border-gray-700" style={{ minHeight: '225px' }}>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">
                        {features[0].name}
                      </h3>
                      <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                        {features[0].description}
                      </p>
                    </div>
                    <div className="p-16 text-left" style={{ minHeight: '225px' }}>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">
                        {features[1].name}
                      </h3>
                      <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                        {features[1].description}
                      </p>
                    </div>
                  </div>

                  {/* Right side - single tall column */}
                  <div className="p-16 text-left" style={{ minHeight: '450px' }}>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">
                      {features[2].name}
                    </h3>
                    <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                      {features[2].description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Button moved below cards */}
              <div className="mt-10 text-center">
                <Link
                  href="/#pricing"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
                >
                  Explore Igris Inertial
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
